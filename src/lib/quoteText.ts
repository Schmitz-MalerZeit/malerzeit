import { tr } from "@/lib/tr";

const customerNotice = () =>
  tr(
    "Hinweis: Diese unverbindliche Preisorientierung ist eine Schätzung auf Grundlage der vorliegenden Angaben. Wenn sie für Sie passt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.",
    "Note: This non-binding price estimate is based on the information provided. If it works for you, we'd be happy to prepare a binding written quote.",
  );

const whatsappNotice = () =>
  tr(
    "Hinweis: Das ist eine unverbindliche Preisorientierung/Schätzung auf Grundlage der vorliegenden Angaben. Wenn das für Sie passt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.",
    "Note: This is a non-binding price estimate based on the information provided. If it works for you, we'd be happy to prepare a binding written quote.",
  );

const hasOrientationLanguage = (text: string) =>
  /(unverbindlich|preisorientierung|preisschätzung|preisschaetzung|schätzung|schaetzung|non-binding|price estimate)/i.test(text);

const hasBindingOfferLanguage = (text: string) =>
  /(verbindlich\w*\s+(schriftlich\w*\s+)?angebot|binding\s+(written\s+)?quote)/i.test(text);

const ensureNotice = (text: string, notice: string) => {
  const trimmed = (text || "").trim();
  if (hasOrientationLanguage(trimmed) && hasBindingOfferLanguage(trimmed)) return trimmed;
  return [trimmed, notice].filter(Boolean).join("\n\n");
};

export const ensureCustomerPriceOrientationText = (text: string) => ensureNotice(text, customerNotice());

export const ensureWhatsappPriceOrientationText = (text: string) => ensureNotice(text, whatsappNotice());

/**
 * Normalize a German phone number for use with the wa.me deep link.
 * Returns digits only (no '+'), or null if the result is not 8–15 digits long.
 */
export const normalizePhoneForWa = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "49" + digits.slice(1);
  return /^\d{8,15}$/.test(digits) ? digits : null;
};
