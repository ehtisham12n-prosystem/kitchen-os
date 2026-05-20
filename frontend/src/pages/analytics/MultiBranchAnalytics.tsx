/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    ArrowRightLeft,
    Boxes,
    ClipboardList,
    Download,
    Loader2,
    PackageSearch,
    ShieldAlert,
    ShoppingCart,
    Store,
    TrendingUp,
    Wallet,
    Warehouse,
} from 'lucide-react';
import { analyticsApi } from '../../api/api';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from './analyticsAccess';
import styles from './MultiBranchAnalytics.module.css';

const RANGE_OPTIONS = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
];

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days - 1, 0));
    return { date_from: formatDate(start), date_to: formatDate(end) };
}

function formatNumber(value: number | null | undefined) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: Number(value || 0) >= 100 ? 0 : 2,
    }).format(Number(value || 0));
}

function formatPercent(value: number | null | undefined) {
    return `${formatNumber(value)}%`;
}

function arraysEqual(left: number[], right: number[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toggleId(current: number[], id: number) {
    return current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id].sort((left, right) => left - right);
}

function statusTone(status: string) {
    const normalized = String(status || '').toLowerCase();
    if (['critical', 'negative', 'pending_approval', 'pending'].includes(normalized)) return styles.badgeDanger;
    if (['high', 'out', 'awaiting_receipt', 'approved', 'in_transit'].includes(normalized)) return styles.badgeWarn;
    if (['converted', 'received_with_variance'].includes(normalized)) return styles.badgeInfo;
    return styles.badgeNeutral;
}

function csvEscape(value: unknown) {
    const normalized = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportRows(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        toast.error('Nothing To Export', 'There are no rows available for the current scope.');
        return;
    }

    const headers = Array.from(
        rows.reduce((keys, row) => {
            Object.keys(row).forEach((key) => keys.add(key));
            return keys;
        }, new Set<string>()),
    );
    const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(',')),
    ].join('\n');
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

