## Goal
Add a dual Telegram bot system (Admin Bot + Client Bot) with Dhru-style pairing, push notifications, and interactive commands.

## 1. Database changes
- Add columns to `site_settings`:
  - `admin_bot_token`, `admin_bot_username`, `admin_chat_ids` (text[]), `client_bot_token`, `client_bot_username`
- New table `telegram_pairings`:
  - `user_id`, `code` (6-digit), `bot_kind` ('admin'|'client'), `expires_at`, `used_at`, `chat_id`
- Add to `profiles`: `client_bot_chat_id` (already have `telegram_chat_id` — repurpose or add separate `admin_bot_chat_id` for admins).
- New table `auth_login_events` (user_id, email, ip, user_agent, success, created_at) — for login success/failed alerts.

## 2. Edge functions
- **`telegram-admin-webhook`** (verify_jwt=false): receives admin bot updates. Commands: `/start`, `/clients`, `/orders`, `/invoices`, `/balance <user>`. Validates chat_id is in `admin_chat_ids`.
- **`telegram-client-webhook`** (verify_jwt=false): receives client bot updates.
  - `/start <code>` or plain 6-digit message → look up `telegram_pairings`, bind chat_id to user.
  - `/balance` → show balance.
  - `/orders` → last 10 orders.
  - `/placeorder` → interactive: list services (paginated inline keyboard) → ask IMEI → confirm → call existing check logic.
  - `/status <imei>`.
- **`telegram-pair`** (called from client panel): generates pairing code, stores in `telegram_pairings`, returns `{code, bot_username}`.
- **`telegram-set-webhooks`** (admin-only): registers webhook URLs with both bots using their tokens (saved in settings). Also calls `setMyCommands`.
- **`telegram-notify`** (extend existing): add events for `login_success`, `login_failed`, `order_placed`, `order_success`, `order_rejected`. Routes to admin bot (all admins) and client bot (the specific user) based on event.

## 3. Frontend
- **Admin → Settings → Telegram tab**:
  - Inputs for admin & client bot tokens, usernames, admin chat IDs (comma-separated).
  - "Register webhooks" button → calls `telegram-set-webhooks`.
  - Test buttons.
- **Client Dashboard → "Connect Telegram" card**:
  - Shows `@client_bot_username` + 6-digit pairing code (refresh button, 10-min expiry countdown).
  - Instructions: "Open bot → send /start <code>".
  - Once paired: shows "Connected as @username — Disconnect".
- **Login page**: trigger `auth_login_events` insert + call `telegram-notify` (login_success/login_failed) with IP from request headers.

## 4. Notification triggers
- Hook into existing order flow (`_shared/check.ts`, `poll-dhru-orders`) to call `telegram-notify` on placed/success/rejected.
- Hook into `useAuth` sign-in for login alerts (call edge function with IP).

## 5. Security
- All bot tokens stored in `site_settings` (admin-only RLS).
- Webhook secret token derived from bot token (HMAC) — verified on each webhook hit.
- Pairing codes single-use, 10-min expiry, rate-limited per user.
- Admin commands gated by chat_id whitelist.

## Technical notes
- Bot API calls use direct `https://api.telegram.org/bot{TOKEN}/...` (no Telegram connector since admin supplies tokens).
- Inline keyboards for `/placeorder` service picker (callback_data carries service_code).
- `setMyCommands` so users see suggestions in Telegram UI.
- Idempotency: store `update_id` on processed updates table to dedupe Telegram retries.
