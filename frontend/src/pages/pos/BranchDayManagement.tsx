import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, Clock3, Loader2, Monitor, Pencil, Play, Plus, Printer, RefreshCcw, Settings2, ShieldCheck, Square, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { accountingApi, posApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatCurrency } from '../../utils/currency';
import TerminalCenter from '../setup/TerminalCenter';
import { buildCounterSessionXReportPrintDocument, buildDayClosingReportPrintDocument, type PrintPaperFormat } from './printTemplates/kotPrintTemplate';
import { openPrintDocumentCopies, resolvePrintTemplateSettings } from './printTemplates/printHelpers';
import { XReportPrintModal } from './XReportPrintModal';
import styles from './BranchDayManagement.module.css';

// Consolidated operations snapshot returned by the day-management API.
type Snapshot = { branch_context?: { branch_id?: number; branch_name?: string; currency_code?: string | null; effective_currency_code?: string | null } | null; active_business_day: any | null; recent_business_days: any[]; recent_shift_sessions: any[]; shift_templates: any[]; shifts: any[]; counter_sessions: any[]; recent_counter_sessions: any[]; cashiers: any[]; sale_counters: any[]; summary: { active_shift_count: number; assigned_counter_count: number; open_counter_count: number; blind_close_pending_count: number } };
type TemplateFormState = { name: string; code: string; planned_start_time: string; planned_end_time: string; sort_order: string; allow_overlap: boolean; is_active: boolean };
type ShiftEditorState = { shift_name: string; planned_start: string; planned_end: string };
type ConsoleTab = 'operations' | 'shifts' | 'terminal-center';
// Disabled by default. This pane exists only to support controlled legacy operations during migration.
const LEGACY_SHIFT_COMPATIBILITY_VISIBLE = false;

const stamp = (value?: string | null) => (
    value
        ? new Date(value).toLocaleString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
        : 'Not set'
);
const shortStamp = (value?: string | null) => {
    if (!value) return '--';
    return new Date(value).toLocaleString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};
const compactStamp = (value?: string | null) => {
    if (!value) return '--';
    return new Date(value).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};
const displayDate = (value?: string | null) => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};
const HISTORY_PAGE_SIZE = 5;

function paginateRows<T>(rows: T[], page: number, pageSize = HISTORY_PAGE_SIZE) {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        page: safePage,
        totalPages,
        rows: rows.slice(start, start + pageSize),
        totalItems: rows.length,
    };
}

