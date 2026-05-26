/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, BarChart2, Building2, Calendar, FileText, Lock, Printer } from 'lucide-react';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { accountingApi, branchApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredDocumentNumber } from '../pos/printTemplates/printHelpers';
import styles from './FinancialReports.module.css';

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
    updated_by?: string | null;
};
type DailyReportsView = 'overview' | 'reports';
type ReportDefinition = {
    id: string;
    name: string;
    category: string;
    description: string;
    scopeNote?: string;
    requiresSingleBranch?: boolean;
};
type ReportColumn<T> = {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => string | number | null | undefined;
};

const PERIOD_OPTIONS = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Financial Year' },
    { value: 'custom', label: 'Custom Range' },
];

function getBranchRowId(branch: any): number | null {
    const value = branch?.branch_id ?? branch?.id ?? null;
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function getBranchRowName(branch: any): string {
    return branch?.branch_name || branch?.name || `Branch ${getBranchRowId(branch) ?? ''}`.trim();
}

const REPORT_LIBRARY: ReportDefinition[] = [
    {
        id: 'daily-finance-control',
        name: 'Daily Finance Control Summary',
        category: 'Management Control',
        description: 'A branch finance control pack for receivables, payables, payroll exposure, treasury exceptions, and compliance payable.',
    },
    {
        id: 'receivables-aging',
        name: 'Receivables Aging Report',
        category: 'Collections',
        description: 'Industry-standard customer aging for overdue follow-up, event receivable collection, and credit control.',
    },
    {
        id: 'payables-aging',
        name: 'Payables Aging Report',
        category: 'Payables',
        description: 'Vendor and expense payable aging for procurement control, overdue settlement review, and working-capital planning.',
    },
    {
        id: 'treasury-position',
        name: 'Treasury Position Report',
        category: 'Treasury',
        description: 'Treasury balances, movement mix, recent activity, and cash-office control points for bank and cash operations.',
    },
    {
        id: 'merchant-settlement',
        name: 'Merchant Settlement Review',
        category: 'Treasury',
        description: 'Pending card and wallet settlement monitoring by provider and channel for food delivery and event payment collections.',
    },
    {
        id: 'treasury-exceptions',
        name: 'Treasury Exception Report',
        category: 'Treasury',
        description: 'Open treasury exceptions that still need finance action before close or settlement sign-off.',
    },
    {
        id: 'voucher-register',
        name: 'Voucher Register',
        category: 'Expenses',
        description: 'Payment, receipt, and journal voucher register for day-to-day accounting review and audit trail printing.',
    },
    {
        id: 'payment-voucher-exceptions',
        name: 'Payment Voucher Exception Report',
        category: 'Expenses',
        description: 'Exception-focused review of payment vouchers that require finance correction or approval follow-up.',
    },
    {
        id: 'petty-cash',
        name: 'Petty Cash Activity Report',
        category: 'Cash Control',
        description: 'Petty-cash balances, expense movement, and pending cash entries for cashier and branch cash review.',
    },
    {
        id: 'payroll-register',
        name: 'Payroll Register',
        category: 'Payroll',
        description: 'Payroll run register with gross-to-net control totals for operational payroll finance review.',
    },
    {
        id: 'payroll-compliance-review',
        name: 'Payroll Compliance Liability Report',
        category: 'Payroll',
        description: 'Statutory payroll liabilities, deductions, and settlements for compliance monitoring.',
        scopeNote: 'Requires a single branch selection.',
        requiresSingleBranch: true,
    },
    {
        id: 'payroll-compliance-filings',
        name: 'Payroll Filing Tracker',
        category: 'Payroll',
        description: 'Filing status tracker for EOBI, social security, tax, and related payroll compliance submissions.',
        scopeNote: 'Requires a single branch selection.',
        requiresSingleBranch: true,
    },
];

function formatPKR(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCompactNumber(value: number): string {
    return Number(value || 0).toLocaleString('en-PK');
}

function formatRatio(value: number): string {
    return `${Number(value || 0).toFixed(1)}%`;
}

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function getPresetRange(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (preset === 'last_month') {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }

    if (preset === 'this_quarter') {
        const quarterStartMonth = Math.floor(month / 3) * 3;
        return {
            dateFrom: toIsoDate(new Date(year, quarterStartMonth, 1)),
            dateTo: toIsoDate(today),
        };
    }

    if (preset === 'this_year') {
        return {
            dateFrom: `${year}-01-01`,
            dateTo: toIsoDate(today),
        };
    }

    return {
        dateFrom: toIsoDate(new Date(year, month, 1)),
        dateTo: toIsoDate(today),
    };
}

function formatPayableSourceLabel(value?: string | null): string {
    if (value === 'expense_voucher') return 'Urgent Credit Expense';
    if (value === 'grn') return 'Stock / Vendor Bill';
    return 'Mixed AP';
}

function sanitizeText(value: any, fallback = '-'): string {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function buildReportScopeLabel(dateFrom: string, dateTo: string): string {
    return `${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
}

function ReportTable<T extends Record<string, any>>({
    rows,
    columns,
    emptyMessage = 'No rows found for the selected report scope.',
}: {
    rows: T[];
    columns: ReportColumn<T>[];
    emptyMessage?: string;
}) {
    return (
        <table className={styles.printTable}>
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th
                            key={column.key}
                            className={column.align === 'right' ? styles.alignRight : column.align === 'center' ? styles.alignCenter : undefined}
                        >
                            {column.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className={styles.emptyPrintRow}>
                            {emptyMessage}
                        </td>
                    </tr>
                ) : rows.map((row, index) => (
                    <tr key={String(row.id ?? row.key ?? index)}>
                        {columns.map((column) => (
                            <td
                                key={`${String(row.id ?? row.key ?? index)}-${column.key}`}
                                className={column.align === 'right' ? styles.alignRight : column.align === 'center' ? styles.alignCenter : undefined}
                            >
                                {column.render ? column.render(row) : sanitizeText(row[column.key])}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ReportMetricGrid({
    items,
}: {
    items: Array<{ label: string; value: string; note?: string }>;
}) {
    return (
        <div className={styles.printMetricGrid}>
            {items.map((item) => (
                <div key={item.label} className={styles.printMetricCard}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.note ? <small>{item.note}</small> : null}
                </div>
            ))}
        </div>
    );
}

function ReportSection({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <section className={styles.printSection}>
            <div className={styles.printSectionHeader}>
                <div>
                    <h3>{title}</h3>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
            </div>
            {children}
        </section>
    );
}

function AgingReviewPanel({
    title,
    badge,
    data,
    highlighted = false,
    onReview,
}: {
    title: string;
    badge: string;
    data: any;
    highlighted?: boolean;
    onReview?: (() => void) | null;
}) {
    const documents = data?.documents ?? [];
    const summary = data?.summary ?? {};
    const showPayableSourceSplit = badge === 'AP';

    return (
        <div className={`${styles.agingPanel} ${highlighted ? styles.agingPanelFocused : ''}`}>
            <div className={styles.agingPanelHeader}>
                <div>
                    <h4>{title}</h4>
                    <span>As of {formatDate(data?.as_of_date)}</span>
                </div>
                <div className={styles.agingPanelActions}>
                    {onReview ? (
                        <button type="button" className={styles.agingReviewBtn} onClick={onReview}>
                            Review Queue
                        </button>
                    ) : null}
                    <span className={styles.agingBadge}>{badge}</span>
                </div>
            </div>
            <div className={styles.agingMetricGrid}>
                <div className={styles.agingMetric}>
                    <span>Outstanding</span>
                    <strong>{formatPKR(Number(summary.total_outstanding ?? 0))}</strong>
                </div>
                <div className={styles.agingMetric}>
                    <span>Overdue</span>
                    <strong>{formatPKR(Number(summary.overdue_amount ?? 0))}</strong>
                </div>
                <div className={styles.agingMetric}>
                    <span>Documents</span>
                    <strong>{formatCompactNumber(Number(summary.document_count ?? 0))}</strong>
                </div>
                <div className={styles.agingMetric}>
                    <span>Overdue Docs</span>
                    <strong>{formatCompactNumber(Number(summary.overdue_count ?? 0))}</strong>
                </div>
            </div>
            <div className={styles.agingTopRisk}>
                <span>Top Overdue Party</span>
                <strong>{summary.top_overdue_party_name || 'None'}</strong>
                <span>{formatPKR(Number(summary.top_overdue_party_amount ?? 0))}</span>
            </div>
            {showPayableSourceSplit && (
                <div className={styles.agingSourceSplit}>
                    <div className={styles.agingSourceCard}>
                        <span>Stock / Vendor Bills</span>
                        <strong>{formatPKR(Number(summary.grn_outstanding_amount ?? 0))}</strong>
                        <small>{formatCompactNumber(Number(summary.grn_document_count ?? 0))} open documents</small>
                    </div>
                    <div className={styles.agingSourceCard}>
                        <span>Urgent Credit Expenses</span>
                        <strong>{formatPKR(Number(summary.expense_voucher_outstanding_amount ?? 0))}</strong>
                        <small>{formatCompactNumber(Number(summary.expense_voucher_document_count ?? 0))} open documents</small>
                    </div>
                </div>
            )}
            <div className={styles.agingBuckets}>
                <span>Current {formatPKR(Number(summary.current ?? 0))}</span>
                <span>1-30 {formatPKR(Number(summary.days_1_30 ?? 0))}</span>
                <span>31-60 {formatPKR(Number(summary.days_31_60 ?? 0))}</span>
                <span>61-90 {formatPKR(Number(summary.days_61_90 ?? 0))}</span>
                <span>90+ {formatPKR(Number(summary.days_90_plus ?? 0))}</span>
            </div>
            <div className={styles.agingDocumentList}>
                {documents.slice(0, 5).map((document: any) => (
                    <div key={`${title}-${document.id}`} className={styles.agingDocumentRow}>
                        <div>
                            <strong>{document.party_name}</strong>
                            <span>
                                {formatConfiguredDocumentNumber(document.document_no, document, { preserveTypePrefix: true }) || document.document_no}
                                {document.reference ? ` - ${document.reference}` : ''}
                                {document.payable_type ? ` - ${formatPayableSourceLabel(document.payable_type)}` : ''}
                            </span>
                        </div>
                        <div className={styles.agingDocumentMeta}>
                            <strong>{formatPKR(Number(document.outstanding_amount ?? 0))}</strong>
                            <span>{Number(document.days_past_due ?? 0) > 0 ? `${document.days_past_due} days overdue` : 'Current'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DailyAccountingReports() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const { branches, activeBranch } = useBranchContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedBranch, setSelectedBranch] = useState(
        searchParams.get('branch_id')
            || (activeBranch ? String(activeBranch.branch_id ?? (activeBranch as any).id ?? 'all') : 'all'),
    );
    const [activeView, setActiveView] = useState<DailyReportsView>('overview');
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
    const [dateFrom, setDateFrom] = useState(getPresetRange('this_month').dateFrom);
    const [dateTo, setDateTo] = useState(getPresetRange('this_month').dateTo);
    const [profitAndLoss, setProfitAndLoss] = useState<any>(null);
    const [receivablesAging, setReceivablesAging] = useState<any>(null);
    const [payablesAging, setPayablesAging] = useState<any>(null);
    const [dashboardSummary, setDashboardSummary] = useState<any>(null);
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [availableBranches, setAvailableBranches] = useState<any[]>(branches);
    const [selectedReportId, setSelectedReportId] = useState<string>('daily-finance-control');
    const [reportPayload, setReportPayload] = useState<any>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
    const reportFocus = searchParams.get('focus');

    useEffect(() => {
        setAvailableBranches(branches);
    }, [branches]);

    useEffect(() => {
        let mounted = true;

        const loadBranches = async () => {
            try {
                const rows = await branchApi.getBranches();
                if (!mounted) {
                    return;
                }
                const next = Array.isArray(rows) ? rows : [];
                if (next.length > 0) {
                    setAvailableBranches(next);
                }
            } catch {
                if (mounted) {
                    setAvailableBranches((current) => current);
                }
            }
        };

        if ((branches ?? []).length === 0) {
            void loadBranches();
        }

        return () => {
            mounted = false;
        };
    }, [branches]);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...availableBranches
                .map((branch) => {
                    const branchId = getBranchRowId(branch);
                    return branchId
                        ? { value: String(branchId), label: getBranchRowName(branch) }
                        : null;
                })
                .filter(Boolean) as Array<{ value: string; label: string }>,
        ],
        [availableBranches],
    );

    useEffect(() => {
        if (periodPreset === 'custom') return;
        const range = getPresetRange(periodPreset);
        setDateFrom(range.dateFrom);
        setDateTo(range.dateTo);
    }, [periodPreset]);

    useEffect(() => {
        const load = async () => {
            if (!dateFrom || !dateTo) return;
            setLoading(true);
            setError(null);
            try {
                const branchId = selectedBranch === 'all' ? null : selectedBranch;
                const asOfDate = dateTo;
                const [receivablesResponse, payablesResponse, dashboardResponse, periodLockResponse, plResponse] = await Promise.all([
                    accountingApi.getReceivablesAging({ branch_id: branchId, as_of_date: asOfDate }),
                    accountingApi.getPayablesAging({ branch_id: branchId, as_of_date: asOfDate }),
                    accountingApi.getDashboard({ branch_id: branchId }),
                    accountingApi.getPeriodLock({ branch_id: branchId ?? activeBranch?.branch_id ?? null }),
                    accountingApi.getPL({ branch_id: branchId, date_from: dateFrom, date_to: dateTo }),
                ]);

                setReceivablesAging(receivablesResponse);
                setPayablesAging(payablesResponse);
                setDashboardSummary(dashboardResponse ?? null);
                setPeriodLock(periodLockResponse ?? null);
                setProfitAndLoss(plResponse);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load daily accounting reports');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [selectedBranch, dateFrom, dateTo, activeBranch?.branch_id]);

    const branchLabel = selectedBranch === 'all'
        ? 'Consolidated - All Branches'
        : branchOptions.find((branch) => branch.value === selectedBranch)?.label || 'Selected Branch';
    const closeReadiness = dashboardSummary?.close_readiness ?? null;
    const dashboardLaborCosting = dashboardSummary?.labor_costing ?? null;
    const dashboardPayrollCompliance = dashboardSummary?.payroll_compliance ?? null;
    const hasDrillthroughScope = searchParams.get('origin') === 'month_close' || reportFocus === 'payables';
    const selectedPeriodRevenue = useMemo(
        () => Number(profitAndLoss?.summary?.total_revenue ?? 0),
        [profitAndLoss?.summary?.total_revenue],
    );
    const selectedPeriodLaborCost = useMemo(
        () => (profitAndLoss?.accounts ?? [])
            .filter((account: any) => account.account_type === 'expense'
                && (account.account_code === '5200'
                    || account.schedule_code === 'PL_PAYROLL'
                    || String(account.account_name || '').toLowerCase().includes('salary')
                    || String(account.account_name || '').toLowerCase().includes('wage')))
            .reduce((sum: number, account: any) => sum + Number(account.net_balance ?? 0), 0),
        [profitAndLoss?.accounts],
    );
    const payrollPayableBalance = useMemo(
        () => Number(dashboardLaborCosting?.payroll_payable_balance ?? 0),
        [dashboardLaborCosting?.payroll_payable_balance],
    );
    const selectedPeriodLaborRatio = selectedPeriodRevenue > 0 ? (selectedPeriodLaborCost / selectedPeriodRevenue) * 100 : 0;
    const selectedReport = useMemo(
        () => REPORT_LIBRARY.find((report) => report.id === selectedReportId) || REPORT_LIBRARY[0],
        [selectedReportId],
    );
    const reportRequiresSingleBranch = selectedReport?.requiresSingleBranch === true;
    const canRunSelectedReport = !reportRequiresSingleBranch || selectedBranch !== 'all';

    const summaryCards = useMemo(() => ([
        {
            label: 'Receivables Outstanding',
            value: Number(receivablesAging?.summary?.total_outstanding ?? 0),
            subLabel: `${Number(receivablesAging?.summary?.document_count ?? 0)} open customer balances`,
            tone: 'neutral',
        },
        {
            label: 'Payables Outstanding',
            value: Number(payablesAging?.summary?.total_outstanding ?? 0),
            subLabel: `${Number(payablesAging?.summary?.overdue_count ?? 0)} overdue documents`,
            tone: 'warning',
        },
        {
            label: 'Payroll Payable',
            value: payrollPayableBalance,
            subLabel: `${Number(dashboardLaborCosting?.approved_unpaid_runs ?? 0)} approved unpaid runs`,
            tone: 'warning',
        },
        {
            label: 'Labor Cost Ratio',
            value: Number(selectedPeriodLaborCost ?? 0),
            subLabel: `${selectedPeriodLaborRatio.toFixed(1)}% of selected-period revenue`,
            tone: 'neutral',
        },
        {
            label: 'Treasury Exceptions',
            value: Number(closeReadiness?.treasury_exception_amount ?? 0),
            subLabel: `${Number(closeReadiness?.treasury_exception_count ?? 0)} open items`,
            tone: Number(closeReadiness?.treasury_exception_count ?? 0) > 0 ? 'negative' : 'positive',
        },
        {
            label: 'Payroll Compliance Payable',
            value: Number(closeReadiness?.payroll_compliance_payable_amount ?? dashboardPayrollCompliance?.statutory_payable_balance ?? 0),
            subLabel: `${Number(closeReadiness?.payroll_compliance_open_item_count ?? 0)} open compliance items`,
            tone: Number(closeReadiness?.payroll_compliance_open_item_count ?? 0) > 0 ? 'warning' : 'positive',
        },
    ]), [receivablesAging, payablesAging, payrollPayableBalance, dashboardLaborCosting?.approved_unpaid_runs, selectedPeriodLaborCost, selectedPeriodLaborRatio, closeReadiness, dashboardPayrollCompliance?.statutory_payable_balance]);

    const clearDrillthrough = () => {
        setSearchParams({});
    };

    const buildPayrollReviewPath = () => {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') {
            params.set('branch_id', selectedBranch);
        }
        return `${consoleBase}/accounting/payroll${params.toString() ? `?${params.toString()}` : ''}`;
    };

    const reportScope = buildReportScopeLabel(dateFrom, dateTo);

    const buildDailyFinanceControlPayload = useCallback(() => ({
        summaryCards,
        receivablesAging,
        payablesAging,
        dashboardLaborCosting,
        dashboardPayrollCompliance,
        closeReadiness,
        selectedPeriodLaborCost,
        selectedPeriodLaborRatio,
        payrollPayableBalance,
        branchLabel,
        dateFrom,
        dateTo,
    }), [
        summaryCards,
        receivablesAging,
        payablesAging,
        dashboardLaborCosting,
        dashboardPayrollCompliance,
        closeReadiness,
        selectedPeriodLaborCost,
        selectedPeriodLaborRatio,
        payrollPayableBalance,
        branchLabel,
        dateFrom,
        dateTo,
    ]);

    const runReport = useCallback(async (reportId = selectedReportId) => {
        if (!dateFrom || !dateTo) {
            return;
        }

        const reportDefinition = REPORT_LIBRARY.find((entry) => entry.id === reportId) || REPORT_LIBRARY[0];
        const branchId = selectedBranch === 'all' ? null : selectedBranch;

        if (reportDefinition.requiresSingleBranch && !branchId) {
            setReportPayload(null);
            setReportError('Select a specific branch to run this report.');
            return;
        }

        setReportLoading(true);
        setReportError(null);

        try {
            let payload: any = null;

            switch (reportId) {
                case 'daily-finance-control':
                    payload = buildDailyFinanceControlPayload();
                    break;
                case 'receivables-aging':
                    payload = await accountingApi.getReceivablesAging({ branch_id: branchId, as_of_date: dateTo });
                    break;
                case 'payables-aging':
                    payload = await accountingApi.getPayablesAging({ branch_id: branchId, as_of_date: dateTo });
                    break;
                case 'treasury-position':
                    payload = await accountingApi.getTreasuryOverview({ branch_id: branchId });
                    break;
                case 'merchant-settlement':
                    payload = await accountingApi.getMerchantSettlementReview({ branch_id: branchId });
                    break;
                case 'treasury-exceptions':
                    payload = await accountingApi.getTreasuryExceptionWorkflow({ branch_id: branchId });
                    break;
                case 'voucher-register':
                    payload = await accountingApi.getFinancialVouchers({ branch_id: branchId });
                    break;
                case 'payment-voucher-exceptions':
                    payload = await accountingApi.getPaymentVoucherExceptions({ branch_id: branchId });
                    break;
                case 'petty-cash':
                    payload = await accountingApi.getPettyCashOverview({ branch_id: branchId, date_from: dateFrom, date_to: dateTo });
                    break;
                case 'payroll-register':
                    payload = await accountingApi.getPayrollRuns({
                        branch_id: branchId,
                        period_start: dateFrom,
                        period_end: dateTo,
                    });
                    break;
                case 'payroll-compliance-review':
                    payload = await accountingApi.getPayrollComplianceReview({ branch_id: Number(branchId) });
                    break;
                case 'payroll-compliance-filings':
                    payload = await accountingApi.getPayrollComplianceFilings({ branch_id: Number(branchId) });
                    break;
                default:
                    payload = buildDailyFinanceControlPayload();
                    break;
            }

            setReportPayload(payload);
            setReportGeneratedAt(new Date().toISOString());
        } catch (err) {
            setReportPayload(null);
            setReportError(err instanceof Error ? err.message : 'Unable to run selected report');
        } finally {
            setReportLoading(false);
        }
    }, [selectedReportId, selectedBranch, dateFrom, dateTo, buildDailyFinanceControlPayload]);

    useEffect(() => {
        setReportPayload(null);
        setReportGeneratedAt(null);
        setReportError(null);
    }, [selectedReportId, selectedBranch, dateFrom, dateTo]);

    useEffect(() => {
        if (loading || error || reportPayload || reportLoading) {
            return;
        }
        if (!canRunSelectedReport) {
            setReportError('Select a specific branch to run this report.');
            return;
        }
        void runReport(selectedReportId);
    }, [loading, error, reportPayload, reportLoading, canRunSelectedReport, runReport, selectedReportId]);

    const printReport = () => {
        window.print();
    };

    const renderReportPreview = () => {
        if (reportLoading) {
            return (
                <div className={styles.reportSheetState}>
                    <span>Running report...</span>
                </div>
            );
        }

        if (reportError) {
            return (
                <div className={styles.reportSheetState}>
                    <AlertCircle size={16} />
                    <span>{reportError}</span>
                </div>
            );
        }

        if (!reportPayload) {
            return (
                <div className={styles.reportSheetState}>
                    <span>Select a report and run it to generate an A4 print preview.</span>
                </div>
            );
        }

        if (selectedReportId === 'daily-finance-control') {
            const payload = reportPayload;
            return (
                <>
                    <ReportMetricGrid
                        items={(payload.summaryCards ?? []).map((card: any) => ({
                            label: card.label,
                            value: formatPKR(Number(card.value ?? 0)),
                            note: card.subLabel,
                        }))}
                    />
                    <ReportSection
                        title="Collections and Payables Control"
                        subtitle="Core outstanding balance review for customer follow-up and vendor settlement planning."
                    >
                        <ReportTable
                            rows={[
                                {
                                    area: 'Receivables',
                                    outstanding: Number(payload.receivablesAging?.summary?.total_outstanding ?? 0),
                                    overdue: Number(payload.receivablesAging?.summary?.overdue_amount ?? 0),
                                    documents: Number(payload.receivablesAging?.summary?.document_count ?? 0),
                                    topParty: sanitizeText(payload.receivablesAging?.summary?.top_overdue_party_name, 'None'),
                                },
                                {
                                    area: 'Payables',
                                    outstanding: Number(payload.payablesAging?.summary?.total_outstanding ?? 0),
                                    overdue: Number(payload.payablesAging?.summary?.overdue_amount ?? 0),
                                    documents: Number(payload.payablesAging?.summary?.document_count ?? 0),
                                    topParty: sanitizeText(payload.payablesAging?.summary?.top_overdue_party_name, 'None'),
                                },
                            ]}
                            columns={[
                                { key: 'area', label: 'Control Area' },
                                { key: 'outstanding', label: 'Outstanding', align: 'right', render: (row) => formatPKR(Number(row.outstanding ?? 0)) },
                                { key: 'overdue', label: 'Overdue', align: 'right', render: (row) => formatPKR(Number(row.overdue ?? 0)) },
                                { key: 'documents', label: 'Documents', align: 'right', render: (row) => formatCompactNumber(Number(row.documents ?? 0)) },
                                { key: 'topParty', label: 'Top Overdue Party' },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection
                        title="Payroll and Treasury Exposure"
                        subtitle="Daily finance watchlist for payroll settlement pressure, treasury exceptions, and statutory liabilities."
                    >
                        <ReportTable
                            rows={[
                                {
                                    area: 'Payroll Payable',
                                    value: Number(payload.payrollPayableBalance ?? 0),
                                    note: `${Number(payload.dashboardLaborCosting?.approved_unpaid_runs ?? 0)} approved unpaid runs`,
                                },
                                {
                                    area: 'Labor Cost Ratio',
                                    value: Number(payload.selectedPeriodLaborCost ?? 0),
                                    note: `${formatRatio(Number(payload.selectedPeriodLaborRatio ?? 0))} of selected-period revenue`,
                                },
                                {
                                    area: 'Treasury Exceptions',
                                    value: Number(payload.closeReadiness?.treasury_exception_amount ?? 0),
                                    note: `${Number(payload.closeReadiness?.treasury_exception_count ?? 0)} open items`,
                                },
                                {
                                    area: 'Compliance Payable',
                                    value: Number(payload.closeReadiness?.payroll_compliance_payable_amount ?? payload.dashboardPayrollCompliance?.statutory_payable_balance ?? 0),
                                    note: `${Number(payload.closeReadiness?.payroll_compliance_open_item_count ?? 0)} open compliance items`,
                                },
                            ]}
                            columns={[
                                { key: 'area', label: 'Exposure' },
                                { key: 'value', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.value ?? 0)) },
                                { key: 'note', label: 'Operational Note' },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'receivables-aging' || selectedReportId === 'payables-aging') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const documents = Array.isArray(payload?.documents) ? payload.documents : [];
            const isReceivable = selectedReportId === 'receivables-aging';

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Outstanding', value: formatPKR(Number(summary.total_outstanding ?? 0)) },
                            { label: 'Overdue', value: formatPKR(Number(summary.overdue_amount ?? 0)) },
                            { label: 'Documents', value: formatCompactNumber(Number(summary.document_count ?? 0)) },
                            { label: 'Overdue Documents', value: formatCompactNumber(Number(summary.overdue_count ?? 0)) },
                        ]}
                    />
                    <ReportSection title="Aging Bucket Distribution" subtitle="Outstanding balances grouped into standard aging buckets.">
                        <ReportTable
                            rows={[
                                {
                                    current: Number(summary.current ?? 0),
                                    days_1_30: Number(summary.days_1_30 ?? 0),
                                    days_31_60: Number(summary.days_31_60 ?? 0),
                                    days_61_90: Number(summary.days_61_90 ?? 0),
                                    days_90_plus: Number(summary.days_90_plus ?? 0),
                                },
                            ]}
                            columns={[
                                { key: 'current', label: 'Current', align: 'right', render: (row) => formatPKR(row.current) },
                                { key: 'days_1_30', label: '1-30 Days', align: 'right', render: (row) => formatPKR(row.days_1_30) },
                                { key: 'days_31_60', label: '31-60 Days', align: 'right', render: (row) => formatPKR(row.days_31_60) },
                                { key: 'days_61_90', label: '61-90 Days', align: 'right', render: (row) => formatPKR(row.days_61_90) },
                                { key: 'days_90_plus', label: '90+ Days', align: 'right', render: (row) => formatPKR(row.days_90_plus) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection
                        title={isReceivable ? 'Open Customer Documents' : 'Open Vendor Documents'}
                        subtitle={isReceivable ? 'Detailed receivable positions for collection action.' : 'Detailed payable positions for settlement control.'}
                    >
                        <ReportTable
                            rows={documents}
                            columns={[
                                { key: 'party_name', label: isReceivable ? 'Customer' : 'Vendor' },
                                { key: 'document_no', label: 'Document No', render: (row) => formatConfiguredDocumentNumber(row.document_no, activeBranch || row, { preserveTypePrefix: true }) || sanitizeText(row.document_no, '-') },
                                { key: 'document_date', label: 'Document Date', render: (row) => formatDate(row.document_date) },
                                { key: 'due_date', label: 'Due Date', render: (row) => formatDate(row.due_date) },
                                { key: 'days_past_due', label: 'Days Past Due', align: 'right', render: (row) => formatCompactNumber(Number(row.days_past_due ?? 0)) },
                                { key: 'outstanding_amount', label: 'Outstanding', align: 'right', render: (row) => formatPKR(Number(row.outstanding_amount ?? 0)) },
                            ]}
                            emptyMessage="No open documents in the selected aging scope."
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'treasury-position') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const movementMix = Array.isArray(payload?.movement_mix) ? payload.movement_mix : [];
            const recentMovements = Array.isArray(payload?.recent_movements) ? payload.recent_movements : [];
            const cashOfficeReview = payload?.cash_office_review ?? {};
            const safeDepositReview = payload?.safe_deposit_review ?? {};

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Treasury Balance', value: formatPKR(Number(summary.total_treasury_balance ?? 0)) },
                            { label: 'Bank Accounts', value: formatCompactNumber(Number(summary.bank_account_count ?? 0)) },
                            { label: 'Cash Accounts', value: formatCompactNumber(Number(summary.cash_account_count ?? 0)) },
                            { label: 'Transit / Safe', value: formatCompactNumber(Number(summary.bank_in_transit_account_count ?? 0) + Number(summary.safe_account_count ?? 0)) },
                        ]}
                    />
                    <ReportSection title="Movement Mix" subtitle="Treasury movement profile for the current branch scope.">
                        <ReportTable
                            rows={movementMix}
                            columns={[
                                { key: 'label', label: 'Source Module', render: (row) => sanitizeText(row.label, 'Unclassified') },
                                { key: 'count', label: 'Count', align: 'right', render: (row) => formatCompactNumber(Number(row.count ?? 0)) },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                            ]}
                            emptyMessage="No treasury movement mix is available for this scope."
                        />
                    </ReportSection>
                    <ReportSection title="Recent Treasury Movements" subtitle="Latest posted treasury entries for operational review.">
                        <ReportTable
                            rows={recentMovements}
                            columns={[
                                { key: 'transaction_date', label: 'Date', render: (row) => formatDate(row.transaction_date) },
                                { key: 'treasury_classification_label', label: 'Movement Type', render: (row) => sanitizeText(row.treasury_classification_label, 'Movement') },
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, 'All Branches') },
                                { key: 'account_name', label: 'Treasury Account', render: (row) => sanitizeText(row.account_name, '-') },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                            ]}
                            emptyMessage="No recent treasury movements are available."
                        />
                    </ReportSection>
                    <ReportSection title="Cash Office and Safe Control" subtitle="Daily close and deposit watchpoints for treasury handling.">
                        <ReportTable
                            rows={[
                                {
                                    area: 'Latest Day Close',
                                    metric: sanitizeText(cashOfficeReview?.latest_day_close?.business_date, 'None recorded'),
                                    detail: sanitizeText(cashOfficeReview?.latest_day_close?.status, 'No status'),
                                },
                                {
                                    area: 'Open Safe Handovers',
                                    metric: formatCompactNumber(Number(safeDepositReview?.open_safe_handover_count ?? 0)),
                                    detail: `${formatCompactNumber(Number(safeDepositReview?.overdue_safe_handover_count ?? 0))} overdue`,
                                },
                                {
                                    area: 'Open Transit Batches',
                                    metric: formatCompactNumber(Number(safeDepositReview?.open_transit_batch_count ?? 0)),
                                    detail: `${formatCompactNumber(Number(safeDepositReview?.overdue_transit_batch_count ?? 0))} overdue`,
                                },
                            ]}
                            columns={[
                                { key: 'area', label: 'Control Point' },
                                { key: 'metric', label: 'Current Position' },
                                { key: 'detail', label: 'Detail' },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'merchant-settlement') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const queue = Array.isArray(payload?.queue) ? payload.queue : [];
            const providerSummary = Array.isArray(payload?.provider_summary) ? payload.provider_summary : [];
            const channelSummary = Array.isArray(payload?.channel_summary) ? payload.channel_summary : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Clearing Balance', value: formatPKR(Number(summary.merchant_clearing_balance ?? 0)) },
                            { label: 'Open Receipts', value: formatCompactNumber(Number(summary.open_receipt_count ?? 0)) },
                            { label: 'Aged Open Receipts', value: formatCompactNumber(Number(summary.aged_open_receipt_count ?? 0)) },
                            { label: 'Aged Open Amount', value: formatPKR(Number(summary.aged_open_receipt_amount ?? 0)) },
                        ]}
                    />
                    <ReportSection title="Provider Summary" subtitle="Settlement exposure by collection provider.">
                        <ReportTable
                            rows={providerSummary}
                            columns={[
                                { key: 'provider_name', label: 'Provider', render: (row) => sanitizeText(row.provider_name, 'Unknown') },
                                { key: 'settlement_channel_label', label: 'Channel', render: (row) => sanitizeText(row.settlement_channel_label, 'Other Merchant') },
                                { key: 'settlement_count', label: 'Settlements', align: 'right', render: (row) => formatCompactNumber(Number(row.settlement_count ?? 0)) },
                                { key: 'gross_settlement_amount', label: 'Gross Settled', align: 'right', render: (row) => formatPKR(Number(row.gross_settlement_amount ?? 0)) },
                                { key: 'settlement_shortfall_amount', label: 'Charges / Shortfall', align: 'right', render: (row) => formatPKR(Number(row.settlement_shortfall_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Channel Summary" subtitle="Settlement pipeline by payment or sales channel.">
                        <ReportTable
                            rows={channelSummary}
                            columns={[
                                { key: 'settlement_channel_label', label: 'Channel', render: (row) => sanitizeText(row.settlement_channel_label, 'Unknown') },
                                { key: 'open_receipt_count', label: 'Open Receipts', align: 'right', render: (row) => formatCompactNumber(Number(row.open_receipt_count ?? 0)) },
                                { key: 'open_receipt_amount', label: 'Open Amount', align: 'right', render: (row) => formatPKR(Number(row.open_receipt_amount ?? 0)) },
                                { key: 'aged_open_receipt_amount', label: 'Aged Amount', align: 'right', render: (row) => formatPKR(Number(row.aged_open_receipt_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Pending Settlement Queue" subtitle="Detailed unsettled merchant receipts awaiting treasury posting or bank settlement.">
                        <ReportTable
                            rows={queue}
                            columns={[
                                { key: 'transaction_date', label: 'Receipt Date', render: (row) => formatDate(row.transaction_date) },
                                { key: 'provider_name', label: 'Provider', render: (row) => sanitizeText(row.provider_name, 'Unknown') },
                                { key: 'settlement_channel_label', label: 'Channel', render: (row) => sanitizeText(row.settlement_channel_label, 'Unknown') },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, '-') },
                                { key: 'absolute_amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.absolute_amount ?? 0)) },
                                { key: 'days_open', label: 'Days Open', align: 'right', render: (row) => formatCompactNumber(Number(row.days_open ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'treasury-exceptions') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const items = Array.isArray(payload?.items) ? payload.items : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Active Exceptions', value: formatCompactNumber(Number(summary.active_count ?? 0)) },
                            { label: 'Close Blockers', value: formatCompactNumber(Number(summary.blocker_count ?? 0)) },
                            { label: 'Blocker Amount', value: formatPKR(Number(summary.blocker_amount ?? 0)) },
                            { label: 'Open / In Review', value: `${formatCompactNumber(Number(summary.open_count ?? 0))} / ${formatCompactNumber(Number(summary.in_review_count ?? 0))}` },
                        ]}
                    />
                    <ReportSection title="Exception Detail" subtitle="All open treasury exceptions requiring operational or finance follow-up.">
                        <ReportTable
                            rows={items}
                            columns={[
                                { key: 'label', label: 'Exception Type', render: (row) => sanitizeText(row.label, 'Exception') },
                                { key: 'reference_label', label: 'Reference', render: (row) => sanitizeText(row.reference_label, '-') },
                                { key: 'severity', label: 'Severity', render: (row) => sanitizeText(row.severity, '-') },
                                { key: 'owner_name', label: 'Owner', render: (row) => sanitizeText(row.owner_name, '-') },
                                { key: 'workflow_status_label', label: 'Status', render: (row) => sanitizeText(row.workflow_status_label, '-') },
                                { key: 'age_days', label: 'Age Days', align: 'right', render: (row) => formatCompactNumber(Number(row.age_days ?? 0)) },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'voucher-register') {
            const rows = Array.isArray(reportPayload) ? reportPayload : [];
            const totalAmount = rows.reduce((sum, voucher) => sum + Number(voucher.amount ?? 0), 0);
            const pendingCount = rows.filter((voucher) => voucher.status === 'PENDING').length;
            const approvedCount = rows.filter((voucher) => voucher.status === 'APPROVED').length;
            const rejectedCount = rows.filter((voucher) => voucher.status === 'REJECTED').length;

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Voucher Count', value: formatCompactNumber(rows.length) },
                            { label: 'Voucher Amount', value: formatPKR(totalAmount) },
                            { label: 'Pending', value: formatCompactNumber(pendingCount) },
                            { label: 'Approved', value: formatCompactNumber(approvedCount), note: `${formatCompactNumber(rejectedCount)} rejected / voided` },
                        ]}
                    />
                    <ReportSection title="Voucher Register Detail" subtitle="Detailed voucher listing for branch audit trail and day-to-day review.">
                        <ReportTable
                            rows={rows}
                            columns={[
                                { key: 'voucher_no', label: 'Voucher No', render: (row) => formatConfiguredDocumentNumber(row.voucher_no, activeBranch || row, { preserveTypePrefix: true }) || sanitizeText(row.voucher_no, `Voucher ${row.id}`) },
                                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                                { key: 'type', label: 'Type' },
                                { key: 'party_name', label: 'Party', render: (row) => sanitizeText(row.party_name, '-') },
                                { key: 'status', label: 'Status' },
                                { key: 'payment_method', label: 'Payment Method', render: (row) => sanitizeText(row.payment_method, '-') },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'payment-voucher-exceptions') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const rows = Array.isArray(payload?.vouchers) ? payload.vouchers : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Exception Count', value: formatCompactNumber(Number(summary.count ?? 0)) },
                            { label: 'Branch Scope', value: branchLabel },
                            { label: 'Period Scope', value: reportScope },
                            { label: 'Review Purpose', value: 'Approval and correction' },
                        ]}
                    />
                    <ReportSection title="Voucher Exceptions" subtitle="Payment vouchers with control or documentation issues.">
                        <ReportTable
                            rows={rows}
                            columns={[
                                { key: 'voucher_no', label: 'Voucher No', render: (row) => formatConfiguredDocumentNumber(row.voucher_no, activeBranch || row, { preserveTypePrefix: true }) || sanitizeText(row.voucher_no, `Voucher ${row.voucher_id}`) },
                                { key: 'vendor_name', label: 'Party', render: (row) => sanitizeText(row.vendor_name, '-') },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                                { key: 'voucher_status', label: 'Status', render: (row) => sanitizeText(row.voucher_status, '-') },
                                { key: 'issues', label: 'Issues', render: (row) => Array.isArray(row.issues) ? row.issues.join('; ') : sanitizeText(row.issues, '-') },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'petty-cash') {
            const payload = reportPayload;
            const summary = payload?.summary ?? {};
            const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
            const transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Petty Cash Balance', value: formatPKR(Number(summary.total_balance ?? 0)) },
                            { label: 'Month Expense', value: formatPKR(Number(summary.month_expense ?? 0)) },
                            { label: 'Pending Entries', value: formatCompactNumber(Number(summary.pending_expense_count ?? 0)) },
                            { label: 'Active Accounts', value: formatCompactNumber(Number(summary.active_accounts ?? 0)) },
                        ]}
                    />
                    <ReportSection title="Petty Cash Accounts" subtitle="Available petty-cash balances by account.">
                        <ReportTable
                            rows={accounts}
                            columns={[
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, 'Company') },
                                { key: 'account_code', label: 'Account Code' },
                                { key: 'account_name', label: 'Account Name' },
                                { key: 'current_balance', label: 'Balance', align: 'right', render: (row) => formatPKR(Number(row.current_balance ?? 0)) },
                                { key: 'status', label: 'Status', render: (row) => row.is_active === false ? 'Inactive' : 'Active' },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Recent Petty Cash Activity" subtitle="Recent expense and refill movement for cashier review.">
                        <ReportTable
                            rows={transactions.slice(0, 25)}
                            columns={[
                                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, 'Company') },
                                { key: 'account_name', label: 'Account' },
                                { key: 'category', label: 'Category' },
                                { key: 'type', label: 'Type' },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                                { key: 'status', label: 'Status' },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'payroll-register') {
            const payload = reportPayload;
            const rows = Array.isArray(payload?.runs) ? payload.runs : [];
            const summary = payload?.summary ?? {};

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Runs', value: formatCompactNumber(Number(summary.run_count ?? rows.length)) },
                            { label: 'Net Payroll', value: formatPKR(Number(summary.total_net_amount ?? 0)) },
                            { label: 'Paid Salary', value: formatPKR(Number(summary.total_paid_amount ?? 0)) },
                            { label: 'Salary Payable', value: formatPKR(Number(summary.total_payable_balance ?? 0)) },
                            { label: 'Advance Recoveries', value: formatPKR(Number(summary.total_advance_recovery_amount ?? 0)) },
                            { label: 'Approved / Partial / Paid', value: `${formatCompactNumber(Number(summary.approved_count ?? 0))} / ${formatCompactNumber(Number(summary.partial_count ?? 0))} / ${formatCompactNumber(Number(summary.paid_count ?? 0))}` },
                        ]}
                    />
                    <ReportSection title="Payroll Run Register" subtitle="Run-wise payroll control report for accounting and finance review.">
                        <ReportTable
                            rows={rows}
                            columns={[
                                { key: 'run_no', label: 'Run No' },
                                { key: 'pay_date', label: 'Pay Date', render: (row) => formatDate(row.pay_date) },
                                { key: 'period_start', label: 'Period Start', render: (row) => formatDate(row.period_start) },
                                { key: 'period_end', label: 'Period End', render: (row) => formatDate(row.period_end) },
                                { key: 'employee_count', label: 'Employees', align: 'right', render: (row) => formatCompactNumber(Number(row.employee_count ?? 0)) },
                                { key: 'status', label: 'Status' },
                                { key: 'total_paid_amount', label: 'Paid Salary', align: 'right', render: (row) => formatPKR(Number(row.total_paid_amount ?? 0)) },
                                { key: 'total_payable_balance', label: 'Salary Payable', align: 'right', render: (row) => formatPKR(Number(row.total_payable_balance ?? 0)) },
                                { key: 'total_net_amount', label: 'Net Amount', align: 'right', render: (row) => formatPKR(Number(row.total_net_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'payroll-compliance-review') {
            const payload = reportPayload;
            const balances = payload?.balances ?? {};
            const recentSettlements = Array.isArray(payload?.recent_settlements) ? payload.recent_settlements : [];
            const filingReview = payload?.filing_review ?? {};

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Statutory Payable', value: formatPKR(Number(balances.statutory_payable_balance ?? 0)) },
                            { label: 'Withholding Tax', value: formatPKR(Number(balances.withholding_tax_payable_balance ?? 0)) },
                            { label: 'EOBI Payable', value: formatPKR(Number(balances.eobi_payable_balance ?? 0)) },
                            { label: 'Social Security', value: formatPKR(Number(balances.social_security_payable_balance ?? 0)) },
                        ]}
                    />
                    <ReportSection title="Liability Breakdown" subtitle="Outstanding payroll statutory balances by liability class.">
                        <ReportTable
                            rows={[
                                { type: 'Withholding Tax', amount: Number(balances.withholding_tax_payable_balance ?? 0) },
                                { type: 'EOBI', amount: Number(balances.eobi_payable_balance ?? 0) },
                                { type: 'Social Security', amount: Number(balances.social_security_payable_balance ?? 0) },
                                { type: 'Other Statutory Payable', amount: Number(balances.statutory_payable_balance ?? 0) },
                            ]}
                            columns={[
                                { key: 'type', label: 'Liability Type' },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Recent Settlements" subtitle="Most recent statutory settlement entries recorded by finance.">
                        <ReportTable
                            rows={recentSettlements}
                            columns={[
                                { key: 'business_date', label: 'Settlement Date', render: (row) => formatDate(row.business_date) },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, '-') },
                                { key: 'treasury_account_name', label: 'Treasury Account', render: (row) => sanitizeText(row.treasury_account_name, '-') },
                                { key: 'withholding_tax_amount', label: 'WHT', align: 'right', render: (row) => formatPKR(Number(row.withholding_tax_amount ?? 0)) },
                                { key: 'eobi_amount', label: 'EOBI', align: 'right', render: (row) => formatPKR(Number(row.eobi_amount ?? 0)) },
                                { key: 'social_security_amount', label: 'SS', align: 'right', render: (row) => formatPKR(Number(row.social_security_amount ?? 0)) },
                                { key: 'total_amount', label: 'Total', align: 'right', render: (row) => formatPKR(Number(row.total_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Filing Control Status" subtitle="Latest filing readiness indicators connected to payroll compliance.">
                        <ReportTable
                            rows={[
                                {
                                    checkpoint: 'Latest Filing Date',
                                    value: formatDate(filingReview.latest_filing_date),
                                },
                                {
                                    checkpoint: 'Latest Filing Reference',
                                    value: sanitizeText(filingReview.latest_filing_reference, 'Not available'),
                                },
                                {
                                    checkpoint: 'Filing Due Date',
                                    value: formatDate(filingReview.filing_due_date),
                                },
                                {
                                    checkpoint: 'Unfiled Period Count',
                                    value: formatCompactNumber(Number(filingReview.unfiled_period_count ?? 0)),
                                },
                                {
                                    checkpoint: 'Overdue Unfiled Count',
                                    value: formatCompactNumber(Number(filingReview.overdue_unfiled_period_count ?? 0)),
                                },
                            ]}
                            columns={[
                                { key: 'checkpoint', label: 'Checkpoint' },
                                { key: 'value', label: 'Current Status' },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'payroll-compliance-filings') {
            const payload = reportPayload;
            const filings = Array.isArray(payload?.filings) ? payload.filings : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Filing Count', value: formatCompactNumber(filings.length) },
                            { label: 'Branch Scope', value: branchLabel },
                            { label: 'Period Scope', value: reportScope },
                            { label: 'Purpose', value: 'Statutory submission tracking' },
                        ]}
                    />
                    <ReportSection title="Payroll Filing Tracker" subtitle="Detailed filing status report for payroll statutory submissions.">
                        <ReportTable
                            rows={filings}
                            columns={[
                                { key: 'period_start', label: 'Period Start', render: (row) => formatDate(row.period_start) },
                                { key: 'period_end', label: 'Period End', render: (row) => formatDate(row.period_end) },
                                { key: 'filing_date', label: 'Filed On', render: (row) => formatDate(row.filing_date) },
                                { key: 'status', label: 'Status', render: (row) => sanitizeText(row.status, '-') },
                                { key: 'filing_reference', label: 'Reference', render: (row) => sanitizeText(row.filing_reference, '-') },
                                { key: 'total_amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.total_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        return null;
    };

    return (
        <div className={styles.container}>
            <div className={styles.nonPrintArea}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.iconBox}>
                            <BarChart2 size={18} />
                        </div>
                        <div>
                            <h1>Daily Accounting Reports</h1>
                            <p>Operational finance controls and printable A4 report packs for branch accounting work</p>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <div className={styles.selectorBox}>
                            <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} />
                        </div>
                        <div className={styles.selectorBox}>
                            <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <KitchenSelect options={PERIOD_OPTIONS} value={periodPreset} onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)} />
                        </div>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setPeriodPreset('custom');
                                setDateFrom(e.target.value);
                            }}
                            className={`${styles.dateInput} ${styles.headerDateInput}`}
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setPeriodPreset('custom');
                                setDateTo(e.target.value);
                            }}
                            className={`${styles.dateInput} ${styles.headerDateInput}`}
                        />
                    </div>
                </header>

                <div className={styles.viewTabs}>
                    <button
                        type="button"
                        className={`${styles.viewTabBtn} ${activeView === 'overview' ? styles.viewTabBtnActive : ''}`}
                        onClick={() => setActiveView('overview')}
                    >
                        Daily Review
                    </button>
                    <button
                        type="button"
                        className={`${styles.viewTabBtn} ${activeView === 'reports' ? styles.viewTabBtnActive : ''}`}
                        onClick={() => setActiveView('reports')}
                    >
                        Printable Reports
                    </button>
                </div>

                <div className={styles.filterRow}>
                    <div className={styles.helperNote}>
                        Run printable operational reports from this page for collections, payables, payroll, treasury, cashier control, and daily finance review.
                    </div>
                </div>

                {activeView === 'overview' && periodLock?.mode && periodLock.mode !== 'none' && (
                    <div className={styles.lockBanner}>
                        <Lock size={16} />
                        <div>
                            <strong>{periodLock.mode === 'hard_lock' ? 'Hard period lock active.' : 'Admin-override period lock active.'}</strong>
                            <span> Locked through {formatDate(periodLock.locked_through_date)}{periodLock.updated_by ? ` by ${periodLock.updated_by}` : ''}.</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className={styles.stateCard}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
                {loading && (
                    <div className={styles.stateCard}>
                        <span>Loading daily accounting reports...</span>
                    </div>
                )}

                {activeView === 'overview' && !loading && !error && (
                    <div className={styles.summaryGrid}>
                        {summaryCards.map((card) => (
                            <div key={card.label} className={`${styles.summaryCard} ${styles[`tone${card.tone[0].toUpperCase()}${card.tone.slice(1)}`]}`}>
                                <span className={styles.summaryLabel}>{card.label}</span>
                                <strong className={styles.summaryValue}>{formatPKR(card.value)}</strong>
                                {card.subLabel ? <span className={styles.summarySubLabel}>{card.subLabel}</span> : null}
                            </div>
                        ))}
                    </div>
                )}

                {activeView === 'overview' && hasDrillthroughScope && !loading && !error && (
                    <div className={`${styles.stateCard} ${styles.drillthroughStateCard}`}>
                        <AlertCircle size={16} />
                        <span>Month-close review scope active. Operational accounting queues are filtered for finance follow-up.</span>
                        <button type="button" className={styles.inlineActionBtn} onClick={clearDrillthrough}>
                            Clear Scope
                        </button>
                    </div>
                )}

                {activeView === 'overview' && !loading && !error && (
                    <>
                        <div className={styles.agingReviewGrid}>
                            <AgingReviewPanel title="Receivables Aging Review" badge="AR" data={receivablesAging} />
                            <AgingReviewPanel
                                title="Payables Aging Review"
                                badge="AP"
                                data={payablesAging}
                                highlighted={reportFocus === 'payables'}
                                onReview={() => navigate(`${consoleBase}/inventory/vendor-payments`)}
                            />
                        </div>

                        <div className={styles.laborReviewGrid}>
                            <div className={styles.laborReviewPanel}>
                                <div className={styles.agingPanelHeader}>
                                    <div>
                                        <h4>Labor Cost Review</h4>
                                        <span>{branchLabel} - selected-period payroll cost, liability, and margin pressure</span>
                                    </div>
                                    <button type="button" className={styles.agingReviewBtn} onClick={() => navigate(buildPayrollReviewPath())}>
                                        Review Payroll
                                    </button>
                                </div>
                                <div className={styles.laborMetricGrid}>
                                    <div className={styles.laborMetric}>
                                        <span>Labor Cost</span>
                                        <strong>{formatPKR(Number(selectedPeriodLaborCost ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Labor vs Revenue</span>
                                        <strong>{selectedPeriodLaborRatio.toFixed(1)}%</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Payroll Payable</span>
                                        <strong>{formatPKR(Number(payrollPayableBalance ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Approved Unpaid Runs</span>
                                        <strong>{Number(dashboardLaborCosting?.approved_unpaid_runs ?? 0)}</strong>
                                    </div>
                                </div>
                                <div className={styles.laborReviewFocus}>
                                    <strong>
                                        {dashboardLaborCosting?.latest_run
                                            ? `${dashboardLaborCosting.latest_run.run_no} - ${String(dashboardLaborCosting.latest_run.status || '').replace('_', ' ')}`
                                            : 'No payroll run posted in this scope yet.'}
                                    </strong>
                                    <span>
                                        {dashboardLaborCosting?.latest_run
                                            ? `${formatPKR(Number(dashboardLaborCosting.latest_run.total_net_amount ?? 0))} for ${Number(dashboardLaborCosting.latest_run.employee_count ?? 0)} employees on ${formatDate(dashboardLaborCosting.latest_run.pay_date)}`
                                            : `Payroll payable currently sits at ${formatPKR(Number(payrollPayableBalance ?? 0))}.`}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.laborReviewPanel}>
                                <div className={styles.agingPanelHeader}>
                                    <div>
                                        <h4>Payroll Control View</h4>
                                        <span>Current payroll settlement and branch concentration</span>
                                    </div>
                                </div>
                                <div className={styles.laborMetricGrid}>
                                    <div className={styles.laborMetric}>
                                        <span>Accrued This Month</span>
                                        <strong>{formatPKR(Number(dashboardLaborCosting?.current_period_payroll_accrued ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Paid This Month</span>
                                        <strong>{formatPKR(Number(dashboardLaborCosting?.current_period_payroll_paid ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Draft Runs</span>
                                        <strong>{Number(dashboardLaborCosting?.draft_runs ?? 0)}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Top Branch Exposure</span>
                                        <strong>{dashboardLaborCosting?.top_branch_name || branchLabel}</strong>
                                    </div>
                                </div>
                                <div className={styles.laborReviewFocus}>
                                    <strong>
                                        {dashboardLaborCosting?.top_branch_name
                                            ? `${dashboardLaborCosting.top_branch_name} is carrying the highest current-month labor cost`
                                            : 'Branch payroll exposure is aligned to the current report scope.'}
                                    </strong>
                                    <span>
                                        {formatPKR(Number(dashboardLaborCosting?.top_branch_labor_cost ?? dashboardLaborCosting?.current_period_labor_cost ?? 0))}
                                        {' '}current-month payroll cost in finance control.
                                    </span>
                                </div>
                            </div>

                            <div className={styles.laborReviewPanel}>
                                <div className={styles.agingPanelHeader}>
                                    <div>
                                        <h4>Payroll Compliance Review</h4>
                                        <span>Statutory deductions, employer burden, and open payroll liabilities</span>
                                    </div>
                                    <button type="button" className={styles.agingReviewBtn} onClick={() => navigate(buildPayrollReviewPath())}>
                                        Review Payroll
                                    </button>
                                </div>
                                <div className={styles.laborMetricGrid}>
                                    <div className={styles.laborMetric}>
                                        <span>Statutory Payable</span>
                                        <strong>{formatPKR(Number(dashboardPayrollCompliance?.statutory_payable_balance ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Employee Deductions</span>
                                        <strong>{formatPKR(Number(dashboardPayrollCompliance?.current_period_employee_compliance_amount ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Employer Contribution</span>
                                        <strong>{formatPKR(Number(dashboardPayrollCompliance?.current_period_employer_contribution_amount ?? 0))}</strong>
                                    </div>
                                    <div className={styles.laborMetric}>
                                        <span>Withholding Tax Payable</span>
                                        <strong>{formatPKR(Number(dashboardPayrollCompliance?.withholding_tax_payable_balance ?? 0))}</strong>
                                    </div>
                                </div>
                                <div className={styles.laborReviewFocus}>
                                    <strong>
                                        {dashboardPayrollCompliance?.latest_run
                                            ? `${dashboardPayrollCompliance.latest_run.run_no} - ${String(dashboardPayrollCompliance.latest_run.status || '').replace('_', ' ')}`
                                            : 'No payroll compliance posting in this scope yet.'}
                                    </strong>
                                    <span>
                                        EOBI {formatPKR(Number(dashboardPayrollCompliance?.eobi_payable_balance ?? 0))}
                                        {' '} - Social security {formatPKR(Number(dashboardPayrollCompliance?.social_security_payable_balance ?? 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {activeView === 'reports' && (
            <section className={styles.reportCenter}>
                <div className={styles.reportCenterHeader}>
                    <div>
                        <h2>Printable Daily Report Center</h2>
                        <p>Select an operational accounting report, run it for the current scope, then print on A4.</p>
                    </div>
                </div>

                <div className={styles.reportWorkspace}>
                    <aside className={styles.reportSidebar}>
                        <div className={styles.reportSidebarTop}>
                            <div>
                                <span className={styles.reportRunnerLabel}>Report List</span>
                                <strong className={styles.reportSidebarTitle}>Operational Reports</strong>
                                <p className={styles.reportSidebarText}>Pick a report on the left, then review and print it from the main pane.</p>
                            </div>
                            <div className={styles.reportSidebarControls}>
                                <div className={styles.reportSidebarStatus}>
                                    <span>Branch Scope</span>
                                    <strong>{branchLabel}</strong>
                                </div>
                                <div className={styles.reportSidebarStatus}>
                                    <span>Report Period</span>
                                    <strong>{reportScope}</strong>
                                </div>
                            </div>
                            <div className={styles.reportCenterActions}>
                                <button
                                    type="button"
                                    className={styles.reportActionBtn}
                                    onClick={() => void runReport(selectedReportId)}
                                    disabled={reportLoading || !canRunSelectedReport}
                                >
                                    <FileText size={15} />
                                    Run Report
                                </button>
                                <button
                                    type="button"
                                    className={styles.reportActionBtn}
                                    onClick={printReport}
                                    disabled={!reportPayload}
                                >
                                    <Printer size={15} />
                                    Print A4
                                </button>
                            </div>
                        </div>

                        <div className={styles.reportCatalogList}>
                            {REPORT_LIBRARY.map((report) => {
                                const isSelected = report.id === selectedReportId;
                                const isDisabled = report.requiresSingleBranch && selectedBranch === 'all';

                                return (
                                    <button
                                        key={report.id}
                                        type="button"
                                        className={`${styles.reportCatalogCard} ${isSelected ? styles.reportCatalogCardActive : ''}`}
                                        onClick={() => setSelectedReportId(report.id)}
                                    >
                                        <span className={styles.reportCatalogCategory}>{report.category}</span>
                                        <strong>{report.name}</strong>
                                        <p>{report.description}</p>
                                        <span className={styles.reportCatalogNote}>
                                            {report.scopeNote || (isDisabled ? 'Select a single branch to enable this report.' : 'Available for current report scope.')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <div className={styles.reportPreviewWrap}>
                        <div className={styles.reportRunnerMeta}>
                            <div>
                                <span className={styles.reportRunnerLabel}>Selected Report</span>
                                <strong>{selectedReport.name}</strong>
                                <p>{selectedReport.description}</p>
                            </div>
                            <div className={styles.reportRunnerSummary}>
                                <span className={styles.reportRunnerLabel}>Current Scope</span>
                                <strong>{branchLabel}</strong>
                                <p>{reportGeneratedAt ? `Generated on ${formatDate(reportGeneratedAt)}` : 'Run the selected report to refresh this preview for the current branch scope.'}</p>
                            </div>
                        </div>

                        <div className={styles.printSheet}>
                            <div className={styles.printSheetHeader}>
                                <div>
                                    <span className={styles.printSheetEyebrow}>KitchenOS Finance</span>
                                    <h2>{selectedReport.name}</h2>
                                    <p>{selectedReport.description}</p>
                                </div>
                                <div className={styles.printSheetMeta}>
                                    <div>
                                        <span>Branch Scope</span>
                                        <strong>{branchLabel}</strong>
                                    </div>
                                    <div>
                                        <span>Report Period</span>
                                        <strong>{reportScope}</strong>
                                    </div>
                                    <div>
                                        <span>Generated On</span>
                                        <strong>{reportGeneratedAt ? formatDate(reportGeneratedAt) : formatDate(new Date().toISOString())}</strong>
                                    </div>
                                </div>
                            </div>
                            {renderReportPreview()}
                        </div>
                    </div>
                </div>
            </section>
            )}
        </div>
    );
}
