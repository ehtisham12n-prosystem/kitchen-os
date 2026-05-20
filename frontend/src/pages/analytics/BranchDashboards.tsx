/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { analyticsApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import {
    AlertTriangle,
    ShoppingBag,
    CircleDollarSign,
    Users,
    Loader2,
    Store,
    Clock,
    TrendingUp,
} from 'lucide-react';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from './analyticsAccess';
import styles from './Dashboard.module.css';

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

export function BranchDashboards() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                setLoadError(null);
                const data = await analyticsApi.getOperationsBranchOptions();
                const options = data?.branches ?? [];
                setBranches(options);
                if (options.length > 0) setSelectedBranchId(Number(options[0].branch_id));
                else setIsLoading(false);
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

    const fetchMetrics = useCallback(async () => {
        if (!selectedBranchId) return;
        setIsLoading(true);
        try {
            const data = await analyticsApi.getBranchManagementSnapshot(selectedBranchId, buildDateRange(30));
            setMetrics(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setLoadError(getAnalyticsBlockedMessage(message));
            if (!isAnalyticsEntitlementError(message)) {
                toast.error('Failed to load branch dashboard', message);
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (selectedBranchId) {
            void fetchMetrics();
        }
    }, [fetchMetrics, selectedBranchId]);

    if (loadError) {
        return (
            <div className={styles.container}>
                <KitchenCard>
                    <div style={{ display: 'grid', placeItems: 'center', gap: '12px', minHeight: '240px', textAlign: 'center' }}>
                        <AlertTriangle size={40} color="#dc2626" />
                        <div>
                            <h2 style={{ margin: 0 }}>Branch analytics is not available for this tenant.</h2>
                            <p style={{ margin: '8px 0 0', color: '#64748b' }}>{loadError}</p>
                        </div>
                    </div>
                </KitchenCard>
            </div>
        );
    }

    if (isLoading && !metrics) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <Loader2 size={48} className={styles.spinner} />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Branch Analytics</h1>
                    <p>Live branch reporting for the last 30 days.</p>
                </div>
                <div className={styles.branchPicker} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Store size={20} color="#64748b" />
                    <KitchenSelect
                        options={branches.map(b => ({ value: b.branch_id.toString(), label: b.branch_name }))}
                        value={selectedBranchId?.toString()}
                        onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                    />
                </div>
            </header>

            <div className={styles.statsGrid}>
                <KitchenCard>
                    <div className={styles.statContent}>
                        <div className={styles.statIcon} style={{ background: '#ecfdf5', color: '#10b981' }}>
                            <CircleDollarSign size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Daily Revenue</span>
                            <div className={styles.statValue}>Rs. {Number(metrics?.cards?.total_revenue || 0).toLocaleString()}</div>
                            <span className={styles.statTrend} style={{ color: '#10b981' }}>
                                7-day change {metrics?.trend_summary?.delta_pct === null ? 'N/A' : `${Number(metrics?.trend_summary?.delta_pct || 0).toFixed(1)}%`}
                            </span>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard>
                    <div className={styles.statContent}>
                        <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                            <ShoppingBag size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Total Orders</span>
                            <div className={styles.statValue}>{metrics?.cards?.completed_orders || 0}</div>
                            <span className={styles.statTrend} style={{ color: '#3b82f6' }}>
                                Avg ticket Rs. {Number(metrics?.cards?.average_order_value || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard>
                    <div className={styles.statContent}>
                        <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#f59e0b' }}>
                            <Users size={24} />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Active Tables</span>
                            <div className={styles.statValue}>{metrics?.cards?.open_orders || 0}</div>
                            <span className={styles.statTrend} style={{ color: '#f59e0b' }}>
                                <Clock size={14} /> Current open orders in scope
                            </span>
                        </div>
                    </div>
                </KitchenCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginTop: '24px' }}>
                <KitchenCard title="Top Performing Products">
                    <div className={styles.topProductsList}>
                        {(metrics?.top_products || []).map((product: any, idx: number) => (
                            <div key={idx} className={styles.productItem}>
                                <div className={styles.productRank}>{idx + 1}</div>
                                <div className={styles.productName}>{product.product_name}</div>
                                <div className={styles.productCount}>{Number(product.quantity_sold || 0).toFixed(2)} sold</div>
                                <div className={styles.productRev}>Rs. {Number(product.revenue || 0).toLocaleString()}</div>
                            </div>
                        ))}
                        {(!metrics?.top_products || metrics.top_products.length === 0) && (
                            <div className={styles.productItem}>
                                <div className={styles.productRank}><TrendingUp size={16} /></div>
                                <div className={styles.productName}>No completed sales in scope</div>
                                <div className={styles.productCount}>0 sold</div>
                                <div className={styles.productRev}>Rs. 0</div>
                            </div>
                        )}
                    </div>
                </KitchenCard>

                <KitchenCard title="Operational Health">
                    <div className={styles.healthMetric}>
                        <div className={styles.healthLabel}>Operational Health</div>
                        <div className={styles.healthValue}>{Number(metrics?.operational_health?.waste_level || 0).toFixed(1)}%</div>
                        <div className={styles.healthBar}>
                            <div className={styles.healthFill} style={{ width: `${Math.min(100, Number(metrics?.operational_health?.waste_level || 0) * 10)}%`, background: Number(metrics?.operational_health?.waste_level || 0) > 5 ? '#ef4444' : '#10b981' }}></div>
                        </div>
                        <p className={styles.healthNote}>
                            {metrics?.operational_health?.profitability_note || 'No profitability note available.'}
                        </p>
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}

