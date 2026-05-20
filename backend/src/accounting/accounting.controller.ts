import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
    getAccessibleBranchIds,
    getOptionalBranchId,
    requireBranchId,
    requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { AccountingService } from './accounting.service';
import {
    CreateBankReconciliationDto,
    CreateMerchantSettlementDto,
    CreateFixedAssetItemDto,
    CreateFixedAssetUnitDto,
    CloseDayDto,
    DisposeFixedAssetUnitDto,
    CreatePettyCashAccountDto,
    CreatePettyCashRefillDto,
    CreateTreasuryMovementDto,
    CreateAccountDto,
    CreateJournalEntryDto,
    CreateInterBranchServiceRechargeDto,
    CreatePayrollAdvanceDto,
    CreatePayrollRunDto,
    GetPayrollPreviewDto,
    CreatePayrollComplianceSettlementDto,
    CreatePayrollComplianceFilingDto,
    DayClosePreviewDto,
    FinalizeYearEndDto,
    GetFixedAssetRegisterDto,
    GetMonthCloseChecklistDto,
    GetPayrollComplianceReviewDto,
    GetPayrollComplianceFilingsDto,
    GetPayrollComplianceSettingDto,
    GetPayrollRecoveryProfilesDto,
    GetPettyCashOverviewDto,
    ReverseJournalEntryDto,
    ReopenYearEndDto,
    ReturnFixedAssetUnitDto,
    TransferFixedAssetUnitDto,
    IssueFixedAssetUnitDto,
    RecordPayrollRunPaymentDto,
    UpsertTreasuryExceptionDto,
    UpdatePayrollRunStatusDto,
    UpdateFixedAssetItemDto,
    UpdateFixedAssetUnitDto,
    UpsertMonthCloseChecklistItemDto,
    UpsertPayrollComplianceSettingDto,
    UpsertPeriodLockDto,
    UpsertPayrollRecoveryProfileDto,
    UpdateAccountDto,
} from './dto/accounting-write.dto';

