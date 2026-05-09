import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Save, User as UserIcon, MapPin, Crown, MessageSquare, Layers } from "lucide-react";
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

type Service = { id: string; service_code: string | null; name: string; price: number; category: string | null; active: boolean };
type Override = { service_id: string; enabled: boolean; custom_price: number | null };

const GROUP_DISCOUNT: Record<string, number> = { standard: 0, silver: 0.10, gold: 0.30, diamond: 0.50 };

export default function AdminUserEditDialog({ user, onClose, onSaved }: { user: EditableUser | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EditableUser | null>(user);
  const [services, setServices] = useState<Service[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [saving, setSaving] = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [svcQuery, setSvcQuery] = useState("");

  useEffect(() => { setForm(user); }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingSvc(true);
    Promise.all([
      supabase.from("services").select("id,service_code,name,price,category,active").order("category").order("sort_order").order("name"),
      supabase.from("user_service_overrides").select("service_id,enabled,custom_price").eq("user_id", user.id),
    ]).then(([s, o]) => {
      setServices((s.data ?? []) as Service[]);
      const m: Record<string, Override> = {};
      for (const r of (o.data ?? []) as Override[]) m[r.service_id] = r;
      setOverrides(m);
      setLoadingSvc(false);
    });
  }, [user?.id]);

  const setField = <K extends keyof EditableUser>(k: K, v: EditableUser[K]) =>
    setForm((f) => f ? { ...f, [k]: v } : f);

  const discount = useMemo(() => GROUP_DISCOUNT[String(form?.user_group ?? "standard").toLowerCase()] ?? 0, [form?.user_group]);

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
                    const groupPrice = +(Number(s.price) * (1 - discount)).toFixed(2);
                    const effective = ov?.custom_price != null ? Number(ov.custom_price) : groupPrice;
                    return (
                      <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.service_code && <span className="font-mono mr-2">#{s.service_code}</span>}
                            <span>Base ${Number(s.price).toFixed(2)}</span>
                            {discount > 0 && <span className="ml-2">→ Group ${groupPrice.toFixed(2)}</span>}
                            <span className="ml-2 text-success">Effective ${effective.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" step="0.01" placeholder="Custom $"
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

            <TabsContent value="message" className="mt-4 space-y-3">
              <Label>Custom dashboard message</Label>
              <Textarea
                rows={5}
                placeholder="Shown as a banner on this user's dashboard. Leave empty to hide."
                value={form.custom_message ?? ""}
                onChange={(e) => setField("custom_message", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Markdown not supported — plain text only.</p>
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
