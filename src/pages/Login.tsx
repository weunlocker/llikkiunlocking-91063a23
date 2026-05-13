import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import BrandHeader from "@/components/BrandHeader";
import { toast } from "sonner";
import { loginSchema } from "@/lib/validation";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);

    // Check if OTP login is enabled globally (via security-definer RPC, readable pre-login)
    const { data: otpFlag } = await supabase.rpc("get_otp_login_enabled");
    const otpEnabled = otpFlag !== false;

    if (!otpEnabled) {
      // Normal password-only login
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setLoading(false);
      if (error) {
        supabase.functions.invoke("auth-event", {
          body: { email: parsed.data.email, success: false },
        }).catch(() => {});
        toast.error(error.message);
        return;
      }
      supabase.functions.invoke("auth-event", {
        body: { email: parsed.data.email, success: true },
      }).catch(() => {});
      toast.success("Welcome back!");
      navigate("/dashboard");
      return;
    }

    // OTP flow: verify password, sign out, send OTP
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      supabase.functions.invoke("auth-event", {
        body: { email: parsed.data.email, success: false },
      }).catch(() => {});
      setLoading(false);
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (otpErr) {
      toast.error(otpErr.message);
      return;
    }
    toast.success("We sent a 6-digit code to your email.");
    navigate(`/login-otp?email=${encodeURIComponent(parsed.data.email)}`);
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">
        <BrandHeader />

        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign in to continue.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" maxLength={255} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" maxLength={72} required />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            New here?{" "}
            <Link to="/register" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
