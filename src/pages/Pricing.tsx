import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, DollarSign } from "lucide-react";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

export default function Pricing() {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    supabase.from("services_public").select("id,name,description,price,delivery_time,category").order("sort_order").order("price").then(({ data }) => setServices(data ?? []));
  }, []);

  return (
    <Layout>
      <div className="container py-12">
        <div className="text-center mb-12 animate-fade-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Pricing & <span className="glow-text">Delivery</span></h1>
          <p className="text-muted-foreground text-lg">Pay only for what you check. Top up your wallet anytime.</p>
        </div>
        <div className="glass rounded-2xl overflow-hidden">
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
