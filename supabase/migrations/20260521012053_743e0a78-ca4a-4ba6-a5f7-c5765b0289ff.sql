INSERT INTO public.categories (slug, name, sort_order)
VALUES ('free', 'FREE CHECK', 0)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = 0;