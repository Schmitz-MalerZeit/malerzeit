import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SectionIn { title: string; items: string[] }
interface Body {
  targetLang: "de" | "en";
  line_items?: string[];
  sections?: SectionIn[];
  closing_text?: string;
  customer_text?: string;
}

const SYSTEM = `You are a professional translator for German painter/contractor quotes.
Translate the provided strings to the requested target language.
Rules:
- Preserve professional craftsman tone and trade terminology (e.g. "Q3 spachteln" → "skim coating to Q3 finish").
- Keep room/section names natural ("Schlafzimmer" → "Bedroom", "Wohnzimmer" → "Living room", "Flur" → "Hallway", "Bad" → "Bathroom", "Küche" → "Kitchen", "Treppenhaus" → "Stairwell", "Fassade" → "Facade").
- Preserve numbers, units, measurements, currency symbols exactly.
- Do NOT add, remove or reorder items. Output array length MUST match input length.
- If a string is already in the target language, return it unchanged.
- Return ONLY through the provided tool call.`;

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
    const target = body.targetLang === "en" ? "en" : "de";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
    const sections = Array.isArray(body.sections) ? body.sections : [];
    const closing = typeof body.closing_text === "string" ? body.closing_text : "";
    const customer = typeof body.customer_text === "string" ? body.customer_text : "";

    if (lineItems.length === 0 && sections.length === 0 && !closing && !customer) {
      return new Response(JSON.stringify({ line_items: [], sections: [], closing_text: "", customer_text: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userPrompt = `Target language: ${target === "en" ? "English" : "German"}.

Input JSON:
${JSON.stringify({ line_items: lineItems, sections, closing_text: closing, customer_text: customer }, null, 2)}`;

    const tools = [{
      type: "function",
      function: {
        name: "return_translation",
        description: "Returns translated strings, preserving structure.",
        parameters: {
          type: "object",
          properties: {
            line_items: { type: "array", items: { type: "string" } },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                },
                required: ["title", "items"],
                additionalProperties: false,
              },
            },
            closing_text: { type: "string" },
            customer_text: { type: "string" },
          },
          required: ["line_items", "sections", "closing_text", "customer_text"],
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
        tool_choice: { type: "function", function: { name: "return_translation" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No structured response");
    const parsed = JSON.parse(call.function.arguments);

    // Safety: enforce input length parity for line_items, fall back to original if mismatched.
    if (!Array.isArray(parsed.line_items) || parsed.line_items.length !== lineItems.length) {
      parsed.line_items = lineItems;
    }
    if (!Array.isArray(parsed.sections) || parsed.sections.length !== sections.length) {
      parsed.sections = sections;
    } else {
      parsed.sections = parsed.sections.map((s: any, i: number) => {
        const orig = sections[i];
        const items = Array.isArray(s?.items) && s.items.length === orig.items.length ? s.items : orig.items;
        const title = typeof s?.title === "string" && s.title.trim() ? s.title : orig.title;
        return { title, items };
      });
    }
    if (typeof parsed.closing_text !== "string") parsed.closing_text = closing;
    if (typeof parsed.customer_text !== "string") parsed.customer_text = customer;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-quote error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
