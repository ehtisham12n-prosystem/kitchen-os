# Commit Record

## 2026-05-22 02:43:44 +05:00

- Scope: Console auth access messaging, sidebar icon colors, and KDS KOT version printing.
- Summary: Added invalid-slug access guidance, distinct Branch Operations menu icon colors, and KDS Print KOT modal with version-specific printing and KOT times.
- Verification: `npm run build` passed for frontend and backend during the change set.

## 2026-05-22 15:53:48 +05:00

- Scope: KDS order cards, KOT history, prep-summary filtering, and Nexus client edit hydration.
- Summary: Added delta-safe KDS item/timer handling, KOT history modal improvements, item-only prep-summary filters, robust empty API response parsing, and client-code based Nexus client edit data loading.
- Verification: `npm run build` passed for frontend and backend during the change set.

## 2026-05-22 16:14:36 +05:00

- Scope: Frontend production API runtime resolution.
- Summary: Ignored localhost API configuration when the frontend is served from a non-local origin so deployed builds fall back to same-origin `/v1`.
- Verification: `npm run build` passed for frontend.

## 2026-05-25 00:29:53 +05:00

- Scope: KDS order card item display and prep-summary filtering.
- Summary: Preserved full active edited-order item lists, suppressed decrease tags on cancelled items, limited prep-summary filtering to line items, and added a Clear All option for active filters.
- Verification: `npm run build` passed for frontend.

## 2026-05-26 17:53:25 +05:00

- Commit: `fadeedbc71e3ddf1e70a90657de1d53c46aee28b`
- Branch: `main`
- Message: `Update GRN workflow and frontend fixes`
- Scope: GRN PO/non-PO workflow, GRN payment fields, local API proxy/runtime behavior, and frontend UI fixes.
- Summary: Added GRN source/payment schema support, enhanced the GRN form for PO and direct purchases, fixed local API routing through the Vite proxy, and included related client-management, table, pricing, KDS/POS print, finance, and inventory UI updates.
- DB Schema Changes: Added GRN purchase source and payment tracking columns to `goods_receipt_notes`. See `DB_SCHEMA_CHANGE_LOG.md`.
- Verification: Backend build and frontend build passed during the change set; GRN list API and browser page were verified after applying the migration locally.
