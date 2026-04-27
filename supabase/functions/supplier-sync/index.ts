import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type DhruService = { id: string; name: string; price?: string | number | null; time?: string | null; info?: string | null; group?: string | null; raw?: unknown };

/**
 * Dhru imeiservicelist returns either:
 *   { SUCCESS:[ { LIST:{ "GroupId": { GROUPNAME, SERVICES:{ "SvcId": {SERVICEID, SERVICENAME, CREDIT, TIME, ...} } } } } ] }
 *   { SUCCESS:{ ... } }
 * or a flat structure depending on Dhru version. Walk recursively and pull anything that
 * looks like a service.
 */
function flatten(obj: unknown): DhruService[] {
  const out: DhruService[] = [];
  const walk = (node: unknown, group?: string) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, group)); return; }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const id = o.SERVICEID ?? o.serviceid ?? o.Serviceid ?? o.id ?? o.ID;
    const name = o.SERVICENAME ?? o.servicename ?? o.Servicename ?? o.name ?? o.NAME ?? o.TITLE ?? o.title;

    if (id != null && name != null && (typeof id === "string" || typeof id === "number")) {
      out.push({
        id: String(id),
        name: String(name),
        price: (o.CREDIT ?? o.credit ?? o.Credit ?? o.PRICE ?? o.price) as string | number | null | undefined ?? null,
        time: (o.TIME ?? o.time ?? o.Time ?? o.DELIVERY ?? o.delivery) as string | null | undefined ?? null,
        info: (o.INFO ?? o.info ?? o.Info ?? o.DESCRIPTION ?? o.description ?? o.NOTE ?? o.note) as string | null | undefined ?? null,
        group: group ?? null,
        raw: o,
      });
      return;
    }

    const groupName = (o.GROUPNAME ?? o.groupname ?? o.GroupName ?? o.NAME ?? o.name) as string | undefined;
    for (const v of Object.values(o)) walk(v, typeof groupName === "string" ? groupName : group);
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

    // DHRU has TWO formats:
    //  - Classic API: flat form fields (username, apikey, action)
    //  - Bulk API v6.1+: form field "data" containing JSON {username, apikey, action}
    // We try both. Different action names also vary by host.
    const actions = ["imeiservicelist", "getimeiservices", "imeiservices"];
    let services: DhruService[] = [];
    let lastRaw = "";
    let lastErrorMsg = "";
    let usedAction = "";
    let usedFormat = "";

    const buildRequests = (action: string) => {
      const classic = new URLSearchParams();
      classic.set("username", sup.dhru_username ?? "");
      classic.set("apikey", sup.dhru_api_key ?? "");
      classic.set("action", action);

      const bulk = new URLSearchParams();
      bulk.set("data", JSON.stringify({
        username: sup.dhru_username ?? "",
        apikey: sup.dhru_api_key ?? "",
        action,
      }));
      return [
        { format: "classic", body: classic.toString() },
        { format: "bulk", body: bulk.toString() },
      ];
    };

    outer: for (const action of actions) {
      for (const variant of buildRequests(action)) {
        const r = await fetch(sup.endpoint_url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: variant.body,
        });
        const text = await r.text();
        lastRaw = text;
        console.log(`[supplier-sync] action=${action} fmt=${variant.format} status=${r.status} sample=`, text.slice(0, 300));
        let payload: unknown;
        try { payload = JSON.parse(text); } catch { continue; }
        const p = payload as Record<string, unknown> | null;
        const errBlock = p?.ERROR ?? p?.error;
        if (errBlock) {
          const eArr = Array.isArray(errBlock) ? errBlock[0] : errBlock;
          const e = eArr as Record<string, unknown> | undefined;
          lastErrorMsg = String(e?.MESSAGE ?? e?.message ?? e?.FACTOR ?? "Supplier returned an error");
          continue;
        }
        const found = flatten(payload);
        if (found.length > 0) { services = found; usedAction = action; usedFormat = variant.format; break outer; }
      }
    }

    if (services.length === 0) {
      const isAuth = /auth/i.test(lastErrorMsg);
      return json(isAuth ? 401 : 502, {
        error: lastErrorMsg
          ? `Dhru: ${lastErrorMsg}${isAuth ? " — check the Username and API Key on this supplier (and IP whitelist on Dhru)." : ""}`
          : "Supplier returned no services. The endpoint/account may not expose IMEI services.",
        raw_sample: lastRaw.slice(0, 800),
      });
    }

    // Dedupe by id
    const seen = new Set<string>();
    const unique = services.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

    // Refresh cache
    await admin.from("supplier_services").delete().eq("supplier_id", supplier_id);
    const rows = unique.map((s) => ({
      supplier_id,
      action_code: s.id,
      name: s.group ? `${s.group} — ${s.name}` : s.name,
      credit: s.price != null && s.price !== "" ? Number(String(s.price).replace(/[^0-9.]/g, "")) || null : null,
      delivery_time: s.time ?? null,
      info: s.info ?? null,
      raw: s.raw ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error } = await admin.from("supplier_services").insert(slice);
      if (error) return json(500, { error: error.message });
    }

    return json(200, {
      ok: true,
      count: unique.length,
      action_used: usedAction,
      services: unique.map((s) => ({ id: s.id, name: s.name, group: s.group, price: s.price, time: s.time })),
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
