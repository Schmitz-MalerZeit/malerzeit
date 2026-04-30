// Mini-Vorschau des PDF-Briefkopfs. Spiegelt das Layout aus src/lib/pdf.ts wider:
// farbiges Header-Band (Primärfarbe), Logo links, Firmenname + Untertitel,
// darunter zwei Spalten:
//   LINKS  → "ANSCHRIFT" = Kunden-/Empfängeradresse (klassisches Anschriftenfeld).
//   RECHTS → "ABSENDER"  = eigene Firmen-Kontaktdaten.
// Auf der Profilseite haben wir keinen echten Kunden — dort zeigen wir links
// einen Demo-Empfänger ("Max Mustermann"), damit die Aufteilung sichtbar wird.

import { ImageIcon } from "lucide-react";

interface Props {
  // Sender (eigene Firma)
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
  // Empfänger (Kunde) — optional. Wenn nicht gesetzt, wird ein Demo-Empfänger gezeigt.
  customerName?: string;
  customerAddress?: string;
  customerPostalCode?: string;
  customerCity?: string;
}

const DEFAULT_PRIMARY = "#1a3a6c";
const DEFAULT_SECONDARY = "#4a4a4a";

export function LetterheadPreview({
  companyName, contact, address, postalCode, city, phone, email, website,
  logoUrl, primaryColor, secondaryColor,
  customerName, customerAddress, customerPostalCode, customerCity,
}: Props) {
  const primary = primaryColor || DEFAULT_PRIMARY;
  const secondary = secondaryColor || DEFAULT_SECONDARY;
  const today = new Date().toLocaleDateString("de-DE");

  // LEFT: customer / recipient. Use a clearly-labelled demo if none provided.
  const hasCustomer = !!(customerName || customerAddress || customerPostalCode || customerCity);
  const customerCityLine = [customerPostalCode, customerCity].filter(Boolean).join(" ");
  const leftRows: string[] = hasCustomer
    ? [customerName, customerAddress, customerCityLine].filter(Boolean) as string[]
    : ["Max Mustermann", "Musterstraße 12", "12345 Musterstadt"];
  const isDemoCustomer = !hasCustomer;

  // RIGHT: sender (own company)
  const companyCityLine = [postalCode, city].filter(Boolean).join(" ");
  const rightRows: { label: string; value: string }[] = [
    ...(contact         ? [{ label: "z.Hd.",  value: contact }]         : []),
    ...(address         ? [{ label: "Adr.",   value: address }]         : []),
    ...(companyCityLine ? [{ label: "Ort",    value: companyCityLine }] : []),
    ...(phone           ? [{ label: "Tel.",   value: phone }]           : []),
    ...(email           ? [{ label: "E-Mail", value: email }]           : []),
    ...(website         ? [{ label: "Web",    value: website }]         : []),
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-white shadow-soft">
      <div className="relative" style={{ aspectRatio: "210 / 170" }}>
        {/* Header-Band */}
        <div
          className="absolute inset-x-0 top-0 flex items-center gap-3 px-4"
          style={{ backgroundColor: primary, height: "26%" }}
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
        <div className="absolute inset-x-0 bottom-0 px-4 pt-3" style={{ top: "26%" }}>
          <div className="grid grid-cols-2 gap-3">
            {/* LEFT — customer */}
            <div>
              <div className="text-[7px] font-bold tracking-wider" style={{ color: primary }}>
                ANSCHRIFT
              </div>
              <div className="h-px mt-0.5 mb-1.5" style={{ backgroundColor: secondary, opacity: 0.6 }} />
              <div className="space-y-0.5">
                {leftRows.map((row, i) => (
                  <div
                    key={i}
                    className={`text-[9px] truncate ${isDemoCustomer ? "text-neutral-400 italic" : "text-neutral-700"}`}
                  >
                    {row}
                  </div>
                ))}
                {isDemoCustomer && (
                  <div className="text-[7px] text-neutral-400 mt-1">Beispiel-Empfänger</div>
                )}
              </div>
            </div>

            {/* RIGHT — sender */}
            <div>
              <div className="text-[7px] font-bold tracking-wider" style={{ color: primary }}>
                ABSENDER
              </div>
              <div className="h-px mt-0.5 mb-1.5" style={{ backgroundColor: secondary, opacity: 0.6 }} />
              <div className="space-y-0.5">
                {rightRows.length === 0 && (
                  <div className="text-[8px] text-neutral-400 italic">Firmendaten ergänzen</div>
                )}
                {rightRows.map((row, i) => (
                  <div key={i} className="text-[9px] text-neutral-700 truncate flex gap-1.5">
                    <span className="text-neutral-400 w-8 shrink-0">{row.label}</span>
                    <span className="truncate">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
