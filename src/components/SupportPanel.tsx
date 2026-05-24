import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

type Ticket = {
  id: string; subject: string; status: "open" | "pending" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  last_message_at: string; created_at: string; unread_for_user: boolean;
};
type Message = {
  id: string; ticket_id: string; sender_id: string;
  sender_type: "user" | "admin"; message: string; created_at: string;
};

const statusColor: Record<string, string> = {
  open: "bg-success/20 text-success border-success/40",
  pending: "bg-warning/20 text-warning border-warning/40",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function SupportPanel() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [firstMessage, setFirstMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("support_tickets")
      .select("*").eq("user_id", user.id).order("last_message_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`user-tickets-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const submitNew = async () => {
    if (!user) return;
    if (subject.trim().length < 3) { toast.error("Subject too short"); return; }
    if (firstMessage.trim().length < 3) { toast.error("Message too short"); return; }
    setSubmitting(true);
    const { data: t, error } = await supabase.from("support_tickets")
      .insert({ user_id: user.id, subject: subject.trim(), priority })
      .select("*").maybeSingle();
    if (error || !t) { setSubmitting(false); toast.error(error?.message || "Failed"); return; }
    const { error: mErr } = await supabase.from("support_ticket_messages")
      .insert({ ticket_id: t.id, sender_id: user.id, sender_type: "user", message: firstMessage.trim() });
    setSubmitting(false);
    if (mErr) { toast.error(mErr.message); return; }
    toast.success("Ticket created");
    setCreating(false); setSubject(""); setFirstMessage(""); setPriority("normal");
    load();
    setOpenTicket(t as Ticket);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Support</h2>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-2" /> New ticket</Button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> :
          tickets.length === 0 ? <div className="p-12 text-center text-muted-foreground text-sm">No tickets yet. Open one if you need help.</div> :
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Last update</th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-border/40 hover:bg-secondary/20 cursor-pointer" onClick={() => setOpenTicket(t)}>
                  <td className="px-5 py-3 font-medium flex items-center gap-2">
                    {t.unread_for_user && <span className="w-2 h-2 rounded-full bg-primary" />}
                    {t.subject}
                  </td>
                  <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 text-xs rounded border ${statusColor[t.status]}`}>{t.status}</span></td>
                  <td className="px-5 py-3 capitalize text-xs">{t.priority}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(t.last_message_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader><DialogTitle>New support ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" maxLength={120} /></div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Message</Label><Textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} rows={6} placeholder="Describe your issue…" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={submitNew} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create ticket</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TicketThread ticket={openTicket} onClose={() => { setOpenTicket(null); load(); }} role="user" />
    </div>
  );
}

export function TicketThread({ ticket, onClose, role }: { ticket: Ticket | null; onClose: () => void; role: "user" | "admin" }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closed = ticket?.status === "closed";

  useEffect(() => {
    if (!ticket) { setMessages([]); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("support_ticket_messages")
        .select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      if (!active) return;
      setMessages((data ?? []) as Message[]);
      setLoading(false);
      // mark read
      const patch = role === "user" ? { unread_for_user: false } : { unread_for_admin: false };
      await supabase.from("support_tickets").update(patch).eq("id", ticket.id);
    })();
    const ch = supabase.channel(`ticket-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${ticket.id}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [ticket, role]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!ticket || !user) return;
    const text = reply.trim();
    if (text.length < 1) return;
    setSending(true);
    const { error } = await supabase.from("support_ticket_messages")
      .insert({ ticket_id: ticket.id, sender_id: user.id, sender_type: role, message: text });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setReply("");
  };

  const setStatus = async (status: "open" | "pending" | "closed") => {
    if (!ticket) return;
    await supabase.from("support_tickets").update({ status }).eq("id", ticket.id);
    toast.success(`Marked ${status}`);
  };

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base">{ticket?.subject}</DialogTitle>
            {role === "admin" && ticket && (
              <Select value={ticket.status} onValueChange={(v) => setStatus(v as "open" | "pending" | "closed")}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[200px] max-h-[60vh]">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div> :
            messages.map((m) => {
              const mine = m.sender_type === role;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                    <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">{m.sender_type}</div>
                    <div className="whitespace-pre-wrap break-words">{m.message}</div>
                    <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
        </div>

        {closed ? (
          <div className="text-center text-xs text-muted-foreground py-3 border-t border-border/40">This ticket is closed.{role === "admin" && " You can re-open it above."}</div>
        ) : (
          <div className="border-t border-border/40 pt-3 flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
            <Button onClick={send} disabled={sending || !reply.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
