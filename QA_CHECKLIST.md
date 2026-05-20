# QA_CHECKLIST - KitchenOS Gap Alignment

## BATCH 1: Security - Permission Registry (Nexus side)

### 🗓️ Status Record
- **Batch Number**: 1
- **Module / Page**: Security - Permission Registry (`pages/platform/security/Registry/PermissionRegistry.tsx`)
- **Review Date**: 2026-02-28
- **Status**: Audit Complete - GAPS IDENTIFIED

### 🔍 Frontend Fields Audited
- **Module Registry**:
  - `id`: string (slug)
  - `name`: string
  - `description`: string
  - `icon`: string (icon slug)
- **Page Definition**:
  - `id`: string (slug)
  - `name`: string
  - `description`: string
  - `actions`: string[] (e.g. ['read', 'create', 'void_order'])
- **Group Template (System Group)**:
  - `id`: string (uuid)
  - `name`: string
  - `description`: string
  - `type`: 'standard' | 'minimal' | 'executive'
  - `selectedPermissions`: string[] (format: 'module.page.action')

### ⚠️ Gaps Identified
| Frontend Field | Page / Module | Missing In | Suggested Action |
|---|---|---|---|
| Module Registry Entity | Permission Registry | API / DB | Create `PermissionModule` and `PermissionPage` entities. |
| Group `description` | Permission Registry | DB | Add `description` column to `system_groups` table. |
| Group `type` | Permission Registry | DB | Add `type` column to `system_groups` table (standard/minimal/executive). |
| API Endpoints | Permission Registry | API | Create controllers for CRUD on Registry and Groups. |

### 🛠️ Approved Changes
- **Entities Created**: `PermissionModule`, `PermissionPage`.
- **Entities Updated**: `SystemGroup` (added `description`, `type`, `is_system_default`, `is_active`), `SystemUser` (added `user_number`, `department`, `designation`, `internal_notes`, `avatar_color`, `profile_picture`).
- **Registry Module**: Implemented CRUD for Modules/Pages and seeding logic in `RegistryService`.
- **Integration**: Wired `RegistryModule` into `PlatformModule`.

### ✅ Verification Result: VERIFIED
- **Unit (API)**: Verified. DTO validation (class-validator) implemented and enforced via global ValidationPipe.
- **Integration**: Verified. Registry seeding is idempotent (checks for existing record count before execution). Relation between Module and Page verified via `relations: ['pages']`.
- **E2E (UI Flow)**: Pending (Frontend wiring required in next phase).
- **Core Persistence**: Verified for `SystemGroup` and `SystemUser` new fields via spread operator in TypeORM services.

### ⚠️ Blockers / Notes
1. **Packages Installed**: `class-validator` and `class-transformer` added to `backend/package.json`.
2. **Architectural Inconsistency**: Backend is using `mysql2` driver (MySQL/MariaDB) while Project Briefing notes PostgreSQL. This is a known inconsistency to be addressed in a future task if needed.
3. **Registry Seeding**: Seeding data matches frontend mock-up precisely (`dashboard`, `pos` modules).

---

## BATCH 2: Clients & Billing (Nexus side)

### 🗓️ Status Record
- **Batch Number**: 2
- **Module / Pages**: Client Management (`ClientManagement.tsx`), Client Editor (`ClientEditor.tsx`), Subscription Packages (`SubscriptionGroupList.tsx`, `SubscriptionGroupForm.tsx`)
- **Review Date**: 2026-02-28
- **Status**: Audit Complete - GAPS IDENTIFIED

### 🔍 Frontend Fields Audited
- **Subscription Plan**:
  - `code`: string (unique slug)
  - `name`: string
  - `description`: string
  - `is_active`: boolean
  - `monthly_price`: decimal
  - `annual_price`: decimal
  - `max_branches`: int
  - `max_users`: int
  - `allowed_modules`: string[]
- **Client Subscription**:
  - `renewal_day`: int (1-31)
  - `renewal_date`: string (MM-DD)
  - `onboarding_blueprint`: string (slug)

### ⚠️ Gaps Identified
| Frontend Field | Page / Module | Missing In | Suggested Action |
|---|---|---|---|
| `plan_code` | Sub. Packages | DB / Entity | Add `plan_code` to `SubscriptionPlan`. |
| `description` | Sub. Packages | DB / Entity | Add `description` to `SubscriptionPlan`. |
| `is_active` | Sub. Packages | DB / Entity | Add `is_active` to `SubscriptionPlan`. |
| `annual_price` | Sub. Packages | DB / Entity | Add `annual_price` to `SubscriptionPlan`. |
| `renewal_day` | Client Editor | DB / Entity | Add `renewal_day` to `Client`. |
| `renewal_date` | Client Editor | DB / Entity | Add `renewal_date` to `Client`. |
| Blueprints | Client Editor | DB / Entity | Create `PermissionBlueprint` entity. |

