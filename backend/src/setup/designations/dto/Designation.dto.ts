import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateDesignationDto {
    @IsString()
    @MaxLength(50)
    code: string;

    @IsString()
    @MaxLength(150)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    level?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    departmentName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;
}

export class UpdateDesignationDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    code?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    level?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    departmentName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;
}
