import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryClass } from './entities/inventory-class.entity';
import { InventoryType } from './entities/inventory-type.entity';
import { InventorySubType } from './entities/inventory-sub-type.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { BranchInventory } from './entities/branch-inventory.entity';
import { InventoryItemRequest } from './entities/inventory-item-request.entity';
import { InventoryItemRequestStatus } from './entities/inventory-item-request.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { Branch } from '../setup/entities/branch.entity';
import {
  CreateInventoryClassDto,
  CreateInventoryItemDto,
  CreateInventorySubTypeDto,
  CreateInventoryTypeDto,
  CreateItemRequestDto,
  UpdateInventoryClassDto,
  UpdateInventoryItemDto,
  UpdateInventorySubTypeDto,
  UpdateInventoryTypeDto,
} from './dto/inventory-write.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryClass)
    private classRepo: Repository<InventoryClass>,
    @InjectRepository(InventoryType)
    private typeRepo: Repository<InventoryType>,
    @InjectRepository(InventorySubType)
    private subTypeRepo: Repository<InventorySubType>,
    @InjectRepository(InventoryItem)
    private itemRepo: Repository<InventoryItem>,
    @InjectRepository(BranchInventory)
    private branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(StockLevel)
    private stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(InventoryItemRequest)
    private requestRepo: Repository<InventoryItemRequest>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
  ) {}

  private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, client_id: clientId, item_is_active: true },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }

  private readonly inventoryItemNumberSeed = 10000000;

  private formatInventoryItemNumber(sequence: number): string {
    return String(sequence);
  }

  private async generateInventoryItemNumber(clientId: string): Promise<string> {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.item_sku', 'item_sku')
      .where('item.client_id = :clientId', { clientId })
      .andWhere('item.item_sku IS NOT NULL')
      .getRawMany<{ item_sku: string | null }>();

    let maxSequence = this.inventoryItemNumberSeed;
    for (const row of rows) {
      const parsed = Number(row.item_sku);
      if (Number.isInteger(parsed) && parsed > maxSequence) {
        maxSequence = parsed;
      }
    }

    return this.formatInventoryItemNumber(maxSequence + 1);
  }

  async createClass(clientId: string, dto: CreateInventoryClassDto): Promise<InventoryClass> {
    const invClass = this.classRepo.create({
      client_id: clientId,
      ...dto,
    });
    return this.classRepo.save(invClass);
  }

  async createType(
    clientId: string,
    classId: number,
    dto: CreateInventoryTypeDto,
  ): Promise<InventoryType> {
    const parentClass = await this.classRepo.findOne({
      where: { id: classId, client_id: clientId, is_active: true },
    });
    if (!parentClass) {
      throw new NotFoundException('Inventory Class not found or does not belong to this client.');
    }

    const type = this.typeRepo.create({
      client_id: clientId,
      class_id: classId,
      ...dto,
    });
    return this.typeRepo.save(type);
  }

  async createSubType(
    clientId: string,
    typeId: number,
    dto: CreateInventorySubTypeDto,
  ): Promise<InventorySubType> {
    const parentType = await this.typeRepo.findOne({
      where: { id: typeId, client_id: clientId, is_active: true },
    });
    if (!parentType) {
      throw new NotFoundException('Inventory Type not found or does not belong to this client.');
    }

    const subType = this.subTypeRepo.create({
      client_id: clientId,
      type_id: typeId,
      ...dto,
    });
    return this.subTypeRepo.save(subType);
  }

  async createItem(
    clientId: string,
    subTypeId: number,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItem> {
    const parentSubType = await this.subTypeRepo.findOne({
      where: { id: subTypeId, client_id: clientId, is_active: true },
    });
    if (!parentSubType) {
      throw new NotFoundException('Inventory Sub-Type not found or does not belong to this client.');
    }

    const itemFields = { ...dto };
    delete itemFields.item_sku;
    const item = this.itemRepo.create({
      client_id: clientId,
      sub_type_id: subTypeId,
      ...itemFields,
      item_sku: undefined,
    });
    const savedItem = await this.itemRepo.save(item);
    savedItem.item_sku = await this.generateInventoryItemNumber(clientId);
    return this.itemRepo.save(savedItem);
  }

  async updateClass(clientId: string, id: number, dto: UpdateInventoryClassDto) {
    await this.classRepo.update({ id, client_id: clientId, is_active: true }, dto);
    return this.classRepo.findOne({ where: { id, client_id: clientId, is_active: true } });
  }

  async deleteClass(clientId: string, id: number) {
    const hasChildren = await this.typeRepo.count({
      where: { class_id: id, client_id: clientId, is_active: true },
    });
    if (hasChildren > 0) throw new BadRequestException('Cannot delete Class that has active Types.');
    const invClass = await this.classRepo.findOne({ where: { id, client_id: clientId, is_active: true } });
    if (!invClass) {
      throw new NotFoundException('Inventory Class not found');
    }
    invClass.is_active = false;
    await this.classRepo.save(invClass);
  }

  async updateType(clientId: string, id: number, dto: UpdateInventoryTypeDto) {
    await this.typeRepo.update({ id, client_id: clientId, is_active: true }, dto);
    return this.typeRepo.findOne({ where: { id, client_id: clientId, is_active: true } });
  }

  async deleteType(clientId: string, id: number) {
    const hasChildren = await this.subTypeRepo.count({
      where: { type_id: id, client_id: clientId, is_active: true },
    });
    if (hasChildren > 0) throw new BadRequestException('Cannot delete Type that has active Sub-Types.');
    const type = await this.typeRepo.findOne({ where: { id, client_id: clientId, is_active: true } });
    if (!type) {
      throw new NotFoundException('Inventory Type not found');
    }
    type.is_active = false;
    await this.typeRepo.save(type);
  }

  async updateSubType(clientId: string, id: number, dto: UpdateInventorySubTypeDto) {
    await this.subTypeRepo.update({ id, client_id: clientId, is_active: true }, dto);
    return this.subTypeRepo.findOne({ where: { id, client_id: clientId, is_active: true } });
  }

  async deleteSubType(clientId: string, id: number) {
    const hasChildren = await this.itemRepo.count({
      where: { sub_type_id: id, client_id: clientId, item_is_active: true },
    });
    if (hasChildren > 0) throw new BadRequestException('Cannot delete Sub-Type that has active Items.');
    const subType = await this.subTypeRepo.findOne({
      where: { id, client_id: clientId, is_active: true },
    });
    if (!subType) {
      throw new NotFoundException('Inventory Sub-Type not found');
    }
    subType.is_active = false;
    await this.subTypeRepo.save(subType);
  }

  async updateItem(clientId: string, id: number, dto: UpdateInventoryItemDto) {
    const itemFields = { ...dto };
    delete itemFields.item_sku;
    await this.itemRepo.update({ id, client_id: clientId, item_is_active: true }, itemFields);
    return this.itemRepo.findOne({ where: { id, client_id: clientId, item_is_active: true } });
  }

  async deleteItem(clientId: string, id: number) {
    const item = await this.itemRepo.findOne({
      where: { id, client_id: clientId, item_is_active: true },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    item.item_is_active = false;
    await this.itemRepo.save(item);
  }

  async toggleBranchItem(clientId: string, branchId: number, itemId: number, enabled: boolean) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    await this.assertItemBelongsToClient(clientId, itemId);

    let branchInv = await this.branchInventoryRepo.findOne({
      where: { branch_id: branchId, item_id: itemId },
    });

    if (!branchInv) {
      if (!enabled) {
        return null;
      }

      branchInv = this.branchInventoryRepo.create({
        branch_id: branchId,
        item_id: itemId,
        is_enabled: true,
        current_stock: 0,
        min_stock_level: 0,
        max_stock_level: 0,
      });
      return this.branchInventoryRepo.save(branchInv);
    }

    branchInv.is_enabled = enabled;
    return this.branchInventoryRepo.save(branchInv);
  }

  async updateBranchStockLevels(clientId: string, branchId: number, itemId: number, min: number, max: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    await this.assertItemBelongsToClient(clientId, itemId);

    let branchInv = await this.branchInventoryRepo.findOne({
      where: { branch_id: branchId, item_id: itemId },
    });

    if (!branchInv) {
      branchInv = this.branchInventoryRepo.create({
        branch_id: branchId,
        item_id: itemId,
        is_enabled: true,
        current_stock: 0,
        min_stock_level: min,
        max_stock_level: max,
      });
    } else {
      branchInv.min_stock_level = min;
      branchInv.max_stock_level = max;
    }
    return this.branchInventoryRepo.save(branchInv);
  }

  async getBranchMasterData(
    clientId: string,
    branchId: number,
    filters?: {
      search?: string;
      sku?: string;
      tag?: string;
      class?: string;
      category?: string;
      subCategory?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.itemRepo
      .createQueryBuilder('item')
      .select([
        'item.id', 'item.item_name', 'item.item_name_other_language', 'item.item_sku', 'item.uom_base', 'item.uom_purchase', 'item.item_tag',
        'subType.id', 'subType.sub_type_name', 'subType.affects_stock', 'subType.affects_recipe', 'subType.depreciable',
        'type.id', 'type.type_name',
        'class.id', 'class.class_name',
      ])
      .innerJoin('item.subType', 'subType')
      .innerJoin('subType.inventoryType', 'type')
      .innerJoin('type.inventoryClass', 'class')
      .where('item.client_id = :clientId', { clientId })
      .andWhere('item.item_is_active = :isActive', { isActive: true });

    if (filters?.search) {
      queryBuilder.andWhere('item.item_name LIKE :search', {
        search: `%${filters.search}%`,
      });
    }
    if (filters?.sku) {
      queryBuilder.andWhere('item.item_sku LIKE :sku', {
        sku: `%${filters.sku}%`,
      });
    }
    if (filters?.tag && filters.tag !== 'All') {
      queryBuilder.andWhere('item.item_tag = :itemTag', {
        itemTag: filters.tag,
      });
    }
    if (filters?.class && filters.class !== 'All') {
      queryBuilder.andWhere('class.class_name = :className', {
        className: filters.class,
      });
    }
    if (filters?.category && filters.category !== 'All') {
      queryBuilder.andWhere('type.type_name = :typeName', {
        typeName: filters.category,
      });
    }
    if (filters?.subCategory && filters.subCategory !== 'All') {
      queryBuilder.andWhere('subType.sub_type_name = :subTypeName', {
        subTypeName: filters.subCategory,
      });
    }

    queryBuilder.orderBy('item.item_name', 'ASC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    if (items.length === 0) {
      return { items: [], total, page, limit };
    }

    const itemIds = items.map((item) => item.id);
    const branchOverrides = await this.branchInventoryRepo
      .createQueryBuilder('bi')
      .select(['bi.item_id', 'bi.is_enabled', 'bi.min_stock_level', 'bi.max_stock_level'])
      .where('bi.branch_id = :branchId', { branchId })
      .andWhere('bi.item_id IN (:...itemIds)', { itemIds })
      .getMany();

    const overridesMap = new Map(branchOverrides.map((override) => [override.item_id, override]));

    const stockLevels = await this.stockLevelRepo.find({
      where: { client_id: clientId, branch_id: branchId, item_id: In(itemIds) },
      relations: ['item'],
    });
    const levelsMap = new Map(stockLevels.map((level) => [level.item_id, level]));

    const mergedItems = items.map((item) => {
      const override = overridesMap.get(item.id);
      return {
        id: item.id,
        item_name: item.item_name,
        item_name_other_language: item.item_name_other_language,
        item_sku: item.item_sku,
        uom_base: item.uom_base,
        uom_purchase: item.uom_purchase,
        item_tag: item.item_tag,
        subType: item.subType,
        is_enabled: override ? override.is_enabled : false,
        min_level: override ? Number(override.min_stock_level) : 0,
        max_level: override ? Number(override.max_stock_level) : 0,
        current_stock: levelsMap.has(item.id)
          ? Number(levelsMap.get(item.id)?.current_quantity ?? 0)
          : 0,
      };
    });

    return { items: mergedItems, total, page, limit };
  }

  async getFilterHierarchy(clientId: string) {
    const [classes, types, subTypes] = await Promise.all([
      this.classRepo.find({ where: { client_id: clientId, is_active: true }, order: { class_name: 'ASC' } }),
      this.typeRepo.find({ where: { client_id: clientId, is_active: true }, order: { type_name: 'ASC' } }),
      this.subTypeRepo.find({ where: { client_id: clientId, is_active: true }, order: { sub_type_name: 'ASC' } }),
    ]);

    const subTypesByType = new Map<number, any[]>();
    subTypes.forEach((subType) => {
      const list = subTypesByType.get(subType.type_id) || [];
      list.push(subType);
      subTypesByType.set(subType.type_id, list);
    });

    const typesByClass = new Map<number, any[]>();
    types.forEach((type) => {
      const list = typesByClass.get(type.class_id) || [];
      list.push({
        ...type,
        subTypes: subTypesByType.get(type.id) || [],
      });
      typesByClass.set(type.class_id, list);
    });

    return classes.map((invClass) => ({
      ...invClass,
      types: typesByClass.get(invClass.id) || [],
    }));
  }

  async createItemRequest(clientId: string, branchId: number, dto: CreateItemRequestDto) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const request = this.requestRepo.create({
      client_id: clientId,
      branch_id: branchId,
      ...dto,
      status: InventoryItemRequestStatus.PENDING,
    });
    return this.requestRepo.save(request);
  }

  async getItemRequests(
    clientId: string,
    status?: string,
    accessibleBranchIds?: number[],
  ) {
    const where: any = { client_id: clientId };
    if (status) where.status = status;
    if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      where.branch_id = In(accessibleBranchIds);
    }
    return this.requestRepo.find({
      where,
      relations: ['branch'],
      order: { created_at: 'DESC' },
    });
  }

  async processItemRequest(
    clientId: string,
    requestId: number,
    status: string,
    subTypeId?: number,
    adminComment?: string,
    accessibleBranchIds?: number[],
  ) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, client_id: clientId },
    });
    if (
      !request ||
      (accessibleBranchIds &&
        accessibleBranchIds.length > 0 &&
        !accessibleBranchIds.includes(request.branch_id))
    ) {
      throw new NotFoundException('Request not found');
    }

    request.status = status as any;
    request.admin_comment = adminComment ?? null;

    if (status === 'APPROVED' && subTypeId) {
      const newItem = await this.createItem(clientId, subTypeId, {
        item_name: request.item_name,
        item_sku: request.item_number,
        uom_base: request.uom_base,
        uom_purchase: request.uom_purchase,
        item_is_active: true,
      });

      await this.toggleBranchItem(clientId, request.branch_id, newItem.id, true);
    }

    return this.requestRepo.save(request);
  }

  async getFullHierarchy(clientId: string) {
    const [classes, types, subTypes, items] = await Promise.all([
      this.classRepo.find({ where: { client_id: clientId, is_active: true } }),
      this.typeRepo.find({ where: { client_id: clientId, is_active: true } }),
      this.subTypeRepo.find({ where: { client_id: clientId, is_active: true } }),
      this.itemRepo.find({ where: { client_id: clientId, item_is_active: true } }),
    ]);

    const itemsBySubType = new Map<number, InventoryItem[]>();
    items.forEach((item) => {
      const list = itemsBySubType.get(item.sub_type_id) || [];
      list.push(item);
      itemsBySubType.set(item.sub_type_id, list);
    });

    const subTypesByType = new Map<number, any[]>();
    subTypes.forEach((subType) => {
      const list = subTypesByType.get(subType.type_id) || [];
      list.push({
        ...subType,
        items: itemsBySubType.get(subType.id) || [],
      });
      subTypesByType.set(subType.type_id, list);
    });

    const typesByClass = new Map<number, any[]>();
    types.forEach((type) => {
      const list = typesByClass.get(type.class_id) || [];
      list.push({
        ...type,
        subTypes: subTypesByType.get(type.id) || [],
      });
      typesByClass.set(type.class_id, list);
    });

    return classes.map((invClass) => ({
      ...invClass,
      types: typesByClass.get(invClass.id) || [],
    }));
  }

}
