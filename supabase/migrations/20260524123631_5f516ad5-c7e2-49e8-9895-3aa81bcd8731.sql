-- Restore public read access to services through the safe view without exposing sensitive supplier fields
ALTER VIEW public.services_public SET (security_invoker = false);
GRANT SELECT ON public.services_public TO anon, authenticated;