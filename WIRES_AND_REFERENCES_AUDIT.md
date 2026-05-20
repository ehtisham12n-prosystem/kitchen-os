# Wiring and References Audit

## Frontend -> Backend
- Only a subset of pages call real APIs.
- Many modules are UI-only with mock data.
- Some routes in `api.ts` have no backend implementation.

### Key Mismatches
- Frontend expects `GET /v1/auth/me` (missing).
- Frontend calls `/v1/platform/roles` but backend has no endpoint.
- Production: frontend expects `/v1/production/{branchId}`; backend uses `/v1/production` with body.
- Inventory ops: frontend uses `/v1/inventory-op/...` and backend also has `/v1/inventory/ops`.

## Backend -> Database
- `synchronize: true` enabled.
- Migration SQL exists but not integrated with TypeORM migrations.
- Tenant isolation not consistent.

## Page Routing
- Multiple pages exist but are not referenced in `App.tsx` routes.
- Some routes exist but are not in navigation menus.

## Auth and Session
- Branch access depends on `x-branch-id` header set by frontend.
- JWT payload contains `allowed_branches`, but active branch selection is partially enforced.

## Offline POS Wiring
- Electron POS has local SQLite DB and IPC APIs.
- Backend has minimal `/v1/pos/sync` handling without conflict logic.
- No server-side sync queue or device registry exists.
- No end-to-end reconciliation flow.