export function MultiBranchAnalytics() {
    const navigate = useNavigate();
    const { formatMoney } = useCurrencyConfig();
    const [rangeDays, setRangeDays] = useState('30');
    const [authorizedBranches, setAuthorizedBranches] = useState<any[]>([]);
    const [salesCategoryOptions, setSalesCategoryOptions] = useState<any[]>([]);
    const [inventoryClassOptions, setInventoryClassOptions] = useState<any[]>([]);
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
    const [selectedSalesCategoryIds, setSelectedSalesCategoryIds] = useState<number[]>([]);
    const [selectedInventoryClassIds, setSelectedInventoryClassIds] = useState<number[]>([]);
    const [overview, setOverview] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [loadingBranchOptions, setLoadingBranchOptions] = useState(true);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [branchOptionsError, setBranchOptionsError] = useState<string | null>(null);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    const dateRange = useMemo(() => buildDateRange(Number(rangeDays) || 30), [rangeDays]);
    const authorizedBranchIds = useMemo(
        () => authorizedBranches.map((branch: any) => Number(branch.branch_id)),
        [authorizedBranches],
    );
    const allAuthorizedSelected = authorizedBranchIds.length > 0 && arraysEqual(selectedBranchIds, authorizedBranchIds);
    const branchOptions = useMemo(
        () => (overview?.branches ?? authorizedBranches).map((branch: any) => ({
            value: String(branch.branch_id),
            label: `${branch.branch_name} (${branch.branch_code})`,
        })),
        [authorizedBranches, overview],
    );
    const comparisonRows = (overview?.branches ?? []).map((branch: any) => ({
        ...branch,
        procurement_backlog:
            Number(branch.procurement?.pending_requests || 0)
            + Number(branch.procurement?.pending_approval_purchase_orders || 0)
            + Number(branch.procurement?.awaiting_receipt_purchase_orders || 0),
    }));
    const metricScopeNotes = overview?.filters_applied?.metric_scope_notes ?? [];

    useEffect(() => {
        const loadOptions = async () => {
            setLoadingBranchOptions(true);
            setBranchOptionsError(null);
            try {
                const result = await analyticsApi.getOperationsBranchOptions();
                const branches = result?.branches ?? [];
                setAuthorizedBranches(branches);
                setSalesCategoryOptions(result?.sales_categories ?? []);
                setInventoryClassOptions(result?.inventory_classes ?? []);
                setSelectedBranchIds((current) => {
                    const allowedIds = branches.map((branch: any) => Number(branch.branch_id));
                    const normalizedCurrent = current.filter((branchId) => allowedIds.includes(branchId));
                    return normalizedCurrent.length > 0 ? normalizedCurrent : allowedIds;
                });
            } catch (error: any) {
                const message = error.message || 'Could not load reporting branch scope.';
                setBranchOptionsError(getAnalyticsBlockedMessage(message));
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Branch Scope Unavailable', message);
                }
            } finally {
                setLoadingBranchOptions(false);
            }
        };

        void loadOptions();
    }, []);

    useEffect(() => {
        if (!authorizedBranches.length) return;
        const allowedIds = authorizedBranchIds;
        setSelectedBranchIds((current) => {
            const normalizedCurrent = current.filter((branchId) => allowedIds.includes(branchId));
            const next = normalizedCurrent.length > 0 ? normalizedCurrent : allowedIds;
            return arraysEqual(current, next) ? current : next;
        });
    }, [authorizedBranchIds, authorizedBranches.length]);

    useEffect(() => {
        if (loadingBranchOptions) return;

        const loadOverview = async () => {
            setLoadingOverview(true);
            setOverviewError(null);
            try {
                const shouldFilterByBranch = selectedBranchIds.length > 0 && authorizedBranchIds.length > 0 && !allAuthorizedSelected;
                const result = await analyticsApi.getOperationsOverview({
                    ...dateRange,
                    branch_ids: shouldFilterByBranch ? selectedBranchIds : undefined,
                    sales_category_ids: selectedSalesCategoryIds.length > 0 ? selectedSalesCategoryIds : undefined,
                    inventory_class_ids: selectedInventoryClassIds.length > 0 ? selectedInventoryClassIds : undefined,
                });
                setOverview(result);
            } catch (error: any) {
                const message = error.message || 'Could not load branch reporting.';
                setOverviewError(getAnalyticsBlockedMessage(message));
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Reporting Unavailable', message);
                }
            } finally {
                setLoadingOverview(false);
            }
        };

        void loadOverview();
    }, [
        allAuthorizedSelected,
        authorizedBranchIds.length,
        dateRange,
        loadingBranchOptions,
        selectedBranchIds,
        selectedInventoryClassIds,
        selectedSalesCategoryIds,
    ]);

    useEffect(() => {
        if (!overview?.branches?.length) {
            setSelectedBranchId(null);
            setDetail(null);
            return;
        }

        const stillValid = overview.branches.some((branch: any) => Number(branch.branch_id) === selectedBranchId);
        if (!selectedBranchId || !stillValid) setSelectedBranchId(Number(overview.branches[0].branch_id));
    }, [overview, selectedBranchId]);

    useEffect(() => {
        if (!selectedBranchId) return;

        const loadDetail = async () => {
            setLoadingDetail(true);
            setDetailError(null);
            try {
                const result = await analyticsApi.getOperationsBranchDetail(selectedBranchId, {
                    ...dateRange,
                    sales_category_ids: selectedSalesCategoryIds.length > 0 ? selectedSalesCategoryIds : undefined,
                    inventory_class_ids: selectedInventoryClassIds.length > 0 ? selectedInventoryClassIds : undefined,
                });
                setDetail(result);
            } catch (error: any) {
                const message = error.message || 'Could not load branch drill-down.';
                setDetailError(getAnalyticsBlockedMessage(message));
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Branch Detail Unavailable', message);
                }
            } finally {
                setLoadingDetail(false);
            }
        };

        void loadDetail();
    }, [dateRange, selectedBranchId, selectedInventoryClassIds, selectedSalesCategoryIds]);

    const navigateTo = (route: string, branchId?: number | null) => {
        if (branchId) localStorage.setItem('activeBranchId', String(branchId));
        navigate(route);
    };

    const renderFilterGroup = (
        title: string,
        items: any[],
        selectedIds: number[],
        setSelectedIds: Dispatch<SetStateAction<number[]>>,
        allLabel: string,
        allHint: string,
        hint: string,
    ) => (
        <div className={styles.filterGroup}>
            <span className={styles.filterGroupTitle}>{title}</span>
            <div className={styles.filterActions}>
                <button
                    className={`${styles.filterChip} ${selectedIds.length === 0 ? styles.filterChipActive : ''}`}
                    onClick={() => setSelectedIds([])}
                    type="button"
                >
                    <span>{allLabel}</span>
                    <small>{allHint}</small>
                </button>
                {items.map((item: any) => {
                    const id = Number(item.id);
                    const isSelected = selectedIds.includes(id);
                    return (
                        <button
                            key={id}
                            className={`${styles.filterChip} ${isSelected ? styles.filterChipActive : ''}`}
                            onClick={() => setSelectedIds((current) => toggleId(current, id))}
                            type="button"
                        >
                            <span>{item.name}</span>
                            <small>{hint}</small>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    if ((loadingOverview || loadingBranchOptions) && !overview) {
        return (
            <div className={styles.loadingState}>
                <Loader2 className={styles.spinner} size={34} />
                <span>Loading branch reporting...</span>
            </div>
        );
    }

    if (branchOptionsError || overviewError) {
        return (
            <div className={styles.page}>
                <section className={styles.hero}>
                    <div className={styles.heroContent}>
                        <span className={styles.eyebrow}>Branch Reporting</span>
                        <h1>Operational comparison across branches</h1>
                        <p>{branchOptionsError || overviewError}</p>
                    </div>
                </section>
            </div>
        );
    }

    if (!loadingOverview && !overview?.branches?.length) {
        return (
            <div className={styles.page}>
                <div className={styles.hero}>
                    <div className={styles.heroContent}>
                        <span className={styles.eyebrow}>Branch Reporting</span>
                        <h1>Branch reporting and comparison</h1>
                        <p>There are no authorized branches available for this reporting scope yet.</p>
                    </div>
                </div>
            </div>
        );
    }

    const summaryCards = [
        {
            label: 'Network Revenue',
            value: formatMoney(overview?.sales_summary?.total_revenue, { maximumFractionDigits: Number(overview?.sales_summary?.total_revenue || 0) >= 1000 ? 0 : 2 }),
            meta: `${formatNumber(overview?.sales_summary?.completed_orders)} completed orders`,
            icon: TrendingUp,
            tone: styles.cardRevenue,
        },
        {
            label: 'Estimated Margin',
            value: overview?.profitability_summary?.available
                ? formatMoney(overview?.profitability_summary?.estimated_gross_margin, { maximumFractionDigits: Number(overview?.profitability_summary?.estimated_gross_margin || 0) >= 1000 ? 0 : 2 })
                : 'N/A',
            meta: overview?.profitability_summary?.available
                ? `${formatPercent(overview?.profitability_summary?.estimated_gross_margin_pct)} gross margin`
                : overview?.profitability_summary?.unavailable_reason || 'Available without category filters',
            icon: Wallet,
            tone: styles.cardTransfers,
        },
        {
            label: 'Purchase Value',
            value: formatMoney(overview?.procurement_summary?.purchase_value, { maximumFractionDigits: Number(overview?.procurement_summary?.purchase_value || 0) >= 1000 ? 0 : 2 }),
            meta: `${formatNumber(overview?.procurement_summary?.purchase_orders_in_period)} purchase orders in period`,
            icon: ClipboardList,
            tone: styles.cardProcurement,
        },
        {
            label: 'Wastage Cost',
            value: formatMoney(overview?.movement_summary?.wastage_cost, { maximumFractionDigits: Number(overview?.movement_summary?.wastage_cost || 0) >= 1000 ? 0 : 2 }),
            meta: `${formatNumber(overview?.movement_summary?.adjustment_event_count)} adjustments`,
            icon: AlertTriangle,
            tone: styles.cardInventory,
        },
    ];

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <span className={styles.eyebrow}>Branch Reporting</span>
                    <h1>Operational comparison across branches</h1>
                    <p>Compare sales, stock, purchases, wastage, transfers, and simplified gross margin across the branches you are authorized to manage.</p>
                </div>
                <div className={styles.heroControls}>
                    <div className={styles.scopeTile}>
                        <Store size={18} />
                        <div>
                            <strong>{overview?.access_scope?.filtered_branch_count || 0} / {overview?.access_scope?.authorized_branch_count || 0} branches in scope</strong>
                            <span>{overview?.date_range?.label || 'Current reporting window'}</span>
                        </div>
                    </div>
                    <KitchenSelect options={RANGE_OPTIONS} value={rangeDays} onChange={(event) => setRangeDays(event.target.value)} containerClassName={styles.rangeSelect} />
                    <KitchenButton variant="secondary" size="sm" onClick={() => exportRows(`branch-reporting-summary-${dateRange.date_from}-to-${dateRange.date_to}.csv`, overview?.exports?.branch_summary_rows ?? [])}>
                        <Download size={16} />
                        Export summary
                    </KitchenButton>
                </div>
            </section>

            <section className={styles.filterBar}>
                <div className={styles.filterHeader}>
                    <div>
                        <span className={styles.eyebrow}>Filters</span>
                        <h2>Branch, category, and inventory class scope</h2>
                    </div>
                    <div className={styles.filterSummary}>
                        <span>{overview?.access_scope?.filtered_branch_count || selectedBranchIds.length || 0} selected branches</span>
                        <span>{selectedSalesCategoryIds.length || 'All'} sales categories | {selectedInventoryClassIds.length || 'All'} inventory classes</span>
                    </div>
                </div>

                <div className={styles.filterGroup}>
                    <span className={styles.filterGroupTitle}>Branch scope</span>
                    <div className={styles.filterActions}>
                        <button className={`${styles.filterChip} ${allAuthorizedSelected ? styles.filterChipActive : ''}`} onClick={() => setSelectedBranchIds(authorizedBranchIds)} type="button">
                            <span>All branches</span>
                            <small>Use the full authorized network</small>
                        </button>
                        {authorizedBranches.map((branch: any) => {
                            const branchId = Number(branch.branch_id);
                            const isSelected = selectedBranchIds.includes(branchId);
                            return (
                                <button
                                    key={branchId}
                                    className={`${styles.filterChip} ${isSelected ? styles.filterChipActive : ''}`}
                                    onClick={() => {
                                        setSelectedBranchIds((current) => {
                                            if (current.includes(branchId)) return current.length === 1 ? current : current.filter((candidate) => candidate !== branchId);
                                            return authorizedBranchIds.filter((candidate) => current.includes(candidate) || candidate === branchId);
                                        });
                                    }}
                                    type="button"
                                >
                                    <span>{branch.branch_code}</span>
                                    <small>{branch.branch_name}</small>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {renderFilterGroup('Sales categories', salesCategoryOptions, selectedSalesCategoryIds, setSelectedSalesCategoryIds, 'All categories', 'Keep full sales scope', 'Sales filter')}
                {renderFilterGroup('Inventory classes', inventoryClassOptions, selectedInventoryClassIds, setSelectedInventoryClassIds, 'All classes', 'Keep full stock scope', 'Stock filter')}

                {metricScopeNotes.length > 0 && (
                    <div className={styles.noteList}>
                        {metricScopeNotes.map((note: string) => (
                            <span key={note} className={styles.notePill}>{note}</span>
                        ))}
                    </div>
                )}
            </section>

            {branchOptionsError && <p className={styles.errorBanner}>{branchOptionsError}</p>}
            {overviewError && <p className={styles.errorBanner}>{overviewError}</p>}

            <section className={styles.summaryGrid}>
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <KitchenCard key={card.label} className={`${styles.summaryCard} ${card.tone}`}>
                            <div className={styles.summaryTop}>
                                <div className={styles.summaryIcon}><Icon size={18} /></div>
                                <span className={styles.summaryLabel}>{card.label}</span>
                            </div>
                            <strong className={styles.summaryValue}>{card.value}</strong>
                            <span className={styles.summaryMeta}>{card.meta}</span>
                        </KitchenCard>
                    );
                })}
            </section>

            <section className={styles.mainGrid}>
                <KitchenCard className={styles.comparisonCard} title="Cross-branch comparison" extra={<span className={styles.scopePill}>{overview?.access_scope?.filtered_branch_count || 0} filtered branches</span>}>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Branch</th>
                                    <th>Sales</th>
                                    <th>Stock</th>
                                    <th>Purchase</th>
                                    <th>Wastage</th>
                                    <th>Margin</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonRows.map((branch: any) => (
                                    <tr key={branch.branch_id}>
                                        <td><div className={styles.branchCell}><strong>{branch.branch_name}</strong><span>{branch.branch_code} | {branch.inventory_store_type}</span></div></td>
                                        <td><div className={styles.metricStack}><strong>{formatMoney(branch.sales.total_revenue, { maximumFractionDigits: Number(branch.sales.total_revenue || 0) >= 1000 ? 0 : 2 })}</strong><span>{formatNumber(branch.sales.completed_orders)} orders | AOV {formatMoney(branch.sales.average_order_value, { maximumFractionDigits: Number(branch.sales.average_order_value || 0) >= 1000 ? 0 : 2 })}</span></div></td>
                                        <td><div className={styles.metricStack}><strong>{formatNumber(branch.inventory.low_stock_count)} low / {formatNumber(branch.inventory.out_of_stock_count)} out</strong><span>{formatNumber(branch.inventory.on_hand_quantity)} on hand | {formatNumber(branch.inventory.negative_stock_count)} negative</span></div></td>
                                        <td><div className={styles.metricStack}><strong>{formatMoney(branch.procurement.purchase_value, { maximumFractionDigits: Number(branch.procurement.purchase_value || 0) >= 1000 ? 0 : 2 })}</strong><span>{formatNumber(branch.procurement_backlog)} backlog items</span></div></td>
                                        <td><div className={styles.metricStack}><strong>{formatMoney(branch.inventory_movements.wastage_cost, { maximumFractionDigits: Number(branch.inventory_movements.wastage_cost || 0) >= 1000 ? 0 : 2 })}</strong><span>{formatNumber(branch.inventory_movements.adjustment_event_count)} adjustments</span></div></td>
                                        <td><div className={styles.metricStack}><strong>{branch.profitability.available ? formatMoney(branch.profitability.estimated_gross_margin, { maximumFractionDigits: Number(branch.profitability.estimated_gross_margin || 0) >= 1000 ? 0 : 2 }) : 'N/A'}</strong><span>{branch.profitability.available ? formatPercent(branch.profitability.estimated_gross_margin_pct) : 'Filtered scope'}</span></div></td>
                                        <td className={styles.actionCell}><KitchenButton size="sm" variant="ghost" onClick={() => setSelectedBranchId(Number(branch.branch_id))}>View</KitchenButton></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.exceptionsCard} title="Operational exceptions">
                    <div className={styles.exceptionList}>
                        {(overview?.exceptions ?? []).length === 0 && <div className={styles.emptyState}><ShieldAlert size={18} /><span>No branch exceptions were triggered in the selected reporting window.</span></div>}
                        {(overview?.exceptions ?? []).slice(0, 8).map((exception: any) => (
                            <button key={`${exception.branch_id}-${exception.category}-${exception.message}`} className={styles.exceptionItem} onClick={() => navigateTo(exception.route, exception.branch_id)} type="button">
                                <div className={styles.exceptionMain}>
                                    <span className={`${styles.badge} ${statusTone(exception.severity)}`}>{exception.severity}</span>
                                    <div><strong>{exception.branch_name}</strong><p>{exception.message}</p></div>
                                </div>
                                <ArrowRight size={16} />
                            </button>
                        ))}
                    </div>
                </KitchenCard>
            </section>

            <section className={styles.detailSection}>
                <div className={styles.detailHeader}>
                    <div>
                        <span className={styles.eyebrow}>Branch Drill-down</span>
                        <h2>Branch detail</h2>
                        <p>Review branch-level sales, stock, purchases, transfers, wastage, and recent inventory movements inside the same secured reporting scope.</p>
                    </div>
                    <div className={styles.detailHeaderActions}>
                        <KitchenSelect options={branchOptions} value={selectedBranchId ? String(selectedBranchId) : branchOptions[0]?.value} onChange={(event) => setSelectedBranchId(Number(event.target.value))} containerClassName={styles.branchSelect} />
                        <KitchenButton variant="ghost" size="sm" onClick={() => exportRows(`branch-top-items-${dateRange.date_from}-to-${dateRange.date_to}.csv`, detail?.exports?.sales_top_item_rows ?? [])}>
                            <Download size={16} />
                            Export items
                        </KitchenButton>
                        <KitchenButton variant="ghost" size="sm" onClick={() => exportRows(`branch-inventory-movements-${dateRange.date_from}-to-${dateRange.date_to}.csv`, detail?.exports?.inventory_movement_rows ?? [])}>
                            <Download size={16} />
                            Export movements
                        </KitchenButton>
                    </div>
                </div>

                {detailError && <p className={styles.errorBanner}>{detailError}</p>}

                {loadingDetail && !detail ? (
                    <div className={styles.loadingInline}>
                        <Loader2 className={styles.spinner} size={28} />
                        <span>Loading branch drill-down...</span>
                    </div>
                ) : (
                    <>
                        <div className={styles.detailGrid}>
                            <KitchenCard className={styles.detailCard} title="Sales snapshot">
                                {[
                                    { icon: TrendingUp, value: formatMoney(detail?.sales?.total_revenue, { maximumFractionDigits: Number(detail?.sales?.total_revenue || 0) >= 1000 ? 0 : 2 }), label: 'Revenue in period' },
                                    { icon: ShoppingCart, value: formatNumber(detail?.sales?.completed_orders), label: 'Completed orders' },
                                    { icon: Activity, value: formatMoney(detail?.sales?.average_order_value, { maximumFractionDigits: Number(detail?.sales?.average_order_value || 0) >= 1000 ? 0 : 2 }), label: 'Average order value' },
                                    { icon: Store, value: formatNumber(detail?.sales?.open_orders), label: 'Open orders' },
                                ].map(({ icon: Icon, value, label }) => (
                                    <div key={String(label)} className={styles.detailMetric}>
                                        <Icon size={16} />
                                        <div>
                                            <strong>{value}</strong>
                                            <span>{label}</span>
                                        </div>
                                    </div>
                                ))}
                            </KitchenCard>

                            <KitchenCard className={styles.detailCard} title="Inventory pressure">
                                {[
                                    { icon: Warehouse, value: formatNumber(detail?.inventory?.enabled_item_count), label: 'Enabled items' },
                                    { icon: Boxes, value: formatNumber(detail?.inventory?.on_hand_quantity), label: 'On-hand quantity' },
                                    { icon: AlertTriangle, value: formatNumber(detail?.inventory?.low_stock_count), label: 'Low stock items' },
                                    { icon: ShieldAlert, value: `${formatNumber(detail?.inventory?.out_of_stock_count)} / ${formatNumber(detail?.inventory?.negative_stock_count)}`, label: 'Out-of-stock / negative' },
                                ].map(({ icon: Icon, value, label }) => (
                                    <div key={String(label)} className={styles.detailMetric}>
                                        <Icon size={16} />
                                        <div>
                                            <strong>{value}</strong>
                                            <span>{label}</span>
                                        </div>
                                    </div>
                                ))}
                            </KitchenCard>

                            <KitchenCard className={styles.detailCard} title="Purchase and movement">
                                {[
                                    { icon: ClipboardList, value: formatNumber(detail?.procurement?.requests_raised), label: 'Requests raised in period' },
                                    { icon: PackageSearch, value: formatMoney(detail?.procurement?.purchase_value, { maximumFractionDigits: Number(detail?.procurement?.purchase_value || 0) >= 1000 ? 0 : 2 }), label: 'Purchase value' },
                                    { icon: AlertTriangle, value: formatMoney(detail?.inventory_movements?.wastage_cost, { maximumFractionDigits: Number(detail?.inventory_movements?.wastage_cost || 0) >= 1000 ? 0 : 2 }), label: 'Wastage cost' },
                                    { icon: Activity, value: formatMoney(detail?.inventory_movements?.adjustment_cost_impact, { maximumFractionDigits: Number(detail?.inventory_movements?.adjustment_cost_impact || 0) >= 1000 ? 0 : 2 }), label: 'Adjustment cost impact' },
                                ].map(({ icon: Icon, value, label }) => (
                                    <div key={String(label)} className={styles.detailMetric}>
                                        <Icon size={16} />
                                        <div>
                                            <strong>{value}</strong>
                                            <span>{label}</span>
                                        </div>
                                    </div>
                                ))}
                            </KitchenCard>

                            <KitchenCard className={styles.detailCard} title="Transfers and simplified margin">
                                {[
                                    { icon: ArrowRightLeft, value: `${formatNumber(detail?.transfers?.incoming_open_count)} / ${formatNumber(detail?.transfers?.outgoing_open_count)}`, label: 'Incoming / outgoing open transfers' },
                                    { icon: Store, value: formatNumber(detail?.transfers?.bottleneck_count), label: 'Transfer bottlenecks' },
                                    { icon: Wallet, value: detail?.profitability?.available ? formatMoney(detail?.profitability?.estimated_gross_margin, { maximumFractionDigits: Number(detail?.profitability?.estimated_gross_margin || 0) >= 1000 ? 0 : 2 }) : 'N/A', label: 'Estimated gross margin' },
                                    { icon: TrendingUp, value: detail?.profitability?.available ? formatPercent(detail?.profitability?.estimated_gross_margin_pct) : 'Filtered scope', label: detail?.profitability?.available ? 'Estimated gross margin %' : (detail?.profitability?.unavailable_reason || 'Margin unavailable') },
                                ].map(({ icon: Icon, value, label }) => (
                                    <div key={String(label)} className={styles.detailMetric}>
                                        <Icon size={16} />
                                        <div>
                                            <strong>{value}</strong>
                                            <span>{label}</span>
                                        </div>
                                    </div>
                                ))}
                            </KitchenCard>
                        </div>

                        <div className={styles.listGrid}>
                            <KitchenCard title="Top selling items" extra={<KitchenButton variant="ghost" size="sm" onClick={() => navigateTo('/console/reports/sales', selectedBranchId)}>Sales view</KitchenButton>}>
                                <div className={styles.listStack}>
                                    {(detail?.top_items ?? []).length === 0 && <div className={styles.emptyState}><TrendingUp size={18} /><span>No completed sales in the selected period.</span></div>}
                                    {(detail?.top_items ?? []).map((item: any) => (
                                        <div key={item.product_id} className={styles.listItem}>
                                            <div>
                                                <strong>{item.product_name}</strong>
                                                <span>{item.category_name || 'Uncategorized'} | {formatNumber(item.quantity_sold)} sold</span>
                                            </div>
                                            <strong>{formatMoney(item.revenue, { maximumFractionDigits: Number(item.revenue || 0) >= 1000 ? 0 : 2 })}</strong>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>

                            <KitchenCard title="Sales by category">
                                <div className={styles.listStack}>
                                    {(detail?.sales_by_category ?? []).length === 0 && <div className={styles.emptyState}><ShoppingCart size={18} /><span>No category-level sales rows match the current filters.</span></div>}
                                    {(detail?.sales_by_category ?? []).map((row: any) => (
                                        <div key={row.category_id} className={styles.listItem}>
                                            <div>
                                                <strong>{row.category_name}</strong>
                                                <span>{formatNumber(row.completed_orders)} orders | {formatNumber(row.quantity_sold)} sold</span>
                                            </div>
                                            <strong>{formatMoney(row.revenue, { maximumFractionDigits: Number(row.revenue || 0) >= 1000 ? 0 : 2 })}</strong>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>

                            <KitchenCard title="Inventory by class">
                                <div className={styles.listStack}>
                                    {(detail?.inventory_by_class ?? []).length === 0 && <div className={styles.emptyState}><Warehouse size={18} /><span>No inventory rows match the current class filter.</span></div>}
                                    {(detail?.inventory_by_class ?? []).map((row: any) => (
                                        <div key={row.inventory_class_id} className={styles.listItem}>
                                            <div>
                                                <strong>{row.inventory_class_name}</strong>
                                                <span>{formatNumber(row.enabled_item_count)} enabled | {formatNumber(row.low_stock_count)} low stock</span>
                                            </div>
                                            <strong>{formatNumber(row.on_hand_quantity)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>

                            <KitchenCard title="Recent inventory movements" extra={<KitchenButton variant="ghost" size="sm" onClick={() => navigateTo('/console/inventory/ledger', selectedBranchId)}>Ledger</KitchenButton>}>
                                <div className={styles.listStack}>
                                    {(detail?.recent_inventory_movements ?? []).length === 0 && <div className={styles.emptyState}><ArrowRightLeft size={18} /><span>No recent movements match the current reporting scope.</span></div>}
                                    {(detail?.recent_inventory_movements ?? []).map((row: any) => (
                                        <div key={row.id} className={styles.listItem}>
                                            <div>
                                                <strong>{row.item_name}</strong>
                                                <span>{row.transaction_type} | {formatNumber(row.quantity)} @ {formatMoney(row.unit_cost, { maximumFractionDigits: Number(row.unit_cost || 0) >= 1000 ? 0 : 2 })}</span>
                                            </div>
                                            <strong>{formatMoney(row.extended_cost, { maximumFractionDigits: Number(row.extended_cost || 0) >= 1000 ? 0 : 2 })}</strong>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>

                            <KitchenCard title="Procurement attention queue" extra={<KitchenButton variant="ghost" size="sm" onClick={() => navigateTo('/console/purchase-orders', selectedBranchId)}>Procurement</KitchenButton>}>
                                <div className={styles.listStack}>
                                    {(detail?.procurement_attention ?? []).length === 0 && <div className={styles.emptyState}><ClipboardList size={18} /><span>No procurement backlog for this branch.</span></div>}
                                    {(detail?.procurement_attention ?? []).map((row: any) => (
                                        <div key={`${row.record_type}-${row.id}`} className={styles.listItem}>
                                            <div>
                                                <strong>{row.reference_no}</strong>
                                                <span>{row.record_type === 'procurement_request' ? row.destination_branch_name || 'Destination pending' : row.vendor_name || 'Vendor not assigned'} | {row.age_days} day(s)</span>
                                            </div>
                                            <span className={`${styles.badge} ${statusTone(row.status)}`}>{row.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>

                            <KitchenCard title="Transfer watchlist" extra={<KitchenButton variant="ghost" size="sm" onClick={() => navigateTo('/console/inventory/ibt', selectedBranchId)}>Transfer screen</KitchenButton>}>
                                <div className={styles.listStack}>
                                    {(detail?.transfer_watchlist ?? []).length === 0 && <div className={styles.emptyState}><ArrowRightLeft size={18} /><span>No stuck transfers for this branch.</span></div>}
                                    {(detail?.transfer_watchlist ?? []).map((row: any) => (
                                        <div key={row.id} className={styles.listItem}>
                                            <div>
                                                <strong>{row.transfer_no}</strong>
                                                <span>{row.direction} | {row.source_branch_name} to {row.destination_branch_name} | {row.age_days} day(s)</span>
                                            </div>
                                            <span className={`${styles.badge} ${statusTone(row.status)}`}>{row.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </KitchenCard>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
