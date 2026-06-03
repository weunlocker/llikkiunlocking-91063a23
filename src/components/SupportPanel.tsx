import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, MessageSquare, Send, ImagePlus, X } from "lucide-react";
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

const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5MB

async function uploadAttachment(file: File, userId: string): Promise<string | null> {
  if (!file.type.startsWith("image/")) { toast.error("Only images allowed"); return null; }
  if (file.size > MAX_IMG_BYTES) { toast.error("Image too large (max 5MB)"); return null; }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("support-attachments").upload(path, file, { contentType: file.type });
  if (error) { toast.error(error.message); return null; }
  // Store a private storage reference. MessageBody resolves it to a short-lived signed URL on render.
  return `sb:support-attachments/${path}`;
}

// Extract a storage path from either a new sb: reference or a legacy public URL.
function extractStoragePath(ref: string): string | null {
  if (ref.startsWith("sb:support-attachments/")) return ref.slice("sb:support-attachments/".length);
  const m = ref.match(/\/support-attachments\/(.+?)(?:\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function SignedImage({ refStr }: { refStr: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const path = extractStoragePath(refStr);
    if (!path) { setUrl(refStr); return; }
    supabase.storage.from("support-attachments").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [refStr]);
  if (!url) return <div className="h-32 w-48 rounded-lg bg-muted/50 animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt="Uploaded attachment" className="rounded-lg max-h-64 max-w-full border border-border/40" />
    </a>
  );
}

function MessageBody({ text }: { text: string }) {
  // render ![](ref) inline images, rest as plain text. Refs may be sb:..., http(s)://...
  const parts: Array<{ type: "text" | "img"; value: string }> = [];
  const re = /!\[[^\]]*\]\((sb:[^\s)]+|https?:\/\/[^\s)]+)\)/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "img", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return (
    <div className="space-y-2">
      {parts.map((p, i) => p.type === "img" ? (
        <SignedImage key={i} refStr={p.value} />
      ) : (
        p.value.trim() && <div key={i} className="whitespace-pre-wrap break-words">{p.value}</div>
      ))}
    </div>
  );
}


function AttachmentPicker({ onUpload, disabled }: { onUpload: (url: string) => void; disabled?: boolean }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!user || !files || files.length === 0) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const url = await uploadAttachment(f, user.id);
      if (url) onUpload(url);
    }
    setBusy(false);
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="icon" disabled={disabled || busy}
        onClick={() => fileRef.current?.click()} title="Attach image">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
      </Button>
    </>
  );
}

export default function SupportPanel() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [firstMessage, setFirstMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
    if (firstMessage.trim().length < 3 && attachments.length === 0) { toast.error("Add a message or image"); return; }
    setSubmitting(true);
    const { data: t, error } = await supabase.from("support_tickets")
      .insert({ user_id: user.id, subject: subject.trim(), priority })
      .select("*").maybeSingle();
    if (error || !t) { setSubmitting(false); toast.error(error?.message || "Failed"); return; }
    const body = [firstMessage.trim(), ...attachments.map((u) => `![image](${u})`)].filter(Boolean).join("\n\n");
    const { error: mErr } = await supabase.from("support_ticket_messages")
      .insert({ ticket_id: t.id, sender_id: user.id, sender_type: "user", message: body });
    setSubmitting(false);
    if (mErr) { toast.error(mErr.message); return; }
    supabase.functions.invoke("notify-support-event", {
      body: { ticket_id: t.id, event: "created", preview: body },
    }).catch(() => {});
    toast.success("Ticket created");
    setCreating(false); setSubject(""); setFirstMessage(""); setPriority("normal"); setAttachments([]);
    load();
    setOpenTicket(t as Ticket);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!user || !files) return;
    for (const f of Array.from(files)) {
      const url = await uploadAttachment(f, user.id);
      if (url) setAttachments((a) => [...a, url]);
    }
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

      <Dialog open={creating} onOpenChange={(o) => { setCreating(o); if (!o) setAttachments([]); }}>
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
            <div>
              <Label>Message</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                className={`rounded-md border ${dragOver ? "border-primary bg-primary/5" : "border-border"} transition-colors`}
              >
                <Textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  onPaste={(e) => {
                    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                    if (imgs.length) {
                      e.preventDefault();
                      const dt = new DataTransfer();
                      imgs.forEach((f) => dt.items.add(f));
                      handleFiles(dt.files);
                    }
                  }}
                  rows={5}
                  placeholder="Describe your issue… (drop, paste, or attach images)"
                  className="border-0 focus-visible:ring-0"
                />
              </div>
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((u, i) => (
                  <div key={u} className="relative group">
                    <img src={u} alt="" className="w-20 h-20 object-cover rounded border border-border" />
                    <button type="button" aria-label="Remove attachment" onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center gap-2">
              <AttachmentPicker onUpload={(u) => setAttachments((a) => [...a, u])} />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                <Button onClick={submitNew} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create ticket</Button>
              </div>
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
  const [pending, setPending] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closed = ticket?.status === "closed";

  useEffect(() => {
    if (!ticket) { setMessages([]); setPending([]); setReply(""); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("support_ticket_messages")
        .select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      if (!active) return;
      setMessages((data ?? []) as Message[]);
      setLoading(false);
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
  }, [messages, pending]);

  const handleFiles = async (files: FileList | null) => {
    if (!user || !files) return;
    for (const f of Array.from(files)) {
      const url = await uploadAttachment(f, user.id);
      if (url) setPending((a) => [...a, url]);
    }
  };

  const send = async () => {
    if (!ticket || !user) return;
    const text = reply.trim();
    if (text.length < 1 && pending.length === 0) return;
    setSending(true);
    const body = [text, ...pending.map((u) => `![image](${u})`)].filter(Boolean).join("\n\n");
    const { error } = await supabase.from("support_ticket_messages")
      .insert({ ticket_id: ticket.id, sender_id: user.id, sender_type: role, message: body });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    supabase.functions.invoke("notify-support-event", {
      body: {
        ticket_id: ticket.id,
        event: role === "admin" ? "admin_reply" : "user_message",
        preview: body,
      },
    }).catch(() => {});
    setReply(""); setPending([]);
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
                    <MessageBody text={m.message} />
                    <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
        </div>

        {closed ? (
          <div className="text-center text-xs text-muted-foreground py-3 border-t border-border/40">This ticket is closed.{role === "admin" && " You can re-open it above."}</div>
        ) : (
          <div className="border-t border-border/40 pt-3 space-y-2">
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pending.map((u, i) => (
                  <div key={u} className="relative">
                    <img src={u} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                    <button type="button" aria-label="Remove attachment" onClick={() => setPending((a) => a.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              className={`flex gap-2 rounded-md ${dragOver ? "ring-2 ring-primary" : ""}`}
            >
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onPaste={(e) => {
                  const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                  if (imgs.length) {
                    e.preventDefault();
                    const dt = new DataTransfer();
                    imgs.forEach((f) => dt.items.add(f));
                    handleFiles(dt.files);
                  }
                }}
                placeholder="Type your reply… (drop, paste, or attach images)"
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
              />
              <div className="flex flex-col gap-2">
                <AttachmentPicker onUpload={(u) => setPending((a) => [...a, u])} />
                <Button onClick={send} disabled={sending || (!reply.trim() && pending.length === 0)} size="icon">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
