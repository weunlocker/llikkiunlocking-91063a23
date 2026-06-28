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
function normalizeWhatsapp(raw?: string | null, message?: string) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return null;
  const url = new URL(`https://wa.me/${digits}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
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
  const waMsg = `Hello ${settings.brand_name || "LIK"} Team 👋,\n\nI visited your website and I'm interested in your unlocking / IMEI check services. Could you please share your current offers and how to get started?\n\nThank you!`;

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogContent
        className="max-w-[420px] p-0 overflow-hidden border border-primary/30 bg-card text-card-foreground shadow-[0_0_60px_rgba(0,200,255,0.15)]"
        aria-describedby="platform-upgrade-desc"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-card-foreground/70 hover:text-card-foreground hover:bg-white/10 transition-colors"
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
            <img src={logoSrc} alt={`${settings.brand_name} logo`} className="h-10 w-auto mx-auto" />
          </div>

          <DialogTitle className="text-xl font-bold mb-2 text-foreground">
            Welcome to the New <span className="glow-text">{settings.brand_name || "LIK"}</span>
          </DialogTitle>

          <DialogDescription id="platform-upgrade-desc" className="text-sm text-card-foreground/90 leading-relaxed mb-4">
            We have completely rebuilt our platform for faster checks, better security, and a smoother experience.
          </DialogDescription>

          {/* Warning */}
          <div className="w-full rounded-xl border border-primary/30 bg-primary/10 p-4 mb-5">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white mb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Your old account is not valid here.
            </div>
            <p className="text-xs text-card-foreground/90">
              Please create a new account to continue.
            </p>
          </div>

          {/* Need Help */}
          <div className="w-full mb-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-card-foreground/80 mb-3 font-semibold">
              Need Help?
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  window.dispatchEvent(new CustomEvent("open-ai-chat"));
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border/80 bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                Live Chat
              </button>
              {normalizeTelegram(settings.telegram_url) && (
                <a
                  href={normalizeTelegram(settings.telegram_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border/80 bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-primary" />
                  Telegram
                </a>
              )}
              {normalizeWhatsapp(settings.whatsapp_number) && (
                <a
                  href={normalizeWhatsapp(settings.whatsapp_number, waMsg)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#25D366]/50 bg-[#25D366]/15 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
                    <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.93 11.93 0 0 0 5.77 1.47h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.47-8.41ZM12.05 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.72.97 1-3.63-.24-.37a9.85 9.85 0 0 1-1.51-5.24c0-5.45 4.44-9.88 9.88-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.45-4.44 9.88-9.9 9.88Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
                  </svg>
                  WhatsApp
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
            <Button asChild variant="outline" size="lg" className="w-full text-sm border-border/80 bg-secondary/50 text-secondary-foreground hover:bg-secondary/70">
              <Link to="/login" onClick={() => setOpen(false)}>
                I Already Have a New Account
              </Link>
            </Button>
            <button
              onClick={handleClose}
              className="text-xs text-card-foreground/80 hover:text-card-foreground transition-colors mt-1"
            >
              Continue browsing without an account
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
