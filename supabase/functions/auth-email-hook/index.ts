import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'LIKKI UNLOCKING'
const ROOT_DOMAIN = 'likkiunlocking.com'

const SAMPLE_PROJECT_URL = 'https://llikkiunlocking.lovable.app'
const SAMPLE_EMAIL = 'user@example.test'
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, oldEmail: SAMPLE_EMAIL, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '123456' },
}

async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: previewCorsHeaders })

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try { type = (await req.json()).type } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' } })
  }
  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), { status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' } })
  }
  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] || {}))
  return new Response(html, { status: 200, headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}

async function sendViaSmtp(opts: {
  supabase: any
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: cfg, error } = await opts.supabase
    .from('email_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !cfg) return { ok: false, error: 'Email settings not configured' }
  if (!cfg.enabled) return { ok: false, error: 'Emails disabled in settings' }

  const smtpHost = String(cfg.smtp_host ?? '').trim()
  const smtpUser = String(cfg.smtp_user ?? '').trim()
  const smtpPassword = String(cfg.smtp_password ?? '').trim()
  const fromEmail = String(cfg.from_email ?? '').trim()
  const fromName = String(cfg.from_name ?? SITE_NAME).trim() || SITE_NAME
  const replyTo = String(cfg.reply_to ?? '').trim() || undefined

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    return { ok: false, error: 'SMTP not fully configured' }
  }

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: Number(cfg.smtp_port) || 587,
      tls: !!cfg.smtp_secure,
      auth: { username: smtpUser, password: smtpPassword },
    },
  })

  const domain = fromEmail.split('@')[1] || 'localhost'
  const messageId = `<${crypto.randomUUID()}@${domain}>`

  try {
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: opts.to,
      replyTo,
      subject: opts.subject,
      html: opts.html,
      content: opts.text,
    })
    return { ok: true }

  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    try { await client.close() } catch { /* ignore */ }
  }
}

async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: any
  let run_id = ''
  try {
    const verified = await verifyWebhookRequest({ req, secret: apiKey, parser: parseEmailWebhookPayload })
    payload = verified.payload
    run_id = payload.run_id
  } catch (error) {
    if (error instanceof WebhookError) {
      const status = ['invalid_signature', 'missing_timestamp', 'invalid_timestamp', 'stale_timestamp'].includes(error.code) ? 401 : 400
      console.error('Webhook verification failed', { code: error.code })
      return new Response(JSON.stringify({ error: status === 401 ? 'Invalid signature' : 'Invalid webhook payload' }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.error('Webhook verification failed', { error })
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!run_id || payload.version !== '1') {
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const emailType = payload.data.action_type
  const recipient = payload.data.email
  console.log('Auth email event', { emailType, recipient, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient,
    confirmationUrl: payload.data.url,
    token: payload.data.token,
    email: payload.data.email,
    oldEmail: payload.data.old_email,
    newEmail: payload.data.new_email,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const messageId = crypto.randomUUID()
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'pending',
  })

  const result = await sendViaSmtp({
    supabase,
    to: recipient,
    subject: EMAIL_SUBJECTS[emailType] || 'Notification',
    html,
    text,
  })

  if (!result.ok) {
    console.error('SMTP send failed', { emailType, recipient, error: result.error })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'failed',
      error_message: result.error.slice(0, 500),
    })
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'sent',
  })

  console.log('Auth email sent via SMTP', { emailType, recipient, run_id })

  return new Response(JSON.stringify({ success: true, sent: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (url.pathname.endsWith('/preview')) return handlePreview(req)
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
