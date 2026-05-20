import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CATERING_EVENT_STATUSES,
  CATERING_EVENT_BILLING_TYPES,
  CATERING_INQUIRY_STATUSES,
  CATERING_PAYMENT_MODES,
  CATERING_QUOTATION_ITEM_TYPES,
  CATERING_QUOTATION_STATUSES,
  CATERING_SERVICE_TYPES,
  CATERING_SETTLEMENT_TYPES,
  CATERING_SUPPLY_STRATEGIES,
} from '../catering.constants';

export class CateringInquiryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(CATERING_INQUIRY_STATUSES)
  status?: (typeof CATERING_INQUIRY_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateCateringInquiryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsString()
  @MaxLength(150)
  event_title: string;

  @IsEnum(CATERING_SERVICE_TYPES)
  service_type: (typeof CATERING_SERVICE_TYPES)[number];

  @IsDateString()
  event_date: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  start_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  end_time?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guest_count: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  venue_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  venue_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class UpdateCateringInquiryDto extends CreateCateringInquiryDto {
  @IsOptional()
  @IsEnum(CATERING_INQUIRY_STATUSES)
  status?: (typeof CATERING_INQUIRY_STATUSES)[number];
}

export class CateringQuotationItemDto {
  @IsEnum(CATERING_QUOTATION_ITEM_TYPES)
  item_type: (typeof CATERING_QUOTATION_ITEM_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inventory_item_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipe_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line_description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  unit_price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimated_unit_cost?: number;

  @IsOptional()
  @IsEnum(CATERING_SUPPLY_STRATEGIES)
  supply_strategy?: (typeof CATERING_SUPPLY_STRATEGIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  service_notes?: string;
}

export class CreateCateringQuotationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inquiry_id: number;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  service_charge_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms_and_conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CateringQuotationItemDto)
  items: CateringQuotationItemDto[];
}

export class UpdateCateringQuotationDto {
  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  service_charge_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms_and_conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CateringQuotationItemDto)
  items?: CateringQuotationItemDto[];
}

export class CateringQuotationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(CATERING_QUOTATION_STATUSES)
  status?: (typeof CATERING_QUOTATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateQuotationStatusDto {
  @IsEnum(CATERING_QUOTATION_STATUSES)
  status: (typeof CATERING_QUOTATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ConvertQuotationToEventDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  execution_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  production_branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class CateringEventQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(CATERING_EVENT_STATUSES)
  status?: (typeof CATERING_EVENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CateringEventItemUpdateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  unit_price: number;

  @IsOptional()
  @IsEnum(CATERING_SUPPLY_STRATEGIES)
  supply_strategy?: (typeof CATERING_SUPPLY_STRATEGIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  production_notes?: string;
}

export class UpdateCateringEventDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  execution_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  production_branch_id?: number;

  @IsOptional()
  @IsDateString()
  event_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  start_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  end_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guest_count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  venue_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  venue_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  coordinator_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coordinator_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actual_total_amount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CateringEventItemUpdateDto)
  items?: CateringEventItemUpdateDto[];
}

export class UpdateCateringEventStatusDto {
  @IsEnum(CATERING_EVENT_STATUSES)
  status: (typeof CATERING_EVENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateEventProcurementDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requesting_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  preferred_vendor_id?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  event_item_ids?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class CreateEventProductionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_branch_id?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  event_item_ids?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class RecordEventSettlementDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsDateString()
  payment_date: string;

  @IsEnum(CATERING_PAYMENT_MODES)
  payment_mode: (typeof CATERING_PAYMENT_MODES)[number];

  @IsOptional()
  @IsEnum(CATERING_SETTLEMENT_TYPES)
  settlement_type?: (typeof CATERING_SETTLEMENT_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class IssueEventBillingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsDateString()
  billing_date: string;

  @IsEnum(CATERING_EVENT_BILLING_TYPES)
  billing_type: (typeof CATERING_EVENT_BILLING_TYPES)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class CateringOptionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;
}
