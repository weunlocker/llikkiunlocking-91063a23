import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); setMsg("Missing token."); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON } },
        );
        const data = await res.json();
        if (!res.ok) { setState("invalid"); setMsg(data.error ?? "Invalid link."); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") setState("already");
        else if (data.valid === true) setState("valid");
        else setState("invalid");
      } catch {
        setState("error");
        setMsg("Network error. Please try again.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success || data.reason === "already_unsubscribed") setState("done");
      else { setState("error"); setMsg(data.error ?? "Failed to unsubscribe."); }
    } catch {
      setState("error");
      setMsg("Network error. Please try again.");
    }
  };

  return (
    <Layout>
      <Seo
        title="Unsubscribe from emails | LIKKI UNLOCKING"
        description="Manage your LIKKI UNLOCKING email preferences and unsubscribe from notifications."
        path="/unsubscribe"
        noindex
      />
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="glass max-w-md w-full rounded-2xl p-8 text-center space-y-4">
          <h1 className="sr-only">Unsubscribe from LIKKI UNLOCKING emails</h1>
          {state === "loading" && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">Validating your link…</p>
            </>
          )}
          {state === "valid" && (
            <>
              <MailX className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Unsubscribe from emails</h2>
              <p className="text-muted-foreground text-sm">
                You'll stop receiving emails from <strong>LIKKIUNLOCKING</strong>. You can re-subscribe anytime by contacting support.
              </p>
              <Button variant="hero" size="lg" className="w-full" onClick={confirm}>
                Confirm Unsubscribe
              </Button>
            </>
          )}
          {state === "submitting" && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p>Processing…</p>
            </>
          )}
          {state === "done" && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">You're unsubscribed</h2>
              <p className="text-muted-foreground text-sm">We won't send you emails anymore. Sorry to see you go.</p>
            </>
          )}
          {state === "already" && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">Already unsubscribed</h2>
              <p className="text-muted-foreground text-sm">This email address is already unsubscribed.</p>
            </>
          )}
          {(state === "invalid" || state === "error") && (
            <>
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
              <h2 className="text-2xl font-bold">Something went wrong</h2>
              <p className="text-muted-foreground text-sm">{msg || "This unsubscribe link is invalid or has expired."}</p>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
