// Generates public/sitemap.xml including a URL per service for SEO.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://likkiunlocking.com";
const SUPABASE_URL = "https://jhkumqyugvezfulkoine.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoa3VtcXl1Z3ZlemZ1bGtvaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTA2MTgsImV4cCI6MjA5Mjc4NjYxOH0.Pq6aFEXaj0M8rNiUvVg26aWV_5Ft8hRtFrop60PaoEg";

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Entry = { path: string; changefreq?: string; priority?: string };

const staticEntries: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/services", changefreq: "daily", priority: "0.9" },
  { path: "/pricing", changefreq: "daily", priority: "0.9" },
  { path: "/free-check", changefreq: "weekly", priority: "0.8" },
  { path: "/api-docs", changefreq: "weekly", priority: "0.7" },
  { path: "/login", changefreq: "monthly", priority: "0.4" },
  { path: "/login-otp", changefreq: "monthly", priority: "0.3" },
  { path: "/register", changefreq: "monthly", priority: "0.5" },
  { path: "/forgot-password", changefreq: "monthly", priority: "0.3" },
  { path: "/reset-password", changefreq: "monthly", priority: "0.3" },
];

async function main() {
  let serviceEntries: Entry[] = [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from("services_public").select("name").limit(1000);
    if (error) throw error;
    const seen = new Set<string>();
    serviceEntries = (data ?? [])
      .map((r: { name: string }) => slugify(r.name))
      .filter((s) => s && !seen.has(s) && (seen.add(s), true))
      .map((slug) => ({ path: `/services/${slug}`, changefreq: "weekly", priority: "0.8" }));
  } catch (e) {
    console.warn("[sitemap] failed to fetch services:", (e as Error).message);
  }

  const all = [...staticEntries, ...serviceEntries];
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...all.map((e) => `  <url><loc>${BASE_URL}${e.path}</loc>${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`),
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${all.length} entries, ${serviceEntries.length} services)`);
}

main();
