import jsPDF from "jspdf";

export type PdfLang = "de" | "en";

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
    /** Persönliche Anrede, z. B. "Herr Schröder", "Frau Müller", "Familie Schmidt". */
    salutation?: string;
    projectLabel?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  date: string;
  lineItems: string[];
  /** Optionale Gliederung in Räume/Bereiche. */
  sections?: Array<{
    title: string;
    items: string[];
    hours?: number;
    labor_cost?: number;
    material_cost?: number;
    net_amount?: number;
    vat_amount?: number;
    gross_amount?: number;
    /** Optionales Foto rechts neben der Raum-Überschrift. */
    photoDataUrl?: string;
    photoWidth?: number;
    photoHeight?: number;
  }>;
  /** Optionale Foto-Galerie (eigene Seite(n) am Ende des PDFs). */
  photoGallery?: Array<{
    sectionTitle: string;
    photos: Array<{ dataUrl: string; width?: number; height?: number }>;
  }>;
  net: number;
  vat: number;
  gross: number;
  vatRate: number;
  validityDays?: number;
  closingText?: string;
  signatureName?: string;
  /** Sprache des PDF-Dokuments (Standard: "de"). */
  lang?: PdfLang;
}

const STRINGS = {
  de: {
    title: "Unverbindliche Preisorientierung",
    salutation: "Sehr geehrte Damen und Herren,",
    intro:
      "vielen Dank für Ihre Anfrage. Gerne geben wir Ihnen nachfolgend eine unverbindliche Preisorientierung für die geplanten Arbeiten:",
    services: "Leistungsbeschreibung",
    carryDown: (net: string) => `Übertrag (Zwischensumme): Netto ${net}`,
    carryUp: (net: string) => `Übertrag von vorheriger Seite: Netto ${net}`,
    grossLabel: (g: string) => `Brutto ${g}`,
    subtotal: "Zwischensumme",
    hoursUnit: "Std",
    netLabelInline: (n: string) => `Netto ${n}`,
    net: "Netto",
    vat: (rate: number) => `MwSt. (${rate}%)`,
    total: "Gesamtbetrag",
    disclaimer:
      "Dieser Preis stellt eine unverbindliche Kostenschätzung dar und dient ausschließlich zur ersten Orientierung.",
    validity: (days: number) =>
      `Diese Preisorientierung ist ${days} Tage ab Angebotsdatum gültig.`,
    regards: "Mit freundlichen Grüßen",
    address: "Anschrift",
    contact: "Kontakt",
    vatId: (id: string) => `USt-IdNr.: ${id}`,
    pageOf: (p: number, t: number) => `Seite ${p} von ${t}`,
    photosTitle: "Baustellen-Fotos",
    photosCont: "Baustellen-Fotos (Fortsetzung)",
    locale: "de-DE",
  },
  en: {
    title: "Non-binding price estimate",
    salutation: "Dear Sir or Madam,",
    intro:
      "thank you for your inquiry. We are pleased to provide the following non-binding price estimate for the planned work:",
    services: "Scope of services",
    carryDown: (net: string) => `Carry-over (subtotal): Net ${net}`,
    carryUp: (net: string) => `Carry-over from previous page: Net ${net}`,
    grossLabel: (g: string) => `Gross ${g}`,
    subtotal: "Subtotal",
    hoursUnit: "hrs",
    netLabelInline: (n: string) => `Net ${n}`,
    net: "Net",
    vat: (rate: number) => `VAT (${rate}%)`,
    total: "Total amount",
    disclaimer:
      "This price is a non-binding cost estimate and serves only as initial guidance.",
    validity: (days: number) =>
      `This price estimate is valid for ${days} days from the quote date.`,
    regards: "Kind regards",
    address: "Address",
    contact: "Contact",
    vatId: (id: string) => `VAT ID: ${id}`,
    pageOf: (p: number, t: number) => `Page ${p} of ${t}`,
    photosTitle: "Site photos",
    photosCont: "Site photos (continued)",
    locale: "en-US",
  },
} as const;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 26,
    parseInt(h.slice(2, 4), 16) || 58,
    parseInt(h.slice(4, 6), 16) || 108,
  ];
};

