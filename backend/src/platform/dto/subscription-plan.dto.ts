import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { SUBSCRIPTION_PLAN_STATUSES } from '../entities/subscription-plan.entity';
import type { SubscriptionPlanStatus } from '../entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
    @IsString()
    @IsNotEmpty()
    plan_code: string;

    @IsString()
    @IsNotEmpty()
    plan_name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(SUBSCRIPTION_PLAN_STATUSES)
    @IsOptional()
    plan_status?: SubscriptionPlanStatus;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsString()
    @IsOptional()
    currency_code?: string;

    @IsBoolean()
    @IsOptional()
    trial_enabled?: boolean;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_trial_days?: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    monthly_price: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    annual_price: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    max_branches: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    max_users: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    max_pos_devices: number;

    @IsArray()
    @IsNotEmpty()
    allowed_modules: string[];
}

export class UpdateSubscriptionPlanDto {
    @IsString()
    @IsOptional()
    plan_code?: string;

    @IsString()
    @IsOptional()
    plan_name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(SUBSCRIPTION_PLAN_STATUSES)
    @IsOptional()
    plan_status?: SubscriptionPlanStatus;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsString()
    @IsOptional()
    currency_code?: string;

    @IsBoolean()
    @IsOptional()
    trial_enabled?: boolean;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_trial_days?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    monthly_price?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    annual_price?: number;

    @IsNumber()
    @Min(1)
    @IsOptional()
    max_branches?: number;

    @IsNumber()
    @Min(1)
    @IsOptional()
    max_users?: number;

    @IsNumber()
    @Min(1)
    @IsOptional()
    max_pos_devices?: number;

    @IsArray()
    @IsOptional()
    allowed_modules?: string[];
}
