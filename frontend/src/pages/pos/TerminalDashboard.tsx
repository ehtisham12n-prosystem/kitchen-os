/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    CreditCard,
    CircleDot,
    Clock,
    HandCoins,
    Landmark,
    Lock,
    Printer,
    RefreshCw,
    ReceiptText,
    RotateCcw,
    ShieldCheck,
    Store,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { accountingApi, authApi, branchApi, posApi, saleCounterApi } from '../../api/api';
import { APP_PERMISSIONS, persistUserContext, readStoredUserContext, resolveTenantSlug } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { useModuleActions } from '../../hooks/useModuleActions';
import { formatCurrency } from '../../utils/currency';
import { toast } from '../../components/ui/KitchenToast/toast';
import { getActiveTillSession, setActiveTillSession as persistActiveTillSession } from './terminalSession';
import { buildCounterSessionXReportPrintDocument, type PrintPaperFormat } from './printTemplates/kotPrintTemplate';
import { openPrintDocumentCopies, resolvePrintTemplateSettings } from './printTemplates/printHelpers';
import { XReportPrintModal } from './XReportPrintModal';
import styles from './TerminalDashboard.module.css';

interface SyncState {
    message: string;
    referenceId: string | null;
}

type SummaryRangePreset =
    | 'today'
    | 'yesterday'
    | '3_days'
    | 'this_week'
    | '10_days'
    | '15_days'
    | 'this_month'
    | '3_months';

const SUMMARY_RANGE_OPTIONS: Array<{ value: SummaryRangePreset; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '3_days', label: '3 Days' },
    { value: 'this_week', label: 'This Week' },
    { value: '10_days', label: '10 Days' },
    { value: '15_days', label: '15 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: '3_months', label: '3 Months' },
];

function extractSupportReference(message: string): SyncState {
    const match = message.match(/\s*Reference ID:\s*([a-f0-9-]+)\.?/i);
    return {
        message: message.replace(/\s*Reference ID:\s*[a-f0-9-]+\./i, '').trim(),
        referenceId: match?.[1] ?? null,
    };
}

function formatShiftWindow(shift: any): string {
    const start = shift?.planned_start ?? shift?.shift_template?.planned_start_time ?? null;
    const end = shift?.planned_end ?? shift?.shift_template?.planned_end_time ?? null;
    const formatPart = (value: string | null) => {
        if (!value) return '';
        const normalized = value.includes('T') ? value : `1970-01-01T${value}`;
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    };
    const startLabel = formatPart(start);
    const endLabel = formatPart(end);
    if (!startLabel || !endLabel) return '';
    return `${startLabel} - ${endLabel}`;
}

function formatBusinessDayDate(value?: string | null): string {
    const raw = String(value || '').trim();
    if (!raw) return 'Business Day N/A';
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return raw;
    }
    return parsed.toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function normalizeTerminalStatus(session: any): string {
    return String(session?.terminal_status || '').trim().toLowerCase();
}

function normalizeWorkflowStatus(session: any): string {
    return String(session?.workflow_status || session?.status || '').trim().toLowerCase();
}

function isActionableSession(session: any): boolean {
    return ['open', 'active', 'blind_submitted'].includes(normalizeTerminalStatus(session));
}

function canDisplayNetSales(session: any): boolean {
    const terminalStatus = normalizeTerminalStatus(session);
    const workflowStatus = normalizeWorkflowStatus(session);
    return !['open', 'active'].includes(terminalStatus)
        && !['assigned', 'open', 'active'].includes(workflowStatus)
        && Boolean(session?.closed_at || session?.verified_closed_at || session?.blind_submitted_at || ['blind_closed', 'blind_submitted', 'verified_closed', 'closed', 'reconciled'].includes(workflowStatus) || ['blind_submitted', 'closed', 'reconciled'].includes(terminalStatus));
}

function getSessionClosedAt(session: any): string | null {
    return session?.closed_at || session?.verified_closed_at || session?.reconciled_at || session?.blind_submitted_at || null;
}

function getSessionStatusLabel(session: any): string {
    const workflowStatus = normalizeWorkflowStatus(session);
    if (workflowStatus) {
        return workflowStatus.replace(/_/g, ' ');
    }
    const terminalStatus = normalizeTerminalStatus(session);
    return terminalStatus ? terminalStatus.replace(/_/g, ' ') : 'open';
}

function isClosedSession(session: any): boolean {
    return ['blind_closed', 'blind_submitted', 'verified_closed', 'closed', 'reconciled'].includes(normalizeWorkflowStatus(session))
        || ['blind_submitted', 'closed', 'reconciled'].includes(normalizeTerminalStatus(session))
        || Boolean(getSessionClosedAt(session));
}

function getSessionHeadline(session: any): string {
    switch (normalizeTerminalStatus(session)) {
        case 'active':
            return 'Sales Counter is Open';
        case 'blind_submitted':
            return 'Legacy Pending Close';
        case 'open':
            return 'Counter Ready to Open';
        default:
            return 'Counter Session';
    }
}

