export const CLIENT_SUBSCRIPTION_STATUSES = [
  'pending',
  'trial',
  'active',
  'grace',
  'expired',
  'suspended',
  'cancelled',
] as const;

export const CLIENT_SUBSCRIPTION_BILLING_CYCLES = [
  'monthly',
  'annual',
] as const;

export type ClientSubscriptionStatus = (typeof CLIENT_SUBSCRIPTION_STATUSES)[number];
export type ClientSubscriptionBillingCycle = (typeof CLIENT_SUBSCRIPTION_BILLING_CYCLES)[number];
