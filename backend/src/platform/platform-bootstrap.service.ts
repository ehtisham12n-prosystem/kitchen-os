import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { Client } from './entities/client.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { ClientSettings } from './entities/client-settings.entity';
import { ClientSubscription } from './entities/client-subscription.entity';
import { Role } from '../setup/entities/Roles.entity';
import { Branch } from '../setup/entities/branch.entity';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';
import { SystemGroup } from './security/sys-groups/entities/system-group.entity';
import { SaleCounter } from '../pos/entities/sale-counter.entity';
import { Category } from '../catalog/entities/category.entity';
import { PriceProfile } from '../catalog/entities/price-profile.entity';
import { Station } from '../catalog/entities/station.entity';
import { Uom } from '../catalog/entities/uom.entity';
import { Product } from '../catalog/entities/product.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';
import { InventoryType } from '../inventory/entities/inventory-type.entity';
import { InventorySubType } from '../inventory/entities/inventory-sub-type.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { PlatformService } from './platform.service';
import { buildClientLookupWhere } from './client-lookup.util';
import { RolesService } from '../setup/roles/roles.service';
import { UserManagementsService } from '../setup/users/users.service';
import { BranchesService } from '../setup/branches/branches.service';
import { TaxesService } from '../setup/taxes/taxes.service';
import { CatalogService } from '../catalog/catalog.service';
import { InventoryService } from '../inventory/inventory.service';
import { SaleCounterService } from '../pos/sale-counter.service';
import { RegistryService } from './security/registry/registry.service';
import { SysGroupsService } from './security/sys-groups/sys-groups.service';
import { ThemesService } from './themes/themes.service';

export type BootstrapStarterProfile = 'none' | 'kitchen-club';

export interface BootstrapAdminOptions {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface BootstrapClientStarterUsersOptions {
  branchManagerPassword: string;
  cashierPassword: string;
}

export interface BootstrapClientOptions {
  clientId: string;
  clientCode: string;
  clientName: string;
  legalName?: string;
  shortName?: string;
  domainSlug: string;
  businessType?: string;
  currency?: string;
  language?: string;
  timezone?: string;
  planCode: string;
  admin: BootstrapAdminOptions;
  starterProfile?: BootstrapStarterProfile;
  starterUsers?: BootstrapClientStarterUsersOptions;
}

export interface BootstrapOptions {
  superAdmin: BootstrapAdminOptions;
  client?: BootstrapClientOptions;
}

type StarterCatalogProductSeed = {
  productName: string;
  sku: string;
  productCode: string;
  description: string;
  categoryName: string;
  basePrice: number;
  deliveryMinutes: number;
};

@Injectable()
export class PlatformBootstrapService {
  constructor(
    @InjectRepository(UserManagement)
    private readonly userRepository: Repository<UserManagement>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(ClientSettings)
    private readonly clientSettingsRepository: Repository<ClientSettings>,
    @InjectRepository(ClientSubscription)
    private readonly clientSubscriptionRepository: Repository<ClientSubscription>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(TaxConfiguration)
    private readonly taxRepository: Repository<TaxConfiguration>,
    @InjectRepository(SystemGroup)
    private readonly systemGroupRepository: Repository<SystemGroup>,
    @InjectRepository(SaleCounter)
    private readonly saleCounterRepository: Repository<SaleCounter>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(PriceProfile)
    private readonly PriceProfileRepository: Repository<PriceProfile>,
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
    @InjectRepository(Uom)
    private readonly uomRepository: Repository<Uom>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryClass)
    private readonly inventoryClassRepository: Repository<InventoryClass>,
    @InjectRepository(InventoryType)
    private readonly inventoryTypeRepository: Repository<InventoryType>,
    @InjectRepository(InventorySubType)
    private readonly inventorySubTypeRepository: Repository<InventorySubType>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepository: Repository<BranchInventory>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    private readonly platformService: PlatformService,
    private readonly rolesService: RolesService,
    private readonly usersService: UserManagementsService,
    private readonly branchesService: BranchesService,
    private readonly taxesService: TaxesService,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly saleCounterService: SaleCounterService,
    private readonly registryService: RegistryService,
    private readonly sysGroupsService: SysGroupsService,
    private readonly themesService: ThemesService,
  ) {}

