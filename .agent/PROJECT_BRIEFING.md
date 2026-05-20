# KitchenOS — AI Agent Project Briefing
> Read this file FIRST in every conversation. It replaces 10+ exploratory tool calls.
> Last updated: 2026-02-22

---

## 🏢 Project Identity
- **Product**: KitchenOS — Multi-tenant, offline-capable ERP + POS SaaS for the food services industry
- **Repo root**: `d:\Antigravity\KitchenOS\`
- **Stage**: Active development (not yet production)
- **Architecture**: Monorepo with 4 sub-projects

---

## 📁 Monorepo Structure

```
KitchenOS/
├── backend/          NestJS + TypeORM + PostgreSQL REST API
├── frontend/         Vite + React 19 + TypeScript — Web Dashboard (Admin/Client)
├── pos/              Vite + React + Electron — Offline-capable POS desktop app
├── pos-app/          (Secondary POS experiment / staging)
└── docs/             Architecture Decision Records (ADRs) and system docs
```

---

## 🔧 Tech Stack

### Backend (`/backend`)
- **Framework**: NestJS (with global JWT guard via `APP_GUARD`)
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Auth**: JWT (passport-jwt), `JwtStrategy` → attaches `userId, email, clientId, branchId, role` to `req.user`
- **Module list** (all in `src/`):
  - `platform` — SaaS platform layer (clients, subscriptions, users, themes, roles, groups)
    - `security/registry` — Atomic permission registry
    - `security/sys-groups` — Reusable security clusters (Nexus & Client Templates)
  - `auth` — login/register/JWT
  - `setup` — branches, settings
  - `catalog` — products, categories (multi-level hierarchy with master-data inheritance)
  - `inventory` — raw materials, stock management
  - `inventory-op` — stock operations (receive, adjust, ledger)
  - `vendor` — supplier management
  - `recipe` — recipes linked to products
  - `pos` — POS transactions, orders, shifts
  - `production` — production orders
  - `accounting` — financial entries
  - `customers` — CRM
  - `deals` — vouchers / marketing
  - `ai` — AI/ML features
  - `analytics` — reporting

### Frontend (`/frontend`)
- **Framework**: Vite 7 + React 19 + TypeScript
- **Routing**: react-router-dom v7
- **Charts**: Recharts
- **Icons**: lucide-react
- **Styling**: Vanilla CSS with CSS variables (design token system in `index.css`)
- **Design system**: Deep Space Dark theme — glassmorphism, indigo/purple/cyan palette
- **Key CSS vars**: `--bg-deep`, `--accent-primary` (#6366f1 indigo), `--accent-secondary` (#a855f7 purple), `--accent-tertiary` (#06b6d4 cyan)
- **Fonts**: Inter (body), Outfit (headings)
- **State**: No global state manager (hooks + localStorage)
- **Auth storage**: `localStorage` — keys: `access_token`, `user_type`, `client_id`, `branch_id`
- **Page count**: 91+ pages across 16 modules
- **Components** (`src/components/`):
  - `ui/` — KitchenTable, KitchenInput, KitchenButton (10 UI components)
  - `auth/` — AuthGuard
  - `inventory/` — inventory-specific components

### POS App (`/pos`)
- **Stack**: Vite + React + Electron (+ SQLite via `better-sqlite3`)
- **Offline DB**: `pos_offline.db` (SQLite)
- **Key files**: `main.cjs` (Electron main), `preload.cjs` (IPC bridge), `db.cjs` (SQLite ops)

---

## 🎨 Design System Summary
- **Theme**: "KitchenOS Default-1 (Deep Space Dark)" — LOCKED preset
- **Base colors**: `#020205` deep, `#08090f` primary, `#0f111a` secondary, `#161927` tertiary
- **Glass system**: `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-blur)` (blur 24px)
- **Radii**: sm=8px, md=14px, lg=24px, xl=32px
- **Transitions**: fast=0.1s, smooth=0.3s, bounce=0.5s (all cubic-bezier)
- **Animations**: `float` (ambient lights), `fadeIn`, `slideInRight`, `hover-lift`, `hover-glow`
- **Theme system**: Stored in DB, applied via `ThemeProvider` + CSS variable injection

