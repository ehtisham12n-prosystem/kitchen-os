import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { BranchProductMapping } from './entities/branch-product-mapping.entity';
import { PriceProfile } from './entities/price-profile.entity';
import { CuisineType } from './entities/cuisine-type.entity';
import { Station } from './entities/station.entity';
import { Uom } from './entities/uom.entity';
import { ProductBranchPrice } from './entities/product-branch-price.entity';
import { ProductCustomization } from './entities/product-customization.entity';
import { Client } from '../platform/entities/client.entity';
import { Branch } from '../setup/entities/branch.entity';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';
import { RecipeCostingService } from '../recipe/recipe-costing.service';
import { UomConversionService } from '../common/uom-conversion.service';
import {
  BranchAvailabilityDto,
  CreateCuisineTypeDto,
  CreateProductDto,
  CreateUomDto,
  OrderChannelAvailabilityDto,
  ProductCustomizationDto,
  UpdateBranchPriceDto,
  UpdateCuisineTypeDto,
  UpdateProductDto,
  UpdateUomDto,
} from './dto/catalog-write.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreatePriceProfileDto,
  UpdatePriceProfileDto,
  CreateStationDto,
  UpdateStationDto,
} from './dto/taxonomy.dto';

type SupportedOrderChannel = 'dine_in' | 'takeout' | 'delivery';
type TaxonomyDependencyKind = 'category' | 'price-profile' | 'cuisine-type' | 'station' | 'uom';

const SUPPORTED_ORDER_CHANNELS: SupportedOrderChannel[] = ['dine_in', 'takeout', 'delivery'];

