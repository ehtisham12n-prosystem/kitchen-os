export const CATERING_SERVICE_TYPES = ['on_premise', 'offsite', 'delivery', 'pickup'] as const;
export type CateringServiceType = (typeof CATERING_SERVICE_TYPES)[number];

export const CATERING_INQUIRY_STATUSES = ['open', 'quoted', 'won', 'lost', 'cancelled'] as const;
export type CateringInquiryStatus = (typeof CATERING_INQUIRY_STATUSES)[number];

export const CATERING_QUOTATION_STATUSES = [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
  'converted',
] as const;
export type CateringQuotationStatus = (typeof CATERING_QUOTATION_STATUSES)[number];

export const CATERING_QUOTATION_ITEM_TYPES = [
  'product',
  'inventory',
  'service',
  'fee',
  'discount',
  'other',
] as const;
export type CateringQuotationItemType = (typeof CATERING_QUOTATION_ITEM_TYPES)[number];

export const CATERING_SUPPLY_STRATEGIES = ['none', 'produce', 'procure', 'both'] as const;
export type CateringSupplyStrategy = (typeof CATERING_SUPPLY_STRATEGIES)[number];

export const CATERING_EVENT_STATUSES = [
  'planned',
  'confirmed',
  'in_production',
  'ready',
  'completed',
  'cancelled',
] as const;
export type CateringEventStatus = (typeof CATERING_EVENT_STATUSES)[number];

export const CATERING_BILLING_STATUSES = [
  'unbilled',
  'billed',
  'partially_paid',
  'paid',
] as const;
export type CateringBillingStatus = (typeof CATERING_BILLING_STATUSES)[number];

export const CATERING_EVENT_BILLING_TYPES = ['deposit', 'milestone', 'final'] as const;
export type CateringEventBillingType = (typeof CATERING_EVENT_BILLING_TYPES)[number];

export const CATERING_PAYMENT_MODES = ['cash', 'bank', 'card', 'online', 'cheque', 'other'] as const;
export type CateringPaymentMode = (typeof CATERING_PAYMENT_MODES)[number];

export const CATERING_SETTLEMENT_TYPES = [
  'advance',
  'collection',
  'advance_refund',
  'collection_refund',
  'write_off',
] as const;
export type CateringSettlementType = (typeof CATERING_SETTLEMENT_TYPES)[number];
