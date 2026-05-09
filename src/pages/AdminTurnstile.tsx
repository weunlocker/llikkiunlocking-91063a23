import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function AdminTurnstile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  useEffect(() => {
    (async () => {
      const [ss, ps] = await Promise.all([
        supabase.from("site_settings").select("turnstile_site_key, turnstile_enabled").eq("id", 1).maybeSingle(),
        supabase.from("private_settings").select("turnstile_secret_key").eq("id", 1).maybeSingle(),
      ]);
      setSiteKey((ss.data as any)?.turnstile_site_key ?? "");
      setEnabled(Boolean((ss.data as any)?.turnstile_enabled));
      setSecretKey((ps.data as any)?.turnstile_secret_key ?? "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from("site_settings").update({
        turnstile_site_key: siteKey.trim() || null,
        turnstile_enabled: enabled,
      }).eq("id", 1),
      supabase.from("private_settings").upsert({
        id: 1,
        turnstile_secret_key: secretKey.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    ]);
    setSaving(false);
    if (r1.error || r2.error) toast.error(r1.error?.message || r2.error?.message || "Save failed");
    else toast.success("Turnstile settings saved");
  };

  if (loading) {
    return (
      <AdminLayout title="Turnstile" subtitle="Cloudflare CAPTCHA for Free Check">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Turnstile"
      subtitle="Cloudflare CAPTCHA — protects the public Free Check endpoint from abuse"
      actions={<Button variant="hero" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}</Button>}
    >
      <div className="max-w-3xl space-y-4">
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold">Cloudflare Turnstile</h3>
              <p className="text-xs text-muted-foreground">Each Free Check request will require a fresh, one-time token.</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
            <div>
              <div className="font-medium">Enable Turnstile on Free Check</div>
              <div className="text-xs text-muted-foreground">When off, the Free Check page will work without CAPTCHA.</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label>Site Key (public)</Label>
            <Input value={siteKey} onChange={(e) => setSiteKey(e.target.value)} placeholder="0x4AAAAAAA..." className="font-mono" />
            <p className="text-xs text-muted-foreground mt-1">Used by the browser to render the widget.</p>
          </div>

          <div>
            <Label>Secret Key (private)</Label>
            <Input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="0x4AAAAAAA..."
              className="font-mono"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Stored in a private, admin-only table. Used server-side to verify each token.
            </p>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground space-y-2">
          <div className="font-bold text-foreground">How to get keys</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open Cloudflare Dashboard → Turnstile → Add site.</li>
            <li>Add domains: <span className="font-mono">likkiunlocking.com</span>, <span className="font-mono">www.likkiunlocking.com</span>, <span className="font-mono">lovable.app</span>, <span className="font-mono">lovableproject.com</span>.</li>
            <li>Choose <span className="font-medium">Managed</span> widget type.</li>
            <li>Copy the <span className="font-medium">Site key</span> and <span className="font-medium">Secret key</span> here.</li>
          </ol>
          <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Open Cloudflare Turnstile <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
