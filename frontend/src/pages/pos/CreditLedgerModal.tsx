import { useState, useMemo, useEffect } from 'react';
import {
    X,
    DollarSign,
    Check,
    CreditCard,
    Printer,
    Wallet,
} from 'lucide-react';
import { posApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import {
    buildCreditPaymentReceivedPrintDocument,
    buildOutstandingOrdersReportPrintDocument,
} from './printTemplates/kotPrintTemplate';
import { formatConfiguredOrderNumber, openPrintDocumentCopies, resolvePrintTemplateSettings } from './printTemplates/printHelpers';
import {
    buildSettlementPayments,
    formatDateTime,
    formatMoney,
    getLastPaymentDate,
    getOutstandingAmount,
    getPaidAmount,
    isCreditEligibleOrder,
    normalizePaymentStatus,
    paymentStatusLabel,
    type CashierOrder,
} from '../cashier/cashierUtils';
import { canPrintCashierReceipt, printCashierPaymentReceipt } from '../cashier/cashierPaymentReceipt';
import cashierStyles from '../cashier/CashierShared.module.css';
import styles from './CreditLedgerModal.module.css';
const CREDIT_LEDGER_PAGE_SIZE = 12;

function paginateList<T>(rows: T[], page: number, pageSize: number) {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        page: safePage,
        totalPages,
        rows: rows.slice(start, start + pageSize),
        totalItems: rows.length,
    };
}

function paymentBadgeClass(status?: string | null): string {
    const normalized = normalizePaymentStatus(status);
    if (normalized === 'paid') return `${cashierStyles.statusBadge} ${cashierStyles.statusPaid}`;
    if (normalized === 'partial') return `${cashierStyles.statusBadge} ${cashierStyles.statusPartial}`;
    if (normalized === 'unpaid') return `${cashierStyles.statusBadge} ${cashierStyles.statusUnpaid}`;
    return `${cashierStyles.statusBadge} ${cashierStyles.statusOther}`;
}

function getLedgerDisplayStatus(order: CashierOrder): 'paid' | 'partial' | 'unpaid' | 'other' {
    const paid = getPaidAmount(order);
    const outstanding = getOutstandingAmount(order);
    if (outstanding > 0 && paid > 0) return 'partial';
    return normalizePaymentStatus(order.payment_status);
}

function getLedgerDisplayStatusLabel(order: CashierOrder): string {
    const status = getLedgerDisplayStatus(order);
    if (status === 'partial') return 'Partially Paid';
    return paymentStatusLabel(status);
}

interface CreditLedgerModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    onPaymentSuccess?: () => void;
}

