# KitchenOS Runbook

This runbook reflects the stabilized release path in `D:\Antigravity\KitchenOS`.

## 1. Runtime layout

- `backend` = NestJS API on `PORT` default `3000`
- `frontend` = main Vite app using `VITE_API_BASE_URL`
- `pos-app` = Vite POS client using `VITE_API_BASE_URL`
- `docker-compose.yml` = local MySQL + Adminer

## 2. Required local environment

Use [`.env.example`](/D:/Antigravity/KitchenOS/.env.example) as the source of truth.

Minimum local backend variables:

```powershell
$env:NODE_ENV="development"
$env:PORT="3000"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_DATABASE="kitchenos"
$env:DB_USERNAME="kitchenos"
$env:DB_PASSWORD="change_me"
$env:JWT_SECRET="use-a-long-random-local-secret"
```

Optional local browser origins are auto-allowed if `CORS_ALLOWED_ORIGINS` is unset.

Frontend and POS:

```powershell
$env:VITE_API_BASE_URL="http://localhost:3000/v1"
```

## 3. Fresh local setup

Start local MySQL:

```powershell
docker compose up -d db adminer
```

Apply migrations:

```powershell
cd backend
npm run db:migrate
```

Bootstrap first-run data:

```powershell
$env:BOOTSTRAP_SUPER_ADMIN_FULL_NAME="KitchenOS Root"
$env:BOOTSTRAP_SUPER_ADMIN_USERNAME="rootadmin"
$env:BOOTSTRAP_SUPER_ADMIN_EMAIL="rootadmin@example.com"
$env:BOOTSTRAP_SUPER_ADMIN_PASSWORD="ChangeMe123!"
npm run bootstrap:first-run
```

If you also want the first client and Kitchen Club starter data, set the `BOOTSTRAP_CLIENT_*` variables from [`.env.example`](/D:/Antigravity/KitchenOS/.env.example) before running the bootstrap command.

## 4. Starting apps

Backend:

```powershell
cd backend
npm run start:dev
```

Frontend:

```powershell
cd frontend
npm run dev
```

POS app:

```powershell
cd pos-app
npm run dev
```

## 5. Staging and production expectations

Staging and production must set:

```powershell
$env:NODE_ENV="staging" # or production
$env:CORS_ALLOWED_ORIGINS="https://console.example.com,https://pos.example.com"
$env:CORS_ALLOW_CREDENTIALS="true"
$env:JWT_SECRET="<32+ char unique secret>"
$env:BACKUP_STORAGE_PATH="D:\KitchenOSBackups"
$env:BACKUP_RETENTION_DAYS="14"
```

Startup protections now enforce:

- no open CORS in staging/production
- no placeholder JWT secret in staging/production
- no weak JWT secret under 32 characters in staging/production

## 6. Backup and restore minimum

KitchenOS does not create MySQL backups itself. Operations must provide that externally.

Minimum pilot-safe practice:

- schedule regular MySQL dumps
- write them to `BACKUP_STORAGE_PATH`
- retain them for `BACKUP_RETENTION_DAYS`
- document one restore target database and test a restore before internal pilot data is considered protected
- set `BACKUP_RESTORE_VALIDATION_ENABLED=true` after the restore drill is in place

Suggested local example:

```powershell
$env:BACKUP_STORAGE_PATH="D:\KitchenOSBackups"
$env:BACKUP_RETENTION_DAYS="14"
$env:BACKUP_RESTORE_VALIDATION_ENABLED="true"
```

## 7. Deployment checklist

- database reachable with non-empty `DB_*` values
- `npm run db:migrate` completed successfully
- `npm run bootstrap:first-run` completed for the target environment
- `JWT_SECRET` rotated from placeholder/example value
- `CORS_ALLOWED_ORIGINS` matches the deployed frontend/POS hosts
- backups configured and restore process documented
- backend build, backend tests, frontend build, and frontend lint all passing
