import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet, CheckCircle2, XCircle, Clock, List, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { imeiSchema } from "@/lib/validation";

type Service = { id: string; name: string; price: number; delivery_time: string };

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
  onAfterRun?: () => void; // refresh balance / orders
};

export default function ImeiCheckDialog({ service, balance, onClose, onAfterRun }: ImeiCheckDialogProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [imei, setImei] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SingleResult>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);

  useEffect(() => {
    if (service) {
      setTab("single"); setImei(""); setBulkText(""); setResult(null); setRows([]);
    }
  }, [service?.id]);

  if (!service) return null;
  const price = Number(service.price);

  // ---------- Single ----------
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
  };

  // ---------- Bulk ----------
  const parseBulk = (): string[] => {
    const lines = bulkText
      .split(/[\s,;\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
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
        setRows((prev) => prev.map((r, idx) => idx === i || (idx > i) ? { ...r, status: "failed", error: "Skipped — insufficient balance" } : r));
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
        } else {
          // failed = no charge (auto-refunded)
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: data?.error ?? "Check failed" } : r));
        }
      } catch (e) {
        setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: e instanceof Error ? e.message : "Network error" } : r));
      }
      onAfterRun?.();
    }

    setSubmitting(false);
    const okCount = (await new Promise<number>((resolve) => {
      setRows((prev) => { resolve(prev.filter((r) => r.status === "completed").length); return prev; });
    }));
    toast.success(`Bulk done — ${okCount}/${bulkValid.length} succeeded`);
  };

  const reset = () => { setResult(null); setRows([]); setImei(""); setBulkText(""); };

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" />{service.name}</DialogTitle>
          <DialogDescription>
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
          <div className="space-y-4">
            {result.status === "completed" ? (
              <div className="flex items-center gap-3 text-success"><CheckCircle2 className="w-6 h-6" /> Check completed</div>
            ) : (
              <div className="flex items-center gap-3 text-destructive"><XCircle className="w-6 h-6" /> Check failed</div>
            )}
            <pre className="glass rounded-md p-4 text-xs font-mono whitespace-pre-wrap break-words max-h-80 overflow-auto">
              {result.result || result.error || "No response"}
            </pre>
            <div className="flex gap-2">
              <Button variant="glass" className="flex-1" onClick={reset}>Run another</Button>
              <Button variant="hero" className="flex-1" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {submitting ? "Running checks…" : "Bulk run finished"} ({rows.filter((r) => r.status === "completed").length}/{rows.length} succeeded)
            </div>
            <div className="max-h-96 overflow-y-auto rounded border border-border/50 divide-y divide-border/40">
              {rows.map((r, i) => (
                <div key={i} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{r.imei}</span>
                    {r.status === "pending" && <span className="text-muted-foreground">Pending…</span>}
                    {r.status === "running" && <span className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Running</span>}
                    {r.status === "completed" && <span className="text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Done</span>}
                    {r.status === "failed" && <span className="text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />Failed</span>}
                  </div>
                  {r.result && (
                    <pre className="bg-background/50 rounded p-2 font-mono text-[10px] whitespace-pre-wrap break-words max-h-32 overflow-auto">{r.result}</pre>
                  )}
                  {r.error && <div className="text-destructive">{r.error}</div>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="glass" className="flex-1" onClick={reset} disabled={submitting}>Run more</Button>
              <Button variant="hero" className="flex-1" onClick={onClose} disabled={submitting}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
