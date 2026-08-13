import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Wrench, AlertTriangle, Power } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Form = {
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
};

export default function AdminMaintenance() {
  const { refresh } = useSiteSettings();
  const [form, setForm] = useState<Form>({
    maintenance_enabled: false,
    maintenance_title: "",
    maintenance_message: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("maintenance_enabled, maintenance_title, maintenance_message")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error(error.message);
      else if (data) setForm(data as Form);
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.maintenance_title.trim()) return toast.error("Title is required");
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        maintenance_enabled: form.maintenance_enabled,
        maintenance_title: form.maintenance_title.trim().slice(0, 120),
        maintenance_message: form.maintenance_message.trim().slice(0, 1000),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success(form.maintenance_enabled ? "Maintenance mode is ON" : "Maintenance mode is OFF");
  };

  if (loading) {
    return (
      <AdminLayout title="Maintenance">
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Maintenance" subtitle="Temporarily close the website for visitors">
      <div className="max-w-3xl space-y-4">
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold">Maintenance mode</h3>
                <p className="text-sm text-muted-foreground">
                  When ON, every page shows the maintenance screen — no chat widget, contact button,
                  cookie banner or platform badge. Admins can still browse the site.
                </p>
              </div>
            </div>
            <Switch
              checked={form.maintenance_enabled}
              onCheckedChange={(v) => set("maintenance_enabled", v)}
            />
          </div>

          {form.maintenance_enabled && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Visitors and signed-in clients will not be able to use the site until you turn this off.
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.maintenance_title}
              maxLength={120}
              onChange={(e) => set("maintenance_title", e.target.value)}
              placeholder="We'll be back soon"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={4}
              maxLength={1000}
              value={form.maintenance_message}
              onChange={(e) => set("maintenance_message", e.target.value)}
              placeholder="Our site is currently undergoing scheduled maintenance."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
