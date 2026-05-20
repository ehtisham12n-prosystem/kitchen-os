import { useState, useMemo } from 'react';
import {
    Search, FileText, CheckCircle2, X,
    User, Building2, Receipt, ArrowRightLeft, DollarSign, FilterX
} from 'lucide-react';
import styles from './VendorPaymentHistory.module.css';

interface PaymentTransaction {
    id: string;
    voucherNumber: string;
    vendorName: string;
    vendorInvoiceNo: string;
    branch: string;
    requestedBy: string;
    paymentDate: string;
    paymentType: string;
    paymentMethod: string;
    paymentSource: string;
    amount: number;
    status: 'finalized' | 'rejected' | 'manager_approved';
}

const MOCK_HISTORY: PaymentTransaction[] = [
    {
        id: 'tx1', voucherNumber: 'VPV-20260215-001', vendorName: 'Ali Meat Shop', vendorInvoiceNo: 'INV-1102',
        branch: 'Gulberg Branch', requestedBy: 'Kamran Ali', paymentDate: '2026-02-15',
        paymentType: 'Full', paymentMethod: 'Bank Transfer', paymentSource: 'HBL Main Operations', amount: 150000, status: 'finalized'
    },
    {
        id: 'tx2', voucherNumber: 'VPV-20260218-042', vendorName: 'Fauji Foods Ltd', vendorInvoiceNo: 'INV-3011',
        branch: 'DHA Phase 5', requestedBy: 'Sana Khan', paymentDate: '2026-02-18',
        paymentType: 'Partial', paymentMethod: 'Cheque', paymentSource: 'Meezan Branch Account', amount: 200000, status: 'finalized'
    },
    {
        id: 'tx3', voucherNumber: 'VPV-20260115-3310', vendorName: 'Nestle Pakistan', vendorInvoiceNo: 'NES-9912',
        branch: 'Model Town', requestedBy: 'Ali Raza', paymentDate: '2026-01-15',
        paymentType: 'Partial', paymentMethod: 'Bank Transfer', paymentSource: 'HBL Main Operations', amount: 1250000, status: 'finalized'
    },
    {
        id: 'tx4', voucherNumber: 'VPV-20260228-5521', vendorName: 'Nestle Pakistan', vendorInvoiceNo: 'NES-9912',
        branch: 'Model Town', requestedBy: 'Ali Raza', paymentDate: '2026-02-28',
        paymentType: 'Full & Final', paymentMethod: 'Bank Transfer', paymentSource: 'HBL Main Operations', amount: 1250000, status: 'manager_approved'
    },
    {
        id: 'tx5', voucherNumber: 'VPV-20260301-090', vendorName: 'National Traders', vendorInvoiceNo: 'NAT-442',
        branch: 'Gulberg Branch', requestedBy: 'Kamran Ali', paymentDate: '2026-03-01',
        paymentType: 'Full', paymentMethod: 'Cash', paymentSource: 'Petty Cash Register', amount: 15000, status: 'rejected'
    }
];

