-- Add explicit admin SELECT policies for operational visibility and clarity
CREATE POLICY "Admins read email_send_log" ON public.email_send_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read suppressed_emails" ON public.suppressed_emails
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read site_settings" ON public.site_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));