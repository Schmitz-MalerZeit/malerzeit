import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function QuoteNew() {
  const nav = useNavigate();
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"input" | "questions" | "loading">("input");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ hourly_rate: 55, material_markup: 15, quality_level: "standard", vat_rate: 19 });

  useEffect(() => {
    supabase.from("user_settings").select("*").maybeSingle().then(({ data }) => {
      if (data) setSettings({ hourly_rate: Number(data.hourly_rate), material_markup: Number(data.material_markup), quality_level: data.quality_level, vat_rate: Number(data.vat_rate) });
    });
  }, []);

  const callAI = async (mode: "analyze" | "finalize") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote", {
        body: {
          description, answers, mode,
          hourlyRate: settings.hourly_rate, materialMarkup: settings.material_markup,
          qualityLevel: settings.quality_level, vatRate: settings.vat_rate,
        },
      });
      if (error) throw error;
      const resp = data as AIResp;

      if (resp.needs_clarification && resp.clarifying_questions?.length && mode === "analyze") {
        setQuestions(resp.clarifying_questions);
        setStep("questions");
      } else {
        // store result in sessionStorage and go to result page
        sessionStorage.setItem("currentQuote", JSON.stringify({ description, answers, ai: resp }));
        nav("/quote/result");
      }
    } catch (err: any) {
      toast.error(err.message || "Fehler bei der KI-Analyse");
    } finally { setLoading(false); }
  };

  if (step === "input") {
    return (
      <AppShell title="Neuer Preisvorschlag">
        <div className="space-y-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold">Beschreiben Sie die Arbeiten</h2>
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

          <Button
            onClick={() => callAI("analyze")}
            disabled={loading || description.trim().length < 10}
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
