/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Download, Filter, RefreshCw, Search
} from 'lucide-react';
import styles from './StockBalance.module.css';
import { analyticsApi, inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';

interface StockItem {
    id: number;
    code: string;
    name: string;
    category: string;
    store: string;
    currentQty: number;
    reorderPoint: number;
    unit: string;
    daysRemaining: number;
    avgDailyConsumption: number;
    suggestedOrderQty: number;
    totalValue: number;
    status: 'ok' | 'low' | 'critical' | 'overstocked';
}

const STATUS_CONFIG = {
    ok: { label: 'In Stock', cls: 'statusOk' },
    low: { label: 'Low Stock', cls: 'statusLow' },
    critical: { label: 'Critical', cls: 'statusCritical' },
    overstocked: { label: 'Overstocked', cls: 'statusOver' },
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

export function StockBalance() {
    const branchId = Number(resolveActiveBranchId() || 0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [storeFilter, setStoreFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [unitFilter, setUnitFilter] = useState('all');
    const [minQty, setMinQty] = useState('');
    const [maxQty, setMaxQty] = useState('');
    const [minValue, setMinValue] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'status' | 'days' | 'value'>('status');
    const [loading, setLoading] = useState(true);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);

    const loadStock = useCallback(async () => {
        setLoading(true);
        try {
            if (!branchId) {
                setStockItems([]);
                return;
            }
            const [branchMaster, stockLevels, reorderData] = await Promise.all([
                inventoryApi.getBranchMaster({ branchId, limit: 500 }),
                inventoryApi.getBranchStock(branchId),
                analyticsApi.getReorderRecommendations(branchId).catch(() => ({ items: [] })),
            ]);

            const levelsByItem = new Map(stockLevels.map((level: any) => [level.item_id, level]));
            const reorderByItem = new Map((reorderData?.items || []).map((item: any) => [Number(item.item_id), item]));
            const enabledItems = (branchMaster.items || []).filter((item: any) => item.is_enabled);
            const mapped: StockItem[] = enabledItems.map((item: any) => {
                const level = levelsByItem.get(item.id);
                const recommendation = reorderByItem.get(Number(item.id)) as any;
                const currentQty = Number(level?.current_quantity ?? item.current_stock ?? 0);
                const reorderPoint = Number(item.min_level || 0);
                const maxLevel = Number(item.max_level || 0);
                const avgDailyConsumption = Number(recommendation?.avg_daily_outbound || 0);
                const suggestedOrderQty = Number(recommendation?.suggested_reorder_quantity || 0);
                let status: StockItem['status'] = 'ok';
                if (currentQty <= 0) status = 'critical';
                else if (reorderPoint > 0 && currentQty <= reorderPoint) status = 'low';
                else if (reorderPoint > 0 && currentQty >= maxLevel && maxLevel > 0) status = 'overstocked';

                return {
                    id: Number(item.id),
                    code: item.item_sku || `ITEM-${item.id}`,
                    name: item.item_name,
                    category: item.subType?.type?.type_name || item.subType?.inventoryType?.type_name || '-',
                    store: item.subType?.sub_type_name || 'Main Store',
                    currentQty,
                    reorderPoint,
                    unit: item.uom_base || 'unit',
                    daysRemaining: avgDailyConsumption > 0 ? Math.max(0, Math.round(currentQty / avgDailyConsumption)) : (currentQty > 0 ? Math.max(1, Math.round(currentQty / Math.max(reorderPoint || 1, 1))) : 0),
                    avgDailyConsumption,
                    suggestedOrderQty,
                    totalValue: currentQty * Number(level?.last_unit_cost || 0),
                    status,
                };
            });
            setStockItems(mapped);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load stock balance.');
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        void loadStock();
    }, [loadStock]);

    const filtered = useMemo(() => {
        return stockItems.filter(item => {
            const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchStore = storeFilter === 'all' || item.store === storeFilter;
            const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
            const matchUnit = unitFilter === 'all' || item.unit === unitFilter;
            const matchMinQty = !minQty || item.currentQty >= Number(minQty || 0);
            const matchMaxQty = !maxQty || item.currentQty <= Number(maxQty || 0);
            const matchMinValue = !minValue || item.totalValue >= Number(minValue || 0);
            return matchSearch && matchStatus && matchStore && matchCategory && matchUnit && matchMinQty && matchMaxQty && matchMinValue;
        }).sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'days') return a.daysRemaining - b.daysRemaining;
            if (sortBy === 'value') return b.totalValue - a.totalValue;
            const order: Record<string, number> = { critical: 0, low: 1, ok: 2, overstocked: 3 };
            return order[a.status] - order[b.status];
        });
    }, [categoryFilter, maxQty, minQty, minValue, search, sortBy, statusFilter, stockItems, storeFilter, unitFilter]);

    const stores = useMemo(() => Array.from(new Set(stockItems.map((item) => item.store).filter(Boolean))).sort(), [stockItems]);
    const categories = useMemo(() => Array.from(new Set(stockItems.map((item) => item.category).filter(Boolean))).sort(), [stockItems]);
    const units = useMemo(() => Array.from(new Set(stockItems.map((item) => item.unit).filter(Boolean))).sort(), [stockItems]);

    const totalValue = filtered.reduce((s, i) => s + i.totalValue, 0);
    const totalQty = filtered.reduce((s, i) => s + i.currentQty, 0);
    const criticalCount = stockItems.filter(i => i.status === 'critical').length;
    const lowCount = stockItems.filter(i => i.status === 'low').length;
    const closingExceptions = filtered.filter((item) => item.status === 'critical' || item.status === 'low').length;

    const getProgressPct = (current: number, reorder: number) => {
        const pct = reorder > 0 ? (current / (reorder * 3)) * 100 : 100;
        return Math.min(Math.max(pct, 2), 100);
    };

    const getProgressColor = (status: StockItem['status']) => {
        const map: Record<string, string> = {
            critical: 'var(--color-danger)',
            low: 'var(--color-warning)',
            ok: 'var(--color-success)',
            overstocked: 'var(--color-secondary)',
        };
        return map[status];
    };

    const exportStockBalance = () => {
        downloadCsv('stock-balance.csv', filtered.map((item) => ({
            Code: item.code,
            Item: item.name,
            Store: item.store,
            Category: item.category,
            CurrentQty: item.currentQty,
            MinQty: item.reorderPoint,
            Unit: item.unit,
            ReorderPoint: item.reorderPoint,
            DaysRemaining: item.daysRemaining,
            AvgDailyConsumption: item.avgDailyConsumption,
            SuggestedOrderQty: item.suggestedOrderQty,
            ValuePKR: item.totalValue,
            Status: STATUS_CONFIG[item.status].label,
        })));
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Stock Balance</h1>
                    <p>Current inventory levels by branch snapshot.</p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={exportStockBalance}>
                        <Download size={18} style={{ marginRight: '8px' }} />
                        Export
                    </KitchenButton>
                    <KitchenButton variant="primary" onClick={loadStock} isLoading={loading}>
                        <RefreshCw size={18} style={{ marginRight: '8px' }} />
                        Refresh
                    </KitchenButton>
                </div>
            </header>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filters}>
                    <KitchenInput
                        placeholder="Search items..."
                        icon={<Search size={20} />}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        containerClassName={styles.searchBar}
                    />
                    <div className={styles.filterGroup} aria-label="Filter by status">
                        <Filter size={16} className={styles.filterIcon} />
                        {['all', 'critical', 'low', 'ok'].map((status) => (
                            <button
                                key={status}
                                type="button"
                                className={`${styles.filterBtn} ${statusFilter === status ? styles.filterActive : ''}`}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === 'all' ? 'All' : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}
                            </button>
                        ))}
                    </div>
                    <select className={styles.select} value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                        <option value="all">All Stores</option>
                        {stores.map((store) => <option key={store} value={store}>{store}</option>)}
                    </select>
                    <select className={styles.select} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="all">All Categories</option>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <select className={styles.select} value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                        <option value="all">All UOM</option>
                        {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <input className={styles.input} type="number" min="0" placeholder="Min qty" value={minQty} onChange={(event) => setMinQty(event.target.value)} />
                    <input className={styles.input} type="number" min="0" placeholder="Max qty" value={maxQty} onChange={(event) => setMaxQty(event.target.value)} />
                    <input className={styles.input} type="number" min="0" placeholder="Min value" value={minValue} onChange={(event) => setMinValue(event.target.value)} />
                    <select className={styles.select} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                        <option value="status">Sort: Status</option>
                        <option value="name">Sort: Name</option>
                        <option value="days">Sort: Days Left</option>
                        <option value="value">Sort: Value</option>
                    </select>
                </div>
                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Total Items</span>
                        <span className={styles.statValue}>{filtered.length}/{stockItems.length}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Critical</span>
                        <span className={styles.statValue}>{criticalCount}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Low Stock</span>
                        <span className={styles.statValue}>{lowCount}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Total Value</span>
                        <span className={styles.statValue}>PKR {(totalValue / 1000).toFixed(1)}k</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Filtered Qty</span>
                        <span className={styles.statValue}>{totalQty.toFixed(2)}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Closing Exceptions</span>
                        <span className={styles.statValue}>{closingExceptions}</span>
                    </div>
                </div>
            </KitchenCard>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Item Name</th>
                            <th>Store</th>
                            <th>Category</th>
                            <th>Stock Level</th>
                            <th>Min Qty</th>
                            <th>Current Qty</th>
                            <th>Avg / Day</th>
                            <th>Suggested Order</th>
                            <th className={styles.alignCenter}>Days Left</th>
                            <th>Value (PKR)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={12} className={styles.emptyCell}>Loading stock balance...</td>
                            </tr>
                        ) : filtered.map((item) => {
                            const statusCfg = STATUS_CONFIG[item.status];
                            const pct = getProgressPct(item.currentQty, item.reorderPoint);
                            const color = getProgressColor(item.status);
                            return (
                                <tr key={item.code} className={styles.row}>
                                    <td className={styles.codeCell}>{item.code}</td>
                                    <td className={styles.itemCell}>{item.name}</td>
                                    <td className={styles.mutedCell}>{item.store}</td>
                                    <td className={styles.mutedCell}>{item.category}</td>
                                    <td>
                                        <div className={styles.progressBarOuter}>
                                            <div className={styles.progressBarInner} style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                        <span className={styles.progressLabel} style={{ color }}>Reorder: {item.reorderPoint}</span>
                                    </td>
                                    <td className={styles.alignCenter}>
                                        {item.reorderPoint.toFixed(2)}
                                    </td>
                                    <td className={`${styles.qtyCell} ${styles.alignCenter} ${styles[item.status]}`}>
                                        {item.currentQty} {item.unit}
                                    </td>
                                    <td className={`${styles.mutedCell} ${styles.alignCenter}`}>
                                        {item.avgDailyConsumption.toFixed(2)}
                                    </td>
                                    <td className={`${styles.qtyCell} ${styles.alignCenter}`}>
                                        {item.status === 'low' || item.status === 'critical' ? `${item.suggestedOrderQty.toFixed(2)} ${item.unit}` : '-'}
                                    </td>
                                    <td className={styles.alignCenter}>
                                        <span className={`${styles.daysBadge} ${item.daysRemaining <= 2 ? styles.daysCritical : item.daysRemaining <= 5 ? styles.daysWarn : styles.daysOk}`}>
                                            {item.daysRemaining}d
                                        </span>
                                    </td>
                                    <td className={`${styles.valueCell} ${styles.alignCenter}`}>{item.totalValue.toLocaleString('en-PK')}</td>
                                    <td className={styles.alignCenter}>
                                        <span className={`${styles.statusBadge} ${styles[statusCfg.cls]}`}>{statusCfg.label}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={12} className={styles.emptyCell}>No stock records found for the active branch.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
