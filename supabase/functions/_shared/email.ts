// Helper to send templated emails via the send-email edge function.
// Looks up the user's email & display name, then calls the function.
// Failures are swallowed (logged) so they never break the calling flow.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EmailEvent = "welcome" | "order_success" | "order_rejected" | "balance_update";

export async function notifyUserEmail(
  sb: SupabaseClient,
  userId: string,
  event: EmailEvent,
  data: Record<string, string | number | null | undefined> = {},
) {
  try {
    const { data: prof } = await sb
      .from("profiles")
      .select("email, display_name, notify_email")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.email) return;
    if (prof.notify_email === false) return;

    await sb.functions.invoke("send-email", {
      body: {
        event,
        to: prof.email,
        data: { name: prof.display_name ?? prof.email, ...data },
      },
    });
  } catch (e) {
    console.error("notifyUserEmail failed", event, e);
  }
}
