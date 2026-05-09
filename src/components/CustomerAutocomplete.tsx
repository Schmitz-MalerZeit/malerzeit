import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CustomerSuggestion {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (s: CustomerSuggestion) => void;
  suggestions: CustomerSuggestion[];
  placeholder?: string;
  className?: string;
}

export function CustomerAutocomplete({
  id, value, onChange, onSelectSuggestion, suggestions, placeholder, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set<string>();
    const out: CustomerSuggestion[] = [];
    for (const s of suggestions) {
      const key = `${s.name}|${s.address}|${s.postal_code}|${s.city}`.toLowerCase();
      if (seen.has(key)) continue;
      if (s.name.toLowerCase().includes(q)) {
        seen.add(key);
        out.push(s);
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [value, suggestions]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (s: CustomerSuggestion) => {
    onSelectSuggestion(s);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn("h-11", className)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); select(filtered[highlight]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {filtered.map((s, i) => (
            <button
              type="button"
              key={`${s.name}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              <div className="font-medium truncate">{s.name}</div>
              {(s.address || s.postal_code || s.city) && (
                <div className="text-xs text-muted-foreground truncate">
                  {[s.address, [s.postal_code, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
