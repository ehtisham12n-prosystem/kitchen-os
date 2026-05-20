import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const CLIENT_BRANDING_ASSET_KEYS = ['full_logo', 'short_logo', 'login_background'] as const;

export type ClientBrandingAssetKey = typeof CLIENT_BRANDING_ASSET_KEYS[number];

export class UpdateClientBrandingDto {
  @IsOptional()
  @IsObject()
  numbering_settings?: Record<string, any> | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  receipt_business_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receipt_footer_message_1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receipt_footer_message_2?: string | null;

  @IsOptional()
  @IsBoolean()
  show_receipt_full_logo?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_short_logo?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_business_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_branch_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_branch_address?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_contact_number?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_footer_message_1?: boolean;

  @IsOptional()
  @IsBoolean()
  show_receipt_footer_message_2?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_full_logo?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_short_logo?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_business_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_branch_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_branch_address?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_contact_number?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_footer_message_1?: boolean;

  @IsOptional()
  @IsBoolean()
  show_kot_footer_message_2?: boolean;

  @IsOptional()
  @IsBoolean()
  show_login_full_logo?: boolean;

  @IsOptional()
  @IsBoolean()
  show_login_business_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_login_branch_name?: boolean;

  @IsOptional()
  @IsBoolean()
  show_header_short_logo?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['thermal-80mm', 'a6', 'a5', 'a4'])
  receipt_paper_size?: string;

  @IsOptional()
  @IsString()
  @IsIn(['thermal-80mm', 'a6', 'a5', 'a4'])
  invoice_paper_size?: string;

  @IsOptional()
  @IsString()
  @IsIn(['thermal-80mm', 'a6', 'a5', 'a4'])
  kot_paper_size?: string;

  @IsOptional()
  @IsString()
  @IsIn(['thermal-80mm', 'a6', 'a5', 'a4'])
  report_paper_size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  receipt_print_copies?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  invoice_print_copies?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  kot_print_copies?: number;

  @IsOptional()
  @IsBoolean()
  kot_print_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  report_print_copies?: number;

  @IsOptional()
  @IsString()
  @IsIn(['change_only', 'full_snapshot', 'both'])
  order_change_print_mode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  order_change_print_copies?: number;

  @IsOptional()
  @IsBoolean()
  enable_station_wise_kot_printing?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_multiple_kot_per_station?: boolean;

  @IsOptional()
  @IsObject()
  service_station_print_copies?: Record<string, number> | null;

  @IsOptional()
  @IsObject()
  station_printer_mapping?: Record<string, string> | null;

  @IsOptional()
  separate_kot_stations?: string[] | null;
}

export class UploadClientBrandingAssetDto {
  @IsIn(CLIENT_BRANDING_ASSET_KEYS)
  asset_key: ClientBrandingAssetKey;
}
