ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'lovable';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_api_key TEXT;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings' AND policyname = 'Allow authenticated read site_settings'
  ) THEN
    CREATE POLICY "Allow authenticated read site_settings" ON public.site_settings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings' AND policyname = 'Allow admin update site_settings'
  ) THEN
    CREATE POLICY "Allow admin update site_settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

GRANT SELECT ON public.site_settings TO authenticated;
GRANT UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;