
-- 1. Remove broad anon/auth read on services base table; rely on services_public view
DROP POLICY IF EXISTS "Anyone views active services" ON public.services;

-- 2. Make site_settings_public use security_invoker
ALTER VIEW public.site_settings_public SET (security_invoker = true);

-- 3. Fix mutable search_path on gen_referral_code
ALTER FUNCTION public.gen_referral_code() SET search_path = public;

-- 4. Add service-role-only policy to telegram_chat_state (RLS enabled, no policy)
CREATE POLICY "Service role manages chat state"
ON public.telegram_chat_state
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
