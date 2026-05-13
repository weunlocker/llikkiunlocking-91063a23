CREATE OR REPLACE FUNCTION public.get_otp_login_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT otp_login_enabled FROM public.email_settings WHERE id = 1), true);
$$;

REVOKE EXECUTE ON FUNCTION public.get_otp_login_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_otp_login_enabled() TO anon, authenticated;