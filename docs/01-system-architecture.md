# System Architecture: KitchenOS SaaS ERP + POS Platform

## 1. High-Level Architecture
KitchenOS is designed as an offline-first, multi-tenant cloud SaaS platform with a localized Windows POS system.

### Core Components
**1. Cloud Backend (API Server)**
- **Technology**: Node.js / NestJS or similar (Language agnostic, but React JS mentioned for frontend implies JS/TS stack is ideal).
- **Responsibility**: Multi-tenant data isolation, central business logic, global analytics, sync resolution, subscription enforcement.
- **Database**: MySQL (Central Cloud DB).

**2. Web Frontend (React JS)**
- **Platform Portals**: 
  - System Admin Portal (Super Admin)
  - Client Owner Portal (Multi-branch unified dashboard)
  - Branch Manager Portal
- **Responsibility**: Management, reporting, configuration, and ordering interfaces (Customer QR, Web Ordering).
- **Design System Requirement**: A centralized Theme Repository (Design Tokens and UI Library) will dictate all colors, component styles, and layouts globally across the frontend to ensure zero manual overriding and future white-labeling support.
- **Responsiveness Requirement**: ALL frontend portals (Admin, Client, Branch) must be entirely responsive. The UI must adapt seamlessly to Desktop, Tablets (iPads/Android), and Mobile properties without loss of critical functionality.

**3. Windows POS (Offline-First)**
- **Technology**: Electron with React JS or C# / .NET locally for hardware optimization.
- **Database**: Local SQLite or Local MySQL.
- **Responsibility**: Order taking, KOT printing, local offline logic, bill printing, day open/close.
- **Sync Engine**: Background service syncing to Cloud DB via API when internet is available.

## 2. Multi-Tenant Architecture & Data Isolation

### Tenancy Model: Logical Isolation (Row-Level Security)
Since this is a massive platform, provisioning a separate database per client is difficult to scale for thousands of clients. Instead, we use a **Single Database, Shared Schema** approach with strict row-level isolation via `client_id`.

- **Strict Enforcement**: Every request must carry the Client Context (derived from JWT).
- **Multi-tenant Indexes**: Every table must index `client_id` + `branch_id`.
- **Master Data Inheritance**: Global entities (Products, Categories, Modifiers, Taxes, Stations) are created *once* per `client_id` and inherited implicitly by all branches under that client. Branches utilize secondary mapping tables (e.g., `branch_product_mapping`) to disable items or modify local pricing without duplicating master data rows.

## 3. Deployment Architecture

```mermaid
graph TD
    subgraph "Branch 1 (Offline Capable)"
        POS1[Windows POS 1]
        POS2[Windows POS 2]
        LocalDB1[(Local DB)]
        KDS1[Kitchen Display]
        POS1 <--> LocalDB1
        POS2 <--> LocalDB1
        POS1 --> KDS1
    end

    subgraph "Branch 2 (Offline Capable)"
        POS3[Windows POS 1]
        LocalDB2[(Local DB)]
        POS3 <--> LocalDB2
    end

    subgraph "Cloud Global Platform"
        API[Cloud API Servers / Load Balancer]
        CloudDB[(Cloud MySQL - Core ERP DB)]
        Queue[Message Queue - Redis/Kafka]
        Auth[Identity & JWT Provider]
        API <--> CloudDB
        API <--> Queue
        API <--> Auth
    end

    subgraph "Web Clients (React JS)"
        SuperAdmin[Super Admin Portal]
        ClientAdmin[Client Owner Portal]
        QROrder[Customer QR Menu]
    end

    LocalDB1 <..>|Background Sync| API
    LocalDB2 <..>|Background Sync| API
    SuperAdmin --> API
    ClientAdmin --> API
    QROrder --> API
```

## 4. Subscriptions & Billing Flow
- **Phase 1 (Manual)**: Super Admin sets plan, expiry date, limits directly in DB.
- **Phase 2 (Automated)**: Stripe Webhook -> Provisioning Engine -> Update Client Setup.
- **Grace Period Logic**: Managed by cron jobs. Warning flags injected into client API payloads to show banners. After grace -> Revocation (Read-only roles automatically applied). 
