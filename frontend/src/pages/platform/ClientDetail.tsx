import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Clock3, Edit2, Globe, Mail, MapPin, Package, Phone, ShieldCheck, Users, Layers, AlertTriangle, XCircle } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

type TabKey = 'overview' | 'contacts' | 'subscriptions' | 'entitlements' | 'governance' | 'history';
type ClientLifecycle = 'draft' | 'onboarding' | 'active' | 'suspended' | 'inactive' | 'closed';
type PlanStatus = 'draft' | 'active' | 'retired';
type SubscriptionStatus = 'pending' | 'trial' | 'active' | 'grace' | 'expired' | 'suspended' | 'cancelled';
type GovernanceState = 'normal' | 'restricted' | 'suspended' | 'closure_pending' | 'closed';
type GovernanceContext = 'non_payment' | 'trial_expiry' | 'policy_issue' | 'abuse_risk' | 'admin_hold' | 'manual_override';

interface ClientContact { id: number; contact_type: 'business_primary' | 'billing_primary' | 'operations_primary'; full_name: string; designation?: string | null; email?: string | null; phone?: string | null; alternate_phone?: string | null; notes?: string | null; }
interface Client { id: string; client_code: string; client_name: string; legal_name?: string | null; short_name?: string | null; domain_slug: string; business_type?: string | null; status: ClientLifecycle; governance_state?: GovernanceState; governance_updated_at?: string | null; currency?: string | null; language?: string | null; timezone?: string | null; address?: string | null; area?: string | null; city?: string | null; country?: string | null; phone?: string | null; email?: string | null; website_url?: string | null; comments?: string | null; renewal_day?: number | null; renewal_date?: string | null; grace_period_days?: number | null; branch_count: number; user_count: number; contacts: ClientContact[]; created_at: string; updated_at: string; }
interface StatusHistoryItem { id: number; from_status?: string | null; to_status: string; reason: string; notes?: string | null; changed_by?: string | null; created_at: string; }
interface AuditItem { id: string; timestamp: string; action: string; entity: string; details?: string | null; UserManagementName?: string | null; UserManagementRole?: string | null; }
interface GovernanceSummary {
    client_id: string;
    governance_state: GovernanceState;
    lifecycle_status?: ClientLifecycle;
    trigger_context?: GovernanceContext | null;
    reason?: string | null;
    notes?: string | null;
    updated_at?: string | null;
    updated_by?: string | null;
    access_mode: 'full' | 'read_only' | 'blocked';
    allowed_next_states?: GovernanceState[];
}
interface GovernanceHistoryItem {
    id: number;
    action_type: string;
    from_state?: GovernanceState | null;
    to_state: GovernanceState;
    trigger_context: GovernanceContext;
    reason: string;
    notes?: string | null;
    changed_by?: string | null;
    created_at: string;
}
interface SubscriptionPlanOption { id: number; plan_name: string; plan_code: string; plan_status: PlanStatus; monthly_price: number; annual_price: number; trial_enabled: boolean; default_trial_days: number; currency_code?: string | null; }
interface SubscriptionHistoryEntry { id: number; action_type: string; from_status?: string | null; to_status?: string | null; from_plan_name?: string | null; to_plan_name?: string | null; reason?: string | null; notes?: string | null; changed_by?: string | null; created_at: string; }
interface ClientSubscription { id: number; plan_id: number; plan_code: string; plan_name: string; currency_code?: string | null; billing_cycle: 'monthly' | 'annual'; status: SubscriptionStatus; is_trial: boolean; trial_start_at?: string | null; trial_end_at?: string | null; effective_start_at?: string | null; effective_end_at?: string | null; grace_start_at?: string | null; grace_end_at?: string | null; price_snapshot: number; history?: SubscriptionHistoryEntry[]; }
interface PlatformFeatureOption { id: number; feature_key: string; feature_name: string; description?: string | null; is_active: boolean; }
interface EffectiveEntitlements {
    client_id: string;
    client_status: string;
    subscription_status?: string | null;
    current_plan_id?: number | null;
    current_plan_name?: string | null;
    is_operational: boolean;
    blocking_reason?: string | null;
    features: string[];
    feature_sources: Record<string, 'plan' | 'override_enabled' | 'override_disabled'>;
    limits: {
        max_branches: number | null;
        max_active_users: number | null;
        max_pos_devices: number | null;
    };
    usage: {
        max_branches: number;
        max_active_users: number;
        max_pos_devices: number;
    };
    warnings: string[];
}
interface ClientOverrides {
    feature_overrides: Array<{
        id: number;
        feature_key: string;
        feature_name?: string | null;
        is_enabled: boolean;
        reason?: string | null;
        notes?: string | null;
        updated_at: string;
    }>;
    limit_overrides: Array<{
        id: number;
        limit_key: 'max_branches' | 'max_active_users' | 'max_pos_devices';
        limit_value: number;
        reason?: string | null;
        notes?: string | null;
        updated_at: string;
    }>;
}
interface TenantInspection {
    client_id: string;
    lifecycle_status: ClientLifecycle;
    governance_state: GovernanceState;
    health_status: 'healthy' | 'warning' | 'critical';
    branch_summary: {
        total: number;
        active: number;
        central: number;
    };
    user_summary: {
        total: number;
        active: number;
        client_admins: number;
    };
    audit_snapshot: {
        total_events: number;
        warning_events: number;
        error_events: number;
        write_events: number;
        last_event_at?: string | null;
    };
    findings: Array<{
        code: string;
        severity: 'warning' | 'critical';
        message: string;
    }>;
}

const normalizeOverrides = (value: any): ClientOverrides => ({
    feature_overrides: Array.isArray(value?.feature_overrides) ? value.feature_overrides : [],
    limit_overrides: Array.isArray(value?.limit_overrides) ? value.limit_overrides : [],
});

const normalizeEffectiveEntitlements = (value: any): EffectiveEntitlements | null => value ? {
    ...value,
    limits: {
        max_branches: value?.limits?.max_branches ?? null,
        max_active_users: value?.limits?.max_active_users ?? null,
        max_pos_devices: value?.limits?.max_pos_devices ?? null,
    },
    usage: {
        max_branches: Number(value?.usage?.max_branches || 0),
        max_active_users: Number(value?.usage?.max_active_users || 0),
        max_pos_devices: Number(value?.usage?.max_pos_devices || 0),
    },
    features: Array.isArray(value?.features) ? value.features : [],
    feature_sources: value?.feature_sources || {},
    warnings: Array.isArray(value?.warnings) ? value.warnings : [],
} : null;

