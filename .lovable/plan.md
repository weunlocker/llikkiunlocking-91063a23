## Goal
Reach more clients and reward every new user with **$1 free on first registration**, plus enable SEO, conversion, ads tracking, and stronger referrals.

---

## 1. $1 Signup Bonus (first registration)

- Add a `signup_bonus` setting to `site_settings` (amount, enabled flag).
- Update the `handle_new_user()` trigger so every new profile is created with `balance = signup_bonus_amount` (default $1.00) when enabled.
- Insert a matching row in `transactions` (type `admin_credit`, description "Welcome bonus $1.00") so users see it in history.
- Guard: only applied once on insert (trigger runs on signup only — naturally one-time).
- Show a "🎁 Get $1 FREE on signup" banner on Home hero + Register page.

## 2. Boost Referral Program (already exists)
- Display referral link prominently in Dashboard with copy button + share to WhatsApp/Telegram.
- Add a "Earn $X per friend" badge on Home.
- Show top referrers leaderboard (optional, opt-in).

## 3. SEO — More organic signups
- Add `react-helmet-async` per-page meta on Services, Pricing, FreeCheck, ServiceDetail (currently only via Seo component — verify coverage).
- Generate dynamic sitemap entries for each service slug (`scripts/generate-sitemap.ts`).
- Add FAQPage JSON-LD on Home & Pricing (common IMEI questions).
- Add BreadcrumbList JSON-LD on ServiceDetail.

## 4. Conversion improvements
- "$1 free credit" sticky banner for logged-out users.
- Exit-intent toast: "Wait — claim your $1 free credit".
- Trust signal: live counter "X checks today" (already have LiveActivityFeed — promote higher).

## 5. Paid ads + tracking
- Add Google Analytics 4 + Meta Pixel via site_settings (admin can paste IDs).
- Fire `sign_up`, `purchase` (topup), `check_completed` events.
- Honors existing CookieConsent (only load after Accept).

## 6. Marketing channels (no-code, advice only)
- Telegram channel auto-post on new service (broadcast function already exists — surface a "Subscribe" link in footer).
- WhatsApp Business click-to-chat button (FloatingContact already present — verify).

---

## Technical details

**DB migration:**
```sql
ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS signup_bonus_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_bonus_amount numeric DEFAULT 1.00;
```

**Trigger update** — modify `handle_new_user()`:
```sql
-- read bonus from site_settings; if enabled & > 0:
--   INSERT profiles with balance = bonus_amount
--   INSERT transactions (admin_credit, bonus_amount, "Welcome bonus")
```

**Admin UI:** add toggle + amount input in AdminEmailSettings or new section (Site Settings → Signup Bonus).

**Frontend banners:**
- `src/components/SignupBonusBanner.tsx` — shown on Home hero & Register page when enabled.
- Pulls amount from `useSiteSettings`.

**Analytics:**
- `src/lib/analytics.ts` — wrapper that loads GA4 + Meta Pixel scripts only after cookie consent.
- Add `ga_measurement_id` + `meta_pixel_id` columns to `site_settings`.
- Admin inputs in Site Settings page.

---

## What I'll deliver (in order)
1. DB migration (signup_bonus columns, updated trigger)
2. Admin UI to toggle/edit bonus + ads tracking IDs
3. SignupBonusBanner on Home + Register
4. Referral share buttons on Dashboard
5. GA4 + Meta Pixel loader (consent-gated)
6. Sitemap dynamic service entries + FAQ JSON-LD

Approve and I'll implement.