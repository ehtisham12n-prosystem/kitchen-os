# Architectural Decision Record: Entity and Column Naming Conventions

**Date**: Feb 2026
**Context**: Defining the multi-tenant SaaS architecture for KitchenOS.

## Table Naming
- All tables must be plural (e.g., `users`, `branches`, `clients`, `system_users`).
- The primary table for the restaurants/customers using the SaaS is `clients` (NOT tenants).
- The primary table for the KitchenOS platform admins (us) is `system_users` (NOT tenant_users).

## Column Naming Rules
We strictly use **Single-Underscore Elaborated Names** for all columns, particularly primary and foreign keys. The generic `name` columns are fully banned to prevent JOIN ambiguities.

### Primary Keys
Every primary key must be simply named `id`. Prefixing primary keys (like `client_id`, `branch_id`) is strictly banned for the primary key column itself. Foreign keys should still retain the prefix (e.g., `client_id`, `branch_id`).

### Standard Columns
Generic strings like `name`, `status`, or `email` must be prefixed to match their context:
- `clients` -> `client_name`, `client_domain_slug`, `client_status`
- `system_users` -> `sys_email`, `sys_password_hash`, `sys_role`
- `subscription_plans` -> `plan_name`, `plan_max_branches`, `plan_max_users`, `plan_monthly_price`
- `branches` -> `branch_name`, `branch_address`, `branch_tax_region`
- `roles` -> `role_name`
- `users` -> `user_name`, `user_password_hash`, `user_pin_code`

## Relationships
- **Multi-tenant isolation**: Every tenant-level table (`branches`, `roles`, `users`, `products`, etc.) MUST have a `client_id` foreign key.
- Multi-tenant indexes must explicitly compound the `client_id` with the local ID (e.g., `INDEX(client_id, branch_id)`).

## Action for All Agents
When generating new NestJS entities, TypeORM queries, or SQL, you MUST adhere to this explicit single-underscore prefixing strategy.
