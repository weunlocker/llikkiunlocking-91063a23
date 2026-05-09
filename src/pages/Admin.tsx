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
import { Plus, Edit, Trash2, Loader2, RotateCcw, Search, TrendingUp, Users as UsersIcon, Briefcase, ListOrdered, DollarSign, AlertCircle, RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { serviceSchema } from "@/lib/validation";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminUserEditDialog, { type EditableUser } from "@/components/AdminUserEditDialog";
import { ColoredResult } from "@/components/ColoredResult";
import { extractResponse } from "@/lib/extractResponse";

type SuccessRule = { path: string; op: "eq" | "neq" | "contains" | "not_contains" | "exists" | "truthy"; value?: string | number | boolean };
type Service = { id: string; service_code: string | null; name: string; description: string | null; price: number; delivery_time: string; api_url: string | null; api_method: string; api_request_body: string | null; response_template: string | null; sample_result: string | null; result_font: string | null; result_color: string | null; active: boolean; is_free: boolean; category: string | null; success_rules: SuccessRule[] | null; supplier_id: string | null; supplier_action: string | null; sort_order: number | null };
type Supplier = { id: string; name: string; type: "dhru" | "generic" | "ifree" | "goimeicheck"; endpoint_url: string; dhru_username: string | null; dhru_api_key: string | null; active: boolean; notes: string | null };
type ProfileRow = { id: string; email: string | null; display_name: string | null; balance: number; banned: boolean; created_at: string };
type OrderRow = { id: string; order_number: number; user_id: string; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; services: { name: string } | null; profiles: { email: string | null } | null };
type TxRow = { id: string; user_id: string; amount: number; type: string; balance_after: number; description: string | null; created_at: string; profiles?: { email: string | null } | null };

const empty: Partial<Service> = { name: "", description: "", price: 0, delivery_time: "Instant", api_url: "", api_method: "GET", api_request_body: "", response_template: "", sample_result: "", result_font: "mono", result_color: "#e2e8f0", active: true, is_free: false, category: "general", success_rules: [], supplier_id: null, supplier_action: "" };

const FONT_OPTIONS = [
  { label: "Mono", value: "mono", css: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  { label: "Sans", value: "sans", css: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Serif", value: "serif", css: "Georgia, Cambria, Times New Roman, serif" },
];
const fontCss = (key: string | null | undefined) => FONT_OPTIONS.find((f) => f.value === key)?.css ?? FONT_OPTIONS[0].css;

// Render text with [[c:#hex]]...[[/c]] markers. Each span carries data-raw-start
// indicating its starting offset in the RAW (with-markers) source string,
// so DOM selection can be mapped back to raw indexes.
function renderColored(text: string): JSX.Element[] {
  const lines = text.split("\n");
  let rawCursor = 0; // running raw offset including newlines
  return lines.map((line, li) => {
    const lineStart = rawCursor;
    const parts: JSX.Element[] = [];
    const re = /\[\[c:(#?[0-9a-fA-F]{3,8})\]\]([\s\S]*?)\[\[\/c\]\]/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) {
        parts.push(<span key={`t${i++}`} data-raw-start={lineStart + last}>{line.slice(last, m.index)}</span>);
      }
      const color = m[1].startsWith("#") ? m[1] : `#${m[1]}`;
      const innerStart = lineStart + m.index + `[[c:${m[1]}]]`.length;
      parts.push(<span key={`c${i++}`} data-raw-start={innerStart} style={{ color }}>{m[2]}</span>);
      last = m.index + m[0].length;
    }
    if (last < line.length) {
      parts.push(<span key={`t${i++}`} data-raw-start={lineStart + last}>{line.slice(last)}</span>);
    }
    rawCursor += line.length + 1; // include the \n separator
    return <div key={li} data-raw-line-start={lineStart}>{parts.length ? parts : "\u00a0"}</div>;
  });
}

// Map a DOM node + offset (inside the preview) to a raw-string index.
function domToRawOffset(container: HTMLElement, node: Node, offset: number): number | null {
  let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  // Walk up to the nearest span carrying data-raw-start
  while (el && el !== container && !el.dataset?.rawStart) el = el.parentElement;
  if (!el || !el.dataset.rawStart) return null;
  return parseInt(el.dataset.rawStart, 10) + offset;
}

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
        supabase.from("transactions").select("amount,type").in("type", ["topup","admin_credit"]),
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

          <div className="mt-8 glass rounded-2xl overflow-x-auto">
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

const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground", in_process: "text-primary" } as Record<string, string>)[s] ?? "";

/* ---------- Users ---------- */
function AdminUsers() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [creditUser, setCreditUser] = useState<ProfileRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("10");
  const [makeAdminUser, setMakeAdminUser] = useState<ProfileRow | null>(null);
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);

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

  const groupBadge = (g?: string | null) => {
    const k = String(g ?? "standard").toLowerCase();
    const map: Record<string, string> = {
      diamond: "bg-primary/20 text-primary",
      gold: "bg-warning/20 text-warning",
      silver: "bg-muted-foreground/20 text-muted-foreground",
      standard: "bg-secondary text-foreground",
    };
    const label = k === "diamond" ? "Diamond" : k === "gold" ? "Gold" : k === "silver" ? "Silver" : "Standard";
    return <span className={`text-xs px-2 py-0.5 rounded ${map[k]}`}>{label}</span>;
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
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Group</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Joined</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3">{u.email}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.display_name}</td>
                  <td className="px-5 py-3">{groupBadge((u as ProfileRow & { user_group?: string }).user_group)}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold">${Number(u.balance).toFixed(2)}</td>
                  <td className="px-5 py-3">{u.banned ? <span className="text-destructive">● Banned</span> : <span className="text-success">● Active</span>}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="neon" onClick={() => setEditUser(u)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCreditUser(u); setCreditAmount("10"); }}>Refill</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleBan(u)}>{u.banned ? "Unban" : "Ban"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setMakeAdminUser(u)}>Admin</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <AdminUserEditDialog
        user={editUser as unknown as EditableUser}
        onClose={() => setEditUser(null)}
        onSaved={load}
      />

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
type SupplierService = { action_code: string; name: string; credit: number | null; delivery_time: string | null };

type Category = { id: string; slug: string; name: string; sort_order: number };

function AdminServices() {
  const confirm = useConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [q, setQ] = useState("");
  const [fGroup, setFGroup] = useState<string>("all");
  const [fSvcId, setFSvcId] = useState<string>("all");
  const [supSvc, setSupSvc] = useState<SupplierService[]>([]);
  const [supSvcLoading, setSupSvcLoading] = useState(false);
  const [supSvcQ, setSupSvcQ] = useState("");
  const [supSvcOpen, setSupSvcOpen] = useState(false);

  const load = async () => {
    const [{ data: svc }, { data: sup }, { data: cats }] = await Promise.all([
      supabase.from("services").select("*").order("category").order("sort_order").order("name"),
      supabase.from("suppliers").select("id,name,type,endpoint_url,dhru_username,dhru_api_key,active,notes").order("name"),
      supabase.from("categories").select("id,slug,name,sort_order").order("sort_order").order("name"),
    ]);
    setServices((svc ?? []) as unknown as Service[]);
    setSuppliers((sup ?? []) as unknown as Supplier[]);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Load supplier's cached services whenever picked supplier changes in the editor
  useEffect(() => {
    const sid = editing?.supplier_id;
    if (!sid) { setSupSvc([]); setSupSvcQ(""); return; }
    setSupSvcLoading(true);
    supabase.from("supplier_services").select("action_code,name,credit,delivery_time").eq("supplier_id", sid).order("name").then(({ data }) => {
      setSupSvc((data ?? []) as SupplierService[]);
      setSupSvcLoading(false);
    });
  }, [editing?.supplier_id]);

  const filtered = useMemo(() => services.filter((s) => {
    if (fGroup !== "all" && (s.category ?? "") !== fGroup) return false;
    if (fSvcId !== "all" && s.id !== fSvcId) return false;
    if (q && !(s.name.toLowerCase().includes(q.toLowerCase()) || s.category?.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [services, q, fGroup, fSvcId]);

  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [services]);
  const serviceOptionsForGroup = useMemo(() => {
    return services.filter((s) => fGroup === "all" || (s.category ?? "") === fGroup);
  }, [services, fGroup]);

  const saveService = async () => {
    if (!editing) return;
    const usingSupplier = !!editing.supplier_id;
    const parsed = serviceSchema.safeParse({
      name: editing.name, description: editing.description, price: Number(editing.price),
      delivery_time: editing.delivery_time,
      // when using supplier, api_url is optional
      api_url: usingSupplier ? (editing.api_url || "https://supplier.local") : editing.api_url,
      api_method: editing.api_method,
      category: editing.category, active: editing.active,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const payload = {
      name: parsed.data.name, description: parsed.data.description ?? null, price: parsed.data.price,
      delivery_time: parsed.data.delivery_time,
      api_url: usingSupplier ? null : (parsed.data.api_url || null),
      api_method: parsed.data.api_method,
      api_request_body: editing.api_request_body ?? null, category: parsed.data.category ?? "general",
      active: parsed.data.active, is_free: !!editing.is_free, response_template: editing.response_template ?? null,
      sample_result: editing.sample_result?.trim() ? editing.sample_result : null,
      result_font: editing.result_font ?? "mono",
      result_color: editing.result_color ?? "#e2e8f0",
      success_rules: (editing.success_rules ?? []) as unknown as never,
      supplier_id: editing.supplier_id ?? null,
      supplier_action: editing.supplier_action || null,
    };
    const { error } = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };
  const delService = async (id: string) => {
    const ok = await confirm({ title: "Delete service?", description: "This service will be permanently removed.", confirmText: "Delete", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };
  const moveService = async (s: Service, dir: -1 | 1) => {
    // Reorder within the same category. Normalize sort_order across that category first.
    const group = services
      .filter((x) => (x.category ?? "") === (s.category ?? ""))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    const idx = group.findIndex((x) => x.id === s.id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= group.length) return;
    const reordered = [...group];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Persist new sort_order = position * 10 (gives room for future inserts)
    const updates = reordered.map((x, i) =>
      supabase.from("services").update({ sort_order: (i + 1) * 10 }).eq("id", x.id)
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) { toast.error(err.error.message); return; }
    load();
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
      <div className="glass rounded-2xl p-3 mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Group</Label>
          <Select value={fGroup} onValueChange={(v) => { setFGroup(v); setFSvcId("all"); }}>
            <SelectTrigger><SelectValue placeholder="All groups" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groupOptions.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Service</Label>
          <Select value={fSvcId} onValueChange={setFSvcId}>
            <SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {serviceOptionsForGroup.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.service_code ? `#${s.service_code} ` : ""}{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3 w-20">ID</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Delivery</th><th className="px-5 py-3">API</th><th className="px-5 py-3">Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3 font-mono font-semibold text-primary">{s.service_code ?? "—"}</td>
                  <td className="px-5 py-3 font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => setEditing(s)}>{s.name}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{s.category}</span></td>
                  <td className="px-5 py-3 font-mono">${Number(s.price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{s.delivery_time}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                    {s.supplier_id
                      ? <span className="text-primary">via {suppliers.find((x) => x.id === s.supplier_id)?.name ?? "supplier"}{s.supplier_action ? ` · #${s.supplier_action}` : ""}</span>
                      : (s.api_url || <span className="text-warning">⚠ not set</span>)}
                  </td>
                  <td className="px-5 py-3">{s.active ? <span className="text-success">● Active</span> : <span className="text-destructive">● Off</span>}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Move up" onClick={() => moveService(s, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" title="Move down" onClick={() => moveService(s, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => delService(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No services.</td></tr>}
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
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category ?? "general"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 && <SelectItem value="general">General</SelectItem>}
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Description</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!editing.name?.trim() || aiDescLoading}
                    onClick={async () => {
                      if (!editing.name?.trim()) { toast("Enter a service name first"); return; }
                      setAiDescLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("ai-describe-service", {
                          body: { name: editing.name, category: editing.category },
                        });
                        if (error) throw error;
                        const desc = (data as { description?: string; error?: string })?.description?.trim();
                        if (!desc) throw new Error((data as { error?: string })?.error || "No description returned");
                        setEditing({ ...editing, description: desc });
                        toast.success("Description generated");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to generate");
                      } finally {
                        setAiDescLoading(false);
                      }
                    }}
                  >
                    {aiDescLoading ? "Generating…" : "✨ Auto-fill from name"}
                  </Button>
                </div>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={500} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (USD)</Label><Input type="number" step="0.01" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Delivery Time</Label><Input value={editing.delivery_time ?? ""} onChange={(e) => setEditing({ ...editing, delivery_time: e.target.value })} maxLength={50} /></div>
              </div>
              {/* Supplier picker */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <Label className="text-sm font-bold text-primary">Supplier (optional)</Label>
                <p className="text-xs text-muted-foreground">Pick a saved supplier to route this service through. Leave as "None" to use a direct API URL below.</p>
                <div className="grid grid-cols-1 gap-2">
                  <Select
                    value={editing.supplier_id ?? "none"}
                    onValueChange={(v) => setEditing({ ...editing, supplier_id: v === "none" ? null : v, supplier_action: v === "none" ? null : editing.supplier_action })}
                  >
                    <SelectTrigger><SelectValue placeholder="None — use direct API URL" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None — use direct API URL</SelectItem>
                      {suppliers.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.name} ({sp.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editing.supplier_id && (
                    <div className="space-y-2">
                      <Label className="text-xs">Supplier service</Label>
                      {supSvcLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Loading supplier services…</div>
                      ) : supSvc.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/40">
                          No cached services for this supplier. Go to <b>Suppliers</b> → click <b>Sync</b>, then come back. You can also enter the service code manually below.
                          <Input className="mt-2" value={editing.supplier_action ?? ""} onChange={(e) => setEditing({ ...editing, supplier_action: e.target.value })} placeholder="Service code (e.g. 129)" />
                        </div>
                      ) : (() => {
                        const sel = supSvc.find((x) => x.action_code === editing.supplier_action);
                        if (!supSvcOpen && sel) {
                          return (
                            <button
                              type="button"
                              onClick={() => { setSupSvcOpen(true); setSupSvcQ(""); }}
                              className="w-full text-left rounded-md border border-primary/40 bg-background/50 px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-primary/10"
                            >
                              <span className="truncate"><span className="font-mono text-primary">#{sel.action_code}</span> {sel.name}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{sel.credit != null ? `${sel.credit} cr` : ""}{sel.delivery_time ? ` · ${sel.delivery_time}` : ""} · change ▾</span>
                            </button>
                          );
                        }
                        if (!supSvcOpen && !sel) {
                          return (
                            <button
                              type="button"
                              onClick={() => { setSupSvcOpen(true); setSupSvcQ(""); }}
                              className="w-full text-left rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10"
                            >
                              Select a synced service ({supSvc.length} available) ▾
                            </button>
                          );
                        }
                        return (
                          <>
                            <Input autoFocus value={supSvcQ} onChange={(e) => setSupSvcQ(e.target.value)} placeholder={`Search ${supSvc.length} synced services…`} />
                            <div className="max-h-56 overflow-y-auto rounded border border-border/50 bg-background/50">
                              {supSvc
                                .filter((s) => !supSvcQ || s.name.toLowerCase().includes(supSvcQ.toLowerCase()) || s.action_code.includes(supSvcQ))
                                .slice(0, 200)
                                .map((s) => {
                                  const selected = editing.supplier_action === s.action_code;
                                  return (
                                    <button
                                      key={s.action_code}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditing((prev) => ({
                                          ...prev,
                                          supplier_action: s.action_code,
                                          name: prev.name || s.name,
                                          delivery_time: prev.delivery_time && prev.delivery_time !== "Instant" ? prev.delivery_time : (s.delivery_time || "Instant"),
                                          price: prev.price && Number(prev.price) > 0 ? prev.price : (s.credit != null ? Number(s.credit) : prev.price),
                                        }));
                                        setSupSvcQ("");
                                        setSupSvcOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-1.5 text-xs flex justify-between gap-2 hover:bg-primary/10 ${selected ? "bg-primary/20 ring-1 ring-primary" : ""}`}
                                    >
                                      <span className="truncate"><span className="font-mono text-primary">#{s.action_code}</span> {s.name}</span>
                                      <span className="text-muted-foreground whitespace-nowrap">{s.credit != null ? `${s.credit} cr` : ""}{s.delivery_time ? ` · ${s.delivery_time}` : ""}</span>
                                    </button>
                                  );
                                })}
                            </div>
                            <div className="flex justify-end">
                              <button type="button" onClick={() => setSupSvcOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {!editing.supplier_id && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Label>API URL ({"{IMEI}"} placeholder)</Label><Input value={editing.api_url ?? ""} onChange={(e) => setEditing({ ...editing, api_url: e.target.value })} placeholder="https://provider.com/check.php?imei={IMEI}&key=XXX" /></div>
                  <div><Label>Method</Label>
                    <Select value={editing.api_method ?? "GET"} onValueChange={(v) => setEditing({ ...editing, api_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
              <div className="space-y-3">
                 <div>
                   <Label>Sample Result Preview</Label>
                   <Textarea
                     id="sample-result-textarea"
                     value={editing.sample_result ?? ""}
                     onChange={(e) => setEditing({ ...editing, sample_result: e.target.value })}
                     placeholder={"Model : IPHONE 11 128GB PURPLE [A2111] [IPHONE12,1]\nIMEI/SN : 356543109054733\nFind My iPhone : OFF"}
                     rows={6}
                     className="font-mono text-xs"
                   />
                   <p className="text-xs text-muted-foreground mt-1">
                     Select text in the box above, then pick a <b>color</b> or <b>font</b> below — it will apply to the selection automatically.
                   </p>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div>
                     <Label className="text-xs">Result Font (default / selection)</Label>
                     <select
                       value={editing.result_font ?? "mono"}
                       onChange={(e) => {
                         const newFont = e.target.value;
                         const ta = document.getElementById("sample-result-textarea") as HTMLTextAreaElement | null;
                         if (ta) {
                           const start = ta.selectionStart, end = ta.selectionEnd;
                           if (start !== end) {
                             const value = ta.value;
                             const sel = value.slice(start, end).replace(/\[\[f:[a-zA-Z]+\]\]|\[\[\/f\]\]/g, "");
                             const wrapped = `[[f:${newFont}]]${sel}[[/f]]`;
                             setEditing({ ...editing, sample_result: value.slice(0, start) + wrapped + value.slice(end) });
                             return;
                           }
                         }
                         setEditing({ ...editing, result_font: newFont });
                       }}
                       className="w-full bg-background border border-border/60 rounded px-2 py-2 text-sm"
                     >
                       {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                     </select>
                   </div>
                   <div>
                     <Label className="text-xs">Pick Color (auto-applies to selection)</Label>
                     <div className="flex gap-2 items-center">
                       <input
                         type="color"
                         value={editing.result_color ?? "#e2e8f0"}
                         onChange={(e) => {
                           const newColor = e.target.value;
                           const ta = document.getElementById("sample-result-textarea") as HTMLTextAreaElement | null;
                           if (ta) {
                             const start = ta.selectionStart, end = ta.selectionEnd;
                             if (start !== end) {
                               const value = ta.value;
                               const sel = value.slice(start, end).replace(/\[\[c:#?[0-9a-fA-F]{3,8}\]\]|\[\[\/c\]\]/g, "");
                               const wrapped = `[[c:${newColor}]]${sel}[[/c]]`;
                               setEditing({ ...editing, sample_result: value.slice(0, start) + wrapped + value.slice(end), result_color: newColor });
                               return;
                             }
                           }
                           setEditing({ ...editing, result_color: newColor });
                         }}
                         className="w-10 h-9 rounded border border-border/60 bg-transparent cursor-pointer"
                       />
                       <Input
                         value={editing.result_color ?? "#e2e8f0"}
                         onChange={(e) => setEditing({ ...editing, result_color: e.target.value })}
                         className="font-mono text-xs"
                         maxLength={9}
                       />
                     </div>
                   </div>
                 </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="neon" onClick={() => {
                    const ta = document.getElementById("sample-result-textarea") as HTMLTextAreaElement | null;
                    if (!ta) return;
                    const start = ta.selectionStart, end = ta.selectionEnd;
                    if (start === end) { toast("Select text first", { description: "Highlight a portion of the sample text, then click Apply color." }); return; }
                    const value = ta.value;
                    const sel = value.slice(start, end).replace(/\[\[c:#?[0-9a-fA-F]{3,8}\]\]|\[\[\/c\]\]/g, "");
                    const color = editing.result_color ?? "#e2e8f0";
                    const wrapped = `[[c:${color}]]${sel}[[/c]]`;
                    setEditing({ ...editing, sample_result: value.slice(0, start) + wrapped + value.slice(end) });
                  }}>Apply color to selection</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    const ta = document.getElementById("sample-result-textarea") as HTMLTextAreaElement | null;
                    if (!ta) return;
                    const start = ta.selectionStart, end = ta.selectionEnd;
                    if (start === end) { toast("Select text first"); return; }
                    const value = ta.value;
                    const sel = value.slice(start, end).replace(/\[\[c:#?[0-9a-fA-F]{3,8}\]\]|\[\[\/c\]\]/g, "");
                    setEditing({ ...editing, sample_result: value.slice(0, start) + sel + value.slice(end) });
                  }}>Clear color from selection</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ ...editing, sample_result: (editing.sample_result ?? "").replace(/\[\[c:#?[0-9a-fA-F]{3,8}\]\]|\[\[\/c\]\]/g, "") })}>Clear all colors</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ ...editing, sample_result: (editing.sample_result ?? "").replace(/\[\[f:[a-zA-Z]+\]\]|\[\[\/f\]\]/g, "") })}>Clear all fonts</Button>
                </div>
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
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Active</Label></div>
                <div className="flex items-center gap-3"><Switch checked={!!editing.is_free} onCheckedChange={(v) => setEditing({ ...editing, is_free: v })} /><Label>Free Check (show on Free Check page)</Label></div>
              </div>
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
  const confirm = useConfirm();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fOrderId, setFOrderId] = useState("");
  const [fImei, setFImei] = useState("");
  const [fUser, setFUser] = useState("all");
  const [fService, setFService] = useState("all");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<OrderRow | null>(null);

  const load = async () => {
    const [o, profs, svcs] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id,email"),
      supabase.from("services").select("id,name"),
    ]);
    const profMap = new Map((profs.data ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]));
    const svcMap = new Map((svcs.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    const enriched = (o.data ?? []).map((row: { user_id: string; service_id: string; [k: string]: unknown }) => ({
      ...row,
      profiles: { email: profMap.get(row.user_id) ?? null },
      services: { name: svcMap.get(row.service_id) ?? "—" },
    })) as unknown as OrderRow[];
    setOrders(enriched); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      const oid = String(o.order_number ?? "").padStart(4, "0");
      if (fOrderId.trim() && !oid.includes(fOrderId.trim().replace(/^#/, ""))) return false;
      if (fImei.trim() && !o.imei.toLowerCase().includes(fImei.trim().toLowerCase())) return false;
      if (fUser !== "all" && (o.profiles?.email ?? "") !== fUser) return false;
      if (fService !== "all" && (o.services?.name ?? "") !== fService) return false;
      if (fDateFrom && new Date(o.created_at) < new Date(fDateFrom)) return false;
      if (fDateTo && new Date(o.created_at) > new Date(fDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [orders, filter, fOrderId, fImei, fUser, fService, fDateFrom, fDateTo]);

  const userOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.profiles?.email) set.add(o.profiles.email);
    return Array.from(set).sort();
  }, [orders]);
  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.services?.name) set.add(o.services.name);
    return Array.from(set).sort();
  }, [orders]);

  const refundOrder = async (o: OrderRow) => {
    const ok = await confirm({ title: "Refund order?", description: `Refund $${Number(o.price_charged).toFixed(2)} back to the customer's wallet.`, confirmText: "Refund", tone: "warning" });
    if (!ok) return;
    const { error } = await supabase.functions.invoke("admin-refund-order", { body: { order_id: o.id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Refunded"); load();
  };

  return (
    <AdminLayout
      title="Orders"
      subtitle={`${orders.length} total orders`}
      actions={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_process">In process</SelectItem>
            <SelectItem value="completed">Success</SelectItem>
            <SelectItem value="failed">Rejected</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="glass rounded-2xl p-3 mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div><Label className="text-xs text-muted-foreground">Order ID</Label><Input value={fOrderId} onChange={(e) => setFOrderId(e.target.value)} placeholder="#0001" /></div>
        <div><Label className="text-xs text-muted-foreground">IMEI/SN</Label><Input value={fImei} onChange={(e) => setFImei(e.target.value)} placeholder="IMEI" /></div>
        <div>
          <Label className="text-xs text-muted-foreground">Client</Label>
          <Select value={fUser} onValueChange={setFUser}>
            <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {userOptions.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Service</Label>
          <Select value={fService} onValueChange={setFService}>
            <SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {serviceOptions.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} /></div>
        <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} /></div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Order ID</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI/SN</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Charged</th><th className="px-5 py-3">Date</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => setView(o)}>
                  <td className="px-5 py-3 font-mono text-xs">#{String(o.order_number ?? 0).padStart(4, "0")}</td>
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
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No orders.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <OrderEditDialog order={view} onClose={() => setView(null)} onSaved={load} onRefund={refundOrder} />
    </AdminLayout>
  );
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_process", label: "In process" },
  { value: "completed", label: "Success" },
  { value: "failed", label: "Rejected" },
  { value: "refunded", label: "Refunded" },
];

function OrderEditDialog({ order, onClose, onSaved, onRefund }: { order: OrderRow | null; onClose: () => void; onSaved: () => void; onRefund: (o: OrderRow) => void }) {
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [supplierRef, setSupplierRef] = useState<string | null>(null);
  const [services, setServices] = useState<{ id: string; name: string; supplier_id: string | null }[]>([]);
  const [switchServiceId, setSwitchServiceId] = useState<string>("");
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setResult(extractResponse(order.result ?? ""));
      setErrorMsg(order.error_message ?? "");
      setSwitchServiceId("");
      supabase.from("orders").select("supplier_reference,service_id").eq("id", order.id).maybeSingle()
        .then(({ data }) => { setSupplierRef((data as { supplier_reference: string | null } | null)?.supplier_reference ?? null); setSwitchServiceId((data as { service_id: string } | null)?.service_id ?? ""); });
      supabase.from("services").select("id,name,supplier_id").not("supplier_id", "is", null).order("name")
        .then(({ data }) => setServices((data ?? []) as { id: string; name: string; supplier_id: string | null }[]));
    }
  }, [order]);

  const save = async () => {
    if (!order) return;
    setSaving(true);
    const newStatus = status as "pending" | "completed" | "failed" | "refunded" | "in_process";
    const { error } = await supabase.from("orders").update({
      status: newStatus,
      result: result || null,
      error_message: errorMsg || null,
    }).eq("id", order.id);
    if (error) { setSaving(false); toast.error(error.message); return; }
    // Auto-refund when admin marks as Rejected (failed) or Refunded
    const shouldRefund = (newStatus === "failed" || newStatus === "refunded")
      && order.status !== "refunded"
      && Number(order.price_charged) > 0;
    if (shouldRefund) {
      const { error: rErr } = await supabase.functions.invoke("admin-refund-order", { body: { order_id: order.id } });
      if (rErr) { setSaving(false); toast.error("Saved, but refund failed: " + rErr.message); return; }
      toast.success("Order updated & refunded");
    } else {
      toast.success("Order updated");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const reprocess = async (overrideSvc?: string) => {
    if (!order) return;
    setReprocessing(true);
    const { data, error } = await supabase.functions.invoke("admin-reprocess-order", {
      body: { order_id: order.id, ...(overrideSvc ? { service_id: overrideSvc } : {}) },
    });
    setReprocessing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Re-submitted to supplier (ref ${(data as { supplier_reference?: string } | null)?.supplier_reference ?? "—"})`);
    onSaved(); onClose();
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader><DialogTitle>Edit Order {order && `#${String(order.order_number ?? 0).padStart(4, "0")}`}</DialogTitle></DialogHeader>
        {order && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">User</Label><div>{order.profiles?.email}</div></div>
              <div><Label className="text-xs">Service</Label><div>{order.services?.name}</div></div>
              <div><Label className="text-xs">IMEI</Label><div className="font-mono">{order.imei}</div></div>
              <div><Label className="text-xs">Charged</Label><div className="font-mono">${Number(order.price_charged).toFixed(2)}</div></div>
              <div><Label className="text-xs">Date</Label><div>{new Date(order.created_at).toLocaleString()}</div></div>
              <div><Label className="text-xs">Supplier Ref (admin only)</Label><div className="font-mono text-xs">{supplierRef ?? "—"}</div></div>
            </div>
            {order.status === "pending" && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-3">
                <div className="text-xs font-semibold text-warning">Pending — supplier action</div>
                {errorMsg && <div className="text-xs text-destructive">Last error: {errorMsg}</div>}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" variant="glass" onClick={() => reprocess()} disabled={reprocessing}>
                    {reprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reprocess (same API)
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                  <Select value={switchServiceId} onValueChange={setSwitchServiceId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Switch supplier API…" /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="hero" onClick={() => reprocess(switchServiceId)} disabled={reprocessing || !switchServiceId}>
                    Switch & Reprocess
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Result text</Label>
              <Textarea rows={8} value={result} onChange={(e) => setResult(e.target.value)} className="font-mono text-xs" placeholder="Result shown to the customer" />
            </div>
            <div>
              <Label>Error / rejection message</Label>
              <Textarea rows={3} value={errorMsg} onChange={(e) => setErrorMsg(e.target.value)} className="text-xs" placeholder="Optional" />
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-border/50">
              {order.status !== "refunded" && Number(order.price_charged) > 0 ? (
                <Button variant="ghost" onClick={() => onRefund(order)}><RotateCcw className="w-4 h-4 mr-1" /> Refund</Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="hero" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin w-4 h-4" /> : "Save"}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Transactions ---------- */
function AdminTransactions() {
  const [tx, setTx] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [t, profs] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id,email"),
      ]);
      const profMap = new Map((profs.data ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]));
      const enriched = (t.data ?? []).map((row: { user_id: string; [k: string]: unknown }) => ({
        ...row,
        profiles: { email: profMap.get(row.user_id) ?? null },
      })) as unknown as TxRow[];
      setTx(enriched); setLoading(false);
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
        <div className="glass rounded-2xl overflow-x-auto">
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
  const [sending, setSending] = useState<null | "users" | "channel" | "group">(null);
  const [channelId, setChannelId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("telegram_channel_id,telegram_group_id").eq("id", 1).maybeSingle();
      const r = data as unknown as { telegram_channel_id?: string | null; telegram_group_id?: string | null } | null;
      setChannelId(r?.telegram_channel_id ?? "");
      setGroupId(r?.telegram_group_id ?? "");
    })();
  }, []);

  const sendToUsers = async () => {
    if (!msg.trim()) return;
    setSending("users");
    const { data: profs } = await supabase.from("profiles").select("id,telegram_chat_id,notify_telegram").not("telegram_chat_id", "is", null);
    let sent = 0;
    for (const p of profs ?? []) {
      if (!p.notify_telegram) continue;
      try {
        await supabase.functions.invoke("telegram-notify", { body: { user_id: p.id, message: msg } });
        sent++;
      } catch (e) { /* skip */ }
    }
    toast.success(`Sent to ${sent} users`);
    setSending(null);
  };

  const sendToChat = async (chatId: string, label: string) => {
    if (!msg.trim()) return;
    if (!chatId.trim()) return toast.error(`No ${label} ID configured. Set it in Admin → Telegram Bot.`);
    setSending(label === "Channel" ? "channel" : "group");
    const { data, error } = await supabase.functions.invoke("telegram-notify", {
      body: { chat_id: chatId.trim(), message: msg },
    });
    setSending(null);
    if (error) return toast.error(error.message);
    if ((data as { ok?: boolean })?.ok) toast.success(`Sent to ${label}`);
    else toast.error(`Failed: ${JSON.stringify(data).slice(0, 200)}`);
  };

  return (
    <AdminLayout title="Notifications" subtitle="Send announcements via Telegram (Users / Channel / Group)">
      <div className="glass rounded-2xl p-6 max-w-2xl space-y-4">
        <div>
          <Label>Message</Label>
          <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi clients! New service added: …" />
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Button variant="hero" onClick={sendToUsers} disabled={!!sending || !msg.trim()}>
            {sending === "users" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Send to Users
          </Button>
          <Button variant="outline" onClick={() => sendToChat(channelId, "Channel")} disabled={!!sending || !msg.trim()}>
            {sending === "channel" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Send to Channel
          </Button>
          <Button variant="outline" onClick={() => sendToChat(groupId, "Group")} disabled={!!sending || !msg.trim()}>
            {sending === "group" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Send to Group
          </Button>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/40">
          <p><b>Users:</b> sends DM to each client who linked Telegram & enabled notifications.</p>
          <p><b>Channel / Group:</b> bot must be added as admin. Configure IDs in <b>Admin → Telegram Bot</b>.</p>
          <p>Channel ID: <code>{channelId || "— not set —"}</code> · Group ID: <code>{groupId || "— not set —"}</code></p>
        </div>
      </div>
    </AdminLayout>
  );
}

/* ---------- Settings ---------- */
function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [s, setS] = useState({
    brand_name: "", tagline: "", logo_url: "", favicon_url: "",
    seo_title: "", seo_description: "", seo_keywords: "",
    facebook_url: "", twitter_url: "", instagram_url: "", youtube_url: "",
    telegram_url: "", whatsapp_number: "",
    contact_email: "", contact_phone: "", address: "", footer_text: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        const r = data as unknown as Record<string, string | null>;
        setS({
          brand_name: r.brand_name ?? "", tagline: r.tagline ?? "", logo_url: r.logo_url ?? "", favicon_url: r.favicon_url ?? "",
          seo_title: r.seo_title ?? "", seo_description: r.seo_description ?? "", seo_keywords: r.seo_keywords ?? "",
          facebook_url: r.facebook_url ?? "", twitter_url: r.twitter_url ?? "", instagram_url: r.instagram_url ?? "", youtube_url: r.youtube_url ?? "",
          telegram_url: r.telegram_url ?? "", whatsapp_number: r.whatsapp_number ?? "",
          contact_email: r.contact_email ?? "", contact_phone: r.contact_phone ?? "", address: r.address ?? "", footer_text: r.footer_text ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof typeof s>(k: K, v: string) => setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === "" ? null : v])) as never;
    const { error } = await supabase.from("site_settings").update(payload).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Settings saved"); }
  };

  const uploadTo = async (field: "logo_url" | "favicon_url", file: File, prefix: string) => {
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    set(field, data.publicUrl);
    setUploading(false);
    toast.success("Uploaded — click Save to apply");
  };
  const onUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) await uploadTo("logo_url", file, "logo");
  };
  const onUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) await uploadTo("favicon_url", file, "favicon");
  };

  if (loading) return <AdminLayout title="Settings" subtitle="Platform configuration"><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout
      title="Settings"
      subtitle="Platform configuration"
      actions={<Button variant="hero" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}</Button>}
    >
      <div className="grid lg:grid-cols-2 gap-4 max-w-6xl">
        {/* Brand */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h3 className="font-bold">Brand</h3>
          <div><Label>Brand Name</Label><Input value={s.brand_name} onChange={(e) => set("brand_name", e.target.value)} placeholder="LIKKI UNLOCKING" /></div>
          <div><Label>Tagline</Label><Input value={s.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="#1 Direct Wholesale Supplier" /></div>
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3 mt-1">
              {s.logo_url && <img src={s.logo_url} alt="logo" className="h-10 bg-white rounded p-1" />}
              <Input type="file" accept="image/*" onChange={onUploadLogo} disabled={uploading} />
            </div>
            <Input className="mt-2" value={s.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="Or paste image URL" />
          </div>
          <div>
            <Label>Favicon (browser tab icon)</Label>
            <div className="flex items-center gap-3 mt-1">
              {s.favicon_url && <img src={s.favicon_url} alt="favicon" className="h-8 w-8 bg-white rounded p-1 object-contain" />}
              <Input type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg" onChange={onUploadFavicon} disabled={uploading} />
            </div>
            <Input className="mt-2" value={s.favicon_url} onChange={(e) => set("favicon_url", e.target.value)} placeholder="Or paste favicon URL (.png / .ico)" />
            <p className="text-xs text-muted-foreground mt-1">Recommended: square PNG, 32×32 or 64×64.</p>
          </div>
        </div>

        {/* SEO */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h3 className="font-bold">SEO</h3>
          <div><Label>Meta Title</Label><Input value={s.seo_title} onChange={(e) => set("seo_title", e.target.value)} placeholder="LIKKI UNLOCKING — IMEI Checks & Unlocks" /></div>
          <div><Label>Meta Description</Label><Textarea rows={3} value={s.seo_description} onChange={(e) => set("seo_description", e.target.value)} placeholder="Short site description (under 160 chars)" /></div>
          <div><Label>Keywords (comma separated)</Label><Input value={s.seo_keywords} onChange={(e) => set("seo_keywords", e.target.value)} placeholder="imei, unlock, icloud" /></div>
        </div>

        {/* Contact */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h3 className="font-bold">Contact / Admin Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={s.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="support@example.com" /></div>
            <div><Label>Phone</Label><Input value={s.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+1 555 1234" /></div>
          </div>
          <div><Label>Address</Label><Textarea rows={2} value={s.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>Footer Text</Label><Input value={s.footer_text} onChange={(e) => set("footer_text", e.target.value)} placeholder="Optional small print" /></div>
        </div>

        {/* Social */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h3 className="font-bold">Social & Floating Buttons</h3>
          <p className="text-xs text-muted-foreground">Telegram + WhatsApp show as floating buttons on every page (right-bottom corner).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4 [&_label]:text-xs [&_label]:font-medium [&_label]:whitespace-nowrap [&_label]:overflow-hidden [&_label]:text-ellipsis [&_label]:block">
            <div><Label>Telegram (@username or link)</Label><Input value={s.telegram_url} onChange={(e) => set("telegram_url", e.target.value)} placeholder="@likkiunlocking" /></div>
            <div><Label>WhatsApp Number</Label><Input value={s.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="+15551234567" /></div>
            <div><Label>Facebook URL</Label><Input value={s.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} placeholder="https://facebook.com/..." /></div>
            <div><Label>Instagram URL</Label><Input value={s.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." /></div>
            <div><Label>Twitter / X URL</Label><Input value={s.twitter_url} onChange={(e) => set("twitter_url", e.target.value)} placeholder="https://x.com/..." /></div>
            <div><Label>YouTube URL</Label><Input value={s.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} placeholder="https://youtube.com/@..." /></div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end max-w-6xl">
        <Button variant="hero" size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </AdminLayout>
  );
}

/* ---------- Suppliers ---------- */
function AdminSuppliers() {
  const confirm = useConfirm();
  const [list, setList] = useState<Supplier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ supplier: Supplier; services: Array<{ id: string; name: string; group?: string | null; price?: string | number | null; time?: string | null }>; action_used?: string } | null>(null);
  const [syncQ, setSyncQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setList((data ?? []) as unknown as Supplier[]);
    const { data: ss } = await supabase.from("supplier_services").select("supplier_id");
    const c: Record<string, number> = {};
    (ss ?? []).forEach((r: { supplier_id: string }) => { c[r.supplier_id] = (c[r.supplier_id] ?? 0) + 1; });
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.endpoint_url?.trim()) {
      toast.error("Name and endpoint URL are required"); return;
    }
    if (editing.type === "dhru" && (!editing.dhru_username || !editing.dhru_api_key)) {
      toast.error("Dhru suppliers need username + API key"); return;
    }
    if (editing.type === "ifree" && !editing.dhru_api_key) {
      toast.error("iFreeiCloud suppliers need an API key"); return;
    }
    if (editing.type === "goimeicheck" && !editing.dhru_api_key) {
      toast.error("GoIMEICheck suppliers need an API key"); return;
    }
    const payload = {
      name: editing.name.trim(),
      type: editing.type ?? "dhru",
      endpoint_url: editing.endpoint_url.trim(),
      dhru_username: editing.dhru_username || null,
      dhru_api_key: editing.dhru_api_key || null,
      active: editing.active ?? true,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  const del = async (id: string) => {
    const ok = await confirm({ title: "Delete supplier?", description: "Services using this supplier will fall back to direct API.", confirmText: "Delete", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const testDhru = async () => {
    if (!editing || editing.type !== "dhru") return;
    setTesting(true);
    try {
      const tryFmt = async (fmt: "classic" | "bulk") => {
        const params = new URLSearchParams();
        if (fmt === "bulk") {
          params.set("data", JSON.stringify({
            username: editing.dhru_username ?? "",
            apikey: editing.dhru_api_key ?? "",
            action: "accountinfo",
          }));
        } else {
          params.set("username", editing.dhru_username ?? "");
          params.set("apikey", editing.dhru_api_key ?? "");
          params.set("action", "accountinfo");
        }
        const resp = await fetch(editing.endpoint_url ?? "", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
        const text = await resp.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep */ }
        const p = parsed as Record<string, unknown> | null;
        const isAuthErr = p && (p.ERROR ?? p.error);
        return { ok: resp.ok && !isAuthErr, fmt, text, parsed: p };
      };
      let res = await tryFmt("classic");
      if (!res.ok) res = await tryFmt("bulk");
      if (res.ok) toast.success(`Connected via ${res.fmt} API: ${res.text.slice(0, 200)}`);
      else {
        const errArr = (res.parsed?.ERROR ?? res.parsed?.error) as Array<Record<string, unknown>> | Record<string, unknown> | undefined;
        const e = Array.isArray(errArr) ? errArr[0] : errArr;
        const msg = e ? String(e?.MESSAGE ?? e?.message ?? "Unknown") : res.text.slice(0, 200);
        toast.error("Auth failed: " + msg);
      }
    } catch (e) {
      toast.error("Failed: " + (e instanceof Error ? e.message : "unknown"));
    }
    setTesting(false);
  };

  const syncSupplier = async (s: Supplier) => {
    if (s.type !== "dhru") { toast.error("Sync only works for Dhru suppliers"); return; }
    setSyncing(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("supplier-sync", { body: { supplier_id: s.id } });
      if (error) throw new Error(error.message);
      const res = data as { count?: number; error?: string; raw_sample?: string; action_used?: string; services?: Array<{ id: string; name: string; group?: string | null; price?: string | number | null; time?: string | null }> };
      if (res.error) {
        toast.error(res.error + (res.raw_sample ? `\n\nRaw: ${res.raw_sample.slice(0, 200)}` : ""));
        return;
      }
      toast.success(`Synced ${res.count ?? 0} services from ${s.name}`);
      setSyncResult({ supplier: s, services: res.services ?? [], action_used: res.action_used });
      setSyncQ("");
      load();
    } catch (e) {
      toast.error("Sync failed: " + (e instanceof Error ? e.message : "unknown"));
    }
    setSyncing(null);
  };

  return (
    <AdminLayout
      title="Suppliers"
      subtitle={`${list.length} API providers configured`}
      actions={
        <Button variant="hero" onClick={() => setEditing({ name: "", type: "dhru", endpoint_url: "", dhru_username: "", dhru_api_key: "", active: true, notes: "" })}>
          <Plus className="w-4 h-4 mr-1" />New Supplier
        </Button>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Endpoint</th><th className="px-5 py-3">Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono uppercase">{s.type}</span></td>
                  <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[400px]">{s.endpoint_url}</td>
                  <td className="px-5 py-3">{s.active ? <span className="text-success">● Active</span> : <span className="text-destructive">● Off</span>}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {s.type === "dhru" && (
                      <>
                        {counts[s.id] != null && <span className="text-xs text-muted-foreground mr-2">{counts[s.id]} synced</span>}
                        <Button size="sm" variant="outline" className="mr-1" onClick={() => syncSupplier(s)} disabled={syncing === s.id}>
                          {syncing === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" />Sync</>}
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No suppliers yet. Add one to wire Dhru / GSM / custom providers once and reuse them across services.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Supplier</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. DHRU Main" maxLength={100} /></div>
                <div><Label>Type</Label>
                  <Select value={editing.type ?? "dhru"} onValueChange={(v) => {
                    const next = { ...editing, type: v as "dhru" | "generic" | "ifree" | "goimeicheck" };
                    if (v === "ifree" && !editing.endpoint_url) next.endpoint_url = "https://api.ifreeicloud.co.uk";
                    if (v === "goimeicheck" && !editing.endpoint_url) next.endpoint_url = "https://api.goimeicheck.com";
                    setEditing(next);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhru">Dhru Fusion (action API)</SelectItem>
                      <SelectItem value="ifree">iFreeiCloud (instant API)</SelectItem>
                      <SelectItem value="goimeicheck">GoIMEICheck (instant + async)</SelectItem>
                      <SelectItem value="generic">Generic HTTP API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <Input value={editing.endpoint_url ?? ""} onChange={(e) => setEditing({ ...editing, endpoint_url: e.target.value })}
                  placeholder={editing.type === "dhru" ? "https://yoursupplier.com/api/index.php" : editing.type === "ifree" ? "https://api.ifreeicloud.co.uk" : editing.type === "goimeicheck" ? "https://api.goimeicheck.com" : "https://api.provider.com/check?imei={IMEI}&action={ACTION}"} />
                <p className="text-xs text-muted-foreground mt-1">
                  {editing.type === "dhru"
                    ? "Dhru API base URL (POST endpoint). Service code per service is set in the Service editor."
                    : editing.type === "ifree"
                      ? "iFreeiCloud endpoint. Per-service Service ID is set in the Service editor (Supplier action = numeric service ID)."
                      : editing.type === "goimeicheck"
                        ? "GoIMEICheck base URL. Per-service Service ID goes in the Service editor (Supplier action = numeric service ID)."
                        : "Generic URL — supports {IMEI} and {ACTION} placeholders."}
                </p>
              </div>
              {editing.type === "dhru" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Username</Label><Input value={editing.dhru_username ?? ""} onChange={(e) => setEditing({ ...editing, dhru_username: e.target.value })} /></div>
                  <div><Label>API Key</Label><Input type="password" value={editing.dhru_api_key ?? ""} onChange={(e) => setEditing({ ...editing, dhru_api_key: e.target.value })} /></div>
                </div>
              )}
              {editing.type === "ifree" && (
                <div><Label>API Key</Label><Input type="password" value={editing.dhru_api_key ?? ""} onChange={(e) => setEditing({ ...editing, dhru_api_key: e.target.value })} placeholder="Your iFreeiCloud key (e.g. 28A-MNX-...)" /></div>
              )}
              {editing.type === "goimeicheck" && (
                <div><Label>API Key</Label><Input type="password" value={editing.dhru_api_key ?? ""} onChange={(e) => setEditing({ ...editing, dhru_api_key: e.target.value })} placeholder="Your GoIMEICheck api_key" /></div>
              )}
              <div><Label>Notes</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Internal notes (rate limits, contact, etc.)" /></div>
              <div className="flex items-center gap-3"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Active</Label></div>
              <div className="flex justify-between pt-3">
                {editing.type === "dhru"
                  ? <Button variant="outline" onClick={testDhru} disabled={testing}>{testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Test connection</Button>
                  : <span />}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button variant="hero" onClick={save}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!syncResult} onOpenChange={(o) => !o && setSyncResult(null)}>
        <DialogContent className="glass max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{syncResult?.supplier.name} — {syncResult?.services.length} services synced</DialogTitle>
            {syncResult?.action_used && <p className="text-xs text-muted-foreground">via Dhru action <code className="px-1 bg-secondary/50 rounded">{syncResult.action_used}</code></p>}
          </DialogHeader>
          {syncResult && (
            <div className="space-y-3 overflow-hidden flex flex-col flex-1">
              <Input placeholder={`Search ${syncResult.services.length} services…`} value={syncQ} onChange={(e) => setSyncQ(e.target.value)} />
              <div className="rounded-xl border border-border/50 overflow-y-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-left uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResult.services
                      .filter((sv) => !syncQ || sv.name.toLowerCase().includes(syncQ.toLowerCase()) || sv.id.includes(syncQ) || (sv.group ?? "").toLowerCase().includes(syncQ.toLowerCase()))
                      .map((sv) => (
                        <tr key={sv.id} className="border-t border-border/50 hover:bg-secondary/20">
                          <td className="px-3 py-1.5 font-mono text-primary">{sv.id}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{sv.group ?? "—"}</td>
                          <td className="px-3 py-1.5">{sv.name}</td>
                          <td className="px-3 py-1.5 text-right">{sv.price ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{sv.time ?? "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">These are now cached. Open <b>Services → New / Edit</b>, pick this supplier, and you'll see the searchable list.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}

/* ---------- Categories ---------- */
function AdminCategories() {
  const confirm = useConfirm();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("categories").select("id,slug,name,sort_order").order("sort_order").order("name");
    setCats((data ?? []) as Category[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = async () => {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) { toast.error("Name is required"); return; }
    const slug = (editing.slug?.trim() || slugify(name));
    if (!slug) { toast.error("Invalid slug"); return; }
    const payload = { name, slug, sort_order: Number(editing.sort_order ?? 0) };
    const { error } = editing.id
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  const del = async (c: Category) => {
    const ok = await confirm({ title: `Delete category "${c.name}"?`, description: `Services in this category will keep the slug "${c.slug}" but it will no longer appear in the dropdown.`, confirmText: "Delete", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const moveCat = async (c: Category, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    const idx = sorted.findIndex((x) => x.id === c.id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const results = await Promise.all(reordered.map((x, i) =>
      supabase.from("categories").update({ sort_order: (i + 1) * 10 }).eq("id", x.id)
    ));
    const err = results.find((r) => r.error);
    if (err?.error) { toast.error(err.error.message); return; }
    load();
  };

  return (
    <AdminLayout
      title="Categories"
      subtitle={`${cats.length} categories`}
      actions={
        <Button variant="hero" onClick={() => setEditing({ name: "", slug: "", sort_order: 0 })}>
          <Plus className="w-4 h-4 mr-1" />New Category
        </Button>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Slug</th><th className="px-5 py-3">Sort</th><th></th></tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-primary">{c.slug}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.sort_order}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Move up" onClick={() => moveCat(c, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" title="Move down" onClick={() => moveCat(c, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {cats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      }

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Category</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ""} maxLength={50}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={editing.slug ?? ""} maxLength={50}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">Used as the value stored on services. Lowercase, dashes only.</p>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="hero" onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------- Telegram Bot page ---------- */
function AdminTelegramBot() {
  const [testChatId, setTestChatId] = useState("");
  const [testing, setTesting] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [savingIds, setSavingIds] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("telegram_channel_id,telegram_group_id").eq("id", 1).maybeSingle();
      const r = data as unknown as { telegram_channel_id?: string | null; telegram_group_id?: string | null } | null;
      setChannelId(r?.telegram_channel_id ?? "");
      setGroupId(r?.telegram_group_id ?? "");
    })();
  }, []);

  const saveIds = async () => {
    setSavingIds(true);
    const { error } = await supabase.from("site_settings").update({
      telegram_channel_id: channelId.trim() || null,
      telegram_group_id: groupId.trim() || null,
    }).eq("id", 1);
    setSavingIds(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const sendTestTelegram = async () => {
    if (!testChatId.trim()) return toast.error("Enter a chat ID");
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("telegram-notify", {
      body: { chat_id: testChatId.trim(), subject: "Test", message: "✅ Telegram is wired up correctly." },
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    if ((data as { ok?: boolean })?.ok) toast.success("Test sent — check Telegram");
    else toast.error("Failed: " + JSON.stringify(data));
  };

  return (
    <AdminLayout title="Telegram Bot" subtitle="Configure broadcast targets and test the bot connection">
      <div className="glass rounded-2xl p-6 space-y-4 max-w-2xl">
        <h3 className="font-bold">Broadcast targets</h3>
        <p className="text-sm text-muted-foreground">
          Add the bot as an <b>admin</b> in your channel/group, then paste the chat ID here.
          Channel IDs usually start with <code>-100…</code>. Group IDs start with <code>-…</code>.
        </p>
        <div>
          <Label>Telegram Channel ID</Label>
          <Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="-1001234567890" />
        </div>
        <div>
          <Label>Telegram Group ID</Label>
          <Input value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="-987654321" />
        </div>
        <Button onClick={saveIds} disabled={savingIds}>
          {savingIds ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save IDs
        </Button>

        <div className="space-y-2 pt-4 border-t border-border/40">
          <h3 className="font-bold">Personal chats</h3>
          <p className="text-sm text-muted-foreground">Clients link their account in Dashboard → Notifications (pairing code).</p>
        </div>

        <div className="space-y-2 pt-4 border-t border-border/40">
          <Label className="text-xs">Send test message to chat ID</Label>
          <div className="flex gap-2">
            <Input placeholder="123456789" value={testChatId} onChange={(e) => setTestChatId(e.target.value)} />
            <Button size="sm" onClick={sendTestTelegram} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


/* ---------- Router ---------- */
import AdminEmailSettings from "./AdminEmailSettings";
import AdminPayments from "./AdminPayments";
import AdminTurnstile from "./AdminTurnstile";
export default function Admin() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="payments" element={<AdminPayments />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="suppliers" element={<AdminSuppliers />} />
      <Route path="categories" element={<AdminCategories />} />
      <Route path="services" element={<AdminServices />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="transactions" element={<AdminTransactions />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="telegram-bot" element={<AdminTelegramBot />} />
      <Route path="api-providers" element={<AdminSuppliers />} />
      <Route path="email-settings" element={<AdminEmailSettings />} />
      <Route path="turnstile" element={<AdminTurnstile />} />
      <Route path="settings" element={<AdminSettings />} />
    </Routes>
  );
}
