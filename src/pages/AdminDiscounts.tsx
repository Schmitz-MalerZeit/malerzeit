import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Archive, Copy, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

type Env = "sandbox" | "live";

interface Discount {
  id: string;
  status: string;
  description: string;
  type: "percentage" | "flat" | "flat_per_seat";
  amount: string;
  currency_code?: string | null;
  code?: string | null;
  enabled_for_checkout: boolean;
  recur: boolean;
  maximum_recurring_intervals?: number | null;
  usage_limit?: number | null;
  times_used: number;
  restrict_to?: string[] | null;
  expires_at?: string | null;
}

const PRICE_OPTIONS = [
  { id: "starter_monthly", label: "Light – monatlich" },
  { id: "starter_yearly", label: "Light – jährlich" },
  { id: "profi_monthly", label: "Profi – monatlich" },
  { id: "profi_yearly", label: "Profi – jährlich" },
  { id: "profiplus_monthly", label: "Exklusiv – monatlich" },
  { id: "profiplus_yearly", label: "Exklusiv – jährlich" },
];

function emptyForm() {
  return {
    code: "",
    description: "",
    amount: "20",
    recur: false,
    maximum_recurring_intervals: "" as string,
    usage_limit: "" as string,
    expires_at: "" as string,
    restrict_to: [] as string[],
    enabled_for_checkout: true,
  };
}

function emptyGrant() {
  return {
    email: "",
    priceId: "profi_monthly",
    days: "30",
  };
}

interface ManualGrant {
  id: string;
  user_id: string;
  email: string | null;
  price_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

export default function AdminDiscounts() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [env, setEnv] = useState<Env>("sandbox");
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-discounts", {
      body: { action: "list", environment: env },
    });
    setLoading(false);
    if (error) {
      toast.error("Fehler beim Laden");
      return;
    }
    setItems((data?.data ?? []) as Discount[]);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, env]);

  const submit = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      toast.error("Code und Beschreibung sind Pflicht");
      return;
    }
    setSubmitting(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      amount: String(form.amount).trim(),
      enabled_for_checkout: form.enabled_for_checkout,
      recur: form.recur,
    };
    if (form.type !== "percentage") payload.currency_code = form.currency_code || "EUR";
    if (form.recur && form.maximum_recurring_intervals)
      payload.maximum_recurring_intervals = Number(form.maximum_recurring_intervals);
    if (form.usage_limit) payload.usage_limit = Number(form.usage_limit);
    if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
    if (form.restrict_to.length > 0) {
      // Resolve external_id -> Paddle internal price IDs
      const resolved: string[] = [];
      for (const ext of form.restrict_to) {
        const { data } = await supabase.functions.invoke("get-paddle-price", {
          body: { priceId: ext, environment: env },
        });
        if (data?.paddleId) resolved.push(data.paddleId);
      }
      payload.restrict_to = resolved;
    }

    const { data, error } = await supabase.functions.invoke("admin-discounts", {
      body: { action: "create", environment: env, payload },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error("Anlegen fehlgeschlagen: " + (data?.error?.detail || data?.error || error?.message));
      return;
    }
    toast.success("Code angelegt");
    setForm(emptyForm());
    void load();
  };

  const archive = async (id: string) => {
    if (!confirm("Code wirklich archivieren?")) return;
    const { error } = await supabase.functions.invoke("admin-discounts", {
      body: { action: "archive", environment: env, payload: { id } },
    });
    if (error) return toast.error("Fehler");
    toast.success("Archiviert");
    void load();
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/pricing?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert");
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppShell title="Rabattcodes">
      <Tabs value={env} onValueChange={(v) => setEnv(v as Env)} className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="sandbox">Test</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
        </TabsList>

        <TabsContent value={env} className="space-y-6">
          {/* Create form */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Neuen Code anlegen ({env === "sandbox" ? "Test" : "Live"})</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME20" />
              </div>
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Prozent (%)</SelectItem>
                    <SelectItem value="flat">Fester Betrag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.type === "percentage" ? "Rabatt in %" : "Betrag (in Cent)"}</Label>
                <Input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder={form.type === "percentage" ? "20" : "500 = 5,00 €"}
                />
              </div>
              {form.type !== "percentage" && (
                <div className="space-y-1.5">
                  <Label>Währung</Label>
                  <Input value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Interne Beschreibung</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Sommerkampagne 2026" />
            </div>

            <div className="space-y-2">
              <Label>Wiederkehrend</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="recur" checked={form.recur} onCheckedChange={(v) => setForm({ ...form, recur: !!v })} />
                <label htmlFor="recur" className="text-sm">Über mehrere Abrechnungsperioden anwenden</label>
              </div>
              {form.recur && (
                <Input
                  type="number"
                  value={form.maximum_recurring_intervals}
                  onChange={(e) => setForm({ ...form, maximum_recurring_intervals: e.target.value })}
                  placeholder="Anzahl Perioden (leer = unbegrenzt)"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max. Einlösungen</Label>
                <Input
                  type="number"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                  placeholder="leer = unbegrenzt"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ablaufdatum</Label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Beschränken auf Tarife (leer = alle)</Label>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.restrict_to.includes(p.id)}
                      onCheckedChange={(v) => {
                        setForm({
                          ...form,
                          restrict_to: v
                            ? [...form.restrict_to, p.id]
                            : form.restrict_to.filter((x) => x !== p.id),
                        });
                      }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Code anlegen"}
            </Button>
          </div>

          {/* List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Vorhandene Codes</h2>
              <Button variant="outline" size="sm" onClick={() => load()}>Aktualisieren</Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Noch keine Codes.</p>
            ) : (
              items.map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-base">{d.code || "(kein Code)"}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{d.status}</span>
                        {d.recur && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">recurring</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                      <p className="text-sm mt-1">
                        {d.type === "percentage"
                          ? `${d.amount} %`
                          : `${(Number(d.amount) / 100).toFixed(2)} ${d.currency_code}`}
                        {" · "}Einlösungen: <strong>{d.times_used}</strong>{d.usage_limit ? ` / ${d.usage_limit}` : ""}
                        {d.expires_at && <> · läuft ab: {new Date(d.expires_at).toLocaleDateString("de-DE")}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.code && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(d.code!).then(() => toast.success("Code kopiert"))}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Code
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyLink(d.code!)}>
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Auto-Apply-Link
                        </Button>
                      </>
                    )}
                    {d.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => archive(d.id)}>
                        <Archive className="h-3.5 w-3.5 mr-1" /> Archivieren
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
