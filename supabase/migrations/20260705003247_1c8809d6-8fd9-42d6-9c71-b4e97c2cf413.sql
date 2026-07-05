DROP VIEW IF EXISTS public.services_public;

ALTER TABLE public.services 
  ALTER COLUMN price TYPE numeric(12,4),
  ALTER COLUMN silver_price TYPE numeric(12,4),
  ALTER COLUMN gold_price TYPE numeric(12,4),
  ALTER COLUMN diamond_price TYPE numeric(12,4);

CREATE VIEW public.services_public AS
SELECT id, service_code, name, description, price, silver_price, gold_price, diamond_price,
       delivery_time, category, active, is_free, created_at, updated_at
FROM public.services
WHERE active = true;

GRANT SELECT ON public.services_public TO anon, authenticated;