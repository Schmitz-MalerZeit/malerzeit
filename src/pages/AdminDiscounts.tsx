import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Archive, Copy, Link2, Gift, Trash2, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

type Env = "sandbox" | "live";

interface Discount {
  id: string;                          // promotion code id (promo_...)
  code: string;
  status: "active" | "archived" | string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  duration_in_months?: number | null;
  name: string | null;
  times_used: number;
  usage_limit: number | null;
  expires_at: string | null;
  restrict_to_products?: string[] | null;
  created_at: string;
}

interface ManualGrant {
  id: string;
  user_id: string;
  email: string | null;
  price_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
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
  return { email: "", priceId: "profi_monthly", days: "30" };
}

function emptyAffiliate() {
  return {
    name: "",
    email: "",
    notes: "",
    commission_percent: "20",
    discount_code: "",
    discount_percent: "15",
    restrict_to: [] as string[],
  };
}

interface Affiliate {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  commission_percent: number;
  discount_code: string;
  paddle_discount_id: string;
  environment: string;
  archived: boolean;
  paddle_status?: string | null;
  times_used?: number;
  usage_limit?: number | null;
}

interface AffStats {
  transactions: number;
  gross_total_cents: number;
  commission_cents: number;
  commission_percent: number;
}

export default function AdminDiscounts() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [env, setEnv] = useState<Env>("sandbox");
  const [section, setSection] = useState<"codes" | "grants" | "affiliates">("codes");

  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const [grants, setGrants] = useState<ManualGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantForm, setGrantForm] = useState(emptyGrant());
  const [granting, setGranting] = useState(false);

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [affLoading, setAffLoading] = useState(false);
  const [affForm, setAffForm] = useState(emptyAffiliate());
  const [creatingAff, setCreatingAff] = useState(false);
  const [affStats, setAffStats] = useState<Record<string, AffStats | "loading">>({});

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

  const loadCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-discounts", {
      body: { action: "list", environment: env },
    });
    setLoading(false);
    if (error) { toast.error("Fehler beim Laden"); return; }
    setItems((data?.data ?? []) as Discount[]);
  };

  const loadGrants = async () => {
    setGrantsLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-grant-access", {
      body: { action: "list", environment: env },
    });
    setGrantsLoading(false);
    if (error) { toast.error("Fehler beim Laden"); return; }
    setGrants((data?.data ?? []) as ManualGrant[]);
  };

  const loadAffiliates = async () => {
    setAffLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-affiliates", {
      body: { action: "list", environment: env },
    });
    setAffLoading(false);
    if (error) { toast.error("Fehler beim Laden"); return; }
    setAffiliates((data?.data ?? []) as Affiliate[]);
    setAffStats({});
  };

  const loadAffStats = async (id: string) => {
    setAffStats(s => ({ ...s, [id]: "loading" }));
    const { data, error } = await supabase.functions.invoke("admin-affiliates", {
      body: { action: "stats", environment: env, id },
    });
    if (error || !data) {
      setAffStats(s => { const n = { ...s }; delete n[id]; return n; });
      toast.error("Statistik konnte nicht geladen werden");
      return;
    }
    setAffStats(s => ({ ...s, [id]: data as AffStats }));
  };

  const createAffiliate = async () => {
    if (!affForm.name.trim() || !affForm.discount_code.trim()) {
      toast.error("Name und Code sind Pflicht"); return;
    }
    const commission = Number(affForm.commission_percent);
    const discount = Number(affForm.discount_percent);
    if (!(commission > 0 && commission <= 100)) { toast.error("Provision 1–100%"); return; }
    if (!(discount > 0 && discount <= 100)) { toast.error("Rabatt 1–100%"); return; }
    setCreatingAff(true);
    const { data, error } = await supabase.functions.invoke("admin-affiliates", {
      body: {
        action: "create",
        environment: env,
        name: affForm.name.trim(),
        email: affForm.email.trim() || undefined,
        notes: affForm.notes.trim() || undefined,
        commission_percent: commission,
        discount_code: affForm.discount_code.trim().toUpperCase(),
        discount_percent: discount,
        restrict_to_external: affForm.restrict_to.length ? affForm.restrict_to : undefined,
      },
    });
    setCreatingAff(false);
    if (error || data?.error) {
      toast.error("Anlegen fehlgeschlagen: " + (data?.error?.detail?.error?.detail || data?.error || error?.message));
      return;
    }
    toast.success("Affiliate angelegt");
    setAffForm(emptyAffiliate());
    void loadAffiliates();
  };

  const archiveAffiliate = async (id: string) => {
    if (!confirm("Affiliate archivieren? Der Rabattcode wird ebenfalls deaktiviert.")) return;
    const { error } = await supabase.functions.invoke("admin-affiliates", {
      body: { action: "archive", environment: env, id },
    });
    if (error) return toast.error("Fehler");
    toast.success("Archiviert");
    void loadAffiliates();
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (section === "codes") void loadCodes();
    else if (section === "grants") void loadGrants();
    else void loadAffiliates();
  }, [isAdmin, env, section]);

  const submit = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      toast.error("Code und Beschreibung sind Pflicht");
      return;
    }
    const pct = Number(form.amount);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast.error("Prozentwert muss zwischen 1 und 100 liegen");
      return;
    }
    setSubmitting(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: "percentage",
      amount: String(pct),
      enabled_for_checkout: form.enabled_for_checkout,
      recur: form.recur,
    };
    if (form.recur && form.maximum_recurring_intervals)
      payload.maximum_recurring_intervals = Number(form.maximum_recurring_intervals);
    if (form.usage_limit) payload.usage_limit = Number(form.usage_limit);
    if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
    if (form.restrict_to.length > 0) {
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
    void loadCodes();
  };

  const archive = async (id: string) => {
    if (!confirm("Code wirklich archivieren?")) return;
    const { error } = await supabase.functions.invoke("admin-discounts", {
      body: { action: "archive", environment: env, payload: { id } },
    });
    if (error) return toast.error("Fehler");
    toast.success("Archiviert");
    void loadCodes();
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/pricing?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert");
  };

  const grant = async () => {
    const email = grantForm.email.trim().toLowerCase();
    const days = Number(grantForm.days);
    if (!email) { toast.error("E-Mail fehlt"); return; }
    if (!Number.isFinite(days) || days < 1) { toast.error("Tage ungültig"); return; }
    setGranting(true);
    const { data, error } = await supabase.functions.invoke("admin-grant-access", {
      body: { action: "grant", environment: env, email, priceId: grantForm.priceId, days },
    });
    setGranting(false);
    if (error || data?.error) {
      toast.error("Freischaltung fehlgeschlagen: " + (data?.error || error?.message));
      return;
    }
    toast.success(`Freigeschaltet bis ${new Date(data.current_period_end).toLocaleDateString("de-DE")}`);
    setGrantForm(emptyGrant());
    void loadGrants();
  };

  const revoke = async (id: string) => {
    if (!confirm("Gratis-Zugang wirklich widerrufen?")) return;
    const { error } = await supabase.functions.invoke("admin-grant-access", {
      body: { action: "revoke", environment: env, id },
    });
    if (error) return toast.error("Fehler");
    toast.success("Widerrufen");
    void loadGrants();
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
    <AppShell title="Verwaltung">
      <div className="space-y-6">
        <Tabs value={env} onValueChange={(v) => setEnv(v as Env)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="sandbox">Test</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={section} onValueChange={(v) => setSection(v as "codes" | "grants" | "affiliates")}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="codes">Rabattcodes</TabsTrigger>
            <TabsTrigger value="grants">Gratis-Zugang</TabsTrigger>
            <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
          </TabsList>

          {/* === RABATTCODES === */}
          <TabsContent value="codes" className="space-y-6 mt-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Neuen Code anlegen ({env === "sandbox" ? "Test" : "Live"})
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME20" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rabatt in %</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="20"
                  />
                </div>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Vorhandene Codes</h2>
                <Button variant="outline" size="sm" onClick={() => loadCodes()}>Aktualisieren</Button>
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
                          {d.duration !== "once" && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{d.duration}{d.duration_in_months ? ` ${d.duration_in_months}M` : ""}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{d.name}</p>
                        <p className="text-sm mt-1">
                          {d.percent_off != null
                            ? `${d.percent_off} %`
                            : `${((d.amount_off ?? 0) / 100).toFixed(2)} ${(d.currency ?? "eur").toUpperCase()}`}
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

          {/* === GRATIS-ZUGANG === */}
          <TabsContent value="grants" className="space-y-6 mt-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4" /> Nutzer manuell freischalten ({env === "sandbox" ? "Test" : "Live"})
              </h2>
              <p className="text-xs text-muted-foreground">
                Schaltet vollen App-Zugang ohne Bezahlung frei. Endet automatisch nach Ablauf — keine Abbuchung, kein Paddle-Checkout.
              </p>

              <div className="space-y-1.5">
                <Label>E-Mail des Nutzers</Label>
                <Input
                  type="email"
                  value={grantForm.email}
                  onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })}
                  placeholder="kunde@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tarif</Label>
                  <Select value={grantForm.priceId} onValueChange={(v) => setGrantForm({ ...grantForm, priceId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICE_OPTIONS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dauer (Tage)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={grantForm.days}
                    onChange={(e) => setGrantForm({ ...grantForm, days: e.target.value })}
                    placeholder="30"
                  />
                </div>
              </div>

              <Button onClick={grant} disabled={granting} className="w-full">
                {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gratis freischalten"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Aktive Freischaltungen</h2>
                <Button variant="outline" size="sm" onClick={() => loadGrants()}>Aktualisieren</Button>
              </div>
              {grantsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : grants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Keine manuellen Freischaltungen.</p>
              ) : (
                grants.map((g) => {
                  const end = g.current_period_end ? new Date(g.current_period_end) : null;
                  const expired = end ? end.getTime() < Date.now() : false;
                  return (
                    <div key={g.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div>
                        <p className="font-medium text-sm">{g.email ?? g.user_id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {PRICE_OPTIONS.find(p => p.id === g.price_id)?.label ?? g.price_id}
                          {end && (
                            <> · {expired ? "abgelaufen am " : "läuft bis "}{end.toLocaleDateString("de-DE")}</>
                          )}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => revoke(g.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Widerrufen
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* === AFFILIATES === */}
          <TabsContent value="affiliates" className="space-y-6 mt-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Neuen Affiliate / Influencer anlegen ({env === "sandbox" ? "Test" : "Live"})
              </h2>
              <p className="text-xs text-muted-foreground">
                Legt automatisch einen einmaligen Paddle-Rabattcode an (gilt nur beim Erstkauf, verlängert sich nicht). Du verwaltest die Provision intern – Auszahlung erfolgt manuell anhand der Statistik unten.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={affForm.name} onChange={(e) => setAffForm({ ...affForm, name: e.target.value })} placeholder="Maria Müller" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-Mail</Label>
                  <Input type="email" value={affForm.email} onChange={(e) => setAffForm({ ...affForm, email: e.target.value })} placeholder="maria@beispiel.de" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rabattcode (für Käufer) *</Label>
                  <Input value={affForm.discount_code} onChange={(e) => setAffForm({ ...affForm, discount_code: e.target.value.toUpperCase() })} placeholder="MARIA15" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rabatt für Käufer (%) *</Label>
                  <Input type="number" min={1} max={100} value={affForm.discount_percent} onChange={(e) => setAffForm({ ...affForm, discount_percent: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Provision für Affiliate (%) *</Label>
                <Input type="number" min={1} max={100} value={affForm.commission_percent} onChange={(e) => setAffForm({ ...affForm, commission_percent: e.target.value })} />
                <p className="text-xs text-muted-foreground">
                  Prozent vom Brutto-Erstkauf, den du dem Affiliate auszahlst. Wird nur intern gespeichert.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Notizen (intern)</Label>
                <Input value={affForm.notes} onChange={(e) => setAffForm({ ...affForm, notes: e.target.value })} placeholder="Instagram-Handle, Vereinbarung, IBAN …" />
              </div>

              <div className="space-y-2">
                <Label>Beschränken auf Tarife (leer = alle)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_OPTIONS.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={affForm.restrict_to.includes(p.id)}
                        onCheckedChange={(v) => {
                          setAffForm({
                            ...affForm,
                            restrict_to: v
                              ? [...affForm.restrict_to, p.id]
                              : affForm.restrict_to.filter((x) => x !== p.id),
                          });
                        }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={createAffiliate} disabled={creatingAff} className="w-full">
                {creatingAff ? <Loader2 className="h-4 w-4 animate-spin" /> : "Affiliate anlegen"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Aktive Affiliates</h2>
                <Button variant="outline" size="sm" onClick={() => loadAffiliates()}>Aktualisieren</Button>
              </div>
              {affLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : affiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Noch keine Affiliates angelegt.</p>
              ) : (
                affiliates.map((a) => {
                  const stats = affStats[a.id];
                  const link = `${window.location.origin}/pricing?code=${encodeURIComponent(a.discount_code)}`;
                  return (
                    <div key={a.id} className={`rounded-xl border border-border bg-card p-4 space-y-3 ${a.archived ? "opacity-60" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{a.name}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-secondary">{a.discount_code}</span>
                          {a.archived && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">archiviert</span>}
                        </div>
                        {a.email && <p className="text-xs text-muted-foreground mt-0.5">{a.email}</p>}
                        {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{a.notes}</p>}
                        <p className="text-sm mt-1">
                          Provision: <strong>{a.commission_percent}%</strong> · Einlösungen: <strong>{a.times_used ?? 0}</strong>
                        </p>
                      </div>

                      {stats && stats !== "loading" && (
                        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-0.5">
                          <p>Verkäufe (abgeschlossen): <strong>{stats.transactions}</strong></p>
                          <p>Brutto-Umsatz: <strong>{(stats.gross_total_cents / 100).toFixed(2)} €</strong></p>
                          <p className="text-primary">Auszuzahlende Provision: <strong>{(stats.commission_cents / 100).toFixed(2)} €</strong></p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(a.discount_code).then(() => toast.success("Code kopiert"))}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Code
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link kopiert"); }}>
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Auto-Apply-Link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => loadAffStats(a.id)} disabled={stats === "loading"}>
                          {stats === "loading"
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                          Provision berechnen
                        </Button>
                        {!a.archived && (
                          <Button size="sm" variant="outline" onClick={() => archiveAffiliate(a.id)}>
                            <Archive className="h-3.5 w-3.5 mr-1" /> Archivieren
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
