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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
      const params = new URLSearchParams();
      const username = String(sup.dhru_username ?? "");
      const apiKey = String(sup.dhru_api_key ?? "");
      const action = String(svc.supplier_action ?? "");
      const isServer = svc?.service_type === "server";
      const dhruAction = isServer ? "placeserverorder" : "placeimeiorder";
      const submittedFields: Record<string, string> = (o.fields && typeof o.fields === "object") ? o.fields : {};

      if (sup.api_format === "bulk") {
        const payload: Record<string, unknown> = { username, apikey: apiKey, action: dhruAction, service: action };
        if (isServer) {
          payload.custom = submittedFields;
          if (!submittedFields.imei && o.imei) payload.imei = o.imei;
        } else {
          payload.imei = o.imei;
        }
        params.set("data", JSON.stringify(payload));
      } else if (sup.api_format === "v6") {
        params.set("apiaccesskey", apiKey);
        params.set("action", dhruAction);
        params.set("requestformat", "JSON");
        if (username) params.set("username", username);
        let inner = `<ID>${escapeXml(action)}</ID>`;
        if (isServer) {
          for (const [k, v] of Object.entries(submittedFields)) {
            inner += `<${escapeXml(k)}>${escapeXml(String(v ?? ""))}</${escapeXml(k)}>`;
          }
          if (!submittedFields.imei && o.imei) inner += `<IMEI>${escapeXml(o.imei)}</IMEI>`;
        } else {
          inner += `<IMEI>${escapeXml(o.imei)}</IMEI>`;
        }
        params.set("parameters", `<PARAMETERS>${inner}</PARAMETERS>`);
      } else {
        params.set("username", username);
        params.set("apikey", apiKey);
        params.set("action", dhruAction);
        params.set("service", action);
        if (isServer) {
          for (const [k, v] of Object.entries(submittedFields)) {
            params.set(k, String(v ?? ""));
          }
          if (!submittedFields.imei && o.imei) params.set("imei", o.imei);
        } else {
          params.set("imei", o.imei);
        }
      }
      const r = await fetch(sup.endpoint_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const text = await r.text();
      let parsed: any = text;
      try { parsed = JSON.parse(text); } catch { /* keep */ }

      const errBlock = parsed?.ERROR ?? parsed?.error;
      if (errBlock) {
        const eArr = Array.isArray(errBlock) ? errBlock[0] : errBlock;
        const reason = String(eArr?.MESSAGE ?? eArr?.message ?? eArr?.FACTOR ?? "Rejected by supplier");
        await sb.from("orders").update({ error_message: reason }).eq("id", o.id);
        continue;
      }
      const findRef = (n: any): string | null => {
        if (!n || typeof n !== "object") return null;
        const ref = n.REFERENCEID ?? n.referenceid ?? n.REFERENCE ?? n.reference ?? n.ID ?? n.id;
        if (ref != null && (typeof ref === "string" || typeof ref === "number")) return String(ref);
        for (const v of Object.values(n)) { const r2 = findRef(v); if (r2) return r2; }
        return null;
      };
      const refId = findRef(parsed?.SUCCESS ?? parsed?.success ?? parsed);
      if (refId) {
        await sb.from("orders").update({
          status: "in_process",
          supplier_reference: refId,
          result: `Order placed with supplier (ref ${refId}). Awaiting result…`,
          error_message: null,
        }).eq("id", o.id);
        placed++;
      } else {
        await sb.from("orders").update({
          error_message: "Dhru did not return reference id",
        }).eq("id", o.id);
      }
    } catch (e) {
      console.error("Place error for order", o.id, e);
    }
  }

  // Step 2: poll pending orders that have a supplier reference (async)
  const { data: pending, error } = await sb
    .from("orders")
    .select("id, order_number, user_id, imei, price_charged, supplier_reference, poll_attempts, service_id, services(name, response_template, success_rules, supplier_id, service_type, suppliers(type, endpoint_url, dhru_username, dhru_api_key, api_format))")
    .in("status", ["pending", "in_process"])
    .not("supplier_reference", "is", null)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) return json(500, { error: error.message });
  if (!pending || pending.length === 0) return json(200, { placed, polled: 0 });

  let completed = 0, failed = 0, stillPending = 0;

  for (const o of pending as any[]) {
    const svc = o.services;
    const sup = svc?.suppliers;
    if (!sup || (sup.type !== "dhru" && sup.type !== "goimeicheck")) continue;

    try {
      let r: Response;
      if (sup.type === "goimeicheck") {
        const base = String(sup.endpoint_url || "https://api.goimeicheck.com").replace(/\/+$/, "");
        const qs = new URLSearchParams({
          api_key: String(sup.dhru_api_key ?? ""),
          tran_id: String(o.supplier_reference),
        });
        r = await fetch(`${base}/api/get-order/?${qs.toString()}`, { method: "GET" });
      } else {
        const params = new URLSearchParams();
        const username = sup.dhru_username ?? "";
        const apiKey = sup.dhru_api_key ?? "";
        const refId = String(o.supplier_reference);
        const getAction = svc?.service_type === "server" ? "getserverorder" : "getimeiorder";
        if (sup.api_format === "bulk") {
          params.set("data", JSON.stringify({
            username, apikey: apiKey,
            action: getAction,
            id: refId,
          }));
        } else if (sup.api_format === "v6") {
          params.set("apiaccesskey", apiKey);
          params.set("action", getAction);
          params.set("requestformat", "JSON");
          if (username) params.set("username", username);
          params.set("ID", refId);
          params.set("parameters", `<PARAMETERS><ID>${escapeXml(refId)}</ID></PARAMETERS>`);
        } else {
          params.set("username", username);
          params.set("apikey", apiKey);
          params.set("action", getAction);
          params.set("id", refId);
        }
        r = await fetch(sup.endpoint_url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
      }
      const text = await r.text();
      let parsed: any = text;
      try { parsed = JSON.parse(text); } catch { /* keep as string */ }

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
      } else if (parsed && (parsed.ERROR ?? parsed.error)) {
        status = "rejected";
        const errArr = parsed.ERROR ?? parsed.error;
        resultBlob = Array.isArray(errArr) ? errArr[0] : errArr;
      }

      const newAttempts = (o.poll_attempts ?? 0) + 1;
      const statusText = (status ?? "").toLowerCase().trim();
      const codeText = (resultBlob?.CODE ?? resultBlob?.code ?? resultBlob?.MESSAGE ?? resultBlob?.message ?? "").toString().toLowerCase().trim();
      const replyValue = resultBlob?.REPLY ?? resultBlob?.reply ?? resultBlob?.RESULT ?? resultBlob?.result;
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

      if (isDone) {
        const replyText: string =
          resultBlob?.REPLY ?? resultBlob?.reply ??
          resultBlob?.RESULT ?? resultBlob?.result ??
          resultBlob?.CODE ?? resultBlob?.code ??
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
          (resultBlob?.MESSAGE ?? resultBlob?.message ?? resultBlob?.REPLY ?? resultBlob?.reply ??
           resultBlob?.CODE ?? resultBlob?.code ?? "Rejected by supplier").toString();
        const reason = normalizeHtml(reasonRaw) || "Rejected by supplier";
        const replyText: string =
          resultBlob?.REPLY ?? resultBlob?.reply ??
          resultBlob?.CODE ?? resultBlob?.code ??
          resultBlob?.MESSAGE ?? resultBlob?.message ??
          (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
        const templated = svc.response_template
          ? applyTemplate(svc.response_template, parsed)
          : (typeof replyText === "string" ? replyText : JSON.stringify(replyText, null, 2));
        const finalText = normalizeHtml(typeof templated === "string" ? templated : JSON.stringify(templated, null, 2)) || reason;
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
