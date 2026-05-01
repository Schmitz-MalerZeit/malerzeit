/**
 * Helpers für E-Mail-/WhatsApp-Nachrichten zur Preisorientierung.
 *
 * Ziele:
 *  - Keine doppelten Grußformeln: Mail-/Messenger-Apps haben i. d. R. eine
 *    eigene Signatur. Daher werden „Mit freundlichen Grüßen / Viele Grüße"
 *    inkl. Unterschriftszeile am Ende des Textes entfernt.
 *  - Preis fett darstellen: Da `mailto:` und `wa.me` nur Plain-Text
 *    transportieren, nutzen wir Unicode-Mathematical-Bold-Zeichen, damit der
 *    Betrag in WhatsApp/Mail visuell hervorgehoben ist (in WhatsApp wird er
 *    zusätzlich mit `*…*` umschlossen).
 */

const BOLD_OFFSETS = {
  upper: 0x1d400 - 0x41,   // A-Z
  lower: 0x1d41a - 0x61,   // a-z
  digit: 0x1d7ce - 0x30,   // 0-9
};

const toUnicodeBold = (input: string): string =>
  input.replace(/[A-Za-z0-9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(code + BOLD_OFFSETS.upper);
    if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(code + BOLD_OFFSETS.lower);
    if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(code + BOLD_OFFSETS.digit);
    return ch;
  });

/**
 * Entfernt typische Schluss-Grußformeln samt der darauffolgenden
 * Unterschriftszeile(n) am Ende eines Textes.
 */
const stripClosingSignature = (text: string): string => {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  // Vom Ende her: leere Zeilen + Signaturblock entfernen
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === "") { lines.pop(); continue; }
    break;
  }
  // Suche letzte Grußformel-Zeile
  const greetingRe = /^(mit\s+freundlichen\s+gr[üu](ß|ss)en|viele\s+gr[üu](ß|ss)e|liebe\s+gr[üu](ß|ss)e|freundliche\s+gr[üu](ß|ss)e|beste\s+gr[üu](ß|ss)e|herzliche\s+gr[üu](ß|ss)e)\b.*$/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (greetingRe.test(lines[i].trim())) {
      // Alles ab dieser Zeile abschneiden
      lines.splice(i);
      break;
    }
  }
  // Wieder am Ende leere Zeilen entfernen
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n");
};

/**
 * Hebt die Zeile mit dem Brutto-Gesamtpreis hervor.
 * - Plain (E-Mail): per Unicode-Bold
 * - WhatsApp: per `*…*` (WhatsApp-eigene Bold-Syntax) + Unicode-Bold-Betrag
 */
const emphasizePriceLine = (text: string, channel: "mail" | "whatsapp"): string => {
  if (!text) return "";
  // Findet z. B. „Gesamtpreis (brutto): 1.234,56 €"
  const re = /^(.*?(?:gesamtpreis|preis|betrag)[^\n:]*:\s*)([^\n]+)$/im;
  return text.replace(re, (_m, label: string, value: string) => {
    const boldValue = toUnicodeBold(value.trim());
    if (channel === "whatsapp") {
      return `*${label.trim()} ${boldValue}*`;
    }
    return `${label}${boldValue}`;
  });
};

export interface BuildMessageOptions {
  /** Brutto-Gesamtpreis als bereits formatierter String, z. B. „1.234,56 €". */
  grossFormatted?: string;
}

/**
 * Bereitet einen Kunden-Text für die E-Mail vor:
 *  - Schluss-Grußformel + Signatur weg
 *  - Preis fett (Unicode)
 *  - Falls keine Preiszeile vorhanden, wird der Brutto-Preis ergänzt.
 */
export const buildEmailMessageBody = (
  customerText: string,
  opts: BuildMessageOptions = {},
): string => {
  let body = stripClosingSignature(customerText || "").trim();
  if (opts.grossFormatted && !/gesamtpreis|brutto|preis|betrag/i.test(body)) {
    body += `\n\nGesamtpreis (brutto): ${opts.grossFormatted}`;
  }
  return emphasizePriceLine(body, "mail");
};

/**
 * Bereitet einen WhatsApp-Text vor:
 *  - Schluss-Grußformel + Signatur weg
 *  - Preis fett über `*…*` (WhatsApp-Markdown) + Unicode-Bold-Betrag
 */
export const buildWhatsappMessageBody = (
  whatsappText: string,
  opts: BuildMessageOptions = {},
): string => {
  let body = stripClosingSignature(whatsappText || "").trim();
  if (opts.grossFormatted && !/gesamtpreis|brutto|preis|betrag/i.test(body)) {
    body += `\n\nGesamtpreis (brutto): ${opts.grossFormatted}`;
  }
  return emphasizePriceLine(body, "whatsapp");
};
