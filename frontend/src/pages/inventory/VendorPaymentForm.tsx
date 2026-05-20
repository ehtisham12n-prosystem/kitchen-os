import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    CheckCircle2,
    DollarSign,
    Hash,
    Search,
    Send,
    ShieldAlert,
} from 'lucide-react';
import { accountingApi, branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredDocumentNumber } from '../pos/printTemplates/printHelpers';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './VendorPaymentForm.module.css';

type BranchOption = {
    id: number;
    branch_name: string;
};

type PayableDocument = {
    id: number;
    branch_id: number;
    document_no: string;
    document_date: string;
    due_date: string;
    party_id: string | null;
    party_name: string;
    reference?: string | null;
    total_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    days_past_due: number;
};

type VendorOption = {
    id: string;
    name: string;
    outstanding: number;
    invoiceCount: number;
};

type TreasuryAccountOption = {
    id: number;
    account_code: string;
    account_name: string;
    branch_id: number | null;
    is_bank_account: boolean;
    is_cash_account: boolean;
};

function formatPKR(value: number) {
    return `PKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VendorPaymentForm() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const {
        canManageVendorPayments,
        canAccessBranch,
    } = usePermissionAccess();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showVendorList, setShowVendorList] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [payables, setPayables] = useState<PayableDocument[]>([]);
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccountOption[]>([]);

    const [form, setForm] = useState({
        branchId: '',
        vendorId: '',
        vendorName: '',
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: 'Bank Transfer',
        paymentSourceId: '',
        paymentType: 'Partial',
        referenceNo: '',
        notes: '',
    });

    useEffect(() => {
        if (!canManageVendorPayments) {
            setIsLoading(false);
            return;
        }
        const load = async () => {
            setIsLoading(true);
            try {
                const [branchRows, accountTree] = await Promise.all([
                    branchApi.getBranches(),
                    accountingApi.getAccounts(),
                ]);
                const liveBranches = (branchRows || []).map((branch: any) => ({
                    id: Number(branch.id),
                    branch_name: branch.branch_name || `Branch ${branch.id}`,
                }));
                const flattenAccounts = (accounts: any[]): TreasuryAccountOption[] =>
                    accounts.flatMap((account) => [
                        ...((account.is_bank_account || account.is_cash_account) ? [{
                            id: Number(account.id),
                            account_code: account.account_code,
                            account_name: account.account_name,
                            branch_id: account.branch_id ? Number(account.branch_id) : null,
                            is_bank_account: account.is_bank_account === true,
                            is_cash_account: account.is_cash_account === true,
                        }] : []),
                        ...(account.children ? flattenAccounts(account.children) : []),
                    ]);
                const scopedBranches = liveBranches.filter((branch) => canAccessBranch(branch.id));
                setBranches(scopedBranches);
                setTreasuryAccounts(flattenAccounts(accountTree || []));
                const defaultBranchId = scopedBranches[0]?.id ? String(scopedBranches[0].id) : '';
                setForm((prev) => ({ ...prev, branchId: prev.branchId || defaultBranchId }));
            } catch (error: any) {
                toast.error('Vendor Payments', error?.message || 'Could not load branches.');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [canAccessBranch, canManageVendorPayments]);

    useEffect(() => {
        if (!form.branchId) {
            setPayables([]);
            return;
        }
        if (!canManageVendorPayments) {
            return;
        }

        const loadPayables = async () => {
            setIsLoading(true);
            try {
                const response = await accountingApi.getPayablesAging({ branch_id: form.branchId });
                const docs = (response?.documents || []).map((row: any) => ({
                    id: Number(row.id),
                    branch_id: Number(row.branch_id),
                    document_no: row.document_no,
                    document_date: String(row.document_date || '').slice(0, 10),
                    due_date: String(row.due_date || '').slice(0, 10),
                    party_id: row.party_id ? String(row.party_id) : null,
                    party_name: row.party_name || 'Vendor',
                    reference: row.reference ?? null,
                    total_amount: Number(row.total_amount || 0),
                    paid_amount: Number(row.paid_amount || 0),
                    outstanding_amount: Number(row.outstanding_amount || 0),
                    days_past_due: Number(row.days_past_due || 0),
                })) as PayableDocument[];
                setPayables(docs);
            } catch (error: any) {
                setPayables([]);
                toast.error('Vendor Payments', error?.message || 'Could not load open vendor bills.');
            } finally {
                setIsLoading(false);
            }
        };

        void loadPayables();
    }, [canManageVendorPayments, form.branchId]);

    const vendors = useMemo(() => {
        const grouped = new Map<string, VendorOption>();
        for (const doc of payables) {
            if (!doc.party_id) continue;
            const current = grouped.get(doc.party_id) ?? {
                id: doc.party_id,
                name: doc.party_name,
                outstanding: 0,
                invoiceCount: 0,
            };
            current.outstanding += doc.outstanding_amount;
            current.invoiceCount += 1;
            grouped.set(doc.party_id, current);
        }
        return Array.from(grouped.values()).sort((a, b) => b.outstanding - a.outstanding);
    }, [payables]);

    const selectedVendor = useMemo(
        () => vendors.find((vendor) => vendor.id === form.vendorId) ?? null,
        [vendors, form.vendorId],
    );

    const filteredVendors = useMemo(() => {
        const searchValue = searchTerm.trim().toLowerCase();
        if (!searchValue) return vendors;
        return vendors.filter((vendor) =>
            vendor.name.toLowerCase().includes(searchValue) || vendor.id.toLowerCase().includes(searchValue),
        );
    }, [searchTerm, vendors]);

    const vendorBills = useMemo(
        () => payables
            .filter((doc) => doc.party_id === form.vendorId)
            .sort((a, b) => {
                if (a.due_date === b.due_date) return a.id - b.id;
                return a.due_date.localeCompare(b.due_date);
            }),
        [form.vendorId, payables],
    );

    const selectedBranch = branches.find((branch) => String(branch.id) === form.branchId) ?? null;
    const availableTreasuryAccounts = useMemo(() => {
        const branchId = form.branchId ? Number(form.branchId) : null;
        const isCashMethod = form.paymentMethod === 'Cash';
        const isBankMethod = ['Bank Transfer', 'Cheque', 'Mobile Wallet', 'Card'].includes(form.paymentMethod);
        return treasuryAccounts
            .filter((account) => account.branch_id === null || account.branch_id === branchId)
            .filter((account) => {
                if (isCashMethod) return account.is_cash_account;
                if (isBankMethod) return account.is_bank_account;
                return account.is_bank_account || account.is_cash_account;
            })
            .sort((a, b) => a.account_code.localeCompare(b.account_code));
    }, [form.branchId, form.paymentMethod, treasuryAccounts]);
    const selectedTreasuryAccount = useMemo(
        () => availableTreasuryAccounts.find((account) => String(account.id) === form.paymentSourceId)
            ?? treasuryAccounts.find((account) => String(account.id) === form.paymentSourceId)
            ?? null,
        [availableTreasuryAccounts, form.paymentSourceId, treasuryAccounts],
    );
    const outstanding = selectedVendor?.outstanding ?? 0;
    const amountValue = Number(form.amount || 0);
    const canSubmit = Boolean(
        form.branchId &&
        form.vendorId &&
        form.paymentSourceId &&
        amountValue > 0 &&
        amountValue <= outstanding + 0.009,
    );

    if (!canManageVendorPayments) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <p>Your current role does not include vendor payment creation access.</p>
                </div>
            </div>
        );
    }

    const selectVendor = (vendor: VendorOption) => {
        setForm((prev) => ({
            ...prev,
            vendorId: vendor.id,
            vendorName: vendor.name,
            amount: prev.amount && Number(prev.amount) > vendor.outstanding ? '' : prev.amount,
        }));
        setSearchTerm(vendor.name);
        setShowVendorList(false);
    };

    const handleSave = async () => {
        if (!canManageVendorPayments) {
            toast.error('Access Denied', 'Your current role cannot create vendor payment vouchers.');
            return;
        }
        if (!canSubmit || !selectedVendor || !selectedBranch) {
            return;
        }

        setIsSaving(true);
        try {
            const billReferences = vendorBills
                .slice(0, 3)
                .map((bill) => bill.reference || bill.document_no)
                .filter(Boolean);

            await accountingApi.createFinancialVoucher({
                branch_id: Number(form.branchId),
                type: 'PAYMENT',
                party_type: 'VENDOR',
                party_id: selectedVendor.id,
                party_name: selectedVendor.name,
                amount: amountValue,
                date: form.paymentDate,
                payment_method: form.paymentMethod,
                treasury_account_id: Number(form.paymentSourceId),
                payment_source_label: selectedTreasuryAccount?.account_name || null,
                reference_no: form.referenceNo || null,
                description: [
                    `Vendor payment request for ${selectedVendor.name}`,
                    selectedTreasuryAccount ? `Source: ${selectedTreasuryAccount.account_code} ${selectedTreasuryAccount.account_name}` : null,
                    billReferences.length ? `Open documents: ${billReferences.join(', ')}` : null,
                    form.notes.trim() || null,
                ].filter(Boolean).join(' | '),
            });

            toast.success('Payment Request Created', 'The vendor payment voucher has been submitted for approval.');
            navigate('/console/inventory/vendor-payments');
        } catch (error: any) {
            toast.error('Vendor Payments', error?.message || 'Could not create vendor payment voucher.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/vendor-payments')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className={styles.title}>New Payment Request</h1>
                        <p className={styles.subtitle}>Create a live vendor payment voucher from open vendor payable documents.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnPrimary} onClick={handleSave} disabled={isSaving || !canSubmit}>
                        {isSaving ? <><span className={styles.spinner} /> Processing...</> : <><Send size={16} /> Submit for Approval</>}
                    </button>
                </div>
            </div>

            <div className={styles.formContainer}>
                <div className={styles.mainGrid}>
                    <div className={styles.column}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Hash size={14} />
                                <h3>Payment Context</h3>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.field}>
                                        <label>Payment Date</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={form.paymentDate}
                                            onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label>Executing Branch</label>
                                        <select
                                            className={styles.select}
                                            value={form.branchId}
                                            onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value, vendorId: '', vendorName: '', amount: '', paymentSourceId: '' }))}
                                        >
                                            <option value="">Select branch...</option>
                                            {branches.map((branch) => (
                                                <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.contextStrip}>
                                    <div className={styles.contextCard}>
                                        <strong>{selectedBranch?.branch_name || 'No branch selected'}</strong>
                                        <span>Only open vendor payable documents from this branch are eligible for payment.</span>
                                    </div>
                                    <div className={styles.contextCard}>
                                        <strong>{formatPKR(payables.reduce((sum, doc) => sum + doc.outstanding_amount, 0))}</strong>
                                        <span>Open AP in current branch scope.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.sectionSeparator}>
                            <div className={styles.line} />
                            <span>Vendor Source</span>
                            <div className={styles.line} />
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Building2 size={14} />
                                <h3>Vendor Selection</h3>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.field}>
                                    <label>Vendor <span className={styles.required}>*</span></label>
                                    <div className={styles.searchWrapper}>
                                        <Search size={14} className={styles.searchIcon} />
                                        <input
                                            className={styles.input}
                                            placeholder="Search vendor with open payable documents..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setShowVendorList(true);
                                            }}
                                            onFocus={() => setShowVendorList(true)}
                                        />
                                        {showVendorList && filteredVendors.length > 0 && (
                                            <div className={styles.vendorDropdown}>
                                                {filteredVendors.map((vendor) => (
                                                    <button key={vendor.id} type="button" onClick={() => selectVendor(vendor)}>
                                                        <div className={styles.vName}>{vendor.name}</div>
                                                        <div className={styles.vMeta}>{vendor.invoiceCount} open bills • {formatPKR(vendor.outstanding)}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.liveInfoGrid}>
                                    <div className={styles.liveInfoCard}>
                                        <span>Vendor Outstanding</span>
                                        <strong>{formatPKR(outstanding)}</strong>
                                    </div>
                                    <div className={styles.liveInfoCard}>
                                        <span>Open Bills</span>
                                        <strong>{vendorBills.length}</strong>
                                    </div>
                                </div>

                                <div className={styles.helperBox}>
                                    <ShieldAlert size={14} />
                                    <p>Approved payments allocate against the vendor&apos;s oldest open payable documents first. Pending-bill receipts are excluded and credit-expense liabilities are included.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.column}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <DollarSign size={14} />
                                <h3>Financial Details</h3>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.field}>
                                    <label>Method <span className={styles.required}>*</span></label>
                                    <div className={styles.methodGrid}>
                                        {['Bank Transfer', 'Cash', 'Cheque', 'Advance'].map((method) => (
                                            <button
                                                key={method}
                                                type="button"
                                                className={`${styles.methodOption} ${form.paymentMethod === method ? styles.activeMethod : ''}`}
                                                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: method, paymentSourceId: '' }))}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Type <span className={styles.required}>*</span></label>
                                    <div className={styles.typeGrid}>
                                        {['Partial', 'Full', 'Final', 'Full & Final'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`${styles.typeOption} ${form.paymentType === type ? styles.activeType : ''}`}
                                                onClick={() => setForm((prev) => ({ ...prev, paymentType: type, amount: type === 'Partial' ? prev.amount : String(outstanding || '') }))}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Source Account <span className={styles.required}>*</span></label>
                                    <select
                                        className={styles.select}
                                        value={form.paymentSourceId}
                                        onChange={(e) => setForm((prev) => ({ ...prev, paymentSourceId: e.target.value }))}
                                    >
                                        <option value="">Select Account / Register...</option>
                                        {availableTreasuryAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.account_code} - {account.account_name}
                                            </option>
                                        ))}
                                    </select>
                                    <small className={styles.fieldHelp}>
                                        {selectedTreasuryAccount
                                            ? `Posting source: ${selectedTreasuryAccount.account_code} - ${selectedTreasuryAccount.account_name}`
                                            : 'Choose a live cash or bank account for this payment.'}
                                    </small>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.field}>
                                        <label>Amount (PKR) <span className={styles.required}>*</span></label>
                                        <input
                                            type="number"
                                            className={styles.input}
                                            placeholder="0.00"
                                            min="0"
                                            max={outstanding || undefined}
                                            value={form.amount}
                                            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                                        />
                                        <small className={styles.fieldHelp}>Cannot exceed current outstanding of {formatPKR(outstanding)}.</small>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Ref / Instrument #</label>
                                        <input
                                            className={styles.input}
                                            placeholder="Cheque No / TXN ID..."
                                            value={form.referenceNo}
                                            onChange={(e) => setForm((prev) => ({ ...prev, referenceNo: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Remarks</label>
                                    <textarea
                                        className={styles.textarea}
                                        placeholder="Context for approval workflow..."
                                        rows={2}
                                        value={form.notes}
                                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <CheckCircle2 size={14} />
                                <h3>Open Vendor Payables</h3>
                            </div>
                            <div className={styles.cardBody}>
                                {isLoading ? (
                                    <div className={styles.emptyState}>Loading live payable bills...</div>
                                ) : vendorBills.length === 0 ? (
                                    <div className={styles.emptyState}>Select a vendor with open payable documents to review settlement lines.</div>
                                ) : (
                                    <div className={styles.billList}>
                                        {vendorBills.map((bill) => (
                                            <div key={bill.id} className={styles.billRow}>
                                                <div>
                                                    <strong>{bill.reference || (formatConfiguredDocumentNumber(bill.document_no, activeBranch || selectedBranch || bill, { preserveTypePrefix: true }) || bill.document_no)}</strong>
                                                    <small>{formatConfiguredDocumentNumber(bill.document_no, activeBranch || selectedBranch || bill, { preserveTypePrefix: true }) || bill.document_no} • dated {bill.document_date}</small>
                                                </div>
                                                <div className={styles.billMeta}>
                                                    <span className={bill.days_past_due > 0 ? styles.overdueTag : styles.currentTag}>
                                                        {bill.days_past_due > 0 ? `${bill.days_past_due}d overdue` : 'Current'}
                                                    </span>
                                                    <strong>{formatPKR(bill.outstanding_amount)}</strong>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.securityBox}>
                            <CheckCircle2 size={14} color="var(--accent-primary)" />
                            <p>Submission creates a pending vendor payment voucher. Approval posts the AP clearing journal and allocates the payment against billed GRNs and approved credit-expense payables.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
