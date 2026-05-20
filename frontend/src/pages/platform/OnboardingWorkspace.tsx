/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Layers, PlayCircle, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'skipped';
type StepType = 'system' | 'manual' | 'action';

interface OnboardingStep {
    id: number;
    step_key: string;
    step_name: string;
    step_type: StepType;
    is_required: boolean;
    status: StepStatus;
    attempt_count: number;
    last_error?: string | null;
    notes?: string | null;
    completed_by?: string | null;
    completed_at?: string | null;
    sort_order: number;
}

interface OnboardingEvent {
    id: number;
    event_type: string;
    step_key?: string | null;
    message: string;
    created_by?: string | null;
    created_at: string;
}

interface OnboardingDetail {
    client: {
        id: string;
        client_code: string;
        client_name: string;
        legal_name?: string | null;
        domain_slug: string;
        status: string;
    };
    current_subscription?: {
        id: number;
        plan_name: string;
        plan_code: string;
        status: string;
        billing_cycle: string;
    } | null;
    onboarding?: {
        id: number;
        status: string;
        current_stage?: string | null;
        started_at?: string | null;
        completed_at?: string | null;
        failure_summary?: string | null;
    } | null;
    steps: OnboardingStep[];
    events: OnboardingEvent[];
    readiness: {
        can_start: boolean;
        can_activate: boolean;
        blockers: string[];
        initial_admin?: {
            id: number;
            full_name: string;
            user_name: string;
            email?: string | null;
            status: string;
            is_active: boolean;
        } | null;
    };
}

interface BlueprintOption {
    id: string;
    blueprint_code: string;
    blueprint_name: string;
    status: 'draft' | 'active' | 'retired';
    active_version_no?: number | null;
}

interface ClientBlueprintAssignment {
    id: number;
    blueprint_id: string;
    blueprint_name?: string | null;
    blueprint_code?: string | null;
    blueprint_version_id: number;
    version_no?: number | null;
    assignment_status: 'assigned' | 'applied' | 'failed';
    applied_at?: string | null;
    failure_summary?: string | null;
    created_at: string;
}

interface ClientBlueprintHistoryItem extends ClientBlueprintAssignment {
    logs?: Array<{
        id: number;
        section_key: string;
        result_status: string;
        message: string;
        created_at: string;
    }>;
}

const STATUS_COLORS: Record<StepStatus, string> = {
    pending: 'var(--text-tertiary)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
    blocked: 'var(--danger)',
    failed: 'var(--danger)',
    skipped: 'var(--text-muted)',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

const generateSecurePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const buffer = new Uint32Array(14);
    globalThis.crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => alphabet[value % alphabet.length]).join('');
};

