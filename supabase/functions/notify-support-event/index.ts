// Sends Telegram + email notifications for support ticket events.
// Called from the client immediately after inserting a ticket or message.
//
// Body: { ticket_id: string, event: "created" | "user_message" | "admin_reply", preview?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function callFn(url: string, key: string, name: string, body: unknown) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[notify-support-event] ${name} → ${res.status}: ${txt.slice(0, 300)}`);
  }
}

function truncate(s: string, n = 240) {
  s = (s ?? "").replace(/!\[image\]\([^)]+\)/g, "[image]").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Unauthorized" });

    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: u } = await admin.auth.getUser(token);
    const caller = u?.user;
    if (!caller) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticket_id ?? "");
    const event = String(body?.event ?? "");
    const preview = truncate(String(body?.preview ?? ""));
    if (!ticketId || !["created", "user_message", "admin_reply"].includes(event)) {
      return json(400, { error: "Invalid payload" });
    }

    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, subject, user_id, priority")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return json(404, { error: "Ticket not found" });

    // Authorize: admins always, otherwise only the ticket owner (for created/user_message)
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin");
    const isAdmin = !!roles?.length;
    const isOwner = ticket.user_id === caller.id;
    if (!isAdmin && !isOwner) return json(403, { error: "Forbidden" });

    // Get user info for context
    const { data: profile } = await admin
      .from("profiles").select("email, display_name").eq("id", ticket.user_id).maybeSingle();
    const who = profile?.display_name || (profile?.email ? String(profile.email).split("@")[0] : "user");

    if (event === "created" || event === "user_message") {
      // Notify all admins via Telegram
      const subject = event === "created"
        ? `🎫 New support ticket from ${who}`
        : `💬 New message on ticket from ${who}`;
      const msg = `Subject: ${ticket.subject}\nPriority: ${ticket.priority}\n\n${preview || "(no text)"}`;
      await admin.functions.invoke("telegram-notify", {
        body: { broadcast: "admins", subject, body: msg, format: "plain" },
      });
    } else if (event === "admin_reply") {
      // Notify the ticket owner via Telegram + email
      const subject = `💬 Support reply on: ${ticket.subject}`;
      const msg = `You have a new reply from support.\n\n${preview || "(no text)"}\n\nOpen your ticket on the dashboard to reply.`;
      await callFn(SUPABASE_URL, SERVICE_KEY, "telegram-notify", { user_id: ticket.user_id, subject, body: msg, format: "plain" });
      if (profile?.email) {
        await callFn(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, "send-transactional-email", {
          templateName: "support-reply",
          recipientEmail: profile.email,
          idempotencyKey: `support-reply-${ticket.id}-${Date.now()}`,
          templateData: {
            name: profile.display_name ?? profile.email,
            subject: ticket.subject,
            message: preview,
          },
        });
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown" });
  }
});
