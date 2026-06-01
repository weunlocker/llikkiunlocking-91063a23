CREATE OR REPLACE VIEW public.services_public AS
SELECT s.id, s.name, s.description, s.price, s.delivery_time, s.category,
       s.sample_result, s.result_font, s.result_color, s.service_code,
       s.is_free, s.sort_order, s.active, s.created_at, s.updated_at,
       (s.supplier_id IS NOT NULL AND sup.type = 'dhru'::text) AS is_async,
       s.input_mode, s.input_label, s.input_min_length, s.input_max_length,
       s.input_regex, s.input_info, s.input_allow_alpha, s.input_allow_bulk,
       s.service_type, s.custom_fields
FROM services s
LEFT JOIN suppliers sup ON sup.id = s.supplier_id
WHERE s.active = true;