import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Save, User as UserIcon, MapPin, Crown, MessageSquare, Layers, ShoppingBag, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EditableUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  balance: number;
  banned: boolean;
  user_group?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  api_enabled?: boolean | null;
  custom_message?: string | null;
};

type Service = { id: string; service_code: string | null; name: string; price: number; silver_price: number | null; gold_price: number | null; diamond_price: number | null; category: string | null; active: boolean };
type Override = { service_id: string; enabled: boolean; custom_price: number | null };
export type UserOrderRow = {
  id: string;
  order_number: number | null;
  service_id: string;
  imei: string;
  status: string;
  price_charged: number;
  created_at: string;
  result: string | null;
  error_message: string | null;
  service_name?: string;
};

const statusColor = (s: string) => ({ completed: "text-success", failed: "text-destructive", refunded: "text-warning", pending: "text-muted-foreground", in_process: "text-primary" } as Record<string, string>)[s] ?? "";

export default function AdminUserEditDialog({ user, onClose, onSaved, onEditOrder }: { user: EditableUser | null; onClose: () => void; onSaved: () => void; onEditOrder?: (order: UserOrderRow) => void }) {
  const [form, setForm] = useState<EditableUser | null>(user);
  const [services, setServices] = useState<Service[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [orders, setOrders] = useState<UserOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: number; amount: number; currency: string; coin: string | null; status: string; issued_at: string; provider: string }>>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [svcQuery, setSvcQuery] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const sendCustomEmail = async (kind: "welcome" | "custom") => {
    if (!user?.email) { toast.error("Client has no email"); return; }
    setSendingEmail(true);
    try {
      const templateName = kind === "welcome" ? "welcome" : "admin-custom";
      const templateData = kind === "welcome"
        ? { name: user.display_name ?? "" }
        : { name: user.display_name ?? "", email: user.email, heading: emailSubject || undefined, body: emailBody, subject: emailSubject || `A message from us` };
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName,
          recipientEmail: user.email,
          idempotencyKey: `admin-${kind}-${user.id}-${Date.now()}`,
          templateData,
        },
      });
      if (error) throw error;
      toast.success("Email sent");
      if (kind === "custom") { setEmailBody(""); setEmailSubject(""); }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => { setForm(user); }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingSvc(true);
    Promise.all([
      supabase.from("services").select("id,service_code,name,price,silver_price,gold_price,diamond_price,category,active").order("category").order("sort_order").order("name"),
      supabase.from("user_service_overrides").select("service_id,enabled,custom_price").eq("user_id", user.id),
    ]).then(([s, o]) => {
      setServices((s.data ?? []) as Service[]);
      const m: Record<string, Override> = {};
      for (const r of (o.data ?? []) as Override[]) m[r.service_id] = r;
      setOverrides(m);
      setLoadingSvc(false);
    });
  }, [user?.id]);

  const loadOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    const [ordRes, svcRes] = await Promise.all([
      supabase.from("orders").select("id,order_number,service_id,imei,status,price_charged,created_at,result,error_message").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("services").select("id,name"),
    ]);
    const svcMap = new Map((svcRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    const rows = ((ordRes.data ?? []) as UserOrderRow[]).map((r) => ({ ...r, service_name: svcMap.get(r.service_id) ?? "—" }));
    setOrders(rows);
    setLoadingOrders(false);
  };
  useEffect(() => { setOrders([]); if (user) loadOrders(); }, [user?.id]);

  const loadInvoices = async () => {
    if (!user) return;
    setLoadingInvoices(true);
    const { data } = await supabase
      .from("invoices")
      .select("id,invoice_number,amount,currency,coin,status,issued_at,provider")
      .eq("user_id", user.id)
      .order("invoice_number", { ascending: false });
    setInvoices((data ?? []) as any);
    setLoadingInvoices(false);
  };
  useEffect(() => { setInvoices([]); if (user) loadInvoices(); }, [user?.id]);


  const setField = <K extends keyof EditableUser>(k: K, v: EditableUser[K]) =>
    setForm((f) => f ? { ...f, [k]: v } : f);

  const grp = String(form?.user_group ?? "standard").toLowerCase();
  const groupPriceFor = (s: Service) => {
    if (grp === "silver" && s.silver_price != null) return Number(s.silver_price);
    if (grp === "gold" && s.gold_price != null) return Number(s.gold_price);
    if (grp === "diamond" && s.diamond_price != null) return Number(s.diamond_price);
    return Number(s.price);
  };

  const setOverride = (serviceId: string, patch: Partial<Override>) => {
    setOverrides((o) => ({ ...o, [serviceId]: { service_id: serviceId, enabled: o[serviceId]?.enabled ?? true, custom_price: o[serviceId]?.custom_price ?? null, ...patch } }));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error: pErr } = await supabase.from("profiles").update({
      display_name: form.display_name, email: form.email,
      user_group: form.user_group ?? "standard",
      phone: form.phone, address: form.address, city: form.city, state: form.state,
      country: form.country, pincode: form.pincode,
      api_enabled: form.api_enabled ?? true,
      custom_message: form.custom_message,
    }).eq("id", form.id);
    if (pErr) { setSaving(false); toast.error(pErr.message); return; }

    // Upsert overrides that diverge from defaults; delete plain rows (enabled+no price)
    const toUpsert: any[] = [];
    const toDelete: string[] = [];
    for (const ov of Object.values(overrides)) {
      const isDefault = ov.enabled && (ov.custom_price == null || isNaN(Number(ov.custom_price)));
      if (isDefault) toDelete.push(ov.service_id);
      else toUpsert.push({ user_id: form.id, service_id: ov.service_id, enabled: ov.enabled, custom_price: ov.custom_price });
    }
    if (toUpsert.length) {
      const { error } = await supabase.from("user_service_overrides").upsert(toUpsert, { onConflict: "user_id,service_id" });
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    if (toDelete.length) {
      await supabase.from("user_service_overrides").delete().eq("user_id", form.id).in("service_id", toDelete);
    }
    setSaving(false);
    toast.success("User updated");
    onSaved();
    onClose();
  };

  const filteredSvcs = services.filter((s) => {
    const q = svcQuery.toLowerCase().trim();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q) || (s.service_code ?? "").includes(q);
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" /> Edit User — {form?.email}
          </DialogTitle>
        </DialogHeader>
        {!form ? <Loader2 className="animate-spin mx-auto" /> : (
          <Tabs defaultValue="profile">
            <TabsList className="glass flex-wrap h-auto">
              <TabsTrigger value="profile"><UserIcon className="w-4 h-4 mr-1" /> Profile</TabsTrigger>
              <TabsTrigger value="address"><MapPin className="w-4 h-4 mr-1" /> Address</TabsTrigger>
              <TabsTrigger value="group"><Crown className="w-4 h-4 mr-1" /> Group & API</TabsTrigger>
              <TabsTrigger value="services"><Layers className="w-4 h-4 mr-1" /> Services</TabsTrigger>
              <TabsTrigger value="orders"><ShoppingBag className="w-4 h-4 mr-1" /> Orders</TabsTrigger>
              <TabsTrigger value="invoices"><FileText className="w-4 h-4 mr-1" /> Invoices</TabsTrigger>
              <TabsTrigger value="message"><MessageSquare className="w-4 h-4 mr-1" /> Message</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Display name</Label><Input value={form.display_name ?? ""} onChange={(e) => setField("display_name", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setField("email", e.target.value)} /></div>
                <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} /></div>
                <div><Label>Balance (USD)</Label><Input value={`$${Number(form.balance).toFixed(2)}`} disabled /></div>
              </div>
              <p className="text-xs text-muted-foreground">Use the Refill button to change balance.</p>
            </TabsContent>

            <TabsContent value="address" className="mt-4 space-y-4">
              <div><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setField("city", e.target.value)} /></div>
                <div><Label>State</Label><Input value={form.state ?? ""} onChange={(e) => setField("state", e.target.value)} /></div>
                <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setField("country", e.target.value)} /></div>
                <div><Label>Pincode</Label><Input value={form.pincode ?? ""} onChange={(e) => setField("pincode", e.target.value)} /></div>
              </div>
            </TabsContent>

            <TabsContent value="group" className="mt-4 space-y-4">
              <div>
                <Label>Client Group</Label>
                <Select value={form.user_group ?? "standard"} onValueChange={(v) => setField("user_group", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Discount auto-applied to base service prices (custom prices below override this).</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <div>
                  <div className="font-semibold">API Access</div>
                  <div className="text-xs text-muted-foreground">When disabled, this user's API key cannot place checks.</div>
                </div>
                <Switch checked={form.api_enabled ?? true} onCheckedChange={(v) => setField("api_enabled", v)} />
              </div>
            </TabsContent>

            <TabsContent value="services" className="mt-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search services…" value={svcQuery} onChange={(e) => setSvcQuery(e.target.value)} />
              </div>
              {loadingSvc ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div> : (
                <div className="border border-border/50 rounded-lg divide-y divide-border/50 max-h-[50vh] overflow-y-auto">
                  {filteredSvcs.map((s) => {
                    const ov = overrides[s.id];
                    const enabled = ov?.enabled ?? true;
                    const groupPrice = +groupPriceFor(s).toFixed(2);
                    const effective = ov?.custom_price != null ? Number(ov.custom_price) : groupPrice;
                    const hasGroupPrice = groupPrice !== Number(s.price);
                    return (
                      <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.service_code && <span className="font-mono mr-2">#{s.service_code}</span>}
                            <span>Base ${Number(s.price).toFixed(2)}</span>
                            {hasGroupPrice && <span className="ml-2">→ {grp} ${groupPrice.toFixed(2)}</span>}
                            <span className="ml-2 text-success">Effective ${effective.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" step="0.001" placeholder="Custom $"
                            className="w-28"
                            value={ov?.custom_price ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOverride(s.id, { custom_price: v === "" ? null : Number(v) });
                            }}
                          />
                          <div className="flex items-center gap-1">
                            <Switch checked={enabled} onCheckedChange={(v) => setOverride(s.id, { enabled: v })} />
                            <span className="text-xs text-muted-foreground w-14">{enabled ? "Active" : "Disabled"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredSvcs.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No services.</div>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="mt-4 space-y-3">
              {loadingOrders ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>
              ) : orders.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm border border-border/50 rounded-lg">No orders for this client.</div>
              ) : (
                <div className="border border-border/50 rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-left uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Service</th>
                        <th className="px-3 py-2">IMEI/SN</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Charged</th>
                        <th className="px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr
                          key={o.id}
                          className={`border-t border-border/40 ${onEditOrder ? "cursor-pointer hover:bg-secondary/30" : ""}`}
                          onClick={() => onEditOrder?.(o)}
                        >
                          <td className="px-3 py-2 font-mono">#{String(o.order_number ?? 0).padStart(4, "0")}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={o.service_name}>{o.service_name}</td>
                          <td className="px-3 py-2 font-mono">{o.imei}</td>
                          <td className={`px-3 py-2 capitalize ${statusColor(o.status)}`}>{o.status}</td>
                          <td className="px-3 py-2 text-right font-mono">${Number(o.price_charged).toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Click any order to open its edit view.</p>
            </TabsContent>

            <TabsContent value="invoices" className="mt-4 space-y-3">
              {loadingInvoices ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>
              ) : invoices.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm border border-border/50 rounded-lg">No invoices for this client.</div>
              ) : (
                <div className="border border-border/50 rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-left uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Provider</th>
                        <th className="px-3 py-2">Coin</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((i) => (
                        <tr
                          key={i.id}
                          className="border-t border-border/40 cursor-pointer hover:bg-secondary/30"
                          onClick={() => { window.open(`/admin/invoices?open=${i.id}`, "_blank"); }}
                        >
                          <td className="px-3 py-2 font-mono">INV-{String(i.invoice_number).padStart(5, "0")}</td>
                          <td className="px-3 py-2 capitalize">{i.provider}</td>
                          <td className="px-3 py-2">{i.coin ?? i.currency}</td>
                          <td className="px-3 py-2 text-right font-mono">${Number(i.amount).toFixed(2)}</td>
                          <td className={`px-3 py-2 capitalize ${statusColor(i.status)}`}>{i.status}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(i.issued_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Click any invoice to open it in the Invoices page for editing.</p>
            </TabsContent>

            <TabsContent value="message" className="mt-4 space-y-3">
              <Label>Custom dashboard message</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Name", token: "{{name}}" },
                  { label: "Email", token: "{{email}}" },
                  { label: "Balance", token: "{{balance}}" },
                  { label: "Group", token: "{{group}}" },
                ].map((v) => (
                  <Button key={v.token} type="button" size="sm" variant="outline" onClick={() => setField("custom_message", `${form.custom_message ?? ""}${v.token}`)}>
                    + {v.label}
                  </Button>
                ))}
              </div>
              <Textarea
                rows={5}
                placeholder={"Example: Hi {{name}}, your balance is {{balance}}."}
                value={form.custom_message ?? ""}
                onChange={(e) => setField("custom_message", e.target.value)}
              />
              <div className="rounded-md border border-border/50 p-3 text-xs space-y-1">
                <div className="font-semibold">Available variables</div>
                <div><code>{"{{name}}"}</code> — client display name</div>
                <div><code>{"{{email}}"}</code> — client email</div>
                <div><code>{"{{balance}}"}</code> — current wallet balance</div>
                <div><code>{"{{group}}"}</code> — user group (standard/silver/…)</div>
              </div>
              <p className="text-xs text-muted-foreground">Plain text only. Variables are replaced when shown on the client dashboard.</p>

              <div className="mt-6 pt-4 border-t border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send email to this client</Label>
                    <p className="text-xs text-muted-foreground">Uses {"{{name}}"} and {"{{email}}"} of this client.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={sendingEmail} onClick={() => sendCustomEmail("welcome")}>
                    Send Welcome
                  </Button>
                </div>
                <Input
                  placeholder="Email subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Name", token: "{{name}}" },
                    { label: "Email", token: "{{email}}" },
                  ].map((v) => (
                    <Button key={v.token} type="button" size="sm" variant="outline" onClick={() => setEmailBody(`${emailBody}${v.token}`)}>
                      + {v.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  rows={6}
                  placeholder={"Hi {{name}},\n\nYour message here..."}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button type="button" variant="hero" size="sm" disabled={sendingEmail || !emailBody.trim()} onClick={() => sendCustomEmail("custom")}>
                    {sendingEmail ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                    Send Custom Email
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