---

## 🔐 Auth & Multi-tenancy
- **JWT payload fields**: `sub` (userId), `email`, `client_id`, `branch_id`, `role`
- **Portal Access Map**:
  | Portal | Role | Entry Path | TSX Entry Point |
  |---|---|---|---|
  | **Nexus** (System) | Platform Owner | `/nexus` | `pages/platform/PlatformDashboard.tsx` |
  | **Console** (Ops) | HQ & Branch Staff | `/console` | `pages/GlobalDashboard.tsx` |
  | **Terminal** (POS) | Operations | `/terminal` | `pages/pos/PosTerminal.tsx` |
  | **Menu** (Customer) | End Guest | `/menu` | `pages/customers/CustomerList.tsx` |
- **Platform layer**: System admins manage Clients (tenants). Each client has Branches, Users, Roles.
- **Subscription plans** entity: `plan_name`, `max_branches`, `max_users`, `allowed_modules[]`, `monthly_price`

---

## 🧭 Navigation Architecture (Console Portal)

The `/console` left nav has **two strictly separated levels**, toggled via a rights-based pill:

| Level | Shown When | Badge Color | Banner |
|---|---|---|---|
| **Client Admin** | `navMode === 'admin'` + has admin rights | Purple | `👑 Client Admin Level` |
| **Branch** | `navMode === 'branch'` + has branch rights | Cyan | `🏪 Branch Level` |

### Access Rules (current — `user_type` based)
| `user_type` | Admin Access | Branch Access | Toggle Pill |
|---|---|---|---|
| `client` | ✅ | ✅ | ✅ Yes (defaults to Admin) |
| `staff` / `branch` | ❌ | ✅ | ❌ No |
| `system` | Nexus only | ❌ | ❌ No |

### localStorage Keys
- `user_type` — determines portal level (`system` / `client` / `staff` / `branch`)
- `nav_view_mode` — persists toggle state: `'admin'` | `'branch'`

### Client Admin Level Sections
Product & Menu Master → Inventory Master Data → User Management → Branch Management → Global Configuration

### Branch Level Sections
Daily Operations (POS/KDS/Shift/Sales) → Product Assignment & Pricing → Inventory Operations → Floor & Seating → Branch Users

### ⚠️ TODO — RBAC Migration
Currently using `user_type` to gate toggle access. When RBAC module is complete, replace with:
```ts
const hasAdminAccess = permissions.includes('admin.access');
const hasBranchAccess = permissions.includes('branch.access');
```
Located in: `frontend/src/layouts/AppLayout.tsx` — marked with `// TODO` comment.

---

## 📐 Key Architectural Decisions (ADRs)
| ADR | Decision |
|-----|----------|
| ADR-01 | Naming conventions (snake_case DB, camelCase TS) |
| ADR-02 | Frontend design system (CSS variables, no Tailwind) |
| ADR-03 | Master data inheritance (catalog items inherit from parent categories) |
| ADR-04 | Inventory hierarchy (raw materials → recipes → products → production) |
| ADR-05 | Unified RBAC & Multi-Branch logic: auto-create Main Branch, use `user_branch_roles` "contract" model |

---

## 🛑 Known Constraints / Active Rules
- No Tailwind CSS — vanilla CSS only
- No global state manager — hooks + localStorage
- All backend routes are JWT-guarded globally (use `@Public()` decorator to bypass)
- TypeORM entities use decorators; DB is PostgreSQL
- POS must work offline — SQLite for local, sync to server when online

---

## 🗂️ How to Navigate This Codebase Quickly
- Backend module pattern: `src/{module}/{module}.module.ts|service.ts|controller.ts|entities/`
- Frontend page pattern: `src/pages/{module}/{PageName}.tsx` + optional `.module.css`
- API calls from frontend: `src/api/` (currently minimal — mostly inline `fetch`)
- Providers: `src/providers/ThemeProvider.tsx`
- Layouts: `src/layouts/AppLayout.tsx`

