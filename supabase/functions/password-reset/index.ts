import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.14";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Always respond success to avoid leaking which emails exist
    const okResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: cfg } = await admin.from("email_settings").select("*").eq("id", 1).maybeSingle();
    if (!cfg || !cfg.enabled) {
      console.error("email settings not configured/enabled");
      return new Response(JSON.stringify({ error: "Email service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(cfg.provider ?? "smtp") === "lovable") {
      return new Response(JSON.stringify({ ok: true, useLovableAuth: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectTo || undefined },
    });
    if (linkErr || !linkData) {
      console.log("generateLink error", linkErr?.message);
      return okResponse;
    }
    const props = (linkData as any).properties ?? {};
    const tokenHash: string | undefined = props.hashed_token;
    // Build our own link straight to /reset-password so email scanners can't
    // consume the single-use Supabase verify URL before the user clicks.
    let actionLink: string = props.action_link;
    if (tokenHash && redirectTo) {
      const u = new URL(redirectTo);
      u.searchParams.set("token_hash", tokenHash);
      u.searchParams.set("type", "recovery");
      actionLink = u.toString();
    }
    if (!actionLink) return okResponse;

    const fromName = String(cfg.from_name ?? "LIKKI UNLOCKING").trim() || "LIKKI UNLOCKING";
    const fromEmail = String(cfg.from_email ?? "").trim();
    const replyTo = String(cfg.reply_to ?? "").trim() || undefined;
    const smtpUser = String(cfg.smtp_user ?? "").trim();
    const smtpPassword = String(cfg.smtp_password ?? "").trim();
    if (!String(cfg.smtp_host ?? "").trim() || !smtpUser || !smtpPassword || !fromEmail) {
      return new Response(JSON.stringify({ error: "SMTP not fully configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: String(cfg.smtp_host).trim(),
      port: Number(cfg.smtp_port) || 587,
      secure: !!cfg.smtp_secure,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f9fc;padding:24px;margin:0;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e3eef7;">
        <h1 style="color:#0a1929;font-size:22px;margin:0 0 12px;">Reset your password</h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
          We received a request to reset your ${fromName} password. Click the button below to set a new one. This link expires shortly.
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${actionLink}" style="background:#00B8FF;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;display:inline-block;">Reset password</a>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all;">Or copy this link: ${actionLink}</p>
      </div></body></html>`;
    const text = `Reset your ${fromName} password: ${actionLink}`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      replyTo,
      subject: `Reset your ${fromName} password`,
      html,
      text,
      envelope: { from: smtpUser, to: email },
    });
    if (Array.isArray(info.rejected) && info.rejected.length > 0) {
      throw new Error(`SMTP rejected recipient: ${info.rejected.join(", ")}`);
    }
    console.log("password-reset sent", { messageId: info.messageId, response: info.response });

    try {
      await admin.from("email_send_log").insert({
        message_id: info.messageId || crypto.randomUUID(),
        template_name: "recovery",
        recipient_email: email,
        status: "sent",
      });
    } catch (_) { /* ignore */ }

    return okResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("password-reset error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
