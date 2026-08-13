ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_title text NOT NULL DEFAULT 'We''ll be back soon',
  ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'Our site is currently undergoing scheduled maintenance. Please check back shortly.';

DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public AS
SELECT id, brand_name, tagline, logo_url, favicon_url, contact_email, contact_phone,
       address, whatsapp_number, telegram_url, facebook_url, twitter_url, instagram_url,
       youtube_url, footer_text, seo_title, seo_description, seo_keywords,
       turnstile_site_key, turnstile_enabled, service_types_enabled,
       platform_upgrade_popup_enabled, signup_bonus_enabled, signup_bonus_amount,
       maintenance_enabled, maintenance_title, maintenance_message,
       created_at, updated_at
FROM public.site_settings
WHERE id = 1;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;