  async run(options: BootstrapOptions) {
    await this.ensureCorePlatformData();

    const superAdmin = await this.ensureSuperAdmin(options.superAdmin);
    const client = options.client
      ? await this.ensureClient(options.client, Number(superAdmin.id))
      : null;
    const starterData = client && options.client
      ? await this.ensureClientStarterData(client.client, options.client, Number(superAdmin.id))
      : null;

    return {
      nexus_client_id: 'NX-10101',
      super_admin: {
        id: superAdmin.id,
        username: superAdmin.user_name,
        email: superAdmin.email,
        created: Boolean((superAdmin as any).__bootstrap_created),
      },
      client: client
        ? {
            id: client.client.id,
            client_code: client.client.client_code,
            domain_slug: client.client.domain_slug,
            created: client.created,
            admin: {
              id: client.admin.id,
              username: client.admin.user_name,
              email: client.admin.email,
              created: client.adminCreated,
            },
            subscription: client.subscription
              ? {
                  id: client.subscription.id,
                  plan_code: client.subscription.plan_code_snapshot,
                  status: client.subscription.status,
                  created: client.subscriptionCreated,
                }
              : null,
            starter_data: starterData,
          }
        : null,
    };
  }

  private async ensureCorePlatformData(): Promise<void> {
    await this.platformService.seedNexusClient();
    await this.platformService.getSystemSettings();
    await this.platformService.seedLookups();
    await this.platformService.seedBlueprints();
    await this.platformService.seedSubscriptionPlans();
    await this.sysGroupsService.seedDefaults();
    await this.registryService.seedAll();
    await this.themesService.seedDefaults();
  }

  private async ensureSuperAdmin(options: BootstrapAdminOptions): Promise<UserManagement> {
    const existing = await this.resolveExistingUser(
      options.username,
      options.email,
      'PLATFORM_ADMIN',
      'NX-10101',
    );

    if (existing) {
      let shouldSave = false;
      if (!existing.full_name && options.fullName.trim()) {
        existing.full_name = options.fullName.trim();
        shouldSave = true;
      }
      if (!existing.group_id) {
        const fullControlGroup = await this.systemGroupRepository.findOne({
          where: { name: 'System Full Control' },
        });
        existing.group_id = fullControlGroup?.id ?? existing.group_id;
        shouldSave = true;
      }
      if (existing.status !== 'active' || !existing.is_active) {
        existing.status = 'active';
        existing.is_active = true;
        shouldSave = true;
      }
      return shouldSave ? this.userRepository.save(existing) : existing;
    }

    const fullControlGroup = await this.systemGroupRepository.findOne({
      where: { name: 'System Full Control' },
    });
    const passwordHash = await bcrypt.hash(options.password, 10);
    const created = this.userRepository.create({
      client_id: 'NX-10101',
      full_name: options.fullName.trim(),
      user_name: options.username.trim(),
      email: options.email.trim().toLowerCase(),
      password_hash: passwordHash,
      group_id: fullControlGroup?.id ?? undefined,
      user_type: 'PLATFORM_ADMIN',
      status: 'active',
      is_active: true,
      employee_id: 'NX-ADM-001',
    } as Partial<UserManagement>);

    const saved = await this.userRepository.save(created);
    Object.assign(saved, { __bootstrap_created: true });
    return saved;
  }

