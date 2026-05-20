/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    Brain,
    ChefHat,
    Download,
    FileText,
    Info,
    Loader2,
    PackageSearch,
    Printer,
    RefreshCw,
    Store,
    TrendingUp,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { analyticsApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from './analyticsAccess';
import styles from './RestaurantBiCommandCenter.module.css';

const RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' },
];

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

function resolveRange(range: string, customFrom: string, customTo: string) {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    if (range === 'yesterday') {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
    } else if (range === 'week') {
        start.setDate(now.getDate() - 6);
    } else if (range === 'month') {
        start.setDate(1);
    } else if (range === 'quarter') {
        start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    } else if (range === 'year') {
        start.setMonth(0, 1);
    } else if (range === 'custom') {
        return { date_from: customFrom, date_to: customTo };
    }
    return { date_from: toDateInput(start), date_to: toDateInput(end) };
}

function csvEscape(value: unknown) {
    const normalized = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        toast.error('Nothing To Export', 'No rows are available for this report.');
        return;
    }
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
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

function pct(value: unknown) {
    return `${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}%`;
}

function compact(value: unknown) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: Number(value || 0) > 99 ? 0 : 2 });
}

export function RestaurantBiCommandCenter() {
    const { formatMoney } = useCurrencyConfig();
    const [range, setRange] = useState('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const dateRange = useMemo(() => resolveRange(range, customFrom, customTo), [customFrom, customTo, range]);
    const branchIds = useMemo(() => (
        selectedBranch === 'all' ? undefined : [selectedBranch]
    ), [selectedBranch]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [options, commandCenter] = await Promise.all([
                branches.length ? Promise.resolve({ branches }) : analyticsApi.getOperationsBranchOptions(),
                analyticsApi.getCommandCenter({ ...dateRange, branch_ids: branchIds }),
            ]);
            setBranches(options?.branches ?? branches);
            setData(commandCenter);
        } catch (err: any) {
            const message = err.message || 'Could not load BI command center.';
            setError(getAnalyticsBlockedMessage(message));
            if (!isAnalyticsEntitlementError(message)) {
                toast.error('Analytics Unavailable', message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange.date_from, dateRange.date_to, selectedBranch]);

    const kpi = data?.kpi ?? {};
    const menuItems = data?.menu_engineering?.items ?? [];
    const branchRows = data?.branch?.rows ?? [];
    const stationRows = data?.station?.rows ?? [];
    const inventoryRows = data?.inventory?.top_consumed_ingredients ?? [];
    const wasteRows = data?.waste?.by_item ?? [];
    const recommendations = data?.recommendations?.recommendations ?? [];
    const forecastRows = data?.forecast?.forecast ?? [];
    const alerts = data?.alerts ?? [];
    const customer = data?.customer ?? {};
    const labor = data?.labor ?? {};
    const bestBranch = data?.branch?.best_branch;
    const bestStation = data?.station?.best_station;
    const tomorrowSales = forecastRows[0]?.projected_sales ?? data?.forecast?.tomorrow_sales ?? 0;
    const reportRows = useMemo(() => [
        ...menuItems.map((row: any) => ({ report: 'Menu Engineering', ...row })),
        ...branchRows.map((row: any) => ({ report: 'Branch Comparison', ...row })),
        ...stationRows.map((row: any) => ({ report: 'Station Analytics', ...row })),
        ...inventoryRows.map((row: any) => ({ report: 'Inventory Health', ...row })),
        ...wasteRows.map((row: any) => ({ report: 'Waste Analytics', ...row })),
        ...forecastRows.map((row: any) => ({ report: 'Forecast', ...row })),
        ...recommendations.map((row: any) => ({ report: 'Recommendations', ...row })),
        ...(customer.top_customers ?? []).map((row: any) => ({ report: 'Customer Analytics', ...row })),
    ], [branchRows, customer.top_customers, forecastRows, inventoryRows, menuItems, recommendations, stationRows, wasteRows]);

    if (error) {
        return (
            <div className={styles.state}>
                <AlertTriangle size={34} />
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.hero}>
                <div className={styles.heroCopy}>
                    <span className={styles.eyebrow}>KitchenOS Analytics</span>
                    <h1>Restaurant BI Command Center</h1>
                    <p>Sales, profitability, menu engineering, inventory health, waste, labor, and forecasting in one operating view.</p>
                    <div className={styles.heroStats}>
                        <span><strong>{bestBranch?.branch_name ?? 'All branches'}</strong> best branch</span>
                        <span><strong>{bestStation?.station_name ?? 'All stations'}</strong> leading station</span>
                        <span><strong>{formatMoney(tomorrowSales)}</strong> tomorrow forecast</span>
                        <span><strong>{alerts.length}</strong> active alerts</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => window.print()}>
                        <FileText size={16} />
                        PDF
                    </KitchenButton>
                    <KitchenButton variant="secondary" onClick={() => window.print()}>
                        <Printer size={16} />
                        Print
                    </KitchenButton>
                    <KitchenButton variant="secondary" onClick={() => exportCsv('restaurant-bi-command-center.csv', reportRows)}>
                        <Download size={16} />
                        Excel
                    </KitchenButton>
                    <KitchenButton onClick={() => void load()} disabled={loading}>
                        <RefreshCw size={16} />
                        Refresh
                    </KitchenButton>
                </div>
            </header>

            <section className={styles.filters}>
                <label>
                    <span>Period</span>
                    <KitchenSelect value={range} onChange={(event) => setRange(event.target.value)} options={RANGE_OPTIONS} />
                </label>
                {range === 'custom' && (
                    <div className={styles.datePair}>
                        <label>
                            <span>From</span>
                            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                        </label>
                        <label>
                            <span>To</span>
                            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                        </label>
                    </div>
                )}
                <label>
                    <span>Branch</span>
                    <KitchenSelect
                        value={selectedBranch}
                        onChange={(event) => setSelectedBranch(event.target.value)}
                        options={[
                            { value: 'all', label: 'All Branches' },
                            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name })),
                        ]}
                    />
                </label>
            </section>

            {loading && (
                <div className={styles.state}>
                    <Loader2 className={styles.spin} size={34} />
                    <p>Loading restaurant analytics...</p>
                </div>
            )}

            {!loading && data && (
                <>
                    <SectionTitle
                        kicker="Executive cockpit"
                        title="Performance Snapshot"
                        note={`${data.filters?.date_from} to ${data.filters?.date_to}`}
                    />
                    <section className={styles.kpiGrid}>
                        {[
                            ['Total Sales', formatMoney(kpi.total_sales), TrendingUp, 'Gross sales before discounts, refunds, and operating deductions.'],
                            ['Net Sales', formatMoney(kpi.net_sales), TrendingUp, 'Sales after discounts and voided order adjustments for the selected period.'],
                            ['Orders', compact(kpi.orders_count), FileText, 'Completed POS orders included in this analytics period.'],
                            ['Avg Order', formatMoney(kpi.avg_order_value), BarChart3, 'Average order value calculated from net sales divided by completed orders.'],
                            ['Gross Profit', formatMoney(kpi.gross_profit), TrendingUp, 'Net sales minus recipe and inventory consumption cost.'],
                            ['Net Profit', formatMoney(kpi.net_profit), TrendingUp, 'Estimated profit after COGS, waste, and labor cost.'],
                            ['Food Cost', pct(kpi.food_cost_pct), ChefHat, 'Food consumption cost as a percentage of net sales.'],
                            ['Beverage Cost', pct(kpi.beverage_cost_pct), ChefHat, 'Beverage ingredient cost as a percentage of net sales.'],
                            ['Packaging Cost', pct(kpi.packaging_cost_pct), PackageSearch, 'Packaging material cost as a percentage of net sales.'],
                            ['Waste', pct(kpi.waste_pct), AlertTriangle, 'Waste cost as a percentage of total consumption cost.'],
                            ['Discount', pct(kpi.discount_pct), FileText, 'Discount amount as a percentage of gross sales.'],
                            ['Refund', pct(kpi.refund_pct), FileText, 'Refunded amount as a percentage of gross sales.'],
                            ['Labor Cost', pct(kpi.labor_cost_pct), Store, 'Approved payroll cost as a percentage of net sales.'],
                            ['Inventory Value', formatMoney(kpi.inventory_value), PackageSearch, 'Current stock value across selected branches.'],
                            ['Negative Stock', compact(kpi.negative_stock_count), AlertTriangle, 'Count of stock items with quantity below zero.'],
                            ['EBITDA', pct(kpi.ebitda_pct), BarChart3, 'Estimated EBITDA margin for the selected operating period.'],
                        ].map(([label, value, Icon, description]: any, index) => (
                            <KitchenCard noPadding className={`${styles.kpi} ${styles[`tone_${index % 8}`]}`} key={label}>
                                <div className={styles.kpiContent}>
                                    <button type="button" className={styles.kpiInfo} aria-label={`${label} description`} title={description}>
                                        <Info size={13} />
                                    </button>
                                    <div className={styles.kpiIcon}>
                                        <Icon size={18} />
                                    </div>
                                    <div className={styles.kpiTitle}>{label}</div>
                                    <div className={styles.kpiValue}>{value}</div>
                                </div>
                            </KitchenCard>
                        ))}
                    </section>

                    <SectionTitle
                        kicker="Growth and mix"
                        title="Sales Trend and Menu Engineering"
                        note="Watch demand movement and margin/popularity position."
                    />
                    <section className={styles.gridTwo}>
                        <KitchenCard className={`${styles.panel} ${styles.chartPanel}`}>
                            <div className={styles.panelHeader}>
                                <h2>Sales Trend</h2>
                                <span>{data.filters?.date_from} to {data.filters?.date_to}</span>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={data.sales_trends?.daily ?? []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="bucket" minTickGap={28} />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="sales" stroke="#0f766e" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </KitchenCard>

                        <KitchenCard className={`${styles.panel} ${styles.chartPanel}`}>
                            <div className={styles.panelHeader}>
                                <h2>Menu Engineering Matrix</h2>
                                <span>Popularity vs margin</span>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <ScatterChart>
                                    <CartesianGrid />
                                    <XAxis dataKey="popularity_pct" name="Popularity %" />
                                    <YAxis dataKey="margin_pct" name="Margin %" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter data={menuItems} name="Menu Items">
                                        {menuItems.map((item: any) => (
                                            <Cell
                                                key={item.product_id}
                                                fill={item.classification === 'STAR' ? '#15803d' : item.classification === 'PLOWHORSE' ? '#ca8a04' : item.classification === 'PUZZLE' ? '#2563eb' : '#b91c1c'}
                                            />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                            <div className={styles.legend}>
                                <span><i className={styles.starDot} /> Star</span>
                                <span><i className={styles.plowhorseDot} /> Plowhorse</span>
                                <span><i className={styles.puzzleDot} /> Puzzle</span>
                                <span><i className={styles.dogDot} /> Dog</span>
                            </div>
                        </KitchenCard>
                    </section>

                    <SectionTitle
                        kicker="Operations"
                        title="Branch, Station, and Forecast Signals"
                        note="Compare branches, station contribution, and projected demand."
                    />
                    <section className={styles.gridThree}>
                        <TablePanel
                            title="Branch Ranking"
                            rows={branchRows.slice(0, 8)}
                            columns={[
                                ['branch_name', 'Branch'],
                                ['branch_sales', 'Sales', formatMoney],
                                ['branch_margin_pct', 'Margin', pct],
                                ['branch_aov', 'AOV', formatMoney],
                            ]}
                        />
                        <TablePanel
                            title="Station Performance"
                            rows={stationRows.slice(0, 8)}
                            columns={[
                                ['station_name', 'Station'],
                                ['revenue', 'Revenue', formatMoney],
                                ['gp_pct', 'GP %', pct],
                                ['food_cost_pct', 'Food Cost', pct],
                            ]}
                        />
                        <KitchenCard className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2>Forecast</h2>
                                <span>{formatMoney(data.forecast?.weekly_sales)} weekly</span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={forecastRows}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" minTickGap={16} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="projected_sales" fill="#7c3aed" />
                                </BarChart>
                            </ResponsiveContainer>
                        </KitchenCard>
                    </section>

                    <SectionTitle
                        kicker="Cost control"
                        title="Inventory, Waste, and Recommendations"
                        note="Find ingredient pressure, leakage, and operational actions."
                    />
                    <section className={styles.gridThree}>
                        <TablePanel
                            title="Top Consumed Ingredients"
                            rows={inventoryRows.slice(0, 8)}
                            columns={[
                                ['item_name', 'Ingredient'],
                                ['consumed_qty', 'Qty', compact],
                                ['consumed_cost', 'Cost', formatMoney],
                            ]}
                        />
                        <TablePanel
                            title="Waste Hotspots"
                            rows={wasteRows.slice(0, 8)}
                            columns={[
                                ['item_name', 'Item'],
                                ['waste_qty', 'Qty', compact],
                                ['waste_cost', 'Cost', formatMoney],
                            ]}
                        />
                        <KitchenCard className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2>Recommendation Center</h2>
                                <Brain size={18} />
                            </div>
                            <div className={styles.recommendations}>
                                {recommendations.slice(0, 8).map((item: any, index: number) => (
                                    <div className={styles.recommendation} key={`${item.area}-${index}`}>
                                        <span className={styles[`sev_${item.severity}`] || styles.sev_medium}>{item.area}</span>
                                        <strong>{item.message}</strong>
                                        <p>{item.action}</p>
                                    </div>
                                ))}
                                {recommendations.length === 0 && <p className={styles.empty}>No high-priority recommendations for this scope.</p>}
                            </div>
                        </KitchenCard>
                    </section>

                    <SectionTitle
                        kicker="People and risk"
                        title="Customer, Labor, and Alert Center"
                        note="Keep retention, productivity, and exception management visible."
                    />
                    <section className={styles.gridThree}>
                        <TablePanel
                            title="Customer Analytics"
                            rows={[
                                { metric: 'Repeat Customers', value: pct(customer.summary?.repeat_customers_pct) },
                                { metric: 'New Customers', value: pct(customer.summary?.new_customers_pct) },
                                { metric: 'Tracked Customers', value: compact(customer.summary?.customer_count) },
                            ]}
                            columns={[
                                ['metric', 'Metric'],
                                ['value', 'Value'],
                            ]}
                        />
                        <TablePanel
                            title="Labor Analytics"
                            rows={[
                                { metric: 'Labor Cost', value: formatMoney(labor.labor_cost) },
                                { metric: 'Labor Cost %', value: pct(labor.labor_cost_pct) },
                                { metric: 'Sales / Employee', value: compact(labor.sales_per_employee) },
                                { metric: 'Orders / Staff', value: compact(labor.orders_per_staff) },
                            ]}
                            columns={[
                                ['metric', 'Metric'],
                                ['value', 'Value'],
                            ]}
                        />
                        <KitchenCard className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2>Alert Center</h2>
                                <AlertTriangle size={18} />
                            </div>
                            <div className={styles.recommendations}>
                                {alerts.slice(0, 8).map((item: any, index: number) => (
                                    <div className={styles.recommendation} key={`${item.area}-${index}`}>
                                        <span className={styles[`sev_${item.severity}`] || styles.sev_medium}>{item.severity}</span>
                                        <strong>{item.message}</strong>
                                        <p>{item.action}</p>
                                    </div>
                                ))}
                                {alerts.length === 0 && <p className={styles.empty}>No active threshold alerts for this scope.</p>}
                            </div>
                        </KitchenCard>
                    </section>
                </>
            )}
        </div>
    );
}

function SectionTitle({ kicker, title, note }: { kicker: string; title: string; note: string }) {
    return (
        <div className={styles.sectionTitle}>
            <div>
                <span>{kicker}</span>
                <h2>{title}</h2>
            </div>
            <p>{note}</p>
        </div>
    );
}

function TablePanel({
    title,
    rows,
    columns,
}: {
    title: string;
    rows: any[];
    columns: Array<[string, string, ((value: any) => string)?]>;
}) {
    return (
        <KitchenCard className={`${styles.panel} ${styles.tablePanel}`}>
            <div className={styles.panelHeader}>
                <h2>{title}</h2>
                <span>{rows.length} rows</span>
            </div>
            <div className={styles.table}>
                <div className={styles.tableHead} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                    {columns.map(([, label]) => <span key={label}>{label}</span>)}
                </div>
                {rows.map((row, index) => (
                    <div className={styles.tableRow} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }} key={row.id ?? row.item_id ?? row.branch_id ?? row.station_name ?? index}>
                        {columns.map(([key, label, formatter]) => (
                            <span key={label}>{formatter ? formatter(row[key]) : row[key] ?? '-'}</span>
                        ))}
                    </div>
                ))}
                {rows.length === 0 && <div className={styles.empty}>No data for the selected scope.</div>}
            </div>
        </KitchenCard>
    );
}
