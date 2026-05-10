import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, DollarSign, Tag } from "lucide-react";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

export default function Pricing() {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    supabase.from("services_public").select("id,name,description,price,delivery_time,category").order("sort_order").order("price").then(({ data }) => setServices(data ?? []));
  }, []);

  return (
    <Layout>
      <div className="container py-8 md:py-12 px-4">
        <div className="text-center mb-8 md:mb-12 animate-fade-up">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Pricing & <span className="glow-text">Delivery</span></h1>
          <p className="text-muted-foreground text-sm md:text-lg">Pay only for what you check. Top up your wallet anytime.</p>
        </div>

        {/* Mobile: cards */}
        <div className="grid gap-3 md:hidden">
          {services.map((s) => (
            <div key={s.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base leading-tight break-words">{s.name}</div>
                  {s.category && <div className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">{s.category}</div>}
                </div>
                <div className="font-mono font-bold text-primary text-lg whitespace-nowrap">${Number(s.price).toFixed(2)}</div>
              </div>
              {s.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{s.description}</p>}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{s.delivery_time}</span>
              </div>
            </div>
          ))}
          {services.length === 0 && <div className="glass rounded-xl p-6 text-center text-muted-foreground text-sm">No services available.</div>}
        </div>

        {/* Desktop: table */}
        <div className="glass rounded-2xl overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold hidden md:table-cell">Description</th>
                <th className="px-6 py-4 font-semibold"><Clock className="inline w-4 h-4 mr-1" />Delivery</th>
                <th className="px-6 py-4 font-semibold text-right"><DollarSign className="inline w-4 h-4" />Price</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-semibold">{s.name}<div className="text-xs text-muted-foreground font-mono uppercase">{s.category}</div></td>
                  <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{s.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{s.delivery_time}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary">${Number(s.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
