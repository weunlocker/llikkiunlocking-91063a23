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
    // Merge GET + POST body params so all DHRU client flavors work
    const params = new URLSearchParams(url.search);
    let rawBody = "";
    if (req.method === "POST") {
      const ct = (req.headers.get("content-type") || "").toLowerCase();
      try {
        if (ct.includes("multipart/form-data")) {
          const fd = await req.formData();
          for (const [k, v] of fd.entries()) {
            if (typeof v === "string") params.set(k, v);
          }
        } else if (ct.includes("application/json")) {
          rawBody = await req.text();
          try {
            const j = JSON.parse(rawBody);
            if (j && typeof j === "object") {
              for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
                if (v != null) params.set(k, String(v));
              }
            }
          } catch { /* ignore */ }
        } else {
          // x-www-form-urlencoded OR text/plain OR no content-type
          rawBody = await req.text();
          try {
            const body = new URLSearchParams(rawBody);
            body.forEach((v, k) => params.set(k, v));
          } catch { /* ignore */ }
          // Some Dhru clients send raw JSON without setting content-type
          if (!params.get("apikey") && !params.get("apiaccesskey") && !params.get("key") && !params.get("data")) {
            const t = rawBody.trim();
            if (t.startsWith("{") || t.startsWith("[")) {
              try {
                const j = JSON.parse(t);
                if (j && typeof j === "object") {
                  for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
                    if (v != null) params.set(k, String(v));
                  }
                }
              } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore body parse errors */ }
    }

    // Dhru Fusion bulk format: a single form field "data" or "parameters"
    // containing JSON like {username, apikey, action, ...} or service args.
    // Unwrap any such wrapper fields.
    for (const wrapper of ["data", "parameters", "PARAMETERS", "Parameters", "params"]) {
      const raw = params.get(wrapper);
      if (!raw) continue;
      try {
        const j = JSON.parse(raw);
        if (j && typeof j === "object") {
          for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
            if (v != null && !params.has(k)) params.set(k, String(v));
          }
        }
      } catch {
        // Some Dhru clients send parameters as "service=001&imei=..." string
        try {
          const sp = new URLSearchParams(raw);
          sp.forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
        } catch { /* ignore */ }
      }
    }

    // Accept many key field-name variants used by different Dhru clients
    const key = params.get("key")
      || params.get("apikey")
      || params.get("api_key")
      || params.get("apiaccesskey")
      || params.get("api_access_key")
      || params.get("APIKEY")
      || (req.headers.get("x-api-key") ?? null)
      || ((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() || null);

    if (!key) {
      const seen = Array.from(params.keys()).join(",") || "(none)";
      console.log("api-check missing key. params=", seen, "ct=", req.headers.get("content-type"), "rawLen=", rawBody.length);
      return dhruError(`Missing API key (received fields: ${seen})`, 401);
    }


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
      const { data: svc } = await supabase
        .from("services")
        .select("id, service_code, name, price, delivery_time, category, supplier_id, suppliers(type)")
        .eq("active", true)
        .order("service_code");
      // Per-user overrides for this user
      const { data: overrides } = await supabase
        .from("user_service_overrides").select("service_id, enabled, custom_price").eq("user_id", apiKey.user_id);
      const ovMap = new Map((overrides ?? []).map((o: any) => [o.service_id, o]));
      const groups: Record<string, { GROUPNAME: string; GROUPTYPE: string; SERVICES: Record<string, unknown> }> = {};
      for (const s of (svc ?? []) as any[]) {
        const ov = ovMap.get(s.id);
        if (ov && ov.enabled === false) continue;
        const effective = ov?.custom_price != null
          ? Number(ov.custom_price)
          : +(Number(s.price) * (1 - discount)).toFixed(2);
        const groupName = String(s.category || "IMEI").trim() || "IMEI";
        const groupKey = groupName.toUpperCase().replace(/[^A-Z0-9]+/g, "_") || "IMEI";
        if (!groups[groupKey]) {
          groups[groupKey] = { GROUPNAME: groupName, GROUPTYPE: "IMEI", SERVICES: {} };
        }
        const serviceId = s.service_code ?? s.id;
        groups[groupKey].SERVICES[serviceId] = {
          SERVICEID: serviceId,
          SERVICENAME: s.name,
          CREDIT: effective.toFixed(2),
          TIME: s.delivery_time ?? "Instant",
          QNT: 1,
          INFO: "",
        };
      }
      return json(200, { SUCCESS: [{ MESSAGE: "IMEI Service List", LIST: groups }] });
    }

    // ---- Account info (DHRU: accountinfo) ----
    if (action === "accountinfo") {
      const { data: prof } = await supabase
        .from("profiles").select("email, balance, display_name").eq("id", apiKey.user_id).maybeSingle();
      const email = prof?.email ?? "";
      const credit = Number(prof?.balance ?? 0).toFixed(2);
      const currency = "USD";
      return json(200, {
        SUCCESS: [{
          message: "Your Accout Info",
          AccoutInfo: {
            credit,
            mail: email,
            currency,
          },
          AccountInfo: {
            credit,
            mail: email,
            email,
            currency,
          },
          USERNAME: email,
          EMAIL: email,
          NAME: prof?.display_name ?? "",
          CREDIT: credit,
          BALANCE: credit,
          CURRENCY: currency,
        }],
      });
    }

    // ---- Place IMEI check ----
    if (action !== "imeicheck" && action !== "placeimeiorder") {
      return dhruError(`Unknown action: ${action}`, 400);
    }

    const serviceParam = params.get("service")
      || params.get("SERVICE")
      || params.get("serviceid")
      || params.get("SERVICEID")
      || params.get("service_id")
      || params.get("ServiceID");
    const imei = params.get("imei") || params.get("IMEI") || params.get("Imei");
    if (!serviceParam) {
      const seen = Array.from(params.keys()).join(",") || "(none)";
      console.log("api-check missing service. params=", seen);
      return dhruError(`Missing service id (received fields: ${seen})`, 400);
    }
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
