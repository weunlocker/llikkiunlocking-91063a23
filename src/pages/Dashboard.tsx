import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, History, Plus, Loader2, Smartphone, Clock, CheckCircle2, XCircle, Search, Send, Settings, Code2, LayoutGrid, List, Gift, Download, FileText, MessageSquare } from "lucide-react";
import { buildOrderInvoice, downloadOrderInvoice, exportOrdersCsv } from "@/lib/invoice";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { telegramChatIdSchema } from "@/lib/validation";
import ImeiCheckDialog, { type CustomField } from "@/components/ImeiCheckDialog";
import { extractResponse, stripColorMarkers, hideSupplierRef } from "@/lib/extractResponse";
import { ColoredResult } from "@/components/ColoredResult";
import ApiDocs from "@/pages/ApiDocs";
import ReferralsPanel from "@/components/ReferralsPanel";
import SupportPanel from "@/components/SupportPanel";
import WhatsNewBanner from "@/components/WhatsNewBanner";
import Seo from "@/components/Seo";
import InstallAppButton from "@/components/InstallAppButton";

function sanitizeError(msg: string | null | undefined): string {
  if (!msg) return "";
  let s = String(msg);
  // Strip URLs
  s = s.replace(/https?:\/\/\S+/gi, "");
  // Strip "for url (...)" leftovers
  s = s.replace(/for\s+url\s*\(?\s*\)?/gi, "");
  // Common upstream technical patterns -> friendly text
  if (/error sending request|connect error|connection timed out|os error|tcp connect|client error/i.test(msg)) {
    return "Provider temporarily unavailable. Please try again later.";
  }
  return s.replace(/\s{2,}/g, " ").trim() || "Request failed. Please try again.";
}

function formatDuration(start: string, end: string, status: string): string {
  const s = new Date(start).getTime();
  const e = (status === "pending" || status === "processing") ? Date.now() : new Date(end).getTime();
  const ms = Math.max(0, e - s);
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

type Order = { id: string; order_number: number; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; updated_at: string; services: { name: string; category: string | null; delivery_time: string | null; result_font: string | null; result_color: string | null; service_type: string | null } | null };
type Tx = { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string };
type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; category: string | null; sample_result: string | null; result_font: string | null; result_color: string | null; is_free?: boolean | null; service_type?: "imei" | "server" | null; custom_fields?: CustomField[] | null };

