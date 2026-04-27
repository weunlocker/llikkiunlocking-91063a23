ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS api_format TEXT NOT NULL DEFAULT 'classic';