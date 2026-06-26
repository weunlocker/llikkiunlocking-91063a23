import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import BrandHeader from "@/components/BrandHeader";
import Seo from "@/components/Seo";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    (async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        setReady(true);
        return;
      }

      const url = new URL(window.location.href);

      // PKCE / code flow
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setLinkError(error.message);
        else setReady(true);
        return;
      }

      // Token hash flow (?token_hash=...&type=recovery)
      const token_hash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "recovery",
          token_hash,
        });
        if (error) setLinkError(error.message);
        else setReady(true);
        return;
      }

      // Hash-based access_token flow is handled by the client → onAuthStateChange
      if (window.location.hash.includes("access_token")) return;

      // Wait a moment for listener; if nothing arrives, show error
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setLinkError("Invalid or expired reset link. Please request a new one.");
        }
      }, 1500);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <Seo
        title="Reset password | LIKKI UNLOCKING"
        description="Set a new password for your LIKKI UNLOCKING account."
        path="/reset-password"
        noindex
      />
      <div className="w-full max-w-md animate-fade-up">
        <BrandHeader />
        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="text-2xl font-bold mb-1">Reset password</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Choose a new password for your account.
          </p>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Validating reset link… If this page does not unlock, request a new link from the
              forgot password page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  maxLength={72}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  maxLength={72}
                  required
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
