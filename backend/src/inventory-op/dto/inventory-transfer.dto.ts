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
  ValidateNested,
} from 'class-validator';
import {
  INVENTORY_TRANSFER_ITEM_STAGES,
  type InventoryTransferItemStage,
} from '../entities/inventory-transfer-item.entity';

export class CreateInventoryTransferItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @IsOptional()
  @IsEnum(INVENTORY_TRANSFER_ITEM_STAGES)
  production_stage?: InventoryTransferItemStage;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  requested_quantity: number;
}

export class CreateInventoryTransferDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_branch_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_branch_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_store_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination_store_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  reason_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  origin_production_order_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  origin_production_no?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryTransferItemDto)
  items: CreateInventoryTransferItemDto[];
}

export class TransferDecisionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransferFinanceReviewDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DispatchInventoryTransferItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transfer_item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  dispatch_quantity: number;
}

export class DispatchInventoryTransferDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchInventoryTransferItemDto)
  items: DispatchInventoryTransferItemDto[];
}

export class ReceiveInventoryTransferItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transfer_item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received_quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  short_quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  damaged_quantity?: number;

  @IsOptional()
  @IsString()
  variance_reason?: string;
}

export class ReceiveInventoryTransferDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  variance_notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveInventoryTransferItemDto)
  items: ReceiveInventoryTransferItemDto[];
}
