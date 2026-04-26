import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Smartphone, Clock, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { imeiSchema } from "@/lib/validation";

type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null };

export default function Services() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Service | null>(null);
  const [imei, setImei] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; result?: string; error?: string } | null>(null);

  useEffect(() => {
    supabase.from("services").select("id,name,description,price,delivery_time,category").eq("active", true).order("category").order("price")
      .then(({ data }) => { setServices(data ?? []); setLoading(false); });
  }, []);

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const k = s.category ?? "general";
    (acc[k] ||= []).push(s); return acc;
  }, {});

  const openCheck = (s: Service) => {
    if (!user) { navigate("/login"); return; }
    setSelected(s); setImei(""); setResult(null);
  };

  const submitCheck = async () => {
    if (!selected) return;
    const parsed = imeiSchema.safeParse(imei);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!profile || Number(profile.balance) < Number(selected.price)) {
      toast.error("Insufficient balance. Please top up.");
      navigate("/dashboard");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("check-imei", {
      body: { service_id: selected.id, imei: parsed.data },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setResult(data);
    refreshProfile();
    if (data?.status === "completed") toast.success("Check complete");
    else if (data?.status === "failed") toast.error(data?.error ?? "Check failed");
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
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((s) => (
                  <div key={s.id} className="glass rounded-xl p-6 hover:border-primary/40 hover:shadow-elegant transition-all flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> {s.delivery_time}</div>
                    </div>
                    <h3 className="font-bold mb-2">{s.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{s.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                      <Button variant="neon" size="sm" onClick={() => openCheck(s)}>Check IMEI</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              Cost: <span className="font-mono text-primary font-bold">${Number(selected?.price ?? 0).toFixed(2)}</span> · Delivery: {selected?.delivery_time}
            </DialogDescription>
          </DialogHeader>
          {!result ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="imei">IMEI / Serial</Label>
                <Input id="imei" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="e.g. 356938035643809" maxLength={20} className="font-mono" />
              </div>
              <div className="flex items-center justify-between text-sm glass rounded-md p-3">
                <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Your balance</span>
                <span className="font-mono font-bold">${Number(profile?.balance ?? 0).toFixed(2)}</span>
              </div>
              <Button variant="hero" className="w-full" onClick={submitCheck} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Check
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {result.status === "completed" ? (
                <div className="flex items-center gap-3 text-success"><CheckCircle2 className="w-6 h-6" /> Check completed</div>
              ) : (
                <div className="flex items-center gap-3 text-destructive"><XCircle className="w-6 h-6" /> Check failed</div>
              )}
              <pre className="glass rounded-md p-4 text-xs font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto">
                {result.result || result.error || "No response"}
              </pre>
              <Button variant="glass" className="w-full" onClick={() => setSelected(null)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
