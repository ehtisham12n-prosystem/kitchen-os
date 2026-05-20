import { Type } from 'class-transformer';
import {
  IsObject,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class PaymentTypeRatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cash?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  card?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bank?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  digital_wallet?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  other?: number;
}

export class CreateTaxConfigurationDto {
  @IsString()
  @MaxLength(100)
  tax_name: string;

  @IsString()
  @MaxLength(50)
  tax_code: string;

  @IsString()
  @MaxLength(100)
  tax_registration_number: string;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  calculation_method?: 'percentage' | 'fixed';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_rate: number;

  @IsOptional()
  @IsObject()
  @Type(() => PaymentTypeRatesDto)
  payment_type_rates?: PaymentTypeRatesDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_dine_in?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_takeout?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_delivery?: boolean;
}

export class UpdateTaxConfigurationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tax_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tax_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tax_registration_number?: string;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  calculation_method?: 'percentage' | 'fixed';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsObject()
  @Type(() => PaymentTypeRatesDto)
  payment_type_rates?: PaymentTypeRatesDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_dine_in?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_takeout?: boolean;

  @IsOptional()
  @IsBoolean()
  applies_to_delivery?: boolean;
}
