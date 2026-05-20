import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Filter, Plus, Search, Truck, X } from 'lucide-react';
import styles from './GRNList.module.css';
import { inventoryApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredGrnNumber, formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';
import { GRNForm } from './GRNForm';

type PayableFilter = 'all' | 'pending_bill' | 'bill_received';

export function GRNList() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const { canReadInventory, canReceiveInventory } = usePermissionAccess();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const initialPayableFilter = searchParams.get('payable_status');
    const [payableFilter, setPayableFilter] = useState<PayableFilter>(
        initialPayableFilter === 'pending_bill' || initialPayableFilter === 'bill_received' ? initialPayableFilter : 'all',
    );
    const deepLinkBranchId = searchParams.get('branch_id');
    const deepLinkOrigin = searchParams.get('origin');
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [showNewReceipt, setShowNewReceipt] = useState(false);
    const pageSize = 20;
    const deferredSearch = useDeferredValue(search.trim());
    const formatVisibleGrnNumber = (row: any) => (
        formatConfiguredGrnNumber(row?.grn_number || `GRN-${row?.id || '-'}`, activeBranch || row, { preserveTypePrefix: true })
        || row?.grn_number
        || `GRN-${row?.id || '-'}`
    );
    const formatVisiblePurchaseOrderNumber = (row: any) => (
        formatConfiguredPurchaseOrderNumber(row?.purchase_order?.po_number || `PO-${row?.purchase_order?.id || '-'}`, activeBranch || row?.purchase_order || row, { preserveTypePrefix: true })
        || row?.purchase_order?.po_number
        || `PO-${row?.purchase_order?.id || '-'}`
    );

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await inventoryApi.getGrnsPage({
                    search: deferredSearch || undefined,
                    branch_id: deepLinkBranchId || undefined,
                    payable_status: payableFilter === 'all' ? undefined : payableFilter,
                    limit: pageSize,
                    offset: page * pageSize,
                });
                setRows(data.items ?? []);
                setTotal(data.total ?? 0);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load goods receipt notes.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [deepLinkBranchId, deferredSearch, page, payableFilter]);

    useEffect(() => {
        setPage(0);
    }, [deferredSearch, payableFilter]);

    const filtered = useMemo(() => rows, [rows]);
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter((row) => String(row.receipt_date || '').slice(0, 10) === today);
    const readyForPayables = rows.filter((row) => row.payable?.ready || row.payable_status === 'bill_received');
    const pendingBills = rows.filter((row) => row.payable_status === 'pending_bill');
    const pageBillValue = rows.reduce((sum, row) => sum + Number(row.summary?.total_amount || 0), 0);
    const pendingBillValue = pendingBills.reduce((sum, row) => sum + Number(row.summary?.total_amount || 0), 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const emptyMessage = payableFilter === 'pending_bill'
        ? 'No pending-bill GRNs match your search.'
        : payableFilter === 'bill_received'
            ? 'No bill-matched GRNs match your search.'
            : 'No goods receipt notes match your search.';
    const hasDrillthroughScope = Boolean(deepLinkBranchId || deepLinkOrigin === 'month_close' || payableFilter !== 'all' || search.trim());

    const clearDrillthrough = () => {
        setSearch('');
        setPayableFilter('all');
        setSearchParams({});
    };

    if (!canReadInventory && !canReceiveInventory) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>Your current role does not include goods receipt access.</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <Truck size={22} className={styles.titleIcon} />
                            <h1>Goods Received Notes</h1>
                        </div>
                        <p className={styles.subtitle}>Posted receipts for approved purchase orders and manual stock receipts.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} onClick={() => setShowNewReceipt(true)} disabled={!canReceiveInventory}>
                        <Plus size={16} />
                        New Receipt
                    </button>
                </div>
            </div>

            <div className={styles.summaryStrip}>
                <div className={`${styles.summaryItem} ${styles.sumIndigo}`}>
                    <span className={styles.sumValue}>{total}</span>
                    <span className={styles.sumLabel}>Total GRNs</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumEmerald}`}>
                    <span className={styles.sumValue}>{todayRows.length}</span>
                    <span className={styles.sumLabel}>This Page Today</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumAmber}`}>
                    <span className={styles.sumValue}>{readyForPayables.length}</span>
                    <span className={styles.sumLabel}>Page Bill Matched</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumRose}`}>
                    <span className={styles.sumValue}>{pendingBills.length}</span>
                    <span className={styles.sumLabel}>Page Pending Bill Ref</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumCyan}`}>
                    <span className={styles.sumValue}>
                        {pendingBillValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className={styles.sumLabel}>Pending Bill Value</span>
                </div>
            </div>

            {hasDrillthroughScope && (
                <div className={styles.scopeBanner}>
                    <div>
                        <strong>Month-close review scope active.</strong>
                        <span>
                            {deepLinkBranchId ? ` Branch filter is applied.` : ' Showing the current payable queue.'}
                            {payableFilter !== 'all' ? ` Payable status: ${payableFilter.replace(/_/g, ' ')}.` : ''}
                        </span>
                    </div>
                    <button className={styles.scopeClearBtn} onClick={clearDrillthrough}>
                        Clear Scope
                    </button>
                </div>
            )}

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search size={15} />
                    <input
                        type="text"
                        placeholder="Search GRN, PO, vendor, branch, or bill ref..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className={styles.searchInput}
                    />
                </div>
                <div className={styles.filters}>
                    <Filter size={14} className={styles.filterIcon} />
                    <button
                        className={`${styles.filterBtn} ${payableFilter === 'all' ? styles.filterActive : ''}`}
                        onClick={() => setPayableFilter('all')}
                    >
                        All Receipts
                    </button>
                    <button
                        className={`${styles.filterBtn} ${payableFilter === 'pending_bill' ? styles.filterActive : ''}`}
                        onClick={() => setPayableFilter('pending_bill')}
                    >
                        Pending Bill
                    </button>
                    <button
                        className={`${styles.filterBtn} ${payableFilter === 'bill_received' ? styles.filterActive : ''}`}
                        onClick={() => setPayableFilter('bill_received')}
                    >
                        Bill Received
                    </button>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHead}>
                    <span style={{ width: '140px' }}>GRN #</span>
                    <span style={{ width: '140px' }}>PO #</span>
                    <span style={{ flex: 1 }}>Vendor / Branch</span>
                    <span style={{ width: '130px' }}>Receipt Date</span>
                    <span style={{ width: '170px' }}>Payable</span>
                    <span style={{ width: '120px', textAlign: 'right' }}>Value</span>
                    <span style={{ width: '60px' }}></span>
                </div>
                {loading ? (
                    <div className={styles.empty}>Loading goods receipts...</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>{emptyMessage}</div>
                ) : filtered.map((row) => (
                    <div key={row.id} className={styles.tableRow} onClick={() => navigate(`/console/inventory/grn/${row.id}`)}>
                        <span style={{ width: '140px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.82rem' }}>
                            {formatVisibleGrnNumber(row)}
                        </span>
                        <span style={{ width: '140px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {row.purchase_order?.po_number ? formatVisiblePurchaseOrderNumber(row) : 'Manual'}
                        </span>
                        <span style={{ flex: 1 }}>
                            <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{row.vendor?.vendor_name || 'Unassigned Vendor'}</strong>
                            <small style={{ color: 'var(--text-tertiary)' }}>
                                {row.branch?.branch_name || 'Unknown Branch'}
                            </small>
                        </span>
                        <span style={{ width: '130px', color: 'var(--text-secondary)', fontSize: '0.83rem' }}>
                            {row.receipt_date ? new Date(row.receipt_date).toLocaleDateString() : '-'}
                        </span>
                        <span style={{ width: '170px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            <strong className={`${styles.payableTitle} ${row.payable_status === 'pending_bill' ? styles.payablePending : styles.payableReady}`}>
                                {row.vendor_bill_reference || 'Bill ref pending'}
                            </strong>
                            <small>
                                {String(row.payable_status || 'pending_bill').replace(/_/g, ' ')}
                                {row.vendor_bill_due_date ? ` | due ${new Date(row.vendor_bill_due_date).toLocaleDateString()}` : ''}
                                {Number(row.returns?.total_amount || 0) > 0 ? ` | return ${Number(row.returns?.total_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                            </small>
                        </span>
                        <span style={{ width: '120px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {Number(row.summary?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ width: '60px', display: 'flex', justifyContent: 'center' }}>
                            {row.payable_status === 'pending_bill' ? (
                                <button
                                    className={styles.actionBtn}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        navigate(`/console/inventory/grn/${row.id}`);
                                    }}
                                >
                                    Bill
                                </button>
                            ) : (
                                <button className={styles.viewBtn} onClick={(event) => { event.stopPropagation(); navigate(`/console/inventory/grn/${row.id}`); }}>
                                    <Eye size={14} />
                                </button>
                            )}
                        </span>
                    </div>
                ))}
            </div>

            <div className={styles.paginationBar}>
                <span className={styles.pageInfo}>
                    Showing {total === 0 ? 0 : page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className={styles.pageControls}>
                    <span className={styles.pageMetric}>
                        Page Value {pageBillValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button className={styles.pageBtn} disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
                    <span className={styles.pageInfo}>Page {Math.min(page + 1, totalPages)} of {totalPages}</span>
                    <button className={styles.pageBtn} disabled={page >= totalPages - 1 || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
                </div>
            </div>

            {showNewReceipt && (
                <div className={styles.modalOverlay} onClick={() => setShowNewReceipt(false)}>
                    <section className={styles.receiptModal} onClick={(event) => event.stopPropagation()}>
                        <button className={styles.modalCloseBtn} onClick={() => setShowNewReceipt(false)} aria-label="Close new receipt">
                            <X size={18} />
                        </button>
                        <GRNForm onClose={() => setShowNewReceipt(false)} />
                    </section>
                </div>
            )}
        </div>
    );
}
