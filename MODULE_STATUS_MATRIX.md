# Module Status Matrix

| Module | UI Status | Backend Status | Database Status | Wiring Status | Functional Completeness | Major Issues | Priority |
|---|---|---|---|---|---|---|---|
| Platform Governance (Nexus) | Strong | Partial | Partial | Partial | Medium-Low | Public endpoints, mock billing | High |
| Auth & RBAC | Medium | Partial | Partial | Partial | Low | No active permission enforcement | High |
| Setup (Branches/Users/Roles) | Strong | Medium | Medium | Medium | Medium | Missing validation, tenant isolation gaps | High |
| Catalog/Menu | Strong | Medium | Medium | Partial | Medium | Missing delete/get by id, dummy seed | High |
| Inventory Master | Strong | Medium | Medium | Partial | Medium-Low | Postgres-specific queries in MySQL setup | High |
| Inventory Ops | Medium | Medium | Medium | Low | Low | Duplicate modules and ledgers | High |
| Procurement (PO) | Medium | Partial | Medium | Low | Low | Incomplete workflow | High |
| POS Online (Web) | Medium | Medium | Medium | Partial | Medium-Low | Payments missing | High |
| POS Offline (Electron) | Medium | Low | Low | Low | Low | Mock sync, no conflict handling | High |
| Production | Medium | Partial | Medium | Low | Low | Route mismatch with frontend | Medium |
| Accounting | Strong | Medium | Medium | Partial | Medium-Low | Missing finance tables | High |
| CRM/Customers | Medium | Partial | Medium | Low | Low | UI mostly mock | Medium |
| Deals/Vouchers | Medium | Medium | Medium | Low | Low | UI mock, backend OK | Medium |
| Analytics/AI | Medium | Partial | Partial | Low | Low | Mock/derived data | Medium |
| POS Web (pos-app) | Low | Low | Low | Low | Very Low | Fully mocked | Low |

