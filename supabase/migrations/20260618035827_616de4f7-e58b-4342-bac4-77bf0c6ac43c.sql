
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS signup_bonus_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_bonus_amount numeric NOT NULL DEFAULT 1.00;

UPDATE public.site_settings SET signup_bonus_enabled = true, signup_bonus_amount = 1.00 WHERE id = 1;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  ref_code TEXT := NULLIF(m->>'ref', '');
  referrer_id UUID := NULL;
  bonus_enabled boolean := false;
  bonus_amount numeric := 0;
  start_balance numeric := 0;
BEGIN
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE upper(referral_code) = upper(ref_code) LIMIT 1;
  END IF;

  SELECT COALESCE(signup_bonus_enabled,false), COALESCE(signup_bonus_amount,0)
    INTO bonus_enabled, bonus_amount
    FROM public.site_settings WHERE id = 1;

  IF bonus_enabled AND bonus_amount > 0 THEN
    start_balance := bonus_amount;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, phone, address, city, state, country, pincode, referral_code, referred_by, referred_at, balance)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(m->>'display_name', split_part(NEW.email, '@', 1)),
    NULLIF(m->>'phone', ''), NULLIF(m->>'address', ''), NULLIF(m->>'city', ''),
    NULLIF(m->>'state', ''), NULLIF(m->>'country', ''), NULLIF(m->>'pincode', ''),
    public.gen_referral_code(),
    referrer_id,
    CASE WHEN referrer_id IS NOT NULL THEN now() ELSE NULL END,
    start_balance
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  IF start_balance > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
    VALUES (NEW.id, 'admin_credit', start_balance, start_balance, 'Welcome bonus $' || start_balance);
  END IF;

  RETURN NEW;
END; $function$;
