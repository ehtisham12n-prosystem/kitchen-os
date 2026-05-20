import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  CLIENT_SUBSCRIPTION_BILLING_CYCLES,
  CLIENT_SUBSCRIPTION_STATUSES,
} from '../entities/client-subscription.constants';
import type {
  ClientSubscriptionBillingCycle,
  ClientSubscriptionStatus,
} from '../entities/client-subscription.constants';

export class AssignClientSubscriptionDto {
  @IsNumber()
  @IsNotEmpty()
  plan_id: number;

  @IsEnum(CLIENT_SUBSCRIPTION_BILLING_CYCLES)
  billing_cycle: ClientSubscriptionBillingCycle;

  @IsBoolean()
  @IsOptional()
  use_trial?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  trial_days?: number;

  @IsDateString()
  @IsOptional()
  trial_end_at?: string;

  @IsDateString()
  @IsOptional()
  effective_start_at?: string;

  @IsDateString()
  @IsOptional()
  effective_end_at?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateClientSubscriptionStatusDto {
  @IsEnum(CLIENT_SUBSCRIPTION_STATUSES)
  status: ClientSubscriptionStatus;

  @IsInt()
  @Min(1)
  @IsOptional()
  grace_days?: number;

  @IsDateString()
  @IsOptional()
  grace_end_at?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
