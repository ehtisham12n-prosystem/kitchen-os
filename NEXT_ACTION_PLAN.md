# Next Action Plan

## Phase 0: Stabilization / Cleanup
- Remove or consolidate duplicate modules (clients, vendors, inventory ops)
- Remove dead routes and unused pages
- Standardize route naming
- Lock down seed/reseed endpoints

## Phase 1: Foundation Alignment
- Decide and lock database engine (MySQL vs PostgreSQL)
- Align SQL and ORM queries accordingly
- Enforce tenant isolation with `client_id` in all operational tables
- Create consistent DTOs and validation

## Phase 2: Core Wiring
- Align frontend API calls with backend routes
- Implement missing endpoints (`auth/me`, role APIs, etc.)
- Replace inline fetch calls with `api.ts` wrapper

## Phase 3: Core ERP Module Completion
- POS payments, settlement, and cash flow
- Inventory ops unification with single ledger
- Procurement approvals and vendor invoices
- Minimal HR attendance backend
- Accounting posting automation

## Phase 4: Offline POS Implementation
- Device registry and branch-level sync coordination
- Idempotent sync endpoint and conflict handling
- Local cache for menu, pricing, taxes, discounts
- Sync reconciliation UI and error recovery

## Phase 5: Quality & Security
- Full RBAC enforcement on every protected route
- Audit logs for all mutations
- Rate limiting and auth hardening

## Phase 6: Production Readiness
- Remove `synchronize: true`, enforce migrations
- Environment configuration and deployment pipeline
- Seed scripts controlled by admin only

