import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, service);

    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "verify";
    const userId = body.user_id as string | undefined;

    if (action === "list_status") {
      const ids = (body.ids ?? []) as string[];
      if (!Array.isArray(ids) || ids.length === 0) return json({ statuses: {} });
      // Fetch via listUsers paginated; cheaper: per id getUserById
      const out: Record<string, { email_confirmed_at: string | null; last_sign_in_at: string | null }> = {};
      await Promise.all(ids.slice(0, 200).map(async (id) => {
        const { data } = await sb.auth.admin.getUserById(id);
        if (data?.user) {
          out[id] = {
            email_confirmed_at: data.user.email_confirmed_at ?? null,
            last_sign_in_at: data.user.last_sign_in_at ?? null,
          };
        }
      }));
      return json({ statuses: out });
    }

    if (!userId) return json({ error: "user_id required" }, 400);

    if (action === "verify") {
      const { error } = await sb.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "resend") {
      const { data: prof } = await sb.from("profiles").select("email").eq("id", userId).maybeSingle();
      if (!prof?.email) return json({ error: "no_email" }, 400);
      const { error } = await sb.auth.admin.generateLink({ type: "signup", email: prof.email });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
