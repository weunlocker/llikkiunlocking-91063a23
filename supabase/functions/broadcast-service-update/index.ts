// Broadcasts a new-service or price-change announcement:
//  1. Inserts a row in service_announcements (powers the in-app "What's New" banner).
//  2. Sends a Telegram message to every client with a linked client_bot_chat_id and notify_telegram != false.
// Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { escapeHtml, getBotConfig, sendMessage } from "../_shared/tg.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json(401, { error: "Unauthorized" });
    const { data: roles } = await supabase.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "admin");
    if (!roles?.length) return json(403, { error: "Forbidden" });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const service_id = String(body.service_id ?? "");
    const kind = String(body.kind ?? "");
    const old_price = body.old_price != null ? Number(body.old_price) : null;
    const new_price = body.new_price != null ? Number(body.new_price) : null;
    if (!service_id || !["new", "price"].includes(kind)) {
      return json(400, { error: "service_id and kind ('new'|'price') required" });
    }

    const { data: svc } = await supabase.from("services")
      .select("name, price, service_code").eq("id", service_id).maybeSingle();
    if (!svc) return json(404, { error: "Service not found" });

    const title = kind === "new"
      ? `🆕 New service available: ${svc.name}`
      : `💲 Price updated: ${svc.name}`;
    const lines: string[] = [];
    if (kind === "new") {
      lines.push(`Price: $${Number(svc.price ?? 0).toFixed(2)}`);
    } else {
      if (old_price != null) lines.push(`Old price: $${old_price.toFixed(2)}`);
      lines.push(`New price: $${Number(new_price ?? svc.price ?? 0).toFixed(2)}`);
    }
    const bodyText = lines.join("\n");

    // 1. Save announcement
    await supabase.from("service_announcements").insert({
      service_id, kind, title, body: bodyText, old_price, new_price,
    });

    // 2. Broadcast on Telegram via client bot
    const cfg = await getBotConfig(supabase);
    const tok = cfg?.client_bot_token;
    let sent = 0, skipped = 0, failed = 0;
    if (tok) {
      const text = `<b>${escapeHtml(title)}</b>\n<pre>${escapeHtml(bodyText)}</pre>`;
      // Page through subscribers
      let from = 0;
      const PAGE = 500;
      while (true) {
        const { data: subs, error } = await supabase.from("profiles")
          .select("id, client_bot_chat_id, notify_telegram")
          .not("client_bot_chat_id", "is", null)
          .neq("notify_telegram", false)
          .range(from, from + PAGE - 1);
        if (error || !subs?.length) break;
        for (const s of subs) {
          const chatId = s.client_bot_chat_id;
          if (!chatId) { skipped++; continue; }
          const r = await sendMessage(tok, chatId, text);
          if (r.ok) sent++; else failed++;
        }
        if (subs.length < PAGE) break;
        from += PAGE;
      }
    } else {
      skipped = -1; // no client bot configured
    }

    return json(200, { ok: true, sent, skipped, failed });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
