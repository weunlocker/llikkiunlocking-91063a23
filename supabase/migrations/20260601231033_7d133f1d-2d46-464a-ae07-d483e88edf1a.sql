
ALTER TABLE public.supplier_services
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'imei',
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'imei',
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fields jsonb;

-- Allow imei/server values only
ALTER TABLE public.supplier_services DROP CONSTRAINT IF EXISTS supplier_services_service_type_chk;
ALTER TABLE public.supplier_services ADD CONSTRAINT supplier_services_service_type_chk CHECK (service_type IN ('imei','server'));

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_chk;
ALTER TABLE public.services ADD CONSTRAINT services_service_type_chk CHECK (service_type IN ('imei','server'));
