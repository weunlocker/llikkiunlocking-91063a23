// Shared logic for charging a user, calling provider, and recording the order.
// Used by both check-imei (web) and api-check (public API) edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function applyTemplate(template: string, data: unknown): string {
  if (!template) return JSON.stringify(data, null, 2);
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    if (data && typeof data === "object" && k in (data as Record<string, unknown>)) {
      const v = (data as Record<string, unknown>)[k];
      return v === null || v === undefined ? "" : String(v);
    }
    return `{${k}}`;
  });
}

export async function executeCheck(opts: {
  userId: string;
  serviceId: string;
  imei: string;
  source: "web" | "api";
}) {
  const supabase = makeServiceClient();

  // Load service & user atomically-ish
  const [{ data: service, error: sErr }, { data: profile, error: pErr }] = await Promise.all([
    supabase.from("services").select("*").eq("id", opts.serviceId).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", opts.userId).maybeSingle(),
  ]);

  if (sErr || !service) return { ok: false, status: 404, body: { error: "Service not found" } };
  if (!service.active) return { ok: false, status: 400, body: { error: "Service inactive" } };
  if (pErr || !profile) return { ok: false, status: 404, body: { error: "User not found" } };
  if (profile.banned) return { ok: false, status: 403, body: { error: "Account banned" } };

  const price = Number(service.price);
  const balance = Number(profile.balance);
  if (balance < price) return { ok: false, status: 402, body: { error: "Insufficient balance", balance } };

  // Deduct first
  const newBalance = +(balance - price).toFixed(2);
  const { error: balErr } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", opts.userId);
  if (balErr) return { ok: false, status: 500, body: { error: "Failed to charge wallet" } };

  // Create order (pending)
  const { data: order, error: oErr } = await supabase.from("orders").insert({
    user_id: opts.userId, service_id: service.id, imei: opts.imei,
    status: "pending", price_charged: price, source: opts.source,
  }).select().single();

  if (oErr || !order) {
    // refund
    await supabase.from("profiles").update({ balance }).eq("id", opts.userId);
    return { ok: false, status: 500, body: { error: "Failed to create order" } };
  }

  // Charge transaction
  await supabase.from("transactions").insert({
    user_id: opts.userId, type: "charge", amount: -price, balance_after: newBalance,
    description: `Check: ${service.name}`, order_id: order.id,
  });

  // Call provider
  let resultText = "";
  let success = false;
  let errorMsg: string | null = null;

  if (!service.api_url) {
    // mock response when no API configured
    resultText = `Demo mode — no upstream API configured for "${service.name}".\nIMEI: ${opts.imei}\nResult: simulated success.`;
    success = true;
  } else {
    try {
      const url = service.api_url.replace(/\{IMEI\}/gi, encodeURIComponent(opts.imei));
      const headers: Record<string, string> = { "Accept": "application/json, text/plain, */*" };
      const customHeaders = (service.api_headers ?? {}) as Record<string, string>;
      Object.assign(headers, customHeaders);
      const init: RequestInit = { method: service.api_method || "GET", headers };
      if (init.method === "POST") {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify({ imei: opts.imei });
      }
      const resp = await fetch(url, init);
      const ct = resp.headers.get("content-type") || "";
      const raw = ct.includes("json") ? await resp.json() : await resp.text();
      if (!resp.ok) {
        errorMsg = `Provider returned ${resp.status}: ${typeof raw === "string" ? raw.slice(0, 500) : JSON.stringify(raw).slice(0, 500)}`;
      } else {
        resultText = service.response_template
          ? applyTemplate(service.response_template, raw)
          : (typeof raw === "string" ? raw : JSON.stringify(raw, null, 2));
        success = true;
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Provider call failed";
    }
  }

  if (!success) {
    // refund automatically on provider failure
    const refundedBalance = +(newBalance + price).toFixed(2);
    await supabase.from("profiles").update({ balance: refundedBalance }).eq("id", opts.userId);
    await supabase.from("orders").update({ status: "failed", error_message: errorMsg }).eq("id", order.id);
    await supabase.from("transactions").insert({
      user_id: opts.userId, type: "refund", amount: price, balance_after: refundedBalance,
      description: `Auto-refund: ${service.name}`, order_id: order.id,
    });
    return { ok: false, status: 502, body: { status: "failed", error: errorMsg, balance_after: refundedBalance, order_id: order.id } };
  }

  await supabase.from("orders").update({ status: "completed", result: resultText }).eq("id", order.id);
  return {
    ok: true, status: 200,
    body: { status: "completed", imei: opts.imei, service: service.name, result: resultText, balance_after: newBalance, order_id: order.id },
  };
}
