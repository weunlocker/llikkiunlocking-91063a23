// Public API: GET /api-check?key=...&service=...&imei=...
// Designed to mimic simple "check.php?imei=XXX" style endpoints.
import { corsHeaders, executeCheck, makeServiceClient } from "../_shared/check.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const serviceId = url.searchParams.get("service");
    const imei = url.searchParams.get("imei");

    if (!key) return json(401, { error: "Missing API key (key=...)" });
    if (!serviceId) return json(400, { error: "Missing service id (service=...)" });
    if (!imei || !/^[A-Za-z0-9]{8,20}$/.test(imei)) return json(400, { error: "Invalid IMEI (8-20 alphanumeric)" });

    const supabase = makeServiceClient();
    const { data: apiKey, error } = await supabase.from("api_keys").select("user_id, active").eq("key", key).maybeSingle();
    if (error || !apiKey) return json(401, { error: "Invalid API key" });
    if (!apiKey.active) return json(403, { error: "API key disabled" });

    // touch last_used_at (best-effort)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key", key).then(() => {});

    const result = await executeCheck({
      userId: apiKey.user_id,
      serviceId,
      imei,
      source: "api",
    });
    return json(result.status, result.body);
  } catch (e) {
    console.error("api-check error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
