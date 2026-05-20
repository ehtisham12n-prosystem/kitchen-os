import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CLIENT_CONTACT_TYPES } from '../../entities/client-contact.entity';
import { CLIENT_SUBSCRIPTION_BILLING_CYCLES } from '../../entities/client-subscription.constants';

export const CLIENT_REGISTRY_STATUSES = [
  'draft',
  'onboarding',
  'active',
  'suspended',
  'inactive',
  'closed',
] as const;

export type ClientRegistryStatus = (typeof CLIENT_REGISTRY_STATUSES)[number];
type ClientContactRole = (typeof CLIENT_CONTACT_TYPES)[number];

export class ClientContactInputDto {
  @IsEnum(CLIENT_CONTACT_TYPES)
  contact_type: ClientContactRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  full_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  alternate_phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClientAdminInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  user_name: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class InitialBranchInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  branch_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  short_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'opening_time must be in HH:MM format',
  })
  opening_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'closing_time must be in HH:MM format',
  })
  closing_time?: string;
}

export class CreateClientRegistryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  client_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  legal_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  short_name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'domain_slug must contain lowercase letters, numbers, and hyphens only',
  })
  domain_slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  business_type?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cell_phone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsEnum(CLIENT_REGISTRY_STATUSES)
  status?: ClientRegistryStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  renewal_day?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'renewal_date must use YYYY-MM-DD format',
  })
  renewal_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  grace_period_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  onboarding_blueprint?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  subscription_plan_id?: number;

  @IsOptional()
  @IsEnum(CLIENT_SUBSCRIPTION_BILLING_CYCLES)
  subscription_billing_cycle?: 'monthly' | 'annual';

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientAdminInputDto)
  admin_user?: ClientAdminInputDto;

  @ValidateNested()
  @Type(() => InitialBranchInputDto)
  initial_branch: InitialBranchInputDto;

  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ClientContactInputDto)
  contacts: ClientContactInputDto[];
}

export class UpdateClientRegistryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  client_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  legal_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  short_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  business_type?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cell_phone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  renewal_day?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'renewal_date must use YYYY-MM-DD format',
  })
  renewal_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  grace_period_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  onboarding_blueprint?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientAdminInputDto)
  admin_user?: ClientAdminInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialBranchInputDto)
  initial_branch?: InitialBranchInputDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ClientContactInputDto)
  contacts?: ClientContactInputDto[];
}

export class ChangeClientStatusDto {
  @IsEnum(CLIENT_REGISTRY_STATUSES)
  status: ClientRegistryStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
