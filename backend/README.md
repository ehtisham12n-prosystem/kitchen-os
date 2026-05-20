# KitchenOS Backend

## Runtime model

KitchenOS backend now starts through one environment-driven path:

1. load `.env` from `backend/.env` or repo-root `.env`
2. validate critical runtime security configuration
3. apply SQL migrations with `npm run db:migrate`
4. run first bootstrap with `npm run bootstrap:first-run`
5. start the API with `npm run start:dev` or `npm run start:prod`

## Required runtime variables

Minimum local backend runtime:

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

Local development may omit `CORS_ALLOWED_ORIGINS`; the API will allow the built-in local web/POS origins.

Staging and production must also set:

```powershell
$env:CORS_ALLOWED_ORIGINS="https://console-staging.example.com,https://pos-staging.example.com"
$env:CORS_ALLOW_CREDENTIALS="true"
```

## Security expectations

- `JWT_SECRET` is always required.
- In `NODE_ENV=staging` and `NODE_ENV=production`, `JWT_SECRET` must be strong and at least 32 characters.
- Placeholder JWT values are rejected in staging/production startup.
- `CORS_ALLOWED_ORIGINS` is mandatory in staging/production startup.
- Open CORS is no longer used.

## First-run setup

Apply migrations:

```powershell
npm run db:migrate
```

Bootstrap the first platform admin:

```powershell
$env:BOOTSTRAP_SUPER_ADMIN_FULL_NAME="KitchenOS Root"
$env:BOOTSTRAP_SUPER_ADMIN_USERNAME="rootadmin"
$env:BOOTSTRAP_SUPER_ADMIN_EMAIL="rootadmin@example.com"
$env:BOOTSTRAP_SUPER_ADMIN_PASSWORD="ChangeMe123!"
npm run bootstrap:first-run
```

To create the first client in the same pass, set the `BOOTSTRAP_CLIENT_*` variables from [`.env.example`](/D:/Antigravity/KitchenOS/.env.example).

## Deployment minimums

Staging:

- explicit `CORS_ALLOWED_ORIGINS`
- strong unique `JWT_SECRET`
- MySQL backups configured and writable
- first-run bootstrap completed once only

Production:

- all staging controls
- dedicated database credentials
- backup path and retention defined
- restore validation process documented and practiced

## Backup guidance

KitchenOS exposes backup-readiness signals through operational health, but it does not perform database backups itself.

Minimum operational expectation:

- set `BACKUP_STORAGE_PATH`
- set `BACKUP_RETENTION_DAYS`
- set `BACKUP_RESTORE_VALIDATION_ENABLED=true` once restore verification is in place
- run scheduled MySQL dumps outside the API process