function getSessionSummary(session: any): string {
    switch (normalizeTerminalStatus(session)) {
        case 'active':
            return 'Cashier session is active and the register can process orders.';
        case 'blind_submitted':
            return 'Blind close is complete. Supervisor verification is required before this counter can be used again.';
        case 'open':
            return 'Supervisor has assigned this counter. The cashier must verify opening cash to begin.';
        default:
            return 'Review counter activity.';
    }
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function resolveSummaryRange(preset: SummaryRangePreset, now: Date = new Date()) {
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const dayOfWeek = todayStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = startOfDay(addDays(todayStart, mondayOffset));

    switch (preset) {
        case 'yesterday': {
            const yesterday = addDays(todayStart, -1);
            return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
        }
        case '3_days':
            return { from: startOfDay(addDays(todayStart, -2)), to: todayEnd };
        case 'this_week':
            return { from: weekStart, to: todayEnd };
        case '10_days':
            return { from: startOfDay(addDays(todayStart, -9)), to: todayEnd };
        case '15_days':
            return { from: startOfDay(addDays(todayStart, -14)), to: todayEnd };
        case 'this_month':
            return { from: new Date(todayStart.getFullYear(), todayStart.getMonth(), 1, 0, 0, 0, 0), to: todayEnd };
        case '3_months':
            return { from: new Date(addMonths(todayStart, -2).getFullYear(), addMonths(todayStart, -2).getMonth(), 1, 0, 0, 0, 0), to: todayEnd };
        case 'today':
        default:
            return { from: todayStart, to: todayEnd };
    }
}

function getOrderSummaryDate(order: any): Date | null {
    const source = order?.finalized_at || order?.created_at || null;
    if (!source) return null;
    const parsed = new Date(source);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNormalizedPaymentMode(value?: string | null): string {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isCreditPayment(order: any, payment: any): boolean {
    const paymentMode = getNormalizedPaymentMode(payment?.payment_mode);
    if (paymentMode.includes('credit')) return true;
    return String(order?.payment_status || '').trim().toLowerCase() === 'credited';
}

function normalizeOrderStatus(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
}

function isCancelledOrder(order: any): boolean {
    return ['cancelled', 'voided'].includes(normalizeOrderStatus(order?.order_status));
}

export function TerminalDashboard() {
    const navigate = useNavigate();
    const {
        canOperatePos,
        canManageBranchDay,
        canManageShifts,
        canManageTillSessions,
        canViewPosReports,
        canUseCashierConsole,
        hasPermission,
    } = usePermissionAccess();
    const counterActions = useModuleActions('counter', 'company');
    const { currencyCode } = useCurrencyConfig();
    const [isLoading, setIsLoading] = useState(true);
    const [currentBranch, setCurrentBranch] = useState<any>(null);
    const [currentShift, setCurrentShift] = useState<any | null>(null);
    const [recentSessions, setRecentSessions] = useState<any[]>([]);
    const [myCounterSessions, setMyCounterSessions] = useState<any[]>([]);
    const [branchCounterSessions, setBranchCounterSessions] = useState<any[]>([]);
    const [saleCounters, setSaleCounters] = useState<any[]>([]);
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const [activeTill, setActiveTill] = useState(() => getActiveTillSession());
    const [xReportSessionId, setXReportSessionId] = useState<number | null>(null);
    const [summaryRangePreset, setSummaryRangePreset] = useState<SummaryRangePreset>('today');
    const [summaryOrders, setSummaryOrders] = useState<any[]>([]);
    const [summaryExpenseAccounts, setSummaryExpenseAccounts] = useState<any[]>([]);
    const [summaryExpenseAmount, setSummaryExpenseAmount] = useState(0);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);

    const terminalHistorySessions = useMemo(() => {
        const businessDays = new Set<string>();
        return recentSessions.filter((session) => {
            const businessDayKey = String(session.business_date || session.shift?.business_date || '').trim();
            if (!businessDayKey) {
                return businessDays.size < 3;
            }
            if (businessDays.has(businessDayKey)) {
                return true;
            }
            if (businessDays.size >= 3) {
                return false;
            }
            businessDays.add(businessDayKey);
            return true;
        });
    }, [recentSessions]);
    const canManageCounters = counterActions.manage || canManageTillSessions || hasPermission(APP_PERMISSIONS.ADMIN.SETUP_COUNTERS);
    const canOpenManagerConsole = canManageBranchDay || canManageShifts || canManageTillSessions;
    const canPrintSessionReports = canViewPosReports || canManageTillSessions;
    const canViewAccountingReports = hasPermission(APP_PERMISSIONS.ACCOUNTING.REPORTS);
    const canOpenCashierExpenses = canUseCashierConsole || canManageTillSessions || hasPermission(APP_PERMISSIONS.ACCOUNTING.VOUCHER);
    const cashierConsoleBase = useMemo(() => {
        const tenantSlug = resolveTenantSlug(readStoredUserContext());
        return tenantSlug ? `/console/${tenantSlug}` : '/console/access-required';
    }, []);
    const resolvedCurrencyCode = currentBranch?.effective_currency_code || currentBranch?.currency_code || currencyCode;
    const summaryRange = useMemo(
        () => resolveSummaryRange(summaryRangePreset),
        [summaryRangePreset],
    );
    const formatDashboardMoney = useCallback(
        (value?: number | null, options?: Parameters<typeof formatCurrency>[1]) => (
            formatCurrency(value, { currencyCode: resolvedCurrencyCode, ...options })
        ),
        [resolvedCurrencyCode],
    );
    const printSettings = useMemo(
        () => resolvePrintTemplateSettings({ branch_name: currentBranch?.branch_name || 'Branch' }, currentBranch?.branch_name || 'Branch'),
        [currentBranch?.branch_name],
    );
    const persistBranchContext = useCallback((branch: any) => {
        const branchId = Number(branch?.id || branch?.branch_id || 0);
        if (!branchId) return;
        localStorage.setItem('activeBranchId', String(branchId));
        localStorage.setItem('branch_id', String(branchId));
        if (branch?.branch_name) {
            localStorage.setItem('branch_name', String(branch.branch_name));
        }
    }, []);
    const hydrateTillFromCounterSession = useCallback((session: any | null, branchId: number) => {
        if (!session) return null;
        const tillSession = {
            id: Number(session.id),
            name: String(session.sale_counter?.name || 'Sale Counter'),
            code: String(session.sale_counter?.code || session.sale_counter?.name || `COUNTER_${session.sale_counter_id || session.id}`),
            branch_id: Number(session.branch_id || branchId),
            sale_counter_id: Number(session.sale_counter_id || session.sale_counter?.id || session.id),
        };
        persistActiveTillSession(tillSession);
        return tillSession;
    }, []);
    const handlePrintCounterReport = useCallback(async (sessionId: number, formatOverride?: PrintPaperFormat) => {
        if (!currentBranch?.id) return;
        try {
            const report = await posApi.getCounterSessionXReport(Number(currentBranch.id), sessionId);
            const formatMoneyValue = (value: any) => formatDashboardMoney(Number(value || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            const reportFormat = (['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(printSettings.report_paper_size as PrintPaperFormat)
                ? (printSettings.report_paper_size as PrintPaperFormat)
                : 'thermal-80mm';
            const documentMarkup = buildCounterSessionXReportPrintDocument({
                settings: printSettings,
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
            if (!openPrintDocumentCopies(() => documentMarkup, printSettings.report_print_copies || 1, 'Sales Counter Closing Report')) {
                toast.error('Print Blocked', 'Allow pop-ups for this app to print reports.');
            }
        } catch (error: any) {
            toast.error('Report Failed', error?.message || 'Could not prepare the counter closing report.');
        }
    }, [currentBranch?.id, formatDashboardMoney, printSettings]);
    const openPosForSession = useCallback((session: any) => {
        persistBranchContext(currentBranch);
        const tillSession = hydrateTillFromCounterSession(session, Number(session.branch_id || currentBranch?.branch_id || currentBranch?.id || 0));
        setActiveTill(tillSession);
    }, [currentBranch, hydrateTillFromCounterSession, persistBranchContext]);
    const managerActionCards = useMemo(
        () => branchCounterSessions.filter((session) => isActionableSession(session)),
        [branchCounterSessions],
    );
    const cashierActionCards = useMemo(
        () => myCounterSessions.filter((session) => isActionableSession(session)),
        [myCounterSessions],
    );
    const counterCards = useMemo(
        () => (canManageCounters ? managerActionCards : cashierActionCards),
        [canManageCounters, cashierActionCards, managerActionCards],
    );
    const availableCounterCards = useMemo(() => {
        if (!canManageCounters || !currentShift || String(currentShift.status || '').toLowerCase() !== 'open') {
            return [];
        }
        const occupiedCounterIds = new Set(managerActionCards.map((session) => Number(session.sale_counter_id || session.sale_counter?.id || 0)));
        return saleCounters.filter((counter) => !occupiedCounterIds.has(Number(counter.id)));
    }, [canManageCounters, currentShift, managerActionCards, saleCounters]);

    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        setSyncState(null);

        try {
            const userData = await authApi.me();
            const allowedBranches = userData?.allowed_branches || [];

            persistUserContext(userData);
            setAuthSessionItem('user_type', userData?.user_type || 'client');

            if (allowedBranches.length === 0 && !userData?.is_system) {
                const nextState = {
                    message: 'No operational branch is assigned to this account yet. Ask an administrator to assign a branch before using the terminal workspace.',
                    referenceId: null,
                };
                setCurrentBranch(null);
                setCurrentShift(null);
                setRecentSessions([]);
                setMyCounterSessions([]);
                setBranchCounterSessions([]);
                setSaleCounters([]);
                setSyncState(nextState);
                toast.error('Access Restricted', nextState.message);
                return;
            }

            let resolvedBranchId = Number(localStorage.getItem('activeBranchId'));
            const isAuthorized = userData?.is_system || allowedBranches.some((branch: any) => Number(branch.branch_id) === resolvedBranchId);

            if (!resolvedBranchId || !isAuthorized) {
                const fallback = allowedBranches.find((branch: any) => branch.is_primary) || allowedBranches[0];
                resolvedBranchId = Number(fallback?.branch_id || fallback?.id || 0);

                if (resolvedBranchId > 0) {
                    localStorage.setItem('activeBranchId', String(resolvedBranchId));
                    localStorage.setItem('branch_id', String(resolvedBranchId));
                    if (fallback?.branch_name) {
                        localStorage.setItem('branch_name', String(fallback.branch_name));
                    }
                }
            }

            if (!resolvedBranchId) {
                throw new Error('The terminal workspace could not determine an active branch.');
            }

            const [branchData, historyData, counterSessions, shiftData, authorizedTillSessions, saleCounterRows] = await Promise.all([
                branchApi.getBranch(String(resolvedBranchId)),
                posApi.getCounterSessionHistory(resolvedBranchId),
                posApi.getMyCounterSessions(resolvedBranchId).catch(() => []),
                posApi.getCurrentShift(resolvedBranchId).catch(() => null),
                posApi.getAuthorizedTills(resolvedBranchId).catch(() => []),
                saleCounterApi.getAll(resolvedBranchId).catch(() => []),
            ]);

            setCurrentBranch(branchData || null);
            setCurrentShift(shiftData || null);
            setRecentSessions(
                Array.isArray(historyData)
                    ? [...historyData].sort((a, b) => {
                        const aTime = new Date(a?.opened_at || 0).getTime();
                        const bTime = new Date(b?.opened_at || 0).getTime();
                        return bTime - aTime;
                    })
                    : [],
            );
            const eligibleSessions = Array.isArray(counterSessions) ? counterSessions : [];
            setMyCounterSessions(eligibleSessions);
            setBranchCounterSessions(Array.isArray(authorizedTillSessions) ? authorizedTillSessions : []);
            setSaleCounters(Array.isArray(saleCounterRows) ? saleCounterRows : []);
            const preferredSession = eligibleSessions.find((session) => String(session.workflow_status || session.status || '').toLowerCase() === 'open')
                ?? eligibleSessions.find((session) => String(session.workflow_status || session.status || '').toLowerCase() === 'assigned')
                ?? eligibleSessions.find((session) => String(session.workflow_status || session.status || '').toLowerCase() === 'blind_closed')
                ?? null;
            const recoveredTill = hydrateTillFromCounterSession(preferredSession, resolvedBranchId);
            setActiveTill(recoveredTill || getActiveTillSession());
        } catch (error) {
            const rawMessage = error instanceof Error ? error.message : 'Could not synchronize terminal workspace.';
            console.error('Failed to load dashboard:', error);

            if (/sign in again/i.test(rawMessage)) {
                navigate('/console/auth', { replace: true });
                return;
            }

            const nextState = extractSupportReference(rawMessage);
            setSyncState(nextState);
            toast.error('Terminal Sync', nextState.message);
        } finally {
            setIsLoading(false);
        }
    }, [hydrateTillFromCounterSession, navigate]);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        const branchId = Number(currentBranch?.id || currentBranch?.branch_id || 0);
        if (!branchId) {
            setSummaryOrders([]);
            setSummaryExpenseAccounts([]);
            setSummaryExpenseAmount(0);
            return;
        }

        let isMounted = true;
        const loadSummary = async () => {
            setIsSummaryLoading(true);
            try {
                const requests: Promise<any>[] = [posApi.getOrders(branchId)];
                if (canViewAccountingReports) {
                    requests.push(accountingApi.getPL({
                        branch_id: branchId,
                        date_from: formatDateInput(summaryRange.from),
                        date_to: formatDateInput(summaryRange.to),
                    }));
                }

                const [ordersResult, profitLossResult] = await Promise.allSettled(requests);
                if (!isMounted) return;

                setSummaryOrders(
                    ordersResult.status === 'fulfilled' && Array.isArray(ordersResult.value)
                        ? ordersResult.value
                        : [],
                );

                if (profitLossResult && profitLossResult.status === 'fulfilled') {
                    setSummaryExpenseAccounts(Array.isArray(profitLossResult.value?.accounts) ? profitLossResult.value.accounts : []);
                    setSummaryExpenseAmount(Number(profitLossResult.value?.summary?.total_expenses || 0));
                } else {
                    setSummaryExpenseAccounts([]);
                    setSummaryExpenseAmount(0);
                }
            } finally {
                if (isMounted) {
                    setIsSummaryLoading(false);
                }
            }
        };

        void loadSummary();
        return () => {
            isMounted = false;
        };
    }, [canViewAccountingReports, currentBranch?.branch_id, currentBranch?.id, summaryRange.from, summaryRange.to]);

    const summaryCards = useMemo(() => {
        const rangeStart = summaryRange.from.getTime();
        const rangeEnd = summaryRange.to.getTime();
        const rangeOrders = summaryOrders.filter((order) => {
            if (isCancelledOrder(order)) return false;
            const orderDate = getOrderSummaryDate(order);
            if (!orderDate) return false;
            const timestamp = orderDate.getTime();
            return timestamp >= rangeStart && timestamp <= rangeEnd;
        });
        const completedOrders = rangeOrders.filter((order) => normalizeOrderStatus(order?.order_status) === 'completed');
        const pendingUnpaidOrders = rangeOrders.filter((order) => {
            const orderStatus = normalizeOrderStatus(order?.order_status);
            const paymentStatus = String(order?.payment_status || '').trim().toLowerCase();
            return ['pending', 'held', 'in_progress', 'open'].includes(orderStatus)
                || ['unpaid', 'partial', 'partially_paid'].includes(paymentStatus);
        });
        const orderIdSets = {
            cash: new Set<number>(),
            card: new Set<number>(),
            eft: new Set<number>(),
            credit: new Set<number>(),
            cashMeetings: new Set<number>(),
            salesReturn: new Set<number>(),
        };
        const amounts = {
            cash: 0,
            card: 0,
            eft: 0,
            credit: 0,
            cashMeetings: 0,
            grossSale: 0,
            salesReturn: 0,
            pendingUnpaid: 0,
        };

        for (const order of completedOrders) {
            amounts.grossSale += Number(order?.total_amount || 0);
            const orderId = Number(order?.id || 0);
            const payments = (Array.isArray(order?.payments) ? order.payments : [])
                .filter((payment: any) => !payment?.is_refund);

            if (String(order?.payment_status || '').trim().toLowerCase() === 'credited' && payments.length === 0) {
                orderIdSets.credit.add(orderId);
                amounts.credit += Number(order?.total_amount || 0);
            }

            if (String(order?.payment_status || '').trim().toLowerCase() === 'partially_refunded' || String(order?.payment_status || '').trim().toLowerCase() === 'refunded') {
                orderIdSets.salesReturn.add(orderId);
                amounts.salesReturn += Number(order?.refunded_amount || order?.latest_return?.refund_amount || 0);
            }

            for (const payment of payments) {
                const paymentMode = getNormalizedPaymentMode(payment?.payment_mode);
                const paymentAmount = Number(payment?.amount || 0);

                if (paymentMode.includes('cash')) {
                    orderIdSets.cash.add(orderId);
                    amounts.cash += paymentAmount;
                    if (normalizeOrderStatus(order?.order_status) === 'completed' && String(order?.order_type || '').trim().toLowerCase() === 'dine_in') {
                        orderIdSets.cashMeetings.add(orderId);
                        amounts.cashMeetings += paymentAmount;
                    }
                    continue;
                }

                if (paymentMode.includes('card')) {
                    orderIdSets.card.add(orderId);
                    amounts.card += paymentAmount;
                    continue;
                }

                if (paymentMode.includes('bank') || paymentMode.includes('eft')) {
                    orderIdSets.eft.add(orderId);
                    amounts.eft += paymentAmount;
                    continue;
                }

                if (isCreditPayment(order, payment)) {
                    orderIdSets.credit.add(orderId);
                    amounts.credit += paymentAmount;
                }
            }
        }

        for (const order of pendingUnpaidOrders) {
            amounts.pendingUnpaid += Number(order?.total_amount || 0);
        }

        const expenseCount = summaryExpenseAccounts.filter((account) => account?.account_type === 'expense' && Math.abs(Number(account?.net_balance || 0)) > 0.009).length;

        return [
            { key: 'cash', label: 'Cash Orders', count: orderIdSets.cash.size, amount: amounts.cash, icon: Wallet, toneClass: styles.summaryCashCard },
            { key: 'card', label: 'Card', count: orderIdSets.card.size, amount: amounts.card, icon: CreditCard, toneClass: styles.summaryCardCard },
            { key: 'eft', label: 'EFT', count: orderIdSets.eft.size, amount: amounts.eft, icon: Landmark, toneClass: styles.summaryEftCard },
            { key: 'credit', label: 'Credit', count: orderIdSets.credit.size, amount: amounts.credit, icon: HandCoins, toneClass: styles.summaryCreditCard },
            { key: 'cashMeetings', label: 'Cash Meetings', count: orderIdSets.cashMeetings.size, amount: amounts.cashMeetings, icon: Store, toneClass: styles.summaryMeetingCard },
            { key: 'salesReturn', label: 'Sales Return', count: orderIdSets.salesReturn.size, amount: amounts.salesReturn, icon: RotateCcw, toneClass: styles.summaryReturnCard },
            { key: 'grossSale', label: 'Gross Sale', count: completedOrders.length, amount: amounts.grossSale, icon: TrendingUp, toneClass: styles.summaryGrossCard },
            { key: 'pendingUnpaid', label: 'Pending/Unpaid Order', count: pendingUnpaidOrders.length, amount: amounts.pendingUnpaid, icon: Clock, toneClass: styles.summaryPendingUnpaidCard },
            { key: 'expense', label: 'Expense', count: expenseCount, amount: summaryExpenseAmount, icon: ReceiptText, toneClass: styles.summaryExpenseCard },
        ];
    }, [summaryExpenseAccounts, summaryExpenseAmount, summaryOrders, summaryRange.from, summaryRange.to]);

    const formatDateTime = (date: string | null) => {
        if (!date) return 'Not recorded';
        return new Date(date).toLocaleString('en-PK', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <section className={styles.loadingShell}>
                    <div className="kitchen-spinner"></div>
                    <div>
                        <h2>Synchronizing terminal workspace</h2>
                        <p>Verifying branch access, counter assignment, and recent day activity.</p>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <span className={styles.eyebrow}>Terminal Workspace</span>
                    <h1>Front-of-house control with live branch context.</h1>
                    <p>
                        {currentBranch?.branch_name || 'Branch operations'}
                        {' | '}
                        {new Date().toLocaleDateString('en-PK', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>

                <div className={styles.heroMetrics}>
                    <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Active Branch</span>
                        <strong>{currentBranch?.branch_name || 'Awaiting sync'}</strong>
                        <span>{currentBranch?.branch_code || 'Branch context will appear after sync.'}</span>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Counter Status</span>
                        <strong>{counterCards.length > 0 ? `${counterCards.length} actionable counter${counterCards.length > 1 ? 's' : ''}` : 'No actionable counter'}</strong>
                        <span>{activeTill ? activeTill.code : 'Only open, legacy-pending-close, or ready-to-open counters appear here.'}</span>
                    </div>
                    <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Business Day Status</span>
                        <strong>{currentShift ? String(currentShift.status || 'open').replace(/_/g, ' ') : 'No active business day'}</strong>
                        <span>{currentShift ? `${counterCards.length} actionable counter card${counterCards.length === 1 ? '' : 's'} on screen` : 'Counter activity will appear here once the business day is opened.'}</span>
                    </div>
                    {canOpenCashierExpenses ? (
                        <Link to={`${cashierConsoleBase}/cashier/expenses`} className={`${styles.metricCard} ${styles.expenseHeroCard}`}>
                            <span className={styles.metricLabel}>Expense</span>
                            <strong>Record Cashier Expense</strong>
                            <span>Open the cashier expense screen directly from terminal control.</span>
                        </Link>
                    ) : null}
                </div>
            </section>

            {syncState ? (
                <section className={styles.alertPanel}>
                    <div className={styles.alertIcon}>
                        <AlertTriangle size={22} />
                    </div>
                    <div className={styles.alertCopy}>
                        <strong>Session recovery required</strong>
                        <p>{syncState.message}</p>
                        {syncState.referenceId ? (
                            <span className={styles.referenceChip}>Support reference: {syncState.referenceId}</span>
                        ) : null}
                    </div>
                    <div className={styles.alertActions}>
                        <button type="button" className={styles.secondaryButton} onClick={() => void loadDashboard()}>
                            <RefreshCw size={16} />
                            Retry Sync
                        </button>
                        {canManageCounters ? (
                            <Link to="/terminal/center?tab=registry" className={styles.secondaryButton}>
                                Manage Counters
                            </Link>
                        ) : null}
                    </div>
                </section>
            ) : null}

            <section className={styles.actionGrid}>
                {counterCards.length > 0 ? (
                    counterCards.map((session) => {
                        const counterName = String(session.sale_counter?.name || session.counter_name || 'Sale Counter');
                        const counterCode = String(session.sale_counter?.code || session.counter_code || session.sale_counter?.name || `COUNTER_${session.sale_counter_id || session.id}`);
                        const terminalStatus = normalizeTerminalStatus(session);
                        const businessDayLabel = formatBusinessDayDate(session.shift?.business_date || session.business_date || currentShift?.business_date || null);
                        const cardStateClass = terminalStatus === 'active'
                            ? styles.openCard
                            : terminalStatus === 'blind_submitted'
                                ? styles.pendingCard
                                : styles.readyCard;
                        const iconStateClass = terminalStatus === 'active'
                            ? styles.actionIconOpen
                            : terminalStatus === 'blind_submitted'
                                ? styles.actionIconPending
                                : styles.actionIconReady;
                        const badgeStateClass = terminalStatus === 'active'
                            ? styles.inlineMetaOpen
                            : terminalStatus === 'blind_submitted'
                                ? styles.inlineMetaPending
                                : styles.inlineMetaReady;
                        const arrowStateClass = terminalStatus === 'active'
                            ? styles.actionArrowOpen
                            : terminalStatus === 'blind_submitted'
                                ? styles.actionArrowPending
                                : styles.actionArrowReady;
                        const shiftName = String(session.shift?.shift_name || session.shift_name || 'Assigned day session');
                        const shiftWindow = formatShiftWindow(session.shift || session);
                        const cardBody = (
                            <>
                                <div className={`${styles.actionIcon} ${iconStateClass}`}>
                                    {terminalStatus === 'blind_submitted' ? <AlertTriangle size={28} /> : <Store size={28} />}
                                </div>
                                <div className={styles.actionContent}>
                                    <div className={styles.cardHeaderRow}>
                                        <span className={styles.counterHighlight}>{counterCode}</span>
                                        <div className={styles.cardHeaderSpacer}></div>
                                        <span className={styles.businessDayBadge}>Business Day: {businessDayLabel}</span>
                                    </div>
                                    <span className={styles.actionTitle}>{getSessionHeadline(session)}</span>
                                    <p>{getSessionSummary(session)} <strong>{counterName}</strong> for <strong>{shiftName}</strong>{shiftWindow ? ` (${shiftWindow})` : ''}.</p>
                                    <div className={styles.posMetaGrid}>
                                        <span className={`${styles.inlineMeta} ${badgeStateClass}`}>
                                            <CircleDot size={14} />
                                            {terminalStatus === 'blind_submitted'
                                                ? 'Legacy Pending Close'
                                                : terminalStatus === 'active'
                                                    ? 'Sales Counter is Open'
                                                    : 'Ready to Open'}
                                        </span>
                                        <div className={styles.posMetaSpacer}></div>
                                        <span className={styles.counterMeta}>
                                            Opening cash {formatDashboardMoney(session.opening_verified_cash ?? session.assigned_float ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight size={18} className={`${styles.actionArrow} ${arrowStateClass}`} />
                            </>
                        );

                        if (['open', 'active'].includes(terminalStatus) && canOperatePos) {
                            return (
                                <Link
                                    key={session.id}
                                    to="/terminal/pos"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${styles.actionCard} ${styles.primaryCard} ${styles.posCard} ${cardStateClass}`}
                                    onClick={() => openPosForSession(session)}
                                >
                                    {cardBody}
                                </Link>
                            );
                        }

                        return (
                            <div
                                key={session.id}
                                className={`${styles.actionCard} ${styles.primaryCard} ${styles.posCard} ${cardStateClass}`}
                            >
                                {cardBody}
                            </div>
                        );
                    })
                ) : canOperatePos ? (
                    <div className={`${styles.actionCard} ${styles.lockedCard}`}>
                        <div className={styles.actionIcon}>
                            <Lock size={28} />
                        </div>
                        <div className={styles.actionContent}>
                            <span className={styles.actionTitle}>Register Locked</span>
                            <p>No active counter is assigned to this browser. Open a branch day counter or recover an existing till before taking orders.</p>
                            <span className={styles.inlineMeta}>
                                <ShieldCheck size={14} />
                                Counter assignment required
                            </span>
                        </div>
                    </div>
                ) : canOpenManagerConsole ? (
                    <Link to="/terminal/day" className={`${styles.actionCard} ${styles.primaryCard}`}>
                        <div className={styles.actionIcon}>
                            <ShieldCheck size={28} />
                        </div>
                        <div className={styles.actionContent}>
                            <span className={styles.actionTitle}>Open Manager Console</span>
                            <p>Open the branch day console to manage counters, assignments, and close verification for this branch.</p>
                            <span className={styles.inlineMeta}>
                                <CircleDot size={14} />
                                Operations control
                            </span>
                        </div>
                        <ArrowRight size={18} className={styles.actionArrow} />
                    </Link>
                ) : (
                    <div className={`${styles.actionCard} ${styles.lockedCard}`}>
                        <div className={styles.actionIcon}>
                            <Lock size={28} />
                        </div>
                        <div className={styles.actionContent}>
                            <span className={styles.actionTitle}>Terminal Access Limited</span>
                            <p>Your current branch role can review terminal status, but it does not include register or manager operations.</p>
                        </div>
                    </div>
                )}
                {canOpenManagerConsole ? availableCounterCards.map((counter) => (
                    <Link key={`available-${counter.id}`} to="/terminal/day" className={`${styles.actionCard} ${styles.primaryCard}`}>
                        <div className={styles.actionIcon}>
                            <Store size={28} />
                        </div>
                        <div className={styles.actionContent}>
                            <span className={styles.counterHighlight}>{String(counter.code || counter.name || `COUNTER_${counter.id}`)}</span>
                            <span className={styles.actionTitle}>Counter Available to Open</span>
                            <p><strong>{String(counter.name || 'Sales Counter')}</strong> is not active. An authorized branch user can create a new session by assigning a cashier and entering a new opening cash amount.</p>
                            <span className={styles.inlineMeta}>
                                <CircleDot size={14} />
                                Available for new session
                            </span>
                        </div>
                        <ArrowRight size={18} className={styles.actionArrow} />
                    </Link>
                )) : null}
            </section>

            <section className={styles.summarySection}>
                <div className={styles.summaryHeader}>
                    <div>
                        <h3>Summary Strip</h3>
                        <p>Order count and amount by payment bucket for the selected period.</p>
                    </div>
                    <label className={styles.summaryRangeControl}>
                        <span>Period</span>
                        <select value={summaryRangePreset} onChange={(event) => setSummaryRangePreset(event.target.value as SummaryRangePreset)}>
                            {SUMMARY_RANGE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.summaryStrip}>
                    {summaryCards.map((card) => (
                        <div key={card.key} className={`${styles.summaryCard} ${card.toneClass}`}>
                            <div className={styles.summaryCardHeader}>
                                <div className={styles.summaryCardIcon}>
                                    <card.icon size={16} />
                                </div>
                                <span>{card.label}</span>
                            </div>
                            <div className={styles.summaryCardValues}>
                                <strong>{card.count}</strong>
                                <small className={styles.summaryCardMeta}>
                                    {card.amount === null
                                        ? 'Count only'
                                        : isSummaryLoading
                                            ? 'Loading amount...'
                                            : formatDashboardMoney(card.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </small>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.historySection}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h3>Terminal Session History</h3>
                        <p>Recent openings, closings, and counter performance snapshots for the selected branch.</p>
                    </div>
                    <button type="button" className={styles.secondaryButton} onClick={() => void loadDashboard()}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.historyTable}>
                        <thead>
                            <tr>
                                <th>Counter / Terminal</th>
                                <th>Business Day</th>
                                <th>Open Time</th>
                                <th>Close Time</th>
                                <th>Opening Cash</th>
                                <th>Closing Cash</th>
                                <th>Orders</th>
                                <th>Net Sales</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!terminalHistorySessions || terminalHistorySessions.length === 0 ? (
                                <tr>
                                    <td colSpan={10}>
                                        <div className={styles.emptyState}>
                                            <Clock size={48} strokeWidth={1.5} />
                                            <span>No terminal history found</span>
                                            <p>Session history will appear here after the first counter open or close event for this branch.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                terminalHistorySessions.map((session) => (
                                    <tr key={session.id}>
                                        <td className={styles.emphasisCell}>{session.counter_name || 'Terminal'}</td>
                                        <td className={styles.businessDayCell}>{formatBusinessDayDate(session.business_date || session.shift?.business_date || null)}</td>
                                        <td>{formatDateTime(session.opened_at)}</td>
                                        <td>{formatDateTime(getSessionClosedAt(session))}</td>
                                        <td>{formatDashboardMoney(session.opening_float || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                        <td>{session.actual_cash !== null ? formatDashboardMoney(session.actual_cash, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'Legacy pending close'}</td>
                                        <td>{session.total_orders || 0}</td>
                                        <td className={styles.salesCell}>
                                            {canDisplayNetSales(session)
                                                ? formatDashboardMoney(session.net_sales || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                                : 'Hidden until close'}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${isClosedSession(session) ? styles.statusClosed : styles.statusOpen}`}>
                                                {getSessionStatusLabel(session)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {getSessionClosedAt(session) && canPrintSessionReports ? (
                                                <button type="button" className={styles.secondaryButton} onClick={() => setXReportSessionId(session.id)}>
                                                    <Printer size={14} />
                                                    Print X-Report
                                                </button>
                                            ) : (
                                                <div className={styles.progressBadge}>
                                                    <span>
                                                        {normalizeWorkflowStatus(session) === 'blind_closed'
                                                            ? 'Legacy Pending Close'
                                                            : normalizeWorkflowStatus(session) === 'assigned'
                                                                ? 'Assigned'
                                                                : 'In Progress'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <XReportPrintModal
                isOpen={canPrintSessionReports && xReportSessionId !== null}
                defaultFormat={(['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(printSettings.report_paper_size as PrintPaperFormat)
                    ? (printSettings.report_paper_size as PrintPaperFormat)
                    : 'thermal-80mm'}
                onClose={() => setXReportSessionId(null)}
                onPrint={(format) => {
                    if (xReportSessionId !== null) {
                        void handlePrintCounterReport(xReportSessionId, format);
                    }
                    setXReportSessionId(null);
                }}
            />

        </div>
    );
}
