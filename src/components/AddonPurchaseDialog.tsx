import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useNavigate } from "react-router-dom";
import { useTr } from "@/lib/tr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextLine?: string;
}

const PACKAGES: Array<{ priceId: string; pdfs: number; price: string; perPdf: string; recommended?: boolean }> = [
  { priceId: "addon_10_pdfs", pdfs: 10, price: "9,90 €", perPdf: "0,99 €/PDF" },
  { priceId: "addon_20_pdfs", pdfs: 20, price: "17,90 €", perPdf: "0,90 €/PDF", recommended: true },
];

export function AddonPurchaseDialog({ open, onOpenChange, contextLine }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const tr = useTr();
  const { openCheckout } = usePaddleCheckout();
  const [busyId, setBusyId] = useState<string | null>(null);

  const buy = async (priceId: string) => {
    if (!user) { nav("/auth"); return; }
    setBusyId(priceId);
    try {
      await openCheckout({
        priceId,
        customerEmail: user.email,
        userId: user.id,
        successUrl: `${window.location.origin}/billing?addon=success`,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {tr("Zusätzliche PDFs nachladen", "Top up extra PDFs")}
          </DialogTitle>
          <DialogDescription>
            {contextLine ?? tr("Erweitere dein monatliches Kontingent ohne Tarifwechsel.", "Top up your monthly quota without changing plans.")}
            {" "}{tr("Die zusätzlichen PDFs gelten bis zum Monatsende.", "The extra PDFs are valid until the end of the month.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.priceId}
              type="button"
              onClick={() => buy(pkg.priceId)}
              disabled={busyId !== null}
              className={`w-full text-left rounded-xl border p-4 transition-base hover:border-primary hover:bg-primary/5 disabled:opacity-60 ${
                pkg.recommended ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="font-bold text-base">{pkg.pdfs} PDFs</span>
                    {pkg.recommended && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {tr("Beliebt", "Popular")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pkg.perPdf}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{pkg.price}</div>
                  {busyId === pkg.priceId && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto mt-1" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {tr(
            "Tipp: Brauchst du regelmäßig mehr Angebote? Mit dem nächsthöheren Tarif sparst du langfristig.",
            "Tip: Need more quotes regularly? You'll save more long-term with the next higher plan.",
          )}
        </p>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); nav("/pricing"); }} className="w-full">
            {tr("Stattdessen Tarif wechseln", "Change plan instead")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
