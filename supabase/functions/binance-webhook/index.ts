// Binance Pay webhook — credits wallet on successful payment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    const timestamp = req.headers.get("BinancePay-Timestamp") || "";
    const nonce = req.headers.get("BinancePay-Nonce") || "";
    const signature = req.headers.get("BinancePay-Signature") || "";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    const secret = settings?.binance_secret_key as string;

    if (secret && timestamp && nonce && signature) {
      const expected = await hmacSha512Hex(secret, `${timestamp}\n${nonce}\n${body}\n`);
      if (expected !== signature) {
        console.error("Invalid signature");
        return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "bad signature" }), { status: 401 });
      }
    }

    const evt = JSON.parse(body);
    const data = typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;
    const merchantTradeNo: string = data?.merchantTradeNo;
    const status: string = evt.bizStatus || data?.status || "";

    if (!merchantTradeNo) {
      return new Response(JSON.stringify({ returnCode: "SUCCESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { data: order } = await admin.from("payment_orders").select("*").eq("merchant_trade_no", merchantTradeNo).maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ returnCode: "SUCCESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const isPaid = status === "PAY_SUCCESS";
    const isClosed = status === "PAY_CLOSED";
    const newStatus = isPaid ? "paid" : isClosed ? "expired" : order.status;

    await admin.from("payment_orders").update({ status: newStatus, raw: data }).eq("id", order.id);

    if (isPaid && !order.credited) {
      const { data: profile } = await admin.from("profiles").select("balance, email").eq("id", order.user_id).maybeSingle();
      if (profile) {
        const newBalance = +(Number(profile.balance) + Number(order.amount)).toFixed(2);
        await admin.from("profiles").update({ balance: newBalance }).eq("id", order.user_id);
        await admin.from("transactions").insert({
          user_id: order.user_id, type: "topup", amount: Number(order.amount), balance_after: newBalance,
          description: `Binance Pay top-up $${Number(order.amount).toFixed(2)}`,
        });
        await admin.from("payment_orders").update({ credited: true }).eq("id", order.id);
        try {
          await admin.functions.invoke("telegram-notify", {
            body: { user_id: order.user_id, subject: `💰 Wallet topped up`, body: `Added: $${Number(order.amount).toFixed(2)}\nNew balance: $${newBalance.toFixed(2)}` },
          });
        } catch (_) { /* ignore */ }
      }
    }

    return new Response(JSON.stringify({ returnCode: "SUCCESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: e instanceof Error ? e.message : "err" }), { status: 500 });
  }
});
