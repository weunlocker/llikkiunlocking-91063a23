// Cashfree webhook receiver. Public endpoint (no JWT).
// Verifies x-webhook-signature (HMAC-SHA256(timestamp + rawBody) using secret key, base64),
// then on PAYMENT_SUCCESS_WEBHOOK credits the user's wallet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  // base64
  let str = "";
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("x-webhook-timestamp") || "";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin
      .from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings) return json(500, { error: "Settings not configured" });

    // Try sandbox secret first, then production. Whichever matches signature is the right env.
    const candidates: Array<{ env: string; secret: string }> = [];
    if (settings.cashfree_sandbox_secret_key) candidates.push({ env: "sandbox", secret: settings.cashfree_sandbox_secret_key });
    if (settings.cashfree_prod_secret_key) candidates.push({ env: "production", secret: settings.cashfree_prod_secret_key });

    let matchedEnv: string | null = null;
    for (const c of candidates) {
      const expected = await hmacSha256Base64(c.secret, timestamp + rawBody);
      if (expected === signature) { matchedEnv = c.env; break; }
    }
    if (!matchedEnv) {
      console.warn("Cashfree webhook: invalid signature");
      return json(401, { error: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type || payload.event || "";
    const order = payload.data?.order || {};
    const payment = payload.data?.payment || {};
    const link = payload.data?.link || {};
    // Support both order webhooks and payment-link webhooks. Our merchant_trade_no equals link_id.
    const cfOrderId = link.link_id || order.order_id || payment.order_id;
    if (!cfOrderId) return json(400, { error: "Missing order_id / link_id" });

    // Idempotency: find our payment_orders row
    const { data: po } = await admin
      .from("payment_orders").select("*").eq("merchant_trade_no", cfOrderId).maybeSingle();
    if (!po) return json(404, { error: "Order not found" });

    if (po.status === "paid") return json(200, { ok: true, already: true });

    const linkStatus = String(link.link_status || "").toUpperCase();
    const isSuccess = eventType.includes("PAYMENT_SUCCESS")
      || payment.payment_status === "SUCCESS"
      || linkStatus === "PAID";
    if (!isSuccess) {
      // Log non-success events but don't credit
      await admin.from("payment_orders").update({
        raw: { ...(po.raw as object ?? {}), last_event: payload },
      }).eq("id", po.id);
      return json(200, { ok: true, ignored: eventType });
    }

    // Credit the user — amount is in USD on our side
    const credit = Number(po.amount ?? 0);
    const { data: prof } = await admin
      .from("profiles").select("balance").eq("id", po.user_id).maybeSingle();
    const newBal = +(Number(prof?.balance ?? 0) + credit).toFixed(2);

    const { error: balErr } = await admin
      .from("profiles").update({ balance: newBal }).eq("id", po.user_id);
    if (balErr) {
      console.error("balance update", balErr);
      return json(500, { error: balErr.message });
    }

    await admin.from("transactions").insert({
      user_id: po.user_id,
      amount: credit,
      balance_after: newBal,
      type: "topup",
      description: `Cashfree top-up ${cfOrderId}`,
    });

    await admin.from("payment_orders").update({
      status: "paid",
      tx_id: payment.cf_payment_id ? String(payment.cf_payment_id) : null,
      matched_at: new Date().toISOString(),
      credited: true,
      raw: { ...(po.raw as object ?? {}), webhook: payload, matched_env: matchedEnv },
    }).eq("id", po.id);

    // Notify user (best-effort)
    try {
      await admin.functions.invoke("telegram-notify", {
        body: {
          user_id: po.user_id,
          subject: "💰 Wallet topped up",
          body: `Added: $${credit.toFixed(2)} (Cashfree)\nNew balance: $${newBal.toFixed(2)}`,
        },
      });
    } catch (_) { /* ignore */ }

    return json(200, { ok: true, credited: credit });
  } catch (e) {
    console.error("cashfree-webhook error", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
