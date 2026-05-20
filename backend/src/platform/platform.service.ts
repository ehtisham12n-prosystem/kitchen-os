import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { Role } from '../setup/entities/Roles.entity';
import { Departments } from '../setup/entities/Departments.entity';
import { Designation } from '../setup/entities/Designation.entity';
import { SubscriptionPlan, SubscriptionPlanStatus } from './entities/subscription-plan.entity';
import { ClientSettings } from './entities/client-settings.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { Client } from './entities/client.entity'; // Added missing import for Client
import { ClientSubscription } from './entities/client-subscription.entity';
import { ClientSubscriptionHistory } from './entities/client-subscription-history.entity';
// import { ClientGroupMember } from './entities/client-group-member.entity'; // Added new import
import { UserManagementsService } from '../setup/users/users.service';
import { RolesService } from '../setup/roles/roles.service';

import { RegistryService } from './security/registry/registry.service';
import { ThemesService } from './themes/themes.service';
import * as bcrypt from 'bcrypt';

import { PermissionBlueprint } from './entities/permission-blueprint.entity';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from './dto/subscription-plan.dto';
import { CreateBlueprintDto, UpdateBlueprintDto } from './dto/permission-blueprint.dto';
import { OperationalAuditService } from './audit/operational-audit.service';
import { EntitlementsService } from './entitlements/entitlements.service';
import { createDefaultClientNumberingSettings, createDefaultBranchDocumentSettings } from '../setup/branches/branch-config.types';
import { buildClientLookupWhere } from './client-lookup.util';

@Injectable()
export class PlatformService {
    constructor(
        @InjectRepository(Client)
        private clientRepo: Repository<Client>,
        @InjectRepository(UserManagement)
        private userManagementRepo: Repository<UserManagement>,
        @InjectRepository(SubscriptionPlan)
        private planRepo: Repository<SubscriptionPlan>,
        @InjectRepository(ClientSubscription)
        private clientSubscriptionRepo: Repository<ClientSubscription>,
        @InjectRepository(ClientSubscriptionHistory)
        private clientSubscriptionHistoryRepo: Repository<ClientSubscriptionHistory>,
        @InjectRepository(PermissionBlueprint)
        private blueprintRepo: Repository<PermissionBlueprint>,
        @InjectRepository(ClientSettings)
        private settingsRepo: Repository<ClientSettings>,
        @InjectRepository(PlatformSettings)
        private platformSettingsRepo: Repository<PlatformSettings>,
        @InjectRepository(Departments)
        private readonly deptRepo: Repository<Departments>,
        @InjectRepository(Designation)
        private readonly desigRepo: Repository<Designation>,
        private UserManagementsService: UserManagementsService,
        private rolesService: RolesService,
        private registryService: RegistryService,
        private themesService: ThemesService,
        private operationalAuditService: OperationalAuditService,
        private readonly entitlementsService: EntitlementsService,
    ) { }

    async cleanupAllData() {

        const entities = this.clientRepo.manager.connection.entityMetadatas;
        await this.clientRepo.query('SET FOREIGN_KEY_CHECKS = 0;');
        for (const entity of entities) {
            try {
                await this.clientRepo.query(`TRUNCATE TABLE ${entity.tableName};`);
                console.log(`Truncated: ${entity.tableName}`);
            } catch (e) {
                console.warn(`Could not truncate ${entity.tableName}:`, e.message);
            }
        }
        await this.clientRepo.query('SET FOREIGN_KEY_CHECKS = 1;');

        // 1. Re-seed System Meta
        await this.seedNexusClient();
        await this.seedLookups();
        await this.seedBlueprints();
        await this.registryService.seedAll();
        await this.themesService.seedDefaults();

        // 2. Clear Platform Settings (keep default)
        await this.platformSettingsRepo.clear();
        await this.getSystemSettings(); // Re-creates ID 1

        // 3. Create Default System Admin (admin/admin)
        const existingAdmin = await this.userManagementRepo.findOne({ where: { email: 'admin@kitchenos.com' } });
        if (!existingAdmin) {
            const salt = await bcrypt.genSalt();
            const hash = await bcrypt.hash('admin', salt);
            await this.userManagementRepo.save(this.userManagementRepo.create({
                full_name: 'KitchenOS Root',
                user_name: 'admin',
                email: 'admin@kitchenos.com',
                password_hash: hash,
                user_type: 'PLATFORM_ADMIN',
                client_id: 'NX-10101',
                status: 'active'
            } as any));
        }

        // 4. Seed Plans
        await this.seedSubscriptionPlans();


        return { message: 'All seeding data deleted. System reset to bare essentials.' };
    }

