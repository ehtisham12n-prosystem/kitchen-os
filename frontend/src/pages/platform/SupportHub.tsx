import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, LifeBuoy, Radar, ShieldAlert, TrendingUp } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

interface QueueItem {
    client_id: string;
    client_code?: string | null;
    client_name: string;
    client_status: string;
    governance_state?: string | null;
    subscription_status?: string | null;
    current_plan_name?: string | null;
    severity: 'info' | 'warning' | 'critical';
    reason: string;
    issue_count?: number;
}

interface UsageRow {
    client_id: string;
    client_code?: string | null;
    client_name: string;
    current_plan_name?: string | null;
    severity: 'info' | 'warning' | 'critical';
    reason: string;
    highest_usage_percent: number;
    usage: Array<{ key: string; label: string; used: number; limit: number | null; percent: number | null }>;
}

interface DiagnosticRow {
    client_id: string;
    client_code?: string | null;
    client_name: string;
    source: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp?: string | null;
    branch_name?: string | null;
}

interface SupportDashboardData {
    metrics: {
        total_clients: number;
        active_clients: number;
        blocked_clients: number;
        onboarding_attention: number;
        governance_attention: number;
        limit_attention: number;
        trial_clients: number;
    };
    operational_metrics: {
        monitored_clients: number;
        monitored_branches: number;
        monitored_devices: number;
        clients_with_sync_issues: number;
        failed_sync_events: number;
        conflicted_sync_events: number;
        clients_with_failed_jobs: number;
        failed_job_count: number;
        unhealthy_clients: number;
    };
    issue_summary: {
        open_issues: number;
        critical: number;
        warning: number;
        categories: Array<{ key: string; label: string; count: number; severity: 'warning' | 'critical' }>;
    };
    tenant_usage_summary: UsageRow[];
    diagnostics_preview: DiagnosticRow[];
    queues: {
        blocked_clients: QueueItem[];
        onboarding_attention: QueueItem[];
        governance_attention: QueueItem[];
        limit_attention: QueueItem[];
        sync_attention: QueueItem[];
        failed_jobs_attention: QueueItem[];
        client_health: QueueItem[];
    };
}

const severityColor = (severity: QueueItem['severity']) => {
    if (severity === 'critical') return 'var(--danger)';
    if (severity === 'warning') return 'var(--warning)';
    return 'var(--accent-primary)';
};

const badgeStyle = (severity: QueueItem['severity']) => ({
    color: severityColor(severity),
    background: `${severityColor(severity)}18`,
    borderColor: `${severityColor(severity)}55`,
});

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '-';

