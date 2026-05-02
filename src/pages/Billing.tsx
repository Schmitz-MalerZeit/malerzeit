import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink, CreditCard, Sparkles, AlertCircle, FileText, Receipt, Download, RotateCw } from "lucide-react";

interface Tx {
  id: string;
  status: string;
  created_at: string;
  billed_at: string | null;
  amount: number;
  currency: string;
  invoice_url: string | null;
  environment: "sandbox" | "live";
}

const PLAN_NAMES: Record<string, string> = {
  starter_plan: "Starter", profi_plan: "Profi", profiplus_plan: "Exklusiv",
};

export default function Billing() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sub = useSubscription();
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "de") === "en" ? "en-US" : "de-DE";
  const fmtAmount = (n: number, c: string) =>
    n.toLocaleString(locale, { style: "currency", currency: c || "EUR" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const statusLabel = (status: string) =>
    t(`billing.txStatus.${status}`, { defaultValue: status });
  const [portalLoading, setPortalLoading] = useState(false);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const downloadInvoice = async (tx: Tx) => {
    if (!tx.invoice_url) return;
    setDownloadingId(tx.id);
    // Clear previous failure marker for this row
    setFailedIds((prev) => {
      if (!prev.has(tx.id)) return prev;
      const next = new Set(prev);
      next.delete(tx.id);
      return next;
    });
    try {
      const res = await fetch(tx.invoice_url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rechnung_${(tx.billed_at ?? tx.created_at).slice(0, 10)}_${tx.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // CORS or network — mark as failed and offer retry
      console.warn("invoice download failed", e);
      setFailedIds((prev) => {
        const next = new Set(prev);
        next.add(tx.id);
        return next;
      });
      toast.error(t("billing.downloadFailed"), {
        action: { label: t("billing.openInTab"), onClick: () => window.open(tx.invoice_url!, "_blank", "noopener,noreferrer") },
      });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast.success("Zahlung erfolgreich – willkommen!");
      const t = setInterval(() => sub.refresh(), 2000);
      setTimeout(() => clearInterval(t), 12000);
    }
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTxLoading(true);
      const { data, error } = await supabase.functions.invoke("list-transactions");
      if (cancelled) return;
      if (error) {
        console.error(error);
        setTxs([]);
      } else {
        setTxs((data?.transactions ?? []) as Tx[]);
      }
      setTxLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sub.subscription?.id]);

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
              <Sparkles className="h-4 w-4 text-accent" /> Kostenloser Test
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Du kannst <strong>{sub.trialPdfsLimit} PDFs gratis</strong> erstellen, um Maler-Angebot in Ruhe auszuprobieren.
            </p>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Test-PDFs genutzt</span>
                <span className="font-medium">{sub.trialPdfsUsed} / {sub.trialPdfsLimit}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, (sub.trialPdfsUsed / Math.max(1, sub.trialPdfsLimit)) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Noch <strong>{sub.trialPdfsLeft}</strong> Test-PDF{sub.trialPdfsLeft === 1 ? "" : "s"} übrig
              </p>
            </div>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              Tarif wählen
            </Button>
          </div>
        )}

        {!sub.inTrial && !s && (
          <div className="rounded-2xl border border-orange-300 bg-orange-50 p-5">
            <div className="flex items-center gap-2 font-semibold mb-2 text-orange-900">
              Test-PDFs aufgebraucht
            </div>
            <p className="text-sm text-orange-800 mb-4">
              Du hast alle {sub.trialPdfsLimit} kostenlosen Test-PDFs genutzt. Wähle einen Tarif, um weitere PDFs zu erstellen.
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

        {/* Rechnungen / Zahlungen */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Rechnungen & Zahlungen</h2>
          </div>

          {txLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!txLoading && txs && txs.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Noch keine Zahlungen vorhanden.
            </p>
          )}

          {!txLoading && txs && txs.length > 0 && (
            <ul className="divide-y divide-border -mx-1">
              {txs.map((t) => {
                const isPaid = t.status === "completed" || t.status === "paid";
                const isFailed = t.status === "past_due" || t.status === "canceled";
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3 px-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {fmtAmount(t.amount, t.currency)}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isPaid ? "bg-primary/10 text-primary" :
                          isFailed ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDate(t.billed_at ?? t.created_at)}
                      </p>
                    </div>
                    {t.invoice_url && (
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={t.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline px-2 py-1"
                          title="Rechnung ansehen"
                        >
                          <FileText className="h-3.5 w-3.5" /> Ansehen
                        </a>
                        {(() => {
                          const isLoading = downloadingId === t.id;
                          const hasFailed = failedIds.has(t.id);
                          return (
                            <button
                              type="button"
                              onClick={() => downloadInvoice(t)}
                              disabled={isLoading}
                              className={`text-xs font-medium inline-flex items-center gap-1 hover:underline px-2 py-1 disabled:opacity-50 ${
                                hasFailed ? "text-destructive" : "text-primary"
                              }`}
                              title={hasFailed ? "Erneut versuchen" : "PDF herunterladen"}
                            >
                              {isLoading
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : hasFailed
                                  ? <RotateCw className="h-3.5 w-3.5" />
                                  : <Download className="h-3.5 w-3.5" />}
                              {hasFailed ? "Erneut" : "PDF"}
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Rechnungen & Zahlungsdaten werden über Paddle verwaltet.
        </p>
      </div>
    </AppShell>
  );
}