    async seedSubscriptionPlans(): Promise<void> {
        const plans = [
            {
                plan_code: 'START-01',
                plan_name: 'Starter Plan',
                description: 'Essential toolkit for single-location cafes and food stalls.',
                plan_status: 'active',
                currency_code: 'PKR',
                trial_enabled: true,
                default_trial_days: 14,
                max_branches: 1,
                max_users: 5,
                max_pos_devices: 1,
                allowed_modules: ['dashboard', 'pos', 'catalog', 'auth'],
                monthly_price: 5000,
                annual_price: 54000,
                is_active: true
            },
            {
                plan_code: 'GROWTH-01',
                plan_name: 'Growth Suite',
                description: 'Advanced inventory and recipe management for expanding bistros.',
                plan_status: 'active',
                currency_code: 'PKR',
                trial_enabled: true,
                default_trial_days: 14,
                max_branches: 3,
                max_users: 15,
                max_pos_devices: 3,
                allowed_modules: ['dashboard', 'pos', 'catalog', 'inventory', 'recipe', 'crm', 'auth'],
                monthly_price: 15000,
                annual_price: 162000,
                is_active: true
            },
            {
                plan_code: 'PRO-01',
                plan_name: 'Professional',
                description: 'Full-scale ERP features for multi-branch restaurant chains.',
                plan_status: 'active',
                currency_code: 'PKR',
                trial_enabled: true,
                default_trial_days: 14,
                max_branches: 10,
                max_users: 50,
                max_pos_devices: 8,
                allowed_modules: ['dashboard', 'pos', 'catalog', 'inventory', 'recipe', 'crm', 'production', 'accounting', 'analytics', 'auth'],
                monthly_price: 35000,
                annual_price: 378000,
                is_active: true
            },
            {
                plan_code: 'ENT-01',
                plan_name: 'Enterprise Ultra',
                description: 'Custom solutions with AI forecasting and unlimited scale.',
                plan_status: 'active',
                currency_code: 'PKR',
                trial_enabled: false,
                default_trial_days: 0,
                max_branches: 99,
                max_users: 999,
                max_pos_devices: 99,
                allowed_modules: ['all'],
                monthly_price: 75000,
                annual_price: 810000,
                is_active: true
            }
        ];

        for (const p of plans) {
            const exists = await this.planRepo.findOne({ where: { plan_code: p.plan_code } });
            if (!exists) {
                const savedPlan = await this.planRepo.save(
                    this.planRepo.create(p as Partial<SubscriptionPlan>),
                );
                await this.entitlementsService.syncPlanAllowedModules(savedPlan.id, savedPlan.allowed_modules, 'system');
            }
        }
    }

    async createClient(dto: any): Promise<Client> {
        const existing = await this.clientRepo.findOne({
            where: { domain_slug: dto.domain_slug },
        });
        if (existing) {
            throw new BadRequestException('Domain slug already exists');
        }

        const clientCode = await this.generateClientCode();

        // 1. Create the Client
        const client = this.clientRepo.create({
            client_code: clientCode,
            client_name: dto.client_name,
            short_name: dto.short_name,
            domain_slug: dto.domain_slug,
            business_type: dto.business_type,
            address: dto.address,
            area: dto.area,
            city: dto.city,
            country: dto.country,
            phone: dto.phone,
            email: dto.email,
            cell_phone: dto.cell_phone,
            website_url: dto.website_url,
            currency: dto.currency || 'USD',
            language: dto.language || 'en',
            timezone: dto.timezone || 'UTC',
            poc_full_name: dto.poc_full_name,
            poc_designation: dto.poc_designation,
            poc_phone: dto.poc_phone,
            poc_cell_phone: dto.poc_cell_phone,
            poc_email: dto.poc_email,
            comments: dto.comments,
            status: dto.status || 'active',
            theme_id: dto.theme_id,
            max_branches: dto.max_branches || 1,
            max_users: dto.max_users || 5,
            subscription_plan_id: dto.subscription_plan_id,
            subscription_type: dto.subscription_type || 'monthly',
            subscription_start: dto.subscription_start ? new Date(dto.subscription_start) : new Date(),
            subscription_end: dto.subscription_end ? new Date(dto.subscription_end) : undefined,
            renewal_day: dto.renewal_day,
            renewal_date: dto.renewal_date,
            grace_period_days: dto.grace_period_days || 0,
            enabled_modules_json: dto.enabled_modules ? JSON.stringify(dto.enabled_modules) : undefined,
            onboarding_blueprint: dto.onboarding_blueprint,
        });
        const savedClient = await this.clientRepo.save(client);

        // 2. Initialize Organization Settings
        const settings = this.settingsRepo.create({
            client_id: savedClient.client_code,
            currency: dto.currency || 'USD',
            timezone: dto.timezone || 'UTC',
            contact_email: dto.email || dto.poc_email,
            contact_phone: dto.phone || dto.poc_phone,
            address: dto.address,
        });
        await this.settingsRepo.save(settings);

        // 3. Create Default "Client Admin" Role
        const adminRole = await this.rolesService.create(savedClient.client_code, {
            role_name: 'Client Admin',
            is_system_role: true,
            permissions: ['all'],
        });

        // 4. Create First User (Client Owner) — no branch assigned yet; client admin will create branches
        await this.UserManagementsService.create(savedClient.client_code, {
            user_name: dto.admin_username || dto.admin_name,
            password: dto.admin_password,
            full_name: dto.admin_name,
            role_id: adminRole.id,
            user_type: 'CLIENT_ADMIN',
        });

        return savedClient;
    }

