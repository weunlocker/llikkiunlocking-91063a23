// Helper to send templated emails via Lovable's send-transactional-email
// (LIKKIUNLOCKING branded). Falls back silently on failure so it never breaks
// the calling flow. Also keeps legacy SMTP send-email for events without a
// Lovable template (e.g. balance_update).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EmailEvent = "welcome" | "order_placed" | "order_success" | "order_rejected" | "balance_update" | "balance_topup" | "referral_bonus";

const LOVABLE_TEMPLATE_MAP: Partial<Record<EmailEvent, string>> = {
  welcome: "welcome",
  order_placed: "order-placed",
  order_success: "order-success",
  order_rejected: "order-rejected",
  balance_topup: "balance-topup",
  referral_bonus: "referral-bonus",
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
      .select("email, display_name, notify_email")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.email) return;
    if (prof.notify_email === false) return;

    const templateName = LOVABLE_TEMPLATE_MAP[event];
    const recipientName = prof.display_name ?? prof.email;

    if (templateName) {
      // Lovable transactional email (branded LIKKIUNLOCKING templates)
      const templateData: Record<string, unknown> = { name: recipientName };
      // Map snake_case payload to camelCase template props
      if (data.order_number !== undefined) templateData.orderNumber = data.order_number;
      if (data.imei !== undefined) templateData.imei = data.imei;
      if (data.service !== undefined) templateData.service = data.service;
      if (data.result !== undefined) templateData.result = data.result;
      if (data.charged !== undefined) templateData.charged = data.charged;
      if (data.balance !== undefined) templateData.balance = data.balance;
      if (data.error !== undefined) templateData.error = data.error;
      if (data.refund !== undefined) templateData.refund = data.refund;

      await sb.functions.invoke("send-transactional-email", {
        body: {
          templateName,
          recipientEmail: prof.email,
          idempotencyKey: `${event}-${userId}-${data.order_number ?? Date.now()}`,
          templateData,
        },
      });
      return;
    }

    // Fallback: legacy SMTP for events without a Lovable template
    await sb.functions.invoke("send-email", {
      body: {
        event,
        to: prof.email,
        data: { name: recipientName, ...data },
      },
    });
  } catch (e) {
    console.error("notifyUserEmail failed", event, e);
  }
}
