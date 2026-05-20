import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { resolveActorId } from '../auth/request-context.util';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CatalogService } from '../catalog/catalog.service';
import { Product } from '../catalog/entities/product.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { TransfersService } from '../inventory-op/transfers/transfers.service';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import { RecipeIngredient } from '../recipe/entities/recipe-ingredient.entity';
import { Recipe } from '../recipe/entities/recipe.entity';
import { Branch } from '../setup/entities/branch.entity';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import {
  CompleteProductionBatchDto,
  CompleteProductionOrderDto,
  CreateProductionOrderDto,
  DispatchProductionOrderDto,
  IssueProductionMaterialsDto,
  ProductionDecisionDto,
  ProductionOrderQueryDto,
  ReceiveProductionOrderDto,
} from './dto/production-order.dto';
import { ProductionOrderMaterial } from './entities/production-order-material.entity';
import { ProductionOrderBatch } from './entities/production-order-batch.entity';
import { ProductionOrder } from './entities/production-order.entity';

type ProductionAction =
  | 'create'
  | 'queue'
  | 'issue'
  | 'reject'
  | 'cancel'
  | 'start'
  | 'complete'
  | 'dispatch'
  | 'receive';

type OutputStage = 'semi_prepared' | 'prepared';

type MaterialPlanLine = {
  recipe_ingredient_id: number | null;
  item_id: number;
  item_name: string;
  item_sku: string | null;
  uom: string;
  wastage_percentage: number;
  planned_quantity: number;
};

