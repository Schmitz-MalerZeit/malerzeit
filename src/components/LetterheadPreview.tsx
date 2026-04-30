// Mini-Vorschau des PDF-Briefkopfs. Spiegelt das Layout aus src/lib/pdf.ts wider:
// farbiges Header-Band (Primärfarbe), Logo links, Firmenname + Untertitel,
// darunter zwei Spalten "ANSCHRIFT" / "KONTAKT" mit Trennlinie in Sekundärfarbe.

import { ImageIcon } from "lucide-react";

interface Props {
  companyName?: string;
  contact?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const DEFAULT_PRIMARY = "#1a3a6c";
const DEFAULT_SECONDARY = "#4a4a4a";

export function LetterheadPreview({
  companyName, contact, address, postalCode, city, phone, email, website,
  logoUrl, primaryColor, secondaryColor,
}: Props) {
  const primary = primaryColor || DEFAULT_PRIMARY;
  const secondary = secondaryColor || DEFAULT_SECONDARY;
  const today = new Date().toLocaleDateString("de-DE");

  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  const leftRows = [contact, address, cityLine].filter(Boolean) as string[];
  const rightRows: { label: string; value: string }[] = [
    ...(phone   ? [{ label: "Tel.",   value: phone }]   : []),
    ...(email   ? [{ label: "E-Mail", value: email }]   : []),
    ...(website ? [{ label: "Web",    value: website }] : []),
  ];
  const hasContact = leftRows.length > 0 || rightRows.length > 0;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-white shadow-soft">
      <div className="relative" style={{ aspectRatio: "210 / 160" }}>
        {/* Header-Band */}
        <div
          className="absolute inset-x-0 top-0 flex items-center gap-3 px-4"
          style={{ backgroundColor: primary, height: "28%" }}
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
          <div className="text-[9px] text-white/90 shrink-0">Datum: {today}</div>
        </div>

        {/* Body */}
        <div className="absolute inset-x-0 bottom-0 px-4 pt-3" style={{ top: "28%" }}>
          {hasContact ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[7px] font-bold tracking-wider" style={{ color: primary }}>
                  ANSCHRIFT
                </div>
                <div className="h-px mt-0.5 mb-1.5" style={{ backgroundColor: secondary, opacity: 0.6 }} />
                <div className="space-y-0.5">
                  {leftRows.length === 0 && (
                    <div className="text-[8px] text-neutral-400 italic">Adresse hinzufügen</div>
                  )}
                  {leftRows.map((row, i) => (
                    <div key={i} className="text-[9px] text-neutral-700 truncate">{row}</div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[7px] font-bold tracking-wider" style={{ color: primary }}>
                  KONTAKT
                </div>
                <div className="h-px mt-0.5 mb-1.5" style={{ backgroundColor: secondary, opacity: 0.6 }} />
                <div className="space-y-0.5">
                  {rightRows.length === 0 && (
                    <div className="text-[8px] text-neutral-400 italic">Tel/E-Mail hinzufügen</div>
                  )}
                  {rightRows.map((row, i) => (
                    <div key={i} className="text-[9px] text-neutral-700 truncate flex gap-1.5">
                      <span className="text-neutral-400 w-7 shrink-0">{row.label}</span>
                      <span className="truncate">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[9px] text-neutral-400 italic">Hier erscheinen deine Kontaktdaten</p>
          )}

          <div className="mt-3">
            <div className="text-[10px] font-bold" style={{ color: primary }}>
              Leistungsbeschreibung
            </div>
            <div className="h-[2px] mt-1 rounded" style={{ backgroundColor: primary }} />
          </div>

          <div className="mt-2 space-y-1">
            <div className="h-1.5 rounded bg-neutral-200 w-11/12" />
            <div className="h-1.5 rounded bg-neutral-200 w-9/12" />
          </div>
        </div>
      </div>
    </div>
  );
}
