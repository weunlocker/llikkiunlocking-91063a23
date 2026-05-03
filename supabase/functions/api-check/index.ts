// Public API — DHRU-compatible.
// Supports two flavors so any Dhru-style client works:
//
//  1. Simple Link  (recommended for instant services):
//       GET /api-check?key=imei_xxx&service=001&imei=...
//
//  2. DHRU classic:
//       GET/POST /api-check?username=<email>&apikey=imei_xxx&action=imeicheck&service=001&imei=...
//       GET      /api-check?username=<email>&apikey=imei_xxx&action=imeiservicelist
//       GET      /api-check?username=<email>&apikey=imei_xxx&action=accountinfo
//
// `service` accepts both a UUID and the short service_code (e.g. "001").
// Only services that are NOT routed through a Dhru supplier are exposed in
// imeiservicelist (Simple Link is for instant services only).
import { corsHeaders, executeCheck, makeServiceClient } from "../_shared/check.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Merge GET + POST form params so DHRU clients that POST also work
    const params = new URLSearchParams(url.search);
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        const body = new URLSearchParams(await req.text());
        body.forEach((v, k) => params.set(k, v));
      } else if (ct.includes("application/json")) {
        try {
          const j = await req.json();
          if (j && typeof j === "object") {
            for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
              if (v != null) params.set(k, String(v));
            }
          }
        } catch { /* ignore */ }
      }
    }

    const key = params.get("key") || params.get("apikey") || params.get("apiaccesskey");
    if (!key) return dhruError("Missing API key", 401);

    const supabase = makeServiceClient();
    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("user_id, active")
      .eq("key", key)
      .maybeSingle();
    if (!apiKey) return dhruError("Invalid API key", 401);
    if (!apiKey.active) return dhruError("API key disabled", 403);

    // Block API entirely if admin disabled API for this user
    const { data: gate } = await supabase
      .from("profiles").select("api_enabled, user_group").eq("id", apiKey.user_id).maybeSingle();
    if (gate && gate.api_enabled === false) return dhruError("API access disabled for this account", 403);
    const groupDiscount: Record<string, number> = { silver: 0.10, gold: 0.30, diamond: 0.50 };
    const discount = groupDiscount[String(gate?.user_group ?? "").toLowerCase()] ?? 0;

    // Optional username check (DHRU compatibility). If supplied, must match the user's email.
    const username = params.get("username");
    if (username) {
      const { data: prof } = await supabase
        .from("profiles").select("email").eq("id", apiKey.user_id).maybeSingle();
      if (!prof || (prof.email ?? "").toLowerCase() !== username.toLowerCase()) {
        return dhruError("Username does not match this API key", 401);
      }
    }

    // touch last_used_at (best-effort)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key", key).then(() => {});

    const action = (params.get("action") || "imeicheck").toLowerCase();

    // ---- Service list (DHRU: imeiservicelist) ----
    if (action === "imeiservicelist" || action === "servicelist") {
      // Only instant (non-Dhru-supplier) services are usable through Simple Link.
      const { data: svc } = await supabase
        .from("services")
        .select("id, service_code, name, price, delivery_time, category, supplier_id, suppliers(type)")
        .eq("active", true)
        .order("service_code");
      const list = (svc ?? []).filter((s: any) => {
        const t = s.suppliers?.type;
        return !s.supplier_id || (t && t !== "dhru");
      });
      // Per-user overrides for this user
      const { data: overrides } = await supabase
        .from("user_service_overrides").select("service_id, enabled, custom_price").eq("user_id", apiKey.user_id);
      const ovMap = new Map((overrides ?? []).map((o: any) => [o.service_id, o]));
      const SERVICES: Record<string, unknown> = {};
      for (const s of list as any[]) {
        const ov = ovMap.get(s.id);
        if (ov && ov.enabled === false) continue;
        const effective = ov?.custom_price != null
          ? Number(ov.custom_price)
          : +(Number(s.price) * (1 - discount)).toFixed(2);
        SERVICES[s.service_code ?? s.id] = {
          SERVICEID: s.service_code ?? s.id,
          SERVICENAME: s.name,
          CREDIT: effective.toFixed(2),
          TIME: s.delivery_time,
          GROUP: s.category ?? "general",
          QNT: 1,
          INFO: "",
        };
      }
      return json(200, { SUCCESS: [{ LIST: { IMEI: SERVICES } }] });
    }

    // ---- Account info (DHRU: accountinfo) ----
    if (action === "accountinfo") {
      const { data: prof } = await supabase
        .from("profiles").select("email, balance, display_name").eq("id", apiKey.user_id).maybeSingle();
      return json(200, {
        SUCCESS: [{
          USERNAME: prof?.email ?? "",
          NAME: prof?.display_name ?? "",
          CREDIT: Number(prof?.balance ?? 0).toFixed(2),
          CURRENCY: "USD",
        }],
      });
    }

    // ---- Place IMEI check ----
    if (action !== "imeicheck" && action !== "placeimeiorder") {
      return dhruError(`Unknown action: ${action}`, 400);
    }

    const serviceParam = params.get("service");
    const imei = params.get("imei");
    if (!serviceParam) return dhruError("Missing service id (service=...)", 400);
    if (!imei || !/^[A-Za-z0-9]{8,20}$/.test(imei)) return dhruError("Invalid IMEI (8-20 alphanumeric)", 400);

    // Resolve service: accept UUID or service_code (e.g. "001")
    let serviceId = serviceParam;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceParam)) {
      const { data: s } = await supabase
        .from("services").select("id").eq("service_code", serviceParam).maybeSingle();
      if (!s) return dhruError(`Unknown service code: ${serviceParam}`, 404);
      serviceId = s.id;
    }

    const result = await executeCheck({
      userId: apiKey.user_id,
      serviceId,
      imei,
      source: "api",
    });
    return json(result.status, result.body);
  } catch (e) {
    console.error("api-check error:", e);
    return dhruError(e instanceof Error ? e.message : "Server error", 500);
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dhruError(message: string, status: number) {
  return json(status, { ERROR: [{ MESSAGE: message, FACTOR: message }], error: message });
}
