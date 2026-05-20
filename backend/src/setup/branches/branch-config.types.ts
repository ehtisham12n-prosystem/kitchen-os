export const BRANCH_OPERATING_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type BranchOperatingDayKey = (typeof BRANCH_OPERATING_DAYS)[number];

export interface BranchOperatingDayConfig {
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export type BranchOperatingHours = Record<BranchOperatingDayKey, BranchOperatingDayConfig>;

export const BRANCH_DOCUMENT_TYPES = [
  'purchase_order',
  'procurement_request',
  'goods_receipt_note',
  'pos_order',
  'pos_receipt',
  'pos_kot',
  'payment_voucher',
  'expense_voucher',
  'compensation_voucher',
] as const;

export type BranchDocumentType = (typeof BRANCH_DOCUMENT_TYPES)[number];

export const BRANCH_DOCUMENT_RESET_FREQUENCIES = [
  'never',
  'manual',
  'business_day',
  'calendar_day',
  'monthly',
  'annually',
] as const;

export type BranchDocumentResetFrequency =
  (typeof BRANCH_DOCUMENT_RESET_FREQUENCIES)[number];

export const BRANCH_DOCUMENT_DATE_SEGMENT_FORMATS = [
  'none',
  'YYMM',
  'YYMMDD',
] as const;

export type BranchDocumentDateSegmentFormat =
  (typeof BRANCH_DOCUMENT_DATE_SEGMENT_FORMATS)[number];

export interface BranchDocumentRule {
  prefix: string;
  zero_pad: number;
  reset_frequency: BranchDocumentResetFrequency;
  include_branch_code: boolean;
  include_counter_code: boolean;
  date_segment_format: BranchDocumentDateSegmentFormat;
  manual_reset_at?: string | null;
}

export type BranchDocumentSettings = Record<BranchDocumentType, BranchDocumentRule>;

export interface ClientNumberingSettings {
  client_id_format: 'CL####';
  branch_code_prefix: string;
  branch_code_zero_pad: number;
  employee_code_prefix: string;
  employee_code_zero_pad: number;
  customer_code_prefix: string;
  customer_code_zero_pad: number;
  offline_order_format: string;
  offline_kot_format: string;
  rules: BranchDocumentSettings;
}

export const BRANCH_TAX_ROUNDING_METHODS = ['nearest', 'up', 'down'] as const;
export type BranchTaxRoundingMethod = (typeof BRANCH_TAX_ROUNDING_METHODS)[number];

export interface BranchTaxSettings {
  default_tax_code: string | null;
  dine_in_tax_code: string | null;
  takeaway_tax_code: string | null;
  delivery_tax_code: string | null;
  prices_include_tax: boolean;
  allow_tax_exemption: boolean;
  tax_rounding_method: BranchTaxRoundingMethod;
}

export const BRANCH_ORDER_TYPES = ['dine_in', 'takeout', 'delivery'] as const;
export type BranchDefaultOrderType = (typeof BRANCH_ORDER_TYPES)[number];
export const BRANCH_KDS_ALERT_SOUNDS = [
  'service_bell',
  'double_chime',
  'soft_ping',
  'urgent_pulse',
  'loud_bell',
  'loud_double_bell',
  'triple_chime',
  'kitchen_siren',
  'alarm_burst',
  'double_alarm',
  'long_ring',
  'new_order_grab_2022',
  'dragon_studio_festive_chime_439612',
  'got_retro_synth_alert_438279',
  'universfield_ringtone_058_495412',
  'universfield_ringtone_069_496274',
  'notification_alert_3_331723',
  'notification_alert_4_331722',
  'universfield_ringtone_072_496297',
  'universfield_new_notification_022_370046',
  'dragon_studio_alert_444816',
  'mixkit_bless_choir_655',
  'mixkit_choir_bell_bless_656',
  'mixkit_futuristic_doorbell_928',
  'mixkit_bells_of_summer_929',
  'mixkit_bell_of_promise_930',
  'mixkit_christmas_magic_bell_hit_939_alt',
  'mixkit_uplifting_bells_notification_938_alt',
  'mixkit_correct_positive_answer_949',
  'mixkit_intro_transition_1146',
  'mixkit_game_show_suspense_waiting_667',
  'mixkit_successful_horns_fanfare_722',
  'mixkit_clown_horn_at_circus_715',
  'mixkit_melodic_gold_price_2000',
  'mixkit_magical_coin_win_1936',
  'mixkit_christmas_magic_bell_hit_939',
  'mixkit_modern_classic_door_bell_113',
  'mixkit_home_standard_ding_dong_109',
  'mixkit_notification_bell_592',
  'mixkit_uplifting_bells_notification_938',
  'mixkit_cartoon_door_melodic_bell_110',
  'mixkit_achievement_bell_600',
  'mixkit_happy_bells_notification_937',
  'off',
] as const;
export type BranchKdsAlertSound = (typeof BRANCH_KDS_ALERT_SOUNDS)[number];

export interface BranchOperationalSettings {
  default_order_type: BranchDefaultOrderType;
  require_open_shift: boolean;
  require_sale_counter: boolean;
  floor_service_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  auto_assign_tables: boolean;
  business_day_cutoff_time: string;
  line_item_cancel_reduce_limit_minutes: number;
  item_edit_lock_minutes: number;
  item_cancellation_window_minutes: number;
  order_cancellation_window_minutes: number;
  kds_new_order_alert_sound: BranchKdsAlertSound;
  kds_order_change_alert_sound: BranchKdsAlertSound;
  kds_alert_volume_level: number;
}

export const INVENTORY_COUNT_FREQUENCIES = ['daily', 'alternate_day', 'weekly'] as const;
export type InventoryCountFrequency = (typeof INVENTORY_COUNT_FREQUENCIES)[number];

export interface BranchInventoryControlSettings {
  blind_random_enabled: boolean;
  blind_random_frequency: InventoryCountFrequency;
  blind_random_sample_size: number;
  end_of_day_blind_enabled: boolean;
  end_of_day_sample_size: number;
  monthly_blind_full_enabled: boolean;
  discrepancy_percent_warn_threshold: number;
  discrepancy_percent_critical_threshold: number;
  discrepancy_value_warn_threshold: number;
  discrepancy_value_critical_threshold: number;
  escalation_variance_line_threshold: number;
  escalation_variance_value_threshold: number;
  close_block_on_critical_variance: boolean;
}

const DEFAULT_DOCUMENT_PREFIXES: Record<BranchDocumentType, string> = {
  purchase_order: 'PO',
  procurement_request: 'PR',
  goods_receipt_note: 'GRN',
  pos_order: 'ORD',
  pos_receipt: 'RCPT',
  pos_kot: 'KOT',
  payment_voucher: 'PV',
  expense_voucher: 'EV',
  compensation_voucher: 'CV',
};

export function createDefaultBranchOperatingHours(
  openingTime?: string | null,
  closingTime?: string | null,
): BranchOperatingHours {
  const isConfigured = Boolean(openingTime && closingTime);

  return BRANCH_OPERATING_DAYS.reduce((acc, day) => {
    acc[day] = {
      is_open: isConfigured,
      open_time: isConfigured ? openingTime ?? null : null,
      close_time: isConfigured ? closingTime ?? null : null,
    };
    return acc;
  }, {} as BranchOperatingHours);
}

export function cloneBranchOperatingHours(
  operatingHours: BranchOperatingHours,
): BranchOperatingHours {
  return BRANCH_OPERATING_DAYS.reduce((acc, day) => {
    const source = operatingHours[day];
    acc[day] = {
      is_open: Boolean(source?.is_open),
      open_time: source?.open_time ?? null,
      close_time: source?.close_time ?? null,
    };
    return acc;
  }, {} as BranchOperatingHours);
}

export function createDefaultBranchDocumentSettings(): BranchDocumentSettings {
  return BRANCH_DOCUMENT_TYPES.reduce((acc, type) => {
    const isPosOrder = type === 'pos_order';
    const isPosReceipt = type === 'pos_receipt';
    const isPosKot = type === 'pos_kot';
    const isMonthlyAccountingDoc =
      type === 'procurement_request'
      || type === 'goods_receipt_note'
      || type === 'payment_voucher'
      || type === 'expense_voucher'
      || type === 'compensation_voucher';

    acc[type] = {
      prefix: DEFAULT_DOCUMENT_PREFIXES[type],
      zero_pad: 4,
      reset_frequency:
        isPosKot ? 'never'
        : isPosOrder || type === 'purchase_order' ? 'annually'
        : isPosReceipt || isMonthlyAccountingDoc ? 'monthly'
        : 'monthly',
      include_branch_code: true,
      include_counter_code: isPosOrder || isPosKot,
      date_segment_format:
        isPosOrder || isPosKot ? 'none'
        : isPosReceipt || type === 'purchase_order' ? 'YYMMDD'
        : 'YYMM',
      manual_reset_at: null,
    };
    return acc;
  }, {} as BranchDocumentSettings);
}

export function createDefaultClientNumberingSettings(): ClientNumberingSettings {
  const rules = createDefaultBranchDocumentSettings();
  rules.pos_order = {
    prefix: 'ORD',
    zero_pad: 4,
    reset_frequency: 'annually',
    include_branch_code: true,
    include_counter_code: true,
    date_segment_format: 'none',
    manual_reset_at: null,
  };
  rules.pos_receipt = {
    prefix: 'RCPT',
    zero_pad: 4,
    reset_frequency: 'monthly',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMMDD',
    manual_reset_at: null,
  };
  rules.pos_kot = {
    prefix: 'KOT',
    zero_pad: 4,
    reset_frequency: 'never',
    include_branch_code: false,
    include_counter_code: true,
    date_segment_format: 'none',
    manual_reset_at: null,
  };
  rules.purchase_order = {
    prefix: 'PO',
    zero_pad: 4,
    reset_frequency: 'annually',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMMDD',
    manual_reset_at: null,
  };
  rules.procurement_request = {
    prefix: 'PR',
    zero_pad: 4,
    reset_frequency: 'monthly',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMM',
    manual_reset_at: null,
  };
  rules.goods_receipt_note = {
    prefix: 'GRN',
    zero_pad: 4,
    reset_frequency: 'monthly',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMM',
    manual_reset_at: null,
  };
  rules.payment_voucher = {
    prefix: 'PV',
    zero_pad: 4,
    reset_frequency: 'monthly',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMM',
    manual_reset_at: null,
  };
  rules.expense_voucher = {
    prefix: 'EV',
    zero_pad: 4,
    reset_frequency: 'monthly',
    include_branch_code: true,
    include_counter_code: false,
    date_segment_format: 'YYMM',
    manual_reset_at: null,
  };

  return {
    client_id_format: 'CL####',
    branch_code_prefix: 'BR',
    branch_code_zero_pad: 3,
    employee_code_prefix: 'EMP',
    employee_code_zero_pad: 4,
    customer_code_prefix: 'CUS',
    customer_code_zero_pad: 6,
    offline_order_format: 'ORD-<CLIENTCODE>-<BRANCHCODE>-<COUNTERCODE>-<MMDD>-<SEQUENCE>',
    offline_kot_format: 'KOT-<BRANCHCODE>-<COUNTERCODE>-<SEQUENCE>',
    rules,
  };
}

export function cloneBranchDocumentSettings(
  settings: BranchDocumentSettings,
): BranchDocumentSettings {
  return BRANCH_DOCUMENT_TYPES.reduce((acc, type) => {
    const source = settings[type];
    acc[type] = {
      prefix: source?.prefix ?? DEFAULT_DOCUMENT_PREFIXES[type],
      zero_pad: source?.zero_pad ?? 4,
      reset_frequency: normalizeDocumentResetFrequency(source?.reset_frequency),
      include_branch_code: Boolean(source?.include_branch_code),
      include_counter_code: Boolean(source?.include_counter_code),
      date_segment_format: source?.date_segment_format ?? 'YYMM',
      manual_reset_at: source?.manual_reset_at ?? null,
    };
    return acc;
  }, {} as BranchDocumentSettings);
}

export function normalizeDocumentResetFrequency(
  value?: string | null,
): BranchDocumentResetFrequency {
  if (value === 'daily') {
    return 'calendar_day';
  }
  if (value === 'yearly') {
    return 'annually';
  }
  if (value && BRANCH_DOCUMENT_RESET_FREQUENCIES.includes(value as BranchDocumentResetFrequency)) {
    return value as BranchDocumentResetFrequency;
  }
  return 'monthly';
}

export function createDefaultBranchTaxSettings(
  defaultTaxCode?: string | null,
): BranchTaxSettings {
  return {
    default_tax_code: defaultTaxCode?.trim() || null,
    dine_in_tax_code: null,
    takeaway_tax_code: null,
    delivery_tax_code: null,
    prices_include_tax: false,
    allow_tax_exemption: false,
    tax_rounding_method: 'nearest',
  };
}

export function cloneBranchTaxSettings(
  settings: BranchTaxSettings,
): BranchTaxSettings {
  return {
    default_tax_code: settings.default_tax_code ?? null,
    dine_in_tax_code: settings.dine_in_tax_code ?? null,
    takeaway_tax_code: settings.takeaway_tax_code ?? null,
    delivery_tax_code: settings.delivery_tax_code ?? null,
    prices_include_tax: Boolean(settings.prices_include_tax),
    allow_tax_exemption: Boolean(settings.allow_tax_exemption),
    tax_rounding_method: settings.tax_rounding_method ?? 'nearest',
  };
}

export function createDefaultBranchOperationalSettings(): BranchOperationalSettings {
  return {
    default_order_type: 'dine_in',
    require_open_shift: true,
    require_sale_counter: false,
    floor_service_enabled: true,
    pickup_enabled: true,
    delivery_enabled: true,
    auto_assign_tables: false,
    business_day_cutoff_time: '05:00',
    line_item_cancel_reduce_limit_minutes: 5,
    item_edit_lock_minutes: 5,
    item_cancellation_window_minutes: 5,
    order_cancellation_window_minutes: 5,
    kds_new_order_alert_sound: 'mixkit_christmas_magic_bell_hit_939',
    kds_order_change_alert_sound: 'dragon_studio_alert_444816',
    kds_alert_volume_level: 85,
  };
}

export function createDefaultBranchInventoryControlSettings(): BranchInventoryControlSettings {
  return {
    blind_random_enabled: true,
    blind_random_frequency: 'daily',
    blind_random_sample_size: 12,
    end_of_day_blind_enabled: true,
    end_of_day_sample_size: 20,
    monthly_blind_full_enabled: true,
    discrepancy_percent_warn_threshold: 3,
    discrepancy_percent_critical_threshold: 8,
    discrepancy_value_warn_threshold: 2500,
    discrepancy_value_critical_threshold: 10000,
    escalation_variance_line_threshold: 5,
    escalation_variance_value_threshold: 15000,
    close_block_on_critical_variance: true,
  };
}

export function cloneBranchOperationalSettings(
  settings: BranchOperationalSettings,
): BranchOperationalSettings {
  return {
    default_order_type: settings.default_order_type ?? 'dine_in',
    require_open_shift: Boolean(settings.require_open_shift),
    require_sale_counter: Boolean(settings.require_sale_counter),
    floor_service_enabled: Boolean(settings.floor_service_enabled),
    pickup_enabled: Boolean(settings.pickup_enabled),
    delivery_enabled: Boolean(settings.delivery_enabled),
    auto_assign_tables: Boolean(settings.auto_assign_tables),
    business_day_cutoff_time: settings.business_day_cutoff_time ?? '05:00',
    line_item_cancel_reduce_limit_minutes: Number.isFinite(Number(settings.line_item_cancel_reduce_limit_minutes))
      ? Math.max(Number(settings.line_item_cancel_reduce_limit_minutes), 0)
      : 5,
    item_edit_lock_minutes: Number.isFinite(Number(settings.item_edit_lock_minutes))
      ? Math.max(Number(settings.item_edit_lock_minutes), 0)
      : 5,
    item_cancellation_window_minutes: Number.isFinite(Number(settings.item_cancellation_window_minutes))
      ? Math.max(Number(settings.item_cancellation_window_minutes), 0)
      : 5,
    order_cancellation_window_minutes: Number.isFinite(Number(settings.order_cancellation_window_minutes))
      ? Math.max(Number(settings.order_cancellation_window_minutes), 0)
      : 5,
    kds_new_order_alert_sound: settings.kds_new_order_alert_sound ?? 'mixkit_christmas_magic_bell_hit_939',
    kds_order_change_alert_sound: settings.kds_order_change_alert_sound ?? 'dragon_studio_alert_444816',
    kds_alert_volume_level: Number.isFinite(Number(settings.kds_alert_volume_level))
      ? Math.min(Math.max(Number(settings.kds_alert_volume_level), 0), 100)
      : 85,
  };
}

export function cloneBranchInventoryControlSettings(
  settings: BranchInventoryControlSettings,
): BranchInventoryControlSettings {
  const defaults = createDefaultBranchInventoryControlSettings();
  return {
    blind_random_enabled: Boolean(settings.blind_random_enabled),
    blind_random_frequency: settings.blind_random_frequency ?? defaults.blind_random_frequency,
    blind_random_sample_size: Number.isFinite(Number(settings.blind_random_sample_size))
      ? Math.max(Number(settings.blind_random_sample_size), 1)
      : defaults.blind_random_sample_size,
    end_of_day_blind_enabled: Boolean(settings.end_of_day_blind_enabled),
    end_of_day_sample_size: Number.isFinite(Number(settings.end_of_day_sample_size))
      ? Math.max(Number(settings.end_of_day_sample_size), 1)
      : defaults.end_of_day_sample_size,
    monthly_blind_full_enabled: Boolean(settings.monthly_blind_full_enabled),
    discrepancy_percent_warn_threshold: Number.isFinite(Number(settings.discrepancy_percent_warn_threshold))
      ? Math.max(Number(settings.discrepancy_percent_warn_threshold), 0)
      : defaults.discrepancy_percent_warn_threshold,
    discrepancy_percent_critical_threshold: Number.isFinite(Number(settings.discrepancy_percent_critical_threshold))
      ? Math.max(Number(settings.discrepancy_percent_critical_threshold), 0)
      : defaults.discrepancy_percent_critical_threshold,
    discrepancy_value_warn_threshold: Number.isFinite(Number(settings.discrepancy_value_warn_threshold))
      ? Math.max(Number(settings.discrepancy_value_warn_threshold), 0)
      : defaults.discrepancy_value_warn_threshold,
    discrepancy_value_critical_threshold: Number.isFinite(Number(settings.discrepancy_value_critical_threshold))
      ? Math.max(Number(settings.discrepancy_value_critical_threshold), 0)
      : defaults.discrepancy_value_critical_threshold,
    escalation_variance_line_threshold: Number.isFinite(Number(settings.escalation_variance_line_threshold))
      ? Math.max(Number(settings.escalation_variance_line_threshold), 1)
      : defaults.escalation_variance_line_threshold,
    escalation_variance_value_threshold: Number.isFinite(Number(settings.escalation_variance_value_threshold))
      ? Math.max(Number(settings.escalation_variance_value_threshold), 0)
      : defaults.escalation_variance_value_threshold,
    close_block_on_critical_variance: Boolean(settings.close_block_on_critical_variance),
  };
}

export function getDocumentWindowBounds(
  resetFrequency: BranchDocumentResetFrequency | string,
  date: Date = new Date(),
  manualResetAt?: string | null,
): { start: Date; end: Date } | null {
  const normalized = normalizeDocumentResetFrequency(resetFrequency);

  if (normalized === 'never') {
    return null;
  }

  if (normalized === 'manual') {
    if (!manualResetAt) {
      return null;
    }
    const start = new Date(manualResetAt);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    return { start, end: new Date(8640000000000000) };
  }

  if (normalized === 'business_day' || normalized === 'calendar_day') {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { start, end };
  }

  if (normalized === 'monthly') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
  }

  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear() + 1, 0, 1);
  return { start, end };
}

