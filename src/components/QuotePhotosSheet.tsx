import { useEffect, useRef, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_PHOTOS_PER_SECTION,
  type QuotePhotoWithUrl,
  attachUrlsToPhotos,
  deleteQuotePhoto,
  listQuotePhotos,
  uploadQuotePhoto,
} from "@/lib/quotePhotos";
import { supabase } from "@/integrations/supabase/client";
import { useTr } from "@/lib/tr";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuotePhotoLightbox } from "./QuotePhotoLightbox";

export function QuotePhotosSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  sectionId: string | null;
  sectionTitle: string;
  /** Optional: callback when count changes, so parent can show badge */
  onCountChange?: (count: number) => void;
}) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const { open, onOpenChange, quoteId, sectionId, sectionTitle } = props;
  const [photos, setPhotos] = useState<QuotePhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !quoteId || !sectionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const all = await listQuotePhotos(quoteId);
        const forSec = all.filter((p) => p.section_id === sectionId);
        const withUrls = await attachUrlsToPhotos(forSec);
        if (!cancelled) {
          setPhotos(withUrls);
          props.onCountChange?.(withUrls.length);
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || tr("Fotos konnten nicht geladen werden", "Could not load photos"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quoteId, sectionId]);

  const handleFiles = async (files: FileList | null) => {
    console.log("[QuotePhotosSheet] handleFiles", { count: files?.length, quoteId, sectionId });
    if (!files || files.length === 0) return;
    if (!quoteId || !sectionId) {
      toast.error(tr("Vorschlag wird noch gespeichert – bitte kurz warten und erneut versuchen.", "Quote is still saving – please wait a moment and try again."));
      return;
    }
    const remaining = MAX_PHOTOS_PER_SECTION - photos.length;
    if (remaining <= 0) {
      toast.error(tr(`Maximal ${MAX_PHOTOS_PER_SECTION} Fotos pro Raum.`, `Maximum ${MAX_PHOTOS_PER_SECTION} photos per room.`));
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));
      const baseSort = photos.length;
      const uploaded: QuotePhotoWithUrl[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
          console.warn("[QuotePhotosSheet] skipping non-image", file.name, file.type);
          continue;
        }
        try {
          const photo = await uploadQuotePhoto({
            userId: u.user.id,
            quoteId,
            sectionId,
            file,
            sortOrder: baseSort + i,
          });
          const withUrls = await attachUrlsToPhotos([photo]);
          uploaded.push(withUrls[0]);
        } catch (perFileErr: any) {
          console.error("[QuotePhotosSheet] per-file upload failed", file.name, perFileErr);
          toast.error(`${file.name}: ${perFileErr?.message || tr("Upload fehlgeschlagen", "Upload failed")}`);
        }
      }
      if (uploaded.length === 0) return;
      const next = [...photos, ...uploaded];
      setPhotos(next);
      props.onCountChange?.(next.length);
      toast.success(tr(`${uploaded.length} Foto(s) hinzugefügt`, `${uploaded.length} photo(s) added`));
    } catch (e: any) {
      console.error("[QuotePhotosSheet] handleFiles error", e);
      toast.error(e?.message || tr("Upload fehlgeschlagen", "Upload failed"));
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleDelete = async (photo: QuotePhotoWithUrl) => {
    if (!confirm(tr("Foto wirklich löschen?", "Really delete photo?"))) return;
    try {
      await deleteQuotePhoto(photo);
      const next = photos.filter((p) => p.id !== photo.id);
      setPhotos(next);
      props.onCountChange?.(next.length);
    } catch (e: any) {
      toast.error(e?.message || tr("Löschen fehlgeschlagen", "Delete failed"));
    }
  };

  const limitReached = photos.length >= MAX_PHOTOS_PER_SECTION;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle>{tr("Fotos", "Photos")} · {sectionTitle}</SheetTitle>
            <SheetDescription>
              {tr(
                `Bis zu ${MAX_PHOTOS_PER_SECTION} Fotos pro Raum. Alle Fotos werden am Ende des PDFs als Galerie angehängt – nach Räumen gruppiert.`,
                `Up to ${MAX_PHOTOS_PER_SECTION} photos per room. All photos are appended at the end of the PDF as a gallery, grouped by room.`,
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : photos.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {tr("Noch keine Fotos.", "No photos yet.")}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, idx) => (
                  <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                    <button
                      type="button"
                      onClick={() => setLightboxIdx(idx)}
                      className="absolute inset-0 w-full h-full"
                      aria-label={tr("Foto vergrößern", "Enlarge photo")}
                    >
                      <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="absolute top-1 right-1 p-1.5 rounded-full bg-background/80 text-destructive shadow-sm hover:bg-background"
                      aria-label={tr("Foto löschen", "Delete photo")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SheetFooter className="flex-col gap-2 sm:flex-col sm:gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {isMobile ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading || limitReached}
                  onClick={() => cameraRef.current?.click()}
                  className="h-11"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-2" /> {tr("Kamera", "Camera")}</>}
                </Button>
                <Button
                  type="button"
                  disabled={uploading || limitReached}
                  onClick={() => galleryRef.current?.click()}
                  className="h-11"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4 mr-2" /> {tr("Galerie", "Gallery")}</>}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                disabled={uploading || limitReached}
                onClick={() => galleryRef.current?.click()}
                className="h-11 w-full"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4 mr-2" /> {tr("Bilder auswählen", "Choose images")}</>}
              </Button>
            )}
            <div className="text-xs text-muted-foreground text-center">
              {photos.length} / {MAX_PHOTOS_PER_SECTION}
              {limitReached && " · " + tr("Limit erreicht", "Limit reached")}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <QuotePhotoLightbox
        photos={photos}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onIndexChange={setLightboxIdx}
      />
    </>
  );
}
