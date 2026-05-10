// Admin-only: registers webhook URLs with Telegram for both admin and client bots,
// and sets bot commands. Uses the project's deployed function URLs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { deriveSecret, getBotConfig, makeServiceClient, tgApi } from "../_shared/tg.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supa.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return json(401, { error: "Unauthorized" });

    const admin = makeServiceClient();
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin");
    if (!roles || roles.length === 0) return json(403, { error: "Forbidden" });

    const cfg = await getBotConfig(admin);
    const base = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co");
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const fnBase = `${supaUrl}/functions/v1`;

    const results: Record<string, unknown> = {};

    for (const kind of ["admin", "client"] as const) {
      const tok = kind === "admin" ? cfg?.admin_bot_token : cfg?.client_bot_token;
      if (!tok) { results[kind] = "no_token"; continue; }
      const url = `${fnBase}/telegram-${kind}-webhook`;
      const secret = deriveSecret(tok);
      const wh = await tgApi(tok, "setWebhook", {
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
      const cmds = kind === "admin"
        ? [
            { command: "start", description: "Show admin menu" },
            { command: "stats", description: "Today's stats" },
            { command: "clients", description: "Recent clients" },
            { command: "orders", description: "Recent orders" },
            { command: "balance", description: "Lookup user balance: /balance <email>" },
          ]
        : [
            { command: "start", description: "Pair your account" },
            { command: "balance", description: "Show your balance" },
            { command: "orders", description: "Last 10 orders" },
            { command: "placeorder", description: "Place a new IMEI check" },
            { command: "status", description: "Order status: /status <imei>" },
          ];
      await tgApi(tok, "setMyCommands", { commands: cmds });
      results[kind] = wh.ok ? { ok: true, url } : { ok: false, error: wh.data };
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
