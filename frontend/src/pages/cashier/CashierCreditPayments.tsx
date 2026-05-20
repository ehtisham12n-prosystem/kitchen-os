/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckSquare, ClipboardList, CreditCard, Download, History, Printer, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { customerApi, posApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { OrderAuditModal } from '../pos/OrderAuditModal';
import { buildCreditPaymentReceivedPrintDocument } from '../pos/printTemplates/kotPrintTemplate';
import { openPrintDocumentCopies, resolvePrintTemplateSettings } from '../pos/printTemplates/printHelpers';
import {
    buildSettlementPayments,
    emptyCashierOrderFilters,
    formatDateTime,
    formatMoney,
    getLastPaymentDate,
    getOrderAgeDays,
    getOutstandingAmount,
    getPaidAmount,
    isCreditEligibleOrder,
    matchesCashierOrderFilters,
    normalizePaymentStatus,
    paymentStatusLabel,
    type CashierOrder,
    type CashierOrderItem,
    type CashierOrderFilters,
} from './cashierUtils';
import { exportCashierRows, type CashierExportFormat } from './cashierExport';
import { canPrintCashierReceipt, printCashierPaymentReceipt } from './cashierPaymentReceipt';
import { printCashierCreditReport, type CashierCreditPrintMode } from './cashierCreditPrint';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, formatConfiguredReceiptNumber } from '../pos/printTemplates/printHelpers';
import styles from './CashierShared.module.css';

type PaymentMode = 'cash' | 'card' | 'bank' | 'digital_wallet' | 'other';
type SettledInvoice = {
    invoice_no?: number | string | null;
    order_no: number | string;
    order_date?: string | null;
    order_taker?: string | null;
    paid: string;
};

