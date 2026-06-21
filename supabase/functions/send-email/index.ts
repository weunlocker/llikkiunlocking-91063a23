import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventName = "welcome" | "order_success" | "order_rejected" | "balance_update" | "test";

interface Body {
  event: EventName;
  to: string;
  data?: Record<string, string | number | null | undefined>;
  override_subject?: string;
  override_html?: string;
}

const TPL_KEY: Record<Exclude<EventName, "test">, string> = {
  welcome: "tpl_welcome",
  order_success: "tpl_order_success",
  order_rejected: "tpl_order_rejected",
  balance_update: "tpl_balance_update",
};

function render(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = data[k];
    return v == null ? "" : String(v);
  });
}

function friendlySmtpError(message: string): string {
  const lower = message.toLowerCase();
  if (message.includes("535") || lower.includes("authentication")) {
    return "SMTP login failed. The mail server rejected the username or password. Re-enter or reset the mailbox password, and make sure the SMTP Username is the full email address.";
  }
  if (lower.includes("certificate") || lower.includes("tls") || lower.includes("ssl")) {
    return "SMTP TLS/SSL connection failed. Check that the SMTP port and TLS/SSL setting match your mail provider.";
  }
  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let body: Body | null = null;
  try {
    // Auth gate: require service_role JWT or admin user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let isAdmin = false;
    let isService = false;
    if (token === SERVICE_KEY) {
      isService = true;
    } else {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
        if (roles && roles.length > 0) isAdmin = true;
      }
    }
    if (!isService && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    body = (await req.json()) as Body;
    if (!body?.event || !body?.to) {
      return new Response(JSON.stringify({ error: "event + to required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Non-admin/non-service callers cannot override templates (defense in depth)
    if (!isService && !isAdmin) {
      body.override_html = undefined;
      body.override_subject = undefined;
    }

    const { data: cfg, error } = await supabase
      .from("email_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !cfg) {
      return new Response(JSON.stringify({ error: "Email settings not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!cfg.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "emails_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = String(cfg.smtp_host ?? "").trim();
    const smtpUser = String(cfg.smtp_user ?? "").trim();
    const smtpPassword = String(cfg.smtp_password ?? "").trim();
    const fromEmail = String(cfg.from_email ?? "").trim();
    const fromName = String(cfg.from_name ?? "LIKKI UNLOCKING").trim() || "LIKKI UNLOCKING";
    const replyTo = String(cfg.reply_to ?? "").trim() || undefined;

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      return new Response(JSON.stringify({ error: "SMTP not fully configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;
    const data = { site_name: fromName, ...(body.data ?? {}) } as Record<string, unknown>;

    if (body.event === "test") {
      subject = body.override_subject ?? "SMTP test from " + fromName;
      html = body.override_html ?? "<p>This is a test email. SMTP is working ✅</p>";
    } else {
      const t = (cfg as Record<string, { subject?: string; html?: string }>)[TPL_KEY[body.event]];
      if (!t) {
        return new Response(JSON.stringify({ error: "Template missing for " + body.event }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = render(body.override_subject ?? t.subject ?? "", data);
      html = render(body.override_html ?? t.html ?? "", data);
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: Number(cfg.smtp_port) || 587,
        tls: !!cfg.smtp_secure,
        auth: { username: smtpUser, password: smtpPassword },
      },
    });

    const domain = fromEmail.split("@")[1] || "localhost";
    const messageId = `<${crypto.randomUUID()}@${domain}>`;
    const dateHeader = new Date().toUTCString();

    try {
      const sendPromise = client.send({
        from: `${fromName} <${fromEmail}>`,
        to: body.to,
        replyTo,
        subject,
        html,
        content: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP timeout after 20s connecting to ${smtpHost}:${Number(cfg.smtp_port) || 587}. The host is unreachable or the port is blocked. Verify the SMTP Host (copy the exact "Outgoing Server" from cPanel → Connect Devices) and port (465 SSL or 587 TLS).`)), 20000)
      );
      await Promise.race([sendPromise, timeoutPromise]);
    } finally {
      try {
        await client.close();
      } catch {
        // Ignore close errors so the original SMTP result is preserved.
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-email error", msg);
    return new Response(JSON.stringify({ ok: false, error: friendlySmtpError(msg), detail: msg }), {
      status: body?.event === "test" ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
