---
description: Create a new NestJS backend module in KitchenOS
---

# New Backend Module Workflow
> Context: Read `.agent/PROJECT_BRIEFING.md` first — no need to explore the codebase.

## Pattern
All modules live in `backend/src/{module-name}/` and follow this structure:
```
{module}/
  entities/
    {entity}.entity.ts      (TypeORM @Entity)
  dto/
    create-{entity}.dto.ts
    update-{entity}.dto.ts
  {module}.module.ts
  {module}.service.ts
  {module}.controller.ts
```

## Steps

1. Create entity in `backend/src/{module}/entities/{entity}.entity.ts`
   - Use TypeORM decorators: `@Entity`, `@PrimaryGeneratedColumn`, `@Column`, `@CreateDateColumn`, `@UpdateDateColumn`
   - Follow snake_case for DB column names, camelCase for TS property names
   - Add tenant isolation: include `client_id` column if tenant-scoped

2. Create DTOs in `backend/src/{module}/dto/`
   - `create-{entity}.dto.ts` — fields for creation
   - `update-{entity}.dto.ts` — extends PartialType(CreateDto)

3. Create service `backend/src/{module}/{module}.service.ts`
   - Inject repository via `@InjectRepository({Entity})`
   - Standard CRUD methods: findAll, findOne, create, update, remove
   - Always filter by `clientId` from `req.user.clientId` for tenant isolation

4. Create controller `backend/src/{module}/{module}.controller.ts`
   - Use `@Controller('{module}')` 
   - Inject service
   - Use `@Req() req` to extract `req.user` for tenant context
   - Standard routes: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id

5. Create module `backend/src/{module}/{module}.module.ts`
   - Import `TypeOrmModule.forFeature([Entity])`
   - Declare controller and service

6. Register in `backend/src/app.module.ts`
   - Add new module import to the `imports: []` array

// turbo
7. Verify it compiles:
```powershell
cd d:\Antigravity\KitchenOS\backend && npx tsc --noEmit
```