function paymentBadgeClass(status?: string | null): string {
    const normalized = normalizePaymentStatus(status);
    if (normalized === 'paid') return `${styles.statusBadge} ${styles.statusPaid}`;
    if (normalized === 'partial') return `${styles.statusBadge} ${styles.statusPartial}`;
    if (normalized === 'unpaid') return `${styles.statusBadge} ${styles.statusUnpaid}`;
    return `${styles.statusBadge} ${styles.statusOther}`;
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

function getItemNote(item: CashierOrderItem): string {
    return String(item.item_notes || item.notes || '').trim();
}

function getItemLineTotal(item: CashierOrderItem): number {
    return Number(item.item_price || 0) * Number(item.quantity || 0);
}

function resolveFocusedCustomerPriority(customer: any, overdueOutstanding: number, totalOutstanding: number): 'critical' | 'high' | 'normal' {
    const status = String(customer?.status || 'active').toLowerCase();
    const allowCredit = Boolean(customer?.allow_credit);
    const creditLimit = Number(customer?.credit_limit || 0);
    const controlMode = String(customer?.credit_control_mode || 'block').toLowerCase();
    if (status === 'inactive' || status === 'suspended') return 'critical';
    if (!allowCredit && totalOutstanding > 0.009) return 'critical';
    if (creditLimit > 0 && totalOutstanding - creditLimit > 0.009) return 'high';
    if (controlMode === 'warn' || overdueOutstanding > 0.009) return 'high';
    return 'normal';
}

function resolveFocusedCustomerAction(customer: any, overdueOutstanding: number, totalOutstanding: number): string {
    const status = String(customer?.status || 'active').toLowerCase();
    const allowCredit = Boolean(customer?.allow_credit);
    const creditLimit = Number(customer?.credit_limit || 0);
    const controlMode = String(customer?.credit_control_mode || 'block').toLowerCase();
    if (status === 'inactive' || status === 'suspended') return 'Resolve customer status before carrying more credit.';
    if (!allowCredit && totalOutstanding > 0.009) return 'Customer has open balance without an approved credit policy.';
    if (creditLimit > 0 && totalOutstanding - creditLimit > 0.009) {
        return controlMode === 'warn'
            ? 'Credit is warn-only and already over limit. Collect before allowing further exposure.'
            : 'Customer is over credit limit. Collect before allowing further exposure.';
    }
    if (overdueOutstanding > 0.009) return 'Overdue credit should be followed up now.';
    return 'Routine collection follow-up only.';
}

export function CashierCreditPayments() {
    const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const { activeBranch } = useBranchContext();
    const { canReadPos, canUseCashierConsole, canSettleCreditPayments, canPrintPosReceipts, hasPermission } = usePermissionAccess();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const [searchParams] = useSearchParams();
    const focusedCustomerId = Number(searchParams.get('customer_id') || 0);
    const canReviewLedger = canReadPos || canUseCashierConsole || hasPermission(APP_PERMISSIONS.POS.CREDIT_ORDERS);
    const canReceivePayments = canSettleCreditPayments;
    const canPrintCashierReports = canPrintPosReceipts;

    const [orders, setOrders] = useState<CashierOrder[]>([]);
    const [filters, setFilters] = useState<CashierOrderFilters>(() => ({
        ...emptyCashierOrderFilters,
        paymentStatus: 'credited',
        customer: searchParams.get('customer') || '',
        orderNumber: searchParams.get('order') || '',
    }));
    const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [detailOrder, setDetailOrder] = useState<CashierOrder | null>(null);
    const [paymentTargetOrders, setPaymentTargetOrders] = useState<CashierOrder[]>([]);
    const [paymentHistoryOrder, setPaymentHistoryOrder] = useState<CashierOrder | null>(null);
    const [orderHistoryOrder, setOrderHistoryOrder] = useState<CashierOrder | null>(null);
    const [activeCounterSession, setActiveCounterSession] = useState<any | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentComments, setPaymentComments] = useState('');
    const [focusedCustomer, setFocusedCustomer] = useState<any | null>(null);
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpNote, setFollowUpNote] = useState('');
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
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
    const printSettings = useMemo(
        () => resolvePrintTemplateSettings({ branch_name: branchLabel }, branchLabel),
        [branchLabel],
    );

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
            toast.error('Ledger Unavailable', error?.message || 'Could not load credited orders.');
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        const loadCounterSession = async () => {
            if (!branchId) {
                setActiveCounterSession(null);
                return;
            }
            try {
                const session = await posApi.getMyCounterSession(branchId);
                setActiveCounterSession(session);
            } catch {
                setActiveCounterSession(null);
            }
        };

        void loadCounterSession();
    }, [branchId]);

    useEffect(() => {
        const loadFocusedCustomer = async () => {
            if (!focusedCustomerId) {
                setFocusedCustomer(null);
                return;
            }
            try {
                const detail = await customerApi.getCustomer(focusedCustomerId);
                setFocusedCustomer(detail);
            } catch {
                setFocusedCustomer(null);
            }
        };

        void loadFocusedCustomer();
    }, [focusedCustomerId]);

    useEffect(() => {
        setFollowUpDate(focusedCustomer?.collection_follow_up_date ?? '');
        setFollowUpNote(focusedCustomer?.collection_follow_up_note ?? '');
    }, [focusedCustomer?.collection_follow_up_date, focusedCustomer?.collection_follow_up_note, focusedCustomer?.id]);

    const saveFocusedCustomerFollowUp = async () => {
        if (!focusedCustomer?.id) {
            return;
        }
        setIsSavingFollowUp(true);
        try {
            await customerApi.updateCustomer(focusedCustomer.id, {
                collection_follow_up_date: followUpDate || undefined,
                collection_follow_up_note: followUpNote.trim() || undefined,
            });
            setFocusedCustomer((current: any) => current ? ({
                ...current,
                collection_follow_up_date: followUpDate || null,
                collection_follow_up_note: followUpNote.trim() || null,
            }) : current);
            toast.success('Collection Follow-Up Saved', `${focusedCustomer.name || 'Customer'} follow-up has been updated.`);
        } catch (error: any) {
            toast.error('Follow-Up Save Failed', error?.message || 'Could not update customer follow-up.');
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    const filteredOrders = useMemo(
        () => orders
            .filter((order) => isCreditEligibleOrder(order))
            .filter((order) => !focusedCustomerId || Number(order.customer_id || 0) === focusedCustomerId)
            .filter((order) => matchesCashierOrderFilters(order, filters)),
        [orders, filters, focusedCustomerId],
    );

    const overdueFilteredOrders = useMemo(
        () => filteredOrders.filter((order) => getOrderAgeDays(order) > 0),
        [filteredOrders],
    );

    const overdueFilteredOutstanding = useMemo(
        () => overdueFilteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0),
        [overdueFilteredOrders],
    );

    const focusedCustomerOutstanding = useMemo(
        () => focusedCustomerId
            ? filteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0)
            : 0,
        [filteredOrders, focusedCustomerId],
    );

    const focusedCustomerOverdueOutstanding = useMemo(
        () => focusedCustomerId
            ? overdueFilteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0)
            : 0,
        [focusedCustomerId, overdueFilteredOrders],
    );

    const focusedCustomerPriority = useMemo(
        () => focusedCustomer
            ? resolveFocusedCustomerPriority(focusedCustomer, focusedCustomerOverdueOutstanding, focusedCustomerOutstanding)
            : 'normal',
        [focusedCustomer, focusedCustomerOutstanding, focusedCustomerOverdueOutstanding],
    );

    const focusedCustomerAction = useMemo(
        () => focusedCustomer
            ? resolveFocusedCustomerAction(focusedCustomer, focusedCustomerOverdueOutstanding, focusedCustomerOutstanding)
            : '',
        [focusedCustomer, focusedCustomerOutstanding, focusedCustomerOverdueOutstanding],
    );

    const creditedOrders = useMemo(
        () => orders.filter((order) => isCreditEligibleOrder(order)),
        [orders],
    );

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const pagedOrders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrders.slice(start, start + pageSize);
    }, [currentPage, filteredOrders, pageSize]);

    const selectedOrders = useMemo(
        () => filteredOrders.filter((order) => selectedOrderIds.includes(order.id)),
        [filteredOrders, selectedOrderIds],
    );

    const selectedOutstanding = useMemo(
        () => selectedOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0),
        [selectedOrders],
    );

    const filteredOutstanding = useMemo(
        () => filteredOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0),
        [filteredOrders],
    );

    const topCustomerExposure = useMemo(() => {
        const customerMap = new Map<string, { label: string; orders: number; amount: number }>();
        filteredOrders.forEach((order) => {
            const label = String(order.customer_name || 'Walk-in customer').trim() || 'Walk-in customer';
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

    const customerFilterOptions = useMemo(
        () => Array.from(new Set(
            creditedOrders
                .map((order) => String(order.customer_name || 'Walk-in customer').trim() || 'Walk-in customer'),
        )).sort((left, right) => left.localeCompare(right)),
        [creditedOrders],
    );

    const orderTakerFilterOptions = useMemo(
        () => Array.from(new Set(
            creditedOrders
                .map((order) => String(order.order_taker_name || 'Staff').trim() || 'Staff'),
        )).sort((left, right) => left.localeCompare(right)),
        [creditedOrders],
    );

    const exportRows = useMemo(
        () => filteredOrders.map((order) => ({
            'Order ID': order.id,
            'Order Number': formatVisibleOrderNumber(order),
            Customer: order.customer_name || 'Walk-in customer',
            'Customer Phone': order.customer_phone || '-',
            'Sale Counter': order.sale_counter_code || order.sale_counter_name || '-',
            'Order Taker': order.order_taker_name || 'Staff',
            'Order Type': String(order.order_type || 'dine_in').replace(/_/g, ' '),
            'Order Date': formatDateTime(order.created_at),
            'Total Amount': Number(order.total_amount || 0),
            'Paid So Far': getPaidAmount(order),
            Outstanding: getOutstandingAmount(order),
            'Last Payment Date': formatDateTime(getLastPaymentDate(order)),
            'Payment Status': getLedgerDisplayStatusLabel(order),
            Receipt: formatVisibleReceiptNumber(order),
            Reference: (order.payments ?? [])
                .filter((payment) => !payment.is_refund)
                .map((payment) => payment.reference_number)
                .filter(Boolean)
                .join(', ') || '-',
            'Payment Modes': (order.payments ?? [])
                .filter((payment) => !payment.is_refund)
                .map((payment) => String(payment.payment_mode || '').replace(/_/g, ' '))
                .filter(Boolean)
                .join(', ') || '-',
            Comments: order.order_note || '-',
        })),
        [filteredOrders],
    );

    const handleExport = (format: CashierExportFormat) => {
        exportCashierRows(
            `cashier-credit-payments-${branchId || 'branch'}-${new Date().toISOString().slice(0, 10)}`,
            format,
            exportRows,
        );
    };

    const handlePrint = (mode: CashierCreditPrintMode) => {
        if (!canPrintCashierReports) {
            toast.error('Print Restricted', 'Your current branch role cannot print cashier credit reports.');
            return;
        }
        printCashierCreditReport(mode, activeBranch?.branch_name || 'Active Branch', filteredOrders);
    };

    const printSettlementReceipt = (
        settledOrders: CashierOrder[],
        settledInvoices: SettledInvoice[],
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
        const accountLabel = customerNames.length === 1
            ? 'Customer'
            : orderTakers.length === 1
                ? 'Order Taker'
                : 'Selection';
        const accountValue = customerNames.length === 1
            ? customerNames[0]
            : orderTakers.length === 1
                ? orderTakers[0]
                : `${settledOrders.length} selected orders`;
        const primaryPhone = settledOrders
            .map((order) => String(order.customer_phone || '').trim())
            .find(Boolean);
        const counterLabel = activeCounterSession?.sale_counter?.code
            || activeCounterSession?.sale_counter?.name
            || activeCounterSession?.sale_counter_name
            || activeCounterSession?.counter_name
            || '-';
        const paymentDate = new Date();
        const documentMarkup = buildCreditPaymentReceivedPrintDocument({
            settings: printSettings,
            format: printSettings.receipt_paper_size || 'thermal-80mm',
            data: {
                customer: accountValue,
                account_label: accountLabel,
                customer_phone: primaryPhone || undefined,
                invoices: settledInvoices,
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

        if (!openPrintDocumentCopies(
            () => documentMarkup,
            printSettings.receipt_print_copies || 1,
            `Credit Payment ${accountValue}`,
        )) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print receipts.');
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, branchId, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const toggleOrder = (orderId: number) => {
        setSelectedOrderIds((current) =>
            current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
        );
    };

    const selectAllFiltered = () => {
        setSelectedOrderIds(filteredOrders.map((order) => order.id));
    };

    const clearSelection = () => {
        setSelectedOrderIds([]);
    };

    const openPaymentModal = (targetOrders: CashierOrder[]) => {
        if (!canReceivePayments) {
            toast.error('Access Restricted', 'Your role does not allow credit settlement from the cashier ledger.');
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
        setPaymentAmount('');
        setPaymentComments('');
        setReferenceNumber('');
    };

    const closePaymentModal = () => {
        setPaymentTargetOrders([]);
        setPaymentAmount('');
        setPaymentComments('');
    };

    const settleOrders = async (printReceipt = false) => {
        if (paymentTargetOrders.length === 0) {
            toast.error('Nothing Selected', 'Choose one or more credited orders first.');
            return;
        }

        const parsedAmount = Math.round(Number(paymentAmount || 0) * 100) / 100;
        const totalOutstanding = paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Invalid Amount', 'Enter a valid payment amount.');
            return;
        }
        if (parsedAmount - totalOutstanding > 0.01) {
            toast.error('Amount Too High', `Payment amount cannot exceed ${formatMoney(totalOutstanding)}.`);
            return;
        }

        setIsSubmitting(true);
        let successCount = 0;
        let remainingAmount = parsedAmount;
        const previousBalance = totalOutstanding;
        const settledInvoices: SettledInvoice[] = [];
        const settledOrders: CashierOrder[] = [];

        try {
            for (const order of paymentTargetOrders) {
                const outstandingAmount = getOutstandingAmount(order);
                const appliedAmount = Math.min(outstandingAmount, remainingAmount);
                if (outstandingAmount <= 0.009 || appliedAmount <= 0.009) continue;

                await posApi.settleCreditOrder(order.id, {
                    payments: buildSettlementPayments(appliedAmount, paymentMode, referenceNumber, paymentComments),
                    reference_number: referenceNumber.trim() || undefined,
                    payment_note: paymentComments.trim() || `Cashier settlement for outstanding credit balance of ${appliedAmount.toFixed(2)}`,
                    branch_id: branchId,
                });

                successCount += 1;
                settledInvoices.push({
                    invoice_no: formatVisibleReceiptNumber(order),
                    order_no: formatVisibleOrderNumber(order),
                    order_date: order.created_at || null,
                    order_taker: order.order_taker_name || order.order_taker_username || 'Staff',
                    paid: formatMoney(appliedAmount),
                });
                settledOrders.push(order);
                remainingAmount = Math.max(remainingAmount - appliedAmount, 0);
                if (remainingAmount <= 0.009) break;
            }

            toast.success('Payments Recorded', `${successCount} credited order(s) settled successfully.`);
            if (printReceipt && settledInvoices.length > 0) {
                printSettlementReceipt(
                    settledOrders,
                    settledInvoices,
                    parsedAmount - remainingAmount,
                    previousBalance,
                    Math.max(previousBalance - (parsedAmount - remainingAmount), 0),
                );
            }
            clearSelection();
            closePaymentModal();
            await loadOrders();
        } catch (error: any) {
            toast.error('Settlement Failed', error?.message || 'One or more orders could not be settled.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canReviewLedger && !canReceivePayments) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>Credit ledger access is not available for your current branch role.</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><Wallet size={14} /> Cashier</span>
                    <h1 className={styles.heroTitle}>Credit Order Payments</h1>
                    <p className={styles.heroDescription}>
                        Settle unpaid, credit, and partially paid orders across open or closed sales counters.
                        Existing partial payments are preserved and only the outstanding balance is added.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate(`${consoleBase}/cashier/orders`)}>
                        <Search size={16} />
                        Order Search
                    </button>
                    <button type="button" className={styles.buttonSecondary} onClick={() => void loadOrders()}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </section>

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Credited Orders</span>
                    <strong className={styles.summaryValue}>{filteredOrders.length}</strong>
                    <span className={styles.summarySub}>Outstanding orders across all counters</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Outstanding Balance</span>
                    <strong className={styles.summaryValue}>{formatMoney(filteredOutstanding)}</strong>
                    <span className={styles.summarySub}>Total still collectible</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Overdue Credit</span>
                    <strong className={styles.summaryValue}>{overdueFilteredOrders.length}</strong>
                    <span className={styles.summarySub}>{formatMoney(overdueFilteredOutstanding)} older than today</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Selected Orders</span>
                    <strong className={styles.summaryValue}>{selectedOrders.length}</strong>
                    <span className={styles.summarySub}>{formatMoney(selectedOutstanding)} selected for payment</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Branch</span>
                    <strong className={styles.summaryValue}>{activeBranch?.branch_name || '-'}</strong>
                    <span className={styles.summarySub}>Active cashier branch context</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Customer Exposure</span>
                    <strong className={styles.summaryValue}>{topCustomerExposure?.label || '-'}</strong>
                    <span className={styles.summarySub}>
                        {topCustomerExposure ? `${topCustomerExposure.orders} order(s) • ${formatMoney(topCustomerExposure.amount)}` : 'No pending customer credit'}
                    </span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Server / Cashier Exposure</span>
                    <strong className={styles.summaryValue}>{topOrderTakerExposure?.label || '-'}</strong>
                    <span className={styles.summarySub}>
                        {topOrderTakerExposure ? `${topOrderTakerExposure.orders} order(s) • ${formatMoney(topOrderTakerExposure.amount)}` : 'No pending staff credit'}
                    </span>
                </article>
            </section>

            {focusedCustomer ? (
                <section className={focusedCustomer.credit_control_mode === 'warn' ? styles.bannerWarning : styles.bannerDanger}>
                    <Wallet size={16} />
                    <div className={styles.promiseBannerBody}>
                        <strong>{focusedCustomer.name}</strong>
                        <div className={styles.inlineHint}>
                            {focusedCustomer.allow_credit
                                ? `Credit ${focusedCustomer.credit_control_mode === 'warn' ? 'warn-only' : 'blocked'} at limit • limit ${formatMoney(Number(focusedCustomer.credit_limit || 0))}`
                                : 'Credit disabled'}
                            {focusedCustomer.collection_follow_up_date ? ` • follow up ${focusedCustomer.collection_follow_up_date}` : ''}
                        </div>
                        {focusedCustomer.collection_follow_up_note ? (
                            <div className={styles.inlineHint}>{focusedCustomer.collection_follow_up_note}</div>
                        ) : null}
                        <div className={styles.inlineHint}>
                            Priority {focusedCustomerPriority} • {focusedCustomerAction}
                        </div>
                        <div className={styles.promiseCompactGrid}>
                            <div className={styles.field}>
                                <label>Next Follow-Up</label>
                                <input
                                    type="date"
                                    value={followUpDate}
                                    onChange={(event) => setFollowUpDate(event.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Promise Note</label>
                                <input
                                    value={followUpNote}
                                    onChange={(event) => setFollowUpNote(event.target.value)}
                                    placeholder="Customer promised payment timing"
                                />
                            </div>
                            <button
                                type="button"
                                className={styles.buttonSecondary}
                                disabled={isSavingFollowUp}
                                onClick={saveFocusedCustomerFollowUp}
                            >
                                {isSavingFollowUp ? 'Saving...' : 'Save Follow-Up'}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Filters & Payment Controls</h2>
                        <p className={styles.panelSubtext}>Use filters to target the exact credited orders you want to settle.</p>
                    </div>
                </div>

                <div className={styles.filterGrid}>
                    <div className={styles.field}>
                        <label>Customer</label>
                        <input
                            list="cashier-credit-customer-options"
                            value={filters.customer}
                            onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))}
                            placeholder="Name or phone"
                        />
                        <datalist id="cashier-credit-customer-options">
                            {customerFilterOptions.map((customer) => (
                                <option key={customer} value={customer} />
                            ))}
                        </datalist>
                    </div>
                    <div className={styles.field}>
                        <label>Order Taker</label>
                        <input
                            list="cashier-credit-order-taker-options"
                            value={filters.orderTaker}
                            onChange={(event) => setFilters((current) => ({ ...current, orderTaker: event.target.value }))}
                            placeholder="Staff name"
                        />
                        <datalist id="cashier-credit-order-taker-options">
                            {orderTakerFilterOptions.map((taker) => (
                                <option key={taker} value={taker} />
                            ))}
                        </datalist>
                    </div>
                    <div className={styles.field}>
                        <label>Escalation</label>
                        <select value={filters.escalation} onChange={(event) => setFilters((current) => ({ ...current, escalation: event.target.value as CashierOrderFilters['escalation'] }))}>
                            <option value="">All credit orders</option>
                            <option value="overdue">Overdue only</option>
                            <option value="fresh">Today only</option>
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
                        <label>Order Type</label>
                        <select value={filters.orderType} onChange={(event) => setFilters((current) => ({ ...current, orderType: event.target.value as CashierOrderFilters['orderType'] }))}>
                            <option value="">All Types</option>
                            <option value="dine_in">Dine In</option>
                            <option value="takeout">Takeout</option>
                            <option value="delivery">Delivery</option>
                        </select>
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
                <div className={styles.selectionBar}>
                    <div className={styles.selectionText}>
                        <strong>{selectedOrders.length} order(s) selected</strong>
                        <span className={styles.muted}>Selected balance: {formatMoney(selectedOutstanding)}</span>
                    </div>
                    <div className={styles.inlineActions}>
                        <label className={styles.exportControl}>
                            <Printer size={14} />
                            <select
                                disabled={!canPrintCashierReports}
                                defaultValue=""
                                onChange={(event) => {
                                    const mode = event.target.value as CashierCreditPrintMode;
                                    if (!mode) return;
                                    handlePrint(mode);
                                    event.target.value = '';
                                }}
                            >
                                <option value="">Print Report</option>
                                <option value="customer">Customer-Wise</option>
                                <option value="order_taker">Order Taker-Wise</option>
                                <option value="all">All Credited</option>
                            </select>
                        </label>
                        <button type="button" className={styles.buttonSecondary} onClick={selectAllFiltered}>
                            <CheckSquare size={15} />
                            Select All Filtered
                        </button>
                        <button type="button" className={styles.buttonSecondary} onClick={clearSelection}>
                            Clear Selection
                        </button>
                        <button type="button" className={styles.buttonPrimary} disabled={!canReceivePayments || isSubmitting || selectedOrders.length === 0} onClick={() => openPaymentModal(selectedOrders)}>
                            <CreditCard size={15} />
                            Receive Payment
                        </button>
                        <button type="button" className={styles.buttonPrimary} disabled={!canReceivePayments || isSubmitting || filteredOrders.length === 0} onClick={() => openPaymentModal(filteredOrders)}>
                            <Wallet size={15} />
                            Receive All Filtered
                        </button>
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
                    <div className={styles.emptyState}>Loading credited orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className={styles.emptyState}>No credited orders match the current filters.</div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
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
                                {pagedOrders.map((order) => {
                                    const outstanding = getOutstandingAmount(order);
                                    const paid = Number(order.total_amount || 0) - outstanding;
                                    const isSelected = selectedOrderIds.includes(order.id);
                                    const displayStatus = getLedgerDisplayStatus(order);

                                    return (
                                        <tr key={order.id}>
                                            <td>
                                                <input className={styles.selectionCheckbox} type="checkbox" disabled={!canReceivePayments} checked={isSelected} onChange={() => toggleOrder(order.id)} />
                                            </td>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong>{formatVisibleOrderNumber(order)}</strong>
                                                    <span className={styles.muted}>{String(order.order_type || 'dine_in').replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong>{order.customer_name || 'Walk-in customer'}</strong>
                                                    <span className={styles.muted}>{order.customer_phone || '-'}</span>
                                                </div>
                                            </td>
                                            <td>{order.sale_counter_code || order.sale_counter_name || '-'}</td>
                                            <td>{order.order_taker_name || 'Staff'}</td>
                                            <td>{formatDateTime(order.created_at)}</td>
                                            <td><strong>{formatMoney(order.total_amount)}</strong></td>
                                            <td><strong className={styles.amountPositive}>{formatMoney(paid)}</strong></td>
                                            <td>
                                                <div className={styles.stack}>
                                                    <strong className={styles.amountWarning}>{formatMoney(outstanding)}</strong>
                                                    <span className={styles.muted}>{getOrderAgeDays(order) > 0 ? `${getOrderAgeDays(order)} day(s) old` : 'Today'}</span>
                                                </div>
                                            </td>
                                            <td>{formatDateTime(getLastPaymentDate(order))}</td>
                                            <td><span className={paymentBadgeClass(displayStatus)}>{getLedgerDisplayStatusLabel(order)}</span></td>
                                            <td>
                                                <div className={styles.actionStack}>
                                                    <button type="button" className={styles.iconAction} title="Receive Payment" aria-label="Receive Payment" disabled={!canReceivePayments || isSubmitting} onClick={() => openPaymentModal([order])}>
                                                        <Wallet size={14} />
                                                    </button>
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
                                                    {canReviewLedger ? (
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
                        <span className={styles.resultMeta}>Paged results keep the cashier ledger compact.</span>
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
                                <div className={styles.detailSummaryCell}><span>Payment Status</span><strong>{getLedgerDisplayStatusLabel(detailOrder)}</strong></div>
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
            {paymentTargetOrders.length > 0 && (
                <div className={styles.modalOverlay} onClick={closePaymentModal}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Receive Payment</h2>
                                <p>{paymentTargetOrders.length} order(s) selected • Outstanding {formatMoney(paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0))}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={closePaymentModal}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSectionTitle}>Counter Context</p>
                            <div className={styles.detailSummaryGrid}>
                                <div className={styles.detailSummaryCell}><span>Cashier</span><strong>{activeCounterSession?.user?.user_name || activeCounterSession?.user?.full_name || 'Current cashier'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Counter</span><strong>{activeCounterSession?.sale_counter?.name || activeCounterSession?.sale_counter?.code || '-'}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Counter Status</span><strong>{String(activeCounterSession?.terminal_status || 'inactive').replace('_', ' ')}</strong></div>
                                <div className={styles.detailSummaryCell}><span>Receive Amount</span><strong>{formatMoney(paymentAmount || 0)}</strong></div>
                            </div>
                            <p className={styles.modalSectionTitle}>Orders To Settle</p>
                            <div className={styles.detailTableWrap}>
                                <table className={styles.detailTable}>
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
                            <p className={styles.modalSectionTitle}>Payment Entry</p>
                            <div className={styles.filterGrid}>
                                <div className={styles.field}>
                                    <label>Payment Method</label>
                                    <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}>
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="bank">Bank Transfer</option>
                                        <option value="digital_wallet">Digital Wallet</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label>Amount Taken</label>
                                    <input
                                        className={styles.strongInput}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={paymentAmount}
                                        onChange={(event) => setPaymentAmount(event.target.value)}
                                        placeholder={paymentTargetOrders.length > 0 ? `${paymentTargetOrders.reduce((sum, order) => sum + getOutstandingAmount(order), 0).toFixed(2)}` : '0.00'}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Reference Number</label>
                                    <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional reference" />
                                </div>
                                <div className={`${styles.field} ${styles.fieldSpan2}`}>
                                    <label>Comments</label>
                                    <textarea value={paymentComments} onChange={(event) => setPaymentComments(event.target.value)} placeholder="Payment comments" />
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={closePaymentModal}>Cancel</button>
                                <button type="button" className={styles.buttonSecondary} disabled={isSubmitting} onClick={() => void settleOrders(false)}>
                                    <CreditCard size={15} />
                                    {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                                </button>
                                <button type="button" className={styles.buttonPrimary} disabled={isSubmitting} onClick={() => void settleOrders(true)}>
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

export default CashierCreditPayments;
