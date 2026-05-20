import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateVoucherDto {
    @IsString()
    @MaxLength(50)
    code: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(4000)
    description?: string;

    @IsOptional()
    @IsEnum(['percentage', 'fixed_amount'])
    discount_type?: string;

    @IsNumber()
    discount_value: number;

    @IsOptional()
    @IsNumber()
    min_order_value?: number;

    @IsOptional()
    @IsNumber()
    max_discount_amount?: number;

    @IsOptional()
    @IsDateString()
    start_date?: Date;

    @IsOptional()
    @IsDateString()
    end_date?: Date;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsNumber()
    usage_limit?: number;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsEnum(['dine_in', 'takeout', 'delivery'], { each: true })
    applicable_order_types?: Array<'dine_in' | 'takeout' | 'delivery'>;

    @IsOptional()
    @IsBoolean()
    customer_required?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    per_customer_limit?: number;

    @IsOptional()
    @IsBoolean()
    first_order_only?: boolean;
}

export class UpdateVoucherDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    code?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(4000)
    description?: string;

    @IsOptional()
    @IsEnum(['percentage', 'fixed_amount'])
    discount_type?: string;

    @IsOptional()
    @IsNumber()
    discount_value?: number;

    @IsOptional()
    @IsNumber()
    min_order_value?: number;

    @IsOptional()
    @IsNumber()
    max_discount_amount?: number;

    @IsOptional()
    @IsDateString()
    start_date?: Date;

    @IsOptional()
    @IsDateString()
    end_date?: Date;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsNumber()
    usage_limit?: number;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsEnum(['dine_in', 'takeout', 'delivery'], { each: true })
    applicable_order_types?: Array<'dine_in' | 'takeout' | 'delivery'>;

    @IsOptional()
    @IsBoolean()
    customer_required?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    per_customer_limit?: number;

    @IsOptional()
    @IsBoolean()
    first_order_only?: boolean;
}

export class ValidateVoucherDto {
    @IsString()
    @MaxLength(50)
    code: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    order_total: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branch_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    customer_id?: number;

    @IsOptional()
    @IsEnum(['dine_in', 'takeout', 'delivery'])
    order_type?: 'dine_in' | 'takeout' | 'delivery';
}
