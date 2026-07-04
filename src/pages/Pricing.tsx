import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

type Service = {
  id: string; name: string; description: string | null;
  price: number; silver_price: number | null; gold_price: number | null; diamond_price: number | null;
  delivery_time: string; category: string | null;
};

const GROUPS = [
  { key: "default", label: "Default", color: "text-primary" },
  { key: "silver", label: "Silver", color: "text-slate-300" },
  { key: "gold", label: "Gold", color: "text-yellow-400" },
  { key: "diamond", label: "Diamond", color: "text-cyan-300" },
] as const;

export default function Pricing() {
  const [services, setServices] = useState<Service[]>([]);
  const { format } = useCurrency();

  const priceFor = (s: Service, key: (typeof GROUPS)[number]["key"]) => {
    if (key === "silver" && s.silver_price != null) return format(Number(s.silver_price));
    if (key === "gold" && s.gold_price != null) return format(Number(s.gold_price));
    if (key === "diamond" && s.diamond_price != null) return format(Number(s.diamond_price));
    return format(Number(s.price));
  };

  useEffect(() => {
    supabase
      .from("services_public")
      .select("id,name,description,price,silver_price,gold_price,diamond_price,delivery_time,category")
      .order("sort_order")
      .order("price")
      .then(({ data }) => setServices((data ?? []) as unknown as Service[]));
  }, []);

  return (
    <Layout>
      <Seo
        title="Wholesale Pricing & Delivery Times | LIKKI UNLOCKING"
        description="Transparent group-wise wholesale pricing for IMEI checks, iCloud unlocks, carrier lookups and more. Silver, Gold & Diamond client tiers — best rates guaranteed."
        keywords="IMEI check price, unlock price, wholesale pricing, IMEI service cost, iCloud unlock price"
        path="/pricing"
      />
      <div className="container py-8 md:py-12 px-3 md:px-4">
        <div className="text-center mb-8 md:mb-12 animate-fade-up">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Pricing & <span className="glow-text">Delivery</span></h1>
          <p className="text-muted-foreground text-sm md:text-lg">Group-wise pricing for all services.</p>
        </div>

        {/* Mobile cards */}
        <div className="grid gap-3 md:hidden">
          {services.map((s) => (
            <div key={s.id} className="glass rounded-xl p-3">
              <div className="font-semibold text-sm leading-tight break-words mb-1">{s.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                <Clock className="w-3 h-3" /> {s.delivery_time}
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {GROUPS.map((g) => (
                  <div key={g.key} className="rounded-md bg-secondary/40 py-1.5">
                    <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{g.label}</div>
                    <div className={`font-mono font-bold text-xs ${g.color}`}>{priceFor(s, g.key)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {services.length === 0 && <div className="glass rounded-xl p-6 text-center text-muted-foreground text-sm">No services available.</div>}
        </div>

        {/* Desktop table */}
        <div className="glass rounded-2xl overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold"><Clock className="inline w-4 h-4 mr-1" />Delivery</th>
                {GROUPS.map((g) => (
                  <th key={g.key} className="px-4 py-4 font-semibold text-right">{g.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-semibold">{s.name}{s.category && <div className="text-xs text-muted-foreground font-mono uppercase">{s.category}</div>}</td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{s.delivery_time}</td>
                  {GROUPS.map((g) => (
                    <td key={g.key} className={`px-4 py-4 text-right font-mono font-bold ${g.color}`}>{priceFor(s, g.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
