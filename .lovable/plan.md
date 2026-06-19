## Goal
Keep the **$1 free on new account** offer (no free checks, no other promo) — but make it far more attention-grabbing on the homepage so new visitors actually notice and sign up.

## What changes
Only the **presentation** of the existing $1 bonus. No backend changes, no new tables, no edge function changes. The trigger (`handle_new_user`) and `signup_bonus_*` settings stay exactly as they are.

## 1. New animated promo ribbon (top of every public page)
New component `src/components/PromoRibbon.tsx`, mounted in `Layout.tsx` above the navbar.

- Full-width slim bar, gradient background, subtle shimmer animation
- Copy: **"🎁 New here? Get $1.00 FREE credit instantly — Create account →"**
- Right-aligned dismiss (×) button, remembers dismissal in `localStorage` for 7 days
- Hidden when user is logged in
- Hidden when `signup_bonus_enabled` is false
- Amount auto-pulled from `useSiteSettings().signup_bonus_amount`

## 2. Upgrade the hero badge on Home
Replace the current small pill in `src/pages/Home.tsx` with a bigger, more visible **promo card** placed directly under the headline, before the CTA buttons:

```text
┌────────────────────────────────────────────────────────┐
│  🎁  LIMITED TIME WELCOME OFFER                         │
│  Get $1.00 FREE credit when you create your account    │
│  No card required • Instant • Use on any service       │
│  [ Claim $1 FREE → ]                                    │
└────────────────────────────────────────────────────────┘
```

- Glowing border (`border-primary/50`), pulse-glow animation on the gift icon
- Primary CTA button inside the card → `/register`
- Sits between the subtitle and the existing Start Checking / View Services buttons
- Only renders when `signup_bonus_enabled && signup_bonus_amount > 0`

## 3. Keep existing register page banner
The `Gift` banner already on `Register.tsx` stays (it confirms the offer at the point of conversion). No change there.

## Files touched
- **New:** `src/components/PromoRibbon.tsx`
- **Edited:** `src/components/Layout.tsx` (mount the ribbon)
- **Edited:** `src/pages/Home.tsx` (replace small pill with the bigger promo card)

## Out of scope
- Free checks, discount codes, referral changes, GA4/Pixel, exit-intent popups — none of these change.

Approve and I'll build it.
