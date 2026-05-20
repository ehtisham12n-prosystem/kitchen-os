import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Database, LifeBuoy, ShieldCheck, TrendingUp } from 'lucide-react';
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
    blockers?: string[];
}

interface DashboardOverview {
    metrics: {
        total_clients: number;
        active_clients: number;
        suspended_clients: number;
        inactive_clients: number;
        onboarding_clients: number;
        trial_clients: number;
        expiring_subscriptions_7_days: number;
        expiring_subscriptions_30_days: number;
        over_limit_clients: number;
        governance_attention_clients: number;
        support_attention_clients: number;
    };
    onboarding_pipeline: {
        not_started: number;
        in_progress: number;
        blocked: number;
        ready_for_activation: number;
    };
    commercial: {
        clients_by_plan: Array<{ plan_name: string; client_count: number }>;
        subscription_states: Array<{ status: string; client_count: number }>;
        retired_plan_clients: number;
    };
    operational_monitoring: {
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
    health_summary: {
        healthy_clients: number;
        attention_clients: number;
        blocked_clients: number;
    };
    queues: {
        expiring_subscriptions: QueueRow[];
        blocked_clients: QueueRow[];
        onboarding_attention: QueueRow[];
        governance_attention: QueueRow[];
        limit_attention: QueueRow[];
    };
}

interface ReliabilityServiceRow {
    name: string;
    status: 'optimal' | 'warning' | 'degraded';
    latency: string;
    uptime: string;
    load: number;
    detail?: string;
}

interface ReliabilitySnapshot {
    status: 'healthy' | 'warning' | 'critical';
    timestamp: string;
    environment: string;
    services: ReliabilityServiceRow[];
    summary: {
        monitored_clients: number;
        monitored_branches: number;
        monitored_devices: number;
        open_issues: number;
        failed_sync_events: number;
        sync_conflicts: number;
        failed_job_count: number;
        unhealthy_clients: number;
    };
    checks: {
        database: {
            status: 'healthy' | 'warning' | 'critical';
            detail: string;
            latency_ms: number | null;
        };
        backup: {
            status: 'healthy' | 'warning' | 'critical';
            detail: string;
            storage_path: string | null;
            retention_days: number | null;
            restore_validation_enabled: boolean;
            notes: string[];
        };
    };
    incidents: Array<{
        source: string;
        severity: 'warning' | 'critical';
        message: string;
        timestamp?: string | null;
        client_name?: string;
        branch_name?: string | null;
    }>;
}

const statusChipClass = (status: ReliabilityServiceRow['status']) => {
    if (status === 'degraded') return styles.health_degraded;
    if (status === 'warning') return styles.health_warning;
    return styles.health_optimal;
};

const dotClass = (status: ReliabilityServiceRow['status']) => {
    if (status === 'degraded') return styles.dot_degraded;
    if (status === 'warning') return styles.dot_warning;
    return styles.dot_optimal;
};

export function PlatformDashboard() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState<DashboardOverview | null>(null);
    const [health, setHealth] = useState<ReliabilitySnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const load = async () => {
        setIsLoading(true);
        try {
            const [overviewResponse, healthResponse] = await Promise.all([
                platformDashboardApi.getOverview(),
                platformDashboardApi.getHealth(),
            ]);
            setOverview(overviewResponse);
            setHealth(healthResponse);
        } catch (error) {
            toast.error('Failed to load platform dashboard', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const queueColumns: ColumnDef<QueueRow>[] = useMemo(() => ([
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
            key: 'state',
            header: 'State',
            cell: (row) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{row.client_status || row.subscription_status || '-'}</span>
                    <span className={styles.planExpiry}>{row.current_plan_name || row.governance_state || row.onboarding_status || '-'}</span>
                </div>
            ),
        },
        {
            key: 'reason',
            header: 'Reason',
            cell: (row) => row.reason || (row.days_remaining !== undefined ? `${row.days_remaining} day(s) remaining` : '-'),
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <KitchenButton size="sm" variant="secondary" onClick={() => navigate(`/nexus/support/clients/${row.client_id}`)}>
                    <ArrowRight size={14} style={{ marginRight: 6 }} />
                    Open
                </KitchenButton>
            ),
        },
    ]), [navigate]);

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <TrendingUp size={36} className={styles.spin} />
                <span>Loading platform dashboard...</span>
            </div>
        );
    }

    const metrics = overview?.metrics || {
        total_clients: 0,
        active_clients: 0,
        suspended_clients: 0,
        inactive_clients: 0,
        onboarding_clients: 0,
        trial_clients: 0,
        expiring_subscriptions_7_days: 0,
        expiring_subscriptions_30_days: 0,
        over_limit_clients: 0,
        governance_attention_clients: 0,
        support_attention_clients: 0,
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><BarChart3 size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Phase 3 Batch 8</div>
                        <h1>Platform Dashboard</h1>
                        <p>Actionable SaaS operating visibility across commercial state, onboarding, limits, and tenant governance.</p>
                    </div>
                </div>
                <div className={styles.actionGroup}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/support')}>
                        <LifeBuoy size={15} style={{ marginRight: 6 }} />
                        Open Support Workspace
                    </KitchenButton>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/radar')}>
                        <AlertTriangle size={15} style={{ marginRight: 6 }} />
                        Open Attention Radar
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{metrics.total_clients}</div>
                    <div className={styles.kpiLabel}>Total Clients</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiValue}>{metrics.active_clients}</div>
                    <div className={styles.kpiLabel}>Active Clients</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{metrics.suspended_clients + metrics.inactive_clients}</div>
                    <div className={styles.kpiLabel}>Suspended / Inactive</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{metrics.support_attention_clients}</div>
                    <div className={styles.kpiLabel}>Clients Needing Attention</div>
                </KitchenCard>
            </div>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{metrics.onboarding_clients}</div>
                    <div className={styles.kpiLabel}>Onboarding Pipeline</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{metrics.trial_clients}</div>
                    <div className={styles.kpiLabel}>Trial Clients</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{metrics.expiring_subscriptions_7_days}</div>
                    <div className={styles.kpiLabel}>Expiring in 7 Days</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{overview?.issue_summary?.critical || 0}</div>
                    <div className={styles.kpiLabel}>Critical Support Issues</div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><CheckCircle2 size={16} /> Onboarding Pipeline</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Not Started</span><span className={styles.infoRowValue}>{overview?.onboarding_pipeline?.not_started || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>In Progress</span><span className={styles.infoRowValue}>{overview?.onboarding_pipeline?.in_progress || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Blocked</span><span className={styles.infoRowValue} style={{ color: 'var(--danger)' }}>{overview?.onboarding_pipeline?.blocked || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Ready for Activation</span><span className={styles.infoRowValue} style={{ color: 'var(--success)' }}>{overview?.onboarding_pipeline?.ready_for_activation || 0}</span></div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Client Health Summary</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Healthy</span><span className={styles.infoRowValue}>{overview?.health_summary?.healthy_clients || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Attention</span><span className={styles.infoRowValue} style={{ color: 'var(--warning)' }}>{overview?.health_summary?.attention_clients || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Blocked</span><span className={styles.infoRowValue} style={{ color: 'var(--danger)' }}>{overview?.health_summary?.blocked_clients || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Governance Attention</span><span className={styles.infoRowValue}>{metrics.governance_attention_clients}</span></div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><TrendingUp size={16} /> Commercial Summary</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {(overview?.commercial?.clients_by_plan || []).map((entry) => (
                            <div key={entry.plan_name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                                <span>{entry.plan_name}</span>
                                <strong>{entry.client_count}</strong>
                            </div>
                        ))}
                        <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                            <AlertTriangle size={14} />
                            <span>Retired-plan clients still active: {overview?.commercial?.retired_plan_clients || 0}</span>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><LifeBuoy size={16} /> Support Monitoring</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Devices</span><span className={styles.infoRowValue}>{overview?.operational_monitoring?.monitored_devices || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Sync Issues</span><span className={styles.infoRowValue}>{overview?.operational_monitoring?.clients_with_sync_issues || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Failed Jobs</span><span className={styles.infoRowValue}>{overview?.operational_monitoring?.failed_job_count || 0}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Open Issues</span><span className={styles.infoRowValue}>{overview?.issue_summary?.open_issues || 0}</span></div>
                    </div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <div className={styles.tableTitleRow}>
                        <h3 className={styles.cardTitle}><Database size={16} /> Reliability Snapshot</h3>
                        <span className={styles.healthSummaryChip}>
                            {health?.status || 'healthy'} | {health?.environment || 'unknown'}
                        </span>
                    </div>
                    <div className={styles.healthList}>
                        {(health?.services || []).map((service) => (
                            <div key={service.name} className={`${styles.healthItem} ${statusChipClass(service.status)}`}>
                                <div className={styles.healthLeft}>
                                    <span className={`${styles.healthStatusDot} ${dotClass(service.status)}`} />
                                    <div>
                                        <div className={styles.healthName}>{service.name}</div>
                                        <div className={styles.planExpiry}>{service.detail || '-'}</div>
                                    </div>
                                </div>
                                <div className={styles.healthRight}>
                                    <span className={styles.latency}>{service.latency}</span>
                                    <span className={styles.uptime}>{service.uptime}</span>
                                    <div className={styles.loadBar}>
                                        <div
                                            className={styles.loadFill}
                                            style={{
                                                width: `${service.load}%`,
                                                background: service.status === 'degraded'
                                                    ? 'var(--danger)'
                                                    : service.status === 'warning'
                                                        ? 'var(--warning)'
                                                        : 'var(--success)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Backup Readiness</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Status</span><span className={styles.infoRowValue}>{health?.checks?.backup?.status || '-'}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Storage Path</span><span className={styles.infoRowValue}>{health?.checks?.backup?.storage_path || 'Not configured'}</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Retention</span><span className={styles.infoRowValue}>{health?.checks?.backup?.retention_days || 0} days</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Restore Validation</span><span className={styles.infoRowValue}>{health?.checks?.backup?.restore_validation_enabled ? 'Enabled' : 'Disabled'}</span></div>
                    </div>
                    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                        {(health?.checks?.backup?.notes || []).length === 0 ? (
                            <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                                <CheckCircle2 size={14} />
                                <span>Backup hooks are configured and reachable.</span>
                            </div>
                        ) : (health?.checks?.backup?.notes || []).map((note, index) => (
                            <div key={`${note}-${index}`} className={styles.infoBar} style={{ marginBottom: 0 }}>
                                <AlertTriangle size={14} />
                                <span>{note}</span>
                            </div>
                        ))}
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Expiring Subscriptions</h3>
                </div>
                <KitchenTable columns={queueColumns} data={overview?.queues?.expiring_subscriptions || []} emptyMessage="No active, trial, or grace subscriptions are expiring in the next 30 days." />
            </KitchenCard>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Blocked Clients</h3>
                    <KitchenTable columns={queueColumns} data={overview?.queues?.blocked_clients || []} emptyMessage="No clients are currently blocked." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><LifeBuoy size={16} /> Governance Attention</h3>
                    <KitchenTable columns={queueColumns} data={overview?.queues?.governance_attention || []} emptyMessage="No governance attention items are active." />
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Sync Attention</h3>
                    <KitchenTable columns={queueColumns} data={(overview?.queues as any)?.sync_attention || []} emptyMessage="No cross-tenant sync issues are currently open." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Failed Jobs</h3>
                    <KitchenTable columns={queueColumns} data={(overview?.queues as any)?.failed_jobs_attention || []} emptyMessage="No onboarding or blueprint failures are active." />
                </KitchenCard>
            </div>
        </div>
    );
}

export default PlatformDashboard;
