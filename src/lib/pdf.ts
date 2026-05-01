import jsPDF from "jspdf";

export interface QuotePDFData {
  company: {
    name?: string;
    contact?: string;
    address?: string;
    addressLine2?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    email?: string;
    website?: string;
    vatId?: string;
    logoDataUrl?: string;
    /** Natürliche Bildmaße – für proportionale Skalierung im PDF. */
    logoNaturalWidth?: number;
    logoNaturalHeight?: number;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customer?: {
    name?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  date: string;
  lineItems: string[];
  net: number;
  vat: number;
  gross: number;
  vatRate: number;
  /** Gültigkeit des Preises in Tagen, wird unten am Ende angezeigt. */
  validityDays?: number;
  /** Individueller Abschlusssatz (z. B. "Sollte Ihnen unser Angebot zusagen …"). */
  closingText?: string;
  /** Name unter "Mit freundlichen Grüßen". Fallback: Firmenname. */
  signatureName?: string;
}

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 26,
    parseInt(h.slice(2, 4), 16) || 58,
    parseInt(h.slice(4, 6), 16) || 108,
  ];
};

/**
 * Klares, minimalistisches Briefkopf-Layout (vgl. Referenz-PDF des Nutzers):
 *  - kein farbiger Header-Balken; viel Weißraum
 *  - Logo oben rechts (proportional in einer Bounding-Box)
 *  - links die Empfänger-Anschrift im klassischen DIN-Fensterumschlag-Bereich
 *  - rechts daneben Datum + Meta-Info
 *  - dünne Trennlinien statt farbiger Flächen
 *  - Pricing-Box (großer Button) mit Brutto bleibt visuell prominent
 *  - Footer mit Anschrift / Kontakt in 2 Spalten + Gültigkeit + Grußformel + Abschlusssatz
 */
