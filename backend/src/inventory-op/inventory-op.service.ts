import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { StockLedger } from './entities/stock-ledger.entity';
import { StockLevel } from './entities/stock-level.entity';
import { InventoryConsumption } from './entities/inventory-consumption.entity';
import { InventoryConsumptionLine } from './entities/inventory-consumption-line.entity';
import { InventoryWaste } from './entities/inventory-waste.entity';
import { InventoryWasteLine } from './entities/inventory-waste-line.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Vendor } from '../inventory/entities/vendor.entity';
import { AccountingService } from '../accounting/accounting.service';
import { Branch } from '../setup/entities/branch.entity';
import {
  AdjustStockDto,
  CaptureGrnBillDto,
  CreateGrnReturnDto,
  IssueToKitchenDto,
  ReceiveStockDto,
} from './dto/inventory-op.dto';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import { hasBranchApprovalAuthority, resolveActorId } from '../auth/request-context.util';
import { GoodsReceiptNote } from './entities/goods-receipt-note.entity';
import { GoodsReceiptNoteItem } from './entities/goods-receipt-note-item.entity';
import { GoodsReceiptReturn } from './entities/goods-receipt-return.entity';
import { GoodsReceiptReturnItem } from './entities/goods-receipt-return-item.entity';
import { InventoryCountSession } from './entities/inventory-count-session.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { AuditLog } from '../platform/entities/audit-log.entity';
import { createDefaultClientNumberingSettings, type BranchDocumentRule } from '../setup/branches/branch-config.types';
import { nextBranchDocumentNumber } from '../setup/branches/branch-document.util';
import type { ProcurementPayableStatus } from './procurement.constants';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { UomConversionService } from '../common/uom-conversion.service';

const STOCK_TRANSACTION_TYPES = [
  'purchase',
  'sale',
  'adjustment',
  'transfer',
  'wastage',
  'production',
] as const;

type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];

