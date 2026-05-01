const CUSTOMER_NOTICE =
  "Hinweis: Diese unverbindliche Preisorientierung ist eine Schätzung auf Grundlage der vorliegenden Angaben. Wenn sie für Sie passt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.";

const WHATSAPP_NOTICE =
  "Hinweis: Das ist eine unverbindliche Preisorientierung/Schätzung auf Grundlage der vorliegenden Angaben. Wenn das für dich passt, erstellen wir dir gerne ein verbindliches schriftliches Angebot.";

const hasOrientationLanguage = (text: string) =>
  /(unverbindlich|preisorientierung|preisschätzung|preisschaetzung|schätzung|schaetzung)/i.test(text);

const hasBindingOfferLanguage = (text: string) =>
  /verbindlich\w*\s+(schriftlich\w*\s+)?angebot/i.test(text);

const ensureNotice = (text: string, notice: string) => {
  const trimmed = (text || "").trim();
  if (hasOrientationLanguage(trimmed) && hasBindingOfferLanguage(trimmed)) return trimmed;
  return [trimmed, notice].filter(Boolean).join("\n\n");
};

export const ensureCustomerPriceOrientationText = (text: string) => ensureNotice(text, CUSTOMER_NOTICE);

export const ensureWhatsappPriceOrientationText = (text: string) => ensureNotice(text, WHATSAPP_NOTICE);