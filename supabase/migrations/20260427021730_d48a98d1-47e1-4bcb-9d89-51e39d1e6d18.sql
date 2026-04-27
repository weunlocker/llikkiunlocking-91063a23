CREATE TABLE public.supplier_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  action_code TEXT NOT NULL,
  name TEXT NOT NULL,
  credit NUMERIC,
  delivery_time TEXT,
  info TEXT,
  raw JSONB,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, action_code)
);

CREATE INDEX idx_supplier_services_supplier ON public.supplier_services(supplier_id);

ALTER TABLE public.supplier_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage supplier_services"
ON public.supplier_services
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));