ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_services_sort ON public.services(category, sort_order, name);