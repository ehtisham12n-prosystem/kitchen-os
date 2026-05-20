/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImagePlus, Monitor, Receipt, Save, Settings2, Sparkles, Store } from 'lucide-react';
import { apiAssetUrl, platformApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import styles from './ClientBrandingSettings.module.css';

type PaperSize = 'thermal-80mm' | 'a6' | 'a5' | 'a4';
type ChangePrintMode = 'change_only' | 'full_snapshot' | 'both';
type ResetFrequency = 'never' | 'manual' | 'business_day' | 'calendar_day' | 'monthly' | 'annually';
type DateSegmentFormat = 'none' | 'YYMM' | 'YYMMDD';
type NumberingRuleKey =
    | 'purchase_order'
    | 'procurement_request'
    | 'goods_receipt_note'
    | 'pos_order'
    | 'pos_receipt'
    | 'pos_kot'
    | 'payment_voucher'
    | 'expense_voucher'
    | 'compensation_voucher';

type NumberingRule = {
    prefix: string;
    zero_pad: number;
    reset_frequency: ResetFrequency;
    include_branch_code: boolean;
    include_counter_code: boolean;
    date_segment_format: DateSegmentFormat;
    manual_reset_at?: string | null;
};

type NumberingSettings = {
    client_id_format: 'CL####';
    branch_code_prefix: string;
    branch_code_zero_pad: number;
    employee_code_prefix: string;
    employee_code_zero_pad: number;
    customer_code_prefix: string;
    customer_code_zero_pad: number;
    offline_order_format: string;
    offline_kot_format: string;
    rules: Record<NumberingRuleKey, NumberingRule>;
};

type BrandingState = {
    full_logo_url: string | null;
    short_logo_url: string | null;
    login_background_url: string | null;
    receipt_business_name: string;
    receipt_footer_message_1: string;
    receipt_footer_message_2: string;
    show_receipt_full_logo: boolean;
    show_receipt_short_logo: boolean;
    show_receipt_business_name: boolean;
    show_receipt_branch_name: boolean;
    show_receipt_branch_address: boolean;
    show_receipt_contact_number: boolean;
    show_receipt_footer_message_1: boolean;
    show_receipt_footer_message_2: boolean;
    show_kot_full_logo: boolean;
    show_kot_short_logo: boolean;
    show_kot_business_name: boolean;
    show_kot_branch_name: boolean;
    show_kot_branch_address: boolean;
    show_kot_contact_number: boolean;
    show_kot_footer_message_1: boolean;
    show_kot_footer_message_2: boolean;
    show_login_full_logo: boolean;
    show_login_business_name: boolean;
    show_login_branch_name: boolean;
    show_header_short_logo: boolean;
    receipt_paper_size: PaperSize;
    invoice_paper_size: PaperSize;
    kot_paper_size: PaperSize;
    report_paper_size: PaperSize;
    receipt_print_copies: number;
    invoice_print_copies: number;
    kot_print_copies: number;
    kot_print_enabled: boolean;
    report_print_copies: number;
    order_change_print_mode: ChangePrintMode;
    order_change_print_copies: number;
    enable_station_wise_kot_printing: boolean;
    allow_multiple_kot_per_station: boolean;
    service_station_print_copies: Record<string, number>;
    station_printer_mapping: Record<string, string>;
    separate_kot_stations: string[];
    client_name?: string;
    primary_branch?: {
        id: number;
        branch_name: string;
        address: string | null;
        phone: string | null;
    } | null;
    numbering_settings: NumberingSettings;
};

const EMPTY_STATE: BrandingState = {
    full_logo_url: null,
    short_logo_url: null,
    login_background_url: null,
    receipt_business_name: '',
    receipt_footer_message_1: '',
    receipt_footer_message_2: '',
    show_receipt_full_logo: true,
    show_receipt_short_logo: false,
    show_receipt_business_name: true,
    show_receipt_branch_name: true,
    show_receipt_branch_address: true,
    show_receipt_contact_number: true,
    show_receipt_footer_message_1: true,
    show_receipt_footer_message_2: false,
    show_kot_full_logo: false,
    show_kot_short_logo: false,
    show_kot_business_name: true,
    show_kot_branch_name: true,
    show_kot_branch_address: false,
    show_kot_contact_number: false,
    show_kot_footer_message_1: false,
    show_kot_footer_message_2: false,
    show_login_full_logo: true,
    show_login_business_name: true,
    show_login_branch_name: true,
    show_header_short_logo: true,
    receipt_paper_size: 'thermal-80mm',
    invoice_paper_size: 'a4',
    kot_paper_size: 'thermal-80mm',
    report_paper_size: 'a4',
    receipt_print_copies: 1,
    invoice_print_copies: 1,
    kot_print_copies: 1,
    kot_print_enabled: true,
    report_print_copies: 1,
    order_change_print_mode: 'change_only',
    order_change_print_copies: 1,
    enable_station_wise_kot_printing: false,
    allow_multiple_kot_per_station: false,
    service_station_print_copies: {},
    station_printer_mapping: {},
    separate_kot_stations: [],
    client_name: '',
    primary_branch: null,
    numbering_settings: {
        client_id_format: 'CL####',
        branch_code_prefix: 'BR',
        branch_code_zero_pad: 3,
        employee_code_prefix: 'EMP',
        employee_code_zero_pad: 4,
        customer_code_prefix: 'CUS',
        customer_code_zero_pad: 6,
        offline_order_format: 'ORD-KOS-BR001-T01-MMDD-0042',
        offline_kot_format: 'KOT-BR001-COUNTERID-0235',
        rules: {
            purchase_order: { prefix: 'PO', zero_pad: 4, reset_frequency: 'annually', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMMDD', manual_reset_at: null },
            procurement_request: { prefix: 'PR', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMM', manual_reset_at: null },
            goods_receipt_note: { prefix: 'GRN', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMM', manual_reset_at: null },
            pos_order: { prefix: 'ORD', zero_pad: 4, reset_frequency: 'annually', include_branch_code: true, include_counter_code: true, date_segment_format: 'none', manual_reset_at: null },
            pos_receipt: { prefix: 'RCPT', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMMDD', manual_reset_at: null },
            pos_kot: { prefix: 'KOT', zero_pad: 4, reset_frequency: 'never', include_branch_code: false, include_counter_code: true, date_segment_format: 'none', manual_reset_at: null },
            payment_voucher: { prefix: 'PV', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMM', manual_reset_at: null },
            expense_voucher: { prefix: 'EV', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMM', manual_reset_at: null },
            compensation_voucher: { prefix: 'CV', zero_pad: 4, reset_frequency: 'monthly', include_branch_code: true, include_counter_code: false, date_segment_format: 'YYMM', manual_reset_at: null },
        },
    },
};

const PAPER_OPTIONS: Array<{ value: PaperSize; label: string; hint: string }> = [
    { value: 'thermal-80mm', label: '80mm Thermal', hint: 'Counters and small printers' },
    { value: 'a6', label: 'A6', hint: 'Compact handheld format' },
    { value: 'a5', label: 'A5', hint: 'Half-page kitchen/report layout' },
    { value: 'a4', label: 'A4', hint: 'Full-page report and invoice layout' },
];

const CHANGE_MODE_OPTIONS: Array<{ value: ChangePrintMode; label: string; hint: string }> = [
    { value: 'change_only', label: 'Change Only', hint: 'Print only changed items' },
    { value: 'full_snapshot', label: 'Full Snapshot', hint: 'Print full KOT after a change' },
    { value: 'both', label: 'Both', hint: 'Print change slip and full snapshot' },
];

const NUMBERING_RULES: Array<{ key: NumberingRuleKey; label: string; example: string }> = [
    { key: 'pos_order', label: 'POS Order', example: 'ORD-BR001-T01-0001' },
    { key: 'pos_receipt', label: 'Receipt', example: 'RCPT-BR001-250409-0001' },
    { key: 'pos_kot', label: 'KOT', example: 'KOT-T01-0001' },
    { key: 'purchase_order', label: 'Purchase Order', example: 'PO-BR001-250409-0001' },
    { key: 'procurement_request', label: 'Procurement Request', example: 'PR-BR001-2504-0001' },
    { key: 'goods_receipt_note', label: 'GRN', example: 'GRN-BR001-2504-0001' },
    { key: 'payment_voucher', label: 'Payment Voucher', example: 'PV-BR001-2504-0001' },
    { key: 'expense_voucher', label: 'Expense Voucher', example: 'EV-BR001-2504-0001' },
    { key: 'compensation_voucher', label: 'Compensation Voucher', example: 'CV-BR001-2504-0001' },
];

const SAMPLE_BRANCH_SEQUENCE = 1;
const SAMPLE_COUNTER_CODE = 'T01';
const SAMPLE_SEQUENCES = {
    document: 1,
    offlineOrder: 42,
    offlineKot: 235,
} as const;

function getSampleDateSegment(format: DateSegmentFormat): string {
    if (format === 'YYMMDD') return '250411';
    if (format === 'YYMM') return '2504';
    return '';
}

function buildNumberingPreview(
    rule: NumberingRule,
    branchCode: string,
    counterCode = SAMPLE_COUNTER_CODE,
    sequence = SAMPLE_SEQUENCES.document,
): string {
    const parts = [rule.prefix];
    if (rule.include_branch_code) parts.push(branchCode);
    if (rule.include_counter_code) parts.push(counterCode);
    const dateSegment = getSampleDateSegment(rule.date_segment_format);
    if (dateSegment) parts.push(dateSegment);
    parts.push(String(sequence).padStart(rule.zero_pad, '0'));
    return parts.filter(Boolean).join('-');
}

type AssetKey = 'full_logo' | 'short_logo' | 'login_background';

function ToggleCard({ checked, label, hint, onChange }: { checked: boolean; label: string; hint: string; onChange: (next: boolean) => void }) {
    return (
        <label className={`${styles.toggleCard} ${checked ? styles.toggleCardActive : ''}`}>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            <div className={styles.toggleBody}>
                <div className={styles.toggleTopRow}>
                    <span className={styles.toggleLabel}>{label}</span>
                    <span className={styles.togglePill}>{checked ? 'On' : 'Off'}</span>
                </div>
                <span className={styles.toggleHint}>{hint}</span>
            </div>
        </label>
    );
}

function MetricPill({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.metricPill}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function AssetCard({ title, hint, assetUrl, uploading, icon, onUpload }: { title: string; hint: string; assetUrl: string | null; uploading: boolean; icon: React.ReactNode; onUpload: () => void }) {
    return (
        <div className={styles.assetCard}>
            <div className={styles.assetVisual}>
                {assetUrl ? <img src={apiAssetUrl(assetUrl)} alt={title} /> : icon}
            </div>
            <div className={styles.assetCopy}>
                <strong>{title}</strong>
                <span>{hint}</span>
            </div>
            <KitchenButton variant="secondary" isLoading={uploading} onClick={onUpload}>Upload</KitchenButton>
        </div>
    );
}

export function ClientBrandingSettings() {
    const navigate = useNavigate();
    const userContext = readStoredUserContext();
    const clientId = userContext?.client_id ? String(userContext.client_id) : '';
    const [branding, setBranding] = useState<BrandingState>(EMPTY_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAsset, setUploadingAsset] = useState<AssetKey | null>(null);
    const [newStationName, setNewStationName] = useState('');
    const [newStationPrinter, setNewStationPrinter] = useState('');
    const fullLogoInputRef = useRef<HTMLInputElement | null>(null);
    const shortLogoInputRef = useRef<HTMLInputElement | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement | null>(null);

    const load = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const data = await platformApi.getClientBranding(clientId);
            setBranding({
                ...EMPTY_STATE,
                ...data,
                receipt_business_name: data?.receipt_business_name || '',
                receipt_footer_message_1: data?.receipt_footer_message_1 || '',
                receipt_footer_message_2: data?.receipt_footer_message_2 || '',
                numbering_settings: data?.numbering_settings || EMPTY_STATE.numbering_settings,
            });
        } catch (error: any) {
            toast.error('Branding Load Failed', error.message || 'Could not load client branding settings.');
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        void load();
    }, [load]);

    const setField = <K extends keyof BrandingState>(key: K, value: BrandingState[K]) => {
        setBranding((current) => ({ ...current, [key]: value }));
    };

    const handleUpload = async (assetKey: AssetKey, file?: File | null) => {
        if (!clientId || !file) return;
        setUploadingAsset(assetKey);
        try {
            const data = await platformApi.uploadClientBrandingAsset(clientId, assetKey, file);
            setBranding((current) => ({
                ...current,
                ...data,
                receipt_business_name: data?.receipt_business_name || current.receipt_business_name,
                receipt_footer_message_1: data?.receipt_footer_message_1 || current.receipt_footer_message_1,
                receipt_footer_message_2: data?.receipt_footer_message_2 || current.receipt_footer_message_2,
            }));
            toast.success('Asset Uploaded', 'Branding asset updated successfully.');
        } catch (error: any) {
            toast.error('Upload Failed', error.message || 'Could not upload the branding asset.');
        } finally {
            setUploadingAsset(null);
        }
    };

    const save = async () => {
        if (!clientId) return;
        setIsSaving(true);
        try {
            await platformApi.updateClientBranding(clientId, {
                numbering_settings: branding.numbering_settings,
                receipt_business_name: branding.receipt_business_name,
                receipt_footer_message_1: branding.receipt_footer_message_1,
                receipt_footer_message_2: branding.receipt_footer_message_2,
                show_receipt_full_logo: branding.show_receipt_full_logo,
                show_receipt_short_logo: branding.show_receipt_short_logo,
                show_receipt_business_name: branding.show_receipt_business_name,
                show_receipt_branch_name: branding.show_receipt_branch_name,
                show_receipt_branch_address: branding.show_receipt_branch_address,
                show_receipt_contact_number: branding.show_receipt_contact_number,
                show_receipt_footer_message_1: branding.show_receipt_footer_message_1,
                show_receipt_footer_message_2: branding.show_receipt_footer_message_2,
                show_kot_full_logo: branding.show_kot_full_logo,
                show_kot_short_logo: branding.show_kot_short_logo,
                show_kot_business_name: branding.show_kot_business_name,
                show_kot_branch_name: branding.show_kot_branch_name,
                show_kot_branch_address: branding.show_kot_branch_address,
                show_kot_contact_number: branding.show_kot_contact_number,
                show_kot_footer_message_1: branding.show_kot_footer_message_1,
                show_kot_footer_message_2: branding.show_kot_footer_message_2,
                show_login_full_logo: branding.show_login_full_logo,
                show_login_business_name: branding.show_login_business_name,
                show_login_branch_name: branding.show_login_branch_name,
                show_header_short_logo: branding.show_header_short_logo,
                receipt_paper_size: branding.receipt_paper_size,
                invoice_paper_size: branding.invoice_paper_size,
                kot_paper_size: branding.kot_paper_size,
                report_paper_size: branding.report_paper_size,
                receipt_print_copies: Number(branding.receipt_print_copies || 1),
                invoice_print_copies: Number(branding.invoice_print_copies || 1),
                kot_print_copies: Number(branding.kot_print_copies || 1),
                kot_print_enabled: branding.kot_print_enabled,
                report_print_copies: Number(branding.report_print_copies || 1),
                order_change_print_mode: branding.order_change_print_mode,
                order_change_print_copies: Number(branding.order_change_print_copies || 1),
                enable_station_wise_kot_printing: branding.enable_station_wise_kot_printing,
                allow_multiple_kot_per_station: branding.allow_multiple_kot_per_station,
                service_station_print_copies: branding.service_station_print_copies,
                station_printer_mapping: branding.station_printer_mapping,
                separate_kot_stations: branding.separate_kot_stations,
            });
            toast.success('Branding Saved', 'Client branding and print defaults have been updated.');
            await load();
        } catch (error: any) {
            toast.error('Branding Save Failed', error.message || 'Could not save branding settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const setStationCopy = (station: string, value: string) => {
        const normalized = station.trim();
        if (!normalized) return;
        setBranding((current) => ({
            ...current,
            service_station_print_copies: {
                ...current.service_station_print_copies,
                [normalized]: Math.max(1, Number(value || 1)),
            },
        }));
    };

    const setStationPrinter = (station: string, value: string) => {
        const normalized = station.trim();
        if (!normalized) return;
        setBranding((current) => ({
            ...current,
            station_printer_mapping: {
                ...current.station_printer_mapping,
                [normalized]: value,
            },
        }));
    };

    const removeStation = (station: string) => {
        setBranding((current) => {
            const nextCopies = { ...current.service_station_print_copies };
            const nextPrinters = { ...current.station_printer_mapping };
            delete nextCopies[station];
            delete nextPrinters[station];
            return {
                ...current,
                service_station_print_copies: nextCopies,
                station_printer_mapping: nextPrinters,
                separate_kot_stations: current.separate_kot_stations.filter((entry) => entry !== station),
            };
        });
    };

    const stationKeys = useMemo(() => Array.from(new Set([
        ...Object.keys(branding.service_station_print_copies || {}),
        ...Object.keys(branding.station_printer_mapping || {}),
        ...(branding.separate_kot_stations || []),
    ])).sort(), [branding.service_station_print_copies, branding.station_printer_mapping, branding.separate_kot_stations]);

    const toggleSeparateKotStation = (station: string) => {
        const normalized = station.trim();
        if (!normalized) return;
        setBranding((current) => {
            const exists = current.separate_kot_stations.includes(normalized);
            return {
                ...current,
                separate_kot_stations: exists
                    ? current.separate_kot_stations.filter((entry) => entry !== normalized)
                    : [...current.separate_kot_stations, normalized].sort(),
            };
        });
    };

    const enabledReceiptFields = [
        branding.show_receipt_full_logo,
        branding.show_receipt_short_logo,
        branding.show_receipt_business_name,
        branding.show_receipt_branch_name,
        branding.show_receipt_branch_address,
        branding.show_receipt_contact_number,
        branding.show_receipt_footer_message_1,
        branding.show_receipt_footer_message_2,
    ].filter(Boolean).length;

    const enabledExperienceFields = [
        branding.show_login_full_logo,
        branding.show_login_business_name,
        branding.show_login_branch_name,
        branding.show_header_short_logo,
    ].filter(Boolean).length;

    const updateNumberingRule = (key: NumberingRuleKey, patch: Partial<NumberingRule>) => {
        setBranding((current) => ({
            ...current,
            numbering_settings: {
                ...current.numbering_settings,
                rules: {
                    ...current.numbering_settings.rules,
                    [key]: {
                        ...current.numbering_settings.rules[key],
                        ...patch,
                    },
                },
            },
        }));
    };

    const sampleBranchCode = `${branding.numbering_settings.branch_code_prefix}${String(SAMPLE_BRANCH_SEQUENCE).padStart(branding.numbering_settings.branch_code_zero_pad, '0')}`;
    const numberingPreviews = useMemo(() => {
        const rules = branding.numbering_settings.rules;
        return {
            branchCode: sampleBranchCode,
            offlineOrder: branding.numbering_settings.offline_order_format,
            offlineKot: branding.numbering_settings.offline_kot_format,
            byRule: Object.fromEntries(
                NUMBERING_RULES.map(({ key }) => [key, buildNumberingPreview(rules[key], sampleBranchCode)]),
            ) as Record<NumberingRuleKey, string>,
        };
    }, [branding.numbering_settings, sampleBranchCode]);

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <div className={styles.heroEyebrow}>
                        <Sparkles size={14} />
                        Client Identity and Print Control
                    </div>
                    <h1>Branding and Receipt Settings</h1>
                    <p>Manage logos, login visuals, receipt identity, print defaults, and kitchen routing from one place.</p>
                    <div className={styles.metricRow}>
                        <MetricPill label="Receipt Fields Enabled" value={`${enabledReceiptFields}/8`} />
                        <MetricPill label="Login and ERP Branding" value={`${enabledExperienceFields}/4`} />
                        <MetricPill label="Configured Stations" value={String(stationKeys.length)} />
                    </div>
                </div>
                <div className={styles.heroActions}>
                    <div className={styles.statusCard}>
                        <span className={styles.statusLabel}>Primary branch source</span>
                        <strong>{branding.primary_branch?.branch_name || 'Not linked yet'}</strong>
                        <span className={styles.statusHint}>Branch name, address, and contact still come from branch master data.</span>
                    </div>
                    <div className={styles.statusCard}>
                        <span className={styles.statusLabel}>Branch formats</span>
                        <strong>Date, time, and currency are set per branch</strong>
                        <span className={styles.statusHint}>
                            Open <Link to="/console/setup/branches" className={styles.heroLink}>Branch Settings</Link> to change date format, time format, and branch currency.
                        </span>
                    </div>
                    <KitchenButton
                        variant="secondary"
                        onClick={() => navigate('/console/setup/branches')}
                        className={styles.branchLinkButton}
                    >
                        Open Branch Settings
                    </KitchenButton>
                    <KitchenButton onClick={save} isLoading={isSaving} disabled={isLoading || !clientId} className={styles.saveButton}>
                        <Save size={16} />
                        Save All Changes
                    </KitchenButton>
                </div>
            </section>

            <div className={styles.layout}>
                <section className={styles.mainColumn}>
                    <KitchenCard className={`${styles.sectionCard} ${styles.sectionWarm}`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleWrap}>
                                <Store size={18} />
                                <div>
                                    <h3>Brand Assets</h3>
                                    <p>These assets drive receipt branding, client login pages, and the ERP header.</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.assetGrid}>
                            <AssetCard title="Full Logo" hint="Used on receipts and client login." assetUrl={branding.full_logo_url} uploading={uploadingAsset === 'full_logo'} icon={<ImagePlus size={28} />} onUpload={() => fullLogoInputRef.current?.click()} />
                            <AssetCard title="Short Logo" hint="Used in ERP header and compact print layouts." assetUrl={branding.short_logo_url} uploading={uploadingAsset === 'short_logo'} icon={<Store size={28} />} onUpload={() => shortLogoInputRef.current?.click()} />
                            <AssetCard title="Login Background" hint="Used on slug-based client login pages." assetUrl={branding.login_background_url} uploading={uploadingAsset === 'login_background'} icon={<Monitor size={28} />} onUpload={() => backgroundInputRef.current?.click()} />
                        </div>
                        <input ref={fullLogoInputRef} type="file" accept="image/*" hidden onChange={(event) => void handleUpload('full_logo', event.target.files?.[0])} />
                        <input ref={shortLogoInputRef} type="file" accept="image/*" hidden onChange={(event) => void handleUpload('short_logo', event.target.files?.[0])} />
                        <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={(event) => void handleUpload('login_background', event.target.files?.[0])} />
                    </KitchenCard>

                    <KitchenCard className={`${styles.sectionCard} ${styles.sectionCool}`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleWrap}>
                                <Receipt size={18} />
                                <div>
                                    <h3>Receipt Identity</h3>
                                    <p>Control the business name and closing messages that appear on customer printouts.</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.formGrid}>
                            <KitchenInput label="Business Name on Receipt" value={branding.receipt_business_name} onChange={(event) => setField('receipt_business_name', event.target.value)} placeholder={branding.client_name || 'Business name'} />
                            <KitchenInput label="Receipt Footer Message 1" value={branding.receipt_footer_message_1} onChange={(event) => setField('receipt_footer_message_1', event.target.value)} placeholder="Thank you for visiting" />
                            <KitchenInput label="Receipt Footer Message 2" value={branding.receipt_footer_message_2} onChange={(event) => setField('receipt_footer_message_2', event.target.value)} placeholder="Return policy or note" />
                        </div>
                        <div className={styles.infoPanel}>
                            <strong>Branch-driven values</strong>
                            <span>Branch Name, Branch Address, and Contact Number are automatically taken from the active branch master.</span>
                            <span>Date format, time format, and currency now also live in branch settings, not here.</span>
                            <span>Current default branch: {branding.primary_branch?.branch_name || 'Not available'}</span>
                            <KitchenButton variant="link" onClick={() => navigate('/console/setup/branches')}>Go to Branch Settings</KitchenButton>
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sectionCard} ${styles.sectionSlate}`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleWrap}>
                                <Settings2 size={18} />
                                <div>
                                    <h3>Client Numbering Policy</h3>
                                    <p>Client admin controls default numbering formats and reset policy for operational documents.</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.infoPanel}>
                            <strong>Master defaults</strong>
                            <span>Client IDs: `CL####` random 4 digits with no dash.</span>
                            <span>Branch code default: {numberingPreviews.branchCode} with no dash.</span>
                            <span>Offline Order: {numberingPreviews.offlineOrder}</span>
                            <span>Offline KOT: {numberingPreviews.offlineKot}, revision: {numberingPreviews.offlineKot}-1</span>
                        </div>
                        <div className={styles.formGrid}>
                            <KitchenInput label="Branch Code Prefix" value={branding.numbering_settings.branch_code_prefix} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, branch_code_prefix: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '') })} />
                            <KitchenInput label="Branch Code Digits" type="number" min={1} value={String(branding.numbering_settings.branch_code_zero_pad)} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, branch_code_zero_pad: Math.max(1, Number(event.target.value || 3)) })} />
                            <KitchenInput label="Employee Prefix" value={branding.numbering_settings.employee_code_prefix} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, employee_code_prefix: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '') })} />
                            <KitchenInput label="Customer Prefix" value={branding.numbering_settings.customer_code_prefix} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, customer_code_prefix: event.target.value.toUpperCase() })} />
                            <KitchenInput label="Offline Order Format" value={branding.numbering_settings.offline_order_format} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, offline_order_format: event.target.value })} />
                            <KitchenInput label="Offline KOT Format" value={branding.numbering_settings.offline_kot_format} onChange={(event) => setField('numbering_settings', { ...branding.numbering_settings, offline_kot_format: event.target.value })} />
                        </div>
                        <div className={`${styles.stationList} ${styles.numberingRuleGrid}`}>
                            {NUMBERING_RULES.map(({ key, label, example }) => {
                                const rule = branding.numbering_settings.rules[key];
                                const preview = numberingPreviews.byRule[key];
                                return (
                                    <div key={key} className={styles.stationCard}>
                                        <div className={styles.stationHeader}>
                                            <div>
                                                <strong>{label}</strong>
                                                <span>Current Format: {preview || example}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.removeButton}
                                                onClick={() => updateNumberingRule(key, { manual_reset_at: new Date().toISOString() })}
                                                disabled={rule.reset_frequency !== 'manual'}
                                            >
                                                Manual Reset
                                            </button>
                                        </div>
                                        <div className={styles.stationFields}>
                                            <KitchenInput label="Prefix" value={rule.prefix} onChange={(event) => updateNumberingRule(key, { prefix: event.target.value.toUpperCase() })} />
                                            <KitchenInput label="Digits" type="number" min={2} value={String(rule.zero_pad)} onChange={(event) => updateNumberingRule(key, { zero_pad: Math.max(2, Number(event.target.value || 4)) })} />
                                            <label className={styles.selectCard}>
                                                <span>Reset Policy</span>
                                                <select value={rule.reset_frequency} onChange={(event) => updateNumberingRule(key, { reset_frequency: event.target.value as ResetFrequency })}>
                                                    <option value="business_day">Business Day</option>
                                                    <option value="calendar_day">Calendar Day</option>
                                                    <option value="monthly">Monthly</option>
                                                    <option value="annually">Annually</option>
                                                    <option value="manual">Manual Reset</option>
                                                    <option value="never">No Reset</option>
                                                </select>
                                            </label>
                                            <label className={styles.selectCard}>
                                                <span>Date Segment</span>
                                                <select value={rule.date_segment_format} onChange={(event) => updateNumberingRule(key, { date_segment_format: event.target.value as DateSegmentFormat })}>
                                                    <option value="none">None</option>
                                                    <option value="YYMM">YYMM</option>
                                                    <option value="YYMMDD">YYMMDD</option>
                                                </select>
                                            </label>
                                        </div>
                                        <div className={styles.toggleGrid}>
                                            <ToggleCard checked={rule.include_branch_code} label="Include Branch Code" hint="Add branch code in the number." onChange={(next) => updateNumberingRule(key, { include_branch_code: next })} />
                                            <ToggleCard checked={rule.include_counter_code} label="Include Counter Code" hint="Add sale counter or device code in the number." onChange={(next) => updateNumberingRule(key, { include_counter_code: next })} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sectionCard} ${styles.sectionAmber}`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleWrap}>
                                <Settings2 size={18} />
                                <div>
                                    <h3>Print Defaults</h3>
                                    <p>Choose default sizes and copy counts so counters, KDS, and reports start with the right print behavior.</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.settingsBlock}>
                            <div className={styles.blockTitle}>Paper Sizes</div>
                            <div className={styles.optionGrid}>
                                {[
                                    ['receipt_paper_size', 'Receipt Paper'],
                                    ['invoice_paper_size', 'Invoice Paper'],
                                    ['kot_paper_size', 'KOT Paper'],
                                    ['report_paper_size', 'Report Paper'],
                                ].map(([key, label]) => (
                                    <label key={key} className={styles.selectCard}>
                                        <span>{label}</span>
                                        <select value={branding[key as keyof BrandingState] as string} onChange={(event) => setField(key as keyof BrandingState, event.target.value as any)}>
                                            {PAPER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} - {option.hint}</option>)}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className={styles.settingsBlock}>
                            <div className={styles.blockTitle}>Copy Counts</div>
                            <div className={styles.copyGrid}>
                                <KitchenInput label="Receipt Copies" type="number" min={1} value={String(branding.receipt_print_copies)} onChange={(event) => setField('receipt_print_copies', Math.max(1, Number(event.target.value || 1)))} />
                                <KitchenInput label="Invoice Copies" type="number" min={1} value={String(branding.invoice_print_copies)} onChange={(event) => setField('invoice_print_copies', Math.max(1, Number(event.target.value || 1)))} />
                                <KitchenInput label="KOT Copies" type="number" min={1} value={String(branding.kot_print_copies)} onChange={(event) => setField('kot_print_copies', Math.max(1, Number(event.target.value || 1)))} />
                                <KitchenInput label="Report Copies" type="number" min={1} value={String(branding.report_print_copies)} onChange={(event) => setField('report_print_copies', Math.max(1, Number(event.target.value || 1)))} />
                                <KitchenInput label="Order Change Copies" type="number" min={1} value={String(branding.order_change_print_copies)} onChange={(event) => setField('order_change_print_copies', Math.max(1, Number(event.target.value || 1)))} />
                            </div>
                        </div>
                        <div className={styles.settingsBlock}>
                            <div className={styles.blockTitle}>KOT Change Behavior</div>
                            <div className={styles.modeIntro}>
                                Decide what the kitchen should receive when an order is edited after the first KOT has already printed.
                            </div>
                            <div className={styles.modeGrid}>
                                {CHANGE_MODE_OPTIONS.map((option) => (
                                    <button key={option.value} type="button" className={`${styles.modeCard} ${branding.order_change_print_mode === option.value ? styles.modeCardActive : ''}`} onClick={() => setField('order_change_print_mode', option.value)}>
                                        <strong>{option.label}</strong>
                                        <span>{option.hint}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.modeHelpGrid}>
                                <div className={styles.modeHelpCard}>
                                    <strong>Change Only</strong>
                                    <span>Best when kitchen teams only need the delta, such as added, removed, or updated items.</span>
                                </div>
                                <div className={styles.modeHelpCard}>
                                    <strong>Full Snapshot</strong>
                                    <span>Best when kitchen teams prefer one complete latest KOT instead of comparing old and new slips.</span>
                                </div>
                                <div className={styles.modeHelpCard}>
                                    <strong>Both</strong>
                                    <span>Best when supervisors want the delta slip and the kitchen line still wants the full updated order.</span>
                                </div>
                            </div>
                        </div>
                    </KitchenCard>
                </section>
                <aside className={styles.sideColumn}>
                    <KitchenCard className={`${styles.sideCard} ${styles.sideBlue}`}>
                        <div className={styles.sideTitle}>Receipt Visibility</div>
                        <div className={`${styles.toggleGrid} ${styles.compactToggleGrid}`}>
                            <ToggleCard checked={branding.show_receipt_full_logo} label="Full Logo" hint="Show the full brand logo on receipts." onChange={(next) => setField('show_receipt_full_logo', next)} />
                            <ToggleCard checked={branding.show_receipt_short_logo} label="Short Logo" hint="Allow compact logo usage on receipts." onChange={(next) => setField('show_receipt_short_logo', next)} />
                            <ToggleCard checked={branding.show_receipt_business_name} label="Business Name" hint="Show the configured receipt business name." onChange={(next) => setField('show_receipt_business_name', next)} />
                            <ToggleCard checked={branding.show_receipt_branch_name} label="Branch Name" hint="Show branch name from branch master." onChange={(next) => setField('show_receipt_branch_name', next)} />
                            <ToggleCard checked={branding.show_receipt_branch_address} label="Branch Address" hint="Show branch address from branch master." onChange={(next) => setField('show_receipt_branch_address', next)} />
                            <ToggleCard checked={branding.show_receipt_contact_number} label="Contact Number" hint="Show branch phone on receipts." onChange={(next) => setField('show_receipt_contact_number', next)} />
                            <ToggleCard checked={branding.show_receipt_footer_message_1} label="Footer Message 1" hint="Show the first footer note." onChange={(next) => setField('show_receipt_footer_message_1', next)} />
                            <ToggleCard checked={branding.show_receipt_footer_message_2} label="Footer Message 2" hint="Show the second footer note." onChange={(next) => setField('show_receipt_footer_message_2', next)} />
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sideCard} ${styles.sideOrange}`}>
                        <div className={styles.sideTitle}>KOT Visibility</div>
                        <div className={styles.toggleGrid}>
                            <ToggleCard checked={branding.show_kot_business_name} label="Business Name" hint="Show the configured business name on KOTs." onChange={(next) => setField('show_kot_business_name', next)} />
                            <ToggleCard checked={branding.show_kot_branch_name} label="Branch Name" hint="Show branch name on KOTs." onChange={(next) => setField('show_kot_branch_name', next)} />
                            <ToggleCard checked={branding.show_kot_full_logo} label="Full Logo" hint="Show the full logo on KOTs." onChange={(next) => setField('show_kot_full_logo', next)} />
                            <ToggleCard checked={branding.show_kot_short_logo} label="Short Logo" hint="Allow the short logo on KOTs." onChange={(next) => setField('show_kot_short_logo', next)} />
                            <ToggleCard checked={branding.show_kot_branch_address} label="Branch Address" hint="Show branch address on KOTs." onChange={(next) => setField('show_kot_branch_address', next)} />
                            <ToggleCard checked={branding.show_kot_contact_number} label="Contact Number" hint="Show branch contact number on KOTs." onChange={(next) => setField('show_kot_contact_number', next)} />
                            <ToggleCard checked={branding.show_kot_footer_message_1} label="Footer Message 1" hint="Show footer message 1 on KOTs." onChange={(next) => setField('show_kot_footer_message_1', next)} />
                            <ToggleCard checked={branding.show_kot_footer_message_2} label="Footer Message 2" hint="Show footer message 2 on KOTs." onChange={(next) => setField('show_kot_footer_message_2', next)} />
                        </div>
                        <div className={styles.sideNote}>
                            <strong>Recommended KOT setup</strong>
                            <span>Keep only Business Name and Branch Name enabled if the kitchen slip should stay compact and operational.</span>
                            <span>Disable logos, contact details, and footer lines to avoid clutter on thermal KOTs.</span>
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sideCard} ${styles.sideIndigo}`}>
                        <div className={styles.sideTitle}>Login and ERP Branding</div>
                        <div className={`${styles.toggleGrid} ${styles.compactToggleGrid}`}>
                            <ToggleCard checked={branding.show_login_full_logo} label="Login Full Logo" hint="Show the full logo on slug login pages." onChange={(next) => setField('show_login_full_logo', next)} />
                            <ToggleCard checked={branding.show_login_business_name} label="Login Business Name" hint="Show client business name on login pages." onChange={(next) => setField('show_login_business_name', next)} />
                            <ToggleCard checked={branding.show_login_branch_name} label="Login Branch Name" hint="Show the default branch name on login pages." onChange={(next) => setField('show_login_branch_name', next)} />
                            <ToggleCard checked={branding.show_header_short_logo} label="ERP Header Logo" hint="Show the short logo in the main ERP header." onChange={(next) => setField('show_header_short_logo', next)} />
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sideCard} ${styles.sideMint}`}>
                        <div className={styles.sideTitle}>Kitchen Routing Rules</div>
                        <div className={`${styles.toggleGrid} ${styles.compactToggleGrid}`}>
                            <ToggleCard checked={branding.kot_print_enabled} label="Print KOT" hint="Turn KOT printing on or skip KOT printouts entirely." onChange={(next) => setField('kot_print_enabled', next)} />
                            <ToggleCard checked={branding.enable_station_wise_kot_printing} label="Station-wise KOT Printing" hint="Keep KOT printing rules split by service station." onChange={(next) => setField('enable_station_wise_kot_printing', next)} />
                            <ToggleCard checked={branding.allow_multiple_kot_per_station} label="Multiple Station Copies" hint="Allow copy counts above one for each station." onChange={(next) => setField('allow_multiple_kot_per_station', next)} />
                        </div>
                        <div className={styles.sideNote}>
                            <strong>What this does</strong>
                            <span>Service station routing decides which KOT copies belong to Grill, Bar, Dessert, Packing, or any other prep station.</span>
                            <span>When station-wise printing is enabled, the system can keep separate print rules and printer aliases per station.</span>
                            <span>Turn off Print KOT when an order should go live without any printed kitchen slip.</span>
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sideCard} ${styles.sideRose}`}>
                        <div className={styles.sideTitle}>Service Station Routing</div>
                        <div className={styles.sideNote}>
                            <strong>How to use it</strong>
                            <span>Add each service station name, then assign its printer alias and copy count.</span>
                            <span>This lets KOT output target the right prep area instead of treating the whole kitchen as one queue.</span>
                        </div>
                        <div className={styles.stationForm}>
                            <KitchenInput label="Station Name" value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="Grill" />
                            <KitchenInput label="Printer Alias" value={newStationPrinter} onChange={(event) => setNewStationPrinter(event.target.value)} placeholder="Kitchen Printer 01" />
                            <KitchenButton
                                variant="secondary"
                                className={styles.addStationButton}
                                onClick={() => {
                                    if (!newStationName.trim()) return;
                                    setStationCopy(newStationName, '1');
                                    setStationPrinter(newStationName, newStationPrinter);
                                    setNewStationName('');
                                    setNewStationPrinter('');
                                }}
                            >
                                Add Station
                            </KitchenButton>
                        </div>
                        <div className={styles.stationList}>
                            {stationKeys.length === 0 ? (
                                <div className={styles.emptyState}>No service station routing saved yet.</div>
                            ) : stationKeys.map((station) => (
                                <div key={station} className={styles.stationCard}>
                                    <div className={styles.stationHeader}>
                                        <div>
                                            <strong>{station}</strong>
                                            <span>{branding.station_printer_mapping?.[station] || 'No printer alias linked yet'}</span>
                                        </div>
                                        <button type="button" className={styles.removeButton} onClick={() => removeStation(station)}>Remove</button>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${styles.stationToggleButton} ${branding.separate_kot_stations.includes(station) ? styles.stationToggleButtonActive : ''}`}
                                        onClick={() => toggleSeparateKotStation(station)}
                                    >
                                        {branding.separate_kot_stations.includes(station) ? 'Separate KOT Enabled' : 'Print With Combined KOT'}
                                    </button>
                                    <div className={styles.stationFields}>
                                        <KitchenInput label="Copies" type="number" min={1} value={String(branding.service_station_print_copies?.[station] ?? 1)} onChange={(event) => setStationCopy(station, event.target.value)} />
                                        <KitchenInput label="Printer Alias" value={branding.station_printer_mapping?.[station] ?? ''} onChange={(event) => setStationPrinter(station, event.target.value)} placeholder="Printer alias or queue" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </KitchenCard>
                </aside>
            </div>
        </div>
    );
}

export default ClientBrandingSettings;

