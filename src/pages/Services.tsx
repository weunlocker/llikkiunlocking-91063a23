import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ImeiCheckDialog from "@/components/ImeiCheckDialog";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null; sample_result: string | null; result_font: string | null; result_color: string | null };

export default function Services() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Service | null>(null);

  useEffect(() => {
    supabase.from("services_public").select("id,name,description,price,delivery_time,category,sample_result,result_font,result_color").order("category").order("sort_order").order("price")
      .then(({ data }) => { setServices(data ?? []); setLoading(false); });
  }, []);

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const k = s.category ?? "general";
    (acc[k] ||= []).push(s); return acc;
  }, {});

  const openCheck = (s: Service) => {
    if (!user) { navigate("/login"); return; }
    setSelected(s);
  };

  return (
    <Layout>
      <div className="container py-12">
        <div className="text-center mb-12 animate-fade-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">All <span className="glow-text">Services</span></h1>
          <p className="text-muted-foreground text-lg">Choose a service, enter the IMEI, get instant results.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-10">
              <h2 className="text-xl font-bold mb-4 capitalize flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-primary rounded-full" /> {cat}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openCheck(s)}
                    className="text-left glass rounded-xl p-5 sm:p-6 hover:border-primary/40 hover:shadow-elegant transition-all flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> {s.delivery_time}</div>
                    </div>
                    <h3 className="font-bold mb-2 hover:text-primary transition-colors">{s.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">{s.description}</p>
                    <div className="grid grid-cols-4 gap-1 mb-3 rounded-lg border border-border/40 bg-background/40 p-2 text-center">
                      <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Default</div><div className="font-mono font-bold text-xs">${Number(s.price).toFixed(2)}</div></div>
                      <div><div className="text-[9px] uppercase tracking-wider text-slate-300">Silver</div><div className="font-mono font-bold text-xs text-slate-200">${(Number(s.price) * 0.90).toFixed(2)}</div></div>
                      <div><div className="text-[9px] uppercase tracking-wider text-yellow-400">Gold</div><div className="font-mono font-bold text-xs text-yellow-300">${(Number(s.price) * 0.70).toFixed(2)}</div></div>
                      <div><div className="text-[9px] uppercase tracking-wider text-cyan-300">Diamond</div><div className="font-mono font-bold text-xs text-cyan-200">${(Number(s.price) * 0.50).toFixed(2)}</div></div>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button variant="neon" size="sm" asChild={false} onClick={(e) => { e.stopPropagation(); openCheck(s); }}>Check IMEI</Button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ImeiCheckDialog
        service={selected}
        balance={Number(profile?.balance ?? 0)}
        onClose={() => setSelected(null)}
        onAfterRun={refreshProfile}
      />
    </Layout>
  );
}
