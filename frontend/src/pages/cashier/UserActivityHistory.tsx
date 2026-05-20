/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Download, Eye, FileText, History, Printer, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { posApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, formatConfiguredReceiptNumber } from '../pos/printTemplates/printHelpers';
import { formatDateTime, formatMoney, paymentStatusLabel } from './cashierUtils';
import styles from './CashierShared.module.css';

const today = new Date();
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - 7);
const todayKey = today.toISOString().slice(0, 10);
const weekStartKey = weekStart.toISOString().slice(0, 10);

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        toast.error('Nothing To Export', 'No user history rows are available for export.');
        return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((key) => {
            const value = row[key] == null ? '' : String(row[key]);
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')),
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

function statusClass(value?: string | null): string {
    const normalized = String(value || '').toLowerCase();
    if (['completed', 'paid', 'success'].includes(normalized)) return `${styles.statusBadge} ${styles.statusPaid}`;
    if (['voided', 'cancelled', 'error'].includes(normalized)) return `${styles.statusBadge} ${styles.statusUnpaid}`;
    if (['partial', 'warning', 'pending'].includes(normalized)) return `${styles.statusBadge} ${styles.statusPartial}`;
    return `${styles.statusBadge} ${styles.statusOther}`;
}

function eventClass(value?: string | null): string {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('void') || normalized.includes('refund')) return `${styles.statusBadge} ${styles.statusUnpaid}`;
    if (normalized.includes('payment')) return `${styles.statusBadge} ${styles.statusPaid}`;
    if (normalized.includes('discount') || normalized.includes('credit')) return `${styles.statusBadge} ${styles.statusPartial}`;
    return `${styles.statusBadge} ${styles.statusOther}`;
}

function getVisibleOrderItems(order: any): any[] {
    return (order.items ?? []).filter((item: any) => String(item.item_status || '').toLowerCase() !== 'voided');
}

function getProductCount(order: any): number {
    return new Set(getVisibleOrderItems(order).map((item: any) => item.product_id || item.product_name || item.id)).size;
}

function getItemQuantityCount(order: any): number {
    return getVisibleOrderItems(order).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
}

export function UserActivityHistory() {
    const { activeBranch } = useBranchContext();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const [users, setUsers] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        user_id: '',
        user_search: '',
        date_from: weekStartKey,
        date_to: todayKey,
    });
    const [history, setHistory] = useState<any>({
        summary: {},
        orders: [],
        transactions: [],
        audit_logs: [],
    });
    const [loading, setLoading] = useState(true);
    const [detailOrder, setDetailOrder] = useState<any | null>(null);

    const loadUsers = useCallback(async () => {
        if (!branchId) {
            setUsers([]);
            return;
        }
        try {
            const rows = await posApi.getUserHistoryUsers({
                branch_id: branchId,
                search: filters.user_search.trim() || undefined,
            });
            setUsers(Array.isArray(rows) ? rows : []);
        } catch (error: any) {
            toast.error('Users Unavailable', error?.message || 'Could not load user filter data.');
        }
    }, [branchId, filters.user_search]);

    const loadHistory = useCallback(async () => {
        if (!branchId) {
            setHistory({ summary: {}, orders: [], transactions: [], audit_logs: [] });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await posApi.getUserActivityHistory({
                branch_id: branchId,
                user_id: filters.user_id || undefined,
                date_from: filters.date_from || undefined,
                date_to: filters.date_to || undefined,
            });
            setHistory(data || { summary: {}, orders: [], transactions: [], audit_logs: [] });
        } catch (error: any) {
            toast.error('User History Unavailable', error?.message || 'Could not load user activity and transaction history.');
        } finally {
            setLoading(false);
        }
    }, [branchId, filters.date_from, filters.date_to, filters.user_id]);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const formatOrderNumber = useCallback((order: any) => (
        formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, activeBranch || order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`
    ), [activeBranch]);

    const formatKotNumbers = useCallback((order: any) => (
        (order.kot_numbers || [])
            .map((kotNumber: string) => formatConfiguredKotNumber(kotNumber, activeBranch || order, { preserveTypePrefix: true }) || kotNumber)
            .join(', ') || order.kot_base_display || '-'
    ), [activeBranch]);

    const formatReceiptNumber = useCallback((order: any) => (
        formatConfiguredReceiptNumber(order.receipt_number || '-', activeBranch || order, { preserveTypePrefix: true })
        || order.receipt_number
        || '-'
    ), [activeBranch]);

    const summary = history?.summary ?? {};
    const orders = history?.orders ?? [];
    const transactions = history?.transactions ?? [];
    const auditLogs = history?.audit_logs ?? [];

    const exportRows = useMemo(() => [
        ...orders.map((order: any) => ({
            Section: 'Orders',
            Date: formatDateTime(order.created_at),
            User: order.order_taker_name || '-',
            Type: order.order_status || '-',
            Reference: formatOrderNumber(order),
            Customer: order.customer_name || 'Walk-in customer',
            Amount: Number(order.total_amount || 0),
            Detail: (order.items ?? []).map((item: any) => `${item.product_name} x${Number(item.quantity || 0)}`).join('; '),
        })),
        ...transactions.map((event: any) => ({
            Section: 'Transactions',
            Date: formatDateTime(event.occurred_at),
            User: event.user_name || '-',
            Type: event.type,
            Reference: event.order_number || event.reference_number || '-',
            Customer: event.customer || '-',
            Amount: Number(event.amount || 0),
            Detail: event.description || '-',
        })),
        ...auditLogs.map((log: any) => ({
            Section: 'Audit',
            Date: formatDateTime(log.timestamp),
            User: log.user_name || '-',
            Type: log.action || '-',
            Reference: log.entity_id || log.request_path || '-',
            Customer: '-',
            Amount: '',
            Detail: log.details || log.entity || '-',
        })),
    ], [auditLogs, formatOrderNumber, orders, transactions]);

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><UserRound size={14} /> Audit Extension</span>
                    <h1 className={styles.heroTitle}>User Activity & Transaction History</h1>
                    <p className={styles.heroDescription}>
                        Review orders handled, payments, refunds, voids, discounts, credit balances, vouchers, and audit events by user.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => window.print()}>
                        <Printer size={16} /> Print
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => window.print()}>
                        <FileText size={16} /> PDF
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => exportCsv(`user-history-${todayKey}.csv`, exportRows)}>
                        <Download size={16} /> Excel
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => void loadHistory()} disabled={loading}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </section>

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Orders Handled</span>
                    <strong className={styles.summaryValue}>{summary.order_count || 0}</strong>
                    <span className={styles.summarySub}>{formatMoney(summary.order_amount || 0)} order value</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Payments Collected</span>
                    <strong className={styles.summaryValue}>{formatMoney(summary.payments_collected || 0)}</strong>
                    <span className={styles.summarySub}>Cash, card, bank, wallet, and other tenders</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Refunds / Voids</span>
                    <strong className={styles.summaryValue}>{formatMoney((summary.refunds || 0) + (summary.void_amount || 0))}</strong>
                    <span className={styles.summarySub}>{summary.voids || 0} voided bills in this view</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Discounts / Credits</span>
                    <strong className={styles.summaryValue}>{formatMoney((summary.discounts || 0) + (summary.credit_adjustments || 0))}</strong>
                    <span className={styles.summarySub}>{summary.vouchers || 0} voucher events</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Audit Events</span>
                    <strong className={styles.summaryValue}>{summary.audit_events || 0}</strong>
                    <span className={styles.summarySub}>Create, update, void, and financial actions</span>
                </article>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>User Filter</h2>
                        <p className={styles.panelSubtext}>Leave user blank to review all authorized users in the selected branch period.</p>
                    </div>
                    <ShieldCheck size={18} />
                </div>
                <div className={styles.filterGrid}>
                    <label className={styles.field}>
                        <span>Find User</span>
                        <input
                            value={filters.user_search}
                            onChange={(event) => setFilters((current) => ({ ...current, user_search: event.target.value }))}
                            placeholder="Name, username, employee ID"
                        />
                    </label>
                    <label className={styles.field}>
                        <span>User</span>
                        <select value={filters.user_id} onChange={(event) => setFilters((current) => ({ ...current, user_id: event.target.value }))}>
                            <option value="">All users</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.label}{user.role ? ` - ${user.role}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        <span>From</span>
                        <input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
                    </label>
                    <label className={styles.field}>
                        <span>To</span>
                        <input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
                    </label>
                    <button type="button" className={styles.buttonPrimary} onClick={() => void loadHistory()} disabled={loading}>
                        <Search size={16} /> Apply
                    </button>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Orders Handled By User</h2>
                        <p className={styles.panelSubtext}>Compact order list. Open an order to review complete receipt-style details.</p>
                    </div>
                    <History size={18} />
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>KOT</th>
                                <th>User</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Products / Items</th>
                                <th>Amount</th>
                                <th>POS / Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order: any) => (
                                <tr key={order.id}>
                                    <td>
                                        <button type="button" className={styles.linkButton} onClick={() => setDetailOrder(order)}>
                                            {formatOrderNumber(order)}
                                        </button>
                                    </td>
                                    <td>{formatKotNumbers(order)}</td>
                                    <td>{order.order_taker_name || order.order_taker_username || 'Staff'}</td>
                                    <td><span className={statusClass(order.order_status)}>{String(order.order_status || '-').replaceAll('_', ' ')}</span></td>
                                    <td><span className={statusClass(order.payment_status)}>{paymentStatusLabel(order.payment_status)}</span></td>
                                    <td>{getProductCount(order)} products / {getItemQuantityCount(order)} items</td>
                                    <td>{formatMoney(order.total_amount || 0)}</td>
                                    <td>{formatDateTime(order.created_at)}</td>
                                    <td>
                                        <button type="button" className={styles.iconAction} title="View complete order detail" aria-label="View complete order detail" onClick={() => setDetailOrder(order)}>
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!orders.length ? (
                                <tr><td colSpan={9} className={styles.emptyState}>{loading ? 'Loading orders...' : 'No orders found for this user filter.'}</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Transactions By User</h2>
                        <p className={styles.panelSubtext}>Payments, refunds, voids, discounts, credit adjustments, and vouchers.</p>
                    </div>
                    <Activity size={18} />
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Date</th>
                                <th>User</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Mode / Ref</th>
                                <th>Amount</th>
                                <th>Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((event: any) => (
                                <tr key={event.id}>
                                    <td><span className={eventClass(event.type)}>{event.type}</span></td>
                                    <td>{formatDateTime(event.occurred_at)}</td>
                                    <td>{event.user_name || '-'}</td>
                                    <td>{event.order_number || event.order_id || '-'}</td>
                                    <td>{event.customer || '-'}</td>
                                    <td>{event.payment_mode || '-'}<br /><span className={styles.resultMeta}>{event.reference_number || '-'}</span></td>
                                    <td>{formatMoney(event.amount || 0)}</td>
                                    <td>{event.description || '-'}</td>
                                </tr>
                            ))}
                            {!transactions.length ? (
                                <tr><td colSpan={8} className={styles.emptyState}>{loading ? 'Loading transactions...' : 'No transactions found for this user filter.'}</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Full Activity Log</h2>
                        <p className={styles.panelSubtext}>Audit events are reused from the existing Console/Nexus audit log source.</p>
                    </div>
                    <FileText size={18} />
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Portal</th>
                                <th>Status</th>
                                <th>Path / Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.map((log: any) => (
                                <tr key={log.id}>
                                    <td>{formatDateTime(log.timestamp)}</td>
                                    <td>{log.user_name || '-'}<br /><span className={styles.resultMeta}>{log.user_role || '-'}</span></td>
                                    <td>{log.action || '-'}</td>
                                    <td>{log.entity || '-'}<br /><span className={styles.resultMeta}>{log.entity_id || '-'}</span></td>
                                    <td>{log.portal || '-'}</td>
                                    <td><span className={statusClass(log.status)}>{log.status || '-'}</span></td>
                                    <td>{log.request_path || '-'}<br /><span className={styles.resultMeta}>{log.details || '-'}</span></td>
                                </tr>
                            ))}
                            {!auditLogs.length ? (
                                <tr><td colSpan={7} className={styles.emptyState}>{loading ? 'Loading audit logs...' : 'No audit activity found for this user filter.'}</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            {detailOrder ? (
                <div className={styles.modalOverlay} onClick={() => setDetailOrder(null)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.detailHeadline}>
                                <h2 className={styles.detailOrderNumber}>{formatOrderNumber(detailOrder)}</h2>
                                <p>{detailOrder.customer_name || 'Walk-in customer'} • {formatDateTime(detailOrder.created_at)}</p>
                                <div className={styles.detailMetaRow}>
                                    <span className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>KOT</span>{formatKotNumbers(detailOrder)}</span>
                                    <span className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>Receipt</span>{formatReceiptNumber(detailOrder)}</span>
                                    <span className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>Status</span>{String(detailOrder.order_status || '-').replaceAll('_', ' ')}</span>
                                </div>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setDetailOrder(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <p className={styles.modalSectionTitle}>Order Snapshot</p>
                            <div className={styles.detailSummaryGrid}>
                                <div className={styles.detailSummaryCell}><span>Timestamp</span><strong>{formatDateTime(detailOrder.created_at)}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Order Type</span><strong>{String(detailOrder.order_type || 'dine_in').replace('_', ' ')}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Table</span><strong>{detailOrder.table_name || detailOrder.table_number || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Sale Counter</span><strong>{detailOrder.sale_counter_code || detailOrder.sale_counter_name || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Order Taker</span><strong>{detailOrder.order_taker_name || 'Staff'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Payment Status</span><strong>{paymentStatusLabel(detailOrder.payment_status)}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Products</span><strong>{getProductCount(detailOrder)}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Items</span><strong>{getItemQuantityCount(detailOrder)}</strong></div>
                            </div>

                            <div className={styles.detailNoteBox}>
                                <strong>Order Note</strong>
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
                                            <th>Total</th>
                                            <th>Status / Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getVisibleOrderItems(detailOrder).map((item: any) => (
                                            <tr key={item.id}>
                                                <td>{item.product_name || `Product #${item.product_id || '-'}`}</td>
                                                <td>{Number(item.quantity || 0)}</td>
                                                <td>{formatMoney(item.item_price || 0)}</td>
                                                <td>{formatMoney(Number(item.quantity || 0) * Number(item.item_price || 0))}</td>
                                                <td>{String(item.item_status || 'active').replaceAll('_', ' ')}{item.item_notes ? ` / ${item.item_notes}` : ''}</td>
                                            </tr>
                                        ))}
                                        {!getVisibleOrderItems(detailOrder).length ? (
                                            <tr><td colSpan={5} className={styles.emptyState}>No active items on this order.</td></tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>

                            <p className={styles.modalSectionTitle}>Tax, Charges & Totals</p>
                            <div className={styles.detailTotalsCard}>
                                <div className={styles.detailTotalRow}><span>Subtotal</span><strong>{formatMoney(detailOrder.sub_total || 0)}</strong></div>
                                {(detailOrder.charges || []).map((charge: any) => (
                                    <div key={charge.id || charge.charge_name} className={styles.detailTotalRow}>
                                        <span>{charge.charge_name || (charge.is_tax ? 'Tax' : 'Charge')}{charge.applied_rate ? ` (${charge.applied_rate}%)` : ''}</span>
                                        <strong>{formatMoney(charge.amount || 0)}</strong>
                                    </div>
                                ))}
                                <div className={styles.detailTotalRow}><span>GST / Tax Total</span><strong>{formatMoney(detailOrder.tax_amount || 0)}</strong></div>
                                <div className={styles.detailTotalRow}><span>Discount</span><strong>{formatMoney(detailOrder.discount_amount || 0)}</strong></div>
                                <div className={styles.detailTotalRow}><span>Voucher</span><strong>{detailOrder.voucher_code ? `${detailOrder.voucher_code}${detailOrder.voucher_name ? ` - ${detailOrder.voucher_name}` : ''}` : '-'}</strong></div>
                                <div className={`${styles.detailTotalRow} ${styles.detailGrandTotal}`}><span>Grand Total</span><strong>{formatMoney(detailOrder.total_amount || 0)}</strong></div>
                            </div>

                            <p className={styles.modalSectionTitle}>Payments</p>
                            <div className={styles.detailTableWrap}>
                                <table className={styles.detailTable}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Mode</th>
                                            <th>Amount</th>
                                            <th>Reference</th>
                                            <th>User</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detailOrder.payments || detailOrder.transactions || []).map((payment: any) => (
                                            <tr key={payment.id}>
                                                <td>{formatDateTime(payment.transaction_date)}</td>
                                                <td>{String(payment.payment_mode || '-').replaceAll('_', ' ')}</td>
                                                <td>{formatMoney(payment.amount || 0)}{payment.is_refund ? ' refund' : ''}</td>
                                                <td>{payment.reference_number || '-'}</td>
                                                <td>{payment.user_name || '-'}</td>
                                            </tr>
                                        ))}
                                        {!(detailOrder.payments || detailOrder.transactions || []).length ? (
                                            <tr><td colSpan={5} className={styles.emptyState}>No payment transactions recorded.</td></tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
