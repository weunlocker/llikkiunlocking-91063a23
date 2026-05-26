import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  balance: number;
  banned: boolean;
  telegram_chat_id: string | null;
  notify_telegram: boolean;
  notify_email: boolean;
  notify_order_placed: boolean;
  notify_order_completed: boolean;
  notify_balance_updates: boolean;
  custom_message: string | null;
  user_group: string | null;
  api_enabled: boolean;
  referral_code: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,balance,banned,telegram_chat_id,notify_telegram,notify_email,notify_order_placed,notify_order_completed,notify_balance_updates,custom_message,user_group,api_enabled,referral_code").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);
    setIsAdmin(!!roles?.some((r: { role: string }) => r.role === "admin"));
  };

  const IDLE_MS = 30 * 60 * 1000; // 30 minutes
  const LAST_ACTIVITY_KEY = "lastActivityAt";

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    // On load: if last activity exceeded idle window, force sign-out
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (sess?.user && last && Date.now() - last > IDLE_MS) {
        await supabase.auth.signOut();
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setSession(null); setUser(null); setProfile(null); setIsAdmin(false);
        setLoading(false);
        return;
      }
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        loadProfile(sess.user.id).finally(() => setLoading(false));
      } else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setUser(null); setSession(null); setProfile(null); setIsAdmin(false);
  };

  // Auto sign-out after 30 minutes of inactivity (also catches re-launch after gap)
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await signOut();
        try { (await import("sonner")).toast.info("Signed out due to inactivity"); } catch {}
      }, IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (last && Date.now() - last > IDLE_MS) {
        await signOut();
        try { (await import("sonner")).toast.info("Signed out due to inactivity"); } catch {}
      } else {
        reset();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
