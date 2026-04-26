import Layout from "@/components/Layout";
import { Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ApiDocs() {
  const [base, setBase] = useState("");
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    setBase(`https://${projectId}.supabase.co/functions/v1/api-check`);
  }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const example = `${base}?key=YOUR_API_KEY&service=SERVICE_ID&imei=IMEI_HERE`;

  return (
    <Layout>
      <div className="container py-12 max-w-4xl">
        <div className="text-center mb-12 animate-fade-up">
          <Code2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Simple <span className="glow-text">API Access</span></h1>
          <p className="text-muted-foreground text-lg">One endpoint. Three parameters. Done.</p>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">Endpoint</h2>
            <div className="font-mono text-sm bg-background/60 rounded-lg p-4 flex items-center justify-between gap-2 border border-border">
              <span className="break-all">GET {example}</span>
              <Button size="icon" variant="ghost" onClick={() => copy(example)}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">Parameters</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr><th className="py-2">Name</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40"><td className="py-3 font-mono text-primary">key</td><td>Your API key (from Dashboard → API Keys)</td></tr>
                <tr className="border-b border-border/40"><td className="py-3 font-mono text-primary">service</td><td>Service ID (UUID, see Services page)</td></tr>
                <tr><td className="py-3 font-mono text-primary">imei</td><td>The IMEI/serial to check</td></tr>
              </tbody>
            </table>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">Example response</h2>
            <pre className="bg-background/60 border border-border rounded-lg p-4 text-xs font-mono overflow-auto">{`{
  "status": "completed",
  "imei": "356938035643809",
  "service": "iPhone Basic Info",
  "result": "Model: iPhone 13 Pro\\nCapacity: 256GB\\nColor: Sierra Blue\\nWarranty: Active",
  "balance_after": 9.50
}`}</pre>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">cURL example</h2>
            <pre className="bg-background/60 border border-border rounded-lg p-4 text-xs font-mono overflow-auto">{`curl "${example}"`}</pre>
          </div>
        </div>
      </div>
    </Layout>
  );
}
