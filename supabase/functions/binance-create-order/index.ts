// Create a pending wallet top-up against the admin's personal Binance account.
// Returns Pay ID + QR URL + a unique memo. Customer pays from their Binance app
// using that memo. The `binance-poll-deposits` cron auto-credits when matched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  amount: z.number().min(0.5).max(10000),
  coin: z.string().trim().min(2).max(10).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randMemo(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  for (const b of rnd) s += alphabet[b % alphabet.length];
  return `LK${s}`;
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
    const amount = parsed.data.amount;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.binance_enabled) return json(400, { error: "Binance payments are disabled" });
    if (!settings.binance_pay_id) return json(400, { error: "Binance Pay ID not configured" });
    const coins = (Array.isArray(settings.binance_coins) ? settings.binance_coins : ["USDT"]) as string[];
    const coin = (parsed.data.coin && coins.includes(parsed.data.coin)) ? parsed.data.coin : (coins[0] ?? "USDT");
    const minAmt = Number(settings.binance_min_amount ?? 1);
    if (amount < minAmt) return json(400, { error: `Minimum top-up is ${minAmt} ${coin}` });

    // Reuse a recent pending order if the user already has one for the same amount/coin.
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: existing } = await admin
      .from("payment_orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .eq("amount", amount)
      .eq("coin", coin)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json(200, {
        ok: true,
        order_id: existing.id,
        pay_id: settings.binance_pay_id,
        qr_url: settings.binance_qr_url,
        coin: existing.coin ?? coin,
        amount,
        memo: existing.memo,
        expires_at: existing.expires_at,
      });
    }

    const expiryMin = Number(settings.order_expiry_minutes ?? 30);
    const expires = new Date(Date.now() + expiryMin * 60_000).toISOString();

    // Generate a unique memo (retry on collision)
    let memo = randMemo();
    let attempts = 0;
    while (attempts < 5) {
      const { data: clash } = await admin.from("payment_orders").select("id").eq("memo", memo).maybeSingle();
      if (!clash) break;
      memo = randMemo();
      attempts++;
    }

    const merchantTradeNo = `LK${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 32);
    const { data: created, error: insErr } = await admin.from("payment_orders").insert({
      user_id: user.id,
      provider: "binance",
      merchant_trade_no: merchantTradeNo,
      amount,
      currency: coin,
      coin,
      memo,
      status: "pending",
      expires_at: expires,
    }).select("id").single();
    if (insErr) return json(500, { error: insErr.message });

    return json(200, {
      ok: true,
      order_id: created.id,
      pay_id: settings.binance_pay_id,
      qr_url: settings.binance_qr_url,
      coin,
      amount,
      memo,
      expires_at: expires,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
