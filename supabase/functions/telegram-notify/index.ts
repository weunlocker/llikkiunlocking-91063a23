// Sends notifications to users (Telegram + future email).
// Called server-side from check.ts and wallet-topup. Uses service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth gate: require either service_role JWT or admin user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let isAuthorized = false;
    if (token === SERVICE_KEY) {
      isAuthorized = true;
    } else {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
        if (roles && roles.length > 0) isAuthorized = true;
      }
    }
    if (!isAuthorized) return json(403, { error: "Forbidden" });

    const payload = await req.json();
    const user_id = payload.user_id;
    const subject = payload.subject;
    const body = payload.body ?? payload.message ?? payload.text;
    const directChatId: string | undefined = payload.chat_id;
    if ((!user_id && !directChatId) || !body) {
      return json(400, { error: "user_id (or chat_id) and body (or message) required" });
    }

    let chatId: string | null = directChatId ?? null;
    let allow = !!directChatId;

    if (!chatId && user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id, notify_telegram, email")
        .eq("id", user_id)
        .maybeSingle();
      if (!profile) return json(200, { ok: false, reason: "no_profile" });
      chatId = profile.telegram_chat_id;
      allow = !!(profile.notify_telegram && profile.telegram_chat_id);
    }

    const results: Record<string, unknown> = { telegram: "skipped", email: "skipped" };

    if (allow && chatId) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
      if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
        const text = subject ? `<b>${escapeHtml(subject)}</b>\n\n<pre>${escapeHtml(body)}</pre>` : `<pre>${escapeHtml(body)}</pre>`;
        try {
          const resp = await fetch(`${TG_GATEWAY}/sendMessage`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TELEGRAM_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
          });
          const data = await resp.json();
          results.telegram = resp.ok ? "sent" : `error: ${JSON.stringify(data).slice(0, 200)}`;
        } catch (e) {
          results.telegram = `error: ${e instanceof Error ? e.message : "unknown"}`;
        }
      } else {
        results.telegram = "missing_keys";
      }
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
