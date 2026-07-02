// Polls all pending Dhru orders. Triggered every 30s by pg_cron.
// Updates each order: pending -> completed/failed, refunds on failure, notifies user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyUserEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function getByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(/[.\[\]]+/).filter(Boolean);
  let cur: any = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
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

function normalizeHtml(s: string): string {
  // Preserve color markup so the client can render it.
  s = s.replace(
    /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*([^;"']+)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_m, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  s = s.replace(
    /<font\b[^>]*\bcolor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
    (_m, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  return s
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isGenericUnlockNotFound(value: string): boolean {
  return /unlock\s*c+ode\s*not\s*found|unlockc+ode\s*not\s*found/i.test(value);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type DhruFormat = "v6" | "classic" | "bulk";

const DHRU_FORMATS: DhruFormat[] = ["v6", "classic", "bulk"];

function dhruFormats(apiFormat: unknown): DhruFormat[] {
  const preferred = String(apiFormat ?? "").toLowerCase() as DhruFormat;
  return DHRU_FORMATS.includes(preferred)
    ? [preferred, ...DHRU_FORMATS.filter((f) => f !== preferred)]
    : DHRU_FORMATS;
}

function endpointCandidates(rawEndpoint: string): string[] {
  const out: string[] = [];
  const add = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };
  add(rawEndpoint);
  try {
    const u = new URL(rawEndpoint.trim());
    const barePath = u.pathname === "/" || u.pathname === "";
    if (barePath) {
      add(`${u.origin}/supplier_api.php`);
      add(`${u.origin}/api/index.php`);
    }
    if (u.hostname.startsWith("www.")) {
      add(`${u.protocol}//server.${u.hostname.slice(4)}/supplier_api.php`);
    }
  } catch { /* keep original only */ }
  return out;
}

function dhruErrorMessage(parsed: any): string | null {
  const errBlock = parsed?.ERROR ?? parsed?.error;
  if (!errBlock) return null;
  const eArr = Array.isArray(errBlock) ? errBlock[0] : errBlock;
  return String(eArr?.MESSAGE ?? eArr?.message ?? eArr?.FACTOR ?? eArr?.factor ?? "Supplier returned an error");
}

function isRetryableDhruFormatError(message: string): boolean {
  return /access\s*key|api\s*key|username|credential|auth|command\s*not\s*found|invalid\s*action|action\s*request|unknown\s*action|missing\s*(key|api)/i.test(message);
}

function findRef(n: any): string | null {
  if (!n || typeof n !== "object") return null;
  const ref = n.REFERENCEID ?? n.referenceid ?? n.REFERENCE ?? n.reference ?? n.ID ?? n.id;
  if (ref != null && (typeof ref === "string" || typeof ref === "number")) return String(ref);
  for (const v of Object.values(n)) {
    const r2 = findRef(v);
    if (r2) return r2;
  }
  return null;
}

function makeDhruPlaceBody(format: DhruFormat, ctx: {
  username: string;
  apiKey: string;
  action: string;
  serviceCode: string;
  imei: string | null;
  isServer: boolean;
  fields: Record<string, string>;
}): string {
  const params = new URLSearchParams();
  if (format === "bulk") {
    const payload: Record<string, unknown> = {
      username: ctx.username,
      apikey: ctx.apiKey,
      apiaccesskey: ctx.apiKey,
      action: ctx.action,
      service: ctx.serviceCode,
    };
    if (ctx.isServer) {
      payload.custom = ctx.fields;
      if (!ctx.fields.imei && ctx.imei) payload.imei = ctx.imei;
    } else {
      payload.imei = ctx.imei;
    }
    params.set("data", JSON.stringify(payload));
  } else if (format === "v6") {
    params.set("apiaccesskey", ctx.apiKey);
    params.set("action", ctx.action);
    params.set("requestformat", "JSON");
    if (ctx.username) params.set("username", ctx.username);
    let inner = `<ID>${escapeXml(ctx.serviceCode)}</ID>`;
    if (ctx.isServer) {
      for (const [k, v] of Object.entries(ctx.fields)) {
        inner += `<${escapeXml(k)}>${escapeXml(String(v ?? ""))}</${escapeXml(k)}>`;
      }
      if (!ctx.fields.imei && ctx.imei) inner += `<IMEI>${escapeXml(ctx.imei)}</IMEI>`;
    } else if (ctx.imei) {
      inner += `<IMEI>${escapeXml(ctx.imei)}</IMEI>`;
    }
    params.set("parameters", `<PARAMETERS>${inner}</PARAMETERS>`);
  } else {
    params.set("username", ctx.username);
    params.set("apikey", ctx.apiKey);
    params.set("apiaccesskey", ctx.apiKey);
    params.set("action", ctx.action);
    params.set("service", ctx.serviceCode);
    if (ctx.isServer) {
      for (const [k, v] of Object.entries(ctx.fields)) params.set(k, String(v ?? ""));
      if (!ctx.fields.imei && ctx.imei) params.set("imei", ctx.imei);
    } else if (ctx.imei) {
      params.set("imei", ctx.imei);
    }
  }
  return params.toString();
}

function makeDhruStatusBody(format: DhruFormat, ctx: {
  username: string;
  apiKey: string;
  action: string;
  refId: string;
}): string {
  const params = new URLSearchParams();
  if (format === "bulk") {
    params.set("data", JSON.stringify({
      username: ctx.username,
      apikey: ctx.apiKey,
      apiaccesskey: ctx.apiKey,
      action: ctx.action,
      id: ctx.refId,
      ID: ctx.refId,
    }));
  } else if (format === "v6") {
    params.set("apiaccesskey", ctx.apiKey);
    params.set("action", ctx.action);
    params.set("requestformat", "JSON");
    if (ctx.username) params.set("username", ctx.username);
    params.set("ID", ctx.refId);
    params.set("parameters", `<PARAMETERS><ID>${escapeXml(ctx.refId)}</ID></PARAMETERS>`);
  } else {
    params.set("username", ctx.username);
    params.set("apikey", ctx.apiKey);
    params.set("apiaccesskey", ctx.apiKey);
    params.set("action", ctx.action);
    params.set("id", ctx.refId);
    params.set("ID", ctx.refId);
  }
  return params.toString();
}

// Per admin policy: never auto-fail or auto-refund. Keep polling forever
// until supplier returns a final success. On supplier error/reject, store the
// error message but keep status=pending so an admin can Reprocess or Switch API.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // No auth required: this function takes no user input from the request body,
  // performs bounded work (poll/place pending orders), and is invoked by pg_cron.
  // Triggering it manually only accelerates the next poll — harmless.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  // Step 1: place any pending Dhru orders that don't yet have a supplier_reference
  const { data: toPlace } = await sb
    .from("orders")
    .select("id, imei, service_id, fields, services(supplier_action, supplier_id, service_type, custom_fields, suppliers(type, endpoint_url, dhru_username, dhru_api_key, api_format))")
    .eq("status", "pending")
    .is("supplier_reference", null)
    .order("created_at", { ascending: true })
    .limit(25);

  let placed = 0;
  for (const o of (toPlace ?? []) as any[]) {
    const svc = o.services;
    const sup = svc?.suppliers;
    if (!sup || sup.type !== "dhru") continue;
    try {
      const username = String(sup.dhru_username ?? "");
      const apiKey = String(sup.dhru_api_key ?? "");
      const action = String(svc.supplier_action ?? "");
      const isServer = svc?.service_type === "server";
      const dhruAction = isServer ? "placeserverorder" : "placeimeiorder";
      const submittedFields: Record<string, string> = (o.fields && typeof o.fields === "object") ? o.fields : {};

      let refId: string | null = null;
      let lastReason = "Dhru did not return reference id";
      let usedFormat: DhruFormat | null = null;
      let usedEndpoint = String(sup.endpoint_url ?? "");
      for (const endpoint of endpointCandidates(String(sup.endpoint_url ?? ""))) {
        for (const format of dhruFormats(sup.api_format)) {
          const body = makeDhruPlaceBody(format, { username, apiKey, action: dhruAction, serviceCode: action, imei: o.imei, isServer, fields: submittedFields });
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json, text/plain, */*" },
            body,
          });
          const text = await r.text();
          let parsed: any = text;
          try { parsed = JSON.parse(text); } catch { /* keep */ }
          const err = dhruErrorMessage(parsed);
          if (err) {
            lastReason = err;
            if (isRetryableDhruFormatError(err)) continue;
            break;
          }
          refId = findRef(parsed?.SUCCESS ?? parsed?.success ?? parsed);
          if (refId) {
            usedFormat = format;
            usedEndpoint = endpoint;
            break;
          }
        }
        if (refId) break;
      }
      if (refId) {
        if (usedFormat && (usedFormat !== sup.api_format || usedEndpoint !== sup.endpoint_url)) {
          sb.from("suppliers").update({ api_format: usedFormat, endpoint_url: usedEndpoint }).eq("id", svc.supplier_id).then(() => {});
        }
        await sb.from("orders").update({
          status: "in_process",
          supplier_reference: refId,
          result: `Order placed with supplier (ref ${refId}). Awaiting result…`,
          error_message: null,
        }).eq("id", o.id);
        placed++;
      } else {
        await sb.from("orders").update({
          error_message: lastReason,
        }).eq("id", o.id);
      }
    } catch (e) {
      console.error("Place error for order", o.id, e);
    }
  }

  // Step 2: poll pending orders that have a supplier reference (async)
  const orderSelect = "id, order_number, user_id, imei, price_charged, supplier_reference, poll_attempts, status, result, service_id, services(name, response_template, success_rules, supplier_id, service_type, suppliers(type, endpoint_url, dhru_username, dhru_api_key, api_format))";
  const { data: activePending, error } = await sb
    .from("orders")
    .select(orderSelect)
    .in("status", ["pending", "in_process"])
    .not("supplier_reference", "is", null)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(50);

  const { data: genericFailed, error: genericFailedError } = await sb
    .from("orders")
    .select(orderSelect)
    .eq("status", "failed")
    .not("supplier_reference", "is", null)
    .or("result.ilike.%unlock%not%found%,error_message.ilike.%unlock%not%found%")
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(25);

  if (error) return json(500, { error: error.message });
  if (genericFailedError) return json(500, { error: genericFailedError.message });
  const pending = [...(activePending ?? []), ...(genericFailed ?? [])];
  if (!pending || pending.length === 0) return json(200, { placed, polled: 0 });

  let completed = 0, failed = 0, stillPending = 0;

  for (const o of pending as any[]) {
    const svc = o.services;
    const sup = svc?.suppliers;
    if (!sup || (sup.type !== "dhru" && sup.type !== "goimeicheck")) continue;
    if (o.status === "failed" && !isGenericUnlockNotFound(String(o.result ?? ""))) continue;

    try {
      let text = "";
      let parsed: any = null;
      if (sup.type === "goimeicheck") {
        const base = String(sup.endpoint_url || "https://api.goimeicheck.com").replace(/\/+$/, "");
        const qs = new URLSearchParams({
          api_key: String(sup.dhru_api_key ?? ""),
          tran_id: String(o.supplier_reference),
        });
        const r = await fetch(`${base}/api/get-order/?${qs.toString()}`, { method: "GET" });
        text = await r.text();
        parsed = text;
        try { parsed = JSON.parse(text); } catch { /* keep as string */ }
      } else {
        const username = sup.dhru_username ?? "";
        const apiKey = sup.dhru_api_key ?? "";
        const refId = String(o.supplier_reference);
        const getAction = svc?.service_type === "server" ? "getserverorder" : "getimeiorder";
        let lastErr = "Supplier returned no response";
        let usedFormat: DhruFormat | null = null;
        let usedEndpoint = String(sup.endpoint_url ?? "");
        let accepted = false;
        for (const endpoint of endpointCandidates(String(sup.endpoint_url ?? ""))) {
          for (const format of dhruFormats(sup.api_format)) {
            const body = makeDhruStatusBody(format, { username: String(username), apiKey: String(apiKey), action: getAction, refId });
            const r = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json, text/plain, */*" },
              body,
            });
            text = await r.text();
            parsed = text;
            try { parsed = JSON.parse(text); } catch { /* keep as string */ }
            const err = dhruErrorMessage(parsed);
            if (err) {
              lastErr = err;
              if (isRetryableDhruFormatError(err)) continue;
            }
            accepted = true;
            usedFormat = format;
            usedEndpoint = endpoint;
            break;
          }
          if (accepted) break;
        }
        if (!accepted) {
          parsed = { ERROR: [{ MESSAGE: lastErr }] };
          text = JSON.stringify(parsed);
        } else if (usedFormat && (usedFormat !== sup.api_format || usedEndpoint !== sup.endpoint_url)) {
          sb.from("suppliers").update({ api_format: usedFormat, endpoint_url: usedEndpoint }).eq("id", svc.supplier_id).then(() => {});
        }
      }

      // GoIMEICheck branch
      if (sup.type === "goimeicheck") {
        const newAttempts = (o.poll_attempts ?? 0) + 1;
        const respObj = parsed?.response && typeof parsed.response === "object" ? parsed.response : null;
        const statusStr = String(parsed?.status ?? "").toLowerCase();
        if (statusStr === "success" && respObj) {
          const replyRaw = respObj.result ?? respObj.message;
          const hasResult = replyRaw != null && String(replyRaw).trim() !== "" && String(replyRaw).toLowerCase() !== "pending";
          if (hasResult) {
            const templated = svc.response_template ? applyTemplate(svc.response_template, parsed) : String(replyRaw);
            const finalText = normalizeHtml(templated) || "(empty response)";
            await sb.from("orders").update({
              status: "completed", result: finalText,
              last_polled_at: new Date().toISOString(), poll_attempts: newAttempts,
            }).eq("id", o.id);
            sb.functions.invoke("telegram-notify", { body: {
              user_id: o.user_id,
              subject: `✅ ${o.imei}`,
              body: `${finalText}\n\n${svc.name}`,
              format: "plain",
            }}).catch(() => {});
            notifyUserEmail(sb, o.user_id, "order_success", {
              order_number: o.order_number, imei: o.imei, service: svc.name,
              result: finalText, charged: Number(o.price_charged).toFixed(2),
            });
            completed++;
          } else {
            await sb.from("orders").update({
              last_polled_at: new Date().toISOString(), poll_attempts: newAttempts,
            }).eq("id", o.id);
            stillPending++;
          }
        } else {
          // status != success → mark as failed (final, no auto-reprocess).
          const reason = String(respObj?.message ?? respObj?.error ?? parsed?.message ?? parsed?.error ?? "Rejected by supplier");
          const finalText = normalizeHtml(reason) || reason;
          await sb.from("orders").update({
            status: "failed",
            error_message: reason.slice(0, 500),
            result: finalText.slice(0, 4000),
            last_polled_at: new Date().toISOString(), poll_attempts: newAttempts,
          }).eq("id", o.id);
          sb.functions.invoke("telegram-notify", { body: {
            user_id: o.user_id, subject: `❌ ${o.imei}`,
            body: `${finalText}\n\n${svc.name}`, format: "plain",
          }}).catch(() => {});
          failed++;
        }
        continue;
      }

      // Dhru order status lives at SUCCESS[0].LIST.<refid>.STATUS or SUCCESS.<refid>.STATUS
      // Common values: "Success" / "Pending" / "Processing" / "Rejected" / "Cancelled"
      let status: string | undefined;
      let resultBlob: any = null;
      const success = (parsed && (parsed.SUCCESS ?? parsed.success)) as any;
      if (success) {
        // Walk to find STATUS
        const findStatus = (n: any): any => {
          if (!n || typeof n !== "object") return null;
          if (n.STATUS || n.status) { return n; }
          for (const v of Object.values(n)) { const r2 = findStatus(v); if (r2) return r2; }
          return null;
        };
        resultBlob = findStatus(success);
        status = (resultBlob?.STATUS ?? resultBlob?.status ?? "").toString().toLowerCase();
      }
      const hasErrorBlock = !!(parsed && (parsed.ERROR ?? parsed.error));
      if (!success && hasErrorBlock) {
        status = "rejected";
        const errArr = parsed.ERROR ?? parsed.error;
        resultBlob = Array.isArray(errArr) ? errArr[0] : errArr;
      }

      const newAttempts = (o.poll_attempts ?? 0) + 1;
      const findFirstValue = (n: any, keys: string[]): any => {
        if (!n || typeof n !== "object") return null;
        for (const key of keys) {
          const value = n[key];
          if (value != null && String(value).trim() !== "") return value;
        }
        for (const value of Object.values(n)) {
          const found = findFirstValue(value, keys);
          if (found != null && String(found).trim() !== "") return found;
        }
        return null;
      };
      const supplierCodeFromFullResponse = findFirstValue(success ?? parsed, ["CODE", "code"]);
      if (resultBlob && supplierCodeFromFullResponse != null && resultBlob.CODE == null && resultBlob.code == null) {
        resultBlob.CODE = supplierCodeFromFullResponse;
      }
      const statusText = (status ?? "").toLowerCase().trim();
      const codeText = (resultBlob?.CODE ?? resultBlob?.code ?? resultBlob?.MESSAGE ?? resultBlob?.message ?? "").toString().toLowerCase().trim();
      const replyValue = resultBlob?.REPLY ?? resultBlob?.reply ?? resultBlob?.RESULT ?? resultBlob?.result;
      const codeValue = resultBlob?.CODE ?? resultBlob?.code;
      const codeValueText = codeValue != null ? String(codeValue).trim() : "";
      const hasSupplierCode = codeValueText !== "" && !isGenericUnlockNotFound(codeValueText);
      const hasFinalReply = replyValue != null && String(replyValue).trim() !== "" && !/^(pending|processing|in process)$/i.test(String(replyValue).trim());
      // Supplier numeric status codes: 1=pending, 2=unprocessed, 3=success, 4=rejected
      // Supplier numeric status codes: 0=pending, 1=inprocess, 2=unprocessed, 3=rejected, 4=success
      // Suppliers often return rejection text inside CODE/MESSAGE even with a "success"-looking
      // string STATUS. Scan reply + code + message for known rejection phrases.
      const replyStr = typeof replyValue === "string" ? replyValue : (replyValue != null ? JSON.stringify(replyValue) : "");
      const codeStr = (resultBlob?.CODE ?? resultBlob?.code ?? "").toString();
      const messageStr = (resultBlob?.MESSAGE ?? resultBlob?.message ?? "").toString();
      const replyTextForScan = `${replyStr} ${codeStr} ${messageStr}`.toLowerCase();
      const rejectionPhrases = [
        "does not correspond", "not correspond", "not found", "no encontrado",
        "no data found", "no record", "no records", "not marketed",
        "invalid imei", "imei invalid", "imei is invalid", "imei not valid",
        "not eligible", "not supported", "no result", "no results",
        "sorry", "unable to", "cannot process", "try again", "device not found",
        "wrong imei", "bad imei", "incorrect imei",
      ];
      const replyLooksRejected = replyTextForScan.trim().length > 0 &&
        rejectionPhrases.some((p) => replyTextForScan.includes(p));
      const isDone = (["success", "completed", "complete", "available", "done", "finished", "4"].includes(statusText)
        || ["success", "completed", "complete", "available", "done", "finished"].some((word) => codeText.includes(word))
        || (hasFinalReply && !["rejected", "cancelled", "canceled", "failed", "error", "3"].includes(statusText)))
        && !replyLooksRejected;
      const isFailed = ["rejected", "cancelled", "canceled", "failed", "error", "3"].includes(statusText)
        || ["rejected", "cancelled", "canceled", "failed", "error"].some((word) => codeText.includes(word))
        || replyLooksRejected;

      // Some suppliers send only STATUS first, then return the real customer-facing
      // CODE on a later poll. Do not finalize the order with a generic/default
      // message such as "Unlockcode Not Found" while CODE is still missing.
      const genericFallbackOnly = !hasSupplierCode && isGenericUnlockNotFound(codeText);
      const finalStatusWithoutSupplierCode = !hasErrorBlock && !hasSupplierCode && !hasFinalReply && [
        "success", "completed", "complete", "available", "done", "finished",
        "rejected", "cancelled", "canceled", "failed", "error", "3", "4",
      ].includes(statusText);
      if (genericFallbackOnly || finalStatusWithoutSupplierCode) {
        await sb.from("orders").update({
          status: "in_process",
          result: "Waiting for supplier CODE response…",
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
          error_message: "Waiting for supplier CODE response",
        }).eq("id", o.id);
        stillPending++;
        continue;
      }

      if (isDone) {
        const replyText: string =
          resultBlob?.CODE ?? resultBlob?.code ??
          resultBlob?.REPLY ?? resultBlob?.reply ??
          resultBlob?.RESULT ?? resultBlob?.result ??
          resultBlob?.MESSAGE ?? resultBlob?.message ??
          (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
        const templated = svc.response_template
          ? applyTemplate(svc.response_template, parsed)
          : (typeof replyText === "string" ? replyText : JSON.stringify(replyText, null, 2));
        const finalText = normalizeHtml(typeof templated === "string" ? templated : JSON.stringify(templated, null, 2)) || "(empty response)";

        await sb.from("orders").update({
          status: "completed",
          result: finalText,
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
        }).eq("id", o.id);

        // Notify user
        sb.functions.invoke("telegram-notify", { body: {
          user_id: o.user_id,
          subject: `✅ ${o.imei}`,
          body: `${finalText}\n\n${svc.name}`,
          format: "plain",
        }}).catch(() => {});
        notifyUserEmail(sb, o.user_id, "order_success", {
          order_number: o.order_number, imei: o.imei, service: svc.name,
          result: finalText, charged: Number(o.price_charged).toFixed(2),
        });
        completed++;
      } else if (isFailed) {
        // Supplier returned an error — keep order PENDING (admin can reprocess
        // or switch supplier API). Record a readable error + result; do NOT refund.
        const reasonRaw: string =
          (resultBlob?.CODE ?? resultBlob?.code ?? resultBlob?.REPLY ?? resultBlob?.reply ??
           resultBlob?.RESULT ?? resultBlob?.result ?? resultBlob?.MESSAGE ?? resultBlob?.message ?? "Rejected by supplier").toString();
        const reason = normalizeHtml(reasonRaw) || "Rejected by supplier";
        // Show exactly the supplier CODE response when present.
        const replyText: string = codeValue != null && String(codeValue).trim()
          ? String(codeValue)
          : (resultBlob?.REPLY ?? resultBlob?.reply ?? resultBlob?.RESULT ?? resultBlob?.result ?? resultBlob?.MESSAGE ?? resultBlob?.message ??
             (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2))).toString();
        // For failed orders, ALWAYS show the raw supplier response (not the
        // service response_template — that template is designed for success
        // payloads and often renders "Unlockcode Not Found" for rejections).
        const finalText = normalizeHtml(replyText) || reason;
        await sb.from("orders").update({
          status: "failed",
          error_message: reason.slice(0, 500),
          result: finalText.slice(0, 4000),
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
        }).eq("id", o.id);
        sb.functions.invoke("telegram-notify", { body: {
          user_id: o.user_id, subject: `❌ ${o.imei}`,
          body: `${finalText}\n\n${svc.name}`, format: "plain",
        }}).catch(() => {});
        failed++;
      } else {
        await sb.from("orders").update({
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
        }).eq("id", o.id);
        stillPending++;
      }
    } catch (e) {
      await sb.from("orders").update({
        last_polled_at: new Date().toISOString(),
        poll_attempts: (o.poll_attempts ?? 0) + 1,
      }).eq("id", o.id);
      stillPending++;
      console.error("Poll error for order", o.id, e);
    }
  }

  return json(200, { placed, polled: pending.length, completed, failed, stillPending });
});