  private async ensureClient(
    options: BootstrapClientOptions,
    actorId: number,
  ): Promise<{
    client: Client;
    created: boolean;
    admin: UserManagement;
    adminCreated: boolean;
    subscription: ClientSubscription | null;
    subscriptionCreated: boolean;
  }> {
    const normalizedSlug = this.normalizeSlug(options.domainSlug);
    const normalizedClientCode = options.clientCode.trim().toUpperCase();
    const existingBySlug = await this.clientRepository.findOne({
      where: { domain_slug: normalizedSlug },
      relations: ['subscription_plan'],
    });
    const existingByCode = await this.clientRepository.findOne({
      where: { client_code: normalizedClientCode },
      relations: ['subscription_plan'],
    });

    if (existingBySlug && existingByCode && existingBySlug.id !== existingByCode.id) {
      throw new BadRequestException(
        `Bootstrap client slug ${normalizedSlug} and client code ${normalizedClientCode} resolve to different records.`,
      );
    }

    const plan = await this.planRepository.findOne({
      where: { plan_code: options.planCode.trim().toUpperCase() },
    });
    if (!plan) {
      throw new BadRequestException(
        `Bootstrap plan ${options.planCode} was not found after platform seeding.`,
      );
    }

    let client = existingBySlug || existingByCode;
    let clientCreated = false;
    if (!client) {
      const now = new Date();
      client = this.clientRepository.create({
        client_code: normalizedClientCode,
        legal_name: options.legalName?.trim() || options.clientName.trim(),
        client_name: options.clientName.trim(),
        short_name: options.shortName?.trim() || options.clientName.trim().slice(0, 50),
        domain_slug: normalizedSlug,
        status: 'active',
        governance_state: 'normal',
        business_type: options.businessType?.trim() || 'restaurant',
        currency: options.currency?.trim() || 'USD',
        language: options.language?.trim() || 'en',
        timezone: options.timezone?.trim() || 'UTC',
        email: options.admin.email.trim().toLowerCase(),
        poc_full_name: options.admin.fullName.trim(),
        poc_email: options.admin.email.trim().toLowerCase(),
        subscription_plan_id: plan.id,
        subscription_type: 'monthly',
        subscription_start: now,
        renewal_day: now.getUTCDate(),
        renewal_date: this.toDateOnly(now),
        enabled_modules_json: JSON.stringify(plan.allowed_modules || []),
        max_branches: Number(plan.max_branches || 1),
        max_users: Number(plan.max_users || 5),
        created_by: actorId,
        updated_by: actorId,
      } as Partial<Client>);
      client = await this.clientRepository.save(client);
      clientCreated = true;
    } else {
      let shouldSave = false;
      if (!client.client_code) {
        client.client_code = normalizedClientCode;
        shouldSave = true;
      }
      if (!client.legal_name) {
        client.legal_name = options.legalName?.trim() || options.clientName.trim();
        shouldSave = true;
      }
      if (client.status !== 'active') {
        client.status = 'active';
        shouldSave = true;
      }
      if (!client.subscription_plan_id) {
        client.subscription_plan_id = plan.id;
        shouldSave = true;
      }
      if (!client.enabled_modules_json) {
        client.enabled_modules_json = JSON.stringify(plan.allowed_modules || []);
        shouldSave = true;
      }
      if (!client.max_branches) {
        client.max_branches = Number(plan.max_branches || 1);
        shouldSave = true;
      }
      if (!client.max_users) {
        client.max_users = Number(plan.max_users || 5);
        shouldSave = true;
      }
      if (shouldSave) {
        client.updated_by = actorId;
        client = await this.clientRepository.save(client);
      }
    }

    await this.ensureClientSettings(client);
    await this.rolesService.ensureDefaultRoles(client.client_code);

    const clientAdminRole = await this.roleRepository.findOne({
      where: { client_id: client.client_code, role_name: 'Client Admin' },
    });
    if (!clientAdminRole) {
      throw new BadRequestException(
        `Client Admin role could not be resolved for bootstrap client ${client.client_code}.`,
      );
    }

    const existingAdmin = await this.resolveExistingUser(
      options.admin.username,
      options.admin.email,
      'CLIENT_ADMIN',
      client.client_code,
    );
    let adminCreated = false;
    let admin = existingAdmin;
    if (!admin) {
      admin = await this.usersService.create(client.client_code, {
        full_name: options.admin.fullName.trim(),
        user_name: options.admin.username.trim(),
        email: options.admin.email.trim().toLowerCase(),
        password: options.admin.password,
        role_id: clientAdminRole.id,
        user_type: 'CLIENT_ADMIN',
        status: 'active',
      });
      adminCreated = true;
    } else if ((admin.status !== 'active' || !admin.is_active) && admin.id) {
      admin.status = 'active';
      admin.is_active = true;
      admin = await this.userRepository.save(admin);
    }

    const {
      subscription,
      created: subscriptionCreated,
    } = await this.ensureCurrentSubscription(client, plan);

    return {
      client,
      created: clientCreated,
      admin,
      adminCreated,
      subscription,
      subscriptionCreated,
    };
  }

  private async ensureClientStarterData(
    client: Client,
    options: BootstrapClientOptions,
    actorId: number,
  ) {
    const profile = options.starterProfile ?? 'none';
    if (profile === 'none') {
      return {
        profile: 'none',
        applied: false,
      };
    }

    if (profile !== 'kitchen-club') {
      throw new BadRequestException(`Unsupported bootstrap starter profile ${profile}.`);
    }

    return this.ensureKitchenClubStarterData(client, options, actorId);
  }

  private async ensureKitchenClubStarterData(
    client: Client,
    options: BootstrapClientOptions,
    actorId: number,
  ) {
    if (!options.starterUsers) {
      throw new BadRequestException(
        'Kitchen Club starter profile requires starter user passwords.',
      );
    }

    const defaultTax = await this.ensureDefaultTaxConfiguration(client.client_code);
    const branch = await this.ensureKitchenClubBranch(client, defaultTax, actorId);
    const saleCounter = await this.ensureKitchenClubSaleCounter(client.client_code, branch.id);
    const branchManagerRole = await this.ensureRoleByName(client.client_code, 'Branch Manager');
    const cashierRole = await this.ensureRoleByName(client.client_code, 'POS User');
    const users = await this.ensureKitchenClubUsers(
      client,
      branch.id,
      branchManagerRole.id,
      cashierRole.id,
      options.starterUsers,
    );
    const catalog = await this.ensureKitchenClubCatalog(client.client_code, branch.id, defaultTax.id);
    const inventory = await this.ensureKitchenClubInventory(client.client_code, branch.id);

    return {
      profile: 'kitchen-club',
      applied: true,
      tax_configuration: {
        id: defaultTax.id,
        tax_code: defaultTax.tax_code,
      },
      branch: {
        id: branch.id,
        branch_code: branch.branch_code,
        branch_name: branch.branch_name,
        status: branch.status,
      },
      sale_counter: {
        id: saleCounter.id,
        code: saleCounter.code,
        name: saleCounter.name,
      },
      users: users.map((user) => ({
        id: user.id,
        username: user.user_name,
        user_type: user.user_type,
      })),
      catalog,
      inventory,
    };
  }

