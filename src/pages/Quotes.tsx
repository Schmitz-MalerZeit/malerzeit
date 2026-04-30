import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const PROFI_PLUS_PRICES = new Set(["profiplus_monthly", "profiplus_yearly"]);

function toCsv(rows: any[]): string {
  const head = [
    "Angebot-ID","Datum","Kunde","Straße","PLZ","Ort",
    "Position-Nr","Position","Beschreibung (Angebot)",
    "Stunden gesamt","Material netto (€)","Netto gesamt (€)","MwSt (€)","Brutto gesamt (€)","MwSt-Satz (%)",
  ];
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const positionText = (item: any): string => {
    if (item == null) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") {
      // Try common shapes; fall back to JSON for unknown structures
      const parts = [item.title, item.name, item.description, item.text].filter(Boolean);
      if (parts.length) return parts.join(" – ");
      return JSON.stringify(item);
    }
    return String(item);
  };

  const lines = [head.join(";")];
  for (const q of rows) {
    const date = new Date(q.created_at).toLocaleDateString("de-DE");
    const desc = (q.description || "").replace(/\s+/g, " ").trim();
    const baseCols = [
      q.id,
      date,
      q.customer_name || "",
      q.customer_address || "",
      q.customer_postal_code || "",
      q.customer_city || "",
    ];
    const totalsCols = [
      q.estimated_hours ?? "",
      q.estimated_material ?? "",
      q.net_amount ?? "",
      q.vat_amount ?? "",
      q.gross_amount ?? "",
      q.vat_rate ?? "",
    ];
    const items = Array.isArray(q.line_items) ? q.line_items : [];

    if (items.length === 0) {
      lines.push([...baseCols, "", "", desc, ...totalsCols].map(esc).join(";"));
      continue;
    }
    items.forEach((item: any, idx: number) => {
      // Totals only on first row of each quote to avoid summing duplicates in Excel
      const t = idx === 0 ? totalsCols : ["", "", "", "", "", ""];
      lines.push([
        ...baseCols,
        idx + 1,
        positionText(item),
        idx === 0 ? desc : "",
        ...t,
      ].map(esc).join(";"));
    });
  }
  return "\uFEFF" + lines.join("\n"); // BOM für Excel
}


export default function Quotes() {
  const [items, setItems] = useState<any[] | null>(null);
  const sub = useSubscription();
  const isProfiPlus = !!sub.subscription && PROFI_PLUS_PRICES.has(sub.subscription.price_id);

  useEffect(() => {
    supabase.from("quotes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

  const exportCsv = () => {
    if (!items || items.length === 0) { toast.info("Keine Daten zum Exportieren"); return; }
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angebote-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Gespeicherte Vorschläge">
      {items === null && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {items && items.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Noch keine Vorschläge gespeichert.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="space-y-3">
          {isProfiPlus && (
            <Button variant="outline" onClick={exportCsv} className="w-full h-11">
              <Download className="h-4 w-4 mr-2" /> Alle als CSV exportieren ({items.length})
            </Button>
          )}
          {items.map((q) => (
            <div key={q.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
                <div className="text-base font-bold text-primary">{fmt(q.gross_amount)}</div>
              </div>
              <p className="text-sm text-foreground line-clamp-2">{q.description}</p>
              {Array.isArray(q.line_items) && q.line_items.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{q.line_items.length} Leistungspositionen</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
