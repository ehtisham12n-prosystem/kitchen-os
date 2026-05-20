# Architectural Decision Record: Master Data Inheritance

**Date**: Feb 2026
**Context**: Defining how products, settings, and metadata cascade from a Client HQ down to individual branches.

## Requirement
Data must be entered **once** per Client. If a Client (e.g., "Pizza Palace") has 10 branches, they should not create "Margherita Pizza" 10 times. They create it once. All 10 branches inherit it automatically. 

However, individual branches require the autonomy to disable inherited items if they run out of stock or if an item isn't sold at that location (e.g., a mall kiosk branch might disable the "Deep Fryer Station" and all fried foods).

## Decision: Client-Level Ownership with Branch-Level Overrides

To achieve this cleanly without duplicating rows, the database will strictly follow this pattern:

### 1. Global Creation (Client Level)
All Master Data (Products, Categories, Modifiers, Stations, Tax Rates, Payment Methods) is created and owned at the `client_id` level.

- **`products` table**:
  - `product_id`: `10`
  - `client_id`: `105`
  - `name`: `"Margherita Pizza"`
  - `base_price`: `12.00`
  - *Note*: There is NO `branch_id` in the `products` table.

By default, the system assumes this product is active for **ALL** branches governed by `client_id = 105`.

### 2. Local Inheritance & Overrides (Branch Level)
To handle local disabling or price changes, we create mapping override tables (`branch_product_mapping`).

- **`branch_product_mapping` table**:
  - `branch_id`: `3`
  - `product_id`: `10`
  - `is_enabled`: `false` (Hidden from this specific branch's POS)
  - `price_override`: `14.00` (Optional: Branch 3 charges more due to airport pricing)

### Implementation Rules for Developers
When writing queries to fetch the Menu for a specific POS Terminal (e.g., Branch ID 3):
1. **Query all items** belonging to the parent `client_id`.
2. **LEFT JOIN** the corresponding `branch_mapping` table.
3. **Filter out** any results where `override.is_enabled = false`.
4. **Apply** any overridden attributes (like `price_override`) before returning the JSON payload to the POS.

This model guarantees zero data duplication while providing infinite flexibility for complex franchise structures.
