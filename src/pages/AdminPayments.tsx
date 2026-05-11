import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, CreditCard, Plus, X, QrCode, Upload, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

type Settings = {
  binance_enabled: boolean;
  binance_api_key: string | null;
  binance_secret_key: string | null;
  binance_pay_id: string | null;
  binance_qr_url: string | null;
  binance_coins: string[];
  binance_min_amount: number;
  binance_poll_enabled: boolean;
  binance_last_polled_at: string | null;
  topup_amounts: number[];
  ask_admin_enabled: boolean;
  order_expiry_minutes: number;
  // Cashfree
  cashfree_enabled: boolean;
  cashfree_env: "sandbox" | "production";
  cashfree_min_amount: number;
  cashfree_usd_to_inr: number;
  cashfree_sandbox_app_id: string | null;
  cashfree_sandbox_secret_key: string | null;
  cashfree_prod_app_id: string | null;
  cashfree_prod_secret_key: string | null;
};

const DEFAULT: Settings = {
  binance_enabled: false, binance_api_key: "", binance_secret_key: "",
  binance_pay_id: "", binance_qr_url: "", binance_coins: ["USDT"],
  binance_min_amount: 1, binance_poll_enabled: true, binance_last_polled_at: null,
  topup_amounts: [5, 10, 20, 30], ask_admin_enabled: true, order_expiry_minutes: 30,
  cashfree_enabled: false, cashfree_env: "sandbox", cashfree_min_amount: 1, cashfree_usd_to_inr: 85,
  cashfree_sandbox_app_id: "", cashfree_sandbox_secret_key: "",
  cashfree_prod_app_id: "", cashfree_prod_secret_key: "",
};

const PLACEHOLDERS = [
  { name: "PayPal", desc: "Cards, PayPal balance — coming soon." },
  { name: "Stripe", desc: "Global card processing — coming soon." },
  { name: "Crypto.com Pay", desc: "Alternative crypto checkout — coming soon." },
  { name: "Bank Transfer", desc: "Manual wire / SEPA — coming soon." },
];