export function buildQuotePDF(d: QuotePDFData): jsPDF {
  const lang: PdfLang = d.lang === "en" ? "en" : "de";
  const L = STRINGS[lang];
  const fmt = (n: number) =>
    n.toLocaleString(L.locale, { style: "currency", currency: "EUR" });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const primary = hexToRgb(d.company.primaryColor || "#1a3a6c");
  // secondary kept for potential future use
  hexToRgb(d.company.secondaryColor || "#4a4a4a");

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

  // ───────── Sender-Mini-Zeile ─────────
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
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1.5, margin + 90, y + 1.5);
    y += 6;
  }

  // ───────── Empfänger-Anschrift ─────────
  const recYStart = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  let recLineCount = 0;
  if (d.customer) {
    const lines = [
      d.customer.name,
      d.customer.address,
      [d.customer.postalCode, d.customer.city].filter(Boolean).join(" "),
    ].filter(Boolean) as string[];
    lines.forEach((ln, i) => doc.text(ln, margin, recYStart + i * 5.2));
    recLineCount = lines.length;
  }
  y = recYStart + Math.max(recLineCount, 1) * 5.2 + 12;

  // ───────── Titel + Datum ─────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(L.title, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text(d.date, pageW - margin, y, { align: "right", baseline: "alphabetic" });
  y += 12;

  // ───────── Anrede ─────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(50, 50, 50);
  doc.text(buildSalutation(d.customer?.salutation, lang) || L.salutation, margin, y);
  y += 5;
  doc.text(L.intro, margin, y, { maxWidth: pageW - margin * 2 });
  y += 12;

  // ───────── Leistungsbeschreibung ─────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(L.services, margin, y);
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const projectLabel = (d.customer?.projectLabel || "").trim();
  if (projectLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(45, 45, 45);
    const pl = doc.splitTextToSize(projectLabel, pageW - margin * 2);
    doc.text(pl, margin, y + 4);
    y += pl.length * 5.2 + 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(45, 45, 45);

  const useSections = Array.isArray(d.sections) && d.sections.length > 0
    && d.sections.some((s) => s && s.title && Array.isArray(s.items) && s.items.length > 0);

  const contentBottom = pageH - 32;

  let runningNet = 0;
  let runningGross = 0;

  const drawCarryDown = () => {
    if (runningNet <= 0 && runningGross <= 0) return;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, contentBottom + 2, pageW - margin, contentBottom + 2);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(L.carryDown(fmt(runningNet)), margin, contentBottom + 7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(L.grossLabel(fmt(runningGross)), pageW - margin, contentBottom + 7, { align: "right" });
  };

  const drawCarryUp = () => {
    if (runningNet <= 0 && runningGross <= 0) return;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(L.carryUp(fmt(runningNet)), margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(L.grossLabel(fmt(runningGross)), pageW - margin, y, { align: "right" });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(45, 45, 45);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom) {
      drawCarryDown();
      doc.addPage();
      y = margin;
      drawCarryUp();
    }
  };

  const drawItem = (item: string, num: string) => {
    const lines = doc.splitTextToSize(item, pageW - margin * 2 - 8);
    ensureSpace(lines.length * 5.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(num, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(45, 45, 45);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5.2 + 5;
  };

  if (useSections) {
    let counter = 0;
    d.sections!.forEach((sec, sIdx) => {
      const items = (sec.items || []).filter((x) => typeof x === "string" && x.trim());
      if (!items.length) return;

      // Foto rechts neben der Raum-Überschrift, falls vorhanden.
      // Bildbox: max 32mm breit, max 32mm hoch (~5–6 Textzeilen), proportional.
      const hasPhoto = !!sec.photoDataUrl;
      const photoBoxW = 32;
      const photoBoxH = 32;
      let photoActualW = 0;
      let photoActualH = 0;
      if (hasPhoto) {
        const natW = sec.photoWidth || 0;
        const natH = sec.photoHeight || 0;
        if (natW > 0 && natH > 0) {
          const scale = Math.min(photoBoxW / natW, photoBoxH / natH);
          photoActualW = natW * scale;
          photoActualH = natH * scale;
        } else {
          photoActualW = photoBoxW;
          photoActualH = photoBoxH;
        }
      }
      const headerBlockH = hasPhoto ? Math.max(8, photoActualH + 4) : 8;
      ensureSpace(headerBlockH + 6);
      if (sIdx > 0) y += 4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(primary[0], primary[1], primary[2]);
      // Titel vertikal mittig zur Bildbox ausrichten, wenn ein Bild vorhanden ist
      const titleY = hasPhoto ? y + photoActualH / 2 + 1.5 : y;
      const titleMaxW = hasPhoto ? pageW - margin * 2 - photoActualW - 4 : pageW - margin * 2;
      const titleLines = doc.splitTextToSize(sec.title, titleMaxW);
      doc.text(titleLines, margin, titleY);

      if (hasPhoto && sec.photoDataUrl) {
        try {
          const px = pageW - margin - photoActualW;
          doc.addImage(sec.photoDataUrl, "JPEG", px, y, photoActualW, photoActualH, undefined, "FAST");
        } catch (err) {
          console.warn("[pdf] section photo render failed", err);
        }
        y += Math.max(8, photoActualH) + 2;
      } else {
        y += 8;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(45, 45, 45);
      items.forEach((item) => {
        counter += 1;
        drawItem(item, `${counter}.`);
      });
      const hasSub =
        typeof sec.net_amount === "number" ||
        typeof sec.gross_amount === "number";
      if (hasSub) {
        ensureSpace(8);
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.2);
        doc.line(margin + 8, y - 2, pageW - margin, y - 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(90, 90, 90);
        const parts: string[] = [];
        if (typeof sec.net_amount === "number") parts.push(L.netLabelInline(fmt(sec.net_amount)));
        const left = `${L.subtotal} ${sec.title}` + (parts.length ? ` · ${parts.join(" · ")}` : "");
        doc.text(left, margin + 8, y + 2);
        if (typeof sec.gross_amount === "number") {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(primary[0], primary[1], primary[2]);
          doc.text(L.grossLabel(fmt(sec.gross_amount)), pageW - margin, y + 2, { align: "right" });
        }
        y += 8;
        if (typeof sec.net_amount === "number") runningNet += sec.net_amount;
        if (typeof sec.gross_amount === "number") runningGross += sec.gross_amount;
      }
    });
  } else {
    d.lineItems.forEach((item, idx) => {
      drawItem(item, `${idx + 1}.`);
    });
  }

  y += 4;

  // ───────── Pricing-Block ─────────
  if (y > pageH - 80) { doc.addPage(); y = margin; }
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(margin, y, pageW - margin * 2, 38, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const labelX = margin + 6;
  const valueX = pageW - margin - 6;
  doc.text(L.net, labelX, y + 9);
  doc.text(fmt(d.net), valueX, y + 9, { align: "right" });
  doc.text(L.vat(d.vatRate), labelX, y + 17);
  doc.text(fmt(d.vat), valueX, y + 17, { align: "right" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(labelX, y + 22, valueX, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(L.total, labelX, y + 31);
  doc.text(fmt(d.gross), valueX, y + 31, { align: "right" });
  y += 46;

  // ───────── Disclaimer ─────────
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 90);
  const disclaimerLines = doc.splitTextToSize(L.disclaimer, pageW - margin * 2);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 4.5 + 4;

  // ───────── Gültigkeit ─────────
  if (y > pageH - 60) { doc.addPage(); y = margin; }
  const validityDays = d.validityDays && d.validityDays > 0 ? d.validityDays : 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(L.validity(validityDays), margin, y);
  y += 10;

  // ───────── Grußformel ─────────
  if (y > pageH - 45) { doc.addPage(); y = margin; }
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  doc.text(L.regards, margin, y);
  y += 6;
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

  // ───────── Abschluss-Satz ─────────
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

  // ───────── Foto-Galerie (eigene Seite/Seiten) ─────────
  const gallery = (d.photoGallery || []).filter(
    (g) => g && Array.isArray(g.photos) && g.photos.length > 0
  );
  if (gallery.length > 0) {
    doc.addPage();
    let gy = margin;
    const galleryBottom = pageH - 32;
    const cols = 2;
    const gap = 6;
    const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = 60; // mm

    const drawHeader = (text: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.text(text, margin, gy);
      gy += 4;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, gy, pageW - margin, gy);
      gy += 6;
    };
    drawHeader(L.photosTitle);

    const ensureGallerySpace = (need: number) => {
      if (gy + need > galleryBottom) {
        doc.addPage();
        gy = margin;
        drawHeader(L.photosCont);
      }
    };

    for (const group of gallery) {
      // Section title
      ensureGallerySpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primary[0], primary[1], primary[2]);
      const titleLines = doc.splitTextToSize(group.sectionTitle || "", pageW - margin * 2);
      doc.text(titleLines, margin, gy);
      gy += titleLines.length * 5 + 3;

      // Photos in grid
      let col = 0;
      let rowMaxH = 0;
      for (const ph of group.photos) {
        if (col === 0) ensureGallerySpace(cellH + 4);
        const cx = margin + col * (cellW + gap);
        // proportional fit inside cell
        let w = cellW, h = cellH;
        const natW = ph.width || 0;
        const natH = ph.height || 0;
        if (natW > 0 && natH > 0) {
          const scale = Math.min(cellW / natW, cellH / natH);
          w = natW * scale;
          h = natH * scale;
        }
        const ox = cx + (cellW - w) / 2;
        const oy = gy + (cellH - h) / 2;
        try {
          doc.addImage(ph.dataUrl, "JPEG", ox, oy, w, h, undefined, "FAST");
        } catch (err) {
          console.warn("[pdf] gallery photo render failed", err);
        }
        rowMaxH = Math.max(rowMaxH, cellH);
        col += 1;
        if (col >= cols) {
          gy += rowMaxH + gap;
          col = 0;
          rowMaxH = 0;
        }
      }
      if (col > 0) {
        gy += rowMaxH + gap;
      }
      gy += 2;
    }
  }

  // ───────── Footer ─────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageH - 22;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageW - margin, footerY - 4);

    const colW = (pageW - margin * 2) / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(L.address, margin, footerY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    const addrLines = [
      d.company.name,
      d.company.address,
      d.company.addressLine2,
      [d.company.postalCode, d.company.city].filter(Boolean).join(" "),
    ].filter(Boolean) as string[];
    addrLines.forEach((ln, i) => doc.text(ln, margin, footerY + 3.5 + i * 3.2));

    const cx = margin + colW;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(L.contact, cx, footerY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    const contactLines = [
      d.company.website,
      d.company.email,
      d.company.phone,
      d.company.contact,
      d.company.vatId ? L.vatId(d.company.vatId) : undefined,
    ].filter(Boolean) as string[];
    contactLines.forEach((ln, i) => doc.text(ln, cx, footerY + 3.5 + i * 3.2));

    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(L.pageOf(p, totalPages), pageW - margin, pageH - 8, { align: "right" });
    }
  }

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
