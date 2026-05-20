import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Vendor } from '../../inventory/entities/vendor.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../../inventory/entities/branch-inventory.entity';
import {
  CreatePurchaseOrderDto,
  ListPurchaseOrdersQueryDto,
  UpdatePurchaseOrderApprovalDto,
} from '../dto/inventory-op.dto';
import {
  type ProcurementMode,
  type ProcurementApprovalScope,
  type ProcurementContext,
  type PurchaseOrderApprovalStatus,
} from '../procurement.constants';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestsService } from '../procurement-requests/procurement-requests.service';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import {
  hasBranchApprovalAuthority,
  hasCentralApprovalAuthority,
  hasExplicitApprovalAuthorityConfig,
  resolveActorId,
} from '../../auth/request-context.util';
import { assertBranchOperationalWriteAllowed } from '../../setup/branches/branch-control.types';
import { GoodsReceiptNote } from '../entities/goods-receipt-note.entity';
import { GoodsReceiptNoteItem } from '../entities/goods-receipt-note-item.entity';
import { ClientSettings } from '../../platform/entities/client-settings.entity';
import { createDefaultClientNumberingSettings, type BranchDocumentRule } from '../../setup/branches/branch-config.types';
import { nextBranchDocumentNumber } from '../../setup/branches/branch-document.util';
import { ApprovalsService } from '../../approvals/approvals.service';
import { UomConversionService } from '../../common/uom-conversion.service';

type PurchaseOrderQuantitySummary = {
  quantityTotal: number;
  lineCount: number;
};