    async updateClient(id: string, dto: any): Promise<Client> {
        const client = await this.clientRepo.findOne({ where: buildClientLookupWhere(id) });
        if (!client) throw new BadRequestException('Client not found');

        const updateData: any = { ...dto };
        if (dto.subscription_start) updateData.subscription_start = new Date(dto.subscription_start);
        if (dto.subscription_end) updateData.subscription_end = new Date(dto.subscription_end);
        if (dto.enabled_modules) updateData.enabled_modules_json = JSON.stringify(dto.enabled_modules);

        // Update Admin User if provided
        if (dto.admin_username || dto.admin_name || dto.admin_password) {
            const adminUser = await this.userManagementRepo.findOne({
                where: { client_id: id, user_type: 'CLIENT_ADMIN' }
            });
            if (adminUser) {
                if (dto.admin_name) adminUser.full_name = dto.admin_name;
                if (dto.admin_username) adminUser.user_name = dto.admin_username;
                if (dto.admin_password) {
                    const salt = await bcrypt.genSalt();
                    adminUser.password_hash = await bcrypt.hash(dto.admin_password, salt);
                }
                await this.userManagementRepo.save(adminUser);
            }
        }

        // Remove password fields from client update (they go to Users service)
        delete updateData.admin_name;
        delete updateData.admin_username;
        delete updateData.admin_password;
        delete updateData.admin_confirm_password;
        delete updateData.admin_force_password_change;

        Object.assign(client, updateData);
        return this.clientRepo.save(client);
    }

    async findAllClients(): Promise<Client[]> {
        return this.clientRepo.find({ relations: ['subscription_plan'] });
    }

    async findAllPlans(): Promise<any[]> {
        const plans = await this.planRepo.find({ order: { created_at: 'DESC' } });
        const counts = await this.clientSubscriptionRepo.createQueryBuilder('subscription')
            .select('subscription.plan_id', 'plan_id')
            .addSelect('COUNT(*)', 'total_count')
            .addSelect(
                "SUM(CASE WHEN subscription.subscription_status IN ('pending','trial','active','grace','suspended') THEN 1 ELSE 0 END)",
                'active_count',
            )
            .groupBy('subscription.plan_id')
            .getRawMany<{ plan_id: string; total_count: string; active_count: string }>();

        const countMap = new Map(
            counts.map((row) => [
                Number(row.plan_id),
                {
                    total: Number(row.total_count || 0),
                    active: Number(row.active_count || 0),
                },
            ]),
        );

        return plans.map((plan) => {
            const currentCounts = countMap.get(plan.id) || { total: 0, active: 0 };
            return {
                ...plan,
                client_count: currentCounts.active,
                total_subscription_count: currentCounts.total,
            };
        });
    }