export default function AdminPayments() {
  const [s, setS] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAmt, setNewAmt] = useState("");
  const [newCoin, setNewCoin] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payment_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setS({
          binance_enabled: !!data.binance_enabled,
          binance_api_key: data.binance_api_key ?? "",
          binance_secret_key: data.binance_secret_key ?? "",
          binance_pay_id: (data as any).binance_pay_id ?? "",
          binance_qr_url: (data as any).binance_qr_url ?? "",
          binance_coins: Array.isArray((data as any).binance_coins) ? (data as any).binance_coins : ["USDT"],
          binance_min_amount: Number((data as any).binance_min_amount ?? 1),
          binance_poll_enabled: (data as any).binance_poll_enabled !== false,
          binance_last_polled_at: (data as any).binance_last_polled_at ?? null,
          topup_amounts: Array.isArray(data.topup_amounts) ? (data.topup_amounts as number[]) : [5, 10, 20, 30],
          ask_admin_enabled: !!data.ask_admin_enabled,
          order_expiry_minutes: Number(data.order_expiry_minutes ?? 30),
          cashfree_enabled: !!(data as any).cashfree_enabled,
          cashfree_env: ((data as any).cashfree_env === "production" ? "production" : "sandbox"),
          cashfree_min_amount: Number((data as any).cashfree_min_amount ?? 1),
          cashfree_usd_to_inr: Number((data as any).cashfree_usd_to_inr ?? 85),
          cashfree_sandbox_app_id: (data as any).cashfree_sandbox_app_id ?? "",
          cashfree_sandbox_secret_key: (data as any).cashfree_sandbox_secret_key ?? "",
          cashfree_prod_app_id: (data as any).cashfree_prod_app_id ?? "",
          cashfree_prod_secret_key: (data as any).cashfree_prod_secret_key ?? "",
        });
      }
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
      binance_pay_id: s.binance_pay_id,
      binance_qr_url: s.binance_qr_url,
      binance_coins: s.binance_coins,
      binance_min_amount: s.binance_min_amount,
      binance_poll_enabled: s.binance_poll_enabled,
      topup_amounts: s.topup_amounts,
      ask_admin_enabled: s.ask_admin_enabled,
      order_expiry_minutes: s.order_expiry_minutes,
      cashfree_enabled: s.cashfree_enabled,
      cashfree_env: s.cashfree_env,
      cashfree_min_amount: s.cashfree_min_amount,
      cashfree_usd_to_inr: s.cashfree_usd_to_inr,
      cashfree_sandbox_app_id: s.cashfree_sandbox_app_id,
      cashfree_sandbox_secret_key: s.cashfree_sandbox_secret_key,
      cashfree_prod_app_id: s.cashfree_prod_app_id,
      cashfree_prod_secret_key: s.cashfree_prod_secret_key,
    } as any);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const addAmount = () => {
    const n = Number(newAmt);
    if (!n || n <= 0 || s.topup_amounts.includes(n)) return;
    setS({ ...s, topup_amounts: [...s.topup_amounts, n].sort((a, b) => a - b) });
    setNewAmt("");
  };
  const addCoin = () => {
    const c = newCoin.trim().toUpperCase();
    if (!c || s.binance_coins.includes(c)) return;
    setS({ ...s, binance_coins: [...s.binance_coins, c] });
    setNewCoin("");
  };

  const onUploadQr = async (file: File) => {
    setUploading(true);
    try {
      const path = `binance-qr-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setS((prev) => ({ ...prev, binance_qr_url: data.publicUrl }));
      toast.success("QR uploaded — remember to Save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const testPoll = async () => {
    setPolling(true);
    const { data, error } = await supabase.functions.invoke("binance-poll-deposits", { body: {} });
    setPolling(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Scanned ${(data as any)?.scanned ?? 0} deposits, matched ${(data as any)?.matched ?? 0}`);
    const { data: fresh } = await supabase.from("payment_settings").select("binance_last_polled_at").eq("id", 1).maybeSingle();
    setS((p) => ({ ...p, binance_last_polled_at: (fresh as any)?.binance_last_polled_at ?? p.binance_last_polled_at }));
  };

  if (loading) return <AdminLayout title="Payments"><Loader2 className="animate-spin" /></AdminLayout>;

  return (
    <AdminLayout title="Payments" subtitle="Configure your personal Binance account for automatic top-ups">
      <div className="space-y-6 max-w-3xl">
        {/* Binance Personal Account */}
        <div className="glass rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Binance — Personal Account</h2>
            </div>
            <Switch checked={s.binance_enabled} onCheckedChange={(v) => setS({ ...s, binance_enabled: v })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Binance Pay ID</Label>
              <Input
                value={s.binance_pay_id ?? ""}
                onChange={(e) => setS({ ...s, binance_pay_id: e.target.value })}
                placeholder="e.g. 123456789"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Shown to clients so they can send payment from their Binance app.</p>
            </div>
            <div className="space-y-2">
              <Label>Min Top-up Amount</Label>
              <Input type="number" min="0.5" step="0.5" value={s.binance_min_amount}
                onChange={(e) => setS({ ...s, binance_min_amount: Number(e.target.value) || 1 })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>QR Code Image</Label>
            <div className="flex items-center gap-3">
              {s.binance_qr_url ? (
                <img src={s.binance_qr_url} alt="Binance Pay QR" className="w-24 h-24 rounded-md border border-border/50 object-contain bg-white p-1" />
              ) : (
                <div className="w-24 h-24 rounded-md border border-dashed border-border/50 flex items-center justify-center text-muted-foreground">
                  <QrCode className="w-8 h-8" />
                </div>
              )}
              <label className="inline-flex">
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUploadQr(e.target.files[0])}
                />
                <Button type="button" variant="neon" disabled={uploading} asChild>
                  <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload QR</span>
                </Button>
              </label>
              {s.binance_qr_url && (
                <Button type="button" variant="ghost" onClick={() => setS({ ...s, binance_qr_url: "" })}>Remove</Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accepted Coins</Label>
            <div className="flex flex-wrap gap-2">
              {s.binance_coins.map((c) => (
                <div key={c} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-xs">{c}</span>
                  <button onClick={() => setS({ ...s, binance_coins: s.binance_coins.filter((x) => x !== c) })} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newCoin} onChange={(e) => setNewCoin(e.target.value)} placeholder="e.g. USDT, BNB, BTC" className="max-w-[180px] uppercase font-mono" />
              <Button variant="neon" onClick={addCoin}><Plus className="w-4 h-4" />Add</Button>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-sm">Read-only API Key (auto-detect deposits)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a Binance API key with <b>Enable Reading only</b> — never enable Trade or Withdraw.
              Used to poll deposit history and auto-credit clients when they pay.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input value={s.binance_api_key ?? ""} onChange={(e) => setS({ ...s, binance_api_key: e.target.value })} placeholder="HMAC API Key" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Secret Key (HMAC)</Label>
                <Input type="password" value={s.binance_secret_key ?? ""} onChange={(e) => setS({ ...s, binance_secret_key: e.target.value })} placeholder="HMAC Secret" className="font-mono" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-poll deposits every minute</Label>
                <p className="text-xs text-muted-foreground">
                  Last polled: {s.binance_last_polled_at ? new Date(s.binance_last_polled_at).toLocaleString() : "never"}
                </p>
              </div>
              <Switch checked={s.binance_poll_enabled} onCheckedChange={(v) => setS({ ...s, binance_poll_enabled: v })} />
            </div>
            <Button variant="outline" onClick={testPoll} disabled={polling}>
              {polling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run poll now
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 border-t border-border/40 pt-4">
            <div className="space-y-2">
              <Label>Order expiry (minutes)</Label>
              <Input type="number" min="5" value={s.order_expiry_minutes}
                onChange={(e) => setS({ ...s, order_expiry_minutes: Number(e.target.value) || 30 })} />
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Top-up Buttons</h2>
          <p className="text-sm text-muted-foreground">Quick-pick amounts shown to clients on the wallet top-up page.</p>
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

        {/* Coming-soon placeholders */}
        <div className="glass rounded-xl p-5 space-y-4 opacity-90">
          <h2 className="text-lg font-bold">Other Payment Gateways</h2>
          <p className="text-sm text-muted-foreground">More providers will be added later. Currently only Binance is active.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PLACEHOLDERS.map((p) => (
              <div key={p.name} className="border border-border/40 rounded-lg p-4 bg-secondary/20 relative">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Coming soon</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
                <Switch checked={false} disabled className="mt-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
