
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS binance_pay_id text,
  ADD COLUMN IF NOT EXISTS binance_qr_url text,
  ADD COLUMN IF NOT EXISTS binance_coins jsonb NOT NULL DEFAULT '["USDT"]'::jsonb,
  ADD COLUMN IF NOT EXISTS binance_min_amount numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS binance_poll_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS binance_last_polled_at timestamptz;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS coin text,
  ADD COLUMN IF NOT EXISTS tx_id text,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_memo_unique
  ON public.payment_orders (memo) WHERE memo IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_orders_status_idx
  ON public.payment_orders (status);
