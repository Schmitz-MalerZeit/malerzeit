import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Info, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isNativeApp } from "@/lib/platform";

type TierId = "starter" | "profi" | "profiplus";
type Tier = {
  id: TierId;
  monthly: number;
  yearly: number;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  { id: "starter", monthly: 14.9, yearly: 149 },
  { id: "profi", monthly: 24.9, yearly: 249, highlight: true },
  { id: "profiplus", monthly: 34.95, yearly: 349 },
];

export default function Pricing() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();
  const sub = useSubscription();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [discountCode, setDiscountCode] = useState<string>("");

  useEffect(() => {
    const c = searchParams.get("code");
    if (c) {
      const v = c.trim().toUpperCase();
      setDiscountCode(v);
      try { sessionStorage.setItem("promo_code", v); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem("promo_code");
        if (stored) setDiscountCode(stored);
      } catch {}
    }
  }, [searchParams]);

  const locale = (i18n.resolvedLanguage || "de") === "en" ? "en-US" : "de-DE";
  const fmt = (n: number) =>
    n.toLocaleString(locale, { style: "currency", currency: "EUR" });

  const buy = async (tier: Tier) => {
    if (!user) { nav("/auth"); return; }
    const priceId = `${tier.id}_${billing}`;
    setBusyId(priceId);
    try {
      const hasActiveSub = sub.subscription &&
        ["active", "trialing", "past_due"].includes(sub.subscription.status) &&
        !sub.subscription.cancel_at_period_end;

      if (hasActiveSub) {
        // Switch existing subscription via Paddle API instead of creating a new one
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("change-subscription", {
          body: { newPriceId: priceId },
        });
        if (error || data?.error) {
          const { toast } = await import("sonner");
          toast.error(t("pricing.switchFailed", { defaultValue: "Tarifwechsel fehlgeschlagen" }));
        } else {
          const { toast } = await import("sonner");
          toast.success(t("pricing.switchSuccess", { defaultValue: "Tarif gewechselt – anteilige Berechnung erfolgt automatisch." }));
          await sub.refresh();
          nav("/billing");
        }
      } else {
        await openCheckout({ priceId, customerEmail: user.email, userId: user.id });
      }
    } finally { setBusyId(null); }
  };

  return (
    <AppShell title={t("pricing.title")}>
      <div className="space-y-6">
        {sub.inTrial && (
          <div className="rounded-2xl bg-accent/10 border border-accent/30 p-5 text-sm">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> {t("pricing.trialTitle")}
            </div>
            <p className="text-muted-foreground">
              <Trans
                i18nKey="pricing.trialBody"
                values={{ left: sub.trialPdfsLeft, limit: sub.trialPdfsLimit }}
                components={[<strong />]}
              />
            </p>
          </div>
        )}

        {user && !sub.inTrial && !sub.subscription && (
          <div className="rounded-2xl bg-orange-50 border border-orange-300 p-5 text-sm">
            <div className="font-semibold mb-1 text-orange-900">{t("pricing.trialUsedTitle")}</div>
            <p className="text-orange-800">
              {t("pricing.trialUsedBody", { limit: sub.trialPdfsLimit })}
            </p>
          </div>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-2">{t("pricing.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("pricing.sub")}</p>
        </div>

        <div className="space-y-2">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pricing.billingChoose")}
          </p>
          <div className="flex justify-center">
            <div className="relative inline-flex p-1 bg-secondary rounded-xl">
              <button onClick={() => setBilling("monthly")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-base ${billing === "monthly" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                {t("pricing.monthly")}
              </button>
              <button onClick={() => setBilling("yearly")}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-base ${billing === "yearly" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                {t("pricing.yearly")}
                <span className="absolute -top-2 -right-2 text-[10px] font-bold uppercase tracking-wider text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full shadow-soft">
                  {t("pricing.save17")}
                </span>
              </button>
            </div>
          </div>
          {billing === "yearly" ? (
            <p className="text-center text-xs text-primary font-semibold">
              {t("pricing.yearlyHintBest")}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              <Trans i18nKey="pricing.yearlyHintTip" components={[<span className="text-primary font-semibold" />]} />
            </p>
          )}
        </div>

        <div className="space-y-4">
          {TIERS.map((tier) => {
            const price = billing === "monthly" ? tier.monthly : tier.yearly / 12;
            const priceId = `${tier.id}_${billing}`;
            const isCurrent = sub.subscription?.price_id === priceId && sub.subscription?.status !== "canceled";
            const name = t(`pricing.tiers.${tier.id}.name`);
            const tagline = t(`pricing.tiers.${tier.id}.tagline`);
            const quotaLine = t(`pricing.tiers.${tier.id}.quota`);
            const features = t(`pricing.tiers.${tier.id}.features`, { returnObjects: true }) as string[];
            return (
              <div key={tier.id}
                className={`rounded-2xl border p-5 shadow-soft ${tier.highlight ? "border-primary/40 bg-primary/[0.03]" : "bg-card border-border"}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-bold text-lg">{name}</h3>
                  {tier.highlight && <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t("pricing.recommended")}</span>}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{tagline}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{fmt(price)}</span>
                  <span className="text-sm text-muted-foreground">{t("pricing.perMonth")}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {billing === "yearly" ? t("pricing.yearlyTotal", { amount: fmt(tier.yearly) }) : t("pricing.monthlyBilled")}
                </p>
                <ul className="space-y-2 mb-5">
                  <li className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-bold text-foreground text-[15px] flex items-center gap-1.5 flex-wrap">
                      {quotaLine}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("pricing.quotaInfoTitle")}
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-base"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-72 text-xs leading-relaxed">
                          <p className="font-semibold text-foreground mb-1.5">{t("pricing.quotaInfoTitle")}</p>
                          <p className="text-muted-foreground mb-2">
                            <Trans i18nKey="pricing.quotaInfoBody" components={[<strong />]} />
                          </p>
                          <p className="font-semibold text-foreground mb-1">{t("pricing.quotaInfoMonthlyTitle")}</p>
                          <p className="text-muted-foreground">
                            <Trans i18nKey="pricing.quotaInfoMonthlyBody" components={[<strong />]} />
                          </p>
                        </PopoverContent>
                      </Popover>
                    </span>
                  </li>
                  {features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isNativeApp() ? (
                  <div className="w-full h-11 rounded-md border border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
                    {isCurrent ? t("pricing.current") : t("pricing.nativeManage")}
                  </div>
                ) : (
                  <Button
                    onClick={() => buy(tier)}
                    disabled={loading || isCurrent}
                    className={`w-full h-11 ${tier.highlight ? "gradient-primary text-primary-foreground border-0" : ""}`}
                    variant={tier.highlight ? "default" : "outline"}
                  >
                    {busyId === priceId ? <Loader2 className="h-4 w-4 animate-spin" /> :
                      isCurrent ? t("pricing.current") : t("pricing.choose")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-secondary/30 p-5 text-xs text-muted-foreground space-y-1.5 shadow-soft">
          <p className="font-semibold text-foreground">{t("pricing.cancelTitle")}</p>
          <p>
            <Trans i18nKey="pricing.cancelMonthly" components={[<strong className="text-foreground" />]} />
          </p>
          <p>
            <Trans i18nKey="pricing.cancelYearly" components={[<strong className="text-foreground" />]} />
          </p>
          <p className="pt-1">{t("pricing.cancelFooter")}</p>
        </div>
      </div>
    </AppShell>
  );
}
