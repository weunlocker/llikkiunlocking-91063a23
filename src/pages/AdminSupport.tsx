import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketThread } from "@/components/SupportPanel";

type Ticket = {
  id: string; user_id: string; subject: string;
  status: "open" | "pending" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  last_message_at: string; unread_for_admin: boolean;
};

const statusColor: Record<string, string> = {
  open: "bg-success/20 text-success border-success/40",
  pending: "bg-warning/20 text-warning border-warning/40",
  closed: "bg-muted text-muted-foreground border-border",
};
const priorityColor: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-warning",
  urgent: "text-destructive",
};

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Ticket | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: profs }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("last_message_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id,email"),
    ]);
    const map: Record<string, string> = {};
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) map[p.id] = p.email ?? "";
    setEmails(map);
    setTickets((t ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => tickets.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!t.subject.toLowerCase().includes(s) && !(emails[t.user_id] ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  }), [tickets, q, status, emails]);

  return (
    <AdminLayout
      title="Support"
      subtitle={`${tickets.filter((t) => t.status !== "closed").length} active tickets`}
      actions={
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Subject or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      }
    >
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> :
        <div className="glass rounded-2xl overflow-x-auto">
          {filtered.length === 0 ? <div className="p-12 text-center text-muted-foreground text-sm">No tickets.</div> :
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Last update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border/40 hover:bg-secondary/20 cursor-pointer" onClick={() => setOpen(t)}>
                  <td className="px-5 py-3 font-medium flex items-center gap-2">
                    {t.unread_for_admin && <span className="w-2 h-2 rounded-full bg-primary" />}
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    {t.subject}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{emails[t.user_id] ?? t.user_id.slice(0, 8)}</td>
                  <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 text-xs rounded border ${statusColor[t.status]}`}>{t.status}</span></td>
                  <td className={`px-5 py-3 text-xs capitalize ${priorityColor[t.priority]}`}>{t.priority}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(t.last_message_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>}

      <TicketThread ticket={open as unknown as Parameters<typeof TicketThread>[0]["ticket"]} onClose={() => { setOpen(null); load(); }} role="admin" />
    </AdminLayout>
  );
}
