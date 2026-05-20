/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CircleHelp, Lock, Receipt, RefreshCw, RotateCcw, Save, Search, Wallet } from 'lucide-react';
import { accountingApi, vendorApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatMoney } from './cashierUtils';
import { formatConfiguredExpenseVoucherNumber } from '../pos/printTemplates/printHelpers';
import styles from './CashierShared.module.css';

type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'Mobile Wallet' | 'Credit Purchase';
type VendorMode = 'registered' | 'one_time';
type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
    updated_by?: string | null;
};

type ExpenseAccountOption = {
    id: string;
    name: string;
    branch_id: number | null;
    description?: string | null;
    usage_guidance?: string | null;
    example_entry?: string | null;
    confusion_note?: string | null;
    allow_manual_posting: boolean;
    is_control_account: boolean;
};

type TreasuryAccountOption = {
    id: string;
    name: string;
    branch_id: number | null;
    description?: string | null;
    usage_guidance?: string | null;
    example_entry?: string | null;
    confusion_note?: string | null;
    is_bank_account: boolean;
    is_cash_account: boolean;
    is_petty_cash_account?: boolean;
};

type VendorOption = {
    id: string;
    name: string;
};

export function CashierExpenseEntry() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
    const { activeBranch } = useBranchContext();
    const { canReadPos, canUseCashierConsole, hasPermission } = usePermissionAccess();
    const branchId = Number(activeBranch?.branch_id || activeBranch?.id || 0);
    const canOpenOrderSearch = canReadPos || canUseCashierConsole || hasPermission(APP_PERMISSIONS.POS.ORDER_SEARCH);
    const canOpenReturnedOrders = canOpenOrderSearch;

    const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccountOption[]>([]);
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccountOption[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expenseAccountId, setExpenseAccountId] = useState('');
    const [treasuryAccountId, setTreasuryAccountId] = useState('');
    const [expenseAccountSearch, setExpenseAccountSearch] = useState('');
    const [treasuryAccountSearch, setTreasuryAccountSearch] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>('Cash');
    const [expenseReference, setExpenseReference] = useState('');
    const [vendorMode, setVendorMode] = useState<VendorMode>('one_time');
    const [vendorId, setVendorId] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [vendors, setVendors] = useState<VendorOption[]>([]);
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [lastSubmittedVoucherNo, setLastSubmittedVoucherNo] = useState('');

    const numericAmount = useMemo(() => {
        const value = Number(expenseAmount || 0);
        return Number.isFinite(value) ? value : 0;
    }, [expenseAmount]);

    const loadExpenseAccounts = useCallback(async () => {
        setIsLoadingAccounts(true);
        try {
            const [accounts, vendorResponse] = await Promise.all([
                accountingApi.getAccounts(),
                vendorApi.getVendors().catch(() => []),
            ]);
            const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [
                node,
                ...(Array.isArray(node?.children) ? flatten(node.children) : []),
            ]);
            const flattened = flatten(Array.isArray(accounts) ? accounts : []);
            const nextExpenseAccounts = flattened
                .filter((account) => account?.account_type === 'expense' && account?.is_control_account !== true)
                .map((account) => ({
                    id: String(account.id),
                    name: `${account.account_code} - ${account.account_name}`,
                    branch_id: account.branch_id ? Number(account.branch_id) : null,
                    description: account.description ?? null,
                    usage_guidance: account.usage_guidance ?? null,
                    example_entry: account.example_entry ?? null,
                    confusion_note: account.confusion_note ?? null,
                    allow_manual_posting: account.allow_manual_posting !== false,
                    is_control_account: account.is_control_account === true,
                }));
            const nextTreasuryAccounts = flattened
                .filter((account) => account?.is_bank_account === true || account?.is_cash_account === true)
                .map((account) => ({
                    id: String(account.id),
                    name: `${account.account_code} - ${account.account_name}`,
                    branch_id: account.branch_id ? Number(account.branch_id) : null,
                    description: account.description ?? null,
                    usage_guidance: account.usage_guidance ?? null,
                    example_entry: account.example_entry ?? null,
                    confusion_note: account.confusion_note ?? null,
                    is_bank_account: account.is_bank_account === true,
                    is_cash_account: account.is_cash_account === true,
                    is_petty_cash_account: account.is_petty_cash_account === true,
                }));
            setExpenseAccounts(nextExpenseAccounts);
            setTreasuryAccounts(nextTreasuryAccounts);
            setVendors((vendorResponse ?? []).map((vendor: any) => ({
                id: String(vendor.id),
                name: vendor.vendor_name ?? vendor.name ?? `Vendor ${vendor.id}`,
            })));
            setExpenseAccountId((current) => current || nextExpenseAccounts[0]?.id || '');
        } catch (error: any) {
            setExpenseAccounts([]);
            setTreasuryAccounts([]);
            setVendors([]);
            toast.error('Expense Accounts', error?.message || 'Could not load expense accounts.');
        } finally {
            setIsLoadingAccounts(false);
        }
    }, []);

    useEffect(() => {
        void loadExpenseAccounts();
    }, [loadExpenseAccounts]);

    useEffect(() => {
        if (!branchId) return;
        const loadPeriodLock = async () => {
            try {
                const response = await accountingApi.getPeriodLock({ branch_id: branchId });
                setPeriodLock(response ?? null);
            } catch {
                setPeriodLock(null);
            }
        };
        void loadPeriodLock();
    }, [branchId]);

    const filteredExpenseAccounts = useMemo(
        () => expenseAccounts.filter((account) => account.branch_id === null || account.branch_id === branchId),
        [expenseAccounts, branchId],
    );

    const filteredTreasuryAccounts = useMemo(() => {
        if (expensePaymentMethod === 'Credit Purchase') return [];
        const isCashMethod = expensePaymentMethod === 'Cash';
        return treasuryAccounts.filter((account) => {
            const branchMatch = account.branch_id === null || account.branch_id === branchId;
            if (!branchMatch) return false;
            return isCashMethod ? account.is_cash_account : account.is_bank_account;
        });
    }, [treasuryAccounts, branchId, expensePaymentMethod]);

    useEffect(() => {
        setTreasuryAccountId((current) => {
            if (current && filteredTreasuryAccounts.some((account) => account.id === current)) return current;
            return filteredTreasuryAccounts[0]?.id || '';
        });
    }, [filteredTreasuryAccounts]);

    const selectedExpenseAccount = filteredExpenseAccounts.find((account) => account.id === expenseAccountId);
    const selectedTreasuryAccount = filteredTreasuryAccounts.find((account) => account.id === treasuryAccountId);
    const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
    const todayDate = new Date().toISOString().slice(0, 10);
    const isHardLocked = periodLock?.mode === 'hard_lock' && !!periodLock.locked_through_date && todayDate <= periodLock.locked_through_date;
    const isCreditPurchase = expensePaymentMethod === 'Credit Purchase';
    const effectiveVendorName = vendorMode === 'registered' ? (selectedVendor?.name || '') : vendorName.trim();

    useEffect(() => {
        setExpenseAccountSearch(selectedExpenseAccount?.name || '');
    }, [selectedExpenseAccount?.id, selectedExpenseAccount?.name]);

    useEffect(() => {
        setTreasuryAccountSearch(selectedTreasuryAccount?.name || '');
    }, [selectedTreasuryAccount?.id, selectedTreasuryAccount?.name]);

    const handleExpenseAccountSearchChange = (value: string) => {
        setExpenseAccountSearch(value);
        const exactMatch = filteredExpenseAccounts.find((account) => account.name === value);
        setExpenseAccountId(exactMatch ? exactMatch.id : '');
    };

    const handleTreasuryAccountSearchChange = (value: string) => {
        setTreasuryAccountSearch(value);
        const exactMatch = filteredTreasuryAccounts.find((account) => account.name === value);
        setTreasuryAccountId(exactMatch ? exactMatch.id : '');
    };

    const renderAccountTooltip = (
        label: string,
        account?: ExpenseAccountOption | TreasuryAccountOption | null,
    ) => {
        if (!account || (!account.description && !account.usage_guidance && !account.example_entry && !account.confusion_note)) {
            return <label>{label}</label>;
        }

        return (
            <label className={styles.fieldLabelRow}>
                <span>{label}</span>
                <span className={styles.tooltipWrap}>
                    <button
                        type="button"
                        className={styles.tooltipTrigger}
                        aria-label={`${label} guidance`}
                        onClick={(event) => event.preventDefault()}
                    >
                        <CircleHelp size={14} />
                    </button>
                    <span className={styles.tooltipCard} role="tooltip">
                        {account.description ? <span><strong>Purpose:</strong> {account.description}</span> : null}
                        {account.usage_guidance ? <span><strong>Use:</strong> {account.usage_guidance}</span> : null}
                        {account.example_entry ? <span><strong>Example:</strong> {account.example_entry}</span> : null}
                        {account.confusion_note ? <span><strong>Watch out:</strong> {account.confusion_note}</span> : null}
                    </span>
                </span>
            </label>
        );
    };

    const handleSubmit = async () => {
        if (!branchId) {
            toast.error('Branch Required', 'Select an active branch before recording an expense.');
            return;
        }
        if (!expenseAccountId) {
            toast.error('Expense Account', 'Select an expense account.');
            return;
        }
        if (numericAmount <= 0) {
            toast.error('Expense Amount', 'Enter a valid expense amount.');
            return;
        }
        if (!isCreditPurchase && !treasuryAccountId) {
            toast.error('Treasury Account', 'Select the cash or bank source for this expense.');
            return;
        }
        if (!effectiveVendorName) {
            toast.error('Vendor Required', 'Select a registered vendor or enter a one-time vendor name.');
            return;
        }
        if (isHardLocked) {
            toast.error('Period Locked', 'This branch is hard-locked for today. Cashier expense entry is blocked.');
            return;
        }

        setIsSubmitting(true);
        try {
            const voucher: any = await accountingApi.createFinancialVoucher({
                branch_id: branchId,
                type: 'EXPENSE',
                amount: numericAmount,
                payment_method: expensePaymentMethod,
                reference_no: expenseReference.trim() || undefined,
                description: expenseDescription.trim() || undefined,
                date: todayDate,
                expense_account_id: Number(expenseAccountId),
                treasury_account_id: isCreditPurchase ? undefined : Number(treasuryAccountId),
                party_type: 'VENDOR',
                party_id: vendorMode === 'registered' ? vendorId : undefined,
                party_name: effectiveVendorName,
            });
            setLastSubmittedVoucherNo(formatConfiguredExpenseVoucherNumber(voucher.voucher_no || '', activeBranch || voucher, { preserveTypePrefix: true }) || voucher.voucher_no || '');
            toast.success('Expense Submitted', `Expense voucher ${formatConfiguredExpenseVoucherNumber(voucher.voucher_no || `#${voucher.id}`, activeBranch || voucher, { preserveTypePrefix: true }) || voucher.voucher_no || `#${voucher.id}`} was submitted for finance approval.`);
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseReference('');
            setExpensePaymentMethod('Cash');
            setTreasuryAccountId('');
            setVendorMode('one_time');
            setVendorId('');
            setVendorName('');
        } catch (error: any) {
            toast.error('Expense Save Failed', error?.message || 'Could not record the expense.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`${styles.page} ${styles.expensePage}`}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.eyebrow}><Wallet size={14} /> Cashier</span>
                    <h1 className={styles.heroTitle}>Record Expense</h1>
                    <p className={styles.heroDescription}>
                        Create a direct branch expense voucher from the cashier workspace without leaving the front-of-house workflow.
                    </p>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => void loadExpenseAccounts()}>
                        <RefreshCw size={16} />
                        Refresh Accounts
                    </button>
                    {canOpenReturnedOrders ? (
                        <button type="button" className={styles.buttonPrimary} onClick={() => navigate(`${consoleBase}/cashier/returned-orders`)}>
                            <RotateCcw size={16} />
                            Returned Orders
                        </button>
                    ) : null}
                </div>
            </section>

            {periodLock?.mode && periodLock.mode !== 'none' && (
                <section className={styles.bannerWarning}>
                    <Lock size={16} />
                    <span>
                        {periodLock.mode === 'hard_lock' ? 'Hard period lock active.' : 'Admin-override period lock active.'}
                        {' '}Locked through {periodLock.locked_through_date || '-'}{periodLock.updated_by ? ` by ${periodLock.updated_by}` : ''}.
                    </span>
                </section>
            )}

            {isHardLocked && (
                <section className={styles.bannerDanger}>
                    <AlertCircle size={16} />
                    <span>Cashier expense entry is blocked because today falls inside a hard-locked accounting period.</span>
                </section>
            )}

            <section className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Active Branch</span>
                    <strong className={styles.summaryValue}>{activeBranch?.branch_name || 'No branch selected'}</strong>
                    <span className={styles.summarySub}>Expense will post against this branch</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Expense Accounts</span>
                    <strong className={styles.summaryValue}>{isLoadingAccounts ? '...' : expenseAccounts.length}</strong>
                    <span className={styles.summarySub}>Available expense ledgers for cashier voucher entry</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Current Amount</span>
                    <strong className={styles.summaryValue}>{formatMoney(numericAmount)}</strong>
                    <span className={styles.summarySub}>Preview of the amount to be recorded</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Payment Method</span>
                    <strong className={styles.summaryValue}>{expensePaymentMethod}</strong>
                    <span className={styles.summarySub}>Voucher payment mode selected by cashier</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>{isCreditPurchase ? 'Settlement Source' : 'Treasury Source'}</span>
                    <strong className={styles.summaryValue}>{isCreditPurchase ? 'Accounts Payable' : (selectedTreasuryAccount?.name || 'Select source')}</strong>
                    <span className={styles.summarySub}>{isCreditPurchase ? 'Vendor liability will stay open until settled' : 'Actual cash or bank account used for the expense'}</span>
                </article>
                <article className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Vendor</span>
                    <strong className={styles.summaryValue}>{effectiveVendorName || 'Select vendor'}</strong>
                    <span className={styles.summarySub}>{vendorMode === 'registered' ? 'Registered vendor master' : 'One-time urgent supplier'}</span>
                </article>
            </section>

            <section className={`${styles.panel} ${styles.voucherPanel}`}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Expense Voucher</h2>
                        <p className={styles.panelSubtext}>Branch: {activeBranch?.branch_name || 'No active branch selected'}</p>
                    </div>
                    <button type="button" className={styles.buttonGhost} onClick={() => {
                        setExpenseAccountId(filteredExpenseAccounts[0]?.id || '');
                        setExpenseAmount('');
                        setExpenseDescription('');
                        setExpenseReference('');
                        setExpensePaymentMethod('Cash');
                        setTreasuryAccountId('');
                        setVendorMode('one_time');
                        setVendorId('');
                        setVendorName('');
                    }}>
                        Reset form
                    </button>
                </div>

                <div className={styles.voucherShell}>
                    <div className={styles.voucherFormCard}>
                        <div className={styles.voucherFormHero}>
                            <div className={styles.voucherFormHeroText}>
                                <span className={styles.voucherSectionEyebrow}>Direct Branch Expense</span>
                                <h3 className={styles.voucherFormTitle}>Expense Entry</h3>
                                <p className={styles.voucherFormLead}>
                                    Capture the expense ledger, payment source, and supplier trail in one disciplined finance entry.
                                </p>
                            </div>
                            <div className={styles.voucherMetaStrip}>
                                <div className={styles.voucherMetaCard}>
                                    <span>Voucher Number</span>
                                    <strong>{lastSubmittedVoucherNo || 'Auto-generated'}</strong>
                                </div>
                                <div className={styles.voucherMetaCard}>
                                    <span>Posting Date</span>
                                    <strong>{todayDate}</strong>
                                </div>
                                <div className={styles.voucherMetaCard}>
                                    <span>Status</span>
                                    <strong>Pending Approval</strong>
                                </div>
                            </div>
                        </div>

                        <div className={styles.voucherSection}>
                            <div className={styles.voucherSectionHeader}>
                                <div>
                                    <span className={styles.voucherSectionEyebrow}>Accounting Setup</span>
                                    <h4 className={styles.voucherSectionTitle}>Ledger And Settlement</h4>
                                </div>
                                <span className={styles.inlineHint}>Choose the expense ledger first, then the actual payment source.</span>
                            </div>
                            <div className={`${styles.filterGrid} ${styles.setupGrid}`}>
                                <div className={styles.field}>
                                    {renderAccountTooltip('Expense Account', selectedExpenseAccount)}
                                    <span className={styles.inlineHint}>
                                        Select the ledger that explains what kind of business spend this voucher belongs to.
                                    </span>
                                    <input
                                        list="cashier-expense-account-options"
                                        value={expenseAccountSearch}
                                        onChange={(event) => handleExpenseAccountSearchChange(event.target.value)}
                                        placeholder={isLoadingAccounts ? 'Loading accounts...' : 'Search and select account'}
                                        disabled={isLoadingAccounts}
                                    />
                                    <datalist id="cashier-expense-account-options">
                                        {filteredExpenseAccounts.map((account) => (
                                            <option key={account.id} value={account.name} />
                                        ))}
                                    </datalist>
                                    {selectedExpenseAccount && !selectedExpenseAccount.allow_manual_posting && (
                                        <span className={styles.inlineHint}>This account is marked auto-post only and may be blocked by accounting policy.</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    {renderAccountTooltip(isCreditPurchase ? 'Settlement Source' : 'Treasury Account', selectedTreasuryAccount)}
                                    <span className={styles.inlineHint}>
                                        {isCreditPurchase
                                            ? 'This shows the liability account that will hold the unpaid vendor balance until settlement.'
                                            : 'Select the actual cash, petty cash, or bank source from which this expense was paid.'}
                                    </span>
                                    {isCreditPurchase ? (
                                        <input value="Accounts Payable" disabled />
                                    ) : (
                                        <>
                                            <input
                                                list="cashier-treasury-account-options"
                                                value={treasuryAccountSearch}
                                                onChange={(event) => handleTreasuryAccountSearchChange(event.target.value)}
                                                placeholder={isLoadingAccounts ? 'Loading treasury...' : 'Search and select treasury source'}
                                                disabled={isLoadingAccounts}
                                            />
                                            <datalist id="cashier-treasury-account-options">
                                                {filteredTreasuryAccounts.map((account) => (
                                                    <option key={account.id} value={account.name} />
                                                ))}
                                            </datalist>
                                        </>
                                    )}
                                    {!isCreditPurchase && selectedTreasuryAccount?.is_petty_cash_account && (
                                        <span className={styles.inlineHint}>This will reduce petty cash, not the live till balance.</span>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <label>Payment Method</label>
                                    <select value={expensePaymentMethod} onChange={(event) => setExpensePaymentMethod(event.target.value as PaymentMethod)}>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Card">Card</option>
                                        <option value="Mobile Wallet">Mobile Wallet</option>
                                        <option value="Credit Purchase">Credit Purchase</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label>Expense Amount</label>
                                    <input className={styles.strongInput} type="number" min="0" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.voucherSection}>
                            <div className={styles.voucherSectionHeader}>
                                <div>
                                    <span className={styles.voucherSectionEyebrow}>Vendor Trail</span>
                                    <h4 className={styles.voucherSectionTitle}>Supplier Information</h4>
                                </div>
                                <span className={styles.inlineHint}>Use a registered vendor when available. Use one-time vendor only for genuine urgent purchases.</span>
                            </div>
                            <div className={styles.filterGrid}>
                                <div className={styles.field}>
                                    <label>Vendor Mode</label>
                                    <select value={vendorMode} onChange={(event) => {
                                        const nextMode = event.target.value as VendorMode;
                                        setVendorMode(nextMode);
                                        if (nextMode === 'registered') setVendorName('');
                                        if (nextMode === 'one_time') setVendorId('');
                                    }}>
                                        <option value="one_time">One-Time Vendor</option>
                                        <option value="registered">Registered Vendor</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label>{vendorMode === 'registered' ? 'Registered Vendor' : 'Vendor Name'}</label>
                                    {vendorMode === 'registered' ? (
                                        <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={isLoadingAccounts}>
                                            <option value="">Select vendor</option>
                                            {vendors.map((vendor) => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Local urgent supplier / market shop" />
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <label>Reference No.</label>
                                    <input value={expenseReference} onChange={(event) => setExpenseReference(event.target.value)} placeholder="Receipt / Ref #" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.voucherSection}>
                            <div className={styles.voucherSectionHeader}>
                                <div>
                                    <span className={styles.voucherSectionEyebrow}>Narration</span>
                                    <h4 className={styles.voucherSectionTitle}>Business Purpose</h4>
                                </div>
                                <span className={styles.inlineHint}>Describe what was purchased and why. This is the reviewer’s context.</span>
                            </div>
                            <div className={styles.filterGrid}>
                                <div className={`${styles.field} ${styles.fieldFull}`}>
                                    <label>Description</label>
                                    <textarea value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="Expense details, purpose, or cashier note" rows={4} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.voucherActions}>
                            <span className={styles.resultMeta}>
                                {isCreditPurchase
                                    ? 'Submitted as a pending credit expense voucher. Approval will create an open vendor liability.'
                                    : 'Submitted as a pending expense voucher with the selected treasury source for finance approval.'}
                            </span>
                            <div className={styles.heroActions}>
                                {canOpenOrderSearch ? (
                                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate(`${consoleBase}/cashier/orders`)}>
                                        <Search size={16} />
                                        Order Search
                                    </button>
                                ) : null}
                                <button type="button" className={styles.buttonPrimary} onClick={() => void handleSubmit()} disabled={isSubmitting || isLoadingAccounts || isHardLocked}>
                                    <Save size={16} />
                                    {isSubmitting ? 'Saving...' : 'Submit Expense'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <aside className={styles.voucherReviewCard}>
                        <div className={styles.voucherReviewHeader}>
                            <span className={styles.summaryLabel}>Voucher Preview</span>
                            <strong className={styles.summaryValue}>Direct Expense</strong>
                        </div>
                        <div className={styles.voucherReviewGrid}>
                            <div className={styles.voucherReviewRow}><span>Branch</span><strong>{activeBranch?.branch_name || '-'}</strong></div>
                            <div className={styles.voucherReviewRow}><span>Status</span><strong>Pending Approval</strong></div>
                            <div className={styles.voucherReviewRow}><span>Expense Account</span><strong>{selectedExpenseAccount?.name || '-'}</strong></div>
                            <div className={styles.voucherReviewRow}><span>Payment Method</span><strong>{expensePaymentMethod}</strong></div>
                            <div className={styles.voucherReviewRow}><span>Settlement</span><strong>{isCreditPurchase ? 'Accounts Payable' : (selectedTreasuryAccount?.name || '-')}</strong></div>
                            <div className={styles.voucherReviewRow}><span>Vendor</span><strong>{effectiveVendorName || '-'}</strong></div>
                        </div>
                        {selectedExpenseAccount && !selectedExpenseAccount.allow_manual_posting ? (
                            <div className={styles.detailNoteBox}>
                                <strong>Accounting Policy</strong>
                                <span>This account is marked auto-post only. Finance may reject manual use if it is reserved for system-generated entries.</span>
                            </div>
                        ) : null}
                        {!isCreditPurchase && selectedTreasuryAccount?.is_petty_cash_account ? (
                            <div className={styles.detailNoteBox}>
                                <strong>Petty Cash Source</strong>
                                <span>This expense reduces petty cash, not the live counter till. Use this only when the spend was actually made from petty cash custody.</span>
                            </div>
                        ) : null}
                    </aside>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle}>Posting Notes</h2>
                        <p className={styles.panelSubtext}>Operational behavior for cashier-entered expenses.</p>
                    </div>
                </div>
                <div className={styles.detailSummaryGrid}>
                    <div className={styles.detailSummaryCell}><span>Voucher Type</span><strong>Direct Expense</strong></div>
                    <div className={styles.detailSummaryCell}><span>Status</span><strong>Pending Approval</strong></div>
                    <div className={styles.detailSummaryCell}><span>Posting Date</span><strong>{todayDate}</strong></div>
                    <div className={styles.detailSummaryCell}><span>Source</span><strong>Cashier Workspace</strong></div>
                    <div className={styles.detailSummaryCell}><span>Vendor</span><strong>{effectiveVendorName || '-'}</strong></div>
                    <div className={styles.detailSummaryCell}><span>Settlement</span><strong>{isCreditPurchase ? 'Accounts Payable' : (selectedTreasuryAccount?.name || '-')}</strong></div>
                </div>
                <div className={styles.detailNoteBox}>
                    <strong><Receipt size={14} /> Note</strong>
                    <span>The cashier expense page submits a branch expense voucher for approval. Paid expenses reduce the selected cash, petty cash, or bank source. Credit purchases create a vendor liability for later settlement.</span>
                </div>
            </section>
        </div>
    );
}

export default CashierExpenseEntry;
