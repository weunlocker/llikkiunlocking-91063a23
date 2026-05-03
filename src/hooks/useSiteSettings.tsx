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
};

const DEFAULTS: SiteSettings = {
  brand_name: "LIKKI UNLOCKING",
  tagline: "#1 Direct Wholesale Supplier",
  logo_url: null, favicon_url: null,
  seo_title: null, seo_description: null, seo_keywords: null,
  facebook_url: null, twitter_url: null, instagram_url: null, youtube_url: null,
  telegram_url: null, whatsapp_number: null,
  contact_email: null, contact_phone: null, address: null, footer_text: null,
};

type Ctx = { settings: SiteSettings; loading: boolean; refresh: () => Promise<void> };
const SiteCtx = createContext<Ctx>({ settings: DEFAULTS, loading: true, refresh: async () => {} });

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
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
  }, [settings.seo_title, settings.seo_description, settings.seo_keywords]);

  return <SiteCtx.Provider value={{ settings, loading, refresh }}>{children}</SiteCtx.Provider>;
}

export const useSiteSettings = () => useContext(SiteCtx);