    async findPlanById(id: string | number): Promise<any> {
        const plan = await this.planRepo.findOne({ where: { id: id as any } });
        if (!plan) {
            throw new NotFoundException('Subscription plan not found');
        }

        const [activeCount, totalCount, recentSubscriptions] = await Promise.all([
            this.clientSubscriptionRepo.createQueryBuilder('subscription')
                .where('subscription.plan_id = :planId', { planId: Number(id) })
                .andWhere("subscription.subscription_status IN ('pending','trial','active','grace','suspended')")
                .getCount(),
            this.clientSubscriptionHistoryRepo.count({
                where: {
                    to_plan_id: Number(id),
                },
            }),
            this.clientSubscriptionRepo.find({
                where: { plan_id: Number(id) },
                relations: ['client'],
                order: { created_at: 'DESC' },
                take: 10,
            }),
        ]);

        return {
            ...plan,
            client_count: activeCount,
            total_subscription_events: totalCount,
            recent_subscriptions: recentSubscriptions.map((subscription) => ({
                id: subscription.id,
                client_id: subscription.client_id,
                client_name: subscription.client?.client_name || subscription.client_id,
                status: subscription.status,
                billing_cycle: subscription.billing_cycle,
                price_snapshot: Number(subscription.price_snapshot || 0),
                effective_start_at: subscription.effective_start_at,
                effective_end_at: subscription.effective_end_at,
                created_at: subscription.created_at,
            })),
        };
    }

    async createPlan(dto: CreateSubscriptionPlanDto, user?: any): Promise<SubscriptionPlan> {
        await this.ensurePlanCodeAvailable(dto.plan_code);
        this.validatePlanPricing(dto.monthly_price, dto.annual_price);

        const normalizedStatus = this.normalizePlanStatus(dto.plan_status, dto.is_active);
        const normalizedTrialDays = dto.trial_enabled ? Number(dto.default_trial_days || 0) : 0;
        const plan = this.planRepo.create({
            ...dto,
            plan_code: dto.plan_code.trim().toUpperCase(),
            plan_name: dto.plan_name.trim(),
            description: dto.description?.trim() || null,
            plan_status: normalizedStatus,
            is_active: normalizedStatus === 'active',
            currency_code: dto.currency_code?.trim() || 'PKR',
            trial_enabled: Boolean(dto.trial_enabled),
            default_trial_days: normalizedTrialDays,
            max_pos_devices: Number(dto.max_pos_devices || 1),
            allowed_modules: dto.allowed_modules?.length ? dto.allowed_modules : ['all'],
        } as Partial<SubscriptionPlan>);

        const savedPlan = await this.planRepo.save(plan);
        await this.entitlementsService.syncPlanAllowedModules(
            savedPlan.id,
            savedPlan.allowed_modules,
            typeof user?.sub === 'string' ? user.sub : user?.sub ? String(user.sub) : 'system',
        );
        await this.operationalAuditService.log({
            user,
            action: 'Create Subscription Plan',
            entity: 'SubscriptionPlan',
            portal: 'Nexus',
            entityId: savedPlan.id,
            details: `Created plan ${savedPlan.plan_name}`,
            metadata: {
                plan_code: savedPlan.plan_code,
                plan_status: savedPlan.plan_status,
            },
        });
        return savedPlan;
    }

