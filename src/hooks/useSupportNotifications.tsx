import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Plays a short notification beep using WebAudio (no asset required).
function beep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch { /* ignore */ }
}

/**
 * Global realtime listener:
 * - Admins get a toast + beep whenever a USER sends a new support message.
 * - Users get a toast + beep whenever an ADMIN replies on one of their tickets.
 * Mounted once at the Layout level so notifications work on every page.
 */
export function useSupportNotifications() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    startedAt.current = Date.now();

    const isAdminUser = !!isAdmin;
    const topic = isAdminUser ? "notify-admin" : `notify-user-${user.id}`;
    const goTo = isAdminUser ? "/admin/support" : "/dashboard?tab=support";

    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_messages" },
        async (payload) => {
          const m = payload.new as { ticket_id: string; sender_id: string; sender_type: "user" | "admin"; message: string };
          // Ignore my own messages
          if (m.sender_id === user.id) return;
          if (isAdminUser) {
            if (m.sender_type !== "user") return;
          } else {
            if (m.sender_type !== "admin") return;
            // Verify the ticket belongs to me (RLS will already filter, but extra safety)
            const { data: t } = await supabase
              .from("support_tickets").select("user_id,subject")
              .eq("id", m.ticket_id).maybeSingle();
            if (!t || t.user_id !== user.id) return;
            showToast(t.subject ?? "Support reply", m.message, goTo);
            return;
          }
          // Admin path — fetch subject + email for context
          const { data: t } = await supabase
            .from("support_tickets").select("subject,user_id")
            .eq("id", m.ticket_id).maybeSingle();
          let from = "a user";
          if (t?.user_id) {
            const { data: p } = await supabase.from("profiles").select("email,display_name").eq("id", t.user_id).maybeSingle();
            from = p?.display_name || p?.email || from;
          }
          showToast(`New support message from ${from}`, t?.subject ? `${t.subject}: ${m.message}` : m.message, goTo);
        },
      )
      .subscribe();

    function showToast(title: string, body: string, link: string) {
      beep();
      toast(title, {
        description: body.length > 140 ? body.slice(0, 140) + "…" : body,
        action: { label: "Open", onClick: () => navigate(link) },
        duration: 8000,
      });
    }

    return () => { supabase.removeChannel(ch); };
  }, [user, isAdmin, navigate]);
}
