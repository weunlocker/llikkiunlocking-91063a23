// Shared logic for charging a user, calling provider, and recording the order.
// Used by both check-imei (web) and api-check (public API) edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyUserEmail } from "./email.ts";
import { v2PlaceOrder } from "./dhru_v2.ts";

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

// -------- helpers --------

function getByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(/[.\[\]]+/).filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function applyTemplate(template: string, data: unknown): string {
  if (!template) return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return template.replace(/\{([\w\.\[\]]+)\}/g, (_, k) => {
    if (k.toLowerCase() === "imei") return "";
    const v = getByPath(data, k);
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

type SuccessRule = { path: string; op: string; value?: unknown };

function evaluateRules(rules: SuccessRule[] | undefined | null, data: unknown): { ok: boolean; failedRule?: SuccessRule } {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return { ok: true };
  for (const rule of rules) {
    const actual = getByPath(data, rule.path);
    let pass = false;
    switch (rule.op) {
      case "eq": pass = String(actual) === String(rule.value); break;
      case "neq": pass = String(actual) !== String(rule.value); break;
      case "contains": pass = typeof actual === "string" && typeof rule.value === "string" && actual.toLowerCase().includes(rule.value.toLowerCase()); break;
      case "not_contains": pass = !(typeof actual === "string" && typeof rule.value === "string" && actual.toLowerCase().includes(rule.value.toLowerCase())); break;
      case "exists": pass = actual !== undefined && actual !== null && actual !== ""; break;
      case "truthy": pass = !!actual && actual !== "false" && actual !== "0" && actual !== 0; break;
      default: pass = true;
    }
    if (!pass) return { ok: false, failedRule: rule };
  }
  return { ok: true };
}

function normalizeHtml(s: string): string {
  if (!s) return s;
  // If the upstream returned a JSON envelope, pull the inner response field first.
  const trimmed = s.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const inner = obj?.response ?? obj?.result ?? obj?.message ?? obj?.data;
      if (typeof inner === "string" && inner.trim()) s = inner;
    } catch { /* ignore */ }
  }
  // Preserve color markup so the client can render it.
  // <span style="color:red">X</span> -> [[c:red]]X[[/c]]
  s = s.replace(
    /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*([^;"']+)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_m, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  // <font color="red">X</font> -> [[c:red]]X[[/c]]
  s = s.replace(
    /<font\b[^>]*\bcolor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
    (_m, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function notifyUser(supabase: ReturnType<typeof makeServiceClient>, userId: string, subject: string, body: string) {
  try {
    await supabase.functions.invoke("telegram-notify", {
      body: { user_id: userId, subject, body },
    });
  } catch (e) {
    console.error("notifyUser failed", e);
  }
}

// -------- placement (fast: validate, charge, create pending order) --------

type PlacementCtx = {
  supabase: ReturnType<typeof makeServiceClient>;
  service: any;
  supplier: any | null;
  order: any;
  userId: string;
  imei: string;
  price: number;
  newBalance: number;
  prevBalance: number;
};

async function placeOrder(opts: {
  userId: string; serviceId: string; imei: string; source: "web" | "api";
}): Promise<{ ok: false; status: number; body: any } | { ok: true; ctx: PlacementCtx }> {
  const supabase = makeServiceClient();

  const [{ data: service, error: sErr }, { data: profile, error: pErr }] = await Promise.all([
    supabase.from("services").select("*").eq("id", opts.serviceId).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", opts.userId).maybeSingle(),
  ]);

  if (sErr || !service) return { ok: false, status: 404, body: { error: "Service not found" } };
  if (!service.active) return { ok: false, status: 400, body: { error: "Service inactive" } };
  if (pErr || !profile) return { ok: false, status: 404, body: { error: "User not found" } };
  if (profile.banned) return { ok: false, status: 403, body: { error: "Account banned" } };
  if (opts.source === "api" && profile.api_enabled === false) {
    return { ok: false, status: 403, body: { error: "API access disabled for this account" } };
  }

  const { data: override } = await supabase
    .from("user_service_overrides")
    .select("enabled, custom_price")
    .eq("user_id", opts.userId).eq("service_id", service.id).maybeSingle();
  if (override && override.enabled === false) {
    return { ok: false, status: 403, body: { error: "Service not available for this account" } };
  }

  const groupDiscount: Record<string, number> = { silver: 0.10, gold: 0.30, diamond: 0.50 };
  const discount = groupDiscount[String(profile.user_group ?? "").toLowerCase()] ?? 0;
  const basePrice = Number(service.price);
  const price = override?.custom_price != null
    ? Number(override.custom_price)
    : +(basePrice * (1 - discount)).toFixed(2);
  const balance = Number(profile.balance);
  if (balance < price) return { ok: false, status: 402, body: { error: "Insufficient balance", balance } };

  let supplier: any | null = null;
  if (service.supplier_id) {
    const { data: sup } = await supabase.from("suppliers").select("*").eq("id", service.supplier_id).maybeSingle();
    if (sup) {
      if (!sup.active) return { ok: false, status: 503, body: { error: "Supplier disabled" } };
      supplier = sup;
    }
  }

  const newBalance = +(balance - price).toFixed(2);
  const { error: balErr } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", opts.userId);
  if (balErr) return { ok: false, status: 500, body: { error: "Failed to charge wallet" } };

  const { data: order, error: oErr } = await supabase.from("orders").insert({
    user_id: opts.userId, service_id: service.id, imei: opts.imei,
    status: "pending", price_charged: price, source: opts.source,
  }).select().single();

  if (oErr || !order) {
    await supabase.from("profiles").update({ balance }).eq("id", opts.userId);
    return { ok: false, status: 500, body: { error: "Failed to create order" } };
  }

  await supabase.from("transactions").insert({
    user_id: opts.userId, type: "charge", amount: -price, balance_after: newBalance,
    description: `Check: ${service.name}`, order_id: order.id,
  });

  return {
    ok: true,
    ctx: { supabase, service, supplier, order, userId: opts.userId, imei: opts.imei, price, newBalance, prevBalance: balance },
  };
}

// -------- upstream (slow: call provider, finalize order) --------

async function runUpstream(ctx: PlacementCtx) {
  const { supabase, service, supplier, order, userId, imei, price, newBalance, prevBalance } = ctx;

  let resultText = "";
  let success = false;
  let errorMsg: string | null = null;
  let rawData: unknown = null;

  const hasUpstream = !!supplier || !!service.api_url;
  if (!hasUpstream) {
    resultText = `Demo mode — no upstream API configured for "${service.name}".\nIMEI: ${imei}\nResult: simulated success.`;
    success = true;
  } else {
    try {
      let url: string;
      const headers: Record<string, string> = { "Accept": "application/json, text/plain, */*" };
      const init: RequestInit = { method: "GET", headers };

      if (supplier) {
        url = String(supplier.endpoint_url);
        if (supplier.type === "dhru") {
          init.method = "POST";
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          const action = (service.supplier_action || "").toString();
          const username = String(supplier.dhru_username ?? "");
          const apiKey = String(supplier.dhru_api_key ?? "");
          const params = new URLSearchParams();
          if (supplier.api_format === "bulk") {
            params.set("data", JSON.stringify({
              username, apikey: apiKey, action: "placeimeiorder", service: action, imei,
            }));
          } else if (supplier.api_format === "v6") {
            params.set("apiaccesskey", apiKey);
            params.set("action", "placeimeiorder");
            params.set("requestformat", "JSON");
            if (username) params.set("username", username);
            params.set("parameters", `<PARAMETERS><ID>${action}</ID><IMEI>${imei}</IMEI></PARAMETERS>`);
          } else {
            params.set("username", username);
            params.set("apikey", apiKey);
            params.set("action", "placeimeiorder");
            params.set("service", action);
            params.set("imei", imei);
          }
          init.body = params.toString();
        } else {
          url = url
            .replace(/\{IMEI\}/gi, encodeURIComponent(imei))
            .replace(/\{ACTION\}/gi, encodeURIComponent(String(service.supplier_action ?? "")));
          init.method = service.api_method || "GET";
          const customHeaders = (service.api_headers ?? {}) as Record<string, string>;
          Object.assign(headers, customHeaders);
          if (init.method === "POST") {
            headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
            init.body = (service.api_request_body || JSON.stringify({ imei }))
              .replace(/\{IMEI\}/gi, imei)
              .replace(/\{ACTION\}/gi, String(service.supplier_action ?? ""));
          }
        }
      } else {
        url = service.api_url
          .replace(/\{IMEI\}/gi, encodeURIComponent(imei))
          .replace(/\{imei\}/g, encodeURIComponent(imei));
        const customHeaders = (service.api_headers ?? {}) as Record<string, string>;
        Object.assign(headers, customHeaders);
        init.method = service.api_method || "GET";
        if (init.method === "POST") {
          if (service.api_request_body && service.api_request_body.trim()) {
            const bodyTpl = service.api_request_body
              .replace(/\{IMEI\}/gi, imei)
              .replace(/\{imei\}/g, imei);
            if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
            init.body = bodyTpl;
          } else {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify({ imei });
          }
        }
      }

      const resp = await fetch(url, init);
      const ct = resp.headers.get("content-type") || "";
      const raw = ct.includes("json") ? await resp.json() : await resp.text();
      rawData = raw;

      let parsed: unknown = raw;
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          try { parsed = JSON.parse(trimmed); rawData = parsed; } catch { /* keep */ }
        }
      }

      if (supplier && supplier.type === "dhru") {
        let placeErr: string | null = null;
        if (!resp.ok) {
          placeErr = `Dhru returned ${resp.status}: ${typeof raw === "string" ? raw.slice(0, 500) : JSON.stringify(raw).slice(0, 500)}`;
        } else {
          const p = parsed as Record<string, unknown> | null;
          const errBlock = p?.ERROR ?? p?.error;
          if (errBlock) {
            const eArr = Array.isArray(errBlock) ? errBlock[0] : errBlock;
            const e = eArr as Record<string, unknown> | undefined;
            placeErr = (e?.MESSAGE ?? e?.message ?? e?.FACTOR ?? "Rejected by supplier").toString();
          } else {
            const findRef = (n: unknown): string | null => {
              if (!n || typeof n !== "object") return null;
              const o = n as Record<string, unknown>;
              const ref = o.REFERENCEID ?? o.referenceid ?? o.REFERENCE ?? o.reference ?? o.ID ?? o.id;
              if (ref != null && (typeof ref === "string" || typeof ref === "number")) return String(ref);
              for (const v of Object.values(o)) { const r2 = findRef(v); if (r2) return r2; }
              return null;
            };
            const refId = findRef((parsed as any)?.SUCCESS ?? (parsed as any)?.success ?? parsed);
            if (!refId) {
              placeErr = "Dhru did not return a reference id: " + (typeof raw === "string" ? raw.slice(0, 200) : JSON.stringify(raw).slice(0, 200));
            } else {
              await supabase.from("orders").update({
                supplier_reference: refId,
                result: `Order placed with supplier (ref ${refId}). Awaiting result…`,
              }).eq("id", order.id);
              notifyUser(supabase, userId,
                `⏳ Check submitted — ${service.name}`,
                `IMEI: ${imei}\nReference: ${refId}\nWaiting for supplier — you will be notified when ready.\nCharged: $${price.toFixed(2)} · Balance: $${newBalance.toFixed(2)}`,
              );
              return; // remain pending; poller takes over
            }
          }
        }
        // Async/supplier order failed at placement — DO NOT auto-fail/refund.
        // Keep order pending with error_message so admin can Reprocess or Switch API.
        await supabase.from("orders").update({
          error_message: placeErr,
          result: typeof rawData === "string" ? rawData.slice(0, 2000) : (rawData ? JSON.stringify(rawData).slice(0, 2000) : null),
        }).eq("id", order.id);
        notifyUser(supabase, userId,
          `⏳ Check pending — ${service.name}`,
          `IMEI: ${imei}\nYour order is pending review. We'll notify you once it's processed.`,
        );
        return;
      } else if (!resp.ok) {
        errorMsg = `Provider returned ${resp.status}: ${typeof raw === "string" ? raw.slice(0, 500) : JSON.stringify(raw).slice(0, 500)}`;
      } else {
        const ruleResult = evaluateRules(service.success_rules as SuccessRule[] | null, parsed);
        if (!ruleResult.ok) {
          const r = ruleResult.failedRule!;
          const actualVal = getByPath(parsed, r.path);
          errorMsg = `Rejected by rule: ${r.path} ${r.op}${r.value !== undefined ? ` ${JSON.stringify(r.value)}` : ""} (got ${JSON.stringify(actualVal)})`;
        } else {
          resultText = service.response_template
            ? applyTemplate(service.response_template, parsed)
            : (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
          resultText = normalizeHtml(resultText);
          if (!resultText) resultText = "(empty response)";
          success = true;
        }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Provider call failed";
    }
  }

  if (!success) {
    const refundedBalance = +(newBalance + price).toFixed(2);
    await supabase.from("profiles").update({ balance: refundedBalance }).eq("id", userId);
    await supabase.from("orders").update({
      status: "failed", error_message: errorMsg,
      result: rawData ? (typeof rawData === "string" ? rawData : JSON.stringify(rawData)) : null,
    }).eq("id", order.id);
    await supabase.from("transactions").insert({
      user_id: userId, type: "refund", amount: price, balance_after: refundedBalance,
      description: `Auto-refund: ${service.name}`, order_id: order.id,
    });
    notifyUser(supabase, userId,
      `❌ Check failed — ${service.name}`,
      `IMEI: ${imei}\nReason: ${errorMsg}\nRefunded: $${price.toFixed(2)}\nBalance: $${refundedBalance.toFixed(2)}`,
    );
    notifyUserEmail(supabase, userId, "order_rejected", {
      order_number: order.order_number, imei, service: service.name,
      error: errorMsg, refund: price.toFixed(2), balance: refundedBalance.toFixed(2),
    });
    return;
  }

  await supabase.from("orders").update({ status: "completed", result: resultText }).eq("id", order.id);
  notifyUser(supabase, userId,
    `✅ Check completed — ${service.name}`,
    `IMEI: ${imei}\n\n${resultText}\n\nCharged: $${price.toFixed(2)} · Balance: $${newBalance.toFixed(2)}`,
  );
  notifyUserEmail(supabase, userId, "order_success", {
    order_number: order.order_number, imei, service: service.name,
    result: resultText, charged: price.toFixed(2), balance: newBalance.toFixed(2),
  });
}

// -------- public entrypoints --------

// Async entrypoint: charge + create order, run upstream in background, return pending immediately.
// Caller is responsible for keeping the function alive (EdgeRuntime.waitUntil).
export async function executeCheckAsync(opts: {
  userId: string; serviceId: string; imei: string; source: "web" | "api";
}): Promise<{ status: number; body: any; background?: Promise<void> }> {
  const placed = await placeOrder(opts);
  if (!placed.ok) return { status: placed.status, body: placed.body };
  const ctx = placed.ctx;
  const background = runUpstream(ctx).catch((e) => console.error("runUpstream failed", e));
  return {
    status: 202,
    body: {
      status: "pending",
      order_id: ctx.order.id,
      imei: ctx.imei,
      service: ctx.service.name,
      balance_after: ctx.newBalance,
      message: "Order placed — track progress in the Orders tab.",
    },
    background,
  };
}

// Synchronous entrypoint (kept for API): waits for upstream and returns final status.
export async function executeCheck(opts: {
  userId: string; serviceId: string; imei: string; source: "web" | "api";
}) {
  const placed = await placeOrder(opts);
  if (!placed.ok) return { ok: false, status: placed.status, body: placed.body };
  const ctx = placed.ctx;
  await runUpstream(ctx);

  const { data: finalOrder } = await ctx.supabase.from("orders").select("status, result, error_message, supplier_reference").eq("id", ctx.order.id).maybeSingle();
  const status = finalOrder?.status ?? "pending";
  const { data: prof } = await ctx.supabase.from("profiles").select("balance").eq("id", ctx.userId).maybeSingle();
  const balance_after = Number(prof?.balance ?? ctx.newBalance);

  if (status === "completed") {
    return { ok: true, status: 200, body: { status: "completed", imei: ctx.imei, service: ctx.service.name, result: finalOrder?.result, balance_after, order_id: ctx.order.id } };
  }
  if (status === "failed") {
    // Return 200 so the client SDK can read the JSON body instead of throwing FunctionsHttpError.
    return { ok: true, status: 200, body: { status: "failed", error: finalOrder?.error_message ?? "Failed", balance_after, order_id: ctx.order.id } };
  }
  return { ok: true, status: 202, body: { status: "pending", imei: ctx.imei, service: ctx.service.name, reference: finalOrder?.supplier_reference, balance_after, order_id: ctx.order.id, message: "Order placed — awaiting result." } };
}
