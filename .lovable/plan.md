## Goal

Replace the Binance Pay merchant flow with a **personal Binance account** flow:
- Admin enters Binance **Pay ID**, **QR image**, **read-only API key/secret**, supported coins
- Customer top-up shows the QR + Pay ID + a **unique memo** for their order
- A scheduled job polls Binance deposit history with the personal API key, matches deposits by memo/amount, and auto-credits the user's wallet
- Other payment gateways stay visible in admin but disabled ("coming soon")

## Database changes (one migration)

Extend `payment_settings` with personal-account fields:
- `binance_pay_id` (text) — public Pay ID shown to customers
- `binance_qr_url` (text) — uploaded QR image (uses existing `branding` storage bucket)
- `binance_coins` (jsonb, default `["USDT"]`) — coins to accept
- `binance_min_amount` (numeric, default 1) — min top-up
- `binance_poll_enabled` (bool, default true)
- `binance_last_polled_at` (timestamptz)
- (existing `binance_api_key` / `binance_secret_key` are reused for the read-only personal API key)

Extend `payment_orders`:
- `memo` (text, unique-per-pending) — short code customer must paste in Binance "Remarks"
- `coin` (text)
- `tx_id` (text) — matched Binance deposit txId
- `matched_at` (timestamptz)

Add stub rows + UI flags for placeholder providers (no schema change needed; rendered as disabled cards).

## Edge functions

**Modify `binance-create-order`** → rename behavior to "create pending top-up":
- Validate amount, generate short unique `memo` (e.g. `LK-AB12CD`), insert `payment_orders` row with `status=pending`, `expires_at = now()+expiry`
- Return `{ pay_id, qr_url, coins, amount, memo, expires_at }` for the client to display

**New `binance-poll-deposits`** (scheduled, no JWT):
- Loads `payment_settings`, signs `GET /sapi/v1/capital/deposit/hisrec` with HMAC-SHA256 using personal API key/secret
- For each `status=1` (success) deposit, look for a pending `payment_orders` row where the deposit memo (or `addressTag`) matches and amount ≥ requested
- On match: mark order `paid`, set `tx_id`/`matched_at`, increment `profiles.balance`, insert `transactions` row, send notification
- Updates `binance_last_polled_at`
- Cron: every 1 min via `pg_cron` + `pg_net`

**Keep `binance-webhook`** but make it a no-op (returns 200) since merchant API is no longer used.

## Frontend

**Admin → Payments (`src/pages/AdminPayments.tsx`)**
- Binance section: Pay ID, QR upload (to `branding` bucket), read-only API key/secret, coins multi-select, min amount, expiry minutes, poll toggle, "Test deposit poll" button
- Below Binance, show **disabled placeholder cards**: Stripe, PayPal, Crypto.com Pay — each with a "Coming soon" badge so they're visible but inert

**Dashboard wallet top-up (`src/pages/Dashboard.tsx`)**
- After amount selection, show a **payment dialog**: large QR image, copyable Pay ID, copyable **memo**, amount + coin, countdown timer
- Polls own `payment_orders` row every 5s; closes with success toast when `status=paid`
- "I've paid" button → manual TXID submit (optional, creates an admin task)

**Order edit dialog (admin)** — small "Match payment" helper that lists unmatched deposits (optional, can ship later).

## Security notes
- Personal Binance API key needs only **Enable Reading** permission; never enable Withdraw/Trade
- Stored encrypted-at-rest in `payment_settings`, only accessed by service role in edge functions
- Memo collision avoided by 6-char random + DB unique check
- Rate-limit `binance-create-order` per user (1 pending order at a time)

## Out of scope
- Implementing Stripe/PayPal/etc. (placeholders only)
- Withdrawal/refund automation
