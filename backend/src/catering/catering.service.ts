import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireBranchId,
  resolveActorId,
} from '../auth/request-context.util';
import { Product } from '../catalog/entities/product.entity';
import { ChartOfAccount } from '../accounting/entities/chart-of-accounts.entity';
import { AccountingService } from '../accounting/accounting.service';
import { Customer } from '../customers/entities/customer.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { ProcurementRequestsService } from '../inventory-op/procurement-requests/procurement-requests.service';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import { ProductionService } from '../production/production.service';
import { CreateProductionOrderDto } from '../production/dto/production-order.dto';
import { RecipeCostingService } from '../recipe/recipe-costing.service';
import { Recipe } from '../recipe/entities/recipe.entity';
import { Branch } from '../setup/entities/branch.entity';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import {
  CATERING_EVENT_STATUSES,
  CATERING_EVENT_BILLING_TYPES,
  CATERING_INQUIRY_STATUSES,
  CATERING_QUOTATION_STATUSES,
  CATERING_SETTLEMENT_TYPES,
  type CateringBillingStatus,
  type CateringEventBillingType,
  type CateringEventStatus,
  type CateringInquiryStatus,
  type CateringPaymentMode,
  type CateringQuotationStatus,
  type CateringSettlementType,
  type CateringSupplyStrategy,
} from './catering.constants';
import {
  CateringEventQueryDto,
  CateringOptionsQueryDto,
  CateringQuotationItemDto,
  CateringQuotationQueryDto,
  CateringInquiryQueryDto,
  ConvertQuotationToEventDto,
  CreateCateringInquiryDto,
  CreateCateringQuotationDto,
  CreateEventProcurementDto,
  CreateEventProductionDto,
  IssueEventBillingDto,
  RecordEventSettlementDto,
  UpdateCateringEventDto,
  UpdateCateringEventStatusDto,
  UpdateCateringInquiryDto,
  UpdateCateringQuotationDto,
  UpdateQuotationStatusDto,
} from './dto/catering.dto';
import { CateringEvent } from './entities/catering-event.entity';
import { CateringEventBilling } from './entities/catering-event-billing.entity';
import { CateringEventItem } from './entities/catering-event-item.entity';
import { CateringEventProcurementLink } from './entities/catering-event-procurement-link.entity';
import { CateringEventProductionLink } from './entities/catering-event-production-link.entity';
import { CateringEventSettlement } from './entities/catering-event-settlement.entity';
import { CateringInquiry } from './entities/catering-inquiry.entity';
import { CateringQuotation } from './entities/catering-quotation.entity';
import { CateringQuotationItem } from './entities/catering-quotation-item.entity';

type ResolvedQuotationLine = {
  item_type: CateringQuotationItem['item_type'];
  product_id: number | null;
  inventory_item_id: number | null;
  recipe_id: number | null;
  line_description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  supply_strategy: CateringSupplyStrategy;
  service_notes: string | null;
};

@Injectable()
export class CateringService {
  constructor(
    @InjectRepository(CateringInquiry)
    private readonly inquiryRepo: Repository<CateringInquiry>,
    @InjectRepository(CateringQuotation)
    private readonly quotationRepo: Repository<CateringQuotation>,
    @InjectRepository(CateringQuotationItem)
    private readonly quotationItemRepo: Repository<CateringQuotationItem>,
    @InjectRepository(CateringEvent)
    private readonly eventRepo: Repository<CateringEvent>,
    @InjectRepository(CateringEventBilling)
    private readonly eventBillingRepo: Repository<CateringEventBilling>,
    @InjectRepository(CateringEventItem)
    private readonly eventItemRepo: Repository<CateringEventItem>,
    @InjectRepository(CateringEventProcurementLink)
    private readonly eventProcurementLinkRepo: Repository<CateringEventProcurementLink>,
    @InjectRepository(CateringEventProductionLink)
    private readonly eventProductionLinkRepo: Repository<CateringEventProductionLink>,
    @InjectRepository(CateringEventSettlement)
    private readonly eventSettlementRepo: Repository<CateringEventSettlement>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepo: Repository<InventoryItem>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(ChartOfAccount)
    private readonly coaRepo: Repository<ChartOfAccount>,
    private readonly procurementRequestsService: ProcurementRequestsService,
    private readonly productionService: ProductionService,
    private readonly recipeCostingService: RecipeCostingService,
    private readonly accountingService: AccountingService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly dataSource: DataSource,
  ) {}

