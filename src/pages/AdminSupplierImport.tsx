import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Wand2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { bestMatch } from "@/lib/serviceMatch";

type Supplier = { id: string; name: string; type: string };
type Svc = { id: string; name: string; price: number; delivery_time: string; supplier_id: string | null; supplier_action: string | null; category: string | null };
type SupSvc = { action_code: string; name: string; credit: number | null; delivery_time: string | null };
type Action = "link" | "create" | "skip";
type Row = { action_code: string; sup_name: string; credit: number | null; delivery_time: string | null; action: Action; service_id: string | null; score: number; already_linked_id: string | null };

const THRESHOLD = 0.55;

export default function AdminSupplierImport() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supSvcs, setSupSvcs] = useState<SupSvc[]>([]);
  const [services, setServices] = useState<Svc[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<null | "sync" | "import">(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("suppliers").select("id,name,type").eq("active", true).order("name");
      setSuppliers((data ?? []) as Supplier[]);
      if (data?.length) setSupplierId(data[0].id);
      setLoading(false);
    })();
  }, []);

  const loadData = async (sid: string) => {
    const [{ data: ss }, { data: svc }] = await Promise.all([
      supabase.from("supplier_services").select("action_code,name,credit,delivery_time").eq("supplier_id", sid).order("name"),
      supabase.from("services").select("id,name,price,delivery_time,supplier_id,supplier_action,category"),
    ]);
    const supList = (ss ?? []) as SupSvc[];
    const svcList = (svc ?? []) as Svc[];
    setSupSvcs(supList); setServices(svcList);
    computeRows(supList, svcList, sid);
  };

  useEffect(() => { if (supplierId) loadData(supplierId); }, [supplierId]);

  const computeRows = (sup: SupSvc[], svc: Svc[], sid: string) => {
    // Services not linked to ANY supplier are matchable; ones linked to THIS supplier already are shown as "already linked"
    const matchable = svc.filter((s) => !s.supplier_id || s.supplier_id === sid);
    const next: Row[] = sup.map((u) => {
      const already = svc.find((s) => s.supplier_id === sid && s.supplier_action === u.action_code);
      if (already) {
        return { action_code: u.action_code, sup_name: u.name, credit: u.credit, delivery_time: u.delivery_time, action: "skip", service_id: already.id, score: 1, already_linked_id: already.id };
      }
      const m = bestMatch(u, matchable);
      const passes = m && m.score >= THRESHOLD;
      return {
        action_code: u.action_code,
        sup_name: u.name,
        credit: u.credit,
        delivery_time: u.delivery_time,
        action: passes ? "link" : "create",
        service_id: passes ? m!.service_id : null,
        score: m?.score ?? 0,
        already_linked_id: null,
      };
    });
    setRows(next);
  };

  const sync = async () => {
    if (!supplierId) return;
    setBusy("sync");
    try {
      const { data, error } = await supabase.functions.invoke("supplier-sync", { body: { supplier_id: supplierId } });
      if (error || (data as { error?: string })?.error) { toast.error((data as { error?: string })?.error || error?.message || "Sync failed"); return; }
      toast.success(`Synced ${(data as { count?: number })?.count ?? 0} services`);
      await loadData(supplierId);
    } finally { setBusy(null); }
  };

  const applyImport = async () => {
    if (!rows.length) return;
    setBusy("import");
    try {
      const items = rows
        .filter((r) => !r.already_linked_id)
        .map((r) => {
          if (r.action === "skip") return { action_code: r.action_code, action: "skip" as const };
          if (r.action === "link" && r.service_id) return { action_code: r.action_code, action: "link" as const, service_id: r.service_id };
          return {
            action_code: r.action_code,
            action: "create" as const,
            name: r.sup_name,
            price: Number(r.credit ?? 0),
            delivery_time: r.delivery_time ?? "Instant",
            category: "general",
          };
        });
      const { data, error } = await supabase.functions.invoke("supplier-bulk-link", { body: { supplier_id: supplierId, items } });
      if (error || (data as { error?: string })?.error) { toast.error((data as { error?: string })?.error || error?.message || "Import failed"); return; }
      const r = data as { linked: number; created: number; skipped: number; failed: unknown[] };
      toast.success(`Linked ${r.linked} • Created ${r.created} • Skipped ${r.skipped}${r.failed.length ? ` • Failed ${r.failed.length}` : ""}`);
      await loadData(supplierId);
    } finally { setBusy(null); }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const filtered = useMemo(() => rows.filter((r) => !q || r.sup_name.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const counts = useMemo(() => {
    const c = { link: 0, create: 0, skip: 0, already: 0 };
    for (const r of rows) {
      if (r.already_linked_id) c.already++;
      else c[r.action]++;
    }
    return c;
  }, [rows]);

  const acceptAll = () => setRows((rs) => rs.map((r) => r.already_linked_id ? r : { ...r, action: r.score >= THRESHOLD && r.service_id ? "link" : "create" }));
  const createAllUnmatched = () => setRows((rs) => rs.map((r) => r.already_linked_id ? r : r.action === "link" ? r : { ...r, action: "create" }));

  return (
    <AdminLayout
      title="Supplier Import"
      subtitle="One-time bulk import: auto-match supplier services to your catalog, create the rest as new."
      actions={
        <div className="flex gap-2">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={sync} disabled={!supplierId || busy === "sync"}>
            {busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sync from supplier
          </Button>
        </div>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> : (
        <>
          {/* Toolbar */}
          <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">From supplier:</span> <b>{supSvcs.length}</b>
              <span className="mx-2">•</span>
              <span className="text-success">Link {counts.link}</span>
              <span className="mx-2">•</span>
              <span className="text-primary">Create {counts.create}</span>
              <span className="mx-2">•</span>
              <span className="text-muted-foreground">Skip {counts.skip}</span>
              {counts.already > 0 && <><span className="mx-2">•</span><span className="text-warning">Already linked {counts.already}</span></>}
            </div>
            <div className="flex-1" />
            <Input className="w-56" placeholder="Search supplier service…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={acceptAll}><Wand2 className="w-4 h-4 mr-1" /> Accept all suggestions</Button>
            <Button size="sm" variant="ghost" onClick={createAllUnmatched}>Create all unmatched</Button>
            <Button variant="hero" onClick={applyImport} disabled={busy === "import" || !rows.length}>
              {busy === "import" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Import
            </Button>
          </div>

          {/* Table */}
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Supplier service</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Linked to / New</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const i = rows.indexOf(r);
                  return (
                    <tr key={r.action_code} className="border-t border-border/40 align-top">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.sup_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.action_code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.credit != null ? `$${Number(r.credit).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.delivery_time ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.already_linked_id ? (
                          <span className="text-xs text-warning">Already linked</span>
                        ) : (
                          <Select value={r.action} onValueChange={(v) => setRow(i, { action: v as Action })}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="link">Link</SelectItem>
                              <SelectItem value="create">Create new</SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-2.5 min-w-[280px]">
                        {r.action === "link" || r.already_linked_id ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={r.service_id ?? ""}
                              onValueChange={(v) => setRow(i, { service_id: v })}
                              disabled={!!r.already_linked_id}
                            >
                              <SelectTrigger className="h-8"><SelectValue placeholder="Pick a service…" /></SelectTrigger>
                              <SelectContent className="max-h-72">
                                {services.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name} — ${Number(s.price).toFixed(2)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!r.already_linked_id && r.score > 0 && (
                              <span className={`text-[10px] font-mono ${r.score >= THRESHOLD ? "text-success" : "text-muted-foreground"}`}>
                                {(r.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : r.action === "create" ? (
                          <span className="text-xs text-primary">New service · ${Number(r.credit ?? 0).toFixed(2)} · {r.delivery_time ?? "Instant"}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {supSvcs.length === 0 ? "No supplier services yet — click \"Sync from supplier\"." : "No matches for your search."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
