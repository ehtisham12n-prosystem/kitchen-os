export const PROCUREMENT_MODES = [
  'branch_direct',
  'central_procurement',
  'hybrid',
] as const;

export type ProcurementMode = (typeof PROCUREMENT_MODES)[number];

export const PROCUREMENT_CONTEXTS = [
  'branch_procurement',
  'branch_requisition',
  'central_procurement',
] as const;

export type ProcurementContext = (typeof PROCUREMENT_CONTEXTS)[number];

export const PROCUREMENT_APPROVAL_SCOPES = [
  'branch',
  'central',
] as const;

export type ProcurementApprovalScope = (typeof PROCUREMENT_APPROVAL_SCOPES)[number];

export const PURCHASE_ORDER_APPROVAL_STATUSES = [
  'not_required',
  'pending',
  'approved',
  'rejected',
] as const;

export type PurchaseOrderApprovalStatus =
  (typeof PURCHASE_ORDER_APPROVAL_STATUSES)[number];

export const PROCUREMENT_PAYABLE_STATUSES = [
  'pending_bill',
  'bill_received',
] as const;

export type ProcurementPayableStatus =
  (typeof PROCUREMENT_PAYABLE_STATUSES)[number];

export const GRN_PURCHASE_SOURCE_TYPES = [
  'PO',
  'NON_PO',
] as const;

export type GrnPurchaseSourceType =
  (typeof GRN_PURCHASE_SOURCE_TYPES)[number];

export const GRN_PAYMENT_STATUSES = [
  'PAID',
  'PARTIAL_PAID',
  'CREDIT',
] as const;

export type GrnPaymentStatus =
  (typeof GRN_PAYMENT_STATUSES)[number];

export const PROCUREMENT_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'converted',
] as const;

export type ProcurementRequestStatus =
  (typeof PROCUREMENT_REQUEST_STATUSES)[number];

export const PROCUREMENT_REQUEST_PRIORITIES = [
  'routine',
  'urgent',
  'critical',
] as const;

export type ProcurementRequestPriority =
  (typeof PROCUREMENT_REQUEST_PRIORITIES)[number];
