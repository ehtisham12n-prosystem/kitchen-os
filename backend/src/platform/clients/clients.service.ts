import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { buildClientLookupWhere, type ClientIdentifier } from '../client-lookup.util';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { UserBranchRole } from '../../setup/entities/user-branch-role.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { RolesService } from '../../setup/roles/roles.service';
import { UserManagementsService } from '../../setup/users/users.service';
import {
  createDefaultBranchDocumentSettings,
  createDefaultClientNumberingSettings,
  createDefaultBranchOperatingHours,
  createDefaultBranchOperationalSettings,
  createDefaultBranchTaxSettings,
} from '../../setup/branches/branch-config.types';
import { AuditService } from '../audit/audit.service';
import { OperationalAuditService } from '../audit/operational-audit.service';
import { ClientContact, CLIENT_CONTACT_TYPES, ClientContactType } from '../entities/client-contact.entity';
import { Client } from '../entities/client.entity';
import { ClientSettings } from '../entities/client-settings.entity';
import { ClientStatusHistory } from '../entities/client-status-history.entity';
import {
  ClientSubscription,
} from '../entities/client-subscription.entity';
import { ClientSubscriptionHistory } from '../entities/client-subscription-history.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { PlatformSettings } from '../entities/platform-settings.entity';
import { Blueprint } from '../entities/blueprint.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import {
  CLIENT_SUBSCRIPTION_BILLING_CYCLES,
  ClientSubscriptionStatus,
} from '../entities/client-subscription.constants';
import {
  AssignClientSubscriptionDto,
  UpdateClientSubscriptionStatusDto,
} from '../dto/client-subscription.dto';
import {
  ChangeClientStatusDto,
  ClientContactInputDto,
  ClientRegistryStatus,
  CreateClientRegistryDto,
  UpdateClientRegistryDto,
} from './dto/client-registry.dto';
import {
  type ClientBrandingAssetKey,
  UpdateClientBrandingDto,
} from './dto/client-branding.dto';

const REQUIRED_CONTACT_TYPES: ClientContactType[] = [
  'business_primary',
  'billing_primary',
  'operations_primary',
];

const LIVE_SUBSCRIPTION_STATUSES: ClientSubscriptionStatus[] = [
  'pending',
  'trial',
  'active',
  'grace',
  'suspended',
];

const ALLOWED_TRANSITIONS: Record<ClientRegistryStatus, ClientRegistryStatus[]> = {
  draft: ['onboarding', 'active', 'suspended', 'inactive', 'closed'],
  onboarding: ['active', 'suspended', 'inactive', 'closed'],
  active: ['suspended', 'inactive', 'closed'],
  suspended: ['active', 'inactive', 'closed'],
  inactive: ['onboarding', 'active', 'closed'],
  closed: [],
};

const ALLOWED_SUBSCRIPTION_TRANSITIONS: Record<ClientSubscriptionStatus, ClientSubscriptionStatus[]> = {
  pending: ['trial', 'active', 'cancelled'],
  trial: ['active', 'grace', 'suspended', 'expired', 'cancelled'],
  active: ['grace', 'suspended', 'expired', 'cancelled'],
  grace: ['active', 'suspended', 'expired', 'cancelled'],
  suspended: ['active', 'grace', 'expired', 'cancelled'],
  expired: [],
  cancelled: [],
};

interface ClientListFilters {
  name?: string;
  status?: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(ClientContact)
    private readonly contactRepository: Repository<ClientContact>,
    @InjectRepository(ClientStatusHistory)
    private readonly statusHistoryRepository: Repository<ClientStatusHistory>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(ClientSubscription)
    private readonly clientSubscriptionRepository: Repository<ClientSubscription>,
    @InjectRepository(ClientSubscriptionHistory)
    private readonly clientSubscriptionHistoryRepository: Repository<ClientSubscriptionHistory>,
    @InjectRepository(ClientOnboarding)
    private readonly clientOnboardingRepository: Repository<ClientOnboarding>,
    @InjectRepository(PlatformSettings)
    private readonly platformSettingsRepository: Repository<PlatformSettings>,
    @InjectRepository(Blueprint)
    private readonly blueprintRepository: Repository<Blueprint>,
    @InjectRepository(UserManagement)
    private readonly userRepository: Repository<UserManagement>,
    @InjectRepository(UserBranchRole)
    private readonly userBranchRoleRepository: Repository<UserBranchRole>,
    private readonly auditService: AuditService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly rolesService: RolesService,
    private readonly usersService: UserManagementsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(filters?: ClientListFilters): Promise<any[]> {
    const query = this.clientRepository.createQueryBuilder('client')
      .leftJoinAndSelect('client.contacts', 'contact')
      .leftJoinAndSelect('client.subscription_plan', 'subscription_plan')
      .orderBy('client.created_at', 'DESC');

    if (filters?.name) {
      query.andWhere(
        '(client.client_name LIKE :name OR client.legal_name LIKE :name OR client.domain_slug LIKE :name OR client.client_code LIKE :name)',
        { name: `%${filters.name}%` },
      );
    }

    if (filters?.status) {
      query.andWhere('client.status = :status', { status: filters.status });
    }

    const clients = await query.getMany();
    if (clients.length === 0) {
      return [];
    }

    const clientCodes = clients.map((client) => client.client_code);
    const [branchCounts, userCounts] = await Promise.all([
      this.branchRepository.createQueryBuilder('branch')
        .select('branch.client_id', 'client_id')
        .addSelect('COUNT(*)', 'branch_count')
        .where('branch.client_id IN (:...clientCodes)', { clientCodes })
        .groupBy('branch.client_id')
        .getRawMany<{ client_id: string; branch_count: string }>(),
      this.userRepository.createQueryBuilder('user')
        .select('user.client_id', 'client_id')
        .addSelect('COUNT(*)', 'user_count')
        .where('user.client_id IN (:...clientCodes)', { clientCodes })
        .groupBy('user.client_id')
        .getRawMany<{ client_id: string; user_count: string }>(),
    ]);

    const branchCountMap = new Map(branchCounts.map((row) => [row.client_id, Number(row.branch_count)]));
    const userCountMap = new Map(userCounts.map((row) => [row.client_id, Number(row.user_count)]));

    return clients.map((client) =>
      this.serializeClient(client, {
        branch_count: branchCountMap.get(client.client_code) ?? 0,
        user_count: userCountMap.get(client.client_code) ?? 0,
      }),
    );
  }

  async findOne(id: ClientIdentifier): Promise<any> {
    const client = await this.findOneInternal(id);
    const clientCode = client.client_code;
    const [userCount, statusHistory, clientAdmin] = await Promise.all([
      this.userRepository.count({ where: { client_id: clientCode } }),
      this.statusHistoryRepository.find({
        where: { client_id: clientCode },
        order: { created_at: 'DESC' },
        take: 5,
      }),
      this.getClientAdminUser(clientCode),
    ]);

    return {
      ...this.serializeClient(client, {
        branch_count: client.branches?.length ?? 0,
        user_count: userCount,
      }),
      branding: await this.getBrandingSnapshot(clientCode),
      client_admin: clientAdmin ? this.serializeClientAdmin(clientAdmin) : null,
      recent_status_history: statusHistory,
    };
  }

  async findBySlug(slug: string): Promise<any> {
    const client = await this.clientRepository.findOne({
      where: { domain_slug: slug },
      relations: ['branches'],
    });
    if (!client) {
      throw new NotFoundException(`Client with slug "${slug}" not found`);
    }

    const branding = await this.getBrandingSnapshot(client.client_code);
    const primaryBranch = [...(client.branches ?? [])].sort((left, right) => left.id - right.id)[0] ?? null;

    return {
      id: client.id,
      client_code: client.client_code,
      client_name: client.client_name,
      legal_name: client.legal_name,
      short_name: client.short_name,
      domain_slug: client.domain_slug,
      status: client.status,
      branch_count: client.branches?.length ?? 0,
      branches: (client.branches ?? []).map((branch) => ({
        id: branch.id,
        branch_name: branch.branch_name,
        address: branch.address ?? null,
        phone: branch.phone ?? null,
        status: branch.status,
      })),
      primary_branch: primaryBranch ? {
        id: primaryBranch.id,
        branch_name: primaryBranch.branch_name,
        address: primaryBranch.address ?? null,
        phone: primaryBranch.phone ?? null,
      } : null,
      branding: {
        full_logo_url: branding.full_logo_url,
        short_logo_url: branding.short_logo_url,
        login_background_url: branding.login_background_url,
        receipt_business_name: branding.receipt_business_name,
        show_login_full_logo: branding.show_login_full_logo,
        show_login_business_name: branding.show_login_business_name,
        show_login_branch_name: branding.show_login_branch_name,
      },
    };
  }

  async getBranding(id: ClientIdentifier): Promise<any> {
    const client = await this.findOneInternal(id);
    return this.getBrandingSnapshot(client.client_code);
  }

