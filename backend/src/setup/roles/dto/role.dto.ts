import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ROLE_CONTEXT_SCOPES,
  USER_APPROVAL_AUTHORITIES,
} from '../../users/user-governance.constants';

export class CreateRoleDto {
  @IsString()
  @MaxLength(100)
  role_name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ROLE_CONTEXT_SCOPES)
  context_scope?: (typeof ROLE_CONTEXT_SCOPES)[number];

  @IsOptional()
  @IsIn(USER_APPROVAL_AUTHORITIES)
  approval_authority?: (typeof USER_APPROVAL_AUTHORITIES)[number];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_system_role?: boolean;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role_name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ROLE_CONTEXT_SCOPES)
  context_scope?: (typeof ROLE_CONTEXT_SCOPES)[number];

  @IsOptional()
  @IsIn(USER_APPROVAL_AUTHORITIES)
  approval_authority?: (typeof USER_APPROVAL_AUTHORITIES)[number];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_system_role?: boolean;
}
