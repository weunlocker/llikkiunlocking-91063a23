import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Edit, Trash2, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

export type InvoiceRow = {
  id: string;
  invoice_number: number;
  user_id: string;
  payment_order_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  coin: string | null;
  tx_id: string | null;
  status: string;
  notes: string | null;
  issued_at: string;
  created_at: string;
  updated_at: string;
  profiles?: { email: string | null; display_name: string | null } | null;
};

export const invoiceNo = (n: number) => `INV-${String(n).padStart(5, "0")}`;

const statusColor = (s: string) =>
  ({ paid: "text-success", pending: "text-warning", refunded: "text-muted-foreground", void: "text-destructive" } as Record<string, string>)[s] ?? "";

export default function AdminInvoices() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_number", { ascending: false });
    const inv = (data ?? []) as InvoiceRow[];
    const ids = Array.from(new Set(inv.map((r) => r.user_id)));
    let map: Record<string, { email: string | null; display_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email,display_name").in("id", ids);
      map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { email: p.email, display_name: p.display_name }]));
    }
    setRows(inv.map((r) => ({ ...r, profiles: map[r.user_id] ?? null })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const openId = params.get("open");
    if (!openId || rows.length === 0) return;
    const r = rows.find((x) => x.id === openId);
    if (r) {
      setEditing(r);
      const next = new URLSearchParams(params);
      next.delete("open");
      setParams(next, { replace: true });
    }
  }, [params, rows, setParams]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      String(r.invoice_number).includes(s) ||
      r.profiles?.email?.toLowerCase().includes(s) ||
      r.profiles?.display_name?.toLowerCase().includes(s) ||
      r.tx_id?.toLowerCase().includes(s) ||
      r.provider?.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const remove = async (r: InvoiceRow) => {
    const ok = await confirm({ title: `Delete ${invoiceNo(r.invoice_number)}?`, description: "This cannot be undone. The wallet top-up itself is not touched.", confirmText: "Delete" });
    if (!ok) return;
    const { error } = await supabase.from("invoices").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Invoice deleted");
    load();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase.from("invoices").update({
      amount: editing.amount,
      currency: editing.currency,
      coin: editing.coin,
      tx_id: editing.tx_id,
      status: editing.status,
      notes: editing.notes,
      issued_at: editing.issued_at,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Invoice updated");
    setEditing(null);
    load();
  };

  return (
    <AdminLayout
      title="Invoices"
      subtitle={`${rows.length} invoice${rows.length === 1 ? "" : "s"} from wallet top-ups`}
      actions={
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search invoice, client, tx…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }
    >
      <Seo title="Invoices — Admin" description="Manage top-up invoices" path="/admin/invoices" noindex />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Coin</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issued</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/20">
                  <td className="px-4 py-3 font-mono">{invoiceNo(r.invoice_number)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{r.profiles?.email ?? "—"}</div>
                    {r.profiles?.display_name && <div className="text-[11px] text-muted-foreground">{r.profiles.display_name}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.provider}</td>
                  <td className="px-4 py-3">{r.coin ?? r.currency}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">${Number(r.amount).toFixed(2)}</td>
                  <td className={`px-4 py-3 capitalize ${statusColor(r.status)}`}>{r.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.issued_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                    <Button size="sm" variant="neon" onClick={() => setEditing(r)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No invoices found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing && invoiceNo(editing.invoice_number)}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={editing.amount}
                    onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
                </div>
                <div>
                  <Label>Coin</Label>
                  <Input value={editing.coin ?? ""} onChange={(e) => setEditing({ ...editing, coin: e.target.value || null })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Transaction ID</Label>
                <Input value={editing.tx_id ?? ""} onChange={(e) => setEditing({ ...editing, tx_id: e.target.value || null })} />
              </div>
              <div>
                <Label>Issued at</Label>
                <Input type="datetime-local"
                  value={editing.issued_at ? new Date(editing.issued_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, issued_at: new Date(e.target.value).toISOString() })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="hero" onClick={save}><Save className="w-4 h-4" /> Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