const toLocalInput = (date: Date) => { const next = new Date(date); next.setMinutes(next.getMinutes() - next.getTimezoneOffset()); return next.toISOString().slice(0, 16); };
const formatShiftTime = (value?: string | null) => {
    if (!value) return '--:--';
    const [hoursRaw, minutesRaw] = String(value).split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw ?? '0');
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    const normalizedHours = ((hours % 24) + 24) % 24;
    const period = normalizedHours >= 12 ? 'PM' : 'AM';
    const displayHours = normalizedHours % 12 || 12;
    return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${period}`;
};
const SHIFT_TONES = ['toneA', 'toneB', 'toneC', 'toneD', 'toneE', 'toneF'] as const;
const buildTemplateForm = (template?: any): TemplateFormState => ({ name: template?.name ?? '', code: template?.code ?? '', planned_start_time: template?.planned_start_time ?? '09:00:00', planned_end_time: template?.planned_end_time ?? '17:00:00', sort_order: String(template?.sort_order ?? 1), allow_overlap: template?.allow_overlap ?? true, is_active: template?.is_active ?? true });
const buildShiftEditor = (shift: any): ShiftEditorState => ({ shift_name: shift?.shift_name ?? '', planned_start: shift?.planned_start ? toLocalInput(new Date(shift.planned_start)) : '', planned_end: shift?.planned_end ? toLocalInput(new Date(shift.planned_end)) : '' });

function buildDayForm() {
    const opened = new Date();
    const planned = new Date(opened);
    planned.setHours(3, 0, 0, 0);
    if (planned <= opened) planned.setDate(planned.getDate() + 1);
    return { title: `Business Day ${opened.toLocaleDateString('en-CA')}`, business_date: opened.toLocaleDateString('en-CA'), opened_at: toLocalInput(opened), planned_closing_at: toLocalInput(planned), off_day_reason: '', notes: '' };
}

export function BranchDayManagement() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const { currencyCode } = useCurrencyConfig();
    const { canManageBranchDay, canManageShifts, canManageTillSessions, canOperatePos, canViewPosReports } = usePermissionAccess();
    const branchId = activeBranch?.branch_id ? Number(activeBranch.branch_id) : null;
    const openCashierCounter = useCallback(() => {
        if (!branchId) return;
        localStorage.setItem('activeBranchId', String(branchId));
        localStorage.setItem('branch_id', String(branchId));
        if (activeBranch?.branch_name) {
            localStorage.setItem('branch_name', String(activeBranch.branch_name));
        }
        window.open('/terminal/pos', '_blank', 'noopener,noreferrer');
    }, [activeBranch?.branch_name, branchId]);
    const branchName = activeBranch?.branch_name || 'Active Branch';
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [dayForm, setDayForm] = useState(buildDayForm);
    const [saveAsOffDay, setSaveAsOffDay] = useState(false);
    const [templateForm, setTemplateForm] = useState<TemplateFormState>(() => buildTemplateForm());
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [shiftEditor, setShiftEditor] = useState<ShiftEditorState | null>(null);
    const [shiftDrafts, setShiftDrafts] = useState<Record<number, { sale_counter_id: number; user_id: number; assigned_float: string }>>({});
    const [dayDraft, setDayDraft] = useState<{ sale_counter_id: number; user_id: number; assigned_float: string }>({ sale_counter_id: 0, user_id: 0, assigned_float: '0' });
    const [sessionDrafts, setSessionDrafts] = useState<Record<number, { sale_counter_id: number; user_id: number; assigned_float: string }>>({});
    const [pins, setPins] = useState<Record<number, string>>({});
    const [authorizedUsernames, setAuthorizedUsernames] = useState<Record<number, string>>({});
    const [closeComments, setCloseComments] = useState<Record<number, string>>({});
    const [activeTab, setActiveTab] = useState<ConsoleTab>('operations');
    const [businessDayPage, setBusinessDayPage] = useState(1);
    const [accountingCloseHistory, setAccountingCloseHistory] = useState<any[]>([]);
    const [accountingCloseHistoryPage, setAccountingCloseHistoryPage] = useState(1);
    const [counterHistoryPage, setCounterHistoryPage] = useState(1);
    const [xReportSessionId, setXReportSessionId] = useState<number | null>(null);
    const [zReportDay, setZReportDay] = useState<any | null>(null);
    const [dayClosePreview, setDayClosePreview] = useState<any | null>(null);
    const [dayClosePreviewLoading, setDayClosePreviewLoading] = useState(false);
    const resolvedCurrencyCode = String(
        snapshot?.branch_context?.effective_currency_code
        || snapshot?.branch_context?.currency_code
        || activeBranch?.effective_currency_code
        || activeBranch?.currency_code
        || currencyCode,
    ).trim().toUpperCase();
    const formatBranchMoney = (value?: number | null, options?: Parameters<typeof formatCurrency>[1]) => (
        formatCurrency(value, { currencyCode: resolvedCurrencyCode, ...options })
    );
    const canPrintOperationalReports = canViewPosReports || canManageBranchDay || canManageTillSessions;
    const settings = resolvePrintTemplateSettings(
        { branch_name: snapshot?.branch_context?.branch_name || branchName },
        snapshot?.branch_context?.branch_name || branchName,
    );
    const buildPrintableDayClosingReport = (dayReport: any) => ({
        ...dayReport,
        gross: formatBranchMoney(Number(dayReport.gross || 0)),
        discounts: formatBranchMoney(Number(dayReport.discounts || 0)),
        returns: formatBranchMoney(Number(dayReport.returns || 0)),
        net: formatBranchMoney(Number(dayReport.net || 0)),
        payments: {
            cash: formatBranchMoney(Number(dayReport.payments?.cash || 0)),
            card: formatBranchMoney(Number(dayReport.payments?.card || 0)),
            online: formatBranchMoney(Number(dayReport.payments?.online || 0)),
        },
        sections: {
            cash_summary: {
                opening_cash: formatBranchMoney(Number(dayReport.sections?.cash_summary?.opening_cash || 0)),
                net_cash_sale: formatBranchMoney(Number(dayReport.sections?.cash_summary?.net_cash_sale || 0)),
                cash_sale: formatBranchMoney(Number(dayReport.sections?.cash_summary?.cash_sale || 0)),
                cash_expense: formatBranchMoney(Number(dayReport.sections?.cash_summary?.cash_expense || 0)),
                cash_refund: formatBranchMoney(Number(dayReport.sections?.cash_summary?.cash_refund || 0)),
                total_cash_in_hand: formatBranchMoney(Number(dayReport.sections?.cash_summary?.total_cash_in_hand || 0)),
            },
            cash_actual_vs_expected: {
                expected_cash: formatBranchMoney(Number(dayReport.sections?.cash_actual_vs_expected?.expected_cash || 0)),
                actual_cash: formatBranchMoney(Number(dayReport.sections?.cash_actual_vs_expected?.actual_cash || 0)),
                variance: formatBranchMoney(Number(dayReport.sections?.cash_actual_vs_expected?.variance || 0)),
            },
            pos_summary: {
                ...dayReport.sections?.pos_summary,
                cash_sale: formatBranchMoney(Number(dayReport.sections?.pos_summary?.cash_sale || 0)),
                online_payment_sale: formatBranchMoney(Number(dayReport.sections?.pos_summary?.online_payment_sale || 0)),
                credit_card_sale: formatBranchMoney(Number(dayReport.sections?.pos_summary?.credit_card_sale || 0)),
                wallet_sale: formatBranchMoney(Number(dayReport.sections?.pos_summary?.wallet_sale || 0)),
                total_sale: formatBranchMoney(Number(dayReport.sections?.pos_summary?.total_sale || 0)),
                returned_amount: formatBranchMoney(Number(dayReport.sections?.pos_summary?.returned_amount || 0)),
                discount_amount: formatBranchMoney(Number(dayReport.sections?.pos_summary?.discount_amount || 0)),
                voided_amount: formatBranchMoney(Number(dayReport.sections?.pos_summary?.voided_amount || 0)),
            },
            wallet_summary: {
                wallet_used_today: formatBranchMoney(Number(dayReport.sections?.wallet_summary?.wallet_used_today || 0)),
                added_in_wallet_today: formatBranchMoney(Number(dayReport.sections?.wallet_summary?.added_in_wallet_today || 0)),
                current_closing_balance: formatBranchMoney(Number(dayReport.sections?.wallet_summary?.current_closing_balance || 0)),
            },
            credit_summary: {
                total_credited_sale_today: formatBranchMoney(Number(dayReport.sections?.credit_summary?.total_credited_sale_today || 0)),
                previously_pending_credit: formatBranchMoney(Number(dayReport.sections?.credit_summary?.previously_pending_credit || 0)),
                credited_amount_received: formatBranchMoney(Number(dayReport.sections?.credit_summary?.credited_amount_received || 0)),
                net_credit_balance: formatBranchMoney(Number(dayReport.sections?.credit_summary?.net_credit_balance || 0)),
                credited_orders_count: Number(dayReport.sections?.credit_summary?.credited_orders_count || 0),
            },
            expense_summary: {
                expense_from_cash_counter: formatBranchMoney(Number(dayReport.sections?.expense_summary?.expense_from_cash_counter || 0)),
                sales_expense_ratio: Number(dayReport.sections?.expense_summary?.sales_expense_ratio || 0),
                total_expense: formatBranchMoney(Number(dayReport.sections?.expense_summary?.total_expense || 0)),
            },
            order_type_summary: (dayReport.sections?.order_type_summary || []).map((row: any) => ({
                ...row,
                amount: formatBranchMoney(Number(row.amount || 0)),
            })),
            sold_items_summary: (dayReport.sections?.sold_items_summary || []).map((row: any) => ({
                ...row,
                gross_sale: formatBranchMoney(Number(row.gross_sale || 0)),
                returned_amount: formatBranchMoney(Number(row.returned_amount || 0)),
                net_sale: formatBranchMoney(Number(row.net_sale || 0)),
            })),
            station_wise_sale: (dayReport.sections?.station_wise_sale || []).map((row: any) => ({
                ...row,
                sales_amount: formatBranchMoney(Number(row.sales_amount || 0)),
            })),
        },
        expenses: formatBranchMoney(Number(dayReport.expenses || 0)),
        variance: formatBranchMoney(Number(dayReport.variance || 0)),
        counters: (dayReport.counters || []).map((counter: any) => ({
            ...counter,
            opening_cash: formatBranchMoney(Number(counter.opening_cash || 0)),
            net_sales: formatBranchMoney(Number(counter.net_sales || 0)),
            expected_cash: formatBranchMoney(Number(counter.expected_cash || 0)),
            actual_cash: formatBranchMoney(Number(counter.actual_cash || 0)),
            variance: formatBranchMoney(Number(counter.variance || 0)),
        })),
    });
    const printBusinessDayZReport = async (day: any, busyKey: string, formatOverride?: PrintPaperFormat) => {
        if (!branchId || !day?.id) return;
        await run(busyKey, async () => {
            const dayReport = await posApi.getBusinessDayZReport(branchId, day.id);
            const documentMarkup = buildDayClosingReportPrintDocument({
                settings,
                format: formatOverride || 'thermal-80mm',
                data: buildPrintableDayClosingReport(dayReport) as any,
            });
            if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, `Business Day Z Report ${day.business_date || day.id}`)) {
                toast.error('Print Blocked', 'Allow pop-ups for this app to print the business day Z-report.');
            }
        });
    };

    const printCounterXReport = async (sessionId: number, title?: string, formatOverride?: PrintPaperFormat) => {
        if (!branchId) return;
        const reportFormat = (['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(settings.report_paper_size as PrintPaperFormat)
            ? (settings.report_paper_size as PrintPaperFormat)
            : 'thermal-80mm';
        const report = await posApi.getCounterSessionXReport(branchId, sessionId);
        const formatMoneyValue = (value: any) => formatBranchMoney(Number(value || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
                    order_type_summary: (report?.sections?.order_type_summary || []).map((row: any) => ({
                        ...row,
                        amount: formatMoneyValue(row.amount),
                    })),
                    sold_items_summary: (report?.sections?.sold_items_summary || []).map((row: any) => ({
                        ...row,
                        gross_sale: formatMoneyValue(row.gross_sale),
                        returned_amount: formatMoneyValue(row.returned_amount),
                        net_sale: formatMoneyValue(row.net_sale),
                    })),
                    station_wise_sale: (report?.sections?.station_wise_sale || []).map((row: any) => ({
                        ...row,
                        sales_amount: formatMoneyValue(row.sales_amount),
                    })),
                    events_summary: {
                        ...report?.sections?.events_summary,
                        payment_received_against_events: formatMoneyValue(report?.sections?.events_summary?.payment_received_against_events),
                        receivable_amount_of_event: formatMoneyValue(report?.sections?.events_summary?.receivable_amount_of_event),
                    },
                },
            },
        });
        if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, title || 'Sales Counter Closing Report')) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print the sales counter closing report.');
        }
    };

    const load = async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const [operationsSnapshot, closeHistory] = await Promise.all([
                posApi.getOperationsConsole(branchId),
                accountingApi.getDayClosingHistory(branchId),
            ]);
            setSnapshot(operationsSnapshot);
            setAccountingCloseHistory(closeHistory);
            const activeBusinessDate = operationsSnapshot?.active_business_day?.business_date;
            if (activeBusinessDate) {
                await loadDayClosePreview(activeBusinessDate);
            } else {
                setDayClosePreview(null);
            }
        }
        catch (error: any) { toast.error('Operations Sync Failed', error?.message || 'Could not load branch operations.'); }
        finally { setLoading(false); }
    };

    const loadDayClosePreview = async (businessDate?: string | null) => {
        if (!branchId || !businessDate) {
            setDayClosePreview(null);
            return null;
        }
        setDayClosePreviewLoading(true);
        try {
            const preview = await accountingApi.getDayClosingPreview({
                branch_id: branchId,
                business_date: businessDate,
            });
            setDayClosePreview(preview);
            return preview;
        } catch (error: any) {
            setDayClosePreview(null);
            toast.error('Day Close Preview Failed', error?.message || 'Could not load accounting close readiness.');
            return null;
        } finally {
            setDayClosePreviewLoading(false);
        }
    };

    useEffect(() => { void load(); }, [branchId]);
    useEffect(() => {
        setBusinessDayPage((page) => Math.min(page, Math.max(1, Math.ceil((snapshot?.recent_business_days ?? []).length / HISTORY_PAGE_SIZE))));
        setAccountingCloseHistoryPage((page) => Math.min(page, Math.max(1, Math.ceil(accountingCloseHistory.length / HISTORY_PAGE_SIZE))));
        setCounterHistoryPage((page) => Math.min(page, Math.max(1, Math.ceil((snapshot?.recent_counter_sessions ?? []).length / HISTORY_PAGE_SIZE))));
    }, [accountingCloseHistory.length, snapshot?.recent_business_days, snapshot?.recent_counter_sessions]);

    const sessionsByShift = useMemo(() => {
        const map = new Map<number, any[]>();
        for (const session of snapshot?.counter_sessions ?? []) { const bucket = map.get(session.shift_id) ?? []; bucket.push(session); map.set(session.shift_id, bucket); }
        return map;
    }, [snapshot]);
    const shiftsById = useMemo(() => {
        const map = new Map<number, any>();
        for (const shift of snapshot?.shifts ?? []) {
            map.set(Number(shift.id), shift);
        }
        return map;
    }, [snapshot?.shifts]);
    const shiftWindowsOverlap = (left?: any | null, right?: any | null) => {
        const resolvePoint = (value?: string | null) => (value ? new Date(value).getTime() : Number.NaN);
        const leftStart = resolvePoint(left?.planned_start || left?.actual_start || left?.opened_at || null);
        const leftEnd = resolvePoint(left?.planned_end || left?.actual_end || left?.closed_at || null);
        const rightStart = resolvePoint(right?.planned_start || right?.actual_start || right?.opened_at || null);
        const rightEnd = resolvePoint(right?.planned_end || right?.actual_end || right?.closed_at || null);
        if (![leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)) return true;
        return leftStart < rightEnd && rightStart < leftEnd;
    };
    const run = async (key: string, task: () => Promise<void>) => {
        setBusy(key);
        try { await task(); await load(); }
        catch (error: any) { toast.error('Action Failed', error?.message || 'Could not complete the operation.'); }
        finally { setBusy(null); }
    };

    const normalizeSessionWorkflow = (session: any) => String(session?.workflow_status || session?.terminal_status || '').toLowerCase();
    const isSessionAwaitingVerification = (session: any) => normalizeSessionWorkflow(session) === 'blind_closed';
    const shiftDraft = (shiftId: number) => shiftDrafts[shiftId] ?? { sale_counter_id: snapshot?.sale_counters?.[0]?.id ?? 0, user_id: snapshot?.cashiers?.[0]?.id ?? 0, assigned_float: '0' };
    const sessionDraft = (session: any) => sessionDrafts[session.id] ?? { sale_counter_id: session.sale_counter_id, user_id: session.user_id ?? 0, assigned_float: String(session.assigned_float ?? 0) };
    const isOperationalSessionOpen = (session: any) => {
        const normalized = normalizeSessionWorkflow(session);
        return normalized !== 'verified_closed' && normalized !== 'closed';
    };
    const availableCountersForBusinessDay = (currentCounterId?: number | null) => (snapshot?.sale_counters ?? []).filter((counter) => {
        if (Number(counter.id) === Number(currentCounterId ?? 0)) return true;
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) =>
            isOperationalSessionOpen(session) && Number(session.sale_counter_id) === Number(counter.id),
        );
        return !conflictingSession;
    });
    const availableCashiersForBusinessDay = (currentUserId?: number | null) => (snapshot?.cashiers ?? []).filter((cashier) => {
        if (Number(cashier.id) === Number(currentUserId ?? 0)) return true;
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) =>
            isOperationalSessionOpen(session) && Number(session.user_id) === Number(cashier.id),
        );
        return !conflictingSession;
    });
    const counterChoicesForBusinessDay = () => (snapshot?.sale_counters ?? []).map((counter) => {
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) =>
            isOperationalSessionOpen(session) && Number(session.sale_counter_id) === Number(counter.id),
        );
        return {
            ...counter,
            is_available: !conflictingSession,
            occupied_label: conflictingSession?.user?.full_name || conflictingSession?.user_name || null,
        };
    });
    const cashierChoicesForBusinessDay = () => (snapshot?.cashiers ?? []).map((cashier) => {
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) =>
            isOperationalSessionOpen(session) && Number(session.user_id) === Number(cashier.id),
        );
        return {
            ...cashier,
            is_available: !conflictingSession,
            occupied_label: conflictingSession?.sale_counter?.name || conflictingSession?.sale_counter_name || null,
        };
    });
    const availableCountersForAssignment = (shiftId: number, currentCounterId?: number | null) => (snapshot?.sale_counters ?? []).filter((counter) => {
        if (Number(counter.id) === Number(currentCounterId ?? 0)) return true;
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) => {
            const normalized = normalizeSessionWorkflow(session);
            if (normalized === 'verified_closed' || normalized === 'closed') return false;
            if (Number(session.sale_counter_id) !== Number(counter.id)) return false;
            if (Number(session.shift_id) === Number(shiftId)) return false;
            return shiftWindowsOverlap(shiftsById.get(Number(shiftId)), shiftsById.get(Number(session.shift_id)));
        });
        return !conflictingSession;
    });
    const availableCashiersForAssignment = (shiftId: number, currentUserId?: number | null) => (snapshot?.cashiers ?? []).filter((cashier) => {
        if (Number(cashier.id) === Number(currentUserId ?? 0)) return true;
        const conflictingSession = (snapshot?.counter_sessions ?? []).find((session) => {
            const normalized = normalizeSessionWorkflow(session);
            if (normalized === 'verified_closed' || normalized === 'closed') return false;
            if (Number(session.user_id) !== Number(cashier.id)) return false;
            if (Number(session.shift_id) === Number(shiftId)) return false;
            return shiftWindowsOverlap(shiftsById.get(Number(shiftId)), shiftsById.get(Number(session.shift_id)));
        });
        return !conflictingSession;
    });
    const resetTemplateEditor = () => { setEditingTemplateId(null); setTemplateForm(buildTemplateForm()); };
    const beginTemplateEdit = (template: any) => { setEditingTemplateId(template.id); setTemplateForm(buildTemplateForm(template)); };
    const cancelShiftEdit = () => { setEditingShiftId(null); setShiftEditor(null); };
    const beginShiftEdit = (shift: any) => { setEditingShiftId(shift.id); setShiftEditor(buildShiftEditor(shift)); };
    const describeSessionStatus = (status?: string | null) => {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'open') return 'Sales Counter Open';
        if (normalized === 'assigned') return 'Ready to Open';
        if (normalized === 'blind_closed') return 'Legacy Pending Close';
        if (normalized === 'verified_closed' || normalized === 'closed') return 'Fully Closed';
        return 'Waiting';
    };
    const verifyAndCloseCounterSession = async (session: any) => {
        if (!branchId) throw new Error('Active branch is required.');
        const authorizedUsername = (authorizedUsernames[session.id] || '').trim();
        if (!authorizedUsername) throw new Error('Enter authorized user ID before final close.');
        const supervisorPin = (pins[session.id] || '').trim();
        if (!supervisorPin) throw new Error('Enter authorized close PIN to finalize this legacy close.');
        const closingComment = (closeComments[session.id] ?? session.closing_comment ?? '').trim();
        if (!closingComment) throw new Error('Enter a closing comment before final counter close.');

        await posApi.verifyCounterClosing(branchId, session.id, {
            authorized_username: authorizedUsername,
            supervisor_pin: supervisorPin,
            reconciliation_notes: closingComment,
        });

        if (canPrintOperationalReports) {
            await printCounterXReport(session.id, `Counter Close ${session.sale_counter?.name || session.id}`);
        }

        setAuthorizedUsernames((state) => ({ ...state, [session.id]: '' }));
        setPins((state) => ({ ...state, [session.id]: '' }));
        setCloseComments((state) => ({ ...state, [session.id]: '' }));
        toast.success('Counter Fully Closed', 'The legacy pending-close session has now been fully closed.');
    };
    const sessionAssignedStamp = (session: any) => compactStamp(session.created_at || null);
    const sessionOpenedStamp = (session: any) => compactStamp(session.opened_at || session.verified_opened_at || session.created_at);
    const sessionClosedStamp = (session: any) => shortStamp(session.closed_at || session.verified_closed_at || session.blind_submitted_at || null);
    const describeShiftWindow = (shift: any) => `${shortStamp(shift.opened_at)} - ${shortStamp(shift.closed_at)}`;
    const describeBusinessDayStatus = (status?: string | null) => {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'open') return 'Business Day Open';
        if (normalized === 'closed') return 'Business Day Closed';
        if (normalized === 'planned') return 'Planned';
        return normalized ? normalized.replace(/_/g, ' ') : 'Waiting';
    };
    const describeAccountingCloseStatus = (status?: string | null) => {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'variance_review') return 'Variance Review';
        if (normalized === 'noted_close') return 'Noted Close';
        return 'Clean Close';
    };
    const operationalSessions = (snapshot?.counter_sessions ?? []).filter((session) => isOperationalSessionOpen(session));

    if (!branchId) return <div className={styles.empty}>Select a branch to manage operations.</div>;
    if (loading) return <div className={styles.empty}><Loader2 className={styles.spin} size={28} /> Loading branch operations...</div>;

    const activeDay = snapshot?.active_business_day;
    const closeBlockers = dayClosePreview?.blockers ?? [];
    const financeCloseReadiness = dayClosePreview?.finance_close_readiness ?? null;
    const operationalCloseBlockers = closeBlockers.filter((blocker: string) => !blocker.startsWith('Finance close blocker:'));
    const financeCloseBlockers = closeBlockers
        .filter((blocker: string) => blocker.startsWith('Finance close blocker:'))
        .map((blocker: string) => blocker.replace(/^Finance close blocker:\s*/, '').trim());
    const financeBlockerRows = [
        {
            label: 'Pending-Bill GRNs',
            count: Number(financeCloseReadiness?.pending_bill_count ?? 0),
            amount: Number(financeCloseReadiness?.pending_bill_amount ?? 0),
            detail: 'Goods received but still not moved to vendor bill stage.',
        },
        {
            label: 'Overdue AP',
            count: Number(financeCloseReadiness?.overdue_payable_count ?? 0),
            amount: Number(financeCloseReadiness?.overdue_payable_amount ?? 0),
            detail: 'Billed vendor payables remain overdue at close.',
        },
        {
            label: 'Unreconciled Vendor Payments',
            count: Number(financeCloseReadiness?.unreconciled_vendor_payment_count ?? 0),
            amount: Number(financeCloseReadiness?.unreconciled_vendor_payment_amount ?? 0),
            detail: 'Bank-side vendor payments are posted but not reconciled.',
        },
        {
            label: 'Treasury Exceptions',
            count: Number(financeCloseReadiness?.treasury_exception_count ?? 0),
            amount: 0,
            detail: 'Payment vouchers still have treasury-source or account exceptions.',
        },
    ];
    const treasuryFinanceRows = financeBlockerRows.filter((row) => row.label === 'Unreconciled Vendor Payments' || row.label === 'Treasury Exceptions');
    const nonTreasuryFinanceRows = financeBlockerRows.filter((row) => !treasuryFinanceRows.includes(row));
    const closeBlockedByFinance = financeBlockerRows.some((row) => row.count > 0);
    const closeBlocked = closeBlockers.length > 0;
    const closeButtonDisabled = busy === 'close-day' || dayClosePreviewLoading || closeBlocked || !dayClosePreview;
    const closeButtonLabel = dayClosePreviewLoading
        ? 'Refresh Close Preview First'
        : closeBlocked
            ? 'Resolve Day Close Blockers'
            : 'Close Business Day';
    const closeStatusLabel = financeCloseReadiness?.status === 'ready'
        ? 'Finance clear'
        : financeCloseReadiness?.top_issue || (closeBlockedByFinance ? 'Finance exceptions still need action.' : 'Awaiting preview');
    const shiftTemplates = snapshot?.shift_templates ?? [];
    const launchTemplates = shiftTemplates.filter((template) => template.is_active !== false);
    const visibleShifts = (snapshot?.shifts ?? []).filter((shift) => String(shift.status || '').toLowerCase() !== 'closed');
    const runningShiftByTemplateId = new Map<number, any>();
    for (const shift of visibleShifts) {
        if (String(shift.status || '').toLowerCase() !== 'open' || !shift.shift_template_id) continue;
        const templateId = Number(shift.shift_template_id);
        if (!runningShiftByTemplateId.has(templateId)) runningShiftByTemplateId.set(templateId, shift);
    }
    const toneByTemplateId = new Map<number, string>();
    launchTemplates.forEach((template, index) => {
        toneByTemplateId.set(Number(template.id), SHIFT_TONES[index % SHIFT_TONES.length]);
    });
    const businessDayHistory = paginateRows(snapshot?.recent_business_days ?? [], businessDayPage);
    const accountingCloseHistoryPaged = paginateRows(accountingCloseHistory, accountingCloseHistoryPage);
    const counterHistory = paginateRows(snapshot?.recent_counter_sessions ?? [], counterHistoryPage);

    const saveTemplate = () => run('template', async () => {
        const payload = { ...templateForm, sort_order: Number(templateForm.sort_order || 1) };
        if (editingTemplateId) {
            await posApi.updateShiftTemplate(branchId, editingTemplateId, payload);
            toast.success('Shift Template Updated', 'Template settings have been updated.');
        } else {
            await posApi.createShiftTemplate(branchId, payload);
            toast.success('Shift Template Saved', 'You can start this shift from the console.');
        }
        resetTemplateEditor();
    });
    const toggleTemplateActive = (template: any) => run(`template-toggle-${template.id}`, async () => {
        const nextActive = template.is_active === false;
        await posApi.updateShiftTemplate(branchId, template.id, { is_active: nextActive });
        toast.success(
            nextActive ? 'Shift Template Enabled' : 'Shift Template Disabled',
            nextActive ? 'This shift is now available to launch.' : 'This shift has been removed from launchable shifts.',
        );
        if (editingTemplateId === template.id) {
            setTemplateForm((current) => ({ ...current, is_active: nextActive }));
        }
    });

    const templatePanel = (
        <KitchenCard className={styles.panel}>
            <div className={styles.panelHead}><div><h2>Shift Setup</h2><p>Create reusable shifts here, then use them below to start a live shift for the current business day.</p></div></div>
            <div className={styles.stack}>
                {shiftTemplates.length === 0 && <div className={styles.inlineEmpty}>No shift templates configured yet.</div>}
                {shiftTemplates.length > 0 && <div className={styles.templateCatalog}>
                    {shiftTemplates.map((template, index) => (
                        <div className={`${styles.templateCard} ${styles[SHIFT_TONES[index % SHIFT_TONES.length]]}`} key={template.id}>
                            <div className={styles.templateCardHead}>
                                <strong>{template.name}</strong>
                                {template.is_active === false && <span className={styles.badgeMuted}>Inactive</span>}
                            </div>
                            <span>{template.code} | {formatShiftTime(template.planned_start_time)} - {formatShiftTime(template.planned_end_time)}</span>
                            <div className={styles.templateMetaRow}>
                                <span>Order #{template.sort_order ?? 1}</span>
                                <span className={styles.badge}>{template.allow_overlap ? 'Overlap Allowed' : 'Single Window'}</span>
                            </div>
                            <div className={styles.rowActions}>
                                {canManageShifts ? <KitchenButton disabled={busy === `template-toggle-${template.id}`} variant={template.is_active === false ? 'primary' : 'outline'} onClick={() => void toggleTemplateActive(template)}>
                                    {busy === `template-toggle-${template.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <Settings2 size={14} />}
                                    {template.is_active === false ? 'Enable' : 'Disable'}
                                </KitchenButton> : null}
                                {canManageShifts ? <KitchenButton variant="outline" onClick={() => beginTemplateEdit(template)}><Pencil size={14} /> Edit</KitchenButton> : null}
                            </div>
                        </div>
                    ))}
                </div>}
            </div>
            <div className={styles.formGrid}>
                <label><span>Name</span><input disabled={!canManageShifts} value={templateForm.name} onChange={(e) => setTemplateForm((s) => ({ ...s, name: e.target.value }))} /></label>
                <label><span>Code</span><input disabled={!canManageShifts} value={templateForm.code} onChange={(e) => setTemplateForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} /></label>
                <label><span>Start Time</span><input disabled={!canManageShifts} type="time" value={templateForm.planned_start_time.slice(0, 5)} onChange={(e) => setTemplateForm((s) => ({ ...s, planned_start_time: `${e.target.value}:00` }))} /></label>
                <label><span>End Time</span><input disabled={!canManageShifts} type="time" value={templateForm.planned_end_time.slice(0, 5)} onChange={(e) => setTemplateForm((s) => ({ ...s, planned_end_time: `${e.target.value}:00` }))} /></label>
                <label><span>Sort Order</span><input disabled={!canManageShifts} type="number" min="1" value={templateForm.sort_order} onChange={(e) => setTemplateForm((s) => ({ ...s, sort_order: e.target.value }))} /></label>
            </div>
            <div className={styles.checkboxRow}>
                <label className={styles.checkbox}><input disabled={!canManageShifts} type="checkbox" checked={templateForm.allow_overlap} onChange={(e) => setTemplateForm((s) => ({ ...s, allow_overlap: e.target.checked }))} /> Allow overlap with other shifts</label>
                <label className={styles.checkbox}><input disabled={!canManageShifts} type="checkbox" checked={templateForm.is_active} onChange={(e) => setTemplateForm((s) => ({ ...s, is_active: e.target.checked }))} /> Template is active</label>
            </div>
            {canManageShifts ? <div className={styles.actions}>
                <KitchenButton disabled={busy === 'template'} variant="primary" onClick={() => void saveTemplate()}>{busy === 'template' ? <Loader2 className={styles.spinMini} size={14} /> : editingTemplateId ? <RefreshCcw size={14} /> : <Plus size={14} />}{editingTemplateId ? 'Update Template' : 'Save Template'}</KitchenButton>
                {editingTemplateId && <KitchenButton variant="ghost" onClick={resetTemplateEditor}>Cancel Edit</KitchenButton>}
            </div> : null}
        </KitchenCard>
    );

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <div className={styles.eyebrow}>{branchName}</div>
                    <h1>Operations Console</h1>
                    <p>Business day, sales counter assignment, and blind-close verification on one screen.</p>
                    <div className={styles.tabBar}>
                        <button
                            type="button"
                            className={`${styles.tabButton} ${activeTab === 'operations' ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab('operations')}
                        >
                            <CalendarRange size={15} />
                            Operations
                        </button>
                        {LEGACY_SHIFT_COMPATIBILITY_VISIBLE ? (
                            <button
                                type="button"
                                className={`${styles.tabButton} ${activeTab === 'shifts' ? styles.tabButtonActive : ''}`}
                                onClick={() => setActiveTab('shifts')}
                            >
                                <Settings2 size={15} />
                                Shift Setup
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className={`${styles.tabButton} ${activeTab === 'terminal-center' ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab('terminal-center')}
                        >
                            <Monitor size={15} />
                            Terminal Center
                        </button>
                    </div>
                </div>
                <div className={styles.actions}>
                    <KitchenButton variant="outline" onClick={() => void load()}><RefreshCcw size={14} /> Refresh</KitchenButton>
                    {canManageTillSessions ? <KitchenButton variant="ghost" onClick={() => setActiveTab('terminal-center')}><Monitor size={14} /> Terminal Center</KitchenButton> : null}
                    {canOperatePos ? <KitchenButton variant="primary" onClick={openCashierCounter}><Users size={14} /> Open Cashier Counter</KitchenButton> : null}
                </div>
            </section>

            {activeTab === 'operations' && (!activeDay ? (
                <section className={styles.fullWidthSection}>
                    <KitchenCard className={`${styles.panel} ${styles.dayStarterPanel}`}>
                        <div className={styles.dayStarterHero}>
                            <div className={styles.dayStarterLead}>
                                <div className={styles.panelHead}>
                                    <div>
                                        <div className={styles.dayStarterKicker}>Manager Day Control</div>
                                        <h2>Start Business Day</h2>
                                        <p>Business day stays separate from calendar date and can continue past midnight.</p>
                                    </div>
                                </div>
                                <div className={styles.dayStarterHighlights}>
                                    <div className={`${styles.dayStarterHighlight} ${styles.dayStarterHighlightPrimary}`}>
                                        <span className={styles.dayStarterHighlightLabel}>Business Date</span>
                                        <strong>{displayDate(dayForm.business_date)}</strong>
                                        <small>Operational date for sales, shifts, and reports.</small>
                                    </div>
                                    <div className={`${styles.dayStarterHighlight} ${styles.dayStarterHighlightInfo}`}>
                                        <span className={styles.dayStarterHighlightLabel}>Opening Time</span>
                                        <strong>{shortStamp(dayForm.opened_at)}</strong>
                                        <small>Counter activity and till assignment begin from this time.</small>
                                    </div>
                                    <div className={`${styles.dayStarterHighlight} ${styles.dayStarterHighlightWarn}`}>
                                        <span className={styles.dayStarterHighlightLabel}>Planned Close</span>
                                        <strong>{shortStamp(dayForm.planned_closing_at)}</strong>
                                        <small>Expected close target for the operating team.</small>
                                    </div>
                                </div>
                                <div className={styles.dayStarterNote}>
                                    <CalendarRange size={16} />
                                    <span>Use a business day when service continues after midnight. Use Off Day only when the branch stays closed.</span>
                                </div>
                            </div>
                            <div className={styles.dayStarterPreview}>
                                <div className={styles.dayStarterPreviewCard}>
                                    <span className={styles.dayStarterPreviewLabel}>Branch</span>
                                    <strong>{branchName}</strong>
                                </div>
                                <div className={styles.dayStarterPreviewCard}>
                                    <span className={styles.dayStarterPreviewLabel}>Day Title</span>
                                    <strong>{dayForm.title || 'Untitled business day'}</strong>
                                </div>
                                <div className={styles.dayStarterPreviewCard}>
                                    <span className={styles.dayStarterPreviewLabel}>Launch Mode</span>
                                    <strong>{saveAsOffDay ? 'Off Day Ready' : 'Live Operations'}</strong>
                                </div>
                            </div>
                        </div>
                        <div className={styles.dayStarterForm}>
                            <div className={styles.dayStarterFormHead}>
                                <div>
                                    <h3>Day Setup</h3>
                                    <p>Confirm the title, timings, and notes before opening operations.</p>
                                </div>
                            </div>
                            <div className={styles.dayStarterPrimaryRow}>
                                <label><span>Day Title</span><input disabled={!canManageBranchDay} value={dayForm.title} onChange={(e) => setDayForm((s) => ({ ...s, title: e.target.value }))} /></label>
                                <label><span>Business Date</span><input disabled={!canManageBranchDay} type="date" value={dayForm.business_date} onChange={(e) => setDayForm((s) => ({ ...s, business_date: e.target.value }))} /></label>
                                <label><span>Opened At</span><input disabled={!canManageBranchDay} type="datetime-local" value={dayForm.opened_at} onChange={(e) => setDayForm((s) => ({ ...s, opened_at: e.target.value }))} /></label>
                                <label><span>Planned Close</span><input disabled={!canManageBranchDay} type="datetime-local" value={dayForm.planned_closing_at} onChange={(e) => setDayForm((s) => ({ ...s, planned_closing_at: e.target.value }))} /></label>
                            </div>
                            <div className={styles.dayStarterSecondaryRow}>
                                <label className={styles.dayStarterNotesField}><span>Notes</span><textarea disabled={!canManageBranchDay} rows={3} value={dayForm.notes} onChange={(e) => setDayForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional handover or service notes for the day team." /></label>
                                <label><span>Off Day Reason</span><input disabled={!canManageBranchDay || !saveAsOffDay} value={dayForm.off_day_reason} onChange={(e) => setDayForm((s) => ({ ...s, off_day_reason: e.target.value }))} placeholder={saveAsOffDay ? 'Required when saving an off day' : 'Enable Off Day to enter a reason'} /></label>
                                {canManageBranchDay ? <div className={styles.dayStarterActions}>
                                    <label className={styles.dayStarterSwitch}>
                                        <input
                                            disabled={!canManageBranchDay}
                                            type="checkbox"
                                            checked={saveAsOffDay}
                                            onChange={(e) => setSaveAsOffDay(e.target.checked)}
                                            className={styles.dayStarterSwitchInput}
                                        />
                                        <span className={styles.dayStarterSwitchSlider} />
                                        <span className={styles.dayStarterSwitchLabel}>Save as Off Day</span>
                                    </label>
                                    <KitchenButton disabled={busy === 'open-day' || busy === 'off-day'} variant="primary" onClick={() => void run(saveAsOffDay ? 'off-day' : 'open-day', async () => {
                                        if (saveAsOffDay) {
                                            if (!dayForm.off_day_reason.trim()) throw new Error('Enter an off day reason.');
                                            await posApi.markOffDay(branchId, { title: dayForm.title, business_date: dayForm.business_date, opened_at: new Date(dayForm.opened_at).toISOString(), planned_closing_at: new Date(dayForm.planned_closing_at).toISOString(), off_day_reason: dayForm.off_day_reason, notes: dayForm.notes || undefined });
                                            toast.success('Off Day Recorded', 'The branch off day has been saved.');
                                            return;
                                        }
                                        await posApi.openBusinessDay(branchId, { title: dayForm.title, business_date: dayForm.business_date, opened_at: new Date(dayForm.opened_at).toISOString(), planned_closing_at: new Date(dayForm.planned_closing_at).toISOString(), notes: dayForm.notes || undefined });
                                        toast.success('Business Day Opened', 'Manager console is now live for this branch.');
                                    })}>{busy === 'open-day' || busy === 'off-day' ? <Loader2 className={styles.spinMini} size={14} /> : saveAsOffDay ? <AlertTriangle size={14} /> : <Play size={14} />} {saveAsOffDay ? 'Save Off Day' : 'Start Business Day'}</KitchenButton>
                                </div> : null}
                            </div>
                        </div>
                    </KitchenCard>
                </section>
            ) : (
                <section className={styles.stackLg}>
                    <KitchenCard className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div><h2>{activeDay.title}</h2><p><CalendarRange size={14} /> {activeDay.business_date} | Opened {stamp(activeDay.opened_at)}</p></div>
                            {canManageBranchDay ? <div className={styles.actions}>
                                {canPrintOperationalReports ? <KitchenButton disabled={busy === 'print-day-z'} variant="ghost" onClick={() => setZReportDay(activeDay)}>{busy === 'print-day-z' ? <Loader2 className={styles.spinMini} size={14} /> : <Printer size={14} />} Print Z-Report</KitchenButton> : null}
                                <KitchenButton disabled={closeButtonDisabled} variant="outline" onClick={() => void run('close-day', async () => {
                                const preview = await loadDayClosePreview(activeDay.business_date);
                                if (!preview) throw new Error('Could not validate day close readiness.');
                                if ((preview.blockers ?? []).length > 0) {
                                    throw new Error(`Day close blocked. ${(preview.blockers ?? []).join(' ')}`);
                                }
                                const closeResult = await posApi.closeBusinessDaySession(branchId, activeDay.id);
                                const dayReport = closeResult?.day_closing_report;
                                if (dayReport) {
                                    const documentMarkup = buildDayClosingReportPrintDocument({
                                        settings,
                                        format: 'thermal-80mm',
                                        data: buildPrintableDayClosingReport(dayReport) as any,
                                    });
                                    if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, `Day Closing ${activeDay.business_date}`)) {
                                        toast.error('Print Blocked', 'Allow pop-ups for this app to print the day closing report.');
                                    }
                                }
                                toast.success('Business Day Closed', 'Day close and accounting posting completed.');
                            })}>{busy === 'close-day' ? <Loader2 className={styles.spinMini} size={14} /> : <Square size={14} />} {closeButtonLabel}</KitchenButton>
                            </div> : null}
                        </div>
                        <div className={styles.subtleNote}>
                            Daily operations now run directly on the business day. Assign counters to cashiers here, open them, blind-close them, and finish the day once every counter is verified closed.
                        </div>
                        {canManageBranchDay ? <div className={styles.subtleNote}>
                            Close control: {closeBlocked ? `${closeBlockers.length} blocker(s) remain.` : closeStatusLabel}
                        </div> : null}
                    </KitchenCard>
                    <KitchenCard className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div>
                                <h2>Day Close Readiness</h2>
                                <p>Operational and finance blockers must both clear before this business day can close.</p>
                            </div>
                            <div className={styles.actions}>
                                <KitchenButton disabled={dayClosePreviewLoading} variant="ghost" onClick={() => void loadDayClosePreview(activeDay.business_date)}>
                                    {dayClosePreviewLoading ? <Loader2 className={styles.spinMini} size={14} /> : <RefreshCcw size={14} />}
                                    Refresh Preview
                                </KitchenButton>
                            </div>
                        </div>
                        <div className={styles.closeReadinessPanel}>
                            <div className={`${styles.closeReadinessBanner} ${closeBlockers.length > 0 ? styles.closeReadinessBannerWarn : styles.closeReadinessBannerOk}`}>
                                <div className={styles.closeReadinessIcon}>
                                    {closeBlockers.length > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                                </div>
                                <div className={styles.closeReadinessBody}>
                                    <strong>{closeBlockers.length > 0 ? 'Day close is currently blocked' : 'Day close is clear to proceed'}</strong>
                                    <span>
                                        {closeBlockers.length > 0
                                            ? `${closeBlockers.length} blocker(s) still require action before final close.`
                                            : 'Operational checks and finance checks are currently clean for this business day.'}
                                    </span>
                                    <span>{closeStatusLabel}</span>
                                </div>
                            </div>
                            <div className={styles.closeReadinessMetrics}>
                                <div className={styles.closeReadinessMetricCard}>
                                    <span>Blockers</span>
                                    <strong>{closeBlockers.length}</strong>
                                    <small>{operationalCloseBlockers.length} operational | {financeCloseBlockers.length} finance</small>
                                </div>
                                {financeBlockerRows.map((row) => (
                                    <div key={row.label} className={styles.closeReadinessMetricCard}>
                                        <span>{row.label}</span>
                                        <strong>{row.count}</strong>
                                        <small>{row.amount > 0 ? formatBranchMoney(row.amount) : row.count > 0 ? 'Attention required' : 'Clear'}</small>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.closeReadinessColumns}>
                                <div className={styles.closeReadinessSection}>
                                    <div className={styles.closeReadinessSectionHead}>
                                        <strong>Operational Close Controls</strong>
                                        <span>{operationalCloseBlockers.length} active</span>
                                    </div>
                                    {operationalCloseBlockers.length > 0 ? (
                                        <div className={styles.closeReadinessList}>
                                            {operationalCloseBlockers.map((blocker: string, index: number) => (
                                                <div key={`${blocker}-${index}`} className={styles.closeReadinessListItem}>
                                                    <AlertTriangle size={14} />
                                                    <span>{blocker}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={styles.closeReadinessSectionOk}>No operational blocker is currently stopping day close.</div>
                                    )}
                                </div>
                                <div className={styles.closeReadinessSection}>
                                    <div className={styles.closeReadinessSectionHead}>
                                        <strong>Finance Close Controls</strong>
                                        <span>{financeCloseBlockers.length} active</span>
                                    </div>
                                    <div className={styles.closeReadinessList}>
                                        {nonTreasuryFinanceRows.map((row) => (
                                            <div key={`${row.label}-detail`} className={styles.closeReadinessListItem}>
                                                <AlertTriangle size={14} />
                                                <span>
                                                    <strong>{row.label}:</strong> {row.detail}
                                                    {row.count > 0 ? ` Open items: ${row.count}${row.amount > 0 ? ` (${formatBranchMoney(row.amount)})` : ''}.` : ' No current blocker.'}
                                                </span>
                                            </div>
                                        ))}
                                        {financeCloseBlockers.length > 0 ? financeCloseBlockers.map((blocker: string, index: number) => (
                                            <div key={`${blocker}-finance-${index}`} className={styles.closeReadinessListItem}>
                                                <AlertTriangle size={14} />
                                                <span>{blocker}</span>
                                            </div>
                                        )) : null}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.closeReadinessTreasury}>
                                <div className={styles.closeReadinessSectionHead}>
                                    <strong>Treasury Review At Close</strong>
                                    <span>{treasuryFinanceRows.reduce((sum, row) => sum + row.count, 0)} active</span>
                                </div>
                                <div className={styles.closeReadinessMetricsCompact}>
                                    {treasuryFinanceRows.map((row) => (
                                        <div key={`${row.label}-treasury`} className={styles.closeReadinessMetricCard}>
                                            <span>{row.label}</span>
                                            <strong>{row.count}</strong>
                                            <small>{row.amount > 0 ? formatBranchMoney(row.amount) : row.count > 0 ? 'Attention required' : 'Clear'}</small>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.closeReadinessNarrative}>
                                    {financeCloseReadiness?.status === 'attention'
                                        ? 'Treasury and vendor-payment exceptions shown here should match what finance sees in bank reconciliation and voucher review.'
                                        : 'Treasury controls are currently aligned with finance close readiness for this business day.'}
                                </div>
                            </div>
                            {closeBlockers.length === 0 ? (
                                <div className={styles.closeReadinessSuccess}>
                                    No operational or finance blockers are currently preventing this business day from closing.
                                </div>
                            ) : (
                                <div className={styles.closeReadinessNarrative}>
                                    Clear operational blockers first, then finance and treasury blockers, before final day close.
                                </div>
                            )}
                        </div>
                    </KitchenCard>
                    <KitchenCard className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div><h2>Sales Counter Assignments</h2><p>Assign counters directly for this business day. Shift records remain internal for compatibility only.</p></div>
                        </div>
                        {canManageTillSessions ? (() => {
                            const counterChoices = counterChoicesForBusinessDay();
                            const cashierChoices = cashierChoicesForBusinessDay();
                            const availableCounters = availableCountersForBusinessDay();
                            const availableCashiers = availableCashiersForBusinessDay();
                            const selectedCounterId = availableCounters.some((counter) => Number(counter.id) === Number(dayDraft.sale_counter_id))
                                ? dayDraft.sale_counter_id
                                : Number(availableCounters[0]?.id ?? counterChoices[0]?.id ?? 0);
                            const selectedUserId = availableCashiers.some((cashier) => Number(cashier.id) === Number(dayDraft.user_id))
                                ? dayDraft.user_id
                                : Number(availableCashiers[0]?.id ?? cashierChoices[0]?.id ?? 0);
                            const selectedCounter = counterChoices.find((counter) => Number(counter.id) === Number(selectedCounterId));
                            const selectedCashier = cashierChoices.find((cashier) => Number(cashier.id) === Number(selectedUserId));
                            const canAssignSelectedCounter = Boolean(selectedCounter?.is_available);
                            const canAssignSelectedCashier = Boolean(selectedCashier?.is_available);
                            return <>
                                <div className={styles.assign}>
                                    <select value={selectedCounterId} onChange={(e) => setDayDraft((current) => ({ ...current, sale_counter_id: Number(e.target.value) }))}>
                                        {counterChoices.map((counter) => (
                                            <option key={counter.id} value={counter.id} disabled={!counter.is_available}>
                                                {counter.name}{counter.is_available ? '' : ` (Assigned${counter.occupied_label ? ` to ${counter.occupied_label}` : ''})`}
                                            </option>
                                        ))}
                                    </select>
                                    <select value={selectedUserId} onChange={(e) => setDayDraft((current) => ({ ...current, user_id: Number(e.target.value) }))}>
                                        {cashierChoices.map((cashier) => (
                                            <option key={cashier.id} value={cashier.id} disabled={!cashier.is_available}>
                                                {cashier.full_name}{cashier.is_available ? '' : ` (Assigned${cashier.occupied_label ? ` on ${cashier.occupied_label}` : ''})`}
                                            </option>
                                        ))}
                                    </select>
                                    <input value={dayDraft.assigned_float} onChange={(e) => setDayDraft((current) => ({ ...current, assigned_float: e.target.value }))} placeholder="Starting cash" />
                                    <KitchenButton disabled={busy === 'authorize-day-till' || !selectedCounterId || !selectedUserId || !canAssignSelectedCounter || !canAssignSelectedCashier} variant="primary" onClick={() => void run('authorize-day-till', async () => {
                                        await posApi.authorizeTill(branchId, { sale_counter_id: selectedCounterId, user_id: selectedUserId, assigned_float: Number(dayDraft.assigned_float || 0) });
                                        setDayDraft({ sale_counter_id: 0, user_id: 0, assigned_float: '0' });
                                        toast.success('Counter Assigned', 'Cashier can now verify the starting cash from the cashier screen.');
                                    })}>{busy === 'authorize-day-till' ? <Loader2 className={styles.spinMini} size={14} /> : <Plus size={14} />} Assign Counter to Cashier</KitchenButton>
                                </div>
                                {(availableCounters.length === 0 || availableCashiers.length === 0) ? <div className={styles.inlineEmpty}>All sales counters or cashiers are already assigned. Busy entries remain visible in the dropdown.</div> : null}
                            </>;
                        })() : null}
                        <div className={styles.subtleNote}>
                            Use this section for normal day-to-day counter assignment. Any shift launch controls below are retained only for legacy compatibility.
                        </div>
                        <div className={styles.assignmentTableWrap}>
                            <table className={styles.assignmentTable}>
                                <thead>
                                    <tr>
                                        <th>Sales Counter</th>
                                        <th>Cashier</th>
                                        <th>Opening Cash</th>
                                        <th>Assignment Time</th>
                                        <th>Opening Time</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operationalSessions.length === 0 ? <tr><td colSpan={6}><div className={styles.inlineEmpty}>No sales counter is assigned for this business day yet.</div></td></tr> : operationalSessions.map((session) => (
                                        <tr key={`day-summary-${session.id}`}>
                                            <td><strong>{session.sale_counter?.name || `Counter #${session.sale_counter_id}`}</strong></td>
                                            <td>{session.user?.full_name || 'Unassigned'}</td>
                                            <td className={styles.assignmentMoneyCell}>{formatBranchMoney(session.assigned_float)}</td>
                                            <td className={styles.assignmentTimeCell}>{sessionAssignedStamp(session)}</td>
                                            <td className={styles.assignmentTimeCell}>{session.workflow_status === 'assigned' ? '--' : sessionOpenedStamp(session)}</td>
                                            <td><span className={styles.assignmentStatus}>{describeSessionStatus(session.workflow_status)}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {operationalSessions.length > 0 && <div className={styles.sessionTable}>
                            <div className={styles.sessionTableHeader}>
                                <span>Sales Counter</span>
                                <span>Cashier</span>
                                <span>Status</span>
                                <span>Opened</span>
                                <span>Closed</span>
                            </div>
                            {operationalSessions.map((session) => (
                                <div key={`day-session-${session.id}`} className={styles.session}>
                                    <div className={styles.sessionTableRow}>
                                        <span data-label="Sales Counter" className={styles.sessionTablePrimary}>{session.sale_counter?.name || `Counter #${session.sale_counter_id}`}</span>
                                        <span data-label="Cashier">{session.user?.full_name || 'Unassigned'}</span>
                                        <span data-label="Status">{describeSessionStatus(session.workflow_status)}</span>
                                        <span data-label="Opened">{sessionOpenedStamp(session)}</span>
                                        <span data-label="Closed">{sessionClosedStamp(session)}</span>
                                    </div>
                                    {isSessionAwaitingVerification(session) && canManageTillSessions && <div className={styles.verifyPanel}>
                                        <div className={styles.verifyBanner}>
                                            <div className={styles.verifyBannerIcon}><AlertTriangle size={16} /></div>
                                            <div className={styles.verifyBannerBody}>
                                                <strong>Legacy Final Close Required</strong>
                                                <span>Blind close is complete. Verify the counted cash and authorize the final counter close.</span>
                                            </div>
                                        </div>
                                        <div className={styles.verifySummaryGrid}>
                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardOpening}`}><span>Opening Amount</span><strong>{formatBranchMoney(session.assigned_float)}</strong></div>
                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardSales}`}><span>Sales Figure</span><strong>{formatBranchMoney(session.sales_figure)}</strong></div>
                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardCounted}`}><span>Actual Cash Collected</span><strong>{formatBranchMoney(session.actual_cash_collected)}</strong></div>
                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardExpected}`}><span>Expected Cash</span><strong>{formatBranchMoney(session.expected_cash)}</strong></div>
                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardVariance}`}><span>Variance</span><strong>{formatBranchMoney(session.variance)}</strong></div>
                                        </div>
                                        <div className={styles.verifyActionRow}>
                                            <div className={styles.verifyFields}>
                                                <div className={styles.verifyPinGroup}>
                                                    <label htmlFor={`day-counter-close-user-${session.id}`}>Authorized User ID</label>
                                                    <input id={`day-counter-close-user-${session.id}`} type="text" placeholder="Enter authorized user ID" value={authorizedUsernames[session.id] || ''} onChange={(e) => setAuthorizedUsernames((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                </div>
                                                <div className={styles.verifyCommentGroup}>
                                                    <label htmlFor={`day-counter-close-comment-${session.id}`}>Closing Comment</label>
                                                    <textarea id={`day-counter-close-comment-${session.id}`} placeholder="Enter closing comment for this sales counter" value={closeComments[session.id] ?? session.closing_comment ?? ''} onChange={(e) => setCloseComments((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                </div>
                                                <div className={styles.verifyPinGroup}>
                                                    <label htmlFor={`day-counter-close-pin-${session.id}`}>Counter Close PIN</label>
                                                    <input id={`day-counter-close-pin-${session.id}`} type="password" placeholder="Enter authorized close PIN" value={pins[session.id] || ''} onChange={(e) => setPins((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                </div>
                                            </div>
                                            <KitchenButton disabled={busy === `day-verify-${session.id}`} variant="primary" className={styles.verifySubmitButton} onClick={() => void run(`day-verify-${session.id}`, async () => {
                                                await verifyAndCloseCounterSession(session);
                                            })}>{busy === `day-verify-${session.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <ShieldCheck size={14} />} Finalize Legacy Close</KitchenButton>
                                        </div>
                                    </div>}
                                </div>
                            ))}
                        </div>}
                    </KitchenCard>
                        {LEGACY_SHIFT_COMPATIBILITY_VISIBLE ? <>
                        <div className={styles.subtleNote}>
                            Start each required shift from the buttons below. Every started shift appears as its own card, where you can assign counters and starting cash separately.
                        </div>
                        <div className={styles.templateGrid}>
                            {launchTemplates.map((template) => {
                                const templateId = Number(template.id);
                                const runningShift = runningShiftByTemplateId.get(templateId);
                                const isRunning = !!runningShift;
                                const toneClass = styles[toneByTemplateId.get(templateId) || 'toneA'];
                                const busyKey = isRunning ? `end-${runningShift.id}` : `shift-${template.id}`;
                                const runningSessions = isRunning ? (sessionsByShift.get(runningShift.id) ?? []) : [];
                                return (
                                    <div
                                        key={template.id}
                                        className={`${styles.templateButton} ${isRunning ? styles.templateRunning : styles.templateReady} ${toneClass}`}
                                    >
                                        <div className={styles.templateBody}>
                                            <div className={styles.templateHeaderRow}>
                                                <div className={styles.templateTitleRow}>
                                                    <span className={styles.templatePlannedTime}>{`${template.name} -- ${formatShiftTime(template.planned_start_time)} - ${formatShiftTime(template.planned_end_time)}`}</span>
                                                </div>
                                                <div className={styles.templateActions}>
                                                    <span className={`${styles.templateStatus} ${isRunning ? styles.templateStatusRunning : styles.templateStatusReady}`}>
                                                        {isRunning ? 'Running' : 'Ready'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={!canManageShifts || busy === busyKey}
                                                        className={`${styles.templateActionButton} ${isRunning ? styles.templateActionButtonStop : styles.templateActionButtonPlay}`}
                                                        aria-label={isRunning ? `Stop ${template.name}` : `Start ${template.name}`}
                                                        onClick={() => canManageShifts && void run(busyKey, async () => {
                                                            if (isRunning) {
                                                                await posApi.endOperatingShift(branchId, runningShift.id);
                                                                if (editingShiftId === runningShift.id) cancelShiftEdit();
                                                                toast.success('Shift Closed', `${runningShift.shift_name} has been closed.`);
                                                                return;
                                                            }
                                                            await posApi.startOperatingShift(branchId, { shift_template_id: template.id });
                                                            toast.success('Shift Started', `${template.name} has been started.`);
                                                        })}
                                                    >
                                                        {busy === busyKey ? <Loader2 className={styles.spinMini} size={14} /> : isRunning ? <Square size={16} className={styles.stopIcon} /> : <Play size={16} className={styles.playIcon} />}
                                                    </button>
                                                </div>
                                            </div>
                                            {isRunning ? (
                                                <div className={styles.templateShiftMeta}>
                                                    <span className={styles.templateShiftMetaLabel}>Shift Window</span>
                                                    <strong>{describeShiftWindow(runningShift)}</strong>
                                                </div>
                                            ) : null}
                                            {isRunning && runningSessions.length > 0 ? (
                                                <div className={styles.templateSessionList}>
                                                    <div className={styles.templateSessionHeader}>
                                                        <span>Sales Counter</span>
                                                        <span>Cashier</span>
                                                        <span>Status</span>
                                                    </div>
                                                    {runningSessions.map((session) => (
                                                        <div key={`template-session-${session.id}`} className={styles.templateSessionRow}>
                                                            <span data-label="Sales Counter" className={styles.templateSessionPrimary}>{session.sale_counter?.name || `Counter #${session.sale_counter_id}`}</span>
                                                            <span data-label="Cashier">{`${session.user?.full_name || 'Unassigned'} | ID ${session.user_id ?? '--'}`}</span>
                                                            <span data-label="Status"><span className={styles.templateSessionStatus}>{describeSessionStatus(session.workflow_status)}</span></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : isRunning ? (
                                                <div className={styles.templateSessionEmpty}>No sales counters assigned yet.</div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                            {launchTemplates.length === 0 && <div className={styles.inlineEmpty}>No active shift setup is available. Create a shift first.</div>}
                        </div>
                    {visibleShifts.length > 0 ? (
                        <div className={styles.sectionLabel}>Live Shift Cards</div>
                    ) : null}
                    {visibleShifts.map((shift) => {
                        const draft = shiftDraft(shift.id);
                        const sessions = sessionsByShift.get(shift.id) ?? [];
                        const isEditingShift = editingShiftId === shift.id && !!shiftEditor;
                        const toneClass = styles[toneByTemplateId.get(Number(shift.shift_template_id)) || 'toneA'];
                        return (
                            <KitchenCard key={shift.id} className={`${styles.panel} ${styles.shiftPanel} ${toneClass}`}>
                                <div className={styles.panelHead}>
                                    <div><h2>{shift.shift_name}</h2><p><Clock3 size={14} /> Started {stamp(shift.opened_at)} | Current Shift Status: {shift.status.toUpperCase()}</p></div>
                                    {shift.status === 'open' && <div className={styles.actions}>
                                        {canManageShifts ? <KitchenButton variant="ghost" onClick={() => beginShiftEdit(shift)}><Pencil size={14} /> Edit Shift</KitchenButton> : null}
                                        {canManageShifts ? <KitchenButton disabled={busy === `end-${shift.id}`} variant="outline" onClick={() => void run(`end-${shift.id}`, async () => {
                                            await posApi.endOperatingShift(branchId, shift.id);
                                            if (editingShiftId === shift.id) cancelShiftEdit();
                                            toast.success('Shift Closed', `${shift.shift_name} has been closed.`);
                                        })}>{busy === `end-${shift.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <Square size={14} />} Close Shift</KitchenButton> : null}
                                    </div>}
                                </div>
                                <div className={styles.statline}>
                                    <span>Orders <strong>{shift.total_orders}</strong></span>
                                    <span>Sales <strong>{formatBranchMoney(shift.net_sales)}</strong></span>
                                    <span>Shift Time <strong>{describeShiftWindow(shift)}</strong></span>
                                    <span>Legacy Pending Close <strong>{shift.pending_close_count}</strong></span>
                                </div>
                                {isEditingShift && shiftEditor && <div className={styles.editorCard}>
                                    <div className={styles.formGrid}>
                                        <label><span>Shift Name</span><input disabled={!canManageShifts} value={shiftEditor.shift_name} onChange={(e) => setShiftEditor((current) => (current ? { ...current, shift_name: e.target.value } : current))} /></label>
                                        <label><span>Planned Start</span><input disabled={!canManageShifts} type="datetime-local" value={shiftEditor.planned_start} onChange={(e) => setShiftEditor((current) => (current ? { ...current, planned_start: e.target.value } : current))} /></label>
                                        <label><span>Planned End</span><input disabled={!canManageShifts} type="datetime-local" value={shiftEditor.planned_end} onChange={(e) => setShiftEditor((current) => (current ? { ...current, planned_end: e.target.value } : current))} /></label>
                                    </div>
                                    {canManageShifts ? <div className={styles.actions}>
                                        <KitchenButton disabled={busy === `save-shift-${shift.id}`} variant="primary" onClick={() => void run(`save-shift-${shift.id}`, async () => {
                                            if (!shiftEditor.shift_name.trim()) throw new Error('Shift name is required.');
                                            if (!shiftEditor.planned_start || !shiftEditor.planned_end) throw new Error('Planned start and end are required.');
                                            await posApi.updateOperatingShift(branchId, shift.id, { shift_name: shiftEditor.shift_name.trim(), planned_start: new Date(shiftEditor.planned_start).toISOString(), planned_end: new Date(shiftEditor.planned_end).toISOString() });
                                            cancelShiftEdit();
                                            toast.success('Shift Updated', 'Live shift timing has been adjusted.');
                                        })}>{busy === `save-shift-${shift.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <RefreshCcw size={14} />} Update Shift</KitchenButton>
                                        <KitchenButton variant="ghost" onClick={cancelShiftEdit}>Cancel</KitchenButton>
                                    </div> : null}
                                </div>}
                                {shift.status === 'open' && canManageTillSessions && (() => {
                                    const availableCounters = availableCountersForAssignment(shift.id);
                                    const availableCashiers = availableCashiersForAssignment(shift.id);
                                    const selectedCounterId = availableCounters.some((counter) => Number(counter.id) === Number(draft.sale_counter_id))
                                        ? draft.sale_counter_id
                                        : Number(availableCounters[0]?.id ?? 0);
                                    const selectedUserId = availableCashiers.some((cashier) => Number(cashier.id) === Number(draft.user_id))
                                        ? draft.user_id
                                        : Number(availableCashiers[0]?.id ?? 0);
                                    return <div className={styles.assign}>
                                    <select value={selectedCounterId} onChange={(e) => setShiftDrafts((s) => ({ ...s, [shift.id]: { ...shiftDraft(shift.id), sale_counter_id: Number(e.target.value) } }))}>
                                        {availableCounters.map((counter) => <option key={counter.id} value={counter.id}>{counter.name}</option>)}
                                    </select>
                                    <select value={selectedUserId} onChange={(e) => setShiftDrafts((s) => ({ ...s, [shift.id]: { ...shiftDraft(shift.id), user_id: Number(e.target.value) } }))}>
                                        {availableCashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.full_name}</option>)}
                                    </select>
                                    <input value={draft.assigned_float} onChange={(e) => setShiftDrafts((s) => ({ ...s, [shift.id]: { ...shiftDraft(shift.id), assigned_float: e.target.value } }))} placeholder="Starting cash" />
                                    <KitchenButton disabled={busy === `assign-${shift.id}` || !selectedCounterId || !selectedUserId} variant="primary" onClick={() => void run(`assign-${shift.id}`, async () => {
                                        await posApi.assignCounterSession(branchId, shift.id, { sale_counter_id: selectedCounterId, user_id: selectedUserId, assigned_float: Number(draft.assigned_float || 0) });
                                        toast.success('Counter Assigned', 'Cashier can now verify the starting cash from the cashier screen.');
                                    })}>{busy === `assign-${shift.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <Plus size={14} />} Assign Counter to Cashier</KitchenButton>
                                </div>;
                                })()}
                                {shift.status === 'open' && canManageTillSessions && (availableCountersForAssignment(shift.id).length === 0 || availableCashiersForAssignment(shift.id).length === 0) && <div className={styles.inlineEmpty}>No non-overlapping sales counter or cashier is available for a new assignment.</div>}
                                <div className={styles.stack}>
                                    {sessions.length === 0 && <div className={styles.inlineEmpty}>No sales counter is assigned to this shift yet.</div>}
                                    {sessions.length > 0 && <div className={styles.assignmentTableWrap}>
                                        <table className={styles.assignmentTable}>
                                            <thead>
                                                <tr>
                                                    <th>Sales Counter</th>
                                                    <th>Cashier</th>
                                                    <th>Opening Cash</th>
                                                    <th>Assignment Time</th>
                                                    <th>Opening Time</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sessions.map((session) => {
                                                    const isAssigned = session.workflow_status === 'assigned' && canManageTillSessions;
                                                    const draftSession = sessionDraft(session);
                                                    const availableSessionCounters = availableCountersForAssignment(session.shift_id, session.sale_counter_id);
                                                    const availableSessionCashiers = availableCashiersForAssignment(session.shift_id, session.user_id);
                                                    const selectedCounterId = availableSessionCounters.some((counter) => Number(counter.id) === Number(draftSession.sale_counter_id))
                                                        ? draftSession.sale_counter_id
                                                        : Number(availableSessionCounters[0]?.id ?? session.sale_counter_id ?? 0);
                                                    const selectedUserId = availableSessionCashiers.some((cashier) => Number(cashier.id) === Number(draftSession.user_id))
                                                        ? draftSession.user_id
                                                        : Number(availableSessionCashiers[0]?.id ?? session.user_id ?? 0);
                                                    return (
                                                        <tr key={`summary-${session.id}`}>
                                                            <td>
                                                                {isAssigned ? <select className={styles.assignmentInlineField} value={selectedCounterId} onChange={(e) => setSessionDrafts((s) => ({ ...s, [session.id]: { ...sessionDraft(session), sale_counter_id: Number(e.target.value) } }))}>{availableSessionCounters.map((counter) => <option key={counter.id} value={counter.id}>{counter.name}</option>)}</select> : <strong>{session.sale_counter?.name || `Counter #${session.sale_counter_id}`}</strong>}
                                                            </td>
                                                            <td>
                                                                {isAssigned ? <select className={styles.assignmentInlineField} value={selectedUserId} onChange={(e) => setSessionDrafts((s) => ({ ...s, [session.id]: { ...sessionDraft(session), user_id: Number(e.target.value) } }))}>{availableSessionCashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.full_name}</option>)}</select> : `${session.user?.full_name || 'Unassigned'} | ID ${session.user_id ?? '--'}`}
                                                            </td>
                                                            <td className={styles.assignmentMoneyCell}>{formatBranchMoney(session.assigned_float)}</td>
                                                            <td className={styles.assignmentTimeCell}>{sessionAssignedStamp(session)}</td>
                                                            <td className={styles.assignmentTimeCell}>{session.workflow_status === 'assigned' ? '--' : sessionOpenedStamp(session)}</td>
                                                            <td>
                                                                <div className={styles.assignmentStatusRow}>
                                                                    <span className={styles.assignmentStatus}>{describeSessionStatus(session.workflow_status)}</span>
                                                                    {isAssigned ? <KitchenButton disabled={busy === `session-${session.id}` || !selectedCounterId || !selectedUserId} variant="outline" className={styles.assignmentInlineAction} onClick={() => void run(`session-${session.id}`, async () => {
                                                                        await posApi.reassignCounterSession(branchId, session.id, { sale_counter_id: selectedCounterId, user_id: selectedUserId, assigned_float: Number(session.assigned_float || 0) });
                                                                        toast.success('Assignment Updated', 'Sales counter assignment has been updated.');
                                                                    })}>{busy === `session-${session.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <RefreshCcw size={12} />} Update</KitchenButton> : null}
                                                                    {isAssigned ? <KitchenButton disabled={busy === `unassign-${session.id}`} variant="ghost" className={styles.assignmentInlineAction} onClick={() => void run(`unassign-${session.id}`, async () => {
                                                                        await posApi.unassignCounterSession(branchId, session.id);
                                                                        toast.success('Counter Unassigned', 'The unopened sales counter has been removed from this shift.');
                                                                    })}>{busy === `unassign-${session.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <Square size={12} />} Unassign</KitchenButton> : null}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>}
                                    {sessions.length > 0 && <div className={styles.sessionTable}>
                                        <div className={styles.sessionTableHeader}>
                                            <span>Sales Counter</span>
                                            <span>Cashier</span>
                                            <span>Status</span>
                                            <span>Opened</span>
                                            <span>Closed</span>
                                        </div>
                                        {sessions.map((session) => {
                                            return (
                                                <div key={session.id} className={styles.session}>
                                                    <div className={styles.sessionTableRow}>
                                                        <span data-label="Sales Counter" className={styles.sessionTablePrimary}>{session.sale_counter?.name || `Counter #${session.sale_counter_id}`}</span>
                                                        <span data-label="Cashier">{session.user?.full_name || 'Unassigned'}</span>
                                                        <span data-label="Status">{describeSessionStatus(session.workflow_status)}</span>
                                                        <span data-label="Opened">{sessionOpenedStamp(session)}</span>
                                                        <span data-label="Closed">{sessionClosedStamp(session)}</span>
                                                    </div>
                                                    {isSessionAwaitingVerification(session) && canManageTillSessions && <div className={styles.verifyPanel}>
                                                        <div className={styles.verifyBanner}>
                                                            <div className={styles.verifyBannerIcon}><AlertTriangle size={16} /></div>
                                                            <div className={styles.verifyBannerBody}>
                                                                <strong>Legacy Final Close Required</strong>
                                                                <span>Blind close is complete. Verify the counted cash and authorize the final counter close.</span>
                                                            </div>
                                                        </div>
                                                        <div className={styles.verifySummaryGrid}>
                                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardOpening}`}>
                                                                <span>Opening Amount</span>
                                                                <strong>{formatBranchMoney(session.assigned_float)}</strong>
                                                            </div>
                                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardSales}`}>
                                                                <span>Sales Figure</span>
                                                                <strong>{formatBranchMoney(session.sales_figure)}</strong>
                                                            </div>
                                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardCounted}`}>
                                                                <span>Actual Cash Collected</span>
                                                                <strong>{formatBranchMoney(session.actual_cash_collected)}</strong>
                                                            </div>
                                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardExpected}`}>
                                                                <span>Expected Cash</span>
                                                                <strong>{formatBranchMoney(session.expected_cash)}</strong>
                                                            </div>
                                                            <div className={`${styles.verifySummaryCard} ${styles.verifySummaryCardVariance}`}>
                                                                <span>Variance</span>
                                                                <strong>{formatBranchMoney(session.variance)}</strong>
                                                            </div>
                                                        </div>
                                                        <div className={styles.verifyActionRow}>
                                                            <div className={styles.verifyFields}>
                                                                <div className={styles.verifyPinGroup}>
                                                                    <label htmlFor={`counter-close-user-${session.id}`}>Authorized User ID</label>
                                                                    <input id={`counter-close-user-${session.id}`} type="text" placeholder="Enter authorized user ID" value={authorizedUsernames[session.id] || ''} onChange={(e) => setAuthorizedUsernames((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                                </div>
                                                                <div className={styles.verifyCommentGroup}>
                                                                    <label htmlFor={`counter-close-comment-${session.id}`}>Closing Comment</label>
                                                                    <textarea id={`counter-close-comment-${session.id}`} placeholder="Enter closing comment for this sales counter" value={closeComments[session.id] ?? session.closing_comment ?? ''} onChange={(e) => setCloseComments((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                                </div>
                                                                <div className={styles.verifyPinGroup}>
                                                                    <label htmlFor={`counter-close-pin-${session.id}`}>Counter Close PIN</label>
                                                                    <input id={`counter-close-pin-${session.id}`} type="password" placeholder="Enter authorized close PIN" value={pins[session.id] || ''} onChange={(e) => setPins((s) => ({ ...s, [session.id]: e.target.value }))} />
                                                                </div>
                                                            </div>
                                                            <KitchenButton disabled={busy === `verify-${session.id}`} variant="primary" className={styles.verifySubmitButton} onClick={() => void run(`verify-${session.id}`, async () => {
                                                                await verifyAndCloseCounterSession(session);
                                                            })}>{busy === `verify-${session.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <ShieldCheck size={14} />} Finalize Legacy Close</KitchenButton>
                                                        </div>
                                                    </div>}
                                                </div>
                                            );
                                        })}
                                    </div>}
                                </div>
                            </KitchenCard>
                        );
                    })}
                        </> : null}
                </section>
            ))}

            {LEGACY_SHIFT_COMPATIBILITY_VISIBLE && activeTab === 'shifts' ? templatePanel : null}

            {activeTab === 'terminal-center' ? (
                <section className={styles.stackLg}>
                    <KitchenCard className={styles.panel}>
                        <div className={styles.panelHead}>
                            <div>
                                <h2>Terminal Center</h2>
                                <p>Manage sales counters for the active branch without leaving the operations console.</p>
                            </div>
                        </div>
                        <TerminalCenter embedded />
                    </KitchenCard>
                </section>
            ) : null}

            {activeTab === 'operations' ? (
                <section className={styles.stackLg}>
                    <KitchenCard className={`${styles.panel} ${styles.compactPanel}`}>
                        <div className={styles.panelHead}><div><h2>Recent Business Days</h2><p>Business day history with operational status and opening or closing timings.</p></div></div>
                        <div className={`${styles.stack} ${styles.compactStack}`}>
                            {businessDayHistory.totalItems === 0 && <div className={styles.inlineEmpty}>No recent business days found.</div>}
                            {businessDayHistory.totalItems > 0 && <>
                                <div className={styles.sessionTable}>
                                    <div className={`${styles.sessionTableHeader} ${styles.historyBusinessDayHeader}`}>
                                        <span>Business Day</span>
                                        <span>Business Date</span>
                                        <span>Status</span>
                                        <span>Opened</span>
                                        <span>Closed</span>
                                        <span>Report</span>
                                    </div>
                                    {businessDayHistory.rows.map((day) => (
                                        <div className={`${styles.sessionTableRow} ${styles.historyBusinessDayRow}`} key={day.id}>
                                            <span data-label="Business Day" className={styles.sessionTablePrimary}>{day.title || `Business Day #${day.id}`}</span>
                                            <span data-label="Business Date">{displayDate(day.business_date)}</span>
                                            <span data-label="Status">{describeBusinessDayStatus(day.status)}</span>
                                            <span data-label="Opened">{shortStamp(day.opened_at)}</span>
                                            <span data-label="Closed">{shortStamp(day.closed_at)}</span>
                                            <span data-label="Report" className={styles.sessionTablePrimaryAction}>
                                                {day.closed_at ? (
                                                    canPrintOperationalReports ? (
                                                        <KitchenButton variant="ghost" disabled={busy === `print-day-z-${day.id}`} onClick={() => setZReportDay(day)}>
                                                            {busy === `print-day-z-${day.id}` ? <Loader2 className={styles.spinMini} size={14} /> : <Printer size={14} />} Print Z-Report
                                                        </KitchenButton>
                                                    ) : '--'
                                                ) : '--'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.paginationBar}>
                                    <span className={styles.paginationMeta}>Showing {businessDayHistory.rows.length} of {businessDayHistory.totalItems} business days</span>
                                    <div className={styles.paginationControls}>
                                        <KitchenButton variant="ghost" disabled={businessDayHistory.page <= 1} onClick={() => setBusinessDayPage((page) => Math.max(1, page - 1))}>Previous</KitchenButton>
                                        <span className={styles.paginationPage}>Page {businessDayHistory.page} of {businessDayHistory.totalPages}</span>
                                        <KitchenButton variant="ghost" disabled={businessDayHistory.page >= businessDayHistory.totalPages} onClick={() => setBusinessDayPage((page) => Math.min(businessDayHistory.totalPages, page + 1))}>Next</KitchenButton>
                                    </div>
                                </div>
                            </>}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.panel} ${styles.compactPanel}`}>
                        <div className={styles.panelHead}>
                            <div>
                                <h2>Accounting Close History</h2>
                                <p>Finance-close records for this branch with cash variance, notes, and direct accounting review paths.</p>
                            </div>
                        </div>
                        <div className={`${styles.stack} ${styles.compactStack}`}>
                            {accountingCloseHistoryPaged.totalItems === 0 && <div className={styles.inlineEmpty}>No accounting close history found for this branch yet.</div>}
                            {accountingCloseHistoryPaged.totalItems > 0 && <>
                                <div className={styles.sessionTable}>
                                    <div className={`${styles.sessionTableHeader} ${styles.historyAccountingHeader}`}>
                                        <span>Business Date</span>
                                        <span>Closed By</span>
                                        <span>Close Summary</span>
                                        <span>Cash Control</span>
                                        <span>Status</span>
                                        <span>Review</span>
                                    </div>
                                    {accountingCloseHistoryPaged.rows.map((entry) => {
                                        const expectedCash = Number(entry.expected_cash_amount ?? 0);
                                        const actualCash = Number(entry.actual_cash_amount ?? 0);
                                        const variance = actualCash - expectedCash;
                                        const noteText = String(entry.notes || '').trim();
                                        return (
                                            <div className={`${styles.sessionTableRow} ${styles.historyAccountingRow}`} key={entry.id}>
                                                <span data-label="Business Date" className={styles.sessionTablePrimary}>
                                                    <span className={styles.historyAccountingPrimary}>{displayDate(entry.business_date)}</span>
                                                    <span className={styles.historyAccountingMeta}>{shortStamp(entry.closed_at)}</span>
                                                </span>
                                                <span data-label="Closed By">
                                                    <span className={styles.historyAccountingPrimary}>{entry.closed_by_name || 'System'}</span>
                                                    <span className={styles.historyAccountingMeta}>{entry.journal_count || 0} journals linked</span>
                                                </span>
                                                <span data-label="Close Summary">
                                                    <span className={styles.historyAccountingPrimary}>{formatBranchMoney(Number(entry.net_sales ?? 0))}</span>
                                                    <span className={styles.historyAccountingMeta}>Net sales</span>
                                                </span>
                                                <span data-label="Cash Control">
                                                    <span className={styles.historyAccountingPrimary}>{formatBranchMoney(actualCash)} actual</span>
                                                    <span className={styles.historyAccountingMeta}>
                                                        {formatBranchMoney(expectedCash)} expected | {formatBranchMoney(variance)} variance
                                                    </span>
                                                </span>
                                                <span data-label="Status">
                                                    <span className={`${styles.accountingCloseStatus} ${styles[`accountingCloseStatus${String(entry.review_status || 'clean_close').toLowerCase()}`] || ''}`}>
                                                        {describeAccountingCloseStatus(entry.review_status)}
                                                    </span>
                                                    <span className={styles.historyAccountingMeta}>
                                                        {noteText ? 'Notes recorded' : 'No close note'}
                                                    </span>
                                                </span>
                                                <span data-label="Review" className={styles.sessionTablePrimaryAction}>
                                                    <div className={styles.historyAccountingActions}>
                                                        <KitchenButton variant="ghost" onClick={() => navigate('/console/accounting/settings')}>
                                                            Governance
                                                        </KitchenButton>
                                                        <KitchenButton variant="ghost" onClick={() => navigate('/console/accounting/reports')}>
                                                            Reports
                                                        </KitchenButton>
                                                    </div>
                                                    {noteText ? <div className={styles.accountingCloseNotes}>{noteText}</div> : null}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className={styles.paginationBar}>
                                    <span className={styles.paginationMeta}>Showing {accountingCloseHistoryPaged.rows.length} of {accountingCloseHistoryPaged.totalItems} accounting closes</span>
                                    <div className={styles.paginationControls}>
                                        <KitchenButton variant="ghost" disabled={accountingCloseHistoryPaged.page <= 1} onClick={() => setAccountingCloseHistoryPage((page) => Math.max(1, page - 1))}>Previous</KitchenButton>
                                        <span className={styles.paginationPage}>Page {accountingCloseHistoryPaged.page} of {accountingCloseHistoryPaged.totalPages}</span>
                                        <KitchenButton variant="ghost" disabled={accountingCloseHistoryPaged.page >= accountingCloseHistoryPaged.totalPages} onClick={() => setAccountingCloseHistoryPage((page) => Math.min(accountingCloseHistoryPaged.totalPages, page + 1))}>Next</KitchenButton>
                                    </div>
                                </div>
                            </>}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.panel} ${styles.compactPanel}`}>
                        <div className={styles.panelHead}><div><h2>Recent Counter Sessions</h2><p>Branch-wide recent sales counter activity with cashier, status, and open or close timings.</p></div></div>
                        <div className={`${styles.stack} ${styles.compactStack}`}>
                            {counterHistory.totalItems === 0 && <div className={styles.inlineEmpty}>No recent counter sessions found.</div>}
                            {counterHistory.totalItems > 0 && <>
                                <div className={styles.sessionTable}>
                                    <div className={styles.sessionTableHeader}>
                                        <span>Sales Counter</span>
                                        <span>Cashier</span>
                                        <span>Status</span>
                                        <span>Opened</span>
                                        <span>Closed</span>
                                        <span>Report</span>
                                    </div>
                                    {counterHistory.rows.map((session) => (
                                        <div className={styles.sessionTableRow} key={session.id}>
                                            <span data-label="Sales Counter" className={`${styles.sessionTablePrimary} ${styles.sessionTablePrimaryRow}`}>
                                                <span className={styles.sessionTablePrimaryName}>
                                                    {session.sale_counter?.name || `Counter #${session.sale_counter_id}`}
                                                </span>
                                            </span>
                                            <span data-label="Cashier">{session.user?.full_name || 'Unassigned'}</span>
                                            <span data-label="Status">{describeSessionStatus(session.workflow_status)}</span>
                                            <span data-label="Opened">{sessionOpenedStamp(session)}</span>
                                            <span data-label="Closed">{sessionClosedStamp(session)}</span>
                                            <span data-label="Report" className={styles.sessionTablePrimaryAction}>
                                                {sessionClosedStamp(session) !== '--' ? (
                                                    canPrintOperationalReports ? (
                                                        <KitchenButton variant="ghost" onClick={() => setXReportSessionId(session.id)}>
                                                            <Printer size={14} /> Print X-Report
                                                        </KitchenButton>
                                                    ) : '--'
                                                ) : '--'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.paginationBar}>
                                    <span className={styles.paginationMeta}>Showing {counterHistory.rows.length} of {counterHistory.totalItems} counter sessions</span>
                                    <div className={styles.paginationControls}>
                                        <KitchenButton variant="ghost" disabled={counterHistory.page <= 1} onClick={() => setCounterHistoryPage((page) => Math.max(1, page - 1))}>Previous</KitchenButton>
                                        <span className={styles.paginationPage}>Page {counterHistory.page} of {counterHistory.totalPages}</span>
                                        <KitchenButton variant="ghost" disabled={counterHistory.page >= counterHistory.totalPages} onClick={() => setCounterHistoryPage((page) => Math.min(counterHistory.totalPages, page + 1))}>Next</KitchenButton>
                                    </div>
                                </div>
                            </>}
                        </div>
                    </KitchenCard>
                </section>
            ) : null}

            <XReportPrintModal
                isOpen={canPrintOperationalReports && xReportSessionId !== null}
                defaultFormat="thermal-80mm"
                onClose={() => setXReportSessionId(null)}
                onPrint={(format) => {
                    if (xReportSessionId !== null) {
                        void printCounterXReport(xReportSessionId, `Counter Close ${xReportSessionId}`, format);
                    }
                    setXReportSessionId(null);
                }}
            />
            <XReportPrintModal
                isOpen={canPrintOperationalReports && zReportDay !== null}
                title="Print Business Day Z-Report"
                description="Choose a paper size for the business day closing report."
                defaultFormat="thermal-80mm"
                onClose={() => setZReportDay(null)}
                onPrint={(format) => {
                    if (zReportDay) {
                        void printBusinessDayZReport(zReportDay, `print-day-z-${zReportDay.id}`, format);
                    }
                    setZReportDay(null);
                }}
            />
        </div>
    );
}
