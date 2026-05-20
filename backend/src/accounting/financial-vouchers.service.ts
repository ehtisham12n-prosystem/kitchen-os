import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { FinancialVoucher, VoucherType, VoucherStatus } from './entities/financial-voucher.entity';
import { Branch } from '../setup/entities/branch.entity';
import { CreateFinancialVoucherDto, UpdateFinancialVoucherStatusDto } from './dto/accounting-write.dto';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { createDefaultClientNumberingSettings, type BranchDocumentRule } from '../setup/branches/branch-config.types';
import { nextBranchDocumentNumber } from '../setup/branches/branch-document.util';
import { AccountingService } from './accounting.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AccountScope } from './dto/accounting-write.dto';
import { ChartOfAccount } from './entities/chart-of-accounts.entity';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { Vendor } from '../inventory/entities/vendor.entity';
import { GoodsReceiptNote } from '../inventory-op/entities/goods-receipt-note.entity';

@Injectable()
export class FinancialVouchersService {
  constructor(
    @InjectRepository(FinancialVoucher)
    private readonly voucherRepo: Repository<FinancialVoucher>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly accountingService: AccountingService,
    private readonly approvalsService: ApprovalsService,
    private readonly dataSource: DataSource,
  ) {}

  private isBankLikePaymentMethod(paymentMethod?: string | null): boolean {
    const normalized = String(paymentMethod ?? '').trim().toLowerCase();
    return ['bank transfer', 'cheque', 'check', 'card', 'mobile wallet'].includes(normalized);
  }

  private isCreditPurchaseMethod(paymentMethod?: string | null): boolean {
    return String(paymentMethod ?? '').trim().toLowerCase() === 'credit purchase';
  }

  private isPurchaseCreditNoteType(voucherType?: VoucherType | null): boolean {
    return voucherType === VoucherType.PURCHASE_CREDIT_NOTE;
  }

