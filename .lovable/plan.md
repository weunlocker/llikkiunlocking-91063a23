## All 20 features — phased rollout

Building 20 features at once would be unstable. I'll ship in 3 reviewable batches.

### Batch 1 — Mobile shell & engagement (this turn)
1. Bottom navigation bar (mobile only) — Home, Services, Orders, Profile
2. Loading skeletons on Dashboard & Services lists
4. Standardize toast feedback (already partly done — sweep remaining alerts)
6. Floating "Help" button → opens support / FAQ (extend existing FloatingContact)
15. In-app notifications center (bell icon in header) — uses existing support events + new `user_notifications` table
17. Profile completion progress card (Dashboard)
18. Live chat / support button — already exists, polish & always-visible on mobile
19. FAQ / Help center page (`/help`) — admin-editable later

### Batch 2 — Order flow polish
10. Quick reorder button on past orders
13. Price calculator dialog before placing order
14. Order tracking page with real-time status (Realtime subscription)
20. Order tracking page polish

### Batch 3 — Nice-to-haves
3. Empty states with illustrations
5. Pull-to-refresh on mobile lists
7. Recently viewed services
8. Favorites / wishlist
9. Search history
11. Saved payment shortcut
12. Currency switcher polish
16. Onboarding tour for new users

### Technical notes
- New table: `user_notifications` (id, user_id, type, title, body, link, read_at, created_at) with RLS — user reads own only.
- New component: `BottomNav.tsx` shown only on mobile + authenticated pages.
- New page: `Help.tsx` with collapsible FAQ from existing site_settings or hardcoded initially.
- New component: `NotificationsBell.tsx` in Layout header.
- Profile completion: compute % from filled fields in profile (phone, address, city, country).
- All new colors use existing design tokens (no hardcoded colors).

Reply "go" to start Batch 1, or tell me to reorder/skip items.