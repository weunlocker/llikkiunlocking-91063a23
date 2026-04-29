import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet, CheckCircle2, XCircle, Clock, List, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { imeiSchema } from "@/lib/validation";

type Service = { id: string; name: string; price: number; delivery_time: string; sample_result?: string | null; result_font?: string | null; result_color?: string | null };

type SingleResult = { status: string; result?: string; error?: string } | null;

type BulkRow = {
  imei: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
};

export type ImeiCheckDialogProps = {
  service: Service | null;
  balance: number;
  onClose: () => void;
  onAfterRun?: () => void;
};

const FONT_MAP: Record<string, string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  sans: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  serif: "Georgia, Cambria, Times New Roman, serif",
};
const fontCss = (key?: string | null) => FONT_MAP[key ?? "mono"] ?? FONT_MAP.mono;

// Renders a result string with auto-highlighted labels (Label: value).
function ColoredResult({ text, font, color }: { text: string; font: string; color: string }) {
  const lines = (text || "").split("\n");
  return (
    <pre
      className="glass rounded-md p-4 text-xs whitespace-pre-wrap break-words max-h-80 overflow-auto leading-relaxed"
      style={{ fontFamily: font }}
    >
      {lines.map((line, i) => {
        const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
        if (m) {
          return (
            <div key={i}>
              <span className="font-semibold" style={{ color }}>{m[1]}:</span>{" "}
              <span className="text-foreground">{m[2]}</span>
            </div>
          );
        }
        return <div key={i} className="text-foreground">{line || "\u00a0"}</div>;
      })}
    </pre>
  );
}

