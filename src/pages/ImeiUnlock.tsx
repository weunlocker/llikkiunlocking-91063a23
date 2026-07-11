import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Clock, CheckCircle2, Globe, Signal } from "lucide-react";

const FAQS = [
  {
    q: "What is IMEI unlock?",
    a: "IMEI unlock is the process of removing the carrier / network lock from a phone using its unique IMEI number. Once unlocked, the device works with any GSM SIM card worldwide.",
  },
  {
    q: "Is IMEI unlock permanent?",
    a: "Yes. The unlock is registered on the carrier's database against your IMEI, so it survives factory resets and iOS/Android updates.",
  },
  {
    q: "Which carriers and devices are supported?",
    a: "AT&T, T-Mobile, Verizon, Sprint, Vodafone, EE, O2, Three, Rogers, Bell, Telstra, Optus and 200+ more. Works on iPhone, Samsung, Google Pixel, Xiaomi, OnePlus, Motorola, Sony, and most GSM devices.",
  },
  {
    q: "How long does an IMEI unlock take?",
    a: "iPhone unlocks are typically 1–48 hours. Android carrier unlocks are usually delivered as an unlock code within minutes to a few hours.",
  },
  {
    q: "Do I lose warranty or data when unlocking by IMEI?",
    a: "No. IMEI unlocking is done through official carrier databases — no jailbreak, no data loss, no warranty impact.",
  },
  {
    q: "What if the unlock fails?",
    a: "Failed unlocks are automatically refunded to your wallet balance.",
  },
];

export default function ImeiUnlock() {
  const path = "/services/imei-unlock";
  const url = `https://likkiunlocking.com${path}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "IMEI Unlock",
      serviceType: "Phone Network Unlock",
      description:
        "Unlock any phone by IMEI — remove carrier / network lock permanently. Works with iPhone, Samsung, Pixel and all major GSM devices. Refund on failure.",
      provider: { "@type": "Organization", name: "LIKKI UNLOCKING", url: "https://likkiunlocking.com" },
      areaServed: "Worldwide",
      offers: { "@type": "Offer", priceCurrency: "USD", availability: "https://schema.org/InStock", url },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://likkiunlocking.com/" },
        { "@type": "ListItem", position: 2, name: "Services", item: "https://likkiunlocking.com/services" },
        { "@type": "ListItem", position: 3, name: "IMEI Unlock", item: url },
      ],
    },
  ];

  return (
    <Layout>
      <Seo
        title="IMEI Unlock — Permanent Carrier Unlock by IMEI | LIKKI UNLOCKING"
        description="Unlock any iPhone, Samsung or Android by IMEI. Permanent carrier / network unlock via official databases. Wholesale pricing, refund on failure."
        keywords="imei unlock, unlock phone by imei, iphone imei unlock, carrier unlock, network unlock, sim unlock, unlock code, permanent phone unlock"
        path={path}
        type="product"
        jsonLd={jsonLd}
      />

      <div className="container py-8">
        <nav className="text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/services" className="hover:text-primary">Services</Link> / <span className="text-foreground">IMEI Unlock</span>
        </nav>

        <section className="glass rounded-xl p-6 sm:p-10 mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-primary mb-3">
            <Globe className="w-4 h-4" /> 200+ carriers · 190+ countries
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            IMEI <span className="glow-text">Unlock</span> — Any Phone, Any Carrier
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-6">
            Permanently unlock iPhone, Samsung, Google Pixel and every major GSM phone by IMEI. Official database unlock — no jailbreak, no data loss, refund on failure.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="neon" asChild><Link to="/services">Order IMEI Unlock</Link></Button>
            <Button variant="outline" asChild><Link to="/free-check">Free IMEI check first</Link></Button>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Zap, title: "Fast turnaround", body: "Android codes in minutes. iPhone factory unlocks 1–48 hours." },
            { icon: ShieldCheck, title: "Permanent & official", body: "Registered against IMEI in carrier database. Survives updates and resets." },
            { icon: Signal, title: "Any SIM worldwide", body: "Use local SIMs when traveling, avoid roaming fees, resell at full value." },
          ].map(({ icon: I, title, body }) => (
            <div key={title} className="glass rounded-lg p-4">
              <I className="w-5 h-5 text-primary mb-2" />
              <h3 className="text-sm font-bold mb-1">{title}</h3>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">How to unlock a phone by IMEI</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span> Dial <code className="bg-muted px-1.5 py-0.5 rounded">*#06#</code> on the phone to reveal the 15-digit IMEI.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span> Pick the matching carrier / model service from our catalog and enter the IMEI.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span> Pay from your wallet — order is submitted to the carrier database immediately.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</span> Receive confirmation (or unlock code for Android). Insert any SIM — phone is unlocked.</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Popular unlock services</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              "iPhone AT&T Premium Unlock",
              "iPhone T-Mobile USA Unlock",
              "iPhone Verizon Unlock",
              "Samsung Network Unlock Code",
              "Google Pixel Unlock",
              "Xiaomi / Redmi Unlock",
              "Vodafone UK Unlock",
              "EE UK Unlock",
              "Rogers / Bell / Telus Canada",
            ].map((s) => (
              <Link key={s} to="/services" className="glass rounded-lg p-3 text-sm hover:border-primary/40 transition-all">
                <CheckCircle2 className="w-4 h-4 text-primary inline mr-2" /> {s}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Why choose LIKKI UNLOCKING</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Direct wholesale supplier — no middleman markup",
              "Live delivery tracking in your dashboard & via API",
              "Automatic wallet refund on any failed unlock",
              "24/7 support via live chat, Telegram and email",
              "Trusted by resellers in 190+ countries",
            ].map((t) => (
              <li key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {t}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="glass rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-semibold">{f.q}</summary>
                <p className="text-sm text-muted-foreground mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Unlock your phone today</h2>
          <p className="text-sm text-muted-foreground mb-4">Wholesale prices, refund on failure, 24/7 support.</p>
          <Button variant="neon" asChild><Link to="/services">Browse unlock services</Link></Button>
        </section>
      </div>
    </Layout>
  );
}
