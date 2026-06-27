import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

type TemplatePreview = {
  templateName: string;
  displayName: string;
  subject: string;
  html: string;
  status: "ready" | "preview_data_required" | "render_failed";
  errorMessage?: string;
};

export default function AdminEmailTemplates() {
  const [items, setItems] = useState<TemplatePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("preview-transactional-email", {
      method: "POST",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Failed to load previews");
      return;
    }
    setItems((data as { templates: TemplatePreview[] })?.templates ?? []);
  };

  useEffect(() => { load(); }, []);

  const sendTest = async (templateName: string) => {
    if (!testEmail) { toast.error("Enter a test email first"); return; }
    setSendingFor(templateName);
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName,
        recipientEmail: testEmail,
        idempotencyKey: `preview-${templateName}-${Date.now()}`,
        templateData: items.find((i) => i.templateName === templateName)?.html
          ? {} // server uses previewData merged by template if none provided; we send previewData via templateData below
          : {},
      },
    });
    setSendingFor(null);
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error || error?.message || "Send failed");
    } else {
      toast.success(`Sent ${templateName} to ${testEmail}`);
    }
  };

  const ready = useMemo(() => items.filter((i) => i.status === "ready"), [items]);

  return (
    <AdminLayout
      title="Email Templates"
      subtitle="Preview every transactional email (placed, success, rejected, and others) with the same branded shell."
      actions={
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      }
    >
      <Card className="p-4 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          type="email"
          placeholder="you@example.com"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          className="sm:max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Optional — enter an email and click "Send test" on any template below to receive it via the configured provider.
        </p>
      </Card>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((t) => (
            <Card key={t.templateName} className="overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-3 p-3 border-b">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.subject || t.templateName}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={t.status !== "ready" || sendingFor === t.templateName}
                  onClick={() => sendTest(t.templateName)}
                >
                  {sendingFor === t.templateName ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">Send test</span>
                </Button>
              </div>
              {t.status === "ready" ? (
                <iframe
                  title={t.displayName}
                  srcDoc={t.html}
                  className="w-full h-[520px] bg-white"
                  sandbox=""
                />
              ) : (
                <div className="p-6 text-sm text-destructive">
                  {t.status === "render_failed"
                    ? `Render failed: ${t.errorMessage}`
                    : "Preview data required for this template."}
                </div>
              )}
            </Card>
          ))}
          {!loading && ready.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates available.</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
