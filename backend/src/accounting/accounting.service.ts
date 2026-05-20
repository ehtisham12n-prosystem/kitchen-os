import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource, EntityManager, Not } from 'typeorm';
import { ChartOfAccount } from './entities/chart-of-accounts.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalItem } from './entities/journal-item.entity';
import { AccountingDayClose } from './entities/day-close.entity';
import { Branch } from '../setup/entities/branch.entity';
import {
    AccountScope,
    BankAccountType,
    AccountType,
    CloseDayDto,
    CreateBankReconciliationDto,
    CreateAccountDto,
    CreateJournalEntryDto,
    CreateTreasuryMovementDto,
    PeriodLockMode,
    ReverseJournalEntryDto,
    TreasuryMovementType,
    UpsertTreasuryExceptionDto,
    UpsertPeriodLockDto,
    UpdateAccountDto,
} from './dto/accounting-write.dto';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import { Order } from '../pos/entities/order.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { KOT } from '../pos/entities/kot.entity';
import { Shift } from '../pos/entities/shift.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { InventoryCountSession } from '../inventory-op/entities/inventory-count-session.entity';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../auth/request-context.util';
import { AccountingBankReconciliation } from './entities/bank-reconciliation.entity';
import { GoodsReceiptNote } from '../inventory-op/entities/goods-receipt-note.entity';
import { AccountingPayableAllocation } from './entities/payable-allocation.entity';
import { AccountingPeriodLock } from './entities/period-lock.entity';
import {
    AccountingCloseChecklistItem,
    AccountingCloseChecklistStatus,
} from './entities/close-checklist.entity';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { FinancialVoucher, PartyType, VoucherStatus, VoucherType } from './entities/financial-voucher.entity';
import { JournalAccrualReversalStatus, JournalCloseAdjustmentType } from './entities/journal-entry.entity';
import {
    CreatePayrollComplianceSettlementDto,
    CreatePayrollComplianceFilingDto,
    CreatePayrollAdvanceDto,
    CreateInterBranchServiceRechargeDto,
    CreateFixedAssetItemDto,
    CreateFixedAssetUnitDto,
    CreatePayrollRunDto,
    DisposeFixedAssetUnitDto,
    GetPayrollComplianceReviewDto,
    GetFixedAssetRegisterDto,
    IssueFixedAssetUnitDto,
    PayrollPaymentMethod,
    RecordPayrollRunPaymentDto,
    ReturnFixedAssetUnitDto,
    TransferFixedAssetUnitDto,
    UpdatePayrollRunStatusDto,
    UpdateFixedAssetItemDto,
    UpdateFixedAssetUnitDto,
} from './dto/accounting-write.dto';
import { AccountingPayrollRun, AccountingPayrollRunStatus } from './entities/payroll-run.entity';
import { AccountingPayrollRunLine } from './entities/payroll-run-line.entity';
import { AccountingPayrollPayment } from './entities/payroll-payment.entity';
import { AccountingPayrollAdvance } from './entities/payroll-advance.entity';
import { AccountingPayrollRecoveryProfile } from './entities/payroll-recovery-profile.entity';
import { AccountingPayrollComplianceSetting } from './entities/payroll-compliance-setting.entity';
import {
    AccountingPayrollComplianceFiling,
    AccountingPayrollComplianceFilingStatus,
} from './entities/payroll-compliance-filing.entity';
import { AccountingTreasuryDepositAllocation } from './entities/treasury-deposit-allocation.entity';
import { AccountingTreasuryDepositClearanceAllocation } from './entities/treasury-deposit-clearance-allocation.entity';
import {
    AccountingTreasuryException,
    AccountingTreasuryExceptionStatus,
} from './entities/treasury-exception.entity';
import {
    AccountingInterBranchServiceRecharge,
    AccountingInterBranchServiceType,
} from './entities/inter-branch-service-recharge.entity';
import {
    AccountingFixedAssetItem,
    FixedAssetDepreciationMethod,
} from './entities/fixed-asset-item.entity';
import {
    AccountingFixedAssetUnit,
    FixedAssetCapitalizationMode,
    FixedAssetCondition,
    FixedAssetDisposalMethod,
    FixedAssetOperationalStatus,
    FixedAssetPurchaseCondition,
} from './entities/fixed-asset-unit.entity';
import {
    AccountingFixedAssetMovement,
    FixedAssetMovementType,
} from './entities/fixed-asset-movement.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { AttendanceLog } from '../setup/entities/attendance-log.entity';
import { UserBranchRole } from '../setup/entities/user-branch-role.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventorySubType } from '../inventory/entities/inventory-sub-type.entity';
import { InventoryType } from '../inventory/entities/inventory-type.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';

type AccountRow = ChartOfAccount & {
    balance?: number;
    children?: AccountRow[];
};

type AgingBucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

@Injectable()
export class AccountingService {
    constructor(
        @InjectRepository(ChartOfAccount)
        private readonly coaRepo: Repository<ChartOfAccount>,
        @InjectRepository(JournalEntry)
        private readonly entryRepo: Repository<JournalEntry>,
        @InjectRepository(AccountingDayClose)
        private readonly dayCloseRepo: Repository<AccountingDayClose>,
        @InjectRepository(Branch)
        private readonly branchRepo: Repository<Branch>,
        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,
        @InjectRepository(Transaction)
        private readonly transactionRepo: Repository<Transaction>,
        @InjectRepository(KOT)
        private readonly kotRepo: Repository<KOT>,
        @InjectRepository(Shift)
        private readonly shiftRepo: Repository<Shift>,
        @InjectRepository(StockLedger)
        private readonly stockLedgerRepo: Repository<StockLedger>,
        @InjectRepository(InventoryCountSession)
        private readonly inventoryCountSessionRepo: Repository<InventoryCountSession>,
        @InjectRepository(AccountingBankReconciliation)
        private readonly bankReconciliationRepo: Repository<AccountingBankReconciliation>,
        @InjectRepository(GoodsReceiptNote)
        private readonly grnRepo: Repository<GoodsReceiptNote>,
        @InjectRepository(AccountingPayableAllocation)
        private readonly payableAllocationRepo: Repository<AccountingPayableAllocation>,
        @InjectRepository(AccountingPeriodLock)
        private readonly periodLockRepo: Repository<AccountingPeriodLock>,
        @InjectRepository(AccountingCloseChecklistItem)
        private readonly closeChecklistRepo: Repository<AccountingCloseChecklistItem>,
        @InjectRepository(AccountingPayrollRun)
        private readonly payrollRunRepo: Repository<AccountingPayrollRun>,
        @InjectRepository(AccountingPayrollRunLine)
        private readonly payrollRunLineRepo: Repository<AccountingPayrollRunLine>,
        @InjectRepository(AccountingPayrollPayment)
        private readonly payrollPaymentRepo: Repository<AccountingPayrollPayment>,
        @InjectRepository(AccountingPayrollAdvance)
        private readonly payrollAdvanceRepo: Repository<AccountingPayrollAdvance>,
        @InjectRepository(AccountingPayrollRecoveryProfile)
        private readonly payrollRecoveryProfileRepo: Repository<AccountingPayrollRecoveryProfile>,
        @InjectRepository(AccountingPayrollComplianceSetting)
        private readonly payrollComplianceSettingRepo: Repository<AccountingPayrollComplianceSetting>,
        @InjectRepository(AccountingPayrollComplianceFiling)
        private readonly payrollComplianceFilingRepo: Repository<AccountingPayrollComplianceFiling>,
        @InjectRepository(AccountingTreasuryDepositAllocation)
        private readonly treasuryDepositAllocationRepo: Repository<AccountingTreasuryDepositAllocation>,
        @InjectRepository(AccountingTreasuryDepositClearanceAllocation)
        private readonly treasuryDepositClearanceAllocationRepo: Repository<AccountingTreasuryDepositClearanceAllocation>,
        @InjectRepository(AccountingTreasuryException)
        private readonly treasuryExceptionRepo: Repository<AccountingTreasuryException>,
        @InjectRepository(AccountingInterBranchServiceRecharge)
        private readonly interBranchServiceRechargeRepo: Repository<AccountingInterBranchServiceRecharge>,
        @InjectRepository(AccountingFixedAssetItem)
        private readonly fixedAssetItemRepo: Repository<AccountingFixedAssetItem>,
        @InjectRepository(AccountingFixedAssetUnit)
        private readonly fixedAssetUnitRepo: Repository<AccountingFixedAssetUnit>,
        @InjectRepository(AccountingFixedAssetMovement)
        private readonly fixedAssetMovementRepo: Repository<AccountingFixedAssetMovement>,
        @InjectRepository(UserManagement)
        private readonly userRepo: Repository<UserManagement>,
        @InjectRepository(AttendanceLog)
        private readonly attendanceRepo: Repository<AttendanceLog>,
        @InjectRepository(UserBranchRole)
        private readonly userBranchRoleRepo: Repository<UserBranchRole>,
        @InjectRepository(InventoryItem)
        private readonly inventoryItemRepo: Repository<InventoryItem>,
        @InjectRepository(InventorySubType)
        private readonly inventorySubTypeRepo: Repository<InventorySubType>,
        @InjectRepository(InventoryType)
        private readonly inventoryTypeRepo: Repository<InventoryType>,
        @InjectRepository(InventoryClass)
        private readonly inventoryClassRepo: Repository<InventoryClass>,
        private readonly dataSource: DataSource,
    ) {}

    private readonly baseAccounts: Array<{
        account_code: string;
        account_name: string;
        account_type: AccountType;
        scope?: AccountScope;
        parent_code?: string;
        schedule_code?: string;
        is_control_account?: boolean;
        allow_manual_posting?: boolean;
        is_bank_account?: boolean;
        is_cash_account?: boolean;
        is_petty_cash_account?: boolean;
        is_system?: boolean;
    }> = [
        { account_code: '1000', account_name: 'Assets', account_type: AccountType.ASSET, schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1100', account_name: 'Cash & Bank', account_type: AccountType.ASSET, parent_code: '1000', schedule_code: 'BS_CASH', is_system: true },
        { account_code: '1101', account_name: 'Cash on Hand', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1100', schedule_code: 'BS_CASH', is_cash_account: true, is_system: true },
        { account_code: '1102', account_name: 'Bank Current Account', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1100', schedule_code: 'BS_CASH', is_bank_account: true, is_system: true },
        { account_code: '1103', account_name: 'Merchant Settlement Clearing', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1100', schedule_code: 'BS_RECEIVABLES', is_system: true },
        { account_code: '1104', account_name: 'Bank Deposits In Transit', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1100', schedule_code: 'BS_CASH', is_system: true },
        { account_code: '1105', account_name: 'Branch Safe', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1100', schedule_code: 'BS_CASH', is_cash_account: true, is_system: true },
        { account_code: '1160', account_name: 'Advances & Prepayments', account_type: AccountType.ASSET, parent_code: '1000', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1161', account_name: 'Vendor Advances', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1160', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1162', account_name: 'Rent Advance', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1160', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1163', account_name: 'Prepaid Insurance', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1160', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1164', account_name: 'Prepaid Licenses & Subscriptions', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1160', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1200', account_name: 'Inventory Asset', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1000', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1210', account_name: 'Accounts Receivable', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1000', schedule_code: 'BS_RECEIVABLES', is_control_account: true, is_system: true },
        { account_code: '1220', account_name: 'Inter-Branch Clearing Receivable', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1000', schedule_code: 'BS_RECEIVABLES', is_control_account: true, is_system: true },
        { account_code: '1230', account_name: 'Staff Advances Receivable', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1000', schedule_code: 'BS_RECEIVABLES', is_control_account: true, is_system: true },
        { account_code: '1235', account_name: 'Staff Loan Receivable', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1000', schedule_code: 'BS_RECEIVABLES', is_control_account: true, is_system: true },
        { account_code: '1300', account_name: 'Raw Materials Inventory', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1200', schedule_code: 'BS_INVENTORY', is_system: true },
        { account_code: '1400', account_name: 'Finished Goods Inventory', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1200', schedule_code: 'BS_INVENTORY', is_system: true },
        { account_code: '1410', account_name: 'Packaging Inventory', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1200', schedule_code: 'BS_INVENTORY', is_system: true },
        { account_code: '1420', account_name: 'Beverage Inventory', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1200', schedule_code: 'BS_INVENTORY', is_system: true },
        { account_code: '1430', account_name: 'Bakery Ingredient Inventory', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1200', schedule_code: 'BS_INVENTORY', is_system: true },
        { account_code: '1500', account_name: 'Fixed Assets', account_type: AccountType.ASSET, parent_code: '1000', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1510', account_name: 'Kitchen Equipment', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1500', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1520', account_name: 'Furniture & Fixtures', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1500', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1530', account_name: 'IT & POS Equipment', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1500', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1540', account_name: 'Vehicles', account_type: AccountType.ASSET, scope: AccountScope.BRANCH, parent_code: '1500', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '1590', account_name: 'Accumulated Depreciation', account_type: AccountType.ASSET, parent_code: '1500', schedule_code: 'BS_ASSETS', is_system: true },
        { account_code: '2000', account_name: 'Liabilities', account_type: AccountType.LIABILITY, schedule_code: 'BS_LIABILITIES', is_system: true },
        { account_code: '2100', account_name: 'Accounts Payable', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_PAYABLES', is_control_account: true, is_system: true },
        { account_code: '2110', account_name: 'Goods Received Not Invoiced', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_PAYABLES', is_control_account: true, is_system: true },
        { account_code: '2120', account_name: 'Inter-Branch Clearing Payable', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_PAYABLES', is_control_account: true, is_system: true },
        { account_code: '2125', account_name: 'Accrued Expenses', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_LIABILITIES', is_system: true },
        { account_code: '2170', account_name: 'Short-Term Loans', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_LIABILITIES', is_system: true },
        { account_code: '2205', account_name: 'Customer Advances', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_LIABILITIES', is_control_account: true, is_system: true },
        { account_code: '2206', account_name: 'Event Advances & Deposits', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2205', schedule_code: 'BS_LIABILITIES', is_system: true },
        { account_code: '2207', account_name: 'Customer Wallet Liability', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2205', schedule_code: 'BS_LIABILITIES', is_control_account: true, is_system: true },
        { account_code: '2210', account_name: 'Payroll Payable', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2000', schedule_code: 'BS_LIABILITIES', is_control_account: true, is_system: true },
        { account_code: '2300', account_name: 'Tax Payables', account_type: AccountType.LIABILITY, parent_code: '2000', schedule_code: 'BS_TAX', is_system: true },
        { account_code: '2301', account_name: 'GST Payable', account_type: AccountType.LIABILITY, parent_code: '2300', schedule_code: 'BS_TAX', is_system: true },
        { account_code: '2302', account_name: 'Withholding Tax Payable', account_type: AccountType.LIABILITY, parent_code: '2300', schedule_code: 'BS_TAX', is_system: true },
        { account_code: '2303', account_name: 'EOBI Payable', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2300', schedule_code: 'BS_TAX', is_system: true },
        { account_code: '2304', account_name: 'Social Security Payable', account_type: AccountType.LIABILITY, scope: AccountScope.BRANCH, parent_code: '2300', schedule_code: 'BS_TAX', is_system: true },
        { account_code: '2500', account_name: 'Long-Term Loans', account_type: AccountType.LIABILITY, parent_code: '2000', schedule_code: 'BS_LIABILITIES', is_system: true },
        { account_code: '3000', account_name: 'Equity', account_type: AccountType.EQUITY, schedule_code: 'BS_EQUITY', is_system: true },
        { account_code: '3100', account_name: 'Owner Capital', account_type: AccountType.EQUITY, parent_code: '3000', schedule_code: 'BS_EQUITY', is_system: true },
        { account_code: '3200', account_name: 'Retained Earnings', account_type: AccountType.EQUITY, parent_code: '3000', schedule_code: 'BS_EQUITY', is_system: true },
        { account_code: '3030', account_name: 'Owner Drawings', account_type: AccountType.EQUITY, parent_code: '3000', schedule_code: 'BS_EQUITY', is_system: true },
        { account_code: '4000', account_name: 'Sales Revenue', account_type: AccountType.REVENUE, schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4100', account_name: 'Food Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4110', account_name: 'Dine-In Food Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4100', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4120', account_name: 'Takeaway Food Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4100', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4130', account_name: 'Delivery Food Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4100', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4140', account_name: 'Beverage Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4150', account_name: 'Bakery Sales', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4160', account_name: 'Event Revenue - In House', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4170', account_name: 'Event Revenue - Outdoor', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4180', account_name: 'Bulk Cooking Revenue', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4200', account_name: 'Service Charges', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4300', account_name: 'Management Charges', account_type: AccountType.REVENUE, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '4310', account_name: 'Inter-Branch Recharge Income', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_OTHER_INCOME', is_system: true },
        { account_code: '4320', account_name: 'Internal Service Recharge Income', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_OTHER_INCOME', is_system: true },
        { account_code: '4330', account_name: 'Gain on Asset Disposal', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_OTHER_INCOME', is_system: true },
        { account_code: '4400', account_name: 'Cash Overages', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_OTHER_INCOME', is_system: true },
        { account_code: '4500', account_name: 'Bank Profit & Interest', account_type: AccountType.REVENUE, parent_code: '4000', schedule_code: 'PL_OTHER_INCOME', is_system: true },
        { account_code: '4510', account_name: 'Sales Discounts & Returns', account_type: AccountType.REVENUE, scope: AccountScope.BRANCH, parent_code: '4000', schedule_code: 'PL_REVENUE', is_system: true },
        { account_code: '5000', account_name: 'Expenses', account_type: AccountType.EXPENSE, schedule_code: 'PL_EXPENSES', is_system: true },
        { account_code: '5100', account_name: 'Cost of Goods Sold', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5050', account_name: 'Purchase Price Variance', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5200', account_name: 'Salaries & Wages', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5110', account_name: 'Raw Material Consumption', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5120', account_name: 'Beverage Cost', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5130', account_name: 'Bakery Ingredient Cost', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5140', account_name: 'Packaging Cost', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5150', account_name: 'Event Direct Material Cost', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5160', account_name: 'Bulk Cooking Direct Cost', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5190', account_name: 'Other Direct COGS', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5100', schedule_code: 'PL_COGS', is_system: true },
        { account_code: '5205', account_name: 'Salaries - Operations', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5200', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5210', account_name: 'Salaries - Admin', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5200', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5215', account_name: 'Kitchen Wages', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5200', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5220', account_name: 'Employer Payroll Contributions', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5230', account_name: 'Staff Meals & Uniform', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5200', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5235', account_name: 'Staff Benefits', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5200', schedule_code: 'PL_PAYROLL', is_system: true },
        { account_code: '5300', account_name: 'Utilities Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5305', account_name: 'Electricity Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5300', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5310', account_name: 'Gas Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5300', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5315', account_name: 'Water Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5300', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5320', account_name: 'Inter-Branch Recharge Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5330', account_name: 'Internal Service Recharge Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5340', account_name: 'Delivery Commission', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5345', account_name: 'Aggregator Commission', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5350', account_name: 'Marketing & Promotion', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5360', account_name: 'Office Supplies & Stationery', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5370', account_name: 'Repairs & Maintenance', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5380', account_name: 'Fuel & Transport', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5390', account_name: 'Misc Operating Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5395', account_name: 'Entertainment Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5400', account_name: 'Rent Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5410', account_name: 'Insurance Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5420', account_name: 'Software & Subscriptions', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5430', account_name: 'Professional Fees', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5440', account_name: 'Telephone & Internet', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5450', account_name: 'Cleaning & Security', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5051', account_name: 'Purchase Credits & Rebates', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5500', account_name: 'Inventory Wastage', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5510', account_name: 'Kitchen Wastage', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5500', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5520', account_name: 'Inventory Shrinkage', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5500', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5700', account_name: 'Event Refunds & Write-Offs', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5600', account_name: 'Bank Charges', account_type: AccountType.EXPENSE, parent_code: '5000', schedule_code: 'PL_BANKING', is_system: true },
        { account_code: '5605', account_name: 'Merchant Charges / MDR', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5600', schedule_code: 'PL_BANKING', is_system: true },
        { account_code: '5610', account_name: 'Depreciation Expense', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5620', account_name: 'Loss on Asset Disposal', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
        { account_code: '5800', account_name: 'Cash Shortages', account_type: AccountType.EXPENSE, scope: AccountScope.BRANCH, parent_code: '5000', schedule_code: 'PL_OPERATING', is_system: true },
    ];

    private readonly baseAccountGuidance: Record<string, {
        description: string;
        usage_guidance?: string;
        example_entry?: string;
        confusion_note?: string;
    }> = {
        '1000': { description: 'Top-level asset group for everything the business owns or controls.', usage_guidance: 'Use this as a parent heading only. Post into child asset accounts instead.', example_entry: 'Cash, bank, receivables, inventory, fixed assets.' },
        '1100': { description: 'Treasury and bank asset group for cash movement, custody, and settlement.', usage_guidance: 'Use child accounts for till cash, safe, bank, and in-transit balances.', example_entry: 'Cash on Hand, Bank Current Account, Branch Safe.' },
        '1101': { description: 'Physical cash available in till or branch custody for daily operations.', usage_guidance: 'Use for cash sales, petty operational cash, and cash settlement postings.', example_entry: 'Cash sale received or cash expense paid from branch till.', confusion_note: 'Do not use for cash already handed to safe or banked into transit.' },
        '1102': { description: 'Main operating bank account used for EFT, cheque, and bank-side settlements.', usage_guidance: 'Use when money has actually reached the bank ledger.', example_entry: 'Vendor EFT payment or bank deposit clearance.', confusion_note: 'Do not post card/wallet sales here until the processor settles to bank.' },
        '1103': { description: 'Temporary clearing account for card, wallet, and merchant-settlement receipts before bank credit arrives.', usage_guidance: 'System uses this for non-cash POS collections and merchant settlements.', example_entry: 'Card sale today, bank settlement tomorrow.', confusion_note: 'Users often confuse this with the bank account. It is not bank cash yet.' },
        '1104': { description: 'Cash already sent for banking but not yet cleared in the bank statement.', usage_guidance: 'Use for safe-to-bank deposit batches waiting for bank credit.', example_entry: 'Cash deposit sent today, credited tomorrow.', confusion_note: 'Do not leave old balances here; aged deposits should be reviewed quickly.' },
        '1105': { description: 'Cash physically held in the branch safe after till handover.', usage_guidance: 'Use for cashier-to-safe handovers and safe-to-bank deposit batching.', example_entry: 'Till close transfers counted cash into branch safe.' },
        '1160': { description: 'Parent group for advances paid and prepaid costs that benefit future periods.', usage_guidance: 'Use child accounts such as vendor advances, rent advance, and prepaid subscriptions.', example_entry: 'Advance rent or prepaid annual software fee.', confusion_note: 'Do not expense future-period costs immediately if they should be spread over time.' },
        '1161': { description: 'Amounts paid to vendors before goods or services are fully received.', usage_guidance: 'Use when cash leaves now but vendor delivery or billing is still pending.', example_entry: 'Advance paid to supplier for equipment or event materials.' },
        '1162': { description: 'Rent paid in advance for future months.', usage_guidance: 'Use when rent covers a future period and should be released over time.', example_entry: 'Three months shop rent paid upfront.', confusion_note: 'Do not treat the full advance as current month expense if future months are covered.' },
        '1163': { description: 'Insurance cost paid in advance and released over policy coverage period.', usage_guidance: 'Use for annual or multi-month insurance policies.', example_entry: 'One-year fire insurance premium paid today.' },
        '1164': { description: 'Software, license, or subscription cost paid in advance for future use.', usage_guidance: 'Use for SaaS, support contracts, and annual licenses.', example_entry: 'Annual POS or accounting software subscription.' },
        '1200': { description: 'Parent inventory group for stock held for production, resale, or issue to kitchen.', usage_guidance: 'Use child inventory accounts for raw materials, packaging, and specialty stock.', example_entry: 'Raw materials, packaging inventory, beverage inventory.' },
        '1210': { description: 'Control account for amounts customers still owe the business.', usage_guidance: 'System posts credit sales and event billing here. Review through receivables screens.', example_entry: 'Corporate customer credit sale or staged event invoice.', confusion_note: 'Do not use this for customer advances; advances belong in liabilities until revenue is earned.' },
        '1220': { description: 'Control account for internal balances owed by another branch or internal unit.', usage_guidance: 'Use for inter-branch transfers and internal recharges on the receivable side.', example_entry: 'Central kitchen supply recharge to branch.', confusion_note: 'This is internal clearing, not external customer receivables.' },
        '1230': { description: 'Amounts recoverable from staff for advances already given.', usage_guidance: 'Use for salary advances and staff recoveries.', example_entry: 'Staff advance to be recovered in payroll.' },
        '1235': { description: 'Amounts recoverable from staff for formal employee loans.', usage_guidance: 'Use for loan balances recovered over multiple payroll cycles.', example_entry: 'Employee emergency loan disbursed and recovered monthly.' },
        '1300': { description: 'Core raw materials used in kitchen, bakery, or bulk production.', usage_guidance: 'Use for ingredient stock purchased for consumption or production.', example_entry: 'Flour, oil, meat, vegetables, spices.' },
        '1400': { description: 'Finished items already produced and ready for sale or dispatch.', usage_guidance: 'Use for completed products held before issue or sale.', example_entry: 'Ready bakery items or packed finished goods.' },
        '1410': { description: 'Packaging and disposable inventory used for takeaway, delivery, and event packing.', usage_guidance: 'Use for cups, boxes, wrappers, bags, and disposable serving material.', example_entry: 'Burger boxes, cups, spoons, event packing material.' },
        '1420': { description: 'Beverage stock held separately for better margin and shrinkage control.', usage_guidance: 'Use for bottled drinks, syrups, coffee beans, or drink stock kept distinct from food ingredients.', example_entry: 'Soft drinks, bottled water, coffee beans.' },
        '1430': { description: 'Bakery-specific ingredients tracked separately from general kitchen stock.', usage_guidance: 'Use when bakery production needs separate material reporting.', example_entry: 'Chocolate compound, yeast, cake premix.' },
        '1500': { description: 'Parent group for long-term tangible assets used in operations.', usage_guidance: 'Use child fixed-asset accounts and the fixed-asset register for capitalization and lifecycle.', example_entry: 'Kitchen equipment, furniture, IT equipment, vehicles.' },
        '1510': { description: 'Capitalized kitchen machinery and equipment with useful life beyond one period.', usage_guidance: 'Use for ovens, fryers, chillers, and similar operational equipment.', example_entry: 'New fryer or bakery oven purchase.', confusion_note: 'Small consumables or repair parts should usually go to expense, not fixed assets.' },
        '1520': { description: 'Capitalized furniture, fixtures, and dining-area fit-out assets.', usage_guidance: 'Use for tables, chairs, counters, shelving, and display fixtures.', example_entry: 'Dining chairs or front counter fixtures.' },
        '1530': { description: 'Capitalized IT, POS, and office hardware assets.', usage_guidance: 'Use for POS terminals, printers, laptops, routers, and related equipment.', example_entry: 'New POS terminal or kitchen display screen.' },
        '1540': { description: 'Capitalized vehicles used for logistics, delivery, or operations.', usage_guidance: 'Use for owned vehicles that are depreciated over useful life.', example_entry: 'Delivery bike or supply van purchase.' },
        '1590': { description: 'Accumulated depreciation against fixed assets.', usage_guidance: 'Use as the contra-asset side of depreciation entries and disposals.', example_entry: 'Monthly depreciation booked on kitchen equipment.', confusion_note: 'This reduces book value; it is not a cash or expense account by itself.' },
        '2000': { description: 'Top-level liability group for what the business owes others.', usage_guidance: 'Use child liability accounts for payables, accruals, loans, tax, and advances.', example_entry: 'AP, customer advances, tax payables, payroll liabilities.' },
        '2100': { description: 'Control account for vendor liabilities after bill recognition.', usage_guidance: 'System posts approved vendor bills and credit purchases here.', example_entry: 'Vendor bill approved and awaiting payment.', confusion_note: 'Do not use for goods received but not yet invoiced; use GRNI until bill is recognized.' },
        '2110': { description: 'Liability for stock received before vendor invoice is booked.', usage_guidance: 'Use when GRN is posted but supplier bill has not yet been recognized.', example_entry: 'Goods received today, vendor bill next week.', confusion_note: 'Users often mix this with accounts payable. GRNI clears once the bill is captured.' },
        '2120': { description: 'Control account for internal balances owed to another branch or internal unit.', usage_guidance: 'Use for inter-branch transfers and internal recharges on the payable side.', example_entry: 'Receiving branch owes central kitchen for stock recharge.' },
        '2125': { description: 'Current-period costs incurred but not yet billed or paid.', usage_guidance: 'Use for month-end accruals such as utilities, professional fees, or services already consumed.', example_entry: 'Electricity used this month but bill not received yet.' },
        '2170': { description: 'Loan balances due within the next 12 months.', usage_guidance: 'Use for short-term financing or current portion of long-term loans.', example_entry: 'Working capital loan due this year.', confusion_note: 'Principal repayment reduces this liability; only interest goes to expense.' },
        '2205': { description: 'Amounts received from customers before revenue is earned.', usage_guidance: 'Use for deposits, event advances, and other customer prepayments.', example_entry: 'Advance received for catering order.', confusion_note: 'Do not book these amounts directly to revenue until service or sale is earned.' },
        '2206': { description: 'Customer advances specifically received against event and catering bookings.', usage_guidance: 'Use when deposits are tracked separately for events.', example_entry: 'Wedding event booking advance received.' },
        '2207': { description: 'Customer wallet balances and prepaid store credit owed back to customers until used.', usage_guidance: 'Use for wallet top-ups, stored value, and customer credit balances that are not yet earned revenue.', example_entry: 'Customer adds money to wallet before placing orders.', confusion_note: 'Do not treat wallet top-up as sales revenue. Revenue is earned when the wallet is used against a sale.' },
        '2210': { description: 'Net payroll due to staff before payment is made.', usage_guidance: 'System posts approved payroll here and clears it on payroll payment.', example_entry: 'Month-end payroll approved but not yet paid.', confusion_note: 'This is a liability, while salaries expense sits in the P&L.' },
        '2300': { description: 'Parent group for statutory and tax liabilities.', usage_guidance: 'Use child tax accounts for GST, withholding tax, EOBI, and social security balances.', example_entry: 'Tax withheld from payroll or sales tax payable.' },
        '2301': { description: 'GST or sales tax collected or payable to the authority.', usage_guidance: 'Use according to tax configuration and settlement workflow.', example_entry: 'Output tax collected on taxable sale.' },
        '2302': { description: 'Withholding tax deducted and payable to the authority.', usage_guidance: 'Use for payroll or vendor withholding taxes awaiting remittance.', example_entry: 'Payroll withholding tax settlement due.' },
        '2303': { description: 'EOBI liability awaiting payment or filing.', usage_guidance: 'System posts payroll statutory deductions and employer portions here.', example_entry: 'Monthly EOBI payable after payroll approval.' },
        '2304': { description: 'Social security liability awaiting payment or filing.', usage_guidance: 'Use for payroll social security deductions and employer contribution balance.', example_entry: 'Monthly social security due after payroll run.' },
        '2500': { description: 'Long-term borrowings and financing obligations due beyond one year.', usage_guidance: 'Use for term loans and long-dated financing balances.', example_entry: 'Equipment finance loan with multi-year repayment.' },
        '3000': { description: 'Top-level equity group for owner investment and accumulated results.', usage_guidance: 'Use child equity accounts for capital, retained earnings, and drawings.', example_entry: 'Capital introduced by owner or retained profits.' },
        '3030': { description: 'Owner withdrawals from the business that reduce equity.', usage_guidance: 'Use for proprietor or partner drawings not treated as salary expense.', example_entry: 'Owner takes cash for personal use.', confusion_note: 'Do not use as operating expense; drawings reduce equity, not profit.' },
        '3100': { description: 'Owner capital introduced into the business.', usage_guidance: 'Use when owners inject funds or qualifying assets into the business.', example_entry: 'Owner deposits startup capital into bank.' },
        '3200': { description: 'Accumulated profits retained in the business after year-end closing.', usage_guidance: 'Use for year-end transfer of current-year result and historical retained balance.', example_entry: 'Year-end close transfers profit into retained earnings.' },
        '4000': { description: 'Top-level operating and other income group.', usage_guidance: 'Use child revenue accounts by business line, not by payment method.', example_entry: 'Food sales, event revenue, service charges, internal recharge income.', confusion_note: 'Cash, card, and wallet should be tracked in treasury and settlement analytics, not as revenue accounts.' },
        '4100': { description: 'Primary food sales revenue for regular restaurant operations.', usage_guidance: 'Use child revenue lines to split dine-in, takeaway, and delivery if you want detail.', example_entry: 'Burger, meal, and food item sales.' },
        '4110': { description: 'Food revenue earned from dine-in guests.', usage_guidance: 'Use when management wants dine-in separated from takeaway and delivery.', example_entry: 'Table service or dine-in counter order.' },
        '4120': { description: 'Food revenue earned from takeaway orders picked up by the customer.', usage_guidance: 'Use for pickup business where service mix needs separate review.', example_entry: 'Customer collects takeaway order from branch.' },
        '4130': { description: 'Food revenue earned from delivery orders.', usage_guidance: 'Use for own-delivery or aggregator delivery sales mix analysis.', example_entry: 'Delivery order fulfilled to customer address.' },
        '4140': { description: 'Revenue from beverages sold separately from food.', usage_guidance: 'Use when drink sales and margins are reviewed independently.', example_entry: 'Coffee, juice, soda, bottled drinks.' },
        '4150': { description: 'Revenue from bakery products or bakery retail line.', usage_guidance: 'Use when bakery is operated as a distinct line of business.', example_entry: 'Bread, cakes, pastries, cookies.' },
        '4160': { description: 'Revenue from in-house events hosted within company premises.', usage_guidance: 'Use when event revenue is split by service format.', example_entry: 'Birthday or corporate event held inside the restaurant.' },
        '4170': { description: 'Revenue from outdoor or off-site event execution.', usage_guidance: 'Use when off-site events need separate profitability reporting.', example_entry: 'Outdoor catering or venue service event.' },
        '4180': { description: 'Revenue from bulk cooking, institutional supply, or contract meal service.', usage_guidance: 'Use for large-batch meal production outside regular retail sales.', example_entry: 'Bulk meal supply to school, office, or institution.' },
        '4200': { description: 'Service charges earned by the business.', usage_guidance: 'Use for service-charge income kept by the business according to policy.', example_entry: 'Service charge retained from banquet invoice.' },
        '4300': { description: 'Management and internal recovery income group.', usage_guidance: 'Use child accounts for internal stock and service recharge income.', example_entry: 'Central support recharge to branch.' },
        '4310': { description: 'Internal revenue recognized on inter-branch stock recharge.', usage_guidance: 'Use when stock movement carries an internal recharge value.', example_entry: 'Commissary stock recharge to outlet.' },
        '4320': { description: 'Internal revenue recognized on inter-branch service recharge.', usage_guidance: 'Use for central admin, logistics, kitchen support, and shared service recovery.', example_entry: 'Head office admin recharge to branch.' },
        '4330': { description: 'Gain recognized when an asset is disposed above its carrying value.', usage_guidance: 'Use with asset disposal workflow.', example_entry: 'Equipment sold for more than book value.' },
        '4400': { description: 'Income side of cash overages found in close review.', usage_guidance: 'Use when verified close difference results in overage recognition.', example_entry: 'Cash counted higher than expected after review.' },
        '4500': { description: 'Bank profit or interest income earned on deposits or balances.', usage_guidance: 'Use for genuine financing or banking income.', example_entry: 'Bank profit credited on savings balance.' },
        '4510': { description: 'Contra-revenue account for sales discounts, returns, and allowances.', usage_guidance: 'Use to reduce gross sales where policy prefers a separate contra-revenue line.', example_entry: 'Sales return or approved discount adjustment.', confusion_note: 'Do not confuse this with payment-method charges or bank fees.' },
        '5000': { description: 'Top-level expense group for cost of sales, payroll, and operating overhead.', usage_guidance: 'Use child expense accounts for direct cost, payroll, utilities, rent, wastage, banking, and other operating costs.', example_entry: 'COGS, salaries, utilities, bank charges, depreciation.' },
        '5050': { description: 'Difference between received stock value and actual billed vendor amount.', usage_guidance: 'System uses this when vendor bill differs from GRN value.', example_entry: 'Vendor invoices slightly above or below received-cost estimate.', confusion_note: 'This is not a normal purchase expense line; it is a procurement variance control account.' },
        '5051': { description: 'Purchase-side credits, rebates, and vendor value reductions.', usage_guidance: 'Use for vendor credit notes and purchase rebates not handled as stock return.', example_entry: 'Supplier rebate or bill correction credit.' },
        '5100': { description: 'Parent cost-of-sales group for direct food, beverage, packaging, and event material cost.', usage_guidance: 'Use child direct-cost accounts for cleaner gross margin reporting.', example_entry: 'Raw material consumption, beverage cost, packaging cost.' },
        '5110': { description: 'Direct raw material consumption used in regular kitchen operations.', usage_guidance: 'Use for core food ingredient cost if broken out separately from total COGS.', example_entry: 'Meat, produce, dairy, groceries consumed in food sales.' },
        '5120': { description: 'Direct beverage cost consumed or sold.', usage_guidance: 'Use when beverage margin is reviewed separately.', example_entry: 'Coffee beans, syrups, bottled beverages.' },
        '5130': { description: 'Direct bakery ingredient cost consumed in bakery production.', usage_guidance: 'Use for bakery-specific costing.', example_entry: 'Yeast, premix, chocolate, cream.' },
        '5140': { description: 'Direct packaging cost consumed in takeaway, delivery, or event dispatch.', usage_guidance: 'Use for cups, lids, boxes, wraps, and packaging disposables.', example_entry: 'Burger box or delivery bag usage.' },
        '5150': { description: 'Direct material consumed for event execution.', usage_guidance: 'Use for event-specific food and material cost linked to catering jobs.', example_entry: 'Ingredients procured for one wedding event.' },
        '5160': { description: 'Direct cost of bulk-cooking production contracts.', usage_guidance: 'Use for material cost of institutional or batch meal production.', example_entry: 'School lunch bulk-cooking ingredients.' },
        '5190': { description: 'Other direct cost of sales that does not fit raw material, beverage, bakery, packaging, event, or bulk-cooking cost.', usage_guidance: 'Use only for costs directly tied to earning sales where a more specific COGS account does not apply.', example_entry: 'Minor direct production cost not covered by standard COGS lines.', confusion_note: 'Do not use for operating overhead such as fuel, utilities, or office supplies.' },
        '5200': { description: 'Parent payroll expense group for salaries, wages, and staff-related cost.', usage_guidance: 'Use child payroll accounts to separate operations, admin, kitchen, and staff benefits.', example_entry: 'Monthly salary or kitchen wages.' },
        '5205': { description: 'Operations staff payroll cost.', usage_guidance: 'Use for cashier, service, and branch operations payroll if separated.', example_entry: 'Front-of-house or outlet operations staff salary.' },
        '5210': { description: 'Administrative payroll cost.', usage_guidance: 'Use for management, admin, accounts, and back-office staff salaries.', example_entry: 'Head office admin or accountant salary.' },
        '5215': { description: 'Kitchen labor cost paid as wages.', usage_guidance: 'Use for kitchen helpers, cooks, and production wages if tracked separately.', example_entry: 'Daily-rated kitchen staff wages.' },
        '5220': { description: 'Employer-side payroll contribution cost.', usage_guidance: 'Use for employer statutory payroll contributions posted from payroll approval.', example_entry: 'Employer social security contribution expense.' },
        '5230': { description: 'Staff meals, uniforms, and similar staff support cost.', usage_guidance: 'Use for staff welfare items tied to employment but outside normal salary line.', example_entry: 'Uniform issue or staff meal program cost.' },
        '5235': { description: 'Staff insurance, medical, rewards, recognition, and similar employee benefit costs.', usage_guidance: 'Use for approved staff benefits outside regular salary and wage lines.', example_entry: 'Staff health insurance, medical reimbursement, or employee reward.', confusion_note: 'Business insurance belongs in Insurance Expense, not staff benefits.' },
        '5300': { description: 'Parent utilities expense group for recurring branch utility cost.', usage_guidance: 'Use child accounts to split electricity, gas, and water.', example_entry: 'Monthly power, gas, and water cost.' },
        '5305': { description: 'Electricity cost for branch or facility operations.', usage_guidance: 'Use for utility bills and electricity accruals.', example_entry: 'Monthly electricity bill.' },
        '5310': { description: 'Gas expense used for cooking, heating, or production.', usage_guidance: 'Use for gas cylinder or piped gas cost.', example_entry: 'Kitchen gas refill or monthly gas bill.' },
        '5315': { description: 'Water expense for branch operations.', usage_guidance: 'Use for water bills or water tanker expense if treated as utility.', example_entry: 'Monthly water utility bill.' },
        '5320': { description: 'Internal expense recognized on inter-branch stock recharge.', usage_guidance: 'Use on the receiving branch side of charged internal stock transfers.', example_entry: 'Outlet receives central kitchen stock with internal recharge.' },
        '5330': { description: 'Internal expense recognized on inter-branch service recharge.', usage_guidance: 'Use for central admin, logistics, shared support, or kitchen support recharge.', example_entry: 'Branch charged for shared logistics support.' },
        '5340': { description: 'Delivery commission cost paid for delivery business.', usage_guidance: 'Use for delivery partners or internal delivery commissions.', example_entry: 'Per-order delivery partner charge.' },
        '5345': { description: 'Aggregator commission cost deducted by online platforms.', usage_guidance: 'Use when marketplaces or delivery apps charge sales commission.', example_entry: 'Aggregator commission on online food order.' },
        '5350': { description: 'Marketing, promotion, and advertising expense.', usage_guidance: 'Use for campaigns, banners, sponsored posts, and brand promotion.', example_entry: 'Social media promotion or discount campaign material.' },
        '5360': { description: 'Office consumables and stationery expense.', usage_guidance: 'Use for small office-use items not capitalized.', example_entry: 'Paper, printer ink, stationery supplies.' },
        '5370': { description: 'Repairs and maintenance cost for premises and equipment.', usage_guidance: 'Use for servicing and repairs that do not create a new fixed asset.', example_entry: 'Fryer repair or AC maintenance.', confusion_note: 'If the spend creates a long-term asset or major improvement, consider capitalization instead.' },
        '5380': { description: 'Fuel, local transport, and operational movement cost.', usage_guidance: 'Use for branch vehicles, procurement pickup, or other transport expense.', example_entry: 'Fuel for delivery bike or goods pickup transport.' },
        '5390': { description: 'General operating expense for items not fitting a more specific controlled line.', usage_guidance: 'Use sparingly; prefer a more specific expense account when one exists.', example_entry: 'Small operational expense with no dedicated category.', confusion_note: 'Heavy use of miscellaneous expense reduces reporting quality and should be reviewed.' },
        '5395': { description: 'Entertainment and hospitality cost incurred for business purposes.', usage_guidance: 'Use for approved guest entertainment, staff events, or business hospitality where policy allows.', example_entry: 'Approved business meal or team event expense.', confusion_note: 'Customer discounts and promotions belong in sales or marketing accounts, not entertainment.' },
        '5400': { description: 'Rent expense for branch, office, or facility occupancy.', usage_guidance: 'Use for current-period rent cost only.', example_entry: 'Current month shop rent expense.', confusion_note: 'Advance rent belongs in a prepaid or advance asset account until earned by time.' },
        '5410': { description: 'Insurance expense released into current period.', usage_guidance: 'Use for policy cost recognized this period.', example_entry: 'Monthly recognition of annual insurance policy.' },
        '5420': { description: 'Software, SaaS, and recurring subscription expense.', usage_guidance: 'Use for recurring software services once due in current period.', example_entry: 'POS software monthly subscription.' },
        '5430': { description: 'Professional and advisory service cost.', usage_guidance: 'Use for lawyers, consultants, auditors, and specialist advisors.', example_entry: 'Legal drafting fee or annual audit fee.' },
        '5440': { description: 'Telephone, internet, and data communication cost.', usage_guidance: 'Use for broadband, SIMs, and connectivity subscriptions.', example_entry: 'Branch internet bill or data package.' },
        '5450': { description: 'Cleaning, security, and housekeeping-related service cost.', usage_guidance: 'Use for outsourced cleaning or security service.', example_entry: 'Night security guard or outsourced cleaning team.' },
        '5500': { description: 'Parent group for stock losses, spoilage, and inventory control leakage.', usage_guidance: 'Use child accounts to separate kitchen wastage from shrinkage.', example_entry: 'Expired goods, spoilage, or untraceable stock loss.' },
        '5510': { description: 'Operational kitchen wastage identified through production or store control.', usage_guidance: 'Use for spoilage, burn, breakage, or approved kitchen waste.', example_entry: 'Spoiled meat or overcooked batch discarded.' },
        '5520': { description: 'Inventory shrinkage or unexplained stock loss found in counts or review.', usage_guidance: 'Use when stock is missing without direct production-use support.', example_entry: 'Stock count shortfall after investigation.' },
        '5600': { description: 'Bank-related charges and treasury cost group.', usage_guidance: 'Use child account for processor charges when kept separate from general bank fees.', example_entry: 'Cheque fee, transfer charge, bank service fee.' },
        '5605': { description: 'Merchant discount rate and processor charges on card or wallet settlements.', usage_guidance: 'Use when net merchant settlement is lower than gross due to provider charges.', example_entry: 'Card settlement fee deducted by acquirer.', confusion_note: 'This is not a sales discount; it is a banking/settlement cost.' },
        '5610': { description: 'Depreciation cost recognized for fixed assets in the current period.', usage_guidance: 'Use through controlled close adjustments or fixed-asset schedules.', example_entry: 'Monthly depreciation on oven or POS hardware.' },
        '5620': { description: 'Loss recognized when an asset is disposed below its carrying value.', usage_guidance: 'Use with asset disposal workflow.', example_entry: 'Equipment scrapped or sold below book value.' },
        '5700': { description: 'Refunds, write-offs, and revenue-loss adjustments specific to event business.', usage_guidance: 'Use for event cancellation financial loss or approved AR write-off.', example_entry: 'Event collection write-off after approved cancellation.' },
        '5800': { description: 'Expense side of verified cash shortages found in close review.', usage_guidance: 'Use when a close variance is accepted as actual shortage after review.', example_entry: 'Cash counted lower than expected after close investigation.' },
    };

    private async assertBranchBelongsToClient(
        clientId: string,
        branchId?: number,
        operation?: string,
    ): Promise<void> {
        if (!branchId) {
            return;
        }

        const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        if (operation) {
            assertBranchOperationalWriteAllowed(branch, operation);
        }
    }

    private assertAccessibleBranch(
        branchId: number | undefined,
        accessibleBranchIds?: number[],
        operation: string = 'access this branch',
    ): void {
        if (!branchId || !accessibleBranchIds?.length) {
            return;
        }
        if (!accessibleBranchIds.includes(branchId)) {
            throw new ForbiddenException(`You do not have permission to ${operation}.`);
        }
    }

    private normalizeAmount(value: unknown): number {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private roundMoney(value: unknown): number {
        return Number(this.normalizeAmount(value).toFixed(2));
    }

    private buildTreasuryExceptionRecordKey(branchId: number, exceptionType: string, exceptionKey: string): string {
        return `${branchId}::${exceptionType}::${exceptionKey}`;
    }

    private buildLiveTreasuryExceptions(treasuryOverview: any, merchantSettlementReview: any) {
        const todayBusinessDate = this.formatBusinessDate(new Date());
        const toAgeDays = (value?: string | null) => {
            if (!value) return 0;
            const start = new Date(`${value}T00:00:00`);
            const end = new Date(`${todayBusinessDate}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
            return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
        };

        const recentVariances = Array.isArray(treasuryOverview?.cash_office_review?.recent_variances)
            ? treasuryOverview.cash_office_review.recent_variances
            : [];
        const openHandovers = Array.isArray(treasuryOverview?.safe_deposit_review?.open_handovers)
            ? treasuryOverview.safe_deposit_review.open_handovers
            : [];
        const recentDepositBatches = Array.isArray(treasuryOverview?.safe_deposit_review?.recent_deposit_batches)
            ? treasuryOverview.safe_deposit_review.recent_deposit_batches
            : [];
        const openTransitBatches = Array.isArray(treasuryOverview?.safe_deposit_review?.open_transit_batches)
            ? treasuryOverview.safe_deposit_review.open_transit_batches
            : [];
        const merchantQueue = Array.isArray(merchantSettlementReview?.queue)
            ? merchantSettlementReview.queue
            : [];
        const providerSummary = Array.isArray(merchantSettlementReview?.provider_summary)
            ? merchantSettlementReview.provider_summary
            : [];

        const items: any[] = [];

        for (const row of recentVariances) {
            const varianceAmount = this.roundMoney(Math.abs(Number(row.cash_variance_amount ?? 0)));
            if (varianceAmount <= 0.009) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0),
                exception_type: 'cash_variance',
                exception_key: `${row.branch_id}:${row.business_date}`,
                severity: 'follow_up',
                label: 'Cash Over/Short',
                reference_label: `${row.branch_name || 'Branch'} · ${row.business_date}`,
                amount: varianceAmount,
                age_days: toAgeDays(row.business_date),
                detail: `Expected ${this.roundMoney(row.expected_cash_amount ?? 0)} vs actual ${this.roundMoney(row.actual_cash_amount ?? 0)}.`,
            });
        }

        for (const row of recentDepositBatches) {
            const unlinkedAmount = this.roundMoney(Number(row.unlinked_amount ?? 0));
            if (unlinkedAmount <= 0.009) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0),
                exception_type: 'deposit_variance_batch',
                exception_key: String(row.deposit_entry_id),
                severity: 'follow_up',
                label: 'Deposit Variance Batch',
                reference_label: row.reference_id || row.description || `Deposit batch ${row.deposit_entry_id}`,
                amount: unlinkedAmount,
                age_days: Number(row.age_days ?? toAgeDays(row.business_date || row.transaction_date)),
                detail: 'Deposit batch does not fully tie back to linked safe handovers.',
            });
        }

        for (const row of openHandovers) {
            const remainingAmount = this.roundMoney(Number(row.remaining_amount ?? 0));
            const ageDays = Number(row.age_days ?? toAgeDays(row.business_date || row.transaction_date));
            if (remainingAmount <= 0.009 || ageDays < 1) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0),
                exception_type: 'overdue_safe_handover',
                exception_key: String(row.journal_entry_id),
                severity: 'close_blocker',
                label: 'Safe Handover Aging',
                reference_label: row.reference_id || row.description || `Handover ${row.journal_entry_id}`,
                amount: remainingAmount,
                age_days: ageDays,
                detail: 'Cash is still in branch safe without deposit batching.',
            });
        }

        for (const row of openTransitBatches) {
            const remainingAmount = this.roundMoney(Number(row.remaining_in_transit_amount ?? 0));
            const ageDays = Number(row.age_days ?? toAgeDays(row.business_date || row.transaction_date));
            if (remainingAmount <= 0.009 || ageDays < 2) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0),
                exception_type: 'overdue_transit_batch',
                exception_key: String(row.deposit_entry_id),
                severity: 'close_blocker',
                label: 'Deposit In Transit Aging',
                reference_label: row.reference_id || row.description || `Transit batch ${row.deposit_entry_id}`,
                amount: remainingAmount,
                age_days: ageDays,
                detail: 'Deposit was sent to bank but is still uncleared from transit.',
            });
        }

        for (const row of merchantQueue) {
            const openAmount = this.roundMoney(Number(row.amount ?? 0));
            const ageDays = Number(row.days_open ?? 0);
            if (!(openAmount > 0.009 && Boolean(row.aged_open))) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0),
                exception_type: 'aged_merchant_settlement',
                exception_key: String(row.journal_entry_id),
                severity: 'close_blocker',
                label: 'Aged Merchant Clearing',
                reference_label: row.reference_id || row.description || `Merchant line ${row.journal_entry_id}`,
                amount: openAmount,
                age_days: ageDays,
                detail: `${row.settlement_channel_label || 'Merchant'} receipt is still waiting for provider settlement.`,
            });
        }

        for (const row of providerSummary) {
            const shortfallAmount = this.roundMoney(Number(row.settlement_shortfall_amount ?? 0));
            if (shortfallAmount <= 0.009) continue;
            items.push({
                branch_id: Number(row.branch_id ?? 0) || Number(treasuryOverview?.cash_office_review?.latest_day_close?.branch_id ?? 0),
                exception_type: 'merchant_provider_shortfall',
                exception_key: `${row.provider_name}::${row.settlement_channel}`,
                severity: 'follow_up',
                label: 'Merchant Provider Shortfall',
                reference_label: `${row.provider_name} · ${row.settlement_channel_label || 'Other Merchant'}`,
                amount: shortfallAmount,
                age_days: Number(row.last_settlement_days_ago ?? 0),
                detail: 'Provider settlement includes charges or shortfall that still need treasury follow-up.',
            });
        }

        return items
            .filter((item) => Number(item.branch_id ?? 0) > 0)
            .sort((left, right) => (
                Number(right.amount ?? 0) - Number(left.amount ?? 0)
                || Number(right.age_days ?? 0) - Number(left.age_days ?? 0)
            ));
    }

    private formatBusinessDate(value: Date): string {
        const year = value.getFullYear();
        const month = `${value.getMonth() + 1}`.padStart(2, '0');
        const day = `${value.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private resolveBusinessDate(
        transactionDate?: Date | string | null,
        explicitBusinessDate?: string | null,
    ): string {
        if (explicitBusinessDate) {
            return explicitBusinessDate;
        }

        if (transactionDate instanceof Date) {
            return this.formatBusinessDate(transactionDate);
        }

        if (typeof transactionDate === 'string' && transactionDate) {
            const parsed = new Date(transactionDate);
            if (!Number.isNaN(parsed.getTime())) {
                return this.formatBusinessDate(parsed);
            }
        }

        return this.formatBusinessDate(new Date());
    }

    private isYearEndPeriod(periodKey?: string | null): boolean {
        if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) {
            return false;
        }
        return periodKey.endsWith('-06');
    }

    private resolveYearEndPeriodKey(periodKey?: string | null): string {
        const base = periodKey && /^\d{4}-\d{2}$/.test(periodKey)
            ? periodKey
            : this.formatBusinessDate(new Date()).slice(0, 7);
        const [year, month] = base.split('-').map(Number);
        return month <= 6 ? `${year}-06` : `${year + 1}-06`;
    }

    private buildYearEndGovernance(periodKey: string, checklist?: any, closeReadiness?: any, periodLock?: any) {
        const yearEndPeriodKey = this.resolveYearEndPeriodKey(periodKey);
        const isYearEndPeriod = this.isYearEndPeriod(periodKey);
        const pendingCount = Number(checklist?.summary?.pending_count ?? 0);
        const blockedCount = Number(checklist?.summary?.blocked_count ?? 0);
        const issueCount = Number(closeReadiness?.issue_count ?? 0);
        const fiscalYearRange = this.getFiscalYearRange(yearEndPeriodKey);
        const isFinalizedForPeriod = Boolean(
            periodLock?.year_end_finalized_period_key === yearEndPeriodKey
            && periodLock?.year_end_finalized_at
            && (
                !periodLock.year_end_reopened_at
                || periodLock.year_end_reopened_at < periodLock.year_end_finalized_at
            ),
        );
        const isReopenedForPeriod = Boolean(
            periodLock?.year_end_finalized_period_key === yearEndPeriodKey
            && periodLock?.year_end_reopened_at
            && periodLock?.year_end_finalized_at
            && periodLock.year_end_reopened_at >= periodLock.year_end_finalized_at,
        );

        if (!isYearEndPeriod) {
            return {
                is_year_end_period: false,
                year_end_period_key: yearEndPeriodKey,
                status: 'upcoming',
                open_item_count: pendingCount + blockedCount,
                top_open_item: checklist?.summary?.top_open_item ?? null,
                fiscal_year_start: fiscalYearRange.start,
                fiscal_year_end: fiscalYearRange.end,
                is_finalized: false,
                finalized_at: null,
                finalized_by: null,
                close_journal_entry_id: null,
                reopened_at: null,
                reopened_by: null,
                reopened_reason: null,
                note: `Year-end close governance becomes active in ${yearEndPeriodKey}.`,
            };
        }

        if (isFinalizedForPeriod) {
            return {
                is_year_end_period: true,
                year_end_period_key: yearEndPeriodKey,
                status: 'finalized',
                open_item_count: 0,
                top_open_item: null,
                fiscal_year_start: fiscalYearRange.start,
                fiscal_year_end: fiscalYearRange.end,
                is_finalized: true,
                finalized_at: periodLock?.year_end_finalized_at ?? null,
                finalized_by: periodLock?.year_end_finalized_by ?? null,
                close_journal_entry_id: periodLock?.year_end_close_journal_entry_id ?? null,
                reopened_at: null,
                reopened_by: null,
                reopened_reason: null,
                note: `Year-end close was finalized${periodLock?.year_end_finalized_by ? ` by ${periodLock.year_end_finalized_by}` : ''} and the fiscal year is hard-locked through ${fiscalYearRange.end}.`,
            };
        }

        const hasAttention = pendingCount > 0 || blockedCount > 0 || issueCount > 0;
        return {
            is_year_end_period: true,
            year_end_period_key: yearEndPeriodKey,
            status: isReopenedForPeriod ? 'reopened' : hasAttention ? 'attention' : 'ready',
            open_item_count: pendingCount + blockedCount,
            top_open_item: checklist?.summary?.top_open_item ?? null,
            fiscal_year_start: fiscalYearRange.start,
            fiscal_year_end: fiscalYearRange.end,
            is_finalized: false,
            finalized_at: periodLock?.year_end_finalized_at ?? null,
            finalized_by: periodLock?.year_end_finalized_by ?? null,
            close_journal_entry_id: periodLock?.year_end_close_journal_entry_id ?? null,
            reopened_at: periodLock?.year_end_reopened_at ?? null,
            reopened_by: periodLock?.year_end_reopened_by ?? null,
            reopened_reason: periodLock?.year_end_reopen_reason ?? null,
            note: isReopenedForPeriod
                ? `Year-end close was reopened${periodLock?.year_end_reopened_by ? ` by ${periodLock.year_end_reopened_by}` : ''}. Complete the remaining changes, then finalize again.`
                : hasAttention
                ? closeReadiness?.top_issue ?? 'Year-end close still has open checklist or finance control items.'
                : 'Year-end close governance is currently clear.',
        };
    }

    private getFiscalYearRange(periodKey: string): { start: string; end: string } {
        const [year, month] = periodKey.split('-').map(Number);
        if (!year || !month) {
            throw new BadRequestException('Invalid fiscal period key supplied.');
        }
        if (month !== 6) {
            const fiscalEndYear = month <= 6 ? year : year + 1;
            return {
                start: `${fiscalEndYear - 1}-07-01`,
                end: `${fiscalEndYear}-06-30`,
            };
        }
        return {
            start: `${year - 1}-07-01`,
            end: `${year}-06-30`,
        };
    }

    private buildYearEndSourceId(branchId: number, periodKey: string): string {
        return `${branchId}:${periodKey}`;
    }

    private getPeriodEndDate(periodKey: string): string {
        const [year, month] = periodKey.split('-').map(Number);
        if (!year || !month) {
            throw new BadRequestException('Invalid period key supplied.');
        }
        const end = new Date(year, month, 0);
        return this.formatBusinessDate(end);
    }

    private resolveBusinessDateRange(businessDate: string): { start: Date; end: Date } {
        const start = new Date(`${businessDate}T00:00:00`);
        if (Number.isNaN(start.getTime())) {
            throw new BadRequestException('Invalid business date supplied.');
        }

        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start, end };
    }

    private resolveActorName(user?: JwtPayload): string | null {
        return user?.username || user?.email || (user?.sub ? String(user.sub) : null);
    }

    private resolvePeriodKey(value?: string | null): string {
        if (value && /^\d{4}-\d{2}$/.test(value)) {
            return value;
        }
        const today = this.formatBusinessDate(new Date());
        return today.slice(0, 7);
    }

    private addDays(dateValue: string, days: number): string {
        const parsed = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return dateValue;
        }
        parsed.setDate(parsed.getDate() + days);
        return this.formatBusinessDate(parsed);
    }

    private calculateDaysBetween(fromDate: string, toDate: string): number {
        const from = new Date(`${fromDate}T00:00:00`);
        const to = new Date(`${toDate}T00:00:00`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return 0;
        }
        return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
    }

    private getDefaultMonthCloseChecklistItems() {
        return [
            { item_key: 'grn_bills_captured', item_label: 'All pending-bill GRNs reviewed and vendor bills captured' },
            { item_key: 'payables_reviewed', item_label: 'Overdue payables reviewed and approved for action' },
            { item_key: 'vendor_payments_reconciled', item_label: 'Vendor payments reconciled to bank and treasury source' },
            { item_key: 'accruals_posted', item_label: 'Required month-end accrual journals posted' },
            { item_key: 'accruals_reversed', item_label: 'Prior accruals reversed or explained before current close' },
            { item_key: 'inventory_blind_verification', item_label: 'Monthly blind full-store inventory verification completed and cleared' },
            { item_key: 'statements_reviewed', item_label: 'Trial balance, P&L, balance sheet, and cash flow reviewed' },
            { item_key: 'period_lock_confirmed', item_label: 'Lock policy confirmed after month-close review' },
        ];
    }

    private async syncInventoryMonthCloseChecklistItem(
        clientId: string,
        branchId: number,
        periodKey: string,
    ) {
        const checklistItem = await this.closeChecklistRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: branchId,
                period_key: periodKey,
                item_key: 'inventory_blind_verification',
            },
        });
        if (!checklistItem) {
            return;
        }

        const branch = await this.branchRepo.findOne({
            where: { client_id: clientId, id: branchId },
        });
        const inventorySettings = {
            blind_random_enabled: true,
            blind_random_frequency: 'daily',
            blind_random_sample_size: 12,
            end_of_day_blind_enabled: true,
            end_of_day_sample_size: 20,
            monthly_blind_full_enabled: true,
            discrepancy_percent_warn_threshold: 3,
            discrepancy_percent_critical_threshold: 8,
            discrepancy_value_warn_threshold: 1000,
            discrepancy_value_critical_threshold: 5000,
            escalation_variance_line_threshold: 3,
            escalation_variance_value_threshold: 5000,
            close_block_on_critical_variance: true,
            ...(branch?.inventory_control_settings ?? {}),
        };

        if (!inventorySettings.monthly_blind_full_enabled) {
            checklistItem.status = AccountingCloseChecklistStatus.COMPLETED;
            checklistItem.notes = 'Monthly blind full verification is disabled for this branch.';
            checklistItem.completed_by = null;
            checklistItem.completed_at = null;
            await this.closeChecklistRepo.save(checklistItem);
            return;
        }

        const monthlySession = await this.inventoryCountSessionRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: branchId,
                count_type: 'monthly_full',
                period_key: periodKey,
            },
            order: { id: 'DESC' },
        });

        if (!monthlySession || ['cancelled', 'scheduled', 'in_progress'].includes(monthlySession.status)) {
            checklistItem.status = AccountingCloseChecklistStatus.PENDING;
            checklistItem.notes = monthlySession
                ? `Monthly blind verification ${monthlySession.session_code} is still in progress.`
                : 'Monthly blind full-store verification has not been completed for this period.';
            checklistItem.completed_by = null;
            checklistItem.completed_at = null;
            await this.closeChecklistRepo.save(checklistItem);
            return;
        }

        const requiresBlock = ['submitted', 'under_review', 'adjustment_pending', 'escalated'].includes(monthlySession.status)
            || (
                inventorySettings.close_block_on_critical_variance
                && (
                    Boolean(monthlySession.escalation_required)
                    || Number(monthlySession.critical_line_count ?? 0) > 0
                )
            );

        if (requiresBlock) {
            checklistItem.status = AccountingCloseChecklistStatus.BLOCKED;
            checklistItem.notes = ['submitted', 'under_review', 'adjustment_pending', 'escalated'].includes(monthlySession.status)
                ? `Monthly blind verification ${monthlySession.session_code} is not yet reconciled.`
                : `Monthly blind verification ${monthlySession.session_code} has critical variance that must be resolved before close.`;
            checklistItem.completed_by = null;
            checklistItem.completed_at = null;
            await this.closeChecklistRepo.save(checklistItem);
            return;
        }

        checklistItem.status = AccountingCloseChecklistStatus.COMPLETED;
        checklistItem.notes = `Monthly blind verification ${monthlySession.session_code} cleared for close.`;
        checklistItem.completed_by = monthlySession.reviewed_by_name || monthlySession.counted_by_name || null;
        checklistItem.completed_at = monthlySession.closed_at || monthlySession.reviewed_at || monthlySession.submitted_at || null;
        await this.closeChecklistRepo.save(checklistItem);
    }

    private getYearEndChecklistItems() {
        return [
            { item_key: 'year_end_result_reviewed', item_label: 'Year-end result reviewed and ready for retained earnings transfer' },
        ];
    }

    private async ensureMonthCloseChecklistItems(
        clientId: string,
        branchId: number,
        periodKey: string,
    ) {
        const existing = await this.closeChecklistRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                period_key: periodKey,
            },
            order: { id: 'ASC' },
        });
        const existingKeys = new Set(existing.map((item) => item.item_key));
        const templates = [
            ...this.getDefaultMonthCloseChecklistItems(),
            ...(this.isYearEndPeriod(periodKey) ? this.getYearEndChecklistItems() : []),
        ];
        const missing = templates
            .filter((template) => !existingKeys.has(template.item_key))
            .map((template) => this.closeChecklistRepo.create({
                client_id: clientId,
                branch_id: branchId,
                period_key: periodKey,
                item_key: template.item_key,
                item_label: template.item_label,
                status: AccountingCloseChecklistStatus.PENDING,
            }));

        if (missing.length > 0) {
            await this.closeChecklistRepo.save(missing);
        }

        return this.closeChecklistRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                period_key: periodKey,
            },
            order: { id: 'ASC' },
        });
    }

    private async getPendingAccrualSummary(clientId: string, branchId?: number | null, periodKey?: string | null) {
        const query = this.entryRepo.createQueryBuilder('entry')
            .where('entry.client_id = :clientId', { clientId })
            .andWhere('entry.is_accrual = 1')
            .andWhere('entry.accrual_reversal_status = :status', { status: JournalAccrualReversalStatus.PENDING });

        if (branchId) {
            query.andWhere('entry.branch_id = :branchId', { branchId });
        }
        if (periodKey) {
            query.andWhere(`DATE_FORMAT(entry.business_date, '%Y-%m') = :periodKey`, { periodKey });
        }

        const pendingEntries = await query
            .orderBy('entry.business_date', 'ASC')
            .addOrderBy('entry.id', 'ASC')
            .getMany();

        const overdueEntries = pendingEntries.filter((entry) =>
            Boolean(entry.accrual_reversal_due_date)
            && entry.accrual_reversal_due_date! < this.formatBusinessDate(new Date()),
        );
        const totalAmount = pendingEntries.reduce((sum, entry) => sum + this.normalizeAmount(entry.total_debit), 0);

        return {
            count: pendingEntries.length,
            overdue_count: overdueEntries.length,
            total_amount: this.roundMoney(totalAmount),
            top_due_date: pendingEntries[0]?.accrual_reversal_due_date ?? null,
            entries: pendingEntries.slice(0, 5).map((entry) => ({
                id: entry.id,
                business_date: entry.business_date,
                description: entry.description,
                total_amount: this.roundMoney(entry.total_debit),
                accrual_reversal_due_date: entry.accrual_reversal_due_date,
                is_overdue: Boolean(
                    entry.accrual_reversal_due_date
                    && entry.accrual_reversal_due_date < this.formatBusinessDate(new Date()),
                ),
            })),
        };
    }

    private async getCloseAdjustmentScheduleSummary(clientId: string, branchId?: number | null, periodKey?: string | null) {
        const query = this.entryRepo.createQueryBuilder('entry')
            .where('entry.client_id = :clientId', { clientId })
            .andWhere('entry.close_adjustment_type IS NOT NULL');

        if (branchId) {
            query.andWhere('entry.branch_id = :branchId', { branchId });
        }
        if (periodKey) {
            query.andWhere(
                `(DATE_FORMAT(entry.schedule_start_date, '%Y-%m') = :periodKey OR DATE_FORMAT(entry.schedule_end_date, '%Y-%m') = :periodKey OR DATE_FORMAT(entry.business_date, '%Y-%m') = :periodKey)`,
                { periodKey },
            );
        }

        const entries = await query
            .orderBy('entry.schedule_end_date', 'ASC')
            .addOrderBy('entry.business_date', 'ASC')
            .addOrderBy('entry.id', 'ASC')
            .getMany();

        const today = this.formatBusinessDate(new Date());
        const activeEntries = entries;
        const overdueEntries = activeEntries.filter((entry) => Boolean(entry.schedule_end_date) && entry.schedule_end_date! < today);
        const prepaidEntries = activeEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.PREPAID_EXPENSE);
        const deferredEntries = activeEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.DEFERRED_REVENUE);
        const depreciationEntries = activeEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.DEPRECIATION);
        const overduePrepaidEntries = overdueEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.PREPAID_EXPENSE);
        const overdueDeferredEntries = overdueEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.DEFERRED_REVENUE);
        const overdueDepreciationEntries = overdueEntries.filter((entry) => entry.close_adjustment_type === JournalCloseAdjustmentType.DEPRECIATION);
        const totalAmount = activeEntries.reduce((sum, entry) => sum + this.normalizeAmount(entry.total_debit), 0);
        const topPriorityEntry = overdueEntries[0] ?? activeEntries[0] ?? null;
        const formatAdjustmentType = (value?: JournalCloseAdjustmentType | null) => {
            if (value === JournalCloseAdjustmentType.PREPAID_EXPENSE) return 'Prepaid Expense';
            if (value === JournalCloseAdjustmentType.DEFERRED_REVENUE) return 'Deferred Revenue';
            if (value === JournalCloseAdjustmentType.DEPRECIATION) return 'Depreciation';
            return 'Close Adjustment';
        };

        return {
            count: activeEntries.length,
            overdue_count: overdueEntries.length,
            total_amount: this.roundMoney(totalAmount),
            prepaid_count: prepaidEntries.length,
            deferred_count: deferredEntries.length,
            depreciation_count: depreciationEntries.length,
            overdue_prepaid_count: overduePrepaidEntries.length,
            overdue_deferred_count: overdueDeferredEntries.length,
            overdue_depreciation_count: overdueDepreciationEntries.length,
            top_end_date: activeEntries[0]?.schedule_end_date ?? null,
            top_priority: topPriorityEntry
                ? {
                    id: topPriorityEntry.id,
                    business_date: topPriorityEntry.business_date,
                    description: topPriorityEntry.description,
                    total_amount: this.roundMoney(topPriorityEntry.total_debit),
                    close_adjustment_type: topPriorityEntry.close_adjustment_type,
                    close_adjustment_type_label: formatAdjustmentType(topPriorityEntry.close_adjustment_type),
                    schedule_start_date: topPriorityEntry.schedule_start_date,
                    schedule_end_date: topPriorityEntry.schedule_end_date,
                    is_overdue: Boolean(topPriorityEntry.schedule_end_date && topPriorityEntry.schedule_end_date < today),
                    review_note: topPriorityEntry.schedule_end_date && topPriorityEntry.schedule_end_date < today
                        ? `${formatAdjustmentType(topPriorityEntry.close_adjustment_type)} schedule has passed its planned end date and needs review.`
                        : `${formatAdjustmentType(topPriorityEntry.close_adjustment_type)} schedule is the next close adjustment in scope.`,
                }
                : null,
            entries: activeEntries.slice(0, 5).map((entry) => ({
                id: entry.id,
                business_date: entry.business_date,
                description: entry.description,
                total_amount: this.roundMoney(entry.total_debit),
                close_adjustment_type: entry.close_adjustment_type,
                schedule_start_date: entry.schedule_start_date,
                schedule_end_date: entry.schedule_end_date,
                is_overdue: Boolean(entry.schedule_end_date && entry.schedule_end_date < today),
            })),
        };
    }

    private summarizeMonthCloseChecklist(items: AccountingCloseChecklistItem[]) {
        const completedCount = items.filter((item) => item.status === AccountingCloseChecklistStatus.COMPLETED).length;
        const blockedCount = items.filter((item) => item.status === AccountingCloseChecklistStatus.BLOCKED).length;
        return {
            total_count: items.length,
            completed_count: completedCount,
            pending_count: items.length - completedCount - blockedCount,
            blocked_count: blockedCount,
            completion_percent: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
            top_open_item: items.find((item) => item.status !== AccountingCloseChecklistStatus.COMPLETED)?.item_label ?? null,
        };
    }

    private hasPeriodLockOverride(user?: JwtPayload | null): boolean {
        const permissions = new Set(user?.effective_permissions ?? []);
        return permissions.has('all')
            || permissions.has(APP_PERMISSIONS.ACCOUNTING.JOURNAL_APPROVE)
            || permissions.has(APP_PERMISSIONS.ACCOUNTING.COA_MANAGE)
            || permissions.has(APP_PERMISSIONS.ADMIN.SECURITY_ACCESS);
    }

    private async getEffectivePeriodLock(clientId: string, branchId?: number | null) {
        if (branchId) {
            const branchLock = await this.periodLockRepo.findOne({
                where: { client_id: clientId, branch_id: branchId },
                relations: ['branch'],
                order: { id: 'DESC' },
            });
            if (branchLock) {
                return branchLock;
            }
        }

        return this.periodLockRepo.createQueryBuilder('period_lock')
            .where('period_lock.client_id = :clientId', { clientId })
            .andWhere('period_lock.branch_id IS NULL')
            .orderBy('period_lock.id', 'DESC')
            .getOne();
    }

    async assertPeriodUnlockedForOperation(
        clientId: string,
        branchId: number | undefined,
        businessDate: string,
        operation: string,
        user?: JwtPayload | null,
    ) {
        const lock = await this.getEffectivePeriodLock(clientId, branchId ?? null);
        if (!lock || lock.mode === PeriodLockMode.NONE || !lock.locked_through_date) {
            return;
        }
        if (businessDate > lock.locked_through_date) {
            return;
        }
        if (lock.mode === PeriodLockMode.ADMIN_OVERRIDE && this.hasPeriodLockOverride(user)) {
            return;
        }

        const scopeLabel = lock.branch?.branch_name
            ? `branch ${lock.branch.branch_name}`
            : 'company';
        throw new BadRequestException(
            `This period is locked through ${lock.locked_through_date} for ${scopeLabel}. ${operation} is blocked.`,
        );
    }

    private async ensureBaseChart(clientId: string): Promise<void> {
        const existingAccounts = await this.coaRepo.find({
            where: { client_id: clientId },
            order: { account_code: 'ASC' },
        });
        const createdByCode = new Map<string, ChartOfAccount>(
            existingAccounts.map((account) => [account.account_code, account]),
        );

        for (const definition of this.baseAccounts) {
            const existing = createdByCode.get(definition.account_code);
            const parentId = definition.parent_code ? createdByCode.get(definition.parent_code)?.id ?? null : null;
            const guidance = this.baseAccountGuidance[definition.account_code];
            const payload: Partial<ChartOfAccount> = {
                client_id: clientId,
                account_code: definition.account_code,
                account_name: definition.account_name,
                account_type: definition.account_type,
                scope: definition.scope ?? AccountScope.COMPANY,
                parent_id: parentId,
                is_active: true,
                description: guidance?.description ?? null,
                usage_guidance: guidance?.usage_guidance ?? null,
                example_entry: guidance?.example_entry ?? null,
                confusion_note: guidance?.confusion_note ?? null,
                schedule_code: definition.schedule_code ?? null,
                is_control_account: definition.is_control_account ?? false,
                allow_manual_posting: definition.allow_manual_posting ?? true,
                is_bank_account: definition.is_bank_account ?? false,
                is_cash_account: definition.is_cash_account ?? false,
                is_petty_cash_account: definition.is_petty_cash_account ?? false,
                is_system: definition.is_system ?? false,
            };

            const account = existing
                ? Object.assign(existing, {
                    account_name: existing.account_name || payload.account_name,
                    account_type: existing.account_type || payload.account_type,
                    scope: existing.scope || payload.scope,
                    parent_id: existing.parent_id ?? payload.parent_id,
                    description: existing.description ?? payload.description ?? null,
                    usage_guidance: existing.usage_guidance ?? payload.usage_guidance ?? null,
                    example_entry: existing.example_entry ?? payload.example_entry ?? null,
                    confusion_note: existing.confusion_note ?? payload.confusion_note ?? null,
                    schedule_code: existing.schedule_code ?? payload.schedule_code ?? null,
                    is_control_account: existing.is_control_account ?? payload.is_control_account ?? false,
                    allow_manual_posting: existing.allow_manual_posting ?? payload.allow_manual_posting ?? true,
                    is_bank_account: existing.is_bank_account ?? payload.is_bank_account ?? false,
                    is_cash_account: existing.is_cash_account ?? payload.is_cash_account ?? false,
                    is_petty_cash_account: existing.is_petty_cash_account ?? payload.is_petty_cash_account ?? false,
                    is_system: existing.is_system ?? payload.is_system ?? false,
                })
                : this.coaRepo.create(payload);

            const saved = await this.coaRepo.save(account);
            createdByCode.set(definition.account_code, saved);
        }
    }

    private sanitizeAccountFlags(dto: CreateAccountDto | UpdateAccountDto) {
        if (dto.is_bank_account && dto.is_cash_account) {
            throw new BadRequestException('An account cannot be both a bank account and a cash account');
        }
        if ((dto.is_bank_account || dto.is_cash_account) && dto.account_type !== AccountType.ASSET) {
            throw new BadRequestException('Cash and bank flags can only be applied to asset accounts');
        }
        if (dto.is_petty_cash_account && !dto.is_cash_account) {
            throw new BadRequestException('Petty cash accounts must also be marked as cash accounts');
        }
        if (dto.is_petty_cash_account && dto.is_bank_account) {
            throw new BadRequestException('Petty cash accounts cannot be marked as bank accounts');
        }
        const treasuryInstitutionName = dto.treasury_institution_name?.trim() || dto.bank_name?.trim() || null;
        const treasuryAccountTitle = dto.treasury_account_title?.trim() || dto.account_title?.trim() || null;
        const treasuryReferenceNoIban = dto.treasury_reference_no_iban?.trim() || dto.account_number_iban?.trim() || null;
        const treasuryCurrencyCode = dto.treasury_currency_code?.trim().toUpperCase() || dto.currency_code?.trim().toUpperCase() || null;
        const treasuryAccountType = dto.treasury_account_type ?? dto.bank_account_type ?? null;
        const description = dto.description?.trim() || null;

        if (dto.is_bank_account) {
            if (!treasuryInstitutionName) {
                throw new BadRequestException('Institution / bank name is required for treasury accounts');
            }
            if (!treasuryAccountTitle) {
                throw new BadRequestException('Account title is required for treasury accounts');
            }
            if (!treasuryReferenceNoIban) {
                throw new BadRequestException('Account number / IBAN is required for treasury accounts');
            }
            if (!treasuryCurrencyCode) {
                throw new BadRequestException('Currency is required for treasury accounts');
            }
            if (!treasuryAccountType || !Object.values(BankAccountType).includes(treasuryAccountType)) {
                throw new BadRequestException('Treasury account type is required for treasury accounts');
            }
            if (!description) {
                throw new BadRequestException('Description is required for treasury accounts');
            }
        }
        return {
            description,
            bank_name: dto.is_bank_account ? treasuryInstitutionName : null,
            treasury_institution_name: dto.is_bank_account ? treasuryInstitutionName : null,
            account_title: dto.is_bank_account ? treasuryAccountTitle : null,
            treasury_account_title: dto.is_bank_account ? treasuryAccountTitle : null,
            account_number_iban: dto.is_bank_account ? treasuryReferenceNoIban : null,
            treasury_reference_no_iban: dto.is_bank_account ? treasuryReferenceNoIban : null,
            currency_code: dto.is_bank_account ? treasuryCurrencyCode : null,
            treasury_currency_code: dto.is_bank_account ? treasuryCurrencyCode : null,
            bank_account_type: dto.is_bank_account ? treasuryAccountType : null,
            treasury_account_type: dto.is_bank_account ? treasuryAccountType : null,
            usage_guidance: dto.usage_guidance?.trim() || null,
            example_entry: dto.example_entry?.trim() || null,
            confusion_note: dto.confusion_note?.trim() || null,
            schedule_code: dto.schedule_code?.trim() || null,
            is_control_account: dto.is_control_account ?? false,
            allow_manual_posting: dto.allow_manual_posting ?? true,
            is_bank_account: dto.is_bank_account ?? false,
            is_cash_account: dto.is_cash_account ?? false,
            is_petty_cash_account: dto.is_petty_cash_account ?? false,
        };
    }

    private inferAgingBucket(daysPastDue: number): AgingBucketKey {
        if (daysPastDue <= 0) return 'current';
        if (daysPastDue <= 30) return 'days_1_30';
        if (daysPastDue <= 60) return 'days_31_60';
        if (daysPastDue <= 90) return 'days_61_90';
        return 'days_90_plus';
    }

    private diffInDays(asOfDate: string | Date, dueDate: string | Date): number {
        const normalizedAsOfDate = this.normalizeBusinessDateValue(asOfDate);
        const normalizedDueDate = this.normalizeBusinessDateValue(dueDate);
        const end = new Date(`${normalizedAsOfDate}T00:00:00`);
        const start = new Date(`${normalizedDueDate}T00:00:00`);
        if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
            return 0;
        }
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    private buildAgingSummary<T extends { outstanding_amount: number; due_date?: string | null; document_date?: string | null }>(rows: T[], asOfDate: string) {
        const buckets: Record<AgingBucketKey, number> = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_90_plus: 0,
        };

        for (const row of rows) {
            const agingDate = this.resolveAgingDate(row.due_date, row.document_date);
            const key = this.inferAgingBucket(this.diffInDays(asOfDate, agingDate));
            buckets[key] += this.roundMoney(row.outstanding_amount);
        }

        return {
            current: this.roundMoney(buckets.current),
            days_1_30: this.roundMoney(buckets.days_1_30),
            days_31_60: this.roundMoney(buckets.days_31_60),
            days_61_90: this.roundMoney(buckets.days_61_90),
            days_90_plus: this.roundMoney(buckets.days_90_plus),
            total_outstanding: this.roundMoney(
                buckets.current + buckets.days_1_30 + buckets.days_31_60 + buckets.days_61_90 + buckets.days_90_plus,
            ),
        };
    }

    private normalizeBusinessDateValue(value?: string | Date | null): string {
        if (!value) {
            return '';
        }
        if (value instanceof Date) {
            return this.formatBusinessDate(value);
        }
        const raw = String(value).trim();
        if (!raw) {
            return '';
        }
        const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) {
            return isoMatch[1];
        }
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return this.formatBusinessDate(parsed);
        }
        return '';
    }

    private resolveAgingDate(dueDate?: string | Date | null, documentDate?: string | Date | null): string {
        const normalizedDueDate = this.normalizeBusinessDateValue(dueDate);
        if (normalizedDueDate) {
            return normalizedDueDate;
        }
        const normalizedDocumentDate = this.normalizeBusinessDateValue(documentDate);
        if (normalizedDocumentDate) {
            return normalizedDocumentDate;
        }
        return this.formatBusinessDate(new Date());
    }

    private async validateAccountMutation(
        clientId: string,
        dto: CreateAccountDto | UpdateAccountDto,
        currentId?: number,
        forcedBranchId?: number,
    ): Promise<{ branchId: number | null; parentId: number | null }> {
        const scope = dto.scope ?? AccountScope.COMPANY;
        const branchId = scope === AccountScope.BRANCH ? forcedBranchId ?? dto.branch_id ?? null : null;

        if (scope === AccountScope.BRANCH && !branchId) {
            throw new BadRequestException('Branch-scoped accounts require a branch context');
        }
        if (dto.is_petty_cash_account && scope !== AccountScope.BRANCH) {
            throw new BadRequestException('Petty cash accounts must be branch-scoped');
        }
        await this.assertBranchBelongsToClient(clientId, branchId ?? undefined);

        let parentId = dto.parent_id ?? null;
        if (parentId) {
            const parent = await this.coaRepo.findOne({
                where: { id: parentId, client_id: clientId },
            });
            if (!parent) {
                throw new NotFoundException(`Parent account ${parentId} not found`);
            }
            if (currentId && parent.id === currentId) {
                throw new BadRequestException('An account cannot be its own parent');
            }
            if (parent.account_type !== dto.account_type) {
                throw new BadRequestException('Parent and child accounts must use the same account type');
            }
            if (scope === AccountScope.COMPANY && parent.scope === AccountScope.BRANCH) {
                throw new BadRequestException('A company account cannot sit under a branch-scoped parent');
            }
            if (scope === AccountScope.BRANCH && parent.scope === AccountScope.BRANCH && parent.branch_id !== branchId) {
                throw new BadRequestException('Branch-scoped child accounts must use a parent from the same branch or a company-level parent');
            }
            parentId = parent.id;
        }

        const duplicate = await this.coaRepo.findOne({
            where: { client_id: clientId, account_code: dto.account_code.trim() },
        });
        if (duplicate && duplicate.id !== currentId) {
            throw new BadRequestException(`Account code ${dto.account_code.trim()} already exists`);
        }

        return { branchId, parentId };
    }

    private async assertAccountGovernance(
        clientId: string,
        current: ChartOfAccount,
        dto: UpdateAccountDto,
        validated: { branchId: number | null; parentId: number | null },
    ) {
        const hasChildren = await this.coaRepo.exist({
            where: { client_id: clientId, parent_id: current.id },
        });
        const hasActiveChildren = await this.coaRepo.exist({
            where: { client_id: clientId, parent_id: current.id, is_active: true },
        });
        const hasJournalUsage = await this.dataSource.getRepository(JournalItem).exist({
            where: { account_id: current.id },
        });
        const structuralChange =
            current.account_code !== dto.account_code.trim()
            || current.account_type !== dto.account_type
            || current.scope !== (dto.scope ?? AccountScope.COMPANY)
            || (current.branch_id ?? null) !== validated.branchId
            || (current.parent_id ?? null) !== validated.parentId;

        if ((current.is_system || current.is_control_account) && structuralChange) {
            throw new BadRequestException('System and control accounts cannot be structurally changed');
        }
        if ((current.is_system || current.is_control_account) && dto.is_active === false) {
            throw new BadRequestException('System and control accounts cannot be disabled');
        }
        if (hasActiveChildren && dto.is_active === false) {
            throw new BadRequestException('Parent accounts with active child accounts cannot be disabled');
        }
        if (hasChildren && structuralChange) {
            throw new BadRequestException('Accounts with child accounts cannot be moved or reclassified');
        }
        if (hasJournalUsage && structuralChange) {
            throw new BadRequestException('Accounts already used in journals cannot be structurally changed');
        }
        if (hasJournalUsage && current.allow_manual_posting !== (dto.allow_manual_posting ?? current.allow_manual_posting)) {
            throw new BadRequestException('Manual posting policy cannot change after the account has journal activity');
        }
        if (
            hasJournalUsage &&
            (
                current.is_bank_account !== (dto.is_bank_account ?? current.is_bank_account)
                || current.is_cash_account !== (dto.is_cash_account ?? current.is_cash_account)
                || current.is_petty_cash_account !== (dto.is_petty_cash_account ?? current.is_petty_cash_account)
            )
        ) {
            throw new BadRequestException('Cash/bank or petty cash classification cannot change after the account has journal activity');
        }
    }

    private buildAccountTree(accounts: AccountRow[]): AccountRow[] {
        const byId = new Map<number, AccountRow>();
        const roots: AccountRow[] = [];

        for (const account of accounts) {
            byId.set(account.id, { ...account, children: [] });
        }

        for (const account of byId.values()) {
            if (account.parent_id && byId.has(account.parent_id)) {
                byId.get(account.parent_id)!.children!.push(account);
            } else {
                roots.push(account);
            }
        }

        const sortRecursive = (rows: AccountRow[]) => {
            rows.sort((a, b) => a.account_code.localeCompare(b.account_code));
            for (const row of rows) {
                if (row.children && row.children.length > 0) {
                    sortRecursive(row.children);
                } else {
                    row.children = [];
                }
            }
        };

        sortRecursive(roots);
        return roots;
    }

    async createAccount(clientId: string, dto: CreateAccountDto): Promise<ChartOfAccount> {
        await this.ensureBaseChart(clientId);
        const { branchId, parentId } = await this.validateAccountMutation(clientId, dto);

        const account = this.coaRepo.create({
            client_id: clientId,
            account_code: dto.account_code.trim(),
            account_name: dto.account_name.trim(),
            account_type: dto.account_type,
            parent_id: parentId,
            branch_id: branchId,
            scope: dto.scope ?? AccountScope.COMPANY,
            is_active: dto.is_active ?? true,
            is_system: false,
            ...this.sanitizeAccountFlags(dto),
        });
        return this.coaRepo.save(account);
    }

    async updateAccount(
        clientId: string,
        id: number,
        branchId: number | undefined,
        dto: UpdateAccountDto,
    ): Promise<ChartOfAccount> {
        await this.ensureBaseChart(clientId);
        const account = await this.coaRepo.findOne({ where: { id, client_id: clientId } });
        if (!account) {
            throw new NotFoundException(`Account ${id} not found`);
        }

        const validated = await this.validateAccountMutation(clientId, dto, id, branchId);
        await this.assertAccountGovernance(clientId, account, dto, validated);
        account.account_code = dto.account_code.trim();
        account.account_name = dto.account_name.trim();
        account.account_type = dto.account_type;
        account.parent_id = validated.parentId;
        account.branch_id = validated.branchId;
        account.scope = dto.scope ?? AccountScope.COMPANY;
        account.is_active = dto.is_active ?? account.is_active;
        Object.assign(account, this.sanitizeAccountFlags(dto));

        return this.coaRepo.save(account);
    }

    async getAccounts(clientId: string, accessibleBranchIds?: number[]): Promise<AccountRow[]> {
        await this.ensureBaseChart(clientId);

        const accounts = await this.coaRepo.find({
            where: { client_id: clientId },
            order: { account_code: 'ASC' },
        });
        const scopedAccounts = accessibleBranchIds?.length
            ? accounts.filter((account) => !account.branch_id || accessibleBranchIds.includes(account.branch_id))
            : accounts;
        const trialBalance = await this.getTrialBalance(clientId);
        const balancesById = new Map<number, number>(
            trialBalance.accounts.map((row: any) => [Number(row.id), this.normalizeAmount(row.net_balance)]),
        );

        return this.buildAccountTree(
            scopedAccounts.map((account) => ({
                ...account,
                balance: balancesById.get(account.id) ?? 0,
            })),
        );
    }

    private async generatePettyCashAccountCode(clientId: string, branchId: number): Promise<string> {
        const prefix = `1101-PC-${branchId}-`;
        const existing = await this.coaRepo.find({
            where: { client_id: clientId, is_petty_cash_account: true, branch_id: branchId },
            order: { account_code: 'ASC' },
        });

        const sequence = existing.reduce((max, account) => {
            const suffix = String(account.account_code ?? '').startsWith(prefix)
                ? Number(String(account.account_code).slice(prefix.length))
                : 0;
            return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
        }, 0) + 1;

        return `${prefix}${String(sequence).padStart(2, '0')}`;
    }

    private async resolvePettyCashAccount(
        clientId: string,
        branchId: number,
        accountId: number,
    ): Promise<ChartOfAccount> {
        const account = await this.coaRepo.findOne({
            where: { id: accountId, client_id: clientId },
            relations: ['branch'],
        });
        if (!account) {
            throw new NotFoundException(`Petty cash account ${accountId} not found`);
        }
        if (!account.is_petty_cash_account || !account.is_cash_account || account.account_type !== AccountType.ASSET) {
            throw new BadRequestException('Selected account is not a petty cash account.');
        }
        if (account.scope !== AccountScope.BRANCH || !account.branch_id || account.branch_id !== branchId) {
            throw new BadRequestException('Petty cash account is not available for this branch.');
        }
        if (!account.is_active) {
            throw new BadRequestException('Petty cash account is inactive.');
        }
        return account;
    }

    private async resolveFundingAccount(
        clientId: string,
        branchId: number,
        accountId: number,
    ): Promise<ChartOfAccount> {
        const account = await this.coaRepo.findOne({
            where: { id: accountId, client_id: clientId },
            relations: ['branch'],
        });
        if (!account) {
            throw new NotFoundException(`Funding account ${accountId} not found`);
        }
        if (!account.is_active) {
            throw new BadRequestException('Funding account is inactive.');
        }
        if (account.account_type !== AccountType.ASSET || (!account.is_cash_account && !account.is_bank_account)) {
            throw new BadRequestException('Funding account must be an active cash or bank asset account.');
        }
        if (account.scope === AccountScope.BRANCH && account.branch_id && account.branch_id !== branchId) {
            throw new BadRequestException('Funding account is not available for this branch.');
        }
        if (account.is_petty_cash_account) {
            throw new BadRequestException('Petty cash cannot be funded from another petty cash account.');
        }
        return account;
    }

    async getPettyCashOverview(
        clientId: string,
        branchId?: number,
        dateFrom?: string,
        dateTo?: string,
        accessibleBranchIds?: number[],
    ) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const accountQuery = this.coaRepo.createQueryBuilder('coa')
            .leftJoinAndSelect('coa.branch', 'branch')
            .where('coa.client_id = :clientId', { clientId })
            .andWhere('coa.is_petty_cash_account = :flag', { flag: true });

        if (branchId) {
            accountQuery.andWhere('coa.branch_id = :branchId', { branchId });
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            accountQuery.andWhere('coa.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }

        const pettyAccounts = await accountQuery.orderBy('coa.account_code', 'ASC').getMany();
        const pettyAccountIds = pettyAccounts.map((account) => account.id);
        const trialBalance = await this.getTrialBalance(clientId);
        const balancesById = new Map<number, number>(
            (trialBalance?.accounts ?? []).map((row: any) => [Number(row.id), this.normalizeAmount(row.net_balance)]),
        );

        const accounts = pettyAccounts.map((account) => ({
            id: account.id,
            account_code: account.account_code,
            account_name: account.account_name,
            branch_id: account.branch_id,
            branch_name: account.branch?.branch_name ?? `Branch ${account.branch_id}`,
            current_balance: this.roundMoney(balancesById.get(account.id) ?? 0),
            is_active: account.is_active,
            created_at: account.created_at,
            updated_at: account.updated_at,
        }));

        if (pettyAccountIds.length === 0) {
            return {
                summary: {
                    total_balance: 0,
                    month_expense: 0,
                    last_refill_amount: 0,
                    pending_expense_count: 0,
                    active_accounts: 0,
                },
                accounts,
                transactions: [],
            };
        }

        const voucherRepo = this.dataSource.getRepository(FinancialVoucher);
        const voucherQuery = voucherRepo.createQueryBuilder('voucher')
            .leftJoinAndSelect('voucher.branch', 'branch')
            .leftJoinAndSelect('voucher.expense_account', 'expense_account')
            .leftJoinAndSelect('voucher.treasury_account', 'treasury_account')
            .where('voucher.client_id = :clientId', { clientId })
            .andWhere('voucher.type = :type', { type: 'EXPENSE' })
            .andWhere('voucher.treasury_account_id IN (:...pettyAccountIds)', { pettyAccountIds });

        if (branchId) {
            voucherQuery.andWhere('voucher.branch_id = :branchId', { branchId });
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            voucherQuery.andWhere('voucher.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }
        if (dateFrom) {
            voucherQuery.andWhere('voucher.date >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            voucherQuery.andWhere('voucher.date <= :dateTo', { dateTo });
        }

        const vouchers = await voucherQuery.orderBy('voucher.date', 'DESC').addOrderBy('voucher.id', 'DESC').getMany();

        const journalQuery = this.entryRepo.createQueryBuilder('entry')
            .leftJoinAndSelect('entry.branch', 'branch')
            .leftJoinAndSelect('entry.items', 'item')
            .leftJoinAndSelect('item.account', 'account')
            .where('entry.client_id = :clientId', { clientId })
            .andWhere('entry.source_event IN (:...events)', { events: ['petty_cash_refill', 'petty_cash_opening'] })
            .andWhere('item.account_id IN (:...pettyAccountIds)', { pettyAccountIds });

        if (branchId) {
            journalQuery.andWhere('entry.branch_id = :branchId', { branchId });
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            journalQuery.andWhere('entry.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }
        if (dateFrom) {
            journalQuery.andWhere('entry.transaction_date >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            journalQuery.andWhere('entry.transaction_date <= :dateTo', { dateTo });
        }

        const journals = await journalQuery.orderBy('entry.transaction_date', 'DESC').addOrderBy('entry.id', 'DESC').getMany();

        const transactions = [
            ...vouchers.map((voucher: any) => ({
                id: `voucher-${voucher.id}`,
                record_id: voucher.id,
                source: 'voucher',
                date: voucher.date,
                branch_id: voucher.branch_id,
                branch_name: voucher.branch?.branch_name ?? `Branch ${voucher.branch_id}`,
                account_id: voucher.treasury_account_id,
                account_code: voucher.treasury_account?.account_code ?? null,
                account_name: voucher.treasury_account?.account_name ?? voucher.payment_source_label ?? 'Petty Cash',
                category: voucher.expense_account?.account_name ?? 'Expense',
                description: voucher.description ?? voucher.reference_no ?? voucher.voucher_no,
                type: 'expense',
                amount: this.roundMoney(voucher.amount),
                status: voucher.status,
                reference_no: voucher.reference_no ?? voucher.voucher_no,
                payment_method: voucher.payment_method ?? 'Cash',
            })),
            ...journals.map((entry) => {
                const pettyItem = (entry.items ?? []).find((item) => pettyAccountIds.includes(item.account_id) && this.normalizeAmount(item.debit) > 0);
                const sourceItem = (entry.items ?? []).find((item) => item.id !== pettyItem?.id && this.normalizeAmount(item.credit) > 0);
                const eventType = entry.source_event === 'petty_cash_opening' ? 'opening' : 'refill';
                return {
                    id: `journal-${entry.id}`,
                    record_id: entry.id,
                    source: 'journal',
                    date: this.formatBusinessDate(entry.transaction_date),
                    branch_id: entry.branch_id,
                    branch_name: entry.branch?.branch_name ?? `Branch ${entry.branch_id}`,
                    account_id: pettyItem?.account_id ?? null,
                    account_code: pettyItem?.account?.account_code ?? null,
                    account_name: pettyItem?.account?.account_name ?? 'Petty Cash',
                    category: eventType === 'opening' ? 'Opening Balance' : 'Float Refill',
                    description: entry.description ?? `${eventType === 'opening' ? 'Petty cash opening' : 'Petty cash refill'} journal`,
                    type: eventType,
                    amount: this.roundMoney(pettyItem?.debit ?? 0),
                    status: 'APPROVED',
                    reference_no: entry.reference_id ?? `JE-${entry.id}`,
                    payment_method: sourceItem?.account?.is_bank_account ? 'Bank Transfer' : 'Cash',
                };
            }),
        ].sort((left, right) => {
            const leftKey = new Date(`${left.date}T00:00:00`).getTime();
            const rightKey = new Date(`${right.date}T00:00:00`).getTime();
            return rightKey - leftKey || String(right.id).localeCompare(String(left.id));
        });

        const startOfMonth = (() => {
            const base = dateTo || new Date().toISOString().split('T')[0];
            return `${base.slice(0, 7)}-01`;
        })();
        const expenseTransactions = transactions.filter((row) => row.type === 'expense' && row.status === 'APPROVED');
        const refillTransactions = transactions.filter((row) => row.type === 'refill');

        return {
            summary: {
                total_balance: this.roundMoney(accounts.reduce((sum, account) => sum + account.current_balance, 0)),
                month_expense: this.roundMoney(
                    expenseTransactions
                        .filter((row) => row.date >= startOfMonth)
                        .reduce((sum, row) => sum + row.amount, 0),
                ),
                last_refill_amount: this.roundMoney(refillTransactions[0]?.amount ?? 0),
                pending_expense_count: transactions.filter((row) => row.type === 'expense' && row.status === 'PENDING').length,
                active_accounts: accounts.filter((account) => account.is_active).length,
            },
            accounts,
            transactions,
        };
    }

    async createPettyCashAccount(
        clientId: string,
        dto: {
            branch_id: number;
            account_name?: string;
            date: string;
            opening_amount?: number;
            source_account_id?: number | null;
            reference_no?: string;
            description?: string;
        },
        user?: JwtPayload | null,
    ) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'create petty cash accounts');
        await this.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.date, 'Petty cash account setup', user);

        const branch = await this.branchRepo.findOneOrFail({ where: { id: dto.branch_id, client_id: clientId } });
        const parent = await this.coaRepo.findOneOrFail({ where: { client_id: clientId, account_code: '1101' } });
        const accountCode = await this.generatePettyCashAccountCode(clientId, dto.branch_id);
        const accountName = dto.account_name?.trim() || `Petty Cash - ${branch.branch_name}`;
        const openingAmount = this.roundMoney(dto.opening_amount ?? 0);

        if (openingAmount > 0 && !dto.source_account_id) {
            throw new BadRequestException('Opening balance requires a funding source account.');
        }

        return this.dataSource.transaction(async (manager) => {
            const account = manager.create(ChartOfAccount, {
                client_id: clientId,
                account_code: accountCode,
                account_name: accountName,
                account_type: AccountType.ASSET,
                parent_id: parent.id,
                branch_id: dto.branch_id,
                scope: AccountScope.BRANCH,
                is_active: true,
                schedule_code: 'BS_CASH',
                is_control_account: false,
                allow_manual_posting: true,
                is_bank_account: false,
                is_cash_account: true,
                is_petty_cash_account: true,
            });
            const savedAccount = await manager.save(account);

            let openingEntry: JournalEntry | null = null;
            if (openingAmount > 0 && dto.source_account_id) {
                const sourceAccount = await this.resolveFundingAccount(clientId, dto.branch_id, dto.source_account_id);
                if (sourceAccount.id === savedAccount.id) {
                    throw new BadRequestException('Funding source cannot be the same petty cash account.');
                }
                openingEntry = await this.createJournalEntry(
                    clientId,
                    dto.branch_id,
                    {
                        branch_id: dto.branch_id,
                        transaction_date: new Date(`${dto.date}T12:00:00`),
                        business_date: dto.date,
                        description: dto.description?.trim() || `Petty cash opening for ${accountName}`,
                        reference_id: dto.reference_no?.trim() || `PC-OPEN-${savedAccount.id}`,
                        source_module: 'accounting',
                        source_entity_type: 'petty_cash_account',
                        source_entity_id: String(savedAccount.id),
                        source_event: 'petty_cash_opening',
                        posting_type: 'manual',
                        items: [
                            { account_id: savedAccount.id, debit: openingAmount, credit: 0 },
                            { account_id: sourceAccount.id, debit: 0, credit: openingAmount },
                        ],
                    },
                    user ?? undefined,
                );
            }

            return {
                account: savedAccount,
                opening_entry: openingEntry,
            };
        });
    }

    async createPettyCashRefill(
        clientId: string,
        dto: {
            branch_id: number;
            petty_cash_account_id: number;
            source_account_id: number;
            amount: number;
            date: string;
            reference_no?: string;
            description?: string;
        },
        user?: JwtPayload | null,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'refill petty cash');
        await this.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.date, 'Petty cash refill', user);

        const pettyCashAccount = await this.resolvePettyCashAccount(clientId, dto.branch_id, dto.petty_cash_account_id);
        const sourceAccount = await this.resolveFundingAccount(clientId, dto.branch_id, dto.source_account_id);
        const amount = this.roundMoney(dto.amount);

        if (pettyCashAccount.id === sourceAccount.id) {
            throw new BadRequestException('Funding source cannot be the same petty cash account.');
        }

        const journal = await this.createJournalEntry(
            clientId,
            dto.branch_id,
            {
                branch_id: dto.branch_id,
                transaction_date: new Date(`${dto.date}T12:00:00`),
                business_date: dto.date,
                description: dto.description?.trim() || `Petty cash refill for ${pettyCashAccount.account_name}`,
                reference_id: dto.reference_no?.trim() || `PC-RF-${pettyCashAccount.id}`,
                source_module: 'accounting',
                source_entity_type: 'petty_cash_account',
                source_entity_id: String(pettyCashAccount.id),
                source_event: 'petty_cash_refill',
                posting_type: 'manual',
                items: [
                    { account_id: pettyCashAccount.id, debit: amount, credit: 0 },
                    { account_id: sourceAccount.id, debit: 0, credit: amount },
                ],
            },
            user ?? undefined,
        );

        return {
            petty_cash_account: pettyCashAccount,
            source_account: sourceAccount,
            journal,
        };
    }

    async ensureDefaultAccount(
        clientId: string,
        accountCode: string,
        accountName: string,
        accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    ): Promise<ChartOfAccount> {
        await this.ensureBaseChart(clientId);

        let account = await this.coaRepo.findOne({
            where: { client_id: clientId, account_code: accountCode },
        });

        if (!account) {
            account = this.coaRepo.create({
                client_id: clientId,
                account_code: accountCode,
                account_name: accountName,
                account_type: accountType,
                scope: AccountScope.COMPANY,
            });
            await this.coaRepo.save(account);
        }

        return account;
    }

    private async generateFixedAssetItemNo(clientId: string): Promise<string> {
        const latest = await this.fixedAssetItemRepo.findOne({
            where: { client_id: clientId },
            order: { id: 'DESC' },
        });
        const next = (latest?.id ?? 0) + 1;
        return `FA-${String(next).padStart(4, '0')}`;
    }

    private async generateFixedAssetUnitNumber(clientId: string, assetItemId: number): Promise<number> {
        const latest = await this.fixedAssetUnitRepo.findOne({
            where: { client_id: clientId, asset_item_id: assetItemId },
            order: { unit_number: 'DESC' },
        });
        return (latest?.unit_number ?? 0) + 1;
    }

    private buildFixedAssetTagNo(assetItemNo: string, unitNumber: number) {
        return `${assetItemNo}-${String(unitNumber).padStart(3, '0')}`;
    }

    private async ensureAssetInventoryItem(clientId: string, inventoryItemId?: number | null) {
        if (!inventoryItemId) {
            return null;
        }
        const item = await this.inventoryItemRepo.findOne({
            where: { id: inventoryItemId, client_id: clientId, item_is_active: true },
            relations: ['subType', 'subType.inventoryType', 'subType.inventoryType.inventoryClass'],
        });
        if (!item) {
            throw new NotFoundException('Linked inventory item not found');
        }
        if ((item.item_tag ?? '').trim().toLowerCase() !== 'asset') {
            throw new BadRequestException('Only inventory items tagged as Asset can be linked to the asset register.');
        }
        return item;
    }

    private calculateElapsedMonths(startDate?: string | null, endDate?: string | null): number {
        if (!startDate || !endDate) {
            return 0;
        }
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
            return 0;
        }
        let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (end.getDate() >= start.getDate()) {
            months += 1;
        }
        return Math.max(0, months);
    }

    private buildFixedAssetSchedule(
        item: AccountingFixedAssetItem,
        unit: AccountingFixedAssetUnit,
        asOfDate?: string | null,
    ) {
        const effectiveAsOf = asOfDate ?? unit.disposal_date ?? this.formatBusinessDate(new Date());
        const purchasePrice = this.roundMoney(unit.purchase_price);
        const salvageValue = this.roundMoney(item.salvage_value);
        const depreciableBase = this.roundMoney(Math.max(0, purchasePrice - salvageValue));
        const configuredAnnualRate = unit.annual_depreciation_rate != null
            ? Number(unit.annual_depreciation_rate)
            : null;
        const usefulLifeMonths = configuredAnnualRate && configuredAnnualRate > 0
            ? Math.max(1, Math.round(1200 / configuredAnnualRate))
            : Math.max(1, Number(item.useful_life_months || 1));
        const monthlyDepreciation = configuredAnnualRate && configuredAnnualRate > 0
            ? this.roundMoney((purchasePrice * configuredAnnualRate) / 100 / 12)
            : this.roundMoney(depreciableBase / usefulLifeMonths);
        const elapsedMonths = Math.min(
            usefulLifeMonths,
            this.calculateElapsedMonths(unit.capitalization_date, unit.disposal_date ?? effectiveAsOf),
        );
        const accumulatedDepreciation = this.roundMoney(
            Math.min(depreciableBase, monthlyDepreciation * elapsedMonths),
        );
        const bookValue = this.roundMoney(Math.max(0, purchasePrice - accumulatedDepreciation));
        return {
            depreciation_method: item.depreciation_method ?? FixedAssetDepreciationMethod.STRAIGHT_LINE,
            annual_depreciation_rate: configuredAnnualRate,
            useful_life_months: usefulLifeMonths,
            salvage_value: salvageValue,
            purchase_price: purchasePrice,
            depreciable_base: depreciableBase,
            monthly_depreciation: monthlyDepreciation,
            elapsed_months: elapsedMonths,
            accumulated_depreciation: accumulatedDepreciation,
            book_value: bookValue,
            as_of_date: effectiveAsOf,
            is_fully_depreciated: accumulatedDepreciation >= depreciableBase - 0.01,
        };
    }

    private async appendFixedAssetMovement(
        payload: Partial<AccountingFixedAssetMovement>,
        user?: JwtPayload,
    ) {
        return this.fixedAssetMovementRepo.save(
            this.fixedAssetMovementRepo.create({
                ...payload,
                created_by: payload.created_by ?? resolveActorId(user) ?? null,
                created_by_name: payload.created_by_name ?? this.resolveActorName(user) ?? null,
            }),
        );
    }

    private async ensureFixedAssetUnitAvailable(clientId: string, id: number) {
        const unit = await this.fixedAssetUnitRepo.findOne({
            where: { id, client_id: clientId },
            relations: ['asset_item', 'asset_item.inventory_item', 'asset_item.inventory_item.subType', 'asset_item.inventory_item.subType.inventoryType', 'asset_item.inventory_item.subType.inventoryType.inventoryClass', 'branch', 'treasury_account'],
        });
        if (!unit) {
            throw new NotFoundException('Asset unit not found');
        }
        return unit;
    }

    private async validateAssetTreasuryAccount(
        clientId: string,
        branchId: number,
        treasuryAccountId?: number | null,
        mode?: FixedAssetCapitalizationMode | FixedAssetDisposalMethod | null,
    ) {
        if (!treasuryAccountId) {
            return null;
        }
        const account = await this.coaRepo.findOne({
            where: { id: treasuryAccountId, client_id: clientId },
        });
        if (!account) {
            throw new BadRequestException('Selected treasury account was not found.');
        }
        if (account.scope === AccountScope.BRANCH && account.branch_id && account.branch_id !== branchId) {
            throw new BadRequestException('Selected treasury account does not belong to the selected branch.');
        }
        if (mode === FixedAssetCapitalizationMode.CASH && !account.is_cash_account) {
            throw new BadRequestException('Cash capitalization requires a cash treasury account.');
        }
        if (mode === FixedAssetCapitalizationMode.BANK && !account.is_bank_account) {
            throw new BadRequestException('Bank capitalization requires a bank treasury account.');
        }
        if ((mode === FixedAssetDisposalMethod.SOLD || mode === FixedAssetDisposalMethod.AUCTIONED) && !account.is_cash_account && !account.is_bank_account) {
            throw new BadRequestException('Asset recovery must be posted to a cash or bank treasury account.');
        }
        return account;
    }

    async getFixedAssetRegister(clientId: string, branchId?: number, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);
        this.assertAccessibleBranch(branchId, accessibleBranchIds, 'view fixed assets for this branch');

        const whereUnits = {
            client_id: clientId,
            ...(branchId ? { branch_id: branchId } : {}),
        };
        const [items, units, movementRows] = await Promise.all([
            this.fixedAssetItemRepo.find({
                where: { client_id: clientId },
                relations: ['inventory_item', 'inventory_item.subType', 'inventory_item.subType.inventoryType', 'inventory_item.subType.inventoryType.inventoryClass'],
                order: { asset_item_no: 'ASC' },
            }),
            this.fixedAssetUnitRepo.find({
                where: whereUnits,
                relations: ['asset_item', 'branch', 'treasury_account'],
                order: { updated_at: 'DESC', id: 'DESC' },
            }),
            this.fixedAssetMovementRepo.find({
                where: { client_id: clientId },
                relations: ['asset_unit', 'asset_unit.asset_item', 'from_branch', 'to_branch'],
                order: { movement_date: 'DESC', id: 'DESC' },
                take: 200,
            }),
        ]);
        const scopedUnits = !branchId && accessibleBranchIds?.length
            ? units.filter((unit) => accessibleBranchIds.includes(unit.branch_id))
            : units;
        const movements = branchId
            ? movementRows.filter((movement) => movement.from_branch_id === branchId || movement.to_branch_id === branchId)
            : accessibleBranchIds?.length
                ? movementRows.filter((movement) =>
                    (movement.from_branch_id ? accessibleBranchIds.includes(movement.from_branch_id) : false)
                    || (movement.to_branch_id ? accessibleBranchIds.includes(movement.to_branch_id) : false),
                )
            : movementRows;

        const itemMap = new Map<number, any>();
        for (const item of items) {
            itemMap.set(item.id, {
                id: item.id,
                asset_item_no: item.asset_item_no,
                inventory_item_id: item.inventory_item_id,
                inventory_item_name: item.inventory_item?.item_name ?? null,
                inventory_item_sku: item.inventory_item?.item_sku ?? null,
                classification: item.inventory_item?.subType?.inventoryType?.inventoryClass?.class_name ?? null,
                name: item.name,
                brand: item.brand,
                category: item.category,
                sub_category: item.sub_category,
                base_unit: item.inventory_item?.uom_base ?? null,
                depreciation_method: item.depreciation_method,
                useful_life_months: item.useful_life_months,
                salvage_value: this.roundMoney(item.salvage_value),
                notes: item.notes,
                created_at: item.created_at,
                units: [],
            });
        }

        const serializedUnits = scopedUnits.map((unit) => {
            const schedule = this.buildFixedAssetSchedule(unit.asset_item, unit);
            const serialized = {
                id: unit.id,
                asset_item_id: unit.asset_item_id,
                asset_item_no: unit.asset_item?.asset_item_no ?? null,
                unit_number: unit.unit_number,
                tag_no: unit.tag_no,
                serial_no: unit.serial_no,
                model: unit.model,
                manufacturer: unit.manufacturer,
                description: unit.description,
                purchase_price: this.roundMoney(unit.purchase_price),
                annual_depreciation_rate: unit.annual_depreciation_rate != null ? Number(unit.annual_depreciation_rate) : null,
                purchase_condition: unit.purchase_condition,
                capitalization_date: unit.capitalization_date,
                purchase_order_no: unit.purchase_order_no,
                invoice_no: unit.invoice_no,
                supplier_name: unit.supplier_name,
                capitalization_mode: unit.capitalization_mode,
                treasury_account_id: unit.treasury_account_id,
                treasury_account_name: unit.treasury_account?.account_name ?? null,
                branch_id: unit.branch_id,
                branch_name: unit.branch?.branch_name ?? null,
                physical_location: unit.physical_location,
                issued_to: unit.issued_to,
                custodian_id: unit.custodian_id,
                issued_date: unit.issued_date,
                expected_return: unit.expected_return,
                condition: unit.condition,
                operational_status: unit.operational_status,
                warranty_expiry: unit.warranty_expiry,
                last_service_date: unit.last_service_date,
                next_service_due: unit.next_service_due,
                insurance_expiry: unit.insurance_expiry,
                disposal_no: unit.disposal_no,
                disposal_method: unit.disposal_method,
                disposal_date: unit.disposal_date,
                disposal_amount: this.roundMoney(unit.disposal_amount),
                disposal_recipient: unit.disposal_recipient,
                disposal_note: unit.disposal_note,
                disposal_approved_by: unit.disposal_approved_by,
                disposal_reason_code: unit.disposal_reason_code,
                comments: unit.comments,
                capitalization_journal_entry_id: unit.capitalization_journal_entry_id,
                disposal_journal_entry_id: unit.disposal_journal_entry_id,
                depreciation_schedule: schedule,
                created_at: unit.created_at,
                updated_at: unit.updated_at,
            };
            itemMap.get(unit.asset_item_id)?.units.push(serialized);
            return serialized;
        });

        const summary = {
            item_count: items.length,
            unit_count: serializedUnits.length,
            in_store_count: serializedUnits.filter((unit) => unit.operational_status === FixedAssetOperationalStatus.IN_STORE).length,
            assigned_count: serializedUnits.filter((unit) => unit.operational_status === FixedAssetOperationalStatus.ASSIGNED).length,
            disposed_count: serializedUnits.filter((unit) => unit.operational_status === FixedAssetOperationalStatus.DISPOSED).length,
            gross_cost: this.roundMoney(serializedUnits.reduce((sum, unit) => sum + unit.purchase_price, 0)),
            net_book_value: this.roundMoney(serializedUnits.reduce((sum, unit) => sum + unit.depreciation_schedule.book_value, 0)),
        };

        return {
            summary,
            items: Array.from(itemMap.values()),
            units: serializedUnits,
            movements: movements.map((movement) => ({
                id: movement.id,
                asset_unit_id: movement.asset_unit_id,
                asset_tag_no: movement.asset_unit?.tag_no ?? null,
                asset_name: movement.asset_unit?.asset_item?.name ?? null,
                movement_type: movement.movement_type,
                movement_date: movement.movement_date,
                from_branch_id: movement.from_branch_id,
                from_branch_name: movement.from_branch?.branch_name ?? null,
                to_branch_id: movement.to_branch_id,
                to_branch_name: movement.to_branch?.branch_name ?? null,
                from_location: movement.from_location,
                to_location: movement.to_location,
                from_custodian: movement.from_custodian,
                to_custodian: movement.to_custodian,
                reference_no: movement.reference_no,
                authorized_by: movement.authorized_by,
                received_by: movement.received_by,
                vehicle_no: movement.vehicle_no,
                gate_pass_no: movement.gate_pass_no,
                notes: movement.notes,
                journal_entry_id: movement.journal_entry_id,
                created_at: movement.created_at,
            })),
        };
    }

    async createFixedAssetItem(clientId: string, dto: CreateFixedAssetItemDto, user?: JwtPayload) {
        const inventoryItem = await this.ensureAssetInventoryItem(clientId, dto.inventory_item_id ?? null);
        const item = this.fixedAssetItemRepo.create({
            client_id: clientId,
            asset_item_no: await this.generateFixedAssetItemNo(clientId),
            inventory_item_id: inventoryItem?.id ?? null,
            name: inventoryItem?.item_name ?? dto.name.trim(),
            brand: dto.brand?.trim() || null,
            category: inventoryItem?.subType?.inventoryType?.type_name ?? dto.category.trim(),
            sub_category: inventoryItem?.subType?.sub_type_name ?? (dto.sub_category?.trim() || null),
            depreciation_method: dto.depreciation_method ?? FixedAssetDepreciationMethod.STRAIGHT_LINE,
            useful_life_months: dto.useful_life_months,
            salvage_value: this.roundMoney(dto.salvage_value ?? 0),
            notes: dto.notes?.trim() || null,
            created_by: resolveActorId(user) ?? null,
            created_by_name: this.resolveActorName(user) ?? null,
        });
        return this.fixedAssetItemRepo.save(item);
    }

    async updateFixedAssetItem(clientId: string, id: number, dto: UpdateFixedAssetItemDto) {
        const item = await this.fixedAssetItemRepo.findOne({ where: { id, client_id: clientId } });
        if (!item) {
            throw new NotFoundException('Asset item not found');
        }
        const inventoryItem = dto.inventory_item_id !== undefined
            ? await this.ensureAssetInventoryItem(clientId, dto.inventory_item_id ?? null)
            : null;
        if (dto.inventory_item_id !== undefined) {
            item.inventory_item_id = inventoryItem?.id ?? null;
            if (inventoryItem) {
                item.name = inventoryItem.item_name;
                item.category = inventoryItem.subType?.inventoryType?.type_name ?? item.category;
                item.sub_category = inventoryItem.subType?.sub_type_name ?? item.sub_category;
            }
        }
        if (dto.name !== undefined && !inventoryItem) item.name = dto.name.trim();
        if (dto.brand !== undefined) item.brand = dto.brand?.trim() || null;
        if (dto.category !== undefined && !inventoryItem) item.category = dto.category.trim();
        if (dto.sub_category !== undefined && !inventoryItem) item.sub_category = dto.sub_category?.trim() || null;
        if (dto.depreciation_method !== undefined) item.depreciation_method = dto.depreciation_method;
        if (dto.useful_life_months !== undefined) item.useful_life_months = dto.useful_life_months;
        if (dto.salvage_value !== undefined) item.salvage_value = this.roundMoney(dto.salvage_value);
        if (dto.notes !== undefined) item.notes = dto.notes?.trim() || null;
        return this.fixedAssetItemRepo.save(item);
    }

    async createFixedAssetUnit(clientId: string, dto: CreateFixedAssetUnitDto, user?: JwtPayload, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'capitalise fixed assets');
        this.assertAccessibleBranch(dto.branch_id, accessibleBranchIds, 'capitalise fixed assets for this branch');

        const assetItem = await this.fixedAssetItemRepo.findOne({
            where: { id: dto.asset_item_id, client_id: clientId },
        });
        if (!assetItem) {
            throw new NotFoundException('Asset item not found');
        }

        const treasuryAccount = await this.validateAssetTreasuryAccount(
            clientId,
            dto.branch_id,
            dto.treasury_account_id ?? null,
            dto.capitalization_mode,
        );
        if (dto.capitalization_mode !== FixedAssetCapitalizationMode.CREDIT_PURCHASE && !treasuryAccount) {
            throw new BadRequestException('Paid asset capitalization requires a treasury account.');
        }

        const fixedAssetAccount = await this.ensureDefaultAccount(clientId, '1500', 'Fixed Assets', 'asset');
        const accountsPayable = await this.ensureDefaultAccount(clientId, '2100', 'Accounts Payable', 'liability');
        const transactionDate = new Date(`${dto.capitalization_date}T00:00:00`);
        const unitNumber = await this.generateFixedAssetUnitNumber(clientId, dto.asset_item_id);
        const generatedTagNo = dto.tag_no?.trim() || this.buildFixedAssetTagNo(assetItem.asset_item_no, unitNumber);
        const existingTag = await this.fixedAssetUnitRepo.findOne({
            where: { client_id: clientId, tag_no: generatedTagNo },
        });
        if (existingTag) {
            throw new BadRequestException(`Asset number ${generatedTagNo} already exists.`);
        }

        const capitalizationJournal = await this.createJournalEntry(
            clientId,
            dto.branch_id,
            {
                branch_id: dto.branch_id,
                transaction_date: transactionDate,
                business_date: dto.capitalization_date,
                description: `Fixed asset capitalization: ${assetItem.name} ${generatedTagNo}`,
                reference_id: dto.invoice_no?.trim() || generatedTagNo,
                source_module: 'fixed_asset',
                source_entity_type: 'asset_unit',
                source_entity_id: generatedTagNo,
                source_event: 'capitalization',
                posting_type: 'auto',
                items: [
                    { account_id: fixedAssetAccount.id, debit: this.roundMoney(dto.purchase_price), credit: 0 },
                    {
                        account_id: dto.capitalization_mode === FixedAssetCapitalizationMode.CREDIT_PURCHASE
                            ? accountsPayable.id
                            : treasuryAccount!.id,
                        debit: 0,
                        credit: this.roundMoney(dto.purchase_price),
                    },
                ],
            },
            user,
        );

        const unit = await this.fixedAssetUnitRepo.save(
            this.fixedAssetUnitRepo.create({
                client_id: clientId,
                asset_item_id: dto.asset_item_id,
                unit_number: unitNumber,
                branch_id: dto.branch_id,
                model: dto.model?.trim() || null,
                manufacturer: dto.manufacturer?.trim() || null,
                description: dto.description?.trim() || null,
                serial_no: dto.serial_no?.trim() || null,
                tag_no: generatedTagNo,
                purchase_price: this.roundMoney(dto.purchase_price),
                annual_depreciation_rate: dto.annual_depreciation_rate != null ? this.roundMoney(dto.annual_depreciation_rate) : null,
                purchase_condition: dto.purchase_condition ?? FixedAssetPurchaseCondition.NEW,
                capitalization_date: dto.capitalization_date,
                purchase_order_no: dto.purchase_order_no?.trim() || null,
                invoice_no: dto.invoice_no?.trim() || null,
                supplier_name: dto.supplier_name?.trim() || null,
                capitalization_mode: dto.capitalization_mode,
                treasury_account_id: treasuryAccount?.id ?? null,
                physical_location: dto.physical_location?.trim() || null,
                issued_to: dto.issued_to?.trim() || null,
                custodian_id: dto.custodian_id?.trim() || null,
                condition: dto.condition ?? FixedAssetCondition.WORKING,
                operational_status: dto.operational_status ?? FixedAssetOperationalStatus.IN_STORE,
                warranty_expiry: dto.warranty_expiry ?? null,
                last_service_date: dto.last_service_date ?? null,
                next_service_due: dto.next_service_due ?? null,
                insurance_expiry: dto.insurance_expiry ?? null,
                comments: dto.comments?.trim() || null,
                capitalization_journal_entry_id: capitalizationJournal.id,
                created_by: resolveActorId(user) ?? null,
                created_by_name: this.resolveActorName(user) ?? null,
            }),
        );

        await this.appendFixedAssetMovement({
            client_id: clientId,
            asset_unit_id: unit.id,
            movement_type: FixedAssetMovementType.ACQUISITION,
            movement_date: dto.capitalization_date,
            to_branch_id: dto.branch_id,
            to_location: dto.physical_location?.trim() || null,
            to_custodian: dto.issued_to?.trim() || null,
            reference_no: dto.invoice_no?.trim() || generatedTagNo,
            notes: dto.comments?.trim() || null,
            journal_entry_id: capitalizationJournal.id,
        }, user);

        return this.ensureFixedAssetUnitAvailable(clientId, unit.id);
    }

    async updateFixedAssetUnit(clientId: string, id: number, dto: UpdateFixedAssetUnitDto, accessibleBranchIds?: number[]) {
        const unit = await this.ensureFixedAssetUnitAvailable(clientId, id);
        this.assertAccessibleBranch(unit.branch_id, accessibleBranchIds, 'update this fixed asset');
        if (dto.tag_no && dto.tag_no.trim() !== unit.tag_no) {
            const existingTag = await this.fixedAssetUnitRepo.findOne({
                where: { client_id: clientId, tag_no: dto.tag_no.trim() },
            });
            if (existingTag && existingTag.id !== id) {
                throw new BadRequestException(`Asset tag ${dto.tag_no.trim()} already exists.`);
            }
            unit.tag_no = dto.tag_no.trim();
        }
        if (dto.branch_id !== undefined) {
            await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'update fixed assets');
            this.assertAccessibleBranch(dto.branch_id, accessibleBranchIds, 'move this fixed asset to the selected branch');
            unit.branch_id = dto.branch_id;
        }
        if (dto.model !== undefined) unit.model = dto.model?.trim() || null;
        if (dto.manufacturer !== undefined) unit.manufacturer = dto.manufacturer?.trim() || null;
        if (dto.description !== undefined) unit.description = dto.description?.trim() || null;
        if (dto.serial_no !== undefined) unit.serial_no = dto.serial_no?.trim() || null;
        if (dto.annual_depreciation_rate !== undefined) {
            unit.annual_depreciation_rate = dto.annual_depreciation_rate != null
                ? this.roundMoney(dto.annual_depreciation_rate)
                : null;
        }
        if (dto.physical_location !== undefined) unit.physical_location = dto.physical_location?.trim() || null;
        if (dto.issued_to !== undefined) unit.issued_to = dto.issued_to?.trim() || null;
        if (dto.custodian_id !== undefined) unit.custodian_id = dto.custodian_id?.trim() || null;
        if (dto.condition !== undefined) unit.condition = dto.condition;
        if (dto.operational_status !== undefined) unit.operational_status = dto.operational_status;
        if (dto.warranty_expiry !== undefined) unit.warranty_expiry = dto.warranty_expiry ?? null;
        if (dto.last_service_date !== undefined) unit.last_service_date = dto.last_service_date ?? null;
        if (dto.next_service_due !== undefined) unit.next_service_due = dto.next_service_due ?? null;
        if (dto.insurance_expiry !== undefined) unit.insurance_expiry = dto.insurance_expiry ?? null;
        if (dto.comments !== undefined) unit.comments = dto.comments?.trim() || null;
        await this.fixedAssetUnitRepo.save(unit);
        return this.ensureFixedAssetUnitAvailable(clientId, id);
    }

    async issueFixedAssetUnit(clientId: string, id: number, dto: IssueFixedAssetUnitDto, user?: JwtPayload, accessibleBranchIds?: number[]) {
        const unit = await this.ensureFixedAssetUnitAvailable(clientId, id);
        this.assertAccessibleBranch(unit.branch_id, accessibleBranchIds, 'issue this fixed asset');
        if (unit.operational_status !== FixedAssetOperationalStatus.IN_STORE) {
            throw new BadRequestException('Only in-store asset units can be issued.');
        }
        if (dto.branch_id && dto.branch_id !== unit.branch_id) {
            throw new BadRequestException('Issue branch must match the current asset branch.');
        }
        const fromLocation = unit.physical_location;
        unit.operational_status = FixedAssetOperationalStatus.ASSIGNED;
        unit.issued_to = dto.issue_to.trim();
        unit.custodian_id = dto.custodian_id?.trim() || null;
        unit.physical_location = dto.location.trim();
        unit.issued_date = dto.issue_date;
        unit.expected_return = dto.expected_return ?? null;
        unit.condition = dto.handover_condition;
        unit.comments = dto.comments?.trim() || unit.comments;
        await this.fixedAssetUnitRepo.save(unit);
        await this.appendFixedAssetMovement({
            client_id: clientId,
            asset_unit_id: unit.id,
            movement_type: FixedAssetMovementType.ISSUE,
            movement_date: dto.issue_date,
            from_branch_id: unit.branch_id,
            to_branch_id: unit.branch_id,
            from_location: fromLocation,
            to_location: dto.location.trim(),
            to_custodian: dto.issue_to.trim(),
            notes: dto.comments?.trim() || null,
        }, user);
        return this.ensureFixedAssetUnitAvailable(clientId, id);
    }

    async returnFixedAssetUnit(clientId: string, id: number, dto: ReturnFixedAssetUnitDto, user?: JwtPayload, accessibleBranchIds?: number[]) {
        const unit = await this.ensureFixedAssetUnitAvailable(clientId, id);
        this.assertAccessibleBranch(unit.branch_id, accessibleBranchIds, 'return this fixed asset');
        if (unit.operational_status !== FixedAssetOperationalStatus.ASSIGNED) {
            throw new BadRequestException('Only assigned asset units can be returned.');
        }
        const previousLocation = unit.physical_location;
        const previousCustodian = unit.issued_to;
        unit.operational_status = FixedAssetOperationalStatus.IN_STORE;
        unit.issued_to = null;
        unit.custodian_id = null;
        unit.issued_date = null;
        unit.expected_return = null;
        unit.condition = dto.return_condition;
        unit.physical_location = dto.location?.trim() || previousLocation || 'Branch Store';
        unit.comments = [dto.incident_report?.trim(), dto.comments?.trim()].filter(Boolean).join(' | ') || unit.comments;
        await this.fixedAssetUnitRepo.save(unit);
        await this.appendFixedAssetMovement({
            client_id: clientId,
            asset_unit_id: unit.id,
            movement_type: FixedAssetMovementType.RETURN,
            movement_date: dto.return_date,
            from_branch_id: unit.branch_id,
            to_branch_id: unit.branch_id,
            from_location: previousLocation,
            to_location: unit.physical_location,
            from_custodian: previousCustodian,
            notes: [dto.incident_report?.trim(), dto.comments?.trim()].filter(Boolean).join(' | ') || null,
        }, user);
        return this.ensureFixedAssetUnitAvailable(clientId, id);
    }

    async transferFixedAssetUnit(clientId: string, id: number, dto: TransferFixedAssetUnitDto, user?: JwtPayload, accessibleBranchIds?: number[]) {
        const unit = await this.ensureFixedAssetUnitAvailable(clientId, id);
        this.assertAccessibleBranch(unit.branch_id, accessibleBranchIds, 'transfer this fixed asset');
        if (unit.operational_status !== FixedAssetOperationalStatus.IN_STORE) {
            throw new BadRequestException('Only in-store asset units can be transferred.');
        }
        if (unit.branch_id === dto.to_branch_id) {
            throw new BadRequestException('Destination branch must be different from the current branch.');
        }
        await this.assertBranchBelongsToClient(clientId, dto.to_branch_id, 'transfer fixed assets');
        this.assertAccessibleBranch(dto.to_branch_id, accessibleBranchIds, 'transfer fixed assets to the selected branch');
        const fromBranchId = unit.branch_id;
        const fromLocation = unit.physical_location;
        unit.branch_id = dto.to_branch_id;
        unit.physical_location = dto.destination_location?.trim() || unit.physical_location;
        await this.fixedAssetUnitRepo.save(unit);
        await this.appendFixedAssetMovement({
            client_id: clientId,
            asset_unit_id: unit.id,
            movement_type: FixedAssetMovementType.TRANSFER,
            movement_date: dto.transfer_date,
            from_branch_id: fromBranchId,
            to_branch_id: dto.to_branch_id,
            from_location: fromLocation,
            to_location: unit.physical_location,
            authorized_by: dto.authorized_by.trim(),
            received_by: dto.received_by.trim(),
            vehicle_no: dto.vehicle_no?.trim() || null,
            gate_pass_no: dto.gate_pass_no?.trim() || null,
            notes: dto.notes?.trim() || null,
        }, user);
        return this.ensureFixedAssetUnitAvailable(clientId, id);
    }

    async disposeFixedAssetUnit(clientId: string, id: number, dto: DisposeFixedAssetUnitDto, user?: JwtPayload, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        const unit = await this.ensureFixedAssetUnitAvailable(clientId, id);
        this.assertAccessibleBranch(unit.branch_id, accessibleBranchIds, 'dispose this fixed asset');
        if (unit.operational_status === FixedAssetOperationalStatus.DISPOSED) {
            throw new BadRequestException('This asset unit has already been disposed.');
        }
        if (unit.operational_status === FixedAssetOperationalStatus.ASSIGNED) {
            throw new BadRequestException('Return the asset before disposal.');
        }
        if (unit.branch_id !== dto.branch_id) {
            throw new BadRequestException('Disposal branch must match the current asset branch.');
        }
        const treasuryAccount = await this.validateAssetTreasuryAccount(
            clientId,
            dto.branch_id,
            dto.treasury_account_id ?? null,
            dto.method,
        );
        const recoveryAmount = this.roundMoney(dto.salvage_value ?? 0);
        if ((dto.method === FixedAssetDisposalMethod.SOLD || dto.method === FixedAssetDisposalMethod.AUCTIONED) && recoveryAmount > 0 && !treasuryAccount) {
            throw new BadRequestException('Cash or bank recovery requires a treasury account.');
        }

        const fixedAssetAccount = await this.ensureDefaultAccount(clientId, '1500', 'Fixed Assets', 'asset');
        const accumulatedDepAccount = await this.ensureDefaultAccount(clientId, '1590', 'Accumulated Depreciation', 'asset');
        const gainAccount = await this.ensureDefaultAccount(clientId, '4330', 'Gain on Asset Disposal', 'revenue');
        const lossAccount = await this.ensureDefaultAccount(clientId, '5620', 'Loss on Asset Disposal', 'expense');
        const schedule = this.buildFixedAssetSchedule(unit.asset_item, unit, dto.date);
        const gainOrLoss = this.roundMoney(recoveryAmount - schedule.book_value);
        const transactionDate = new Date(`${dto.date}T00:00:00`);
        const previousLocation = unit.physical_location;
        const journalItems: Array<{ account_id: number; debit: number; credit: number }> = [
            { account_id: accumulatedDepAccount.id, debit: schedule.accumulated_depreciation, credit: 0 },
        ];
        if (recoveryAmount > 0 && treasuryAccount) {
            journalItems.push({ account_id: treasuryAccount.id, debit: recoveryAmount, credit: 0 });
        }
        if (gainOrLoss < 0) {
            journalItems.push({ account_id: lossAccount.id, debit: this.roundMoney(Math.abs(gainOrLoss)), credit: 0 });
        }
        journalItems.push({ account_id: fixedAssetAccount.id, debit: 0, credit: this.roundMoney(unit.purchase_price) });
        if (gainOrLoss > 0) {
            journalItems.push({ account_id: gainAccount.id, debit: 0, credit: gainOrLoss });
        }
        const referenceNo = dto.disposal_no?.trim() || `DISP-${unit.tag_no}`;
        const journal = await this.createJournalEntry(
            clientId,
            dto.branch_id,
            {
                branch_id: dto.branch_id,
                transaction_date: transactionDate,
                business_date: dto.date,
                description: `Fixed asset disposal: ${unit.asset_item.name} ${unit.tag_no}`,
                reference_id: referenceNo,
                source_module: 'fixed_asset',
                source_entity_type: 'asset_unit',
                source_entity_id: unit.tag_no,
                source_event: 'disposal',
                posting_type: 'auto',
                items: journalItems,
            },
            user,
        );

        unit.operational_status = FixedAssetOperationalStatus.DISPOSED;
        unit.disposal_no = referenceNo;
        unit.disposal_method = dto.method;
        unit.disposal_date = dto.date;
        unit.disposal_amount = recoveryAmount;
        unit.disposal_recipient = dto.recipient_buyer?.trim() || null;
        unit.disposal_note = dto.notes?.trim() || null;
        unit.disposal_approved_by = dto.approved_by.trim();
        unit.disposal_reason_code = dto.reason_code.trim();
        unit.disposal_journal_entry_id = journal.id;
        unit.physical_location = 'Disposed';
        await this.fixedAssetUnitRepo.save(unit);

        await this.appendFixedAssetMovement({
            client_id: clientId,
            asset_unit_id: unit.id,
            movement_type: FixedAssetMovementType.DISPOSAL,
            movement_date: dto.date,
            from_branch_id: unit.branch_id,
            from_location: previousLocation,
            reference_no: referenceNo,
            authorized_by: dto.approved_by.trim(),
            notes: dto.notes?.trim() || null,
            journal_entry_id: journal.id,
        }, user);
        return this.ensureFixedAssetUnitAvailable(clientId, id);
    }

    async getPeriodLock(clientId: string, branchId?: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const lock = await this.getEffectivePeriodLock(clientId, branchId ?? null);
        return {
            branch_id: branchId ?? null,
            mode: lock?.mode ?? PeriodLockMode.NONE,
            locked_through_date: lock?.locked_through_date ?? null,
            notes: lock?.notes ?? null,
            updated_by: lock?.updated_by ?? null,
            updated_at: lock?.updated_at ?? null,
            last_reopened_by: lock?.last_reopened_by ?? null,
            last_reopened_at: lock?.last_reopened_at ?? null,
            last_reopen_reason: lock?.last_reopen_reason ?? null,
            year_end_finalized_period_key: lock?.year_end_finalized_period_key ?? null,
            year_end_finalized_by: lock?.year_end_finalized_by ?? null,
            year_end_finalized_at: lock?.year_end_finalized_at ?? null,
            year_end_close_journal_entry_id: lock?.year_end_close_journal_entry_id ?? null,
            year_end_reopened_by: lock?.year_end_reopened_by ?? null,
            year_end_reopened_at: lock?.year_end_reopened_at ?? null,
            year_end_reopen_reason: lock?.year_end_reopen_reason ?? null,
            scope: lock?.branch_id ? 'branch' : 'company',
        };
    }

    async upsertPeriodLock(
        clientId: string,
        dto: UpsertPeriodLockDto,
        user?: JwtPayload,
    ) {
        const branchId = dto.branch_id ?? null;
        await this.assertBranchBelongsToClient(clientId, branchId ?? undefined);

        let lock = branchId === null
            ? await this.periodLockRepo.createQueryBuilder('period_lock')
                .where('period_lock.client_id = :clientId', { clientId })
                .andWhere('period_lock.branch_id IS NULL')
                .orderBy('period_lock.id', 'DESC')
                .getOne()
            : await this.periodLockRepo.findOne({
                where: { client_id: clientId, branch_id: branchId },
            });
        if (!lock) {
            lock = this.periodLockRepo.create({
                client_id: clientId,
                branch_id: branchId,
            });
        }

        const priorMode = lock.mode ?? PeriodLockMode.NONE;
        const priorLockedThroughDate = lock.locked_through_date ?? null;
        const nextLockedThroughDate = dto.locked_through_date ?? null;
          const isReopenChange =
            priorMode === PeriodLockMode.HARD_LOCK
                ? dto.mode !== PeriodLockMode.HARD_LOCK || (nextLockedThroughDate !== null && priorLockedThroughDate !== null && nextLockedThroughDate < priorLockedThroughDate) || (priorLockedThroughDate !== null && nextLockedThroughDate === null)
                : priorMode === PeriodLockMode.ADMIN_OVERRIDE
                      ? dto.mode === PeriodLockMode.NONE || (nextLockedThroughDate !== null && priorLockedThroughDate !== null && nextLockedThroughDate < priorLockedThroughDate) || (priorLockedThroughDate !== null && nextLockedThroughDate === null)
                      : false;

          const yearEndFinalizedThrough = lock.year_end_finalized_period_key
              ? this.getFiscalYearRange(lock.year_end_finalized_period_key).end
              : null;
          const isLooseningPastFinalizedYearEnd = Boolean(
              yearEndFinalizedThrough
              && (
                  dto.mode !== PeriodLockMode.HARD_LOCK
                  || !nextLockedThroughDate
                  || nextLockedThroughDate < yearEndFinalizedThrough
              ),
          );
          if (isLooseningPastFinalizedYearEnd) {
              throw new BadRequestException('This branch has a finalized year-end close. Use the year-end reopen action before loosening the lock.');
          }

        if (isReopenChange && !dto.reopen_reason?.trim()) {
            throw new BadRequestException('Reopen reason is required when loosening or shortening a period lock.');
        }

        lock.mode = dto.mode;
        lock.locked_through_date = nextLockedThroughDate;
        lock.notes = dto.notes?.trim() || null;
        lock.updated_by = this.resolveActorName(user) ?? null;
        if (isReopenChange) {
            lock.last_reopened_by = this.resolveActorName(user) ?? null;
            lock.last_reopened_at = new Date();
            lock.last_reopen_reason = dto.reopen_reason?.trim() || null;
        }

        const saved = await this.periodLockRepo.save(lock);
          return {
              branch_id: saved.branch_id,
              mode: saved.mode,
              locked_through_date: saved.locked_through_date,
              notes: saved.notes,
            updated_by: saved.updated_by,
            updated_at: saved.updated_at,
              last_reopened_by: saved.last_reopened_by,
              last_reopened_at: saved.last_reopened_at,
              last_reopen_reason: saved.last_reopen_reason,
              year_end_finalized_period_key: saved.year_end_finalized_period_key,
              year_end_finalized_by: saved.year_end_finalized_by,
              year_end_finalized_at: saved.year_end_finalized_at,
              year_end_close_journal_entry_id: saved.year_end_close_journal_entry_id,
              year_end_reopened_by: saved.year_end_reopened_by,
              year_end_reopened_at: saved.year_end_reopened_at,
              year_end_reopen_reason: saved.year_end_reopen_reason,
              scope: saved.branch_id ? 'branch' : 'company',
          };
      }

    async getMonthCloseChecklist(clientId: string, branchId: number, periodKey?: string) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const effectivePeriodKey = this.resolvePeriodKey(periodKey);
        await this.ensureMonthCloseChecklistItems(clientId, branchId, effectivePeriodKey);
        await this.syncInventoryMonthCloseChecklistItem(clientId, branchId, effectivePeriodKey);
        const items = await this.closeChecklistRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                period_key: effectivePeriodKey,
            },
            order: { id: 'ASC' },
        });
        const pendingAccruals = await this.getPendingAccrualSummary(clientId, branchId, effectivePeriodKey);
        const closeAdjustmentSchedules = await this.getCloseAdjustmentScheduleSummary(clientId, branchId, effectivePeriodKey);
        const periodLock = await this.getEffectivePeriodLock(clientId, branchId);
        const yearEndRange = this.getFiscalYearRange(this.resolveYearEndPeriodKey(effectivePeriodKey));
        const readinessAsOfDate = this.isYearEndPeriod(effectivePeriodKey)
            ? yearEndRange.end
            : this.getPeriodEndDate(effectivePeriodKey);
        const financeCloseReadiness = await this.getFinanceCloseReadiness(
            clientId,
            readinessAsOfDate,
            branchId,
        );
        const summary = this.summarizeMonthCloseChecklist(items);

        return {
            branch_id: branchId,
            period_key: effectivePeriodKey,
            year_end_governance: this.buildYearEndGovernance(
                effectivePeriodKey,
                { summary },
                financeCloseReadiness,
                periodLock,
            ),
            finance_close_readiness: financeCloseReadiness,
            summary,
            pending_accruals: pendingAccruals,
            close_adjustment_schedules: closeAdjustmentSchedules,
            items: items.map((item) => ({
                id: item.id,
                item_key: item.item_key,
                item_label: item.item_label,
                status: item.status,
                notes: item.notes,
                completed_by: item.completed_by,
                completed_at: item.completed_at,
                updated_at: item.updated_at,
            })),
        };
    }

    async upsertMonthCloseChecklistItem(
        clientId: string,
        dto: {
            branch_id: number;
            period_key: string;
            item_key: string;
            status: AccountingCloseChecklistStatus;
            notes?: string | null;
        },
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'update month-close checklist');
        const periodKey = this.resolvePeriodKey(dto.period_key);
        if (dto.item_key === 'inventory_blind_verification') {
            throw new BadRequestException('Monthly blind inventory verification is system-managed and updates from the blind count workflow.');
        }
        const items = await this.ensureMonthCloseChecklistItems(clientId, dto.branch_id, periodKey);
        const item = items.find((candidate) => candidate.item_key === dto.item_key);
        if (!item) {
            throw new NotFoundException(`Checklist item ${dto.item_key} not found.`);
        }

        item.status = dto.status;
        item.notes = dto.notes?.trim() || null;
        if (dto.status === AccountingCloseChecklistStatus.COMPLETED) {
            item.completed_by = this.resolveActorName(user);
            item.completed_at = new Date();
        } else {
            item.completed_by = dto.status === AccountingCloseChecklistStatus.BLOCKED ? this.resolveActorName(user) : null;
            item.completed_at = dto.status === AccountingCloseChecklistStatus.BLOCKED ? null : null;
        }

        await this.closeChecklistRepo.save(item);
        return this.getMonthCloseChecklist(clientId, dto.branch_id, periodKey);
    }

    async finalizeYearEnd(
        clientId: string,
        dto: {
            branch_id: number;
            period_key?: string;
            note?: string | null;
        },
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'finalize year-end close');
        const periodKey = this.resolvePeriodKey(dto.period_key);
        if (!this.isYearEndPeriod(periodKey)) {
            throw new BadRequestException('Year-end finalization is only available for the fiscal year ending period.');
        }

        const checklist = await this.getMonthCloseChecklist(clientId, dto.branch_id, periodKey);
        const yearEndRange = this.getFiscalYearRange(periodKey);
        const yearEndPostingDate = this.addDays(yearEndRange.end, 1);
        const financeCloseReadiness = await this.getFinanceCloseReadiness(clientId, yearEndRange.end, dto.branch_id);
        if (Number(checklist.summary?.pending_count ?? 0) > 0 || Number(checklist.summary?.blocked_count ?? 0) > 0) {
            throw new BadRequestException('Complete the month-close and year-end checklist items before finalizing year-end.');
        }
        if (financeCloseReadiness?.status !== 'ready') {
            throw new BadRequestException(financeCloseReadiness?.top_issue || 'Resolve finance close blockers before finalizing year-end.');
        }

        const existingLock = await this.getEffectivePeriodLock(clientId, dto.branch_id);
        const isAlreadyFinalized = Boolean(
            existingLock?.year_end_finalized_period_key === periodKey
            && existingLock?.year_end_finalized_at
            && (
                !existingLock.year_end_reopened_at
                || existingLock.year_end_reopened_at < existingLock.year_end_finalized_at
            ),
        );
        if (isAlreadyFinalized) {
            throw new BadRequestException(`Year-end ${periodKey} is already finalized for this branch.`);
        }

        await this.ensureBaseChart(clientId);
        const retainedEarningsAccount = await this.ensureDefaultAccount(clientId, '3200', 'Retained Earnings', 'equity');
        const balanceRows = await this.dataSource.query(
            `
            SELECT
              coa.id AS account_id,
              coa.account_code,
              coa.account_name,
              coa.account_type,
              COALESCE(SUM(item.debit), 0) AS total_debit,
              COALESCE(SUM(item.credit), 0) AS total_credit
            FROM accounting_journal_items item
            INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
            INNER JOIN accounting_coa coa ON coa.id = item.account_id
            WHERE entry.client_id = ?
              AND entry.branch_id = ?
              AND entry.business_date >= ?
              AND entry.business_date <= ?
              AND coa.account_type IN ('revenue', 'expense')
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_code ASC
            `,
            [clientId, dto.branch_id, yearEndRange.start, yearEndRange.end],
        );

        const journalItems: CreateJournalEntryDto['items'] = [];
        let totalRevenueBalance = 0;
        let totalExpenseBalance = 0;
        for (const row of balanceRows) {
            const totalDebit = this.roundMoney(row.total_debit);
            const totalCredit = this.roundMoney(row.total_credit);
            if (row.account_type === AccountType.REVENUE) {
                const balance = this.roundMoney(totalCredit - totalDebit);
                if (balance > 0.009) {
                    journalItems.push({ account_id: Number(row.account_id), debit: balance, credit: 0 });
                    totalRevenueBalance += balance;
                }
            } else if (row.account_type === AccountType.EXPENSE) {
                const balance = this.roundMoney(totalDebit - totalCredit);
                if (balance > 0.009) {
                    journalItems.push({ account_id: Number(row.account_id), debit: 0, credit: balance });
                    totalExpenseBalance += balance;
                }
            }
        }

        const netResult = this.roundMoney(totalRevenueBalance - totalExpenseBalance);
        if (netResult > 0.009) {
            journalItems.push({ account_id: retainedEarningsAccount.id, debit: 0, credit: netResult });
        } else if (netResult < -0.009) {
            journalItems.push({ account_id: retainedEarningsAccount.id, debit: this.roundMoney(Math.abs(netResult)), credit: 0 });
        }

        let yearEndCloseJournal: JournalEntry | null = null;
        if (journalItems.length > 0) {
            yearEndCloseJournal = await this.createJournalEntry(
                clientId,
                dto.branch_id,
                {
                    branch_id: dto.branch_id,
                    transaction_date: new Date(`${yearEndPostingDate}T12:00:00`),
                    business_date: yearEndPostingDate,
                    description: `Year-end close transfer for ${periodKey}${dto.note?.trim() ? ` - ${dto.note.trim()}` : ''}`,
                    reference_id: `YE-${periodKey}-${dto.branch_id}`,
                    source_module: 'accounting',
                    source_entity_type: 'year_end',
                    source_entity_id: `${this.buildYearEndSourceId(dto.branch_id, periodKey)}:${Date.now()}`,
                    source_event: 'year_end_close',
                    posting_type: 'closing',
                    items: journalItems,
                },
                user,
            );
        }

        let lock = await this.periodLockRepo.findOne({
            where: { client_id: clientId, branch_id: dto.branch_id },
        });
        if (!lock) {
            lock = this.periodLockRepo.create({
                client_id: clientId,
                branch_id: dto.branch_id,
            });
        }
        lock.mode = PeriodLockMode.HARD_LOCK;
        lock.locked_through_date = yearEndRange.end;
        lock.notes = dto.note?.trim() || lock.notes || `Year-end ${periodKey} finalized.`;
        lock.updated_by = this.resolveActorName(user) ?? null;
        lock.year_end_finalized_period_key = periodKey;
        lock.year_end_finalized_by = this.resolveActorName(user) ?? null;
        lock.year_end_finalized_at = new Date();
        lock.year_end_close_journal_entry_id = yearEndCloseJournal?.id ?? null;
        lock.year_end_reopened_by = null;
        lock.year_end_reopened_at = null;
        lock.year_end_reopen_reason = null;
        await this.periodLockRepo.save(lock);

        return this.getMonthCloseChecklist(clientId, dto.branch_id, periodKey);
    }

    async reopenYearEnd(
        clientId: string,
        dto: {
            branch_id: number;
            period_key?: string;
            reason: string;
        },
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'reopen year-end close');
        const periodKey = this.resolvePeriodKey(dto.period_key);
        if (!this.isYearEndPeriod(periodKey)) {
            throw new BadRequestException('Year-end reopen is only available for the fiscal year ending period.');
        }
        if (!dto.reason?.trim()) {
            throw new BadRequestException('Reopen reason is required for year-end reopen.');
        }

        const lock = await this.periodLockRepo.findOne({
            where: { client_id: clientId, branch_id: dto.branch_id },
        });
        if (!lock || lock.year_end_finalized_period_key !== periodKey || !lock.year_end_finalized_at) {
            throw new BadRequestException(`Year-end ${periodKey} has not been finalized for this branch.`);
        }

        const yearEndRange = this.getFiscalYearRange(periodKey);
        const yearEndPostingDate = this.addDays(yearEndRange.end, 1);
        const closeJournalId = lock.year_end_close_journal_entry_id ?? null;
        if (closeJournalId) {
            const original = await this.entryRepo.findOne({
                where: { id: closeJournalId, client_id: clientId, branch_id: dto.branch_id },
                relations: ['items'],
            });
            if (original && !original.reversal_entry_id) {
                await this.dataSource.transaction(async (manager) => {
                    const reversal = await this.persistJournalEntry(
                        manager,
                        clientId,
                        dto.branch_id,
                        {
                            branch_id: dto.branch_id,
                            transaction_date: new Date(`${yearEndPostingDate}T12:30:00`),
                            business_date: yearEndPostingDate,
                            description: `Reopen year-end close for ${periodKey}: ${dto.reason.trim()}`,
                            reference_id: `YE-REOPEN-${periodKey}-${dto.branch_id}`,
                            source_module: 'accounting',
                            source_entity_type: 'year_end',
                            source_entity_id: `${this.buildYearEndSourceId(dto.branch_id, periodKey)}:reopen:${Date.now()}`,
                            source_event: 'year_end_reopen',
                            posting_type: 'closing',
                            items: (original.items ?? []).map((item) => ({
                                account_id: item.account_id,
                                debit: this.roundMoney(item.credit),
                                credit: this.roundMoney(item.debit),
                            })),
                        },
                        new Date(`${yearEndPostingDate}T12:30:00`),
                        yearEndPostingDate,
                        this.roundMoney(original.total_credit),
                        this.roundMoney(original.total_debit),
                    );

                    await manager.update(JournalEntry, { id: original.id, client_id: clientId }, {
                        reversal_entry_id: reversal.id,
                        reversal_reason: dto.reason.trim(),
                        reversed_at: new Date(),
                    });
                    await manager.update(JournalEntry, { id: reversal.id, client_id: clientId }, {
                        reversed_entry_id: original.id,
                        reversal_reason: dto.reason.trim(),
                        reversed_at: new Date(),
                    });
                });
            }
        }

        lock.mode = PeriodLockMode.ADMIN_OVERRIDE;
        lock.locked_through_date = yearEndRange.end;
        lock.updated_by = this.resolveActorName(user) ?? null;
        lock.last_reopened_by = this.resolveActorName(user) ?? null;
        lock.last_reopened_at = new Date();
        lock.last_reopen_reason = dto.reason.trim();
        lock.year_end_reopened_by = this.resolveActorName(user) ?? null;
        lock.year_end_reopened_at = new Date();
        lock.year_end_reopen_reason = dto.reason.trim();
        await this.periodLockRepo.save(lock);

        return this.getMonthCloseChecklist(clientId, dto.branch_id, periodKey);
    }

    async findJournalEntryBySource(
        clientId: string,
        branchId: number,
        source: {
            source_module?: string | null;
            source_entity_type?: string | null;
            source_entity_id?: string | null;
            source_event?: string | null;
        },
    ): Promise<JournalEntry | null> {
        if (!source.source_module || !source.source_entity_type || !source.source_entity_id) {
            return null;
        }

        const query = this.entryRepo.createQueryBuilder('entry')
            .leftJoinAndSelect('entry.items', 'item')
            .leftJoinAndSelect('item.account', 'account')
            .where('entry.client_id = :clientId', { clientId })
            .andWhere('entry.branch_id = :branchId', { branchId })
            .andWhere('entry.source_module = :sourceModule', { sourceModule: source.source_module })
            .andWhere('entry.source_entity_type = :sourceEntityType', { sourceEntityType: source.source_entity_type })
            .andWhere('entry.source_entity_id = :sourceEntityId', { sourceEntityId: source.source_entity_id });

        if (source.source_event) {
            query.andWhere('entry.source_event = :sourceEvent', { sourceEvent: source.source_event });
        } else {
            query.andWhere('entry.source_event IS NULL');
        }

        return query.getOne();
    }

    private async persistJournalEntry(
        manager: EntityManager,
        clientId: string,
        branchId: number,
        dto: CreateJournalEntryDto,
        transactionDate: Date,
        businessDate: string,
        totalDebit: number,
        totalCredit: number,
    ): Promise<JournalEntry> {
        const entry = manager.create(JournalEntry, {
            client_id: clientId,
            branch_id: branchId,
            transaction_date: transactionDate,
            business_date: businessDate,
            description: dto.description?.trim() || null,
            reference_id: dto.reference_id?.trim() || null,
            source_module: dto.source_module?.trim() || null,
            source_entity_type: dto.source_entity_type?.trim() || null,
            source_entity_id: dto.source_entity_id?.trim() || null,
            source_event: dto.source_event?.trim() || null,
            posting_type: dto.posting_type ?? 'manual',
            total_debit: this.roundMoney(totalDebit),
            total_credit: this.roundMoney(totalCredit),
            is_accrual: Boolean(dto.is_accrual),
            accrual_reversal_due_date: dto.is_accrual
                ? (dto.accrual_reversal_due_date ?? null)
                : null,
            accrual_reversal_status: dto.is_accrual
                ? JournalAccrualReversalStatus.PENDING
                : null,
            close_adjustment_type: dto.close_adjustment_type ?? null,
            schedule_start_date: dto.close_adjustment_type
                ? (dto.schedule_start_date ?? null)
                : null,
            schedule_end_date: dto.close_adjustment_type
                ? (dto.schedule_end_date ?? null)
                : null,
        } as Partial<JournalEntry>);

        const savedEntry = await manager.save(entry);

        for (const itemDto of dto.items) {
            const account = await manager.findOne(ChartOfAccount, {
                where: { id: itemDto.account_id, client_id: clientId },
            });
            if (!account) {
                throw new NotFoundException(`Account ${itemDto.account_id} not found.`);
            }
            if (account.scope === AccountScope.BRANCH && account.branch_id && account.branch_id !== branchId) {
                throw new BadRequestException(
                    `Account ${account.account_code} is not available for branch ${branchId}.`,
                );
            }
            if ((dto.posting_type ?? 'manual') === 'manual' && account.allow_manual_posting === false) {
                throw new BadRequestException(
                    `Account ${account.account_code} cannot be posted through manual journal entries.`,
                );
            }

            const journalItem = manager.create(JournalItem, {
                entry_id: savedEntry.id,
                account_id: itemDto.account_id,
                debit: this.roundMoney(itemDto.debit),
                credit: this.roundMoney(itemDto.credit),
            });
            await manager.save(journalItem);
        }

        return manager.findOneOrFail(JournalEntry, {
            where: { id: savedEntry.id, client_id: clientId },
            relations: ['items', 'items.account', 'day_close'],
        });
    }

    async createJournalEntry(
        clientId: string,
        branchId: number,
        dto: CreateJournalEntryDto,
        user?: JwtPayload,
    ): Promise<JournalEntry> {
        await this.assertBranchBelongsToClient(clientId, branchId, 'post journal entries');
        await this.ensureBaseChart(clientId);

        let totalDebit = 0;
        let totalCredit = 0;

        for (const item of dto.items) {
            const debit = this.roundMoney(item.debit);
            const credit = this.roundMoney(item.credit);

            if (debit < 0 || credit < 0) {
                throw new BadRequestException('Debit and credit amounts cannot be negative.');
            }
            if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
                throw new BadRequestException('Each journal line must contain either a debit or a credit amount.');
            }

            totalDebit += debit;
            totalCredit += credit;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw new BadRequestException(
                `Journal entry is not balanced. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`,
            );
        }

        if (dto.items.length < 2) {
            throw new BadRequestException('Journal entry must have at least two items.');
        }
        if (dto.is_accrual && !dto.accrual_reversal_due_date) {
            throw new BadRequestException('Accrual journals must include a reversal due date.');
        }
        if (dto.is_accrual && dto.close_adjustment_type) {
            throw new BadRequestException('A journal cannot be both an accrual and a prepaid/deferred close adjustment.');
        }
        if (dto.close_adjustment_type && (!dto.schedule_start_date || !dto.schedule_end_date)) {
            throw new BadRequestException('Prepaid and deferred journals must include both schedule start and schedule end dates.');
        }
        if (dto.schedule_start_date && dto.schedule_end_date && dto.schedule_start_date > dto.schedule_end_date) {
            throw new BadRequestException('Schedule start date cannot be later than schedule end date.');
        }

        const existingSourceEntry = await this.findJournalEntryBySource(clientId, branchId, dto);
        if (existingSourceEntry) {
            return existingSourceEntry;
        }

        const transactionDate = dto.transaction_date instanceof Date
            ? dto.transaction_date
            : new Date(dto.transaction_date);
        if (Number.isNaN(transactionDate.getTime())) {
            throw new BadRequestException('Invalid transaction_date supplied.');
        }

        const businessDate = this.resolveBusinessDate(transactionDate, dto.business_date);
        await this.assertPeriodUnlockedForOperation(clientId, branchId, businessDate, 'Journal posting', user);

        return this.dataSource.transaction((manager) =>
            this.persistJournalEntry(
                manager,
                clientId,
                branchId,
                dto,
                transactionDate,
                businessDate,
                totalDebit,
                totalCredit,
            ),
        );
    }

    async getTrialBalance(clientId: string, branchId?: number, asOfDate?: string) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const params: any[] = [clientId];
        let filters = '';

        if (branchId) {
            filters += ' AND entry.branch_id = ?';
            params.push(branchId);
        }
        if (asOfDate) {
            filters += ' AND entry.transaction_date <= ?';
            params.push(asOfDate);
        }

        const query = `
      SELECT
        coa.id,
        coa.account_code,
        coa.account_name,
        coa.account_type,
        coa.scope,
        coa.branch_id,
        coa.parent_id,
        coa.schedule_code,
        coa.is_control_account,
        coa.allow_manual_posting,
        coa.is_bank_account,
        coa.is_cash_account,
        COALESCE(SUM(CASE WHEN entry.id IS NOT NULL ${filters} THEN items.debit ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN entry.id IS NOT NULL ${filters} THEN items.credit ELSE 0 END), 0) as total_credit
      FROM accounting_coa coa
      LEFT JOIN accounting_journal_items items ON coa.id = items.account_id
      LEFT JOIN accounting_journal_entries entry ON items.entry_id = entry.id
      WHERE coa.client_id = ?
      GROUP BY coa.id
      ORDER BY coa.account_code ASC
    `;

        const filterParams = params.slice(1);
        const rows = await this.dataSource.query(query, [...filterParams, ...filterParams, clientId]);
        const accounts = rows.map((row: any) => ({
            ...row,
            total_debit: this.normalizeAmount(row.total_debit),
            total_credit: this.normalizeAmount(row.total_credit),
            net_balance: this.normalizeAmount(row.total_debit) - this.normalizeAmount(row.total_credit),
        }));
        const totalDebit = accounts.reduce((sum: number, row: any) => sum + row.total_debit, 0);
        const totalCredit = accounts.reduce((sum: number, row: any) => sum + row.total_credit, 0);
        const difference = this.roundMoney(totalDebit - totalCredit);
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? null);

        return {
            accounts,
            as_of_date: asOfDate ?? null,
            period_lock: {
                mode: effectiveLock?.mode ?? PeriodLockMode.NONE,
                locked_through_date: effectiveLock?.locked_through_date ?? null,
                scope: effectiveLock?.branch_id ? 'branch' : 'company',
            },
            summary: {
                total_debit: totalDebit,
                total_credit: totalCredit,
                difference,
                is_balanced: Math.abs(difference) < 0.01,
                account_count: accounts.length,
                non_zero_account_count: accounts.filter((row: any) =>
                    Math.abs(Number(row.total_debit ?? 0)) > 0.009 || Math.abs(Number(row.total_credit ?? 0)) > 0.009,
                ).length,
                control_account_count: accounts.filter((row: any) => Boolean(row.is_control_account)).length,
                manual_posting_restricted_count: accounts.filter((row: any) => row.allow_manual_posting === false).length,
            },
        };
    }

    async getJournalEntries(
        clientId: string,
        branchId?: number,
        businessDate?: string,
        dateFrom?: string,
        dateTo?: string,
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);

        const query = this.entryRepo.createQueryBuilder('entry')
            .leftJoinAndSelect('entry.items', 'item')
            .leftJoinAndSelect('item.account', 'account')
            .leftJoinAndSelect('entry.day_close', 'day_close')
            .where('entry.client_id = :clientId', { clientId });

        if (branchId) {
            query.andWhere('entry.branch_id = :branchId', { branchId });
        }
        if (businessDate) {
            query.andWhere('entry.business_date = :businessDate', { businessDate });
        }
        if (dateFrom) {
            query.andWhere('entry.transaction_date >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            query.andWhere('entry.transaction_date <= :dateTo', { dateTo });
        }

        const entries = await query.orderBy('entry.transaction_date', 'DESC').addOrderBy('entry.id', 'DESC').getMany();
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? null);
        const lockedThroughDate = effectiveLock?.locked_through_date ?? null;
        const lockMode = effectiveLock?.mode ?? PeriodLockMode.NONE;

        return entries.map((entry) => ({
            ...entry,
            is_locked_by_period: Boolean(
                lockedThroughDate
                && entry.business_date
                && entry.business_date <= lockedThroughDate
                && lockMode === PeriodLockMode.HARD_LOCK,
            ),
            is_accrual: Boolean(entry.is_accrual),
            accrual_reversal_due_date: entry.accrual_reversal_due_date ?? null,
            accrual_reversal_status: entry.accrual_reversal_status ?? null,
            close_adjustment_type: entry.close_adjustment_type ?? null,
            schedule_start_date: entry.schedule_start_date ?? null,
            schedule_end_date: entry.schedule_end_date ?? null,
        }));
    }

    async getJournalEntry(clientId: string, id: number, accessibleBranchIds?: number[]) {
        const entry = await this.entryRepo.findOne({
            where: { id, client_id: clientId },
            relations: ['items', 'items.account', 'branch', 'day_close'],
        });
        if (
            !entry ||
            (accessibleBranchIds &&
                accessibleBranchIds.length > 0 &&
                !accessibleBranchIds.includes(entry.branch_id))
        ) {
            throw new NotFoundException(`Journal entry ${id} not found`);
        }

        return entry;
    }

    async reverseJournalEntry(
        clientId: string,
        id: number,
        dto: ReverseJournalEntryDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        const original = await this.entryRepo.findOne({
            where: { id, client_id: clientId },
            relations: ['items', 'items.account', 'day_close'],
        });
        if (
            !original ||
            (accessibleBranchIds && accessibleBranchIds.length > 0 && !accessibleBranchIds.includes(original.branch_id))
        ) {
            throw new NotFoundException(`Journal entry ${id} not found`);
        }
        if (original.day_close_id) {
            throw new BadRequestException('Closed journal entries cannot be reversed through this workflow.');
        }
        if (original.reversal_entry_id) {
            throw new BadRequestException('This journal entry has already been reversed.');
        }
        if (original.reversed_entry_id) {
            throw new BadRequestException('A reversal entry cannot be reversed again.');
        }

        const transactionDate = dto.transaction_date instanceof Date
            ? dto.transaction_date
            : new Date(dto.transaction_date);
        if (Number.isNaN(transactionDate.getTime())) {
            throw new BadRequestException('Invalid transaction_date supplied.');
        }

        const branchId = dto.branch_id ?? original.branch_id;
        await this.assertBranchBelongsToClient(clientId, branchId, 'reverse journal entries');
        const businessDate = this.resolveBusinessDate(transactionDate, dto.business_date);
        await this.assertPeriodUnlockedForOperation(clientId, branchId, businessDate, 'Journal reversal', user);

        return this.dataSource.transaction(async (manager) => {
            const reversal = await this.persistJournalEntry(
                manager,
                clientId,
                branchId,
                {
                    branch_id: branchId,
                    transaction_date: transactionDate,
                    business_date: businessDate,
                    description: `Reversal of JE-${String(original.id).padStart(4, '0')}: ${dto.reason.trim()}`,
                    reference_id: `REV-JE-${original.id}`,
                    source_module: 'accounting',
                    source_entity_type: 'journal_entry',
                    source_entity_id: String(original.id),
                    source_event: 'reversal',
                    posting_type: 'auto',
                    items: (original.items ?? []).map((item) => ({
                        account_id: item.account_id,
                        debit: this.roundMoney(item.credit),
                        credit: this.roundMoney(item.debit),
                    })),
                },
                transactionDate,
                businessDate,
                this.roundMoney(original.total_credit),
                this.roundMoney(original.total_debit),
            );

            await manager.update(JournalEntry, { id: original.id, client_id: clientId }, {
                reversal_entry_id: reversal.id,
                reversal_reason: dto.reason.trim(),
                reversed_at: new Date(),
                accrual_reversal_status: original.is_accrual
                    ? JournalAccrualReversalStatus.REVERSED
                    : original.accrual_reversal_status,
            });
            await manager.update(JournalEntry, { id: reversal.id, client_id: clientId }, {
                reversed_entry_id: original.id,
                reversal_reason: dto.reason.trim(),
                reversed_at: new Date(),
                is_accrual: false,
                accrual_reversal_due_date: null,
                accrual_reversal_status: null,
            });

            return manager.findOneOrFail(JournalEntry, {
                where: { id: reversal.id, client_id: clientId },
                relations: ['items', 'items.account'],
            });
        });
    }

    async getGeneralLedger(
        clientId: string,
        accountId: number,
        branchId?: number,
        dateFrom?: string,
        dateTo?: string,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        await this.ensureBaseChart(clientId);

        const account = await this.coaRepo.findOne({ where: { id: accountId, client_id: clientId } });
        if (!account) {
            throw new NotFoundException(`Account ${accountId} not found`);
        }
        if (
            account.scope === AccountScope.BRANCH &&
            account.branch_id &&
            accessibleBranchIds &&
            accessibleBranchIds.length > 0 &&
            !accessibleBranchIds.includes(account.branch_id)
        ) {
            throw new NotFoundException(`Account ${accountId} not found`);
        }

        const baseQuery = this.entryRepo.createQueryBuilder('entry')
            .innerJoin('entry.items', 'item', 'item.account_id = :accountId', { accountId })
            .where('entry.client_id = :clientId', { clientId });

        if (branchId) {
            baseQuery.andWhere('entry.branch_id = :branchId', { branchId });
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            baseQuery.andWhere('entry.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }

        const openingQuery = baseQuery.clone();
        if (dateFrom) {
            openingQuery.andWhere('entry.transaction_date < :dateFrom', { dateFrom });
        }

        const openingRaw = await openingQuery
            .select('COALESCE(SUM(item.debit), 0)', 'debit')
            .addSelect('COALESCE(SUM(item.credit), 0)', 'credit')
            .getRawOne();

        const txQuery = baseQuery.clone()
            .leftJoinAndSelect('entry.items', 'detailItems')
            .leftJoinAndSelect('detailItems.account', 'detailAccount');

        if (dateFrom) {
            txQuery.andWhere('entry.transaction_date >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            txQuery.andWhere('entry.transaction_date <= :dateTo', { dateTo });
        }

        const entries = await txQuery
            .orderBy('entry.transaction_date', 'ASC')
            .addOrderBy('entry.id', 'ASC')
            .getMany();

        const openingBalance =
            this.normalizeAmount(openingRaw.debit) - this.normalizeAmount(openingRaw.credit);
        let runningBalance = openingBalance;
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? account.branch_id ?? null);
        const lockedThroughDate = effectiveLock?.locked_through_date ?? null;
        const lockMode = effectiveLock?.mode ?? PeriodLockMode.NONE;

        const transactions = entries.map((entry) => {
            const matched = entry.items.find((item) => item.account_id === accountId)!;
            const debit = this.normalizeAmount(matched.debit);
            const credit = this.normalizeAmount(matched.credit);
            runningBalance += debit - credit;
            const isLockedByPeriod = Boolean(
                lockedThroughDate
                && entry.business_date
                && entry.business_date <= lockedThroughDate
                && lockMode === PeriodLockMode.HARD_LOCK,
            );

            return {
                id: entry.id,
                date: entry.transaction_date,
                business_date: entry.business_date,
                journal_id: entry.id,
                description: entry.description,
                reference_id: entry.reference_id,
                source_module: entry.source_module,
                source_event: entry.source_event,
                posting_type: entry.posting_type,
                branch_id: entry.branch_id,
                day_close_id: entry.day_close_id,
                reversed_entry_id: entry.reversed_entry_id,
                reversal_entry_id: entry.reversal_entry_id,
                reversal_reason: entry.reversal_reason,
                reversed_at: entry.reversed_at,
                is_locked_by_period: isLockedByPeriod,
                debit,
                credit,
                running_balance: runningBalance,
                items: entry.items.map((item) => ({
                    id: item.id,
                    account_id: item.account_id,
                    account_code: item.account?.account_code,
                    account_name: item.account?.account_name,
                    debit: this.normalizeAmount(item.debit),
                    credit: this.normalizeAmount(item.credit),
                })),
            };
        });

        return {
            account: {
                id: account.id,
                account_code: account.account_code,
                account_name: account.account_name,
                account_type: account.account_type,
                scope: account.scope,
                branch_id: account.branch_id,
            },
            opening_balance: openingBalance,
            total_debit: transactions.reduce((sum, tx) => sum + tx.debit, 0),
            total_credit: transactions.reduce((sum, tx) => sum + tx.credit, 0),
            closing_balance: runningBalance,
            period_lock: {
                mode: lockMode,
                locked_through_date: lockedThroughDate,
                scope: effectiveLock?.branch_id ? 'branch' : 'company',
            },
            transactions,
        };
    }

    private async buildDayCloseSnapshot(
        clientId: string,
        branchId: number,
        requestedBusinessDate?: string,
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId, 'close the business day');
        const businessDate = this.resolveBusinessDate(undefined, requestedBusinessDate);
        const { start, end } = this.resolveBusinessDateRange(businessDate);

        const [
            existingClose,
            openShifts,
            businessDayShifts,
            orderSummaryRaw,
            paymentRows,
            openOrderCount,
            pendingKotCount,
            issueCostRaw,
            wastageCostRaw,
            journalEntries,
            financeCloseReadiness,
        ] = await Promise.all([
            this.dayCloseRepo.findOne({
                where: { client_id: clientId, branch_id: branchId, business_date: businessDate },
                relations: ['journal_entries'],
            }),
            this.shiftRepo.find({
                where: { client_id: clientId, branch_id: branchId, business_date: businessDate, status: 'open' },
                order: { opened_at: 'DESC', id: 'DESC' },
            }),
            this.shiftRepo.find({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    business_date: businessDate,
                },
                order: { opened_at: 'DESC', id: 'DESC' },
            }),
            this.orderRepo.createQueryBuilder('order')
                .select('COUNT(order.id)', 'order_count')
                .addSelect('COALESCE(SUM(order.sub_total), 0)', 'gross_sales_amount')
                .addSelect('COALESCE(SUM(order.discount_amount), 0)', 'discount_amount')
                .addSelect('COALESCE(SUM(order.tax_amount), 0)', 'tax_amount')
                .addSelect('COALESCE(SUM(order.total_amount), 0)', 'net_sales_amount')
                .where('order.client_id = :clientId', { clientId })
                .andWhere('order.branch_id = :branchId', { branchId })
                .andWhere('order.order_status = :status', { status: 'completed' })
                .andWhere('order.finalized_at >= :start', { start })
                .andWhere('order.finalized_at < :end', { end })
                .getRawOne(),
            this.transactionRepo.createQueryBuilder('transaction')
                .select('transaction.payment_mode', 'payment_mode')
                .addSelect(
                    `COALESCE(SUM(CASE WHEN transaction.is_refund = true THEN -transaction.amount ELSE transaction.amount END), 0)`,
                    'amount',
                )
                .where('transaction.client_id = :clientId', { clientId })
                .andWhere('transaction.branch_id = :branchId', { branchId })
                .andWhere('transaction.transaction_date >= :start', { start })
                .andWhere('transaction.transaction_date < :end', { end })
                .groupBy('transaction.payment_mode')
                .getRawMany(),
            this.orderRepo.count({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    order_status: In(['held', 'pending', 'preparing', 'ready', 'served']),
                },
            }),
            this.kotRepo.count({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    status: In(['pending', 'preparing', 'ready']),
                },
            }),
            this.stockLedgerRepo.createQueryBuilder('ledger')
                .select('COALESCE(SUM(ABS(ledger.quantity * ledger.unit_cost)), 0)', 'amount')
                .where('ledger.client_id = :clientId', { clientId })
                .andWhere('ledger.branch_id = :branchId', { branchId })
                .andWhere('ledger.transaction_type = :type', { type: 'sale' })
                .andWhere('ledger.created_at >= :start', { start })
                .andWhere('ledger.created_at < :end', { end })
                .getRawOne(),
            this.stockLedgerRepo.createQueryBuilder('ledger')
                .select('COALESCE(SUM(ABS(ledger.quantity * ledger.unit_cost)), 0)', 'amount')
                .where('ledger.client_id = :clientId', { clientId })
                .andWhere('ledger.branch_id = :branchId', { branchId })
                .andWhere('ledger.transaction_type = :type', { type: 'wastage' })
                .andWhere('ledger.created_at >= :start', { start })
                .andWhere('ledger.created_at < :end', { end })
                .getRawOne(),
            this.entryRepo.find({
                where: { client_id: clientId, branch_id: branchId, business_date: businessDate },
                relations: ['items', 'items.account', 'day_close'],
                order: { transaction_date: 'DESC', id: 'DESC' },
                take: 25,
            }),
            this.getFinanceCloseReadiness(clientId, businessDate, branchId),
        ]);

        const latestClosedShift = businessDayShifts.find((shift) => shift.status === 'closed')
            ?? businessDayShifts[0]
            ?? null;
        const shiftTotals = businessDayShifts.reduce((acc, shift) => ({
            expected_cash: acc.expected_cash + this.roundMoney(shift.expected_cash),
            actual_cash: acc.actual_cash + this.roundMoney(shift.actual_cash),
            variance: acc.variance + this.roundMoney(shift.variance),
        }), { expected_cash: 0, actual_cash: 0, variance: 0 });

        const paymentTotals = {
            cash: 0,
            bank: 0,
            card: 0,
            digital_wallet: 0,
            other: 0,
        };
        for (const row of paymentRows) {
            const paymentMode = String(row.payment_mode || 'other') as keyof typeof paymentTotals;
            paymentTotals[paymentMode] = this.roundMoney(row.amount);
        }

        const blockers = [
            openShifts.length > 0 ? 'An active POS shift must be closed before day close.' : null,
            openOrderCount > 0 ? `${openOrderCount} POS order(s) are still open.` : null,
            pendingKotCount > 0 ? `${pendingKotCount} KOT(s) are still pending.` : null,
            existingClose ? `Business date ${businessDate} is already closed.` : null,
            ...((financeCloseReadiness.issues ?? []).map((issue) => `Finance close blocker: ${issue}`)),
        ].filter((value): value is string => Boolean(value));

        const journalSummary = {
            count: journalEntries.length,
            manual_count: journalEntries.filter((entry) => entry.posting_type === 'manual').length,
            auto_count: journalEntries.filter((entry) => entry.posting_type === 'auto').length,
            closing_count: journalEntries.filter((entry) => entry.posting_type === 'closing').length,
            entries: journalEntries.map((entry) => ({
                id: entry.id,
                business_date: entry.business_date,
                transaction_date: entry.transaction_date,
                description: entry.description,
                reference_id: entry.reference_id,
                source_module: entry.source_module,
                source_entity_type: entry.source_entity_type,
                source_entity_id: entry.source_entity_id,
                source_event: entry.source_event,
                posting_type: entry.posting_type,
                day_close_id: entry.day_close_id,
                total_debit: this.roundMoney(entry.total_debit),
                total_credit: this.roundMoney(entry.total_credit),
            })),
        };

        return {
            business_date: businessDate,
            status: existingClose ? 'closed' : 'open',
            blockers,
            shift: latestClosedShift
                ? {
                    id: latestClosedShift.id,
                    status: latestClosedShift.status,
                    opened_at: latestClosedShift.opened_at,
                    closed_at: latestClosedShift.closed_at,
                    shift_count: businessDayShifts.length,
                    expected_cash: this.roundMoney(shiftTotals.expected_cash),
                    actual_cash: this.roundMoney(shiftTotals.actual_cash),
                    variance: this.roundMoney(shiftTotals.variance),
                }
                : null,
            sales: {
                order_count: Number(orderSummaryRaw?.order_count || 0),
                gross_sales_amount: this.roundMoney(orderSummaryRaw?.gross_sales_amount),
                discount_amount: this.roundMoney(orderSummaryRaw?.discount_amount),
                tax_amount: this.roundMoney(orderSummaryRaw?.tax_amount),
                other_charges_amount: this.roundMoney(
                    this.normalizeAmount(orderSummaryRaw?.net_sales_amount)
                    - this.normalizeAmount(orderSummaryRaw?.gross_sales_amount)
                    + this.normalizeAmount(orderSummaryRaw?.discount_amount)
                    - this.normalizeAmount(orderSummaryRaw?.tax_amount),
                ),
                net_sales_amount: this.roundMoney(orderSummaryRaw?.net_sales_amount),
                payment_breakdown: {
                    cash: this.roundMoney(paymentTotals.cash),
                    bank: this.roundMoney(paymentTotals.bank),
                    card: this.roundMoney(paymentTotals.card),
                    digital_wallet: this.roundMoney(paymentTotals.digital_wallet),
                    other: this.roundMoney(paymentTotals.other),
                },
            },
            stock: {
                inventory_issue_cost_amount: this.roundMoney(issueCostRaw?.amount),
                wastage_cost_amount: this.roundMoney(wastageCostRaw?.amount),
            },
            finance_close_readiness: financeCloseReadiness,
            journals: journalSummary,
            existing_close: existingClose
                ? {
                    id: existingClose.id,
                    business_date: existingClose.business_date,
                    closed_at: existingClose.closed_at,
                    journal_entry_count: existingClose.journal_entry_count,
                    net_sales_amount: this.roundMoney(existingClose.net_sales_amount),
                    cash_variance_amount: this.roundMoney(existingClose.cash_variance_amount),
                }
                : null,
        };
    }

    async getDayClosePreview(
        clientId: string,
        branchId: number,
        businessDate?: string,
    ) {
        return this.buildDayCloseSnapshot(clientId, branchId, businessDate);
    }

    async getDayCloseHistory(clientId: string, branchId: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);

        const rows = await this.dayCloseRepo.find({
            where: { client_id: clientId, branch_id: branchId },
            order: { business_date: 'DESC', id: 'DESC' },
            take: 15,
        });

        return rows.map((row) => ({
            id: row.id,
            business_date: row.business_date,
            closed_at: row.closed_at,
            closed_by_name: row.closed_by_name,
            order_count: row.order_count,
            net_sales_amount: this.roundMoney(row.net_sales_amount),
            expected_cash_amount: this.roundMoney(row.expected_cash_amount),
            actual_cash_amount: this.roundMoney(row.actual_cash_amount),
            cash_variance_amount: this.roundMoney(row.cash_variance_amount),
            journal_entry_count: row.journal_entry_count,
            notes: row.notes ?? null,
            has_notes: Boolean(row.notes?.trim()),
            review_status: Math.abs(Number(row.cash_variance_amount ?? 0)) > 0.009
                ? 'variance_review'
                : row.notes?.trim()
                    ? 'noted_close'
                    : 'clean_close',
        }));
    }

    async closeDay(
        clientId: string,
        branchId: number,
        dto: CloseDayDto,
        user?: JwtPayload,
    ) {
        const snapshot = await this.buildDayCloseSnapshot(clientId, branchId, dto.business_date);
        if (snapshot.blockers.length > 0) {
            throw new BadRequestException(snapshot.blockers.join(' '));
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const closedByUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const closedByName = this.resolveActorName(user);

        return this.dataSource.transaction(async (manager) => {
            const dayClose = manager.create(AccountingDayClose, {
                client_id: clientId,
                branch_id: branchId,
                business_date: snapshot.business_date,
                closed_at: new Date(),
                closed_by_user_id: closedByUserId,
                closed_by_name: closedByName,
                shift_id: snapshot.shift?.id ?? null,
                order_count: snapshot.sales.order_count,
                gross_sales_amount: snapshot.sales.gross_sales_amount,
                discount_amount: snapshot.sales.discount_amount,
                tax_amount: snapshot.sales.tax_amount,
                other_charges_amount: snapshot.sales.other_charges_amount,
                net_sales_amount: snapshot.sales.net_sales_amount,
                cash_sales_amount: snapshot.sales.payment_breakdown.cash,
                bank_sales_amount: snapshot.sales.payment_breakdown.bank,
                card_sales_amount: snapshot.sales.payment_breakdown.card,
                digital_wallet_sales_amount: snapshot.sales.payment_breakdown.digital_wallet,
                other_payment_sales_amount: snapshot.sales.payment_breakdown.other,
                inventory_issue_cost_amount: snapshot.stock.inventory_issue_cost_amount,
                wastage_cost_amount: snapshot.stock.wastage_cost_amount,
                expected_cash_amount: snapshot.shift?.expected_cash ?? 0,
                actual_cash_amount: snapshot.shift?.actual_cash ?? 0,
                cash_variance_amount: snapshot.shift?.variance ?? 0,
                notes: dto.notes?.trim() || null,
                journal_entry_count: 0,
            });
            const savedDayClose = await manager.save(dayClose);

            if (snapshot.shift && Math.abs(Number(snapshot.shift.variance || 0)) > 0.009) {
                const cashAccount = await this.ensureDefaultAccount(clientId, '1101', 'Cash on Hand', 'asset');
                const varianceAccount = Number(snapshot.shift.variance) > 0
                    ? await this.ensureDefaultAccount(clientId, '4400', 'Cash Overages', 'revenue')
                    : await this.ensureDefaultAccount(clientId, '5800', 'Cash Shortages', 'expense');
                const varianceAmount = this.roundMoney(Math.abs(snapshot.shift.variance));

                await this.persistJournalEntry(
                    manager,
                    clientId,
                    branchId,
                    {
                        transaction_date: snapshot.shift.closed_at ? new Date(snapshot.shift.closed_at) : new Date(),
                        business_date: snapshot.business_date,
                        description: `Cash variance for day close ${snapshot.business_date}`,
                        reference_id: `DAY-CLOSE-${branchId}-${snapshot.business_date}`,
                        source_module: 'accounting',
                        source_entity_type: 'day_close',
                        source_entity_id: String(savedDayClose.id),
                        source_event: 'cash_variance',
                        posting_type: 'closing',
                        items: Number(snapshot.shift.variance) > 0
                            ? [
                                { account_id: cashAccount.id, debit: varianceAmount, credit: 0 },
                                { account_id: varianceAccount.id, debit: 0, credit: varianceAmount },
                            ]
                            : [
                                { account_id: varianceAccount.id, debit: varianceAmount, credit: 0 },
                                { account_id: cashAccount.id, debit: 0, credit: varianceAmount },
                            ],
                    },
                    snapshot.shift.closed_at ? new Date(snapshot.shift.closed_at) : new Date(),
                    snapshot.business_date,
                    varianceAmount,
                    varianceAmount,
                );
            }

            await manager.createQueryBuilder()
                .update(JournalEntry)
                .set({ day_close_id: savedDayClose.id })
                .where('client_id = :clientId', { clientId })
                .andWhere('branch_id = :branchId', { branchId })
                .andWhere('business_date = :businessDate', { businessDate: snapshot.business_date })
                .andWhere('day_close_id IS NULL')
                .execute();

            const journalEntryCount = await manager.count(JournalEntry, {
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    business_date: snapshot.business_date,
                    day_close_id: savedDayClose.id,
                },
            });

            savedDayClose.journal_entry_count = journalEntryCount;
            await manager.save(savedDayClose);

            return manager.findOneOrFail(AccountingDayClose, {
                where: { id: savedDayClose.id, client_id: clientId },
                relations: ['journal_entries'],
            });
        }).then((savedClose) => ({
            id: savedClose.id,
            business_date: savedClose.business_date,
            closed_at: savedClose.closed_at,
            closed_by_name: savedClose.closed_by_name,
            order_count: savedClose.order_count,
            gross_sales_amount: this.roundMoney(savedClose.gross_sales_amount),
            discount_amount: this.roundMoney(savedClose.discount_amount),
            tax_amount: this.roundMoney(savedClose.tax_amount),
            other_charges_amount: this.roundMoney(savedClose.other_charges_amount),
            net_sales_amount: this.roundMoney(savedClose.net_sales_amount),
            cash_sales_amount: this.roundMoney(savedClose.cash_sales_amount),
            bank_sales_amount: this.roundMoney(savedClose.bank_sales_amount),
            card_sales_amount: this.roundMoney(savedClose.card_sales_amount),
            digital_wallet_sales_amount: this.roundMoney(savedClose.digital_wallet_sales_amount),
            other_payment_sales_amount: this.roundMoney(savedClose.other_payment_sales_amount),
            inventory_issue_cost_amount: this.roundMoney(savedClose.inventory_issue_cost_amount),
            wastage_cost_amount: this.roundMoney(savedClose.wastage_cost_amount),
            expected_cash_amount: this.roundMoney(savedClose.expected_cash_amount),
            actual_cash_amount: this.roundMoney(savedClose.actual_cash_amount),
            cash_variance_amount: this.roundMoney(savedClose.cash_variance_amount),
            journal_entry_count: savedClose.journal_entry_count,
            journal_entries: (savedClose.journal_entries ?? []).map((entry) => ({
                id: entry.id,
                description: entry.description,
                reference_id: entry.reference_id,
                source_module: entry.source_module,
                source_event: entry.source_event,
                posting_type: entry.posting_type,
                total_debit: this.roundMoney(entry.total_debit),
                total_credit: this.roundMoney(entry.total_credit),
            })),
        }));
    }

    async allocateVendorPayment(
        clientId: string,
        branchId: number,
        voucherId: number,
        vendorId: number,
        amount: number,
        allocationDate: string,
        journalEntryId?: number | null,
        notes?: string | null,
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        let remaining = this.roundMoney(amount);
        if (remaining <= 0) {
            return [];
        }

        const [grnRows, expenseVoucherRows] = await Promise.all([
            this.dataSource.query(
                `
                SELECT
                  'grn' AS payable_type,
                  grn.id,
                  grn.branch_id,
                  grn.vendor_id,
                  grn.grn_number AS document_no,
                  DATE(COALESCE(grn.vendor_bill_due_date, grn.vendor_bill_date, grn.receipt_date)) AS due_date,
                  GREATEST(COALESCE(grn.vendor_bill_amount, COALESCE(SUM(item.line_total), 0)) - COALESCE(ret.total_returned, 0), 0) AS bill_amount,
                  COALESCE(alloc.total_allocated, 0) AS allocated_amount,
                  COALESCE(credit.total_credited, 0) AS total_credited
                FROM goods_receipt_notes grn
                INNER JOIN goods_receipt_note_items item ON item.grn_id = grn.id
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
                    AND linked_grn_id IS NOT NULL
                  GROUP BY linked_grn_id
                ) credit ON credit.linked_grn_id = grn.id
                WHERE grn.client_id = ?
                  AND grn.branch_id = ?
                  AND grn.vendor_id = ?
                  AND grn.status = 'posted'
                  AND grn.payable_status = 'bill_received'
                GROUP BY grn.id, grn.branch_id, grn.vendor_id, document_no, due_date, alloc.total_allocated, credit.total_credited
                HAVING bill_amount - COALESCE(credit.total_credited, 0) - allocated_amount > 0.009
                `,
                [clientId, clientId, clientId, clientId, branchId, vendorId],
            ),
            this.dataSource.query(
                `
                SELECT
                  'expense_voucher' AS payable_type,
                  voucher.id,
                  voucher.branch_id,
                  voucher.party_id AS vendor_id,
                  voucher.voucher_no AS document_no,
                  DATE(voucher.date) AS due_date,
                  COALESCE(voucher.amount, 0) AS bill_amount,
                  COALESCE(alloc.total_allocated, 0) AS allocated_amount
                FROM financial_vouchers voucher
                LEFT JOIN (
                  SELECT payable_voucher_id, COALESCE(SUM(allocated_amount), 0) AS total_allocated
                  FROM accounting_payable_allocations
                  WHERE client_id = ?
                    AND payable_voucher_id IS NOT NULL
                  GROUP BY payable_voucher_id
                ) alloc ON alloc.payable_voucher_id = voucher.id
                WHERE voucher.client_id = ?
                  AND voucher.branch_id = ?
                  AND voucher.type = 'EXPENSE'
                  AND voucher.status = 'APPROVED'
                  AND voucher.payment_method = 'Credit Purchase'
                  AND voucher.party_type = 'VENDOR'
                  AND voucher.party_id = ?
                  AND COALESCE(voucher.amount, 0) - COALESCE(alloc.total_allocated, 0) > 0.009
                `,
                [clientId, clientId, branchId, String(vendorId)],
            ),
        ]);

        const openRows = [...grnRows, ...expenseVoucherRows]
            .sort((a: any, b: any) => {
                const dueComparison = String(a.due_date || '').localeCompare(String(b.due_date || ''));
                if (dueComparison !== 0) return dueComparison;
                return Number(a.id) - Number(b.id);
            });

        const allocations: AccountingPayableAllocation[] = [];
        for (const row of openRows) {
            if (remaining <= 0.009) {
                break;
            }

            const openAmount = this.roundMoney(
                this.normalizeAmount(row.bill_amount)
                - this.normalizeAmount(row.allocated_amount)
                - this.normalizeAmount((row as any).total_credited),
            );
            if (openAmount <= 0) {
                continue;
            }

            const allocatedAmount = this.roundMoney(Math.min(remaining, openAmount));
            const allocation = this.payableAllocationRepo.create({
                client_id: clientId,
                branch_id: Number(row.branch_id),
                grn_id: row.payable_type === 'grn' ? Number(row.id) : null,
                payable_voucher_id: row.payable_type === 'expense_voucher' ? Number(row.id) : null,
                voucher_id: voucherId,
                journal_entry_id: journalEntryId ?? null,
                vendor_id: vendorId,
                allocated_amount: allocatedAmount,
                allocation_date: allocationDate,
                notes: notes?.trim() || null,
            });
            allocations.push(await this.payableAllocationRepo.save(allocation));
            remaining = this.roundMoney(remaining - allocatedAmount);
        }

        return allocations;
    }

    async clearVoucherPayableAllocations(clientId: string, voucherId: number) {
        await this.payableAllocationRepo.delete({ client_id: clientId, voucher_id: voucherId });
    }

    async getReceivablesAging(
        clientId: string,
        branchId?: number,
        asOfDate?: string,
        customerId?: number,
        sourceType?: string,
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const effectiveDate = asOfDate ?? this.formatBusinessDate(new Date());
        const normalizedSourceType = String(sourceType || 'all').trim().toLowerCase();
        const includePosCredit = normalizedSourceType === 'all' || normalizedSourceType === 'pos_credit';
        const includeEventBilling = normalizedSourceType === 'all' || normalizedSourceType === 'catering_event';

        const documentRows: any[] = [];

        if (includePosCredit) {
            const posParams: any[] = [clientId, clientId, effectiveDate];
            let branchFilter = '';
            let customerFilter = '';
            if (branchId) {
                branchFilter = ' AND ord.branch_id = ?';
                posParams.push(branchId);
            }
            if (customerId) {
                customerFilter = ' AND ord.customer_id = ?';
                posParams.push(customerId);
            }

            const posRows = await this.dataSource.query(
                `
                SELECT
                  'pos_credit' AS receivable_source_type,
                  ord.id,
                  ord.branch_id,
                  COALESCE(ord.receipt_number, ord.order_number, CONCAT('ORD-', ord.id)) AS document_no,
                  DATE(COALESCE(ord.finalized_at, ord.created_at)) AS document_date,
                  DATE(COALESCE(ord.finalized_at, ord.created_at)) AS due_date,
                  ord.customer_id,
                  COALESCE(cust.name, CONCAT('Customer #', ord.customer_id)) AS party_name,
                  cust.customer_code,
                  cust.phone_number,
                  cust.status AS customer_status,
                  cust.allow_credit,
                  cust.credit_limit,
                  cust.credit_control_mode,
                  cust.collection_follow_up_date,
                  cust.collection_follow_up_note,
                  COALESCE(NULLIF(TRIM(order_usr.full_name), ''), NULLIF(TRIM(order_usr.user_name), '')) AS assigned_collector_name,
                  ord.total_amount,
                  COALESCE(pay.total_paid, 0) AS paid_amount,
                  pay.last_payment_date,
                  pay.last_collector_name,
                  GREATEST(ord.total_amount - COALESCE(pay.total_paid, 0), 0) AS outstanding_amount,
                  NULL AS event_id,
                  NULL AS event_no,
                  NULL AS event_title,
                  NULL AS billing_type,
                  NULL AS billing_label
                FROM orders ord
                INNER JOIN customers cust
                  ON cust.id = ord.customer_id
                 AND cust.client_id = ord.client_id
                LEFT JOIN users order_usr
                  ON order_usr.id = ord.user_id
                 AND order_usr.client_id = ord.client_id
                LEFT JOIN (
                  SELECT
                    txn.order_id,
                    COALESCE(SUM(CASE WHEN txn.is_refund = 1 THEN -txn.amount ELSE txn.amount END), 0) AS total_paid,
                    MAX(CASE WHEN txn.is_refund = 0 THEN txn.transaction_date ELSE NULL END) AS last_payment_date,
                    SUBSTRING_INDEX(
                      GROUP_CONCAT(
                        CASE WHEN txn.is_refund = 0 THEN COALESCE(NULLIF(TRIM(usr.full_name), ''), usr.user_name) ELSE NULL END
                        ORDER BY txn.transaction_date DESC, txn.id DESC
                        SEPARATOR '||'
                      ),
                      '||',
                      1
                    ) AS last_collector_name
                  FROM transactions txn
                  LEFT JOIN users usr
                    ON usr.id = txn.user_id
                   AND usr.client_id = txn.client_id
                  WHERE txn.client_id = ?
                  GROUP BY txn.order_id
                ) pay ON pay.order_id = ord.id
                WHERE ord.client_id = ?
                  AND ord.customer_id IS NOT NULL
                  AND ord.order_status = 'completed'
                  AND DATE(COALESCE(ord.finalized_at, ord.created_at)) <= ?
                  ${branchFilter}
                  ${customerFilter}
                  AND GREATEST(ord.total_amount - COALESCE(pay.total_paid, 0), 0) > 0.009
                ORDER BY due_date ASC, ord.id ASC
                `,
                posParams,
            );
            documentRows.push(...posRows);
        }

        if (includeEventBilling) {
            const eventParams: any[] = [clientId, clientId];
            let eventBranchFilter = '';
            let eventCustomerFilter = '';
            if (branchId) {
                eventBranchFilter = ' AND billing.branch_id = ?';
                eventParams.push(branchId);
            }
            if (customerId) {
                eventCustomerFilter = ' AND event.customer_id = ?';
                eventParams.push(customerId);
            }

            const eventRows = await this.dataSource.query(
                `
                SELECT
                  billing.id,
                  billing.branch_id,
                  billing.billing_date AS document_date,
                  billing.billing_date AS due_date,
                  billing.billing_type,
                  billing.label AS billing_label,
                  billing.amount,
                  billing.applied_advance_amount,
                  event.id AS event_id,
                  event.event_no,
                  event.event_title,
                  event.customer_id,
                  COALESCE(cust.name, CONCAT('Customer #', event.customer_id)) AS party_name,
                  cust.customer_code,
                  cust.phone_number,
                  cust.status AS customer_status,
                  cust.allow_credit,
                  cust.credit_limit,
                  cust.credit_control_mode,
                  cust.collection_follow_up_date,
                  cust.collection_follow_up_note,
                  NULL AS assigned_collector_name,
                  COALESCE(col.total_collection, 0) AS event_collection_total
                FROM catering_event_billings billing
                INNER JOIN catering_events event
                  ON event.id = billing.event_id
                 AND event.client_id = billing.client_id
                INNER JOIN customers cust
                  ON cust.id = event.customer_id
                 AND cust.client_id = event.client_id
                LEFT JOIN (
                  SELECT settlement.event_id, COALESCE(SUM(settlement.amount), 0) AS total_collection
                  FROM catering_event_settlements settlement
                  WHERE settlement.client_id = ?
                    AND settlement.settlement_type = 'collection'
                  GROUP BY settlement.event_id
                ) col ON col.event_id = event.id
                WHERE billing.client_id = ?
                  ${eventBranchFilter}
                  ${eventCustomerFilter}
                ORDER BY event.id ASC, billing.billing_date ASC, billing.id ASC
                `,
                eventParams,
            );

            const eventGroups = new Map<string, any[]>();
            for (const row of eventRows) {
                const key = String(row.event_id);
                const list = eventGroups.get(key) ?? [];
                list.push(row);
                eventGroups.set(key, list);
            }

            for (const rows of eventGroups.values()) {
                let remainingCollection = this.roundMoney(rows[0]?.event_collection_total ?? 0);
                for (const row of rows) {
                    const billedAmount = this.roundMoney(row.amount ?? 0);
                    const appliedAdvanceAmount = this.roundMoney(row.applied_advance_amount ?? 0);
                    const openAfterAdvance = this.roundMoney(Math.max(billedAmount - appliedAdvanceAmount, 0));
                    const paidAmount = this.roundMoney(Math.min(openAfterAdvance, remainingCollection));
                    remainingCollection = this.roundMoney(Math.max(remainingCollection - paidAmount, 0));
                    const outstandingAmount = this.roundMoney(Math.max(openAfterAdvance - paidAmount, 0));
                    if (outstandingAmount <= 0.009) {
                        continue;
                    }
                    documentRows.push({
                        receivable_source_type: 'catering_event',
                        id: row.id,
                        branch_id: row.branch_id,
                        document_no: `${row.event_no}-${String(row.billing_type || 'billing').toUpperCase()}-${row.id}`,
                        document_date: row.document_date,
                        due_date: row.due_date,
                        customer_id: row.customer_id,
                        party_name: row.party_name,
                        customer_code: row.customer_code ?? null,
                        phone_number: row.phone_number ?? null,
                        customer_status: row.customer_status ?? 'active',
                        allow_credit: row.allow_credit,
                        credit_limit: row.credit_limit,
                        credit_control_mode: row.credit_control_mode ?? 'block',
                        collection_follow_up_date: row.collection_follow_up_date ?? null,
                        collection_follow_up_note: row.collection_follow_up_note ?? null,
                        assigned_collector_name: row.assigned_collector_name ?? null,
                        total_amount: billedAmount,
                        paid_amount: this.roundMoney(appliedAdvanceAmount + paidAmount),
                        outstanding_amount: outstandingAmount,
                        last_payment_date: null,
                        last_collector_name: null,
                        event_id: row.event_id,
                        event_no: row.event_no,
                        event_title: row.event_title,
                        billing_type: row.billing_type,
                        billing_label: row.billing_label,
                    });
                }
            }
        }

        const documents = documentRows
            .map((row: any) => {
                const agingDate = this.resolveAgingDate(row.due_date, row.document_date);
                return {
                id: Number(row.id),
                branch_id: Number(row.branch_id),
                source_type: row.receivable_source_type,
                document_no: row.document_no,
                document_date: row.document_date,
                due_date: agingDate,
                party_id: row.customer_id ? String(row.customer_id) : null,
                party_name: row.party_name,
                customer_code: row.customer_code ?? null,
                phone_number: row.phone_number ?? null,
                customer_status: row.customer_status ?? 'active',
                allow_credit: Boolean(row.allow_credit),
                credit_limit: this.roundMoney(row.credit_limit ?? 0),
                credit_control_mode: row.credit_control_mode ?? 'block',
                collection_follow_up_date: row.collection_follow_up_date ?? null,
                collection_follow_up_note: row.collection_follow_up_note ?? null,
                assigned_collector_name: row.assigned_collector_name ?? null,
                total_amount: this.roundMoney(row.total_amount),
                paid_amount: this.roundMoney(row.paid_amount),
                outstanding_amount: this.roundMoney(row.outstanding_amount),
                last_payment_date: row.last_payment_date ?? null,
                last_collector_name: row.last_collector_name ?? null,
                event_id: row.event_id ? Number(row.event_id) : null,
                event_no: row.event_no ?? null,
                event_title: row.event_title ?? null,
                billing_type: row.billing_type ?? null,
                billing_label: row.billing_label ?? null,
                days_past_due: this.diffInDays(effectiveDate, agingDate),
            };
            })
            .sort((left: any, right: any) => {
                if (String(left.due_date) === String(right.due_date)) {
                    return Number(left.id ?? 0) - Number(right.id ?? 0);
                }
                return String(left.due_date).localeCompare(String(right.due_date));
            });
        const overdueDocuments = documents.filter((document: any) => Number(document.days_past_due ?? 0) > 0);
        const overdueAmount = this.roundMoney(overdueDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0));
        const topOverdueParty = overdueDocuments.reduce((best: any, document: any) => {
            if (!best || Number(document.outstanding_amount ?? 0) > Number(best.outstanding_amount ?? 0)) {
                return document;
            }
            return best;
        }, null);
        const customerExposureMap = new Map<string, any>();
        for (const document of documents) {
            const key = String(document.party_id ?? document.party_name ?? document.id);
            const current = customerExposureMap.get(key) ?? {
                party_id: document.party_id,
                party_name: document.party_name,
                customer_code: document.customer_code ?? null,
                phone_number: document.phone_number ?? null,
                customer_status: document.customer_status ?? 'active',
                allow_credit: Boolean(document.allow_credit),
                credit_limit: this.roundMoney(document.credit_limit ?? 0),
                credit_control_mode: document.credit_control_mode ?? 'block',
                collection_follow_up_date: document.collection_follow_up_date ?? null,
                collection_follow_up_note: document.collection_follow_up_note ?? null,
                assigned_collector_name: document.assigned_collector_name ?? null,
                outstanding_amount: 0,
                overdue_amount: 0,
                document_count: 0,
                overdue_document_count: 0,
                oldest_due_date: document.due_date,
                max_days_past_due: 0,
                last_payment_date: document.last_payment_date ?? null,
                last_collector_name: document.last_collector_name ?? null,
            };
            current.outstanding_amount = this.roundMoney(
                Number(current.outstanding_amount ?? 0) + Number(document.outstanding_amount ?? 0),
            );
            current.document_count += 1;
            if (!current.oldest_due_date || String(document.due_date) < String(current.oldest_due_date)) {
                current.oldest_due_date = document.due_date;
            }
            if (
                document.last_payment_date
                && (!current.last_payment_date || String(document.last_payment_date) > String(current.last_payment_date))
            ) {
                current.last_payment_date = document.last_payment_date;
                current.last_collector_name = document.last_collector_name ?? current.last_collector_name ?? null;
            }
            current.assigned_collector_name = current.assigned_collector_name ?? document.assigned_collector_name ?? null;
            current.max_days_past_due = Math.max(
                Number(current.max_days_past_due ?? 0),
                Number(document.days_past_due ?? 0),
            );
            if (Number(document.days_past_due ?? 0) > 0) {
                current.overdue_amount = this.roundMoney(
                    Number(current.overdue_amount ?? 0) + Number(document.outstanding_amount ?? 0),
                );
                current.overdue_document_count += 1;
            }
            customerExposureMap.set(key, current);
        }

        const customer_rollup = Array.from(customerExposureMap.values())
            .map((row: any) => {
                const creditLimit = this.roundMoney(row.credit_limit ?? 0);
                const outstandingAmount = this.roundMoney(row.outstanding_amount ?? 0);
                const overdueAmount = this.roundMoney(row.overdue_amount ?? 0);
                const allowCredit = Boolean(row.allow_credit);
                const customerStatus = String(row.customer_status ?? 'active').trim().toLowerCase() || 'active';
                const creditControlMode = String(row.credit_control_mode ?? 'block').trim().toLowerCase() === 'warn' ? 'warn' : 'block';
                const followUpDate = row.collection_follow_up_date ?? null;
                const followUpNote = row.collection_follow_up_note ?? null;
                const isOverLimit = allowCredit && creditLimit > 0 && outstandingAmount - creditLimit > 0.009;
                const isPolicyBreach = !allowCredit && outstandingAmount > 0.009;
                const isStatusBlocked = ['inactive', 'suspended'].includes(customerStatus);
                const followUpDays = followUpDate ? this.diffInDays(effectiveDate, followUpDate) : null;
                const isFollowUpDue = followUpDays != null && followUpDays >= 0;
                const collectionPriority = isStatusBlocked || isPolicyBreach
                    ? 'critical'
                    : isOverLimit || overdueAmount > 0.009 || isFollowUpDue
                        ? 'high'
                        : 'normal';
                const followUpAction = isStatusBlocked
                    ? 'Resolve customer status before extending or carrying more credit.'
                    : isPolicyBreach
                        ? 'Customer has open balance without credit approval.'
                        : isOverLimit && creditControlMode === 'warn'
                            ? 'Credit is configured as warn-only. Collect urgently before further exposure grows.'
                        : isOverLimit
                            ? 'Collect against the balance before new credit sale.'
                            : isFollowUpDue
                                ? 'Scheduled collection follow-up is due now.'
                            : overdueAmount > 0.009
                                ? 'Overdue balance should be followed up now.'
                                : 'Routine collection follow-up only.';
                return {
                    ...row,
                    customer_status: customerStatus,
                    credit_limit: creditLimit,
                    credit_control_mode: creditControlMode,
                    collection_follow_up_date: followUpDate,
                    collection_follow_up_note: followUpNote,
                    assigned_collector_name: row.assigned_collector_name ?? null,
                    outstanding_amount: outstandingAmount,
                    overdue_amount: overdueAmount,
                    utilization_pct: allowCredit && creditLimit > 0
                        ? this.roundMoney((outstandingAmount / creditLimit) * 100)
                        : null,
                    is_over_limit: isOverLimit,
                    is_policy_breach: isPolicyBreach,
                    is_status_blocked: isStatusBlocked,
                    is_follow_up_due: isFollowUpDue,
                    follow_up_days: followUpDays,
                    collection_priority: collectionPriority,
                    follow_up_action: followUpAction,
                };
            })
            .sort((left: any, right: any) => {
                const priorityWeight = (value: string) => value === 'critical' ? 3 : value === 'high' ? 2 : 1;
                const riskDelta = priorityWeight(String(right.collection_priority || 'normal')) - priorityWeight(String(left.collection_priority || 'normal'));
                if (riskDelta !== 0) {
                    return riskDelta;
                }
                const overdueDelta = Number(right.overdue_amount ?? 0) - Number(left.overdue_amount ?? 0);
                if (Math.abs(overdueDelta) > 0.009) {
                    return overdueDelta;
                }
                return Number(right.outstanding_amount ?? 0) - Number(left.outstanding_amount ?? 0);
            });
        const topExposureCustomer = customer_rollup[0] ?? null;
        const collectorExposureMap = new Map<string, any>();
        for (const customer of customer_rollup) {
            const collectorName = String(customer.assigned_collector_name ?? '').trim();
            if (!collectorName) {
                continue;
            }
            const current = collectorExposureMap.get(collectorName) ?? {
                collector_name: collectorName,
                customer_count: 0,
                outstanding_amount: 0,
                overdue_amount: 0,
                follow_up_due_count: 0,
            };
            current.customer_count += 1;
            current.outstanding_amount = this.roundMoney(
                Number(current.outstanding_amount ?? 0) + Number(customer.outstanding_amount ?? 0),
            );
            current.overdue_amount = this.roundMoney(
                Number(current.overdue_amount ?? 0) + Number(customer.overdue_amount ?? 0),
            );
            current.follow_up_due_count += customer.is_follow_up_due ? 1 : 0;
            collectorExposureMap.set(collectorName, current);
        }
        const collector_rollup = Array.from(collectorExposureMap.values()).sort((left: any, right: any) => {
            const overdueDelta = Number(right.overdue_amount ?? 0) - Number(left.overdue_amount ?? 0);
            if (Math.abs(overdueDelta) > 0.009) {
                return overdueDelta;
            }
            return Number(right.outstanding_amount ?? 0) - Number(left.outstanding_amount ?? 0);
        });
        const topCollectorExposure = collector_rollup[0] ?? null;
        const eventDocuments = documents.filter((document: any) => document.source_type === 'catering_event' && document.event_id);
        const eventExposureMap = new Map<string, any>();
        for (const document of eventDocuments) {
            const key = String(document.event_id);
            const current = eventExposureMap.get(key) ?? {
                event_id: document.event_id,
                event_no: document.event_no,
                event_title: document.event_title,
                party_id: document.party_id,
                party_name: document.party_name,
                customer_code: document.customer_code ?? null,
                phone_number: document.phone_number ?? null,
                outstanding_amount: 0,
                overdue_amount: 0,
                billing_count: 0,
                overdue_billing_count: 0,
                max_days_past_due: 0,
                oldest_due_date: document.due_date,
            };
            current.outstanding_amount = this.roundMoney(
                Number(current.outstanding_amount ?? 0) + Number(document.outstanding_amount ?? 0),
            );
            current.billing_count += 1;
            current.max_days_past_due = Math.max(
                Number(current.max_days_past_due ?? 0),
                Number(document.days_past_due ?? 0),
            );
            if (!current.oldest_due_date || String(document.due_date) < String(current.oldest_due_date)) {
                current.oldest_due_date = document.due_date;
            }
            if (Number(document.days_past_due ?? 0) > 0) {
                current.overdue_amount = this.roundMoney(
                    Number(current.overdue_amount ?? 0) + Number(document.outstanding_amount ?? 0),
                );
                current.overdue_billing_count += 1;
            }
            eventExposureMap.set(key, current);
        }
        const event_rollup = Array.from(eventExposureMap.values()).sort((left: any, right: any) => {
            const overdueDelta = Number(right.overdue_amount ?? 0) - Number(left.overdue_amount ?? 0);
            if (Math.abs(overdueDelta) > 0.009) {
                return overdueDelta;
            }
            return Number(right.outstanding_amount ?? 0) - Number(left.outstanding_amount ?? 0);
        });
        const topEventExposure = event_rollup[0] ?? null;
        const sourceSummary = {
            pos_credit_document_count: documents.filter((document: any) => document.source_type === 'pos_credit').length,
            pos_credit_outstanding_amount: this.roundMoney(
                documents
                    .filter((document: any) => document.source_type === 'pos_credit')
                    .reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
            ),
            catering_event_document_count: eventDocuments.length,
            catering_event_outstanding_amount: this.roundMoney(
                eventDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
            ),
        };

        return {
            as_of_date: effectiveDate,
            source_type: normalizedSourceType,
            documents,
            customer_rollup,
            collector_rollup,
            event_rollup,
            summary: {
                document_count: documents.length,
                customer_count: customer_rollup.length,
                overdue_count: overdueDocuments.length,
                overdue_amount: overdueAmount,
                over_limit_customer_count: customer_rollup.filter((customer: any) => customer.is_over_limit).length,
                policy_breach_customer_count: customer_rollup.filter((customer: any) => customer.is_policy_breach).length,
                suspended_customer_count: customer_rollup.filter((customer: any) => customer.customer_status === 'suspended').length,
                inactive_customer_count: customer_rollup.filter((customer: any) => customer.customer_status === 'inactive').length,
                critical_follow_up_count: customer_rollup.filter((customer: any) => customer.collection_priority === 'critical').length,
                follow_up_due_count: customer_rollup.filter((customer: any) => customer.is_follow_up_due).length,
                top_overdue_party_name: topOverdueParty?.party_name ?? null,
                top_overdue_party_amount: topOverdueParty ? this.roundMoney(topOverdueParty.outstanding_amount) : 0,
                top_exposure_customer_name: topExposureCustomer?.party_name ?? null,
                top_exposure_customer_amount: topExposureCustomer ? this.roundMoney(topExposureCustomer.outstanding_amount) : 0,
                top_assigned_collector_name: topCollectorExposure?.collector_name ?? null,
                top_assigned_collector_amount: topCollectorExposure ? this.roundMoney(topCollectorExposure.overdue_amount || topCollectorExposure.outstanding_amount) : 0,
                event_count: event_rollup.length,
                top_event_name: topEventExposure?.event_title ?? null,
                top_event_amount: topEventExposure ? this.roundMoney(topEventExposure.outstanding_amount) : 0,
                ...sourceSummary,
                ...this.buildAgingSummary(documents, effectiveDate),
            },
        };
    }

    async getPayablesAging(clientId: string, branchId?: number, asOfDate?: string, vendorId?: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const effectiveDate = asOfDate ?? this.formatBusinessDate(new Date());
        const grnParams: any[] = [clientId, clientId, effectiveDate];
        const expenseParams: any[] = [clientId, clientId, effectiveDate];
        let grnBranchFilter = '';
        let expenseBranchFilter = '';
        let grnVendorFilter = '';
        let expenseVendorFilter = '';
        if (branchId) {
            grnBranchFilter = ' AND grn.branch_id = ?';
            expenseBranchFilter = ' AND voucher.branch_id = ?';
            grnParams.push(branchId);
            expenseParams.push(branchId);
        }
        if (vendorId) {
            grnVendorFilter = ' AND grn.vendor_id = ?';
            expenseVendorFilter = ' AND voucher.party_id = ?';
            grnParams.push(vendorId);
            expenseParams.push(String(vendorId));
        }

        const [grnRows, expenseVoucherRows] = await Promise.all([
            this.dataSource.query(
                `
                SELECT
                  'grn' AS payable_type,
                  grn.id,
                  grn.branch_id,
                  grn.grn_number AS document_no,
                  DATE(COALESCE(grn.vendor_bill_date, grn.receipt_date)) AS document_date,
                  DATE(COALESCE(grn.vendor_bill_due_date, grn.vendor_bill_date, grn.receipt_date)) AS due_date,
                  grn.vendor_id,
                  COALESCE(v.vendor_name, CONCAT('Vendor #', grn.vendor_id)) AS party_name,
                  GREATEST(COALESCE(grn.vendor_bill_amount, COALESCE(SUM(item.line_total), 0)) - COALESCE(ret.total_returned, 0) - COALESCE(credit.total_credited, 0), 0) AS total_amount,
                  COALESCE(alloc.total_allocated, 0) AS paid_amount,
                  GREATEST(
                    GREATEST(COALESCE(grn.vendor_bill_amount, COALESCE(SUM(item.line_total), 0)) - COALESCE(ret.total_returned, 0) - COALESCE(credit.total_credited, 0), 0)
                    - COALESCE(alloc.total_allocated, 0),
                    0
                  ) AS outstanding_amount,
                  grn.vendor_bill_reference AS reference
                FROM goods_receipt_notes grn
                INNER JOIN goods_receipt_note_items item ON item.grn_id = grn.id
                LEFT JOIN vendors v
                  ON v.id = grn.vendor_id
                 AND v.client_id = grn.client_id
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
                  SELECT
                    grn_id,
                    COALESCE(SUM(allocated_amount), 0) AS total_allocated
                  FROM accounting_payable_allocations
                  WHERE client_id = ?
                    AND grn_id IS NOT NULL
                  GROUP BY grn_id
                ) alloc ON alloc.grn_id = grn.id
                LEFT JOIN (
                  SELECT
                    linked_grn_id,
                    COALESCE(SUM(amount), 0) AS total_credited
                  FROM financial_vouchers
                  WHERE client_id = ?
                    AND type = 'PURCHASE_CREDIT_NOTE'
                    AND status = 'APPROVED'
                    AND linked_grn_id IS NOT NULL
                  GROUP BY linked_grn_id
                ) credit ON credit.linked_grn_id = grn.id
                  WHERE grn.client_id = ?
                    AND DATE(COALESCE(grn.vendor_bill_date, grn.receipt_date)) <= ?
                    AND grn.status = 'posted'
                    AND grn.payable_status = 'bill_received'
                    ${grnBranchFilter}
                    ${grnVendorFilter}
                  GROUP BY
                    grn.id, grn.branch_id, document_no, document_date, due_date,
                    grn.vendor_id, party_name, alloc.total_allocated, credit.total_credited, reference
                HAVING outstanding_amount > 0.009
                `,
                [clientId, clientId, ...grnParams],
            ),
            this.dataSource.query(
                `
                SELECT
                  'expense_voucher' AS payable_type,
                  voucher.id,
                  voucher.branch_id,
                  voucher.voucher_no AS document_no,
                  DATE(voucher.date) AS document_date,
                  DATE(voucher.date) AS due_date,
                  voucher.party_id AS vendor_id,
                  COALESCE(vendor.vendor_name, voucher.party_name, CONCAT('Vendor #', voucher.party_id)) AS party_name,
                  COALESCE(voucher.amount, 0) AS total_amount,
                  COALESCE(alloc.total_allocated, 0) AS paid_amount,
                  GREATEST(COALESCE(voucher.amount, 0) - COALESCE(alloc.total_allocated, 0), 0) AS outstanding_amount,
                  voucher.reference_no AS reference
                FROM financial_vouchers voucher
                LEFT JOIN vendors vendor
                  ON vendor.id = CAST(voucher.party_id AS SIGNED)
                 AND vendor.client_id = voucher.client_id
                LEFT JOIN (
                  SELECT
                    payable_voucher_id,
                    COALESCE(SUM(allocated_amount), 0) AS total_allocated
                  FROM accounting_payable_allocations
                  WHERE client_id = ?
                    AND payable_voucher_id IS NOT NULL
                  GROUP BY payable_voucher_id
                ) alloc ON alloc.payable_voucher_id = voucher.id
                WHERE voucher.client_id = ?
                  AND DATE(voucher.date) <= ?
                  AND voucher.type = 'EXPENSE'
                  AND voucher.status = 'APPROVED'
                  AND voucher.payment_method = 'Credit Purchase'
                  AND voucher.party_type = 'VENDOR'
                  ${expenseBranchFilter}
                  ${expenseVendorFilter}
                  AND GREATEST(COALESCE(voucher.amount, 0) - COALESCE(alloc.total_allocated, 0), 0) > 0.009
                `,
                expenseParams,
            ),
        ]);

        const rows = [...grnRows, ...expenseVoucherRows]
            .sort((a: any, b: any) => {
                const dueComparison = this.resolveAgingDate(a.due_date, a.document_date)
                    .localeCompare(this.resolveAgingDate(b.due_date, b.document_date));
                if (dueComparison !== 0) return dueComparison;
                return Number(a.id) - Number(b.id);
            });

        const documents = rows.map((row: any) => {
            const agingDate = this.resolveAgingDate(row.due_date, row.document_date);
            return {
            id: Number(row.id),
            payable_type: row.payable_type,
            branch_id: Number(row.branch_id),
            document_no: row.document_no,
            document_date: row.document_date,
            due_date: agingDate,
            party_id: row.vendor_id ? String(row.vendor_id) : null,
            party_name: row.party_name,
            reference: row.reference ?? null,
            total_amount: this.roundMoney(row.total_amount),
            paid_amount: this.roundMoney(row.paid_amount),
            outstanding_amount: this.roundMoney(row.outstanding_amount),
            days_past_due: this.diffInDays(effectiveDate, agingDate),
        };
        });
        const overdueDocuments = documents.filter((document: any) => Number(document.days_past_due ?? 0) > 0);
        const overdueAmount = this.roundMoney(overdueDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0));
        const topOverdueParty = overdueDocuments.reduce((best: any, document: any) => {
            if (!best || Number(document.outstanding_amount ?? 0) > Number(best.outstanding_amount ?? 0)) {
                return document;
            }
            return best;
        }, null);
        const grnDocuments = documents.filter((document: any) => document.payable_type === 'grn');
        const expenseVoucherDocuments = documents.filter((document: any) => document.payable_type === 'expense_voucher');
        const grnOverdueDocuments = overdueDocuments.filter((document: any) => document.payable_type === 'grn');
        const expenseVoucherOverdueDocuments = overdueDocuments.filter((document: any) => document.payable_type === 'expense_voucher');
        const grnOutstandingAmount = this.roundMoney(
            grnDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
        );
        const expenseVoucherOutstandingAmount = this.roundMoney(
            expenseVoucherDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
        );
        const grnOverdueAmount = this.roundMoney(
            grnOverdueDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
        );
        const expenseVoucherOverdueAmount = this.roundMoney(
            expenseVoucherOverdueDocuments.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0),
        );
        const payableSourceConcentration = grnOutstandingAmount >= expenseVoucherOutstandingAmount
            ? {
                payable_type: 'grn',
                label: 'Stock / Vendor Bills',
                amount: grnOutstandingAmount,
            }
            : {
                payable_type: 'expense_voucher',
                label: 'Urgent Credit Expenses',
                amount: expenseVoucherOutstandingAmount,
            };

        return {
            as_of_date: effectiveDate,
            documents,
            summary: {
                document_count: documents.length,
                overdue_count: overdueDocuments.length,
                overdue_amount: overdueAmount,
                top_overdue_party_name: topOverdueParty?.party_name ?? null,
                top_overdue_party_amount: topOverdueParty ? this.roundMoney(topOverdueParty.outstanding_amount) : 0,
                grn_document_count: grnDocuments.length,
                grn_outstanding_amount: grnOutstandingAmount,
                grn_overdue_count: grnOverdueDocuments.length,
                grn_overdue_amount: grnOverdueAmount,
                expense_voucher_document_count: expenseVoucherDocuments.length,
                expense_voucher_outstanding_amount: expenseVoucherOutstandingAmount,
                expense_voucher_overdue_count: expenseVoucherOverdueDocuments.length,
                expense_voucher_overdue_amount: expenseVoucherOverdueAmount,
                top_payable_source_type: payableSourceConcentration.amount > 0 ? payableSourceConcentration.payable_type : null,
                top_payable_source_label: payableSourceConcentration.amount > 0 ? payableSourceConcentration.label : null,
                top_payable_source_amount: payableSourceConcentration.amount > 0 ? payableSourceConcentration.amount : 0,
                ...this.buildAgingSummary(documents, effectiveDate),
            },
        };
    }

    async getPayableDocumentDetail(
        clientId: string,
        sourceType: 'grn' | 'expense_voucher',
        sourceId: number,
        accessibleBranchIds?: number[],
    ) {
        if (sourceType === 'expense_voucher') {
            const voucher = await this.dataSource.getRepository(FinancialVoucher).findOne({
                where: { id: sourceId, client_id: clientId, type: VoucherType.EXPENSE },
                relations: ['branch'],
            });
            if (
                !voucher
                || voucher.status !== VoucherStatus.APPROVED
                || voucher.payment_method !== 'Credit Purchase'
                || voucher.party_type !== PartyType.VENDOR
                || (accessibleBranchIds && accessibleBranchIds.length > 0 && !accessibleBranchIds.includes(voucher.branch_id))
            ) {
                throw new NotFoundException('Payable document not found.');
            }

            const allocationRows = await this.dataSource.query(
                `
                SELECT
                  alloc.id,
                  alloc.allocated_amount,
                  alloc.allocation_date,
                  alloc.notes,
                  payment_voucher.id AS voucher_id,
                  payment_voucher.voucher_no,
                  payment_voucher.status AS voucher_status,
                  payment_voucher.payment_method,
                  payment_voucher.payment_source_label,
                  payment_voucher.treasury_account_id,
                  treasury.account_code AS treasury_account_code,
                  treasury.account_name AS treasury_account_name,
                  payment_voucher.reference_no,
                  payment_voucher.date AS voucher_date
                FROM accounting_payable_allocations alloc
                INNER JOIN financial_vouchers payment_voucher
                  ON payment_voucher.id = alloc.voucher_id
                 AND payment_voucher.client_id = alloc.client_id
                LEFT JOIN accounting_coa treasury
                  ON treasury.id = payment_voucher.treasury_account_id
                 AND treasury.client_id = payment_voucher.client_id
                WHERE alloc.client_id = ?
                  AND alloc.payable_voucher_id = ?
                ORDER BY alloc.allocation_date ASC, alloc.id ASC
                `,
                [clientId, sourceId],
            );

            const totalAmount = this.roundMoney(voucher.amount);
            const paidAmount = this.roundMoney(
                allocationRows.reduce((sum: number, row: any) => sum + this.normalizeAmount(row.allocated_amount), 0),
            );

            return {
                document: {
                    payable_type: 'expense_voucher',
                    id: voucher.id,
                    branch_id: voucher.branch_id,
                    branch_name: voucher.branch?.branch_name ?? `Branch ${voucher.branch_id}`,
                    document_no: voucher.voucher_no,
                    vendor_id: voucher.party_id ? Number(voucher.party_id) : null,
                    vendor_name: voucher.party_name ?? `Vendor #${voucher.party_id ?? voucher.id}`,
                    bill_reference: voucher.reference_no ?? null,
                    document_date: String(voucher.date || '').slice(0, 10),
                    due_date: String(voucher.date || '').slice(0, 10),
                    total_amount: totalAmount,
                    paid_amount: paidAmount,
                    outstanding_amount: this.roundMoney(Math.max(totalAmount - paidAmount, 0)),
                    days_past_due: this.diffInDays(this.formatBusinessDate(new Date()), String(voucher.date || '').slice(0, 10)),
                },
                allocations: allocationRows.map((row: any) => ({
                    id: Number(row.id),
                    allocated_amount: this.roundMoney(row.allocated_amount),
                    allocation_date: String(row.allocation_date).slice(0, 10),
                    notes: row.notes ?? null,
                    voucher_id: Number(row.voucher_id),
                    voucher_no: row.voucher_no,
                    voucher_status: row.voucher_status,
                    payment_method: row.payment_method ?? null,
                    payment_source_label: row.payment_source_label ?? null,
                    treasury_account_id: row.treasury_account_id ? Number(row.treasury_account_id) : null,
                    treasury_account_code: row.treasury_account_code ?? null,
                    treasury_account_name: row.treasury_account_name ?? null,
                    reference_no: row.reference_no ?? null,
                    voucher_date: String(row.voucher_date || '').slice(0, 10),
                })),
            };
        }

        const grn = await this.grnRepo.findOne({
            where: { id: sourceId, client_id: clientId },
            relations: ['branch', 'items', 'vendor'],
        });
        if (
            !grn
            || grn.status !== 'posted'
            || grn.payable_status !== 'bill_received'
            || (accessibleBranchIds && accessibleBranchIds.length > 0 && !accessibleBranchIds.includes(grn.branch_id))
        ) {
            throw new NotFoundException('Payable document not found.');
        }

        const allocationRows = await this.dataSource.query(
            `
            SELECT
              alloc.id,
              alloc.allocated_amount,
              alloc.allocation_date,
              alloc.notes,
              voucher.id AS voucher_id,
              voucher.voucher_no,
              voucher.status AS voucher_status,
              voucher.payment_method,
              voucher.payment_source_label,
              voucher.treasury_account_id,
              treasury.account_code AS treasury_account_code,
              treasury.account_name AS treasury_account_name,
              voucher.reference_no,
              voucher.date AS voucher_date
            FROM accounting_payable_allocations alloc
            INNER JOIN financial_vouchers voucher
              ON voucher.id = alloc.voucher_id
             AND voucher.client_id = alloc.client_id
            LEFT JOIN accounting_coa treasury
              ON treasury.id = voucher.treasury_account_id
             AND treasury.client_id = voucher.client_id
            WHERE alloc.client_id = ?
              AND alloc.grn_id = ?
            ORDER BY alloc.allocation_date ASC, alloc.id ASC
            `,
            [clientId, sourceId],
        );

        const returnRows = await this.dataSource.query(
            `
            SELECT
              return_doc.id,
              return_doc.return_number,
              return_doc.return_date,
              return_doc.debit_note_reference,
              return_doc.notes,
              COALESCE(SUM(return_item.line_total), 0) AS total_amount
            FROM goods_receipt_returns return_doc
            INNER JOIN goods_receipt_return_items return_item
              ON return_item.return_id = return_doc.id
            WHERE return_doc.client_id = ?
              AND return_doc.grn_id = ?
              AND return_doc.status = 'posted'
            GROUP BY return_doc.id, return_doc.return_number, return_doc.return_date, return_doc.debit_note_reference, return_doc.notes
            ORDER BY return_doc.return_date DESC, return_doc.id DESC
            `,
            [clientId, sourceId],
        );

        const creditNoteRows = await this.dataSource.query(
            `
            SELECT
              voucher.id,
              voucher.voucher_no,
              voucher.date,
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
            [clientId, sourceId],
        );

        const grossAmount = this.roundMoney(
            (grn.items ?? []).reduce((sum, item) => sum + this.normalizeAmount(item.line_total), 0),
        );
        const returnedAmount = this.roundMoney(
            returnRows.reduce((sum: number, row: any) => sum + this.normalizeAmount(row.total_amount), 0),
        );
        const creditedAmount = this.roundMoney(
            creditNoteRows
                .filter((row: any) => row.status === VoucherStatus.APPROVED)
                .reduce((sum: number, row: any) => sum + this.normalizeAmount(row.amount), 0),
        );
        const billedBaseAmount = this.roundMoney(grn.vendor_bill_amount ?? grossAmount);
        const totalAmount = this.roundMoney(Math.max(billedBaseAmount - returnedAmount - creditedAmount, 0));
        const paidAmount = this.roundMoney(
            allocationRows.reduce((sum: number, row: any) => sum + this.normalizeAmount(row.allocated_amount), 0),
        );
        const dueDate = String(
            grn.vendor_bill_due_date
            || grn.vendor_bill_date
            || grn.receipt_date,
        ).slice(0, 10);

        return {
            document: {
                payable_type: 'grn',
                id: grn.id,
                branch_id: grn.branch_id,
                branch_name: grn.branch?.branch_name ?? `Branch ${grn.branch_id}`,
                document_no: grn.grn_number,
                vendor_id: grn.vendor_id,
                vendor_name: grn.vendor?.vendor_name ?? `Vendor #${grn.vendor_id}`,
                bill_reference: grn.vendor_bill_reference ?? null,
                    document_date: String(grn.vendor_bill_date || grn.receipt_date).slice(0, 10),
                    due_date: dueDate,
                    gross_amount: grossAmount,
                    billed_amount: billedBaseAmount,
                    returned_amount: returnedAmount,
                    credited_amount: creditedAmount,
                    total_amount: totalAmount,
                paid_amount: paidAmount,
                outstanding_amount: this.roundMoney(Math.max(totalAmount - paidAmount, 0)),
                days_past_due: this.diffInDays(this.formatBusinessDate(new Date()), dueDate),
            },
            allocations: allocationRows.map((row: any) => ({
                id: Number(row.id),
                allocated_amount: this.roundMoney(row.allocated_amount),
                allocation_date: String(row.allocation_date).slice(0, 10),
                notes: row.notes ?? null,
                voucher_id: Number(row.voucher_id),
                voucher_no: row.voucher_no,
                voucher_status: row.voucher_status,
                payment_method: row.payment_method ?? null,
                payment_source_label: row.payment_source_label ?? null,
                treasury_account_id: row.treasury_account_id ? Number(row.treasury_account_id) : null,
                treasury_account_code: row.treasury_account_code ?? null,
                treasury_account_name: row.treasury_account_name ?? null,
                reference_no: row.reference_no ?? null,
                voucher_date: String(row.voucher_date || '').slice(0, 10),
            })),
            returns: returnRows.map((row: any) => ({
                id: Number(row.id),
                return_number: row.return_number,
                return_date: String(row.return_date || '').slice(0, 10),
                debit_note_reference: row.debit_note_reference ?? null,
                notes: row.notes ?? null,
                total_amount: this.roundMoney(row.total_amount),
            })),
            credit_notes: creditNoteRows.map((row: any) => ({
                id: Number(row.id),
                voucher_no: row.voucher_no,
                voucher_date: String(row.date || '').slice(0, 10),
                reference_no: row.reference_no ?? null,
                description: row.description ?? null,
                status: row.status,
                amount: this.roundMoney(row.amount),
            })),
        };
    }

    async getPaymentVoucherExceptionsReport(
        clientId: string,
        branchId?: number,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);

        const params: any[] = [clientId];
        let scopeFilter = '';
        if (branchId) {
            scopeFilter = ' AND voucher.branch_id = ?';
            params.push(branchId);
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            scopeFilter = ` AND voucher.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})`;
            params.push(...accessibleBranchIds);
        }

        const rows = await this.dataSource.query(
            `
            SELECT
              voucher.id AS voucher_id,
              voucher.voucher_no,
              voucher.status AS voucher_status,
              voucher.date AS voucher_date,
              voucher.branch_id,
              COALESCE(branch.branch_name, CONCAT('Branch ', voucher.branch_id)) AS branch_name,
              COALESCE(voucher.party_name, CONCAT('Vendor #', voucher.party_id)) AS vendor_name,
              voucher.amount,
              voucher.payment_method,
              voucher.payment_source_label,
              voucher.treasury_account_id,
              treasury.account_code AS treasury_account_code,
              treasury.account_name AS treasury_account_name,
              treasury.is_bank_account,
              treasury.is_cash_account,
              treasury.is_active AS treasury_is_active,
              treasury.scope AS treasury_scope,
              treasury.branch_id AS treasury_branch_id
            FROM financial_vouchers voucher
            LEFT JOIN branches branch
              ON branch.id = voucher.branch_id
             AND branch.client_id = voucher.client_id
            LEFT JOIN accounting_coa treasury
              ON treasury.id = voucher.treasury_account_id
             AND treasury.client_id = voucher.client_id
            WHERE voucher.client_id = ?
              AND voucher.type = 'PAYMENT'
              ${scopeFilter}
            ORDER BY voucher.date DESC, voucher.id DESC
            `,
            params,
        );

        const vouchers = rows.flatMap((row: any) => {
            const issues: string[] = [];
            const method = String(row.payment_method ?? '').trim().toLowerCase();
            const hasTreasury = row.treasury_account_id != null;
            const isBankLike = ['bank transfer', 'cheque', 'check', 'card', 'mobile wallet'].includes(method);

            if (!hasTreasury) issues.push('Missing treasury account.');
            if (!String(row.payment_source_label ?? '').trim()) issues.push('Missing payment source label.');
            if (hasTreasury && row.treasury_is_active === 0) issues.push('Treasury account is inactive.');
            if (hasTreasury && row.treasury_scope === 'branch' && row.treasury_branch_id && Number(row.treasury_branch_id) !== Number(row.branch_id)) {
                issues.push('Treasury account belongs to a different branch.');
            }
            if (method === 'cash' && hasTreasury && Number(row.is_cash_account || 0) !== 1) {
                issues.push('Cash payment is linked to a non-cash treasury account.');
            }
            if (isBankLike && hasTreasury && Number(row.is_bank_account || 0) !== 1) {
                issues.push(`${row.payment_method} payment is linked to a non-bank treasury account.`);
            }

            if (issues.length === 0) return [];

            return [{
                voucher_id: Number(row.voucher_id),
                voucher_no: row.voucher_no,
                voucher_status: row.voucher_status,
                voucher_date: String(row.voucher_date || '').slice(0, 10),
                branch_id: Number(row.branch_id),
                branch_name: row.branch_name,
                vendor_name: row.vendor_name,
                amount: this.roundMoney(row.amount),
                payment_method: row.payment_method ?? null,
                payment_source_label: row.payment_source_label ?? null,
                treasury_account_id: row.treasury_account_id ? Number(row.treasury_account_id) : null,
                treasury_account_code: row.treasury_account_code ?? null,
                treasury_account_name: row.treasury_account_name ?? null,
                issues,
            }];
        });

        return {
            summary: {
                count: vouchers.length,
                pending_count: vouchers.filter((row: any) => row.voucher_status === 'PENDING').length,
                approved_count: vouchers.filter((row: any) => row.voucher_status === 'APPROVED').length,
            },
            vouchers,
        };
    }

    private async getInterBranchSettlementReview(clientId: string, branchId?: number) {
        const queueRows = await this.dataSource.query(
            `
            SELECT
              transfer.id,
              transfer.transfer_no,
              transfer.status,
              transfer.reason_code,
              transfer.finance_reviewed_at,
              transfer.finance_reviewed_by_name,
              transfer.finance_review_notes,
              transfer.source_branch_id,
              source.branch_name AS source_branch_name,
              source.inventory_store_type AS source_branch_store_type,
              transfer.destination_branch_id,
              destination.branch_name AS destination_branch_name,
              destination.inventory_store_type AS destination_branch_store_type,
              COALESCE(SUM(item.dispatched_quantity * item.unit_cost), 0) AS dispatched_amount,
              COALESCE(SUM(item.received_quantity * item.unit_cost), 0) AS received_amount,
              COALESCE(SUM(GREATEST(item.dispatched_quantity - item.received_quantity, 0) * item.unit_cost), 0) AS variance_amount
            FROM inventory_transfers transfer
            LEFT JOIN inventory_transfer_items item
              ON item.transfer_id = transfer.id
            LEFT JOIN branches source
              ON source.id = transfer.source_branch_id
             AND source.client_id = transfer.client_id
            LEFT JOIN branches destination
              ON destination.id = transfer.destination_branch_id
             AND destination.client_id = transfer.client_id
            WHERE transfer.client_id = ?
              ${branchId ? 'AND (transfer.source_branch_id = ? OR transfer.destination_branch_id = ?)' : ''}
              AND transfer.flow_type = 'stock_transfer'
            GROUP BY
              transfer.id,
              transfer.transfer_no,
              transfer.status,
              transfer.reason_code,
              transfer.source_branch_id,
              source.branch_name,
              source.inventory_store_type,
              transfer.destination_branch_id,
              destination.branch_name
              ,destination.inventory_store_type
            ORDER BY transfer.id DESC
            LIMIT 20
            `,
            branchId ? [clientId, branchId, branchId] : [clientId],
        );

        const journalRows = await this.dataSource.query(
            `
            SELECT
              entry.id,
              entry.source_entity_id AS transfer_id,
              entry.source_event,
              entry.branch_id
            FROM accounting_journal_entries entry
            WHERE entry.client_id = ?
              ${branchId ? 'AND entry.branch_id = ?' : ''}
              AND entry.source_module = 'inventory_transfer'
              AND entry.source_entity_type = 'inventory_transfer'
              AND entry.source_event IN ('dispatch_clearing', 'receipt_clearing', 'source_recharge', 'destination_recharge')
            `,
            branchId ? [clientId, branchId] : [clientId],
        );

        const exposureRows = await this.dataSource.query(
            `
            SELECT
              entry.branch_id,
              COALESCE(branch.branch_name, CONCAT('Branch ', entry.branch_id)) AS branch_name,
              COALESCE(SUM(CASE WHEN coa.account_code = '1220' THEN item.debit - item.credit ELSE 0 END), 0) AS receivable_balance,
              COALESCE(SUM(CASE WHEN coa.account_code = '2120' THEN item.credit - item.debit ELSE 0 END), 0) AS payable_balance
            FROM accounting_journal_items item
            INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
            INNER JOIN accounting_coa coa ON coa.id = item.account_id
            LEFT JOIN branches branch
              ON branch.id = entry.branch_id
             AND branch.client_id = entry.client_id
            WHERE entry.client_id = ?
              ${branchId ? 'AND entry.branch_id = ?' : ''}
              AND coa.account_code IN ('1220', '2120')
            GROUP BY entry.branch_id, branch.branch_name
            HAVING ABS(receivable_balance) > 0.009 OR ABS(payable_balance) > 0.009
            ORDER BY (ABS(receivable_balance) + ABS(payable_balance)) DESC, branch_name ASC
            `,
            branchId ? [clientId, branchId] : [clientId],
        );

        const dispatchMap = new Map<number, number>();
        const receiptMap = new Map<number, number>();
        const sourceRechargeMap = new Map<number, number>();
        const destinationRechargeMap = new Map<number, number>();
        for (const row of journalRows) {
            const transferId = Number(row.transfer_id);
            if (row.source_event === 'dispatch_clearing') dispatchMap.set(transferId, Number(row.id));
            if (row.source_event === 'receipt_clearing') receiptMap.set(transferId, Number(row.id));
            if (row.source_event === 'source_recharge') sourceRechargeMap.set(transferId, Number(row.id));
            if (row.source_event === 'destination_recharge') destinationRechargeMap.set(transferId, Number(row.id));
        }

        const queue = queueRows.map((row: any) => {
            const transferId = Number(row.id);
            const dispatchedAmount = this.roundMoney(row.dispatched_amount ?? 0);
            const receivedAmount = this.roundMoney(row.received_amount ?? 0);
            const varianceAmount = this.roundMoney(row.variance_amount ?? 0);
            const hasDispatch = dispatchMap.has(transferId);
            const hasReceipt = receiptMap.has(transferId);
            const reviewCompleted = Boolean(row.finance_reviewed_at);
            const rechargeApplicable = String(row.source_branch_store_type ?? '') === 'central'
                && String(row.destination_branch_store_type ?? '') === 'branch';
            const rechargeAmount = this.roundMoney(
                String(row.status ?? '') === 'in_transit'
                    ? dispatchedAmount
                    : (receivedAmount > 0 ? receivedAmount : dispatchedAmount),
            );
            const rechargePosted = rechargeApplicable
                && sourceRechargeMap.has(transferId)
                && destinationRechargeMap.has(transferId);

            let status = 'not_started';
            let statusLabel = 'Not Started';
            let topNote = 'Transfer finance clearing has not started yet.';

            if (varianceAmount > 0 && hasReceipt) {
                status = 'variance_review';
                statusLabel = 'Variance Review';
                topNote = reviewCompleted
                    ? 'Transfer variance was posted and finance review has been completed.'
                    : 'Transfer received with value variance posted to wastage review.';
            } else if (hasDispatch && hasReceipt) {
                status = 'cleared';
                statusLabel = 'Cleared';
                topNote = 'Dispatch and receipt clearing journals are both posted.';
            } else if (hasDispatch && !hasReceipt) {
                status = 'receipt_posting_pending';
                statusLabel = 'Receipt Posting Pending';
                topNote = 'Dispatch clearing is posted but receipt-side clearing is still pending.';
            } else if (!hasDispatch && ['in_transit', 'received', 'received_with_variance'].includes(String(row.status ?? ''))) {
                status = 'dispatch_posting_pending';
                statusLabel = 'Dispatch Posting Pending';
                topNote = 'Operational transfer exists without dispatch-side clearing journal.';
            }

            if (rechargeApplicable && String(row.status ?? '') !== 'in_transit') {
                topNote = rechargePosted
                    ? `${topNote} Internal recharge is posted for both branches.`
                    : `${topNote} Internal recharge is still pending.`;
            }

            return {
                transfer_id: transferId,
                transfer_no: row.transfer_no,
                status,
                status_label: statusLabel,
                top_note: topNote,
                route: `${row.source_branch_name ?? 'Unknown'} -> ${row.destination_branch_name ?? 'Unknown'}`,
                source_branch_id: Number(row.source_branch_id),
                source_branch_name: row.source_branch_name,
                destination_branch_id: Number(row.destination_branch_id),
                destination_branch_name: row.destination_branch_name,
                review_completed: reviewCompleted,
                reviewed_at: row.finance_reviewed_at ? String(row.finance_reviewed_at).slice(0, 19) : null,
                reviewed_by_name: row.finance_reviewed_by_name ?? null,
                review_notes: row.finance_review_notes ?? null,
                recharge_applicable: rechargeApplicable,
                recharge_amount: rechargeApplicable ? rechargeAmount : 0,
                recharge_status_label: rechargeApplicable
                    ? (String(row.status ?? '') === 'in_transit'
                        ? 'Central Supply In Transit'
                        : (rechargePosted ? 'Internal Recharge Posted' : 'Internal Recharge Pending'))
                    : null,
                recharge_posted: rechargePosted,
                source_recharge_journal_id: sourceRechargeMap.get(transferId) ?? null,
                destination_recharge_journal_id: destinationRechargeMap.get(transferId) ?? null,
                dispatched_amount: dispatchedAmount,
                received_amount: receivedAmount,
                variance_amount: varianceAmount,
                dispatch_journal_id: dispatchMap.get(transferId) ?? null,
                receipt_journal_id: receiptMap.get(transferId) ?? null,
            };
        });

        const financeAttentionQueue = queue.filter((row: any) => row.status !== 'cleared' && !(row.status === 'variance_review' && row.review_completed));
        const branchExposure = exposureRows.map((row: any) => ({
            branch_id: Number(row.branch_id),
            branch_name: row.branch_name,
            receivable_balance: this.roundMoney(row.receivable_balance ?? 0),
            payable_balance: this.roundMoney(row.payable_balance ?? 0),
            net_exposure: this.roundMoney(
                Math.abs(Number(row.receivable_balance ?? 0)) + Math.abs(Number(row.payable_balance ?? 0)),
            ),
        }));
        const rechargeQueue = queue.filter((row: any) => row.recharge_applicable);
        const topRecharge = rechargeQueue
            .slice()
            .sort((left: any, right: any) => Number(right.recharge_amount ?? 0) - Number(left.recharge_amount ?? 0))[0] ?? null;
        const topExposure = branchExposure[0] ?? null;

        return {
            summary: {
                transfer_count: queue.length,
                finance_attention_count: financeAttentionQueue.length,
                in_transit_count: queue.filter((row: any) => row.status === 'receipt_posting_pending').length,
                variance_review_count: queue.filter((row: any) => row.status === 'variance_review').length,
                reviewed_variance_count: queue.filter((row: any) => row.status === 'variance_review' && row.review_completed).length,
                total_receivable_balance: this.roundMoney(
                    branchExposure.reduce((sum: number, row: any) => sum + Number(row.receivable_balance ?? 0), 0),
                ),
                total_payable_balance: this.roundMoney(
                    branchExposure.reduce((sum: number, row: any) => sum + Number(row.payable_balance ?? 0), 0),
                ),
                recharge_candidate_count: rechargeQueue.length,
                recharge_candidate_amount: this.roundMoney(
                    rechargeQueue.reduce((sum: number, row: any) => sum + Number(row.recharge_amount ?? 0), 0),
                ),
                recharge_posted_count: rechargeQueue.filter((row: any) => row.recharge_posted).length,
                recharge_pending_count: rechargeQueue.filter((row: any) => !row.recharge_posted && row.status !== 'in_transit').length,
                top_recharge_branch_name: topRecharge?.destination_branch_name ?? null,
                top_recharge_amount: this.roundMoney(topRecharge?.recharge_amount ?? 0),
                top_exposure_branch_name: topExposure?.branch_name ?? null,
                top_exposure_amount: this.roundMoney(topExposure?.net_exposure ?? 0),
            },
            branch_exposure: branchExposure,
            queue: financeAttentionQueue.slice(0, 8),
        };
    }

    private async getFinanceCloseReadiness(clientId: string, asOfDate: string, branchId?: number) {
        const periodKey = asOfDate.slice(0, 7);
        const checklistItems = branchId
            ? await this.ensureMonthCloseChecklistItems(clientId, branchId, periodKey)
            : [];
        const checklistSummaryPayload = branchId
            ? {
                period_key: periodKey,
                summary: this.summarizeMonthCloseChecklist(checklistItems),
            }
            : null;
        const [payables, paymentExceptions, pendingBillRows, unreconciledVendorPaymentRows, pendingAccruals, closeAdjustmentSchedules, payrollComplianceReview, payrollComplianceFilings, treasuryOverview, merchantSettlementReview] = await Promise.all([
            this.getPayablesAging(clientId, branchId, asOfDate),
            this.getPaymentVoucherExceptionsReport(clientId, branchId),
            this.dataSource.query(
                `
                SELECT
                  COUNT(DISTINCT grn.id) AS pending_bill_count,
                  COALESCE(SUM(item.line_total), 0) AS pending_bill_amount
                FROM goods_receipt_notes grn
                INNER JOIN goods_receipt_note_items item ON item.grn_id = grn.id
                WHERE grn.client_id = ?
                  ${branchId ? 'AND grn.branch_id = ?' : ''}
                  AND grn.status = 'posted'
                  AND grn.payable_status = 'pending_bill'
                  AND DATE(grn.receipt_date) <= ?
                `,
                branchId ? [clientId, branchId, asOfDate] : [clientId, asOfDate],
            ),
            this.dataSource.query(
                `
                SELECT
                  COUNT(*) AS unmatched_vendor_payment_count,
                  COALESCE(SUM(ABS(item.debit - item.credit)), 0) AS unmatched_vendor_payment_amount
                FROM accounting_journal_items item
                INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
                INNER JOIN financial_vouchers voucher
                  ON voucher.id = entry.source_entity_id
                 AND entry.source_entity_type = 'financial_voucher'
                 AND voucher.client_id = entry.client_id
                INNER JOIN accounting_coa treasury
                  ON treasury.id = item.account_id
                 AND treasury.client_id = entry.client_id
                LEFT JOIN accounting_bank_reconciliations recon
                  ON recon.journal_item_id = item.id
                WHERE entry.client_id = ?
                  ${branchId ? 'AND entry.branch_id = ?' : ''}
                  AND DATE(entry.transaction_date) <= ?
                  AND voucher.type = 'PAYMENT'
                  AND treasury.is_bank_account = 1
                  AND recon.id IS NULL
                `,
                branchId ? [clientId, branchId, asOfDate] : [clientId, asOfDate],
            ),
            this.getPendingAccrualSummary(clientId, branchId ?? null, periodKey),
            this.getCloseAdjustmentScheduleSummary(clientId, branchId ?? null, periodKey),
            branchId ? this.getPayrollComplianceReview(clientId, branchId) : Promise.resolve(null),
            branchId ? this.getPayrollComplianceFilings(clientId, branchId) : Promise.resolve({ filings: [] }),
            branchId ? this.getTreasuryOverview(clientId, branchId, [branchId]) : Promise.resolve(null),
            branchId ? this.getMerchantSettlementReview(clientId, branchId, [branchId]) : Promise.resolve(null),
        ]);

        const overduePayables = (payables.documents ?? []).filter((document: any) => Number(document.days_past_due ?? 0) > 0);
        const pendingBillRow = pendingBillRows?.[0] ?? {};
        const unmatchedVendorPaymentRow = unreconciledVendorPaymentRows?.[0] ?? {};
        const currentPeriodPayrollFilings = Array.isArray(payrollComplianceFilings?.filings)
            ? payrollComplianceFilings.filings.filter((filing: any) => (
                String(filing.period_start ?? '') <= asOfDate
                && String(filing.period_end ?? '') >= `${periodKey}-01`
            ))
            : [];
        const statutoryPayableAmount = this.roundMoney(payrollComplianceReview?.balances?.statutory_payable_balance ?? 0);
        const treasuryDepositReview = treasuryOverview?.safe_deposit_review ?? null;
        const overdueSafeHandoverCount = Number(treasuryDepositReview?.overdue_safe_handover_count ?? 0);
        const overdueSafeHandoverAmount = this.roundMoney(treasuryDepositReview?.overdue_safe_handover_amount ?? 0);
        const overdueTransitBatchCount = Number(treasuryDepositReview?.overdue_transit_batch_count ?? 0);
        const overdueTransitAmount = this.roundMoney(treasuryDepositReview?.overdue_transit_amount ?? 0);
        const depositVarianceBatchCount = Number(treasuryDepositReview?.deposit_variance_batch_count ?? 0);
        const depositVarianceAmount = this.roundMoney(treasuryDepositReview?.deposit_variance_amount ?? 0);
        const cashOfficeVarianceReview = treasuryOverview?.cash_office_review?.variance_review ?? null;
        const cashVarianceFollowUpCount = Number(cashOfficeVarianceReview?.variance_count ?? 0);
        const cashVarianceFollowUpAmount = this.roundMoney(cashOfficeVarianceReview?.variance_amount ?? 0);
        const merchantSettlementSummary = merchantSettlementReview?.summary ?? null;
        const agedMerchantSettlementCount = Number(merchantSettlementSummary?.aged_open_receipt_count ?? 0);
        const agedMerchantSettlementAmount = this.roundMoney(merchantSettlementSummary?.aged_open_receipt_amount ?? 0);
        const payrollFilingCount = currentPeriodPayrollFilings.length;
        const payrollOverdueUnfiledCount = Number(payrollComplianceReview?.filing_review?.overdue_unfiled_period_count ?? 0);
        const payrollOverdueDays = Number(payrollComplianceReview?.filing_review?.overdue_days ?? 0);
        const hasUnfiledPayrollCompliance = Boolean(branchId)
            && (
                statutoryPayableAmount > 0.009
                || (Number(payrollComplianceReview?.latest_run?.id ?? 0) > 0 && payrollFilingCount === 0)
            );
        const issues = [
            Number(pendingBillRow.pending_bill_count ?? 0) > 0 ? 'Pending-bill GRNs need vendor invoice capture.' : null,
            overduePayables.length > 0 ? 'Overdue AP remains open and should be reviewed before close.' : null,
            Number(unmatchedVendorPaymentRow.unmatched_vendor_payment_count ?? 0) > 0 ? 'Bank-side vendor payments are still unreconciled.' : null,
            Number(paymentExceptions?.summary?.count ?? 0) > 0 ? 'Treasury source exceptions still exist on payment vouchers.' : null,
            overdueSafeHandoverCount > 0 ? 'Branch-safe handovers are aging without deposit batching.' : null,
            overdueTransitBatchCount > 0 ? 'Deposits in transit are aging without bank clearance.' : null,
            depositVarianceBatchCount > 0 ? 'One or more deposit batches do not fully reconcile to their source handovers.' : null,
            cashVarianceFollowUpCount > 0 ? 'Recent cash-office closes include over/short variances that need follow-up.' : null,
            agedMerchantSettlementCount > 0 ? 'Merchant card and wallet receipts are aging without processor settlement.' : null,
            Number(pendingAccruals?.count ?? 0) > 0 ? 'Pending accrual reversals are still open for the close period.' : null,
            Number(closeAdjustmentSchedules?.overdue_count ?? 0) > 0 ? 'One or more prepaid, deferred, or depreciation close schedules have passed their planned end date and need review.' : null,
            hasUnfiledPayrollCompliance
                ? payrollFilingCount === 0
                    ? payrollOverdueUnfiledCount > 0
                        ? `Payroll statutory filing is overdue by ${payrollOverdueDays} day(s).`
                        : 'Payroll statutory liabilities exist without a filed compliance return for the period.'
                    : 'Payroll statutory liabilities remain open after compliance filing review.'
                : null,
              Number(checklistSummaryPayload?.summary?.pending_count ?? 0) > 0 || Number(checklistSummaryPayload?.summary?.blocked_count ?? 0) > 0
                  ? 'Month-close checklist still has open items.'
                  : null,
        ].filter((value): value is string => Boolean(value));

        return {
            status: issues.length === 0 ? 'ready' : 'attention',
            issue_count: issues.length,
            pending_bill_count: Number(pendingBillRow.pending_bill_count ?? 0),
            pending_bill_amount: this.roundMoney(pendingBillRow.pending_bill_amount ?? 0),
            overdue_payable_count: overduePayables.length,
            overdue_payable_amount: this.roundMoney(overduePayables.reduce((sum: number, document: any) => sum + Number(document.outstanding_amount ?? 0), 0)),
            unreconciled_vendor_payment_count: Number(unmatchedVendorPaymentRow.unmatched_vendor_payment_count ?? 0),
            unreconciled_vendor_payment_amount: this.roundMoney(unmatchedVendorPaymentRow.unmatched_vendor_payment_amount ?? 0),
            treasury_exception_count: Number(paymentExceptions?.summary?.count ?? 0),
            overdue_safe_handover_count: overdueSafeHandoverCount,
            overdue_safe_handover_amount: overdueSafeHandoverAmount,
            overdue_transit_batch_count: overdueTransitBatchCount,
            overdue_transit_amount: overdueTransitAmount,
            deposit_variance_batch_count: depositVarianceBatchCount,
            deposit_variance_amount: depositVarianceAmount,
            cash_variance_follow_up_count: cashVarianceFollowUpCount,
            cash_variance_follow_up_amount: cashVarianceFollowUpAmount,
            aged_merchant_settlement_count: agedMerchantSettlementCount,
            aged_merchant_settlement_amount: agedMerchantSettlementAmount,
            pending_accrual_count: Number(pendingAccruals?.count ?? 0),
            pending_accrual_amount: this.roundMoney(pendingAccruals?.total_amount ?? 0),
            close_adjustment_schedule_count: Number(closeAdjustmentSchedules?.count ?? 0),
            close_adjustment_schedule_amount: this.roundMoney(closeAdjustmentSchedules?.total_amount ?? 0),
            overdue_close_adjustment_count: Number(closeAdjustmentSchedules?.overdue_count ?? 0),
            payroll_compliance_open_item_count: hasUnfiledPayrollCompliance ? 1 : 0,
            payroll_compliance_payable_amount: statutoryPayableAmount,
            payroll_compliance_filing_count: payrollFilingCount,
            payroll_compliance_latest_filing_date: currentPeriodPayrollFilings[0]?.filing_date ?? null,
            payroll_compliance_overdue_unfiled_count: payrollOverdueUnfiledCount,
            payroll_compliance_overdue_days: payrollOverdueDays,
              checklist_pending_count: Number(checklistSummaryPayload?.summary?.pending_count ?? 0),
              checklist_blocked_count: Number(checklistSummaryPayload?.summary?.blocked_count ?? 0),
            top_issue: issues[0] ?? null,
            issues,
        };
    }

    private async generateInterBranchServiceRechargeNo(clientId: string): Promise<string> {
        const latest = await this.interBranchServiceRechargeRepo.findOne({
            where: { client_id: clientId },
            order: { id: 'DESC' },
        });
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const next = String((latest?.id ?? 0) + 1).padStart(4, '0');
        return `ISR-${yy}${mm}-${next}`;
    }

    async createInterBranchServiceRecharge(
        clientId: string,
        dto: CreateInterBranchServiceRechargeDto,
        user: JwtPayload,
        accessibleBranchIds?: number[],
    ) {
        if (dto.source_branch_id === dto.destination_branch_id) {
            throw new BadRequestException('Source and destination branches must be different.');
        }
        if (accessibleBranchIds?.length) {
            if (!accessibleBranchIds.includes(dto.source_branch_id) || !accessibleBranchIds.includes(dto.destination_branch_id)) {
                throw new BadRequestException('You do not have access to both branches for this service recharge.');
            }
        }

        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, dto.source_branch_id, 'post internal service recharge');
        await this.assertBranchBelongsToClient(clientId, dto.destination_branch_id, 'post internal service recharge');

        const rechargeNo = await this.generateInterBranchServiceRechargeNo(clientId);
        const amount = this.roundMoney(dto.amount);
        const transactionDate = new Date(`${dto.service_date}T00:00:00`);
        const description = dto.description.trim();
        const notes = dto.notes?.trim() || null;

        const [
            clearingReceivableAccount,
            clearingPayableAccount,
            serviceIncomeAccount,
            serviceExpenseAccount,
        ] = await Promise.all([
            this.ensureDefaultAccount(clientId, '1220', 'Inter-Branch Clearing Receivable', 'asset'),
            this.ensureDefaultAccount(clientId, '2120', 'Inter-Branch Clearing Payable', 'liability'),
            this.ensureDefaultAccount(clientId, '4320', 'Internal Service Recharge Income', 'revenue'),
            this.ensureDefaultAccount(clientId, '5330', 'Internal Service Recharge Expense', 'expense'),
        ]);

        const sourceJournal = await this.createJournalEntry(
            clientId,
            dto.source_branch_id,
            {
                branch_id: dto.source_branch_id,
                transaction_date: transactionDate,
                business_date: dto.service_date,
                description: `Internal service recharge issued: ${description}`,
                reference_id: rechargeNo,
                source_module: 'inter_branch_service_recharge',
                source_entity_type: 'inter_branch_service_recharge',
                source_entity_id: rechargeNo,
                source_event: 'source_recharge',
                posting_type: 'auto',
                items: [
                    { account_id: clearingReceivableAccount.id, debit: amount, credit: 0 },
                    { account_id: serviceIncomeAccount.id, debit: 0, credit: amount },
                ],
            },
            user,
        );

        const destinationJournal = await this.createJournalEntry(
            clientId,
            dto.destination_branch_id,
            {
                branch_id: dto.destination_branch_id,
                transaction_date: transactionDate,
                business_date: dto.service_date,
                description: `Internal service recharge received: ${description}`,
                reference_id: rechargeNo,
                source_module: 'inter_branch_service_recharge',
                source_entity_type: 'inter_branch_service_recharge',
                source_entity_id: rechargeNo,
                source_event: 'destination_recharge',
                posting_type: 'auto',
                items: [
                    { account_id: serviceExpenseAccount.id, debit: amount, credit: 0 },
                    { account_id: clearingPayableAccount.id, debit: 0, credit: amount },
                ],
            },
            user,
        );

        return this.interBranchServiceRechargeRepo.save(
            this.interBranchServiceRechargeRepo.create({
                client_id: clientId,
                recharge_no: rechargeNo,
                source_branch_id: dto.source_branch_id,
                destination_branch_id: dto.destination_branch_id,
                service_type: dto.service_type,
                description,
                notes,
                service_date: dto.service_date,
                amount,
                source_journal_id: sourceJournal?.id ?? null,
                destination_journal_id: destinationJournal?.id ?? null,
                created_by: resolveActorId(user) ?? null,
                created_by_name: this.resolveActorName(user) ?? null,
            }),
        );
    }

    async getDashboard(clientId: string, branchId?: number) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const today = new Date();
        const todayDate = this.formatBusinessDate(today);
        const monthStart = `${todayDate.slice(0, 8)}01`;
        const periodKey = todayDate.slice(0, 7);
        const [trialBalance, monthlyPl, receivables, payables, recentEntries, currentDayPl, expenseBreakdownRows, trendRows, closeReadiness, periodLock, dayCloseHistory, interBranchSettlement, monthCloseChecklist, pendingAccruals, closeAdjustmentSchedules, laborCostRows, payrollRunSummaryRows, latestPayrollRun, topPayrollBranchRows, payrollComplianceFilings, treasuryOverview, merchantSettlementReview, ownerBranchComparisonRows, ownerExceptionTrendRows, internalServiceRechargeSummaryRows, recentInternalServiceRechargeRows] = await Promise.all([
            this.getTrialBalance(clientId, branchId, todayDate),
            this.getProfitAndLoss(clientId, branchId, monthStart, todayDate),
            this.getReceivablesAging(clientId, branchId, todayDate),
            this.getPayablesAging(clientId, branchId, todayDate),
            this.entryRepo.find({
                where: {
                    client_id: clientId,
                    ...(branchId ? { branch_id: branchId } : {}),
                },
                relations: ['items', 'items.account'],
                order: { transaction_date: 'DESC', id: 'DESC' },
                take: 5,
            }),
            this.getProfitAndLoss(clientId, branchId, todayDate, todayDate),
            this.dataSource.query(
                `
                SELECT
                  coa.account_name AS category,
                  COALESCE(SUM(item.debit - item.credit), 0) AS amount
                FROM accounting_journal_items item
                INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
                INNER JOIN accounting_coa coa ON coa.id = item.account_id
                WHERE entry.client_id = ?
                  ${branchId ? 'AND entry.branch_id = ?' : ''}
                  AND coa.account_type = 'expense'
                  AND entry.transaction_date >= ?
                  AND entry.transaction_date <= ?
                GROUP BY coa.account_name
                HAVING amount > 0.009
                ORDER BY amount DESC
                LIMIT 7
                `,
                branchId ? [clientId, branchId, monthStart, todayDate] : [clientId, monthStart, todayDate],
            ),
            this.dataSource.query(
                `
                SELECT
                  DATE_FORMAT(entry.transaction_date, '%Y-%m') AS month_key,
                  DATE_FORMAT(entry.transaction_date, '%b') AS month_label,
                  COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' THEN item.credit - item.debit ELSE 0 END), 0) AS revenue,
                  COALESCE(SUM(CASE WHEN coa.account_type = 'expense' THEN item.debit - item.credit ELSE 0 END), 0) AS expenses
                FROM accounting_journal_items item
                INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
                INNER JOIN accounting_coa coa ON coa.id = item.account_id
                WHERE entry.client_id = ?
                  ${branchId ? 'AND entry.branch_id = ?' : ''}
                  AND entry.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
                GROUP BY month_key, month_label
                ORDER BY month_key ASC
                `,
                branchId ? [clientId, branchId] : [clientId],
            ),
            this.getFinanceCloseReadiness(clientId, todayDate, branchId),
            this.getPeriodLock(clientId, branchId),
            branchId ? this.getDayCloseHistory(clientId, branchId) : Promise.resolve([]),
            this.getInterBranchSettlementReview(clientId, branchId),
            branchId ? this.getMonthCloseChecklist(clientId, branchId, periodKey) : Promise.resolve(null),
            this.getPendingAccrualSummary(clientId, branchId ?? null, periodKey),
            this.getCloseAdjustmentScheduleSummary(clientId, branchId ?? null, periodKey),
            this.dataSource.query(
                `
                SELECT
                  COALESCE(SUM(item.debit - item.credit), 0) AS labor_cost
                FROM accounting_journal_items item
                INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
                INNER JOIN accounting_coa coa ON coa.id = item.account_id
                WHERE entry.client_id = ?
                  ${branchId ? 'AND entry.branch_id = ?' : ''}
                  AND entry.transaction_date >= ?
                  AND entry.transaction_date <= ?
                  AND coa.account_type = 'expense'
                  AND coa.schedule_code = 'PL_PAYROLL'
                `,
                branchId ? [clientId, branchId, monthStart, todayDate] : [clientId, monthStart, todayDate],
            ),
            this.dataSource.query(
                `
                SELECT
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_net_amount ELSE 0 END), 0) AS accrued_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN COALESCE(run.total_paid_amount, 0) ELSE 0 END), 0) AS paid_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN COALESCE(run.total_payable_balance, run.total_net_amount) ELSE 0 END), 0) AS unpaid_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_income_tax_amount ELSE 0 END), 0) AS income_tax_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_eobi_employee_amount ELSE 0 END), 0) AS eobi_employee_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_eobi_employer_amount ELSE 0 END), 0) AS eobi_employer_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_social_security_employee_amount ELSE 0 END), 0) AS social_security_employee_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_social_security_employer_amount ELSE 0 END), 0) AS social_security_employer_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_employee_compliance_deduction_amount ELSE 0 END), 0) AS employee_compliance_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_employer_contribution_amount ELSE 0 END), 0) AS employer_contribution_amount,
                  COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid') THEN 1 ELSE 0 END), 0) AS approved_unpaid_runs,
                  COALESCE(SUM(CASE WHEN run.status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_runs,
                  COALESCE(SUM(CASE WHEN run.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_runs,
                  COALESCE(SUM(CASE WHEN run.status IN ('draft', 'approved', 'paid') THEN run.employee_count ELSE 0 END), 0) AS covered_employee_count
                FROM accounting_payroll_runs run
                WHERE run.client_id = ?
                  ${branchId ? 'AND run.branch_id = ?' : ''}
                  AND run.pay_date >= ?
                  AND run.pay_date <= ?
                `,
                branchId ? [clientId, branchId, monthStart, todayDate] : [clientId, monthStart, todayDate],
            ),
            this.payrollRunRepo.findOne({
                where: {
                    client_id: clientId,
                    ...(branchId ? { branch_id: branchId } : {}),
                },
                relations: ['branch'],
                order: {
                    pay_date: 'DESC',
                    id: 'DESC',
                },
            }),
            branchId
                ? Promise.resolve([])
                : this.dataSource.query(
                    `
                    SELECT
                      branch.branch_name,
                      COALESCE(SUM(CASE WHEN run.status IN ('approved', 'partially_paid', 'paid') THEN run.total_net_amount ELSE 0 END), 0) AS labor_cost
                    FROM accounting_payroll_runs run
                    INNER JOIN branches branch ON branch.id = run.branch_id
                    WHERE run.client_id = ?
                      AND run.pay_date >= ?
                      AND run.pay_date <= ?
                    GROUP BY branch.id, branch.branch_name
                    HAVING labor_cost > 0.009
                    ORDER BY labor_cost DESC
                    LIMIT 1
                    `,
                    [clientId, monthStart, todayDate],
                ),
            branchId ? this.getPayrollComplianceFilings(clientId, branchId) : Promise.resolve({ filings: [] }),
            this.getTreasuryOverview(clientId, branchId),
            this.getMerchantSettlementReview(clientId, branchId),
            branchId
                ? Promise.resolve([])
                : this.dataSource.query(
                    `
                    SELECT
                      branch.id AS branch_id,
                      branch.branch_name,
                      COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' AND entry.transaction_date >= ? AND entry.transaction_date <= ? THEN item.credit - item.debit ELSE 0 END), 0) AS revenue,
                      COALESCE(SUM(CASE WHEN coa.account_type = 'expense' AND entry.transaction_date >= ? AND entry.transaction_date <= ? THEN item.debit - item.credit ELSE 0 END), 0) AS expenses,
                      COALESCE(SUM(CASE WHEN coa.account_code = '1200' THEN item.debit - item.credit ELSE 0 END), 0) AS receivables_balance,
                      COALESCE(SUM(CASE WHEN coa.account_code IN ('2100', '2110') THEN item.credit - item.debit ELSE 0 END), 0) AS payables_balance,
                      COALESCE(SUM(CASE WHEN coa.is_cash_account = 1 OR coa.account_code = '1101' THEN item.debit - item.credit ELSE 0 END), 0) AS cash_balance,
                      COALESCE(SUM(CASE WHEN coa.is_bank_account = 1 OR coa.account_code = '1102' THEN item.debit - item.credit ELSE 0 END), 0) AS bank_balance,
                      COALESCE((
                        SELECT COUNT(*)
                        FROM goods_receipt_notes grn
                        WHERE grn.client_id = branch.client_id
                          AND grn.branch_id = branch.id
                          AND grn.payable_status = 'pending_bill'
                      ), 0) AS pending_bill_count,
                      COALESCE((
                        SELECT COUNT(*)
                        FROM accounting_treasury_exceptions tex
                        WHERE tex.client_id = branch.client_id
                          AND tex.branch_id = branch.id
                          AND tex.status IN ('open', 'in_review')
                      ), 0) AS treasury_exception_count,
                      COALESCE((
                        SELECT COUNT(*)
                        FROM accounting_day_closes close_row
                        WHERE close_row.client_id = branch.client_id
                          AND close_row.branch_id = branch.id
                          AND ABS(close_row.cash_variance_amount) > 0.009
                          AND close_row.business_date >= DATE_SUB(?, INTERVAL 30 DAY)
                      ), 0) AS cash_variance_count
                    FROM branches branch
                    LEFT JOIN accounting_journal_entries entry
                      ON entry.client_id = branch.client_id
                     AND entry.branch_id = branch.id
                    LEFT JOIN accounting_journal_items item
                      ON item.entry_id = entry.id
                    LEFT JOIN accounting_coa coa
                      ON coa.id = item.account_id
                    WHERE branch.client_id = ?
                    GROUP BY branch.id, branch.branch_name
                    ORDER BY revenue DESC, branch.branch_name ASC
                    `,
                    [monthStart, todayDate, monthStart, todayDate, todayDate, clientId],
                ),
            branchId
                ? Promise.resolve([])
                : this.dataSource.query(
                    `
                    SELECT
                      metric.month_key,
                      DATE_FORMAT(STR_TO_DATE(CONCAT(metric.month_key, '-01'), '%Y-%m-%d'), '%b') AS month_label,
                      SUM(metric.cash_variance_count) AS cash_variance_count,
                      SUM(metric.treasury_exception_opened_count) AS treasury_exception_opened_count,
                      SUM(metric.period_reopen_count) AS period_reopen_count
                    FROM (
                      SELECT
                        DATE_FORMAT(close_row.business_date, '%Y-%m') AS month_key,
                        COUNT(*) AS cash_variance_count,
                        0 AS treasury_exception_opened_count,
                        0 AS period_reopen_count
                      FROM accounting_day_closes close_row
                      WHERE close_row.client_id = ?
                        AND close_row.business_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
                        AND ABS(close_row.cash_variance_amount) > 0.009
                      GROUP BY DATE_FORMAT(close_row.business_date, '%Y-%m')

                      UNION ALL

                      SELECT
                        DATE_FORMAT(tex.created_at, '%Y-%m') AS month_key,
                        0 AS cash_variance_count,
                        COUNT(*) AS treasury_exception_opened_count,
                        0 AS period_reopen_count
                      FROM accounting_treasury_exceptions tex
                      WHERE tex.client_id = ?
                        AND tex.created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
                      GROUP BY DATE_FORMAT(tex.created_at, '%Y-%m')

                      UNION ALL

                      SELECT
                        DATE_FORMAT(lock_row.last_reopened_at, '%Y-%m') AS month_key,
                        0 AS cash_variance_count,
                        0 AS treasury_exception_opened_count,
                        COUNT(*) AS period_reopen_count
                      FROM accounting_period_locks lock_row
                      WHERE lock_row.client_id = ?
                        AND lock_row.last_reopened_at IS NOT NULL
                        AND lock_row.last_reopened_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
                      GROUP BY DATE_FORMAT(lock_row.last_reopened_at, '%Y-%m')
                    ) metric
                    GROUP BY metric.month_key
                    ORDER BY metric.month_key ASC
                    `,
                    [clientId, clientId, clientId],
                ),
            this.dataSource.query(
                `
                SELECT
                  COALESCE(SUM(CASE WHEN recharge.service_date >= ? AND recharge.service_date <= ? THEN recharge.amount ELSE 0 END), 0) AS current_period_amount,
                  COALESCE(SUM(CASE WHEN recharge.service_date >= ? AND recharge.service_date <= ? THEN 1 ELSE 0 END), 0) AS current_period_count,
                  (
                    SELECT source_branch.branch_name
                    FROM accounting_inter_branch_service_recharges recharge_source
                    INNER JOIN branches source_branch ON source_branch.id = recharge_source.source_branch_id
                    WHERE recharge_source.client_id = ?
                      ${branchId ? 'AND (recharge_source.source_branch_id = ? OR recharge_source.destination_branch_id = ?)' : ''}
                      AND recharge_source.service_date >= ?
                      AND recharge_source.service_date <= ?
                    GROUP BY source_branch.id, source_branch.branch_name
                    ORDER BY SUM(recharge_source.amount) DESC
                    LIMIT 1
                  ) AS top_source_branch_name,
                  (
                    SELECT destination_branch.branch_name
                    FROM accounting_inter_branch_service_recharges recharge_destination
                    INNER JOIN branches destination_branch ON destination_branch.id = recharge_destination.destination_branch_id
                    WHERE recharge_destination.client_id = ?
                      ${branchId ? 'AND (recharge_destination.source_branch_id = ? OR recharge_destination.destination_branch_id = ?)' : ''}
                      AND recharge_destination.service_date >= ?
                      AND recharge_destination.service_date <= ?
                    GROUP BY destination_branch.id, destination_branch.branch_name
                    ORDER BY SUM(recharge_destination.amount) DESC
                    LIMIT 1
                  ) AS top_destination_branch_name
                FROM accounting_inter_branch_service_recharges recharge
                WHERE recharge.client_id = ?
                  ${branchId ? 'AND (recharge.source_branch_id = ? OR recharge.destination_branch_id = ?)' : ''}
                `,
                branchId
                    ? [monthStart, todayDate, monthStart, todayDate, clientId, branchId, branchId, monthStart, todayDate, clientId, branchId, branchId, monthStart, todayDate, clientId, branchId, branchId]
                    : [monthStart, todayDate, monthStart, todayDate, clientId, monthStart, todayDate, clientId, monthStart, todayDate, clientId],
            ),
            this.dataSource.query(
                `
                SELECT
                  recharge.id,
                  recharge.recharge_no,
                  recharge.service_type,
                  recharge.description,
                  recharge.notes,
                  recharge.service_date,
                  recharge.amount,
                  recharge.source_journal_id,
                  recharge.destination_journal_id,
                  recharge.created_by_name,
                  recharge.created_at,
                  source_branch.branch_name AS source_branch_name,
                  destination_branch.branch_name AS destination_branch_name
                FROM accounting_inter_branch_service_recharges recharge
                INNER JOIN branches source_branch ON source_branch.id = recharge.source_branch_id
                INNER JOIN branches destination_branch ON destination_branch.id = recharge.destination_branch_id
                WHERE recharge.client_id = ?
                  ${branchId ? 'AND (recharge.source_branch_id = ? OR recharge.destination_branch_id = ?)' : ''}
                ORDER BY recharge.service_date DESC, recharge.id DESC
                LIMIT 6
                `,
                branchId ? [clientId, branchId, branchId] : [clientId],
            ),
        ]);

        const cashBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.is_cash_account || account.account_code === '1101')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const bankBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.is_bank_account || account.account_code === '1102')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const payrollPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2210')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const withholdingTaxPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2302')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const eobiPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2303')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const socialSecurityPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2304')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const currentPeriodLaborCost = this.roundMoney(laborCostRows?.[0]?.labor_cost ?? 0);
        const payrollRunSummary = payrollRunSummaryRows?.[0] ?? {};
        const laborCostRatio = this.normalizeAmount(monthlyPl.summary.total_revenue) > 0
            ? (currentPeriodLaborCost / this.normalizeAmount(monthlyPl.summary.total_revenue)) * 100
            : 0;
        const topPayrollBranch = topPayrollBranchRows?.[0] ?? null;
        const statutoryPayableBalance = this.roundMoney(
            withholdingTaxPayableBalance + eobiPayableBalance + socialSecurityPayableBalance,
        );
        const currentPeriodPayrollFilings = Array.isArray(payrollComplianceFilings?.filings)
            ? payrollComplianceFilings.filings.filter((filing: any) => (
                String(filing.period_start ?? '') <= todayDate
                && String(filing.period_end ?? '') >= monthStart
            ))
            : [];
        const latestPayrollComplianceFiling = currentPeriodPayrollFilings[0] ?? null;
        const payrollComplianceUnfiledPeriodCount = branchId
            ? ((statutoryPayableBalance > 0.009 || latestPayrollRun) && currentPeriodPayrollFilings.length === 0 ? 1 : 0)
            : 0;
        const treasuryDepositReview = treasuryOverview?.safe_deposit_review ?? {};
        const cashOfficeVarianceReview = treasuryOverview?.cash_office_review?.variance_review ?? {};
        const merchantSettlementSummary = merchantSettlementReview?.summary ?? {};
        const merchantProviderSummary = Array.isArray(merchantSettlementReview?.provider_summary)
            ? merchantSettlementReview.provider_summary
            : [];
        const treasuryExceptionWorkflow = await this.buildTreasuryExceptionWorkflowPayload(
            clientId,
            this.buildLiveTreasuryExceptions(treasuryOverview, merchantSettlementReview),
        );
        const yearEndGovernance = this.buildYearEndGovernance(periodKey, monthCloseChecklist, closeReadiness, periodLock);
        const ownerBranchComparison = Array.isArray(ownerBranchComparisonRows)
            ? ownerBranchComparisonRows.map((row: any) => {
                const revenue = this.roundMoney(row.revenue ?? 0);
                const expenses = this.roundMoney(row.expenses ?? 0);
                const netProfit = this.roundMoney(revenue - expenses);
                const marginPercent = revenue > 0.009 ? this.roundMoney((netProfit / revenue) * 100) : 0;
                const blockerCount = Number(row.pending_bill_count ?? 0)
                    + Number(row.treasury_exception_count ?? 0)
                    + Number(row.cash_variance_count ?? 0);

                return {
                    branch_id: Number(row.branch_id),
                    branch_name: row.branch_name,
                    revenue,
                    expenses,
                    net_profit: netProfit,
                    margin_percent: marginPercent,
                    receivables_balance: this.roundMoney(row.receivables_balance ?? 0),
                    payables_balance: this.roundMoney(row.payables_balance ?? 0),
                    cash_balance: this.roundMoney(row.cash_balance ?? 0),
                    bank_balance: this.roundMoney(row.bank_balance ?? 0),
                    pending_bill_count: Number(row.pending_bill_count ?? 0),
                    treasury_exception_count: Number(row.treasury_exception_count ?? 0),
                    cash_variance_count: Number(row.cash_variance_count ?? 0),
                    blocker_count: blockerCount,
                };
            })
            : [];
        const profitableBranchCount = ownerBranchComparison.filter((row: any) => Number(row.net_profit ?? 0) > 0.009).length;
        const branchesWithCloseBlockers = ownerBranchComparison.filter((row: any) => Number(row.blocker_count ?? 0) > 0).length;
        const branchesWithReceivablesPressure = ownerBranchComparison.filter((row: any) => Number(row.receivables_balance ?? 0) > Number(row.revenue ?? 0) * 0.35).length;
        const topMarginBranch = ownerBranchComparison
            .filter((row: any) => Number(row.revenue ?? 0) > 0.009)
            .sort((a: any, b: any) => Number(b.margin_percent ?? 0) - Number(a.margin_percent ?? 0))[0] ?? null;
        const weakestMarginBranch = ownerBranchComparison
            .filter((row: any) => Number(row.revenue ?? 0) > 0.009)
            .sort((a: any, b: any) => Number(a.margin_percent ?? 0) - Number(b.margin_percent ?? 0))[0] ?? null;
        const topCashBranch = ownerBranchComparison
            .sort((a: any, b: any) => (Number(b.cash_balance ?? 0) + Number(b.bank_balance ?? 0)) - (Number(a.cash_balance ?? 0) + Number(a.bank_balance ?? 0)))[0] ?? null;
        const ownerExceptionTrend = Array.isArray(ownerExceptionTrendRows)
            ? ownerExceptionTrendRows.map((row: any) => ({
                month: row.month_label,
                cash_variances: Number(row.cash_variance_count ?? 0),
                treasury_exceptions: Number(row.treasury_exception_opened_count ?? 0),
                reopens: Number(row.period_reopen_count ?? 0),
            }))
            : [];
        const internalServiceRechargeSummary = internalServiceRechargeSummaryRows?.[0] ?? {};
        const internalServiceRecharges = Array.isArray(recentInternalServiceRechargeRows)
            ? recentInternalServiceRechargeRows.map((row: any) => ({
                id: Number(row.id),
                recharge_no: row.recharge_no,
                service_type: row.service_type,
                description: row.description,
                notes: row.notes ?? null,
                service_date: row.service_date,
                amount: this.roundMoney(row.amount ?? 0),
                source_journal_id: row.source_journal_id ?? null,
                destination_journal_id: row.destination_journal_id ?? null,
                created_by_name: row.created_by_name ?? null,
                created_at: row.created_at,
                source_branch_name: row.source_branch_name,
                destination_branch_name: row.destination_branch_name,
            }))
            : [];

        const latestDayClose = Array.isArray(dayCloseHistory) && dayCloseHistory.length > 0 ? dayCloseHistory[0] : null;

        return {
            summary: {
                cash_balance: this.roundMoney(cashBalance),
                bank_balance: this.roundMoney(bankBalance),
                daily_revenue: this.roundMoney(currentDayPl.summary.total_revenue),
                monthly_revenue: this.roundMoney(monthlyPl.summary.total_revenue),
                monthly_expenses: this.roundMoney(monthlyPl.summary.total_expenses),
                net_profit: this.roundMoney(monthlyPl.summary.net_profit),
                receivables_outstanding: this.roundMoney(receivables.summary.total_outstanding),
                receivables_count: receivables.summary.document_count,
                receivables_critical_customer_count: Number(receivables.summary.critical_follow_up_count ?? 0),
                receivables_follow_up_due_count: Number(receivables.summary.follow_up_due_count ?? 0),
                receivables_over_limit_customer_count: Number(receivables.summary.over_limit_customer_count ?? 0),
                receivables_policy_breach_customer_count: Number(receivables.summary.policy_breach_customer_count ?? 0),
                receivables_top_priority_customer_name: receivables.summary.top_exposure_customer_name ?? null,
                receivables_top_priority_action: receivables.customer_rollup?.[0]?.follow_up_action ?? null,
                close_adjustment_schedule_count: Number(closeAdjustmentSchedules?.count ?? 0),
                prepaid_schedule_count: Number(closeAdjustmentSchedules?.prepaid_count ?? 0),
                deferred_schedule_count: Number(closeAdjustmentSchedules?.deferred_count ?? 0),
                depreciation_schedule_count: Number(closeAdjustmentSchedules?.depreciation_count ?? 0),
                close_adjustment_schedule_amount: this.roundMoney(closeAdjustmentSchedules?.total_amount ?? 0),
                payables_outstanding: this.roundMoney(payables.summary.total_outstanding),
                payables_count: payables.summary.document_count,
                payables_grn_outstanding: this.roundMoney(payables.summary.grn_outstanding_amount),
                payables_grn_count: Number(payables.summary.grn_document_count ?? 0),
                payables_expense_voucher_outstanding: this.roundMoney(payables.summary.expense_voucher_outstanding_amount),
                payables_expense_voucher_count: Number(payables.summary.expense_voucher_document_count ?? 0),
                payables_top_source_label: payables.summary.top_payable_source_label ?? null,
                payables_top_source_amount: this.roundMoney(payables.summary.top_payable_source_amount ?? 0),
                payroll_payable_balance: this.roundMoney(payrollPayableBalance),
                payroll_statutory_payable_balance: statutoryPayableBalance,
                labor_cost_current_period: currentPeriodLaborCost,
                labor_cost_ratio_percent: this.roundMoney(laborCostRatio),
            },
            revenue_trend: trendRows.map((row: any) => ({
                month: row.month_label,
                revenue: this.roundMoney(row.revenue),
                expenses: this.roundMoney(row.expenses),
            })),
            receivables_aging: [
                { name: 'Current', value: receivables.summary.current },
                { name: '1-30 Days', value: receivables.summary.days_1_30 },
                { name: '31-60 Days', value: receivables.summary.days_31_60 },
                { name: '61-90 Days', value: receivables.summary.days_61_90 },
                { name: '90+ Days', value: receivables.summary.days_90_plus },
            ],
            expense_breakdown: expenseBreakdownRows.map((row: any) => ({
                category: row.category,
                amount: this.roundMoney(row.amount),
            })),
            recent_journal_entries: recentEntries.map((entry) => ({
                id: entry.id,
                business_date: entry.business_date,
                transaction_date: entry.transaction_date,
                description: entry.description,
                total_debit: this.roundMoney(entry.total_debit),
                total_credit: this.roundMoney(entry.total_credit),
                source_module: entry.source_module,
            })),
            period_lock: periodLock,
            latest_day_close: latestDayClose,
            close_readiness: closeReadiness,
            inter_branch_settlement: interBranchSettlement,
            month_close_checklist: monthCloseChecklist,
            pending_accruals: pendingAccruals,
            close_adjustment_schedules: closeAdjustmentSchedules,
            year_end_governance: yearEndGovernance,
            labor_costing: {
                current_period_labor_cost: currentPeriodLaborCost,
                payroll_payable_balance: this.roundMoney(payrollPayableBalance),
                labor_cost_ratio_percent: this.roundMoney(laborCostRatio),
                current_period_payroll_accrued: this.roundMoney(payrollRunSummary.accrued_amount ?? 0),
                current_period_payroll_paid: this.roundMoney(payrollRunSummary.paid_amount ?? 0),
                current_period_payroll_unpaid: this.roundMoney(payrollRunSummary.unpaid_amount ?? 0),
                current_period_employee_compliance_amount: this.roundMoney(payrollRunSummary.employee_compliance_amount ?? 0),
                current_period_employer_contribution_amount: this.roundMoney(payrollRunSummary.employer_contribution_amount ?? 0),
                approved_unpaid_runs: Number(payrollRunSummary.approved_unpaid_runs ?? 0),
                paid_runs: Number(payrollRunSummary.paid_runs ?? 0),
                draft_runs: Number(payrollRunSummary.draft_runs ?? 0),
                covered_employee_count: Number(payrollRunSummary.covered_employee_count ?? 0),
                latest_run: latestPayrollRun ? {
                    id: latestPayrollRun.id,
                    run_no: latestPayrollRun.run_no,
                    branch_id: latestPayrollRun.branch_id,
                    branch_name: latestPayrollRun.branch?.branch_name ?? null,
                    status: latestPayrollRun.status,
                    pay_date: latestPayrollRun.pay_date,
                    employee_count: Number(latestPayrollRun.employee_count ?? 0),
                    total_net_amount: this.roundMoney(latestPayrollRun.total_net_amount ?? 0),
                } : null,
                top_branch_name: topPayrollBranch?.branch_name ?? null,
                top_branch_labor_cost: this.roundMoney(topPayrollBranch?.labor_cost ?? 0),
            },
            payroll_compliance: {
                withholding_tax_payable_balance: this.roundMoney(withholdingTaxPayableBalance),
                eobi_payable_balance: this.roundMoney(eobiPayableBalance),
                social_security_payable_balance: this.roundMoney(socialSecurityPayableBalance),
                statutory_payable_balance: statutoryPayableBalance,
                current_period_income_tax_amount: this.roundMoney(payrollRunSummary.income_tax_amount ?? 0),
                current_period_eobi_employee_amount: this.roundMoney(payrollRunSummary.eobi_employee_amount ?? 0),
                current_period_eobi_employer_amount: this.roundMoney(payrollRunSummary.eobi_employer_amount ?? 0),
                current_period_social_security_employee_amount: this.roundMoney(payrollRunSummary.social_security_employee_amount ?? 0),
                current_period_social_security_employer_amount: this.roundMoney(payrollRunSummary.social_security_employer_amount ?? 0),
                current_period_employee_compliance_amount: this.roundMoney(payrollRunSummary.employee_compliance_amount ?? 0),
                current_period_employer_contribution_amount: this.roundMoney(payrollRunSummary.employer_contribution_amount ?? 0),
                unfiled_period_count: payrollComplianceUnfiledPeriodCount,
                overdue_unfiled_period_count: Number(closeReadiness?.payroll_compliance_overdue_unfiled_count ?? 0),
                overdue_days: Number(closeReadiness?.payroll_compliance_overdue_days ?? 0),
                filing_count: currentPeriodPayrollFilings.length,
                latest_filing_date: latestPayrollComplianceFiling?.filing_date ?? null,
                latest_filing_reference: latestPayrollComplianceFiling?.filing_reference ?? null,
                latest_run: latestPayrollRun ? {
                    id: latestPayrollRun.id,
                    run_no: latestPayrollRun.run_no,
                    branch_id: latestPayrollRun.branch_id,
                    branch_name: latestPayrollRun.branch?.branch_name ?? null,
                    status: latestPayrollRun.status,
                    pay_date: latestPayrollRun.pay_date,
                } : null,
            },
            treasury_deposit_exceptions: {
                cash_variance_follow_up_count: Number(cashOfficeVarianceReview?.variance_count ?? 0),
                cash_variance_follow_up_amount: this.roundMoney(cashOfficeVarianceReview?.variance_amount ?? 0),
                cash_shortage_count: Number(cashOfficeVarianceReview?.shortage_count ?? 0),
                cash_overage_count: Number(cashOfficeVarianceReview?.overage_count ?? 0),
                top_cash_variance_date: cashOfficeVarianceReview?.top_variance_date ?? null,
                top_cash_variance_amount: this.roundMoney(cashOfficeVarianceReview?.top_variance_amount ?? 0),
                top_cash_variance_branch_name: cashOfficeVarianceReview?.top_variance_branch_name ?? null,
                overdue_safe_handover_count: Number(treasuryDepositReview?.overdue_safe_handover_count ?? 0),
                overdue_safe_handover_amount: this.roundMoney(treasuryDepositReview?.overdue_safe_handover_amount ?? 0),
                overdue_transit_batch_count: Number(treasuryDepositReview?.overdue_transit_batch_count ?? 0),
                overdue_transit_amount: this.roundMoney(treasuryDepositReview?.overdue_transit_amount ?? 0),
                deposit_variance_batch_count: Number(treasuryDepositReview?.deposit_variance_batch_count ?? 0),
                deposit_variance_amount: this.roundMoney(treasuryDepositReview?.deposit_variance_amount ?? 0),
                open_handover_count: Number(treasuryDepositReview?.open_handover_count ?? 0),
                open_handover_amount: this.roundMoney(treasuryDepositReview?.open_handover_amount ?? 0),
                open_transit_batch_count: Number(treasuryDepositReview?.open_transit_batch_count ?? 0),
                open_transit_amount: this.roundMoney(treasuryDepositReview?.open_transit_amount ?? 0),
                top_issue: treasuryDepositReview?.top_issue ?? null,
                top_overdue_safe_reference: treasuryDepositReview?.top_overdue_safe_reference ?? null,
                top_overdue_transit_reference: treasuryDepositReview?.top_overdue_transit_reference ?? null,
                top_deposit_variance_reference: treasuryDepositReview?.top_deposit_variance_reference ?? null,
                aged_merchant_settlement_count: Number(merchantSettlementSummary?.aged_open_receipt_count ?? 0),
                aged_merchant_settlement_amount: this.roundMoney(merchantSettlementSummary?.aged_open_receipt_amount ?? 0),
                top_aged_merchant_reference: merchantSettlementSummary?.top_aged_reference ?? null,
                top_aged_merchant_days: Number(merchantSettlementSummary?.top_aged_days ?? 0),
                merchant_provider_count: Number(merchantSettlementSummary?.provider_count ?? 0),
                top_merchant_provider_name: merchantSettlementSummary?.top_provider_name ?? null,
                top_merchant_provider_channel_label: merchantSettlementSummary?.top_provider_channel_label ?? null,
                top_merchant_provider_amount: this.roundMoney(merchantSettlementSummary?.top_provider_settlement_amount ?? 0),
                top_merchant_shortfall_name: merchantSettlementSummary?.top_provider_shortfall_name ?? null,
                top_merchant_shortfall_channel_label: merchantSettlementSummary?.top_provider_shortfall_channel_label ?? null,
                top_merchant_shortfall_amount: this.roundMoney(merchantSettlementSummary?.top_provider_shortfall_amount ?? 0),
                merchant_provider_summary: merchantProviderSummary.slice(0, 4),
            },
            treasury_exception_workflow: treasuryExceptionWorkflow,
            internal_service_recharges: {
                summary: {
                    current_period_amount: this.roundMoney(internalServiceRechargeSummary?.current_period_amount ?? 0),
                    current_period_count: Number(internalServiceRechargeSummary?.current_period_count ?? 0),
                    top_source_branch_name: internalServiceRechargeSummary?.top_source_branch_name ?? null,
                    top_destination_branch_name: internalServiceRechargeSummary?.top_destination_branch_name ?? null,
                },
                recent: internalServiceRecharges,
            },
            ownership_overview: branchId ? null : {
                rollup: {
                    branch_count: ownerBranchComparison.length,
                    profitable_branch_count: profitableBranchCount,
                    branches_with_close_blockers: branchesWithCloseBlockers,
                    branches_with_receivables_pressure: branchesWithReceivablesPressure,
                    top_margin_branch_name: topMarginBranch?.branch_name ?? null,
                    top_margin_percent: this.roundMoney(topMarginBranch?.margin_percent ?? 0),
                    weakest_margin_branch_name: weakestMarginBranch?.branch_name ?? null,
                    weakest_margin_percent: this.roundMoney(weakestMarginBranch?.margin_percent ?? 0),
                    top_cash_branch_name: topCashBranch?.branch_name ?? null,
                    top_cash_branch_balance: this.roundMoney(Number(topCashBranch?.cash_balance ?? 0) + Number(topCashBranch?.bank_balance ?? 0)),
                    exception_backlog_count: ownerBranchComparison.reduce((sum: number, row: any) => sum + Number(row.blocker_count ?? 0), 0),
                },
                branch_comparison: ownerBranchComparison.slice(0, 8),
                exception_trend: ownerExceptionTrend,
            },
        };
    }

    async getCashFlowStatement(clientId: string, branchId?: number, startDate?: string, endDate?: string) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const effectiveEnd = endDate ?? this.formatBusinessDate(new Date());
        const effectiveStart = startDate ?? `${effectiveEnd.slice(0, 8)}01`;
        const openingBalanceRow = await this.dataSource.query(
            `
            SELECT
              COALESCE(SUM(CASE WHEN coa.is_cash_account = 1 OR coa.is_bank_account = 1 THEN item.debit - item.credit ELSE 0 END), 0) AS opening_balance
            FROM accounting_journal_items item
            INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
            INNER JOIN accounting_coa coa ON coa.id = item.account_id
            WHERE entry.client_id = ?
              ${branchId ? 'AND entry.branch_id = ?' : ''}
              AND entry.transaction_date < ?
            `,
            branchId ? [clientId, branchId, effectiveStart] : [clientId, effectiveStart],
        );

        const rows = await this.dataSource.query(
            `
            SELECT
              entry.id AS journal_id,
              entry.transaction_date,
              entry.description,
              cash.account_code AS cash_account_code,
              cash.account_name AS cash_account_name,
              CASE
                WHEN counter.account_type = 'equity' THEN 'financing'
                WHEN counter.account_type = 'asset' THEN 'investing'
                ELSE 'operating'
              END AS section,
              COALESCE(SUM(item.debit - item.credit), 0) AS cash_movement
            FROM accounting_journal_items item
            INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
            INNER JOIN accounting_coa cash ON cash.id = item.account_id
            LEFT JOIN accounting_journal_items counter_item
              ON counter_item.entry_id = entry.id
             AND counter_item.account_id <> item.account_id
            LEFT JOIN accounting_coa counter ON counter.id = counter_item.account_id
            WHERE entry.client_id = ?
              ${branchId ? 'AND entry.branch_id = ?' : ''}
              AND entry.transaction_date >= ?
              AND entry.transaction_date <= ?
              AND (cash.is_cash_account = 1 OR cash.is_bank_account = 1)
            GROUP BY entry.id, entry.transaction_date, entry.description, cash.account_code, cash.account_name, section
            HAVING ABS(cash_movement) > 0.009
            ORDER BY entry.transaction_date ASC, entry.id ASC
            `,
            branchId ? [clientId, branchId, effectiveStart, effectiveEnd] : [clientId, effectiveStart, effectiveEnd],
        );

        const sections = {
            operating: [] as any[],
            investing: [] as any[],
            financing: [] as any[],
        };
        for (const row of rows) {
            sections[row.section as 'operating' | 'investing' | 'financing'].push({
                journal_id: Number(row.journal_id),
                transaction_date: row.transaction_date,
                description: row.description,
                account_code: row.cash_account_code,
                account_name: row.cash_account_name,
                amount: this.roundMoney(row.cash_movement),
            });
        }

        const summarizeSection = (items: Array<{ amount: number }>) =>
            this.roundMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));

        const openingBalance = this.roundMoney(openingBalanceRow?.[0]?.opening_balance);
        const operatingNet = summarizeSection(sections.operating);
        const investingNet = summarizeSection(sections.investing);
        const financingNet = summarizeSection(sections.financing);
        const netChange = this.roundMoney(operatingNet + investingNet + financingNet);
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? null);
        const sectionTotals = [
            { key: 'operating', label: 'Operating', net_cash: operatingNet, count: sections.operating.length },
            { key: 'investing', label: 'Investing', net_cash: investingNet, count: sections.investing.length },
            { key: 'financing', label: 'Financing', net_cash: financingNet, count: sections.financing.length },
        ];
        const dominantSection = [...sectionTotals]
            .sort((a, b) => Math.abs(Number(b.net_cash ?? 0)) - Math.abs(Number(a.net_cash ?? 0)))[0];
        const nonZeroSectionCount = sectionTotals.filter((section) => Math.abs(Number(section.net_cash ?? 0)) >= 0.01).length;

        return {
            period: {
                date_from: effectiveStart,
                date_to: effectiveEnd,
            },
            period_lock: {
                mode: effectiveLock?.mode ?? PeriodLockMode.NONE,
                locked_through_date: effectiveLock?.locked_through_date ?? null,
                updated_by: effectiveLock?.updated_by ?? null,
                updated_at: effectiveLock?.updated_at ?? null,
            },
            opening_cash_balance: openingBalance,
            sections: {
                operating: {
                    items: sections.operating,
                    net_cash: operatingNet,
                },
                investing: {
                    items: sections.investing,
                    net_cash: investingNet,
                },
                financing: {
                    items: sections.financing,
                    net_cash: financingNet,
                },
            },
            summary: {
                net_change_in_cash: netChange,
                closing_cash_balance: this.roundMoney(openingBalance + netChange),
                section_count: rows.length,
                non_zero_section_count: nonZeroSectionCount,
                operating_entry_count: sections.operating.length,
                investing_entry_count: sections.investing.length,
                financing_entry_count: sections.financing.length,
                dominant_section: dominantSection?.key ?? null,
                dominant_section_label: dominantSection?.label ?? null,
                dominant_section_amount: this.roundMoney(Number(dominantSection?.net_cash ?? 0)),
                operating_is_positive: operatingNet >= 0,
            },
        };
    }

    async getTreasuryOverview(clientId: string, branchId?: number, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const branchScopeFilter = branchId
            ? 'AND (coa.branch_id = ? OR coa.branch_id IS NULL)'
            : accessibleBranchIds && accessibleBranchIds.length > 0
                ? `AND (coa.branch_id IS NULL OR coa.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')}))`
                : '';
        const branchScopeParams = branchId
            ? [branchId]
            : accessibleBranchIds && accessibleBranchIds.length > 0
                ? accessibleBranchIds
                : [];

        const accountRows = await this.dataSource.query(
            `
            SELECT
              coa.id,
              coa.account_code,
              coa.account_name,
              coa.branch_id,
              coa.scope,
              coa.is_active,
              coa.is_bank_account,
              coa.is_cash_account,
              coa.is_petty_cash_account,
              COALESCE(branch.branch_name, 'All Branches') AS branch_name,
              COALESCE(SUM(CASE WHEN balance_entry.id IS NOT NULL THEN item.debit - item.credit ELSE 0 END), 0) AS balance
            FROM accounting_coa coa
            LEFT JOIN branches branch
              ON branch.id = coa.branch_id
             AND branch.client_id = coa.client_id
            LEFT JOIN accounting_journal_items item
              ON item.account_id = coa.id
            LEFT JOIN accounting_journal_entries balance_entry
              ON balance_entry.id = item.entry_id
             AND balance_entry.client_id = coa.client_id
            WHERE coa.client_id = ?
              AND coa.account_type = 'asset'
              AND (coa.is_bank_account = 1 OR coa.is_cash_account = 1 OR coa.account_code = '1104')
              ${branchScopeFilter}
            GROUP BY
              coa.id,
              coa.account_code,
              coa.account_name,
              coa.branch_id,
              coa.scope,
              coa.is_active,
              coa.is_bank_account,
              coa.is_cash_account,
              coa.is_petty_cash_account,
              branch.branch_name
            ORDER BY coa.account_code ASC
            `,
            [clientId, ...branchScopeParams],
        );

        const movementRows = await this.dataSource.query(
            `
            SELECT
              item.id,
              entry.id AS journal_entry_id,
              entry.transaction_date,
              entry.description,
              entry.reference_id,
              entry.source_module,
              entry.source_event,
              entry.branch_id,
              COALESCE(branch.branch_name, 'All Branches') AS branch_name,
              coa.id AS account_id,
              coa.account_code,
              coa.account_name,
              coa.is_bank_account,
              coa.is_cash_account,
              coa.is_petty_cash_account,
              (item.debit - item.credit) AS amount
            FROM accounting_journal_items item
            INNER JOIN accounting_journal_entries entry ON entry.id = item.entry_id
            INNER JOIN accounting_coa coa ON coa.id = item.account_id
            LEFT JOIN branches branch
              ON branch.id = entry.branch_id
             AND branch.client_id = entry.client_id
            WHERE entry.client_id = ?
              ${branchId ? 'AND entry.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
              AND (coa.is_bank_account = 1 OR coa.is_cash_account = 1)
            ORDER BY entry.transaction_date DESC, entry.id DESC, item.id DESC
            LIMIT 40
            `,
            [clientId, ...branchScopeParams],
        );

        const [latestDayCloseRow, recentDayCloseVarianceRows, depositSummaryRows, openSafeHandoverRows, safeDepositAllocationRows] = await Promise.all([
            this.dataSource.query(
                `
                SELECT
                  close_row.id,
                  close_row.business_date,
                  close_row.closed_at,
                  close_row.branch_id,
                  COALESCE(branch.branch_name, CONCAT('Branch ', close_row.branch_id)) AS branch_name,
                  close_row.expected_cash_amount,
                  close_row.actual_cash_amount,
                  close_row.cash_variance_amount
                FROM accounting_day_closes close_row
                LEFT JOIN branches branch
                  ON branch.id = close_row.branch_id
                 AND branch.client_id = close_row.client_id
                WHERE close_row.client_id = ?
                  ${branchId ? 'AND close_row.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND close_row.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                ORDER BY close_row.business_date DESC, close_row.id DESC
                LIMIT 1
                `,
                [clientId, ...branchScopeParams],
            ),
            this.dataSource.query(
                `
                SELECT
                  close_row.id,
                  close_row.business_date,
                  close_row.branch_id,
                  COALESCE(branch.branch_name, CONCAT('Branch ', close_row.branch_id)) AS branch_name,
                  close_row.expected_cash_amount,
                  close_row.actual_cash_amount,
                  close_row.cash_variance_amount
                FROM accounting_day_closes close_row
                LEFT JOIN branches branch
                  ON branch.id = close_row.branch_id
                 AND branch.client_id = close_row.client_id
                WHERE close_row.client_id = ?
                  ${branchId ? 'AND close_row.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND close_row.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                ORDER BY close_row.business_date DESC, close_row.id DESC
                LIMIT 10
                `,
                [clientId, ...branchScopeParams],
            ),
            this.dataSource.query(
                `
                SELECT
                  entry.source_event,
                  COUNT(DISTINCT entry.id) AS movement_count,
                  COALESCE(SUM(CASE WHEN item.debit > 0 THEN item.debit ELSE item.credit END), 0) AS total_amount
                FROM accounting_journal_items item
                INNER JOIN accounting_journal_entries entry
                  ON entry.id = item.entry_id
                INNER JOIN accounting_coa coa
                  ON coa.id = item.account_id
                 AND coa.client_id = entry.client_id
                WHERE entry.client_id = ?
                  ${branchId ? 'AND entry.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                  AND entry.source_event IN ('cash_deposit_to_transit', 'transit_to_bank')
                  AND (
                    (entry.source_event = 'cash_deposit_to_transit' AND coa.account_code = '1104' AND item.debit > 0)
                    OR
                    (entry.source_event = 'transit_to_bank' AND coa.is_bank_account = 1 AND item.debit > 0)
                  )
                GROUP BY entry.source_event
                `,
                [clientId, ...branchScopeParams],
            ),
            this.dataSource.query(
                `
                SELECT
                  entry.id AS journal_entry_id,
                  entry.transaction_date,
                  entry.business_date,
                  entry.reference_id,
                  entry.description,
                  entry.branch_id,
                  COALESCE(branch.branch_name, 'All Branches') AS branch_name,
                  source_coa.id AS source_account_id,
                  source_coa.account_code AS source_account_code,
                  source_coa.account_name AS source_account_name,
                  safe_coa.id AS safe_account_id,
                  safe_coa.account_code AS safe_account_code,
                  safe_coa.account_name AS safe_account_name,
                  safe_item.debit AS handover_amount,
                  COALESCE(alloc.allocated_amount, 0) AS allocated_amount
                FROM accounting_journal_entries entry
                INNER JOIN accounting_journal_items safe_item
                  ON safe_item.entry_id = entry.id
                 AND safe_item.debit > 0
                INNER JOIN accounting_coa safe_coa
                  ON safe_coa.id = safe_item.account_id
                 AND safe_coa.client_id = entry.client_id
                 AND safe_coa.account_code = '1105'
                INNER JOIN accounting_journal_items source_item
                  ON source_item.entry_id = entry.id
                 AND source_item.credit > 0
                 AND source_item.account_id <> safe_item.account_id
                INNER JOIN accounting_coa source_coa
                  ON source_coa.id = source_item.account_id
                 AND source_coa.client_id = entry.client_id
                LEFT JOIN branches branch
                  ON branch.id = entry.branch_id
                 AND branch.client_id = entry.client_id
                LEFT JOIN (
                  SELECT
                    handover_entry_id,
                    COALESCE(SUM(allocated_amount), 0) AS allocated_amount
                  FROM accounting_treasury_deposit_allocations
                  WHERE client_id = ?
                    ${branchId ? 'AND branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                  GROUP BY handover_entry_id
                ) alloc
                  ON alloc.handover_entry_id = entry.id
                WHERE entry.client_id = ?
                  AND entry.source_event = 'cash_to_safe'
                  ${branchId ? 'AND entry.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                ORDER BY entry.transaction_date DESC, entry.id DESC
                LIMIT 50
                `,
                [clientId, ...branchScopeParams, clientId, ...branchScopeParams],
            ),
            this.dataSource.query(
                `
                SELECT
                  deposit_entry.id AS deposit_entry_id,
                  deposit_entry.transaction_date,
                  deposit_entry.business_date,
                  deposit_entry.reference_id,
                  deposit_entry.description,
                  deposit_entry.branch_id,
                  COALESCE(branch.branch_name, 'All Branches') AS branch_name,
                  source_safe.id AS source_safe_account_id,
                  source_safe.account_code AS source_safe_account_code,
                  source_safe.account_name AS source_safe_account_name,
                  transit_item.debit AS deposit_amount,
                  COALESCE(clearance_alloc.cleared_amount, 0) AS cleared_amount,
                  clearance_entry.id AS latest_clearance_entry_id,
                  clearance_entry.transaction_date AS latest_clearance_date,
                  clearance_entry.reference_id AS latest_clearance_reference_id,
                  clearance_entry.description AS latest_clearance_description,
                  alloc.handover_entry_id,
                  alloc.allocated_amount,
                  handover_entry.reference_id AS handover_reference_id,
                  handover_entry.description AS handover_description,
                  handover_entry.business_date AS handover_business_date
                FROM accounting_journal_entries deposit_entry
                INNER JOIN accounting_journal_items transit_item
                  ON transit_item.entry_id = deposit_entry.id
                 AND transit_item.debit > 0
                INNER JOIN accounting_coa transit_coa
                  ON transit_coa.id = transit_item.account_id
                 AND transit_coa.client_id = deposit_entry.client_id
                 AND transit_coa.account_code = '1104'
                INNER JOIN accounting_journal_items source_item
                  ON source_item.entry_id = deposit_entry.id
                 AND source_item.credit > 0
                INNER JOIN accounting_coa source_safe
                  ON source_safe.id = source_item.account_id
                 AND source_safe.client_id = deposit_entry.client_id
                 AND source_safe.account_code = '1105'
                LEFT JOIN branches branch
                  ON branch.id = deposit_entry.branch_id
                 AND branch.client_id = deposit_entry.client_id
                LEFT JOIN accounting_treasury_deposit_allocations alloc
                  ON alloc.deposit_entry_id = deposit_entry.id
                 AND alloc.client_id = deposit_entry.client_id
                LEFT JOIN (
                  SELECT
                    deposit_entry_id,
                    COALESCE(SUM(allocated_amount), 0) AS cleared_amount,
                    MAX(clearance_entry_id) AS latest_clearance_entry_id
                  FROM accounting_treasury_deposit_clearance_allocations
                  WHERE client_id = ?
                    ${branchId ? 'AND branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                  GROUP BY deposit_entry_id
                ) clearance_alloc
                  ON clearance_alloc.deposit_entry_id = deposit_entry.id
                LEFT JOIN accounting_journal_entries clearance_entry
                  ON clearance_entry.id = clearance_alloc.latest_clearance_entry_id
                 AND clearance_entry.client_id = deposit_entry.client_id
                LEFT JOIN accounting_journal_entries handover_entry
                  ON handover_entry.id = alloc.handover_entry_id
                 AND handover_entry.client_id = alloc.client_id
                WHERE deposit_entry.client_id = ?
                  AND deposit_entry.source_event = 'cash_deposit_to_transit'
                  ${branchId ? 'AND deposit_entry.branch_id = ?' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND deposit_entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')})` : ''}
                ORDER BY deposit_entry.transaction_date DESC, deposit_entry.id DESC, alloc.id ASC
                LIMIT 100
                `,
                [clientId, ...branchScopeParams, clientId, ...branchScopeParams],
            ),
        ]);

        const accounts = accountRows.map((row: any) => ({
            id: Number(row.id),
            account_code: row.account_code,
            account_name: row.account_name,
            branch_id: row.branch_id ? Number(row.branch_id) : null,
            branch_name: row.branch_name,
            scope: row.scope,
            is_active: Number(row.is_active ?? 0) === 1,
            is_bank_account: Number(row.is_bank_account ?? 0) === 1,
            is_cash_account: Number(row.is_cash_account ?? 0) === 1,
            is_petty_cash_account: Number(row.is_petty_cash_account ?? 0) === 1,
            balance: this.roundMoney(row.balance ?? 0),
        }));

        const recentMovements = movementRows.map((row: any) => {
            const rawAmount = Number(row.amount ?? 0);
            const sourceEvent = String(row.source_event ?? '').toLowerCase();
            let treasuryClassification = 'other';
            let treasuryClassificationLabel = 'Other Treasury Activity';

            if (sourceEvent === 'cash_to_safe') {
                treasuryClassification = 'cash_handover';
                treasuryClassificationLabel = 'Cash Handover To Safe';
            } else if (sourceEvent === 'cash_to_bank') {
                treasuryClassification = 'deposit';
                treasuryClassificationLabel = 'Cash Deposit';
            } else if (sourceEvent === 'cash_deposit_to_transit') {
                treasuryClassification = 'deposit_in_transit';
                treasuryClassificationLabel = 'Deposit Sent To Bank';
            } else if (sourceEvent === 'transit_to_bank') {
                treasuryClassification = 'deposit_cleared';
                treasuryClassificationLabel = 'Deposit Cleared To Bank';
            } else if (sourceEvent === 'bank_to_cash') {
                treasuryClassification = 'withdrawal';
                treasuryClassificationLabel = 'Bank Withdrawal';
            } else if (sourceEvent === 'treasury_transfer') {
                treasuryClassification = 'internal_transfer';
                treasuryClassificationLabel = 'Internal Transfer';
            } else if (sourceEvent === 'merchant_settlement') {
                treasuryClassification = 'merchant_settlement';
                treasuryClassificationLabel = 'Merchant Settlement';
            } else if (sourceEvent === 'petty_cash_refill' || sourceEvent === 'petty_cash_opening') {
                treasuryClassification = 'petty_cash_funding';
                treasuryClassificationLabel = 'Petty Cash Funding';
            }

            return {
                id: Number(row.id),
                journal_entry_id: Number(row.journal_entry_id),
                transaction_date: row.transaction_date,
                description: row.description,
                reference_id: row.reference_id ?? null,
                source_module: row.source_module ?? null,
                source_event: row.source_event ?? null,
                branch_id: row.branch_id ? Number(row.branch_id) : null,
                branch_name: row.branch_name,
                account_id: Number(row.account_id),
                account_code: row.account_code,
                account_name: row.account_name,
                is_bank_account: Number(row.is_bank_account ?? 0) === 1,
                is_cash_account: Number(row.is_cash_account ?? 0) === 1,
                is_petty_cash_account: Number(row.is_petty_cash_account ?? 0) === 1,
                amount: this.roundMoney(rawAmount),
                direction: rawAmount >= 0 ? 'inflow' : 'outflow',
                treasury_classification: treasuryClassification,
                treasury_classification_label: treasuryClassificationLabel,
            };
        });

        const movementMixMap = new Map<string, { label: string; count: number; amount: number }>();
        for (const row of recentMovements) {
            const key = String(row.source_module ?? 'manual').toLowerCase();
            const existing = movementMixMap.get(key) ?? {
                label: key === 'pos' ? 'POS' : key === 'inventory' ? 'Inventory' : key === 'accounting' ? 'Accounting' : 'Manual',
                count: 0,
                amount: 0,
            };
            existing.count += 1;
            existing.amount += Math.abs(Number(row.amount ?? 0));
            movementMixMap.set(key, existing);
        }
        const classificationMixMap = new Map<string, { label: string; count: number; amount: number }>();
        for (const row of recentMovements) {
            const key = String(row.treasury_classification ?? 'other');
            const existing = classificationMixMap.get(key) ?? {
                label: row.treasury_classification_label ?? 'Other Treasury Activity',
                count: 0,
                amount: 0,
            };
            existing.count += 1;
            existing.amount += Math.abs(Number(row.amount ?? 0));
            classificationMixMap.set(key, existing);
        }

        const cashAccounts = accounts.filter((row: any) => row.is_cash_account && !row.is_petty_cash_account && String(row.account_code) !== '1105');
        const safeAccounts = accounts.filter((row: any) => String(row.account_code) === '1105');
        const pettyCashAccounts = accounts.filter((row: any) => row.is_petty_cash_account);
        const bankAccounts = accounts.filter((row: any) => row.is_bank_account);
        const bankTransitAccounts = accounts.filter((row: any) => String(row.account_code) === '1104');
        const topMovementSource = [...movementMixMap.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
        const latestDayClose = latestDayCloseRow?.[0] ?? null;
        const depositSentSummary = depositSummaryRows.find((row: any) => String(row.source_event) === 'cash_deposit_to_transit') ?? null;
        const depositClearedSummary = depositSummaryRows.find((row: any) => String(row.source_event) === 'transit_to_bank') ?? null;
        const merchantClearingBalanceRow = await this.dataSource.query(
            `
            SELECT COALESCE(SUM(CASE WHEN entry.id IS NOT NULL THEN item.debit - item.credit ELSE 0 END), 0) AS balance
            FROM accounting_coa coa
            LEFT JOIN accounting_journal_items item
              ON item.account_id = coa.id
            LEFT JOIN accounting_journal_entries entry
              ON entry.id = item.entry_id
             AND entry.client_id = coa.client_id
            WHERE coa.client_id = ?
              AND coa.account_code = '1103'
              ${branchId ? 'AND (entry.branch_id = ? OR entry.branch_id IS NULL)' : accessibleBranchIds && accessibleBranchIds.length > 0 ? `AND (entry.branch_id IS NULL OR entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')}))` : ''}
            `,
            [clientId, ...branchScopeParams],
        );

        const openSafeHandovers = openSafeHandoverRows
            .map((row: any) => {
                const handoverAmount = this.roundMoney(row.handover_amount ?? 0);
                const allocatedAmount = this.roundMoney(row.allocated_amount ?? 0);
                const remainingAmount = this.roundMoney(handoverAmount - allocatedAmount);
                return {
                    journal_entry_id: Number(row.journal_entry_id),
                    transaction_date: row.transaction_date,
                    business_date: row.business_date,
                    reference_id: row.reference_id ?? null,
                    description: row.description ?? null,
                    branch_id: row.branch_id ? Number(row.branch_id) : null,
                    branch_name: row.branch_name ?? null,
                    source_account_id: Number(row.source_account_id),
                    source_account_code: row.source_account_code ?? null,
                    source_account_name: row.source_account_name ?? null,
                    safe_account_id: Number(row.safe_account_id),
                    safe_account_code: row.safe_account_code ?? null,
                    safe_account_name: row.safe_account_name ?? null,
                    handover_amount: handoverAmount,
                    allocated_amount: allocatedAmount,
                    remaining_amount: remainingAmount,
                    review_status: remainingAmount > 0 ? 'available_for_deposit' : 'fully_allocated',
                };
            })
            .filter((row: any) => Number(row.remaining_amount ?? 0) > 0);

        const depositBatchMap = new Map<number, any>();
        for (const row of safeDepositAllocationRows) {
            const depositEntryId = Number(row.deposit_entry_id);
            const existing = depositBatchMap.get(depositEntryId) ?? {
                deposit_entry_id: depositEntryId,
                transaction_date: row.transaction_date,
                business_date: row.business_date,
                reference_id: row.reference_id ?? null,
                description: row.description ?? null,
                branch_id: row.branch_id ? Number(row.branch_id) : null,
                branch_name: row.branch_name ?? null,
                source_safe_account_id: Number(row.source_safe_account_id),
                source_safe_account_code: row.source_safe_account_code ?? null,
                source_safe_account_name: row.source_safe_account_name ?? null,
                deposit_amount: this.roundMoney(row.deposit_amount ?? 0),
                cleared_amount: this.roundMoney(row.cleared_amount ?? 0),
                latest_clearance_entry_id: row.latest_clearance_entry_id ? Number(row.latest_clearance_entry_id) : null,
                latest_clearance_date: row.latest_clearance_date ?? null,
                latest_clearance_reference_id: row.latest_clearance_reference_id ?? null,
                latest_clearance_description: row.latest_clearance_description ?? null,
                linked_handover_count: 0,
                allocated_amount: 0,
                linked_handovers: [] as any[],
            };
            if (row.handover_entry_id) {
                existing.linked_handover_count += 1;
                existing.allocated_amount = this.roundMoney(Number(existing.allocated_amount ?? 0) + Number(row.allocated_amount ?? 0));
                existing.linked_handovers.push({
                    handover_entry_id: Number(row.handover_entry_id),
                    allocated_amount: this.roundMoney(row.allocated_amount ?? 0),
                    reference_id: row.handover_reference_id ?? null,
                    description: row.handover_description ?? null,
                    business_date: row.handover_business_date ?? null,
                });
            }
            depositBatchMap.set(depositEntryId, existing);
        }
        const safeDepositBatches = [...depositBatchMap.values()].map((batch: any) => ({
            ...batch,
            cleared_amount: this.roundMoney(batch.cleared_amount ?? 0),
            remaining_in_transit_amount: this.roundMoney(Number(batch.deposit_amount ?? 0) - Number(batch.cleared_amount ?? 0)),
            unlinked_amount: this.roundMoney(Number(batch.deposit_amount ?? 0) - Number(batch.allocated_amount ?? 0)),
            review_status: Number(batch.deposit_amount ?? 0) > Number(batch.allocated_amount ?? 0)
                ? 'needs_handover_linking'
                : Number(batch.deposit_amount ?? 0) > Number(batch.cleared_amount ?? 0)
                    ? 'in_transit'
                    : 'cleared_to_bank',
        }));
        const todayBusinessDate = this.formatBusinessDate(new Date());
        const toAgeDays = (value?: string | null) => {
            if (!value) return 0;
            const start = new Date(`${value}T00:00:00`);
            const end = new Date(`${todayBusinessDate}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
            return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
        };
        const agedOpenSafeHandovers = openSafeHandovers.map((row: any) => ({
            ...row,
            age_days: toAgeDays(row.business_date || row.transaction_date),
        }));
        const openTransitDepositBatches = safeDepositBatches
            .filter((row: any) => Number(row.remaining_in_transit_amount ?? 0) > 0)
            .map((row: any) => ({
                ...row,
                age_days: toAgeDays(row.business_date || row.transaction_date),
            }))
            .sort((left: any, right: any) => {
                const leftDate = new Date(left.transaction_date ?? 0).getTime();
                const rightDate = new Date(right.transaction_date ?? 0).getTime();
                if (leftDate !== rightDate) return leftDate - rightDate;
                return Number(left.deposit_entry_id ?? 0) - Number(right.deposit_entry_id ?? 0);
            });
        const overdueSafeHandovers = agedOpenSafeHandovers.filter((row: any) => Number(row.age_days ?? 0) >= 1);
        const overdueTransitDepositBatches = openTransitDepositBatches.filter((row: any) => Number(row.age_days ?? 0) >= 2);
        const topOpenTransitBatch = [...openTransitDepositBatches]
            .sort((a: any, b: any) => Number(b.remaining_in_transit_amount ?? 0) - Number(a.remaining_in_transit_amount ?? 0))[0] ?? null;
        const topOpenSafeHandover = [...agedOpenSafeHandovers].sort((a, b) => Number(b.remaining_amount ?? 0) - Number(a.remaining_amount ?? 0))[0] ?? null;
        const topOverdueSafeHandover = [...overdueSafeHandovers].sort((a, b) => Number(b.remaining_amount ?? 0) - Number(a.remaining_amount ?? 0))[0] ?? null;
        const topOverdueTransitBatch = [...overdueTransitDepositBatches].sort((a, b) => Number(b.remaining_in_transit_amount ?? 0) - Number(a.remaining_in_transit_amount ?? 0))[0] ?? null;
        const recentVarianceRows = recentDayCloseVarianceRows.map((row: any) => ({
            id: Number(row.id),
            business_date: row.business_date,
            branch_id: row.branch_id ? Number(row.branch_id) : null,
            branch_name: row.branch_name ?? null,
            expected_cash_amount: this.roundMoney(row.expected_cash_amount ?? 0),
            actual_cash_amount: this.roundMoney(row.actual_cash_amount ?? 0),
            cash_variance_amount: this.roundMoney(row.cash_variance_amount ?? 0),
        }));
        const nonZeroVarianceRows = recentVarianceRows.filter((row: any) => Math.abs(Number(row.cash_variance_amount ?? 0)) > 0.009);
        const shortageVarianceRows = nonZeroVarianceRows.filter((row: any) => Number(row.cash_variance_amount ?? 0) < 0);
        const overageVarianceRows = nonZeroVarianceRows.filter((row: any) => Number(row.cash_variance_amount ?? 0) > 0);
        const topVarianceRow = [...nonZeroVarianceRows]
            .sort((a: any, b: any) => Math.abs(Number(b.cash_variance_amount ?? 0)) - Math.abs(Number(a.cash_variance_amount ?? 0)))[0] ?? null;
        const depositVarianceBatches = safeDepositBatches.filter((row: any) => Number(row.unlinked_amount ?? 0) > 0.009);
        const topDepositVarianceBatch = [...depositVarianceBatches]
            .sort((a: any, b: any) => Number(b.unlinked_amount ?? 0) - Number(a.unlinked_amount ?? 0))[0] ?? null;

        return {
            summary: {
                total_cash_balance: this.roundMoney(cashAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                total_safe_balance: this.roundMoney(safeAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                total_petty_cash_balance: this.roundMoney(pettyCashAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                total_bank_balance: this.roundMoney(bankAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                bank_in_transit_balance: this.roundMoney(bankTransitAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                total_treasury_balance: this.roundMoney(accounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                merchant_clearing_balance: this.roundMoney(merchantClearingBalanceRow[0]?.balance ?? 0),
                bank_account_count: bankAccounts.length,
                cash_account_count: cashAccounts.length,
                safe_account_count: safeAccounts.length,
                petty_cash_account_count: pettyCashAccounts.length,
                bank_in_transit_account_count: bankTransitAccounts.length,
                top_movement_source_label: topMovementSource?.label ?? null,
                top_movement_source_amount: this.roundMoney(topMovementSource?.amount ?? 0),
                latest_day_close_variance_amount: this.roundMoney(latestDayClose?.cash_variance_amount ?? 0),
                deposit_sent_count: Number(depositSentSummary?.movement_count ?? 0),
                deposit_sent_amount: this.roundMoney(depositSentSummary?.total_amount ?? 0),
                deposit_cleared_count: Number(depositClearedSummary?.movement_count ?? 0),
                deposit_cleared_amount: this.roundMoney(depositClearedSummary?.total_amount ?? 0),
            },
            cash_office_review: {
                latest_day_close: latestDayClose ? {
                    id: Number(latestDayClose.id),
                    business_date: latestDayClose.business_date,
                    closed_at: latestDayClose.closed_at,
                    branch_id: latestDayClose.branch_id ? Number(latestDayClose.branch_id) : null,
                    branch_name: latestDayClose.branch_name ?? null,
                    expected_cash_amount: this.roundMoney(latestDayClose.expected_cash_amount ?? 0),
                    actual_cash_amount: this.roundMoney(latestDayClose.actual_cash_amount ?? 0),
                    cash_variance_amount: this.roundMoney(latestDayClose.cash_variance_amount ?? 0),
                } : null,
                variance_review: {
                    recent_close_count: recentVarianceRows.length,
                    variance_count: nonZeroVarianceRows.length,
                    shortage_count: shortageVarianceRows.length,
                    overage_count: overageVarianceRows.length,
                    variance_amount: this.roundMoney(nonZeroVarianceRows.reduce((sum: number, row: any) => sum + Math.abs(Number(row.cash_variance_amount ?? 0)), 0)),
                    top_variance_date: topVarianceRow?.business_date ?? null,
                    top_variance_amount: this.roundMoney(Math.abs(Number(topVarianceRow?.cash_variance_amount ?? 0))),
                    top_variance_branch_name: topVarianceRow?.branch_name ?? null,
                },
                recent_variances: recentVarianceRows.slice(0, 20),
                deposits: {
                    sent_count: Number(depositSentSummary?.movement_count ?? 0),
                    sent_amount: this.roundMoney(depositSentSummary?.total_amount ?? 0),
                    cleared_count: Number(depositClearedSummary?.movement_count ?? 0),
                    cleared_amount: this.roundMoney(depositClearedSummary?.total_amount ?? 0),
                    uncleared_amount: this.roundMoney(bankTransitAccounts.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0)),
                },
            },
            safe_deposit_review: {
                open_handover_count: agedOpenSafeHandovers.length,
                open_handover_amount: this.roundMoney(agedOpenSafeHandovers.reduce((sum: number, row: any) => sum + Number(row.remaining_amount ?? 0), 0)),
                recent_batch_count: safeDepositBatches.length,
                unlinked_batch_count: safeDepositBatches.filter((row: any) => row.review_status === 'needs_handover_linking').length,
                open_transit_batch_count: openTransitDepositBatches.length,
                open_transit_amount: this.roundMoney(openTransitDepositBatches.reduce((sum: number, row: any) => sum + Number(row.remaining_in_transit_amount ?? 0), 0)),
                cleared_batch_count: safeDepositBatches.filter((row: any) => row.review_status === 'cleared_to_bank').length,
                cleared_batch_amount: this.roundMoney(safeDepositBatches.reduce((sum: number, row: any) => sum + Number(row.cleared_amount ?? 0), 0)),
                deposit_variance_batch_count: depositVarianceBatches.length,
                deposit_variance_amount: this.roundMoney(depositVarianceBatches.reduce((sum: number, row: any) => sum + Number(row.unlinked_amount ?? 0), 0)),
                overdue_safe_handover_count: overdueSafeHandovers.length,
                overdue_safe_handover_amount: this.roundMoney(overdueSafeHandovers.reduce((sum: number, row: any) => sum + Number(row.remaining_amount ?? 0), 0)),
                overdue_transit_batch_count: overdueTransitDepositBatches.length,
                overdue_transit_amount: this.roundMoney(overdueTransitDepositBatches.reduce((sum: number, row: any) => sum + Number(row.remaining_in_transit_amount ?? 0), 0)),
                top_open_handover_reference: topOpenSafeHandover?.reference_id ?? topOpenSafeHandover?.description ?? null,
                top_open_handover_amount: this.roundMoney(topOpenSafeHandover?.remaining_amount ?? 0),
                top_open_transit_reference: topOpenTransitBatch?.reference_id ?? topOpenTransitBatch?.description ?? null,
                top_open_transit_amount: this.roundMoney(topOpenTransitBatch?.remaining_in_transit_amount ?? 0),
                top_deposit_variance_reference: topDepositVarianceBatch?.reference_id ?? topDepositVarianceBatch?.description ?? null,
                top_deposit_variance_amount: this.roundMoney(topDepositVarianceBatch?.unlinked_amount ?? 0),
                top_overdue_safe_reference: topOverdueSafeHandover?.reference_id ?? topOverdueSafeHandover?.description ?? null,
                top_overdue_safe_amount: this.roundMoney(topOverdueSafeHandover?.remaining_amount ?? 0),
                top_overdue_transit_reference: topOverdueTransitBatch?.reference_id ?? topOverdueTransitBatch?.description ?? null,
                top_overdue_transit_amount: this.roundMoney(topOverdueTransitBatch?.remaining_in_transit_amount ?? 0),
                top_issue: overdueTransitDepositBatches.length > 0
                    ? 'Some deposits have been in transit for more than two day(s).'
                    : overdueSafeHandovers.length > 0
                        ? 'Some safe handovers are still waiting for deposit batching after one day.'
                        : depositVarianceBatches.length > 0
                            ? 'Some deposit batches do not fully tie back to source handovers.'
                        : null,
                open_handovers: agedOpenSafeHandovers.slice(0, 20),
                open_transit_batches: openTransitDepositBatches.slice(0, 20),
                recent_deposit_batches: safeDepositBatches.slice(0, 20),
            },
            accounts,
            movement_mix: [...movementMixMap.values()]
                .map((row) => ({
                    label: row.label,
                    count: row.count,
                    amount: this.roundMoney(row.amount),
                }))
                .sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0)),
            movement_classification_mix: [...classificationMixMap.entries()]
                .map(([key, row]) => ({
                    key,
                    label: row.label,
                    count: row.count,
                    amount: this.roundMoney(row.amount),
                }))
                .sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0)),
            recent_movements: recentMovements,
        };
    }

    async getMerchantSettlementReview(clientId: string, branchId?: number, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const branchScopeFilter = branchId
            ? 'AND (entry.branch_id = ? OR entry.branch_id IS NULL)'
            : accessibleBranchIds && accessibleBranchIds.length > 0
                ? `AND (entry.branch_id IS NULL OR entry.branch_id IN (${accessibleBranchIds.map(() => '?').join(', ')}))`
                : '';
        const branchScopeParams = branchId
            ? [branchId]
            : accessibleBranchIds && accessibleBranchIds.length > 0
                ? accessibleBranchIds
                : [];

        const rows = await this.dataSource.query(
            `
            SELECT
              entry.id AS journal_entry_id,
              entry.branch_id,
              branch.branch_name,
              entry.transaction_date,
              entry.reference_id,
              entry.description,
              entry.source_module,
              entry.source_event,
              entry.source_entity_type,
              entry.source_entity_id,
              COALESCE(SUM(item.debit - item.credit), 0) AS amount
            FROM accounting_journal_entries entry
            INNER JOIN accounting_journal_items item
              ON item.entry_id = entry.id
            INNER JOIN accounting_coa coa
              ON coa.id = item.account_id
             AND coa.client_id = entry.client_id
            LEFT JOIN branches branch
              ON branch.id = entry.branch_id
             AND branch.client_id = entry.client_id
            WHERE entry.client_id = ?
              AND coa.account_code = '1103'
              ${branchScopeFilter}
            GROUP BY
              entry.id,
              entry.branch_id,
              branch.branch_name,
              entry.transaction_date,
              entry.reference_id,
              entry.description,
              entry.source_module,
              entry.source_event,
              entry.source_entity_type,
              entry.source_entity_id
            HAVING ABS(amount) > 0.009
            ORDER BY entry.transaction_date DESC, entry.id DESC
            `,
            [clientId, ...branchScopeParams],
        );

        const parseMerchantSettlementSource = (value?: string | null) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
                return {
                    channel: 'other',
                    channel_label: 'Other Merchant',
                    provider_name: 'Merchant Processor',
                    gross_amount: 0,
                };
            }
            const parts = raw.split(':');
            const grossAmount = this.roundMoney(parts.length > 0 ? Number(parts[parts.length - 1] ?? 0) : 0);
            const channel = String(parts[2] ?? 'other').trim().toLowerCase() || 'other';
            const providerName = parts.length > 5
                ? parts.slice(3, -2).join(':').trim() || 'Merchant Processor'
                : 'Merchant Processor';
            const channelLabel = channel === 'digital_wallet'
                ? 'Digital Wallet'
                : channel === 'card'
                    ? 'Card'
                    : 'Other Merchant';
            return {
                channel,
                channel_label: channelLabel,
                provider_name: providerName,
                gross_amount: grossAmount,
            };
        };

        const orderIds = rows
            .filter((row: any) => String(row.source_entity_type ?? '') === 'order' && Number.isInteger(Number(row.source_entity_id)))
            .map((row: any) => Number(row.source_entity_id))
            .filter((value, index, list) => value > 0 && list.indexOf(value) === index);
        const orderPaymentModeMap = new Map<number, Record<string, number>>();
        if (orderIds.length > 0) {
            const placeholders = orderIds.map(() => '?').join(', ');
            const orderPaymentRows = await this.dataSource.query(
                `
                SELECT
                  transaction.order_id,
                  transaction.payment_mode,
                  COALESCE(SUM(transaction.amount), 0) AS amount
                FROM pos_transactions transaction
                WHERE transaction.client_id = ?
                  AND transaction.order_id IN (${placeholders})
                  AND COALESCE(transaction.is_refund, 0) = 0
                GROUP BY transaction.order_id, transaction.payment_mode
                `,
                [clientId, ...orderIds],
            );
            for (const row of orderPaymentRows) {
                const orderId = Number(row.order_id);
                const current = orderPaymentModeMap.get(orderId) ?? {};
                current[String(row.payment_mode ?? '').trim().toLowerCase()] = this.roundMoney(row.amount ?? 0);
                orderPaymentModeMap.set(orderId, current);
            }
        }

        const deriveReceiptChannel = (row: any) => {
            const orderId = Number(row.source_entity_id ?? 0);
            const paymentMix = orderPaymentModeMap.get(orderId) ?? {};
            const cardAmount = this.roundMoney(paymentMix.card ?? 0);
            const walletAmount = this.roundMoney(paymentMix.digital_wallet ?? paymentMix.wallet ?? 0);
            const otherAmount = this.roundMoney(paymentMix.other ?? 0);
            const channelRows = [
                { channel: 'card', amount: cardAmount, label: 'Card' },
                { channel: 'digital_wallet', amount: walletAmount, label: 'Digital Wallet' },
                { channel: 'other', amount: otherAmount, label: 'Other Merchant' },
            ].filter((item) => Number(item.amount ?? 0) > 0.009);

            if (channelRows.length === 0) {
                return { channel: 'other', channel_label: 'Other Merchant', provider_name: 'Unassigned Processor', gross_amount: 0 };
            }
            if (channelRows.length === 1) {
                return {
                    channel: channelRows[0].channel,
                    channel_label: channelRows[0].label,
                    provider_name: 'Unassigned Processor',
                    gross_amount: 0,
                };
            }

            const dominantChannel = channelRows
                .slice()
                .sort((left, right) => Number(right.amount ?? 0) - Number(left.amount ?? 0))[0];
            return {
                channel: dominantChannel.channel,
                channel_label: `${dominantChannel.label} (Mixed)`,
                provider_name: 'Unassigned Processor',
                gross_amount: 0,
            };
        };

        const entries = rows.map((row: any) => {
            const amount = this.roundMoney(row.amount ?? 0);
            const sourceEvent = String(row.source_event ?? '').toLowerCase();
            const direction = amount >= 0 ? 'receipt' : 'settlement';
            const absoluteAmount = this.roundMoney(Math.abs(amount));
            const settlementMeta = sourceEvent === 'merchant_settlement'
                ? parseMerchantSettlementSource(row.source_entity_id)
                : deriveReceiptChannel(row);
            const reviewClass = sourceEvent === 'merchant_settlement'
                ? 'processor_settlement'
                : sourceEvent === 'sales_return'
                    ? 'refund_reversal'
                    : sourceEvent === 'credit_settlement'
                        ? 'credit_receipt'
                        : 'pos_receipt';
            const reviewLabel = reviewClass === 'processor_settlement'
                ? 'Merchant Settlement'
                : reviewClass === 'refund_reversal'
                    ? 'Refund Reversal'
                    : reviewClass === 'credit_receipt'
                        ? 'Credit Sale Receipt'
                        : 'POS Card / Wallet Receipt';

            return {
                journal_entry_id: Number(row.journal_entry_id),
                branch_id: row.branch_id ? Number(row.branch_id) : null,
                branch_name: row.branch_name ?? 'All Branches',
                transaction_date: row.transaction_date,
                reference_id: row.reference_id ?? null,
                description: row.description ?? null,
                source_module: row.source_module ?? null,
                source_event: row.source_event ?? null,
                source_entity_type: row.source_entity_type ?? null,
                source_entity_id: row.source_entity_id ?? null,
                amount,
                absolute_amount: absoluteAmount,
                direction,
                provider_name: settlementMeta?.provider_name ?? null,
                settlement_channel: settlementMeta?.channel ?? null,
                settlement_channel_label: settlementMeta?.channel_label ?? null,
                settlement_gross_amount: settlementMeta?.gross_amount ?? null,
                review_class: reviewClass,
                review_label: reviewLabel,
                review_status: amount > 0
                    ? 'awaiting_settlement'
                    : sourceEvent === 'merchant_settlement'
                        ? 'settled'
                        : 'clearing_offset',
                days_open: 0,
                aged_open: false,
            };
        });

        const settlementEntryIds = entries
            .filter((entry: any) => String(entry.review_class) === 'processor_settlement')
            .map((entry: any) => Number(entry.journal_entry_id))
            .filter((value, index, list) => Number.isInteger(value) && value > 0 && list.indexOf(value) === index);
        const settlementDetailMap = new Map<number, { net_amount: number; charges_amount: number }>();
        if (settlementEntryIds.length > 0) {
            const placeholders = settlementEntryIds.map(() => '?').join(', ');
            const settlementDetailRows = await this.dataSource.query(
                `
                SELECT
                  entry.id AS journal_entry_id,
                  COALESCE(SUM(CASE WHEN coa.is_bank_account = 1 THEN item.debit - item.credit ELSE 0 END), 0) AS net_amount,
                  COALESCE(SUM(CASE WHEN coa.account_code = '5600' THEN item.debit - item.credit ELSE 0 END), 0) AS charges_amount
                FROM accounting_journal_entries entry
                INNER JOIN accounting_journal_items item
                  ON item.entry_id = entry.id
                INNER JOIN accounting_coa coa
                  ON coa.id = item.account_id
                 AND coa.client_id = entry.client_id
                WHERE entry.client_id = ?
                  AND entry.id IN (${placeholders})
                GROUP BY entry.id
                `,
                [clientId, ...settlementEntryIds],
            );
            for (const row of settlementDetailRows) {
                settlementDetailMap.set(Number(row.journal_entry_id), {
                    net_amount: this.roundMoney(row.net_amount ?? 0),
                    charges_amount: this.roundMoney(row.charges_amount ?? 0),
                });
            }
        }

        const today = new Date();
        const agedOpenThresholdDays = 2;
        const agedOpenRows = entries
            .filter((entry: any) => Number(entry.amount ?? 0) > 0.009)
            .map((entry: any) => {
                const openedAt = new Date(`${entry.transaction_date}T12:00:00`);
                const daysOpen = Number.isNaN(openedAt.getTime())
                    ? 0
                    : Math.max(0, Math.floor((today.getTime() - openedAt.getTime()) / 86400000));
                return {
                    ...entry,
                    days_open: daysOpen,
                    aged_open: daysOpen >= agedOpenThresholdDays,
                };
            });
        const agedOpenMap = new Map<number, { days_open: number; aged_open: boolean }>();
        for (const row of agedOpenRows) {
            agedOpenMap.set(Number(row.journal_entry_id), {
                days_open: Number(row.days_open ?? 0),
                aged_open: Boolean(row.aged_open),
            });
        }

        const outstandingRows = agedOpenRows;
        const settlementRows = entries.filter((entry: any) => String(entry.review_class) === 'processor_settlement');
        const refundRows = entries.filter((entry: any) => String(entry.review_class) === 'refund_reversal');
        const agedReceiptRows = agedOpenRows.filter((entry: any) => entry.aged_open);
        const totalReceipts = this.roundMoney(
            entries
                .filter((entry: any) => Number(entry.amount ?? 0) > 0)
                .reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0),
        );
        const totalSettlements = this.roundMoney(
            settlementRows.reduce((sum: number, entry: any) => sum + Number(entry.absolute_amount ?? 0), 0),
        );
        const totalRefundReversals = this.roundMoney(
            refundRows.reduce((sum: number, entry: any) => sum + Number(entry.absolute_amount ?? 0), 0),
        );
        const clearingBalance = this.roundMoney(entries.reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0));
        const topOutstanding = outstandingRows
            .slice()
            .sort((left: any, right: any) => Number(right.amount ?? 0) - Number(left.amount ?? 0))[0] ?? null;
        const topAgedReceipt = agedReceiptRows
            .slice()
            .sort((left: any, right: any) => (
                Number(right.days_open ?? 0) - Number(left.days_open ?? 0)
                || Number(right.amount ?? 0) - Number(left.amount ?? 0)
            ))[0] ?? null;
        const providerSummaryMap = new Map<string, {
            provider_name: string;
            settlement_channel: string;
            settlement_channel_label: string;
            settlement_count: number;
            gross_settlement_amount: number;
            net_settlement_amount: number;
            settlement_shortfall_amount: number;
            average_charge_rate_percent: number;
            last_settlement_date: string | null;
            last_settlement_days_ago: number;
            channel_open_receipt_amount: number;
            aged_channel_open_receipt_amount: number;
        }>();
        const channelSummaryMap = new Map<string, {
            settlement_channel: string;
            settlement_channel_label: string;
            open_receipt_count: number;
            open_receipt_amount: number;
            aged_open_receipt_count: number;
            aged_open_receipt_amount: number;
            settlement_count: number;
            settlement_gross_amount: number;
            settlement_net_amount: number;
            settlement_shortfall_amount: number;
            refund_reversal_amount: number;
            last_activity_date: string | null;
        }>();

        for (const entry of entries) {
            const channel = String(entry.settlement_channel ?? 'other');
            const channelLabel = String(entry.settlement_channel_label ?? 'Other Merchant');
            const current = channelSummaryMap.get(channel) ?? {
                settlement_channel: channel,
                settlement_channel_label: channelLabel,
                open_receipt_count: 0,
                open_receipt_amount: 0,
                aged_open_receipt_count: 0,
                aged_open_receipt_amount: 0,
                settlement_count: 0,
                settlement_gross_amount: 0,
                settlement_net_amount: 0,
                settlement_shortfall_amount: 0,
                refund_reversal_amount: 0,
                last_activity_date: null,
            };
            if (!current.last_activity_date || String(entry.transaction_date) > String(current.last_activity_date)) {
                current.last_activity_date = entry.transaction_date ?? null;
            }
            if (Number(entry.amount ?? 0) > 0.009) {
                current.open_receipt_count += 1;
                current.open_receipt_amount += Number(entry.amount ?? 0);
                if (Number(entry.days_open ?? 0) >= agedOpenThresholdDays) {
                    current.aged_open_receipt_count += 1;
                    current.aged_open_receipt_amount += Number(entry.amount ?? 0);
                }
            }
            if (String(entry.review_class) === 'processor_settlement') {
                const detail = settlementDetailMap.get(Number(entry.journal_entry_id)) ?? { net_amount: 0, charges_amount: 0 };
                current.settlement_count += 1;
                current.settlement_gross_amount += Number(entry.absolute_amount ?? 0);
                current.settlement_net_amount += Number(detail.net_amount ?? 0);
                current.settlement_shortfall_amount += Number(detail.charges_amount ?? 0);
            }
            if (String(entry.review_class) === 'refund_reversal') {
                current.refund_reversal_amount += Number(entry.absolute_amount ?? 0);
            }
            channelSummaryMap.set(channel, current);
        }

        for (const entry of settlementRows) {
            const detail = settlementDetailMap.get(Number(entry.journal_entry_id)) ?? { net_amount: 0, charges_amount: 0 };
            const providerName = String(entry.provider_name ?? 'Merchant Processor');
            const channel = String(entry.settlement_channel ?? 'other');
            const channelLabel = String(entry.settlement_channel_label ?? 'Other Merchant');
            const key = `${providerName}::${channel}`;
            const current = providerSummaryMap.get(key) ?? {
                provider_name: providerName,
                settlement_channel: channel,
                settlement_channel_label: channelLabel,
                settlement_count: 0,
                gross_settlement_amount: 0,
                net_settlement_amount: 0,
                settlement_shortfall_amount: 0,
                average_charge_rate_percent: 0,
                last_settlement_date: null,
                last_settlement_days_ago: 0,
                channel_open_receipt_amount: 0,
                aged_channel_open_receipt_amount: 0,
            };
            current.settlement_count += 1;
            current.gross_settlement_amount += Number(entry.absolute_amount ?? 0);
            current.net_settlement_amount += Number(detail.net_amount ?? 0);
            current.settlement_shortfall_amount += Number(detail.charges_amount ?? 0);
            if (!current.last_settlement_date || String(entry.transaction_date) > String(current.last_settlement_date)) {
                current.last_settlement_date = entry.transaction_date ?? null;
            }
            providerSummaryMap.set(key, current);
        }
        const providerSummary = Array.from(providerSummaryMap.values())
            .map((row) => ({
                ...row,
                gross_settlement_amount: this.roundMoney(row.gross_settlement_amount),
                net_settlement_amount: this.roundMoney(row.net_settlement_amount),
                settlement_shortfall_amount: this.roundMoney(row.settlement_shortfall_amount),
                average_charge_rate_percent: this.roundMoney(
                    Number(row.gross_settlement_amount ?? 0) > 0
                        ? (Number(row.settlement_shortfall_amount ?? 0) / Number(row.gross_settlement_amount ?? 0)) * 100
                        : 0,
                ),
                last_settlement_days_ago: row.last_settlement_date
                    ? Math.max(0, Math.floor((today.getTime() - new Date(`${row.last_settlement_date}T12:00:00`).getTime()) / 86400000))
                    : 0,
                channel_open_receipt_amount: this.roundMoney(channelSummaryMap.get(row.settlement_channel)?.open_receipt_amount ?? 0),
                aged_channel_open_receipt_amount: this.roundMoney(channelSummaryMap.get(row.settlement_channel)?.aged_open_receipt_amount ?? 0),
            }))
            .sort((left, right) => (
                Number(right.aged_channel_open_receipt_amount ?? 0) - Number(left.aged_channel_open_receipt_amount ?? 0)
                || Number(right.gross_settlement_amount ?? 0) - Number(left.gross_settlement_amount ?? 0)
                || Number(right.settlement_shortfall_amount ?? 0) - Number(left.settlement_shortfall_amount ?? 0)
            ));
        const channelSummary = Array.from(channelSummaryMap.values())
            .map((row) => ({
                ...row,
                open_receipt_amount: this.roundMoney(row.open_receipt_amount),
                aged_open_receipt_amount: this.roundMoney(row.aged_open_receipt_amount),
                settlement_gross_amount: this.roundMoney(row.settlement_gross_amount),
                settlement_net_amount: this.roundMoney(row.settlement_net_amount),
                settlement_shortfall_amount: this.roundMoney(row.settlement_shortfall_amount),
                refund_reversal_amount: this.roundMoney(row.refund_reversal_amount),
                backlog_gap_amount: this.roundMoney(
                    Math.max(0, Number(row.open_receipt_amount ?? 0) - Number(row.settlement_gross_amount ?? 0)),
                ),
            }))
            .sort((left, right) => (
                Number(right.aged_open_receipt_amount ?? 0) - Number(left.aged_open_receipt_amount ?? 0)
                || Number(right.open_receipt_amount ?? 0) - Number(left.open_receipt_amount ?? 0)
            ));
        const topProviderExposure = providerSummary[0] ?? null;
        const topProviderShortfall = providerSummary
            .slice()
            .sort((left, right) => Number(right.settlement_shortfall_amount ?? 0) - Number(left.settlement_shortfall_amount ?? 0))[0] ?? null;
        const topDelayedChannel = channelSummary[0] ?? null;
        const topChargeRateProvider = providerSummary
            .slice()
            .sort((left, right) => Number(right.average_charge_rate_percent ?? 0) - Number(left.average_charge_rate_percent ?? 0))[0] ?? null;

        return {
            summary: {
                merchant_clearing_balance: clearingBalance,
                open_receipt_count: outstandingRows.length,
                settlement_count: settlementRows.length,
                refund_reversal_count: refundRows.length,
                total_receipts: totalReceipts,
                total_settlements: totalSettlements,
                total_refund_reversals: totalRefundReversals,
                top_outstanding_reference: topOutstanding?.reference_id ?? topOutstanding?.description ?? null,
                top_outstanding_amount: this.roundMoney(topOutstanding?.amount ?? 0),
                aged_open_receipt_count: agedReceiptRows.length,
                aged_open_receipt_amount: this.roundMoney(
                    agedReceiptRows.reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0),
                ),
                top_aged_reference: topAgedReceipt?.reference_id ?? topAgedReceipt?.description ?? null,
                top_aged_days: Number(topAgedReceipt?.days_open ?? 0),
                provider_count: providerSummary.length,
                top_provider_name: topProviderExposure?.provider_name ?? null,
                top_provider_channel_label: topProviderExposure?.settlement_channel_label ?? null,
                top_provider_settlement_amount: this.roundMoney(topProviderExposure?.gross_settlement_amount ?? 0),
                top_provider_shortfall_name: topProviderShortfall?.provider_name ?? null,
                top_provider_shortfall_channel_label: topProviderShortfall?.settlement_channel_label ?? null,
                top_provider_shortfall_amount: this.roundMoney(topProviderShortfall?.settlement_shortfall_amount ?? 0),
                top_provider_charge_rate_name: topChargeRateProvider?.provider_name ?? null,
                top_provider_charge_rate_channel_label: topChargeRateProvider?.settlement_channel_label ?? null,
                top_provider_charge_rate_percent: this.roundMoney(topChargeRateProvider?.average_charge_rate_percent ?? 0),
                channel_count: channelSummary.length,
                top_delayed_channel_label: topDelayedChannel?.settlement_channel_label ?? null,
                top_delayed_channel_amount: this.roundMoney(topDelayedChannel?.aged_open_receipt_amount ?? 0),
                top_delayed_channel_backlog_amount: this.roundMoney(topDelayedChannel?.backlog_gap_amount ?? 0),
            },
            provider_summary: providerSummary.slice(0, 6),
            channel_summary: channelSummary.slice(0, 4),
            queue: entries.slice(0, 24).map((entry: any) => ({
                ...entry,
                days_open: Number(agedOpenMap.get(Number(entry.journal_entry_id))?.days_open ?? 0),
                aged_open: Boolean(agedOpenMap.get(Number(entry.journal_entry_id))?.aged_open ?? false),
            })),
        };
    }

    private async buildTreasuryExceptionWorkflowPayload(clientId: string, liveItems: any[]) {
        const branchIds = Array.from(new Set(liveItems.map((item: any) => Number(item.branch_id)).filter((value) => value > 0)));
        let records: AccountingTreasuryException[] = [];
        if (branchIds.length > 0) {
            try {
                records = await this.treasuryExceptionRepo.find({
                    where: branchIds.map((currentBranchId) => ({ client_id: clientId, branch_id: currentBranchId })),
                    order: { updated_at: 'DESC', id: 'DESC' },
                });
            } catch (error) {
                console.warn(
                    'Treasury exception register could not be loaded. Falling back to live exception state only.',
                    error,
                );
                records = [];
            }
        }
        const recordMap = new Map(
            records.map((record) => [
                this.buildTreasuryExceptionRecordKey(record.branch_id, record.exception_type, record.exception_key),
                record,
            ]),
        );

        const items = liveItems.map((item: any) => {
            const record = recordMap.get(this.buildTreasuryExceptionRecordKey(
                Number(item.branch_id),
                String(item.exception_type),
                String(item.exception_key),
            ));
            const currentStatus = record?.status ?? AccountingTreasuryExceptionStatus.OPEN;
            return {
                ...item,
                workflow_status: currentStatus,
                workflow_status_label: currentStatus.replace('_', ' '),
                owner_name: record?.owner_name ?? null,
                notes: record?.notes ?? null,
                updated_by: record?.updated_by ?? null,
                updated_at: record?.updated_at ?? null,
                resolved_at: record?.resolved_at ?? null,
            };
        });

        const activeItems = items.filter((item: any) => ![AccountingTreasuryExceptionStatus.RESOLVED, AccountingTreasuryExceptionStatus.WAIVED].includes(item.workflow_status));
        const topItem = activeItems[0] ?? items[0] ?? null;

        return {
            summary: {
                total_count: items.length,
                open_count: items.filter((item: any) => item.workflow_status === AccountingTreasuryExceptionStatus.OPEN).length,
                in_review_count: items.filter((item: any) => item.workflow_status === AccountingTreasuryExceptionStatus.IN_REVIEW).length,
                resolved_count: items.filter((item: any) => item.workflow_status === AccountingTreasuryExceptionStatus.RESOLVED).length,
                waived_count: items.filter((item: any) => item.workflow_status === AccountingTreasuryExceptionStatus.WAIVED).length,
                active_count: activeItems.length,
                blocker_count: activeItems.filter((item: any) => item.severity === 'close_blocker').length,
                blocker_amount: this.roundMoney(activeItems
                    .filter((item: any) => item.severity === 'close_blocker')
                    .reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0)),
                top_item_label: topItem?.label ?? null,
                top_item_reference: topItem?.reference_label ?? null,
                top_item_status: topItem?.workflow_status ?? null,
                top_item_amount: this.roundMoney(topItem?.amount ?? 0),
            },
            items: items.slice(0, 30),
        };
    }

    async getTreasuryExceptionWorkflow(clientId: string, branchId?: number, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        const [treasuryOverview, merchantSettlementReview] = await Promise.all([
            this.getTreasuryOverview(clientId, branchId, accessibleBranchIds),
            this.getMerchantSettlementReview(clientId, branchId, accessibleBranchIds),
        ]);

        const liveItems = this.buildLiveTreasuryExceptions(treasuryOverview, merchantSettlementReview);
        return this.buildTreasuryExceptionWorkflowPayload(clientId, liveItems);
    }

    async upsertTreasuryException(
        clientId: string,
        dto: UpsertTreasuryExceptionDto,
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'manage treasury exceptions');
        if (
            [AccountingTreasuryExceptionStatus.RESOLVED, AccountingTreasuryExceptionStatus.WAIVED].includes(dto.status)
            && !String(dto.notes ?? '').trim()
        ) {
            throw new BadRequestException('Notes are required when resolving or waiving a treasury exception.');
        }

        const existing = await this.treasuryExceptionRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                exception_type: dto.exception_type,
                exception_key: dto.exception_key,
            },
        });
        const next = existing ?? this.treasuryExceptionRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
            exception_type: dto.exception_type,
            exception_key: dto.exception_key,
        });
        next.status = dto.status;
        next.owner_name = dto.owner_name?.trim() || null;
        next.notes = dto.notes?.trim() || null;
        next.updated_by = user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
        next.resolved_at = [AccountingTreasuryExceptionStatus.RESOLVED, AccountingTreasuryExceptionStatus.WAIVED].includes(dto.status)
            ? new Date()
            : null;

        return this.treasuryExceptionRepo.save(next);
    }

    private async resolveTreasuryMovementAccount(clientId: string, branchId: number, accountId: number) {
        const account = await this.coaRepo.findOne({
            where: { id: accountId, client_id: clientId },
        });
        if (!account) {
            throw new NotFoundException(`Treasury account ${accountId} not found.`);
        }
        const isTransitAccount = account.account_code === '1104';
        if (account.account_type !== AccountType.ASSET || (!account.is_bank_account && !account.is_cash_account && !isTransitAccount)) {
            throw new BadRequestException(`Account ${account.account_code} is not a valid treasury account.`);
        }
        if (account.scope === AccountScope.BRANCH && account.branch_id && account.branch_id !== branchId) {
            throw new BadRequestException(`Account ${account.account_code} is not available for branch ${branchId}.`);
        }
        return account;
    }

    private async resolveMerchantSettlementBankAccount(clientId: string, branchId: number, accountId: number) {
        const account = await this.resolveTreasuryMovementAccount(clientId, branchId, accountId);
        if (!account.is_bank_account) {
            throw new BadRequestException('Merchant settlement destination must be a bank account.');
        }
        return account;
    }

    async createTreasuryMovement(
        clientId: string,
        dto: CreateTreasuryMovementDto & { branch_id: number },
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'post treasury movements');
        await this.ensureBaseChart(clientId);

        const amount = this.roundMoney(dto.amount);
        if (amount <= 0) {
            throw new BadRequestException('Treasury movement amount must be greater than zero.');
        }
        if (dto.source_account_id === dto.destination_account_id) {
            throw new BadRequestException('Source and destination treasury accounts must be different.');
        }

        const [sourceAccount, destinationAccount] = await Promise.all([
            this.resolveTreasuryMovementAccount(clientId, dto.branch_id, dto.source_account_id),
            this.resolveTreasuryMovementAccount(clientId, dto.branch_id, dto.destination_account_id),
        ]);
        const isSourceTransit = sourceAccount.account_code === '1104';
        const isDestinationTransit = destinationAccount.account_code === '1104';
        const isSourceSafe = sourceAccount.account_code === '1105';
        const isDestinationSafe = destinationAccount.account_code === '1105';

        if (dto.movement_type === TreasuryMovementType.CASH_TO_SAFE) {
            if (!sourceAccount.is_cash_account || isSourceSafe || !isDestinationSafe) {
                throw new BadRequestException('Cash-to-safe movement requires a cash-counter source and branch-safe destination.');
            }
        } else if (dto.movement_type === TreasuryMovementType.CASH_TO_BANK) {
            if (!sourceAccount.is_cash_account || !destinationAccount.is_bank_account) {
                throw new BadRequestException('Cash-to-bank movement requires a cash source and bank destination.');
            }
        } else if (dto.movement_type === TreasuryMovementType.CASH_DEPOSIT_TO_TRANSIT) {
            if (!sourceAccount.is_cash_account || !isDestinationTransit) {
                throw new BadRequestException('Cash deposit to transit requires a cash source and bank-in-transit destination.');
            }
        } else if (dto.movement_type === TreasuryMovementType.TRANSIT_TO_BANK) {
            if (!isSourceTransit || !destinationAccount.is_bank_account) {
                throw new BadRequestException('Transit-to-bank movement requires bank-in-transit as the source and a bank account as the destination.');
            }
        } else if (dto.movement_type === TreasuryMovementType.BANK_TO_CASH) {
            if (!sourceAccount.is_bank_account || !destinationAccount.is_cash_account) {
                throw new BadRequestException('Bank-to-cash movement requires a bank source and cash destination.');
            }
        }

        const requestedHandoverIds = Array.from(new Set((dto.handover_journal_entry_ids ?? []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
        const requestedDepositEntryIds = Array.from(new Set((dto.deposit_entry_ids ?? []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
        if (requestedHandoverIds.length > 0 && !(dto.movement_type === TreasuryMovementType.CASH_DEPOSIT_TO_TRANSIT && isSourceSafe)) {
            throw new BadRequestException('Handover source documents can only be linked for safe-to-transit deposit movements.');
        }
        if (dto.movement_type === TreasuryMovementType.CASH_DEPOSIT_TO_TRANSIT && isSourceSafe && requestedHandoverIds.length === 0) {
            throw new BadRequestException('Safe-to-bank deposit movements require at least one linked safe handover document.');
        }
        if (requestedDepositEntryIds.length > 0 && dto.movement_type !== TreasuryMovementType.TRANSIT_TO_BANK) {
            throw new BadRequestException('Deposit batches can only be linked when clearing bank-in-transit into bank.');
        }
        if (dto.movement_type === TreasuryMovementType.TRANSIT_TO_BANK && requestedDepositEntryIds.length === 0) {
            throw new BadRequestException('Transit-to-bank clearance requires at least one linked deposit batch.');
        }

        let linkedHandovers: Array<{
            handover_entry_id: number;
            allocated_amount: number;
            reference_id: string | null;
            description: string | null;
            business_date: string | null;
        }> = [];
        let preparedDepositAllocations: Array<{ handover_entry_id: number; allocated_amount: number }> = [];
        let linkedDepositBatches: Array<{
            deposit_entry_id: number;
            allocated_amount: number;
            reference_id: string | null;
            description: string | null;
            business_date: string | null;
        }> = [];
        let preparedClearanceAllocations: Array<{ deposit_entry_id: number; allocated_amount: number }> = [];

        if (dto.movement_type === TreasuryMovementType.CASH_DEPOSIT_TO_TRANSIT && isSourceSafe && requestedHandoverIds.length > 0) {
            const handoverRows = await this.dataSource.query(
                `
                SELECT
                  entry.id AS journal_entry_id,
                  entry.transaction_date,
                  entry.business_date,
                  entry.reference_id,
                  entry.description,
                  safe_item.debit AS handover_amount,
                  COALESCE(alloc.allocated_amount, 0) AS allocated_amount
                FROM accounting_journal_entries entry
                INNER JOIN accounting_journal_items safe_item
                  ON safe_item.entry_id = entry.id
                 AND safe_item.debit > 0
                 AND safe_item.account_id = ?
                LEFT JOIN (
                  SELECT
                    handover_entry_id,
                    COALESCE(SUM(allocated_amount), 0) AS allocated_amount
                  FROM accounting_treasury_deposit_allocations
                  WHERE client_id = ?
                    AND branch_id = ?
                  GROUP BY handover_entry_id
                ) alloc
                  ON alloc.handover_entry_id = entry.id
                WHERE entry.client_id = ?
                  AND entry.branch_id = ?
                  AND entry.source_event = 'cash_to_safe'
                  AND entry.id IN (${requestedHandoverIds.map(() => '?').join(', ')})
                ORDER BY entry.transaction_date ASC, entry.id ASC
                `,
                [sourceAccount.id, clientId, dto.branch_id, clientId, dto.branch_id, ...requestedHandoverIds],
            );

            if (handoverRows.length !== requestedHandoverIds.length) {
                throw new BadRequestException('One or more selected handover documents are invalid for the selected branch safe.');
            }

            let remainingToAllocate = amount;
            for (const row of handoverRows) {
                const availableAmount = this.roundMoney(Number(row.handover_amount ?? 0) - Number(row.allocated_amount ?? 0));
                if (availableAmount <= 0) {
                    continue;
                }
                const allocationAmount = this.roundMoney(Math.min(remainingToAllocate, availableAmount));
                if (allocationAmount <= 0) {
                    break;
                }
                preparedDepositAllocations.push({
                    handover_entry_id: Number(row.journal_entry_id),
                    allocated_amount: allocationAmount,
                });
                linkedHandovers.push({
                    handover_entry_id: Number(row.journal_entry_id),
                    allocated_amount: allocationAmount,
                    reference_id: row.reference_id ?? null,
                    description: row.description ?? null,
                    business_date: row.business_date ?? null,
                });
                remainingToAllocate = this.roundMoney(remainingToAllocate - allocationAmount);
            }

            if (remainingToAllocate > 0) {
                throw new BadRequestException('Selected handover documents do not cover the full deposit amount.');
            }
        }

        if (dto.movement_type === TreasuryMovementType.TRANSIT_TO_BANK && requestedDepositEntryIds.length > 0) {
            const depositBatchRows = await this.dataSource.query(
                `
                SELECT
                  deposit_entry.id AS deposit_entry_id,
                  deposit_entry.transaction_date,
                  deposit_entry.business_date,
                  deposit_entry.reference_id,
                  deposit_entry.description,
                  transit_item.debit AS deposit_amount,
                  COALESCE(clear_alloc.cleared_amount, 0) AS cleared_amount
                FROM accounting_journal_entries deposit_entry
                INNER JOIN accounting_journal_items transit_item
                  ON transit_item.entry_id = deposit_entry.id
                 AND transit_item.debit > 0
                 AND transit_item.account_id = ?
                LEFT JOIN (
                  SELECT
                    deposit_entry_id,
                    COALESCE(SUM(allocated_amount), 0) AS cleared_amount
                  FROM accounting_treasury_deposit_clearance_allocations
                  WHERE client_id = ?
                    AND branch_id = ?
                  GROUP BY deposit_entry_id
                ) clear_alloc
                  ON clear_alloc.deposit_entry_id = deposit_entry.id
                WHERE deposit_entry.client_id = ?
                  AND deposit_entry.branch_id = ?
                  AND deposit_entry.source_event = 'cash_deposit_to_transit'
                  AND deposit_entry.id IN (${requestedDepositEntryIds.map(() => '?').join(', ')})
                ORDER BY deposit_entry.transaction_date ASC, deposit_entry.id ASC
                `,
                [sourceAccount.id, clientId, dto.branch_id, clientId, dto.branch_id, ...requestedDepositEntryIds],
            );

            if (depositBatchRows.length !== requestedDepositEntryIds.length) {
                throw new BadRequestException('One or more selected deposit batches are invalid for the selected bank-in-transit account.');
            }

            let remainingToClear = amount;
            for (const row of depositBatchRows) {
                const availableAmount = this.roundMoney(Number(row.deposit_amount ?? 0) - Number(row.cleared_amount ?? 0));
                if (availableAmount <= 0) {
                    continue;
                }
                const allocationAmount = this.roundMoney(Math.min(remainingToClear, availableAmount));
                if (allocationAmount <= 0) {
                    break;
                }
                preparedClearanceAllocations.push({
                    deposit_entry_id: Number(row.deposit_entry_id),
                    allocated_amount: allocationAmount,
                });
                linkedDepositBatches.push({
                    deposit_entry_id: Number(row.deposit_entry_id),
                    allocated_amount: allocationAmount,
                    reference_id: row.reference_id ?? null,
                    description: row.description ?? null,
                    business_date: row.business_date ?? null,
                });
                remainingToClear = this.roundMoney(remainingToClear - allocationAmount);
            }

            if (remainingToClear > 0) {
                throw new BadRequestException('Selected deposit batches do not cover the full bank-clearance amount.');
            }
        }

        const description = dto.description?.trim()
            || (dto.movement_type === TreasuryMovementType.CASH_TO_SAFE
                ? `Cash handover from ${sourceAccount.account_name} to ${destinationAccount.account_name}`
                : dto.movement_type === TreasuryMovementType.CASH_TO_BANK
                ? `Cash deposit from ${sourceAccount.account_name} to ${destinationAccount.account_name}`
                : dto.movement_type === TreasuryMovementType.CASH_DEPOSIT_TO_TRANSIT
                    ? `Cash deposit sent from ${sourceAccount.account_name} to bank-in-transit`
                    : dto.movement_type === TreasuryMovementType.TRANSIT_TO_BANK
                        ? `Bank deposit cleared from transit into ${destinationAccount.account_name}`
                : dto.movement_type === TreasuryMovementType.BANK_TO_CASH
                    ? `Cash withdrawal from ${sourceAccount.account_name} to ${destinationAccount.account_name}`
                    : `Treasury transfer from ${sourceAccount.account_name} to ${destinationAccount.account_name}`);

        const journal = await this.createJournalEntry(
            clientId,
            dto.branch_id,
            {
                branch_id: dto.branch_id,
                transaction_date: new Date(`${dto.date}T12:00:00`),
                business_date: dto.date,
                description,
                reference_id: dto.reference_no?.trim() || `TR-${dto.source_account_id}-${dto.destination_account_id}`,
                source_module: 'accounting',
                source_entity_type: 'treasury_movement',
                source_entity_id: `${dto.source_account_id}:${dto.destination_account_id}:${dto.date}:${amount}`,
                source_event: dto.movement_type,
                posting_type: 'manual',
                items: [
                    { account_id: destinationAccount.id, debit: amount, credit: 0 },
                    { account_id: sourceAccount.id, debit: 0, credit: amount },
                ],
            },
            user,
        );

        if (preparedDepositAllocations.length > 0) {
            await this.treasuryDepositAllocationRepo.save(
                preparedDepositAllocations.map((row) => this.treasuryDepositAllocationRepo.create({
                    client_id: clientId,
                    branch_id: dto.branch_id,
                    deposit_entry_id: Number(journal.id),
                    handover_entry_id: row.handover_entry_id,
                    allocated_amount: row.allocated_amount,
                })),
            );
        }
        if (preparedClearanceAllocations.length > 0) {
            await this.treasuryDepositClearanceAllocationRepo.save(
                preparedClearanceAllocations.map((row) => this.treasuryDepositClearanceAllocationRepo.create({
                    client_id: clientId,
                    branch_id: dto.branch_id,
                    deposit_entry_id: row.deposit_entry_id,
                    clearance_entry_id: Number(journal.id),
                    allocated_amount: row.allocated_amount,
                })),
            );
        }

        return {
            movement_type: dto.movement_type,
            amount,
            branch_id: dto.branch_id,
            source_account: {
                id: sourceAccount.id,
                account_code: sourceAccount.account_code,
                account_name: sourceAccount.account_name,
            },
            destination_account: {
                id: destinationAccount.id,
                account_code: destinationAccount.account_code,
                account_name: destinationAccount.account_name,
            },
            linked_handovers: linkedHandovers,
            linked_deposit_batches: linkedDepositBatches,
            journal,
        };
    }

    async createCounterCloseSafeHandover(
        clientId: string,
        branchId: number,
        amount: number,
        businessDate: string,
        referenceNo: string,
        description: string,
        user?: JwtPayload,
    ) {
        const roundedAmount = this.roundMoney(amount);
        if (roundedAmount <= 0) {
            return null;
        }

        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId, 'post counter-close safe handover');

        const [cashOnHandAccount, branchSafeAccount] = await Promise.all([
            this.coaRepo.findOne({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    account_code: '1101',
                    is_active: true,
                } as any,
            }),
            this.coaRepo.findOne({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    account_code: '1105',
                    is_active: true,
                } as any,
            }),
        ]);

        if (!cashOnHandAccount || !branchSafeAccount) {
            throw new BadRequestException('Branch cash-on-hand or branch-safe account is not configured for automatic counter-close handover.');
        }

        return this.createTreasuryMovement(
            clientId,
            {
                branch_id: branchId,
                movement_type: TreasuryMovementType.CASH_TO_SAFE,
                source_account_id: Number(cashOnHandAccount.id),
                destination_account_id: Number(branchSafeAccount.id),
                amount: roundedAmount,
                date: businessDate,
                reference_no: referenceNo,
                description,
            },
            user,
        );
    }

    async createMerchantSettlement(
        clientId: string,
        dto: {
            branch_id: number;
            channel: string;
            bank_account_id: number;
            gross_amount: number;
            charges_amount: number;
            date: string;
            provider_name?: string;
            reference_no?: string;
            description?: string;
        },
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'post merchant settlements');
        await this.ensureBaseChart(clientId);

        const grossAmount = this.roundMoney(dto.gross_amount);
        const chargesAmount = this.roundMoney(dto.charges_amount);
        if (grossAmount <= 0) {
            throw new BadRequestException('Merchant settlement gross amount must be greater than zero.');
        }
        if (chargesAmount < 0) {
            throw new BadRequestException('Merchant settlement charges cannot be negative.');
        }
        if (chargesAmount - grossAmount > 0.009) {
            throw new BadRequestException('Merchant settlement charges cannot exceed the gross amount.');
        }

        const [bankAccount, merchantClearingAccount, bankChargesAccount] = await Promise.all([
            this.resolveMerchantSettlementBankAccount(clientId, dto.branch_id, dto.bank_account_id),
            this.ensureDefaultAccount(clientId, '1103', 'Merchant Settlement Clearing', 'asset'),
            this.ensureDefaultAccount(clientId, '5600', 'Bank Charges', 'expense'),
        ]);

        const netAmount = this.roundMoney(grossAmount - chargesAmount);
        const providerLabel = dto.provider_name?.trim() || 'Merchant Processor';
        const channelNormalized = String(dto.channel || '').trim().toLowerCase();
        const channelLabel = channelNormalized === 'digital_wallet'
            ? 'Digital Wallet'
            : channelNormalized === 'card'
                ? 'Card'
                : 'Other Merchant';
        const description = dto.description?.trim()
            || `${channelLabel} settlement from ${providerLabel} into ${bankAccount.account_name}`;

        const journal = await this.createJournalEntry(
            clientId,
            dto.branch_id,
            {
                branch_id: dto.branch_id,
                transaction_date: new Date(`${dto.date}T12:00:00`),
                business_date: dto.date,
                description,
                reference_id: dto.reference_no?.trim() || `MSET-${dto.branch_id}-${dto.bank_account_id}`,
                source_module: 'accounting',
                source_entity_type: 'merchant_settlement',
                source_entity_id: `${dto.branch_id}:${dto.bank_account_id}:${channelNormalized || 'other'}:${providerLabel}:${dto.date}:${grossAmount}`,
                source_event: 'merchant_settlement',
                posting_type: 'manual',
                items: [
                    { account_id: bankAccount.id, debit: netAmount, credit: 0 },
                    ...(chargesAmount > 0 ? [{ account_id: bankChargesAccount.id, debit: chargesAmount, credit: 0 }] : []),
                    { account_id: merchantClearingAccount.id, debit: 0, credit: grossAmount },
                ],
            },
            user,
        );

        return {
            branch_id: dto.branch_id,
            channel: channelNormalized || 'other',
            provider_name: providerLabel,
            gross_amount: grossAmount,
            charges_amount: chargesAmount,
            net_amount: netAmount,
            bank_account: {
                id: bankAccount.id,
                account_code: bankAccount.account_code,
                account_name: bankAccount.account_name,
            },
            clearing_account: {
                id: merchantClearingAccount.id,
                account_code: merchantClearingAccount.account_code,
                account_name: merchantClearingAccount.account_name,
            },
            charges_account: {
                id: bankChargesAccount.id,
                account_code: bankChargesAccount.account_code,
                account_name: bankChargesAccount.account_name,
            },
            journal,
        };
    }

    async getBankReconciliationAccounts(clientId: string, accessibleBranchIds?: number[]) {
        await this.ensureBaseChart(clientId);
        const query = this.coaRepo.createQueryBuilder('account')
            .where('account.client_id = :clientId', { clientId })
            .andWhere('(account.is_bank_account = true OR account.account_code = :bankCode)', { bankCode: '1102' })
            .orderBy('account.account_code', 'ASC');

        if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            query.andWhere('(account.branch_id IS NULL OR account.branch_id IN (:...accessibleBranchIds))', { accessibleBranchIds });
        }

        return query.getMany();
    }

    async getBankReconciliation(
        clientId: string,
        accountId: number,
        branchId?: number,
        dateFrom?: string,
        dateTo?: string,
        activityType?: string,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const account = await this.coaRepo.findOne({ where: { id: accountId, client_id: clientId } });
        if (!account) {
            throw new NotFoundException(`Account ${accountId} not found`);
        }

        const query = this.entryRepo.createQueryBuilder('entry')
            .innerJoinAndSelect('entry.items', 'item', 'item.account_id = :accountId', { accountId })
            .leftJoinAndMapOne(
                'item.reconciliation',
                AccountingBankReconciliation,
                'reconciliation',
                'reconciliation.journal_item_id = item.id',
            )
            .where('entry.client_id = :clientId', { clientId });

        if (branchId) {
            query.andWhere('entry.branch_id = :branchId', { branchId });
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            query.andWhere('entry.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }
        if (dateFrom) {
            query.andWhere('entry.transaction_date >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            query.andWhere('entry.transaction_date <= :dateTo', { dateTo });
        }

        const entries = await query.orderBy('entry.transaction_date', 'DESC').addOrderBy('entry.id', 'DESC').getMany();
        const voucherIds = Array.from(new Set(
            entries
                .filter((entry: any) => entry.source_entity_type === 'financial_voucher' && entry.source_entity_id)
                .map((entry: any) => Number(entry.source_entity_id))
                .filter((id) => Number.isInteger(id) && id > 0),
        ));
        const voucherMap = new Map<number, {
            voucher_type: string | null;
            payment_method: string | null;
            payment_source_label: string | null;
            treasury_account_id: number | null;
            treasury_account_code: string | null;
            treasury_account_name: string | null;
        }>();
        if (voucherIds.length > 0) {
            const placeholders = voucherIds.map(() => '?').join(', ');
            const voucherRows = await this.dataSource.query(
                `
                SELECT
                  voucher.id,
                  voucher.type AS voucher_type,
                  voucher.payment_method,
                  voucher.payment_source_label,
                  voucher.treasury_account_id,
                  treasury.account_code AS treasury_account_code,
                  treasury.account_name AS treasury_account_name
                FROM financial_vouchers
                voucher
                LEFT JOIN accounting_coa treasury
                  ON treasury.id = voucher.treasury_account_id
                 AND treasury.client_id = voucher.client_id
                WHERE voucher.client_id = ?
                  AND voucher.id IN (${placeholders})
                `,
                [clientId, ...voucherIds],
            );
            for (const row of voucherRows) {
                voucherMap.set(Number(row.id), {
                    voucher_type: row.voucher_type ?? null,
                    payment_method: row.payment_method ?? null,
                    payment_source_label: row.payment_source_label ?? null,
                    treasury_account_id: row.treasury_account_id ? Number(row.treasury_account_id) : null,
                    treasury_account_code: row.treasury_account_code ?? null,
                    treasury_account_name: row.treasury_account_name ?? null,
                });
            }
        }
        const normalizedActivityType = String(activityType ?? 'all').trim().toLowerCase();
        const allTransactions = entries.flatMap((entry) => (entry.items ?? []).map((item: any) => {
            const amount = this.roundMoney(this.normalizeAmount(item.debit) - this.normalizeAmount(item.credit));
            const reconciliation = item.reconciliation ?? null;
            const linkedVoucher = entry.source_entity_type === 'financial_voucher'
                ? voucherMap.get(Number(entry.source_entity_id))
                : null;
            const sourceActivityType = linkedVoucher?.voucher_type === 'PAYMENT'
                ? 'vendor_payment'
                : 'other';
            const treasuryClassification = linkedVoucher?.voucher_type === 'PAYMENT'
                ? 'vendor_payment'
                : entry.source_event === 'cash_to_bank'
                    ? 'cash_deposit'
                    : entry.source_event === 'transit_to_bank'
                        ? 'deposit_cleared'
                    : entry.source_event === 'bank_to_cash'
                        ? 'withdrawal'
                        : entry.source_event === 'treasury_transfer'
                            ? 'internal_transfer'
                            : entry.source_event === 'merchant_settlement'
                                ? 'merchant_settlement'
                            : 'other';
            const treasuryClassificationLabel = treasuryClassification === 'vendor_payment'
                ? 'Vendor Payment'
                : treasuryClassification === 'cash_deposit'
                    ? 'Cash Deposit'
                    : treasuryClassification === 'deposit_cleared'
                        ? 'Deposit Cleared To Bank'
                    : treasuryClassification === 'withdrawal'
                        ? 'Bank Withdrawal'
                        : treasuryClassification === 'internal_transfer'
                            ? 'Internal Transfer'
                            : treasuryClassification === 'merchant_settlement'
                                ? 'Merchant Settlement'
                            : 'Other Bank Activity';
            const closeImpact = reconciliation
                ? 'cleared'
                : sourceActivityType === 'vendor_payment'
                    ? 'close_blocker'
                    : 'follow_up';
            return {
                journal_entry_id: entry.id,
                journal_item_id: item.id,
                transaction_date: entry.transaction_date,
                description: entry.description,
                reference_id: entry.reference_id,
                source_module: entry.source_module ?? null,
                source_event: entry.source_event ?? null,
                amount,
                type: amount >= 0 ? 'credit' : 'debit',
                payment_method: linkedVoucher?.payment_method ?? null,
                payment_source_label: linkedVoucher?.payment_source_label ?? null,
                treasury_account_id: linkedVoucher?.treasury_account_id ?? null,
                treasury_account_code: linkedVoucher?.treasury_account_code ?? null,
                treasury_account_name: linkedVoucher?.treasury_account_name ?? null,
                activity_type: sourceActivityType,
                treasury_classification: treasuryClassification,
                treasury_classification_label: treasuryClassificationLabel,
                close_impact: closeImpact,
                review_status: closeImpact === 'close_blocker'
                    ? 'Month-close blocker'
                    : closeImpact === 'follow_up'
                        ? 'Treasury follow-up'
                        : 'Cleared',
                match_status: reconciliation ? 'matched' : 'unmatched',
                reconciliation: reconciliation
                    ? {
                        id: reconciliation.id,
                        statement_date: reconciliation.statement_date,
                        statement_reference: reconciliation.statement_reference,
                        statement_description: reconciliation.statement_description,
                        reconciled_amount: this.roundMoney(reconciliation.reconciled_amount),
                        reconciled_at: reconciliation.reconciled_at,
                    }
                    : null,
            };
        }));

        const transactions = allTransactions.filter((item) => {
            if (normalizedActivityType === 'vendor_payments') {
                return item.activity_type === 'vendor_payment';
            }
            if (normalizedActivityType === 'other') {
                return item.activity_type === 'other';
            }
            return true;
        });

        const matched = transactions.filter((item) => item.match_status === 'matched');
        const unmatched = transactions.filter((item) => item.match_status === 'unmatched');
        const vendorPaymentTransactions = allTransactions.filter((item) => item.activity_type === 'vendor_payment');
        const otherTransactions = allTransactions.filter((item) => item.activity_type === 'other');
        const unmatchedVendorPayments = vendorPaymentTransactions.filter((item) => item.match_status === 'unmatched');
        const unmatchedOtherTransactions = otherTransactions.filter((item) => item.match_status === 'unmatched');
        const closeBlockers = transactions.filter((item) => item.close_impact === 'close_blocker');
        const followUps = transactions.filter((item) => item.close_impact === 'follow_up');
        const classificationSummaryMap = new Map<string, { key: string; label: string; count: number; amount: number }>();
        for (const row of allTransactions) {
            const key = row.treasury_classification ?? 'other';
            const current = classificationSummaryMap.get(key) ?? {
                key,
                label: row.treasury_classification_label ?? 'Other Bank Activity',
                count: 0,
                amount: 0,
            };
            current.count += 1;
            current.amount += Math.abs(row.amount);
            classificationSummaryMap.set(key, current);
        }

        return {
            account: {
                id: account.id,
                account_code: account.account_code,
                account_name: account.account_name,
            },
            summary: {
                matched_count: matched.length,
                unmatched_count: unmatched.length,
                matched_amount: this.roundMoney(matched.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                unmatched_amount: this.roundMoney(unmatched.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
            },
            activity_summary: {
                vendor_payment_count: vendorPaymentTransactions.length,
                vendor_payment_amount: this.roundMoney(vendorPaymentTransactions.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                other_count: otherTransactions.length,
                other_amount: this.roundMoney(otherTransactions.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                unmatched_vendor_payment_count: unmatchedVendorPayments.length,
                unmatched_vendor_payment_amount: this.roundMoney(unmatchedVendorPayments.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                unmatched_other_count: unmatchedOtherTransactions.length,
                unmatched_other_amount: this.roundMoney(unmatchedOtherTransactions.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
            },
            classification_summary: Array.from(classificationSummaryMap.values())
                .map((row) => ({
                    ...row,
                    amount: this.roundMoney(row.amount),
                }))
                .sort((left, right) => right.amount - left.amount),
            governance_summary: {
                close_blocker_count: closeBlockers.length,
                close_blocker_amount: this.roundMoney(closeBlockers.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                follow_up_count: followUps.length,
                follow_up_amount: this.roundMoney(followUps.reduce((sum, row) => sum + Math.abs(row.amount), 0)),
                status: closeBlockers.length > 0 ? 'attention' : 'ready',
                top_issue: closeBlockers.length > 0
                    ? 'Unmatched vendor-payment bank lines are blocking close.'
                    : followUps.length > 0
                        ? 'Other unmatched bank lines still need treasury follow-up.'
                        : 'Bank reconciliation is currently clear for the selected scope.',
            },
            transactions,
        };
    }

    async createBankReconciliation(
        clientId: string,
        branchId: number,
        dto: CreateBankReconciliationDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId, 'reconcile bank transactions');
        if (accessibleBranchIds && accessibleBranchIds.length > 0 && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }

        const journalEntry = await this.entryRepo.findOne({
            where: { id: dto.journal_entry_id, client_id: clientId, branch_id: branchId },
            relations: ['items'],
        });
        if (!journalEntry) {
            throw new NotFoundException('Journal entry not found');
        }

        const journalItem = (journalEntry.items ?? []).find((item) => item.id === dto.journal_item_id && item.account_id === dto.account_id);
        if (!journalItem) {
            throw new BadRequestException('Selected journal line does not belong to the supplied account.');
        }

        const existing = await this.bankReconciliationRepo.findOne({
            where: { journal_item_id: dto.journal_item_id, client_id: clientId },
        });
        if (existing) {
            throw new BadRequestException('This journal line is already reconciled.');
        }

        const amount = dto.amount ?? Math.abs(this.normalizeAmount(journalItem.debit) - this.normalizeAmount(journalItem.credit));
        const actorId = resolveActorId(user);

        const record = this.bankReconciliationRepo.create({
            client_id: clientId,
            branch_id: branchId,
            account_id: dto.account_id,
            journal_entry_id: dto.journal_entry_id,
            journal_item_id: dto.journal_item_id,
            statement_date: dto.statement_date,
            statement_reference: dto.statement_reference.trim(),
            statement_description: dto.statement_description?.trim() || null,
            reconciled_amount: this.roundMoney(amount),
            notes: dto.notes?.trim() || null,
            reconciled_by_user_id: actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null,
            reconciled_by_name: this.resolveActorName(user),
            reconciled_at: new Date(),
        });

        return this.bankReconciliationRepo.save(record);
    }

    async getProfitAndLoss(clientId: string, branchId?: number, startDate?: string, endDate?: string) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        let dateFilter = '';
        const params: any[] = [clientId];

        if (branchId) {
            dateFilter += ' AND entry.branch_id = ?';
            params.push(branchId);
        }
        if (startDate) {
            dateFilter += ' AND entry.transaction_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND entry.transaction_date <= ?';
            params.push(endDate);
        }

        const query = `
            SELECT
                coa.account_code,
                coa.account_name,
                coa.account_type,
                SUM(items.debit) as total_debit,
                SUM(items.credit) as total_credit
            FROM accounting_coa coa
            LEFT JOIN accounting_journal_items items ON coa.id = items.account_id
            LEFT JOIN accounting_journal_entries entry ON items.entry_id = entry.id
            WHERE coa.client_id = ?
              AND coa.account_type IN ('revenue', 'expense')
              ${dateFilter}
            GROUP BY coa.id
            ORDER BY coa.account_code ASC
        `;

        const balances = await this.dataSource.query(query, params);

        let totalRevenue = 0;
        let totalExpenses = 0;

        balances.forEach((balance: any) => {
            balance.total_debit = this.normalizeAmount(balance.total_debit);
            balance.total_credit = this.normalizeAmount(balance.total_credit);

            if (balance.account_type === 'revenue') {
                balance.net_balance = balance.total_credit - balance.total_debit;
                totalRevenue += balance.net_balance;
            } else if (balance.account_type === 'expense') {
                balance.net_balance = balance.total_debit - balance.total_credit;
                totalExpenses += balance.net_balance;
            }
        });
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? null);
        const revenueAccounts = balances.filter((balance: any) => balance.account_type === 'revenue' && Math.abs(Number(balance.net_balance ?? 0)) > 0.009).length;
        const expenseAccounts = balances.filter((balance: any) => balance.account_type === 'expense' && Math.abs(Number(balance.net_balance ?? 0)) > 0.009).length;
        const grossMargin = this.roundMoney(totalRevenue - totalExpenses);

        return {
            period: {
                date_from: startDate ?? null,
                date_to: endDate ?? null,
            },
            period_lock: {
                mode: effectiveLock?.mode ?? PeriodLockMode.NONE,
                locked_through_date: effectiveLock?.locked_through_date ?? null,
                scope: effectiveLock?.branch_id ? 'branch' : 'company',
            },
            accounts: balances,
            summary: {
                total_revenue: this.roundMoney(totalRevenue),
                total_expenses: this.roundMoney(totalExpenses),
                net_profit: this.roundMoney(totalRevenue - totalExpenses),
                gross_margin: grossMargin,
                revenue_account_count: revenueAccounts,
                expense_account_count: expenseAccounts,
                is_profitable: grossMargin >= 0,
            },
        };
    }

    async getBalanceSheet(clientId: string, branchId?: number, asOfDate?: string) {
        await this.ensureBaseChart(clientId);
        await this.assertBranchBelongsToClient(clientId, branchId);

        let dateFilter = '';
        const params: any[] = [clientId];

        if (branchId) {
            dateFilter += ' AND entry.branch_id = ?';
            params.push(branchId);
        }
        if (asOfDate) {
            dateFilter += ' AND entry.transaction_date <= ?';
            params.push(asOfDate);
        }

        const query = `
            SELECT
                coa.account_code,
                coa.account_name,
                coa.account_type,
                SUM(items.debit) as total_debit,
                SUM(items.credit) as total_credit
            FROM accounting_coa coa
            LEFT JOIN accounting_journal_items items ON coa.id = items.account_id
            LEFT JOIN accounting_journal_entries entry ON items.entry_id = entry.id
            WHERE coa.client_id = ?
              AND coa.account_type IN ('asset', 'liability', 'equity')
              ${dateFilter}
            GROUP BY coa.id
            ORDER BY coa.account_code ASC
        `;

        const balances = await this.dataSource.query(query, params);

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        balances.forEach((balance: any) => {
            balance.total_debit = this.normalizeAmount(balance.total_debit);
            balance.total_credit = this.normalizeAmount(balance.total_credit);

            if (balance.account_type === 'asset') {
                balance.net_balance = balance.total_debit - balance.total_credit;
                totalAssets += balance.net_balance;
            } else if (balance.account_type === 'liability') {
                balance.net_balance = balance.total_credit - balance.total_debit;
                totalLiabilities += balance.net_balance;
            } else if (balance.account_type === 'equity') {
                balance.net_balance = balance.total_credit - balance.total_debit;
                totalEquity += balance.net_balance;
            }
        });

        const pnl = await this.getProfitAndLoss(clientId, branchId, undefined, asOfDate);
        const retainedEarnings = pnl.summary.net_profit;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retainedEarnings;
        const difference = this.roundMoney(totalAssets - totalLiabilitiesAndEquity);
        const effectiveLock = await this.getEffectivePeriodLock(clientId, branchId ?? null);

        return {
            as_of_date: asOfDate ?? null,
            period_lock: {
                mode: effectiveLock?.mode ?? PeriodLockMode.NONE,
                locked_through_date: effectiveLock?.locked_through_date ?? null,
                scope: effectiveLock?.branch_id ? 'branch' : 'company',
            },
            accounts: balances,
            summary: {
                total_assets: this.roundMoney(totalAssets),
                total_liabilities: this.roundMoney(totalLiabilities),
                total_equity: this.roundMoney(totalEquity),
                retained_earnings: this.roundMoney(retainedEarnings),
                total_liabilities_and_equity: this.roundMoney(totalLiabilitiesAndEquity),
                difference,
                is_balanced: Math.abs(difference) < 0.01,
                asset_account_count: balances.filter((balance: any) => balance.account_type === 'asset' && Math.abs(Number(balance.net_balance ?? 0)) > 0.009).length,
                liability_equity_account_count: balances.filter((balance: any) => (balance.account_type === 'liability' || balance.account_type === 'equity') && Math.abs(Number(balance.net_balance ?? 0)) > 0.009).length,
            },
        };
    }

    private diffInDaysInclusive(startDate: string, endDate: string): number {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
            throw new BadRequestException('Invalid payroll period supplied.');
        }
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    private resolvePayrollRunStatus(status?: string | null): AccountingPayrollRunStatus | undefined {
        const normalized = String(status ?? '').trim().toLowerCase();
        if (!normalized) {
            return undefined;
        }
        return Object.values(AccountingPayrollRunStatus).includes(normalized as AccountingPayrollRunStatus)
            ? (normalized as AccountingPayrollRunStatus)
            : undefined;
    }

    private async resolvePayrollRun(
        clientId: string,
        id: number,
        accessibleBranchIds?: number[],
    ) {
        const run = await this.payrollRunRepo.findOne({
            where: { id, client_id: clientId },
            relations: [
                'branch',
                'treasury_account',
                'accrual_journal_entry',
                'payment_journal_entry',
                'reversal_journal_entry',
                'lines',
                'lines.user',
            ],
        });
        if (!run || (accessibleBranchIds?.length && !accessibleBranchIds.includes(run.branch_id))) {
            throw new NotFoundException(`Payroll run #${id} not found.`);
        }
        return run;
    }

    private async resolvePayrollTreasuryAccount(
        clientId: string,
        branchId: number,
        treasuryAccountId: number,
        paymentMethod: PayrollPaymentMethod,
    ) {
        const account = await this.coaRepo.findOne({
            where: { id: treasuryAccountId, client_id: clientId },
        });
        if (!account) {
            throw new NotFoundException(`Treasury account ${treasuryAccountId} not found.`);
        }
        if (account.account_type !== AccountType.ASSET) {
            throw new BadRequestException('Payroll settlement account must be an asset account.');
        }
        if (account.scope === AccountScope.BRANCH && account.branch_id && account.branch_id !== branchId) {
            throw new BadRequestException('Selected treasury account is not available for this branch.');
        }
        if (paymentMethod === PayrollPaymentMethod.CASH && !account.is_cash_account) {
            throw new BadRequestException('Cash payroll settlement must use a cash treasury account.');
        }
        if (paymentMethod !== PayrollPaymentMethod.CASH && !account.is_bank_account) {
            throw new BadRequestException('Non-cash payroll settlement must use a bank treasury account.');
        }
        return account;
    }

    private buildPayrollRunNumber(branchCode: string | null | undefined, periodStart: string, sequence: number) {
        const normalizedBranchCode = String(branchCode || 'BR').trim().toUpperCase();
        return `PAY-${normalizedBranchCode}-${periodStart.slice(0, 7).replace('-', '')}-${String(sequence).padStart(3, '0')}`;
    }

    private buildPayrollBatchTitle(title: string | null | undefined, periodStart: string, periodEnd: string) {
        const customTitle = String(title || '').trim();
        if (customTitle) {
            return customTitle;
        }
        const monthLabel = this.buildPayrollPeriodMonth(periodStart);
        return `Payroll Batch ${monthLabel} (${periodStart} to ${periodEnd})`;
    }

    private buildPayrollPeriodMonth(periodStart: string) {
        const parsed = new Date(`${periodStart}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return periodStart.slice(0, 7);
        }
        return parsed.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    }

    private derivePayrollLinePayoutStatus(line: Pick<AccountingPayrollRunLine, 'payable_balance' | 'paid_amount'>): 'unpaid' | 'partial' | 'paid' {
        const paidAmount = this.roundMoney(Number(line.paid_amount ?? 0));
        const balance = this.roundMoney(Number(line.payable_balance ?? 0));
        if (balance <= 0 && paidAmount > 0) {
            return 'paid';
        }
        if (paidAmount > 0) {
            return 'partial';
        }
        return 'unpaid';
    }

    private calculatePayrollLinePaidDays(netAmount: number, paidAmount: number, payableDays: number) {
        if (netAmount <= 0 || paidAmount <= 0 || payableDays <= 0) {
            return 0;
        }
        if (paidAmount >= netAmount) {
            return payableDays;
        }
        return Math.min(payableDays, Math.floor((paidAmount / netAmount) * payableDays));
    }

    private isPayrollUserAssignedToBranch(
        user: { branchRoles?: Array<{ branch_id?: number | null }> | null; branch_id?: number | null; branch?: { id?: number | null } | null },
        branchId: number,
    ) {
        const directBranchId = Number(user.branch_id ?? user.branch?.id ?? 0);
        if (directBranchId > 0 && directBranchId === Number(branchId)) {
            return true;
        }
        return Array.isArray(user.branchRoles)
            && user.branchRoles.some((assignment) => Number(assignment.branch_id) === Number(branchId));
    }

    private async assertPayrollUserAssignedToBranch(clientId: string, branchId: number, userId: number) {
        const user = await this.userRepo.findOne({
            where: {
                id: userId,
                client_id: clientId,
                is_active: true,
            },
            relations: ['branchRoles', 'branch'],
        });
        if (!user) {
            throw new NotFoundException(`Employee ${userId} not found.`);
        }
        if (!this.isPayrollUserAssignedToBranch(user, branchId)) {
            throw new BadRequestException('Selected employee is not assigned to this branch.');
        }
        return user;
    }

    private normalizePayrollRecoveryTarget(balance: number, configuredRecovery: number, remainingNetCapacity: number) {
        if (remainingNetCapacity <= 0 || balance <= 0) {
            return 0;
        }
        const requested = configuredRecovery > 0 ? configuredRecovery : balance;
        return this.roundMoney(Math.max(0, Math.min(balance, requested, remainingNetCapacity)));
    }

    private mapPayrollRecoveryProfile(profile: AccountingPayrollRecoveryProfile | null | undefined, user: UserManagement, branchId: number) {
        return {
            id: profile?.id ?? null,
            branch_id: branchId,
            user_id: user.id,
            employee_id: user.employee_id ?? null,
            staff_name: user.full_name || user.user_name || `User ${user.id}`,
            employment_type: user.employment_type ?? null,
            salary_type: user.salary_type ?? null,
            current_salary: this.roundMoney(user.current_salary ?? 0),
            advance_balance: this.roundMoney(profile?.advance_balance ?? 0),
            loan_balance: this.roundMoney(profile?.loan_balance ?? 0),
            default_advance_recovery: this.roundMoney(profile?.default_advance_recovery ?? 0),
            default_loan_recovery: this.roundMoney(profile?.default_loan_recovery ?? 0),
            is_active: profile?.is_active ?? true,
            notes: profile?.notes ?? null,
            updated_at: profile?.updated_at ?? null,
        };
    }

    private mapPayrollComplianceSetting(setting: AccountingPayrollComplianceSetting | null | undefined, branchId: number) {
        return {
            id: setting?.id ?? null,
            branch_id: branchId,
            income_tax_rate: this.roundMoney(setting?.income_tax_rate ?? 0),
            income_tax_threshold: this.roundMoney(setting?.income_tax_threshold ?? 0),
            eobi_employee_fixed: this.roundMoney(setting?.eobi_employee_fixed ?? 0),
            eobi_employer_fixed: this.roundMoney(setting?.eobi_employer_fixed ?? 0),
            social_security_employee_rate: this.roundMoney(setting?.social_security_employee_rate ?? 0),
            social_security_employer_rate: this.roundMoney(setting?.social_security_employer_rate ?? 0),
            social_security_salary_cap: this.roundMoney(setting?.social_security_salary_cap ?? 0),
            notes: setting?.notes ?? null,
            is_active: setting?.is_active ?? false,
            updated_at: setting?.updated_at ?? null,
        };
    }

    private async buildPayrollLines(clientId: string, branchId: number, periodStart: string, periodEnd: string) {
        const totalPeriodDays = this.diffInDaysInclusive(periodStart, periodEnd);
        const users = await this.userRepo.find({
            where: {
                client_id: clientId,
                is_active: true,
            },
            relations: ['branchRoles', 'designation', 'department'],
            order: { full_name: 'ASC' },
        });

        const branchUsers = users.filter((user) =>
            Number(user.current_salary ?? 0) > 0
            && this.isPayrollUserAssignedToBranch(user, branchId),
        );

        if (branchUsers.length === 0) {
            throw new BadRequestException('No salaried staff are assigned to this branch for payroll.');
        }

        const recoveryProfiles = await this.payrollRecoveryProfileRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                user_id: In(branchUsers.map((user) => user.id)),
                is_active: true,
            },
        });
        const recoveryProfileByUserId = new Map<number, AccountingPayrollRecoveryProfile>(
            recoveryProfiles.map((profile) => [profile.user_id, profile]),
        );
        const complianceSetting = await this.payrollComplianceSettingRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: branchId,
                is_active: true,
            },
        });

        const userIds = branchUsers.map((user) => user.id);
        const priorArrearsRows = userIds.length > 0
            ? await this.payrollRunLineRepo.createQueryBuilder('line')
                .innerJoin('line.payroll_run', 'run')
                .select('line.user_id', 'user_id')
                .addSelect('SUM(COALESCE(line.payable_balance, 0))', 'arrears_amount')
                .where('run.client_id = :clientId', { clientId })
                .andWhere('run.branch_id = :branchId', { branchId })
                .andWhere('run.status IN (:...statuses)', {
                    statuses: [AccountingPayrollRunStatus.APPROVED, AccountingPayrollRunStatus.PARTIALLY_PAID],
                })
                .andWhere('run.period_end < :periodStart', { periodStart })
                .andWhere('line.user_id IN (:...userIds)', { userIds })
                .andWhere('COALESCE(line.payable_balance, 0) > 0')
                .groupBy('line.user_id')
                .getRawMany()
            : [];
        const arrearsByUserId = new Map<number, number>(
            priorArrearsRows.map((row: any) => [Number(row.user_id), this.roundMoney(row.arrears_amount ?? 0)]),
        );

        const logs = await this.attendanceRepo.find({
            where: {
                client_id: clientId,
                user_id: In(userIds),
            },
            order: { attendance_date: 'ASC' },
        });

        const scopedLogs = logs.filter((log) => log.attendance_date >= periodStart && log.attendance_date <= periodEnd);
        const logsByUser = new Map<number, AttendanceLog[]>();
        scopedLogs.forEach((log) => {
            const bucket = logsByUser.get(log.user_id) ?? [];
            bucket.push(log);
            logsByUser.set(log.user_id, bucket);
        });

        const lines = branchUsers.map((user) => {
            const employeeLogs = logsByUser.get(user.id) ?? [];
            const presentDays = employeeLogs.filter((log) => log.status === 'present').length;
            const lateDays = employeeLogs.filter((log) => log.status === 'late').length;
            const leaveDays = employeeLogs.filter((log) => log.status === 'leave').length;
            const recordedAbsentDays = employeeLogs.filter((log) => log.status === 'absent').length;
            const workingMinutes = employeeLogs.reduce((sum, log) => sum + Number(log.working_minutes ?? 0), 0);
            const recordedDays = presentDays + lateDays + leaveDays + recordedAbsentDays;
            const absentDays = Math.max(totalPeriodDays - recordedDays, 0) + recordedAbsentDays;
            const salaryRate = this.roundMoney(user.current_salary ?? 0);
            const salaryType = String(user.salary_type || 'monthly').trim().toLowerCase();

            let payableUnits = 0;
            let baseAmount = salaryRate;
            let grossAmount = salaryRate;

            if (salaryType.includes('hour')) {
                payableUnits = this.roundMoney(workingMinutes / 60);
                baseAmount = this.roundMoney(salaryRate * (totalPeriodDays * 8));
                grossAmount = this.roundMoney(salaryRate * payableUnits);
            } else if (salaryType.includes('day')) {
                payableUnits = presentDays + lateDays;
                baseAmount = this.roundMoney(salaryRate * totalPeriodDays);
                grossAmount = this.roundMoney(salaryRate * payableUnits);
            } else {
                payableUnits = this.roundMoney(presentDays + lateDays + leaveDays);
                baseAmount = salaryRate;
                grossAmount = this.roundMoney(totalPeriodDays > 0 ? (salaryRate * payableUnits) / totalPeriodDays : 0);
            }

            const attendanceDeductionAmount = this.roundMoney(Math.max(baseAmount - grossAmount, 0));
            const recoveryProfile = recoveryProfileByUserId.get(user.id);
            const advanceRecoveryAmount = this.normalizePayrollRecoveryTarget(
                this.roundMoney(recoveryProfile?.advance_balance ?? 0),
                this.roundMoney(recoveryProfile?.default_advance_recovery ?? 0),
                grossAmount,
            );
            const loanRecoveryAmount = this.normalizePayrollRecoveryTarget(
                this.roundMoney(recoveryProfile?.loan_balance ?? 0),
                this.roundMoney(recoveryProfile?.default_loan_recovery ?? 0),
                this.roundMoney(grossAmount - advanceRecoveryAmount),
            );
            const complianceBaseAmount = this.roundMoney(
                Number(complianceSetting?.social_security_salary_cap ?? 0) > 0
                    ? Math.min(grossAmount, Number(complianceSetting?.social_security_salary_cap ?? 0))
                    : grossAmount,
            );
            const incomeTaxAmount = this.roundMoney(
                complianceSetting && grossAmount >= Number(complianceSetting.income_tax_threshold ?? 0)
                    ? grossAmount * (Number(complianceSetting.income_tax_rate ?? 0) / 100)
                    : 0,
            );
            const eobiEmployeeAmount = this.roundMoney(
                complianceSetting && grossAmount > 0 ? Number(complianceSetting.eobi_employee_fixed ?? 0) : 0,
            );
            const eobiEmployerAmount = this.roundMoney(
                complianceSetting && grossAmount > 0 ? Number(complianceSetting.eobi_employer_fixed ?? 0) : 0,
            );
            const socialSecurityEmployeeAmount = this.roundMoney(
                complianceSetting ? complianceBaseAmount * (Number(complianceSetting.social_security_employee_rate ?? 0) / 100) : 0,
            );
            const socialSecurityEmployerAmount = this.roundMoney(
                complianceSetting ? complianceBaseAmount * (Number(complianceSetting.social_security_employer_rate ?? 0) / 100) : 0,
            );
            const employeeComplianceDeductionAmount = this.roundMoney(
                incomeTaxAmount + eobiEmployeeAmount + socialSecurityEmployeeAmount,
            );
            const employerContributionAmount = this.roundMoney(
                eobiEmployerAmount + socialSecurityEmployerAmount,
            );
            const currentPeriodNetAmount = this.roundMoney(Math.max(grossAmount - advanceRecoveryAmount - loanRecoveryAmount - employeeComplianceDeductionAmount, 0));
            const arrearsAmount = this.roundMoney(arrearsByUserId.get(user.id) ?? 0);
            const netAmount = this.roundMoney(currentPeriodNetAmount + arrearsAmount);
            const deductionAmount = this.roundMoney(
                attendanceDeductionAmount + advanceRecoveryAmount + loanRecoveryAmount + employeeComplianceDeductionAmount,
            );

            return {
                user_id: user.id,
                employee_id_snapshot: user.employee_id ?? null,
                staff_name_snapshot: user.full_name || user.user_name || `User ${user.id}`,
                department_name: user.department?.name ?? user.designation?.departmentName ?? null,
                employment_type_snapshot: user.employment_type ?? null,
                salary_type: user.salary_type ?? null,
                salary_rate: salaryRate,
                present_days: presentDays,
                late_days: lateDays,
                leave_days: leaveDays,
                absent_days: absentDays,
                working_minutes: workingMinutes,
                payable_days: presentDays + lateDays + leaveDays,
                payable_units: payableUnits,
                base_amount: baseAmount,
                gross_amount: grossAmount,
                attendance_deduction_amount: attendanceDeductionAmount,
                advance_recovery_amount: advanceRecoveryAmount,
                loan_recovery_amount: loanRecoveryAmount,
                income_tax_amount: incomeTaxAmount,
                eobi_employee_amount: eobiEmployeeAmount,
                eobi_employer_amount: eobiEmployerAmount,
                social_security_employee_amount: socialSecurityEmployeeAmount,
                social_security_employer_amount: socialSecurityEmployerAmount,
                employee_compliance_deduction_amount: employeeComplianceDeductionAmount,
                employer_contribution_amount: employerContributionAmount,
                deduction_amount: deductionAmount,
                arrears_amount: arrearsAmount,
                net_amount: netAmount,
                paid_days: 0,
                paid_amount: 0,
                payable_balance: netAmount,
                payout_status: 'unpaid' as const,
                paid_at: null,
                paid_by: null,
            };
        });

        const summary = lines.reduce(
            (accumulator, line) => ({
                employee_count: accumulator.employee_count + 1,
                total_base_amount: this.roundMoney(accumulator.total_base_amount + line.base_amount),
                total_gross_amount: this.roundMoney(accumulator.total_gross_amount + line.gross_amount),
                total_attendance_deduction_amount: this.roundMoney(accumulator.total_attendance_deduction_amount + line.attendance_deduction_amount),
                total_advance_recovery_amount: this.roundMoney(accumulator.total_advance_recovery_amount + line.advance_recovery_amount),
                total_loan_recovery_amount: this.roundMoney(accumulator.total_loan_recovery_amount + line.loan_recovery_amount),
                total_income_tax_amount: this.roundMoney(accumulator.total_income_tax_amount + line.income_tax_amount),
                total_eobi_employee_amount: this.roundMoney(accumulator.total_eobi_employee_amount + line.eobi_employee_amount),
                total_eobi_employer_amount: this.roundMoney(accumulator.total_eobi_employer_amount + line.eobi_employer_amount),
                total_social_security_employee_amount: this.roundMoney(accumulator.total_social_security_employee_amount + line.social_security_employee_amount),
                total_social_security_employer_amount: this.roundMoney(accumulator.total_social_security_employer_amount + line.social_security_employer_amount),
                total_employee_compliance_deduction_amount: this.roundMoney(accumulator.total_employee_compliance_deduction_amount + line.employee_compliance_deduction_amount),
                total_employer_contribution_amount: this.roundMoney(accumulator.total_employer_contribution_amount + line.employer_contribution_amount),
                total_deduction_amount: this.roundMoney(accumulator.total_deduction_amount + line.deduction_amount),
                total_arrears_amount: this.roundMoney(accumulator.total_arrears_amount + Number(line.arrears_amount ?? 0)),
                total_net_amount: this.roundMoney(accumulator.total_net_amount + line.net_amount),
                total_paid_amount: this.roundMoney(accumulator.total_paid_amount + Number(line.paid_amount ?? 0)),
                total_payable_balance: this.roundMoney(accumulator.total_payable_balance + Number(line.payable_balance ?? 0)),
            }),
            {
                employee_count: 0,
                total_base_amount: 0,
                total_gross_amount: 0,
                total_attendance_deduction_amount: 0,
                total_advance_recovery_amount: 0,
                total_loan_recovery_amount: 0,
                total_income_tax_amount: 0,
                total_eobi_employee_amount: 0,
                total_eobi_employer_amount: 0,
                total_social_security_employee_amount: 0,
                total_social_security_employer_amount: 0,
                total_employee_compliance_deduction_amount: 0,
                total_employer_contribution_amount: 0,
                total_deduction_amount: 0,
                total_arrears_amount: 0,
                total_net_amount: 0,
                total_paid_amount: 0,
                total_payable_balance: 0,
            },
        );

        return {
            total_period_days: totalPeriodDays,
            lines,
            summary,
        };
    }

    async getPayrollPreview(
        clientId: string,
        branchId: number,
        periodStart: string,
        periodEnd: string,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }

        const branch = await this.branchRepo.findOne({
            where: {
                id: branchId,
                client_id: clientId,
            },
        });

        const preview = await this.buildPayrollLines(clientId, branchId, periodStart, periodEnd);

        return {
            branch_id: branchId,
            branch_name: branch?.branch_name ?? `Branch ${branchId}`,
            period_start: periodStart,
            period_end: periodEnd,
            total_period_days: preview.total_period_days,
            employee_count: preview.summary.employee_count,
            summary: preview.summary,
            lines: preview.lines.map((line) => ({
                ...line,
                current_period_net_amount: this.roundMoney(Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0)),
                total_deduction_amount: line.deduction_amount,
            })),
        };
    }

    async getPayrollRecoveryProfiles(
        clientId: string,
        branchId: number,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }

        const users = await this.userRepo.find({
            where: {
                client_id: clientId,
                is_active: true,
            },
            relations: ['branchRoles'],
            order: { full_name: 'ASC' },
        });
        const branchUsers = users.filter((user) =>
            this.isPayrollUserAssignedToBranch(user, branchId)
            && Number(user.current_salary ?? 0) > 0,
        );

        const profiles = await this.payrollRecoveryProfileRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                ...(branchUsers.length ? { user_id: In(branchUsers.map((user) => user.id)) } : {}),
            },
            relations: ['user'],
            order: { updated_at: 'DESC', id: 'DESC' },
        });
        const profilesByUserId = new Map<number, AccountingPayrollRecoveryProfile>(
            profiles.map((profile) => [profile.user_id, profile]),
        );
        const rows = branchUsers.map((user) => this.mapPayrollRecoveryProfile(profilesByUserId.get(user.id), user, branchId));

        return {
            branch_id: branchId,
            profiles: rows,
            summary: {
                employee_count: rows.length,
                active_profile_count: rows.filter((row) => row.id && row.is_active).length,
                advance_balance: this.roundMoney(rows.reduce((sum, row) => sum + Number(row.advance_balance ?? 0), 0)),
                loan_balance: this.roundMoney(rows.reduce((sum, row) => sum + Number(row.loan_balance ?? 0), 0)),
                scheduled_advance_recovery: this.roundMoney(rows.reduce((sum, row) => sum + Number(row.default_advance_recovery ?? 0), 0)),
                scheduled_loan_recovery: this.roundMoney(rows.reduce((sum, row) => sum + Number(row.default_loan_recovery ?? 0), 0)),
            },
        };
    }

    async upsertPayrollRecoveryProfile(
        clientId: string,
        dto: {
            branch_id: number;
            user_id: number;
            advance_balance?: number;
            loan_balance?: number;
            default_advance_recovery?: number;
            default_loan_recovery?: number;
            notes?: string;
            is_active?: boolean;
        },
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'manage payroll recovery profiles');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
            throw new NotFoundException('Branch not found');
        }

        const targetUser = await this.userRepo.findOne({
            where: {
                id: dto.user_id,
                client_id: clientId,
                is_active: true,
            },
            relations: ['branchRoles', 'branch'],
        });
        if (!targetUser) {
            throw new NotFoundException('Staff member not found');
        }
        if (!this.isPayrollUserAssignedToBranch(targetUser, dto.branch_id)) {
            throw new BadRequestException('Staff member is not assigned to this branch.');
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const existing = await this.payrollRecoveryProfileRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                user_id: dto.user_id,
            },
        });

        const profile = existing ?? this.payrollRecoveryProfileRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
            user_id: dto.user_id,
        });
        profile.advance_balance = this.roundMoney(dto.advance_balance ?? profile.advance_balance ?? 0);
        profile.loan_balance = this.roundMoney(dto.loan_balance ?? profile.loan_balance ?? 0);
        profile.default_advance_recovery = this.roundMoney(dto.default_advance_recovery ?? profile.default_advance_recovery ?? 0);
        profile.default_loan_recovery = this.roundMoney(dto.default_loan_recovery ?? profile.default_loan_recovery ?? 0);
        profile.notes = dto.notes?.trim() || null;
        profile.is_active = dto.is_active ?? profile.is_active ?? true;
        profile.updated_by = actorUserId;
        const saved = await this.payrollRecoveryProfileRepo.save(profile);

        return this.mapPayrollRecoveryProfile(saved, targetUser, dto.branch_id);
    }

    async getPayrollComplianceSetting(
        clientId: string,
        branchId: number,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }
        const setting = await this.payrollComplianceSettingRepo.findOne({
            where: { client_id: clientId, branch_id: branchId },
        });
        return this.mapPayrollComplianceSetting(setting, branchId);
    }

    async upsertPayrollComplianceSetting(
        clientId: string,
        dto: {
            branch_id: number;
            income_tax_rate?: number;
            income_tax_threshold?: number;
            eobi_employee_fixed?: number;
            eobi_employer_fixed?: number;
            social_security_employee_rate?: number;
            social_security_employer_rate?: number;
            social_security_salary_cap?: number;
            notes?: string;
            is_active?: boolean;
        },
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'manage payroll compliance settings');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
            throw new NotFoundException('Branch not found');
        }
        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const existing = await this.payrollComplianceSettingRepo.findOne({
            where: { client_id: clientId, branch_id: dto.branch_id },
        });
        const setting = existing ?? this.payrollComplianceSettingRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
        });
        setting.income_tax_rate = this.roundMoney(dto.income_tax_rate ?? setting.income_tax_rate ?? 0);
        setting.income_tax_threshold = this.roundMoney(dto.income_tax_threshold ?? setting.income_tax_threshold ?? 0);
        setting.eobi_employee_fixed = this.roundMoney(dto.eobi_employee_fixed ?? setting.eobi_employee_fixed ?? 0);
        setting.eobi_employer_fixed = this.roundMoney(dto.eobi_employer_fixed ?? setting.eobi_employer_fixed ?? 0);
        setting.social_security_employee_rate = this.roundMoney(dto.social_security_employee_rate ?? setting.social_security_employee_rate ?? 0);
        setting.social_security_employer_rate = this.roundMoney(dto.social_security_employer_rate ?? setting.social_security_employer_rate ?? 0);
        setting.social_security_salary_cap = this.roundMoney(dto.social_security_salary_cap ?? setting.social_security_salary_cap ?? 0);
        setting.notes = dto.notes?.trim() || null;
        setting.is_active = dto.is_active ?? setting.is_active ?? true;
        setting.updated_by = actorUserId;
        const saved = await this.payrollComplianceSettingRepo.save(setting);
        return this.mapPayrollComplianceSetting(saved, dto.branch_id);
    }

    async getPayrollComplianceReview(
        clientId: string,
        branchId: number,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId, 'review payroll compliance');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }
        await this.ensureBaseChart(clientId);

        const [trialBalance, latestRun, recentSettlements, filingsPayload] = await Promise.all([
            this.getTrialBalance(clientId, branchId),
            this.payrollRunRepo.findOne({
                where: { client_id: clientId, branch_id: branchId },
                relations: ['branch'],
                order: { pay_date: 'DESC', id: 'DESC' },
            }),
            this.entryRepo.find({
                where: {
                    client_id: clientId,
                    branch_id: branchId,
                    source_entity_type: 'payroll_compliance',
                    source_event: 'payroll_statutory_payment',
                },
                relations: ['items', 'items.account'],
                order: { business_date: 'DESC', id: 'DESC' },
                take: 8,
            }),
            this.getPayrollComplianceFilings(clientId, branchId, accessibleBranchIds),
        ]);

        const withholdingTaxPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2302')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const eobiPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2303')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);
        const socialSecurityPayableBalance = (trialBalance.accounts ?? [])
            .filter((account: any) => account.account_code === '2304')
            .reduce((sum: number, account: any) => sum + this.normalizeAmount(account.net_balance), 0);

        const filings = Array.isArray(filingsPayload?.filings) ? filingsPayload.filings : [];
        const latestRelevantFiling = latestRun
            ? filings.find((filing: any) => (
                String(filing.period_start ?? '') <= String(latestRun.period_start ?? '')
                && String(filing.period_end ?? '') >= String(latestRun.period_end ?? '')
            ))
            : filings[0] ?? null;
        const filingDueDate = latestRun?.period_end ? this.addDays(String(latestRun.period_end), 15) : null;
        const isFilingOverdue = Boolean(latestRun?.period_end && filingDueDate && !latestRelevantFiling && filingDueDate < this.formatBusinessDate(new Date()));
        const overdueDays = filingDueDate ? this.calculateDaysBetween(filingDueDate, this.formatBusinessDate(new Date())) : 0;
        const unpaidFiledPeriodCount = latestRelevantFiling && this.roundMoney(
            withholdingTaxPayableBalance + eobiPayableBalance + socialSecurityPayableBalance,
        ) > 0.009 ? 1 : 0;

        return {
            branch_id: branchId,
            branch_name: latestRun?.branch?.branch_name ?? `Branch ${branchId}`,
            balances: {
                withholding_tax_payable_balance: this.roundMoney(withholdingTaxPayableBalance),
                eobi_payable_balance: this.roundMoney(eobiPayableBalance),
                social_security_payable_balance: this.roundMoney(socialSecurityPayableBalance),
                statutory_payable_balance: this.roundMoney(
                    withholdingTaxPayableBalance + eobiPayableBalance + socialSecurityPayableBalance,
                ),
            },
            latest_run: latestRun ? {
                id: latestRun.id,
                run_no: latestRun.run_no,
                status: latestRun.status,
                period_start: latestRun.period_start,
                period_end: latestRun.period_end,
                pay_date: latestRun.pay_date,
                employee_count: Number(latestRun.employee_count ?? 0),
            } : null,
            filing_review: {
                filing_count: filings.length,
                latest_filing_date: filings[0]?.filing_date ?? null,
                latest_filing_reference: filings[0]?.filing_reference ?? null,
                filing_due_date: filingDueDate,
                unfiled_period_count: latestRun && !latestRelevantFiling ? 1 : 0,
                overdue_unfiled_period_count: isFilingOverdue ? 1 : 0,
                unpaid_filed_period_count: unpaidFiledPeriodCount,
                overdue_days: isFilingOverdue ? overdueDays : 0,
                top_issue: isFilingOverdue
                    ? `Payroll statutory filing is overdue by ${overdueDays} day(s).`
                    : latestRun && !latestRelevantFiling
                        ? 'Payroll statutory filing is still pending for the latest payroll period.'
                        : unpaidFiledPeriodCount > 0
                            ? 'Payroll statutory filing exists, but settlement remains open.'
                            : 'Payroll compliance is current for the selected branch.',
            },
            recent_settlements: recentSettlements.map((entry) => {
                const withholdingTaxAmount = (entry.items ?? [])
                    .filter((item) => item.account?.account_code === '2302')
                    .reduce((sum, item) => sum + Number(item.debit ?? 0), 0);
                const eobiAmount = (entry.items ?? [])
                    .filter((item) => item.account?.account_code === '2303')
                    .reduce((sum, item) => sum + Number(item.debit ?? 0), 0);
                const socialSecurityAmount = (entry.items ?? [])
                    .filter((item) => item.account?.account_code === '2304')
                    .reduce((sum, item) => sum + Number(item.debit ?? 0), 0);
                const treasuryLine = (entry.items ?? []).find((item) => Number(item.credit ?? 0) > 0);

                return {
                    id: entry.id,
                    business_date: entry.business_date,
                    description: entry.description,
                    reference_id: entry.reference_id,
                    withholding_tax_amount: this.roundMoney(withholdingTaxAmount),
                    eobi_amount: this.roundMoney(eobiAmount),
                    social_security_amount: this.roundMoney(socialSecurityAmount),
                    total_amount: this.roundMoney(withholdingTaxAmount + eobiAmount + socialSecurityAmount),
                    treasury_account_name: treasuryLine?.account?.account_name ?? null,
                    treasury_account_code: treasuryLine?.account?.account_code ?? null,
                };
            }),
        };
    }

    async createPayrollComplianceSettlement(
        clientId: string,
        dto: CreatePayrollComplianceSettlementDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'settle payroll compliance liabilities');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
            throw new NotFoundException('Branch not found');
        }

        const withholdingTaxAmount = this.roundMoney(dto.withholding_tax_amount ?? 0);
        const eobiAmount = this.roundMoney(dto.eobi_amount ?? 0);
        const socialSecurityAmount = this.roundMoney(dto.social_security_amount ?? 0);
        const totalAmount = this.roundMoney(withholdingTaxAmount + eobiAmount + socialSecurityAmount);

        if (totalAmount <= 0) {
            throw new BadRequestException('Enter at least one statutory liability amount to settle.');
        }

        await this.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.payment_date, 'Payroll compliance settlement', user);

        const review = await this.getPayrollComplianceReview(clientId, dto.branch_id, accessibleBranchIds);
        if (withholdingTaxAmount > Number(review.balances.withholding_tax_payable_balance ?? 0) + 0.009) {
            throw new BadRequestException('Withholding tax settlement exceeds the current payable balance.');
        }
        if (eobiAmount > Number(review.balances.eobi_payable_balance ?? 0) + 0.009) {
            throw new BadRequestException('EOBI settlement exceeds the current payable balance.');
        }
        if (socialSecurityAmount > Number(review.balances.social_security_payable_balance ?? 0) + 0.009) {
            throw new BadRequestException('Social security settlement exceeds the current payable balance.');
        }

        const treasuryAccount = await this.resolvePayrollTreasuryAccount(
            clientId,
            dto.branch_id,
            dto.treasury_account_id,
            dto.payment_method,
        );
        const withholdingTaxPayable = await this.ensureDefaultAccount(clientId, '2302', 'Withholding Tax Payable', 'liability');
        const eobiPayable = await this.ensureDefaultAccount(clientId, '2303', 'EOBI Payable', 'liability');
        const socialSecurityPayable = await this.ensureDefaultAccount(clientId, '2304', 'Social Security Payable', 'liability');

        const items: CreateJournalEntryDto['items'] = [];
        if (withholdingTaxAmount > 0) {
            items.push({ account_id: withholdingTaxPayable.id, debit: withholdingTaxAmount, credit: 0 });
        }
        if (eobiAmount > 0) {
            items.push({ account_id: eobiPayable.id, debit: eobiAmount, credit: 0 });
        }
        if (socialSecurityAmount > 0) {
            items.push({ account_id: socialSecurityPayable.id, debit: socialSecurityAmount, credit: 0 });
        }
        items.push({ account_id: treasuryAccount.id, debit: 0, credit: totalAmount });

        const journal = await this.createJournalEntry(clientId, dto.branch_id, {
            branch_id: dto.branch_id,
            transaction_date: new Date(`${dto.payment_date}T12:00:00`),
            business_date: dto.payment_date,
            description: `Payroll statutory liability settlement${dto.note?.trim() ? ` - ${dto.note.trim()}` : ''}`,
            reference_id: dto.reference_no?.trim() || `PAYCOMP-${dto.branch_id}-${dto.payment_date}`,
            source_module: 'accounting',
            source_entity_type: 'payroll_compliance',
            source_entity_id: String(dto.branch_id),
            source_event: 'payroll_statutory_payment',
            posting_type: 'auto',
            items,
        }, user);

        return {
            journal_entry_id: journal.id,
            branch_id: dto.branch_id,
            payment_date: dto.payment_date,
            payment_method: dto.payment_method,
            treasury_account_id: treasuryAccount.id,
            treasury_account_name: treasuryAccount.account_name,
            withholding_tax_amount: withholdingTaxAmount,
            eobi_amount: eobiAmount,
            social_security_amount: socialSecurityAmount,
            total_amount: totalAmount,
            reference_no: dto.reference_no?.trim() || null,
            note: dto.note?.trim() || null,
            compliance_review: await this.getPayrollComplianceReview(clientId, dto.branch_id, accessibleBranchIds),
        };
    }

    async getPayrollComplianceFilings(
        clientId: string,
        branchId: number,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId, 'review payroll compliance filings');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new NotFoundException('Branch not found');
        }

        const filings = await this.payrollComplianceFilingRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
            },
            relations: ['branch'],
            order: {
                filing_date: 'DESC',
                id: 'DESC',
            },
        });

        return {
            filings: filings.map((filing) => ({
                id: filing.id,
                branch_id: filing.branch_id,
                branch_name: filing.branch?.branch_name ?? `Branch ${filing.branch_id}`,
                period_start: filing.period_start,
                period_end: filing.period_end,
                filing_date: filing.filing_date,
                withholding_tax_amount: this.roundMoney(filing.withholding_tax_amount),
                eobi_amount: this.roundMoney(filing.eobi_amount),
                social_security_amount: this.roundMoney(filing.social_security_amount),
                total_amount: this.roundMoney(filing.total_amount),
                filing_reference: filing.filing_reference,
                note: filing.note ?? null,
                status: filing.status,
                created_at: filing.created_at,
            })),
        };
    }

    async createPayrollComplianceFiling(
        clientId: string,
        dto: CreatePayrollComplianceFilingDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'file payroll compliance return');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
            throw new NotFoundException('Branch not found');
        }
        if (dto.period_end < dto.period_start) {
            throw new BadRequestException('Filing period end cannot be earlier than period start.');
        }

        const withholdingTaxAmount = this.roundMoney(dto.withholding_tax_amount ?? 0);
        const eobiAmount = this.roundMoney(dto.eobi_amount ?? 0);
        const socialSecurityAmount = this.roundMoney(dto.social_security_amount ?? 0);
        const totalAmount = this.roundMoney(withholdingTaxAmount + eobiAmount + socialSecurityAmount);
        if (totalAmount <= 0) {
            throw new BadRequestException('Filing must include at least one statutory amount.');
        }

        const existing = await this.payrollComplianceFilingRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                period_start: dto.period_start,
                period_end: dto.period_end,
                filing_reference: dto.filing_reference.trim(),
                status: AccountingPayrollComplianceFilingStatus.FILED,
            },
        });
        if (existing) {
            throw new BadRequestException('This payroll compliance filing reference is already recorded for the selected period.');
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const filing = this.payrollComplianceFilingRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
            period_start: dto.period_start,
            period_end: dto.period_end,
            filing_date: dto.filing_date,
            withholding_tax_amount: withholdingTaxAmount,
            eobi_amount: eobiAmount,
            social_security_amount: socialSecurityAmount,
            total_amount: totalAmount,
            filing_reference: dto.filing_reference.trim(),
            note: dto.note?.trim() || null,
            status: AccountingPayrollComplianceFilingStatus.FILED,
            created_by: actorUserId,
        });
        const saved = await this.payrollComplianceFilingRepo.save(filing);
        return {
            id: saved.id,
            branch_id: saved.branch_id,
            period_start: saved.period_start,
            period_end: saved.period_end,
            filing_date: saved.filing_date,
            withholding_tax_amount: this.roundMoney(saved.withholding_tax_amount),
            eobi_amount: this.roundMoney(saved.eobi_amount),
            social_security_amount: this.roundMoney(saved.social_security_amount),
            total_amount: this.roundMoney(saved.total_amount),
            filing_reference: saved.filing_reference,
            note: saved.note ?? null,
            status: saved.status,
            filings_review: await this.getPayrollComplianceFilings(clientId, dto.branch_id, accessibleBranchIds),
        };
    }

    async getPayrollRuns(
        clientId: string,
        branchId?: number,
        periodStart?: string,
        periodEnd?: string,
        status?: string,
        accessibleBranchIds?: number[],
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const where: any = { client_id: clientId };
        if (branchId) {
            where.branch_id = branchId;
        } else if (accessibleBranchIds?.length) {
            where.branch_id = In(accessibleBranchIds);
        }
        if (periodStart) {
            where.period_start = periodStart;
        }
        if (periodEnd) {
            where.period_end = periodEnd;
        }
        const normalizedStatus = this.resolvePayrollRunStatus(status);
        if (normalizedStatus) {
            where.status = normalizedStatus;
        }

        const runs = await this.payrollRunRepo.find({
            where,
            relations: ['branch', 'treasury_account'],
            order: {
                period_end: 'DESC',
                created_at: 'DESC',
            },
        });

        return {
            runs: runs.map((run) => ({
                id: run.id,
                run_no: run.run_no,
                title: run.title ?? this.buildPayrollBatchTitle(null, run.period_start, run.period_end),
                period_month: this.buildPayrollPeriodMonth(run.period_start),
                branch_id: run.branch_id,
                branch_name: run.branch?.branch_name ?? `Branch ${run.branch_id}`,
                period_start: run.period_start,
                period_end: run.period_end,
                pay_date: run.pay_date,
                status: run.status,
                employee_count: Number(run.employee_count ?? 0),
                total_base_amount: this.roundMoney(run.total_base_amount),
                total_gross_amount: this.roundMoney(run.total_gross_amount),
                total_attendance_deduction_amount: this.roundMoney(run.total_attendance_deduction_amount),
                total_advance_recovery_amount: this.roundMoney(run.total_advance_recovery_amount),
                total_loan_recovery_amount: this.roundMoney(run.total_loan_recovery_amount),
                total_income_tax_amount: this.roundMoney(run.total_income_tax_amount),
                total_eobi_employee_amount: this.roundMoney(run.total_eobi_employee_amount),
                total_eobi_employer_amount: this.roundMoney(run.total_eobi_employer_amount),
                total_social_security_employee_amount: this.roundMoney(run.total_social_security_employee_amount),
                total_social_security_employer_amount: this.roundMoney(run.total_social_security_employer_amount),
                total_employee_compliance_deduction_amount: this.roundMoney(run.total_employee_compliance_deduction_amount),
                total_employer_contribution_amount: this.roundMoney(run.total_employer_contribution_amount),
                total_deduction_amount: this.roundMoney(run.total_deduction_amount),
                total_net_amount: this.roundMoney(run.total_net_amount),
                total_paid_amount: this.roundMoney(run.total_paid_amount ?? 0),
                total_payable_balance: this.roundMoney(run.total_payable_balance ?? 0),
                payment_method: run.payment_method ?? null,
                treasury_account_name: run.treasury_account?.account_name ?? null,
                approved_at: run.approved_at ?? null,
                paid_at: run.paid_at ?? null,
                notes: run.notes ?? null,
                created_at: run.created_at,
            })),
            summary: {
                run_count: runs.length,
                total_net_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_net_amount ?? 0), 0)),
                total_advance_recovery_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_advance_recovery_amount ?? 0), 0)),
                total_loan_recovery_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_loan_recovery_amount ?? 0), 0)),
                total_employee_compliance_deduction_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_employee_compliance_deduction_amount ?? 0), 0)),
                total_employer_contribution_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_employer_contribution_amount ?? 0), 0)),
                total_paid_amount: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_paid_amount ?? 0), 0)),
                total_payable_balance: this.roundMoney(runs.reduce((sum, run) => sum + Number(run.total_payable_balance ?? 0), 0)),
                pending_count: runs.filter((run) => run.status === AccountingPayrollRunStatus.DRAFT).length,
                approved_count: runs.filter((run) => run.status === AccountingPayrollRunStatus.APPROVED).length,
                partial_count: runs.filter((run) => run.status === AccountingPayrollRunStatus.PARTIALLY_PAID).length,
                paid_count: runs.filter((run) => run.status === AccountingPayrollRunStatus.PAID).length,
                void_count: runs.filter((run) => run.status === AccountingPayrollRunStatus.VOID).length,
            },
        };
    }

    async getPayrollRun(
        clientId: string,
        id: number,
        accessibleBranchIds?: number[],
    ) {
        const run = await this.resolvePayrollRun(clientId, id, accessibleBranchIds);
        return {
            id: run.id,
            run_no: run.run_no,
            title: run.title ?? this.buildPayrollBatchTitle(null, run.period_start, run.period_end),
            period_month: this.buildPayrollPeriodMonth(run.period_start),
            branch_id: run.branch_id,
            branch_name: run.branch?.branch_name ?? `Branch ${run.branch_id}`,
            period_start: run.period_start,
            period_end: run.period_end,
            pay_date: run.pay_date,
            status: run.status,
            employee_count: Number(run.employee_count ?? 0),
            total_base_amount: this.roundMoney(run.total_base_amount),
            total_gross_amount: this.roundMoney(run.total_gross_amount),
            total_attendance_deduction_amount: this.roundMoney(run.total_attendance_deduction_amount),
            total_advance_recovery_amount: this.roundMoney(run.total_advance_recovery_amount),
            total_loan_recovery_amount: this.roundMoney(run.total_loan_recovery_amount),
            total_income_tax_amount: this.roundMoney(run.total_income_tax_amount),
            total_eobi_employee_amount: this.roundMoney(run.total_eobi_employee_amount),
            total_eobi_employer_amount: this.roundMoney(run.total_eobi_employer_amount),
            total_social_security_employee_amount: this.roundMoney(run.total_social_security_employee_amount),
            total_social_security_employer_amount: this.roundMoney(run.total_social_security_employer_amount),
            total_employee_compliance_deduction_amount: this.roundMoney(run.total_employee_compliance_deduction_amount),
            total_employer_contribution_amount: this.roundMoney(run.total_employer_contribution_amount),
            total_deduction_amount: this.roundMoney(run.total_deduction_amount),
            total_net_amount: this.roundMoney(run.total_net_amount),
            total_paid_amount: this.roundMoney(run.total_paid_amount ?? 0),
            total_payable_balance: this.roundMoney(run.total_payable_balance ?? 0),
            notes: run.notes ?? null,
            payment_method: run.payment_method ?? null,
            payment_reference_no: run.payment_reference_no ?? null,
            treasury_account_id: run.treasury_account_id ?? null,
            treasury_account_name: run.treasury_account?.account_name ?? null,
            treasury_account_code: run.treasury_account?.account_code ?? null,
            accrual_journal_entry_id: run.accrual_journal_entry_id ?? null,
            payment_journal_entry_id: run.payment_journal_entry_id ?? null,
            reversal_journal_entry_id: run.reversal_journal_entry_id ?? null,
            approved_at: run.approved_at ?? null,
            paid_at: run.paid_at ?? null,
            voided_at: run.voided_at ?? null,
            created_at: run.created_at,
            lines: (run.lines ?? [])
                .sort((left, right) => left.staff_name_snapshot.localeCompare(right.staff_name_snapshot))
                .map((line) => ({
                    id: line.id,
                    user_id: line.user_id,
                    employee_id: line.employee_id_snapshot,
                    staff_name: line.staff_name_snapshot,
                    employment_type: line.employment_type_snapshot,
                    salary_type: line.salary_type,
                    salary_rate: this.roundMoney(line.salary_rate),
                    present_days: Number(line.present_days ?? 0),
                    late_days: Number(line.late_days ?? 0),
                    leave_days: Number(line.leave_days ?? 0),
                    absent_days: Number(line.absent_days ?? 0),
                    working_minutes: Number(line.working_minutes ?? 0),
                    payable_days: Number(line.payable_days ?? 0),
                    payable_units: this.roundMoney(line.payable_units),
                    base_amount: this.roundMoney(line.base_amount),
                    gross_amount: this.roundMoney(line.gross_amount),
                    attendance_deduction_amount: this.roundMoney(line.attendance_deduction_amount),
                    advance_recovery_amount: this.roundMoney(line.advance_recovery_amount),
                    loan_recovery_amount: this.roundMoney(line.loan_recovery_amount),
                    income_tax_amount: this.roundMoney(line.income_tax_amount),
                    eobi_employee_amount: this.roundMoney(line.eobi_employee_amount),
                    eobi_employer_amount: this.roundMoney(line.eobi_employer_amount),
                    social_security_employee_amount: this.roundMoney(line.social_security_employee_amount),
                    social_security_employer_amount: this.roundMoney(line.social_security_employer_amount),
                    employee_compliance_deduction_amount: this.roundMoney(line.employee_compliance_deduction_amount),
                    employer_contribution_amount: this.roundMoney(line.employer_contribution_amount),
                    deduction_amount: this.roundMoney(line.deduction_amount),
                    arrears_amount: this.roundMoney(line.arrears_amount ?? 0),
                    net_amount: this.roundMoney(line.net_amount),
                    current_period_net_amount: this.roundMoney(
                        Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0),
                    ),
                    paid_days: Number(line.paid_days ?? 0),
                    paid_amount: this.roundMoney(line.paid_amount ?? 0),
                    payable_balance: this.roundMoney(line.payable_balance ?? 0),
                    payout_status: this.derivePayrollLinePayoutStatus(line),
                    paid_at: line.paid_at ?? null,
                })),
            payments: (await this.payrollPaymentRepo.find({
                where: { payroll_run_id: run.id },
                relations: ['treasury_account', 'user'],
                order: { payment_date: 'DESC', created_at: 'DESC' },
            })).map((payment) => ({
                id: payment.id,
                payroll_run_line_id: payment.payroll_run_line_id,
                user_id: payment.user_id,
                staff_name: payment.user?.full_name || payment.user?.user_name || null,
                payment_date: payment.payment_date,
                payment_method: payment.payment_method,
                treasury_account_id: payment.treasury_account_id,
                treasury_account_name: payment.treasury_account?.account_name ?? null,
                amount: this.roundMoney(payment.amount),
                reference_no: payment.reference_no ?? null,
                notes: payment.notes ?? null,
                created_at: payment.created_at,
            })),
        };
    }

    async createPayrollRun(
        clientId: string,
        dto: CreatePayrollRunDto,
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'create payroll runs');
        await this.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.pay_date, 'Payroll run creation', user);
        const existing = await this.payrollRunRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                period_start: dto.period_start,
                period_end: dto.period_end,
                status: Not(AccountingPayrollRunStatus.VOID),
            },
        });
        if (existing) {
            throw new BadRequestException(`Payroll run ${existing.run_no} already exists for this branch and period.`);
        }

        const { lines, summary } = await this.buildPayrollLines(clientId, dto.branch_id, dto.period_start, dto.period_end);
        const branch = await this.branchRepo.findOne({ where: { id: dto.branch_id, client_id: clientId } });
        const sequence = await this.payrollRunRepo.count({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
            },
        });
        const runNo = this.buildPayrollRunNumber(branch?.branch_code, dto.period_start, sequence + 1);
        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;

        const savedRun = await this.dataSource.transaction(async (manager) => {
            const run = manager.create(AccountingPayrollRun, {
                client_id: clientId,
                branch_id: dto.branch_id,
                run_no: runNo,
                title: this.buildPayrollBatchTitle(dto.title, dto.period_start, dto.period_end),
                period_start: dto.period_start,
                period_end: dto.period_end,
                pay_date: dto.pay_date,
                status: AccountingPayrollRunStatus.DRAFT,
                employee_count: summary.employee_count,
                total_base_amount: summary.total_base_amount,
                total_gross_amount: summary.total_gross_amount,
                total_attendance_deduction_amount: summary.total_attendance_deduction_amount,
                total_advance_recovery_amount: summary.total_advance_recovery_amount,
                total_loan_recovery_amount: summary.total_loan_recovery_amount,
                total_income_tax_amount: summary.total_income_tax_amount,
                total_eobi_employee_amount: summary.total_eobi_employee_amount,
                total_eobi_employer_amount: summary.total_eobi_employer_amount,
                total_social_security_employee_amount: summary.total_social_security_employee_amount,
                total_social_security_employer_amount: summary.total_social_security_employer_amount,
                total_employee_compliance_deduction_amount: summary.total_employee_compliance_deduction_amount,
                total_employer_contribution_amount: summary.total_employer_contribution_amount,
                total_deduction_amount: summary.total_deduction_amount,
                total_net_amount: summary.total_net_amount,
                total_paid_amount: 0,
                total_payable_balance: summary.total_net_amount,
                notes: dto.notes?.trim() || null,
                created_by: actorUserId,
            });
            const saved = await manager.save(run);
            const lineEntities = lines.map((line) => {
                const { department_name, ...persistableLine } = line as any;
                return manager.create(AccountingPayrollRunLine, {
                    payroll_run_id: saved.id,
                    ...persistableLine,
                });
            });
            await manager.save(lineEntities);
            return saved;
        });

        return this.getPayrollRun(clientId, savedRun.id);
    }

    async updatePayrollRunStatus(
        clientId: string,
        id: number,
        dto: UpdatePayrollRunStatusDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        const run = await this.resolvePayrollRun(clientId, id, accessibleBranchIds);
        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const note = dto.note?.trim() || null;

        if (dto.status === run.status) {
            return this.getPayrollRun(clientId, id, accessibleBranchIds);
        }

        if (dto.status === AccountingPayrollRunStatus.APPROVED) {
            if (run.status !== AccountingPayrollRunStatus.DRAFT) {
                throw new BadRequestException('Only draft payroll runs can be approved.');
            }
            await this.assertPeriodUnlockedForOperation(clientId, run.branch_id, run.pay_date, 'Payroll approval', user);
            const salaryAccount = await this.ensureDefaultAccount(clientId, '5200', 'Salaries & Wages', 'expense');
            const employerContribAccount = await this.ensureDefaultAccount(clientId, '5220', 'Employer Payroll Contributions', 'expense');
            const payrollPayable = await this.ensureDefaultAccount(clientId, '2210', 'Payroll Payable', 'liability');
            const staffAdvanceReceivable = await this.ensureDefaultAccount(clientId, '1230', 'Staff Advances Receivable', 'asset');
            const staffLoanReceivable = await this.ensureDefaultAccount(clientId, '1235', 'Staff Loan Receivable', 'asset');
            const withholdingTaxPayable = await this.ensureDefaultAccount(clientId, '2302', 'Withholding Tax Payable', 'liability');
            const eobiPayable = await this.ensureDefaultAccount(clientId, '2303', 'EOBI Payable', 'liability');
            const socialSecurityPayable = await this.ensureDefaultAccount(clientId, '2304', 'Social Security Payable', 'liability');
            const journalItems = [
                { account_id: salaryAccount.id, debit: this.roundMoney(run.total_gross_amount), credit: 0 },
                { account_id: payrollPayable.id, debit: 0, credit: this.roundMoney(run.total_net_amount) },
            ];
            if (this.roundMoney(run.total_employer_contribution_amount) > 0) {
                journalItems.unshift({ account_id: employerContribAccount.id, debit: this.roundMoney(run.total_employer_contribution_amount), credit: 0 });
            }
            if (this.roundMoney(run.total_advance_recovery_amount) > 0) {
                journalItems.push({ account_id: staffAdvanceReceivable.id, debit: 0, credit: this.roundMoney(run.total_advance_recovery_amount) });
            }
            if (this.roundMoney(run.total_loan_recovery_amount) > 0) {
                journalItems.push({ account_id: staffLoanReceivable.id, debit: 0, credit: this.roundMoney(run.total_loan_recovery_amount) });
            }
            if (this.roundMoney(run.total_income_tax_amount) > 0) {
                journalItems.push({ account_id: withholdingTaxPayable.id, debit: 0, credit: this.roundMoney(run.total_income_tax_amount) });
            }
            if (this.roundMoney(Number(run.total_eobi_employee_amount ?? 0) + Number(run.total_eobi_employer_amount ?? 0)) > 0) {
                journalItems.push({
                    account_id: eobiPayable.id,
                    debit: 0,
                    credit: this.roundMoney(Number(run.total_eobi_employee_amount ?? 0) + Number(run.total_eobi_employer_amount ?? 0)),
                });
            }
            if (this.roundMoney(Number(run.total_social_security_employee_amount ?? 0) + Number(run.total_social_security_employer_amount ?? 0)) > 0) {
                journalItems.push({
                    account_id: socialSecurityPayable.id,
                    debit: 0,
                    credit: this.roundMoney(Number(run.total_social_security_employee_amount ?? 0) + Number(run.total_social_security_employer_amount ?? 0)),
                });
            }
            const journal = await this.createJournalEntry(clientId, run.branch_id, {
                branch_id: run.branch_id,
                transaction_date: new Date(`${run.pay_date}T12:00:00`),
                business_date: run.pay_date,
                description: `Payroll accrual ${run.run_no}${note ? ` - ${note}` : ''}`,
                reference_id: run.run_no,
                source_module: 'accounting',
                source_entity_type: 'payroll_run',
                source_entity_id: String(run.id),
                source_event: 'payroll_accrual',
                posting_type: 'auto',
                items: journalItems,
            }, user);

            const profileUserIds = (run.lines ?? [])
                .filter((line) => Number(line.advance_recovery_amount ?? 0) > 0 || Number(line.loan_recovery_amount ?? 0) > 0)
                .map((line) => Number(line.user_id))
                .filter((value) => Number.isInteger(value) && value > 0);
            if (profileUserIds.length) {
                const profiles = await this.payrollRecoveryProfileRepo.find({
                    where: {
                        client_id: clientId,
                        branch_id: run.branch_id,
                        user_id: In(profileUserIds),
                    },
                });
                const profilesByUserId = new Map<number, AccountingPayrollRecoveryProfile>(
                    profiles.map((profile) => [profile.user_id, profile]),
                );
                for (const line of run.lines ?? []) {
                    const profile = profilesByUserId.get(Number(line.user_id));
                    if (!profile) {
                        continue;
                    }
                    profile.advance_balance = this.roundMoney(Math.max(Number(profile.advance_balance ?? 0) - Number(line.advance_recovery_amount ?? 0), 0));
                    profile.loan_balance = this.roundMoney(Math.max(Number(profile.loan_balance ?? 0) - Number(line.loan_recovery_amount ?? 0), 0));
                    profile.updated_by = actorUserId;
                }
                await this.payrollRecoveryProfileRepo.save(Array.from(profilesByUserId.values()));
            }

            run.status = AccountingPayrollRunStatus.APPROVED;
            run.accrual_journal_entry_id = journal.id;
            run.approved_at = new Date();
            run.approved_by = actorUserId;
            if (note) {
                run.notes = [run.notes, note].filter(Boolean).join('\n');
            }
            await this.payrollRunRepo.save(run);
            return this.getPayrollRun(clientId, id, accessibleBranchIds);
        }

        if (dto.status === AccountingPayrollRunStatus.PAID) {
            if (![AccountingPayrollRunStatus.APPROVED, AccountingPayrollRunStatus.PARTIALLY_PAID].includes(run.status)) {
                throw new BadRequestException('Only approved or partially paid payroll runs can be settled.');
            }
            if (!dto.payment_method || !dto.treasury_account_id) {
                throw new BadRequestException('Payroll payment requires payment method and treasury account.');
            }
            await this.assertPeriodUnlockedForOperation(clientId, run.branch_id, run.pay_date, 'Payroll payment', user);
            const treasuryAccount = await this.resolvePayrollTreasuryAccount(
                clientId,
                run.branch_id,
                dto.treasury_account_id,
                dto.payment_method,
            );
            const payrollPayable = await this.ensureDefaultAccount(clientId, '2210', 'Payroll Payable', 'liability');
            const payableLines = (run.lines ?? []).filter((line) => this.roundMoney(Number(line.payable_balance ?? line.net_amount ?? 0)) > 0);
            const selectedLineIds = dto.line_ids?.length
                ? new Set(dto.line_ids.map((value) => Number(value)))
                : new Set(payableLines.map((line) => Number(line.id)));
            const linesToPay = payableLines.filter((line) => selectedLineIds.has(Number(line.id)));

            if (linesToPay.length === 0) {
                throw new BadRequestException('Select at least one unpaid employee payroll line to settle.');
            }

            const settlementAmount = this.roundMoney(
                linesToPay.reduce((sum, line) => sum + Number(line.payable_balance ?? line.net_amount ?? 0), 0),
            );
            if (settlementAmount <= 0) {
                throw new BadRequestException('Selected payroll lines do not have any payable balance.');
            }

            const journal = await this.createJournalEntry(clientId, run.branch_id, {
                branch_id: run.branch_id,
                transaction_date: new Date(`${run.pay_date}T12:00:00`),
                business_date: run.pay_date,
                description: `Payroll payment ${run.run_no}${note ? ` - ${note}` : ''}`,
                reference_id: dto.reference_no?.trim() || run.run_no,
                source_module: 'accounting',
                source_entity_type: 'payroll_run',
                source_entity_id: String(run.id),
                source_event: 'payroll_payment',
                posting_type: 'auto',
                items: [
                    { account_id: payrollPayable.id, debit: settlementAmount, credit: 0 },
                    { account_id: treasuryAccount.id, debit: 0, credit: settlementAmount },
                ],
            }, user);

            for (const line of linesToPay) {
                line.paid_days = Number(line.payable_days ?? 0);
                line.paid_amount = this.roundMoney(Number(line.net_amount ?? 0));
                line.payable_balance = 0;
                line.payout_status = 'paid';
                line.paid_at = new Date();
                line.paid_by = actorUserId;
            }
            await this.payrollRunLineRepo.save(linesToPay);

            const refreshedLines = await this.payrollRunLineRepo.find({
                where: { payroll_run_id: run.id },
            });
            const totalPaidAmount = this.roundMoney(refreshedLines.reduce((sum, line) => sum + Number(line.paid_amount ?? 0), 0));
            const totalPayableBalance = this.roundMoney(refreshedLines.reduce((sum, line) => sum + Number(line.payable_balance ?? 0), 0));
            const allLinesPaid = refreshedLines.every((line) => this.roundMoney(Number(line.payable_balance ?? 0)) <= 0);

            run.status = allLinesPaid ? AccountingPayrollRunStatus.PAID : AccountingPayrollRunStatus.PARTIALLY_PAID;
            run.payment_method = dto.payment_method;
            run.payment_reference_no = dto.reference_no?.trim() || null;
            run.treasury_account_id = treasuryAccount.id;
            run.payment_journal_entry_id = journal.id;
            run.total_paid_amount = totalPaidAmount;
            run.total_payable_balance = totalPayableBalance;
            run.paid_at = allLinesPaid ? new Date() : run.paid_at ?? null;
            run.paid_by = allLinesPaid ? actorUserId : run.paid_by ?? null;
            if (note) {
                run.notes = [run.notes, note].filter(Boolean).join('\n');
            }
            await this.payrollRunRepo.save(run);
            return this.getPayrollRun(clientId, id, accessibleBranchIds);
        }

        if (dto.status === AccountingPayrollRunStatus.VOID) {
            if ([AccountingPayrollRunStatus.PAID, AccountingPayrollRunStatus.PARTIALLY_PAID].includes(run.status)) {
                throw new BadRequestException('Paid or partially paid payroll runs cannot be voided directly.');
            }
            if (run.status === AccountingPayrollRunStatus.APPROVED && run.accrual_journal_entry_id) {
                const profileUserIds = (run.lines ?? [])
                    .filter((line) => Number(line.advance_recovery_amount ?? 0) > 0 || Number(line.loan_recovery_amount ?? 0) > 0)
                    .map((line) => Number(line.user_id))
                    .filter((value) => Number.isInteger(value) && value > 0);
                if (profileUserIds.length) {
                    const profiles = await this.payrollRecoveryProfileRepo.find({
                        where: {
                            client_id: clientId,
                            branch_id: run.branch_id,
                            user_id: In(profileUserIds),
                        },
                    });
                    const profilesByUserId = new Map<number, AccountingPayrollRecoveryProfile>(
                        profiles.map((profile) => [profile.user_id, profile]),
                    );
                    for (const line of run.lines ?? []) {
                        const profile = profilesByUserId.get(Number(line.user_id));
                        if (!profile) {
                            continue;
                        }
                        profile.advance_balance = this.roundMoney(Number(profile.advance_balance ?? 0) + Number(line.advance_recovery_amount ?? 0));
                        profile.loan_balance = this.roundMoney(Number(profile.loan_balance ?? 0) + Number(line.loan_recovery_amount ?? 0));
                        profile.updated_by = actorUserId;
                    }
                    await this.payrollRecoveryProfileRepo.save(Array.from(profilesByUserId.values()));
                }
                const reversal = await this.reverseJournalEntry(
                    clientId,
                    run.accrual_journal_entry_id,
                    {
                        branch_id: run.branch_id,
                        transaction_date: new Date(),
                        reason: `Payroll run ${run.run_no} voided${note ? `: ${note}` : ''}`,
                    },
                    accessibleBranchIds,
                    user,
                );
                run.reversal_journal_entry_id = reversal.id;
            }
            run.status = AccountingPayrollRunStatus.VOID;
            run.voided_at = new Date();
            run.voided_by = actorUserId;
            if (note) {
                run.notes = [run.notes, note].filter(Boolean).join('\n');
            }
            await this.payrollRunRepo.save(run);
            return this.getPayrollRun(clientId, id, accessibleBranchIds);
        }

        throw new BadRequestException('Unsupported payroll status transition.');
    }

    async recordPayrollRunPayment(
        clientId: string,
        id: number,
        dto: RecordPayrollRunPaymentDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        const run = await this.resolvePayrollRun(clientId, id, accessibleBranchIds);
        if (![AccountingPayrollRunStatus.APPROVED, AccountingPayrollRunStatus.PARTIALLY_PAID].includes(run.status)) {
            throw new BadRequestException('Only approved or partially paid payroll batches can be paid.');
        }
        const line = (run.lines ?? []).find((row) => Number(row.id) === Number(dto.payroll_run_line_id));
        if (!line) {
            throw new NotFoundException(`Payroll line ${dto.payroll_run_line_id} not found in this batch.`);
        }
        const paymentAmount = this.roundMoney(dto.amount);
        const payableBalance = this.roundMoney(Number(line.payable_balance ?? 0));
        if (paymentAmount <= 0) {
            throw new BadRequestException('Payment amount must be greater than zero.');
        }
        if (paymentAmount > payableBalance) {
            throw new BadRequestException(`Payment exceeds employee payable balance of ${this.roundMoney(payableBalance)}.`);
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        await this.assertPeriodUnlockedForOperation(clientId, run.branch_id, dto.payment_date, 'Payroll payment', user);
        const treasuryAccount = await this.resolvePayrollTreasuryAccount(
            clientId,
            run.branch_id,
            dto.treasury_account_id,
            dto.payment_method,
        );
        const payrollPayable = await this.ensureDefaultAccount(clientId, '2210', 'Payroll Payable', 'liability');
        const note = dto.note?.trim() || null;

        const journal = await this.createJournalEntry(clientId, run.branch_id, {
            branch_id: run.branch_id,
            transaction_date: new Date(`${dto.payment_date}T12:00:00`),
            business_date: dto.payment_date,
            description: `Payroll payment ${run.run_no} - ${line.staff_name_snapshot}${note ? ` - ${note}` : ''}`,
            reference_id: dto.reference_no?.trim() || `${run.run_no}-${line.id}`,
            source_module: 'accounting',
            source_entity_type: 'payroll_payment',
            source_entity_id: String(line.id),
            source_event: 'payroll_payment_line',
            posting_type: 'auto',
            items: [
                { account_id: payrollPayable.id, debit: paymentAmount, credit: 0 },
                { account_id: treasuryAccount.id, debit: 0, credit: paymentAmount },
            ],
        }, user);

        const nextPaidAmount = this.roundMoney(Number(line.paid_amount ?? 0) + paymentAmount);
        line.paid_amount = nextPaidAmount;
        line.payable_balance = this.roundMoney(Math.max(Number(line.net_amount ?? 0) - nextPaidAmount, 0));
        const currentPeriodNetAmount = this.roundMoney(
            Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0),
        );
        const paidTowardsCurrentPeriod = this.roundMoney(
            Math.min(
                Math.max(nextPaidAmount - Number(line.arrears_amount ?? 0), 0),
                currentPeriodNetAmount,
            ),
        );
        line.paid_days = this.calculatePayrollLinePaidDays(
            currentPeriodNetAmount,
            paidTowardsCurrentPeriod,
            Number(line.payable_days ?? 0),
        );
        line.payout_status = this.derivePayrollLinePayoutStatus(line);
        line.paid_at = new Date(`${dto.payment_date}T12:00:00`);
        line.paid_by = actorUserId;
        await this.payrollRunLineRepo.save(line);

        const paymentEntry = this.payrollPaymentRepo.create({
            client_id: clientId,
            payroll_run_id: run.id,
            payroll_run_line_id: line.id,
            branch_id: run.branch_id,
            user_id: line.user_id ?? null,
            payment_date: dto.payment_date,
            payment_method: dto.payment_method,
            treasury_account_id: treasuryAccount.id,
            amount: paymentAmount,
            reference_no: dto.reference_no?.trim() || null,
            notes: note,
            journal_entry_id: journal.id,
            created_by: actorUserId,
        });
        await this.payrollPaymentRepo.save(paymentEntry);

        const refreshedLines = await this.payrollRunLineRepo.find({
            where: { payroll_run_id: run.id },
        });
        const totalPaidAmount = this.roundMoney(refreshedLines.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0));
        const totalPayableBalance = this.roundMoney(refreshedLines.reduce((sum, row) => sum + Number(row.payable_balance ?? 0), 0));
        const allLinesPaid = refreshedLines.every((row) => this.roundMoney(Number(row.payable_balance ?? 0)) <= 0);

        run.status = allLinesPaid ? AccountingPayrollRunStatus.PAID : AccountingPayrollRunStatus.PARTIALLY_PAID;
        run.payment_method = dto.payment_method;
        run.payment_reference_no = dto.reference_no?.trim() || null;
        run.treasury_account_id = treasuryAccount.id;
        run.payment_journal_entry_id = journal.id;
        run.total_paid_amount = totalPaidAmount;
        run.total_payable_balance = totalPayableBalance;
        run.paid_at = allLinesPaid ? new Date(`${dto.payment_date}T12:00:00`) : run.paid_at ?? null;
        run.paid_by = allLinesPaid ? actorUserId : run.paid_by ?? null;
        if (note) {
            run.notes = [run.notes, note].filter(Boolean).join('\n');
        }
        await this.payrollRunRepo.save(run);

        return this.getPayrollRun(clientId, run.id, accessibleBranchIds);
    }

    async createPayrollAdvance(
        clientId: string,
        dto: CreatePayrollAdvanceDto,
        accessibleBranchIds?: number[],
        user?: JwtPayload,
    ) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id, 'create payroll advance');
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
            throw new ForbiddenException('You do not have access to create payroll advances for this branch.');
        }
        const employee = await this.assertPayrollUserAssignedToBranch(clientId, dto.branch_id, dto.user_id);
        await this.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.payment_date, 'Payroll advance payment', user);

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const treasuryAccount = await this.resolvePayrollTreasuryAccount(
            clientId,
            dto.branch_id,
            dto.treasury_account_id,
            dto.payment_method,
        );
        const staffAdvanceReceivable = await this.ensureDefaultAccount(clientId, '1230', 'Staff Advances Receivable', 'asset');
        const note = dto.note?.trim() || null;
        const amount = this.roundMoney(dto.amount);

        const journal = await this.createJournalEntry(clientId, dto.branch_id, {
            branch_id: dto.branch_id,
            transaction_date: new Date(`${dto.payment_date}T12:00:00`),
            business_date: dto.payment_date,
            description: `Salary advance ${employee.full_name || employee.user_name || `User ${employee.id}`}${note ? ` - ${note}` : ''}`,
            reference_id: dto.reference_no?.trim() || `ADV-${dto.user_id}-${dto.payment_date}`,
            source_module: 'accounting',
            source_entity_type: 'payroll_advance',
            source_entity_id: String(dto.user_id),
            source_event: 'payroll_advance_payment',
            posting_type: 'auto',
            items: [
                { account_id: staffAdvanceReceivable.id, debit: amount, credit: 0 },
                { account_id: treasuryAccount.id, debit: 0, credit: amount },
            ],
        }, user);

        let profile = await this.payrollRecoveryProfileRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                user_id: dto.user_id,
            },
        });
        if (!profile) {
            profile = this.payrollRecoveryProfileRepo.create({
                client_id: clientId,
                branch_id: dto.branch_id,
                user_id: dto.user_id,
                is_active: true,
            });
        }
        profile.advance_balance = this.roundMoney(Number(profile.advance_balance ?? 0) + amount);
        profile.updated_by = actorUserId;
        await this.payrollRecoveryProfileRepo.save(profile);

        const advance = this.payrollAdvanceRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
            user_id: dto.user_id,
            payment_date: dto.payment_date,
            payment_method: dto.payment_method,
            treasury_account_id: treasuryAccount.id,
            amount,
            reference_no: dto.reference_no?.trim() || null,
            notes: note,
            journal_entry_id: journal.id,
            created_by: actorUserId,
        });
        const saved = await this.payrollAdvanceRepo.save(advance);

        return {
            id: saved.id,
            branch_id: dto.branch_id,
            user_id: dto.user_id,
            staff_name: employee.full_name || employee.user_name || `User ${employee.id}`,
            payment_date: dto.payment_date,
            payment_method: dto.payment_method,
            treasury_account_id: treasuryAccount.id,
            treasury_account_name: treasuryAccount.account_name,
            amount,
            reference_no: saved.reference_no ?? null,
            notes: saved.notes ?? null,
            journal_entry_id: journal.id,
            advance_balance: this.roundMoney(profile.advance_balance ?? 0),
            created_at: saved.created_at,
        };
    }
}
