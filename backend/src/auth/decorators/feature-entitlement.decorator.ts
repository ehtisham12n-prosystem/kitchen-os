import { SetMetadata } from '@nestjs/common';

export const FEATURE_ENTITLEMENT_KEY = 'feature_entitlement';

export interface FeatureEntitlementMetadata {
  featureKey: string;
  action?: string;
}

export const RequireFeature = (featureKey: string, action?: string) =>
  SetMetadata(FEATURE_ENTITLEMENT_KEY, {
    featureKey,
    action,
  } satisfies FeatureEntitlementMetadata);
