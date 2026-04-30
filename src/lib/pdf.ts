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

export function buildQuotePDF(d: QuotePDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  const primary = hexToRgb(d.company.primaryColor || "#1a3a6c");
  const secondary = hexToRgb(d.company.secondaryColor || "#4a4a4a");

  // Header band
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageW, 38, "F");

  // Logo: proportional skalieren ("contain") in eine feste Bounding-Box,
  // damit das Original-Seitenverhältnis erhalten bleibt – nie verzerrt, nie beschnitten.
  // Die Box sitzt links im Header-Band; der Text rechts davon startet immer
  // an derselben Position, unabhängig von Hoch-/Quer-/Quadrat-Logo.
  //
  // Robustheit: jspdf unterstützt nur PNG/JPEG/WEBP nativ. SVGs, defekte Data-URLs,
  // unbekannte Formate oder fehlende natural sizes dürfen die PDF-Generierung NIE
  // brechen – stattdessen greift ein gestaffelter Fallback:
  //   1. Format unbekannt/SVG → Versuch, das Bild über Canvas zu PNG zu rasterisieren
  //      (passiert vorab in QuoteResult, hier nur defensiv erkannt).
  //   2. addImage wirft → Initial-Fallback (Kreis mit Firmen-Initiale) wird gezeichnet.
  //   3. Keine natural sizes → komplette Bounding-Box wird genutzt.
  const logoBox = { x: margin, y: 6, w: 30, h: 26 }; // max. Logo-Größe in mm
  let logoRendered = false;
  if (d.company.logoDataUrl) {
    const src = d.company.logoDataUrl;
    // Format-Detection: explizite Whitelist, sonst PNG-Default versuchen.
    let imgFmt: "PNG" | "JPEG" | "WEBP" = "PNG";
    let unsupported = false;
    const m = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
    if (m) {
      const ext = m[1].toLowerCase();
      if (ext === "webp") imgFmt = "WEBP";
      else if (ext.startsWith("jp")) imgFmt = "JPEG";
      else if (ext === "png") imgFmt = "PNG";
      else unsupported = true; // svg+xml, gif, avif, …
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
        const x = logoBox.x;
        const y = logoBox.y + (logoBox.h - h) / 2;
        doc.addImage(src, imgFmt, x, y, w, h, undefined, "FAST");
        logoRendered = true;
      } catch (err) {
        // jspdf konnte das Bild nicht parsen (defekte Data-URL, unpassendes Format).
        // Wir loggen leise und fallen unten auf die Initial-Variante zurück.
        console.warn("[pdf] logo render failed, using initial fallback", err);
      }
    } else {
      console.warn("[pdf] unsupported logo format, using initial fallback");
    }
  }

  // Fallback-Renderschema: weißer Kreis mit der ersten Firmen-Initiale.
  // Wird gezeichnet, wenn (a) gar kein Logo vorhanden ist UND wir trotzdem optisches
  // Gleichgewicht im Header brauchen — nein, hier nur wenn ein Logo da war, aber
  // nicht eingebettet werden konnte (sonst sähe es wie ein "fehlendes" Asset aus).
  if (d.company.logoDataUrl && !logoRendered) {
    const initial = (d.company.name || "?").trim().charAt(0).toUpperCase() || "?";
    const cx = logoBox.x + logoBox.h / 2;
    const cy = logoBox.y + logoBox.h / 2;
    const r  = logoBox.h / 2 - 1;
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r, "F");
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(initial, cx, cy + 2.2, { align: "center" });
  }

  // Reserve a safe slot on the right for the date so a long company name never overlaps it.
  // Text-Startpunkt richtet sich nach max. Logo-Breite + Padding (konstant, nicht je Logo).
  const dateText = `Datum: ${d.date}`;
  const dateSlotW = 38;
  const nameStartX = d.company.logoDataUrl ? logoBox.x + logoBox.w + 4 : margin;
  const nameMaxW = pageW - margin - dateSlotW - nameStartX;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  // splitTextToSize returns an array – we only render the first line and append "…" if cut.
  const rawName = d.company.name || "Ihr Malerbetrieb";
  const nameLines = doc.splitTextToSize(rawName, nameMaxW);
  const nameLine = nameLines.length > 1 ? nameLines[0].replace(/\s+\S*$/, "") + "…" : nameLines[0];
  doc.text(nameLine, nameStartX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Unverbindlicher Preisvorschlag", nameStartX, 27);

  doc.setFontSize(9);
  doc.text(dateText, pageW - margin, 20, { align: "right" });

  let y = 50;

  // Classic German letterhead layout:
  //   LEFT  → recipient (customer) address — the actual "Anschrift" block.
  //   RIGHT → sender's company contact details (phone / e-mail / web, optional postal).
  // Separated by a thin rule in the secondary colour for a clean briefing-paper look.
  const customerCity = d.customer
    ? [d.customer.postalCode, d.customer.city].filter(Boolean).join(" ")
    : "";
  const left: { value: string }[] = d.customer
    ? [
        ...(d.customer.name    ? [{ value: d.customer.name }]    : []),
        ...(d.customer.address ? [{ value: d.customer.address }] : []),
        ...(customerCity       ? [{ value: customerCity }]       : []),
      ]
    : [];

  const companyCity = [d.company.postalCode, d.company.city].filter(Boolean).join(" ");
  // Sender block under the colored header band. The company name is already shown
  // big inside the header band, so we never repeat it here. If a contact person is
  // set we list them as the first line ("Ansprechpartner: …" style); otherwise we
  // start straight with the postal address — relevant for GmbHs / single-line
  // businesses where there is no individual contact.
  const right: { label: string; value: string }[] = [
    ...(d.company.contact      ? [{ label: "",      value: d.company.contact }]      : []),
    ...(d.company.address      ? [{ label: "",      value: d.company.address }]      : []),
    ...(d.company.addressLine2 ? [{ label: "",      value: d.company.addressLine2 }] : []),
    ...(companyCity            ? [{ label: "",      value: companyCity }]            : []),
    ...(d.company.phone        ? [{ label: "Tel.",  value: d.company.phone }]        : []),
    ...(d.company.email        ? [{ label: "E-Mail", value: d.company.email }]       : []),
    ...(d.company.website      ? [{ label: "Web",   value: d.company.website }]      : []),
  ];


  if (left.length || right.length) {
    const colGap   = 6;
    const colWidth = (pageW - margin * 2 - colGap) / 2;
    const labelW   = 12;       // fixed label column → values align
    const lineH    = 4.6;
    const rows     = Math.max(left.length, right.length);

    // Section labels (small caps style) in primary colour
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    if (left.length)  doc.text("ANSCHRIFT", margin, y);
    if (right.length) doc.text("ABSENDER",  margin + colWidth + colGap, y);
    y += 3.5;

    // Thin accent rules under each section label
    doc.setDrawColor(secondary[0], secondary[1], secondary[2]);
    doc.setLineWidth(0.2);
    if (left.length)  doc.line(margin, y, margin + colWidth, y);
    if (right.length) doc.line(margin + colWidth + colGap, y, pageW - margin, y);
    y += 4;

    // Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    // Truncate to a max width with an ellipsis – cells stay single-line, never overflow.
    const fit = (text: string, maxW: number): string => {
      if (doc.getTextWidth(text) <= maxW) return text;
      let s = text;
      while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
      return s + "…";
    };

    const startY = y;
    // Left column – customer address, full column width available, slightly larger
    doc.setFontSize(10);
    left.forEach((row, i) => {
      doc.text(fit(row.value, colWidth), margin, startY + i * lineH);
    });
    // Right column – sender details. Rows with a label (Tel./E-Mail/Web) get the
    // aligned label column; address-style rows (empty label) span the full width and
    // render in the regular text colour for a clean letter-head look.
    doc.setFontSize(9);
    right.forEach((row, i) => {
      const rx = margin + colWidth + colGap;
      const yRow = startY + i * lineH;
      if (row.label) {
        doc.setTextColor(120, 120, 120);
        doc.text(row.label, rx, yRow);
        doc.setTextColor(60, 60, 60);
        doc.text(fit(row.value, colWidth - labelW), rx + labelW, yRow);
      } else {
        doc.setTextColor(60, 60, 60);
        doc.text(fit(row.value, colWidth), rx, yRow);
      }
    });

    y = startY + rows * lineH + 8;
  }

  // Title
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Leistungsbeschreibung", margin, y);
  y += 3;
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  d.lineItems.forEach((item) => {
    const lines = doc.splitTextToSize(`•  ${item}`, pageW - margin * 2 - 4);
    if (y + lines.length * 6 > 250) { doc.addPage(); y = margin; }
    doc.text(lines, margin + 2, y);
    y += lines.length * 6 + 1.5;
  });

  y += 6;

  // Hint box
  if (y > 220) { doc.addPage(); y = margin; }
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageW - margin * 2, 18, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  const hint = "Der ausgewiesene Preis berücksichtigt einen geschätzten Arbeitslohn sowie den voraussichtlichen Materialeinsatz auf Grundlage der angegebenen Informationen.";
  doc.text(doc.splitTextToSize(hint, pageW - margin * 2 - 8), margin + 4, y + 6);
  y += 26;

  // Pricing block
  if (y > 230) { doc.addPage(); y = margin; }
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
  doc.text("Brutto", labelX, y + 31);
  doc.text(fmt(d.gross), valueX, y + 31, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(secondary[0], secondary[1], secondary[2]);
  doc.text(
    "Unverbindlicher Preisvorschlag auf Grundlage der angegebenen Informationen. Finale Preisfestlegung nach individueller Prüfung vor Ort.",
    pageW / 2,
    285,
    { align: "center", maxWidth: pageW - margin * 2 }
  );

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

/** Liest die natürlichen Pixelmaße eines Bildes – für proportionale PDF-Skalierung. */
export async function getImageNaturalSize(
  src: string
): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}
