import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { HelpCircle, MessageCircle, Send, Mail, Phone, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "How do I place an unlocking order?",
    a: "Browse Services, choose the service you need, enter your IMEI or required details, and confirm. Your balance is charged once the order is accepted.",
  },
  {
    q: "How long does an order take?",
    a: "Delivery time is shown on each service page. Most IMEI checks finish in seconds; carrier unlocks can take from a few minutes up to several days depending on the carrier.",
  },
  {
    q: "What happens if my order fails?",
    a: "Failed orders are refunded to your wallet automatically. You can also contact support from the Dashboard if you believe there's an issue.",
  },
  {
    q: "How do I add funds to my wallet?",
    a: "Go to Dashboard → Wallet and choose Top Up. We support Binance Pay, Cashfree (UPI/cards in INR), and manual top-up via admin.",
  },
  {
    q: "How do I find my IMEI?",
    a: "Dial *#06# on your phone, or go to Settings → About. The IMEI is a 15-digit number unique to your device.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes — failed orders are auto-refunded. For other refund requests please open a support ticket from the Dashboard.",
  },
  {
    q: "Can I get a price discount?",
    a: "Volume customers can be moved to a custom price group by an admin. Contact support with your monthly volume estimate.",
  },
  {
    q: "Is my IMEI/data safe?",
    a: "Yes. We only forward the data required to fulfil your order to the relevant provider, and we never share customer data with third parties.",
  },
];

export default function Help() {
  const { settings } = useSiteSettings();

  return (
    <Layout>
      <Seo
        title="Help & FAQ"
        description="Answers to common questions about IMEI checks, unlocking, payments, and order delivery."
      />
      <div className="container py-8 sm:py-12 max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <LifeBuoy className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold glow-text mb-2">Help Center</h1>
          <p className="text-muted-foreground">Find answers fast, or reach out to our team.</p>
        </div>

        <Card className="p-4 sm:p-6 mb-6 glass">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <Card className="p-4 sm:p-6 glass">
          <h2 className="font-semibold text-lg mb-3">Still need help?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Our support team usually replies within a few hours.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Button asChild variant="hero">
              <Link to="/dashboard?tab=support">
                <MessageCircle className="w-4 h-4 mr-2" /> Open support ticket
              </Link>
            </Button>
            {settings.telegram_url && (
              <Button asChild variant="outline">
                <a href={settings.telegram_url} target="_blank" rel="noopener noreferrer">
                  <Send className="w-4 h-4 mr-2" /> Telegram
                </a>
              </Button>
            )}
            {settings.whatsapp_number && (
              <Button asChild variant="outline">
                <a
                  href={`https://wa.me/${settings.whatsapp_number.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </a>
              </Button>
            )}
            {settings.contact_email && (
              <Button asChild variant="outline">
                <a href={`mailto:${settings.contact_email}`}>
                  <Mail className="w-4 h-4 mr-2" /> Email us
                </a>
              </Button>
            )}
            {settings.contact_phone && (
              <Button asChild variant="outline">
                <a href={`tel:${settings.contact_phone}`}>
                  <Phone className="w-4 h-4 mr-2" /> Call us
                </a>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
