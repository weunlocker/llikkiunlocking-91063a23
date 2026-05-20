import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Gift, Users, DollarSign, Share2 } from "lucide-react";
import { toast } from "sonner";

type Settings = { enabled: boolean; percent: number; window_days: number; min_topup: number };
type Bonus = { id: string; bonus_amount: number; topup_amount: number; created_at: string; referred_user_id: string };
type Referee = { id: string; email: string | null; display_name: string | null; created_at: string };

export default function ReferralsPanel() {
  const { profile, user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, b, r] = await Promise.all([
        supabase.from("referral_settings").select("enabled,percent,window_days,min_topup").eq("id", 1).maybeSingle(),
        supabase.from("referral_bonuses").select("id,bonus_amount,topup_amount,created_at,referred_user_id").eq("referrer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,display_name,created_at").eq("referred_by", user.id).order("created_at", { ascending: false }),
      ]);
      setSettings(s.data as Settings | null);
      setBonuses((b.data ?? []) as Bonus[]);
      setReferees((r.data ?? []) as Referee[]);
      setLoading(false);
    })();
  }, [user]);

  const code = profile?.referral_code as string | undefined;
  // Always use the production custom domain for shareable referral links
  const PUBLIC_ORIGIN = "https://likkiunlocking.com";
  const link = code ? `${PUBLIC_ORIGIN}/register?ref=${code}` : "";
  const totalEarned = bonuses.reduce((s, b) => s + Number(b.bonus_amount), 0);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on LIKKI UNLOCKING", text: `Sign up using my link and I'll get a bonus on your first top-up!`, url: link }); } catch {}
    } else { copy(link, "Link"); }
  };

  if (loading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;

  if (settings && !settings.enabled) {
    return (
      <Card className="p-6 glass">
        <div className="flex items-center gap-3 text-muted-foreground"><Gift className="w-5 h-5" /> The referral program is currently disabled.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 glass">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3"><Gift className="w-6 h-6 text-primary" /></div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Refer & Earn {settings?.percent ?? 10}%</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Share your link. When your friend tops up at least ${settings?.min_topup ?? 5}, you get {settings?.percent ?? 10}% credited to your wallet — on every top-up for {settings?.window_days ?? 90} days.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 glass"><div className="flex items-center gap-3"><Users className="w-5 h-5 text-primary" /><div><div className="text-2xl font-bold">{referees.length}</div><div className="text-xs text-muted-foreground">Referred users</div></div></div></Card>
        <Card className="p-4 glass"><div className="flex items-center gap-3"><DollarSign className="w-5 h-5 text-success" /><div><div className="text-2xl font-bold">${totalEarned.toFixed(2)}</div><div className="text-xs text-muted-foreground">Total earned</div></div></div></Card>
        <Card className="p-4 glass"><div className="flex items-center gap-3"><Gift className="w-5 h-5 text-primary" /><div><div className="text-2xl font-bold">{bonuses.length}</div><div className="text-xs text-muted-foreground">Bonus payouts</div></div></div></Card>
      </div>

      <Card className="p-6 glass">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Your referral code</label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={code ?? ""} className="font-mono text-lg tracking-wider" />
              <Button variant="outline" onClick={() => copy(code ?? "", "Code")}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Your referral link</label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={link} />
              <Button variant="outline" onClick={() => copy(link, "Link")}><Copy className="w-4 h-4" /></Button>
              <Button variant="hero" onClick={share}><Share2 className="w-4 h-4 mr-1" />Share</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 glass">
        <h3 className="font-semibold mb-3">Bonus history</h3>
        {bonuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bonuses yet — share your link to start earning.</p>
        ) : (
          <div className="divide-y divide-border/50 text-sm">
            {bonuses.map((b) => (
              <div key={b.id} className="flex justify-between py-2">
                <span className="text-muted-foreground">{new Date(b.created_at).toLocaleString()}</span>
                <span>Top-up ${Number(b.topup_amount).toFixed(2)}</span>
                <span className="font-semibold text-success">+${Number(b.bonus_amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