  private roundMoney(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  private diffInDays(asOfDate: string, dueDate: string): number {
    const end = new Date(`${asOfDate}T00:00:00`);
    const start = new Date(`${dueDate}T00:00:00`);
    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
      return 0;
    }
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private resolveCashAccountCode(paymentMethod?: string | null): '1101' | '1102' {
    if (this.isBankLikePaymentMethod(paymentMethod)) {
      return '1102';
    }
    return '1101';
  }

  private async resolveTreasuryAccount(
    clientId: string,
    branchId: number,
    voucherType: VoucherType,
    treasuryAccountId?: number | null,
    paymentMethod?: string | null,
  ) {
    if (this.isPurchaseCreditNoteType(voucherType)) {
      return null;
    }

    if (this.isCreditPurchaseMethod(paymentMethod)) {
      return null;
    }

    if (!treasuryAccountId) {
      const offsetCode = this.resolveCashAccountCode(paymentMethod);
      const offsetName = offsetCode === '1102' ? 'Bank Current Account' : 'Cash on Hand';
      return this.accountingService.ensureDefaultAccount(clientId, offsetCode, offsetName, 'asset');
    }

    const treasuryAccount = await this.dataSource.getRepository(ChartOfAccount).findOne({
      where: { id: treasuryAccountId, client_id: clientId },
    });
    if (!treasuryAccount) {
      throw new NotFoundException(`Treasury account ${treasuryAccountId} not found.`);
    }
    if (treasuryAccount.account_type !== 'asset') {
      throw new BadRequestException('Treasury source must be an asset account.');
    }
    if (treasuryAccount.scope === AccountScope.BRANCH && treasuryAccount.branch_id && treasuryAccount.branch_id !== branchId) {
      throw new BadRequestException(`Treasury account ${treasuryAccount.account_code} is not available for branch ${branchId}.`);
    }
    if (!treasuryAccount.is_bank_account && !treasuryAccount.is_cash_account) {
      throw new BadRequestException('Treasury source must be a configured bank or cash account.');
    }

    const normalized = String(paymentMethod ?? '').trim().toLowerCase();
    if (normalized === 'cash' && !treasuryAccount.is_cash_account) {
      throw new BadRequestException('Cash payments must use a cash treasury account.');
    }
    if (this.isBankLikePaymentMethod(paymentMethod) && !treasuryAccount.is_bank_account) {
      throw new BadRequestException(`${paymentMethod} payments must use a bank treasury account.`);
    }

    return treasuryAccount;
  }

  private async resolveVoucherParty(
    clientId: string,
    voucherType: VoucherType,
    paymentMethod?: string | null,
    partyType?: string | null,
    partyId?: string | null,
    partyName?: string | null,
  ): Promise<{ party_type: any; party_id: string | null; party_name: string | null }> {
    const trimmedPartyId = String(partyId ?? '').trim() || null;
    const trimmedPartyName = String(partyName ?? '').trim() || null;
    const normalizedPartyType = partyType ?? null;
    const needsVendorForCreditExpense = voucherType === VoucherType.EXPENSE && this.isCreditPurchaseMethod(paymentMethod);
    const needsVendorForPurchaseCreditNote = this.isPurchaseCreditNoteType(voucherType);

    if (!needsVendorForCreditExpense && !needsVendorForPurchaseCreditNote && normalizedPartyType !== 'VENDOR') {
      return {
        party_type: normalizedPartyType ?? 'OTHER',
        party_id: trimmedPartyId,
        party_name: trimmedPartyName,
      };
    }

    if (!trimmedPartyId && !trimmedPartyName) {
      throw new BadRequestException(
        needsVendorForPurchaseCreditNote
          ? 'Vendor details are required for purchase credit notes.'
          : 'Vendor details are required for credit purchases.',
      );
    }

    if (trimmedPartyId) {
      const vendor = await this.dataSource.getRepository(Vendor).findOne({
        where: { id: Number(trimmedPartyId), client_id: clientId },
      });
      if (!vendor || vendor.is_active === false) {
        throw new BadRequestException(`Vendor ${trimmedPartyId} is not available for this client.`);
      }
      return {
        party_type: 'VENDOR',
        party_id: String(vendor.id),
        party_name: vendor.vendor_name,
      };
    }

    return {
      party_type: 'VENDOR',
      party_id: null,
      party_name: trimmedPartyName,
    };
  }

  private async resolveExpenseAccount(
    clientId: string,
    branchId: number,
    voucherType: VoucherType,
    expenseAccountId?: number | null,
  ) {
    if (voucherType !== VoucherType.EXPENSE) {
      return null;
    }
    if (!expenseAccountId) {
      throw new BadRequestException('Expense vouchers require an expense account.');
    }

    const expenseAccount = await this.dataSource.getRepository(ChartOfAccount).findOne({
      where: { id: expenseAccountId, client_id: clientId },
    });
    if (!expenseAccount) {
      throw new NotFoundException(`Expense account ${expenseAccountId} not found.`);
    }
    if (expenseAccount.account_type !== 'expense') {
      throw new BadRequestException('Selected expense account must be an expense-type account.');
    }
    if (!expenseAccount.is_active) {
      throw new BadRequestException('Selected expense account is inactive.');
    }
    if (expenseAccount.scope === AccountScope.BRANCH && expenseAccount.branch_id && expenseAccount.branch_id !== branchId) {
      throw new BadRequestException(`Expense account ${expenseAccount.account_code} is not available for branch ${branchId}.`);
    }
    if (expenseAccount.is_control_account) {
      throw new BadRequestException('Control accounts cannot be used for direct expense vouchers.');
    }

    return expenseAccount;
  }

  private async resolveLinkedGrnForPurchaseCreditNote(
    clientId: string,
    branchId: number,
    voucherType: VoucherType,
    linkedGrnId?: number | null,
    vendorId?: string | null,
    excludeVoucherId?: number | null,
  ) {
    if (!this.isPurchaseCreditNoteType(voucherType)) {
      return null;
    }
    if (!linkedGrnId) {
      throw new BadRequestException('Purchase credit notes must be linked to a GRN.');
    }

    const grn = await this.dataSource.getRepository(GoodsReceiptNote).findOne({
      where: { id: linkedGrnId, client_id: clientId },
      relations: ['vendor'],
    });
    if (!grn || grn.status !== 'posted') {
      throw new NotFoundException(`Linked GRN ${linkedGrnId} was not found.`);
    }
    if (grn.branch_id !== branchId) {
      throw new BadRequestException('Purchase credit note branch must match the linked GRN branch.');
    }
    if (!grn.vendor_id) {
      throw new BadRequestException('Linked GRN is missing vendor information.');
    }
    if (vendorId && Number(vendorId) !== Number(grn.vendor_id)) {
      throw new BadRequestException('Selected vendor must match the linked GRN vendor.');
    }

    const payableRows = await this.dataSource.query(
      `
      SELECT
        grn.payable_status,
        GREATEST(COALESCE(grn.vendor_bill_amount, COALESCE(SUM(item.line_total), 0)) - COALESCE(ret.total_returned, 0), 0) AS net_liability,
        COALESCE(alloc.total_allocated, 0) AS paid_amount,
        COALESCE(credit.total_credited, 0) AS credited_amount
      FROM goods_receipt_notes grn
      INNER JOIN goods_receipt_note_items item
        ON item.grn_id = grn.id
      LEFT JOIN (
        SELECT return_doc.grn_id, COALESCE(SUM(return_item.line_total), 0) AS total_returned
        FROM goods_receipt_returns return_doc
        INNER JOIN goods_receipt_return_items return_item
          ON return_item.return_id = return_doc.id
        WHERE return_doc.client_id = ?
          AND return_doc.status = 'posted'
        GROUP BY return_doc.grn_id
      ) ret ON ret.grn_id = grn.id
      LEFT JOIN (
        SELECT grn_id, COALESCE(SUM(allocated_amount), 0) AS total_allocated
        FROM accounting_payable_allocations
        WHERE client_id = ?
          AND grn_id IS NOT NULL
        GROUP BY grn_id
      ) alloc ON alloc.grn_id = grn.id
      LEFT JOIN (
        SELECT linked_grn_id, COALESCE(SUM(amount), 0) AS total_credited
        FROM financial_vouchers
        WHERE client_id = ?
          AND type = 'PURCHASE_CREDIT_NOTE'
          AND status = 'APPROVED'
          ${excludeVoucherId ? 'AND id <> ?' : ''}
        GROUP BY linked_grn_id
      ) credit ON credit.linked_grn_id = grn.id
      WHERE grn.client_id = ?
        AND grn.id = ?
      GROUP BY grn.id, grn.payable_status, alloc.total_allocated, credit.total_credited
      `,
      excludeVoucherId
        ? [clientId, clientId, clientId, excludeVoucherId, clientId, linkedGrnId]
        : [clientId, clientId, clientId, clientId, linkedGrnId],
    );

    const payableRow = payableRows[0];
    if (!payableRow) {
      throw new BadRequestException('Unable to resolve linked GRN liability.');
    }

    const netLiability = this.roundMoney(payableRow.net_liability);
    const paidAmount = this.roundMoney(payableRow.paid_amount);
    const creditedAmount = this.roundMoney(payableRow.credited_amount);
    const outstandingAmount = this.roundMoney(Math.max(netLiability - paidAmount - creditedAmount, 0));

    if (outstandingAmount <= 0.009) {
      throw new BadRequestException('Linked GRN has no open liability remaining for a purchase credit note.');
    }

    return {
      grn,
      payable_status: String(payableRow.payable_status ?? grn.payable_status),
      net_liability: netLiability,
      paid_amount: paidAmount,
      credited_amount: creditedAmount,
      outstanding_amount: outstandingAmount,
    };
  }

  private async postVoucherJournal(clientId: string, voucher: FinancialVoucher) {
    if (voucher.posted_journal_entry_id) {
      return this.accountingService.getJournalEntry(clientId, voucher.posted_journal_entry_id);
    }

    const treasuryAccount = await this.resolveTreasuryAccount(
      clientId,
      voucher.branch_id,
      voucher.type,
      voucher.treasury_account_id,
      voucher.payment_method,
    );

    let debitAccountId: number;
    const paymentSourceSuffix = voucher.payment_source_label?.trim()
      ? ` via ${voucher.payment_source_label.trim()}`
      : '';
    let description = voucher.description?.trim() || `${voucher.type} voucher ${voucher.voucher_no}${paymentSourceSuffix}`;

    if (voucher.type === VoucherType.PAYMENT) {
      const apAccount = await this.accountingService.ensureDefaultAccount(clientId, '2100', 'Accounts Payable', 'liability');
      debitAccountId = apAccount.id;
      description = description || `Vendor payment ${voucher.voucher_no}${paymentSourceSuffix}`;
    } else if (voucher.type === VoucherType.PURCHASE_CREDIT_NOTE) {
      const linkedGrn = await this.resolveLinkedGrnForPurchaseCreditNote(
        clientId,
        voucher.branch_id,
        voucher.type,
        voucher.linked_grn_id,
        voucher.party_id,
        voucher.id,
      );
      if (!linkedGrn) {
        throw new BadRequestException('Purchase credit notes must be linked to a valid GRN.');
      }
      if (this.roundMoney(voucher.amount) - linkedGrn.outstanding_amount > 0.009) {
        throw new BadRequestException(
          `Purchase credit note exceeds the linked GRN open liability. Available ${linkedGrn.outstanding_amount.toFixed(2)}.`,
        );
      }
      const offsetCode = linkedGrn.payable_status === 'bill_received' ? '2100' : '2110';
      const offsetName = linkedGrn.payable_status === 'bill_received' ? 'Accounts Payable' : 'Goods Received Not Invoiced';
      const liabilityAccount = await this.accountingService.ensureDefaultAccount(clientId, offsetCode, offsetName, 'liability');
      debitAccountId = liabilityAccount.id;
      description = description || `Vendor credit note ${voucher.voucher_no} for ${linkedGrn.grn.grn_number}`;
    } else if (voucher.type === VoucherType.COMPENSATION) {
      const salaryAccount = await this.accountingService.ensureDefaultAccount(clientId, '5200', 'Salaries & Wages', 'expense');
      debitAccountId = salaryAccount.id;
    } else {
      if (!voucher.expense_account_id) {
        throw new BadRequestException('Expense vouchers require an expense account before approval.');
      }
      debitAccountId = voucher.expense_account_id;
    }

    const offsetAccount = voucher.type === VoucherType.PURCHASE_CREDIT_NOTE
      ? await this.accountingService.ensureDefaultAccount(clientId, '5051', 'Purchase Credits & Rebates', 'expense')
      : voucher.type === VoucherType.EXPENSE && this.isCreditPurchaseMethod(voucher.payment_method)
        ? await this.accountingService.ensureDefaultAccount(clientId, '2100', 'Accounts Payable', 'liability')
        : treasuryAccount;

    if (!offsetAccount) {
      throw new BadRequestException('A treasury or payable offset account is required before approval.');
    }

    const journal = await this.accountingService.createJournalEntry(clientId, voucher.branch_id, {
      branch_id: voucher.branch_id,
      transaction_date: new Date(`${voucher.date}T12:00:00`),
      business_date: voucher.date,
      description,
      reference_id: voucher.voucher_no,
      source_module: 'accounting',
      source_entity_type: 'financial_voucher',
      source_entity_id: String(voucher.id),
      source_event: 'voucher_approval',
      posting_type: 'auto',
      items: [
        { account_id: debitAccountId, debit: this.roundMoney(voucher.amount), credit: 0 },
        { account_id: offsetAccount.id, debit: 0, credit: this.roundMoney(voucher.amount) },
      ],
    });

    if (voucher.type === VoucherType.PAYMENT && voucher.party_type === 'VENDOR' && voucher.party_id) {
      await this.accountingService.allocateVendorPayment(
        clientId,
        voucher.branch_id,
        voucher.id,
        Number(voucher.party_id),
        Number(voucher.amount),
        voucher.date,
        journal.id,
        voucher.description ?? null,
      );
    }

    voucher.posted_journal_entry_id = journal.id;
    return journal;
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId?: number,
    operation?: string,
  ): Promise<Branch | null> {
    if (!branchId) {
      return null;
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

  async create(
    clientId: string,
    branchId: number,
    dto: CreateFinancialVoucherDto,
    actorId?: string,
    user?: JwtPayload,
  ): Promise<FinancialVoucher> {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'create financial vouchers');
    await this.accountingService.assertPeriodUnlockedForOperation(clientId, branchId, dto.date, 'Voucher creation', user);
    const treasuryAccount = await this.resolveTreasuryAccount(clientId, branchId, dto.type, dto.treasury_account_id, dto.payment_method);
    await this.resolveExpenseAccount(clientId, branchId, dto.type, dto.expense_account_id);
    const resolvedParty = await this.resolveVoucherParty(
      clientId,
      dto.type,
      dto.payment_method,
      dto.party_type,
      dto.party_id,
      dto.party_name,
    );
    const linkedGrn = await this.resolveLinkedGrnForPurchaseCreditNote(
      clientId,
      branchId,
      dto.type,
      dto.linked_grn_id,
      resolvedParty.party_id,
    );
    if (linkedGrn && this.roundMoney(dto.amount) - linkedGrn.outstanding_amount > 0.009) {
      throw new BadRequestException(
        `Purchase credit note exceeds the linked GRN open liability. Available ${linkedGrn.outstanding_amount.toFixed(2)}.`,
      );
    }
    const createdBy = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
    const settings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });
    const defaults = createDefaultClientNumberingSettings().rules;

    return this.dataSource.transaction(async (manager) => {
      const typeKey = dto.type === VoucherType.PAYMENT
        ? 'payment_voucher'
        : dto.type === VoucherType.COMPENSATION
          ? 'compensation_voucher'
          : 'expense_voucher';
      const rule: BranchDocumentRule = {
        ...defaults[typeKey],
        ...(branch?.document_settings?.[typeKey] ?? {}),
        ...(settings?.numbering_settings?.rules?.[typeKey] ?? {}),
      };

      const voucherNo = await nextBranchDocumentNumber({
        repository: manager.getRepository(FinancialVoucher),
        alias: 'voucher',
        clientId,
        branchId,
        branchCode: branch?.branch_code ?? `BR${branchId}`,
        rule,
        documentColumn: 'voucher_no',
        applyScope: (query) => {
          query.andWhere('voucher.type = :voucherType', { voucherType: dto.type });
        },
      });

      const voucherPayload: Partial<FinancialVoucher> = {
        ...dto,
        party_type: resolvedParty.party_type,
        party_id: resolvedParty.party_id ?? undefined,
        party_name: resolvedParty.party_name ?? undefined,
        treasury_account_id: this.isCreditPurchaseMethod(dto.payment_method) || this.isPurchaseCreditNoteType(dto.type) ? null : (dto.treasury_account_id ?? null),
        payment_source_label: this.isPurchaseCreditNoteType(dto.type)
          ? 'Vendor Credit Note'
          : this.isCreditPurchaseMethod(dto.payment_method)
          ? (dto.payment_source_label?.trim() || 'Accounts Payable')
          : (dto.payment_source_label?.trim() || treasuryAccount?.account_name),
        linked_grn_id: linkedGrn?.grn.id ?? dto.linked_grn_id ?? null,
        client_id: clientId,
        branch_id: branchId,
        voucher_no: voucherNo,
        created_by: createdBy ?? undefined,
        status: VoucherStatus.PENDING,
      };
      const voucher = manager.create(FinancialVoucher, voucherPayload);

      const savedVoucher = await manager.save(voucher);
      await this.approvalsService.submit({
        client_id: clientId,
        module: 'accounting',
        entity_id: savedVoucher.id,
        action_type: 'voucher_approval',
        requested_by: createdBy ?? 'system',
        branch_id: branchId,
        notes: savedVoucher.description ?? null,
      });
      return savedVoucher;
    });
  }

