import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PartyType,
  VoucherStatus,
  VoucherType,
} from '../entities/financial-voucher.entity';
import { AccountingCloseChecklistStatus } from '../entities/close-checklist.entity';
import { AccountingPayrollRunStatus } from '../entities/payroll-run.entity';
import { JournalCloseAdjustmentType } from '../entities/journal-entry.entity';
import { AccountingTreasuryExceptionStatus } from '../entities/treasury-exception.entity';
import { AccountingInterBranchServiceType } from '../entities/inter-branch-service-recharge.entity';
import {
    FixedAssetCapitalizationMode,
    FixedAssetCondition,
    FixedAssetDisposalMethod,
    FixedAssetOperationalStatus,
    FixedAssetPurchaseCondition,
} from '../entities/fixed-asset-unit.entity';
import { FixedAssetDepreciationMethod } from '../entities/fixed-asset-item.entity';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum AccountScope {
  COMPANY = 'company',
  BRANCH = 'branch',
}

export enum BankAccountType {
  SAVING = 'saving',
  CURRENT = 'current',
}

export enum PeriodLockMode {
  NONE = 'none',
  ADMIN_OVERRIDE = 'admin_override',
  HARD_LOCK = 'hard_lock',
}

export enum TreasuryMovementType {
    CASH_TO_SAFE = 'cash_to_safe',
    CASH_TO_BANK = 'cash_to_bank',
    CASH_DEPOSIT_TO_TRANSIT = 'cash_deposit_to_transit',
    TRANSIT_TO_BANK = 'transit_to_bank',
    BANK_TO_CASH = 'bank_to_cash',
    TREASURY_TRANSFER = 'treasury_transfer',
}

export enum MerchantSettlementChannel {
    CARD = 'card',
    DIGITAL_WALLET = 'digital_wallet',
    OTHER = 'other',
}

export enum TreasuryExceptionType {
    CASH_VARIANCE = 'cash_variance',
    DEPOSIT_VARIANCE_BATCH = 'deposit_variance_batch',
    OVERDUE_SAFE_HANDOVER = 'overdue_safe_handover',
    OVERDUE_TRANSIT_BATCH = 'overdue_transit_batch',
    AGED_MERCHANT_SETTLEMENT = 'aged_merchant_settlement',
    MERCHANT_PROVIDER_SHORTFALL = 'merchant_provider_shortfall',
}

export enum PayrollPaymentMethod {
    CASH = 'Cash',
    BANK_TRANSFER = 'Bank Transfer',
    CARD = 'Card',
    DIGITAL_WALLET = 'Digital Wallet',
}

export class GetFixedAssetRegisterDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;
}

export class CreateFixedAssetItemDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    inventory_item_id?: number;

    @IsString()
    @MaxLength(150)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    brand?: string;

    @IsString()
    @MaxLength(120)
    category: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    sub_category?: string;

    @IsOptional()
    @IsEnum(FixedAssetDepreciationMethod)
    depreciation_method?: FixedAssetDepreciationMethod;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    useful_life_months: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    salvage_value?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class UpdateFixedAssetItemDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    inventory_item_id?: number;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    brand?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    category?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    sub_category?: string;

    @IsOptional()
    @IsEnum(FixedAssetDepreciationMethod)
    depreciation_method?: FixedAssetDepreciationMethod;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    useful_life_months?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    salvage_value?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class CreateFixedAssetUnitDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    asset_item_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    model?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    manufacturer?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    serial_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    tag_no?: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    purchase_price: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    annual_depreciation_rate?: number;

    @IsOptional()
    @IsEnum(FixedAssetPurchaseCondition)
    purchase_condition?: FixedAssetPurchaseCondition;

    @IsDateString()
    capitalization_date: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    purchase_order_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    invoice_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    supplier_name?: string;

    @IsEnum(FixedAssetCapitalizationMode)
    capitalization_mode: FixedAssetCapitalizationMode;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    treasury_account_id?: number;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    physical_location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    issued_to?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    custodian_id?: string;

    @IsOptional()
    @IsEnum(FixedAssetCondition)
    condition?: FixedAssetCondition;

    @IsOptional()
    @IsEnum(FixedAssetOperationalStatus)
    operational_status?: FixedAssetOperationalStatus;

    @IsOptional()
    @IsDateString()
    warranty_expiry?: string;

    @IsOptional()
    @IsDateString()
    last_service_date?: string;

    @IsOptional()
    @IsDateString()
    next_service_due?: string;

    @IsOptional()
    @IsDateString()
    insurance_expiry?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comments?: string;
}

export class UpdateFixedAssetUnitDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    model?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    manufacturer?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    serial_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    tag_no?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    annual_depreciation_rate?: number;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    physical_location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    issued_to?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    custodian_id?: string;

    @IsOptional()
    @IsEnum(FixedAssetCondition)
    condition?: FixedAssetCondition;

    @IsOptional()
    @IsEnum(FixedAssetOperationalStatus)
    operational_status?: FixedAssetOperationalStatus;

    @IsOptional()
    @IsDateString()
    warranty_expiry?: string;

    @IsOptional()
    @IsDateString()
    last_service_date?: string;

    @IsOptional()
    @IsDateString()
    next_service_due?: string;

    @IsOptional()
    @IsDateString()
    insurance_expiry?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comments?: string;
}

export class IssueFixedAssetUnitDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsString()
    @MaxLength(150)
    issue_to: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    custodian_id?: string;

    @IsString()
    @MaxLength(180)
    location: string;

    @IsDateString()
    issue_date: string;

    @IsOptional()
    @IsDateString()
    expected_return?: string;

    @IsEnum(FixedAssetCondition)
    handover_condition: FixedAssetCondition;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comments?: string;
}

export class ReturnFixedAssetUnitDto {
    @IsDateString()
    return_date: string;

    @IsEnum(FixedAssetCondition)
    return_condition: FixedAssetCondition;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    incident_report?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comments?: string;
}

export class TransferFixedAssetUnitDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    to_branch_id: number;

    @IsDateString()
    transfer_date: string;

    @IsString()
    @MaxLength(150)
    received_by: string;

    @IsString()
    @MaxLength(150)
    authorized_by: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    vehicle_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    gate_pass_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    destination_location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class DisposeFixedAssetUnitDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsEnum(FixedAssetDisposalMethod)
    method: FixedAssetDisposalMethod;

    @IsOptional()
    @IsString()
    @MaxLength(60)
    disposal_no?: string;

    @IsDateString()
    date: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    salvage_value?: number;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    recipient_buyer?: string;

    @IsString()
    @MaxLength(150)
    approved_by: string;

    @IsString()
    @MaxLength(80)
    reason_code: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    treasury_account_id?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class CreateInterBranchServiceRechargeDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    source_branch_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    destination_branch_id: number;

    @IsEnum(AccountingInterBranchServiceType)
    service_type: AccountingInterBranchServiceType;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsDateString()
    service_date: string;

    @IsString()
    @MaxLength(255)
    description: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class CreateAccountDto {
  @IsString()
  @MaxLength(20)
  account_code: string;

  @IsString()
  @MaxLength(150)
  account_name: string;

  @IsEnum(AccountType)
  account_type: AccountType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_id?: number | null;

  @IsOptional()
  @IsEnum(AccountScope)
  scope?: AccountScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bank_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  treasury_institution_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  account_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  treasury_account_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  account_number_iban?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  treasury_reference_no_iban?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  treasury_currency_code?: string | null;

  @IsOptional()
  @IsEnum(BankAccountType)
  bank_account_type?: BankAccountType | null;

  @IsOptional()
  @IsEnum(BankAccountType)
  treasury_account_type?: BankAccountType | null;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  usage_guidance?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  example_entry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  confusion_note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  schedule_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_control_account?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_manual_posting?: boolean;

  @IsOptional()
  @IsBoolean()
  is_bank_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_cash_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_petty_cash_account?: boolean;
}

export class UpdateAccountDto extends CreateAccountDto {}

export class JournalEntryItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  account_id: number;

  @Type(() => Number)
  @IsNumber()
  debit: number;

  @Type(() => Number)
  @IsNumber()
  credit: number;
}

export class CreateJournalEntryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Date)
  @IsDate()
  transaction_date: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_id?: string;

  @IsOptional()
  @IsDateString()
  business_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source_module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source_entity_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source_entity_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source_event?: string;

  @IsOptional()
  @IsEnum(['manual', 'auto', 'closing'])
  posting_type?: 'manual' | 'auto' | 'closing';

  @IsOptional()
  @IsBoolean()
  is_accrual?: boolean;

  @IsOptional()
  @IsDateString()
  accrual_reversal_due_date?: string;

  @IsOptional()
  @IsEnum(JournalCloseAdjustmentType)
  close_adjustment_type?: JournalCloseAdjustmentType;

  @IsOptional()
  @IsDateString()
  schedule_start_date?: string;

  @IsOptional()
  @IsDateString()
  schedule_end_date?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryItemDto)
  items: JournalEntryItemDto[];
}

