# KitchenOS — Nexus (Platform) Global Gap Discovery

This document records all gaps identified during the read-only discovery phase. The frontend is treated as the single source of truth.

## 📊 Summary of Phase
- **Scope**: All Nexus (Platform) frontend modules in `pages/platform/`.
- **Method**: Structural comparison between React `.tsx` components and NestJS/TypeORM entities/controllers.
- **Goal**: Identify missing DB columns, missing API endpoints, and hardcoded logic.

---

## 🔍 Module 1: Clients & Subscriptions

### Page: Client Management / Editor (`ClientManagement.tsx`, `ClientEditor.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Blueprints (fine_dining, etc.) | API / DB | New `permission_blueprints` table | Frontend has hardcoded JSON for pre-loading roles/categories. |
| Renewal Day / Date | DB | Add `renewal_day` (int), `renewal_date` (date) to `clients` | Not found in `Client` entity. |
| Package/Plan (Annual Price) | DB | Add `annual_price` to `subscription_plans` | Entity only has `monthly_price`. |
| Package/Plan (Code/Slug) | DB | Add `plan_code` (unique) to `subscription_plans` | Frontend uses code like `PKG-BASIC`. |
| Package/Plan (Status) | DB | Add `is_active` (boolean) to `subscription_plans` | Missing status indicator. |

### Page: Subscription Packages (`SubscriptionGroupList.tsx`, `SubscriptionGroupForm.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Package Description | DB | Add `description` to `subscription_plans` | Entity has name and modules, but no text description. |

### Page: Invoice Management (`InvoiceManagement.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Invoice Currency | DB | Add `currency` (length 10) to `subscription_orders` | Currently relies on Client's default currency. |
| Due Date | DB | Add `due_date` (datetime) to `subscription_orders` | Frontend expects a due date for pending invoices. |
| Billing Cycle | DB | Add `billing_cycle` (enum: monthly/annual) | Needed to distinguish invoice types clearly. |

---

## 🛡️ Module 2: System Users & Security

### Page: System User Management (`SystemUserList.tsx`, `SystemUserForm.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| User Number | DB | Add `user_number` (unique string) to `system_users` | Frontend displays unique sequential IDs like `10001`. |
| Department | DB | Add `department` (varchar) to `system_users` | Frontend uses this for filtering/display. |
| Designation | DB | Add `designation` (varchar) to `system_users` | Frontend uses this for filtering/display. |
| Internal Notes | DB | Add `internal_notes` (text) to `system_users` | Notes about the user. |
| Avatar Color / Profile Pix | DB | Add `avatar_color`, `profile_picture` | UI uses these for branding/identity. |

### Page: Security - Permission Registry (`PermissionRegistry.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Module Registry Entity | API / DB | New `permission_modules` table | Currently entirely hardcoded in frontend. |
| Page Registry Entity | API / DB | New `permission_pages` table | Link between modules and specific page actions. |
| Group Description | DB | Add `description` to `system_groups` | Entity is missing a descriptor. |
| Group Type | DB | Add `type` (standard/minimal/executive) | Used for template categorization. |

---

## 🛠️ Module 3: Platform Settings & Maintenance

### Page: Organization Settings (`OrganizationSettings.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Platform Branding (Logo) | DB | Add `logo_url`, `favicon_url` to `platform_settings` | Essential for white-labeling. |

### Page: Announcement Management (`AnnouncementManagement.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Announcement Entity | API / DB | New `system_announcements` table | Entirely hardcoded. Needs CRUD API. |

### Page: Support Hub / Ticketing (`SupportHub.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Support Ticket Entity | API / DB | New `support_tickets` table | Entirely hardcoded. Needs CRUD + Messages. |

### Page: Usage Radar (`UsageRadar.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Metrics / Utilization | API | N/A (Calculated) | Requires a complex aggregation API to compute used vs limit. |

### Page: Platform Dashboard (`PlatformDashboard.tsx`)
| Frontend Field | Missing In | Suggested DB Change | Notes |
|---|---|---|---|
| Platform Health Metrics | API | N/A (Live monitoring) | Latency, Uptime, Load stats are currently static mocks. |
| Signups / Churn Charts | API | N/A (Aggregation) | Requires logic to aggregate historical data into time-series. |
| MRR Distribution | API | N/A (Aggregation) | Distribution by plan type. |

---

## 🎨 Module 4: Themes
*Alignment Status: HIGH*
- The `Theme` entity and token system are well-aligned.
- Only minor tweaks might be needed for specific new tokens if added to CSS.

---

## 📅 Proposed Batch Fix Plan

### Batch 1: Security & Core Infrastructure
- Fix `PermissionRegistry` gaps (Modules, Pages, Groups).
- Fix `SystemUser` gaps (User Numbers, Departments).
- **Reason**: Security and RBAC are the foundation of the system.

### Batch 2: Clients & Billing
- Fix `Client` and `SubscriptionPlan` gaps.
- Align `SubscriptionOrder` with `InvoiceManagement`.
- **Reason**: Necessary for tenant onboarding and monetization logic.

### Batch 3: Communication & Support
- Fix `AnnouncementManagement` gaps.
- Fix `SupportHub` gaps.
- **Reason**: External-facing maintenance and communication tools.

### Batch 4: Maintenance & Analytics (COMPLETED)
- Fix `OrganizationSettings` gaps.
- Wire up `UsageRadar` and `AuditLog` APIs.
- Refactored `PlatformDashboard` with advanced aggregations (MRR, Growth, etc.).
- Implemented real-time Health Monitoring API and wired to frontend.
- **Reason**: Final polish and system-wide visibility.

---

## ⚠️ Dependency & Risk Notes
- **RBAC Migration**: Modifying `SystemUser` and `PermissionRegistry` will directly impact the `JwtStrategy` and global auth guards.
- **Data Migration**: Existing mock data for modules/pages must be seeded into the DB to avoid breaking the UI.
- **Tenant Isolation**: Care must be taken to ensure "Blueprints" remain at the Platform (Nexus) level but can be "pushed" to new Clients.