@Injectable()
export class PurchaseOrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(ProcurementRequest)
    private readonly procurementRequestRepo: Repository<ProcurementRequest>,
    @InjectRepository(GoodsReceiptNote)
    private readonly grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptNoteItem)
    private readonly grnItemRepo: Repository<GoodsReceiptNoteItem>,
    private readonly procurementRequestsService: ProcurementRequestsService,
    private readonly approvalsService: ApprovalsService,
    private readonly dataSource: DataSource,
    private readonly uomConversionService: UomConversionService,
  ) {}

  async onModuleInit() {
    await this.backfillLegacyPurchaseOrderColumns();
  }

  private normalizeNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed);
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

  private resolveFilterDateRange(filters?: { date_from?: string; date_to?: string }) {
    const start = filters?.date_from ? new Date(`${filters.date_from}T00:00:00.000`) : null;
    const end = filters?.date_to ? new Date(`${filters.date_to}T23:59:59.999`) : null;

    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new BadRequestException('Invalid purchase order date filter.');
    }
    if (start && end && start > end) {
      throw new BadRequestException('date_from cannot be after date_to.');
    }

    return { start, end };
  }

  private mapLegacyStatusToCanonical(status?: string): string | undefined {
    if (!status) return undefined;
    return status === 'ordered' ? 'sent' : status;
  }

  private mapCanonicalStatusToLegacy(status?: string): string | undefined {
    if (!status) return undefined;
    return status === 'sent' ? 'ordered' : status;
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

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private getDestinationBranchId(po: PurchaseOrder): number {
    return po.destination_branch_id ?? po.branch_id;
  }

  private normalizePoDto(dto: CreatePurchaseOrderDto): CreatePurchaseOrderDto {
    const normalized = { ...dto };
    normalized.expected_delivery_date =
      normalized.expected_delivery_date ?? normalized.expected_date ?? undefined;
    normalized.total_amount =
      normalized.total_amount ?? normalized.total_cost ?? undefined;
    normalized.status =
      (this.mapLegacyStatusToCanonical(normalized.status ?? normalized.po_status) ?? 'draft') as CreatePurchaseOrderDto['status'];
    normalized.po_number = normalized.po_number ?? undefined;
    normalized.notes = normalized.notes ?? undefined;
    normalized.branch_id = normalized.branch_id ?? undefined;
    normalized.destination_branch_id =
      normalized.destination_branch_id ?? normalized.branch_id ?? undefined;
    normalized.procurement_mode =
      normalized.procurement_mode ?? (
        normalized.destination_branch_id && normalized.branch_id && normalized.destination_branch_id !== normalized.branch_id
          ? 'central_procurement'
          : 'branch_direct'
      );
    normalized.procurement_context = normalized.procurement_context ?? undefined;
    normalized.approval_scope = normalized.approval_scope ?? undefined;
    normalized.approval_status =
      normalized.approval_status ?? (
        normalized.procurement_request_id || normalized.procurement_mode !== 'branch_direct'
          ? 'pending'
          : 'not_required'
      );
    normalized.destination_store_label = normalized.destination_store_label ?? undefined;
    normalized.approval_notes = normalized.approval_notes ?? undefined;
    return normalized;
  }

  private async normalizePurchaseLineToBase(
    clientId: string,
    itemDto: { item_id: number; quantity: number; unit_cost: number; uom?: string },
  ) {
    const item = await this.itemRepo.findOne({
      where: { id: itemDto.item_id, client_id: clientId, item_is_active: true },
    });
    if (!item) {
      throw new BadRequestException(`Item ${itemDto.item_id} is inactive or does not belong to this client`);
    }
    const inputUom = itemDto.uom || item.uom_purchase || item.uom_base;
    const inputQuantity = this.normalizeNumber(itemDto.quantity);
    const baseQuantity = this.uomConversionService.toBase(inputQuantity, inputUom, item.uom_base).base_quantity;
    const inputLineTotal = this.normalizeNumber(inputQuantity * this.normalizeNumber(itemDto.unit_cost));
    return {
      item_id: itemDto.item_id,
      quantity: baseQuantity,
      unit_cost: baseQuantity > 0 ? this.normalizeNumber(inputLineTotal / baseQuantity) : 0,
      line_total: inputLineTotal,
      input_quantity: inputQuantity,
      input_uom: inputUom,
      base_uom: item.uom_base,
    };
  }

  private async generatePurchaseOrderNumber(clientId: string, branch: Branch): Promise<string> {
    const settings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });
    const defaults = createDefaultClientNumberingSettings().rules.purchase_order;
    const rule: BranchDocumentRule = {
      ...defaults,
      ...(branch.document_settings?.purchase_order ?? {}),
      ...(settings?.numbering_settings?.rules?.purchase_order ?? {}),
    };
    return nextBranchDocumentNumber({
      repository: this.poRepo,
      alias: 'po',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code,
      rule,
      documentColumn: 'po_number',
    });
  }

  private resolveProcurementContext(
    requestingBranch: Branch,
    destinationBranch: Branch,
    requestedContext?: ProcurementContext,
  ): ProcurementContext {
    if (requestedContext) {
      if (
        requestedContext === 'branch_procurement' &&
        (
          requestingBranch.inventory_store_type === 'central' ||
          destinationBranch.id !== requestingBranch.id
        )
      ) {
        throw new BadRequestException(
          'Branch procurement purchase orders must buy directly for the same branch destination.',
        );
      }

      if (
        requestedContext === 'branch_requisition' &&
        requestingBranch.inventory_store_type === 'central'
      ) {
        throw new BadRequestException(
          'Central branches cannot use branch requisition purchase context.',
        );
      }

      if (
        requestedContext === 'central_procurement' &&
        requestingBranch.inventory_store_type !== 'central'
      ) {
        throw new BadRequestException(
          'Central procurement purchase orders must originate from a central branch.',
        );
      }

      return requestedContext;
    }

    if (requestingBranch.inventory_store_type === 'central') {
      return 'central_procurement';
    }

    if (requestingBranch.id === destinationBranch.id) {
      return 'branch_procurement';
    }

    return 'branch_requisition';
  }

  private resolveApprovalScope(
    context: ProcurementContext,
    requestedScope?: ProcurementApprovalScope,
  ): ProcurementApprovalScope {
    const defaultScope = context === 'branch_procurement' ? 'branch' : 'central';

    if (!requestedScope) {
      return defaultScope;
    }

    if (context === 'branch_procurement' && requestedScope !== 'branch') {
      throw new BadRequestException('Branch procurement purchase orders must use branch approval scope.');
    }

    if (context !== 'branch_procurement' && requestedScope !== 'central') {
      throw new BadRequestException('Centralized procurement purchase orders must use central approval scope.');
    }

    return requestedScope;
  }

  private resolveCompatibilityMode(
    context: ProcurementContext,
    requestingBranchId: number,
    destinationBranchId: number,
    requestedMode?: ProcurementMode,
  ): ProcurementMode {
    if (requestedMode === 'hybrid') {
      return 'hybrid';
    }

    if (context === 'branch_procurement' && requestingBranchId === destinationBranchId) {
      return 'branch_direct';
    }

    return 'central_procurement';
  }

  private resolveReceiptRoute(destinationBranch?: Pick<Branch, 'inventory_store_type'> | null) {
    return destinationBranch?.inventory_store_type === 'central'
      ? 'vendor_to_central'
      : 'vendor_to_branch';
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId?: number,
    operation?: string,
  ): Promise<Branch> {
    if (!branchId) {
      throw new BadRequestException('branch_id is required for purchase orders');
    }

    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private async assertBranchAccess(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    branchId: number,
    label: string,
  ): Promise<void> {
    if (await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) {
      return;
    }

    if (!this.hasBranchAccess(accessibleBranchIds, branchId)) {
      throw new ForbiddenException(`You do not have access to the ${label} branch.`);
    }
  }

  private async assertApprovalAuthority(
    clientId: string,
    approvalScope: ProcurementApprovalScope,
    user: JwtPayload | undefined,
    accessibleBranchIds: number[] | undefined,
    branchId: number,
  ): Promise<void> {
    if (approvalScope === 'branch') {
      if (hasExplicitApprovalAuthorityConfig(user)) {
        if (!hasBranchApprovalAuthority(user, branchId)) {
          throw new ForbiddenException('You do not have branch approval authority for this purchase order.');
        }
        return;
      }

      if (!this.hasBranchAccess(accessibleBranchIds, branchId)) {
        throw new ForbiddenException('You do not have branch approval access for this purchase order.');
      }
      return;
    }

    if (hasExplicitApprovalAuthorityConfig(user)) {
      if (hasCentralApprovalAuthority(user)) {
        return;
      }

      throw new ForbiddenException(
        'Central procurement approval requires explicit central approval authority.',
      );
    }

    if (await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) {
      return;
    }

    throw new ForbiddenException(
      'Central procurement approval requires access to a central store branch.',
    );
  }

  private async assertVendorBelongsToClient(clientId: string, vendorId?: number | null): Promise<void> {
    if (!vendorId) {
      return;
    }

    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId, client_id: clientId } });
    if (!vendor || vendor.is_active === false) {
      throw new BadRequestException(`Vendor ${vendorId} does not belong to this client`);
    }
  }

  private async assertItemsBelongToClient(clientId: string, itemIds: number[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const uniqueItemIds = [...new Set(itemIds)];
    const count = await this.itemRepo.count({
      where: uniqueItemIds.map((itemId) => ({
        id: itemId,
        client_id: clientId,
        item_is_active: true,
      })),
    });

    if (count !== uniqueItemIds.length) {
      throw new BadRequestException('One or more purchase order items are inactive or do not belong to this client');
    }
  }

  private async ensureDestinationOwnership(
    clientId: string,
    branchId: number,
    itemIds: number[],
  ): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const mappings = await this.branchInventoryRepo.find({
      where: itemIds.map((itemId) => ({ branch_id: branchId, item_id: itemId })),
    });
    const enabledItemIds = new Set(
      mappings.filter((mapping) => mapping.is_enabled).map((mapping) => mapping.item_id),
    );

    const missing = itemIds.find((itemId) => !enabledItemIds.has(itemId));
    if (missing) {
      const item = await this.itemRepo.findOne({ where: { id: missing, client_id: clientId } });
      throw new BadRequestException(
        `Item ${item?.item_name ?? missing} is not enabled for the destination branch.`,
      );
    }
  }

  private async getValidatedProcurementRequest(
    clientId: string,
    requestId: number,
    branchId: number,
    destinationBranchId: number,
    accessibleBranchIds?: number[],
  ): Promise<ProcurementRequest> {
    const request = await this.procurementRequestRepo.findOne({
      where: { id: requestId, client_id: clientId },
      relations: ['items'],
    });

    if (!request) {
      throw new BadRequestException('Linked procurement request was not found.');
    }

    if (
      !(await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) &&
      !this.hasBranchAccess(accessibleBranchIds, request.requesting_branch_id)
    ) {
      throw new ForbiddenException('You do not have access to the linked procurement request.');
    }

    if (request.status !== 'approved') {
      throw new BadRequestException('Only approved procurement requests can be converted to a purchase order.');
    }

    if (request.linked_po_id) {
      throw new BadRequestException('This procurement request has already been converted into a purchase order.');
    }

    if (request.requesting_branch_id !== branchId) {
      throw new BadRequestException('Purchase order branch does not match the procurement request branch.');
    }

    if (request.destination_branch_id !== destinationBranchId) {
      throw new BadRequestException('Purchase order destination does not match the procurement request destination.');
    }

    return request;
  }

  private async loadReceiptProgress(poIds: number[]) {
    if (poIds.length === 0) {
      return {
        receivedByPoItem: new Map<number, Map<number, number>>(),
        summaryByPo: new Map<number, {
          grnCount: number;
          receivedAmount: number;
          billedAmount: number;
          pendingBillAmount: number;
          billedGrnCount: number;
          billReferenceCount: number;
          lastReceiptDate: Date | null;
          lastBillDueDate: Date | null;
        }>(),
      };
    }

    const receiptRows = await this.grnItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.grn', 'grn')
      .select('grn.purchase_order_id', 'po_id')
      .addSelect('item.item_id', 'item_id')
      .addSelect('SUM(item.received_quantity)', 'received_quantity')
      .where('grn.purchase_order_id IN (:...poIds)', { poIds })
      .groupBy('grn.purchase_order_id')
      .addGroupBy('item.item_id')
      .getRawMany();

    const grnRows = await this.grnRepo
      .createQueryBuilder('grn')
      .select('grn.purchase_order_id', 'po_id')
      .leftJoin('grn.items', 'item')
      .addSelect('COUNT(DISTINCT grn.id)', 'grn_count')
      .addSelect('COALESCE(SUM(item.line_total), 0)', 'received_amount')
      .addSelect(
        "COUNT(DISTINCT CASE WHEN grn.payable_status = 'bill_received' THEN grn.id END)",
        'billed_grn_count',
      )
      .addSelect(
        "COUNT(DISTINCT CASE WHEN COALESCE(grn.vendor_bill_reference, grn.vendor_invoice_number) IS NOT NULL AND COALESCE(grn.vendor_bill_reference, grn.vendor_invoice_number) <> '' THEN grn.id END)",
        'bill_reference_count',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN grn.payable_status = 'bill_received' THEN item.line_total ELSE 0 END), 0)",
        'billed_amount',
      )
      .addSelect('MAX(grn.receipt_date)', 'last_receipt_date')
      .addSelect('MAX(grn.vendor_bill_due_date)', 'last_bill_due_date')
      .where('grn.purchase_order_id IN (:...poIds)', { poIds })
      .groupBy('grn.purchase_order_id')
      .getRawMany();

    const receivedByPoItem = new Map<number, Map<number, number>>();
    for (const row of receiptRows) {
      const poId = Number(row.po_id);
      const itemId = Number(row.item_id);
      const receivedQuantity = this.normalizeNumber(row.received_quantity);
      const itemMap = receivedByPoItem.get(poId) ?? new Map<number, number>();
      itemMap.set(itemId, receivedQuantity);
      receivedByPoItem.set(poId, itemMap);
    }

    const summaryByPo = new Map<number, {
      grnCount: number;
      receivedAmount: number;
      billedAmount: number;
      pendingBillAmount: number;
      billedGrnCount: number;
      billReferenceCount: number;
      lastReceiptDate: Date | null;
      lastBillDueDate: Date | null;
    }>();
    for (const row of grnRows) {
      const receivedAmount = this.normalizeNumber(row.received_amount);
      const billedAmount = this.normalizeNumber(row.billed_amount);
      summaryByPo.set(Number(row.po_id), {
        grnCount: Number(row.grn_count),
        receivedAmount,
        billedAmount,
        pendingBillAmount: this.normalizeNumber(Math.max(receivedAmount - billedAmount, 0)),
        billedGrnCount: Number(row.billed_grn_count ?? 0),
        billReferenceCount: Number(row.bill_reference_count ?? 0),
        lastReceiptDate: row.last_receipt_date ? new Date(row.last_receipt_date) : null,
        lastBillDueDate: row.last_bill_due_date ? new Date(row.last_bill_due_date) : null,
      });
    }

    return { receivedByPoItem, summaryByPo };
  }

  private async loadPurchaseOrderQuantityTotals(poIds: number[]): Promise<Map<number, PurchaseOrderQuantitySummary>> {
    if (poIds.length === 0) {
      return new Map<number, PurchaseOrderQuantitySummary>();
    }

    const rows = await this.poItemRepo
      .createQueryBuilder('item')
      .select('item.po_id', 'po_id')
      .addSelect('COUNT(item.id)', 'line_count')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity_total')
      .where('item.po_id IN (:...poIds)', { poIds })
      .groupBy('item.po_id')
      .getRawMany();

    return new Map(
      rows.map((row) => [
        Number(row.po_id),
        {
          lineCount: Number(row.line_count ?? 0),
          quantityTotal: this.normalizeNumber(row.quantity_total),
        },
      ]),
    );
  }

  private mapPurchaseOrder(
    po: PurchaseOrder,
    receiptProgress?: {
      receivedByItem: Map<number, number>;
      summary: {
        grnCount: number;
        receivedAmount: number;
        billedAmount: number;
        pendingBillAmount: number;
        billedGrnCount: number;
        billReferenceCount: number;
        lastReceiptDate: Date | null;
        lastBillDueDate: Date | null;
      };
    },
  ) {
    const items = (po.items ?? []).map((item) => {
      const orderedQuantity = this.normalizeNumber(item.quantity);
      const receivedQuantity = this.normalizeNumber(receiptProgress?.receivedByItem.get(item.item_id));
      const remainingQuantity = this.normalizeNumber(Math.max(orderedQuantity - receivedQuantity, 0));

      return {
      id: item.id,
      item_id: item.item_id,
      item_name: item.item?.item_name ?? `Item #${item.item_id}`,
      item_sku: item.item?.item_sku ?? null,
      quantity: orderedQuantity,
      received_quantity: receivedQuantity,
      remaining_quantity: remainingQuantity,
      unit_cost: this.normalizeNumber(item.unit_cost),
      line_total: this.normalizeNumber(item.line_total),
      };
    });

    const branchSummary = po.branch
      ? {
          id: po.branch.id,
          branch_name: po.branch.branch_name,
          branch_code: po.branch.branch_code,
          inventory_store_type: po.branch.inventory_store_type,
        }
      : null;
    const destinationBranch = po.destination_branch ?? po.branch ?? null;
    const receiptSummary = receiptProgress?.summary ?? {
      grnCount: 0,
      receivedAmount: 0,
      billedAmount: 0,
      pendingBillAmount: 0,
      billedGrnCount: 0,
      billReferenceCount: 0,
      lastReceiptDate: null,
      lastBillDueDate: null,
    };
    const fullyReceived = items.length > 0 && items.every((item) => item.remaining_quantity <= 0.0001);
    const partiallyReceived = items.some((item) => item.received_quantity > 0) && items.some((item) => item.remaining_quantity > 0.0001);

    return {
      id: po.id,
      client_id: po.client_id,
      branch_id: po.branch_id,
      destination_branch_id: this.getDestinationBranchId(po),
      vendor_id: po.vendor_id,
      po_number: po.po_number ?? `PO-${po.id}`,
      status: po.status,
      approval_status: po.approval_status,
      total_amount: this.normalizeNumber(po.total_amount),
      expected_delivery_date: po.expected_delivery_date,
      notes: po.notes,
      destination_store_label: po.destination_store_label,
      procurement_mode: po.procurement_mode,
      procurement_context: po.procurement_context,
      approval_scope: po.approval_scope,
      receipt_route: this.resolveReceiptRoute(destinationBranch),
      approval_notes: po.approval_notes,
      approved_by: po.approved_by,
      approved_by_name: po.approved_by_name,
      approved_at: po.approved_at,
      procurement_request_id: po.procurement_request_id,
      branch: branchSummary,
      requesting_branch: branchSummary,
      destination_branch: destinationBranch
        ? {
            id: destinationBranch.id,
            branch_name: destinationBranch.branch_name,
            branch_code: destinationBranch.branch_code,
            inventory_store_type: destinationBranch.inventory_store_type,
          }
        : null,
      vendor: po.vendor
        ? {
            id: po.vendor.id,
            vendor_name: po.vendor.vendor_name,
            is_active: po.vendor.is_active,
          }
        : null,
      procurement_request: po.procurement_request
        ? {
            id: po.procurement_request.id,
            request_no: po.procurement_request.request_no,
            status: po.procurement_request.status,
            procurement_context: po.procurement_request.procurement_context,
            approval_scope: po.procurement_request.approval_scope,
          }
        : null,
      items,
      summary: {
        line_count: items.length,
        quantity_total: this.normalizeNumber(items.reduce((sum, item) => sum + item.quantity, 0)),
        received_quantity_total: this.normalizeNumber(items.reduce((sum, item) => sum + item.received_quantity, 0)),
        remaining_quantity_total: this.normalizeNumber(items.reduce((sum, item) => sum + item.remaining_quantity, 0)),
        grn_count: receiptSummary.grnCount,
        received_amount_total: receiptSummary.receivedAmount,
        outstanding_amount_total: this.normalizeNumber(
          Math.max(this.normalizeNumber(po.total_amount) - receiptSummary.receivedAmount, 0),
        ),
      },
      receipt_summary: {
        grn_count: receiptSummary.grnCount,
        fully_received: fullyReceived,
        partially_received: partiallyReceived,
        last_receipt_date: receiptSummary.lastReceiptDate,
      },
      billing_summary: {
        accrued_amount: receiptSummary.receivedAmount,
        billed_amount: receiptSummary.billedAmount,
        pending_bill_amount: receiptSummary.pendingBillAmount,
        billed_grn_count: receiptSummary.billedGrnCount,
        bill_reference_count: receiptSummary.billReferenceCount,
        payable_ready_amount: receiptSummary.billedAmount,
        fully_billed: receiptSummary.receivedAmount > 0 && receiptSummary.pendingBillAmount <= 0.0001,
        last_bill_due_date: receiptSummary.lastBillDueDate,
      },
      workflow: {
        approval_pending: po.approval_status === 'pending',
        rejected: po.approval_status === 'rejected',
        awaiting_receipt: po.status === 'sent' && !fullyReceived,
        partially_received: partiallyReceived,
        fully_received: fullyReceived,
      },
      created_at: po.created_at,
      updated_at: po.updated_at,
    };
  }

  private mapPurchaseOrderListRow(
    po: PurchaseOrder,
    quantitySummary?: PurchaseOrderQuantitySummary,
    receivedByItem?: Map<number, number>,
    receiptSummaryInput?: {
      grnCount: number;
      receivedAmount: number;
      billedAmount: number;
      pendingBillAmount: number;
      billedGrnCount: number;
      billReferenceCount: number;
      lastReceiptDate: Date | null;
      lastBillDueDate: Date | null;
    },
  ) {
    const orderedQuantity = this.normalizeNumber(quantitySummary?.quantityTotal ?? 0);
    const receiptSummary = receiptSummaryInput ?? {
      grnCount: 0,
      receivedAmount: 0,
      billedAmount: 0,
      pendingBillAmount: 0,
      billedGrnCount: 0,
      billReferenceCount: 0,
      lastReceiptDate: null,
      lastBillDueDate: null,
    };
    const receivedQuantityTotal = this.normalizeNumber(
      [...(receivedByItem?.values() ?? [])].reduce((sum, quantity) => sum + Number(quantity || 0), 0),
    );
    const remainingQuantity = this.normalizeNumber(Math.max(orderedQuantity - receivedQuantityTotal, 0));
    const fullyReceived = orderedQuantity > 0 && remainingQuantity <= 0.0001;
    const partiallyReceived = receivedQuantityTotal > 0 && remainingQuantity > 0.0001;
    const branchSummary = po.branch
      ? {
          id: po.branch.id,
          branch_name: po.branch.branch_name,
          branch_code: po.branch.branch_code,
          inventory_store_type: po.branch.inventory_store_type,
        }
      : null;
    const destinationBranch = po.destination_branch ?? po.branch ?? null;

    return {
      id: po.id,
      client_id: po.client_id,
      branch_id: po.branch_id,
      destination_branch_id: this.getDestinationBranchId(po),
      vendor_id: po.vendor_id,
      po_number: po.po_number ?? `PO-${po.id}`,
      status: po.status,
      approval_status: po.approval_status,
      total_amount: this.normalizeNumber(po.total_amount),
      expected_delivery_date: po.expected_delivery_date,
      notes: po.notes,
      destination_store_label: po.destination_store_label,
      procurement_mode: po.procurement_mode,
      procurement_context: po.procurement_context,
      approval_scope: po.approval_scope,
      receipt_route: this.resolveReceiptRoute(destinationBranch),
      approval_notes: po.approval_notes,
      approved_by: po.approved_by,
      approved_by_name: po.approved_by_name,
      approved_at: po.approved_at,
      procurement_request_id: po.procurement_request_id,
      branch: branchSummary,
      requesting_branch: branchSummary,
      destination_branch: destinationBranch
        ? {
            id: destinationBranch.id,
            branch_name: destinationBranch.branch_name,
            branch_code: destinationBranch.branch_code,
            inventory_store_type: destinationBranch.inventory_store_type,
          }
        : null,
      vendor: po.vendor
        ? {
            id: po.vendor.id,
            vendor_name: po.vendor.vendor_name,
          }
        : null,
      procurement_request: po.procurement_request
        ? {
            id: po.procurement_request.id,
            request_no: po.procurement_request.request_no,
            status: po.procurement_request.status,
          }
        : null,
      items: [],
      summary: {
        line_count: quantitySummary?.lineCount ?? 0,
        quantity_total: orderedQuantity,
        received_quantity_total: receivedQuantityTotal,
        remaining_quantity_total: remainingQuantity,
        grn_count: receiptSummary.grnCount,
        received_amount_total: receiptSummary.receivedAmount,
        outstanding_amount_total: this.normalizeNumber(
          Math.max(this.normalizeNumber(po.total_amount) - receiptSummary.receivedAmount, 0),
        ),
      },
      receipt_summary: {
        grn_count: receiptSummary.grnCount,
        fully_received: fullyReceived,
        partially_received: partiallyReceived,
        last_receipt_date: receiptSummary.lastReceiptDate,
      },
      billing_summary: {
        accrued_amount: receiptSummary.receivedAmount,
        billed_amount: receiptSummary.billedAmount,
        pending_bill_amount: receiptSummary.pendingBillAmount,
        billed_grn_count: receiptSummary.billedGrnCount,
        bill_reference_count: receiptSummary.billReferenceCount,
        payable_ready_amount: receiptSummary.billedAmount,
        fully_billed: receiptSummary.receivedAmount > 0 && receiptSummary.pendingBillAmount <= 0.0001,
        last_bill_due_date: receiptSummary.lastBillDueDate,
      },
      workflow: {
        approval_pending: po.approval_status === 'pending',
        rejected: po.approval_status === 'rejected',
        awaiting_receipt: po.status === 'sent' && !fullyReceived,
        partially_received: partiallyReceived,
        fully_received: fullyReceived,
      },
      created_at: po.created_at,
      updated_at: po.updated_at,
    };
  }

  private async backfillLegacyPurchaseOrderColumns(): Promise<void> {
    try {
      await this.poRepo.query(
        "UPDATE purchase_orders SET status = CASE po_status WHEN 'ordered' THEN 'sent' ELSE po_status END WHERE (status IS NULL OR status = '') AND po_status IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET po_status = CASE status WHEN 'sent' THEN 'ordered' ELSE status END WHERE (po_status IS NULL OR po_status = '') AND status IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET total_amount = total_cost WHERE (total_amount IS NULL OR total_amount = 0) AND total_cost IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET total_cost = total_amount WHERE (total_cost IS NULL OR total_cost = 0) AND total_amount IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET expected_delivery_date = expected_date WHERE expected_delivery_date IS NULL AND expected_date IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET expected_date = expected_delivery_date WHERE expected_date IS NULL AND expected_delivery_date IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET po_number = CONCAT('PO-', id) WHERE (po_number IS NULL OR po_number = '')",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET destination_branch_id = branch_id WHERE destination_branch_id IS NULL AND branch_id IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET procurement_mode = 'branch_direct' WHERE procurement_mode IS NULL OR procurement_mode = ''",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET approval_status = 'not_required' WHERE approval_status IS NULL OR approval_status = ''",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET procurement_context = CASE WHEN branch_id = destination_branch_id THEN 'branch_procurement' ELSE 'branch_requisition' END WHERE procurement_context IS NULL OR procurement_context = ''",
      );
      await this.poRepo.query(
        "UPDATE purchase_orders SET approval_scope = CASE WHEN procurement_context = 'branch_procurement' THEN 'branch' ELSE 'central' END WHERE approval_scope IS NULL OR approval_scope = ''",
      );
      await this.poRepo.query(
        "UPDATE purchase_order_items SET line_total = total_price WHERE (line_total IS NULL OR line_total = 0) AND total_price IS NOT NULL",
      );
      await this.poRepo.query(
        "UPDATE purchase_order_items SET total_price = line_total WHERE (total_price IS NULL OR total_price = 0) AND line_total IS NOT NULL",
      );
    } catch (error) {
      console.warn('[PurchaseOrdersService] PO backfill skipped:', error?.message ?? error);
    }
  }

  async create(
    clientId: string,
    dto: CreatePurchaseOrderDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const normalized = this.normalizePoDto(dto);
    const branchId = normalized.branch_id as number;
    const destinationBranchId = normalized.destination_branch_id as number;
    const itemIds = (normalized.items ?? []).map((item) => item.item_id);

    const [requestingBranch, destinationBranch] = await Promise.all([
      this.assertBranchBelongsToClient(clientId, branchId, 'create purchase orders'),
      this.assertBranchBelongsToClient(clientId, destinationBranchId, 'receive purchase orders'),
    ]);
    await Promise.all([
      this.assertItemsBelongToClient(clientId, itemIds),
      this.ensureDestinationOwnership(clientId, destinationBranchId, itemIds),
    ]);
    await this.assertVendorBelongsToClient(clientId, normalized.vendor_id ?? null);

    await this.assertBranchAccess(clientId, accessibleBranchIds, branchId, 'requesting');
    await this.assertBranchAccess(clientId, accessibleBranchIds, destinationBranchId, 'destination');

    const linkedRequest = normalized.procurement_request_id
      ? await this.getValidatedProcurementRequest(
          clientId,
          normalized.procurement_request_id,
          branchId,
          destinationBranchId,
          accessibleBranchIds,
        )
      : null;

    const procurementContext = linkedRequest?.procurement_context
      ?? this.resolveProcurementContext(requestingBranch, destinationBranch, normalized.procurement_context);
    const approvalScope = linkedRequest?.approval_scope
      ?? this.resolveApprovalScope(procurementContext, normalized.approval_scope);
    const procurementMode = this.resolveCompatibilityMode(
      procurementContext,
      branchId,
      destinationBranchId,
      (linkedRequest?.procurement_mode as ProcurementMode | undefined) ?? normalized.procurement_mode,
    );

    if ((!normalized.items || normalized.items.length === 0) && linkedRequest) {
      normalized.items = linkedRequest.items.map((item) => ({
        item_id: item.item_id,
        quantity: this.normalizeNumber(item.approved_quantity ?? item.requested_quantity),
        unit_cost: 0,
      }));
    }

    if (!normalized.items || normalized.items.length === 0) {
      throw new BadRequestException('At least one purchase order item is required.');
    }
    const purchaseItems = normalized.items;
    const requestedApprovalStatus = normalized.approval_status as PurchaseOrderApprovalStatus;

    if (normalized.status === 'received') {
      throw new BadRequestException('Use the GRN posting flow to mark a purchase order as received.');
    }

    if (requestedApprovalStatus === 'not_required' && approvalScope !== 'branch' && procurementContext !== 'branch_procurement') {
      throw new BadRequestException('Centralized procurement purchase orders cannot skip approval.');
    }

    if (['approved', 'rejected'].includes(requestedApprovalStatus)) {
      await this.assertApprovalAuthority(clientId, approvalScope, user, accessibleBranchIds, branchId);
    }

    if (
      normalized.status === 'sent' &&
      ['pending', 'rejected'].includes(requestedApprovalStatus)
    ) {
      throw new BadRequestException('A purchase order cannot be sent while approval is pending or rejected.');
    }

    const createdPo = await this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;

      const po = manager.create(PurchaseOrder, {
        client_id: clientId,
        branch_id: branchId,
        destination_branch_id: destinationBranchId,
        vendor_id: normalized.vendor_id ?? undefined,
        po_number: normalized.po_number ?? await this.generatePurchaseOrderNumber(clientId, requestingBranch),
        status: normalized.status,
        total_amount: 0,
        expected_delivery_date: normalized.expected_delivery_date,
        notes: normalized.notes ?? undefined,
        destination_store_label: normalized.destination_store_label ?? null,
        procurement_mode: procurementMode,
        procurement_context: procurementContext,
        approval_scope: approvalScope,
        approval_status: requestedApprovalStatus,
        approval_notes: normalized.approval_notes ?? null,
        approved_by:
          requestedApprovalStatus === 'approved'
            ? resolveActorId(user) ?? null
            : null,
        approved_by_name:
          requestedApprovalStatus === 'approved'
            ? this.buildActorName(user)
            : null,
        approved_at:
          requestedApprovalStatus === 'approved'
            ? new Date()
            : null,
        procurement_request_id: linkedRequest?.id ?? normalized.procurement_request_id ?? null,
        legacy_status: this.mapCanonicalStatusToLegacy(normalized.status) ?? null,
      });
      const savedPo = await manager.save(po);

      for (const itemDto of purchaseItems) {
        const normalizedLine = await this.normalizePurchaseLineToBase(clientId, itemDto);
        const itemTotal = normalizedLine.line_total;
        totalAmount += itemTotal;

        const poItem = manager.create(PurchaseOrderItem, {
          po_id: savedPo.id,
          item_id: normalizedLine.item_id,
          quantity: normalizedLine.quantity,
          unit_cost: normalizedLine.unit_cost,
          line_total: itemTotal,
          legacy_total_price: itemTotal,
        });
        await manager.save(poItem);
      }

      savedPo.total_amount = normalized.total_amount ?? totalAmount;
      savedPo.legacy_total_cost = savedPo.total_amount;
      savedPo.legacy_expected_date = normalized.expected_delivery_date
        ? new Date(normalized.expected_delivery_date)
        : null;
      const saved = await manager.save(savedPo);

      if (linkedRequest) {
        await this.procurementRequestsService.markConverted(clientId, linkedRequest.id, saved.id);
      }

      return saved.id;
    });

    const createdRecord = await this.findOne(clientId, createdPo, accessibleBranchIds);

    if (createdRecord.approval_status === 'pending') {
      await this.approvalsService.submit({
        client_id: clientId,
        module: 'procurement',
        entity_id: createdRecord.id,
        action_type: 'purchase_order_approval',
        requested_by: resolveActorId(user) ?? 'system',
        branch_id: createdRecord.branch_id,
        notes: createdRecord.approval_notes ?? createdRecord.notes ?? null,
      });
    }

    return createdRecord;
  }

  async findAll(clientId: string, accessibleBranchIds?: number[]) {
    const query = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .leftJoinAndSelect('po.branch', 'branch')
      .leftJoinAndSelect('po.destination_branch', 'destination_branch')
      .leftJoinAndSelect('po.procurement_request', 'procurement_request')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .where('po.client_id = :clientId', { clientId });

    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);

    if (!hasCentralOversight && accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('po.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds })
            .orWhere('COALESCE(po.destination_branch_id, po.branch_id) IN (:...accessibleBranchIds)', {
              accessibleBranchIds,
            });
        }),
      );
    }

    const purchaseOrders = await query
      .orderBy('po.created_at', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .getMany();

    const receiptProgress = await this.loadReceiptProgress(purchaseOrders.map((po) => po.id));
    return purchaseOrders.map((po) => this.mapPurchaseOrder(po, {
      receivedByItem: receiptProgress.receivedByPoItem.get(po.id) ?? new Map<number, number>(),
      summary: receiptProgress.summaryByPo.get(po.id) ?? {
        grnCount: 0,
        receivedAmount: 0,
        billedAmount: 0,
        pendingBillAmount: 0,
        billedGrnCount: 0,
        billReferenceCount: 0,
        lastReceiptDate: null,
        lastBillDueDate: null,
      },
      }));
  }

  async findAllPaginated(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters?: ListPurchaseOrdersQueryDto,
  ) {
    if (filters?.branch_id) {
      await this.assertBranchBelongsToClient(clientId, filters.branch_id);
      await this.assertBranchAccess(clientId, accessibleBranchIds, filters.branch_id, 'requesting');
    }
    if (filters?.destination_branch_id) {
      await this.assertBranchBelongsToClient(clientId, filters.destination_branch_id);
      await this.assertBranchAccess(
        clientId,
        accessibleBranchIds,
        filters.destination_branch_id,
        'destination',
      );
    }

    const query = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.vendor', 'vendor')
      .leftJoinAndSelect('po.branch', 'branch')
      .leftJoinAndSelect('po.destination_branch', 'destination_branch')
      .leftJoinAndSelect('po.procurement_request', 'procurement_request')
      .where('po.client_id = :clientId', { clientId });

    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (!hasCentralOversight && accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('po.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds })
            .orWhere('COALESCE(po.destination_branch_id, po.branch_id) IN (:...accessibleBranchIds)', {
              accessibleBranchIds,
            });
        }),
      );
    }

    if (filters?.branch_id) {
      query.andWhere('po.branch_id = :branchId', { branchId: filters.branch_id });
    }
    if (filters?.destination_branch_id) {
      query.andWhere('COALESCE(po.destination_branch_id, po.branch_id) = :destinationBranchId', {
        destinationBranchId: filters.destination_branch_id,
      });
    }
    if (filters?.vendor_id) {
      query.andWhere('po.vendor_id = :vendorId', { vendorId: filters.vendor_id });
    }
    if (filters?.status) {
      const canonicalStatus = this.mapLegacyStatusToCanonical(filters.status) ?? filters.status;
      query.andWhere('po.status = :status', { status: canonicalStatus });
    }
    if (filters?.approval_status) {
      query.andWhere('po.approval_status = :approvalStatus', { approvalStatus: filters.approval_status });
    }

    const trimmedSearch = filters?.search?.trim();
    if (trimmedSearch) {
      const search = `%${trimmedSearch.toLowerCase()}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(COALESCE(po.po_number, \'\')) LIKE :search', { search })
            .orWhere('LOWER(COALESCE(vendor.vendor_name, \'\')) LIKE :search', { search })
            .orWhere('LOWER(COALESCE(branch.branch_name, \'\')) LIKE :search', { search })
            .orWhere('LOWER(COALESCE(destination_branch.branch_name, \'\')) LIKE :search', { search })
            .orWhere('LOWER(COALESCE(po.procurement_context, \'\')) LIKE :search', { search })
            .orWhere('LOWER(COALESCE(procurement_request.request_no, \'\')) LIKE :search', { search });
        }),
      );
    }

    const { start, end } = this.resolveFilterDateRange(filters);
    if (start) {
      query.andWhere('po.created_at >= :start', { start });
    }
    if (end) {
      query.andWhere('po.created_at <= :end', { end });
    }

    const limit = this.normalizeLimit(filters?.limit, 25, 200);
    const offset = this.normalizeOffset(filters?.offset);
    const [rows, total] = await query
      .orderBy('po.created_at', 'DESC')
      .addOrderBy('po.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const poIds = rows.map((row) => row.id);
    const [receiptProgress, quantityTotals] = await Promise.all([
      this.loadReceiptProgress(poIds),
      this.loadPurchaseOrderQuantityTotals(poIds),
    ]);

    return {
      items: rows.map((po) => this.mapPurchaseOrderListRow(
        po,
        quantityTotals.get(po.id),
        receiptProgress.receivedByPoItem.get(po.id),
        receiptProgress.summaryByPo.get(po.id),
      )),
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
    };
  }

  async findOne(
    clientId: string,
    id: number,
    accessibleBranchIds?: number[],
  ) {
    const po = await this.poRepo.findOne({
      where: { id, client_id: clientId },
      relations: [
        'vendor',
        'branch',
        'destination_branch',
        'procurement_request',
        'items',
        'items.item',
      ],
    });
    if (!po) {
      throw new NotFoundException('Purchase Order not found');
    }

    const destinationBranchId = this.getDestinationBranchId(po);
    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (
      !hasCentralOversight &&
      accessibleBranchIds &&
      accessibleBranchIds.length > 0 &&
      !accessibleBranchIds.includes(po.branch_id) &&
      !accessibleBranchIds.includes(destinationBranchId)
    ) {
      throw new NotFoundException('Purchase Order not found');
    }

    const receiptProgress = await this.loadReceiptProgress([po.id]);
    return this.mapPurchaseOrder(po, {
      receivedByItem: receiptProgress.receivedByPoItem.get(po.id) ?? new Map<number, number>(),
      summary: receiptProgress.summaryByPo.get(po.id) ?? {
        grnCount: 0,
        receivedAmount: 0,
        billedAmount: 0,
        pendingBillAmount: 0,
        billedGrnCount: 0,
        billReferenceCount: 0,
        lastReceiptDate: null,
        lastBillDueDate: null,
      },
    });
  }

  async updateStatus(
    clientId: string,
    id: number,
    status: string,
    accessibleBranchIds?: number[],
  ) {
    const po = await this.poRepo.findOne({
      where: { id, client_id: clientId },
      relations: ['vendor', 'branch', 'destination_branch', 'items', 'items.item'],
    });
    if (!po) {
      throw new NotFoundException('Purchase Order not found');
    }

    const destinationBranchId = this.getDestinationBranchId(po);
    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (
      !hasCentralOversight &&
      accessibleBranchIds &&
      accessibleBranchIds.length > 0 &&
      !accessibleBranchIds.includes(po.branch_id) &&
      !accessibleBranchIds.includes(destinationBranchId)
    ) {
      throw new NotFoundException('Purchase Order not found');
    }
    assertBranchOperationalWriteAllowed(po.branch, 'update purchase order workflow');
    assertBranchOperationalWriteAllowed(
      po.destination_branch ?? po.branch,
      'update purchase order workflow',
    );

    const receiptCount = await this.grnRepo.count({
      where: { client_id: clientId, purchase_order_id: po.id },
    });

    const canonical = this.mapLegacyStatusToCanonical(status) ?? status;
    if (canonical === 'received') {
      throw new BadRequestException('Use the GRN posting flow to receive stock against a purchase order.');
    }
    if (
      ['sent', 'received'].includes(canonical) &&
      ['pending', 'rejected'].includes(po.approval_status)
    ) {
      throw new BadRequestException('This purchase order must be approved before it can be sent or received.');
    }
    if (canonical === 'cancelled' && receiptCount > 0) {
      throw new BadRequestException('Purchase orders with posted GRNs cannot be cancelled.');
    }
    if (canonical === 'draft' && receiptCount > 0) {
      throw new BadRequestException('Purchase orders with posted GRNs cannot be moved back to draft.');
    }

    po.status = canonical;
    po.legacy_status = this.mapCanonicalStatusToLegacy(canonical) ?? null;
    await this.poRepo.save(po);
    return this.findOne(clientId, id, accessibleBranchIds);
  }

  async updateApproval(
    clientId: string,
    id: number,
    dto: UpdatePurchaseOrderApprovalDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const po = await this.poRepo.findOne({
      where: { id, client_id: clientId },
      relations: ['branch', 'destination_branch'],
    });
    if (!po) {
      throw new NotFoundException('Purchase Order not found');
    }
    assertBranchOperationalWriteAllowed(po.branch, 'review purchase orders');
    assertBranchOperationalWriteAllowed(
      po.destination_branch ?? po.branch,
      'review purchase orders',
    );

    const destinationBranchId = this.getDestinationBranchId(po);
    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (
      !hasCentralOversight &&
      accessibleBranchIds &&
      accessibleBranchIds.length > 0 &&
      !accessibleBranchIds.includes(po.branch_id) &&
      !accessibleBranchIds.includes(destinationBranchId)
    ) {
      throw new NotFoundException('Purchase Order not found');
    }

    await this.assertApprovalAuthority(clientId, po.approval_scope, user, accessibleBranchIds, po.branch_id);

    const receiptCount = await this.grnRepo.count({
      where: { client_id: clientId, purchase_order_id: po.id },
    });
    if (receiptCount > 0 && dto.approval_status !== 'approved') {
      throw new BadRequestException(
        'Purchase orders with posted GRNs must remain approved.',
      );
    }
    if (po.status === 'sent' && dto.approval_status !== 'approved') {
      throw new BadRequestException(
        'A sent purchase order cannot be moved back to pending or rejected approval.',
      );
    }
    if (po.status === 'received' && dto.approval_status !== 'approved') {
      throw new BadRequestException(
        'A received purchase order cannot be moved back to pending or rejected approval.',
      );
    }

    po.approval_status = dto.approval_status;
    po.approval_notes = dto.approval_notes?.trim() || null;
    if (dto.approval_status === 'approved') {
      po.approved_by = resolveActorId(user) ?? null;
      po.approved_by_name = this.buildActorName(user);
      po.approved_at = new Date();
    } else {
      po.approved_by = null;
      po.approved_by_name = null;
      po.approved_at = null;
      if (dto.approval_status === 'rejected') {
        po.status = 'draft';
        po.legacy_status = 'draft';
      }
    }

    await this.poRepo.save(po);
    await this.approvalsService.syncDecisionByEntity(
      clientId,
      'procurement',
      po.id,
      'purchase_order_approval',
      dto.approval_status === 'approved' ? 'approved' : 'rejected',
      resolveActorId(user) ?? null,
      po.approval_notes,
    );
    return this.findOne(clientId, id, accessibleBranchIds);
  }

  async delete(clientId: string, id: number, accessibleBranchIds?: number[]): Promise<void> {
    const po = await this.poRepo.findOne({
      where: { id, client_id: clientId },
      relations: ['branch', 'destination_branch'],
    });
    if (!po) {
      throw new NotFoundException('Purchase Order not found');
    }
    assertBranchOperationalWriteAllowed(po.branch, 'delete purchase orders');
    assertBranchOperationalWriteAllowed(
      po.destination_branch ?? po.branch,
      'delete purchase orders',
    );

    const destinationBranchId = this.getDestinationBranchId(po);
    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);
    if (
      !hasCentralOversight &&
      accessibleBranchIds &&
      accessibleBranchIds.length > 0 &&
      !accessibleBranchIds.includes(po.branch_id) &&
      !accessibleBranchIds.includes(destinationBranchId)
    ) {
      throw new NotFoundException('Purchase Order not found');
    }

    const receiptCount = await this.grnRepo.count({
      where: { client_id: clientId, purchase_order_id: po.id },
    });

    if (po.status === 'received' || receiptCount > 0) {
      throw new BadRequestException('Purchase orders with posted receipts cannot be deleted.');
    }

    await this.poRepo.delete({ id: po.id, client_id: clientId });
  }
}
