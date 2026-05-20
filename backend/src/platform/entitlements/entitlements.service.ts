import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { PosDevice } from '../../pos/entities/pos-device.entity';
import { OperationalAuditService } from '../audit/operational-audit.service';
import { buildClientLookupWhere } from '../client-lookup.util';
import { Client } from '../entities/client.entity';
import { ClientFeatureOverride } from '../entities/client-feature-override.entity';
import {
  ClientLimitKey,
  ClientLimitOverride,
  CLIENT_LIMIT_KEYS,
} from '../entities/client-limit-override.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { PlatformFeature } from '../entities/platform-feature.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionPlanFeature } from '../entities/subscription-plan-feature.entity';
import {
  CreatePlatformFeatureDto,
  UpdatePlanEntitlementsDto,
  UpdatePlanLimitsDto,
  UpdatePlatformFeatureDto,
  UpdatePlatformFeatureStatusDto,
  UpsertClientFeatureOverrideDto,
  UpsertClientLimitOverrideDto,
} from './dto/entitlements.dto';

const DEFAULT_FEATURES: Array<{ key: string; name: string; description: string }> = [
  { key: 'dashboard', name: 'Dashboard', description: 'Core operational dashboards and summaries.' },
  { key: 'auth', name: 'Users & Branch Setup', description: 'Client administration, users, roles, and branch setup.' },
  { key: 'catalog', name: 'Catalog', description: 'Products, menus, and related master data.' },
  { key: 'pos', name: 'Point of Sale', description: 'POS terminals, orders, shifts, and service flows.' },
  { key: 'inventory', name: 'Inventory', description: 'Inventory operations, stock control, and procurement.' },
  { key: 'recipe', name: 'Recipes', description: 'Recipe and bill of materials management.' },
  { key: 'crm', name: 'CRM', description: 'Customers, loyalty, and client engagement records.' },
  { key: 'production', name: 'Production', description: 'Production orders and supply operations.' },
  { key: 'accounting', name: 'Accounting', description: 'Accounting journals, ledgers, and finance operations.' },
  { key: 'analytics', name: 'Analytics', description: 'Analytics and forecasting surfaces included in the plan.' },
];

const ACTIVE_SUBSCRIPTION_STATES = new Set(['active', 'trial', 'grace']);
const BRANCH_LIMIT_STATUSES = ['setup_pending', 'active', 'suspended'];

interface EffectiveUsage {
  max_branches: number;
  max_active_users: number;
  max_pos_devices: number;
}

interface EffectiveLimits {
  max_branches: number | null;
  max_active_users: number | null;
  max_pos_devices: number | null;
}

