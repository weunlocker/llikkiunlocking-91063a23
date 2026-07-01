// Logs login attempts and pushes a Telegram alert to admins.
// - success=true events MUST include a valid Authorization Bearer JWT whose email matches
//   the reported email. This prevents attackers from spoofing "new login" alerts to arbitrary users.
// - success=false events are still accepted unauthenticated (the user isn't signed in yet),
//   but we NEVER notify the target user directly (only admins, heavily rate-limited),
//   so attackers cannot spam fake "failed login" security alerts to a chosen user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const p = await req.json().catch(() => ({}));
    const email = (p.email ?? "").toString().slice(0, 200);
    const claimedSuccess = !!p.success;
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Verify success claim via caller JWT. If not verified, coerce to failed-attempt logging only.
    let verifiedSuccess = false;
    let verifiedUserId: string | null = null;
    let verifiedEmail: string | null = null;
    if (claimedSuccess) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (token) {
        const { data: userData } = await supabase.auth.getUser(token);
        const u = userData?.user;
        if (u?.id && u?.email && (!email || String(u.email).toLowerCase() === email.toLowerCase())) {
          verifiedSuccess = true;
          verifiedUserId = u.id;
          verifiedEmail = String(u.email);
        }
      }
      if (!verifiedSuccess) {
        // Silently reject spoofed success events — do not log or notify.
        return json(200, { ok: true, ignored: "unverified_success" });
      }
    }

    // Rate limit inserts and admin alerts per IP.
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    let recentFromIp = 0;
    if (ip) {
      const { count } = await supabase
        .from("auth_login_events")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", oneMinAgo);
      recentFromIp = count ?? 0;
    }
    if (recentFromIp >= 10) {
      return json(429, { error: "rate_limited" });
    }

    const finalEmail = verifiedEmail ?? email;
    let userId: string | null = verifiedUserId;
    if (!userId && finalEmail) {
      const { data: prof } = await supabase.from("profiles").select("id").ilike("email", finalEmail).maybeSingle();
      userId = prof?.id ?? null;
    }

    await supabase.from("auth_login_events").insert({
      user_id: userId,
      email: finalEmail,
      ip,
      user_agent: userAgent,
      success: verifiedSuccess, // never trust client for success
    });

    // Notify admins (debounced — skip if any alert already sent from this IP in the last minute)
    if (recentFromIp === 0) {
      const subject = verifiedSuccess ? "✅ Login success" : "⚠️ Login FAILED";
      const body = `Email: ${finalEmail || "—"}\nIP: ${ip || "—"}\nUA: ${userAgent.slice(0, 120)}`;
      await supabase.functions.invoke("telegram-notify", { body: { broadcast: "admins", subject, body } });

      // Only notify the account owner on VERIFIED successful logins.
      // Failed-attempt notifications are admin-only to prevent spoofed security-alert spam.
      if (verifiedSuccess && userId) {
        await supabase.functions.invoke("telegram-notify", {
          body: {
            user_id: userId,
            subject: "🔐 New login to your account",
            body: `Email: ${finalEmail || "—"}\nIP: ${ip || "—"}\nUA: ${userAgent.slice(0, 120)}`,
          },
        });
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
