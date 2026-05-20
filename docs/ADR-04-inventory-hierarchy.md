# Architectural Decision Record: 4-Tier Inventory Hierarchy

**Date**: Feb 2026
**Context**: Designing the KitchenOS database schema for managing raw materials, supplies, and organizational assets.

## Requirement
To provide enterprise-grade accounting and reporting capabilities, inventory cannot be flat. It must follow a strict, cascading 4-level parent-child hierarchy to ensure deep financial traceability.

## Decision: Relational 4-Tier Structure

The Inventory Module is modeled as a strictly enforced 4-tier relational structure. Every physical item must traverse up to a top-level accounting class.

### Level 0: Inventory Class (`inventory_classes`)
The highest level logical accounting bucket.
- **Example**: `Raw Materials`, `MRO`, `Assets`, `Packaging`

### Level 1: Inventory Type (`inventory_types`)
The major category, directly bound to a specific Class.
- **Example**: `Meat` (Linked to `Raw Materials`)

### Level 2: Inventory Sub-Type (`inventory_sub_types`)
The specific family, directly bound to a specific Type.
- **Example**: `Chicken` (Linked to `Meat`)
- **Example**: `Beef` (Linked to `Meat`)

### Level 3: Inventory Item (`inventory_items`)
The specific SKU kept on the shelf, directly bound to a specific Sub-Type.
- **Example**: `Whole Chicken` (Linked to `Chicken`)
- **Example**: `Chicken Wings` (Linked to `Chicken`)

## Rules & Constraints
1. **Multi-Tenancy**: All four tiers are completely governed by `client_id`. Every client defines their own accounting tree. Client A's "Meat" type is strictly isolated from Client B's "Meat" type.
2. **Strict Enforcement**: An Item cannot exist without a Sub-Type. A Sub-Type cannot exist without a Type. This prevents orphaned items and ensures accounting reports can always perfectly roll upward.
3. **Master Data Inheritance**: Like products, everything in the `inventory_items` tree is defined once per client. Branch-specific logic (like Stock on Hand/Stock Levels) will eventually map to the Level 3 Item via secondary tables.
