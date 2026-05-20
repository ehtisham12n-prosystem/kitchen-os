import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ArrayUnique,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed)) {
    return parsed > 0 ? parsed : undefined;
  }

  return value;
};

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : value;
};

const normalizeShortCode = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : value;
};

export class ProductCustomizationDto {
  @IsString()
  @MaxLength(100)
  type: string;

  @IsString()
  @MaxLength(100)
  value: string;

  @Type(() => Number)
  @IsNumber()
  price_delta: number;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;
}

export class BranchAvailabilityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsBoolean()
  is_enabled: boolean;
}

export class OrderChannelAvailabilityDto {
  @IsOptional()
  @IsBoolean()
  dine_in?: boolean;

  @IsOptional()
  @IsBoolean()
  takeout?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(150)
  product_name: string;

  @IsOptional()
  @IsString()
  product_description?: string;

  @IsOptional()
  @IsString()
  product_image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  product_base_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serving_time?: number;

  @IsOptional()
  @IsBoolean()
  product_is_configurable?: boolean;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  category_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  cuisine_type_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  price_profile_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  production_station_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  base_uom_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  tax_configuration_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_code?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_branch_active?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_open_order_return?: boolean;

  @IsOptional()
  @IsIn(['all', 'selected'])
  distribution_scope?: 'all' | 'selected';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAvailabilityDto)
  branch_availability?: BranchAvailabilityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCustomizationDto)
  customizations?: ProductCustomizationDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  product_name?: string;

  @IsOptional()
  @IsString()
  product_description?: string;

  @IsOptional()
  @IsString()
  product_image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  product_base_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serving_time?: number;

  @IsOptional()
  @IsBoolean()
  product_is_configurable?: boolean;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  category_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  cuisine_type_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  price_profile_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  production_station_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  base_uom_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  tax_configuration_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_code?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_branch_active?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_open_order_return?: boolean;

  @IsOptional()
  @IsIn(['all', 'selected'])
  distribution_scope?: 'all' | 'selected';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAvailabilityDto)
  branch_availability?: BranchAvailabilityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCustomizationDto)
  customizations?: ProductCustomizationDto[];
}

export class CreateCuisineTypeDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  branchAvailability?: Record<string, boolean>;
}

export class UpdateCuisineTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  branchAvailability?: Record<string, boolean>;
}

export class CreateUomDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @ValidateIf((o) => !o.short_code)
  @Transform(normalizeShortCode)
  @IsString()
  @MaxLength(30)
  abbreviation: string;

  @IsOptional()
  @Transform(normalizeShortCode)
  @IsString()
  @MaxLength(30)
  short_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  uom_type?: 'weight' | 'volume' | 'count';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_base_unit?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  base_unit_id?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  conversion_factor?: number;

  @IsOptional()
  @IsObject()
  branchAvailability?: Record<string, boolean>;
}

export class UpdateUomDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Transform(normalizeShortCode)
  @IsString()
  @MaxLength(30)
  abbreviation?: string;

  @IsOptional()
  @Transform(normalizeShortCode)
  @IsString()
  @MaxLength(30)
  short_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  uom_type?: 'weight' | 'volume' | 'count';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_base_unit?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  base_unit_id?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  conversion_factor?: number;

  @IsOptional()
  @IsObject()
  branchAvailability?: Record<string, boolean>;
}

export class SetBranchMappingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsBoolean()
  is_enabled: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price_override?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price_profile_id?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderChannelAvailabilityDto)
  channel_availability?: OrderChannelAvailabilityDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsBoolean()
  allow_open_order_return?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  temporarily_disabled_until?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  temporary_disable_reason?: string | null;
}

export class BulkBranchMappingItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsBoolean()
  is_enabled: boolean;
}

export class BulkSetBranchMappingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: BulkBranchMappingItemDto) => item.product_id)
  @ValidateNested({ each: true })
  @Type(() => BulkBranchMappingItemDto)
  items: BulkBranchMappingItemDto[];
}

export class UpdateBranchPriceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price_profile_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customization_id?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  price_override?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  station_id?: number;

  @IsOptional()
  @IsString()
  effective_from?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  delivery_minutes?: number;
}
