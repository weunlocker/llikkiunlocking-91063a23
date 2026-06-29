import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function AdminProfileMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [lastIp, setLastIp] = useState<string | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);

  const email = profile?.email || user?.email || "";
  const initials = (profile?.display_name || email || "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("auth_login_events")
        .select("ip,created_at")
        .eq("user_id", user.id)
        .eq("success", true)
        .order("created_at", { ascending: false })
        .limit(2);
      // index 1 = previous login (current is index 0)
      const prev = data?.[1] ?? data?.[0];
      if (prev) {
        setLastIp(prev.ip ?? null);
        setLastTime(prev.created_at ?? null);
      }
    })();
  }, [user?.id]);

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate("/admin/notifications")}
        className="relative w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          0
        </span>
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-full ring-2 ring-primary/30 hover:ring-primary/60 transition"
            aria-label="Open admin profile"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 p-0 bg-card text-card-foreground border-border">
          <div className="flex items-start gap-3 p-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{email}</div>
              <div className="text-xs text-muted-foreground mt-0.5">(Full Access)</div>
              <div className="text-xs text-muted-foreground mt-1">
                Last Login ip : <span className="text-foreground/90 font-mono">{lastIp || "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Last Login Time : <span className="text-foreground/90">{formatTime(lastTime)}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 px-4 py-3 flex items-center gap-4 text-sm">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-primary hover:underline"
            >
              Client Area
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="text-primary hover:underline"
            >
              My Account
            </button>
            <button
              onClick={signOut}
              className="text-primary hover:underline ml-auto"
            >
              Logout
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
