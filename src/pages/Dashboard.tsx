import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, History, Plus, Loader2, Smartphone, Clock, CheckCircle2, XCircle, Search, Send, Settings } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { telegramChatIdSchema } from "@/lib/validation";
import ImeiCheckDialog from "@/components/ImeiCheckDialog";

type Order = { id: string; order_number: number; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; services: { name: string } | null };
type Tx = { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string };
type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null; sample_result: string | null; result_font: string | null; result_color: string | null };

export default function Dashboard() {
  const { profile, refreshProfile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ["services", "orders", "wallet", "settings"];
  const tabParam = searchParams.get("tab") ?? "services";
  const activeTab = validTabs.includes(tabParam) ? tabParam : "services";
  const [orders, setOrders] = useState<Order[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupSuccess, setTopupSuccess] = useState<{ amount: number; newBalance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");

  useEffect(() => {
    if (profile) {
      setTgChatId(profile.telegram_chat_id ?? "");
      setTgEnabled(profile.notify_telegram ?? false);
      setEmailEnabled(profile.notify_email ?? true);
    }
  }, [profile]);

  const savePrefs = async () => {
    if (!user) return;
    const parsed = telegramChatIdSchema.safeParse(tgChatId);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSavingPrefs(true);
    const { error } = await supabase.from("profiles").update({
      telegram_chat_id: tgChatId.trim() || null,
      notify_telegram: tgEnabled,
      notify_email: emailEnabled,
    }).eq("id", user.id);
    setSavingPrefs(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Preferences saved");
    refreshProfile();
  };

  const sendTestTg = async () => {
    if (!user) return;
    setTestingTg(true);
    const { data, error } = await supabase.functions.invoke("telegram-notify", {
      body: { user_id: user.id, subject: "🔔 Test notification", body: "If you can read this, your Telegram notifications are working perfectly." },
    });
    setTestingTg(false);
    if (error) { toast.error(error.message); return; }
    const tgResult = (data as { results?: { telegram?: string } })?.results?.telegram;
    if (tgResult === "sent") toast.success("Test sent — check your Telegram");
    else toast.error(`Test failed: ${tgResult ?? "unknown"}`);
  };

  const load = async () => {
    if (!user) return;
    const [{ data: o }, { data: t }, { data: svc }] = await Promise.all([
      supabase.from("orders").select("id,order_number,imei,status,price_charged,result,error_message,created_at,services(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("transactions").select("id,type,amount,balance_after,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("services").select("id,name,description,price,delivery_time,category,sample_result,result_font,result_color").eq("active", true).order("category").order("price"),
    ]);
    setOrders((o ?? []) as unknown as Order[]);
    setTxs((t ?? []) as Tx[]);
    setServices((svc ?? []) as Service[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openCheck = (s: Service) => { setSelectedService(s); };

  const refreshAfterRun = () => { refreshProfile(); load(); };

  const requestTopup = async () => {
    const amt = Number(topupAmount);
    if (!amt || amt < 1 || amt > 10000) { toast.error("Amount must be 1-10000"); return; }
    const { error } = await supabase.functions.invoke("wallet-topup", { body: { amount: amt } });
    if (error) { toast.error(error.message); return; }
    setTopupOpen(false);
    await refreshProfile();
    const newBalance = Number(profile?.balance ?? 0) + amt;
    setTopupSuccess({ amount: amt, newBalance });
    load();
  };

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

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams(v === "services" ? {} : { tab: v }, { replace: true })}>
          <TabsList className="glass flex-wrap h-auto">
            <TabsTrigger value="services"><Smartphone className="w-4 h-4 mr-2" />Services</TabsTrigger>
            <TabsTrigger value="orders"><History className="w-4 h-4 mr-2" />Orders</TabsTrigger>
            <TabsTrigger value="wallet"><Wallet className="w-4 h-4 mr-2" />Wallet History</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="mt-5">
            <div className="glass rounded-2xl p-4 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : services.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No services available yet.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services
                  .filter((s) => {
                    const q = serviceQuery.toLowerCase().trim();
                    if (!q) return true;
                    return s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q);
                  })
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openCheck(s)}
                      className="text-left glass rounded-xl p-4 sm:p-5 hover:border-primary/40 hover:shadow-elegant transition-all flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Smartphone className="w-5 h-5 text-primary" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> {s.delivery_time}</div>
                      </div>
                      <h3 className="font-bold mb-1 hover:text-primary transition-colors">{s.name}</h3>
                      {s.category && <div className="text-xs text-muted-foreground capitalize mb-2">{s.category}</div>}
                      <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">{s.description}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                        <Button variant="neon" size="sm" onClick={(e) => { e.stopPropagation(); openCheck(s); }}>Check IMEI</Button>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-5">
            <div className="glass rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by Order ID, IMEI/SN, service…"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> :
                (() => {
                  const q = orderQuery.toLowerCase().trim();
                  const filteredOrders = orders.filter((o) => {
                    if (orderStatus !== "all" && o.status !== orderStatus) return false;
                    if (!q) return true;
                    const oid = String(o.order_number ?? "").padStart(4, "0");
                    return oid.includes(q) ||
                      o.imei.toLowerCase().includes(q) ||
                      (o.services?.name ?? "").toLowerCase().includes(q) ||
                      o.status.toLowerCase().includes(q);
                  });
                  if (filteredOrders.length === 0) return <div className="p-12 text-center text-muted-foreground">No orders found.</div>;
                  return (
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left">
                    <tr><th className="px-5 py-3">Order ID</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Price</th><th className="px-5 py-3">Date</th></tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setOrderDetail(o)}>
                        <td className="px-5 py-3 font-mono text-xs">#{String(o.order_number ?? 0).padStart(4, "0")}</td>
                        <td className="px-5 py-3 font-medium">{o.services?.name ?? "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs">{o.imei}</td>
                        <td className={`px-5 py-3 capitalize font-medium ${statusColor(o.status)}`}>{o.status}</td>
                        <td className="px-5 py-3 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  );
                })()
              }
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

          <TabsContent value="settings" className="mt-5">
            <div className="glass rounded-2xl p-6 space-y-6 max-w-2xl">
              <div>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Telegram Notifications</h3>
                <p className="text-sm text-muted-foreground">Get instant order results and balance alerts on Telegram.</p>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4 text-sm space-y-2">
                <p className="font-semibold">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open Telegram and start a chat with our notifications bot.</li>
                  <li>Send any message (e.g. <span className="font-mono">/start</span>).</li>
                  <li>Send <span className="font-mono">/getid</span> to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary underline">@userinfobot</a> to get your numeric chat ID.</li>
                  <li>Paste your chat ID below, enable notifications, and click Save.</li>
                  <li>Then click <strong>Send test</strong> to verify.</li>
                </ol>
              </div>

              <div>
                <Label>Telegram Chat ID</Label>
                <Input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="e.g. 123456789" className="font-mono" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label className="text-base">Telegram alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive order results and wallet updates.</p>
                </div>
                <Switch checked={tgEnabled} onCheckedChange={setTgEnabled} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 opacity-60">
                <div>
                  <Label className="text-base">Email alerts</Label>
                  <p className="text-xs text-muted-foreground">Coming soon — set up an email domain in Cloud → Emails to enable.</p>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} disabled />
              </div>

              <div className="flex gap-2">
                <Button variant="hero" onClick={savePrefs} disabled={savingPrefs}>
                  {savingPrefs && <Loader2 className="w-4 h-4 animate-spin" />}Save
                </Button>
                <Button variant="glass" onClick={sendTestTg} disabled={testingTg || !tgEnabled || !tgChatId}>
                  {testingTg && <Loader2 className="w-4 h-4 animate-spin" />}Send test
                </Button>
              </div>
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

      <Dialog open={!!topupSuccess} onOpenChange={(o) => !o && setTopupSuccess(null)}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-6 h-6" /> Top-up successful
            </DialogTitle>
            <DialogDescription>Your wallet has been credited.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Added</div>
              <div className="text-3xl font-bold text-success">+${topupSuccess?.amount.toFixed(2)}</div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">New balance</span>
              <span className="font-mono font-bold">${topupSuccess?.newBalance.toFixed(2)}</span>
            </div>
            <Button variant="hero" className="w-full" onClick={() => setTopupSuccess(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderDetail} onOpenChange={(o) => !o && setOrderDetail(null)}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader><DialogTitle>{orderDetail?.services?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm"><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">#{String(orderDetail?.order_number ?? 0).padStart(4, "0")}</span></div>
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

      <ImeiCheckDialog
        service={selectedService}
        balance={Number(profile?.balance ?? 0)}
        onClose={() => setSelectedService(null)}
        onAfterRun={refreshAfterRun}
      />
    </Layout>
  );
}
