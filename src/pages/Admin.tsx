import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, RotateCcw, Search, TrendingUp, Users as UsersIcon, Briefcase, ListOrdered, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { serviceSchema } from "@/lib/validation";

type SuccessRule = { path: string; op: "eq" | "neq" | "contains" | "not_contains" | "exists" | "truthy"; value?: string | number | boolean };
type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; api_url: string | null; api_method: string; api_request_body: string | null; response_template: string | null; active: boolean; category: string | null; success_rules: SuccessRule[] | null };
type ProfileRow = { id: string; email: string | null; display_name: string | null; balance: number; banned: boolean; created_at: string };
type OrderRow = { id: string; user_id: string; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; services: { name: string } | null; profiles: { email: string | null } | null };
type TxRow = { id: string; user_id: string; amount: number; type: string; balance_after: number; description: string | null; created_at: string; profiles?: { email: string | null } | null };

const empty: Partial<Service> = { name: "", description: "", price: 0, delivery_time: "Instant", api_url: "", api_method: "GET", api_request_body: "", response_template: "", active: true, category: "general", success_rules: [] };

/* ---------- Dashboard ---------- */
function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, services: 0, orders: 0, revenue: 0, pending: 0, failed: 0 });
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [u, s, o, txAll, recentO, profs, svcs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("status,price_charged"),
        supabase.from("transactions").select("amount,type").eq("type", "topup"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("id,email"),
        supabase.from("services").select("id,name"),
      ]);
      const orders = (o.data ?? []) as { status: string; price_charged: number }[];
      const profMap = new Map((profs.data ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]));
      const svcMap = new Map((svcs.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
      const enriched = (recentO.data ?? []).map((row: { user_id: string; service_id: string; [k: string]: unknown }) => ({
        ...row,
        profiles: { email: profMap.get(row.user_id) ?? null },
        services: { name: svcMap.get(row.service_id) ?? "—" },
      })) as unknown as OrderRow[];
      setStats({
        users: u.count ?? 0,
        services: s.count ?? 0,
        orders: orders.length,
        revenue: (txAll.data ?? []).reduce((a, t) => a + Number(t.amount), 0),
        pending: orders.filter((x) => x.status === "pending").length,
        failed: orders.filter((x) => x.status === "failed").length,
      });
      setRecent(enriched);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Total Users", value: stats.users, icon: UsersIcon, color: "text-primary", to: "/admin/users" },
    { label: "Services", value: stats.services, icon: Briefcase, color: "text-accent", to: "/admin/services" },
    { label: "Orders", value: stats.orders, icon: ListOrdered, color: "text-success", to: "/admin/orders" },
    { label: "Top-up Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "text-warning", to: "/admin/transactions" },
    { label: "Pending Orders", value: stats.pending, icon: TrendingUp, color: "text-warning", to: "/admin/orders" },
    { label: "Failed Orders", value: stats.failed, icon: AlertCircle, color: "text-destructive", to: "/admin/orders" },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Real-time overview of your platform">
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <button key={c.label} onClick={() => navigate(c.to)} className="glass rounded-2xl p-5 text-left hover:shadow-neon transition-all hover:border-primary/40 border border-border/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
                    <Icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div className="text-3xl font-bold font-mono">{c.value}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center">
              <h2 className="font-bold">Recent Orders</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate("/admin/orders")}>View all →</Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left text-xs">
                <tr><th className="px-5 py-2.5">User</th><th className="px-5 py-2.5">Service</th><th className="px-5 py-2.5">IMEI</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Price</th></tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t border-border/40">
                    <td className="px-5 py-2.5 text-xs">{o.profiles?.email}</td>
                    <td className="px-5 py-2.5">{o.services?.name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{o.imei}</td>
                    <td className={`px-5 py-2.5 capitalize ${statusColor(o.status)}`}>{o.status}</td>
                    <td className="px-5 py-2.5 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground" } as Record<string, string>)[s] ?? "";

/* ---------- Users ---------- */
function AdminUsers() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [creditUser, setCreditUser] = useState<ProfileRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("10");
  const [makeAdminUser, setMakeAdminUser] = useState<ProfileRow | null>(null);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers((data ?? []) as ProfileRow[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter((u) =>
    !q || u.email?.toLowerCase().includes(q.toLowerCase()) || u.display_name?.toLowerCase().includes(q.toLowerCase())
  ), [users, q]);

  const adjustCredit = async (delta: number) => {
    if (!creditUser) return;
    const { error } = await supabase.functions.invoke("admin-adjust-balance", {
      body: { user_id: creditUser.id, amount: delta, description: delta > 0 ? "Admin credit" : "Admin debit" },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Balance updated"); setCreditUser(null); load();
  };
  const toggleBan = async (u: ProfileRow) => {
    const { error } = await supabase.from("profiles").update({ banned: !u.banned }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(u.banned ? "Unbanned" : "Banned"); load();
  };
  const grantAdmin = async (u: ProfileRow) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
    if (error) { toast.error(error.message); return; }
    toast.success(`${u.email} is now admin`); setMakeAdminUser(null);
  };

  return (
    <AdminLayout
      title="Users"
      subtitle={`${users.length} registered clients`}
      actions={
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Name</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Joined</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3">{u.email}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.display_name}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold">${Number(u.balance).toFixed(2)}</td>
                  <td className="px-5 py-3">{u.banned ? <span className="text-destructive">● Banned</span> : <span className="text-success">● Active</span>}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="neon" onClick={() => { setCreditUser(u); setCreditAmount("10"); }}>Refill</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleBan(u)}>{u.banned ? "Unban" : "Ban"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setMakeAdminUser(u)}>Make Admin</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <Dialog open={!!creditUser} onOpenChange={(o) => !o && setCreditUser(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Refill Balance — {creditUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current: <span className="font-mono font-bold">${Number(creditUser?.balance ?? 0).toFixed(2)}</span></p>
            <div><Label>Amount (USD)</Label><Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={() => adjustCredit(Number(creditAmount))}>+ Add Credit</Button>
              <Button variant="destructive" className="flex-1" onClick={() => adjustCredit(-Math.abs(Number(creditAmount)))}>− Deduct</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!makeAdminUser} onOpenChange={(o) => !o && setMakeAdminUser(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Grant admin access?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">User <span className="font-mono">{makeAdminUser?.email}</span> will get full admin powers.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setMakeAdminUser(null)}>Cancel</Button>
            <Button variant="hero" onClick={() => makeAdminUser && grantAdmin(makeAdminUser)}>Grant Admin</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------- Services ---------- */
function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("category").order("name");
    setServices((data ?? []) as unknown as Service[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => services.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.category?.toLowerCase().includes(q.toLowerCase())
  ), [services, q]);

  const saveService = async () => {
    if (!editing) return;
    const parsed = serviceSchema.safeParse({
      name: editing.name, description: editing.description, price: Number(editing.price),
      delivery_time: editing.delivery_time, api_url: editing.api_url, api_method: editing.api_method,
      category: editing.category, active: editing.active,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const payload = {
      name: parsed.data.name, description: parsed.data.description ?? null, price: parsed.data.price,
      delivery_time: parsed.data.delivery_time, api_url: parsed.data.api_url || null, api_method: parsed.data.api_method,
      api_request_body: editing.api_request_body ?? null, category: parsed.data.category ?? "general",
      active: parsed.data.active, response_template: editing.response_template ?? null,
      success_rules: (editing.success_rules ?? []) as unknown as never,
    };
    const { error } = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };
  const delService = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };
  const updateRule = (idx: number, patch: Partial<SuccessRule>) => {
    if (!editing) return;
    const rules = [...(editing.success_rules ?? [])];
    rules[idx] = { ...rules[idx], ...patch } as SuccessRule;
    setEditing({ ...editing, success_rules: rules });
  };
  const addRule = () => editing && setEditing({ ...editing, success_rules: [...(editing.success_rules ?? []), { path: "success", op: "truthy" }] });
  const removeRule = (i: number) => {
    if (!editing) return;
    const rules = [...(editing.success_rules ?? [])]; rules.splice(i, 1);
    setEditing({ ...editing, success_rules: rules });
  };

  return (
    <AdminLayout
      title="Services"
      subtitle={`${services.length} services configured`}
      actions={
        <>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="hero" onClick={() => setEditing({ ...empty })}><Plus className="w-4 h-4 mr-1" />New Service</Button>
        </>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Delivery</th><th className="px-5 py-3">API</th><th className="px-5 py-3">Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{s.category}</span></td>
                  <td className="px-5 py-3 font-mono">${Number(s.price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{s.delivery_time}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{s.api_url || <span className="text-warning">⚠ not set</span>}</td>
                  <td className="px-5 py-3">{s.active ? <span className="text-success">● Active</span> : <span className="text-destructive">● Off</span>}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => delService(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No services.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Service</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={100} /></div>
                <div><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} maxLength={50} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={500} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (USD)</Label><Input type="number" step="0.01" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Delivery Time</Label><Input value={editing.delivery_time ?? ""} onChange={(e) => setEditing({ ...editing, delivery_time: e.target.value })} maxLength={50} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>API URL ({"{IMEI}"} placeholder)</Label><Input value={editing.api_url ?? ""} onChange={(e) => setEditing({ ...editing, api_url: e.target.value })} placeholder="https://provider.com/check.php?imei={IMEI}&key=XXX" /></div>
                <div><Label>Method</Label>
                  <Select value={editing.api_method ?? "GET"} onValueChange={(v) => setEditing({ ...editing, api_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {editing.api_method === "POST" && (
                <div>
                  <Label>POST Body Template</Label>
                  <Textarea value={editing.api_request_body ?? ""} onChange={(e) => setEditing({ ...editing, api_request_body: e.target.value })} placeholder='{"username":"x","apikey":"y","imei":"{IMEI}"}' rows={3} className="font-mono text-xs" />
                </div>
              )}
              <div>
                <Label>Response Template (optional)</Label>
                <Textarea value={editing.response_template ?? ""} onChange={(e) => setEditing({ ...editing, response_template: e.target.value })} placeholder="Model: {model}&#10;IMEI: {imei}" rows={3} />
              </div>
              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm">Success Rules</Label><p className="text-xs text-muted-foreground">All must pass. Empty = any HTTP 200 = success.</p></div>
                  <Button type="button" size="sm" variant="ghost" onClick={addRule}><Plus className="w-3 h-3 mr-1" />Add</Button>
                </div>
                {(editing.success_rules ?? []).map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4 font-mono text-xs" placeholder="JSON path" value={r.path} onChange={(e) => updateRule(i, { path: e.target.value })} />
                    <Select value={r.op} onValueChange={(v) => updateRule(i, { op: v as SuccessRule["op"] })}>
                      <SelectTrigger className="col-span-3 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truthy">truthy</SelectItem><SelectItem value="exists">exists</SelectItem>
                        <SelectItem value="eq">equals</SelectItem><SelectItem value="neq">not equals</SelectItem>
                        <SelectItem value="contains">contains</SelectItem><SelectItem value="not_contains">not contains</SelectItem>
                      </SelectContent>
                    </Select>
                    {(r.op === "eq" || r.op === "neq" || r.op === "contains" || r.op === "not_contains") ?
                      <Input className="col-span-4 font-mono text-xs" placeholder="value" value={String(r.value ?? "")} onChange={(e) => updateRule(i, { value: e.target.value })} /> :
                      <div className="col-span-4" />}
                    <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => removeRule(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Active</Label></div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="hero" onClick={saveService}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------- Orders ---------- */
function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<OrderRow | null>(null);

  const load = async () => {
    const { data } = await supabase.from("orders").select("*, services(name), profiles!orders_user_id_fkey(email)").order("created_at", { ascending: false }).limit(500);
    setOrders((data ?? []) as unknown as OrderRow[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter((o) =>
    (filter === "all" || o.status === filter) &&
    (!q || o.imei.includes(q) || o.profiles?.email?.toLowerCase().includes(q.toLowerCase()))
  ), [orders, q, filter]);

  const refundOrder = async (o: OrderRow) => {
    if (!confirm(`Refund $${Number(o.price_charged).toFixed(2)}?`)) return;
    const { error } = await supabase.functions.invoke("admin-refund-order", { body: { order_id: o.id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Refunded"); load();
  };

  return (
    <AdminLayout
      title="Orders"
      subtitle={`${orders.length} total orders`}
      actions={
        <>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="IMEI or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Charged</th><th className="px-5 py-3">Date</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setView(o)}>
                  <td className="px-5 py-3 text-xs">{o.profiles?.email}</td>
                  <td className="px-5 py-3">{o.services?.name}</td>
                  <td className="px-5 py-3 font-mono text-xs">{o.imei}</td>
                  <td className={`px-5 py-3 capitalize ${statusColor(o.status)}`}>{o.status}</td>
                  <td className="px-5 py-3 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {o.status !== "refunded" && Number(o.price_charged) > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => refundOrder(o)}><RotateCcw className="w-3 h-3 mr-1" />Refund</Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No orders.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="glass max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">User</Label><div>{view.profiles?.email}</div></div>
                <div><Label className="text-xs">Service</Label><div>{view.services?.name}</div></div>
                <div><Label className="text-xs">IMEI</Label><div className="font-mono">{view.imei}</div></div>
                <div><Label className="text-xs">Status</Label><div className={`capitalize ${statusColor(view.status)}`}>{view.status}</div></div>
                <div><Label className="text-xs">Charged</Label><div className="font-mono">${Number(view.price_charged).toFixed(2)}</div></div>
                <div><Label className="text-xs">Date</Label><div>{new Date(view.created_at).toLocaleString()}</div></div>
              </div>
              {view.error_message && <div><Label className="text-xs text-destructive">Error</Label><pre className="bg-destructive/10 p-3 rounded text-xs whitespace-pre-wrap">{view.error_message}</pre></div>}
              {view.result && <div><Label className="text-xs">Result</Label><pre className="bg-secondary/40 p-3 rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto">{view.result}</pre></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------- Transactions ---------- */
function AdminTransactions() {
  const [tx, setTx] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("transactions").select("*, profiles!transactions_user_id_fkey(email)").order("created_at", { ascending: false }).limit(500);
      setTx((data ?? []) as unknown as TxRow[]); setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => tx.filter((t) =>
    !q || t.profiles?.email?.toLowerCase().includes(q.toLowerCase()) || t.description?.toLowerCase().includes(q.toLowerCase())
  ), [tx, q]);

  const typeColor = (t: string) => ({ topup: "text-success", debit: "text-destructive", refund: "text-warning", adjustment: "text-primary" } as Record<string, string>)[t] ?? "";

  return (
    <AdminLayout title="Transactions" subtitle={`${tx.length} ledger entries`} actions={
      <div className="relative w-72">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Email or description…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    }>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Balance After</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Date</th></tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border/50">
                  <td className="px-5 py-3 text-xs">{t.profiles?.email}</td>
                  <td className={`px-5 py-3 uppercase text-xs font-bold ${typeColor(t.type)}`}>{t.type}</td>
                  <td className={`px-5 py-3 text-right font-mono ${Number(t.amount) >= 0 ? "text-success" : "text-destructive"}`}>{Number(t.amount) >= 0 ? "+" : ""}${Number(t.amount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-mono">${Number(t.balance_after).toFixed(2)}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{t.description}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No transactions.</td></tr>}
            </tbody>
          </table>
        </div>
      }
    </AdminLayout>
  );
}

/* ---------- Notifications ---------- */
function AdminNotifications() {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const broadcast = async () => {
    if (!msg.trim()) return;
    setSending(true);
    const { data: profs } = await supabase.from("profiles").select("id,telegram_chat_id,notify_telegram").not("telegram_chat_id", "is", null);
    let sent = 0;
    for (const p of profs ?? []) {
      if (!p.notify_telegram) continue;
      try {
        await supabase.functions.invoke("telegram-notify", { body: { user_id: p.id, message: msg } });
        sent++;
      } catch (e) { /* skip */ }
    }
    toast.success(`Broadcast sent to ${sent} users`);
    setMsg(""); setSending(false);
  };
  return (
    <AdminLayout title="Notifications" subtitle="Send announcements to all clients via Telegram">
      <div className="glass rounded-2xl p-6 max-w-2xl space-y-4">
        <div>
          <Label>Message</Label>
          <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi clients! New service added: …" />
          <p className="text-xs text-muted-foreground mt-1">Sent only to users who connected Telegram and enabled notifications.</p>
        </div>
        <Button variant="hero" onClick={broadcast} disabled={sending || !msg.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Send Broadcast
        </Button>
      </div>
    </AdminLayout>
  );
}

/* ---------- Settings ---------- */
function AdminSettings() {
  return (
    <AdminLayout title="Settings" subtitle="Platform configuration">
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-2">Brand</h3>
          <p className="text-sm text-muted-foreground mb-4">LIKKI UNLOCKING — #1 Direct Wholesale Supplier</p>
          <p className="text-xs text-muted-foreground">To change logo, replace <code className="px-1 bg-secondary/50 rounded">src/assets/logo.png</code></p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-2">Telegram Bot</h3>
          <p className="text-sm text-muted-foreground mb-2">Connected via Lovable Cloud connector.</p>
          <p className="text-xs text-muted-foreground">Clients link their account in Dashboard → Notifications.</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-2">Email</h3>
          <p className="text-sm text-muted-foreground">Verify a sender domain in Cloud → Emails to enable email notifications.</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-2">API Providers</h3>
          <p className="text-sm text-muted-foreground">Configure Dhru / GSM / custom APIs per service in the Services tab. Use POST body templates and Success Rules for accurate parsing.</p>
        </div>
      </div>
    </AdminLayout>
  );
}

/* ---------- Router ---------- */
export default function Admin() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="services" element={<AdminServices />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="transactions" element={<AdminTransactions />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="settings" element={<AdminSettings />} />
    </Routes>
  );
}
