import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HourlyRate { label: string; rate: number; is_default?: boolean }
interface Body {
  description: string;
  answers?: Record<string, string>;
  materialMarkup: number;
  qualityLevel: string;
  vatRate: number;
  mode: "analyze" | "finalize";
  hourlyRates?: HourlyRate[];
}

const SYSTEM = `Du bist ein erfahrener Kalkulator für Malerbetriebe in Deutschland.
Der Nutzer liefert in seiner Beschreibung üblicherweise:
1) Arbeiten / Leistungsumfang
2) Eingesetztes Personal mit Stunden (z. B. "Maler-Geselle 12 Std", "Azubi 2. Lehrjahr 6 Std")
3) Geschätzten Materialaufwand in Euro netto

WICHTIG – Stundenlöhne & flexibles Bezeichnungs-Matching:
- Die hinterlegten Stundensätze des Nutzers werden dir im Prompt mitgegeben (Liste mit Bezeichnung + €/Std).
- Ordne jeder im Text genannten Person den passenden hinterlegten Satz zu – auch wenn der Nutzer eine andere Schreibweise, ein Synonym, eine Abkürzung, einen Tippfehler oder eine umgangssprachliche Variante verwendet (Spracheingaben sind oft unsauber!).
- Wende dabei großzügiges semantisches Fuzzy-Matching an. Beispiele für gleichwertige Begriffe:
  • "Geselle" ≈ "Maler-Geselle" ≈ "Malergeselle" ≈ "Facharbeiter" ≈ "Fachkraft"
  • "Azubi" ≈ "Lehrling" ≈ "Auszubildender" ≈ "Stift" (inkl. Lehrjahr-Angaben: "1. LJ", "erstes Lehrjahr", "2. Jahr" etc.)
  • "Helfer" ≈ "Maler-Hilfe" ≈ "Hilfskraft" ≈ "Aushilfe" ≈ "Handlanger" ≈ "Bauhelfer"
  • "Meister" ≈ "Malermeister" ≈ "Chef" ≈ "Inhaber" ≈ "Betriebsleiter"
  • "Vorarbeiter" ≈ "Polier" ≈ "Kolonnenführer"
- Achte auch auf Tippfehler / Spracherkennungs-Fehler ("Maler Hilfe" statt "Helfer", "Lerling" statt "Lehrling", "Asubi" statt "Azubi") und ordne den semantisch nächstliegenden hinterlegten Satz zu.
- Bei Lehrlingen mit Lehrjahr: nimm den hinterlegten Satz, der das Lehrjahr nennt; sonst den allgemeinen Lehrlings-/Azubi-Satz.
- Frage NIEMALS nach Stundenlöhnen / Stundensätzen – diese sind IMMER aus den hinterlegten Sätzen zu nehmen.
- Nur wenn beim besten Willen keine sinnvolle Zuordnung möglich ist (z. B. völlig fremder Beruf, der nicht in der Liste vorkommt): nutze den als Standard markierten Satz – ohne Rückfrage.
- In den line_items / im customer_text verwende konsistent die offizielle Bezeichnung aus der hinterlegten Liste (nicht die umgangssprachliche Eingabe).

Deine Aufgabe:
- Erzeuge professionelle Leistungsstichpunkte (handwerklich korrekt, z. B. "Wandflächen Q3 spachteln", "Glattvlies einarbeiten").
- Berechne den Lohnanteil als Summe aller (Stunden × zugeordneter Stundenlohn).
- Übernimm die Gesamtstunden (Summe aller Stunden) als estimated_hours.
- Übernimm die Materialkosten (netto, vor Aufschlag) als estimated_material_cost.
- Übernimm die Lohnkosten (Summe Stunden × Stundenlohn) als estimated_labor_cost.
- Wenn Stunden fehlen: schätze konservativ-realistisch.
- Rückfragen NUR zu Arbeitsumfang/Material – NIEMALS zu Stundenlöhnen. Max. 4 Rückfragen, nur wenn wirklich nötig.
- Antworten ausschließlich auf Deutsch.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const ratesList = (body.hourlyRates && body.hourlyRates.length > 0)
      ? body.hourlyRates.map(r => `- ${r.label}: ${r.rate} €/Std${r.is_default ? " (Standard)" : ""}`).join("\n")
      : "- (keine hinterlegt – nutze branchenüblichen Standard ~55 €/Std)";

    const userPrompt = `Hinterlegte Stundensätze des Betriebs (IMMER diese verwenden, niemals nachfragen):
