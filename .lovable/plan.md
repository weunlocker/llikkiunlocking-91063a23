
## Goal

One-time import of all goimei services. Existing services get **linked** (not replaced) so their group pricing (Silver/Gold/Diamond), category, and history are preserved. Unmatched goimei services get auto-created as new active services.

## How it works

A new admin page **Admin → Supplier Import** with a 3-step wizard for the goimei supplier:

```text
[1 Sync]  →  [2 Review matches]  →  [3 Import]
```

### Step 1 — Sync
Reuses the existing `supplier-sync` edge function to pull the full goimei service list into `supplier_services` (already works). Shows count.

### Step 2 — Review matches (the important part)
Loads:
- All `supplier_services` rows for the goimei supplier
- All existing `services` rows

For each goimei service, computes a similarity score against every existing service using:
- **Name** — token-based fuzzy match (normalize: lowercase, strip punctuation, drop noise words like "check / unlock / service / premium / instant", then Jaccard/Dice on tokens). Weight: 70%.
- **Price** — closeness of goimei `credit` to your `price` (within ±20% = full, ±50% = partial). Weight: 20%.
- **Delivery time** — same bucket (instant / minutes / hours / days). Weight: 10%.

Best match per goimei service is preselected when score ≥ a threshold (e.g. 0.55). Below that → "Create new".

The review screen shows a table:

```text
goimei service          | suggested match (your catalog)        | action
------------------------|---------------------------------------|---------------------
iCloud Clean iPhone     | iPhone iCloud Status (Clean) [0.82]   | [Link ▼] [Skip]
FMI Off Premium         | — (no good match, 0.31)               | [Create new ▼]
...
```

User can:
- Change the matched service from a searchable dropdown of all services
- Switch action to **Link / Create new / Skip**
- Bulk actions: "Accept all suggestions", "Create new for all unmatched"

### Step 3 — Import (single call)
One edge function `supplier-bulk-link` accepts the reviewed plan:

```ts
{ supplier_id, items: [
  { action_code, action: "link",   service_id },
  { action_code, action: "create", name, price, delivery_time, category },
  { action_code, action: "skip" },
]}
```

For each item:
- **link** → `UPDATE services SET supplier_id=…, supplier_action=action_code WHERE id=service_id` (keeps your price, category, group discounts, existing orders).
- **create** → `INSERT INTO services (name, price, delivery_time, category, supplier_id, supplier_action, active=true)` using goimei's values. Category defaults to `general` (editable in row).
- **skip** → nothing.

Returns counts: linked / created / skipped / failed.

## Safety

- **Nothing is deleted.** Existing services that don't get linked stay exactly as they are.
- **No price changes** on linked services — group discounts (Default/Silver/Gold/Diamond) keep working untouched because they're computed from `services.price`.
- Idempotent: re-running the wizard re-loads current `supplier_id` links and shows them as already-linked so you don't double-create.
- All work is admin-only (RLS already enforces).

## Files to add

- `src/pages/AdminSupplierImport.tsx` — wizard UI
- `src/lib/serviceMatch.ts` — similarity scoring (pure TS, no deps)
- `supabase/functions/supplier-bulk-link/index.ts` — applies the plan server-side with service-role + admin check
- Route + sidebar link in `AdminLayout`

## Out of scope

- No background sync function, no cron.
- No automatic price syncing later — one-time only, as requested.
