/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { analyticsApi } from '../../api/api';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { Recycle, TrendingDown, Percent, Box, Loader2, BarChart3, Store } from 'lucide-react';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from './analyticsAccess';
import styles from './WasteAnalytics.module.css';

interface WasteRow {
    id: number;
    product_id: number;
    product_name: string;
    planned_qty: number;
    actual_qty: number;
    waste_quantity: number;
    waste_percentage: number;
    completion_date: string;
}

export function WasteAnalytics() {
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [wasteData, setWasteData] = useState<WasteRow[]>([]);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                setLoadError(null);
                const data = await analyticsApi.getOperationsBranchOptions();
                const options = data?.branches ?? [];
                setBranches(options);
                if (options.length > 0) {
                    setSelectedBranchId(Number(options[0].branch_id));
                } else {
                    setIsLoading(false);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setLoadError(getAnalyticsBlockedMessage(message));
                setIsLoading(false);
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Failed to load reporting branches', message);
                }
            }
        };
        fetchBranches();
    }, []);

    const fetchWaste = useCallback(async () => {
        if (!selectedBranchId) return;
        setIsLoading(true);
        try {
            const result = await analyticsApi.getWasteAnalysis(selectedBranchId);
            setWasteData(result?.rows || []);
            setSummary(result?.summary || null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setLoadError(getAnalyticsBlockedMessage(message));
            if (!isAnalyticsEntitlementError(message)) {
                toast.error('Failed to fetch waste analysis', message);
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (selectedBranchId) {
            void fetchWaste();
        }
    }, [fetchWaste, selectedBranchId]);

    if (loadError) {
        return (
            <div className={styles.container}>
                <KitchenCard className={styles.tableCard}>
                    <div className={styles.loader}>
                        <Recycle size={32} className={styles.wasteHigh} />
                        <p>{loadError}</p>
                    </div>
                </KitchenCard>
            </div>
        );
    }

    const columns: ColumnDef<WasteRow>[] = [
        { key: 'date', header: 'Date', cell: (r) => new Date(r.completion_date).toLocaleDateString() },
        { key: 'id', header: 'Order ID', cell: (r) => <span className={styles.orderId}>#PRD-{r.id}</span> },
        { key: 'product_name', header: 'Product', cell: (r) => r.product_name },
        { key: 'planned', header: 'Planned Qty', cell: (r) => Number(r.planned_qty).toFixed(2), align: 'right' },
        { key: 'actual', header: 'Actual Yield', cell: (r) => Number(r.actual_qty).toFixed(2), align: 'right' },
        { key: 'waste_quantity', header: 'Waste Qty', cell: (r) => Number(r.waste_quantity).toFixed(2), align: 'right' },
        {
            key: 'waste',
            header: 'Waste %',
            cell: (r) => (
                <span className={r.waste_percentage > 10 ? styles.wasteHigh : styles.wasteLow}>
                    {r.waste_percentage.toFixed(1)}%
                </span>
            ),
            align: 'right'
        },
    ];

    const avgWaste = wasteData.length > 0
        ? wasteData.reduce((acc, curr) => acc + curr.waste_percentage, 0) / wasteData.length
        : 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleBox}>
                    <div className={styles.iconBox}><Recycle size={28} /></div>
                    <div>
                        <h1>Production Waste Analysis</h1>
                        <p>Monitoring variance between planned production and actual output yields.</p>
                    </div>
                </div>
                <div className={styles.branchPicker}>
                    <Store size={20} color="#64748b" />
                    <KitchenSelect
                        options={branches.map(b => ({ value: b.branch_id.toString(), label: b.branch_name }))}
                        value={selectedBranchId?.toString() || ''}
                        onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                    />
                </div>
            </header>

            <div className={styles.statsGrid}>
                <KitchenCard className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        <Percent size={24} />
                    </div>
                    <div>
                        <span className={styles.statLabel}>Avg. Batch Waste</span>
                        <h2 className={styles.statValue}>{avgWaste.toFixed(1)}%</h2>
                        <p className={styles.statSub}>Across last 20 batches</p>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                        <Box size={24} />
                    </div>
                    <div>
                        <span className={styles.statLabel}>Total Batches</span>
                        <h2 className={styles.statValue}>{summary?.batch_count || wasteData.length}</h2>
                        <p className={styles.statSub}>In current period</p>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <span className={styles.statLabel}>Waste Quantity</span>
                        <h2 className={styles.statValue}>{Number(summary?.total_waste_quantity || 0).toFixed(2)}</h2>
                        <p className={styles.statSub}>Derived from completed production variances</p>
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.chTitle}>
                        <BarChart3 size={18} />
                        <h3>Batch Variance Logs</h3>
                    </div>
                </div>

                {isLoading && !wasteData.length ? (
                    <div className={styles.loader}>
                        <Loader2 size={32} className={styles.spinner} />
                        <p>Syncing yield metrics...</p>
                    </div>
                ) : (
                    <KitchenTable
                        columns={columns}
                        data={wasteData}
                        emptyMessage="No production data to analyze yet."
                    />
                )}
            </KitchenCard>
        </div>
    );
}

