
DROP VIEW IF EXISTS public.services_public;

CREATE VIEW public.services_public
WITH (security_invoker = false) AS
SELECT s.id, s.name, s.description, s.price, s.delivery_time, s.category,
       s.sample_result, s.result_font, s.result_color, s.service_code,
       s.is_free, s.sort_order, s.active, s.created_at, s.updated_at,
       (s.supplier_id IS NOT NULL AND sup.type = 'dhru') AS is_async
FROM public.services s
LEFT JOIN public.suppliers sup ON sup.id = s.supplier_id
WHERE s.active = true;

GRANT SELECT ON public.services_public TO anon, authenticated;
