import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Key, History, Plus, Copy, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Order = { id: string; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; services: { name: string } | null };
type Tx = { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string };
type ApiKey = { id: string; name: string; key: string; active: boolean; last_used_at: string | null; created_at: string };

export default function Dashboard() {
  const { profile, refreshProfile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("10");
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: o }, { data: t }, { data: k }] = await Promise.all([
      supabase.from("orders").select("id,imei,status,price_charged,result,error_message,created_at,services(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("transactions").select("id,type,amount,balance_after,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("api_keys").select("id,name,key,active,last_used_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setOrders((o ?? []) as unknown as Order[]);
    setTxs((t ?? []) as Tx[]);
    setKeys((k ?? []) as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const requestTopup = async () => {
    const amt = Number(topupAmount);
    if (!amt || amt < 1 || amt > 10000) { toast.error("Amount must be 1-10000"); return; }
    const { error } = await supabase.functions.invoke("wallet-topup", { body: { amount: amt } });
    if (error) { toast.error(error.message); return; }
    toast.success(`$${amt.toFixed(2)} added to your wallet (demo top-up)`);
    setTopupOpen(false);
    refreshProfile();
    load();
  };

  const generateKey = async () => {
    if (!user) return;
    const newKey = `imei_${crypto.randomUUID().replace(/-/g, "")}`;
    const name = newKeyName.trim() || "Default";
    const { error } = await supabase.from("api_keys").insert({ user_id: user.id, name, key: newKey });
    if (error) { toast.error(error.message); return; }
    toast.success("API key generated");
    setNewKeyName("");
    load();
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Key deleted"); load();
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground" } as Record<string, string>)[s] ?? "";

  return (
    <Layout>
      <div className="container py-10">
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          <div className="glass rounded-2xl p-6 md:col-span-2 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Wallet Balance</div>
              <div className="text-4xl font-bold font-mono glow-text">${Number(profile?.balance ?? 0).toFixed(2)}</div>
            </div>
            <Button variant="hero" size="lg" onClick={() => setTopupOpen(true)}><Plus className="w-4 h-4" />Top Up</Button>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Checks</div>
            <div className="text-4xl font-bold font-mono">{orders.length}</div>
          </div>
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="glass">
            <TabsTrigger value="orders"><History className="w-4 h-4 mr-2" />Orders</TabsTrigger>
            <TabsTrigger value="wallet"><Wallet className="w-4 h-4 mr-2" />Wallet History</TabsTrigger>
            <TabsTrigger value="api"><Key className="w-4 h-4 mr-2" />API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-5">
            <div className="glass rounded-2xl overflow-hidden">
              {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> :
                orders.length === 0 ? <div className="p-12 text-center text-muted-foreground">No orders yet. Visit Services to start.</div> :
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left">
                    <tr><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Price</th><th className="px-5 py-3">Date</th></tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setOrderDetail(o)}>
                        <td className="px-5 py-3 font-medium">{o.services?.name ?? "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs">{o.imei}</td>
                        <td className={`px-5 py-3 capitalize font-medium ${statusColor(o.status)}`}>{o.status}</td>
                        <td className="px-5 py-3 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </div>
          </TabsContent>

          <TabsContent value="wallet" className="mt-5">
            <div className="glass rounded-2xl overflow-hidden">
              {txs.length === 0 ? <div className="p-12 text-center text-muted-foreground">No transactions yet.</div> :
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left">
                    <tr><th className="px-5 py-3">Type</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Date</th></tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => (
                      <tr key={t.id} className="border-t border-border/50">
                        <td className="px-5 py-3 capitalize">{t.type.replace("_", " ")}</td>
                        <td className="px-5 py-3 text-muted-foreground">{t.description ?? "—"}</td>
                        <td className={`px-5 py-3 text-right font-mono ${Number(t.amount) > 0 ? "text-success" : "text-destructive"}`}>{Number(t.amount) > 0 ? "+" : ""}${Number(t.amount).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right font-mono">${Number(t.balance_after).toFixed(2)}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-5 space-y-5">
            <div className="glass rounded-2xl p-6">
              <h3 className="font-bold mb-4">Generate New API Key</h3>
              <div className="flex gap-2">
                <Input placeholder="Key name (e.g. Production)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} maxLength={50} />
                <Button variant="hero" onClick={generateKey}><Plus className="w-4 h-4" />Generate</Button>
              </div>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              {keys.length === 0 ? <div className="p-12 text-center text-muted-foreground">No API keys yet.</div> :
                <div className="divide-y divide-border/50">
                  {keys.map((k) => (
                    <div key={k.id} className="p-5 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold mb-1">{k.name}</div>
                        <div className="font-mono text-xs text-muted-foreground truncate">{k.key}</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => copy(k.key)}><Copy className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteKey(k.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Top Up Wallet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Demo mode: top-up is instant. Connect Stripe later for real payments.</p>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" min="1" max="10000" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 50].map((a) => (
                <Button key={a} variant="glass" onClick={() => setTopupAmount(String(a))}>${a}</Button>
              ))}
            </div>
            <Button variant="hero" className="w-full" onClick={requestTopup}>Add ${Number(topupAmount || 0).toFixed(2)}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderDetail} onOpenChange={(o) => !o && setOrderDetail(null)}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader><DialogTitle>{orderDetail?.services?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm"><span className="text-muted-foreground">IMEI:</span> <span className="font-mono">{orderDetail?.imei}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Status:</span> <span className={`capitalize ${statusColor(orderDetail?.status ?? "")}`}>{orderDetail?.status}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Charged:</span> <span className="font-mono">${Number(orderDetail?.price_charged ?? 0).toFixed(2)}</span></div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Result</div>
              <pre className="glass rounded p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto">{orderDetail?.result || orderDetail?.error_message || "No data"}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
