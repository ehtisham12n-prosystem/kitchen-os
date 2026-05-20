/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    AlertCircle,
    ArrowUpRight,
    BarChart3,
    Building2,
    Calendar,
    Download,
    FileText,
    Lock,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import styles from './FinancialReports.module.css';

type ReportTab = 'pl' | 'bs' | 'cf' | 'tb';
type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
    updated_by?: string | null;
};

const REPORT_TABS: { key: ReportTab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'pl', label: 'Profit & Loss', icon: TrendingUp },
    { key: 'bs', label: 'Balance Sheet', icon: Wallet },
    { key: 'cf', label: 'Cash Flow', icon: ArrowUpRight },
    { key: 'tb', label: 'Trial Balance', icon: FileText },
];

const PERIOD_OPTIONS = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Financial Year' },
    { value: 'custom', label: 'Custom Range' },
];

function formatPKR(value: number): string {
    return `PKR ${value.toLocaleString()}`;
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCompactNumber(value: number): string {
    return value.toLocaleString();
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

function downloadCsv(filename: string, rows: string[][]) {
    const content = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function ReportHeader({
    title,
    periodLabel,
    branchLabel,
    basisLabel,
}: {
    title: string;
    periodLabel: string;
    branchLabel: string;
    basisLabel: string;
}) {
    const generatedDate = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    const generatedTime = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={styles.reportHeaderData}>
            <div className={styles.rhLeft}>
                <h2>{title}</h2>
                <span className={styles.rhBranch}>{branchLabel}</span>
            </div>
            <div className={styles.rhRight}>
                <div className={styles.rhGrid}>
                    <span className={styles.rhLabel}>Basis</span>
                    <strong className={styles.rhValue}>{basisLabel}</strong>
                    <span className={styles.rhLabel}>Period</span>
                    <strong className={styles.rhValue}>{periodLabel}</strong>
                    <span className={styles.rhLabel}>Generated</span>
                    <strong className={styles.rhValue}>{generatedDate} {generatedTime}</strong>
                </div>
            </div>
        </div>
    );
}

function getTabExportRows(tab: ReportTab, data: {
    profitAndLoss: any;
    balanceSheet: any;
    trialBalance: any;
    cashFlow: any;
}) {
    if (tab === 'pl') {
        return [
            ['Account Code', 'Account Name', 'Type', 'Net Balance'],
            ...((data.profitAndLoss?.accounts ?? []).map((account: any) => [
                account.account_code,
                account.account_name,
                account.account_type,
                Number(account.net_balance ?? 0).toFixed(2),
            ])),
        ];
    }

    if (tab === 'bs') {
        return [
            ['Account Code', 'Account Name', 'Type', 'Net Balance'],
            ...((data.balanceSheet?.accounts ?? []).map((account: any) => [
                account.account_code,
                account.account_name,
                account.account_type,
                Number(account.net_balance ?? 0).toFixed(2),
            ])),
        ];
    }

    if (tab === 'tb') {
        return [
            ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit'],
            ...((data.trialBalance?.accounts ?? []).map((account: any) => [
                account.account_code,
                account.account_name,
                account.account_type,
                Number(account.total_debit ?? 0).toFixed(2),
                Number(account.total_credit ?? 0).toFixed(2),
            ])),
        ];
    }

    return [
        ['Section', 'Description', 'Amount'],
        ...(['operating', 'investing', 'financing'].flatMap((section) =>
            (data.cashFlow?.sections?.[section]?.items ?? []).map((item: any) => [
                section,
                item.description || `Journal ${item.journal_id}`,
                Number(item.amount ?? 0).toFixed(2),
            ]))),
    ];
}

export function FinancialReports() {
    const { branches, activeBranch } = useBranchContext();
    const [activeTab, setActiveTab] = useState<ReportTab>('pl');
    const [selectedBranch, setSelectedBranch] = useState(activeBranch ? String(activeBranch.branch_id) : 'all');
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
    const [dateFrom, setDateFrom] = useState(getPresetRange('this_month').dateFrom);
    const [dateTo, setDateTo] = useState(getPresetRange('this_month').dateTo);
    const [profitAndLoss, setProfitAndLoss] = useState<any>(null);
    const [balanceSheet, setBalanceSheet] = useState<any>(null);
    const [trialBalance, setTrialBalance] = useState<any>(null);
    const [cashFlow, setCashFlow] = useState<any>(null);
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
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
                const [cashFlowResponse, plResponse, bsResponse, tbResponse, periodLockResponse] = await Promise.all([
                    accountingApi.getCashFlow({ branch_id: branchId, date_from: dateFrom, date_to: dateTo }),
                    accountingApi.getPL({ branch_id: branchId, date_from: dateFrom, date_to: dateTo }),
                    accountingApi.getBalanceSheet({ branch_id: branchId, as_of_date: asOfDate }),
                    accountingApi.getTrialBalance({ branch_id: branchId, as_of_date: asOfDate }),
                    accountingApi.getPeriodLock({
                        branch_id: branchId ?? activeBranch?.branch_id ?? null,
                    }),
                ]);

                setCashFlow(cashFlowResponse);
                setProfitAndLoss(plResponse);
                setBalanceSheet(bsResponse);
                setTrialBalance(tbResponse);
                setPeriodLock(periodLockResponse ?? null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load accounting reports');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [selectedBranch, dateFrom, dateTo, activeBranch?.branch_id]);

    const branchLabel = selectedBranch === 'all'
        ? 'Consolidated - All Branches'
        : branchOptions.find((branch) => branch.value === selectedBranch)?.label || 'Selected Branch';

    const currentPeriodLabel = useMemo(() => {
        if (!dateFrom || !dateTo) return 'Period not set';
        return `${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
    }, [dateFrom, dateTo]);

    const basisLabel = activeTab === 'pl' || activeTab === 'cf'
        ? 'For the selected reporting period'
        : `As of ${formatDate(dateTo)}`;
    const cashFlowSummary = cashFlow?.summary ?? {};
    const cashFlowDominantLabel = cashFlowSummary?.dominant_section_label || 'None';
    const cashFlowReviewTone = Math.abs(Number(cashFlowSummary?.net_change_in_cash ?? 0)) < 0.01
        ? 'Stable'
        : Number(cashFlowSummary?.net_change_in_cash ?? 0) > 0
            ? 'Net Inflow'
            : 'Net Outflow';

    const summaryCards = useMemo(() => ([
        {
            label: 'Net Revenue',
            value: Number(profitAndLoss?.summary?.total_revenue ?? 0),
            tone: 'positive',
        },
        {
            label: 'Net Profit / (Loss)',
            value: Number(profitAndLoss?.summary?.net_profit ?? 0),
            tone: Number(profitAndLoss?.summary?.net_profit ?? 0) >= 0 ? 'positive' : 'negative',
        },
        {
            label: 'Closing Cash',
            value: Number(cashFlow?.summary?.closing_cash_balance ?? 0),
            tone: 'neutral',
        },
        {
            label: 'Total Assets',
            value: Number(balanceSheet?.summary?.total_assets ?? 0),
            tone: 'neutral',
        },
        {
            label: 'Liabilities & Equity',
            value: Number(balanceSheet?.summary?.total_liabilities_and_equity ?? 0),
            tone: 'warning',
        },
        {
            label: 'Balance Sheet Difference',
            value: Math.abs(Number(balanceSheet?.summary?.difference ?? 0)),
            subLabel: 'Should be zero',
            tone: Math.abs(Number(balanceSheet?.summary?.difference ?? 0)) < 0.01 ? 'positive' : 'negative',
        },
    ]), [profitAndLoss, cashFlow, balanceSheet]);

    const exportCurrentReport = () => {
        const rows = getTabExportRows(activeTab, {
            profitAndLoss,
            balanceSheet,
            trialBalance,
            cashFlow,
        });
        downloadCsv(`financial-report-${activeTab}-${dateTo || 'report'}.csv`, rows);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <BarChart3 size={18} />
                    </div>
                    <div>
                        <h1>Financial Reports</h1>
                        <p>Core financial statements for finance close, audit review, and owner-level reporting</p>
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
                    <KitchenButton variant="outline" size="sm" className={styles.actionBtn} onClick={exportCurrentReport} disabled={loading || !!error}>
                        <Download size={14} style={{ marginRight: 6 }} /> Export CSV
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.filterRow}>
                <KitchenInput
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                        setPeriodPreset('custom');
                        setDateFrom(e.target.value);
                    }}
                    className={styles.dateInput}
                />
                <KitchenInput
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                        setPeriodPreset('custom');
                        setDateTo(e.target.value);
                    }}
                    className={styles.dateInput}
                />
                <div className={styles.helperNote}>
                    Profit & Loss and Cash Flow run across the selected period. Balance Sheet and Trial Balance use the ending date as their as-of cut-off.
                </div>
            </div>

            {periodLock?.mode && periodLock.mode !== 'none' && (
                <div className={styles.lockBanner}>
                    <Lock size={16} />
                    <div>
                        <strong>{periodLock.mode === 'hard_lock' ? 'Hard period lock active.' : 'Admin-override period lock active.'}</strong>
                        <span> Locked through {formatDate(periodLock.locked_through_date)}{periodLock.updated_by ? ` by ${periodLock.updated_by}` : ''}.</span>
                    </div>
                </div>
            )}

            {!loading && !error && (
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

            <div className={styles.mainLayout}>
                <div className={`${styles.polishedPanel} ${styles.tabPanel}`}>
                    {REPORT_TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} className={`${styles.tabBtn} ${activeTab === key ? styles.tabActive : ''}`} onClick={() => setActiveTab(key)}>
                            <Icon size={16} /> {label}
                        </button>
                    ))}
                </div>

                <div className={`${styles.polishedPanel} ${styles.reportPanel}`}>
                    {error && (
                        <div className={styles.stateCard}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                    {loading && (
                        <div className={styles.stateCard}>
                            <span>Loading report...</span>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'pl' && (
                        <div className={styles.reportContent}>
                            <ReportHeader title="Profit & Loss Statement" periodLabel={currentPeriodLabel} branchLabel={branchLabel} basisLabel={basisLabel} />
                            <div className={styles.statementIntegrityStrip}>
                                <div className={styles.tbMetric}>
                                    <span>Revenue Accounts</span>
                                    <strong>{formatCompactNumber(Number(profitAndLoss?.summary?.revenue_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Expense Accounts</span>
                                    <strong>{formatCompactNumber(Number(profitAndLoss?.summary?.expense_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Gross Margin</span>
                                    <strong>{formatPKR(Number(profitAndLoss?.summary?.gross_margin ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Net Profit</span>
                                    <strong>{formatPKR(Number(profitAndLoss?.summary?.net_profit ?? 0))}</strong>
                                </div>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}><ArrowUpRight size={14} className={styles.titleIconSuccess} /> Revenue</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(profitAndLoss?.accounts ?? []).filter((account: any) => account.account_type === 'revenue').map((account: any) => (
                                        <tr key={account.account_code}>
                                            <td className={styles.accountNameCell}>{account.account_code} - {account.account_name}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(account.net_balance ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Total Revenue</strong></td>
                                        <td className={`${styles.amountCell} ${styles.positiveColor}`}><strong>{formatPKR(Number(profitAndLoss?.summary?.total_revenue ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}><AlertCircle size={14} className={styles.titleIconDanger} /> Expenses</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(profitAndLoss?.accounts ?? []).filter((account: any) => account.account_type === 'expense').map((account: any) => (
                                        <tr key={account.account_code}>
                                            <td className={styles.accountNameCell}>{account.account_code} - {account.account_name}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(account.net_balance ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Total Expenses</strong></td>
                                        <td className={`${styles.amountCell} ${styles.negativeColor}`}><strong>{formatPKR(Number(profitAndLoss?.summary?.total_expenses ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.netRow}>
                                <span>Net Profit / (Loss)</span>
                                <strong className={Number(profitAndLoss?.summary?.net_profit ?? 0) >= 0 ? styles.netAmountPos : styles.negativeColor}>
                                    {formatPKR(Number(profitAndLoss?.summary?.net_profit ?? 0))}
                                </strong>
                            </div>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'bs' && (
                        <div className={styles.reportContent}>
                            <ReportHeader title="Balance Sheet" periodLabel={currentPeriodLabel} branchLabel={branchLabel} basisLabel={basisLabel} />
                            <div className={styles.statementIntegrityStrip}>
                                <div className={styles.tbMetric}>
                                    <span>As Of</span>
                                    <strong>{formatDate(balanceSheet?.as_of_date || dateTo)}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Asset Accounts</span>
                                    <strong>{formatCompactNumber(Number(balanceSheet?.summary?.asset_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Liability/Equity Accounts</span>
                                    <strong>{formatCompactNumber(Number(balanceSheet?.summary?.liability_equity_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Difference</span>
                                    <strong>{formatPKR(Math.abs(Number(balanceSheet?.summary?.difference ?? 0)))}</strong>
                                </div>
                            </div>
                            <div className={styles.statementNote}>
                                <div className={`${styles.integrityBadge} ${Number(balanceSheet?.summary?.is_balanced ?? false) ? styles.integrityBalanced : styles.integrityUnbalanced}`}>
                                    {Number(balanceSheet?.summary?.is_balanced ?? false) ? 'Balanced' : 'Review Required'}
                                </div>
                                <span className={styles.tbIntegrityText}>
                                    Balance sheet difference is <strong>{formatPKR(Math.abs(Number(balanceSheet?.summary?.difference ?? 0)))}</strong>.
                                </span>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}><Wallet size={14} className={styles.titleIconPrimary} /> Assets</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(balanceSheet?.accounts ?? []).filter((account: any) => account.account_type === 'asset').map((account: any) => (
                                        <tr key={account.account_code}>
                                            <td className={`${styles.accountNameCell} ${styles.indented}`}>{account.account_code} - {account.account_name}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(account.net_balance ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Total Assets</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(Number(balanceSheet?.summary?.total_assets ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}>Liabilities & Equity</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(balanceSheet?.accounts ?? []).filter((account: any) => account.account_type === 'liability' || account.account_type === 'equity').map((account: any) => (
                                        <tr key={account.account_code}>
                                            <td className={`${styles.accountNameCell} ${styles.indented}`}>{account.account_code} - {account.account_name}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(account.net_balance ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className={`${styles.accountNameCell} ${styles.indented}`}>Retained Earnings</td>
                                        <td className={styles.amountCell}>{formatPKR(Number(balanceSheet?.summary?.retained_earnings ?? 0))}</td>
                                    </tr>
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Total Liabilities & Equity</strong></td>
                                        <td className={`${styles.amountCell} ${styles.positiveColor}`}><strong>{formatPKR(Number(balanceSheet?.summary?.total_liabilities_and_equity ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'tb' && (
                        <div className={styles.reportContent}>
                            <ReportHeader title="Trial Balance" periodLabel={currentPeriodLabel} branchLabel={branchLabel} basisLabel={basisLabel} />
                            <div className={styles.trialBalanceSummary}>
                                <div className={styles.tbMetric}>
                                    <span>As Of</span>
                                    <strong>{formatDate(trialBalance?.as_of_date || dateTo)}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Non-Zero Accounts</span>
                                    <strong>{formatCompactNumber(Number(trialBalance?.summary?.non_zero_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Control Accounts</span>
                                    <strong>{formatCompactNumber(Number(trialBalance?.summary?.control_account_count ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Manual Post Restricted</span>
                                    <strong>{formatCompactNumber(Number(trialBalance?.summary?.manual_posting_restricted_count ?? 0))}</strong>
                                </div>
                            </div>
                            <div className={styles.tbIntegrityRow}>
                                <div className={`${styles.integrityBadge} ${Number(trialBalance?.summary?.difference ?? 0) === 0 ? styles.integrityBalanced : styles.integrityUnbalanced}`}>
                                    {Number(trialBalance?.summary?.is_balanced ?? false) ? 'Balanced' : 'Out Of Balance'}
                                </div>
                                <span className={styles.tbIntegrityText}>
                                    Difference: <strong>{formatPKR(Math.abs(Number(trialBalance?.summary?.difference ?? 0)))}</strong> as of {formatDate(trialBalance?.as_of_date || dateTo)}.
                                </span>
                            </div>
                            <div className={styles.sectionWrap}>
                                <table className={`${styles.reportTable} ${styles.tbTable}`}>
                                    <thead><tr><th style={{ width: 60 }}>Code</th><th>Account Name</th><th style={{ width: 110 }}>Governance</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
                                    <tbody>
                                        {(trialBalance?.accounts ?? []).map((account: any) => (
                                            <tr key={account.account_code}>
                                                <td><span className={styles.codeCell}>{account.account_code}</span></td>
                                                <td className={styles.accountNameCell}>{account.account_name}</td>
                                                <td>
                                                    <div className={styles.tbGovernanceBadges}>
                                                        {account.is_control_account && <span className={styles.tbBadgeControl}>Control</span>}
                                                        {account.allow_manual_posting === false && <span className={styles.tbBadgeRestricted}>Auto-post only</span>}
                                                        {account.scope === 'branch' && <span className={styles.tbBadgeScope}>Branch</span>}
                                                    </div>
                                                </td>
                                                <td className={styles.amountCell}>{Number(account.total_debit ?? 0) > 0 ? formatPKR(Number(account.total_debit)) : '-'}</td>
                                                <td className={styles.amountCell}>{Number(account.total_credit ?? 0) > 0 ? formatPKR(Number(account.total_credit)) : '-'}</td>
                                            </tr>
                                        ))}
                                        <tr className={styles.subtotalRow}>
                                            <td colSpan={3}><strong>Total Balances</strong></td>
                                            <td className={styles.amountCell}><strong>{formatPKR(Number(trialBalance?.summary?.total_debit ?? 0))}</strong></td>
                                            <td className={styles.amountCell}><strong>{formatPKR(Number(trialBalance?.summary?.total_credit ?? 0))}</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'cf' && (
                        <div className={styles.reportContent}>
                            <ReportHeader title="Statement of Cash Flows" periodLabel={currentPeriodLabel} branchLabel={branchLabel} basisLabel={basisLabel} />
                            <div className={styles.statementIntegrityStrip}>
                                <div className={styles.tbMetric}>
                                    <span>Opening Cash</span>
                                    <strong>{formatPKR(Number(cashFlow?.opening_cash_balance ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Net Change</span>
                                    <strong>{formatPKR(Number(cashFlowSummary?.net_change_in_cash ?? 0))}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Dominant Driver</span>
                                    <strong>{cashFlowDominantLabel}</strong>
                                </div>
                                <div className={styles.tbMetric}>
                                    <span>Review Tone</span>
                                    <strong>{cashFlowReviewTone}</strong>
                                </div>
                            </div>
                            <div className={styles.statementNote}>
                                <div className={`${styles.integrityBadge} ${Number(cashFlowSummary?.net_change_in_cash ?? 0) >= 0 ? styles.integrityBalanced : styles.integrityUnbalanced}`}>
                                    {cashFlowReviewTone}
                                </div>
                                <span className={styles.tbIntegrityText}>
                                    Net cash movement for {formatDate(cashFlow?.period?.date_from)} to {formatDate(cashFlow?.period?.date_to)}.
                                </span>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}>Operating Activities</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(cashFlow?.sections?.operating?.items ?? []).map((item: any) => (
                                        <tr key={`op-${item.journal_id}-${item.account_code}`}>
                                            <td className={styles.accountNameCell}>{item.description || `Journal ${item.journal_id}`}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(item.amount ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Net Cash From Operating Activities</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(Number(cashFlow?.sections?.operating?.net_cash ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}>Investing Activities</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(cashFlow?.sections?.investing?.items ?? []).map((item: any) => (
                                        <tr key={`inv-${item.journal_id}-${item.account_code}`}>
                                            <td className={styles.accountNameCell}>{item.description || `Journal ${item.journal_id}`}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(item.amount ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Net Cash From Investing Activities</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(Number(cashFlow?.sections?.investing?.net_cash ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.sectionWrap}>
                                <h4 className={styles.sectionTitle}>Financing Activities</h4>
                                <table className={styles.reportTable}><tbody>
                                    {(cashFlow?.sections?.financing?.items ?? []).map((item: any) => (
                                        <tr key={`fin-${item.journal_id}-${item.account_code}`}>
                                            <td className={styles.accountNameCell}>{item.description || `Journal ${item.journal_id}`}</td>
                                            <td className={styles.amountCell}>{formatPKR(Number(item.amount ?? 0))}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.subtotalRow}>
                                        <td><strong>Net Cash From Financing Activities</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(Number(cashFlow?.sections?.financing?.net_cash ?? 0))}</strong></td>
                                    </tr>
                                </tbody></table>
                            </div>
                            <div className={styles.netRow}>
                                <span>Closing Cash Balance</span>
                                <strong className={styles.netAmountPos}>{formatPKR(Number(cashFlow?.summary?.closing_cash_balance ?? 0))}</strong>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
