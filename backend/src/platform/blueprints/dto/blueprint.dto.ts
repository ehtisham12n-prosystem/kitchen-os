import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BLUEPRINT_STATUSES } from '../../entities/blueprint.entity';
import {
  ROLE_CONTEXT_SCOPES,
  USER_APPROVAL_AUTHORITIES,
} from '../../../setup/users/user-governance.constants';

export class BlueprintSettingsPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fiscal_year_start?: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  contact_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class BlueprintRoleTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  role_name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  is_system_role?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ROLE_CONTEXT_SCOPES)
  context_scope?: (typeof ROLE_CONTEXT_SCOPES)[number];

  @IsOptional()
  @IsEnum(USER_APPROVAL_AUTHORITIES)
  approval_authority?: (typeof USER_APPROVAL_AUTHORITIES)[number];
}

export class BlueprintDepartmentTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  head_name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintDesignationTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  department_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintAccountTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  account_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  account_name: string;

  @IsEnum(['asset', 'liability', 'equity', 'revenue', 'expense'])
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  parent_code?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class BlueprintCategoryTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  template_key?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  category_name: string;

  @IsOptional()
  @IsString()
  category_description?: string;

  @IsOptional()
  @IsInt()
  category_sort_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  parent_template_key?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintPriceProfileTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintCuisineTypeTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintStationTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
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
  @IsInt()
  kitchen_display_order?: number;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintUomTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  template_key?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  abbreviation: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_base_unit?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  base_template_key?: string;

  @IsOptional()
  @IsNumber()
  conversion_factor?: number;

  @IsOptional()
  branch_availability?: Record<string, boolean>;
}

export class BlueprintPayloadDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BlueprintSettingsPresetDto)
  settings?: BlueprintSettingsPresetDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintRoleTemplateDto)
  roles?: BlueprintRoleTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintDepartmentTemplateDto)
  departments?: BlueprintDepartmentTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintDesignationTemplateDto)
  designations?: BlueprintDesignationTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BlueprintAccountTemplateDto)
  chart_of_accounts?: BlueprintAccountTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlueprintCategoryTemplateDto)
  categories?: BlueprintCategoryTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintPriceProfileTemplateDto)
  price_profiles?: BlueprintPriceProfileTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintCuisineTypeTemplateDto)
  cuisine_types?: BlueprintCuisineTypeTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BlueprintStationTemplateDto)
  stations?: BlueprintStationTemplateDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlueprintUomTemplateDto)
  uoms?: BlueprintUomTemplateDto[];
}

export class CreateBlueprintDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  blueprint_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  blueprint_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BLUEPRINT_STATUSES)
  status?: 'draft' | 'active' | 'retired';

  @ValidateNested()
  @Type(() => BlueprintPayloadDto)
  payload: BlueprintPayloadDto;

  @IsOptional()
  @IsString()
  release_notes?: string;
}

export class UpdateBlueprintDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  blueprint_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BLUEPRINT_STATUSES)
  status?: 'draft' | 'active' | 'retired';
}

export class CreateBlueprintVersionDto {
  @ValidateNested()
  @Type(() => BlueprintPayloadDto)
  payload: BlueprintPayloadDto;

  @IsOptional()
  @IsString()
  release_notes?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

export class AssignBlueprintDto {
  @IsString()
  @IsNotEmpty()
  blueprint_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  blueprint_version_id?: number;
}
