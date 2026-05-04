import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

export interface AddressSuggestion {
  /** Just the street (no house number) */
  street: string;
  postalCode: string;
  city: string;
  /** Full label for display */
  label: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  /** Called when the user picks a suggestion. Provides street (without house
   *  number), postal code and city. The host should also keep any house
   *  number the user already typed. */
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

/**
 * Address auto-complete using the OpenPLZ API.
 *
 * - Free, no API key, official German Bund data, full coverage.
 * - Returns street + postal code + city in a single tap.
 * - Debounced 250 ms, request cancellation on each new keystroke.
 *
 * Docs: https://www.openplzapi.org/swagger/index.html
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
  /** Tracks the value that produced the last picked suggestion. While the
   *  user does not edit the field again, we suppress the dropdown so the
   *  list does not re-open after a selection. */
  const justPickedFor = useRef<string | null>(null);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounced fetch
  const trimmed = value.trim();
  const queryStreet = useMemo(() => splitStreetAndNumber(trimmed).street, [trimmed]);
  useEffect(() => {
    if (justPickedFor.current === trimmed) return;
    if (queryStreet.length < 3) {
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
        // Use wildcard so partial matches work ("Hauptstr" → "Hauptstraße")
        const url = `https://openplzapi.org/de/Streets?name=${encodeURIComponent(queryStreet + "*")}&page=1&pageSize=15`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) { setSuggestions([]); return; }
        const data = await res.json();
        if (!Array.isArray(data)) { setSuggestions([]); return; }
        // Deduplicate identical street+plz+city combinations
        const seen = new Set<string>();
        const out: AddressSuggestion[] = [];
        for (const row of data) {
          const street = (row?.name || "").trim();
          const postalCode = (row?.postalCode || "").trim();
          const city = (row?.locality || "").trim();
          if (!street || !postalCode || !city) continue;
          const key = `${street}|${postalCode}|${city}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            street, postalCode, city,
            label: `${street}, ${postalCode} ${city}`,
          });
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
  }, [queryStreet, trimmed]);

  const select = (s: AddressSuggestion) => {
    const { houseNumber } = splitStreetAndNumber(value);
    const newAddress = houseNumber ? `${s.street} ${houseNumber}` : s.street;
    justPickedFor.current = newAddress;
    onChange(newAddress);
    onSelectSuggestion(s);
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
              key={`${s.street}-${s.postalCode}-${s.city}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors flex items-start gap-2",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{s.street}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.postalCode} {s.city}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
