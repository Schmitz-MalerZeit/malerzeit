import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, FolderOpen, Settings as SettingsIcon, Scale, User as UserIcon, LogOut, Sparkles, CreditCard } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { AddonPurchaseDialog } from "@/components/AddonPurchaseDialog";
import { toast } from "sonner";

const Tile = ({ icon: Icon, title, subtitle, onClick, primary }: any) => (
  <button onClick={onClick}
    className={`w-full text-left rounded-2xl border p-5 transition-base shadow-soft hover:shadow-elevated active:scale-[0.99] ${
      primary ? "gradient-primary text-primary-foreground border-primary/30" : "bg-card border-border"
    }`}>
    <div className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${primary ? "bg-white/15" : "bg-secondary"}`}>
        <Icon className={`h-6 w-6 ${primary ? "text-white" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-base ${primary ? "" : "text-foreground"}`}>{title}</div>
        {subtitle && <div className={`text-sm mt-0.5 ${primary ? "text-white/80" : "text-muted-foreground"}`}>{subtitle}</div>}
      </div>
    </div>
  </button>
);

export default function Home() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const sub = useSubscription();
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    supabase.from("profiles").select("contact_person").maybeSingle().then(({ data }) => {
      const full = (data?.contact_person || "").trim();
      if (full) setFirstName(full.split(/\s+/)[0]);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success(t("home.loggedOut"));
    nav("/auth");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-20 flex items-center justify-between gap-2">
          <Logo size="md" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <button onClick={logout} aria-label={t("common.logout")} className="p-2 rounded-full hover:bg-secondary transition-base">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8 safe-bottom">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent-foreground text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> {t("home.badgeAi")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {firstName ? t("home.greetingPersonal", { name: firstName }) : t("home.greetingFallback")}
          </h1>
          <p className="text-muted-foreground">{t("home.tagline")}</p>
        </div>

        {!sub.loading && sub.inTrial && !sub.subscription && (
          <button
            onClick={() => nav("/pricing")}
            className="w-full mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-left hover:bg-accent/10 transition-base"
          >
            <div className="text-sm font-semibold mb-0.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Kostenloser Test
            </div>
            <div className="text-xs text-muted-foreground">
              Noch <strong>{sub.trialPdfsLeft} von {sub.trialPdfsLimit} Test-PDFs</strong> übrig – jetzt Tarif sichern →
            </div>
          </button>
        )}

        {!sub.loading && !sub.inTrial && !sub.subscription && (
          <button
            onClick={() => nav("/pricing")}
            className="w-full mb-4 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-left hover:bg-orange-100 transition-base"
          >
            <div className="text-sm font-semibold mb-0.5 text-orange-900">
              Test-PDFs aufgebraucht
            </div>
            <div className="text-xs text-orange-800">
              Du hast alle {sub.trialPdfsLimit} kostenlosen PDFs genutzt. Wähle einen Tarif, um weiter PDFs zu erstellen →
            </div>
          </button>
        )}

        {!sub.loading && sub.subscription && sub.pdfLimit > 0 && (() => {
          const left = Math.max(0, sub.pdfLimit - sub.pdfUsed);
          const pct = Math.min(100, Math.round((sub.pdfUsed / sub.pdfLimit) * 100));
          const low = left <= Math.max(3, Math.ceil(sub.pdfLimit * 0.1));
          const empty = left === 0;
          const now = new Date();
          const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
          const daysLeft = Math.max(1, Math.ceil((resetDate.getTime() - now.getTime()) / 86_400_000));
          const fmtDate = resetDate.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
          const fmtWeekday = resetDate.toLocaleDateString("de-DE", { weekday: "long" });
          return (
            <button
              onClick={() => nav("/billing")}
              className={`w-full mb-4 rounded-2xl border p-4 text-left transition-base ${
                empty
                  ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
                  : low
                  ? "border-accent/40 bg-accent/5 hover:bg-accent/10"
                  : "border-border bg-card hover:bg-secondary/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className={`h-3.5 w-3.5 ${empty ? "text-orange-700" : "text-accent"}`} />
                  KI-Angebote diesen Monat
                </div>
                <div className={`text-sm font-bold tabular-nums ${empty ? "text-orange-900" : "text-foreground"}`}>
                  {left} / {sub.pdfLimit}
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-base ${
                    empty ? "bg-orange-500" : low ? "bg-accent" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={`text-xs ${empty ? "text-orange-800" : "text-muted-foreground"}`}>
                {empty ? "Kontingent aufgebraucht." : `${sub.pdfUsed} von ${sub.pdfLimit} genutzt.`}
              </div>
              <div className={`mt-2 pt-2 border-t text-xs flex items-start justify-between gap-3 ${
                empty ? "border-orange-200 text-orange-900" : "border-border/60 text-muted-foreground"
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {empty ? "Nächste Generierung verfügbar:" : "Reset am:"}
                  </div>
                  <div className="tabular-nums">
                    {fmtWeekday}, {fmtDate} · 00:00 Uhr
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold tabular-nums text-sm">
                    {daysLeft === 1 ? "morgen" : `in ${daysLeft} Tagen`}
                  </div>
                  {empty && <div className="text-[10px]">oder Tarif anpassen →</div>}
                </div>
              </div>
            </button>
          );
        })()}

        <div className="space-y-3">
          <Tile primary icon={FileText} title={t("home.ctaNew")} subtitle={t("home.ctaNewSub")} onClick={() => nav("/quote/new")} />
          <Tile icon={FolderOpen} title={t("home.ctaQuotes")} subtitle={t("home.ctaQuotesSub")} onClick={() => nav("/quotes")} />
          <Tile icon={CreditCard} title="Abo & Rechnungen" subtitle="Tarif verwalten, Nutzung & Zahlungsdaten" onClick={() => nav("/billing")} />
          <Tile icon={UserIcon} title={t("home.ctaProfile")} subtitle={t("home.ctaProfileSub")} onClick={() => nav("/profile")} />
          <Tile icon={SettingsIcon} title={t("home.ctaSettings")} subtitle={t("home.ctaSettingsSub")} onClick={() => nav("/settings")} />
          <Tile icon={Scale} title={t("home.ctaLegal")} subtitle={t("home.ctaLegalSub")} onClick={() => nav("/legal")} />
        </div>
      </main>
    </div>
  );
}
