import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, CreditCard, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Settings = {
  binance_enabled: boolean;
  binance_api_key: string | null;
  binance_secret_key: string | null;
  topup_amounts: number[];
  ask_admin_enabled: boolean;
};

export default function AdminPayments() {
  const [s, setS] = useState<Settings>({
    binance_enabled: false, binance_api_key: "", binance_secret_key: "",
    topup_amounts: [5, 10, 20, 30], ask_admin_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAmt, setNewAmt] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle();
      if (data) setS({
        binance_enabled: !!data.binance_enabled,
        binance_api_key: data.binance_api_key ?? "",
        binance_secret_key: data.binance_secret_key ?? "",
        topup_amounts: Array.isArray(data.topup_amounts) ? (data.topup_amounts as number[]) : [5, 10, 20, 30],
        ask_admin_enabled: !!data.ask_admin_enabled,
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("payment_settings").upsert({
      id: 1,
      binance_enabled: s.binance_enabled,
      binance_api_key: s.binance_api_key,
      binance_secret_key: s.binance_secret_key,
      topup_amounts: s.topup_amounts,
      ask_admin_enabled: s.ask_admin_enabled,
    });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const addAmount = () => {
    const n = Number(newAmt);
    if (!n || n <= 0) return;
    if (s.topup_amounts.includes(n)) return;
    setS({ ...s, topup_amounts: [...s.topup_amounts, n].sort((a, b) => a - b) });
    setNewAmt("");
  };

  if (loading) return <AdminLayout title="Payments"><Loader2 className="animate-spin" /></AdminLayout>;

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-webhook`;

  return (
    <AdminLayout title="Payments" subtitle="Configure payment gateways and top-up amounts">
      <div className="space-y-6 max-w-3xl">
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Binance Pay</h2>
            </div>
            <Switch checked={s.binance_enabled} onCheckedChange={(v) => setS({ ...s, binance_enabled: v })} />
          </div>
          <div className="space-y-2">
            <Label>API Key (Certificate SN)</Label>
            <Input value={s.binance_api_key ?? ""} onChange={(e) => setS({ ...s, binance_api_key: e.target.value })} placeholder="Binance Pay API Key" />
          </div>
          <div className="space-y-2">
            <Label>Secret Key</Label>
            <Input type="password" value={s.binance_secret_key ?? ""} onChange={(e) => setS({ ...s, binance_secret_key: e.target.value })} placeholder="Binance Pay Secret Key" />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Webhook URL (paste in Binance Pay merchant dashboard):</div>
            <code className="block p-2 bg-background/40 rounded break-all">{webhookUrl}</code>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Top-up Buttons</h2>
          <p className="text-sm text-muted-foreground">Amounts shown to clients on the wallet top-up page.</p>
          <div className="flex flex-wrap gap-2">
            {s.topup_amounts.map((a) => (
              <div key={a} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5">
                <span className="font-mono">${a}</span>
                <button onClick={() => setS({ ...s, topup_amounts: s.topup_amounts.filter((x) => x !== a) })} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input type="number" min="1" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} placeholder="Add amount" className="max-w-[160px]" />
            <Button variant="neon" onClick={addAmount}><Plus className="w-4 h-4" />Add</Button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div>
              <Label>"Need help?" button</Label>
              <p className="text-xs text-muted-foreground">Lets clients contact admin for custom amounts (Telegram/WhatsApp).</p>
            </div>
            <Switch checked={s.ask_admin_enabled} onCheckedChange={(v) => setS({ ...s, ask_admin_enabled: v })} />
          </div>
        </div>

        <Button variant="hero" size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </AdminLayout>
  );
}
