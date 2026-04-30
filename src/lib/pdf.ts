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

  // Logo
  if (d.company.logoDataUrl) {
    try {
      doc.addImage(d.company.logoDataUrl, "PNG", margin, 8, 24, 22, undefined, "FAST");
    } catch {/* ignore */}
  }

  // Reserve a safe slot on the right for the date so a long company name never overlaps it.
  // Date is fixed-width (~32 mm at fontSize 9). We leave 8 mm padding before it.
  const dateText = `Datum: ${d.date}`;
  const dateSlotW = 38;
  const nameStartX = d.company.logoDataUrl ? margin + 28 : margin;
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
