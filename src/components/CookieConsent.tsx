import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "cookie-consent-v1";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setShow(true), 1200);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const decide = (value: "accepted" | "declined") => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md z-[60] animate-fade-up">
      <div className="glass border border-primary/30 rounded-xl p-4 shadow-elegant">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-1">We value your privacy</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies for security, authentication and basic analytics. No tracking sold to third parties.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="hero" onClick={() => decide("accepted")}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => decide("declined")}>Decline</Button>
            </div>
          </div>
          <button
            onClick={() => decide("declined")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
