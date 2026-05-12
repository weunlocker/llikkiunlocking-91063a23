import { useEffect, useRef, useState } from "react";
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
import { useSiteSettings } from "@/hooks/useSiteSettings";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, any>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
      execute: (id?: string | HTMLElement, opts?: Record<string, any>) => void;
    };
  }
}

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
  const [open, setOpen] = useState(false);
  const { settings } = useSiteSettings();
  const [turnstileConfig, setTurnstileConfig] = useState<{ loaded: boolean; enabled: boolean; siteKey: string | null }>({
    loaded: false,
    enabled: false,
    siteKey: null,
  });
  const [tsToken, setTsToken] = useState<string>("");
  const tsRef = useRef<HTMLDivElement | null>(null);
  const tsWidgetId = useRef<string | null>(null);

  const turnstileSiteKey = turnstileConfig.siteKey ?? settings.turnstile_site_key;
  const turnstileEnabled = turnstileConfig.loaded
    ? turnstileConfig.enabled && !!turnstileSiteKey
    : settings.turnstile_enabled && !!turnstileSiteKey;

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("site_settings_public")
        .select("turnstile_site_key, turnstile_enabled")
        .eq("id", 1)
        .maybeSingle();
      if (!cancelled) {
        setTurnstileConfig({
          loaded: true,
          enabled: Boolean((data as any)?.turnstile_enabled),
          siteKey: ((data as any)?.turnstile_site_key ?? null) as string | null,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load Turnstile script + render widget when a service is selected
  useEffect(() => {
    setTsToken("");
    if (!turnstileEnabled || !selected || !turnstileSiteKey) return;
    const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if (window.turnstile) return resolve();
        const existing = document.querySelector(`script[src="${SRC}"]`) as HTMLScriptElement | null;
        if (existing) { existing.addEventListener("load", () => resolve()); return; }
        const s = document.createElement("script");
        s.src = SRC; s.async = true; s.defer = true;
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    let cancelled = false;
    ensureScript().then(() => {
      if (cancelled || !tsRef.current || !window.turnstile) return;
      if (tsWidgetId.current) {
        try { window.turnstile.remove(tsWidgetId.current); } catch { /* ignore */ }
      }
      tsRef.current.innerHTML = "";
      tsWidgetId.current = window.turnstile.render(tsRef.current, {
        sitekey: turnstileSiteKey,
        theme: "auto",
        size: "invisible",
        execution: "execute",
        callback: (token) => setTsToken(token),
        "error-callback": () => setTsToken(""),
        "expired-callback": () => setTsToken(""),
      } as any);
    });
    return () => { cancelled = true; };
  }, [turnstileEnabled, selected, turnstileSiteKey]);

  const run = async () => {
    if (!selected) return;
    const v = imeiSchema.safeParse(imei.trim());
    if (!v.success) { toast.error("Enter a valid IMEI / serial (8–20 chars)"); return; }
    if (!turnstileConfig.loaded) { toast.error("Security check is still loading. Please wait."); return; }
    setRunning(true); setResult("");
    try {
      let token = tsToken;
      if (turnstileEnabled && !token) {
        if (!window.turnstile || !tsWidgetId.current) throw new Error("Security check not ready");
        try { window.turnstile.reset(tsWidgetId.current); } catch { /* ignore */ }
        (window as any).__lastTsToken = "";
        window.turnstile.execute(tsWidgetId.current);
        const start = Date.now();
        while (Date.now() - start < 20000) {
          await new Promise((r) => setTimeout(r, 200));
          const t = (window as any).__lastTsToken;
          if (t) { token = t; break; }
        }
        if (!token) throw new Error("Security check timed out, please try again");
      }
      const { data, error } = await supabase.functions.invoke("free-check", {
        body: { service_id: selected.id, imei: imei.trim(), turnstile_token: token || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult((data as any).result || "(empty)");
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setRunning(false);
      if (turnstileEnabled && window.turnstile && tsWidgetId.current) {
        try { window.turnstile.reset(tsWidgetId.current); } catch { /* ignore */ }
      }
      (window as any).__lastTsToken = "";
      setTsToken("");
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
          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {services.map((s) => (
              <Card
                key={s.id}
                className={`glass p-5 cursor-pointer transition border ${selected?.id === s.id ? "border-primary ring-1 ring-primary" : "border-border/50 hover:border-primary/40"}`}
                onClick={() => { setSelected(s); setResult(""); }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  {selected?.id === s.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                {s.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-3">{s.description}</p>}
                <div className="text-xs text-muted-foreground">⏱ {s.delivery_time}</div>
                <div className="mt-3 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">FREE</div>
              </Card>
            ))}
          </div>
        )}

        {selected && (
          <Card className="glass max-w-2xl mx-auto mt-8 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">Enter the IMEI or serial number to check.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="IMEI / Serial"
                maxLength={20}
                className="font-mono"
              />
              <Button variant="hero" onClick={run} disabled={running || !imei.trim() || !turnstileConfig.loaded || (turnstileEnabled && !tsToken)}>
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
            </div>
            {turnstileEnabled && (
              <div ref={tsRef} className="flex justify-center" />
            )}
          </Card>
        )}

        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setImei("");
            setResult("");
            setTsToken("");
            if (window.turnstile && tsWidgetId.current) {
              try { window.turnstile.reset(tsWidgetId.current); } catch { /* ignore */ }
            }
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="items-center text-center">
              {settings.logo_url && (
                <img
                  src={settings.logo_url}
                  alt={`${settings.brand_name} logo`}
                  className="mx-auto mb-2 h-12 md:h-14 w-auto object-contain"
                />
              )}
              <DialogTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                {selected?.name} — Result
              </DialogTitle>
              <DialogDescription>
                IMEI / Serial: <span className="font-mono">{imei}</span>
              </DialogDescription>
            </DialogHeader>
            {result && <ColoredResult text={result} font={selected?.result_font ?? undefined} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(result)}>Copy</Button>
              <Button variant="hero" onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
