// Create a Cashfree Payment Link for wallet top-up.
// USD amount is converted to INR using the admin-configured rate, then a Cashfree
// Payment Link is created. Returns link_url for the client to open.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  amount: z.number().min(0.5).max(10000), // USD
  return_origin: z.string().url().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return json(401, { error: "Unauthorized" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
    const amountUsd = parsed.data.amount;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.cashfree_enabled) return json(400, { error: "Cashfree payments are disabled" });

    const env = (settings.cashfree_env ?? "sandbox") as "sandbox" | "production";
    const appId = env === "production" ? settings.cashfree_prod_app_id : settings.cashfree_sandbox_app_id;
    const secret = env === "production" ? settings.cashfree_prod_secret_key : settings.cashfree_sandbox_secret_key;
    if (!appId || !secret) return json(400, { error: "Cashfree keys not configured" });

    const minUsd = Number(settings.cashfree_min_amount ?? 1);
    if (amountUsd < minUsd) return json(400, { error: `Minimum top-up is $${minUsd}` });

    const rate = Number(settings.cashfree_usd_to_inr ?? 84);
    const amountInr = Math.max(1, Math.round(amountUsd * rate * 100) / 100);

    // Load profile for customer details
    const { data: profile } = await admin
      .from("profiles")
      .select("email, display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    const linkId = `LK${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 40);
    const expiryMin = Number(settings.order_expiry_minutes ?? 30);
    const expires = new Date(Date.now() + expiryMin * 60_000).toISOString();

    // Persist a pending payment_orders row. Store the USD amount so credit_balance uses USD.
    const { data: created, error: insErr } = await admin.from("payment_orders").insert({
      user_id: user.id,
      provider: "cashfree",
      merchant_trade_no: linkId,
      amount: amountUsd,
      currency: "USD",
      coin: "INR",
      status: "pending",
      expires_at: expires,
      raw: { amount_inr: amountInr, rate, env },
    }).select("id").single();
    if (insErr) return json(500, { error: insErr.message });

    // Build Cashfree Order (Orders API — enabled by default)
    const apiBase = env === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
    const payBase = env === "production" ? "https://payments.cashfree.com" : "https://payments-test.cashfree.com";
    const returnUrl = `${parsed.data.return_origin ?? "https://likkiunlocking.com"}/dashboard?cashfree_order=${created.id}`;
    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-webhook`;

    const phoneDigits = (profile?.phone ?? "").replace(/\D/g, "").slice(-10) || "9999999999";
    const payload = {
      order_id: linkId,
      order_amount: amountInr,
      order_currency: "INR",
      order_note: `Wallet top-up $${amountUsd}`,
      customer_details: {
        customer_id: user.id,
        customer_name: profile?.display_name || (profile?.email ?? "Customer").split("@")[0],
        customer_email: profile?.email || `${user.id}@example.com`,
        customer_phone: phoneDigits,
      },
      order_meta: {
        return_url: `${returnUrl}&order_id={order_id}`,
        notify_url: notifyUrl,
      },
      order_expiry_time: expires,
    };

    const cfRes = await fetch(`${apiBase}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": appId,
        "x-client-secret": secret,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify(payload),
    });
    const cfJson = await cfRes.json().catch(() => ({}));
    const sessionId = cfJson?.payment_session_id;
    if (!cfRes.ok || !sessionId) {
      console.error("Cashfree order creation failed", cfRes.status, cfJson);
      await admin.from("payment_orders").update({ status: "failed", raw: { ...payload, error: cfJson } }).eq("id", created.id);
      return json(400, { error: cfJson?.message || "Cashfree order failed" });
    }

    const checkoutUrl = `${payBase}/pay/order/${sessionId}`;
    await admin.from("payment_orders").update({
      checkout_url: checkoutUrl,
      prepay_id: cfJson.cf_order_id ? String(cfJson.cf_order_id) : null,
      raw: { ...payload, response: cfJson },
    }).eq("id", created.id);

    return json(200, {
      ok: true,
      order_id: created.id,
      link_url: checkoutUrl,
      amount_usd: amountUsd,
      amount_inr: amountInr,
      rate,
      expires_at: expires,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
