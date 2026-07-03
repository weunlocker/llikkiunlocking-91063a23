import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ClipboardPaste, Loader2, User, Wallet, ListOrdered, Briefcase, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Scope = "users" | "payments" | "orders" | "services" | "support";
const ALL: Scope[] = ["users", "payments", "orders", "services", "support"];

type Hit = {
  scope: Scope;
  id: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
};

export default function AdminGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(ALL));
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const navigate = useNavigate();
  const allOn = scopes.size === ALL.length;

  const toggle = (s: Scope) => {
    setScopes((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  };
  const toggleAll = () => setScopes(allOn ? new Set() : new Set(ALL));

  const go = (path: string) => { setOpen(false); navigate(path); };

  useEffect(() => {
    if (!open) { setQ(""); setHits([]); return; }
  }, [open]);

  const doSearch = async () => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    const like = `%${term}%`;
    const active = scopes.size ? scopes : new Set(ALL);
    const results: Hit[] = [];

    const tasks: Promise<void>[] = [];
    if (active.has("users")) tasks.push((async () => {
      const { data } = await supabase.from("profiles")
        .select("id,email,display_name,balance")
        .or(`email.ilike.${like},display_name.ilike.${like},id.eq.${isUuid(term) ? term : "00000000-0000-0000-0000-000000000000"}`)
        .limit(15);
      (data ?? []).forEach((r: any) => results.push({
        scope: "users", id: r.id,
        title: r.display_name || r.email,
        subtitle: `${r.email} • $${Number(r.balance ?? 0).toFixed(2)}`,
        onClick: () => go(`/admin/users?open=${r.id}`),
      }));
    })());

    if (active.has("orders")) tasks.push((async () => {
      const filters = [`imei.ilike.${like}`, `supplier_reference.ilike.${like}`];
      if (isUuid(term)) filters.push(`id.eq.${term}`);
      if (/^\d+$/.test(term) && Number(term) <= 2147483647) filters.push(`order_number.eq.${term}`);
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,imei,status,price_charged,created_at")
        .or(filters.join(","))
        .order("created_at", { ascending: false }).limit(15);
      if (error) console.error("orders search", error);
      (data ?? []).forEach((r: any) => results.push({
        scope: "orders", id: r.id,
        title: `#${r.order_number ?? r.id.slice(0, 8)} • ${r.imei ?? ""}`,
        subtitle: `${r.status} • $${Number(r.price_charged ?? 0).toFixed(2)}`,
        onClick: () => go(`/admin/orders?open=${r.id}`),
      }));
    })());

    if (active.has("payments")) tasks.push((async () => {
      const filters = [`description.ilike.${like}`];
      if (isUuid(term)) filters.push(`id.eq.${term}`, `user_id.eq.${term}`);
      const { data, error } = await supabase.from("transactions")
        .select("id,type,amount,description,created_at,user_id")
        .or(filters.join(","))
        .order("created_at", { ascending: false }).limit(15);
      if (error) console.error("tx search", error);
      (data ?? []).forEach((r: any) => results.push({
        scope: "payments", id: r.id,
        title: `${r.type} • $${Number(r.amount ?? 0).toFixed(2)}`,
        subtitle: r.description ?? new Date(r.created_at).toLocaleString(),
        onClick: () => go(`/admin/transactions`),
      }));
    })());

    if (active.has("services")) tasks.push((async () => {
      const { data } = await supabase.from("services")
        .select("id,name,category,price")
        .or(`name.ilike.${like},category.ilike.${like}`)
        .limit(15);
      (data ?? []).forEach((r: any) => results.push({
        scope: "services", id: r.id,
        title: r.name,
        subtitle: `${r.category ?? ""} • $${Number(r.price ?? 0).toFixed(2)}`,
        onClick: () => go(`/admin/services/${r.id}`),
      }));
    })());

    if (active.has("support")) tasks.push((async () => {
      const filters = [`subject.ilike.${like}`];
      if (isUuid(term)) filters.push(`id.eq.${term}`);
      const { data } = await supabase.from("support_tickets")
        .select("id,subject,status,last_message_at")
        .or(filters.join(","))
        .order("last_message_at", { ascending: false }).limit(15);
      (data ?? []).forEach((r: any) => results.push({
        scope: "support", id: r.id,
        title: r.subject || `Ticket ${r.id.slice(0, 8)}`,
        subtitle: `${r.status}`,
        onClick: () => go(`/admin/support?open=${r.id}`),
      }));
    })());

    await Promise.all(tasks);
    setHits(results);
    setLoading(false);
  };

  const pasteAndSearch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return toast.error("Clipboard is empty");
      setQ(text.trim());
      setTimeout(doSearch, 0);
    } catch {
      toast.error("Clipboard blocked — paste manually");
    }
  };

  const grouped = useMemo(() => {
    const g: Record<Scope, Hit[]> = { users: [], payments: [], orders: [], services: [], support: [] };
    hits.forEach((h) => g[h.scope].push(h));
    return g;
  }, [hits]);

  const scopeMeta: Record<Scope, { label: string; icon: typeof User }> = {
    users: { label: "Clients / Users", icon: User },
    payments: { label: "Invoices / Payments", icon: Wallet },
    orders: { label: "Orders", icon: ListOrdered },
    services: { label: "Services / Products", icon: Briefcase },
    support: { label: "Support Tickets", icon: MessageSquare },
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Search className="w-4 h-4" /> <span className="hidden sm:inline">Search</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Search className="w-4 h-4" /> Intelligent Search</DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={allOn} onCheckedChange={toggleAll} /> All
              </label>
              {ALL.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={scopes.has(s)} onCheckedChange={() => toggle(s)} />
                  {scopeMeta[s].label}
                </label>
              ))}
            </div>
            <div className="relative">
              <Input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search…" className="pr-9"
              />
              {q && (
                <button onClick={() => { setQ(""); setHits([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={pasteAndSearch} className="gap-2"><ClipboardPaste className="w-4 h-4" /> Paste & Search</Button>
              <Button onClick={doSearch} variant="secondary" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
            {!loading && hits.length === 0 && q && <p className="text-sm text-muted-foreground text-center py-6">No results</p>}
            {ALL.map((s) => {
              const items = grouped[s];
              if (!items.length) return null;
              const Icon = scopeMeta[s].icon;
              return (
                <div key={s}>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Icon className="w-3.5 h-3.5" /> {scopeMeta[s].label} ({items.length})
                  </div>
                  <div className="space-y-1">
                    {items.map((h) => (
                      <button key={h.id} onClick={h.onClick}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 border border-border/40 transition-colors">
                        <div className="text-sm font-medium truncate">{h.title}</div>
                        {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
