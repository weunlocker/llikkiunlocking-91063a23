import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  brand_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  telegram_url: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  footer_text: string | null;
  turnstile_site_key: string | null;
  turnstile_enabled: boolean;
  service_types_enabled: boolean;
  platform_upgrade_popup_enabled: boolean;
};

const DEFAULTS: SiteSettings = {
  brand_name: "LIKKI UNLOCKING",
  tagline: "#1 Direct Wholesale Supplier",
  logo_url: null, favicon_url: null,
  seo_title: null, seo_description: null, seo_keywords: null,
  facebook_url: null, twitter_url: null, instagram_url: null, youtube_url: null,
  telegram_url: null, whatsapp_number: null,
  contact_email: null, contact_phone: null, address: null, footer_text: null,
  turnstile_site_key: null, turnstile_enabled: false,
  service_types_enabled: false,
  platform_upgrade_popup_enabled: true,
};

type Ctx = { settings: SiteSettings; loading: boolean; refresh: () => Promise<void> };
const SiteCtx = createContext<Ctx>({ settings: DEFAULTS, loading: true, refresh: async () => {} });

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("site_settings_public").select("*").eq("id", 1).maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...(data as Partial<SiteSettings>) });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Update document title/meta when settings change
  useEffect(() => {
    if (settings.seo_title) document.title = settings.seo_title;
    const setMeta = (name: string, content: string | null) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    setMeta("description", settings.seo_description);
    setMeta("keywords", settings.seo_keywords);
    if (settings.favicon_url) {
      // Remove all existing icon links to avoid stale /favicon.png winning
      document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach((el) => el.parentNode?.removeChild(el));
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = settings.favicon_url;
      document.head.appendChild(link);
    }
  }, [settings.seo_title, settings.seo_description, settings.seo_keywords, settings.favicon_url]);

  return <SiteCtx.Provider value={{ settings, loading, refresh }}>{children}</SiteCtx.Provider>;
}

export const useSiteSettings = () => useContext(SiteCtx);
