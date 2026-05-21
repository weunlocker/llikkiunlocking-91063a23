import Layout from "@/components/Layout";
import { Code2, Copy, Info, AlertTriangle, Loader2, KeyRound, Link as LinkIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ConfirmDialog";

type SimpleService = {
  id: string;
  service_code: string | null;
  name: string;
  price: number;
  delivery_time: string;
  category: string | null;
  is_async: boolean | null;
  is_free?: boolean | null;
};

type ApiKeyRow = { id: string; name: string; key: string };

export default function ApiDocs({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, profile } = useAuth();
  const confirm = useConfirm();
  const [base, setBase] = useState("");
  const [services, setServices] = useState<SimpleService[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use custom DHRU-style domain (Cloudflare Worker proxies to Supabase edge function)
    setBase("https://api.likkiunlocking.com");
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: svc }, { data: k }] = await Promise.all([
        supabase
          .from("services_public")
          .select("id, service_code, name, price, delivery_time, category, is_async")
          .order("service_code"),
        user
          ? supabase.from("api_keys").select("id, name, key").eq("user_id", user.id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as ApiKeyRow[] }),
      ]);
      setServices((svc ?? []) as unknown as SimpleService[]);
      setKeys((k ?? []) as ApiKeyRow[]);
      setLoading(false);
    })();
  }, [user]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const generateKey = async () => {
    if (!user) { toast.error("Please log in first"); return; }
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
    const newKey = [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
    const name = newKeyName.trim() || "Default";
    if (keys.length > 0) {
      const ok = await confirm({
        title: "Replace API key?",
        description: "Your existing API key will stop working immediately. Any apps using the old key will break.",
        confirmText: "Replace key",
        tone: "warning",
      });
      if (!ok) return;
    }
    setGenerating(true);
    if (keys.length > 0) {
      const { error: delErr } = await supabase.from("api_keys").delete().eq("user_id", user.id);
      if (delErr) { setGenerating(false); toast.error(delErr.message); return; }
    }
    const { error } = await supabase.from("api_keys").insert({ user_id: user.id, name, key: newKey });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(keys.length > 0 ? "API key replaced" : "API key generated");
    setNewKeyName("");
    const { data: k } = await supabase.from("api_keys").select("id, name, key").eq("user_id", user.id).order("created_at", { ascending: false });
    setKeys((k ?? []) as ApiKeyRow[]);
  };

  // Split services: instant (Simple-Link compatible) vs Dhru (async, NOT for Simple Link)
  const instantServices = services.filter((s) => !s.is_async);
  const dhruServices = services.filter((s) => s.is_async);

  const username = profile?.email ?? "your-account@email.com";
  const apiKey = keys[0]?.key ?? "YOUR_API_KEY";
  const sampleCode = instantServices[0]?.service_code ?? "001";

  const simpleLinkExample = `${base}?key=${apiKey}&service=${sampleCode}&imei=356938035643809`;
  const dhruListExample = `${base}?username=${encodeURIComponent(username)}&apikey=${apiKey}&action=imeiservicelist`;
  const dhruCheckExample = `${base}?username=${encodeURIComponent(username)}&apikey=${apiKey}&action=imeicheck&service=${sampleCode}&imei=356938035643809`;
  const dhruAccountExample = `${base}?username=${encodeURIComponent(username)}&apikey=${apiKey}&action=accountinfo`;

  const content = (
      <div className={embedded ? "" : "container py-12 max-w-5xl"}>
        {!embedded && (
          <div className="text-center mb-10 animate-fade-up">
            <Code2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              <span className="glow-text">API Access</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Works with any Dhru-compatible client — or use a Simple Link.
            </p>
          </div>
        )}

        {/* API Key generator (top of API page) */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Your API Key</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {!user
              ? "Log in to generate your personal API key."
              : keys.length === 0
                ? "You can have one API key on your account. Generate it below."
                : "Generating a new key replaces your current one — old key stops working immediately."}
          </p>

          {user && (
            <div className="mb-4 rounded-lg border border-border/60 bg-background/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">Default</div>
                <div className="font-mono text-sm truncate">{keys[0]?.key ?? "No API key yet"}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {keys[0] && (
                  <Button size="icon" variant="ghost" aria-label="Copy API key" onClick={() => copy(keys[0].key)}><Copy className="w-4 h-4" /></Button>
                )}
                <Button variant="hero" size="sm" onClick={generateKey} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Username" value={username} onCopy={copy} />
            <Field label="API URL" value={base} onCopy={copy} />
          </div>

          {!user && (
            <div className="mt-4 rounded-lg bg-secondary/30 border border-border/60 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span><a href="/login" className="text-primary underline">Log in</a> or <a href="/register" className="text-primary underline">create an account</a> to generate your API key.</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="simple">
          <TabsList className="glass w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="simple" className="shrink-0"><LinkIcon className="w-4 h-4 mr-2" />Simple Link</TabsTrigger>
            <TabsTrigger value="dhru" className="shrink-0"><Code2 className="w-4 h-4 mr-2" />Dhru-compatible API</TabsTrigger>
            <TabsTrigger value="ids" className="shrink-0">Service IDs</TabsTrigger>
          </TabsList>

          {/* ───── Simple Link ───── */}
          <TabsContent value="simple" className="mt-5 space-y-4">
            <div className="glass rounded-2xl p-6">
              <h3 className="font-bold mb-2">Simple Link — one URL, instant result</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Best for embedding in your own site or quick scripts. Just open the URL and you get the result back as JSON.
              </p>
              <CodeBlock value={simpleLinkExample} onCopy={copy} />
              <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
                <Param name="key" desc="Your API key" />
                <Param name="service" desc={`Service ID (e.g. ${sampleCode})`} />
                <Param name="imei" desc="The IMEI/serial to check" />
              </div>
            </div>

            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold mb-1">Simple Link works only for instant services</div>
                <p className="text-muted-foreground">
                  Services that are routed through a <b>Dhru supplier</b> are processed asynchronously (the result comes minutes later). They are <b>not</b> available via Simple Link — use the <b>Dhru-compatible API</b> tab below for those.
                </p>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="font-bold mb-2">Example response</h3>
              <pre className="bg-background/60 border border-border rounded-lg p-4 text-xs font-mono overflow-auto">{`{
  "status": "completed",
  "imei": "356938035643809",
  "service": "iPhone Basic Info",
  "result": "Model: iPhone 13 Pro\\nCapacity: 256GB",
  "balance_after": 9.50
}`}</pre>
            </div>
          </TabsContent>

          {/* ───── Dhru-compatible ───── */}
          <TabsContent value="dhru" className="mt-5 space-y-4">
            <div className="glass rounded-2xl p-6">
              <h3 className="font-bold mb-2">Plug into any Dhru client</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a new server in your Dhru-style application using the credentials above. Our endpoint replies in the standard Dhru JSON shape (<span className="font-mono">SUCCESS</span> / <span className="font-mono">ERROR</span>).
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Open your Dhru tool → <b>Add server</b> / <b>API settings</b>.</li>
                <li>Set <b>API URL</b> to <span className="font-mono break-all">{base}</span></li>
                <li>Set <b>Username</b> to your account email and <b>API Key</b> to your <span className="font-mono">imei_…</span> key.</li>
                <li>Run <b>imeiservicelist</b> to import all available services.</li>
              </ol>
            </div>

            <div className="glass rounded-2xl p-6 space-y-5">
              <div>
                <div className="font-semibold mb-1">List available services</div>
                <CodeBlock value={dhruListExample} onCopy={copy} />
                <p className="text-xs text-muted-foreground mt-1">action = <span className="font-mono">imeiservicelist</span> · returns instant services only.</p>
              </div>
              <div>
                <div className="font-semibold mb-1">Place an IMEI check</div>
                <CodeBlock value={dhruCheckExample} onCopy={copy} />
                <p className="text-xs text-muted-foreground mt-1">action = <span className="font-mono">imeicheck</span> (alias <span className="font-mono">placeimeiorder</span>).</p>
              </div>
              <div>
                <div className="font-semibold mb-1">Account / balance</div>
                <CodeBlock value={dhruAccountExample} onCopy={copy} />
                <p className="text-xs text-muted-foreground mt-1">action = <span className="font-mono">accountinfo</span></p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <b className="text-foreground">Service IDs</b> can be either the short code (<span className="font-mono">001</span>) or the internal UUID — both work.
              </div>
            </div>
          </TabsContent>

          {/* ───── Service IDs ───── */}
          <TabsContent value="ids" className="mt-5 space-y-4">
            <ServiceIdTable
              title="Instant services — work with Simple Link & Dhru API"
              hint="Use these IDs in the service= parameter of a Simple Link."
              services={instantServices}
              onCopy={copy}
              instant
              loading={loading}
            />
            <ServiceIdTable
              title="Dhru-supplier services — Dhru API only (async)"
              hint="These are processed by an upstream Dhru supplier. Place the order, then poll for the result. Not available via Simple Link."
              services={dhruServices}
              onCopy={copy}
              instant={false}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </div>
  );
  return embedded ? content : <Layout>{content}</Layout>;
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="font-mono text-sm bg-background/60 rounded-lg p-3 flex items-center justify-between gap-2 border border-border">
        <span className={`truncate ${mono ? "" : ""}`}>{value}</span>
        <Button size="icon" variant="ghost" aria-label="Copy" onClick={() => onCopy(value)}><Copy className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function CodeBlock({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  return (
    <div className="font-mono text-xs bg-background/60 rounded-lg p-3 flex items-start justify-between gap-2 border border-border">
      <span className="break-all">{value}</span>
      <Button size="icon" variant="ghost" aria-label="Copy" onClick={() => onCopy(value)}><Copy className="w-4 h-4" /></Button>
    </div>
  );
}

function Param({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="font-mono text-primary text-xs mb-1">{name}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function ServiceIdTable({ title, hint, services, onCopy, instant, loading }: {
  title: string; hint: string; services: SimpleService[]; onCopy: (v: string) => void; instant: boolean; loading: boolean;
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const categories = Array.from(
    new Set(services.map((s) => (s.category ?? "Uncategorized").trim() || "Uncategorized"))
  ).sort();

  const q = query.trim().toLowerCase();
  const filtered = services.filter((s) => {
    const cat = (s.category ?? "Uncategorized").trim() || "Uncategorized";
    if (category !== "all" && cat !== category) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.service_code ?? "").toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q)
    );
  });

  // Group filtered services by category for display
  const grouped = filtered.reduce<Record<string, SimpleService[]>>((acc, s) => {
    const cat = (s.category ?? "Uncategorized").trim() || "Uncategorized";
    (acc[cat] ||= []).push(s);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort();

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold">{title}</h3>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${instant ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
            {instant ? "Instant" : "Async (Dhru)"}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {services.length}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{hint}</p>

        <div className="grid sm:grid-cols-[1fr_220px] gap-2">
          <Input
            placeholder="Search by name or service ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-background/60"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
          >
            <option value="all">All categories ({services.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c} ({services.filter((s) => ((s.category ?? "Uncategorized").trim() || "Uncategorized") === c).length})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">No services match your filters.</div>
      ) : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 w-24">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Delivery</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {groupNames.map((g) => (
                <>
                  <tr key={`h-${g}`} className="bg-secondary/30">
                    <td colSpan={5} className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {g} <span className="text-muted-foreground/70 normal-case font-normal">· {grouped[g].length}</span>
                    </td>
                  </tr>
                  {grouped[g].map((s) => {
                    const code = s.service_code ?? "—";
                    return (
                      <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20">
                        <td className="px-5 py-3 font-mono font-semibold text-primary">{code}</td>
                        <td className="px-5 py-3">{s.name}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{s.delivery_time}</td>
                        <td className="px-5 py-3 text-right font-mono">${Number(s.price).toFixed(2)}</td>
                        <td className="px-5 py-3"><Button size="icon" variant="ghost" aria-label="Copy code" onClick={() => onCopy(code)}><Copy className="w-4 h-4" /></Button></td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
