import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Clock, CheckCircle2, Smartphone } from "lucide-react";

const FAQS = [
  {
    q: "What is MDM and why does my iPhone or iPad show a remote management screen?",
    a: "MDM (Mobile Device Management) is a corporate/school profile that locks the device to an organization's server. It appears during setup as 'Remote Management' and prevents you from using the device until you enter credentials that only the organization has.",
  },
  {
    q: "Does MDM bypass permanently remove the profile?",
    a: "Yes. Our MDM bypass service removes the remote management lock so the device can be activated and used normally. The bypass persists through normal use; a full DFU restore can re-trigger the MDM prompt on some models.",
  },
  {
    q: "Which devices are supported?",
    a: "iPhone 6s through the latest iPhone models, iPad (all recent generations), and iPod touch running iOS 13 and above. Works on Wi-Fi and cellular models.",
  },
  {
    q: "How long does the MDM bypass take?",
    a: "Most orders complete within a few minutes to a few hours. Delivery time is shown on each service page before you order.",
  },
  {
    q: "Do I need to jailbreak the device?",
    a: "No. Our MDM removal does not require a jailbreak and does not void hardware warranty.",
  },
  {
    q: "What if the bypass fails?",
    a: "You get an automatic refund to your wallet balance. We only charge for successful removals.",
  },
];

export default function MdmBypass() {
  const path = "/services/mdm-bypass";
  const url = `https://likkiunlocking.com${path}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "MDM Bypass & Removal",
      serviceType: "MDM Bypass",
      description:
        "Remove MDM (Mobile Device Management) remote management lock from iPhone and iPad. Fast, no jailbreak required, refund on failure.",
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
        { "@type": "ListItem", position: 3, name: "MDM Bypass", item: url },
      ],
    },
  ];

  return (
    <Layout>
      <Seo
        title="MDM Bypass — Remove Remote Management from iPhone & iPad | LIKKI UNLOCKING"
        description="Fast MDM bypass service. Remove Mobile Device Management remote-management lock from iPhone and iPad. No jailbreak, refund on failure, wholesale pricing."
        keywords="mdm bypass, mdm removal, remove mdm iphone, remote management bypass, ipad mdm bypass, mdm unlock, corporate mdm removal"
        path={path}
        type="product"
        jsonLd={jsonLd}
      />

      <div className="container py-8">
        <nav className="text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/services" className="hover:text-primary">Services</Link> / <span className="text-foreground">MDM Bypass</span>
        </nav>

        <section className="glass rounded-xl p-6 sm:p-10 mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-primary mb-3">
            <ShieldCheck className="w-4 h-4" /> Trusted by resellers worldwide
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            MDM <span className="glow-text">Bypass</span> — Remove Remote Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-6">
            Permanently remove the "Remote Management" / MDM lock from iPhone and iPad so the device can be activated and used normally. No jailbreak required. Refund on failure.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="neon" asChild><Link to="/services">Order MDM Bypass</Link></Button>
            <Button variant="outline" asChild><Link to="/free-check">Free IMEI check first</Link></Button>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Zap, title: "Fast delivery", body: "Most orders finish in minutes. Longest jobs complete within hours." },
            { icon: ShieldCheck, title: "Safe & permanent", body: "No jailbreak. Warranty preserved. Bypass persists through normal use." },
            { icon: Clock, title: "Refund on failure", body: "We only charge for successful removals — failures auto-refund." },
          ].map(({ icon: I, title, body }) => (
            <div key={title} className="glass rounded-lg p-4">
              <I className="w-5 h-5 text-primary mb-2" />
              <h3 className="text-sm font-bold mb-1">{title}</h3>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">How MDM bypass works</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span> Enter the IMEI or serial of the locked iPhone / iPad on the MDM Bypass service page.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span> Pay from your wallet balance — order is queued instantly.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span> When complete you receive a notification. Reboot the device — the "Remote Management" screen is gone.</li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</span> Set up the device as new and use it normally.</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Supported devices</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "iPhone 6s / 6s Plus / SE (1st gen)",
              "iPhone 7 / 7 Plus / 8 / 8 Plus / X",
              "iPhone XR / XS / XS Max / 11 series",
              "iPhone 12 / 13 / 14 / 15 / 16 series",
              "iPad (5th gen and later)",
              "iPad Air, iPad mini, iPad Pro (all recent)",
            ].map((d) => (
              <div key={d} className="glass rounded-lg p-3 flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-primary" /> {d}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">What you get</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Permanent removal of the corporate / school MDM profile",
              "Delivery status visible in your dashboard and via API",
              "Automatic refund if the bypass cannot complete",
              "Wholesale pricing — cheaper than sickw, imei24 and other resellers",
              "24/7 support via live chat, Telegram and email",
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
          <h2 className="text-xl font-bold mb-2">Ready to remove MDM?</h2>
          <p className="text-sm text-muted-foreground mb-4">Order MDM Bypass now — delivery within hours, refund on failure.</p>
          <Button variant="neon" asChild><Link to="/services">Browse MDM services</Link></Button>
        </section>
      </div>
    </Layout>
  );
}
