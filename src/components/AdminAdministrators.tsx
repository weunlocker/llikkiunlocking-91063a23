import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, ShieldCheck, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ConfirmDialog";

type AdminRow = {
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
};

type Profile = { id: string; email: string | null; display_name: string | null };

export default function AdminAdministrators() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<string>("");
  const [role, setRole] = useState<string>("admin");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    let profMap = new Map<string, Profile>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .in("id", ids);
      profMap = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
    }
    setAdmins(
      (roles ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        email: profMap.get(r.user_id)?.email ?? null,
        display_name: profMap.get(r.user_id)?.display_name ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = async () => {
    setOpen(true);
    setPicked("");
    setRole("admin");
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .order("email")
      .limit(500);
    setUsers((data ?? []) as Profile[]);
  };

  const filteredUsers = useMemo(() => {
    const taken = new Set(admins.filter((a) => a.role === "admin").map((a) => a.user_id));
    return users.filter((u) => {
      if (taken.has(u.id)) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (u.email ?? "").toLowerCase().includes(s) || (u.display_name ?? "").toLowerCase().includes(s);
    });
  }, [users, q, admins]);

  const addAdmin = async () => {
    if (!picked) { toast.error("Pick a user"); return; }
    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: picked, role: role as "admin" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Administrator added");
    setOpen(false);
    load();
  };

  const removeAdmin = async (row: AdminRow) => {
    if (row.user_id === user?.id) { toast.error("You cannot remove yourself"); return; }
    const ok = await confirm({
      title: "Remove administrator?",
      description: `Revoke ${row.role} from ${row.email ?? row.user_id}.`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", row.user_id)
      .eq("role", row.role as "admin");
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{admins.length} role assignments</p>
        <Button variant="hero" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Administrator</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={`${a.user_id}-${a.role}`} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-5 py-3">{a.email ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.display_name}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> {a.role}
                    </span>
                    {a.user_id === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAdmin(a)}
                      disabled={a.user_id === user?.id}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No administrators yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Add Administrator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search user</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Pick user</Label>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email ?? u.id}{u.display_name ? ` — ${u.display_name}` : ""}
                    </SelectItem>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No matching users.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Admins can manage users, services, orders, payments and settings.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={addAdmin} disabled={saving || !picked}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Grant Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
