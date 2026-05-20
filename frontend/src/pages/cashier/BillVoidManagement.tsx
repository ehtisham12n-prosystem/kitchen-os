/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileText, Printer, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { posApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredOrderNumber, formatConfiguredReceiptNumber } from '../pos/printTemplates/printHelpers';
import { formatDateTime, formatMoney } from './cashierUtils';
import styles from './CashierShared.module.css';

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const todayKey = today.toISOString().slice(0, 10);

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        toast.error('Nothing To Export', 'No void rows are available for export.');
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

export function BillVoidManagement() {
    const { activeBranch } = useBranchContext();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const [filters, setFilters] = useState({
        order_no: '',
        kot_no: '',
        customer: '',
        date_from: monthStart,
        date_to: todayKey,
        payment_type: 'all',
        payment_status: 'all',
        credit_only: false,
        status: 'all',
    });
    const [orders, setOrders] = useState<any[]>([]);
    const [report, setReport] = useState<any>({ rows: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [voiding, setVoiding] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [voidForm, setVoidForm] = useState({ reason: '', approval_username: '', approval_pin: '' });

    const formatVisibleOrderNumber = useCallback((order: any) => (
        formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, activeBranch || order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`
    ), [activeBranch]);

    const formatVisibleReceiptNumber = useCallback((order: any) => (
        formatConfiguredReceiptNumber(order.receipt_number || '-', activeBranch || order, { preserveTypePrefix: true })
        || order.receipt_number
        || '-'
    ), [activeBranch]);

    const load = useCallback(async () => {
        if (!branchId) {
            setOrders([]);
            setReport({ rows: [], summary: {} });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const scopedFilters = { ...filters, branch_id: branchId };
            const [orderRows, voidReport] = await Promise.all([
                posApi.searchBillVoidOrders(scopedFilters),
                posApi.getBillVoidReport(scopedFilters),
            ]);
            setOrders(Array.isArray(orderRows) ? orderRows : []);
            setReport(voidReport || { rows: [], summary: {} });
        } catch (error: any) {
            toast.error('Bill Void Unavailable', error?.message || 'Could not load bill void management data.');
        } finally {
            setLoading(false);
        }
    }, [branchId, filters]);

    useEffect(() => {
        void load();
    }, [load]);

    const summary = report?.summary ?? {};
    const voidRows = report?.rows ?? [];
    const activeOrders = useMemo(() => orders.filter((order) => !['voided', 'cancelled'].includes(String(order.order_status || '').toLowerCase())), [orders]);
    const creditedOrders = useMemo(() => activeOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'credited'), [activeOrders]);
    const paidOrders = useMemo(() => activeOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid'), [activeOrders]);

    const exportRows = useMemo(() => voidRows.map((row: any) => ({
        'Void Date': formatDateTime(row.voided_at),
        Branch: row.branch_name || activeBranch?.branch_name || '-',
        'Order No': row.order_number || row.order_id,
        Receipt: row.receipt_number || '-',
        Customer: row.customer_name || 'Walk-in customer',
        'Original Status': row.original_order_status || '-',
        'Payment Status': row.original_payment_status || '-',
        'Payment Method': row.original_payment_method || '-',
        Amount: Number(row.voided_amount || 0),
        Reason: row.reason || '-',
        'Voided By': row.voided_by_username || '-',
    })), [activeBranch?.branch_name, voidRows]);

    const submitVoid = async () => {
        if (!selectedOrder) return;
        const reason = voidForm.reason.trim();
        if (!reason) {
            toast.error('Reason Required', 'Enter a reason before voiding this bill.');
            return;
        }
        const confirmed = window.confirm(`Void ${formatVisibleOrderNumber(selectedOrder)} for ${formatMoney(selectedOrder.total_amount)}? This is permanent and audit logged.`);
        if (!confirmed) return;
        setVoiding(true);
        try {
            await posApi.voidBill(selectedOrder.id, {
                branch_id: branchId,
                reason,
                approval_username: voidForm.approval_username.trim() || undefined,
                approval_pin: voidForm.approval_pin.trim() || undefined,
            });
            toast.success('Bill Voided', 'The bill was marked VOID and audit history was recorded.');
            setSelectedOrder(null);
            setVoidForm({ reason: '', approval_username: '', approval_pin: '' });
            await load();
        } catch (error: any) {
            toast.error('Void Failed', error?.message || 'Could not void this bill.');
        } finally {
            setVoiding(false);
        }
    };

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><ShieldCheck size={14} /> Controlled Module</span>
                    <h1 className={styles.heroTitle}>Bill Void Management</h1>
                    <p className={styles.heroDescription}>
                        Securely void paid, unpaid, and credited bills without deleting operational or financial history.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => window.print()}>
                        <Printer size={16} /> Print
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => window.print()}>
                        <FileText size={16} /> PDF
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => exportCsv(`void-report-${todayKey}.csv`, exportRows)}>
                        <Download size={16} /> Excel
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => void load()}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </section>

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Void Count</span>
                    <strong className={styles.summaryValue}>{summary.total_void_count || 0}</strong>
                    <span className={styles.summarySub}>Audit rows in selected period</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Void Amount</span>
                    <strong className={styles.summaryValue}>{formatMoney(summary.total_void_amount || 0)}</strong>
                    <span className={styles.summarySub}>Total value voided</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Credited Bills</span>
                    <strong className={styles.summaryValue}>{creditedOrders.length}</strong>
                    <span className={styles.summarySub}>Visible and eligible for controlled void</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Paid Bills</span>
                    <strong className={styles.summaryValue}>{paidOrders.length}</strong>
                    <span className={styles.summarySub}>Settled bills in search results</span>
                </article>
            </section>

            <section className={styles.bannerDanger}>
                <AlertTriangle size={18} />
                <div>
                    <strong>No deletion is performed.</strong>
                    <div className={styles.muted}>Voided bills stay visible with a red VOID status, refund/reversal records, and immutable audit history.</div>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Search Bills</h2>
                        <p className={styles.panelSubtext}>Search by order, KOT, customer, status, payment type, and date range.</p>
                    </div>
                    <button
                        type="button"
                        className={styles.buttonGhost}
                        onClick={() => setFilters({ order_no: '', kot_no: '', customer: '', date_from: monthStart, date_to: todayKey, payment_type: 'all', payment_status: 'all', credit_only: false, status: 'all' })}
                    >
                        Reset
                    </button>
                </div>
                <div className={styles.filterGrid}>
                    <div className={styles.field}><label>Order No</label><input value={filters.order_no} onChange={(event) => setFilters((current) => ({ ...current, order_no: event.target.value }))} placeholder="Order or receipt no" /></div>
                    <div className={styles.field}><label>KOT No</label><input value={filters.kot_no} onChange={(event) => setFilters((current) => ({ ...current, kot_no: event.target.value }))} placeholder="KOT no" /></div>
                    <div className={styles.field}><label>Customer</label><input value={filters.customer} onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))} placeholder="Name or phone" /></div>
                    <div className={styles.field}><label>From</label><input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} /></div>
                    <div className={styles.field}><label>To</label><input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} /></div>
                    <div className={styles.field}><label>Payment Type</label><select value={filters.payment_type} onChange={(event) => setFilters((current) => ({ ...current, payment_type: event.target.value }))}><option value="all">All</option><option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank</option><option value="digital_wallet">Digital Wallet</option><option value="other">Other</option></select></div>
                    <div className={styles.field}><label>Payment Status</label><select value={filters.payment_status} onChange={(event) => setFilters((current) => ({ ...current, payment_status: event.target.value }))}><option value="all">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="credited">Credited</option><option value="voided">Voided</option></select></div>
                    <div className={styles.field}><label>Status</label><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="served">Served</option><option value="voided">Voided</option></select></div>
                    <div className={styles.field}><label>Credit Orders</label><select value={filters.credit_only ? 'yes' : 'no'} onChange={(event) => setFilters((current) => ({ ...current, credit_only: event.target.value === 'yes' }))}><option value="no">Include all</option><option value="yes">Credit only</option></select></div>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Bills / Orders</h2>
                        <p className={styles.panelSubtext}>{loading ? 'Loading...' : `${orders.length} matching bills`}</p>
                    </div>
                    <Search size={18} />
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Amount</th>
                                <th>Counter</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const isVoided = ['voided', 'cancelled'].includes(String(order.order_status || '').toLowerCase());
                                return (
                                    <tr key={order.id}>
                                        <td><div className={styles.stack}><strong>{formatVisibleOrderNumber(order)}</strong><span className={styles.muted}>{formatVisibleReceiptNumber(order)}</span></div></td>
                                        <td>{order.customer_name || 'Walk-in customer'}</td>
                                        <td>{formatDateTime(order.created_at)}</td>
                                        <td><span className={`${styles.statusBadge} ${isVoided ? styles.statusUnpaid : styles.statusPaid}`}>{isVoided ? 'VOID' : 'Active'}</span></td>
                                        <td><div className={styles.stack}><strong>{String(order.payment_status || '-').toUpperCase()}</strong><span className={styles.muted}>{order.original_payment_method || '-'}</span></div></td>
                                        <td>{formatMoney(order.total_amount)}</td>
                                        <td>{order.sale_counter_name || order.sale_counter_code || '-'}</td>
                                        <td>
                                            <button type="button" className={styles.buttonSecondary} disabled={isVoided} onClick={() => setSelectedOrder(order)}>
                                                <XCircle size={14} /> Void
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!orders.length && <tr><td colSpan={8} className={styles.emptyState}>No bills match the current search.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Void Report / Audit History</h2>
                        <p className={styles.panelSubtext}>Immutable void records for customer, user, branch, payment, and financial review.</p>
                    </div>
                    <span className={styles.statusBadge}>{voidRows.length} rows</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Voided At</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Amount</th>
                                <th>Reason</th>
                                <th>Voided By</th>
                                <th>Payment</th>
                                <th>Counter</th>
                            </tr>
                        </thead>
                        <tbody>
                            {voidRows.map((row: any) => (
                                <tr key={row.id}>
                                    <td>{formatDateTime(row.voided_at)}</td>
                                    <td><div className={styles.stack}><strong>{row.order_number || row.order_id}</strong><span className={styles.muted}>{row.receipt_number || '-'}</span></div></td>
                                    <td>{row.customer_name || 'Walk-in customer'}</td>
                                    <td>{formatMoney(row.voided_amount)}</td>
                                    <td>{row.reason || '-'}</td>
                                    <td><div className={styles.stack}><strong>{row.voided_by_username || '-'}</strong><span className={styles.muted}>{row.voided_by_role || '-'}</span></div></td>
                                    <td><div className={styles.stack}><strong>{row.original_payment_status || '-'}</strong><span className={styles.muted}>{row.original_payment_method || '-'}</span></div></td>
                                    <td>{row.sale_counter_name || '-'}</td>
                                </tr>
                            ))}
                            {!voidRows.length && <tr><td colSpan={8} className={styles.emptyState}>No void history for the selected period.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            {selectedOrder && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Void Bill</h2>
                                <p>{formatVisibleOrderNumber(selectedOrder)} · {formatMoney(selectedOrder.total_amount)}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setSelectedOrder(null)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <section className={styles.bannerDanger}>
                                <AlertTriangle size={18} />
                                <div>
                                    <strong>Permanent audit action</strong>
                                    <div className={styles.muted}>The order will be marked VOID, reversal/refund records will be posted, and history will remain visible.</div>
                                </div>
                            </section>
                            <div className={styles.filterGrid}>
                                <div className={`${styles.field} ${styles.fieldFull}`}>
                                    <label>Void Reason *</label>
                                    <textarea value={voidForm.reason} onChange={(event) => setVoidForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Required reason for audit trail" />
                                </div>
                                <div className={styles.field}>
                                    <label>Manager Username / PIN User</label>
                                    <input value={voidForm.approval_username} onChange={(event) => setVoidForm((current) => ({ ...current, approval_username: event.target.value }))} placeholder="Optional" />
                                </div>
                                <div className={styles.field}>
                                    <label>Manager PIN</label>
                                    <input type="password" value={voidForm.approval_pin} onChange={(event) => setVoidForm((current) => ({ ...current, approval_pin: event.target.value }))} placeholder="Optional" />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => setSelectedOrder(null)}>Cancel</button>
                            <button type="button" className={styles.buttonPrimary} disabled={voiding} onClick={() => void submitVoid()}>
                                <XCircle size={16} /> {voiding ? 'Voiding...' : 'Confirm Void'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