export function buildQuotePDF(d: QuotePDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const primary = hexToRgb(d.company.primaryColor || "#1a3a6c");
  const secondary = hexToRgb(d.company.secondaryColor || "#4a4a4a");

  // ───────── Logo oben rechts ─────────
  const logoBox = { x: pageW - margin - 36, y: margin - 4, w: 36, h: 22 };
  let logoRendered = false;
  if (d.company.logoDataUrl) {
    const src = d.company.logoDataUrl;
    let imgFmt: "PNG" | "JPEG" | "WEBP" = "PNG";
    let unsupported = false;
    const m = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
    if (m) {
      const ext = m[1].toLowerCase();
      if (ext === "webp") imgFmt = "WEBP";
      else if (ext.startsWith("jp")) imgFmt = "JPEG";
      else if (ext === "png") imgFmt = "PNG";
      else unsupported = true;
    } else if (/\.(jpe?g)(\?|$)/i.test(src)) imgFmt = "JPEG";
    else if (/\.webp(\?|$)/i.test(src))      imgFmt = "WEBP";
    else if (/\.svg(\?|$)/i.test(src))       unsupported = true;

    if (!unsupported) {
      try {
        const natW = d.company.logoNaturalWidth  || 0;
        const natH = d.company.logoNaturalHeight || 0;
        let w = logoBox.w, h = logoBox.h;
        if (natW > 0 && natH > 0) {
          const scale = Math.min(logoBox.w / natW, logoBox.h / natH);
          w = natW * scale;
          h = natH * scale;
        }
        // rechtsbündig im Box-Bereich
        const x = logoBox.x + (logoBox.w - w);
        const y = logoBox.y + (logoBox.h - h) / 2;
        doc.addImage(src, imgFmt, x, y, w, h, undefined, "FAST");
        logoRendered = true;
      } catch (err) {
        console.warn("[pdf] logo render failed, using initial fallback", err);
      }
    } else {
      console.warn("[pdf] unsupported logo format, using initial fallback");
    }
  }
  if (d.company.logoDataUrl && !logoRendered) {
    const initial = (d.company.name || "?").trim().charAt(0).toUpperCase() || "?";
    const cx = logoBox.x + logoBox.w - logoBox.h / 2;
    const cy = logoBox.y + logoBox.h / 2;
    const r  = logoBox.h / 2 - 1;
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.circle(cx, cy, r, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(initial, cx, cy + 1.8, { align: "center" });
  }

  // ───────── Anschriften-Bereich (DIN-ähnlich) ─────────
  // Sender-Mini-Zeile über der Empfängeradresse (klassische dünne Schrift)
  const senderMini = [
    d.company.name,
    d.company.address,
    [d.company.postalCode, d.company.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");

  let y = 55;
  if (senderMini) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(senderMini, margin, y);
    // dünne Trennlinie unter der Mini-Zeile
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1.5, margin + 90, y + 1.5);
    y += 6;
  }

  // Empfänger
  const recYStart = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  if (d.customer) {
    const lines = [
      d.customer.name,
      d.customer.address,
      [d.customer.postalCode, d.customer.city].filter(Boolean).join(" "),
    ].filter(Boolean) as string[];
    lines.forEach((ln, i) => doc.text(ln, margin, recYStart + i * 5.2));
  }

  // Rechts oben: Datum (klassisches Meta-Block-Format)
  const metaX = pageW - margin;
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Angebotsdatum:", metaX - 28, recYStart, { align: "right" });
  doc.setTextColor(40, 40, 40);
  doc.text(d.date, metaX, recYStart, { align: "right" });

  y = recYStart + 28;

  // ───────── Titel "Unverbindliche Preisorientierung" ─────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("Unverbindliche Preisorientierung", margin, y);
  y += 6;

  // Kleine Überschrift mit Kundenname als sofortiger Bezugspunkt
  if (d.customer?.name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`für ${d.customer.name}`, margin, y);
    y += 6;
  } else {
    y += 4;
  }

  // ───────── Anrede ─────────
  const salutation = "Sehr geehrte Damen und Herren,";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(50, 50, 50);
  doc.text(salutation, margin, y);
  y += 5;
  doc.text(
    "vielen Dank für Ihre Anfrage. Gerne geben wir Ihnen nachfolgend eine unverbindliche Preisorientierung für die geplanten Arbeiten:",
    margin, y, { maxWidth: pageW - margin * 2 }
  );
  y += 10;

  // ───────── Leistungsbeschreibung (klare Liste, dünne Linien) ─────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text("Leistungsbeschreibung", margin, y);
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(45, 45, 45);
  d.lineItems.forEach((item, idx) => {
    const num = `${idx + 1}.`;
    const lines = doc.splitTextToSize(item, pageW - margin * 2 - 8);
    if (y + lines.length * 5.2 > pageH - 80) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(num, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(45, 45, 45);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5.2 + 2.5;
    // dünner Trenner
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 0.5, pageW - margin, y - 0.5);
    y += 1.5;
  });

  y += 4;

  // ───────── Pricing-Block (großer Button, beibehalten) ─────────
  if (y > pageH - 80) { doc.addPage(); y = margin; }
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(margin, y, pageW - margin * 2, 38, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const labelX = margin + 6;
  const valueX = pageW - margin - 6;
  doc.text("Netto", labelX, y + 9);
  doc.text(fmt(d.net), valueX, y + 9, { align: "right" });
  doc.text(`MwSt. (${d.vatRate}%)`, labelX, y + 17);
  doc.text(fmt(d.vat), valueX, y + 17, { align: "right" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(labelX, y + 22, valueX, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Gesamtbetrag", labelX, y + 31);
  doc.text(fmt(d.gross), valueX, y + 31, { align: "right" });
  y += 46;

  // ───────── Unverbindlichkeits-Hinweis (direkt unter dem Preisblock) ─────────
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 90);
  const disclaimer =
    "Dieser Preis stellt eine unverbindliche Kostenschätzung dar und dient ausschließlich zur ersten Orientierung.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageW - margin * 2);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 4.5 + 4;

  // ───────── Gültigkeit ─────────
  if (y > pageH - 60) { doc.addPage(); y = margin; }
  const validityDays = d.validityDays && d.validityDays > 0 ? d.validityDays : 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Diese Preisorientierung ist ${validityDays} Tage ab Angebotsdatum gültig.`,
    margin, y,
  );
  y += 10;

  // ───────── Grußformel ─────────
  if (y > pageH - 45) { doc.addPage(); y = margin; }
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  doc.text("Mit freundlichen Grüßen", margin, y);
  y += 6;
  // Zeichnungsberechtigte Person (Fallback: Inhaber/Ansprechpartner, sonst Firmenname).
  // Darunter automatisch der Firmenname, wenn Unterzeichner ≠ Firma.
  const sigName = (d.signatureName || d.company.contact || d.company.name || "").trim();
  const companyName = (d.company.name || "").trim();
  if (sigName) {
    doc.setFont("helvetica", "bold");
    doc.text(sigName, margin, y);
    y += 5;
    if (companyName && companyName.toLowerCase() !== sigName.toLowerCase()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(companyName, margin, y);
      y += 7;
    } else {
      y += 2;
    }
  } else {
    y += 4;
  }

  // ───────── Abschluss-Satz (kleiner) ─────────
  const closing = (d.closingText || "").trim();
  if (closing) {
    if (y > pageH - 30) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const cl = doc.splitTextToSize(closing, pageW - margin * 2);
    doc.text(cl, margin, y);
    y += cl.length * 4.5;
  }

  // ───────── Footer (Anschrift / Kontakt) ─────────
  const footerY = pageH - 22;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);

  const colW = (pageW - margin * 2) / 2;
  // Spalte 1: Anschrift
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text("Anschrift", margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  const addrLines = [
    d.company.name,
    d.company.address,
    d.company.addressLine2,
    [d.company.postalCode, d.company.city].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];
  addrLines.forEach((ln, i) => doc.text(ln, margin, footerY + 3.5 + i * 3.2));

  // Spalte 2: Kontakt
  const cx = margin + colW;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Kontakt", cx, footerY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  const contactLines = [
    d.company.website,
    d.company.email,
    d.company.phone,
    d.company.contact,
    d.company.vatId ? `USt-IdNr.: ${d.company.vatId}` : undefined,
  ].filter(Boolean) as string[];
  contactLines.forEach((ln, i) => doc.text(ln, cx, footerY + 3.5 + i * 3.2));

  return doc;
}

export async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch { return undefined; }
}

/**
 * Liest die natürlichen Pixelmaße eines Bildes – für proportionale PDF-Skalierung.
 */
export async function getImageNaturalSize(
  src: string
): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: { width: number; height: number } | undefined) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const t = setTimeout(() => finish(undefined), 4000);
    img.onload = () => {
      clearTimeout(t);
      const w = img.naturalWidth, h = img.naturalHeight;
      finish(w > 0 && h > 0 ? { width: w, height: h } : undefined);
    };
    img.onerror = () => { clearTimeout(t); finish(undefined); };
    try { img.src = src; } catch { finish(undefined); }
  });
}

/**
 * Bereitet ein Logo für die Einbettung in jspdf vor (rasterisiert SVG/exotische
 * Formate über Canvas in PNG). Siehe ausführlichen Kommentar im vorherigen Stand.
 */
export async function prepareLogoForPdf(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | undefined> {
  if (!src) return undefined;
  const isRaster =
    /^data:image\/(png|jpe?g|webp)/i.test(src) ||
    /\.(png|jpe?g|webp)(\?|$)/i.test(src);
  if (isRaster) {
    const size = await getImageNaturalSize(src);
    return { dataUrl: src, width: size?.width || 0, height: size?.height || 0 };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (v: { dataUrl: string; width: number; height: number } | undefined) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const t = setTimeout(() => finish(undefined), 4000);
    img.onload = () => {
      clearTimeout(t);
      try {
        const w = img.naturalWidth  || 512;
        const h = img.naturalHeight || 512;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(undefined);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        finish({ dataUrl, width: w, height: h });
      } catch (e) {
        console.warn("[pdf] logo rasterization failed", e);
        finish(undefined);
      }
    };
    img.onerror = () => { clearTimeout(t); finish(undefined); };
    try { img.src = src; } catch { finish(undefined); }
  });
}
