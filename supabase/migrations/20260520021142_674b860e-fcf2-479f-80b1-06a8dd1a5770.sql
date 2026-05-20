CREATE OR REPLACE FUNCTION public.get_public_payment_settings()
RETURNS TABLE(
  binance_enabled boolean,
  ask_admin_enabled boolean,
  cashfree_enabled boolean,
  topup_amounts jsonb,
  binance_pay_id text,
  binance_qr_url text,
  binance_coins jsonb,
  binance_min_amount numeric,
  cashfree_min_amount numeric,
  cashfree_usd_to_inr numeric,
  order_expiry_minutes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(binance_enabled, false),
    COALESCE(ask_admin_enabled, false),
    COALESCE(cashfree_enabled, false),
    topup_amounts,
    binance_pay_id,
    binance_qr_url,
    binance_coins,
    binance_min_amount,
    cashfree_min_amount,
    cashfree_usd_to_inr,
    order_expiry_minutes
  FROM public.payment_settings WHERE id = 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_settings() TO authenticated, anon;