  async updateBranding(
    id: ClientIdentifier,
    dto: UpdateClientBrandingDto,
    user?: JwtPayload,
  ): Promise<any> {
    const client = await this.findOneInternal(id);
    const clientCode = client.client_code;
    const settings = await this.ensureClientSettings(clientCode);
    const actorId = resolveActorId(user);

    settings.receipt_business_name = this.normalizeOptionalString(dto.receipt_business_name, 150, settings.receipt_business_name);
    settings.receipt_footer_message_1 = this.normalizeOptionalString(dto.receipt_footer_message_1, 255, settings.receipt_footer_message_1);
    settings.receipt_footer_message_2 = this.normalizeOptionalString(dto.receipt_footer_message_2, 255, settings.receipt_footer_message_2);
    settings.show_receipt_full_logo = dto.show_receipt_full_logo ?? settings.show_receipt_full_logo ?? true;
    settings.show_receipt_short_logo = dto.show_receipt_short_logo ?? settings.show_receipt_short_logo ?? false;
    settings.show_receipt_business_name = dto.show_receipt_business_name ?? settings.show_receipt_business_name ?? true;
    settings.show_receipt_branch_name = dto.show_receipt_branch_name ?? settings.show_receipt_branch_name ?? true;
    settings.show_receipt_branch_address = dto.show_receipt_branch_address ?? settings.show_receipt_branch_address ?? true;
    settings.show_receipt_contact_number = dto.show_receipt_contact_number ?? settings.show_receipt_contact_number ?? true;
    settings.show_receipt_footer_message_1 = dto.show_receipt_footer_message_1 ?? settings.show_receipt_footer_message_1 ?? true;
    settings.show_receipt_footer_message_2 = dto.show_receipt_footer_message_2 ?? settings.show_receipt_footer_message_2 ?? false;
    settings.show_kot_full_logo = dto.show_kot_full_logo ?? settings.show_kot_full_logo ?? false;
    settings.show_kot_short_logo = dto.show_kot_short_logo ?? settings.show_kot_short_logo ?? false;
    settings.show_kot_business_name = dto.show_kot_business_name ?? settings.show_kot_business_name ?? true;
    settings.show_kot_branch_name = dto.show_kot_branch_name ?? settings.show_kot_branch_name ?? true;
    settings.show_kot_branch_address = dto.show_kot_branch_address ?? settings.show_kot_branch_address ?? false;
    settings.show_kot_contact_number = dto.show_kot_contact_number ?? settings.show_kot_contact_number ?? false;
    settings.show_kot_footer_message_1 = dto.show_kot_footer_message_1 ?? settings.show_kot_footer_message_1 ?? false;
    settings.show_kot_footer_message_2 = dto.show_kot_footer_message_2 ?? settings.show_kot_footer_message_2 ?? false;
    settings.show_login_full_logo = dto.show_login_full_logo ?? settings.show_login_full_logo ?? true;
    settings.show_login_business_name = dto.show_login_business_name ?? settings.show_login_business_name ?? true;
    settings.show_login_branch_name = dto.show_login_branch_name ?? settings.show_login_branch_name ?? true;
    settings.show_header_short_logo = dto.show_header_short_logo ?? settings.show_header_short_logo ?? true;
    settings.receipt_paper_size = dto.receipt_paper_size ?? settings.receipt_paper_size ?? 'thermal-80mm';
    settings.invoice_paper_size = dto.invoice_paper_size ?? settings.invoice_paper_size ?? 'a4';
    settings.kot_paper_size = dto.kot_paper_size ?? settings.kot_paper_size ?? 'thermal-80mm';
    settings.report_paper_size = dto.report_paper_size ?? settings.report_paper_size ?? 'a4';
    settings.receipt_print_copies = Number(dto.receipt_print_copies ?? settings.receipt_print_copies ?? 1);
    settings.invoice_print_copies = Number(dto.invoice_print_copies ?? settings.invoice_print_copies ?? 1);
    settings.kot_print_copies = Number(dto.kot_print_copies ?? settings.kot_print_copies ?? 1);
    settings.kot_print_enabled = dto.kot_print_enabled ?? settings.kot_print_enabled ?? true;
    settings.report_print_copies = Number(dto.report_print_copies ?? settings.report_print_copies ?? 1);
    settings.order_change_print_mode = dto.order_change_print_mode ?? settings.order_change_print_mode ?? 'change_only';
    settings.order_change_print_copies = Number(dto.order_change_print_copies ?? settings.order_change_print_copies ?? 1);
    settings.enable_station_wise_kot_printing = dto.enable_station_wise_kot_printing ?? settings.enable_station_wise_kot_printing ?? false;
    settings.allow_multiple_kot_per_station = dto.allow_multiple_kot_per_station ?? settings.allow_multiple_kot_per_station ?? false;
    settings.service_station_print_copies = dto.service_station_print_copies ?? settings.service_station_print_copies ?? null;
    settings.station_printer_mapping = dto.station_printer_mapping ?? settings.station_printer_mapping ?? null;
    settings.separate_kot_stations = Array.isArray(dto.separate_kot_stations)
      ? dto.separate_kot_stations.map((value) => String(value || '').trim()).filter(Boolean)
      : settings.separate_kot_stations ?? null;
    if (dto.numbering_settings) {
      settings.numbering_settings = {
        ...createDefaultClientNumberingSettings(),
        ...(settings.numbering_settings || {}),
        ...dto.numbering_settings,
        rules: {
          ...createDefaultBranchDocumentSettings(),
          ...(settings.numbering_settings?.rules || {}),
          ...((dto.numbering_settings as Record<string, any>)?.rules || {}),
        },
      };
    }

    await this.clientRepository.update({ id: client.id }, {
      updated_by: this.toNumericActorId(actorId) as any,
    });
    await this.clientRepository.manager.save(ClientSettings, settings);

    return this.getBrandingSnapshot(clientCode);
  }

