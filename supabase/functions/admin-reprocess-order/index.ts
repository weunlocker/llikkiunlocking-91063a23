// Admin: reprocess a pending/errored order. Optionally switch to a different
// service (which may use a different supplier API). Re-places the order with
// the supplier and updates supplier_reference. Order stays "pending" until
// the cron poller marks it complete.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  order_id: z.string().uuid(),
  service_id: z.string().uuid().optional(), // optional override (switch supplier API)
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return json(401, { error: "Unauthorized" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) return json(403, { error: "Admin only" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

    const { data: order } = await sb.from("orders").select("*").eq("id", parsed.data.order_id).maybeSingle();
    if (!order) return json(404, { error: "Order not found" });

    const serviceId = parsed.data.service_id ?? order.service_id;
    const { data: service } = await sb.from("services").select("*").eq("id", serviceId).maybeSingle();
    if (!service) return json(404, { error: "Service not found" });
    if (!service.supplier_id) return json(400, { error: "Selected service has no supplier (instant only)" });
    const { data: sup } = await sb.from("suppliers").select("*").eq("id", service.supplier_id).maybeSingle();
    if (!sup) return json(400, { error: "Supplier not found" });

    // Re-place the order with the supplier
    const params = new URLSearchParams();
    const username = String(sup.dhru_username ?? "");
    const apiKey = String(sup.dhru_api_key ?? "");
    const action = String(service.supplier_action ?? "");
    const imei = String(order.imei);
    if (sup.api_format === "bulk") {
      params.set("data", JSON.stringify({ username, apikey: apiKey, action: "placeimeiorder", service: action, imei }));
    } else if (sup.api_format === "v6") {
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
    const r = await fetch(String(sup.endpoint_url), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
    const text = await r.text();
    let parsedResp: any = text; try { parsedResp = JSON.parse(text); } catch { /* keep */ }

    const errBlock = parsedResp?.ERROR ?? parsedResp?.error;
    if (errBlock) {
      const e = Array.isArray(errBlock) ? errBlock[0] : errBlock;
      const msg = (e?.MESSAGE ?? e?.message ?? e?.FACTOR ?? "Rejected by supplier").toString();
      await sb.from("orders").update({ error_message: `Reprocess failed: ${msg}` }).eq("id", order.id);
      return json(502, { error: msg });
    }
    const findRef = (n: any): string | null => {
      if (!n || typeof n !== "object") return null;
      const ref = n.REFERENCEID ?? n.referenceid ?? n.REFERENCE ?? n.reference ?? n.ID ?? n.id;
      if (ref != null) return String(ref);
      for (const v of Object.values(n)) { const r2 = findRef(v); if (r2) return r2; }
      return null;
    };
    const refId = findRef(parsedResp?.SUCCESS ?? parsedResp?.success ?? parsedResp);
    if (!refId) return json(502, { error: "Supplier did not return a reference id", raw: text.slice(0, 500) });

    await sb.from("orders").update({
      service_id: serviceId,
      supplier_reference: refId,
      status: "pending",
      error_message: null,
      result: `Reprocessed — new ref ${refId}. Awaiting supplier…`,
      poll_attempts: 0,
      last_polled_at: null,
    }).eq("id", order.id);

    return json(200, { ok: true, supplier_reference: refId });
  } catch (e) {
    console.error("admin-reprocess-order", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});
