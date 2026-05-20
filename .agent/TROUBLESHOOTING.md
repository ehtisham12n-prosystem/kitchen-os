# KitchenOS — Troubleshooting & Common Gotchas
> If you encounter persistent errors, check this file before diving into deep architectural debugging.

## 1. TypeORM Database Sync Crashes (Missing Columns)
**Symptom**: `ER_BAD_FIELD_ERROR` when saving settings, or TypeORM crashing silently during execution when `synchronize: true` is enabled.
**Root Cause**: When adding trailing columns to entities via code, if you enable `synchronize: true` but an unrelated table (e.g. `system_users` or `subscription_plans`) is missing properties like `@CreateDateColumn() created_at`, the entire database sync will abort midway and quietly roll back without throwing an explicit error to the frontend.
**Solution**: 
1. Do a dry-run sync locally or view `build_errors.txt` to see which table actually failed the unique constraint or column constraint.
2. Temporarily fix the conflicting table (or bypass it), run the sync to create the actual target columns, then turn `synchronize: false` immediately after.

## 2. API "401 Unauthorized" Silently Failing (Empty Refreshes)
**Symptom**: API endpoints return `401 Unauthorized`, or pages instantly switch from displaying data to static mock data upon browser refresh.
**Root Cause**: There is a strict mismatch between what the Login Portals save the token as and what `api.ts` expects. 
* All login portals (Admin, Client, Customer, POS) **MUST** save the JWT to local storage as `access_token` (`localStorage.setItem('access_token', token)`). 
* Do NOT use `localStorage.setItem('token', token)`. If you do, `api.ts` will fetch `access_token` (which evaluates to null) and fire all `GET` API requests completely unauthenticated.
**Solution**: Ensure any new login endpoint or portal sets the JWT key strictly as `access_token`.

## 3. Frontend vs Backend Naming Mismatches
**Symptom**: Data saves properly to the DB but is stripped out when fetched by the frontend, or vice versa (e.g., Currency dropdowns resetting).
**Root Cause**: The TypeORM entity might define a specific `@Column({ name: 'default_currency' })` but the frontend component might be spreading the state using standard `currency`.
**Solution**: Always check the backend entity `@Column({ name: '...' })` mapping. If it diverges from the DTO/frontend state shape, add a manual symmetric mapper in the frontend `useEffect` fetch and the `handleSave` payload to bridge the property renaming.

## 4. Bypassing JWT Global Guards (Testing only)
**Symptom**: A new backend module endpoint returns 401 Unauthorized during testing out of the box.
**Root Cause**: The entire NestJS backend routes use a global JWT Guard. 
**Solution**: If you are testing an open endpoint (like webhook callbacks or initial signups), you must use the `@Public()` decorator from `../auth/decorators/public.decorator` to bypass it. Ensure you remove it once testing is done.
