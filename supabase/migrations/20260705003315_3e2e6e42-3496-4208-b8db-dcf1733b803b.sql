DROP VIEW IF EXISTS public.services_public;
CREATE VIEW public.services_public AS
SELECT id, service_code, name, description, price, silver_price, gold_price, diamond_price,
       delivery_time, category, active, is_free, sort_order,
       sample_result, result_font, result_color,
       input_mode, input_label, input_min_length, input_max_length, input_regex, input_info,
       input_allow_alpha, input_allow_bulk, service_type, custom_fields,
       created_at, updated_at
FROM public.services
WHERE active = true;
GRANT SELECT ON public.services_public TO anon, authenticated;