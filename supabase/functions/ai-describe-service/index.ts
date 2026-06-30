// Generate a short marketing description for an unlocking service from its name.
// Supports Lovable AI Gateway or Groq via Admin Settings (site_settings.ai_provider / ai_api_key).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const system = `You write short, professional product descriptions for IMEI checks and phone unlocking services on a wholesale unlocking platform.
Rules:
- Output ONLY the description text. No quotes, no headings, no markdown, no preamble.
- 1-2 sentences, max 220 characters.
- Plain, confident, customer-friendly tone.
- Mention what the service returns/does (e.g. carrier, blacklist status, iCloud removal, FRP bypass) when obvious from the name.
- Never invent prices, delivery times, or guarantees.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated admin
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
    if (!roles?.length) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { name, category } = await req.json();
    const serviceName = String(name ?? "").trim();
    if (!serviceName) {
      return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const user = `Service name: ${serviceName}${category ? `\nCategory: ${category}` : ""}\n\nWrite the description.`;
    const messages = [{ role: "system", content: system }, { role: "user", content: user }];

    const { data: settings } = await adminClient.from("site_settings").select("ai_provider, ai_api_key").eq("id", 1).maybeSingle();
    const provider = String(settings?.ai_provider ?? "lovable").trim() || "lovable";
    const apiKey = settings?.ai_api_key ? String(settings.ai_api_key).trim() : "";

    let resp: Response;
    if (provider === "groq") {
      if (!apiKey) throw new Error("Groq API key not set in Admin Settings");
      resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages }),
      });
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      });
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("AI gateway error:", resp.status, t);
      const message =
        resp.status === 429 ? "AI is busy right now. Please try again in a moment."
        : resp.status === 401 || resp.status === 403 ? "AI key invalid or unauthorized. Check Admin Settings."
        : resp.status === 402 ? "AI credits exhausted. Please add credits or switch to Groq in Admin Settings."
        : "AI service unavailable. Please write the description manually.";
      return new Response(JSON.stringify({ error: message, code: resp.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
