// Cashfree webhook receiver. Verifies signature and credits wallet balance on success.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
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

    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings) return json(500, { error: "settings missing" });

    // Try both env secrets so a misconfigured env still verifies
    const secrets = [settings.cashfree_prod_secret_key, settings.cashfree_sandbox_secret_key].filter(Boolean) as string[];
    let verified = false;
    for (const s of secrets) {
      const expected = await hmacSha256Base64(s, `${timestamp}${rawBody}`);
      if (expected === signature) { verified = true; break; }
    }
    if (!verified) {
      console.warn("Cashfree webhook signature mismatch");
      return json(401, { error: "bad signature" });
    }

    const evt = JSON.parse(rawBody);
    const type = evt?.type || evt?.data?.type;
    const link = evt?.data?.link || evt?.data?.payment_link || evt?.data;
    const linkId: string | undefined = link?.link_id || evt?.data?.link_id || evt?.data?.order?.order_id;
    const status: string = (link?.link_status || evt?.data?.link_status || evt?.data?.payment?.payment_status || "").toString().toUpperCase();

    if (!linkId) return json(200, { ok: true, skipped: "no link id" });

    const { data: order } = await admin.from("payment_orders")
      .select("*").eq("merchant_trade_no", linkId).maybeSingle();
    if (!order) return json(200, { ok: true, skipped: "unknown order" });

    // Only credit on PAID/SUCCESS
    const paid = status === "PAID" || status === "SUCCESS" || type === "PAYMENT_SUCCESS_WEBHOOK";
    if (paid && !order.credited) {
      const { data: newBal, error: credErr } = await admin.rpc("credit_balance", {
        p_user_id: order.user_id, p_amount: Number(order.amount),
      });
      if (credErr) {
        console.error("credit_balance failed", credErr);
        return json(500, { error: credErr.message });
      }
      await admin.from("payment_orders").update({
        status: "paid", credited: true, matched_at: new Date().toISOString(),
        tx_id: evt?.data?.payment?.cf_payment_id?.toString() ?? null,
        raw: { ...(order.raw ?? {}), webhook: evt },
      }).eq("id", order.id);
      await admin.from("transactions").insert({
        user_id: order.user_id, type: "topup",
        amount: Number(order.amount), balance_after: Number(newBal),
        description: `Cashfree top-up (₹${(order.raw as any)?.amount_inr ?? "?"})`,
      });
      // Referral bonus
      try {
        await admin.rpc("award_referral_bonus", {
          p_referred_user_id: order.user_id,
          p_topup_amount: Number(order.amount),
          p_payment_order_id: order.id,
        });
      } catch (e) { console.warn("referral bonus", e); }
    } else if (status === "EXPIRED" || status === "CANCELLED" || status === "FAILED") {
      await admin.from("payment_orders").update({
        status: "failed", raw: { ...(order.raw ?? {}), webhook: evt },
      }).eq("id", order.id);
    }

    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
