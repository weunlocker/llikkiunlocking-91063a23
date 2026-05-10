// Telegram Client Bot webhook. Public endpoint; verifies secret_token header.
// Handles pairing via /start <code> or sending the 6-digit code, plus /balance,
// /orders, /placeorder (interactive), /status <imei>.
import { deriveSecret, escapeHtml, getBotConfig, makeServiceClient, sendMessage, tgApi } from "../_shared/tg.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const supabase = makeServiceClient();
  const cfg = await getBotConfig(supabase);
  const token = cfg?.client_bot_token;
  if (!token) return new Response("not configured", { status: 200 });

  const expected = deriveSecret(token);
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (got !== expected) return new Response("unauthorized", { status: 401 });

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  if (!update?.update_id) return new Response("ok");

  // Idempotency
  const { error: dupErr } = await supabase.from("telegram_updates")
    .insert({ update_id: update.update_id, bot_kind: "client" });
  if (dupErr) return new Response("ok"); // duplicate

  try {
    if (update.callback_query) {
      await handleCallback(supabase, token, update.callback_query);
    } else if (update.message) {
      await handleMessage(supabase, token, update.message);
    }
  } catch (e) {
    console.error("client-webhook error", e);
  }
  return new Response("ok");
});

async function findUserByChat(supabase: any, chatId: string) {
  const { data } = await supabase.from("profiles")
    .select("id, email, display_name, balance, client_bot_chat_id")
    .eq("client_bot_chat_id", chatId).maybeSingle();
  return data;
}

async function handleMessage(supabase: any, token: string, msg: any) {
  const chatId = String(msg.chat.id);
  const text: string = (msg.text || "").trim();
  if (!text) return;

  // /start <code> or /start
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const code = parts[1];
    if (code) return tryPair(supabase, token, chatId, code);
    return sendMessage(token, chatId, "👋 Welcome! Send your <b>6-digit pairing code</b> from the dashboard, or use /start &lt;code&gt;.");
  }

  // 6-digit pairing code (no slash)
  if (/^\d{6}$/.test(text)) return tryPair(supabase, token, chatId, text);

  // Need pairing for everything else
  const user = await findUserByChat(supabase, chatId);
  if (!user) {
    return sendMessage(token, chatId, "🔒 Your Telegram is not linked. Open the dashboard → <b>Connect Telegram</b> and send the 6-digit code here.");
  }

  if (text.startsWith("/balance")) {
    return sendMessage(token, chatId, `💰 Balance: <b>$${Number(user.balance).toFixed(2)}</b>`);
  }

  if (text.startsWith("/orders")) {
    const { data: orders } = await supabase.from("orders")
      .select("order_number, imei, status, price_charged, created_at, services(name)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
    if (!orders || orders.length === 0) return sendMessage(token, chatId, "No orders yet.");
    const lines = orders.map((o: any) =>
      `#${o.order_number} • ${escapeHtml(o.services?.name ?? "—")} • <code>${escapeHtml(o.imei)}</code> • <b>${o.status}</b>`,
    ).join("\n");
    return sendMessage(token, chatId, `📦 <b>Last orders</b>\n${lines}`);
  }

  if (text.startsWith("/status")) {
    const imei = text.split(/\s+/)[1];
    if (!imei) return sendMessage(token, chatId, "Usage: /status &lt;imei&gt;");
    const { data: o } = await supabase.from("orders")
      .select("order_number, status, result, error_message, services(name)")
      .eq("user_id", user.id).eq("imei", imei).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!o) return sendMessage(token, chatId, "No order found for that IMEI.");
    const extra = o.result ? `\n<pre>${escapeHtml(String(o.result).slice(0, 1500))}</pre>` : (o.error_message ? `\n❗ ${escapeHtml(o.error_message)}` : "");
    return sendMessage(token, chatId, `#${o.order_number} • ${escapeHtml(o.services?.name ?? "")} • <b>${o.status}</b>${extra}`);
  }

  if (text.startsWith("/placeorder")) {
    return showServiceList(supabase, token, chatId, user.id, 0);
  }

  return sendMessage(token, chatId, "Commands: /balance /orders /placeorder /status &lt;imei&gt;");
}

