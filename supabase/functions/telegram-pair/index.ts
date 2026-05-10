// Generates a 6-digit pairing code for the calling user, returns bot username + code.
// Auth: requires logged-in user JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getBotConfig, makeServiceClient } from "../_shared/tg.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supa.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const bot_kind = body.bot_kind === "admin" ? "admin" : "client";

    const admin = makeServiceClient();

    if (bot_kind === "admin") {
      const { data: roles } = await admin.from("user_roles")
        .select("role").eq("user_id", userId).eq("role", "admin");
      if (!roles || roles.length === 0) return json(403, { error: "Forbidden" });
    }

    const cfg = await getBotConfig(admin);
    const username = bot_kind === "admin" ? cfg?.admin_bot_username : cfg?.client_bot_username;
    if (!username) return json(400, { error: `${bot_kind} bot not configured` });

    // Invalidate any unused codes for this user/bot
    await admin.from("telegram_pairings")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId).eq("bot_kind", bot_kind).is("used_at", null);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await admin.from("telegram_pairings")
      .insert({ user_id: userId, bot_kind, code, expires_at });
    if (error) return json(500, { error: error.message });

    return json(200, { code, bot_username: username.replace(/^@/, ""), expires_at });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
