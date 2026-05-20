import { IsString, IsArray, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export class CreateSysGroupDto {
    @IsString()
    group_name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsOptional()
    permissions?: string[];

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsEnum(['nexus', 'client', 'branch'])
    @IsOptional()
    scope?: string;

    @IsBoolean()
    @IsOptional()
    is_template?: boolean;
}

export class UpdateSysGroupDto {
    @IsString()
    @IsOptional()
    group_name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsOptional()
    permissions?: string[];

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsOptional()
    @IsArray()
    memberIds?: string[];
}
