// Sends notifications via the configured Telegram bots (admin + client).
// Auth: service-role JWT or admin user JWT.
//
// Payload:
//   { user_id, subject?, body|message, bot?: 'client'|'admin' }   // default 'client', sends to user's chat
//   { broadcast: 'admins', subject?, body }                       // sends to every admin chat_id via admin bot
//   { chat_id, body, bot?: 'client'|'admin' }                     // direct chat_id send
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { escapeHtml, getBotConfig, sendMessage } from "../_shared/tg.ts";

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

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let isAuthorized = token === SERVICE_KEY;
    if (!isAuthorized) {
      const { data: u } = await supabase.auth.getUser(token);
      if (u?.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin");
        if (roles?.length) isAuthorized = true;
      }
    }
    if (!isAuthorized) return json(403, { error: "Forbidden" });

    const p = await req.json();
    const subject = p.subject as string | undefined;
    let body = (p.body ?? p.message ?? p.text) as string | undefined;
    if (!body) return json(400, { error: "body required" });
    // Strip color/font markup ([[c:#hex]]..[[/c]], [[f:name]]..[[/f]]) — Telegram doesn't render it.
    body = body.replace(/\[\[\/?(?:c:[^\]]+|f:[^\]]+|c|f)\]\]/g, "");
    // format: 'plain' = bold subject + plain escaped body (no <pre> code block)
    // format: 'html'  = caller-provided HTML, sent as-is (no escaping)
    // default         = bold subject + <pre>body</pre>
    const fmt = (p.format as string | undefined) ?? "default";
    let text: string;
    if (fmt === "html") {
      text = subject ? `<b>${escapeHtml(subject)}</b>\n${body}` : body;
    } else if (fmt === "plain") {
      text = subject ? `<b>${escapeHtml(subject)}</b>\n${escapeHtml(body)}` : escapeHtml(body);
    } else {
      text = subject ? `<b>${escapeHtml(subject)}</b>\n\n<pre>${escapeHtml(body)}</pre>` : `<pre>${escapeHtml(body)}</pre>`;
    }

    const cfg = await getBotConfig(supabase);
    const results: any[] = [];

    // Broadcast to admins
    if (p.broadcast === "admins") {
      const tok = cfg?.admin_bot_token;
      const ids: string[] = (cfg?.admin_chat_ids ?? []).map(String);
      if (!tok || ids.length === 0) return json(200, { ok: true, results: [{ skipped: "no_admin_bot_or_chats" }] });
      for (const id of ids) results.push({ chat_id: id, ...(await sendMessage(tok, id, text)) });
      return json(200, { ok: true, results });
    }

    const botKind: "admin" | "client" = p.bot === "admin" ? "admin" : "client";
    const tok = botKind === "admin" ? cfg?.admin_bot_token : cfg?.client_bot_token;
    if (!tok) return json(200, { ok: false, reason: `no_${botKind}_bot_token` });

    let chatId: string | null = p.chat_id ? String(p.chat_id) : null;
    if (!chatId && p.user_id) {
      const { data: profile } = await supabase.from("profiles")
        .select("client_bot_chat_id, telegram_chat_id, notify_telegram").eq("id", p.user_id).maybeSingle();
      if (!profile) return json(200, { ok: false, reason: "no_profile" });
      if (profile.notify_telegram === false) return json(200, { ok: true, skipped: "user_disabled" });
      chatId = profile.client_bot_chat_id || profile.telegram_chat_id || null;
    }
    if (!chatId) return json(200, { ok: true, skipped: "no_chat_id" });

    const r = await sendMessage(tok, chatId, text);
    return json(200, { ok: r.ok, result: r });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