  private async ensureDefaultTaxConfiguration(clientId: string): Promise<TaxConfiguration> {
    let tax = await this.taxRepository.findOne({
      where: { client_id: clientId, tax_code: 'STANDARD' },
    });

    if (!tax) {
      tax = await this.taxRepository.findOne({
        where: { client_id: clientId, is_default: true },
      });
    }

    if (!tax) {
      return this.taxesService.create(clientId, {
        tax_name: 'Standard GST 16%',
        tax_code: 'STANDARD',
        tax_registration_number: 'PENDING-REGISTRATION',
        tax_rate: 16,
        calculation_method: 'percentage',
        description: 'Starter tax profile for Kitchen Club bootstrap.',
        is_default: true,
        is_active: true,
        applies_to_dine_in: true,
        applies_to_takeout: true,
        applies_to_delivery: true,
      });
    }

    let shouldSave = false;
    if (!tax.is_active) {
      tax.is_active = true;
      shouldSave = true;
    }
    if (!tax.is_default) {
      tax.is_default = true;
      shouldSave = true;
    }

    if (shouldSave) {
      const existingDefaults = await this.taxRepository.find({
        where: { client_id: clientId, is_default: true },
      });
      for (const existing of existingDefaults) {
        if (existing.id !== tax.id) {
          existing.is_default = false;
          await this.taxRepository.save(existing);
        }
      }
      tax = await this.taxRepository.save(tax);
    }

    return tax;
  }

  private async ensureKitchenClubBranch(
    client: Client,
    tax: TaxConfiguration,
    actorId: number,
  ): Promise<Branch> {
    const branchPayload = {
      branch_name: 'Kitchen Club Main Branch',
      short_name: 'Kitchen Club Main',
      branch_code: 'MAIN-01',
      address: 'Main Boulevard, Kitchen Club Plaza',
      city: 'Karachi',
      country: 'Pakistan',
      contact_person: client.poc_full_name || 'Kitchen Club Admin',
      phone: client.phone || undefined,
      email: client.email || undefined,
      tax_region: tax.tax_code,
      tax_settings: {
        default_tax_code: tax.tax_code,
      },
      inventory_store_type: 'branch' as const,
      is_production_source: true,
      production_source_label: 'Kitchen Club Main Kitchen',
      modules_enabled: this.resolveStarterModules(client),
      opening_time: '09:00',
      closing_time: '23:00',
      operational_settings: {
        default_order_type: 'takeout' as const,
        require_open_shift: false,
        require_sale_counter: true,
        floor_service_enabled: false,
        pickup_enabled: true,
        delivery_enabled: false,
      },
      status: 'active' as const,
    };

    const existing = await this.branchRepository.findOne({
      where: { client_id: client.client_code, branch_code: 'MAIN-01' },
    });

    if (!existing) {
      return this.branchesService.create(client.client_code, branchPayload, actorId);
    }

    return this.branchesService.update(client.client_code, existing.id, branchPayload, actorId);
  }

