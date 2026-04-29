import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  description: string;
  answers?: Record<string, string>;
  hourlyRate: number;
  materialMarkup: number;
  qualityLevel: string;
  vatRate: number;
  mode: "analyze" | "finalize";
}

const SYSTEM = `Du bist ein erfahrener Kalkulator für Malerbetriebe in Deutschland.
Du analysierst freie Beschreibungen geplanter Malerarbeiten und erzeugst:
1. Strukturierte professionelle Leistungsstichpunkte (handwerklich korrekt)
2. Eine realistische Aufwandsschätzung in Stunden und Materialkosten in Euro
3. Bei Bedarf gezielte Rückfragen, wenn wichtige Angaben fehlen (Fläche, innen/außen, Vorarbeiten, Material inkl., Erschwernisse)

Wichtig:
- Keine Fantasiepreise. Schätze Stunden und Materialkosten konservativ-realistisch.
- Stichpunkte handwerklich präzise (z.B. "Wandflächen Q3 spachteln", "Glattvlies einarbeiten").
- Rückfragen NUR wenn wirklich nötig (max. 4). Wenn genug Info da ist, keine Rückfragen.
- Antworten ausschließlich auf Deutsch.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const userPrompt = `Beschreibung der Arbeiten:
${body.description}

${body.answers && Object.keys(body.answers).length > 0
  ? `Zusatzinfos:\n${Object.entries(body.answers).map(([q, a]) => `- ${q}: ${a}`).join("\n")}`
  : ""}

Stundenverrechnungssatz: ${body.hourlyRate} €/h netto
Materialaufschlag: ${body.materialMarkup}%
Qualitätsniveau: ${body.qualityLevel}
Modus: ${body.mode === "analyze" ? "Erstanalyse - Rückfragen erlaubt" : "Finalisierung - keine Rückfragen mehr, fertige Kalkulation"}`;

    const tools = [{
      type: "function",
      function: {
        name: "build_quote",
        description: "Liefert strukturierten Preisvorschlag oder Rückfragen.",
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
            estimated_hours: { type: "number", description: "Geschätzter Arbeitsaufwand in Stunden" },
            estimated_material_cost: { type: "number", description: "Geschätzte Materialkosten netto in Euro (vor Aufschlag)" },
            customer_text: { type: "string", description: "Professioneller, kurzer, freundlicher Kundentext (3-5 Sätze)" },
            whatsapp_text: { type: "string", description: "Kurzer WhatsApp-tauglicher Text mit Stichpunkten und Preis" },
          },
          required: ["needs_clarification", "line_items", "estimated_hours", "estimated_material_cost", "customer_text", "whatsapp_text"],
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

    // Compute pricing server-side (deterministic)
    const labor = Math.round(parsed.estimated_hours * body.hourlyRate);
    const material = Math.round(parsed.estimated_material_cost * (1 + body.materialMarkup / 100));
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