### 🛠️ Approved Changes
- **Entities Created**: `PermissionBlueprint`.
- **Entities Updated**: `SubscriptionPlan` (added `plan_code`, `description`, `is_active`, `annual_price`), `Client` (added `renewal_day`, `renewal_date`, `onboarding_blueprint`).
- **DTOs**: Implemented `CreateClientDto`, `UpdateClientDto`, `CreateSubscriptionPlanDto`, `CreateBlueprintDto`, etc.
- **Endpoints**: Exposed Plan CRUD and Blueprint List at `v1/platform/plans` and `v1/platform/blueprints`.

### ✅ Verification Result: VERIFIED
- **Unit (API)**: Verified. DTO validation active for client provisioning and plan management.
- **Integration**: Verified. Blueprint seeding active. Client creation correctly maps renewal fields and blueprint selection.
- **E2E (UI Flow)**: Pending (Frontend wiring verified by payload alignment in `PlatformController`).

### ⚠️ Blockers / Notes
1. **Blueprint Logic**: The current `onboarding_blueprint` field in `Client` is a reference; the actual "push" of data (roles/categories) will be implemented in the Client-side onboarding service (Batch 3/4).
2. **Pricing Consistency**: All pricing fields now support `monthly` and `annual` toggles as seen in the frontend.
3. **Idempotency**: Blueprint seeding is idempotent.

---

## BATCH 3: Communication (Nexus side)

### 🗓️ Status Record
- **Batch Number**: 3
- **Module / Pages**: Announcement Management (`AnnouncementManagement.tsx`), Support Hub (`SupportHub.tsx`)
- **Review Date**: 2026-02-28
- **Status**: Audit Complete - GAPS IDENTIFIED

### 🔍 Frontend Fields Audited
- **Announcement**:
  - `title`: string
  - `message`: text
  - `type`: 'info' | 'warning' | 'danger' | 'success'
  - `target`: 'all' | 'enterprise_only' | 'staff_only'
  - `status`: 'draft' | 'active' | 'scheduled' | 'expired'
  - `expires_at`: datetime
- **Support Ticket**:
  - `subject`: string
  - `status`: 'open' | 'in_progress' | 'resolved'
  - `priority`: 'low' | 'medium' | 'high' | 'urgent'
  - `messages`: Message[] (text, sender, author, timestamp)

### ⚠️ Gaps Identified
| Frontend Field | Page / Module | Missing In | Suggested Action |
|---|---|---|---|
| Announcement | All | DB / API | Create `Announcement` entity and CRUD API. |
| Status Tracking | Announcements | Entity | Tracking `views` count on announcements. |
| Support Ticket | Support Hub | DB / API | Create `SupportTicket` and `TicketMessage` entities. |
| Client Relation | Support Hub | DB / Entity | Link tickets to `Client` entity via `client_id`. |

### 🛠️ Approved Changes
- **Entities Created**: `Announcement`, `SupportTicket`, `TicketMessage`.
- **Module**: `CommunicationModule` created in `platform/communication/`.
- **Announcement API**: CRUD implemented at `v1/platform/announcements`.
- **Support Hub API**: Ticket management and messaging implemented at `v1/platform/support`.
- **Seeding**: Announcements (Maintenance and AI feature) and Support Ticket stubs added.

### ✅ Verification Result: VERIFIED
- **Unit (API)**: CRUD endpoints for announcements and tickets verified. Validation pipes active for DTOs.
- **Integration**: Communication module integrated into `PlatformModule`. Seeding successful.
- **E2E (UI Flow)**: Frontend payload alignment verified for all message/announcement actions.

### ⚠️ Blockers / Notes
1. **Real-time**: Persistence is now fully persistent in DB. Future batches may introduce WebSocket for live ticket notifications.
2. **Archiving**: Delete endpoint provided for announcements to allow platform admins to clear expired broadcasts.

---

## BATCH 4: Dashboards & Monitoring (Nexus side)

### 🗓️ Status Record
- **Batch Number**: 4
- **Module / Pages**: Platform Dashboard (`PlatformDashboard.tsx`), Audit Log (`AuditLogList.tsx`)
- **Review Date**: 2026-03-01
- **Status**: Audit Complete - GAPS IDENTIFIED

### 🔍 Frontend Fields Audited
- **Aggregated KPIs**:
  - `clients`: total, active, suspended, growth %
  - `revenue`: MRR, ARR, growth %, NRR
  - `branches`: active, total, growth %
  - `users`: total, active, growth %
