import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { notifyUserEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  user_id: z.string().uuid(),
  amount: z.number().min(-10000).max(10000),
  description: z.string().max(200).optional(),
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // verify caller is admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length) return json(403, { error: "Forbidden" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
    const { user_id, amount, description } = parsed.data;

    const { data: profile } = await admin.from("profiles").select("balance").eq("id", user_id).single();
    if (!profile) return json(404, { error: "User not found" });

    const newBalance = +(Number(profile.balance) + amount).toFixed(2);
    if (newBalance < 0) return json(400, { error: "Resulting balance would be negative" });

    const { error: txErr } = await admin.from("transactions").insert({
      user_id, type: amount > 0 ? "admin_credit" : "admin_debit", amount,
      balance_after: newBalance, description: description ?? "Admin adjustment",
    });
    if (txErr) {
      console.error("tx insert failed", txErr);
      return json(500, { error: `Transaction log failed: ${txErr.message}` });
    }
    const { error: pErr } = await admin.from("profiles").update({ balance: newBalance }).eq("id", user_id);
    if (pErr) {
      console.error("profile update failed", pErr);
      return json(500, { error: `Balance update failed: ${pErr.message}` });
    }
    // Fire-and-forget notifications so the client gets an immediate response.
    // IMPORTANT: use direct fetch (not sb.functions.invoke) to avoid background
    // task cancellation when the parent edge function returns its response.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callFn = async (name: string, body: unknown) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error(`[admin-adjust-balance] ${name} → ${res.status}: ${txt.slice(0, 300)}`);
        }
      } catch (e) {
        console.error(`[admin-adjust-balance] ${name} failed`, e);
      }
    };
    const notifyTask = (async () => {
      await callFn("telegram-notify", {
        user_id,
        subject: amount > 0 ? `💰 Admin credit added` : `🔻 Admin debit applied`,
        body: `Amount: ${amount > 0 ? "+" : ""}$${amount.toFixed(2)}\nNew balance: $${newBalance.toFixed(2)}\n${description ?? ""}`,
      });
      await notifyUserEmail(admin, user_id, "balance_update", {
        amount: `${amount > 0 ? "+" : ""}$${amount.toFixed(2)}`,
        balance: `$${newBalance.toFixed(2)}`,
        note: description ?? "",
        reference: `admin-balance-${user_id}-${Date.now()}`,
      });
    })();
    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    try { EdgeRuntime.waitUntil(notifyTask); } catch (_) { /* ignore */ }
    return json(200, { ok: true, balance: newBalance });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
