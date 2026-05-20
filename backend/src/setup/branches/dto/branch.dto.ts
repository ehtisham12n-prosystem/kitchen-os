import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BRANCH_INVENTORY_STORE_TYPES,
  BRANCH_STATUSES,
  type BranchStatus,
} from '../branch-control.types';
import {
  BRANCH_KDS_ALERT_SOUNDS,
  BRANCH_DOCUMENT_DATE_SEGMENT_FORMATS,
  BRANCH_DOCUMENT_RESET_FREQUENCIES,
  INVENTORY_COUNT_FREQUENCIES,
  BRANCH_ORDER_TYPES,
  BRANCH_TAX_ROUNDING_METHODS,
  type BranchKdsAlertSound,
} from '../branch-config.types';

class BranchOperatingDayDto {
  @IsBoolean()
  is_open: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'open_time must be in HH:MM or HH:MM:SS format',
  })
  open_time?: string | null;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'close_time must be in HH:MM or HH:MM:SS format',
  })
  close_time?: string | null;
}

class BranchDocumentRuleDto {
  @IsString()
  @MaxLength(20)
  prefix: string;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  zero_pad: number;

  @IsEnum(BRANCH_DOCUMENT_RESET_FREQUENCIES)
  reset_frequency: 'never' | 'manual' | 'business_day' | 'calendar_day' | 'monthly' | 'annually';

  @IsBoolean()
  include_branch_code: boolean;

  @IsBoolean()
  include_counter_code: boolean;

  @IsEnum(BRANCH_DOCUMENT_DATE_SEGMENT_FORMATS)
  date_segment_format: 'none' | 'YYMM' | 'YYMMDD';

  @IsOptional()
  @IsString()
  manual_reset_at?: string | null;
}

class BranchTaxSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  default_tax_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dine_in_tax_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  takeaway_tax_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  delivery_tax_code?: string | null;

  @IsOptional()
  @IsBoolean()
  prices_include_tax?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_tax_exemption?: boolean;

  @IsOptional()
  @IsEnum(BRANCH_TAX_ROUNDING_METHODS)
  tax_rounding_method?: 'nearest' | 'up' | 'down';
}

class BranchOperationalSettingsDto {
  @IsOptional()
  @IsEnum(BRANCH_ORDER_TYPES)
  default_order_type?: 'dine_in' | 'takeout' | 'delivery';

  @IsOptional()
  @IsBoolean()
  require_open_shift?: boolean;

  @IsOptional()
  @IsBoolean()
  require_sale_counter?: boolean;

  @IsOptional()
  @IsBoolean()
  floor_service_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pickup_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_assign_tables?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'business_day_cutoff_time must be in HH:MM or HH:MM:SS format',
  })
  business_day_cutoff_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  line_item_cancel_reduce_limit_minutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  item_edit_lock_minutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  item_cancellation_window_minutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order_cancellation_window_minutes?: number;

  @IsOptional()
  @IsEnum(BRANCH_KDS_ALERT_SOUNDS)
  kds_new_order_alert_sound?: BranchKdsAlertSound;

  @IsOptional()
  @IsEnum(BRANCH_KDS_ALERT_SOUNDS)
  kds_order_change_alert_sound?: BranchKdsAlertSound;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kds_alert_volume_level?: number;
}

export class BranchInventoryControlSettingsDto {
  @IsOptional()
  @IsBoolean()
  blind_random_enabled?: boolean;

  @IsOptional()
  @IsEnum(INVENTORY_COUNT_FREQUENCIES)
  blind_random_frequency?: 'daily' | 'alternate_day' | 'weekly';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  blind_random_sample_size?: number;

  @IsOptional()
  @IsBoolean()
  end_of_day_blind_enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  end_of_day_sample_size?: number;

  @IsOptional()
  @IsBoolean()
  monthly_blind_full_enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discrepancy_percent_warn_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discrepancy_percent_critical_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discrepancy_value_warn_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discrepancy_value_critical_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  escalation_variance_line_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  escalation_variance_value_threshold?: number;

  @IsOptional()
  @IsBoolean()
  close_block_on_critical_variance?: boolean;
}

export class BranchOperatingHoursDto {
  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  monday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  tuesday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  wednesday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  thursday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  friday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  saturday: BranchOperatingDayDto;

  @ValidateNested()
  @Type(() => BranchOperatingDayDto)
  sunday: BranchOperatingDayDto;
}

export class BranchDocumentSettingsDto {
  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  purchase_order: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  procurement_request: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  goods_receipt_note: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  pos_order: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  pos_receipt: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  pos_kot: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  payment_voucher: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  expense_voucher: BranchDocumentRuleDto;

