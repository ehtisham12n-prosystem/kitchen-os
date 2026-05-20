import { BadRequestException } from '@nestjs/common';
import { Branch } from '../entities/branch.entity';
import type {
  BranchDocumentSettings,
  BranchInventoryControlSettings,
  BranchOperatingHours,
  BranchOperationalSettings,
  BranchTaxSettings,
} from './branch-config.types';

export const BRANCH_STATUSES = [
  'setup_pending',
  'active',
  'inactive',
  'suspended',
] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export const BRANCH_INVENTORY_STORE_TYPES = ['branch', 'central'] as const;
export type BranchInventoryStoreType = (typeof BRANCH_INVENTORY_STORE_TYPES)[number];

export const BRANCH_OVERRIDEABLE_SETTINGS = [
  'currency_code',
  'date_format',
  'time_format',
  'language',
  'theme_id',
] as const;
export const BRANCH_LOCKED_SETTINGS = ['timezone', 'fiscal_year_start'] as const;
export const BRANCH_CLIENT_DEFAULT_SETTINGS = [
  'currency_code',
  'date_format',
  'time_format',
  'language',
  'theme_id',
  'timezone',
  'fiscal_year_start',
] as const;
export const BRANCH_EFFECTIVE_SETTING_RESOLUTION = [
  'branch_override',
  'client_settings',
  'client_profile',
  'system_fallback',
] as const;

export type BranchSettingKey = (typeof BRANCH_CLIENT_DEFAULT_SETTINGS)[number];
export type BranchSettingResolutionSource =
  (typeof BRANCH_EFFECTIVE_SETTING_RESOLUTION)[number];

export interface BranchEffectiveSettings {
  currency_code: string;
  date_format: string;
  time_format: string;
  language: string;
  theme_id: string | null;
  timezone: string;
  fiscal_year_start: number;
  resolution_order: BranchSettingResolutionSource[];
}

export interface BranchEffectiveSettingMeta {
  source: BranchSettingResolutionSource;
  inherited: boolean;
  override_allowed: boolean;
  locked: boolean;
}

export interface BranchEffectiveSettingsSources {
  currency_code: BranchEffectiveSettingMeta;
  date_format: BranchEffectiveSettingMeta;
  time_format: BranchEffectiveSettingMeta;
  language: BranchEffectiveSettingMeta;
  theme_id: BranchEffectiveSettingMeta;
  timezone: BranchEffectiveSettingMeta;
  fiscal_year_start: BranchEffectiveSettingMeta;
}

export interface BranchReadiness {
  is_operationally_ready: boolean;
  setup_completion_percent: number;
  blockers: string[];
}

export interface BranchOperationalProfile {
  branch_code: string;
  branch_kind: 'operational_branch' | 'central_store';
  inventory_store_type: BranchInventoryStoreType;
  is_production_source: boolean;
  production_source_label: string | null;
  opening_time: string | null;
  closing_time: string | null;
  operational_state: BranchStatus;
  writes_allowed: boolean;
}

export interface BranchConfigBoundary {
  client_defaults: string[];
  inherited: string[];
  overridable: string[];
  locked: string[];
  resolution_order: BranchSettingResolutionSource[];
}

export interface BranchOversight {
  visibility_scope: 'client';
  visible_to_client_admin: boolean;
  branch_scope_enforced: boolean;
}

export interface BranchControlView extends Branch {
  effective_settings: BranchEffectiveSettings;
  effective_settings_sources: BranchEffectiveSettingsSources;
  operating_hours: BranchOperatingHours;
  document_settings: BranchDocumentSettings;
  tax_settings: BranchTaxSettings;
  operational_settings: BranchOperationalSettings;
  inventory_control_settings: BranchInventoryControlSettings;
  config_boundary: BranchConfigBoundary;
  readiness: BranchReadiness;
  operational_profile: BranchOperationalProfile;
  oversight: BranchOversight;
}

type BranchStatusCarrier = Pick<Branch, 'branch_name' | 'status'>;

export function normalizeBranchStatus(status?: string | null): BranchStatus {
  if (status && BRANCH_STATUSES.includes(status as BranchStatus)) {
    return status as BranchStatus;
  }

  return 'inactive';
}

export function getBranchStatusLabel(status?: string | null): string {
  return normalizeBranchStatus(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function canBranchProcessOperationalWrites(status?: string | null): boolean {
  return normalizeBranchStatus(status) === 'active';
}

export function assertBranchOperationalWriteAllowed(
  branch: BranchStatusCarrier,
  operation: string,
): void {
  if (canBranchProcessOperationalWrites(branch.status)) {
    return;
  }

  throw new BadRequestException(
    `Branch ${branch.branch_name} is ${getBranchStatusLabel(branch.status)} and cannot ${operation}.`,
  );
}
