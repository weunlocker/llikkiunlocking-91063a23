import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ListOrdered, AlertTriangle, MessageSquare, CreditCard, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type NotifItem = {
  id: string;
  icon: typeof Bell;
  title: string;
  description: string;
  to: string;
  tone: "warning" | "info" | "danger";
  time?: string;
};

const STUCK_MINUTES = 60;

export default function AdminNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [stuckOrders, setStuckOrders] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const stuckCutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();
    const [po, so, st, pp] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, imei, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("id, order_number, imei, status, created_at")
        .in("status", ["in_process"])
        .lt("created_at", stuckCutoff)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("support_tickets")
        .select("id, subject, last_message_at, status")
        .eq("unread_for_admin", true)
        .neq("status", "closed")
        .order("last_message_at", { ascending: false })
        .limit(10),
      supabase
        .from("payment_orders")
        .select("id, user_id, provider, amount, currency, coin, memo, status, created_at")
        .in("status", ["pending", "awaiting_review"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setPendingOrders(po.data ?? []);
    setStuckOrders(so.data ?? []);
    setSupportTickets(st.data ?? []);
    const payments = pp.data ?? [];
    // Enrich payments with user email so the notification is meaningful
    const userIds = Array.from(new Set(payments.map((p: any) => p.user_id).filter(Boolean)));
    let emailMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email,display_name").in("id", userIds);
      (profs ?? []).forEach((p: any) => { emailMap[p.id] = p.display_name || p.email || ""; });
    }
    setPendingPayments(payments.map((p: any) => ({ ...p, _user: emailMap[p.user_id] || "unknown user" })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_orders" }, load)
      .subscribe();
    const t = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  const items: NotifItem[] = useMemo(() => {
    const list: NotifItem[] = [];
    stuckOrders.forEach((o) =>
      list.push({
        id: `stuck-${o.id}`,
        icon: AlertTriangle,
        title: `Stuck order #${o.order_number ?? o.id.slice(0, 6)}`,
        description: `Processing > ${STUCK_MINUTES}m${o.imei ? ` · ${o.imei}` : ""}`,
        to: `/admin/orders?focus=${o.id}`,
        tone: "danger",
        time: o.created_at,
      })
    );
    pendingOrders.forEach((o) =>
      list.push({
        id: `pending-${o.id}`,
        icon: ListOrdered,
        title: `New order #${o.order_number ?? o.id.slice(0, 6)}`,
        description: `Awaiting processing${o.imei ? ` · ${o.imei}` : ""}`,
        to: `/admin/orders?focus=${o.id}`,
        tone: "warning",
        time: o.created_at,
      })
    );
    supportTickets.forEach((t) =>
      list.push({
        id: `ticket-${t.id}`,
        icon: MessageSquare,
        title: t.subject || "New support message",
        description: "Unread reply from user",
        to: `/admin/support`,
        tone: "info",
        time: t.last_message_at,
      })
    );
    pendingPayments.forEach((p) =>
      list.push({
        id: `pay-${p.id}`,
        icon: CreditCard,
        title: `Top-up ${p.amount} ${p.currency || ""}`.trim(),
        description: `${p.provider} · ${p.status}`,
        to: `/admin/payments`,
        tone: "info",
        time: p.created_at,
      })
    );
    return list;
  }, [pendingOrders, stuckOrders, supportTickets, pendingPayments]);

  const total = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold border-2 border-background">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-[11px] text-muted-foreground">
              {total > 0 ? `${total} need attention` : "All clear"}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
        <div className="overflow-y-auto divide-y divide-border/60">
          {total === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Inbox className="w-8 h-8" />
              <div className="text-xs">No pending notifications</div>
            </div>
          )}
          {items.map((it) => {
            const Icon = it.icon;
            const toneClass =
              it.tone === "danger"
                ? "text-destructive bg-destructive/10"
                : it.tone === "warning"
                  ? "text-amber-500 bg-amber-500/10"
                  : "text-primary bg-primary/10";
            return (
              <Link
                key={it.id}
                to={it.to}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
              >
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${toneClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{it.description}</div>
                  {it.time && (
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(it.time).toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        <div className="border-t border-border/60 p-2 flex gap-2">
          <Button asChild variant="ghost" size="sm" className="flex-1">
            <Link to="/admin/orders" onClick={() => setOpen(false)}>Orders</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="flex-1">
            <Link to="/admin/support" onClick={() => setOpen(false)}>Support</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="flex-1">
            <Link to="/admin/payments" onClick={() => setOpen(false)}>Payments</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
