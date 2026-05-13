import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTr } from "@/lib/tr";
import type { QuotePhotoWithUrl } from "@/lib/quotePhotos";

export function QuotePhotoLightbox(props: {
  photos: QuotePhotoWithUrl[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (idx: number) => void;
  /** Optional captions per index (e.g. section titles) */
  captions?: string[];
}) {
  const tr = useTr();
  const { photos, index, onClose, onIndexChange, captions } = props;
  const open = index !== null && index >= 0 && index < photos.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, (index ?? 0) - 1));
      else if (e.key === "ArrowRight") onIndexChange(Math.min(photos.length - 1, (index ?? 0) + 1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onClose, onIndexChange]);

  if (!open) return null;
  const i = index as number;
  const photo = photos[i];
  const caption = captions?.[i];

  // Touch swipe
  let touchStartX = 0;
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) onIndexChange(Math.max(0, i - 1));
    else onIndexChange(Math.min(photos.length - 1, i + 1));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl p-0 bg-background/95 border-0 [&>button]:hidden">
        <div className="relative w-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-background/80 text-foreground shadow"
            aria-label={tr("Schließen", "Close")}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center justify-center min-h-[60vh] max-h-[85vh]">
            <img
              src={photo.url}
              alt=""
              className="max-h-[85vh] max-w-full object-contain select-none"
              draggable={false}
            />
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onIndexChange(Math.max(0, i - 1))}
                disabled={i === 0}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 text-foreground shadow disabled:opacity-30"
                aria-label={tr("Vorheriges Foto", "Previous photo")}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => onIndexChange(Math.min(photos.length - 1, i + 1))}
                disabled={i === photos.length - 1}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 text-foreground shadow disabled:opacity-30"
                aria-label={tr("Nächstes Foto", "Next photo")}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background/80 text-xs text-foreground shadow">
            {caption ? `${caption} · ` : ""}{i + 1} / {photos.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
