import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    ArrowDownToLine,
    ArrowRight,
    BarChart3,
    Boxes,
    ClipboardList,
    Package,
    ShoppingCart,
    TrendingDown,
    Truck,
    Warehouse,
} from 'lucide-react';
import styles from './InventoryDashboard.module.css';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredGrnNumber } from '../pos/printTemplates/printHelpers';

export function InventoryDashboard() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'movements' | 'low-stock' | 'receipts'>('movements');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (!branchId) {
                    setDashboard(null);
                    return;
                }
                const data = await inventoryApi.getInventoryDashboard(branchId);
                setDashboard(data);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load inventory dashboard.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [branchId]);

    const kpis = useMemo(() => {
        if (!dashboard) return [];
        return [
            { label: 'Tracked Items', value: dashboard.summary?.tracked_stock_count || 0, sub: 'Branch stock records' },
            { label: 'Store Value', value: Number(dashboard.summary?.stock_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), sub: 'Current stock valuation' },
            { label: 'Low Stock Alerts', value: dashboard.summary?.low_stock_count || 0, sub: 'Below reorder level' },
            { label: 'Critical Stock', value: dashboard.summary?.critical_stock_count || 0, sub: 'Zero or negative stock' },
            { label: "Today's GRNs", value: dashboard.summary?.today_grn_count || 0, sub: `Value ${Number(dashboard.summary?.today_grn_value || 0).toLocaleString()}` },
            { label: 'Pending Approval', value: dashboard.procurement?.pending_approval || 0, sub: 'Purchase orders awaiting approval' },
            { label: 'Awaiting Receipt', value: dashboard.procurement?.awaiting_receipt || 0, sub: 'Approved POs pending GRN' },
        ];
    }, [dashboard]);
    const formatVisibleGrnNumber = (grn: any) =>
        formatConfiguredGrnNumber(grn?.grn_number || `GRN-${grn?.id}`, activeBranch || grn, { preserveTypePrefix: true })
        || grn?.grn_number
        || `GRN-${grn?.id}`;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.titleRow}>
                        <Boxes size={28} className={styles.titleIcon} />
                        <div>
                            <h1 className={styles.title}>Inventory Control</h1>
                            <p className={styles.subtitle}>Purchase orders, goods receipt notes, stock ledger, and POS consumption for the active branch.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/stock-count')}>
                        <ClipboardList size={16} />
                        Blind Counts
                    </button>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/closing-dashboard')}>
                        <AlertTriangle size={16} />
                        Closing Dashboard
                    </button>
                    <button className={styles.btnPrimary} onClick={() => navigate('/console/inventory/grn/new')}>
                        <ArrowDownToLine size={16} />
                        Post GRN
                    </button>
                </div>
            </div>

            <div className={styles.quickActions}>
                {[
                    { label: 'Purchase Orders', sub: 'Procurement', icon: ShoppingCart, path: '/console/purchase-orders' },
                    { label: 'Goods Receipts', sub: 'GRN', icon: Truck, path: '/console/inventory/grn' },
                    { label: 'Stock Ledger', sub: 'Audit Trail', icon: Activity, path: '/console/inventory/ledger' },
                    { label: 'Consumption', sub: 'COGS & Variance', icon: BarChart3, path: '/console/inventory/consumption' },
                    { label: 'Stock Balance', sub: 'Current Levels', icon: Warehouse, path: '/console/inventory/stock-balance' },
                    { label: 'Blind Counts', sub: 'Daily Verification', icon: ClipboardList, path: '/console/inventory/stock-count' },
                    { label: 'Blind Closing', sub: 'Close Readiness', icon: AlertTriangle, path: '/console/inventory/closing-dashboard' },
                    { label: 'Adjust Stock', sub: 'Manual Correction', icon: AlertTriangle, path: '/console/inventory/adjust' },
                    { label: 'Wastage Entry', sub: 'Damage & Waste', icon: TrendingDown, path: '/console/inventory/wastage/new' },
                ].map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.label}
                            className={styles.quickTile}
                            onClick={() => navigate(action.path)}
                        >
                            <Icon size={22} />
                            <span className={styles.tileName}>{action.label}</span>
                            <span className={styles.tileSub}>{action.sub}</span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.kpiGrid}>
                {loading ? (
                    <div className={styles.kpiCard}>Loading dashboard...</div>
                ) : kpis.map((kpi) => (
                    <div key={kpi.label} className={styles.kpiCard}>
                        <div className={styles.kpiLeft}>
                            <div className={styles.kpiIconWrap}>
                                <Package size={20} />
                            </div>
                            <div>
                                <div className={styles.kpiValue}>{kpi.value}</div>
                                <div className={styles.kpiLabel}>{kpi.label}</div>
                                <div className={styles.kpiSub}>{kpi.sub}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.bodyGrid}>
                <div className={styles.storesPanel}>
                    <div className={styles.panelHeader}>
                        <h2>Branch Snapshot</h2>
                        <button className={styles.linkBtn} onClick={() => navigate('/console/inventory/stock-balance')}>
                            Open Stock Balance <ArrowRight size={14} />
                        </button>
                    </div>
                    <div className={styles.storeList}>
                        <div className={styles.storeCard}>
                            <div className={styles.storeInfo}>
                                <span className={styles.storeName}>On Hand Quantity</span>
                                <span className={styles.storeItems}>{Number(dashboard?.summary?.on_hand_quantity || 0).toFixed(2)} units</span>
                            </div>
                        </div>
                        <div className={styles.storeCard}>
                            <div className={styles.storeInfo}>
                                <span className={styles.storeName}>Enabled Inventory Items</span>
                                <span className={styles.storeItems}>{dashboard?.summary?.enabled_item_count || 0} configured for this branch</span>
                            </div>
                        </div>
                        <div className={styles.storeCard}>
                            <div className={styles.storeInfo}>
                                <span className={styles.storeName}>Today’s Receipts</span>
                                <span className={styles.storeItems}>{dashboard?.summary?.today_grn_count || 0} GRN(s) posted</span>
                            </div>
                        </div>
                        <div className={styles.storeCard}>
                            <div className={styles.storeInfo}>
                                <span className={styles.storeName}>Today’s Consumption Entries</span>
                                <span className={styles.storeItems}>{dashboard?.summary?.today_issue_count || 0} stock-reducing ledger rows</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.activityPanel}>
                    <div className={styles.tabBar}>
                        {[
                            { key: 'movements', label: 'Recent Movements' },
                            { key: 'low-stock', label: 'Low Stock' },
                            { key: 'receipts', label: 'Recent GRNs' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'movements' && (
                        <div className={styles.movementList}>
                            {(dashboard?.recent_movements || []).map((movement: any) => (
                                <div key={movement.id} className={styles.movementRow}>
                                    <div className={styles.mvLeft}>
                                        <span className={styles.mvTag}>{movement.transaction_type}</span>
                                        <div className={styles.mvInfo}>
                                            <span className={styles.mvItem}>{movement.item?.item_name || `Item #${movement.item_id}`}</span>
                                            <span className={styles.mvDetails}>{movement.reference_id || 'No reference'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.mvRight}>
                                        <span className={styles.mvQty}>{Number(movement.quantity || 0).toFixed(2)}</span>
                                        <div className={styles.mvMeta}>
                                            <span className={styles.mvTime}>{new Date(movement.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className={styles.viewAllBtn} onClick={() => navigate('/console/inventory/ledger')}>
                                View Full Ledger <ArrowRight size={14} />
                            </button>
                        </div>
                    )}

                    {activeTab === 'low-stock' && (
                        <div className={styles.alertList}>
                            {(dashboard?.low_stock || []).map((item: any) => (
                                <div key={item.item_id} className={styles.alertRow}>
                                    <div className={styles.alertInfo}>
                                        <span className={styles.alertItem}>{item.item?.item_name || `Item #${item.item_id}`}</span>
                                        <span className={styles.alertSub}>
                                            Current {Number(item.current_quantity || 0).toFixed(2)} {item.item?.uom_base || ''} • Reorder {Number(item.min_level || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <span className={`${styles.alertBadge} ${Number(item.current_quantity || 0) <= 0 ? styles.badgeCritical : styles.badgeWarning}`}>
                                        {Number(item.current_quantity || 0) <= 0 ? 'critical' : 'low'}
                                    </span>
                                </div>
                            ))}
                            <button className={styles.viewAllBtn} onClick={() => navigate('/console/inventory/stock-balance')}>
                                View Stock Balance <ArrowRight size={14} />
                            </button>
                        </div>
                    )}

                    {activeTab === 'receipts' && (
                        <div className={styles.alertList}>
                            {(dashboard?.recent_grns || []).map((grn: any) => (
                                <div key={grn.id} className={styles.alertRow}>
                                    <div className={styles.alertInfo}>
                                        <span className={styles.alertItem}>{formatVisibleGrnNumber(grn)}</span>
                                        <span className={styles.alertSub}>
                                            {grn.vendor?.vendor_name || 'Vendor'} • {grn.summary?.line_count || 0} lines • {Number(grn.summary?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <span className={styles.alertBadge}>{new Date(grn.receipt_date).toLocaleDateString()}</span>
                                </div>
                            ))}
                            <button className={styles.viewAllBtn} onClick={() => navigate('/console/inventory/grn')}>
                                View GRN History <ArrowRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
