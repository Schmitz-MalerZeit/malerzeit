/**
 * Helpers für E-Mail-/WhatsApp-Nachrichten zur Preisorientierung.
 *
 * Designentscheidungen (nach Nutzer-Feedback):
 *  - **Keine Unicode-„Mathematical Bold"-Tricks mehr.** Die sahen in WhatsApp
 *    und in vielen Mail-Clients hässlich aus (Boxen, falsche Glyphen, alles
 *    fast komplett fett). Wir liefern jetzt schlichten, sauberen Klartext.
 *  - **Schluss-Grußformel entfernen**, weil Mail-/Messenger-Apps i. d. R. eine
 *    eigene Signatur haben.
 *  - WhatsApp-Bold (*…*) verwenden wir bewusst NICHT mehr automatisch – die
 *    Vorlage selbst kann es bei Bedarf enthalten.
 */

/**
 * Entfernt typische Schluss-Grußformeln samt der darauffolgenden
 * Unterschriftszeile(n) am Ende eines Textes.
 */
const stripClosingSignature = (text: string): string => {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === "") { lines.pop(); continue; }
    break;
  }
  const greetingRe = /^(mit\s+freundlichen\s+gr[üu](ß|ss)en|viele\s+gr[üu](ß|ss)e|liebe\s+gr[üu](ß|ss)e|freundliche\s+gr[üu](ß|ss)e|beste\s+gr[üu](ß|ss)e|herzliche\s+gr[üu](ß|ss)e)\b.*$/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (greetingRe.test(lines[i].trim())) {
      lines.splice(i);
      break;
    }
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n");
};

export interface BuildMessageOptions {
  /** Brutto-Gesamtpreis als bereits formatierter String, z. B. „1.234,56 €". */
  grossFormatted?: string;
}

/**
 * Bereitet einen Kunden-Text für die E-Mail vor:
 *  - Schluss-Grußformel + Signatur weg
 *  - Falls keine Preiszeile vorhanden, wird der Brutto-Preis ergänzt.
 *  - Sonst: kein Eingriff in die Formatierung.
 */
export const buildEmailMessageBody = (
  customerText: string,
  opts: BuildMessageOptions = {},
): string => {
  let body = stripClosingSignature(customerText || "").trim();
  if (opts.grossFormatted && !/gesamtpreis|brutto|preis|betrag/i.test(body)) {
    body += `\n\nGesamtpreis (brutto): ${opts.grossFormatted}`;
  }
  return body;
};

/**
 * Bereitet einen WhatsApp-Text vor:
 *  - Schluss-Grußformel + Signatur weg
 *  - Falls keine Preiszeile vorhanden, wird der Brutto-Preis ergänzt.
 *  - **Kein** automatischer Fettdruck – Vorlage entscheidet.
 */
export const buildWhatsappMessageBody = (
  whatsappText: string,
  opts: BuildMessageOptions = {},
): string => {
  let body = stripClosingSignature(whatsappText || "").trim();
  if (opts.grossFormatted && !/gesamtpreis|brutto|preis|betrag/i.test(body)) {
    body += `\n\nGesamtpreis (brutto): ${opts.grossFormatted}`;
  }
  return body;
};
