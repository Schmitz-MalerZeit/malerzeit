import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTr } from "@/lib/tr";
import { ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Short description of what is being purchased, e.g. "Profi-Tarif (jährlich)". */
  itemLabel: string;
  /** Formatted price string, e.g. "24,90 € / Monat" or "9,90 € einmalig". */
  priceLabel: string;
  /** Optional extra note (renewal, refund policy, addon validity, etc.). */
  note?: string;
  /** Optional active discount code shown to reassure users it will be applied. */
  discountCode?: string;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function ConfirmPurchaseDialog({
  open, onOpenChange, title, itemLabel, priceLabel, note, discountCode, onConfirm, confirmLabel,
}: Props) {
  const tr = useTr();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1 text-left">
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {tr("Auswahl", "Selection")}
                </div>
                <div className="font-semibold text-foreground mt-0.5">{itemLabel}</div>
                <div className="text-sm text-foreground mt-1">
                  <span className="text-muted-foreground">{tr("Preis: ", "Price: ")}</span>
                  <strong>{priceLabel}</strong>
                </div>
                {discountCode && (
                  <div className="text-xs text-primary mt-1">
                    {tr("Rabattcode wird angewendet: ", "Discount code applied: ")}
                    <span className="font-mono">{discountCode}</span>
                  </div>
                )}
              </div>
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Mit dem Klick auf Bestätigen öffnet sich das sichere Bezahlfenster.",
                  "Clicking Confirm opens the secure payment window.",
                )}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Abbrechen", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel ?? tr("Kostenpflichtig bestätigen", "Confirm purchase")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
