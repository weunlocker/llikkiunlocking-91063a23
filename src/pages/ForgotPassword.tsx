import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import BrandHeader from "@/components/BrandHeader";
import Seo from "@/components/Seo";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({ email: z.string().email("Enter a valid email").max(255) });

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your inbox for the reset link.");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <Seo
        title="Forgot password | LIKKI UNLOCKING"
        description="Reset your LIKKI UNLOCKING account password by email."
        path="/forgot-password"
        noindex
      />
      <div className="w-full max-w-md animate-fade-up">
        <BrandHeader />
        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="text-2xl font-bold mb-1">Forgot password</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Enter your email and we'll send you a reset link.
          </p>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
              Please check your inbox (and spam folder).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={255}
                  required
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send reset link
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Remembered it?{" "}
            <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