export default function Dashboard() {
  const { profile, refreshProfile, user } = useAuth();
  const { settings } = useSiteSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ["services", "services_imei", "services_server", "orders", "orders_imei", "orders_server", "wallet", "referrals", "support", "settings", "api"];
  const tabParam = searchParams.get("tab") ?? (settings.service_types_enabled ? "services_imei" : "services");
  const rawTab = validTabs.includes(tabParam) ? tabParam : (settings.service_types_enabled ? "services_imei" : "services");
  const orderTypeFilter: "imei" | "server" | null = rawTab === "orders_imei" ? "imei" : rawTab === "orders_server" ? "server" : null;
  const serviceTypeFilter: "imei" | "server" | null = rawTab === "services_imei" ? "imei" : rawTab === "services_server" ? "server" : null;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [categoryOrder, setCategoryOrder] = useState<Record<string, number>>({});
  const groupLabel = (slug: string) => categoryNames[slug] ?? slug;
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupSuccess, setTopupSuccess] = useState<{ amount: number; newBalance: number } | null>(null);
  const [pay, setPay] = useState<{ order_id: string; pay_id: string; qr_url: string | null; coin: string; amount: number; memo: string; expires_at: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [svcGroup, setSvcGroup] = useState("all");
  const [svcName, setSvcName] = useState("all");
  const [tgChatId, setTgChatId] = useState("");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [oqOrderId, setOqOrderId] = useState("");
  const [oqImei, setOqImei] = useState("");
  const [oqService, setOqService] = useState("all");
  const [oqGroup, setOqGroup] = useState("all");
  const [oqFrom, setOqFrom] = useState("");
  const [oqTo, setOqTo] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [oPage, setOPage] = useState(1);
  const [oPageSize, setOPageSize] = useState(20);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgDismissed, setMsgDismissed] = useState(false);
  const rawCustomMessage = (profile as unknown as { custom_message?: string } | null)?.custom_message ?? "";
  const customMessage = rawCustomMessage
    .replace(/\{\{\s*name\s*\}\}/gi, profile?.display_name ?? "")
    .replace(/\{\{\s*email\s*\}\}/gi, profile?.email ?? "")
    .replace(/\{\{\s*balance\s*\}\}/gi, `$${Number(profile?.balance ?? 0).toFixed(2)}`)
    .replace(/\{\{\s*group\s*\}\}/gi, (profile as unknown as { user_group?: string } | null)?.user_group ?? "standard");
  const [serviceView, setServiceView] = useState<"grid" | "list">(() => (localStorage.getItem("serviceView") as "grid" | "list") || "grid");
  useEffect(() => { localStorage.setItem("serviceView", serviceView); }, [serviceView]);
  const [paySettings, setPaySettings] = useState<{ binance_enabled: boolean; topup_amounts: number[]; ask_admin_enabled: boolean } | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("unread_for_user", true);
      setSupportUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`user-support-badge-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  useEffect(() => {
    supabase.rpc("get_public_payment_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setPaySettings({
        binance_enabled: !!row.binance_enabled,
        topup_amounts: (row.topup_amounts as number[]) ?? [5,10,20,30],
        ask_admin_enabled: !!row.ask_admin_enabled,
      });
    });
  }, []);

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
    const [{ data: o }, { data: t }, { data: svc }, { data: ovs }, { data: cats }] = await Promise.all([
      supabase.from("orders").select("id,order_number,imei,status,price_charged,result,error_message,created_at,updated_at,services(name,category,delivery_time,result_font,result_color,service_type)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
      supabase.from("transactions").select("id,type,amount,balance_after,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("services_public").select("id,name,description,price,delivery_time,category,sample_result,result_font,result_color,is_free,service_type,custom_fields").order("category").order("sort_order").order("price"),
      supabase.from("user_service_overrides").select("service_id,enabled,custom_price").eq("user_id", user.id),
      supabase.from("categories").select("slug,name,sort_order"),
    ]);
    setCategoryNames(Object.fromEntries((cats ?? []).map((c: { slug: string; name: string }) => [c.slug, c.name])));
    setCategoryOrder(Object.fromEntries((cats ?? []).map((c: { slug: string; sort_order: number }) => [c.slug, c.sort_order ?? 0])));
    const groupDiscount: Record<string, number> = { silver: 0.10, gold: 0.30, diamond: 0.50 };
    const discount = groupDiscount[String((profile as unknown as { user_group?: string })?.user_group ?? "").toLowerCase()] ?? 0;
    const ovMap = new Map((ovs ?? []).map((o: { service_id: string; enabled: boolean; custom_price: number | null }) => [o.service_id, o]));
    const visibleSvcs = (svc ?? []).filter((s: { id: string }) => {
      const ov = ovMap.get(s.id);
      return !(ov && ov.enabled === false);
    }).map((s: { id: string; price: number } & Record<string, unknown>) => {
      const ov = ovMap.get(s.id);
      const price = ov?.custom_price != null ? Number(ov.custom_price) : +(Number(s.price) * (1 - discount)).toFixed(2);
      return { ...s, price } as Service;
    });
    setOrders((o ?? []) as unknown as Order[]);
    setTxs((t ?? []) as Tx[]);
    setServices(visibleSvcs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Realtime: refresh orders when status/result updates so both change together
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`user-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openCheck = (s: Service) => { setSelectedService(s); };

  const refreshAfterRun = () => { refreshProfile(); load(); };

  const requestTopup = async (overrideAmt?: number) => {
    const amt = overrideAmt ?? Number(topupAmount);
    if (!amt || amt < 1 || amt > 10000) { toast.error("Invalid amount"); return; }
    if (!paySettings?.binance_enabled) { toast.error("Payments not available — please contact admin"); return; }
    const { data, error } = await supabase.functions.invoke("binance-create-order", { body: { amount: amt } });
    if (error || !(data as any)?.ok) { toast.error(error?.message || (data as any)?.error || "Failed to create payment"); return; }
    setPay(data as any);
    setTopupOpen(false);
  };

  // Poll the pending payment_orders row every 5s while the dialog is open
  useEffect(() => {
    if (!pay) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const { data } = await supabase.from("payment_orders").select("status,amount").eq("id", pay.order_id).maybeSingle();
      if (data?.status === "paid") {
        clearInterval(poll);
        const credited = Number(data.amount ?? pay.amount);
        await refreshProfile();
        const { data: prof } = await supabase.from("profiles").select("balance").eq("id", user!.id).maybeSingle();
        setPay(null);
        setTopupSuccess({ amount: credited, newBalance: Number(prof?.balance ?? 0) });
        load();
      } else if (new Date(pay.expires_at).getTime() < Date.now()) {
        clearInterval(poll);
        setPay(null);
        toast.error("Payment window expired. Please start a new top-up.");
      }
    }, 5000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [pay, user]);

  const askAdmin = () => {
    const wa = settings.whatsapp_number?.replace(/\D/g, "");
    const tg = settings.telegram_url;
    const msg = encodeURIComponent(`Hi, I need help with a wallet top-up on ${settings.brand_name}.`);
    if (wa) window.open(`https://wa.me/${wa}?text=${msg}`, "_blank", "noopener,noreferrer");
    else if (tg) window.open(tg, "_blank", "noopener,noreferrer");
    else toast.error("Admin contact not configured");
  };

  const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground" } as Record<string, string>)[s] ?? "";
  const StatusBadge = ({ status, errorMessage }: { status: string; errorMessage?: string | null }) => {
    let s = (status || "").toLowerCase();
    // If supplier rejected but admin policy keeps it pending/in_process, show REJECTED visually.
    if (errorMessage && (s === "pending" || s === "in_process" || s === "processing")) s = "rejected";
    const map: Record<string, string> = {
      completed: "bg-success/15 text-success border-success/40",
      success:   "bg-success/15 text-success border-success/40",
      failed:    "bg-destructive/15 text-destructive border-destructive/40",
      rejected:  "bg-destructive/15 text-destructive border-destructive/40",
      refunded:  "bg-warning/15 text-warning border-warning/40",
      pending:   "bg-warning/15 text-warning border-warning/40",
      in_process:"bg-primary/15 text-primary border-primary/40",
      inprocess: "bg-primary/15 text-primary border-primary/40",
      processing:"bg-primary/15 text-primary border-primary/40",
    };
    const cls = map[s] ?? "bg-secondary text-foreground border-border";
    const label = s.replace(/_/g, " ").toUpperCase() || "—";
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-extrabold tracking-wider uppercase ${cls}`}>
        {label}
      </span>
    );
  };

  return (
    <Layout>
      <Seo
        title="Customer Dashboard — LIKKI UNLOCKING"
        description="Manage your IMEI check orders, wallet balance, API access and support — all from your LIKKI UNLOCKING dashboard."
        path="/dashboard"
        noindex
      />
      <div className="container py-10">
        <h1 className="sr-only">Customer Dashboard</h1>
        <WhatsNewBanner />
        {customMessage && !msgDismissed && localStorage.getItem("seenAdminMsg") !== customMessage && (
          <button
            type="button"
            onClick={() => { setMsgOpen(true); localStorage.setItem("seenAdminMsg", customMessage); setMsgDismissed(true); }}
            className="w-full glass rounded-2xl p-4 mb-5 border-l-4 border-primary text-left hover:bg-secondary/30 transition-colors"
          >
            <div className="text-xs uppercase tracking-wider text-primary">Message from admin</div>
            <div className="text-xs text-muted-foreground mt-1">Click to read</div>
          </button>
        )}
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>Message from admin</DialogTitle></DialogHeader>
            <div className="text-sm whitespace-pre-wrap py-2">{customMessage}</div>
            <div className="flex justify-end">
              <Button variant="hero" onClick={() => { localStorage.setItem("seenAdminMsg", customMessage); setMsgOpen(false); setMsgDismissed(true); }}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="grid md:grid-cols-3 gap-5 mb-5">
          <div className="glass rounded-2xl p-6 md:col-span-2 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Wallet Balance</div>
              <div className="text-4xl font-bold font-mono glow-text">${Number(profile?.balance ?? 0).toFixed(2)}</div>
            </div>
            <Button variant="hero" size="lg" onClick={() => setTopupOpen(true)}><Plus className="w-4 h-4" />Top Up</Button>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Orders</div>
            <div className="text-4xl font-bold font-mono">{orders.length}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold font-mono text-success">{orders.filter(o => o.status === "completed").length}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold font-mono text-warning">{orders.filter(o => o.status === "pending").length}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold font-mono text-destructive">{orders.filter(o => o.status === "failed").length}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground">Refunded</div>
            <div className="text-2xl font-bold font-mono">{orders.filter(o => o.status === "refunded").length}</div>
          </div>
        </div>

        <Tabs value={rawTab} onValueChange={(v) => setSearchParams(v === "services" ? {} : { tab: v }, { replace: true })}>
          <TabsList className="glass flex-wrap h-auto">
            {settings.service_types_enabled ? (
              <>
                <TabsTrigger value="services_imei"><Smartphone className="w-4 h-4 mr-2" />IMEI Services</TabsTrigger>
                <TabsTrigger value="services_server"><Smartphone className="w-4 h-4 mr-2" />Server Services</TabsTrigger>
                <TabsTrigger value="orders_imei"><History className="w-4 h-4 mr-2" />IMEI Orders</TabsTrigger>
                <TabsTrigger value="orders_server"><History className="w-4 h-4 mr-2" />Server Orders</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="services"><Smartphone className="w-4 h-4 mr-2" />Services</TabsTrigger>
                <TabsTrigger value="orders"><History className="w-4 h-4 mr-2" />Orders</TabsTrigger>
              </>
            )}
            <TabsTrigger value="wallet"><Wallet className="w-4 h-4 mr-2" />Wallet History</TabsTrigger>
            <TabsTrigger value="referrals"><Gift className="w-4 h-4 mr-2" />Referrals</TabsTrigger>
            <TabsTrigger value="support" className="relative"><MessageSquare className="w-4 h-4 mr-2" />Support{supportUnread > 0 && (<span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">{supportUnread > 99 ? "99+" : supportUnread}</span>)}</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
            <TabsTrigger value="api"><Code2 className="w-4 h-4 mr-2" />API</TabsTrigger>
          </TabsList>


          <TabsContent value={rawTab === "services_imei" || rawTab === "services_server" ? rawTab : "services"} className="mt-5">
            <div className="glass rounded-2xl p-4 mb-4 flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search services"
                  placeholder="Search services..."
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-3">
                <Select value={svcGroup} onValueChange={(v) => { setSvcGroup(v); setSvcName("all"); }}>
                  <SelectTrigger className="lg:w-48"><SelectValue placeholder="All groups" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {Array.from(new Set(services.map((s) => (s.category ?? "general").trim() || "general"))).sort((a, b) => {
                      if (a === "free") return -1;
                      if (b === "free") return 1;
                      const ao = categoryOrder[a] ?? 9999;
                      const bo = categoryOrder[b] ?? 9999;
                      if (ao !== bo) return ao - bo;
                      return (categoryNames[a] ?? a).localeCompare(categoryNames[b] ?? b);
                    }).map((g) => (
                      <SelectItem key={g} value={g}>{groupLabel(g)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={svcName} onValueChange={setSvcName}>
                  <SelectTrigger className="lg:w-56"><SelectValue placeholder="All services" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All services</SelectItem>
                    {Array.from(new Set(services.filter((s) => svcGroup === "all" || ((s.category ?? "general").trim() || "general") === svcGroup).map((s) => s.name))).sort().map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1 glass rounded-md p-1 self-start" role="group" aria-label="Service view mode">
                <Button size="sm" variant={serviceView === "grid" ? "neon" : "ghost"} onClick={() => setServiceView("grid")} title="Grid view" aria-label="Grid view"><LayoutGrid className="w-4 h-4" /></Button>
                <Button size="sm" variant={serviceView === "list" ? "neon" : "ghost"} onClick={() => setServiceView("list")} title="List view" aria-label="List view"><List className="w-4 h-4" /></Button>
              </div>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : services.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No services available yet.</div>
            ) : (() => {
              const filtered = services.filter((s) => {
                if (serviceTypeFilter && (s.service_type ?? "imei") !== serviceTypeFilter) return false;
                const cat = (s.category ?? "general").trim() || "general";
                if (svcGroup !== "all" && cat !== svcGroup) return false;
                if (svcName !== "all" && s.name !== svcName) return false;
                const q = serviceQuery.toLowerCase().trim();
                if (!q) return true;
                return s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q);
              });
              if (filtered.length === 0) {
                return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No services match your filters.</div>;
              }
              const groups = new Map<string, Service[]>();
              for (const s of filtered) {
                const k = (s.category ?? "general").trim() || "general";
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k)!.push(s);
              }
              const groupKeys = Array.from(groups.keys()).sort((a, b) => {
                if (a === "free") return -1;
                if (b === "free") return 1;
                const ao = categoryOrder[a] ?? 9999;
                const bo = categoryOrder[b] ?? 9999;
                if (ao !== bo) return ao - bo;
                return (categoryNames[a] ?? a).localeCompare(categoryNames[b] ?? b);
              });
              return (
                <div className="space-y-6">
                  {groupKeys.map((g) => {
                    const items = groups.get(g)!;
                    return (
                      <div key={g}>
                        <div className="flex items-center gap-3 mb-3">
                          <h2 className="text-sm uppercase tracking-wider text-primary font-bold">{groupLabel(g)}</h2>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>
                        {serviceView === "list" ? (
                          <div className="glass rounded-2xl divide-y divide-border/50 overflow-hidden">
                            {items.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => openCheck(s)}
                                className="w-full text-left flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors"
                              >
                                <Smartphone className="w-5 h-5 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate" title={s.name}>{s.name}</div>
                                  {s.description && <div className="text-xs text-muted-foreground truncate" title={s.description}>{s.description}</div>}
                                </div>
                                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0"><Clock className="w-3 h-3" /> {s.delivery_time}</div>
                                <div className="text-base font-bold font-mono shrink-0">${Number(s.price).toFixed(2)}</div>
                                <Button variant="neon" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); openCheck(s); }}>Check</Button>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((s) => (
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
                                <h3 className="font-bold mb-1 hover:text-primary transition-colors line-clamp-2" title={s.name}>{s.name}</h3>
                                <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2" title={s.description ?? undefined}>{s.description}</p>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xl font-bold font-mono">${Number(s.price).toFixed(2)}</div>
                                  <Button variant="neon" size="sm" onClick={(e) => { e.stopPropagation(); openCheck(s); }}>Check IMEI</Button>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>


          <TabsContent value={rawTab === "orders_imei" || rawTab === "orders_server" ? rawTab : "orders"} className="mt-5">
            <div className="flex items-center justify-end mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const rows = orders.filter((o) => {
                    if (orderTypeFilter && (o.services?.service_type ?? "imei") !== orderTypeFilter) return false;
                    if (orderStatus !== "all" && o.status !== orderStatus) return false;
                    const oid = String(o.order_number ?? "").padStart(4, "0");
                    if (oqOrderId.trim() && !oid.includes(oqOrderId.trim().replace(/^#/, ""))) return false;
                    if (oqImei.trim() && !o.imei.toLowerCase().includes(oqImei.trim().toLowerCase())) return false;
                    if (oqGroup !== "all" && (o.services?.category ?? "") !== oqGroup) return false;
                    if (oqService !== "all" && (o.services?.name ?? "") !== oqService) return false;
                    if (oqFrom && new Date(o.created_at) < new Date(oqFrom)) return false;
                    if (oqTo && new Date(o.created_at) > new Date(oqTo + "T23:59:59")) return false;
                    return true;
                  });
                  if (rows.length === 0) { toast.error("No orders to export"); return; }
                  exportOrdersCsv(rows, `orders-${new Date().toISOString().slice(0,10)}.csv`);
                  toast.success(`Exported ${rows.length} orders`);
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="glass rounded-2xl p-3 mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
              <div><Label className="text-xs text-muted-foreground">Order ID</Label><Input value={oqOrderId} onChange={(e) => setOqOrderId(e.target.value)} placeholder="#0001" /></div>
              {orderTypeFilter !== "server" && (
                <div><Label className="text-xs text-muted-foreground">IMEI/SN</Label><Input value={oqImei} onChange={(e) => setOqImei(e.target.value)} placeholder="IMEI" /></div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Group</Label>
                <Select value={oqGroup} onValueChange={(v) => { setOqGroup(v); setOqService("all"); }}>
                  <SelectTrigger><SelectValue placeholder="All groups" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {Array.from(new Set(orders.filter((o) => !orderTypeFilter || (o.services?.service_type ?? "imei") === orderTypeFilter).map((o) => o.services?.category).filter(Boolean) as string[])).sort((a, b) => {
                      if (a === "free") return -1;
                      if (b === "free") return 1;
                      const ao = categoryOrder[a] ?? 9999;
                      const bo = categoryOrder[b] ?? 9999;
                      if (ao !== bo) return ao - bo;
                      return (categoryNames[a] ?? a).localeCompare(categoryNames[b] ?? b);
                    }).map((g) => (
                      <SelectItem key={g} value={g}>{groupLabel(g)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Service</Label>
                <Select value={oqService} onValueChange={setOqService}>
                  <SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All services</SelectItem>
                    {Array.from(new Set(orders.filter((o) => (!orderTypeFilter || (o.services?.service_type ?? "imei") === orderTypeFilter) && (oqGroup === "all" || o.services?.category === oqGroup)).map((o) => o.services?.name).filter(Boolean) as string[])).sort().map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={oqFrom} onChange={(e) => setOqFrom(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={oqTo} onChange={(e) => setOqTo(e.target.value)} /></div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={orderStatus} onValueChange={setOrderStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> :
                (() => {
                  const filteredOrders = orders.filter((o) => {
                    if (orderTypeFilter && (o.services?.service_type ?? "imei") !== orderTypeFilter) return false;
                    if (orderStatus !== "all" && o.status !== orderStatus) return false;
                    const oid = String(o.order_number ?? "").padStart(4, "0");
                    if (oqOrderId.trim() && !oid.includes(oqOrderId.trim().replace(/^#/, ""))) return false;
                    if (oqImei.trim() && !o.imei.toLowerCase().includes(oqImei.trim().toLowerCase())) return false;
                    if (oqGroup !== "all" && (o.services?.category ?? "") !== oqGroup) return false;
                    if (oqService !== "all" && (o.services?.name ?? "") !== oqService) return false;
                    if (oqFrom && new Date(o.created_at) < new Date(oqFrom)) return false;
                    if (oqTo && new Date(o.created_at) > new Date(oqTo + "T23:59:59")) return false;
                    return true;
                  });
                  if (filteredOrders.length === 0) return <div className="p-12 text-center text-muted-foreground">No orders found.</div>;
                  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / oPageSize));
                  const safePage = Math.min(oPage, totalPages);
                  const pageOrders = filteredOrders.slice((safePage - 1) * oPageSize, safePage * oPageSize);
                  const from = (safePage - 1) * oPageSize + 1;
                  const to = Math.min(filteredOrders.length, safePage * oPageSize);
                  return (
                <>
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left">
                     <tr><th className="px-5 py-3">Order ID</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Price</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Result</th></tr>
                  </thead>
                  <tbody>
                    {pageOrders.map((o) => (
                      <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setOrderDetail(o)}>
                        <td className="px-5 py-3 font-mono text-xs">#{String(o.order_number ?? 0).padStart(4, "0")}</td>
                        <td className="px-5 py-3 font-medium max-w-[260px] truncate" title={o.services?.name ?? undefined}>{o.services?.name ?? "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs">{o.imei}</td>
                        <td className="px-5 py-3"><StatusBadge status={o.status} errorMessage={sanitizeError(o.error_message)} /></td>
                        <td className="px-5 py-3 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3 text-[13px] leading-relaxed max-w-md" onClick={(e) => e.stopPropagation()}>
                          {o.result
                            ? <div className="max-h-40 overflow-auto"><ColoredResult text={hideSupplierRef(extractResponse(o.result))} font={o.services?.result_font ?? undefined} /></div>
                            : <span className="text-muted-foreground text-xs">{sanitizeError(o.error_message) || (o.status === "pending" ? "Waiting…" : "—")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Showing {from}–{to} of {filteredOrders.length}</span>
                    <span>·</span>
                    <span>Per page:</span>
                    <Select value={String(oPageSize)} onValueChange={(v) => { setOPageSize(Number(v)); setOPage(1); }}>
                      <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[20, 30, 40, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setOPage(1)}>« First</Button>
                    <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setOPage(safePage - 1)}>‹ Prev</Button>
                    <span className="px-2 font-mono">Page {safePage} / {totalPages}</span>
                    <Button size="sm" variant="ghost" disabled={safePage >= totalPages} onClick={() => setOPage(safePage + 1)}>Next ›</Button>
                    <Button size="sm" variant="ghost" disabled={safePage >= totalPages} onClick={() => setOPage(totalPages)}>Last »</Button>
                  </div>
                </div>
                </>
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

          <TabsContent value="referrals" className="mt-5">
            <ReferralsPanel />
          </TabsContent>

          <TabsContent value="support" className="mt-5">
            <SupportPanel />
          </TabsContent>

          <TabsContent value="settings" className="mt-5">
            <div className="glass rounded-2xl p-6 space-y-6 max-w-2xl">
              <InstallAppButton />
              <TelegramPairCard />


              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label className="text-base">Telegram alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive order results and wallet updates on the linked bot.</p>
                </div>
                <Switch
                  checked={tgEnabled}
                  onCheckedChange={async (v) => {
                    setTgEnabled(v);
                    if (!user) return;
                    const { error } = await supabase.from("profiles").update({ notify_telegram: v }).eq("id", user.id);
                    if (error) toast.error(error.message);
                    else { toast.success("Saved"); refreshProfile(); }
                  }}
                />
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Email alerts</Label>
                    <p className="text-xs text-muted-foreground">Master switch for all email notifications.</p>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={async (v) => {
                      setEmailEnabled(v);
                      if (!user) return;
                      const { error } = await supabase.from("profiles").update({ notify_email: v }).eq("id", user.id);
                      if (error) toast.error(error.message); else { toast.success("Saved"); refreshProfile(); }
                    }}
                  />
                </div>

                {emailEnabled && (
                  <div className="space-y-2 pl-1 pt-1 border-t border-border/40">
                    {[
                      { col: "notify_order_placed", label: "Order placed", desc: "Confirmation when you submit a check." },
                      { col: "notify_order_completed", label: "Order success / rejected", desc: "Final result delivered to your inbox." },
                      { col: "notify_balance_updates", label: "Wallet & referrals", desc: "Top-ups, refunds and referral bonuses." },
                    ].map((row) => {
                      const checked = (profile as unknown as Record<string, boolean | undefined>)?.[row.col] ?? true;
                      return (
                        <div key={row.col} className="flex items-center justify-between pt-2">
                          <div>
                            <Label className="text-sm">{row.label}</Label>
                            <p className="text-[11px] text-muted-foreground">{row.desc}</p>
                          </div>
                          <Switch
                            checked={checked}
                            onCheckedChange={async (v) => {
                              if (!user) return;
                              const { error } = await supabase.from("profiles").update({ [row.col]: v } as never).eq("id", user.id);
                              if (error) toast.error(error.message); else { toast.success("Saved"); refreshProfile(); }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-5">
            <ApiDocs embedded />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Top Up Wallet</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(paySettings?.topup_amounts ?? [5, 10, 20, 30]).map((a) => (
                <Button key={a} variant="outline" onClick={() => setTopupAmount(String(a))} className={Number(topupAmount) === a ? "border-primary text-primary" : ""}>${a}</Button>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Amount (USD)</label>
              <input
                type="number" min="1" max="10000" value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full h-10 rounded-md border border-border/50 bg-background px-3 text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              {paySettings?.binance_enabled && (
                <Button variant="hero" className="w-full" onClick={() => requestTopup()}>
                  Pay with Binance (USDT/Crypto)
                </Button>
              )}
              {!paySettings?.binance_enabled && (
                <p className="text-xs text-muted-foreground text-center">No payment methods enabled — please contact admin.</p>
              )}
            </div>

            {paySettings?.ask_admin_enabled !== false && (
              <Button variant="neon" className="w-full" onClick={askAdmin}>
                Need help with payment? Contact admin
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent className="glass max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pay with Binance</DialogTitle>
            <DialogDescription>
              Send <b className="text-foreground">{pay?.amount} {pay?.coin}</b> from your Binance app. Your wallet credits automatically within ~1 minute.
            </DialogDescription>
          </DialogHeader>
          {pay && (
            <div className="space-y-4">
              {pay.qr_url && (
                <div className="flex justify-center">
                  <img src={pay.qr_url} alt="Binance Pay QR" className="w-56 h-56 rounded-lg bg-white p-2 border border-border/40" />
                </div>
              )}
              <div className="space-y-2">
                <div className="rounded-md bg-secondary/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Binance Pay ID</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm break-all">{pay.pay_id}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(pay.pay_id); toast.success("Copied"); }}>Copy</Button>
                  </div>
                </div>
                <div className="rounded-md bg-warning/10 border border-warning/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-warning">Required Memo / Remarks</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-base font-bold">{pay.memo}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(pay.memo); toast.success("Copied"); }}>Copy</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">⚠ Paste this memo in the "Remarks" field when sending — without it we can't match your payment.</p>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Expires in {Math.max(0, Math.floor((new Date(pay.expires_at).getTime() - now) / 1000))}s · waiting for deposit…
                  <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />
                </div>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setPay(null)}>Close</Button>
            </div>
          )}
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
        <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle>{orderDetail?.services?.name}</DialogTitle>
              {orderDetail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceOrder(orderDetail)}
                >
                  <FileText className="w-4 h-4 mr-2" /> Invoice
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">#{String(orderDetail?.order_number ?? 0).padStart(4, "0")}</span></div>
              <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono">{orderDetail?.imei}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={orderDetail?.status ?? ""} errorMessage={sanitizeError(orderDetail?.error_message)} /></div>
              <div><span className="text-muted-foreground">Charged:</span> <span className="font-mono">${Number(orderDetail?.price_charged ?? 0).toFixed(2)}</span></div>
              <div><span className="text-muted-foreground">Delivery Time:</span> <span>{orderDetail?.services?.delivery_time ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Took:</span> <span>{orderDetail ? formatDuration(orderDetail.created_at, orderDetail.updated_at, orderDetail.status) : "—"}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Submitted:</span> <span>{orderDetail ? new Date(orderDetail.created_at).toLocaleString() : ""}</span></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-muted-foreground">Result</div>
                {(orderDetail?.result || orderDetail?.error_message) && (
                  <Button variant="outline" size="sm" onClick={async () => {
                    const txt = orderDetail?.result ? stripColorMarkers(hideSupplierRef(extractResponse(orderDetail.result))) : sanitizeError(orderDetail?.error_message);
                    try {
                      await navigator.clipboard.writeText(txt);
                      toast.success("Copied!", { description: "Result copied to clipboard" });
                    } catch {
                      const ta = document.createElement("textarea");
                      ta.value = txt; document.body.appendChild(ta); ta.select();
                      try { document.execCommand("copy"); toast.success("Copied!", { description: "Result copied to clipboard" }); }
                      catch { toast.error("Copy failed"); }
                      document.body.removeChild(ta);
                    }
                  }}>Copy</Button>
                )}
              </div>
              <div className="glass rounded p-4 text-[15px] leading-relaxed max-h-96 overflow-auto">
                {orderDetail?.result
                  ? <ColoredResult text={hideSupplierRef(extractResponse(orderDetail.result))} font={orderDetail.services?.result_font ?? undefined} />
                  : <pre className="font-mono text-sm whitespace-pre-wrap break-all">{sanitizeError(orderDetail?.error_message) || "No data"}</pre>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invoiceOrder} onOpenChange={(o) => !o && setInvoiceOrder(null)}>
        <DialogContent className="glass w-[100vw] sm:w-auto max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-lg p-0 overflow-hidden flex flex-col gap-0">
          <DialogHeader className="px-3 py-3 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-base"><FileText className="w-5 h-5" /> Invoice</DialogTitle>
              <Button
                variant="hero"
                size="sm"
                disabled={invoiceDownloading}
                onClick={async () => {
                  if (!invoiceOrder) return;
                  try {
                    setInvoiceDownloading(true);
                    await downloadOrderInvoice(
                      invoiceOrder,
                      {
                        brand_name: settings.brand_name,
                        tagline: settings.tagline,
                        logo_url: settings.logo_url,
                        contact_email: settings.contact_email,
                        contact_phone: settings.contact_phone,
                        address: settings.address,
                      },
                      { display_name: profile?.display_name ?? null, email: profile?.email ?? user?.email ?? null },
                    );
                  } catch {
                    toast.error("Failed to generate invoice");
                  } finally {
                    setInvoiceDownloading(false);
                  }
                }}
              >
                <FileText className="w-4 h-4 mr-1.5" /> {invoiceDownloading ? "Preparing…" : "Download"}
              </Button>
            </div>
          </DialogHeader>
          {invoiceOrder && (
            <div className="flex-1 overflow-y-auto bg-muted/30 p-3 sm:p-4">
              <div className="mx-auto max-w-[640px] bg-white text-black rounded-md shadow-sm p-4 sm:p-6 text-sm">
                <div className="flex items-start justify-between gap-3 pb-3 border-b">
                  <div className="flex items-center gap-3 min-w-0">
                    {settings.logo_url && (
                      <img src={settings.logo_url} alt={settings.brand_name} className="h-10 sm:h-14 w-auto object-contain" />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg sm:text-2xl font-bold">INVOICE</div>
                    <div className="text-[10px] sm:text-xs text-gray-500">Order #{String(invoiceOrder.order_number ?? 0).padStart(4, "0")}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500">{new Date(invoiceOrder.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 text-[11px] sm:text-xs">
                  <div>
                    <div className="text-gray-500 uppercase tracking-wide mb-1">From</div>
                    <div className="font-semibold">{settings.brand_name}</div>
                    {settings.contact_email && <div className="break-all">{settings.contact_email}</div>}
                    {settings.contact_phone && <div>{settings.contact_phone}</div>}
                    {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
                  </div>
                  <div>
                    <div className="text-gray-500 uppercase tracking-wide mb-1">Bill To</div>
                    <div className="font-semibold break-all">{profile?.display_name || profile?.email || user?.email || "Customer"}</div>
                    {(profile?.email || user?.email) && <div className="break-all">{profile?.email || user?.email}</div>}
                  </div>
                </div>

                {/* Desktop table */}
                <table className="hidden sm:table w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="text-left p-2">Service</th>
                      <th className="text-left p-2">IMEI / SN</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-50">
                      <td className="p-2 align-top">{invoiceOrder.services?.name ?? "—"}</td>
                      <td className="p-2 align-top font-mono">{invoiceOrder.imei}</td>
                      <td className="p-2 align-top">{invoiceOrder.status.toUpperCase()}</td>
                      <td className="p-2 align-top text-right font-mono">${Number(invoiceOrder.price_charged).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Mobile stacked item */}
                <div className="sm:hidden rounded-md border bg-gray-50 p-3 text-[12px] space-y-1.5">
                  <div className="bg-gray-900 text-white -m-3 mb-2 p-2 text-[11px] font-semibold uppercase tracking-wide rounded-t-md">Item</div>
                  <div><span className="text-gray-500">Service: </span><span>{invoiceOrder.services?.name ?? "—"}</span></div>
                  <div><span className="text-gray-500">IMEI/SN: </span><span className="font-mono break-all">{invoiceOrder.imei}</span></div>
                  <div><span className="text-gray-500">Status: </span><span>{invoiceOrder.status.toUpperCase()}</span></div>
                  <div><span className="text-gray-500">Amount: </span><span className="font-mono">${Number(invoiceOrder.price_charged).toFixed(2)}</span></div>
                </div>

                <div className="flex justify-between sm:justify-end items-center pt-3 text-sm">
                  <span className="sm:hidden text-gray-500 text-xs">TOTAL</span>
                  <div className="font-bold">${Number(invoiceOrder.price_charged).toFixed(2)}</div>
                </div>
                {(invoiceOrder.result || invoiceOrder.error_message) && (
                  <div className="mt-4 pt-3 border-t">
                    <div className="font-semibold mb-1 text-[12px]">Result</div>
                    <pre className="font-mono text-[10.5px] sm:text-[11px] whitespace-pre-wrap break-all text-gray-700">
                      {hideSupplierRef((invoiceOrder.result || invoiceOrder.error_message || "").replace(/\[\[c:[^\]]+\]\]/g, "").replace(/\[\[\/c\]\]/g, ""))}
                    </pre>
                  </div>
                )}
                <div className="mt-5 pt-3 border-t text-center text-[10px] text-muted-foreground">
                  Generated {new Date().toLocaleString()} — {settings.brand_name}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>




      <ImeiCheckDialog
        service={selectedService}
        balance={Number(profile?.balance ?? 0)}
        onClose={() => setSelectedService(null)}
        onAfterRun={refreshAfterRun}
        onBulkStarted={() => setSearchParams({ tab: "orders" }, { replace: true })}
      />
    </Layout>
  );
}

function TelegramPairCard() {
  const [pair, setPair] = useState<{ code: string; bot_username: string; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("client_bot_chat_id").eq("id", user.id).maybeSingle();
      setLinked((data as any)?.client_bot_chat_id ?? null);
    })();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const generate = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("telegram-pair", { body: { bot_kind: "client" } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    setPair(data as any);
  };

  const unlink = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ client_bot_chat_id: null } as any).eq("id", user.id);
    setLinked(null); setPair(null);
    toast.success("Unlinked");
  };

  if (linked) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
        <div className="font-semibold text-emerald-700 dark:text-emerald-300">✅ Telegram connected</div>
        <p className="text-xs text-muted-foreground mt-1">Chat ID: <code>{linked}</code></p>
        <Button size="sm" variant="outline" className="mt-3" onClick={unlink}>Disconnect</Button>
      </div>
    );
  }

  const remaining = pair ? Math.max(0, Math.floor((new Date(pair.expires_at).getTime() - now) / 1000)) : 0;

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="font-semibold flex items-center gap-2"><Send className="w-4 h-4" /> Connect Telegram (Dhru-style)</div>
      {!pair && (
        <>
          <p className="text-xs text-muted-foreground">Generate a 6-digit code, open the bot, and send the code. Done — no chat ID needed.</p>
          <Button size="sm" onClick={generate} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Generate pairing code
          </Button>
        </>
      )}
      {pair && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <a href={`https://t.me/${pair.bot_username}`} target="_blank" rel="noopener noreferrer"
               className="text-primary underline font-mono">@{pair.bot_username}</a>
            <span className="text-3xl font-bold tracking-widest font-mono">{pair.code}</span>
            <span className="text-xs text-muted-foreground">expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
          </div>
          <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
            <li>Tap @{pair.bot_username} above to open the bot.</li>
            <li>Press <b>Start</b>, then send the 6-digit code.</li>
          </ol>
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>Generate new code</Button>
        </div>
      )}
    </div>
  );
}
