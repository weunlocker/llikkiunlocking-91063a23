// Generate a short marketing description for an unlocking service from its name.
// Uses Lovable AI Gateway (no API key required from user).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, category } = await req.json();
    const serviceName = String(name ?? "").trim();
    if (!serviceName) {
      return new Response(JSON.stringify({ error: "name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You write short, professional product descriptions for IMEI checks and phone unlocking services on a wholesale unlocking platform.
Rules:
- Output ONLY the description text. No quotes, no headings, no markdown, no preamble.
- 1-2 sentences, max 220 characters.
- Plain, confident, customer-friendly tone.
- Mention what the service returns/does (e.g. carrier, blacklist status, iCloud removal, FRP bypass) when obvious from the name.
- Never invent prices, delivery times, or guarantees.`;

    const user = `Service name: ${serviceName}${category ? `\nCategory: ${category}` : ""}\n\nWrite the description.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    let text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (text.length > 500) text = text.slice(0, 500);

    return new Response(JSON.stringify({ description: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-describe-service error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
