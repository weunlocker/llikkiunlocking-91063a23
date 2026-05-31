ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'imei',
  ADD COLUMN IF NOT EXISTS input_label text,
  ADD COLUMN IF NOT EXISTS input_min_length integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS input_max_length integer NOT NULL DEFAULT 20;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_input_mode_chk;
ALTER TABLE public.services
  ADD CONSTRAINT services_input_mode_chk CHECK (input_mode IN ('imei','imei_sn','custom'));