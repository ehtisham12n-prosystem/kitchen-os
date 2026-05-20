/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Plus,
    RefreshCcw,
    ShieldCheck,
    Target,
} from 'lucide-react';
import { branchApi, inventoryApi, resolveActiveBranchId } from '../../api/api';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './StockCount.module.css';

type CountType = 'random_cycle' | 'eod_blind_close' | 'monthly_full';

interface BlindCountSessionSummary {
    id: number;
    session_code: string;
    title: string;
    count_type: CountType;
    status: string;
    business_date: string;
    location_name?: string | null;
    line_count: number;
    counted_line_count: number;
    variance_line_count: number;
    critical_line_count: number;
    variance_value_total: number;
    accuracy_score: number;
    escalation_required: boolean;
    counted_by_name?: string | null;
    reviewed_by_name?: string | null;
}

interface BlindCountLine {
    id: number;
    blind_sequence: number;
    item_id: number;
    item_name: string;
    unit: string;
    location_name?: string | null;
    counted_quantity: number | null;
    expected_quantity_snapshot: number | null;
    variance_quantity: number | null;
    variance_percent: number | null;
    variance_value: number | null;
    discrepancy_level: string | null;
    review_status: string;
    review_action?: string | null;
    reason_code?: string | null;
    review_notes?: string | null;
}

interface BlindCountSessionDetail {
    id: number;
    session_code: string;
    title: string;
    count_type: CountType;
    status: string;
    business_date: string;
    period_key?: string | null;
    notes?: string | null;
    location?: { id: number; name: string; type: string } | null;
    metrics: {
        line_count: number;
        counted_line_count: number;
        matched_line_count: number;
        variance_line_count: number;
        critical_line_count: number;
        variance_quantity_total: number;
        variance_value_total: number;
        accuracy_score: number;
        escalation_required: boolean;
        escalation_reason?: string | null;
    };
    items: BlindCountLine[];
}

interface BranchLocation {
    id: number;
    location_name: string;
    location_type?: string | null;
}

const COUNT_TYPE_OPTIONS: Array<{ value: CountType; label: string; help: string }> = [
    { value: 'random_cycle', label: 'Random Blind Count', help: 'Surprise verification of fast-moving, high-risk items.' },
    { value: 'eod_blind_close', label: 'End-of-Day Blind Close', help: 'Actual remaining quantity by selected area before day close.' },
    { value: 'monthly_full', label: 'Monthly Full Blind Verify', help: 'Whole-branch stock verification for accurate monthly close.' },
];

const REVIEW_ACTIONS = [
    { value: 'accept', label: 'Accept' },
    { value: 'recount', label: 'Recount' },
    { value: 'adjust_stock', label: 'Adjust Stock' },
    { value: 'escalate', label: 'Escalate' },
];

