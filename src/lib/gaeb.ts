// GAEB DA XML 3.2 — Datenaustauschphase 83 (Angebotsabgabe).
// Erzeugt eine .X83-Datei aus einer Preisorientierung, sodass Handwerker-/
// Kalkulations-Software (TopKontor, Streit, Moser, TAIFUN, WinWorker, plancraft,
// HERO, ToolTime, Sander & Doll, Labelwin u.a.) das LV inkl. Preise importieren
// und daraus ein verbindliches Angebot machen kann.
//
// Modellierung: Da unsere Preisorientierungen nicht in Einheits-Mengen
// (m², lfm …) erfasst werden, exportieren wir je Sektion (Raum/Bereich) eine
// Pauschal-Position (Qty=1, QU=psch, EP = Bereichs-Netto). Items der Sektion
// werden als Langtext eingebettet.

export interface GaebSectionInput {
  title?: string;
  items?: string[];
  net_amount?: number;
}

export interface GaebQuoteInput {
  projectName?: string;
  projectLabel?: string;
  customer?: { name?: string; address?: string; postalCode?: string; city?: string };
  company?: { name?: string; contact?: string; address?: string; postalCode?: string; city?: string; phone?: string; email?: string };
  date?: Date;
  vatRate?: number;
  netTotal?: number;
  sections: GaebSectionInput[];
  /** Fallback, wenn keine Sektionen vorhanden sind (eine Sammel-Pauschalposition). */
  lineItems?: string[];
  /** Optionaler proportionaler Faktor (Aufschlag/Nachlass) auf die Sektions-Nettos. */
  scaleFactor?: number;
}

const escapeXml = (s: string): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const num = (n: number, d = 2): string => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(d);
};

const pad = (n: number, w: number): string => String(n).padStart(w, "0");

const txtBlock = (text: string): string => {
  // GAEB-Textblock: <p><span>…</span></p> je Zeile
  const lines = String(text ?? "").split(/\r?\n/);
  return lines
    .map((l) => `<p><span>${escapeXml(l)}</span></p>`)
    .join("");
};

const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
const formatTime = (d: Date): string =>
  `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;

/** Liefert den GAEB-X83-XML-String. */
export function buildGaebX83Xml(input: GaebQuoteInput): string {
  const date = input.date ?? new Date();
  const factor = typeof input.scaleFactor === "number" && input.scaleFactor > 0 ? input.scaleFactor : 1;

  const sections = (input.sections && input.sections.length > 0)
    ? input.sections
    : [{
        title: input.projectName || "Leistungen",
        items: input.lineItems || [],
        net_amount: input.netTotal ?? 0,
      }];

  let lvSum = 0;
  const ctgyXml = sections.map((sec, sIdx) => {
    const title = (sec.title || `Bereich ${sIdx + 1}`).trim();
    const itemsText = (sec.items || []).filter(Boolean).join("\n");
    const ep = Math.round(((sec.net_amount ?? 0) * factor) * 100) / 100;
    lvSum += ep;
    const rno = pad(sIdx + 1, 2);
    const itemRno = `${rno}.0010`;
    return `
        <BoQCtgy ID="ctgy_${rno}" RNoPart="${rno}">
          <LblTx>${txtBlock(title)}</LblTx>
          <BoQBody>
            <Itemlist>
              <Item ID="item_${rno}_0010" RNoPart="${itemRno}">
                <Qty>${num(1, 3)}</Qty>
                <QU>psch</QU>
                <Description>
                  <CompleteText>
                    <OutlineText>
                      <OutlTxt>${txtBlock(title)}</OutlTxt>
                    </OutlineText>
                    <DetailTxt>
                      <Text>${txtBlock(itemsText || title)}</Text>
                    </DetailTxt>
                  </CompleteText>
                </Description>
                <UP>${num(ep, 2)}</UP>
                <IT>${num(ep, 2)}</IT>
              </Item>
            </Itemlist>
          </BoQBody>
        </BoQCtgy>`;
  }).join("");

  const projectName = (input.projectName || input.customer?.name || "Preisorientierung").slice(0, 60);
  const projectLabel = (input.projectLabel || projectName).slice(0, 14);
  const cust = input.customer || {};
  const comp = input.company || {};

  return `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/200407" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gaeb.de/GAEB_DA_XML/200407 GAEB_DA_XML_32.xsd">
  <GAEBInfo>
    <Version>3.2</Version>
    <VersDate>2007-12-01</VersDate>
    <Date>${formatDate(date)}</Date>
    <Time>${formatTime(date)}</Time>
    <ProgSystem>MalerZeit</ProgSystem>
  </GAEBInfo>
  <PrjInfo>
    <NamePrj>${escapeXml(projectName)}</NamePrj>
    <LblPrj>${escapeXml(projectLabel)}</LblPrj>
  </PrjInfo>
  <Award>
    <DP>83</DP>
    <OWN>
      <Name>${escapeXml(comp.name || "")}</Name>
      <Address>
        <Street>${escapeXml(comp.address || "")}</Street>
        <PostCode>${escapeXml(comp.postalCode || "")}</PostCode>
        <City>${escapeXml(comp.city || "")}</City>
      </Address>
      <Contact>
        <PersonName><FirstName></FirstName><FamName>${escapeXml(comp.contact || "")}</FamName></PersonName>
        <Phone>${escapeXml(comp.phone || "")}</Phone>
        <EMail>${escapeXml(comp.email || "")}</EMail>
      </Contact>
    </OWN>
    <CTR>
      <Name>${escapeXml(cust.name || "")}</Name>
      <Address>
        <Street>${escapeXml(cust.address || "")}</Street>
        <PostCode>${escapeXml(cust.postalCode || "")}</PostCode>
        <City>${escapeXml(cust.city || "")}</City>
      </Address>
    </CTR>
    <BoQ>
      <BoQInfo>
        <Name>${escapeXml(projectName)}</Name>
        <Cur>EUR</Cur>
      </BoQInfo>
      <BoQBody>${ctgyXml}
      </BoQBody>
    </BoQ>
    <Total>${num(lvSum, 2)}</Total>
  </Award>
</GAEB>`;
}

/** Vorschlag für einen Dateinamen (".X83"). */
export function gaebFilename(input: { customerName?: string; date?: Date }): string {
  const base = (input.customerName || "Preisorientierung")
    .replace(/[^a-zA-Z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Preisorientierung";
  const d = input.date ?? new Date();
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;
  return `${base}_${ymd}.X83`;
}

/** Triggert einen Browser-Download des XML-Strings als .X83-Datei. */
export function downloadGaebX83(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
