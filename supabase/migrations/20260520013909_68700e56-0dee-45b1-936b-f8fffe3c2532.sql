
-- 1. Settings table
CREATE TABLE IF NOT EXISTS public.referral_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  percent NUMERIC NOT NULL DEFAULT 10,
  window_days INTEGER NOT NULL DEFAULT 90,
  min_topup NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_settings_singleton CHECK (id = 1)
);
INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads referral_settings" ON public.referral_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update referral_settings" ON public.referral_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert referral_settings" ON public.referral_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID,
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 3. Code generator
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INTEGER;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill existing profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Update handle_new_user to include referral code & referrer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  ref_code TEXT := NULLIF(m->>'ref', '');
  referrer_id UUID := NULL;
BEGIN
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE upper(referral_code) = upper(ref_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, phone, address, city, state, country, pincode, referral_code, referred_by, referred_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(m->>'display_name', split_part(NEW.email, '@', 1)),
    NULLIF(m->>'phone', ''), NULLIF(m->>'address', ''), NULLIF(m->>'city', ''),
    NULLIF(m->>'state', ''), NULLIF(m->>'country', ''), NULLIF(m->>'pincode', ''),
    public.gen_referral_code(),
    referrer_id,
    CASE WHEN referrer_id IS NOT NULL THEN now() ELSE NULL END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

-- 5. Referral bonuses table
CREATE TABLE IF NOT EXISTS public.referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  payment_order_id UUID,
  topup_amount NUMERIC NOT NULL,
  bonus_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refbon_referrer ON public.referral_bonuses(referrer_id);
CREATE INDEX IF NOT EXISTS idx_refbon_referred ON public.referral_bonuses(referred_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_refbon_payment ON public.referral_bonuses(payment_order_id) WHERE payment_order_id IS NOT NULL;

ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral_bonuses" ON public.referral_bonuses FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());
CREATE POLICY "Admins all referral_bonuses" ON public.referral_bonuses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 6. Award function
CREATE OR REPLACE FUNCTION public.award_referral_bonus(
  p_referred_user_id UUID,
  p_topup_amount NUMERIC,
  p_payment_order_id UUID DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s RECORD; ref RECORD; bonus NUMERIC; new_bal NUMERIC;
BEGIN
  SELECT * INTO s FROM public.referral_settings WHERE id = 1;
  IF NOT FOUND OR NOT s.enabled THEN RETURN jsonb_build_object('skipped', 'disabled'); END IF;
  IF p_topup_amount < s.min_topup THEN RETURN jsonb_build_object('skipped', 'below_min'); END IF;

  SELECT id, referred_by, referred_at INTO ref FROM public.profiles WHERE id = p_referred_user_id;
  IF ref.referred_by IS NULL THEN RETURN jsonb_build_object('skipped', 'no_referrer'); END IF;
  IF ref.referred_at IS NULL OR ref.referred_at < now() - (s.window_days || ' days')::interval THEN
    RETURN jsonb_build_object('skipped', 'expired');
  END IF;

  -- de-dupe by payment order
  IF p_payment_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.referral_bonuses WHERE payment_order_id = p_payment_order_id
  ) THEN
    RETURN jsonb_build_object('skipped', 'duplicate');
  END IF;

  bonus := round((p_topup_amount * s.percent / 100.0)::numeric, 2);
  IF bonus <= 0 THEN RETURN jsonb_build_object('skipped', 'zero_bonus'); END IF;

  UPDATE public.profiles SET balance = balance + bonus WHERE id = ref.referred_by RETURNING balance INTO new_bal;
  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
    VALUES (ref.referred_by, 'admin_credit', bonus, new_bal,
            'Referral bonus (' || s.percent || '% of $' || p_topup_amount || ')');
  INSERT INTO public.referral_bonuses (referrer_id, referred_user_id, payment_order_id, topup_amount, bonus_amount)
    VALUES (ref.referred_by, p_referred_user_id, p_payment_order_id, p_topup_amount, bonus);

  RETURN jsonb_build_object('ok', true, 'referrer_id', ref.referred_by, 'bonus', bonus, 'new_balance', new_bal);
END; $$;
