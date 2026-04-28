ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS result_font text,
  ADD COLUMN IF NOT EXISTS result_color text;