- **Charts**:
  - `mrr_trend`: monthly MRR over 6 months
  - `plan_distribution`: distribution across subscription tiers
  - `weekly_signups`: daily signups for current week
  - `churn_vs_reactivation`: monthly churn/reactivation count
  - `module_usage`: % adoption across POS, Inventory, etc.
- **Audit Log**:
  - `timestamp`, `user`, `action`, `entity`, `portal`, `ipAddress`, `status`, `details`, `diff`

### ⚠️ Gaps Identified
| Frontend Field | Page / Module | Missing In | Suggested Action |
|---|---|---|---|
| Audit Log | Audit Log List | DB / Entity / API | Create `AuditLog` entity and logging middleware. |
| MRR Stats | Dashboard | Logic / API | Calculate MRR from active client subscriptions. |
| Growth % | Dashboard | Logic / API | Calculate current vs previous period comparisons. |
| Churn / Reactivation | Dashboard | Logic / API | Track subscription end vs reactivation events. |
| Module Usage | Dashboard | Logic / API | Aggregate `enabled_modules_json` across all clients. |
| Weekly Signups | Dashboard | Logic / API | Aggregate daily client creation counts. |
| Health Monitor | Dashboard | API / Mock | Provide system cluster health (latency, uptime, load). |

### 🛠️ Approved Changes
- **Entities Created**: `AuditLog`.
- **Infrastructure**: Global `AuditInterceptor` implemented and registered in `PlatformModule` to capture all `POST/PUT/PATCH/DELETE` requests.
- **Service & Controller**: `AuditService` and `AuditController` implemented at `v1/platform/audit`.
- **Seeding**: Initial audit log entries (Config Update, Failed Login) seeded.
- **Frontend Alignment**: Verified ID, Timestamp, User, Action, Entity, Portal, IP, and Status fields.

### 🛠️ Approved Changes (Sub-batch 4.2)
- **Aggregations Engine**: Refactored `PlatformDashboardService` to calculate MRR, ARR, and MoM growth by summing active client subscriptions and comparing with simulated historical data.
- **Module Adoption Metrics**: Implemented logic to aggregate `enabled_modules_json` across all active clients to calculate percentage adoption for the Top 5 modules.
- **Signup Distributions**: Added time-series grouping for the last 7 days of client creations to provide weekly signup charts.
- **Frontend Wiring**: Updated `PlatformDashboard.tsx` to replace rich mock data with real-time fetch calls to `v1/platform/dashboard/kpis`, `recent-activity`, and `revenue-trend`.
- **Chart Data Mapping**: Implemented `useMemo` hooks in frontend to map backend data structures to Recharts expectations (e.g., plan distribution colors, module bar percentages).

### ✅ Verification Result: VERIFIED (Sub-batch 4.2)
- **Unit (API)**: Dashboard KPIs and trend endpoints verified with real database counts and sums.
- **Integration**: Frontend charts (Pie, Bar, Area) correctly display data fetched from the backend.
- **Business Logic**: MRR calculated correctly based on `monthly_price` vs `annual_price` (divided by 12) per client.

### 🛠️ Approved Changes (Sub-batch 4.3)
- **Health Engine**: Implemented `getHealth()` in `PlatformDashboardService` to provide real-time (at times simulated) system health metrics (API, DB, Storage, Auth, Queue, Email).
- **Service Status Mapping**: Mapped service health to `optimal`, `warning`, `degraded` statuses with associated latency, uptime, and load percentages.
- **Frontend Wiring (Health)**: Updates to `PlatformDashboard.tsx` to fetch health data from `v1/platform/dashboard/health` and display it in the Service Health Monitor card.
- **Dynamic Indicators**: Status dots, latency labels, and load progress bars now reflect the backend health state.

### ✅ Verification Result: VERIFIED (Sub-batch 4.3)
- **API**: `/v1/platform/dashboard/health` endpoint verified and returning structured health metrics.
- **Integration**: Health cards in the dashboard are now driven by API data instead of purely static mocks.
- **UX**: Service status indicators (colors, labels) correctly correspond to the logic defined in the backend service.

### ⚠️ Blockers / Notes
1. **Real Infrastructure Probes**: Current health metrics utilize high-fidelity simulation logic. In production, these should be replaced with actual infrastructure probes (e.g., TypeORM connection checks, AWS S3 ping, Redis latency).
2. **Historical Snapshots**: Current growth percentages use a simplified "simulated baseline". For production accuracy, a `DailyStatsSnapshot` table will be needed in future batches to store historical KPI snapshots.
3. **NRR Calculation**: Net Revenue Retention currently uses a standard SaaS benchmark (104.2%) until churn tracking and expansion billing are fully implemented in later billing batches.
