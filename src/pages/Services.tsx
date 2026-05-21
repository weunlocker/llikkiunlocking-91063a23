import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ImeiCheckDialog from "@/components/ImeiCheckDialog";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null; sample_result: string | null; result_font: string | null; result_color: string | null };
type Category = { slug: string; name: string; sort_order: number };

export default function Services() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Service | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: svc }, { data: cats }] = await Promise.all([
        supabase.from("services_public").select("id,name,description,price,delivery_time,category,sample_result,result_font,result_color,is_free").order("category").order("sort_order").order("price"),
        supabase.from("categories").select("slug,name,sort_order"),
      ]);
      setServices(((svc ?? []) as Service[]));
      setCategories((cats ?? []) as Category[]);
      setLoading(false);
    })();
  }, []);

  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const k = s.category ?? "general";
    (acc[k] ||= []).push(s); return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "free") return -1;
    if (b === "free") return 1;
    const ao = catMap[a]?.sort_order ?? 9999;
    const bo = catMap[b]?.sort_order ?? 9999;
    if (ao !== bo) return ao - bo;
    return (catMap[a]?.name ?? a).localeCompare(catMap[b]?.name ?? b);
  });

  const openCheck = (s: Service) => {
    if (!user) { navigate("/login"); return; }
    setSelected(s);
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "IMEI Check & Unlock Services",
    description: "Catalog of wholesale IMEI check and phone unlocking services.",
    url: "https://likkiunlocking.com/services",
    hasPart: services.slice(0, 30).map((s) => ({
      "@type": "Service",
      name: s.name,
      description: s.description ?? undefined,
      category: s.category ?? undefined,
      provider: { "@type": "Organization", name: "LIKKI UNLOCKING" },
      offers: {
        "@type": "Offer",
        price: Number(s.price).toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    })),
  };

  return (
    <Layout>
      <Seo
        title="IMEI Check & Unlock Services | LIKKI UNLOCKING"
        description="Browse 100+ wholesale IMEI check and unlock services — iCloud, carrier, blacklist, FMI, MDM. Instant results with full API."
        keywords="IMEI services, iCloud check, carrier check, blacklist check, FMI status, MDM removal, phone unlock services"
        path="/services"
        jsonLd={collectionJsonLd}
      />
      <div className="container py-12">
        <div className="text-center mb-12 animate-fade-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">All <span className="glow-text">Services</span></h1>
          <p className="text-muted-foreground text-lg">Choose a service, enter the IMEI, get instant results.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          groupKeys.map((cat) => {
            const items = grouped[cat];
            const label = catMap[cat]?.name ?? cat;
            return (
            <div key={cat} className="mb-10">
              <h2 className="text-xl font-bold mb-4 capitalize flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-primary rounded-full" /> {label}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openCheck(s)}
                    className="text-left glass rounded-xl p-5 sm:p-6 hover:border-primary/40 hover:shadow-elegant transition-all flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> {s.delivery_time}</div>
                    </div>
                    <h3 className="font-bold mb-2 hover:text-primary transition-colors">{s.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">{s.description}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xl sm:text-2xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                      <Button variant="neon" size="sm" asChild={false} onClick={(e) => { e.stopPropagation(); openCheck(s); }}>Check IMEI</Button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>

      <ImeiCheckDialog
        service={selected}
        balance={Number(profile?.balance ?? 0)}
        onClose={() => setSelected(null)}
        onAfterRun={refreshProfile}
      />
    </Layout>
  );
}
