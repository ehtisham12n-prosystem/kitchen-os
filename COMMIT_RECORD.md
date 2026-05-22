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
