// Extracts the two most dominant non-white/black colors from an image URL.
export async function extractDominantColors(imageUrl: string): Promise<{ primary: string; secondary: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ primary: "#1a3a6c", secondary: "#4a4a4a" });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          // skip near-white/near-black/very desaturated
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max > 240 && min > 240) continue;
          if (max < 25) continue;
          const key = `${Math.round(r / 24) * 24}-${Math.round(g / 24) * 24}-${Math.round(b / 24) * 24}`;
          const existing = buckets.get(key);
          if (existing) { existing.count++; existing.r += r; existing.g += g; existing.b += b; }
          else buckets.set(key, { r, g, b, count: 1 });
        }
        const sorted = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5);
        const toHex = (b: typeof sorted[0]) => {
          const r = Math.round(b.r / b.count), g = Math.round(b.g / b.count), bl = Math.round(b.b / b.count);
          return "#" + [r, g, bl].map(v => v.toString(16).padStart(2, "0")).join("");
        };
        const primary = sorted[0] ? toHex(sorted[0]) : "#1a3a6c";
        const secondary = sorted[1] ? toHex(sorted[1]) : "#4a4a4a";
        resolve({ primary, secondary });
      } catch {
        resolve({ primary: "#1a3a6c", secondary: "#4a4a4a" });
      }
    };
    img.onerror = () => resolve({ primary: "#1a3a6c", secondary: "#4a4a4a" });
    img.src = imageUrl;
  });
}
