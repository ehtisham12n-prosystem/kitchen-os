import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarRange, ShieldCheck, Store } from 'lucide-react';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './ClosingDashboard.module.css';

export function ClosingDashboard() {
    const navigate = useNavigate();
    const { canReportBlindCounts, canViewBlindCounts } = usePermissionAccess();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!branchId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await inventoryApi.getClosingDashboard(branchId);
                setDashboard(data);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load blind closing dashboard.');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [branchId]);

    if (!canReportBlindCounts) {
        return (
            <div className={styles.page}>
                <KitchenCard className={styles.card}>Your current role does not include inventory close reporting access.</KitchenCard>
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
                            <CalendarRange size={24} className={styles.titleIcon} />
                            <h1>Blind Closing Dashboard</h1>
                        </div>
                        <p className={styles.subtitle}>Daily area close status, unresolved critical blind counts, and monthly stock-close readiness.</p>
                    </div>
                </div>
                <KitchenButton variant="primary" onClick={() => navigate('/console/inventory/stock-count')} disabled={!canViewBlindCounts}>
                    Open Blind Counts
                </KitchenButton>
            </div>

            {loading ? (
                <KitchenCard className={styles.card}>Loading closing dashboard...</KitchenCard>
            ) : (
                <>
                    <div className={styles.kpiGrid}>
                        <KitchenCard className={styles.kpiCard}>
                            <span>Daily Blind Close Sessions</span>
                            <strong>{dashboard?.daily_close?.sessions_due ?? 0}</strong>
                        </KitchenCard>
                        <KitchenCard className={styles.kpiCard}>
                            <span>Completed Today</span>
                            <strong>{dashboard?.daily_close?.sessions_completed ?? 0}</strong>
                        </KitchenCard>
                        <KitchenCard className={styles.kpiCard}>
                            <span>Pending Today</span>
                            <strong>{dashboard?.daily_close?.sessions_pending ?? 0}</strong>
                        </KitchenCard>
                        <KitchenCard className={styles.kpiCard}>
                            <span>Monthly Readiness</span>
                            <strong>{dashboard?.monthly_close?.readiness ?? 'pending'}</strong>
                        </KitchenCard>
                    </div>

                    <div className={styles.layout}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3>Daily Close Control</h3>
                                    <p>Blind end-of-day verification performance for {dashboard?.business_date}</p>
                                </div>
                                <Store size={18} />
                            </div>
                            <div className={styles.statList}>
                                <div><span>Blind close required</span><strong>{dashboard?.daily_close?.required_blind_close_enabled ? 'Yes' : 'No'}</strong></div>
                                <div><span>Variance value today</span><strong>{Number(dashboard?.daily_close?.variance_value_total ?? 0).toLocaleString()}</strong></div>
                                <div><span>Month period</span><strong>{dashboard?.period_key}</strong></div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3>Monthly Full Blind Verify</h3>
                                    <p>Closing control for inventory valuation and month-end confidence.</p>
                                </div>
                                {dashboard?.monthly_close?.readiness === 'ready' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
                            </div>
                            {dashboard?.monthly_close?.session ? (
                                <div className={styles.statList}>
                                    <div><span>Session</span><strong>{dashboard.monthly_close.session.session_code}</strong></div>
                                    <div><span>Status</span><strong>{dashboard.monthly_close.session.status}</strong></div>
                                    <div><span>Accuracy</span><strong>{Number(dashboard.monthly_close.session.accuracy_score ?? 0).toFixed(1)}%</strong></div>
                                    <div><span>Variance Value</span><strong>{Number(dashboard.monthly_close.session.variance_value_total ?? 0).toLocaleString()}</strong></div>
                                </div>
                            ) : (
                                <div className={styles.emptyState}>No monthly blind verification session exists for this period yet.</div>
                            )}
                        </KitchenCard>
                    </div>

                    <KitchenCard className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3>Unresolved Critical Sessions</h3>
                                <p>These blind count sessions still carry critical discrepancies or escalations.</p>
                            </div>
                        </div>
                        <div className={styles.list}>
                            {(dashboard?.unresolved_critical_sessions || []).length === 0 ? (
                                <div className={styles.emptyState}>No unresolved critical blind count sessions.</div>
                            ) : (
                                (dashboard?.unresolved_critical_sessions || []).map((session: any) => (
                                    <div key={session.id} className={styles.listRow}>
                                        <div>
                                            <strong>{session.title}</strong>
                                            <span>{session.session_code} • {session.location_name || 'Branch Wide'}</span>
                                        </div>
                                        <div>
                                            <strong>{session.status}</strong>
                                            <span>{Number(session.variance_value_total ?? 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </KitchenCard>
                </>
            )}
        </div>
    );
}
