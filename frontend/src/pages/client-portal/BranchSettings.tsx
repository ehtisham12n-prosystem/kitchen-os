/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronLeft, ClipboardList, FileDigit, Globe, Loader2, Play, Save, Settings2, ShieldCheck, Store, Wallet } from 'lucide-react';
import { APP_PERMISSIONS } from '../../auth/access';
import { branchApi, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { updateStoredBranchCurrency } from '../../utils/currency';
import { KDS_ALERT_SOUND_OPTIONS, getKdsAlertSoundLabel, playKdsAlert, type KdsAlertSound } from '../../utils/kdsAlertSounds';
import styles from './BranchSettings.module.css';

type BranchStatus = 'setup_pending' | 'active' | 'inactive' | 'suspended';
type ResetFrequency = 'never' | 'manual' | 'business_day' | 'calendar_day' | 'monthly' | 'annually';
type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type DocumentType = 'purchase_order' | 'procurement_request' | 'goods_receipt_note' | 'pos_order' | 'pos_receipt' | 'pos_kot' | 'payment_voucher' | 'expense_voucher' | 'compensation_voucher';
type TabKey = 'overview' | 'operations' | 'documents' | 'tax' | 'boundaries';
type DateFormatOption = 'MMM DD, YYYY' | 'DD MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
type TimeFormatOption = 'hh:mma' | 'hh:mm a' | 'HH:mm' | 'HH:mm:ss';
type CountFrequency = 'daily' | 'alternate_day' | 'weekly';

interface BranchOperatingDay {
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
}

interface BranchDocumentRule {
    prefix: string;
    zero_pad: number;
    reset_frequency: ResetFrequency;
    include_branch_code: boolean;
    include_counter_code: boolean;
    date_segment_format: 'none' | 'YYMM' | 'YYMMDD';
    manual_reset_at?: string | null;
}

interface BranchTaxSettings {
    default_tax_code: string | null;
    dine_in_tax_code: string | null;
    takeaway_tax_code: string | null;
    delivery_tax_code: string | null;
    prices_include_tax: boolean;
    allow_tax_exemption: boolean;
    tax_rounding_method: 'nearest' | 'up' | 'down';
}

interface BranchOperationalSettings {
    default_order_type: 'dine_in' | 'takeout' | 'delivery';
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
    kds_new_order_alert_sound: KdsAlertSound;
    kds_order_change_alert_sound: KdsAlertSound;
    kds_alert_volume_level: number;
}

interface BranchInventoryControlSettings {
    blind_random_enabled: boolean;
    blind_random_frequency: CountFrequency;
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

interface BranchDetail {
    id: number;
    branch_name: string;
    branch_code: string;
    city?: string;
    state?: string;
    country?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    tax_region?: string | null;
    status: BranchStatus;
    modules_enabled?: string[];
    inherit_client_currency: boolean;
    inherit_client_language: boolean;
    inherit_client_theme: boolean;
    currency_code?: string;
    date_format?: DateFormatOption;
    time_format?: TimeFormatOption;
    language?: string;
    theme_id?: string;
    readiness: { is_operationally_ready: boolean; setup_completion_percent: number; blockers: string[] };
    effective_settings: { currency_code: string; date_format: DateFormatOption; time_format: TimeFormatOption; language: string; theme_id: string | null; timezone: string; fiscal_year_start: number; resolution_order: string[] };
    effective_settings_sources: Record<string, { source: string; locked: boolean }>;
    operating_hours: Record<Weekday, BranchOperatingDay>;
    document_settings: Record<DocumentType, BranchDocumentRule>;
    tax_settings: BranchTaxSettings;
    operational_settings: BranchOperationalSettings;
    inventory_control_settings: BranchInventoryControlSettings;
    config_boundary: { client_defaults: string[]; inherited: string[]; overridable: string[]; locked: string[]; resolution_order: string[] };
    operational_profile: { branch_kind: 'operational_branch' | 'central_store'; writes_allowed: boolean; };
    oversight: { branch_scope_enforced: boolean };
}

const WEEK_DAYS: Array<{ key: Weekday; label: string }> = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
];

const DOCUMENT_FIELDS: Array<{ key: DocumentType; label: string }> = [
    { key: 'purchase_order', label: 'Purchase Orders' },
    { key: 'procurement_request', label: 'Procurement Requests' },
    { key: 'goods_receipt_note', label: 'Goods Receipt Notes' },
    { key: 'pos_order', label: 'POS Orders' },
    { key: 'pos_receipt', label: 'POS Receipts' },
    { key: 'pos_kot', label: 'KOT Tickets' },
    { key: 'payment_voucher', label: 'Payment Vouchers' },
    { key: 'expense_voucher', label: 'Expense Vouchers' },
    { key: 'compensation_voucher', label: 'Compensation Vouchers' },
];

const MODULE_OPTIONS = ['dashboard', 'catalog', 'pos', 'inventory', 'procurement', 'accounting'];
const CURRENCY_OPTIONS = ['USD', 'PKR', 'SAR', 'AED', 'EUR', 'GBP', 'QAR', 'OMR', 'KWD', 'BHD'];
const DATE_FORMAT_OPTIONS: Array<{ value: DateFormatOption; label: string }> = [
    { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY' },
    { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];
const TIME_FORMAT_OPTIONS: Array<{ value: TimeFormatOption; label: string }> = [
    { value: 'hh:mma', label: '12hr Compact (09:30am)' },
    { value: 'hh:mm a', label: '12hr Spaced (09:30 am)' },
    { value: 'HH:mm', label: '24hr (09:30)' },
    { value: 'HH:mm:ss', label: '24hr with seconds (09:30:00)' },
];
const normalizeTime = (value?: string | null) => value ? value.slice(0, 5) : '';
const optionalValue = (value?: string | null) => value?.trim() ? value.trim() : undefined;
const formatLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const formatList = (values: string[]) => values.length ? values.join(', ') : 'None';
const hasValue = (value?: string | null) => Boolean(value && value.trim());
const getReadinessTone = (isReady: boolean) => isReady ? styles.readyTone : styles.pendingTone;
const createDefaultInventoryControlSettings = (): BranchInventoryControlSettings => ({
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
});

export function BranchSettings() {
    const { id } = useParams();
    const navigate = useNavigate();
    const access = usePermissionAccess();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [branch, setBranch] = useState<BranchDetail | null>(null);
    const [taxOptions, setTaxOptions] = useState<Array<{ value: string; label: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingInventory, setIsSavingInventory] = useState(false);
    const canManageBranchSettings = access.hasPermission(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES);
    const canManageInventoryControls = access.hasPermission(APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS);

    const createBranchShell = useCallback((partial?: Partial<BranchDetail>): BranchDetail => ({
        id: Number(partial?.id ?? 0),
        branch_name: partial?.branch_name ?? '',
        branch_code: partial?.branch_code ?? '',
        city: partial?.city ?? '',
        state: partial?.state ?? '',
        country: partial?.country ?? '',
        contact_person: partial?.contact_person ?? '',
        phone: partial?.phone ?? '',
        email: partial?.email ?? '',
        tax_region: partial?.tax_region ?? null,
        status: partial?.status ?? 'setup_pending',
        modules_enabled: partial?.modules_enabled ?? [],
        inherit_client_currency: partial?.inherit_client_currency ?? false,
        inherit_client_language: partial?.inherit_client_language ?? true,
        inherit_client_theme: partial?.inherit_client_theme ?? true,
        currency_code: partial?.currency_code ?? 'PKR',
        date_format: partial?.date_format ?? 'DD/MM/YYYY',
        time_format: partial?.time_format ?? 'HH:mm',
        language: partial?.language ?? 'en',
        theme_id: partial?.theme_id ?? '',
        readiness: partial?.readiness ?? { is_operationally_ready: false, setup_completion_percent: 0, blockers: [] },
        effective_settings: partial?.effective_settings ?? {
            currency_code: 'PKR',
            date_format: 'DD/MM/YYYY',
            time_format: 'HH:mm',
            language: 'en',
            theme_id: null,
            timezone: 'Asia/Karachi',
            fiscal_year_start: 1,
            resolution_order: [],
        },
        effective_settings_sources: partial?.effective_settings_sources ?? {},
        operating_hours: partial?.operating_hours ?? Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, {
            is_open: false,
            open_time: null,
            close_time: null,
        }])) as Record<Weekday, BranchOperatingDay>,
        document_settings: partial?.document_settings ?? Object.fromEntries(DOCUMENT_FIELDS.map(({ key }) => [key, {
            prefix: '',
            zero_pad: 4,
            reset_frequency: 'monthly',
            include_branch_code: true,
            include_counter_code: false,
            date_segment_format: 'YYMM',
            manual_reset_at: null,
        }])) as Record<DocumentType, BranchDocumentRule>,
        tax_settings: partial?.tax_settings ?? {
            default_tax_code: null,
            dine_in_tax_code: null,
            takeaway_tax_code: null,
            delivery_tax_code: null,
            prices_include_tax: false,
            allow_tax_exemption: false,
            tax_rounding_method: 'nearest',
        },
        operational_settings: partial?.operational_settings ?? {
            default_order_type: 'dine_in',
            require_open_shift: true,
            require_sale_counter: true,
            floor_service_enabled: true,
            pickup_enabled: true,
            delivery_enabled: false,
            auto_assign_tables: false,
            business_day_cutoff_time: '23:59',
            line_item_cancel_reduce_limit_minutes: 5,
            item_edit_lock_minutes: 5,
            item_cancellation_window_minutes: 5,
            order_cancellation_window_minutes: 5,
            kds_new_order_alert_sound: 'mixkit_christmas_magic_bell_hit_939',
            kds_order_change_alert_sound: 'dragon_studio_alert_444816',
            kds_alert_volume_level: 85,
        },
        inventory_control_settings: partial?.inventory_control_settings ?? createDefaultInventoryControlSettings(),
        config_boundary: partial?.config_boundary ?? { client_defaults: [], inherited: [], overridable: [], locked: [], resolution_order: [] },
        operational_profile: partial?.operational_profile ?? { branch_kind: 'operational_branch', writes_allowed: true },
        oversight: partial?.oversight ?? { branch_scope_enforced: true },
    }), []);

    const normalizeBranch = useCallback((data: any): BranchDetail => ({
        ...createBranchShell(data),
        ...data,
        operating_hours: Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, {
            is_open: Boolean(data.operating_hours?.[key]?.is_open),
            open_time: normalizeTime(data.operating_hours?.[key]?.open_time),
            close_time: normalizeTime(data.operating_hours?.[key]?.close_time),
        }])) as Record<Weekday, BranchOperatingDay>,
        operational_settings: {
            ...createBranchShell().operational_settings,
            ...data.operational_settings,
            business_day_cutoff_time: normalizeTime(data.operational_settings?.business_day_cutoff_time),
            line_item_cancel_reduce_limit_minutes: Number(
                data.operational_settings?.line_item_cancel_reduce_limit_minutes
                ?? data.operational_settings?.item_cancellation_window_minutes
                ?? data.operational_settings?.item_edit_lock_minutes
                ?? 5,
            ),
        },
        inventory_control_settings: {
            ...createDefaultInventoryControlSettings(),
            blind_random_enabled: Boolean(data.inventory_control_settings?.blind_random_enabled ?? createDefaultInventoryControlSettings().blind_random_enabled),
            blind_random_frequency: data.inventory_control_settings?.blind_random_frequency ?? createDefaultInventoryControlSettings().blind_random_frequency,
            blind_random_sample_size: Number(data.inventory_control_settings?.blind_random_sample_size ?? createDefaultInventoryControlSettings().blind_random_sample_size),
            end_of_day_blind_enabled: Boolean(data.inventory_control_settings?.end_of_day_blind_enabled ?? createDefaultInventoryControlSettings().end_of_day_blind_enabled),
            end_of_day_sample_size: Number(data.inventory_control_settings?.end_of_day_sample_size ?? createDefaultInventoryControlSettings().end_of_day_sample_size),
            monthly_blind_full_enabled: Boolean(data.inventory_control_settings?.monthly_blind_full_enabled ?? createDefaultInventoryControlSettings().monthly_blind_full_enabled),
            discrepancy_percent_warn_threshold: Number(data.inventory_control_settings?.discrepancy_percent_warn_threshold ?? createDefaultInventoryControlSettings().discrepancy_percent_warn_threshold),
            discrepancy_percent_critical_threshold: Number(data.inventory_control_settings?.discrepancy_percent_critical_threshold ?? createDefaultInventoryControlSettings().discrepancy_percent_critical_threshold),
            discrepancy_value_warn_threshold: Number(data.inventory_control_settings?.discrepancy_value_warn_threshold ?? createDefaultInventoryControlSettings().discrepancy_value_warn_threshold),
            discrepancy_value_critical_threshold: Number(data.inventory_control_settings?.discrepancy_value_critical_threshold ?? createDefaultInventoryControlSettings().discrepancy_value_critical_threshold),
            escalation_variance_line_threshold: Number(data.inventory_control_settings?.escalation_variance_line_threshold ?? createDefaultInventoryControlSettings().escalation_variance_line_threshold),
            escalation_variance_value_threshold: Number(data.inventory_control_settings?.escalation_variance_value_threshold ?? createDefaultInventoryControlSettings().escalation_variance_value_threshold),
            close_block_on_critical_variance: Boolean(data.inventory_control_settings?.close_block_on_critical_variance ?? createDefaultInventoryControlSettings().close_block_on_critical_variance),
        },
    }), [createBranchShell]);

    const load = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            if (canManageBranchSettings) {
                const [branchData, taxes] = await Promise.all([branchApi.getBranch(id), setupApi.getTaxes()]);
                setBranch(normalizeBranch(branchData));
                setTaxOptions([
                    { value: '', label: 'No tax code selected' },
                    ...taxes.filter((tax: any) => tax.is_active).map((tax: any) => ({
                        value: tax.tax_code,
                        label: `${tax.tax_name} (${tax.tax_code})`,
                    })),
                ]);
            } else {
                const settingsData = await branchApi.getBranchInventoryControlSettings(id);
                setBranch(createBranchShell({
                    id: settingsData.branch_id,
                    branch_name: settingsData.branch_name,
                    branch_code: settingsData.branch_code,
                    inventory_control_settings: normalizeBranch({
                        inventory_control_settings: settingsData.inventory_control_settings,
                    }).inventory_control_settings,
                }));
                setTaxOptions([]);
                setActiveTab('operations');
            }
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load branch settings.');
        } finally {
            setIsLoading(false);
        }
    }, [canManageBranchSettings, createBranchShell, id, normalizeBranch]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const requestedTab = searchParams.get('tab');
        if (
            requestedTab === 'operations'
            || (canManageBranchSettings && (requestedTab === 'overview' || requestedTab === 'documents' || requestedTab === 'tax' || requestedTab === 'boundaries'))
        ) {
            setActiveTab(requestedTab);
        }
    }, [searchParams, canManageBranchSettings]);

    const save = async () => {
        if (!branch || !id) return;
        setIsSaving(true);
        try {
            await branchApi.updateBranch(id, {
                contact_person: optionalValue(branch.contact_person),
                phone: optionalValue(branch.phone),
                email: optionalValue(branch.email),
                tax_region: optionalValue(branch.tax_settings.default_tax_code || branch.tax_region) ?? null,
                inherit_client_currency: false,
                currency_code: optionalValue(branch.currency_code) || branch.effective_settings.currency_code,
                date_format: branch.date_format || branch.effective_settings.date_format,
                time_format: branch.time_format || branch.effective_settings.time_format,
                inherit_client_language: branch.inherit_client_language,
                language: branch.inherit_client_language ? undefined : optionalValue(branch.language),
                inherit_client_theme: branch.inherit_client_theme,
                theme_id: branch.inherit_client_theme ? undefined : optionalValue(branch.theme_id),
                modules_enabled: branch.modules_enabled,
                operating_hours: Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, {
                    is_open: branch.operating_hours[key].is_open,
                    open_time: branch.operating_hours[key].is_open ? optionalValue(branch.operating_hours[key].open_time) ?? null : null,
                    close_time: branch.operating_hours[key].is_open ? optionalValue(branch.operating_hours[key].close_time) ?? null : null,
                }])),
                document_settings: branch.document_settings,
                tax_settings: {
                    ...branch.tax_settings,
                    default_tax_code: optionalValue(branch.tax_settings.default_tax_code) ?? null,
                    dine_in_tax_code: optionalValue(branch.tax_settings.dine_in_tax_code) ?? null,
                    takeaway_tax_code: optionalValue(branch.tax_settings.takeaway_tax_code) ?? null,
                    delivery_tax_code: optionalValue(branch.tax_settings.delivery_tax_code) ?? null,
                },
                operational_settings: branch.operational_settings,
            });
            await load();
            updateStoredBranchCurrency(Number(id), {
                inheritClientCurrency: false,
                currencyCode: branch.currency_code || branch.effective_settings.currency_code,
            });
            toast.success('Settings Saved', 'Branch administration settings updated successfully.');
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save branch settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const saveInventoryControls = async () => {
        if (!branch || !id) return;
        setIsSavingInventory(true);
        try {
            await branchApi.updateBranchInventoryControlSettings(id, branch.inventory_control_settings);
            await load();
            toast.success('Settings Saved', 'Inventory control settings updated successfully.');
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save inventory control settings.');
        } finally {
            setIsSavingInventory(false);
        }
    };

    const changeStatus = async (status: BranchStatus) => {
        if (!id) return;
        try {
            await branchApi.updateBranchStatus(id, status);
            await load();
            toast.success('Branch Updated', `Branch marked ${formatLabel(status)}.`);
        } catch (error: any) {
            toast.error('Status Update Failed', error.message || 'Could not change branch status.');
        }
    };

    const updateDay = (day: Weekday, patch: Partial<BranchOperatingDay>) => setBranch((current) => current ? {
        ...current,
        operating_hours: { ...current.operating_hours, [day]: { ...current.operating_hours[day], ...patch } },
    } : current);

    const updateRule = (key: DocumentType, patch: Partial<BranchDocumentRule>) => setBranch((current) => current ? {
        ...current,
        document_settings: { ...current.document_settings, [key]: { ...current.document_settings[key], ...patch } },
    } : current);

    const toggleModule = (moduleId: string, enabled: boolean) => setBranch((current) => {
        if (!current) return current;
        const modules = new Set(current.modules_enabled || []);
        if (enabled) {
            modules.add(moduleId);
        } else {
            modules.delete(moduleId);
        }
        return { ...current, modules_enabled: Array.from(modules) };
    });

    const taxSetupGuidance = taxOptions.length > 1
        ? 'Choose an active tax code below, then save the branch.'
        : 'No active tax codes are available yet. Create one in Tax Configuration first.';

    const completedChecklist = [
        hasValue(branch?.tax_settings.default_tax_code) ? 'Default tax code selected' : null,
        Object.values(branch?.operating_hours || {}).some((day) => day.is_open) ? 'Operating hours configured' : null,
        (branch?.modules_enabled?.length || 0) > 0 ? 'Modules assigned' : null,
    ].filter(Boolean) as string[];

    const nextStep = branch?.readiness.blockers[0]
        ? branch.readiness.blockers[0]
        : 'This branch is ready for activation.';

    const tabs: Array<[TabKey, string, typeof Store]> = [
        ['overview', 'Overview', Store],
        ['operations', 'Operations', Settings2],
        ['documents', 'Documents', FileDigit],
        ['tax', 'Tax Settings', Wallet],
        ['boundaries', 'Boundaries', ShieldCheck],
    ];
    const visibleTabs = canManageBranchSettings ? tabs : tabs.filter(([key]) => key === 'operations');
    const pageTitle = canManageBranchSettings ? 'Branch Administration' : 'Inventory Control Settings';
    const saveAction = canManageBranchSettings ? save : saveInventoryControls;
    const saveLabel = canManageBranchSettings ? 'Save Settings' : 'Save Inventory Controls';
    const isSaveDisabled = !canManageBranchSettings && !canManageInventoryControls;
    const isSaveLoading = canManageBranchSettings ? isSaving : isSavingInventory;
    const previewAlertSound = (sound: KdsAlertSound) => {
        void playKdsAlert(sound, branch?.operational_settings.kds_alert_volume_level ?? 85);
    };

    if (isLoading || !branch) {
        return <div className={styles.loadingState}><Loader2 size={32} className="spinner" /></div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)}><ChevronLeft size={20} />Back to Branches</button>
                    <KitchenButton variant="primary" onClick={saveAction} isLoading={isSaveLoading} disabled={isSaveDisabled}><Save size={16} style={{ marginRight: 8 }} />{saveLabel}</KitchenButton>
                </div>
                <div className={styles.heroPanel}>
                    <div className={styles.titleSection}>
                        <div className={styles.iconBox}><Store size={24} /></div>
                        <div>
                            <h1>{pageTitle}</h1>
                            <p>{branch.branch_name} ({branch.branch_code})</p>
                        </div>
                    </div>
                    <div className={styles.heroMeta}>
                        <span className={`${styles.statusPill} ${getReadinessTone(branch.readiness.is_operationally_ready)}`}>
                            {branch.readiness.is_operationally_ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            {branch.readiness.is_operationally_ready ? 'Activation ready' : 'Needs setup'}
                        </span>
                        <span className={styles.statusPill}>{formatLabel(branch.status)}</span>
                        <span className={styles.statusPill}>{branch.operational_profile.branch_kind === 'central_store' ? 'Central Store' : 'Operational Branch'}</span>
                    </div>
                </div>
                <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                        <span className={styles.kpiLabel}>Setup Completion</span>
                        <strong>{branch.readiness.setup_completion_percent}%</strong>
                        <span className={styles.kpiHint}>Progress toward activation</span>
                    </div>
                    <div className={styles.kpiCard}>
                        <span className={styles.kpiLabel}>Current Blocker</span>
                        <strong>{branch.readiness.blockers.length}</strong>
                        <span className={styles.kpiHint}>{nextStep}</span>
                    </div>
                    <div className={styles.kpiCard}>
                        <span className={styles.kpiLabel}>Default Tax Code</span>
                        <strong>{branch.tax_settings.default_tax_code || 'Not set'}</strong>
                        <span className={styles.kpiHint}>{taxSetupGuidance}</span>
                    </div>
                    <div className={styles.kpiCard}>
                        <span className={styles.kpiLabel}>Modules Enabled</span>
                        <strong>{branch.modules_enabled?.length || 0}</strong>
                        <span className={styles.kpiHint}>Available to this branch</span>
                    </div>
                </div>
            </header>

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarIntro}>
                        <strong>{canManageBranchSettings ? 'Branch setup guide' : 'Inventory control guide'}</strong>
                        <span>{canManageBranchSettings ? 'Use these sections to complete configuration and prepare the branch for go-live.' : 'Use this section to manage blind count policy, variance thresholds, and close controls for this branch.'}</span>
                    </div>
                    {visibleTabs.map(([key, label, Icon]) => (
                        <button key={key} className={`${styles.navItem} ${activeTab === key ? styles.active : ''}`} onClick={() => setActiveTab(key)}>
                            <Icon size={18} />{label}
                        </button>
                    ))}
                </aside>

                <main className={styles.content}>
                    {activeTab === 'overview' && (
                        <div className={styles.stack}>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <CheckCircle2 size={20} className={styles.cardIcon} />
                                    <div>
                                        <h3>What To Do Next</h3>
                                        <p>Focus on the items below to get this branch ready for activation.</p>
                                    </div>
                                </div>
                                <div className={styles.stepGrid}>
                                    <div className={styles.stepCard}>
                                        <span className={styles.stepNumber}>1</span>
                                        <div>
                                            <strong>Review blockers</strong>
                                            <p>{nextStep}</p>
                                        </div>
                                    </div>
                                    <div className={styles.stepCard}>
                                        <span className={styles.stepNumber}>2</span>
                                        <div>
                                            <strong>Finish key settings</strong>
                                            <p>{completedChecklist.length > 0 ? completedChecklist.join(' / ') : 'Core setup items still need attention.'}</p>
                                        </div>
                                    </div>
                                    <div className={styles.stepCard}>
                                        <span className={styles.stepNumber}>3</span>
                                        <div>
                                            <strong>Activate when ready</strong>
                                            <p>Use the activation button once all blockers are cleared.</p>
                                        </div>
                                    </div>
                                </div>
                            </KitchenCard>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}><Globe size={20} className={styles.cardIcon} /><div><h3>Readiness</h3><p>Branch activation remains backend-validated.</p></div></div>
                                <div className={styles.summaryGrid}>
                                    <div className={styles.infoTile}><span className={styles.infoLabel}>Status</span><strong>{formatLabel(branch.status)}</strong></div>
                                    <div className={styles.infoTile}><span className={styles.infoLabel}>Setup completion</span><strong>{branch.readiness.setup_completion_percent}%</strong></div>
                                    <div className={styles.infoTile}><span className={styles.infoLabel}>Branch role</span><strong>{branch.operational_profile.branch_kind === 'central_store' ? 'Central Store' : 'Operational Branch'}</strong></div>
                                    <div className={styles.infoTile}><span className={styles.infoLabel}>Writes</span><strong>{branch.operational_profile.writes_allowed ? 'Enabled' : 'Locked'}</strong></div>
                                </div>
                                <div className={styles.lifecycleRow}>
                                    <KitchenButton variant="ghost" onClick={() => changeStatus('setup_pending')} disabled={branch.status === 'setup_pending'}>Setup Pending</KitchenButton>
                                    <KitchenButton variant="secondary" onClick={() => changeStatus('active')} disabled={branch.status === 'active'}>Activate</KitchenButton>
                                    <KitchenButton variant="ghost" onClick={() => changeStatus('inactive')} disabled={branch.status === 'inactive'}>Inactive</KitchenButton>
                                    <KitchenButton variant="ghost" onClick={() => changeStatus('suspended')} disabled={branch.status === 'suspended'}>Suspend</KitchenButton>
                                </div>
                            </KitchenCard>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}><AlertTriangle size={20} className={styles.cardIcon} /><div><h3>Blockers</h3><p>These checks must pass before go-live.</p></div></div>
                                <div className={styles.blockerList}>
                                    {branch.readiness.blockers.length === 0
                                        ? <div className={styles.goodState}>This branch currently meets the readiness rules for activation.</div>
                                        : branch.readiness.blockers.map((blocker) => <div key={blocker} className={styles.blockerItem}><AlertTriangle size={14} /><span>{blocker}</span></div>)}
                                </div>
                            </KitchenCard>
                        </div>
                    )}

                    {activeTab === 'operations' && (
                        <div className={styles.stack}>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}><Settings2 size={20} className={styles.cardIcon} /><div><h3>Operating Hours</h3><p>Weekly branch schedule used for readiness and administration.</p></div></div>
                                <div className={styles.scheduleGrid}>
                                    {WEEK_DAYS.map(({ key, label }) => (
                                        <div key={key} className={styles.scheduleRow}>
                                            <label className={styles.checkboxRow}><input type="checkbox" checked={branch.operating_hours[key].is_open} onChange={(event) => updateDay(key, { is_open: event.target.checked, open_time: event.target.checked ? branch.operating_hours[key].open_time || '09:00' : '', close_time: event.target.checked ? branch.operating_hours[key].close_time || '22:00' : '' })} /><span>{label}</span></label>
                                            <KitchenInput label="Open" type="time" value={branch.operating_hours[key].open_time || ''} disabled={!branch.operating_hours[key].is_open} onChange={(event) => updateDay(key, { open_time: event.target.value })} />
                                            <KitchenInput label="Close" type="time" value={branch.operating_hours[key].close_time || ''} disabled={!branch.operating_hours[key].is_open} onChange={(event) => updateDay(key, { close_time: event.target.value })} />
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>
                            <div className={styles.splitGrid}>
                                <KitchenCard className={styles.card}>
                                    <div className={styles.cardHeader}><Settings2 size={20} className={styles.cardIcon} /><div><h3>Operational Defaults</h3></div></div>
                                    <div className={styles.formGrid}>
                                        <KitchenSelect label="Default order type" value={branch.operational_settings.default_order_type} onChange={(event) => setBranch({ ...branch, operational_settings: { ...branch.operational_settings, default_order_type: event.target.value as BranchOperationalSettings['default_order_type'] } })} options={[{ value: 'dine_in', label: 'Dine In' }, { value: 'takeout', label: 'Takeout' }, { value: 'delivery', label: 'Delivery' }]} />
                                        <KitchenInput label="Business day cutoff" type="time" value={branch.operational_settings.business_day_cutoff_time} onChange={(event) => setBranch({ ...branch, operational_settings: { ...branch.operational_settings, business_day_cutoff_time: event.target.value } })} />
                                        <KitchenInput label="Line item cancel / reduce limit (min)" type="number" min={0} value={String(branch.operational_settings.line_item_cancel_reduce_limit_minutes ?? 5)} onChange={(event) => setBranch({ ...branch, operational_settings: { ...branch.operational_settings, line_item_cancel_reduce_limit_minutes: Number(event.target.value || 0), item_edit_lock_minutes: Number(event.target.value || 0), item_cancellation_window_minutes: Number(event.target.value || 0) } })} />
                                        <KitchenInput label="Order cancel window (min)" type="number" min={0} value={String(branch.operational_settings.order_cancellation_window_minutes ?? 5)} onChange={(event) => setBranch({ ...branch, operational_settings: { ...branch.operational_settings, order_cancellation_window_minutes: Number(event.target.value || 0) } })} />
                                    </div>
                                    <div className={styles.toggleGrid}>
                                        {([
                                            ['require_open_shift', 'Require open shift'],
                                            ['require_sale_counter', 'Require sale counter'],
                                            ['floor_service_enabled', 'Enable floor service'],
                                            ['pickup_enabled', 'Enable pickup'],
                                            ['delivery_enabled', 'Enable delivery'],
                                            ['auto_assign_tables', 'Auto assign tables'],
                                        ] as Array<[keyof BranchOperationalSettings, string]>).map(([key, label]) => (
                                            <label key={key} className={styles.toggleTile}><input type="checkbox" checked={Boolean(branch.operational_settings[key])} onChange={(event) => setBranch({ ...branch, operational_settings: { ...branch.operational_settings, [key]: event.target.checked } })} /><span>{label}</span></label>
                                        ))}
                                    </div>
                                </KitchenCard>
                                <KitchenCard className={styles.card}>
                                    <div className={styles.cardHeader}><Bell size={20} className={styles.cardIcon} /><div><h3>KDS Alerts</h3><p>Choose separate sounds for brand-new orders and changed kitchen tickets.</p></div></div>
                                    <div className={styles.kdsAlertGrid}>
                                        <div className={styles.kdsAlertSetting}>
                                            <KitchenSelect
                                                label="New order alert"
                                                value={branch.operational_settings.kds_new_order_alert_sound}
                                                onChange={(event) => {
                                                    const sound = event.target.value as BranchOperationalSettings['kds_new_order_alert_sound'];
                                                    setBranch({ ...branch, operational_settings: { ...branch.operational_settings, kds_new_order_alert_sound: sound } });
                                                    previewAlertSound(sound);
                                                }}
                                                options={KDS_ALERT_SOUND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                            />
                                            <div className={styles.kdsAlertMetaRow}>
                                                <span className={styles.kdsAlertLabel}>Current: {getKdsAlertSoundLabel(branch.operational_settings.kds_new_order_alert_sound)}</span>
                                                <KitchenButton variant="ghost" size="sm" onClick={() => previewAlertSound(branch.operational_settings.kds_new_order_alert_sound)} title="Play alert">
                                                    <Play size={14} />
                                                </KitchenButton>
                                            </div>
                                        </div>
                                        <div className={styles.kdsAlertSetting}>
                                            <KitchenSelect
                                                label="Changed order alert"
                                                value={branch.operational_settings.kds_order_change_alert_sound}
                                                onChange={(event) => {
                                                    const sound = event.target.value as BranchOperationalSettings['kds_order_change_alert_sound'];
                                                    setBranch({ ...branch, operational_settings: { ...branch.operational_settings, kds_order_change_alert_sound: sound } });
                                                    previewAlertSound(sound);
                                                }}
                                                options={KDS_ALERT_SOUND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                            />
                                            <div className={styles.kdsAlertMetaRow}>
                                                <span className={styles.kdsAlertLabel}>Current: {getKdsAlertSoundLabel(branch.operational_settings.kds_order_change_alert_sound)}</span>
                                                <KitchenButton variant="ghost" size="sm" onClick={() => previewAlertSound(branch.operational_settings.kds_order_change_alert_sound)} title="Play alert">
                                                    <Play size={14} />
                                                </KitchenButton>
                                            </div>
                                        </div>
                                        <div className={`${styles.kdsAlertSetting} ${styles.kdsAlertVolumeSetting}`}>
                                            <label className={styles.kdsAlertVolumeHeader}>
                                                <span>Alert volume level</span>
                                                <span className={styles.kdsAlertVolumeValue}>{branch.operational_settings.kds_alert_volume_level}%</span>
                                            </label>
                                            <div className={styles.kdsAlertVolumeControls}>
                                                <input
                                                    className={styles.kdsAlertVolumeSlider}
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={branch.operational_settings.kds_alert_volume_level ?? 85}
                                                    onChange={(event) => setBranch({
                                                        ...branch,
                                                        operational_settings: {
                                                            ...branch.operational_settings,
                                                            kds_alert_volume_level: Math.min(Math.max(Number(event.target.value || 0), 0), 100),
                                                        },
                                                    })}
                                                />
                                                <KitchenInput
                                                    label=""
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={String(branch.operational_settings.kds_alert_volume_level ?? 85)}
                                                    onChange={(event) => setBranch({
                                                        ...branch,
                                                        operational_settings: {
                                                            ...branch.operational_settings,
                                                            kds_alert_volume_level: Math.min(Math.max(Number(event.target.value || 0), 0), 100),
                                                        },
                                                    })}
                                                    containerClassName={styles.kdsAlertVolumeNumber}
                                                />
                                            </div>
                                            <div className={styles.kdsAlertMetaRow}>
                                                <span className={styles.kdsAlertLabel}>Volume: {branch.operational_settings.kds_alert_volume_level}%</span>
                                                <KitchenButton variant="ghost" size="sm" onClick={() => previewAlertSound(branch.operational_settings.kds_new_order_alert_sound)} title="Play alert">
                                                    <Play size={14} />
                                                </KitchenButton>
                                            </div>
                                        </div>
                                    </div>
                                </KitchenCard>
                                <KitchenCard className={styles.card}>
                                    <div className={styles.cardHeader}><ShieldCheck size={20} className={styles.cardIcon} /><div><h3>Modules</h3></div></div>
                                    <div className={styles.moduleGrid}>
                                        {MODULE_OPTIONS.map((moduleId) => <label key={moduleId} className={styles.moduleTile}><input type="checkbox" checked={branch.modules_enabled?.includes(moduleId) ?? false} onChange={(event) => toggleModule(moduleId, event.target.checked)} /><span>{moduleId}</span></label>)}
                                    </div>
                                </KitchenCard>
                                <KitchenCard className={styles.card}>
                                    <div className={styles.cardHeader}><ClipboardList size={20} className={styles.cardIcon} /><div><h3>Blind Inventory Control</h3><p>Configure surprise counts, end-of-day blind closes, and monthly full verification.</p></div></div>
                                    <div className={styles.formGrid}>
                                        <KitchenSelect
                                            label="Random blind frequency"
                                            value={branch.inventory_control_settings.blind_random_frequency}
                                            onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, blind_random_frequency: event.target.value as CountFrequency } })}
                                            options={[
                                                { value: 'daily', label: 'Daily' },
                                                { value: 'alternate_day', label: 'Alternate Day' },
                                                { value: 'weekly', label: 'Weekly' },
                                            ]}
                                        />
                                        <KitchenInput label="Random blind sample size" type="number" min={1} value={String(branch.inventory_control_settings.blind_random_sample_size)} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, blind_random_sample_size: Number(event.target.value || 1) } })} />
                                        <KitchenInput label="EOD blind sample size" type="number" min={1} value={String(branch.inventory_control_settings.end_of_day_sample_size)} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, end_of_day_sample_size: Number(event.target.value || 1) } })} />
                                        <KitchenInput label="Warn threshold (%)" type="number" min={0} value={String(branch.inventory_control_settings.discrepancy_percent_warn_threshold)} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, discrepancy_percent_warn_threshold: Number(event.target.value || 0) } })} />
                                        <KitchenInput label="Critical threshold (%)" type="number" min={0} value={String(branch.inventory_control_settings.discrepancy_percent_critical_threshold)} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, discrepancy_percent_critical_threshold: Number(event.target.value || 0) } })} />
                                        <KitchenInput label="Escalation value threshold" type="number" min={0} value={String(branch.inventory_control_settings.escalation_variance_value_threshold)} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, escalation_variance_value_threshold: Number(event.target.value || 0) } })} />
                                    </div>
                                    <div className={styles.toggleGrid}>
                                        {([
                                            ['blind_random_enabled', 'Enable random blind counts'],
                                            ['end_of_day_blind_enabled', 'Enable EOD blind close'],
                                            ['monthly_blind_full_enabled', 'Require monthly full blind verification'],
                                            ['close_block_on_critical_variance', 'Block close on critical blind variance'],
                                        ] as Array<[keyof BranchInventoryControlSettings, string]>).map(([key, label]) => (
                                            <label key={key} className={styles.toggleTile}><input type="checkbox" checked={Boolean(branch.inventory_control_settings[key])} onChange={(event) => setBranch({ ...branch, inventory_control_settings: { ...branch.inventory_control_settings, [key]: event.target.checked } })} /><span>{label}</span></label>
                                        ))}
                                    </div>
                                    {!canManageBranchSettings && canManageInventoryControls ? (
                                        <div className={styles.inlineToggleRow}>
                                            <KitchenButton variant="primary" onClick={saveInventoryControls} isLoading={isSavingInventory}>
                                                <Save size={16} style={{ marginRight: 8 }} />
                                                Save Inventory Controls
                                            </KitchenButton>
                                        </div>
                                    ) : null}
                                </KitchenCard>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}><FileDigit size={20} className={styles.cardIcon} /><div><h3>Document Numbering Rules</h3></div></div>
                            <div className={styles.documentGrid}>
                                {DOCUMENT_FIELDS.map(({ key, label }) => {
                                    const rule = branch.document_settings[key];
                                    return (
                                        <div key={key} className={styles.documentCard}>
                                            <strong>{label}</strong>
                                            <div className={styles.formGrid}>
                                                <KitchenInput label="Prefix" value={rule.prefix} onChange={(event) => updateRule(key, { prefix: event.target.value.toUpperCase() })} />
                                                <KitchenInput label="Zero pad" type="number" min={2} max={8} value={String(rule.zero_pad)} onChange={(event) => updateRule(key, { zero_pad: Number(event.target.value || 4) })} />
                                                <KitchenSelect label="Reset" value={rule.reset_frequency} onChange={(event) => updateRule(key, { reset_frequency: event.target.value as ResetFrequency })} options={[{ value: 'never', label: 'Never' }, { value: 'manual', label: 'Manual' }, { value: 'business_day', label: 'Business day' }, { value: 'calendar_day', label: 'Calendar day' }, { value: 'monthly', label: 'Monthly' }, { value: 'annually', label: 'Annually' }]} />
                                            </div>
                                            <div className={styles.inlineToggleRow}>
                                                <label className={styles.checkboxRow}><input type="checkbox" checked={rule.include_branch_code} onChange={(event) => updateRule(key, { include_branch_code: event.target.checked })} /><span>Include branch code</span></label>
                                                <label className={styles.checkboxRow}><input type="checkbox" checked={rule.include_counter_code} onChange={(event) => updateRule(key, { include_counter_code: event.target.checked })} /><span>Include counter code</span></label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </KitchenCard>
                    )}

                    {activeTab === 'tax' && (
                        <div className={`${styles.splitGrid} ${styles.taxTabLayout}`}>
                            <KitchenCard className={`${styles.card} ${styles.taxPrimaryCard}`}>
                                <div className={styles.cardHeader}><Wallet size={20} className={styles.cardIcon} /><div><h3>Tax Settings</h3><p>Select the default tax code required before this branch can be activated.</p></div></div>
                                <div className={`${styles.noticePanel} ${styles.taxNoticePanel}`}>
                                    <div>
                                        <strong>Where does the default tax code come from?</strong>
                                        <p>Tax codes are created in Tax Configuration. Once a tax code is active there, it appears in the list on this page for selection.</p>
                                    </div>
                                    <div className={styles.noticeAction}>
                                        <KitchenButton variant="secondary" size="sm" className={styles.noticeButton} onClick={() => navigate('/console/admin/taxes')}>
                                            Open Tax Configuration
                                            <ArrowRight size={14} />
                                        </KitchenButton>
                                    </div>
                                </div>
                                <div className={`${styles.formGrid} ${styles.taxFormGrid}`}>
                                    <KitchenSelect label="Default tax code" value={branch.tax_settings.default_tax_code || ''} onChange={(event) => setBranch({ ...branch, tax_region: event.target.value || null, tax_settings: { ...branch.tax_settings, default_tax_code: event.target.value || null } })} options={taxOptions} />
                                    <KitchenSelect label="Dine in tax" value={branch.tax_settings.dine_in_tax_code || ''} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, dine_in_tax_code: event.target.value || null } })} options={taxOptions} />
                                    <KitchenSelect label="Takeout tax" value={branch.tax_settings.takeaway_tax_code || ''} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, takeaway_tax_code: event.target.value || null } })} options={taxOptions} />
                                    <KitchenSelect label="Delivery tax" value={branch.tax_settings.delivery_tax_code || ''} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, delivery_tax_code: event.target.value || null } })} options={taxOptions} />
                                    <KitchenSelect label="Tax rounding" value={branch.tax_settings.tax_rounding_method} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, tax_rounding_method: event.target.value as BranchTaxSettings['tax_rounding_method'] } })} options={[{ value: 'nearest', label: 'Nearest' }, { value: 'up', label: 'Round Up' }, { value: 'down', label: 'Round Down' }]} />
                                </div>
                                <div className={`${styles.toggleGrid} ${styles.taxToggleGrid}`}>
                                    <label className={styles.toggleTile}><input type="checkbox" checked={branch.tax_settings.prices_include_tax} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, prices_include_tax: event.target.checked } })} /><span>Prices include tax</span></label>
                                    <label className={styles.toggleTile}><input type="checkbox" checked={branch.tax_settings.allow_tax_exemption} onChange={(event) => setBranch({ ...branch, tax_settings: { ...branch.tax_settings, allow_tax_exemption: event.target.checked } })} /><span>Allow tax exemptions</span></label>
                                </div>
                            </KitchenCard>
                            <KitchenCard className={`${styles.card} ${styles.taxSummaryCard}`}>
                                <div className={styles.cardHeader}><ShieldCheck size={20} className={styles.cardIcon} /><div><h3>Tax Summary</h3></div></div>
                                <div className={`${styles.infoList} ${styles.taxSummaryList}`}>
                                    <div className={`${styles.infoRow} ${styles.taxInfoRow}`}><span>Legacy tax region</span><strong>{branch.tax_region || 'Not set'}</strong></div>
                                    <div className={`${styles.infoRow} ${styles.taxInfoRow} ${hasValue(branch.tax_settings.default_tax_code) ? styles.taxInfoAccent : styles.taxInfoWarning}`}><span>Default tax code</span><strong>{branch.tax_settings.default_tax_code || 'Not set'}</strong></div>
                                    <div className={`${styles.infoRow} ${styles.taxInfoRow}`}><span>Prices include tax</span><strong>{branch.tax_settings.prices_include_tax ? 'Yes' : 'No'}</strong></div>
                                    <div className={`${styles.infoRow} ${styles.taxInfoRow}`}><span>Rounding method</span><strong>{formatLabel(branch.tax_settings.tax_rounding_method)}</strong></div>
                                </div>
                                <div className={styles.taxChecklist}>
                                    <div className={styles.checklistItem}>
                                        <span className={hasValue(branch.tax_settings.default_tax_code) ? styles.checkOn : styles.checkOff} />
                                        <span>Default tax code selected</span>
                                    </div>
                                    <div className={styles.checklistItem}>
                                        <span className={taxOptions.length > 1 ? styles.checkOn : styles.checkOff} />
                                        <span>At least one active tax code available</span>
                                    </div>
                                </div>
                            </KitchenCard>
                        </div>
                    )}

                    {activeTab === 'boundaries' && (
                        <div className={styles.splitGrid}>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}><Globe size={20} className={styles.cardIcon} /><div><h3>Inheritance Overrides</h3></div></div>
                                <div className={styles.formStack}>
                                    <KitchenSelect label="Branch currency" value={branch.currency_code || branch.effective_settings.currency_code} onChange={(event) => setBranch({ ...branch, inherit_client_currency: false, currency_code: event.target.value.toUpperCase() })} options={CURRENCY_OPTIONS.map((currency) => ({ value: currency, label: currency }))} />
                                    <KitchenSelect label="Date format" value={branch.date_format || branch.effective_settings.date_format} onChange={(event) => setBranch({ ...branch, date_format: event.target.value as DateFormatOption })} options={DATE_FORMAT_OPTIONS} />
                                    <KitchenSelect label="Time format" value={branch.time_format || branch.effective_settings.time_format} onChange={(event) => setBranch({ ...branch, time_format: event.target.value as TimeFormatOption })} options={TIME_FORMAT_OPTIONS} />
                                    <label className={styles.checkboxRow}><input type="checkbox" checked={branch.inherit_client_language} onChange={(event) => setBranch({ ...branch, inherit_client_language: event.target.checked })} /><span>Inherit language from client</span></label>
                                    <KitchenInput label="Language override" value={branch.language || ''} disabled={branch.inherit_client_language} onChange={(event) => setBranch({ ...branch, language: event.target.value })} />
                                    <label className={styles.checkboxRow}><input type="checkbox" checked={branch.inherit_client_theme} onChange={(event) => setBranch({ ...branch, inherit_client_theme: event.target.checked })} /><span>Inherit theme from client</span></label>
                                    <KitchenInput label="Theme override" value={branch.theme_id || ''} disabled={branch.inherit_client_theme} onChange={(event) => setBranch({ ...branch, theme_id: event.target.value })} />
                                </div>
                            </KitchenCard>
                            <KitchenCard className={styles.card}>
                                <div className={styles.cardHeader}><ShieldCheck size={20} className={styles.cardIcon} /><div><h3>Boundary Summary</h3></div></div>
                                <div className={styles.infoList}>
                                    <div className={styles.infoRow}><span>Resolution order</span><strong>{branch.effective_settings.resolution_order.map(formatLabel).join(' -> ')}</strong></div>
                                    <div className={styles.infoRow}><span>Client defaults</span><strong>{formatList(branch.config_boundary.client_defaults)}</strong></div>
                                    <div className={styles.infoRow}><span>Locked</span><strong>{formatList(branch.config_boundary.locked)}</strong></div>
                                    <div className={styles.infoRow}><span>Inherited</span><strong>{formatList(branch.config_boundary.inherited)}</strong></div>
                                    <div className={styles.infoRow}><span>Overridable</span><strong>{formatList(branch.config_boundary.overridable)}</strong></div>
                                    <div className={styles.infoRow}><span>Branch scope enforcement</span><strong>{branch.oversight.branch_scope_enforced ? 'Enabled' : 'Disabled'}</strong></div>
                                </div>
                            </KitchenCard>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

