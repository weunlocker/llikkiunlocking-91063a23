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
    if (k.toLowerCase() === "imei") return ""; // handled by caller usually
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

// -------- main --------

export async function executeCheck(opts: {
  userId: string;
  serviceId: string;
  imei: string;
  source: "web" | "api";
}) {
  const supabase = makeServiceClient();

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

  let resultText = "";
  let success = false;
  let errorMsg: string | null = null;
  let rawData: unknown = null;

  // Resolve supplier (if linked) — supplier overrides per-service api_url
  let supplier: Record<string, unknown> | null = null;
  if (service.supplier_id) {
    const { data: sup } = await supabase.from("suppliers").select("*").eq("id", service.supplier_id).maybeSingle();
    if (sup) {
      if (!sup.active) {
        await supabase.from("profiles").update({ balance }).eq("id", opts.userId);
        await supabase.from("orders").update({ status: "failed", error_message: "Supplier disabled" }).eq("id", order.id);
        return { ok: false, status: 503, body: { error: "Supplier disabled" } };
      }
      supplier = sup;
    }
  }

  const hasUpstream = !!supplier || !!service.api_url;
  if (!hasUpstream) {
    resultText = `Demo mode — no upstream API configured for "${service.name}".\nIMEI: ${opts.imei}\nResult: simulated success.`;
    success = true;
  } else {
    try {
      let url: string;
      const headers: Record<string, string> = { "Accept": "application/json, text/plain, */*" };
      const init: RequestInit = { method: "GET", headers };

      if (supplier) {
        // Build request from supplier
        url = String(supplier.endpoint_url);
        if (supplier.type === "dhru") {
          // Dhru API: POST x-www-form-urlencoded with username, apikey, action, service, imei
          init.method = "POST";
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          const action = (service.supplier_action || "").toString();
          const params = new URLSearchParams();
          params.set("username", String(supplier.dhru_username ?? ""));
          params.set("apikey", String(supplier.dhru_api_key ?? ""));
          params.set("action", "placeimeiorder");
          params.set("service", action);
          params.set("imei", opts.imei);
          init.body = params.toString();
        } else {
          // generic supplier: substitute {IMEI} and {ACTION} in endpoint
          url = url
            .replace(/\{IMEI\}/gi, encodeURIComponent(opts.imei))
            .replace(/\{ACTION\}/gi, encodeURIComponent(String(service.supplier_action ?? "")));
          init.method = service.api_method || "GET";
          const customHeaders = (service.api_headers ?? {}) as Record<string, string>;
          Object.assign(headers, customHeaders);
          if (init.method === "POST") {
            headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
            init.body = (service.api_request_body || JSON.stringify({ imei: opts.imei }))
              .replace(/\{IMEI\}/gi, opts.imei)
              .replace(/\{ACTION\}/gi, String(service.supplier_action ?? ""));
          }
        }
      } else {
        // Direct per-service API
        url = service.api_url
          .replace(/\{IMEI\}/gi, encodeURIComponent(opts.imei))
          .replace(/\{imei\}/g, encodeURIComponent(opts.imei));
        const customHeaders = (service.api_headers ?? {}) as Record<string, string>;
        Object.assign(headers, customHeaders);
        init.method = service.api_method || "GET";
        if (init.method === "POST") {
          if (service.api_request_body && service.api_request_body.trim()) {
            const bodyTpl = service.api_request_body
              .replace(/\{IMEI\}/gi, opts.imei)
              .replace(/\{imei\}/g, opts.imei);
            if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
            init.body = bodyTpl;
          } else {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify({ imei: opts.imei });
          }
        }
      }
      const resp = await fetch(url, init);
      const ct = resp.headers.get("content-type") || "";
      const raw = ct.includes("json") ? await resp.json() : await resp.text();
      rawData = raw;

      // Try to parse string responses as JSON for rules / templating
      let parsed: unknown = raw;
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          try { parsed = JSON.parse(trimmed); rawData = parsed; } catch { /* keep as string */ }
        }
      }

      if (!resp.ok) {
        errorMsg = `Provider returned ${resp.status}: ${typeof raw === "string" ? raw.slice(0, 500) : JSON.stringify(raw).slice(0, 500)}`;
      } else {
        // Evaluate admin-defined success rules
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
    await supabase.from("profiles").update({ balance: refundedBalance }).eq("id", opts.userId);
    await supabase.from("orders").update({ status: "failed", error_message: errorMsg, result: rawData ? (typeof rawData === "string" ? rawData : JSON.stringify(rawData)) : null }).eq("id", order.id);
    await supabase.from("transactions").insert({
      user_id: opts.userId, type: "refund", amount: price, balance_after: refundedBalance,
      description: `Auto-refund: ${service.name}`, order_id: order.id,
    });
    notifyUser(supabase, opts.userId,
      `❌ Check failed — ${service.name}`,
      `IMEI: ${opts.imei}\nReason: ${errorMsg}\nRefunded: $${price.toFixed(2)}\nBalance: $${refundedBalance.toFixed(2)}`,
    );
    return { ok: false, status: 502, body: { status: "failed", error: errorMsg, balance_after: refundedBalance, order_id: order.id } };
  }

  await supabase.from("orders").update({ status: "completed", result: resultText }).eq("id", order.id);
  notifyUser(supabase, opts.userId,
    `✅ Check completed — ${service.name}`,
    `IMEI: ${opts.imei}\n\n${resultText}\n\nCharged: $${price.toFixed(2)} · Balance: $${newBalance.toFixed(2)}`,
  );
  return {
    ok: true, status: 200,
    body: { status: "completed", imei: opts.imei, service: service.name, result: resultText, balance_after: newBalance, order_id: order.id },
  };
}
