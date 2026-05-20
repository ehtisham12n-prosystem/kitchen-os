import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateBlueprintDto {
    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsString()
    @IsOptional()
    config_json?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}

export class UpdateBlueprintDto {
    @IsString()
    @IsOptional()
    slug?: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsString()
    @IsOptional()
    config_json?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
