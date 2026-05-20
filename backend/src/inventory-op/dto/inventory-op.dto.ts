import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PROCUREMENT_APPROVAL_SCOPES,
  PROCUREMENT_CONTEXTS,
  PROCUREMENT_PAYABLE_STATUSES,
  PROCUREMENT_MODES,
  PROCUREMENT_REQUEST_PRIORITIES,
  PROCUREMENT_REQUEST_STATUSES,
  PURCHASE_ORDER_APPROVAL_STATUSES,
} from '../procurement.constants';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }

  return value;
};

export class InventoryReceiptItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_cost: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;
}

export class InventoryMovementItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;
}

export class InventoryIssueItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;
}

export class ReceiveStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vendor_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  po_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  grn_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor_invoice_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor_bill_reference?: string;

  @IsOptional()
  @IsString()
  vendor_bill_date?: string;

  @IsOptional()
  @IsString()
  vendor_bill_due_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vendor_bill_amount?: number;

  @IsOptional()
  @IsIn(PROCUREMENT_PAYABLE_STATUSES)
  payable_status?: (typeof PROCUREMENT_PAYABLE_STATUSES)[number];

  @IsOptional()
  @IsString()
  receipt_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryReceiptItemDto)
  items: InventoryReceiptItemDto[];
}

export class CaptureGrnBillDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor_invoice_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor_bill_reference?: string;

  @IsOptional()
  @IsString()
  vendor_bill_date?: string;

  @IsOptional()
  @IsString()
  vendor_bill_due_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vendor_bill_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GrnReturnItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grn_item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGrnReturnDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  return_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  debit_note_reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnReturnItemDto)
  items: GrnReturnItemDto[];
}

export class CreateProcurementRequestItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  requested_quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProcurementRequestDto {
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
  @IsIn(PROCUREMENT_MODES)
  procurement_mode?: (typeof PROCUREMENT_MODES)[number];

  @IsOptional()
  @IsIn(PROCUREMENT_CONTEXTS)
  procurement_context?: (typeof PROCUREMENT_CONTEXTS)[number];

  @IsOptional()
  @IsIn(PROCUREMENT_APPROVAL_SCOPES)
  approval_scope?: (typeof PROCUREMENT_APPROVAL_SCOPES)[number];

  @IsOptional()
  @IsIn(PROCUREMENT_REQUEST_PRIORITIES)
  priority?: (typeof PROCUREMENT_REQUEST_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementRequestItemDto)
  items: CreateProcurementRequestItemDto[];
}

export class ReviewProcurementRequestDto {
  @IsIn(PROCUREMENT_REQUEST_STATUSES.filter((status) => status !== 'converted'))
  status: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class IssueToKitchenDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issue_to?: string;

  @IsOptional()
  @IsIn(['manual', 'auto'])
  issuance_type?: 'manual' | 'auto';

  @IsOptional()
  @IsString()
  issue_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issued_by_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryIssueItemDto)
  items: InventoryIssueItemDto[];
}

export class CreatePurchaseOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  item_id: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  unit_cost: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destination_branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vendor_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  procurement_request_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  po_number?: string;

  @IsOptional()
  @IsEnum(['draft', 'sent', 'received', 'cancelled', 'ordered'])
  status?: 'draft' | 'sent' | 'received' | 'cancelled' | 'ordered';

  @IsOptional()
  @IsEnum(['draft', 'ordered', 'received', 'cancelled'])
  po_status?: 'draft' | 'ordered' | 'received' | 'cancelled';

  @IsOptional()
  @IsString()
  expected_delivery_date?: string;

  @IsOptional()
  @IsString()
  expected_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination_store_label?: string;

  @IsOptional()
  @IsIn(PROCUREMENT_MODES)
  procurement_mode?: (typeof PROCUREMENT_MODES)[number];

  @IsOptional()
  @IsIn(PROCUREMENT_CONTEXTS)
  procurement_context?: (typeof PROCUREMENT_CONTEXTS)[number];

  @IsOptional()
  @IsIn(PROCUREMENT_APPROVAL_SCOPES)
  approval_scope?: (typeof PROCUREMENT_APPROVAL_SCOPES)[number];

  @IsOptional()
  @IsIn(PURCHASE_ORDER_APPROVAL_STATUSES)
  approval_status?: (typeof PURCHASE_ORDER_APPROVAL_STATUSES)[number];

  @IsOptional()
  @IsString()
  approval_notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(['draft', 'sent', 'received', 'cancelled', 'ordered'])
  status: 'draft' | 'sent' | 'received' | 'cancelled' | 'ordered';
}

export class UpdatePurchaseOrderApprovalDto {
  @IsIn(PURCHASE_ORDER_APPROVAL_STATUSES.filter((status) => status !== 'not_required'))
  approval_status: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  approval_notes?: string;
}

export class ListStockLedgerQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  itemId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transactionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  paginate?: boolean;
}

export class ListGoodsReceiptsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  vendor_id?: number;

  @IsOptional()
  @IsIn(PROCUREMENT_PAYABLE_STATUSES)
  payable_status?: (typeof PROCUREMENT_PAYABLE_STATUSES)[number];

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  paginate?: boolean;
}

export class ListPurchaseOrdersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(['draft', 'sent', 'received', 'cancelled', 'ordered'])
  status?: 'draft' | 'sent' | 'received' | 'cancelled' | 'ordered';

  @IsOptional()
  @IsIn(PURCHASE_ORDER_APPROVAL_STATUSES)
  approval_status?: (typeof PURCHASE_ORDER_APPROVAL_STATUSES)[number];

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  destination_branch_id?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  vendor_id?: number;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  paginate?: boolean;
}
