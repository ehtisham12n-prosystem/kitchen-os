/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './InventoryReports.module.css';

type Period = 'daily' | 'weekly' | 'monthly' | 'annual' | 'custom';
type ReportType = 'closing' | 'valuation' | 'movement' | 'issues' | 'wastage' | 'reorder';

type StockReportItem = {
    code: string;
    name: string;
    category: string;
    store: string;
    unit: string;
    currentQty: number;
    reorderPoint: number;
    maxLevel: number;
    unitCost: number;
    totalValue: number;
    status: 'critical' | 'low' | 'ok' | 'overstocked';
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const resolvePeriodRange = (period: Period, customFrom: string, customTo: string) => {
    const today = new Date();
    const to = toDateInput(today);
    const start = new Date(today);

    if (period === 'daily') return { from: to, to };
    if (period === 'weekly') {
        start.setDate(today.getDate() - 6);
        return { from: toDateInput(start), to };
    }
    if (period === 'monthly') {
        return { from: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    }
    if (period === 'annual') {
        return { from: toDateInput(new Date(today.getFullYear(), 0, 1)), to };
    }
    return { from: customFrom, to: customTo };
};

const formatCurrency = (value: unknown) => (
    `PKR ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

const reportTitles: Record<ReportType, { title: string; subtitle: string }> = {
    closing: {
        title: 'Stock Closing Report',
        subtitle: 'Closing stock, reorder exceptions, valuation, and movement totals for the selected period.',
    },
    valuation: {
        title: 'Inventory Valuation Report',
        subtitle: 'Current stock value by item, category, and store using latest unit cost.',
    },
    movement: {
        title: 'Stock Movement Report',
        subtitle: 'Purchases, transfers, adjustments, wastage, production issues, and net movement.',
    },
    issues: {
        title: 'Service Station Issue Report',
        subtitle: 'Kitchen and service-station issues with quantity, value, and issue metadata.',
    },
    wastage: {
        title: 'Wastage & Disposal Report',
        subtitle: 'Stock written off through wastage or disposal for operational review.',
    },
    reorder: {
        title: 'Reorder & Shortage Report',
        subtitle: 'Critical and low-stock items that should be reviewed before closing.',
    },
};

const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

export function InventoryReports() {
    const branchId = Number(resolveActiveBranchId() || 0);
    const [period, setPeriod] = useState<Period>('daily');
    const [reportType, setReportType] = useState<ReportType>('closing');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [storeFilter, setStoreFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [stockItems, setStockItems] = useState<StockReportItem[]>([]);
    const [ledgerRows, setLedgerRows] = useState<any[]>([]);

    const range = useMemo(() => resolvePeriodRange(period, customFrom, customTo), [customFrom, customTo, period]);

    const loadReportData = useCallback(async () => {
        setLoading(true);
        try {
            if (!branchId) {
                setStockItems([]);
                setLedgerRows([]);
                return;
            }

            const [branchMaster, stockLevels, ledgerPage] = await Promise.all([
                inventoryApi.getBranchMaster({ branchId, limit: 1000 }),
                inventoryApi.getBranchStock(branchId),
                inventoryApi.getLedgerPage(branchId, {
                    date_from: range.from || undefined,
                    date_to: range.to || undefined,
                    limit: 500,
                    offset: 0,
                }),
            ]);

            const levelsByItem = new Map((stockLevels ?? []).map((level: any) => [Number(level.item_id), level]));
            const mapped = (branchMaster?.items ?? []).map((item: any) => {
                const level = levelsByItem.get(Number(item.id));
                const currentQty = Number(level?.current_quantity ?? item.current_stock ?? 0);
                const reorderPoint = Number(item.min_level || 0);
                const maxLevel = Number(item.max_level || 0);
                const unitCost = Number(level?.last_unit_cost || 0);
                let status: StockReportItem['status'] = 'ok';
                if (currentQty <= 0) status = 'critical';
                else if (reorderPoint > 0 && currentQty <= reorderPoint) status = 'low';
                else if (maxLevel > 0 && currentQty >= maxLevel) status = 'overstocked';

                return {
                    code: item.item_sku || item.item_code || `ITEM-${item.id}`,
                    name: item.item_name || `Item #${item.id}`,
                    category: item.subType?.type?.type_name || '-',
                    store: item.subType?.sub_type_name || 'Main Store',
                    unit: item.uom_base || 'unit',
                    currentQty,
                    reorderPoint,
                    maxLevel,
                    unitCost,
                    totalValue: currentQty * unitCost,
                    status,
                };
            });

            setStockItems(mapped);
            setLedgerRows(ledgerPage?.items ?? []);
        } catch (error: any) {
            toast.error('Report Failed', error.message || 'Could not load inventory reports.');
        } finally {
            setLoading(false);
        }
    }, [branchId, range.from, range.to]);

    useEffect(() => {
        void loadReportData();
    }, [loadReportData]);

    const stores = useMemo(() => Array.from(new Set(stockItems.map((item) => item.store))).sort(), [stockItems]);
    const categories = useMemo(() => Array.from(new Set(stockItems.map((item) => item.category))).sort(), [stockItems]);

    const filteredStock = useMemo(() => stockItems.filter((item) => (
        (storeFilter === 'all' || item.store === storeFilter)
        && (categoryFilter === 'all' || item.category === categoryFilter)
    )), [categoryFilter, stockItems, storeFilter]);

    const movementSummary = useMemo(() => {
        const summary = new Map<string, { type: string; rows: number; qtyIn: number; qtyOut: number; value: number }>();
        for (const row of ledgerRows) {
            const type = row.transaction_type || 'unknown';
            const existing = summary.get(type) ?? { type, rows: 0, qtyIn: 0, qtyOut: 0, value: 0 };
            const qty = Number(row.quantity || 0);
            existing.rows += 1;
            existing.qtyIn += qty > 0 ? qty : 0;
            existing.qtyOut += qty < 0 ? Math.abs(qty) : 0;
            existing.value += Number(row.line_value ?? Math.abs(qty) * Number(row.unit_cost || 0));
            summary.set(type, existing);
        }
        return Array.from(summary.values()).sort((a, b) => b.value - a.value);
    }, [ledgerRows]);

    const issueRows = useMemo(() => ledgerRows.filter((row) => row.transaction_type === 'production'), [ledgerRows]);
    const wastageRows = useMemo(() => ledgerRows.filter((row) => row.transaction_type === 'wastage'), [ledgerRows]);
    const reorderRows = useMemo(() => filteredStock.filter((item) => item.status === 'critical' || item.status === 'low'), [filteredStock]);
    const valuationRows = useMemo(() => [...filteredStock].sort((a, b) => b.totalValue - a.totalValue), [filteredStock]);

    const summary = useMemo(() => {
        const closingValue = filteredStock.reduce((sum, item) => sum + item.totalValue, 0);
        const movementValue = ledgerRows.reduce((sum, row) => sum + Number(row.line_value || 0), 0);
        const stockOutValue = ledgerRows
            .filter((row) => Number(row.quantity || 0) < 0)
            .reduce((sum, row) => sum + Number(row.line_value || 0), 0);
        return {
            closingValue,
            movementValue,
            stockOutValue,
            exceptions: reorderRows.length,
        };
    }, [filteredStock, ledgerRows, reorderRows.length]);

    const renderRows = () => {
        if (loading) {
            return <div className={styles.empty}>Loading inventory report...</div>;
        }

        if (reportType === 'movement') {
            return (
                <table className={styles.table}>
                    <thead><tr><th>Movement Type</th><th>Rows</th><th>Qty In</th><th>Qty Out</th><th className={styles.amount}>Value</th></tr></thead>
                    <tbody>{movementSummary.map((row) => (
                        <tr key={row.type}>
                            <td>{row.type.toUpperCase()}</td>
                            <td>{row.rows}</td>
                            <td className={styles.positive}>{row.qtyIn.toFixed(2)}</td>
                            <td className={styles.negative}>{row.qtyOut.toFixed(2)}</td>
                            <td className={styles.amount}>{formatCurrency(row.value)}</td>
                        </tr>
                    ))}</tbody>
                </table>
            );
        }

        if (reportType === 'issues' || reportType === 'wastage') {
            const rows = reportType === 'issues' ? issueRows : wastageRows;
            return (
                <table className={styles.table}>
                    <thead><tr><th>Date</th><th>Reference</th><th>Item</th><th>Station / Reason</th><th className={styles.amount}>Qty</th><th className={styles.amount}>Value</th></tr></thead>
                    <tbody>{rows.map((row) => (
                        <tr key={row.id}>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString('en-PK') : '-'}</td>
                            <td>{row.reference_id || '-'}</td>
                            <td>{row.item?.item_name || `Item #${row.item_id}`}</td>
                            <td>{row.issue_metadata?.issue_to || row.issue_metadata?.notes || '-'}</td>
                            <td className={styles.amount}>{Math.abs(Number(row.quantity || 0)).toFixed(2)}</td>
                            <td className={styles.amount}>{formatCurrency(row.line_value)}</td>
                        </tr>
                    ))}</tbody>
                </table>
            );
        }

        const rows = reportType === 'reorder' ? reorderRows : valuationRows;
        return (
            <table className={styles.table}>
                <thead><tr><th>Code</th><th>Item</th><th>Store</th><th>Category</th><th className={styles.amount}>Closing Qty</th><th className={styles.amount}>Unit Cost</th><th className={styles.amount}>Value</th><th>Status</th></tr></thead>
                <tbody>{rows.map((item) => (
                    <tr key={item.code}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td className={styles.muted}>{item.store}</td>
                        <td className={styles.muted}>{item.category}</td>
                        <td className={styles.amount}>{item.currentQty.toFixed(2)} {item.unit}</td>
                        <td className={styles.amount}>{formatCurrency(item.unitCost)}</td>
                        <td className={styles.amount}>{formatCurrency(item.totalValue)}</td>
                        <td><span className={`${styles.badge} ${item.status === 'critical' ? styles.badgeCritical : item.status === 'low' ? styles.badgeLow : styles.badgeOk}`}>{item.status}</span></td>
                    </tr>
                ))}</tbody>
            </table>
        );
    };

    const exportReport = () => {
        if (reportType === 'movement') {
            downloadCsv('inventory-movement-report.csv', movementSummary.map((row) => ({
                MovementType: row.type,
                Rows: row.rows,
                QtyIn: row.qtyIn,
                QtyOut: row.qtyOut,
                ValuePKR: row.value,
            })));
            return;
        }

        if (reportType === 'issues' || reportType === 'wastage') {
            const rows = reportType === 'issues' ? issueRows : wastageRows;
            downloadCsv(`inventory-${reportType}-report.csv`, rows.map((row) => ({
                Date: row.created_at ? new Date(row.created_at).toLocaleString('en-PK') : '',
                Reference: row.reference_id || '',
                Item: row.item?.item_name || `Item #${row.item_id}`,
                StationOrReason: row.issue_metadata?.issue_to || row.issue_metadata?.notes || '',
                Quantity: Math.abs(Number(row.quantity || 0)),
                ValuePKR: Number(row.line_value || 0),
            })));
            return;
        }

        const rows = reportType === 'reorder' ? reorderRows : valuationRows;
        downloadCsv(`inventory-${reportType}-report.csv`, rows.map((item) => ({
            Code: item.code,
            Item: item.name,
            Store: item.store,
            Category: item.category,
            ClosingQty: item.currentQty,
            Unit: item.unit,
            UnitCostPKR: item.unitCost,
            ValuePKR: item.totalValue,
            Status: item.status,
        })));
    };

    const currentReport = reportTitles[reportType];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Inventory & Store Reports</h1>
                    <p>Daily, weekly, monthly, annual, and closing reports for inventory control.</p>
                </div>
                <KitchenButton variant="primary" onClick={loadReportData} isLoading={loading}>
                    <RefreshCw size={18} style={{ marginRight: 8 }} />
                    Refresh
                </KitchenButton>
            </header>

            <KitchenCard className={styles.filtersCard}>
                <div className={styles.filters}>
                    <select className={styles.select} value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>
                        <option value="closing">Stock Closing Report</option>
                        <option value="valuation">Inventory Valuation</option>
                        <option value="movement">Stock Movement</option>
                        <option value="issues">Service Station Issues</option>
                        <option value="wastage">Wastage & Disposal</option>
                        <option value="reorder">Reorder & Shortage</option>
                    </select>
                    <select className={styles.select} value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                        <option value="custom">Custom</option>
                    </select>
                    {period === 'custom' && (
                        <>
                            <input className={styles.input} type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                            <input className={styles.input} type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                        </>
                    )}
                    <select className={styles.select} value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                        <option value="all">All Stores</option>
                        {stores.map((store) => <option key={store} value={store}>{store}</option>)}
                    </select>
                    <select className={styles.select} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="all">All Categories</option>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </div>
            </KitchenCard>

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}><span>Closing Stock Value</span><strong>{formatCurrency(summary.closingValue)}</strong></div>
                <div className={styles.summaryCard}><span>Period Movement Value</span><strong>{formatCurrency(summary.movementValue)}</strong></div>
                <div className={styles.summaryCard}><span>Issued / Consumed Value</span><strong>{formatCurrency(summary.stockOutValue)}</strong></div>
                <div className={styles.summaryCard}><span>Closing Exceptions</span><strong>{summary.exceptions}</strong></div>
            </div>

            <KitchenCard className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2>{currentReport.title}</h2>
                        <p>{currentReport.subtitle} Period: {range.from || '-'} to {range.to || '-'}.</p>
                    </div>
                    <KitchenButton variant="secondary" onClick={exportReport}>
                        <Download size={18} style={{ marginRight: 8 }} />
                        Export
                    </KitchenButton>
                </div>
                <div className={styles.tableWrap}>
                    {renderRows()}
                </div>
            </KitchenCard>
        </div>
    );
}
