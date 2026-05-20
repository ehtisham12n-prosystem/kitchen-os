import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import {
    InvestorAgreementFrequency,
    InvestorAgreementStatus,
    InvestorAgreementType,
} from '../entities/investor-agreement.entity';
import { InvestorStatus } from '../entities/investor.entity';
import { InvestorTransactionType } from '../entities/investor-transaction.entity';

export class ListInvestorQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(InvestorStatus)
    status?: InvestorStatus;
}

export class CreateInvestorDto {
    @IsString()
    @MaxLength(150)
    full_name: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    phone?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    primary_branch_id?: number;

    @IsOptional()
    @IsEnum(InvestorStatus)
    status?: InvestorStatus;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class UpdateInvestorDto extends CreateInvestorDto {}

export class ListAgreementQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    investor_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @IsEnum(InvestorAgreementStatus)
    status?: InvestorAgreementStatus;
}

export class CreateInvestorAgreementDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    investor_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsString()
    @MaxLength(150)
    agreement_name: string;

    @IsEnum(InvestorAgreementType)
    agreement_type: InvestorAgreementType;

    @IsEnum(InvestorAgreementFrequency)
    distribution_frequency: InvestorAgreementFrequency;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    capital_commitment_amount: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    profit_share_percent: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    fixed_return_percent: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    management_charge_percent: number;

    @IsDateString()
    effective_from: string;

    @IsOptional()
    @IsDateString()
    effective_to?: string;

    @IsOptional()
    @IsEnum(InvestorAgreementStatus)
    status?: InvestorAgreementStatus;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class UpdateInvestorAgreementDto extends CreateInvestorAgreementDto {}

export class ListInvestorTransactionQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    investor_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    agreement_id?: number;

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

export class CreateInvestorTransactionDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    investor_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    agreement_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsDateString()
    transaction_date: string;

    @IsEnum(InvestorTransactionType)
    transaction_type: InvestorTransactionType;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference_no?: string;
}

export class ReturnInvestorCapitalDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    investor_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    agreement_id: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsDateString()
    transaction_date: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference_no?: string;
}

export class InvestorStatementQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @IsDateString()
    period_start?: string;

    @IsOptional()
    @IsDateString()
    period_end?: string;
}

export class ProfitDistributionPreviewQueryDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id: number;

    @IsDateString()
    period_start: string;

    @IsDateString()
    period_end: string;

    @IsEnum(InvestorAgreementFrequency)
    distribution_frequency: InvestorAgreementFrequency;
}

export class ProcessProfitDistributionDto extends ProfitDistributionPreviewQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class ListProfitDistributionQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;
}