type StockLedgerFilters = {
  itemId?: number;
  transactionType?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

type GoodsReceiptListFilters = {
  search?: string;
  branch_id?: number;
  vendor_id?: number;
  payable_status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

type AggregatedMovementLine = {
  item_id: number;
  quantity: number;
  unit_cost: number;
  uom?: string;
  input_quantity?: number;
  input_uom?: string;
};

type GoodsReceiptSummary = {
  lineCount: number;
  quantityTotal: number;
  totalAmount: number;
};

type GoodsReceiptReturnSummary = {
  documentCount: number;
  quantityTotal: number;
  totalAmount: number;
  latestReturnDate: string | null;
};

type GoodsReceiptCreditNoteSummary = {
  documentCount: number;
  totalAmount: number;
  approvedAmount: number;
  latestCreditDate: string | null;
};

type KitchenIssueMetadata = {
  issue_to?: string | null;
  issuance_type?: string | null;
  issue_date?: string | null;
  issued_by_name?: string | null;
  notes?: string | null;
  line_count?: number | null;
  total_quantity?: number | null;
  total_cost?: number | null;
};

const HIGH_VALUE_WASTAGE_THRESHOLD = 5000;

@Injectable()
export class InventoryOpService {
  constructor(
    @InjectRepository(StockLedger)
    private readonly ledgerRepo: Repository<StockLedger>,
    @InjectRepository(StockLevel)
    private readonly levelRepo: Repository<StockLevel>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(GoodsReceiptNote)
    private readonly grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptNoteItem)
    private readonly grnItemRepo: Repository<GoodsReceiptNoteItem>,
    @InjectRepository(GoodsReceiptReturn)
    private readonly grnReturnRepo: Repository<GoodsReceiptReturn>,
  @InjectRepository(GoodsReceiptReturnItem)
  private readonly grnReturnItemRepo: Repository<GoodsReceiptReturnItem>,
    @InjectRepository(InventoryConsumption)
    private readonly consumptionRepo: Repository<InventoryConsumption>,
    @InjectRepository(InventoryWaste)
    private readonly wasteRepo: Repository<InventoryWaste>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly accountingService: AccountingService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly dataSource: DataSource,
    private readonly uomConversionService: UomConversionService,
  ) {}

  private normalizeNumber(value: number | string | null | undefined, precision = 4): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(precision));
  }

  private normalizeMoney(value: number | string | null | undefined): number {
    return this.normalizeNumber(value, 4);
  }

  private normalizeLimit(value: number | string | null | undefined, fallback: number, max: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), max);
  }

  private normalizeOffset(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(Math.trunc(parsed), 0);
  }

  private normalizeOptionalDate(
    value: string | Date | null | undefined,
    label: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    const normalized = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(normalized.getTime())) {
      throw new BadRequestException(`Invalid ${label} supplied.`);
    }

    return normalized;
  }

  private resolveFilterDateRange(filters?: {
    date_from?: string;
    date_to?: string;
  }): { start?: Date; end?: Date } {
    const start = filters?.date_from
      ? this.normalizeOptionalDate(`${filters.date_from}T00:00:00.000`, 'date_from') ?? undefined
      : undefined;
    const end = filters?.date_to
      ? this.normalizeOptionalDate(`${filters.date_to}T23:59:59.999`, 'date_to') ?? undefined
      : undefined;

    if (start && end && start > end) {
      throw new BadRequestException('date_from cannot be after date_to.');
    }

    return { start, end };
  }

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private resolveGrnGrossAmount(grn: GoodsReceiptNote): number {
    return this.normalizeMoney(
      (grn.items ?? []).reduce((sum, item) => sum + this.normalizeMoney(item.line_total), 0),
    );
  }

  private resolveGrnPayableBaseAmount(grn: GoodsReceiptNote): number {
    const grossAmount = this.resolveGrnGrossAmount(grn);
    if (grn.payable_status === 'bill_received' && grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined) {
      return this.normalizeMoney(grn.vendor_bill_amount);
    }
    return grossAmount;
  }

  private async generateGrnReturnNumber(clientId: string, branch: Branch): Promise<string> {
    const settingsRepo = this.dataSource.getRepository(ClientSettings);
    const settings = await settingsRepo.findOne({ where: { client_id: clientId } });
    const numbering = settings?.numbering_settings ?? createDefaultClientNumberingSettings();
    const rule: BranchDocumentRule = {
      ...numbering.rules.goods_receipt_note,
      prefix: 'RTN',
    };
    return nextBranchDocumentNumber({
      repository: this.grnReturnRepo,
      alias: 'grn_return',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code || 'BR',
      rule,
      documentColumn: 'return_number',
    });
  }

  private resolvePayableStatus(input: {
    vendorBillReference?: string | null;
    vendorBillDate?: Date | null;
    vendorBillDueDate?: Date | null;
    requestedStatus?: string | null;
  }): ProcurementPayableStatus {
    const hasBillContext = Boolean(
      input.vendorBillReference || input.vendorBillDate || input.vendorBillDueDate,
    );

    if (input.requestedStatus === 'bill_received' && !hasBillContext) {
      throw new BadRequestException(
        'Vendor bill details are required before marking a receipt as bill received.',
      );
    }

    return hasBillContext ? 'bill_received' : 'pending_bill';
  }

  private buildSystemUser(clientId: string, branchId: number, userId?: string | number): JwtPayload {
    return {
      sub: userId ?? 'system',
      client_id: clientId,
      branch_id: branchId,
      role: 'system',
      user_type: 'system',
    };
  }

  private hasEffectivePermission(user: JwtPayload | undefined, permission: string): boolean {
    const permissions = user?.effective_permissions ?? [];
    return permissions.includes('all') || permissions.includes(permission);
  }

  private normalizeTransactionType(type?: string | null): StockTransactionType {
    const normalized = String(type || 'adjustment').trim().toLowerCase();
    if (normalized === 'damage' || normalized === 'waste') {
      return 'wastage';
    }
    if (normalized === 'manual' || normalized === 'manual_correction' || normalized === 'count_correction') {
      return 'adjustment';
    }
    if ((STOCK_TRANSACTION_TYPES as readonly string[]).includes(normalized)) {
      return normalized as StockTransactionType;
    }
    return 'adjustment';
  }

  private isStockReducing(type: StockTransactionType, quantity: number): boolean {
    return quantity < 0 || ['sale', 'wastage', 'transfer', 'production'].includes(type);
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId: number,
    operation?: string,
  ): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, client_id: clientId, item_is_active: true },
    });
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found.`);
    }
    return item;
  }

  private async assertVendorBelongsToClient(
    clientId: string,
    vendorId?: number | null,
  ): Promise<Vendor | null> {
    if (!vendorId) {
      return null;
    }

    const vendor = await this.vendorRepo.findOne({
      where: { id: vendorId, client_id: clientId, is_active: true },
    });
    if (!vendor) {
      throw new BadRequestException(`Vendor ${vendorId} does not belong to this client.`);
    }

    return vendor;
  }

  private hasBranchAccess(accessibleBranchIds: number[] | undefined, branchId: number): boolean {
    return !accessibleBranchIds || accessibleBranchIds.length === 0 || accessibleBranchIds.includes(branchId);
  }

  private async hasCentralProcurementOversight(
    clientId: string,
    accessibleBranchIds?: number[],
  ): Promise<boolean> {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return true;
    }

    const count = await this.branchRepo.count({
      where: accessibleBranchIds.map((branchId) => ({
        id: branchId,
        client_id: clientId,
        inventory_store_type: 'central',
      })),
    });

    return count > 0;
  }

  private async assertBranchAccess(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ): Promise<void> {
    if (await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) {
      return;
    }

    if (!this.hasBranchAccess(accessibleBranchIds, branchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
  }

  private getDestinationBranchId(po?: Pick<PurchaseOrder, 'branch_id' | 'destination_branch_id'> | null): number | null {
    if (!po) {
      return null;
    }
    return po.destination_branch_id ?? po.branch_id;
  }

  private aggregateMovementItems(
    items: Array<{ item_id: number; quantity: number; unit_cost?: number; uom?: string; input_quantity?: number; input_uom?: string }>,
  ): AggregatedMovementLine[] {
    const totals = new Map<string, AggregatedMovementLine>();

    for (const item of items) {
      const itemId = Number(item.item_id);
      const quantity = this.normalizeNumber(item.quantity);
      const unitCost = this.normalizeMoney(item.unit_cost);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new BadRequestException('Each stock movement line requires a valid item_id.');
      }
      if (Math.abs(quantity) < 0.0001) {
        continue;
      }

      const key = `${itemId}:${this.uomConversionService.normalize(item.uom || item.input_uom || '')}`;
      const current = totals.get(key);
      if (current) {
        current.quantity = this.normalizeNumber(current.quantity + quantity);
        if (unitCost > 0) {
          current.unit_cost = unitCost;
        }
      } else {
        totals.set(key, {
          item_id: itemId,
          quantity,
          unit_cost: unitCost,
          uom: item.uom,
          input_quantity: item.input_quantity,
          input_uom: item.input_uom,
        });
      }
    }

    return [...totals.values()];
  }

  private async normalizeReceiptLinesToBase(
    clientId: string,
    items: Array<{ item_id: number; quantity: number; unit_cost?: number; uom?: string }>,
  ): Promise<AggregatedMovementLine[]> {
    const normalized: AggregatedMovementLine[] = [];
    for (const line of items) {
      const item = await this.assertItemBelongsToClient(clientId, Number(line.item_id));
      const inputUom = line.uom || item.uom_purchase || item.uom_base;
      const inputQuantity = this.normalizeNumber(line.quantity);
      const baseQuantity = this.uomConversionService.toBase(inputQuantity, inputUom, item.uom_base).base_quantity;
      const lineTotal = this.normalizeMoney(inputQuantity * this.normalizeMoney(line.unit_cost));
      normalized.push({
        item_id: item.id,
        quantity: baseQuantity,
        unit_cost: baseQuantity > 0 ? this.normalizeMoney(lineTotal / baseQuantity) : 0,
        input_quantity: inputQuantity,
        input_uom: inputUom,
        uom: item.uom_base,
      });
    }
    return this.aggregateMovementItems(normalized).filter((item) => item.quantity > 0);
  }

  private async normalizeMovementLinesToBase(
    clientId: string,
    items: Array<{ item_id: number; quantity: number; unit_cost?: number; uom?: string }>,
  ): Promise<AggregatedMovementLine[]> {
    const normalized: AggregatedMovementLine[] = [];
    for (const line of items) {
      const item = await this.assertItemBelongsToClient(clientId, Number(line.item_id));
      const inputQuantity = this.normalizeNumber(line.quantity);
      const inputUom = line.uom || item.uom_base;
      const baseQuantity = this.uomConversionService.toBase(Math.abs(inputQuantity), inputUom, item.uom_base).base_quantity;
      normalized.push({
        item_id: item.id,
        quantity: inputQuantity < 0 ? -Math.abs(baseQuantity) : baseQuantity,
        unit_cost: this.normalizeMoney(line.unit_cost),
        input_quantity: Math.abs(inputQuantity),
        input_uom: inputUom,
        uom: item.uom_base,
      });
    }
    return this.aggregateMovementItems(normalized);
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

  private async postStockMovement(
    manager: EntityManager,
    input: {
      clientId: string;
      branchId: number;
      itemId: number;
      quantity: number;
      transactionType: StockTransactionType;
      referenceId: string;
      unitCost?: number;
      allowNegative?: boolean;
      movementDate?: Date;
    },
  ) {
    const item = await manager.findOne(InventoryItem, {
      where: { id: input.itemId, client_id: input.clientId, item_is_active: true },
    });
    if (!item) {
      throw new NotFoundException(`Item ${input.itemId} not found.`);
    }

    const delta = this.normalizeNumber(input.quantity);
    if (Math.abs(delta) < 0.0001) {
      throw new BadRequestException(`Movement quantity for ${item.item_name} must be non-zero.`);
    }

    const stockLevel = await this.ensureStockLevel(
      manager,
      input.clientId,
      input.branchId,
      input.itemId,
    );

    const currentQuantity = this.normalizeNumber(stockLevel.current_quantity);
    const nextQuantity = this.normalizeNumber(currentQuantity + delta);
    const reducingMovement = this.isStockReducing(input.transactionType, delta);
    let unitCost = this.normalizeMoney(input.unitCost);

    if (unitCost <= 0 && reducingMovement) {
      unitCost = this.normalizeMoney(stockLevel.last_unit_cost);
    }

    if (reducingMovement && !input.allowNegative && nextQuantity < -0.0001) {
      throw new BadRequestException(
        `Insufficient stock for ${item.item_name}. Available ${currentQuantity.toFixed(4)}, requested ${Math.abs(delta).toFixed(4)}.`,
      );
    }

    stockLevel.current_quantity = nextQuantity;
    if (delta > 0 && unitCost > 0) {
      stockLevel.last_unit_cost = unitCost;
      stockLevel.last_received_at = input.movementDate ?? new Date();
    }
    await manager.save(stockLevel);

    const ledgerEntry = manager.create(StockLedger, {
      client_id: input.clientId,
      branch_id: input.branchId,
      item_id: input.itemId,
      quantity: delta,
      transaction_type: input.transactionType,
      reference_id: input.referenceId,
      unit_cost: unitCost,
    });
    await manager.save(ledgerEntry);

    return { item, stockLevel, ledgerEntry };
  }

  private async generateGrnNumber(clientId: string, branch: Branch): Promise<string> {
    const settings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });
    const defaults = createDefaultClientNumberingSettings().rules.goods_receipt_note;
    const rule: BranchDocumentRule = {
      ...defaults,
      ...(branch.document_settings?.goods_receipt_note ?? {}),
      ...(settings?.numbering_settings?.rules?.goods_receipt_note ?? {}),
    };
    return nextBranchDocumentNumber({
      repository: this.grnRepo,
      alias: 'grn',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code,
      rule,
      documentColumn: 'grn_number',
    });
  }

  private async loadPoReceivedQuantities(
    clientId: string,
    poId: number,
  ): Promise<Map<number, number>> {
    const rows = await this.grnItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.grn', 'grn')
      .select('item.item_id', 'item_id')
      .addSelect('SUM(item.received_quantity)', 'received_quantity')
      .where('grn.client_id = :clientId', { clientId })
      .andWhere('grn.purchase_order_id = :poId', { poId })
      .groupBy('item.item_id')
      .getRawMany();

    return new Map(
      rows.map((row) => [Number(row.item_id), this.normalizeNumber(row.received_quantity)]),
    );
  }

  private mapGoodsReceipt(
    grn: GoodsReceiptNote,
    returnSummary?: GoodsReceiptReturnSummary,
    returnHistory?: GoodsReceiptReturn[],
    creditSummary?: GoodsReceiptCreditNoteSummary,
    creditHistory?: Array<any>,
  ) {
    const items = (grn.items ?? []).map((item) => ({
      id: item.id,
      po_item_id: item.po_item_id,
      item_id: item.item_id,
      item_name: item.item?.item_name ?? `Item #${item.item_id}`,
      item_sku: item.item?.item_sku ?? null,
      ordered_quantity: this.normalizeNumber(item.ordered_quantity),
      received_quantity: this.normalizeNumber(item.received_quantity),
      unit_cost: this.normalizeMoney(item.unit_cost),
      line_total: this.normalizeMoney(item.line_total),
      notes: item.notes,
    }));

    const totalQuantity = items.reduce((sum, item) => sum + item.received_quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + item.line_total, 0);
    const billedAmount = this.normalizeMoney(
      grn.payable_status === 'bill_received'
        ? (grn.vendor_bill_amount ?? totalValue)
        : 0,
    );
    const payableBaseAmount = this.normalizeMoney(
      grn.payable_status === 'bill_received' ? billedAmount : totalValue,
    );
    const returnedQuantity = this.normalizeNumber(returnSummary?.quantityTotal ?? 0);
    const returnedAmount = this.normalizeMoney(returnSummary?.totalAmount ?? 0);
    const creditedAmount = this.normalizeMoney(creditSummary?.approvedAmount ?? 0);
    const netQuantity = this.normalizeNumber(totalQuantity - returnedQuantity);
    const netValue = this.normalizeMoney(payableBaseAmount - returnedAmount - creditedAmount);
    const vendorBillReference = grn.vendor_bill_reference ?? grn.vendor_invoice_number;
    const payableReady = grn.payable_status === 'bill_received';
    const liabilityAccountCode = payableReady ? '2100' : '2110';
    const liabilityAccountName = payableReady ? 'Accounts Payable' : 'Goods Received Not Invoiced';

    return {
      id: grn.id,
      client_id: grn.client_id,
      branch_id: grn.branch_id,
      purchase_order_id: grn.purchase_order_id,
      vendor_id: grn.vendor_id,
      grn_number: grn.grn_number,
      receipt_date: grn.receipt_date,
      status: grn.status,
      vendor_invoice_number: grn.vendor_invoice_number,
      vendor_bill_reference: vendorBillReference,
      vendor_bill_date: grn.vendor_bill_date,
      vendor_bill_due_date: grn.vendor_bill_due_date,
      vendor_bill_amount: grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined
        ? this.normalizeMoney(grn.vendor_bill_amount)
        : null,
      payment_terms_snapshot: grn.payment_terms_snapshot,
      payable_status: grn.payable_status,
      notes: grn.notes,
      received_by: grn.received_by,
      received_by_name: grn.received_by_name,
      branch: grn.branch
        ? {
            id: grn.branch.id,
            branch_name: grn.branch.branch_name,
            branch_code: grn.branch.branch_code,
            inventory_store_type: grn.branch.inventory_store_type,
          }
        : null,
      vendor: grn.vendor
        ? {
            id: grn.vendor.id,
            vendor_name: grn.vendor.vendor_name,
          }
        : null,
      purchase_order: grn.purchase_order
        ? {
            id: grn.purchase_order.id,
            po_number: grn.purchase_order.po_number ?? `PO-${grn.purchase_order.id}`,
            status: grn.purchase_order.status,
            approval_status: grn.purchase_order.approval_status,
          }
        : null,
      items,
      summary: {
        line_count: items.length,
        quantity_total: this.normalizeNumber(totalQuantity),
        total_amount: this.normalizeMoney(totalValue),
        net_quantity_total: netQuantity,
        net_amount: netValue,
      },
      payable: {
        status: grn.payable_status,
        ready: payableReady,
        accrued_amount: netValue,
        returned_amount: returnedAmount,
        credited_amount: creditedAmount,
        gross_amount: this.normalizeMoney(totalValue),
        bill_amount: billedAmount || null,
        variance_amount: this.normalizeMoney(payableBaseAmount - totalValue),
        liability_account_code: liabilityAccountCode,
        liability_account_name: liabilityAccountName,
        bill_reference: vendorBillReference,
        bill_reference_present: Boolean(vendorBillReference),
        bill_date: grn.vendor_bill_date,
        bill_due_date: grn.vendor_bill_due_date,
        payment_terms_snapshot: grn.payment_terms_snapshot,
      },
      returns: {
        document_count: returnSummary?.documentCount ?? 0,
        quantity_total: returnedQuantity,
        total_amount: returnedAmount,
        latest_return_date: returnSummary?.latestReturnDate ?? null,
        history: (returnHistory ?? []).map((returnDoc) => ({
          id: returnDoc.id,
          return_number: returnDoc.return_number,
          return_date: returnDoc.return_date,
          debit_note_reference: returnDoc.debit_note_reference,
          status: returnDoc.status,
          notes: returnDoc.notes,
          total_amount: this.normalizeMoney(
            (returnDoc.items ?? []).reduce((sum, item) => sum + this.normalizeMoney(item.line_total), 0),
          ),
          quantity_total: this.normalizeNumber(
            (returnDoc.items ?? []).reduce((sum, item) => sum + this.normalizeNumber(item.returned_quantity), 0),
          ),
          items: (returnDoc.items ?? []).map((item) => ({
            id: item.id,
            grn_item_id: item.grn_item_id,
            item_id: item.item_id,
            item_name: item.item?.item_name ?? `Item #${item.item_id}`,
            returned_quantity: this.normalizeNumber(item.returned_quantity),
            unit_cost: this.normalizeMoney(item.unit_cost),
            line_total: this.normalizeMoney(item.line_total),
            notes: item.notes,
          })),
        })),
      },
      credit_notes: {
        document_count: creditSummary?.documentCount ?? 0,
        total_amount: this.normalizeMoney(creditSummary?.totalAmount ?? 0),
        approved_amount: creditedAmount,
        latest_credit_date: creditSummary?.latestCreditDate ?? null,
        history: (creditHistory ?? []).map((voucher) => ({
          id: voucher.id,
          voucher_no: voucher.voucher_no,
          voucher_date: voucher.date,
          reference_no: voucher.reference_no ?? null,
          description: voucher.description ?? null,
          status: voucher.status,
          total_amount: this.normalizeMoney(voucher.amount),
        })),
      },
      created_at: grn.created_at,
      updated_at: grn.updated_at,
    };
  }

  private mapGoodsReceiptListRow(
    grn: GoodsReceiptNote,
    summary?: GoodsReceiptSummary,
    returnSummary?: GoodsReceiptReturnSummary,
    creditSummary?: GoodsReceiptCreditNoteSummary,
  ) {
    const totalQuantity = this.normalizeNumber(summary?.quantityTotal ?? 0);
    const totalAmount = this.normalizeMoney(summary?.totalAmount ?? 0);
    const billedAmount = this.normalizeMoney(
      grn.payable_status === 'bill_received'
        ? (grn.vendor_bill_amount ?? totalAmount)
        : 0,
    );
    const payableBaseAmount = this.normalizeMoney(
      grn.payable_status === 'bill_received' ? billedAmount : totalAmount,
    );
    const returnedQuantity = this.normalizeNumber(returnSummary?.quantityTotal ?? 0);
    const returnedAmount = this.normalizeMoney(returnSummary?.totalAmount ?? 0);
    const creditedAmount = this.normalizeMoney(creditSummary?.approvedAmount ?? 0);
    const vendorBillReference = grn.vendor_bill_reference ?? grn.vendor_invoice_number;
    const payableReady = grn.payable_status === 'bill_received';
    const liabilityAccountCode = payableReady ? '2100' : '2110';
    const liabilityAccountName = payableReady ? 'Accounts Payable' : 'Goods Received Not Invoiced';

    return {
      id: grn.id,
      client_id: grn.client_id,
      branch_id: grn.branch_id,
      purchase_order_id: grn.purchase_order_id,
      vendor_id: grn.vendor_id,
      grn_number: grn.grn_number,
      receipt_date: grn.receipt_date,
      status: grn.status,
      vendor_invoice_number: grn.vendor_invoice_number,
      vendor_bill_reference: vendorBillReference,
      vendor_bill_date: grn.vendor_bill_date,
      vendor_bill_due_date: grn.vendor_bill_due_date,
      vendor_bill_amount: grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined
        ? this.normalizeMoney(grn.vendor_bill_amount)
        : null,
      payment_terms_snapshot: grn.payment_terms_snapshot,
      payable_status: grn.payable_status,
      notes: grn.notes,
      received_by: grn.received_by,
      received_by_name: grn.received_by_name,
      branch: grn.branch
        ? {
            id: grn.branch.id,
            branch_name: grn.branch.branch_name,
            branch_code: grn.branch.branch_code,
            inventory_store_type: grn.branch.inventory_store_type,
          }
        : null,
      vendor: grn.vendor
        ? {
            id: grn.vendor.id,
            vendor_name: grn.vendor.vendor_name,
          }
        : null,
      purchase_order: grn.purchase_order
        ? {
            id: grn.purchase_order.id,
            po_number: grn.purchase_order.po_number ?? `PO-${grn.purchase_order.id}`,
            status: grn.purchase_order.status,
            approval_status: grn.purchase_order.approval_status,
          }
        : null,
      items: [],
      summary: {
        line_count: summary?.lineCount ?? 0,
        quantity_total: totalQuantity,
        total_amount: totalAmount,
        net_quantity_total: this.normalizeNumber(totalQuantity - returnedQuantity),
        net_amount: this.normalizeMoney(totalAmount - returnedAmount - creditedAmount),
      },
      payable: {
        status: grn.payable_status,
        ready: payableReady,
        accrued_amount: this.normalizeMoney(payableBaseAmount - returnedAmount - creditedAmount),
        returned_amount: returnedAmount,
        credited_amount: creditedAmount,
        gross_amount: totalAmount,
        bill_amount: billedAmount || null,
        variance_amount: this.normalizeMoney(payableBaseAmount - totalAmount),
        liability_account_code: liabilityAccountCode,
        liability_account_name: liabilityAccountName,
        bill_reference: vendorBillReference,
        bill_reference_present: Boolean(vendorBillReference),
        bill_date: grn.vendor_bill_date,
        bill_due_date: grn.vendor_bill_due_date,
        payment_terms_snapshot: grn.payment_terms_snapshot,
      },
      returns: {
        document_count: returnSummary?.documentCount ?? 0,
        quantity_total: returnedQuantity,
        total_amount: returnedAmount,
        latest_return_date: returnSummary?.latestReturnDate ?? null,
      },
      credit_notes: {
        document_count: creditSummary?.documentCount ?? 0,
        total_amount: this.normalizeMoney(creditSummary?.totalAmount ?? 0),
        approved_amount: creditedAmount,
        latest_credit_date: creditSummary?.latestCreditDate ?? null,
      },
      created_at: grn.created_at,
      updated_at: grn.updated_at,
    };
  }

  private async loadGoodsReceiptSummaries(grnIds: number[]): Promise<Map<number, GoodsReceiptSummary>> {
    if (grnIds.length === 0) {
      return new Map<number, GoodsReceiptSummary>();
    }

    const rows = await this.grnItemRepo
      .createQueryBuilder('item')
      .select('item.grn_id', 'grn_id')
      .addSelect('COUNT(item.id)', 'line_count')
      .addSelect('COALESCE(SUM(item.received_quantity), 0)', 'quantity_total')
      .addSelect('COALESCE(SUM(item.line_total), 0)', 'total_amount')
      .where('item.grn_id IN (:...grnIds)', { grnIds })
      .groupBy('item.grn_id')
      .getRawMany();

    return new Map(
      rows.map((row) => [
        Number(row.grn_id),
        {
          lineCount: Number(row.line_count ?? 0),
          quantityTotal: this.normalizeNumber(row.quantity_total),
          totalAmount: this.normalizeMoney(row.total_amount),
        },
      ]),
    );
  }

  private async loadGoodsReceiptReturnSummaries(grnIds: number[]): Promise<Map<number, GoodsReceiptReturnSummary>> {
    if (grnIds.length === 0) {
      return new Map<number, GoodsReceiptReturnSummary>();
    }

    const rows = await this.grnReturnItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.return_doc', 'return_doc')
      .select('return_doc.grn_id', 'grn_id')
      .addSelect('COUNT(DISTINCT return_doc.id)', 'document_count')
      .addSelect('COALESCE(SUM(item.returned_quantity), 0)', 'quantity_total')
      .addSelect('COALESCE(SUM(item.line_total), 0)', 'total_amount')
      .addSelect('MAX(return_doc.return_date)', 'latest_return_date')
      .where('return_doc.grn_id IN (:...grnIds)', { grnIds })
      .andWhere('return_doc.status = :status', { status: 'posted' })
      .groupBy('return_doc.grn_id')
      .getRawMany();

    return new Map(
      rows.map((row) => [
        Number(row.grn_id),
        {
          documentCount: Number(row.document_count ?? 0),
          quantityTotal: this.normalizeNumber(row.quantity_total),
          totalAmount: this.normalizeMoney(row.total_amount),
          latestReturnDate: row.latest_return_date ? String(row.latest_return_date).slice(0, 10) : null,
        },
      ]),
    );
  }

  private async loadGoodsReceiptCreditNoteSummaries(grnIds: number[]): Promise<Map<number, GoodsReceiptCreditNoteSummary>> {
    if (grnIds.length === 0) {
      return new Map<number, GoodsReceiptCreditNoteSummary>();
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        voucher.linked_grn_id AS grn_id,
        COUNT(*) AS document_count,
        COALESCE(SUM(voucher.amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN voucher.status = 'APPROVED' THEN voucher.amount ELSE 0 END), 0) AS approved_amount,
        MAX(voucher.date) AS latest_credit_date
      FROM financial_vouchers voucher
      WHERE voucher.linked_grn_id IN (${grnIds.map(() => '?').join(', ')})
        AND voucher.type = 'PURCHASE_CREDIT_NOTE'
      GROUP BY voucher.linked_grn_id
      `,
      grnIds,
    );

    return new Map(
      rows.map((row: any) => [
        Number(row.grn_id),
        {
          documentCount: Number(row.document_count ?? 0),
          totalAmount: this.normalizeMoney(row.total_amount),
          approvedAmount: this.normalizeMoney(row.approved_amount),
          latestCreditDate: row.latest_credit_date ? String(row.latest_credit_date).slice(0, 10) : null,
        },
      ]),
    );
  }

  private async loadGoodsReceiptCreditNoteHistory(clientId: string, grnId: number) {
    return this.dataSource.query(
      `
      SELECT
        voucher.id,
        voucher.voucher_no,
        DATE(voucher.date) AS date,
        voucher.reference_no,
        voucher.description,
        voucher.status,
        voucher.amount
      FROM financial_vouchers voucher
      WHERE voucher.client_id = ?
        AND voucher.linked_grn_id = ?
        AND voucher.type = 'PURCHASE_CREDIT_NOTE'
      ORDER BY voucher.date DESC, voucher.id DESC
      `,
      [clientId, grnId],
    );
  }

  private buildStockLedgerQuery(
    clientId: string,
    branchId: number,
    filters?: StockLedgerFilters,
  ) {
    const query = this.ledgerRepo
      .createQueryBuilder('ledger')
      .leftJoinAndSelect('ledger.item', 'item')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id = :branchId', { branchId });

    if (filters?.itemId) {
      query.andWhere('ledger.item_id = :itemId', { itemId: filters.itemId });
    }

    const transactionType = filters?.transactionType?.trim().toLowerCase();
    if (transactionType && (STOCK_TRANSACTION_TYPES as readonly string[]).includes(transactionType)) {
      query.andWhere('ledger.transaction_type = :transactionType', { transactionType });
    }

    const trimmedSearch = filters?.search?.trim();
    if (trimmedSearch) {
      const search = `%${trimmedSearch.toLowerCase()}%`;
      query.andWhere(
        `(
          LOWER(COALESCE(item.item_name, '')) LIKE :search
          OR LOWER(COALESCE(item.item_sku, '')) LIKE :search
          OR LOWER(COALESCE(ledger.reference_id, '')) LIKE :search
          OR LOWER(COALESCE(ledger.transaction_type, '')) LIKE :search
        )`,
        { search },
      );
    }

    const { start, end } = this.resolveFilterDateRange(filters);
    if (start) {
      query.andWhere('ledger.created_at >= :start', { start });
    }
    if (end) {
      query.andWhere('ledger.created_at <= :end', { end });
    }

    return query;
  }

  private parseAuditMetadata(value?: string | null): Record<string, unknown> {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async loadKitchenIssueMetadata(
    clientId: string,
    branchId: number,
    references: string[],
  ): Promise<Map<string, KitchenIssueMetadata>> {
    const uniqueReferences = Array.from(new Set(references.filter(Boolean)));
    if (uniqueReferences.length === 0) {
      return new Map();
    }

    const logs = await this.auditLogRepo.find({
      where: {
        clientId,
        branchId,
        entity: 'inventory_stock_ledger',
        action: 'Inventory Issued to Kitchen',
        entityId: In(uniqueReferences),
      },
      order: { timestamp: 'DESC' },
    });

    const metadataByReference = new Map<string, KitchenIssueMetadata>();
    for (const log of logs) {
      if (!log.entityId || metadataByReference.has(log.entityId)) {
        continue;
      }

      const metadata = this.parseAuditMetadata(log.metadataJson);
      const numberOrNull = (value: unknown, money = false) => {
        const parsed = Number(value ?? 0);
        if (!Number.isFinite(parsed)) {
          return null;
        }
        return money ? this.normalizeMoney(parsed) : this.normalizeNumber(parsed);
      };

      metadataByReference.set(log.entityId, {
        issue_to: typeof metadata.issue_to === 'string' ? metadata.issue_to : null,
        issuance_type: typeof metadata.issuance_type === 'string' ? metadata.issuance_type : null,
        issue_date: typeof metadata.issue_date === 'string' ? metadata.issue_date : null,
        issued_by_name: typeof metadata.issued_by_name === 'string' ? metadata.issued_by_name : null,
        notes: typeof metadata.notes === 'string' ? metadata.notes : null,
        line_count: numberOrNull(metadata.line_count),
        total_quantity: numberOrNull(metadata.total_quantity),
        total_cost: numberOrNull(metadata.total_cost, true),
      });
    }

    return metadataByReference;
  }

  private async loadKitchenIssueMetadataForRows(
    clientId: string,
    branchId: number,
    rows: StockLedger[],
  ): Promise<Map<string, KitchenIssueMetadata>> {
    const references = rows
      .filter((row) => row.transaction_type === 'production' && row.reference_id)
      .map((row) => row.reference_id as string);

    return this.loadKitchenIssueMetadata(clientId, branchId, references);
  }

  private mapStockLedgerRow(
    row: StockLedger,
    issueMetadataByReference?: Map<string, KitchenIssueMetadata>,
  ) {
    const quantity = this.normalizeNumber(row.quantity);
    const unitCost = this.normalizeMoney(row.unit_cost);

    return {
      id: row.id,
      client_id: row.client_id,
      branch_id: row.branch_id,
      item_id: row.item_id,
      quantity,
      transaction_type: row.transaction_type,
      reference_id: row.reference_id,
      unit_cost: unitCost,
      line_value: this.normalizeMoney(Math.abs(quantity) * unitCost),
      issue_metadata: row.transaction_type === 'production' && row.reference_id
        ? issueMetadataByReference?.get(row.reference_id) ?? null
        : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item: row.item,
    };
  }

  private async assertPoReceiptAllowed(
    clientId: string,
    branchId: number,
    poId: number,
    accessibleBranchIds?: number[],
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.poRepo.findOne({
      where: { id: poId, client_id: clientId },
      relations: ['vendor', 'branch', 'destination_branch', 'items', 'items.item'],
    });
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase Order not found for this client');
    }

    const receiptBranchId = this.getDestinationBranchId(purchaseOrder);
    if (receiptBranchId !== branchId) {
      throw new BadRequestException('Receive branch does not match the purchase order destination.');
    }

    await this.assertBranchAccess(clientId, receiptBranchId ?? branchId, accessibleBranchIds);
    assertBranchOperationalWriteAllowed(
      purchaseOrder.destination_branch ?? purchaseOrder.branch,
      'receive inventory',
    );

    if (purchaseOrder.approval_status === 'pending' || purchaseOrder.approval_status === 'rejected') {
      throw new BadRequestException('This purchase order must be approved before stock can be received.');
    }

    if (purchaseOrder.status === 'draft') {
      throw new BadRequestException('This purchase order must be sent before stock can be received.');
    }

    if (purchaseOrder.status === 'cancelled') {
      throw new BadRequestException('Cancelled purchase orders cannot be received.');
    }

    return purchaseOrder;
  }

  async listGoodsReceipts(clientId: string, accessibleBranchIds?: number[]) {
    const query = this.grnRepo
      .createQueryBuilder('grn')
      .leftJoinAndSelect('grn.branch', 'branch')
      .leftJoinAndSelect('grn.vendor', 'vendor')
      .leftJoinAndSelect('grn.purchase_order', 'purchase_order')
      .leftJoinAndSelect('grn.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .where('grn.client_id = :clientId', { clientId });

    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (!hasCentralOversight && accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere('grn.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
    }

    const rows = await query
      .orderBy('grn.receipt_date', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .getMany();

    const grnIds = rows.map((row) => row.id);
    const [returnSummaries, creditSummaries] = await Promise.all([
      this.loadGoodsReceiptReturnSummaries(grnIds),
      this.loadGoodsReceiptCreditNoteSummaries(grnIds),
    ]);
    return rows.map((row) => this.mapGoodsReceipt(
      row,
      returnSummaries.get(row.id),
      undefined,
      creditSummaries.get(row.id),
    ));
  }

  async listGoodsReceiptsPage(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters?: GoodsReceiptListFilters,
  ) {
    if (filters?.branch_id) {
      await this.assertBranchBelongsToClient(clientId, filters.branch_id);
      await this.assertBranchAccess(clientId, filters.branch_id, accessibleBranchIds);
    }

    const query = this.grnRepo
      .createQueryBuilder('grn')
      .leftJoinAndSelect('grn.branch', 'branch')
      .leftJoinAndSelect('grn.vendor', 'vendor')
      .leftJoinAndSelect('grn.purchase_order', 'purchase_order')
      .where('grn.client_id = :clientId', { clientId });

    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (!hasCentralOversight && accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere('grn.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
    }

    if (filters?.branch_id) {
      query.andWhere('grn.branch_id = :branchId', { branchId: filters.branch_id });
    }
    if (filters?.vendor_id) {
      query.andWhere('grn.vendor_id = :vendorId', { vendorId: filters.vendor_id });
    }
    if (filters?.payable_status) {
      query.andWhere('grn.payable_status = :payableStatus', { payableStatus: filters.payable_status });
    }

    const trimmedSearch = filters?.search?.trim();
    if (trimmedSearch) {
      const search = `%${trimmedSearch.toLowerCase()}%`;
      query.andWhere(
        `(
          LOWER(COALESCE(grn.grn_number, '')) LIKE :search
          OR LOWER(COALESCE(grn.vendor_bill_reference, '')) LIKE :search
          OR LOWER(COALESCE(grn.vendor_invoice_number, '')) LIKE :search
          OR LOWER(COALESCE(vendor.vendor_name, '')) LIKE :search
          OR LOWER(COALESCE(branch.branch_name, '')) LIKE :search
          OR LOWER(COALESCE(purchase_order.po_number, '')) LIKE :search
        )`,
        { search },
      );
    }

    const { start, end } = this.resolveFilterDateRange(filters);
    if (start) {
      query.andWhere('grn.receipt_date >= :start', { start });
    }
    if (end) {
      query.andWhere('grn.receipt_date <= :end', { end });
    }

    const limit = this.normalizeLimit(filters?.limit, 25, 200);
    const offset = this.normalizeOffset(filters?.offset);
    const [rows, total] = await query
      .orderBy('grn.receipt_date', 'DESC')
      .addOrderBy('grn.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const grnIds = rows.map((row) => row.id);
    const [summaries, returnSummaries, creditSummaries] = await Promise.all([
      this.loadGoodsReceiptSummaries(grnIds),
      this.loadGoodsReceiptReturnSummaries(grnIds),
      this.loadGoodsReceiptCreditNoteSummaries(grnIds),
    ]);

    return {
      items: rows.map((row) => this.mapGoodsReceiptListRow(
        row,
        summaries.get(row.id),
        returnSummaries.get(row.id),
        creditSummaries.get(row.id),
      )),
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
    };
  }

  async getGoodsReceipt(
    clientId: string,
    grnId: number,
    accessibleBranchIds?: number[],
  ) {
    const grn = await this.grnRepo.findOne({
      where: { id: grnId, client_id: clientId },
      relations: ['branch', 'vendor', 'purchase_order', 'items', 'items.item'],
    });
    if (!grn) {
      throw new NotFoundException('Goods receipt note not found.');
    }

    await this.assertBranchAccess(clientId, grn.branch_id, accessibleBranchIds);
    const [returnSummaries, returnHistory, creditSummaries, creditHistory] = await Promise.all([
      this.loadGoodsReceiptReturnSummaries([grn.id]),
      this.grnReturnRepo.find({
        where: { client_id: clientId, grn_id: grn.id, status: 'posted' },
        relations: ['items', 'items.item'],
        order: { return_date: 'DESC', id: 'DESC' },
      }),
      this.loadGoodsReceiptCreditNoteSummaries([grn.id]),
      this.loadGoodsReceiptCreditNoteHistory(clientId, grn.id),
    ]);
    return this.mapGoodsReceipt(
      grn,
      returnSummaries.get(grn.id),
      returnHistory,
      creditSummaries.get(grn.id),
      creditHistory,
    );
  }

  async receiveStock(
    clientId: string,
    branchId: number,
    dto: ReceiveStockDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'receive inventory');
    await this.assertBranchAccess(clientId, branchId, accessibleBranchIds);

    const requestedLines = await this.normalizeReceiptLinesToBase(
      clientId,
      (dto.items ?? []).map((item) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        uom: item.uom,
      })),
    );

    if (requestedLines.length === 0) {
      throw new BadRequestException('At least one positive receipt quantity is required.');
    }

    let purchaseOrder: PurchaseOrder | null = null;
    if (dto.po_id) {
      purchaseOrder = await this.assertPoReceiptAllowed(
        clientId,
        branchId,
        dto.po_id,
        accessibleBranchIds,
      );
    }

    const requestedVendorBillReference = dto.vendor_bill_reference?.trim() || null;
    const requestedVendorInvoiceNumber = dto.vendor_invoice_number?.trim() || null;
    if (
      requestedVendorBillReference &&
      requestedVendorInvoiceNumber &&
      requestedVendorBillReference !== requestedVendorInvoiceNumber
    ) {
      throw new BadRequestException(
        'vendor_bill_reference must match vendor_invoice_number when both are supplied.',
      );
    }

    const vendorBillReference = requestedVendorBillReference ?? requestedVendorInvoiceNumber;
    const vendorBillDate = this.normalizeOptionalDate(dto.vendor_bill_date, 'vendor_bill_date');
    const vendorBillDueDate = this.normalizeOptionalDate(dto.vendor_bill_due_date, 'vendor_bill_due_date');
    if (vendorBillDate && vendorBillDueDate && vendorBillDueDate < vendorBillDate) {
      throw new BadRequestException('vendor_bill_due_date cannot be before vendor_bill_date.');
    }

    const payableStatus = this.resolvePayableStatus({
      vendorBillReference,
      vendorBillDate,
      vendorBillDueDate,
      requestedStatus: dto.payable_status,
    });
    const vendorBillAmount = dto.vendor_bill_amount !== undefined && dto.vendor_bill_amount !== null
      ? this.normalizeMoney(dto.vendor_bill_amount)
      : null;
    if (vendorBillAmount !== null && payableStatus !== 'bill_received') {
      throw new BadRequestException('vendor_bill_amount can only be set when the receipt is bill received.');
    }

    const resolvedVendor = purchaseOrder?.vendor
      ?? await this.assertVendorBelongsToClient(clientId, dto.vendor_id ?? null);

    if (purchaseOrder?.vendor_id && dto.vendor_id && purchaseOrder.vendor_id !== dto.vendor_id) {
      throw new BadRequestException('Receipt vendor does not match the linked purchase order vendor.');
    }

    const grnId = await this.dataSource.transaction(async (manager) => {
      const now = dto.receipt_date ? new Date(dto.receipt_date) : new Date();
      if (Number.isNaN(now.getTime())) {
        throw new BadRequestException('Invalid receipt_date supplied.');
      }

      const grnNumber = dto.grn_number?.trim() || await this.generateGrnNumber(clientId, branch);
      const existingGrn = await manager.findOne(GoodsReceiptNote, {
        where: { client_id: clientId, grn_number: grnNumber },
      });
      if (existingGrn) {
        throw new BadRequestException(`GRN number ${grnNumber} already exists for this client.`);
      }

      const orderedByItem = new Map<number, number>();
      const poItemByItem = new Map<number, number | null>();
      const receivedByItem = purchaseOrder
        ? await this.loadPoReceivedQuantities(clientId, purchaseOrder.id)
        : new Map<number, number>();

      if (purchaseOrder) {
        for (const line of purchaseOrder.items ?? []) {
          orderedByItem.set(
            line.item_id,
            this.normalizeNumber((orderedByItem.get(line.item_id) ?? 0) + Number(line.quantity)),
          );
          if (!poItemByItem.has(line.item_id)) {
            poItemByItem.set(line.item_id, line.id);
          }
        }
      }

      for (const line of requestedLines) {
        await this.assertItemBelongsToClient(clientId, line.item_id);

        if (purchaseOrder) {
          const orderedQuantity = this.normalizeNumber(orderedByItem.get(line.item_id));
          if (orderedQuantity <= 0) {
            throw new BadRequestException(`Item ${line.item_id} is not part of the selected purchase order.`);
          }

          const alreadyReceived = this.normalizeNumber(receivedByItem.get(line.item_id));
          const remaining = this.normalizeNumber(orderedQuantity - alreadyReceived);
          if (line.quantity - remaining > 0.0001) {
            throw new BadRequestException(
              `Receipt quantity for item ${line.item_id} exceeds the PO balance. Remaining ${remaining.toFixed(4)}.`,
            );
          }
        }
      }

      const grn = manager.create(GoodsReceiptNote, {
        client_id: clientId,
        branch_id: branchId,
        purchase_order_id: purchaseOrder?.id ?? dto.po_id ?? null,
        vendor_id: resolvedVendor?.id ?? purchaseOrder?.vendor_id ?? dto.vendor_id ?? null,
        grn_number: grnNumber,
        receipt_date: now,
        status: 'posted',
        vendor_invoice_number: requestedVendorInvoiceNumber ?? vendorBillReference ?? null,
        vendor_bill_reference: vendorBillReference,
        vendor_bill_date: vendorBillDate,
        vendor_bill_due_date: vendorBillDueDate,
        vendor_bill_amount: payableStatus === 'bill_received' ? (vendorBillAmount ?? null) : null,
        payment_terms_snapshot: resolvedVendor?.payment_terms?.trim() || null,
        payable_status: payableStatus,
        notes: dto.notes?.trim() || null,
        received_by: resolveActorId(user) ?? null,
        received_by_name: this.buildActorName(user),
      });
      const savedGrn = await manager.save(grn);

      for (const line of requestedLines) {
        const orderedQuantity = purchaseOrder
          ? this.normalizeNumber(orderedByItem.get(line.item_id))
          : 0;
          const lineTotal = this.normalizeMoney(line.quantity * line.unit_cost);
          const receiptNotes = line.input_uom && line.input_uom !== line.uom
            ? `Entered ${line.input_quantity} ${line.input_uom}; stored ${line.quantity} ${line.uom}.`
            : null;

        await this.postStockMovement(manager, {
          clientId,
          branchId,
          itemId: line.item_id,
          quantity: line.quantity,
          transactionType: 'purchase',
          referenceId: savedGrn.grn_number,
          unitCost: line.unit_cost,
          movementDate: now,
        });

          const grnItem = manager.create(GoodsReceiptNoteItem, {
          grn_id: savedGrn.id,
          client_id: clientId,
          po_item_id: poItemByItem.get(line.item_id) ?? null,
          item_id: line.item_id,
          ordered_quantity: orderedQuantity,
            received_quantity: line.quantity,
            unit_cost: line.unit_cost,
            line_total: lineTotal,
            notes: receiptNotes,
        });
        await manager.save(grnItem);

        if (purchaseOrder) {
          receivedByItem.set(
            line.item_id,
            this.normalizeNumber((receivedByItem.get(line.item_id) ?? 0) + line.quantity),
          );
        }
      }

      if (purchaseOrder) {
        const fullyReceived = (purchaseOrder.items ?? []).every((line) => {
          const orderedQuantity = this.normalizeNumber(line.quantity);
          const receivedQuantity = this.normalizeNumber(receivedByItem.get(line.item_id));
          return receivedQuantity + 0.0001 >= orderedQuantity;
        });

        purchaseOrder.status = fullyReceived ? 'received' : 'sent';
        purchaseOrder.legacy_status = fullyReceived ? 'received' : 'ordered';
        await manager.save(purchaseOrder);
      }

      return savedGrn.id;
    });

    const grn = await this.getGoodsReceipt(clientId, grnId, accessibleBranchIds);

    const totalAmount = this.normalizeMoney(grn.summary.total_amount);
    if (totalAmount > 0) {
      const inventoryAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '1300',
        'Raw Materials Inventory',
        'asset',
      );
      const payableReady = grn.payable_status === 'bill_received';
      const offsetAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        payableReady ? '2100' : '2110',
        payableReady ? 'Accounts Payable' : 'Goods Received Not Invoiced',
        'liability',
      );

      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: new Date(grn.receipt_date),
        description: payableReady
          ? `${grn.grn_number} Receipt (Vendor Bill Received)`
          : `${grn.grn_number} Receipt (Pending Vendor Bill)`,
        reference_id: grn.grn_number,
        source_module: 'inventory',
        source_entity_type: 'goods_receipt_note',
        source_entity_id: String(grn.id),
        source_event: 'grn_receipt',
        posting_type: 'auto',
        items: [
          { account_id: inventoryAccount.id, debit: totalAmount, credit: 0 },
          { account_id: offsetAccount.id, debit: 0, credit: totalAmount },
        ],
      });

      const billAmount = payableReady && grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined
        ? this.normalizeMoney(grn.vendor_bill_amount)
        : totalAmount;
      const varianceAmount = this.normalizeMoney(billAmount - totalAmount);
      if (payableReady && Math.abs(varianceAmount) > 0.009) {
        const varianceAccount = await this.accountingService.ensureDefaultAccount(
          clientId,
          '5050',
          'Purchase Price Variance',
          'expense',
        );
        await this.accountingService.createJournalEntry(clientId, branchId, {
          transaction_date: new Date(grn.receipt_date),
          description: `${grn.grn_number} Bill Variance`,
          reference_id: grn.vendor_bill_reference || grn.grn_number,
          source_module: 'inventory',
          source_entity_type: 'goods_receipt_note',
          source_entity_id: String(grn.id),
          source_event: 'grn_bill_variance',
          posting_type: 'auto',
          items: varianceAmount > 0
            ? [
              { account_id: varianceAccount.id, debit: Math.abs(varianceAmount), credit: 0 },
              { account_id: offsetAccount.id, debit: 0, credit: Math.abs(varianceAmount) },
            ]
            : [
              { account_id: offsetAccount.id, debit: Math.abs(varianceAmount), credit: 0 },
              { account_id: varianceAccount.id, debit: 0, credit: Math.abs(varianceAmount) },
            ],
        });
      }
    }

    await this.operationalAuditService.log({
      user,
      action: 'Inventory Receipt',
      entity: 'goods_receipt_notes',
      clientId,
      branchId,
      entityId: grn.id,
      details: `Posted goods receipt ${grn.grn_number}`,
      metadata: {
        purchase_order_id: grn.purchase_order_id,
        line_count: grn.summary.line_count,
        total_amount: grn.summary.total_amount,
      },
    });

    return grn;
  }

  async receivePurchaseOrder(
    clientId: string,
    branchId: number,
    poId: number,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const purchaseOrder = await this.assertPoReceiptAllowed(
      clientId,
      branchId,
      poId,
      accessibleBranchIds,
    );
    const receivedByItem = await this.loadPoReceivedQuantities(clientId, poId);
    const items = (purchaseOrder.items ?? [])
      .map((line) => ({
        item_id: line.item_id,
        quantity: this.normalizeNumber(line.quantity) - this.normalizeNumber(receivedByItem.get(line.item_id)),
        unit_cost: this.normalizeMoney(line.unit_cost),
      }))
      .filter((line) => line.quantity > 0.0001);

    if (items.length === 0) {
      throw new BadRequestException('This purchase order is already fully received.');
    }

    return this.receiveStock(
      clientId,
      branchId,
      {
        branch_id: branchId,
        po_id: poId,
        vendor_id: purchaseOrder.vendor_id ?? undefined,
        items,
      },
      user,
      accessibleBranchIds,
    );
  }

  async captureVendorBill(
    clientId: string,
    grnId: number,
    dto: CaptureGrnBillDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const grnEntity = await this.grnRepo.findOne({
      where: { id: grnId, client_id: clientId },
      relations: ['items'],
    });
    if (!grnEntity) {
      throw new NotFoundException('Goods receipt note not found.');
    }

    await this.assertBranchAccess(clientId, grnEntity.branch_id, accessibleBranchIds);
    await this.assertBranchBelongsToClient(clientId, grnEntity.branch_id, 'capture vendor bill');

    const requestedVendorBillReference = dto.vendor_bill_reference?.trim() || null;
    const requestedVendorInvoiceNumber = dto.vendor_invoice_number?.trim() || null;
    if (
      requestedVendorBillReference &&
      requestedVendorInvoiceNumber &&
      requestedVendorBillReference !== requestedVendorInvoiceNumber
    ) {
      throw new BadRequestException(
        'vendor_bill_reference must match vendor_invoice_number when both are supplied.',
      );
    }

    const vendorBillReference = requestedVendorBillReference ?? requestedVendorInvoiceNumber;
    if (!vendorBillReference) {
      throw new BadRequestException('Vendor bill reference is required.');
    }

    const duplicateBill = grnEntity.vendor_id
      ? await this.grnRepo.findOne({
        where: {
          client_id: clientId,
          vendor_id: grnEntity.vendor_id,
          vendor_bill_reference: vendorBillReference,
          payable_status: 'bill_received',
          id: Not(grnId),
        },
      })
      : null;
    if (duplicateBill) {
      throw new BadRequestException(
        `Vendor bill reference ${vendorBillReference} is already captured against ${duplicateBill.grn_number}.`,
      );
    }

    const vendorBillDate = this.normalizeOptionalDate(dto.vendor_bill_date, 'vendor_bill_date');
    if (!vendorBillDate) {
      throw new BadRequestException('vendor_bill_date is required.');
    }

    const vendorBillDueDate = this.normalizeOptionalDate(dto.vendor_bill_due_date, 'vendor_bill_due_date');
    if (vendorBillDueDate && vendorBillDueDate < vendorBillDate) {
      throw new BadRequestException('vendor_bill_due_date cannot be before vendor_bill_date.');
    }
    const vendorBillAmount = dto.vendor_bill_amount !== undefined && dto.vendor_bill_amount !== null
      ? this.normalizeMoney(dto.vendor_bill_amount)
      : null;
    if (vendorBillAmount !== null && vendorBillAmount <= 0) {
      throw new BadRequestException('vendor_bill_amount must be greater than zero when supplied.');
    }

    const wasPendingBill = grnEntity.payable_status !== 'bill_received';
    grnEntity.vendor_bill_reference = vendorBillReference;
    grnEntity.vendor_invoice_number = requestedVendorInvoiceNumber ?? vendorBillReference;
    grnEntity.vendor_bill_date = vendorBillDate;
    grnEntity.vendor_bill_due_date = vendorBillDueDate;
    grnEntity.vendor_bill_amount = vendorBillAmount;
    grnEntity.payable_status = 'bill_received';
    if (dto.notes?.trim()) {
      grnEntity.notes = dto.notes.trim();
    }
    await this.grnRepo.save(grnEntity);

    const totalAmount = this.resolveGrnGrossAmount(grnEntity);
    const effectiveBillAmount = this.normalizeMoney(vendorBillAmount ?? totalAmount);
    if (wasPendingBill && totalAmount > 0) {
      const grniAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '2110',
        'Goods Received Not Invoiced',
        'liability',
      );
      const apAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '2100',
        'Accounts Payable',
        'liability',
      );

      await this.accountingService.createJournalEntry(clientId, grnEntity.branch_id, {
        transaction_date: vendorBillDate,
        description: `${grnEntity.grn_number} Vendor Bill Received`,
        reference_id: vendorBillReference,
        source_module: 'inventory',
        source_entity_type: 'goods_receipt_note',
        source_entity_id: String(grnEntity.id),
        source_event: 'grn_bill_received',
        posting_type: 'auto',
        items: [
          { account_id: grniAccount.id, debit: totalAmount, credit: 0 },
          { account_id: apAccount.id, debit: 0, credit: totalAmount },
        ],
      });
    }

    const varianceAmount = this.normalizeMoney(effectiveBillAmount - totalAmount);
    if (Math.abs(varianceAmount) > 0.009) {
      const apAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '2100',
        'Accounts Payable',
        'liability',
      );
      const varianceAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '5050',
        'Purchase Price Variance',
        'expense',
      );
      await this.accountingService.createJournalEntry(clientId, grnEntity.branch_id, {
        transaction_date: vendorBillDate,
        description: `${grnEntity.grn_number} Bill Variance`,
        reference_id: vendorBillReference,
        source_module: 'inventory',
        source_entity_type: 'goods_receipt_note',
        source_entity_id: String(grnEntity.id),
        source_event: 'grn_bill_variance',
        posting_type: 'auto',
        items: varianceAmount > 0
          ? [
            { account_id: varianceAccount.id, debit: Math.abs(varianceAmount), credit: 0 },
            { account_id: apAccount.id, debit: 0, credit: Math.abs(varianceAmount) },
          ]
          : [
            { account_id: apAccount.id, debit: Math.abs(varianceAmount), credit: 0 },
            { account_id: varianceAccount.id, debit: 0, credit: Math.abs(varianceAmount) },
          ],
      });
    }

    await this.operationalAuditService.log({
      user: user ?? this.buildSystemUser(clientId, grnEntity.branch_id),
      action: 'GRN Vendor Bill Captured',
      entity: 'goods_receipt_notes',
      clientId,
      branchId: grnEntity.branch_id,
      entityId: grnEntity.id,
      details: `Captured vendor bill ${vendorBillReference} for ${grnEntity.grn_number}`,
      metadata: {
        grn_number: grnEntity.grn_number,
        vendor_bill_reference: vendorBillReference,
        vendor_bill_date: vendorBillDate.toISOString(),
        vendor_bill_due_date: vendorBillDueDate?.toISOString() ?? null,
        vendor_bill_amount: effectiveBillAmount,
        payable_status: grnEntity.payable_status,
        reclassified_to_ap: wasPendingBill,
        total_amount: totalAmount,
        variance_amount: varianceAmount,
      },
    });

    return this.getGoodsReceipt(clientId, grnId, accessibleBranchIds);
  }

  async createPurchaseReturn(
    clientId: string,
    grnId: number,
    dto: CreateGrnReturnDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const grnEntity = await this.grnRepo.findOne({
      where: { id: grnId, client_id: clientId },
      relations: ['items', 'items.item', 'branch', 'vendor'],
    });
    if (!grnEntity || grnEntity.status !== 'posted') {
      throw new NotFoundException('Goods receipt note not found.');
    }

    await this.assertBranchAccess(clientId, grnEntity.branch_id, accessibleBranchIds);
    const branch = await this.assertBranchBelongsToClient(clientId, grnEntity.branch_id, 'post purchase return');

    const returnDate = dto.return_date ? new Date(dto.return_date) : new Date();
    if (Number.isNaN(returnDate.getTime())) {
      throw new BadRequestException('Invalid return_date supplied.');
    }

    const requestedLines = this.aggregateMovementItems(
      (dto.items ?? []).map((item) => ({
        item_id: item.grn_item_id,
        quantity: item.quantity,
        unit_cost: 0,
      })),
    ).filter((item) => item.quantity > 0);
    if (requestedLines.length === 0) {
      throw new BadRequestException('At least one positive return quantity is required.');
    }

    const grnItemById = new Map(
      (grnEntity.items ?? []).map((item) => [item.id, item]),
    );
    const priorReturnRows = await this.grnReturnItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.return_doc', 'return_doc')
      .select('item.grn_item_id', 'grn_item_id')
      .addSelect('COALESCE(SUM(item.returned_quantity), 0)', 'returned_quantity')
      .where('return_doc.client_id = :clientId', { clientId })
      .andWhere('return_doc.grn_id = :grnId', { grnId })
      .andWhere('return_doc.status = :status', { status: 'posted' })
      .groupBy('item.grn_item_id')
      .getRawMany();
    const priorReturnedByItemId = new Map<number, number>(
      priorReturnRows.map((row) => [Number(row.grn_item_id), this.normalizeNumber(row.returned_quantity)]),
    );

    let returnTotalAmount = 0;
    for (const line of requestedLines) {
      const grnItem = grnItemById.get(line.item_id);
      if (!grnItem) {
        throw new BadRequestException(`GRN line ${line.item_id} is not part of ${grnEntity.grn_number}.`);
      }

      const receivedQuantity = this.normalizeNumber(grnItem.received_quantity);
      const priorReturnedQuantity = this.normalizeNumber(priorReturnedByItemId.get(grnItem.id));
      const remainingQuantity = this.normalizeNumber(receivedQuantity - priorReturnedQuantity);
      if (line.quantity - remainingQuantity > 0.0001) {
        throw new BadRequestException(
          `${grnItem.item?.item_name ?? `Item #${grnItem.item_id}`} exceeds the remaining returnable quantity of ${remainingQuantity.toFixed(4)}.`,
        );
      }

      returnTotalAmount = this.normalizeMoney(
        returnTotalAmount + this.normalizeMoney(line.quantity * this.normalizeMoney(grnItem.unit_cost)),
      );
    }

    const grossAmount = this.normalizeMoney(
      (grnEntity.items ?? []).reduce((sum, item) => sum + this.normalizeMoney(item.line_total), 0),
    );
    const priorReturnedAmount = this.normalizeMoney(
      priorReturnRows.reduce((sum, row) => {
        const grnItem = grnItemById.get(Number(row.grn_item_id));
        return sum + this.normalizeMoney(this.normalizeNumber(row.returned_quantity) * this.normalizeMoney(grnItem?.unit_cost));
      }, 0),
    );
    const allocatedRow = grnEntity.payable_status === 'bill_received'
      ? await this.dataSource.query(
        `
        SELECT COALESCE(SUM(allocated_amount), 0) AS total_allocated
        FROM accounting_payable_allocations
        WHERE client_id = ?
          AND grn_id = ?
        `,
        [clientId, grnId],
      )
      : [{ total_allocated: 0 }];
    const allocatedAmount = this.normalizeMoney(allocatedRow[0]?.total_allocated ?? 0);
    const currentOpenLiability = this.normalizeMoney(grossAmount - priorReturnedAmount - allocatedAmount);
    if (returnTotalAmount - currentOpenLiability > 0.009) {
      throw new BadRequestException(
        `Return amount exceeds the open vendor liability on ${grnEntity.grn_number}. Remaining open amount is ${currentOpenLiability.toFixed(2)}.`,
      );
    }

    const debitNoteReference = dto.debit_note_reference?.trim() || null;
    if (debitNoteReference && grnEntity.vendor_id) {
      const duplicateDebitNote = await this.grnReturnRepo.findOne({
        where: {
          client_id: clientId,
          vendor_id: grnEntity.vendor_id,
          debit_note_reference: debitNoteReference,
          status: 'posted',
        },
      });
      if (duplicateDebitNote) {
        throw new BadRequestException(
          `Debit note ${debitNoteReference} is already used on ${duplicateDebitNote.return_number}.`,
        );
      }
    }

    const returnId = await this.dataSource.transaction(async (manager) => {
      const returnNumber = await this.generateGrnReturnNumber(clientId, branch);
      const returnDoc = manager.create(GoodsReceiptReturn, {
        client_id: clientId,
        branch_id: grnEntity.branch_id,
        grn_id: grnEntity.id,
        vendor_id: grnEntity.vendor_id ?? null,
        return_number: returnNumber,
        return_date: returnDate,
        status: 'posted',
        debit_note_reference: debitNoteReference,
        notes: dto.notes?.trim() || null,
        returned_by: resolveActorId(user) ?? null,
        returned_by_name: this.buildActorName(user),
      });
      const savedReturn = await manager.save(returnDoc);

      for (const line of requestedLines) {
        const grnItem = grnItemById.get(line.item_id)!;
        const posted = await this.postStockMovement(manager, {
          clientId,
          branchId: grnEntity.branch_id,
          itemId: grnItem.item_id,
          quantity: -Math.abs(this.normalizeNumber(line.quantity)),
          transactionType: 'adjustment',
          referenceId: savedReturn.return_number,
          unitCost: this.normalizeMoney(grnItem.unit_cost),
          movementDate: returnDate,
        });

        const returnItem = manager.create(GoodsReceiptReturnItem, {
          return_id: savedReturn.id,
          client_id: clientId,
          grn_item_id: grnItem.id,
          item_id: grnItem.item_id,
          returned_quantity: Math.abs(this.normalizeNumber(line.quantity)),
          unit_cost: this.normalizeMoney(posted.ledgerEntry.unit_cost || grnItem.unit_cost),
          line_total: this.normalizeMoney(
            Math.abs(this.normalizeNumber(line.quantity))
            * this.normalizeMoney(posted.ledgerEntry.unit_cost || grnItem.unit_cost),
          ),
          notes: dto.items.find((item) => Number(item.grn_item_id) === grnItem.id)?.notes?.trim() || null,
        });
        await manager.save(returnItem);
      }

      return savedReturn.id;
    });

    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1300',
      'Raw Materials Inventory',
      'asset',
    );
    const offsetAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      grnEntity.payable_status === 'bill_received' ? '2100' : '2110',
      grnEntity.payable_status === 'bill_received' ? 'Accounts Payable' : 'Goods Received Not Invoiced',
      'liability',
    );

    if (returnTotalAmount > 0) {
      await this.accountingService.createJournalEntry(clientId, grnEntity.branch_id, {
        transaction_date: returnDate,
        description: `${grnEntity.grn_number} Purchase Return`,
        reference_id: debitNoteReference || `RTN-${returnId}`,
        source_module: 'inventory',
        source_entity_type: 'goods_receipt_return',
        source_entity_id: String(returnId),
        source_event: 'grn_purchase_return',
        posting_type: 'auto',
        items: [
          { account_id: offsetAccount.id, debit: returnTotalAmount, credit: 0 },
          { account_id: inventoryAccount.id, debit: 0, credit: returnTotalAmount },
        ],
      });
    }

    await this.operationalAuditService.log({
      user: user ?? this.buildSystemUser(clientId, grnEntity.branch_id),
      action: 'Purchase Return Posted',
      entity: 'goods_receipt_returns',
      clientId,
      branchId: grnEntity.branch_id,
      entityId: returnId,
      details: `Posted purchase return against ${grnEntity.grn_number}`,
      metadata: {
        grn_id: grnEntity.id,
        grn_number: grnEntity.grn_number,
        return_date: returnDate.toISOString(),
        debit_note_reference: debitNoteReference,
        total_amount: returnTotalAmount,
        line_count: requestedLines.length,
        payable_status: grnEntity.payable_status,
      },
    });

    return this.getGoodsReceipt(clientId, grnId, accessibleBranchIds);
  }

  async adjustStock(
    clientId: string,
    branchId: number,
    dto: AdjustStockDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'adjust inventory');
    const item = await this.assertItemBelongsToClient(clientId, dto.item_id);

    const [adjustmentLine] = await this.normalizeMovementLinesToBase(clientId, [{
      item_id: dto.item_id,
      quantity: dto.quantity,
      unit_cost: 0,
      uom: dto.uom,
    }]);
    if (!adjustmentLine) {
      throw new BadRequestException('Adjustment quantity must be non-zero.');
    }
    const quantity = this.normalizeNumber(adjustmentLine?.quantity);
    if (Math.abs(quantity) < 0.0001) {
      throw new BadRequestException('Adjustment quantity must be non-zero.');
    }

    const transactionType = this.normalizeTransactionType(dto.type);
    if (transactionType === 'wastage' && quantity > 0) {
      throw new BadRequestException('Wastage and damage entries must reduce stock.');
    }

    const stockLevel = await this.levelRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, item_id: dto.item_id },
    });
    const availableQuantity = this.normalizeNumber(stockLevel?.current_quantity);
    const estimatedUnitCost = this.normalizeMoney(stockLevel?.last_unit_cost);
    const estimatedAmount = this.normalizeMoney(Math.abs(quantity) * estimatedUnitCost);
    const normalizedReason = String(dto.reason || '').trim().toUpperCase();

    if (transactionType === 'wastage') {
      if (!normalizedReason) {
        throw new BadRequestException('Wastage reason is required.');
      }
      if (Math.abs(quantity) - availableQuantity > 0.0001) {
        throw new BadRequestException(
          `Wastage quantity exceeds available stock. Available ${availableQuantity.toFixed(4)}, requested ${Math.abs(quantity).toFixed(4)}.`,
        );
      }
      if (normalizedReason === 'OTHER' && !dto.notes?.trim()) {
        throw new BadRequestException('Detailed notes are required when wastage reason is OTHER.');
      }
      if (estimatedAmount >= HIGH_VALUE_WASTAGE_THRESHOLD) {
        const hasApprovalPermission = this.hasEffectivePermission(
          user,
          APP_PERMISSIONS.INVENTORY.WASTAGE_APPROVE,
        );
        if (!hasApprovalPermission && !hasBranchApprovalAuthority(user, branchId)) {
          throw new ForbiddenException(
            `Wastage entries valued at PKR ${HIGH_VALUE_WASTAGE_THRESHOLD.toLocaleString()} or above require wastage approval authority.`,
          );
        }
        if (!dto.notes?.trim()) {
          throw new BadRequestException('High-value wastage requires notes describing the incident.');
        }
      }
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const posted = await this.postStockMovement(manager, {
        clientId,
        branchId,
        itemId: dto.item_id,
        quantity,
        transactionType,
        referenceId: dto.reason || dto.notes || `${transactionType}:${item.id}`,
        unitCost: 0,
      });

      return {
        item_id: dto.item_id,
        item_name: item.item_name,
        quantity,
        transaction_type: transactionType,
        stock_level: posted.stockLevel,
        ledger_entry: posted.ledgerEntry,
      };
    });

    const wastageAmount = this.normalizeMoney(
      Math.abs(this.normalizeNumber(result.ledger_entry.quantity))
      * this.normalizeMoney(result.ledger_entry.unit_cost),
    );
    if (transactionType === 'wastage' && wastageAmount > 0) {
      const wastageExpenseAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '5500',
        'Inventory Wastage',
        'expense',
      );
      const inventoryAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '1300',
        'Raw Materials Inventory',
        'asset',
      );

      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: new Date(),
        description: `Inventory wastage - ${item.item_name}`,
        reference_id: result.ledger_entry.reference_id,
        source_module: 'inventory',
        source_entity_type: 'stock_ledger',
        source_entity_id: String(result.ledger_entry.id),
        source_event: 'wastage',
        posting_type: 'auto',
        items: [
          { account_id: wastageExpenseAccount.id, debit: wastageAmount, credit: 0 },
          { account_id: inventoryAccount.id, debit: 0, credit: wastageAmount },
        ],
      });
    }

    await this.operationalAuditService.log({
      user: user ?? this.buildSystemUser(clientId, branchId),
      action: transactionType === 'wastage' ? 'Inventory Wastage Posted' : 'Inventory Adjustment',
      entity: 'inventory_stock_ledger',
      clientId,
      branchId,
      entityId: dto.item_id,
      details: dto.reason || dto.notes || 'Manual stock adjustment',
      metadata: {
        item_id: dto.item_id,
        item_name: item.item_name,
        quantity,
        transaction_type: transactionType,
        reason: dto.reason || null,
        estimated_amount: estimatedAmount,
        approval_threshold: transactionType === 'wastage' ? HIGH_VALUE_WASTAGE_THRESHOLD : null,
        high_value_wastage: transactionType === 'wastage' ? estimatedAmount >= HIGH_VALUE_WASTAGE_THRESHOLD : false,
      },
    });

    return {
      ...result,
      control: {
        estimated_amount: estimatedAmount,
        approval_threshold: transactionType === 'wastage' ? HIGH_VALUE_WASTAGE_THRESHOLD : null,
        high_value_wastage: transactionType === 'wastage' ? estimatedAmount >= HIGH_VALUE_WASTAGE_THRESHOLD : false,
      },
      stock_level: {
        ...result.stock_level,
        current_quantity: this.normalizeNumber(result.stock_level.current_quantity),
        last_unit_cost: this.normalizeMoney(result.stock_level.last_unit_cost),
      },
    };
  }

  async issueToKitchen(
    clientId: string,
    branchId: number,
    dto: IssueToKitchenDto,
    user?: JwtPayload,
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'issue inventory to kitchen');
    const issueDate = this.normalizeOptionalDate(dto.issue_date, 'issue_date') ?? new Date();
    const issueReference = [
      'ISS',
      String(branch.branch_code || branch.id || 'BR').trim().toUpperCase(),
      issueDate.toISOString().slice(0, 10).replace(/-/g, ''),
      String(Date.now()).slice(-6),
    ].join('-');

    const issueLines = (await this.normalizeMovementLinesToBase(
      clientId,
      (dto.items ?? []).map((item) => ({
        item_id: item.item_id,
        quantity: -Math.abs(this.normalizeNumber(item.quantity)),
        unit_cost: 0,
        uom: item.uom,
      })),
    )).filter((item) => Math.abs(item.quantity) > 0.0001);

    if (issueLines.length === 0) {
      throw new BadRequestException('At least one positive issue quantity is required.');
    }

    const issuedTo = dto.issue_to?.trim() || 'Kitchen';
    const issuanceType = dto.issuance_type === 'auto' ? 'auto' : 'manual';
    const notes = dto.notes?.trim() || null;
    const issuedByName = dto.issued_by_name?.trim() || this.buildActorName(user);

    const postedLines = await this.dataSource.transaction(async (manager) => {
      const rows: Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        unit_cost: number;
        line_total: number;
        current_quantity: number;
        ledger_entry_id: number;
      }> = [];

      for (const line of issueLines) {
        const posted = await this.postStockMovement(manager, {
          clientId,
          branchId,
          itemId: line.item_id,
          quantity: line.quantity,
          transactionType: 'production',
          referenceId: issueReference,
          unitCost: 0,
          movementDate: issueDate,
        });

        rows.push({
          item_id: line.item_id,
          item_name: posted.item.item_name,
          quantity: Math.abs(this.normalizeNumber(posted.ledgerEntry.quantity)),
          unit_cost: this.normalizeMoney(posted.ledgerEntry.unit_cost),
          line_total: this.normalizeMoney(
            Math.abs(this.normalizeNumber(posted.ledgerEntry.quantity))
            * this.normalizeMoney(posted.ledgerEntry.unit_cost),
          ),
          current_quantity: this.normalizeNumber(posted.stockLevel.current_quantity),
          ledger_entry_id: posted.ledgerEntry.id,
        });
      }

      return rows;
    });

    const totalQuantity = this.normalizeNumber(
      postedLines.reduce((sum, line) => sum + this.normalizeNumber(line.quantity), 0),
    );
    const totalCost = this.normalizeMoney(
      postedLines.reduce((sum, line) => sum + this.normalizeMoney(line.line_total), 0),
    );

    await this.operationalAuditService.log({
      user: user ?? this.buildSystemUser(clientId, branchId),
      action: 'Inventory Issued to Kitchen',
      entity: 'inventory_stock_ledger',
      clientId,
      branchId,
      entityId: issueReference,
      details: `Posted kitchen issue ${issueReference}`,
      metadata: {
        issue_reference: issueReference,
        issue_to: issuedTo,
        issuance_type: issuanceType,
        issue_date: issueDate.toISOString(),
        issued_by_name: issuedByName,
        notes,
        line_count: postedLines.length,
        total_quantity: totalQuantity,
        total_cost: totalCost,
      },
    });

    return {
      reference_id: issueReference,
      branch_id: branchId,
      issue_to: issuedTo,
      issuance_type: issuanceType,
      issue_date: issueDate,
      issued_by_name: issuedByName,
      notes,
      line_count: postedLines.length,
      total_quantity: totalQuantity,
      total_cost: totalCost,
      items: postedLines,
    };
  }

  async getBranchStock(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const levels = await this.levelRepo
      .createQueryBuilder('level')
      .leftJoinAndSelect('level.item', 'item')
      .leftJoinAndMapOne(
        'level.branch_inventory',
        BranchInventory,
        'branch_inventory',
        'branch_inventory.branch_id = level.branch_id AND branch_inventory.item_id = level.item_id',
      )
      .where('level.client_id = :clientId', { clientId })
      .andWhere('level.branch_id = :branchId', { branchId })
      .orderBy('item.item_name', 'ASC')
      .getMany();

    return levels.map((level: any) => {
      const currentQuantity = this.normalizeNumber(level.current_quantity);
      const unitCost = this.normalizeMoney(level.last_unit_cost);
      return ({
      id: level.id,
      client_id: level.client_id,
      branch_id: level.branch_id,
      item_id: level.item_id,
      current_quantity: currentQuantity,
      last_unit_cost: unitCost,
      stock_value: this.normalizeMoney(currentQuantity * unitCost),
      last_received_at: level.last_received_at,
      updated_at: level.updated_at,
      item: level.item,
      min_level: level.branch_inventory?.min_stock_level ?? 0,
      max_level: level.branch_inventory?.max_stock_level ?? 0,
      is_enabled: level.branch_inventory?.is_enabled ?? true,
      });
    });
  }

  async getStockLedger(
    clientId: string,
    branchId: number,
    filters?: StockLedgerFilters,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    if (filters?.itemId) {
      await this.assertItemBelongsToClient(clientId, filters.itemId);
    }

    const limit = this.normalizeLimit(filters?.limit, 200, 500);
    const rows = await this.buildStockLedgerQuery(clientId, branchId, filters)
      .orderBy('ledger.created_at', 'DESC')
      .addOrderBy('ledger.id', 'DESC')
      .take(limit)
      .getMany();

    const issueMetadataByReference = await this.loadKitchenIssueMetadataForRows(clientId, branchId, rows);
    return rows.map((row) => this.mapStockLedgerRow(row, issueMetadataByReference));
  }

  async getStockLedgerPage(
    clientId: string,
    branchId: number,
    filters?: StockLedgerFilters,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    if (filters?.itemId) {
      await this.assertItemBelongsToClient(clientId, filters.itemId);
    }

    const limit = this.normalizeLimit(filters?.limit, 25, 200);
    const offset = this.normalizeOffset(filters?.offset);
    const [rows, total] = await this.buildStockLedgerQuery(clientId, branchId, filters)
      .orderBy('ledger.created_at', 'DESC')
      .addOrderBy('ledger.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const issueMetadataByReference = await this.loadKitchenIssueMetadataForRows(clientId, branchId, rows);

    return {
      items: rows.map((row) => this.mapStockLedgerRow(row, issueMetadataByReference)),
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
    };
  }

  async depleteStock(
    clientId: string,
    branchId: number,
    dto: {
      reference_id: string;
      items: { item_id: number; quantity: number }[];
      source_type?: string;
      source_id?: string | number;
      posted_by?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'deplete inventory');

    const items = this.aggregateMovementItems(
      dto.items.map((item) => ({
        item_id: item.item_id,
        quantity: -Math.abs(this.normalizeNumber(item.quantity)),
        unit_cost: 0,
      })),
    );

    if (items.length === 0) {
      return [];
    }

    for (const item of items) {
      await this.assertItemBelongsToClient(clientId, item.item_id);
    }

    const results = await this.dataSource.transaction(async (manager) => {
      const consumption = manager.create(InventoryConsumption, {
        client_id: clientId,
        branch_id: branchId,
        source_type: dto.source_type || 'POS Sale',
        source_id: String(dto.source_id ?? dto.reference_id),
        posted_by: dto.posted_by ?? null,
        posted_at: new Date(),
        total_cost: 0,
        metadata: dto.metadata ?? null,
      });
      const savedConsumption = await manager.save(consumption);

      const output: Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        unit_cost: number;
        extended_cost: number;
        consumption_id: number;
        stock_level: StockLevel;
        ledger_entry: StockLedger;
      }> = [];

      for (const item of items) {
        const posted = await this.postStockMovement(manager, {
          clientId,
          branchId,
          itemId: item.item_id,
          quantity: item.quantity,
          transactionType: 'sale',
          referenceId: dto.reference_id,
          unitCost: 0,
        });
        const extendedCost = this.normalizeMoney(
          Math.abs(this.normalizeNumber(item.quantity)) * this.normalizeMoney(posted.ledgerEntry.unit_cost),
        );
        await manager.save(manager.create(InventoryConsumptionLine, {
          consumption_id: savedConsumption.id,
          item_id: item.item_id,
          item_name: posted.item.item_name,
          quantity: Math.abs(this.normalizeNumber(item.quantity)),
          uom: posted.item.uom_base ?? null,
          unit_cost: this.normalizeMoney(posted.ledgerEntry.unit_cost),
          total_cost: extendedCost,
          ledger_id: posted.ledgerEntry.id,
        }));
        output.push({
          item_id: item.item_id,
          item_name: posted.item.item_name,
          quantity: Math.abs(this.normalizeNumber(item.quantity)),
          unit_cost: this.normalizeMoney(posted.ledgerEntry.unit_cost),
          extended_cost: extendedCost,
          consumption_id: savedConsumption.id,
          stock_level: posted.stockLevel,
          ledger_entry: posted.ledgerEntry,
        });
      }

      savedConsumption.total_cost = this.normalizeMoney(
        output.reduce((sum, line) => sum + line.extended_cost, 0),
      );
      await manager.save(savedConsumption);
      return output;
    });

    await this.operationalAuditService.log({
      user: this.buildSystemUser(clientId, branchId),
      action: 'Inventory Depletion',
      entity: 'inventory_stock_ledger',
      clientId,
      branchId,
      portal: 'Terminal',
      details: `Depleted stock for ${dto.reference_id}`,
      metadata: {
        reference_id: dto.reference_id,
        item_count: items.length,
      },
    });

    return results;
  }

  async consumeStock(
    clientId: string,
    branchId: number,
    dto: {
      source_type?: string;
      source_id?: string | number;
      reference_id?: string;
      posted_by?: string | null;
      items: { item_id: number; quantity: number; uom?: string }[];
      metadata?: Record<string, unknown> | null;
    },
    user?: JwtPayload,
  ) {
    const referenceId = dto.reference_id?.trim()
      || `${String(dto.source_type || 'Manual').replace(/\s+/g, '-').toUpperCase()}-${dto.source_id || Date.now()}`;
    const normalized = await this.normalizeMovementLinesToBase(
      clientId,
      dto.items.map((item) => ({
        item_id: item.item_id,
        quantity: Math.abs(this.normalizeNumber(item.quantity)),
        unit_cost: 0,
        uom: item.uom,
      })),
    );

    const results = await this.depleteStock(clientId, branchId, {
      reference_id: referenceId,
      source_type: dto.source_type || 'Manual',
      source_id: dto.source_id ?? referenceId,
      posted_by: dto.posted_by ?? this.buildActorName(user),
      items: normalized.map((item) => ({ item_id: item.item_id, quantity: Math.abs(item.quantity) })),
      metadata: dto.metadata ?? null,
    });

    return {
      reference_id: referenceId,
      branch_id: branchId,
      total_cost: this.normalizeMoney(results.reduce((sum, line) => sum + line.extended_cost, 0)),
      items: results,
    };
  }

  async postWaste(
    clientId: string,
    branchId: number,
    dto: {
      waste_type: string;
      reason?: string;
      approved_by?: string;
      waste_date?: string;
      items: { item_id: number; quantity: number; uom?: string }[];
    },
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'post wastage');
    const wasteDate = this.normalizeOptionalDate(dto.waste_date, 'waste_date') ?? new Date();
    const wasteType = dto.waste_type?.trim() || 'Damage';
    const referenceId = `WASTE-${branchId}-${Date.now()}`;
    const lines = await this.normalizeMovementLinesToBase(
      clientId,
      dto.items.map((item) => ({
        item_id: item.item_id,
        quantity: -Math.abs(this.normalizeNumber(item.quantity)),
        uom: item.uom,
        unit_cost: 0,
      })),
    );
    if (lines.length === 0) {
      throw new BadRequestException('At least one waste line is required.');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const waste = await manager.save(manager.create(InventoryWaste, {
        client_id: clientId,
        branch_id: branchId,
        waste_date: wasteDate,
        waste_type: wasteType,
        reason: dto.reason?.trim() || null,
        approved_by: dto.approved_by?.trim() || this.buildActorName(user),
        total_cost: 0,
      }));
      const postedLines: InventoryWasteLine[] = [];
      for (const line of lines) {
        const posted = await this.postStockMovement(manager, {
          clientId,
          branchId,
          itemId: line.item_id,
          quantity: line.quantity,
          transactionType: 'wastage',
          referenceId,
          unitCost: 0,
          movementDate: wasteDate,
        });
        const cost = this.normalizeMoney(Math.abs(line.quantity) * this.normalizeMoney(posted.ledgerEntry.unit_cost));
        postedLines.push(await manager.save(manager.create(InventoryWasteLine, {
          waste_id: waste.id,
          item_id: line.item_id,
          item_name: posted.item.item_name,
          quantity: Math.abs(line.quantity),
          uom: posted.item.uom_base ?? null,
          unit_cost: this.normalizeMoney(posted.ledgerEntry.unit_cost),
          cost,
          ledger_id: posted.ledgerEntry.id,
        })));
      }
      waste.total_cost = this.normalizeMoney(postedLines.reduce((sum, line) => sum + Number(line.cost || 0), 0));
      await manager.save(waste);
      return { ...waste, lines: postedLines };
    });

    await this.operationalAuditService.log({
      user: user ?? this.buildSystemUser(clientId, branchId),
      action: 'Inventory Waste Posted',
      entity: 'inventory_waste',
      clientId,
      branchId,
      entityId: result.id,
      details: dto.reason || wasteType,
      metadata: { waste_type: wasteType, reference_id: referenceId, total_cost: result.total_cost },
    });

    return result;
  }

  async getInventoryDashboard(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      stockRows,
      branchInventoryRows,
      recentLedger,
      recentGrns,
      poBacklog,
      grnToday,
    ] = await Promise.all([
      this.getBranchStock(clientId, branchId),
      this.branchInventoryRepo.find({
        where: { branch_id: branchId, is_enabled: true },
      }),
      this.getStockLedger(clientId, branchId, { limit: 8 }),
      this.grnRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        relations: ['vendor', 'purchase_order', 'items', 'items.item'],
        order: { receipt_date: 'DESC' },
        take: 5,
      }),
      this.poRepo.find({
        where: [
          { client_id: clientId, branch_id: branchId },
          { client_id: clientId, destination_branch_id: branchId },
        ],
        relations: ['vendor', 'branch', 'destination_branch'],
        order: { updated_at: 'DESC' },
        take: 20,
      }),
      this.grnRepo
        .createQueryBuilder('grn')
        .leftJoin('grn.items', 'item')
        .select('COUNT(grn.id)', 'grn_count')
        .addSelect('COALESCE(SUM(item.line_total), 0)', 'grn_value')
        .where('grn.client_id = :clientId', { clientId })
        .andWhere('grn.branch_id = :branchId', { branchId })
        .andWhere('grn.receipt_date >= :todayStart', { todayStart })
        .getRawOne(),
    ]);

    const enabledItemCount = branchInventoryRows.length;
    const lowStockItems = stockRows.filter((row) => Number(row.min_level || 0) > 0 && Number(row.current_quantity) <= Number(row.min_level));
    const criticalItems = stockRows.filter((row) => Number(row.current_quantity) <= 0);
    const todayIssues = recentLedger.filter(
      (row) =>
        ['sale', 'wastage', 'adjustment', 'production'].includes(row.transaction_type)
        && new Date(row.created_at) >= todayStart,
    );

    return {
      branch_id: branchId,
      summary: {
        enabled_item_count: enabledItemCount,
        tracked_stock_count: stockRows.length,
        on_hand_quantity: this.normalizeNumber(
          stockRows.reduce((sum, row) => sum + Number(row.current_quantity || 0), 0),
        ),
        stock_value: this.normalizeMoney(
          stockRows.reduce((sum, row) => sum + Number(row.stock_value || 0), 0),
        ),
        low_stock_count: lowStockItems.length,
        critical_stock_count: criticalItems.length,
        today_grn_count: Number(grnToday?.grn_count || 0),
        today_grn_value: this.normalizeMoney(grnToday?.grn_value || 0),
        today_issue_count: todayIssues.length,
      },
      procurement: {
        pending_approval: poBacklog.filter((po) => po.approval_status === 'pending').length,
        awaiting_receipt: poBacklog.filter(
          (po) => po.status === 'sent' && po.approval_status !== 'rejected',
        ).length,
      },
      low_stock: lowStockItems
        .sort((left, right) => Number(left.current_quantity) - Number(right.current_quantity))
        .slice(0, 5),
      recent_movements: recentLedger.slice(0, 6),
      recent_grns: recentGrns.map((grn) => this.mapGoodsReceipt(grn)),
    };
  }

  async listConsumption(
    clientId: string,
    branchId: number,
    filters?: { date_from?: string; date_to?: string; source_type?: string; limit?: number },
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const query = this.consumptionRepo
      .createQueryBuilder('consumption')
      .leftJoinAndSelect('consumption.lines', 'line')
      .leftJoinAndSelect('line.item', 'item')
      .where('consumption.client_id = :clientId', { clientId })
      .andWhere('consumption.branch_id = :branchId', { branchId });

    const { start, end } = this.resolveFilterDateRange(filters);
    if (start) {
      query.andWhere('consumption.posted_at >= :start', { start });
    }
    if (end) {
      query.andWhere('consumption.posted_at <= :end', { end });
    }
    if (filters?.source_type) {
      query.andWhere('consumption.source_type = :sourceType', { sourceType: filters.source_type });
    }

    const rows = await query
      .orderBy('consumption.posted_at', 'DESC')
      .addOrderBy('line.id', 'ASC')
      .take(this.normalizeLimit(filters?.limit, 100, 500))
      .getMany();

    return rows.map((row) => ({
      ...row,
      total_cost: this.normalizeMoney(row.total_cost),
      lines: (row.lines ?? []).map((line) => ({
        ...line,
        quantity: this.normalizeNumber(line.quantity),
        unit_cost: this.normalizeMoney(line.unit_cost),
        total_cost: this.normalizeMoney(line.total_cost),
      })),
    }));
  }

  async getVarianceReport(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const sessions = await this.dataSource
      .getRepository(InventoryCountSession)
      .createQueryBuilder('session')
      .leftJoin('inventory_count_session_items', 'line', 'line.session_id = session.id')
      .select('session.id', 'count_id')
      .addSelect('session.session_code', 'count_number')
      .addSelect('session.business_date', 'count_date')
      .addSelect('session.status', 'status')
      .addSelect('COUNT(line.id)', 'line_count')
      .addSelect('COALESCE(SUM(ABS(line.variance_quantity)), 0)', 'variance_quantity')
      .addSelect('COALESCE(SUM(ABS(line.variance_value)), 0)', 'variance_cost')
      .where('session.client_id = :clientId', { clientId })
      .andWhere('session.branch_id = :branchId', { branchId })
      .groupBy('session.id')
      .orderBy('session.business_date', 'DESC')
      .limit(50)
      .getRawMany();

    return {
      branch_id: branchId,
      rows: sessions.map((row) => ({
        count_id: Number(row.count_id),
        count_number: row.count_number,
        count_date: row.count_date,
        status: row.status,
        line_count: Number(row.line_count || 0),
        variance_quantity: this.normalizeNumber(row.variance_quantity),
        variance_cost: this.normalizeMoney(row.variance_cost),
      })),
    };
  }
}