${ratesList}

Beschreibung des Nutzers (Arbeiten, Personal mit Stunden, Materialaufwand):
${body.description}

${body.answers && Object.keys(body.answers).length > 0
  ? `Zusatzinfos:\n${Object.entries(body.answers).map(([q, a]) => `- ${q}: ${a}`).join("\n")}`
  : ""}

Materialaufschlag: ${body.materialMarkup}%
Qualitätsniveau: ${body.qualityLevel}
Modus: ${body.mode === "analyze" ? "Erstanalyse - Rückfragen NUR zu Arbeitsumfang/Material erlaubt, NIEMALS zu Stundenlöhnen" : "Finalisierung - keine Rückfragen mehr"}`;

    const tools = [{
      type: "function",
      function: {
        name: "build_quote",
        description: "Liefert strukturierte Preisorientierung oder Rückfragen.",
        parameters: {
          type: "object",
          properties: {
            needs_clarification: { type: "boolean" },
            clarifying_questions: {
              type: "array",
              items: { type: "string" },
              description: "Max 4 gezielte Rückfragen, nur wenn needs_clarification=true",
            },
            line_items: {
              type: "array",
              items: { type: "string" },
              description: "Professionelle Leistungsstichpunkte",
            },
            estimated_hours: { type: "number", description: "Summe aller Arbeitsstunden aller Personen" },
            estimated_labor_cost: { type: "number", description: "Lohnkosten netto in Euro (Summe Stunden × Stundenlohn der genannten Personen)" },
            estimated_material_cost: { type: "number", description: "Geschätzte Materialkosten netto in Euro (vor Aufschlag)" },
            customer_text: { type: "string", description: "Professioneller, kurzer, freundlicher Kundentext (3-5 Sätze)" },
            whatsapp_text: { type: "string", description: "Kurzer WhatsApp-tauglicher Text mit Stichpunkten und Preis" },
          },
          required: ["needs_clarification", "line_items", "estimated_hours", "estimated_labor_cost", "estimated_material_cost", "customer_text", "whatsapp_text"],
          additionalProperties: false,
        },
      },
    }];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        tools,
        tool_choice: { type: "function", function: { name: "build_quote" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte im Workspace aufladen." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Keine strukturierte Antwort");
    const parsed = JSON.parse(call.function.arguments);

    // Force-skip clarification in finalize mode
    if (body.mode === "finalize") parsed.needs_clarification = false;

    // Filter out any clarifying questions about hourly rates – these are always taken from settings.
    if (Array.isArray(parsed.clarifying_questions)) {
      const rateRegex = /(stundenlohn|stundensatz|stundenpreis|€\s*\/\s*std|euro pro stunde|pro stunde|stundenverrechnung)/i;
      parsed.clarifying_questions = parsed.clarifying_questions.filter(
        (q: string) => typeof q === "string" && !rateRegex.test(q)
      );
      if (parsed.clarifying_questions.length === 0) parsed.needs_clarification = false;
    }

    // Compute pricing server-side (deterministic)
    const labor = Math.round(Number(parsed.estimated_labor_cost) || 0);
    const material = Math.round((Number(parsed.estimated_material_cost) || 0) * (1 + body.materialMarkup / 100));
    const net = labor + material;
    const vat = Math.round(net * (body.vatRate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;

    return new Response(JSON.stringify({
      ...parsed,
      pricing: {
        labor_cost: labor,
        material_cost: material,
        net_amount: net,
        vat_amount: vat,
        gross_amount: gross,
        vat_rate: body.vatRate,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-quote error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