  async update(
    clientId: string,
    id: number,
    dto: CreateFinancialVoucherDto,
    accessibleBranchIds?: number[],
    branchId?: number,
    actorId?: string,
    user?: JwtPayload,
  ): Promise<FinancialVoucher> {
    const voucher = await this.findOne(clientId, id, accessibleBranchIds);
    const nextBranchId = branchId ?? voucher.branch_id;
    await this.assertBranchBelongsToClient(clientId, nextBranchId, 'update financial vouchers');
    await this.accountingService.assertPeriodUnlockedForOperation(clientId, nextBranchId, dto.date, 'Voucher update', user);
    const treasuryAccount = await this.resolveTreasuryAccount(clientId, nextBranchId, dto.type, dto.treasury_account_id, dto.payment_method);
    await this.resolveExpenseAccount(clientId, nextBranchId, dto.type, dto.expense_account_id);
    const resolvedParty = await this.resolveVoucherParty(
      clientId,
      dto.type,
      dto.payment_method,
      dto.party_type,
      dto.party_id,
      dto.party_name,
    );
    const linkedGrn = await this.resolveLinkedGrnForPurchaseCreditNote(
      clientId,
      nextBranchId,
      dto.type,
      dto.linked_grn_id,
      resolvedParty.party_id,
      voucher.id,
    );
    if (linkedGrn && this.roundMoney(dto.amount) - linkedGrn.outstanding_amount > 0.009) {
      throw new BadRequestException(
        `Purchase credit note exceeds the linked GRN open liability. Available ${linkedGrn.outstanding_amount.toFixed(2)}.`,
      );
    }
    if (voucher.status === VoucherStatus.APPROVED || voucher.status === VoucherStatus.VOID) {
      throw new BadRequestException('Approved or void vouchers cannot be edited.');
    }
    const createdBy = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;

    voucher.branch_id = nextBranchId;
    voucher.type = dto.type;
    voucher.party_type = resolvedParty.party_type;
    voucher.party_id = resolvedParty.party_id as any;
    voucher.party_name = resolvedParty.party_name as any;
    voucher.amount = dto.amount;
    voucher.date = dto.date;
    voucher.payment_method = dto.payment_method ?? null as any;
    voucher.payment_source_label = this.isPurchaseCreditNoteType(dto.type)
      ? 'Vendor Credit Note'
      : this.isCreditPurchaseMethod(dto.payment_method)
      ? (dto.payment_source_label?.trim() || 'Accounts Payable')
      : (dto.payment_source_label?.trim() || treasuryAccount?.account_name || null as any);
    voucher.reference_no = dto.reference_no ?? null as any;
    voucher.description = dto.description ?? null as any;
    voucher.expense_account_id = dto.expense_account_id ?? null;
    voucher.treasury_account_id = this.isCreditPurchaseMethod(dto.payment_method) || this.isPurchaseCreditNoteType(dto.type) ? null : (dto.treasury_account_id ?? null);
    voucher.linked_grn_id = linkedGrn?.grn.id ?? dto.linked_grn_id ?? null;
    voucher.created_by = createdBy ?? voucher.created_by;

    const savedVoucher = await this.voucherRepo.save(voucher);
    if (savedVoucher.status === VoucherStatus.PENDING) {
      await this.approvalsService.submit({
        client_id: clientId,
        module: 'accounting',
        entity_id: savedVoucher.id,
        action_type: 'voucher_approval',
        requested_by: createdBy ?? savedVoucher.created_by ?? 'system',
        branch_id: savedVoucher.branch_id,
        notes: savedVoucher.description ?? null,
      });
    }
    return savedVoucher;
  }

