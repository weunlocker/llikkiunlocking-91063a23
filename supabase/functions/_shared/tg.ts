// Shared helpers for the dual Telegram bot system (Admin Bot + Client Bot).
// These call the Telegram Bot API directly using tokens stored in site_settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type BotKind = "admin" | "client";

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function getBotConfig(supabase: ReturnType<typeof makeServiceClient>) {
  const { data } = await supabase
    .from("site_settings")
    .select("admin_bot_token, admin_bot_username, admin_chat_ids, client_bot_token, client_bot_username")
    .eq("id", 1)
    .maybeSingle();
  return data ?? null;
}

export async function tgApi(token: string, method: string, payload: unknown) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok && data?.ok !== false, status: resp.status, data };
}

export async function sendMessage(token: string, chatId: string | number, text: string, extra: Record<string, unknown> = {}) {
  return tgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function deriveSecret(token: string): string {
  // 32 alphanumeric chars derived from token (deterministic, doesn't expose token).
  let h = 0n;
  for (let i = 0; i < token.length; i++) {
    h = (h * 1315423911n) ^ BigInt(token.charCodeAt(i));
    h &= 0xffffffffffffffffn;
  }
  let s = h.toString(36);
  while (s.length < 16) s = s + h.toString(36);
  return ("lk_" + s).slice(0, 40).replace(/[^A-Za-z0-9_-]/g, "x");
}
