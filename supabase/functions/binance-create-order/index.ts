// Create a Binance Pay checkout order
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({ amount: z.number().min(1).max(10000) });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json(401, { error: "Unauthorized" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
    const amount = parsed.data.amount;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.binance_enabled) return json(400, { error: "Binance Pay not enabled" });
    const apiKey = settings.binance_api_key as string;
    const secret = settings.binance_secret_key as string;
    if (!apiKey || !secret) return json(500, { error: "Binance Pay not configured" });

    const merchantTradeNo = `LK${Date.now()}${Math.floor(Math.random() * 100000)}`.slice(0, 32);
    const origin = req.headers.get("origin") || "";

    const payload = {
      env: { terminalType: "WEB" },
      merchantTradeNo,
      orderAmount: Number(amount.toFixed(2)),
      currency: "USDT",
      goods: {
        goodsType: "02",
        goodsCategory: "Z000",
        referenceGoodsId: "wallet-topup",
        goodsName: "Wallet Top-up",
        goodsDetail: `Top up wallet $${amount.toFixed(2)}`,
      },
      returnUrl: `${origin}/dashboard?tab=wallet&topup=success`,
      cancelUrl: `${origin}/dashboard?tab=wallet&topup=cancel`,
      webhookUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/binance-webhook`,
    };

    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const payloadToSign = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = await hmacSha512Hex(secret, payloadToSign);

    const resp = await fetch("https://bpay.binanceapi.com/binancepay/openapi/v3/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": apiKey,
        "BinancePay-Signature": signature,
      },
      body,
    });
    const data = await resp.json();
    if (data.status !== "SUCCESS") {
      console.error("Binance create order failed", data);
      return json(502, { error: data.errorMessage || "Binance order failed", detail: data });
    }

    await admin.from("payment_orders").insert({
      user_id: user.id,
      provider: "binance",
      merchant_trade_no: merchantTradeNo,
      prepay_id: data.data?.prepayId,
      amount,
      currency: "USDT",
      status: "pending",
      checkout_url: data.data?.checkoutUrl,
      raw: data.data,
    });

    return json(200, {
      ok: true,
      checkoutUrl: data.data?.checkoutUrl,
      qrcodeLink: data.data?.qrcodeLink,
      merchantTradeNo,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
