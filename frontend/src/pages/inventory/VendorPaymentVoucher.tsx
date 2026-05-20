import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, Search, ChevronDown,
    CheckSquare, Square, AlertTriangle, Save,
    Send, Building2, Calendar, CreditCard,
    Hash, StickyNote, Info, CheckCircle2, Receipt
} from 'lucide-react';
import styles from './VendorPaymentVoucher.module.css';

// ── Types ─────────────────────────────────────────────────
type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Advance';
type VoucherStatus = 'draft' | 'pending_approval' | 'approved' | 'reversed';

interface VoucherLine {
    invoiceId: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: number;
    outstanding: number;
    allocatedAmount: number;
    selected: boolean;
    isOverdue: boolean;
}

interface Vendor {
    id: string;
    name: string;
    code: string;
}

// ── Mock Vendors ──────────────────────────────────────────
const MOCK_VENDORS: Vendor[] = [
    { id: 'v01', name: 'Ali Meat Shop', code: 'VND-001' },
    { id: 'v02', name: 'Green Valley Vegetables', code: 'VND-002' },
    { id: 'v03', name: 'Fauji Foods Ltd', code: 'VND-003' },
    { id: 'v04', name: 'Nestlé Pakistan', code: 'VND-004' },
    { id: 'v05', name: 'Pepsi Pakistan', code: 'VND-005' },
    { id: 'v06', name: 'National Foods Ltd', code: 'VND-009' },
    { id: 'v07', name: 'Al-Noor Poultry Farm', code: 'VND-007' },
];

// ── Mock Invoices per Vendor ──────────────────────────────
const MOCK_INVOICES: Record<string, VoucherLine[]> = {
    v01: [
        { invoiceId: 'i01', invoiceNo: 'INV-2026-0892', invoiceDate: '2026-02-01', dueDate: '2026-03-01', invoiceAmount: 187500, outstanding: 187500, allocatedAmount: 187500, selected: false, isOverdue: false },
        { invoiceId: 'i02', invoiceNo: 'INV-2026-0712', invoiceDate: '2026-01-05', dueDate: '2026-02-05', invoiceAmount: 98000, outstanding: 98000, allocatedAmount: 98000, selected: false, isOverdue: true },
        { invoiceId: 'i03', invoiceNo: 'INV-2026-0644', invoiceDate: '2025-12-12', dueDate: '2026-01-12', invoiceAmount: 145000, outstanding: 45000, allocatedAmount: 45000, selected: false, isOverdue: true },
    ],
    v02: [
        { invoiceId: 'i04', invoiceNo: 'INV-2026-0901', invoiceDate: '2026-02-10', dueDate: '2026-03-10', invoiceAmount: 43200, outstanding: 43200, allocatedAmount: 43200, selected: false, isOverdue: false },
        { invoiceId: 'i05', invoiceNo: 'INV-2026-0835', invoiceDate: '2026-01-28', dueDate: '2026-02-28', invoiceAmount: 31500, outstanding: 31500, allocatedAmount: 31500, selected: false, isOverdue: false },
    ],
    v03: [
        { invoiceId: 'i06', invoiceNo: 'INV-2026-0741', invoiceDate: '2026-01-20', dueDate: '2026-03-05', invoiceAmount: 432000, outstanding: 87000, allocatedAmount: 87000, selected: false, isOverdue: false },
        { invoiceId: 'i07', invoiceNo: 'INV-2026-0680', invoiceDate: '2025-12-30', dueDate: '2026-01-30', invoiceAmount: 215000, outstanding: 215000, allocatedAmount: 215000, selected: false, isOverdue: true },
    ],
    v04: [
        { invoiceId: 'i08', invoiceNo: 'INV-2026-0811', invoiceDate: '2026-01-25', dueDate: '2026-02-20', invoiceAmount: 755000, outstanding: 755000, allocatedAmount: 755000, selected: false, isOverdue: true },
    ],
    v05: [
        { invoiceId: 'i09', invoiceNo: 'INV-2026-0888', invoiceDate: '2026-02-05', dueDate: '2026-03-05', invoiceAmount: 312000, outstanding: 312000, allocatedAmount: 312000, selected: false, isOverdue: false },
        { invoiceId: 'i10', invoiceNo: 'INV-2026-0820', invoiceDate: '2026-01-15', dueDate: '2026-02-15', invoiceAmount: 198000, outstanding: 58000, allocatedAmount: 58000, selected: false, isOverdue: true },
    ],
    v06: [
        { invoiceId: 'i11', invoiceNo: 'INV-2026-0822', invoiceDate: '2026-02-08', dueDate: '2026-03-08', invoiceAmount: 221000, outstanding: 221000, allocatedAmount: 221000, selected: false, isOverdue: false },
    ],
    v07: [
        { invoiceId: 'i12', invoiceNo: 'INV-2026-0765', invoiceDate: '2026-01-18', dueDate: '2026-02-02', invoiceAmount: 156000, outstanding: 42000, allocatedAmount: 42000, selected: false, isOverdue: true },
        { invoiceId: 'i13', invoiceNo: 'INV-2026-0690', invoiceDate: '2025-12-20', dueDate: '2026-01-20', invoiceAmount: 89000, outstanding: 89000, allocatedAmount: 89000, selected: false, isOverdue: true },
    ],
};

