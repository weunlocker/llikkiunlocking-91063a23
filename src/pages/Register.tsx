import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Shield, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { registerSchema } from "@/lib/validation";
import { Country, State } from "country-state-city";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    phone: "",
    address: "",
    city: "",
    countryCode: "",
    stateCode: "",
    pincode: "",
  });

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (form.countryCode ? State.getStatesOfCountry(form.countryCode) : []),
    [form.countryCode]
  );

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse({
      email: form.email,
      password: form.password,
      displayName: form.displayName,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: parsed.data.displayName },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Save extra profile fields (RLS: users can update own profile)
    const userId = data.user?.id;
    if (userId) {
      const country = countries.find((c) => c.isoCode === form.countryCode);
      const state = states.find((s) => s.isoCode === form.stateCode);
      await supabase
        .from("profiles")
        .update({
          display_name: parsed.data.displayName,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          state: state?.name || null,
          country: country?.name || null,
          pincode: form.pincode || null,
        })
        .eq("id", userId);
    }

    setLoading(false);
    toast.success("Account created — welcome aboard!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-2xl animate-fade-up">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-neon">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl">IMEI<span className="glow-text">Check</span></span>
        </Link>
        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-6">Start checking IMEIs in seconds.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Name *</Label>
                <Input id="displayName" value={form.displayName} onChange={(e) => setField("displayName", e.target.value)} placeholder="John Doe" maxLength={50} required />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="you@example.com" maxLength={255} required />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="At least 8 characters" maxLength={72} required />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+1 555 0100" maxLength={30} />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" rows={2} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Street address" maxLength={200} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Select value={form.countryCode} onValueChange={(v) => setForm((f) => ({ ...f, countryCode: v, stateCode: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>State</Label>
                <Select value={form.stateCode} onValueChange={(v) => setField("stateCode", v)} disabled={!states.length}>
                  <SelectTrigger><SelectValue placeholder={states.length ? "Select state" : "Select country first"} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {states.map((s) => (
                      <SelectItem key={s.isoCode} value={s.isoCode}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="City" maxLength={100} />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode / ZIP</Label>
                <Input id="pincode" value={form.pincode} onChange={(e) => setField("pincode", e.target.value)} placeholder="100001" maxLength={20} />
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create account
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
