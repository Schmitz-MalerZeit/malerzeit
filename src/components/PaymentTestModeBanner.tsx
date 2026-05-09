import { getPaddleEnvironment } from "@/lib/paddle";
import { useTr } from "@/lib/tr";

export function PaymentTestModeBanner() {
  const tr = useTr();
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-xs text-orange-800">
      {tr(
        "Testmodus aktiv – alle Zahlungen sind Testtransaktionen.",
        "Test mode active – all payments are test transactions.",
      )}{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        {tr("Mehr Infos", "Learn more")}
      </a>
    </div>
  );
}
