import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type CustomField = {
  name: string;
  label: string;
  type: string;          // text | number | select | textarea | password
  required: boolean;
  default?: string;
  options?: string[];
};

type DhruService = {
  id: string;
  name: string;
  price?: string | number | null;
  time?: string | null;
  info?: string | null;
  group?: string | null;
  fields?: CustomField[];
  raw?: unknown;
};

function normType(t: unknown): string {
  const s = String(t ?? "").toLowerCase();
  if (!s) return "text";
  if (s.includes("number") || s.includes("qty") || s.includes("quantity") || s.includes("int")) return "number";
  if (s.includes("select") || s.includes("dropdown") || s.includes("option") || s.includes("combo")) return "select";
  if (s.includes("textarea") || s.includes("multi")) return "textarea";
  if (s.includes("pass")) return "password";
  return "text";
}

function extractFields(node: unknown): CustomField[] {
  if (node == null || typeof node !== "object") return [];
  const out: CustomField[] = [];
  // Dhru returns Custom as object keyed by index ("1","2",...) OR an array. Normalize.
  const items: unknown[] = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const rawName = (o.field ?? o.FIELD ?? o.Field ?? o.name ?? o.NAME ?? o.id ?? o.ID ?? "").toString().trim();
    const label = (o.label ?? o.LABEL ?? o.Label ?? o.title ?? o.TITLE ?? rawName).toString().trim();
    if (!rawName && !label) continue;
    const name = (rawName || label).replace(/\s+/g, "_").toLowerCase();
    const type = normType(o.type ?? o.TYPE ?? o.Type ?? o.input ?? o.INPUT);
    const required = String(o.required ?? o.REQUIRED ?? o.Required ?? "").match(/^(1|true|yes|y)$/i) != null;
    const def = (o.default ?? o.DEFAULT ?? o.Default ?? o.value ?? o.VALUE ?? "")?.toString() || undefined;
    const optsRaw = o.options ?? o.OPTIONS ?? o.Options ?? o.values ?? o.VALUES;
    let options: string[] | undefined;
    if (Array.isArray(optsRaw)) options = optsRaw.map((v) => String(v));
    else if (optsRaw && typeof optsRaw === "object") options = Object.values(optsRaw as Record<string, unknown>).map((v) => String(v));
    else if (typeof optsRaw === "string" && optsRaw.trim()) options = optsRaw.split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean);
    out.push({ name, label: label || name, type, required, default: def, options });
  }
  return out;
}

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
      const customBlock = o.Custom ?? o.CUSTOM ?? o.custom ?? o.CustomFields ?? o.CUSTOMFIELDS ?? o.customfields;
      const fields = customBlock ? extractFields(customBlock) : [];
      out.push({
        id: String(id),
        name: String(name),
        price: (o.CREDIT ?? o.credit ?? o.Credit ?? o.PRICE ?? o.price) as string | number | null | undefined ?? null,
        time: (o.TIME ?? o.time ?? o.Time ?? o.DELIVERY ?? o.delivery) as string | null | undefined ?? null,
        info: (o.INFO ?? o.info ?? o.Info ?? o.DESCRIPTION ?? o.description ?? o.NOTE ?? o.note) as string | null | undefined ?? null,
        group: group ?? null,
        fields,
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

    const imeiActions = ["imeiservicelist", "getimeiservices", "imeiservices"];
    const serverActions = ["serverservicelist", "getserverservices", "serverservices"];

    let lastRaw = "";
    let lastErrorMsg = "";
    let usedFormat = "";

    const buildRequests = (action: string) => {
      const apiKey = String(sup.dhru_api_key ?? "");
      const username = String(sup.dhru_username ?? "");

      const v6 = new URLSearchParams();
      v6.set("apiaccesskey", apiKey);
      v6.set("action", action);
      if (username) v6.set("username", username);
      v6.set("requestformat", "JSON");

      const classic = new URLSearchParams();
      classic.set("username", username);
      classic.set("apikey", apiKey);
      classic.set("action", action);

      const bulk = new URLSearchParams();
      bulk.set("data", JSON.stringify({ username, apikey: apiKey, action }));

      const order = sup.api_format
        ? [sup.api_format, ...["v6", "classic", "bulk"].filter((f) => f !== sup.api_format)]
        : ["v6", "classic", "bulk"];
      const map: Record<string, string> = { v6: v6.toString(), classic: classic.toString(), bulk: bulk.toString() };
      return order.map((format) => ({ format, body: map[format] }));
    };

    const fetchKind = async (actions: string[]): Promise<{ services: DhruService[]; action: string }> => {
      for (const action of actions) {
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
          if (found.length > 0) {
            usedFormat = variant.format;
            return { services: found, action };
          }
        }
      }
      return { services: [], action: "" };
    };

    const imeiRes = await fetchKind(imeiActions);
    const serverRes = await fetchKind(serverActions);

    const all: Array<DhruService & { service_type: "imei" | "server" }> = [
      ...imeiRes.services.map((s) => ({ ...s, service_type: "imei" as const })),
      ...serverRes.services.map((s) => ({ ...s, service_type: "server" as const })),
    ];

    if (all.length === 0) {
      const isAuth = /auth/i.test(lastErrorMsg);
      return json(isAuth ? 401 : 502, {
        error: lastErrorMsg
          ? `Dhru: ${lastErrorMsg}${isAuth ? " — check the Username and API Key on this supplier (and IP whitelist on Dhru)." : ""}`
          : "Supplier returned no services. The endpoint/account may not expose IMEI or Server services.",
        raw_sample: lastRaw.slice(0, 800),
      });
    }

    // Dedupe by (service_type,id)
    const seen = new Set<string>();
    const unique = all.filter((s) => {
      const k = `${s.service_type}:${s.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    await admin.from("supplier_services").delete().eq("supplier_id", supplier_id);
    const rows = unique.map((s) => ({
      supplier_id,
      action_code: s.id,
      service_type: s.service_type,
      name: s.group ? `${s.group} — ${s.name}` : s.name,
      credit: s.price != null && s.price !== "" ? Number(String(s.price).replace(/[^0-9.]/g, "")) || null : null,
      delivery_time: s.time ?? null,
      info: s.info ?? null,
      fields: s.fields ?? [],
      raw: s.raw ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error } = await admin.from("supplier_services").insert(slice);
      if (error) return json(500, { error: error.message });
    }

    if (usedFormat) {
      await admin.from("suppliers").update({ api_format: usedFormat }).eq("id", supplier_id);
    }

    return json(200, {
      ok: true,
      count: unique.length,
      imei_count: imeiRes.services.length,
      server_count: serverRes.services.length,
      format: usedFormat,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