@Controller('v1/accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
    constructor(private readonly accountingService: AccountingService) {}

    @Post('accounts')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.COA_MANAGE)
    async createAccount(@RequestUser() user: JwtPayload, @Body() body: CreateAccountDto) {
        return this.accountingService.createAccount(requireClientId(user), body);
    }

    @Get('accounts')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.COA,
        APP_PERMISSIONS.ACCOUNTING.COA_MANAGE,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
        APP_PERMISSIONS.ACCOUNTING.LEDGER,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
        APP_PERMISSIONS.ACCOUNTING.PETTY_CASH,
        APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE,
        APP_PERMISSIONS.ACCOUNTING.BANKS,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
        APP_PERMISSIONS.ACCOUNTING.REPORTS,
        APP_PERMISSIONS.INVENTORY.ASSETS_VIEW,
        APP_PERMISSIONS.INVENTORY.ASSETS,
        APP_PERMISSIONS.HR.PAYROLL_READ,
        APP_PERMISSIONS.HR.PAYROLL_MANAGE,
        APP_PERMISSIONS.HR.PAYROLL_APPROVE,
    )
    async getAccounts(@RequestUser() user: JwtPayload) {
        return this.accountingService.getAccounts(requireClientId(user), getAccessibleBranchIds(user));
    }

    @Patch('accounts/:id')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.COA_MANAGE)
    async updateAccount(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateAccountDto,
    ) {
        return this.accountingService.updateAccount(
            requireClientId(user),
            id,
            getOptionalBranchId(user, body.branch_id),
            body,
        );
    }

    @Post('journal')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
    async createJournalEntry(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateJournalEntryDto,
    ) {
        const clientId = requireClientId(user);
        const branchId = requireBranchId(user, body.branch_id);
        return this.accountingService.createJournalEntry(clientId, branchId, body, user);
    }

    @Post('inter-branch-service-recharges')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
    async createInterBranchServiceRecharge(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateInterBranchServiceRechargeDto,
    ) {
        return this.accountingService.createInterBranchServiceRecharge(
            requireClientId(user),
            body,
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Get('fixed-assets')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS_VIEW)
    async getFixedAssetRegister(
        @RequestUser() user: JwtPayload,
        @Query() query: GetFixedAssetRegisterDto,
    ) {
        return this.accountingService.getFixedAssetRegister(
            requireClientId(user),
            getOptionalBranchId(user, query.branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Post('fixed-assets/items')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async createFixedAssetItem(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateFixedAssetItemDto,
    ) {
        return this.accountingService.createFixedAssetItem(requireClientId(user), body, user);
    }

    @Patch('fixed-assets/items/:id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async updateFixedAssetItem(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateFixedAssetItemDto,
    ) {
        return this.accountingService.updateFixedAssetItem(requireClientId(user), id, body);
    }

    @Post('fixed-assets/units')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async createFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateFixedAssetUnitDto,
    ) {
        return this.accountingService.createFixedAssetUnit(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Patch('fixed-assets/units/:id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async updateFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateFixedAssetUnitDto,
    ) {
        return this.accountingService.updateFixedAssetUnit(requireClientId(user), id, body, getAccessibleBranchIds(user));
    }

    @Post('fixed-assets/units/:id/issue')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async issueFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: IssueFixedAssetUnitDto,
    ) {
        return this.accountingService.issueFixedAssetUnit(requireClientId(user), id, body, user, getAccessibleBranchIds(user));
    }

    @Post('fixed-assets/units/:id/return')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async returnFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: ReturnFixedAssetUnitDto,
    ) {
        return this.accountingService.returnFixedAssetUnit(requireClientId(user), id, body, user, getAccessibleBranchIds(user));
    }

    @Post('fixed-assets/units/:id/transfer')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async transferFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: TransferFixedAssetUnitDto,
    ) {
        return this.accountingService.transferFixedAssetUnit(requireClientId(user), id, body, user, getAccessibleBranchIds(user));
    }

    @Post('fixed-assets/units/:id/dispose')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.ASSETS)
    async disposeFixedAssetUnit(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: DisposeFixedAssetUnitDto,
    ) {
        return this.accountingService.disposeFixedAssetUnit(
            requireClientId(user),
            id,
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Get('trial-balance')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getTrialBalance(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('as_of_date') asOfDate?: string,
    ) {
        return this.accountingService.getTrialBalance(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            asOfDate,
        );
    }

    @Get('journal')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ)
    async getJournalEntries(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('business_date') businessDate?: string,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
    ) {
        return this.accountingService.getJournalEntries(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            businessDate,
            dateFrom,
            dateTo,
        );
    }

    @Get('journal/:id')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ)
    async getJournalEntry(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.accountingService.getJournalEntry(
            requireClientId(user),
            id,
            getAccessibleBranchIds(user),
        );
    }

    @Post('journal/:id/reverse')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
    async reverseJournalEntry(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: ReverseJournalEntryDto,
    ) {
        return this.accountingService.reverseJournalEntry(
            requireClientId(user),
            id,
            body,
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Get('settings/period-lock')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async getPeriodLock(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getPeriodLock(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
        );
    }

    @Get('settings/month-close-checklist')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async getMonthCloseChecklist(
        @RequestUser() user: JwtPayload,
        @Query() query: GetMonthCloseChecklistDto,
    ) {
        return this.accountingService.getMonthCloseChecklist(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            query.period_key,
        );
    }

    @Post('settings/month-close-checklist')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async upsertMonthCloseChecklistItem(
        @RequestUser() user: JwtPayload,
        @Body() body: UpsertMonthCloseChecklistItemDto,
    ) {
        return this.accountingService.upsertMonthCloseChecklistItem(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('settings/year-end/finalize')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async finalizeYearEnd(
        @RequestUser() user: JwtPayload,
        @Body() body: FinalizeYearEndDto,
    ) {
        return this.accountingService.finalizeYearEnd(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('settings/year-end/reopen')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async reopenYearEnd(
        @RequestUser() user: JwtPayload,
        @Body() body: ReopenYearEndDto,
    ) {
        return this.accountingService.reopenYearEnd(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('settings/period-lock')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.SETTINGS)
    async upsertPeriodLock(
        @RequestUser() user: JwtPayload,
        @Body() body: UpsertPeriodLockDto,
    ) {
        return this.accountingService.upsertPeriodLock(
            requireClientId(user),
            {
                ...body,
                branch_id: getOptionalBranchId(user, body.branch_id ?? undefined) ?? null,
            },
            user,
        );
    }

    @Get('general-ledger')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.LEDGER)
    async getGeneralLedger(
        @RequestUser() user: JwtPayload,
        @Query('account_id', ParseIntPipe) accountId: number,
        @Query('branch_id') branchId?: number,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
    ) {
        return this.accountingService.getGeneralLedger(
            requireClientId(user),
            accountId,
            getOptionalBranchId(user, branchId),
            dateFrom,
            dateTo,
            getAccessibleBranchIds(user),
        );
    }

    @Get('reports/profit-and-loss')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getProfitAndLoss(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
    ) {
        return this.accountingService.getProfitAndLoss(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            dateFrom,
            dateTo,
        );
    }

    @Get('reports/balance-sheet')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getBalanceSheet(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('as_of_date') asOfDate?: string,
    ) {
        return this.accountingService.getBalanceSheet(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            asOfDate,
        );
    }

    @Get('reports/cash-flow')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getCashFlow(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
    ) {
        return this.accountingService.getCashFlowStatement(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            dateFrom,
            dateTo,
        );
    }

    @Get('reports/receivables-aging')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getReceivablesAging(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('as_of_date') asOfDate?: string,
        @Query('customer_id') customerId?: number,
        @Query('source_type') sourceType?: string,
    ) {
        return this.accountingService.getReceivablesAging(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            asOfDate,
            customerId,
            sourceType,
        );
    }

    @Get('reports/payables-aging')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
  async getPayablesAging(
      @RequestUser() user: JwtPayload,
      @Query('branch_id') branchId?: number,
      @Query('as_of_date') asOfDate?: string,
      @Query('vendor_id') vendorId?: number,
  ) {
      return this.accountingService.getPayablesAging(
          requireClientId(user),
          getOptionalBranchId(user, branchId),
          asOfDate,
          vendorId,
      );
  }

    @Get('reports/payables-aging/:sourceType/:id')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
    async getPayableDocumentDetail(
        @RequestUser() user: JwtPayload,
        @Param('sourceType') sourceType: 'grn' | 'expense_voucher',
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.accountingService.getPayableDocumentDetail(
            requireClientId(user),
            sourceType,
            id,
            getAccessibleBranchIds(user),
        );
    }

    @Get('reports/payment-voucher-exceptions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
        APP_PERMISSIONS.ACCOUNTING.REPORTS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
        APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
    )
    async getPaymentVoucherExceptions(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getPaymentVoucherExceptionsReport(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            getAccessibleBranchIds(user),
        );
    }

    @Get('dashboard')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.DASHBOARD)
    async getDashboard(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getDashboard(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
        );
    }

    @Get('treasury/overview')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
        APP_PERMISSIONS.ACCOUNTING.BANKS,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async getTreasuryOverview(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getTreasuryOverview(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            getAccessibleBranchIds(user),
        );
    }

    @Get('treasury/merchant-settlement-review')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
        APP_PERMISSIONS.ACCOUNTING.BANKS,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async getMerchantSettlementReview(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getMerchantSettlementReview(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            getAccessibleBranchIds(user),
        );
    }

    @Get('treasury/exceptions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
        APP_PERMISSIONS.ACCOUNTING.BANKS,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async getTreasuryExceptionWorkflow(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getTreasuryExceptionWorkflow(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            getAccessibleBranchIds(user),
        );
    }

    @Post('treasury/exceptions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.SETTINGS,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async upsertTreasuryException(
        @RequestUser() user: JwtPayload,
        @Body() body: UpsertTreasuryExceptionDto,
    ) {
        return this.accountingService.upsertTreasuryException(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('treasury/movements')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async createTreasuryMovement(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateTreasuryMovementDto,
    ) {
        return this.accountingService.createTreasuryMovement(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('treasury/merchant-settlements')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
        APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    )
    async createMerchantSettlement(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateMerchantSettlementDto,
    ) {
        return this.accountingService.createMerchantSettlement(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Get('petty-cash')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH)
    async getPettyCashOverview(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPettyCashOverviewDto,
    ) {
        return this.accountingService.getPettyCashOverview(
            requireClientId(user),
            getOptionalBranchId(user, query.branch_id),
            query.date_from,
            query.date_to,
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollRuns(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
        @Query('period_start') periodStart?: string,
        @Query('period_end') periodEnd?: string,
        @Query('status') status?: string,
    ) {
        return this.accountingService.getPayrollRuns(
            requireClientId(user),
            getOptionalBranchId(user, branchId),
            periodStart,
            periodEnd,
            status,
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/preview')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollPreview(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPayrollPreviewDto,
    ) {
        return this.accountingService.getPayrollPreview(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            query.period_start,
            query.period_end,
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/recovery-profiles')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollRecoveryProfiles(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPayrollRecoveryProfilesDto,
    ) {
        return this.accountingService.getPayrollRecoveryProfiles(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/compliance-settings')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollComplianceSetting(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPayrollComplianceSettingDto,
    ) {
        return this.accountingService.getPayrollComplianceSetting(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/compliance-review')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollComplianceReview(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPayrollComplianceReviewDto,
    ) {
        return this.accountingService.getPayrollComplianceReview(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/compliance-filings')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollComplianceFilings(
        @RequestUser() user: JwtPayload,
        @Query() query: GetPayrollComplianceFilingsDto,
    ) {
        return this.accountingService.getPayrollComplianceFilings(
            requireClientId(user),
            requireBranchId(user, query.branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Get('payroll/:id')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_READ)
    async getPayrollRun(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.accountingService.getPayrollRun(
            requireClientId(user),
            id,
            getAccessibleBranchIds(user),
        );
    }

    @Post('payroll')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_MANAGE)
    async createPayrollRun(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePayrollRunDto,
    ) {
        return this.accountingService.createPayrollRun(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Patch('payroll/:id/status')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_APPROVE)
    async updatePayrollRunStatus(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdatePayrollRunStatusDto,
    ) {
        return this.accountingService.updatePayrollRunStatus(
            requireClientId(user),
            id,
            body,
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/:id/payments')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_APPROVE)
    async recordPayrollRunPayment(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: RecordPayrollRunPaymentDto,
    ) {
        return this.accountingService.recordPayrollRunPayment(
            requireClientId(user),
            id,
            body,
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/advances')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_MANAGE)
    async createPayrollAdvance(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePayrollAdvanceDto,
    ) {
        return this.accountingService.createPayrollAdvance(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/recovery-profiles')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_MANAGE)
    async upsertPayrollRecoveryProfile(
        @RequestUser() user: JwtPayload,
        @Body() body: UpsertPayrollRecoveryProfileDto,
    ) {
        return this.accountingService.upsertPayrollRecoveryProfile(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/compliance-settings')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_MANAGE)
    async upsertPayrollComplianceSetting(
        @RequestUser() user: JwtPayload,
        @Body() body: UpsertPayrollComplianceSettingDto,
    ) {
        return this.accountingService.upsertPayrollComplianceSetting(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/compliance-settlements')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_APPROVE)
    async createPayrollComplianceSettlement(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePayrollComplianceSettlementDto,
    ) {
        return this.accountingService.createPayrollComplianceSettlement(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('payroll/compliance-filings')
    @RequirePermissions(APP_PERMISSIONS.HR.PAYROLL_APPROVE)
    async createPayrollComplianceFiling(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePayrollComplianceFilingDto,
    ) {
        return this.accountingService.createPayrollComplianceFiling(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Post('petty-cash/accounts')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE)
    async createPettyCashAccount(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePettyCashAccountDto,
    ) {
        return this.accountingService.createPettyCashAccount(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Post('petty-cash/refills')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE)
    async createPettyCashRefill(
        @RequestUser() user: JwtPayload,
        @Body() body: CreatePettyCashRefillDto,
    ) {
        return this.accountingService.createPettyCashRefill(
            requireClientId(user),
            {
                ...body,
                branch_id: requireBranchId(user, body.branch_id),
            },
            user,
        );
    }

    @Get('reconciliation/accounts')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.RECON)
    async getReconciliationAccounts(@RequestUser() user: JwtPayload) {
        return this.accountingService.getBankReconciliationAccounts(
            requireClientId(user),
            getAccessibleBranchIds(user),
        );
    }

    @Get('reconciliation')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.RECON)
    async getReconciliation(
        @RequestUser() user: JwtPayload,
        @Query('account_id', ParseIntPipe) accountId: number,
        @Query('branch_id') branchId?: number,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
        @Query('activity_type') activityType?: string,
    ) {
        return this.accountingService.getBankReconciliation(
            requireClientId(user),
            accountId,
            getOptionalBranchId(user, branchId),
            dateFrom,
            dateTo,
            activityType,
            getAccessibleBranchIds(user),
        );
    }

    @Post('reconciliation')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
        APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE,
    )
    async createReconciliation(
        @RequestUser() user: JwtPayload,
        @Body() body: CreateBankReconciliationDto,
    ) {
        const branchId = requireBranchId(user, body.branch_id);
        return this.accountingService.createBankReconciliation(
            requireClientId(user),
            branchId,
            body,
            getAccessibleBranchIds(user),
            user,
        );
    }

    @Get('day-closing/preview')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.DASHBOARD)
    async getDayClosePreview(
        @RequestUser() user: JwtPayload,
        @Query() query: DayClosePreviewDto,
    ) {
        const branchId = requireBranchId(user, query.branch_id);
        return this.accountingService.getDayClosePreview(
            requireClientId(user),
            branchId,
            query.business_date,
        );
    }

    @Get('day-closing/history')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.DASHBOARD)
    async getDayCloseHistory(
        @RequestUser() user: JwtPayload,
        @Query('branch_id') branchId?: number,
    ) {
        return this.accountingService.getDayCloseHistory(
            requireClientId(user),
            requireBranchId(user, branchId),
        );
    }

    @Post('day-closing/close')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
    async closeDay(
        @RequestUser() user: JwtPayload,
        @Body() body: CloseDayDto,
    ) {
        const clientId = requireClientId(user);
        const branchId = requireBranchId(user, body.branch_id);
        return this.accountingService.closeDay(
            clientId,
            branchId,
            body,
            user,
        );
    }
}
