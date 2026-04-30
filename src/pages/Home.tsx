import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, FolderOpen, Settings as SettingsIcon, Scale, User as UserIcon, LogOut, Sparkles, CreditCard } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
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
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Kostenloser Test läuft
            </div>
            <div className="text-xs text-muted-foreground">
              Noch <strong>{sub.trialDaysLeft} Tage</strong> – jetzt Tarif sichern, um nahtlos weiterzumachen →
            </div>
          </button>
        )}

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
