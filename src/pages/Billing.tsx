import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink, CreditCard, Sparkles, AlertCircle } from "lucide-react";
import { useState } from "react";

const PLAN_NAMES: Record<string, string> = {
  starter_plan: "Starter", profi_plan: "Profi", profiplus_plan: "Profi+",
};

export default function Billing() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sub = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast.success("Zahlung erfolgreich – willkommen!");
      const t = setInterval(() => sub.refresh(), 2000);
      setTimeout(() => clearInterval(t), 12000);
    }
  }, [params]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error || !data?.url) throw new Error("Portal nicht verfügbar");
      window.open(data.url, "_blank");
    } catch (e: any) { toast.error(e.message); }
    finally { setPortalLoading(false); }
  };

  if (sub.loading) return <AppShell title="Abo & Rechnungen"><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  const s = sub.subscription;
  const planName = s ? PLAN_NAMES[s.product_id] || s.product_id : null;

  return (
    <AppShell title="Abo & Rechnungen">
      <div className="space-y-5">
        {sub.inTrial && !s && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <Sparkles className="h-4 w-4 text-accent" /> 14-Tage-Test aktiv
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Noch <strong>{sub.trialDaysLeft} Tage</strong> kostenlos. Wähle einen Tarif, um nach dem Test ohne Unterbrechung weiterzumachen.
            </p>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              Tarif wählen
            </Button>
          </div>
        )}

        {s && (
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{planName}</h2>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                s.status === "active" || s.status === "trialing" ? "bg-primary/10 text-primary" :
                s.status === "past_due" ? "bg-orange-100 text-orange-800" :
                "bg-muted text-muted-foreground"
              }`}>
                {s.status === "active" ? "Aktiv" : s.status === "trialing" ? "Test" :
                 s.status === "past_due" ? "Zahlung offen" : s.status === "canceled" ? "Gekündigt" : s.status}
              </span>
            </div>

            {s.current_period_end && (
              <p className="text-sm text-muted-foreground">
                {s.cancel_at_period_end || s.status === "canceled"
                  ? <>Zugang aktiv bis <strong>{new Date(s.current_period_end).toLocaleDateString("de-DE")}</strong></>
                  : <>Nächste Abbuchung: <strong>{new Date(s.current_period_end).toLocaleDateString("de-DE")}</strong></>}
              </p>
            )}

            <div className="pt-3 border-t border-border">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">PDF-Nutzung diesen Monat</span>
                <span className="font-medium">{sub.pdfUsed} / {sub.pdfLimit}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (sub.pdfUsed / Math.max(1, sub.pdfLimit)) * 100)}%` }} />
              </div>
            </div>

            {s.status === "past_due" && (
              <div className="flex gap-2 p-3 rounded-lg bg-orange-50 text-orange-900 text-xs border border-orange-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Letzte Zahlung fehlgeschlagen. Bitte aktualisiere deine Zahlungsdaten im Kundenportal.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={() => nav("/pricing")} className="h-11">
                Tarif ändern
              </Button>
              <Button variant="outline" onClick={openPortal} disabled={portalLoading} className="h-11">
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Verwalten <ExternalLink className="h-3 w-3 ml-1" /></>}
              </Button>
            </div>
          </div>
        )}

        {!s && !sub.inTrial && (
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft text-center">
            <p className="text-sm text-muted-foreground mb-4">Du hast aktuell kein aktives Abo.</p>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              Tarif wählen
            </Button>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Rechnungen & Zahlungsdaten werden über Paddle verwaltet.
        </p>
      </div>
    </AppShell>
  );
}
