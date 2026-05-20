import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, LifeBuoy, ShieldCheck, Users, Workflow } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

interface SupportClientSummary {
    identity: {
        id: string;
        client_code: string;
        client_name: string;
        legal_name?: string | null;
        short_name?: string | null;
        domain_slug: string;
        business_type?: string | null;
        status: string;
        branch_count: number;
        user_count: number;
        contacts: Array<{ id: number; contact_type: string; full_name: string; designation?: string | null; email?: string | null; phone?: string | null }>;
        created_at: string;
        updated_at: string;
    };
    subscription: { current: any | null; history: any[] };
    onboarding: { summary: any | null; readiness: any | null; steps: any[]; events: any[] };
    entitlements: any;
    governance: { summary: any | null; history: any[] };
    inspection?: { health_status?: 'healthy' | 'warning' | 'critical'; findings?: Array<{ message: string; severity: 'warning' | 'critical' }>; audit_snapshot?: any };
    blueprint: { current_assignment: any | null; history: any[] };
    blockers: Array<{ source: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
    health: { status: 'healthy' | 'warning' | 'critical'; score: number; indicators: Array<{ source: string; severity: 'info' | 'warning' | 'critical'; message: string }> };
    usage_summary: Array<{ key: string; label: string; used: number; limit: number | null; percent: number | null }>;
    diagnostics_summary: { open_issue_count: number; sync_issue_count: number; failed_job_count: number; audit_error_count: number; audit_warning_count: number; device_issue_count: number };
    recent_activity: Array<{ source: string; type: string; message: string; timestamp: string | null }>;
}

interface SupportDiagnostics {
    summary: { open_issue_count: number; sync_issue_count: number; failed_job_count: number; audit_error_count: number; audit_warning_count: number; device_issue_count: number };
    sync: {
        summary: any;
        devices: any[];
        recent_failures: any[];
    };
    jobs: {
        summary: any;
        failed_items: any[];
    };
    audit: {
        snapshot: any;
        recent_signals: any[];
    };
    recent_issues: Array<{ source: string; severity: 'warning' | 'critical'; message: string; timestamp: string | null; branch_name?: string | null }>;
}

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '-';

const blockerColor = (severity: 'info' | 'warning' | 'critical') => {
    if (severity === 'critical') return 'var(--danger)';
    if (severity === 'warning') return 'var(--warning)';
    return 'var(--accent-primary)';
};

export function SupportClient360() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [summary, setSummary] = useState<SupportClientSummary | null>(null);
    const [diagnostics, setDiagnostics] = useState<SupportDiagnostics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const [summaryResponse, diagnosticsResponse] = await Promise.all([
                    platformApi.getSupportClientSummary(id),
                    platformApi.getSupportClientDiagnostics(id),
                ]);
                setSummary(summaryResponse);
                setDiagnostics(diagnosticsResponse);
            } catch (error) {
                toast.error('Failed to load Client 360', error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id]);

    const activityColumns: ColumnDef<{ source: string; type?: string; message: string; timestamp: string | null }>[] = useMemo(() => ([
        { key: 'source', header: 'Source', cell: (row) => row.source },
        { key: 'message', header: 'Message', cell: (row) => row.message },
        { key: 'timestamp', header: 'Timestamp', cell: (row) => formatDate(row.timestamp) },
    ]), []);

    const syncColumns: ColumnDef<any>[] = useMemo(() => ([
        { key: 'branch_name', header: 'Branch', cell: (row) => row.branch_name || '-' },
        { key: 'device_name', header: 'Device', cell: (row) => row.device_name || '-' },
        { key: 'entity_type', header: 'Entity', cell: (row) => `${row.entity_type || '-'}${row.entity_id ? ` / ${row.entity_id}` : ''}` },
        { key: 'error_message', header: 'Issue', cell: (row) => row.error_message || row.status },
        { key: 'created_at', header: 'Timestamp', cell: (row) => formatDate(row.created_at) },
    ]), []);

    const jobColumns: ColumnDef<any>[] = useMemo(() => ([
        { key: 'type', header: 'Type', cell: (row) => row.type.replaceAll('_', ' ') },
        { key: 'name', header: 'Name', cell: (row) => row.name },
        { key: 'message', header: 'Issue', cell: (row) => row.message },
        { key: 'timestamp', header: 'Timestamp', cell: (row) => formatDate(row.timestamp) },
    ]), []);

    const auditColumns: ColumnDef<any>[] = useMemo(() => ([
        { key: 'portal', header: 'Portal', cell: (row) => row.portal },
        { key: 'action', header: 'Action', cell: (row) => row.action },
        { key: 'details', header: 'Details', cell: (row) => row.details || '-' },
        { key: 'timestamp', header: 'Timestamp', cell: (row) => formatDate(row.timestamp) },
    ]), []);

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <LifeBuoy size={36} className={styles.spin} />
                <span>Loading Client 360...</span>
            </div>
        );
    }

    if (!summary) {
        return <div className={styles.container}><KitchenCard className={styles.tableCard}><p style={{ margin: 0 }}>Client summary could not be loaded.</p></KitchenCard></div>;
    }

    const identity = summary.identity;
    const governance = summary.governance.summary;
    const subscription = summary.subscription.current;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <KitchenButton variant="ghost" onClick={() => navigate('/nexus/support')}>
                        <ArrowLeft size={16} style={{ marginRight: 6 }} />
                        Back
                    </KitchenButton>
                    <div className={styles.iconBox}><Building2 size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Support Workspace</div>
                        <h1>{identity.client_name}</h1>
                        <p>{identity.client_code} | {identity.domain_slug} | Read-only support diagnostics</p>
                    </div>
                </div>
                <div className={styles.actionGroup}>
                    <KitchenButton variant="secondary" onClick={() => navigate(`/nexus/clients/${identity.id}`)}>Open Client Record</KitchenButton>
                    <KitchenButton variant="secondary" onClick={() => navigate(`/nexus/onboarding/${identity.id}`)}>Open Onboarding</KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{summary.health.score}</div>
                    <div className={styles.kpiLabel}>Health Score</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiValue}>{summary.health.status}</div>
                    <div className={styles.kpiLabel}>Health Status</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{summary.diagnostics_summary.open_issue_count}</div>
                    <div className={styles.kpiLabel}>Open Issues</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{summary.identity.branch_count}</div>
                    <div className={styles.kpiLabel}>Branches</div>
                </KitchenCard>
            </div>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiValue}>{summary.diagnostics_summary.sync_issue_count}</div>
                    <div className={styles.kpiLabel}>Sync Issues</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{summary.diagnostics_summary.failed_job_count}</div>
                    <div className={styles.kpiLabel}>Failed Jobs</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{summary.diagnostics_summary.audit_error_count}</div>
                    <div className={styles.kpiLabel}>Audit Errors (7d)</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{summary.diagnostics_summary.device_issue_count}</div>
                    <div className={styles.kpiLabel}>Devices With Issues</div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Building2 size={16} /> Identity</h3>
                    <InfoRow label="Client Status" value={identity.status} />
                    <InfoRow label="Legal Name" value={identity.legal_name || '-'} />
                    <InfoRow label="Business Type" value={identity.business_type || '-'} />
                    <InfoRow label="Users" value={String(identity.user_count)} />
                    <InfoRow label="Updated" value={formatDate(identity.updated_at)} />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Operational State</h3>
                    <InfoRow label="Governance" value={governance?.governance_state || 'normal'} />
                    <InfoRow label="Subscription" value={summary.entitlements?.subscription_status || subscription?.status || '-'} />
                    <InfoRow label="Current Plan" value={subscription?.plan_name || summary.entitlements?.current_plan_name || '-'} />
                    <InfoRow label="Blocking Reason" value={summary.entitlements?.blocking_reason || 'None'} valueStyle={{ color: summary.entitlements?.blocking_reason ? 'var(--danger)' : 'var(--success)' }} />
                    <InfoRow label="Tenant Inspection" value={summary.inspection?.health_status || 'healthy'} valueStyle={{ color: summary.inspection?.health_status === 'critical' ? 'var(--danger)' : summary.inspection?.health_status === 'warning' ? 'var(--warning)' : 'var(--success)' }} />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Users size={16} /> Usage vs Limits</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {summary.usage_summary.map((row) => (
                            <div key={row.key} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <strong>{row.label}</strong>
                                    <span>{row.used} / {row.limit ?? 'Unlimited'}{row.percent !== null ? ` (${Math.round(row.percent)}%)` : ''}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><CheckCircle2 size={16} /> Onboarding</h3>
                    <InfoRow label="Workflow Status" value={summary.onboarding.summary?.status || 'not_started'} />
                    <InfoRow label="Current Stage" value={summary.onboarding.summary?.current_stage || '-'} />
                    <InfoRow label="Ready To Activate" value={summary.onboarding.readiness?.can_activate ? 'Yes' : 'No'} />
                    <InfoRow label="Failure Summary" value={summary.onboarding.summary?.failure_summary || '-'} />
                    <InfoRow label="Blueprint Status" value={summary.blueprint.current_assignment?.assignment_status || '-'} />
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Health Indicators</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {summary.health.indicators.length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No active support indicators were derived for this tenant.</p>
                        ) : summary.health.indicators.map((indicator, index) => (
                            <div key={`${indicator.source}-${index}`} className={styles.infoBar} style={{ marginBottom: 0, color: blockerColor(indicator.severity), borderColor: `${blockerColor(indicator.severity)}33`, background: `${blockerColor(indicator.severity)}14` }}>
                                <AlertTriangle size={14} />
                                <span>{indicator.source}: {indicator.message}</span>
                            </div>
                        ))}
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Workflow size={16} /> Recent Support Issues</h3>
                    <KitchenTable columns={activityColumns} data={diagnostics?.recent_issues || []} emptyMessage="No recent support issues are available." />
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Workflow size={16} /> Sync Diagnostics</h3>
                    <KitchenTable columns={syncColumns} data={diagnostics?.sync?.recent_failures || []} emptyMessage="No sync failures or conflicts are currently open." />
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><AlertTriangle size={16} /> Failed Jobs</h3>
                    <KitchenTable columns={jobColumns} data={diagnostics?.jobs?.failed_items || []} emptyMessage="No onboarding or blueprint failures are active." />
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Audit Signals</h3>
                </div>
                <KitchenTable columns={auditColumns} data={diagnostics?.audit?.recent_signals || []} emptyMessage="No recent warning or error audit signals are available." />
            </KitchenCard>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Recent Activity</h3>
                </div>
                <KitchenTable columns={activityColumns} data={summary.recent_activity || []} emptyMessage="No recent client activity is available." />
            </KitchenCard>
        </div>
    );
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: CSSProperties }) {
    return <div className={styles.infoRow}><div className={styles.infoRowIcon}><LifeBuoy size={14} /></div><span className={styles.infoRowLabel}>{label}</span><span className={styles.infoRowValue} style={valueStyle}>{value}</span></div>;
}

export default SupportClient360;
