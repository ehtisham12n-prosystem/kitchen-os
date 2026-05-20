import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChartOfAccount } from './entities/chart-of-accounts.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalItem } from './entities/journal-item.entity';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { FinancialVoucher } from './entities/financial-voucher.entity';
import { FinancialVouchersService } from './financial-vouchers.service';
import { FinancialVouchersController } from './financial-vouchers.controller';
import { Branch } from '../setup/entities/branch.entity';
import { AccountingDayClose } from './entities/day-close.entity';
import { Order } from '../pos/entities/order.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { KOT } from '../pos/entities/kot.entity';
import { Shift } from '../pos/entities/shift.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { InventoryCountSession } from '../inventory-op/entities/inventory-count-session.entity';
import { AccountingBankReconciliation } from './entities/bank-reconciliation.entity';
import { GoodsReceiptNote } from '../inventory-op/entities/goods-receipt-note.entity';
import { AccountingPayableAllocation } from './entities/payable-allocation.entity';
import { AccountingInvestor } from './entities/investor.entity';
import { AccountingInvestorAgreement } from './entities/investor-agreement.entity';
import { AccountingInvestorTransaction } from './entities/investor-transaction.entity';
import { AccountingProfitDistributionBatch } from './entities/profit-distribution-batch.entity';
import { AccountingProfitDistributionLine } from './entities/profit-distribution-line.entity';
import { AccountingPeriodLock } from './entities/period-lock.entity';
import { AccountingCloseChecklistItem } from './entities/close-checklist.entity';
import { AccountingPayrollRun } from './entities/payroll-run.entity';
import { AccountingPayrollRunLine } from './entities/payroll-run-line.entity';
import { AccountingPayrollPayment } from './entities/payroll-payment.entity';
import { AccountingPayrollAdvance } from './entities/payroll-advance.entity';
import { AccountingPayrollRecoveryProfile } from './entities/payroll-recovery-profile.entity';
import { AccountingPayrollComplianceSetting } from './entities/payroll-compliance-setting.entity';
import { AccountingPayrollComplianceFiling } from './entities/payroll-compliance-filing.entity';
import { AccountingTreasuryDepositAllocation } from './entities/treasury-deposit-allocation.entity';
import { AccountingTreasuryDepositClearanceAllocation } from './entities/treasury-deposit-clearance-allocation.entity';
import { AccountingTreasuryException } from './entities/treasury-exception.entity';
import { AccountingInterBranchServiceRecharge } from './entities/inter-branch-service-recharge.entity';
import { AccountingFixedAssetItem } from './entities/fixed-asset-item.entity';
import { AccountingFixedAssetUnit } from './entities/fixed-asset-unit.entity';
import { AccountingFixedAssetMovement } from './entities/fixed-asset-movement.entity';
import { InvestorProfitService } from './investor-profit.service';
import { InvestorProfitController } from './investor-profit.controller';
import { AccountingLoan } from './entities/loan.entity';
import { AccountingLoanRepayment } from './entities/loan-repayment.entity';
import { AccountingLoanController } from './loan.controller';
import { AccountingLoanService } from './loan.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { AttendanceLog } from '../setup/entities/attendance-log.entity';
import { UserBranchRole } from '../setup/entities/user-branch-role.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventorySubType } from '../inventory/entities/inventory-sub-type.entity';
import { InventoryType } from '../inventory/entities/inventory-type.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';

@Module({
    imports: [
        ApprovalsModule,
        TypeOrmModule.forFeature([
            ChartOfAccount,
            JournalEntry,
            JournalItem,
            AccountingDayClose,
            FinancialVoucher,
            Branch,
            Order,
            Transaction,
            KOT,
            Shift,
            StockLedger,
            InventoryCountSession,
            AccountingBankReconciliation,
            GoodsReceiptNote,
            AccountingPayableAllocation,
            AccountingInvestor,
            AccountingInvestorAgreement,
            AccountingInvestorTransaction,
            AccountingProfitDistributionBatch,
            AccountingProfitDistributionLine,
            AccountingPeriodLock,
            AccountingCloseChecklistItem,
            AccountingPayrollRun,
            AccountingPayrollRunLine,
            AccountingPayrollPayment,
            AccountingPayrollAdvance,
            AccountingPayrollRecoveryProfile,
            AccountingPayrollComplianceSetting,
            AccountingPayrollComplianceFiling,
            AccountingTreasuryDepositAllocation,
            AccountingTreasuryDepositClearanceAllocation,
            AccountingTreasuryException,
            AccountingInterBranchServiceRecharge,
            AccountingFixedAssetItem,
            AccountingFixedAssetUnit,
            AccountingFixedAssetMovement,
            AccountingLoan,
            AccountingLoanRepayment,
            UserManagement,
            AttendanceLog,
            UserBranchRole,
            InventoryItem,
            InventorySubType,
            InventoryType,
            InventoryClass,
        ]),
    ],
    controllers: [AccountingController, FinancialVouchersController, InvestorProfitController, AccountingLoanController],
    providers: [AccountingService, FinancialVouchersService, InvestorProfitService, AccountingLoanService],
    exports: [AccountingService, FinancialVouchersService, InvestorProfitService, AccountingLoanService],
})
export class AccountingModule { }
