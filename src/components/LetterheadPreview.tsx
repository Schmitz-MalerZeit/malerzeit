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

import { useEffect, useState } from "react";
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
  // Wenn das Logo nicht ladbar ist (defektes SVG, 404, CORS-Block), fallen wir
  // visuell auf den Initial-Fallback zurück – analog zum PDF-Renderer.
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => { setLogoBroken(false); }, [logoUrl]);
  const showLogo = !!logoUrl && !logoBroken;
  const initial = (companyName || "?").trim().charAt(0).toUpperCase() || "?";

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
        <div className="relative px-4 pt-4 pb-3" style={{ aspectRatio: "210 / 175" }}>
          {/* Logo oben rechts */}
          <div className="absolute top-3 right-4 h-10 w-24 flex items-center justify-end">
            {showLogo ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="max-h-full max-w-full object-contain object-right"
                onError={() => setLogoBroken(true)}
              />
            ) : logoUrl ? (
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: primary }}
                title="Logo konnte nicht geladen werden – Initial-Fallback wird gezeigt"
              >
                {initial}
              </div>
            ) : (
              <ImageIcon className="h-5 w-5 text-neutral-300" />
            )}
          </div>

          {/* Sender-Mini-Zeile + Trenner */}
          <div className="mt-12">
            <div className="text-[7px] text-neutral-400 truncate">
              {[companyName, address, [postalCode, city].filter(Boolean).join(" ")]
                .filter(Boolean).join(" · ") || "Firmenname · Straße · PLZ Ort"}
            </div>
            <div className="h-px w-1/2 mt-0.5" style={{ backgroundColor: secondary, opacity: 0.3 }} />
          </div>

          {/* Empfänger + Datum */}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
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
            <div className="text-right">
              <div className="text-[8px] text-neutral-500">
                Angebotsdatum: <span className="text-neutral-700">{today}</span>
              </div>
            </div>
          </div>

          {/* Titel */}
          <div className="mt-4 text-base font-bold leading-tight" style={{ color: primary }}>
            Unverbindliche Preisorientierung
          </div>

          {/* Leistungs-Skelett */}
          <div className="mt-2">
            <div className="h-px" style={{ backgroundColor: "#e5e5e5" }} />
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 rounded bg-neutral-200 w-11/12" />
              <div className="h-1.5 rounded bg-neutral-200 w-9/12" />
              <div className="h-1.5 rounded bg-neutral-200 w-10/12" />
            </div>
          </div>

          {/* Sender-Validierung kompakt unten (nur sichtbar in Validierungs-Modus) */}
          {showFields && (
            <div className="absolute bottom-2 left-4 right-4">
              <div className="text-[7px] font-bold tracking-wider" style={{ color: primary }}>
                ABSENDER (Validierung)
              </div>
              <div className="space-y-0.5 mt-1">
                {senderSchema.map((row) => (
                  <div key={row.field} className="text-[8px] flex items-center gap-1.5">
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-sm px-1 py-px text-[7px] font-medium leading-none ${
                        row.present
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-neutral-50  text-neutral-400 border border-neutral-200"
                      }`}
                    >
                      {row.present ? <Check className="h-2 w-2" /> : <Minus className="h-2 w-2" />}
                      {row.field}
                    </span>
                    <span className={`truncate ${row.present ? "text-neutral-700" : "text-neutral-300 italic"}`}>
                      {row.present ? row.value : "(leer)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
