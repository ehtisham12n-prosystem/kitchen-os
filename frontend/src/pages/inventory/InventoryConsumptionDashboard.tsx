import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, RefreshCw, TrendingDown } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './InventoryConsumptionDashboard.module.css';

const formatMoney = (value: unknown) =>
    `PKR ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayInput = () => new Date().toISOString().slice(0, 10);

export function InventoryConsumptionDashboard() {
    const branchId = Number(resolveActiveBranchId() || 0);
    const [dateFrom, setDateFrom] = useState(todayInput());
    const [dateTo, setDateTo] = useState(todayInput());
    const [rows, setRows] = useState<any[]>([]);
    const [variance, setVariance] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const [consumptionRows, varianceReport] = await Promise.all([
                inventoryApi.getConsumption(branchId, { date_from: dateFrom, date_to: dateTo, limit: 200 }),
                inventoryApi.getVariance(branchId),
            ]);
            setRows(consumptionRows ?? []);
            setVariance(varianceReport);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load consumption data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const totals = useMemo(() => {
        const totalCost = rows.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
        const posRows = rows.filter((row) => String(row.source_type).toLowerCase().includes('pos'));
        return {
            documents: rows.length,
            lineCount: rows.reduce((sum, row) => sum + Number(row.lines?.length || 0), 0),
            totalCost,
            posCost: posRows.reduce((sum, row) => sum + Number(row.total_cost || 0), 0),
            varianceCost: (variance?.rows ?? []).reduce((sum: number, row: any) => sum + Number(row.variance_cost || 0), 0),
        };
    }, [rows, variance]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1>Inventory Consumption</h1>
                    <p>POS consumption, COGS basis, waste exposure, and stock-count variance for the active branch.</p>
                </div>
                <KitchenButton onClick={() => void load()} disabled={loading}>
                    <RefreshCw size={16} />
                    Refresh
                </KitchenButton>
            </div>

            <div className={styles.filters}>
                <label>
                    From
                    <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                </label>
                <label>
                    To
                    <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </label>
                <KitchenButton variant="secondary" onClick={() => void load()} disabled={loading}>Apply</KitchenButton>
            </div>

            <div className={styles.kpis}>
                <KitchenCard className={styles.kpi}><ClipboardList size={18} /><span>Documents</span><strong>{totals.documents}</strong></KitchenCard>
                <KitchenCard className={styles.kpi}><BarChart3 size={18} /><span>Total Consumption</span><strong>{formatMoney(totals.totalCost)}</strong></KitchenCard>
                <KitchenCard className={styles.kpi}><TrendingDown size={18} /><span>POS COGS</span><strong>{formatMoney(totals.posCost)}</strong></KitchenCard>
                <KitchenCard className={styles.kpi}><TrendingDown size={18} /><span>Variance Exposure</span><strong>{formatMoney(totals.varianceCost)}</strong></KitchenCard>
            </div>

            <div className={styles.grid}>
                <section className={styles.panel}>
                    <h2>Consumption Documents</h2>
                    <div className={styles.table}>
                        <div className={styles.head}><span>Source</span><span>Reference</span><span>Lines</span><span>Cost</span><span>Posted</span></div>
                        {rows.map((row) => (
                            <div className={styles.row} key={row.id}>
                                <span>{row.source_type}</span>
                                <span>{row.source_id}</span>
                                <span>{row.lines?.length ?? 0}</span>
                                <span>{formatMoney(row.total_cost)}</span>
                                <span>{row.posted_at ? new Date(row.posted_at).toLocaleString() : '-'}</span>
                            </div>
                        ))}
                        {!loading && rows.length === 0 && <div className={styles.empty}>No consumption posted for the selected period.</div>}
                    </div>
                </section>

                <section className={styles.panel}>
                    <h2>Variance Report</h2>
                    <div className={styles.table}>
                        <div className={styles.head}><span>Count</span><span>Status</span><span>Lines</span><span>Variance Cost</span></div>
                        {(variance?.rows ?? []).slice(0, 12).map((row: any) => (
                            <div className={styles.row} key={row.count_id}>
                                <span>{row.count_number || `COUNT-${row.count_id}`}</span>
                                <span>{row.status}</span>
                                <span>{row.line_count}</span>
                                <span>{formatMoney(row.variance_cost)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
