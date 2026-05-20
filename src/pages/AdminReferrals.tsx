import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Gift } from "lucide-react";
import { toast } from "sonner";

type Settings = { enabled: boolean; percent: number; window_days: number; min_topup: number };
type BonusRow = {
  id: string; bonus_amount: number; topup_amount: number; created_at: string;
  referrer_id: string; referred_user_id: string;
  referrer?: { email: string | null; display_name: string | null } | null;
  referred?: { email: string | null; display_name: string | null } | null;
};

export default function AdminReferrals() {
  const [s, setS] = useState<Settings>({ enabled: true, percent: 10, window_days: 90, min_topup: 5 });
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [stats, setStats] = useState({ totalBonus: 0, totalReferrers: 0, totalReferred: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [ss, bb, refd] = await Promise.all([
      supabase.from("referral_settings").select("enabled,percent,window_days,min_topup").eq("id", 1).maybeSingle(),
      supabase.from("referral_bonuses").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,referred_by").not("referred_by", "is", null),
    ]);
    if (ss.data) setS(ss.data as Settings);
    const bonuses = (bb.data ?? []) as BonusRow[];
    const ids = Array.from(new Set(bonuses.flatMap((b) => [b.referrer_id, b.referred_user_id])));
    let profMap = new Map<string, { email: string | null; display_name: string | null }>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,email,display_name").in("id", ids);
      profMap = new Map((ps ?? []).map((p) => [p.id as string, { email: p.email as string | null, display_name: p.display_name as string | null }]));
    }
    setRows(bonuses.map((b) => ({ ...b, referrer: profMap.get(b.referrer_id) ?? null, referred: profMap.get(b.referred_user_id) ?? null })));
    const refRows = (refd.data ?? []) as { id: string; referred_by: string }[];
    setStats({
      totalBonus: bonuses.reduce((x, b) => x + Number(b.bonus_amount), 0),
      totalReferrers: new Set(refRows.map((r) => r.referred_by)).size,
      totalReferred: refRows.length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("referral_settings").update({
      enabled: s.enabled, percent: s.percent, window_days: s.window_days, min_topup: s.min_topup,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  return (
    <AdminLayout title="Referrals" subtitle="Manage the referral program and view payouts">
      <div className="space-y-6">
        <Card className="p-6 glass">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3"><Gift className="w-6 h-6 text-primary" /></div>
              <div>
                <h2 className="text-lg font-bold">Program settings</h2>
                <p className="text-xs text-muted-foreground">Toggle the program and tune the reward formula.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{s.enabled ? "ON" : "OFF"}</span>
              <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Commission %</Label>
              <Input type="number" step="0.1" value={s.percent} onChange={(e) => setS({ ...s, percent: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Active window (days)</Label>
              <Input type="number" value={s.window_days} onChange={(e) => setS({ ...s, window_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Min. top-up to qualify ($)</Label>
              <Input type="number" step="0.01" value={s.min_topup} onChange={(e) => setS({ ...s, min_topup: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={save} disabled={saving} variant="hero">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
          </div>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-4 glass"><div className="text-2xl font-bold">{stats.totalReferrers}</div><div className="text-xs text-muted-foreground">Active referrers</div></Card>
          <Card className="p-4 glass"><div className="text-2xl font-bold">{stats.totalReferred}</div><div className="text-xs text-muted-foreground">Referred users</div></Card>
          <Card className="p-4 glass"><div className="text-2xl font-bold">${stats.totalBonus.toFixed(2)}</div><div className="text-xs text-muted-foreground">Total bonuses paid</div></Card>
        </div>

        <Card className="p-6 glass">
          <h3 className="font-semibold mb-3">Recent bonuses</h3>
          {loading ? <Loader2 className="animate-spin mx-auto" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bonuses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border/50">
                  <tr><th className="py-2">Date</th><th>Referrer</th><th>Referred</th><th className="text-right">Top-up</th><th className="text-right">Bonus</th></tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.referrer?.email ?? r.referrer_id.slice(0, 8)}</td>
                      <td>{r.referred?.email ?? r.referred_user_id.slice(0, 8)}</td>
                      <td className="text-right">${Number(r.topup_amount).toFixed(2)}</td>
                      <td className="text-right text-success font-semibold">+${Number(r.bonus_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
