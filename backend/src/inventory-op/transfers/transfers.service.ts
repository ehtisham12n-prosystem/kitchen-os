import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { resolveActorId } from '../../auth/request-context.util';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../../inventory/entities/branch-inventory.entity';
import { OperationalAuditService } from '../../platform/audit/operational-audit.service';
import { Branch } from '../../setup/entities/branch.entity';
import { AccountingService } from '../../accounting/accounting.service';
import {
  CreateInventoryTransferDto,
  DispatchInventoryTransferDto,
  ReceiveInventoryTransferDto,
} from '../dto/inventory-transfer.dto';
import {
  INVENTORY_TRANSFER_FLOW_TYPES,
  INVENTORY_TRANSFER_STATUSES,
  InventoryTransfer,
  type InventoryTransferFlowType,
} from '../entities/inventory-transfer.entity';
import { InventoryTransferEvent } from '../entities/inventory-transfer-event.entity';
import {
  INVENTORY_TRANSFER_ITEM_STAGES,
  InventoryTransferItem,
  type InventoryTransferItemStage,
} from '../entities/inventory-transfer-item.entity';
import { StockLedger } from '../entities/stock-ledger.entity';
import { StockLevel } from '../entities/stock-level.entity';
import { assertBranchOperationalWriteAllowed } from '../../setup/branches/branch-control.types';

type TransferAction = 'create' | 'approve' | 'reject' | 'cancel' | 'dispatch' | 'receive';

