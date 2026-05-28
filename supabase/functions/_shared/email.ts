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

const LOVABLE_TEMPLATE_MAP: Partial<Record<EmailEvent, string>> = {
  welcome: "welcome",
  order_placed: "order-placed",
  order_success: "order-success",
  order_rejected: "order-rejected",
  balance_update: "balance-update",
  balance_topup: "balance-topup",
  referral_bonus: "referral-bonus",
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

    const templateName = LOVABLE_TEMPLATE_MAP[event];
    const recipientName = prof.display_name ?? prof.email;

    if (templateName) {
      const templateData: Record<string, unknown> = { name: recipientName };
      const keys: Array<[string, string]> = [
        ["order_number", "orderNumber"], ["imei", "imei"], ["service", "service"],
        ["result", "result"], ["charged", "charged"], ["balance", "balance"],
        ["error", "error"], ["refund", "refund"], ["amount", "amount"], ["note", "note"],
        ["method", "method"], ["reference", "reference"], ["bonus", "bonus"],
        ["percent", "percent"], ["topup_amount", "topupAmount"], ["referred_name", "referredName"],
      ];
      for (const [from, to] of keys) {
        if (data[from] !== undefined) templateData[to] = data[from];
      }

      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          templateName,
          recipientEmail: prof.email,
          idempotencyKey: `${event}-${userId}-${data.order_number ?? data.reference ?? Date.now()}`,
          templateData,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error(`[notifyUserEmail] ${event} → ${res.status}: ${txt.slice(0, 300)}`);
      } else {
        console.log(`[notifyUserEmail] ${event} queued for ${prof.email}`);
      }
      return;
    }

    // Legacy SMTP fallback for events without a queued app-email template.
    await sb.functions.invoke("send-email", {
      body: { event, to: prof.email, data: { name: recipientName, ...data } },
    });
  } catch (e) {
    console.error("notifyUserEmail failed", event, e);
  }
}
