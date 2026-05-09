
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS turnstile_site_key TEXT,
  ADD COLUMN IF NOT EXISTS turnstile_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.private_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  turnstile_secret_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view private settings" ON public.private_settings;
CREATE POLICY "Admins can view private settings"
  ON public.private_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert private settings" ON public.private_settings;
CREATE POLICY "Admins can insert private settings"
  ON public.private_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update private settings" ON public.private_settings;
CREATE POLICY "Admins can update private settings"
  ON public.private_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.private_settings (id, turnstile_secret_key)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
