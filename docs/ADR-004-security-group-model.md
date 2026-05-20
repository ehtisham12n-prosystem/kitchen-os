# ADR-004: KitchenOS Security Group Model & Permission Architecture

**Status:** Accepted  
**Date:** 2026-03-01  
**Author:** Nexus Platform Team  

---

## Context

KitchenOS is a multi-tenant, offline-capable ERP + POS SaaS platform. Managing access control across three distinct portal levels (Nexus, Client Console, Branch Terminal) required a scalable and confusion-proof RBAC strategy. This ADR documents the decisions made and the resulting Security Playbook that all developers must follow.

---

## Decision

We adopt a **3-Party Scoped RBAC** model with the following core principles:

### 1. Strict Scope Partitioning

All security groups are assigned exactly one `scope`:

| Scope     | Table           | Portal          | `client_id` | `branch_id` |
|-----------|-----------------|-----------------|-------------|-------------|
| `nexus`   | `system_groups` | Nexus Portal    | `NULL`      | `NULL`      |
| `client`  | `tenant_groups` | Client Console  | Required    | `NULL`      |
| `branch`  | `tenant_groups` | Branch Terminal | Required    | Required    |

**Rule:** No group may ever belong to two scopes simultaneously. Scope is immutable after creation.

---

### 2. The 3-Group Model (Standard Access Tiers)

For every module in a client's subscription, **three groups are automatically provisioned** at both the client and branch level. This avoids administrators managing hundreds of individual permissions.

#### Client (HQ) Level Groups

| Type    | DB `type`  | Description                                                            |
|---------|------------|------------------------------------------------------------------------|
| Full    | `full`     | Full CRUD on all pages within the module. Can manage module settings.  |
| Limited | `limited`  | Operational CRUD (create/update/delete records) only. No settings.     |
| View    | `view`     | Read-only access to all module pages. Suitable for auditors.           |

**Example — Inventory Module, Client Level:**
- `Inventory — Full Access` (type: full)
- `Inventory — Limited Access` (type: limited)
- `Inventory — View Only` (type: view)

#### Branch Level Groups

The same 3-tier model is applied at branch level, but permissions are scoped to a single branch's data only.

**Example — Inventory Module, Branch Level:**
- `Inventory Branch — Full Access` (type: full, branch_id: X)
- `Inventory Branch — Limited Access` (type: limited, branch_id: X)
- `Inventory Branch — View Only` (type: view, branch_id: X)

---

### 3. Nexus as the Master Permission Registry

Nexus holds **Blueprint Templates** (`system_groups` with `is_template=true`) for every module permission tier. These blueprints define the exact set of permissions that constitute "Full", "Limited", and "View" for each product module.

**Nexus Operator Responsibilities:**
- Maintain and update blueprint templates.
- Add new permissions to blueprints when new features are released.
- Mark deprecated permissions for removal.

Nexus operators themselves are granted access via `scope='nexus'` groups only. Nexus operators do **NOT** have client-level or branch-level groups unless explicitly added for debugging/support purposes (must be logged as an audit event).

---

### 4. Automatic Template Provisioning

**Trigger:** A new client is created, OR a client's subscription plan is modified.

**Process:**
1. System reads `allowed_modules[]` from the client's `SubscriptionPlan`.
2. For each module, fetches the 3 blueprint templates from `system_groups` where `scope='client' AND is_template=true AND module_slug=module`.
3. **Clones** them into `tenant_groups` with `client_id` set. Permissions are deep-copied.
4. Repeats for `scope='branch'` templates against the client's default branch.

**Rule:** Cloned groups are independent. Updating a Nexus blueprint does NOT retroactively update existing client groups. A "Sync to Latest Blueprint" action must be triggered manually by a Nexus Operator if a plan update is needed for existing clients.

---

### 5. User Membership & Permission Merging

- A user can be a member of **multiple groups**.
- At login, the auth service resolves the user's effective permissions as the **union** of all groups they belong to.
- A user's group membership is restricted to groups matching their own `clientId`.
- **Escalation Prevention:** A client-level user can never be added to a group with `scope='nexus'`.

---

### 6. Delegated Group Management

- **Client Admin (HQ level):** Can add/remove members from any `tenant_group` belonging to their `client_id`.
- **Branch Manager:** Can add/remove members from `tenant_groups` where `branch_id` matches their assigned branch, only if they have the `access_control` module permission.
- **Nexus Operator:** Can manage only `system_groups` (scope='nexus'). Any cross-client access must be logged and requires explicit impersonation via the audit trail.

---

## Permission Naming Convention

All permissions use dot-notation: `{module}.{page}.{action}`

**Examples:**
- `inventory.stock.adjust` — Adjust stock levels on the Stock page
- `catalog.products.create` — Create products in the Catalog module
- `pos.terminal.void_order` — Void an order in POS
- `platform.clients.manage` — Nexus-only: manage client accounts

---

## Consequences

### Benefits
- **No "Privilege Creep"**: Scope field is a hard database-level constraint.
- **Operational Simplicity**: New employees are assigned to one of 3 tiers — no manual permission picking.
- **Subscription Alignment**: Groups are always derived from the subscription plan, so revoking a module also invalidates its groups.
- **Auditable**: Every membership change is logged against the `clientId`/`branchId` scope.

### Trade-offs
- **Initial Seeding Cost**: Nexus must maintain accurate blueprint templates for all product modules.
- **Manual Sync**: Blueprint updates do not automatically propagate to existing clients (by design, to avoid unexpected permission changes).

---

## References
- `system-group.entity.ts` — Nexus-level groups + blueprint templates
- `tenant-group.entity.ts` — Client/Branch operational groups
- `group-provisioning.service.ts` — Template cloning logic
- `permission-module.entity.ts` — Module registry
- `permission-page.entity.ts` — Page and action definitions
