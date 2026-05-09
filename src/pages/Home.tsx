import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Lock, Globe, ArrowRight, CheckCircle2, Code2, Award, Clock, Users, TrendingUp, Star, Quote, ShieldCheck, BadgeCheck, Server, KeyRound } from "lucide-react";
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

const trustBadges = [
  { icon: ShieldCheck, label: "GDPR Compliant" },
  { icon: Lock, label: "TLS 1.3 Encrypted" },
  { icon: Server, label: "99.9% Uptime SLA" },
  { icon: BadgeCheck, label: "Verified Supplier" },
];

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    supabase.from("services").select("id,name,description,price,delivery_time,category").eq("active", true).order("price").limit(6).then(({ data }) => setServices(data ?? []));
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-1/3 left-1/4 w-[28rem] h-[28rem] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[28rem] h-[28rem] bg-accent/10 rounded-full blur-[140px]" />

        <div className="container relative py-20 sm:py-28 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full glass text-xs sm:text-sm mb-6 animate-fade-up">
            <BadgeCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="text-muted-foreground">Trusted Wholesale Supplier</span>
            <span className="w-px h-3 bg-border" />
            <span className="font-mono text-foreground">Est. 2018</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-up leading-[1.05]" style={{ animationDelay: "0.1s" }}>
            Enterprise IMEI Intelligence<br />
            <span className="glow-text">Built for Professionals</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
            Verify iCloud status, carrier, blacklist, model, warranty and more — plus full unlock services. Direct supplier pricing, sub-5-second results, and a developer-first API.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button asChild variant="hero" size="xl" className="w-full sm:w-auto">
              <Link to="/register">Start Checking <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button asChild variant="glass" size="xl" className="w-full sm:w-auto">
              <Link to="/services">View Services</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-xs sm:text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {["No subscriptions", "Pay per check", "Full API access", "24/7 support"].map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="container -mt-10 relative z-10">
        <div className="glass rounded-2xl p-6 sm:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border border-primary/20 shadow-elegant">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl sm:text-4xl font-bold font-mono">{s.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase tracking-[0.15em]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust badges */}
      <section className="container py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {trustBadges.map((b) => (
            <div key={b.label} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/40 text-xs sm:text-sm text-muted-foreground">
              <b.icon className="w-4 h-4 text-primary" />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Brand strip */}
      <section className="container pb-14 sm:pb-20">
        <p className="text-center text-[11px] sm:text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">Supporting devices from</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-14 gap-y-3 opacity-70">
          {brands.map((b) => (
            <span key={b} className="text-base sm:text-lg font-semibold tracking-wide text-muted-foreground hover:text-foreground transition-colors">
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-block text-[11px] uppercase tracking-[0.3em] text-primary font-semibold mb-3">Why Likki</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Built for <span className="glow-text">professionals</span></h2>
          <p className="text-sm sm:text-base text-muted-foreground">Every feature engineered for repair shops, resellers and developers who need reliable, accurate, fast results — at scale.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            { icon: Zap, title: "Lightning Fast", desc: "Most checks complete in under 5 seconds. No waiting. No queues." },
            { icon: KeyRound, title: "Secure Wallet", desc: "Top up once, check thousands of IMEIs. Transparent per-check pricing." },
            { icon: Code2, title: "Developer API", desc: "Simple GET endpoint. Integrate IMEI checks into your platform in minutes." },
            { icon: Shield, title: "Direct Supplier", desc: "We source directly — no resellers, no markups. Wholesale pricing for everyone." },
            { icon: Globe, title: "Global Coverage", desc: "All major carriers worldwide. From US Verizon to UK EE to UAE Etisalat." },
            { icon: Clock, title: "24/7 Support", desc: "Real humans, real fast. Telegram, email, or in-dashboard chat — we're here." },
          ].map((f, i) => (
            <div key={f.title} className="group glass rounded-xl p-6 sm:p-7 hover:border-primary/40 hover:shadow-elegant transition-all duration-300 animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services preview */}
      <section className="container py-14 sm:py-20 border-t border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-primary font-semibold mb-3">Catalog</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Popular <span className="glow-text">Services</span></h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">Transparent pricing. Real-time delivery times.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="self-start sm:self-end">
            <Link to="/services">View all <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {services.map((s) => (
            <div key={s.id} className="glass rounded-xl p-5 sm:p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="text-[10px] font-mono text-primary uppercase tracking-[0.15em]">{s.category}</div>
                <div className="text-xs text-muted-foreground">{s.delivery_time}</div>
              </div>
              <h3 className="font-semibold mb-2">{s.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
                <div className="text-xl sm:text-2xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                <Button asChild variant="neon" size="sm"><Link to="/services">Check</Link></Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-block text-[11px] uppercase tracking-[0.3em] text-primary font-semibold mb-3">Workflow</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Three steps to <span className="glow-text">verify</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { n: "01", title: "Create account", desc: "Sign up in under a minute. No credit card required to start." },
            { n: "02", title: "Top up wallet", desc: "Add credit once, then pay only for the checks you actually run." },
            { n: "03", title: "Check & unlock", desc: "Submit IMEI, get results in seconds. Or wire up our API." },
          ].map((s, i) => (
            <div key={s.n} className="relative glass rounded-xl p-6 sm:p-8 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="absolute top-4 right-5 text-5xl sm:text-6xl font-bold font-mono text-primary/10">{s.n}</div>
              <h3 className="text-base sm:text-lg font-semibold mb-2 mt-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-14 sm:py-20 border-t border-border/40">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-block text-[11px] uppercase tracking-[0.3em] text-primary font-semibold mb-3">Testimonials</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Loved by <span className="glow-text">10,000+ pros</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, i) => (
            <div key={t.name} className="glass rounded-xl p-6 sm:p-7 hover:border-primary/40 transition-all animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <Quote className="w-7 h-7 text-primary/30 mb-3" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />)}
              </div>
              <p className="text-sm text-foreground/90 mb-5 leading-relaxed">"{t.text}"</p>
              <div className="pt-4 border-t border-border/40">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-14 sm:py-20">
        <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 text-center relative overflow-hidden border border-primary/30">
          <div className="absolute inset-0 bg-gradient-glow opacity-40" />
          <div className="relative max-w-2xl mx-auto">
            <Globe className="w-10 h-10 text-primary mx-auto mb-5" />
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">Ready to verify any device?</h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8">Join thousands of repair shops, resellers, and developers trusting Likki since 2018.</p>
            <Button asChild variant="hero" size="xl" className="w-full sm:w-auto"><Link to="/register">Create free account <ArrowRight className="w-4 h-4" /></Link></Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
