import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { VoiceInput } from "@/components/VoiceInput";
import { CustomerAutocomplete, type CustomerSuggestion } from "@/components/CustomerAutocomplete";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { lookupCityForPostalCode } from "@/lib/postalLookup";
import { validateGermanAddress } from "@/lib/addressValidation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const appendText = (prev: string, add: string) =>
  prev.trim().length === 0 ? add : `${prev.replace(/\s+$/, "")}\n${add}`;

interface AIResp {
  needs_clarification: boolean;
  clarifying_questions?: string[];
  line_items: string[];
  estimated_hours: number;
  estimated_material_cost: number;
  customer_text: string;
  whatsapp_text: string;
  pricing: { labor_cost: number; material_cost: number; net_amount: number; vat_amount: number; gross_amount: number; vat_rate: number };
}

const DESCRIPTION_PLACEHOLDER = `Bitte gib die Infos strukturiert ein, z. B.:

1) Arbeiten / Leistungsumfang
   - Wohnzimmer (ca. 25 m²): Tapete entfernen, Wände Q3 spachteln, Glattvlies, 2x streichen
   - Decke mitstreichen
   - Innen / Bewohnt / normaler Zugang

2) Eingesetztes Personal & geschätzte Stunden
   - Maler-Geselle: 12 Std à 55 €
   - Lehrling 3. Lehrjahr: 8 Std à 28 €

3) Geschätzter Materialaufwand (netto, vor Aufschlag)
   - ca. 180 € (Vlies, Farbe, Spachtel, Kleinmaterial)

Je präziser deine Angaben, desto genauer die Kalkulation.`;

const DRAFT_KEY = "quoteDraft.v1";

type Draft = {
  description: string;
  customer: { name: string; project_label: string; address: string; postal_code: string; city: string; phone: string; email: string };
  answers: Record<string, string>;
  questions: string[];
  step: "input" | "questions" | "loading";
};

const loadDraft = (): Draft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      const currentRaw = localStorage.getItem("currentQuote");
      if (!currentRaw) return null;
      const current = JSON.parse(currentRaw);
      return {
        description: current?.description ?? "",
        customer: current?.customer ?? { name: "", address: "", postal_code: "", city: "", phone: "", email: "" },
        answers: current?.answers ?? {},
        questions: [],
        step: "input",
      } satisfies Draft;
    }
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    return d as Draft;
  } catch { return null; }
};

