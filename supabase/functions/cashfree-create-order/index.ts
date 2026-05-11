// Creates a Cashfree Payment Gateway order for an authenticated user.
// Wallet is in USD; Cashfree charges INR. We convert using admin-set rate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const Body = z.object({ amount_usd: z.number().min(1).max(10000) });
const PROD_APP_BASE_URL = "https://www.likkiunlocking.com";

function getRequestBaseUrl(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const referer = req.headers.get("referer");
  if (referer) return new URL(referer).origin;

  return PROD_APP_BASE_URL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
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
    const amount_usd = parsed.data.amount_usd;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin
      .from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.cashfree_enabled) return json(400, { error: "Cashfree is not enabled" });
    if (amount_usd < Number(settings.cashfree_min_amount ?? 1)) {
      return json(400, { error: `Minimum top-up is $${settings.cashfree_min_amount}` });
    }

    const env = String(settings.cashfree_env ?? "sandbox");
    const isProd = env === "production";
    const appId = isProd ? settings.cashfree_prod_app_id : settings.cashfree_sandbox_app_id;
    const secretKey = isProd ? settings.cashfree_prod_secret_key : settings.cashfree_sandbox_secret_key;
    if (!appId || !secretKey) return json(400, { error: `Cashfree ${env} credentials not configured` });

    const { data: profile } = await admin
      .from("profiles").select("email, display_name, phone, banned").eq("id", user.id).maybeSingle();
    if (!profile || profile.banned) return json(403, { error: "Account not eligible" });

    const rate = Number(settings.cashfree_usd_to_inr ?? 85);
    const amount_inr = Math.round(amount_usd * rate * 100) / 100; // 2 decimals

    const orderId = `CF_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const cfBase = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

    const appBaseUrl = isProd ? PROD_APP_BASE_URL : getRequestBaseUrl(req);
    const returnUrl = `${appBaseUrl}/dashboard?cf_order={order_id}`;
    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-webhook`;

    const cfBody = {
      order_id: orderId,
      order_amount: amount_inr,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id,
        customer_email: profile.email ?? `${user.id}@noemail.local`,
        customer_phone: profile.phone || "9999999999",
        customer_name: profile.display_name ?? "Customer",
      },
      order_meta: {
        return_url: returnUrl.replace("{order_id}", orderId),
        notify_url: notifyUrl,
      },
      order_note: `Wallet top-up $${amount_usd.toFixed(2)} (₹${amount_inr.toFixed(2)})`,
    };

    const cfResp = await fetch(`${cfBase}/orders`, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cfBody),
    });
    const cfData = await cfResp.json();
    if (!cfResp.ok) {
      console.error("Cashfree create order failed", cfData);
      return json(502, { error: cfData?.message || "Cashfree error", detail: cfData });
    }

    const paymentSessionId = cfData.payment_session_id;
    if (!paymentSessionId) {
      return json(502, { error: "Cashfree did not return payment_session_id", detail: cfData });
    }

    const checkoutUrl = `${appBaseUrl}/cashfree-redirect?sid=${encodeURIComponent(paymentSessionId)}&env=${env}`;

    const expiresAt = new Date(Date.now() + Number(settings.order_expiry_minutes ?? 30) * 60_000).toISOString();

    const { data: order, error: insErr } = await admin.from("payment_orders").insert({
      user_id: user.id,
      provider: "cashfree",
      merchant_trade_no: orderId,
      amount: amount_usd,
      currency: "USD",
      status: "pending",
      checkout_url: checkoutUrl,
      memo: orderId,
      expires_at: expiresAt,
      raw: { env, amount_inr, rate, payment_session_id: paymentSessionId, cashfree: cfData },
    }).select("id").single();
    if (insErr) {
      console.error("payment_orders insert", insErr);
      return json(500, { error: insErr.message });
    }

    return json(200, {
      ok: true,
      order_id: order.id,
      cf_order_id: orderId,
      payment_session_id: paymentSessionId,
      checkout_url: checkoutUrl,
      amount_usd,
      amount_inr,
      env,
      expires_at: expiresAt,
    });
  } catch (e) {
    console.error("cashfree-create-order error", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
