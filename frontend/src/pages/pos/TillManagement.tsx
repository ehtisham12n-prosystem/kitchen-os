/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Clock,
    DollarSign,
    EyeOff,
    Lock,
    LogOut,
    Monitor,
    Play,
    Printer,
    Receipt,
    TrendingUp,
    User,
    Wallet,
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { toast } from '../../components/ui/KitchenToast/toast';
import { branchApi, posApi, saleCounterApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { buildCashReconciliationReportPrintDocument, buildCounterSessionXReportPrintDocument, buildHourlySalesReportPrintDocument, type PrintPaperFormat } from './printTemplates/kotPrintTemplate';
import { openPrintDocument, openPrintDocumentCopies, resolvePrintTemplateSettings } from './printTemplates/printHelpers';
import { XReportPrintModal } from './XReportPrintModal';
import {
    clearActiveTillSession,
    getActiveTillSession,
    setActiveTillSession,
    type TerminalTillSession,
} from './terminalSession';
import styles from './TillManagement.module.css';

type Stage = 'select' | 'open_float' | 'active' | 'blind_count' | 'reconcile';

type Counter = {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    branch_id: number;
};

const STAGES: { key: Stage; label: string; step: number }[] = [
    { key: 'open_float', label: 'Open Till', step: 1 },
    { key: 'active', label: 'Active', step: 2 },
    { key: 'blind_count', label: 'Count', step: 3 },
    { key: 'reconcile', label: 'Close', step: 4 },
];

function getStageIndex(stage: Stage): number {
    return STAGES.findIndex(s => s.key === stage);
}

function getSessionDuration(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
}

export function TillManagement() {
    const navigate = useNavigate();
    const { currencyLabel, formatMoney } = useCurrencyConfig();
    const { canOperatePos, canManageTillSessions } = usePermissionAccess();
    const [branchId, setBranchId] = useState<number | null>(null);
    const [branchName, setBranchName] = useState('Selected Branch');
    const [currentUserName, setCurrentUserName] = useState('Current User');
    const [tills, setTills] = useState<Counter[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedTill, setSelectedTill] = useState<Counter | null>(null);
    const [stage, setStage] = useState<Stage>('select');
    const [openingFloat, setOpeningFloat] = useState('');
    const [openingFloatReadOnly, setOpeningFloatReadOnly] = useState(false);
    const [authorizedTillId, setAuthorizedTillId] = useState<number | null>(null);
    const [blindCount, setBlindCount] = useState('');
    const [closeCashierUsername, setCloseCashierUsername] = useState('');
    const [closeCashierPin, setCloseCashierPin] = useState('');
    const [closeAuthorizedUsername, setCloseAuthorizedUsername] = useState('');
    const [closeAuthorizedPin, setCloseAuthorizedPin] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [dashboard, setDashboard] = useState<any>(null);
    const [xReportSessionId, setXReportSessionId] = useState<number | null>(null);
    const settings = resolvePrintTemplateSettings({ branch_name: branchName }, branchName);

    const applyTillSessionState = (counter: Counter, session: any) => {
        const sessionId = Number(session?.id || 0);
        const terminalStatus = String(session?.terminal_status || '').toLowerCase();
        const openingAmount = Number(session?.opening_verified_cash ?? session?.assigned_float ?? 0);

        setSelectedTill(counter);
        setAuthorizedTillId(Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null);
        setOpeningFloat(String(openingAmount));
        setOpeningFloatReadOnly(['active', 'blind_submitted', 'closed'].includes(terminalStatus));
        setBlindCount(['blind_submitted', 'closed'].includes(terminalStatus) ? String(Number(session?.blind_count || 0)) : '');

        if (terminalStatus === 'active') {
            setActiveTillSession({
                id: counter.id,
                name: counter.name,
                code: counter.code,
                branch_id: counter.branch_id,
            });
            setStage('active');
            return;
        }

        clearActiveTillSession();
        setStage(['blind_submitted', 'closed'].includes(terminalStatus) ? 'reconcile' : 'open_float');
    };

    useEffect(() => {
        const activeBranchId = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
        if (activeBranchId) {
            setBranchId(Number(activeBranchId));
        }
        const activeBranchName = localStorage.getItem('branch_name');
        if (activeBranchName) {
            setBranchName(activeBranchName);
        }
        try {
            const parsed = readStoredUserContext();
            if (parsed?.username || parsed?.user_name) {
                setCurrentUserName(parsed.username || parsed.user_name || 'Current User');
            }
        } catch {
            // ignore malformed local storage
        }
    }, []);

    useEffect(() => {
        if (!branchId) {
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const [branches, counters, branchDashboard, myCounterSession] = await Promise.all([
                    branchApi.getBranches(),
                    saleCounterApi.getAll(branchId),
                    posApi.getBranchDashboard(branchId),
                    posApi.getMyCounterSession(branchId).catch(() => null),
                ]);
                const resolvedBranch = branches.find((branch: any) => branch.id === branchId);
                if (resolvedBranch?.branch_name) {
                    setBranchName(resolvedBranch.branch_name);
                    localStorage.setItem('branch_name', resolvedBranch.branch_name);
                }
                setTills((counters || []).filter((counter: Counter) => counter.is_active));
                setDashboard(branchDashboard);

                if (myCounterSession?.sale_counter_id) {
                    const matchingTill = (counters || []).find((counter: Counter) => counter.id === Number(myCounterSession.sale_counter_id));
                    if (matchingTill) {
                        applyTillSessionState(matchingTill, myCounterSession);
                        return;
                    }
                }

                const activeSession = getActiveTillSession();
                if (activeSession && activeSession.branch_id === branchId) {
                    const matchingTill = (counters || []).find((counter: Counter) => counter.id === activeSession.id);
                    if (matchingTill) {
                        setSelectedTill(matchingTill);
                        setStage('select');
                    }
                }
            } catch (error) {
                console.error('Failed to load till data:', error);
                toast.error('POS Load Failed', 'Could not load sale counters or day state.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [branchId, refreshKey]);

    const systemTotals = useMemo(() => {
        const currentShift = dashboard?.current_shift;
        if (!currentShift) {
            return null;
        }
        const expectedCash = Number(currentShift.expected_cash || 0);
        const opening = Number(currentShift.opening_float || 0);
        return {
            expected_cash: expectedCash,
            total_orders: Number(dashboard?.reports?.totalOrders || 0),
            cash_sales: Math.max(expectedCash - opening, 0),
        };
    }, [dashboard]);


    const handleSelectTill = async (till: Counter) => {
        setSelectedTill(till);
        // Look up the pre-authorized float from the Manager's day setup
        if (branchId) {
            try {
                const authTills = await posApi.getAuthorizedTills(branchId);
                const authRow = authTills.find((t: any) => t.sale_counter_id === till.id);
                if (authRow) {
                    applyTillSessionState(till, authRow);
                } else {
                    setAuthorizedTillId(null);
                    setOpeningFloat('');
                    setOpeningFloatReadOnly(false);
                    clearActiveTillSession();
                    setStage('open_float');
                }
            } catch {
                setAuthorizedTillId(null);
                setOpeningFloat('');
                setOpeningFloatReadOnly(false);
                clearActiveTillSession();
                setStage('open_float');
            }
        }
    };

    const handleOpenTill = async () => {
        if (!selectedTill || !branchId || !openingFloat) {
            return;
        }
        if (!authorizedTillId) {
            toast.error('Manager Assignment Required', 'Ask the branch manager to assign this sales counter before opening it from the cashier screen.');
            return;
        }
        setIsSubmitting(true);
        try {
            const verifiedSession = await posApi.verifyCounterOpening(branchId, authorizedTillId, {
                verified_opening_cash: Number(openingFloat),
            });
            const browserSession: TerminalTillSession = {
                id: selectedTill.id,
                name: selectedTill.name,
                code: selectedTill.code,
                branch_id: branchId,
            };
            setActiveTillSession(browserSession);
            setOpeningFloat(String(Number(verifiedSession?.opening_verified_cash ?? openingFloat)));
            setOpeningFloatReadOnly(true);
            setStage('active');
            setRefreshKey((value) => value + 1);
            toast.success('Till Ready', `${selectedTill.name} is ready for POS operations.`);
        } catch (error: any) {
            console.error('Failed to open till:', error);
            toast.error('Till Open Failed', error?.message || 'Could not open the till for this branch.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartBlindCount = () => {
        setBlindCount('');
        setCloseCashierUsername(currentUserName);
        setCloseCashierPin('');
        setCloseAuthorizedUsername('');
        setCloseAuthorizedPin('');
        setStage('blind_count');
    };

    const handleSubmitBlindCount = async () => {
        if (!blindCount || !branchId) return;
        if (!authorizedTillId) {
            toast.error('Counter Session Missing', 'This till does not have an active counter session to close.');
            return;
        }
        if (!closeCashierUsername.trim() || !closeCashierPin.trim() || !closeAuthorizedUsername.trim() || !closeAuthorizedPin.trim()) {
            toast.error('Authorization Required', 'Enter cashier and authorized-user IDs with their PINs.');
            return;
        }
        setIsSubmitting(true);
        try {
            await posApi.submitBlindCount(branchId, authorizedTillId, {
                blind_count: parseFloat(blindCount),
                cashier_username: closeCashierUsername.trim(),
                cashier_pin: closeCashierPin.trim(),
                authorized_username: closeAuthorizedUsername.trim(),
                authorized_pin: closeAuthorizedPin.trim(),
            });
            clearActiveTillSession();
            setStage('reconcile');
            toast.success('Counter Closed', 'The till has been fully closed and the counted cash has been handed to branch-safe custody.');
        } catch (err: any) {
            toast.error('Count Submit Failed', err?.message || 'Could not submit blind count.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalize = async () => {
        if (!selectedTill) {
            return;
        }
        setIsSubmitting(true);
        try {
            clearActiveTillSession();
            setIsClosed(true);
            toast.success('Till Session Ended', `${selectedTill.name} has been released from this browser session.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintCashReconciliation = () => {
        const expected = Number(systemTotals?.expected_cash || 0);
        const actual = Number(blindCount || 0);
        const variance = actual - expected;
        const documentMarkup = buildCashReconciliationReportPrintDocument({
            settings,
            format: 'thermal-80mm',
            data: {
                expected: formatMoney(expected),
                actual: formatMoney(actual),
                variance: formatMoney(variance),
                printed_at: new Date(),
                print_id: dashboard?.current_shift?.id || selectedTill?.id || 'cash-reconciliation',
            },
        });

        if (!openPrintDocument(documentMarkup, 'Cash Reconciliation')) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print reports.');
        }
    };

    const handlePrintCounterXReport = async (sessionId: number, formatOverride?: PrintPaperFormat) => {
        if (!branchId) return;
        try {
            const report = await posApi.getCounterSessionXReport(branchId, sessionId);
            const formatMoneyValue = (value: any) => formatMoney(Number(value || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            const reportFormat = (['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(settings.report_paper_size as PrintPaperFormat)
                ? (settings.report_paper_size as PrintPaperFormat)
                : 'thermal-80mm';
            const documentMarkup = buildCounterSessionXReportPrintDocument({
                settings,
                format: formatOverride || reportFormat,
                data: {
                    ...report,
                    printed_at: new Date(),
                    sections: {
                        ...report?.sections,
                        cash_summary: {
                            ...report?.sections?.cash_summary,
                            opening_cash: formatMoneyValue(report?.sections?.cash_summary?.opening_cash),
                            cash_sale: formatMoneyValue(report?.sections?.cash_summary?.cash_sale),
                            cash_expense: formatMoneyValue(report?.sections?.cash_summary?.cash_expense),
                            cash_refund: formatMoneyValue(report?.sections?.cash_summary?.cash_refund),
                            total_cash_in_hand: formatMoneyValue(report?.sections?.cash_summary?.total_cash_in_hand),
                        },
                        cash_actual_vs_expected: {
                            ...report?.sections?.cash_actual_vs_expected,
                            expected_cash: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.expected_cash),
                            actual_cash: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.actual_cash),
                            variance: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.variance),
                        },
                        pos_summary: {
                            ...report?.sections?.pos_summary,
                            cash_sale: formatMoneyValue(report?.sections?.pos_summary?.cash_sale),
                            online_payment_sale: formatMoneyValue(report?.sections?.pos_summary?.online_payment_sale),
                            credit_card_sale: formatMoneyValue(report?.sections?.pos_summary?.credit_card_sale),
                            wallet_sale: formatMoneyValue(report?.sections?.pos_summary?.wallet_sale),
                            total_sale: formatMoneyValue(report?.sections?.pos_summary?.total_sale),
                            returned_amount: formatMoneyValue(report?.sections?.pos_summary?.returned_amount),
                            discount_amount: formatMoneyValue(report?.sections?.pos_summary?.discount_amount),
                            voided_amount: formatMoneyValue(report?.sections?.pos_summary?.voided_amount),
                        },
                        wallet_summary: {
                            ...report?.sections?.wallet_summary,
                            wallet_used_today: formatMoneyValue(report?.sections?.wallet_summary?.wallet_used_today),
                            added_in_wallet_today: formatMoneyValue(report?.sections?.wallet_summary?.added_in_wallet_today),
                            current_closing_balance: formatMoneyValue(report?.sections?.wallet_summary?.current_closing_balance),
                        },
                        credit_summary: {
                            ...report?.sections?.credit_summary,
                            total_credited_sale_today: formatMoneyValue(report?.sections?.credit_summary?.total_credited_sale_today),
                            previously_pending_credit: formatMoneyValue(report?.sections?.credit_summary?.previously_pending_credit),
                            credited_amount_received: formatMoneyValue(report?.sections?.credit_summary?.credited_amount_received),
                            net_credit_balance: formatMoneyValue(report?.sections?.credit_summary?.net_credit_balance),
                        },
                        expense_summary: {
                            ...report?.sections?.expense_summary,
                            expense_from_cash_counter: formatMoneyValue(report?.sections?.expense_summary?.expense_from_cash_counter),
                            total_expense: formatMoneyValue(report?.sections?.expense_summary?.total_expense),
                        },
                        order_type_summary: (report?.sections?.order_type_summary || []).map((row: any) => ({ ...row, amount: formatMoneyValue(row.amount) })),
                        sold_items_summary: (report?.sections?.sold_items_summary || []).map((row: any) => ({ ...row, gross_sale: formatMoneyValue(row.gross_sale), returned_amount: formatMoneyValue(row.returned_amount), net_sale: formatMoneyValue(row.net_sale) })),
                        station_wise_sale: (report?.sections?.station_wise_sale || []).map((row: any) => ({ ...row, sales_amount: formatMoneyValue(row.sales_amount) })),
                        events_summary: {
                            ...report?.sections?.events_summary,
                            payment_received_against_events: formatMoneyValue(report?.sections?.events_summary?.payment_received_against_events),
                            receivable_amount_of_event: formatMoneyValue(report?.sections?.events_summary?.receivable_amount_of_event),
                        },
                    },
                },
            });
            if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, 'Sales Counter Closing Report')) {
                toast.error('Print Blocked', 'Allow pop-ups for this app to print reports.');
            }
        } catch (error: any) {
            toast.error('Report Failed', error?.message || 'Could not prepare the counter closing report.');
        }
    };

    const buildHourlyRows = (orders: any[]) => {
        const buckets = new Map<string, { orders: number; sales: number }>();
        orders.forEach((order) => {
            const sourceDate = order?.finalized_at || order?.created_at;
            if (!sourceDate) return;
            const date = new Date(sourceDate);
            const hour = date.toLocaleTimeString([], { hour: '2-digit', hour12: true }).replace(':00', '');
            const bucket = buckets.get(hour) ?? { orders: 0, sales: 0 };
            bucket.orders += 1;
            bucket.sales += Number(order?.total_amount || 0);
            buckets.set(hour, bucket);
        });

        return Array.from(buckets.entries()).map(([hour, values]) => ({
            hour,
            orders: values.orders,
            sales: formatMoney(values.sales),
        }));
    };

    const handlePrintHourlySales = async (mode: 'shift' | 'day') => {
        if (!branchId || !selectedTill) return;
        try {
            const [historyRows, completedOrders] = await Promise.all([
                posApi.getCounterHistory(branchId, selectedTill.id),
                posApi.getOrders(branchId, 'completed'),
            ]);
            const latestSession = Array.isArray(historyRows) ? historyRows[0] : null;
            if (!latestSession) {
                toast.error('No Counter Session', 'No counter-session history was found for this terminal.');
                return;
            }

            const shiftStart = new Date(latestSession.activated_at || latestSession.opened_at || Date.now());
            const shiftEnd = latestSession.closed_at ? new Date(latestSession.closed_at) : new Date();
            const businessDate = String(latestSession.business_date || '').slice(0, 10);

            const rows = (Array.isArray(completedOrders) ? completedOrders : []).filter((order: any) => {
                if (Number(order?.sale_counter_id || order?.sale_counter?.id || 0) !== Number(selectedTill.id)) return false;
                const finalizedAt = order?.finalized_at || order?.created_at;
                if (!finalizedAt) return false;
                const orderDate = new Date(finalizedAt);
                if (mode === 'shift') {
                    return orderDate >= shiftStart && orderDate <= shiftEnd;
                }
                return businessDate ? orderDate.toISOString().slice(0, 10) === businessDate : false;
            });

            const documentMarkup = buildHourlySalesReportPrintDocument({
                settings,
                format: 'thermal-80mm',
                data: {
                    hours: buildHourlyRows(rows),
                    printed_at: new Date(),
                    print_id: `${selectedTill.id}-${mode}-${businessDate || 'hourly'}`,
                },
            });

            if (!openPrintDocument(documentMarkup, mode === 'shift' ? 'Hourly Sales Session' : 'Hourly Sales Day')) {
                toast.error('Print Blocked', 'Allow pop-ups for this app to print hourly sales.');
            }
        } catch (error: any) {
            toast.error('Hourly Report Failed', error?.message || 'Could not prepare the hourly sales report.');
        }
    };

    const reset = () => {
        setSelectedTill(null);
        setStage('select');
        setOpeningFloat('');
        setOpeningFloatReadOnly(false);
        setAuthorizedTillId(null);
        setBlindCount('');
        setCloseCashierUsername('');
        setCloseCashierPin('');
        setCloseAuthorizedUsername('');
        setCloseAuthorizedPin('');
        setIsClosed(false);
        clearActiveTillSession();
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.stageContent}>
                    <div className={styles.focusCard}>
                        <div className={styles.focusCardText}>
                            <h2>Loading till state</h2>
                            <p>Reading sale counters and active business day information for {branchName}.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!branchId) {
        return (
            <div className={styles.page}>
                <div className={styles.stageContent}>
                    <div className={styles.focusCard}>
                        <div className={styles.focusCardText}>
                            <h2>No branch selected</h2>
                            <p>Select a branch in the console first so the terminal can bind to a live branch context.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isClosed && selectedTill) {
        return (
            <div className={styles.page}>
                <div className={styles.successScreen}>
                    <div className={styles.successGlow} />
                    <div className={styles.successIconWrap}>
                        <CheckCircle2 size={48} />
                    </div>
                    <h2>Till Session Closed</h2>
                    <p><strong>{selectedTill.name}</strong> is no longer attached to this browser session. The manager will reconcile this till from the Branch Day Management screen.</p>
                    <div className={styles.successSummary}>
                        <div className={styles.successRow}>
                            <span>Terminal</span>
                            <strong>{selectedTill.name} - {selectedTill.code}</strong>
                        </div>
                            <div className={styles.successRow}>
                                <span>Opening Float</span>
                                <strong>{formatMoney(Number(openingFloat || 0))}</strong>
                            </div>
                            <div className={styles.successRow}>
                                <span>Your Count</span>
                                <strong>{formatMoney(Number(blindCount || 0))}</strong>
                            </div>
                        <div className={styles.successRow}>
                            <span>Variance</span>
                            <strong style={{ color: 'var(--text-secondary)' }}>Hidden — Pending Manager Review</strong>
                        </div>
                    </div>
                    <div className={styles.successActions}>
                        <KitchenButton variant="ghost" onClick={reset}>Back to Counters</KitchenButton>
                        <KitchenButton variant="primary" onClick={() => navigate('/terminal/day')}>
                            Branch Day Management
                        </KitchenButton>
                    </div>
                </div>
            </div>
        );
    }

    if (!canOperatePos && !canManageTillSessions) {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button className={styles.backBtn} onClick={() => navigate('/terminal/day')}>
                            <ArrowLeft size={16} />
                        </button>
                        <div className={styles.headerText}>
                            <div className={styles.headerTitle}>
                                <h1>Till Management</h1>
                            </div>
                            <p className={styles.headerSub}>Cashier till actions are limited to POS operators and authorized branch users.</p>
                        </div>
                    </div>
                </header>

                <div className={`${styles.stageContent} ${styles.centered}`}>
                    <div className={styles.focusCard}>
                        <div className={styles.focusCardText}>
                            <h2>Access Restricted</h2>
                            <p>Your role can review branch operations elsewhere, but it cannot open, blind-close, or release tills from this screen.</p>
                        </div>
                        <KitchenButton variant="primary" onClick={() => navigate('/terminal/day')}>
                            Return to Branch Day
                        </KitchenButton>
                    </div>
                </div>
            </div>
        );
    }

    const currentStageIdx = getStageIndex(stage);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={selectedTill && stage !== 'select' ? reset : () => navigate('/terminal/day')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className={styles.headerText}>
                        <div className={styles.headerTitle}>
                            <h1>Till Management</h1>
                            {selectedTill && (
                                <span className={styles.tillTag}>
                                    <Monitor size={12} />
                                    {selectedTill.name} - {selectedTill.code}
                                </span>
                            )}
                        </div>
                        <p className={styles.headerSub}>
                            {stage === 'select' && `Choose a live sale counter for ${branchName}.`}
                            {stage === 'open_float' && 'Confirm the drawer float and attach this browser to the till.'}
                            {stage === 'active' && 'Process POS orders for the active sale counter.'}
                            {stage === 'blind_count' && 'Submit closing cash with cashier and authorized-user approval. Branch-safe handover posts automatically.'}
                            {stage === 'reconcile' && 'Counter close is finalized and this terminal session is complete.'}
                        </p>
                    </div>
                </div>

                {stage !== 'select' && (
                    <div className={styles.stepper}>
                        {STAGES.map((item, index) => {
                            const isDone = index < currentStageIdx;
                            const isCurrent = index === currentStageIdx;
                            return (
                                <div key={item.key} className={styles.stepperItem}>
                                    <div className={`${styles.stepDot} ${isCurrent ? styles.stepCurrent : isDone ? styles.stepDone : ''}`}>
                                        {isDone ? <CheckCircle2 size={12} /> : item.step}
                                    </div>
                                    <span className={`${styles.stepLabel} ${isCurrent ? styles.stepLabelActive : ''}`}>{item.label}</span>
                                    {index < STAGES.length - 1 && (
                                        <div className={`${styles.stepLine} ${isDone ? styles.stepLineDone : ''}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </header>

            {stage === 'select' && (
                <div className={styles.stageContent}>
                    <div className={styles.sectionLabel}>
                        <span>Available Terminals</span>
                        <span className={styles.sectionCount}>{tills.length} counters</span>
                    </div>
                    <div className={styles.tillGrid}>
                        {tills.length === 0 ? (
                            <div className={styles.focusCard}>
                                <div className={styles.focusCardText}>
                                    <h2>No sale counters configured</h2>
                                    <p>Create at least one live sale counter in setup before running online POS operations.</p>
                                </div>
                                <KitchenButton variant="primary" onClick={() => navigate('/console/setup/sale-counters')}>
                                    Configure Counters
                                </KitchenButton>
                            </div>
                        ) : tills.map(till => {
                            const activeSession = getActiveTillSession();
                            const isCurrentSession = activeSession?.id === till.id && activeSession.branch_id === branchId;
                            return (
                                <div
                                    key={till.id}
                                    className={`${styles.tillCard} ${isCurrentSession ? styles.tillCardOpen : styles.tillCardClosed}`}
                                >
                                    <div className={styles.tillCardTop}>
                                        <div className={styles.tillIconWrap}>
                                            <Monitor size={22} />
                                        </div>
                                        <span className={isCurrentSession ? styles.badgeOpen : styles.badgeClosed}>
                                            {isCurrentSession ? '[Active Here]' : '[Available]'}
                                        </span>
                                    </div>

                                    <div className={styles.tillCardBody}>
                                        <h3 className={styles.tillName}>{till.name}</h3>
                                        <span className={styles.tillCode}>{till.code}</span>
                                    </div>

                                    <div className={styles.tillMeta}>
                                        <div className={styles.metaChip}>
                                            <User size={11} />
                                            {currentUserName}
                                        </div>
                                        {dashboard?.current_shift?.opened_at && (
                                            <div className={styles.metaChip}>
                                                <Clock size={11} />
                                                {getSessionDuration(dashboard.current_shift.opened_at)}
                                            </div>
                                        )}
                                    </div>

                                    <KitchenButton
                                        variant={isCurrentSession ? 'outline' : 'primary'}
                                        className={styles.tillSelectBtn}
                                        onClick={() => handleSelectTill(till)}
                                    >
                                        {isCurrentSession ? 'Manage Session' : 'Use This Till'}
                                        <ChevronRight size={14} />
                                    </KitchenButton>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {stage === 'open_float' && selectedTill && (
                <div className={`${styles.stageContent} ${styles.centered}`}>
                    <div className={styles.focusCard}>
                        <div className={styles.focusIconWrap}>
                            <Wallet size={28} />
                        </div>
                        <div className={styles.focusCardText}>
                            <h2>Prepare Till Session</h2>
                            <p>
                                {openingFloatReadOnly
                                    ? `The manager has pre-authorized ${selectedTill.name} with the float below. Confirm the opening cash to activate this counter session.`
                                    : authorizedTillId
                                    ? `Confirm the opening cash for ${selectedTill.name} to activate the assigned counter session.`
                                    : `This sales counter is not yet assigned. A branch manager must first authorize the counter and cashier from Branch Day Management.`}
                            </p>
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label={openingFloatReadOnly ? `Assigned Float (${currencyLabel}) — Manager Set` : `Amount in Drawer (${currencyLabel}) *`}
                                type="number"
                                placeholder="e.g. 5000"
                                value={openingFloat}
                                onChange={e => !openingFloatReadOnly && setOpeningFloat(e.target.value)}
                                icon={<DollarSign size={16} />}
                                autoFocus={!openingFloatReadOnly}
                                disabled={openingFloatReadOnly}
                            />
                            {openingFloatReadOnly && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Lock size={12} /> Float assigned by Manager — cannot be changed by cashier.
                                </p>
                            )}
                        </div>

                        <KitchenButton
                            variant="primary"
                            className={styles.primaryBtn}
                            disabled={!authorizedTillId || openingFloat === '' || parseFloat(openingFloat) < 0}
                            isLoading={isSubmitting}
                            onClick={handleOpenTill}
                        >
                            <Play size={16} />
                            {authorizedTillId ? 'Verify Opening Cash & Start' : 'Await Manager Assignment'}
                        </KitchenButton>
                    </div>
                </div>
            )}

            {stage === 'active' && selectedTill && systemTotals && (
                <div className={styles.stageContent}>
                    <div className={styles.activeGrid}>
                        <div className={styles.statusPanel}>
                            <div className={styles.liveBar}>
                                <span className={styles.liveDot} />
                                <span>Session Live</span>
                                {dashboard?.current_shift?.opened_at && (
                                    <span className={styles.liveDuration}>
                                        <Clock size={11} /> {getSessionDuration(dashboard.current_shift.opened_at)}
                                    </span>
                                )}
                            </div>

                            <div className={styles.statsRow}>
                                <div className={styles.statBox}>
                                    <div className={styles.statIcon} data-color="indigo"><TrendingUp size={16} /></div>
                                    <div className={styles.statText}>
                                        <span>Orders</span>
                                        <strong>{systemTotals.total_orders}</strong>
                                    </div>
                                </div>
                                <div className={styles.statBox}>
                                    <div className={styles.statIcon} data-color="cyan"><Receipt size={16} /></div>
                                    <div className={styles.statText}>
                                        <span>Cash Sales</span>
                                        <strong className={styles.statHidden}><EyeOff size={12} /> Hidden</strong>
                                    </div>
                                </div>
                                <div className={styles.statBox}>
                                    <div className={styles.statIcon} data-color="purple"><DollarSign size={16} /></div>
                                    <div className={styles.statText}>
                                        <span>Float</span>
                                        <strong>{formatMoney(dashboard?.current_shift?.opening_float || 0)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.metaGrid}>
                                <div className={styles.metaItem}>
                                    <label><Monitor size={11} /> Terminal</label>
                                    <span>{selectedTill.name}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <label><Lock size={11} /> Branch</label>
                                    <span>{branchName}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <label><User size={11} /> Cashier</label>
                                    <span>{currentUserName}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <label><Clock size={11} /> Day Session</label>
                                    <span>#{dashboard?.current_shift?.id || 'N/A'}</span>
                                </div>
                            </div>

                            <div className={styles.blindNotice}>
                                <EyeOff size={14} />
                                <span>Expected cash stays hidden until the cashier submits a blind count.</span>
                            </div>
                        </div>

                        <div className={styles.actionsPanel}>
                            <div className={styles.actionsPanelHeader}>
                                <Activity size={15} />
                                Session Actions
                            </div>
                            <div className={styles.actionList}>
                                <button className={styles.actionItem} onClick={() => navigate('/terminal')}>
                                    <div className={styles.actionIcon} data-color="indigo">
                                        <Monitor size={18} />
                                    </div>
                                    <div className={styles.actionText}>
                                        <strong>Go to POS Terminal</strong>
                                        <span>Process live online orders on this counter.</span>
                                    </div>
                                    <ChevronRight size={15} className={styles.actionArrow} />
                                </button>
                                <button className={styles.actionItem} onClick={() => void handlePrintHourlySales('shift')}>
                                    <div className={styles.actionIcon} data-color="cyan">
                                        <Printer size={18} />
                                    </div>
                                    <div className={styles.actionText}>
                                        <strong>Print Hourly Session Sales</strong>
                                        <span>Hourly sales for this counter during the current counter session.</span>
                                    </div>
                                    <ChevronRight size={15} className={styles.actionArrow} />
                                </button>
                                <button className={styles.actionItem} onClick={() => void handlePrintHourlySales('day')}>
                                    <div className={styles.actionIcon} data-color="purple">
                                        <Printer size={18} />
                                    </div>
                                    <div className={styles.actionText}>
                                        <strong>Print Hourly Day Sales</strong>
                                        <span>Hourly sales for this counter across the current business day.</span>
                                    </div>
                                    <ChevronRight size={15} className={styles.actionArrow} />
                                </button>
                                <button className={styles.actionItem} onClick={handleStartBlindCount}>
                                    <div className={styles.actionIcon} data-color="red">
                                        <LogOut size={18} />
                                    </div>
                                    <div className={styles.actionText}>
                                        <strong>Close Counter</strong>
                                        <span>Submit closing cash with cashier + authorized-user PINs to fully close this counter and hand the cash to branch safe.</span>
                                    </div>
                                    <ChevronRight size={15} className={styles.actionArrow} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stage === 'blind_count' && selectedTill && (
                <div className={`${styles.stageContent} ${styles.centered}`}>
                    <div className={styles.focusCard}>
                        <div className={styles.blindBanner}>
                            <EyeOff size={16} />
                            <span><strong>Blind Count Mode</strong> — count your drawer BEFORE seeing any system total.</span>
                        </div>

                        <div className={styles.focusCardText}>
                            <h2>Physical Cash Count</h2>
                            <p>Count every note and coin in the drawer for <strong>{selectedTill.name}</strong>. Submit with cashier and authorized-user credentials to finalize the counter close and move the cash into branch-safe custody.</p>
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label="Cashier Username *"
                                placeholder="Cashier username"
                                value={closeCashierUsername}
                                onChange={e => setCloseCashierUsername(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label="Cashier PIN *"
                                type="password"
                                placeholder="Cashier PIN"
                                value={closeCashierPin}
                                onChange={e => setCloseCashierPin(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label="Authorized User ID *"
                                placeholder="Authorized user ID"
                                value={closeAuthorizedUsername}
                                onChange={e => setCloseAuthorizedUsername(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label="Authorized User PIN *"
                                type="password"
                                placeholder="Authorized close PIN"
                                value={closeAuthorizedPin}
                                onChange={e => setCloseAuthorizedPin(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputBlock}>
                            <KitchenInput
                                label={`Total Physically Counted (${currencyLabel}) *`}
                                type="number"
                                placeholder="Enter exact drawer total..."
                                value={blindCount}
                                onChange={e => setBlindCount(e.target.value)}
                                icon={<DollarSign size={16} />}
                                autoFocus
                            />
                        </div>

                        <KitchenButton
                            variant="primary"
                            className={styles.primaryBtn}
                            disabled={!blindCount || parseFloat(blindCount) < 0 || !closeCashierUsername.trim() || !closeCashierPin.trim() || !closeAuthorizedUsername.trim() || !closeAuthorizedPin.trim()}
                            isLoading={isSubmitting}
                            onClick={() => void handleSubmitBlindCount()}
                        >
                            <Lock size={16} />
                            Close Counter
                        </KitchenButton>
                    </div>
                </div>
            )}

            {stage === 'reconcile' && selectedTill && (
                <div className={`${styles.stageContent} ${styles.centered}`}>
                    <div className={styles.focusCard}>
                        <div className={styles.blindBanner} style={{ background: 'color-mix(in srgb, var(--badge-success-bg) 25%, transparent)', borderColor: 'var(--badge-success-bg)' }}>
                            <Lock size={16} />
                            <span><strong>Counter Closed</strong> - Cashier and authorized-user approval has finalized this close and posted branch-safe handover.</span>
                        </div>

                        <div className={styles.focusCardText}>
                            <h2>Counter Close Completed</h2>
                            <p>Your closing count of <strong>{formatMoney(Number(blindCount || 0))}</strong> has been recorded. This counter is fully closed and the browser session can now be released.</p>
                        </div>

                        <div className={styles.recTable}>
                            <div className={styles.recRow}>
                                <span>Terminal</span>
                                <strong>{selectedTill.name} — {selectedTill.code}</strong>
                            </div>
                            <div className={styles.recRow}>
                                <span>Your Float</span>
                                <strong>{formatMoney(Number(openingFloat || 0))}</strong>
                            </div>
                            <div className={styles.recRow}>
                                <span>Your Count</span>
                                <strong>{formatMoney(Number(blindCount || 0))}</strong>
                            </div>
                            <div className={styles.recRow}>
                                <span>Expected Cash</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                    {formatMoney(Number(systemTotals?.expected_cash || 0))}
                                </strong>
                            </div>
                            <div className={styles.recRow}>
                                <span>Variance</span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                    {formatMoney(Number(blindCount || 0) - Number(systemTotals?.expected_cash || 0))}
                                </strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            <KitchenButton
                                variant="outline"
                                className={styles.primaryBtn}
                                onClick={handlePrintCashReconciliation}
                            >
                                <Printer size={16} />
                                Print Cash Reconciliation
                            </KitchenButton>
                            <KitchenButton
                                variant="outline"
                                className={styles.primaryBtn}
                                onClick={() => authorizedTillId ? setXReportSessionId(authorizedTillId) : undefined}
                            >
                                <Printer size={16} />
                                Print Session Report
                            </KitchenButton>
                            <KitchenButton
                                variant="primary"
                                className={styles.primaryBtn}
                                isLoading={isSubmitting}
                                onClick={handleFinalize}
                            >
                                <LogOut size={16} />
                                Release Till & Exit
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            <XReportPrintModal
                isOpen={xReportSessionId !== null}
                defaultFormat={(['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(settings.report_paper_size as PrintPaperFormat)
                    ? (settings.report_paper_size as PrintPaperFormat)
                    : 'thermal-80mm'}
                onClose={() => setXReportSessionId(null)}
                onPrint={(format) => {
                    if (xReportSessionId !== null) {
                        void handlePrintCounterXReport(xReportSessionId, format);
                    }
                    setXReportSessionId(null);
                }}
            />
        </div>
    );
}