export default function QuoteNew() {
  const nav = useNavigate();
  const initial = loadDraft();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [customer, setCustomer] = useState(initial?.customer ?? { name: "", address: "", postal_code: "", city: "", phone: "", email: "" });
  const [step, setStep] = useState<"input" | "questions" | "loading">(
    initial?.step === "questions" ? "questions" : "input"
  );
  const [questions, setQuestions] = useState<string[]>(initial?.questions ?? []);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ material_markup: 15, quality_level: "standard", vat_rate: 19 });
  const [hourlyRates, setHourlyRates] = useState<{ label: string; rate: number; is_default: boolean }[]>([]);
  const [pastCustomers, setPastCustomers] = useState<CustomerSuggestion[]>([]);
  const [plzLookupBusy, setPlzLookupBusy] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressMismatch, setAddressMismatch] = useState<{
    current: { postalCode: string; city: string };
    suggested: { postalCode: string; city: string };
    reason: "plz_city_mismatch" | "street_not_in_plz";
  } | null>(null);
  const subState = useSubscription();

  // ───────── Draft autosave ─────────
  // Persist all entered data to localStorage so it survives tab suspension on
  // iOS/Android (switching to another app, screen lock, low-memory eviction).
  // Cleared explicitly when the quote is successfully sent to the result page.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        description, customer, answers, questions, step,
      } satisfies Draft));
    } catch { /* quota exceeded – ignore */ }
  }, [description, customer, answers, questions, step]);


  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: hr }, { data: q }] = await Promise.all([
        supabase.from("user_settings").select("*").maybeSingle(),
        supabase.from("hourly_rates").select("label, rate, is_default, sort_order").order("sort_order", { ascending: true }),
        supabase.from("quotes")
          .select("customer_name, customer_address, customer_postal_code, customer_city, customer_phone, customer_email, created_at")
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (s) setSettings({
        material_markup: Number(s.material_markup),
        quality_level: s.quality_level,
        vat_rate: Number(s.vat_rate),
      });
      setHourlyRates((hr || []).map((r: any) => ({
        label: r.label, rate: Number(r.rate), is_default: !!r.is_default,
      })));
      // Deduplicate past customers by name+address (most-recent kept)
      const seen = new Set<string>();
      const list: CustomerSuggestion[] = [];
      for (const row of (q || []) as any[]) {
        const name = (row.customer_name || "").trim();
        if (!name) continue;
        const key = `${name}|${row.customer_address || ""}|${row.customer_postal_code || ""}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          name,
          address: row.customer_address || "",
          postal_code: row.customer_postal_code || "",
          city: row.customer_city || "",
          phone: row.customer_phone || "",
          email: row.customer_email || "",
        });
      }
      setPastCustomers(list);
    })();
  }, []);

  // PLZ → Ort: own history first, then API fallback. Only fills city if it's empty.
  const handlePlzChange = async (val: string) => {
    setCustomer((c) => ({ ...c, postal_code: val }));
    if (!/^\d{5}$/.test(val.trim())) return;
    // Don't overwrite a manually entered city
    if (customer.city.trim().length > 0) return;
    setPlzLookupBusy(true);
    const city = await lookupCityForPostalCode(
      val,
      pastCustomers.map((c) => ({ postal_code: c.postal_code, city: c.city }))
    );
    setPlzLookupBusy(false);
    if (city) {
      setCustomer((c) => (c.city.trim().length === 0 ? { ...c, city } : c));
    }
  };

  const handleSelectCustomer = (s: CustomerSuggestion) => {
    setCustomer({
      name: s.name,
      address: s.address || "",
      postal_code: s.postal_code || "",
      city: s.city || "",
      phone: s.phone || "",
      email: s.email || "",
    });
  };

  // Soft pre-check only (UX). Actual increment happens server-side after PDF success.
  // Note: trial users (no paid plan) are allowed to generate the preview even when
  // their 3 free PDFs are used up — only the actual PDF download is blocked server-side.
  const preflightLimit = (): boolean => {
    if (subState.pdfLimit > 0 && subState.pdfUsed >= subState.pdfLimit) {
      toast.error(
        `Monatslimit erreicht (${subState.pdfUsed}/${subState.pdfLimit}). Bitte upgrade deinen Tarif.`,
        { action: { label: "Upgrade", onClick: () => nav("/pricing") } }
      );
      return false;
    }
    return true;
  };

  // Direct fetch with longer client-side patience than supabase-js default.
  // The AI call can take 20-40s; iOS Safari otherwise drops the connection.
  const invokeGenerateQuote = async (mode: "analyze" | "finalize"): Promise<AIResp> => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quote`;
    const payload = {
      description, answers, mode,
      materialMarkup: settings.material_markup,
      qualityLevel: settings.quality_level,
      vatRate: settings.vat_rate,
      hourlyRates,
    };

    const attempt = async (): Promise<AIResp> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 75_000); // 75s hard cap
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
          keepalive: false,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
        }
        return (await res.json()) as AIResp;
      } finally {
        clearTimeout(timer);
      }
    };

    // One automatic retry for transient mobile network drops ("Load failed", AbortError, TypeError).
    try {
      return await attempt();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const transient = /load failed|network|fetch|aborted|failed to fetch|timeout/i.test(msg)
        || e?.name === "AbortError" || e?.name === "TypeError";
      if (!transient) throw e;
      await new Promise((r) => setTimeout(r, 600));
      return await attempt();
    }
  };

  const callAI = async (mode: "analyze" | "finalize") => {
    if (mode === "analyze" && !preflightLimit()) return;
    setLoading(true);
    try {
      const resp = await invokeGenerateQuote(mode);

      if (resp.needs_clarification && resp.clarifying_questions?.length && mode === "analyze") {
        setQuestions(resp.clarifying_questions);
        setStep("questions");
      } else {
        localStorage.setItem("currentQuote", JSON.stringify({
          description, answers, ai: resp, customer,
        }));
        sessionStorage.removeItem("currentQuotePdf"); // invalidate old cached PDF
        nav("/quote/result");
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/load failed|failed to fetch|aborted|network/i.test(msg)) {
        toast.error("Verbindung zur KI unterbrochen. Bitte Internet prüfen und erneut versuchen.");
      } else {
        toast.error(msg || "Fehler bei der KI-Analyse");
      }
    } finally { setLoading(false); }
  };

  // Validates that street + PLZ + city are consistent (OpenPLZ).
  // On mismatch we open a confirmation dialog with the canonical correction.
  const proceedToAnalyze = async () => {
    if (validatingAddress || loading) return;
    setValidatingAddress(true);
    try {
      const result = await validateGermanAddress({
        street: customer.address,
        postalCode: customer.postal_code,
        city: customer.city,
      });
      if (result.ok === false && result.suggestion) {
        setAddressMismatch({
          current: { postalCode: customer.postal_code.trim(), city: customer.city.trim() },
          suggested: result.suggestion,
          reason: result.reason,
        });
        return;
      }
    } finally {
      setValidatingAddress(false);
    }
    callAI("analyze");
  };

  const applyAddressSuggestion = () => {
    if (!addressMismatch) return;
    setCustomer((c) => ({
      ...c,
      postal_code: addressMismatch.suggested.postalCode,
      city: addressMismatch.suggested.city,
    }));
    setAddressMismatch(null);
    // Continue automatically – the user already confirmed the correction.
    setTimeout(() => callAI("analyze"), 0);
  };

  const keepAddressAndContinue = () => {
    setAddressMismatch(null);
    callAI("analyze");
  };

  const customerComplete =
    customer.name.trim().length > 1 &&
    customer.address.trim().length > 2 &&
    customer.postal_code.trim().length >= 4 &&
    customer.city.trim().length > 1;

  const headerTitle = customer.name.trim() ? customer.name.trim() : "Neue Preisorientierung";

  if (step === "input") {
    return (
      <AppShell title={headerTitle}>
        <div className="space-y-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h2 className="font-semibold">Kundendaten</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Trage zuerst Name und Adresse ein – der Name erscheint oben als Überschrift und im PDF.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust_name">Kundenname</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomerAutocomplete
                      id="cust_name"
                      value={customer.name}
                      onChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
                      onSelectSuggestion={handleSelectCustomer}
                      suggestions={pastCustomers}
                      placeholder="z. B. Familie Müller"
                    />
                  </div>
                  <VoiceInput size="md" label="Kundenname diktieren"
                    onTranscript={(t) => setCustomer((c) => ({ ...c, name: appendText(c.name, t) }))} />
                </div>
                {pastCustomers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tipp: Tippe los – bisherige Kunden werden vorgeschlagen.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust_addr">Straße & Hausnummer</Label>
                <div className="flex gap-2">
                  <AddressAutocomplete
                    id="cust_addr"
                    value={customer.address}
                    onChange={(v) => setCustomer((c) => ({ ...c, address: v }))}
                    onSelectSuggestion={(s) => setCustomer((c) => ({
                      ...c,
                      // Address has already been updated to "<street> <houseNumber>" by the
                      // component; we only need to fill PLZ + Ort here.
                      postal_code: s.postalCode,
                      city: s.city,
                    }))}
                    placeholder="Musterstraße 12"
                  />
                  <VoiceInput size="md" label="Adresse diktieren"
                    onTranscript={(t) => setCustomer((c) => ({ ...c, address: appendText(c.address, t) }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tipp: Tippe die Straße ein – PLZ &amp; Ort werden mitvorgeschlagen.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="cust_plz">PLZ</Label>
                  <Input id="cust_plz" value={customer.postal_code} inputMode="numeric" maxLength={5}
                    onChange={(e) => handlePlzChange(e.target.value)}
                    placeholder="12345" className="h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="cust_city">
                    Ort {plzLookupBusy && <span className="text-xs text-muted-foreground font-normal">(suche…)</span>}
                  </Label>
                  <Input id="cust_city" value={customer.city}
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                    placeholder="Musterstadt" className="h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust_phone">Telefon <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="cust_phone" type="tel" value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="0170 1234567" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust_email">E-Mail <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="cust_email" type="email" value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="kunde@example.de" className="h-11" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold">Arbeiten, Stunden & Material</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Beschreibe die Arbeiten, das eingesetzte Personal mit Stunden und Stundenlohn sowie den geschätzten Materialaufwand. Daraus berechnet die KI deinen Preis.
            </p>
            <div className="rounded-xl bg-secondary/50 border border-border p-3 mb-4 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Tipp:</strong> Du kannst dein Angebot in Bereiche gliedern.
              Schreib oder sag z. B. <em>„Wohnzimmer: Decke streichen, Wände Q3. Schlafzimmer: nur Decke. Flur: Tapete entfernen."</em>
              Beim Diktieren funktioniert auch <em>„Wohnzimmer Doppelpunkt … nächster Raum Schlafzimmer Doppelpunkt …"</em>.
              Im PDF erscheinen die Bereiche dann als eigene Abschnitte.
            </div>
            <Textarea
              placeholder={DESCRIPTION_PLACEHOLDER}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[280px] text-base resize-none font-mono text-sm leading-relaxed"
              maxLength={4000}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <VoiceInput size="sm" label="Beschreibung diktieren"
                  onTranscript={(t) => setDescription((d) => appendText(d, t))} />
                <span className="text-xs text-muted-foreground">Diktieren – Text wird angehängt</span>
              </div>
              <span className="text-xs text-muted-foreground">{description.length}/4000</span>
            </div>
          </div>

          {!customerComplete && (
            <p className="text-xs text-muted-foreground text-center">
              Bitte zuerst die Kundendaten vollständig ausfüllen.
            </p>
          )}

          <Button
            onClick={proceedToAnalyze}
            disabled={loading || validatingAddress || description.trim().length < 10 || !customerComplete}
            className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base"
          >
            {loading || validatingAddress ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>Weiter <ArrowRight className="h-5 w-5 ml-2" /></>
            )}
          </Button>
        </div>

        <AlertDialog open={!!addressMismatch} onOpenChange={(o) => { if (!o) setAddressMismatch(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Adresse prüfen</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <div>
                    {addressMismatch?.reason === "plz_city_mismatch"
                      ? "PLZ und Ort passen nicht zur eingegebenen Straße."
                      : "Die Straße konnte unter dieser PLZ nicht gefunden werden."}
                  </div>
                  {addressMismatch && (
                    <>
                      <div className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground">Eingegeben</div>
                        <div className="font-medium">
                          {addressMismatch.current.postalCode} {addressMismatch.current.city || "—"}
                        </div>
                      </div>
                      {addressMismatch.suggested && (
                        <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
                          <div className="text-xs text-muted-foreground">Vorschlag (offiziell)</div>
                          <div className="font-medium">
                            {addressMismatch.suggested.postalCode} {addressMismatch.suggested.city}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAddressMismatch(null)}>Zurück & korrigieren</AlertDialogCancel>
              <AlertDialogAction onClick={keepAddressAndContinue} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                So lassen
              </AlertDialogAction>
              <AlertDialogAction onClick={applyAddressSuggestion}>
                Übernehmen & weiter
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppShell>
    );
  }

  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Damit die Preisorientierung möglichst präzise wird, beantworte bitte kurz folgende Fragen:
        </p>
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <Label className="text-sm font-medium mb-2 block">{q}</Label>
            <div className="flex gap-2">
              <Input value={answers[q] || ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} placeholder="Deine Antwort..." className="h-11 flex-1" />
              <VoiceInput size="md" label="Antwort diktieren"
                onTranscript={(t) => setAnswers((a) => ({ ...a, [q]: appendText(a[q] || "", t) }))} />
            </div>
          </div>
        ))}
        <Button onClick={() => callAI("finalize")} disabled={loading}
          className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Preisorientierung erstellen <ArrowRight className="h-5 w-5 ml-2" /></>}
        </Button>
        <Button variant="ghost" onClick={() => callAI("finalize")} disabled={loading} className="w-full">
          Ohne Antworten fortfahren
        </Button>
      </div>
    </AppShell>
  );
}