export function VendorPaymentHistory() {
    // Filters state
    const [voucherSearch, setVoucherSearch] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [vendorSearch, setVendorSearch] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [initiatorSearch, setInitiatorSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedDetail, setSelectedDetail] = useState<{ type: 'vendor' | 'initiator' | 'branch' | 'source', value: string } | null>(null);
    const [modalPage, setModalPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const branches = useMemo(() => Array.from(new Set(MOCK_HISTORY.map(t => t.branch))), []);

    const clearFilters = () => {
        setVoucherSearch('');
        setInvoiceSearch('');
        setVendorSearch('');
        setBranchFilter('');
        setInitiatorSearch('');
        setStartDate('');
        setEndDate('');
    };

    // Filter Logic
    const filteredHistory = useMemo(() => {
        return MOCK_HISTORY.filter(tx => {
            if (voucherSearch && !tx.voucherNumber.toLowerCase().includes(voucherSearch.toLowerCase())) return false;
            if (invoiceSearch && !tx.vendorInvoiceNo.toLowerCase().includes(invoiceSearch.toLowerCase())) return false;
            if (vendorSearch && !tx.vendorName.toLowerCase().includes(vendorSearch.toLowerCase())) return false;
            if (branchFilter && tx.branch !== branchFilter) return false;
            if (initiatorSearch && !tx.requestedBy.toLowerCase().includes(initiatorSearch.toLowerCase())) return false;

            if (startDate && new Date(tx.paymentDate) < new Date(startDate)) return false;
            if (endDate && new Date(tx.paymentDate) > new Date(endDate)) return false;

            return true;
        });
    }, [voucherSearch, invoiceSearch, vendorSearch, branchFilter, initiatorSearch, startDate, endDate]);

    // Consolidated Data Generation
    const stats = useMemo(() => {
        let totalAmount = 0;
        let finalizedCount = 0;
        let partialCount = 0;
        let fullCount = 0;

        filteredHistory.forEach(tx => {
            if (tx.status === 'finalized' || tx.status === 'manager_approved') {
                totalAmount += tx.amount;
                finalizedCount++;
                if (tx.paymentType === 'Partial') partialCount++;
                if (tx.paymentType.includes('Full')) fullCount++;
            }
        });

        return { totalAmount, finalizedCount, partialCount, fullCount };
    }, [filteredHistory]);

    // Modal Details Logic
    const modalTransactions = useMemo(() => {
        if (!selectedDetail) return [];
        return MOCK_HISTORY.filter(tx => {
            if (selectedDetail.type === 'vendor') return tx.vendorName === selectedDetail.value;
            if (selectedDetail.type === 'initiator') return tx.requestedBy === selectedDetail.value;
            if (selectedDetail.type === 'branch') return tx.branch === selectedDetail.value;
            if (selectedDetail.type === 'source') return tx.paymentSource === selectedDetail.value;
            return false;
        });
    }, [selectedDetail]);

    const totalModalPages = Math.ceil(modalTransactions.length / ITEMS_PER_PAGE);

    const paginatedModalTransactions = useMemo(() => {
        const start = (modalPage - 1) * ITEMS_PER_PAGE;
        return modalTransactions.slice(start, start + ITEMS_PER_PAGE);
    }, [modalTransactions, modalPage]);

    const openModal = (type: 'vendor' | 'initiator' | 'branch' | 'source', value: string) => {
        setSelectedDetail({ type, value });
        setModalPage(1);
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Payment History</h1>
                    <p className={styles.subtitle}>
                        <ArrowRightLeft size={16} /> Consolidated vendor transaction records
                    </p>
                </div>
            </div>

            {/* Consolidated Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.cardAccentSuccess}`}>
                    <div className={styles.statHeader}>
                        <span>Total Paid / Approved</span>
                        <DollarSign size={18} className={styles.statIcon} color="#4ade80" />
                    </div>
                    <h3 className={styles.statValue}>PKR {stats.totalAmount.toLocaleString()}</h3>
                    <span className={styles.statSub}>Across {stats.finalizedCount} transactions</span>
                </div>
                <div className={`${styles.statCard} ${styles.cardAccentInfo}`}>
                    <div className={styles.statHeader}>
                        <span>Transactions</span>
                        <FileText size={18} className={styles.statIcon} color="#38bdf8" />
                    </div>
                    <h3 className={styles.statValue}>{filteredHistory.length}</h3>
                    <span className={styles.statSub}>Total records (all statuses)</span>
                </div>
                <div className={`${styles.statCard} ${styles.cardAccentWarning}`}>
                    <div className={styles.statHeader}>
                        <span>Partial Payments</span>
                        <ArrowRightLeft size={18} className={styles.statIcon} color="#fbbf24" />
                    </div>
                    <h3 className={styles.statValue}>{stats.partialCount}</h3>
                    <span className={styles.statSub}>Processed or pending</span>
                </div>
                <div className={`${styles.statCard} ${styles.cardAccentSuccess}`}>
                    <div className={styles.statHeader}>
                        <span>Full / Final Settlements</span>
                        <CheckCircle2 size={18} className={styles.statIcon} color="#4ade80" />
                    </div>
                    <h3 className={styles.statValue}>{stats.fullCount}</h3>
                    <span className={styles.statSub}>Completed invoices</span>
                </div>
            </div>

            <div className={styles.mainContent}>
                {/* Advanced Filters */}
                <div className={styles.filtersBar}>
                    <div className={styles.filterGroup}>
                        <label>Voucher No</label>
                        <div className={styles.inputWrapper}>
                            <Search size={14} className={styles.filterIcon} />
                            <input
                                className={styles.filterInput} placeholder="e.g. VPV-123"
                                value={voucherSearch} onChange={e => setVoucherSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Vendor</label>
                        <div className={styles.inputWrapper}>
                            <Building2 size={14} className={styles.filterIcon} />
                            <input
                                className={styles.filterInput} placeholder="Vendor name"
                                value={vendorSearch} onChange={e => setVendorSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Invoice No</label>
                        <div className={styles.inputWrapper}>
                            <Receipt size={14} className={styles.filterIcon} />
                            <input
                                className={styles.filterInput} placeholder="e.g. INV-001"
                                value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Branch</label>
                        <select className={styles.filterSelect} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                            <option value="">All Branches</option>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Initiator</label>
                        <div className={styles.inputWrapper}>
                            <User size={14} className={styles.filterIcon} />
                            <input
                                className={styles.filterInput} placeholder="Requested by"
                                value={initiatorSearch} onChange={e => setInitiatorSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.filterGroup} style={{ flex: 1.5 }}>
                        <label>Date Period</label>
                        <div className={styles.dateGroup}>
                            <input
                                type="date" className={styles.filterInput} style={{ paddingLeft: '12px' }}
                                value={startDate} onChange={e => setStartDate(e.target.value)}
                            />
                            <span className={styles.separator}>to</span>
                            <input
                                type="date" className={styles.filterInput} style={{ paddingLeft: '12px' }}
                                value={endDate} onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <button className={styles.clearFiltersBtn} onClick={clearFilters} title="Clear all filters">
                        <FilterX size={16} />
                    </button>
                </div>

                {/* Data Table */}
                <div className={styles.tableWrapper}>
                    {filteredHistory.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Search size={48} color="rgba(255,255,255,0.2)" />
                            <p>No transactions match your current filters.</p>
                        </div>
                    ) : (
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>Voucher No</th>
                                    <th className={styles.tableHeader}>Date</th>
                                    <th className={styles.tableHeader}>Type</th>
                                    <th className={styles.tableHeader}>Vendor Info</th>
                                    <th className={styles.tableHeader}>Branch / Source</th>
                                    <th className={styles.tableHeader}>Initiator</th>
                                    <th className={styles.tableHeader}>Status</th>
                                    <th className={styles.tableHeader} style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map(req => {
                                    const statusClass = req.status === 'finalized' ? styles.statusFinalized :
                                        req.status === 'rejected' ? styles.statusRejected : styles.statusApproved;
                                    const statusText = req.status === 'finalized' ? 'Finalized' :
                                        req.status === 'rejected' ? 'Rejected' : 'Approved';

                                    return (
                                        <tr key={req.id} className={styles.tableRow}>
                                            <td className={styles.tableCell}>
                                                <span className={styles.voucherCode}>{req.voucherNumber}</span>
                                            </td>
                                            <td className={styles.tableCell}>{req.paymentDate}</td>
                                            <td className={styles.tableCell}>
                                                <span className={styles.typeBadge}>{req.paymentType}</span>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.voucherCell}>
                                                    <span
                                                        className={`${styles.vendorCell} ${styles.linkText}`}
                                                        onClick={() => openModal('vendor', req.vendorName)}
                                                    >
                                                        {req.vendorName}
                                                    </span>
                                                    <span className={styles.branchText}>Inv: {req.vendorInvoiceNo}</span>
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <div className={styles.voucherCell}>
                                                    <span
                                                        className={`${styles.vendorCell} ${styles.linkText}`}
                                                        onClick={() => openModal('branch', req.branch)}
                                                    >
                                                        {req.branch}
                                                    </span>
                                                    <span
                                                        className={`${styles.branchText} ${styles.linkText}`}
                                                        onClick={() => openModal('source', req.paymentSource)}
                                                    >
                                                        {req.paymentSource}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <span
                                                    className={styles.linkText}
                                                    onClick={() => openModal('initiator', req.requestedBy)}
                                                >
                                                    {req.requestedBy}
                                                </span>
                                            </td>
                                            <td className={styles.tableCell}>
                                                <span className={`${styles.statusBadge} ${statusClass}`}>{statusText}</span>
                                            </td>
                                            <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                                                <span className={styles.amountCell}>{req.amount.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Transactional History Modal */}
            {selectedDetail && (
                <div className={styles.modalOverlay} onClick={() => setSelectedDetail(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>
                                {selectedDetail.type === 'vendor' ? 'Vendor History' :
                                    selectedDetail.type === 'initiator' ? 'Initiator History' :
                                        selectedDetail.type === 'branch' ? 'Branch History' : 'Source History'}: <span className={styles.accentText}>{selectedDetail.value}</span>
                            </h2>
                            <button className={styles.btnClose} onClick={() => setSelectedDetail(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th className={styles.tableHeader}>Voucher No</th>
                                        <th className={styles.tableHeader}>Date</th>
                                        <th className={styles.tableHeader}>Type</th>
                                        <th className={styles.tableHeader} style={{ textAlign: 'right' }}>Amount</th>
                                        <th className={styles.tableHeader}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedModalTransactions.map(tx => (
                                        <tr key={tx.id} className={styles.tableRow}>
                                            <td className={styles.tableCell}><span className={styles.voucherCode}>{tx.voucherNumber}</span></td>
                                            <td className={styles.tableCell}>{tx.paymentDate}</td>
                                            <td className={styles.tableCell}><span className={styles.typeBadge}>{tx.paymentType}</span></td>
                                            <td className={styles.tableCell} style={{ textAlign: 'right', fontWeight: 600 }}>{tx.amount.toLocaleString()}</td>
                                            <td className={styles.tableCell}>
                                                <span className={`${styles.statusBadge} ${tx.status === 'finalized' ? styles.statusFinalized : tx.status === 'rejected' ? styles.statusRejected : styles.statusApproved}`}>
                                                    {tx.status === 'finalized' ? 'Finalized' : tx.status === 'rejected' ? 'Rejected' : 'Approved'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {totalModalPages > 1 && (
                                <div className={styles.pagination}>
                                    <button disabled={modalPage === 1} onClick={() => setModalPage(p => p - 1)}>Prev</button>
                                    <span>Page {modalPage} of {totalModalPages}</span>
                                    <button disabled={modalPage === totalModalPages} onClick={() => setModalPage(p => p + 1)}>Next</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
