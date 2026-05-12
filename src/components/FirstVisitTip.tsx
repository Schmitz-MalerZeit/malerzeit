import { useEffect, useState, ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTr } from "@/lib/tr";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  storageKey: string;
  title: string;
  children: ReactNode;
}

/**
 * First-visit tip shown as a centered modal dialog.
 * Seen-state is stored per user in `profiles.seen_tips` so it persists
 * across logout/login and across devices. localStorage is used as a fast
 * cache to avoid a flash before the profile loads.
 */
export const FirstVisitTip = ({ storageKey, title, children }: Props) => {
  const { user, loading } = useAuth();
  const localKey = user ? `tip.seen.${user.id}.${storageKey}` : `tip.seen.${storageKey}`;
  const [open, setOpen] = useState(false);
  const tr = useTr();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    // Fast local cache: if seen on this device for this user, do nothing.
    try {
      if (localStorage.getItem(localKey)) return;
    } catch {}

    const check = async () => {
      if (!user) {
        // Not signed in: fall back to local-only behavior.
        const id = window.setTimeout(() => { if (!cancelled) setOpen(true); }, 150);
        return () => window.clearTimeout(id);
      }
      const { data } = await supabase
        .from("profiles")
        .select("seen_tips")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const seen = (data?.seen_tips as Record<string, boolean> | null) ?? {};
      if (seen[storageKey]) {
        try { localStorage.setItem(localKey, "1"); } catch {}
        return;
      }
      window.setTimeout(() => { if (!cancelled) setOpen(true); }, 150);
    };
    check();
    return () => { cancelled = true; };
  }, [loading, user, localKey, storageKey]);

  const dismiss = async () => {
    try { localStorage.setItem(localKey, "1"); } catch {}
    setOpen(false);
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("seen_tips")
        .eq("id", user.id)
        .maybeSingle();
      const seen = (data?.seen_tips as Record<string, boolean> | null) ?? {};
      seen[storageKey] = true;
      await supabase.from("profiles").update({ seen_tips: seen }).eq("id", user.id);
    }
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
