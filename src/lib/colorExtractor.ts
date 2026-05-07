// Logo-Farb-Analyse + sanfte Normalisierung für PDF-Briefköpfe.
// Ziele:
//  - Echte Markenfarbe gewinnt (Sättigung × Häufigkeit), nicht nur Pixel-Masse.
//  - Ergebnisse werden in einen professionellen HSL-Bereich gezogen
//    (nie grell, nie zu dunkel, nie zu blass).
//  - Reine Schwarz-/Weiß-Logos → dezenter Anthrazit-Fallback.
//
// Außerdem: kuratierte Profi-Palette als manuelle Auswahl für den Nutzer.

export interface PdfPaletteSwatch {
  id: string;
  label: string;
  primary: string;
  secondary: string;
}

// Sanfte, sehr business-taugliche Töne. Bewusst gedeckt – funktioniert auf weißem Papier.
export const PDF_COLOR_PALETTE: PdfPaletteSwatch[] = [
  { id: "anthracite", label: "Anthrazit",   primary: "#2b2f36", secondary: "#5b6470" },
  { id: "navy",       label: "Navy",        primary: "#1a3a6c", secondary: "#4a5a72" },
  { id: "ocean",      label: "Ozean",       primary: "#1f5f7a", secondary: "#4a7388" },
  { id: "forest",     label: "Tannengrün",  primary: "#2f5d4a", secondary: "#5b7a6e" },
  { id: "olive",      label: "Olive",       primary: "#5a6b3a", secondary: "#7a866a" },
  { id: "burgundy",   label: "Bordeaux",    primary: "#7a3340", secondary: "#8e5a63" },
  { id: "terracotta", label: "Terrakotta",  primary: "#a85a3a", secondary: "#b8806a" },
  { id: "mustard",    label: "Senf",        primary: "#9a7a2a", secondary: "#a89866" },
  { id: "plum",       label: "Pflaume",     primary: "#5a3a6c", secondary: "#7a6088" },
  { id: "graphite",   label: "Graphit",     primary: "#3a3a3a", secondary: "#6b6b6b" },
];

const FALLBACK_PRIMARY = "#2b2f36";
const FALLBACK_SECONDARY = "#5b6470";

// HSL-Profi-Fenster: gedeckte Sättigung, mittlere Helligkeit, gut lesbar auf Weiß.
const SAT_MIN = 0.25;
const SAT_MAX = 0.55;
const LIGHT_MIN = 0.28;
const LIGHT_MAX = 0.45;

const SECONDARY_LIGHT_OFFSET = 0.18; // Sekundär ein Stück heller
const SECONDARY_SAT_FACTOR = 0.6;    // und etwas weniger gesättigt

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Zieht eine beliebige Farbe in den professionellen Bereich.
function normalizeToProfessional(hex: string): { primary: string; secondary: string } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY };
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  const { h, s, l } = rgbToHsl(r, g, b);

  // Achromatisch (Schwarz/Weiß-Logo) → Anthrazit-Fallback.
  if (s < 0.08) return { primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY };

  const ps = clamp(s, SAT_MIN, SAT_MAX);
  const pl = clamp(l, LIGHT_MIN, LIGHT_MAX);
  const primary = hslToHex(h, ps, pl);

  const ss = clamp(ps * SECONDARY_SAT_FACTOR, 0.12, SAT_MAX);
  const sl = clamp(pl + SECONDARY_LIGHT_OFFSET, LIGHT_MIN, 0.6);
  const secondary = hslToHex(h, ss, sl);

  return { primary, secondary };
}

// Extrahiert die dominante Markenfarbe (Sättigung × Häufigkeit gewichtet)
// und normalisiert sie sanft. Liefert immer Profi-taugliche Werte.
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
        if (!ctx) return resolve({ primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const buckets = new Map<string, { r: number; g: number; b: number; count: number; weight: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          // Skip near-white und near-black – das sind meist Hintergrund/Outline.
          if (max > 240 && min > 240) continue;
          if (max < 25) continue;
          const { s } = rgbToHsl(r, g, b);
          // Gewichtung: kräftige (gesättigte) Pixel zählen mehr als beige Flächen.
          // Sehr ungesättigte Pixel (<0.12) bekommen Mini-Gewicht, damit sie Schwarz/Weiß nicht überlagern.
          const weight = s < 0.12 ? 0.15 : 0.4 + s;
          const key = `${Math.round(r / 24) * 24}-${Math.round(g / 24) * 24}-${Math.round(b / 24) * 24}`;
          const ex = buckets.get(key);
          if (ex) { ex.count++; ex.weight += weight; ex.r += r; ex.g += g; ex.b += b; }
          else buckets.set(key, { r, g, b, count: 1, weight });
        }

        const sorted = [...buckets.values()].sort((a, b) => b.weight - a.weight).slice(0, 5);
        if (sorted.length === 0) return resolve({ primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY });
        const top = sorted[0];
        const r = Math.round(top.r / top.count);
        const g = Math.round(top.g / top.count);
        const b = Math.round(top.b / top.count);
        const rawHex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        resolve(normalizeToProfessional(rawHex));
      } catch {
        resolve({ primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY });
      }
    };
    img.onerror = () => resolve({ primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY });
    img.src = imageUrl;
  });
}
