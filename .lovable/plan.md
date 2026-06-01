## Goal

Support Dhru **Server Services** (unlock/IMEI codes that need extra inputs like Quantity, Email, Username, Password, MEID, etc.) in addition to the existing IMEI Services.

The custom fields are defined by the supplier per-service. When admin picks a supplier service in the editor, the field schema appears automatically. When the customer orders, those fields are rendered as inputs and sent to Dhru.

## 1. Database

Migration adds:

**`supplier_services`**
- `service_type text not null default 'imei'`  — `'imei'` or `'server'`
- `fields jsonb not null default '[]'` — `[{ name, label, type, required, default, options? }, ...]` extracted from Dhru `Custom` block

**`services`**
- `service_type text not null default 'imei'` — copied when admin picks a supplier server-service
- `custom_fields jsonb not null default '[]'` — same shape; auto-filled from `supplier_services.fields` on selection, editable by admin

Grants already exist for both tables; no new tables.

## 2. `supplier-sync` edge function

In addition to `imeiservicelist`, also call Dhru `serverservicelist` for the same supplier in the same sync.

For each server service, parse the `Custom` block (Dhru returns `Custom: { "1": {field: "imei", label: "IMEI", required: true}, "2": {field: "email", label: "Email", required: false}, ... }` — keys vary by Dhru version, code already walks all casings).

Insert rows with `service_type = 'server'` and `fields = [...]`.

## 3. Admin service editor (`src/pages/Admin.tsx`)

- Supplier-service picker already lists `supplier_services`. Show a small `[SERVER]` / `[IMEI]` tag per row.
- When admin selects a row with `service_type='server'`, set on the service: `service_type='server'`, `custom_fields = <synced fields>`, and `input_mode='custom'` so the order dialog renders fields instead of just IMEI.
- Below the picker, render a read-only preview of the field schema (name, label, required) so admin can see what end-users will see.

## 4. End-user order dialog (`src/components/ImeiCheckDialog.tsx`)

If `service.service_type === 'server'` and `custom_fields.length > 0`:
- Render one input per field (text / number / select / textarea based on `type`).
- Validate required fields client-side.
- Submit `fields` object alongside the existing payload.

The first/primary field doubles as the "IMEI"-equivalent identifier so the existing `orders.imei` column is still populated (use whichever field is named imei/serial/identifier, else the first field's value).

## 5. Order placement (`supabase/functions/_shared/check.ts` + `poll-dhru-orders`)

When supplier is Dhru and `service.service_type === 'server'`:
- Use action `placeserverorder` instead of `placeimeiorder`.
- Build the `<PARAMETERS>` block / form fields from the submitted `fields` object plus the service `ID`.
- Polling stays the same — Dhru returns a reference id either way.

Store the submitted field values on the order (reuse `orders.imei` for the primary field; stash the rest in a new `orders.fields jsonb` column added in the same migration).

## Out of scope for this pass

- API (`/api-check`) support for server services — easy follow-up once the schema is in place.
- Per-field price/quantity multipliers.

## Order of work

1. Migration (schema)
2. `supplier-sync` — pull server services + fields
3. Admin UI — auto-show fields on select
4. Order dialog + `check.ts` placement — end-to-end ordering

Ship in that order; each step is independently testable.
