/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, CreditCard, Download, History, Printer, RefreshCw, Search, Wallet, X } from 'lucide-react';
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
    getOutstandingAmount,
    isCreditEligibleOrder,
    matchesCashierOrderFilters,
    getPaidAmount,
    normalizePaymentStatus,
    paymentStatusLabel,
    type CashierOrder,
    type CashierOrderItem,
    type CashierOrderFilters,
} from './cashierUtils';
import { exportCashierRows, type CashierExportFormat } from './cashierExport';
import { canPrintCashierReceipt, printCashierPaymentReceipt } from './cashierPaymentReceipt';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, formatConfiguredReceiptNumber } from '../pos/printTemplates/printHelpers';
import styles from './CashierShared.module.css';

function paymentBadgeClass(status?: string | null): string {
    const normalized = normalizePaymentStatus(status);
    if (normalized === 'paid') return `${styles.statusBadge} ${styles.statusPaid}`;
    if (normalized === 'partial') return `${styles.statusBadge} ${styles.statusPartial}`;
    if (normalized === 'unpaid') return `${styles.statusBadge} ${styles.statusUnpaid}`;
    return `${styles.statusBadge} ${styles.statusOther}`;
}

function getItemNote(item: CashierOrderItem): string {
    return String(item.item_notes || item.notes || '').trim();
}

function getItemLineTotal(item: CashierOrderItem): number {
    return Number(item.item_price || 0) * Number(item.quantity || 0);
}

