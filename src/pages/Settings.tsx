import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star, RefreshCw } from "lucide-react";
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/messageTemplate";
import { useTr } from "@/lib/tr";
import { FirstVisitTip } from "@/components/FirstVisitTip";

const TEST_USER_ID = "4f497125-b2e8-46af-a6ef-477dbe7a8a0c";

interface Rate {
  id?: string;
  label: string;
  rate: number;
  sort_order: number;
  is_default: boolean;
  _new?: boolean;
}

const DEFAULT_CLOSING =
  "Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.";

export default function Settings() {
  const tr = useTr();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState({
    material_markup: 15,
    quality_level: "standard",
    vat_rate: 19,
    quote_validity_days: 14,
    closing_text: DEFAULT_CLOSING,
    email_template: DEFAULT_EMAIL_TEMPLATE,
    whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
  });
  const [rates, setRates] = useState<Rate[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setCurrentUserId(userData.user?.id ?? null);
      const [{ data: settings }, { data: hr }] = await Promise.all([
        supabase.from("user_settings").select("*").maybeSingle(),
        supabase.from("hourly_rates").select("*").order("sort_order", { ascending: true }),
      ]);
      if (settings) setS({
        material_markup: Number(settings.material_markup),
        quality_level: settings.quality_level,
        vat_rate: Number(settings.vat_rate),
        quote_validity_days: Number((settings as any).quote_validity_days ?? 14),
        closing_text: (settings as any).closing_text ?? DEFAULT_CLOSING,
        email_template: (settings as any).email_template ?? DEFAULT_EMAIL_TEMPLATE,
        whatsapp_template: (settings as any).whatsapp_template ?? DEFAULT_WHATSAPP_TEMPLATE,
      });
      setRates((hr || []).map((r: any) => ({
        id: r.id, label: r.label, rate: Number(r.rate),
        sort_order: r.sort_order, is_default: r.is_default,
      })));
      setLoading(false);
    })();
  }, []);

  const resetQuota = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.rpc("reset_my_pdf_quota" as any);
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error || tr("Reset fehlgeschlagen", "Reset failed"));
      toast.success(tr("PDF-Kontingent zurückgesetzt", "PDF quota reset"));
    } catch (e: any) {
      toast.error(e.message || tr("Reset fehlgeschlagen", "Reset failed"));
    } finally {
      setResetting(false);
    }
  };

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
      if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));

      const clean = rates.filter(r => r.label.trim().length > 0);
      if (clean.length === 0) throw new Error(tr("Mindestens ein Stundensatz erforderlich", "At least one hourly rate required"));
      if (!clean.some(r => r.is_default)) clean[0].is_default = true;

      const { error: e1 } = await supabase.from("user_settings").update(s).eq("user_id", u.user.id);
      if (e1) throw e1;

      if (removed.length) {
        const { error } = await supabase.from("hourly_rates").delete().in("id", removed);
        if (error) throw error;
      }

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
      toast.success(tr("Einstellungen gespeichert", "Settings saved"));

      const { data: hr } = await supabase.from("hourly_rates").select("*").order("sort_order");
      setRates((hr || []).map((r: any) => ({
        id: r.id, label: r.label, rate: Number(r.rate),
        sort_order: r.sort_order, is_default: r.is_default,
      })));
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const title = tr("Einstellungen", "Settings");
  if (loading) return <AppShell title={title}><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell title={title}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">{tr("Stundensätze (netto)", "Hourly rates (net)")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {tr(
              "Markiere den Standard-Satz mit dem Stern. Dieser wird verwendet, wenn du keinen anderen wählst.",
              "Mark the default rate with the star. It's used when you don't pick another.",
            )}
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
                  aria-label={tr("Als Standard markieren", "Mark as default")}
                >
                  <Star className={`h-4 w-4 ${r.is_default ? "fill-current" : ""}`} />
                </button>
                <Input
                  placeholder={tr("Bezeichnung (z. B. Maler Geselle)", "Label (e.g. journeyman painter)")}
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
                  aria-label={tr("Entfernen", "Remove")}
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
            <Plus className="h-4 w-4 mr-2" /> {tr("Stundensatz hinzufügen", "Add hourly rate")}
          </Button>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="markup">{tr("Materialaufschlag (%)", "Material markup (%)")}</Label>
            <Input id="markup" type="number" step="1" min="0" value={s.material_markup}
              onChange={(e) => setS({ ...s, material_markup: Number(e.target.value) })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat">{tr("Mehrwertsteuersatz (%)", "VAT rate (%)")}</Label>
            <Input id="vat" type="number" step="1" min="0" value={s.vat_rate}
              onChange={(e) => setS({ ...s, vat_rate: Number(e.target.value) })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Qualitätsniveau", "Quality level")}</Label>
            <Select value={s.quality_level} onValueChange={(v) => setS({ ...s, quality_level: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{tr("Standard", "Standard")}</SelectItem>
                <SelectItem value="hochwertig">{tr("Hochwertig", "High quality")}</SelectItem>
                <SelectItem value="premium">{tr("Premium", "Premium")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-5">
          <div>
            <h2 className="font-semibold">{tr("Preisorientierung", "Price estimate")}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {tr(
                "Diese Angaben erscheinen unten auf jeder PDF-Preisorientierung.",
                "These details appear at the bottom of every PDF price estimate.",
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="validity">{tr("Gültigkeit des Preises (Tage)", "Price validity (days)")}</Label>
            <Input
              id="validity" type="number" step="1" min="1" max="365"
              value={s.quote_validity_days}
              onChange={(e) => setS({ ...s, quote_validity_days: Number(e.target.value) || 14 })}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Wird als „Diese Preisorientierung ist X Tage ab Angebotsdatum gültig.\" angezeigt.",
                "Shown as \"This price estimate is valid for X days from the quote date.\"",
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="closing">{tr("Abschlusssatz (PDF)", "Closing sentence (PDF)")}</Label>
            <Textarea
              id="closing" rows={3}
              value={s.closing_text}
              onChange={(e) => setS({ ...s, closing_text: e.target.value })}
              placeholder={DEFAULT_CLOSING}
            />
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Wird unter der Grußformel im PDF in kleinerer Schrift gezeigt.",
                "Shown under the closing greeting in the PDF in smaller type.",
              )}
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label htmlFor="wa_tpl">{tr("WhatsApp-Vorlage", "WhatsApp template")}</Label>
            <Textarea
              id="wa_tpl" rows={9}
              value={s.whatsapp_template}
              onChange={(e) => setS({ ...s, whatsapp_template: e.target.value })}
              placeholder={DEFAULT_WHATSAPP_TEMPLATE}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Wird beim Versenden per WhatsApp verwendet. Bitte in der Sie-Form formulieren. Verfügbare Platzhalter: ",
                "Used when sending via WhatsApp. Available placeholders: ",
              )}
              <code className="text-[10px]">{"{kunde}"}</code>,{" "}
              <code className="text-[10px]">{"{anrede}"}</code>,{" "}
              <code className="text-[10px]">{"{leistungen}"}</code>,{" "}
              <code className="text-[10px]">{"{preis}"}</code>,{" "}
              <code className="text-[10px]">{"{netto}"}</code>,{" "}
              <code className="text-[10px]">{"{mwst}"}</code>,{" "}
              <code className="text-[10px]">{"{firma}"}</code>,{" "}
              <code className="text-[10px]">{"{unterschrift}"}</code>.
            </p>
            <Button
              type="button" variant="ghost" size="sm" className="h-8 text-xs"
              onClick={() => setS({ ...s, whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE })}
            >
              {tr("Auf Standard zurücksetzen", "Reset to default")}
            </Button>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-12 gradient-primary text-primary-foreground border-0 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Speichern", "Save")}
        </Button>

        {currentUserId === TEST_USER_ID && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 space-y-3">
            <div>
              <h2 className="font-semibold text-sm">🛠️ {tr("Test-Werkzeuge", "Test tools")}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {tr(
                  "Nur für dich sichtbar. Setzt dein PDF-Kontingent zurück, damit du die App ungestört testen kannst.",
                  "Only visible to you. Resets your PDF quota so you can test the app freely.",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={resetQuota}
              disabled={resetting}
              className="w-full h-11"
            >
              {resetting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><RefreshCw className="h-4 w-4 mr-2" /> {tr("PDF-Kontingent zurücksetzen", "Reset PDF quota")}</>}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
