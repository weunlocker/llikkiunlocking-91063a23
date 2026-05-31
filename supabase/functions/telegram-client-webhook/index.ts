// Telegram Client Bot webhook. Public endpoint; verifies secret_token header.
// Button-driven UI (reply keyboard) — no slash commands needed.
import { executeCheck } from "../_shared/check.ts";
import { deriveSecret, escapeHtml, getBotConfig, makeServiceClient, sendMessage, tgApi } from "../_shared/tg.ts";

// Per-chat conversation state (persisted in DB so it survives across edge function instances).
type State =
  | { kind: "idle" }
  | { kind: "await_imei"; serviceId: string; serviceName: string }
  | { kind: "await_status_order" };
const PAGE = 8;

async function getState(supabase: any, chatId: string): Promise<State> {
  const { data } = await supabase.from("telegram_chat_state")
    .select("state").eq("chat_id", chatId).maybeSingle();
  return (data?.state as State) ?? { kind: "idle" };
}
async function setState(supabase: any, chatId: string, s: State) {
  await supabase.from("telegram_chat_state").upsert({
    chat_id: chatId, bot_kind: "client", state: s, updated_at: new Date().toISOString(),
  }, { onConflict: "chat_id" });
}
async function clearState(supabase: any, chatId: string) {
  await supabase.from("telegram_chat_state").delete().eq("chat_id", chatId);
}

// Button labels (used both for keyboard render and incoming text routing).
const BTN = {
  balance: "Balance",
  orders: "My Orders",
  place: "Place Order",
  status: "Order Status",
  help: "Help",
  back: "Back",
  cancel: "Cancel",
} as const;

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: BTN.balance, callback_data: "menu:balance" }, { text: BTN.orders, callback_data: "menu:orders" }],
      [{ text: BTN.place, callback_data: "menu:place" }, { text: BTN.status, callback_data: "menu:status" }],
      [{ text: BTN.help, callback_data: "menu:help" }],
    ],
  };
}

function cancelKeyboard() {
  return {
    inline_keyboard: [[{ text: BTN.back, callback_data: "menu:cancel" }]],
  };
}

async function sendInlineReplacingReplyKeyboard(token: string, chatId: string, text: string, replyMarkup: Record<string, unknown>) {
  const sent = await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { remove_keyboard: true },
  });
  const messageId = (sent.data as any)?.result?.message_id;
  if (sent.ok && messageId) {
    const edited = await tgApi(token, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
    if (!edited.ok) {
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: BTN.back,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      });
    }
  }
  return sent;
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
  return sendInlineReplacingReplyKeyboard(token, chatId, text, mainKeyboard());
}

function sendWithCancel(token: string, chatId: string, text: string) {
  return sendInlineReplacingReplyKeyboard(token, chatId, text, cancelKeyboard());
}

async function handleMessage(supabase: any, token: string, msg: any) {
  const chatId = String(msg.chat.id);
  const text: string = (msg.text || "").trim();
  if (!text) return;

  // /start with optional code (deep-link from dashboard)
  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (code && /^\d{6}$/.test(code)) return tryPair(supabase, token, chatId, code);
    return sendWithMenu(token, chatId, "Welcome. Send your 6-digit pairing code from the dashboard to link your account, or use the buttons below.");
  }

  // Bare 6-digit pairing code
  if (/^\d{6}$/.test(text)) return tryPair(supabase, token, chatId, text);

  // Cancel always works
  if (text === BTN.cancel || text.toLowerCase() === "/cancel") {
    await clearState(supabase, chatId);
    return sendWithMenu(token, chatId, "Cancelled.");
  }

  // Require linked account for everything else
  const user = await findUserByChat(supabase, chatId);
  if (!user) {
    return sendMessage(token, chatId, "Your Telegram is not linked. Open the dashboard, choose Connect Telegram, and send the 6-digit code here.");
  }

  // Stateful flows
  const cur = await getState(supabase, chatId);
  if (cur.kind === "await_imei") {
    if (!/^[A-Za-z0-9]{8,20}$/.test(text)) {
      return sendWithCancel(token, chatId, "Invalid IMEI. Send 8–20 alphanumeric characters, or tap Cancel.");
    }
    await clearState(supabase, chatId);
    try {
      // executeCheck dispatches the formatted result/failure notification to this chat,
      // so we don't send any extra message from the webhook to avoid duplicates.
      await executeCheck({ userId: user.id, serviceId: cur.serviceId, imei: text, source: "telegram" as any });
    } catch (e) {
      await sendWithMenu(token, chatId, `Order Failed\n${escapeHtml(cur.serviceName)}\nIMEI: ${escapeHtml(text)}\n${escapeHtml(e instanceof Error ? e.message : "error")}`);
    }
    return;
  }
  if (cur.kind === "await_status_order") {
    await clearState(supabase, chatId);
    return showStatus(supabase, token, chatId, user.id, text);
  }

  // Button routing (and slash aliases for power users)
  if (text === BTN.balance || text === "/balance") {
    return sendWithMenu(token, chatId, `Balance\n$${Number(user.balance).toFixed(2)}`);
  }
  if (text === BTN.orders || text === "/orders") {
    return showOrders(supabase, token, chatId, user.id);
  }
  if (text === BTN.place || text === "/placeorder") {
    return showServiceList(supabase, token, chatId, 0);
  }
  if (text === BTN.status || text === "/status") {
    await setState(supabase, chatId, { kind: "await_status_order" });
    return sendWithCancel(token, chatId, "Send the Order ID to check status.");
  }
  if (text === BTN.help || text === "/help") {
    return sendWithMenu(token, chatId,
      "Use the buttons below:\n" +
      "Balance — your wallet\n" +
      "My Orders — last 10\n" +
      "Place Order — pick a service and send IMEI\n" +
      "Order Status — look up by Order ID",
    );
  }

  return sendWithMenu(token, chatId, "Tap a button below.");
}

