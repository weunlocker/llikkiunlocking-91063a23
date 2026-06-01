import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Item =
  | { action_code: string; action: "link"; service_id: string }
  | { action_code: string; action: "create"; name: string; price: number; delivery_time: string; category?: string | null }
  | { action_code: string; action: "skip" };

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

    const body = await req.json();
    const supplier_id: string = body.supplier_id;
    const items: Item[] = body.items ?? [];
    if (!supplier_id || !Array.isArray(items)) return json(400, { error: "supplier_id and items required" });

    let linked = 0, created = 0, skipped = 0;
    const failed: Array<{ action_code: string; error: string }> = [];

    for (const it of items) {
      try {
        if (it.action === "skip") { skipped++; continue; }
        if (it.action === "link") {
          const { error } = await admin
            .from("services")
            .update({ supplier_id, supplier_action: it.action_code })
            .eq("id", it.service_id);
          if (error) throw error;
          linked++;
        } else if (it.action === "create") {
          const { error } = await admin.from("services").insert({
            name: it.name,
            price: Number(it.price) || 0,
            delivery_time: it.delivery_time || "Instant",
            category: it.category || "general",
            supplier_id,
            supplier_action: it.action_code,
            active: true,
          });
          if (error) throw error;
          created++;
        }
      } catch (e) {
        failed.push({ action_code: it.action_code, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json(200, { ok: true, linked, created, skipped, failed });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