    async updatePlan(id: string | number, dto: UpdateSubscriptionPlanDto, user?: any): Promise<SubscriptionPlan> {
        const plan = await this.planRepo.findOne({ where: { id: id as any } });
        if (!plan) {
            throw new NotFoundException('Subscription plan not found');
        }

        if (dto.plan_code && dto.plan_code.trim().toUpperCase() !== plan.plan_code) {
            await this.ensurePlanCodeAvailable(dto.plan_code, Number(id));
        }

        this.validatePlanPricing(
            dto.monthly_price ?? Number(plan.monthly_price || 0),
            dto.annual_price ?? Number(plan.annual_price || 0),
        );

        const nextStatus = this.normalizePlanStatus(dto.plan_status, dto.is_active, plan.plan_status);
        Object.assign(plan, {
            plan_code: dto.plan_code !== undefined ? dto.plan_code.trim().toUpperCase() : plan.plan_code,
            plan_name: dto.plan_name !== undefined ? dto.plan_name.trim() : plan.plan_name,
            description: dto.description !== undefined ? dto.description?.trim() || null : plan.description,
            plan_status: nextStatus,
            is_active: nextStatus === 'active',
            currency_code: dto.currency_code !== undefined ? dto.currency_code?.trim() || 'PKR' : plan.currency_code,
            trial_enabled: dto.trial_enabled !== undefined ? Boolean(dto.trial_enabled) : plan.trial_enabled,
            default_trial_days: dto.trial_enabled === false
                ? 0
                : dto.default_trial_days !== undefined
                    ? Number(dto.default_trial_days || 0)
                    : plan.default_trial_days,
            monthly_price: dto.monthly_price !== undefined ? Number(dto.monthly_price) : plan.monthly_price,
            annual_price: dto.annual_price !== undefined ? Number(dto.annual_price) : plan.annual_price,
            max_branches: dto.max_branches !== undefined ? Number(dto.max_branches) : plan.max_branches,
            max_users: dto.max_users !== undefined ? Number(dto.max_users) : plan.max_users,
            max_pos_devices: dto.max_pos_devices !== undefined ? Number(dto.max_pos_devices) : plan.max_pos_devices,
            allowed_modules: dto.allowed_modules !== undefined
                ? (dto.allowed_modules.length ? dto.allowed_modules : ['all'])
                : plan.allowed_modules,
        });

        const savedPlan = await this.planRepo.save(plan);
        if (dto.allowed_modules !== undefined) {
            await this.entitlementsService.syncPlanAllowedModules(
                savedPlan.id,
                savedPlan.allowed_modules,
                typeof user?.sub === 'string' ? user.sub : user?.sub ? String(user.sub) : 'system',
            );
        }
        await this.operationalAuditService.log({
            user,
            action: 'Update Subscription Plan',
            entity: 'SubscriptionPlan',
            portal: 'Nexus',
            entityId: savedPlan.id,
            details: `Updated plan ${savedPlan.plan_name}`,
            metadata: {
                plan_code: savedPlan.plan_code,
                plan_status: savedPlan.plan_status,
            },
        });
        return savedPlan;
    }

    async updatePlanStatus(
        id: string | number,
        planStatus: SubscriptionPlanStatus,
        user?: any,
    ): Promise<SubscriptionPlan> {
        const plan = await this.planRepo.findOne({ where: { id: id as any } });
        if (!plan) {
            throw new NotFoundException('Subscription plan not found');
        }

        plan.plan_status = planStatus;
        plan.is_active = planStatus === 'active';
        const savedPlan = await this.planRepo.save(plan);
        await this.operationalAuditService.log({
            user,
            action: 'Update Subscription Plan Status',
            entity: 'SubscriptionPlan',
            portal: 'Nexus',
            entityId: savedPlan.id,
            details: `Plan ${savedPlan.plan_name} moved to ${planStatus}`,
            metadata: {
                plan_code: savedPlan.plan_code,
                plan_status: planStatus,
            },
        });
        return savedPlan;
    }

    async deletePlan(id: string | number): Promise<void> {
        const plan = await this.planRepo.findOne({ where: { id: id as any } });
        if (!plan) {
            throw new NotFoundException('Subscription plan not found');
        }

        const assignmentCount = await this.clientSubscriptionRepo.count({
            where: { plan_id: Number(id) },
        });
        if (assignmentCount > 0) {
            throw new BadRequestException('Assigned plans cannot be deleted. Retire the plan instead.');
        }

        await this.planRepo.delete(id as any);
    }

    // ─── Blueprints ─────────────────────────────────────────────────────────────

    private async ensurePlanCodeAvailable(planCode: string, excludeId?: number): Promise<void> {
        const normalizedCode = planCode.trim().toUpperCase();
        const existing = await this.planRepo.findOne({
            where: { plan_code: normalizedCode },
        });
        if (existing && existing.id !== excludeId) {
            throw new BadRequestException('Plan code already exists');
        }
    }

    private normalizePlanStatus(
        explicitStatus?: SubscriptionPlanStatus,
        compatibilityActive?: boolean,
        fallbackStatus: SubscriptionPlanStatus = 'draft',
    ): SubscriptionPlanStatus {
        if (explicitStatus) {
            return explicitStatus;
        }
        if (compatibilityActive === true) {
            return 'active';
        }
        if (compatibilityActive === false) {
            return fallbackStatus === 'draft' ? 'draft' : 'retired';
        }
        return fallbackStatus;
    }

    private validatePlanPricing(monthlyPrice: number, annualPrice: number): void {
        if (Number(monthlyPrice) < 0 || Number(annualPrice) < 0) {
            throw new BadRequestException('Plan pricing must be zero or greater');
        }
    }

    async findAllBlueprints(): Promise<PermissionBlueprint[]> {
        return this.blueprintRepo.find({ where: { is_active: true } });
    }

