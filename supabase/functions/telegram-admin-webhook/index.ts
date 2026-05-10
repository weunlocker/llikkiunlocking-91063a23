// Telegram Admin Bot webhook. Public endpoint; verifies secret_token + admin chat_id whitelist.
import { deriveSecret, escapeHtml, getBotConfig, makeServiceClient, sendMessage } from "../_shared/tg.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const supabase = makeServiceClient();
  const cfg = await getBotConfig(supabase);
  const token = cfg?.admin_bot_token;
  if (!token) return new Response("not configured");

  const expected = deriveSecret(token);
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  if (!update?.update_id) return new Response("ok");

  const { error: dupErr } = await supabase.from("telegram_updates")
    .insert({ update_id: update.update_id, bot_kind: "admin" });
  if (dupErr) return new Response("ok");

  const msg = update.message;
  if (!msg) return new Response("ok");
  const chatId = String(msg.chat.id);
  const text: string = (msg.text || "").trim();

  const allowed: string[] = (cfg?.admin_chat_ids ?? []).map(String);
  if (!allowed.includes(chatId)) {
    await sendMessage(token, chatId, `⛔ Not authorized.\nYour chat_id: <code>${escapeHtml(chatId)}</code>\nAdd it in Admin → Telegram settings.`);
    return new Response("ok");
  }

  try { await handleAdmin(supabase, token, chatId, text); }
  catch (e) { console.error("admin-webhook error", e); }
  return new Response("ok");
});

async function handleAdmin(supabase: any, token: string, chatId: string, text: string) {
  if (!text || text === "/start") {
    return sendMessage(token, chatId,
      "🛡 <b>Admin bot ready</b>\nCommands:\n/stats — today's totals\n/clients — recent registrations\n/orders — recent orders\n/balance &lt;email&gt; — user balance");
  }

  if (text.startsWith("/stats")) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: ordersN }, { count: usersN }, { data: revRows }] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("orders").select("price_charged").eq("status", "success").gte("created_at", since),
    ]);
    const rev = (revRows ?? []).reduce((s: number, r: any) => s + Number(r.price_charged ?? 0), 0);
    return sendMessage(token, chatId, `📊 <b>Last 24h</b>\nNew users: <b>${usersN ?? 0}</b>\nOrders: <b>${ordersN ?? 0}</b>\nRevenue (success): <b>$${rev.toFixed(2)}</b>`);
  }

  if (text.startsWith("/clients")) {
    const { data } = await supabase.from("profiles")
      .select("email, display_name, balance, created_at")
      .order("created_at", { ascending: false }).limit(10);
    const lines = (data ?? []).map((p: any) =>
      `• ${escapeHtml(p.display_name ?? "—")} &lt;${escapeHtml(p.email ?? "")}&gt; — $${Number(p.balance ?? 0).toFixed(2)}`,
    ).join("\n");
    return sendMessage(token, chatId, `👥 <b>Recent clients</b>\n${lines || "—"}`);
  }

  if (text.startsWith("/orders")) {
    const { data } = await supabase.from("orders")
      .select("order_number, imei, status, price_charged, created_at, services(name), profiles!orders_user_id_fkey(email)")
      .order("created_at", { ascending: false }).limit(15);
    // profiles join may not exist as FK; fall back:
    let rows = data;
    if (!rows) {
      const { data: r2 } = await supabase.from("orders")
        .select("order_number, imei, status, price_charged, user_id, services(name)")
        .order("created_at", { ascending: false }).limit(15);
      rows = r2;
    }
    const lines = (rows ?? []).map((o: any) =>
      `#${o.order_number} • ${escapeHtml(o.services?.name ?? "—")} • <code>${escapeHtml(o.imei)}</code> • <b>${o.status}</b> • $${Number(o.price_charged ?? 0).toFixed(2)}`,
    ).join("\n");
    return sendMessage(token, chatId, `📦 <b>Recent orders</b>\n${lines || "—"}`);
  }

  if (text.startsWith("/balance")) {
    const email = text.split(/\s+/)[1];
    if (!email) return sendMessage(token, chatId, "Usage: /balance &lt;email&gt;");
    const { data: p } = await supabase.from("profiles")
      .select("email, display_name, balance, banned").ilike("email", email).maybeSingle();
    if (!p) return sendMessage(token, chatId, "User not found.");
    return sendMessage(token, chatId,
      `👤 ${escapeHtml(p.display_name ?? "")} &lt;${escapeHtml(p.email)}&gt;\nBalance: <b>$${Number(p.balance).toFixed(2)}</b>${p.banned ? "\n🚫 BANNED" : ""}`);
  }

  return sendMessage(token, chatId, "Unknown command. /start for menu.");
}
