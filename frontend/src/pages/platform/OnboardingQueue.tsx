import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, ListChecks, PlayCircle, RefreshCcw, ShieldAlert, UserCog } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

type ClientLifecycle = 'draft' | 'onboarding' | 'active' | 'suspended' | 'inactive' | 'closed';
type OnboardingStatus = 'not_started' | 'in_progress' | 'blocked' | 'failed' | 'ready_for_activation' | 'completed' | 'cancelled';

interface QueueRow {
    client_id: string;
    client_code: string;
    client_name: string;
    client_status: ClientLifecycle;
    onboarding_status: OnboardingStatus;
    current_stage?: string | null;
    started_at?: string | null;
    current_plan_name?: string | null;
    subscription_status?: string | null;
    can_start: boolean;
    can_activate: boolean;
    blockers: string[];
}

const STATUS_COLORS: Record<OnboardingStatus, string> = {
    not_started: 'var(--text-tertiary)',
    in_progress: 'var(--warning)',
    blocked: 'var(--danger)',
    failed: 'var(--danger)',
    ready_for_activation: 'var(--success)',
    completed: 'var(--success)',
    cancelled: 'var(--text-muted)',
};

const STATUS_LABELS: Record<OnboardingStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    failed: 'Failed',
    ready_for_activation: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

export function OnboardingQueue() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<QueueRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startingClientId, setStartingClientId] = useState<string | null>(null);

    const load = async () => {
        setIsLoading(true);
        try {
            const response = await platformApi.getOnboardingQueue();
            setRows(Array.isArray(response) ? response : []);
        } catch (error) {
            toast.error('Failed to load onboarding queue', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const metrics = useMemo(() => {
        const total = rows.length;
        const ready = rows.filter((row) => row.onboarding_status === 'ready_for_activation').length;
        const blocked = rows.filter((row) => row.onboarding_status === 'blocked' || row.onboarding_status === 'failed').length;
        const notStarted = rows.filter((row) => row.onboarding_status === 'not_started').length;
        return { total, ready, blocked, notStarted };
    }, [rows]);

    const handleStart = async (row: QueueRow) => {
        setStartingClientId(row.client_id);
        try {
            await platformApi.startClientOnboarding(row.client_id);
            toast.success('Onboarding started', `${row.client_name} is now in the onboarding workflow.`);
            navigate(`/nexus/onboarding/${row.client_id}`);
        } catch (error) {
            toast.error('Failed to start onboarding', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setStartingClientId(null);
        }
    };

    const columns: ColumnDef<QueueRow>[] = [
        {
            key: 'client_name',
            header: 'Client',
            cell: (row) => (
                <div className={styles.clientCell}>
                    <div className={styles.clientAvatar}>{row.client_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <div className={styles.clientName}>{row.client_name}</div>
                        <div className={styles.clientSlug}>{row.client_code}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'client_status',
            header: 'Client State',
            cell: (row) => row.client_status,
        },
        {
            key: 'onboarding_status',
            header: 'Onboarding',
            cell: (row) => (
                <span
                    className={styles.statusBadge}
                    style={{
                        color: STATUS_COLORS[row.onboarding_status],
                        background: `${STATUS_COLORS[row.onboarding_status]}18`,
                        borderColor: `${STATUS_COLORS[row.onboarding_status]}55`,
                    }}
                >
                    {STATUS_LABELS[row.onboarding_status]}
                </span>
            ),
        },
        {
            key: 'current_stage',
            header: 'Current Stage',
            cell: (row) => row.current_stage || 'Not started',
        },
        {
            key: 'commercial',
            header: 'Commercial',
            cell: (row) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{row.current_plan_name || 'No plan'}</span>
                    <span className={styles.planExpiry}>{row.subscription_status || 'No subscription'}</span>
                </div>
            ),
        },
        {
            key: 'started_at',
            header: 'Started',
            cell: (row) => formatDate(row.started_at),
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <div className={styles.actionGroup}>
                    {row.can_start ? (
                        <KitchenButton
                            size="sm"
                            onClick={() => handleStart(row)}
                            isLoading={startingClientId === row.client_id}
                        >
                            <PlayCircle size={14} style={{ marginRight: 6 }} />
                            Start
                        </KitchenButton>
                    ) : (
                        <KitchenButton size="sm" variant="secondary" onClick={() => navigate(`/nexus/onboarding/${row.client_id}`)}>
                            <ArrowRight size={14} style={{ marginRight: 6 }} />
                            Open
                        </KitchenButton>
                    )}
                </div>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <RefreshCcw size={36} className={styles.spin} />
                <span>Loading onboarding queue...</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><ListChecks size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Nexus Client Provisioning</div>
                        <h1>Onboarding Queue</h1>
                        <p>Track client provisioning, readiness, and activation from a single Nexus queue.</p>
                    </div>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}><div className={styles.kpiHeaderInfo}><div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}><ListChecks size={16} /></div></div></div>
                    <div className={styles.kpiValue}>{metrics.total}</div>
                    <div className={styles.kpiLabel}>Queue Size</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiTop}><div className={styles.kpiHeaderInfo}><div className={`${styles.kpiIcon} ${styles.kpiIconOrange}`}><Clock3 size={16} /></div></div></div>
                    <div className={styles.kpiValue}>{metrics.notStarted}</div>
                    <div className={styles.kpiLabel}>Not Started</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiTop}><div className={styles.kpiHeaderInfo}><div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}><CheckCircle2 size={16} /></div></div></div>
                    <div className={styles.kpiValue}>{metrics.ready}</div>
                    <div className={styles.kpiLabel}>Ready to Activate</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiRed}`}>
                    <div className={styles.kpiTop}><div className={styles.kpiHeaderInfo}><div className={`${styles.kpiIcon} ${styles.kpiIconRed}`}><ShieldAlert size={16} /></div></div></div>
                    <div className={styles.kpiValue}>{metrics.blocked}</div>
                    <div className={styles.kpiLabel}>Blocked or Failed</div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Client Onboarding Queue</h3>
                </div>
                <div className={styles.resultInfo}>
                    <strong>{rows.length}</strong> client{rows.length === 1 ? '' : 's'} currently require onboarding attention.
                </div>
                <KitchenTable columns={columns} data={rows} emptyMessage="No draft or onboarding clients are waiting in the queue." />
            </KitchenCard>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><UserCog size={16} /> Queue Rules</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Start</span><span className={styles.infoRowValue}>Allowed for draft and onboarding clients only.</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Activation</span><span className={styles.infoRowValue}>Only available after all required steps are complete.</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Initial Admin</span><span className={styles.infoRowValue}>Prepared during onboarding and activated only with the client.</span></div>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldAlert size={16} /> Attention Model</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {rows.filter((row) => row.blockers?.length).slice(0, 5).map((row) => (
                            <div key={row.client_id} className={styles.infoBar} style={{ marginBottom: 0 }}>
                                <ShieldAlert size={14} />
                                <span>{row.client_name}: {row.blockers[0]}</span>
                            </div>
                        ))}
                        {rows.filter((row) => row.blockers?.length).length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No current onboarding blockers are reported.</p>
                        ) : null}
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}

export default OnboardingQueue;
