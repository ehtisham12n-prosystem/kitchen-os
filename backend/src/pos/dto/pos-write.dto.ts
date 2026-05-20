import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OpenShiftDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsNumber()
  opening_float: number;
}

export class CloseShiftDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsNumber()
  actual_cash: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supervisor_id?: number;
}

export class CreatePosTableDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floor_id?: number;

  @IsString()
  @MaxLength(50)
  table_number: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(['vacant', 'occupied', 'reserved', 'cleaning'])
  status?: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
}

export class UpdatePosTableStatusDto {
  @IsEnum(['vacant', 'occupied', 'reserved', 'cleaning'])
  status: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
}

export class PosDeliveryDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  house_apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  street_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area_sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ask_for?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  delivery_person_user_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  delivery_person_name?: string;

  @IsOptional()
  @IsEnum(['paid', 'cod'])
  payment_term?: 'paid' | 'cod';

  @IsOptional()
  @IsEnum(['pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'])
  delivery_status?: 'pending' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CreatePosOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  order_number?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(['dine_in', 'takeout', 'takeaway', 'delivery'])
  order_type?: 'dine_in' | 'takeout' | 'takeaway' | 'delivery';

  @IsOptional()
  @IsEnum(['held', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'voided'])
  order_status?: 'held' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'voided';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  table_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_taker_user_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_counter_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  order_note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PosDeliveryDetailsDto)
  delivery_details?: PosDeliveryDetailsDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sub_total?: number;

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
  @MaxLength(100)
  voucher_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_amount?: number;

  @IsOptional()
  @IsString()
  payment_status?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  @IsArray()
  items?: PosOrderItemDto[];
}

export class UpdatePosOrderHeaderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(['dine_in', 'takeout', 'takeaway', 'delivery'])
  order_type?: 'dine_in' | 'takeout' | 'takeaway' | 'delivery';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  table_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_taker_user_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  order_note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PosDeliveryDetailsDto)
  delivery_details?: PosDeliveryDetailsDto;
}

export class RegisterPosDeviceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsString()
  @MaxLength(100)
  device_uid: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_name?: string;

  @IsOptional()
  @IsEnum(['pos_terminal', 'kds', 'order_taker', 'backoffice', 'other'])
  device_type?: 'pos_terminal' | 'kds' | 'order_taker' | 'backoffice' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  app_version?: string;
}

export class OfflineShiftSnapshotDto {
  @IsString()
  @MaxLength(100)
  shift_reference: string;

  @IsEnum(['open', 'closed'])
  status: 'open' | 'closed';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  opening_float: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actual_cash?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supervisor_id?: number;

  @IsOptional()
  @IsDateString()
  opened_at?: string;

  @IsOptional()
  @IsDateString()
  closed_at?: string;
}

export class OfflineBusinessDaySnapshotDto {
  @IsString()
  @MaxLength(100)
  business_day_reference: string;

  @IsDateString()
  business_date: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsEnum(['open', 'closed'])
  status?: 'open' | 'closed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  opened_at?: string;

  @IsOptional()
  @IsDateString()
  closed_at?: string;
}

export class OfflineCounterSessionSnapshotDto {
  @IsString()
  @MaxLength(100)
  counter_session_reference: string;

  @IsString()
  @MaxLength(100)
  business_day_reference: string;

  @IsDateString()
  business_date: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_counter_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cashier_user_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  cashier_name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assigned_float: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  opening_verified_cash: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  blind_count?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expected_cash?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  variance?: number;

  @IsOptional()
  @IsEnum(['open', 'active', 'closed'])
  terminal_status?: 'open' | 'active' | 'closed';

  @IsOptional()
  @IsDateString()
  opened_at?: string;

  @IsOptional()
  @IsDateString()
  closed_at?: string;

  @IsOptional()
  @IsString()
  x_report_json?: string;
}

export class OfflineOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  product_name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class OfflineOrderSnapshotDto {
  @IsString()
  @MaxLength(50)
  order_number: string;

