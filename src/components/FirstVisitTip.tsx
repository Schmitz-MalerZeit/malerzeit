import { useEffect, useState, ReactNode } from "react";
import { X, Lightbulb } from "lucide-react";

interface Props {
  storageKey: string;
  title: string;
  children: ReactNode;
}

/**
 * Shows a one-time tip on first visit. Dismiss via X stores flag in
 * localStorage so it never appears again on this device.
 */
export const FirstVisitTip = ({ storageKey, title, children }: Props) => {
  const fullKey = `tip.seen.${storageKey}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(fullKey)) setOpen(true);
    } catch {}
  }, [fullKey]);

  if (!open) return null;

  const dismiss = () => {
    try { localStorage.setItem(fullKey, "1"); } catch {}
    setOpen(false);
  };

  return (
    <div className="relative mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 pr-10 shadow-soft animate-in fade-in slide-in-from-top-2">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tipp schließen"
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-secondary transition-base text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3">
        <div className="shrink-0 h-8 w-8 rounded-full bg-accent/15 text-accent-foreground flex items-center justify-center">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-sm">
          <h3 className="font-semibold mb-1 leading-tight">{title}</h3>
          <div className="text-muted-foreground leading-relaxed space-y-1.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