type BatchPlanInput = {
  batch_no: string;
  batch_sequence: number;
  planned_quantity: number;
  actual_quantity: number;
  wastage_quantity: number;
  yield_percentage: number | null;
  notes: string | null;
};

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionOrder)
    private readonly prodRepo: Repository<ProductionOrder>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly ingredientRepo: Repository<RecipeIngredient>,
    private readonly transfersService: TransfersService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly catalogService: CatalogService,
    private readonly dataSource: DataSource,
  ) {}

  private normalizeQuantity(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(4));
  }

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private normalizePercent(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Number(parsed.toFixed(2));
  }

  private toDateOnly(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    return value.slice(0, 10);
  }

  private buildProductionNo(orderId: number): string {
    return `PROD-${String(orderId).padStart(6, '0')}`;
  }

  private buildBatchNo(productionNo: string, sequence: number): string {
    return `${productionNo}-B${String(sequence).padStart(2, '0')}`;
  }

  private computeYieldPercentage(actualQuantity: number, plannedQuantity: number): number | null {
    if (plannedQuantity <= 0 || actualQuantity <= 0) {
      return null;
    }
    return this.normalizePercent((actualQuantity / plannedQuantity) * 100);
  }

  private hasBranchAccess(accessibleBranchIds: number[] | undefined, branchId: number): boolean {
    return !accessibleBranchIds || accessibleBranchIds.length === 0 || accessibleBranchIds.includes(branchId);
  }

  private assertOrderAccess(
    action: ProductionAction,
    accessibleBranchIds: number[] | undefined,
    order: Pick<ProductionOrder, 'branch_id' | 'destination_branch_id'>,
  ): void {
    const sourceBranchId = order.branch_id;
    const destinationBranchId = order.destination_branch_id ?? order.branch_id;
    const hasSourceAccess = this.hasBranchAccess(accessibleBranchIds, sourceBranchId);
    const hasDestinationAccess = this.hasBranchAccess(accessibleBranchIds, destinationBranchId);

    if (action === 'create') {
      if (!hasSourceAccess && !hasDestinationAccess) {
        throw new ForbiddenException('You do not have access to either production unit in this request.');
      }
      return;
    }

    if (action === 'cancel') {
      if (!hasSourceAccess && !hasDestinationAccess) {
        throw new ForbiddenException('You do not have access to cancel this production request.');
      }
      return;
    }

    if (action === 'receive') {
      if (!hasDestinationAccess) {
        throw new ForbiddenException('You do not have destination-unit access for this production receipt.');
      }
      return;
    }

    if (!hasSourceAccess) {
      throw new ForbiddenException('You do not have source-unit access for this production workflow.');
    }
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId: number,
    operation?: string,
  ): Promise<Branch> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId, client_id: clientId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found.`);
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private async assertProductBelongsToClient(clientId: string, productId: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId, client_id: clientId },
      relations: ['production_station', 'base_uom', 'price_profile_entity'],
    });
    if (!product || product.is_active === false) {
      throw new BadRequestException(`Product ${productId} is not available for this client.`);
    }
    return product;
  }

  private async assertPreparedItemBelongsToClient(
    clientId: string,
    itemId?: number | null,
  ): Promise<InventoryItem | null> {
    if (!itemId) {
      return null;
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, client_id: clientId },
    });
    if (!item || item.item_is_active === false) {
      throw new BadRequestException(`Prepared inventory item ${itemId} is not available for this client.`);
    }
    return item;
  }

  private async assertRecipeBelongsToClient(
    clientId: string,
    recipeId: number,
    productId?: number | null,
  ): Promise<Recipe> {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId, client_id: clientId },
      relations: ['product'],
    });
    if (!recipe || !recipe.is_active) {
      throw new BadRequestException(`Recipe ${recipeId} is not available for this client.`);
    }
    if (productId && recipe.product_id !== productId) {
      throw new BadRequestException('The selected recipe does not belong to the chosen product.');
    }
    return recipe;
  }

  private async assertPreparedItemEnabledForBranch(
    clientId: string,
    branchId: number,
    itemId: number,
    contextLabel: string,
  ): Promise<void> {
    const mapping = await this.branchInventoryRepo.findOne({
      where: { branch_id: branchId, item_id: itemId },
    });
    if (!mapping || !mapping.is_enabled) {
      const item = await this.assertPreparedItemBelongsToClient(clientId, itemId);
      throw new BadRequestException(
        `${item?.item_name ?? `Prepared item ${itemId}`} is not enabled for the ${contextLabel} branch.`,
      );
    }
  }

  private async assertDestinationProductEnabled(
    clientId: string,
    destinationBranchId: number,
    productId: number,
  ): Promise<void> {
    const saleContext = await this.catalogService.getBranchProductSaleContext(
      clientId,
      destinationBranchId,
      productId,
    );
    if (!saleContext.effective_enabled) {
      throw new BadRequestException(
        `The selected product is not currently available at branch ${destinationBranchId}.`,
      );
    }
  }

  private isCrossBranch(order: Pick<ProductionOrder, 'branch_id' | 'destination_branch_id'>): boolean {
    return (order.destination_branch_id ?? order.branch_id) !== order.branch_id;
  }

  private deriveFlowScope(sourceBranch?: Branch | null, destinationBranch?: Branch | null) {
    if (!sourceBranch || !destinationBranch) {
      return 'local_kitchen';
    }
    if (sourceBranch.id === destinationBranch.id) {
      return 'local_kitchen';
    }
    if (sourceBranch.inventory_store_type === 'central') {
      return 'central_kitchen_supply';
    }
    return 'branch_supply';
  }

  private mapFlowLabel(flowScope: string): string {
    if (flowScope === 'central_kitchen_supply') {
      return 'Central Kitchen Supply';
    }
    if (flowScope === 'branch_supply') {
      return 'Branch Kitchen Supply';
    }
    return 'Local Kitchen Prep';
  }

  private mapOutputStageLabel(outputStage: OutputStage): string {
    return outputStage === 'semi_prepared' ? 'Semi-Prepared Output' : 'Prepared Output';
  }

  private async logOrderAudit(input: {
    user: JwtPayload;
    clientId: string;
    branchId: number;
    orderId: number;
    action: string;
    details: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.operationalAuditService.log({
      user: input.user,
      action: input.action,
      entity: 'production_orders',
      clientId: input.clientId,
      branchId: input.branchId,
      entityId: input.orderId,
      details: input.details,
      metadata: input.metadata,
    });
  }

  private computeAvailableActions(order: ProductionOrder, accessibleBranchIds?: number[]): string[] {
    const actions: string[] = [];
    const hasSourceAccess = this.hasBranchAccess(accessibleBranchIds, order.branch_id);
    const hasDestinationAccess = this.hasBranchAccess(
      accessibleBranchIds,
      order.destination_branch_id ?? order.branch_id,
    );
    const isCrossBranch = this.isCrossBranch(order);
    const materialsIssued = Boolean(order.materials_issued_at);

    if (order.status === 'requested') {
      if (hasSourceAccess && !materialsIssued) {
        actions.push('queue', 'issue', 'start', 'reject');
      }
      if (hasSourceAccess && materialsIssued) {
        actions.push('start');
      }
      if (!materialsIssued && (hasSourceAccess || hasDestinationAccess)) {
        actions.push('cancel');
      }
    }

    if (order.status === 'queued') {
      if (hasSourceAccess && !materialsIssued) {
        actions.push('issue', 'start', 'reject');
      }
      if (hasSourceAccess && materialsIssued) {
        actions.push('start');
      }
      if (!materialsIssued && (hasSourceAccess || hasDestinationAccess)) {
        actions.push('cancel');
      }
    }

    if (order.status === 'in_preparation' && hasSourceAccess) {
      actions.push('complete');
    }

    if (order.status === 'prepared' && isCrossBranch && hasSourceAccess) {
      actions.push('dispatch');
    }

    if (order.status === 'dispatched' && isCrossBranch && hasDestinationAccess) {
      actions.push('receive');
    }

    return [...new Set(actions)];
  }

  private computeMaterialSummary(order: ProductionOrder) {
    const materials = order.materials ?? [];
    const lineCount = materials.length;
    const totalIssuedQuantity = this.normalizeQuantity(
      materials.reduce((sum, line) => sum + this.normalizeQuantity(line.issued_quantity), 0),
    );
    const totalConsumedCost = this.normalizeQuantity(
      materials.reduce(
        (sum, line) =>
          sum + this.normalizeQuantity(line.issued_quantity) * this.normalizeQuantity(line.unit_cost),
        0,
      ),
    );
    const actualQuantity = this.normalizeQuantity(order.actual_quantity);
    const outputUnitCost = actualQuantity > 0
      ? this.normalizeQuantity(totalConsumedCost / actualQuantity)
      : 0;

    return {
      line_count: lineCount,
      total_issued_quantity: totalIssuedQuantity,
      total_consumed_cost: totalConsumedCost,
      output_unit_cost: outputUnitCost,
    };
  }

  private computeBatchSummary(order: ProductionOrder) {
    const batches = order.batches ?? [];
    const completedBatches = batches.filter((batch) => batch.status === 'completed');
    const actualQuantity = this.normalizeQuantity(
      batches.reduce((sum, batch) => sum + this.normalizeQuantity(batch.actual_quantity), 0),
    );
    const wastageQuantity = this.normalizeQuantity(
      batches.reduce((sum, batch) => sum + this.normalizeQuantity(batch.wastage_quantity), 0),
    );

    return {
      planned_batch_count: order.planned_batch_count ?? 1,
      actual_batch_count: order.actual_batch_count ?? completedBatches.length ?? null,
      completed_batch_count: completedBatches.length,
      total_actual_quantity: actualQuantity,
      total_wastage_quantity: wastageQuantity,
      yield_percentage: this.normalizePercent(order.yield_percentage),
    };
  }

  private mapMaterial(line: ProductionOrderMaterial) {
    const plannedQuantity = this.normalizeQuantity(line.planned_quantity);
    const issuedQuantity = this.normalizeQuantity(line.issued_quantity);
    const unitCost = this.normalizeQuantity(line.unit_cost);

    return {
      id: line.id,
      recipe_ingredient_id: line.recipe_ingredient_id,
      item_id: line.item_id,
      item_name: line.item?.item_name ?? `Item #${line.item_id}`,
      item_sku: line.item?.item_sku ?? null,
      uom: line.uom,
      wastage_percentage: this.normalizeQuantity(line.wastage_percentage),
      planned_quantity: plannedQuantity,
      issued_quantity: issuedQuantity,
      unit_cost: unitCost,
      extended_cost: this.normalizeQuantity(issuedQuantity * unitCost),
      created_at: line.created_at,
      updated_at: line.updated_at,
    };
  }

  private mapBatch(batch: ProductionOrderBatch) {
    return {
      id: batch.id,
      batch_no: batch.batch_no,
      batch_sequence: batch.batch_sequence,
      planned_quantity: this.normalizeQuantity(batch.planned_quantity),
      actual_quantity: this.normalizeQuantity(batch.actual_quantity),
      wastage_quantity: this.normalizeQuantity(batch.wastage_quantity),
      yield_percentage: this.normalizePercent(batch.yield_percentage),
      status: batch.status,
      notes: batch.notes,
      completed_at: batch.completed_at,
      created_at: batch.created_at,
      updated_at: batch.updated_at,
    };
  }

  private mapOrder(order: ProductionOrder, accessibleBranchIds?: number[]) {
    const flowScope = this.deriveFlowScope(order.branch, order.destination_branch ?? order.branch);
    const materialSummary = this.computeMaterialSummary(order);
    const batchSummary = this.computeBatchSummary(order);
    const outputStage = (order.output_stage ?? 'prepared') as OutputStage;

    return {
      id: order.id,
      client_id: order.client_id,
      source_branch_id: order.branch_id,
      destination_branch_id: order.destination_branch_id ?? order.branch_id,
      status: order.status,
      flow_scope: flowScope,
      flow_label: this.mapFlowLabel(flowScope),
      is_cross_branch: this.isCrossBranch(order),
      production_no: order.production_no,
      planned_quantity: this.normalizeQuantity(order.planned_quantity),
      actual_quantity: this.normalizeQuantity(order.actual_quantity),
      production_date: order.production_date,
      required_at: order.required_at,
      planned_batch_count: order.planned_batch_count ?? 1,
      actual_batch_count: order.actual_batch_count,
      wastage_quantity: this.normalizeQuantity(order.wastage_quantity),
      yield_percentage: this.normalizePercent(order.yield_percentage),
      requested_by: order.requested_by,
      requested_by_name: order.requested_by_name,
      requested_at: order.requested_at ?? order.created_at,
      queued_by: order.queued_by,
      queued_by_name: order.queued_by_name,
      queued_at: order.queued_at,
      issued_by: order.issued_by,
      issued_by_name: order.issued_by_name,
      materials_issued: Boolean(order.materials_issued_at),
      materials_issued_at: order.materials_issued_at,
      issue_notes: order.issue_notes,
      queue_notes: order.queue_notes,
      start_date: order.start_date,
      completion_date: order.completion_date,
      completed_by: order.completed_by,
      completed_by_name: order.completed_by_name,
      completion_notes: order.completion_notes,
      notes: order.notes,
      rejection_notes: order.rejection_notes,
      cancellation_notes: order.cancellation_notes,
      dispatch_notes: order.dispatch_notes,
      receipt_notes: order.receipt_notes,
      variance_notes: order.variance_notes,
      output_stage: outputStage,
      output_stage_label: this.mapOutputStageLabel(outputStage),
      source_unit_label:
        order.source_unit_label || order.branch?.production_source_label || order.branch?.branch_name || null,
      destination_unit_label:
        order.destination_unit_label
        || order.destination_branch?.branch_name
        || order.branch?.branch_name
        || null,
      recipe: order.recipe
        ? {
            id: order.recipe.id,
            recipe_name: order.recipe.recipe_name,
            yield_quantity: this.normalizeQuantity(order.recipe.yield_quantity),
            yield_uom: order.recipe.yield_uom,
          }
        : null,
      product: order.product
        ? {
            id: order.product.id,
            product_name: order.product.product_name,
            product_code: order.product.product_code,
            product_sku: order.product.product_sku,
            production_station: order.product.production_station
              ? {
                  id: order.product.production_station.id,
                  name: order.product.production_station.name,
                }
              : null,
            base_uom: order.product.base_uom
              ? {
                  id: order.product.base_uom.id,
                  name: order.product.base_uom.name,
                }
              : null,
          }
        : null,
      prepared_item: order.prepared_item
        ? {
            id: order.prepared_item.id,
            item_name: order.prepared_item.item_name,
            item_sku: order.prepared_item.item_sku,
            uom_base: order.prepared_item.uom_base,
          }
        : null,
      materials: (order.materials ?? []).map((line) => this.mapMaterial(line)),
      batches: (order.batches ?? [])
        .slice()
        .sort((a, b) => a.batch_sequence - b.batch_sequence)
        .map((batch) => this.mapBatch(batch)),
      material_summary: materialSummary,
      batch_summary: batchSummary,
      source_branch: order.branch
        ? {
            id: order.branch.id,
            branch_name: order.branch.branch_name,
            branch_code: order.branch.branch_code,
            inventory_store_type: order.branch.inventory_store_type,
            is_production_source: order.branch.is_production_source,
            production_source_label: order.branch.production_source_label,
          }
        : null,
      destination_branch: (order.destination_branch ?? order.branch)
        ? {
            id: (order.destination_branch ?? order.branch)!.id,
            branch_name: (order.destination_branch ?? order.branch)!.branch_name,
            branch_code: (order.destination_branch ?? order.branch)!.branch_code,
            inventory_store_type: (order.destination_branch ?? order.branch)!.inventory_store_type,
            is_production_source: (order.destination_branch ?? order.branch)!.is_production_source,
            production_source_label: (order.destination_branch ?? order.branch)!.production_source_label,
          }
        : null,
      linked_transfer: order.linked_transfer
        ? {
            id: order.linked_transfer.id,
            transfer_no: order.linked_transfer.transfer_no,
            status: order.linked_transfer.status,
            flow_type: order.linked_transfer.flow_type,
            origin_production_order_id: order.linked_transfer.origin_production_order_id,
            origin_production_no: order.linked_transfer.origin_production_no,
            dispatched_at: order.linked_transfer.dispatched_at,
            received_at: order.linked_transfer.received_at,
          }
        : null,
      available_actions: this.computeAvailableActions(order, accessibleBranchIds),
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  private async getOrderEntity(clientId: string, orderId: number): Promise<ProductionOrder> {
    const order = await this.prodRepo.findOne({
      where: { id: orderId, client_id: clientId },
      relations: [
        'branch',
        'destination_branch',
        'recipe',
        'product',
        'product.production_station',
        'product.base_uom',
        'prepared_item',
        'materials',
        'materials.item',
        'batches',
        'linked_transfer',
      ],
    });
    if (!order) {
      throw new NotFoundException('Production order not found.');
    }
    return order;
  }

  private async resolveRecipeForOrder(order: ProductionOrder): Promise<{ recipe: Recipe; ingredients: RecipeIngredient[] }> {
    if (!order.product_id) {
      throw new BadRequestException('A product is required before recipe-linked production can proceed.');
    }

    let recipe: Recipe;
    if (order.recipe_id) {
      recipe = await this.assertRecipeBelongsToClient(order.client_id, order.recipe_id, order.product_id);
    } else {
      const recipes = await this.recipeRepo.find({
        where: { client_id: order.client_id, product_id: order.product_id, is_active: true },
        order: { id: 'ASC' },
      });
      if (recipes.length === 0) {
        throw new BadRequestException('An active recipe is required before materials can be issued to production.');
      }
      if (recipes.length > 1) {
        throw new BadRequestException(
          'Multiple active recipes exist for this product. Select a recipe when creating the production request.',
        );
      }
      recipe = recipes[0];
    }

    const ingredients = await this.ingredientRepo.find({
      where: { recipe_id: recipe.id },
      relations: ['item'],
      order: { id: 'ASC' },
    });
    if (ingredients.length === 0) {
      throw new BadRequestException('The selected recipe has no ingredients configured.');
    }

    return { recipe, ingredients };
  }

  private buildMaterialPlan(order: ProductionOrder, recipe: Recipe, ingredients: RecipeIngredient[]): MaterialPlanLine[] {
    const plannedQuantity = this.normalizeQuantity(order.planned_quantity);
    const recipeYield = this.normalizeQuantity(recipe.yield_quantity);
    if (plannedQuantity <= 0) {
      throw new BadRequestException('Planned quantity must be greater than zero before issuing materials.');
    }
    if (recipeYield <= 0) {
      throw new BadRequestException(`Recipe ${recipe.recipe_name} has an invalid yield quantity.`);
    }

    const yieldFactor = plannedQuantity / recipeYield;
    const lines = ingredients.map((ingredient) => {
      if (!ingredient.item || ingredient.item.item_is_active === false) {
        throw new BadRequestException(`Recipe ingredient #${ingredient.id} references an inactive inventory item.`);
      }
      const baseQuantity = this.normalizeQuantity(ingredient.quantity * yieldFactor);
      const wastageMultiplier = 1 + this.normalizeQuantity(ingredient.wastage_percentage) / 100;
      const plannedIssueQuantity = this.normalizeQuantity(baseQuantity * wastageMultiplier);

      return {
        recipe_ingredient_id: ingredient.id,
        item_id: ingredient.item_id,
        item_name: ingredient.item.item_name,
        item_sku: ingredient.item.item_sku ?? null,
        uom: ingredient.uom || ingredient.item.uom_base,
        wastage_percentage: this.normalizeQuantity(ingredient.wastage_percentage),
        planned_quantity: plannedIssueQuantity,
      };
    });

    const effectiveLines = lines.filter((line) => line.planned_quantity > 0);
    if (effectiveLines.length === 0) {
      throw new BadRequestException('The selected recipe does not yield any issuable material quantities.');
    }

    return effectiveLines;
  }

  private aggregateMaterialPlan(lines: MaterialPlanLine[]) {
    const totals = new Map<number, { item_id: number; item_name: string; quantity: number }>();
    for (const line of lines) {
      const current = totals.get(line.item_id);
      if (current) {
        current.quantity = this.normalizeQuantity(current.quantity + line.planned_quantity);
      } else {
        totals.set(line.item_id, {
          item_id: line.item_id,
          item_name: line.item_name,
          quantity: line.planned_quantity,
        });
      }
    }
    return [...totals.values()];
  }

  private async ensureStockLevel(
    manager: EntityManager,
    clientId: string,
    branchId: number,
    itemId: number,
  ): Promise<StockLevel> {
    let stockLevel = await manager.findOne(StockLevel, {
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
    });

    if (!stockLevel) {
      stockLevel = manager.create(StockLevel, {
        client_id: clientId,
        branch_id: branchId,
        item_id: itemId,
        current_quantity: 0,
        last_unit_cost: 0,
        last_received_at: null,
      });
    }

    return stockLevel;
  }

  private async findLatestUnitCost(
    clientId: string,
    branchId: number,
    itemId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const entityManager = manager ?? this.dataSource.manager;
    const stockLevel = await entityManager.findOne(StockLevel, {
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
    });
    const stockLevelCost = this.normalizeQuantity(stockLevel?.last_unit_cost ?? 0);
    if (stockLevelCost > 0) {
      return stockLevelCost;
    }

    const ledger = await entityManager.findOne(StockLedger, {
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
      order: { created_at: 'DESC', id: 'DESC' },
    });

    return this.normalizeQuantity(ledger?.unit_cost ?? 0);
  }

  private computeOutputUnitCost(order: ProductionOrder, actualQuantity: number): number {
    if (actualQuantity <= 0) {
      return 0;
    }

    const totalMaterialCost = (order.materials ?? []).reduce(
      (sum, line) =>
        sum + this.normalizeQuantity(line.issued_quantity) * this.normalizeQuantity(line.unit_cost),
      0,
    );

    return this.normalizeQuantity(totalMaterialCost / actualQuantity);
  }

  private buildBatchPlan(
    order: ProductionOrder,
    completion: CompleteProductionOrderDto,
  ): BatchPlanInput[] {
    const actualQuantity = this.normalizeQuantity(completion.actual_quantity);
    const wastageQuantity = this.normalizeQuantity(completion.wastage_quantity ?? 0);
    const productionNo = order.production_no || this.buildProductionNo(order.id);
    const batches = completion.batches ?? [];

    if (batches.length === 0) {
      return [
        {
          batch_no: this.buildBatchNo(productionNo, 1),
          batch_sequence: 1,
          planned_quantity: this.normalizeQuantity(order.planned_quantity),
          actual_quantity: actualQuantity,
          wastage_quantity: wastageQuantity,
          yield_percentage: this.computeYieldPercentage(actualQuantity, order.planned_quantity),
          notes: completion.notes?.trim() || null,
        },
      ];
    }

    const totalBatchActual = this.normalizeQuantity(
      batches.reduce((sum, batch) => sum + this.normalizeQuantity(batch.actual_quantity), 0),
    );
    const totalBatchWastage = this.normalizeQuantity(
      batches.reduce((sum, batch) => sum + this.normalizeQuantity(batch.wastage_quantity ?? 0), 0),
    );
    if (totalBatchActual !== actualQuantity) {
      throw new BadRequestException('Batch actual quantities must total the completed production quantity.');
    }
    if (totalBatchWastage !== wastageQuantity) {
      throw new BadRequestException('Batch wastage quantities must total the order wastage quantity.');
    }

    return batches.map((batch, index) => {
      const normalizedActual = this.normalizeQuantity(batch.actual_quantity);
      const normalizedWastage = this.normalizeQuantity(batch.wastage_quantity ?? 0);
      const totalHandled = this.normalizeQuantity(normalizedActual + normalizedWastage);
      if (totalHandled <= 0) {
        throw new BadRequestException('Each batch must record actual or wastage quantity.');
      }

      const batchNo = batch.batch_no?.trim() || this.buildBatchNo(productionNo, index + 1);
      return {
        batch_no: batchNo,
        batch_sequence: index + 1,
        planned_quantity: this.normalizeQuantity(order.planned_quantity / batches.length),
        actual_quantity: normalizedActual,
        wastage_quantity: normalizedWastage,
        yield_percentage: this.computeYieldPercentage(normalizedActual, totalHandled),
        notes: batch.notes?.trim() || null,
      };
    });
  }

  async createProductionOrder(
    clientId: string,
    dto: CreateProductionOrderDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const sourceBranchId = dto.source_branch_id ?? dto.destination_branch_id;
    if (!sourceBranchId) {
      throw new BadRequestException('source_branch_id is required for a production request.');
    }

    const destinationBranchId = dto.destination_branch_id ?? sourceBranchId;
    const [sourceBranch, destinationBranch, product, preparedItem] = await Promise.all([
      this.assertBranchBelongsToClient(clientId, sourceBranchId, 'create production orders'),
      this.assertBranchBelongsToClient(clientId, destinationBranchId, 'receive production orders'),
      this.assertProductBelongsToClient(clientId, dto.product_id),
      this.assertPreparedItemBelongsToClient(clientId, dto.prepared_item_id ?? null),
    ]);

    await this.assertDestinationProductEnabled(clientId, destinationBranch.id, product.id);

    this.assertOrderAccess('create', accessibleBranchIds, {
      branch_id: sourceBranch.id,
      destination_branch_id: destinationBranch.id,
    });

    const plannedQuantity = this.normalizeQuantity(dto.planned_quantity);
    if (plannedQuantity <= 0) {
      throw new BadRequestException('Planned quantity must be greater than zero.');
    }
    const plannedBatchCount = Number(dto.planned_batch_count ?? 1);
    if (!Number.isInteger(plannedBatchCount) || plannedBatchCount <= 0) {
      throw new BadRequestException('planned_batch_count must be a whole number greater than zero.');
    }

    const outputStage = (dto.output_stage ?? 'prepared') as OutputStage;
    if (outputStage === 'semi_prepared' && !preparedItem) {
      throw new BadRequestException('output_stage can only be set when a prepared inventory item is linked.');
    }

    let recipe: Recipe | null = null;
    if (dto.recipe_id) {
      recipe = await this.assertRecipeBelongsToClient(clientId, dto.recipe_id, product.id);
    } else {
      const availableRecipes = await this.recipeRepo.find({
        where: { client_id: clientId, product_id: product.id, is_active: true },
        order: { id: 'ASC' },
      });
      recipe = availableRecipes.length === 1 ? availableRecipes[0] : null;
    }

    if (preparedItem) {
      await this.assertPreparedItemEnabledForBranch(clientId, sourceBranch.id, preparedItem.id, 'source');
      await this.assertPreparedItemEnabledForBranch(clientId, destinationBranch.id, preparedItem.id, 'destination');
    }

    if (sourceBranch.id !== destinationBranch.id) {
      if (!sourceBranch.is_production_source) {
        throw new BadRequestException(
          `${sourceBranch.branch_name} is not designated as a production supply source.`,
        );
      }
      if (!preparedItem) {
        throw new BadRequestException(
          'prepared_item_id is required when production will be dispatched to another branch.',
        );
      }
    }

    const order = this.prodRepo.create({
      client_id: clientId,
      branch_id: sourceBranch.id,
      destination_branch_id: destinationBranch.id,
      product_id: product.id,
      recipe_id: recipe?.id ?? null,
      prepared_item_id: preparedItem?.id ?? null,
      output_stage: outputStage,
      planned_quantity: plannedQuantity,
      status: 'requested',
      requested_by: resolveActorId(user) ?? null,
      requested_by_name: this.buildActorName(user),
      requested_at: new Date(),
      source_unit_label:
        dto.source_unit_label?.trim() || sourceBranch.production_source_label || sourceBranch.branch_name,
      destination_unit_label: dto.destination_unit_label?.trim() || destinationBranch.branch_name,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.prodRepo.save(order);
    saved.production_no = this.buildProductionNo(saved.id);
    saved.production_date = this.toDateOnly(dto.production_date) ?? new Date().toISOString().slice(0, 10);
    saved.required_at = dto.required_at ? new Date(dto.required_at) : null;
    saved.planned_batch_count = plannedBatchCount;
    await this.prodRepo.save(saved);
    const created = await this.getOrderEntity(clientId, saved.id);

    await this.logOrderAudit({
      user,
      action: 'Production Request Created',
      clientId,
      branchId: sourceBranch.id,
      orderId: created.id,
      details: `Production request #${created.id} created`,
      metadata: {
        destination_branch_id: destinationBranch.id,
        product_id: product.id,
        recipe_id: recipe?.id ?? null,
        prepared_item_id: preparedItem?.id ?? null,
        output_stage: outputStage,
        production_no: saved.production_no,
        production_date: saved.production_date,
        planned_batch_count: plannedBatchCount,
      },
    });

    return this.mapOrder(created, accessibleBranchIds);
  }

  async getOrders(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: ProductionOrderQueryDto,
  ) {
    const query = this.prodRepo
      .createQueryBuilder('production_order')
      .leftJoinAndSelect('production_order.branch', 'branch')
      .leftJoinAndSelect('production_order.destination_branch', 'destination_branch')
      .leftJoinAndSelect('production_order.recipe', 'recipe')
      .leftJoinAndSelect('production_order.product', 'product')
      .leftJoinAndSelect('product.production_station', 'production_station')
      .leftJoinAndSelect('product.base_uom', 'base_uom')
      .leftJoinAndSelect('production_order.prepared_item', 'prepared_item')
      .leftJoinAndSelect('production_order.batches', 'batches')
      .leftJoinAndSelect('production_order.linked_transfer', 'linked_transfer')
      .where('production_order.client_id = :clientId', { clientId });

    if (filters?.status) {
      query.andWhere('production_order.status = :status', { status: filters.status });
    }

    if (filters?.branch_id) {
      if (filters.scope === 'source') {
        query.andWhere('production_order.branch_id = :branchId', { branchId: filters.branch_id });
      } else if (filters.scope === 'destination') {
        query.andWhere('COALESCE(production_order.destination_branch_id, production_order.branch_id) = :branchId', {
          branchId: filters.branch_id,
        });
      } else {
        query.andWhere(
          new Brackets((qb) => {
            qb.where('production_order.branch_id = :branchId', { branchId: filters.branch_id }).orWhere(
              'COALESCE(production_order.destination_branch_id, production_order.branch_id) = :branchId',
              { branchId: filters.branch_id },
            );
          }),
        );
      }
    }

    if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('production_order.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds }).orWhere(
            'COALESCE(production_order.destination_branch_id, production_order.branch_id) IN (:...accessibleBranchIds)',
            { accessibleBranchIds },
          );
        }),
      );
    }

    const orders = await query
      .orderBy('production_order.created_at', 'DESC')
      .getMany();

    return orders.map((order) => this.mapOrder(order, accessibleBranchIds));
  }

  async getOrder(clientId: string, orderId: number, accessibleBranchIds?: number[]) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('create', accessibleBranchIds, order);
    return this.mapOrder(order, accessibleBranchIds);
  }

  async queueProduction(
    clientId: string,
    orderId: number,
    dto: ProductionDecisionDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('queue', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'queue production');

    if (order.materials_issued_at) {
      throw new BadRequestException('This production request has already been issued to production.');
    }
    if (order.status !== 'requested') {
      throw new BadRequestException('Only requested production orders can be queued.');
    }

    order.status = 'queued';
    order.queued_by = resolveActorId(user) ?? null;
    order.queued_by_name = this.buildActorName(user);
    order.queued_at = new Date();
    order.queue_notes = dto.notes?.trim() || null;
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Request Queued',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production request #${order.id} queued`,
      metadata: {
        destination_branch_id: order.destination_branch_id ?? order.branch_id,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async issueMaterials(
    clientId: string,
    orderId: number,
    dto: IssueProductionMaterialsDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('issue', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'issue production materials');

    if (!['requested', 'queued', 'in_preparation'].includes(order.status)) {
      throw new BadRequestException('Materials can only be issued for open production orders.');
    }
    if (order.materials_issued_at) {
      throw new BadRequestException('Materials have already been issued for this production order.');
    }

    const { recipe, ingredients } = await this.resolveRecipeForOrder(order);
    const materialPlan = this.buildMaterialPlan(order, recipe, ingredients);
    const materialTotals = this.aggregateMaterialPlan(materialPlan);
    const notes = dto.notes?.trim() || null;

    await this.dataSource.transaction(async (manager) => {
      const unitCostByItem = new Map<number, number>();

      for (const total of materialTotals) {
        const stockLevel = await this.ensureStockLevel(manager, clientId, order.branch_id, total.item_id);
        const availableQuantity = this.normalizeQuantity(stockLevel.current_quantity);
        if (availableQuantity < total.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${total.item_name}. Available ${availableQuantity}, required ${total.quantity}.`,
          );
        }

        const unitCost = await this.findLatestUnitCost(clientId, order.branch_id, total.item_id, manager);
        stockLevel.current_quantity = this.normalizeQuantity(availableQuantity - total.quantity);
        await manager.save(stockLevel);

        const ledgerEntry = manager.create(StockLedger, {
          client_id: clientId,
          branch_id: order.branch_id,
          item_id: total.item_id,
          quantity: -total.quantity,
          transaction_type: 'production',
          reference_id: `PROD-${order.id}:ISSUE`,
          unit_cost: unitCost,
        });
        await manager.save(ledgerEntry);
        unitCostByItem.set(total.item_id, unitCost);
      }

      await manager.delete(ProductionOrderMaterial, { production_order_id: order.id });

      for (const line of materialPlan) {
        const material = manager.create(ProductionOrderMaterial, {
          client_id: clientId,
          production_order_id: order.id,
          recipe_ingredient_id: line.recipe_ingredient_id,
          item_id: line.item_id,
          uom: line.uom,
          wastage_percentage: line.wastage_percentage,
          planned_quantity: line.planned_quantity,
          issued_quantity: line.planned_quantity,
          unit_cost: unitCostByItem.get(line.item_id) ?? 0,
        });
        await manager.save(material);
      }

      if (order.status === 'requested' && !order.queued_at) {
        order.status = 'queued';
        order.queued_by = resolveActorId(user) ?? null;
        order.queued_by_name = this.buildActorName(user);
        order.queued_at = new Date();
      }

      order.recipe_id = recipe.id;
      order.issued_by = resolveActorId(user) ?? null;
      order.issued_by_name = this.buildActorName(user);
      order.materials_issued_at = new Date();
      order.issue_notes = notes;
      await manager.save(order);
    });

    await this.logOrderAudit({
      user,
      action: 'Production Materials Issued',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Materials issued for production order #${order.id}`,
      metadata: {
        recipe_id: recipe.id,
        line_count: materialPlan.length,
        source_branch_id: order.branch_id,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async rejectProduction(
    clientId: string,
    orderId: number,
    dto: ProductionDecisionDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('reject', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'reject production');

    if (order.materials_issued_at) {
      throw new BadRequestException('Production orders with issued materials cannot be rejected.');
    }
    if (!['requested', 'queued'].includes(order.status)) {
      throw new BadRequestException('Only requested or queued production orders can be rejected.');
    }

    order.status = 'rejected';
    order.rejection_notes = dto.notes?.trim() || null;
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Request Rejected',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production request #${order.id} rejected`,
      metadata: {
        destination_branch_id: order.destination_branch_id ?? order.branch_id,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async cancelProduction(
    clientId: string,
    orderId: number,
    dto: ProductionDecisionDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('cancel', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'cancel production');
    assertBranchOperationalWriteAllowed(order.destination_branch ?? order.branch, 'cancel production');

    if (order.materials_issued_at) {
      throw new BadRequestException('Production orders with issued materials cannot be cancelled in this batch.');
    }
    if (!['requested', 'queued', 'in_preparation'].includes(order.status)) {
      throw new BadRequestException('Only open production orders can be cancelled.');
    }

    order.status = 'cancelled';
    order.cancellation_notes = dto.notes?.trim() || null;
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Request Cancelled',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production request #${order.id} cancelled`,
      metadata: {
        destination_branch_id: order.destination_branch_id ?? order.branch_id,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async startProduction(
    clientId: string,
    orderId: number,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    let order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('start', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'start production');

    if (!['requested', 'queued'].includes(order.status)) {
      throw new BadRequestException('Only requested or queued production orders can be started.');
    }

    if (!order.materials_issued_at) {
      await this.issueMaterials(
        clientId,
        orderId,
        { notes: 'Auto-issued when production started.' },
        user,
        accessibleBranchIds,
      );
      order = await this.getOrderEntity(clientId, orderId);
    }

    order.status = 'in_preparation';
    order.start_date = new Date();
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Started',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production order #${order.id} started`,
      metadata: {
        destination_branch_id: order.destination_branch_id ?? order.branch_id,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async completeProduction(
    clientId: string,
    orderId: number,
    dto: CompleteProductionOrderDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    let order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('complete', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'complete production');

    if (order.status !== 'in_preparation') {
      throw new BadRequestException('Only in-preparation production orders can be completed.');
    }

    if (!order.materials_issued_at) {
      await this.issueMaterials(
        clientId,
        orderId,
        { notes: 'Auto-issued during production completion.' },
        user,
        accessibleBranchIds,
      );
      order = await this.getOrderEntity(clientId, orderId);
    }

    const actualQuantity = this.normalizeQuantity(dto.actual_quantity);
    if (actualQuantity <= 0) {
      throw new BadRequestException('Actual prepared quantity must be greater than zero.');
    }
    const wastageQuantity = this.normalizeQuantity(dto.wastage_quantity ?? 0);
    const batchPlan = this.buildBatchPlan(order, dto);
    const yieldPercentage = this.computeYieldPercentage(actualQuantity, this.normalizeQuantity(order.planned_quantity));

    const outputUnitCost = this.computeOutputUnitCost(order, actualQuantity);

    await this.dataSource.transaction(async (manager) => {
      if (order.prepared_item_id) {
        await this.assertPreparedItemEnabledForBranch(clientId, order.branch_id, order.prepared_item_id, 'source');

        const stockLevel = await this.ensureStockLevel(manager, clientId, order.branch_id, order.prepared_item_id);
        stockLevel.current_quantity = this.normalizeQuantity(
          this.normalizeQuantity(stockLevel.current_quantity) + actualQuantity,
        );
        if (outputUnitCost > 0) {
          stockLevel.last_unit_cost = outputUnitCost;
        }
        stockLevel.last_received_at = new Date();
        await manager.save(stockLevel);

        const ledgerEntry = manager.create(StockLedger, {
          client_id: clientId,
          branch_id: order.branch_id,
          item_id: order.prepared_item_id,
          quantity: actualQuantity,
          transaction_type: 'production',
          reference_id: `PROD-${order.id}:OUTPUT`,
          unit_cost: outputUnitCost,
        });
        await manager.save(ledgerEntry);
      }

      order.status = 'prepared';
      order.actual_quantity = actualQuantity;
      order.wastage_quantity = wastageQuantity;
      order.yield_percentage = yieldPercentage;
      order.actual_batch_count = batchPlan.length;
      order.completion_date = new Date();
      order.completed_by = resolveActorId(user) ?? null;
      order.completed_by_name = this.buildActorName(user);
      order.completion_notes = dto.notes?.trim() || null;
      await manager.save(order);

      await manager.delete(ProductionOrderBatch, { production_order_id: order.id });
      for (const batch of batchPlan) {
        const batchEntity = manager.create(ProductionOrderBatch, {
          client_id: clientId,
          production_order_id: order.id,
          batch_no: batch.batch_no,
          batch_sequence: batch.batch_sequence,
          planned_quantity: batch.planned_quantity,
          actual_quantity: batch.actual_quantity,
          wastage_quantity: batch.wastage_quantity,
          yield_percentage: batch.yield_percentage,
          status: 'completed',
          notes: batch.notes,
          completed_at: order.completion_date,
        });
        await manager.save(batchEntity);
      }
    });

    await this.logOrderAudit({
      user,
      action: 'Production Prepared',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production order #${order.id} marked prepared`,
      metadata: {
        destination_branch_id: order.destination_branch_id ?? order.branch_id,
        actual_quantity: actualQuantity,
        prepared_item_id: order.prepared_item_id,
        output_stage: order.output_stage,
        output_unit_cost: outputUnitCost,
        wastage_quantity: wastageQuantity,
        yield_percentage: yieldPercentage,
        batch_count: batchPlan.length,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async dispatchProduction(
    clientId: string,
    orderId: number,
    dto: DispatchProductionOrderDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('dispatch', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.branch, 'dispatch production');
    assertBranchOperationalWriteAllowed(order.destination_branch ?? order.branch, 'dispatch production');

    if (!this.isCrossBranch(order)) {
      throw new BadRequestException('Local kitchen production does not require dispatch.');
    }
    if (order.status !== 'prepared') {
      throw new BadRequestException('Only prepared production orders can be dispatched.');
    }
    if (!order.prepared_item_id) {
      throw new BadRequestException('A prepared inventory item is required before dispatch.');
    }

    const actualQuantity = this.normalizeQuantity(order.actual_quantity ?? order.planned_quantity);
    const dispatchQuantity = this.normalizeQuantity(dto.dispatch_quantity ?? actualQuantity);
    if (dispatchQuantity <= 0) {
      throw new BadRequestException('Dispatch quantity must be greater than zero.');
    }
    if (dispatchQuantity > actualQuantity) {
      throw new BadRequestException('Dispatch quantity cannot exceed the completed/prepared quantity.');
    }

    let transfer =
      order.linked_transfer_id
        ? await this.transfersService.findOne(
            clientId,
            order.linked_transfer_id,
            accessibleBranchIds,
            { flowType: 'production_supply' },
          )
        : null;

    if (!transfer) {
      transfer = await this.transfersService.create(
        clientId,
        {
          source_branch_id: order.branch_id,
          destination_branch_id: order.destination_branch_id ?? order.branch_id,
          source_store_label:
            order.source_unit_label || order.branch.production_source_label || order.branch.branch_name,
          destination_store_label:
            order.destination_unit_label || order.destination_branch?.branch_name || order.branch.branch_name,
          reason_code: 'production_dispatch',
          origin_production_order_id: order.id,
          origin_production_no: order.production_no || this.buildProductionNo(order.id),
          notes: order.notes || undefined,
          require_approval: false,
          items: [
            {
              item_id: order.prepared_item_id,
              production_stage: (order.output_stage ?? 'prepared') as 'semi_prepared' | 'prepared',
              requested_quantity: dispatchQuantity,
            },
          ],
        },
        user,
        accessibleBranchIds,
        { flowType: 'production_supply' },
      );
      order.linked_transfer_id = transfer.id;
    }

    if (!['requested', 'approved'].includes(transfer.status)) {
      throw new BadRequestException('Linked production dispatch is not ready to be dispatched.');
    }

    const dispatchedTransfer = await this.transfersService.dispatch(
      clientId,
      transfer.id,
      {
        notes: dto.notes?.trim() || undefined,
        items: transfer.items.map((item: any) => ({
          transfer_item_id: item.id,
          dispatch_quantity: dispatchQuantity,
        })),
      },
      user,
      accessibleBranchIds,
      { flowType: 'production_supply' },
    );

    order.status = 'dispatched';
    order.dispatch_notes = dto.notes?.trim() || null;
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Order Dispatched',
      clientId,
      branchId: order.branch_id,
      orderId: order.id,
      details: `Production order #${order.id} dispatched`,
      metadata: {
        linked_transfer_id: dispatchedTransfer.id,
        destination_branch_id: order.destination_branch_id,
        dispatch_quantity: dispatchQuantity,
        output_stage: order.output_stage,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }

  async receiveProduction(
    clientId: string,
    orderId: number,
    dto: ReceiveProductionOrderDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const order = await this.getOrderEntity(clientId, orderId);
    this.assertOrderAccess('receive', accessibleBranchIds, order);
    assertBranchOperationalWriteAllowed(order.destination_branch ?? order.branch, 'receive production');

    if (!this.isCrossBranch(order)) {
      throw new BadRequestException('Local kitchen production does not require receipt acknowledgment.');
    }
    if (order.status !== 'dispatched') {
      throw new BadRequestException('Only dispatched production orders can be received.');
    }
    if (!order.linked_transfer_id) {
      throw new BadRequestException('This production order has no linked dispatch record.');
    }

    const transfer = await this.transfersService.findOne(
      clientId,
      order.linked_transfer_id,
      accessibleBranchIds,
      { flowType: 'production_supply' },
    );
    const transferLine = transfer.items?.[0];
    if (!transferLine) {
      throw new BadRequestException('Linked production dispatch line was not found.');
    }

    const dispatchedQuantity = this.normalizeQuantity(transferLine.dispatched_quantity);
    const shortQuantity = this.normalizeQuantity(dto.short_quantity ?? 0);
    const damagedQuantity = this.normalizeQuantity(dto.damaged_quantity ?? 0);
    const receivedQuantity = dto.received_quantity === undefined
      ? this.normalizeQuantity(dispatchedQuantity - shortQuantity - damagedQuantity)
      : this.normalizeQuantity(dto.received_quantity);

    if (this.normalizeQuantity(receivedQuantity + shortQuantity + damagedQuantity) !== dispatchedQuantity) {
      throw new BadRequestException('Received, short, and damaged quantities must reconcile to the dispatched quantity.');
    }

    await this.transfersService.receive(
      clientId,
      order.linked_transfer_id,
      {
        notes: dto.notes?.trim() || undefined,
        variance_notes: dto.variance_notes?.trim() || undefined,
        items: [
          {
            transfer_item_id: transferLine.id,
            received_quantity: receivedQuantity,
            short_quantity: shortQuantity,
            damaged_quantity: damagedQuantity,
            variance_reason: dto.variance_reason?.trim() || undefined,
          },
        ],
      },
      user,
      accessibleBranchIds,
      { flowType: 'production_supply' },
    );

    order.status = 'received';
    order.receipt_notes = dto.notes?.trim() || null;
    order.variance_notes = dto.variance_notes?.trim() || null;
    await this.prodRepo.save(order);

    await this.logOrderAudit({
      user,
      action: 'Production Order Received',
      clientId,
      branchId: order.destination_branch_id ?? order.branch_id,
      orderId: order.id,
      details: `Production order #${order.id} received`,
      metadata: {
        linked_transfer_id: order.linked_transfer_id,
        source_branch_id: order.branch_id,
        received_quantity: receivedQuantity,
        short_quantity: shortQuantity,
        damaged_quantity: damagedQuantity,
      },
    });

    return this.getOrder(clientId, orderId, accessibleBranchIds);
  }
}
