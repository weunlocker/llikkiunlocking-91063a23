ALTER VIEW public.site_settings_public SET (security_invoker = false);
GRANT SELECT ON public.site_settings_public TO anon, authenticated;