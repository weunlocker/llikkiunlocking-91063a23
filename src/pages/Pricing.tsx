import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

const GROUPS = [
  { key: "default", label: "Default", discount: 0, color: "text-primary" },
  { key: "silver", label: "Silver", discount: 0.10, color: "text-slate-300" },
  { key: "gold", label: "Gold", discount: 0.30, color: "text-yellow-400" },
  { key: "diamond", label: "Diamond", discount: 0.50, color: "text-cyan-300" },
];

const priceFor = (base: number, d: number) => (Number(base) * (1 - d)).toFixed(2);

export default function Pricing() {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    supabase.from("services_public").select("id,name,description,price,delivery_time,category").order("sort_order").order("price").then(({ data }) => setServices(data ?? []));
  }, []);

  return (
    <Layout>
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
                    <div className={`font-mono font-bold text-xs ${g.color}`}>${priceFor(s.price, g.discount)}</div>
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
                  <th key={g.key} className="px-4 py-4 font-semibold text-right">
                    {g.label}
                    {g.discount > 0 && <div className="text-[10px] font-normal text-muted-foreground">−{Math.round(g.discount * 100)}%</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-semibold">{s.name}{s.category && <div className="text-xs text-muted-foreground font-mono uppercase">{s.category}</div>}</td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{s.delivery_time}</td>
                  {GROUPS.map((g) => (
                    <td key={g.key} className={`px-4 py-4 text-right font-mono font-bold ${g.color}`}>${priceFor(s.price, g.discount)}</td>
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
