
-- What's New announcements + per-user dismissals
CREATE TABLE public.service_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid,
  kind text NOT NULL CHECK (kind IN ('new','price','general')),
  title text NOT NULL,
  body text,
  old_price numeric,
  new_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_announcements TO authenticated;
GRANT ALL ON public.service_announcements TO service_role;
ALTER TABLE public.service_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read announcements" ON public.service_announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage announcements" ON public.service_announcements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.service_announcement_dismissals (
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL REFERENCES public.service_announcements(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
GRANT SELECT, INSERT, DELETE ON public.service_announcement_dismissals TO authenticated;
GRANT ALL ON public.service_announcement_dismissals TO service_role;
ALTER TABLE public.service_announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own dismissals" ON public.service_announcement_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own dismissals" ON public.service_announcement_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own dismissals" ON public.service_announcement_dismissals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_service_announcements_created ON public.service_announcements (created_at DESC);