export type BranchProductSaleContext = {
  product: Product;
  mapping: BranchProductMapping | null;
  branch_enabled: boolean;
  allow_open_order_return: boolean;
  master_allow_open_order_return: boolean;
  effective_enabled: boolean;
  is_temporarily_disabled: boolean;
  temporarily_disabled_until: Date | null;
  temporary_disable_reason: string | null;
  channel_enabled: boolean;
  channel_availability: Record<SupportedOrderChannel, boolean>;
  effective_price_profile_id: number | null;
  effective_price_profile_name: string | null;
  menu_assignment_source: 'branch_override' | 'master' | 'unassigned';
  effective_price: number;
  price_source: 'branch_menu_price' | 'branch_customization_price' | 'branch_base_override' | 'master_base_price';
  unavailable_reason: 'master_inactive' | 'branch_disabled' | 'temporary_disable' | 'channel_disabled' | null;
};

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductCustomization) private customizationRepo: Repository<ProductCustomization>,
    @InjectRepository(BranchProductMapping)
    private mappingRepo: Repository<BranchProductMapping>,
    @InjectRepository(ProductBranchPrice)
    private priceRepo: Repository<ProductBranchPrice>,
    @InjectRepository(PriceProfile) private priceProfileRepo: Repository<PriceProfile>,
    @InjectRepository(CuisineType) private cuisineRepo: Repository<CuisineType>,
    @InjectRepository(Station) private stationRepo: Repository<Station>,
    @InjectRepository(Uom) private uomRepo: Repository<Uom>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(TaxConfiguration)
    private taxConfigRepo: Repository<TaxConfiguration>,
    private readonly recipeCostingService: RecipeCostingService,
    private readonly uomConversionService: UomConversionService,
  ) {}

  private getDefaultBranchEnabled(scope: 'all' | 'selected' | undefined): boolean {
    return scope === 'all';
  }

  private getTaxonomyDependencyConfig(kind: string): {
    kind: TaxonomyDependencyKind;
    label: string;
    productProperty: keyof Product;
    productColumn: string;
  } {
    switch (kind) {
      case 'category':
        return { kind: 'category', label: 'Category', productProperty: 'category_id', productColumn: 'category_id' };
      case 'price-profile':
        return { kind: 'price-profile', label: 'Price Profile', productProperty: 'price_profile_id', productColumn: 'price_profile_id' };
      case 'cuisine-type':
        return { kind: 'cuisine-type', label: 'Cuisine Type', productProperty: 'cuisine_type_id', productColumn: 'cuisine_type_id' };
      case 'station':
        return { kind: 'station', label: 'Station', productProperty: 'production_station_id', productColumn: 'production_station_id' };
      case 'uom':
        return { kind: 'uom', label: 'UOM', productProperty: 'base_uom_id', productColumn: 'base_uom_id' };
      default:
        throw new BadRequestException(`Unsupported taxonomy kind ${kind}`);
    }
  }

  private async getTaxonomyItemSummary(
    clientId: string,
    kind: TaxonomyDependencyKind,
    id: number,
  ): Promise<{ id: number; name: string }> {
    switch (kind) {
      case 'category': {
        const item = await this.categoryRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
        if (!item) throw new NotFoundException('Category not found');
        return { id: item.id, name: item.category_name };
      }
      case 'price-profile': {
        const item = await this.priceProfileRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
        if (!item) throw new NotFoundException('Menu Type not found');
        return { id: item.id, name: item.name };
      }
      case 'cuisine-type': {
        const item = await this.cuisineRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
        if (!item) throw new NotFoundException('Cuisine Type not found');
        return { id: item.id, name: item.name };
      }
      case 'station': {
        const item = await this.stationRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
        if (!item) throw new NotFoundException('Station not found');
        return { id: item.id, name: item.name };
      }
      case 'uom': {
        const item = await this.uomRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
        if (!item) throw new NotFoundException('UOM not found');
        return { id: item.id, name: item.name };
      }
    }
  }

  private async getTaxonomyReplacementOptions(
    clientId: string,
    kind: TaxonomyDependencyKind,
    excludeId: number,
  ): Promise<Array<{ id: number; name: string }>> {
    switch (kind) {
      case 'category':
        return (await this.categoryRepo.find({ where: { client_id: clientId, is_active: true }, order: { category_name: 'ASC' } }))
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.category_name }));
      case 'price-profile':
        return (await this.priceProfileRepo.find({ where: { client_id: clientId, is_active: true }, order: { name: 'ASC' } }))
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.name }));
      case 'cuisine-type':
        return (await this.cuisineRepo.find({ where: { client_id: clientId, is_active: true }, order: { name: 'ASC' } }))
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.name }));
      case 'station':
        return (await this.stationRepo.find({ where: { client_id: clientId, is_active: true }, order: { name: 'ASC' } }))
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.name }));
      case 'uom':
        return (await this.uomRepo.find({ where: { client_id: clientId, is_active: true }, order: { name: 'ASC' } }))
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.name }));
    }
  }

  private async getClientBranches(clientId: string): Promise<Branch[]> {
    return this.branchRepo.find({
      where: { client_id: clientId },
      order: { branch_name: 'ASC' },
    });
  }

  private getBranchEnabled(
    product: Pick<Product, 'distribution_scope'>,
    mapping?: Pick<BranchProductMapping, 'is_enabled'> | null,
    defaultEnabled?: boolean,
  ): boolean {
    if (mapping) {
      return mapping.is_enabled;
    }

    if (defaultEnabled !== undefined) {
      return defaultEnabled;
    }

    return this.getDefaultBranchEnabled(product.distribution_scope);
  }

  private getAllowOpenOrderReturn(
    product: Pick<Product, 'allow_open_order_return'>,
    mapping?: Pick<BranchProductMapping, 'allow_open_order_return'> | null,
    baseMapping?: Pick<BranchProductMapping, 'allow_open_order_return'> | null,
  ): boolean {
    if (mapping?.allow_open_order_return !== null && mapping?.allow_open_order_return !== undefined) {
      return Boolean(mapping.allow_open_order_return);
    }

    if (baseMapping?.allow_open_order_return !== null && baseMapping?.allow_open_order_return !== undefined) {
      return Boolean(baseMapping.allow_open_order_return);
    }

    return Boolean(product.allow_open_order_return);
  }

  private async findBranchMapping(
    branchId: number,
    productId: number,
    PriceProfileId?: number | null,
  ): Promise<BranchProductMapping | null> {
    if (PriceProfileId !== undefined) {
      return this.mappingRepo.findOne({
        where: {
          branch_id: branchId,
          product_id: productId,
          price_profile_id: PriceProfileId === null ? IsNull() : PriceProfileId,
        },
      });
    }

    return this.mappingRepo.findOne({
      where: {
        branch_id: branchId,
        product_id: productId,
        price_profile_id: IsNull(),
      },
    });
  }

  private getEffectivePriceProfileId(
    product: Pick<Product, 'price_profile_id'>,
    mapping?: Pick<BranchProductMapping, 'price_profile_id'> | null,
  ): number | null {
    if (mapping?.price_profile_id) {
      return mapping.price_profile_id;
    }

    return product.price_profile_id ?? null;
  }

  private getMenuAssignmentSource(
    product: Pick<Product, 'price_profile_id'>,
    mapping?: Pick<BranchProductMapping, 'price_profile_id'> | null,
  ): 'branch_override' | 'master' | 'unassigned' {
    if (mapping?.price_profile_id) {
      return 'branch_override';
    }

    if (product.price_profile_id) {
      return 'master';
    }

    return 'unassigned';
  }

  private normalizeChannelAvailability(
    availability?: OrderChannelAvailabilityDto | Record<string, boolean> | null,
  ): Record<SupportedOrderChannel, boolean> {
    return {
      dine_in: availability?.dine_in ?? true,
      takeout: availability?.takeout ?? true,
      delivery: availability?.delivery ?? true,
    };
  }

  private hasChannelAvailabilityOverride(
    availability?: OrderChannelAvailabilityDto | Record<string, boolean> | null,
  ): boolean {
    const normalized = this.normalizeChannelAvailability(availability);
    return SUPPORTED_ORDER_CHANNELS.some((channel) => normalized[channel] !== true);
  }

  private getEffectiveChannelAvailability(
    mapping?: Pick<BranchProductMapping, 'channel_availability'> | null,
  ): Record<SupportedOrderChannel, boolean> {
    return this.normalizeChannelAvailability(mapping?.channel_availability);
  }

  private parseTemporaryDisableUntil(value?: string | Date | null): Date | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid temporary disable timestamp');
    }

    if (parsed.getTime() <= Date.now()) {
      throw new BadRequestException('Temporary disable timestamp must be in the future');
    }

    return parsed;
  }

  private getTemporaryDisableState(
    mapping?: Pick<BranchProductMapping, 'temporarily_disabled_until' | 'temporary_disable_reason'> | null,
  ) {
    const until = mapping?.temporarily_disabled_until
      ? new Date(mapping.temporarily_disabled_until)
      : null;
    const isValidDate = until && !Number.isNaN(until.getTime());

    return {
      temporarily_disabled_until: isValidDate ? until : null,
      temporary_disable_reason: mapping?.temporary_disable_reason?.trim() || null,
      is_temporarily_disabled: !!isValidDate && until.getTime() > Date.now(),
    };
  }

  private isChannelEnabled(
    mapping: Pick<BranchProductMapping, 'channel_availability'> | null | undefined,
    channel?: string,
  ): boolean {
    if (!channel) {
      return true;
    }

    if (!SUPPORTED_ORDER_CHANNELS.includes(channel as SupportedOrderChannel)) {
      throw new BadRequestException(`Unsupported order channel ${channel}`);
    }

    return this.getEffectiveChannelAvailability(mapping)[channel as SupportedOrderChannel];
  }

  private buildBaseBranchPriceMap(prices: ProductBranchPrice[]): Map<string, ProductBranchPrice> {
    return new Map(
      prices
        .filter((price) => !price.customization_id)
        .map((price) => [`${price.product_id}:${price.price_profile_id}`, price]),
    );
  }

  private buildCustomizationBranchPriceMap(prices: ProductBranchPrice[]): Map<string, number> {
    const priceMap = new Map<string, number>();
    prices
      .filter((price) => !!price.customization_id)
      .forEach((price) => {
        const key = `${price.product_id}:${price.price_profile_id}`;
        const nextValue = Number(price.price || 0);
        const currentValue = priceMap.get(key);
        if (currentValue === undefined || nextValue < currentValue) {
          priceMap.set(key, nextValue);
        }
      });
    return priceMap;
  }

  private buildAnyCustomizationBranchPriceMap(prices: ProductBranchPrice[]): Map<number, number> {
    const priceMap = new Map<number, number>();
    prices
      .filter((price) => !!price.customization_id)
      .forEach((price) => {
        const key = Number(price.product_id);
        const nextValue = Number(price.price || 0);
        const currentValue = priceMap.get(key);
        if (currentValue === undefined || nextValue < currentValue) {
          priceMap.set(key, nextValue);
        }
      });
    return priceMap;
  }

  private choosePrimaryBranchMapping(
    product: Product,
    mappings: BranchProductMapping[],
    basePriceMap: Map<string, ProductBranchPrice>,
    customizationPriceMap: Map<string, number>,
  ): BranchProductMapping | null {
    if (mappings.length === 0) {
      return null;
    }

    const score = (mapping: BranchProductMapping) => {
      const PriceProfileId = mapping.price_profile_id ?? product.price_profile_id ?? null;
      const priceKey = `${product.id}:${PriceProfileId}`;
      return (
        (mapping.is_enabled ? 100 : 0)
        + (PriceProfileId !== null && basePriceMap.has(priceKey) ? 20 : 0)
        + (PriceProfileId !== null && customizationPriceMap.has(priceKey) ? 15 : 0)
        + (mapping.price_override !== null && mapping.price_override !== undefined ? 10 : 0)
        + (mapping.price_profile_id !== null && mapping.price_profile_id !== undefined ? 5 : 0)
      );
    };

    return [...mappings].sort((left, right) => score(right) - score(left))[0] ?? null;
  }

  private resolveEffectivePrice(
    product: Pick<Product, 'id' | 'price_profile_id' | 'product_base_price'>,
    mapping: Pick<BranchProductMapping, 'price_profile_id' | 'price_override'> | null | undefined,
    basePriceMap: Map<string, ProductBranchPrice>,
    customizationPriceMap: Map<string, number>,
    anyCustomizationPriceMap: Map<number, number>,
  ): { value: number; source: 'branch_menu_price' | 'branch_customization_price' | 'branch_base_override' | 'master_base_price' } {
    const effectivePriceProfileId = this.getEffectivePriceProfileId(product, mapping);

    if (effectivePriceProfileId) {
      const branchMenuPrice = basePriceMap.get(`${product.id}:${effectivePriceProfileId}`);
      if (branchMenuPrice) {
        return {
          value: Number(branchMenuPrice.price || 0),
          source: 'branch_menu_price',
        };
      }

      const branchCustomizationPrice = customizationPriceMap.get(`${product.id}:${effectivePriceProfileId}`);
      if (branchCustomizationPrice !== undefined) {
        return {
          value: Number(branchCustomizationPrice || 0),
          source: 'branch_customization_price',
        };
      }
    }

    const anyCustomizationPrice = anyCustomizationPriceMap.get(Number(product.id));
    if (anyCustomizationPrice !== undefined) {
      return {
        value: Number(anyCustomizationPrice || 0),
        source: 'branch_customization_price',
      };
    }

    if (mapping?.price_override !== null && mapping?.price_override !== undefined) {
      return {
        value: Number(mapping.price_override || 0),
        source: 'branch_base_override',
      };
    }

    return {
      value: Number(product.product_base_price || 0),
      source: 'master_base_price',
    };
  }

  private buildBranchProductSaleContext(
    product: Product,
    mapping: BranchProductMapping | null | undefined,
    baseMapping: BranchProductMapping | null | undefined,
    PriceProfileMap: Map<number, PriceProfile>,
    basePriceMap: Map<string, ProductBranchPrice>,
    customizationPriceMap: Map<string, number>,
    anyCustomizationPriceMap: Map<number, number>,
    channel?: string,
    defaultBranchEnabled?: boolean,
  ): BranchProductSaleContext {
    const branchEnabled = this.getBranchEnabled(product, mapping, defaultBranchEnabled);
    const allowOpenOrderReturn = this.getAllowOpenOrderReturn(product, mapping, baseMapping);
    const temporaryDisableState = this.getTemporaryDisableState(mapping);
    const channelEnabled = this.isChannelEnabled(mapping, channel);
    const effectivePrice = this.resolveEffectivePrice(
      product,
      mapping,
      basePriceMap,
      customizationPriceMap,
      anyCustomizationPriceMap,
    );
    const effectivePriceProfileId = this.getEffectivePriceProfileId(product, mapping);

    let unavailableReason: BranchProductSaleContext['unavailable_reason'] = null;
    if (!product.is_active || !product.is_branch_active) {
      unavailableReason = 'master_inactive';
    } else if (!branchEnabled) {
      unavailableReason = 'branch_disabled';
    } else if (temporaryDisableState.is_temporarily_disabled) {
      unavailableReason = 'temporary_disable';
    } else if (!channelEnabled) {
      unavailableReason = 'channel_disabled';
    }

    return {
      product,
      mapping: mapping ?? null,
      branch_enabled: branchEnabled,
      allow_open_order_return: allowOpenOrderReturn,
      master_allow_open_order_return: Boolean(product.allow_open_order_return),
      effective_enabled: unavailableReason === null,
      is_temporarily_disabled: temporaryDisableState.is_temporarily_disabled,
      temporarily_disabled_until: temporaryDisableState.temporarily_disabled_until,
      temporary_disable_reason: temporaryDisableState.temporary_disable_reason,
      channel_enabled: channelEnabled,
      channel_availability: this.getEffectiveChannelAvailability(mapping),
      effective_price_profile_id: effectivePriceProfileId,
      effective_price_profile_name:
        PriceProfileMap.get(effectivePriceProfileId || 0)?.name
        ?? product.price_profile_entity?.name
        ?? null,
      menu_assignment_source: this.getMenuAssignmentSource(product, mapping),
      effective_price: effectivePrice.value,
      price_source: effectivePrice.source,
      unavailable_reason: unavailableReason,
    };
  }

  private async buildBranchAvailabilitySnapshot(clientId: string, product: Product) {
    const [branches, mappings] = await Promise.all([
      this.getClientBranches(clientId),
      this.mappingRepo.find({ where: { product_id: product.id } }),
    ]);

    const mappingMap = new Map(mappings.map((mapping) => [mapping.branch_id, mapping]));
    return {
      total_branches: branches.length,
      enabled_branch_count: branches.filter((branch) =>
        this.getBranchEnabled(product, mappingMap.get(branch.id)),
      ).length,
      branch_availability: branches.map((branch) => {
        const mapping = mappingMap.get(branch.id);
        const temporaryDisableState = this.getTemporaryDisableState(mapping);
        const isEnabled = this.getBranchEnabled(product, mapping);
        return {
          branch_id: branch.id,
          branch_name: branch.branch_name,
          is_enabled: isEnabled,
          effective_is_enabled:
            isEnabled
            && product.is_active
            && product.is_branch_active
            && !temporaryDisableState.is_temporarily_disabled,
          has_override: !!mapping,
          price_override: mapping?.price_override ?? null,
          price_profile_id: mapping?.price_profile_id ?? null,
          channel_availability: this.getEffectiveChannelAvailability(mapping),
          is_temporarily_disabled: temporaryDisableState.is_temporarily_disabled,
          temporarily_disabled_until: temporaryDisableState.temporarily_disabled_until,
          temporary_disable_reason: temporaryDisableState.temporary_disable_reason,
        };
      }),
    };
  }

  private async syncBranchAvailability(
    clientId: string,
    productId: number,
    distributionScope: 'all' | 'selected',
    branchAvailability: BranchAvailabilityDto[],
  ): Promise<void> {
    const branches = await this.getClientBranches(clientId);
    const branchIds = new Set(branches.map((branch) => branch.id));
    const provided = new Map<number, boolean>();

    for (const entry of branchAvailability) {
      if (!branchIds.has(entry.branch_id)) {
        throw new BadRequestException(`Branch ${entry.branch_id} does not belong to this client`);
      }
      provided.set(entry.branch_id, entry.is_enabled);
    }

    const defaultEnabled = this.getDefaultBranchEnabled(distributionScope);
    const hasAnyEnabled = branches.some((branch) =>
      provided.has(branch.id) ? provided.get(branch.id) : defaultEnabled,
    );

    if (distributionScope === 'selected' && !hasAnyEnabled) {
      throw new BadRequestException('Selected branch distribution requires at least one enabled branch');
    }

    const existingMappings = await this.mappingRepo.find({ where: { product_id: productId } });
    const existingByBranch = new Map(existingMappings.map((mapping) => [mapping.branch_id, mapping]));

    for (const branch of branches) {
      const desiredEnabled = provided.has(branch.id) ? provided.get(branch.id)! : defaultEnabled;
      const existing = existingByBranch.get(branch.id);
      const shouldPersist =
        desiredEnabled !== defaultEnabled ||
        existing?.price_override != null ||
        existing?.price_profile_id != null ||
        this.hasChannelAvailabilityOverride(existing?.channel_availability) ||
        !!existing?.temporarily_disabled_until ||
        !!existing?.temporary_disable_reason;

      if (!shouldPersist) {
        if (existing) {
          await this.mappingRepo.remove(existing);
        }
        continue;
      }

      const mapping = existing ?? this.mappingRepo.create({
        branch_id: branch.id,
        product_id: productId,
      });
      mapping.is_enabled = desiredEnabled;
      await this.mappingRepo.save(mapping);
    }
  }

  private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async assertCategoryBelongsToClient(clientId: string, categoryId?: number): Promise<Category | null> {
    if (!categoryId) {
      return null;
    }

    const category = await this.categoryRepo.findOne({
      where: { id: categoryId, client_id: clientId, is_active: true },
    });
    if (!category) {
      throw new BadRequestException(`Category ${categoryId} does not belong to this client`);
    }

    return category;
  }

  private async assertPriceProfileBelongsToClient(clientId: string, PriceProfileId?: number): Promise<PriceProfile | null> {
    if (!PriceProfileId) {
      return null;
    }

    const PriceProfile = await this.priceProfileRepo.findOne({
      where: { id: PriceProfileId, client_id: clientId, is_active: true },
    });
    if (!PriceProfile) {
      throw new BadRequestException(`Menu type ${PriceProfileId} does not belong to this client`);
    }

    return PriceProfile;
  }

  private async assertCuisineTypeBelongsToClient(clientId: string, cuisineTypeId?: number): Promise<CuisineType | null> {
    if (!cuisineTypeId) {
      return null;
    }

    const cuisineType = await this.cuisineRepo.findOne({
      where: { id: cuisineTypeId, client_id: clientId, is_active: true },
    });
    if (!cuisineType) {
      throw new BadRequestException(`Cuisine type ${cuisineTypeId} does not belong to this client`);
    }

    return cuisineType;
  }

  private async assertStationBelongsToClient(clientId: string, stationId?: number): Promise<Station | null> {
    if (!stationId) {
      return null;
    }

    const station = await this.stationRepo.findOne({
      where: { id: stationId, client_id: clientId, is_active: true },
    });
    if (!station) {
      throw new BadRequestException(`Station ${stationId} does not belong to this client`);
    }

    return station;
  }

  private async assertUomBelongsToClient(clientId: string, uomId?: number): Promise<Uom | null> {
    if (!uomId) {
      return null;
    }

    const uom = await this.uomRepo.findOne({
      where: { id: uomId, client_id: clientId, is_active: true },
    });
    if (!uom) {
      throw new BadRequestException(`UOM ${uomId} does not belong to this client`);
    }

    return uom;
  }

  private async assertTaxBelongsToClient(
    clientId: string,
    taxConfigurationId?: number | null,
  ): Promise<TaxConfiguration | null> {
    if (!taxConfigurationId) {
      return null;
    }

    const taxConfiguration = await this.taxConfigRepo.findOne({
      where: { id: taxConfigurationId, client_id: clientId, is_active: true },
    });
    if (!taxConfiguration) {
      throw new BadRequestException(`Tax configuration ${taxConfigurationId} does not belong to this client`);
    }

    return taxConfiguration;
  }

  private async assertProductBelongsToClient(clientId: string, productId: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId, client_id: clientId },
      relations: [
        'category',
        'cuisine_type',
        'production_station',
        'price_profile_entity',
        'base_uom',
        'tax_configuration',
      ],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async assertCustomizationBelongsToProduct(productId: number, customizationId?: number): Promise<ProductCustomization | null> {
    if (!customizationId) {
      return null;
    }

    const customization = await this.customizationRepo.findOne({
      where: { id: customizationId, product_id: productId },
    });

    if (!customization) {
      throw new BadRequestException(`Customization ${customizationId} does not belong to the selected product`);
    }

    return customization;
  }

  private async validateProductReferences(
    clientId: string,
    dto: Pick<
      CreateProductDto | UpdateProductDto,
      'category_id' | 'cuisine_type_id' | 'price_profile_id' | 'production_station_id' | 'base_uom_id' | 'tax_configuration_id'
    >,
  ): Promise<void> {
    await Promise.all([
      this.assertCategoryBelongsToClient(clientId, dto.category_id),
      this.assertCuisineTypeBelongsToClient(clientId, dto.cuisine_type_id),
      this.assertStationBelongsToClient(clientId, dto.production_station_id),
      this.assertUomBelongsToClient(clientId, dto.base_uom_id),
      this.assertTaxBelongsToClient(clientId, dto.tax_configuration_id),
    ]);
  }

  private async upsertCustomizations(
    productId: number,
    customizations?: ProductCustomizationDto[],
  ): Promise<void> {
    if (!customizations) {
      return;
    }

    await this.customizationRepo.delete({ product_id: productId });

    for (const customization of customizations) {
      const entity = this.customizationRepo.create({
        product_id: productId,
        customization_type: customization.type,
        customization_value: customization.value,
        customization_price_delta: Number(customization.price_delta) || 0,
        customization_is_required: !!customization.is_required,
      });
      await this.customizationRepo.save(entity);
    }
  }

  private async resolveEffectivePriceProfileId(
    clientId: string,
    branchId: number,
    product: Product,
    dto: UpdateBranchPriceDto,
  ): Promise<number> {
    const mapping = await this.mappingRepo.findOne({
      where: { branch_id: branchId, product_id: dto.product_id },
    });

    let effectivePriceProfileId: number | undefined =
      dto.price_profile_id ??
      mapping?.price_profile_id ??
      undefined;

    if (!effectivePriceProfileId) {
      const fallbackPriceProfile = await this.priceProfileRepo.findOne({
        where: { client_id: clientId },
        order: { id: 'ASC' },
      });
      effectivePriceProfileId = fallbackPriceProfile?.id;
    }

    if (!effectivePriceProfileId) {
      throw new BadRequestException('A price_profile_id is required for branch pricing');
    }

    await this.assertPriceProfileBelongsToClient(clientId, effectivePriceProfileId);
    return effectivePriceProfileId;
  }

  async getBranchProductSaleContext(
    clientId: string,
    branchId: number,
    productId: number,
    channel?: string,
  ): Promise<BranchProductSaleContext> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const product = await this.assertProductBelongsToClient(clientId, productId);

    const [mappings, PriceProfiles, prices] = await Promise.all([
      this.mappingRepo.find({
        where: { branch_id: branchId, product_id: productId },
      }),
      this.priceProfileRepo.find({
        where: { client_id: clientId, is_active: true },
      }),
      this.priceRepo.find({
        where: { branch_id: branchId, product_id: productId },
      }),
    ]);

    const basePriceMap = this.buildBaseBranchPriceMap(prices);
    const customizationPriceMap = this.buildCustomizationBranchPriceMap(prices);
    const anyCustomizationPriceMap = this.buildAnyCustomizationBranchPriceMap(prices);

    const primaryMapping = this.choosePrimaryBranchMapping(
      product,
      mappings,
      basePriceMap,
      customizationPriceMap,
    );

    return this.buildBranchProductSaleContext(
      product,
      primaryMapping,
      mappings.find((entry) => entry.price_profile_id === null) ?? null,
      new Map(PriceProfiles.map((PriceProfile) => [PriceProfile.id, PriceProfile])),
      basePriceMap,
      customizationPriceMap,
      anyCustomizationPriceMap,
      channel,
    );
  }

  async getBranchPricing(clientId: string, branchId: number, PriceProfileId?: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const products = await this.productRepo.find({
      where: { client_id: clientId },
      relations: ['category', 'cuisine_type', 'production_station', 'price_profile_entity', 'tax_configuration'],
    });

    const PriceProfiles = await this.priceProfileRepo.find({
      where: { client_id: clientId, is_active: true },
    });
    const effectivePriceProfileId = PriceProfileId ?? PriceProfiles[0]?.id ?? null;

    const mappings = await this.mappingRepo.find({
      where: { branch_id: branchId },
    });
    const mappingMap = new Map<number, BranchProductMapping[]>();
    mappings.forEach((mapping) => {
      const list = mappingMap.get(mapping.product_id) ?? [];
      list.push(mapping);
      mappingMap.set(mapping.product_id, list);
    });

    const customizations = await this.customizationRepo.find({
      where: { product: { client_id: clientId } },
    });

    const prices = await this.priceRepo.find({
      where: { branch_id: branchId },
      relations: ['station'],
    });

    const PriceProfileMap = new Map(PriceProfiles.map((PriceProfile) => [PriceProfile.id, PriceProfile]));
    const basePriceMap = this.buildBaseBranchPriceMap(prices);
    const customizationPriceMap = this.buildCustomizationBranchPriceMap(prices);
    const anyCustomizationPriceMap = this.buildAnyCustomizationBranchPriceMap(prices);
    const recipeCostSummaryMap = await this.recipeCostingService.getProductRecipeCostSummaries(
      clientId,
      products,
      branchId,
    );

    return {
      products: products.map((product) => {
        const productMappings = mappingMap.get(product.id) ?? [];
        const primaryMapping = effectivePriceProfileId
          ? productMappings.find((entry) => Number(entry.price_profile_id) === Number(effectivePriceProfileId))
            ?? productMappings.find((entry) => entry.price_profile_id === null)
            ?? this.choosePrimaryBranchMapping(product, productMappings, basePriceMap, customizationPriceMap)
          : productMappings.find((entry) => entry.price_profile_id === null)
            ?? this.choosePrimaryBranchMapping(product, productMappings, basePriceMap, customizationPriceMap);
        const { product: _ignoredProduct, mapping: _ignoredMapping, ...branchContext } =
          this.buildBranchProductSaleContext(
          product,
          primaryMapping,
          productMappings.find((entry) => entry.price_profile_id === null) ?? null,
          PriceProfileMap,
          basePriceMap,
          customizationPriceMap,
          anyCustomizationPriceMap,
          undefined,
          effectivePriceProfileId ? false : undefined,
        );

        return {
          ...product,
          is_enabled: branchContext.branch_enabled,
          ...branchContext,
          recipe_cost_summary: recipeCostSummaryMap.get(product.id) ?? null,
        };
      }),
      PriceProfiles,
      customizations,
      prices,
    };
  }

  async updateBranchPrice(clientId: string, branchId: number, dto: UpdateBranchPriceDto) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const product = await this.assertProductBelongsToClient(clientId, dto.product_id);
    const effectivePriceProfileId = await this.resolveEffectivePriceProfileId(clientId, branchId, product, dto);
    const mapping = await this.findBranchMapping(branchId, dto.product_id, effectivePriceProfileId);
    const isBranchEnabled = this.getBranchEnabled(product, mapping, false);
    if (!isBranchEnabled || !product.is_active || !product.is_branch_active) {
      throw new BadRequestException('Branch pricing can only be changed for products enabled for this menu type');
    }
    await this.assertCustomizationBelongsToProduct(product.id, dto.customization_id);

    const resolvedPrice = dto.price ?? dto.price_override;
    if (resolvedPrice === undefined) {
      throw new BadRequestException('A price value is required for branch pricing');
    }

    let priceQuery = this.priceRepo.createQueryBuilder('price')
      .where('price.branch_id = :branchId', { branchId })
      .andWhere('price.product_id = :productId', { productId: dto.product_id })
      .andWhere('price.price_profile_id = :PriceProfileId', { PriceProfileId: effectivePriceProfileId });

    if (dto.customization_id) {
      priceQuery = priceQuery.andWhere('price.customization_id = :customizationId', {
        customizationId: dto.customization_id,
      });
    } else {
      priceQuery = priceQuery.andWhere('price.customization_id IS NULL');
    }

    let priceEntry = await priceQuery.getOne();

    if (!priceEntry) {
      priceEntry = this.priceRepo.create({
        branch_id: branchId,
        product_id: dto.product_id,
        price_profile_id: effectivePriceProfileId,
        customization_id: dto.customization_id,
        station_id: product.production_station_id ?? undefined,
        effective_from: new Date().toISOString().slice(0, 10),
        delivery_minutes: product.serving_time ?? 20,
      });
    }

    priceEntry.price = resolvedPrice;
    if (dto.station_id !== undefined) {
      await this.assertStationBelongsToClient(clientId, dto.station_id);
      priceEntry.station_id = dto.station_id;
    }
    if (dto.effective_from !== undefined) {
      priceEntry.effective_from = dto.effective_from || null;
    }
    if (dto.delivery_minutes !== undefined) {
      priceEntry.delivery_minutes = dto.delivery_minutes;
    }
    return this.priceRepo.save(priceEntry);
  }

  async createPriceProfile(clientId: string, dto: CreatePriceProfileDto): Promise<PriceProfile> {
    const item = this.priceProfileRepo.create({ client_id: clientId, ...dto });
    return this.priceProfileRepo.save(item);
  }

  async updatePriceProfile(clientId: string, id: number, dto: UpdatePriceProfileDto): Promise<PriceProfile> {
    const item = await this.priceProfileRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) throw new NotFoundException('Menu Type not found');
    Object.assign(item, dto);
    return this.priceProfileRepo.save(item);
  }

  async findAllPriceProfiles(clientId?: string): Promise<PriceProfile[]> {
    const where = clientId ? { client_id: clientId, is_active: true } : { is_active: true };
    return this.priceProfileRepo.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });
  }

  async createCuisineType(clientId: string, dto: CreateCuisineTypeDto): Promise<CuisineType> {
    const item = this.cuisineRepo.create({ client_id: clientId, ...dto });
    return this.cuisineRepo.save(item);
  }

  async updateCuisineType(clientId: string, id: number, dto: UpdateCuisineTypeDto): Promise<CuisineType> {
    const item = await this.cuisineRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) throw new NotFoundException('Cuisine Type not found');
    Object.assign(item, dto);
    return this.cuisineRepo.save(item);
  }

  async findAllCuisineTypes(clientId?: string): Promise<CuisineType[]> {
    const where = clientId ? { client_id: clientId, is_active: true } : { is_active: true };
    return this.cuisineRepo.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });
  }

  async createStation(clientId: string, dto: CreateStationDto): Promise<Station> {
    const item = this.stationRepo.create({ client_id: clientId, ...dto });
    return this.stationRepo.save(item);
  }

  async updateStation(clientId: string, id: number, dto: UpdateStationDto): Promise<Station> {
    const item = await this.stationRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) throw new NotFoundException('Station not found');
    Object.assign(item, dto);
    return this.stationRepo.save(item);
  }

  async findAllStations(clientId?: string): Promise<Station[]> {
    const where = clientId ? { client_id: clientId, is_active: true } : { is_active: true };
    return this.stationRepo.find({ where, order: { kitchen_display_order: 'ASC', name: 'ASC' } });
  }

  async createUom(clientId: string, dto: CreateUomDto): Promise<Uom> {
    const payload = this.normalizeUomPayload(dto);
    await this.assertUomBelongsToClient(clientId, payload.base_unit_id ?? undefined);
    await this.ensureUomShortCodeAvailable(clientId, payload.abbreviation);
    const item = this.uomRepo.create({ client_id: clientId, ...payload });
    return this.uomRepo.save(item);
  }

  async updateUom(clientId: string, id: number, dto: UpdateUomDto): Promise<Uom> {
    const item = await this.uomRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) throw new NotFoundException('UOM not found');
    const payload = this.normalizeUomPayload(dto, false);
    if (payload.uom_type !== undefined && payload.uom_type !== item.uom_type) {
      throw new BadRequestException('UOM type cannot be changed after creation.');
    }
    if (payload.base_unit_id !== null && payload.base_unit_id !== undefined && payload.base_unit_id === id) {
      throw new BadRequestException('A UOM cannot reference itself as its base unit');
    }
    await this.assertUomBelongsToClient(clientId, payload.base_unit_id ?? undefined);
    await this.ensureUomShortCodeAvailable(clientId, payload.abbreviation, id);

    if (payload.name !== undefined) item.name = payload.name;
    if (payload.abbreviation !== undefined) item.abbreviation = payload.abbreviation;
    if (payload.description !== undefined) item.description = payload.description || null;
    if (payload.is_base_unit !== undefined) item.is_base_unit = payload.is_base_unit;
    if (payload.is_active !== undefined) item.is_active = payload.is_active;
    if (payload.base_unit_id !== undefined) item.base_unit_id = payload.base_unit_id;
    if (payload.conversion_factor !== undefined) item.conversion_factor = payload.conversion_factor;
    if (item.is_base_unit) {
      item.base_unit_id = null;
      item.conversion_factor = 1;
    }

    await this.uomRepo.save(item);
    const updated = await this.uomRepo.findOne({
      where: { client_id: clientId, id, is_active: true },
      relations: ['base_unit'],
    });
    if (!updated) throw new NotFoundException('UOM not found');
    return updated;
  }

  async findAllUoms(clientId?: string): Promise<Uom[]> {
    const where = clientId ? { client_id: clientId, is_active: true } : { is_active: true };
    return this.uomRepo.find({ where, relations: ['base_unit'], order: { name: 'ASC' } });
  }

  async seedDefaultUoms(clientId: string): Promise<Uom[]> {
    const existing = await this.uomRepo.find({ where: { client_id: clientId, is_active: true } });
    const existingCodes = new Set(existing.map((item) => String(item.abbreviation || '').toUpperCase()));
    const baseByCode = new Map<string, Uom>();

    for (const definition of this.uomConversionService.listDefaults()) {
      if (definition.factorToBase !== 1 || existingCodes.has(definition.baseCode)) {
        continue;
      }
      const created = await this.uomRepo.save(this.uomRepo.create({
        client_id: clientId,
        name: definition.name,
        abbreviation: definition.baseCode,
        uom_type: definition.category,
        description: 'System default base unit',
        is_base_unit: true,
        base_unit_id: null,
        conversion_factor: 1,
      }));
      baseByCode.set(definition.baseCode, created);
      existingCodes.add(definition.baseCode);
    }

    const allBaseUnits = await this.uomRepo.find({ where: { client_id: clientId, is_active: true } });
    for (const base of allBaseUnits.filter((item) => item.is_base_unit)) {
      baseByCode.set(String(base.abbreviation || '').toUpperCase(), base);
    }

    for (const definition of this.uomConversionService.listDefaults()) {
      if (existingCodes.has(definition.code)) {
        continue;
      }
      const baseUnit = baseByCode.get(definition.baseCode);
      await this.uomRepo.save(this.uomRepo.create({
        client_id: clientId,
        name: definition.name,
        abbreviation: definition.code,
        uom_type: definition.category,
        description: `1 ${definition.code} = ${definition.factorToBase} ${definition.baseCode}`,
        is_base_unit: definition.factorToBase === 1,
        base_unit_id: definition.factorToBase === 1 ? null : baseUnit?.id ?? null,
        conversion_factor: definition.factorToBase,
      }));
      existingCodes.add(definition.code);
    }

    return this.findAllUoms(clientId);
  }

  private normalizeUomPayload(dto: CreateUomDto | UpdateUomDto, requireCode = true): CreateUomDto | UpdateUomDto {
    const shortCode = dto.short_code?.trim().toUpperCase();
    const abbreviation = dto.abbreviation?.trim().toUpperCase() || shortCode;

    if (requireCode && !abbreviation) {
      throw new BadRequestException('Short Code is required for UOM.');
    }

    const payload = { ...dto };
    if (abbreviation !== undefined) {
      payload.abbreviation = abbreviation;
    }
    delete (payload as Partial<CreateUomDto & UpdateUomDto>).short_code;
    return payload;
  }

  private async ensureUomShortCodeAvailable(clientId: string, abbreviation?: string, excludeId?: number): Promise<void> {
    if (!abbreviation) {
      return;
    }

    const existing = await this.uomRepo.findOne({
      where: { client_id: clientId, abbreviation, is_active: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`UOM short code "${abbreviation}" already exists.`);
    }
  }

  async createCategory(clientId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.assertCategoryBelongsToClient(clientId, dto.parent_category_id);
    const category = this.categoryRepo.create({
      client_id: clientId,
      ...dto,
    });
    return this.categoryRepo.save(category);
  }

  async updateCategory(clientId: string, id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { client_id: clientId, id, is_active: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    await this.assertCategoryBelongsToClient(clientId, dto.parent_category_id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async createProduct(clientId: string, dto: CreateProductDto): Promise<Product> {
    await this.validateProductReferences(clientId, dto);
    const { customizations, branch_availability, ...productData } = dto;
    const distributionScope = dto.distribution_scope ?? 'all';

    const product = this.productRepo.create({
      client_id: clientId,
      ...productData,
      price_profile_id: null,
      distribution_scope: distributionScope,
      product_is_configurable:
        customizations !== undefined ? customizations.length > 0 : productData.product_is_configurable,
    });

    const savedProduct = await this.productRepo.save(product);
    await this.upsertCustomizations(savedProduct.id, customizations);
    if (branch_availability) {
      await this.syncBranchAvailability(clientId, savedProduct.id, distributionScope, branch_availability);
    }
    return this.findOneProduct(clientId, savedProduct.id);
  }

  async findAllCategories(clientId?: string): Promise<Category[]> {
    const where = clientId ? { client_id: clientId, is_active: true } : { is_active: true };
    return this.categoryRepo.find({
      where,
      order: { category_sort_order: 'ASC' },
    });
  }

  async findAllProducts(
    clientId?: string,
    categoryId?: number,
  ): Promise<any[]> {
    const where: Record<string, unknown> = clientId ? { client_id: clientId } : {};
    if (categoryId) {
      where.category_id = categoryId;
    }
    const products = await this.productRepo.find({
      where,
      relations: ['category', 'cuisine_type', 'production_station', 'price_profile_entity', 'base_uom', 'tax_configuration'],
    });

    if (!clientId) {
      return products;
    }

    const [branches, mappings, customizations] = await Promise.all([
      this.getClientBranches(clientId),
      this.mappingRepo.find({ where: { product: { client_id: clientId } }, relations: ['product'] }),
      this.customizationRepo.find({ where: { product: { client_id: clientId } }, relations: ['product'] }),
    ]);
    const mappingsByProduct = new Map<number, BranchProductMapping[]>();
    mappings.forEach((mapping) => {
      const list = mappingsByProduct.get(mapping.product_id) ?? [];
      list.push(mapping);
      mappingsByProduct.set(mapping.product_id, list);
    });
    const customizationCountByProduct = new Map<number, number>();
    customizations.forEach((customization) => {
      customizationCountByProduct.set(
        customization.product_id,
        (customizationCountByProduct.get(customization.product_id) ?? 0) + 1,
      );
    });

    const recipeCostSummaryMap = await this.recipeCostingService.getProductRecipeCostSummaries(
      clientId,
      products,
    );

    return products.map((product) => {
      const productMappings = mappingsByProduct.get(product.id) ?? [];
      const mappingMap = new Map(productMappings.map((mapping) => [mapping.branch_id, mapping]));
      const enabledBranchCount = branches.filter((branch) =>
        this.getBranchEnabled(product, mappingMap.get(branch.id)),
      ).length;

      return {
        ...product,
        total_branch_count: branches.length,
        enabled_branch_count: enabledBranchCount,
        customization_count: customizationCountByProduct.get(product.id) ?? 0,
        recipe_cost_summary: recipeCostSummaryMap.get(product.id) ?? null,
      };
    });
  }

  async findOneProduct(clientId: string, id: number): Promise<any> {
    const product = await this.productRepo.findOne({
      where: { client_id: clientId, id },
      relations: ['category', 'cuisine_type', 'production_station', 'price_profile_entity', 'base_uom', 'tax_configuration'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const customizations = await this.customizationRepo.find({ where: { product_id: id } });
    const distribution = await this.buildBranchAvailabilitySnapshot(clientId, product);
    const recipeCostSummary = await this.recipeCostingService.getProductRecipeCostSummary(
      clientId,
      id,
    );
    return {
      ...product,
      customizations,
      ...distribution,
      recipe_cost_summary: recipeCostSummary,
    };
  }

  async updateProduct(clientId: string, id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.assertProductBelongsToClient(clientId, id);
    await this.validateProductReferences(clientId, dto);

    const { customizations, branch_availability, ...productData } = dto;
    Object.assign(product, { ...productData, price_profile_id: null });
    if (customizations !== undefined) {
      product.product_is_configurable = customizations.length > 0;
    }

    const updated = await this.productRepo.save(product);
    await this.upsertCustomizations(id, customizations);
    if (branch_availability) {
      await this.syncBranchAvailability(
        clientId,
        id,
        updated.distribution_scope ?? 'all',
        branch_availability,
      );
    }
    return this.findOneProduct(clientId, updated.id);
  }

  async removeProduct(clientId: string, id: number): Promise<void> {
    const product = await this.assertProductBelongsToClient(clientId, id);
    product.is_active = false;
    product.is_branch_active = false;
    await this.productRepo.save(product);
  }

  async getProductsWithBranchStatus(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const products = await this.productRepo.find({
      where: { client_id: clientId },
      relations: ['category', 'cuisine_type', 'production_station', 'price_profile_entity', 'tax_configuration'],
    });

    const [mappings, PriceProfiles, prices] = await Promise.all([
      this.mappingRepo.find({
        where: { branch_id: branchId },
      }),
      this.priceProfileRepo.find({
        where: { client_id: clientId },
      }),
      this.priceRepo.find({
        where: { branch_id: branchId },
      }),
    ]);

    const mappingMap = new Map<number, BranchProductMapping[]>();
    mappings.forEach((mapping) => {
      const list = mappingMap.get(mapping.product_id) ?? [];
      list.push(mapping);
      mappingMap.set(mapping.product_id, list);
    });
    const PriceProfileMap = new Map(PriceProfiles.map((PriceProfile) => [PriceProfile.id, PriceProfile]));
    const basePriceMap = this.buildBaseBranchPriceMap(prices);
    const customizationPriceMap = this.buildCustomizationBranchPriceMap(prices);
    const anyCustomizationPriceMap = this.buildAnyCustomizationBranchPriceMap(prices);

    return products.map((product) => {
      const primaryMapping = this.choosePrimaryBranchMapping(
        product,
        mappingMap.get(product.id) ?? [],
        basePriceMap,
        customizationPriceMap,
      );
        const { product: _ignoredProduct, mapping: _ignoredMapping, ...branchContext } =
        this.buildBranchProductSaleContext(
        product,
        primaryMapping,
        (mappingMap.get(product.id) ?? []).find((entry) => entry.price_profile_id === null) ?? null,
        PriceProfileMap,
        basePriceMap,
        customizationPriceMap,
        anyCustomizationPriceMap,
      );

      return {
        ...product,
        is_enabled: branchContext.branch_enabled,
        ...branchContext,
        master_price_profile_id: product.price_profile_id ?? null,
        master_price_profile_name: product.price_profile_entity?.name ?? null,
        branch_price_profile_override_id: primaryMapping?.price_profile_id ?? null,
      };
    });
  }

  async setBranchMapping(
    clientId: string,
    branchId: number,
    productId: number,
    isEnabled: boolean,
    priceOverride?: number,
    PriceProfileId?: number | null,
    channelAvailability?: OrderChannelAvailabilityDto,
    allowOpenOrderReturn?: boolean | null,
    temporarilyDisabledUntil?: string | Date | null,
    temporaryDisableReason?: string | null,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const product = await this.assertProductBelongsToClient(clientId, productId);

    if (isEnabled && (!product.is_active || !product.is_branch_active)) {
      throw new BadRequestException('Inactive master products cannot be enabled for a branch');
    }

    if (PriceProfileId) {
      await this.assertPriceProfileBelongsToClient(clientId, PriceProfileId);
    }

    let mapping = await this.findBranchMapping(branchId, productId, PriceProfileId);

    if (!mapping) {
      mapping = this.mappingRepo.create({
        branch_id: branchId,
        product_id: productId,
        price_profile_id: PriceProfileId ?? null,
      });
    }

    const defaultEnabled = PriceProfileId !== undefined ? false : this.getDefaultBranchEnabled(product.distribution_scope);
    mapping.is_enabled = isEnabled;
    if (priceOverride !== undefined) {
      mapping.price_override = priceOverride;
    }
    if (PriceProfileId !== undefined) {
      mapping.price_profile_id = PriceProfileId ?? null;
    }
    if (channelAvailability !== undefined) {
      mapping.channel_availability = this.hasChannelAvailabilityOverride(channelAvailability)
        ? this.normalizeChannelAvailability(channelAvailability)
        : null;
    }
    if (allowOpenOrderReturn !== undefined) {
      mapping.allow_open_order_return = allowOpenOrderReturn;
    }
    if (temporarilyDisabledUntil !== undefined) {
      mapping.temporarily_disabled_until = this.parseTemporaryDisableUntil(temporarilyDisabledUntil);
      if (!mapping.temporarily_disabled_until && temporaryDisableReason === undefined) {
        mapping.temporary_disable_reason = null;
      }
    }
    if (temporaryDisableReason !== undefined) {
      mapping.temporary_disable_reason = temporaryDisableReason?.trim() || null;
    }
    if (!mapping.temporarily_disabled_until) {
      mapping.temporary_disable_reason = null;
    }

    if (
      mapping.is_enabled === defaultEnabled &&
      (mapping.allow_open_order_return === null || mapping.allow_open_order_return === undefined || mapping.allow_open_order_return === Boolean(product.allow_open_order_return)) &&
      (mapping.price_override === null || mapping.price_override === undefined) &&
      !this.hasChannelAvailabilityOverride(mapping.channel_availability) &&
      !mapping.temporarily_disabled_until &&
      !mapping.temporary_disable_reason
    ) {
      if (mapping.id) {
        await this.mappingRepo.remove(mapping);
      }
      return {
        branch_id: branchId,
        product_id: productId,
        is_enabled: isEnabled,
        price_override: null,
        price_profile_id: null,
        channel_availability: this.normalizeChannelAvailability(null),
        allow_open_order_return: Boolean(product.allow_open_order_return),
        temporarily_disabled_until: null,
        temporary_disable_reason: null,
      };
    }

    return this.mappingRepo.save(mapping);
  }

  async bulkSetBranchMappings(
    clientId: string,
    branchId: number,
    items: Array<{ product_id: number; is_enabled: boolean }>,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const results: Array<BranchProductMapping | { branch_id: number; product_id: number; is_enabled: boolean; price_override: null }> = [];
    for (const item of items) {
      results.push(await this.setBranchMapping(clientId, branchId, item.product_id, item.is_enabled));
    }

    return {
      branch_id: branchId,
      updated_count: results.length,
      items: results,
    };
  }

  async getTaxonomyDependencies(clientId: string, kind: string, id: number) {
    const config = this.getTaxonomyDependencyConfig(kind);
    const currentItem = await this.getTaxonomyItemSummary(clientId, config.kind, id);
    const replacementOptions = await this.getTaxonomyReplacementOptions(clientId, config.kind, id);
    const products = await this.productRepo.find({
      where: {
        client_id: clientId,
        is_active: true,
        [config.productProperty]: id,
      } as Record<string, unknown>,
      order: { product_name: 'ASC' },
      relations: ['category', 'price_profile_entity', 'cuisine_type', 'production_station', 'base_uom'],
    });

    return {
      kind: config.kind,
      label: config.label,
      current_item: currentItem,
      replacement_options: replacementOptions,
      products: products.map((product) => ({
        id: product.id,
        product_name: product.product_name,
        product_code: product.product_code || null,
        current_category: product.category?.category_name ?? null,
        current_price_profile: product.price_profile_entity?.name ?? null,
        current_cuisine_type: product.cuisine_type?.name ?? null,
        current_station: product.production_station?.name ?? null,
        current_uom: product.base_uom?.name ?? null,
      })),
    };
  }

  async reassignTaxonomyDependencies(
    clientId: string,
    kind: string,
    id: number,
    targetId: number,
    productIds?: number[],
  ) {
    const config = this.getTaxonomyDependencyConfig(kind);
    if (id === targetId) {
      throw new BadRequestException(`${config.label} cannot be reassigned to itself.`);
    }

    await Promise.all([
      this.getTaxonomyItemSummary(clientId, config.kind, id),
      this.getTaxonomyItemSummary(clientId, config.kind, targetId),
    ]);

    const dependencies = await this.getTaxonomyDependencies(clientId, kind, id);
    const availableProductIds = new Set<number>(dependencies.products.map((product) => product.id));
    const scopedProductIds = (productIds?.length ? productIds : dependencies.products.map((product) => product.id))
      .filter((productId) => availableProductIds.has(productId));

    if (scopedProductIds.length === 0) {
      throw new BadRequestException(`No active products are assigned to this ${config.label.toLowerCase()}.`);
    }

    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ [config.productProperty]: targetId } as Partial<Product>)
      .where('client_id = :clientId', { clientId })
      .andWhere('is_active = :isActive', { isActive: true })
      .andWhere(`${config.productColumn} = :sourceId`, { sourceId: id })
      .andWhere('id IN (:...productIds)', { productIds: scopedProductIds })
      .execute();

    return {
      source_id: id,
      target_id: targetId,
      updated_count: scopedProductIds.length,
    };
  }

  async removeCategory(clientId: string, id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { client_id: clientId, id, is_active: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const activeProductCount = await this.productRepo.count({
      where: { client_id: clientId, category_id: id, is_active: true },
    });
    if (activeProductCount > 0) {
      throw new BadRequestException('Cannot deactivate category with active products.');
    }
    category.is_active = false;
    await this.categoryRepo.save(category);
  }

  async removePriceProfile(clientId: string, id: number): Promise<void> {
    const item = await this.priceProfileRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) {
      throw new NotFoundException('Menu Type not found');
    }
    const activeProductCount = await this.productRepo.count({
      where: { client_id: clientId, price_profile_id: id, is_active: true },
    });
    if (activeProductCount > 0) {
      throw new BadRequestException('Cannot deactivate menu type with active products.');
    }
    item.is_active = false;
    await this.priceProfileRepo.save(item);
  }

  async removeCuisineType(clientId: string, id: number): Promise<void> {
    const item = await this.cuisineRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) {
      throw new NotFoundException('Cuisine Type not found');
    }
    const activeProductCount = await this.productRepo.count({
      where: { client_id: clientId, cuisine_type_id: id, is_active: true },
    });
    if (activeProductCount > 0) {
      throw new BadRequestException('Cannot deactivate cuisine type with active products.');
    }
    item.is_active = false;
    await this.cuisineRepo.save(item);
  }

  async removeStation(clientId: string, id: number): Promise<void> {
    const item = await this.stationRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) {
      throw new NotFoundException('Station not found');
    }
    const activeProductCount = await this.productRepo.count({
      where: { client_id: clientId, production_station_id: id, is_active: true },
    });
    if (activeProductCount > 0) {
      throw new BadRequestException('Cannot deactivate station with active products.');
    }
    item.is_active = false;
    await this.stationRepo.save(item);
  }

  async removeUom(clientId: string, id: number): Promise<void> {
    const item = await this.uomRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    if (!item) {
      throw new NotFoundException('UOM not found');
    }
    const [activeProductCount, activeChildUomCount] = await Promise.all([
      this.productRepo.count({
        where: { client_id: clientId, base_uom_id: id, is_active: true },
      }),
      this.uomRepo.count({
        where: { client_id: clientId, base_unit_id: id, is_active: true },
      }),
    ]);
    if (activeProductCount > 0 || activeChildUomCount > 0) {
      throw new BadRequestException('Cannot deactivate UOM while it is still referenced.');
    }
    item.is_active = false;
    await this.uomRepo.save(item);
  }

  async getBranchMenu(clientId: string, branchId: number, PriceProfileId?: number, channel?: string) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    if (PriceProfileId) {
      await this.assertPriceProfileBelongsToClient(clientId, PriceProfileId);
    }

    const [categories, products, customizations, mappings, PriceProfiles, prices] = await Promise.all([
      this.categoryRepo.find({
        where: { client_id: clientId, is_active: true },
        order: { category_sort_order: 'ASC' },
      }),
      this.productRepo.find({
        where: { client_id: clientId, is_active: true, is_branch_active: true },
        relations: ['category', 'price_profile_entity', 'cuisine_type', 'production_station', 'base_uom', 'tax_configuration'],
      }),
      this.customizationRepo.find({
        where: { product: { client_id: clientId } },
      }),
      this.mappingRepo.find({
        where: { branch_id: branchId },
      }),
      this.priceProfileRepo.find({
        where: { client_id: clientId, is_active: true },
      }),
      this.priceRepo.find({
        where: { branch_id: branchId },
      }),
    ]);

    const customizationMap: Record<number, any[]> = {};
    customizations.forEach((customization) => {
      if (!customizationMap[customization.product_id]) customizationMap[customization.product_id] = [];
      customizationMap[customization.product_id].push({
        id: customization.id,
        type: customization.customization_type,
        value: customization.customization_value,
        price_delta: Number(customization.customization_price_delta),
        required: customization.customization_is_required,
      });
    });

    const mappingDictionary = new Map<number, BranchProductMapping[]>();
    mappings.forEach((mapping) => {
      const list = mappingDictionary.get(mapping.product_id) ?? [];
      list.push(mapping);
      mappingDictionary.set(mapping.product_id, list);
    });
    const PriceProfileMap = new Map(PriceProfiles.map((PriceProfile) => [PriceProfile.id, PriceProfile]));
    const basePriceMap = this.buildBaseBranchPriceMap(prices);
    const customizationPriceMap = this.buildCustomizationBranchPriceMap(prices);
    const anyCustomizationPriceMap = this.buildAnyCustomizationBranchPriceMap(prices);

    const branchProducts = products
      .map((product) => {
        const localMapping = this.choosePrimaryBranchMapping(
          product,
          mappingDictionary.get(product.id) ?? [],
          basePriceMap,
          customizationPriceMap,
        );
        const context = this.buildBranchProductSaleContext(
          product,
          localMapping,
          (mappingDictionary.get(product.id) ?? []).find((entry) => entry.price_profile_id === null) ?? null,
          PriceProfileMap,
          basePriceMap,
          customizationPriceMap,
          anyCustomizationPriceMap,
          channel,
        );

        if (!context.effective_enabled) {
          return null;
        }

        if (PriceProfileId && context.effective_price_profile_id !== PriceProfileId) {
          return null;
        }

        return {
          id: product.id,
          name: product.product_name,
          product_name: product.product_name,
          desc: product.product_description,
          serving_time: product.serving_time ?? 20,
          category: product.category?.category_name || 'Uncategorized',
          category_id: product.category_id ?? null,
          price_profile: context.effective_price_profile_name,
          price_profile_id: context.effective_price_profile_id,
          menu_assignment_source: context.menu_assignment_source,
          cuisine: product.cuisine_type?.name,
          station: product.production_station?.name,
          uom: product.base_uom?.abbreviation,
          price: context.effective_price,
          price_source: context.price_source,
          img: product.product_image_url || '',
          branch_enabled: context.branch_enabled,
          effective_branch_enabled: context.effective_enabled,
          channel_availability: context.channel_availability,
          is_temporarily_disabled: context.is_temporarily_disabled,
          temporarily_disabled_until: context.temporarily_disabled_until,
          temporary_disable_reason: context.temporary_disable_reason,
          master_active: true,
          tax_configuration: product.tax_configuration
            ? {
                id: product.tax_configuration.id,
                tax_name: product.tax_configuration.tax_name,
                tax_code: product.tax_configuration.tax_code,
                tax_rate: Number(product.tax_configuration.tax_rate || 0),
                calculation_method: product.tax_configuration.calculation_method,
              }
            : null,
          customizations: customizationMap[product.id] || [],
        };
      })
      .filter((product) => product !== null);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.category_name,
        parent_id: category.parent_category_id,
      })),
      products: branchProducts,
    };
  }

}
