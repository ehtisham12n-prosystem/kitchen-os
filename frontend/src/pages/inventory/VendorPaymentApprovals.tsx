import { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2, Search, UserCheck, DollarSign, ShieldCheck,
    Eye, X, AlertTriangle, Clock3
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredExpenseVoucherNumber, formatConfiguredGrnNumber, formatConfiguredPaymentVoucherNumber } from '../pos/printTemplates/printHelpers';
import styles from './VendorPaymentApprovals.module.css';

type QueueTab = 'manager' | 'final';

type PaymentRequest = {
    id: number;
    voucherNumber: string;
    branch: string;
    vendorName: string;
    paymentDate: string;
    paymentType: string;
    paymentMethod: string;
    amount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
    requestedBy: string;
    notes?: string | null;
    referenceNo?: string | null;
    treasuryAccount?: string | null;
};

type TreasuryException = {
    voucher_id: number;
    voucher_no: string;
    voucher_status: string;
    branch_name: string;
    vendor_name: string;
    issues: string[];
};

type PreviewLine = {
    payable_type: 'grn' | 'expense_voucher';
    document_id: number;
    document_no: string;
    reference: string | null;
    document_date: string;
    due_date: string;
    days_past_due: number;
    bill_amount: number;
    allocated_amount: number;
    remaining_after_payment: number;
    source: 'actual' | 'projected';
};

type PaymentPreview = {
    voucher: {
        id: number;
        voucher_no: string;
        status: string;
        branch_name: string;
        vendor_name: string;
        payment_method: string | null;
        payment_source_label: string | null;
        treasury_account_id: number | null;
        treasury_account_code: string | null;
        treasury_account_name: string | null;
        reference_no: string | null;
        date: string;
        amount: number;
        description: string | null;
    };
    settlement: {
        mode: 'actual' | 'projected';
        line_count: number;
        allocated_total: number;
        unallocated_amount: number;
        lines: PreviewLine[];
    };
};

