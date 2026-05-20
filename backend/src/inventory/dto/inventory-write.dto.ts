import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryClassDto {
  @IsString()
  @MaxLength(150)
  class_name: string;

  @IsOptional()
  @IsString()
  class_description?: string;
}

export class UpdateInventoryClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  class_name?: string;

  @IsOptional()
  @IsString()
  class_description?: string;
}

export class CreateInventoryTypeDto {
  @IsString()
  @MaxLength(150)
  type_name: string;
}

export class UpdateInventoryTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  type_name?: string;
}

export class CreateInventorySubTypeDto {
  @IsString()
  @MaxLength(150)
  sub_type_name: string;

  @IsOptional()
  @IsBoolean()
  affects_stock?: boolean;

  @IsOptional()
  @IsBoolean()
  affects_recipe?: boolean;

  @IsOptional()
  @IsBoolean()
  depreciable?: boolean;

  @IsOptional()
  @IsBoolean()
  track_expiry?: boolean;

  @IsOptional()
  @IsBoolean()
  track_batch?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_issuance?: boolean;
}

export class UpdateInventorySubTypeDto extends CreateInventorySubTypeDto {}

export class CreateInventoryItemDto {
  @IsString()
  @MaxLength(150)
  item_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  item_name_other_language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  item_sku?: string;

  @IsString()
  @MaxLength(50)
  uom_base: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom_purchase?: string;

  @IsOptional()
  @IsEnum(['Raw Material', 'Semi-Finished', 'MRO Supplies', 'Asset', 'Packaging', 'Consumable'])
  item_tag?: 'Raw Material' | 'Semi-Finished' | 'MRO Supplies' | 'Asset' | 'Packaging' | 'Consumable';

  @IsOptional()
  @IsBoolean()
  item_is_active?: boolean;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  item_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  item_name_other_language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  item_sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom_base?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom_purchase?: string;

  @IsOptional()
  @IsEnum(['Raw Material', 'Semi-Finished', 'MRO Supplies', 'Asset', 'Packaging', 'Consumable'])
  item_tag?: 'Raw Material' | 'Semi-Finished' | 'MRO Supplies' | 'Asset' | 'Packaging' | 'Consumable';

  @IsOptional()
  @IsBoolean()
  item_is_active?: boolean;
}

export class UpdateBranchItemToggleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateBranchStockLevelsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsNumber()
  min: number;

  @Type(() => Number)
  @IsNumber()
  max: number;
}

export class CreateItemRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsString()
  @MaxLength(150)
  item_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  item_number?: string;

  @IsString()
  @MaxLength(50)
  uom_base: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom_purchase?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProcessItemRequestDto {
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subTypeId?: number;

  @IsOptional()
  @IsString()
  adminComment?: string;
}

export class CreateVendorDto {
  @IsString()
  @MaxLength(200)
  vendor_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tax_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_terms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  vendor_address?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateVendorDto extends CreateVendorDto {}
