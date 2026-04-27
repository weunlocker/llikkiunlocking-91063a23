import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type DhruService = { id: string | number; name: string; price?: string | number; time?: string; info?: string; raw?: unknown };

function flatten(obj: unknown): DhruService[] {
  const out: DhruService[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const id = o.SERVICEID ?? o.serviceid ?? o.id;
    const name = o.SERVICENAME ?? o.servicename ?? o.name;
    if (id != null && name != null) {
      out.push({
        id: id as string | number,
        name: String(name),
        price: (o.CREDIT ?? o.credit ?? o.price) as string | number | undefined,
        time: (o.TIME ?? o.time) as string | undefined,
        info: (o.INFO ?? o.info ?? o.description) as string | undefined,
        raw: o,
      });
      return;
    }
    for (const v of Object.values(o)) walk(v);
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

    const { supplier_id } = await req.json();
    if (!supplier_id) return json(400, { error: "supplier_id required" });

    const { data: sup } = await admin.from("suppliers").select("*").eq("id", supplier_id).single();
    if (!sup) return json(404, { error: "Supplier not found" });
    if (sup.type !== "dhru") return json(400, { error: "Sync only supported for Dhru-type suppliers" });

    const params = new URLSearchParams();
    params.set("username", sup.dhru_username ?? "");
    params.set("apikey", sup.dhru_api_key ?? "");
    params.set("action", "imeiservicelist");
    const r = await fetch(sup.endpoint_url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
    const text = await r.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return json(502, { error: "Supplier returned non-JSON", raw: text.slice(0, 500) }); }
    const services = flatten(payload);

    // Dedupe by id
    const seen = new Set<string>();
    const unique = services.filter((s) => { const k = String(s.id); if (seen.has(k)) return false; seen.add(k); return true; });

    // Refresh cache: delete old + insert fresh
    await admin.from("supplier_services").delete().eq("supplier_id", supplier_id);
    if (unique.length) {
      const rows = unique.map((s) => ({
        supplier_id,
        action_code: String(s.id),
        name: s.name,
        credit: s.price != null ? Number(String(s.price).replace(/[^0-9.]/g, "")) || null : null,
        delivery_time: s.time ?? null,
        info: s.info ?? null,
        raw: s.raw ?? null,
      }));
      // Insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500);
        const { error } = await admin.from("supplier_services").insert(slice);
        if (error) return json(500, { error: error.message });
      }
    }

    return json(200, { ok: true, count: unique.length });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
