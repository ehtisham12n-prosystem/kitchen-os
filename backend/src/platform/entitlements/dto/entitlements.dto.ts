import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  feature_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  feature_name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePlatformFeatureDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  feature_name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePlatformFeatureStatusDto {
  @IsBoolean()
  is_active: boolean;
}

export class UpdatePlanEntitlementsDto {
  @IsArray()
  @IsString({ each: true })
  feature_keys: string[];
}

export class UpdatePlanLimitsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  max_branches?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  max_active_users?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  max_pos_devices?: number;
}

export class UpsertClientFeatureOverrideDto {
  @IsString()
  @IsNotEmpty()
  feature_key: string;

  @IsBoolean()
  is_enabled: boolean;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpsertClientLimitOverrideDto {
  @IsString()
  @IsNotEmpty()
  limit_key: 'max_branches' | 'max_active_users' | 'max_pos_devices';

  @IsInt()
  @Min(0)
  limit_value: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
