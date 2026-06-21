import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import nodemailer from 'npm:nodemailer@6.9.14'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Configuration — SENDER_DOMAIN and FROM_DOMAIN can be overridden via env secrets
// EMAIL_SENDER_DOMAIN and EMAIL_FROM_DOMAIN without redeploying code changes.
// This lets you switch between verified domains (e.g., notify.mail.likkiunlocking.com
// and notify.likkiunlocking.com) by just updating the secret.
const SITE_NAME = "LIKKI UNLOCKING"
const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') || "notify.mail.likkiunlocking.com"
// FROM_DOMAIN must align with SENDER_DOMAIN (Mailgun sender_domain_mismatch otherwise).
// Defaults to SENDER_DOMAIN if EMAIL_FROM_DOMAIN secret is not set.
const FROM_DOMAIN = Deno.env.get('EMAIL_FROM_DOMAIN') || SENDER_DOMAIN

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function configuredSecretKeys(primaryKey: string): Set<string> {
  const keys = new Set([primaryKey])
  const rawKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!rawKeys) return keys
  try {
    const parsed = JSON.parse(rawKeys)
    const values = Array.isArray(parsed) ? parsed : Object.values(parsed)
    for (const value of values) {
      if (typeof value === 'string') keys.add(value)
      else if (value && typeof value === 'object') {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (typeof nested === 'string') keys.add(nested)
        }
      }
    }
  } catch {
    for (const value of rawKeys.split(/[\s,]+/)) {
      if (value) keys.add(value)
    }
  }
  return keys
}

function friendlySmtpError(message: string): string {
  const lower = message.toLowerCase()
  if (message.includes('535') || lower.includes('authentication')) {
    return 'SMTP login failed. Check the SMTP username/password and make sure the username is the full email address.'
  }
  if (lower.includes('certificate') || lower.includes('tls') || lower.includes('ssl')) {
    return 'SMTP TLS/SSL connection failed. Check that the SMTP port and SSL setting match your mail provider.'
  }
  return message
}

async function sendViaConfiguredSmtp(
  supabase: ReturnType<typeof createClient>,
  opts: { to: string; subject: string; html: string; text: string }
): Promise<{ ok: true; provider: string; messageId?: string; response?: string } | { ok: false; provider: string; error: string }> {
  const { data: cfg, error } = await supabase
    .from('email_settings')
    .select('enabled, provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, reply_to')
    .eq('id', 1)
    .maybeSingle()

  if (error || !cfg) return { ok: false, provider: 'smtp', error: 'Email settings not configured' }
  if (cfg.enabled === false) return { ok: false, provider: String(cfg.provider ?? 'smtp'), error: 'Emails disabled in settings' }

  const provider = String(cfg.provider ?? 'smtp')
  if (provider === 'lovable') return { ok: false, provider, error: 'Lovable email provider selected' }

  const smtpHost = String(cfg.smtp_host ?? '').trim()
  const smtpUser = String(cfg.smtp_user ?? '').trim()
  const smtpPassword = String(cfg.smtp_password ?? '').trim()
  const fromEmail = String(cfg.from_email ?? '').trim()
  const fromName = String(cfg.from_name ?? SITE_NAME).trim() || SITE_NAME
  const replyTo = String(cfg.reply_to ?? '').trim() || undefined

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    return { ok: false, provider, error: 'SMTP not fully configured' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(cfg.smtp_port) || 587,
      secure: !!cfg.smtp_secure,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    })

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })

    return { ok: true, provider, messageId: info.messageId, response: info.response }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, provider, error: friendlySmtpError(message) }
  }
}

// Auth note: this function accepts trusted backend calls only. The key is
// validated in-function because modern service-role keys are not JWTs.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') ?? ''
  const apiKey = req.headers.get('apikey') ?? ''

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const bearerToken = authorization.replace(/^Bearer\s+/i, '')
  const allowedKeys = configuredSecretKeys(supabaseServiceKey)
  let authorized = allowedKeys.has(bearerToken) || allowedKeys.has(apiKey)

  // Also allow authenticated admin users (for test-send from Admin UI)
  if (!authorized && bearerToken) {
    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: userData } = await adminClient.auth.getUser(bearerToken)
      if (userData?.user?.id) {
        const { data: isAdmin } = await adminClient.rpc('has_role', {
          _user_id: userData.user.id,
          _role: 'admin',
        })
        if (isAdmin === true) authorized = true
      }
    } catch (e) {
      console.error('admin auth check failed', e)
    }
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // If the admin selected SMTP, send immediately through the configured SMTP
  // server. This avoids the Lovable-domain queue path when that domain is not
  // verified, which was reporting queued while delivery later failed.
  const smtpResult = await sendViaConfiguredSmtp(supabase, {
    to: effectiveRecipient,
    subject: resolvedSubject,
    html,
    text: plainText,
  })

  if (smtpResult.provider !== 'lovable') {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'pending',
    })

    if (!smtpResult.ok) {
      console.error('SMTP transactional send failed', { templateName, effectiveRecipient, error: smtpResult.error })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: smtpResult.error.slice(0, 500),
      })
      return new Response(JSON.stringify({ success: false, error: smtpResult.error }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'sent',
      metadata: { provider: 'smtp', smtpMessageId: smtpResult.messageId, smtpResponse: smtpResult.response },
    })

    console.log('Transactional email sent via SMTP', { templateName, effectiveRecipient, response: smtpResult.response })
    return new Response(JSON.stringify({ success: true, sent: true, provider: 'smtp' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