export default function ImeiCheckDialog({ service, balance, onClose, onAfterRun }: ImeiCheckDialogProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [imei, setImei] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SingleResult>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [showSample, setShowSample] = useState(false);

  const font = fontCss(service?.result_font);
  const color = service?.result_color || "#e2e8f0";

  useEffect(() => {
    if (service) {
      setTab("single"); setImei(""); setBulkText(""); setResult(null); setRows([]); setShowSample(false);
    }
  }, [service?.id]);

  if (!service) return null;
  const price = Number(service.price);

  const submitSingle = async () => {
    const parsed = imeiSchema.safeParse(imei);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (balance < price) { toast.error("Insufficient balance. Please top up."); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("check-imei", {
      body: { service_id: service.id, imei: parsed.data },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setResult(data);
    onAfterRun?.();
    if (data?.status === "completed") toast.success("Check complete");
    else if (data?.status === "failed") toast.error(data?.error ?? "Check failed");
    else if (data?.status === "pending") toast.info("Order queued — you'll be notified when ready");
  };

  const parseBulk = (): string[] => {
    const lines = bulkText.split(/[\s,;\n]+/).map((l) => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    return lines.filter((l) => { if (seen.has(l)) return false; seen.add(l); return true; });
  };

  const bulkList = parseBulk();
  const bulkValid = bulkList.filter((l) => imeiSchema.safeParse(l).success);
  const bulkInvalid = bulkList.length - bulkValid.length;
  const totalCost = bulkValid.length * price;

  const submitBulk = async () => {
    if (bulkValid.length === 0) { toast.error("Add at least one valid IMEI/Serial"); return; }
    if (balance < totalCost) { toast.error(`Need $${totalCost.toFixed(2)} — top up your wallet first.`); return; }

    const initial: BulkRow[] = bulkValid.map((i) => ({ imei: i, status: "pending" }));
    setRows(initial);
    setSubmitting(true);

    let remainingBalance = balance;
    for (let i = 0; i < initial.length; i++) {
      if (remainingBalance < price) {
        setRows((prev) => prev.map((r, idx) => idx >= i ? { ...r, status: "failed", error: "Skipped — insufficient balance" } : r));
        break;
      }
      setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "running" } : r));
      try {
        const { data, error } = await supabase.functions.invoke("check-imei", {
          body: { service_id: service.id, imei: initial[i].imei },
        });
        if (error) {
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: error.message } : r));
        } else if (data?.status === "completed") {
          remainingBalance -= price;
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "completed", result: data.result } : r));
        } else if (data?.status === "pending") {
          remainingBalance -= price;
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "completed", result: "Queued — check Orders tab" } : r));
        } else {
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: data?.error ?? "Check failed" } : r));
        }
      } catch (e) {
        setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: e instanceof Error ? e.message : "Network error" } : r));
      }
      onAfterRun?.();
    }

    setSubmitting(false);
    setRows((prev) => {
      const okCount = prev.filter((r) => r.status === "completed").length;
      toast.success(`Bulk done — ${okCount}/${bulkValid.length} succeeded`);
      return prev;
    });
  };

  const reset = () => { setResult(null); setRows([]); setImei(""); setBulkText(""); };

  const ResultToolbar: React.ReactNode = null;

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-2xl w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Smartphone className="w-5 h-5 text-primary shrink-0" />
            <span className="break-words">{service.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Cost per check: <span className="font-mono text-primary font-bold">${price.toFixed(2)}</span>
            {" · "}<Clock className="w-3 h-3 inline" /> {service.delivery_time}
          </DialogDescription>
        </DialogHeader>

        {!result && rows.length === 0 ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "bulk")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="single"><Smartphone className="w-4 h-4 mr-2" />Single</TabsTrigger>
              <TabsTrigger value="bulk"><List className="w-4 h-4 mr-2" />Bulk</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 pt-4">
              <div>
                <Label htmlFor="imei-single">IMEI / Serial</Label>
                <Input id="imei-single" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="e.g. 356938035643809" maxLength={20} className="font-mono" />
              </div>
              <div className="flex items-center justify-between text-sm glass rounded-md p-3">
                <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Your balance</span>
                <span className="font-mono font-bold">${balance.toFixed(2)}</span>
              </div>

              {service.sample_result && service.sample_result.trim() && (
                <div className="rounded-lg border border-border/50 p-3">
                  <button type="button" onClick={() => setShowSample((v) => !v)} className="text-xs text-primary hover:underline">
                    {showSample ? "Hide" : "Show"} sample result preview
                  </button>
                  {showSample && (
                    <div className="mt-3 space-y-2">
                      {ResultToolbar}
                      <ColoredResult text={service.sample_result} font={font} color={color} />
                    </div>
                  )}
                </div>
              )}

              <Button variant="hero" className="w-full" onClick={submitSingle} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Check
              </Button>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4 pt-4">
              <div>
                <Label htmlFor="imei-bulk">IMEI / Serial list</Label>
                <Textarea
                  id="imei-bulk"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"One per line, or separated by spaces / commas:\n356938035643809\n356938035643810\n356938035643811"}
                  rows={6}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {bulkValid.length} valid · {bulkInvalid > 0 && <span className="text-warning">{bulkInvalid} invalid · </span>}
                  Total: <span className="font-mono text-primary font-bold">${totalCost.toFixed(2)}</span>
                </p>
              </div>
              <div className="flex items-center justify-between text-sm glass rounded-md p-3">
                <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Your balance</span>
                <span className={`font-mono font-bold ${balance < totalCost ? "text-destructive" : ""}`}>${balance.toFixed(2)}</span>
              </div>
              <Button variant="hero" className="w-full" onClick={submitBulk} disabled={submitting || bulkValid.length === 0 || balance < totalCost}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Run {bulkValid.length} check{bulkValid.length === 1 ? "" : "s"} (${totalCost.toFixed(2)})
              </Button>
            </TabsContent>
          </Tabs>
        ) : result ? (
          <div className="space-y-3">
            {result.status === "completed" ? (
              <div className="flex items-center gap-3 text-success"><CheckCircle2 className="w-6 h-6" /> Check completed</div>
            ) : result.status === "pending" ? (
              <div className="flex items-center gap-3 text-warning"><Loader2 className="w-6 h-6 animate-spin" /> Order queued — you'll be notified</div>
            ) : (
              <div className="flex items-center gap-3 text-destructive"><XCircle className="w-6 h-6" /> Check failed</div>
            )}
            {ResultToolbar}
            <ColoredResult text={result.result || result.error || "No response"} font={font} color={color} />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="glass"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.result || result.error || "");
                  toast.success("Copied");
                }}
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <Button variant="glass" className="flex-1" onClick={reset}>Run another</Button>
              <Button variant="hero" className="flex-1" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {submitting ? "Running checks…" : "Bulk run finished"} ({rows.filter((r) => r.status === "completed").length}/{rows.length} succeeded)
            </div>
            {ResultToolbar}
            <div className="max-h-96 overflow-y-auto rounded border border-border/50 divide-y divide-border/40">
              {rows.map((r, i) => (
                <div key={i} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono break-all">{r.imei}</span>
                    {r.status === "pending" && <span className="text-muted-foreground shrink-0">Pending…</span>}
                    {r.status === "running" && <span className="text-primary flex items-center gap-1 shrink-0"><Loader2 className="w-3 h-3 animate-spin" />Running</span>}
                    {r.status === "completed" && <span className="text-success flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" />Done</span>}
                    {r.status === "failed" && <span className="text-destructive flex items-center gap-1 shrink-0"><XCircle className="w-3 h-3" />Failed</span>}
                  </div>
                  {r.result && <ColoredResult text={r.result} font={font} color={color} />}
                  {r.error && <div className="text-destructive">{r.error}</div>}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="glass" className="flex-1" onClick={reset} disabled={submitting}>Run more</Button>
              <Button variant="hero" className="flex-1" onClick={onClose} disabled={submitting}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
