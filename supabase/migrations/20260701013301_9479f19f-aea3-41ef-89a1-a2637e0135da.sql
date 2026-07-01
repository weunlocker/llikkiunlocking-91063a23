-- Restrict site_settings SELECT to admins only (public fields exposed via site_settings_public view)
DROP POLICY IF EXISTS "Allow authenticated read site_settings" ON public.site_settings;

-- Allow authenticated users to insert their own orders (defense in depth; primary path is service-role edge function)
CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());