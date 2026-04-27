// Sends notifications to users (Telegram + future email).
// Called server-side from check.ts and wallet-topup. Uses service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, subject, body } = await req.json();
    if (!user_id || !body) {
      return new Response(JSON.stringify({ error: "user_id and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_chat_id, notify_telegram, email")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ ok: false, reason: "no_profile" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = { telegram: "skipped", email: "skipped" };

    // Telegram
    if (profile.notify_telegram && profile.telegram_chat_id) {
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
            body: JSON.stringify({
              chat_id: profile.telegram_chat_id,
              text,
              parse_mode: "HTML",
            }),
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

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