  @ValidateNested()
  @Type(() => BranchDocumentRuleDto)
  compensation_voucher: BranchDocumentRuleDto;
}

export class CreateFloorDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  floor_name: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  display_order?: number;
}

export class UpdateFloorDto extends CreateFloorDto {}

export class CreateTableDto {
  @IsString()
  @MaxLength(50)
  table_number: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  table_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(['vacant', 'occupied', 'reserved', 'cleaning'])
  status?: 'vacant' | 'occupied' | 'reserved' | 'cleaning';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateTableStatusDto {
  @IsString()
  @IsEnum(['vacant', 'occupied', 'reserved', 'cleaning'])
  status: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
}

export class UpdateTableDto extends CreateTableDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floor_id?: number;
}

export class CreateBranchDto {
  @IsString()
  @MaxLength(150)
  branch_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  short_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branch_code?: string;

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
  tax_region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  date_format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  time_format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  theme_id?: string;

  @IsOptional()
  @IsBoolean()
  inherit_client_currency?: boolean;

  @IsOptional()
  @IsBoolean()
  inherit_client_language?: boolean;

  @IsOptional()
  @IsBoolean()
  inherit_client_theme?: boolean;

  @IsOptional()
  @IsEnum(BRANCH_INVENTORY_STORE_TYPES)
  inventory_store_type?: 'branch' | 'central';

  @IsOptional()
  @IsBoolean()
  is_production_source?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  production_source_label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules_enabled?: string[];

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'opening_time must be in HH:MM or HH:MM:SS format',
  })
  opening_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'closing_time must be in HH:MM or HH:MM:SS format',
  })
  closing_time?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchOperatingHoursDto)
  operating_hours?: BranchOperatingHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDocumentSettingsDto)
  document_settings?: BranchDocumentSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchTaxSettingsDto)
  tax_settings?: BranchTaxSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchOperationalSettingsDto)
  operational_settings?: BranchOperationalSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchInventoryControlSettingsDto)
  inventory_control_settings?: BranchInventoryControlSettingsDto;

  @IsOptional()
  @IsEnum(BRANCH_STATUSES)
  status?: BranchStatus;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Matches(/^[\d\-+() ]+$/, {
    message: 'phone can contain only digits, spaces, and common phone symbols',
  })
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  branch_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  short_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  branch_code?: string;

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
  tax_region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  date_format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  time_format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  theme_id?: string;

  @IsOptional()
  @IsBoolean()
  inherit_client_currency?: boolean;

  @IsOptional()
  @IsBoolean()
  inherit_client_language?: boolean;

  @IsOptional()
  @IsBoolean()
  inherit_client_theme?: boolean;

  @IsOptional()
  @IsEnum(BRANCH_INVENTORY_STORE_TYPES)
  inventory_store_type?: 'branch' | 'central';

  @IsOptional()
  @IsBoolean()
  is_production_source?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  production_source_label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules_enabled?: string[];

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'opening_time must be in HH:MM or HH:MM:SS format',
  })
  opening_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'closing_time must be in HH:MM or HH:MM:SS format',
  })
  closing_time?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchOperatingHoursDto)
  operating_hours?: BranchOperatingHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchDocumentSettingsDto)
  document_settings?: BranchDocumentSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchTaxSettingsDto)
  tax_settings?: BranchTaxSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchOperationalSettingsDto)
  operational_settings?: BranchOperationalSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchInventoryControlSettingsDto)
  inventory_control_settings?: BranchInventoryControlSettingsDto;

  @IsOptional()
  @IsEnum(BRANCH_STATUSES)
  status?: BranchStatus;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Matches(/^[\d\-+() ]+$/, {
    message: 'phone can contain only digits, spaces, and common phone symbols',
  })
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;
}

export class UpdateBranchStatusDto {
  @IsEnum(BRANCH_STATUSES)
  status: BranchStatus;
}

export class CreateBranchLocationDto {
  @IsString()
  @MaxLength(120)
  location_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  location_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  location_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateBranchLocationDto extends CreateBranchLocationDto {}

export class CreateBranchChargeDto {
  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  type?: 'percentage' | 'fixed';

  @IsOptional()
  @IsBoolean()
  is_tax?: boolean;

  @IsOptional()
  @IsEnum(['none', 'payment_method', 'order_type'])
  condition_trigger?: 'none' | 'payment_method' | 'order_type';

  @IsOptional()
  @IsObject()
  rate_map?: Record<string, number>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateBranchChargeDto extends CreateBranchChargeDto {}

export class AssignModulesDto {
  @IsArray()
  @IsString({ each: true })
  modules: string[];
}
