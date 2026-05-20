# KitchenOS Project Audit Master

## Executive Summary
This project is a monorepo for a multi-tenant restaurant ERP + POS SaaS. It includes:
- A NestJS backend API
- A React web console for system, client, and branch portals
- An Electron offline POS client
- A secondary POS web experiment

Current maturity is early-to-mid prototype: broad UI coverage, partial backend functionality, inconsistent wiring, and incomplete data integrity and security enforcement.

### Strengths
- Broad UI coverage across ERP domains
- Foundational multi-tenant and branch architecture
- POS, inventory, accounting, and catalog entities exist
- Theming and security registry foundations exist

### Weaknesses
- Conflicting architecture choices (MySQL vs PostgreSQL)
- Duplicate modules and route inconsistencies
- Extensive mock/static data in UI
- Incomplete RBAC enforcement
- Tenant isolation gaps in data model

---

## Business-Critical Requirement Audit

### 1) Online + Offline POS Requirement

#### Current Support Status
- **Online POS**: Partially supported. There is a web POS (`frontend/pages/pos/PosTerminal.tsx`) and backend POS module (`backend/src/pos`). Basic order creation, KOT handling, shift open/close exist. Payment settlement, receipt finalization, and reconciliation are missing.
- **Offline POS**: **Partially supported only at a prototype level.**
  - `pos/` (Electron) contains SQLite schema (`pos/db.cjs`) with tables for offline orders and sync queue.
  - `pos/preload.cjs` exposes IPC APIs for offline order capture and a local sync queue.
  - `pos-app/` uses Dexie (IndexedDB) with a mocked `SyncService` (no real network sync).
  - No production-grade sync logic exists in backend or frontend.

#### Gaps vs Required Offline Capabilities
- **Branch-level continuity**: Not guaranteed. Offline storage is per device (local SQLite/IndexedDB), not branch-level shared.
- **Offline invoice generation**: Not implemented end-to-end (data capture exists, but printable invoice format and numbering rules are not enforced consistently).
- **Conflict handling**: Not implemented. Backend `/v1/pos/sync` is minimal and does not resolve duplicates or merges.
- **Duplicate submissions / partial sync**: No conflict resolution or idempotency keys.
- **Offline menu/pricing/taxes**: No full sync of menu, price, taxes, discount policies to offline store.
- **Stock impact rules offline**: Not enforced consistently; no offline inventory ledger applied for offline sales.

#### Data Model & Sync Strategy Needed
- **Device registry**: `pos_devices` table with branch linkage and device identity.
- **Sync queue**: `pos_sync_queue` (device_id, entity_type, payload, status, retry_count, created_at).
- **Local transaction IDs**: ULID/UUID with idempotency keys.
- **Sync metadata**: `last_synced_at`, `last_sequence`, `conflict_status`.
- **Receipt numbering**: branch + counter + sequence rules, generated offline with collision-safe prefixes.
- **Conflict resolution rules**:
  - Orders: device wins if created offline, server wins for master data (menu/pricing).
  - KOT: branch-local ordering and reconciliation required.
- **Audit trail**: separate `pos_void_events` and `pos_override_logs` with reasons.

#### Architecture Suitability
Current architecture is **not suitable** for robust offline-first operation without major changes. The pieces exist but are disconnected and lack sync integrity, conflict handling, and cross-device branch continuity.

#### Recommendation: Offline POS Approach
**Recommended approach: Hybrid POS (offline-capable, server-of-record online)**
- Use offline-first for order capture and billing.
- Treat server as canonical for master data, pricing, taxes, and reporting.
- Introduce branch-level local store or local server to coordinate KOT and counter sequencing across multiple devices.

---

### 2) Nexus vs Console Separation Requirement

#### Current Support Status
- **Routing separation exists** in the frontend: `/nexus` and `/console` are distinct.
- **Backend responsibilities are mixed**:
  - `platform` module includes both SaaS governance and operational setup endpoints.
  - Duplicate client creation flows exist in `platform` and `platform/clients`.
- **Permissions enforcement is missing** (`@RequirePermissions` not used).

#### Gaps
- **Role and permission boundaries** not enforced consistently.
- **Tenant isolation** inconsistent across some entities.
- **Subscription management** present but not fully enforced.
- **Billing and invoice tracking** not implemented as proper schema or workflow.

#### Architecture Suitability
Current structure partially supports Nexus and Console but lacks strong enforcement and clear service boundaries.

#### Recommendation: Nexus + Console Separation
**Recommended approach: Same monorepo, separate frontend apps, shared backend**
- Keep one backend but enforce strict platform vs tenant scopes.
- Split frontend into two build targets for Nexus and Console (shared design system and components).
- Use permission gates and route guards to enforce separation.

---

### 3) Validation Against Required Core Principles

| Requirement | Current Support | Notes |
|---|---|---|
| Multi-tenant SaaS | Partial | `client_id` exists but inconsistent in tables |
| Nexus vs Console separation | Partial | Routing exists, backend mixed |
| Online POS | Partial | Basic POS exists, incomplete payments |
| Offline POS | Prototype only | Offline DB exists but no sync strategy |
| Client/Branch/User hierarchy | Partial | Contract model exists but mixed usage |
| Platform vs client permissions | Weak | RBAC not enforced |
| Subscription management | Partial | Plans exist but enforcement missing |
| Billing/payment tracking | Missing | No invoice/payment tables |
| Security templates | Partial | Permission registry exists |
| Branch continuity during outage | Missing | No branch-level offline continuity |