function formatPKR(value: number) {
    return `PKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VendorPaymentApprovals() {
    const { canApproveVendorPayments } = usePermissionAccess();
    const { activeBranch } = useBranchContext();
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<QueueTab>('manager');
    const [rows, setRows] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
    const [preview, setPreview] = useState<PaymentPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);
    const [exceptions, setExceptions] = useState<TreasuryException[]>([]);
    const formatVisiblePaymentVoucherNumber = (value: string, source?: any) =>
        formatConfiguredPaymentVoucherNumber(value, source || activeBranch, { preserveTypePrefix: true }) || value;
    const formatVisibleSettlementDocumentNumber = (line: PreviewLine) =>
        line.payable_type === 'expense_voucher'
            ? (formatConfiguredExpenseVoucherNumber(line.document_no, activeBranch || line, { preserveTypePrefix: true }) || line.document_no)
            : (formatConfiguredGrnNumber(line.document_no, activeBranch || line, { preserveTypePrefix: true }) || line.document_no);

    useEffect(() => {
        if (!canApproveVendorPayments) {
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                const [vouchers, exceptionReport] = await Promise.all([
                    accountingApi.getFinancialVouchers({ type: 'PAYMENT' }),
                    accountingApi.getPaymentVoucherExceptions(),
                ]);
                const mapped = (vouchers || []).map((voucher: any) => ({
                    id: Number(voucher.id),
                    voucherNumber: formatVisiblePaymentVoucherNumber(voucher.voucher_no, voucher),
                    branch: voucher.branch?.branch_name || `Branch ${voucher.branch_id}`,
                    vendorName: voucher.party_name || 'Vendor',
                    paymentDate: String(voucher.date || '').slice(0, 10),
                    paymentType: Number(voucher.amount || 0) > 0 ? 'Vendor Payment' : 'Payment',
                    paymentMethod: voucher.payment_method || 'Unspecified',
                    amount: Number(voucher.amount || 0),
                    status: String(voucher.status || 'PENDING').toUpperCase(),
                    requestedBy: voucher.created_by ? `User #${voucher.created_by}` : 'System',
                    notes: voucher.description ?? null,
                    referenceNo: voucher.reference_no ?? null,
                    treasuryAccount: voucher.treasury_account?.account_code && voucher.treasury_account?.account_name
                        ? `${voucher.treasury_account.account_code} · ${voucher.treasury_account.account_name}`
                        : voucher.payment_source_label ?? null,
                })) as PaymentRequest[];
                setRows(mapped);
                setExceptions(exceptionReport?.vouchers || []);
            } catch (error: any) {
                toast.error('Payment Approvals', error?.message || 'Could not load vendor payment vouchers.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [canApproveVendorPayments]);

    const targetStatus = tab === 'manager' ? 'PENDING' : 'APPROVED';
    const filtered = useMemo(() => rows.filter((request) =>
        request.status === targetStatus &&
        (
            request.vendorName.toLowerCase().includes(search.toLowerCase()) ||
            request.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
            request.branch.toLowerCase().includes(search.toLowerCase())
        )
    ), [rows, search, targetStatus]);

    const pendingCount = rows.filter((request) => request.status === 'PENDING').length;
    const approvedCount = rows.filter((request) => request.status === 'APPROVED').length;

    if (!canApproveVendorPayments) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <ShieldCheck size={48} color="var(--text-tertiary)" />
                    <p>Your current role does not include vendor payment approval access.</p>
                </div>
            </div>
        );
    }

    const handleOpenModal = async (request: PaymentRequest) => {
        setSelectedRequest(request);
        setComment('');
        setPreview(null);
        setPreviewLoading(true);
        try {
            const response = await accountingApi.getFinancialVoucherPaymentPreview(request.id);
            setPreview(response);
        } catch (error: any) {
            toast.error('Payment Preview', error?.message || 'Could not load settlement preview.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleAction = async (request: PaymentRequest, action: 'approve' | 'reject') => {
        setProcessing(true);
        try {
            await accountingApi.updateFinancialVoucherStatus(
                request.id,
                {
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    note: comment.trim() || (action === 'approve'
                        ? 'Reviewed from vendor payment approvals.'
                        : 'Rejected from vendor payment approvals.'),
                },
            );
            setRows((current) => current.map((row) => row.id === request.id
                ? { ...row, status: action === 'approve' ? 'APPROVED' : 'REJECTED', notes: comment || row.notes }
                : row));
            toast.success(
                action === 'approve' ? 'Payment Approved' : 'Payment Rejected',
                action === 'approve'
                    ? 'The voucher was approved and AP allocation has been posted.'
                    : 'The voucher was rejected.',
            );
            setSelectedRequest(null);
            setPreview(null);
        } catch (error: any) {
            toast.error('Payment Approvals', error?.message || 'Could not update voucher status.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Payment Approvals</h1>
                    <p className={styles.subtitle}>
                        <ShieldCheck size={16} /> Live vendor payment review with vendor payable settlement visibility
                    </p>
                </div>
                <div className={styles.tabGroup}>
                    <button
                        className={`${styles.tabBtn} ${tab === 'manager' ? styles.activeTab : ''}`}
                        onClick={() => setTab('manager')}
                    >
                        <UserCheck size={18} />
                        Pending Approval
                        <span className={styles.badge}>{pendingCount}</span>
                    </button>
                    <button
                        className={`${styles.tabBtn} ${tab === 'final' ? styles.activeTab : ''}`}
                        onClick={() => setTab('final')}
                    >
                        <DollarSign size={18} />
                        Approved / Posted
                        <span className={styles.badge}>{approvedCount}</span>
                    </button>
                </div>
            </div>

            <div className={styles.tableContainer}>
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            placeholder="Search by vendor, branch, or voucher no..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {exceptions.length > 0 && (
                    <div style={{
                        margin: '0 0 16px',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        background: 'rgba(245, 158, 11, 0.08)',
                        color: 'var(--text-primary)',
                    }}>
                        <strong style={{ display: 'block', marginBottom: 6 }}>
                            Treasury control exceptions: {exceptions.length}
                        </strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {formatVisiblePaymentVoucherNumber(exceptions[0].voucher_no, exceptions[0])} · {exceptions[0].branch_name} · {exceptions[0].issues.join(' ')}
                        </span>
                    </div>
                )}

                {loading ? (
                    <div className={styles.emptyState}>
                        <Clock3 size={48} color="var(--text-tertiary)" />
                        <p>Loading live payment vouchers...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle2 size={48} color="var(--text-tertiary)" />
                        <p>No vouchers in this queue.</p>
                    </div>
                ) : (
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th className={styles.tableHeader}>Voucher No</th>
                                <th className={styles.tableHeader}>Vendor</th>
                                <th className={styles.tableHeader}>Method</th>
                                <th className={styles.tableHeader}>Treasury Source</th>
                                <th className={styles.tableHeader}>Branch</th>
                                <th className={styles.tableHeader}>Date</th>
                                <th className={styles.tableHeader}>Reference</th>
                                <th className={styles.tableHeader} style={{ textAlign: 'right' }}>Amount</th>
                                <th className={styles.tableHeader} style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((request) => (
                                <tr key={request.id} className={styles.tableRow}>
                                    <td className={styles.tableCell}>
                                        <div className={styles.voucherCell}>
                                            <span className={styles.voucherCode}>{request.voucherNumber}</span>
                                        </div>
                                    </td>
                                    <td className={styles.tableCell}>
                                        <div className={styles.voucherCell}>
                                            <span className={styles.vendorCell}>{request.vendorName}</span>
                                            <span className={styles.branchText}>{request.notes || 'No description provided'}</span>
                                        </div>
                                    </td>
                                    <td className={styles.tableCell}>{request.paymentMethod}</td>
                                    <td className={styles.tableCell}>{request.treasuryAccount || '-'}</td>
                                    <td className={styles.tableCell}>{request.branch}</td>
                                    <td className={styles.tableCell}>{request.paymentDate}</td>
                                    <td className={styles.tableCell}>{request.referenceNo || '-'}</td>
                                    <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                                        <span className={styles.amountCell}>{request.amount.toLocaleString()}</span>
                                    </td>
                                    <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                                        <button className={styles.actionBtn} onClick={() => void handleOpenModal(request)} style={{ margin: '0 auto' }}>
                                            <Eye size={14} /> Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedRequest && (
                <div className={styles.modalOverlay} onClick={() => setSelectedRequest(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Review Payment Request</h2>
                            <button className={styles.btnClose} onClick={() => setSelectedRequest(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                    <label>Voucher Number</label>
                                    <span>{selectedRequest.voucherNumber}</span>
                                </div>
                                <div className={styles.detailItem} style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '24px' }}>
                                    <label>Amount (PKR)</label>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80', fontFamily: 'Outfit' }}>
                                        {selectedRequest.amount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                    <label>Vendor</label>
                                    <span>{selectedRequest.vendorName}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{selectedRequest.branch}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Payment Method</label>
                                    <span>{selectedRequest.paymentMethod}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Ref: {selectedRequest.referenceNo || 'N/A'}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Payment Source</label>
                                    <span>{preview?.voucher.payment_source_label || 'Not recorded'}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        {preview?.voucher.treasury_account_code && preview?.voucher.treasury_account_name
                                            ? `${preview.voucher.treasury_account_code} · ${preview.voucher.treasury_account_name}`
                                            : 'Treasury source captured on voucher'}
                                    </span>
                                </div>
                            </div>

                            {previewLoading ? (
                                <div className={styles.emptyState}>
                                    <Clock3 size={26} color="var(--text-tertiary)" />
                                    <p>Loading settlement preview...</p>
                                </div>
                            ) : preview ? (
                                <div className={styles.prevPaymentsSection}>
                                    <h3 className={styles.prevTitle}>
                                        {preview.settlement.mode === 'actual' ? 'Posted Settlement Lines' : 'Projected Settlement Lines'}
                                    </h3>
                                    <div className={styles.detailGrid}>
                                        <div className={styles.detailItem}>
                                            <label>Allocated Total</label>
                                            <span>{formatPKR(preview.settlement.allocated_total)}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>Unallocated</label>
                                            <span style={{ color: preview.settlement.unallocated_amount > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>
                                                {formatPKR(preview.settlement.unallocated_amount)}
                                            </span>
                                        </div>
                                    </div>
                                    <table className={styles.prevTable}>
                                        <thead>
                                            <tr>
                                                <th>Document</th>
                                                <th>Reference</th>
                                                <th>Due</th>
                                                <th>Overdue</th>
                                                <th style={{ textAlign: 'right' }}>Bill</th>
                                                <th style={{ textAlign: 'right' }}>Settle</th>
                                                <th style={{ textAlign: 'right' }}>Remain</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.settlement.lines.map((line) => (
                                                <tr key={`${line.payable_type}-${line.document_id}-${line.reference || line.document_no}`}>
                                                    <td>
                                                        <span className={styles.mono}>
                                                            {formatVisibleSettlementDocumentNumber(line)}
                                                        </span>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                            {line.payable_type === 'expense_voucher' ? 'Expense Voucher' : 'GRN Bill'}
                                                        </div>
                                                    </td>
                                                    <td>{line.reference || '-'}</td>
                                                    <td>{line.due_date}</td>
                                                    <td>
                                                        {line.days_past_due > 0 ? (
                                                            <span className={styles.alertText}><AlertTriangle size={12} /> {line.days_past_due}d</span>
                                                        ) : (
                                                            <span className={styles.okText}>Current</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>{formatPKR(line.bill_amount)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(line.allocated_amount)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatPKR(line.remaining_after_payment)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {tab === 'manager' && (
                                <div className={styles.commentSection}>
                                    <label>Reviewer Comments (Optional)</label>
                                    <textarea
                                        className={styles.textarea}
                                        placeholder="Add reason for rejection or approval notes here..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            {tab === 'manager' ? (
                                <>
                                    <button className={styles.btnReject} disabled={processing} onClick={() => void handleAction(selectedRequest, 'reject')}>
                                        Reject Request
                                    </button>
                                    <button className={styles.btnApprove} disabled={processing} onClick={() => void handleAction(selectedRequest, 'approve')}>
                                        Approve and Post
                                    </button>
                                </>
                            ) : (
                                <button className={styles.btnApprove} onClick={() => setSelectedRequest(null)}>
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
