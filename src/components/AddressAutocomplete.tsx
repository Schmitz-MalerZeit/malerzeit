import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

export interface AddressSuggestion {
  /** Just the street (no house number) */
  street: string;
  /** House number (may be empty when the user hasn't typed one yet) */
  houseNumber: string;
  postalCode: string;
  city: string;
  /** Full label for display */
  label: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  /** Called when the user picks a suggestion. The host should fill PLZ + Ort
   *  and may use the returned street/houseNumber to normalize the address. */
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

/** Normalise house numbers for comparison: "12 A" → "12a", "12-14" → "12-14". */
const normHouseNumber = (n: string) =>
  (n || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9\-/]/g, "");

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
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
}

/**
 * Address auto-complete using the Photon (Komoot/OpenStreetMap) API.
 *
 *  - Free, no API key, full German coverage including house numbers.
 *  - When the user types a house number, only addresses where that number
 *    actually exists are shown – matches normal mobile-app behaviour.
 *  - When no house number is entered yet, street-level suggestions are
 *    shown, sorted by relevance (Photon's importance ranking).
 *  - 250 ms debounce, request cancellation on each keystroke.
 *
 * Docs: https://photon.komoot.io/
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

  // Close on outside click
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
        // Photon: lang=de, restrict to Germany, typeahead-style search.
        const url =
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
          `&lang=de&limit=15&osm_tag=place&osm_tag=highway&osm_tag=building` +
          // The osm_tag filter is loose (OR semantics) – we filter results
          // on the client to keep only address-shaped hits below.
          `&bbox=5.5,47.2,15.1,55.1`; // approx Germany bounding box
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) { setSuggestions([]); return; }
        const data = await res.json();
        const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];

        const wantedNumber = normHouseNumber(parsed.houseNumber);
        const seen = new Set<string>();
        const out: AddressSuggestion[] = [];

        for (const f of features) {
          const p = f?.properties || {};
          if (p.countrycode && p.countrycode !== "DE") continue;

          // We need at minimum: street name + city + postcode.
          const street = (p.street || (p.osm_key === "highway" ? p.name : "") || "").trim();
          const housenumber = (p.housenumber || "").trim();
          const postcode = (p.postcode || "").trim();
          const city = (p.city || p.town || p.village || p.municipality || "").trim();
          if (!street || !postcode || !city) continue;
          if (!/^\d{5}$/.test(postcode)) continue;

          // If the user typed a house number, only keep results that have
          // exactly that house number – this is the "vor-Auswahl" behaviour
          // the user asked for: suppress places where the number doesn't exist.
          if (wantedNumber) {
            if (!housenumber) continue;
            if (normHouseNumber(housenumber) !== wantedNumber) continue;
          }

          const key = `${street}|${housenumber}|${postcode}|${city}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const label = housenumber
            ? `${street} ${housenumber}, ${postcode} ${city}`
            : `${street}, ${postcode} ${city}`;
          out.push({ street, houseNumber: housenumber, postalCode: postcode, city, label });
          if (out.length >= 8) break;
        }

        setSuggestions(out);
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
    }, 250);
    return () => clearTimeout(handle);
  }, [parsed.street, parsed.houseNumber, trimmed]);

  const select = (s: AddressSuggestion) => {
    // Prefer the house number from the suggestion; fall back to whatever the
    // user typed so we never silently drop their input.
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
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && suggestions.length === 0 && parsed.street.length >= 3 && parsed.houseNumber && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg p-3 text-xs text-muted-foreground">
          Keine Adresse mit Hausnummer „{parsed.houseNumber}" gefunden.
          Bitte Hausnummer prüfen oder ohne Hausnummer suchen.
        </div>
      )}
    </div>
  );
}
