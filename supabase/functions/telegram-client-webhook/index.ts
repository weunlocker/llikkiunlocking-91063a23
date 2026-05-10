// Telegram Client Bot webhook. Public endpoint; verifies secret_token header.
// Button-driven UI (reply keyboard) — no slash commands needed.
import { executeCheck } from "../_shared/check.ts";
import { deriveSecret, escapeHtml, getBotConfig, makeServiceClient, sendMessage, tgApi } from "../_shared/tg.ts";

// Per-chat conversation state.
type State =
  | { kind: "idle" }
  | { kind: "await_imei"; serviceId: string }
  | { kind: "await_status_imei" };
const state = new Map<string, State>();
const PAGE = 8;

// Button labels (used both for keyboard render and incoming text routing).
const BTN = {
  balance: "💰 Balance",
  orders: "📦 My Orders",
  place: "🛠 Place Order",
  status: "🔎 Order Status",
  help: "ℹ️ Help",
  cancel: "✖ Cancel",
} as const;

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: BTN.balance }, { text: BTN.orders }],
      [{ text: BTN.place }, { text: BTN.status }],
      [{ text: BTN.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function cancelKeyboard() {
  return {
    keyboard: [[{ text: BTN.cancel }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

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

  const { error: dupErr } = await supabase.from("telegram_updates")
    .insert({ update_id: update.update_id, bot_kind: "client" });
  if (dupErr) return new Response("ok"); // duplicate

  try {
    if (update.callback_query) await handleCallback(supabase, token, update.callback_query);
    else if (update.message) await handleMessage(supabase, token, update.message);
  } catch (e) { console.error("client-webhook error", e); }
  return new Response("ok");
});

async function findUserByChat(supabase: any, chatId: string) {
  const { data } = await supabase.from("profiles")
    .select("id, email, display_name, balance, client_bot_chat_id")
    .eq("client_bot_chat_id", chatId).maybeSingle();
  return data;
}

function sendWithMenu(token: string, chatId: string, text: string) {
  return tgApi(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    reply_markup: mainKeyboard(),
  });
}

function sendWithCancel(token: string, chatId: string, text: string) {
  return tgApi(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    reply_markup: cancelKeyboard(),
  });
}

async function handleMessage(supabase: any, token: string, msg: any) {
  const chatId = String(msg.chat.id);
  const text: string = (msg.text || "").trim();
  if (!text) return;

  // /start with optional code (deep-link from dashboard)
  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (code && /^\d{6}$/.test(code)) return tryPair(supabase, token, chatId, code);
    return sendWithMenu(token, chatId, "👋 <b>Welcome!</b>\nSend your <b>6-digit pairing code</b> from the dashboard to link your account, or use the buttons below.");
  }

  // Bare 6-digit pairing code
  if (/^\d{6}$/.test(text)) return tryPair(supabase, token, chatId, text);

  // Cancel always works
  if (text === BTN.cancel || text.toLowerCase() === "/cancel") {
    state.delete(chatId);
    return sendWithMenu(token, chatId, "Cancelled.");
  }

  // Require linked account for everything else
  const user = await findUserByChat(supabase, chatId);
  if (!user) {
    return sendMessage(token, chatId, "🔒 Your Telegram is not linked.\nOpen the dashboard → <b>Connect Telegram</b> and send the 6-digit code here.");
  }

  // Stateful flows
  const cur = state.get(chatId) ?? { kind: "idle" };
  if (cur.kind === "await_imei") {
    if (!/^[A-Za-z0-9]{8,20}$/.test(text)) {
      return sendWithCancel(token, chatId, "❌ Invalid IMEI. Send 8–20 alphanumeric characters, or tap ✖ Cancel.");
    }
    state.delete(chatId);
    await sendMessage(token, chatId, "⏳ Placing order…");
    try {
      const result = await executeCheck({ userId: user.id, serviceId: cur.serviceId, imei: text, source: "telegram" as any });
      const b: any = result.body || {};
      const ok = result.status >= 200 && result.status < 300 && !b.ERROR;
      if (ok) {
        const success = (b.SUCCESS && b.SUCCESS[0]) || {};
        const out = success.RESULT || success.result || success.MESSAGE || JSON.stringify(b).slice(0, 1500);
        return sendWithMenu(token, chatId, `✅ <b>Order placed</b>\n<pre>${escapeHtml(String(out))}</pre>`);
      }
      const err = b.ERROR?.[0]?.MESSAGE || b.error || "Failed";
      return sendWithMenu(token, chatId, `❌ ${escapeHtml(String(err))}`);
    } catch (e) {
      return sendWithMenu(token, chatId, `❌ ${escapeHtml(e instanceof Error ? e.message : "error")}`);
    }
  }
  if (cur.kind === "await_status_imei") {
    state.delete(chatId);
    return showStatus(supabase, token, chatId, user.id, text);
  }

  // Button routing (and slash aliases for power users)
  if (text === BTN.balance || text === "/balance") {
    return sendWithMenu(token, chatId, `💰 <b>Balance</b>\n$${Number(user.balance).toFixed(2)}`);
  }
  if (text === BTN.orders || text === "/orders") {
    return showOrders(supabase, token, chatId, user.id);
  }
  if (text === BTN.place || text === "/placeorder") {
    return showServiceList(supabase, token, chatId, 0);
  }
  if (text === BTN.status || text === "/status") {
    state.set(chatId, { kind: "await_status_imei" });
    return sendWithCancel(token, chatId, "🔎 Send the <b>IMEI</b> to check status.");
  }
  if (text === BTN.help || text === "/help") {
    return sendWithMenu(token, chatId,
      "Use the buttons below:\n" +
      "• 💰 Balance — your wallet\n" +
      "• 📦 My Orders — last 10\n" +
      "• 🛠 Place Order — pick a service & send IMEI\n" +
      "• 🔎 Order Status — look up by IMEI",
    );
  }

  return sendWithMenu(token, chatId, "Tap a button below 👇");
}

async function showOrders(supabase: any, token: string, chatId: string, userId: string) {
  const { data: orders } = await supabase.from("orders")
    .select("order_number, imei, status, created_at, services(name)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  if (!orders?.length) return sendWithMenu(token, chatId, "No orders yet.");
  const lines = orders.map((o: any) =>
    `#${o.order_number} • ${escapeHtml(o.services?.name ?? "—")} • <code>${escapeHtml(o.imei)}</code> • <b>${o.status}</b>`,
  ).join("\n");
  return sendWithMenu(token, chatId, `📦 <b>Last orders</b>\n${lines}`);
}

async function showStatus(supabase: any, token: string, chatId: string, userId: string, imei: string) {
  if (!/^[A-Za-z0-9]{6,30}$/.test(imei)) {
    return sendWithMenu(token, chatId, "❌ Invalid IMEI.");
  }
  const { data: o } = await supabase.from("orders")
    .select("order_number, status, result, error_message, services(name)")
    .eq("user_id", userId).eq("imei", imei).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!o) return sendWithMenu(token, chatId, "No order found for that IMEI.");
  const extra = o.result
    ? `\n<pre>${escapeHtml(String(o.result).slice(0, 1500))}</pre>`
    : (o.error_message ? `\n❗ ${escapeHtml(o.error_message)}` : "");
  return sendWithMenu(token, chatId, `#${o.order_number} • ${escapeHtml(o.services?.name ?? "")} • <b>${o.status}</b>${extra}`);
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
  return sendWithMenu(token, chatId, "✅ <b>Linked!</b> Use the buttons below to manage your account.");
}

async function showServiceList(supabase: any, token: string, chatId: string, page: number) {
  const { data: services } = await supabase.from("services")
    .select("id, service_code, name, price").eq("active", true).order("sort_order").order("name");
  const list = services ?? [];
  const start = page * PAGE;
  const slice = list.slice(start, start + PAGE);
  if (!slice.length) return sendWithMenu(token, chatId, "No services available.");
  const buttons: any[] = slice.map((s: any) => [{
    text: `${s.service_code ?? ""} · ${s.name} · $${Number(s.price).toFixed(2)}`,
    callback_data: `svc:${s.id}`,
  }]);
  const nav: any[] = [];
  if (page > 0) nav.push({ text: "« Prev", callback_data: `pg:${page - 1}` });
  if (start + PAGE < list.length) nav.push({ text: "Next »", callback_data: `pg:${page + 1}` });
  if (nav.length) buttons.push(nav);
  return tgApi(token, "sendMessage", {
    chat_id: chatId, text: "🛠 <b>Pick a service:</b>", parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleCallback(supabase: any, token: string, cb: any) {
  const chatId = String(cb.message.chat.id);
  const data: string = cb.data || "";
  await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id });
  const user = await findUserByChat(supabase, chatId);
  if (!user) return sendMessage(token, chatId, "🔒 Account not linked.");
  if (data.startsWith("pg:")) return showServiceList(supabase, token, chatId, Number(data.slice(3)));
  if (data.startsWith("svc:")) {
    state.set(chatId, { kind: "await_imei", serviceId: data.slice(4) });
    return sendWithCancel(token, chatId, "📱 Send the <b>IMEI</b> (8–20 chars), or tap ✖ Cancel.");
  }
}
