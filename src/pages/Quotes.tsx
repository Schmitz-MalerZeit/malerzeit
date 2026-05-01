import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2, Download, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { canExportCsv, getTier } from "@/lib/planFeatures";
import { toast } from "sonner";

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function toCsv(rows: any[]): string {
  const head = [
    "Angebot-ID","Datum","Kunde","Straße","PLZ","Ort","Telefon","E-Mail",
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
      q.customer_phone || "",
      q.customer_email || "",
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
  const nav = useNavigate();
  const [items, setItems] = useState<any[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const sub = useSubscription();
  const tier = getTier(sub);
  const csvAllowed = canExportCsv(tier);

  useEffect(() => {
    supabase.from("quotes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

  const validateForExport = (rows: any[]): { ok: boolean; incomplete: { id: string; label: string; missing: string[] }[] } => {
    const incomplete: { id: string; label: string; missing: string[] }[] = [];
    for (const q of rows) {
      const missing: string[] = [];
      if (!q.customer_address?.trim()) missing.push("Straße");
      if (!q.customer_postal_code?.trim()) missing.push("PLZ");
      if (!q.customer_city?.trim()) missing.push("Ort");
      if (missing.length) {
        incomplete.push({
          id: q.id,
          label: q.customer_name?.trim() || `Angebot vom ${new Date(q.created_at).toLocaleDateString("de-DE")}`,
          missing,
        });
      }
    }
    return { ok: incomplete.length === 0, incomplete };
  };

  const doDownload = (rows: any[]) => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angebote-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!items || items.length === 0) { toast.info("Keine Daten zum Exportieren"); return; }
    const { ok, incomplete } = validateForExport(items);
    if (ok) { doDownload(items); return; }

    // Build readable list (max 5 entries shown)
    const preview = incomplete.slice(0, 5)
      .map((i) => `• ${i.label} – fehlt: ${i.missing.join(", ")}`)
      .join("\n");
    const more = incomplete.length > 5 ? `\n…und ${incomplete.length - 5} weitere` : "";

    toast.warning(`${incomplete.length} von ${items.length} Angeboten haben unvollständige Adressen`, {
      description: preview + more,
      duration: 10000,
      action: {
        label: "Trotzdem exportieren",
        onClick: () => doDownload(items),
      },
    });
  };

  const openSavedPdf = async (q: any) => {
    if (!q.pdf_storage_path) {
      toast.info("Für diesen älteren Vorschlag wurde noch keine PDF-Datei gespeichert.");
      return;
    }
    const pendingWindow = window.open("", "_blank", "noopener,noreferrer");
    setOpeningId(q.id);
    try {
      const { data, error } = await supabase.storage
        .from("quote-pdfs")
        .createSignedUrl(q.pdf_storage_path, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error("PDF konnte nicht geöffnet werden");
      if (pendingWindow && !pendingWindow.closed) pendingWindow.location.replace(data.signedUrl);
      else window.location.href = data.signedUrl;
    } catch (e: any) {
      if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
      toast.error(e.message || "PDF konnte nicht geöffnet werden");
    } finally {
      setOpeningId(null);
    }
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
          {csvAllowed ? (
            <Button variant="outline" onClick={exportCsv} className="w-full h-11">
              <Download className="h-4 w-4 mr-2" /> Alle als CSV exportieren ({items.length})
            </Button>
          ) : (
            <button
              onClick={() => nav("/pricing")}
              className="w-full rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 text-left hover:bg-primary/10 transition-base"
            >
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">
                <strong className="text-foreground">CSV-Export</strong> ist Teil von <strong className="text-foreground">Exklusiv</strong>. Exportiere alle Angebote für Excel & Buchhaltung.
              </span>
              <span className="text-xs font-semibold text-primary">Upgrade</span>
            </button>
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
              <Button
                type="button"
                variant={q.pdf_storage_path ? "outline" : "secondary"}
                onClick={() => openSavedPdf(q)}
                disabled={openingId === q.id}
                className="mt-3 h-10 w-full"
              >
                {openingId === q.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Eye className="h-4 w-4 mr-2" /> {q.pdf_storage_path ? "PDF öffnen" : "Noch kein PDF gespeichert"}</>}
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