interface TransferFlowContext {
  flowType?: InventoryTransferFlowType;
}

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(InventoryTransfer)
    private readonly transferRepo: Repository<InventoryTransfer>,
    @InjectRepository(StockLedger)
    private readonly ledgerRepo: Repository<StockLedger>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    private readonly accountingService: AccountingService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly dataSource: DataSource,
  ) {}

  private normalizeQuantity(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(4));
  }

  private normalizeFlowType(
    value?: InventoryTransferFlowType | null,
  ): InventoryTransferFlowType {
    return value === 'production_supply' ? 'production_supply' : 'stock_transfer';
  }

  private normalizeProductionStage(
    value?: InventoryTransferItemStage | null,
  ): InventoryTransferItemStage {
    return INVENTORY_TRANSFER_ITEM_STAGES.includes(value as InventoryTransferItemStage)
      ? (value as InventoryTransferItemStage)
      : 'raw';
  }

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private hasBranchAccess(accessibleBranchIds: number[] | undefined, branchId: number): boolean {
    return !accessibleBranchIds || accessibleBranchIds.length === 0 || accessibleBranchIds.includes(branchId);
  }

  private assertActionAccess(
    action: TransferAction,
    accessibleBranchIds: number[] | undefined,
    transfer: Pick<InventoryTransfer, 'source_branch_id' | 'destination_branch_id'>,
  ): void {
    const hasSourceAccess = this.hasBranchAccess(accessibleBranchIds, transfer.source_branch_id);
    const hasDestinationAccess = this.hasBranchAccess(accessibleBranchIds, transfer.destination_branch_id);

    if (action === 'create') {
      if (!hasSourceAccess && !hasDestinationAccess) {
        throw new ForbiddenException('You do not have access to either branch in this transfer.');
      }
      return;
    }

    if (action === 'cancel') {
      if (!hasSourceAccess && !hasDestinationAccess) {
        throw new ForbiddenException('You do not have access to cancel this transfer.');
      }
      return;
    }

    if ((action === 'approve' || action === 'reject' || action === 'dispatch') && !hasSourceAccess) {
      throw new ForbiddenException('You do not have source-branch access for this transfer.');
    }

    if (action === 'receive' && !hasDestinationAccess) {
      throw new ForbiddenException('You do not have destination-branch access for this transfer.');
    }
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

  private assertProductionSourceBranch(branch: Branch): void {
    if (!branch.is_production_source) {
      throw new BadRequestException(
        `${branch.branch_name} is not designated as a production supply source.`,
      );
    }
  }

  private assertProductionDestinationBranch(branch: Branch): void {
    if (branch.inventory_store_type !== 'branch') {
      throw new BadRequestException(
        'Production supply requests can only be received by operational branches.',
      );
    }
  }

  private assertStockTransferRoutePolicy(sourceBranch: Branch, destinationBranch: Branch): void {
    const sourceType = sourceBranch.inventory_store_type;
    const destinationType = destinationBranch.inventory_store_type;

    if (sourceType === destinationType) {
      if (sourceType === 'branch') {
        throw new BadRequestException(
          'Branch-to-branch stock transfers are disabled in this batch. Route stock through a central store.',
        );
      }

      throw new BadRequestException('Central-to-central stock transfers are not supported in this batch.');
    }
  }

  private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, client_id: clientId } });
    if (!item) {
      throw new NotFoundException(`Inventory item ${itemId} not found.`);
    }
    if (!item.item_is_active) {
      throw new BadRequestException(`Inventory item ${item.item_name} is inactive.`);
    }
    return item;
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
      const item = await this.assertItemBelongsToClient(clientId, missing);
      throw new BadRequestException(
        `Item ${item.item_name} is not enabled for the destination branch.`,
      );
    }
  }

  private async ensureSourceOwnership(
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
    const disabledItemIds = new Set(
      mappings.filter((mapping) => !mapping.is_enabled).map((mapping) => mapping.item_id),
    );
    const disabled = itemIds.find((itemId) => disabledItemIds.has(itemId));
    if (disabled) {
      const item = await this.assertItemBelongsToClient(clientId, disabled);
      throw new BadRequestException(
        `Item ${item.item_name} is disabled at the source branch and cannot be dispatched.`,
      );
    }
  }

  private async findLatestUnitCost(clientId: string, branchId: number, itemId: number): Promise<number> {
    const ledger = await this.ledgerRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    const ledgerUnitCost = this.normalizeQuantity(ledger?.unit_cost ?? 0);
    if (ledgerUnitCost > 0) {
      return ledgerUnitCost;
    }

    const stockLevel = await this.dataSource.manager.findOne(StockLevel, {
      where: { client_id: clientId, branch_id: branchId, item_id: itemId },
    });
    return this.normalizeQuantity(stockLevel?.last_unit_cost ?? 0);
  }

  private computeInTransitQuantity(
    dispatchedQuantity: number,
    receivedQuantity: number,
    shortQuantity: number,
    damagedQuantity: number,
  ): number {
    return Math.max(
      0,
      this.normalizeQuantity(
        dispatchedQuantity - receivedQuantity - shortQuantity - damagedQuantity,
      ),
    );
  }

  private async generateTransferNo(
    clientId: string,
    flowType: InventoryTransferFlowType,
  ): Promise<string> {
    const latest = await this.transferRepo.findOne({
      where: { client_id: clientId, flow_type: flowType },
      order: { id: 'DESC' },
    });
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const next = String((latest?.id ?? 0) + 1).padStart(4, '0');
    const prefix = flowType === 'production_supply' ? 'PSR' : 'ITR';
    return `${prefix}-${yy}${mm}-${next}`;
  }

  private async appendEvent(
    manager: DataSource['manager'],
    input: {
      clientId: string;
      transferId: number;
      action: 'requested' | 'approved' | 'rejected' | 'cancelled' | 'dispatched' | 'received';
      statusAfter: string;
      user?: JwtPayload;
      notes?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const event = manager.create(InventoryTransferEvent, {
      client_id: input.clientId,
      transfer_id: input.transferId,
      action: input.action,
      status_after: input.statusAfter,
      actor_id: resolveActorId(input.user) ?? null,
      actor_name: this.buildActorName(input.user),
      notes: input.notes ?? null,
      metadata_json: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    await manager.save(event);
  }

  private computeAvailableActions(
    transfer: InventoryTransfer,
    accessibleBranchIds?: number[],
  ): string[] {
    const actions: string[] = [];
    const hasSourceAccess = this.hasBranchAccess(accessibleBranchIds, transfer.source_branch_id);
    const hasDestinationAccess = this.hasBranchAccess(accessibleBranchIds, transfer.destination_branch_id);

    if (transfer.status === 'requested') {
      if (hasSourceAccess && transfer.require_approval) {
        actions.push('approve', 'reject');
      }
      if (hasSourceAccess && !transfer.require_approval) {
        actions.push('dispatch', 'reject');
      }
      if (hasSourceAccess || hasDestinationAccess) {
        actions.push('cancel');
      }
    }

    if (transfer.status === 'approved' && hasSourceAccess) {
      actions.push('dispatch', 'reject');
    }

    if (transfer.status === 'approved' && (hasSourceAccess || hasDestinationAccess)) {
      actions.push('cancel');
    }

    if (transfer.status === 'in_transit' && hasDestinationAccess) {
      actions.push('receive');
    }

    return actions;
  }

  private mapStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      requested: 'Requested',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      in_transit: 'In Transit',
      received: 'Received',
      received_with_variance: 'Received With Variance',
    };
    return labels[status] || status;
  }

  private mapFlowLabel(flowType: InventoryTransferFlowType): string {
    return flowType === 'production_supply' ? 'Production Supply' : 'Stock Transfer';
  }

  private getInventoryAccountCode(flowType: InventoryTransferFlowType): string {
    return flowType === 'production_supply' ? '1400' : '1300';
  }

  private mapClearingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      not_started: 'Clearing Not Started',
      dispatch_posted: 'Dispatch Clearing Posted',
      in_transit_cleared: 'In Transit Clearing Active',
      receipt_posting_pending: 'Receipt Clearing Pending',
      cleared: 'Cleared',
      variance_review: 'Variance Review',
    };
    return labels[status] || 'Clearing Review';
  }

  private mapProductionStageLabel(stage: InventoryTransferItemStage): string {
    const labels: Record<InventoryTransferItemStage, string> = {
      raw: 'Raw Stock',
      semi_prepared: 'Semi-Prepared',
      prepared: 'Prepared',
    };
    return labels[stage];
  }

  private buildAuditAction(
    flowType: InventoryTransferFlowType,
    action: 'Requested' | 'Approved' | 'Rejected' | 'Cancelled' | 'Dispatched' | 'Received',
  ): string {
    return `${flowType === 'production_supply' ? 'Production Supply' : 'Inventory Transfer'} ${action}`;
  }

  private getLedgerTransactionType(flowType: InventoryTransferFlowType): 'transfer' | 'production' {
    return flowType === 'production_supply' ? 'production' : 'transfer';
  }

  private roundCurrency(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(2));
  }

  private isInternalRechargeApplicable(transfer: InventoryTransfer): boolean {
    return transfer.flow_type === 'stock_transfer'
      && transfer.source_branch?.inventory_store_type === 'central'
      && transfer.destination_branch?.inventory_store_type === 'branch';
  }

  private computeInternalRechargeAmount(transfer: InventoryTransfer): number {
    const baseAmount = transfer.status === 'in_transit'
      ? (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.dispatched_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      )
      : (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.received_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      );
    return this.roundCurrency(baseAmount);
  }

  private async postDispatchClearingJournal(
    clientId: string,
    transfer: InventoryTransfer,
    user: JwtPayload,
  ) {
    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      this.getInventoryAccountCode(transfer.flow_type),
      transfer.flow_type === 'production_supply' ? 'Finished Goods Inventory' : 'Raw Materials Inventory',
      'asset',
    );
    const clearingAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1220',
      'Inter-Branch Clearing Receivable',
      'asset',
    );
    const amount = this.roundCurrency(
      (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.dispatched_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      ),
    );

    if (amount <= 0) {
      return null;
    }

    return this.accountingService.createJournalEntry(
      clientId,
      transfer.source_branch_id,
      {
        branch_id: transfer.source_branch_id,
        transaction_date: transfer.dispatched_at ?? new Date(),
        business_date: (transfer.dispatched_at ?? new Date()).toISOString().slice(0, 10),
        description: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} dispatch clearing`,
        reference_id: transfer.transfer_no,
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'dispatch_clearing',
        posting_type: 'auto',
        items: [
          { account_id: clearingAccount.id, debit: amount, credit: 0 },
          { account_id: inventoryAccount.id, debit: 0, credit: amount },
        ],
      },
      user,
    );
  }

  private async postReceiptClearingJournal(
    clientId: string,
    transfer: InventoryTransfer,
    user: JwtPayload,
  ) {
    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      this.getInventoryAccountCode(transfer.flow_type),
      transfer.flow_type === 'production_supply' ? 'Finished Goods Inventory' : 'Raw Materials Inventory',
      'asset',
    );
    const clearingAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '2120',
      'Inter-Branch Clearing Payable',
      'liability',
    );
    const varianceAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '5500',
      'Inventory Wastage',
      'expense',
    );

    const receivedAmount = this.roundCurrency(
      (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.received_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      ),
    );
    const varianceAmount = this.roundCurrency(
      (transfer.items ?? []).reduce(
        (sum, item) => sum + ((this.normalizeQuantity(item.short_quantity) + this.normalizeQuantity(item.damaged_quantity)) * this.normalizeQuantity(item.unit_cost)),
        0,
      ),
    );
    const clearingAmount = this.roundCurrency(receivedAmount + varianceAmount);

    if (clearingAmount <= 0) {
      return null;
    }

    const items: Array<{ account_id: number; debit: number; credit: number }> = [];
    if (receivedAmount > 0) {
      items.push({ account_id: inventoryAccount.id, debit: receivedAmount, credit: 0 });
    }
    if (varianceAmount > 0) {
      items.push({ account_id: varianceAccount.id, debit: varianceAmount, credit: 0 });
    }
    items.push({ account_id: clearingAccount.id, debit: 0, credit: clearingAmount });

    return this.accountingService.createJournalEntry(
      clientId,
      transfer.destination_branch_id,
      {
        branch_id: transfer.destination_branch_id,
        transaction_date: transfer.received_at ?? new Date(),
        business_date: (transfer.received_at ?? new Date()).toISOString().slice(0, 10),
        description: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} receipt clearing`,
        reference_id: transfer.transfer_no,
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'receipt_clearing',
        posting_type: 'auto',
        items,
      },
      user,
    );
  }

  private async postInternalRechargeJournals(
    clientId: string,
    transfer: InventoryTransfer,
    user: JwtPayload,
  ) {
    if (!this.isInternalRechargeApplicable(transfer)) {
      return { sourceRechargeJournal: null, destinationRechargeJournal: null };
    }

    const amount = this.computeInternalRechargeAmount(transfer);
    if (amount <= 0) {
      return { sourceRechargeJournal: null, destinationRechargeJournal: null };
    }

    const [
      sourceRechargeJournal,
      destinationRechargeJournal,
      clearingReceivableAccount,
      clearingPayableAccount,
      rechargeIncomeAccount,
      rechargeExpenseAccount,
    ] = await Promise.all([
      this.accountingService.findJournalEntryBySource(clientId, transfer.source_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'source_recharge',
      }),
      this.accountingService.findJournalEntryBySource(clientId, transfer.destination_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'destination_recharge',
      }),
      this.accountingService.ensureDefaultAccount(
        clientId,
        '1220',
        'Inter-Branch Clearing Receivable',
        'asset',
      ),
      this.accountingService.ensureDefaultAccount(
        clientId,
        '2120',
        'Inter-Branch Clearing Payable',
        'liability',
      ),
      this.accountingService.ensureDefaultAccount(
        clientId,
        '4310',
        'Inter-Branch Recharge Income',
        'revenue',
      ),
      this.accountingService.ensureDefaultAccount(
        clientId,
        '5320',
        'Inter-Branch Recharge Expense',
        'expense',
      ),
    ]);

    const businessDate = (transfer.received_at ?? new Date()).toISOString().slice(0, 10);
    const transactionDate = transfer.received_at ?? new Date();

    const postedSourceRecharge = sourceRechargeJournal ?? await this.accountingService.createJournalEntry(
      clientId,
      transfer.source_branch_id,
      {
        branch_id: transfer.source_branch_id,
        transaction_date: transactionDate,
        business_date: businessDate,
        description: `Internal recharge posted for ${transfer.transfer_no}`,
        reference_id: transfer.transfer_no,
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'source_recharge',
        posting_type: 'auto',
        items: [
          { account_id: clearingReceivableAccount.id, debit: amount, credit: 0 },
          { account_id: rechargeIncomeAccount.id, debit: 0, credit: amount },
        ],
      },
      user,
    );

    const postedDestinationRecharge = destinationRechargeJournal ?? await this.accountingService.createJournalEntry(
      clientId,
      transfer.destination_branch_id,
      {
        branch_id: transfer.destination_branch_id,
        transaction_date: transactionDate,
        business_date: businessDate,
        description: `Internal recharge received for ${transfer.transfer_no}`,
        reference_id: transfer.transfer_no,
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'destination_recharge',
        posting_type: 'auto',
        items: [
          { account_id: rechargeExpenseAccount.id, debit: amount, credit: 0 },
          { account_id: clearingPayableAccount.id, debit: 0, credit: amount },
        ],
      },
      user,
    );

    return {
      sourceRechargeJournal: postedSourceRecharge,
      destinationRechargeJournal: postedDestinationRecharge,
    };
  }

  private async buildClearingSummary(
    clientId: string,
    transfer: InventoryTransfer,
  ) {
    const [dispatchJournal, receiptJournal, sourceRechargeJournal, destinationRechargeJournal] = await Promise.all([
      this.accountingService.findJournalEntryBySource(clientId, transfer.source_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'dispatch_clearing',
      }),
      this.accountingService.findJournalEntryBySource(clientId, transfer.destination_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'receipt_clearing',
      }),
      this.accountingService.findJournalEntryBySource(clientId, transfer.source_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'source_recharge',
      }),
      this.accountingService.findJournalEntryBySource(clientId, transfer.destination_branch_id, {
        source_module: 'inventory_transfer',
        source_entity_type: 'inventory_transfer',
        source_entity_id: String(transfer.id),
        source_event: 'destination_recharge',
      }),
    ]);

    const dispatchedAmount = this.roundCurrency(
      (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.dispatched_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      ),
    );
    const receivedAmount = this.roundCurrency(
      (transfer.items ?? []).reduce(
        (sum, item) => sum + (this.normalizeQuantity(item.received_quantity) * this.normalizeQuantity(item.unit_cost)),
        0,
      ),
    );
    const varianceAmount = this.roundCurrency(dispatchedAmount - receivedAmount);
    const reviewCompleted = Boolean(transfer.finance_reviewed_at);
    const reviewRequired = transfer.status === 'received_with_variance' && Boolean(dispatchJournal) && Boolean(receiptJournal);
    const rechargeApplicable = this.isInternalRechargeApplicable(transfer);
    const rechargeBaseAmount = this.computeInternalRechargeAmount(transfer);
    const rechargePosted = Boolean(sourceRechargeJournal) && Boolean(destinationRechargeJournal);

    let status = 'not_started';
    let note = 'Finance clearing will begin once the transfer is dispatched.';
    if (transfer.status === 'in_transit') {
      status = dispatchJournal ? 'in_transit_cleared' : 'dispatch_posted';
      note = dispatchJournal
        ? 'Source branch clearing is posted and the transfer remains in transit until receipt.'
        : 'Dispatch completed but source-branch clearing journal still needs review.';
    } else if (transfer.status === 'received') {
      status = dispatchJournal && receiptJournal ? 'cleared' : 'receipt_posting_pending';
      note = dispatchJournal && receiptJournal
        ? 'Both source and destination clearing journals are posted.'
        : 'Receipt completed but one or both clearing journals still need review.';
    } else if (transfer.status === 'received_with_variance') {
      status = dispatchJournal && receiptJournal ? 'variance_review' : 'receipt_posting_pending';
      note = dispatchJournal && receiptJournal
        ? (reviewCompleted
          ? 'Clearing is posted with variance recognized on receipt and the finance review is complete.'
          : 'Clearing is posted with variance recognized on receipt and should be reviewed.')
        : 'Receipt variance is recorded but one or both clearing journals still need review.';
    }

    if (rechargeApplicable && transfer.status !== 'in_transit') {
      note = rechargePosted
        ? `${note} Internal recharge is posted for both branches.`
        : `${note} Internal recharge is still pending.`;
    }

    return {
      status,
      status_label: this.mapClearingStatusLabel(status),
      top_note: note,
      dispatch_posted: Boolean(dispatchJournal),
      receipt_posted: Boolean(receiptJournal),
      dispatch_journal_id: dispatchJournal?.id ?? null,
      receipt_journal_id: receiptJournal?.id ?? null,
      dispatched_amount: dispatchedAmount,
      received_amount: receivedAmount,
      variance_amount: varianceAmount,
      inventory_account_code: this.getInventoryAccountCode(transfer.flow_type),
      clearing_receivable_account_code: '1220',
      clearing_payable_account_code: '2120',
      variance_expense_account_code: varianceAmount > 0 ? '5500' : null,
      review_required: reviewRequired,
      review_completed: reviewCompleted,
      review_status_label: reviewRequired ? (reviewCompleted ? 'Finance Review Complete' : 'Finance Review Pending') : null,
      reviewed_at: transfer.finance_reviewed_at ?? null,
      reviewed_by_name: transfer.finance_reviewed_by_name ?? null,
      review_notes: transfer.finance_review_notes ?? null,
      recharge_applicable: rechargeApplicable,
      recharge_amount: rechargeApplicable ? rechargeBaseAmount : 0,
      recharge_status_label: rechargeApplicable
        ? (transfer.status === 'in_transit'
          ? 'Central Supply In Transit'
          : (rechargePosted ? 'Internal Recharge Posted' : 'Internal Recharge Pending'))
        : null,
      recharge_posted: rechargePosted,
      source_recharge_journal_id: sourceRechargeJournal?.id ?? null,
      destination_recharge_journal_id: destinationRechargeJournal?.id ?? null,
      recharge_income_account_code: rechargeApplicable ? '4310' : null,
      recharge_expense_account_code: rechargeApplicable ? '5320' : null,
    };
  }

  private assertTransferMatchesFlow(
    transfer: InventoryTransfer,
    expectedFlowType?: InventoryTransferFlowType,
  ): void {
    if (expectedFlowType && transfer.flow_type !== expectedFlowType) {
      throw new NotFoundException('Transfer not found.');
    }
  }

  private async mapTransfer(transfer: InventoryTransfer, accessibleBranchIds?: number[]) {
    const flowType = this.normalizeFlowType(transfer.flow_type);
    const items = (transfer.items ?? []).map((item) => {
      const requestedQuantity = this.normalizeQuantity(item.requested_quantity);
      const dispatchedQuantity = this.normalizeQuantity(item.dispatched_quantity);
      const receivedQuantity = this.normalizeQuantity(item.received_quantity);
      const shortQuantity = this.normalizeQuantity(item.short_quantity);
      const damagedQuantity = this.normalizeQuantity(item.damaged_quantity);
      const inTransitQuantity = this.computeInTransitQuantity(
        dispatchedQuantity,
        receivedQuantity,
        shortQuantity,
        damagedQuantity,
      );
      const productionStage = this.normalizeProductionStage(item.production_stage);

      return {
        id: item.id,
        item_id: item.item_id,
        item_name: item.item?.item_name ?? `Item #${item.item_id}`,
        item_sku: item.item?.item_sku ?? null,
        uom_base: item.item?.uom_base ?? null,
        production_stage: productionStage,
        production_stage_label: this.mapProductionStageLabel(productionStage),
        requested_quantity: requestedQuantity,
        dispatched_quantity: dispatchedQuantity,
        received_quantity: receivedQuantity,
        in_transit_quantity: inTransitQuantity,
        short_quantity: shortQuantity,
        damaged_quantity: damagedQuantity,
        variance_quantity: this.normalizeQuantity(shortQuantity + damagedQuantity),
        unit_cost: this.normalizeQuantity(item.unit_cost),
        variance_reason: item.variance_reason,
      };
    });

    const events = (transfer.events ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((event) => ({
        id: event.id,
        action: event.action,
        status_after: event.status_after,
        actor_id: event.actor_id,
        actor_name: event.actor_name,
        notes: event.notes,
        metadata: event.metadata_json ? JSON.parse(event.metadata_json) : null,
        created_at: event.created_at,
      }));

    const requestedQuantity = items.reduce((sum, item) => sum + item.requested_quantity, 0);
    const dispatchedQuantity = items.reduce((sum, item) => sum + item.dispatched_quantity, 0);
    const receivedQuantity = items.reduce((sum, item) => sum + item.received_quantity, 0);
    const inTransitQuantity = items.reduce((sum, item) => sum + item.in_transit_quantity, 0);
    const shortQuantity = items.reduce((sum, item) => sum + item.short_quantity, 0);
    const damagedQuantity = items.reduce((sum, item) => sum + item.damaged_quantity, 0);
    const requestedValue = items.reduce((sum, item) => sum + item.requested_quantity * item.unit_cost, 0);
    const dispatchedValue = items.reduce((sum, item) => sum + item.dispatched_quantity * item.unit_cost, 0);
    const receivedValue = items.reduce((sum, item) => sum + item.received_quantity * item.unit_cost, 0);
    const inTransitValue = items.reduce((sum, item) => sum + item.in_transit_quantity * item.unit_cost, 0);
    const varianceQuantity = items.reduce((sum, item) => sum + item.variance_quantity, 0);

    return {
      id: transfer.id,
      transfer_no: transfer.transfer_no,
      client_id: transfer.client_id,
      flow_type: flowType,
      flow_label: this.mapFlowLabel(flowType),
      is_production_supply: flowType === 'production_supply',
      status: transfer.status,
      status_label: this.mapStatusLabel(transfer.status),
      require_approval: transfer.require_approval,
      reason_code: transfer.reason_code,
      origin_production_order_id: transfer.origin_production_order_id,
      origin_production_no: transfer.origin_production_no,
      notes: transfer.notes,
      approval_notes: transfer.approval_notes,
      rejection_notes: transfer.rejection_notes,
      cancellation_notes: transfer.cancellation_notes,
      dispatch_notes: transfer.dispatch_notes,
      receipt_notes: transfer.receipt_notes,
      variance_notes: transfer.variance_notes,
      source_store_label: transfer.source_store_label,
      destination_store_label: transfer.destination_store_label,
      source_branch: transfer.source_branch
        ? {
            id: transfer.source_branch.id,
            branch_name: transfer.source_branch.branch_name,
            branch_code: transfer.source_branch.branch_code,
            inventory_store_type: transfer.source_branch.inventory_store_type,
            is_production_source: transfer.source_branch.is_production_source,
            production_source_label: transfer.source_branch.production_source_label,
          }
        : null,
      destination_branch: transfer.destination_branch
        ? {
            id: transfer.destination_branch.id,
            branch_name: transfer.destination_branch.branch_name,
            branch_code: transfer.destination_branch.branch_code,
            inventory_store_type: transfer.destination_branch.inventory_store_type,
            is_production_source: transfer.destination_branch.is_production_source,
            production_source_label: transfer.destination_branch.production_source_label,
          }
        : null,
      requested_by: transfer.requested_by,
      requested_by_name: transfer.requested_by_name,
      requested_at: transfer.requested_at,
      approved_by: transfer.approved_by,
      approved_by_name: transfer.approved_by_name,
      approved_at: transfer.approved_at,
      rejected_by: transfer.rejected_by,
      rejected_by_name: transfer.rejected_by_name,
      rejected_at: transfer.rejected_at,
      cancelled_by: transfer.cancelled_by,
      cancelled_by_name: transfer.cancelled_by_name,
      cancelled_at: transfer.cancelled_at,
      dispatched_by: transfer.dispatched_by,
      dispatched_by_name: transfer.dispatched_by_name,
      dispatched_at: transfer.dispatched_at,
      received_by: transfer.received_by,
      received_by_name: transfer.received_by_name,
      received_at: transfer.received_at,
      items,
      events,
      summary: {
        line_count: items.length,
        requested_quantity: this.normalizeQuantity(requestedQuantity),
        dispatched_quantity: this.normalizeQuantity(dispatchedQuantity),
        received_quantity: this.normalizeQuantity(receivedQuantity),
        in_transit_quantity: this.normalizeQuantity(inTransitQuantity),
        short_quantity: this.normalizeQuantity(shortQuantity),
        damaged_quantity: this.normalizeQuantity(damagedQuantity),
        requested_value: this.normalizeQuantity(requestedValue),
        dispatched_value: this.normalizeQuantity(dispatchedValue),
        received_value: this.normalizeQuantity(receivedValue),
        in_transit_value: this.normalizeQuantity(inTransitValue),
        variance_quantity: this.normalizeQuantity(varianceQuantity),
        has_in_transit: inTransitQuantity > 0,
        has_variance: varianceQuantity > 0,
      },
      available_actions: this.computeAvailableActions(transfer, accessibleBranchIds),
      finance_clearing: await this.buildClearingSummary(transfer.client_id, transfer),
      finance_review: {
        reviewed: Boolean(transfer.finance_reviewed_at),
        reviewed_at: transfer.finance_reviewed_at,
        reviewed_by_name: transfer.finance_reviewed_by_name,
        review_notes: transfer.finance_review_notes,
      },
    };
  }

  async markFinanceReviewed(
    clientId: string,
    transferId: number,
    notes: string | undefined,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('receive', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'review transfer clearing');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'review transfer clearing');

    const financeClearing = await this.buildClearingSummary(clientId, transfer);
    if (!financeClearing.review_required) {
      throw new BadRequestException('This transfer does not require finance review closure.');
    }

    transfer.finance_reviewed_by = resolveActorId(user) ?? null;
    transfer.finance_reviewed_by_name = this.buildActorName(user);
    transfer.finance_reviewed_at = new Date();
    transfer.finance_review_notes = notes?.trim() || null;
    await this.transferRepo.save(transfer);

    await this.operationalAuditService.log({
      user,
      action: `${this.mapFlowLabel(transfer.flow_type)} Finance Review Completed`,
      entity: 'inventory_transfers',
      clientId,
      branchId: transfer.destination_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} finance review completed`,
      metadata: {
        transfer_no: transfer.transfer_no,
        flow_type: transfer.flow_type,
        variance_amount: financeClearing.variance_amount,
      },
    });

    return this.mapTransfer(await this.getTransferEntity(clientId, transferId), accessibleBranchIds);
  }

  private async getTransferEntity(clientId: string, transferId: number): Promise<InventoryTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { id: transferId, client_id: clientId },
      relations: ['source_branch', 'destination_branch', 'items', 'items.item', 'events'],
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found.');
    }
    transfer.flow_type = this.normalizeFlowType(transfer.flow_type);
    return transfer;
  }

  async create(
    clientId: string,
    dto: CreateInventoryTransferDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const flowType = this.normalizeFlowType(context?.flowType);
    if (dto.source_branch_id === dto.destination_branch_id) {
      throw new BadRequestException('Source and destination branches must be different.');
    }

    const [sourceBranch, destinationBranch] = await Promise.all([
      this.assertBranchBelongsToClient(clientId, dto.source_branch_id, 'create inventory transfers'),
      this.assertBranchBelongsToClient(clientId, dto.destination_branch_id, 'receive inventory transfers'),
    ]);

    this.assertActionAccess('create', accessibleBranchIds, {
      source_branch_id: sourceBranch.id,
      destination_branch_id: destinationBranch.id,
    });

    if (flowType === 'production_supply') {
      this.assertProductionSourceBranch(sourceBranch);
      this.assertProductionDestinationBranch(destinationBranch);
    } else {
      this.assertStockTransferRoutePolicy(sourceBranch, destinationBranch);
    }

    const uniqueItemIds = [...new Set(dto.items.map((item) => item.item_id))];
    if (uniqueItemIds.length !== dto.items.length) {
      throw new BadRequestException('Duplicate items are not allowed in a single transfer request.');
    }

    await Promise.all(uniqueItemIds.map((itemId) => this.assertItemBelongsToClient(clientId, itemId)));
    await this.ensureDestinationOwnership(clientId, destinationBranch.id, uniqueItemIds);

    const normalizedItems = dto.items.map((item) => ({
      item_id: item.item_id,
      requested_quantity: this.normalizeQuantity(item.requested_quantity),
      production_stage: flowType === 'production_supply'
        ? this.normalizeProductionStage(item.production_stage)
        : 'raw',
    }));

    if (flowType === 'production_supply' && normalizedItems.some((item) => item.production_stage === 'raw')) {
      throw new BadRequestException(
        'Production supply lines must be marked as prepared or semi-prepared.',
      );
    }

    const transferNo = await this.generateTransferNo(clientId, flowType);
    const createdTransferId = await this.dataSource.transaction(async (manager) => {
      const transfer = manager.create(InventoryTransfer, {
        client_id: clientId,
        transfer_no: transferNo,
        flow_type: flowType,
        source_branch_id: sourceBranch.id,
        destination_branch_id: destinationBranch.id,
        source_store_label: dto.source_store_label?.trim() || null,
        destination_store_label: dto.destination_store_label?.trim() || null,
        reason_code: dto.reason_code?.trim() || null,
        origin_production_order_id: dto.origin_production_order_id ?? null,
        origin_production_no: dto.origin_production_no?.trim() || null,
        notes: dto.notes?.trim() || null,
        require_approval: dto.require_approval ?? true,
        status: 'requested',
        requested_by: resolveActorId(user) ?? null,
        requested_by_name: this.buildActorName(user),
      });
      const savedTransfer = await manager.save(transfer);

      for (const itemDto of normalizedItems) {
        const unitCost = await this.findLatestUnitCost(clientId, sourceBranch.id, itemDto.item_id);
        const transferItem = manager.create(InventoryTransferItem, {
          client_id: clientId,
          transfer_id: savedTransfer.id,
          item_id: itemDto.item_id,
          production_stage: itemDto.production_stage,
          requested_quantity: itemDto.requested_quantity,
          dispatched_quantity: 0,
          received_quantity: 0,
          short_quantity: 0,
          damaged_quantity: 0,
          unit_cost: unitCost,
        });
        await manager.save(transferItem);
      }

      await this.appendEvent(manager, {
        clientId,
        transferId: savedTransfer.id,
        action: 'requested',
        statusAfter: 'requested',
        user,
        notes: dto.notes?.trim() || null,
        metadata: {
          flow_type: flowType,
          source_branch_id: sourceBranch.id,
          destination_branch_id: destinationBranch.id,
          item_count: normalizedItems.length,
          origin_production_order_id: dto.origin_production_order_id ?? null,
          require_approval: dto.require_approval ?? true,
          production_stages: normalizedItems.map((item) => item.production_stage),
        },
      });

      return savedTransfer.id;
    });

    const transfer = await this.getTransferEntity(clientId, createdTransferId);
    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(flowType, 'Requested'),
      entity: 'inventory_transfers',
      clientId,
      branchId: dto.source_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(flowType)} ${transfer.transfer_no} requested`,
      metadata: {
        flow_type: flowType,
        destination_branch_id: dto.destination_branch_id,
        item_count: normalizedItems.length,
        origin_production_order_id: dto.origin_production_order_id ?? null,
      },
    });

    return this.mapTransfer(transfer, accessibleBranchIds);
  }

  async findAll(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: { status?: string; flow_type?: InventoryTransferFlowType },
  ) {
    const query = this.transferRepo
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.source_branch', 'source_branch')
      .leftJoinAndSelect('transfer.destination_branch', 'destination_branch')
      .leftJoinAndSelect('transfer.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .leftJoinAndSelect('transfer.events', 'events')
      .where('transfer.client_id = :clientId', { clientId });

    if (filters?.status && INVENTORY_TRANSFER_STATUSES.includes(filters.status as any)) {
      query.andWhere('transfer.status = :status', { status: filters.status });
    }
    if (filters?.flow_type && INVENTORY_TRANSFER_FLOW_TYPES.includes(filters.flow_type)) {
      query.andWhere('transfer.flow_type = :flowType', { flowType: filters.flow_type });
    }
    if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('transfer.source_branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds })
            .orWhere('transfer.destination_branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }),
      );
    }

    const transfers = await query
      .orderBy('transfer.created_at', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .addOrderBy('events.created_at', 'ASC')
      .getMany();

    return Promise.all(transfers.map((transfer) => this.mapTransfer(transfer, accessibleBranchIds)));
  }

  async getBranchOptions(
    clientId: string,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const flowType = this.normalizeFlowType(context?.flowType);
    const branches = await this.branchRepo.find({
      where: { client_id: clientId, status: 'active' },
      order: { branch_name: 'ASC' },
    });

    return branches.map((branch) => ({
      id: branch.id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      inventory_store_type: branch.inventory_store_type,
      is_production_source: branch.is_production_source,
      production_source_label: branch.production_source_label,
      has_access: this.hasBranchAccess(accessibleBranchIds, branch.id),
      can_source_production_supply: branch.is_production_source,
      can_receive_production_supply: branch.inventory_store_type === 'branch',
      preferred_for_flow: flowType === 'production_supply'
        ? branch.is_production_source
        : branch.inventory_store_type === 'central',
    }));
  }

  async findOne(
    clientId: string,
    transferId: number,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('create', accessibleBranchIds, transfer);
    return this.mapTransfer(transfer, accessibleBranchIds);
  }

  async approve(
    clientId: string,
    transferId: number,
    notes: string | undefined,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('approve', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'approve transfers');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'approve transfers');

    if (!transfer.require_approval) {
      throw new BadRequestException('This transfer does not require approval.');
    }
    if (transfer.status !== 'requested') {
      throw new BadRequestException('Only requested transfers can be approved.');
    }

    await this.dataSource.transaction(async (manager) => {
      transfer.status = 'approved';
      transfer.approved_by = resolveActorId(user) ?? null;
      transfer.approved_by_name = this.buildActorName(user);
      transfer.approved_at = new Date();
      transfer.approval_notes = notes?.trim() || null;
      await manager.save(transfer);
      await this.appendEvent(manager, {
        clientId,
        transferId,
        action: 'approved',
        statusAfter: 'approved',
        user,
        notes: notes?.trim() || null,
        metadata: { flow_type: transfer.flow_type },
      });
    });

    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(transfer.flow_type, 'Approved'),
      entity: 'inventory_transfers',
      clientId,
      branchId: transfer.source_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} approved`,
      metadata: { flow_type: transfer.flow_type },
    });

    return this.findOne(clientId, transferId, accessibleBranchIds, context);
  }

  async reject(
    clientId: string,
    transferId: number,
    notes: string | undefined,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('reject', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'reject transfers');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'reject transfers');

    if (!['requested', 'approved'].includes(transfer.status)) {
      throw new BadRequestException('Only requested or approved transfers can be rejected.');
    }

    await this.dataSource.transaction(async (manager) => {
      transfer.status = 'rejected';
      transfer.rejected_by = resolveActorId(user) ?? null;
      transfer.rejected_by_name = this.buildActorName(user);
      transfer.rejected_at = new Date();
      transfer.rejection_notes = notes?.trim() || null;
      await manager.save(transfer);
      await this.appendEvent(manager, {
        clientId,
        transferId,
        action: 'rejected',
        statusAfter: 'rejected',
        user,
        notes: notes?.trim() || null,
        metadata: { flow_type: transfer.flow_type },
      });
    });

    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(transfer.flow_type, 'Rejected'),
      entity: 'inventory_transfers',
      clientId,
      branchId: transfer.source_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} rejected`,
      metadata: { flow_type: transfer.flow_type },
    });

    return this.findOne(clientId, transferId, accessibleBranchIds, context);
  }

  async cancel(
    clientId: string,
    transferId: number,
    notes: string | undefined,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('cancel', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'cancel transfers');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'cancel transfers');

    if (!['requested', 'approved'].includes(transfer.status)) {
      throw new BadRequestException('Only requested or approved transfers can be cancelled.');
    }

    await this.dataSource.transaction(async (manager) => {
      transfer.status = 'cancelled';
      transfer.cancelled_by = resolveActorId(user) ?? null;
      transfer.cancelled_by_name = this.buildActorName(user);
      transfer.cancelled_at = new Date();
      transfer.cancellation_notes = notes?.trim() || null;
      await manager.save(transfer);
      await this.appendEvent(manager, {
        clientId,
        transferId,
        action: 'cancelled',
        statusAfter: 'cancelled',
        user,
        notes: notes?.trim() || null,
        metadata: { flow_type: transfer.flow_type },
      });
    });

    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(transfer.flow_type, 'Cancelled'),
      entity: 'inventory_transfers',
      clientId,
      branchId: transfer.source_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} cancelled`,
      metadata: {
        flow_type: transfer.flow_type,
        destination_branch_id: transfer.destination_branch_id,
      },
    });

    return this.findOne(clientId, transferId, accessibleBranchIds, context);
  }

  async dispatch(
    clientId: string,
    transferId: number,
    dto: DispatchInventoryTransferDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('dispatch', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'dispatch transfers');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'dispatch transfers');

    if (transfer.status !== 'approved' && !(transfer.status === 'requested' && !transfer.require_approval)) {
      throw new BadRequestException('Transfer is not ready for dispatch.');
    }

    const dispatchMap = new Map(dto.items.map((item) => [item.transfer_item_id, item]));
    if (dispatchMap.size !== transfer.items.length) {
      throw new BadRequestException('Dispatch quantities must be provided for every transfer line.');
    }

    await this.ensureSourceOwnership(
      clientId,
      transfer.source_branch_id,
      transfer.items.map((item) => item.item_id),
    );

    await this.dataSource.transaction(async (manager) => {
      const dispatchTimestamp = new Date();

      for (const line of transfer.items) {
        const dispatchInput = dispatchMap.get(line.id);
        if (!dispatchInput) {
          throw new BadRequestException(`Missing dispatch quantity for line ${line.id}.`);
        }

        const dispatchQuantity = this.normalizeQuantity(dispatchInput.dispatch_quantity);
        const requestedQuantity = this.normalizeQuantity(line.requested_quantity);
        if (dispatchQuantity <= 0) {
          throw new BadRequestException('Dispatch quantity must be greater than zero.');
        }
        if (dispatchQuantity > requestedQuantity) {
          throw new BadRequestException(
            `Dispatch quantity for ${line.item.item_name} exceeds the requested quantity.`,
          );
        }

        const stockLevel = await manager.findOne(StockLevel, {
          where: { client_id: clientId, branch_id: transfer.source_branch_id, item_id: line.item_id },
        });
        const availableQuantity = this.normalizeQuantity(stockLevel?.current_quantity ?? 0);
        if (availableQuantity < dispatchQuantity) {
          throw new BadRequestException(
            `Insufficient source stock for ${line.item.item_name}. Available ${availableQuantity}, requested ${dispatchQuantity}.`,
          );
        }

        const unitCost = this.normalizeQuantity(
          line.unit_cost || (await this.findLatestUnitCost(clientId, transfer.source_branch_id, line.item_id)),
        );

        stockLevel!.current_quantity = this.normalizeQuantity(Number(stockLevel!.current_quantity) - dispatchQuantity);
        await manager.save(stockLevel!);

        const ledgerEntry = manager.create(StockLedger, {
          client_id: clientId,
          branch_id: transfer.source_branch_id,
          item_id: line.item_id,
          quantity: -dispatchQuantity,
          transaction_type: this.getLedgerTransactionType(transfer.flow_type),
          reference_id: `${transfer.transfer_no}:OUT`,
          unit_cost: unitCost,
        });
        await manager.save(ledgerEntry);

        line.dispatched_quantity = dispatchQuantity;
        line.unit_cost = unitCost;
        await manager.save(line);
      }

      transfer.status = 'in_transit';
      transfer.dispatched_by = resolveActorId(user) ?? null;
      transfer.dispatched_by_name = this.buildActorName(user);
      transfer.dispatched_at = dispatchTimestamp;
      transfer.dispatch_notes = dto.notes?.trim() || null;
      await manager.save(transfer);

      await this.appendEvent(manager, {
        clientId,
        transferId,
        action: 'dispatched',
        statusAfter: 'in_transit',
        user,
        notes: dto.notes?.trim() || null,
        metadata: {
          flow_type: transfer.flow_type,
          line_count: transfer.items.length,
        },
      });
    });

    await this.postDispatchClearingJournal(clientId, transfer, user);

    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(transfer.flow_type, 'Dispatched'),
      entity: 'inventory_stock_ledger',
      clientId,
      branchId: transfer.source_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} dispatched`,
      metadata: {
        flow_type: transfer.flow_type,
        destination_branch_id: transfer.destination_branch_id,
        line_count: transfer.items.length,
      },
    });

    return this.findOne(clientId, transferId, accessibleBranchIds, context);
  }

  async receive(
    clientId: string,
    transferId: number,
    dto: ReceiveInventoryTransferDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
    context?: TransferFlowContext,
  ) {
    const transfer = await this.getTransferEntity(clientId, transferId);
    this.assertTransferMatchesFlow(transfer, context?.flowType);
    this.assertActionAccess('receive', accessibleBranchIds, transfer);
    assertBranchOperationalWriteAllowed(transfer.source_branch, 'receive transfers');
    assertBranchOperationalWriteAllowed(transfer.destination_branch, 'receive transfers');

    if (transfer.status !== 'in_transit') {
      throw new BadRequestException('Only in-transit transfers can be received.');
    }

    await this.ensureDestinationOwnership(
      clientId,
      transfer.destination_branch_id,
      transfer.items.map((item) => item.item_id),
    );

    const receiptMap = new Map(dto.items.map((item) => [item.transfer_item_id, item]));
    if (receiptMap.size !== transfer.items.length) {
      throw new BadRequestException('Receipt quantities must be provided for every transfer line.');
    }

    await this.dataSource.transaction(async (manager) => {
      const receiptTimestamp = new Date();

      for (const line of transfer.items) {
        const receiptInput = receiptMap.get(line.id);
        if (!receiptInput) {
          throw new BadRequestException(`Missing receipt detail for line ${line.id}.`);
        }

        const dispatchedQuantity = this.normalizeQuantity(line.dispatched_quantity);
        const receivedQuantity = this.normalizeQuantity(receiptInput.received_quantity);
        const shortQuantity = this.normalizeQuantity(receiptInput.short_quantity ?? 0);
        const damagedQuantity = this.normalizeQuantity(receiptInput.damaged_quantity ?? 0);
        const varianceTotal = this.normalizeQuantity(shortQuantity + damagedQuantity);

        if (dispatchedQuantity <= 0) {
          throw new BadRequestException(`Line ${line.id} was not dispatched and cannot be received.`);
        }
        if (receivedQuantity > dispatchedQuantity) {
          throw new BadRequestException(
            `Received quantity for ${line.item.item_name} cannot exceed dispatched quantity.`,
          );
        }
        if (this.normalizeQuantity(receivedQuantity + varianceTotal) !== dispatchedQuantity) {
          throw new BadRequestException(
            `Received, short, and damaged quantities for ${line.item.item_name} must total the dispatched quantity.`,
          );
        }
        if (varianceTotal > 0 && !(receiptInput.variance_reason?.trim() || dto.variance_notes?.trim())) {
          throw new BadRequestException(
            `Variance reason is required for ${line.item.item_name} when quantities do not fully match.`,
          );
        }

        let stockLevel = await manager.findOne(StockLevel, {
          where: { client_id: clientId, branch_id: transfer.destination_branch_id, item_id: line.item_id },
        });
        if (!stockLevel) {
          stockLevel = manager.create(StockLevel, {
            client_id: clientId,
            branch_id: transfer.destination_branch_id,
            item_id: line.item_id,
            current_quantity: 0,
            last_unit_cost: 0,
            last_received_at: null,
          });
        }

        stockLevel.current_quantity = this.normalizeQuantity(Number(stockLevel.current_quantity) + receivedQuantity);
        if (receivedQuantity > 0) {
          const unitCost = this.normalizeQuantity(line.unit_cost);
          if (unitCost > 0) {
            stockLevel.last_unit_cost = unitCost;
          }
          stockLevel.last_received_at = receiptTimestamp;
        }
        await manager.save(stockLevel);

        if (receivedQuantity > 0) {
          const ledgerEntry = manager.create(StockLedger, {
            client_id: clientId,
            branch_id: transfer.destination_branch_id,
            item_id: line.item_id,
            quantity: receivedQuantity,
            transaction_type: this.getLedgerTransactionType(transfer.flow_type),
            reference_id: `${transfer.transfer_no}:IN`,
            unit_cost: this.normalizeQuantity(line.unit_cost),
          });
          await manager.save(ledgerEntry);
        }

        line.received_quantity = receivedQuantity;
        line.short_quantity = shortQuantity;
        line.damaged_quantity = damagedQuantity;
        line.variance_reason = receiptInput.variance_reason?.trim() || null;
        await manager.save(line);
      }

      const hasVariance = transfer.items.some((line) => {
        const receiptInput = receiptMap.get(line.id)!;
        return this.normalizeQuantity(receiptInput.short_quantity ?? 0)
          + this.normalizeQuantity(receiptInput.damaged_quantity ?? 0) > 0;
      });

      transfer.status = hasVariance ? 'received_with_variance' : 'received';
      transfer.received_by = resolveActorId(user) ?? null;
      transfer.received_by_name = this.buildActorName(user);
      transfer.received_at = receiptTimestamp;
      transfer.receipt_notes = dto.notes?.trim() || null;
      transfer.variance_notes = dto.variance_notes?.trim() || null;
      await manager.save(transfer);

      await this.appendEvent(manager, {
        clientId,
        transferId,
        action: 'received',
        statusAfter: transfer.status,
        user,
        notes: dto.notes?.trim() || dto.variance_notes?.trim() || null,
        metadata: {
          flow_type: transfer.flow_type,
          has_variance: hasVariance,
        },
      });
    });

    await this.postReceiptClearingJournal(clientId, transfer, user);
    await this.postInternalRechargeJournals(clientId, transfer, user);

    await this.operationalAuditService.log({
      user,
      action: this.buildAuditAction(transfer.flow_type, 'Received'),
      entity: 'inventory_stock_ledger',
      clientId,
      branchId: transfer.destination_branch_id,
      entityId: transfer.id,
      details: `${this.mapFlowLabel(transfer.flow_type)} ${transfer.transfer_no} received`,
      metadata: {
        flow_type: transfer.flow_type,
        source_branch_id: transfer.source_branch_id,
      },
    });

    return this.findOne(clientId, transferId, accessibleBranchIds, context);
  }
}