  @IsOptional()
  @IsEnum(['dine_in', 'takeout', 'takeaway', 'delivery'])
  order_type?: 'dine_in' | 'takeout' | 'takeaway' | 'delivery';

  @IsOptional()
  @IsEnum(['held', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'voided'])
  order_status?: 'held' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'voided';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  table_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  order_remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shift_reference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_counter_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsOptional()
  @IsDateString()
  created_at?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sub_total: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount: number;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'digital_wallet', 'other'])
  payment_mode?: 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  @IsArray()
  @ArrayMinSize(1)
  payments?: PosPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  payment_note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receipt_number?: string;

  @IsOptional()
  @IsBoolean()
  close_on_sync?: boolean;

  @IsOptional()
  @IsBoolean()
  is_credit_sale?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfflineOrderItemDto)
  items: OfflineOrderItemDto[];
}

export class OfflineKotStatusDto {
  @IsString()
  @MaxLength(50)
  order_number: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  kot_number?: string;

  @IsString()
  @MaxLength(50)
  status: string;
}

export class PosSyncBatchEventDto {
  @IsString()
  @MaxLength(100)
  event_id: string;

  @IsString()
  @MaxLength(50)
  entity_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity_id?: string;

  @IsOptional()
  @IsEnum(['upsert', 'delete', 'sync'])
  event_type?: 'upsert' | 'delete' | 'sync';

  @IsString()
  @MaxLength(64)
  payload_hash: string;

  @IsOptional()
  @IsDateString()
  queued_at?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfflineOrderSnapshotDto)
  order?: OfflineOrderSnapshotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfflineKotStatusDto)
  kot?: OfflineKotStatusDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfflineShiftSnapshotDto)
  shift?: OfflineShiftSnapshotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfflineBusinessDaySnapshotDto)
  business_day?: OfflineBusinessDaySnapshotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfflineCounterSessionSnapshotDto)
  counter_session?: OfflineCounterSessionSnapshotDto;
}

export class PosSyncBatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsString()
  @MaxLength(100)
  device_uid: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_name?: string;

  @IsOptional()
  @IsEnum(['pos_terminal', 'kds', 'order_taker', 'backoffice', 'other'])
  device_type?: 'pos_terminal' | 'kds' | 'order_taker' | 'backoffice' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  app_version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batch_id?: string;

  @IsOptional()
  @IsDateString()
  sent_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  queue_depth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  failed_event_count?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  conflict_event_count?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosSyncBatchEventDto)
  events: PosSyncBatchEventDto[];
}

export class ListPosDeviceSyncEventsDto {
  @IsOptional()
  @IsEnum(['pending', 'processed', 'failed', 'conflict'])
  status?: 'pending' | 'processed' | 'failed' | 'conflict';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(['open', 'acknowledged', 'resolved'])
  resolution_status?: 'open' | 'acknowledged' | 'resolved';
}

export class ReconcilePosSyncEventDto {
  @IsEnum(['acknowledge', 'resolve'])
  action: 'acknowledge' | 'resolve';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PosOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  product_name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  item_price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class UpdatePosOrderItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  item_price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  approval_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adjustment_reason?: string;
}

export class PosPaymentDto {
  @IsEnum(['cash', 'bank', 'card', 'digital_wallet', 'other'])
  payment_mode: 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsObject()
  payment_details?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  transaction_date?: string;
}

export class CreatePosCardMachineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsString()
  @MaxLength(120)
  machine_name: string;

  @IsString()
  @MaxLength(120)
  service_provider: string;

  @IsString()
  @MaxLength(80)
  pid_number: string;

  @IsString()
  @MaxLength(80)
  mid_number: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePosCardMachineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  machine_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  service_provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pid_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mid_number?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];
}

export class UpdateKotStatusDto {
  @IsString()
  @MaxLength(50)
  status: string;
}

export class ListPosOrdersDto {
  @IsOptional()
  @IsEnum(['held', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'voided'])
  status?: 'held' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'voided';
}

export class UpdateOrderStatusDto {
  @IsEnum(['held', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'voided'])
  order_status: 'held' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'voided';
}

