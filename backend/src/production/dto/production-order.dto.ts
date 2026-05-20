import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompleteProductionBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  batch_no?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  actual_quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastage_quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProductionOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_branch_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipe_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prepared_item_id?: number;

  @IsOptional()
  @IsIn(['semi_prepared', 'prepared'])
  output_stage?: 'semi_prepared' | 'prepared';

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  planned_quantity: number;

  @IsOptional()
  @IsDateString()
  production_date?: string;

  @IsOptional()
  @IsDateString()
  required_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planned_batch_count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_unit_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination_unit_label?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProductionDecisionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class IssueProductionMaterialsDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteProductionOrderDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  actual_quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastage_quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompleteProductionBatchDto)
  batches?: CompleteProductionBatchDto[];
}

export class DispatchProductionOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  dispatch_quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveProductionOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received_quantity?: number;

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

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  variance_notes?: string;
}

export class ProductionOrderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsIn(['source', 'destination', 'all'])
  scope?: 'source' | 'destination' | 'all';

  @IsOptional()
  @IsString()
  status?: string;
}
