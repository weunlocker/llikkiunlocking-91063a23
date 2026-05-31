import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Only show announcements created in the last 24 hours
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ data: anns }, { data: dism }] = await Promise.all([
        supabase
          .from("service_announcements")
          .select("id,kind,title,body,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("service_announcement_dismissals")
          .select("announcement_id")
          .eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const dismissed = new Set((dism ?? []).map((d) => d.announcement_id));
      const visible = ((anns ?? []) as Announcement[]).filter(
        (a) => !dismissed.has(a.id),
      );
      setItems(visible);
      if (visible.length) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleClose = async () => {
    setOpen(false);
    if (!user || !items.length) return;
    // Mark all currently shown announcements as dismissed so they don't re-appear
    const rows = items.map((a) => ({
      user_id: user.id,
      announcement_id: a.id,
    }));
    await supabase
      .from("service_announcement_dismissals")
      .upsert(rows, { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
  };

  if (!items.length) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            What's New
          </DialogTitle>
          <DialogDescription>
            Recently added or updated services (last 24 hours).
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {items.map((a, i) => (
            <li
              key={a.id}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{a.title}</div>
                  {a.body && (
                    <div className="text-xs text-muted-foreground whitespace-pre-line mt-1">
                      {a.body}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
