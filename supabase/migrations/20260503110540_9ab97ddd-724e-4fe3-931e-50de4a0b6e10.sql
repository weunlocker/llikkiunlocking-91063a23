
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS order_expiry_minutes integer NOT NULL DEFAULT 10;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
