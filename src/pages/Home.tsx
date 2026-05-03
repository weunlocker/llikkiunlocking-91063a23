import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Lock, Globe, ArrowRight, CheckCircle2, Sparkles, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    supabase.from("services").select("id,name,description,price,delivery_time,category").eq("active", true).order("price").limit(6).then(({ data }) => setServices(data ?? []));
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: "1.5s" }} />

        <div className="container relative py-16 sm:py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full glass text-xs sm:text-sm mb-5 sm:mb-6 animate-fade-up">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span>Trusted by 10,000+ professionals worldwide</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-5 sm:mb-6 animate-fade-up uppercase" style={{ animationDelay: "0.1s" }}>
            LIKKI <span className="glow-text">UNLOCKING</span><br />
            <span className="text-xl sm:text-3xl md:text-4xl font-semibold tracking-wide normal-case">#1 Direct Wholesale Supplier</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            iCloud status, carrier lookup, blacklist verification, model & warranty info, plus full unlocking services — verify and unlock any device in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button asChild variant="hero" size="xl" className="w-full sm:w-auto">
              <Link to="/register">Start Checking <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button asChild variant="glass" size="xl" className="w-full sm:w-auto">
              <Link to="/services">Browse Services</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-8 sm:mt-12 text-xs sm:text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {["No subscriptions", "Pay per check", "Full API access", "Instant results"].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Lightning Fast", desc: "Most checks complete in under 5 seconds. No waiting. No queues." },
            { icon: Lock, title: "Secure Wallet", desc: "Top up once, check thousands of IMEIs. Transparent per-check pricing." },
            { icon: Code2, title: "Developer API", desc: "Simple GET endpoint. Integrate IMEI checks into your own platform in minutes." },
          ].map((f, i) => (
            <div key={f.title} className="glass rounded-2xl p-8 hover:shadow-neon transition-all duration-500 animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-5 shadow-neon">
                <f.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services preview */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Popular <span className="glow-text">Services</span></h2>
          <p className="text-muted-foreground text-lg">Transparent pricing. Real-time delivery times.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => (
            <div key={s.id} className="glass rounded-xl p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="text-xs font-mono text-primary uppercase tracking-wider">{s.category}</div>
                <div className="text-xs text-muted-foreground">{s.delivery_time}</div>
              </div>
              <h3 className="font-bold mb-2">{s.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                <Button asChild variant="neon" size="sm"><Link to="/services">Check</Link></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button asChild variant="glass" size="lg"><Link to="/services">View All Services <ArrowRight className="w-4 h-4" /></Link></Button>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="glass rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />
          <div className="relative">
            <Globe className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Ready to verify any device?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">Sign up free, top up your wallet, and start checking IMEIs immediately.</p>
            <Button asChild variant="hero" size="xl"><Link to="/register">Create free account <ArrowRight className="w-4 h-4" /></Link></Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
