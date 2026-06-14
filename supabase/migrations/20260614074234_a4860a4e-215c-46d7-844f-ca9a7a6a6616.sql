REVOKE EXECUTE ON FUNCTION public.consume_stock(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_stock(uuid, uuid, uuid) TO service_role;