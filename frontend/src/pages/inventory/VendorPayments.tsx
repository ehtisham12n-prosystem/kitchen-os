import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Clock,
    CreditCard,
    DollarSign,
    Download,
    Eye,
    FileText,
    LayoutGrid,
    List,
    Plus,
    Search,
    Store,
    Wallet,
} from 'lucide-react';
import { accountingApi, branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredExpenseVoucherNumber, formatConfiguredGrnNumber, formatConfiguredPaymentVoucherNumber } from '../pos/printTemplates/printHelpers';
import styles from './VendorPayments.module.css';

type PaymentStatus = 'paid' | 'pending' | 'partial' | 'overdue';
type ViewMode = 'line' | 'grid';

type PaymentRow = {
    id: string;
    payableId: number;
    payableType: 'grn' | 'expense_voucher';
    vendorId: string | null;
    vendorName: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    amountPaid: number;
    balance: number;
    branch: string;
    branchId: number;
    status: PaymentStatus;
    reference?: string | null;
    daysPastDue: number;
};

type PayableDetail = {
    document: {
        payable_type: 'grn' | 'expense_voucher';
        id: number;
        branch_name: string;
        document_no: string;
        vendor_name: string;
        bill_reference: string | null;
        document_date: string;
        due_date: string;
        total_amount: number;
        paid_amount: number;
        outstanding_amount: number;
        days_past_due: number;
        credited_amount?: number;
    };
    allocations: Array<{
        id: number;
        allocated_amount: number;
        allocation_date: string;
        notes: string | null;
        voucher_id: number;
        voucher_no: string;
        voucher_status: string;
        payment_method: string | null;
        payment_source_label: string | null;
        treasury_account_id: number | null;
        treasury_account_code: string | null;
        treasury_account_name: string | null;
        reference_no: string | null;
        voucher_date: string;
    }>;
    credit_notes?: Array<{
        id: number;
        voucher_no: string;
        voucher_date: string;
        reference_no: string | null;
        description: string | null;
        status: string;
        amount: number;
    }>;
};

const STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
    paid: { label: 'Paid', className: styles.statusPaid },
    pending: { label: 'Pending', className: styles.statusPending },
    partial: { label: 'Partial', className: styles.statusPartial },
    overdue: { label: 'Overdue', className: styles.statusOverdue },
};

