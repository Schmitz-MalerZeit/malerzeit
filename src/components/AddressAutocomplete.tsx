import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

export interface AddressSuggestion {
  /** Just the street (no house number) */
  street: string;
  /** House number (may be empty when none was found / typed) */
  houseNumber: string;
  postalCode: string;
  city: string;
  /** Full label for display */
  label: string;
  /** True wenn die Hausnummer real bestätigt wurde (sonst nur Straßen-Treffer) */
  houseNumberVerified?: boolean;
}

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (s: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}

/** Splits "Musterstraße 12a" into ["Musterstraße", "12a"]. */
const splitStreetAndNumber = (input: string): { street: string; houseNumber: string } => {
  const m = (input || "").trim().match(/^(.*?)(?:\s+(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?))?$/);
  if (!m) return { street: input.trim(), houseNumber: "" };
  return { street: (m[1] || "").trim(), houseNumber: (m[2] || "").trim() };
};

const normHouseNumber = (n: string) =>
  (n || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9\-/]/g, "");

const normStreet = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/str\.?\b/g, "strasse")
    .replace(/[^a-z0-9]/g, "");

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    cycleway?: string;
    path?: string;
    residential?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    suburb?: string;
    country_code?: string;
  };
}

interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    countrycode?: string;
    osm_key?: string;
  };
}

async function searchNominatim(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=15` +
    `&countrycodes=de&accept-language=de&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data: NominatimResult[] = await res.json();
  const out: AddressSuggestion[] = [];
  for (const r of data) {
    const a = r.address || {};
    if (a.country_code && a.country_code !== "de") continue;
    const street =
      (a.road || a.pedestrian || a.footway || a.cycleway || a.path || a.residential || "").trim();
    const postcode = (a.postcode || "").trim();
    const city = (a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || "").trim();
    const housenumber = (a.house_number || "").trim();
    if (!street || !postcode || !city) continue;
    if (!/^\d{5}$/.test(postcode)) continue;
    out.push({
      street,
      houseNumber: housenumber,
      postalCode: postcode,
      city,
      label: housenumber
        ? `${street} ${housenumber}, ${postcode} ${city}`
        : `${street}, ${postcode} ${city}`,
      houseNumberVerified: !!housenumber,
    });
  }
  return out;
}

async function searchPhoton(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&lang=de&limit=15&bbox=5.5,47.2,15.1,55.1`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const p = f.properties || {};
    if (p.countrycode && p.countrycode !== "DE") continue;
    const street = (p.street || (p.osm_key === "highway" ? p.name : "") || "").trim();
    const housenumber = (p.housenumber || "").trim();
    const postcode = (p.postcode || "").trim();
    const city = (p.city || p.town || p.village || p.municipality || "").trim();
    if (!street || !postcode || !city) continue;
    if (!/^\d{5}$/.test(postcode)) continue;
    out.push({
      street,
      houseNumber: housenumber,
      postalCode: postcode,
      city,
      label: housenumber
        ? `${street} ${housenumber}, ${postcode} ${city}`
        : `${street}, ${postcode} ${city}`,
      houseNumberVerified: !!housenumber,
    });
  }
  return out;
}

/**
 * Address auto-complete (DE).
 * Strategy: Nominatim first (real Hausnummern), Photon as fallback.
 * Wenn der Nutzer eine Hausnummer getippt hat und es exakte Treffer gibt,
 * werden NUR diese gezeigt – sonst (graceful) die Straßen-Treffer.
 */
export function AddressAutocomplete({
  id, value, onChange, onSelectSuggestion, placeholder, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const justPickedFor = useRef<string | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const trimmed = value.trim();
  const parsed = useMemo(() => splitStreetAndNumber(trimmed), [trimmed]);

  useEffect(() => {
    if (justPickedFor.current === trimmed) return;
    if (parsed.street.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const query = parsed.houseNumber
          ? `${parsed.street} ${parsed.houseNumber}`
          : parsed.street;

        // 1. Nominatim
        let raw: AddressSuggestion[] = [];
        try {
          raw = await searchNominatim(query, ctrl.signal);
        } catch (e) {
          if ((e as any)?.name === "AbortError") return;
          console.warn("Nominatim fehlgeschlagen, versuche Photon:", e);
        }

        // 2. Photon-Fallback wenn Nominatim leer
        if (raw.length === 0) {
          try {
            raw = await searchPhoton(query, ctrl.signal);
          } catch (e) {
            if ((e as any)?.name === "AbortError") return;
            console.warn("Photon fehlgeschlagen:", e);
          }
        }

        // Nur Straßen behalten, deren Name halbwegs zur Eingabe passt
        const wantedStreet = normStreet(parsed.street);
        const filteredByStreet = raw.filter((s) => {
          const ns = normStreet(s.street);
          return ns.includes(wantedStreet) || wantedStreet.includes(ns);
        });
        const baseList = filteredByStreet.length > 0 ? filteredByStreet : raw;

        const wantedNumber = normHouseNumber(parsed.houseNumber);
        let result: AddressSuggestion[];

        if (wantedNumber) {
          // Exakte Hausnummer-Treffer bevorzugen
          const exact = baseList.filter(
            (s) => s.houseNumber && normHouseNumber(s.houseNumber) === wantedNumber,
          );
          if (exact.length > 0) {
            result = exact;
          } else {
            // Keine echten Hausnummer-Treffer → wenigstens die Straßen-Treffer
            // anzeigen (deduped per Straße+PLZ+Ort), Hausnummer ist dann
            // "nicht verifiziert" – Nutzer kann aber trotzdem auswählen.
            const seen = new Set<string>();
            result = [];
            for (const s of baseList) {
              const key = `${normStreet(s.street)}|${s.postalCode}|${s.city.toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              result.push({
                ...s,
                houseNumber: "",
                houseNumberVerified: false,
                label: `${s.street}, ${s.postalCode} ${s.city}`,
              });
            }
          }
        } else {
          // Keine Hausnummer eingetippt → Straßen-Übersicht (dedupe)
          const seen = new Set<string>();
          result = [];
          for (const s of baseList) {
            const key = `${normStreet(s.street)}|${s.postalCode}|${s.city.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({
              ...s,
              houseNumber: "",
              houseNumberVerified: false,
              label: `${s.street}, ${s.postalCode} ${s.city}`,
            });
          }
        }

        setSuggestions(result.slice(0, 8));
        setHighlight(0);
        setOpen(true);
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.warn("Adress-Suche fehlgeschlagen:", e);
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [parsed.street, parsed.houseNumber, trimmed]);

  const select = (s: AddressSuggestion) => {
    const finalNumber = s.houseNumber || splitStreetAndNumber(value).houseNumber;
    const newAddress = finalNumber ? `${s.street} ${finalNumber}` : s.street;
    justPickedFor.current = newAddress;
    onChange(newAddress);
    onSelectSuggestion({ ...s, houseNumber: finalNumber });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapRef} className="relative flex-1">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn("h-11", className)}
        onChange={(e) => {
          justPickedFor.current = null;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); select(suggestions[highlight]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={`${s.street}-${s.houseNumber}-${s.postalCode}-${s.city}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors flex items-start gap-2",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {s.street}{s.houseNumber ? ` ${s.houseNumber}` : ""}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.postalCode} {s.city}
                  {parsed.houseNumber && !s.houseNumberVerified && (
                    <span className="ml-1 italic">· Hausnummer bitte prüfen</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && suggestions.length === 0 && parsed.street.length >= 3 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg p-3 text-xs text-muted-foreground">
          Keine Adresse gefunden. Bitte Schreibweise prüfen.
        </div>
      )}
    </div>
  );
}
