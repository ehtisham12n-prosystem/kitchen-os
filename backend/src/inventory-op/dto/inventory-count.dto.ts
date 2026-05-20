import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  INVENTORY_COUNT_STATUSES,
  INVENTORY_COUNT_TYPES,
} from '../entities/inventory-count-session.entity';
import { INVENTORY_REVIEW_ACTIONS } from '../entities/inventory-count-session-item.entity';

export class ListInventoryCountSessionsQueryDto {
  @IsOptional()
  @IsEnum(INVENTORY_COUNT_STATUSES)
  status?: (typeof INVENTORY_COUNT_STATUSES)[number];

  @IsOptional()
  @IsEnum(INVENTORY_COUNT_TYPES)
  count_type?: (typeof INVENTORY_COUNT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  location_id?: number;

  @IsOptional()
  @IsDateString()
  business_date?: string;
}

export class CreateInventoryCountSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsEnum(INVENTORY_COUNT_TYPES)
  count_type: (typeof INVENTORY_COUNT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  location_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsDateString()
  business_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  period_key?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sample_size?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  item_ids?: number[];

  @IsOptional()
  @IsBoolean()
  force_full_count?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitInventoryCountLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  counted_quantity: number;
}

export class SubmitInventoryCountSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitInventoryCountLineDto)
  lines: SubmitInventoryCountLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewInventoryCountLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  line_id: number;

  @IsEnum(INVENTORY_REVIEW_ACTIONS)
  review_action: (typeof INVENTORY_REVIEW_ACTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reason_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  review_notes?: string;
}

export class ReviewInventoryCountSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewInventoryCountLineDto)
  lines: ReviewInventoryCountLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
