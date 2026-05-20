UPDATE public.payment_settings
SET binance_enabled = true,
    cashfree_enabled = true,
    ask_admin_enabled = true,
    binance_poll_enabled = true,
    updated_at = now()
WHERE id = 1;

ALTER TABLE public.payment_settings
  ALTER COLUMN binance_enabled SET DEFAULT true,
  ALTER COLUMN cashfree_enabled SET DEFAULT true,
  ALTER COLUMN ask_admin_enabled SET DEFAULT true;