async function showOrders(supabase: any, token: string, chatId: string, userId: string) {
  const { data: orders } = await supabase.from("orders")
    .select("order_number, imei, status, created_at, services(name)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  if (!orders?.length) return sendWithMenu(token, chatId, "No orders yet.");
  const lines = orders.map((o: any) =>
    `Order ID: ${o.order_number}\n${escapeHtml(o.services?.name ?? "—")}\nIMEI: ${escapeHtml(o.imei)}\nStatus: ${o.status}`,
  ).join("\n\n");
  return sendWithMenu(token, chatId, `Last orders\n\n${lines}`);
}

async function showStatus(supabase: any, token: string, chatId: string, userId: string, input: string) {
  const orderNumber = input.replace(/^#/, "").trim();
  if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber)) {
    return sendWithMenu(token, chatId, "Invalid Order ID.");
  }
  const { data: o } = await supabase.from("orders")
    .select("order_number, imei, status, result, error_message, services(name)")
    .eq("user_id", userId).eq("order_number", orderNumber).maybeSingle();
  if (!o) return sendWithMenu(token, chatId, "No order found for that Order ID.");
  const extra = o.result
    ? `\n\n${escapeHtml(String(o.result).slice(0, 1500))}`
    : (o.error_message ? `\n\n${escapeHtml(o.error_message)}` : "");
  return sendWithMenu(token, chatId, `Order ID: ${o.order_number}\n${escapeHtml(o.services?.name ?? "")}\nIMEI: ${escapeHtml(o.imei ?? "")}\nStatus: ${o.status}${extra}`);
}

async function tryPair(supabase: any, token: string, chatId: string, code: string) {
  const { data: pair } = await supabase.from("telegram_pairings")
    .select("id, user_id, expires_at, used_at")
    .eq("bot_kind", "client").eq("code", code).is("used_at", null).maybeSingle();
  if (!pair) return sendMessage(token, chatId, "Invalid or expired code.");
  if (new Date(pair.expires_at).getTime() < Date.now()) {
    return sendMessage(token, chatId, "Code expired. Generate a new one in the dashboard.");
  }
  await supabase.from("telegram_pairings").update({ used_at: new Date().toISOString(), chat_id: chatId }).eq("id", pair.id);
  await supabase.from("profiles").update({ client_bot_chat_id: chatId, notify_telegram: true }).eq("id", pair.user_id);
  return sendWithMenu(token, chatId, "Linked. Use the buttons below to manage your account.");
}

async function showServiceList(supabase: any, token: string, chatId: string, page: number) {
  const { data: services } = await supabase.from("services")
    .select("id, name").eq("active", true).order("sort_order").order("name");
  const list = services ?? [];
  const start = page * PAGE;
  const slice = list.slice(start, start + PAGE);
  if (!slice.length) return sendWithMenu(token, chatId, "No services available.");
  const buttons: any[] = slice.map((s: any) => [{
    text: s.name,
    callback_data: `svc:${s.id}`,
  }]);
  const nav: any[] = [];
  if (page > 0) nav.push({ text: "Prev", callback_data: `pg:${page - 1}` });
  if (start + PAGE < list.length) nav.push({ text: "Next", callback_data: `pg:${page + 1}` });
  if (nav.length) buttons.push(nav);
  return tgApi(token, "sendMessage", {
    chat_id: chatId, text: "Pick a service:", parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleCallback(supabase: any, token: string, cb: any) {
  const chatId = String(cb.message.chat.id);
  const data: string = cb.data || "";
  await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id });
  const user = await findUserByChat(supabase, chatId);
  if (!user) return sendMessage(token, chatId, "Account not linked.");
  if (data.startsWith("pg:")) return showServiceList(supabase, token, chatId, Number(data.slice(3)));
  if (data.startsWith("svc:")) {
    const serviceId = data.slice(4);
    const { data: svc } = await supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
    const serviceName = svc?.name ?? "Service";
    await setState(supabase, chatId, { kind: "await_imei", serviceId, serviceName });
    return sendWithCancel(token, chatId, `${escapeHtml(serviceName)}\nSend IMEI`);
  }
}
