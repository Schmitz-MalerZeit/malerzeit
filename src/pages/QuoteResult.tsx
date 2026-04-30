import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, FileDown, Save, Loader2, Check, RotateCw, Eye } from "lucide-react";
import { buildQuotePDF, urlToDataUrl } from "@/lib/pdf";

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function QuoteResult() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  useEffect(() => {
    const raw = sessionStorage.getItem("currentQuote");
    if (!raw) { nav("/quote/new"); return; }
    setData(JSON.parse(raw));
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setProfile(data));
  }, [nav]);

  if (!data) return null;
  const ai = data.ai;
  const p = ai.pricing;

  const copyText = async () => {
    await navigator.clipboard.writeText(ai.customer_text);
    toast.success("Kundentext kopiert");
  };
  const copyWA = async () => {
    await navigator.clipboard.writeText(ai.whatsapp_text);
    toast.success("WhatsApp-Text kopiert");
  };

  const buildPDF = async () => {
    let logoDataUrl: string | undefined;
    if (profile?.logo_url) logoDataUrl = await urlToDataUrl(profile.logo_url);
    return buildQuotePDF({
      company: {
        name: profile?.company_name,
        contact: profile?.contact_person,
        address: profile?.address,
        phone: profile?.phone,
        email: profile?.email,
        logoDataUrl,
        primaryColor: profile?.logo_primary_color,
        secondaryColor: profile?.logo_secondary_color,
      },
      customer: data.customer ? {
        name: data.customer.name,
        address: data.customer.address,
        postalCode: data.customer.postal_code,
        city: data.customer.city,
      } : undefined,
      date: new Date().toLocaleDateString("de-DE"),
      lineItems: ai.line_items,
      net: p.net_amount, vat: p.vat_amount, gross: p.gross_amount, vatRate: p.vat_rate,
    });
  };

  const consumeQuota = async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc("consume_pdf_quota");
    if (error) { toast.error("Limit-Prüfung fehlgeschlagen: " + error.message); return false; }
    const res = data as { ok: boolean; error?: string; limit?: number; used?: number };
    if (!res?.ok) {
      if (res?.error === "limit_reached") {
        toast.error(`Monatslimit erreicht (${res.used}/${res.limit}).`, {
          action: { label: "Upgrade", onClick: () => nav("/pricing") },
        });
      } else if (res?.error === "no_active_plan") {
        toast.error("Kein aktiver Tarif. Bitte wähle einen Plan.", {
          action: { label: "Tarife", onClick: () => nav("/pricing") },
        });
      } else {
        toast.error("PDF-Erstellung nicht erlaubt.");
      }
      return false;
    }
    return true;
  };

  const downloadPDF = async () => {
    setBusy(true);
    try {
      const pdf = await buildPDF();                 // 1) build first (no cost if it fails)
      const ok = await consumeQuota();              // 2) atomically consume quota
      if (!ok) return;
      pdf.save(`Preisvorschlag_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) { toast.error(e.message || "PDF-Fehler"); }
    finally { setBusy(false); }
  };

  const previewPDF = async () => {
    setBusy(true);
    try {
      const pdf = await buildPDF();
      const ok = await consumeQuota();
      if (!ok) return;
      const blob = pdf.output("blob");
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) { toast.error(e.message || "PDF-Fehler"); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("quotes").insert({
        user_id: u.user.id,
        description: data.description,
        line_items: ai.line_items,
        customer_text: ai.customer_text,
        whatsapp_text: ai.whatsapp_text,
        net_amount: p.net_amount,
        vat_amount: p.vat_amount,
        gross_amount: p.gross_amount,
        vat_rate: p.vat_rate,
        estimated_hours: ai.estimated_hours,
        estimated_material: ai.estimated_material_cost,
        customer_name: data.customer?.name || null,
        customer_address: data.customer?.address || null,
        customer_postal_code: data.customer?.postal_code || null,
        customer_city: data.customer?.city || null,
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Vorschlag gespeichert");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const headerTitle = data.customer?.name?.trim() || "Preisvorschlag";

  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <h2 className="font-semibold mb-3 text-lg">Leistungen</h2>
          <ul className="space-y-2.5">
            {ai.line_items.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-secondary/50 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
          Der ausgewiesene Preis berücksichtigt einen geschätzten Arbeitslohn sowie den voraussichtlichen Materialeinsatz auf Grundlage der angegebenen Informationen.
        </div>

        <div className="rounded-2xl gradient-primary text-primary-foreground p-5 shadow-elevated">
          <div className="flex justify-between text-sm mb-2"><span>Netto</span><span className="font-medium">{fmt(p.net_amount)}</span></div>
          <div className="flex justify-between text-sm mb-3"><span>MwSt. ({p.vat_rate}%)</span><span className="font-medium">{fmt(p.vat_amount)}</span></div>
          <div className="border-t border-white/20 pt-3 flex justify-between items-baseline">
            <span className="font-semibold">Brutto</span>
            <span className="text-2xl font-bold">{fmt(p.gross_amount)}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Kundentext</h3>
              <button onClick={copyText} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ai.customer_text}</p>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">WhatsApp-Text</h3>
              <button onClick={copyWA} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ai.whatsapp_text}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={previewPDF} disabled={busy} className="h-12">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>PDF ansehen</>}
          </Button>
          <Button onClick={downloadPDF} disabled={busy} className="h-12 gradient-primary text-primary-foreground border-0">
            <FileDown className="h-4 w-4 mr-2" /> Download
          </Button>
        </div>

        <Button onClick={save} disabled={busy || saved} variant={saved ? "secondary" : "default"} className="w-full h-12">
          {saved ? <><Check className="h-4 w-4 mr-2" /> Gespeichert</> : <><Save className="h-4 w-4 mr-2" /> Vorschlag speichern</>}
        </Button>
      </div>
    </AppShell>
  );
}
