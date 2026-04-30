// Mini-Vorschau des PDF-Briefkopfs. Spiegelt das Layout aus src/lib/pdf.ts wider:
// farbiges Header-Band (Primärfarbe), Logo links, Firmenname + Untertitel,
// darunter zwei Spalten:
//   LINKS  → "ANSCHRIFT" = Kunden-/Empfängeradresse (klassisches Anschriftenfeld).
//   RECHTS → "ABSENDER"  = eigene Firmen-Kontaktdaten.
//
// Validierungs-Modus (Toggle "Felder anzeigen"):
//   Blendet hinter jeder Sender-Zeile einen Marker mit dem zugehörigen Profilfeld
//   ein (grün = befüllt, grau = leer). So ist sofort sichtbar, warum z. B. der
//   Ansprechpartner-Block (nicht) erscheint, ohne dass man raten muss.

import { useState } from "react";
import { ImageIcon, Check, Minus } from "lucide-react";

interface Props {
  // Sender (eigene Firma)
  companyName?: string;
  contact?: string;
  address?: string;
  addressLine2?: string;
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
  companyName, contact, address, addressLine2, postalCode, city, phone, email, website,
  logoUrl, primaryColor, secondaryColor,
  customerName, customerAddress, customerPostalCode, customerCity,
}: Props) {
  const primary = primaryColor || DEFAULT_PRIMARY;
  const secondary = secondaryColor || DEFAULT_SECONDARY;
  const today = new Date().toLocaleDateString("de-DE");
  const [showFields, setShowFields] = useState(false);

  // LEFT: customer / recipient. Use a clearly-labelled demo if none provided.
  const hasCustomer = !!(customerName || customerAddress || customerPostalCode || customerCity);
  const customerCityLine = [customerPostalCode, customerCity].filter(Boolean).join(" ");
  const leftRows: string[] = hasCustomer
    ? [customerName, customerAddress, customerCityLine].filter(Boolean) as string[]
    : ["Max Mustermann", "Musterstraße 12", "12345 Musterstadt"];
  const isDemoCustomer = !hasCustomer;

  // RIGHT: sender (own company). The company name lives in the colored header band
  // above, so we never repeat it inside the sender block. Contact person (if any)
  // becomes the first line; otherwise we start straight with the postal address —
  // the natural case for GmbHs / single-line businesses without a personal contact.
  const companyCityLine = [postalCode, city].filter(Boolean).join(" ");

  // Single source of truth for both the rendered block and the validation marker
  // overlay. `field` is the human-readable profile field name shown on the marker.
  // `present` reflects whether the field is filled — drives both the marker color
  // AND whether the row is rendered in the actual letterhead block.
  type SenderRow = {
    field: string;          // profile field label (e.g. "Ansprechpartner")
    label: string;          // inline label inside the block ("Tel.", "E-Mail", "Web", "")
    value: string;          // raw value (may be empty in validation mode)
    present: boolean;       // is this field filled?
  };

  const senderSchema: SenderRow[] = [
    { field: "Ansprechpartner", label: "",       value: contact || "",        present: !!contact },
    { field: "Straße",          label: "",       value: address || "",        present: !!address },
    { field: "Adresszusatz",    label: "",       value: addressLine2 || "",   present: !!addressLine2 },
    { field: "PLZ + Ort",       label: "",       value: companyCityLine,      present: !!companyCityLine },
    { field: "Telefon",         label: "Tel.",   value: phone || "",          present: !!phone },
    { field: "E-Mail",          label: "E-Mail", value: email || "",          present: !!email },
    { field: "Webseite",        label: "Web",    value: website || "",        present: !!website },
  ];
  const visibleRows = senderSchema.filter(r => r.present);
  const filledCount = visibleRows.length;
  const totalCount  = senderSchema.length;
  // Rows actually rendered depend on mode: validation = all, normal = only filled.
  const rowsToRender = showFields ? senderSchema : visibleRows;

  return (
    <div className="space-y-2">
      {/* Validation toggle */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-muted-foreground">
          {showFields
            ? `Validierung: ${filledCount} von ${totalCount} Absender-Feldern befüllt.`
            : "So erscheint dein Briefkopf im PDF."}
        </p>
        <button
          type="button"
          onClick={() => setShowFields(v => !v)}
          className="text-[11px] font-medium text-primary hover:underline shrink-0"
          aria-pressed={showFields}
        >
          {showFields ? "Marker ausblenden" : "Felder anzeigen"}
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-border bg-white shadow-soft">
        <div className="relative" style={{ aspectRatio: "210 / 175" }}>
          {/* Header-Band */}
          <div
            className="absolute inset-x-0 top-0 flex items-center gap-3 px-4"
            style={{ backgroundColor: primary, height: "25%" }}
          >
            <div className="h-12 w-12 flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-5 w-5 text-white/70" />
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
          <div className="absolute inset-x-0 bottom-0 px-4 pt-3" style={{ top: "25%" }}>
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
                  {rowsToRender.length === 0 && (
                    <div className="text-[8px] text-neutral-400 italic">Firmendaten ergänzen</div>
                  )}
                  {rowsToRender.map((row) => (
                    <div
                      key={row.field}
                      className="text-[9px] truncate flex items-center gap-1.5"
                    >
                      {row.label
                        ? <span className="text-neutral-400 w-8 shrink-0">{row.label}</span>
                        : <span className="w-8 shrink-0" aria-hidden />}
                      <span
                        className={`truncate flex-1 ${row.present ? "text-neutral-700" : "text-neutral-300 italic"}`}
                      >
                        {row.present ? row.value : "(leer)"}
                      </span>
                      {showFields && (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 rounded-sm px-1 py-px text-[7px] font-medium leading-none ${
                            row.present
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-neutral-50  text-neutral-400 border border-neutral-200"
                          }`}
                          title={`Profilfeld: ${row.field}`}
                        >
                          {row.present
                            ? <Check className="h-2 w-2" />
                            : <Minus className="h-2 w-2" />}
                          {row.field}
                        </span>
                      )}
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

      {showFields && (
        <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
          <span className="inline-flex items-center gap-1 align-middle mr-2">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> befüllt
          </span>
          <span className="inline-flex items-center gap-1 align-middle">
            <span className="h-2 w-2 rounded-sm bg-neutral-300" /> leer
          </span>
          {" "}— leere Felder erscheinen <strong>nicht</strong> im finalen PDF.
        </p>
      )}
    </div>
  );
}
