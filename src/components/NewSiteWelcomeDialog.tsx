import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, Mail, ArrowRight, Rocket, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logo from "@/assets/logo.png";

const STORAGE_KEY = "new_site_welcome_seen_v1";

export default function NewSiteWelcomeDialog() {
  const { user, loading } = useAuth();
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);

  const tgRaw = settings.telegram_url?.trim();
  const email = settings.contact_email?.trim() || "support@likkiunlocking.com";

  useEffect(() => {
    if (loading) return;
    if (user) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [user, loading]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const openChat = () => {
    dismiss();
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

  const openTelegram = () => {
    if (!tgRaw) return;
    const tgUser = tgRaw.startsWith("http")
      ? tgRaw.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "")
      : tgRaw.replace(/^@/, "");
    window.open(`https://t.me/${tgUser}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md overflow-hidden border border-primary/30 bg-gradient-to-b from-card to-background shadow-elegant p-0">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent-glow to-primary" />

        <div className="px-6 pt-6 pb-2">
          <DialogHeader className="space-y-4">
            {/* Badge */}
            <div className="mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                <Rocket className="w-3 h-3" />
                Platform Upgrade
              </span>
            </div>

            {/* Logo */}
            <div className="mx-auto">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                <img
                  src={logo}
                  alt="LIKKI UNLOCKING"
                  className="relative w-16 h-16 object-contain rounded-xl"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>

            <DialogTitle className="text-center text-xl sm:text-2xl font-bold tracking-tight">
              Welcome to the <span className="glow-text">New LIKKI</span>
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
              We have completely rebuilt our platform for faster checks, better security, and a smoother experience.
              <br /><br />
              <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-success" />
                Your old account is not valid here.
              </span>
              <br />
              Please create a new account to continue.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Contact / Support Section */}
        <div className="px-6 py-4 bg-muted/30 border-y border-border/40">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-3 font-medium">Need Help?</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={openChat}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:shadow-neon transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Live Chat
            </button>
            {tgRaw && (
              <button
                onClick={openTelegram}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20 hover:bg-[#229ED9]/15 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                  <path d="M21.94 4.27a1.5 1.5 0 0 0-1.6-.2L3.4 11.1c-1.1.45-1.07 2.03.05 2.43l3.9 1.4 1.5 4.8a1 1 0 0 0 1.66.42l2.3-2.18 4.16 3.06c.86.63 2.1.16 2.32-.88l3.05-13.9a1.5 1.5 0 0 0-.4-1.98ZM9.7 14.6l8.4-6.4-6.95 7.45-.2 2.97-1.25-4.02Z" />
                </svg>
                Telegram
              </button>
            )}
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          </div>
        </div>

        {/* CTA Buttons */}
        <DialogFooter className="flex-col gap-3 sm:flex-col px-6 pb-6 pt-4">
          <Button asChild variant="hero" size="lg" className="w-full gap-2" onClick={dismiss}>
            <Link to="/register">
              Create New Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="glass" size="lg" className="w-full" onClick={dismiss}>
            <Link to="/login">I Already Have a New Account</Link>
          </Button>
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            Continue browsing without an account
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
