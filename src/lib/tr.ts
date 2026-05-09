// Lightweight inline bilingual helper.
// Usage in non-React code:
//   import { tr } from "@/lib/tr";
//   tr("Speichern", "Save")
//
// Usage in React (re-renders on language change):
//   const tr = useTr();
//   <span>{tr("Speichern", "Save")}</span>

import i18n from "@/i18n";
import { useTranslation } from "react-i18next";

export type TrFn = (de: string, en: string) => string;

const isEn = (lang?: string | null) => !!lang && lang.toLowerCase().startsWith("en");

export const tr: TrFn = (de, en) => (isEn(i18n.language) ? en : de);

export function useTr(): TrFn {
  const { i18n: i } = useTranslation();
  return (de, en) => (isEn(i.language) ? en : de);
}

/** Locale string used for Intl.NumberFormat / toLocaleDateString. */
export const currentLocale = (): string => (isEn(i18n.language) ? "en-US" : "de-DE");
