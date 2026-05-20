export const CLIENT_LIFECYCLE_STATES = [
  'draft',
  'onboarding',
  'active',
  'suspended',
  'inactive',
  'closed',
  'expired_grace',
  'read_only',
] as const;

export type ClientLifecycleState = (typeof CLIENT_LIFECYCLE_STATES)[number];

export const CLIENT_GOVERNANCE_STATES = [
  'normal',
  'restricted',
  'suspended',
  'closure_pending',
  'closed',
] as const;

export const CLIENT_GOVERNANCE_CONTEXTS = [
  'non_payment',
  'trial_expiry',
  'policy_issue',
  'abuse_risk',
  'admin_hold',
  'manual_override',
] as const;

export type ClientGovernanceState = (typeof CLIENT_GOVERNANCE_STATES)[number];
export type ClientGovernanceContext = (typeof CLIENT_GOVERNANCE_CONTEXTS)[number];
