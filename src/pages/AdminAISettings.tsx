import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Bot, KeyRound, Sparkles, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Settings = {
  ai_provider: "lovable" | "groq";
  ai_api_key: string | null;
};

export default function AdminAISettings() {
  const [settings, setSettings] = useState<Settings>({ ai_provider: "lovable", ai_api_key: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("ai_provider, ai_api_key")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setSettings({
          ai_provider: (data.ai_provider as "lovable" | "groq") || "lovable",
          ai_api_key: (data.ai_api_key as string) || "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        ai_provider: settings.ai_provider,
        ai_api_key: settings.ai_provider === "groq" ? settings.ai_api_key || null : null,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("AI settings saved");
  };

  if (loading) {
    return (
      <AdminLayout title="AI / Chatbot">
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const isGroq = settings.ai_provider === "groq";
  const keyLooksValid = !isGroq || /^gsk_[A-Za-z0-9_-]{40,}$/.test(settings.ai_api_key || "");

  return (
    <AdminLayout
      title="AI / Chatbot"
      subtitle="Choose the AI provider for service descriptions and the live chat assistant"
    >
      <div className="max-w-3xl space-y-4">
        {/* Provider card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold">AI Provider</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Lovable AI uses workspace credits. Groq uses your own API key (free 1,500 requests/day).
          </p>

          <Select value={settings.ai_provider} onValueChange={(v) => set("ai_provider", v as "lovable" | "groq")}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lovable">Lovable AI Gateway</SelectItem>
              <SelectItem value="groq">Groq (my own API key)</SelectItem>
            </SelectContent>
          </Select>

          {isGroq && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <Label className="font-semibold">Groq API Key</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Get a key from{" "}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      console.groq.com/keys <ExternalLink className="w-3 h-3" />
                    </a>
                    . It starts with <code className="text-xs bg-secondary px-1 rounded">gsk_</code>.
                  </p>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={settings.ai_api_key || ""}
                      onChange={(e) => set("ai_api_key", e.target.value)}
                      placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  {!keyLooksValid && settings.ai_api_key && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Key format looks wrong. Groq keys start with gsk_ and are long.
                    </div>
                  )}
                  {keyLooksValid && settings.ai_api_key && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-success">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Key format looks valid.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">AI Chatbot</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              The floating chat widget and support replies use the provider selected above. Groq is usually faster and costs no Lovable credits.
            </p>
          </div>
          <div className="glass rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Service Descriptions</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI description button in the service editor also uses this provider. Lovable credits are saved when Groq is active.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="hero" onClick={save} disabled={saving || (isGroq && !keyLooksValid)}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
