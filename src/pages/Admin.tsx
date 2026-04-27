import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Users, Briefcase, ListOrdered, ShieldCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { serviceSchema } from "@/lib/validation";

type SuccessRule = { path: string; op: "eq" | "neq" | "contains" | "not_contains" | "exists" | "truthy"; value?: string | number | boolean };
type Service = { id: string; name: string; description: string | null; price: number; delivery_time: string; api_url: string | null; api_method: string; api_request_body: string | null; response_template: string | null; active: boolean; category: string | null; success_rules: SuccessRule[] | null };
type ProfileRow = { id: string; email: string | null; display_name: string | null; balance: number; banned: boolean; created_at: string };
type OrderRow = { id: string; user_id: string; imei: string; status: string; price_charged: number; result: string | null; error_message: string | null; created_at: string; services: { name: string } | null; profiles: { email: string | null } | null };

const empty: Partial<Service> = { name: "", description: "", price: 0, delivery_time: "Instant", api_url: "", api_method: "GET", api_request_body: "", response_template: "", active: true, category: "general", success_rules: [] };

export default function Admin() {
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [creditUser, setCreditUser] = useState<ProfileRow | null>(null);
  const [creditAmount, setCreditAmount] = useState("0");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [s, u, o] = await Promise.all([
      supabase.from("services").select("*").order("category").order("name"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*, services(name), profiles!orders_user_id_fkey(email)").order("created_at", { ascending: false }).limit(100),
    ]);
    setServices((s.data ?? []) as unknown as Service[]);
    setUsers((u.data ?? []) as ProfileRow[]);
    setOrders((o.data ?? []) as unknown as OrderRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveService = async () => {
    if (!editing) return;
    const parsed = serviceSchema.safeParse({
      name: editing.name, description: editing.description, price: Number(editing.price),
      delivery_time: editing.delivery_time, api_url: editing.api_url, api_method: editing.api_method,
      category: editing.category, active: editing.active,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    const payload = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      delivery_time: parsed.data.delivery_time,
      api_url: parsed.data.api_url || null,
      api_method: parsed.data.api_method,
      api_request_body: editing.api_request_body ?? null,
      category: parsed.data.category ?? "general",
      active: parsed.data.active,
      response_template: editing.response_template ?? null,
      success_rules: (editing.success_rules ?? []) as unknown as never,
    };
    const { error } = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  const updateRule = (idx: number, patch: Partial<SuccessRule>) => {
    if (!editing) return;
    const rules = [...(editing.success_rules ?? [])];
    rules[idx] = { ...rules[idx], ...patch } as SuccessRule;
    setEditing({ ...editing, success_rules: rules });
  };
  const addRule = () => {
    if (!editing) return;
    const rules = [...(editing.success_rules ?? []), { path: "success", op: "truthy" as const }];
    setEditing({ ...editing, success_rules: rules });
  };
  const removeRule = (idx: number) => {
    if (!editing) return;
    const rules = [...(editing.success_rules ?? [])];
    rules.splice(idx, 1);
    setEditing({ ...editing, success_rules: rules });
  };

  const delService = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const adjustCredit = async (delta: number) => {
    if (!creditUser) return;
    const { error } = await supabase.functions.invoke("admin-adjust-balance", {
      body: { user_id: creditUser.id, amount: delta, description: delta > 0 ? "Admin credit" : "Admin debit" },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Updated"); setCreditUser(null); setCreditAmount("0"); load();
  };

  const toggleBan = async (u: ProfileRow) => {
    const { error } = await supabase.from("profiles").update({ banned: !u.banned }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(u.banned ? "User unbanned" : "User banned"); load();
  };

  const refundOrder = async (o: OrderRow) => {
    if (!confirm(`Refund $${Number(o.price_charged).toFixed(2)} to user?`)) return;
    const { error } = await supabase.functions.invoke("admin-refund-order", { body: { order_id: o.id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Refunded"); load();
  };

  const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground" } as Record<string, string>)[s] ?? "";

  return (
    <Layout>
      <div className="container py-10">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground text-sm">Manage services, users, and orders.</p>
          </div>
        </div>

        <Tabs defaultValue="services">
          <TabsList className="glass">
            <TabsTrigger value="services"><Briefcase className="w-4 h-4 mr-2" />Services</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="orders"><ListOrdered className="w-4 h-4 mr-2" />Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button variant="hero" onClick={() => setEditing({ ...empty })}><Plus className="w-4 h-4" />New Service</Button>
            </div>
            {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> :
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left">
                  <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Delivery</th><th className="px-5 py-3">API</th><th className="px-5 py-3">Active</th><th></th></tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id} className="border-t border-border/50">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 font-mono text-xs">{s.category}</td>
                      <td className="px-5 py-3 font-mono">${Number(s.price).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.delivery_time}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{s.api_url || <span className="text-warning">not set</span>}</td>
                      <td className="px-5 py-3">{s.active ? <span className="text-success">●</span> : <span className="text-destructive">●</span>}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delService(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </TabsContent>

          <TabsContent value="users" className="mt-5">
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left">
                  <tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Name</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Status</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border/50">
                      <td className="px-5 py-3">{u.email}</td>
                      <td className="px-5 py-3">{u.display_name}</td>
                      <td className="px-5 py-3 text-right font-mono">${Number(u.balance).toFixed(2)}</td>
                      <td className="px-5 py-3">{u.banned ? <span className="text-destructive">Banned</span> : <span className="text-success">Active</span>}</td>
                      <td className="px-5 py-3 text-right space-x-1">
                        <Button size="sm" variant="neon" onClick={() => { setCreditUser(u); setCreditAmount("10"); }}>Adjust Balance</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleBan(u)}>{u.banned ? "Unban" : "Ban"}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-5">
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left">
                  <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">IMEI</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Charged</th><th className="px-5 py-3">Date</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-border/50">
                      <td className="px-5 py-3 text-xs">{o.profiles?.email}</td>
                      <td className="px-5 py-3">{o.services?.name}</td>
                      <td className="px-5 py-3 font-mono text-xs">{o.imei}</td>
                      <td className={`px-5 py-3 capitalize ${statusColor(o.status)}`}>{o.status}</td>
                      <td className="px-5 py-3 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        {o.status !== "refunded" && Number(o.price_charged) > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => refundOrder(o)}><RotateCcw className="w-3 h-3 mr-1" />Refund</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit service dialog */}
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
                <div className="col-span-2"><Label>API URL (use {"{IMEI}"} placeholder)</Label><Input value={editing.api_url ?? ""} onChange={(e) => setEditing({ ...editing, api_url: e.target.value })} placeholder="https://provider.com/check.php?imei={IMEI}&key=XXX" /></div>
                <div><Label>Method</Label>
                  <Select value={editing.api_method ?? "GET"} onValueChange={(v) => setEditing({ ...editing, api_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {editing.api_method === "POST" && (
                <div>
                  <Label>POST Request Body Template (optional)</Label>
                  <Textarea value={editing.api_request_body ?? ""} onChange={(e) => setEditing({ ...editing, api_request_body: e.target.value })} placeholder='e.g. {"username":"x","apikey":"y","service":1,"imei":"{IMEI}"}' rows={3} className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground mt-1">Use {"{IMEI}"} placeholder. JSON or URL-encoded — set Content-Type via headers.</p>
                </div>
              )}
              <div>
                <Label>Response Template (optional, leave blank to return raw provider response)</Label>
                <Textarea value={editing.response_template ?? ""} onChange={(e) => setEditing({ ...editing, response_template: e.target.value })} placeholder="e.g. Model: {model}\nIMEI: {imei}" rows={3} />
                <p className="text-xs text-muted-foreground mt-1">Use {"{field}"} or {"{nested.field}"} to insert response values.</p>
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Success Rules</Label>
                    <p className="text-xs text-muted-foreground">All rules must pass. If none defined, any HTTP 200 = success.</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={addRule}><Plus className="w-3 h-3 mr-1" />Add Rule</Button>
                </div>
                {(editing.success_rules ?? []).length === 0 && <p className="text-xs text-muted-foreground italic">No rules — accepting any 200 response.</p>}
                {(editing.success_rules ?? []).map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4 font-mono text-xs" placeholder="JSON path (e.g. success or data.status)" value={r.path} onChange={(e) => updateRule(i, { path: e.target.value })} />
                    <Select value={r.op} onValueChange={(v) => updateRule(i, { op: v as SuccessRule["op"] })}>
                      <SelectTrigger className="col-span-3 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truthy">is truthy</SelectItem>
                        <SelectItem value="exists">exists</SelectItem>
                        <SelectItem value="eq">equals</SelectItem>
                        <SelectItem value="neq">not equals</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="not_contains">not contains</SelectItem>
                      </SelectContent>
                    </Select>
                    {(r.op === "eq" || r.op === "neq" || r.op === "contains" || r.op === "not_contains") ? (
                      <Input className="col-span-4 font-mono text-xs" placeholder="value" value={String(r.value ?? "")} onChange={(e) => updateRule(i, { value: e.target.value })} />
                    ) : <div className="col-span-4" />}
                    <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => removeRule(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="hero" onClick={saveService}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust balance */}
      <Dialog open={!!creditUser} onOpenChange={(o) => !o && setCreditUser(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Adjust balance: {creditUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current: <span className="font-mono font-bold">${Number(creditUser?.balance ?? 0).toFixed(2)}</span></p>
            <div><Label>Amount (USD)</Label><Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button variant="hero" className="flex-1" onClick={() => adjustCredit(Number(creditAmount))}>Add Credit</Button>
              <Button variant="destructive" className="flex-1" onClick={() => adjustCredit(-Math.abs(Number(creditAmount)))}>Deduct</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
