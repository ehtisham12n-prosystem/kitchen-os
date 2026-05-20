import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateDepartmentsDto {
    @IsString()
    @MaxLength(50)
    code: string;

    @IsString()
    @MaxLength(150)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    headName?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;
}

export class UpdateDepartmentsDto {
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
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    headName?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    branchAvailability?: Record<string, boolean>;
}
