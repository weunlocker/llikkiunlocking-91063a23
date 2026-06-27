// Helper to send templated emails via the send-transactional-email function.
// Uses direct fetch (not sb.functions.invoke) to avoid background-task
// cancellation when the parent edge function returns its response.
// Respects per-event user preferences on the profiles table.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EmailEvent =
  | "welcome"
  | "order_placed"
  | "order_success"
  | "order_rejected"
  | "balance_update"
  | "balance_topup"
  | "referral_bonus";

// Map every app event to one of the 4 admin SMTP templates configured in
// Admin → Email Settings (welcome / order_success / order_rejected / balance_update).
// Events without a dedicated template fall back to the closest match.
const SMTP_EVENT_MAP: Record<EmailEvent, "welcome" | "order_success" | "order_rejected" | "balance_update"> = {
  welcome: "welcome",
  order_placed: "order_success",
  order_success: "order_success",
  order_rejected: "order_rejected",
  balance_update: "balance_update",
  balance_topup: "balance_update",
  referral_bonus: "balance_update",
};

// Maps each event to the per-user toggle column controlling it.
// `null` = always send (e.g. welcome).
const EVENT_TOGGLE: Record<EmailEvent, string | null> = {
  welcome: null,
  order_placed: "notify_order_placed",
  order_success: "notify_order_completed",
  order_rejected: "notify_order_completed",
  balance_update: "notify_balance_updates",
  balance_topup: "notify_balance_updates",
  referral_bonus: "notify_balance_updates",
};

export async function notifyUserEmail(
  sb: SupabaseClient,
  userId: string,
  event: EmailEvent,
  data: Record<string, string | number | null | undefined> = {},
) {
  try {
    const { data: prof } = await sb
      .from("profiles")
      .select(
        "email, display_name, notify_email, notify_order_placed, notify_order_completed, notify_balance_updates",
      )
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.email) {
      console.log(`[notifyUserEmail] skip ${event}: no email for user ${userId}`);
      return;
    }
    if (prof.notify_email === false) {
      console.log(`[notifyUserEmail] skip ${event}: master email switch off`);
      return;
    }
    const toggleCol = EVENT_TOGGLE[event];
    if (toggleCol && (prof as Record<string, unknown>)[toggleCol] === false) {
      console.log(`[notifyUserEmail] skip ${event}: per-event toggle ${toggleCol} off`);
      return;
    }

    const recipientName = prof.display_name ?? prof.email;

    // Read provider from email_settings (smtp | lovable). Default smtp.
    const { data: cfg } = await sb
      .from("email_settings")
      .select("provider, enabled")
      .eq("id", 1)
      .maybeSingle();
    if (cfg && cfg.enabled === false) {
      console.log(`[notifyUserEmail] skip ${event}: email_settings.enabled=false`);
      return;
    }
    const provider = (cfg?.provider as string) ?? "smtp";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Always use the React Email transactional templates (registry) for a
    // consistent, branded look. The send-transactional-email function detects
    // the configured provider (smtp | lovable) and dispatches accordingly.
    const TPL: Record<EmailEvent, string> = {
      welcome: "welcome",
      order_placed: "order-placed",
      order_success: "order-success",
      order_rejected: "order-rejected",
      balance_update: "balance-update",
      balance_topup: "balance-topup",
      referral_bonus: "referral-bonus",
    };
    const templateName = TPL[event] ?? "welcome";
    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail: prof.email,
        idempotencyKey: `${event}-${userId}-${Date.now()}`,
        templateData: { name: recipientName, ...data },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[notifyUserEmail] ${event} (${provider}=${templateName}) → ${res.status}: ${txt.slice(0, 300)}`);
    } else {
      console.log(`[notifyUserEmail] ${event} sent via ${provider} to ${prof.email}`);
    }


  } catch (e) {
    console.error("notifyUserEmail failed", event, e);
  }
}
