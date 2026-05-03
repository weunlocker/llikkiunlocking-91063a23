import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Lock, Globe, ArrowRight, CheckCircle2, Sparkles, Code2, Award, Clock, Users, TrendingUp, Star, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

const stats = [
  { value: "7+", label: "Years in Business", icon: Award },
  { value: "10K+", label: "Active Clients", icon: Users },
  { value: "2M+", label: "IMEIs Processed", icon: TrendingUp },
  { value: "99.9%", label: "Uptime SLA", icon: Clock },
];

const testimonials = [
  { name: "Marco R.", role: "Repair Shop Owner, Italy", text: "Been using Likki since 2019. Fastest iCloud checks I've found and the wholesale pricing is unbeatable.", rating: 5 },
  { name: "Ahmed K.", role: "Wholesale Reseller, UAE", text: "Their API integrated into my system in under an hour. Reliable, accurate, and the support team actually responds.", rating: 5 },
  { name: "Sarah L.", role: "Mobile Tech, USA", text: "I tried four providers before settling here. Likki is the real deal — direct supplier prices, no middlemen.", rating: 5 },
];

const brands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Google", "OnePlus", "Sony", "Motorola"];

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
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span>Trusted Direct Wholesale Supplier — Since 2018</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-5 sm:mb-6 animate-fade-up uppercase" style={{ animationDelay: "0.1s" }}>
            LIKKI <span className="glow-text">UNLOCKING</span><br />
            <span className="text-xl sm:text-3xl md:text-4xl font-semibold tracking-wide normal-case">Enterprise-Grade IMEI & Unlock Services</span>
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
            {["No subscriptions", "Pay per check", "Full API access", "24/7 support"].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="container -mt-6 sm:-mt-10 relative z-10">
        <div className="glass rounded-2xl p-5 sm:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border border-primary/20">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <s.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl sm:text-4xl font-bold font-mono glow-text">{s.value}</div>
              <div className="text-[11px] sm:text-sm text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Brand strip */}
      <section className="container py-10 sm:py-14">
        <p className="text-center text-xs sm:text-sm uppercase tracking-[0.25em] text-muted-foreground mb-6">Supporting devices from</p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-12 gap-y-3">
          {brands.map((b) => (
            <span key={b} className="text-base sm:text-xl font-semibold text-muted-foreground/70 hover:text-foreground transition-colors">
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-block text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Why Likki</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Built for <span className="glow-text">professionals</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { icon: Zap, title: "Lightning Fast", desc: "Most checks complete in under 5 seconds. No waiting. No queues." },
            { icon: Lock, title: "Secure Wallet", desc: "Top up once, check thousands of IMEIs. Transparent per-check pricing." },
            { icon: Code2, title: "Developer API", desc: "Simple GET endpoint. Integrate IMEI checks into your own platform in minutes." },
            { icon: Shield, title: "Direct Supplier", desc: "We source directly — no resellers, no markups. Wholesale pricing for everyone." },
            { icon: Globe, title: "Global Coverage", desc: "All major carriers worldwide. From US Verizon to UK EE to UAE Etisalat." },
            { icon: Clock, title: "24/7 Support", desc: "Real humans, real fast. Telegram, email, or in-dashboard chat — we're here." },
          ].map((f, i) => (
            <div key={f.title} className="glass rounded-2xl p-6 sm:p-8 hover:shadow-neon hover:border-primary/40 transition-all duration-500 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-5 shadow-neon">
                <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services preview */}
      <section className="container py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-block text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Catalog</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Popular <span className="glow-text">Services</span></h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">Transparent pricing. Real-time delivery times.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {services.map((s) => (
            <div key={s.id} className="glass rounded-xl p-5 sm:p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="text-xs font-mono text-primary uppercase tracking-wider">{s.category}</div>
                <div className="text-xs text-muted-foreground">{s.delivery_time}</div>
              </div>
              <h3 className="font-bold mb-2">{s.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl sm:text-2xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                <Button asChild variant="neon" size="sm"><Link to="/services">Check</Link></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8 sm:mt-10">
          <Button asChild variant="glass" size="lg" className="w-full sm:w-auto"><Link to="/services">View All Services <ArrowRight className="w-4 h-4" /></Link></Button>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-block text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Workflow</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Three steps to <span className="glow-text">verify</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { n: "01", title: "Create account", desc: "Sign up in under a minute. No credit card required to start." },
            { n: "02", title: "Top up wallet", desc: "Add credit once, then pay only for the checks you actually run." },
            { n: "03", title: "Check & unlock", desc: "Submit IMEI, get results in seconds. Or wire up our API." },
          ].map((s, i) => (
            <div key={s.n} className="relative glass rounded-2xl p-6 sm:p-8 animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="absolute top-4 right-5 text-5xl sm:text-6xl font-bold font-mono text-primary/15">{s.n}</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 mt-2">{s.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-block text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Testimonials</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Loved by <span className="glow-text">10,000+ pros</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, i) => (
            <div key={t.name} className="glass rounded-2xl p-6 sm:p-8 hover:border-primary/40 transition-all animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <Quote className="w-7 h-7 text-primary/40 mb-3" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-primary text-primary" />)}
              </div>
              <p className="text-sm sm:text-base text-foreground/90 mb-5 leading-relaxed">"{t.text}"</p>
              <div>
                <div className="font-bold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-12 sm:py-20">
        <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 text-center relative overflow-hidden border border-primary/30">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />
          <div className="relative">
            <Globe className="w-10 h-10 sm:w-12 sm:h-12 text-primary mx-auto mb-5 sm:mb-6" />
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 sm:mb-4">Ready to verify any device?</h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto">Join thousands of repair shops, resellers, and developers trusting Likki since 2018.</p>
            <Button asChild variant="hero" size="xl" className="w-full sm:w-auto"><Link to="/register">Create free account <ArrowRight className="w-4 h-4" /></Link></Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
