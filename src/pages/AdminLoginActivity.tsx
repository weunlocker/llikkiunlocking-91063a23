import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoginEvent = {
  id: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
};
type Profile = { id: string; email: string | null; display_name: string | null };

const ONLINE_WINDOW_MIN = 10;

export default function AdminLoginActivity() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"online" | "recent">("online");

  const load = async () => {
    setLoading(true);
    const { data: evs } = await supabase
      .from("auth_login_events")
      .select("id,user_id,email,ip,user_agent,success,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (evs ?? []) as LoginEvent[];
    setEvents(list);
    const ids = Array.from(new Set(list.map((e) => e.user_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .in("id", ids);
      setProfiles(new Map((profs ?? []).map((p) => [p.id, p as Profile])));
    } else {
      setProfiles(new Map());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const cutoff = useMemo(() => Date.now() - ONLINE_WINDOW_MIN * 60_000, []);

  const onlineUsers = useMemo(() => {
    // Latest successful login per user within window
    const map = new Map<string, LoginEvent>();
    for (const e of events) {
      if (!e.success || !e.user_id) continue;
      if (new Date(e.created_at).getTime() < cutoff) continue;
      if (!map.has(e.user_id)) map.set(e.user_id, e);
    }
    return Array.from(map.values());
  }, [events, cutoff]);

  const lastLoginPerUser = useMemo(() => {
    const map = new Map<string, LoginEvent>();
    for (const e of events) {
      if (!e.success || !e.user_id) continue;
      if (!map.has(e.user_id)) map.set(e.user_id, e);
    }
    return Array.from(map.values());
  }, [events]);

  const filter = (rows: LoginEvent[]) => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((e) => {
      const p = e.user_id ? profiles.get(e.user_id) : undefined;
      return (
        (e.email ?? "").toLowerCase().includes(s) ||
        (p?.email ?? "").toLowerCase().includes(s) ||
        (p?.display_name ?? "").toLowerCase().includes(s) ||
        (e.ip ?? "").toLowerCase().includes(s)
      );
    });
  };

  const rows = filter(tab === "online" ? onlineUsers : lastLoginPerUser);

  return (
    <AdminLayout
      title="Login Activity"
      subtitle={`${onlineUsers.length} online now (active within ${ONLINE_WINDOW_MIN} min)`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search email, name, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      }
    >
      <div className="flex gap-2 mb-4">
        <Button variant={tab === "online" ? "neon" : "ghost"} size="sm" onClick={() => setTab("online")}>
          <Circle className="w-3 h-3 mr-2 fill-success text-success" /> Online ({onlineUsers.length})
        </Button>
        <Button variant={tab === "recent" ? "neon" : "ghost"} size="sm" onClick={() => setTab("recent")}>
          Last Logins ({lastLoginPerUser.length})
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Login Time</th>
                <th className="px-5 py-3">Login IP</th>
                <th className="px-5 py-3">Device</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const p = e.user_id ? profiles.get(e.user_id) : undefined;
                const isOnline = new Date(e.created_at).getTime() >= cutoff;
                return (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-secondary/20">
                    <td className="px-5 py-3 flex items-center gap-2">
                      {isOnline && <Circle className="w-2 h-2 fill-success text-success" />}
                      <span>{p?.display_name || "—"}</span>
                    </td>
                    <td className="px-5 py-3">{p?.email || e.email || "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-xs">{e.ip || "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-[260px] truncate" title={e.user_agent ?? undefined}>{e.user_agent || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No {tab === "online" ? "online users" : "login records"}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
