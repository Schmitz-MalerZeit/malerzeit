import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HourlyRate { label: string; rate: number; is_default?: boolean }
interface SectionIn { title: string; items: string[] }
interface Body {
  description?: string;
  line_items: string[];
  sections?: SectionIn[];
  hourlyRates?: HourlyRate[];
  materialMarkup: number;
  qualityLevel?: string;
  vatRate: number;
}

const SYSTEM = `Du bist ein erfahrener Kalkulator für Malerbetriebe in Deutschland.
Der Nutzer hat eine bestehende Leistungsliste manuell ergänzt/geändert. Bewerte die GESAMTE aktuelle Liste neu (Stunden, Lohnkosten, Materialkosten netto VOR Aufschlag).

Regeln:
- Verwende AUSSCHLIESSLICH die hinterlegten Stundensätze. Niemals Rückfragen.
- Ordne jeder Leistung den passenden Lohnsatz zu (semantisches Fuzzy-Matching).
- Wenn die Liste in Räume/Bereiche gegliedert ist (sections), liefere pro Abschnitt: hours, labor_cost, material_cost. Die Summen müssen mit estimated_hours / estimated_labor_cost / estimated_material_cost übereinstimmen.
- Wenn keine sections vorliegen: liefere nur die Gesamtwerte.
- Antworten ausschließlich auf Deutsch.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await authClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    if (!Array.isArray(body.line_items) && !Array.isArray(body.sections)) {
      return new Response(JSON.stringify({ error: "Keine Positionen übergeben." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ratesList = (body.hourlyRates && body.hourlyRates.length > 0)
      ? body.hourlyRates.map(r => `- ${r.label}: ${r.rate} €/Std${r.is_default ? " (Standard)" : ""}`).join("\n")
      : "- (keine hinterlegt – nutze branchenüblichen Standard ~55 €/Std)";

    const sectionsBlock = Array.isArray(body.sections) && body.sections.length > 0
      ? body.sections.map((s, i) => `Abschnitt ${i + 1}: ${s.title}\n${s.items.map(x => `  - ${x}`).join("\n")}`).join("\n\n")
      : `Positionen (flach):\n${body.line_items.map(x => `  - ${x}`).join("\n")}`;

    const userPrompt = `Hinterlegte Stundensätze (immer verwenden):
${ratesList}

Ursprüngliche Beschreibung des Nutzers (Kontext):
${body.description || "(keine)"}

Aktuelle Leistungsliste (vom Nutzer ggf. ergänzt/geändert):
${sectionsBlock}

Materialaufschlag: ${body.materialMarkup}% (NICHT in material_cost einrechnen – netto vor Aufschlag liefern)
Qualitätsniveau: ${body.qualityLevel || "standard"}`;

    const tools = [{
      type: "function",
      function: {
        name: "recalc",
        description: "Liefert neu berechnete Stunden und Kosten.",
        parameters: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  hours: { type: "number" },
                  labor_cost: { type: "number" },
                  material_cost: { type: "number" },
                },
                required: ["title", "hours", "labor_cost", "material_cost"],
                additionalProperties: false,
              },
            },
            estimated_hours: { type: "number" },
            estimated_labor_cost: { type: "number" },
            estimated_material_cost: { type: "number" },
          },
          required: ["estimated_hours", "estimated_labor_cost", "estimated_material_cost"],
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
        tool_choice: { type: "function", function: { name: "recalc" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte kurz warten." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Keine strukturierte Antwort");
    const parsed = JSON.parse(call.function.arguments);

    const labor = Math.round(Number(parsed.estimated_labor_cost) || 0);
    const material = Math.round((Number(parsed.estimated_material_cost) || 0) * (1 + body.materialMarkup / 100));
    const net = labor + material;
    const vat = Math.round(net * (body.vatRate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;

    // Merge AI section subtotals back into incoming sections (preserve items array order from client)
    let outSections: any[] = [];
    if (Array.isArray(body.sections) && body.sections.length > 0) {
      const aiSecs: any[] = Array.isArray(parsed.sections) ? parsed.sections : [];
      outSections = body.sections.map((s, i) => {
        const ai = aiSecs[i] || aiSecs.find((x: any) =>
          typeof x?.title === "string" && x.title.trim().toLowerCase() === s.title.trim().toLowerCase()
        ) || {};
        const hours = Number(ai.hours) || 0;
        const laborRaw = Number(ai.labor_cost) || 0;
        const materialRaw = Number(ai.material_cost) || 0;
        const secLabor = Math.round(laborRaw);
        const secMaterial = Math.round(materialRaw * (1 + body.materialMarkup / 100));
        const secNet = secLabor + secMaterial;
        const secVat = Math.round(secNet * (body.vatRate / 100) * 100) / 100;
        const secGross = Math.round((secNet + secVat) * 100) / 100;
        return {
          title: s.title,
          items: s.items,
          hours,
          labor_cost: secLabor,
          material_cost: secMaterial,
          net_amount: secNet,
          vat_amount: secVat,
          gross_amount: secGross,
        };
      });
    }

    return new Response(JSON.stringify({
      sections: outSections,
      estimated_hours: Number(parsed.estimated_hours) || 0,
      estimated_labor_cost: labor,
      estimated_material_cost: Number(parsed.estimated_material_cost) || 0,
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
    console.error("recalc-quote error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
