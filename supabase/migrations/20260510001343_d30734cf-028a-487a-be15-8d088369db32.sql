
-- 1) Services: remove public access, expose only safe columns via a view
DROP POLICY IF EXISTS "Anyone views active services" ON public.services;

CREATE POLICY "Authenticated admins view all services"
ON public.services FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.services_public
WITH (security_invoker = false) AS
SELECT id, name, description, price, delivery_time, category,
       sample_result, result_font, result_color, service_code,
       is_free, sort_order, active, created_at, updated_at
FROM public.services
WHERE active = true;

GRANT SELECT ON public.services_public TO anon, authenticated;

-- 2) Site settings: hide internal Telegram IDs from public
DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;

CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = false) AS
SELECT id, brand_name, tagline, logo_url, favicon_url,
       contact_email, contact_phone, address,
       whatsapp_number, telegram_url, facebook_url, twitter_url,
       instagram_url, youtube_url, footer_text,
       seo_title, seo_description, seo_keywords,
       turnstile_site_key, turnstile_enabled,
       created_at, updated_at
FROM public.site_settings
WHERE id = 1;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- 3) Atomic balance deduction to prevent TOCTOU race
CREATE OR REPLACE FUNCTION public.deduct_balance(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_bal numeric;
BEGIN
  UPDATE public.profiles
     SET balance = balance - p_amount
   WHERE id = p_user_id
     AND balance >= p_amount
     AND COALESCE(banned, false) = false
  RETURNING balance INTO new_bal;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;
  RETURN new_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_balance(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric) TO service_role;