    async createBlueprint(dto: CreateBlueprintDto): Promise<PermissionBlueprint> {
        const blueprint = this.blueprintRepo.create(dto);
        return this.blueprintRepo.save(blueprint);
    }

    async updateBlueprint(id: string, dto: UpdateBlueprintDto): Promise<PermissionBlueprint> {
        await this.blueprintRepo.update(id, dto);
        return await this.blueprintRepo.findOne({ where: { id } }) as PermissionBlueprint;
    }

    async seedBlueprints() {
        const count = await this.blueprintRepo.count();
        if (count > 0) return;

        const BLUEPRINTS = [
            { slug: 'fine_dining', name: 'Fine Dining', description: 'Pre-loads 12 Categories, 5 Roles (Sommelier, Chef), 14 UOMs', icon: '🍷' },
            { slug: 'fast_food', name: 'Fast Food / QSR', description: 'Pre-loads 8 Categories, 3 Roles (Cashier, Line Cook), 8 UOMs', icon: '🍔' },
            { slug: 'cafe', name: 'Cafe & Bakery', description: 'Pre-loads 10 Categories, 4 Roles (Barista, Baker), 10 UOMs', icon: '☕' }
        ];

        for (const bp of BLUEPRINTS) {
            await this.blueprintRepo.save(this.blueprintRepo.create(bp));
        }

    }

    async updateClientStatus(id: string, status: 'active' | 'suspended' | 'expired_grace' | 'read_only'): Promise<Client> {
        const client = await this.clientRepo.findOne({ where: buildClientLookupWhere(id) });
        if (!client) throw new BadRequestException('Client not found');

        client.status = status;
        return this.clientRepo.save(client);
    }

    async createSystemUserManagement(dto: any): Promise<UserManagement> {
        const salt = await bcrypt.genSalt();
        const hash = await bcrypt.hash(dto.password, salt);

        const userData = { ...dto };
        delete userData.password;

        if (dto.first_name || dto.last_name) {
            userData.full_name = `${dto.first_name || ''} ${dto.last_name || ''}`.trim();
        }

        const user = this.userManagementRepo.create({
            ...userData,
            password_hash: hash,
            user_type: 'PLATFORM_ADMIN',
            client_id: 'NX-10101',
            status: dto.status || 'active',
        } as any) as any;

        return this.userManagementRepo.save(user) as any;
    }

    async findAllSystemUserManagements(): Promise<UserManagement[]> {
        return this.userManagementRepo.find({ where: { user_type: 'PLATFORM_ADMIN' } });
    }

    async findSystemUserManagementById(id: number): Promise<UserManagement> {
        const user = await this.userManagementRepo.findOne({
            where: { id, user_type: 'PLATFORM_ADMIN' },
            relations: ['roleEntity', 'department', 'designation']
        });
        if (!user) throw new BadRequestException('Platform operator not found');
        return user;
    }

    async updateSystemUserManagement(id: number, dto: any): Promise<UserManagement> {
        const user = await this.findSystemUserManagementById(id);

        const updateData = { ...dto };
        if (dto.password) {
            const salt = await bcrypt.genSalt();
            updateData.password_hash = await bcrypt.hash(dto.password, salt);
            delete updateData.password;
        }

        // Handle full_name update from first/last if needed
        if (dto.first_name || dto.last_name) {
            updateData.full_name = `${dto.first_name || ''} ${dto.last_name || ''}`.trim();
        }

        Object.assign(user, updateData);
        return this.userManagementRepo.save(user);
    }

    async deactivateSystemUserManagement(id: number): Promise<UserManagement> {
        const user = await this.findSystemUserManagementById(id);
        user.status = 'suspended';
        user.is_active = false;
        return this.userManagementRepo.save(user);
    }

    async activateSystemUserManagement(id: number): Promise<UserManagement> {
        const user = await this.findSystemUserManagementById(id);
        user.status = 'active';
        user.is_active = true;
        return this.userManagementRepo.save(user);
    }

    async findClientById(id: string): Promise<any> {
        const client = await this.clientRepo.findOne({
            where: buildClientLookupWhere(id),
            relations: ['subscription_plan'],
        });
        if (!client) {
            throw new BadRequestException('Client not found');
        }

        const allUsers = await this.userManagementRepo.find({
            where: { client_id: id }
        });
        console.log(`[PlatformService DEBUG] All users for client ${id}:`, allUsers.map(u => ({ username: u.user_name, type: u.user_type, clientId: u.client_id })));

        // Robust fetching: Pick the explicit admin if found, otherwise pick the first user
        const adminUser = allUsers.find(u => u.user_type === 'CLIENT_ADMIN') || allUsers[0];

        return {
            ...client,
            admin_username: adminUser?.user_name || '',
            admin_name: adminUser?.full_name || ''
        };
    }

