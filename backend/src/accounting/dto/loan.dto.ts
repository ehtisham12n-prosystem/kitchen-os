import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import {
    AccountingLoanInterestMethod,
    AccountingLoanRepaymentFrequency,
    AccountingLoanStatus,
} from '../entities/loan.entity';
import { AccountingLoanRepaymentStatus } from '../entities/loan-repayment.entity';

export class ListLoanQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(AccountingLoanStatus)
    status?: AccountingLoanStatus;
}

export class CreateLoanDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsString()
    @MaxLength(180)
    source_name: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    principal_amount: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    annual_interest_rate: number;

    @IsEnum(AccountingLoanInterestMethod)
    interest_method: AccountingLoanInterestMethod;

    @IsDateString()
    start_date: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    duration_months: number;

    @IsEnum(AccountingLoanRepaymentFrequency)
    repayment_frequency: AccountingLoanRepaymentFrequency;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    disbursement_account_id: number;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    disbursement_reference_no?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class UpdateLoanDto {
    @IsOptional()
    @IsString()
    @MaxLength(180)
    source_name?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    principal_amount?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    annual_interest_rate?: number;

    @IsOptional()
    @IsEnum(AccountingLoanInterestMethod)
    interest_method?: AccountingLoanInterestMethod;

    @IsOptional()
    @IsDateString()
    start_date?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    duration_months?: number;

    @IsOptional()
    @IsEnum(AccountingLoanRepaymentFrequency)
    repayment_frequency?: AccountingLoanRepaymentFrequency;

    @IsOptional()
    @IsEnum(AccountingLoanStatus)
    status?: AccountingLoanStatus;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class ListLoanRepaymentQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    loan_id?: number;

    @IsOptional()
    @IsEnum(AccountingLoanRepaymentStatus)
    status?: AccountingLoanRepaymentStatus;
}

export class RecordLoanRepaymentDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    repayment_id: number;

    @IsDateString()
    payment_date: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    amount_paid: number;

    @IsString()
    @MaxLength(50)
    payment_method: string;

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
    notes?: string;
}

export class SettleLoanDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    loan_id: number;

    @IsDateString()
    payment_date: string;

    @IsString()
    @MaxLength(50)
    payment_method: string;

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
    notes?: string;
}
