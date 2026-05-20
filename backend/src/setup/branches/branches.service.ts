import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { BranchCharge } from '../entities/branch-charge.entity';
import { BranchLocation } from '../entities/branch-location.entity';
import { buildClientLookupWhere } from '../../platform/client-lookup.util';
import { Client } from '../../platform/entities/client.entity';
import { ClientSettings } from '../../platform/entities/client-settings.entity';
import { OperationalAuditService } from '../../platform/audit/operational-audit.service';
import { EntitlementsService } from '../../platform/entitlements/entitlements.service';
import { TaxConfiguration } from '../entities/tax-configuration.entity';
import {
  CreateBranchChargeDto,
  CreateBranchDto,
  BranchInventoryControlSettingsDto,
  UpdateBranchChargeDto,
  UpdateBranchDto,
} from './dto/branch.dto';
import {
  BRANCH_DOCUMENT_TYPES,
  BRANCH_KDS_ALERT_SOUNDS,
  BRANCH_OPERATING_DAYS,
  BRANCH_ORDER_TYPES,
  createDefaultBranchDocumentSettings,
  createDefaultBranchInventoryControlSettings,
  createDefaultBranchOperatingHours,
  createDefaultBranchOperationalSettings,
  createDefaultBranchTaxSettings,
  type BranchDocumentSettings,
  type BranchInventoryControlSettings,
  type BranchOperatingDayKey,
  type BranchOperatingHours,
  type BranchOperationalSettings,
  type BranchTaxSettings,
  normalizeDocumentResetFrequency,
} from './branch-config.types';
import {
  BRANCH_CLIENT_DEFAULT_SETTINGS,
  BRANCH_EFFECTIVE_SETTING_RESOLUTION,
  type BranchControlView,
  type BranchEffectiveSettings,
  type BranchEffectiveSettingsSources,
  type BranchOperationalProfile,
  type BranchReadiness,
  type BranchStatus,
  canBranchProcessOperationalWrites,
} from './branch-control.types';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const BRANCH_DATE_FORMATS = ['MMM DD, YYYY', 'DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
const BRANCH_TIME_FORMATS = ['hh:mma', 'hh:mm a', 'HH:mm', 'HH:mm:ss'] as const;

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(BranchCharge)
    private branchChargeRepo: Repository<BranchCharge>,
    @InjectRepository(BranchLocation)
    private branchLocationRepo: Repository<BranchLocation>,
    @InjectRepository(ClientSettings)
    private clientSettingsRepo: Repository<ClientSettings>,
    @InjectRepository(TaxConfiguration)
    private taxConfigRepo: Repository<TaxConfiguration>,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly entitlementsService: EntitlementsService,
  ) { }

  private async getClientOrFail(clientId: string): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  private normalizeBranchCode(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }

    return input
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
  }

  private async generateBranchCode(clientId: string): Promise<string> {
    const lastBranch = await this.branchRepo.findOne({
      where: { client_id: clientId },
      order: { id: 'DESC' },
    });

    let nextNumber = 1;
    if (lastBranch?.branch_code?.startsWith('BR')) {
      const match = lastBranch.branch_code.match(/BR(\d+)/);
      if (match) {
        nextNumber = Number.parseInt(match[1], 10) + 1;
      }
    }

    return `BR${nextNumber.toString().padStart(3, '0')}`;
  }

  private async ensureUniqueIdentity(
    clientId: string,
    input: { branch_code?: string; branch_name?: string },
    excludeId?: number,
  ): Promise<void> {
    const normalizedCode = this.normalizeBranchCode(input.branch_code);
    if (normalizedCode) {
      const existingCode = await this.branchRepo.findOne({
        where: { client_id: clientId, branch_code: normalizedCode },
      });
      if (existingCode && existingCode.id !== excludeId) {
        throw new BadRequestException(`Branch code ${normalizedCode} is already in use for this client.`);
      }
    }

    if (input.branch_name?.trim()) {
      const existingName = await this.branchRepo.findOne({
        where: { client_id: clientId, branch_name: input.branch_name.trim() },
      });
      if (existingName && existingName.id !== excludeId) {
        throw new BadRequestException(`Branch name ${input.branch_name.trim()} is already in use for this client.`);
      }
    }
  }

  private normalizeProductionSourceLabel(
    enabled: boolean,
    label: string | undefined,
    branchName: string,
    inventoryStoreType: 'branch' | 'central',
  ): string | null {
    if (!enabled) {
      return null;
    }

    const trimmed = label?.trim();
    if (trimmed) {
      return trimmed;
    }

    const fallbackBranchName = branchName?.trim() || 'Production';
    return inventoryStoreType === 'central'
      ? `${fallbackBranchName} Central Kitchen`
      : `${fallbackBranchName} Production Kitchen`;
  }

  private normalizeModuleList(modules?: string[] | null): string[] {
    return [...new Set(
      (modules ?? [])
        .map((module) => String(module || '').trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  private ensureTime(value: string | null | undefined, label: string): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (!TIME_PATTERN.test(value)) {
      throw new BadRequestException(`${label} must be in HH:MM or HH:MM:SS format.`);
    }

    return value.length === 5 ? `${value}:00` : value;
  }

  private compareTimes(left: string, right: string): number {
    return left.localeCompare(right);
  }

  private normalizeOperatingHours(
    operatingHours?: Partial<Record<BranchOperatingDayKey, {
      is_open?: boolean;
      open_time?: string | null;
      close_time?: string | null;
    }>> | null,
    fallbackOpeningTime?: string | null,
    fallbackClosingTime?: string | null,
  ): BranchOperatingHours {
    const defaultOpen = this.ensureTime(fallbackOpeningTime, 'opening_time');
    const defaultClose = this.ensureTime(fallbackClosingTime, 'closing_time');
    const base = operatingHours
      ? BRANCH_OPERATING_DAYS.reduce((acc, day) => {
        const config = operatingHours[day];
        acc[day] = {
          is_open: Boolean(config?.is_open),
          open_time: config?.open_time ?? null,
          close_time: config?.close_time ?? null,
        };
        return acc;
      }, {} as BranchOperatingHours)
      : createDefaultBranchOperatingHours(defaultOpen, defaultClose);

    return BRANCH_OPERATING_DAYS.reduce((acc, day) => {
      const config = base[day];
      const isOpen = Boolean(config?.is_open);
      const openTime = this.ensureTime(config?.open_time ?? null, `${day} open_time`);
      const closeTime = this.ensureTime(config?.close_time ?? null, `${day} close_time`);

      if (isOpen && (!openTime || !closeTime)) {
        throw new BadRequestException(`Operating hours for ${day} must include both open and close times.`);
      }
      if (!isOpen && (openTime || closeTime)) {
        acc[day] = {
          is_open: false,
          open_time: null,
          close_time: null,
        };
        return acc;
      }
      if (isOpen && this.compareTimes(openTime!, closeTime!) >= 0) {
        throw new BadRequestException(`Operating hours for ${day} must close after opening time.`);
      }

      acc[day] = {
        is_open: isOpen,
        open_time: isOpen ? openTime : null,
        close_time: isOpen ? closeTime : null,
      };
      return acc;
    }, {} as BranchOperatingHours);
  }

  private summarizeOperatingHours(operatingHours: BranchOperatingHours): {
    opening_time: string | null;
    closing_time: string | null;
  } {
    const openWindows = BRANCH_OPERATING_DAYS
      .map((day) => operatingHours[day])
      .filter((config) => config?.is_open && config.open_time && config.close_time);

    if (openWindows.length === 0) {
      return { opening_time: null, closing_time: null };
    }

    const openingTime = openWindows.reduce((earliest, config) => (
      !earliest || this.compareTimes(config.open_time!, earliest) < 0 ? config.open_time : earliest
    ), null as string | null);

    const closingTime = openWindows.reduce((latest, config) => (
      !latest || this.compareTimes(config.close_time!, latest) > 0 ? config.close_time : latest
    ), null as string | null);

    return {
      opening_time: openingTime,
      closing_time: closingTime,
    };
  }

  private normalizeDocumentPrefix(prefix: string, type: string): string {
    const normalized = String(prefix || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException(`Document prefix is required for ${type}.`);
    }

    return normalized;
  }

  private normalizeDocumentSettings(
    input?: Partial<BranchDocumentSettings> | null,
  ): BranchDocumentSettings {
    const defaults = createDefaultBranchDocumentSettings();
    const source = input ?? defaults;

    return BRANCH_DOCUMENT_TYPES.reduce((acc, type) => {
      const rule = source[type] ?? defaults[type];
      const zeroPad = Number(rule?.zero_pad ?? defaults[type].zero_pad);
      if (!Number.isInteger(zeroPad) || zeroPad < 2 || zeroPad > 8) {
        throw new BadRequestException(`Document zero_pad for ${type} must be between 2 and 8.`);
      }

      acc[type] = {
        prefix: this.normalizeDocumentPrefix(rule?.prefix ?? defaults[type].prefix, type),
        zero_pad: zeroPad,
        reset_frequency: normalizeDocumentResetFrequency(rule?.reset_frequency ?? defaults[type].reset_frequency),
        include_branch_code: rule?.include_branch_code ?? defaults[type].include_branch_code,
        include_counter_code: rule?.include_counter_code ?? defaults[type].include_counter_code,
        date_segment_format: rule?.date_segment_format ?? defaults[type].date_segment_format,
        manual_reset_at: rule?.manual_reset_at ?? defaults[type].manual_reset_at ?? null,
      };
      return acc;
    }, {} as BranchDocumentSettings);
  }

  private normalizeTaxCodeValue(value?: string | null): string | null {
    const trimmed = value?.trim().toUpperCase();
    return trimmed ? trimmed : null;
  }

  private normalizeTaxSettings(
    input?: Partial<BranchTaxSettings> | null,
    legacyTaxRegion?: string | null,
  ): BranchTaxSettings {
    const defaults = createDefaultBranchTaxSettings(legacyTaxRegion);
    const source = input ?? defaults;

    return {
      default_tax_code: this.normalizeTaxCodeValue(source.default_tax_code ?? defaults.default_tax_code),
      dine_in_tax_code: this.normalizeTaxCodeValue(source.dine_in_tax_code),
      takeaway_tax_code: this.normalizeTaxCodeValue(source.takeaway_tax_code),
      delivery_tax_code: this.normalizeTaxCodeValue(source.delivery_tax_code),
      prices_include_tax: source.prices_include_tax ?? defaults.prices_include_tax,
      allow_tax_exemption: source.allow_tax_exemption ?? defaults.allow_tax_exemption,
      tax_rounding_method: source.tax_rounding_method ?? defaults.tax_rounding_method,
    };
  }

  private normalizeOperationalSettings(
    input?: Partial<BranchOperationalSettings> | null,
  ): BranchOperationalSettings {
    const defaults = createDefaultBranchOperationalSettings();
    const source = input ?? defaults;
    const cutoff = this.ensureTime(
      source.business_day_cutoff_time ?? defaults.business_day_cutoff_time,
      'business_day_cutoff_time',
    );
    const defaultOrderType = source.default_order_type ?? defaults.default_order_type;

    if (!BRANCH_ORDER_TYPES.includes(defaultOrderType)) {
      throw new BadRequestException('default_order_type is invalid.');
    }
    if (defaultOrderType === 'dine_in' && source.floor_service_enabled === false) {
      throw new BadRequestException('default_order_type cannot be dine_in while floor service is disabled.');
    }
    if (defaultOrderType === 'takeout' && source.pickup_enabled === false) {
      throw new BadRequestException('default_order_type cannot be takeout while pickup is disabled.');
    }
    if (defaultOrderType === 'delivery' && source.delivery_enabled === false) {
      throw new BadRequestException('default_order_type cannot be delivery while delivery is disabled.');
    }
    if (
      source.kds_new_order_alert_sound
      && !BRANCH_KDS_ALERT_SOUNDS.includes(source.kds_new_order_alert_sound)
    ) {
      throw new BadRequestException('kds_new_order_alert_sound is invalid.');
    }
    if (
      source.kds_order_change_alert_sound
      && !BRANCH_KDS_ALERT_SOUNDS.includes(source.kds_order_change_alert_sound)
    ) {
      throw new BadRequestException('kds_order_change_alert_sound is invalid.');
    }
    if (
      source.kds_alert_volume_level !== undefined
      && (!Number.isFinite(Number(source.kds_alert_volume_level)) || Number(source.kds_alert_volume_level) < 0 || Number(source.kds_alert_volume_level) > 100)
    ) {
      throw new BadRequestException('kds_alert_volume_level must be between 0 and 100.');
    }

    return {
      default_order_type: defaultOrderType,
      require_open_shift: source.require_open_shift ?? defaults.require_open_shift,
      require_sale_counter: source.require_sale_counter ?? defaults.require_sale_counter,
      floor_service_enabled: source.floor_service_enabled ?? defaults.floor_service_enabled,
      pickup_enabled: source.pickup_enabled ?? defaults.pickup_enabled,
      delivery_enabled: source.delivery_enabled ?? defaults.delivery_enabled,
      auto_assign_tables: source.auto_assign_tables ?? defaults.auto_assign_tables,
      business_day_cutoff_time: cutoff ?? defaults.business_day_cutoff_time,
      line_item_cancel_reduce_limit_minutes: Number.isFinite(Number(source.line_item_cancel_reduce_limit_minutes))
        ? Math.max(Number(source.line_item_cancel_reduce_limit_minutes), 0)
        : defaults.line_item_cancel_reduce_limit_minutes,
      item_edit_lock_minutes: Number.isFinite(Number(source.item_edit_lock_minutes))
        ? Math.max(Number(source.item_edit_lock_minutes), 0)
        : defaults.item_edit_lock_minutes,
      item_cancellation_window_minutes: Number.isFinite(Number(source.item_cancellation_window_minutes))
        ? Math.max(Number(source.item_cancellation_window_minutes), 0)
        : defaults.item_cancellation_window_minutes,
      order_cancellation_window_minutes: Number.isFinite(Number(source.order_cancellation_window_minutes))
        ? Math.max(Number(source.order_cancellation_window_minutes), 0)
        : defaults.order_cancellation_window_minutes,
      kds_new_order_alert_sound: source.kds_new_order_alert_sound ?? defaults.kds_new_order_alert_sound,
      kds_order_change_alert_sound: source.kds_order_change_alert_sound ?? defaults.kds_order_change_alert_sound,
      kds_alert_volume_level: Number.isFinite(Number(source.kds_alert_volume_level))
        ? Math.min(Math.max(Number(source.kds_alert_volume_level), 0), 100)
        : defaults.kds_alert_volume_level,
    };
  }

  private normalizeInventoryControlSettings(
    input?: Partial<BranchInventoryControlSettings> | null,
  ): BranchInventoryControlSettings {
    const defaults = createDefaultBranchInventoryControlSettings();
    const source = input ?? defaults;

    return {
      blind_random_enabled: source.blind_random_enabled ?? defaults.blind_random_enabled,
      blind_random_frequency: source.blind_random_frequency ?? defaults.blind_random_frequency,
      blind_random_sample_size: Number.isFinite(Number(source.blind_random_sample_size))
        ? Math.max(Number(source.blind_random_sample_size), 1)
        : defaults.blind_random_sample_size,
      end_of_day_blind_enabled: source.end_of_day_blind_enabled ?? defaults.end_of_day_blind_enabled,
      end_of_day_sample_size: Number.isFinite(Number(source.end_of_day_sample_size))
        ? Math.max(Number(source.end_of_day_sample_size), 1)
        : defaults.end_of_day_sample_size,
      monthly_blind_full_enabled: source.monthly_blind_full_enabled ?? defaults.monthly_blind_full_enabled,
      discrepancy_percent_warn_threshold: Number.isFinite(Number(source.discrepancy_percent_warn_threshold))
        ? Math.max(Number(source.discrepancy_percent_warn_threshold), 0)
        : defaults.discrepancy_percent_warn_threshold,
      discrepancy_percent_critical_threshold: Number.isFinite(Number(source.discrepancy_percent_critical_threshold))
        ? Math.max(Number(source.discrepancy_percent_critical_threshold), 0)
        : defaults.discrepancy_percent_critical_threshold,
      discrepancy_value_warn_threshold: Number.isFinite(Number(source.discrepancy_value_warn_threshold))
        ? Math.max(Number(source.discrepancy_value_warn_threshold), 0)
        : defaults.discrepancy_value_warn_threshold,
      discrepancy_value_critical_threshold: Number.isFinite(Number(source.discrepancy_value_critical_threshold))
        ? Math.max(Number(source.discrepancy_value_critical_threshold), 0)
        : defaults.discrepancy_value_critical_threshold,
      escalation_variance_line_threshold: Number.isFinite(Number(source.escalation_variance_line_threshold))
        ? Math.max(Number(source.escalation_variance_line_threshold), 1)
        : defaults.escalation_variance_line_threshold,
      escalation_variance_value_threshold: Number.isFinite(Number(source.escalation_variance_value_threshold))
        ? Math.max(Number(source.escalation_variance_value_threshold), 0)
        : defaults.escalation_variance_value_threshold,
      close_block_on_critical_variance: source.close_block_on_critical_variance ?? defaults.close_block_on_critical_variance,
    };
  }

  private async assertTaxSettingsBelongToClient(
    clientId: string,
    taxSettings: BranchTaxSettings,
  ): Promise<void> {
    const codes = [
      taxSettings.default_tax_code,
      taxSettings.dine_in_tax_code,
      taxSettings.takeaway_tax_code,
      taxSettings.delivery_tax_code,
    ].filter((code): code is string => Boolean(code));

    for (const code of [...new Set(codes)]) {
      await this.assertTaxRegionBelongsToClient(clientId, code);
    }
  }

  private prepareBranchConfiguration(
    source: {
      operating_hours?: Partial<Record<BranchOperatingDayKey, {
        is_open?: boolean;
        open_time?: string | null;
        close_time?: string | null;
      }>> | null;
      document_settings?: Partial<BranchDocumentSettings> | null;
      tax_settings?: Partial<BranchTaxSettings> | null;
      operational_settings?: Partial<BranchOperationalSettings> | null;
      inventory_control_settings?: Partial<BranchInventoryControlSettings> | null;
      opening_time?: string | null;
      closing_time?: string | null;
      tax_region?: string | null;
    },
  ) {
    const operatingHours = this.normalizeOperatingHours(
      source.operating_hours,
      source.opening_time,
      source.closing_time,
    );
    const timeSummary = this.summarizeOperatingHours(operatingHours);
    const taxSettings = this.normalizeTaxSettings(source.tax_settings, source.tax_region);

    return {
      operating_hours: operatingHours,
      document_settings: this.normalizeDocumentSettings(source.document_settings),
      tax_settings: taxSettings,
      operational_settings: this.normalizeOperationalSettings(source.operational_settings),
      inventory_control_settings: this.normalizeInventoryControlSettings(source.inventory_control_settings),
      opening_time: timeSummary.opening_time,
      closing_time: timeSummary.closing_time,
      tax_region: this.normalizeTaxCodeValue(source.tax_region) ?? taxSettings.default_tax_code,
    };
  }

  private validateSettingsGovernance(branch: Pick<
    Branch,
    | 'inherit_client_currency'
    | 'currency_code'
    | 'inherit_client_language'
    | 'language'
    | 'inherit_client_theme'
    | 'theme_id'
  >): void {
    if (!branch.currency_code?.trim()) {
      throw new BadRequestException(
        'currency_code is required for branch operations.',
      );
    }
    if (!branch.inherit_client_language && !branch.language?.trim()) {
      throw new BadRequestException(
        'language is required when branch language inheritance is disabled.',
      );
    }
    if (!branch.inherit_client_theme && !branch.theme_id?.trim()) {
      throw new BadRequestException(
        'theme_id is required when branch theme inheritance is disabled.',
      );
    }
  }

  private normalizeBranchDateFormat(value?: string | null): string {
    const normalized = String(value || 'MMM DD, YYYY').trim();
    if (!BRANCH_DATE_FORMATS.includes(normalized as typeof BRANCH_DATE_FORMATS[number])) {
      throw new BadRequestException(`date_format must be one of: ${BRANCH_DATE_FORMATS.join(', ')}`);
    }
    return normalized;
  }

  private normalizeBranchTimeFormat(value?: string | null): string {
    const normalized = String(value || 'hh:mma').trim();
    if (!BRANCH_TIME_FORMATS.includes(normalized as typeof BRANCH_TIME_FORMATS[number])) {
      throw new BadRequestException(`time_format must be one of: ${BRANCH_TIME_FORMATS.join(', ')}`);
    }
    return normalized;
  }

  private async assertTaxRegionBelongsToClient(clientId: string, taxRegion?: string): Promise<void> {
    const normalized = taxRegion?.trim();
    if (!normalized) {
      return;
    }

    const tax = await this.taxConfigRepo.findOne({
      where: { client_id: clientId, tax_code: normalized, is_active: true },
    });

    if (!tax) {
      throw new BadRequestException(`Tax region ${normalized} does not belong to this client.`);
    }
  }

  private async resolveEffectiveSettings(
    branch: Branch,
  ): Promise<{ effectiveSettings: BranchEffectiveSettings; effectiveSettingSources: BranchEffectiveSettingsSources }> {
    const [clientSettings, client] = await Promise.all([
      this.clientSettingsRepo.findOne({
        where: { client_id: branch.client_id },
      }),
      this.clientRepo.findOne({
        where: { client_code: branch.client_id },
      }),
    ]);

    const resolveOverrideableSetting = <T>(
      inherited: boolean,
      branchValue: T | null | undefined,
      clientSettingsValue: T | null | undefined,
      clientValue: T | null | undefined,
      systemFallback: T,
    ): { value: T; source: BranchEffectiveSettingsSources[keyof BranchEffectiveSettingsSources] } => {
      if (!inherited && branchValue !== undefined && branchValue !== null && branchValue !== '') {
        return {
          value: branchValue as T,
          source: {
            source: 'branch_override',
            inherited: false,
            override_allowed: true,
            locked: false,
          },
        };
      }

      if (clientSettingsValue !== undefined && clientSettingsValue !== null && clientSettingsValue !== '') {
        return {
          value: clientSettingsValue as T,
          source: {
            source: 'client_settings',
            inherited: true,
            override_allowed: true,
            locked: false,
          },
        };
      }

      if (clientValue !== undefined && clientValue !== null && clientValue !== '') {
        return {
          value: clientValue as T,
          source: {
            source: 'client_profile',
            inherited: true,
            override_allowed: true,
            locked: false,
          },
        };
      }

      return {
        value: systemFallback,
        source: {
          source: 'system_fallback',
          inherited: true,
          override_allowed: true,
          locked: false,
        },
      };
    };

    const resolveLockedSetting = <T>(
      clientSettingsValue: T | null | undefined,
      clientValue: T | null | undefined,
      systemFallback: T,
    ): { value: T; source: BranchEffectiveSettingsSources[keyof BranchEffectiveSettingsSources] } => {
      if (clientSettingsValue !== undefined && clientSettingsValue !== null && clientSettingsValue !== '') {
        return {
          value: clientSettingsValue as T,
          source: {
            source: 'client_settings',
            inherited: true,
            override_allowed: false,
            locked: true,
          },
        };
      }

      if (clientValue !== undefined && clientValue !== null && clientValue !== '') {
        return {
          value: clientValue as T,
          source: {
            source: 'client_profile',
            inherited: true,
            override_allowed: false,
            locked: true,
          },
        };
      }

      return {
        value: systemFallback,
        source: {
          source: 'system_fallback',
          inherited: true,
          override_allowed: false,
          locked: true,
        },
      };
    };

    const currency = resolveOverrideableSetting(
      false,
      branch.currency_code,
      undefined,
      undefined,
      'USD',
    );
    const dateFormat = resolveOverrideableSetting(
      false,
      branch.date_format,
      undefined,
      undefined,
      'MMM DD, YYYY',
    );
    const timeFormat = resolveOverrideableSetting(
      false,
      branch.time_format,
      undefined,
      undefined,
      'hh:mma',
    );
    const language = resolveOverrideableSetting(
      branch.inherit_client_language,
      branch.language,
      undefined,
      client?.language,
      'en',
    );
    const theme = resolveOverrideableSetting<string | null>(
      branch.inherit_client_theme,
      branch.theme_id,
      undefined,
      client?.theme_id ? String(client.theme_id) : null,
      null,
    );
    const timezone = resolveLockedSetting(
      clientSettings?.timezone,
      client?.timezone,
      'UTC',
    );
    const fiscalYearStart = resolveLockedSetting(
      clientSettings?.fiscal_year_start,
      undefined,
      1,
    );

    return {
      effectiveSettings: {
        currency_code: currency.value,
        date_format: dateFormat.value,
        time_format: timeFormat.value,
        language: language.value,
        theme_id: theme.value,
        timezone: timezone.value,
        fiscal_year_start: fiscalYearStart.value,
        resolution_order: [...BRANCH_EFFECTIVE_SETTING_RESOLUTION],
      },
      effectiveSettingSources: {
        currency_code: currency.source,
        date_format: dateFormat.source,
        time_format: timeFormat.source,
        language: language.source,
        theme_id: theme.source,
        timezone: timezone.source,
        fiscal_year_start: fiscalYearStart.source,
      },
    };
  }

  private evaluateReadiness(branch: Branch, effectiveSettings: BranchEffectiveSettings): BranchReadiness {
    const blockers: string[] = [];
    const operatingHours = this.normalizeOperatingHours(
      branch.operating_hours,
      branch.opening_time,
      branch.closing_time,
    );
    const openDays = BRANCH_OPERATING_DAYS.filter((day) => operatingHours[day].is_open);
    const checks = [
      { ok: Boolean(branch.branch_name?.trim()), blocker: 'Branch name is required.' },
      { ok: Boolean(branch.branch_code?.trim()), blocker: 'Branch code is required.' },
      { ok: Boolean(branch.address?.trim()), blocker: 'Address is required before go-live.' },
      { ok: Boolean(branch.city?.trim()), blocker: 'City is required before go-live.' },
      { ok: Boolean(branch.country?.trim()), blocker: 'Country is required before go-live.' },
      { ok: openDays.length > 0, blocker: 'At least one operating day must be configured.' },
      { ok: Boolean(effectiveSettings.currency_code), blocker: 'An effective currency is required.' },
      { ok: Boolean(effectiveSettings.language), blocker: 'An effective language is required.' },
      {
        ok: Boolean(branch.tax_settings?.default_tax_code || branch.tax_region?.trim()),
        blocker: 'A default branch tax code should be configured.',
      },
      {
        ok: Boolean(branch.currency_code?.trim()),
        blocker: 'Branch currency is required.',
      },
      {
        ok: branch.inherit_client_language || Boolean(branch.language?.trim()),
        blocker: 'Language override is missing while language inheritance is disabled.',
      },
      {
        ok: branch.inherit_client_theme || Boolean(branch.theme_id?.trim()),
        blocker: 'Theme override is missing while theme inheritance is disabled.',
      },
    ];

    for (const check of checks) {
      if (!check.ok) {
        blockers.push(check.blocker);
      }
    }

    const completion = Math.round(((checks.length - blockers.length) / checks.length) * 100);

    return {
      is_operationally_ready: blockers.length === 0,
      setup_completion_percent: Math.max(0, completion),
      blockers,
    };
  }

  private buildOperationalProfile(branch: Branch): BranchOperationalProfile {
    const operatingHours = this.normalizeOperatingHours(
      branch.operating_hours,
      branch.opening_time,
      branch.closing_time,
    );
    const summary = this.summarizeOperatingHours(operatingHours);

    return {
      branch_code: branch.branch_code,
      branch_kind: branch.inventory_store_type === 'central' ? 'central_store' : 'operational_branch',
      inventory_store_type: branch.inventory_store_type,
      is_production_source: branch.is_production_source,
      production_source_label: branch.production_source_label ?? null,
      opening_time: summary.opening_time,
      closing_time: summary.closing_time,
      operational_state: branch.status as BranchStatus,
      writes_allowed: canBranchProcessOperationalWrites(branch.status),
    };
  }

  private async toControlView(branch: Branch): Promise<BranchControlView> {
    const { effectiveSettings, effectiveSettingSources } = await this.resolveEffectiveSettings(branch);
    const config = this.prepareBranchConfiguration(branch);
    const readiness = this.evaluateReadiness(branch, effectiveSettings);
    const clientSettings = await this.clientSettingsRepo.findOne({
      where: { client_id: branch.client_id },
    });

    return Object.assign(branch, {
      effective_settings: effectiveSettings,
      effective_settings_sources: effectiveSettingSources,
      operating_hours: config.operating_hours,
      document_settings: config.document_settings,
      tax_settings: config.tax_settings,
      operational_settings: config.operational_settings,
      inventory_control_settings: config.inventory_control_settings,
      config_boundary: {
        client_defaults: [...BRANCH_CLIENT_DEFAULT_SETTINGS],
        inherited: ['language', 'theme_id', 'timezone', 'fiscal_year_start'],
        overridable: [
          'branch_name',
          'short_name',
          'inventory_store_type',
          'is_production_source',
          'production_source_label',
          'address',
          'city',
          'state',
          'country',
          'currency_code',
          'date_format',
          'time_format',
          'contact_person',
          'phone',
          'email',
          'tax_region',
          'opening_time',
          'closing_time',
          'operating_hours',
          'document_settings',
          'tax_settings',
          'operational_settings',
          'inventory_control_settings',
          'modules_enabled',
          'status',
        ],
        locked: ['timezone', 'fiscal_year_start'],
        resolution_order: [...BRANCH_EFFECTIVE_SETTING_RESOLUTION],
      },
      readiness,
      operational_profile: this.buildOperationalProfile(branch),
      client_branding: {
        full_logo_url: clientSettings?.logo_url || null,
        short_logo_url: clientSettings?.short_logo_url || null,
        numbering_settings: clientSettings?.numbering_settings ?? null,
        receipt_business_name: clientSettings?.receipt_business_name || null,
        receipt_footer_message_1: clientSettings?.receipt_footer_message_1 || null,
        receipt_footer_message_2: clientSettings?.receipt_footer_message_2 || null,
        show_receipt_full_logo: clientSettings?.show_receipt_full_logo ?? true,
        show_receipt_short_logo: clientSettings?.show_receipt_short_logo ?? false,
        show_receipt_business_name: clientSettings?.show_receipt_business_name ?? true,
        show_receipt_branch_name: clientSettings?.show_receipt_branch_name ?? true,
        show_receipt_branch_address: clientSettings?.show_receipt_branch_address ?? true,
        show_receipt_contact_number: clientSettings?.show_receipt_contact_number ?? true,
        show_receipt_footer_message_1: clientSettings?.show_receipt_footer_message_1 ?? true,
        show_receipt_footer_message_2: clientSettings?.show_receipt_footer_message_2 ?? false,
        show_kot_full_logo: clientSettings?.show_kot_full_logo ?? false,
        show_kot_short_logo: clientSettings?.show_kot_short_logo ?? false,
        show_kot_business_name: clientSettings?.show_kot_business_name ?? true,
        show_kot_branch_name: clientSettings?.show_kot_branch_name ?? true,
        show_kot_branch_address: clientSettings?.show_kot_branch_address ?? false,
        show_kot_contact_number: clientSettings?.show_kot_contact_number ?? false,
        show_kot_footer_message_1: clientSettings?.show_kot_footer_message_1 ?? false,
        show_kot_footer_message_2: clientSettings?.show_kot_footer_message_2 ?? false,
        receipt_paper_size: clientSettings?.receipt_paper_size ?? 'thermal-80mm',
        invoice_paper_size: clientSettings?.invoice_paper_size ?? 'a4',
        kot_paper_size: clientSettings?.kot_paper_size ?? 'thermal-80mm',
        report_paper_size: clientSettings?.report_paper_size ?? 'a4',
        receipt_print_copies: clientSettings?.receipt_print_copies ?? 1,
        invoice_print_copies: clientSettings?.invoice_print_copies ?? 1,
        kot_print_copies: clientSettings?.kot_print_copies ?? 1,
        kot_print_enabled: clientSettings?.kot_print_enabled ?? true,
        report_print_copies: clientSettings?.report_print_copies ?? 1,
        order_change_print_mode: clientSettings?.order_change_print_mode ?? 'change_only',
        order_change_print_copies: clientSettings?.order_change_print_copies ?? 1,
        enable_station_wise_kot_printing: clientSettings?.enable_station_wise_kot_printing ?? false,
        allow_multiple_kot_per_station: clientSettings?.allow_multiple_kot_per_station ?? false,
        service_station_print_copies: clientSettings?.service_station_print_copies ?? {},
        station_printer_mapping: clientSettings?.station_printer_mapping ?? {},
        separate_kot_stations: clientSettings?.separate_kot_stations ?? [],
      },
      oversight: {
        visibility_scope: 'client' as const,
        visible_to_client_admin: true,
        branch_scope_enforced: true,
      },
    }) as BranchControlView;
  }

  private async assertCanUseActiveStatus(branch: Branch): Promise<void> {
    const controlView = await this.toControlView(branch);
    if (!controlView.readiness.is_operationally_ready) {
      throw new BadRequestException(
        `Branch is not ready for active use: ${controlView.readiness.blockers.join(' ')}`,
      );
    }
  }

  async create(clientId: string, dto: CreateBranchDto, userId: string | number, user?: JwtPayload): Promise<BranchControlView> {
    await this.getClientOrFail(clientId);
    await this.entitlementsService.assertCanCreateBranch(clientId);
    await this.assertTaxRegionBelongsToClient(clientId, dto.tax_region);

    const branchCode = this.normalizeBranchCode(dto.branch_code) || await this.generateBranchCode(clientId);
    const inventoryStoreType = dto.inventory_store_type || 'branch';
    const isProductionSource = dto.is_production_source ?? false;
    const config = this.prepareBranchConfiguration(dto);
    await this.assertTaxSettingsBelongToClient(clientId, config.tax_settings);
    await this.ensureUniqueIdentity(clientId, {
      branch_code: branchCode,
      branch_name: dto.branch_name,
    });

    const branchData = {
      client_id: clientId,
      ...dto,
      currency_code: (dto.currency_code || 'USD').trim().toUpperCase(),
      date_format: this.normalizeBranchDateFormat(dto.date_format),
      time_format: this.normalizeBranchTimeFormat(dto.time_format),
      inherit_client_currency: false,
      branch_code: branchCode,
      inventory_store_type: inventoryStoreType,
      is_production_source: isProductionSource,
      production_source_label: this.normalizeProductionSourceLabel(
        isProductionSource,
        dto.production_source_label,
        dto.branch_name,
        inventoryStoreType,
      ),
      modules_enabled: this.normalizeModuleList(dto.modules_enabled),
      opening_time: config.opening_time,
      closing_time: config.closing_time,
      operating_hours: config.operating_hours,
      document_settings: config.document_settings,
      tax_settings: config.tax_settings,
      operational_settings: config.operational_settings,
      inventory_control_settings: config.inventory_control_settings,
      tax_region: config.tax_region,
      created_by: userId.toString(),
      updated_by: userId.toString(),
      status: dto.status || 'setup_pending',
      is_active: (dto.status || 'setup_pending') === 'active',
    };
    const branch = this.branchRepo.create(branchData as object);
    this.validateSettingsGovernance(branch);
    if (branch.status === 'active') {
      await this.assertCanUseActiveStatus(branch);
    }

    const saved = await this.branchRepo.save(branch);
    await this.operationalAuditService.log({
      user,
      action: 'Branch Created',
      entity: 'branches',
      clientId,
      branchId: saved.id,
      entityId: saved.id,
      details: `Created branch ${saved.branch_name} (${saved.branch_code})`,
      metadata: {
        status: saved.status,
        inventory_store_type: saved.inventory_store_type,
      },
    });
    return this.toControlView(saved);
  }

  async findAll(
    clientId?: string,
    filters?: { name?: string; status?: string },
    accessibleBranchIds?: number[],
  ): Promise<BranchControlView[]> {
    const query = this.branchRepo.createQueryBuilder('branch')
      .leftJoinAndSelect('branch.client', 'client');

    if (clientId) {
      query.where('branch.client_id = :clientId', { clientId });
    }

    if (filters?.name) {
      query.andWhere('branch.branch_name LIKE :name', { name: `%${filters.name}%` });
    }
    if (filters?.status) {
      query.andWhere('branch.status = :status', { status: filters.status });
    }

    if (accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere('branch.id IN (:...accessibleBranchIds)', { accessibleBranchIds });
    }

    const branches = await query.orderBy('branch.created_at', 'DESC').getMany();
    return Promise.all(branches.map((branch) => this.toControlView(branch)));
  }

  async findOne(clientId: string, id: number): Promise<BranchControlView> {
    const branch = await this.branchRepo.findOne({
      where: { client_id: clientId, id: id },
      relations: ['client'],
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.toControlView(branch);
  }

  private async getBranchEntity(clientId: string, id: number): Promise<Branch> {
    const branch = await this.branchRepo.findOne({
      where: { client_id: clientId, id },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(clientId: string, id: number, dto: UpdateBranchDto, userId: string | number, user?: JwtPayload): Promise<BranchControlView> {
    const branch = await this.getBranchEntity(clientId, id);
    await this.assertTaxRegionBelongsToClient(clientId, dto.tax_region ?? branch.tax_region);
    const previousStatus = branch.status;
    const nextCode = this.normalizeBranchCode(dto.branch_code) || branch.branch_code;
    const nextBranchName = dto.branch_name ?? branch.branch_name;
    const nextInventoryStoreType = dto.inventory_store_type ?? branch.inventory_store_type;
    const nextIsProductionSource = dto.is_production_source ?? branch.is_production_source;
    const config = this.prepareBranchConfiguration({
      operating_hours: dto.operating_hours ?? branch.operating_hours,
      document_settings: dto.document_settings ?? branch.document_settings,
      tax_settings: dto.tax_settings ?? branch.tax_settings,
      operational_settings: dto.operational_settings ?? branch.operational_settings,
      inventory_control_settings: dto.inventory_control_settings ?? branch.inventory_control_settings,
      opening_time: dto.opening_time ?? branch.opening_time,
      closing_time: dto.closing_time ?? branch.closing_time,
      tax_region: dto.tax_region ?? branch.tax_region,
    });
    await this.assertTaxSettingsBelongToClient(clientId, config.tax_settings);
    await this.ensureUniqueIdentity(clientId, {
      branch_code: nextCode,
      branch_name: nextBranchName,
    }, id);

    Object.assign(branch, {
      ...dto,
      currency_code: dto.currency_code !== undefined
        ? (dto.currency_code || 'USD').trim().toUpperCase()
        : branch.currency_code,
      date_format: dto.date_format !== undefined
        ? this.normalizeBranchDateFormat(dto.date_format)
        : branch.date_format,
      time_format: dto.time_format !== undefined
        ? this.normalizeBranchTimeFormat(dto.time_format)
        : branch.time_format,
      inherit_client_currency: false,
      branch_code: nextCode,
      inventory_store_type: nextInventoryStoreType,
      modules_enabled: dto.modules_enabled
        ? this.normalizeModuleList(dto.modules_enabled)
        : branch.modules_enabled,
      opening_time: config.opening_time,
      closing_time: config.closing_time,
      operating_hours: config.operating_hours,
      document_settings: config.document_settings,
      tax_settings: config.tax_settings,
      operational_settings: config.operational_settings,
      inventory_control_settings: config.inventory_control_settings,
      tax_region: config.tax_region,
    });
    branch.is_production_source = nextIsProductionSource;
    branch.production_source_label = this.normalizeProductionSourceLabel(
      nextIsProductionSource,
      dto.production_source_label ?? branch.production_source_label ?? undefined,
      nextBranchName,
      nextInventoryStoreType,
    );
    branch.status = (dto.status || branch.status) as BranchStatus;
    branch.is_active = branch.status === 'active';
    branch.updated_by = userId.toString();
    if (branch.status === 'active' && previousStatus !== 'active') {
      await this.entitlementsService.assertCanActivateBranch(clientId, id);
    }
    this.validateSettingsGovernance(branch);
    if (branch.status === 'active') {
      await this.assertCanUseActiveStatus(branch);
    }

    const saved = await this.branchRepo.save(branch);
    await this.operationalAuditService.log({
      user,
      action: 'Branch Updated',
      entity: 'branches',
      clientId,
      branchId: saved.id,
      entityId: saved.id,
      details: `Updated branch ${saved.branch_name} (${saved.branch_code})`,
      metadata: {
        status: saved.status,
        inventory_store_type: saved.inventory_store_type,
      },
    });
    return this.toControlView(saved);
  }

  async getInventoryControlSettings(clientId: string, id: number): Promise<{
    branch_id: number;
    branch_name: string;
    branch_code: string;
    inventory_control_settings: BranchInventoryControlSettings;
  }> {
    const branch = await this.getBranchEntity(clientId, id);
    return {
      branch_id: branch.id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      inventory_control_settings: this.normalizeInventoryControlSettings(branch.inventory_control_settings),
    };
  }

  async updateInventoryControlSettings(
    clientId: string,
    id: number,
    dto: BranchInventoryControlSettingsDto,
    userId: string | number,
    user?: JwtPayload,
  ): Promise<{
    branch_id: number;
    branch_name: string;
    branch_code: string;
    inventory_control_settings: BranchInventoryControlSettings;
  }> {
    const branch = await this.getBranchEntity(clientId, id);
    branch.inventory_control_settings = this.normalizeInventoryControlSettings(dto);
    branch.updated_by = userId.toString();
    const saved = await this.branchRepo.save(branch);
    await this.operationalAuditService.log({
      user,
      action: 'Branch Inventory Control Settings Updated',
      entity: 'branches',
      clientId,
      branchId: saved.id,
      entityId: saved.id,
      details: `Updated blind inventory control settings for branch ${saved.branch_name} (${saved.branch_code})`,
      metadata: {
        inventory_control_settings: saved.inventory_control_settings,
      },
    });
    return {
      branch_id: saved.id,
      branch_name: saved.branch_name,
      branch_code: saved.branch_code,
      inventory_control_settings: this.normalizeInventoryControlSettings(saved.inventory_control_settings),
    };
  }

  async setStatus(clientId: string, id: number, status: BranchStatus, userId: string | number, user?: JwtPayload): Promise<BranchControlView> {
    const branch = await this.getBranchEntity(clientId, id);
    const previousStatus = branch.status;
    if (status === 'active' && previousStatus !== 'active') {
      await this.entitlementsService.assertCanActivateBranch(clientId, id);
    }
    branch.status = status;
    branch.is_active = status === 'active';
    branch.updated_by = userId.toString();
    if (status === 'active') {
      await this.assertCanUseActiveStatus(branch);
    }

    const saved = await this.branchRepo.save(branch);
    await this.operationalAuditService.log({
      user,
      action: 'Branch Status Changed',
      entity: 'branches',
      clientId,
      branchId: saved.id,
      entityId: saved.id,
      details: `Branch ${saved.branch_name} moved from ${previousStatus} to ${saved.status}`,
      metadata: {
        previous_status: previousStatus,
        next_status: saved.status,
      },
    });
    return this.toControlView(saved);
  }

  async assignModules(clientId: string, id: number, modules: string[], userId: string | number, user?: JwtPayload): Promise<BranchControlView> {
    const branch = await this.getBranchEntity(clientId, id);
    branch.modules_enabled = this.normalizeModuleList(modules);
    branch.updated_by = userId.toString();
    const saved = await this.branchRepo.save(branch);
    await this.operationalAuditService.log({
      user,
      action: 'Branch Modules Updated',
      entity: 'branches',
      clientId,
      branchId: saved.id,
      entityId: saved.id,
      details: `Updated modules for branch ${saved.branch_name}`,
      metadata: {
        modules_enabled: modules,
      },
    });
    return this.toControlView(saved);
  }

  async remove(clientId: string, id: number): Promise<void> {
    const branch = await this.getBranchEntity(clientId, id);
    if (branch.status === 'active') {
      throw new BadRequestException('Cannot delete an active branch. Deactivate it first.');
    }
    await this.branchRepo.delete({ client_id: clientId, id: id });
  }

  async findLocations(clientId: string, branchId: number): Promise<BranchLocation[]> {
    await this.getBranchEntity(clientId, branchId);
    return this.branchLocationRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      order: { location_name: 'ASC' },
    });
  }

  async createLocation(
    clientId: string,
    branchId: number,
    dto: {
      location_name: string;
      location_code?: string | null;
      location_type?: string | null;
      description?: string | null;
      is_active?: boolean;
    },
  ): Promise<BranchLocation> {
    await this.getBranchEntity(clientId, branchId);
    return this.branchLocationRepo.save(this.branchLocationRepo.create({
      client_id: clientId,
      branch_id: branchId,
      location_name: dto.location_name.trim(),
      location_code: dto.location_code?.trim() || null,
      location_type: dto.location_type?.trim() || 'store',
      description: dto.description?.trim() || null,
      is_active: dto.is_active ?? true,
    }));
  }

  async updateLocation(
    clientId: string,
    id: number,
    dto: {
      location_name?: string;
      location_code?: string | null;
      location_type?: string | null;
      description?: string | null;
      is_active?: boolean;
    },
    accessibleBranchIds?: number[],
  ): Promise<BranchLocation> {
    const location = await this.branchLocationRepo.findOne({
      where: { client_id: clientId, id },
    });
    if (!location || (accessibleBranchIds?.length && !accessibleBranchIds.includes(location.branch_id))) {
      throw new NotFoundException('Branch location not found');
    }
    if (dto.location_name?.trim()) location.location_name = dto.location_name.trim();
    if (dto.location_code !== undefined) location.location_code = dto.location_code?.trim() || null;
    if (dto.location_type !== undefined) location.location_type = dto.location_type?.trim() || 'store';
    if (dto.description !== undefined) location.description = dto.description?.trim() || null;
    if (dto.is_active !== undefined) location.is_active = dto.is_active;
    return this.branchLocationRepo.save(location);
  }

  async removeLocation(clientId: string, id: number, accessibleBranchIds?: number[]): Promise<void> {
    const location = await this.branchLocationRepo.findOne({
      where: { client_id: clientId, id },
    });
    if (!location || (accessibleBranchIds?.length && !accessibleBranchIds.includes(location.branch_id))) {
      throw new NotFoundException('Branch location not found');
    }
    await this.branchLocationRepo.remove(location);
  }

  // ---- BRANCH CHARGES MANAGEMENT ----

  async findCharges(clientId: string, branchId: number): Promise<BranchCharge[]> {
    return this.branchChargeRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      order: { priority: 'ASC' }
    });
  }

  async createCharge(clientId: string, branchId: number, dto: CreateBranchChargeDto): Promise<BranchCharge> {
    await this.getBranchEntity(clientId, branchId);
    const charge = new BranchCharge();
    Object.assign(charge, {
      ...dto,
      client_id: clientId,
      branch_id: branchId
    });
    return this.branchChargeRepo.save(charge);
  }

  async updateCharge(clientId: string, branchId: number, id: number, dto: UpdateBranchChargeDto): Promise<BranchCharge> {
    await this.getBranchEntity(clientId, branchId);
    const charge = await this.branchChargeRepo.findOne({
      where: { id, client_id: clientId, branch_id: branchId }
    });
    if (!charge) throw new NotFoundException('Charge not found');
    Object.assign(charge, dto);
    return this.branchChargeRepo.save(charge);
  }

  async removeCharge(clientId: string, branchId: number, id: number): Promise<void> {
    await this.getBranchEntity(clientId, branchId);
    await this.branchChargeRepo.delete({ id, client_id: clientId, branch_id: branchId });
  }
}