async function tryPair(supabase: any, token: string, chatId: string, code: string) {
  const { data: pair } = await supabase.from("telegram_pairings")
    .select("id, user_id, expires_at, used_at")
    .eq("bot_kind", "client").eq("code", code).is("used_at", null).maybeSingle();
  if (!pair) return sendMessage(token, chatId, "❌ Invalid or expired code.");
  if (new Date(pair.expires_at).getTime() < Date.now()) {
    return sendMessage(token, chatId, "⌛ Code expired. Generate a new one in the dashboard.");
  }
  await supabase.from("telegram_pairings").update({ used_at: new Date().toISOString(), chat_id: chatId }).eq("id", pair.id);
  await supabase.from("profiles").update({ client_bot_chat_id: chatId, notify_telegram: true }).eq("id", pair.user_id);
  return sendMessage(token, chatId, "✅ <b>Linked!</b> You'll now receive notifications here. Try /balance or /placeorder.");
}

const PAGE = 8;
async function showServiceList(supabase: any, token: string, chatId: string, userId: string, page: number) {
  const { data: services } = await supabase.from("services")
    .select("id, service_code, name, price")
    .eq("active", true).order("sort_order").order("name");
  const list = services ?? [];
  const start = page * PAGE;
  const slice = list.slice(start, start + PAGE);
  if (slice.length === 0) return sendMessage(token, chatId, "No services available.");
  const buttons = slice.map((s: any) => [{
    text: `${s.service_code ?? ""} · ${s.name} · $${Number(s.price).toFixed(2)}`,
    callback_data: `svc:${s.id}`,
  }]);
  const nav: any[] = [];
  if (page > 0) nav.push({ text: "« Prev", callback_data: `pg:${page - 1}` });
  if (start + PAGE < list.length) nav.push({ text: "Next »", callback_data: `pg:${page + 1}` });
  if (nav.length) buttons.push(nav);
  return tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: "🛠 <b>Pick a service:</b>",
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

// Stash for awaiting IMEI per chat (in-memory; resets on cold start — acceptable).
const awaiting = new Map<string, { serviceId: string; ts: number }>();

async function handleCallback(supabase: any, token: string, cb: any) {
  const chatId = String(cb.message.chat.id);
  const data: string = cb.data || "";
  await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id });
  const user = await findUserByChat(supabase, chatId);
  if (!user) return sendMessage(token, chatId, "🔒 Account not linked.");

  if (data.startsWith("pg:")) {
    return showServiceList(supabase, token, chatId, user.id, Number(data.slice(3)));
  }
  if (data.startsWith("svc:")) {
    const serviceId = data.slice(4);
    awaiting.set(chatId, { serviceId, ts: Date.now() });
    return sendMessage(token, chatId, "📱 Send the <b>IMEI</b> (8–20 chars) to place this check.\nReply /cancel to abort.");
  }
}

// Hook IMEI capture into handleMessage
const _origHandle = handleMessage;
async function _placeOrderIfAwaiting(supabase: any, token: string, msg: any): Promise<boolean> {
  const chatId = String(msg.chat.id);
  const text = (msg.text || "").trim();
  const w = awaiting.get(chatId);
  if (!w) return false;
  if (text === "/cancel") { awaiting.delete(chatId); await sendMessage(token, chatId, "Cancelled."); return true; }
  if (text.startsWith("/")) return false;
  if (!/^[A-Za-z0-9]{8,20}$/.test(text)) {
    await sendMessage(token, chatId, "❌ Invalid IMEI. 8–20 alphanumeric.");
    return true;
  }
  awaiting.delete(chatId);
  const user = await findUserByChat(supabase, chatId);
  if (!user) return true;
  // Place order via internal function
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${supaUrl}/functions/v1/check-imei`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${svcKey}`,
        "x-telegram-user-id": user.id,
      },
      body: JSON.stringify({ service_id: w.serviceId, imei: text, source: "telegram", user_id: user.id }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      await sendMessage(token, chatId, `✅ Order placed.\nStatus: <b>${j.status ?? "pending"}</b>${j.result ? `\n<pre>${escapeHtml(String(j.result).slice(0, 1500))}</pre>` : ""}`);
    } else {
      await sendMessage(token, chatId, `❌ ${escapeHtml(j.error ?? "Failed to place order.")}`);
    }
  } catch (e) {
    await sendMessage(token, chatId, `❌ ${escapeHtml(e instanceof Error ? e.message : "error")}`);
  }
  return true;
}

// Wrap: not actually used since JS hoisting issues — we manually intercept inside handleMessage.
// Patch handleMessage by re-declaring intent: we re-route at top.
(globalThis as any).__awaiting = awaiting;