    async findSystemUserManagementByEmail(email: string): Promise<UserManagement | null> {
        return this.userManagementRepo.findOne({ where: { email, user_type: 'PLATFORM_ADMIN' } });
    }

    async findSystemUserManagementByUserManagementname(userName: string): Promise<UserManagement | null> {
        return this.userManagementRepo.findOne({ where: { user_name: userName, user_type: 'PLATFORM_ADMIN' } });
    }

    async getSettings(clientId: string): Promise<ClientSettings> {
        let settings = await this.settingsRepo.findOne({ where: { client_id: clientId } });
        if (!settings) {
            settings = this.settingsRepo.create({
                client_id: clientId,
                numbering_settings: createDefaultClientNumberingSettings(),
            } as Partial<ClientSettings>);
            settings = await this.settingsRepo.save(settings);
        } else if (!settings.numbering_settings) {
            settings.numbering_settings = createDefaultClientNumberingSettings();
            settings = await this.settingsRepo.save(settings);
        }
        return settings as ClientSettings;
    }

    async updateSettings(clientId: string, dto: any): Promise<ClientSettings> {
        const current = await this.getSettings(clientId);
        const next = {
            ...current,
            ...dto,
        } as ClientSettings;
        if (dto?.numbering_settings) {
            next.numbering_settings = {
                ...createDefaultClientNumberingSettings(),
                ...(current.numbering_settings || {}),
                ...dto.numbering_settings,
                rules: {
                    ...createDefaultBranchDocumentSettings(),
                    ...(current.numbering_settings?.rules || {}),
                    ...(dto.numbering_settings?.rules || {}),
                },
            };
        }
        await this.settingsRepo.save(next);
        return this.getSettings(clientId);
    }

    async getSystemSettings(): Promise<PlatformSettings> {
        let settings = await this.platformSettingsRepo.findOne({ where: { id: 1 } });
        if (!settings) {
            settings = new PlatformSettings();
            settings.id = 1;
            settings = await this.platformSettingsRepo.save(settings);
        }
        return settings;
    }

    async updateSystemSettings(dto: any): Promise<PlatformSettings> {
        try {
            let settings = await this.platformSettingsRepo.findOne({ where: { id: 1 } });
            if (!settings) {
                settings = new PlatformSettings();
                settings.id = 1;
            }
            Object.assign(settings, dto);
            return await this.platformSettingsRepo.save(settings);
        } catch (e: any) {
            console.error('CRITICAL SAVE ERROR:', e);
            throw new BadRequestException(e.sqlMessage || e.message || 'Error saving settings');
        }
    }
    async findClientBySlug(slug: string): Promise<any | null> {
        const client = await this.clientRepo.findOne({
            where: { domain_slug: slug },
            relations: ['subscription_plan'],
        });
        if (!client) return null;

        // Fetch admin user
        const adminUser = await this.userManagementRepo.findOne({
            where: { client_id: client.client_code, user_type: 'CLIENT_ADMIN' }
        });

        return {
            ...client,
            admin_username: adminUser?.user_name,
            admin_name: adminUser?.full_name
        };
    }

    // ─── Platform Departments ───────────────────────────────────────────────────

    async findAllDepartments() {
        return this.deptRepo.find({ order: { name: 'ASC' } });
    }

    async createDepartments(dto: any) {
        return this.deptRepo.save(this.deptRepo.create(dto));
    }

    async updateDepartments(id: number, dto: any) {
        await this.deptRepo.update(id, dto);
        return this.deptRepo.findOne({ where: { id } });
    }

    async removeDepartments(id: number) {
        return this.deptRepo.delete(id);
    }

    // ─── Platform Designations ──────────────────────────────────────────────────

    async findAllDesignations() {
        return this.desigRepo.find({ order: { name: 'ASC' } });
    }

    async createDesignation(dto: any) {
        return this.desigRepo.save(this.desigRepo.create(dto));
    }

    async updateDesignation(id: number, dto: any) {
        await this.desigRepo.update(id, dto);
        return this.desigRepo.findOne({ where: { id } });
    }

    async removeDesignation(id: number) {
        return this.desigRepo.delete(id);
    }