export function CashierOrderSearch() {
    const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const { activeBranch } = useBranchContext();
    const { canReadPos, canUseCashierConsole, canSettleCreditPayments, canPrintPosReceipts, hasPermission } = usePermissionAccess();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const branchLabel = activeBranch?.branch_name || localStorage.getItem('branch_name') || 'KitchenOS';
    const formatVisibleOrderNumber = useCallback((order: CashierOrder) => (
        formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, activeBranch || order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`
    ), [activeBranch]);
    const formatVisibleKotNumbers = useCallback((order: CashierOrder) => (
        (order.kot_numbers || [])
            .map((kotNumber) => formatConfiguredKotNumber(kotNumber, activeBranch || order, { preserveTypePrefix: true }) || kotNumber)
            .join(', ') || '-'
    ), [activeBranch]);
    const formatVisibleReceiptNumber = useCallback((order: CashierOrder) => (
        formatConfiguredReceiptNumber(order.receipt_number || '-', activeBranch || order, { preserveTypePrefix: true })
        || order.receipt_number
        || '-'
    ), [activeBranch]);
    const canReviewOrders = canReadPos || canUseCashierConsole || hasPermission(APP_PERMISSIONS.POS.ORDER_SEARCH);
    const canReceiveCreditPayments = canSettleCreditPayments;

    const [orders, setOrders] = useState<CashierOrder[]>([]);
    const [filters, setFilters] = useState<CashierOrderFilters>(emptyCashierOrderFilters);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [detailOrder, setDetailOrder] = useState<CashierOrder | null>(null);
    const [paymentHistoryOrder, setPaymentHistoryOrder] = useState<CashierOrder | null>(null);
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
            setOrders(Array.isArray(rows) ? rows : []);
        } catch (error: any) {
            toast.error('Orders Unavailable', error?.message || 'Could not load branch orders.');
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(
        () => orders
            .filter((order) => matchesCashierOrderFilters(order, filters)),
        [orders, filters],
    );

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const pagedOrders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrders.slice(start, start + pageSize);
    }, [currentPage, filteredOrders, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, branchId, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const summary = useMemo(() => {
        const totalValue = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
        const creditedCount = filteredOrders.filter((order) => isCreditEligibleOrder(order)).length;
        const outstandingTotal = filteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0);
        const paidCount = filteredOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid').length;
        return { totalValue, creditedCount, outstandingTotal, paidCount };
    }, [filteredOrders]);

    const exportRows = useMemo(
        () => filteredOrders.map((order) => ({
            'Order ID': order.id,
            'Order Number': formatVisibleOrderNumber(order),
            'Order Status': String(order.order_status || 'pending').replaceAll('_', ' '),
            Customer: order.customer_name || 'Walk-in customer',
            'Customer Phone': order.customer_phone || '-',
            'Sale Counter': order.sale_counter_code || order.sale_counter_name || '-',
            'Order Taker': order.order_taker_name || 'Staff',
            Username: order.order_taker_username || '-',
            'Order Type': String(order.order_type || 'dine_in').replaceAll('_', ' '),
            'Order Date': formatDateTime(order.created_at),
            Receipt: formatVisibleReceiptNumber(order),
            'Payment Status': paymentStatusLabel(order.payment_status),
            'Total Amount': Number(order.total_amount || 0),
            'Paid Amount': getPaidAmount(order),
            Outstanding: getOutstandingAmount(order),
            Table: order.table_number || '-',
            KOTs: formatVisibleKotNumbers(order),
            Items: (order.items ?? [])
                .filter((item) => String(item.item_status || '').toLowerCase() !== 'voided')
                .map((item) => `${item.product_name || 'Unnamed item'} x${Number(item.quantity || 0)}`)
                .join('; ') || '-',
            Comments: order.order_note || '-',
        })),
        [filteredOrders],
    );

    const handleExport = (format: CashierExportFormat) => {
        exportCashierRows(
            `cashier-orders-${branchId || 'branch'}-${new Date().toISOString().slice(0, 10)}`,
            format,
            exportRows,
        );
    };

    if (!canReviewOrders) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>Cashier order search is not available for your current branch role.</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><Search size={14} /> Cashier</span>
                    <h1 className={styles.heroTitle}>Search Orders</h1>
                    <p className={styles.heroDescription}>
                        Search all branch orders and review payment status, customers, and order history from one screen.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => void loadOrders()}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    {canReceiveCreditPayments ? (
                        <button
                            type="button"
                            className={styles.buttonPrimary}
                            onClick={() => navigate(`${consoleBase}/cashier/credit-payments`)}
                        >
                            <CreditCard size={16} />
                            Credit Payments
                        </button>
                    ) : null}
                </div>
            </section>

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Matching Orders</span>
                    <strong className={styles.summaryValue}>{filteredOrders.length}</strong>
                    <span className={styles.summarySub}>Orders matching the current branch and filters</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Order Value</span>
                    <strong className={styles.summaryValue}>{formatMoney(summary.totalValue)}</strong>
                    <span className={styles.summarySub}>Gross value of the filtered set</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Credited Orders</span>
                    <strong className={styles.summaryValue}>{summary.creditedCount}</strong>
                    <span className={styles.summarySub}>{formatMoney(summary.outstandingTotal)} still collectible</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Paid Orders</span>
                    <strong className={styles.summaryValue}>{summary.paidCount}</strong>
                    <span className={styles.summarySub}>Already settled orders in the result</span>
                </article>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Search Filters</h2>
                        <p className={styles.panelSubtext}>Filters apply instantly to all branch orders.</p>
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
                        <label>Paid / Unpaid</label>
                        <select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}>
                            <option value="all">All</option>
                            <option value="paid">Paid</option>
                            <option value="partial">Partial</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="credited">Credited Only</option>
                        </select>
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
                        <h2 className={styles.panelTitle}>Search Orders</h2>
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
                    <div className={styles.emptyState}>Loading branch orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className={styles.emptyState}>No orders match the current filters.</div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Customer</th>
                                    <th>Sale Counter</th>
                                    <th>Order Taker</th>
                                    <th>Type</th>
                                    <th>Order Date</th>
                                    <th>Total</th>
                                    <th>Outstanding</th>
                                    <th>Payment Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedOrders.map((order) => {
                                    const outstanding = getOutstandingAmount(order);
                                    return (
                                        <tr key={order.id}>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong>{formatVisibleOrderNumber(order)}</strong>
                                                    <span className={styles.muted}>{String(order.order_status || 'pending').replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong>{order.customer_name || 'Walk-in customer'}</strong>
                                                    <span className={styles.muted}>{order.customer_phone || '-'}</span>
                                                </div>
                                            </td>
                                            <td>{order.sale_counter_code || order.sale_counter_name || '-'}</td>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong>{order.order_taker_name || 'Staff'}</strong>
                                                    <span className={styles.muted}>{order.order_taker_username || '-'}</span>
                                                </div>
                                            </td>
                                            <td>{String(order.order_type || 'dine_in').replace('_', ' ')}</td>
                                            <td>{formatDateTime(order.created_at)}</td>
                                            <td><strong>{formatMoney(order.total_amount)}</strong></td>
                                            <td><strong className={outstanding > 0 ? styles.amountWarning : styles.amountPositive}>{formatMoney(outstanding)}</strong></td>
                                            <td><span className={paymentBadgeClass(order.payment_status)}>{paymentStatusLabel(order.payment_status)}</span></td>
                                            <td>
                                                <div className={styles.actionStack}>
                                                    {isCreditEligibleOrder(order) && canReceiveCreditPayments ? (
                                                        <button type="button" className={styles.iconAction} title="Receive Payment" aria-label="Receive Payment" onClick={() => navigate(`${consoleBase}/cashier/credit-payments?order=${encodeURIComponent(formatVisibleOrderNumber(order) || String(order.id))}`)}>
                                                            <Wallet size={14} />
                                                        </button>
                                                    ) : (
                                                        <span className={styles.actionTextMuted}>Settled</span>
                                                    )}
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
                                                            <button type="button" className={styles.iconAction} title="Order Detail" aria-label="Order Detail" onClick={() => setDetailOrder(order)}>
                                                                <ClipboardList size={14} />
                                                            </button>
                                                            <button type="button" className={styles.iconAction} title="Payment History" aria-label="Payment History" onClick={() => setPaymentHistoryOrder(order)}>
                                                                <CreditCard size={14} />
                                                            </button>
                                                            <button type="button" className={styles.iconAction} title="Order History" aria-label="Order History" onClick={() => setOrderHistoryOrder(order)}>
                                                                <History size={14} />
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {!isLoading && filteredOrders.length > 0 && (
                    <div className={styles.pager}>
                        <span className={styles.resultMeta}>Dense mode enabled to reduce page scroll.</span>
                        <div className={styles.pagerControls}>
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
            </section>
            {detailOrder && (
                <div className={styles.modalOverlay} onClick={() => setDetailOrder(null)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.detailOrderNumber}>{formatVisibleOrderNumber(detailOrder)}</h2>
                                <p>{detailOrder.customer_name || 'Walk-in customer'} • {formatDateTime(detailOrder.created_at)}</p>
                                <div className={styles.detailMetaRow}>
                                    <span className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>KOT</span>{formatVisibleKotNumbers(detailOrder)}</span>
                                </div>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setDetailOrder(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSectionTitle}>Order Snapshot</p>
                            <div className={styles.detailSummaryGrid}>
                                <div className={styles.detailSummaryCell}><span>Order Type</span><strong>{String(detailOrder.order_type || 'dine_in').replace('_', ' ')}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Table Number</span><strong>{detailOrder.table_number || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Sale Counter</span><strong>{detailOrder.sale_counter_code || detailOrder.sale_counter_name || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Customer</span><strong>{detailOrder.customer_name || 'Walk-in customer'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Order Taker</span><strong>{detailOrder.order_taker_name || 'Staff'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Receipt</span><strong>{formatVisibleReceiptNumber(detailOrder)}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Payment Status</span><strong>{paymentStatusLabel(detailOrder.payment_status)}</strong></div>
                            </div>
                            <div className={styles.detailNoteBox}>
                                <strong>Order Comments</strong>
                                <span>{detailOrder.order_note || '-'}</span>
                            </div>
                            <p className={styles.modalSectionTitle}>Items</p>
                            <div className={styles.detailTableWrap}>
                                <table className={styles.detailTable}>
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Qty</th>
                                            <th>Unit Price</th>
                                            <th>Line Total</th>
                                            <th>Line Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detailOrder.items || []).filter((item) => String(item.item_status || '').toLowerCase() !== 'voided').map((item) => (
                                            <tr key={item.id || `${item.product_name}-${item.quantity}`}>
                                                <td>{item.product_name || 'Unnamed item'}</td>
                                                <td>{Number(item.quantity || 0)}</td>
                                                <td>{formatMoney(item.item_price)}</td>
                                                <td>{formatMoney(getItemLineTotal(item))}</td>
                                                <td>{getItemNote(item) || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className={styles.detailTotalsCard}>
                                <div className={styles.detailTotalRow}><span>Subtotal</span><strong>{formatMoney(detailOrder.sub_total)}</strong></div>
                                <div className={styles.detailTotalRow}><span>GST</span><strong>{formatMoney(detailOrder.tax_amount)}</strong></div>
                                <div className={styles.detailTotalRow}><span>Discount</span><strong>{formatMoney(detailOrder.discount_amount)}</strong></div>
                                <div className={styles.detailTotalRow}><span>Voucher</span><strong>{detailOrder.voucher_code ? `${detailOrder.voucher_code}${detailOrder.voucher_name ? ` - ${detailOrder.voucher_name}` : ''}` : '-'}</strong></div>
                                <div className={`${styles.detailTotalRow} ${styles.detailGrandTotal}`}><span>Grand Total</span><strong>{formatMoney(detailOrder.total_amount)}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {paymentHistoryOrder && (
                <div className={styles.modalOverlay} onClick={() => setPaymentHistoryOrder(null)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Payment History</h2>
                                <p>{formatVisibleOrderNumber(paymentHistoryOrder)}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setPaymentHistoryOrder(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSectionTitle}>Transactions</p>
                            <div className={styles.detailTableWrap}>
                                <table className={styles.detailTable}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Method</th>
                                            <th>Amount</th>
                                            <th>Reference</th>
                                            <th>Cashier</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(paymentHistoryOrder.payments || []).filter((payment) => !payment.is_refund).map((payment) => (
                                            <tr key={payment.id || `${payment.payment_mode}-${payment.amount}-${payment.transaction_date}`}>
                                                <td>{formatDateTime(payment.transaction_date)}</td>
                                                <td>{String(payment.payment_mode || '-').replace('_', ' ')}</td>
                                                <td>{formatMoney(payment.amount)}</td>
                                                <td>{payment.reference_number || '-'}</td>
                                                <td>{(payment as any).user_name || '-'}</td>
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
                    onClose={() => setOrderHistoryOrder(null)}
                    orderId={orderHistoryOrder.id}
                    orderNumber={formatVisibleOrderNumber(orderHistoryOrder)}
                />
            )}
        </div>
    );
}

export default CashierOrderSearch;
