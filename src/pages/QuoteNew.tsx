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
import { useTr } from "@/lib/tr";
import { FirstVisitTip } from "@/components/FirstVisitTip";
import { AddonPurchaseDialog } from "@/components/AddonPurchaseDialog";

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

const DESCRIPTION_PLACEHOLDER_DE = `Bitte gib die Infos strukturiert ein, z. B.:

1) Arbeiten / Leistungsumfang
   - Wohnzimmer (ca. 25 m²): Tapete entfernen, Wände Q3 spachteln, Glattvlies, 2x streichen
   - Decke mitstreichen
   - Innen / Bewohnt / normaler Zugang

2) Eingesetztes Personal & geschätzte Stunden (Stundenlöhne kommen automatisch aus deinen Einstellungen)
   - Maler-Geselle: 12 Std
   - Lehrling 3. Lehrjahr: 8 Std

3) Geschätzter Materialaufwand (netto, vor Aufschlag)
   - ca. 180 € (Vlies, Farbe, Spachtel, Kleinmaterial)

Je präziser deine Angaben, desto genauer die Kalkulation.`;

const DESCRIPTION_PLACEHOLDER_EN = `Please enter the info in a structured way, e.g.:

1) Work / scope
   - Living room (approx. 25 m²): remove wallpaper, skim walls Q3, smooth fleece, 2x paint
   - Paint ceiling as well
   - Indoor / occupied / normal access

2) Crew & estimated hours (hourly rates come from your settings automatically)
   - Journeyman painter: 12 hrs
   - Apprentice (3rd year): 8 hrs

3) Estimated material cost (net, before markup)
   - approx. €180 (fleece, paint, filler, small materials)

The more precise your input, the more accurate the estimate.`;

const DRAFT_KEY = "quoteDraft.v1";

type Draft = {
  description: string;
  customer: { name: string; salutation: string; project_label: string; address: string; postal_code: string; city: string; phone: string; email: string };
  answers: Record<string, string>;
  questions: string[];
  step: "input" | "questions" | "loading";
  draftId?: string | null;
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
        customer: { name: "", salutation: "", project_label: "", address: "", postal_code: "", city: "", phone: "", email: "", ...(current?.customer ?? {}) },
        answers: current?.answers ?? {},
        questions: [],
        step: "input",
        draftId: current?.savedQuoteId ?? null,
      } satisfies Draft;
    }
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    return d as Draft;
  } catch { return null; }
};

