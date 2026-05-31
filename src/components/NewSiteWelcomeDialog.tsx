import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "new_site_welcome_seen_v1";

export default function NewSiteWelcomeDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) return; // don't show to logged-in users
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Welcome to our new platform!</DialogTitle>
          <DialogDescription className="text-center">
            We've fully upgraded our website. Old accounts from the previous system are
            <strong> no longer valid</strong>. Please create a new account to continue using our services.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full" onClick={dismiss}>
            <Link to="/register">Create New Account</Link>
          </Button>
          <Button asChild variant="outline" className="w-full" onClick={dismiss}>
            <Link to="/login">I already have a new account</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
