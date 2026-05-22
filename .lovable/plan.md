# Upgrade Plan — 4 New Features

Building 4 features in order. Each is delivered independently so the app stays working.

---

## 1. Analytics Dashboard (Admin)

A new **Analytics** tab inside the admin panel with:

- **KPI cards**: Total revenue, total orders, success rate, active users (today / 7d / 30d / all-time toggle).
- **Revenue chart**: Daily revenue line chart (last 30 days).
- **Orders chart**: Stacked bar — completed vs rejected vs pending per day.
- **Top services**: Table — top 10 services by order count and revenue.
- **Top users**: Table — top 10 users by spend.
- **User growth**: New signups per day (last 30 days).

Tech: `recharts` (already used in shadcn), aggregated via SQL views / RPC functions for speed.

---

## 2. Invoices & Receipts

- **Per-order invoice**: Users can click "Download Invoice" on any completed order on the Dashboard → generates a branded PDF (site logo, brand name, order #, IMEI, service, price, date, status, result summary).
- **Bulk export**: Users can export their full order history as CSV or Excel from the Dashboard "Orders" tab.
- **Admin export**: Admin can export all orders / all transactions as CSV from the Admin panel.
- **Auto-email receipt**: When an order completes successfully, the user receives a branded HTML email with the invoice details and a link to download the PDF.

Tech: `jspdf` + `jspdf-autotable` for client-side PDF generation (no edge function needed → free, instant). Email uses the existing Lovable Email infrastructure already configured in the project.

---

## 3. Support Ticket System

New tables:
- `support_tickets` (id, user_id, subject, status [open/pending/closed], priority, created_at, updated_at)
- `support_ticket_messages` (id, ticket_id, sender_id, sender_type [user/admin], message, created_at)

User side (new "Support" tab on Dashboard):
- List of their tickets with status badges
- "New Ticket" form (subject + initial message)
- Open ticket → chat-style thread, reply box
- Realtime updates via Supabase Realtime

Admin side (new "Support" section in Admin):
- Inbox of all tickets, filter by status/priority
- Open ticket → reply, change status, close
- Unread/new ticket badge in admin sidebar

RLS: Users see only their tickets; admins see all.

---

## 4. Order Notifications

Extend the existing notification system so users get notified on **every order status change** (pending → processing → completed/rejected), not just completion.

- Use existing `notify_email` and `notify_telegram` toggles on `profiles`.
- Add a new `notify_on_status_change` boolean (defaults true) so users can opt out of intermediate updates.
- Trigger: A database trigger on `orders` table fires when `status` changes → calls an edge function `send-order-notification` → routes to email + Telegram based on user prefs.
- Email uses Lovable Email queue (already set up).
- Telegram uses existing `client_bot_token` from `site_settings` and `client_bot_chat_id` from `profiles`.

---

## Build Order

1. **Invoices & Receipts** (smallest, no DB changes for PDF/CSV; email receipt last)
2. **Analytics Dashboard** (read-only queries, no schema changes for charts)
3. **Order Notifications** (one migration: trigger + flag; one edge function)
4. **Support Tickets** (largest: 2 tables, RLS, UI on both sides, realtime)

After each feature lands the app remains fully working.
