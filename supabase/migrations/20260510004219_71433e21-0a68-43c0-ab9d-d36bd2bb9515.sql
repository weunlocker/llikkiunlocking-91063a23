ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS cashfree_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashfree_env text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS cashfree_min_amount numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cashfree_usd_to_inr numeric NOT NULL DEFAULT 85,
  ADD CONSTRAINT cashfree_env_valid CHECK (cashfree_env IN ('sandbox','production'));