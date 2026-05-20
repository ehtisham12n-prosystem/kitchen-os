import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class CreatePageDto {
    @IsUUID()
    @IsNotEmpty()
    module_id: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    actions: string[];
}

export class UpdatePageDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    actions?: string[];

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
