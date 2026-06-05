import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Clock, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import ImeiCheckDialog from "@/components/ImeiCheckDialog";
import { slugify } from "@/lib/slug";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  delivery_time: string;
  category: string | null;
  sample_result: string | null;
  result_font: string | null;
  result_color: string | null;
  service_type?: "imei" | "server" | null;
  custom_fields?: { name: string; label: string; type: string; required: boolean; default?: string; options?: string[] }[] | null;
};

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { format } = useCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCheck, setOpenCheck] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("services_public")
        .select("id,name,description,price,delivery_time,category,sample_result,result_font,result_color,is_free,service_type,custom_fields");
      setServices(((data ?? []) as unknown as Service[]));
      setLoading(false);
    })();
  }, []);

  const service = useMemo(() => services.find((s) => slugify(s.name) === slug) ?? null, [services, slug]);
  const related = useMemo(() => {
    if (!service) return [];
    return services.filter((s) => s.id !== service.id && s.category === service.category).slice(0, 6);
  }, [services, service]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </Layout>
    );
  }

  if (!service) {
    return (
      <Layout>
        <Seo title="Service not found | LIKKI UNLOCKING" description="The requested service does not exist." path={`/services/${slug}`} noindex />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">Service not found</h1>
          <p className="text-muted-foreground mb-6">This service link is invalid or has been removed.</p>
          <Button asChild><Link to="/services">Browse all services</Link></Button>
        </div>
      </Layout>
    );
  }

  const path = `/services/${slug}`;
  const title = `${service.name} | LIKKI UNLOCKING`;
  const description = (service.description ?? `${service.name}. Wholesale IMEI check & unlock service. Delivery ${service.delivery_time}.`).slice(0, 158);
  const keywords = `${service.name}, ${service.category ?? "imei"}, IMEI check, phone unlock, ${service.name} online, ${service.name} price`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      description: service.description ?? undefined,
      category: service.category ?? undefined,
      provider: { "@type": "Organization", name: "LIKKI UNLOCKING", url: "https://likkiunlocking.com" },
      areaServed: "Worldwide",
      offers: {
        "@type": "Offer",
        price: Number(service.price).toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `https://likkiunlocking.com${path}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://likkiunlocking.com/" },
        { "@type": "ListItem", position: 2, name: "Services", item: "https://likkiunlocking.com/services" },
        { "@type": "ListItem", position: 3, name: service.name, item: `https://likkiunlocking.com${path}` },
      ],
    },
  ];

  const onCheck = () => {
    if (!user) { navigate("/login"); return; }
    setOpenCheck(true);
  };

  return (
    <Layout>
      <Seo title={title} description={description} keywords={keywords} path={path} type="product" jsonLd={jsonLd} />
      <div className="container py-8">
        <nav className="text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/services" className="hover:text-primary">Services</Link> / <span className="text-foreground">{service.name}</span>
        </nav>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-xl p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Smartphone className="w-4 h-4 text-primary" />
              {service.category && <span className="capitalize">{service.category}</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{service.name}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {service.description || `Order ${service.name} online at wholesale price. Fast, reliable IMEI check & unlock service trusted globally.`}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="glass rounded-lg p-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /><div><div className="text-[11px] text-muted-foreground">Delivery</div><div className="text-sm font-semibold">{service.delivery_time}</div></div></div>
              <div className="glass rounded-lg p-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /><div><div className="text-[11px] text-muted-foreground">Type</div><div className="text-sm font-semibold capitalize">{service.service_type ?? "imei"}</div></div></div>
              <div className="glass rounded-lg p-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /><div><div className="text-[11px] text-muted-foreground">Refund</div><div className="text-sm font-semibold">On failure</div></div></div>
            </div>

            <div className="rounded-xl border border-border/50 p-4 mb-6">
              <h2 className="text-sm font-bold mb-2">What you get</h2>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Genuine {service.name} report.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Delivery within {service.delivery_time}.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Full API access &amp; history in dashboard.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Wholesale pricing for resellers.</li>
              </ul>
            </div>

            {service.sample_result && (
              <div className="rounded-xl border border-border/50 p-4">
                <h2 className="text-sm font-bold mb-2">Sample result</h2>
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground" style={{ color: service.result_color ?? undefined, fontFamily: service.result_font ?? undefined }}>{service.sample_result}</pre>
              </div>
            )}
          </div>

          <aside className="glass rounded-xl p-5 h-fit lg:sticky lg:top-20">
            <div className="text-xs text-muted-foreground mb-1">Price</div>
            <div className="text-3xl font-bold font-mono mb-1">{format(Number(service.price))}</div>
            <div className="text-[11px] text-muted-foreground mb-4">per IMEI · {service.delivery_time}</div>
            <Button variant="neon" className="w-full mb-2" onClick={onCheck}>Check IMEI now</Button>
            <Button variant="outline" className="w-full" asChild><Link to="/services">View all services</Link></Button>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-bold mb-3">Related services</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {related.map((r) => (
                <Link key={r.id} to={`/services/${slugify(r.name)}`} className="glass rounded-lg p-3 hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between mb-1">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span className="text-[11px] text-muted-foreground">{r.delivery_time}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{r.name}</h3>
                  <div className="text-sm font-bold font-mono">{format(Number(r.price))}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <ImeiCheckDialog
        service={openCheck ? service : null}
        balance={Number(profile?.balance ?? 0)}
        onClose={() => setOpenCheck(false)}
        onAfterRun={refreshProfile}
      />
    </Layout>
  );
}
