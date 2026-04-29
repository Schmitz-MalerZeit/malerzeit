import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState({ hourly_rate: 55, material_markup: 15, quality_level: "standard", vat_rate: 19 });

  useEffect(() => {
    supabase.from("user_settings").select("*").maybeSingle().then(({ data }) => {
      if (data) setS({
        hourly_rate: Number(data.hourly_rate), material_markup: Number(data.material_markup),
        quality_level: data.quality_level, vat_rate: Number(data.vat_rate),
      });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("user_settings").update(s).eq("user_id", u.user.id);
      if (error) throw error;
      toast.success("Einstellungen gespeichert");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AppShell title="Einstellungen"><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell title="Einstellungen">
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="rate">Stundenverrechnungssatz (€ netto)</Label>
            <Input id="rate" type="number" step="1" min="0" value={s.hourly_rate}
              onChange={(e) => setS({ ...s, hourly_rate: Number(e.target.value) })} className="h-11" />
          </div>
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
        <Button onClick={save} disabled={saving} className="w-full h-12 gradient-primary text-primary-foreground border-0 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
        </Button>
      </div>
    </AppShell>
  );
}
