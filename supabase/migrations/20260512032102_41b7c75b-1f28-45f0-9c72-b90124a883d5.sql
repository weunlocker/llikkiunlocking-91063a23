CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (id, email, display_name, phone, address, city, state, country, pincode)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(m->>'display_name', split_part(NEW.email, '@', 1)),
    NULLIF(m->>'phone', ''),
    NULLIF(m->>'address', ''),
    NULLIF(m->>'city', ''),
    NULLIF(m->>'state', ''),
    NULLIF(m->>'country', ''),
    NULLIF(m->>'pincode', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $function$;