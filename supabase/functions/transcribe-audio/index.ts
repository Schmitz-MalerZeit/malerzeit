// Speech-to-Text via Lovable AI Gateway (Gemini multimodal audio).
// Body: { audio: string (base64, no data: prefix), mimeType: string }
// Returns: { text: string }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  "Du bist ein präziser deutscher Transkriptionsassistent für Maler- und Handwerker-Diktate. " +
  "Gib AUSSCHLIESSLICH den gesprochenen Text wieder – ohne Anführungszeichen, ohne Vorrede, ohne Erklärung. " +
  "Korrigiere offensichtliche Erkennungsfehler still, behalte Fachbegriffe (Q3, Vlies, Spachtel, Dispersion, m², € etc.) bei. " +
  "Setze Satzzeichen und Absätze sinnvoll. Wenn nichts Verständliches gesagt wurde, gib einen leeren String zurück.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "audio (base64) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mt = (typeof mimeType === "string" && mimeType) || "audio/webm";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transkribiere die folgende Audioaufnahme auf Deutsch." },
              { type: "input_audio", input_audio: { data: audio, format: mt.includes("mp4") ? "mp4" : mt.includes("wav") ? "wav" : "webm" } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error", resp.status, txt);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte kurz warten." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben verbraucht. Bitte Workspace-Credits aufladen." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Transkription fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text: string = data.choices?.[0]?.message?.content?.toString().trim() ?? "";
    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
