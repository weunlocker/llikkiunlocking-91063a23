import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, MessageCircle, Send, ArrowRight, X } from "lucide-react";
import defaultLogo from "@/assets/logo.png";

function normalizeTelegram(raw?: string | null) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  return `https://t.me/${v.replace(/^@/, "")}`;
}
function normalizeWhatsapp(raw?: string | null) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default function PlatformUpgradeModal() {
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!settings.platform_upgrade_popup_enabled) return;
    setOpen(true);
  }, [settings.platform_upgrade_popup_enabled]);

  const handleClose = () => setOpen(false);

  const logoSrc = settings.logo_url || defaultLogo;

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogContent
        className="max-w-[420px] p-0 overflow-hidden border border-primary/30 bg-[hsl(222_47%_7%)] shadow-[0_0_60px_rgba(0,200,255,0.15)]"
        aria-describedby="platform-upgrade-desc"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center px-6 pt-7 pb-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-[11px] font-semibold uppercase tracking-wider text-primary mb-5">
            <Sparkles className="w-3 h-3" />
            Platform Upgrade
          </div>

          {/* Logo */}
          <div className="mb-4">
            <img src={logoSrc} alt="${settings.brand_name} logo" className="h-10 w-auto mx-auto" />
          </div>

          <DialogTitle className="text-xl font-bold mb-2">
            Welcome to the New <span className="glow-text">{settings.brand_name || "LIK"}</span>
          </DialogTitle>

          <DialogDescription id="platform-upgrade-desc" className="text-sm text-muted-foreground leading-relaxed mb-4">
            We have completely rebuilt our platform for faster checks, better security, and a smoother experience.
          </DialogDescription>

          {/* Warning */}
          <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground mb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Your old account is not valid here.
            </div>
            <p className="text-xs text-muted-foreground">
              Please create a new account to continue.
            </p>
          </div>

          {/* Need Help */}
          <div className="w-full mb-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 font-semibold">
              Need Help?
            </div>
            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => {
                  const el = document.getElementById("chat-widget-button") || document.querySelector("[data-chat-widget]");
                  if (el) (el as HTMLElement).click();
                  else window.open("/support", "_blank");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border/60 bg-secondary/40 text-xs font-medium hover:bg-secondary/60 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                Live Chat
              </button>
              {settings.telegram_url && (
                <a
                  href={settings.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border/60 bg-secondary/40 text-xs font-medium hover:bg-secondary/60 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-primary" />
                  Telegram
                </a>
              )}
              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border/60 bg-secondary/40 text-xs font-medium hover:bg-secondary/60 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  Email
                </a>
              )}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="w-full flex flex-col gap-2.5">
            <Button asChild variant="hero" size="lg" className="w-full text-sm">
              <Link to="/register" onClick={() => setOpen(false)}>
                Create New Account <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full text-sm border-border/60 bg-secondary/20 hover:bg-secondary/40">
              <Link to="/login" onClick={() => setOpen(false)}>
                I Already Have a New Account
              </Link>
            </Button>
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              Continue browsing without an account
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
