-- Sequence + column for short service codes (001, 002, ...)
CREATE SEQUENCE IF NOT EXISTS public.services_code_seq START 1;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_code text;

-- Backfill existing rows in creation order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.services
  WHERE service_code IS NULL
)
UPDATE public.services s
SET service_code = LPAD(o.rn::text, 3, '0')
FROM ordered o
WHERE s.id = o.id;

-- Advance sequence past the highest used number
SELECT setval(
  'public.services_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(NULLIF(regexp_replace(service_code, '\D', '', 'g'), '')::int) FROM public.services), 0),
    1
  ),
  true
);

-- Default for new rows
ALTER TABLE public.services
  ALTER COLUMN service_code SET DEFAULT LPAD(nextval('public.services_code_seq')::text, 3, '0');

-- Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS services_service_code_key
  ON public.services (service_code);
