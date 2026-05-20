# Database Relation Summary

## Core Platform
- `clients` -> many `branches`
- `clients` -> many `users`
- `clients` -> one `client_settings`
- `clients` -> one `subscription_plan`

## Setup
- `branches` -> many `floors` -> many `tables`
- `users` -> many `user_branch_roles`
- `users` -> many `user_branch_permissions`

## Catalog
- `categories` -> many `products`
- `products` -> many `product_customizations`
- `products` -> many `branch_product_mappings`
- `products` -> many `product_branch_prices`

## Inventory
- `inventory_class` -> many `inventory_type` -> many `inventory_sub_type` -> many `inventory_item`
- `inventory_item` -> many `branch_inventory`

## Inventory Ops (duplicate systems)
- System A: `inventory_stock_movements`
- System B: `inventory_stock_ledger` + `inventory_stock_levels`

## POS
- `orders` -> many `order_items`
- `orders` -> many `order_charges`
- `orders` -> many `transactions` (entity exists)
- `orders` -> `customers` (optional)

## Accounting
- `chart_of_accounts` -> many `journal_items`
- `journal_entries` -> many `journal_items`

## Missing for Requirements
- Subscription invoices and payments
- POS payment lines and settlement
- Offline sync queue and device registry (server-side)
- Idempotency keys and conflict tracking
- Audit trail for POS voids and overrides
- HR/Payroll tables

