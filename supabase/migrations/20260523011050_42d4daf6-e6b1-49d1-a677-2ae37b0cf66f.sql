CREATE POLICY "Authenticated view active services" ON public.services FOR SELECT TO authenticated USING (active = true);
GRANT SELECT ON public.services_public TO anon, authenticated;