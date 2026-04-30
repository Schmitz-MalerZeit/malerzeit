import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star } from "lucide-react";


interface Rate {
  id?: string;
  label: string;
  rate: number;
  sort_order: number;
  is_default: boolean;
  _new?: boolean;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState({
    material_markup: 15,
    quality_level: "standard",
    vat_rate: 19,
    quote_validity_days: 14,
    closing_text: "Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.",
  });
  const [rates, setRates] = useState<Rate[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { data: hr }] = await Promise.all([
        supabase.from("user_settings").select("*").maybeSingle(),
        supabase.from("hourly_rates").select("*").order("sort_order", { ascending: true }),
      ]);
      if (settings) setS({
        material_markup: Number(settings.material_markup),
        quality_level: settings.quality_level,
        vat_rate: Number(settings.vat_rate),
        quote_validity_days: Number((settings as any).quote_validity_days ?? 14),
        closing_text: (settings as any).closing_text ?? "Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.",
      });
      setRates((hr || []).map((r: any) => ({
        id: r.id, label: r.label, rate: Number(r.rate),
        sort_order: r.sort_order, is_default: r.is_default,
      })));
      setLoading(false);
    })();
  }, []);

  const addRate = () => {
    setRates([...rates, {
      label: "", rate: 0,
      sort_order: (rates.at(-1)?.sort_order || 0) + 1,
      is_default: rates.length === 0, _new: true,
    }]);
  };

  const updateRate = (i: number, patch: Partial<Rate>) => {
    setRates(rates.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const removeRate = (i: number) => {
    const r = rates[i];
    if (r.id) setRemoved([...removed, r.id]);
    const next = rates.filter((_, idx) => idx !== i);
    if (r.is_default && next.length > 0) next[0].is_default = true;
    setRates(next);
  };

  const setDefault = (i: number) => {
    setRates(rates.map((r, idx) => ({ ...r, is_default: idx === i })));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");

      // Validate
      const clean = rates.filter(r => r.label.trim().length > 0);
      if (clean.length === 0) throw new Error("Mindestens ein Stundensatz erforderlich");
      if (!clean.some(r => r.is_default)) clean[0].is_default = true;

      // Settings
      const { error: e1 } = await supabase.from("user_settings").update(s).eq("user_id", u.user.id);
      if (e1) throw e1;

      // Delete removed
      if (removed.length) {
        const { error } = await supabase.from("hourly_rates").delete().in("id", removed);
        if (error) throw error;
      }

      // Upsert rates
      for (let i = 0; i < clean.length; i++) {
        const r = clean[i];
        const payload = {
          user_id: u.user.id, label: r.label.trim(), rate: r.rate,
          sort_order: i + 1, is_default: r.is_default,
        };
        if (r.id) {
          const { error } = await supabase.from("hourly_rates").update(payload).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("hourly_rates").insert(payload);
          if (error) throw error;
        }
      }
      setRemoved([]);
      toast.success("Einstellungen gespeichert");

      // Reload rates to get new IDs
      const { data: hr } = await supabase.from("hourly_rates").select("*").order("sort_order");
      setRates((hr || []).map((r: any) => ({
        id: r.id, label: r.label, rate: Number(r.rate),
        sort_order: r.sort_order, is_default: r.is_default,
      })));
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AppShell title="Einstellungen"><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell title="Einstellungen">
      <div className="space-y-5">
        {/* Stundensätze */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">Stundensätze (netto)</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Markiere den Standard-Satz mit dem Stern. Dieser wird verwendet, wenn du keinen anderen wählst.
          </p>

          <div className="space-y-2.5">
            {rates.map((r, i) => (
              <div key={r.id || `new-${i}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDefault(i)}
                  className={`shrink-0 h-10 w-10 rounded-lg border flex items-center justify-center transition-base ${
                    r.is_default ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                  aria-label="Als Standard markieren"
                >
                  <Star className={`h-4 w-4 ${r.is_default ? "fill-current" : ""}`} />
                </button>
                <Input
                  placeholder="Bezeichnung (z. B. Maler Geselle)"
                  value={r.label}
                  onChange={(e) => updateRate(i, { label: e.target.value })}
                  className="h-10 flex-1 min-w-0"
                />
                <div className="relative shrink-0 w-24">
                  <Input
                    type="number" inputMode="decimal" step="1" min="0"
                    placeholder="0"
                    value={r.rate === 0 ? "" : r.rate}
                    onChange={(e) => updateRate(i, { rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-10 pr-7 text-right"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRate(i)}
                  className="shrink-0 h-10 w-10 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 flex items-center justify-center transition-base"
                  aria-label="Entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button" variant="outline" onClick={addRate}
            className="w-full h-11 mt-4 border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" /> Stundensatz hinzufügen
          </Button>
        </div>

        {/* Allgemein */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="markup">Materialaufschlag (%)</Label>
            <Input id="markup" type="number" step="1" min="0" value={s.material_markup}
              onChange={(e) => setS({ ...s, material_markup: Number(e.target.value) })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat">Mehrwertsteuersatz (%)</Label>
            <Input id="vat" type="number" step="1" min="0" value={s.vat_rate}
              onChange={(e) => setS({ ...s, vat_rate: Number(e.target.value) })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Qualitätsniveau</Label>
            <Select value={s.quality_level} onValueChange={(v) => setS({ ...s, quality_level: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="hochwertig">Hochwertig</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preisorientierung-Texte */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-5">
          <div>
            <h2 className="font-semibold">Preisorientierung</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Diese Angaben erscheinen unten auf jeder PDF-Preisorientierung.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="validity">Gültigkeit des Preises (Tage)</Label>
            <Input
              id="validity" type="number" step="1" min="1" max="365"
              value={s.quote_validity_days}
              onChange={(e) => setS({ ...s, quote_validity_days: Number(e.target.value) || 14 })}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Wird als „Diese Preisorientierung ist X Tage ab Angebotsdatum gültig." angezeigt.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="closing">Abschlusssatz</Label>
            <Textarea
              id="closing" rows={3}
              value={s.closing_text}
              onChange={(e) => setS({ ...s, closing_text: e.target.value })}
              placeholder="Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot."
            />
            <p className="text-[11px] text-muted-foreground">
              Wird unter der Grußformel in kleinerer Schrift gezeigt.
            </p>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-12 gradient-primary text-primary-foreground border-0 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
        </Button>
      </div>
    </AppShell>
  );
}
