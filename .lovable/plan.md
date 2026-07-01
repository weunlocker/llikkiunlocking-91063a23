Add a dedicated **AI Settings** area in the admin panel so the user can pick the AI provider (Lovable vs Groq) and paste their own Groq API key, then have the AI service-description and chatbot edge functions use that provider at runtime.

Database
- Add `ai_provider` (text, default 'lovable') and `ai_api_key` (text, nullable) to `public.site_settings` so admins can configure them without redeploying.

Admin UI
- Add a new sidebar item: **AI / Chatbot** → `/admin/ai-settings`.
- Build `AdminAISettings` page with:
  - Provider dropdown: Lovable AI Gateway (default) / Groq.
  - API key input (password-field style) shown only for Groq.
  - Save button that writes to `site_settings` row 1.

Edge Functions
- Update `supabase/functions/ai-describe-service/index.ts` to read `ai_provider` + `ai_api_key` from `site_settings` via service_role. If provider is `groq` and key is present, call `https://api.groq.com/openai/v1/chat/completions` with model `llama-3.3-70b-versatile`; otherwise keep the existing Lovable gateway path.
- Update `supabase/functions/ai-chat/index.ts` with the same runtime provider switch, supporting streaming for both providers.
- Keep graceful fallback: if Groq key is missing/empty, silently fall back to Lovable.

How to get a Groq API key
- Go to https://console.groq.com/keys
- Sign in with a Google/Github account or email.
- Click **Create API Key**.
- Copy the key (starts with `gsk_...`).
- Paste it into the new **AI Settings** page in your admin panel and select **Groq** as provider.

The free tier gives 1500 requests/day and $5/month in credits, which is enough for service descriptions and chatbot traffic.