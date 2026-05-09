/**
 * Rendert Nachrichten-Vorlagen für E-Mail / WhatsApp.
 *
 * Unterstützte Platzhalter (case-insensitive, in geschweiften Klammern):
 *   {kunde}        – Kundenname (oder leer)
 *   {anrede}       – „Hallo {kunde}," (Sie-Form, mit Komma) bzw. „Hallo,"
 *   {leistungen}   – Bullet-Liste der Leistungen
 *   {preis}        – Brutto-Gesamtpreis, formatiert (z. B. „2.243,15 €")
 *   {netto}        – Netto-Gesamtpreis, formatiert
 *   {mwst}         – MwSt-Betrag, formatiert
 *   {firma}        – Firmenname
 *   {unterschrift} – Name der zeichnungsberechtigten Person (Fallback: Firma)
 *   {gueltigkeit}  – Anzahl Tage Gültigkeit
 */

import { tr } from "@/lib/tr";

export interface MessageTemplateVars {
  customerName?: string | null;
  lineItems?: string[];
  /** Optional: Gliederung in Räume/Bereiche. Wenn vorhanden, wird der
   *  Platzhalter {leistungen} mit Raum-Überschriften gerendert,
   *  damit der Arbeitsort (Wohnzimmer, Flur, …) sichtbar ist. */
  sections?: Array<{ title?: string; items?: string[] }> | null;
  grossFormatted?: string;
  netFormatted?: string;
  vatFormatted?: string;
  companyName?: string | null;
  signatureName?: string | null;
  validityDays?: number | null;
}

const formatItems = (items: string[] | undefined): string =>
  (items || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .map((s) => `• ${s}`)
    .join("\n");

const formatSections = (
  sections: Array<{ title?: string; items?: string[] }> | null | undefined,
): string => {
  if (!Array.isArray(sections) || sections.length === 0) return "";
  const blocks = sections
    .map((sec) => {
      const title = (sec?.title || "").trim();
      const items = (sec?.items || [])
        .map((s) => (s || "").trim())
        .filter(Boolean);
      if (!items.length) return "";
      const head = title ? `*${title}*` : "";
      const body = items.map((s) => `• ${s}`).join("\n");
      return head ? `${head}\n${body}` : body;
    })
    .filter(Boolean);
  return blocks.join("\n\n");
};

export const renderMessageTemplate = (
  template: string,
  vars: MessageTemplateVars,
): string => {
  if (!template) return "";
  const customer = (vars.customerName || "").trim();
  const signature =
    (vars.signatureName || "").trim() || (vars.companyName || "").trim();
  const sectioned = formatSections(vars.sections);
  const replacements: Record<string, string> = {
    kunde: customer,
    anrede: customer ? tr(`Hallo ${customer},`, `Hello ${customer},`) : tr("Hallo,", "Hello,"),
    leistungen: sectioned || formatItems(vars.lineItems),
    preis: vars.grossFormatted || "",
    netto: vars.netFormatted || "",
    mwst: vars.vatFormatted || "",
    firma: (vars.companyName || "").trim(),
    unterschrift: signature,
    gueltigkeit: vars.validityDays != null ? String(vars.validityDays) : "",
  };

  // Ersetzt {key} (auch mit umliegenden Leerzeichen) – case-insensitive.
  let out = template.replace(/\{\s*([a-zA-ZäöüÄÖÜß_]+)\s*\}/g, (m, key: string) => {
    const v = replacements[key.toLowerCase()];
    return v != null ? v : m;
  });

  // Mehrfach-Leerzeilen einsammeln (entstehen, wenn ein Platzhalter leer ist).
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
};

const closingGreetingRe = /(mit\s+freundlichen\s+gr[üu](ß|ss)en|kind\s+regards|best\s+regards)/i;

export const ensureWhatsappTemplateSignature = (template: string): string => {
  const trimmed = (template || "").trim();
  if (!trimmed) return DEFAULT_WHATSAPP_TEMPLATE;
  if (closingGreetingRe.test(trimmed)) return trimmed;
  return `${trimmed}\n\n${tr("Mit freundlichen Grüßen", "Kind regards")}\n{unterschrift}\n{firma}`;
};

export const ensureWhatsappSignature = (
  text: string,
  vars: Pick<MessageTemplateVars, "companyName" | "signatureName">,
): string => {
  const trimmed = (text || "").trim();
  const company = (vars.companyName || "").trim();
  const signature = (vars.signatureName || "").trim() || company;
  const signatureBlock = [tr("Mit freundlichen Grüßen", "Kind regards"), signature, company]
    .filter(Boolean)
    .join("\n");
  if (!trimmed) return signatureBlock;
  if (closingGreetingRe.test(trimmed)) return trimmed;
  return [trimmed, signatureBlock].filter(Boolean).join("\n\n");
};

export const DEFAULT_EMAIL_TEMPLATE =
`Hallo {kunde},

vielen Dank für Ihre Anfrage. Anbei erhalten Sie unsere unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.`;

export const DEFAULT_WHATSAPP_TEMPLATE =
`Hallo {kunde},

vielen Dank für Ihre Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.

Mit freundlichen Grüßen
{unterschrift}
{firma}`;
