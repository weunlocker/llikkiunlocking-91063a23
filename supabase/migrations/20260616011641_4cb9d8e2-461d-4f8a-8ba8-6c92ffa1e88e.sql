REVOKE ALL ON FUNCTION public.credit_balance(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_balance(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.credit_balance(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) TO service_role;