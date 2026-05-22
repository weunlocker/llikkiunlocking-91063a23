import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, ListOrdered, TrendingUp, Users as UsersIcon, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend,
} from "recharts";
import { exportRowsCsv } from "@/lib/invoice";
import { toast } from "sonner";

type OrderRow = {
  id: string; user_id: string; service_id: string; status: string;
  price_charged: number; created_at: string;
};
type ProfileRow = { id: string; email: string | null; display_name: string | null; created_at: string };
type ServiceRow = { id: string; name: string };

const RANGES: Record<string, number | null> = {
  "today": 0,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "all": null,
};

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayKey(d: Date): string { return startOfDay(d).toISOString().slice(0, 10); }

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [range, setRange] = useState<keyof typeof RANGES>("30d");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, p, s] = await Promise.all([
        supabase.from("orders").select("id,user_id,service_id,status,price_charged,created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("services").select("id,name").limit(2000),
      ]);
      setOrders((o.data ?? []) as OrderRow[]);
      setProfiles((p.data ?? []) as ProfileRow[]);
      setServices((s.data ?? []) as ServiceRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const days = RANGES[range];
    if (days === null) return orders;
    const cutoff = new Date();
    if (days === 0) cutoff.setHours(0,0,0,0);
    else { cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0,0,0,0); }
    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, range]);

  const kpis = useMemo(() => {
    const completed = filtered.filter((o) => o.status === "completed");
    const revenue = completed.reduce((a, o) => a + Number(o.price_charged || 0), 0);
    const total = filtered.length;
    const successRate = total ? (completed.length / total) * 100 : 0;
    const activeUsers = new Set(filtered.map((o) => o.user_id)).size;
    return { revenue, total, successRate, activeUsers, completed: completed.length };
  }, [filtered]);

  const dailyRevenue = useMemo(() => {
    const days = RANGES[range] ?? 30;
    const buckets: { day: string; revenue: number; orders: number; completed: number; failed: number; pending: number; refunded: number }[] = [];
    const start = new Date(); start.setHours(0,0,0,0);
    start.setDate(start.getDate() - (days === 0 ? 0 : days - 1));
    const span = days === 0 ? 1 : days;
    for (let i = 0; i < span; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      buckets.push({ day: dayKey(d), revenue: 0, orders: 0, completed: 0, failed: 0, pending: 0, refunded: 0 });
    }
    const map = new Map(buckets.map((b) => [b.day, b]));
    for (const o of filtered) {
      const k = dayKey(new Date(o.created_at));
      const b = map.get(k);
      if (!b) continue;
      b.orders += 1;
      if (o.status === "completed") { b.completed += 1; b.revenue += Number(o.price_charged || 0); }
      else if (o.status === "failed") b.failed += 1;
      else if (o.status === "refunded") b.refunded += 1;
      else b.pending += 1;
    }
    return buckets.map((b) => ({ ...b, label: b.day.slice(5), revenue: +b.revenue.toFixed(2) }));
  }, [filtered, range]);

  const topServices = useMemo(() => {
    const map = new Map<string, { id: string; count: number; revenue: number }>();
    for (const o of filtered) {
      const m = map.get(o.service_id) ?? { id: o.service_id, count: 0, revenue: 0 };
      m.count += 1;
      if (o.status === "completed") m.revenue += Number(o.price_charged || 0);
      map.set(o.service_id, m);
    }
    const svcName = new Map(services.map((s) => [s.id, s.name]));
    return Array.from(map.values())
      .map((x) => ({ ...x, name: svcName.get(x.id) ?? "—" }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filtered, services]);

  const topUsers = useMemo(() => {
    const map = new Map<string, { id: string; spend: number; orders: number }>();
    for (const o of filtered) {
      const m = map.get(o.user_id) ?? { id: o.user_id, spend: 0, orders: 0 };
      m.orders += 1;
      if (o.status === "completed") m.spend += Number(o.price_charged || 0);
      map.set(o.user_id, m);
    }
    const pmap = new Map(profiles.map((p) => [p.id, p]));
    return Array.from(map.values())
      .map((x) => ({ ...x, email: pmap.get(x.id)?.email ?? "—", name: pmap.get(x.id)?.display_name ?? "" }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  }, [filtered, profiles]);

  const userGrowth = useMemo(() => {
    const days = RANGES[range] ?? 30;
    const start = new Date(); start.setHours(0,0,0,0);
    start.setDate(start.getDate() - (days === 0 ? 0 : days - 1));
    const span = days === 0 ? 1 : days;
    const buckets = new Map<string, number>();
    for (let i = 0; i < span; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      buckets.set(dayKey(d), 0);
    }
    for (const p of profiles) {
      const k = dayKey(new Date(p.created_at));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([day, signups]) => ({ label: day.slice(5), signups }));
  }, [profiles, range]);

  if (loading) {
    return <AdminLayout title="Analytics"><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout
      title="Analytics"
      subtitle="Business intelligence and performance metrics"
      actions={
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => {
            exportRowsCsv(dailyRevenue.map(({ day, revenue, orders, completed, failed, pending, refunded }) => ({
              day, revenue, orders, completed, failed, pending, refunded,
            })), `analytics-${range}-${new Date().toISOString().slice(0,10)}.csv`);
            toast.success("Exported");
          }}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Revenue" value={`$${kpis.revenue.toFixed(2)}`} icon={DollarSign} color="text-success" />
        <KpiCard label="Orders" value={kpis.total.toLocaleString()} icon={ListOrdered} color="text-primary" />
        <KpiCard label="Success Rate" value={`${kpis.successRate.toFixed(1)}%`} icon={TrendingUp} color="text-warning" />
        <KpiCard label="Active Users" value={kpis.activeUsers.toLocaleString()} icon={UsersIcon} color="text-info" />
      </div>

      {/* Revenue trend */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Revenue trend</h2>
          <div className="text-xs text-muted-foreground">${kpis.revenue.toFixed(2)} • {kpis.completed} completed orders</div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders breakdown */}
      <div className="glass rounded-2xl p-4 mb-6">
        <h2 className="font-bold mb-3">Orders by status</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" stackId="a" fill="hsl(var(--success))" />
              <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="pending" stackId="a" fill="hsl(var(--warning))" />
              <Bar dataKey="refunded" stackId="a" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User growth */}
      <div className="glass rounded-2xl p-4 mb-6">
        <h2 className="font-bold mb-3">New signups</h2>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="signups" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top services + users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-4">
          <h2 className="font-bold mb-3">Top services</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Service</th><th className="text-right py-2">Orders</th><th className="text-right py-2">Revenue</th></tr></thead>
            <tbody>
              {topServices.length === 0 ? <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No data</td></tr> :
                topServices.map((s) => (
                  <tr key={s.id} className="border-t border-border/40">
                    <td className="py-2 max-w-[260px] truncate" title={s.name}>{s.name}</td>
                    <td className="py-2 text-right font-mono">{s.count}</td>
                    <td className="py-2 text-right font-mono text-success">${s.revenue.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="glass rounded-2xl p-4">
          <h2 className="font-bold mb-3">Top users</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">User</th><th className="text-right py-2">Orders</th><th className="text-right py-2">Spend</th></tr></thead>
            <tbody>
              {topUsers.length === 0 ? <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No data</td></tr> :
                topUsers.map((u) => (
                  <tr key={u.id} className="border-t border-border/40">
                    <td className="py-2 max-w-[240px] truncate" title={u.email}>{u.name || u.email}</td>
                    <td className="py-2 text-right font-mono">{u.orders}</td>
                    <td className="py-2 text-right font-mono text-success">${u.spend.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
