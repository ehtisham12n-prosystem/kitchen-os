import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, Edit2, Eye, Package, Plus, Search, ShieldAlert } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './SubscriptionGroup.module.css';

type PlanStatus = 'draft' | 'active' | 'retired';

interface PlanRecord {
    id: number;
    plan_code: string;
    plan_name: string;
    description?: string | null;
    plan_status: PlanStatus;
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
    total_subscription_count?: number;
    created_at: string;
}

const PLAN_STATUS_OPTIONS: Array<{ value: 'all' | PlanStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'retired', label: 'Retired' },
];

const STATUS_META: Record<PlanStatus, { label: string; accent: string }> = {
    draft: { label: 'Draft', accent: 'var(--warning)' },
    active: { label: 'Active', accent: 'var(--success)' },
    retired: { label: 'Retired', accent: 'var(--danger)' },
};

export function SubscriptionGroupList() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<PlanRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | PlanStatus>('all');

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await platformApi.getSubscriptionPlans();
            setPlans(data.map((plan: any) => ({
                id: Number(plan.id),
                plan_code: plan.plan_code || '',
                plan_name: plan.plan_name || 'Unnamed plan',
                description: plan.description || '',
                plan_status: (plan.plan_status || (plan.is_active ? 'active' : 'draft')) as PlanStatus,
                currency_code: plan.currency_code || 'PKR',
                monthly_price: Number(plan.monthly_price || 0),
                annual_price: Number(plan.annual_price || 0),
                trial_enabled: Boolean(plan.trial_enabled),
                default_trial_days: Number(plan.default_trial_days || 0),
                max_branches: Number(plan.max_branches || 0),
                max_users: Number(plan.max_users || 0),
                max_pos_devices: Number(plan.max_pos_devices || 0),
                allowed_modules: Array.isArray(plan.allowed_modules) ? plan.allowed_modules : [],
                client_count: Number(plan.client_count || 0),
                total_subscription_count: Number(plan.total_subscription_count || 0),
                created_at: plan.created_at,
            })));
        } catch (error) {
            toast.error('Load failed', error instanceof Error ? error.message : 'Could not load subscription plans.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filteredPlans = useMemo(() => plans.filter((plan) => {
        const searchValue = search.trim().toLowerCase();
        const matchesSearch = !searchValue
            || plan.plan_name.toLowerCase().includes(searchValue)
            || plan.plan_code.toLowerCase().includes(searchValue)
            || (plan.description || '').toLowerCase().includes(searchValue);
        const matchesStatus = statusFilter === 'all' || plan.plan_status === statusFilter;
        return matchesSearch && matchesStatus;
    }), [plans, search, statusFilter]);

    const totals = useMemo(() => ({
        total: plans.length,
        active: plans.filter((plan) => plan.plan_status === 'active').length,
        draft: plans.filter((plan) => plan.plan_status === 'draft').length,
        retired: plans.filter((plan) => plan.plan_status === 'retired').length,
        assigned: plans.reduce((sum, plan) => sum + Number(plan.client_count || 0), 0),
    }), [plans]);

    const handleStatusChange = async (plan: PlanRecord, nextStatus: PlanStatus) => {
        try {
            await platformApi.updateSubscriptionPlanStatus(plan.id, nextStatus);
            toast.success('Plan updated', `${plan.plan_name} is now ${nextStatus}.`);
            await load();
        } catch (error) {
            toast.error('Update failed', error instanceof Error ? error.message : 'Could not update plan status.');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <Package size={22} />
                    </div>
                    <div>
                        <h1>Subscription Plans</h1>
                        <p>Manage commercial plans, live feature entitlements, usage limits, and active client assignments.</p>
                    </div>
                </div>
                <KitchenButton onClick={() => navigate('/nexus/subscription_pack/new')}>
                    <Plus size={16} style={{ marginRight: 6 }} />
                    New Plan
                </KitchenButton>
            </header>

            {isLoading ? (
                <div className={styles.loadingBox}>
                    <Clock3 size={32} className={styles.spin} />
                    <p>Loading subscription plans...</p>
                </div>
            ) : (
                <>
                    <div className={styles.kpiGrid}>
                        <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                        <Package size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Total Plans</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{totals.total}</div>
                            <div className={styles.kpiMeta}><span>{totals.active} active</span></div>
                        </div>

                        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Assigned Clients</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{totals.assigned}</div>
                            <div className={styles.kpiMeta}><span>Live commercial assignments</span></div>
                        </div>

                        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                        <Clock3 size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Draft Plans</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{totals.draft}</div>
                            <div className={styles.kpiMeta}><span>Not yet assignable</span></div>
                        </div>

                        <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                                        <ShieldAlert size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Retired Plans</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{totals.retired}</div>
                            <div className={styles.kpiMeta}><span>Historical only for new sales</span></div>
                        </div>
                    </div>

                    <div className={styles.filterBar}>
                        <div className={styles.searchWrap}>
                            <Search size={15} className={styles.searchIcon} />
                            <input
                                className={styles.searchInput}
                                placeholder="Search plans by code, name, or description..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <div className={styles.filterTabs}>
                            {PLAN_STATUS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    className={`${styles.filterTab} ${statusFilter === option.value ? styles.filterTabActive : ''}`}
                                    onClick={() => setStatusFilter(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.groupGrid}>
                        {filteredPlans.length === 0 ? (
                            <div className={styles.empty}>
                                <Package size={42} />
                                <p>No plans matched the current filters.</p>
                            </div>
                        ) : filteredPlans.map((plan) => {
                            const meta = STATUS_META[plan.plan_status];
                            const nextStatus = plan.plan_status === 'active'
                                ? 'retired'
                                : 'active';

                            return (
                                <div key={plan.id} className={styles.groupCard}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardTitleRow}>
                                            <h3 className={styles.cardName}>{plan.plan_name}</h3>
                                            <span
                                                className={styles.statusBadge}
                                                style={{
                                                    color: meta.accent,
                                                    background: `${meta.accent}15`,
                                                    borderColor: `${meta.accent}55`,
                                                }}
                                            >
                                                {meta.label}
                                            </span>
                                        </div>
                                        <p className={styles.cardDesc}>{plan.description || 'No plan description provided.'}</p>
                                    </div>

                                    <div className={styles.infoBar}>
                                        <span><strong>Code:</strong> {plan.plan_code}</span>
                                        <span><strong>Currency:</strong> {plan.currency_code || 'PKR'}</span>
                                    </div>

                                    <div className={styles.pricingRow}>
                                        <div className={styles.priceItem}>
                                            <span className={styles.priceLabel}>Monthly</span>
                                            <span className={styles.priceValue}>{plan.currency_code || 'PKR'} {plan.monthly_price.toLocaleString()}</span>
                                        </div>
                                        <div className={styles.priceDivider} />
                                        <div className={styles.priceItem}>
                                            <span className={styles.priceLabel}>Annual</span>
                                            <span className={styles.priceValue}>{plan.currency_code || 'PKR'} {plan.annual_price.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className={styles.limitsRow}>
                                        <div className={styles.limitItem}>
                                            <div className={styles.limitInfo}>
                                                <span className={styles.limitVal}>{plan.client_count}</span>
                                                <span className={styles.limitLab}>Live Clients</span>
                                            </div>
                                        </div>
                                        <div className={styles.limitItem}>
                                            <div className={styles.limitInfo}>
                                                <span className={styles.limitVal}>{plan.total_subscription_count || 0}</span>
                                                <span className={styles.limitLab}>History Rows</span>
                                            </div>
                                        </div>
                                        <div className={styles.limitItem}>
                                            <div className={styles.limitInfo}>
                                                <span className={styles.limitVal}>{plan.trial_enabled ? `${plan.default_trial_days || 0}d` : 'Off'}</span>
                                                <span className={styles.limitLab}>Trial</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.infoBar}>
                                        <span><strong>Limits:</strong> {plan.max_branches} branches, {plan.max_users} users, {plan.max_pos_devices} POS devices</span>
                                        <span><strong>Features:</strong> {plan.allowed_modules.length || 0}</span>
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <span className={styles.clientCount}>
                                            {plan.plan_status === 'retired'
                                                ? 'Retired plans remain available in history only.'
                                                : 'Historical pricing is snapshotted per assignment.'}
                                        </span>
                                        <div className={styles.cardActions}>
                                            <button className={styles.actionBtn} title="View detail" onClick={() => navigate(`/nexus/subscription_pack/${plan.id}`)}>
                                                <Eye size={15} />
                                            </button>
                                            <button className={styles.actionBtn} title="Edit plan" onClick={() => navigate(`/nexus/subscription_pack/${plan.id}/edit`)}>
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                className={styles.actionBtn}
                                                title={nextStatus === 'active' ? 'Activate plan' : 'Retire plan'}
                                                onClick={() => handleStatusChange(plan, nextStatus)}
                                            >
                                                {nextStatus === 'active' ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
