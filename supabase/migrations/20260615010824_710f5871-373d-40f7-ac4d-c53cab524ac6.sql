ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS platform_upgrade_popup_enabled boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT id,
    brand_name,
    tagline,
    logo_url,
    favicon_url,
    contact_email,
    contact_phone,
    address,
    whatsapp_number,
    telegram_url,
    facebook_url,
    twitter_url,
    instagram_url,
    youtube_url,
    footer_text,
    seo_title,
    seo_description,
    seo_keywords,
    turnstile_site_key,
    turnstile_enabled,
    service_types_enabled,
    platform_upgrade_popup_enabled,
    created_at,
    updated_at
   FROM site_settings
  WHERE id = 1;

GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT ON public.site_settings_public TO authenticated;