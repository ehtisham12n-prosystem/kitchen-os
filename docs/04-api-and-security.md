# API Design & Security Model

## 1. API Architecture
The platform will utilize a RESTful JSON API structure pattern, organized logically by domains. 

- **Base URL**: `api.kitchenos.com/v1/`
- **Client Context**: Inherited implicitly from the `Authorization: Bearer <JWT>` token.

## 2. Security & Permissions Model

### Authentication (JWT Token)
When a user logs in, the Auth server responds with a JWT containing:
```json
{
  "sub": "user_id",
  "client_id": 105,
  "branch_id": 12, // Null if they have multi-branch access
  "role": "BranchManager",
  "exp": 1713000000
}
```

### Authorization (Active Directory Style roles)
- **Resources**: `orders`, `products`, `finance`, `reports`, `inventory`
- **Actions**: `read`, `write`, `delete`, `approve`
- Dynamic role evaluation middleware checks if `RoleX` has `write` permission on `inventory` within their `branch_id`.

## 3. Endpoint Structure Examples

### Global Platform API (Super Admin)
- `POST /platform/clients` - Provision new client, optionally including an initial `subscription_plan_id` and `subscription_billing_cycle` (`monthly` or `annual`) so the first client subscription is created as part of registry creation
- `PUT /platform/clients/{id}/suspend` - Suspend client
- `GET /platform/reports/mrr` - Global revenue

### Master & Configuration (Client Admin)
- `POST /setup/branches` - Create branch
- `POST /setup/roles` - Create custom AD group
- `POST /catalog/products` - New item with configurable toppings

### Operations (Branch / POS API)
- `POST /pos/sync-uplink` - Massive payload hit by background sync for orders/KOT/payments. Fast acknowledgment response.
- `GET /pos/sync-downlink` - Pull delta updates for master data (since last sync sequence).

## 4. Client Throttling & Subscription Enforcement Middleware
- Every API request goes through an API Gateway (e.g., Kong, Nginx, or AWS API Gateway).
- The gateway checks Redis for the `client_id` plan status.
- If `status == 'expired_grace'`, bandwidth is artifically throttled (delayed response) as requested.
- If `status == 'read_only'`, `POST`, `PUT`, `DELETE` requests automatically return `403 Payment Required`, but `GET` requests pass through.

## 5. Security & Audit Handling
- Middleware intercepts all mutating requests (`POST/PUT/DELETE`).
- Captures `actor (user_id)`, `payload changes`, and `reason` (from headers, e.g., `X-Override-Reason`).
- Writes to append-only Audit Log tables.