export default function SupportHub() {
    const navigate = useNavigate();
    const [data, setData] = useState<SupportDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                setData(await platformApi.getSupportDashboard());
            } catch (error) {
                toast.error('Failed to load support workspace', error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const queueColumns: ColumnDef<QueueItem>[] = useMemo(() => ([
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
                    <span className={styles.planName}>{row.reason}</span>
                    <span className={styles.planExpiry}>{row.current_plan_name || row.subscription_status || row.governance_state || '-'}</span>
                </div>
            ),
        },
        {
            key: 'severity',
            header: 'Severity',
            cell: (row) => <span className={styles.statusBadge} style={badgeStyle(row.severity)}>{row.severity}</span>,
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

    const usageColumns: ColumnDef<UsageRow>[] = useMemo(() => ([
        {
            key: 'client_name',
            header: 'Client',
            cell: (row) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{row.client_name}</span>
                    <span className={styles.planExpiry}>{row.current_plan_name || row.client_code || row.client_id}</span>
                </div>
            ),
        },
        {
            key: 'usage',
            header: 'Usage',
            cell: (row) => row.usage.map((item) => `${item.label}: ${item.used}/${item.limit ?? 'Unlimited'}`).join(' | '),
        },
        {
            key: 'highest_usage_percent',
            header: 'Peak',
            cell: (row) => `${row.highest_usage_percent}%`,
        },
    ]), []);

    const diagnosticColumns: ColumnDef<DiagnosticRow>[] = useMemo(() => ([
        { key: 'client_name', header: 'Client', cell: (row) => row.client_name },
        { key: 'source', header: 'Source', cell: (row) => row.source },
        { key: 'message', header: 'Issue', cell: (row) => row.message },
        { key: 'timestamp', header: 'Timestamp', cell: (row) => formatDate(row.timestamp) },
    ]), []);

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <TrendingUp size={36} className={styles.spin} />
                <span>Loading support workspace...</span>
            </div>
        );
    }

    const metrics = data?.metrics;
    const ops = data?.operational_metrics;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><LifeBuoy size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Phase 3 Batch 5</div>
                        <h1>Support Workspace</h1>
                        <p>Operational visibility for tenant health, sync failures, failed jobs, and support-safe diagnostics.</p>
                    </div>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{metrics?.total_clients || 0}</div>
                    <div className={styles.kpiLabel}>Tenants</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiValue}>{ops?.monitored_devices || 0}</div>
                    <div className={styles.kpiLabel}>Monitored Devices</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{data?.issue_summary?.critical || 0}</div>
                    <div className={styles.kpiLabel}>Critical Issues</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{ops?.unhealthy_clients || 0}</div>
                    <div className={styles.kpiLabel}>Unhealthy Clients</div>
                </KitchenCard>
            </div>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{ops?.failed_sync_events || 0}</div>
                    <div className={styles.kpiLabel}>Failed Sync Events</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{ops?.conflicted_sync_events || 0}</div>
                    <div className={styles.kpiLabel}>Sync Conflicts</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{ops?.failed_job_count || 0}</div>
                    <div className={styles.kpiLabel}>Failed Jobs</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{data?.issue_summary?.open_issues || 0}</div>
                    <div className={styles.kpiLabel}>Open Support Issues</div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldAlert size={16} /> Issue Categories</h3>
                    <div className={styles.infoRows}>
                        {(data?.issue_summary?.categories || []).map((category) => (
                            <div className={styles.infoRow} key={category.key}>
                                <span className={styles.infoRowLabel}>{category.label}</span>
                                <span className={styles.infoRowValue} style={{ color: category.severity === 'critical' ? 'var(--danger)' : 'var(--warning)' }}>{category.count}</span>
                            </div>
                        ))}
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Radar size={16} /> Operational Coverage</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Branches</span><span className={styles.infoRowValue}>{ops?.monitored_branches || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Clients With Sync Issues</span><span className={styles.infoRowValue}>{ops?.clients_with_sync_issues || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Clients With Failed Jobs</span><span className={styles.infoRowValue}>{ops?.clients_with_failed_jobs || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Active Clients</span><span className={styles.infoRowValue}>{metrics?.active_clients || 0}</span></div>
                    </div>
                </KitchenCard>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
                <KitchenCard className={styles.tableCard}>
                    <div className={styles.tableTitleRow}>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Client Health Queue</h3>
                    </div>
                    <KitchenTable columns={queueColumns} data={data?.queues?.client_health || []} emptyMessage="No client health issues require support attention." />
                </KitchenCard>

                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Sync Attention</h3>
                        <KitchenTable columns={queueColumns} data={data?.queues?.sync_attention || []} emptyMessage="No sync issues are currently open." />
                    </KitchenCard>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><ShieldAlert size={16} /> Failed Jobs</h3>
                        <KitchenTable columns={queueColumns} data={data?.queues?.failed_jobs_attention || []} emptyMessage="No onboarding or blueprint failures are active." />
                    </KitchenCard>
                </div>

                <div className={styles.overviewGrid}>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><LifeBuoy size={16} /> Usage Pressure</h3>
                        <KitchenTable columns={usageColumns} data={data?.tenant_usage_summary || []} emptyMessage="No tenant usage pressure is currently detected." />
                    </KitchenCard>
                    <KitchenCard className={styles.overviewCard}>
                        <h3 className={styles.cardTitle}><Radar size={16} /> Recent Diagnostics</h3>
                        <KitchenTable columns={diagnosticColumns} data={data?.diagnostics_preview || []} emptyMessage="No recent support diagnostics are available." />
                    </KitchenCard>
                </div>
            </div>
        </div>
    );
}
