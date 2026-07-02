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
      // Show all announcements from the last 24 hours on every launch/refresh
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: anns } = await supabase
        .from("service_announcements")
        .select("id,kind,title,body,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const all = (anns ?? []) as Announcement[];
      // Dedupe: keep only the most recent announcement per service (title+kind)
      const seen = new Set<string>();
      const visible = all.filter((a) => {
        const key = `${a.kind}::${a.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(visible);
      if (visible.length) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleClose = () => {
    setOpen(false);
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