export function StockCount() {
    const navigate = useNavigate();
    const {
        canViewBlindCounts,
        canScheduleBlindCounts,
        canPerformBlindCounts,
        canReviewBlindCounts,
        canCloseInventoryMonth,
    } = usePermissionAccess();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [locations, setLocations] = useState<BranchLocation[]>([]);
    const [sessions, setSessions] = useState<BlindCountSessionSummary[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [selectedSession, setSelectedSession] = useState<BlindCountSessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);

    const [createType, setCreateType] = useState<CountType>('random_cycle');
    const [createLocationId, setCreateLocationId] = useState<string>('');
    const [createSampleSize, setCreateSampleSize] = useState<string>('12');

    const [countInputs, setCountInputs] = useState<Record<number, string>>({});
    const [reviewInputs, setReviewInputs] = useState<Record<number, { review_action: string; reason_code: string; review_notes: string }>>({});

    const refresh = useCallback(async (preferredSessionId?: number | null) => {
        if (!branchId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [dashboardData, sessionData, locationData] = await Promise.all([
                inventoryApi.getBlindCountDashboard(branchId),
                inventoryApi.getBlindCountSessions(branchId),
                branchApi.getLocations(branchId),
            ]);
            setDashboard(dashboardData);
            setSessions(sessionData);
            setLocations(locationData);
            const nextSelectedId = preferredSessionId
                ?? selectedSessionId
                ?? sessionData[0]?.id
                ?? null;
            setSelectedSessionId(nextSelectedId);
            if (nextSelectedId) {
                const detail = await inventoryApi.getBlindCountSession(nextSelectedId);
                setSelectedSession(detail);
                setCountInputs(Object.fromEntries(
                    (detail.items || []).map((item: BlindCountLine) => [item.item_id, item.counted_quantity ?? '']),
                ));
                setReviewInputs(Object.fromEntries(
                    (detail.items || []).map((item: BlindCountLine) => [item.id, {
                        review_action: item.review_action || (item.variance_quantity && Math.abs(item.variance_quantity) > 0.0001 ? 'accept' : 'accept'),
                        reason_code: item.reason_code || '',
                        review_notes: item.review_notes || '',
                    }]),
                ));
            } else {
                setSelectedSession(null);
                setCountInputs({});
                setReviewInputs({});
            }
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load blind count workspace.');
        } finally {
            setLoading(false);
        }
    }, [branchId, selectedSessionId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const loadSelectedSession = useCallback(async () => {
        if (!selectedSessionId) return;
        try {
            const detail = await inventoryApi.getBlindCountSession(selectedSessionId);
            setSelectedSession(detail);
            setCountInputs(Object.fromEntries(
                (detail.items || []).map((item: BlindCountLine) => [item.item_id, item.counted_quantity ?? '']),
            ));
            setReviewInputs(Object.fromEntries(
                (detail.items || []).map((item: BlindCountLine) => [item.id, {
                    review_action: item.review_action || 'accept',
                    reason_code: item.reason_code || '',
                    review_notes: item.review_notes || '',
                }]),
            ));
        } catch (error: any) {
            toast.error('Session Load Failed', error.message || 'Could not load blind count detail.');
        }
    }, [selectedSessionId]);

    useEffect(() => {
        if (!selectedSessionId || loading) return;
        if (!sessions.some((session) => session.id === selectedSessionId)) return;
        void loadSelectedSession();
    }, [loadSelectedSession, loading, selectedSessionId, sessions]);

    const selectedType = useMemo(
        () => COUNT_TYPE_OPTIONS.find((option) => option.value === createType),
        [createType],
    );

    const openCountEntry = selectedSession && canPerformBlindCounts && ['scheduled', 'in_progress'].includes(selectedSession.status);
    const openReview = selectedSession && canReviewBlindCounts && ['submitted', 'under_review', 'adjustment_pending', 'escalated', 'reconciled'].includes(selectedSession.status);

    const createSession = async () => {
        if (!canScheduleBlindCounts && !canCloseInventoryMonth) {
            toast.error('Access Denied', 'Your current role cannot create blind count sessions.');
            return;
        }
        if (!branchId) return;
        setWorking(true);
        try {
            const created = await inventoryApi.createBlindCountSession({
                branch_id: branchId,
                count_type: createType,
                location_id: createLocationId ? Number(createLocationId) : undefined,
                sample_size: createType === 'monthly_full' ? undefined : Number(createSampleSize || 0),
                force_full_count: createType === 'monthly_full',
            });
            toast.success('Blind Count Created', `${created.session_code} is ready for counting.`);
            await refresh(created.id);
        } catch (error: any) {
            toast.error('Create Failed', error.message || 'Could not create blind count session.');
        } finally {
            setWorking(false);
        }
    };

    const submitCount = async () => {
        if (!canPerformBlindCounts) {
            toast.error('Access Denied', 'Your current role cannot submit blind counts.');
            return;
        }
        if (!selectedSession) return;
        const lines = selectedSession.items.map((item) => ({
            item_id: item.item_id,
            counted_quantity: Number(countInputs[item.item_id]),
        }));
        if (lines.some((line) => Number.isNaN(line.counted_quantity))) {
            toast.error('Incomplete Count', 'Enter a counted quantity for every blind count line.');
            return;
        }
        setWorking(true);
        try {
            await inventoryApi.submitBlindCountSession(selectedSession.id, { lines });
            toast.success('Blind Count Submitted', 'Variance is now available for review.');
            await refresh(selectedSession.id);
        } catch (error: any) {
            toast.error('Submit Failed', error.message || 'Could not submit blind count session.');
        } finally {
            setWorking(false);
        }
    };

    const submitReview = async () => {
        if (!canReviewBlindCounts) {
            toast.error('Access Denied', 'Your current role cannot review blind counts.');
            return;
        }
        if (!selectedSession) return;
        const lines = selectedSession.items.map((item) => ({
            line_id: item.id,
            review_action: reviewInputs[item.id]?.review_action || 'accept',
            reason_code: reviewInputs[item.id]?.reason_code || undefined,
            review_notes: reviewInputs[item.id]?.review_notes || undefined,
        }));
        setWorking(true);
        try {
            await inventoryApi.reviewBlindCountSession(selectedSession.id, { lines });
            toast.success('Review Saved', 'Blind count review was completed.');
            await refresh(selectedSession.id);
        } catch (error: any) {
            toast.error('Review Failed', error.message || 'Could not review blind count session.');
        } finally {
            setWorking(false);
        }
    };

    if (!canViewBlindCounts) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <p>Your current role does not include blind count access.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <ClipboardList size={24} className={styles.titleIcon} />
                            <h1>Blind Stock Verification</h1>
                        </div>
                        <p className={styles.subtitle}>Random checks, end-of-day blind closes, and monthly full blind verification for the active branch.</p>
                    </div>
                </div>
                <KitchenButton variant="ghost" onClick={() => void refresh(selectedSessionId)}>
                    <RefreshCcw size={16} style={{ marginRight: '8px' }} />
                    Refresh
                </KitchenButton>
            </div>

            <div className={styles.kpiGrid}>
                <KitchenCard className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Open Sessions</span>
                    <strong className={styles.kpiValue}>{dashboard?.summary?.open_sessions ?? 0}</strong>
                </KitchenCard>
                <KitchenCard className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Escalations</span>
                    <strong className={styles.kpiValue}>{dashboard?.summary?.escalated_sessions ?? 0}</strong>
                </KitchenCard>
                <KitchenCard className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>30d Accuracy</span>
                    <strong className={styles.kpiValue}>{Number(dashboard?.summary?.average_accuracy_30d ?? 0).toFixed(1)}%</strong>
                </KitchenCard>
                <KitchenCard className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>30d Variance Value</span>
                    <strong className={styles.kpiValue}>{Number(dashboard?.summary?.variance_value_30d ?? 0).toLocaleString()}</strong>
                </KitchenCard>
            </div>

            <div className={styles.layout}>
                <div className={styles.sidebar}>
                    <KitchenCard className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3>Create Blind Count</h3>
                                <p>{selectedType?.help}</p>
                            </div>
                            <Target size={18} />
                        </div>
                        <div className={styles.formGrid}>
                            <label className={styles.field}>
                                <span>Count Type</span>
                                <select value={createType} onChange={(event) => setCreateType(event.target.value as CountType)}>
                                    {COUNT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span>Area / Location</span>
                                <select value={createLocationId} onChange={(event) => setCreateLocationId(event.target.value)}>
                                    <option value="">Branch Wide</option>
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>{location.location_name}</option>
                                    ))}
                                </select>
                            </label>
                            {createType !== 'monthly_full' && (
                                <KitchenInput
                                    label="Sample Size"
                                    type="number"
                                    value={createSampleSize}
                                    onChange={(event) => setCreateSampleSize(event.target.value)}
                                />
                            )}
                            <KitchenButton variant="primary" onClick={createSession} disabled={working || (!canScheduleBlindCounts && !canCloseInventoryMonth)}>
                                <Plus size={16} style={{ marginRight: '8px' }} />
                                Create Session
                            </KitchenButton>
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3>Sessions</h3>
                                <p>Latest blind count work for this branch.</p>
                            </div>
                            <CalendarDays size={18} />
                        </div>
                        <div className={styles.sessionList}>
                            {loading ? (
                                <div className={styles.emptyState}>Loading sessions...</div>
                            ) : sessions.length === 0 ? (
                                <div className={styles.emptyState}>No blind count sessions yet.</div>
                            ) : sessions.map((session) => (
                                <button
                                    key={session.id}
                                    className={`${styles.sessionCard} ${selectedSessionId === session.id ? styles.sessionCardActive : ''}`}
                                    onClick={() => setSelectedSessionId(session.id)}
                                >
                                    <div className={styles.sessionCardTop}>
                                        <strong>{session.title}</strong>
                                        <span className={`${styles.statusBadge} ${styles[`status_${session.status}`] || ''}`}>{session.status}</span>
                                    </div>
                                    <div className={styles.sessionMeta}>{session.count_type.replace(/_/g, ' ')} • {session.location_name || 'Branch Wide'}</div>
                                    <div className={styles.sessionMeta}>{session.business_date}</div>
                                    <div className={styles.sessionMetrics}>
                                        <span>{session.counted_line_count}/{session.line_count} counted</span>
                                        <span>{Number(session.accuracy_score || 0).toFixed(1)}%</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </KitchenCard>
                </div>

                <div className={styles.detailColumn}>
                    <KitchenCard className={styles.card}>
                        {!selectedSession ? (
                            <div className={styles.emptyState}>Select or create a blind count session to start.</div>
                        ) : (
                            <>
                                <div className={styles.cardHeader}>
                                    <div>
                                        <h3>{selectedSession.title}</h3>
                                        <p>{selectedSession.session_code} • {selectedSession.location?.name || 'Branch Wide'} • {selectedSession.business_date}</p>
                                    </div>
                                    {selectedSession.metrics.escalation_required ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                                </div>

                                <div className={styles.detailStats}>
                                    <div><span>Lines</span><strong>{selectedSession.metrics.line_count}</strong></div>
                                    <div><span>Variance Lines</span><strong>{selectedSession.metrics.variance_line_count}</strong></div>
                                    <div><span>Critical</span><strong>{selectedSession.metrics.critical_line_count}</strong></div>
                                    <div><span>Accuracy</span><strong>{Number(selectedSession.metrics.accuracy_score || 0).toFixed(1)}%</strong></div>
                                </div>

                                <div className={styles.tableWrap}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Item</th>
                                                <th>Area</th>
                                                {selectedSession.items[0]?.expected_quantity_snapshot !== null && <th>System Qty</th>}
                                                <th>Counted Qty</th>
                                                {selectedSession.items[0]?.variance_quantity !== null && <th>Variance</th>}
                                                {selectedSession.items[0]?.discrepancy_level !== null && <th>Level</th>}
                                                {openReview && <th>Review</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSession.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.blind_sequence}</td>
                                                    <td>
                                                        <div className={styles.itemCell}>
                                                            <strong>{item.item_name}</strong>
                                                            <span>{item.unit}</span>
                                                        </div>
                                                    </td>
                                                    <td>{item.location_name || '—'}</td>
                                                    {item.expected_quantity_snapshot !== null && <td>{Number(item.expected_quantity_snapshot || 0).toFixed(2)}</td>}
                                                    <td>
                                                        {openCountEntry ? (
                                                            <input
                                                                className={styles.qtyInput}
                                                                type="number"
                                                                step="0.01"
                                                                value={countInputs[item.item_id] ?? ''}
                                                                onChange={(event) => setCountInputs((current) => ({
                                                                    ...current,
                                                                    [item.item_id]: event.target.value,
                                                                }))}
                                                            />
                                                        ) : (
                                                            <strong>{item.counted_quantity === null ? '—' : Number(item.counted_quantity).toFixed(2)}</strong>
                                                        )}
                                                    </td>
                                                    {item.variance_quantity !== null && <td>{Number(item.variance_quantity || 0).toFixed(2)}</td>}
                                                    {item.discrepancy_level !== null && <td>{item.discrepancy_level}</td>}
                                                    {openReview && (
                                                        <td>
                                                            <div className={styles.reviewCell}>
                                                                <select
                                                                    value={reviewInputs[item.id]?.review_action || 'accept'}
                                                                    onChange={(event) => setReviewInputs((current) => ({
                                                                        ...current,
                                                                        [item.id]: {
                                                                            ...current[item.id],
                                                                            review_action: event.target.value,
                                                                            reason_code: current[item.id]?.reason_code || '',
                                                                            review_notes: current[item.id]?.review_notes || '',
                                                                        },
                                                                    }))}
                                                                >
                                                                    {REVIEW_ACTIONS.map((action) => (
                                                                        <option key={action.value} value={action.value}>{action.label}</option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Reason code"
                                                                    value={reviewInputs[item.id]?.reason_code || ''}
                                                                    onChange={(event) => setReviewInputs((current) => ({
                                                                        ...current,
                                                                        [item.id]: {
                                                                            ...current[item.id],
                                                                            review_action: current[item.id]?.review_action || 'accept',
                                                                            reason_code: event.target.value,
                                                                            review_notes: current[item.id]?.review_notes || '',
                                                                        },
                                                                    }))}
                                                                />
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {selectedSession.metrics.escalation_reason && (
                                    <div className={styles.alertBox}>
                                        <AlertTriangle size={16} />
                                        <span>{selectedSession.metrics.escalation_reason}</span>
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    {openCountEntry && (
                                        <KitchenButton variant="primary" onClick={submitCount} disabled={working || !canPerformBlindCounts}>
                                            <CheckCircle2 size={16} style={{ marginRight: '8px' }} />
                                            {working ? 'Submitting...' : 'Submit Blind Count'}
                                        </KitchenButton>
                                    )}
                                    {openReview && (
                                        <KitchenButton variant="primary" onClick={submitReview} disabled={working || !canReviewBlindCounts}>
                                            <ShieldCheck size={16} style={{ marginRight: '8px' }} />
                                            {working ? 'Saving...' : 'Complete Review'}
                                        </KitchenButton>
                                    )}
                                </div>
                            </>
                        )}
                    </KitchenCard>

                    <KitchenCard className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3>Control Signals</h3>
                                <p>Recent trends, repeat offenders, and best performers.</p>
                            </div>
                        </div>
                        <div className={styles.signalGrid}>
                            <div>
                                <h4>Best Performers</h4>
                                {(dashboard?.best_performers || []).slice(0, 5).map((row: any) => (
                                    <div key={row.name} className={styles.signalRow}>
                                        <span>{row.name}</span>
                                        <strong>{Number(row.average_accuracy || 0).toFixed(1)}%</strong>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4>Repeat Offender Areas</h4>
                                {(dashboard?.repeat_offenders?.locations || []).slice(0, 5).map((row: any) => (
                                    <div key={row.name} className={styles.signalRow}>
                                        <span>{row.name}</span>
                                        <strong>{Number(row.variance_value_total || 0).toLocaleString()}</strong>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4>Repeat Offender Items</h4>
                                {(dashboard?.repeat_offenders?.items || []).slice(0, 5).map((row: any) => (
                                    <div key={row.item_id} className={styles.signalRow}>
                                        <span>{row.item_name}</span>
                                        <strong>{row.variance_count}x</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            </div>
        </div>
    );
}
