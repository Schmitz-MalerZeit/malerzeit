import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

type Tier = {
  id: "starter" | "profi" | "profiplus";
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  pdfs: number;
  highlight?: boolean;
  features: string[];
};

// "profiplus" bleibt als Price-ID erhalten (Datenbank/Paddle), wird aber
// in der UI als "Exklusiv" dargestellt.
const TIERS: Tier[] = [
  {
    id: "starter", name: "Starter",
    tagline: "Nur Textgenerierung – ideal für WhatsApp & E-Mail",
    monthly: 14.9, yearly: 149, pdfs: 15,
    features: [
      "Bis zu 15 KI-Angebote / Monat",
      "Alle Stundensätze nutzbar",
      "Spracheingabe (Diktat) überall",
      "Kunden- & WhatsApp-Text zum Kopieren",
      "Kein PDF-Download",
      "Kein Firmenlogo",
      "E-Mail-Support",
    ],
  },
  {
    id: "profi", name: "Profi",
    tagline: "Professionelle PDFs mit deinem Logo",
    monthly: 24.9, yearly: 249, pdfs: 50, highlight: true,
    features: [
      "Bis zu 50 KI-Angebote / Monat",
      "Alles aus Starter",
      "PDF-Download im Briefkopf-Design",
      "Eigenes Logo & Firmenfarben im PDF",
      "PDF-Vorschau vor dem Versand",
      "E-Mail-Support",
    ],
  },
  {
    id: "profiplus", name: "Exklusiv",
    tagline: "Für Betriebe, die ihre Angebote auswerten wollen",
    monthly: 49.9, yearly: 499, pdfs: 200,
    features: [
      "Bis zu 200 KI-Angebote / Monat",
      "Alles aus Profi",
      "CSV-Export aller Angebote (für Excel)",
      "Vollständige Kundendaten im Export (Name, Adresse, Telefon, E-Mail)",
      "Eine Zeile pro Position für Auswertung & Buchhaltung",
      "Bevorzugter Support (Antwort < 24 h)",
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function Pricing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();
  const sub = useSubscription();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [busyId, setBusyId] = useState<string | null>(null);

  const buy = async (tier: Tier) => {
    if (!user) { nav("/auth"); return; }
    const priceId = `${tier.id}_${billing}`;
    setBusyId(priceId);
    try {
      await openCheckout({ priceId, customerEmail: user.email, userId: user.id });
    } finally { setBusyId(null); }
  };

  return (
    <AppShell title="Tarife">
      <div className="space-y-6">
        {sub.inTrial && (
          <div className="rounded-2xl bg-accent/10 border border-accent/30 p-4 text-sm">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Kostenloser Test
            </div>
            <p className="text-muted-foreground">
              Noch <strong>{sub.trialPdfsLeft} von {sub.trialPdfsLimit} Test-PDFs</strong> übrig. Wähle danach einen Tarif, um weiter PDFs zu erstellen.
            </p>
          </div>
        )}

        {!sub.inTrial && !sub.subscription && (
          <div className="rounded-2xl bg-orange-50 border border-orange-300 p-4 text-sm">
            <div className="font-semibold mb-1 text-orange-900">Test-PDFs aufgebraucht</div>
            <p className="text-orange-800">
              Du hast alle {sub.trialPdfsLimit} kostenlosen PDFs genutzt. Wähle jetzt einen Tarif, um weiter PDFs zu erstellen.
            </p>
          </div>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Wähle deinen Tarif</h2>
          <p className="text-sm text-muted-foreground">Faire Kündigungsfristen. Keine versteckten Kosten.</p>
        </div>

        <div className="space-y-2">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Zahlungsweise wählen
          </p>
          <div className="flex justify-center">
            <div className="relative inline-flex p-1 bg-secondary rounded-xl">
              <button onClick={() => setBilling("monthly")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-base ${billing === "monthly" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                Monatlich
              </button>
              <button onClick={() => setBilling("yearly")}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-base ${billing === "yearly" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                Jährlich
                <span className="absolute -top-2 -right-2 text-[10px] font-bold uppercase tracking-wider text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full shadow-soft">
                  -17%
                </span>
              </button>
            </div>
          </div>
          {billing === "yearly" ? (
            <p className="text-center text-xs text-primary font-semibold">
              ✓ Beste Wahl – du sparst 17% im Vergleich zur monatlichen Zahlung
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Tipp: Bei jährlicher Zahlung sparst du <span className="text-primary font-semibold">17%</span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          {TIERS.map((tier) => {
            const price = billing === "monthly" ? tier.monthly : tier.yearly / 12;
            const priceId = `${tier.id}_${billing}`;
            const isCurrent = sub.subscription?.price_id === priceId && sub.subscription?.status !== "canceled";
            return (
              <div key={tier.id}
                className={`rounded-2xl border p-5 shadow-soft ${tier.highlight ? "border-primary/40 bg-primary/[0.03]" : "bg-card border-border"}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-bold text-lg">{tier.name}</h3>
                  {tier.highlight && <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Empfohlen</span>}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{tier.tagline}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{fmt(price)}</span>
                  <span className="text-sm text-muted-foreground">/Monat</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {billing === "yearly" ? `Jährlich ${fmt(tier.yearly)}` : "Monatlich abgerechnet"}
                </p>
                <ul className="space-y-2 mb-5">
                  {tier.features.map((f, i) => {
                    const isQuotaLine = i === 0 && /KI-Angebote/i.test(f);
                    return (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className={isQuotaLine ? "font-bold text-foreground text-[15px]" : ""}>{f}</span>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  onClick={() => buy(tier)}
                  disabled={loading || isCurrent}
                  className={`w-full h-11 ${tier.highlight ? "gradient-primary text-primary-foreground border-0" : ""}`}
                  variant={tier.highlight ? "default" : "outline"}
                >
                  {busyId === priceId ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    isCurrent ? "Aktueller Tarif" : "Tarif wählen"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">Kündigungsfristen</p>
          <p>
            <strong className="text-foreground">Monatlich:</strong> Kündbar zum Ende des aktuellen Monats – das Abo endet dann zum Folgemonat.
          </p>
          <p>
            <strong className="text-foreground">Jährlich:</strong> Kündbar bis spätestens <strong className="text-foreground">1 Monat vor Ablauf</strong> des Vertragsjahres. Ohne Kündigung verlängert sich der Vertrag um ein weiteres Jahr.
          </p>
          <p className="pt-1">Zahlungsabwicklung über Paddle. Alle Preise inkl. MwSt.</p>
        </div>
      </div>
    </AppShell>
  );
}