  private roundMoney(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  private normalizeQuantity(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : 0;
  }

  private normalizeString(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private hasBranchAccess(accessibleBranchIds: number[] | undefined, branchId?: number | null): boolean {
    if (!branchId) {
      return true;
    }
    return !accessibleBranchIds || accessibleBranchIds.length === 0 || accessibleBranchIds.includes(branchId);
  }

  private assertEntityBranchAccess(
    accessibleBranchIds: number[] | undefined,
    ...branchIds: Array<number | null | undefined>
  ) {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return;
    }
    if (branchIds.some((branchId) => this.hasBranchAccess(accessibleBranchIds, branchId))) {
      return;
    }
    throw new NotFoundException('Record not found');
  }

  private applyBranchFilter(
    query: SelectQueryBuilder<any>,
    accessibleBranchIds: number[] | undefined,
    aliases: string[],
  ): void {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return;
    }

    query.andWhere(
      new Brackets((qb) => {
        aliases.forEach((alias, index) => {
          const clause = `${alias} IN (:...accessibleBranchIds)`;
          if (index === 0) {
            qb.where(clause, { accessibleBranchIds });
          } else {
            qb.orWhere(clause, { accessibleBranchIds });
          }
        });
      }),
    );
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId: number,
    operation?: string,
  ): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found.`);
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private async assertCustomerBelongsToClient(
    clientId: string,
    customerId?: number | null,
  ): Promise<Customer | null> {
    if (!customerId) {
      return null;
    }
    const customer = await this.customerRepo.findOne({ where: { id: customerId, client_id: clientId } });
    if (!customer) {
      throw new BadRequestException('Customer does not belong to the active client.');
    }
    return customer;
  }

  private async assertProductBelongsToClient(clientId: string, productId: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId, client_id: clientId, is_active: true },
    });
    if (!product) {
      throw new BadRequestException(`Product ${productId} is not available for this client.`);
    }
    return product;
  }

  private async assertInventoryItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
    const item = await this.inventoryItemRepo.findOne({
      where: { id: itemId, client_id: clientId, item_is_active: true },
    });
    if (!item) {
      throw new BadRequestException(`Inventory item ${itemId} is not available for this client.`);
    }
    return item;
  }

  private async assertRecipeBelongsToClient(
    clientId: string,
    recipeId?: number | null,
    productId?: number | null,
  ): Promise<Recipe | null> {
    if (!recipeId) {
      return null;
    }

    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId, client_id: clientId, is_active: true },
    });
    if (!recipe) {
      throw new BadRequestException(`Recipe ${recipeId} is not available for this client.`);
    }
    if (productId && recipe.product_id !== productId) {
      throw new BadRequestException('Recipe does not belong to the selected product.');
    }
    return recipe;
  }

  private async getInventoryItemUnitCost(
    clientId: string,
    itemId: number,
    branchId?: number,
  ): Promise<number> {
    if (branchId) {
      const branchLevel = await this.stockLevelRepo.findOne({
        where: { client_id: clientId, branch_id: branchId, item_id: itemId },
      });
      if (branchLevel && this.roundMoney(branchLevel.last_unit_cost) > 0) {
        return this.roundMoney(branchLevel.last_unit_cost);
      }
    }

    const clientLevel = await this.stockLevelRepo.findOne({
      where: { client_id: clientId, item_id: itemId },
      order: { last_received_at: 'DESC', updated_at: 'DESC', id: 'DESC' },
    });
    if (clientLevel && this.roundMoney(clientLevel.last_unit_cost) > 0) {
      return this.roundMoney(clientLevel.last_unit_cost);
    }

    const ledger = await this.stockLedgerRepo.findOne({
      where: branchId
        ? { client_id: clientId, branch_id: branchId, item_id: itemId }
        : { client_id: clientId, item_id: itemId },
      order: { created_at: 'DESC', id: 'DESC' },
    });

    return this.roundMoney(ledger?.unit_cost ?? 0);
  }

  private async generateDocumentNumber(
    prefix: string,
    repo: { createQueryBuilder: (alias: string) => SelectQueryBuilder<any> },
    clientId: string,
    branchCode: string,
    column: 'inquiry_no' | 'quote_no' | 'event_no',
  ): Promise<string> {
    const monthKey = new Date().toISOString().slice(0, 7).replace('-', '');
    const likePrefix = `${prefix}-${branchCode}-${monthKey}-%`;
    const count = await repo
      .createQueryBuilder('doc')
      .where('doc.client_id = :clientId', { clientId })
      .andWhere(`doc.${column} LIKE :likePrefix`, { likePrefix })
      .getCount();

    return `${prefix}-${branchCode}-${monthKey}-${String(count + 1).padStart(4, '0')}`;
  }

  private async findInquiryOrFail(clientId: string, inquiryId: number): Promise<CateringInquiry> {
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: inquiryId, client_id: clientId },
      relations: ['branch', 'customer'],
    });
    if (!inquiry) {
      throw new NotFoundException('Catering inquiry not found.');
    }
    return inquiry;
  }

  private async findQuotationOrFail(clientId: string, quotationId: number): Promise<CateringQuotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id: quotationId, client_id: clientId },
      relations: ['branch', 'inquiry', 'inquiry.customer', 'items', 'items.product', 'items.inventory_item'],
    });
    if (!quotation) {
      throw new NotFoundException('Catering quotation not found.');
    }
    return quotation;
  }

  private async findEventOrFail(clientId: string, eventId: number): Promise<CateringEvent> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, client_id: clientId },
      relations: [
        'inquiry',
        'quotation',
        'customer',
        'execution_branch',
        'production_branch',
        'items',
        'items.product',
        'items.inventory_item',
        'procurement_links',
        'production_links',
        'billings',
        'settlements',
      ],
    });
    if (!event) {
      throw new NotFoundException('Catering event not found.');
    }
    return event;
  }

  private async logAudit(input: {
    user: JwtPayload;
    clientId: string;
    branchId: number;
    entity: string;
    entityId: number;
    action: string;
    details: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.operationalAuditService.log({
      user: input.user,
      action: input.action,
      entity: input.entity,
      clientId: input.clientId,
      branchId: input.branchId,
      entityId: input.entityId,
      details: input.details,
      metadata: input.metadata,
    });
  }

  private async resolveQuotationLine(
    clientId: string,
    branchId: number,
    item: CateringQuotationItemDto,
  ): Promise<ResolvedQuotationLine> {
    if (item.product_id && item.inventory_item_id) {
      throw new BadRequestException('Quotation line cannot reference both a product and an inventory item.');
    }

    let lineDescription = this.normalizeString(item.line_description);
    let estimatedUnitCost = this.roundMoney(item.estimated_unit_cost ?? 0);
    let productId: number | null = item.product_id ?? null;
    let inventoryItemId: number | null = item.inventory_item_id ?? null;
    let recipeId: number | null = item.recipe_id ?? null;

    if (productId) {
      const product = await this.assertProductBelongsToClient(clientId, productId);
      const recipe = await this.assertRecipeBelongsToClient(clientId, recipeId, productId);
      const costSummary = await this.recipeCostingService.getProductRecipeCostSummary(clientId, product.id, branchId);
      lineDescription = lineDescription ?? product.product_name;
      estimatedUnitCost = this.roundMoney(
        recipeId && recipe
          ? (await this.recipeCostingService.getRecipeCostSummary(clientId, recipe.id, branchId))?.cost_per_yield_unit
          : costSummary?.cost_per_yield_unit ?? 0,
      );
      recipeId = recipe?.id ?? costSummary?.selected_recipe_id ?? null;
    } else if (inventoryItemId) {
      const inventoryItem = await this.assertInventoryItemBelongsToClient(clientId, inventoryItemId);
      lineDescription = lineDescription ?? inventoryItem.item_name;
      estimatedUnitCost = this.roundMoney(await this.getInventoryItemUnitCost(clientId, inventoryItem.id, branchId));
      recipeId = null;
    } else {
      productId = null;
      inventoryItemId = null;
      recipeId = null;
    }

    if (!lineDescription) {
      throw new BadRequestException('Each quotation line requires a description or a linked product/item.');
    }

    const quantity = this.normalizeQuantity(item.quantity);
    if (quantity <= 0) {
      throw new BadRequestException('Quotation item quantity must be greater than zero.');
    }

    let unitPrice = this.roundMoney(item.unit_price);
    if (item.item_type === 'discount' && unitPrice > 0) {
      unitPrice = this.roundMoney(unitPrice * -1);
    }
    if (item.item_type !== 'discount' && unitPrice < 0) {
      throw new BadRequestException('Negative pricing is only allowed on discount lines.');
    }

    const supplyStrategy = item.supply_strategy
      ?? (productId ? 'produce' : inventoryItemId ? 'procure' : 'none');
    const lineTotal = this.roundMoney(quantity * unitPrice);
    const estimatedTotalCost = this.roundMoney(quantity * estimatedUnitCost);

    return {
      item_type: item.item_type,
      product_id: productId,
      inventory_item_id: inventoryItemId,
      recipe_id: recipeId,
      line_description: lineDescription,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      estimated_unit_cost: estimatedUnitCost,
      estimated_total_cost: estimatedTotalCost,
      supply_strategy: supplyStrategy,
      service_notes: this.normalizeString(item.service_notes),
    };
  }

  private buildQuotationTotals(input: {
    items: ResolvedQuotationLine[];
    serviceChargeAmount?: number | null;
    taxAmount?: number | null;
    discountAmount?: number | null;
  }) {
    const subtotalAmount = this.roundMoney(
      input.items.reduce((sum, item) => sum + this.roundMoney(item.line_total), 0),
    );
    const estimatedCostAmount = this.roundMoney(
      input.items.reduce((sum, item) => sum + this.roundMoney(item.estimated_total_cost), 0),
    );
    const serviceChargeAmount = this.roundMoney(input.serviceChargeAmount ?? 0);
    const taxAmount = this.roundMoney(input.taxAmount ?? 0);
    let discountAmount = this.roundMoney(input.discountAmount ?? 0);
    if (discountAmount > 0) {
      discountAmount = this.roundMoney(discountAmount * -1);
    }
    const totalAmount = this.roundMoney(
      subtotalAmount + serviceChargeAmount + taxAmount + discountAmount,
    );
    const marginAmount = this.roundMoney(totalAmount - estimatedCostAmount);

    return {
      subtotalAmount,
      estimatedCostAmount,
      serviceChargeAmount,
      taxAmount,
      discountAmount,
      totalAmount,
      marginAmount,
    };
  }

  private getEventBillableTotal(event: CateringEvent): number {
    return this.roundMoney(event.actual_total_amount ?? event.quoted_total_amount);
  }

  private getAdvanceReceivedAmount(event: CateringEvent): number {
    return this.roundMoney(
      (event.settlements ?? [])
        .reduce((sum, settlement) => {
          const type = (settlement.settlement_type ?? 'collection') as CateringSettlementType;
          if (type === 'advance') {
            return sum + this.roundMoney(settlement.amount);
          }
          if (type === 'advance_refund') {
            return sum - this.roundMoney(settlement.amount);
          }
          return sum;
        }, 0),
    );
  }

  private getCollectionReceivedAmount(event: CateringEvent): number {
    return this.roundMoney(
      (event.settlements ?? [])
        .reduce((sum, settlement) => {
          const type = (settlement.settlement_type ?? 'collection') as CateringSettlementType;
          if (type === 'collection') {
            return sum + this.roundMoney(settlement.amount);
          }
          if (type === 'collection_refund') {
            return sum - this.roundMoney(settlement.amount);
          }
          return sum;
        }, 0),
    );
  }

  private getRefundAmount(event: CateringEvent): number {
    return this.roundMoney(
      (event.settlements ?? [])
        .filter((settlement) => ['advance_refund', 'collection_refund'].includes((settlement.settlement_type ?? 'collection') as CateringSettlementType))
        .reduce((sum, settlement) => sum + this.roundMoney(settlement.amount), 0),
    );
  }

  private getWriteOffAmount(event: CateringEvent): number {
    return this.roundMoney(
      (event.settlements ?? [])
        .filter((settlement) => (settlement.settlement_type ?? 'collection') === 'write_off')
        .reduce((sum, settlement) => sum + this.roundMoney(settlement.amount), 0),
    );
  }

  private summarizeEventBillings(event: CateringEvent) {
    const billings = [...(event.billings ?? [])].sort((left, right) => {
      if (left.billing_date === right.billing_date) {
        return left.id - right.id;
      }
      return left.billing_date.localeCompare(right.billing_date);
    });
    const advanceReceived = this.getAdvanceReceivedAmount(event);
    const collectionReceived = this.getCollectionReceivedAmount(event);
    const writeOffAmount = this.getWriteOffAmount(event);
    const totalBillable = this.getEventBillableTotal(event);
    let remainingCollections = collectionReceived;
    let remainingWriteOffs = writeOffAmount;

    const mappedBillings = billings.map((billing) => {
      const amount = this.roundMoney(billing.amount);
      const appliedAdvance = this.roundMoney(billing.applied_advance_amount);
      const openAfterAdvance = this.roundMoney(Math.max(amount - appliedAdvance, 0));
      const collectedAmount = this.roundMoney(Math.min(openAfterAdvance, remainingCollections));
      remainingCollections = this.roundMoney(Math.max(remainingCollections - collectedAmount, 0));
      const openAfterCollection = this.roundMoney(Math.max(openAfterAdvance - collectedAmount, 0));
      const writeOffAppliedAmount = this.roundMoney(Math.min(openAfterCollection, remainingWriteOffs));
      remainingWriteOffs = this.roundMoney(Math.max(remainingWriteOffs - writeOffAppliedAmount, 0));
      const outstandingAmount = this.roundMoney(Math.max(openAfterCollection - writeOffAppliedAmount, 0));
      let status: CateringBillingStatus = 'billed';
      if (outstandingAmount <= 0) {
        status = 'paid';
      } else if (appliedAdvance > 0 || collectedAmount > 0) {
        status = 'partially_paid';
      }

      return {
        ...billing,
        amount,
        applied_advance_amount: appliedAdvance,
        collected_amount: collectedAmount,
        write_off_amount: writeOffAppliedAmount,
        outstanding_amount: outstandingAmount,
        status,
      };
    });

    const billedAmount = this.roundMoney(mappedBillings.reduce((sum, billing) => sum + billing.amount, 0));
    const appliedAdvanceAmount = this.roundMoney(
      mappedBillings.reduce((sum, billing) => sum + billing.applied_advance_amount, 0),
    );
    const billedOutstandingAmount = this.roundMoney(
      mappedBillings.reduce((sum, billing) => sum + billing.outstanding_amount, 0),
    );
    const unbilledAmount = this.roundMoney(Math.max(totalBillable - billedAmount, 0));

    let eventBillingStatus: CateringBillingStatus = 'unbilled';
    if (billedAmount > 0) {
      if (billedOutstandingAmount <= 0) {
        eventBillingStatus = 'paid';
      } else if (billedOutstandingAmount < billedAmount) {
        eventBillingStatus = 'partially_paid';
      } else {
        eventBillingStatus = 'billed';
      }
    }

    return {
      totalBillable,
      advanceReceived,
      collectionReceived,
      billedAmount,
      appliedAdvanceAmount,
      billedOutstandingAmount,
      unbilledAmount,
      eventBillingStatus,
      writeOffAmount,
      mappedBillings,
    };
  }

  private syncEventBillingSummary(event: CateringEvent) {
    const summary = this.summarizeEventBillings(event);
    event.billing_status = summary.eventBillingStatus;
    event.billing_journal_entry_id = summary.mappedBillings.length
      ? summary.mappedBillings[summary.mappedBillings.length - 1].accounting_journal_entry_id ?? null
      : null;
    event.billing_issued_at = summary.mappedBillings.length
      ? summary.mappedBillings[summary.mappedBillings.length - 1].issued_at ?? null
      : null;
    return summary;
  }

  private mapInquiry(inquiry: CateringInquiry) {
    return {
      ...inquiry,
      budget_amount: inquiry.budget_amount !== null ? this.roundMoney(inquiry.budget_amount) : null,
      customer: inquiry.customer
        ? {
            id: inquiry.customer.id,
            name: inquiry.customer.name,
            phone_number: inquiry.customer.phone_number,
          }
        : null,
      branch: inquiry.branch
        ? {
            id: inquiry.branch.id,
            branch_name: inquiry.branch.branch_name,
            branch_code: inquiry.branch.branch_code,
          }
        : null,
    };
  }

  private mapQuotation(quotation: CateringQuotation) {
    return {
      ...quotation,
      subtotal_amount: this.roundMoney(quotation.subtotal_amount),
      estimated_cost_amount: this.roundMoney(quotation.estimated_cost_amount),
      service_charge_amount: this.roundMoney(quotation.service_charge_amount),
      tax_amount: this.roundMoney(quotation.tax_amount),
      discount_amount: this.roundMoney(quotation.discount_amount),
      total_amount: this.roundMoney(quotation.total_amount),
      margin_amount: this.roundMoney(quotation.margin_amount),
      inquiry: quotation.inquiry
        ? {
            id: quotation.inquiry.id,
            inquiry_no: quotation.inquiry.inquiry_no,
            event_title: quotation.inquiry.event_title,
            event_date: quotation.inquiry.event_date,
          }
        : null,
      items: (quotation.items ?? []).map((item) => ({
        ...item,
        quantity: this.normalizeQuantity(item.quantity),
        unit_price: this.roundMoney(item.unit_price),
        line_total: this.roundMoney(item.line_total),
        estimated_unit_cost: this.roundMoney(item.estimated_unit_cost),
        estimated_total_cost: this.roundMoney(item.estimated_total_cost),
        product: item.product
          ? {
              id: item.product.id,
              product_name: item.product.product_name,
              product_sku: item.product.product_sku,
            }
          : null,
        inventory_item: item.inventory_item
          ? {
              id: item.inventory_item.id,
              item_name: item.inventory_item.item_name,
              item_sku: item.inventory_item.item_sku,
            }
          : null,
      })),
    };
  }

  private async buildEventActualCostSummary(event: CateringEvent) {
    type ProcurementCostRow = {
      link_id: number | string;
      request_no: string | null;
      request_status: string | null;
      linked_po_id: number | string | null;
      po_number: string | null;
      po_status: string | null;
      committed_cost_amount: number | string | null;
      actual_cost_amount: number | string | null;
    };

    type ProcurementPostingRow = {
      po_id: number | string | null;
      grn_count: number | string | null;
      journal_entry_count: number | string | null;
      last_cost_posted_at: string | null;
    };

    type ProductionCostRow = {
      link_id: number | string;
      production_no: string | null;
      production_status: string | null;
      actual_quantity: number | string | null;
      total_consumed_cost: number | string | null;
    };

    const procurementLinkIds = (event.procurement_links ?? []).map((link) => Number(link.id)).filter((id) => Number.isFinite(id));
    const productionLinkIds = (event.production_links ?? []).map((link) => Number(link.id)).filter((id) => Number.isFinite(id));

    let procurementLinks = (event.procurement_links ?? []).map((link) => ({
      id: link.id,
      procurement_request_id: link.procurement_request_id,
      source_branch_id: link.source_branch_id,
      destination_branch_id: link.destination_branch_id,
      event_item_ids: link.event_item_ids_json ?? [],
      notes: link.notes,
      created_at: link.created_at,
      request_no: null as string | null,
      request_status: null as string | null,
      linked_po_id: null as number | null,
      po_number: null as string | null,
      po_status: null as string | null,
      committed_cost_amount: 0,
      actual_cost_amount: 0,
      grn_count: 0,
      journal_entry_count: 0,
      last_cost_posted_at: null as string | null,
      finance_posting_status: 'not_received',
    }));

    let productionLinks = (event.production_links ?? []).map((link) => ({
      id: link.id,
      production_order_id: link.production_order_id,
      event_item_id: link.event_item_id,
      source_branch_id: link.source_branch_id,
      destination_branch_id: link.destination_branch_id,
      notes: link.notes,
      created_at: link.created_at,
      production_no: null as string | null,
      production_status: null as string | null,
      actual_quantity: 0,
      total_consumed_cost: 0,
      output_unit_cost: 0,
      journal_entry_count: 0,
      finance_posting_status: 'operational_cost_only',
    }));

    if (procurementLinkIds.length > 0) {
      const procurementRows = (await this.dataSource.query(
        `
        SELECT
          link.id AS link_id,
          req.request_no,
          req.status AS request_status,
          req.linked_po_id,
          po.po_number,
          po.status AS po_status,
          COALESCE(po.total_amount, 0) AS committed_cost_amount,
          COALESCE(grn_summary.actual_cost_amount, 0) AS actual_cost_amount
        FROM catering_event_procurement_links link
        LEFT JOIN procurement_requests req
          ON req.id = link.procurement_request_id
         AND req.client_id = link.client_id
        LEFT JOIN purchase_orders po
          ON po.id = req.linked_po_id
         AND po.client_id = req.client_id
        LEFT JOIN (
          SELECT
            grn.purchase_order_id AS po_id,
            COALESCE(SUM(COALESCE(grn.vendor_bill_amount, item_summary.total_amount)), 0) AS actual_cost_amount
          FROM goods_receipt_notes grn
          LEFT JOIN (
            SELECT item.grn_id, COALESCE(SUM(item.line_total), 0) AS total_amount
            FROM goods_receipt_note_items item
            GROUP BY item.grn_id
          ) item_summary ON item_summary.grn_id = grn.id
          WHERE grn.client_id = ?
            AND grn.status = 'posted'
          GROUP BY grn.purchase_order_id
        ) grn_summary ON grn_summary.po_id = po.id
        WHERE link.client_id = ?
          AND link.id IN (${procurementLinkIds.map(() => '?').join(', ')})
        `,
        [event.client_id, event.client_id, ...procurementLinkIds],
      )) as ProcurementCostRow[];

      const rowByLinkId = new Map<number, ProcurementCostRow>(
        procurementRows.map((row) => [Number(row.link_id), row]),
      );
      procurementLinks = procurementLinks.map((link) => {
        const row = rowByLinkId.get(Number(link.id));
        return row
          ? {
              ...link,
              request_no: row.request_no ?? null,
              request_status: row.request_status ?? null,
              linked_po_id: row.linked_po_id ? Number(row.linked_po_id) : null,
              po_number: row.po_number ?? null,
              po_status: row.po_status ?? null,
              committed_cost_amount: this.roundMoney(row.committed_cost_amount),
              actual_cost_amount: this.roundMoney(row.actual_cost_amount),
            }
          : link;
      });

      const linkedPoIds = Array.from(new Set(
        procurementLinks
          .map((link) => Number(link.linked_po_id))
          .filter((value) => Number.isFinite(value) && value > 0),
      ));

      if (linkedPoIds.length > 0) {
        const procurementPostingRows = (await this.dataSource.query(
          `
          SELECT
            grn.purchase_order_id AS po_id,
            COUNT(DISTINCT grn.id) AS grn_count,
            COUNT(DISTINCT entry.id) AS journal_entry_count,
            MAX(grn.receipt_date) AS last_cost_posted_at
          FROM goods_receipt_notes grn
          LEFT JOIN journal_entries entry
            ON entry.client_id = grn.client_id
           AND entry.source_entity_type = 'goods_receipt_note'
           AND entry.source_entity_id = CAST(grn.id AS CHAR)
           AND entry.source_event IN ('grn_receipt', 'grn_bill_received', 'grn_bill_variance')
          WHERE grn.client_id = ?
            AND grn.status = 'posted'
            AND grn.purchase_order_id IN (${linkedPoIds.map(() => '?').join(', ')})
          GROUP BY grn.purchase_order_id
          `,
          [event.client_id, ...linkedPoIds],
        )) as ProcurementPostingRow[];

        const postingRowByPoId = new Map<number, ProcurementPostingRow>(
          procurementPostingRows.map((row) => [Number(row.po_id), row]),
        );
        procurementLinks = procurementLinks.map((link) => {
          const postingRow = link.linked_po_id ? postingRowByPoId.get(Number(link.linked_po_id)) : null;
          const actualCostAmount = this.roundMoney(link.actual_cost_amount);
          return {
            ...link,
            grn_count: Number(postingRow?.grn_count ?? 0),
            journal_entry_count: Number(postingRow?.journal_entry_count ?? 0),
            last_cost_posted_at: postingRow?.last_cost_posted_at ?? null,
            finance_posting_status: actualCostAmount > 0
              ? 'finance_posted'
              : Number(link.committed_cost_amount ?? 0) > 0
                ? 'commitment_only'
                : 'not_received',
          };
        });
      }
    }

    if (productionLinkIds.length > 0) {
      const productionRows = (await this.dataSource.query(
        `
        SELECT
          link.id AS link_id,
          prod.production_no,
          prod.status AS production_status,
          prod.actual_quantity,
          COALESCE(SUM(material.issued_quantity * material.unit_cost), 0) AS total_consumed_cost
        FROM catering_event_production_links link
        LEFT JOIN production_orders prod
          ON prod.id = link.production_order_id
         AND prod.client_id = link.client_id
        LEFT JOIN production_order_materials material
          ON material.production_order_id = prod.id
        WHERE link.client_id = ?
          AND link.id IN (${productionLinkIds.map(() => '?').join(', ')})
        GROUP BY link.id, prod.production_no, prod.status, prod.actual_quantity
        `,
        [event.client_id, ...productionLinkIds],
      )) as ProductionCostRow[];

      const rowByLinkId = new Map<number, ProductionCostRow>(
        productionRows.map((row) => [Number(row.link_id), row]),
      );
      productionLinks = productionLinks.map((link) => {
        const row = rowByLinkId.get(Number(link.id));
        const actualQuantity = this.normalizeQuantity(row?.actual_quantity ?? 0);
        const totalConsumedCost = this.roundMoney(row?.total_consumed_cost ?? 0);
        return row
          ? {
              ...link,
              production_no: row.production_no ?? null,
              production_status: row.production_status ?? null,
              actual_quantity: actualQuantity,
              total_consumed_cost: totalConsumedCost,
              output_unit_cost: actualQuantity > 0 ? this.roundMoney(totalConsumedCost / actualQuantity) : 0,
              finance_posting_status: totalConsumedCost > 0 ? 'operational_cost_only' : 'not_issued',
            }
          : link;
      });
    }

    const committedProcurementCost = this.roundMoney(
      procurementLinks.reduce((sum, link) => sum + Number(link.committed_cost_amount ?? 0), 0),
    );
    const actualProcurementCost = this.roundMoney(
      procurementLinks.reduce((sum, link) => sum + Number(link.actual_cost_amount ?? 0), 0),
    );
    const actualProductionCost = this.roundMoney(
      productionLinks.reduce((sum, link) => sum + Number(link.total_consumed_cost ?? 0), 0),
    );
    const totalActualCost = this.roundMoney(actualProcurementCost + actualProductionCost);
    const openCommittedProcurementCost = this.roundMoney(Math.max(committedProcurementCost - actualProcurementCost, 0));

    return {
      procurement_links: procurementLinks,
      production_links: productionLinks,
      committed_procurement_cost: committedProcurementCost,
      open_committed_procurement_cost: openCommittedProcurementCost,
      actual_procurement_cost: actualProcurementCost,
      actual_production_cost: actualProductionCost,
      total_actual_cost: totalActualCost,
    };
  }

  private async mapEvent(event: CateringEvent) {
    const quotedTotal = this.roundMoney(event.quoted_total_amount);
    const actualTotal = this.getEventBillableTotal(event);
    const totalPaid = this.roundMoney(
      this.getAdvanceReceivedAmount(event) + this.getCollectionReceivedAmount(event),
    );
    const billingSummary = this.summarizeEventBillings(event);
    const actualCostSummary = await this.buildEventActualCostSummary(event);
    const advanceReceived = billingSummary.advanceReceived;
    const collectionReceived = billingSummary.collectionReceived;
    const refundAmount = this.getRefundAmount(event);
    const writeOffAmount = billingSummary.writeOffAmount;
    const unappliedAdvanceAmount = this.roundMoney(Math.max(advanceReceived - billingSummary.appliedAdvanceAmount, 0));
    const outstandingAmount = this.roundMoney(Math.max(actualTotal - totalPaid - writeOffAmount, 0));
    const estimatedCostAmount = this.roundMoney(event.estimated_cost_amount);
    const estimatedGrossMargin = this.roundMoney(actualTotal - estimatedCostAmount);
    const estimatedMarginPercent = actualTotal > 0
      ? this.roundMoney((estimatedGrossMargin / actualTotal) * 100)
      : 0;
    const collectionPercent = actualTotal > 0
      ? this.roundMoney((totalPaid / actualTotal) * 100)
      : 0;
    const totalActualCost = this.roundMoney(actualCostSummary.total_actual_cost);
    const costVarianceAmount = this.roundMoney(totalActualCost - estimatedCostAmount);
    const realizedGrossMargin = this.roundMoney(actualTotal - totalActualCost);
    const realizedMarginPercent = actualTotal > 0
      ? this.roundMoney((realizedGrossMargin / actualTotal) * 100)
      : 0;
    const financePostedCostAmount = this.roundMoney(actualCostSummary.actual_procurement_cost);
    const operationalOnlyCostAmount = this.roundMoney(actualCostSummary.actual_production_cost);
    const financePostedCostCoveragePercent = totalActualCost > 0
      ? this.roundMoney((financePostedCostAmount / totalActualCost) * 100)
      : 0;
    const postingGapAmount = this.roundMoney(Math.max(totalActualCost - financePostedCostAmount, 0));
    const procurementGrnCount = (actualCostSummary.procurement_links ?? []).reduce(
      (sum: number, link: any) => sum + Number(link.grn_count ?? 0),
      0,
    );
    const costJournalEntryCount = (actualCostSummary.procurement_links ?? []).reduce(
      (sum: number, link: any) => sum + Number(link.journal_entry_count ?? 0),
      0,
    );
    const productionOperationalLinkCount = (actualCostSummary.production_links ?? []).filter(
      (link: any) => Number(link.total_consumed_cost ?? 0) > 0.009,
    ).length;
    const latestCostPostedAt = (actualCostSummary.procurement_links ?? [])
      .map((link: any) => link.last_cost_posted_at)
      .filter((value: string | null | undefined) => Boolean(value))
      .sort()
      .slice(-1)[0] ?? null;
    const postingStatus = totalActualCost <= 0
      ? 'not_required'
      : postingGapAmount <= 0.009
        ? 'finance_posted'
        : financePostedCostAmount > 0.009
          ? 'partially_posted'
          : 'operational_cost_only';
    const postingNote = postingStatus === 'finance_posted'
      ? 'Linked event cost is fully backed by finance-posted procurement receipts.'
      : postingStatus === 'partially_posted'
        ? 'Procurement receipts are finance-posted, but production consumption still sits as operational event cost only.'
        : postingStatus === 'operational_cost_only'
          ? 'Current event cost is operationally costed without finance-posted procurement receipt support yet.'
          : 'No actual linked event cost has been recognized yet.';
    const committedCoverageCost = this.roundMoney(
      totalActualCost + Number(actualCostSummary.open_committed_procurement_cost ?? 0),
    );
    const linkedCostCoveragePercent = estimatedCostAmount > 0
      ? this.roundMoney((totalActualCost / estimatedCostAmount) * 100)
      : 0;
    const committedCostCoveragePercent = estimatedCostAmount > 0
      ? this.roundMoney((committedCoverageCost / estimatedCostAmount) * 100)
      : 0;
    const unlinkedCostGapAmount = this.roundMoney(
      Math.max(estimatedCostAmount - committedCoverageCost, 0),
    );
    const costLinkStatus = estimatedCostAmount <= 0
      ? 'not_required'
      : unlinkedCostGapAmount <= 0
        ? (totalActualCost >= estimatedCostAmount ? 'fully_linked' : 'covered_with_commitments')
        : committedCoverageCost > 0
          ? 'partially_linked'
          : 'unlinked';
    const openProcurementLinkCount = (actualCostSummary.procurement_links ?? []).filter(
      (link) => Number(link.committed_cost_amount ?? 0) > Number(link.actual_cost_amount ?? 0),
    ).length;
    const hasBilledRevisionExposure = billingSummary.billedAmount > 0.009 && billingSummary.unbilledAmount > 0.009;
    const hasCollectionExposure = outstandingAmount > 0.009 || unappliedAdvanceAmount > 0.009;
    const hasCostFollowUp = actualCostSummary.open_committed_procurement_cost > 0.009 || unlinkedCostGapAmount > 0.009;
    const hasRefundOrWriteOffHistory = refundAmount > 0.009 || writeOffAmount > 0.009;
    const cancellationBlockers: string[] = [];
    if (unappliedAdvanceAmount > 0.009) {
      cancellationBlockers.push('Refund unapplied customer advance before cancellation.');
    }
    if (billingSummary.billedOutstandingAmount > 0.009) {
      cancellationBlockers.push('Settle or write off billed outstanding before cancellation.');
    }
    if (actualCostSummary.open_committed_procurement_cost > 0.009) {
      cancellationBlockers.push('Close open procurement commitments tied to the event.');
    }
    const revisionFollowUpStatus = cancellationBlockers.length > 0 || hasCollectionExposure
      ? 'critical'
      : hasBilledRevisionExposure || hasCostFollowUp || hasRefundOrWriteOffHistory
        ? 'attention'
        : 'clean';
    const revisionFollowUpAction = cancellationBlockers.length > 0
      ? cancellationBlockers[0]
      : hasBilledRevisionExposure
        ? 'Bill or reduce the remaining event value so issued invoices match the revised event scope.'
        : hasCostFollowUp
          ? 'Finish procurement and cost linkage so realized margin is fully supported.'
          : hasRefundOrWriteOffHistory
            ? 'Review refund and write-off history before final event close.'
            : 'No pending finance follow-up.';

    return {
      ...event,
      quoted_total_amount: quotedTotal,
      estimated_cost_amount: estimatedCostAmount,
      actual_total_amount: actualTotal,
      total_paid_amount: totalPaid,
      advance_received_amount: advanceReceived,
      collection_received_amount: collectionReceived,
      refund_amount: refundAmount,
      write_off_amount: writeOffAmount,
      unapplied_advance_amount: unappliedAdvanceAmount,
      outstanding_amount: outstandingAmount,
      billed_amount: billingSummary.billedAmount,
      applied_advance_amount: billingSummary.appliedAdvanceAmount,
      billed_outstanding_amount: billingSummary.billedOutstandingAmount,
      unbilled_amount: billingSummary.unbilledAmount,
      profitability: {
        estimated_gross_margin: estimatedGrossMargin,
        estimated_margin_percent: estimatedMarginPercent,
        collection_percent: collectionPercent,
        actual_procurement_cost: actualCostSummary.actual_procurement_cost,
        actual_production_cost: actualCostSummary.actual_production_cost,
        total_actual_cost: totalActualCost,
        committed_procurement_cost: actualCostSummary.committed_procurement_cost,
        open_committed_procurement_cost: actualCostSummary.open_committed_procurement_cost,
        linked_cost_coverage_percent: linkedCostCoveragePercent,
        committed_cost_coverage_percent: committedCostCoveragePercent,
        unlinked_cost_gap_amount: unlinkedCostGapAmount,
        cost_link_status: costLinkStatus,
        procurement_link_count: (actualCostSummary.procurement_links ?? []).length,
        production_link_count: (actualCostSummary.production_links ?? []).length,
        open_procurement_link_count: openProcurementLinkCount,
        cost_variance_amount: costVarianceAmount,
        realized_gross_margin: realizedGrossMargin,
        realized_margin_percent: realizedMarginPercent,
        finance_posted_cost_amount: financePostedCostAmount,
        operational_only_cost_amount: operationalOnlyCostAmount,
        finance_posted_cost_coverage_percent: financePostedCostCoveragePercent,
        posting_gap_amount: postingGapAmount,
        posting_status: postingStatus,
        posting_note: postingNote,
        procurement_grn_count: procurementGrnCount,
        cost_journal_entry_count: costJournalEntryCount,
        production_operational_link_count: productionOperationalLinkCount,
        latest_cost_posted_at: latestCostPostedAt,
      },
      finance_follow_up: {
        cancellation_ready: cancellationBlockers.length === 0,
        cancellation_blockers: cancellationBlockers,
        revision_follow_up_status: revisionFollowUpStatus,
        revision_follow_up_action: revisionFollowUpAction,
        has_billed_revision_exposure: hasBilledRevisionExposure,
        has_collection_exposure: hasCollectionExposure,
        has_cost_follow_up: hasCostFollowUp,
        has_refund_or_write_off_history: hasRefundOrWriteOffHistory,
      },
      execution_branch: event.execution_branch
        ? {
            id: event.execution_branch.id,
            branch_name: event.execution_branch.branch_name,
            branch_code: event.execution_branch.branch_code,
          }
        : null,
      production_branch: event.production_branch
        ? {
            id: event.production_branch.id,
            branch_name: event.production_branch.branch_name,
            branch_code: event.production_branch.branch_code,
          }
        : null,
      customer: event.customer
        ? {
            id: event.customer.id,
            name: event.customer.name,
            phone_number: event.customer.phone_number,
          }
        : null,
      inquiry: event.inquiry
        ? {
            id: event.inquiry.id,
            inquiry_no: event.inquiry.inquiry_no,
            event_title: event.inquiry.event_title,
          }
        : null,
      quotation: event.quotation
        ? {
            id: event.quotation.id,
            quote_no: event.quotation.quote_no,
            total_amount: this.roundMoney(event.quotation.total_amount),
          }
        : null,
      items: (event.items ?? []).map((item) => ({
        ...item,
        quantity: this.normalizeQuantity(item.quantity),
        unit_price: this.roundMoney(item.unit_price),
        line_total: this.roundMoney(item.line_total),
        estimated_unit_cost: this.roundMoney(item.estimated_unit_cost),
        estimated_total_cost: this.roundMoney(item.estimated_total_cost),
        product: item.product
          ? {
              id: item.product.id,
              product_name: item.product.product_name,
              product_sku: item.product.product_sku,
            }
          : null,
        inventory_item: item.inventory_item
          ? {
              id: item.inventory_item.id,
              item_name: item.inventory_item.item_name,
              item_sku: item.inventory_item.item_sku,
            }
          : null,
      })),
      procurement_links: actualCostSummary.procurement_links,
      production_links: actualCostSummary.production_links,
      settlements: (event.settlements ?? []).map((settlement) => ({
        id: settlement.id,
        branch_id: settlement.branch_id,
        payment_date: settlement.payment_date,
        payment_mode: settlement.payment_mode,
        settlement_type: settlement.settlement_type ?? 'collection',
        amount: this.roundMoney(settlement.amount),
        reference_no: settlement.reference_no,
        notes: settlement.notes,
        accounting_journal_entry_id: settlement.accounting_journal_entry_id,
        created_at: settlement.created_at,
      })),
      billings: billingSummary.mappedBillings.map((billing) => ({
        id: billing.id,
        branch_id: billing.branch_id,
        billing_type: billing.billing_type,
        billing_date: billing.billing_date,
        label: billing.label,
        amount: billing.amount,
        applied_advance_amount: billing.applied_advance_amount,
        collected_amount: billing.collected_amount,
        write_off_amount: this.roundMoney((billing as any).write_off_amount ?? 0),
        outstanding_amount: billing.outstanding_amount,
        status: billing.status,
        accounting_journal_entry_id: billing.accounting_journal_entry_id,
        notes: billing.notes,
        issued_at: billing.issued_at,
        created_at: billing.created_at,
      })),
    };
  }

  async getOptions(clientId: string, query?: CateringOptionsQueryDto) {
    const branchId = query?.branch_id;
    const [branches, customers, products, inventoryItems] = await Promise.all([
      this.branchRepo.find({
        where: { client_id: clientId },
        order: { branch_name: 'ASC' },
      }),
      this.customerRepo.find({
        where: { client_id: clientId, status: 'active' },
        order: { name: 'ASC' },
        take: 200,
      }),
      this.productRepo.find({
        where: { client_id: clientId, is_active: true },
        order: { product_name: 'ASC' },
      }),
      this.inventoryItemRepo.find({
        where: { client_id: clientId, item_is_active: true },
        order: { item_name: 'ASC' },
      }),
    ]);

    const productCosting = await this.recipeCostingService.getProductRecipeCostSummaries(clientId, products, branchId);
    const inventoryOptions = await Promise.all(
      inventoryItems.map(async (item) => ({
        id: item.id,
        item_name: item.item_name,
        item_sku: item.item_sku,
        uom_base: item.uom_base,
        estimated_unit_cost: await this.getInventoryItemUnitCost(clientId, item.id, branchId),
      })),
    );

    return {
      branches: branches.map((branch) => ({
        id: branch.id,
        branch_name: branch.branch_name,
        branch_code: branch.branch_code,
        inventory_store_type: branch.inventory_store_type,
      })),
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone_number: customer.phone_number,
        email: customer.email,
      })),
      products: products.map((product) => {
        const costing = productCosting.get(product.id);
        return {
          id: product.id,
          product_name: product.product_name,
          product_sku: product.product_sku,
          product_base_price: this.roundMoney(product.product_base_price),
          selected_recipe_id: costing?.selected_recipe_id ?? null,
          cost_per_yield_unit: this.roundMoney(costing?.cost_per_yield_unit ?? 0),
          margin_amount: this.roundMoney(costing?.margin_amount ?? 0),
          cost_status: costing?.cost_status ?? 'missing',
        };
      }),
      inventory_items: inventoryOptions,
    };
  }

  async getDashboard(clientId: string, accessibleBranchIds?: number[]) {
    const inquiryQuery = this.inquiryRepo.createQueryBuilder('inquiry').where('inquiry.client_id = :clientId', { clientId });
    this.applyBranchFilter(inquiryQuery, accessibleBranchIds, ['inquiry.branch_id']);
    const quotationQuery = this.quotationRepo.createQueryBuilder('quotation').where('quotation.client_id = :clientId', { clientId });
    this.applyBranchFilter(quotationQuery, accessibleBranchIds, ['quotation.branch_id']);
    const eventQuery = this.eventRepo.createQueryBuilder('event').where('event.client_id = :clientId', { clientId });
    this.applyBranchFilter(eventQuery, accessibleBranchIds, ['event.execution_branch_id', 'event.production_branch_id']);

    const [inquiryRows, quotationRows, eventRows, billedEvents] = await Promise.all([
      inquiryQuery.select('inquiry.status', 'status').addSelect('COUNT(*)', 'count').groupBy('inquiry.status').getRawMany(),
      quotationQuery.select('quotation.status', 'status').addSelect('COUNT(*)', 'count').groupBy('quotation.status').getRawMany(),
      eventQuery.select('event.status', 'status').addSelect('COUNT(*)', 'count').groupBy('event.status').getRawMany(),
      eventQuery
        .clone()
        .select('COALESCE(SUM(event.quoted_total_amount), 0)', 'quoted_total')
        .addSelect('COALESCE(SUM(event.total_paid_amount), 0)', 'paid_total')
        .getRawOne(),
    ]);

    const inquirySummary = Object.fromEntries(
      CATERING_INQUIRY_STATUSES.map((status) => [status, Number(inquiryRows.find((row) => row.status === status)?.count ?? 0)]),
    ) as Record<CateringInquiryStatus, number>;
    const quotationSummary = Object.fromEntries(
      CATERING_QUOTATION_STATUSES.map((status) => [status, Number(quotationRows.find((row) => row.status === status)?.count ?? 0)]),
    ) as Record<CateringQuotationStatus, number>;
    const eventSummary = Object.fromEntries(
      CATERING_EVENT_STATUSES.map((status) => [status, Number(eventRows.find((row) => row.status === status)?.count ?? 0)]),
    ) as Record<CateringEventStatus, number>;

    const focusEventQuery = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.execution_branch', 'execution_branch')
      .leftJoinAndSelect('event.production_branch', 'production_branch')
      .leftJoinAndSelect('event.customer', 'customer')
      .leftJoinAndSelect('event.items', 'items')
      .leftJoinAndSelect('event.procurement_links', 'procurement_links')
      .leftJoinAndSelect('event.production_links', 'production_links')
      .leftJoinAndSelect('event.billings', 'billings')
      .leftJoinAndSelect('event.settlements', 'settlements')
      .where('event.client_id = :clientId', { clientId })
      .andWhere('event.status NOT IN (:...closedStatuses)', { closedStatuses: ['completed', 'cancelled'] });
    this.applyBranchFilter(focusEventQuery, accessibleBranchIds, ['event.execution_branch_id', 'event.production_branch_id']);
    const focusEvents = await focusEventQuery
      .orderBy('event.event_date', 'ASC')
      .addOrderBy('event.id', 'DESC')
      .take(12)
      .getMany();
    const mappedFocusEvents = await Promise.all(focusEvents.map((event) => this.mapEvent(event)));
    const criticalFocusEvents = mappedFocusEvents.filter(
      (event) => event.finance_follow_up?.revision_follow_up_status === 'critical',
    );
    const attentionFocusEvents = mappedFocusEvents.filter(
      (event) => event.finance_follow_up?.revision_follow_up_status === 'attention',
    );
    const topPriorityEvent = mappedFocusEvents
      .slice()
      .sort((left, right) => {
        const rank = (status?: string | null) => (status === 'critical' ? 2 : status === 'attention' ? 1 : 0);
        const statusDiff = rank(right.finance_follow_up?.revision_follow_up_status)
          - rank(left.finance_follow_up?.revision_follow_up_status);
        if (statusDiff !== 0) {
          return statusDiff;
        }
        return Number(right.outstanding_amount ?? 0) - Number(left.outstanding_amount ?? 0);
      })[0] ?? null;

    return {
      inquiries: inquirySummary,
      quotations: quotationSummary,
      events: eventSummary,
      financials: {
        quoted_total: this.roundMoney(billedEvents?.quoted_total),
        paid_total: this.roundMoney(billedEvents?.paid_total),
        outstanding_total: this.roundMoney(
          this.roundMoney(billedEvents?.quoted_total) - this.roundMoney(billedEvents?.paid_total),
        ),
      },
      finance_priority: {
        critical_event_count: criticalFocusEvents.length,
        attention_event_count: attentionFocusEvents.length,
        top_priority_event: topPriorityEvent
          ? {
              id: topPriorityEvent.id,
              event_no: topPriorityEvent.event_no,
              event_title: topPriorityEvent.event_title,
              event_date: topPriorityEvent.event_date,
              outstanding_amount: this.roundMoney(topPriorityEvent.outstanding_amount),
              status: topPriorityEvent.status,
              revision_follow_up_status: topPriorityEvent.finance_follow_up?.revision_follow_up_status ?? 'clean',
              revision_follow_up_action: topPriorityEvent.finance_follow_up?.revision_follow_up_action ?? 'No pending finance follow-up.',
              posting_status: topPriorityEvent.profitability?.posting_status ?? 'not_required',
              posting_note: topPriorityEvent.profitability?.posting_note ?? 'No event cost posting note available.',
            }
          : null,
        priority_events: mappedFocusEvents
          .filter((event) => event.finance_follow_up?.revision_follow_up_status !== 'clean')
          .slice(0, 5)
          .map((event) => ({
            id: event.id,
            event_no: event.event_no,
            event_title: event.event_title,
            event_date: event.event_date,
            outstanding_amount: this.roundMoney(event.outstanding_amount),
            status: event.status,
            revision_follow_up_status: event.finance_follow_up?.revision_follow_up_status ?? 'clean',
            revision_follow_up_action: event.finance_follow_up?.revision_follow_up_action ?? 'No pending finance follow-up.',
            posting_status: event.profitability?.posting_status ?? 'not_required',
            posting_note: event.profitability?.posting_note ?? 'No event cost posting note available.',
          })),
      },
    };
  }

  async createInquiry(clientId: string, dto: CreateCateringInquiryDto, user: JwtPayload) {
    const branchId = requireBranchId(user, dto.branch_id);
    const [branch, customer] = await Promise.all([
      this.assertBranchBelongsToClient(clientId, branchId, 'create catering inquiries'),
      this.assertCustomerBelongsToClient(clientId, dto.customer_id ?? null),
    ]);

    const inquiryNo = await this.generateDocumentNumber('CI', this.inquiryRepo, clientId, branch.branch_code, 'inquiry_no');
    const inquiry = this.inquiryRepo.create({
      client_id: clientId,
      branch_id: branch.id,
      customer_id: customer?.id ?? null,
      inquiry_no: inquiryNo,
      event_title: dto.event_title.trim(),
      service_type: dto.service_type,
      event_date: dto.event_date,
      start_time: this.normalizeString(dto.start_time),
      end_time: this.normalizeString(dto.end_time),
      guest_count: dto.guest_count,
      venue_name: this.normalizeString(dto.venue_name),
      venue_address: this.normalizeString(dto.venue_address),
      contact_name: this.normalizeString(dto.contact_name) ?? customer?.name ?? null,
      contact_phone: this.normalizeString(dto.contact_phone) ?? customer?.phone_number ?? null,
      contact_email: this.normalizeString(dto.contact_email) ?? customer?.email ?? null,
      budget_amount: dto.budget_amount !== undefined ? this.roundMoney(dto.budget_amount) : null,
      notes: this.normalizeString(dto.notes),
      captured_by: resolveActorId(user) ?? null,
      captured_by_name: this.buildActorName(user),
    });

    const saved = await this.inquiryRepo.save(inquiry);
    const created = await this.findInquiryOrFail(clientId, saved.id);
    await this.logAudit({
      user,
      clientId,
      branchId: branch.id,
      entity: 'catering_inquiries',
      entityId: created.id,
      action: 'Catering Inquiry Created',
      details: `Captured catering inquiry ${created.inquiry_no}`,
    });
    return this.mapInquiry(created);
  }

  async getInquiries(clientId: string, accessibleBranchIds?: number[], query?: CateringInquiryQueryDto) {
    const builder = this.inquiryRepo
      .createQueryBuilder('inquiry')
      .leftJoinAndSelect('inquiry.branch', 'branch')
      .leftJoinAndSelect('inquiry.customer', 'customer')
      .where('inquiry.client_id = :clientId', { clientId });

    this.applyBranchFilter(builder, accessibleBranchIds, ['inquiry.branch_id']);

    if (query?.branch_id) {
      builder.andWhere('inquiry.branch_id = :branchId', { branchId: query.branch_id });
    }
    if (query?.status) {
      builder.andWhere('inquiry.status = :status', { status: query.status });
    }
    if (query?.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere(
        '(inquiry.inquiry_no LIKE :search OR inquiry.event_title LIKE :search OR inquiry.contact_name LIKE :search)',
        { search },
      );
    }

    const inquiries = await builder.orderBy('inquiry.event_date', 'ASC').addOrderBy('inquiry.id', 'DESC').getMany();
    return inquiries.map((inquiry) => this.mapInquiry(inquiry));
  }

  async updateInquiry(clientId: string, inquiryId: number, dto: UpdateCateringInquiryDto, user: JwtPayload) {
    const inquiry = await this.findInquiryOrFail(clientId, inquiryId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), inquiry.branch_id);
    await this.assertBranchBelongsToClient(clientId, inquiry.branch_id, 'update catering inquiries');

    if (dto.customer_id !== undefined) {
      inquiry.customer_id = (await this.assertCustomerBelongsToClient(clientId, dto.customer_id))?.id ?? null;
    }
    if (dto.event_title !== undefined) inquiry.event_title = dto.event_title.trim();
    if (dto.service_type !== undefined) inquiry.service_type = dto.service_type;
    if (dto.event_date !== undefined) inquiry.event_date = dto.event_date;
    if (dto.start_time !== undefined) inquiry.start_time = this.normalizeString(dto.start_time);
    if (dto.end_time !== undefined) inquiry.end_time = this.normalizeString(dto.end_time);
    if (dto.guest_count !== undefined) inquiry.guest_count = dto.guest_count;
    if (dto.venue_name !== undefined) inquiry.venue_name = this.normalizeString(dto.venue_name);
    if (dto.venue_address !== undefined) inquiry.venue_address = this.normalizeString(dto.venue_address);
    if (dto.contact_name !== undefined) inquiry.contact_name = this.normalizeString(dto.contact_name);
    if (dto.contact_phone !== undefined) inquiry.contact_phone = this.normalizeString(dto.contact_phone);
    if (dto.contact_email !== undefined) inquiry.contact_email = this.normalizeString(dto.contact_email);
    if (dto.budget_amount !== undefined) inquiry.budget_amount = dto.budget_amount !== null ? this.roundMoney(dto.budget_amount) : null;
    if (dto.notes !== undefined) inquiry.notes = this.normalizeString(dto.notes);
    if (dto.status !== undefined) inquiry.status = dto.status;

    const saved = await this.inquiryRepo.save(inquiry);
    return this.mapInquiry(await this.findInquiryOrFail(clientId, saved.id));
  }

  async createQuotation(clientId: string, dto: CreateCateringQuotationDto, user: JwtPayload) {
    const inquiry = await this.findInquiryOrFail(clientId, dto.inquiry_id);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), inquiry.branch_id);
    await this.assertBranchBelongsToClient(clientId, inquiry.branch_id, 'create catering quotations');

    if (!['open', 'quoted'].includes(inquiry.status)) {
      throw new BadRequestException('Only open or already quoted inquiries can receive quotations.');
    }

    const branch = await this.assertBranchBelongsToClient(clientId, inquiry.branch_id);
    const resolvedItems = await Promise.all(dto.items.map((item) => this.resolveQuotationLine(clientId, inquiry.branch_id, item)));
    const totals = this.buildQuotationTotals({
      items: resolvedItems,
      serviceChargeAmount: dto.service_charge_amount,
      taxAmount: dto.tax_amount,
      discountAmount: dto.discount_amount,
    });
    const quoteNo = await this.generateDocumentNumber('CQ', this.quotationRepo, clientId, branch.branch_code, 'quote_no');

    const savedId = await this.dataSource.transaction(async (manager) => {
      const quotation = manager.create(CateringQuotation, {
        client_id: clientId,
        branch_id: inquiry.branch_id,
        inquiry_id: inquiry.id,
        quote_no: quoteNo,
        valid_until: dto.valid_until ?? null,
        subtotal_amount: totals.subtotalAmount,
        estimated_cost_amount: totals.estimatedCostAmount,
        service_charge_amount: totals.serviceChargeAmount,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        total_amount: totals.totalAmount,
        margin_amount: totals.marginAmount,
        terms_and_conditions: this.normalizeString(dto.terms_and_conditions),
        notes: this.normalizeString(dto.notes),
        prepared_by: resolveActorId(user) ?? null,
        prepared_by_name: this.buildActorName(user),
      });
      const savedQuotation = await manager.save(quotation);

      for (const item of resolvedItems) {
        await manager.save(manager.create(CateringQuotationItem, {
          client_id: clientId,
          quotation_id: savedQuotation.id,
          ...item,
        }));
      }

      inquiry.status = 'quoted';
      await manager.save(CateringInquiry, inquiry);
      return savedQuotation.id;
    });

    const created = await this.findQuotationOrFail(clientId, savedId);
    await this.logAudit({
      user,
      clientId,
      branchId: inquiry.branch_id,
      entity: 'catering_quotations',
      entityId: created.id,
      action: 'Catering Quotation Created',
      details: `Created quotation ${created.quote_no} for inquiry ${inquiry.inquiry_no}`,
    });
    return this.mapQuotation(created);
  }

  async getQuotations(clientId: string, accessibleBranchIds?: number[], query?: CateringQuotationQueryDto) {
    const builder = this.quotationRepo
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.inquiry', 'inquiry')
      .leftJoinAndSelect('quotation.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.inventory_item', 'inventory_item')
      .where('quotation.client_id = :clientId', { clientId });

    this.applyBranchFilter(builder, accessibleBranchIds, ['quotation.branch_id']);

    if (query?.branch_id) {
      builder.andWhere('quotation.branch_id = :branchId', { branchId: query.branch_id });
    }
    if (query?.status) {
      builder.andWhere('quotation.status = :status', { status: query.status });
    }
    if (query?.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere('(quotation.quote_no LIKE :search OR inquiry.event_title LIKE :search)', { search });
    }

    const quotations = await builder.orderBy('quotation.created_at', 'DESC').addOrderBy('items.id', 'ASC').getMany();
    return quotations.map((quotation) => this.mapQuotation(quotation));
  }

  async getQuotation(clientId: string, quotationId: number, accessibleBranchIds?: number[]) {
    const quotation = await this.findQuotationOrFail(clientId, quotationId);
    this.assertEntityBranchAccess(accessibleBranchIds, quotation.branch_id);
    return this.mapQuotation(quotation);
  }

  async updateQuotation(clientId: string, quotationId: number, dto: UpdateCateringQuotationDto, user: JwtPayload) {
    const quotation = await this.findQuotationOrFail(clientId, quotationId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), quotation.branch_id);
    await this.assertBranchBelongsToClient(clientId, quotation.branch_id, 'update catering quotations');

    if (!['draft', 'rejected'].includes(quotation.status)) {
      throw new BadRequestException('Only draft or rejected quotations can be edited.');
    }

    const resolvedItems = dto.items
      ? await Promise.all(dto.items.map((item) => this.resolveQuotationLine(clientId, quotation.branch_id, item)))
      : quotation.items.map((item) => ({
          item_type: item.item_type,
          product_id: item.product_id,
          inventory_item_id: item.inventory_item_id,
          recipe_id: item.recipe_id,
          line_description: item.line_description,
          quantity: this.normalizeQuantity(item.quantity),
          unit_price: this.roundMoney(item.unit_price),
          line_total: this.roundMoney(item.line_total),
          estimated_unit_cost: this.roundMoney(item.estimated_unit_cost),
          estimated_total_cost: this.roundMoney(item.estimated_total_cost),
          supply_strategy: item.supply_strategy,
          service_notes: item.service_notes,
        }));

    const totals = this.buildQuotationTotals({
      items: resolvedItems,
      serviceChargeAmount: dto.service_charge_amount ?? quotation.service_charge_amount,
      taxAmount: dto.tax_amount ?? quotation.tax_amount,
      discountAmount: dto.discount_amount ?? quotation.discount_amount,
    });

    await this.dataSource.transaction(async (manager) => {
      quotation.valid_until = dto.valid_until ?? quotation.valid_until;
      quotation.service_charge_amount = totals.serviceChargeAmount;
      quotation.tax_amount = totals.taxAmount;
      quotation.discount_amount = totals.discountAmount;
      quotation.subtotal_amount = totals.subtotalAmount;
      quotation.estimated_cost_amount = totals.estimatedCostAmount;
      quotation.total_amount = totals.totalAmount;
      quotation.margin_amount = totals.marginAmount;
      if (dto.terms_and_conditions !== undefined) {
        quotation.terms_and_conditions = this.normalizeString(dto.terms_and_conditions);
      }
      if (dto.notes !== undefined) {
        quotation.notes = this.normalizeString(dto.notes);
      }
      await manager.save(CateringQuotation, quotation);

      if (dto.items) {
        await manager.delete(CateringQuotationItem, { quotation_id: quotation.id, client_id: clientId });
        for (const item of resolvedItems) {
          await manager.save(manager.create(CateringQuotationItem, {
            client_id: clientId,
            quotation_id: quotation.id,
            ...item,
          }));
        }
      }
    });

    return this.getQuotation(clientId, quotation.id, getAccessibleBranchIds(user));
  }

  async updateQuotationStatus(clientId: string, quotationId: number, dto: UpdateQuotationStatusDto, user: JwtPayload) {
    const quotation = await this.findQuotationOrFail(clientId, quotationId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), quotation.branch_id);
    await this.assertBranchBelongsToClient(clientId, quotation.branch_id, 'review catering quotations');

    const transitions: Record<CateringQuotationStatus, CateringQuotationStatus[]> = {
      draft: ['sent', 'expired'],
      sent: ['approved', 'rejected', 'expired'],
      approved: ['converted', 'expired'],
      rejected: ['draft', 'expired'],
      expired: ['draft'],
      converted: [],
    };
    if (!transitions[quotation.status].includes(dto.status)) {
      throw new BadRequestException(`Quotation cannot move from ${quotation.status} to ${dto.status}.`);
    }

    quotation.status = dto.status;
    if (dto.status === 'sent') {
      quotation.sent_at = new Date();
    }
    if (dto.status === 'approved') {
      quotation.approved_at = new Date();
      quotation.approved_by = resolveActorId(user) ?? null;
      quotation.approved_by_name = this.buildActorName(user);
      quotation.rejection_reason = null;
    }
    if (dto.status === 'rejected') {
      quotation.rejection_reason = this.normalizeString(dto.reason) ?? 'Quotation rejected.';
    }

    await this.quotationRepo.save(quotation);
    return this.getQuotation(clientId, quotationId, getAccessibleBranchIds(user));
  }

  async convertQuotationToEvent(
    clientId: string,
    quotationId: number,
    dto: ConvertQuotationToEventDto,
    user: JwtPayload,
  ) {
    const quotation = await this.findQuotationOrFail(clientId, quotationId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), quotation.branch_id);

    if (quotation.status !== 'approved') {
      throw new BadRequestException('Only approved quotations can be converted into events.');
    }

    const existing = await this.eventRepo.findOne({
      where: { client_id: clientId, quotation_id: quotation.id },
    });
    if (existing) {
      throw new BadRequestException('This quotation has already been converted into an event.');
    }

    const inquiry = await this.findInquiryOrFail(clientId, quotation.inquiry_id);
    const executionBranchId = dto.execution_branch_id ?? inquiry.branch_id;
    const productionBranchId = dto.production_branch_id ?? executionBranchId;
    const executionBranch = await this.assertBranchBelongsToClient(clientId, executionBranchId, 'create catering events');
    await this.assertBranchBelongsToClient(clientId, productionBranchId, 'plan catering production');
    const eventNo = await this.generateDocumentNumber('CE', this.eventRepo, clientId, executionBranch.branch_code, 'event_no');

    const eventId = await this.dataSource.transaction(async (manager) => {
      const event = manager.create(CateringEvent, {
        client_id: clientId,
        inquiry_id: inquiry.id,
        quotation_id: quotation.id,
        customer_id: inquiry.customer_id,
        execution_branch_id: executionBranchId,
        production_branch_id: productionBranchId,
        event_no: eventNo,
        event_title: inquiry.event_title,
        service_type: inquiry.service_type,
        event_date: inquiry.event_date,
        start_time: inquiry.start_time,
        end_time: inquiry.end_time,
        guest_count: inquiry.guest_count,
        venue_name: inquiry.venue_name,
        venue_address: inquiry.venue_address,
        coordinator_name: inquiry.contact_name,
        coordinator_phone: inquiry.contact_phone,
        quoted_total_amount: quotation.total_amount,
        estimated_cost_amount: quotation.estimated_cost_amount,
        actual_total_amount: quotation.total_amount,
        notes: this.normalizeString(dto.notes) ?? quotation.notes,
      });
      const savedEvent = await manager.save(event);

      for (const item of quotation.items ?? []) {
        await manager.save(manager.create(CateringEventItem, {
          client_id: clientId,
          event_id: savedEvent.id,
          product_id: item.product_id,
          inventory_item_id: item.inventory_item_id,
          recipe_id: item.recipe_id,
          item_type: item.item_type,
          line_description: item.line_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          estimated_unit_cost: item.estimated_unit_cost,
          estimated_total_cost: item.estimated_total_cost,
          supply_strategy: item.supply_strategy,
          production_notes: item.service_notes,
        }));
      }

      quotation.status = 'converted';
      inquiry.status = 'won';
      await manager.save(CateringQuotation, quotation);
      await manager.save(CateringInquiry, inquiry);

      return savedEvent.id;
    });

    const event = await this.findEventOrFail(clientId, eventId);
    await this.logAudit({
      user,
      clientId,
      branchId: event.execution_branch_id,
      entity: 'catering_events',
      entityId: event.id,
      action: 'Catering Event Created',
      details: `Converted quotation ${quotation.quote_no} into event ${event.event_no}`,
    });
    return this.mapEvent(event);
  }

  async getEvents(clientId: string, accessibleBranchIds?: number[], query?: CateringEventQueryDto) {
    const builder = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.inquiry', 'inquiry')
      .leftJoinAndSelect('event.quotation', 'quotation')
      .leftJoinAndSelect('event.customer', 'customer')
      .leftJoinAndSelect('event.execution_branch', 'execution_branch')
      .leftJoinAndSelect('event.production_branch', 'production_branch')
      .leftJoinAndSelect('event.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.inventory_item', 'inventory_item')
      .leftJoinAndSelect('event.procurement_links', 'procurement_links')
      .leftJoinAndSelect('event.production_links', 'production_links')
      .leftJoinAndSelect('event.billings', 'billings')
      .leftJoinAndSelect('event.settlements', 'settlements')
      .where('event.client_id = :clientId', { clientId });

    this.applyBranchFilter(builder, accessibleBranchIds, ['event.execution_branch_id', 'event.production_branch_id']);

    if (query?.branch_id) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('event.execution_branch_id = :branchId', { branchId: query.branch_id })
            .orWhere('event.production_branch_id = :branchId', { branchId: query.branch_id });
        }),
      );
    }
    if (query?.status) {
      builder.andWhere('event.status = :status', { status: query.status });
    }
    if (query?.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere('(event.event_no LIKE :search OR event.event_title LIKE :search OR inquiry.inquiry_no LIKE :search)', { search });
    }

    const events = await builder.orderBy('event.event_date', 'ASC').addOrderBy('event.id', 'DESC').getMany();
    return Promise.all(events.map((event) => this.mapEvent(event)));
  }

  async getEvent(clientId: string, eventId: number, accessibleBranchIds?: number[]) {
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(accessibleBranchIds, event.execution_branch_id, event.production_branch_id);
    return this.mapEvent(event);
  }

  async updateEvent(clientId: string, eventId: number, dto: UpdateCateringEventDto, user: JwtPayload) {
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), event.execution_branch_id, event.production_branch_id);
    await this.assertBranchBelongsToClient(clientId, event.execution_branch_id, 'update catering events');

    if (['completed', 'cancelled'].includes(event.status)) {
      throw new BadRequestException('Completed or cancelled events cannot be edited.');
    }

    if (dto.execution_branch_id !== undefined) {
      event.execution_branch_id = (await this.assertBranchBelongsToClient(clientId, dto.execution_branch_id, 'update catering events')).id;
    }
    if (dto.production_branch_id !== undefined) {
      event.production_branch_id = (await this.assertBranchBelongsToClient(clientId, dto.production_branch_id, 'update catering production')).id;
    }
    if (dto.event_date !== undefined) event.event_date = dto.event_date;
    if (dto.start_time !== undefined) event.start_time = this.normalizeString(dto.start_time);
    if (dto.end_time !== undefined) event.end_time = this.normalizeString(dto.end_time);
    if (dto.guest_count !== undefined) event.guest_count = dto.guest_count;
    if (dto.venue_name !== undefined) event.venue_name = this.normalizeString(dto.venue_name);
    if (dto.venue_address !== undefined) event.venue_address = this.normalizeString(dto.venue_address);
    if (dto.coordinator_name !== undefined) event.coordinator_name = this.normalizeString(dto.coordinator_name);
    if (dto.coordinator_phone !== undefined) event.coordinator_phone = this.normalizeString(dto.coordinator_phone);
    if (dto.notes !== undefined) event.notes = this.normalizeString(dto.notes);
    if (dto.actual_total_amount !== undefined) {
      event.actual_total_amount = this.roundMoney(dto.actual_total_amount);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(CateringEvent, event);

      if (dto.items?.length) {
        const eventItems = await manager.find(CateringEventItem, {
          where: { event_id: event.id, client_id: clientId },
        });
        const itemMap = new Map(eventItems.map((item) => [item.id, item]));
        for (const input of dto.items) {
          const eventItem = itemMap.get(input.id);
          if (!eventItem) {
            throw new BadRequestException(`Event item ${input.id} was not found.`);
          }
          eventItem.quantity = this.normalizeQuantity(input.quantity);
          eventItem.unit_price = this.roundMoney(input.unit_price);
          eventItem.line_total = this.roundMoney(eventItem.quantity * eventItem.unit_price);
          eventItem.estimated_total_cost = this.roundMoney(
            this.roundMoney(eventItem.estimated_unit_cost) * this.normalizeQuantity(eventItem.quantity),
          );
          if (input.supply_strategy !== undefined) {
            eventItem.supply_strategy = input.supply_strategy;
          }
          if (input.production_notes !== undefined) {
            eventItem.production_notes = this.normalizeString(input.production_notes);
          }
          await manager.save(CateringEventItem, eventItem);
        }
      }

      const refreshedItems = await manager.find(CateringEventItem, {
        where: { event_id: event.id, client_id: clientId },
      });
      event.quoted_total_amount = this.roundMoney(
        refreshedItems.reduce((sum, item) => sum + this.roundMoney(item.line_total), 0),
      );
      event.estimated_cost_amount = this.roundMoney(
        refreshedItems.reduce((sum, item) => sum + this.roundMoney(item.estimated_total_cost), 0),
      );
      if (dto.actual_total_amount === undefined && (event.actual_total_amount === null || event.actual_total_amount === undefined)) {
        event.actual_total_amount = event.quoted_total_amount;
      }
      await manager.save(CateringEvent, event);
    });

    return this.getEvent(clientId, event.id, getAccessibleBranchIds(user));
  }

  async updateEventStatus(clientId: string, eventId: number, dto: UpdateCateringEventStatusDto, user: JwtPayload) {
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(getAccessibleBranchIds(user), event.execution_branch_id, event.production_branch_id);

    const transitions: Record<CateringEventStatus, CateringEventStatus[]> = {
      planned: ['confirmed', 'cancelled'],
      confirmed: ['in_production', 'ready', 'completed', 'cancelled'],
      in_production: ['ready', 'completed', 'cancelled'],
      ready: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!transitions[event.status].includes(dto.status)) {
      throw new BadRequestException(`Event cannot move from ${event.status} to ${dto.status}.`);
    }

    if (dto.status === 'cancelled') {
      const summary = this.summarizeEventBillings(event);
      const unappliedAdvanceAmount = this.roundMoney(
        Math.max(summary.advanceReceived - summary.appliedAdvanceAmount, 0),
      );
      if (unappliedAdvanceAmount > 0.009 || summary.billedOutstandingAmount > 0.009) {
        throw new BadRequestException(
          'Clear event finance first. Refund open customer advances and settle or write off billed outstanding before cancellation.',
        );
      }
    }

    event.status = dto.status;
    if (dto.notes) {
      event.notes = [event.notes, dto.notes.trim()].filter(Boolean).join('\n');
    }
    if (dto.status === 'confirmed') {
      event.confirmed_at = new Date();
    }
    if (dto.status === 'completed') {
      event.completed_at = new Date();
    }

    await this.eventRepo.save(event);
    return this.getEvent(clientId, eventId, getAccessibleBranchIds(user));
  }

  async createProcurementRequestFromEvent(
    clientId: string,
    eventId: number,
    dto: CreateEventProcurementDto,
    user: JwtPayload,
  ) {
    const accessibleBranchIds = getAccessibleBranchIds(user);
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(accessibleBranchIds, event.execution_branch_id, event.production_branch_id);

    if (['completed', 'cancelled'].includes(event.status)) {
      throw new BadRequestException('Completed or cancelled events cannot create procurement demand.');
    }

    const selectedIds = dto.event_item_ids?.length ? new Set(dto.event_item_ids) : null;
    const eventItems = (event.items ?? []).filter((item) =>
      ['procure', 'both'].includes(item.supply_strategy) &&
      item.inventory_item_id &&
      (!selectedIds || selectedIds.has(item.id)),
    );

    if (eventItems.length === 0) {
      throw new BadRequestException('No eligible event items were found for procurement.');
    }

    const requestingBranchId = dto.requesting_branch_id ?? event.production_branch_id ?? event.execution_branch_id;
    const destinationBranchId = dto.destination_branch_id ?? event.execution_branch_id;

    const procurementRequest = await this.procurementRequestsService.create(
      clientId,
      {
        requesting_branch_id: requestingBranchId,
        destination_branch_id: destinationBranchId,
        preferred_vendor_id: dto.preferred_vendor_id,
        notes: this.normalizeString(dto.notes) ?? `Event ${event.event_no} procurement demand`,
        items: eventItems.map((item) => ({
          item_id: item.inventory_item_id as number,
          requested_quantity: this.normalizeQuantity(item.quantity),
          notes: item.line_description,
        })),
      },
      user,
      accessibleBranchIds,
    );

    await this.eventProcurementLinkRepo.save(this.eventProcurementLinkRepo.create({
      client_id: clientId,
      event_id: event.id,
      procurement_request_id: procurementRequest.id,
      source_branch_id: requestingBranchId,
      destination_branch_id: destinationBranchId,
      event_item_ids_json: eventItems.map((item) => item.id),
      notes: this.normalizeString(dto.notes),
    }));

    event.status = event.status === 'planned' ? 'confirmed' : event.status;
    await this.eventRepo.save(event);

    await this.logAudit({
      user,
      clientId,
      branchId: destinationBranchId,
      entity: 'catering_events',
      entityId: event.id,
      action: 'Catering Procurement Linked',
      details: `Created procurement request ${procurementRequest.request_no} for event ${event.event_no}`,
    });

    return {
      event: await this.getEvent(clientId, event.id, accessibleBranchIds),
      procurement_request: procurementRequest,
    };
  }

  async createProductionOrdersFromEvent(
    clientId: string,
    eventId: number,
    dto: CreateEventProductionDto,
    user: JwtPayload,
  ) {
    const accessibleBranchIds = getAccessibleBranchIds(user);
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(accessibleBranchIds, event.execution_branch_id, event.production_branch_id);

    if (['completed', 'cancelled'].includes(event.status)) {
      throw new BadRequestException('Completed or cancelled events cannot create production requests.');
    }

    const selectedIds = dto.event_item_ids?.length ? new Set(dto.event_item_ids) : null;
    const eventItems = (event.items ?? []).filter((item) =>
      ['produce', 'both'].includes(item.supply_strategy) &&
      item.product_id &&
      (!selectedIds || selectedIds.has(item.id)),
    );

    if (eventItems.length === 0) {
      throw new BadRequestException('No eligible event items were found for production.');
    }

    const sourceBranchId = dto.source_branch_id ?? event.production_branch_id ?? event.execution_branch_id;
    const destinationBranchId = dto.destination_branch_id ?? sourceBranchId;

    const orders: any[] = [];
    for (const item of eventItems) {
      const order = await this.productionService.createProductionOrder(
        clientId,
        {
          source_branch_id: sourceBranchId,
          destination_branch_id: destinationBranchId,
          product_id: item.product_id as number,
          recipe_id: item.recipe_id ?? undefined,
          planned_quantity: this.normalizeQuantity(item.quantity),
          notes: `Event ${event.event_no}: ${item.line_description}`,
        } satisfies CreateProductionOrderDto,
        user,
        accessibleBranchIds,
      );
      orders.push(order);
      await this.eventProductionLinkRepo.save(this.eventProductionLinkRepo.create({
        client_id: clientId,
        event_id: event.id,
        production_order_id: order.id,
        event_item_id: item.id,
        source_branch_id: sourceBranchId,
        destination_branch_id: destinationBranchId,
        notes: this.normalizeString(dto.notes),
      }));
    }

    event.status = 'in_production';
    await this.eventRepo.save(event);

    await this.logAudit({
      user,
      clientId,
      branchId: sourceBranchId,
      entity: 'catering_events',
      entityId: event.id,
      action: 'Catering Production Linked',
      details: `Created ${orders.length} production request(s) for event ${event.event_no}`,
    });

    return {
      event: await this.getEvent(clientId, event.id, accessibleBranchIds),
      production_orders: orders,
    };
  }

  private async resolveBillingAccounts(clientId: string) {
    const accounts = await this.coaRepo.find({
      where: [
        { client_id: clientId, account_code: '1210' },
        { client_id: clientId, account_code: '4100' },
        { client_id: clientId, account_code: '1101' },
        { client_id: clientId, account_code: '1102' },
        { client_id: clientId, account_code: '1103' },
        { client_id: clientId, account_code: '2205' },
        { client_id: clientId, account_code: '5700' },
      ],
    });

    const byCode = new Map(accounts.map((account) => [account.account_code, account]));
    const receivable = byCode.get('1210');
    const revenue = byCode.get('4100');
    const cash = byCode.get('1101');
    const bank = byCode.get('1102');
    const merchantClearing = byCode.get('1103');
    const customerAdvance = byCode.get('2205');
    const writeOffExpense = byCode.get('5700');
    if (!receivable || !revenue || !cash || !bank || !merchantClearing || !customerAdvance || !writeOffExpense) {
      throw new BadRequestException('Required accounting control accounts were not found for catering billing.');
    }

    return { receivable, revenue, cash, bank, merchantClearing, customerAdvance, writeOffExpense };
  }

  private resolveSettlementOffsetAccount(
    paymentMode: CateringPaymentMode,
    accounts: Awaited<ReturnType<CateringService['resolveBillingAccounts']>>,
  ) {
    if (paymentMode === 'cash') {
      return accounts.cash;
    }
    if (paymentMode === 'card' || paymentMode === 'online') {
      return accounts.merchantClearing;
    }
    return accounts.bank;
  }

  private computeBillingStatus(actualTotalAmount: number, totalPaidAmount: number): CateringBillingStatus {
    if (totalPaidAmount <= 0) {
      return 'billed';
    }
    if (totalPaidAmount >= actualTotalAmount - 0.009) {
      return 'paid';
    }
    return 'partially_paid';
  }

  async issueBilling(clientId: string, eventId: number, user: JwtPayload) {
    const event = await this.findEventOrFail(clientId, eventId);
    const summary = this.summarizeEventBillings(event);
    if (summary.unbilledAmount <= 0) {
      return this.getEvent(clientId, eventId, getAccessibleBranchIds(user));
    }
    return this.issueEventBilling(clientId, eventId, {
      branch_id: event.execution_branch_id,
      billing_date: event.event_date,
      billing_type: 'final',
      amount: summary.unbilledAmount,
      label: 'Final Billing',
    }, user);
  }

  async issueEventBilling(clientId: string, eventId: number, dto: IssueEventBillingDto, user: JwtPayload) {
    const accessibleBranchIds = getAccessibleBranchIds(user);
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(accessibleBranchIds, event.execution_branch_id, event.production_branch_id);

    if (event.status === 'cancelled') {
      throw new BadRequestException('Cancelled events cannot be billed.');
    }

    const branchId = dto.branch_id ?? event.execution_branch_id;
    await this.assertBranchBelongsToClient(clientId, branchId, 'issue catering billing');
    const accounts = await this.resolveBillingAccounts(clientId);
    const billingSummary = this.summarizeEventBillings(event);
    const amount = this.roundMoney(dto.amount);
    const remainingAdvance = this.roundMoney(
      Math.max(billingSummary.advanceReceived - billingSummary.appliedAdvanceAmount, 0),
    );
    const advanceApplied = this.roundMoney(Math.min(amount, remainingAdvance));
    if (amount <= 0) {
      throw new BadRequestException('Billing amount must be greater than zero.');
    }
    if (amount > billingSummary.unbilledAmount + 0.009) {
      throw new BadRequestException('Billing amount exceeds the remaining unbilled event value.');
    }
    if (!CATERING_EVENT_BILLING_TYPES.includes(dto.billing_type as CateringEventBillingType)) {
      throw new BadRequestException('Unsupported event billing type.');
    }

    const label = this.normalizeString(dto.label)
      ?? `${dto.billing_type === 'final' ? 'Final' : dto.billing_type === 'deposit' ? 'Deposit' : 'Milestone'} Billing ${billingSummary.mappedBillings.length + 1}`;

    const journal = await this.accountingService.createJournalEntry(clientId, branchId, {
      branch_id: branchId,
      transaction_date: new Date(`${dto.billing_date}T00:00:00`),
      business_date: dto.billing_date,
      description: `Catering ${dto.billing_type} billing ${event.event_no}`,
      reference_id: event.event_no,
      source_module: 'catering',
      source_entity_type: 'catering_event_billing',
      source_entity_id: String(event.id),
      source_event: dto.billing_type,
      posting_type: 'auto',
      items: [
        { account_id: accounts.receivable.id, debit: amount, credit: 0 },
        ...(advanceApplied > 0
          ? [
              { account_id: accounts.customerAdvance.id, debit: advanceApplied, credit: 0 },
              { account_id: accounts.receivable.id, debit: 0, credit: advanceApplied },
            ]
          : []),
        { account_id: accounts.revenue.id, debit: 0, credit: amount },
      ],
    });

    const billing = await this.eventBillingRepo.save(this.eventBillingRepo.create({
      client_id: clientId,
      event_id: event.id,
      branch_id: branchId,
      billing_type: dto.billing_type,
      label,
      billing_date: dto.billing_date,
      amount,
      applied_advance_amount: advanceApplied,
      status: this.computeBillingStatus(amount, advanceApplied),
      accounting_journal_entry_id: journal.id,
      notes: this.normalizeString(dto.notes),
      issued_at: new Date(),
    }));

    event.billings = [...(event.billings ?? []), billing];
    this.syncEventBillingSummary(event);
    await this.eventRepo.save(event);

    await this.logAudit({
      user,
      clientId,
      branchId,
      entity: 'catering_events',
      entityId: event.id,
      action: 'Catering Billing Issued',
      details: `Issued ${dto.billing_type} billing of ${amount} for event ${event.event_no}`,
      metadata: {
        billing_id: billing.id,
        billing_type: dto.billing_type,
        amount,
        applied_advance_amount: advanceApplied,
      },
    });

    return this.getEvent(clientId, event.id, accessibleBranchIds);
  }

  async recordSettlement(clientId: string, eventId: number, dto: RecordEventSettlementDto, user: JwtPayload) {
    const accessibleBranchIds = getAccessibleBranchIds(user);
    const event = await this.findEventOrFail(clientId, eventId);
    this.assertEntityBranchAccess(accessibleBranchIds, event.execution_branch_id, event.production_branch_id);

    let refreshedEvent = await this.findEventOrFail(clientId, eventId);
    const amount = this.roundMoney(dto.amount);
    const actualTotal = this.roundMoney(refreshedEvent.actual_total_amount ?? refreshedEvent.quoted_total_amount);
    const settlementType = (dto.settlement_type
      ?? ((refreshedEvent.billings ?? []).length > 0 ? 'collection' : 'advance')) as CateringSettlementType;
    if (!CATERING_SETTLEMENT_TYPES.includes(settlementType)) {
      throw new BadRequestException('Unsupported event settlement type.');
    }
    if (settlementType === 'advance' && (refreshedEvent.billings ?? []).length > 0) {
      throw new BadRequestException('Customer advances must be recorded before event billing is issued.');
    }
    if (settlementType === 'collection' && (refreshedEvent.billings ?? []).length === 0) {
      await this.issueBilling(clientId, eventId, user);
      refreshedEvent = await this.findEventOrFail(clientId, eventId);
    }

    const billingSummary = this.summarizeEventBillings(refreshedEvent);
    const availableAdvanceRefund = this.roundMoney(
      Math.max(billingSummary.advanceReceived - billingSummary.appliedAdvanceAmount, 0),
    );
    const availableCollectionRefund = this.roundMoney(Math.max(billingSummary.collectionReceived, 0));
    const availableWriteOff = this.roundMoney(Math.max(billingSummary.billedOutstandingAmount, 0));
    const netCollectedBefore = this.roundMoney(
      this.getAdvanceReceivedAmount(refreshedEvent) + this.getCollectionReceivedAmount(refreshedEvent),
    );

    if (settlementType === 'advance' && netCollectedBefore + amount > actualTotal + 0.009) {
      throw new BadRequestException('Advance amount exceeds the event outstanding balance.');
    }
    if (settlementType === 'collection' && netCollectedBefore + amount > actualTotal + 0.009) {
      throw new BadRequestException('Collection amount exceeds the event outstanding balance.');
    }
    if (settlementType === 'advance_refund' && amount > availableAdvanceRefund + 0.009) {
      throw new BadRequestException('Advance refund exceeds the remaining unapplied customer advance.');
    }
    if (settlementType === 'collection_refund' && amount > availableCollectionRefund + 0.009) {
      throw new BadRequestException('Collection refund exceeds the settled event collection balance.');
    }
    if (settlementType === 'write_off' && amount > availableWriteOff + 0.009) {
      throw new BadRequestException('Write-off amount exceeds the billed outstanding receivable.');
    }

    const branchId = dto.branch_id ?? refreshedEvent.execution_branch_id;
    await this.assertBranchBelongsToClient(clientId, branchId, 'record catering settlements');
    const accounts = await this.resolveBillingAccounts(clientId);
    const offsetAccount = this.resolveSettlementOffsetAccount(dto.payment_mode as CateringPaymentMode, accounts);

    const settlement = await this.eventSettlementRepo.save(this.eventSettlementRepo.create({
      client_id: clientId,
      event_id: refreshedEvent.id,
      branch_id: branchId,
      payment_date: dto.payment_date,
      payment_mode: dto.payment_mode,
      settlement_type: settlementType,
      amount,
      reference_no: this.normalizeString(dto.reference_no),
      notes: this.normalizeString(dto.notes),
      recorded_by: resolveActorId(user) ?? null,
      recorded_by_name: this.buildActorName(user),
    }));

    const journal = await this.accountingService.createJournalEntry(clientId, branchId, {
      branch_id: branchId,
      transaction_date: new Date(`${dto.payment_date}T00:00:00`),
      business_date: dto.payment_date,
      description: `Catering ${settlementType === 'advance' ? 'advance' : 'settlement'} ${refreshedEvent.event_no}`,
      reference_id: settlement.reference_no ?? refreshedEvent.event_no,
      source_module: 'catering',
      source_entity_type: 'catering_event_settlement',
      source_entity_id: String(settlement.id),
      source_event: settlementType,
      posting_type: 'auto',
      items:
        settlementType === 'advance'
          ? [
              { account_id: offsetAccount.id, debit: amount, credit: 0 },
              { account_id: accounts.customerAdvance.id, debit: 0, credit: amount },
            ]
          : settlementType === 'collection'
            ? [
                { account_id: offsetAccount.id, debit: amount, credit: 0 },
                { account_id: accounts.receivable.id, debit: 0, credit: amount },
              ]
            : settlementType === 'advance_refund'
              ? [
                  { account_id: accounts.customerAdvance.id, debit: amount, credit: 0 },
                  { account_id: offsetAccount.id, debit: 0, credit: amount },
                ]
              : settlementType === 'collection_refund'
                ? [
                    { account_id: accounts.receivable.id, debit: amount, credit: 0 },
                    { account_id: offsetAccount.id, debit: 0, credit: amount },
                  ]
                : [
                    { account_id: accounts.writeOffExpense.id, debit: amount, credit: 0 },
                    { account_id: accounts.receivable.id, debit: 0, credit: amount },
                  ],
    });

    settlement.accounting_journal_entry_id = journal.id;
    await this.eventSettlementRepo.save(settlement);

    refreshedEvent.total_paid_amount = this.roundMoney(
      this.getAdvanceReceivedAmount(refreshedEvent) +
      this.getCollectionReceivedAmount(refreshedEvent),
    );
    this.syncEventBillingSummary(refreshedEvent);
    await this.eventRepo.save(refreshedEvent);

    await this.logAudit({
      user,
      clientId,
      branchId,
      entity: 'catering_events',
      entityId: refreshedEvent.id,
      action:
        settlementType === 'advance'
          ? 'Catering Advance Recorded'
          : settlementType === 'collection'
            ? 'Catering Settlement Recorded'
            : settlementType === 'advance_refund'
              ? 'Catering Advance Refunded'
              : settlementType === 'collection_refund'
                ? 'Catering Collection Refunded'
                : 'Catering Receivable Written Off',
      details: `Recorded ${settlementType} of ${amount} for event ${refreshedEvent.event_no}`,
    });

    return this.getEvent(clientId, refreshedEvent.id, accessibleBranchIds);
  }
}
