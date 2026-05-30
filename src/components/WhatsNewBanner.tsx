import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, X } from "lucide-react";

type Announcement = {
  id: string;
  kind: "new" | "price" | "general";
  title: string;
  body: string | null;
  created_at: string;
};

export default function WhatsNewBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [{ data: anns }, { data: dism }] = await Promise.all([
        supabase.from("service_announcements")
          .select("id,kind,title,body,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("service_announcement_dismissals")
          .select("announcement_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const dismissed = new Set((dism ?? []).map((d) => d.announcement_id));
      setItems(((anns ?? []) as Announcement[]).filter((a) => !dismissed.has(a.id)));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dismiss = async (id: string) => {
    if (!user) return;
    setItems((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("service_announcement_dismissals")
      .insert({ user_id: user.id, announcement_id: id });
  };

  if (!items.length) return null;

  return (
    <div className="glass rounded-2xl p-4 mb-5 border-l-4 border-accent">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <div className="text-xs uppercase tracking-wider text-accent font-semibold">What's New</div>
      </div>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{a.title}</div>
              {a.body && <div className="text-xs text-muted-foreground whitespace-pre-line">{a.body}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
