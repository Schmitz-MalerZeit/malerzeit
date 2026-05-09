import { useEffect, useState, ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTr } from "@/lib/tr";

interface Props {
  storageKey: string;
  title: string;
  children: ReactNode;
}

/**
 * First-visit tip shown as a centered modal dialog covering ~3/4 of the
 * screen. Dismiss via the close button stores a flag in localStorage so it
 * never appears again on this device.
 */
export const FirstVisitTip = ({ storageKey, title, children }: Props) => {
  const fullKey = `tip.seen.${storageKey}`;
  const [open, setOpen] = useState(false);
  const tr = useTr();

  useEffect(() => {
    try {
      if (!localStorage.getItem(fullKey)) {
        // small delay so dialog mounts after page paint
        const id = window.setTimeout(() => setOpen(true), 150);
        return () => window.clearTimeout(id);
      }
    } catch {}
  }, [fullKey]);

  const dismiss = () => {
    try { localStorage.setItem(fullKey, "1"); } catch {}
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-lg w-[88vw] sm:w-[75vw] max-h-[78vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="h-8 w-8 rounded-full bg-accent/15 text-accent-foreground flex items-center justify-center">
              <Lightbulb className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 text-sm text-muted-foreground leading-relaxed space-y-3">
          {children}
        </div>
        <div className="px-6 py-4 border-t border-border">
          <Button onClick={dismiss} className="w-full h-11">
            {tr("Verstanden", "Got it")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
