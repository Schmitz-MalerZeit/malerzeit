import jsPDF from "jspdf";

export interface QuotePDFData {
  company: {
    name?: string;
    contact?: string;
    address?: string;
    phone?: string;
    email?: string;
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

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(d.company.name || "Ihr Malerbetrieb", d.company.logoDataUrl ? margin + 28 : margin, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Unverbindlicher Preisvorschlag", d.company.logoDataUrl ? margin + 28 : margin, 27);

  doc.setFontSize(9);
  doc.text(`Datum: ${d.date}`, pageW - margin, 20, { align: "right" });

  let y = 52;

  // Company contact
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  const contactLines = [d.company.contact, d.company.address, d.company.phone, d.company.email].filter(Boolean) as string[];
  contactLines.forEach((l) => { doc.text(l, margin, y); y += 4.5; });
  y += 6;

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
