import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, executeCheckAsync } from "../_shared/check.ts";

const Body = z.object({
  service_id: z.string().uuid(),
  imei: z.string().trim().regex(/^[A-Za-z0-9]{8,20}$/),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json(401, { error: "Unauthorized" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

    const result = await executeCheckAsync({
      userId: user.id,
      serviceId: parsed.data.service_id,
      imei: parsed.data.imei,
      source: "web",
    });
    if (result.background) EdgeRuntime.waitUntil(result.background);
    return json(result.status, result.body);
  } catch (e) {
    console.error("check-imei error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
