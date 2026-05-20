/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Download, History, Printer, RefreshCw, RotateCcw, Wallet, X } from 'lucide-react';
import { posApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { OrderAuditModal } from '../pos/OrderAuditModal';
import {
    emptyCashierOrderFilters,
    formatDateTime,
    formatMoney,
    isRefundedOrder,
    matchesCashierOrderFilters,
    paymentStatusLabel,
    type CashierOrder,
    type CashierOrderFilters,
} from './cashierUtils';
import { exportCashierRows, type CashierExportFormat } from './cashierExport';
import { canPrintCashierReceipt, printCashierPaymentReceipt } from './cashierPaymentReceipt';
import { formatConfiguredOrderNumber } from '../pos/printTemplates/printHelpers';
import styles from './CashierShared.module.css';

export function CashierReturnedOrders() {
    const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const { activeBranch } = useBranchContext();
    const { canReadPos, canUseCashierConsole, canPrintPosReceipts, hasPermission } = usePermissionAccess();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const branchLabel = activeBranch?.branch_name || localStorage.getItem('branch_name') || 'KitchenOS';
    const formatVisibleOrderNumber = useCallback((order: CashierOrder) => (
        formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, activeBranch || order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`
    ), [activeBranch]);
    const canReviewOrders = canReadPos || canUseCashierConsole || hasPermission(APP_PERMISSIONS.POS.ORDER_SEARCH);
    const canOpenCashierExpenses = canUseCashierConsole || hasPermission(APP_PERMISSIONS.POS.TILL_MANAGE) || hasPermission(APP_PERMISSIONS.ACCOUNTING.VOUCHER);

    const [orders, setOrders] = useState<CashierOrder[]>([]);
    const [filters, setFilters] = useState<CashierOrderFilters>({
        ...emptyCashierOrderFilters,
        paymentStatus: 'all',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [detailOrder, setDetailOrder] = useState<CashierOrder | null>(null);
    const [orderHistoryOrder, setOrderHistoryOrder] = useState<CashierOrder | null>(null);

    const loadOrders = useCallback(async () => {
        if (!branchId) {
            setOrders([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const rows = await posApi.getOrders(branchId);
            setOrders(Array.isArray(rows) ? rows.filter((order) => isRefundedOrder(order)) : []);
        } catch (error: any) {
            toast.error('Returned Orders Unavailable', error?.message || 'Could not load returned orders.');
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(
        () => orders.filter((order) => matchesCashierOrderFilters(order, filters)),
        [filters, orders],
    );

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const pagedOrders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrders.slice(start, start + pageSize);
    }, [currentPage, filteredOrders, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [branchId, filters, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const summary = useMemo(() => {
        const returnedAmount = filteredOrders.reduce((sum, order) => sum + Number(order.latest_return?.refund_amount || order.refunded_amount || 0), 0);
        const partiallyReturned = filteredOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'partially_refunded').length;
        const fullyReturned = filteredOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'refunded').length;
        return { returnedAmount, partiallyReturned, fullyReturned };
    }, [filteredOrders]);

    const exportRows = useMemo(
        () => filteredOrders.map((order) => ({
            'Order ID': order.id,
            'Order Number': formatVisibleOrderNumber(order),
            'Return Invoice': order.latest_return?.return_number || '-',
            'Return Date': formatDateTime(order.latest_return?.created_at),
            Customer: order.customer_name || 'Walk-in customer',
            'Customer Phone': order.customer_phone || '-',
            'Sale Counter': order.sale_counter_code || order.sale_counter_name || '-',
            'Order Taker': order.order_taker_name || 'Staff',
            'Order Type': String(order.order_type || 'dine_in').replaceAll('_', ' '),
            'Order Date': formatDateTime(order.created_at),
            'Payment Status': paymentStatusLabel(order.payment_status),
            'Order Total': Number(order.total_amount || 0),
            'Return Amount': Number(order.latest_return?.refund_amount || order.refunded_amount || 0),
            'Authorized By': order.latest_return?.authorized_by || '-',
            'Return Note': order.latest_return?.return_note || '-',
        })),
        [filteredOrders],
    );

    const handleExport = (format: CashierExportFormat) => {
        exportCashierRows(
            `cashier-returned-orders-${branchId || 'branch'}-${new Date().toISOString().slice(0, 10)}`,
            format,
            exportRows,
        );
    };

    if (!canReviewOrders) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>Returned-order review is not available for your current branch role.</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><RotateCcw size={14} /> Cashier</span>
                    <h1 className={styles.heroTitle}>Sales Returned Orders</h1>
                    <p className={styles.heroDescription}>
                        Review returned sales, return invoice numbers, refunded amounts, and approval details without opening the sales return workflow.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => void loadOrders()}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    {canOpenCashierExpenses ? (
                        <button type="button" className={styles.buttonPrimary} onClick={() => navigate(`${consoleBase}/cashier/expenses`)}>
                            <Wallet size={16} />
                            Record Expense
                        </button>
                    ) : null}
                </div>
            </section>

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Returned Orders</span>
                    <strong className={styles.summaryValue}>{filteredOrders.length}</strong>
                    <span className={styles.summarySub}>Returned sales in the active branch result set</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Refund Amount</span>
                    <strong className={styles.summaryValue}>{formatMoney(summary.returnedAmount)}</strong>
                    <span className={styles.summarySub}>Total refunded amount in the filtered list</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Partially Returned</span>
                    <strong className={styles.summaryValue}>{summary.partiallyReturned}</strong>
                    <span className={styles.summarySub}>Orders with remaining refundable balance</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Fully Returned</span>
                    <strong className={styles.summaryValue}>{summary.fullyReturned}</strong>
                    <span className={styles.summarySub}>Orders completely refunded</span>
                </article>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Search Filters</h2>
                        <p className={styles.panelSubtext}>Filters apply only to already returned orders.</p>
                    </div>
                    <button type="button" className={styles.buttonGhost} onClick={() => setFilters(emptyCashierOrderFilters)}>
                        Reset filters
                    </button>
                </div>

                <div className={styles.filterGrid}>
                    <div className={styles.field}>
                        <label>Customer</label>
                        <input value={filters.customer} onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))} placeholder="Name or phone" />
                    </div>
                    <div className={styles.field}>
                        <label>Order Taker</label>
                        <input value={filters.orderTaker} onChange={(event) => setFilters((current) => ({ ...current, orderTaker: event.target.value }))} placeholder="Staff name" />
                    </div>
                    <div className={styles.field}>
                        <label>Order Type</label>
                        <select value={filters.orderType} onChange={(event) => setFilters((current) => ({ ...current, orderType: event.target.value as CashierOrderFilters['orderType'] }))}>
                            <option value="">All Types</option>
                            <option value="dine_in">Dine In</option>
                            <option value="takeout">Takeout</option>
                            <option value="delivery">Delivery</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label>Period From</label>
                        <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
                    </div>
                    <div className={styles.field}>
                        <label>Period To</label>
                        <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
                    </div>
                    <div className={styles.field}>
                        <label>Product</label>
                        <input value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))} placeholder="Product name" />
                    </div>
                    <div className={styles.field}>
                        <label>Order Number</label>
                        <input value={filters.orderNumber} onChange={(event) => setFilters((current) => ({ ...current, orderNumber: event.target.value }))} placeholder="Order no or ID" />
                    </div>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Returned Orders</h2>
                        <p className={styles.panelSubtext}>Branch: {activeBranch?.branch_name || 'No active branch selected'}</p>
                    </div>
                </div>
                {!isLoading && filteredOrders.length > 0 && (
                    <div className={styles.tableToolbar}>
                        <span className={styles.resultMeta}>
                            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length}
                        </span>
                        <div className={styles.pagerControls}>
                            <label className={styles.exportControl}>
                                <Download size={14} />
                                <select
                                    defaultValue=""
                                    onChange={(event) => {
                                        const format = event.target.value as CashierExportFormat;
                                        if (!format) return;
                                        handleExport(format);
                                        event.target.value = '';
                                    }}
                                >
                                    <option value="">Export</option>
                                    <option value="csv">CSV</option>
                                    <option value="excel">Excel (.xls)</option>
                                    <option value="word">Word (.doc)</option>
                                    <option value="pdf">PDF</option>
                                </select>
                            </label>
                            <label className={styles.pageSizeControl}>
                                Rows
                                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                                    {PAGE_SIZE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                            <button type="button" className={styles.buttonSecondary} disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Prev</button>
                            <span className={styles.pageBadge}>Page {currentPage}/{totalPages}</span>
                            <button type="button" className={styles.buttonSecondary} disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className={styles.emptyState}>Loading returned orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className={styles.emptyState}>No returned orders match the current filters.</div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Return Invoice</th>
                                    <th>Customer</th>
                                    <th>Order Taker</th>
                                    <th>Return Date</th>
                                    <th>Order Total</th>
                                    <th>Refund Amount</th>
                                    <th>Authorized By</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <div className={styles.stack}>
                                                <strong>{formatVisibleOrderNumber(order)}</strong>
                                                <span className={styles.muted}>{String(order.order_type || 'dine_in').replace('_', ' ')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.stack}>
                                                <strong>{order.latest_return?.return_number || '-'}</strong>
                                                <span className={styles.muted}>{paymentStatusLabel(order.payment_status)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.stack}>
                                                <strong>{order.customer_name || 'Walk-in customer'}</strong>
                                                <span className={styles.muted}>{order.customer_phone || '-'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.stack}>
                                                <strong>{order.order_taker_name || 'Staff'}</strong>
                                                <span className={styles.muted}>{order.order_taker_username || '-'}</span>
                                            </div>
                                        </td>
                                        <td>{formatDateTime(order.latest_return?.created_at)}</td>
                                        <td><strong>{formatMoney(order.total_amount)}</strong></td>
                                        <td><strong className={styles.amountWarning}>{formatMoney(order.latest_return?.refund_amount || order.refunded_amount || 0)}</strong></td>
                                        <td>{order.latest_return?.authorized_by || '-'}</td>
                                        <td>
                                            <div className={styles.actionStack}>
                                                {canPrintPosReceipts && canPrintCashierReceipt(order) && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.iconAction} ${styles.iconActionPrint}`}
                                                        title="Print Receipt"
                                                        aria-label="Print Receipt"
                                                        onClick={() => {
                                                            if (!printCashierPaymentReceipt(order, activeBranch, branchLabel)) {
                                                                toast.error('Print Blocked', 'Allow pop-ups for this app to print receipts.');
                                                            }
                                                        }}
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                )}
                                                {canReviewOrders ? (
                                                    <>
                                                        <button type="button" className={styles.iconAction} title="Return Detail" aria-label="Return Detail" onClick={() => setDetailOrder(order)}>
                                                            <ClipboardList size={14} />
                                                        </button>
                                                        <button type="button" className={styles.iconAction} title="Order History" aria-label="Order History" onClick={() => setOrderHistoryOrder(order)}>
                                                            <History size={14} />
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {detailOrder && (
                <div className={styles.modalOverlay} onClick={() => setDetailOrder(null)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.detailOrderNumber}>{detailOrder.latest_return?.return_number || formatVisibleOrderNumber(detailOrder)}</h2>
                                <p>{detailOrder.customer_name || 'Walk-in customer'} | {formatDateTime(detailOrder.latest_return?.created_at || detailOrder.created_at)}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setDetailOrder(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSectionTitle}>Return Snapshot</p>
                            <div className={styles.detailSummaryGrid}>
                                <div className={styles.detailSummaryCell}><span>Order Number</span><strong>{formatVisibleOrderNumber(detailOrder)}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Return Invoice</span><strong>{detailOrder.latest_return?.return_number || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Authorized By</span><strong>{detailOrder.latest_return?.authorized_by || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Sale Counter</span><strong>{detailOrder.sale_counter_code || detailOrder.sale_counter_name || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Order Taker</span><strong>{detailOrder.order_taker_name || 'Staff'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Refund Amount</span><strong>{formatMoney(detailOrder.latest_return?.refund_amount || detailOrder.refunded_amount || 0)}</strong></div>
                            </div>
                            <div className={styles.detailNoteBox}>
                                <strong>Return Note</strong>
                                <span>{detailOrder.latest_return?.return_note || detailOrder.latest_return?.payment_note || '-'}</span>
                            </div>
                            <p className={styles.modalSectionTitle}>Returned Items</p>
                            <div className={styles.detailTableWrap}>
                                <table className={styles.detailTable}>
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Returned Qty</th>
                                            <th>Refund Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detailOrder.latest_return?.items || []).map((item) => (
                                            <tr key={item.id || `${item.product_name}-${item.quantity}`}>
                                                <td>{item.product_name || 'Unnamed item'}</td>
                                                <td>{Number(item.quantity || 0)}</td>
                                                <td>{formatMoney(item.refund_amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {orderHistoryOrder && (
                <OrderAuditModal
                    isOpen={Boolean(orderHistoryOrder)}
                    orderId={orderHistoryOrder.id}
                    orderNumber={formatVisibleOrderNumber(orderHistoryOrder)}
                    onClose={() => setOrderHistoryOrder(null)}
                />
            )}
        </div>
    );
}

export default CashierReturnedOrders;