export function CreditLedgerModal({ isOpen, onClose, branchId, onPaymentSuccess }: CreditLedgerModalProps) {
    const { canReadPos, canSettleCreditPayments, canPrintPosReceipts } = usePermissionAccess();
    const [orders, setOrders] = useState<CashierOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [takerFilter, setTakerFilter] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
    const [page, setPage] = useState(1);
    const [paymentTargetOrders, setPaymentTargetOrders] = useState<CashierOrder[]>([]);
    const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'bank' | 'digital_wallet' | 'other'>('cash');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentComments, setPaymentComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCounterSession, setActiveCounterSession] = useState<any | null>(null);
    const branchName = localStorage.getItem('branch_name') || 'KitchenOS';
    const settings = resolvePrintTemplateSettings({ branch_name: branchName }, branchName);
    const formatVisibleOrderNumber = (order: CashierOrder) => (
        formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`
    );
    const canReviewLedger = canReadPos || canSettleCreditPayments;
    const canReceivePayments = canSettleCreditPayments;

    useEffect(() => {
        if (isOpen && branchId) {
            void loadCreditOrders();
            void loadCounterSession();
        }
    }, [isOpen, branchId]);

    const loadCounterSession = async () => {
        try {
            const session = await posApi.getMyCounterSession(branchId);
            setActiveCounterSession(session);
        } catch {
            setActiveCounterSession(null);
        }
    };

    const loadCreditOrders = async () => {
        setIsLoading(true);
        try {
            const data = await posApi.getOrders(branchId);
            setOrders(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Load Failed', 'Could not fetch credit orders.');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = useMemo(() => {
        const searchToken = search.trim().toLowerCase();
        const takerToken = takerFilter.trim().toLowerCase();
        return orders
            .filter((order) => isCreditEligibleOrder(order))
            .filter((order) => {
                const matchesSearch = !searchToken || [
                    order.order_number,
                    order.customer_name,
                    order.customer_phone,
                    String(order.id),
                ].some((value) => String(value || '').toLowerCase().includes(searchToken));
                const matchesTaker = !takerToken || [
                    order.order_taker_name,
                    order.order_taker_username,
                ].some((value) => String(value || '').toLowerCase().includes(takerToken));
                return matchesSearch && matchesTaker;
            })
            .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
    }, [orders, search, takerFilter]);

    const selectedOrders = useMemo(
        () => filteredOrders.filter((order) => selectedOrderIds.has(order.id)),
        [filteredOrders, selectedOrderIds],
    );

    const totalSelectedAmount = useMemo(
        () => selectedOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0),
        [selectedOrders],
    );
    const topCustomerExposure = useMemo(() => {
        const customerMap = new Map<string, { label: string; orders: number; amount: number }>();
        filteredOrders.forEach((order) => {
            const label = String(order.customer_name || 'Guest Customer').trim() || 'Guest Customer';
            const current = customerMap.get(label) || { label, orders: 0, amount: 0 };
            current.orders += 1;
            current.amount += getOutstandingAmount(order);
            customerMap.set(label, current);
        });
        return Array.from(customerMap.values()).sort((left, right) => right.amount - left.amount)[0] || null;
    }, [filteredOrders]);
    const topOrderTakerExposure = useMemo(() => {
        const takerMap = new Map<string, { label: string; orders: number; amount: number }>();
        filteredOrders.forEach((order) => {
            const label = String(order.order_taker_name || 'Staff').trim() || 'Staff';
            const current = takerMap.get(label) || { label, orders: 0, amount: 0 };
            current.orders += 1;
            current.amount += getOutstandingAmount(order);
            takerMap.set(label, current);
        });
        return Array.from(takerMap.values()).sort((left, right) => right.amount - left.amount)[0] || null;
    }, [filteredOrders]);
    const pagedOrders = useMemo(() => paginateList(filteredOrders, page, CREDIT_LEDGER_PAGE_SIZE), [filteredOrders, page]);

    useEffect(() => {
        setPage(1);
    }, [search, takerFilter, isOpen]);

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(filteredOrders.length / CREDIT_LEDGER_PAGE_SIZE))));
    }, [filteredOrders.length]);

    const printOutstandingOrders = () => {
        const documentMarkup = buildOutstandingOrdersReportPrintDocument({
            settings,
            format: settings.report_paper_size || 'a6',
            data: {
                customer: search.trim() || 'All Customers',
                orders: filteredOrders.map((order) => ({
                    order_no: formatVisibleOrderNumber(order),
                    date: order.created_at || '',
                    total: formatMoney(order.total_amount),
                    paid: formatMoney(getPaidAmount(order)),
                    balance: formatMoney(getOutstandingAmount(order)),
                })),
                total_outstanding: formatMoney(filteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0)),
                printed_at: new Date(),
                print_id: `outstanding-${Date.now()}`,
            },
        });

        if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, 'Outstanding Orders')) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print reports.');
        }
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selectedOrderIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedOrderIds(next);
    };

    const toggleAll = () => {
        const visibleIds = pagedOrders.rows.map((order) => order.id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.has(id));
        if (allVisibleSelected) {
            const next = new Set(selectedOrderIds);
            visibleIds.forEach((id) => next.delete(id));
            setSelectedOrderIds(next);
        } else {
            const next = new Set(selectedOrderIds);
            visibleIds.forEach((id) => next.add(id));
            setSelectedOrderIds(next);
        }
    };

    const openPaymentModal = (targetOrders: CashierOrder[]) => {
        if (!canReceivePayments) {
            toast.error('Credit Settlement Restricted', 'Your branch role cannot receive credit payments from the terminal.');
            return;
        }
        if (targetOrders.length === 0) {
            toast.error('Nothing Selected', 'Choose one or more credited orders first.');
            return;
        }
        if (!activeCounterSession || activeCounterSession.terminal_status !== 'active') {
            toast.error('Counter Session Required', 'Receive payment only after opening your active sales counter session.');
            return;
        }
        setPaymentTargetOrders(targetOrders);
        setPaymentAmount(`${targetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0).toFixed(2)}`);
        setReferenceNumber('');
        setPaymentComments('');
    };

    const closePaymentModal = () => {
        setPaymentTargetOrders([]);
        setPaymentAmount('');
        setReferenceNumber('');
        setPaymentComments('');
    };

    const printSettlementReceipt = (
        settledOrders: CashierOrder[],
        totalPaidAmount: number,
        previousBalance: number,
        remainingBalance: number,
    ) => {
        const customerNames = Array.from(new Set(
            settledOrders.map((order) => String(order.customer_name || 'Walk-in customer').trim() || 'Walk-in customer'),
        ));
        const orderTakers = Array.from(new Set(
            settledOrders.map((order) => String(order.order_taker_name || 'Staff').trim() || 'Staff'),
        ));
        const accountLabel = customerNames.length === 1 ? 'Customer' : orderTakers.length === 1 ? 'Order Taker' : 'Selection';
        const accountValue = customerNames.length === 1 ? customerNames[0] : orderTakers.length === 1 ? orderTakers[0] : `${settledOrders.length} selected orders`;
        const primaryPhone = settledOrders.map((order) => String(order.customer_phone || '').trim()).find(Boolean);
        const counterLabel = activeCounterSession?.sale_counter?.code
            || activeCounterSession?.sale_counter?.name
            || activeCounterSession?.sale_counter_name
            || activeCounterSession?.counter_name
            || '-';
        const paymentDate = new Date();
        const documentMarkup = buildCreditPaymentReceivedPrintDocument({
            settings,
            format: settings.receipt_paper_size || 'thermal-80mm',
            data: {
                customer: accountValue,
                account_label: accountLabel,
                customer_phone: primaryPhone || undefined,
                invoices: settledOrders.map((order) => ({
                    invoice_no: order.receipt_number || null,
                    order_no: formatVisibleOrderNumber(order),
                    order_date: order.created_at || null,
                    order_taker: order.order_taker_name || 'Staff',
                    paid: formatMoney(getOutstandingAmount(order)),
                })),
                total_paid: formatMoney(totalPaidAmount),
                prev_balance: formatMoney(previousBalance),
                remaining: formatMoney(remainingBalance),
                cashier: activeCounterSession?.user?.user_name || activeCounterSession?.user?.full_name || 'Current cashier',
                pos_user_label: 'POS User',
                counter_id: counterLabel,
                payment_date: paymentDate,
                method: paymentMode.replace(/_/g, ' '),
                reference_number: referenceNumber.trim() || undefined,
                detail_lines: [
                    ...(paymentComments.trim() ? [{ label: 'Note', value: paymentComments.trim() }] : []),
                ],
                printed_at: paymentDate,
                print_id: `CPR-${Date.now()}`,
            },
        });

        if (!openPrintDocumentCopies(() => documentMarkup, settings.receipt_print_copies || 1, `Credit Payment ${accountValue}`)) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print receipts.');
        }
    };

    const settleOrders = async (printReceipt = false) => {
        if (!canReceivePayments) {
            toast.error('Credit Settlement Restricted', 'Your branch role cannot receive credit payments from the terminal.');
            return;
        }
        if (paymentTargetOrders.length === 0) return;
        const parsedAmount = Math.round(Number(paymentAmount || 0) * 100) / 100;
        const totalOutstanding = paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Invalid Amount', 'Enter a valid amount to receive.');
            return;
        }
        if (parsedAmount - totalOutstanding > 0.009) {
            toast.error('Amount Exceeded', 'Received amount cannot exceed the total outstanding balance.');
            return;
        }

        setIsSubmitting(true);
        try {
            let remaining = parsedAmount;
            const settledOrders: CashierOrder[] = [];
            for (const order of paymentTargetOrders) {
                const outstanding = getOutstandingAmount(order);
                if (outstanding <= 0 || remaining <= 0) continue;
                const appliedAmount = Math.min(outstanding, remaining);
                await posApi.settleCreditOrder(order.id, {
                    payments: buildSettlementPayments(appliedAmount, paymentMode, referenceNumber, paymentComments),
                    reference_number: referenceNumber.trim() || undefined,
                    payment_note: paymentComments.trim() || `POS terminal settlement for outstanding credit balance of ${appliedAmount.toFixed(2)}`,
                    branch_id: branchId,
                });
                settledOrders.push(order);
                remaining = Math.max(Math.round((remaining - appliedAmount) * 100) / 100, 0);
            }

            if (settledOrders.length === 0) {
                toast.error('Nothing Applied', 'The amount entered did not apply to any outstanding order.');
                return;
            }

            toast.success('Payments Processed', `Successfully settled ${settledOrders.length} order(s).`);
            if (printReceipt) {
                printSettlementReceipt(
                    settledOrders,
                    parsedAmount - remaining,
                    totalOutstanding,
                    Math.max(totalOutstanding - parsedAmount, 0),
                );
            }
            setSelectedOrderIds(new Set());
            closePaymentModal();
            void loadCreditOrders();
            if (onPaymentSuccess) onPaymentSuccess();
        } catch {
            toast.error('Payment Error', 'Some orders failed to process. Please check the ledger.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Credit & Payment Ledger</h2>
                    <button type="button" className={styles.headerCloseButton} onClick={onClose}><X size={18} /></button>
                </div>

                <div className={styles.filters}>
                    <div className={styles.inputGroup}>
                        <label>Search Customer / Order</label>
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Order Taker</label>
                        <input
                            type="text"
                            placeholder="Filter by taker..."
                            value={takerFilter}
                            onChange={(event) => setTakerFilter(event.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.summaryStrip}>
                    <div className={styles.summaryTile}>
                        <span>Pending Credit</span>
                        <strong>{formatMoney(filteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0))}</strong>
                        <small>{filteredOrders.length} order(s)</small>
                    </div>
                    <div className={styles.summaryTile}>
                        <span>Customer Exposure</span>
                        <strong>{topCustomerExposure?.label || '-'}</strong>
                        <small>{topCustomerExposure ? `${topCustomerExposure.orders} order(s) | ${formatMoney(topCustomerExposure.amount)}` : 'No pending customer credit'}</small>
                    </div>
                    <div className={styles.summaryTile}>
                        <span>Server / Cashier Exposure</span>
                        <strong>{topOrderTakerExposure?.label || '-'}</strong>
                        <small>{topOrderTakerExposure ? `${topOrderTakerExposure.orders} order(s) | ${formatMoney(topOrderTakerExposure.amount)}` : 'No pending staff credit'}</small>
                    </div>
                </div>

                <div className={styles.content}>
                    {!canReviewLedger ? (
                        <div className={cashierStyles.emptyState}>Credit ledger access is not available for your current branch role.</div>
                    ) : isLoading ? (
                        <div className={cashierStyles.emptyState}>Loading credited orders...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className={cashierStyles.emptyState}>No outstanding credit orders found.</div>
                    ) : (
                        <>
                            <div className={cashierStyles.selectionBar}>
                                <div className={cashierStyles.selectionText}>
                                    <strong>{selectedOrders.length} order(s) selected</strong>
                                    <span className={cashierStyles.muted}>Selected balance: {formatMoney(totalSelectedAmount)}</span>
                                </div>
                                <div className={cashierStyles.inlineActions}>
                                    <button type="button" className={cashierStyles.buttonSecondary} onClick={toggleAll}>
                                        <Check size={15} />
                                        {pagedOrders.rows.length > 0 && pagedOrders.rows.every((order) => selectedOrderIds.has(order.id))
                                            ? 'Clear Visible'
                                            : 'Select Visible'}
                                    </button>
                                    <button type="button" className={cashierStyles.buttonPrimary} disabled={!canReceivePayments || selectedOrders.length === 0} onClick={() => openPaymentModal(selectedOrders)}>
                                        <CreditCard size={15} />
                                        Receive Payment
                                    </button>
                                </div>
                            </div>
                            <div className={cashierStyles.pager}>
                                <span className={cashierStyles.resultMeta}>
                                    Showing {(pagedOrders.page - 1) * CREDIT_LEDGER_PAGE_SIZE + 1}-{Math.min(pagedOrders.page * CREDIT_LEDGER_PAGE_SIZE, pagedOrders.totalItems)} of {pagedOrders.totalItems}
                                </span>
                                <div className={cashierStyles.pagerControls}>
                                    <button type="button" className={cashierStyles.buttonSecondary} disabled={pagedOrders.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</button>
                                    <span className={cashierStyles.pageBadge}>Page {pagedOrders.page}/{pagedOrders.totalPages}</span>
                                    <button type="button" className={cashierStyles.buttonSecondary} disabled={pagedOrders.page >= pagedOrders.totalPages} onClick={() => setPage((current) => Math.min(pagedOrders.totalPages, current + 1))}>Next</button>
                                </div>
                            </div>
                            <div className={cashierStyles.tableWrap}>
                                <table className={cashierStyles.table}>
                                    <thead>
                                        <tr>
                                            <th>Select</th>
                                            <th>Order</th>
                                            <th>Customer</th>
                                            <th>Sale Counter</th>
                                            <th>Order Taker</th>
                                            <th>Order Date</th>
                                            <th>Total Amount</th>
                                            <th>Paid So Far</th>
                                            <th>Outstanding</th>
                                            <th>Last Payment Date</th>
                                            <th>Payment Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedOrders.rows.map((order) => {
                                            const outstanding = getOutstandingAmount(order);
                                            const paid = getPaidAmount(order);
                                            const isSelected = selectedOrderIds.has(order.id);
                                            const displayStatus = getLedgerDisplayStatus(order);

                                            return (
                                                <tr key={order.id}>
                                                    <td>
                                                        <input
                                                            className={cashierStyles.selectionCheckbox}
                                                            type="checkbox"
                                                            disabled={!canReceivePayments}
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(order.id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className={cashierStyles.stack}>
                                                            <strong>{formatVisibleOrderNumber(order)}</strong>
                                                            <span className={cashierStyles.muted}>{String(order.order_type || 'dine_in').replace(/_/g, ' ')}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={cashierStyles.stack}>
                                                            <strong>{order.customer_name || 'Walk-in customer'}</strong>
                                                            <span className={cashierStyles.muted}>{order.customer_phone || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td>{order.sale_counter_code || order.sale_counter_name || '-'}</td>
                                                    <td>{order.order_taker_name || 'Staff'}</td>
                                                    <td>{formatDateTime(order.created_at)}</td>
                                                    <td><strong>{formatMoney(order.total_amount)}</strong></td>
                                                    <td><strong className={cashierStyles.amountPositive}>{formatMoney(paid)}</strong></td>
                                                    <td><strong className={cashierStyles.amountWarning}>{formatMoney(outstanding)}</strong></td>
                                                    <td>{formatDateTime(getLastPaymentDate(order))}</td>
                                                    <td><span className={paymentBadgeClass(displayStatus)}>{getLedgerDisplayStatusLabel(order)}</span></td>
                                                    <td className={styles.inlineActionCell}>
                                                        <div className={`${cashierStyles.actionStack} ${styles.inlineActionRow}`}>
                                                            <button
                                                                type="button"
                                                                className={cashierStyles.iconAction}
                                                                title="Receive Payment"
                                                                aria-label="Receive Payment"
                                                                disabled={!canReceivePayments || isSubmitting}
                                                                onClick={() => openPaymentModal([order])}
                                                            >
                                                                <Wallet size={14} />
                                                            </button>
                                                            {canPrintPosReceipts && canPrintCashierReceipt(order) && (
                                                                <button
                                                                    type="button"
                                                                    className={`${cashierStyles.iconAction} ${cashierStyles.iconActionPrint} ${styles.plainPrintAction}`}
                                                                    title="Print Receipt"
                                                                    aria-label="Print Receipt"
                                                                    onClick={() => {
                                                                        if (!printCashierPaymentReceipt(order, order, branchName)) {
                                                                            toast.error('Print Blocked', 'Allow pop-ups for this app to print receipts.');
                                                                        }
                                                                    }}
                                                                >
                                                                    <Printer size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.selectionInfo}>
                        Selected: <b>{selectedOrders.length} Orders</b> | Total: <b>{formatMoney(totalSelectedAmount)}</b>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className={styles.secondaryActionButton} onClick={printOutstandingOrders}><Printer size={16} /> Print Outstanding</button>
                        <button type="button" className={styles.secondaryActionButton} onClick={onClose}>Cancel</button>
                        <button className={styles.settleBtn} disabled={!canReceivePayments || selectedOrders.length === 0} onClick={() => openPaymentModal(selectedOrders)}>
                            <DollarSign size={18} />
                            Settle Selected
                        </button>
                    </div>
                </div>
            </div>

            {paymentTargetOrders.length > 0 && (
                <div className={cashierStyles.modalOverlay} onClick={closePaymentModal}>
                    <div className={cashierStyles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={cashierStyles.modalHeader}>
                            <div>
                                <h2>Receive Payment</h2>
                                <p>{paymentTargetOrders.length} order(s) selected | Outstanding {formatMoney(paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0))}</p>
                            </div>
                            <button type="button" className={cashierStyles.modalClose} onClick={closePaymentModal}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={cashierStyles.modalBody}>
                            <p className={cashierStyles.modalSectionTitle}>Counter Context</p>
                            <div className={cashierStyles.detailSummaryGrid}>
                                <div className={cashierStyles.detailSummaryCell}><span>Cashier</span><strong>{activeCounterSession?.user?.user_name || activeCounterSession?.user?.full_name || 'Current cashier'}</strong></div>
                                <div className={cashierStyles.detailSummaryCell}><span>Counter</span><strong>{activeCounterSession?.sale_counter?.name || activeCounterSession?.sale_counter?.code || '-'}</strong></div>
                                <div className={cashierStyles.detailSummaryCell}><span>Counter Status</span><strong>{String(activeCounterSession?.terminal_status || 'inactive').replace(/_/g, ' ')}</strong></div>
                                <div className={cashierStyles.detailSummaryCell}><span>Receive Amount</span><strong>{formatMoney(paymentAmount || 0)}</strong></div>
                            </div>
                            <p className={cashierStyles.modalSectionTitle}>Orders To Settle</p>
                            <div className={cashierStyles.detailTableWrap}>
                                <table className={cashierStyles.detailTable}>
                                    <thead>
                                        <tr>
                                            <th>S.No</th>
                                            <th>Order Number</th>
                                            <th>Order Date</th>
                                            <th>Order Amount</th>
                                            <th>Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paymentTargetOrders.map((order, index) => (
                                            <tr key={order.id}>
                                                <td>{index + 1}</td>
                                                <td>{formatVisibleOrderNumber(order)}</td>
                                                <td>{formatDateTime(order.created_at)}</td>
                                                <td>{formatMoney(order.total_amount)}</td>
                                                <td>{formatMoney(getOutstandingAmount(order))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className={cashierStyles.modalSectionTitle}>Payment Entry</p>
                            <div className={cashierStyles.filterGrid}>
                                <div className={cashierStyles.field}>
                                    <label>Payment Method</label>
                                    <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as typeof paymentMode)}>
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="bank">Bank Transfer</option>
                                        <option value="digital_wallet">Digital Wallet</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className={cashierStyles.field}>
                                    <label>Amount Taken</label>
                                    <input
                                        className={cashierStyles.strongInput}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={paymentAmount}
                                        onChange={(event) => setPaymentAmount(event.target.value)}
                                        placeholder={paymentTargetOrders.length > 0 ? `${paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0).toFixed(2)}` : '0.00'}
                                    />
                                </div>
                                <div className={cashierStyles.field}>
                                    <label>Reference Number</label>
                                    <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional reference" />
                                </div>
                                <div className={`${cashierStyles.field} ${cashierStyles.fieldSpan2}`}>
                                    <label>Comments</label>
                                    <textarea value={paymentComments} onChange={(event) => setPaymentComments(event.target.value)} placeholder="Payment comments" />
                                </div>
                            </div>
                            <div className={cashierStyles.modalActions}>
                                <button type="button" className={cashierStyles.buttonSecondary} onClick={closePaymentModal}>Cancel</button>
                                <button type="button" className={cashierStyles.buttonSecondary} disabled={isSubmitting} onClick={() => void settleOrders(false)}>
                                    <CreditCard size={15} />
                                    {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                                </button>
                                <button type="button" className={cashierStyles.buttonPrimary} disabled={isSubmitting} onClick={() => void settleOrders(true)}>
                                    <CreditCard size={15} />
                                    {isSubmitting ? 'Processing...' : 'Confirm & Print Receipt'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
