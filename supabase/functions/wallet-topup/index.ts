// Demo wallet top-up. Replace with Stripe later.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({ amount: z.number().min(1).max(10000) });

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
    const amount = parsed.data.amount;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: profile, error: pErr } = await admin.from("profiles").select("balance, banned").eq("id", user.id).single();
    if (pErr || !profile) return json(404, { error: "Profile not found" });
    if (profile.banned) return json(403, { error: "Account banned" });

    const newBalance = +(Number(profile.balance) + amount).toFixed(2);
    await admin.from("profiles").update({ balance: newBalance }).eq("id", user.id);
    await admin.from("transactions").insert({
      user_id: user.id, type: "topup", amount, balance_after: newBalance,
      description: `Demo top-up $${amount.toFixed(2)}`,
    });
    return json(200, { ok: true, balance: newBalance });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