const PAYMENT_SOURCES: Record<PaymentMethod, string[]> = {
    'Bank Transfer': ['HBL Main Operations', 'Meezan Branch Account', 'UBL Corporate Account', 'MCB Business Current'],
    'Cheque': ['HBL Cheque Book', 'Meezan Cheque Book', 'MCB Cheque Book'],
    'Cash': ['Petty Cash Register', 'Main Cash Vault', 'Branch Cash Box'],
    'Advance': ['Pre-paid Vendor Advance', 'Security Deposit Account'],
};

const BRANCHES = ['Gulberg Main', 'Defence DHA', 'Bahria Town', 'Blue Area', 'Clifton', 'F-6 Markaz'];

function genVoucherNo(): string {
    const n = Math.floor(1000 + Math.random() * 9000);
    return `PV-2026-${n}`;
}

function formatPKR(n: number) {
    return `PKR ${n.toLocaleString()}`;
}

function today(): string {
    return '2026-03-18';
}

// ── Invoice Line Row ──────────────────────────────────────
function InvoiceRow({
    line,
    onToggle,
    onAmountChange,
}: {
    line: VoucherLine;
    onToggle: () => void;
    onAmountChange: (val: number) => void;
}) {
    return (
        <div className={`${styles.invoiceRow} ${line.selected ? styles.invoiceRowSelected : ''}`}>
            <div className={styles.invoiceCheckCol}>
                <button className={styles.checkBtn} onClick={onToggle} type="button">
                    {line.selected
                        ? <CheckSquare size={16} className={styles.checkIconSelected} />
                        : <Square size={16} className={styles.checkIcon} />
                    }
                </button>
            </div>
            <div className={styles.invoiceInfoCol}>
                <span className={styles.invNo}>{line.invoiceNo}</span>
                <span className={styles.invDate}>{line.invoiceDate}</span>
            </div>
            <div className={styles.dueDateCol}>
                <span className={line.isOverdue ? styles.overdue : styles.dueDate}>
                    {line.dueDate}
                    {line.isOverdue && <AlertTriangle size={10} />}
                </span>
            </div>
            <div className={styles.amountCol}>
                <span className={styles.invAmount}>{formatPKR(line.invoiceAmount)}</span>
            </div>
            <div className={styles.outstandingCol}>
                <span className={styles.outstanding}>{formatPKR(line.outstanding)}</span>
            </div>
            <div className={styles.allocateCol}>
                <input
                    type="number"
                    className={styles.allocateInput}
                    value={line.selected ? line.allocatedAmount : ''}
                    disabled={!line.selected}
                    min={0}
                    max={line.outstanding}
                    onChange={e => onAmountChange(Math.min(Number(e.target.value), line.outstanding))}
                    placeholder="—"
                />
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────
export function VendorPaymentVoucher() {
    const navigate = useNavigate();
    const [voucherNo] = useState(genVoucherNo);
    const [voucherDate, setVoucherDate] = useState(today());
    const [branch, setBranch] = useState('Gulberg Main');
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [lines, setLines] = useState<VoucherLine[]>([]);
    const [method, setMethod] = useState<PaymentMethod>('Bank Transfer');
    const [paymentSource, setPaymentSource] = useState(PAYMENT_SOURCES['Bank Transfer'][0]);
    const [chequeNo, setChequeNo] = useState('');
    const [bankRef, setBankRef] = useState('');
    const [narration, setNarration] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [submitting, setSubmitting] = useState<VoucherStatus | null>(null);

    const vendor = MOCK_VENDORS.find(v => v.id === selectedVendorId);

    // When vendor changes, load invoices
    const handleVendorChange = (vendorId: string) => {
        setSelectedVendorId(vendorId);
        setLines((MOCK_INVOICES[vendorId] ?? []).map(l => ({ ...l, selected: false })));
        setInvoiceSearch('');
    };

    const handleMethodChange = (m: PaymentMethod) => {
        setMethod(m);
        setPaymentSource(PAYMENT_SOURCES[m][0]);
        setChequeNo('');
        setBankRef('');
    };

    const toggleLine = useCallback((invoiceId: string) => {
        setLines(prev => prev.map(l =>
            l.invoiceId === invoiceId
                ? { ...l, selected: !l.selected, allocatedAmount: !l.selected ? l.outstanding : 0 }
                : l
        ));
    }, []);

    const updateAmount = useCallback((invoiceId: string, val: number) => {
        setLines(prev => prev.map(l => l.invoiceId === invoiceId ? { ...l, allocatedAmount: val } : l));
    }, []);

    const selectAll = () => setLines(prev => prev.map(l => ({ ...l, selected: true, allocatedAmount: l.outstanding })));
    const clearAll = () => setLines(prev => prev.map(l => ({ ...l, selected: false, allocatedAmount: 0 })));

    const filteredLines = useMemo(() =>
        lines.filter(l => l.invoiceNo.toLowerCase().includes(invoiceSearch.toLowerCase())),
        [lines, invoiceSearch]
    );

    const selectedLines = lines.filter(l => l.selected);
    const totalSelected = selectedLines.length;
    const totalOutstanding = selectedLines.reduce((a, l) => a + l.outstanding, 0);
    const totalAllocated = selectedLines.reduce((a, l) => a + l.allocatedAmount, 0);
    const totalInvoiceAmount = selectedLines.reduce((a, l) => a + l.invoiceAmount, 0);

    const isValid = selectedVendorId && totalSelected > 0 && totalAllocated > 0;

    const handleSubmit = (status: VoucherStatus) => {
        if (!isValid) return;
        setSubmitting(status);
        setTimeout(() => {
            setSubmitting(null);
            navigate('/console/inventory/vendor-payments');
        }, 1200);
    };

    return (
        <div className={styles.page}>
            {/* ── Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/vendor-payments')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.headerIcon}>
                        <Receipt size={20} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Payment Voucher</h1>
                        <p className={styles.pageSubtitle}>Batch multiple invoices into a single vendor payment</p>
                    </div>
                </div>
                <div className={styles.voucherBadge}>
                    <Hash size={13} />
                    <span>{voucherNo}</span>
                </div>
            </div>

            <div className={styles.layout}>
                {/* ── LEFT COLUMN: Voucher Header + Invoice Table ── */}
                <div className={styles.leftCol}>

                    {/* Voucher Header Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <FileText size={15} />
                            <span>Voucher Details</span>
                        </div>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Building2 size={13} /> Vendor <span className={styles.required}>*</span>
                                </label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        className={styles.select}
                                        value={selectedVendorId}
                                        onChange={e => handleVendorChange(e.target.value)}
                                    >
                                        <option value="">— Select Vendor —</option>
                                        {MOCK_VENDORS.map(v => (
                                            <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className={styles.chevron} />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Calendar size={13} /> Voucher Date
                                </label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={voucherDate}
                                    onChange={e => setVoucherDate(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Building2 size={13} /> Branch
                                </label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        className={styles.select}
                                        value={branch}
                                        onChange={e => setBranch(e.target.value)}
                                    >
                                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <ChevronDown size={13} className={styles.chevron} />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Hash size={13} /> Voucher No
                                </label>
                                <input className={`${styles.input} ${styles.inputReadonly}`} value={voucherNo} readOnly />
                            </div>
                        </div>
                    </div>

                    {/* Invoice Selection Table */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <FileText size={15} />
                            <span>Select Invoices</span>
                            {vendor && (
                                <span className={styles.vendorTag}>{vendor.name}</span>
                            )}
                            <div className={styles.cardHeaderActions}>
                                {lines.length > 0 && (
                                    <>
                                        <button className={styles.miniBtn} onClick={selectAll}>Select All</button>
                                        <button className={styles.miniBtn} onClick={clearAll}>Clear</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {!selectedVendorId ? (
                            <div className={styles.emptyPrompt}>
                                <Building2 size={28} />
                                <p>Select a vendor above to load their outstanding invoices</p>
                            </div>
                        ) : lines.length === 0 ? (
                            <div className={styles.emptyPrompt}>
                                <CheckCircle2 size={28} />
                                <p>No outstanding invoices found for this vendor</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.tableSearch}>
                                    <Search size={13} className={styles.searchIcon} />
                                    <input
                                        className={styles.searchInput}
                                        placeholder="Filter invoices..."
                                        value={invoiceSearch}
                                        onChange={e => setInvoiceSearch(e.target.value)}
                                    />
                                </div>

                                <div className={styles.invoiceTable}>
                                    <div className={styles.invoiceTableHeader}>
                                        <span></span>
                                        <span>Invoice</span>
                                        <span>Due Date</span>
                                        <span>Invoice Amt</span>
                                        <span>Outstanding</span>
                                        <span>Allocate</span>
                                    </div>
                                    {filteredLines.map(line => (
                                        <InvoiceRow
                                            key={line.invoiceId}
                                            line={line}
                                            onToggle={() => toggleLine(line.invoiceId)}
                                            onAmountChange={val => updateAmount(line.invoiceId, val)}
                                        />
                                    ))}
                                </div>

                                {filteredLines.length === 0 && (
                                    <div className={styles.noResults}>No invoices match your search.</div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN: Payment + Summary ── */}
                <div className={styles.rightCol}>

                    {/* Payment Details Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <CreditCard size={15} />
                            <span>Payment Details</span>
                        </div>
                        <div className={styles.formStack}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Payment Method <span className={styles.required}>*</span></label>
                                <div className={styles.methodTabs}>
                                    {(['Bank Transfer', 'Cheque', 'Cash', 'Advance'] as PaymentMethod[]).map(m => (
                                        <button
                                            key={m}
                                            className={`${styles.methodTab} ${method === m ? styles.methodTabActive : ''}`}
                                            onClick={() => handleMethodChange(m)}
                                            type="button"
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Payment Source</label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        className={styles.select}
                                        value={paymentSource}
                                        onChange={e => setPaymentSource(e.target.value)}
                                    >
                                        {PAYMENT_SOURCES[method].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className={styles.chevron} />
                                </div>
                            </div>

                            {method === 'Cheque' && (
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Cheque No</label>
                                    <input
                                        className={styles.input}
                                        placeholder="CHQ-00000000"
                                        value={chequeNo}
                                        onChange={e => setChequeNo(e.target.value)}
                                    />
                                </div>
                            )}

                            {method === 'Bank Transfer' && (
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Bank Reference</label>
                                    <input
                                        className={styles.input}
                                        placeholder="e.g. BR20260318XXXXX"
                                        value={bankRef}
                                        onChange={e => setBankRef(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <StickyNote size={13} /> Narration / Notes
                                </label>
                                <textarea
                                    className={styles.textarea}
                                    rows={3}
                                    placeholder="Add internal remarks or payment reference..."
                                    value={narration}
                                    onChange={e => setNarration(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <Info size={15} />
                            <span>Voucher Summary</span>
                        </div>

                        {totalSelected === 0 ? (
                            <div className={styles.summaryEmpty}>
                                Select invoices from the list to see the summary.
                            </div>
                        ) : (
                            <div className={styles.summaryGrid}>
                                <div className={styles.summaryRow}>
                                    <span>Invoices Selected</span>
                                    <strong>{totalSelected}</strong>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Total Invoice Value</span>
                                    <strong>{formatPKR(totalInvoiceAmount)}</strong>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Total Outstanding</span>
                                    <strong className={styles.outstandingValue}>{formatPKR(totalOutstanding)}</strong>
                                </div>
                                <div className={`${styles.summaryRow} ${styles.summaryTotalRow}`}>
                                    <span>Total Allocated</span>
                                    <strong className={styles.allocatedValue}>{formatPKR(totalAllocated)}</strong>
                                </div>
                                {totalAllocated < totalOutstanding && (
                                    <div className={styles.partialNote}>
                                        <AlertTriangle size={12} />
                                        <span>Partial payment — {formatPKR(totalOutstanding - totalAllocated)} will remain outstanding</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Invoices Preview */}
                    {selectedLines.length > 0 && (
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <CheckCircle2 size={15} />
                                <span>Selected ({totalSelected})</span>
                            </div>
                            <div className={styles.selectedList}>
                                {selectedLines.map(l => (
                                    <div key={l.invoiceId} className={styles.selectedItem}>
                                        <div className={styles.selectedItemLeft}>
                                            <span className={styles.selectedInvNo}>{l.invoiceNo}</span>
                                            {l.isOverdue && <span className={styles.overdueTag}>Overdue</span>}
                                        </div>
                                        <span className={styles.selectedAmount}>{formatPKR(l.allocatedAmount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className={styles.actions}>
                        <button
                            className={styles.btnCancel}
                            onClick={() => navigate('/console/inventory/vendor-payments')}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className={styles.btnDraft}
                            disabled={!isValid || !!submitting}
                            onClick={() => handleSubmit('draft')}
                            type="button"
                        >
                            <Save size={14} />
                            {submitting === 'draft' ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                            className={styles.btnSubmit}
                            disabled={!isValid || !!submitting}
                            onClick={() => handleSubmit('pending_approval')}
                            type="button"
                        >
                            <Send size={14} />
                            {submitting === 'pending_approval' ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>

                    {!isValid && selectedVendorId && (
                        <div className={styles.validationNote}>
                            <AlertTriangle size={12} />
                            <span>Select at least one invoice with an allocated amount to proceed.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