export class DayClosePreviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsDateString()
  business_date?: string;
}

export class CloseDayDto extends DayClosePreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReverseJournalEntryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Date)
  @IsDate()
  transaction_date: Date;

  @IsOptional()
  @IsDateString()
  business_date?: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class CreateFinancialVoucherDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsEnum(VoucherType)
  type: VoucherType;

  @IsOptional()
  @IsEnum(PartyType)
  party_type?: PartyType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  party_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  party_name?: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsDateString()
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payment_method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  payment_source_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expense_account_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  treasury_account_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  linked_grn_id?: number;

}

export class UpdateFinancialVoucherStatusDto {
  @IsEnum(VoucherStatus)
  status: VoucherStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateBankReconciliationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  account_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  journal_entry_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  journal_item_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsDateString()
  statement_date: string;

  @IsString()
  @MaxLength(100)
  statement_reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  statement_description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateTreasuryMovementDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsEnum(TreasuryMovementType)
  movement_type: TreasuryMovementType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_account_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_account_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference_no?: string;

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @Min(1, { each: true })
    handover_journal_entry_ids?: number[];

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    @Min(1, { each: true })
    deposit_entry_ids?: number[];
}

export class UpsertTreasuryExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsEnum(TreasuryExceptionType)
  exception_type: TreasuryExceptionType;

  @IsString()
  @MaxLength(120)
  exception_key: string;

  @IsEnum(AccountingTreasuryExceptionStatus)
  status: AccountingTreasuryExceptionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  owner_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateMerchantSettlementDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsEnum(MerchantSettlementChannel)
    channel: MerchantSettlementChannel;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    bank_account_id: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    gross_amount: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    charges_amount: number;

    @IsDateString()
    date: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    provider_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}

export class UpsertPeriodLockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number | null;

  @IsEnum(PeriodLockMode)
  mode: PeriodLockMode;

  @IsOptional()
  @IsDateString()
  locked_through_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reopen_reason?: string | null;
}

export class GetMonthCloseChecklistDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  period_key?: string;
}

export class UpsertMonthCloseChecklistItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsString()
  @MaxLength(7)
  period_key: string;

  @IsString()
  @MaxLength(60)
  item_key: string;

  @IsEnum(AccountingCloseChecklistStatus)
  status: AccountingCloseChecklistStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class FinalizeYearEndDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  period_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ReopenYearEndDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  period_key?: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class GetPettyCashOverviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class CreatePettyCashAccountDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  account_name?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  opening_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_account_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreatePettyCashRefillDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  petty_cash_account_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_account_id: number;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreatePayrollRunDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsDateString()
  period_start: string;

  @IsDateString()
  period_end: string;

  @IsDateString()
  pay_date: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class GetPayrollPreviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsDateString()
  period_start: string;

  @IsDateString()
  period_end: string;
}

export class GetPayrollRecoveryProfilesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;
}

export class UpsertPayrollRecoveryProfileDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  advance_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loan_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  default_advance_recovery?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  default_loan_recovery?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class GetPayrollComplianceSettingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;
}

export class GetPayrollComplianceReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;
}

export class UpsertPayrollComplianceSettingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  income_tax_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  income_tax_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eobi_employee_fixed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eobi_employer_fixed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  social_security_employee_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  social_security_employer_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  social_security_salary_cap?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePayrollRunStatusDto {
  @IsEnum(AccountingPayrollRunStatus)
  status: AccountingPayrollRunStatus;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  line_ids?: number[];

  @IsOptional()
  @IsEnum(PayrollPaymentMethod)
  payment_method?: PayrollPaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  treasury_account_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RecordPayrollRunPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payroll_run_line_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  payment_date: string;

  @IsEnum(PayrollPaymentMethod)
  payment_method: PayrollPaymentMethod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  treasury_account_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreatePayrollAdvanceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  payment_date: string;

  @IsEnum(PayrollPaymentMethod)
  payment_method: PayrollPaymentMethod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  treasury_account_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreatePayrollComplianceSettlementDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsEnum(PayrollPaymentMethod)
  payment_method: PayrollPaymentMethod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  treasury_account_id: number;

  @IsDateString()
  payment_date: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  withholding_tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eobi_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  social_security_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class GetPayrollComplianceFilingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;
}

export class CreatePayrollComplianceFilingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsDateString()
  period_start: string;

  @IsDateString()
  period_end: string;

  @IsDateString()
  filing_date: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  withholding_tax_amount: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eobi_amount: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  social_security_amount: number;

  @IsString()
  @MaxLength(120)
  filing_reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
