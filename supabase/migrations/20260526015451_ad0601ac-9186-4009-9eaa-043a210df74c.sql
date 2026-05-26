ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_order_placed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_order_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_balance_updates boolean NOT NULL DEFAULT true;