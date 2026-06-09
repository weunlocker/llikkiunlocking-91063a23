import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet, CheckCircle2, XCircle, Clock, List, Smartphone, Copy, History as HistoryIcon, DollarSign as DollarSignIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { imeiSchema } from "@/lib/validation";
import { extractResponse, stripColorMarkers } from "@/lib/extractResponse";
import { ColoredResult, fontCss } from "@/components/ColoredResult";

export type CustomField = { name: string; label: string; type: string; required: boolean; default?: string; options?: string[] };
type Service = { id: string; name: string; price: number; delivery_time: string; sample_result?: string | null; result_font?: string | null; result_color?: string | null; service_type?: "imei" | "server" | null; custom_fields?: CustomField[] | null };

type SingleResult = { status: string; result?: string; error?: string } | null;

type BulkRow = {
  imei: string;
  status: "pending" | "running" | "successful" | "rejected" | "failed" | "queued";
  result?: string;
  error?: string;
};

export type ImeiCheckDialogProps = {
  service: Service | null;
  balance: number;
  onClose: () => void;
  onAfterRun?: () => void;
  onBulkStarted?: () => void;
};

export default function ImeiCheckDialog({ service, balance, onClose, onAfterRun, onBulkStarted }: ImeiCheckDialogProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [imei, setImei] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SingleResult>(null);
  const [submittedAsync, setSubmittedAsync] = useState<{ imei: string } | null>(null);
  const [bulkSubmitted, setBulkSubmitted] = useState<{ count: number; total: number } | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [showSample, setShowSample] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const font = fontCss(service?.result_font);
  const isServer = service?.service_type === "server" && Array.isArray(service?.custom_fields) && service!.custom_fields!.length > 0;
  const customFields = (isServer ? service!.custom_fields! : []) as CustomField[];

  useEffect(() => {
    if (service) {
      setTab("single"); setImei(""); setBulkText(""); setResult(null); setRows([]); setShowSample(false); setSubmittedAsync(null); setBulkSubmitted(null);
      // Seed defaults for server fields
      const seed: Record<string, string> = {};
      (service.custom_fields ?? []).forEach((f) => { seed[f.name] = f.default ?? ""; });
      setFieldValues(seed);
    }
  }, [service?.id]);

  if (!service) return null;
  const price = Number(service.price);

  const submitSingle = async () => {
    let primary = imei.trim();
    let extraFields: Record<string, string> | undefined;
    if (isServer) {
      // Validate required fields
      for (const f of customFields) {
        const v = (fieldValues[f.name] ?? "").trim();
        if (f.required && !v) { toast.error(`${f.label} is required`); return; }
      }
      extraFields = { ...fieldValues };
      // Pick a primary identifier for the order's imei column
      const idField = customFields.find((f) => /imei|serial|sn|udid|meid/i.test(f.name)) ?? customFields[0];
      primary = (fieldValues[idField.name] ?? "").trim() || "N/A";
    } else {
      const parsed = imeiSchema.safeParse(imei);
      if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
      primary = parsed.data;
    }
    if (balance < price) { toast.error("Insufficient balance. Please top up."); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("check-imei", {
      body: { service_id: service.id, imei: primary, fields: extraFields },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    onAfterRun?.();
    if (data?.status === "pending") {
      setSubmittedAsync({ imei: primary });
      return;
    }
    setResult(data);
    if (data?.status === "completed") toast.success("Check complete");
    else if (data?.status === "failed") toast.error(data?.error ?? "Check failed");
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

    setSubmitting(true);
    // Fire all orders in parallel, don't await — they continue in background
    // even after the dialog closes or the user navigates away.
    for (const imeiVal of bulkValid) {
      supabase.functions
        .invoke("check-imei", { body: { service_id: service.id, imei: imeiVal } })
        .then(() => onAfterRun?.())
        .catch(() => { /* errors will surface in Orders page */ });
    }
    // Tiny delay so the user perceives the submit
    await new Promise((r) => setTimeout(r, 350));
    setSubmitting(false);
    setBulkSubmitted({ count: bulkValid.length, total: totalCost });
    onBulkStarted?.();
    onAfterRun?.();
    toast.success(`${bulkValid.length} order${bulkValid.length === 1 ? "" : "s"} placed — processing in background`);
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
          <DialogDescription className="text-xs sm:text-sm flex items-center gap-2 flex-wrap">
            <Clock className="w-3 h-3 inline" /> {service.delivery_time}
          </DialogDescription>
        </DialogHeader>

        {submittedAsync ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-bold">Order Submitted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                IMEI <span className="font-mono">{submittedAsync.imei}</span> sent to supplier.
                <br />We'll notify you when it's ready.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="glass" className="flex-1" onClick={() => { navigate("/dashboard?tab=orders"); onClose(); }}>
                <HistoryIcon className="w-4 h-4" /> View Orders
              </Button>
              <Button variant="hero" className="flex-1" onClick={() => { setSubmittedAsync(null); setImei(""); }}>
                Place Another Order
              </Button>
            </div>
          </div>
        ) : bulkSubmitted ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-bold">Orders Placed Successfully</h3>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-bold text-foreground">{bulkSubmitted.count}</span> order{bulkSubmitted.count === 1 ? "" : "s"} sent to supplier · <span className="font-mono text-primary">${bulkSubmitted.total.toFixed(2)}</span>
                <br />Processing in background — results will appear in your Orders page.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="glass" className="flex-1" onClick={() => { navigate("/dashboard?tab=orders"); onClose(); }}>
                <HistoryIcon className="w-4 h-4" /> View Orders
              </Button>
              <Button variant="hero" className="flex-1" onClick={() => { setBulkSubmitted(null); setBulkText(""); }}>
                Place More
              </Button>
            </div>
          </div>
        ) : !result && rows.length === 0 ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "bulk")}>
            <TabsList className={`grid w-full ${isServer ? "grid-cols-1" : "grid-cols-2"}`}>
              <TabsTrigger value="single"><Smartphone className="w-4 h-4 mr-2" />{isServer ? "Order" : "Single"}</TabsTrigger>
              {!isServer && <TabsTrigger value="bulk"><List className="w-4 h-4 mr-2" />Bulk</TabsTrigger>}
            </TabsList>

            <TabsContent value="single" className="space-y-4 pt-4">
              {isServer ? (
                <div className="space-y-3">
                  {customFields.map((f) => {
                    const v = fieldValues[f.name] ?? "";
                    const onChange = (val: string) => setFieldValues((prev) => ({ ...prev, [f.name]: val }));
                    return (
                      <div key={f.name}>
                        <Label htmlFor={`f-${f.name}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                        {f.type === "select" && f.options?.length ? (
                          <select
                            id={`f-${f.name}`}
                            value={v}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">— select —</option>
                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.type === "textarea" ? (
                          <Textarea id={`f-${f.name}`} value={v} onChange={(e) => onChange(e.target.value)} rows={3} />
                        ) : (
                          <Input
                            id={`f-${f.name}`}
                            type={f.type === "number" ? "number" : f.type === "password" ? "password" : "text"}
                            value={v}
                            onChange={(e) => onChange(e.target.value)}
                            className={/imei|serial|sn|udid|meid/i.test(f.name) ? "font-mono" : ""}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <Label htmlFor="imei-single">IMEI / Serial</Label>
                  <Input id="imei-single" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="e.g. 356938035643809" maxLength={20} className="font-mono" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="glass rounded-md p-3 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-2"><DollarSignIcon className="w-4 h-4" /> Price</span>
                  <span className="font-mono font-bold text-primary">${price.toFixed(2)}</span>
                </div>
                <div className="glass rounded-md p-3 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Balance</span>
                  <span className="font-mono font-bold">${balance.toFixed(2)}</span>
                </div>
              </div>

              {service.sample_result && service.sample_result.trim() && (
                <div className="rounded-lg border border-border/50 p-3">
                  <button type="button" onClick={() => setShowSample((v) => !v)} className="text-xs text-primary hover:underline">
                    {showSample ? "Hide" : "Show"} sample result preview
                  </button>
                  {showSample && (
                    <div className="mt-3 space-y-2">
                      {ResultToolbar}
                      <ColoredResult text={service.sample_result} font={font} />
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
            <ColoredResult text={extractResponse(result.result) || result.error || "No response"} font={font} />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="glass"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(stripColorMarkers(extractResponse(result.result)) || result.error || "");
                  toast.success("Copied");
                }}
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <Button variant="glass" className="flex-1" onClick={() => { navigate("/dashboard?tab=orders"); onClose(); }}>
                <List className="w-4 h-4" /> Orders
              </Button>
              <Button variant="glass" className="flex-1" onClick={reset}>Run another</Button>
              <Button variant="hero" className="flex-1" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {submitting ? "Running checks…" : "Bulk run finished"} ({rows.filter((r) => r.status === "successful").length}/{rows.length} successful)
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
              {rows.map((r, i) => {
                const queuePos = rows.slice(0, i).filter((x) => x.status === "pending" || x.status === "running").length;
                return (
                  <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs break-all">{r.imei}</span>
                      {r.status === "pending" && <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Clock className="w-3 h-3" />Pending{queuePos > 0 ? ` · #${queuePos + 1}` : ""}</span>}
                      {r.status === "running" && <span className="text-xs text-primary flex items-center gap-1 shrink-0"><Loader2 className="w-3 h-3 animate-spin" />In process</span>}
                      {r.status === "queued" && <span className="text-xs text-warning flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" />Queued</span>}
                      {r.status === "successful" && <span className="text-xs text-success flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" />Completed</span>}
                      {r.status === "rejected" && <span className="text-xs text-warning flex items-center gap-1 shrink-0"><XCircle className="w-3 h-3" />Rejected</span>}
                      {r.status === "failed" && <span className="text-xs text-destructive flex items-center gap-1 shrink-0"><XCircle className="w-3 h-3" />Failed</span>}
                    </div>
                    {r.result && <ColoredResult text={extractResponse(r.result)} font={font} />}
                    {r.error && <div className="text-xs text-destructive">{r.error}</div>}
                    {r.result && (
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => { navigator.clipboard.writeText(extractResponse(r.result)); toast.success("Copied"); }}
                      >
                        <Copy className="w-4 h-4" /> Copy
                      </Button>
                    )}
                  </div>
                );
              })}
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