---

## 🗺️ Plain-English Page Name → File Map
> Use this when the user says a page name without the file path.
> Never use list_dir or find_by_name to locate pages — use this table.

| What User Says | TSX File | CSS File |
|---|---|---|
| **Main Dashboard / Home Dashboard** | `pages/GlobalDashboard.tsx` | `pages/GlobalDashboard.module.css` |
| **Platform Dashboard / System Dashboard** | `pages/platform/PlatformDashboard.tsx` | — |
| **POS / POS Screen / POS Terminal / Cash Register** | `pages/pos/PosTerminal.tsx` | — |
| **Order Taker POS / Waiter POS** | `pages/pos/OrderTakerPos.tsx` | `pages/pos/OrderTakerPos.module.css` |
| **Kitchen Display / KDS** | `pages/pos/KitchenDisplay.tsx` | — |
| **Shift Register / Open Shift / Close Shift** | `pages/pos/ShiftRegister.tsx` | `pages/pos/ShiftRegister.module.css` |
| **Branch Day Management / Open Day / Close Day** | `pages/pos/BranchDayManagement.tsx` | `pages/pos/BranchDayManagement.module.css` |
| **Till Management / Cash Register / Blind Close** | `pages/pos/TillManagement.tsx` | `pages/pos/TillManagement.module.css` |
| **Sales Report / Sales Dashboard** | `pages/pos/PosSalesDashboard.tsx` | — |
| **Products / Product List / Menu Items** | `pages/products/ProductList.tsx` | — |
| **Product Form / Add Product / Edit Product** | `pages/products/ProductForm.tsx` | — |
| **Menu Pricing / Branch Pricing / Availability** | `pages/products/BranchPricing.tsx` | `pages/products/BranchPricing.tsx.module.css` |
| **Inventory Dashboard / Stock Dashboard** | `pages/inventory/InventoryDashboard.tsx` | `pages/inventory/InventoryDashboard.module.css` |
| **GRN List / Goods Received Notes** | `pages/inventory/GRNList.tsx` | `pages/inventory/GRNList.module.css` |
| **GRN Form / Receive Stock / New GRN** | `pages/inventory/GRNForm.tsx` | `pages/inventory/GRNForm.module.css` |
| **Issue to Kitchen / Stock Issuance** | `pages/inventory/StockIssuance.tsx` | `pages/inventory/StockIssuance.module.css` |
| **Transfer Stock / Stock Transfer** | `pages/inventory/StockTransfer.tsx` | `pages/inventory/StockTransfer.module.css` |
| **Disposal List / Disposal Management** | `pages/inventory/WastageEntry.tsx` | `pages/inventory/WastageEntry.module.css` |
| **Disposal Entry / New Disposal / Wastage Entry Form** | `pages/inventory/DisposalEntry.tsx` | `pages/inventory/DisposalEntry.module.css` |
| **Disposal Approval / Approval Queue** | `pages/inventory/DisposalApproval.tsx` | `pages/inventory/DisposalApproval.module.css` |
| **Stock Balance / Stock Levels** | `pages/inventory/StockBalance.tsx` | `pages/inventory/StockBalance.module.css` |
| **Stock Count / Physical Count** | `pages/inventory/StockCount.tsx` | `pages/inventory/StockCount.module.css` |
| **Demand Planning / Reorder List** | `pages/inventory/DemandPlanning.tsx` | `pages/inventory/DemandPlanning.module.css` |
| **Vendors / Supplier List / Vendor Management** | `pages/inventory/VendorList.tsx` | `pages/inventory/VendorList.module.css` |
| **Vendor Form / Add Vendor / Edit Vendor** | `pages/inventory/VendorForm.tsx` | `pages/inventory/VendorForm.module.css` |
| **Vendor Payments / Payment Ledger** | `pages/inventory/VendorPayments.tsx` | `pages/inventory/VendorPayments.module.css` |
| **Vendor Payment Approvals / Payout Approvals** | `pages/inventory/VendorPaymentApprovals.tsx` | `pages/inventory/VendorPaymentApprovals.module.css` |
| **Vendor Payment Voucher / Batch Payment Voucher** | `pages/inventory/VendorPaymentVoucher.tsx` | `pages/inventory/VendorPaymentVoucher.module.css` |
| **Vendor Dashboard / Vendor Analytics** | `pages/inventory/VendorDashboard.tsx` | `pages/inventory/VendorDashboard.module.css` |
| **Purchase Orders / PO List** | `pages/inventory/PurchaseOrderList.tsx` | — |
| **Purchase Order Form / Create PO** | `pages/inventory/PurchaseOrderForm.tsx` | — |
| **Recipes / Recipe List** | `pages/inventory/RecipeList.tsx` | — |
| **Branch Item Activation / Branch Inventory Setup** | `pages/inventory/setup/BranchItemSetup.tsx` | `pages/inventory/setup/BranchItemSetup.module.css` |
| **Item Approvals / Master Entry Approvals** | `pages/inventory/setup/ItemApprovalQueue.tsx` | `pages/inventory/setup/ItemApprovalQueue.module.css` |
| **Stock Ledger / Stock History** | `pages/inventory/StockLedgerList.tsx` | — |
| **Receive Stock / Stock Receive** | `pages/inventory/StockReceiveForm.tsx` | — |
| **Stock Adjustment / Adjust Stock** | `pages/inventory/StockAdjustForm.tsx` | — |
| **Production Orders / Production List** | `pages/production/ProductionOrderList.tsx` | — |
| **Production Order Form / Create Production** | `pages/production/ProductionOrderForm.tsx` | — |
| **Branches / Branch List / Branch Management** | `pages/setup/BranchList.tsx` | — |
| **Branch Form / Add Branch / Edit Branch** | `pages/setup/BranchForm.tsx` | — |
| **Sale Counters / Tills / POS Terminals** | `pages/setup/SaleCounters.tsx` | `pages/setup/SaleCounters.module.css` |
| **Table Layout / Floor Plan / Table Management** | `pages/floor-management/TableLayout.tsx` | `pages/floor-management/FloorsTables.module.css` |
| **Floors Management** | `pages/floor-management/FloorsList.tsx` | `pages/floor-management/FloorsTables.module.css` |
| **Tables Management** | `pages/floor-management/TablesList.tsx` | `pages/floor-management/FloorsTables.module.css` |
| **Table QR Codes** | `pages/floor-management/QRManagement.tsx` | `pages/floor-management/FloorsTables.module.css` |
| **Table Assignment** | `pages/floor-management/TableAssignment.tsx` | `pages/floor-management/FloorsTables.module.css` |
| **Staff Form / Add Staff / Edit Employee** | `pages/hr/StaffForm.tsx` | `pages/hr/StaffForm.module.css` |
| **Attendance / Staff Attendance** | `pages/hr/Attendance.tsx` | `pages/hr/Attendance.module.css` |
| **Designations / Designation Management** | `pages/hr/Designations.tsx` | `pages/hr/DesignationManagement.module.css` |
| **Designation Form / Add Designation** | `pages/hr/DesignationForm.tsx` | `pages/hr/DesignationManagement.module.css` |
| **Accounting / Finance Dashboard** | `pages/accounting/AccountingDashboard.tsx` | `pages/accounting/AccountingDashboard.module.css` |
| **Chart of Accounts** | `pages/accounting/ChartOfAccounts.tsx` | `pages/accounting/ChartOfAccounts.module.css` |
| **Journal Entries / Manual Journals** | `pages/accounting/JournalEntries.tsx` | `pages/accounting/JournalEntries.module.css` |
| **General Ledger / GL** | `pages/accounting/GeneralLedger.tsx` | `pages/accounting/GeneralLedger.module.css` |
| **Banks Management / Bank Accounts** | `pages/finance/BankManagement.tsx` | `pages/finance/BankManagement.module.css` |
| **Bank Reconciliation / Reconciliation** | `pages/finance/BankReconciliation.tsx` | `pages/finance/BankReconciliation.module.css` |
| **Investor Management / Investors** | `pages/accounting/InvestorManagement.tsx` | `pages/accounting/InvestorManagement.module.css` |
| **Investment Records** | `pages/accounting/InvestmentRecords.tsx` | `pages/accounting/InvestmentRecords.module.css` |
| **Profit Distribution / Payouts** | `pages/accounting/ProfitDistribution.tsx` | `pages/accounting/ProfitDistribution.module.css` |
| **Loan Management / Loans** | `pages/accounting/LoanManagement.tsx` | `pages/accounting/LoanManagement.module.css` |
| **Loan Repayments / Repayments** | `pages/accounting/LoanRepayments.tsx` | `pages/accounting/LoanRepayments.module.css` |
| **Tax Configuration / Accounting Taxes** | `pages/accounting/TaxConfiguration.tsx` | `pages/accounting/TaxConfiguration.module.css` |
| **Financial Reports / P&L / Balance Sheet** | `pages/accounting/FinancialReports.tsx` | `pages/accounting/FinancialReports.module.css` |
| **Accounting Settings** | `pages/accounting/AccountingSettings.tsx` | `pages/accounting/AccountingSettings.module.css` |
| **Customers / Customer List / CRM** | `pages/customers/CustomerList.tsx` | — |
| **Vouchers / Deals / Marketing / Promotions** | `pages/deals/VoucherList.tsx` | — |
| **AI Forecaster / Sales Forecast** | `pages/analytics/AiSalesForecaster.tsx` | — |
| **Waste Analytics / Waste Report** | `pages/analytics/WasteAnalytics.tsx` | — |
| **Clients / Client List / Tenant Management** | `pages/platform/ClientManagement.tsx` | `pages/platform/ClientManagement.module.css` |
| **Client Detail / View Client** | `pages/platform/ClientDetail.tsx` | `pages/platform/ClientManagement.module.css` |
| **Client Form / Add Client / Edit Client** | `pages/platform/ClientEditor.tsx` | `pages/platform/ClientManagement.module.css` |
| **System Users / User Management** | `pages/platform/SystemUserList.tsx` | — |
| **User Detail / User Profile (admin)** | `pages/platform/SystemUserDetail.tsx` | — |
| **Departments / Department Management** | `pages/setup/Departments.tsx` | `pages/setup/DepartmentManagement.module.css` |
| **Branch Locations / Storage Locations** | `pages/setup/BranchLocations.tsx` | `pages/setup/BranchLocations.module.css` |
| **System Roles / Role Management (platform)** | `pages/platform/SystemRoleManagement.tsx` | — |
| **System Groups / Group Management** | `pages/platform/SystemGroupManagement.tsx` | — |
| **Organization Settings / Platform Settings** | `pages/platform/OrganizationSettings.tsx` | — |
| **Themes / Theme Library / Theme Management** | `pages/platform/ThemeList.tsx` | — |
| **Theme Form / Create Theme / Edit Theme** | `pages/platform/ThemeForm.tsx` | — |
| **Subscription Packages / Package Groups** | `pages/platform/SubscriptionGroupList.tsx` | `pages/platform/SubscriptionGroup.module.css` |
| **Subscription Package Form / New Package / Edit Package** | `pages/platform/SubscriptionGroupForm.tsx` | `pages/platform/SubscriptionGroup.module.css` |
| **Catalog Architecture / Menu Architecture** | `pages/admin/CatalogArchitecture.tsx` | — |
| **Categories / Category Management** | `pages/admin/CategoryManagement.tsx` | — |
| **Roles / Role Management (tenant)** | `pages/admin/RoleManagement.tsx` | `pages/admin/RoleManagement.module.css` |
| **Security Management (Unified)** | `pages/platform/security/AccessControl/AccessControl.tsx` | `pages/platform/security/AccessControl/AccessControl.module.css` |
| **Security Permissions (platform)** | `pages/platform/security/PermissionManagement.tsx` | `pages/platform/security/Security.module.css` |
| **Security Registry (platform)** | `pages/platform/security/Registry/PermissionRegistry.tsx` | `pages/platform/security/Registry/PermissionRegistry.module.css` |
| **Security Groups (platform)** | `pages/platform/security/GroupManagement.tsx` | `pages/platform/security/Security.module.css` |
| **User Access (platform)** | `pages/platform/security/UserAccessManagement.tsx` | `pages/platform/security/Security.module.css` |
| **Distribution Center** | `pages/admin/DistributionCenter.tsx` | — |
| **Tax Configuration / Tax Settings** | `pages/admin/TaxConfiguration.tsx` | — |
| **Login Page** | `pages/auth/LoginPage.tsx` | — |
| **Admin Login** | `pages/auth/AdminLoginPage.tsx` | — |
| **Client Login** | `pages/auth/ClientLoginPage.tsx` | — |
| **Client Portal Dashboard** | `pages/client-portal/ClientPortalDashboard.tsx` | `pages/client-portal/ClientPortal.module.css` |
| **Branch Management (Client)** | `pages/client-portal/BranchManagement.tsx` | `pages/client-portal/BranchManagement.module.css` |
| **User Management (Client)** | `pages/client-portal/UserRegistry.tsx` | `pages/client-portal/UserRegistry.module.css` |
| **User Editor (Client)** | `pages/client-portal/UserEditor.tsx` | `pages/client-portal/UserEditor.module.css` |
| **Master Setup (Client)** | `pages/client-portal/MasterSetup.tsx` | `pages/client-portal/MasterSetup.module.css` |
| **Security Permissions (client)** | `pages/client-portal/security/PermissionManagement.tsx` | `pages/client-portal/security/Security.module.css` |
| **Security Groups (client)** | `pages/client-portal/security/GroupManagement.tsx` | `pages/client-portal/security/Security.module.css` |
| **User Access (client)** | `pages/client-portal/security/UserAccessManagement.tsx` | `pages/client-portal/security/Security.module.css` |
| **Menu Categories** | `pages/menu-management/MenuCategories.tsx` | `pages/menu-management/MenuMasterPage.module.css` |
| **Menu Types** | `pages/menu-management/MenuTypes.tsx` | `pages/menu-management/MenuMasterPage.module.css` |
| **Cuisine Types** | `pages/menu-management/CuisineTypes.tsx` | `pages/menu-management/MenuMasterPage.module.css` |
| **Prep Stations** | `pages/menu-management/PrepStations.tsx` | `pages/menu-management/PrepStations.module.css` |
| **Order Types** | `pages/menu-management/OrderTypes.tsx` | `pages/menu-management/MenuMasterPage.module.css` |
| **Menu Availability Manager** | `pages/menu-management/MenuAvailabilityManager.tsx` | `pages/menu-management/MenuAvailabilityManager.module.css` |
| **System Audit Log** | `pages/platform/AuditLogList.tsx` | `pages/platform/AuditLogList.module.css` |
| **Operation Logs / Audit Log** | `pages/client-portal/AuditLogList.tsx` | `pages/client-portal/AuditLogList.module.css` |
| **Subscription Details** | `pages/client-portal/SubscriptionDetails.tsx` | `pages/client-portal/SubscriptionDetails.module.css` |
| **Client Invoices / Platform Invoices** | `pages/platform/InvoiceManagement.tsx` | `pages/platform/InvoiceManagement.module.css` |
| **Business Intelligence / Multi-Branch Analytics** | `pages/analytics/MultiBranchAnalytics.tsx` | `pages/analytics/MultiBranchAnalytics.module.css` |
| **Global Broadcasts / Announcements Management** | `pages/platform/AnnouncementManagement.tsx` | `pages/platform/AnnouncementManagement.module.css` |
| **Usage & Upsell Radar / Capacity Management** | `pages/platform/UsageRadar.tsx` | `pages/platform/UsageRadar.module.css` |
| **Nexus Support Hub / Ticketing** | `pages/platform/SupportHub.tsx` | `pages/platform/SupportHub.module.css` |
