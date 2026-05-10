CREATE POLICY "Anyone views active services"
ON public.services FOR SELECT
TO anon, authenticated
USING (active = true);