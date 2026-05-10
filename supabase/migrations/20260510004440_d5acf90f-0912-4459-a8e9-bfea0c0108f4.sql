ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS cashfree_sandbox_app_id text,
  ADD COLUMN IF NOT EXISTS cashfree_sandbox_secret_key text,
  ADD COLUMN IF NOT EXISTS cashfree_prod_app_id text,
  ADD COLUMN IF NOT EXISTS cashfree_prod_secret_key text;