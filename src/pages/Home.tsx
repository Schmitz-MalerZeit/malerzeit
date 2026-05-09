import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { FileText, FolderOpen, Settings as SettingsIcon, Scale, User as UserIcon, LogOut, Sparkles, CreditCard, HelpCircle } from "lucide-react";
import { HelpDialog } from "@/components/HelpDialog";
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
  const { t, i18n } = useTranslation();
  const sub = useSubscription();
  const [firstName, setFirstName] = useState<string>("");
  const [addonOpen, setAddonOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const greetingKey = (() => {
    const h = now.getHours();
    if (h >= 5 && h < 11) return "Morning";
    if (h >= 11 && h < 18) return "Day";
    if (h >= 18 && h < 23) return "Evening";
    return "Night";
  })();

  const startNewQuote = () => {
    localStorage.removeItem("quoteDraft.v1");
    localStorage.removeItem("currentQuote");
    sessionStorage.removeItem("currentQuotePdf");
    nav("/quote/new");
  };

  useEffect(() => {
    supabase.from("profiles").select("contact_person, signatory_name").maybeSingle().then(({ data }) => {
      const full = ((data?.signatory_name || "").trim() || (data?.contact_person || "").trim());
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
            {firstName
              ? t(`home.greeting${greetingKey}Personal`, { name: firstName, defaultValue: t("home.greetingPersonal", { name: firstName }) })
              : t(`home.greeting${greetingKey}Fallback`, { defaultValue: t("home.greetingFallback") })}
          </h1>
          <p className="text-muted-foreground">{t("home.tagline")}</p>
        </div>

        {!sub.loading && sub.inTrial && !sub.subscription && (
          <button
            onClick={() => nav("/pricing")}
            className="w-full mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-left hover:bg-accent/10 transition-base"
          >
            <div className="text-sm font-semibold mb-0.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> {t("home.trialBadge")}
            </div>
            <div className="text-xs text-muted-foreground">
              <Trans
                i18nKey="home.trialLeft"
                values={{ left: sub.trialPdfsLeft, limit: sub.trialPdfsLimit }}
                components={{ strong: <strong /> }}
              />
            </div>
          </button>
        )}

        {!sub.loading && !sub.inTrial && !sub.subscription && (
          <button
            onClick={() => nav("/pricing")}
            className="w-full mb-4 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-left hover:bg-orange-100 transition-base"
          >
            <div className="text-sm font-semibold mb-0.5 text-orange-900">
              {t("home.trialUsedTitle")}
            </div>
            <div className="text-xs text-orange-800">
              {t("home.trialUsedBody", { limit: sub.trialPdfsLimit })}
            </div>
          </button>
        )}

        {!sub.loading && sub.subscription && sub.pdfLimit > 0 && (() => {
          const effective = sub.effectiveLimit;
          const left = Math.max(0, effective - sub.pdfUsed);
          const pct = Math.min(100, Math.round((sub.pdfUsed / effective) * 100));
          const warn = pct >= 80 && left > 0;
          const empty = left === 0;
          const now = new Date();
          const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
          const daysLeft = Math.max(1, Math.ceil((resetDate.getTime() - now.getTime()) / 86_400_000));
          const locale = (i18n.resolvedLanguage || "de") === "en" ? "en-US" : "de-DE";
          const fmtDate = resetDate.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
          const fmtWeekday = resetDate.toLocaleDateString(locale, { weekday: "long" });
          return (
            <div
              className={`w-full mb-4 rounded-2xl border p-4 transition-base ${
                empty
                  ? "border-orange-300 bg-orange-50"
                  : warn
                  ? "border-amber-300 bg-amber-50"
                  : "border-border bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => nav("/billing")}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className={`h-3.5 w-3.5 ${empty ? "text-orange-700" : warn ? "text-amber-700" : "text-accent"}`} />
                    {t("home.quotaTitle")}
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${empty ? "text-orange-900" : warn ? "text-amber-900" : "text-foreground"}`}>
                    {left} / {effective}
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-base ${
                      empty ? "bg-orange-500" : warn ? "bg-amber-500" : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={`text-xs ${empty ? "text-orange-800" : warn ? "text-amber-800" : "text-muted-foreground"}`}>
                  {empty
                    ? t("home.quotaEmpty")
                    : sub.addonBonus > 0
                      ? t("home.quotaUsedWithBonus", { used: sub.pdfUsed, limit: effective, bonus: sub.addonBonus })
                      : t("home.quotaUsed", { used: sub.pdfUsed, limit: effective }) + "."}
                </div>
                <div className={`mt-2 pt-2 border-t text-xs flex items-start justify-between gap-3 ${
                  empty ? "border-orange-200 text-orange-900" : warn ? "border-amber-200 text-amber-900" : "border-border/60 text-muted-foreground"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {empty ? t("home.quotaNextOn") : t("home.quotaResetOn")}
                    </div>
                    <div className="tabular-nums">
                      {fmtWeekday}, {fmtDate} · 00:00
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold tabular-nums text-sm">
                      {daysLeft === 1 ? t("home.quotaTomorrow") : t("home.quotaInDays", { count: daysLeft })}
                    </div>
                  </div>
                </div>
              </button>
              {(warn || empty) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAddonOpen(true); }}
                  className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-base ${
                    empty
                      ? "bg-orange-600 text-white hover:bg-orange-700"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  }`}
                >
                  {t("home.quotaTopupCta")}
                </button>
              )}
            </div>
          );
        })()}

        <div className="space-y-3">
          <Tile primary icon={FileText} title={t("home.ctaNew")} subtitle={t("home.ctaNewSub")} onClick={startNewQuote} />
          <Tile icon={FolderOpen} title={t("home.ctaQuotes")} subtitle={t("home.ctaQuotesSub")} onClick={() => nav("/quotes")} />
          <Tile icon={CreditCard} title={t("home.ctaBilling")} subtitle={t("home.ctaBillingSub")} onClick={() => nav("/billing")} />
          <Tile icon={UserIcon} title={t("home.ctaProfile")} subtitle={t("home.ctaProfileSub")} onClick={() => nav("/profile")} />
          <Tile icon={SettingsIcon} title={t("home.ctaSettings")} subtitle={t("home.ctaSettingsSub")} onClick={() => nav("/settings")} />
          <Tile icon={Scale} title={t("home.ctaLegal")} subtitle={t("home.ctaLegalSub")} onClick={() => nav("/legal")} />
        </div>
      </main>
      <AddonPurchaseDialog open={addonOpen} onOpenChange={setAddonOpen} />
    </div>
  );
}
