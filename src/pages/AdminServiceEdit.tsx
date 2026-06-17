import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, ArrowLeft, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { serviceSchema } from "@/lib/validation";
import type { CustomField } from "@/pages/Admin";

type SuccessRule = { path: string; op: "eq" | "neq" | "contains" | "not_contains" | "exists" | "truthy"; value?: string | number | boolean };
type Service = { id?: string; service_code?: string | null; name: string; description: string | null; price: number; delivery_time: string; api_url: string | null; api_method: string; api_request_body: string | null; response_template: string | null; sample_result: string | null; result_font: string | null; result_color: string | null; active: boolean; is_free: boolean; category: string | null; success_rules: SuccessRule[] | null; supplier_id: string | null; supplier_action: string | null; stock_group_id: string | null; service_type?: "imei" | "server"; custom_fields?: CustomField[] };
type Supplier = { id: string; name: string; type: string };
type Category = { id: string; slug: string; name: string };
type StockGroup = { id: string; name: string };
type SupplierService = { action_code: string; name: string; credit: number | null; delivery_time: string | null; service_type?: "imei" | "server"; fields?: CustomField[] };

const emptyService: Service = {
  name: "", description: "", price: 0, delivery_time: "Instant",
  api_url: "", api_method: "GET", api_request_body: "", response_template: "",
  sample_result: "", result_font: "mono", result_color: "#e2e8f0",
  active: true, is_free: false, category: "general",
  success_rules: [], supplier_id: null, supplier_action: "",
  stock_group_id: null,
  service_type: "imei", custom_fields: [],
};


type TabId =
  | "overview" | "field" | "api" | "retail" | "inventory"
  | "subscription" | "subscribed" | "discounted" | "reviews" | "blacklist";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "field", label: "Field" },
  { id: "api", label: "API Connection" },
  { id: "retail", label: "Retail Purchase" },
  { id: "inventory", label: "Inventory/Purchase Cost" },
  { id: "subscription", label: "Subscription" },
  { id: "subscribed", label: "Subscribed User" },
  { id: "discounted", label: "Discounted Users" },
  { id: "reviews", label: "Customer Review" },
  { id: "blacklist", label: "Blacklisted IMEI" },
];

