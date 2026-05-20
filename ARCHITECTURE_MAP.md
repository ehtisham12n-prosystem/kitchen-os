# Architecture Map

## Monorepo
- `D:\Antigravity\KitchenOS\backend` — NestJS API
- `D:\Antigravity\KitchenOS\frontend` — Web console (React)
- `D:\Antigravity\KitchenOS\pos` — Electron offline POS
- `D:\Antigravity\KitchenOS\pos-app` — Experimental POS web app
- `D:\Antigravity\KitchenOS\docs` — ADRs and architecture notes

## Runtime Portals
- System (Nexus): `/nexus`
- Client/Branch (Console): `/console`
- POS Terminal: `/terminal`
- Customer: `/menu`

## Backend Modules (High-Level)
- Platform: clients, subscriptions, themes, settings, audit, support
- Auth: JWT, guards, user validation
- Setup: branches, users, roles, floor/table
- Catalog: categories, products, menu types, stations, UOM
- Inventory: classes, types, items, branch mapping
- Inventory Ops: stock ledger and levels (duplicate systems)
- POS: orders, KOT, shifts, sale counters
- Accounting: chart of accounts, journals, vouchers
- Production: production orders
- Customers, Deals, Analytics, AI

## Data Stores
- Cloud DB: MySQL configured in code/docker
- POS Offline: SQLite (`pos_offline.db`)
- POS App Offline: IndexedDB via Dexie

## Key Cross-Cutting Concerns
- Tenant isolation via `client_id`
- Branch scoping via `branch_id` and `x-branch-id` header
- Subscription enforcement via permissions resolver (inactive currently)
- Nexus vs Console separation (routing exists, backend mixed)
- Offline POS sync (prototype only)

