// Hilfsfunktionen rund um Baustellen-Fotos je Vorschlag/Raum.
// Jede Sektion bekommt eine stabile section_id (UUID), damit Fotos auch nach
// Umsortieren der Räume korrekt zugeordnet bleiben.

import { supabase } from "@/integrations/supabase/client";

export const MAX_PHOTOS_PER_SECTION = 10;

export type QuotePhoto = {
  id: string;
  user_id: string;
  quote_id: string;
  section_id: string;
  storage_path: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type QuotePhotoWithUrl = QuotePhoto & { url: string };

/** Stellt sicher, dass jede Sektion eine stabile id besitzt. Mutiert NICHT. */
export function withSectionIds<T extends { id?: string; title?: string; items?: any[] }>(
  sections: T[] | null | undefined,
): Array<T & { id: string }> {
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => ({
    ...s,
    id: s.id && typeof s.id === "string" && s.id.length > 0 ? s.id : crypto.randomUUID(),
  }));
}

/** JPEG-Komprimierung im Browser. Max-Kante 1600 px, Qualität 0.82.
 *  Bei Fehlern (z. B. HEIC, das der Browser nicht decodieren kann) wird
 *  die Originaldatei als Fallback zurückgegeben, damit der Upload nicht scheitert. */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("FileReader fehlgeschlagen"));
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Bild konnte nicht decodiert werden (evtl. HEIC?)"));
      i.src = dataUrl;
    });
    const MAX = 1600;
    let { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new Error("Bildgröße unbekannt");
    if (w > MAX || h > MAX) {
      const scale = Math.min(MAX / w, MAX / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar");
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas → Blob fehlgeschlagen"))),
        "image/jpeg",
        0.82,
      ),
    );
    return { blob, width: w, height: h, mime: "image/jpeg" };
  } catch (err) {
    console.warn("[quotePhotos] compressImage Fallback (Original wird hochgeladen):", err);
    return { blob: file, width: 0, height: 0, mime: file.type || "image/jpeg" };
  }
}

export async function uploadQuotePhoto(opts: {
  userId: string;
  quoteId: string;
  sectionId: string;
  file: File;
  sortOrder?: number;
}): Promise<QuotePhoto> {
  const { blob, width, height } = await compressImage(opts.file);
  const path = `${opts.userId}/${opts.quoteId}/${opts.sectionId}/${Date.now()}_${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("quote-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("quote_photos")
    .insert({
      user_id: opts.userId,
      quote_id: opts.quoteId,
      section_id: opts.sectionId,
      storage_path: path,
      sort_order: opts.sortOrder ?? 0,
      width,
      height,
    })
    .select()
    .single();
  if (error) {
    // Best-effort cleanup
    await supabase.storage.from("quote-photos").remove([path]);
    throw error;
  }
  return data as QuotePhoto;
}

export async function listQuotePhotos(quoteId: string): Promise<QuotePhoto[]> {
  const { data, error } = await supabase
    .from("quote_photos")
    .select("*")
    .eq("quote_id", quoteId)
    .order("section_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as QuotePhoto[];
}

export async function deleteQuotePhoto(photo: Pick<QuotePhoto, "id" | "storage_path">): Promise<void> {
  await supabase.storage.from("quote-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("quote_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

export async function getSignedPhotoUrl(path: string, ttlSeconds = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from("quote-photos")
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) throw error || new Error("Signed URL fehlgeschlagen");
  return data.signedUrl;
}

export async function attachUrlsToPhotos(photos: QuotePhoto[]): Promise<QuotePhotoWithUrl[]> {
  return Promise.all(
    photos.map(async (p) => ({ ...p, url: await getSignedPhotoUrl(p.storage_path) })),
  );
}

/** Lädt eine signed-URL-Bilddatei und konvertiert sie für jsPDF in eine DataURL. */
export async function photoUrlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
