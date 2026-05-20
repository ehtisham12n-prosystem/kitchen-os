import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeCostQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;
}

export class RecipeIngredientWriteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  base_quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastage_percentage?: number;
}

export class CreateRecipeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsString()
  @MaxLength(150)
  recipe_name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  yield_quantity: number;

  @IsString()
  @MaxLength(50)
  yield_uom: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  preparation_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serves_people?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  prepared_by?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientWriteDto)
  ingredients?: RecipeIngredientWriteDto[];
}

export class UpdateRecipeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipe_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  yield_quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  yield_uom?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  preparation_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serves_people?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  prepared_by?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientWriteDto)
  ingredients?: RecipeIngredientWriteDto[];
}
