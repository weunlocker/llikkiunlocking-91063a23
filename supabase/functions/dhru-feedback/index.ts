// Public webhook endpoint for Dhru Fusion v2 feedback_url callbacks.
// Configured per-order as: /functions/v1/dhru-feedback?order_id=<our-order-id>
// Dhru POSTs the order payload here whenever the supplier order status changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { v2InterpretOrder } from "../_shared/dhru_v2.ts";
import { notifyUserEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizeHtml(s: string): string {
  return (s || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");
    if (!orderId) return json(400, { error: "order_id required" });

    let body: any = null;
    try { body = await req.json(); } catch { body = null; }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: order } = await sb.from("orders")
      .select("id, user_id, imei, price_charged, order_number, status, services(name)")
      .eq("id", orderId).maybeSingle();
    if (!order) return json(404, { error: "Order not found" });
    if (order.status === "completed") return json(200, { ok: true, ignored: "already completed" });

    const { state, reply } = v2InterpretOrder(body);
    const finalText = normalizeHtml(reply || JSON.stringify(body, null, 2)) || "(empty response)";

    if (state === "completed") {
      await sb.from("orders").update({
        status: "completed", result: finalText, error_message: null,
        last_polled_at: new Date().toISOString(),
      }).eq("id", orderId);
      const svcName = (order as any).services?.name ?? "service";
      sb.functions.invoke("telegram-notify", { body: {
        user_id: order.user_id,
        subject: `✅ Check completed — ${svcName}`,
        body: `IMEI: ${order.imei}\n\n${finalText}\n\nCharged: $${Number(order.price_charged).toFixed(2)}`,
      }}).catch(() => {});
      notifyUserEmail(sb, order.user_id, "order_success", {
        order_number: order.order_number, imei: order.imei, service: svcName,
        result: finalText, charged: Number(order.price_charged).toFixed(2),
      });
    } else if (state === "failed") {
      await sb.from("orders").update({
        status: "pending",
        error_message: reply || "Rejected by supplier",
        result: typeof body === "string" ? body.slice(0, 2000) : JSON.stringify(body).slice(0, 2000),
        last_polled_at: new Date().toISOString(),
      }).eq("id", orderId);
    } else {
      await sb.from("orders").update({ last_polled_at: new Date().toISOString() }).eq("id", orderId);
    }

    return json(200, { ok: true, state });
  } catch (e) {
    console.error("dhru-feedback", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
