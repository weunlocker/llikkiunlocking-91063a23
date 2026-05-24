import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({ order_id: z.string().uuid() });

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length) return json(403, { error: "Forbidden" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

    const { data: order } = await admin.from("orders").select("*").eq("id", parsed.data.order_id).single();
    if (!order) return json(404, { error: "Order not found" });
    if (order.status === "refunded") return json(400, { error: "Already refunded" });

    // Atomically claim the order to prevent concurrent double-refund
    const { data: claimed, error: claimErr } = await admin
      .from("orders").update({ status: "refunded" })
      .eq("id", order.id).neq("status", "refunded")
      .select("id").maybeSingle();
    if (claimErr || !claimed) return json(409, { error: "Already refunded" });

    const amount = Number(order.price_charged);
    const { data: newBalData, error: balErr } = await admin.rpc("credit_balance", { p_user_id: order.user_id, p_amount: amount });
    if (balErr) return json(500, { error: balErr.message });
    const newBalance = Number(newBalData);
    await admin.from("transactions").insert({
      user_id: order.user_id, type: "refund", amount, balance_after: newBalance,
      description: `Manual refund (admin)`, order_id: order.id,
    });
    return json(200, { ok: true, balance: newBalance });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
