# First-Run Smoke

This is the release smoke for proving a fresh empty-database bootstrap on MySQL.

## Minimum prerequisite

You need one reachable empty MySQL 8.0 instance and a DB user that can:

- connect to MySQL
- create the target database if it does not already exist
- create/alter tables in that database

If you use Docker on Windows from the repo root:

```powershell
$env:DB_ROOT_PASSWORD='KitchenOSRoot!234567890123456789'
$env:DB_USERNAME='kitchenos'
$env:DB_PASSWORD='KitchenOSDb!234567890123456789'
$env:DB_DATABASE='kitchenos_release_smoke'
$env:DB_PORT='3307'
docker compose up -d db
```

## Required env vars

```powershell
$env:NODE_ENV='development'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3307'
$env:DB_DATABASE='kitchenos_release_smoke'
$env:DB_USERNAME='kitchenos'
$env:DB_PASSWORD='KitchenOSDb!234567890123456789'
$env:JWT_SECRET='KitchenOSJwtSecret12345678901234567890'
$env:BOOTSTRAP_SUPER_ADMIN_FULL_NAME='KitchenOS Super Admin'
$env:BOOTSTRAP_SUPER_ADMIN_USERNAME='root'
$env:BOOTSTRAP_SUPER_ADMIN_EMAIL='root@kitchenos.local'
$env:BOOTSTRAP_SUPER_ADMIN_PASSWORD='KitchenOSAdmin!234'
$env:BOOTSTRAP_CLIENT_NAME='Kitchen Club'
$env:BOOTSTRAP_CLIENT_SLUG='kitchen-club'
$env:BOOTSTRAP_CLIENT_ADMIN_FULL_NAME='Kitchen Club Admin'
$env:BOOTSTRAP_CLIENT_ADMIN_USERNAME='kitchenclub.admin'
$env:BOOTSTRAP_CLIENT_ADMIN_EMAIL='admin@kitchenclub.local'
$env:BOOTSTRAP_CLIENT_ADMIN_PASSWORD='KitchenClubAdmin!234'
```

Optional Kitchen Club starter profile:

```powershell
$env:BOOTSTRAP_CLIENT_STARTER_PROFILE='kitchen-club'
$env:BOOTSTRAP_CLIENT_BRANCH_MANAGER_PASSWORD='KitchenClubMgr!234'
$env:BOOTSTRAP_CLIENT_CASHIER_PASSWORD='KitchenClubCashier!234'
```

## Exact smoke sequence

From [`backend`](/D:/Antigravity/KitchenOS/backend):

```powershell
cmd /c npm run db:migrate
cmd /c npm run bootstrap:first-run
cmd /c npm run build
```

Start the backend in a second shell:

```powershell
cmd /c node dist/src/main.js
```

Then verify the proof in the first shell:

```powershell
cmd /c npm run smoke:first-run:verify
```

## Pass checkpoints

`npm run db:migrate` must print:

- `Applying ...` for the SQL migration chain on first run
- `Migration run complete. Applied: <n>. Already applied: 0.`

`npm run bootstrap:first-run` must print:

- `Bootstrap completed successfully.`
- JSON containing:
  - `nexus_client_id: "NX-10101"`
  - `super_admin.username: "root"`
  - `client.domain_slug: "kitchen-club"` if client bootstrap is enabled

`npm run smoke:first-run:verify` must print JSON containing:

- `schema_migrations` greater than `0`
- `nexus_client.id` equal to `NX-10101`
- `super_admin.user_name` equal to the configured bootstrap username
- `login_verified.client_id` equal to `NX-10101`
- `login_verified.me_user_context_present` equal to `true`

## Fail conditions

Fail the smoke if any of the following happens:

- migrations require manual SQL intervention
- bootstrap cannot create the first super admin deterministically
- bootstrap cannot create the first client deterministically
- system login fails for the configured bootstrap admin
- the verification script cannot find `NX-10101`, the bootstrap admin, or the bootstrap client