  async findAll(
    clientId: string,
    branchId?: number,
    type?: VoucherType,
    accessibleBranchIds?: number[],
  ): Promise<FinancialVoucher[]> {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const where: any = { client_id: clientId };
    if (branchId) where.branch_id = branchId;
    else if (accessibleBranchIds && accessibleBranchIds.length > 0) where.branch_id = In(accessibleBranchIds);
    if (type) where.type = type;

    return this.voucherRepo.find({
      relations: ['branch', 'expense_account', 'treasury_account', 'linked_grn', 'posted_journal_entry', 'reversal_journal_entry'],
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(
    clientId: string,
    id: number,
    accessibleBranchIds?: number[],
  ): Promise<FinancialVoucher> {
    const voucher = await this.voucherRepo.findOne({
      where: { id, client_id: clientId },
      relations: ['branch', 'expense_account', 'treasury_account', 'linked_grn', 'posted_journal_entry', 'reversal_journal_entry'],
    });
    if (
      !voucher ||
      (accessibleBranchIds &&
        accessibleBranchIds.length > 0 &&
        !accessibleBranchIds.includes(voucher.branch_id))
    ) {
      throw new NotFoundException(`Voucher #${id} not found`);
    }
    return voucher;
  }

  async getVendorPaymentPreview(
    clientId: string,
    id: number,
    accessibleBranchIds?: number[],
  ) {
    const voucher = await this.findOne(clientId, id, accessibleBranchIds);
    if (voucher.type !== VoucherType.PAYMENT || voucher.party_type !== 'VENDOR' || !voucher.party_id) {
      throw new BadRequestException('This voucher is not a vendor payment.');
    }

    const vendorId = Number(voucher.party_id);
    const requestedAmount = this.roundMoney(voucher.amount);
    const actualAllocations = voucher.status === VoucherStatus.APPROVED
      ? await this.dataSource.query(
        `
        SELECT
          alloc.allocated_amount,
          alloc.allocation_date,
          CASE
            WHEN alloc.grn_id IS NOT NULL THEN 'grn'
            ELSE 'expense_voucher'
          END AS payable_type,
          COALESCE(grn.id, payable_voucher.id) AS document_id,
          COALESCE(grn.grn_number, payable_voucher.voucher_no) AS document_no,
          DATE(COALESCE(grn.vendor_bill_date, grn.receipt_date, payable_voucher.date)) AS document_date,
          DATE(COALESCE(grn.vendor_bill_due_date, grn.vendor_bill_date, grn.receipt_date, payable_voucher.date)) AS due_date,
          COALESCE(grn.vendor_bill_reference, payable_voucher.reference_no) AS reference,
          CASE
            WHEN grn.id IS NOT NULL THEN GREATEST(
              COALESCE(grn.vendor_bill_amount, COALESCE(SUM(item.line_total), 0))
              - COALESCE(ret.total_returned, 0)
              - COALESCE(credit.total_credited, 0),
              0
            )
            ELSE COALESCE(payable_voucher.amount, 0)
          END AS bill_amount
        FROM accounting_payable_allocations alloc
        LEFT JOIN goods_receipt_notes grn
          ON grn.id = alloc.grn_id
         AND grn.client_id = alloc.client_id
        LEFT JOIN goods_receipt_note_items item
          ON item.grn_id = grn.id
        LEFT JOIN (
          SELECT return_doc.grn_id, COALESCE(SUM(return_item.line_total), 0) AS total_returned
          FROM goods_receipt_returns return_doc
          INNER JOIN goods_receipt_return_items return_item
            ON return_item.return_id = return_doc.id
          WHERE return_doc.client_id = ?
            AND return_doc.status = 'posted'
          GROUP BY return_doc.grn_id
        ) ret ON ret.grn_id = grn.id
        LEFT JOIN (
          SELECT linked_grn_id, COALESCE(SUM(amount), 0) AS total_credited
          FROM financial_vouchers
          WHERE client_id = ?
            AND type = 'PURCHASE_CREDIT_NOTE'
            AND status = 'APPROVED'
            AND linked_grn_id IS NOT NULL
          GROUP BY linked_grn_id
        ) credit ON credit.linked_grn_id = grn.id
        LEFT JOIN financial_vouchers payable_voucher
          ON payable_voucher.id = alloc.payable_voucher_id
         AND payable_voucher.client_id = alloc.client_id
        WHERE alloc.client_id = ?
          AND alloc.voucher_id = ?
        GROUP BY
          alloc.allocated_amount,
          alloc.allocation_date,
          payable_type,
          document_id,
          document_no,
          document_date,
          due_date,
          reference,
          payable_voucher.amount
        ORDER BY due_date ASC, document_id ASC
        `,
        [clientId, clientId, clientId, id],
      )
      : [];

    let lines: Array<{
      payable_type: 'grn' | 'expense_voucher';
      document_id: number;
      document_no: string;
      reference: string | null;
      document_date: string;
      due_date: string;
      days_past_due: number;
      bill_amount: number;
      allocated_amount: number;
      remaining_after_payment: number;
      source: 'actual' | 'projected';
    }> = [];

    if (actualAllocations.length > 0) {
      lines = actualAllocations.map((row: any) => {
        const billAmount = this.roundMoney(row.bill_amount);
        const allocatedAmount = this.roundMoney(row.allocated_amount);
        return {
          payable_type: row.payable_type,
          document_id: Number(row.document_id),
          document_no: row.document_no,
          reference: row.reference ?? null,
          document_date: row.document_date,
          due_date: row.due_date,
          days_past_due: this.diffInDays(voucher.date, row.due_date),
          bill_amount: billAmount,
          allocated_amount: allocatedAmount,
          remaining_after_payment: this.roundMoney(Math.max(billAmount - allocatedAmount, 0)),
          source: 'actual',
        };
      });
    } else {
      const payables = await this.accountingService.getPayablesAging(
        clientId,
        voucher.branch_id,
        voucher.date,
        vendorId,
      );
      let remaining = requestedAmount;
      lines = (payables?.documents || [])
        .map((doc: any) => {
          if (remaining <= 0.009) {
            return null;
          }
          const openAmount = this.roundMoney(doc.outstanding_amount);
          if (openAmount <= 0) {
            return null;
          }
          const allocatedAmount = this.roundMoney(Math.min(remaining, openAmount));
          remaining = this.roundMoney(remaining - allocatedAmount);
          return {
            payable_type: doc.payable_type,
            document_id: Number(doc.id),
            document_no: doc.document_no,
            reference: doc.reference ?? null,
            document_date: doc.document_date,
            due_date: doc.due_date,
            days_past_due: Number(doc.days_past_due || 0),
            bill_amount: this.roundMoney(doc.total_amount),
            allocated_amount: allocatedAmount,
            remaining_after_payment: this.roundMoney(Math.max(openAmount - allocatedAmount, 0)),
            source: 'projected' as const,
          };
        })
        .filter(Boolean) as any;
    }

    const allocatedTotal = this.roundMoney(lines.reduce((sum, line) => sum + line.allocated_amount, 0));

    return {
      voucher: {
        id: voucher.id,
        voucher_no: voucher.voucher_no,
        status: voucher.status,
        branch_id: voucher.branch_id,
        branch_name: voucher.branch?.branch_name ?? `Branch ${voucher.branch_id}`,
        vendor_id: vendorId,
        vendor_name: voucher.party_name ?? `Vendor #${voucher.party_id}`,
        payment_method: voucher.payment_method ?? null,
        payment_source_label: voucher.payment_source_label ?? null,
        treasury_account_id: voucher.treasury_account_id ?? null,
        treasury_account_code: voucher.treasury_account?.account_code ?? null,
        treasury_account_name: voucher.treasury_account?.account_name ?? null,
        reference_no: voucher.reference_no ?? null,
        date: voucher.date,
        amount: requestedAmount,
        description: voucher.description ?? null,
      },
      settlement: {
        mode: actualAllocations.length > 0 ? 'actual' : 'projected',
        line_count: lines.length,
        allocated_total: allocatedTotal,
        unallocated_amount: this.roundMoney(Math.max(requestedAmount - allocatedTotal, 0)),
        lines,
      },
    };
  }

  async updateStatus(
    clientId: string,
    id: number,
    dto: UpdateFinancialVoucherStatusDto,
    accessibleBranchIds?: number[],
    actorId?: string,
    user?: JwtPayload,
  ): Promise<FinancialVoucher> {
    const voucher = await this.findOne(clientId, id, accessibleBranchIds);
    await this.assertBranchBelongsToClient(clientId, voucher.branch_id, 'update financial voucher status');
    await this.accountingService.assertPeriodUnlockedForOperation(clientId, voucher.branch_id, voucher.date, 'Voucher status update', user);
    const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
    const status = dto.status;
    const note = dto.note?.trim() || null;

    if (voucher.status === status) {
      return voucher;
    }
    if (voucher.status === VoucherStatus.VOID) {
      throw new BadRequestException('Void vouchers cannot change status.');
    }
    if (voucher.status === VoucherStatus.APPROVED && status === VoucherStatus.REJECTED) {
      throw new BadRequestException('Approved vouchers must be voided, not rejected.');
    }
    if (status === VoucherStatus.VOID && voucher.status !== VoucherStatus.APPROVED) {
      throw new BadRequestException('Only approved vouchers can be voided.');
    }
    if ((status === VoucherStatus.REJECTED || status === VoucherStatus.VOID) && !note) {
      throw new BadRequestException(`${status === VoucherStatus.REJECTED ? 'Rejection' : 'Void'} note is required.`);
    }

    if (status === VoucherStatus.APPROVED) {
      await this.postVoucherJournal(clientId, voucher);
      voucher.status = VoucherStatus.APPROVED;
      voucher.approved_at = new Date();
      voucher.approved_by = actorUserId;
      voucher.status_note = note;
      const savedVoucher = await this.voucherRepo.save(voucher);
      await this.approvalsService.syncDecisionByEntity(
        clientId,
        'accounting',
        voucher.id,
        'voucher_approval',
        'approved',
        actorUserId,
        note ?? voucher.description ?? null,
      );
      return savedVoucher;
    }

    if (status === VoucherStatus.VOID && voucher.status === VoucherStatus.APPROVED) {
      if (voucher.posted_journal_entry_id) {
        const reversal = await this.accountingService.reverseJournalEntry(
          clientId,
          voucher.posted_journal_entry_id,
          {
            branch_id: voucher.branch_id,
            transaction_date: new Date(),
            business_date: undefined,
            reason: `Voucher ${voucher.voucher_no} voided${note ? `: ${note}` : ''}`,
          },
          accessibleBranchIds,
        );
        voucher.reversal_journal_entry_id = reversal.id;
      }
      await this.accountingService.clearVoucherPayableAllocations(clientId, voucher.id);
      voucher.status = VoucherStatus.VOID;
      voucher.voided_at = new Date();
      voucher.voided_by = actorUserId;
      voucher.status_note = note;
      return this.voucherRepo.save(voucher);
    }

    voucher.status = status;
    voucher.status_note = note;
    if (status === VoucherStatus.REJECTED) {
      voucher.rejected_at = new Date();
      voucher.rejected_by = actorUserId;
    } else {
      voucher.rejected_at = null;
      voucher.rejected_by = null;
    }
    const savedVoucher = await this.voucherRepo.save(voucher);
    if (status === VoucherStatus.REJECTED) {
      await this.approvalsService.syncDecisionByEntity(
        clientId,
        'accounting',
        voucher.id,
        'voucher_approval',
        'rejected',
        actorUserId,
        note ?? voucher.description ?? null,
      );
    }
    return savedVoucher;
  }

  async getPaymentVoucherExceptions(
    clientId: string,
    branchId?: number,
    accessibleBranchIds?: number[],
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const query = this.voucherRepo.createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.branch', 'branch')
      .leftJoinAndSelect('voucher.treasury_account', 'treasury_account')
      .where('voucher.client_id = :clientId', { clientId })
      .andWhere('voucher.type = :type', { type: VoucherType.PAYMENT });

    if (branchId) {
      query.andWhere('voucher.branch_id = :branchId', { branchId });
    } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere('voucher.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
    }

    const vouchers = await query.orderBy('voucher.date', 'DESC').addOrderBy('voucher.id', 'DESC').getMany();

    const rows = vouchers.flatMap((voucher) => {
      const issues: string[] = [];
      const method = String(voucher.payment_method ?? '').trim();
      const treasury = voucher.treasury_account ?? null;
      const sourceLabel = voucher.payment_source_label?.trim() || null;

      if (!voucher.treasury_account_id || !treasury) {
        issues.push('Missing treasury account.');
      }
      if (!sourceLabel) {
        issues.push('Missing payment source label.');
      }
      if (treasury && treasury.is_active === false) {
        issues.push('Treasury account is inactive.');
      }
      if (treasury && treasury.scope === AccountScope.BRANCH && treasury.branch_id && treasury.branch_id !== voucher.branch_id) {
        issues.push('Treasury account belongs to a different branch.');
      }
      if (method.toLowerCase() === 'cash' && treasury && !treasury.is_cash_account) {
        issues.push('Cash payment is linked to a non-cash treasury account.');
      }
      if (this.isBankLikePaymentMethod(method) && treasury && !treasury.is_bank_account) {
        issues.push(`${method} payment is linked to a non-bank treasury account.`);
      }

      if (issues.length === 0) {
        return [];
      }

      return [{
        voucher_id: voucher.id,
        voucher_no: voucher.voucher_no,
        voucher_status: voucher.status,
        voucher_date: voucher.date,
        branch_id: voucher.branch_id,
        branch_name: voucher.branch?.branch_name ?? `Branch ${voucher.branch_id}`,
        vendor_name: voucher.party_name ?? `Vendor #${voucher.party_id ?? voucher.id}`,
        amount: this.roundMoney(voucher.amount),
        payment_method: voucher.payment_method ?? null,
        payment_source_label: sourceLabel,
        treasury_account_id: voucher.treasury_account_id ?? null,
        treasury_account_code: treasury?.account_code ?? null,
        treasury_account_name: treasury?.account_name ?? null,
        issues,
      }];
    });

    return {
      summary: {
        count: rows.length,
        pending_count: rows.filter((row) => row.voucher_status === VoucherStatus.PENDING).length,
        approved_count: rows.filter((row) => row.voucher_status === VoucherStatus.APPROVED).length,
      },
      vouchers: rows,
    };
  }
}