export class UpdateOrderTableDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  table_id?: number;
}

export class UpdateOrderItemStatusDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsEnum(['pending', 'cooking', 'ready', 'served', 'voided'])
  item_status: 'pending' | 'cooking' | 'ready' | 'served' | 'voided';

  @IsOptional()
  @IsString()
  @MaxLength(150)
  approval_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adjustment_reason?: string;
}

export class CloseOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  voucher_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  service_charge_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @IsBoolean()
  skip_tax?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tax_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_taker_user_id?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PosDeliveryDetailsDto)
  delivery_details?: PosDeliveryDetailsDto;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'digital_wallet', 'other'])
  payment_mode?: 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments?: PosPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  payment_note?: string;
}

export class SettleCreditOrderDto {
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

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'digital_wallet', 'other'])
  payment_mode?: 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments?: PosPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  payment_note?: string;
}

export class CreditSaleOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  voucher_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  service_charge_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @IsBoolean()
  skip_tax?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tax_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_taker_user_id?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PosDeliveryDetailsDto)
  delivery_details?: PosDeliveryDetailsDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  payment_note?: string;
}

export class ReturnOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'digital_wallet', 'other'])
  payment_mode?: 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments?: PosPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  return_note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  payment_note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnOrderLineDto)
  items?: ReturnOrderLineDto[];

  @IsOptional()
  @IsBoolean()
  restock_inventory?: boolean;

  @IsString()
  @MaxLength(150)
  approval_username: string;

  @IsString()
  @MaxLength(20)
  approval_pin: string;
}

export class ReturnOrderLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_item_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class LineItemOverrideDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  approval_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adjustment_reason?: string;
}

export class CancelPosOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsString()
  @MaxLength(150)
  approval_username: string;

  @IsString()
  @MaxLength(20)
  approval_pin: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cancel_reason?: string;
}

/** One authorized till entry for StartBusinessDayDto */
export class AuthorizedTillInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_counter_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assigned_float: number;
}

export class CreateBusinessDayDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsDateString()
  business_date: string;

  @IsOptional()
  @IsDateString()
  opened_at?: string;

  @IsOptional()
  @IsDateString()
  planned_closing_at?: string;

  @IsOptional()
  @IsBoolean()
  is_off_day?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  off_day_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CloseBusinessDayDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateShiftTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(8)
  planned_start_time: string;

  @IsString()
  @MaxLength(8)
  planned_end_time: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  allow_overlap?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateShiftTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  planned_start_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  planned_end_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  allow_overlap?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class StartOperatingShiftDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shift_template_id: number;
}

export class UpdateOperatingShiftDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shift_name?: string;

  @IsOptional()
  @IsDateString()
  planned_start?: string;

  @IsOptional()
  @IsDateString()
  planned_end?: string;
}

export class AssignCounterSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sale_counter_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assigned_float: number;
}

export class VerifyCounterOpeningDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  verified_opening_cash: number;
}

export class VerifyCounterClosingDto {
  @IsString()
  @MaxLength(150)
  authorized_username: string;

  @IsString()
  @MaxLength(10)
  supervisor_pin: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reconciliation_notes?: string;
}

/** Manager starts a new business day: picks business date and which tills (with floats) are open. */
export class StartBusinessDayDto {
  @IsDateString()
  business_date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AuthorizedTillInputDto)
  tills: AuthorizedTillInputDto[];
}

/** Cashier submits a blind count for their till (without knowing the expected total). */
export class SubmitBlindCountDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  blind_count: number;

  @IsString()
  @MaxLength(150)
  cashier_username: string;

  @IsString()
  @MaxLength(10)
  cashier_pin: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  authorized_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  authorized_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  supervisor_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  supervisor_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Manager reconciles one specific till after the cashier has submitted their blind count. */
export class ReconcileTillDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reconciliation_notes?: string;
}

/** Manager reassigns a till that is still 'open' but not yet active. */
export class ReassignTillDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assigned_float?: number;
}
