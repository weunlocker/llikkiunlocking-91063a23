import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Gift, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { imeiSchema } from "@/lib/validation";
import { ColoredResult } from "@/components/ColoredResult";
import { stripColorMarkers } from "@/lib/extractResponse";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type FreeService = {
  id: string;
  name: string;
  description: string | null;
  delivery_time: string;
  result_font: string | null;
};

export default function FreeCheck() {
  const [services, setServices] = useState<FreeService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FreeService | null>(null);
  const [imei, setImei] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");
  const [inputOpen, setInputOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { settings } = useSiteSettings();

  useEffect(() => {
    document.title = "Free IMEI Check — Model, FMI & Sim Lock";
    (async () => {
      const { data } = await supabase
        .from("services_public")
        .select("id,name,description,delivery_time,result_font")
        .eq("is_free", true)
        .order("name");
      setServices((data ?? []) as FreeService[]);
      setLoading(false);
    })();
  }, []);

  const run = async () => {
    if (!selected) return;
    const v = imeiSchema.safeParse(imei.trim());
    if (!v.success) { toast.error("Enter a valid IMEI / serial (8–20 chars)"); return; }
    setRunning(true); setResult("");
    try {
      const ch = await supabase.functions.invoke("free-check-challenge", { body: {} });
      if (ch.error || !ch.data?.sig) throw new Error("Could not initialize check");

      const { data, error } = await supabase.functions.invoke("free-check", {
        body: { service_id: selected.id, imei: imei.trim(), challenge: ch.data },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult((data as any).result || "(empty)");
      setInputOpen(false);
      setResultOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Layout>
      <Seo
        title="Free IMEI Check Online — No Signup | LIKKI UNLOCKING"
        description="Run a free IMEI check online with no registration. Verify your phone's model, warranty, carrier and blacklist status instantly. 100% free promotional service."
        keywords="free IMEI check, free IMEI lookup, IMEI checker, free phone check, IMEI verify online"
        path="/free-check"
      />
      <section className="container py-10 md:py-16">
        <header className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Gift className="w-3.5 h-3.5" /> Promotional · No login required
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Free IMEI Check</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Try our checks for free. Pick a service, enter your IMEI or serial number and get an instant result.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : services.length === 0 ? (
          <Card className="glass max-w-xl mx-auto p-8 text-center text-muted-foreground">
            No free checks are available right now. Please check back soon.
          </Card>
        ) : (
          <section aria-labelledby="free-checks-heading">
            <h2 id="free-checks-heading" className="sr-only">Available free checks</h2>
            <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {services.map((s) => (
                <Card
                  key={s.id}
                  className="glass p-5 cursor-pointer transition border border-border/50 hover:border-primary/40"
                  onClick={() => { setSelected(s); setImei(""); setResult(""); setInputOpen(true); }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{s.name}</h3>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-3">{s.description}</p>}
                  <div className="text-xs text-muted-foreground">⏱ {s.delivery_time}</div>
                  <div className="mt-3 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">FREE</div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* IMEI Input Popup */}
        <Dialog open={inputOpen} onOpenChange={(o) => {
          setInputOpen(o);
          if (!o) {
            setImei("");
            setSelected(null);
          }
        }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>Enter the IMEI or serial number to check.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-row gap-2 pt-2">
              <Input
                aria-label="IMEI or serial number"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && imei.trim() && !running) run(); }}
                placeholder="IMEI / Serial"
                maxLength={20}
                className="font-mono"
                enterKeyHint="go"
              />
              <Button variant="hero" onClick={run} disabled={running || !imei.trim()}>
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Result Popup */}
        <Dialog open={resultOpen} onOpenChange={(o) => {
          setResultOpen(o);
          if (!o) {
            setImei("");
            setResult("");
            setSelected(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="items-center text-center">
              {settings.logo_url && (
                <img
                  src={settings.logo_url}
                  alt={`${settings.brand_name} logo`}
                  className="mx-auto mb-1 h-8 w-auto object-contain"
                />
              )}
              <DialogTitle className="flex items-center justify-center gap-2 text-base">
                <CheckCircle2 className="w-4 h-4 text-success" />
                {selected?.name}
              </DialogTitle>

              <DialogDescription>
                IMEI / Serial: <span className="font-mono">{imei}</span>
              </DialogDescription>
            </DialogHeader>
            {result && <ColoredResult text={result} font={selected?.result_font ?? undefined} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(stripColorMarkers(result))}>Copy</Button>
              <Button variant="hero" onClick={() => setResultOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
