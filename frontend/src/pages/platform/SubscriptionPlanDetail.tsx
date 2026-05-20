import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, Edit2, Package, Save, ToggleLeft } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './SubscriptionGroup.module.css';

interface PlanDetail {
    id: number;
    plan_code: string;
    plan_name: string;
    description?: string | null;
    plan_status: 'draft' | 'active' | 'retired';
    currency_code?: string | null;
    monthly_price: number;
    annual_price: number;
    trial_enabled: boolean;
    default_trial_days: number;
    max_branches: number;
    max_users: number;
    max_pos_devices: number;
    allowed_modules: string[];
    client_count: number;
    total_subscription_events: number;
    created_at: string;
    updated_at: string;
    recent_subscriptions: Array<{
        id: number;
        client_id: string;
        client_name: string;
        status: string;
        billing_cycle: string;
        price_snapshot: number;
        effective_start_at?: string | null;
        effective_end_at?: string | null;
        created_at: string;
    }>;
}

interface FeatureToggle {
    id: number;
    feature_key: string;
    feature_name: string;
    description?: string | null;
    is_active: boolean;
    is_enabled: boolean;
}

export function SubscriptionPlanDetail() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [plan, setPlan] = useState<PlanDetail | null>(null);
    const [features, setFeatures] = useState<FeatureToggle[]>([]);
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [limits, setLimits] = useState({
        max_branches: '1',
        max_active_users: '5',
        max_pos_devices: '1',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingEntitlements, setIsSavingEntitlements] = useState(false);
    const [isSavingLimits, setIsSavingLimits] = useState(false);

    const load = async () => {
        if (!id) {
            return;
        }

        setIsLoading(true);
        try {
            const [planData, entitlementData, limitData] = await Promise.all([
                platformApi.getSubscriptionPlan(id),
                platformApi.getPlanEntitlements(id),
                platformApi.getPlanLimits(id),
            ]);

            setPlan({
                ...planData,
                monthly_price: Number(planData.monthly_price || 0),
                annual_price: Number(planData.annual_price || 0),
                client_count: Number(planData.client_count || 0),
                total_subscription_events: Number(planData.total_subscription_events || 0),
                default_trial_days: Number(planData.default_trial_days || 0),
                max_branches: Number(planData.max_branches || 0),
                max_users: Number(planData.max_users || 0),
                max_pos_devices: Number(planData.max_pos_devices || 0),
                allowed_modules: Array.isArray(planData.allowed_modules) ? planData.allowed_modules : [],
                recent_subscriptions: Array.isArray(planData.recent_subscriptions) ? planData.recent_subscriptions.map((entry: any) => ({
                    ...entry,
                    price_snapshot: Number(entry.price_snapshot || 0),
                })) : [],
            });

            const featureRows = Array.isArray(entitlementData?.features) ? entitlementData.features.map((feature: any) => ({
                id: Number(feature.id),
                feature_key: feature.feature_key,
                feature_name: feature.feature_name,
                description: feature.description,
                is_active: Boolean(feature.is_active),
                is_enabled: Boolean(feature.is_enabled),
            })) : [];

            setFeatures(featureRows);
            setSelectedFeatures(featureRows.filter((feature: FeatureToggle) => feature.is_enabled).map((feature: FeatureToggle) => feature.feature_key));
            setLimits({
                max_branches: String(Number(limitData?.limits?.max_branches || 0)),
                max_active_users: String(Number(limitData?.limits?.max_active_users || 0)),
                max_pos_devices: String(Number(limitData?.limits?.max_pos_devices || 0)),
            });
        } catch (error) {
            toast.error('Load failed', error instanceof Error ? error.message : 'Could not load plan detail.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [id]);

    const columns = useMemo<ColumnDef<PlanDetail['recent_subscriptions'][number]>[]>(() => [
        {
            key: 'client_name',
            header: 'Client',
            cell: (row) => `${row.client_name} (${row.client_id})`,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => row.status,
        },
        {
            key: 'billing_cycle',
            header: 'Cycle',
            cell: (row) => row.billing_cycle,
        },
        {
            key: 'price_snapshot',
            header: 'Price',
            cell: (row) => `${plan?.currency_code || 'PKR'} ${Number(row.price_snapshot || 0).toLocaleString()}`,
        },
        {
            key: 'effective_start_at',
            header: 'Effective',
            cell: (row) => row.effective_start_at ? new Date(row.effective_start_at).toLocaleDateString() : '-',
        },
        {
            key: 'created_at',
            header: 'Created',
            cell: (row) => new Date(row.created_at).toLocaleString(),
        },
    ], [plan?.currency_code]);

    const toggleFeature = (featureKey: string) => {
        setSelectedFeatures((prev) => prev.includes(featureKey)
            ? prev.filter((entry) => entry !== featureKey)
            : [...prev, featureKey]);
    };

    const saveEntitlements = async () => {
        if (!id) {
            return;
        }
        setIsSavingEntitlements(true);
        try {
            await platformApi.updatePlanEntitlements(id, selectedFeatures);
            toast.success('Entitlements updated', 'Plan feature access has been saved.');
            await load();
        } catch (error) {
            toast.error('Save failed', error instanceof Error ? error.message : 'Could not save plan entitlements.');
        } finally {
            setIsSavingEntitlements(false);
        }
    };

    const saveLimits = async () => {
        if (!id) {
            return;
        }
        setIsSavingLimits(true);
        try {
            await platformApi.updatePlanLimits(id, {
                max_branches: Number(limits.max_branches || 0),
                max_active_users: Number(limits.max_active_users || 0),
                max_pos_devices: Number(limits.max_pos_devices || 0),
            });
            toast.success('Limits updated', 'Plan usage limits have been saved.');
            await load();
        } catch (error) {
            toast.error('Save failed', error instanceof Error ? error.message : 'Could not save plan limits.');
        } finally {
            setIsSavingLimits(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingBox}>
                <Clock3 size={32} className={styles.spin} />
                <p>Loading subscription plan...</p>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className={styles.empty}>
                <Package size={42} />
                <p>Plan not found.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/nexus/subscription_pack')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.iconBox}>
                        <Package size={22} />
                    </div>
                    <div>
                        <h1>{plan.plan_name}</h1>
                        <p>{plan.plan_code} • {plan.plan_status} • {plan.currency_code || 'PKR'}</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton onClick={() => navigate(`/nexus/subscription_pack/${plan.id}/edit`)}>
                        <Edit2 size={16} style={{ marginRight: 6 }} />
                        Edit Plan
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.formGrid}>
                <KitchenCard className={styles.formCard}>
                    <h3 className={styles.cardTitle}>Commercial Summary</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Status:</strong> {plan.plan_status}</div>
                        <div><strong>Description:</strong> {plan.description || 'No description provided.'}</div>
                        <div><strong>Monthly:</strong> {plan.currency_code || 'PKR'} {plan.monthly_price.toLocaleString()}</div>
                        <div><strong>Annual:</strong> {plan.currency_code || 'PKR'} {plan.annual_price.toLocaleString()}</div>
                        <div><strong>Trial:</strong> {plan.trial_enabled ? `${plan.default_trial_days || 0} days default` : 'Disabled'}</div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.formCard}>
                    <h3 className={styles.cardTitle}>Assignment Summary</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Live Clients:</strong> {plan.client_count}</div>
                        <div><strong>History Events:</strong> {plan.total_subscription_events}</div>
                        <div><strong>Branch Cap:</strong> {plan.max_branches}</div>
                        <div><strong>Active User Cap:</strong> {plan.max_users}</div>
                        <div><strong>POS Device Cap:</strong> {plan.max_pos_devices}</div>
                    </div>
                </KitchenCard>
            </div>

            <div className={styles.formGrid}>
                <KitchenCard className={styles.formCard}>
                    <div className={styles.cardTitle} style={{ justifyContent: 'space-between' }}>
                        <span><ToggleLeft size={16} style={{ marginRight: 6 }} /> Plan Features</span>
                        <KitchenButton onClick={saveEntitlements} isLoading={isSavingEntitlements} disabled={isSavingEntitlements}>
                            <Save size={15} style={{ marginRight: 6 }} />
                            Save Features
                        </KitchenButton>
                    </div>
                    <div className={styles.moduleGrid}>
                        {features.map((feature) => {
                            const selected = selectedFeatures.includes(feature.feature_key);
                            return (
                                <button
                                    key={feature.feature_key}
                                    type="button"
                                    className={`${styles.moduleToggle} ${selected ? styles.moduleToggleOn : ''}`}
                                    onClick={() => toggleFeature(feature.feature_key)}
                                    disabled={!feature.is_active}
                                >
                                    <div className={styles.moduleInfo}>
                                        <span className={styles.moduleLabel}>{feature.feature_name}</span>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{feature.feature_key}</span>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{feature.description || 'No description provided.'}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.formCard}>
                    <div className={styles.cardTitle} style={{ justifyContent: 'space-between' }}>
                        <span><Package size={16} style={{ marginRight: 6 }} /> Plan Limits</span>
                        <KitchenButton onClick={saveLimits} isLoading={isSavingLimits} disabled={isSavingLimits}>
                            <Save size={15} style={{ marginRight: 6 }} />
                            Save Limits
                        </KitchenButton>
                    </div>
                    <div className={styles.row2}>
                        <KitchenInput
                            label="Max Branches"
                            type="number"
                            value={limits.max_branches}
                            onChange={(event) => setLimits((prev) => ({ ...prev, max_branches: event.target.value }))}
                        />
                        <KitchenInput
                            label="Max Active Users"
                            type="number"
                            value={limits.max_active_users}
                            onChange={(event) => setLimits((prev) => ({ ...prev, max_active_users: event.target.value }))}
                        />
                    </div>
                    <KitchenInput
                        label="Max POS Devices"
                        type="number"
                        value={limits.max_pos_devices}
                        onChange={(event) => setLimits((prev) => ({ ...prev, max_pos_devices: event.target.value }))}
                    />
                    <div className={styles.infoBar}>
                        <span>These limits are enforced in backend write paths for branches, active users, and POS device registration.</span>
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.formCard}>
                <h3 className={styles.cardTitle}>Recent Client Subscriptions</h3>
                <KitchenTable
                    columns={columns}
                    data={plan.recent_subscriptions}
                    emptyMessage="No client subscriptions have been created for this plan yet."
                />
            </KitchenCard>
        </div>
    );
}
