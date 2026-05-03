
-- Client groups, profile fields, API gate, custom message
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_group text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS api_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_message text;

-- Per-user service override (custom price + enable/disable for this user)
CREATE TABLE IF NOT EXISTS public.user_service_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  custom_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);

ALTER TABLE public.user_service_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage overrides"
  ON public.user_service_overrides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own overrides"
  ON public.user_service_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_user_service_overrides_updated_at
  BEFORE UPDATE ON public.user_service_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
