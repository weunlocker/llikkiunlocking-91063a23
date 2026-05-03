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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.event || !body?.to) {
      return new Response(JSON.stringify({ error: "event + to required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password || !cfg.from_email) {
      return new Response(JSON.stringify({ error: "SMTP not fully configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;
    const data = { site_name: cfg.from_name ?? "", ...(body.data ?? {}) } as Record<string, unknown>;

    if (body.event === "test") {
      subject = body.override_subject ?? "SMTP test from " + (cfg.from_name ?? "");
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
        hostname: cfg.smtp_host,
        port: Number(cfg.smtp_port) || 587,
        tls: !!cfg.smtp_secure,
        auth: { username: cfg.smtp_user, password: cfg.smtp_password },
      },
    });

    await client.send({
      from: `${cfg.from_name} <${cfg.from_email}>`,
      to: body.to,
      replyTo: cfg.reply_to || undefined,
      subject,
      html,
      content: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-email error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
