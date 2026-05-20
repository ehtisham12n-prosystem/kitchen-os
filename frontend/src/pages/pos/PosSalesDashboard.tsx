import { useState, useEffect } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { posApi, branchApi, analyticsApi } from '../../api/api';
import {
    DollarSign,
    ShoppingBag,
    TrendingUp,
    CalendarDays,
    Loader2,
    AlertCircle,
    FileSpreadsheet,
    PackageSearch,
    CreditCard,
    RotateCcw,
    Ban,
    WalletCards,
} from 'lucide-react';
import styles from './PosSalesDashboard.module.css';

const RANGE_OPTIONS = [
    { value: '1', label: 'Today' },
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
];

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days - 1, 0));
    return {
        date_from: formatDate(start),
        date_to: formatDate(end),
    };
}

function csvEscape(value: unknown) {
    const normalized = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportRows(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        return;
    }

    const headers = Array.from(rows.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
    }, new Set<string>()));
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function PosSalesDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<{ value: string, label: string }[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [rangeDays, setRangeDays] = useState('30');

    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        openOrders: 0,
        grossMargin: null as number | null,
        grossMarginPct: null as number | null,
        profitabilityAvailable: false,
        paymentMix: {
            cash: 0,
            card: 0,
            bank: 0,
            digital_wallet: 0,
            other: 0,
            non_cash: 0,
            refunds_total: 0,
            net_collected: 0,
        },
        exceptions: {
            discounts: 0,
            returns_count: 0,
            returns_amount: 0,
            void_count: 0,
            void_amount: 0,
            credit_orders: 0,
            credit_sales: 0,
        },
    });

    const [topItems, setTopItems] = useState<any[]>([]);
    const [branchDashboard, setBranchDashboard] = useState<any>(null);
    const [reportRaw, setReportRaw] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            try {
                setError(null);
                const bData = await branchApi.getBranches();
                const mappedBranches = bData.map((b: any) => ({ value: b.id.toString(), label: b.branch_name }));
                setBranches(mappedBranches);

                if (mappedBranches.length > 0) {
                    const stored = localStorage.getItem('activeBranchId');
                    const initial = stored && mappedBranches.find(b => b.value === stored) ? stored : mappedBranches[0].value;
                    setSelectedBranch(initial);
                    localStorage.setItem('activeBranchId', initial);
                    const selected = bData.find((b: any) => b.id.toString() === initial);
                    if (selected?.branch_name) {
                        localStorage.setItem('branch_name', selected.branch_name);
                    }
                } else {
                    setError('no_branches');
                    setIsLoading(false);
                }
            } catch (err: any) {
                const msg = err?.message || '';
                if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
                    setError('session_expired');
                } else {
                    setError('connection_failed');
                }
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const fetchData = async () => {
        if (!selectedBranch) return;
        setIsLoading(true);
        setError(null);
        try {
            const dateRange = buildDateRange(Number(rangeDays) || 30);
            const [metrics, salesSummary, topItemsReport, dashboardData] = await Promise.all([
                analyticsApi.getBranchMetrics(Number(selectedBranch), dateRange),
                posApi.getSalesSummary(Number(selectedBranch), dateRange),
                posApi.getTopItems(Number(selectedBranch), { ...dateRange, limit: 10 }),
                posApi.getBranchDashboard(Number(selectedBranch)),
            ]);
            setSummary({
                totalRevenue: Number(salesSummary?.totalRevenue || 0),
                totalOrders: Number(salesSummary?.totalOrders || 0),
                averageOrderValue: Number(salesSummary?.averageOrderValue || 0),
                openOrders: Number(metrics?.activeTables || 0),
                grossMargin: metrics?.estimatedGrossMargin ?? null,
                grossMarginPct: metrics?.estimatedGrossMarginPct ?? null,
                profitabilityAvailable: Boolean(metrics?.profitabilityAvailable),
                paymentMix: {
                    cash: Number(salesSummary?.paymentMix?.cash || 0),
                    card: Number(salesSummary?.paymentMix?.card || 0),
                    bank: Number(salesSummary?.paymentMix?.bank || 0),
                    digital_wallet: Number(salesSummary?.paymentMix?.digital_wallet || 0),
                    other: Number(salesSummary?.paymentMix?.other || 0),
                    non_cash: Number(salesSummary?.paymentMix?.non_cash || 0),
                    refunds_total: Number(salesSummary?.paymentMix?.refunds_total || 0),
                    net_collected: Number(salesSummary?.paymentMix?.net_collected || 0),
                },
                exceptions: {
                    discounts: Number(salesSummary?.exceptions?.discounts || 0),
                    returns_count: Number(salesSummary?.exceptions?.returns_count || 0),
                    returns_amount: Number(salesSummary?.exceptions?.returns_amount || 0),
                    void_count: Number(salesSummary?.exceptions?.void_count || 0),
                    void_amount: Number(salesSummary?.exceptions?.void_amount || 0),
                    credit_orders: Number(salesSummary?.exceptions?.credit_orders || 0),
                    credit_sales: Number(salesSummary?.exceptions?.credit_sales || 0),
                },
            });
            setTopItems(Array.isArray(topItemsReport) ? topItemsReport : []);
            setBranchDashboard(dashboardData);
            setReportRaw(metrics?.raw || null);
        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
                setError('session_expired');
            } else {
                setError('fetch_failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('activeBranchId', selectedBranch);
            fetchData();
        }
    }, [rangeDays, selectedBranch]);

    const handleBranchChange = (val: string) => {
        setSelectedBranch(val);
        localStorage.setItem('activeBranchId', val);
        const match = branches.find((b) => b.value === val);
        if (match?.label) {
            localStorage.setItem('branch_name', match.label);
        }
    };

    const formatCurrency = (val: number) => {
        return `PKR ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const currentShift = branchDashboard?.current_shift ?? null;
    const currentShiftVariance = Number(currentShift?.variance || 0);
    const closeReadinessBlocked = Number(branchDashboard?.operational?.open_orders || 0) > 0
        || Number(branchDashboard?.operational?.pending_kots || 0) > 0;

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/console/auth';
    };

    if (error && branches.length === 0) {
        const isSessionExpired = error === 'session_expired';
        return (
            <div className={styles.errorContainer}>
                <AlertCircle size={48} className={styles.errorIcon} />
                <h2>{isSessionExpired ? 'Session Expired' : 'Something went wrong'}</h2>
                <p>
                    {isSessionExpired
                        ? 'Your session has expired. Please log in again to continue.'
                        : error === 'no_branches'
                            ? 'No branches found. Please create a branch first.'
                            : 'Could not connect to the server. Make sure the backend is running.'}
                </p>
                {isSessionExpired ? (
                    <button onClick={handleLogout} className={styles.retryBtn}>
                        Log In Again
                    </button>
                ) : (
                    <button onClick={() => window.location.reload()} className={styles.retryBtn}>
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className="text-gradient">Sales & Performance Analytics</h1>
                    <p>Branch sales reporting with live order, margin, and POS activity for the selected reporting window.</p>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.selectGroup}>
                        <span className={styles.selectLabel}>Branch:</span>
                        <KitchenSelect
                            options={branches}
                            value={selectedBranch}
                            onChange={(e) => handleBranchChange(e.target.value)}
                            className={styles.branchSelect}
                            containerClassName={styles.selectContainer}
                        />
                    </div>
                    <div className={styles.dateSelector}>
                        <CalendarDays size={18} />
                        <select className={styles.select} value={rangeDays} onChange={(event) => setRangeDays(event.target.value)}>
                            {RANGE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className={styles.loaderContainer}>
                    <div className={styles.spinnerWrapper}>
                        <Loader2 className={styles.spinner} size={48} />
                        <div className={styles.spinnerGlow} />
                    </div>
                    <p>Aggregating sales data from terminals...</p>
                </div>
            ) : (
                <div className={styles.contentFadeIn}>
                    {/* Top Level Metrics */}
                    <div className={styles.metricsGrid}>
                        <KitchenCard className={styles.metricCard}>
                            <div className={styles.metricHeader}>
                                <div className={styles.iconBoxRevenue}>
                                    <DollarSign size={24} />
                                </div>
                                <span className={styles.trendUp}>
                                    {buildDateRange(Number(rangeDays) || 30).date_from} to {buildDateRange(Number(rangeDays) || 30).date_to}
                                </span>
                            </div>
                            <div className={styles.metricBody}>
                                <h3>Total Gross Revenue</h3>
                                <h2>{formatCurrency(summary.totalRevenue)}</h2>
                                <p className={styles.metricSub}>{summary.openOrders} currently open orders</p>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.metricCard}>
                            <div className={styles.metricHeader}>
                                <div className={styles.iconBoxOrders}>
                                    <ShoppingBag size={24} />
                                </div>
                                <span className={styles.trendUp}>
                                    {branchDashboard?.operational?.pending_kots || 0} pending KOTs
                                </span>
                            </div>
                            <div className={styles.metricBody}>
                                <h3>Completed Orders</h3>
                                <h2>{summary.totalOrders}</h2>
                                <p className={styles.metricSub}>{branchDashboard?.operational?.open_orders || 0} open orders in POS</p>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.metricCard}>
                            <div className={styles.metricHeader}>
                                <div className={styles.iconBoxAov}>
                                    <TrendingUp size={24} />
                                </div>
                                <span className={summary.profitabilityAvailable ? styles.trendUp : styles.trendDown}>
                                    {summary.profitabilityAvailable
                                        ? `${Number(summary.grossMarginPct || 0).toFixed(2)}% margin`
                                        : 'Margin unavailable for this scope'}
                                </span>
                            </div>
                            <div className={styles.metricBody}>
                                <h3>{summary.profitabilityAvailable ? 'Estimated Gross Margin' : 'Average Order Value'}</h3>
                                <h2>{summary.profitabilityAvailable ? formatCurrency(Number(summary.grossMargin || 0)) : formatCurrency(summary.averageOrderValue)}</h2>
                                <p className={styles.metricSub}>
                                    {summary.profitabilityAvailable
                                        ? `AOV ${formatCurrency(summary.averageOrderValue)}`
                                        : 'Revenue per individual ticket'}
                                </p>
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.reconciliationGrid}>
                        <KitchenCard className={styles.reconciliationCard}>
                            <div className={styles.cardHeader}>
                                <h3>Payment Mix</h3>
                            </div>
                            <div className={styles.reconciliationRows}>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><DollarSign size={14} />Cash</span>
                                    <strong>{formatCurrency(summary.paymentMix.cash)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><CreditCard size={14} />Card + Bank</span>
                                    <strong>{formatCurrency(summary.paymentMix.card + summary.paymentMix.bank)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><WalletCards size={14} />Wallet + Other</span>
                                    <strong>{formatCurrency(summary.paymentMix.digital_wallet + summary.paymentMix.other)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Net Collected</span>
                                    <strong className={styles.positiveValue}>{formatCurrency(summary.paymentMix.net_collected)}</strong>
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.reconciliationCard}>
                            <div className={styles.cardHeader}>
                                <h3>Exceptions & Controls</h3>
                            </div>
                            <div className={styles.reconciliationRows}>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><RotateCcw size={14} />Returns</span>
                                    <strong>{summary.exceptions.returns_count} / {formatCurrency(summary.exceptions.returns_amount)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><Ban size={14} />Voids</span>
                                    <strong>{summary.exceptions.void_count} / {formatCurrency(summary.exceptions.void_amount)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Discounts</span>
                                    <strong>{formatCurrency(summary.exceptions.discounts)}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Credit Sales</span>
                                    <strong>{summary.exceptions.credit_orders} / {formatCurrency(summary.exceptions.credit_sales)}</strong>
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.reconciliationCard}>
                            <div className={styles.cardHeader}>
                                <h3>Day Cash Control</h3>
                            </div>
                            <div className={styles.reconciliationRows}>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Current Day Session</span>
                                    <strong>{currentShift ? `#DAY-${currentShift.id}` : 'No open day'}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><DollarSign size={14} />Expected Cash</span>
                                    <strong>{formatCurrency(Number(currentShift?.expected_cash || 0))}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}><WalletCards size={14} />Counted Cash</span>
                                    <strong>{currentShift?.actual_cash === null || currentShift?.actual_cash === undefined ? 'Pending close' : formatCurrency(Number(currentShift.actual_cash || 0))}</strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Variance</span>
                                    <strong className={currentShiftVariance === 0 ? styles.positiveValue : styles.warningValue}>
                                        {formatCurrency(currentShiftVariance)}
                                    </strong>
                                </div>
                                <div className={styles.reconciliationRow}>
                                    <span className={styles.reconciliationLabel}>Close Readiness</span>
                                    <strong className={closeReadinessBlocked ? styles.warningValue : styles.positiveValue}>
                                        {closeReadinessBlocked ? 'Blocked by open ops' : 'Ready to close'}
                                    </strong>
                                </div>
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.mainLayout}>
                        <KitchenCard className={styles.tableCard}>
                            <div className={styles.cardHeaderWithAction}>
                                <h3>Top Performing Products</h3>
                                <button
                                    className={styles.exportLink}
                                    onClick={() => exportRows(`sales-top-items-${selectedBranch}-${rangeDays}d.csv`, topItems.map((item) => ({
                                        product_name: item.product_name,
                                        quantity_sold: item.quantity_sold,
                                        revenue: item.revenue,
                                    })))}
                                    type="button"
                                >
                                    <FileSpreadsheet size={16} /> Export
                                </button>
                            </div>
                            <div className={styles.tableContainer}>
                                {topItems.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <PackageSearch size={48} />
                                        <p>No sales data captured for the selected period.</p>
                                    </div>
                                ) : (
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Rank</th>
                                                <th>Product Name</th>
                                                <th className={styles.textRight}>Units Sold</th>
                                                <th className={styles.textRight}>Total Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topItems.map((item, index) => (
                                                <tr key={index}>
                                                    <td className={styles.rankCell}>
                                                        <span className={index < 3 ? styles[`topRank_${index + 1}`] : styles.normalRank}>
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className={styles.nameCell}>{item.product_name}</td>
                                                    <td className={styles.qtyCell}>{item.quantity_sold}</td>
                                                    <td className={styles.revenueCell}>
                                                        {formatCurrency(Number(item.revenue))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </KitchenCard>

                        <div className={styles.sideStack}>
                            <KitchenCard className={styles.sideCard}>
                                <div className={styles.cardHeader}>
                                    <h3>Operations & POS Status</h3>
                                </div>
                                <div className={styles.sideContent}>
                                    <div className={styles.shiftStat}>
                                        <span className={styles.statLabel}>Active Registers</span>
                                        <div className={styles.statValueGroup}>
                                            <span className={styles.statusDotActive} />
                                            <span className={styles.statValue}>{branchDashboard?.sale_counters?.length || 0} configured</span>
                                        </div>
                                    </div>
                                    <div className={styles.shiftStat}>
                                        <span className={styles.statLabel}>Current Day Session</span>
                                        <span className={styles.statValue}>
                                            {branchDashboard?.current_shift ? `#DAY-${branchDashboard.current_shift.id}` : 'None'}
                                        </span>
                                    </div>
                                    <div className={styles.shiftStat}>
                                        <span className={styles.statLabel}>Open Orders</span>
                                        <span className={styles.statValueWarning}>{branchDashboard?.operational?.open_orders || 0}</span>
                                    </div>
                                    <div className={styles.shiftStat}>
                                        <span className={styles.statLabel}>Pending KOTs</span>
                                        <span className={styles.statValueInfo}>{branchDashboard?.operational?.pending_kots || 0}</span>
                                    </div>
                                </div>
                            </KitchenCard>

                            <KitchenCard className={styles.sideCardAction}>
                                <div className={styles.cardHeaderSecondary}>
                                    <h3>Reporting Scope</h3>
                                </div>
                                <div className={styles.sideContent}>
                                    <p className={styles.metaText}>
                                        {reportRaw?.profitability?.available
                                            ? `Estimated COGS ${formatCurrency(Number(reportRaw?.profitability?.estimated_cogs || 0))} for ${RANGE_OPTIONS.find((option) => option.value === rangeDays)?.label || 'current range'}.`
                                            : reportRaw?.profitability?.unavailable_reason || 'Simplified margin is available only without category filters.'}
                                    </p>
                                    <button
                                        className={styles.exportBtn}
                                        onClick={() => exportRows(`sales-category-${selectedBranch}-${rangeDays}d.csv`, reportRaw?.exports?.sales_category_rows ?? [])}
                                        type="button"
                                    >
                                        <FileSpreadsheet size={16} /> Export categories
                                    </button>
                                </div>
                            </KitchenCard>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