export interface ResolvedEntitlements {
  client_id: string;
  client_status: string;
  governance_state: string;
  subscription_status: string | null;
  current_plan_id: number | null;
  current_plan_name: string | null;
  is_operational: boolean;
  blocking_reason: string | null;
  features: string[];
  feature_sources: Record<string, 'plan' | 'override_enabled' | 'override_disabled'>;
  limits: EffectiveLimits;
  usage: EffectiveUsage;
  warnings: string[];
}

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(PlatformFeature)
    private readonly featureRepository: Repository<PlatformFeature>,
    @InjectRepository(SubscriptionPlanFeature)
    private readonly planFeatureRepository: Repository<SubscriptionPlanFeature>,
    @InjectRepository(ClientFeatureOverride)
    private readonly clientFeatureOverrideRepository: Repository<ClientFeatureOverride>,
    @InjectRepository(ClientLimitOverride)
    private readonly clientLimitOverrideRepository: Repository<ClientLimitOverride>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(ClientSubscription)
    private readonly clientSubscriptionRepository: Repository<ClientSubscription>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserManagement)
    private readonly userRepository: Repository<UserManagement>,
    @InjectRepository(PosDevice)
    private readonly posDeviceRepository: Repository<PosDevice>,
    private readonly operationalAuditService: OperationalAuditService,
  ) {}

  async listFeatures(): Promise<PlatformFeature[]> {
    await this.ensureDefaultsReady();
    return this.featureRepository.find({ order: { feature_name: 'ASC' } });
  }

  async createFeature(dto: CreatePlatformFeatureDto, user?: JwtPayload): Promise<PlatformFeature> {
    await this.ensureDefaultsReady();
    const featureKey = dto.feature_key.trim().toLowerCase();
    const existing = await this.featureRepository.findOne({ where: { feature_key: featureKey } });
    if (existing) {
      throw new BadRequestException('Feature key already exists');
    }

    const feature = await this.featureRepository.save(this.featureRepository.create({
      feature_key: featureKey,
      feature_name: dto.feature_name.trim(),
      description: dto.description?.trim() || null,
      created_by: resolveActorId(user) ?? null,
      updated_by: resolveActorId(user) ?? null,
      is_active: true,
    }));

    await this.operationalAuditService.log({
      user,
      action: 'Create Platform Feature',
      entity: 'PlatformFeature',
      portal: 'Nexus',
      entityId: feature.id,
      details: `Created feature ${feature.feature_name}`,
      metadata: { feature_key: feature.feature_key },
    });

    await this.syncWildcardPlanMappings(feature, resolveActorId(user) ?? 'system');

    return feature;
  }

  async updateFeature(id: number, dto: UpdatePlatformFeatureDto, user?: JwtPayload): Promise<PlatformFeature> {
    const feature = await this.getFeatureOrFail(id);
    feature.feature_name = dto.feature_name?.trim() || feature.feature_name;
    feature.description = dto.description !== undefined ? dto.description?.trim() || null : feature.description;
    feature.updated_by = resolveActorId(user) ?? feature.updated_by;
    const saved = await this.featureRepository.save(feature);

    await this.operationalAuditService.log({
      user,
      action: 'Update Platform Feature',
      entity: 'PlatformFeature',
      portal: 'Nexus',
      entityId: saved.id,
      details: `Updated feature ${saved.feature_name}`,
      metadata: { feature_key: saved.feature_key },
    });

    return saved;
  }

  async updateFeatureStatus(id: number, dto: UpdatePlatformFeatureStatusDto, user?: JwtPayload): Promise<PlatformFeature> {
    const feature = await this.getFeatureOrFail(id);
    feature.is_active = dto.is_active;
    feature.updated_by = resolveActorId(user) ?? feature.updated_by;
    const saved = await this.featureRepository.save(feature);

    await this.operationalAuditService.log({
      user,
      action: 'Update Platform Feature Status',
      entity: 'PlatformFeature',
      portal: 'Nexus',
      entityId: saved.id,
      details: `Feature ${saved.feature_name} moved to ${saved.is_active ? 'active' : 'inactive'}`,
      metadata: { feature_key: saved.feature_key, is_active: saved.is_active },
    });

    return saved;
  }

  async getPlanEntitlements(planId: number): Promise<any> {
    await this.ensureDefaultsReady();
    const plan = await this.getPlanOrFail(planId);
    const features = await this.featureRepository.find({ order: { feature_name: 'ASC' } });
    const mappings = await this.planFeatureRepository.find({
      where: { plan_id: planId },
      relations: ['feature'],
    });
    const enabledIds = new Set(
      mappings.filter((mapping) => mapping.is_enabled).map((mapping) => mapping.feature_id),
    );

    return {
      plan_id: plan.id,
      plan_name: plan.plan_name,
      feature_keys: features
        .filter((feature) => enabledIds.has(feature.id))
        .map((feature) => feature.feature_key),
      features: features.map((feature) => ({
        id: feature.id,
        feature_key: feature.feature_key,
        feature_name: feature.feature_name,
        description: feature.description,
        is_active: feature.is_active,
        is_enabled: enabledIds.has(feature.id),
      })),
    };
  }

  async updatePlanEntitlements(planId: number, dto: UpdatePlanEntitlementsDto, user?: JwtPayload): Promise<any> {
    await this.ensureDefaultsReady();
    const actorId = resolveActorId(user) ?? null;
    const plan = await this.getPlanOrFail(planId);
    const requestedKeys = await this.resolveRequestedPlanFeatureKeys(dto.feature_keys || []);
    await this.replacePlanFeatureMappings(planId, requestedKeys, actorId);
    plan.allowed_modules = requestedKeys.length ? requestedKeys : [];
    await this.planRepository.save(plan);

    await this.operationalAuditService.log({
      user,
      action: 'Update Plan Entitlements',
      entity: 'SubscriptionPlan',
      portal: 'Nexus',
      entityId: plan.id,
      details: `Updated feature entitlements for ${plan.plan_name}`,
      metadata: { feature_keys: requestedKeys },
    });

    return this.getPlanEntitlements(planId);
  }

  async getPlanLimits(planId: number): Promise<any> {
    const plan = await this.getPlanOrFail(planId);
    return {
      plan_id: plan.id,
      plan_name: plan.plan_name,
      limits: {
        max_branches: Number(plan.max_branches || 0),
        max_active_users: Number(plan.max_users || 0),
        max_pos_devices: Number((plan as any).max_pos_devices || 0),
      },
    };
  }

  async updatePlanLimits(planId: number, dto: UpdatePlanLimitsDto, user?: JwtPayload): Promise<any> {
    const plan = await this.getPlanOrFail(planId);
    if (dto.max_branches !== undefined) {
      plan.max_branches = Number(dto.max_branches);
    }
    if (dto.max_active_users !== undefined) {
      plan.max_users = Number(dto.max_active_users);
    }
    if (dto.max_pos_devices !== undefined) {
      (plan as any).max_pos_devices = Number(dto.max_pos_devices);
    }
    const saved = await this.planRepository.save(plan);

    await this.operationalAuditService.log({
      user,
      action: 'Update Plan Limits',
      entity: 'SubscriptionPlan',
      portal: 'Nexus',
      entityId: saved.id,
      details: `Updated limit caps for ${saved.plan_name}`,
      metadata: {
        max_branches: saved.max_branches,
        max_active_users: saved.max_users,
        max_pos_devices: (saved as any).max_pos_devices ?? 0,
      },
    });

    return this.getPlanLimits(planId);
  }

  async syncPlanAllowedModules(
    planId: number,
    allowedModules: string[] | null | undefined,
    actorId: string | null = 'system',
  ): Promise<void> {
    await this.ensureDefaultsReady();
    const requestedKeys = await this.resolveRequestedPlanFeatureKeys(allowedModules || []);
    await this.replacePlanFeatureMappings(planId, requestedKeys, actorId);
  }

  async getClientOverrides(clientId: string): Promise<any> {
    await this.ensureClientExists(clientId);
    const [featureOverrides, limitOverrides] = await Promise.all([
      this.clientFeatureOverrideRepository.find({
        where: { client_id: clientId },
        relations: ['feature'],
        order: { updated_at: 'DESC' },
      }),
      this.clientLimitOverrideRepository.find({
        where: { client_id: clientId },
        order: { updated_at: 'DESC' },
      }),
    ]);

    return {
      feature_overrides: featureOverrides.map((override) => ({
        id: override.id,
        feature_key: override.feature?.feature_key,
        feature_name: override.feature?.feature_name,
        is_enabled: override.is_enabled,
        reason: override.reason,
        notes: override.notes,
        updated_at: override.updated_at,
      })),
      limit_overrides: limitOverrides.map((override) => ({
        id: override.id,
        limit_key: override.limit_key,
        limit_value: override.limit_value,
        reason: override.reason,
        notes: override.notes,
        updated_at: override.updated_at,
      })),
    };
  }

  async upsertClientFeatureOverride(clientId: string, dto: UpsertClientFeatureOverrideDto, user?: JwtPayload): Promise<any> {
    await this.ensureDefaultsReady();
    await this.ensureClientExists(clientId);
    const actorId = resolveActorId(user) ?? null;
    const feature = await this.featureRepository.findOne({ where: { feature_key: dto.feature_key.trim().toLowerCase() } });
    if (!feature) {
      throw new NotFoundException('Platform feature not found');
    }

    const existing = await this.clientFeatureOverrideRepository.findOne({
      where: { client_id: clientId, feature_id: feature.id },
    });

    const override = existing ?? this.clientFeatureOverrideRepository.create({
      client_id: clientId,
      feature_id: feature.id,
      created_by: actorId,
    });

    override.is_enabled = dto.is_enabled;
    override.reason = dto.reason.trim();
    override.notes = dto.notes?.trim() || null;
    override.updated_by = actorId;
    const saved = await this.clientFeatureOverrideRepository.save(override);

    await this.operationalAuditService.log({
      user,
      action: 'Upsert Client Feature Override',
      entity: 'ClientFeatureOverride',
      clientId,
      entityId: saved.id,
      portal: 'Nexus',
      details: `Set ${feature.feature_key} override to ${dto.is_enabled ? 'enabled' : 'disabled'}`,
      metadata: { feature_key: feature.feature_key },
    });

    return this.getClientOverrides(clientId);
  }

  async removeClientFeatureOverride(clientId: string, featureKey: string, user?: JwtPayload): Promise<any> {
    await this.ensureClientExists(clientId);
    const feature = await this.featureRepository.findOne({ where: { feature_key: featureKey.trim().toLowerCase() } });
    if (!feature) {
      throw new NotFoundException('Platform feature not found');
    }
    await this.clientFeatureOverrideRepository.delete({ client_id: clientId, feature_id: feature.id });
    await this.operationalAuditService.log({
      user,
      action: 'Remove Client Feature Override',
      entity: 'ClientFeatureOverride',
      clientId,
      portal: 'Nexus',
      details: `Cleared feature override ${feature.feature_key}`,
      metadata: { feature_key: feature.feature_key },
    });
    return this.getClientOverrides(clientId);
  }

  async upsertClientLimitOverride(clientId: string, dto: UpsertClientLimitOverrideDto, user?: JwtPayload): Promise<any> {
    await this.ensureClientExists(clientId);
    const actorId = resolveActorId(user) ?? null;
    if (!CLIENT_LIMIT_KEYS.includes(dto.limit_key as ClientLimitKey)) {
      throw new BadRequestException('Unsupported limit key');
    }

    const existing = await this.clientLimitOverrideRepository.findOne({
      where: { client_id: clientId, limit_key: dto.limit_key as ClientLimitKey },
    });

    const override = existing ?? this.clientLimitOverrideRepository.create({
      client_id: clientId,
      limit_key: dto.limit_key as ClientLimitKey,
      created_by: actorId,
    });

    override.limit_value = Number(dto.limit_value);
    override.reason = dto.reason.trim();
    override.notes = dto.notes?.trim() || null;
    override.updated_by = actorId;
    const saved = await this.clientLimitOverrideRepository.save(override);

    await this.operationalAuditService.log({
      user,
      action: 'Upsert Client Limit Override',
      entity: 'ClientLimitOverride',
      clientId,
      entityId: saved.id,
      portal: 'Nexus',
      details: `Set ${saved.limit_key} override to ${saved.limit_value}`,
      metadata: { limit_key: saved.limit_key, limit_value: saved.limit_value },
    });

    return this.getClientOverrides(clientId);
  }

  async removeClientLimitOverride(clientId: string, limitKey: string, user?: JwtPayload): Promise<any> {
    await this.ensureClientExists(clientId);
    if (!CLIENT_LIMIT_KEYS.includes(limitKey as ClientLimitKey)) {
      throw new BadRequestException('Unsupported limit key');
    }
    await this.clientLimitOverrideRepository.delete({ client_id: clientId, limit_key: limitKey as ClientLimitKey });
    await this.operationalAuditService.log({
      user,
      action: 'Remove Client Limit Override',
      entity: 'ClientLimitOverride',
      clientId,
      portal: 'Nexus',
      details: `Cleared limit override ${limitKey}`,
      metadata: { limit_key: limitKey },
    });

    return this.getClientOverrides(clientId);
  }

  async getEffectiveEntitlements(clientId: string): Promise<ResolvedEntitlements> {
    await this.ensureDefaultsReady();
    const client = await this.clientRepository.findOne({
      where: buildClientLookupWhere(clientId),
      relations: ['subscription_plan'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const currentSubscription = await this.resolveCurrentSubscription(clientId);
    const activeFeatures = await this.featureRepository.find({
      where: { is_active: true },
      order: { feature_name: 'ASC' },
    });

    let baseFeatureKeys = await this.resolveBasePlanFeatureKeys(client, currentSubscription?.plan_id ?? null);
    const featureSources: Record<string, 'plan' | 'override_enabled' | 'override_disabled'> = {};
    for (const key of baseFeatureKeys) {
      featureSources[key] = 'plan';
    }

    const subscriptionStatus = currentSubscription?.status ?? null;
    const clientIsOperational = client.status === 'active';
    const governanceState = client.governance_state || 'normal';
    const subscriptionIsOperational =
      currentSubscription
        ? ACTIVE_SUBSCRIPTION_STATES.has(currentSubscription.status)
        : Boolean(client.subscription_plan_id || client.enabled_modules?.length);

    let blockingReason: string | null = null;
    if (['suspended', 'closure_pending', 'closed'].includes(governanceState)) {
      blockingReason = `Tenant governance is ${governanceState}`;
    } else if (!clientIsOperational) {
      blockingReason = `Client lifecycle is ${client.status}`;
    } else if (!subscriptionIsOperational) {
      blockingReason = subscriptionStatus
        ? `Subscription lifecycle is ${subscriptionStatus}`
        : 'Client has no active commercial subscription';
    }

    if (blockingReason) {
      baseFeatureKeys = [];
    }

    const featureOverrides = await this.clientFeatureOverrideRepository.find({
      where: { client_id: clientId },
      relations: ['feature'],
    });

    const effectiveFeatures = new Set(baseFeatureKeys);
    for (const override of featureOverrides) {
      const key = override.feature?.feature_key;
      if (!key) {
        continue;
      }
      if (override.is_enabled) {
        effectiveFeatures.add(key);
        featureSources[key] = 'override_enabled';
      } else {
        effectiveFeatures.delete(key);
        featureSources[key] = 'override_disabled';
      }
    }

    const baseLimits = this.resolveBaseLimits(client, currentSubscription);
    const limitOverrides = await this.clientLimitOverrideRepository.find({
      where: { client_id: clientId },
    });
    for (const override of limitOverrides) {
      if (override.limit_key === 'max_branches') {
        baseLimits.max_branches = override.limit_value;
      }
      if (override.limit_key === 'max_active_users') {
        baseLimits.max_active_users = override.limit_value;
      }
      if (override.limit_key === 'max_pos_devices') {
        baseLimits.max_pos_devices = override.limit_value;
      }
    }

    const usage = await this.resolveUsage(clientId);
    const warnings = this.buildWarnings(baseLimits, usage);
    if (currentSubscription?.status === 'grace') {
      const graceDate = currentSubscription.grace_end_at || currentSubscription.effective_end_at || null;
      warnings.unshift(
        graceDate
          ? `Subscription is in grace until ${graceDate.toISOString().slice(0, 10)}`
          : 'Subscription is currently operating in grace',
      );
    }
    if (governanceState === 'restricted') {
      warnings.unshift('Tenant governance is restricted: new writes are blocked platform-wide.');
    }

    return {
      client_id: clientId,
      client_status: client.status,
      governance_state: governanceState,
      subscription_status: subscriptionStatus,
      current_plan_id: currentSubscription?.plan_id ?? client.subscription_plan_id ?? null,
      current_plan_name: currentSubscription?.plan_name_snapshot ?? client.subscription_plan?.plan_name ?? null,
      is_operational: !blockingReason,
      blocking_reason: blockingReason,
      features: activeFeatures
        .map((feature) => feature.feature_key)
        .filter((key) => effectiveFeatures.has(key)),
      feature_sources: featureSources,
      limits: baseLimits,
      usage,
      warnings,
    };
  }

  async assertFeatureEnabled(clientId: string, featureKey: string, action: string): Promise<void> {
    const entitlements = await this.getEffectiveEntitlements(clientId);
    if (!entitlements.is_operational) {
      throw new ForbiddenException(entitlements.blocking_reason || 'Client is not commercially active');
    }
    if (!entitlements.features.includes(featureKey)) {
      throw new ForbiddenException(`Your subscription does not include ${action}`);
    }
  }

  async assertCanCreateBranch(clientId: string): Promise<void> {
    const entitlements = await this.getEffectiveEntitlements(clientId);
    if (!entitlements.is_operational) {
      throw new ForbiddenException(entitlements.blocking_reason || 'Client is not commercially active');
    }
    const limit = entitlements.limits.max_branches;
    if (limit !== null && entitlements.usage.max_branches >= limit) {
      throw new BadRequestException(`Branch limit reached (${limit}).`);
    }
  }

  async assertCanActivateBranch(clientId: string, branchId: number): Promise<void> {
    const branch = await this.branchRepository.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (BRANCH_LIMIT_STATUSES.includes(branch.status)) {
      return;
    }
    await this.assertCanCreateBranch(clientId);
  }

  async assertCanCreateActiveUser(clientId: string): Promise<void> {
    const entitlements = await this.getEffectiveEntitlements(clientId);
    if (!entitlements.is_operational) {
      throw new ForbiddenException(entitlements.blocking_reason || 'Client is not commercially active');
    }
    const limit = entitlements.limits.max_active_users;
    if (limit !== null && entitlements.usage.max_active_users >= limit) {
      throw new BadRequestException(`Active user limit reached (${limit}).`);
    }
  }

  async assertCanActivateUser(clientId: string, userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId, client_id: clientId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.is_active && user.status === 'active') {
      return;
    }
    await this.assertCanCreateActiveUser(clientId);
  }

  async assertCanRegisterPosDevice(clientId: string, deviceUid: string): Promise<void> {
    const existing = await this.posDeviceRepository.findOne({ where: { client_id: clientId, device_uid: deviceUid } });
    if (existing) {
      return;
    }

    const entitlements = await this.getEffectiveEntitlements(clientId);
    if (!entitlements.is_operational) {
      throw new ForbiddenException(entitlements.blocking_reason || 'Client is not commercially active');
    }
    const limit = entitlements.limits.max_pos_devices;
    if (limit !== null && entitlements.usage.max_pos_devices >= limit) {
      throw new BadRequestException(`POS device limit reached (${limit}).`);
    }
  }

  private async ensureDefaultsReady(): Promise<void> {
    const currentCount = await this.featureRepository.count();
    if (currentCount === 0) {
      await this.featureRepository.save(
        DEFAULT_FEATURES.map((feature) =>
          this.featureRepository.create({
            feature_key: feature.key,
            feature_name: feature.name,
            description: feature.description,
            is_active: true,
            created_by: 'system',
            updated_by: 'system',
          }),
        ),
      );
    }

    const features = await this.featureRepository.find();
    const featureMap = new Map(features.map((feature) => [feature.feature_key, feature]));
    const plans = await this.planRepository.find();

    for (const plan of plans) {
      const existingMappings = await this.planFeatureRepository.find({
        where: { plan_id: plan.id },
      });

      if (existingMappings.length === 0) {
        const enabledKeys = (plan.allowed_modules || []).includes('all')
          ? DEFAULT_FEATURES.map((feature) => feature.key)
          : (plan.allowed_modules || []).map((entry) => entry.toLowerCase());

        const rows = enabledKeys
          .map((key) => featureMap.get(key))
          .filter((feature): feature is PlatformFeature => Boolean(feature))
          .map((feature) =>
            this.planFeatureRepository.create({
              plan_id: plan.id,
              feature_id: feature.id,
              is_enabled: true,
              created_by: 'system',
              updated_by: 'system',
            }),
          );

        if (rows.length > 0) {
          await this.planFeatureRepository.save(rows);
        }
        continue;
      }

      if ((plan.allowed_modules || []).includes('all')) {
        const existingFeatureIds = new Set(existingMappings.map((mapping) => mapping.feature_id));
        const missingRows = features
          .filter((feature) => !existingFeatureIds.has(feature.id))
          .map((feature) =>
            this.planFeatureRepository.create({
              plan_id: plan.id,
              feature_id: feature.id,
              is_enabled: true,
              created_by: 'system',
              updated_by: 'system',
            }),
          );

        if (missingRows.length > 0) {
          await this.planFeatureRepository.save(missingRows);
        }
      }
    }
  }

  private async resolveRequestedPlanFeatureKeys(rawKeys: string[]): Promise<string[]> {
    const normalizedKeys = [...new Set((rawKeys || []).map((key) => key.trim().toLowerCase()).filter(Boolean))];
    if (normalizedKeys.includes('all')) {
      const activeFeatures = await this.featureRepository.find({
        where: { is_active: true },
        order: { feature_name: 'ASC' },
      });
      return activeFeatures.map((feature) => feature.feature_key);
    }

    const features = await this.featureRepository.find({
      where: normalizedKeys.length ? { feature_key: In(normalizedKeys) } : undefined,
      order: { feature_name: 'ASC' },
    });

    if (normalizedKeys.length !== features.length) {
      const foundKeys = new Set(features.map((feature) => feature.feature_key));
      const missing = normalizedKeys.filter((key) => !foundKeys.has(key));
      throw new BadRequestException(`Unknown feature key(s): ${missing.join(', ')}`);
    }

    return normalizedKeys;
  }

  private async replacePlanFeatureMappings(
    planId: number,
    requestedKeys: string[],
    actorId: string | null,
  ): Promise<void> {
    const features = await this.featureRepository.find({
      where: requestedKeys.length ? { feature_key: In(requestedKeys) } : undefined,
      order: { feature_name: 'ASC' },
    });

    await this.planFeatureRepository.delete({ plan_id: planId });
    if (features.length === 0) {
      return;
    }

    await this.planFeatureRepository.save(
      features.map((feature) =>
        this.planFeatureRepository.create({
          plan_id: planId,
          feature_id: feature.id,
          is_enabled: true,
          created_by: actorId,
          updated_by: actorId,
        }),
      ),
    );
  }

  private async syncWildcardPlanMappings(feature: PlatformFeature, actorId: string): Promise<void> {
    const wildcardPlans = await this.planRepository.find();
    const plansNeedingFeature = wildcardPlans.filter((plan) => (plan.allowed_modules || []).includes('all'));
    if (plansNeedingFeature.length === 0) {
      return;
    }

    for (const plan of plansNeedingFeature) {
      const existing = await this.planFeatureRepository.findOne({
        where: { plan_id: plan.id, feature_id: feature.id },
      });
      if (existing) {
        continue;
      }

      await this.planFeatureRepository.save(this.planFeatureRepository.create({
        plan_id: plan.id,
        feature_id: feature.id,
        is_enabled: true,
        created_by: actorId,
        updated_by: actorId,
      }));
    }
  }

  private async getFeatureOrFail(id: number): Promise<PlatformFeature> {
    const feature = await this.featureRepository.findOne({ where: { id } });
    if (!feature) {
      throw new NotFoundException('Platform feature not found');
    }
    return feature;
  }

  private async getPlanOrFail(planId: number): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  private async ensureClientExists(clientId: string): Promise<void> {
    const client = await this.clientRepository.findOne({
      where: buildClientLookupWhere(clientId),
      select: ['id'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private async resolveCurrentSubscription(clientId: string): Promise<ClientSubscription | null> {
    const subscriptions = await this.clientSubscriptionRepository.find({
      where: { client_id: clientId },
      relations: ['plan'],
      order: { effective_start_at: 'DESC', created_at: 'DESC' },
    });
    const statusPriority = ['active', 'grace', 'trial', 'suspended', 'pending'];
    for (const status of statusPriority) {
      const match = subscriptions.find((subscription) => subscription.status === status);
      if (match) {
        return match;
      }
    }
    return subscriptions[0] || null;
  }

  private async resolveBasePlanFeatureKeys(client: Client, planId: number | null): Promise<string[]> {
    if (planId) {
      const mappings = await this.planFeatureRepository.find({
        where: { plan_id: planId, is_enabled: true },
        relations: ['feature'],
      });
      if (mappings.length > 0) {
        return mappings
          .map((mapping) => mapping.feature?.feature_key)
          .filter((key): key is string => Boolean(key));
      }
    }

    if (client.subscription_plan?.allowed_modules?.length) {
      return client.subscription_plan.allowed_modules.includes('all')
        ? DEFAULT_FEATURES.map((feature) => feature.key)
        : client.subscription_plan.allowed_modules.map((entry) => entry.toLowerCase());
    }

    return client.enabled_modules?.includes('all')
      ? DEFAULT_FEATURES.map((feature) => feature.key)
      : (client.enabled_modules || []).map((entry) => entry.toLowerCase());
  }

  private resolveBaseLimits(client: Client, currentSubscription: ClientSubscription | null): EffectiveLimits {
    const plan = currentSubscription?.plan || client.subscription_plan || null;
    return {
      max_branches: Number(plan?.max_branches ?? client.max_branches ?? 0) || null,
      max_active_users: Number(plan?.max_users ?? client.max_users ?? 0) || null,
      max_pos_devices: Number((plan as any)?.max_pos_devices ?? 0) || null,
    };
  }

  private async resolveUsage(clientId: string): Promise<EffectiveUsage> {
    const [branchCount, activeUserCount, activeDeviceCount] = await Promise.all([
      this.branchRepository.count({
        where: BRANCH_LIMIT_STATUSES.map((status) => ({ client_id: clientId, status })),
      }),
      this.userRepository.count({
        where: { client_id: clientId, status: 'active', is_active: true } as any,
      }),
      this.posDeviceRepository.count({
        where: { client_id: clientId, status: 'active' } as any,
      }),
    ]);

    return {
      max_branches: branchCount,
      max_active_users: activeUserCount,
      max_pos_devices: activeDeviceCount,
    };
  }

  private buildWarnings(limits: EffectiveLimits, usage: EffectiveUsage): string[] {
    const warnings: string[] = [];
    for (const key of Object.keys(usage) as Array<keyof EffectiveUsage>) {
      const limit = limits[key as keyof EffectiveLimits];
      if (!limit || limit <= 0) {
        continue;
      }
      const used = usage[key];
      const ratio = used / limit;
      const label = this.getLimitLabel(key);
      if (ratio >= 1) {
        warnings.push(`${label} limit reached`);
      } else if (ratio >= 0.8) {
        warnings.push(`${label} is above 80% of plan limit`);
      }
    }
    return warnings;
  }

  private getLimitLabel(key: keyof EffectiveUsage): string {
    switch (key) {
      case 'max_branches':
        return 'Branch';
      case 'max_active_users':
        return 'Active user';
      case 'max_pos_devices':
        return 'POS device';
      default:
        return 'Usage';
    }
  }
}
