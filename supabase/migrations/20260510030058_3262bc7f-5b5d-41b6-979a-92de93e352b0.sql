
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS admin_bot_token text,
  ADD COLUMN IF NOT EXISTS admin_bot_username text,
  ADD COLUMN IF NOT EXISTS admin_chat_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_bot_token text,
  ADD COLUMN IF NOT EXISTS client_bot_username text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_bot_chat_id text;

CREATE TABLE IF NOT EXISTS public.telegram_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_kind text NOT NULL CHECK (bot_kind IN ('admin','client')),
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  chat_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_pairings_code_idx ON public.telegram_pairings(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS telegram_pairings_user_idx ON public.telegram_pairings(user_id);

ALTER TABLE public.telegram_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pairings" ON public.telegram_pairings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own pairings" ON public.telegram_pairings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own pairings" ON public.telegram_pairings
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage pairings" ON public.telegram_pairings
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.telegram_updates (
  update_id bigint NOT NULL,
  bot_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_kind, update_id)
);
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages updates" ON public.telegram_updates
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.auth_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  ip text,
  user_agent text,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_login_events_user_idx ON public.auth_login_events(user_id);
CREATE INDEX IF NOT EXISTS auth_login_events_created_idx ON public.auth_login_events(created_at DESC);

ALTER TABLE public.auth_login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view login events" ON public.auth_login_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own login events" ON public.auth_login_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role inserts login events" ON public.auth_login_events
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');
