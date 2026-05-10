// Polls Binance deposit history with the admin's personal (read-only) API key
// and auto-credits any pending payment_orders that match by memo.
// Triggered by pg_cron every minute. Public (no JWT) — protected by being
// service-role only and read-only on Binance.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type BinanceDeposit = {
  id?: string;
  txId?: string;
  coin?: string;
  amount?: string | number;
  status?: number; // 0 pending, 6 credited, 1 success
  insertTime?: number;
  addressTag?: string;
  info?: string;
  network?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== SERVICE_KEY) return json(401, { error: "Unauthorized" });
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings?.binance_enabled) return json(200, { ok: true, skipped: "disabled" });
    if (!settings.binance_poll_enabled) return json(200, { ok: true, skipped: "polling off" });
    const apiKey = settings.binance_api_key as string;
    const secret = settings.binance_secret_key as string;
    if (!apiKey || !secret) return json(200, { ok: true, skipped: "no api credentials" });

    // Look back 24h (Binance default startTime)
    const startTime = Date.now() - 24 * 60 * 60 * 1000;
    const recvWindow = 60_000;
    const ts = Date.now();
    const params = `startTime=${startTime}&recvWindow=${recvWindow}&timestamp=${ts}`;
    const signature = await hmacSha256Hex(secret, params);
    const url = `https://api.binance.com/sapi/v1/capital/deposit/hisrec?${params}&signature=${signature}`;

    const resp = await fetch(url, { headers: { "X-MBX-APIKEY": apiKey } });
    const raw: unknown = await resp.json();
    if (!resp.ok) {
      console.error("Binance deposit history failed", raw);
      await admin.from("payment_settings").update({ binance_last_polled_at: new Date().toISOString() }).eq("id", 1);
      return json(502, { error: "Binance API error", detail: raw });
    }
    const deposits = (Array.isArray(raw) ? raw : []) as BinanceDeposit[];

    // Pull pending orders for matching
    const { data: pending } = await admin
      .from("payment_orders")
      .select("*")
      .eq("status", "pending")
      .eq("provider", "binance");

    const pendingByMemo = new Map<string, typeof pending[number]>();
    (pending ?? []).forEach((o) => { if (o.memo) pendingByMemo.set(o.memo.toUpperCase(), o); });

    const matched: Array<{ memo: string; user_id: string; amount: number; tx: string }> = [];

    for (const d of deposits) {
      if (d.status !== 1 && d.status !== 6) continue; // only success / credited
      const tag = (d.addressTag ?? d.info ?? "").toString().toUpperCase().trim();
      if (!tag) continue;
      // Memos can be embedded; do a contains match on any pending memo
      let found: typeof pending[number] | undefined;
      for (const [memo, order] of pendingByMemo.entries()) {
        if (tag.includes(memo)) { found = order; break; }
      }
      if (!found) continue;
      const depAmount = Number(d.amount ?? 0);
      const requested = Number(found.amount ?? 0);
      // Allow small underpayment tolerance (e.g. exchange fees) of 1%
      if (depAmount + requested * 0.01 < requested) continue;
      // Skip if same txId already recorded
      if (d.txId) {
        const { data: existing } = await admin.from("payment_orders").select("id").eq("tx_id", d.txId).maybeSingle();
        if (existing && existing.id !== found.id) continue;
      }

      // Credit the user balance
      const { data: prof } = await admin.from("profiles").select("balance").eq("id", found.user_id).maybeSingle();
      const currentBal = Number(prof?.balance ?? 0);
      const newBal = currentBal + depAmount;
      const { error: balErr } = await admin.from("profiles").update({ balance: newBal }).eq("id", found.user_id);
      if (balErr) { console.error("balance update", balErr); continue; }

      await admin.from("transactions").insert({
        user_id: found.user_id,
        amount: depAmount,
        balance_after: newBal,
        type: "topup",
        description: `Binance deposit ${d.coin} (${found.memo})`,
      });

      await admin.from("payment_orders").update({
        status: "paid",
        tx_id: d.txId ?? null,
        matched_at: new Date().toISOString(),
        credited: true,
        raw: d as unknown as Record<string, unknown>,
      }).eq("id", found.id);

      pendingByMemo.delete(found.memo!.toUpperCase());
      matched.push({ memo: found.memo!, user_id: found.user_id, amount: depAmount, tx: d.txId ?? "" });
    }

    await admin.from("payment_settings").update({ binance_last_polled_at: new Date().toISOString() }).eq("id", 1);

    return json(200, { ok: true, scanned: deposits.length, matched: matched.length });
  } catch (e) {
    console.error("binance-poll-deposits error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
