import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight, Mic } from "lucide-react";

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

interface Rate { id: string; label: string; rate: number; is_default: boolean; }

export default function QuoteNew() {
  const nav = useNavigate();
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState({ name: "", address: "", postal_code: "", city: "" });
  const [step, setStep] = useState<"input" | "questions" | "loading">("input");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ material_markup: 15, quality_level: "standard", vat_rate: 19 });
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: hr }] = await Promise.all([
        supabase.from("user_settings").select("*").maybeSingle(),
        supabase.from("hourly_rates").select("*").order("sort_order", { ascending: true }),
      ]);
      if (s) setSettings({
        material_markup: Number(s.material_markup),
        quality_level: s.quality_level,
        vat_rate: Number(s.vat_rate),
      });
      const list: Rate[] = (hr || []).map((r: any) => ({
        id: r.id, label: r.label, rate: Number(r.rate), is_default: r.is_default,
      }));
      setRates(list);
      const def = list.find(r => r.is_default) || list[0];
      if (def) setSelectedRateId(def.id);
    })();
  }, []);

  const callAI = async (mode: "analyze" | "finalize") => {
    setLoading(true);
    try {
      const chosen = rates.find(r => r.id === selectedRateId) || rates[0];
      if (!chosen) throw new Error("Bitte zuerst Stundensätze in den Einstellungen anlegen");
      const { data, error } = await supabase.functions.invoke("generate-quote", {
        body: {
          description, answers, mode,
          hourlyRate: chosen.rate,
          rateLabel: chosen.label,
          materialMarkup: settings.material_markup,
          qualityLevel: settings.quality_level, vatRate: settings.vat_rate,
        },
      });
      if (error) throw error;
      const resp = data as AIResp;

      if (resp.needs_clarification && resp.clarifying_questions?.length && mode === "analyze") {
        setQuestions(resp.clarifying_questions);
        setStep("questions");
      } else {
        sessionStorage.setItem("currentQuote", JSON.stringify({
          description, answers, ai: resp,
          customer,
          rate: { label: chosen.label, value: chosen.rate },
        }));
        nav("/quote/result");
      }
    } catch (err: any) {
      toast.error(err.message || "Fehler bei der KI-Analyse");
    } finally { setLoading(false); }
  };

  const customerComplete =
    customer.name.trim().length > 1 &&
    customer.address.trim().length > 2 &&
    customer.postal_code.trim().length >= 4 &&
    customer.city.trim().length > 1;

  if (step === "input") {
    return (
      <AppShell title="Neuer Preisvorschlag">
        <div className="space-y-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h2 className="font-semibold">Kundendaten</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Bitte zuerst den Kundennamen und die Adresse erfassen – sie erscheinen später im Preisvorschlag.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust_name">Kundenname</Label>
                <Input id="cust_name" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="z. B. Familie Müller" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust_addr">Straße & Hausnummer</Label>
                <Input id="cust_addr" value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  placeholder="Musterstraße 12" className="h-11" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="cust_plz">PLZ</Label>
                  <Input id="cust_plz" value={customer.postal_code}
                    onChange={(e) => setCustomer({ ...customer, postal_code: e.target.value })}
                    placeholder="12345" className="h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="cust_city">Ort</Label>
                  <Input id="cust_city" value={customer.city}
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                    placeholder="Musterstadt" className="h-11" />
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
              <h2 className="font-semibold">Beschreibe die Arbeiten</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Frei formuliert – die KI strukturiert daraus professionelle Leistungsstichpunkte.
            </p>
            <Textarea
              placeholder="Beispiel: Wohnzimmer komplett renovieren, alte Tapete entfernen, Wände Q3 spachteln, Glattvlies, zweimal streichen, Decke mit streichen..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[180px] text-base resize-none"
              maxLength={4000}
            />
            <div className="flex justify-between items-center mt-2">
              <button type="button" disabled className="text-xs text-muted-foreground inline-flex items-center gap-1 opacity-60">
                <Mic className="h-3.5 w-3.5" /> Spracheingabe (bald)
              </button>
              <span className="text-xs text-muted-foreground">{description.length}/4000</span>
            </div>
          </div>

          {rates.length > 0 && (
            <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
              <Label className="text-sm font-medium mb-2 block">Stundensatz für dieses Projekt</Label>
              <Select value={selectedRateId} onValueChange={setSelectedRateId}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rates.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label} — {r.rate.toLocaleString("de-DE")} €/Std
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Standard ist vorausgewählt. Du kannst in den Einstellungen weitere Sätze pflegen.
              </p>
            </div>
          )}

          {!customerComplete && (
            <p className="text-xs text-muted-foreground text-center">
              Bitte zuerst die Kundendaten vollständig ausfüllen.
            </p>
          )}

          <Button
            onClick={() => callAI("analyze")}
            disabled={loading || description.trim().length < 10 || !customerComplete}
            className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Weiter <ArrowRight className="h-5 w-5 ml-2" /></>}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Kurze Rückfragen">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Damit der Preisvorschlag möglichst präzise wird, beantworten Sie bitte kurz folgende Fragen:
        </p>
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <Label className="text-sm font-medium mb-2 block">{q}</Label>
            <Input value={answers[q] || ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} placeholder="Ihre Antwort..." className="h-11" />
          </div>
        ))}
        <Button onClick={() => callAI("finalize")} disabled={loading}
          className="w-full h-14 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Preisvorschlag erstellen <ArrowRight className="h-5 w-5 ml-2" /></>}
        </Button>
        <Button variant="ghost" onClick={() => callAI("finalize")} disabled={loading} className="w-full">
          Ohne Antworten fortfahren
        </Button>
      </div>
    </AppShell>
  );
}
