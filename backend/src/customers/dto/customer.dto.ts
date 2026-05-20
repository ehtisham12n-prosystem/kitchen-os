import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customer_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';

  @IsOptional()
  @IsEnum(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  preferred_branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line_1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line_2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  organization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  allow_credit?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit_limit?: number;

  @IsOptional()
  @IsEnum(['warn', 'block'])
  credit_control_mode?: 'warn' | 'block';

  @IsOptional()
  @IsString()
  collection_follow_up_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  collection_follow_up_note?: string;

  @IsOptional()
  @IsBoolean()
  marketing_opt_in?: boolean;
}

export class UpdateCustomerDto extends CreateCustomerDto {}

export class ListCustomersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';
}

export class CustomerPurchaseHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class LoyaltyAdjustmentDto {
  @Type(() => Number)
  @IsNumber()
  points_delta: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remarks?: string;
}
