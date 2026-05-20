import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock3, GitBranch, LifeBuoy, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformDashboardApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

interface QueueRow {
    client_id: string;
    client_code?: string | null;
    client_name: string;
    client_status?: string;
    governance_state?: string;
    subscription_status?: string | null;
    current_plan_name?: string | null;
    reason?: string;
    severity?: 'info' | 'warning' | 'critical';
    expires_at?: string;
    days_remaining?: number;
    onboarding_status?: string;
}

interface AttentionSummary {
    expiring_subscriptions: QueueRow[];
    blocked_clients: QueueRow[];
    onboarding_attention: QueueRow[];
    governance_attention: QueueRow[];
    limit_attention: QueueRow[];
    sync_attention: QueueRow[];
    failed_jobs_attention: QueueRow[];
    client_health: QueueRow[];
    queue_sizes: {
        expiring_subscriptions: number;
        blocked_clients: number;
        onboarding_attention: number;
        governance_attention: number;
        limit_attention: number;
        sync_attention: number;
        failed_jobs_attention: number;
        client_health: number;
    };
}

export default function UsageRadar() {
    const navigate = useNavigate();
    const [data, setData] = useState<AttentionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = async () => {
        setIsLoading(true);
        try {
            const response = await platformDashboardApi.getAttentionSummary();
            setData(response);
        } catch (error) {
            toast.error('Failed to load attention radar', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const columns: ColumnDef<QueueRow>[] = useMemo(() => ([
        {
            key: 'client_name',
            header: 'Client',
            cell: (row) => (
                <div className={styles.clientCell}>
                    <div className={styles.clientAvatar}>{row.client_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <div className={styles.clientName}>{row.client_name}</div>
                        <div className={styles.clientSlug}>{row.client_code || row.client_id}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'summary',
            header: 'Summary',
            cell: (row) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{row.reason || (row.days_remaining !== undefined ? `${row.days_remaining} day(s) remaining` : '-')}</span>
                    <span className={styles.planExpiry}>{row.current_plan_name || row.subscription_status || row.governance_state || row.onboarding_status || '-'}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <KitchenButton size="sm" variant="secondary" onClick={() => navigate(`/nexus/support/clients/${row.client_id}`)}>
                    <ArrowRight size={14} style={{ marginRight: 6 }} />
                    Open 360
                </KitchenButton>
            ),
        },
    ]), [navigate]);

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <TrendingUp size={36} className={styles.spin} />
                <span>Loading attention radar...</span>
            </div>
        );
    }

    const counts = data?.queue_sizes || {
        expiring_subscriptions: 0,
        blocked_clients: 0,
        onboarding_attention: 0,
        governance_attention: 0,
        limit_attention: 0,
        sync_attention: 0,
        failed_jobs_attention: 0,
        client_health: 0,
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><AlertTriangle size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Phase 3 Batch 8</div>
                        <h1>Attention Radar</h1>
                        <p>Operational queues for expiry, limits, governance, and onboarding follow-up.</p>
                    </div>
                </div>
                <div className={styles.actionGroup}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus')}>
                        <LifeBuoy size={15} style={{ marginRight: 6 }} />
                        Back to Dashboard
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{counts.expiring_subscriptions}</div>
                    <div className={styles.kpiLabel}>Expiring Subscriptions</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{counts.blocked_clients}</div>
                    <div className={styles.kpiLabel}>Blocked Clients</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{counts.onboarding_attention}</div>
                    <div className={styles.kpiLabel}>Onboarding Attention</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{counts.sync_attention + counts.failed_jobs_attention}</div>
                    <div className={styles.kpiLabel}>Sync / Job Alerts</div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Clock3 size={16} /> Expiring Subscriptions</h3>
                    <KitchenTable columns={columns} data={data?.expiring_subscriptions || []} emptyMessage="No expiring subscriptions in the next 30 days." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldAlert size={16} /> Blocked Clients</h3>
                    <KitchenTable columns={columns} data={data?.blocked_clients || []} emptyMessage="No clients are currently blocked." />
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><GitBranch size={16} /> Onboarding Attention</h3>
                    <KitchenTable columns={columns} data={data?.onboarding_attention || []} emptyMessage="No onboarding workflows need intervention." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Users size={16} /> Limit Attention</h3>
                    <KitchenTable columns={columns} data={data?.limit_attention || []} emptyMessage="No clients are currently near or over plan limits." />
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Governance Attention</h3>
                </div>
                <KitchenTable columns={columns} data={data?.governance_attention || []} emptyMessage="No governance attention items are active." />
            </KitchenCard>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Sync Attention</h3>
                    <KitchenTable columns={columns} data={data?.sync_attention || []} emptyMessage="No cross-tenant sync issues are open." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldAlert size={16} /> Failed Jobs</h3>
                    <KitchenTable columns={columns} data={data?.failed_jobs_attention || []} emptyMessage="No onboarding or blueprint failures are active." />
                </KitchenCard>
            </div>
        </div>
    );
}
