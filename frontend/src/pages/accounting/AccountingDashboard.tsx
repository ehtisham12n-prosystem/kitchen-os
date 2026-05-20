/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    Wallet, Landmark, TrendingUp, TrendingDown, Receipt,
    BadgeDollarSign, ArrowUpRight, ArrowDownRight, Users,
    CreditCard, FileText, BookOpen, Building2, Settings,
    Scale, PiggyBank, HandCoins, ChevronRight, Plus, X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { accountingApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { toast } from '../../components/ui/KitchenToast/toast';
import { formatConfiguredDocumentNumber } from '../pos/printTemplates/printHelpers';
import styles from './AccountingDashboard.module.css';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8'];

const QUICK_LINKS = [
    { icon: BookOpen, label: 'Chart of Accounts', path: 'accounting/chart-of-accounts', color: 'var(--accent-primary, #6366f1)' },
    { icon: FileText, label: 'Journal Entries', path: 'accounting/journal-entries', color: 'var(--accent-secondary, #a855f7)' },
    { icon: Scale, label: 'General Ledger', path: 'accounting/general-ledger', color: 'var(--accent-tertiary, #06b6d4)' },
    { icon: Landmark, label: 'Bank Reconciliation', path: 'finance/reconciliation', color: '#f59e0b' },
    { icon: Users, label: 'Investors', path: 'accounting/investors', color: '#22c55e' },
    { icon: HandCoins, label: 'Loans', path: 'accounting/loans', color: '#ef4444' },
    { icon: PiggyBank, label: 'Profit Distribution', path: 'accounting/profit-distribution', color: '#ec4899' },
    { icon: Receipt, label: 'Financial Reports', path: 'accounting/reports', color: '#8b5cf6' },
    { icon: ArrowUpRight, label: 'Receivables Control', path: 'accounting/receivables', color: '#f59e0b' },
    { icon: Settings, label: 'Settings', path: 'accounting/settings', color: '#64748b' },
];

const SERVICE_RECHARGE_TYPES = [
    { value: 'central_admin', label: 'Central Admin' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'kitchen_support', label: 'Kitchen Support' },
    { value: 'shared_support', label: 'Shared Support' },
    { value: 'other', label: 'Other' },
];

function buildServiceRechargeDraft(selectedBranch: string, branchRows: Array<{ branch_id: number; branch_name: string }>) {
    const sourceBranchId = selectedBranch !== 'all'
        ? selectedBranch
        : (branchRows[0] ? String(branchRows[0].branch_id) : '');
    const destinationBranchId = branchRows.find((branch) => String(branch.branch_id) !== sourceBranchId)
        ? String(branchRows.find((branch) => String(branch.branch_id) !== sourceBranchId)?.branch_id ?? '')
        : '';
    return {
        source_branch_id: sourceBranchId,
        destination_branch_id: destinationBranchId,
        service_type: 'central_admin',
        amount: '',
        service_date: new Date().toISOString().slice(0, 10),
        description: '',
        notes: '',
    };
}

function formatPKR(value: number): string {
    if (value >= 1000000) return `PKR ${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `PKR ${(value / 1000).toFixed(1)}K`;
    return `PKR ${value.toLocaleString()}`;
}

function formatAxis(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
}

function resolveSourceLabel(sourceModule?: string | null): string {
    switch (sourceModule) {
        case 'pos': return 'POS';
        case 'inventory': return 'Inventory';
        case 'accounting': return 'Manual';
        default: return 'Manual';
    }
}

export function AccountingDashboard() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const access = usePermissionAccess();
    const {
        canManageAccountingSettings,
        canPostAccounting,
        canViewAccountingReports,
        canViewBankAccounts,
        canViewBankReconciliation,
        canViewChartOfAccounts,
        canViewGeneralLedger,
        canViewVouchers,
    } = access;
    const { branches, activeBranch } = useBranchContext();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [dashboard, setDashboard] = useState<any>(null);
    const [paymentExceptions, setPaymentExceptions] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [showServiceRechargeModal, setShowServiceRechargeModal] = useState(false);
    const [serviceRechargeSaving, setServiceRechargeSaving] = useState(false);
    const [serviceRechargeDraft, setServiceRechargeDraft] = useState<any>({
        source_branch_id: '',
        destination_branch_id: '',
        service_type: 'central_admin',
        amount: '',
        service_date: new Date().toISOString().slice(0, 10),
        description: '',
        notes: '',
    });

    useEffect(() => {
        if (!activeBranch) {
            return;
        }
        setSelectedBranch((current) => current || String(activeBranch.branch_id));
    }, [activeBranch]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const branchId = selectedBranch === 'all' ? null : selectedBranch;
                const [response, exceptions] = await Promise.all([
                    accountingApi.getDashboard({ branch_id: branchId }),
                    accountingApi.getPaymentVoucherExceptions({ branch_id: branchId }),
                ]);
                setDashboard(response);
                setPaymentExceptions(exceptions);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load accounting dashboard');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [selectedBranch, reloadToken]);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({
                value: String(branch.branch_id),
                label: branch.branch_name || `Branch ${branch.branch_id}`,
            })),
        ],
        [branches],
    );

    const serviceRechargeBranchRows = useMemo(
        () => branches.map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name || `Branch ${branch.branch_id}`,
        })),
        [branches],
    );
    const canViewJournalEntries = access.hasAnyPermission([
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    ]);
    const canViewInvestors = access.hasAnyPermission([
        APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
    ]);
    const canViewLoans = access.hasAnyPermission([
        APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.LOANS,
    ]);
    const canViewProfitDistribution = access.hasAnyPermission([
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW,
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
    ]);
    const canViewPayroll = access.hasAnyPermission([
        APP_PERMISSIONS.HR.PAYROLL_READ,
        APP_PERMISSIONS.HR.PAYROLL_MANAGE,
        APP_PERMISSIONS.HR.PAYROLL_APPROVE,
    ]);
    const canReviewPendingBills = access.hasAnyPermission([
        APP_PERMISSIONS.INVENTORY.READ,
        APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE,
        APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
    ]);
    const canReviewInterBranchSettlement = access.hasAnyPermission([
        APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
        APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
    ]);
    const canOpenBranchDay = access.hasAnyPermission([
        APP_PERMISSIONS.POS.DAY_MANAGE,
        APP_PERMISSIONS.POS.SHIFT_MANAGE,
        APP_PERMISSIONS.POS.TILL_MANAGE,
    ]);
    const accessibleQuickLinks = QUICK_LINKS.filter((link) => {
        switch (link.path) {
            case 'accounting/chart-of-accounts':
                return canViewChartOfAccounts;
            case 'accounting/journal-entries':
                return canViewJournalEntries;
            case 'accounting/general-ledger':
                return canViewGeneralLedger;
            case 'finance/reconciliation':
                return canViewBankReconciliation;
            case 'accounting/investors':
                return canViewInvestors;
            case 'accounting/loans':
                return canViewLoans;
            case 'accounting/profit-distribution':
                return canViewProfitDistribution;
            case 'accounting/reports':
            case 'accounting/receivables':
                return canViewAccountingReports;
            case 'accounting/settings':
                return canManageAccountingSettings;
            default:
                return false;
        }
    });

    useEffect(() => {
        setServiceRechargeDraft((current: any) => (
            current.source_branch_id || current.destination_branch_id
                ? current
                : buildServiceRechargeDraft(selectedBranch, serviceRechargeBranchRows)
        ));
    }, [selectedBranch, serviceRechargeBranchRows]);

    const kpiCards = useMemo(() => {
        const summary = dashboard?.summary ?? {};
        return [
        { icon: Wallet, label: 'Cash Balance', value: Number(summary.cash_balance ?? 0), trend: 'Cash accounts', up: true, accent: 'var(--alert-success-text)' },
        { icon: Landmark, label: 'Bank Balances', value: Number(summary.bank_balance ?? 0), trend: 'Bank accounts', up: true, accent: 'var(--accent-primary, #6366f1)' },
        { icon: TrendingUp, label: 'Daily Revenue', value: Number(summary.daily_revenue ?? 0), trend: 'Today', up: true, accent: 'var(--accent-tertiary, #06b6d4)' },
        { icon: BadgeDollarSign, label: 'Monthly Revenue', value: Number(summary.monthly_revenue ?? 0), trend: 'Current month', up: true, accent: 'var(--accent-secondary, #a855f7)' },
        { icon: TrendingDown, label: 'Monthly Expenses', value: Number(summary.monthly_expenses ?? 0), trend: 'Current month', up: false, accent: 'var(--danger)' },
        { icon: Receipt, label: 'Net Profit', value: Number(summary.net_profit ?? 0), trend: 'Current month', up: Number(summary.net_profit ?? 0) >= 0, accent: '#22c55e' },
        { icon: ArrowUpRight, label: 'Receivables', value: Number(summary.receivables_outstanding ?? 0), trend: `${Number(summary.receivables_count ?? 0)} Open`, up: true, accent: '#f59e0b' },
        { icon: ArrowDownRight, label: 'Payables', value: Number(summary.payables_outstanding ?? 0), trend: `${Number(summary.payables_count ?? 0)} Open`, up: false, accent: '#ef4444' },
        ];
    }, [dashboard]);
    const summary = dashboard?.summary ?? {};

    const receivablesAging = dashboard?.receivables_aging ?? [];
    const expenseBreakdown = dashboard?.expense_breakdown ?? [];
    const revenueTrend = dashboard?.revenue_trend ?? [];
    const ownershipOverview = dashboard?.ownership_overview ?? null;
    const recentEntries = dashboard?.recent_journal_entries ?? [];
    const closeReadiness = dashboard?.close_readiness ?? null;
    const periodLock = dashboard?.period_lock ?? null;
    const latestDayClose = dashboard?.latest_day_close ?? null;
    const monthCloseChecklist = dashboard?.month_close_checklist ?? null;
    const pendingAccruals = dashboard?.pending_accruals ?? null;
    const closeAdjustmentSchedules = dashboard?.close_adjustment_schedules ?? null;
    const interBranchSettlement = dashboard?.inter_branch_settlement ?? null;
    const laborCosting = dashboard?.labor_costing ?? null;
    const payrollCompliance = dashboard?.payroll_compliance ?? null;
    const treasuryDepositExceptions = dashboard?.treasury_deposit_exceptions ?? null;
    const treasuryExceptionWorkflow = dashboard?.treasury_exception_workflow ?? null;
    const yearEndGovernance = dashboard?.year_end_governance ?? null;
    const payablesComposition = [
        {
            label: 'Stock / Vendor Bills',
            amount: Number(summary.payables_grn_outstanding ?? 0),
            count: Number(summary.payables_grn_count ?? 0),
        },
        {
            label: 'Urgent Credit Expenses',
            amount: Number(summary.payables_expense_voucher_outstanding ?? 0),
            count: Number(summary.payables_expense_voucher_count ?? 0),
        },
    ];
    const treasuryExceptionSummary = paymentExceptions?.summary ?? { count: 0, pending_count: 0, approved_count: 0 };
    const topTreasuryException = paymentExceptions?.vouchers?.[0] ?? null;
    const treasuryWorkflowSummary = treasuryExceptionWorkflow?.summary ?? null;
    const ownershipRollup = ownershipOverview?.rollup ?? null;
    const ownershipBranchComparison = Array.isArray(ownershipOverview?.branch_comparison) ? ownershipOverview.branch_comparison : [];
    const ownershipExceptionTrend = Array.isArray(ownershipOverview?.exception_trend) ? ownershipOverview.exception_trend : [];
    const internalServiceRecharges = dashboard?.internal_service_recharges ?? null;
    const serviceRechargeSummary = internalServiceRecharges?.summary ?? null;
    const recentServiceRecharges = Array.isArray(internalServiceRecharges?.recent) ? internalServiceRecharges.recent : [];
    const closeGovernanceCards = [
        {
            label: 'Period Lock',
            value: periodLock?.mode === 'hard_lock' ? 'Hard Lock' : periodLock?.mode === 'admin_override' ? 'Admin Override' : 'Open',
            meta: periodLock?.locked_through_date ? `Through ${new Date(periodLock.locked_through_date).toLocaleDateString('en-PK')}` : 'No lock date set',
        },
        {
            label: 'Latest Day Close',
            value: latestDayClose ? new Date(latestDayClose.business_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : 'None',
            meta: latestDayClose?.closed_by_name ? `By ${latestDayClose.closed_by_name}` : 'No recent close recorded',
        },
        {
            label: 'Close Exception State',
            value: latestDayClose?.review_status === 'variance_review' ? 'Variance Review'
                : latestDayClose?.review_status === 'noted_close' ? 'Noted Close'
                    : latestDayClose ? 'Clean Close' : 'No Close',
            meta: latestDayClose?.cash_variance_amount
                ? `${formatPKR(Number(latestDayClose.cash_variance_amount ?? 0))} variance`
                : closeReadiness?.status === 'ready'
                    ? 'Month-close currently clean'
                    : closeReadiness?.top_issue ?? 'Close review pending',
        },
        {
            label: 'Checklist Progress',
            value: `${Number(monthCloseChecklist?.summary?.completion_percent ?? 0)}%`,
            meta: `${Number(monthCloseChecklist?.summary?.completed_count ?? 0)} of ${Number(monthCloseChecklist?.summary?.total_count ?? 0)} items complete`,
        },
        {
            label: 'Pending Accruals',
            value: String(Number(pendingAccruals?.count ?? 0)),
            meta: pendingAccruals?.top_due_date
                ? `Top due ${pendingAccruals.top_due_date}`
                : 'No accrual reversals pending',
        },
        {
            label: 'Close Schedules',
            value: String(Number(summary.close_adjustment_schedule_count ?? 0)),
            meta: `${Number(summary.prepaid_schedule_count ?? 0)} prepaid · ${Number(summary.deferred_schedule_count ?? 0)} deferred · ${Number(summary.depreciation_schedule_count ?? 0)} depreciation`,
        },
        {
            label: 'Year-End',
            value: yearEndGovernance?.is_year_end_period
                ? yearEndGovernance?.status === 'ready' ? 'Active · Ready' : 'Active · Attention'
                : `Next ${yearEndGovernance?.year_end_period_key ?? 'Year-End'}`,
            meta: yearEndGovernance?.note ?? 'Year-end governance will appear here when relevant.',
        },
    ];
    const interBranchSettlementSummary = interBranchSettlement?.summary ?? {};
    const interBranchSettlementQueue = Array.isArray(interBranchSettlement?.queue) ? interBranchSettlement.queue : [];
    const laborCostingCards = [
        {
            label: 'Current Labor Cost',
            value: formatPKR(Number(laborCosting?.current_period_labor_cost ?? 0)),
            meta: `${Number(laborCosting?.covered_employee_count ?? 0)} staff lines in current payroll scope`,
        },
        {
            label: 'Payroll Payable',
            value: formatPKR(Number(laborCosting?.payroll_payable_balance ?? 0)),
            meta: `${Number(laborCosting?.approved_unpaid_runs ?? 0)} approved unpaid run(s)`,
        },
        {
            label: 'Labor vs Revenue',
            value: `${Number(laborCosting?.labor_cost_ratio_percent ?? 0).toFixed(1)}%`,
            meta: `${formatPKR(Number(laborCosting?.current_period_payroll_paid ?? 0))} paid this period`,
        },
    ];
    const payrollComplianceCards = [
        {
            label: 'Statutory Payable',
            value: formatPKR(Number(payrollCompliance?.statutory_payable_balance ?? 0)),
            meta: Number(payrollCompliance?.overdue_unfiled_period_count ?? 0) > 0
                ? `Filing overdue by ${Number(payrollCompliance?.overdue_days ?? 0)} day(s)`
                : Number(payrollCompliance?.unfiled_period_count ?? 0) > 0
                    ? 'Statutory payroll remains open without a filed compliance return in scope'
                : 'Withholding tax, EOBI, and social security still payable',
        },
        {
            label: 'Employee Deductions',
            value: formatPKR(Number(payrollCompliance?.current_period_employee_compliance_amount ?? 0)),
            meta: 'Current-period payroll withholding from staff',
        },
        {
            label: 'Employer Contribution',
            value: formatPKR(Number(payrollCompliance?.current_period_employer_contribution_amount ?? 0)),
            meta: 'Employer-side statutory payroll burden',
        },
    ];

    const buildInterBranchReviewPath = () => {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') {
            params.set('branch_id', selectedBranch);
        }
        params.set('origin', 'inter_branch_settlement');
        params.set('finance_attention', '1');
        return `${consoleBase}/inventory/ibt?${params.toString()}`;
    };

    const buildCloseReviewPath = (
        target: 'pending_bill' | 'overdue_ap' | 'unreconciled_vendor_payments' | 'treasury_exceptions' | 'treasury_deposit_exceptions' | 'payroll_compliance',
    ) => {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') {
            params.set('branch_id', selectedBranch);
        }
        params.set('origin', 'month_close');

        if (target === 'pending_bill') {
            params.set('payable_status', 'pending_bill');
            return `${consoleBase}/inventory/grn?${params.toString()}`;
        }

        if (target === 'overdue_ap') {
            params.set('focus', 'payables');
            return `${consoleBase}/accounting/daily-reports?${params.toString()}`;
        }

        if (target === 'unreconciled_vendor_payments') {
            params.set('activity_type', 'vendor_payments');
            return `${consoleBase}/finance/reconciliation?${params.toString()}`;
        }

        if (target === 'payroll_compliance') {
            return `${consoleBase}/accounting/payroll?${params.toString()}`;
        }

        if (target === 'treasury_deposit_exceptions') {
            return `${consoleBase}/finance/treasury-accounts?${params.toString()}`;
        }

        params.set('exceptions', '1');
        params.set('type', 'PAYMENT');
        return `${consoleBase}/accounting/vouchers?${params.toString()}`;
    };

    const buildPayrollPath = () => {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') {
            params.set('branch_id', selectedBranch);
        }
        return `${consoleBase}/accounting/payroll${params.toString() ? `?${params.toString()}` : ''}`;
    };

    const openServiceRechargeModal = () => {
        if (!canPostAccounting) {
            toast.error('Access Restricted', 'Your current branch role cannot post internal service recharges.');
            return;
        }
        setServiceRechargeDraft(buildServiceRechargeDraft(selectedBranch, serviceRechargeBranchRows));
        setShowServiceRechargeModal(true);
    };

    const handleCreateServiceRecharge = async () => {
        if (!canPostAccounting) {
            toast.error('Access Restricted', 'Your current branch role cannot post internal service recharges.');
            return;
        }
        if (!serviceRechargeDraft.source_branch_id || !serviceRechargeDraft.destination_branch_id) {
            toast.error('Validation Error', 'Select both source and destination branches.');
            return;
        }
        if (serviceRechargeDraft.source_branch_id === serviceRechargeDraft.destination_branch_id) {
            toast.error('Validation Error', 'Source and destination branches must be different.');
            return;
        }
        if (!Number(serviceRechargeDraft.amount || 0)) {
            toast.error('Validation Error', 'Enter a recharge amount greater than zero.');
            return;
        }
        if (!String(serviceRechargeDraft.description || '').trim()) {
            toast.error('Validation Error', 'Add a short recharge description.');
            return;
        }

        setServiceRechargeSaving(true);
        try {
            await accountingApi.createInternalServiceRecharge({
                source_branch_id: Number(serviceRechargeDraft.source_branch_id),
                destination_branch_id: Number(serviceRechargeDraft.destination_branch_id),
                service_type: serviceRechargeDraft.service_type,
                amount: Number(serviceRechargeDraft.amount),
                service_date: serviceRechargeDraft.service_date,
                description: serviceRechargeDraft.description,
                notes: serviceRechargeDraft.notes || undefined,
            });
            setShowServiceRechargeModal(false);
            setReloadToken((current) => current + 1);
            toast.success('Service Recharge Posted', 'Internal service recharge was posted for both branches.');
        } catch (err: any) {
            toast.error('Post Failed', err?.message || 'Internal service recharge could not be posted.');
        } finally {
            setServiceRechargeSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <h1>Accounting & Finance</h1>
                        <p>Live financial overview from journals, receivables, payables, and closing activity</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.branchPicker}>
                        <Building2 size={16} />
                        <KitchenSelect
                            options={branchOptions}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <div className={styles.quickLinksGrid}>
                {accessibleQuickLinks.map((link) => (
                    <button key={link.label} className={styles.quickLink} onClick={() => navigate(`${consoleBase}/${link.path}`)}>
                        <div className={styles.qlIcon} style={{ background: `color-mix(in srgb, ${link.color} 15%, transparent)`, color: link.color }}>
                            <link.icon size={16} />
                        </div>
                        <span>{link.label}</span>
                    </button>
                ))}
            </div>

            {error && <div className={styles.polishedPanel}><p>{error}</p></div>}
            {loading && <div className={styles.polishedPanel}><p>Loading dashboard...</p></div>}

            {!loading && !error && (
                <>
                    <div className={styles.kpiGrid}>
                        {kpiCards.map((kpi) => (
                            <div key={kpi.label} className={styles.kpiCard}>
                                <div className={styles.kpiIconWrap} style={{ background: `color-mix(in srgb, ${kpi.accent} 12%, transparent)`, color: kpi.accent }}>
                                    <kpi.icon size={18} />
                                </div>
                                <div className={styles.kpiContent}>
                                    <div className={styles.kpiHeaderRow}>
                                        <span className={styles.kpiLabel}>{kpi.label}</span>
                                        <span className={`${styles.kpiTrend} ${kpi.up ? styles.trendUp : styles.trendDown}`}>
                                            {kpi.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                            {kpi.trend}
                                        </span>
                                    </div>
                                    <h3 className={styles.kpiValue}>{formatPKR(kpi.value)}</h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedBranch === 'all' && ownershipOverview && (
                        <div className={styles.ownershipRow}>
                            <div className={styles.polishedPanel}>
                                <div className={styles.panelHeader}>
                                    <h3>Ownership View</h3>
                                    <span className={styles.panelPeriod}>Cross-branch finance comparison</span>
                                </div>
                                <div className={styles.ownershipBody}>
                                    <div className={styles.ownershipRollupGrid}>
                                        <div className={styles.ownershipCard}>
                                            <span className={styles.ownershipLabel}>Profitable Branches</span>
                                            <strong className={styles.ownershipValue}>{Number(ownershipRollup?.profitable_branch_count ?? 0)} / {Number(ownershipRollup?.branch_count ?? 0)}</strong>
                                            <span className={styles.ownershipMeta}>Branches holding positive current-period margin</span>
                                        </div>
                                        <div className={styles.ownershipCard}>
                                            <span className={styles.ownershipLabel}>Branches With Blockers</span>
                                            <strong className={styles.ownershipValue}>{Number(ownershipRollup?.branches_with_close_blockers ?? 0)}</strong>
                                            <span className={styles.ownershipMeta}>{Number(ownershipRollup?.exception_backlog_count ?? 0)} total unresolved blocker signals</span>
                                        </div>
                                        <div className={styles.ownershipCard}>
                                            <span className={styles.ownershipLabel}>Receivables Pressure</span>
                                            <strong className={styles.ownershipValue}>{Number(ownershipRollup?.branches_with_receivables_pressure ?? 0)}</strong>
                                            <span className={styles.ownershipMeta}>Branches where open receivables are heavy versus current revenue</span>
                                        </div>
                                        <div className={styles.ownershipCard}>
                                            <span className={styles.ownershipLabel}>Top Cash Branch</span>
                                            <strong className={styles.ownershipValue}>{ownershipRollup?.top_cash_branch_name ?? 'None'}</strong>
                                            <span className={styles.ownershipMeta}>{formatPKR(Number(ownershipRollup?.top_cash_branch_balance ?? 0))} across cash and bank</span>
                                        </div>
                                    </div>
                                    <div className={styles.ownershipFocus}>
                                        <strong>
                                            Strongest current margin: {ownershipRollup?.top_margin_branch_name ?? 'None'}
                                            {ownershipRollup?.top_margin_branch_name ? ` (${Number(ownershipRollup?.top_margin_percent ?? 0).toFixed(1)}%)` : ''}
                                        </strong>
                                        <span>
                                            Weakest current margin: {ownershipRollup?.weakest_margin_branch_name ?? 'None'}
                                            {ownershipRollup?.weakest_margin_branch_name ? ` (${Number(ownershipRollup?.weakest_margin_percent ?? 0).toFixed(1)}%)` : ''}
                                        </span>
                                        <p>
                                            Use this layer to compare branch profitability, exposure, and close pressure before drilling into branch-specific control screens.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.polishedPanel}>
                                <div className={styles.panelHeader}>
                                    <h3>Exception Trend</h3>
                                    <span className={styles.panelPeriod}>Trailing 6 Months</span>
                                </div>
                                <div className={styles.panelBody}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={ownershipExceptionTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip formatter={(value) => Number(value ?? 0).toLocaleString()} />
                                            <Legend />
                                            <Bar dataKey="cash_variances" name="Cash Variances" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                            <Bar dataKey="treasury_exceptions" name="Treasury Exceptions" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                            <Bar dataKey="reopens" name="Period Reopens" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedBranch === 'all' && ownershipBranchComparison.length > 0 && (
                        <div className={styles.ownerBranchRow}>
                            <div className={styles.polishedPanel}>
                                <div className={styles.panelHeader}>
                                    <h3>Branch Comparison</h3>
                                    <span className={styles.panelPeriod}>Current period performance and control load</span>
                                </div>
                                <div className={styles.branchComparisonTable}>
                                    <div className={styles.branchComparisonHead}>
                                        <span>Branch</span>
                                        <span>Revenue</span>
                                        <span>Net Profit</span>
                                        <span>Receivables</span>
                                        <span>Payables</span>
                                        <span>Blockers</span>
                                    </div>
                                    {ownershipBranchComparison.map((row: any) => (
                                        <button
                                            key={row.branch_id}
                                            type="button"
                                            className={styles.branchComparisonRow}
                                            onClick={() => setSelectedBranch(String(row.branch_id))}
                                        >
                                            <div>
                                                <strong>{row.branch_name}</strong>
                                                <small>
                                                    Margin {Number(row.margin_percent ?? 0).toFixed(1)}% · Cash {formatPKR(Number(row.cash_balance ?? 0) + Number(row.bank_balance ?? 0))}
                                                </small>
                                            </div>
                                            <span>{formatPKR(Number(row.revenue ?? 0))}</span>
                                            <span className={Number(row.net_profit ?? 0) >= 0 ? styles.trendUp : styles.trendDown}>
                                                {formatPKR(Number(row.net_profit ?? 0))}
                                            </span>
                                            <span>{formatPKR(Number(row.receivables_balance ?? 0))}</span>
                                            <span>{formatPKR(Number(row.payables_balance ?? 0))}</span>
                                            <span>{Number(row.blocker_count ?? 0)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.chartsRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Revenue vs Expenses</h3>
                                <span className={styles.panelPeriod}>Trailing 12 Months</span>
                            </div>
                            <div className={styles.panelBody}>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={formatAxis} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12, backdropFilter: 'blur(12px)' }}
                                            formatter={(value) => [`PKR ${Number(value ?? 0).toLocaleString()}`, '']}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fillOpacity={1} fill="url(#gradRevenue)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fillOpacity={1} fill="url(#gradExpense)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Expense Breakdown</h3>
                                <span className={styles.panelPeriod}>Current Period</span>
                            </div>
                            <div className={styles.panelBody}>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                                        <XAxis type="number" tickFormatter={formatAxis} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="category" width={100} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12, backdropFilter: 'blur(12px)' }}
                                            formatter={(value) => [`PKR ${Number(value ?? 0).toLocaleString()}`, 'Amount']}
                                            cursor={{ fill: 'var(--bg-section)' }}
                                        />
                                        <Bar dataKey="amount" fill="var(--accent-primary, #6366f1)" radius={[0, 4, 4, 0]} barSize={14} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className={styles.bottomRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Receivables Aging</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/accounting/receivables`)} disabled={!canViewAccountingReports}>
                                    Review Collections <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.panelBody} style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '180px' }}>
                                <ResponsiveContainer width="45%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={receivablesAging}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={75}
                                            paddingAngle={2}
                                            dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {receivablesAging.map((_: any, index: number) => (
                                                <Cell key={index} fill={PIE_COLORS[index]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12, backdropFilter: 'blur(12px)' }}
                                            formatter={(value) => [`PKR ${Number(value ?? 0).toLocaleString()}`, '']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className={styles.agingLegend}>
                                    {receivablesAging.map((item: any, i: number) => (
                                        <div key={item.name} className={styles.agingItem}>
                                            <span className={styles.agingDot} style={{ background: PIE_COLORS[i] }} />
                                            <span className={styles.agingLabel}>{item.name}</span>
                                            <span className={styles.agingValue}>{formatPKR(Number(item.value ?? 0))}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.receivablesPriorityStrip}>
                                <div className={styles.receivablesPriorityCard}>
                                    <span className={styles.receivablesPriorityLabel}>Critical Accounts</span>
                                    <strong>{Number(summary.receivables_critical_customer_count ?? 0)}</strong>
                                    <small>{Number(summary.receivables_policy_breach_customer_count ?? 0)} policy breach</small>
                                </div>
                                <div className={styles.receivablesPriorityCard}>
                                    <span className={styles.receivablesPriorityLabel}>High Priority Follow-Up</span>
                                    <strong>{Number(summary.receivables_follow_up_due_count ?? 0)}</strong>
                                    <small>{Number(summary.receivables_over_limit_customer_count ?? 0)} over limit</small>
                                </div>
                                <div className={styles.receivablesPriorityFocus}>
                                    <strong>{summary.receivables_top_priority_customer_name || 'Receivables currently stable'}</strong>
                                    <p>{summary.receivables_top_priority_action || 'No urgent collection action is currently in scope.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Recent Journal Entries</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/accounting/journal-entries`)} disabled={!canViewJournalEntries}>
                                    View All <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.entryList}>
                                {recentEntries.map((entry: any) => (
                                    <div key={entry.id} className={styles.entryRow}>
                                        <div className={styles.entryLeft}>
                                            <span className={styles.entryId}>{`JE-${String(entry.id).padStart(4, '0')}`}</span>
                                            <span className={styles.entryDesc}>{entry.description || 'Journal Entry'}</span>
                                            <span className={styles.entryDate}>{new Date(entry.transaction_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</span>
                                        </div>
                                        <div className={styles.entryRight}>
                                            <span className={styles.entryAmount}>{formatPKR(Number(entry.total_debit ?? 0))}</span>
                                            <span className={`${styles.sourceBadge} ${styles[`source${resolveSourceLabel(entry.source_module)}`]}`}>{resolveSourceLabel(entry.source_module)}</span>
                                        </div>
                                    </div>
                                ))}
                                {recentEntries.length === 0 && <p>No journal activity recorded yet.</p>}
                            </div>
                        </div>
                    </div>

                    <div className={styles.payablesCompositionRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Payables Composition</h3>
                                <span className={styles.panelPeriod}>
                                    {summary.payables_top_source_label
                                        ? `Largest: ${summary.payables_top_source_label}`
                                        : 'No active vendor payables'}
                                </span>
                            </div>
                            <div className={styles.payablesCompositionBody}>
                                <div className={styles.payablesCompositionGrid}>
                                    {payablesComposition.map((item) => (
                                        <div key={item.label} className={styles.payablesCompositionCard}>
                                            <span className={styles.payablesCompositionLabel}>{item.label}</span>
                                            <strong className={styles.payablesCompositionValue}>{formatPKR(item.amount)}</strong>
                                            <span className={styles.payablesCompositionMeta}>{item.count} open documents</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.payablesCompositionFocus}>
                                    <strong>{summary.payables_top_source_label ?? 'Payables currently clear'}</strong>
                                    <span>{formatPKR(Number(summary.payables_top_source_amount ?? 0))}</span>
                                    <p>
                                        Finance can now see how much AP is coming from stock/vendor bills versus urgent credit expenses
                                        before review, settlement, and month close.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.laborCostingRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Labor Costing</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(buildPayrollPath())} disabled={!canViewPayroll}>
                                    Review Payroll <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.laborCostingBody}>
                                <div className={styles.laborCostingMetrics}>
                                    {laborCostingCards.map((card) => (
                                        <div key={card.label} className={styles.laborCostingCard}>
                                            <span className={styles.laborCostingLabel}>{card.label}</span>
                                            <strong className={styles.laborCostingValue}>{card.value}</strong>
                                            <span className={styles.laborCostingMeta}>{card.meta}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.laborCostingFocus}>
                                    <strong>
                                        {laborCosting?.latest_run
                                            ? `${laborCosting.latest_run.run_no} · ${String(laborCosting.latest_run.status || '').replace('_', ' ')}`
                                            : 'No payroll run has been posted in the current scope yet.'}
                                    </strong>
                                    <span>
                                        {laborCosting?.latest_run
                                            ? `${formatPKR(Number(laborCosting.latest_run.total_net_amount ?? 0))} for ${Number(laborCosting.latest_run.employee_count ?? 0)} employees on ${new Date(laborCosting.latest_run.pay_date).toLocaleDateString('en-PK')}`
                                            : `${formatPKR(Number(laborCosting?.current_period_payroll_unpaid ?? 0))} remains unpaid in the current payroll period.`}
                                    </span>
                                    <p>
                                        {selectedBranch === 'all' && laborCosting?.top_branch_name
                                            ? `${laborCosting.top_branch_name} carries the largest labor exposure this month at ${formatPKR(Number(laborCosting.top_branch_labor_cost ?? 0))}.`
                                            : `Use payroll review to settle approved runs, then confirm labor cost is flowing into branch P&L and payroll payable correctly.`}
                                    </p>
                                    <div className={styles.laborCostingQueue}>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Accrued This Period</span>
                                            <strong>{formatPKR(Number(laborCosting?.current_period_payroll_accrued ?? 0))}</strong>
                                        </div>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Paid This Period</span>
                                            <strong>{formatPKR(Number(laborCosting?.current_period_payroll_paid ?? 0))}</strong>
                                        </div>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Draft Runs</span>
                                            <strong>{Number(laborCosting?.draft_runs ?? 0)}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Payroll Compliance</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(buildPayrollPath())} disabled={!canViewPayroll}>
                                    Review Payroll <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.laborCostingBody}>
                                <div className={styles.laborCostingMetrics}>
                                    {payrollComplianceCards.map((card) => (
                                        <div key={card.label} className={styles.laborCostingCard}>
                                            <span className={styles.laborCostingLabel}>{card.label}</span>
                                            <strong className={styles.laborCostingValue}>{card.value}</strong>
                                            <span className={styles.laborCostingMeta}>{card.meta}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.laborCostingFocus}>
                                    <strong>
                                        {payrollCompliance?.latest_run
                                            ? `${payrollCompliance.latest_run.run_no} · ${String(payrollCompliance.latest_run.status || '').replace('_', ' ')}`
                                            : 'No payroll compliance posting has been created in the current scope yet.'}
                                    </strong>
                                    <span>
                                        Tax {formatPKR(Number(payrollCompliance?.current_period_income_tax_amount ?? 0))}
                                        {' '}· EOBI {formatPKR(Number((payrollCompliance?.current_period_eobi_employee_amount ?? 0) + (payrollCompliance?.current_period_eobi_employer_amount ?? 0)))}
                                        {' '}· SS {formatPKR(Number((payrollCompliance?.current_period_social_security_employee_amount ?? 0) + (payrollCompliance?.current_period_social_security_employer_amount ?? 0)))}
                                    </span>
                                    <p>
                                        Review payroll approval and liability settlement together. Statutory payroll is now visible as a separate finance-control layer,
                                        not just part of payroll payable.
                                    </p>
                                    <div className={styles.laborCostingQueue}>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Withholding Tax Payable</span>
                                            <strong>{formatPKR(Number(payrollCompliance?.withholding_tax_payable_balance ?? 0))}</strong>
                                        </div>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>EOBI Payable</span>
                                            <strong>{formatPKR(Number(payrollCompliance?.eobi_payable_balance ?? 0))}</strong>
                                        </div>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Social Security Payable</span>
                                            <strong>{formatPKR(Number(payrollCompliance?.social_security_payable_balance ?? 0))}</strong>
                                        </div>
                                        <div className={styles.laborCostingQueueRow}>
                                            <span>Latest Filing</span>
                                            <strong>
                                                {payrollCompliance?.latest_filing_date
                                                    ? new Date(payrollCompliance.latest_filing_date).toLocaleDateString('en-PK')
                                                    : 'Not filed'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.treasuryRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Treasury Exceptions</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/accounting/vouchers`)} disabled={!canViewVouchers}>
                                    Review Vouchers <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.treasuryBody}>
                                <div className={styles.treasuryMetrics}>
                                    <div className={styles.treasuryMetricCard}>
                                        <span className={styles.treasuryMetricLabel}>Total Issues</span>
                                        <strong className={styles.treasuryMetricValue}>{Number(treasuryExceptionSummary.count ?? 0)}</strong>
                                    </div>
                                    <div className={styles.treasuryMetricCard}>
                                        <span className={styles.treasuryMetricLabel}>Pending</span>
                                        <strong className={styles.treasuryMetricValue}>{Number(treasuryExceptionSummary.pending_count ?? 0)}</strong>
                                    </div>
                                    <div className={styles.treasuryMetricCard}>
                                        <span className={styles.treasuryMetricLabel}>Approved</span>
                                        <strong className={styles.treasuryMetricValue}>{Number(treasuryExceptionSummary.approved_count ?? 0)}</strong>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${styles.treasuryMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.treasuryMetricLabel}>Aged Treasury Deposits</span>
                                        <strong className={styles.treasuryMetricValue}>
                                            {Number(treasuryDepositExceptions?.overdue_safe_handover_count ?? 0) + Number(treasuryDepositExceptions?.overdue_transit_batch_count ?? 0)}
                                        </strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.treasuryMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.treasuryMetricLabel}>Cash Office Follow-Up</span>
                                        <strong className={styles.treasuryMetricValue}>
                                            {Number(treasuryDepositExceptions?.cash_variance_follow_up_count ?? 0) + Number(treasuryDepositExceptions?.deposit_variance_batch_count ?? 0)}
                                        </strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.treasuryMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.treasuryMetricLabel}>Aged Merchant Clearing</span>
                                        <strong className={styles.treasuryMetricValue}>
                                            {Number(treasuryDepositExceptions?.aged_merchant_settlement_count ?? 0)}
                                        </strong>
                                    </button>
                                </div>
                                {treasuryWorkflowSummary && (
                                    <div className={styles.treasuryAlert}>
                                        <strong>{treasuryWorkflowSummary.top_item_label || 'Treasury exception closure is active in this scope.'}</strong>
                                        <span>
                                            Open {Number(treasuryWorkflowSummary.open_count ?? 0)}
                                            {' '}· In review {Number(treasuryWorkflowSummary.in_review_count ?? 0)}
                                            {' '}· Resolved {Number(treasuryWorkflowSummary.resolved_count ?? 0)}
                                            {' '}· Waived {Number(treasuryWorkflowSummary.waived_count ?? 0)}
                                        </span>
                                        <p>
                                            {treasuryWorkflowSummary.top_item_reference
                                                ? `${treasuryWorkflowSummary.top_item_reference} is the current top treasury follow-up item. ${formatPKR(Number(treasuryWorkflowSummary.blocker_amount ?? 0))} still sits in active close blockers.`
                                                : `${Number(treasuryWorkflowSummary.active_count ?? 0)} active treasury exception(s) remain in workflow, with ${Number(treasuryWorkflowSummary.blocker_count ?? 0)} still marked as close blockers.`}
                                        </p>
                                    </div>
                                )}
                                {(Number(treasuryDepositExceptions?.aged_merchant_settlement_count ?? 0) > 0 || Number(treasuryDepositExceptions?.merchant_provider_count ?? 0) > 0) && (
                                    <div className={styles.treasuryAlert}>
                                        <strong>
                                            {Number(treasuryDepositExceptions?.aged_merchant_settlement_count ?? 0) > 0
                                                ? 'Merchant processor receipts are aging beyond expected settlement timing.'
                                                : 'Merchant settlement exposure is concentrated by provider/channel.'}
                                        </strong>
                                        <span>
                                            Aged clearing {formatPKR(Number(treasuryDepositExceptions?.aged_merchant_settlement_amount ?? 0))}
                                            {' '}· Top provider {treasuryDepositExceptions?.top_merchant_provider_name || 'No provider'}
                                        </span>
                                        <p>
                                            {treasuryDepositExceptions?.top_aged_merchant_reference
                                                ? `${treasuryDepositExceptions.top_aged_merchant_reference} has been open for ${Number(treasuryDepositExceptions?.top_aged_merchant_days ?? 0)} day(s).`
                                                : treasuryDepositExceptions?.top_merchant_shortfall_name
                                                    ? `${treasuryDepositExceptions.top_merchant_shortfall_name}${treasuryDepositExceptions?.top_merchant_shortfall_channel_label ? ` (${treasuryDepositExceptions.top_merchant_shortfall_channel_label})` : ''} shows ${formatPKR(Number(treasuryDepositExceptions?.top_merchant_shortfall_amount ?? 0))} in settlement shortfall/charges.`
                                                    : 'Review merchant settlement exposure in treasury management.'}
                                        </p>
                                    </div>
                                )}
                                {(Number(treasuryDepositExceptions?.cash_variance_follow_up_count ?? 0) > 0 || Number(treasuryDepositExceptions?.deposit_variance_batch_count ?? 0) > 0) && (
                                    <div className={styles.treasuryAlert}>
                                        <strong>Cash office and deposit variance follow-up is still open.</strong>
                                        <span>
                                            Over/short {formatPKR(Number(treasuryDepositExceptions?.cash_variance_follow_up_amount ?? 0))}
                                            {' '}/ Deposit gaps {formatPKR(Number(treasuryDepositExceptions?.deposit_variance_amount ?? 0))}
                                        </span>
                                        <p>
                                            {treasuryDepositExceptions?.top_deposit_variance_reference
                                                || (treasuryDepositExceptions?.top_cash_variance_date
                                                    ? `${treasuryDepositExceptions?.top_cash_variance_branch_name || 'Branch'} ${new Date(treasuryDepositExceptions.top_cash_variance_date).toLocaleDateString('en-PK')}`
                                                    : 'Review close over/short and deposit source gaps.' )}
                                        </p>
                                    </div>
                                )}
                                {(Number(treasuryDepositExceptions?.overdue_safe_handover_count ?? 0) > 0 || Number(treasuryDepositExceptions?.overdue_transit_batch_count ?? 0) > 0) && (
                                    <div className={styles.treasuryAlert}>
                                        <strong>{treasuryDepositExceptions?.top_issue ?? 'Treasury deposits need closure review.'}</strong>
                                        <span>
                                            Safe handovers {formatPKR(Number(treasuryDepositExceptions?.overdue_safe_handover_amount ?? 0))}
                                            {' '}/ In transit {formatPKR(Number(treasuryDepositExceptions?.overdue_transit_amount ?? 0))}
                                        </span>
                                        <p>
                                            {treasuryDepositExceptions?.top_overdue_transit_reference
                                                || treasuryDepositExceptions?.top_overdue_safe_reference
                                                || 'Review aged safe handovers and in-transit deposits before month close.'}
                                        </p>
                                    </div>
                                )}
                                {topTreasuryException ? (
                                    <div className={styles.treasuryAlert}>
                                        <strong>{formatConfiguredDocumentNumber(topTreasuryException.voucher_no, activeBranch || topTreasuryException, { preserveTypePrefix: true }) || topTreasuryException.voucher_no} · {topTreasuryException.branch_name}</strong>
                                        <span>{topTreasuryException.vendor_name}</span>
                                        <p>{(topTreasuryException.issues || []).join(' ')}</p>
                                    </div>
                                ) : (
                                    <div className={styles.treasuryOk}>
                                        No treasury source exceptions detected in the current branch scope.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.interBranchSettlementRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Inter-Branch Settlement</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(buildInterBranchReviewPath())} disabled={!canReviewInterBranchSettlement}>
                                    Review Transfers <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.interBranchSettlementBody}>
                                <div className={styles.interBranchSettlementMetrics}>
                                    <div className={styles.interBranchSettlementCard}>
                                        <span className={styles.interBranchSettlementLabel}>Finance Attention</span>
                                        <strong className={styles.interBranchSettlementValue}>{Number(interBranchSettlementSummary.finance_attention_count ?? 0)}</strong>
                                        <span className={styles.interBranchSettlementMeta}>{Number(interBranchSettlementSummary.transfer_count ?? 0)} tracked transfers</span>
                                    </div>
                                    <div className={styles.interBranchSettlementCard}>
                                        <span className={styles.interBranchSettlementLabel}>Clearing Receivable</span>
                                        <strong className={styles.interBranchSettlementValue}>{formatPKR(Number(interBranchSettlementSummary.total_receivable_balance ?? 0))}</strong>
                                        <span className={styles.interBranchSettlementMeta}>{Number(interBranchSettlementSummary.in_transit_count ?? 0)} receipt-side postings pending</span>
                                    </div>
                                    <div className={styles.interBranchSettlementCard}>
                                        <span className={styles.interBranchSettlementLabel}>Internal Recharge Base</span>
                                        <strong className={styles.interBranchSettlementValue}>{formatPKR(Number(interBranchSettlementSummary.recharge_candidate_amount ?? 0))}</strong>
                                        <span className={styles.interBranchSettlementMeta}>
                                            {Number(interBranchSettlementSummary.recharge_candidate_count ?? 0)} central-to-branch supplies in scope
                                            {Number(interBranchSettlementSummary.recharge_posted_count ?? 0) > 0 ? ` · ${Number(interBranchSettlementSummary.recharge_posted_count ?? 0)} posted` : ''}
                                            {Number(interBranchSettlementSummary.recharge_pending_count ?? 0) > 0 ? ` · ${Number(interBranchSettlementSummary.recharge_pending_count ?? 0)} pending` : ''}
                                        </span>
                                    </div>
                                    <div className={styles.interBranchSettlementCard}>
                                        <span className={styles.interBranchSettlementLabel}>Clearing Payable</span>
                                        <strong className={styles.interBranchSettlementValue}>{formatPKR(Number(interBranchSettlementSummary.total_payable_balance ?? 0))}</strong>
                                        <span className={styles.interBranchSettlementMeta}>
                                            {Number(interBranchSettlementSummary.variance_review_count ?? 0)} variance reviews in queue
                                            {Number(interBranchSettlementSummary.reviewed_variance_count ?? 0) > 0 ? ` / ${Number(interBranchSettlementSummary.reviewed_variance_count ?? 0)} reviewed` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.interBranchSettlementFocus}>
                                    <strong>{interBranchSettlementSummary.top_exposure_branch_name ?? 'No branch clearing exposure in current scope.'}</strong>
                                    <span>{formatPKR(Number(interBranchSettlementSummary.top_exposure_amount ?? 0))}</span>
                                    <p>
                                        Review dispatch-vs-receipt clearing before branch balances drift between sending and receiving locations.
                                    </p>
                                    {interBranchSettlementSummary.top_recharge_branch_name && (
                                        <p>
                                            Largest in-scope internal recharge currently sits with <strong>{interBranchSettlementSummary.top_recharge_branch_name}</strong> at {formatPKR(Number(interBranchSettlementSummary.top_recharge_amount ?? 0))}.
                                        </p>
                                    )}
                                    <div className={styles.interBranchSettlementQueue}>
                                        {interBranchSettlementQueue.length > 0 ? interBranchSettlementQueue.map((item: any) => (
                                            <button
                                                key={item.transfer_id}
                                                type="button"
                                                className={styles.interBranchSettlementQueueRow}
                                                onClick={() => navigate(buildInterBranchReviewPath())}
                                                disabled={!canReviewInterBranchSettlement}
                                            >
                                                <div>
                                                    <strong>{item.transfer_no} · {item.route}</strong>
                                                    <span>{item.top_note}</span>
                                                </div>
                                                <div className={styles.interBranchSettlementQueueMeta}>
                                                    <span>{item.status_label}</span>
                                                    <small>
                                                        {formatPKR(Number(item.dispatched_amount ?? 0))}
                                                        {Number(item.variance_amount ?? 0) > 0 ? ` · Variance ${formatPKR(Number(item.variance_amount ?? 0))}` : ''}
                                                    </small>
                                                </div>
                                            </button>
                                        )) : (
                                            <div className={styles.interBranchSettlementOk}>
                                                Inter-branch clearing is currently clean in this scope.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.serviceRechargeRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Internal Service Recharge</h3>
                                <button className={styles.viewAllBtn} onClick={openServiceRechargeModal} disabled={!canPostAccounting}>
                                    Post Recharge <Plus size={14} />
                                </button>
                            </div>
                            <div className={styles.serviceRechargeBody}>
                                <div className={styles.serviceRechargeMetrics}>
                                    <div className={styles.serviceRechargeCard}>
                                        <span className={styles.serviceRechargeLabel}>Current Period</span>
                                        <strong className={styles.serviceRechargeValue}>{formatPKR(Number(serviceRechargeSummary?.current_period_amount ?? 0))}</strong>
                                        <span className={styles.serviceRechargeMeta}>{Number(serviceRechargeSummary?.current_period_count ?? 0)} posted service recharge(s)</span>
                                    </div>
                                    <div className={styles.serviceRechargeCard}>
                                        <span className={styles.serviceRechargeLabel}>Top Source Branch</span>
                                        <strong className={styles.serviceRechargeValue}>{serviceRechargeSummary?.top_source_branch_name ?? 'None'}</strong>
                                        <span className={styles.serviceRechargeMeta}>Largest service recharge issuer in current scope</span>
                                    </div>
                                    <div className={styles.serviceRechargeCard}>
                                        <span className={styles.serviceRechargeLabel}>Top Destination Branch</span>
                                        <strong className={styles.serviceRechargeValue}>{serviceRechargeSummary?.top_destination_branch_name ?? 'None'}</strong>
                                        <span className={styles.serviceRechargeMeta}>Largest internal service cost receiver in current scope</span>
                                    </div>
                                </div>
                                <div className={styles.serviceRechargeQueue}>
                                    {recentServiceRecharges.length > 0 ? recentServiceRecharges.map((row: any) => (
                                        <div key={row.id} className={styles.serviceRechargeRowItem}>
                                            <div>
                                                <strong>{row.recharge_no} · {row.source_branch_name} → {row.destination_branch_name}</strong>
                                                <span>{row.description}</span>
                                                <small>
                                                    {SERVICE_RECHARGE_TYPES.find((option) => option.value === row.service_type)?.label ?? row.service_type}
                                                    {row.source_journal_id ? ` · Source #${row.source_journal_id}` : ''}
                                                    {row.destination_journal_id ? ` · Destination #${row.destination_journal_id}` : ''}
                                                </small>
                                            </div>
                                            <div className={styles.serviceRechargeQueueMeta}>
                                                <strong>{formatPKR(Number(row.amount ?? 0))}</strong>
                                                <span>{new Date(row.service_date).toLocaleDateString('en-PK')}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className={styles.serviceRechargeOk}>
                                            No internal service recharge has been posted in the current scope yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.closeReadinessRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Month-Close Readiness</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/finance/reconciliation`)} disabled={!canViewBankReconciliation}>
                                    Review Controls <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.closeReadinessBody}>
                                <div className={styles.closeReadinessMetrics}>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('pending_bill'))}
                                        disabled={!canReviewPendingBills}
                                    >
                                        <span className={styles.closeMetricLabel}>Pending-Bill GRNs</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.pending_bill_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{formatPKR(Number(closeReadiness?.pending_bill_amount ?? 0))}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('overdue_ap'))}
                                        disabled={!canViewAccountingReports}
                                    >
                                        <span className={styles.closeMetricLabel}>Overdue AP</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.overdue_payable_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{formatPKR(Number(closeReadiness?.overdue_payable_amount ?? 0))}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('unreconciled_vendor_payments'))}
                                        disabled={!canViewBankReconciliation}
                                    >
                                        <span className={styles.closeMetricLabel}>Unreconciled Vendor Payments</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.unreconciled_vendor_payment_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{formatPKR(Number(closeReadiness?.unreconciled_vendor_payment_amount ?? 0))}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_exceptions'))}
                                        disabled={!canViewVouchers}
                                    >
                                        <span className={styles.closeMetricLabel}>Treasury Exceptions</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.treasury_exception_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{Number(closeReadiness?.issue_count ?? 0)} close blockers</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.closeMetricLabel}>Aged Treasury Deposits</span>
                                        <strong className={styles.closeMetricValue}>
                                            {Number(closeReadiness?.overdue_safe_handover_count ?? 0) + Number(closeReadiness?.overdue_transit_batch_count ?? 0)}
                                        </strong>
                                        <span className={styles.closeMetricMeta}>
                                            {formatPKR(Number(closeReadiness?.overdue_safe_handover_amount ?? 0) + Number(closeReadiness?.overdue_transit_amount ?? 0))}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.closeMetricLabel}>Cash / Deposit Variance</span>
                                        <strong className={styles.closeMetricValue}>
                                            {Number(closeReadiness?.cash_variance_follow_up_count ?? 0) + Number(closeReadiness?.deposit_variance_batch_count ?? 0)}
                                        </strong>
                                        <span className={styles.closeMetricMeta}>
                                            {formatPKR(Number(closeReadiness?.cash_variance_follow_up_amount ?? 0) + Number(closeReadiness?.deposit_variance_amount ?? 0))}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('treasury_deposit_exceptions'))}
                                        disabled={!canViewBankAccounts}
                                    >
                                        <span className={styles.closeMetricLabel}>Aged Merchant Clearing</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.aged_merchant_settlement_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>
                                            {formatPKR(Number(closeReadiness?.aged_merchant_settlement_amount ?? 0))}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(`${consoleBase}/accounting/settings`)}
                                        disabled={!canManageAccountingSettings}
                                    >
                                        <span className={styles.closeMetricLabel}>Pending Accruals</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.pending_accrual_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{formatPKR(Number(closeReadiness?.pending_accrual_amount ?? 0))}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(`${consoleBase}/accounting/settings`)}
                                        disabled={!canManageAccountingSettings}
                                    >
                                        <span className={styles.closeMetricLabel}>Close Schedules</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.overdue_close_adjustment_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>
                                            {Number(closeReadiness?.close_adjustment_schedule_count ?? 0)} in scope · {formatPKR(Number(closeReadiness?.close_adjustment_schedule_amount ?? 0))}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(buildCloseReviewPath('payroll_compliance'))}
                                        disabled={!canViewPayroll}
                                    >
                                        <span className={styles.closeMetricLabel}>Payroll Compliance</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.payroll_compliance_open_item_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>
                                            {formatPKR(Number(closeReadiness?.payroll_compliance_payable_amount ?? 0))}
                                            {Number(closeReadiness?.payroll_compliance_overdue_unfiled_count ?? 0) > 0
                                                ? ` · ${Number(closeReadiness?.payroll_compliance_overdue_days ?? 0)}d overdue`
                                                : Number(closeReadiness?.payroll_compliance_filing_count ?? 0) > 0
                                                ? ` · ${Number(closeReadiness?.payroll_compliance_filing_count ?? 0)} filed`
                                                : ' · Filing review pending'}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.closeMetricCard} ${styles.closeMetricCardAction}`}
                                        onClick={() => navigate(`${consoleBase}/accounting/settings`)}
                                        disabled={!canManageAccountingSettings}
                                    >
                                        <span className={styles.closeMetricLabel}>Checklist Open Items</span>
                                        <strong className={styles.closeMetricValue}>{Number(closeReadiness?.checklist_pending_count ?? 0) + Number(closeReadiness?.checklist_blocked_count ?? 0)}</strong>
                                        <span className={styles.closeMetricMeta}>{Number(closeReadiness?.checklist_blocked_count ?? 0)} blocked items</span>
                                    </button>
                                </div>
                                {closeReadiness?.status === 'ready' ? (
                                    <div className={styles.closeReadyState}>
                                        Month-close controls are currently clean for the selected branch scope.
                                    </div>
                                ) : (
                                    <div className={styles.closeAlert}>
                                        <strong>{closeReadiness?.top_issue ?? 'Month-close attention required.'}</strong>
                                        <p>{Array.isArray(closeReadiness?.issues) ? closeReadiness.issues.join(' ') : 'Resolve the listed finance controls before close.'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.closeGovernanceRow}>
                        <div className={styles.polishedPanel}>
                            <div className={styles.panelHeader}>
                                <h3>Close Governance</h3>
                                <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/accounting/settings`)} disabled={!canManageAccountingSettings}>
                                    Review Governance <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className={styles.closeGovernanceBody}>
                                <div className={styles.closeGovernanceGrid}>
                                    {closeGovernanceCards.map((card) => (
                                        <div key={card.label} className={styles.closeGovernanceCard}>
                                            <span className={styles.closeGovernanceLabel}>{card.label}</span>
                                            <strong className={styles.closeGovernanceValue}>{card.value}</strong>
                                            <span className={styles.closeGovernanceMeta}>{card.meta}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.closeGovernanceFocus}>
                                    <strong>
                                        {latestDayClose?.notes
                                            ? 'Latest close includes documented finance notes.'
                                            : latestDayClose?.review_status === 'variance_review'
                                                ? 'Latest close needs variance review follow-through.'
                                                : periodLock?.mode === 'hard_lock'
                                                    ? 'Locked-period governance is active.'
                                                    : 'Close governance currently relies on live review and lock policy.'}
                                    </strong>
                                    <span>
                                        {latestDayClose
                                            ? `Business date ${new Date(latestDayClose.business_date).toLocaleDateString('en-PK')} · ${latestDayClose.journal_entry_count} linked journals`
                                            : 'No recent accounting day close is available in the selected scope.'}
                                    </span>
                                    <p>
                                        Use Accounting Settings for lock policy and close history, then Branch Day Management for operational blocker review before the next close.
                                    </p>
                                    {closeAdjustmentSchedules?.top_priority ? (
                                        <div className={styles.closeGovernanceFocus}>
                                            <strong>Close-adjustment priority: {closeAdjustmentSchedules.top_priority.close_adjustment_type_label}</strong>
                                            <span>
                                                {closeAdjustmentSchedules.top_priority.description || `JE-${String(closeAdjustmentSchedules.top_priority.id).padStart(4, '0')}`} · {closeAdjustmentSchedules.top_priority.schedule_start_date || 'No start'} to {closeAdjustmentSchedules.top_priority.schedule_end_date || 'No end'}
                                            </span>
                                            <p>
                                                {closeAdjustmentSchedules.top_priority.review_note}
                                                {' '}
                                                {Number(closeAdjustmentSchedules.overdue_prepaid_count ?? 0) > 0 || Number(closeAdjustmentSchedules.overdue_deferred_count ?? 0) > 0 || Number(closeAdjustmentSchedules.overdue_depreciation_count ?? 0) > 0
                                                    ? `Overdue mix: ${Number(closeAdjustmentSchedules.overdue_prepaid_count ?? 0)} prepaid, ${Number(closeAdjustmentSchedules.overdue_deferred_count ?? 0)} deferred, ${Number(closeAdjustmentSchedules.overdue_depreciation_count ?? 0)} depreciation.`
                                                    : 'No close-adjustment schedule is currently overdue.'}
                                            </p>
                                        </div>
                                    ) : null}
                                    <div className={styles.closeGovernanceActions}>
                                        <button className={styles.viewAllBtn} onClick={() => navigate(`${consoleBase}/accounting/settings`)} disabled={!canManageAccountingSettings}>
                                            Open Settings <ChevronRight size={14} />
                                        </button>
                                        <button className={styles.viewAllBtn} onClick={() => navigate('/terminal/day')} disabled={!canOpenBranchDay}>
                                            Open Branch Day <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showServiceRechargeModal && (
                        <div className={styles.modalOverlay} onClick={() => !serviceRechargeSaving && setShowServiceRechargeModal(false)}>
                            <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                                <div className={styles.modalHeader}>
                                    <div>
                                        <h3>Post Internal Service Recharge</h3>
                                        <p>Post non-stock branch service cost in one step. Journals will be created for both branches automatically.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.modalClose}
                                        onClick={() => setShowServiceRechargeModal(false)}
                                        disabled={serviceRechargeSaving}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className={styles.modalGrid}>
                                    <label className={styles.modalField}>
                                        <span>Source Branch</span>
                                        <select
                                            value={serviceRechargeDraft.source_branch_id}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, source_branch_id: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                        >
                                            <option value="">Select source</option>
                                            {serviceRechargeBranchRows.map((branch) => (
                                                <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className={styles.modalField}>
                                        <span>Destination Branch</span>
                                        <select
                                            value={serviceRechargeDraft.destination_branch_id}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, destination_branch_id: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                        >
                                            <option value="">Select destination</option>
                                            {serviceRechargeBranchRows.map((branch) => (
                                                <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className={styles.modalField}>
                                        <span>Service Type</span>
                                        <select
                                            value={serviceRechargeDraft.service_type}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, service_type: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                        >
                                            {SERVICE_RECHARGE_TYPES.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className={styles.modalField}>
                                        <span>Service Date</span>
                                        <input
                                            type="date"
                                            value={serviceRechargeDraft.service_date}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, service_date: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                        />
                                    </label>
                                    <label className={styles.modalField}>
                                        <span>Amount</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={serviceRechargeDraft.amount}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, amount: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                            placeholder="0.00"
                                        />
                                    </label>
                                    <label className={`${styles.modalField} ${styles.modalFieldWide}`}>
                                        <span>Description</span>
                                        <input
                                            type="text"
                                            value={serviceRechargeDraft.description}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, description: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                            placeholder="Central admin allocation for April"
                                        />
                                    </label>
                                    <label className={`${styles.modalField} ${styles.modalFieldWide}`}>
                                        <span>Notes</span>
                                        <textarea
                                            rows={3}
                                            value={serviceRechargeDraft.notes}
                                            onChange={(event) => setServiceRechargeDraft((current: any) => ({ ...current, notes: event.target.value }))}
                                            disabled={serviceRechargeSaving}
                                            placeholder="Optional support note for the internal service charge."
                                        />
                                    </label>
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.modalSecondaryBtn} onClick={() => setShowServiceRechargeModal(false)} disabled={serviceRechargeSaving}>
                                        Cancel
                                    </button>
                                    <button type="button" className={styles.modalPrimaryBtn} onClick={handleCreateServiceRecharge} disabled={serviceRechargeSaving}>
                                        {serviceRechargeSaving ? 'Posting...' : 'Post Recharge'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