    async cleanupLookups() {
        await this.deptRepo.query('SET FOREIGN_KEY_CHECKS = 0');
        await this.deptRepo.query('TRUNCATE TABLE departments');
        await this.desigRepo.query('TRUNCATE TABLE designations');
        await this.deptRepo.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    async seedLookups() {
        console.log('[SeedLookups] SET FOREIGN_KEY_CHECKS = 0');
        await this.deptRepo.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('[SeedLookups] Starting seeding for client NX-10101...');
        const departments = [
            'Engineering', 'Customer Success', 'Finance', 'Analytics',
            'Operations', 'Product', 'Legal', 'IT Support', 'Human Resources', 'Supply Chain'
        ];

        const desigMap: Record<string, string[]> = {
            'Engineering': ['Technical Director', 'Software Architect', 'Frontend Developer', 'Backend Developer', 'QA Engineer'],
            'Operations': ['Operations Manager', 'Branch Manager', 'Floor Supervisor', 'Logistics Lead'],
            'Finance': ['Finance Controller', 'Accountant', 'Audit Lead'],
            'Analytics': ['BI Analyst', 'Data Engineer'],
            'IT Support': ['IT Admin', 'Support Lead', 'Systems Engineer'],
            'Product': ['Product Manager', 'UX Designer'],
            'Human Resources': ['HR Manager', 'Talent Acquisition'],
        };

        const orphanDesignations = ['Executive Chef', 'Sous Chef', 'Server', 'Delivery Driver', 'Accountant'];

        for (const name of departments) {
            let dept = await this.deptRepo.findOne({ where: { name, clientId: 'NX-10101' } });
            if (!dept) {
                console.log(`[SeedLookups] Creating department: ${name}`);
                dept = await this.deptRepo.save(this.deptRepo.create({
                    name,
                    code: name.substring(0, 6).toUpperCase().replace(/\s/g, '') + '-D',
                    clientId: 'NX-10101',
                    description: `Standard platform ${name} department`,
                    isActive: true
                }));
            } else {
                console.log(`[SeedLookups] Department exists: ${name}`);
            }

            const relatedDesigs = desigMap[name] || [];
            for (const dName of relatedDesigs) {
                const exists = await this.desigRepo.findOne({ where: { name: dName, clientId: 'NX-10101', departmentName: name } });
                if (!exists) {
                    console.log(`[SeedLookups] Creating linked designation: ${dName} in ${name}`);
                    await this.desigRepo.save(this.desigRepo.create({
                        name: dName,
                        code: dName.substring(0, 6).toUpperCase().replace(/\s/g, '') + '-G',
                        clientId: 'NX-10101',
                        departmentName: name,
                        level: dName.includes('Manager') || dName.includes('Director') ? 'Management' : 'Staff',
                        isActive: true
                    }));
                }
            }
        }

        for (const name of orphanDesignations) {
            const exists = await this.desigRepo.findOne({ where: { name, clientId: 'NX-10101', departmentName: 'General' } });
            if (!exists) {
                console.log(`[SeedLookups] Creating orphan designation: ${name}`);
                await this.desigRepo.save(this.desigRepo.create({
                    name,
                    code: name.substring(0, 6).toUpperCase().replace(/\s/g, '') + '-G',
                    clientId: 'NX-10101',
                    departmentName: 'General',
                    level: 'Staff',
                    isActive: true
                }));
            }
        }
        console.log('[SeedLookups] Seeding cycle complete.');
        await this.deptRepo.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    async seedNexusClient() {
        let nexusClient = await this.clientRepo.findOne({ where: { client_code: 'NX-10101' } });
        if (!nexusClient) {
            nexusClient = this.clientRepo.create({
                client_code: 'NX-10101',
                client_name: 'Nexus Admin',
                domain_slug: 'nexus',
                status: 'active',
                short_name: 'NX',
            });
            await this.clientRepo.save(nexusClient);
            console.log('[seedNexusClient] Created NX-10101');
        } else {
            console.log('[seedNexusClient] NX-10101 already exists');
        }
    }

    private async generateClientCode(): Promise<string> {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const candidate = `CL${Math.floor(1000 + Math.random() * 9000)}`;
            const existing = await this.clientRepo.findOne({
                where: { client_code: candidate },
                select: ['id'],
            });
            if (!existing) {
                return candidate;
            }
        }

        throw new BadRequestException('Unable to generate a unique client code');
    }
}