  private async ensureKitchenClubSaleCounter(
    clientId: string,
    branchId: number,
  ): Promise<SaleCounter> {
    const existing = await this.saleCounterRepository.findOne({
      where: { client_id: clientId, branch_id: branchId, code: 'KC-MAIN-01' },
    });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        return this.saleCounterRepository.save(existing);
      }
      return existing;
    }

    const conflictingCounter = await this.saleCounterRepository.findOne({
      where: { code: 'KC-MAIN-01' },
    });
    if (conflictingCounter && conflictingCounter.client_id !== clientId) {
      throw new BadRequestException(
        'Sale counter code KC-MAIN-01 is already assigned to another client.',
      );
    }

    return this.saleCounterService.create({
      branch_id: branchId,
      code: 'KC-MAIN-01',
      name: 'Main Counter',
      description: 'Primary starter sale counter for Kitchen Club.',
      is_active: true,
    }, clientId);
  }

  private async ensureKitchenClubUsers(
    client: Client,
    branchId: number,
    branchManagerRoleId: number,
    cashierRoleId: number,
    starterUsers: BootstrapClientStarterUsersOptions,
  ): Promise<UserManagement[]> {
    const slug = this.normalizeSlug(client.domain_slug || client.client_name || client.client_code)
      .replace(/-/g, '');

    const branchManager = await this.ensureStarterBranchUser({
      clientId: client.client_code,
      username: `${slug}.manager`,
      fullName: 'Kitchen Club Branch Manager',
      password: starterUsers.branchManagerPassword,
      roleId: branchManagerRoleId,
      branchId,
    });
    const cashier = await this.ensureStarterBranchUser({
      clientId: client.client_code,
      username: `${slug}.cashier`,
      fullName: 'Kitchen Club Cashier',
      password: starterUsers.cashierPassword,
      roleId: cashierRoleId,
      branchId,
    });

    return [branchManager, cashier];
  }

  private async ensureStarterBranchUser(input: {
    clientId: string;
    username: string;
    fullName: string;
    password: string;
    roleId: number;
    branchId: number;
  }): Promise<UserManagement> {
    const existing = await this.userRepository.findOne({
      where: { user_name: input.username },
    });

    if (existing && existing.client_id !== input.clientId) {
      throw new BadRequestException(
        `Bootstrap user ${input.username} already belongs to client ${existing.client_id}.`,
      );
    }

    if (existing && existing.user_type !== 'BRANCH_STAFF') {
      throw new BadRequestException(
        `Bootstrap user ${input.username} already exists with type ${existing.user_type}.`,
      );
    }

    if (!existing) {
      return this.usersService.create(input.clientId, {
        full_name: input.fullName,
        user_name: input.username,
        password: input.password,
        role_id: input.roleId,
        user_type: 'BRANCH_STAFF',
        status: 'active',
        branchAssignments: [
          {
            branchId: input.branchId,
            roleId: input.roleId,
            isPrimary: true,
            assignmentScope: 'branch',
          },
        ],
      });
    }

    return this.usersService.update(input.clientId, Number(existing.id), {
      full_name: input.fullName,
      role_id: input.roleId,
      user_type: 'BRANCH_STAFF',
      status: 'active',
      branchAssignments: [
        {
          branchId: input.branchId,
          roleId: input.roleId,
          isPrimary: true,
          assignmentScope: 'branch',
        },
      ],
    });
  }

  private async ensureKitchenClubCatalog(
    clientId: string,
    branchId: number,
    taxConfigurationId: number,
  ) {
    const PriceProfile = await this.ensurePriceProfile(clientId, 'All Day', 'ALL-DAY', 1);
    const station = await this.ensureStation(clientId, 'Main Kitchen', 'MAIN-KITCHEN');
    const uom = await this.ensureUom(clientId, 'Plate', 'PLT', true);

    const categorySeeds = [
      { name: 'Rice Bowls', sortOrder: 1 },
      { name: 'Burgers', sortOrder: 2 },
      { name: 'Beverages', sortOrder: 3 },
    ];
    const categories = new Map<string, Category>();
    for (const seed of categorySeeds) {
      categories.set(
        seed.name,
        await this.ensureCategory(clientId, seed.name, seed.sortOrder),
      );
    }

    const productSeeds: StarterCatalogProductSeed[] = [
      {
        productName: 'Chicken Biryani Bowl',
        sku: 'KC-BIR-001',
        productCode: 'BIRYANI-BOWL',
        description: 'Kitchen Club starter signature biryani bowl.',
        categoryName: 'Rice Bowls',
        basePrice: 690,
        deliveryMinutes: 18,
      },
      {
        productName: 'Smash Chicken Burger',
        sku: 'KC-BUR-001',
        productCode: 'SMASH-BURGER',
        description: 'Starter burger for pilot ordering flows.',
        categoryName: 'Burgers',
        basePrice: 560,
        deliveryMinutes: 14,
      },
      {
        productName: 'Mint Lemonade',
        sku: 'KC-BEV-001',
        productCode: 'MINT-LEMONADE',
        description: 'Starter beverage for POS and menu validation.',
        categoryName: 'Beverages',
        basePrice: 240,
        deliveryMinutes: 6,
      },
    ];

    for (const seed of productSeeds) {
      const category = categories.get(seed.categoryName);
      if (!category) {
        throw new BadRequestException(`Starter category ${seed.categoryName} is missing.`);
      }

      const product = await this.ensureProduct(clientId, {
        product_name: seed.productName,
        product_description: seed.description,
        product_sku: seed.sku,
        product_code: seed.productCode,
        product_base_price: seed.basePrice,
        category_id: category.id,
        price_profile_id: PriceProfile.id,
        production_station_id: station.id,
        base_uom_id: uom.id,
        tax_configuration_id: taxConfigurationId,
        product_is_configurable: false,
        is_active: true,
        is_branch_active: true,
        distribution_scope: 'all',
      });

      await this.catalogService.setBranchMapping(
        clientId,
        branchId,
        product.id,
        true,
      );
      await this.catalogService.updateBranchPrice(clientId, branchId, {
        product_id: product.id,
        price_profile_id: PriceProfile.id,
        price: seed.basePrice,
        delivery_minutes: seed.deliveryMinutes,
      });
    }

    return {
      price_profile_count: 1,
      category_count: categorySeeds.length,
      product_count: productSeeds.length,
    };
  }

  private async ensureKitchenClubInventory(clientId: string, branchId: number) {
    const rawMaterials = await this.ensureInventoryClass(clientId, 'Raw Materials');
    const kitchenInputs = await this.ensureInventoryType(clientId, rawMaterials.id, 'Kitchen Inputs');

    const protein = await this.ensureInventorySubType(clientId, kitchenInputs.id, 'Protein');
    const grains = await this.ensureInventorySubType(clientId, kitchenInputs.id, 'Grains');
    const beverages = await this.ensureInventorySubType(clientId, kitchenInputs.id, 'Beverage Mixes');

    const starterItems = [
      {
        name: 'Chicken Fillet',
        sku: 'INV-CHK-001',
        uomBase: 'KG',
        uomPurchase: 'Carton',
        subTypeId: protein.id,
        min: 5,
        max: 25,
        openingStock: 12,
        unitCost: 840,
      },
      {
        name: 'Premium Basmati Rice',
        sku: 'INV-RIC-001',
        uomBase: 'KG',
        uomPurchase: 'Bag',
        subTypeId: grains.id,
        min: 10,
        max: 40,
        openingStock: 20,
        unitCost: 320,
      },
      {
        name: 'Mint Syrup',
        sku: 'INV-BEV-001',
        uomBase: 'LTR',
        uomPurchase: 'Bottle',
        subTypeId: beverages.id,
        min: 2,
        max: 10,
        openingStock: 4,
        unitCost: 490,
      },
    ];

    for (const seed of starterItems) {
      const item = await this.ensureInventoryItem(clientId, seed.subTypeId, {
        item_name: seed.name,
        item_sku: seed.sku,
        uom_base: seed.uomBase,
        uom_purchase: seed.uomPurchase,
        item_is_active: true,
      });

      await this.inventoryService.toggleBranchItem(clientId, branchId, item.id, true);
      await this.inventoryService.updateBranchStockLevels(
        clientId,
        branchId,
        item.id,
        seed.min,
        seed.max,
      );
      await this.upsertOpeningStock(
        clientId,
        branchId,
        item.id,
        seed.openingStock,
        seed.unitCost,
        seed.min,
        seed.max,
      );
    }

    return {
      class_count: 1,
      type_count: 1,
      sub_type_count: 3,
      item_count: starterItems.length,
    };
  }

  private async upsertOpeningStock(
    clientId: string,
    branchId: number,
    itemId: number,
    quantity: number,
    unitCost: number,
    minLevel: number,
    maxLevel: number,
  ): Promise<void> {
    let branchInventory = await this.branchInventoryRepository.findOne({
      where: { branch_id: branchId, item_id: itemId },
    });
    if (!branchInventory) {
      branchInventory = this.branchInventoryRepository.create({
        branch_id: branchId,
        item_id: itemId,
      });
    }

    branchInventory.is_enabled = true;
    branchInventory.current_stock = quantity;
    branchInventory.min_stock_level = minLevel;
    branchInventory.max_stock_level = maxLevel;
    await this.branchInventoryRepository.save(branchInventory);

    let stockLevel = await this.stockLevelRepository.findOne({
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
    });
    if (!stockLevel) {
      stockLevel = this.stockLevelRepository.create({
        client_id: clientId,
        branch_id: branchId,
        item_id: itemId,
      });
    }

    stockLevel.current_quantity = quantity;
    stockLevel.last_unit_cost = unitCost;
    stockLevel.last_received_at = new Date();
    await this.stockLevelRepository.save(stockLevel);
  }

  private async ensureRoleByName(clientId: string, roleName: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { client_id: clientId, role_name: roleName, is_active: true },
    });
    if (!role) {
      throw new BadRequestException(`Starter role ${roleName} could not be resolved.`);
    }

    return role;
  }

  private async ensurePriceProfile(
    clientId: string,
    name: string,
    code: string,
    sortOrder: number,
  ): Promise<PriceProfile> {
    const existing = await this.PriceProfileRepository.findOne({
      where: { client_id: clientId, name },
    });
    if (existing) {
      let shouldSave = false;
      if (!existing.is_active) {
        existing.is_active = true;
        shouldSave = true;
      }
      if (!existing.code) {
        existing.code = code;
        shouldSave = true;
      }
      if (existing.sort_order !== sortOrder) {
        existing.sort_order = sortOrder;
        shouldSave = true;
      }
      return shouldSave ? this.PriceProfileRepository.save(existing) : existing;
    }

    return this.catalogService.createPriceProfile(clientId, {
      name,
      code,
      description: `${name} starter menu for Kitchen Club bootstrap.`,
      is_active: true,
      sort_order: sortOrder,
    });
  }

  private async ensureStation(clientId: string, name: string, code: string): Promise<Station> {
    const existing = await this.stationRepository.findOne({
      where: { client_id: clientId, name },
    });
    if (existing) {
      let shouldSave = false;
      if (!existing.is_active) {
        existing.is_active = true;
        shouldSave = true;
      }
      if (!existing.code) {
        existing.code = code;
        shouldSave = true;
      }
      if (!existing.supports_hot_food) {
        existing.supports_hot_food = true;
        shouldSave = true;
      }
      if (!existing.supports_cold_food) {
        existing.supports_cold_food = true;
        shouldSave = true;
      }
      return shouldSave ? this.stationRepository.save(existing) : existing;
    }

    return this.catalogService.createStation(clientId, {
      name,
      code,
      description: 'Primary production station for Kitchen Club starter data.',
      is_active: true,
      supports_hot_food: true,
      supports_cold_food: true,
      kitchen_display_order: 1,
    });
  }

  private async ensureUom(
    clientId: string,
    name: string,
    abbreviation: string,
    isBaseUnit: boolean,
  ): Promise<Uom> {
    const existing = await this.uomRepository.findOne({
      where: { client_id: clientId, abbreviation },
    });
    if (existing) {
      let shouldSave = false;
      if (!existing.is_active) {
        existing.is_active = true;
        shouldSave = true;
      }
      if (existing.is_base_unit !== isBaseUnit) {
        existing.is_base_unit = isBaseUnit;
        shouldSave = true;
      }
      return shouldSave ? this.uomRepository.save(existing) : existing;
    }

    return this.catalogService.createUom(clientId, {
      name,
      abbreviation,
      description: `${name} starter unit.`,
      is_active: true,
      is_base_unit: isBaseUnit,
    });
  }

  private async ensureCategory(
    clientId: string,
    categoryName: string,
    sortOrder: number,
  ): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: { client_id: clientId, category_name: categoryName },
    });
    if (existing) {
      let shouldSave = false;
      if (!existing.is_active) {
        existing.is_active = true;
        shouldSave = true;
      }
      if (existing.category_sort_order !== sortOrder) {
        existing.category_sort_order = sortOrder;
        shouldSave = true;
      }
      return shouldSave ? this.categoryRepository.save(existing) : existing;
    }

    return this.catalogService.createCategory(clientId, {
      category_name: categoryName,
      category_description: `${categoryName} starter category.`,
      category_sort_order: sortOrder,
    });
  }

  private async ensureProduct(
    clientId: string,
    payload: {
      product_name: string;
      product_description: string;
      product_sku: string;
      product_code: string;
      product_base_price: number;
      category_id: number;
      price_profile_id: number;
      production_station_id: number;
      base_uom_id: number;
      tax_configuration_id: number;
      product_is_configurable: boolean;
      is_active: boolean;
      is_branch_active: boolean;
      distribution_scope: 'all' | 'selected';
    },
  ): Promise<Product> {
    const existing = await this.productRepository.findOne({
      where: { client_id: clientId, product_name: payload.product_name },
    });
    if (existing) {
      Object.assign(existing, payload);
      return this.productRepository.save(existing);
    }

    return this.catalogService.createProduct(clientId, payload);
  }

  private async ensureInventoryClass(clientId: string, className: string): Promise<InventoryClass> {
    const existing = await this.inventoryClassRepository.findOne({
      where: { client_id: clientId, class_name: className },
    });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        return this.inventoryClassRepository.save(existing);
      }
      return existing;
    }

    return this.inventoryService.createClass(clientId, {
      class_name: className,
      class_description: `${className} starter class.`,
    });
  }

  private async ensureInventoryType(
    clientId: string,
    classId: number,
    typeName: string,
  ): Promise<InventoryType> {
    const existing = await this.inventoryTypeRepository.findOne({
      where: { client_id: clientId, class_id: classId, type_name: typeName },
    });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        return this.inventoryTypeRepository.save(existing);
      }
      return existing;
    }

    return this.inventoryService.createType(clientId, classId, {
      type_name: typeName,
    });
  }

  private async ensureInventorySubType(
    clientId: string,
    typeId: number,
    subTypeName: string,
  ): Promise<InventorySubType> {
    const existing = await this.inventorySubTypeRepository.findOne({
      where: { client_id: clientId, type_id: typeId, sub_type_name: subTypeName },
    });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        return this.inventorySubTypeRepository.save(existing);
      }
      return existing;
    }

    return this.inventoryService.createSubType(clientId, typeId, {
      sub_type_name: subTypeName,
      affects_stock: true,
      allow_issuance: true,
    });
  }

  private async ensureInventoryItem(
    clientId: string,
    subTypeId: number,
    payload: {
      item_name: string;
      item_sku: string;
      uom_base: string;
      uom_purchase: string;
      item_is_active: boolean;
    },
  ): Promise<InventoryItem> {
    const existing = await this.inventoryItemRepository.findOne({
      where: { client_id: clientId, item_name: payload.item_name },
    });
    if (existing) {
      Object.assign(existing, {
        ...payload,
        sub_type_id: subTypeId,
      });
      return this.inventoryItemRepository.save(existing);
    }

    return this.inventoryService.createItem(clientId, subTypeId, payload);
  }

  private resolveStarterModules(client: Client): string[] {
    const existingModules = client.enabled_modules?.filter(Boolean) || [];
    if (existingModules.length > 0) {
      return existingModules;
    }

    return ['catalog', 'inventory', 'pos', 'orders'];
  }

  private async ensureClientSettings(client: Client): Promise<void> {
    const existing = await this.clientSettingsRepository.findOne({
      where: { client_id: client.client_code },
    });
    if (existing) {
      return;
    }

    await this.clientSettingsRepository.save(
      this.clientSettingsRepository.create({
        client_id: client.client_code,
        currency: client.currency || 'USD',
        timezone: client.timezone || 'UTC',
        contact_email: client.email || client.poc_email || null,
        contact_phone: client.phone || client.poc_phone || null,
        address: client.address || null,
      } as Partial<ClientSettings>),
    );
  }

  private async ensureCurrentSubscription(
    client: Client,
    plan: SubscriptionPlan,
  ): Promise<{ subscription: ClientSubscription | null; created: boolean }> {
    const existing = await this.clientSubscriptionRepository.findOne({
      where: { client_id: client.client_code, plan_id: plan.id, status: 'active' },
      order: { created_at: 'DESC' },
    });
    if (existing) {
      return { subscription: existing, created: false };
    }

    const now = new Date();
    const created = await this.clientSubscriptionRepository.save(
      this.clientSubscriptionRepository.create({
        client_id: client.client_code,
        plan_id: plan.id,
        plan_code_snapshot: plan.plan_code,
        plan_name_snapshot: plan.plan_name,
        plan_description_snapshot: plan.description || null,
        currency_code_snapshot: plan.currency_code || client.currency || 'USD',
        billing_cycle: 'monthly',
        status: 'active',
        is_trial: false,
        effective_start_at: now,
        activated_at: now,
        price_snapshot: Number(plan.monthly_price || 0),
        assignment_reason: 'Release bootstrap initialization',
        assignment_notes: 'Initial tenant subscription created by bootstrap runner.',
        created_by: 'bootstrap',
        updated_by: 'bootstrap',
      }),
    );

    return { subscription: created, created: true };
  }

  private async resolveExistingUser(
    username: string,
    email: string,
    expectedUserType: string,
    expectedClientId: string,
  ): Promise<UserManagement | null> {
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const [byUsername, byEmail] = await Promise.all([
      this.userRepository.findOne({ where: { user_name: normalizedUsername } }),
      this.userRepository.findOne({ where: { email: normalizedEmail } }),
    ]);

    if (byUsername && byEmail && byUsername.id !== byEmail.id) {
      throw new BadRequestException(
        `Bootstrap identity collision: username ${normalizedUsername} and email ${normalizedEmail} belong to different users.`,
      );
    }

    const existing = byUsername || byEmail;
    if (!existing) {
      return null;
    }

    if (existing.user_type !== expectedUserType) {
      throw new BadRequestException(
        `Bootstrap user ${normalizedUsername} already exists with type ${existing.user_type}, expected ${expectedUserType}.`,
      );
    }

    if (existing.client_id !== expectedClientId) {
      throw new BadRequestException(
        `Bootstrap user ${normalizedUsername} already belongs to client ${existing.client_id}, expected ${expectedClientId}.`,
      );
    }

    return existing;
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
