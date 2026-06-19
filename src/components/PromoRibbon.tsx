import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { X, Gift, ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";

const KEY = "promo_ribbon_dismissed_at";
const DISMISS_DAYS = 7;

export default function PromoRibbon() {
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user) { setShow(false); return; }
    if (!settings.signup_bonus_enabled || !(settings.signup_bonus_amount > 0)) { setShow(false); return; }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const ts = Number(raw);
        if (!isNaN(ts) && Date.now() - ts < DISMISS_DAYS * 86400_000) { setShow(false); return; }
      }
    } catch {}
    setShow(true);
  }, [user, settings.signup_bonus_enabled, settings.signup_bonus_amount]);

  if (!show) return null;

  const amount = Number(settings.signup_bonus_amount).toFixed(2);

  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  return (
    <div className="relative overflow-hidden border-b border-primary/30 bg-gradient-to-r from-primary/20 via-accent/15 to-primary/20">
      <div className="absolute inset-0 promo-shimmer pointer-events-none" aria-hidden />
      <div className="container relative flex items-center justify-center gap-3 py-2 text-xs sm:text-sm">
        <Gift className="w-4 h-4 text-primary shrink-0 animate-pulse" />
        <span className="text-foreground/90 text-center">
          <span className="font-semibold">New here?</span> Get{" "}
          <span className="font-bold text-primary">${amount} FREE</span> credit instantly —{" "}
          <Link to="/register" className="font-semibold underline underline-offset-4 hover:text-primary inline-flex items-center gap-1">
            Create account <ArrowRight className="w-3 h-3" />
          </Link>
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss promotion"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