function formatPKR(n: number) {
    return `PKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
    return (
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, width: '100%' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
    );
}

function PaymentModal({
    payment,
    detail,
    loading,
    onClose,
    formatVisiblePayableDocumentNumber,
    formatVisiblePaymentVoucherNumber,
    formatVisibleCreditVoucherNumber,
}: {
    payment: PaymentRow | null;
    detail: PayableDetail | null;
    loading: boolean;
    onClose: () => void;
    formatVisiblePayableDocumentNumber: (doc: { payableType?: string; payable_type?: string; invoiceNo?: string; document_no?: string; id?: string | number }) => string;
    formatVisiblePaymentVoucherNumber: (value: string, source?: any) => string;
    formatVisibleCreditVoucherNumber: (value: string, source?: any) => string;
}) {
    if (!payment) return null;
    const cfg = STATUS_CONFIG[payment.status];
    const document = detail?.document;
    const allocations = detail?.allocations || [];
    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3>Vendor Payable Detail</h3>
                        <p className={styles.modalSubtext}>Live balance, overdue state, and voucher-linked settlement history.</p>
                    </div>
                    <button className={styles.modalClose} onClick={onClose}>x</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.modalRow}><span>Document No</span><strong>{formatVisiblePayableDocumentNumber(payment)}</strong></div>
                    <div className={styles.modalRow}><span>Vendor</span><strong>{payment.vendorName}</strong></div>
                    <div className={styles.modalRow}><span>Branch</span><strong>{payment.branch}</strong></div>
                    <div className={styles.modalRow}><span>Invoice Date</span><strong>{payment.invoiceDate}</strong></div>
                    <div className={styles.modalRow}><span>Due Date</span><strong>{payment.dueDate}</strong></div>
                    <div className={styles.modalRow}><span>Invoice Amount</span><strong>{formatPKR(payment.amount)}</strong></div>
                    <div className={styles.modalRow}><span>Paid</span><strong style={{ color: '#22c55e' }}>{formatPKR(payment.amountPaid)}</strong></div>
                    <div className={styles.modalRow}><span>Balance</span><strong style={{ color: payment.balance > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{formatPKR(payment.balance)}</strong></div>
                    <div className={styles.modalRow}>
                        <span>Status</span>
                        <span className={`${styles.statusBadge} ${cfg.className}`}>{cfg.label}</span>
                    </div>
                    {payment.reference && <div className={styles.modalRow}><span>Reference</span><strong>{payment.reference}</strong></div>}

                    {loading ? (
                        <div className={styles.allocationEmpty}>Loading allocation history...</div>
                    ) : document ? (
                        <>
                            <div className={styles.allocationSummary}>
                                <div className={styles.allocationCard}>
                                    <span>Days Past Due</span>
                                    <strong style={{ color: document.days_past_due > 0 ? 'var(--accent-danger)' : '#22c55e' }}>
                                        {document.days_past_due > 0 ? `${document.days_past_due}d overdue` : 'Current'}
                                    </strong>
                                </div>
                                <div className={styles.allocationCard}>
                                    <span>Reference</span>
                                    <strong>{document.bill_reference || 'Not provided'}</strong>
                                </div>
                            </div>
                            <div className={styles.allocationSection}>
                                {(detail?.credit_notes || []).length > 0 && (
                                    <>
                                        <div className={styles.allocationHeader}>
                                            <strong>Credit Notes</strong>
                                            <span>{detail?.credit_notes?.length || 0} linked adjustments</span>
                                        </div>
                                        <div className={styles.allocationList}>
                                            {(detail?.credit_notes || []).map((credit) => (
                                                <div key={credit.id} className={styles.allocationRow}>
                                                    <div>
                                                        <strong>{formatVisibleCreditVoucherNumber(credit.voucher_no, credit)}</strong>
                                                        <small>
                                                            {credit.voucher_date}
                                                {credit.reference_no ? ` / Ref ${credit.reference_no}` : ''}
                                                {credit.description ? ` / ${credit.description}` : ''}
                                                        </small>
                                                    </div>
                                                    <div className={styles.allocationMeta}>
                                                        <span className={styles.methodBadge}>{credit.status}</span>
                                                        <strong>{formatPKR(credit.amount)}</strong>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <div className={styles.allocationHeader}>
                                    <strong>Settlement History</strong>
                                    <span>{allocations.length} voucher allocations</span>
                                </div>
                                {allocations.length === 0 ? (
                                    <div className={styles.allocationEmpty}>No payment allocations posted against this bill yet.</div>
                                ) : (
                                    <div className={styles.allocationList}>
                                        {allocations.map((allocation) => (
                                            <div key={allocation.id} className={styles.allocationRow}>
                                                <div>
                                                    <strong>{formatVisiblePaymentVoucherNumber(allocation.voucher_no, allocation)}</strong>
                                                    <small>
                                                        {allocation.voucher_date} • {allocation.payment_method || 'Method not set'}
                                                        {allocation.treasury_account_code ? ` • ${allocation.treasury_account_code}` : ''}
                                                        {allocation.treasury_account_name ? ` ${allocation.treasury_account_name}` : ''}
                                                        {allocation.reference_no ? ` • Ref ${allocation.reference_no}` : ''}
                                                    </small>
                                                </div>
                                                <div className={styles.allocationMeta}>
                                                    <span className={styles.methodBadge}>{allocation.voucher_status}</span>
                                                    <strong>{formatPKR(allocation.allocated_amount)}</strong>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={styles.allocationEmpty}>Allocation detail is not available for this payable.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function VendorPayments() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const {
        canViewVendorPayments,
        canManageVendorPayments,
        canApproveVendorPayments,
    } = usePermissionAccess();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [viewMode, setViewMode] = useState<ViewMode>('line');
    const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<PayableDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [rows, setRows] = useState<PaymentRow[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalPayable: 0,
        totalPaidThisMonth: 0,
        overdue: 0,
        pendingApproval: 0,
    });
    const formatVisiblePayableDocumentNumber = (doc: { payableType?: string; payable_type?: string; invoiceNo?: string; document_no?: string; id?: string | number }) => {
        const raw = doc.invoiceNo || doc.document_no || '';
        const type = doc.payableType || doc.payable_type;
        if (type === 'expense_voucher') {
            return formatConfiguredExpenseVoucherNumber(raw, activeBranch || doc, { preserveTypePrefix: true }) || raw;
        }
        return formatConfiguredGrnNumber(raw, activeBranch || doc, { preserveTypePrefix: true }) || raw;
    };
    const formatVisiblePaymentVoucherNumber = (value: string, source?: any) =>
        formatConfiguredPaymentVoucherNumber(value, source || activeBranch, { preserveTypePrefix: true }) || value;
    const formatVisibleCreditVoucherNumber = (value: string, source?: any) =>
        formatConfiguredExpenseVoucherNumber(value, source || activeBranch, { preserveTypePrefix: true }) || value;

    useEffect(() => {
        if (!canViewVendorPayments) {
            return;
        }
        const load = async () => {
            setIsLoading(true);
            try {
                const [payables, vouchers, branchRows] = await Promise.all([
                    accountingApi.getPayablesAging(),
                    accountingApi.getFinancialVouchers({ type: 'PAYMENT' }),
                    branchApi.getBranches(),
                ]);

                const branchMap = new Map((branchRows || []).map((branch: any) => [Number(branch.id), branch.branch_name]));
                const docs = (payables?.documents || []).map((doc: any) => {
                    const dueDate = String(doc.due_date || '').slice(0, 10);
                    const paidAmount = Number(doc.paid_amount || 0);
                    const totalAmount = Number(doc.total_amount || 0);
                    const balance = Number(doc.outstanding_amount || 0);
                    const daysPastDue = Number(doc.days_past_due || 0);
                    let status: PaymentStatus = 'pending';
                    if (balance <= 0.009) status = 'paid';
                    else if (paidAmount > 0.009) status = 'partial';
                    else if (daysPastDue > 0) status = 'overdue';

                    return {
                        id: `payable-${doc.id}`,
                        payableId: Number(doc.id),
                        payableType: (doc.payable_type || 'grn') as 'grn' | 'expense_voucher',
                        vendorId: doc.party_id ? String(doc.party_id) : null,
                        vendorName: doc.party_name || 'Vendor',
                        invoiceNo: formatVisiblePayableDocumentNumber({ payable_type: doc.payable_type, document_no: doc.document_no, id: doc.id }),
                        invoiceDate: String(doc.document_date || '').slice(0, 10),
                        dueDate,
                        amount: totalAmount,
                        amountPaid: paidAmount,
                        balance,
                        branch: branchMap.get(Number(doc.branch_id)) || `Branch ${doc.branch_id}`,
                        branchId: Number(doc.branch_id),
                        status,
                        reference: doc.reference,
                        daysPastDue,
                    } satisfies PaymentRow;
                });

                const paidThisMonth = (vouchers || [])
                    .filter((voucher: any) => String(voucher.status || '').toUpperCase() === 'APPROVED')
                    .reduce((sum: number, voucher: any) => sum + Number(voucher.amount || 0), 0);

                const overdue = docs
                    .filter((doc: PaymentRow) => doc.status === 'overdue')
                    .reduce((sum: number, doc: PaymentRow) => sum + doc.balance, 0);
                const partial = docs
                    .filter((doc: PaymentRow) => doc.status === 'partial' || doc.status === 'pending')
                    .reduce((sum: number, doc: PaymentRow) => sum + doc.balance, 0);

                setBranches(branchRows || []);
                setRows(docs);
                setSummary({
                    totalPayable: docs.reduce((sum: number, doc: PaymentRow) => sum + doc.balance, 0),
                    totalPaidThisMonth: paidThisMonth,
                    overdue,
                    pendingApproval: partial,
                });
            } catch (error: any) {
                console.error(error);
                toast.error('Vendor Payments', error?.message || 'Could not load live vendor payables.');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [canViewVendorPayments]);

    const filtered = useMemo(() => rows.filter((payment) => {
        const searchValue = search.trim().toLowerCase();
        const matchSearch = !searchValue
            || payment.vendorName.toLowerCase().includes(searchValue)
            || payment.invoiceNo.toLowerCase().includes(searchValue)
            || payment.branch.toLowerCase().includes(searchValue)
            || String(payment.reference || '').toLowerCase().includes(searchValue);
        const matchStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchBranch = branchFilter === 'all' || payment.branch === branchFilter;
        return matchSearch && matchStatus && matchBranch;
    }), [branchFilter, rows, search, statusFilter]);

    const totalPaid = filtered.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const totalBalance = filtered.reduce((sum, payment) => sum + payment.balance, 0);
    const overdueCount = filtered.filter((payment) => payment.status === 'overdue').length;
    const averageInvoice = filtered.length ? filtered.reduce((sum, payment) => sum + payment.amount, 0) / filtered.length : 0;
    const branchCoverage = new Set(filtered.map((payment) => payment.branch)).size;
    const topOverdueVendor = useMemo(() => {
        const totals = new Map<string, number>();
        filtered.filter((payment) => payment.status === 'overdue').forEach((payment) => {
            totals.set(payment.vendorName, Number(totals.get(payment.vendorName) || 0) + payment.balance);
        });
        const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? { name: top[0], amount: top[1] } : null;
    }, [filtered]);
    const topOverdueBranch = useMemo(() => {
        const totals = new Map<string, number>();
        filtered.filter((payment) => payment.status === 'overdue').forEach((payment) => {
            totals.set(payment.branch, Number(totals.get(payment.branch) || 0) + payment.balance);
        });
        const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? { name: top[0], amount: top[1] } : null;
    }, [filtered]);

    const openPaymentDetail = async (payment: PaymentRow) => {
        setSelectedPayment(payment);
        setSelectedDetail(null);
        setDetailLoading(true);
        try {
            const detail = await accountingApi.getPayableDocumentDetail(payment.payableType, payment.payableId);
            setSelectedDetail(detail);
        } catch (error: any) {
            toast.error('Vendor Payments', error?.message || 'Could not load payable detail.');
        } finally {
            setDetailLoading(false);
        }
    };

    if (!canViewVendorPayments) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <CreditCard size={32} />
                    <p>Your current role does not include vendor payment access.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/vendors')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.headerIcon}><CreditCard size={20} /></div>
                    <div>
                        <h1 className={styles.pageTitle}>Vendor Payments</h1>
                        <p className={styles.pageSubtitle}>Live payables, approved disbursements, and due exposure by branch.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary} onClick={() => window.print()}><Download size={15} /> Print</button>
                    {canApproveVendorPayments && (
                        <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/vendor-payments/approvals')}>
                            <FileText size={15} /> Approvals
                        </button>
                    )}
                    {canManageVendorPayments && (
                        <button className={styles.btnPrimary} onClick={() => navigate('/console/inventory/vendor-payments/new')}>
                            <Plus size={15} /> New Payment
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.statsRow}>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--accent-secondary)' }}><DollarSign size={20} /></div><div className={styles.statBody}><span className={styles.statLabel}>Total Outstanding</span><span className={styles.statValue} style={{ color: 'var(--accent-secondary)' }}>{formatPKR(summary.totalPayable)}</span><ProgressBar value={summary.totalPaidThisMonth} total={summary.totalPayable + summary.totalPaidThisMonth} color="var(--accent-primary)" /></div></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: '#22c55e' }}><CheckCircle2 size={20} /></div><div className={styles.statBody}><span className={styles.statLabel}>Approved Payments</span><span className={styles.statValue} style={{ color: '#22c55e' }}>{formatPKR(summary.totalPaidThisMonth)}</span></div></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--accent-danger)' }}><AlertTriangle size={20} /></div><div className={styles.statBody}><span className={styles.statLabel}>Overdue Balance</span><span className={styles.statValue} style={{ color: 'var(--accent-danger)' }}>{formatPKR(summary.overdue)}</span></div></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--accent-warning)' }}><Clock size={20} /></div><div className={styles.statBody}><span className={styles.statLabel}>Pending / Partial</span><span className={styles.statValue} style={{ color: 'var(--accent-warning)' }}>{formatPKR(summary.pendingApproval)}</span></div></div>
            </div>

            <div className={styles.scopeRail}>
                <div className={styles.scopeCard}><Wallet size={16} /><div><strong>{formatPKR(averageInvoice)}</strong><span>Average invoice value</span></div></div>
                <div className={styles.scopeCard}><AlertTriangle size={16} /><div><strong>{overdueCount}</strong><span>Overdue documents in view</span></div></div>
                <div className={styles.scopeCard}><Store size={16} /><div><strong>{branchCoverage || branches.length}</strong><span>Branches in current result set</span></div></div>
                <div className={styles.scopeCard}><CreditCard size={16} /><div><strong>{topOverdueVendor ? formatPKR(topOverdueVendor.amount) : 'PKR 0.00'}</strong><span>{topOverdueVendor ? `Top overdue vendor: ${topOverdueVendor.name}` : 'No overdue vendor in current view'}</span></div></div>
                <div className={styles.scopeCard}><Store size={16} /><div><strong>{topOverdueBranch ? formatPKR(topOverdueBranch.amount) : 'PKR 0.00'}</strong><span>{topOverdueBranch ? `Top overdue branch: ${topOverdueBranch.name}` : 'No overdue branch in current view'}</span></div></div>
            </div>

            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <Search size={15} className={styles.searchIcon} />
                    <input className={styles.searchInput} placeholder="Search by vendor, invoice, branch..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className={styles.selectWrapper}>
                    <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="overdue">Overdue</option>
                        <option value="paid">Paid</option>
                    </select>
                    <ChevronDown size={13} className={styles.selectChevron} />
                </div>
                <div className={styles.selectWrapper}>
                    <select className={styles.filterSelect} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                        <option value="all">All Branches</option>
                        {branches.map((branch) => <option key={branch.id} value={branch.branch_name}>{branch.branch_name}</option>)}
                    </select>
                    <ChevronDown size={13} className={styles.selectChevron} />
                </div>
                <div className={styles.viewToggles}>
                    <button className={`${styles.viewBtn} ${viewMode === 'line' ? styles.activeView : ''}`} onClick={() => setViewMode('line')}><List size={14} /></button>
                    <button className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.activeView : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={14} /></button>
                </div>
                <div className={styles.filterTotals}>
                    <span>{formatPKR(totalBalance)} outstanding</span>
                    <span className={styles.sep}>|</span>
                    <span style={{ color: '#22c55e' }}>{formatPKR(totalPaid)} paid</span>
                    <span className={styles.sep}>|</span>
                    <span className={styles.resultCount}>{filtered.length} records</span>
                </div>
            </div>

            {isLoading ? (
                <div className={styles.emptyState}><CreditCard size={32} /><p>Loading live vendor payable data...</p></div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}><CreditCard size={32} /><p>No vendor payment records match your filters.</p></div>
            ) : viewMode === 'line' ? (
                <div className={styles.tableCard}>
                    <div className={styles.tableHeader}>
                        <span>Invoice / Vendor</span>
                        <span>Branch</span>
                        <span>Invoice Date</span>
                        <span>Due Date</span>
                        <span>Invoice Amount</span>
                        <span>Paid</span>
                        <span>Balance</span>
                        <span>Status</span>
                        <span></span>
                    </div>
                    {filtered.map((payment) => {
                        const cfg = STATUS_CONFIG[payment.status];
                        return (
                            <div key={payment.id} className={styles.tableRow}>
                                <div><strong>{payment.invoiceNo}</strong><div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{payment.vendorName}</div></div>
                                <span>{payment.branch}</span>
                                <span>{payment.invoiceDate}</span>
                                <span>{payment.dueDate}</span>
                                <span>{formatPKR(payment.amount)}</span>
                                <span style={{ color: '#22c55e' }}>{formatPKR(payment.amountPaid)}</span>
                                <span style={{ color: payment.balance > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{formatPKR(payment.balance)}</span>
                                <span className={`${styles.statusBadge} ${cfg.className}`}>{cfg.label}</span>
                                <button className={styles.viewBtn} onClick={() => void openPaymentDetail(payment)}><Eye size={14} /></button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={styles.gridView}>
                    {filtered.map((payment) => {
                        const cfg = STATUS_CONFIG[payment.status];
                        return (
                            <div key={payment.id} className={styles.paymentCard}>
                                <div className={styles.cardTop}>
                                    <div>
                                        <strong>{payment.vendorName}</strong>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{payment.invoiceNo}</div>
                                    </div>
                                    <span className={`${styles.statusBadge} ${cfg.className}`}>{cfg.label}</span>
                                </div>
                                <div className={styles.cardMeta}><span>Branch</span><strong>{payment.branch}</strong></div>
                                <div className={styles.cardMeta}><span>Due</span><strong>{payment.dueDate}</strong></div>
                                <div className={styles.cardMeta}><span>Invoice</span><strong>{formatPKR(payment.amount)}</strong></div>
                                <div className={styles.cardMeta}><span>Balance</span><strong>{formatPKR(payment.balance)}</strong></div>
                                <button className={styles.btnSecondary} onClick={() => void openPaymentDetail(payment)}><Eye size={14} /> View</button>
                            </div>
                        );
                    })}
                </div>
            )}

            <PaymentModal
                payment={selectedPayment}
                detail={selectedDetail}
                loading={detailLoading}
                formatVisiblePayableDocumentNumber={formatVisiblePayableDocumentNumber}
                formatVisiblePaymentVoucherNumber={formatVisiblePaymentVoucherNumber}
                formatVisibleCreditVoucherNumber={formatVisibleCreditVoucherNumber}
                onClose={() => {
                    setSelectedPayment(null);
                    setSelectedDetail(null);
                }}
            />
        </div>
    );
}
