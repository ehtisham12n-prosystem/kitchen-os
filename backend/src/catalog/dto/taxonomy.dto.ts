import { Type } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsNumber, MaxLength, IsObject, IsArray } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @MaxLength(150)
    category_name: string;

    @IsOptional()
    @IsString()
    category_description?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    category_sort_order?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    parent_category_id?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    @MaxLength(150)
    category_name?: string;

    @IsOptional()
    @IsString()
    category_description?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    category_sort_order?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    parent_category_id?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class CreatePriceProfileDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    sort_order?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class UpdatePriceProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    sort_order?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class CreateStationDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    supports_hot_food?: boolean;

    @IsOptional()
    @IsBoolean()
    supports_cold_food?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    kitchen_display_order?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class UpdateStationDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    supports_hot_food?: boolean;

    @IsOptional()
    @IsBoolean()
    supports_cold_food?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    kitchen_display_order?: number;

    @IsOptional()
    @IsObject()
    branchAvailability?: Record<string, boolean>;
}

export class ReassignTaxonomyDependenciesDto {
    @Type(() => Number)
    @IsNumber()
    target_id: number;

    @IsOptional()
    @IsArray()
    @Type(() => Number)
    product_ids?: number[];
}
