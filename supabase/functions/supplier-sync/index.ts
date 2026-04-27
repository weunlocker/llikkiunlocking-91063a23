import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type DhruService = { id?: string | number; SERVICEID?: string | number; serviceid?: string | number; name?: string; SERVICENAME?: string; servicename?: string; price?: string | number; CREDIT?: string | number; credit?: string | number; time?: string; TIME?: string; info?: string; INFO?: string; description?: string };
type DhruGroup = { GROUPNAME?: string; groupname?: string; SERVICES?: Record<string, DhruService> | DhruService[]; services?: Record<string, DhruService> | DhruService[] };

function flatten(obj: unknown): DhruService[] {
  // Dhru returns either {SUCCESS:[{LIST:{groupId:{GROUPNAME, SERVICES:{id:{...}}}}}]} or similar shapes
  const out: DhruService[] = [];
  const walk = (node: unknown, group?: string) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, group)); return; }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    // Service-like leaf
    const id = o.SERVICEID ?? o.serviceid ?? o.id;
    const name = o.SERVICENAME ?? o.servicename ?? o.name;
    if (id && name) {
      out.push({
        id: id as string | number,
        name: name as string,
        price: (o.CREDIT ?? o.credit ?? o.price) as string | number | undefined,
        time: (o.TIME ?? o.time) as string | undefined,
        info: (o.INFO ?? o.info ?? o.description) as string | undefined,
      });
      return;
    }
    const groupName = (o.GROUPNAME ?? o.groupname) as string | undefined;
    for (const v of Object.values(o)) walk(v, groupName ?? group);
  };
  walk(obj);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json(401, { error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length) return json(403, { error: "Forbidden" });

    const { supplier_id, mode = "preview", markup = 0 } = await req.json();
    if (!supplier_id) return json(400, { error: "supplier_id required" });

    const { data: sup } = await admin.from("suppliers").select("*").eq("id", supplier_id).single();
    if (!sup) return json(404, { error: "Supplier not found" });

    let services: DhruService[] = [];

    if (sup.type === "dhru") {
      const params = new URLSearchParams();
      params.set("username", sup.dhru_username ?? "");
      params.set("apikey", sup.dhru_api_key ?? "");
      params.set("action", "imeiservicelist");
      const r = await fetch(sup.endpoint_url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
      const text = await r.text();
      let payload: unknown;
      try { payload = JSON.parse(text); } catch { return json(502, { error: "Supplier returned non-JSON", raw: text.slice(0, 500) }); }
      services = flatten(payload);
    } else {
      return json(400, { error: "Sync only supported for Dhru-type suppliers" });
    }

    // Dedupe by supplier_action
    const seen = new Set<string>();
    services = services.filter((s) => {
      const k = String(s.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (mode === "preview") {
      return json(200, { count: services.length, services: services.slice(0, 500) });
    }

    // Import: upsert by (supplier_id, supplier_action)
    const { data: existing } = await admin.from("services").select("id,supplier_action").eq("supplier_id", supplier_id);
    const existingMap = new Map((existing ?? []).map((e: { id: string; supplier_action: string | null }) => [e.supplier_action, e.id]));

    let created = 0, updated = 0;
    for (const s of services) {
      const action = String(s.id);
      const priceNum = Number(String(s.price ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const finalPrice = +(priceNum * (1 + Number(markup) / 100)).toFixed(2);
      const row = {
        name: String(s.name ?? action),
        description: s.info ? String(s.info) : null,
        price: finalPrice,
        delivery_time: s.time ? String(s.time) : "Instant",
        api_method: "POST",
        active: true,
        category: "imei",
        supplier_id,
        supplier_action: action,
        success_rules: [{ path: "SUCCESS", op: "exists" }],
      };
      const id = existingMap.get(action);
      if (id) {
        await admin.from("services").update(row).eq("id", id);
        updated++;
      } else {
        await admin.from("services").insert(row);
        created++;
      }
    }

    return json(200, { ok: true, count: services.length, created, updated });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
