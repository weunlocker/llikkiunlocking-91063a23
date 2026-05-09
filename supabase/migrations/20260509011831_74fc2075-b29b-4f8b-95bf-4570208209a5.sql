ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS telegram_channel_id text,
  ADD COLUMN IF NOT EXISTS telegram_group_id text;