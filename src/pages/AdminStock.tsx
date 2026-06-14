import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Package, CheckCircle2, ListPlus, FolderPlus, Download } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { exportRowsCsv } from "@/lib/invoice";

type Group = { id: string; name: string; description: string | null; created_at: string };
type Item = {
  id: string;
  group_id: string;
  license_key: string;
  status: "available" | "sold";
  sold_order_id: string | null;
  sold_user_id: string | null;
  sold_at: string | null;
  created_at: string;
};
type OrderLite = { id: string; order_number: number; created_at: string };

export default function AdminStock() {
  const confirm = useConfirm();
  const [tab, setTab] = useState("in-stock");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderLite>>({});
  const [loading, setLoading] = useState(false);

  // Add stock state
  const [addGroup, setAddGroup] = useState<string>("");
  const [addText, setAddText] = useState("");
  const [adding, setAdding] = useState(false);

  // Group dialog
  const [groupDlg, setGroupDlg] = useState(false);
  const [editGroup, setEditGroup] = useState<Partial<Group>>({});

  const loadGroups = async () => {
    const { data } = await supabase.from("stock_groups").select("*").order("name");
    const list = (data ?? []) as Group[];
    setGroups(list);
    if (!selectedGroup && list[0]) setSelectedGroup(list[0].id);
    if (!addGroup && list[0]) setAddGroup(list[0].id);
  };

  const loadItems = async () => {
    if (!selectedGroup) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("stock_items")
      .select("*")
      .eq("group_id", selectedGroup)
      .order("created_at", { ascending: false })
      .limit(2000);
    const rows = (data ?? []) as Item[];
    setItems(rows);
    // Fetch order numbers for sold items
    const soldIds = rows.filter((r) => r.sold_order_id).map((r) => r.sold_order_id!);
    if (soldIds.length) {
      const { data: oo } = await supabase.from("orders").select("id,order_number,created_at").in("id", soldIds);
      const map: Record<string, OrderLite> = {};
      (oo ?? []).forEach((o: OrderLite) => { map[o.id] = o; });
      setOrders(map);
    } else {
      setOrders({});
    }
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => { loadItems(); }, [selectedGroup]);

  const available = useMemo(() => items.filter((i) => i.status === "available"), [items]);
  const sold = useMemo(() => items.filter((i) => i.status === "sold"), [items]);

  const saveGroup = async () => {
    const name = (editGroup.name ?? "").trim();
    if (!name) { toast.error("Name required"); return; }
    const payload = { name, description: editGroup.description?.trim() || null };
    const { error } = editGroup.id
      ? await supabase.from("stock_groups").update(payload).eq("id", editGroup.id)
      : await supabase.from("stock_groups").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setGroupDlg(false); setEditGroup({});
    await loadGroups();
  };

  const removeGroup = async (g: Group) => {
    const ok = await confirm({ title: `Delete "${g.name}"?`, description: "All keys (available + sold) in this group are removed.", confirmText: "Delete", destructive: true });
    if (!ok) return;
    const { error } = await supabase.from("stock_groups").delete().eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    if (selectedGroup === g.id) setSelectedGroup("");
    await loadGroups();
  };

  const addStock = async () => {
    if (!addGroup) { toast.error("Pick a group"); return; }
    const keys = addText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!keys.length) { toast.error("Paste at least one key (one per line)"); return; }
    setAdding(true);
    const rows = keys.map((k) => ({ group_id: addGroup, license_key: k }));
    const { error } = await supabase.from("stock_items").insert(rows);
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${rows.length} key${rows.length === 1 ? "" : "s"}`);
    setAddText("");
    if (addGroup === selectedGroup) loadItems();
  };

  const removeItem = async (it: Item) => {
    const ok = await confirm({ title: "Delete key?", description: it.status === "sold" ? "This key was sold — deletion is for cleanup only." : "Remove this key from stock.", confirmText: "Delete", destructive: true });
    if (!ok) return;
    const { error } = await supabase.from("stock_items").delete().eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== it.id));
  };

  const exportSold = () => {
    if (!sold.length) { toast.error("Nothing to export"); return; }
    exportRowsCsv(
      `sold-stock-${new Date().toISOString().slice(0,10)}.csv`,
      ["Order #", "Sold at", "License key"],
      sold.map((s) => [
        orders[s.sold_order_id ?? ""]?.order_number?.toString() ?? "—",
        s.sold_at ?? "",
        s.license_key,
      ]),
    );
  };

  return (
    <AdminLayout title="Digital Stock" subtitle="License-key inventory used by services. Each line is one key.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="in-stock"><Package className="w-4 h-4 mr-2" />In-Stock</TabsTrigger>
          <TabsTrigger value="sold"><CheckCircle2 className="w-4 h-4 mr-2" />Sold Stock</TabsTrigger>
          <TabsTrigger value="add"><ListPlus className="w-4 h-4 mr-2" />Add Stock</TabsTrigger>
          <TabsTrigger value="groups"><FolderPlus className="w-4 h-4 mr-2" />Groups</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Group</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger><SelectValue placeholder="— Select Group —" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground flex gap-4">
            <span><b className="text-success">{available.length}</b> available</span>
            <span><b className="text-foreground">{sold.length}</b> sold</span>
          </div>
        </div>

        <TabsContent value="in-stock" className="mt-4">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-10" /> : !selectedGroup ? (
            <Empty msg="Select a group above to view its stock." />
          ) : available.length === 0 ? (
            <Empty msg="No keys in stock. Use Add Stock tab to add some." />
          ) : (
            <div className="rounded-lg border border-border/40 divide-y divide-border/30">
              {available.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono break-all">{it.license_key}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(it)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sold" className="mt-4 space-y-3">
          {sold.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="glass" onClick={exportSold}>
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </Button>
            </div>
          )}
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-10" /> :
            sold.length === 0 ? <Empty msg="Nothing sold yet from this group." /> : (
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Order #</th>
                      <th className="text-left px-3 py-2">Sold at</th>
                      <th className="text-left px-3 py-2">License key</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sold.map((it) => {
                      const o = it.sold_order_id ? orders[it.sold_order_id] : null;
                      return (
                        <tr key={it.id}>
                          <td className="px-3 py-2 font-mono">{o?.order_number ? `#${o.order_number}` : "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{it.sold_at ? new Date(it.sold_at).toLocaleString() : "—"}</td>
                          <td className="px-3 py-2 font-mono break-all">{it.license_key}</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="icon" variant="ghost" onClick={() => removeItem(it)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        <TabsContent value="add" className="mt-4 space-y-3">
          <div>
            <Label>Add to group</Label>
            <Select value={addGroup} onValueChange={setAddGroup}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="— Select Group —" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>License keys (one per line)</Label>
            <Textarea
              rows={12}
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              className="font-mono text-xs"
              placeholder={"XXXX-AAAA-BBBB-CCCC\nXXXX-DDDD-EEEE-FFFF\n..."}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {addText.split("\n").map((l) => l.trim()).filter(Boolean).length} key(s) ready to add
            </p>
          </div>
          <Button variant="hero" onClick={addStock} disabled={adding}>
            {adding && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Plus className="w-4 h-4 mr-1" /> Add to Stock
          </Button>
        </TabsContent>

        <TabsContent value="groups" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="hero" size="sm" onClick={() => { setEditGroup({}); setGroupDlg(true); }}>
              <Plus className="w-4 h-4 mr-1" /> New Group
            </Button>
          </div>
          {groups.length === 0 ? <Empty msg="No groups yet — create one to start adding keys." /> : (
            <div className="rounded-lg border border-border/40 divide-y divide-border/30">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditGroup(g); setGroupDlg(true); }}>Edit</Button>
                    <Button size="icon" variant="ghost" onClick={() => removeGroup(g)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={groupDlg} onOpenChange={setGroupDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGroup.id ? "Edit Group" : "New Group"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editGroup.name ?? ""} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} placeholder="e.g. iCloud Premium" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editGroup.description ?? ""} onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setGroupDlg(false)}>Cancel</Button>
              <Button variant="hero" onClick={saveGroup}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{msg}</div>;
}