const TABS: Array<{ key: TabKey; label: string }> = [{ key: 'overview', label: 'Overview' }, { key: 'contacts', label: 'Contacts' }, { key: 'subscriptions', label: 'Subscriptions' }, { key: 'entitlements', label: 'Entitlements' }, { key: 'governance', label: 'Governance' }, { key: 'history', label: 'History' }];
const STATUS_LABELS: Record<ClientLifecycle, string> = { draft: 'Draft', onboarding: 'Onboarding', active: 'Active', suspended: 'Suspended', inactive: 'Inactive', closed: 'Closed' };
const STATUS_COLORS: Record<ClientLifecycle, string> = { draft: 'var(--text-tertiary)', onboarding: 'var(--warning)', active: 'var(--success)', suspended: 'var(--danger)', inactive: 'var(--text-muted)', closed: 'var(--danger)' };
const GOVERNANCE_LABELS: Record<GovernanceState, string> = { normal: 'Normal', restricted: 'Restricted', suspended: 'Suspended', closure_pending: 'Closure Pending', closed: 'Closed' };
const GOVERNANCE_COLORS: Record<GovernanceState, string> = { normal: 'var(--success)', restricted: 'var(--warning)', suspended: 'var(--danger)', closure_pending: 'var(--warning)', closed: 'var(--danger)' };
const GOVERNANCE_CONTEXT_LABELS: Record<GovernanceContext, string> = {
    non_payment: 'Non-payment',
    trial_expiry: 'Trial Expiry',
    policy_issue: 'Policy Issue',
    abuse_risk: 'Abuse / Risk',
    admin_hold: 'Admin Hold',
    manual_override: 'Manual Override',
};
const GOVERNANCE_STATUS_OPTIONS: Array<{ value: '' | GovernanceState; label: string }> = [
    { value: '', label: 'Select governance action' },
    { value: 'normal', label: 'Reactivate / Normal' },
    { value: 'restricted', label: 'Restricted' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'closure_pending', label: 'Closure Pending' },
    { value: 'closed', label: 'Closed' },
];
const GOVERNANCE_CONTEXT_OPTIONS = [
    { value: '', label: 'Select trigger context' },
    { value: 'non_payment', label: 'Non-payment' },
    { value: 'trial_expiry', label: 'Trial Expiry' },
    { value: 'policy_issue', label: 'Policy Issue' },
    { value: 'abuse_risk', label: 'Abuse / Risk' },
    { value: 'admin_hold', label: 'Admin Hold' },
    { value: 'manual_override', label: 'Manual Override' },
];
const SUBSCRIPTION_STATUS_OPTIONS = [{ value: '', label: 'Select next subscription state' }, { value: 'pending', label: 'Pending' }, { value: 'trial', label: 'Trial' }, { value: 'active', label: 'Active' }, { value: 'grace', label: 'Grace' }, { value: 'suspended', label: 'Suspended' }, { value: 'expired', label: 'Expired' }, { value: 'cancelled', label: 'Cancelled' }];
const LIMIT_KEY_OPTIONS = [{ value: '', label: 'Select limit' }, { value: 'max_branches', label: 'Max Branches' }, { value: 'max_active_users', label: 'Max Active Users' }, { value: 'max_pos_devices', label: 'Max POS Devices' }];
const FEATURE_OVERRIDE_OPTIONS = [{ value: '', label: 'Select feature' }];
const FEATURE_STATE_OPTIONS = [{ value: 'enabled', label: 'Force Enable' }, { value: 'disabled', label: 'Force Disable' }];
const LIMIT_LABELS: Record<'max_branches' | 'max_active_users' | 'max_pos_devices', string> = {
    max_branches: 'Branches',
    max_active_users: 'Active Users',
    max_pos_devices: 'POS Devices',
};
const SOURCE_LABELS: Record<'plan' | 'override_enabled' | 'override_disabled', string> = {
    plan: 'Plan',
    override_enabled: 'Override Enabled',
    override_disabled: 'Override Disabled',
};

const getContact = (client: Client | null, type: ClientContact['contact_type']) => client?.contacts.find((contact) => contact.contact_type === type) || null;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const formatMoney = (value: number, currencyCode?: string | null) => `${currencyCode || 'PKR'} ${Number(value || 0).toLocaleString()}`;