export default function QuoteNew() {
  const tr = useTr();
  const nav = useNavigate();
  const initial = loadDraft();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [customer, setCustomer] = useState({ name: "", salutation: "", project_label: "", address: "", postal_code: "", city: "", phone: "", email: "", ...(initial?.customer ?? {}) });
  const [step, setStep] = useState<"input" | "questions" | "loading">(
    initial?.step === "questions" ? "questions" : "input"
  );
  const [questions, setQuestions] = useState<string[]>(initial?.questions ?? []);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(initial?.draftId ?? null);
  const [settings, setSettings] = useState({ material_markup: 15, quality_level: "standard", vat_rate: 19 });
  const [hourlyRates, setHourlyRates] = useState<{ label: string; rate: number; is_default: boolean }[]>([]);
  const [pastCustomers, setPastCustomers] = useState<CustomerSuggestion[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<{ id: string; name: string; address: string; postal_code: string; city: string; phone: string; email: string }[]>([]);
  const [savedObjects, setSavedObjects] = useState<{ id: string; customer_id: string; label: string; address: string; postal_code: string; city: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [plzLookupBusy, setPlzLookupBusy] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addonDialogContext, setAddonDialogContext] = useState<string | undefined>(undefined);
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
        description, customer, answers, questions, step, draftId,
      } satisfies Draft));
    } catch { /* quota exceeded – ignore */ }
  }, [description, customer, answers, questions, step, draftId]);

  // ───────── Draft DB-Speicherung ─────────
  // Speichert/aktualisiert einen Datensatz in `quotes`, sobald der Nutzer auf
  // "Weiter" tippt – auch wenn die KI-Antwort noch nicht vorliegt. Dadurch
  // taucht der Vorschlag sofort unter „Gespeicherte Vorschläge" als Entwurf
  // auf (kein PDF-Pfad → Badge „noch kein PDF erstellt").
  const persistDraft = async (ai?: AIResp): Promise<string | null> => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const payload: any = {
        user_id: u.user.id,
        description: description || null,
        customer_name: customer.name?.trim() || null,
        customer_address: customer.address?.trim() || null,
        customer_postal_code: customer.postal_code?.trim() || null,
        customer_city: customer.city?.trim() || null,
        customer_phone: customer.phone?.trim() || null,
        customer_email: customer.email?.trim() || null,
        customer_salutation: customer.salutation?.trim() || null,
        project_label: customer.project_label?.trim() || null,
        vat_rate: settings.vat_rate,
      };
      if (ai) {
        payload.line_items = Array.isArray(ai.line_items) ? ai.line_items : [];
        payload.sections = Array.isArray((ai as any).sections) ? (ai as any).sections : [];
        payload.customer_text = ai.customer_text || null;
        payload.whatsapp_text = ai.whatsapp_text || null;
        payload.estimated_hours = Number(ai.estimated_hours) || 0;
        payload.estimated_material = Number(ai.estimated_material_cost) || 0;
        payload.estimated_labor_cost = Number(ai.pricing?.labor_cost) || 0;
        payload.material_cost = Number(ai.pricing?.material_cost) || 0;
        payload.net_amount = Number(ai.pricing?.net_amount) || 0;
        payload.vat_amount = Number(ai.pricing?.vat_amount) || 0;
        payload.gross_amount = Number(ai.pricing?.gross_amount) || 0;
      }
      if (draftId) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", draftId);
        if (error) { console.warn("draft update failed", error); return draftId; }
        return draftId;
      }
      const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
      if (error || !data) { console.warn("draft insert failed", error); return null; }
      setDraftId(data.id);
      return data.id as string;
    } catch (e) {
      console.warn("persistDraft error", e);
      return null;
    }
  };


  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: hr }, { data: q }, { data: cust }, { data: objs }] = await Promise.all([
        supabase.from("user_settings").select("*").maybeSingle(),
        supabase.from("hourly_rates").select("label, rate, is_default, sort_order").order("sort_order", { ascending: true }),
        supabase.from("quotes")
          .select("customer_name, customer_address, customer_postal_code, customer_city, customer_phone, customer_email, created_at")
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("customers").select("id, name, address, postal_code, city, phone, email").order("name", { ascending: true }),
        supabase.from("customer_objects").select("id, customer_id, label, address, postal_code, city").order("sort_order", { ascending: true }),
      ]);
      if (s) setSettings({
        material_markup: Number(s.material_markup),
        quality_level: s.quality_level,
        vat_rate: Number(s.vat_rate),
      });
      setHourlyRates((hr || []).map((r: any) => ({
        label: r.label, rate: Number(r.rate), is_default: !!r.is_default,
      })));

      const savedList = ((cust as any[]) || []).map((r) => ({
        id: r.id, name: r.name || "",
        address: r.address || "", postal_code: r.postal_code || "",
        city: r.city || "", phone: r.phone || "", email: r.email || "",
      }));
      setSavedCustomers(savedList);
      setSavedObjects(((objs as any[]) || []).map((r) => ({
        id: r.id, customer_id: r.customer_id, label: r.label || "",
        address: r.address || "", postal_code: r.postal_code || "", city: r.city || "",
      })));

      // Build autocomplete list: saved customers first, then dedupe-merge past-quote customers.
      const seen = new Set<string>();
      const list: CustomerSuggestion[] = [];
      for (const sc of savedList) {
        const key = `${sc.name}|${sc.address}|${sc.postal_code}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ name: sc.name, address: sc.address, postal_code: sc.postal_code, city: sc.city, phone: sc.phone, email: sc.email });
      }
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
    setCustomer((c) => ({
      ...c,
      name: s.name,
      address: s.address || "",
      postal_code: s.postal_code || "",
      city: s.city || "",
      phone: s.phone || "",
      email: s.email || "",
    }));
    // If this matches a saved customer, remember the link so objects can be offered.
    const match = savedCustomers.find(
      (sc) => sc.name.toLowerCase() === s.name.toLowerCase()
        && (sc.address || "").toLowerCase() === (s.address || "").toLowerCase()
    ) || savedCustomers.find((sc) => sc.name.toLowerCase() === s.name.toLowerCase());
    setSelectedCustomerId(match?.id ?? null);
    setSelectedObjectId("");
  };

  // Persist customer (and object if applicable) to the customers DB so they
  // appear in the customer manager and in future autocomplete.
  const upsertCustomerAndObject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let customerId = selectedCustomerId;
      const name = customer.name.trim();
      if (!name) return;

      const basePayload = {
        user_id: user.id,
        name,
        address: customer.address.trim() || null,
        postal_code: customer.postal_code.trim() || null,
        city: customer.city.trim() || null,
        phone: customer.phone.trim() || null,
        email: customer.email.trim() || null,
        salutation: customer.salutation.trim() || null,
      };

      if (customerId) {
        await supabase.from("customers").update(basePayload).eq("id", customerId);
      } else {
        // Try to match by name + address to avoid duplicates from earlier autocomplete picks.
        const existing = savedCustomers.find(
          (sc) => sc.name.toLowerCase() === name.toLowerCase()
            && (sc.address || "").toLowerCase() === (customer.address || "").trim().toLowerCase()
        );
        if (existing) {
          customerId = existing.id;
          await supabase.from("customers").update(basePayload).eq("id", customerId);
        } else {
          const { data, error } = await supabase.from("customers").insert(basePayload).select("id").single();
          if (!error && data) customerId = data.id;
        }
      }

      const projectLabel = customer.project_label.trim();
      if (customerId && projectLabel) {
        const objs = savedObjects.filter((o) => o.customer_id === customerId);
        const sameLabel = objs.find((o) => o.label.toLowerCase() === projectLabel.toLowerCase());
        if (!sameLabel) {
          await supabase.from("customer_objects").insert({
            user_id: user.id,
            customer_id: customerId,
            label: projectLabel,
            address: customer.address.trim() || null,
            postal_code: customer.postal_code.trim() || null,
            city: customer.city.trim() || null,
          });
        }
      }
    } catch { /* never block the quote flow on this */ }
  };

  // Soft pre-check only (UX). Actual increment happens server-side after PDF success.
  // Note: trial users (no paid plan) are allowed to generate the preview even when
  // their 3 free PDFs are used up — only the actual PDF download is blocked server-side.
  const preflightLimit = (): boolean => {
    if (subState.pdfLimit > 0 && subState.pdfUsed >= subState.pdfLimit) {
      setAddonDialogContext(tr(
        `Monatslimit erreicht (${subState.pdfUsed}/${subState.pdfLimit}). Lade jetzt zusätzliche PDFs nach oder wechsle in einen größeren Tarif.`,
        `Monthly limit reached (${subState.pdfUsed}/${subState.pdfLimit}). Top up extra PDFs now or upgrade to a bigger plan.`,
      ));
      setAddonDialogOpen(true);
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
      // Sofort als Entwurf in der DB sichern – auch wenn die KI später fehlschlägt,
      // tauchen die eingegebenen Daten unter „Gespeicherte Vorschläge" auf.
      const persistedId = await persistDraft();
      const resp = await invokeGenerateQuote(mode);

      // Mit KI-Daten aktualisieren (best effort, blockiert die Navigation nicht).
      const finalId = (await persistDraft(resp)) || persistedId || draftId;

      if (resp.needs_clarification && resp.clarifying_questions?.length && mode === "analyze") {
        setQuestions(resp.clarifying_questions);
        setStep("questions");
      } else {
        localStorage.setItem("currentQuote", JSON.stringify({
          description, answers, ai: resp, customer,
          savedQuoteId: finalId || null,
        }));
        sessionStorage.removeItem("currentQuotePdf"); // invalidate old cached PDF
        // Draft-Eingabe-State zurücksetzen, damit die nächste neue
        // Preisorientierung leer startet (der DB-Datensatz bleibt erhalten).
        localStorage.removeItem(DRAFT_KEY);
        nav("/quote/result");
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/load failed|failed to fetch|aborted|network/i.test(msg)) {
        toast.error(tr("Verbindung zur KI unterbrochen. Bitte Internet prüfen und erneut versuchen.", "Connection to the AI was lost. Please check your internet and try again."));
      } else {
        toast.error(msg || tr("Fehler bei der KI-Analyse", "AI analysis failed"));
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
    upsertCustomerAndObject();
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

  const headerTitle = customer.name.trim() ? customer.name.trim() : tr("Neue Preisorientierung", "New price estimate");

  if (step === "input") {
    return (
      <AppShell title={headerTitle}>
        <FirstVisitTip
          storageKey="quoteNew"
          title={tr("Tipps zur Eingabe", "Input tips")}
        >
          <p>{tr(
            "Am schnellsten geht es per Spracheingabe – tippe auf das Mikrofon und beschreibe das Vorhaben Raum für Raum.",
            "The fastest way is voice input – tap the microphone and describe the project room by room.",
          )}</p>
          <p>{tr(
            "Nenne pro Raum: Arbeiten, Personen mit Stunden und Materialkosten in Euro netto. Stundenlöhne nicht angeben – die kommen aus deinen Einstellungen.",
            "For each room state: tasks, staff with hours and material cost in euros (net). Do not state hourly wages – those come from your settings.",
          )}</p>
          <p>{tr(
            "Kunden werden automatisch gespeichert und stehen beim nächsten Mal als Vorschlag bereit.",
            "Customers are saved automatically and appear as suggestions next time.",
          )}</p>
        </FirstVisitTip>
        <div className="space-y-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h2 className="font-semibold">{tr("Kundendaten", "Customer details")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {tr("Trage zuerst Name und Adresse ein – der Name erscheint oben als Überschrift und im PDF.", "Enter the name and address first — the name appears as the headline and in the PDF.")}
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust_salutation">
                  {tr("Anrede", "Salutation")}{" "}
                  <span className="text-muted-foreground font-normal">({tr("für die direkte Ansprache im PDF", "for the direct greeting in the PDF")})</span>
                </Label>
                <select
                  id="cust_salutation"
                  value={customer.salutation}
                  onChange={(e) => setCustomer((c) => ({ ...c, salutation: e.target.value }))}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{tr("Keine / Sehr geehrte Damen und Herren", "None / Dear Sir or Madam")}</option>
                  <option value="Herr">{tr("Herr", "Mr")}</option>
                  <option value="Frau">{tr("Frau", "Mrs")}</option>
                  <option value="Familie">{tr("Familie", "Family")}</option>
                  <option value="Eheleute">{tr("Eheleute", "Married couple")}</option>
                  <option value="Herr Dr.">Herr Dr.</option>
                  <option value="Frau Dr.">Frau Dr.</option>
                  <option value="Herr Prof.">Herr Prof.</option>
                  <option value="Frau Prof.">Frau Prof.</option>
                  <option value="Herr Prof. Dr.">Herr Prof. Dr.</option>
                  <option value="Frau Prof. Dr.">Frau Prof. Dr.</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {tr('Die Anrede wird automatisch mit dem Nachnamen des Kunden kombiniert (z. B. "Sehr geehrter Herr Schröder," oder "Liebe Familie Schmidt,").', "The salutation is automatically combined with the customer's last name in the PDF.")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust_name">{tr("Kundenname", "Customer name")}</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomerAutocomplete
                      id="cust_name"
                      value={customer.name}
                      onChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
                      onSelectSuggestion={handleSelectCustomer}
                      suggestions={pastCustomers}
                      placeholder={tr("z. B. Familie Müller", "e.g. Smith family")}
                    />
                  </div>
                  <VoiceInput size="md" label={tr("Kundenname diktieren", "Dictate customer name")}
                    onTranscript={(t) => setCustomer((c) => ({ ...c, name: appendText(c.name, t) }))} />
                </div>
                {pastCustomers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tr("Tipp: Tippe los – bisherige Kunden werden vorgeschlagen.", "Tip: start typing — past customers will be suggested.")}
                  </p>
                )}
              </div>
              {selectedCustomerId && savedObjects.some((o) => o.customer_id === selectedCustomerId) && (
                <div className="space-y-1.5">
                  <Label htmlFor="cust_obj">{tr("Gespeichertes Objekt", "Saved object")}</Label>
                  <select
                    id="cust_obj"
                    value={selectedObjectId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedObjectId(id);
                      if (!id) return;
                      const o = savedObjects.find((x) => x.id === id);
                      if (!o) return;
                      setCustomer((c) => ({
                        ...c,
                        project_label: o.label,
                        address: o.address || c.address,
                        postal_code: o.postal_code || c.postal_code,
                        city: o.city || c.city,
                      }));
                    }}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{tr("— Objekt auswählen (optional) —", "— Select object (optional) —")}</option>
                    {savedObjects.filter((o) => o.customer_id === selectedCustomerId).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cust_project">
                  {tr("Objekt / Bauvorhaben", "Property / project")} <span className="text-muted-foreground font-normal">({tr("optional", "optional")})</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cust_project"
                    value={customer.project_label}
                    onChange={(e) => setCustomer((c) => ({ ...c, project_label: e.target.value }))}
                    placeholder={tr("z. B. Mietwohnung Hauptstr. 5, WE 3. OG rechts", "e.g. rental flat Main St. 5, unit 3rd floor right")}
                    className="h-11 flex-1"
                    maxLength={200}
                  />
                  <VoiceInput size="md" label={tr("Objekt diktieren", "Dictate property")}
                    onTranscript={(t) => setCustomer((c) => ({ ...c, project_label: appendText(c.project_label, t) }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr("Für abweichende Objektadresse (z. B. vermietete Wohnung), Wohnungsnummer, Stockwerk oder Bezeichnung der Baustelle.", "For a differing property address (e.g. rented apartment), unit number, floor or site label.")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust_addr">{tr("Straße & Hausnummer", "Street & house number")}</Label>
                <div className="flex gap-2">
                  <AddressAutocomplete
                    id="cust_addr"
                    value={customer.address}
                    onChange={(v) => setCustomer((c) => ({ ...c, address: v }))}
                    onSelectSuggestion={(s) => setCustomer((c) => ({
                      ...c,
                      postal_code: s.postalCode,
                      city: s.city,
                    }))}
                    placeholder={tr("Musterstraße 12", "Sample Street 12")}
                  />
                  <VoiceInput size="md" label={tr("Adresse diktieren", "Dictate address")}
                    onTranscript={(t) => setCustomer((c) => ({ ...c, address: appendText(c.address, t) }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr("Tipp: Tippe die Straße ein – PLZ & Ort werden mitvorgeschlagen.", "Tip: type the street — postcode & city will be suggested.")}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="cust_plz">{tr("PLZ", "Postcode")}</Label>
                  <Input id="cust_plz" value={customer.postal_code} inputMode="numeric" maxLength={5}
                    onChange={(e) => handlePlzChange(e.target.value)}
                    placeholder="12345" className="h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="cust_city">
                    {tr("Ort", "City")} {plzLookupBusy && <span className="text-xs text-muted-foreground font-normal">({tr("suche…", "searching…")})</span>}
                  </Label>
                  <Input id="cust_city" value={customer.city}
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                    placeholder={tr("Musterstadt", "Sample City")} className="h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust_phone">{tr("Telefon", "Phone")} <span className="text-muted-foreground font-normal">({tr("optional", "optional")})</span></Label>
                  <Input id="cust_phone" type="tel" value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="0170 1234567" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust_email">{tr("E-Mail", "Email")} <span className="text-muted-foreground font-normal">({tr("optional", "optional")})</span></Label>
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
              <h2 className="font-semibold">{tr("Arbeiten, Stunden & Material", "Work, hours & materials")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {tr(
                "Beschreibe die Arbeiten, das eingesetzte Personal mit Stunden und den geschätzten Materialaufwand. Stundenlöhne musst du nicht angeben – die kommen automatisch aus deinen Einstellungen.",
                "Describe the work, the crew with hours and estimated material cost. You don't need to enter hourly rates – they come from your settings automatically.",
              )}
            </p>
            <div className="rounded-xl bg-secondary/50 border border-border p-3 mb-4 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{tr("Tipp:", "Tip:")}</strong> {tr("Du kannst dein Angebot in Bereiche gliedern.", "You can structure your quote into sections.")}{" "}
              {tr("Schreib oder sag z. B. ", "Write or say e.g. ")}<em>{tr("„Wohnzimmer: Decke streichen, Wände Q3. Schlafzimmer: nur Decke. Flur: Tapete entfernen.\"", "\"Living room: paint ceiling, walls Q3. Bedroom: ceiling only. Hallway: remove wallpaper.\"")}</em>{" "}
              {tr("Beim Diktieren funktioniert auch ", "When dictating, this also works: ")}<em>{tr("„Wohnzimmer Doppelpunkt … nächster Raum Schlafzimmer Doppelpunkt …\"", "\"Living room colon … next room bedroom colon …\"")}</em>.{" "}
              {tr("Im PDF erscheinen die Bereiche dann als eigene Abschnitte.", "In the PDF the sections appear as their own blocks.")}
            </div>
            <Textarea
              placeholder={tr(DESCRIPTION_PLACEHOLDER_DE, DESCRIPTION_PLACEHOLDER_EN)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[280px] text-base resize-none font-mono text-sm leading-relaxed"
              maxLength={4000}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <VoiceInput size="sm" label={tr("Beschreibung diktieren", "Dictate description")}
                  onTranscript={(t) => setDescription((d) => appendText(d, t))} />
                <span className="text-xs text-muted-foreground">{tr("Diktieren – Text wird angehängt", "Dictate — text is appended")}</span>
              </div>
              <span className="text-xs text-muted-foreground">{description.length}/4000</span>
            </div>
          </div>

          {!customerComplete && (
            <p className="text-xs text-muted-foreground text-center">
              {tr("Bitte zuerst die Kundendaten vollständig ausfüllen.", "Please complete the customer details first.")}
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
              <>{tr("Weiter", "Continue")} <ArrowRight className="h-5 w-5 ml-2" /></>
            )}
          </Button>
        </div>

        <AlertDialog open={!!addressMismatch} onOpenChange={(o) => { if (!o) setAddressMismatch(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tr("Adresse prüfen", "Check address")}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <div>
                    {addressMismatch?.reason === "plz_city_mismatch"
                      ? tr("PLZ und Ort passen nicht zur eingegebenen Straße.", "Postcode and city don't match the street entered.")
                      : tr("Die Straße konnte unter dieser PLZ nicht gefunden werden.", "The street couldn't be found under this postcode.")}
                  </div>
                  {addressMismatch && (
                    <>
                      <div className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground">{tr("Eingegeben", "Entered")}</div>
                        <div className="font-medium">
                          {addressMismatch.current.postalCode} {addressMismatch.current.city || "—"}
                        </div>
                      </div>
                      {addressMismatch.suggested && (
                        <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
                          <div className="text-xs text-muted-foreground">{tr("Vorschlag (offiziell)", "Suggestion (official)")}</div>
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
              <AlertDialogCancel onClick={() => setAddressMismatch(null)}>{tr("Zurück & korrigieren", "Back & correct")}</AlertDialogCancel>
              <AlertDialogAction onClick={keepAddressAndContinue} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                {tr("So lassen", "Keep as is")}
              </AlertDialogAction>
              <AlertDialogAction onClick={applyAddressSuggestion}>
                {tr("Übernehmen & weiter", "Apply & continue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AddonPurchaseDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} contextLine={addonDialogContext} />
      </AppShell>
    );
  }

  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setStep("input")}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← {tr("Zurück zur Eingabe (Beschreibung bearbeiten)", "Back to input (edit description)")}
        </button>
        <p className="text-sm text-muted-foreground">
          {tr("Damit die Preisorientierung möglichst präzise wird, beantworte bitte kurz folgende Fragen:", "To make the price estimate as precise as possible, please briefly answer the following questions:")}
        </p>
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <Label className="text-sm font-medium mb-2 block">{q}</Label>
            <div className="flex gap-2">
              <Input value={answers[q] || ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} placeholder={tr("Deine Antwort...", "Your answer...")} className="h-11 flex-1" />
              <VoiceInput size="md" label={tr("Antwort diktieren", "Dictate answer")}
                onTranscript={(t) => setAnswers((a) => ({ ...a, [q]: appendText(a[q] || "", t) }))} />
            </div>
          </div>
        ))}
        <Button onClick={() => callAI("finalize")} disabled={loading}
          className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{tr("Preisorientierung erstellen", "Create price estimate")} <ArrowRight className="h-5 w-5 ml-2" /></>}
        </Button>
        <Button variant="ghost" onClick={() => callAI("finalize")} disabled={loading} className="w-full">
          {tr("Ohne Antworten fortfahren", "Continue without answers")}
        </Button>
      </div>
      <AddonPurchaseDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} contextLine={addonDialogContext} />
    </AppShell>
  );
}
