/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Building2,
    Calendar,
    FileText,
    History,
    LayoutGrid,
    List,
    Lock,
    MoreHorizontal,
    Plus,
    Search,
    Settings,
    TrendingDown,
    Wallet,
    X,
} from 'lucide-react';
import { accountingApi, branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredExpenseVoucherNumber } from '../pos/printTemplates/printHelpers';
import styles from './PettyCash.module.css';

type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
    notes?: string | null;
};

type BranchOption = {
    value: string;
    label: string;
};

type CashAccountOption = {
    id: string;
    code: string;
    name: string;
    branch_id: number | null;
    branch_name: string;
    is_cash_account: boolean;
    is_bank_account: boolean;
    is_petty_cash_account: boolean;
    is_active: boolean;
    balance?: number;
};

type PettyCashTransaction = {
    id: string;
    record_id: number;
    source: 'voucher' | 'journal';
    date: string;
    branch_id: number;
    branch_name: string;
    account_id: number | null;
    account_code: string | null;
    account_name: string;
    category: string;
    description: string;
    type: 'expense' | 'refill' | 'opening';
    amount: number;
    status: string;
    reference_no: string | null;
    payment_method: string | null;
};

type PettyCashAccount = {
    id: number;
    account_code: string;
    account_name: string;
    branch_id: number;
    branch_name: string;
    current_balance: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

type PettyCashOverview = {
    summary: {
        total_balance: number;
        month_expense: number;
        last_refill_amount: number;
        pending_expense_count: number;
        active_accounts: number;
    };
    accounts: PettyCashAccount[];
    transactions: PettyCashTransaction[];
};

type ExpenseFormState = {
    branch_id: string;
    treasury_account_id: string;
    expense_account_id: string;
    amount: string;
    date: string;
    reference_no: string;
    description: string;
};

type RefillFormState = {
    branch_id: string;
    petty_cash_account_id: string;
    source_account_id: string;
    amount: string;
    date: string;
    reference_no: string;
    description: string;
};

type CreateAccountFormState = {
    branch_id: string;
    account_name: string;
    date: string;
    opening_amount: string;
    source_account_id: string;
    reference_no: string;
    description: string;
};

const ChevronDown = ({ size, className }: { size: number; className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const today = new Date().toISOString().split('T')[0];

function formatPKR(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function flattenAccounts(nodes: any[]): any[] {
    return nodes.flatMap((node) => [
        node,
        ...(Array.isArray(node?.children) ? flattenAccounts(node.children) : []),
    ]);
}

const EMPTY_EXPENSE_FORM = (branchId = ''): ExpenseFormState => ({
    branch_id: branchId,
    treasury_account_id: '',
    expense_account_id: '',
    amount: '',
    date: today,
    reference_no: '',
    description: '',
});

const EMPTY_REFILL_FORM = (branchId = ''): RefillFormState => ({
    branch_id: branchId,
    petty_cash_account_id: '',
    source_account_id: '',
    amount: '',
    date: today,
    reference_no: '',
    description: '',
});

const EMPTY_ACCOUNT_FORM = (branchId = ''): CreateAccountFormState => ({
    branch_id: branchId,
    account_name: '',
    date: today,
    opening_amount: '',
    source_account_id: '',
    reference_no: '',
    description: '',
});

export function PettyCash() {
    const { canManagePettyCash, canManageVouchers, canPostAccounting } = usePermissionAccess();
    const { activeBranch } = useBranchContext();
    const [branches, setBranches] = useState<BranchOption[]>([{ value: 'all', label: 'All Branches' }]);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'transactions' | 'accounts'>('transactions');
    const [accountViewMode, setAccountViewMode] = useState<'list' | 'grid'>('list');
    const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | null>(null);
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<PettyCashTransaction | null>(null);
    const [overview, setOverview] = useState<PettyCashOverview | null>(null);
    const [allAccounts, setAllAccounts] = useState<CashAccountOption[]>([]);
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(EMPTY_EXPENSE_FORM());
    const [refillForm, setRefillForm] = useState<RefillFormState>(EMPTY_REFILL_FORM());
    const [createForm, setCreateForm] = useState<CreateAccountFormState>(EMPTY_ACCOUNT_FORM());

    const selectedBranchId = selectedBranch !== 'all' ? Number(selectedBranch) : null;
    const canRecordPettyCashExpense = canPostAccounting || canManageVouchers;

    const loadPage = useCallback(async () => {
        setLoading(true);
        try {
            const [branchRows, accountRows, pettyCash] = await Promise.all([
                branchApi.getBranches(),
                accountingApi.getAccounts(),
                accountingApi.getPettyCashOverview({
                    branch_id: selectedBranchId,
                }),
            ]);

            const branchOptions: BranchOption[] = [
                { value: 'all', label: 'All Branches' },
                ...(branchRows ?? []).map((branch: any) => ({
                    value: String(branch.id),
                    label: branch.branch_name ?? branch.name ?? `Branch ${branch.id}`,
                })),
            ];
            setBranches(branchOptions);

            const flattened = flattenAccounts(Array.isArray(accountRows) ? accountRows : []);
            const normalizedAccounts: CashAccountOption[] = flattened
                .filter((account) => account?.is_cash_account === true || account?.is_bank_account === true)
                .map((account) => ({
                    id: String(account.id),
                    code: account.account_code,
                    name: account.account_name,
                    branch_id: account.branch_id ? Number(account.branch_id) : null,
                    branch_name:
                        branchRows?.find((branch: any) => Number(branch.id) === Number(account.branch_id))?.branch_name
                        ?? 'Company',
                    is_cash_account: account.is_cash_account === true,
                    is_bank_account: account.is_bank_account === true,
                    is_petty_cash_account: account.is_petty_cash_account === true,
                    is_active: account.is_active !== false,
                    balance: Number(account.balance ?? 0),
                }));
            setAllAccounts(normalizedAccounts);
            setOverview(pettyCash ?? { summary: { total_balance: 0, month_expense: 0, last_refill_amount: 0, pending_expense_count: 0, active_accounts: 0 }, accounts: [], transactions: [] });

            if (selectedBranchId) {
                try {
                    const nextLock = await accountingApi.getPeriodLock({ branch_id: selectedBranchId });
                    setPeriodLock(nextLock ?? null);
                } catch {
                    setPeriodLock(null);
                }
            } else {
                setPeriodLock(null);
            }
        } catch (error: any) {
            toast.error('Petty Cash', error?.message || 'Could not load petty cash operations.');
            setOverview(null);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        void loadPage();
    }, [loadPage]);

    useEffect(() => {
        const branchValue = selectedBranchId ? String(selectedBranchId) : '';
        setExpenseForm((current) => ({ ...EMPTY_EXPENSE_FORM(branchValue), branch_id: current.branch_id || branchValue }));
        setRefillForm((current) => ({ ...EMPTY_REFILL_FORM(branchValue), branch_id: current.branch_id || branchValue }));
        setCreateForm((current) => ({ ...EMPTY_ACCOUNT_FORM(branchValue), branch_id: current.branch_id || branchValue }));
    }, [selectedBranchId]);

    const filteredCashAccounts = useMemo(() => {
        return allAccounts.filter((account) => {
            if (selectedBranchId && account.branch_id && account.branch_id !== selectedBranchId) {
                return false;
            }
            return account.is_petty_cash_account;
        });
    }, [allAccounts, selectedBranchId]);

    const fundingAccounts = useMemo(() => {
        return allAccounts.filter((account) => {
            if (selectedBranchId && account.branch_id && account.branch_id !== selectedBranchId) {
                return false;
            }
            return !account.is_petty_cash_account && account.is_active;
        });
    }, [allAccounts, selectedBranchId]);

    const pettyCashBranchOptions = useMemo(() => branches.filter((branch) => branch.value !== 'all'), [branches]);

    const transactionRows = useMemo(() => {
        const rows = overview?.transactions ?? [];
        return rows.filter((row) => {
            const matchesSearch =
                row.description.toLowerCase().includes(searchQuery.toLowerCase())
                || row.category.toLowerCase().includes(searchQuery.toLowerCase())
                || String(row.reference_no ?? '').toLowerCase().includes(searchQuery.toLowerCase())
                || String(row.account_code ?? '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPending = !showOnlyPending || row.status === 'PENDING';
            const matchesAccount = !selectedAccountFilter || String(row.account_id ?? '') === selectedAccountFilter;
            return matchesSearch && matchesPending && matchesAccount;
        });
    }, [overview?.transactions, searchQuery, showOnlyPending, selectedAccountFilter]);

    const isHardLocked = periodLock?.mode === 'hard_lock' && !!periodLock?.locked_through_date && periodLock.locked_through_date >= today;

    const exportTransactions = () => {
        if (transactionRows.length === 0) {
            toast.error('Nothing To Export', 'There are no petty-cash transactions for the current filters.');
            return;
        }
        const csvLines = [
            ['Date', 'Branch', 'Account', 'Category', 'Type', 'Amount', 'Status', 'Reference', 'Description'].join(','),
            ...transactionRows.map((row) => [
                row.date,
                `"${row.branch_name.replace(/"/g, '""')}"`,
                `"${`${row.account_code ?? ''} ${row.account_name}`.trim().replace(/"/g, '""')}"`,
                `"${row.category.replace(/"/g, '""')}"`,
                row.type,
                row.amount,
                row.status,
                `"${String(row.reference_no ?? '').replace(/"/g, '""')}"`,
                `"${row.description.replace(/"/g, '""')}"`,
            ].join(',')),
        ];
        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `petty-cash-${selectedBranchId || 'all'}-${today}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const [expenseCatalog, setExpenseCatalog] = useState<Array<{ id: string; label: string; branch_id: number | null; allow_manual_posting: boolean }>>([]);

    useEffect(() => {
        let mounted = true;
        const loadExpenseCatalog = async () => {
            try {
                const accounts = await accountingApi.getAccounts();
                const flattened = flattenAccounts(Array.isArray(accounts) ? accounts : []);
                const next = flattened
                    .filter((account) => account?.account_type === 'expense' && account?.is_control_account !== true)
                    .map((account) => ({
                        id: String(account.id),
                        label: `${account.account_code} - ${account.account_name}`,
                        branch_id: account.branch_id ? Number(account.branch_id) : null,
                        allow_manual_posting: account.allow_manual_posting !== false,
                    }));
                if (mounted) {
                    setExpenseCatalog(next);
                }
            } catch {
                if (mounted) {
                    setExpenseCatalog([]);
                }
            }
        };
        void loadExpenseCatalog();
        return () => {
            mounted = false;
        };
    }, []);

    const availableExpenseAccounts = useMemo(
        () => expenseCatalog.filter((account) => {
            const branchId = Number(expenseForm.branch_id || 0);
            return !branchId || account.branch_id === null || account.branch_id === branchId;
        }),
        [expenseCatalog, expenseForm.branch_id],
    );

    const pettyCashAccountsForExpense = useMemo(
        () => filteredCashAccounts.filter((account) => {
            const branchId = Number(expenseForm.branch_id || 0);
            return !branchId || account.branch_id === branchId;
        }),
        [filteredCashAccounts, expenseForm.branch_id],
    );

    const pettyCashBalanceMap = useMemo(() => {
        const accounts = overview?.accounts ?? [];
        return new Map(accounts.map((account) => [String(account.id), Number(account.current_balance ?? 0)]));
    }, [overview?.accounts]);

    const selectedExpenseCashAccount = useMemo(
        () => {
            const selected = pettyCashAccountsForExpense.find((account) => String(account.id) === String(expenseForm.treasury_account_id)) || null;
            if (!selected) return null;
            return {
                ...selected,
                balance: pettyCashBalanceMap.get(String(selected.id)) ?? Number(selected.balance ?? 0),
            };
        },
        [pettyCashAccountsForExpense, expenseForm.treasury_account_id, pettyCashBalanceMap],
    );

    const pettyCashAccountsForRefill = useMemo(
        () => filteredCashAccounts.filter((account) => {
            const branchId = Number(refillForm.branch_id || 0);
            return !branchId || account.branch_id === branchId;
        }),
        [filteredCashAccounts, refillForm.branch_id],
    );

    const selectedRefillCashAccount = useMemo(
        () => {
            const selected = pettyCashAccountsForRefill.find((account) => String(account.id) === String(refillForm.petty_cash_account_id)) || null;
            if (!selected) return null;
            return {
                ...selected,
                balance: pettyCashBalanceMap.get(String(selected.id)) ?? Number(selected.balance ?? 0),
            };
        },
        [pettyCashAccountsForRefill, refillForm.petty_cash_account_id, pettyCashBalanceMap],
    );

    const sourceAccountsForRefill = useMemo(
        () => fundingAccounts.filter((account) => {
            const branchId = Number(refillForm.branch_id || 0);
            return !branchId || account.branch_id === null || account.branch_id === branchId;
        }),
        [fundingAccounts, refillForm.branch_id],
    );

    const sourceAccountsForCreate = useMemo(
        () => fundingAccounts.filter((account) => {
            const branchId = Number(createForm.branch_id || 0);
            return !branchId || account.branch_id === null || account.branch_id === branchId;
        }),
        [fundingAccounts, createForm.branch_id],
    );

    const submitExpense = async () => {
        if (!canRecordPettyCashExpense) {
            toast.error('Access Restricted', 'Your current branch role cannot record petty-cash expense vouchers.');
            return;
        }
        if (!expenseForm.branch_id) {
            toast.error('Branch Required', 'Select a branch before recording a petty-cash expense.');
            return;
        }
        if (!expenseForm.treasury_account_id) {
            toast.error('Petty Cash Account', 'Select the petty-cash account used for this expense.');
            return;
        }
        if (!expenseForm.expense_account_id) {
            toast.error('Expense Account', 'Select the expense ledger account.');
            return;
        }
        if (Number(expenseForm.amount || 0) <= 0) {
            toast.error('Expense Amount', 'Enter a valid expense amount.');
            return;
        }
        if (isHardLocked && Number(expenseForm.branch_id) === selectedBranchId) {
            toast.error('Period Locked', 'This branch is hard-locked today. Petty-cash expense submission is blocked.');
            return;
        }

        setSubmitting(true);
        try {
            const voucher: any = await accountingApi.createFinancialVoucher({
                branch_id: Number(expenseForm.branch_id),
                type: 'EXPENSE',
                amount: Number(expenseForm.amount),
                date: expenseForm.date,
                payment_method: 'Cash',
                treasury_account_id: Number(expenseForm.treasury_account_id),
                expense_account_id: Number(expenseForm.expense_account_id),
                reference_no: expenseForm.reference_no.trim() || undefined,
                description: expenseForm.description.trim() || undefined,
            });
            toast.success(
                'Expense Submitted',
                `Petty-cash expense voucher ${formatConfiguredExpenseVoucherNumber(voucher.voucher_no || `#${voucher.id}`, activeBranch || voucher, { preserveTypePrefix: true }) || voucher.voucher_no || `#${voucher.id}`} was submitted for approval.`,
            );
            setShowExpenseModal(false);
            setExpenseForm(EMPTY_EXPENSE_FORM(selectedBranchId ? String(selectedBranchId) : ''));
            await loadPage();
        } catch (error: any) {
            toast.error('Expense Save Failed', error?.message || 'Could not submit the petty-cash expense.');
        } finally {
            setSubmitting(false);
        }
    };

    const submitRefill = async () => {
        if (!canManagePettyCash) {
            toast.error('Access Restricted', 'Your current branch role cannot refill petty-cash floats.');
            return;
        }
        if (!refillForm.branch_id || !refillForm.petty_cash_account_id || !refillForm.source_account_id) {
            toast.error('Refill Setup', 'Select branch, petty-cash account, and funding source.');
            return;
        }
        if (Number(refillForm.amount || 0) <= 0) {
            toast.error('Refill Amount', 'Enter a valid refill amount.');
            return;
        }

        setSubmitting(true);
        try {
            await accountingApi.createPettyCashRefill({
                branch_id: Number(refillForm.branch_id),
                petty_cash_account_id: Number(refillForm.petty_cash_account_id),
                source_account_id: Number(refillForm.source_account_id),
                amount: Number(refillForm.amount),
                date: refillForm.date,
                reference_no: refillForm.reference_no.trim() || undefined,
                description: refillForm.description.trim() || undefined,
            });
            toast.success('Float Refilled', 'The petty-cash float transfer was posted successfully.');
            setShowRefillModal(false);
            setRefillForm(EMPTY_REFILL_FORM(selectedBranchId ? String(selectedBranchId) : ''));
            await loadPage();
        } catch (error: any) {
            toast.error('Refill Failed', error?.message || 'Could not post the petty-cash refill.');
        } finally {
            setSubmitting(false);
        }
    };

    const submitCreateAccount = async () => {
        if (!canManagePettyCash) {
            toast.error('Access Restricted', 'Your current branch role cannot initialize petty-cash floats.');
            return;
        }
        if (!createForm.branch_id) {
            toast.error('Branch Required', 'Select the branch that needs a petty-cash account.');
            return;
        }
        const openingAmount = Number(createForm.opening_amount || 0);
        if (openingAmount > 0 && !createForm.source_account_id) {
            toast.error('Funding Source', 'Opening balance requires a cash or bank funding source.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await accountingApi.createPettyCashAccount({
                branch_id: Number(createForm.branch_id),
                account_name: createForm.account_name.trim() || undefined,
                date: createForm.date,
                opening_amount: openingAmount > 0 ? openingAmount : 0,
                source_account_id: createForm.source_account_id ? Number(createForm.source_account_id) : undefined,
                reference_no: createForm.reference_no.trim() || undefined,
                description: createForm.description.trim() || undefined,
            });
            toast.success('Petty Cash Ready', `${result.account?.account_name || 'Petty cash account'} is now available for branch spending.`);
            setShowCreateModal(false);
            setCreateForm(EMPTY_ACCOUNT_FORM(selectedBranchId ? String(selectedBranchId) : ''));
            await loadPage();
        } catch (error: any) {
            toast.error('Account Setup Failed', error?.message || 'Could not initialize the petty-cash account.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <Wallet size={20} />
                    </div>
                    <div>
                        <h1>Petty Cash Management</h1>
                        <p>Control branch petty-cash balances, spending vouchers, and float refills from real accounting records.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.branchPicker}>
                        <Building2 size={16} />
                        <KitchenSelect options={branches} value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} />
                    </div>
                    <KitchenButton variant="secondary" size="sm" onClick={() => setShowRefillModal(true)} className={styles.actionBtn} disabled={!canManagePettyCash}>
                        <ArrowUpCircle size={16} />
                        Refill Float
                    </KitchenButton>
                    <KitchenButton variant="primary" size="sm" onClick={() => setShowExpenseModal(true)} className={styles.actionBtn} disabled={!canRecordPettyCashExpense}>
                        <Plus size={16} />
                        Record Expense
                    </KitchenButton>
                </div>
            </header>

            {periodLock && selectedBranchId ? (
                <div className={`${styles.banner} ${periodLock.mode === 'hard_lock' ? styles.bannerDanger : styles.bannerWarning}`}>
                    <Lock size={16} />
                    <span>
                        {periodLock.mode === 'hard_lock'
                            ? `This branch is hard-locked through ${periodLock.locked_through_date || 'the current period'}.`
                            : `This branch uses admin-override period control through ${periodLock.locked_through_date || 'the current period'}.`}
                    </span>
                </div>
            ) : null}

            <div className={styles.tabsContainer}>
                <button className={`${styles.tab} ${activeTab === 'transactions' ? styles.tabActive : ''}`} onClick={() => setActiveTab('transactions')}>
                    <History size={16} />
                    Transactions
                </button>
                <button className={`${styles.tab} ${activeTab === 'accounts' ? styles.tabActive : ''}`} onClick={() => setActiveTab('accounts')}>
                    <Settings size={16} />
                    Petty Cash Accounts
                </button>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.balanceIcon}`}>
                        <Wallet size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Current Balance</span>
                        <h3 className={styles.statValue}>{formatPKR(overview?.summary.total_balance ?? 0)}</h3>
                        <span className={styles.statSub}>Across {overview?.summary.active_accounts ?? 0} active petty-cash accounts</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.expenseIcon}`}>
                        <TrendingDown size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Month Expense</span>
                        <h3 className={styles.statValue}>{formatPKR(overview?.summary.month_expense ?? 0)}</h3>
                        <span className={styles.statSub}>Approved petty-cash spend this month</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.refillIcon}`}>
                        <ArrowUpCircle size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Last Refill</span>
                        <h3 className={styles.statValue}>{formatPKR(overview?.summary.last_refill_amount ?? 0)}</h3>
                        <span className={styles.statSub}>Latest approved float movement</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.reportIcon}`}>
                        <FileText size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Pending Approvals</span>
                        <h3 className={styles.statValue}>{overview?.summary.pending_expense_count ?? 0}</h3>
                        <span className={styles.statSub}>Expense vouchers waiting for finance approval</span>
                    </div>
                </div>
            </div>

            <div className={styles.mainContent}>
                {activeTab === 'transactions' ? (
                    <div className={styles.tableCard}>
                        <div className={styles.tableHeader}>
                            <div className={styles.tableSearch}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by description, category, account, or reference..."
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                />
                            </div>
                            <div className={styles.tableFilters}>
                                {selectedAccountFilter ? (
                                    <div className={styles.activeFilter}>
                                        <span>Account Filter Applied</span>
                                        <button onClick={() => setSelectedAccountFilter(null)}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : null}
                                <div className={styles.toggleWrapper} onClick={() => setShowOnlyPending((current) => !current)}>
                                    <span>Pending Only</span>
                                    <div className={`${styles.toggle} ${showOnlyPending ? styles.toggleActive : ''}`}>
                                        <div className={styles.toggleSlider} />
                                    </div>
                                </div>
                                <button className={styles.filterBtn} type="button">
                                    <Calendar size={16} />
                                    Live Scope
                                    <ChevronDown size={14} />
                                </button>
                                <button className={styles.exportBtn} type="button" onClick={exportTransactions}>
                                    <FileText size={16} />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Branch</th>
                                        <th>Petty Cash Account</th>
                                        <th>Category</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Reference</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className={styles.emptyState}>Loading petty-cash activity...</td>
                                        </tr>
                                    ) : transactionRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className={styles.emptyState}>No petty-cash transactions match the current filters.</td>
                                        </tr>
                                    ) : transactionRows.map((transaction) => (
                                        <tr key={transaction.id}>
                                            <td>{new Date(`${transaction.date}T00:00:00`).toLocaleDateString()}</td>
                                            <td>{transaction.branch_name}</td>
                                            <td className={styles.accValue}>{`${transaction.account_code ?? ''} ${transaction.account_name}`.trim()}</td>
                                            <td><span className={styles.categoryBadge}>{transaction.category}</span></td>
                                            <td>
                                                <span className={`${styles.typeBadge} ${transaction.type === 'expense' ? styles.expense : styles.refill}`}>
                                                    {transaction.type === 'expense' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                                                    {transaction.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className={transaction.type === 'expense' ? styles.amountExpense : styles.amountRefill}>
                                                {transaction.type === 'expense' ? '-' : '+'}{formatPKR(transaction.amount)}
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${transaction.status === 'APPROVED' ? styles.approved : styles.pending}`}>
                                                    {transaction.status}
                                                </span>
                                            </td>
                                            <td>{transaction.reference_no || '-'}</td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    <button
                                                        title="View Details"
                                                        onClick={() => setSelectedTransaction(transaction)}
                                                    >
                                                        <FileText size={14} />
                                                    </button>
                                                    <button
                                                        title="Filter by Account"
                                                        onClick={() => setSelectedAccountFilter(String(transaction.account_id ?? ''))}
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                    <button title="More Options">
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className={styles.accountView}>
                        <div className={styles.accountActionLine}>
                            <div className={styles.accActionLeft}>
                                <h3>Branch Petty-Cash Accounts</h3>
                                <div className={styles.viewToggle}>
                                    <button className={`${styles.viewBtn} ${accountViewMode === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setAccountViewMode('list')} title="List View">
                                        <List size={16} />
                                    </button>
                                    <button className={`${styles.viewBtn} ${accountViewMode === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setAccountViewMode('grid')} title="Grid View">
                                        <LayoutGrid size={16} />
                                    </button>
                                </div>
                            </div>
                            <KitchenButton variant="secondary" size="sm" onClick={() => setShowCreateModal(true)} className={styles.initButton} disabled={!canManagePettyCash}>
                                <Plus size={16} />
                                Initialize New Float
                            </KitchenButton>
                        </div>

                        {accountViewMode === 'grid' ? (
                            <div className={styles.accountGrid}>
                                {(overview?.accounts ?? []).map((account) => (
                                    <div key={account.id} className={styles.accountCard}>
                                        <div className={styles.accountCardHeader}>
                                            <div className={styles.accNumInfo}>
                                                <span className={styles.accLabel}>Account Code</span>
                                                <span className={styles.accValue}>{account.account_code}</span>
                                            </div>
                                            <span className={`${styles.statusBadge} ${account.is_active ? styles.approved : styles.pending}`}>
                                                {account.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className={styles.accBranch}>
                                            <Building2 size={16} />
                                            <span>{account.branch_name}</span>
                                        </div>
                                        <div className={styles.accBalances}>
                                            <div className={styles.accBalanceItem}>
                                                <span className={styles.accLabel}>Current Balance</span>
                                                <span className={styles.accBalanceValue}>{formatPKR(account.current_balance)}</span>
                                            </div>
                                            <div className={styles.accBalanceItem}>
                                                <span className={styles.accLabel}>Last Updated</span>
                                                <span className={styles.accFloatValue}>{new Date(account.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className={styles.accMeta}>
                                            <div className={styles.metaItem}>
                                                <span>Created {new Date(account.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <span>Updated {new Date(account.updated_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className={styles.accCardActions}>
                                            <KitchenButton
                                                variant="secondary"
                                                size="sm"
                                                fullWidth
                                                onClick={() => {
                                                    setSelectedAccountFilter(String(account.id));
                                                    setActiveTab('transactions');
                                                }}
                                            >
                                                <History size={14} />
                                                View Statement
                                            </KitchenButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.tableCard}>
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Account Code</th>
                                                <th>Account Name</th>
                                                <th>Branch</th>
                                                <th>Current Balance</th>
                                                <th>Status</th>
                                                <th>Updated</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(overview?.accounts ?? []).map((account) => (
                                                <tr key={account.id}>
                                                    <td className={styles.accValue}>{account.account_code}</td>
                                                    <td>{account.account_name}</td>
                                                    <td>{account.branch_name}</td>
                                                    <td className={styles.amountRefill}>{formatPKR(account.current_balance)}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${account.is_active ? styles.approved : styles.pending}`}>
                                                            {account.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(account.updated_at).toLocaleDateString()}</td>
                                                    <td>
                                                        <div className={styles.rowActions}>
                                                            <button
                                                                title="View Statement"
                                                                onClick={() => {
                                                                    setSelectedAccountFilter(String(account.id));
                                                                    setActiveTab('transactions');
                                                                }}
                                                            >
                                                                <History size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showExpenseModal ? (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.expenseModal}`}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderText}>
                                <h3>Record Petty-Cash Expense</h3>
                                <p>Use this form to post a branch petty-cash expense against the correct cash float and expense ledger.</p>
                            </div>
                            <button onClick={() => setShowExpenseModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.expenseSummaryGrid}>
                                <div className={styles.expenseSummaryCard}>
                                    <span className={styles.expenseSummaryLabel}>Branch</span>
                                    <div className={styles.expenseSummaryControl}>
                                        <KitchenSelect
                                            options={pettyCashBranchOptions}
                                            value={expenseForm.branch_id}
                                            onChange={(event) => setExpenseForm((current) => ({ ...current, branch_id: event.target.value, treasury_account_id: '' }))}
                                        />
                                    </div>
                                    <span className={styles.expenseSummaryMeta}>Expense will post under this branch scope.</span>
                                </div>
                                <div className={styles.expenseSummaryCard}>
                                    <span className={styles.expenseSummaryLabel}>Petty-cash account</span>
                                    <div className={styles.expenseSummaryControl}>
                                        <KitchenSelect
                                            options={pettyCashAccountsForExpense.map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` }))}
                                            value={expenseForm.treasury_account_id}
                                            onChange={(event) => setExpenseForm((current) => ({ ...current, treasury_account_id: event.target.value }))}
                                        />
                                    </div>
                                    <span className={styles.expenseSummaryMeta}>
                                        {selectedExpenseCashAccount ? `Available balance ${formatPKR(Number(selectedExpenseCashAccount.balance ?? 0))}` : 'Choose the petty-cash float being used.'}
                                    </span>
                                </div>
                                <div className={styles.expenseSummaryCard}>
                                    <span className={styles.expenseSummaryLabel}>Expense ledger</span>
                                    <div className={styles.expenseSummaryControl}>
                                        <KitchenSelect
                                            options={availableExpenseAccounts.map((account) => ({ value: account.id, label: account.label }))}
                                            value={expenseForm.expense_account_id}
                                            onChange={(event) => setExpenseForm((current) => ({ ...current, expense_account_id: event.target.value }))}
                                        />
                                    </div>
                                    <span className={styles.expenseSummaryMeta}>Choose the final expense head for finance reporting.</span>
                                </div>
                            </div>
                            <div className={styles.expenseModalLayout}>
                                <div className={styles.expenseContextPanel}>
                                    <div className={styles.expenseContextBlock}>
                                        <strong>Before you submit</strong>
                                        <ul className={styles.expenseChecklist}>
                                            <li>Pick the branch that actually used the petty cash.</li>
                                            <li>Select the petty-cash float from which the amount was paid.</li>
                                            <li>Post the cost to the correct expense ledger for reporting.</li>
                                            <li>Use bill or receipt reference where available.</li>
                                        </ul>
                                    </div>
                                    {isHardLocked ? (
                                        <div className={`${styles.expenseContextBlock} ${styles.expenseContextWarning}`}>
                                            <strong>Period lock active</strong>
                                            <span>This branch is currently hard-locked for today. Expense posting is blocked until the lock is lifted.</span>
                                        </div>
                                    ) : (
                                        <div className={styles.expenseContextBlock}>
                                            <strong>Posting result</strong>
                                            <span>This creates a petty-cash expense voucher with cash treasury mapping and routes it for finance approval.</span>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.expenseFormPanel}>
                                    <div className={styles.formGrid}>
                                        <KitchenInput label="Transaction Date" type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))} />
                                        <KitchenInput label="Amount (PKR)" type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
                                        <KitchenInput label="Reference / Bill No." value={expenseForm.reference_no} onChange={(event) => setExpenseForm((current) => ({ ...current, reference_no: event.target.value }))} placeholder="Receipt or vendor bill reference" />
                                        <div className={styles.fullWidthField}>
                                            <KitchenInput label="Description" value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="What was purchased from petty cash?" />
                                        </div>
                                        <div className={styles.fullWidthField}>
                                            <div className={styles.formNote}>Keep the description practical and specific so finance staff can approve and audit it quickly.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setShowExpenseModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={submitting} onClick={() => void submitExpense()}>Submit Expense</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}

            {showRefillModal ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Refill Petty-Cash Float</h3>
                            <button onClick={() => setShowRefillModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.fieldGroup}>
                                    <label>Branch</label>
                                    <KitchenSelect options={pettyCashBranchOptions} value={refillForm.branch_id} onChange={(event) => setRefillForm((current) => ({ ...current, branch_id: event.target.value, petty_cash_account_id: '', source_account_id: '' }))} />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Petty-Cash Account</label>
                                    <KitchenSelect options={pettyCashAccountsForRefill.map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` }))} value={refillForm.petty_cash_account_id} onChange={(event) => setRefillForm((current) => ({ ...current, petty_cash_account_id: event.target.value }))} />
                                    <span className={styles.fieldHint}>
                                        {selectedRefillCashAccount
                                            ? `Available balance ${formatPKR(Number(selectedRefillCashAccount.balance ?? 0))}`
                                            : 'Select the petty-cash account to see its current available balance.'}
                                    </span>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Funding Source</label>
                                    <KitchenSelect options={sourceAccountsForRefill.map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` }))} value={refillForm.source_account_id} onChange={(event) => setRefillForm((current) => ({ ...current, source_account_id: event.target.value }))} />
                                </div>
                                <KitchenInput label="Refill Date" type="date" value={refillForm.date} onChange={(event) => setRefillForm((current) => ({ ...current, date: event.target.value }))} />
                                <KitchenInput label="Refill Amount (PKR)" type="number" value={refillForm.amount} onChange={(event) => setRefillForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
                                <KitchenInput label="Reference / Approval No." value={refillForm.reference_no} onChange={(event) => setRefillForm((current) => ({ ...current, reference_no: event.target.value }))} placeholder="Transfer reference" />
                                <div className={styles.fullWidthField}>
                                    <KitchenInput label="Remarks" value={refillForm.description} onChange={(event) => setRefillForm((current) => ({ ...current, description: event.target.value }))} placeholder="Why is the float being replenished?" />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setShowRefillModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={submitting} onClick={() => void submitRefill()}>Confirm Refill</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}

            {showCreateModal ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Initialize Petty-Cash Account</h3>
                            <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.fieldGroup}>
                                    <label>Branch</label>
                                    <KitchenSelect options={pettyCashBranchOptions} value={createForm.branch_id} onChange={(event) => setCreateForm((current) => ({ ...current, branch_id: event.target.value, source_account_id: '' }))} />
                                </div>
                                <KitchenInput label="Account Name" value={createForm.account_name} onChange={(event) => setCreateForm((current) => ({ ...current, account_name: event.target.value }))} placeholder="Optional custom petty-cash name" />
                                <KitchenInput label="Effective Date" type="date" value={createForm.date} onChange={(event) => setCreateForm((current) => ({ ...current, date: event.target.value }))} />
                                <KitchenInput label="Opening Amount (PKR)" type="number" value={createForm.opening_amount} onChange={(event) => setCreateForm((current) => ({ ...current, opening_amount: event.target.value }))} placeholder="0.00" />
                                <div className={styles.fieldGroup}>
                                    <label>Opening Source</label>
                                    <KitchenSelect options={sourceAccountsForCreate.map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` }))} value={createForm.source_account_id} onChange={(event) => setCreateForm((current) => ({ ...current, source_account_id: event.target.value }))} />
                                </div>
                                <KitchenInput label="Reference / Approval No." value={createForm.reference_no} onChange={(event) => setCreateForm((current) => ({ ...current, reference_no: event.target.value }))} placeholder="Approval reference" />
                                <div className={styles.fullWidthField}>
                                    <KitchenInput label="Notes" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Opening notes or authorization context" />
                                </div>
                                <div className={styles.fullWidthField}>
                                    <div className={styles.formNote}>This creates a dedicated petty-cash treasury account for the branch. If an opening amount is provided, the system posts the opening float from the selected funding source.</div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={submitting} onClick={() => void submitCreateAccount()}>Create Account</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}

            {selectedTransaction ? (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.detailsModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>Petty-Cash Transaction</h3>
                            <button onClick={() => setSelectedTransaction(null)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                    <label>Date</label>
                                    <span>{new Date(`${selectedTransaction.date}T00:00:00`).toLocaleDateString()}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Branch</label>
                                    <span>{selectedTransaction.branch_name}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Petty-Cash Account</label>
                                    <span>{`${selectedTransaction.account_code ?? ''} ${selectedTransaction.account_name}`.trim()}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Category</label>
                                    <span>{selectedTransaction.category}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Type</label>
                                    <span>{selectedTransaction.type.toUpperCase()}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Status</label>
                                    <span>{selectedTransaction.status}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Amount</label>
                                    <span className={selectedTransaction.type === 'expense' ? styles.amountExpense : styles.amountRefill}>{formatPKR(selectedTransaction.amount)}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <label>Reference</label>
                                    <span>{selectedTransaction.reference_no || '-'}</span>
                                </div>
                                <div className={styles.fullWidthDetail}>
                                    <label>Description</label>
                                    <span>{selectedTransaction.description || 'No description provided.'}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setSelectedTransaction(null)}>Close</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