---

## Architecture Understanding
### Monorepo Structure
- `D:\Antigravity\KitchenOS\backend` — NestJS + TypeORM API
- `D:\Antigravity\KitchenOS\frontend` — React + Vite web console
- `D:\Antigravity\KitchenOS\pos` — Electron + SQLite offline POS
- `D:\Antigravity\KitchenOS\pos-app` — React + Dexie POS experiment
- `D:\Antigravity\KitchenOS\docs` — ADRs and architecture docs

### Backend Stack
- NestJS 11, TypeORM 0.3, MySQL driver
- JWT auth + guard chain (JWT -> Branch -> Subscription)
- Many modules: platform, setup, catalog, inventory, pos, accounting, etc.

### Frontend Stack
- React 19, Vite 7, React Router v7, CSS modules
- LocalStorage-based auth state and branch context
- Large routing map in `App.tsx`

### Database
- MySQL configured in code and docker compose
- Docs mention PostgreSQL — conflict to resolve
- TypeORM `synchronize: true` enabled (unsafe for production)

---

## Module-Wise Status (Summary)
See `MODULE_STATUS_MATRIX.md` for full detail.

## Wiring and Integration Findings (Summary)
See `WIRES_AND_REFERENCES_AUDIT.md`.

---

## Risks
### Critical Technical Risks
- DB engine mismatch (MySQL vs PostgreSQL) causing query and migration incompatibilities
- Tenant isolation is inconsistent across tables and services
- Permission system exists but is not enforced (no `@RequirePermissions` usage)
- Public seed/reseed endpoints and data reset endpoints
- Offline POS sync strategy is missing

### Business Risks
- Incorrect accounting and stock results due to partial logic and duplicate modules
- POS flow incomplete (payments, settlement, reconciliation)
- UI expectations exceed backend capabilities
- Offline requirements not met for real operations

---

## Phased Action Plan
See `NEXT_ACTION_PLAN.md`.

---

## Assumptions
- This is not production and can be refactored
- The owner wants an enterprise-grade SaaS with strict tenant isolation
- Offline POS should eventually sync with the backend

## Open Questions
- Should the authoritative database be MySQL or PostgreSQL?
- Which POS client is intended as primary: Electron (`pos`) or `pos-app`?
- Should client creation flow be consolidated into `platform` or `platform/clients`?
- Are module naming and portal access rules fixed, or can they be redesigned?

---

## Implementation Backlog

### Critical Fixes
| Epic | Feature | Task | Description | Dependency | Priority | Suggested Order | Risk Level |
|---|---|---|---|---|---|---|---|
| Foundation Alignment | DB Standardization | Choose and lock DB engine | Resolve MySQL vs PostgreSQL conflict | Owner decision | P0 | 1 | High |
| Security | RBAC Enforcement | Add `@RequirePermissions` to protected routes | Activate SubscriptionGuard logic | Permissions registry readiness | P0 | 2 | High |
| Multi-Tenancy | Data Isolation | Add `client_id` to missing entities | Ensure all operational tables are tenant-scoped | DB migration approval | P0 | 3 | High |
| Platform | Remove Public Seeds | Restrict seed/reseed endpoints | Prevent public reseeding and wipe | Auth role decision | P0 | 4 | High |
| Integration | Fix API mismatches | Align frontend routes with backend | Resolve missing endpoints | Backend review | P0 | 5 | High |
| POS Offline | Offline Sync Strategy | Define and implement sync model | Idempotency, conflict handling, device registry | Architecture decision | P0 | 6 | High |

### Important Fixes
| Epic | Feature | Task | Description | Dependency | Priority | Suggested Order | Risk Level |
|---|---|---|---|---|---|---|---|
| Inventory | Unify Ops | Merge `inventory-op` and `inventory/ops` | Single stock ledger approach | DB design approval | P1 | 7 | High |
| Platform | Client Provisioning | Merge duplicate client creation flows | Single client onboarding path | DB decision | P1 | 8 | Medium |
| POS | Payments | Add payment tables and settlement flow | Proper cash/card tracking | Accounting design | P1 | 9 | High |
| Accounting | Voucher Integration | Link vouchers to POS posting | Improve revenue/discount accounting | POS improvements | P1 | 10 | Medium |
| Frontend | API Cleanup | Centralize API usage via `api.ts` | Replace inline fetch calls | Route alignment | P1 | 11 | Medium |
| Nexus/Console | Separation Enforcement | Enforce role boundaries | Strict platform vs tenant permissions | RBAC complete | P1 | 12 | High |

### Nice-to-Have Improvements
| Epic | Feature | Task | Description | Dependency | Priority | Suggested Order | Risk Level |
|---|---|---|---|---|---|---|---|
| UX | Accessibility | Improve keyboard focus and labels | Accessibility compliance | UI review | P2 | 13 | Low |
| Reporting | Advanced KPIs | Replace mock dashboard data | True analytics | Data pipeline | P2 | 14 | Medium |
| POS | Offline Sync Enhancements | Real-time conflict UI | Better operator visibility | Core sync complete | P2 | 15 | Medium |