export default function AdminServiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [service, setService] = useState<Service>(emptyService);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supSvc, setSupSvc] = useState<SupplierService[]>([]);
  const [supSvcQ, setSupSvcQ] = useState("");
  const [apiOriginalPrice, setApiOriginalPrice] = useState<number | null>(null);
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: sup }, { data: cats }, { data: sg }] = await Promise.all([
        supabase.from("suppliers").select("id,name,type").order("name"),
        supabase.from("categories").select("id,slug,name").order("sort_order").order("name"),
        supabase.from("stock_groups").select("id,name").order("name"),
      ]);
      setSuppliers((sup ?? []) as Supplier[]);
      setCategories((cats ?? []) as Category[]);
      setStockGroups((sg ?? []) as StockGroup[]);


      if (!isNew && id) {
        const { data } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
        if (data) setService(data as unknown as Service);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  useEffect(() => {
    if (!service.supplier_id) { setSupSvc([]); setApiOriginalPrice(null); return; }
    supabase.from("supplier_services")
      .select("action_code,name,credit,delivery_time,service_type,fields")
      .eq("supplier_id", service.supplier_id)
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as SupplierService[];
        setSupSvc(list);
        const matched = list.find((x) => x.action_code === service.supplier_action);
        setApiOriginalPrice(matched?.credit ?? null);
      });
  }, [service.supplier_id, service.supplier_action]);

  const update = (patch: Partial<Service>) => setService((s) => ({ ...s, ...patch }));

  const save = async () => {
    const usingSupplier = !!service.supplier_id;
    const parsed = serviceSchema.safeParse({
      name: service.name, description: service.description, price: Number(service.price),
      delivery_time: service.delivery_time,
      api_url: usingSupplier ? (service.api_url || "https://supplier.local") : service.api_url,
      api_method: service.api_method, category: service.category, active: service.active,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSaving(true);
    const payload = {
      name: parsed.data.name, description: parsed.data.description ?? null, price: parsed.data.price,
      delivery_time: parsed.data.delivery_time,
      api_url: usingSupplier ? null : (parsed.data.api_url || null),
      api_method: parsed.data.api_method,
      api_request_body: service.api_request_body ?? null,
      category: parsed.data.category ?? "general",
      active: parsed.data.active, is_free: !!service.is_free,
      response_template: service.response_template ?? null,
      sample_result: service.sample_result?.trim() ? service.sample_result : null,
      result_font: service.result_font ?? "mono",
      result_color: service.result_color ?? "#e2e8f0",
      success_rules: (service.success_rules ?? []) as unknown as never,
      supplier_id: service.supplier_id ?? null,
      supplier_action: service.supplier_action || null,
      stock_group_id: service.stock_group_id ?? null,

      service_type: service.service_type ?? "imei",
      custom_fields: (service.custom_fields ?? []) as unknown as never,
    };
    const { data, error } = isNew
      ? await supabase.from("services").insert(payload).select("id").maybeSingle()
      : await supabase.from("services").update(payload).eq("id", id!).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    if (isNew && data?.id) navigate(`/admin/services/${data.id}`, { replace: true });
  };

  const addRule = () => update({ success_rules: [...(service.success_rules ?? []), { path: "", op: "truthy" }] });
  const updateRule = (i: number, patch: Partial<SuccessRule>) => {
    const arr = [...(service.success_rules ?? [])]; arr[i] = { ...arr[i], ...patch }; update({ success_rules: arr });
  };
  const removeRule = (i: number) => {
    const arr = [...(service.success_rules ?? [])]; arr.splice(i, 1); update({ success_rules: arr });
  };

  const groupPrices = useMemo(() => {
    const p = Number(service.price ?? 0);
    return { def: p, silver: p * 0.9, gold: p * 0.7, diamond: p * 0.5 };
  }, [service.price]);

  if (loading) {
    return <AdminLayout title="Service" subtitle="Loading…"><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout
      title={isNew ? "New Service" : (service.name || "Edit Service")}
      subtitle={service.service_code ? `#${service.service_code}` : (isNew ? "Create a new service" : "Edit service")}
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate("/admin/services")}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
          <Button variant="hero" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Sidebar tabs */}
        <aside className="glass rounded-2xl p-2 h-fit lg:sticky lg:top-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                  tab === t.id
                    ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Tab content */}
        <section className="glass rounded-2xl p-4 lg:p-6 space-y-4 min-w-0">
          {tab === "overview" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-primary">{service.name || "New Service"}</h2>

              <div className="flex items-center gap-6 flex-wrap rounded-lg border border-border/60 bg-secondary/20 p-3">
                <div className="flex items-center gap-3"><Switch checked={service.active} onCheckedChange={(v) => update({ active: v })} /><Label>Status (Active)</Label></div>
                <div className="flex items-center gap-3"><Switch checked={!!service.is_free} onCheckedChange={(v) => update({ is_free: v })} /><Label>Free Check (show on Free Check page)</Label></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Service Name *</Label><Input value={service.name} onChange={(e) => update({ name: e.target.value })} maxLength={250} /></div>
                <div>
                  <Label>Service Listed In Group</Label>
                  <Select value={service.category ?? "general"} onValueChange={(v) => update({ category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 && <SelectItem value="general">General</SelectItem>}
                      {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Description</Label>
                  <Button
                    type="button" size="sm" variant="outline"
                    disabled={!service.name?.trim() || aiDescLoading}
                    onClick={async () => {
                      setAiDescLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("ai-describe-service", {
                          body: { name: service.name, category: service.category },
                        });
                        if (error) throw error;
                        const desc = (data as { description?: string })?.description?.trim();
                        if (!desc) throw new Error("No description returned");
                        update({ description: desc });
                        toast.success("Description generated");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to generate");
                      } finally { setAiDescLoading(false); }
                    }}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />{aiDescLoading ? "Generating…" : "Auto-fill from name"}
                  </Button>
                </div>
                <Textarea value={service.description ?? ""} onChange={(e) => update({ description: e.target.value })} maxLength={500} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Price (USD)</Label>
                  <Input type="number" step="0.01" value={service.price ?? 0} onChange={(e) => update({ price: Number(e.target.value) })} />
                  {apiOriginalPrice != null && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      API original: {Number(apiOriginalPrice).toFixed(3)} credit
                    </p>
                  )}
                </div>
                <div>
                  <Label>Delivery Time</Label>
                  {(() => {
                    const raw = (service.delivery_time ?? "").trim();
                    const units = ["Minutes", "Hours", "days", "Weeks", "Months", "Instant"];
                    const isInstant = raw.toLowerCase() === "instant" || raw === "";
                    let qty = ""; let unit = "Instant";
                    if (!isInstant) {
                      const m = raw.match(/^(\S+)\s+(.+)$/);
                      if (m) { qty = m[1]; unit = units.find(u => u.toLowerCase() === m[2].toLowerCase()) ?? m[2]; }
                      else { unit = units.find(u => u.toLowerCase() === raw.toLowerCase()) ?? "Minutes"; }
                    }
                    const commit = (q: string, u: string) => update({ delivery_time: u === "Instant" ? "Instant" : (q ? `${q} ${u}` : u) });
                    return (
                      <div className="flex gap-2">
                        <Input className="w-24" placeholder="0-5" value={qty} disabled={unit === "Instant"} onChange={(e) => commit(e.target.value, unit)} maxLength={20} />
                        <select className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm" value={unit} onChange={(e) => commit(qty, e.target.value)}>
                          {units.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <div className="text-xs text-muted-foreground mb-2">Auto-calculated client group prices</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded bg-background/40 py-2"><div className="text-muted-foreground">Default</div><div className="font-mono font-bold">${groupPrices.def.toFixed(2)}</div></div>
                  <div className="rounded bg-background/40 py-2"><div className="text-slate-300">Silver −10%</div><div className="font-mono font-bold text-slate-200">${groupPrices.silver.toFixed(2)}</div></div>
                  <div className="rounded bg-background/40 py-2"><div className="text-yellow-400">Gold −30%</div><div className="font-mono font-bold text-yellow-300">${groupPrices.gold.toFixed(2)}</div></div>
                  <div className="rounded bg-background/40 py-2"><div className="text-cyan-300">Diamond −50%</div><div className="font-mono font-bold text-cyan-200">${groupPrices.diamond.toFixed(2)}</div></div>
                </div>
              </div>
            </div>
          )}

          {tab === "field" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">IMEI / Serial No. / Custom Field</h2>
              <div className="rounded-lg border border-border/60 p-3">
                <Label className="text-sm">Service Type</Label>
                <Select value={service.service_type ?? "imei"} onValueChange={(v) => update({ service_type: v as "imei" | "server" })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imei">IMEI Service</SelectItem>
                    <SelectItem value="server">Server Service (custom fields)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {service.service_type === "server" ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Custom Fields</div>
                  {(service.custom_fields ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custom fields. Link a supplier service from the <button onClick={() => setTab("api")} className="text-primary underline">API Connection</button> tab to import its fields.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                      {(service.custom_fields ?? []).map((f) => (
                        <div key={f.name} className="flex items-center gap-1 rounded bg-background/40 px-2 py-1">
                          <span className="font-mono text-primary">{f.name}</span>
                          <span className="text-muted-foreground truncate">· {f.label}</span>
                          <span className="ml-auto text-muted-foreground">{f.type}{f.required ? " *" : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                  This service collects a standard IMEI / Serial Number from customers.
                </div>
              )}

              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <Label className="text-sm">Sample Result Preview</Label>
                <Textarea
                  value={service.sample_result ?? ""}
                  onChange={(e) => update({ sample_result: e.target.value })}
                  rows={6} className="font-mono text-xs"
                  placeholder={"Model : iPhone 11 128GB Purple\nIMEI : 356543109054733\nFind My iPhone : OFF"}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Result Font</Label>
                    <select value={service.result_font ?? "mono"} onChange={(e) => update({ result_font: e.target.value })} className="w-full bg-background border border-border/60 rounded px-2 py-2 text-sm mt-1">
                      <option value="mono">Mono</option><option value="sans">Sans</option><option value="serif">Serif</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Result Color</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <input type="color" value={service.result_color ?? "#e2e8f0"} onChange={(e) => update({ result_color: e.target.value })} className="w-10 h-9 rounded border border-border/60 bg-transparent cursor-pointer" />
                      <Input value={service.result_color ?? "#e2e8f0"} onChange={(e) => update({ result_color: e.target.value })} className="font-mono text-xs" maxLength={9} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">API Connection (Primary)</h2>

              <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
                <Label className="text-sm">Deliver from Digital Stock</Label>
                <Select
                  value={service.stock_group_id ?? "none"}
                  onValueChange={(v) => update({ stock_group_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="None — use API instead" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — use API instead</SelectItem>
                    {stockGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  When set, orders for this service deliver one license key from the selected stock group instead of calling any API. If stock runs out, orders fail and refund automatically.
                </p>
              </div>



              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div>
                  <Label className="text-sm">Simple Link</Label>
                  <Select
                    value={service.supplier_id ?? "none"}
                    onValueChange={(v) => update({ supplier_id: v === "none" ? null : v, supplier_action: v === "none" ? null : service.supplier_action })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="None — use direct API URL" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None — use direct API URL</SelectItem>
                      {suppliers.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name} ({sp.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {service.supplier_id && (
                  <div>
                    <Label className="text-sm">API Service</Label>
                    <Input
                      className="mt-1 mb-2"
                      placeholder={`Search ${supSvc.length} synced services…`}
                      value={supSvcQ}
                      onChange={(e) => setSupSvcQ(e.target.value)}
                    />
                    <div className="max-h-72 overflow-y-auto rounded border border-border/50 bg-background/50 divide-y divide-border/40">
                      {supSvc
                        .filter((s) => !supSvcQ || s.name.toLowerCase().includes(supSvcQ.toLowerCase()) || s.action_code.includes(supSvcQ))
                        .slice(0, 200)
                        .map((s) => {
                          const selected = service.supplier_action === s.action_code;
                          return (
                            <button
                              key={s.action_code}
                              type="button"
                              onClick={() => update({
                                supplier_action: s.action_code,
                                name: service.name || s.name,
                                delivery_time: service.delivery_time && service.delivery_time !== "Instant" ? service.delivery_time : (s.delivery_time || "Instant"),
                                price: service.price && Number(service.price) > 0 ? service.price : (s.credit != null ? Number(s.credit) : service.price),
                                service_type: s.service_type ?? "imei",
                                custom_fields: s.service_type === "server" ? (s.fields ?? []) : [],
                              })}
                              className={`w-full text-left px-3 py-2 text-xs flex justify-between gap-2 hover:bg-primary/10 ${selected ? "bg-primary/20 ring-1 ring-primary" : ""}`}
                            >
                              <span className="truncate"><span className="font-mono text-primary">#{s.action_code}</span> {s.name}</span>
                              <span className="text-muted-foreground whitespace-nowrap">{s.credit != null ? `${s.credit} credit` : ""}{s.delivery_time ? ` · ${s.delivery_time}` : ""}</span>
                            </button>
                          );
                        })}
                      {supSvc.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground">No synced services. Go to Suppliers → Sync.</div>}
                    </div>
                    {apiOriginalPrice != null && (
                      <p className="text-xs text-muted-foreground mt-2">Price from API: <b className="font-mono">{Number(apiOriginalPrice).toFixed(3)} credit</b></p>
                    )}
                  </div>
                )}
              </div>

              {!service.supplier_id && (
                <div className="rounded-lg border border-border/60 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                    <div><Label>API URL ({"{IMEI}"} placeholder)</Label><Input value={service.api_url ?? ""} onChange={(e) => update({ api_url: e.target.value })} placeholder="https://provider.com/check.php?imei={IMEI}&key=XXX" /></div>
                    <div>
                      <Label>Method</Label>
                      <Select value={service.api_method ?? "GET"} onValueChange={(v) => update({ api_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  {service.api_method === "POST" && (
                    <div>
                      <Label>POST Body Template</Label>
                      <Textarea value={service.api_request_body ?? ""} onChange={(e) => update({ api_request_body: e.target.value })} rows={3} className="font-mono text-xs" placeholder='{"username":"x","apikey":"y","imei":"{IMEI}"}' />
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Response Template (optional)</Label>
                <Textarea value={service.response_template ?? ""} onChange={(e) => update({ response_template: e.target.value })} placeholder="Model: {model}&#10;IMEI: {imei}" rows={3} />
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm">Success Rules</Label><p className="text-xs text-muted-foreground">All must pass. Empty = any HTTP 200 = success.</p></div>
                  <Button type="button" size="sm" variant="ghost" onClick={addRule}><Plus className="w-3 h-3 mr-1" />Add</Button>
                </div>
                {(service.success_rules ?? []).map((r, i) => (
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
            </div>
          )}

          {tab !== "overview" && tab !== "field" && tab !== "api" && (
            <ComingSoon label={TABS.find((t) => t.id === tab)?.label ?? ""} />
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="py-16 text-center space-y-2">
      <h3 className="text-lg font-bold">{label}</h3>
      <p className="text-sm text-muted-foreground">This section is part of the new layout and will be wired up next.</p>
    </div>
  );
}
