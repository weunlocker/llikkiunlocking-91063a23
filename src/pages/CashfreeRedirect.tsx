import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Cashfree?: any }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const existing = document.querySelector(`script[src="${SDK_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(s);
  });
}

export default function CashfreeRedirect() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const sid = params.get("sid") || "";
  const env = params.get("env") === "production" ? "production" : "sandbox";

  useEffect(() => {
    if (!sid) { setError("Missing payment session id"); return; }
    (async () => {
      try {
        await loadSdk();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cashfree = (window as any).Cashfree({ mode: env });
        await cashfree.checkout({ paymentSessionId: sid, redirectTarget: "_self" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start Cashfree checkout");
      }
    })();
  }, [sid, env]);

  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="text-lg font-semibold mb-2">
          {error ? "Checkout error" : "Redirecting to secure Cashfree checkout…"}
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    </div>
  );
}