export function OnboardingWorkspace() {
    const navigate = useNavigate();
    const { clientId } = useParams<{ clientId: string }>();
    const [detail, setDetail] = useState<OnboardingDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [isAssigningBlueprint, setIsAssigningBlueprint] = useState(false);
    const [isApplyingBlueprint, setIsApplyingBlueprint] = useState(false);
    const [isCreatingInitialAdmin, setIsCreatingInitialAdmin] = useState(false);
    const [stepLoading, setStepLoading] = useState<string | null>(null);
    const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
    const [initialAdminForm, setInitialAdminForm] = useState({
        full_name: '',
        user_name: '',
        email: '',
        password: generateSecurePassword(),
        phone: '',
    });
    const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
    const [blueprintAssignment, setBlueprintAssignment] = useState<ClientBlueprintAssignment | null>(null);
    const [blueprintHistory, setBlueprintHistory] = useState<ClientBlueprintHistoryItem[]>([]);

    const load = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const [response, blueprintRows, assignmentResponse, historyResponse] = await Promise.all([
                platformApi.getClientOnboarding(clientId),
                platformApi.getBlueprints(),
                platformApi.getClientBlueprintAssignment(clientId),
                platformApi.getClientBlueprintHistory(clientId),
            ]);
            setDetail(response);
            const activeBlueprints = Array.isArray(blueprintRows)
                ? blueprintRows.filter((row: any) => row.status === 'active').map((row: any) => ({
                    id: row.id,
                    blueprint_code: row.blueprint_code,
                    blueprint_name: row.blueprint_name,
                    status: row.status,
                    active_version_no: row.active_version_no ?? null,
                }))
                : [];
            setBlueprints(activeBlueprints);
            const currentAssignment = assignmentResponse?.current_assignment || null;
            setBlueprintAssignment(currentAssignment);
            setBlueprintHistory(Array.isArray(historyResponse) ? historyResponse : []);
            setSelectedBlueprintId((previous) => previous || currentAssignment?.blueprint_id || activeBlueprints[0]?.id || '');
        } catch (error) {
            toast.error('Failed to load onboarding workspace', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        void load();
    }, [load]);

    const manualSteps = useMemo(
        () => (detail?.steps || []).filter((step) => step.step_type === 'manual'),
        [detail],
    );
    const systemAndActionSteps = useMemo(
        () => (detail?.steps || []).filter((step) => step.step_type !== 'manual'),
        [detail],
    );
    const hasInitialAdmin = Boolean(detail?.readiness.initial_admin);
    const canCreateInitialAdmin = Boolean(detail?.onboarding) && !hasInitialAdmin;

    const eventColumns: ColumnDef<OnboardingEvent>[] = [
        { key: 'message', header: 'Event', cell: (row) => row.message },
        { key: 'step_key', header: 'Step', cell: (row) => row.step_key || '—' },
        { key: 'created_by', header: 'Actor', cell: (row) => row.created_by || 'System' },
        { key: 'created_at', header: 'Timestamp', cell: (row) => formatDate(row.created_at) },
    ];

    const handleStart = async () => {
        if (!clientId) return;
        setIsStarting(true);
        try {
            await platformApi.startClientOnboarding(clientId);
            toast.success('Onboarding started', 'Client onboarding has been started.');
            await load();
        } catch (error) {
            toast.error('Failed to start onboarding', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsStarting(false);
        }
    };

    const handleManualStep = async (stepKey: string, status: 'completed' | 'blocked' | 'failed') => {
        if (!clientId) return;
        setStepLoading(stepKey);
        try {
            await platformApi.updateClientOnboardingStep(clientId, stepKey, {
                status,
                notes: stepNotes[stepKey]?.trim() || undefined,
            });
            toast.success('Onboarding step updated', `${stepKey.replaceAll('_', ' ')} marked ${status}.`);
            await load();
        } catch (error) {
            toast.error('Step update failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setStepLoading(null);
        }
    };

    const handleRetry = async (stepKey: string) => {
        if (!clientId) return;
        setStepLoading(stepKey);
        try {
            await platformApi.retryClientOnboardingStep(clientId, stepKey);
            toast.success('Step reset', `${stepKey.replaceAll('_', ' ')} is ready for another attempt.`);
            await load();
        } catch (error) {
            toast.error('Retry failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setStepLoading(null);
        }
    };

    const handleAssignBlueprint = async () => {
        if (!clientId || !selectedBlueprintId) {
            toast.error('Blueprint assignment blocked', 'Select an active blueprint first.');
            return;
        }
        setIsAssigningBlueprint(true);
        try {
            await platformApi.assignClientBlueprint(clientId, { blueprint_id: selectedBlueprintId });
            toast.success('Blueprint assigned', 'Blueprint assignment was recorded for this onboarding flow.');
            await load();
        } catch (error) {
            toast.error('Blueprint assignment failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsAssigningBlueprint(false);
        }
    };

    const handleApplyBlueprint = async () => {
        if (!clientId) return;
        setIsApplyingBlueprint(true);
        try {
            await platformApi.applyClientBlueprint(clientId);
            toast.success('Blueprint applied', 'Safe configuration defaults were applied to this client.');
            await load();
        } catch (error) {
            toast.error('Blueprint application failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsApplyingBlueprint(false);
        }
    };

    const handleActivate = async () => {
        if (!clientId) return;
        setIsActivating(true);
        try {
            await platformApi.activateClientOnboarding(clientId);
            toast.success('Client activated', 'Client activation completed through onboarding.');
            await load();
        } catch (error) {
            toast.error('Activation failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsActivating(false);
        }
    };

    const handleCreateInitialAdmin = async () => {
        if (!clientId || !detail?.onboarding) {
            toast.error('Initial admin blocked', 'Start onboarding before creating the initial administrator.');
            return;
        }

        const payload = {
            full_name: initialAdminForm.full_name.trim(),
            user_name: initialAdminForm.user_name.trim(),
            email: initialAdminForm.email.trim().toLowerCase(),
            password: initialAdminForm.password,
            phone: initialAdminForm.phone.trim() || undefined,
        };

        if (!payload.full_name || !payload.user_name || !payload.email || !payload.password) {
            toast.error('Validation error', 'Full name, username, email, and password are required.');
            return;
        }

        if (payload.password.length < 8) {
            toast.error('Validation error', 'Initial admin password must be at least 8 characters long.');
            return;
        }

        setIsCreatingInitialAdmin(true);
        try {
            await platformApi.createClientInitialAdmin(clientId, payload);
            toast.success('Initial admin created', `${payload.user_name} is now prepared for client activation.`);
            setInitialAdminForm({
                full_name: '',
                user_name: '',
                email: '',
                password: generateSecurePassword(),
                phone: '',
            });
            await load();
        } catch (error) {
            toast.error('Initial admin creation failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsCreatingInitialAdmin(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <RefreshCcw size={36} className={styles.spin} />
                <span>Loading onboarding workspace...</span>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className={styles.emptyState}>
                <AlertTriangle size={48} color="var(--danger)" />
                <h3>Onboarding workspace unavailable</h3>
                <KitchenButton onClick={() => navigate('/nexus/onboarding')}>
                    <ArrowLeft size={16} style={{ marginRight: 6 }} />
                    Back to Queue
                </KitchenButton>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/nexus/onboarding')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.iconBox}><ShieldCheck size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Provisioning Workspace</div>
                        <h1>{detail.client.client_name}</h1>
                        <p>{detail.client.client_code} • {detail.client.domain_slug}.kitchenos.com</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    {!detail.onboarding ? (
                        <KitchenButton onClick={handleStart} isLoading={isStarting}>
                            <PlayCircle size={15} style={{ marginRight: 6 }} />
                            Start Onboarding
                        </KitchenButton>
                    ) : (
                        <KitchenButton variant="secondary" onClick={() => navigate(`/nexus/clients/${detail.client.id}`)}>
                            Client Profile
                        </KitchenButton>
                    )}
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{detail.onboarding?.status || 'not_started'}</div>
                    <div className={styles.kpiLabel}>Onboarding State</div>
                    <div className={styles.kpiMeta}>{detail.onboarding?.current_stage || 'Not started'}</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiValue}>{detail.current_subscription?.plan_name || 'None'}</div>
                    <div className={styles.kpiLabel}>Commercial Plan</div>
                    <div className={styles.kpiMeta}>{detail.current_subscription?.status || 'No subscription'}</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiValue}>{detail.readiness.can_activate ? 'Ready' : 'Not Ready'}</div>
                    <div className={styles.kpiLabel}>Activation Readiness</div>
                    <div className={styles.kpiMeta}>{detail.readiness.blockers.length} blocker(s)</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{detail.steps.filter((step) => step.status === 'completed').length}/{detail.steps.length}</div>
                    <div className={styles.kpiLabel}>Completed Steps</div>
                    <div className={styles.kpiMeta}>Started {formatDate(detail.onboarding?.started_at)}</div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Activation Readiness</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}>
                            <span className={styles.infoRowLabel}>Client Lifecycle</span>
                            <span className={styles.infoRowValue}>{detail.client.status}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoRowLabel}>Commercial State</span>
                            <span className={styles.infoRowValue}>{detail.current_subscription?.status || 'No subscription'}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoRowLabel}>Initial Admin</span>
                            <span className={styles.infoRowValue}>{detail.readiness.initial_admin?.email || 'Manage this from Client Registry'}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoRowLabel}>Can Activate</span>
                            <span className={styles.infoRowValue} style={{ color: detail.readiness.can_activate ? 'var(--success)' : 'var(--danger)' }}>
                                {detail.readiness.can_activate ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                        {detail.readiness.blockers.length === 0 ? (
                            <div className={styles.infoBar} style={{ marginBottom: 0, color: 'var(--success)', borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.08)' }}>
                                <CheckCircle2 size={14} />
                                <span>No open blockers. Activation can proceed.</span>
                            </div>
                        ) : detail.readiness.blockers.map((blocker) => (
                            <div key={blocker} className={styles.infoBar} style={{ marginBottom: 0 }}>
                                <AlertTriangle size={14} />
                                <span>{blocker}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <KitchenButton onClick={handleActivate} isLoading={isActivating} disabled={!detail.readiness.can_activate}>
                            Activate Client
                        </KitchenButton>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Initial Admin</h3>
                    {hasInitialAdmin ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                            <div className={styles.infoRows}>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoRowLabel}>Full Name</span>
                                    <span className={styles.infoRowValue}>{detail.readiness.initial_admin?.full_name || '—'}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoRowLabel}>Username</span>
                                    <span className={styles.infoRowValue}>{detail.readiness.initial_admin?.user_name || '—'}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoRowLabel}>Email</span>
                                    <span className={styles.infoRowValue}>{detail.readiness.initial_admin?.email || '—'}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoRowLabel}>Status</span>
                                    <span className={styles.infoRowValue}>{detail.readiness.initial_admin?.status || '—'}</span>
                                </div>
                            </div>
                            <div className={styles.infoBar} style={{ marginBottom: 0, color: 'var(--success)', borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.08)' }}>
                                <CheckCircle2 size={14} />
                                <span>Initial administrator is already prepared for this onboarding flow.</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {!detail.onboarding ? (
                                <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                                    <AlertTriangle size={14} />
                                    <span>Start onboarding before creating the initial administrator.</span>
                                </div>
                            ) : null}
                            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                <KitchenInput
                                    label="Full Name"
                                    value={initialAdminForm.full_name}
                                    onChange={(event) => setInitialAdminForm((current) => ({ ...current, full_name: event.target.value }))}
                                    placeholder="Client administrator name"
                                />
                                <KitchenInput
                                    label="Username"
                                    value={initialAdminForm.user_name}
                                    onChange={(event) => setInitialAdminForm((current) => ({ ...current, user_name: event.target.value }))}
                                    placeholder="client.admin"
                                />
                                <KitchenInput
                                    label="Email"
                                    type="email"
                                    value={initialAdminForm.email}
                                    onChange={(event) => setInitialAdminForm((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="admin@client.com"
                                />
                                <KitchenInput
                                    label="Phone"
                                    value={initialAdminForm.phone}
                                    onChange={(event) => setInitialAdminForm((current) => ({ ...current, phone: event.target.value }))}
                                    placeholder="+92 300 0000000"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 280px' }}>
                                    <KitchenInput
                                        label="Temporary Password"
                                        value={initialAdminForm.password}
                                        onChange={(event) => setInitialAdminForm((current) => ({ ...current, password: event.target.value }))}
                                        placeholder="Generate or enter a secure password"
                                    />
                                </div>
                                <KitchenButton
                                    variant="secondary"
                                    onClick={() => setInitialAdminForm((current) => ({ ...current, password: generateSecurePassword() }))}
                                    type="button"
                                >
                                    Regenerate Password
                                </KitchenButton>
                                <KitchenButton
                                    onClick={handleCreateInitialAdmin}
                                    isLoading={isCreatingInitialAdmin}
                                    disabled={!canCreateInitialAdmin}
                                    type="button"
                                >
                                    Create Initial Admin
                                </KitchenButton>
                            </div>
                        </div>
                    )}
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Layers size={16} /> Blueprint Assignment</h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <KitchenSelect
                            label="Active Blueprint"
                            value={selectedBlueprintId}
                            onChange={(event) => setSelectedBlueprintId(event.target.value)}
                            options={[
                                { value: '', label: 'Select blueprint' },
                                ...blueprints.map((blueprint) => ({
                                    value: blueprint.id,
                                    label: `${blueprint.blueprint_name} (${blueprint.blueprint_code})`,
                                })),
                            ]}
                        />
                        <div className={styles.infoRows}>
                            <div className={styles.infoRow}>
                                <span className={styles.infoRowLabel}>Current Assignment</span>
                                <span className={styles.infoRowValue}>
                                    {blueprintAssignment?.blueprint_name ? `${blueprintAssignment.blueprint_name} v${blueprintAssignment.version_no || '?'}` : 'Not assigned'}
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoRowLabel}>Assignment State</span>
                                <span className={styles.infoRowValue}>{blueprintAssignment?.assignment_status || 'None'}</span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoRowLabel}>Applied</span>
                                <span className={styles.infoRowValue}>{formatDate(blueprintAssignment?.applied_at)}</span>
                            </div>
                        </div>
                        {blueprintAssignment?.failure_summary ? (
                            <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                                <AlertTriangle size={14} />
                                <span>{blueprintAssignment.failure_summary}</span>
                            </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <KitchenButton onClick={handleAssignBlueprint} isLoading={isAssigningBlueprint} disabled={!detail.onboarding || !selectedBlueprintId}>
                                Assign Blueprint
                            </KitchenButton>
                            <KitchenButton
                                variant="secondary"
                                onClick={handleApplyBlueprint}
                                isLoading={isApplyingBlueprint}
                                disabled={!detail.onboarding || !blueprintAssignment || blueprintAssignment.assignment_status === 'applied'}
                            >
                                Apply Blueprint
                            </KitchenButton>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><CheckCircle2 size={16} /> Blueprint History</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {blueprintHistory.length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No blueprint assignments recorded for this client yet.</p>
                        ) : blueprintHistory.slice(0, 5).map((entry) => (
                            <div key={entry.id} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--glass-bg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{entry.blueprint_name || entry.blueprint_code || 'Blueprint'} v{entry.version_no || '?'}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{entry.assignment_status} • {formatDate(entry.created_at)}</div>
                                    </div>
                                    <span className={styles.statusBadge}>{entry.assignment_status}</span>
                                </div>
                                {entry.logs?.length ? (
                                    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                                        {entry.logs.slice(0, 2).map((log) => (
                                            <div key={log.id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {log.section_key}: {log.result_status} • {log.message}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </KitchenCard>
            </div>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <div className={styles.tabContentHeader}>
                        <h3>Provisioning Steps</h3>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                        {systemAndActionSteps.map((step) => (
                            <div key={step.step_key} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--glass-bg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{step.step_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{step.step_type} step</div>
                                    </div>
                                    <span className={styles.statusBadge} style={{ color: STATUS_COLORS[step.status], background: `${STATUS_COLORS[step.status]}18`, borderColor: `${STATUS_COLORS[step.status]}55` }}>
                                        {step.status}
                                    </span>
                                </div>
                                <div style={{ marginTop: 8, fontSize: '0.8rem', color: step.last_error ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                    {step.last_error || step.notes || 'System-evaluated onboarding step.'}
                                </div>
                                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                        Attempt {step.attempt_count || 0} • Completed {formatDate(step.completed_at)}
                                    </span>
                                    {(step.status === 'blocked' || step.status === 'failed' || step.status === 'in_progress') ? (
                                        <KitchenButton size="sm" variant="secondary" onClick={() => handleRetry(step.step_key)} isLoading={stepLoading === step.step_key}>
                                            Retry
                                        </KitchenButton>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.overviewCard}>
                    <div className={styles.tabContentHeader}>
                        <h3>Manual Approval Steps</h3>
                    </div>
                    <div style={{ display: 'grid', gap: 14 }}>
                        {manualSteps.map((step) => (
                            <div key={step.step_key} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--glass-bg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{step.step_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{step.step_type} step</div>
                                    </div>
                                    <span className={styles.statusBadge} style={{ color: STATUS_COLORS[step.status], background: `${STATUS_COLORS[step.status]}18`, borderColor: `${STATUS_COLORS[step.status]}55` }}>
                                        {step.status}
                                    </span>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    <label className={styles.fieldLabel}>Notes</label>
                                    <textarea
                                        className={styles.commentBox}
                                        rows={3}
                                        value={stepNotes[step.step_key] ?? step.notes ?? ''}
                                        onChange={(event) => setStepNotes((prev) => ({ ...prev, [step.step_key]: event.target.value }))}
                                        placeholder="Record readiness notes, blockers, or operator confirmation."
                                    />
                                </div>
                                {step.last_error ? (
                                    <div className={styles.infoBar} style={{ marginTop: 12 }}>
                                        <AlertTriangle size={14} />
                                        <span>{step.last_error}</span>
                                    </div>
                                ) : null}
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                                    <KitchenButton size="sm" onClick={() => handleManualStep(step.step_key, 'completed')} isLoading={stepLoading === step.step_key}>
                                        Complete
                                    </KitchenButton>
                                    <KitchenButton size="sm" variant="warning" onClick={() => handleManualStep(step.step_key, 'blocked')} isLoading={stepLoading === step.step_key}>
                                        <AlertTriangle size={14} style={{ marginRight: 6 }} />
                                        Block
                                    </KitchenButton>
                                    <KitchenButton size="sm" variant="danger" onClick={() => handleManualStep(step.step_key, 'failed')} isLoading={stepLoading === step.step_key}>
                                        <XCircle size={14} style={{ marginRight: 6 }} />
                                        Fail
                                    </KitchenButton>
                                    {(step.status === 'blocked' || step.status === 'failed' || step.status === 'in_progress') ? (
                                        <KitchenButton size="sm" variant="secondary" onClick={() => handleRetry(step.step_key)} isLoading={stepLoading === step.step_key}>
                                            Retry
                                        </KitchenButton>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tabContent}>
                <div className={styles.tabContentHeader}>
                    <h3>Provisioning Timeline</h3>
                </div>
                <KitchenTable columns={eventColumns} data={detail.events || []} emptyMessage="No onboarding events recorded yet." />
            </KitchenCard>
        </div>
    );
}

export default OnboardingWorkspace;
