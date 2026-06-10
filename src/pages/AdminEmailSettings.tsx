import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Mail, Send, Lock } from "lucide-react";
import { toast } from "sonner";

type Tpl = { subject: string; html: string };
type Settings = {
  id: number;
  enabled: boolean;
  provider: "smtp" | "lovable";
  otp_login_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
  from_email: string | null;
  from_name: string;
  reply_to: string | null;
  tpl_welcome: Tpl;
  tpl_order_success: Tpl;
  tpl_order_rejected: Tpl;
  tpl_balance_update: Tpl;
};


const TPL_FIELDS = [
  { key: "tpl_welcome", label: "Welcome", vars: "{{name}}, {{site_name}}" },
  { key: "tpl_order_success", label: "Order Success", vars: "{{name}}, {{order_number}}, {{imei}}, {{service}}, {{result}}, {{charged}}, {{balance}}" },
  { key: "tpl_order_rejected", label: "Order Rejected", vars: "{{name}}, {{order_number}}, {{imei}}, {{service}}, {{error}}, {{refund}}, {{balance}}" },
  { key: "tpl_balance_update", label: "Balance Update", vars: "{{name}}, {{amount}}, {{balance}}, {{note}}" },
] as const;

export default function AdminEmailSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
      setS(data as unknown as Settings);
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((p) => (p ? { ...p, [k]: v } : p));

  const setTpl = (k: typeof TPL_FIELDS[number]["key"], patch: Partial<Tpl>) =>
    setS((p) => (p ? { ...p, [k]: { ...p[k], ...patch } } : p));

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("email_settings").update({
      enabled: s.enabled,
      provider: s.provider,
      otp_login_enabled: s.otp_login_enabled,
      smtp_host: s.smtp_host, smtp_port: s.smtp_port,
      smtp_user: s.smtp_user, smtp_password: s.smtp_password, smtp_secure: s.smtp_secure,
      from_email: s.from_email, from_name: s.from_name, reply_to: s.reply_to,
      tpl_welcome: s.tpl_welcome, tpl_order_success: s.tpl_order_success,
      tpl_order_rejected: s.tpl_order_rejected, tpl_balance_update: s.tpl_balance_update,
    }).eq("id", 1);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Email settings saved");
  };

  const sendTest = async () => {
    if (!testTo.trim()) return toast.error("Enter test recipient");
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { event: "test", to: testTo.trim() },
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    const result = data as { ok?: boolean; error?: string } | null;
    if (result?.ok) toast.success("Test sent ✓");
    else toast.error(result?.error ?? "Email test failed");
  };

  if (loading || !s) {
    return (
      <AdminLayout title="Email Settings"><div className="py-20 flex justify-center"><Loader2 className="animate-spin" /></div></AdminLayout>
    );
  }

  return (
    <AdminLayout title="Email Settings" subtitle="Configure SMTP and email templates">
      <div className="max-w-5xl space-y-4">
        <div className="glass rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="font-bold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email sending</div>
            <p className="text-xs text-muted-foreground">Master switch. When off, no app emails are sent.</p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </div>

        <div className="glass rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Gmail OTP login</div>
            <p className="text-xs text-muted-foreground">When on, users must enter a 6-digit code sent to their email after password.</p>
          </div>
          <Switch checked={s.otp_login_enabled} onCheckedChange={(v) => set("otp_login_enabled", v)} />
        </div>

        <Tabs defaultValue="smtp">
          <TabsList className="glass">
            <TabsTrigger value="smtp">SMTP</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>

          <TabsContent value="smtp" className="mt-4">
            <div className="glass rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>From Name (Sender Name)</Label>
                  <Input value={s.from_name ?? ""} onChange={(e) => set("from_name", e.target.value)} placeholder="LIKKI UNLOCKING" />
                </div>
                <div>
                  <Label>From Email</Label>
                  <Input value={s.from_email ?? ""} onChange={(e) => set("from_email", e.target.value)} placeholder="noreply@yourdomain.com" />
                </div>
              </div>
              <div>
                <Label>SMTP Host</Label>
                <Input value={s.smtp_host ?? ""} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <Label>SMTP Port</Label>
                <Input type="number" value={s.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} placeholder="587" />
              </div>
              <div>
                <Label>SMTP Username</Label>
                <Input value={s.smtp_user ?? ""} onChange={(e) => set("smtp_user", e.target.value)} placeholder="user@domain.com" />
              </div>
              <div>
                <Label>SMTP Password</Label>
                <Input type="password" value={s.smtp_password ?? ""} onChange={(e) => set("smtp_password", e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label>Reply-To (optional)</Label>
                <Input value={s.reply_to ?? ""} onChange={(e) => set("reply_to", e.target.value)} placeholder="support@yourdomain.com" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div>
                  <div className="text-sm font-medium">Use TLS/SSL</div>
                  <div className="text-xs text-muted-foreground">Recommended (port 465 or 587)</div>
                </div>
                <Switch checked={s.smtp_secure} onCheckedChange={(v) => set("smtp_secure", v)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            {TPL_FIELDS.map((f) => {
              const t = s[f.key];
              return (
                <div key={f.key} className="glass rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{f.label}</h3>
                    <span className="text-[10px] text-muted-foreground">Vars: {f.vars}</span>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input value={t.subject ?? ""} onChange={(e) => setTpl(f.key, { subject: e.target.value })} />
                  </div>
                  <div>
                    <Label>HTML Body</Label>
                    <Textarea rows={6} className="font-mono text-xs" value={t.html ?? ""} onChange={(e) => setTpl(f.key, { html: e.target.value })} />
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="test" className="mt-4">
            <div className="glass rounded-2xl p-6 space-y-3">
              <Label>Send test email to</Label>
              <div className="flex gap-2">
                <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                <Button onClick={sendTest} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Save settings first if you've changed them.</p>
              <p className="text-xs text-muted-foreground">If login fails, reset the mailbox password in your hosting panel and paste the new password here.</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
