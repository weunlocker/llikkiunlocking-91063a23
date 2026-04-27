// Polls all pending Dhru orders. Triggered every 30s by pg_cron.
// Updates each order: pending -> completed/failed, refunds on failure, notifies user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function normalizeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Maximum attempts before we give up (30s interval × 240 = 2 hours)
const MAX_ATTEMPTS = 240;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Pull pending orders that have a supplier reference (i.e. async)
  const { data: pending, error } = await sb
    .from("orders")
    .select("id, user_id, imei, price_charged, supplier_reference, poll_attempts, service_id, services(name, response_template, success_rules, supplier_id, suppliers(type, endpoint_url, dhru_username, dhru_api_key, api_format))")
    .eq("status", "pending")
    .not("supplier_reference", "is", null)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) return json(500, { error: error.message });
  if (!pending || pending.length === 0) return json(200, { polled: 0 });

  let completed = 0, failed = 0, stillPending = 0;

  for (const o of pending as any[]) {
    const svc = o.services;
    const sup = svc?.suppliers;
    if (!sup || sup.type !== "dhru") continue;

    try {
      const params = new URLSearchParams();
      params.set("username", sup.dhru_username ?? "");
      params.set("apikey", sup.dhru_api_key ?? "");
      params.set("action", "getimeiorder");
      params.set("id", String(o.supplier_reference));
      const r = await fetch(sup.endpoint_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const text = await r.text();
      let parsed: any = text;
      try { parsed = JSON.parse(text); } catch { /* keep as string */ }

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
      const isDone = status === "success" || status === "completed" || status === "complete";
      const isFailed = status === "rejected" || status === "cancelled" || status === "failed" || status === "error";

      if (isDone) {
        const replyText: string =
          resultBlob?.REPLY ?? resultBlob?.reply ??
          resultBlob?.RESULT ?? resultBlob?.result ??
          resultBlob?.MESSAGE ?? resultBlob?.message ??
          (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
        const finalText = normalizeHtml(typeof replyText === "string" ? replyText : JSON.stringify(replyText, null, 2)) || "(empty response)";

        await sb.from("orders").update({
          status: "completed",
          result: finalText,
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
        }).eq("id", o.id);

        // Notify user
        sb.functions.invoke("telegram-notify", { body: {
          user_id: o.user_id,
          subject: `✅ Check completed — ${svc.name}`,
          body: `IMEI: ${o.imei}\n\n${finalText}\n\nCharged: $${Number(o.price_charged).toFixed(2)}`,
        }}).catch(() => {});
        completed++;
      } else if (isFailed || newAttempts >= MAX_ATTEMPTS) {
        const reason: string =
          (isFailed ? (resultBlob?.MESSAGE ?? resultBlob?.message ?? resultBlob?.REPLY ?? resultBlob?.reply ?? "Rejected by supplier") : "Timed out waiting for supplier")
            .toString();

        // Refund
        const { data: prof } = await sb.from("profiles").select("balance").eq("id", o.user_id).single();
        const newBalance = +(Number(prof?.balance ?? 0) + Number(o.price_charged)).toFixed(2);
        await sb.from("profiles").update({ balance: newBalance }).eq("id", o.user_id);
        await sb.from("transactions").insert({
          user_id: o.user_id, type: "refund", amount: Number(o.price_charged),
          balance_after: newBalance, description: `Auto-refund: ${svc.name}`, order_id: o.id,
        });
        await sb.from("orders").update({
          status: "failed",
          error_message: reason,
          result: typeof parsed === "string" ? parsed.slice(0, 2000) : JSON.stringify(parsed).slice(0, 2000),
          last_polled_at: new Date().toISOString(),
          poll_attempts: newAttempts,
        }).eq("id", o.id);

        sb.functions.invoke("telegram-notify", { body: {
          user_id: o.user_id,
          subject: `❌ Check failed — ${svc.name}`,
          body: `IMEI: ${o.imei}\nReason: ${reason}\nRefunded: $${Number(o.price_charged).toFixed(2)}\nBalance: $${newBalance.toFixed(2)}`,
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

  return json(200, { polled: pending.length, completed, failed, stillPending });
});
