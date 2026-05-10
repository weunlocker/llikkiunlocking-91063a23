import { useEffect } from "react";

type Props = {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  path?: string; // e.g. "/pricing"
  type?: "website" | "article" | "product";
  jsonLd?: object | object[];
  noindex?: boolean;
};

const SITE = "https://likkiunlocking.com";

function upsert(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = document.createElement(selector.split("[")[0]);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  return el;
}

export default function Seo({
  title,
  description,
  keywords,
  image,
  path,
  type = "website",
  jsonLd,
  noindex,
}: Props) {
  useEffect(() => {
    const url = `${SITE}${path ?? (typeof window !== "undefined" ? window.location.pathname : "/")}`;
    if (title) document.title = title;

    const setMeta = (name: string, val?: string, prop = false) => {
      if (!val) return;
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      upsert(sel, prop ? { property: name, content: val } : { name, content: val });
    };

    setMeta("description", description);
    setMeta("keywords", keywords);
    setMeta("robots", noindex ? "noindex,nofollow" : "index,follow");

    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", type, true);
    setMeta("og:url", url, true);
    if (image) setMeta("og:image", image, true);

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    if (image) setMeta("twitter:image", image);

    // canonical
    let link = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;

    // JSON-LD
    document.head.querySelectorAll("script[data-seo='jsonld']").forEach((s) => s.remove());
    if (jsonLd) {
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      arr.forEach((obj) => {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.dataset.seo = "jsonld";
        s.text = JSON.stringify(obj);
        document.head.appendChild(s);
      });
    }
  }, [title, description, keywords, image, path, type, noindex, JSON.stringify(jsonLd)]);

  return null;
}