  async uploadBrandingAsset(
    id: ClientIdentifier,
    assetKey: ClientBrandingAssetKey,
    file: any,
    user?: JwtPayload,
  ): Promise<any> {
    const client = await this.findOneInternal(id);
    if (!file?.buffer || !file?.mimetype || !file?.originalname) {
      throw new BadRequestException('Branding asset file is required.');
    }
    if (!String(file.mimetype).startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported for branding assets.');
    }
    if (Number(file.size || 0) > 5 * 1024 * 1024) {
      throw new BadRequestException('Branding assets must be 5MB or smaller.');
    }

    const settings = await this.ensureClientSettings(client.client_code);
    const extension = path.extname(String(file.originalname)).toLowerCase() || this.extensionFromMime(String(file.mimetype));
    const uploadsDir = path.join(process.cwd(), 'uploads', 'client-branding');
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${client.client_code}-${assetKey}-${Date.now()}${extension}`;
    const absolutePath = path.join(uploadsDir, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const publicPath = `/uploads/client-branding/${fileName}`;
    if (assetKey === 'full_logo') {
      await this.deleteManagedBrandingAsset(settings.logo_url);
      settings.logo_url = publicPath;
    }
    if (assetKey === 'short_logo') {
      await this.deleteManagedBrandingAsset(settings.short_logo_url);
      settings.short_logo_url = publicPath;
    }
    if (assetKey === 'login_background') {
      await this.deleteManagedBrandingAsset(settings.login_background_url);
      settings.login_background_url = publicPath;
    }

    await this.clientRepository.manager.save(ClientSettings, settings);
    return this.getBrandingSnapshot(client.client_code);
  }

  async create(dto: CreateClientRegistryDto, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const numericActorId = this.toNumericActorId(actorId);
    if (dto.status && dto.status !== 'draft') {
      throw new BadRequestException('New clients must start in draft status and move through onboarding');
    }
    const normalizedSlug = this.normalizeSlug(dto.domain_slug);
    await this.ensureSlugAvailable(normalizedSlug);
    const onboardingBlueprintCode = await this.resolveOnboardingBlueprintCode(dto.onboarding_blueprint);
    const contacts = this.normalizeContacts(dto.contacts);
    const initialPlan = dto.subscription_plan_id
      ? await this.resolveInitialSubscriptionPlan(dto.subscription_plan_id)
      : null;
    const initialBillingCycle = initialPlan
      ? dto.subscription_billing_cycle || 'monthly'
      : null;
    const identifiers = await this.generateIdentifiers();
    const savedClient = await this.dataSource.transaction(async (manager) => {
      const client = manager.create(Client, {
        client_code: identifiers.clientCode,
        legal_name: dto.legal_name?.trim() || dto.client_name.trim(),
        client_name: dto.client_name.trim(),
        short_name: dto.short_name?.trim() || dto.client_name.trim().slice(0, 50),
        domain_slug: normalizedSlug,
        business_type: dto.business_type?.trim() || 'restaurant',
        address: dto.address?.trim() || null,
        area: dto.area?.trim() || null,
        city: dto.city?.trim() || null,
        country: dto.country?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        cell_phone: dto.cell_phone?.trim() || null,
        website_url: dto.website_url?.trim() || null,
        currency: dto.currency?.trim() || 'USD',
        language: dto.language?.trim() || 'en',
        timezone: dto.timezone?.trim() || 'UTC',
        comments: dto.comments?.trim() || null,
        renewal_day: dto.renewal_day ?? null,
        renewal_date: dto.renewal_date?.trim() || null,
        grace_period_days: Number(dto.grace_period_days || 0),
        onboarding_blueprint: onboardingBlueprintCode,
        status: 'draft',
        created_by: numericActorId as any,
        updated_by: numericActorId as any,
      } as Partial<Client>);

      const createdClient = await manager.save(Client, client);
      await manager.save(ClientSettings, manager.create(ClientSettings, {
        client_id: createdClient.client_code,
        currency: createdClient.currency || 'USD',
        timezone: createdClient.timezone || 'UTC',
        contact_email: createdClient.email || null,
        contact_phone: createdClient.phone || null,
        address: createdClient.address || null,
        numbering_settings: createDefaultClientNumberingSettings(),
      } as Partial<ClientSettings>));

      await this.syncContacts(createdClient.client_code, contacts, actorId, manager.getRepository(ClientContact));
      await manager.save(ClientStatusHistory, manager.create(ClientStatusHistory, {
        client_id: createdClient.client_code,
        from_status: null,
        to_status: 'draft',
        reason: 'Client registry created',
        notes: null,
        changed_by: actorId ?? null,
      }));

      if (dto.initial_branch) {
        const branchRepository = manager.getRepository(Branch);
        const branchCode = await this.generateBranchCode(createdClient.client_code, branchRepository);
        const openingTime = dto.initial_branch.opening_time?.trim()
          ? `${dto.initial_branch.opening_time.trim()}:00`
          : '09:00:00';
        const closingTime = dto.initial_branch.closing_time?.trim()
          ? `${dto.initial_branch.closing_time.trim()}:00`
          : '23:00:00';
        const allowedModules = this.normalizeModuleList(initialPlan?.allowed_modules || []);

        await branchRepository.save(branchRepository.create({
          client_id: createdClient.client_code,
          branch_code: this.normalizeBranchCode(branchCode) || branchCode,
          branch_name: dto.initial_branch.branch_name.trim(),
          short_name: dto.initial_branch.short_name?.trim() || dto.initial_branch.branch_name.trim().slice(0, 50),
          address: dto.initial_branch.address?.trim() || createdClient.address || null,
          city: dto.initial_branch.city?.trim() || createdClient.city || null,
          state: dto.initial_branch.state?.trim() || null,
          country: dto.initial_branch.country?.trim() || createdClient.country || null,
          contact_person: dto.initial_branch.contact_person?.trim() || null,
          phone: dto.initial_branch.phone?.trim() || createdClient.phone || null,
          email: dto.initial_branch.email?.trim() || createdClient.email || null,
          inventory_store_type: 'branch',
          is_production_source: false,
          production_source_label: null,
          modules_enabled: allowedModules,
          opening_time: openingTime,
          closing_time: closingTime,
          operating_hours: createDefaultBranchOperatingHours(openingTime, closingTime),
          document_settings: createDefaultBranchDocumentSettings(),
          tax_settings: createDefaultBranchTaxSettings(null),
          operational_settings: createDefaultBranchOperationalSettings(),
          tax_region: undefined,
          inherit_client_currency: false,
          inherit_client_language: true,
          inherit_client_theme: true,
          currency_code: createdClient.currency || 'USD',
          date_format: 'MMM DD, YYYY',
          time_format: 'hh:mma',
          language: createdClient.language || 'en',
          theme_id: undefined,
          status: 'setup_pending',
          is_active: false,
          created_by: actorId ?? undefined,
          updated_by: actorId ?? undefined,
        } as Partial<Branch>));
      }

      if (initialPlan && initialBillingCycle) {
        const now = new Date();
        const priceSnapshot = initialBillingCycle === 'annual'
          ? Number(initialPlan.annual_price || 0)
          : Number(initialPlan.monthly_price || 0);
        const subscriptionRepository = manager.getRepository(ClientSubscription);
        const subscriptionHistoryRepository = manager.getRepository(ClientSubscriptionHistory);
        const createdSubscription = await subscriptionRepository.save(subscriptionRepository.create({
          client_id: createdClient.client_code,
          plan_id: initialPlan.id,
          plan_code_snapshot: initialPlan.plan_code,
          plan_name_snapshot: initialPlan.plan_name,
          plan_description_snapshot: initialPlan.description || null,
          currency_code_snapshot: initialPlan.currency_code || createdClient.currency || 'PKR',
          billing_cycle: initialBillingCycle,
          status: 'active',
          is_trial: false,
          effective_start_at: now,
          effective_end_at: null,
          activated_at: now,
          price_snapshot: priceSnapshot,
          assignment_reason: 'Initial subscription assigned during client registry creation.',
          assignment_notes: 'Subscription selected from the Nexus client creation flow.',
          created_by: actorId ?? null,
          updated_by: actorId ?? null,
        }));

        await subscriptionHistoryRepository.save(subscriptionHistoryRepository.create({
          subscription_id: createdSubscription.id,
          client_id: createdClient.client_code,
          action_type: 'assigned',
          from_status: null,
          to_status: 'active',
          from_plan_id: null,
          to_plan_id: initialPlan.id,
          from_plan_name: null,
          to_plan_name: initialPlan.plan_name,
          billing_cycle: initialBillingCycle,
          price_snapshot: priceSnapshot,
          reason: 'Initial subscription assigned during client registry creation.',
          notes: 'Subscription selected from the Nexus client creation flow.',
          changed_by: actorId ?? null,
        }));
      }

      return createdClient;
    });

    if (initialPlan) {
      await this.syncClientSubscriptionSnapshot(savedClient.client_code);
    }

    await this.rolesService.ensureDefaultRoles(savedClient.client_code);
    if (dto.admin_user) {
      await this.upsertClientAdmin(savedClient.client_code, dto.admin_user);
    }

    await this.operationalAuditService.log({
      user,
      action: 'Create Client',
      entity: 'Client',
      clientId: savedClient.client_code,
      entityId: savedClient.id,
      portal: 'Nexus',
      details: `Created client ${savedClient.client_name}`,
      metadata: {
        domain_slug: savedClient.domain_slug,
        client_code: savedClient.client_code,
        subscription_plan_id: initialPlan?.id ?? null,
        subscription_billing_cycle: initialBillingCycle,
      },
      diff: [
        { field: 'status', oldValue: null, newValue: savedClient.status },
      ],
    });

    return this.findOne(savedClient.id);
  }

  async update(id: string, dto: UpdateClientRegistryDto, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const numericActorId = this.toNumericActorId(actorId);
    const client = await this.findOneInternal(id);
    const before = this.snapshotClient(client);
    const onboardingBlueprintCode = dto.onboarding_blueprint !== undefined
      ? await this.resolveOnboardingBlueprintCode(dto.onboarding_blueprint)
      : client.onboarding_blueprint;
    const contacts = dto.contacts ? this.normalizeContacts(dto.contacts) : null;

    Object.assign(client, {
      legal_name: dto.legal_name !== undefined ? dto.legal_name?.trim() || null : client.legal_name,
      client_name: dto.client_name !== undefined ? dto.client_name.trim() : client.client_name,
      short_name: dto.short_name !== undefined ? dto.short_name?.trim() || null : client.short_name,
      business_type: dto.business_type !== undefined ? dto.business_type?.trim() || null : client.business_type,
      address: dto.address !== undefined ? dto.address?.trim() || null : client.address,
      area: dto.area !== undefined ? dto.area?.trim() || null : client.area,
      city: dto.city !== undefined ? dto.city?.trim() || null : client.city,
      country: dto.country !== undefined ? dto.country?.trim() || null : client.country,
      phone: dto.phone !== undefined ? dto.phone?.trim() || null : client.phone,
      email: dto.email !== undefined ? dto.email?.trim() || null : client.email,
      cell_phone: dto.cell_phone !== undefined ? dto.cell_phone?.trim() || null : client.cell_phone,
      website_url: dto.website_url !== undefined ? dto.website_url?.trim() || null : client.website_url,
      currency: dto.currency !== undefined ? dto.currency?.trim() || 'USD' : client.currency,
      language: dto.language !== undefined ? dto.language?.trim() || 'en' : client.language,
      timezone: dto.timezone !== undefined ? dto.timezone?.trim() || 'UTC' : client.timezone,
      comments: dto.comments !== undefined ? dto.comments?.trim() || null : client.comments,
      renewal_day: dto.renewal_day !== undefined ? dto.renewal_day ?? null : client.renewal_day,
      renewal_date: dto.renewal_date !== undefined ? dto.renewal_date?.trim() || null : client.renewal_date,
      grace_period_days: dto.grace_period_days !== undefined ? Number(dto.grace_period_days || 0) : client.grace_period_days,
      onboarding_blueprint: onboardingBlueprintCode,
      updated_by: numericActorId as any,
    });

    await this.clientRepository.save(client);
    const clientCode = client.client_code;
    if (dto.admin_user) {
      await this.upsertClientAdmin(clientCode, dto.admin_user);
    }
    if (dto.initial_branch) {
      await this.upsertInitialBranch(client, dto.initial_branch, actorId);
    }
    const contactDiffs = contacts ? await this.syncContacts(clientCode, contacts, actorId) : [];
    const fieldDiffs = this.buildDiff(before, this.snapshotClient(client));
    const allDiffs = [...fieldDiffs, ...contactDiffs];

    if (allDiffs.length > 0) {
      await this.operationalAuditService.log({
        user,
        action: 'Update Client',
        entity: 'Client',
        clientId: clientCode,
        entityId: clientCode,
        portal: 'Nexus',
        details: `Updated client ${client.client_name}`,
        diff: allDiffs,
      });
    }

    return this.findOne(clientCode);
  }

  async changeStatus(id: string, dto: ChangeClientStatusDto, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const numericActorId = this.toNumericActorId(actorId);
    const client = await this.findOneInternal(id);
    const fromStatus = client.status as ClientRegistryStatus;
    const toStatus = dto.status;
    const governanceState = client.governance_state || 'normal';

    if (fromStatus === toStatus) {
      throw new BadRequestException(`Client is already ${toStatus}`);
    }

    const allowedTransitions = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowedTransitions.includes(toStatus)) {
      throw new BadRequestException(`Transition from ${fromStatus} to ${toStatus} is not allowed`);
    }

    if (toStatus === 'active' && ['suspended', 'closure_pending', 'closed'].includes(governanceState)) {
      throw new BadRequestException(
        `Client cannot move to active while governance state is ${governanceState}`,
      );
    }

    if (toStatus === 'closed' && !['closure_pending', 'closed'].includes(governanceState)) {
      throw new BadRequestException(
        'Client must be placed into closure_pending governance before lifecycle closure',
      );
    }

    if (toStatus === 'active' && fromStatus !== 'active') {
      const latestOnboarding = await this.clientOnboardingRepository.findOne({
        where: { client_id: client.client_code },
        order: { created_at: 'DESC', id: 'DESC' },
      });
      if (!latestOnboarding || latestOnboarding.status !== 'completed') {
        throw new BadRequestException('Client activation must be completed through the onboarding workflow');
      }
    }

    client.status = toStatus;
    client.updated_by = numericActorId as any;
    await this.clientRepository.save(client);
    const clientCode = client.client_code;
    await this.recordStatusTransition(clientCode, fromStatus, toStatus, dto.reason, dto.notes || null, actorId);

    await this.operationalAuditService.log({
      user,
      action: 'Status Update',
      entity: 'Client',
      clientId: clientCode,
      entityId: clientCode,
      portal: 'Nexus',
      details: `Client moved from ${fromStatus} to ${toStatus}`,
      metadata: {
        reason: dto.reason,
        notes: dto.notes ?? null,
      },
      diff: [
        { field: 'status', oldValue: fromStatus, newValue: toStatus },
      ],
    });

    return this.findOne(clientCode);
  }

  async getStatusHistory(id: string): Promise<ClientStatusHistory[]> {
    const client = await this.findOneInternal(id);
    return this.statusHistoryRepository.find({
      where: { client_id: client.client_code },
      order: { created_at: 'DESC' },
    });
  }

  async getCurrentSubscription(id: string): Promise<any | null> {
    const client = await this.findOneInternal(id);
    const subscriptions = await this.clientSubscriptionRepository.find({
      where: { client_id: client.client_code },
      relations: ['plan'],
      order: {
        effective_start_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const current = this.resolveCurrentSubscription(subscriptions);
    return current ? this.serializeSubscription(current) : null;
  }

  async getSubscriptionSummary(id: string): Promise<any> {
    const client = await this.clientRepository.findOne({
      where: buildClientLookupWhere(id),
      relations: ['subscription_plan'],
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    const clientCode = client.client_code;

    const [branchCount, userCount, subscriptions, platformSettings] = await Promise.all([
      this.branchRepository.count({ where: { client_id: clientCode } as any }),
      this.userRepository.count({ where: { client_id: clientCode, is_active: true } as any }),
      this.clientSubscriptionRepository.find({
        where: { client_id: clientCode },
        relations: ['plan'],
        order: {
          effective_start_at: 'DESC',
          created_at: 'DESC',
        },
      }),
      this.platformSettingsRepository.findOne({ where: { id: 1 } }),
    ]);

    const current = this.resolveCurrentSubscription(subscriptions);
    const activePlan = current?.plan || client.subscription_plan || null;
    const features = activePlan?.allowed_modules?.length
      ? activePlan.allowed_modules
      : client.enabled_modules || [];

    return {
      client_id: client.id,
      client_code: client.client_code,
      client_name: client.client_name,
      client_status: client.status,
      renewal_day: client.renewal_day,
      renewal_date: client.renewal_date,
      grace_period_days: client.grace_period_days,
      current_subscription: current ? this.serializeSubscription(current) : null,
      features,
      limits: {
        max_branches: Number(activePlan?.max_branches ?? client.max_branches ?? 0) || null,
        max_active_users: Number(activePlan?.max_users ?? client.max_users ?? 0) || null,
        max_pos_devices: Number((activePlan as any)?.max_pos_devices ?? 0) || null,
      },
      usage: {
        max_branches: branchCount,
        max_active_users: userCount,
      },
      renewal_contact_name: platformSettings?.renewal_contact_name || null,
      renewal_contact_email: platformSettings?.renewal_contact_email || null,
      renewal_contact_phone: platformSettings?.renewal_contact_phone || null,
      platform_contact_email: platformSettings?.contact_email || null,
      platform_contact_phone: platformSettings?.contact_phone || null,
    };
  }

  async getSubscriptions(id: string): Promise<any[]> {
    const client = await this.findOneInternal(id);
    const subscriptions = await this.clientSubscriptionRepository.find({
      where: { client_id: client.client_code },
      relations: ['plan'],
      order: {
        effective_start_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const subscriptionIds = subscriptions.map((subscription) => subscription.id);
    const histories = subscriptionIds.length
      ? await this.clientSubscriptionHistoryRepository.find({
          where: subscriptionIds.map((subscriptionId) => ({ subscription_id: subscriptionId })),
          order: { created_at: 'DESC' },
        })
      : [];

    const historyMap = new Map<number, ClientSubscriptionHistory[]>();
    for (const history of histories) {
      const entries = historyMap.get(history.subscription_id) || [];
      entries.push(history);
      historyMap.set(history.subscription_id, entries);
    }

    return subscriptions.map((subscription) => ({
      ...this.serializeSubscription(subscription),
      history: (historyMap.get(subscription.id) || []).map((entry) => this.serializeSubscriptionHistory(entry)),
    }));
  }

  async assignSubscription(
    clientId: string,
    dto: AssignClientSubscriptionDto,
    user?: JwtPayload,
  ): Promise<any> {
    const actorId = resolveActorId(user);
    const client = await this.findOneInternal(clientId);
    const clientCode = client.client_code;
    const plan = await this.planRepository.findOne({ where: { id: dto.plan_id } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (plan.plan_status !== 'active') {
      throw new BadRequestException('Only active plans can be assigned to clients');
    }
    if (!CLIENT_SUBSCRIPTION_BILLING_CYCLES.includes(dto.billing_cycle)) {
      throw new BadRequestException('Unsupported billing cycle');
    }

    const now = new Date();
    const effectiveStartAt = dto.effective_start_at ? new Date(dto.effective_start_at) : now;
    if (Number.isNaN(effectiveStartAt.getTime())) {
      throw new BadRequestException('Invalid effective start date');
    }

    const effectiveEndAt = dto.effective_end_at ? new Date(dto.effective_end_at) : null;
    if (effectiveEndAt && Number.isNaN(effectiveEndAt.getTime())) {
      throw new BadRequestException('Invalid effective end date');
    }
    if (effectiveEndAt && effectiveEndAt <= effectiveStartAt) {
      throw new BadRequestException('Effective end date must be after the effective start date');
    }

    const useTrial = Boolean(dto.use_trial);
    if (useTrial && !plan.trial_enabled) {
      throw new BadRequestException('This plan is not configured for trials');
    }

    let trialStartAt: Date | null = null;
    let trialEndAt: Date | null = null;
    if (useTrial) {
      trialStartAt = effectiveStartAt;
      if (dto.trial_end_at) {
        trialEndAt = new Date(dto.trial_end_at);
      } else {
        const trialDays = Number(dto.trial_days || plan.default_trial_days || 0);
        if (trialDays <= 0) {
          throw new BadRequestException('Trial assignments require trial days or a trial end date');
        }
        trialEndAt = new Date(effectiveStartAt);
        trialEndAt.setDate(trialEndAt.getDate() + trialDays);
      }
      if (Number.isNaN(trialEndAt.getTime()) || trialEndAt <= trialStartAt) {
        throw new BadRequestException('Trial end date must be after the trial start date');
      }
    }

    const existingSubscriptions = await this.clientSubscriptionRepository.find({
      where: { client_id: clientCode },
      relations: ['plan'],
      order: {
        effective_start_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const isFutureAssignment = effectiveStartAt.getTime() > now.getTime();
    const pendingSubscription = existingSubscriptions.find((subscription) => subscription.status === 'pending');
    if (isFutureAssignment && pendingSubscription) {
      throw new BadRequestException('Client already has a pending subscription assignment');
    }

    if (!isFutureAssignment) {
      for (const subscription of existingSubscriptions.filter((record) => LIVE_SUBSCRIPTION_STATUSES.includes(record.status))) {
        await this.replaceSubscription(subscription, actorId, `Superseded by ${plan.plan_name}`, dto.reason);
      }
    }

    const status: ClientSubscriptionStatus = isFutureAssignment
      ? 'pending'
      : useTrial
        ? 'trial'
        : 'active';

    const priceSnapshot = dto.billing_cycle === 'annual'
      ? Number(plan.annual_price || 0)
      : Number(plan.monthly_price || 0);

    const subscription = this.clientSubscriptionRepository.create({
      client_id: clientCode,
      plan_id: plan.id,
      plan_code_snapshot: plan.plan_code,
      plan_name_snapshot: plan.plan_name,
      plan_description_snapshot: plan.description || null,
      currency_code_snapshot: plan.currency_code || client.currency || 'PKR',
      billing_cycle: dto.billing_cycle,
      status,
      is_trial: useTrial,
      trial_start_at: trialStartAt,
      trial_end_at: trialEndAt,
      effective_start_at: effectiveStartAt,
      effective_end_at: effectiveEndAt,
      activated_at: status === 'active' || status === 'trial' ? now : null,
      price_snapshot: priceSnapshot,
      assignment_reason: dto.reason.trim(),
      assignment_notes: dto.notes?.trim() || null,
      created_by: actorId ?? null,
      updated_by: actorId ?? null,
    });

    const savedSubscription = await this.clientSubscriptionRepository.save(subscription);
    await this.recordSubscriptionHistory({
      subscription_id: savedSubscription.id,
      client_id: clientCode,
      action_type: status === 'pending' ? 'scheduled' : 'assigned',
      from_status: null,
      to_status: status,
      from_plan_id: null,
      to_plan_id: plan.id,
      from_plan_name: null,
      to_plan_name: plan.plan_name,
      billing_cycle: dto.billing_cycle,
      price_snapshot: priceSnapshot,
      reason: dto.reason.trim(),
      notes: dto.notes?.trim() || null,
      changed_by: actorId ?? null,
    });

    await this.syncClientSubscriptionSnapshot(clientCode);
    await this.operationalAuditService.log({
      user,
      action: 'Assign Subscription Plan',
      entity: 'ClientSubscription',
      clientId: clientCode,
      entityId: savedSubscription.id,
      portal: 'Nexus',
      details: `Assigned ${plan.plan_name} to ${client.client_name}`,
      metadata: {
        plan_id: plan.id,
        plan_code: plan.plan_code,
        status,
        billing_cycle: dto.billing_cycle,
      },
      diff: [
        { field: 'plan_id', oldValue: null, newValue: plan.id },
        { field: 'subscription_status', oldValue: null, newValue: status },
      ],
    });

    return {
      current_subscription: await this.getCurrentSubscription(clientCode),
      subscriptions: await this.getSubscriptions(clientCode),
    };
  }

  async updateSubscriptionStatus(
    clientId: string,
    subscriptionId: number,
    dto: UpdateClientSubscriptionStatusDto,
    user?: JwtPayload,
  ): Promise<any> {
    const client = await this.findOneInternal(clientId);
    const clientCode = client.client_code;
    const actorId = resolveActorId(user);
    const subscription = await this.clientSubscriptionRepository.findOne({
      where: { id: subscriptionId, client_id: clientCode },
      relations: ['plan'],
    });
    if (!subscription) {
      throw new NotFoundException('Client subscription not found');
    }

    const allowedTransitions = ALLOWED_SUBSCRIPTION_TRANSITIONS[subscription.status] || [];
    if (subscription.status === dto.status) {
      throw new BadRequestException(`Subscription is already ${dto.status}`);
    }
    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(`Transition from ${subscription.status} to ${dto.status} is not allowed`);
    }
    if (dto.status === 'trial' && !subscription.is_trial) {
      throw new BadRequestException('Only trial subscriptions can move into trial state');
    }

    if (dto.status === 'active' || dto.status === 'trial') {
      const otherLiveSubscriptions = await this.clientSubscriptionRepository.find({
        where: { client_id: clientCode },
      });
      for (const record of otherLiveSubscriptions) {
        if (record.id !== subscription.id && LIVE_SUBSCRIPTION_STATUSES.includes(record.status)) {
          await this.replaceSubscription(record, actorId, `Superseded by subscription ${subscription.id}`, dto.reason);
        }
      }
    }

    const previousStatus = subscription.status;
    const now = new Date();
    subscription.status = dto.status;
    subscription.updated_by = actorId ?? null;

    if (dto.status === 'active') {
      subscription.activated_at = now;
      subscription.suspended_at = null;
      subscription.expired_at = null;
      subscription.grace_start_at = null;
      subscription.grace_end_at = null;
    }
    if (dto.status === 'grace') {
      const graceEndAt = await this.resolveGraceEndAt(client, now, dto.grace_days, dto.grace_end_at);
      subscription.grace_start_at = now;
      subscription.grace_end_at = graceEndAt;
      subscription.suspended_at = null;
      subscription.expired_at = null;
      subscription.effective_end_at = subscription.effective_end_at || subscription.trial_end_at || now;
    }
    if (dto.status === 'suspended') {
      subscription.suspended_at = now;
    }
    if (dto.status === 'expired') {
      subscription.expired_at = now;
      subscription.effective_end_at = subscription.effective_end_at || subscription.grace_end_at || now;
    }
    if (dto.status === 'cancelled') {
      subscription.cancelled_at = now;
      subscription.effective_end_at = subscription.effective_end_at || subscription.grace_end_at || now;
    }

    const savedSubscription = await this.clientSubscriptionRepository.save(subscription);
    await this.recordSubscriptionHistory({
      subscription_id: subscription.id,
      client_id: clientCode,
      action_type: 'status_changed',
      from_status: previousStatus,
      to_status: dto.status,
      from_plan_id: subscription.plan_id,
      to_plan_id: subscription.plan_id,
      from_plan_name: subscription.plan_name_snapshot,
      to_plan_name: subscription.plan_name_snapshot,
      billing_cycle: subscription.billing_cycle,
      price_snapshot: Number(subscription.price_snapshot || 0),
      reason: dto.reason.trim(),
      notes: dto.notes?.trim() || null,
      changed_by: actorId ?? null,
    });

    await this.syncClientSubscriptionSnapshot(clientCode);
    await this.operationalAuditService.log({
      user,
      action: 'Update Subscription Status',
      entity: 'ClientSubscription',
      clientId: clientCode,
      entityId: subscription.id,
      portal: 'Nexus',
      details: `Subscription ${subscription.id} moved from ${previousStatus} to ${dto.status}`,
      metadata: {
        plan_id: subscription.plan_id,
        plan_code: subscription.plan_code_snapshot,
      },
      diff: [
        { field: 'subscription_status', oldValue: previousStatus, newValue: dto.status },
      ],
    });

    return this.serializeSubscription(savedSubscription);
  }

  async getAuditHistory(id: string, limit: number = 50) {
    const client = await this.findOneInternal(id);
    return this.auditService.findByClientId(client.client_code, limit);
  }

  async getTenantInspection(id: string): Promise<any> {
    const client = await this.clientRepository.findOne({
      where: buildClientLookupWhere(id),
      relations: ['branches'],
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    const clientCode = client.client_code;

    const [users, auditSnapshot, crossTenantAssignments, usersWithoutAssignments, multiPrimaryUsers] = await Promise.all([
      this.userRepository.find({
        where: { client_id: clientCode },
        relations: ['branchRoles', 'branchRoles.branch'],
      }),
      this.auditService.getClientAuditSnapshot(clientCode, 7),
      this.userBranchRoleRepository.createQueryBuilder('ubr')
        .innerJoin('ubr.user', 'user')
        .innerJoin('ubr.branch', 'branch')
        .select('ubr.user_id', 'user_id')
        .addSelect('user.user_name', 'user_name')
        .addSelect('user.client_id', 'user_client_id')
        .addSelect('branch.id', 'branch_id')
        .addSelect('branch.branch_name', 'branch_name')
        .addSelect('branch.client_id', 'branch_client_id')
        .where('(user.client_id = :clientId OR branch.client_id = :clientId)', { clientId: clientCode })
        .andWhere('user.client_id <> branch.client_id')
        .getRawMany<{
          user_id: string;
          user_name: string;
          user_client_id: string;
          branch_id: string;
          branch_name: string;
          branch_client_id: string;
        }>(),
      this.userRepository.createQueryBuilder('user')
        .leftJoin('user.branchRoles', 'ubr')
        .select('user.id', 'user_id')
        .addSelect('user.user_name', 'user_name')
        .addSelect('user.user_type', 'user_type')
        .where('user.client_id = :clientId', { clientId: clientCode })
        .andWhere("user.user_type <> 'CLIENT_ADMIN'")
        .andWhere('user.is_active = true')
        .groupBy('user.id')
        .having('COUNT(ubr.id) = 0')
        .getRawMany<{ user_id: string; user_name: string; user_type: string }>(),
      this.userBranchRoleRepository.createQueryBuilder('ubr')
        .innerJoin('ubr.user', 'user')
        .select('ubr.user_id', 'user_id')
        .addSelect('user.user_name', 'user_name')
        .addSelect('SUM(CASE WHEN ubr.is_primary = 1 THEN 1 ELSE 0 END)', 'primary_count')
        .where('user.client_id = :clientId', { clientId: clientCode })
        .groupBy('ubr.user_id')
        .addGroupBy('user.user_name')
        .having('SUM(CASE WHEN ubr.is_primary = 1 THEN 1 ELSE 0 END) > 1')
        .getRawMany<{ user_id: string; user_name: string; primary_count: string }>(),
    ]);

    const inactiveBranchAssignments = users.flatMap((currentUser) =>
      (currentUser.branchRoles ?? [])
        .filter((assignment) => assignment.branch && assignment.branch.status !== 'active')
        .map((assignment) => ({
          user_id: currentUser.id,
          user_name: currentUser.user_name,
          branch_id: assignment.branch_id,
          branch_name: assignment.branch?.branch_name ?? null,
          branch_status: assignment.branch?.status ?? null,
        })),
    );

    const findings = [
      ...(crossTenantAssignments.length > 0
        ? [{
            code: 'cross_tenant_branch_assignment',
            severity: 'critical',
            message: `${crossTenantAssignments.length} branch assignments cross tenant boundaries`,
          }]
        : []),
      ...(usersWithoutAssignments.length > 0
        ? [{
            code: 'users_without_branch_assignments',
            severity: 'warning',
            message: `${usersWithoutAssignments.length} active non-admin users are missing branch assignments`,
          }]
        : []),
      ...(multiPrimaryUsers.length > 0
        ? [{
            code: 'multiple_primary_branch_assignments',
            severity: 'warning',
            message: `${multiPrimaryUsers.length} users have more than one primary branch assignment`,
          }]
        : []),
      ...(inactiveBranchAssignments.length > 0
        ? [{
            code: 'inactive_branch_assignments',
            severity: 'warning',
            message: `${inactiveBranchAssignments.length} assignments still reference non-active branches`,
          }]
        : []),
    ];

    return {
      client_id: client.id,
      client_code: client.client_code,
      lifecycle_status: client.status,
      governance_state: client.governance_state || 'normal',
      health_status: findings.some((finding) => finding.severity === 'critical')
        ? 'critical'
        : findings.length > 0
          ? 'warning'
          : 'healthy',
      branch_summary: {
        total: client.branches?.length ?? 0,
        active: (client.branches ?? []).filter((branch) => branch.status === 'active').length,
        central: (client.branches ?? []).filter((branch) => branch.inventory_store_type === 'central').length,
      },
      user_summary: {
        total: users.length,
        active: users.filter((currentUser) => currentUser.is_active).length,
        client_admins: users.filter((currentUser) => currentUser.user_type === 'CLIENT_ADMIN').length,
      },
      audit_snapshot: auditSnapshot,
      findings,
      anomalies: {
        cross_tenant_assignments: crossTenantAssignments,
        users_without_branch_assignments: usersWithoutAssignments,
        multiple_primary_branch_users: multiPrimaryUsers.map((row) => ({
          user_id: Number(row.user_id),
          user_name: row.user_name,
          primary_count: Number(row.primary_count || 0),
        })),
        inactive_branch_assignments: inactiveBranchAssignments,
      },
    };
  }

  async suspend(id: string, user?: JwtPayload) {
    return this.changeStatus(id, {
      status: 'suspended',
      reason: 'Suspended via legacy endpoint',
    }, user);
  }

  async activate(id: string, user?: JwtPayload) {
    return this.changeStatus(id, {
      status: 'active',
      reason: 'Activated via legacy endpoint',
    }, user);
  }

  private async findOneInternal(id: ClientIdentifier): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: buildClientLookupWhere(id),
      relations: ['contacts', 'branches'],
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  private async ensureClientExists(id: ClientIdentifier): Promise<void> {
    const exists = await this.clientRepository.findOne({
      where: buildClientLookupWhere(id),
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
  }

  private serializeClient(
    client: Client,
    counts?: { branch_count?: number; user_count?: number },
  ) {
    const clientData = Object.fromEntries(
      Object.entries(client as Client & Record<string, unknown>).filter(
        ([key]) => !['governance_context', 'governance_reason', 'governance_notes', 'governance_updated_by'].includes(key),
      ),
    );
    const contacts = (client.contacts ?? []).sort((a, b) =>
      REQUIRED_CONTACT_TYPES.indexOf(a.contact_type) - REQUIRED_CONTACT_TYPES.indexOf(b.contact_type),
    );

    return {
      ...clientData,
      client_code: client.client_code,
      legal_name: client.legal_name || client.client_name,
      branch_count: counts?.branch_count ?? client.branches?.length ?? 0,
      user_count: counts?.user_count ?? 0,
      contacts,
      branches: client.branches ?? [],
      governance_state: client.governance_state || 'normal',
      governance_updated_at: client.governance_updated_at || null,
    };
  }

  private normalizeOptionalString(
    value: string | null | undefined,
    maxLength: number,
    fallback: string | null | undefined,
  ): string | null {
    if (value === undefined) {
      return fallback ?? null;
    }
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      return null;
    }
    return trimmed.slice(0, maxLength);
  }

  private async ensureClientSettings(clientId: string): Promise<ClientSettings> {
    const existing = await this.clientRepository.manager.findOne(ClientSettings, {
      where: { client_id: clientId },
    });
    if (existing) {
      return existing;
    }

    const client = await this.findOneInternal(clientId);
    return this.clientRepository.manager.save(ClientSettings, this.clientRepository.manager.create(ClientSettings, {
      client_id: clientId,
      currency: client.currency || 'USD',
      timezone: client.timezone || 'UTC',
      contact_email: client.email || null,
      contact_phone: client.phone || null,
      address: client.address || null,
      show_receipt_full_logo: true,
      show_receipt_short_logo: false,
      show_receipt_business_name: true,
      show_receipt_branch_name: true,
      show_receipt_branch_address: true,
      show_receipt_contact_number: true,
      show_receipt_footer_message_1: true,
      show_receipt_footer_message_2: false,
      show_kot_full_logo: false,
      show_kot_short_logo: false,
      show_kot_business_name: true,
      show_kot_branch_name: true,
      show_kot_branch_address: false,
      show_kot_contact_number: false,
      show_kot_footer_message_1: false,
      show_kot_footer_message_2: false,
      show_login_full_logo: true,
      show_login_business_name: true,
      show_login_branch_name: true,
      show_header_short_logo: true,
      receipt_paper_size: 'thermal-80mm',
      invoice_paper_size: 'a4',
      kot_paper_size: 'thermal-80mm',
      report_paper_size: 'a4',
      receipt_print_copies: 1,
      invoice_print_copies: 1,
      kot_print_copies: 1,
      kot_print_enabled: true,
      report_print_copies: 1,
      order_change_print_mode: 'change_only',
      order_change_print_copies: 1,
      enable_station_wise_kot_printing: false,
      allow_multiple_kot_per_station: false,
      service_station_print_copies: null,
      station_printer_mapping: null,
      separate_kot_stations: null,
      numbering_settings: createDefaultClientNumberingSettings(),
    } as Partial<ClientSettings>));
  }

  private async getBrandingSnapshot(clientId: string): Promise<any> {
    const [client, settings, branches] = await Promise.all([
      this.clientRepository.findOne({ where: { client_code: clientId } }),
      this.clientRepository.manager.findOne(ClientSettings, { where: { client_id: clientId } }),
      this.branchRepository.find({ where: { client_id: clientId }, order: { id: 'ASC' } }),
    ]);
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    const primaryBranch = branches[0] ?? null;
    return {
      full_logo_url: settings?.logo_url || null,
      short_logo_url: settings?.short_logo_url || null,
      login_background_url: settings?.login_background_url || null,
      numbering_settings: settings?.numbering_settings || createDefaultClientNumberingSettings(),
      receipt_business_name: settings?.receipt_business_name || null,
      receipt_footer_message_1: settings?.receipt_footer_message_1 || null,
      receipt_footer_message_2: settings?.receipt_footer_message_2 || null,
      show_receipt_full_logo: settings?.show_receipt_full_logo ?? true,
      show_receipt_short_logo: settings?.show_receipt_short_logo ?? false,
      show_receipt_business_name: settings?.show_receipt_business_name ?? true,
      show_receipt_branch_name: settings?.show_receipt_branch_name ?? true,
      show_receipt_branch_address: settings?.show_receipt_branch_address ?? true,
      show_receipt_contact_number: settings?.show_receipt_contact_number ?? true,
      show_receipt_footer_message_1: settings?.show_receipt_footer_message_1 ?? true,
      show_receipt_footer_message_2: settings?.show_receipt_footer_message_2 ?? false,
      show_kot_full_logo: settings?.show_kot_full_logo ?? false,
      show_kot_short_logo: settings?.show_kot_short_logo ?? false,
      show_kot_business_name: settings?.show_kot_business_name ?? true,
      show_kot_branch_name: settings?.show_kot_branch_name ?? true,
      show_kot_branch_address: settings?.show_kot_branch_address ?? false,
      show_kot_contact_number: settings?.show_kot_contact_number ?? false,
      show_kot_footer_message_1: settings?.show_kot_footer_message_1 ?? false,
      show_kot_footer_message_2: settings?.show_kot_footer_message_2 ?? false,
      show_login_full_logo: settings?.show_login_full_logo ?? true,
      show_login_business_name: settings?.show_login_business_name ?? true,
      show_login_branch_name: settings?.show_login_branch_name ?? true,
      show_header_short_logo: settings?.show_header_short_logo ?? true,
      receipt_paper_size: settings?.receipt_paper_size ?? 'thermal-80mm',
      invoice_paper_size: settings?.invoice_paper_size ?? 'a4',
      kot_paper_size: settings?.kot_paper_size ?? 'thermal-80mm',
      report_paper_size: settings?.report_paper_size ?? 'a4',
      receipt_print_copies: settings?.receipt_print_copies ?? 1,
      invoice_print_copies: settings?.invoice_print_copies ?? 1,
      kot_print_copies: settings?.kot_print_copies ?? 1,
      kot_print_enabled: settings?.kot_print_enabled ?? true,
      report_print_copies: settings?.report_print_copies ?? 1,
      order_change_print_mode: settings?.order_change_print_mode ?? 'change_only',
      order_change_print_copies: settings?.order_change_print_copies ?? 1,
      enable_station_wise_kot_printing: settings?.enable_station_wise_kot_printing ?? false,
      allow_multiple_kot_per_station: settings?.allow_multiple_kot_per_station ?? false,
      service_station_print_copies: settings?.service_station_print_copies ?? {},
      station_printer_mapping: settings?.station_printer_mapping ?? {},
      separate_kot_stations: settings?.separate_kot_stations ?? [],
      client_name: client.client_name,
      short_name: client.short_name || null,
      primary_branch: primaryBranch ? {
        id: primaryBranch.id,
        branch_name: primaryBranch.branch_name,
        address: primaryBranch.address ?? null,
        phone: primaryBranch.phone ?? null,
      } : null,
    };
  }

  private extensionFromMime(mimeType: string): string {
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'image/svg+xml') return '.svg';
    return '.bin';
  }

  private async deleteManagedBrandingAsset(currentPath?: string | null): Promise<void> {
    if (!currentPath || !currentPath.startsWith('/uploads/client-branding/')) {
      return;
    }
    const absolutePath = path.join(process.cwd(), currentPath.replace(/^\//, ''));
    await fs.rm(absolutePath, { force: true }).catch(() => undefined);
  }

  private async getClientAdminUser(clientId: string): Promise<UserManagement | null> {
    return this.userRepository.findOne({
      where: { client_id: clientId, user_type: 'CLIENT_ADMIN' },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }

  private serializeClientAdmin(user: UserManagement) {
    return {
      id: user.id,
      full_name: user.full_name,
      user_name: user.user_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private async upsertClientAdmin(
    clientId: string,
    adminInput: CreateClientRegistryDto['admin_user'] | UpdateClientRegistryDto['admin_user'],
  ): Promise<UserManagement> {
    if (!adminInput) {
      throw new BadRequestException('Admin user input is required');
    }

    const roles = await this.rolesService.findAll(clientId);
    const clientAdminRole = roles.find((role) => role.role_name === 'Client Admin');
    if (!clientAdminRole) {
      throw new NotFoundException('Client Admin role is not configured for this client');
    }

    const existingAdmin = await this.getClientAdminUser(clientId);
    if (!existingAdmin) {
      if (!adminInput.password?.trim()) {
        throw new BadRequestException('Admin password is required when creating the client admin');
      }
      return this.usersService.create(clientId, {
        full_name: adminInput.full_name.trim(),
        user_name: adminInput.user_name.trim(),
        email: adminInput.email.trim().toLowerCase(),
        password: adminInput.password,
        phone: adminInput.phone?.trim(),
        role_id: clientAdminRole.id,
        user_type: 'CLIENT_ADMIN',
        status: 'inactive',
      });
    }

    return this.usersService.update(clientId, Number(existingAdmin.id), {
      full_name: adminInput.full_name.trim(),
      user_name: adminInput.user_name.trim(),
      email: adminInput.email.trim().toLowerCase(),
      password: adminInput.password?.trim() || undefined,
      phone: adminInput.phone?.trim() || undefined,
      role_id: clientAdminRole.id,
      user_type: 'CLIENT_ADMIN',
    });
  }

  private async upsertInitialBranch(
    client: Client,
    branchInput: NonNullable<UpdateClientRegistryDto['initial_branch']>,
    actorId?: string | null,
  ): Promise<Branch> {
    const existingBranch = await this.branchRepository.findOne({
      where: { client_id: client.client_code },
      order: { id: 'ASC' },
    });
    const openingTime = branchInput.opening_time?.trim()
      ? `${branchInput.opening_time.trim()}:00`
      : existingBranch?.opening_time || '09:00:00';
    const closingTime = branchInput.closing_time?.trim()
      ? `${branchInput.closing_time.trim()}:00`
      : existingBranch?.closing_time || '23:00:00';

    if (!existingBranch) {
      const branchCode = await this.generateBranchCode(client.client_code);
      const branch = this.branchRepository.create({
        client_id: client.client_code,
        branch_code: this.normalizeBranchCode(branchCode) || branchCode,
        branch_name: branchInput.branch_name.trim(),
        short_name: branchInput.short_name?.trim() || branchInput.branch_name.trim().slice(0, 50),
        address: branchInput.address?.trim() || client.address || null,
        city: branchInput.city?.trim() || client.city || null,
        state: branchInput.state?.trim() || null,
        country: branchInput.country?.trim() || client.country || null,
        contact_person: branchInput.contact_person?.trim() || null,
        phone: branchInput.phone?.trim() || client.phone || null,
        email: branchInput.email?.trim() || client.email || null,
        inventory_store_type: 'branch',
        is_production_source: false,
        production_source_label: null,
        modules_enabled: this.normalizeModuleList(client.enabled_modules || []),
        opening_time: openingTime,
        closing_time: closingTime,
        operating_hours: createDefaultBranchOperatingHours(openingTime, closingTime),
        document_settings: createDefaultBranchDocumentSettings(),
        tax_settings: createDefaultBranchTaxSettings(null),
        operational_settings: createDefaultBranchOperationalSettings(),
        tax_region: undefined,
        inherit_client_currency: false,
        inherit_client_language: true,
        inherit_client_theme: true,
        currency_code: client.currency || 'USD',
        date_format: 'MMM DD, YYYY',
        time_format: 'hh:mma',
        language: client.language || 'en',
        theme_id: undefined,
        status: 'setup_pending',
        is_active: false,
        created_by: actorId ?? undefined,
        updated_by: actorId ?? undefined,
      } as Partial<Branch>);
      return this.branchRepository.save(branch);
    }

    existingBranch.branch_name = branchInput.branch_name.trim();
    existingBranch.short_name = branchInput.short_name?.trim() || branchInput.branch_name.trim().slice(0, 50);
    existingBranch.address = (branchInput.address?.trim() || client.address || null) as any;
    existingBranch.city = (branchInput.city?.trim() || client.city || null) as any;
    existingBranch.state = (branchInput.state?.trim() || null) as any;
    existingBranch.country = (branchInput.country?.trim() || client.country || null) as any;
    existingBranch.contact_person = (branchInput.contact_person?.trim() || null) as any;
    existingBranch.phone = (branchInput.phone?.trim() || client.phone || null) as any;
    existingBranch.email = (branchInput.email?.trim() || client.email || null) as any;
    existingBranch.opening_time = openingTime;
    existingBranch.closing_time = closingTime;
    existingBranch.operating_hours = createDefaultBranchOperatingHours(openingTime, closingTime);
    existingBranch.updated_by = (actorId ?? existingBranch.updated_by) as any;
    if (!existingBranch.modules_enabled?.length && client.enabled_modules?.length) {
      existingBranch.modules_enabled = this.normalizeModuleList(client.enabled_modules);
    }
    return this.branchRepository.save(existingBranch);
  }

  private snapshotClient(client: Client) {
    return {
      legal_name: client.legal_name || null,
      client_name: client.client_name || null,
      short_name: client.short_name || null,
      business_type: client.business_type || null,
      address: client.address || null,
      area: client.area || null,
      city: client.city || null,
      country: client.country || null,
      phone: client.phone || null,
      email: client.email || null,
      cell_phone: client.cell_phone || null,
      website_url: client.website_url || null,
      currency: client.currency || null,
      language: client.language || null,
      timezone: client.timezone || null,
      renewal_day: client.renewal_day ?? null,
      renewal_date: client.renewal_date || null,
      grace_period_days: client.grace_period_days ?? 0,
      onboarding_blueprint: client.onboarding_blueprint || null,
      comments: client.comments || null,
    };
  }

  private buildDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    return Object.keys(after)
      .filter((key) => before[key] !== after[key])
      .map((key) => ({
        field: key,
        oldValue: before[key],
        newValue: after[key],
      }));
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
  }

  private async ensureSlugAvailable(slug: string): Promise<void> {
    const existing = await this.clientRepository.findOne({
      where: { domain_slug: slug },
      select: ['id'],
    });
    if (existing) {
      throw new BadRequestException('Domain slug already exists');
    }
  }

  private async resolveOnboardingBlueprintCode(code?: string | null): Promise<string | null> {
    const normalized = code?.trim().toUpperCase() || null;
    if (!normalized) {
      return null;
    }

    const blueprint = await this.blueprintRepository.findOne({
      where: { blueprint_code: normalized },
      select: ['id', 'blueprint_code', 'status', 'active_version_id'],
    });
    if (!blueprint) {
      throw new BadRequestException('Selected onboarding blueprint does not exist');
    }
    if (blueprint.status !== 'active' || !blueprint.active_version_id) {
      throw new BadRequestException('Only active blueprint templates can be linked to client onboarding');
    }

    return blueprint.blueprint_code;
  }

  private async resolveInitialSubscriptionPlan(planId: number): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (plan.plan_status !== 'active' || !plan.is_active) {
      throw new BadRequestException('Only active subscription plans can be assigned during client creation');
    }
    return plan;
  }

  private normalizeBranchCode(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }

    return input
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
  }

  private normalizeModuleList(modules?: string[] | null): string[] {
    return [...new Set(
      (modules ?? [])
        .map((module) => String(module || '').trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  private async generateBranchCode(
    clientId: string,
    branchRepository: Repository<Branch> = this.branchRepository,
  ): Promise<string> {
    const lastBranch = await branchRepository.findOne({
      where: { client_id: clientId },
      order: { id: 'DESC' },
    });

    let nextNumber = 1;
    if (lastBranch?.branch_code?.startsWith('BR')) {
      const match = lastBranch.branch_code.match(/BR(\d+)/);
      if (match) {
        nextNumber = Number.parseInt(match[1], 10) + 1;
      }
    }

    return `BR${nextNumber.toString().padStart(3, '0')}`;
  }

  private async generateIdentifiers(): Promise<{ clientCode: string }> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const seed = Math.floor(1000 + Math.random() * 9000);
      const clientCode = `CL${seed}`;
      const existing = await this.clientRepository.findOne({
        where: { client_code: clientCode },
        select: ['id'],
      });
      if (!existing) {
        return { clientCode };
      }
    }

    throw new InternalServerErrorException('Unable to generate a unique client identifier');
  }

  private normalizeContacts(contacts: ClientContactInputDto[]): ClientContactInputDto[] {
    if (!Array.isArray(contacts) || contacts.length !== REQUIRED_CONTACT_TYPES.length) {
      throw new BadRequestException('Exactly three primary contacts are required');
    }

    const types = new Set<string>();
    const normalized = contacts.map((contact) => ({
      ...contact,
      full_name: contact.full_name.trim(),
      designation: contact.designation?.trim(),
      email: contact.email?.trim(),
      phone: contact.phone?.trim(),
      alternate_phone: contact.alternate_phone?.trim(),
      notes: contact.notes?.trim(),
    }));

    for (const contact of normalized) {
      const contactType = contact.contact_type as ClientContactType;
      if (!CLIENT_CONTACT_TYPES.includes(contactType)) {
        throw new BadRequestException(`Unsupported contact type: ${contact.contact_type}`);
      }
      if (types.has(contactType)) {
        throw new BadRequestException(`Duplicate contact type: ${contact.contact_type}`);
      }
      types.add(contactType);
      if (!contact.email && !contact.phone) {
        throw new BadRequestException(`Contact ${contact.contact_type} requires an email or phone`);
      }
    }

    for (const requiredType of REQUIRED_CONTACT_TYPES) {
      if (!types.has(requiredType)) {
        throw new BadRequestException(`Missing required contact type: ${requiredType}`);
      }
    }

    return normalized;
  }

  private async syncContacts(
    clientId: string,
    contacts: ClientContactInputDto[],
    actorId?: string,
    repository: Repository<ClientContact> = this.contactRepository,
  ): Promise<Array<{ field: string; oldValue: unknown; newValue: unknown }>> {
    const existing = await repository.find({ where: { client_id: clientId } });
    const existingMap = new Map(existing.map((contact) => [contact.contact_type, contact]));
    const diffs: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const entitiesToSave: ClientContact[] = [];

    for (const contact of contacts) {
      const contactType = contact.contact_type as ClientContactType;
      const current = existingMap.get(contactType);
      if (!current) {
        const created = repository.create({
          client_id: clientId,
          contact_type: contactType,
          full_name: contact.full_name,
          designation: contact.designation || null,
          email: contact.email || null,
          phone: contact.phone || null,
          alternate_phone: contact.alternate_phone || null,
          notes: contact.notes || null,
          is_active: true,
          created_by: actorId ?? null,
          updated_by: actorId ?? null,
        } as Partial<ClientContact>);
        entitiesToSave.push(created);
        diffs.push({
          field: `contact.${contactType}`,
          oldValue: null,
          newValue: {
            full_name: contact.full_name,
            email: contact.email || null,
            phone: contact.phone || null,
          },
        });
        continue;
      }

      const before = {
        full_name: current.full_name,
        designation: current.designation,
        email: current.email,
        phone: current.phone,
        alternate_phone: current.alternate_phone,
        notes: current.notes,
      };

      current.full_name = contact.full_name;
      current.designation = contact.designation || null;
      current.email = contact.email || null;
      current.phone = contact.phone || null;
      current.alternate_phone = contact.alternate_phone || null;
      current.notes = contact.notes || null;
      current.is_active = true;
      current.updated_by = actorId ?? null;
      entitiesToSave.push(current);

      const after = {
        full_name: current.full_name,
        designation: current.designation,
        email: current.email,
        phone: current.phone,
        alternate_phone: current.alternate_phone,
        notes: current.notes,
      };

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diffs.push({
          field: `contact.${contactType}`,
          oldValue: before,
          newValue: after,
        });
      }
    }

    if (entitiesToSave.length > 0) {
      await repository.save(entitiesToSave);
    }

    return diffs;
  }

  private async recordStatusTransition(
    clientId: string,
    fromStatus: ClientRegistryStatus | null,
    toStatus: ClientRegistryStatus,
    reason: string,
    notes: string | null,
    actorId?: string,
  ) {
    await this.statusHistoryRepository.save(this.statusHistoryRepository.create({
      client_id: clientId,
      from_status: fromStatus as any,
      to_status: toStatus as any,
      reason,
      notes,
      changed_by: actorId ?? null,
    }));
  }

  private serializeSubscription(subscription: ClientSubscription) {
    return {
      id: subscription.id,
      client_id: subscription.client_id,
      plan_id: subscription.plan_id,
      plan_code: subscription.plan_code_snapshot,
      plan_name: subscription.plan_name_snapshot,
      plan_description: subscription.plan_description_snapshot,
      currency_code: subscription.currency_code_snapshot,
      billing_cycle: subscription.billing_cycle,
      status: subscription.status,
      is_trial: subscription.is_trial,
      trial_start_at: subscription.trial_start_at,
      trial_end_at: subscription.trial_end_at,
      effective_start_at: subscription.effective_start_at,
      effective_end_at: subscription.effective_end_at,
      grace_start_at: subscription.grace_start_at,
      grace_end_at: subscription.grace_end_at,
      activated_at: subscription.activated_at,
      expired_at: subscription.expired_at,
      suspended_at: subscription.suspended_at,
      cancelled_at: subscription.cancelled_at,
      price_snapshot: Number(subscription.price_snapshot || 0),
      assignment_reason: subscription.assignment_reason,
      assignment_notes: subscription.assignment_notes,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      plan_status: subscription.plan?.plan_status || null,
    };
  }

  private serializeSubscriptionHistory(history: ClientSubscriptionHistory) {
    return {
      id: history.id,
      action_type: history.action_type,
      from_status: history.from_status,
      to_status: history.to_status,
      from_plan_id: history.from_plan_id,
      to_plan_id: history.to_plan_id,
      from_plan_name: history.from_plan_name,
      to_plan_name: history.to_plan_name,
      billing_cycle: history.billing_cycle,
      price_snapshot: history.price_snapshot !== null && history.price_snapshot !== undefined
        ? Number(history.price_snapshot)
        : null,
      reason: history.reason,
      notes: history.notes,
      changed_by: history.changed_by,
      created_at: history.created_at,
    };
  }

  private resolveCurrentSubscription(subscriptions: ClientSubscription[]): ClientSubscription | null {
    const statusPriority: ClientSubscriptionStatus[] = ['active', 'grace', 'trial', 'suspended', 'pending'];
    for (const status of statusPriority) {
      const match = subscriptions.find((subscription) => subscription.status === status);
      if (match) {
        return match;
      }
    }
    return subscriptions[0] || null;
  }

  private async replaceSubscription(
    subscription: ClientSubscription,
    actorId: string | undefined,
    notes: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    const previousStatus = subscription.status;
    subscription.status = 'cancelled';
    subscription.cancelled_at = now;
    subscription.effective_end_at = subscription.effective_end_at || subscription.grace_end_at || now;
    subscription.updated_by = actorId ?? null;
    await this.clientSubscriptionRepository.save(subscription);
    await this.recordSubscriptionHistory({
      subscription_id: subscription.id,
      client_id: subscription.client_id,
      action_type: 'superseded',
      from_status: previousStatus,
      to_status: 'cancelled',
      from_plan_id: subscription.plan_id,
      to_plan_id: subscription.plan_id,
      from_plan_name: subscription.plan_name_snapshot,
      to_plan_name: subscription.plan_name_snapshot,
      billing_cycle: subscription.billing_cycle,
      price_snapshot: Number(subscription.price_snapshot || 0),
      reason,
      notes,
      changed_by: actorId ?? null,
    });
  }

  private async recordSubscriptionHistory(
    payload: Partial<ClientSubscriptionHistory>,
  ): Promise<void> {
    await this.clientSubscriptionHistoryRepository.save(
      this.clientSubscriptionHistoryRepository.create(payload),
    );
  }

  private async syncClientSubscriptionSnapshot(clientId: string): Promise<void> {
    const client = await this.clientRepository.findOne({ where: { client_code: clientId } });
    if (!client) {
      return;
    }

    const subscriptions = await this.clientSubscriptionRepository.find({
      where: { client_id: clientId },
      relations: ['plan'],
      order: {
        effective_start_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const current = this.resolveCurrentSubscription(subscriptions);
    if (!current) {
      client.subscription_plan_id = null as any;
      client.subscription_start = null as any;
      client.subscription_end = null as any;
      client.expiry_date = null as any;
      client.enabled_modules_json = JSON.stringify([]);
      await this.clientRepository.save(client);
      return;
    }

    client.subscription_plan_id = current.plan_id;
    client.subscription_type = current.billing_cycle;
    client.subscription_start = current.effective_start_at as any;
    client.subscription_end = (current.grace_end_at || current.effective_end_at) as any;
    client.expiry_date = (current.grace_end_at || current.trial_end_at || current.effective_end_at) as any;
    const renewalAnchor = current.trial_end_at || current.effective_end_at || current.grace_end_at || null;
    client.renewal_date = renewalAnchor ? this.toDateOnlyString(renewalAnchor) as any : null as any;
    client.renewal_day = renewalAnchor ? renewalAnchor.getUTCDate() as any : null as any;
    if (current.plan) {
      client.max_branches = current.plan.max_branches;
      client.max_users = current.plan.max_users;
      client.enabled_modules = current.plan.allowed_modules || ['all'];
    }
    await this.clientRepository.save(client);
  }

  private async resolveGraceEndAt(
    client: Client,
    graceStartAt: Date,
    explicitGraceDays?: number,
    explicitGraceEndAt?: string,
  ): Promise<Date> {
    if (explicitGraceEndAt) {
      const parsed = new Date(explicitGraceEndAt);
      if (Number.isNaN(parsed.getTime()) || parsed <= graceStartAt) {
        throw new BadRequestException('Grace end date must be after the grace start date');
      }
      return parsed;
    }

    const graceDays = explicitGraceDays ?? await this.resolveGraceDays(client);
    if (!graceDays || graceDays <= 0) {
      throw new BadRequestException('Grace transitions require grace days or a grace end date');
    }

    const graceEndAt = new Date(graceStartAt);
    graceEndAt.setDate(graceEndAt.getDate() + graceDays);
    return graceEndAt;
  }

  private async resolveGraceDays(client: Client): Promise<number> {
    if (Number(client.grace_period_days || 0) > 0) {
      return Number(client.grace_period_days);
    }

    const settings = await this.platformSettingsRepository.findOne({ where: { id: 1 } });
    return Number(settings?.global_grace_period_days || 0);
  }

  private toDateOnlyString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toNumericActorId(actorId?: string): number | undefined {
    if (!actorId) {
      return undefined;
    }

    const parsed = Number(actorId);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
