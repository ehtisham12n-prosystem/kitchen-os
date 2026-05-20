# Menu Management Module

## Module Purpose
The Menu Management module acts as a central configuration layer for all menu-related structures used across the KitchenOS system (POS, Cafeteria, Catering, Reports, Kitchen). It defines the skeletal structure of menus and kitchen routing flows rather than the actual menu items.

## Architecture
- **Centrally Managed**: All configurations are managed at the Platform level.
- **Reusable**: Masters are referenced throughout the system to ensure consistency.

## Database Structures

### Common Fields (All Tables)
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique identifier |
| `name` | Varchar | Human-readable name |
| `code` | Varchar (Unique) | Short, system-friendly code (auto-uppercase) |
| `description` | Text | Optional details |
| `is_active` | Boolean | Status toggle |
| `sort_order` | Integer | Display priority |
| `created_by` | Integer | User ID |
| `updated_by` | Integer | User ID |
| `created_at` | Timestamp | Creation time |
| `updated_at` | Timestamp | Last update time |

### Specific Tables

#### 1. `menu_categories`
Used to categorize items (e.g., Main Course, Beverages, Sides).

#### 2. `menu_types`
Defines operational menu contexts (e.g., Dine-In, Takeaway, Delivery).

#### 3. `cuisine_types`
Classifies items by cuisine for reporting and customer filtering (e.g., Italian, Continental).

#### 4. `prep_stations`
Defines kitchen routing.
- **Extra Fields**:
    - `supports_hot_food` (boolean)
    - `supports_cold_food` (boolean)
    - `kitchen_display_order` (integer)

## API List (Base: `/api/admin/`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/{module}` | Create a new record |
| GET | `/{module}` | List all records (paginated/filtered) |
| GET | `/{module}/:id` | Get single record details |
| PUT | `/{module}/:id` | Full update |
| PATCH | `/{module}/:id/status` | Toggle active/inactive status |
| DELETE | `/{module}/:id` | Soft delete (is_active = false) |

## UI Flow
1. **List Page**: Display a paginated table of records with Search and Status filters.
2. **Form Interaction**: Modal-based Create/Edit forms with inline validation.
3. **Sort Order**: Items are automatically sorted by the `sort_order` field.
4. **Permissions**: Restricted to `Client Admin` and `Manager` only.

## Integration Notes
- **POS**: Menu Types decide which items are visible on the terminal.
- **KDS**: Prep Stations determine where order items are routed.
- **Reports**: Cuisine and Categories are used for sales aggregation.
- **Catalog**: Menu Items must hold foreign keys to these master tables.
