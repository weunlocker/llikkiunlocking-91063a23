import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Renders all registered templates with their previewData.
// Authorized callers: Lovable Go API (LOVABLE_API_KEY) OR an authenticated admin user.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  let authorized = !!token && token === lovableKey

  if (!authorized && token) {
    try {
      const admin = createClient(supabaseUrl, serviceKey)
      const { data: userData } = await admin.auth.getUser(token)
      if (userData?.user?.id) {
        const { data: isAdmin } = await admin.rpc('has_role', {
          _user_id: userData.user.id, _role: 'admin',
        })
        if (isAdmin === true) authorized = true
      }
    } catch (e) {
      console.error('admin auth check failed', e)
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateNames = Object.keys(TEMPLATES)
  const results: Array<{
    templateName: string
    displayName: string
    subject: string
    html: string
    status: 'ready' | 'preview_data_required' | 'render_failed'
    errorMessage?: string
  }> = []

  for (const name of templateNames) {
    const entry = TEMPLATES[name]
    const displayName = entry.displayName || name

    if (!entry.previewData) {
      results.push({ templateName: name, displayName, subject: '', html: '', status: 'preview_data_required' })
      continue
    }

    try {
      const html = await renderAsync(React.createElement(entry.component, entry.previewData))
      const resolvedSubject =
        typeof entry.subject === 'function' ? entry.subject(entry.previewData) : entry.subject
      results.push({ templateName: name, displayName, subject: resolvedSubject, html, status: 'ready' })
    } catch (err) {
      console.error('Failed to render template for preview', { template: name, error: err })
      results.push({
        templateName: name, displayName, subject: '', html: '', status: 'render_failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return new Response(JSON.stringify({ templates: results }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
