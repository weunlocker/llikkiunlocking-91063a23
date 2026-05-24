// Logs login attempts and pushes a Telegram alert to admins.
// Public endpoint (no JWT required) — login alerts run before/after sign-in.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const p = await req.json().catch(() => ({}));
    const email = (p.email ?? "").toString().slice(0, 200);
    const success = !!p.success;
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Rate limit: cap inserts per IP to 10/min, and Telegram alerts to 1/min per IP, to prevent log poisoning + alert spam.
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    let recentFromIp = 0;
    if (ip) {
      const { count } = await supabase
        .from("auth_login_events")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", oneMinAgo);
      recentFromIp = count ?? 0;
    }
    if (recentFromIp >= 10) {
      return json(429, { error: "rate_limited" });
    }

    let userId: string | null = null;
    if (email) {
      const { data: prof } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
      userId = prof?.id ?? null;
    }

    await supabase.from("auth_login_events").insert({ user_id: userId, email, ip, user_agent: userAgent, success });

    // Notify admins (debounced — skip if any alert already sent from this IP in the last minute)
    if (recentFromIp === 0) {
      const subject = success ? "✅ Login success" : "⚠️ Login FAILED";
      const body = `Email: ${email || "—"}\nIP: ${ip || "—"}\nUA: ${userAgent.slice(0, 120)}`;
      await supabase.functions.invoke("telegram-notify", { body: { broadcast: "admins", subject, body } });

      // Notify the user themselves on success (if linked)
      if (success && userId) {
        await supabase.functions.invoke("telegram-notify", {
          body: { user_id: userId, subject: "🔐 New login to your account", body: `Email: ${email || "—"}\nIP: ${ip || "—"}\nUA: ${userAgent.slice(0, 120)}` },
        });
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
