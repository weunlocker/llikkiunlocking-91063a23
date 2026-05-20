import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import BrandHeader from "@/components/BrandHeader";
import Seo from "@/components/Seo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { registerSchema } from "@/lib/validation";
import { Country, State } from "country-state-city";

export default function Register() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string>("");
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

  useEffect(() => {
    const r = (search.get("ref") || localStorage.getItem("ref_code") || "").trim().toUpperCase();
    if (r) {
      setRefCode(r);
      localStorage.setItem("ref_code", r);
    }
  }, [search]);

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
    const country = countries.find((c) => c.isoCode === form.countryCode);
    const state = states.find((s) => s.isoCode === form.stateCode);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          display_name: parsed.data.displayName,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          state: state?.name || null,
          country: country?.name || null,
          pincode: form.pincode || null,
          ref: refCode || null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    localStorage.removeItem("ref_code");
    toast.success("Account created! Check your email to confirm before signing in.");
    navigate("/login");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <Seo
        title="Create your wholesale account | LIKKI UNLOCKING"
        description="Register for a free LIKKI UNLOCKING account to access wholesale IMEI checks, phone unlock services and the full API."
        path="/register"
      />
      <div className="w-full max-w-2xl animate-fade-up">
        <BrandHeader />

        <div className="glass rounded-2xl p-8 shadow-card">
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-6">Start checking IMEIs in seconds.</p>
          {refCode && (
            <div className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
              🎁 You were referred by <span className="font-mono font-semibold">{refCode}</span>. They'll earn a bonus when you top up.
            </div>
          )}
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {form.countryCode
                        ? (() => { const c = countries.find((x) => x.isoCode === form.countryCode); return c ? `${c.flag} ${c.name}` : "Select country"; })()
                        : "Select country"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Search country..." />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {countries.map((c) => (
                            <CommandItem
                              key={c.isoCode}
                              value={`${c.name} ${c.isoCode}`}
                              onSelect={() => setForm((f) => ({ ...f, countryCode: c.isoCode, stateCode: "" }))}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.countryCode === c.isoCode ? "opacity-100" : "opacity-0")} />
                              <span className="mr-2">{c.flag}</span>{c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>State</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" disabled={!states.length} className="w-full justify-between font-normal">
                      {form.stateCode
                        ? states.find((s) => s.isoCode === form.stateCode)?.name ?? "Select state"
                        : (states.length ? "Select state" : "Select country first")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Search state..." />
                      <CommandList>
                        <CommandEmpty>No state found.</CommandEmpty>
                        <CommandGroup>
                          {states.map((s) => (
                            <CommandItem
                              key={s.isoCode}
                              value={`${s.name} ${s.isoCode}`}
                              onSelect={() => setField("stateCode", s.isoCode)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.stateCode === s.isoCode ? "opacity-100" : "opacity-0")} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
