import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2 } from "lucide-react";

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function Quotes() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("quotes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

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