export function ClientDetail() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
    const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlanOption[]>([]);
    const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
    const [currentSubscription, setCurrentSubscription] = useState<ClientSubscription | null>(null);
    const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatureOption[]>([]);
    const [effectiveEntitlements, setEffectiveEntitlements] = useState<EffectiveEntitlements | null>(null);
    const [clientOverrides, setClientOverrides] = useState<ClientOverrides>({ feature_overrides: [], limit_overrides: [] });
    const [governance, setGovernance] = useState<GovernanceSummary | null>(null);
    const [governanceHistory, setGovernanceHistory] = useState<GovernanceHistoryItem[]>([]);
    const [inspection, setInspection] = useState<TenantInspection | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [nextStatus, setNextStatus] = useState('');
    const [statusReason, setStatusReason] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [useTrial, setUseTrial] = useState(false);
    const [trialDays, setTrialDays] = useState('14');
    const [effectiveStartAt, setEffectiveStartAt] = useState('');
    const [effectiveEndAt, setEffectiveEndAt] = useState('');
    const [subscriptionReason, setSubscriptionReason] = useState('');
    const [subscriptionNotes, setSubscriptionNotes] = useState('');
    const [nextSubscriptionStatus, setNextSubscriptionStatus] = useState('');
    const [subscriptionStatusReason, setSubscriptionStatusReason] = useState('');
    const [subscriptionStatusNotes, setSubscriptionStatusNotes] = useState('');
    const [subscriptionGraceDays, setSubscriptionGraceDays] = useState('');
    const [subscriptionGraceEndAt, setSubscriptionGraceEndAt] = useState('');
    const [renewalDay, setRenewalDay] = useState('');
    const [renewalDate, setRenewalDate] = useState('');
    const [clientGraceDays, setClientGraceDays] = useState('');
    const [featureOverrideKey, setFeatureOverrideKey] = useState('');
    const [featureOverrideState, setFeatureOverrideState] = useState<'enabled' | 'disabled'>('enabled');
    const [featureOverrideReason, setFeatureOverrideReason] = useState('');
    const [featureOverrideNotes, setFeatureOverrideNotes] = useState('');
    const [limitOverrideKey, setLimitOverrideKey] = useState('');
    const [limitOverrideValue, setLimitOverrideValue] = useState('');
    const [limitOverrideReason, setLimitOverrideReason] = useState('');
    const [limitOverrideNotes, setLimitOverrideNotes] = useState('');
    const [nextGovernanceState, setNextGovernanceState] = useState('');
    const [governanceContext, setGovernanceContext] = useState('');
    const [governanceReason, setGovernanceReason] = useState('');
    const [governanceNotes, setGovernanceNotes] = useState('');
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [isSavingSubscription, setIsSavingSubscription] = useState(false);
    const [isSavingSubscriptionStatus, setIsSavingSubscriptionStatus] = useState(false);
    const [isSavingRenewalProfile, setIsSavingRenewalProfile] = useState(false);
    const [isSavingFeatureOverride, setIsSavingFeatureOverride] = useState(false);
    const [isSavingLimitOverride, setIsSavingLimitOverride] = useState(false);
    const [isSavingGovernance, setIsSavingGovernance] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [clientData, statusData, auditData, planData, subscriptionData, currentSubscriptionData, featureData, entitlementData, overrideData, governanceData, governanceHistoryData, inspectionData] = await Promise.all([
                platformApi.getClient(id),
                platformApi.getClientStatusHistory(id),
                platformApi.getClientAudit(id),
                platformApi.getSubscriptionPlans(),
                platformApi.getClientSubscriptions(id),
                platformApi.getCurrentClientSubscription(id),
                platformApi.getPlatformFeatures(),
                platformApi.getClientEffectiveEntitlements(id),
                platformApi.getClientOverrides(id),
                platformApi.getClientGovernance(id),
                platformApi.getClientGovernanceHistory(id),
                platformApi.getClientInspection(id),
            ]);
            setClient(clientData);
            setRenewalDay(clientData?.renewal_day ? String(clientData.renewal_day) : '');
            setRenewalDate(clientData?.renewal_date ? String(clientData.renewal_date).slice(0, 10) : '');
            setClientGraceDays(clientData?.grace_period_days !== null && clientData?.grace_period_days !== undefined ? String(clientData.grace_period_days) : '');
            setStatusHistory(statusData);
            setAuditItems(auditData);
            setPlans(planData.filter((plan: any) => (plan.plan_status || 'draft') !== 'retired').map((plan: any) => ({
                id: Number(plan.id),
                plan_name: plan.plan_name || 'Unnamed plan',
                plan_code: plan.plan_code || '',
                plan_status: (plan.plan_status || 'draft') as PlanStatus,
                monthly_price: Number(plan.monthly_price || 0),
                annual_price: Number(plan.annual_price || 0),
                trial_enabled: Boolean(plan.trial_enabled),
                default_trial_days: Number(plan.default_trial_days || 0),
                currency_code: plan.currency_code || 'PKR',
            })));
            setSubscriptions(Array.isArray(subscriptionData) ? subscriptionData.map((entry: any) => ({ ...entry, price_snapshot: Number(entry.price_snapshot || 0), history: Array.isArray(entry.history) ? entry.history : [] })) : []);
            setCurrentSubscription(currentSubscriptionData ? { ...currentSubscriptionData, price_snapshot: Number(currentSubscriptionData.price_snapshot || 0) } : null);
            setPlatformFeatures(Array.isArray(featureData) ? featureData.map((entry: any) => ({
                id: Number(entry.id),
                feature_key: entry.feature_key || '',
                feature_name: entry.feature_name || '',
                description: entry.description || '',
                is_active: Boolean(entry.is_active),
            })) : []);
            setEffectiveEntitlements(normalizeEffectiveEntitlements(entitlementData));
            setClientOverrides(normalizeOverrides(overrideData));
            setGovernance(governanceData || null);
            setGovernanceHistory(Array.isArray(governanceHistoryData) ? governanceHistoryData : []);
            setInspection(inspectionData || null);
        } catch (error) {
            toast.error('Failed to load client', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (!selectedPlanId) return;
        const selectedPlan = plans.find((plan) => String(plan.id) === selectedPlanId);
        if (selectedPlan?.trial_enabled) setTrialDays(String(selectedPlan.default_trial_days || 14));
        else setUseTrial(false);
    }, [plans, selectedPlanId]);

    const contactCards = useMemo(() => ([
        { key: 'business_primary', label: 'Business Contact', contact: getContact(client, 'business_primary') },
        { key: 'billing_primary', label: 'Billing Contact', contact: getContact(client, 'billing_primary') },
        { key: 'operations_primary', label: 'Operational Contact', contact: getContact(client, 'operations_primary') },
    ]), [client]);

    const statusColumns: ColumnDef<StatusHistoryItem>[] = [
        { key: 'transition', header: 'Transition', cell: (row) => <div className={styles.planCell}><span className={styles.planName}>{row.from_status || 'Created'} → {row.to_status}</span><span className={styles.planExpiry}>{row.reason}</span></div> },
        { key: 'notes', header: 'Notes', cell: (row) => row.notes || '—' },
        { key: 'changed_by', header: 'Actor', cell: (row) => row.changed_by || 'System' },
        { key: 'created_at', header: 'Timestamp', cell: (row) => new Date(row.created_at).toLocaleString() },
    ];
    const auditColumns: ColumnDef<AuditItem>[] = [
        { key: 'action', header: 'Action', cell: (row) => <div className={styles.planCell}><span className={styles.planName}>{row.action}</span><span className={styles.planExpiry}>{row.entity}</span></div> },
        { key: 'details', header: 'Details', cell: (row) => row.details || '—' },
        { key: 'actor', header: 'Actor', cell: (row) => row.UserManagementName || row.UserManagementRole || 'System' },
        { key: 'timestamp', header: 'Timestamp', cell: (row) => new Date(row.timestamp).toLocaleString() },
    ];
    const subscriptionColumns: ColumnDef<ClientSubscription>[] = [
        { key: 'plan_name', header: 'Plan', cell: (row) => <div className={styles.planCell}><span className={styles.planName}>{row.plan_name}</span><span className={styles.planExpiry}>{row.plan_code}</span></div> },
        { key: 'status', header: 'Status', cell: (row) => row.status },
        { key: 'billing_cycle', header: 'Cycle', cell: (row) => row.billing_cycle },
        { key: 'price_snapshot', header: 'Price', cell: (row) => formatMoney(row.price_snapshot, row.currency_code) },
        { key: 'effective_start_at', header: 'Start', cell: (row) => formatDate(row.effective_start_at) },
        { key: 'effective_end_at', header: 'End', cell: (row) => formatDate(row.effective_end_at) },
    ];
    const subscriptionHistoryColumns: ColumnDef<SubscriptionHistoryEntry>[] = [
        { key: 'action_type', header: 'Event', cell: (row) => <div className={styles.planCell}><span className={styles.planName}>{row.action_type}</span><span className={styles.planExpiry}>{row.from_plan_name || '—'} → {row.to_plan_name || '—'}</span></div> },
        { key: 'status', header: 'Status', cell: (row) => `${row.from_status || '—'} → ${row.to_status || '—'}` },
        { key: 'reason', header: 'Reason', cell: (row) => row.reason || '—' },
        { key: 'changed_by', header: 'Actor', cell: (row) => row.changed_by || 'System' },
        { key: 'created_at', header: 'Timestamp', cell: (row) => new Date(row.created_at).toLocaleString() },
    ];

    const governanceColumns: ColumnDef<GovernanceHistoryItem>[] = [
        { key: 'transition', header: 'Transition', cell: (row) => <div className={styles.planCell}><span className={styles.planName}>{row.from_state || 'normal'} â†’ {row.to_state}</span><span className={styles.planExpiry}>{row.action_type}</span></div> },
        { key: 'context', header: 'Context', cell: (row) => GOVERNANCE_CONTEXT_LABELS[row.trigger_context] || row.trigger_context },
        { key: 'reason', header: 'Reason', cell: (row) => row.reason || '-' },
        { key: 'changed_by', header: 'Actor', cell: (row) => row.changed_by || 'System' },
        { key: 'created_at', header: 'Timestamp', cell: (row) => new Date(row.created_at).toLocaleString() },
    ];

    const handleLifecycleChange = async () => {
        if (!id || !nextStatus || !statusReason.trim()) return toast.error('Lifecycle update blocked', 'Choose a target status and enter a reason.');
        setIsSavingStatus(true);
        try {
            await platformApi.updateClientStatus(id, nextStatus, statusReason.trim(), statusNotes.trim() || undefined);
            toast.success('Lifecycle updated', 'Client lifecycle state was updated successfully.');
            setNextStatus(''); setStatusReason(''); setStatusNotes(''); await load();
        } catch (error) {
            toast.error('Lifecycle update failed', error instanceof Error ? error.message : 'Unknown error');
        } finally { setIsSavingStatus(false); }
    };

    const handleGovernanceChange = async () => {
        if (!id || !nextGovernanceState || !governanceContext || !governanceReason.trim()) {
            return toast.error('Governance update blocked', 'Choose a governance state, trigger context, and reason.');
        }
        setIsSavingGovernance(true);
        try {
            await platformApi.updateClientGovernance(id, {
                state: nextGovernanceState,
                trigger_context: governanceContext,
                reason: governanceReason.trim(),
                notes: governanceNotes.trim() || undefined,
            });
            setNextGovernanceState('');
            setGovernanceContext('');
            setGovernanceReason('');
            setGovernanceNotes('');
            await load();
            toast.success('Governance updated', 'Tenant governance state was updated successfully.');
        } catch (error) {
            toast.error('Governance update failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsSavingGovernance(false);
        }
    };

    const handleAssignSubscription = async () => {
        if (!id || !selectedPlanId || !subscriptionReason.trim()) return toast.error('Assignment blocked', 'Choose a plan and enter a reason.');
        setIsSavingSubscription(true);
        try {
            await platformApi.assignClientSubscription(id, {
                plan_id: Number(selectedPlanId),
                billing_cycle: billingCycle,
                use_trial: useTrial,
                trial_days: useTrial ? Number(trialDays || 0) : undefined,
                effective_start_at: effectiveStartAt || undefined,
                effective_end_at: effectiveEndAt || undefined,
                reason: subscriptionReason.trim(),
                notes: subscriptionNotes.trim() || undefined,
            });
            toast.success('Subscription assigned', 'Client subscription has been saved.');
            setSelectedPlanId(''); setBillingCycle('monthly'); setUseTrial(false); setTrialDays('14'); setEffectiveStartAt(''); setEffectiveEndAt(''); setSubscriptionReason(''); setSubscriptionNotes(''); await load();
        } catch (error) {
            toast.error('Assignment failed', error instanceof Error ? error.message : 'Could not assign subscription.');
        } finally { setIsSavingSubscription(false); }
    };

    const handleSubscriptionStatusChange = async () => {
        if (!id || !currentSubscription || !nextSubscriptionStatus || !subscriptionStatusReason.trim()) return toast.error('Status change blocked', 'Choose a target subscription state and enter a reason.');
        setIsSavingSubscriptionStatus(true);
        try {
            await platformApi.updateClientSubscriptionStatus(id, currentSubscription.id, {
                status: nextSubscriptionStatus,
                grace_days: nextSubscriptionStatus === 'grace' && subscriptionGraceDays !== '' ? Number(subscriptionGraceDays) : undefined,
                grace_end_at: nextSubscriptionStatus === 'grace' && subscriptionGraceEndAt ? subscriptionGraceEndAt : undefined,
                reason: subscriptionStatusReason.trim(),
                notes: subscriptionStatusNotes.trim() || undefined,
            });
            toast.success('Subscription updated', 'Commercial lifecycle state was updated.');
            setNextSubscriptionStatus('');
            setSubscriptionStatusReason('');
            setSubscriptionStatusNotes('');
            setSubscriptionGraceDays('');
            setSubscriptionGraceEndAt('');
            await load();
        } catch (error) {
            toast.error('Status change failed', error instanceof Error ? error.message : 'Could not update subscription status.');
        } finally { setIsSavingSubscriptionStatus(false); }
    };

    const handleRenewalProfileSave = async () => {
        if (!id) return;
        if (renewalDay && (Number(renewalDay) < 1 || Number(renewalDay) > 31)) {
            return toast.error('Renewal profile blocked', 'Renewal day must be between 1 and 31.');
        }
        if (clientGraceDays && Number(clientGraceDays) < 0) {
            return toast.error('Renewal profile blocked', 'Grace days cannot be negative.');
        }

        setIsSavingRenewalProfile(true);
        try {
            await platformApi.updateClient(id, {
                renewal_day: renewalDay ? Number(renewalDay) : null,
                renewal_date: renewalDate || null,
                grace_period_days: clientGraceDays === '' ? 0 : Number(clientGraceDays),
            });
            toast.success('Renewal profile updated', 'Renewal anchor and grace defaults were saved.');
            await load();
        } catch (error) {
            toast.error('Save failed', error instanceof Error ? error.message : 'Could not save renewal profile.');
        } finally {
            setIsSavingRenewalProfile(false);
        }
    };

    if (isLoading) return <div className={styles.loaderBox} style={{ height: '60vh' }}><Clock3 size={36} className={styles.spin} /><span>Loading client profile...</span></div>;
    if (!client) return <div className={styles.emptyState}><Building2 size={48} color="var(--danger)" /><h3>Client not found</h3><KitchenButton onClick={() => navigate('/nexus/clients')}><ArrowLeft size={16} style={{ marginRight: 6 }} />Back to Client Registry</KitchenButton></div>;

    const statusColor = STATUS_COLORS[client.status];
    const governanceState = governance?.governance_state || client.governance_state || 'normal';
    const governanceColor = GOVERNANCE_COLORS[governanceState];
    const governanceOptions = GOVERNANCE_STATUS_OPTIONS.filter((option) =>
        option.value === '' || (governance?.allowed_next_states || []).includes(option.value),
    );
    const selectedPlan = plans.find((plan) => String(plan.id) === selectedPlanId) || null;
    const flattenedSubscriptionHistory = subscriptions.flatMap((subscription) => subscription.history || []);
    const currentCommercialEnd = currentSubscription?.grace_end_at || currentSubscription?.trial_end_at || currentSubscription?.effective_end_at || null;
    const featureOptions = FEATURE_OVERRIDE_OPTIONS.concat(platformFeatures.map((feature) => ({
        value: feature.feature_key,
        label: `${feature.feature_name} (${feature.feature_key})`,
    })));
    const usageRows: Array<{ key: 'max_branches' | 'max_active_users' | 'max_pos_devices'; label: string }> = [
        { key: 'max_branches', label: 'Branches' },
        { key: 'max_active_users', label: 'Active Users' },
        { key: 'max_pos_devices', label: 'POS Devices' },
    ];

    const handleFeatureOverrideSave = async () => {
        if (!id || !featureOverrideKey || !featureOverrideReason.trim()) {
            return toast.error('Override blocked', 'Choose a feature and enter a reason.');
        }
        setIsSavingFeatureOverride(true);
        try {
            const overrides = await platformApi.upsertClientFeatureOverride(id, {
                feature_key: featureOverrideKey,
                is_enabled: featureOverrideState === 'enabled',
                reason: featureOverrideReason.trim(),
                notes: featureOverrideNotes.trim() || undefined,
            });
            setClientOverrides(normalizeOverrides(overrides));
            setFeatureOverrideKey('');
            setFeatureOverrideState('enabled');
            setFeatureOverrideReason('');
            setFeatureOverrideNotes('');
            setEffectiveEntitlements(normalizeEffectiveEntitlements(await platformApi.getClientEffectiveEntitlements(id)));
            toast.success('Feature override saved', 'Client feature override is now active.');
        } catch (error) {
            toast.error('Override failed', error instanceof Error ? error.message : 'Could not save feature override.');
        } finally {
            setIsSavingFeatureOverride(false);
        }
    };

    const handleLimitOverrideSave = async () => {
        if (!id || !limitOverrideKey || !limitOverrideReason.trim() || limitOverrideValue === '') {
            return toast.error('Override blocked', 'Choose a limit, enter a value, and provide a reason.');
        }
        setIsSavingLimitOverride(true);
        try {
            const overrides = await platformApi.upsertClientLimitOverride(id, {
                limit_key: limitOverrideKey,
                limit_value: Number(limitOverrideValue),
                reason: limitOverrideReason.trim(),
                notes: limitOverrideNotes.trim() || undefined,
            });
            setClientOverrides(normalizeOverrides(overrides));
            setLimitOverrideKey('');
            setLimitOverrideValue('');
            setLimitOverrideReason('');
            setLimitOverrideNotes('');
            setEffectiveEntitlements(normalizeEffectiveEntitlements(await platformApi.getClientEffectiveEntitlements(id)));
            toast.success('Limit override saved', 'Client limit override is now active.');
        } catch (error) {
            toast.error('Override failed', error instanceof Error ? error.message : 'Could not save limit override.');
        } finally {
            setIsSavingLimitOverride(false);
        }
    };

    const handleFeatureOverrideRemove = async (featureKey: string) => {
        if (!id) return;
        try {
            const overrides = await platformApi.removeClientFeatureOverride(id, featureKey);
            setClientOverrides(normalizeOverrides(overrides));
            setEffectiveEntitlements(normalizeEffectiveEntitlements(await platformApi.getClientEffectiveEntitlements(id)));
            toast.success('Feature override removed', 'Client-specific feature override was cleared.');
        } catch (error) {
            toast.error('Remove failed', error instanceof Error ? error.message : 'Could not remove feature override.');
        }
    };

    const handleLimitOverrideRemove = async (limitKey: string) => {
        if (!id) return;
        try {
            const overrides = await platformApi.removeClientLimitOverride(id, limitKey);
            setClientOverrides(normalizeOverrides(overrides));
            setEffectiveEntitlements(normalizeEffectiveEntitlements(await platformApi.getClientEffectiveEntitlements(id)));
            toast.success('Limit override removed', 'Client-specific limit override was cleared.');
        } catch (error) {
            toast.error('Remove failed', error instanceof Error ? error.message : 'Could not remove limit override.');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/nexus/clients')}><ArrowLeft size={18} /></button>
                    <div className={styles.clientAvatarLg}>{client.client_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <h1>{client.client_name}</h1>
                        <div className={styles.detailMeta}>
                            <span className={styles.statusBadge} style={{ color: statusColor, background: `${statusColor}18`, borderColor: `${statusColor}55` }}>{STATUS_LABELS[client.status]}</span>
                            <span className={styles.statusBadge} style={{ color: governanceColor, background: `${governanceColor}18`, borderColor: `${governanceColor}55` }}>{GOVERNANCE_LABELS[governanceState]}</span>
                            <span className={styles.metaTag}>{client.client_code}</span>
                            <span className={styles.metaTag}><Globe size={12} /> {client.domain_slug}.kitchenos.com</span>
                        </div>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => navigate(`/nexus/onboarding/${client.id}`)}>Onboarding Workspace</KitchenButton>
                    <KitchenButton onClick={() => navigate(`/nexus/clients/${client.id}/edit`)}><Edit2 size={15} style={{ marginRight: 6 }} />Edit Client</KitchenButton>
                </div>
            </header>

            <div className={styles.tabBar}>
                {TABS.map((tab) => <button key={tab.key} className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
            </div>

            {activeTab === 'overview' && <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><Building2 size={16} /> Client Identity</h3><div className={styles.infoRows}><InfoRow label="Client Code" value={client.client_code} /><InfoRow label="Display Name" value={client.client_name} /><InfoRow label="Legal Name" value={client.legal_name || '—'} /><InfoRow label="Short Name" value={client.short_name || '—'} /><InfoRow label="Business Type" value={client.business_type || '—'} /><InfoRow label="Created" value={new Date(client.created_at).toLocaleString()} /><InfoRow label="Updated" value={new Date(client.updated_at).toLocaleString()} /></div></KitchenCard>
                <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><MapPin size={16} /> Operational Identity</h3><div className={styles.infoRows}><InfoRow label="Slug" value={client.domain_slug} /><InfoRow label="Timezone" value={client.timezone || '—'} /><InfoRow label="Currency" value={client.currency || '—'} /><InfoRow label="Language" value={client.language || '—'} /><InfoRow label="Address" value={client.address || '—'} /><InfoRow label="Locality" value={client.area || '—'} /><InfoRow label="City / Country" value={[client.city, client.country].filter(Boolean).join(', ') || '—'} /><InfoRow label="Website" value={client.website_url || '—'} /></div></KitchenCard>
                <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><Users size={16} /> Platform Summary</h3><div className={styles.infoRows}><InfoRow label="Branches" value={String(client.branch_count)} /><InfoRow label="Users" value={String(client.user_count)} /><InfoRow label="Current Plan" value={currentSubscription?.plan_name || 'No subscription assigned'} /><InfoRow label="Primary Business Contact" value={getContact(client, 'business_primary')?.full_name || '—'} /><InfoRow label="Primary Billing Contact" value={getContact(client, 'billing_primary')?.full_name || '—'} /><InfoRow label="Primary Operations Contact" value={getContact(client, 'operations_primary')?.full_name || '—'} /><InfoRow label="Internal Notes" value={client.comments || '—'} /></div></KitchenCard>
                <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><ShieldCheck size={16} /> Lifecycle Control</h3><div style={{ display: 'grid', gap: 16 }}><div className={styles.infoRows}><InfoRow label="Current Status" value={STATUS_LABELS[client.status]} valueStyle={{ color: statusColor, fontWeight: 700 }} /></div><KitchenSelect label="Next Status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} options={[{ value: '', label: 'Select next lifecycle state' }, { value: 'draft', label: 'Draft' }, { value: 'onboarding', label: 'Onboarding' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'inactive', label: 'Inactive' }, { value: 'closed', label: 'Closed' }].filter((option) => option.value !== client.status)} /><div><label className={styles.fieldLabel}>Reason *</label><textarea className={styles.commentBox} rows={3} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Explain why this lifecycle change is being applied..." /></div><div><label className={styles.fieldLabel}>Notes</label><textarea className={styles.commentBox} rows={3} value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} placeholder="Optional operational note for the lifecycle history..." /></div><KitchenButton onClick={handleLifecycleChange} isLoading={isSavingStatus} disabled={!nextStatus}>Apply Lifecycle Change</KitchenButton></div></KitchenCard>
            </div>}

            {activeTab === 'contacts' && <div className={styles.overviewGrid}>{contactCards.map((card) => <KitchenCard key={card.key} className={styles.overviewCard}><h3 className={styles.cardTitle}><Mail size={16} /> {card.label}</h3><div className={styles.infoRows}><InfoRow label="Name" value={card.contact?.full_name || '—'} /><InfoRow label="Designation" value={card.contact?.designation || '—'} /><InfoRow label="Email" value={card.contact?.email || '—'} /><InfoRow label="Phone" value={card.contact?.phone || '—'} /><InfoRow label="Alternate Phone" value={card.contact?.alternate_phone || '—'} /><InfoRow label="Notes" value={card.contact?.notes || '—'} /></div></KitchenCard>)}</div>}

            {activeTab === 'subscriptions' && <div style={{ display: 'grid', gap: 20 }}>
                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><Package size={16} /> Current Subscription</h3><div className={styles.infoRows}><InfoRow label="Plan" value={currentSubscription?.plan_name || 'No active commercial record'} /><InfoRow label="Status" value={currentSubscription?.status || '—'} /><InfoRow label="Billing Cycle" value={currentSubscription?.billing_cycle || '—'} /><InfoRow label="Price Snapshot" value={currentSubscription ? formatMoney(currentSubscription.price_snapshot, currentSubscription.currency_code) : '—'} /><InfoRow label="Effective Start" value={formatDate(currentSubscription?.effective_start_at)} /><InfoRow label="Effective End" value={formatDate(currentSubscription?.effective_end_at)} /><InfoRow label="Grace Window" value={currentSubscription?.grace_start_at || currentSubscription?.grace_end_at ? `${formatDate(currentSubscription?.grace_start_at)} -> ${formatDate(currentSubscription?.grace_end_at)}` : 'Not in grace'} /><InfoRow label="Trial Window" value={currentSubscription?.is_trial ? `${formatDate(currentSubscription.trial_start_at)} -> ${formatDate(currentSubscription.trial_end_at)}` : 'Not a trial'} /><InfoRow label="Next Commercial Boundary" value={formatDate(currentCommercialEnd)} /></div></KitchenCard>
                    <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><Package size={16} /> Assign Plan to Client</h3><div style={{ display: 'grid', gap: 14 }}><KitchenSelect label="Plan" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} options={[{ value: '', label: 'Select plan' }, ...plans.map((plan) => ({ value: String(plan.id), label: `${plan.plan_name} (${plan.plan_code})` }))]} /><KitchenSelect label="Billing Cycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as 'monthly' | 'annual')} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} /><div className={styles.switchRow}><label className={styles.fieldLabel}>Use Trial</label><div className={styles.switchWrap}><button type="button" className={`${styles.switchBtn} ${useTrial ? styles.switchActive : styles.switchInactive}`} onClick={() => setUseTrial(!useTrial)} disabled={!selectedPlan?.trial_enabled}><div className={styles.switchThumb} /></button><span className={styles.switchLabel}>{selectedPlan?.trial_enabled ? (useTrial ? 'Enabled' : 'Disabled') : 'Plan trial disabled'}</span></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}><label className={styles.fieldLabel}>Effective Start<input className={styles.commentBox} type="datetime-local" value={effectiveStartAt} onChange={(event) => setEffectiveStartAt(event.target.value)} /></label><label className={styles.fieldLabel}>Effective End<input className={styles.commentBox} type="datetime-local" value={effectiveEndAt} onChange={(event) => setEffectiveEndAt(event.target.value)} /></label></div><KitchenInput label="Trial Days" type="number" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} disabled={!useTrial} /><div><label className={styles.fieldLabel}>Reason *</label><textarea className={styles.commentBox} rows={3} value={subscriptionReason} onChange={(event) => setSubscriptionReason(event.target.value)} placeholder="Why is this subscription being assigned?" /></div><div><label className={styles.fieldLabel}>Notes</label><textarea className={styles.commentBox} rows={3} value={subscriptionNotes} onChange={(event) => setSubscriptionNotes(event.target.value)} placeholder="Optional scheduling or commercial note." /></div><KitchenButton onClick={handleAssignSubscription} isLoading={isSavingSubscription} disabled={!selectedPlanId}>Save Subscription Assignment</KitchenButton></div></KitchenCard>
                    <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><ShieldCheck size={16} /> Commercial Status Control</h3>{currentSubscription ? <div style={{ display: 'grid', gap: 14 }}><KitchenSelect label="Next Subscription Status" value={nextSubscriptionStatus} onChange={(event) => setNextSubscriptionStatus(event.target.value)} options={SUBSCRIPTION_STATUS_OPTIONS.filter((option) => option.value !== currentSubscription.status)} />{nextSubscriptionStatus === 'grace' ? <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}><KitchenInput label="Grace Days" type="number" value={subscriptionGraceDays} onChange={(event) => setSubscriptionGraceDays(event.target.value)} /><label className={styles.fieldLabel}>Grace End<input className={styles.commentBox} type="datetime-local" value={subscriptionGraceEndAt} onChange={(event) => setSubscriptionGraceEndAt(event.target.value)} /></label></div><div className={styles.infoBar}><span>If left blank, backend defaults use the client grace profile and then the platform grace default.</span></div></> : null}<div><label className={styles.fieldLabel}>Reason *</label><textarea className={styles.commentBox} rows={3} value={subscriptionStatusReason} onChange={(event) => setSubscriptionStatusReason(event.target.value)} placeholder="Why is the commercial lifecycle changing?" /></div><div><label className={styles.fieldLabel}>Notes</label><textarea className={styles.commentBox} rows={3} value={subscriptionStatusNotes} onChange={(event) => setSubscriptionStatusNotes(event.target.value)} placeholder="Optional operational note." /></div><KitchenButton onClick={handleSubscriptionStatusChange} isLoading={isSavingSubscriptionStatus} disabled={!nextSubscriptionStatus}>Update Subscription Status</KitchenButton></div> : <p style={{ margin: 0, color: 'var(--text-secondary)' }}>A client subscription must exist before commercial status changes can be applied.</p>}</KitchenCard>
                    <KitchenCard className={styles.overviewCard}><h3 className={styles.cardTitle}><Clock3 size={16} /> Renewal Profile</h3><div style={{ display: 'grid', gap: 14 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}><KitchenInput label="Renewal Day" type="number" value={renewalDay} onChange={(event) => setRenewalDay(event.target.value)} /><label className={styles.fieldLabel}>Renewal Date<input className={styles.commentBox} type="date" value={renewalDate} onChange={(event) => setRenewalDate(event.target.value)} /></label></div><KitchenInput label="Default Grace Days" type="number" value={clientGraceDays} onChange={(event) => setClientGraceDays(event.target.value)} /><div className={styles.infoBar}><span>These values drive default grace handling when operators move a subscription into grace without an explicit end date.</span></div><KitchenButton onClick={handleRenewalProfileSave} isLoading={isSavingRenewalProfile} disabled={isSavingRenewalProfile}>Save Renewal Profile</KitchenButton></div></KitchenCard>
                </div>
                <KitchenCard className={styles.tabContent}><div className={styles.tabContentHeader}><h3>Client Subscription History</h3></div><KitchenTable columns={subscriptionColumns} data={subscriptions} emptyMessage="No client subscriptions recorded yet." /></KitchenCard>
                <KitchenCard className={styles.tabContent}><div className={styles.tabContentHeader}><h3>Subscription Change Events</h3></div><KitchenTable columns={subscriptionHistoryColumns} data={flattenedSubscriptionHistory} emptyMessage="No subscription history events recorded yet." /></KitchenCard>
            </div>}

            {activeTab === 'entitlements' && <div style={{ display: 'grid', gap: 20 }}>
                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><Layers size={16} /> Effective Commercial State</h3>
                        <div className={styles.infoRows}>
                            <InfoRow label="Operational" value={effectiveEntitlements?.is_operational ? 'Yes' : 'No'} valueStyle={{ color: effectiveEntitlements?.is_operational ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }} />
                            <InfoRow label="Current Plan" value={effectiveEntitlements?.current_plan_name || currentSubscription?.plan_name || '—'} />
                            <InfoRow label="Client Lifecycle" value={effectiveEntitlements?.client_status || client.status} />
                            <InfoRow label="Subscription State" value={effectiveEntitlements?.subscription_status || currentSubscription?.status || '—'} />
                            <InfoRow label="Blocking Reason" value={effectiveEntitlements?.blocking_reason || 'None'} valueStyle={{ color: effectiveEntitlements?.blocking_reason ? 'var(--danger)' : 'var(--success)' }} />
                        </div>
                        {effectiveEntitlements?.warnings?.length ? (
                            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                                {effectiveEntitlements.warnings.map((warning) => (
                                    <div key={warning} className={styles.infoBar} style={{ marginBottom: 0, color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)' }}>
                                        <AlertTriangle size={14} />
                                        <span>{warning}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </KitchenCard>

                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><Package size={16} /> Usage vs Limits</h3>
                        <div style={{ display: 'grid', gap: 12 }}>
                            {usageRows.map((entry) => {
                                const used = effectiveEntitlements?.usage?.[entry.key] ?? 0;
                                const limit = effectiveEntitlements?.limits?.[entry.key];
                                const isExceeded = limit !== null && limit !== undefined && used >= limit;
                                return (
                                    <div key={entry.key} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--glass-bg)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                                            <strong style={{ color: 'var(--text-primary)' }}>{entry.label}</strong>
                                            <span style={{ color: isExceeded ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 700 }}>
                                                {used} / {limit === null || limit === undefined ? 'Unlimited' : limit}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: isExceeded ? 'var(--danger)' : 'var(--text-muted)' }}>
                                            {isExceeded ? 'Hard block enforced on new writes.' : 'Existing data remains readable even when usage is near the cap.'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </KitchenCard>
                </div>

                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}>
                        <div className={styles.tabContentHeader}>
                            <h3>Effective Features</h3>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {platformFeatures.filter((feature) => feature.is_active).map((feature) => {
                                const enabled = effectiveEntitlements?.features?.includes(feature.feature_key) || false;
                                const source = effectiveEntitlements?.feature_sources?.[feature.feature_key];
                                return (
                                    <div key={feature.feature_key} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 12, background: enabled ? 'var(--badge-success-bg)' : 'var(--glass-bg)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{feature.feature_name}</div>
                                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{feature.feature_key}</div>
                                            </div>
                                            <span className={styles.statusBadge} style={{
                                                color: enabled ? 'var(--success)' : 'var(--danger)',
                                                background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                borderColor: enabled ? 'rgba(34,197,94,0.32)' : 'rgba(239,68,68,0.32)',
                                            }}>
                                                {enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {feature.description || 'No description provided.'}
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Source: {source ? SOURCE_LABELS[source] : 'Not granted'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.overviewCard}>
                        <div className={styles.tabContentHeader}>
                            <h3>Client Overrides</h3>
                        </div>
                        <div style={{ display: 'grid', gap: 16 }}>
                            <div style={{ display: 'grid', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)' }}>
                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Feature Override</h4>
                                <KitchenSelect label="Feature" value={featureOverrideKey} onChange={(event) => setFeatureOverrideKey(event.target.value)} options={featureOptions} />
                                <KitchenSelect label="Override Action" value={featureOverrideState} onChange={(event) => setFeatureOverrideState(event.target.value as 'enabled' | 'disabled')} options={FEATURE_STATE_OPTIONS} />
                                <div>
                                    <label className={styles.fieldLabel}>Reason *</label>
                                    <textarea className={styles.commentBox} rows={3} value={featureOverrideReason} onChange={(event) => setFeatureOverrideReason(event.target.value)} placeholder="Why is this feature being overridden for this client?" />
                                </div>
                                <div>
                                    <label className={styles.fieldLabel}>Notes</label>
                                    <textarea className={styles.commentBox} rows={2} value={featureOverrideNotes} onChange={(event) => setFeatureOverrideNotes(event.target.value)} placeholder="Optional operational note." />
                                </div>
                                <KitchenButton onClick={handleFeatureOverrideSave} isLoading={isSavingFeatureOverride} disabled={!featureOverrideKey}>Save Feature Override</KitchenButton>
                            </div>

                            <div style={{ display: 'grid', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)' }}>
                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Limit Override</h4>
                                <KitchenSelect label="Limit" value={limitOverrideKey} onChange={(event) => setLimitOverrideKey(event.target.value)} options={LIMIT_KEY_OPTIONS} />
                                <KitchenInput label="Override Value" type="number" value={limitOverrideValue} onChange={(event) => setLimitOverrideValue(event.target.value)} />
                                <div>
                                    <label className={styles.fieldLabel}>Reason *</label>
                                    <textarea className={styles.commentBox} rows={3} value={limitOverrideReason} onChange={(event) => setLimitOverrideReason(event.target.value)} placeholder="Why is this limit being overridden for this client?" />
                                </div>
                                <div>
                                    <label className={styles.fieldLabel}>Notes</label>
                                    <textarea className={styles.commentBox} rows={2} value={limitOverrideNotes} onChange={(event) => setLimitOverrideNotes(event.target.value)} placeholder="Optional operational note." />
                                </div>
                                <KitchenButton onClick={handleLimitOverrideSave} isLoading={isSavingLimitOverride} disabled={!limitOverrideKey || limitOverrideValue === ''}>Save Limit Override</KitchenButton>
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Active Feature Overrides</h4>
                                {clientOverrides.feature_overrides.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No feature overrides recorded for this client.</p>
                                ) : clientOverrides.feature_overrides.map((override) => (
                                    <div key={`${override.feature_key}-${override.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{override.feature_name || override.feature_key}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{override.is_enabled ? 'Force enabled' : 'Force disabled'}</div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{override.reason || 'No reason provided'}</div>
                                        </div>
                                        <button type="button" className={styles.actionBtn} onClick={() => handleFeatureOverrideRemove(override.feature_key)} title="Remove override">
                                            <XCircle size={15} />
                                        </button>
                                    </div>
                                ))}

                                <h4 style={{ margin: '8px 0 0', color: 'var(--text-primary)' }}>Active Limit Overrides</h4>
                                {clientOverrides.limit_overrides.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No limit overrides recorded for this client.</p>
                                ) : clientOverrides.limit_overrides.map((override) => (
                                    <div key={`${override.limit_key}-${override.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{LIMIT_LABELS[override.limit_key]}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Override value: {override.limit_value}</div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{override.reason || 'No reason provided'}</div>
                                        </div>
                                        <button type="button" className={styles.actionBtn} onClick={() => handleLimitOverrideRemove(override.limit_key)} title="Remove override">
                                            <XCircle size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            </div>}

            {activeTab === 'governance' && <div style={{ display: 'grid', gap: 20 }}>
                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Governance State</h3>
                        <div className={styles.infoRows}>
                            <InfoRow label="Current State" value={GOVERNANCE_LABELS[governanceState]} valueStyle={{ color: governanceColor, fontWeight: 700 }} />
                            <InfoRow label="Access Mode" value={governance?.access_mode || 'full'} valueStyle={{ color: governance?.access_mode === 'blocked' ? 'var(--danger)' : governance?.access_mode === 'read_only' ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }} />
                            <InfoRow label="Lifecycle Status" value={governance?.lifecycle_status || client.status} />
                            <InfoRow label="Trigger Context" value={governance?.trigger_context ? GOVERNANCE_CONTEXT_LABELS[governance.trigger_context] : '-'} />
                            <InfoRow label="Reason" value={governance?.reason || '-'} />
                            <InfoRow label="Risk Notes" value={governance?.notes || '-'} />
                            <InfoRow label="Updated" value={formatDate(governance?.updated_at)} />
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Enforcement Summary</h3>
                        <div className={styles.infoRows}>
                            <InfoRow label="Login Behavior" value={governanceState === 'restricted' ? 'Allowed' : governanceState === 'normal' ? 'Allowed' : 'Blocked'} />
                            <InfoRow label="Read Requests" value={governanceState === 'normal' || governanceState === 'restricted' ? 'Allowed' : 'Blocked'} />
                            <InfoRow label="Write Requests" value={governanceState === 'normal' ? 'Allowed' : 'Blocked'} valueStyle={{ color: governanceState === 'normal' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }} />
                            <InfoRow label="Data Preservation" value="Preserved" />
                            <InfoRow label="Allowed Next States" value={governance?.allowed_next_states?.length ? governance.allowed_next_states.map((state) => GOVERNANCE_LABELS[state]).join(', ') : 'No further governance transitions allowed'} />
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Isolation & Audit Health</h3>
                        <div className={styles.infoRows}>
                            <InfoRow label="Health" value={inspection?.health_status || 'healthy'} valueStyle={{ color: inspection?.health_status === 'critical' ? 'var(--danger)' : inspection?.health_status === 'warning' ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }} />
                            <InfoRow label="Active Branches" value={`${inspection?.branch_summary?.active ?? client.branch_count} / ${inspection?.branch_summary?.total ?? client.branch_count}`} />
                            <InfoRow label="Central Stores" value={String(inspection?.branch_summary?.central ?? 0)} />
                            <InfoRow label="Active Users" value={`${inspection?.user_summary?.active ?? client.user_count} / ${inspection?.user_summary?.total ?? client.user_count}`} />
                            <InfoRow label="Audit Events (7d)" value={String(inspection?.audit_snapshot?.total_events ?? 0)} />
                            <InfoRow label="Warnings / Errors (7d)" value={`${inspection?.audit_snapshot?.warning_events ?? 0} / ${inspection?.audit_snapshot?.error_events ?? 0}`} />
                            <InfoRow label="Last Audit Event" value={formatDate(inspection?.audit_snapshot?.last_event_at)} />
                        </div>
                        {inspection?.findings?.length ? (
                            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                                {inspection.findings.map((finding) => (
                                    <div key={finding.code} className={styles.infoBar} style={{ marginBottom: 0, color: finding.severity === 'critical' ? 'var(--danger)' : 'var(--warning)', borderColor: finding.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', background: finding.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)' }}>
                                        <AlertTriangle size={14} />
                                        <span>{finding.message}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </KitchenCard>

                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Governance Action</h3>
                        <div style={{ display: 'grid', gap: 14 }}>
                            <KitchenSelect label="Next Governance State" value={nextGovernanceState} onChange={(event) => setNextGovernanceState(event.target.value)} options={governanceOptions.filter((option) => option.value !== governanceState)} />
                            <KitchenSelect label="Trigger Context" value={governanceContext} onChange={(event) => setGovernanceContext(event.target.value)} options={GOVERNANCE_CONTEXT_OPTIONS} />
                            <div>
                                <label className={styles.fieldLabel}>Reason *</label>
                                <textarea className={styles.commentBox} rows={3} value={governanceReason} onChange={(event) => setGovernanceReason(event.target.value)} placeholder="Why is this governance action being applied?" />
                            </div>
                            <div>
                                <label className={styles.fieldLabel}>Notes</label>
                                <textarea className={styles.commentBox} rows={3} value={governanceNotes} onChange={(event) => setGovernanceNotes(event.target.value)} placeholder="Optional internal context for support/risk review." />
                            </div>
                            <KitchenButton onClick={handleGovernanceChange} isLoading={isSavingGovernance} disabled={!nextGovernanceState || !governanceContext || governanceOptions.length <= 1}>Apply Governance Action</KitchenButton>
                        </div>
                    </KitchenCard>
                </div>

                <KitchenCard className={styles.tabContent}>
                    <div className={styles.tabContentHeader}><h3>Governance History</h3></div>
                    <KitchenTable columns={governanceColumns} data={governanceHistory} emptyMessage="No governance actions recorded yet." />
                </KitchenCard>
            </div>}

            {activeTab === 'history' && <div style={{ display: 'grid', gap: 20 }}><KitchenCard className={styles.tabContent}><div className={styles.tabContentHeader}><h3>Status Transition History</h3></div><KitchenTable columns={statusColumns} data={statusHistory} emptyMessage="No lifecycle transitions recorded yet." /></KitchenCard><KitchenCard className={styles.tabContent}><div className={styles.tabContentHeader}><h3>Administrative Audit Trail</h3></div><KitchenTable columns={auditColumns} data={auditItems} emptyMessage="No administrative audit records found for this client." /></KitchenCard></div>}
        </div>
    );
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: CSSProperties }) {
    return <div className={styles.infoRow}><div className={styles.infoRowIcon}><Phone size={14} /></div><span className={styles.infoRowLabel}>{label}</span><span className={styles.infoRowValue} style={valueStyle}>{value}</span></div>;
}