export function getDocumentDateSegment(
  rule: Pick<BranchDocumentRule, 'date_segment_format'>,
  date: Date = new Date(),
): string | null {
  if (rule.date_segment_format === 'none') {
    return null;
  }

  const yyyy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (rule.date_segment_format === 'YYMMDD') {
    return `${yyyy}${mm}${dd}`;
  }
  return `${yyyy}${mm}`;
}

export function formatBranchDocumentNumber(
  rule: BranchDocumentRule,
  branchCode: string,
  sequence: number,
  date: Date = new Date(),
  counterCode?: string | null,
): string {
  const normalizeCodeSegment = (value?: string | null): string => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  const parts = [rule.prefix];
  const normalizedBranchCode = normalizeCodeSegment(branchCode);
  const normalizedCounterCode = normalizeCodeSegment(counterCode);
  if (rule.include_branch_code && normalizedBranchCode) {
    parts.push(normalizedBranchCode);
  }
  if (rule.include_counter_code && normalizedCounterCode) {
    parts.push(normalizedCounterCode);
  }

  const dateSegment = getDocumentDateSegment(rule, date);
  if (dateSegment) {
    parts.push(dateSegment);
  }

  parts.push(String(sequence).padStart(rule.zero_pad, '0'));
  return parts.join('-');
}

export function extractDocumentSequence(documentNo?: string | null): number {
  const match = String(documentNo || '').match(/(\d+)\s*$/);
  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1], 10) || 0;
}
