// Mini-Vorschau des PDF-Briefkopfs. Spiegelt das Layout aus src/lib/pdf.ts wider:
// farbiges Header-Band (Primärfarbe), Logo links, Firmenname + Untertitel, darunter
// Kontaktzeile und ein Akzent-Strich in der Primärfarbe.
//
// Bewusst rein visuell (HTML/CSS) – kein jsPDF-Render, damit es live & ohne Kosten
// reagiert, sobald sich Logo, Farben oder Firmendaten ändern.

import { ImageIcon } from "lucide-react";

interface Props {
  companyName?: string;
  contact?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const DEFAULT_PRIMARY = "#1a3a6c";

export function LetterheadPreview({
  companyName, contact, address, phone, email,
  logoUrl, primaryColor, secondaryColor,
}: Props) {
  const primary = primaryColor || DEFAULT_PRIMARY;
  const contactLine = [contact, address, phone, email].filter(Boolean).join(" · ");
  const today = new Date().toLocaleDateString("de-DE");

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-white shadow-soft">
      {/* DIN-A4-Proportion (210x297) auf Mini-Maß */}
      <div className="relative" style={{ aspectRatio: "210 / 148" }}>
        {/* Header-Band */}
        <div
          className="absolute inset-x-0 top-0 flex items-center gap-3 px-4"
          style={{ backgroundColor: primary, height: "32%" }}
        >
          <div className="h-12 w-12 rounded-md bg-white/95 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-white">
            <div className="font-bold text-sm truncate leading-tight">
              {companyName || "Ihr Malerbetrieb"}
            </div>
            <div className="text-[10px] opacity-90 leading-tight mt-0.5">
              Unverbindlicher Preisvorschlag
            </div>
          </div>
          <div className="text-[9px] text-white/90 shrink-0">
            Datum: {today}
          </div>
        </div>

        {/* Body */}
        <div className="absolute inset-x-0 bottom-0 px-4 pt-3" style={{ top: "32%" }}>
          <p className="text-[9px] text-neutral-600 truncate">
            {contactLine || "Hier erscheinen deine Kontaktdaten"}
          </p>

          <div className="mt-3">
            <div className="text-[10px] font-bold" style={{ color: primary }}>
              Leistungsbeschreibung
            </div>
            <div className="h-[2px] mt-1 rounded" style={{ backgroundColor: primary }} />
          </div>

          {/* Platzhalter-Zeilen */}
          <div className="mt-2 space-y-1">
            <div className="h-1.5 rounded bg-neutral-200 w-11/12" />
            <div className="h-1.5 rounded bg-neutral-200 w-10/12" />
            <div className="h-1.5 rounded bg-neutral-200 w-9/12" />
          </div>

          {/* Summenblock-Andeutung in Sekundärfarbe */}
          <div
            className="mt-3 ml-auto h-4 w-1/3 rounded"
            style={{ backgroundColor: secondaryColor || "#4a4a4a", opacity: 0.85 }}
          />
        </div>
      </div>
    </div>
  );
}
