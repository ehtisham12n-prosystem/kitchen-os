/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { accountingApi, branchApi } from '../../api/api';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import {
    Landmark,
    Plus,
    X,
    ArrowUpRight,
    ArrowDownRight,
    Building2,
    Eye,
    Edit2,
    Wallet,
    PiggyBank,
} from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './BankManagement.module.css';

type LiveAccount = {
    id: number;
    account_code: string;
    account_name: string;
    bank_name?: string | null;
    treasury_institution_name?: string | null;
    account_title?: string | null;
    treasury_account_title?: string | null;
    account_number_iban?: string | null;
    treasury_reference_no_iban?: string | null;
    currency_code?: string | null;
    treasury_currency_code?: string | null;
    bank_account_type?: 'saving' | 'current' | string | null;
    treasury_account_type?: 'saving' | 'current' | string | null;
    description?: string | null;
    account_type: string;
    parent_id?: number | null;
    branch_id?: number | null;
    scope?: 'company' | 'branch' | string | null;
    is_active?: boolean;
    is_bank_account?: boolean;
    is_cash_account?: boolean;
    is_petty_cash_account?: boolean;
    balance?: number;
    children?: LiveAccount[];
};

type BankRow = {
    id: number;
    accountCode: string;
    bankName: string;
    accountTitle: string;
    accountNumberIban: string;
    branchId: number | null;
    branchName: string;
    accountType: 'bank' | 'cash' | 'transit' | 'safe';
    currency: string;
    bankAccountType: 'saving' | 'current';
    description: string;
    balance: number;
    isActive: boolean;
    isPettyCash: boolean;
};

type LedgerRow = {
    id: string;
    date: string;
    description: string;
    source: string;
    debit: number;
    credit: number;
    runningBalance: number;
    accountName?: string;
    branchName?: string;
};

type BankFormState = {
    account_code: string;
    branch_id: string;
    bank_name: string;
    account_title: string;
    account_number_iban: string;
    currency_code: string;
    description: string;
    is_active: boolean;
};

type TreasuryMovementFormState = {
    movement_type: 'cash_to_safe' | 'cash_to_bank' | 'cash_deposit_to_transit' | 'transit_to_bank' | 'bank_to_cash' | 'treasury_transfer';
    source_account_id: string;
    destination_account_id: string;
    handover_journal_entry_ids: string[];
    deposit_entry_ids: string[];
    amount: string;
    date: string;
    description: string;
    reference_no: string;
};

type MerchantSettlementFormState = {
    channel: 'card' | 'digital_wallet' | 'other';
    bank_account_id: string;
    gross_amount: string;
    charges_amount: string;
    date: string;
    provider_name: string;
    reference_no: string;
    description: string;
};

type TreasuryExceptionFormState = {
    status: 'open' | 'in_review' | 'resolved' | 'waived';
    owner_name: string;
    notes: string;
};

const EMPTY_FORM: BankFormState = {
    account_code: '',
    branch_id: 'all',
    bank_name: '',
    account_title: '',
    account_number_iban: '',
    currency_code: 'PKR',
    description: '',
    is_active: true,
};

const EMPTY_MOVEMENT_FORM: TreasuryMovementFormState = {
    movement_type: 'cash_to_safe',
    source_account_id: '',
    destination_account_id: '',
    handover_journal_entry_ids: [],
    deposit_entry_ids: [],
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    reference_no: '',
};

const EMPTY_MERCHANT_SETTLEMENT_FORM: MerchantSettlementFormState = {
    channel: 'card',
    bank_account_id: '',
    gross_amount: '',
    charges_amount: '',
    date: new Date().toISOString().slice(0, 10),
    provider_name: '',
    reference_no: '',
    description: '',
};

const EMPTY_TREASURY_EXCEPTION_FORM: TreasuryExceptionFormState = {
    status: 'open',
    owner_name: '',
    notes: '',
};

function getBranchRowId(branch: any): number | null {
    const raw = branch?.branch_id ?? branch?.id ?? null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function getBranchRowName(branch: any): string {
    return branch?.branch_name || branch?.name || (getBranchRowId(branch) ? `Branch ${getBranchRowId(branch)}` : 'Unnamed Branch');
}

function formatMoney(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString()}`;
}

function formatShortDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

function formatStatusLabel(value?: string | null): string {
    if (!value) return '-';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function composeBankAccountName(bankName: string, accountTitle: string): string {
    const trimmedBankName = bankName.trim();
    const trimmedAccountTitle = accountTitle.trim();
    if (!trimmedBankName) return trimmedAccountTitle;
    if (!trimmedAccountTitle) return trimmedBankName;
    return `${trimmedBankName} - ${trimmedAccountTitle}`;
}

function inferSourceLabel(row: any): string {
    const source = String(row?.source_module || '').toLowerCase();
    if (source === 'pos') return 'POS';
    if (source === 'inventory') return 'Inventory';
    if (source === 'accounting') return 'Accounting';
    return 'Manual';
}

function toForm(account?: BankRow | null): BankFormState {
    if (!account) return EMPTY_FORM;
    return {
        account_code: account.accountCode,
        branch_id: account.branchId ? String(account.branchId) : 'all',
        bank_name: account.bankName,
        account_title: account.accountTitle,
        account_number_iban: account.accountNumberIban,
        currency_code: account.currency || 'PKR',
        description: account.description || '',
        is_active: account.isActive,
    };
}

export function BankManagement() {
    const {
        canManageAccountingSettings,
        canManageBankAccounts,
        canManageChartOfAccounts,
        canPostAccounting,
    } = usePermissionAccess();
    const [selectedBranch, setSelectedBranch] = useState(() => localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id') || 'all');
    const [showModal, setShowModal] = useState(false);
    const [editingBank, setEditingBank] = useState<BankRow | null>(null);
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [showMerchantSettlementModal, setShowMerchantSettlementModal] = useState(false);
    const [showTreasuryExceptionModal, setShowTreasuryExceptionModal] = useState(false);
    const [form, setForm] = useState<BankFormState>(EMPTY_FORM);
    const [movementForm, setMovementForm] = useState<TreasuryMovementFormState>(EMPTY_MOVEMENT_FORM);
    const [merchantSettlementForm, setMerchantSettlementForm] = useState<MerchantSettlementFormState>(EMPTY_MERCHANT_SETTLEMENT_FORM);
    const [treasuryExceptionForm, setTreasuryExceptionForm] = useState<TreasuryExceptionFormState>(EMPTY_TREASURY_EXCEPTION_FORM);
    const [accounts, setAccounts] = useState<BankRow[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
    const [treasuryOverview, setTreasuryOverview] = useState<any>(null);
    const [merchantSettlementReview, setMerchantSettlementReview] = useState<any>(null);
    const [treasuryExceptionWorkflow, setTreasuryExceptionWorkflow] = useState<any>(null);
    const [selectedTreasuryException, setSelectedTreasuryException] = useState<any>(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPostingMovement, setIsPostingMovement] = useState(false);
    const [isPostingMerchantSettlement, setIsPostingMerchantSettlement] = useState(false);
    const [isSavingTreasuryException, setIsSavingTreasuryException] = useState(false);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches
                .map((branch: any) => {
                    const branchId = getBranchRowId(branch);
                    return branchId
                        ? {
                            value: String(branchId),
                            label: getBranchRowName(branch),
                        }
                        : null;
                })
                .filter(Boolean) as Array<{ value: string; label: string }>,
        ],
        [branches],
    );
    const canManageBankSetup = canManageBankAccounts && canManageChartOfAccounts;
    const canPostTreasuryActivity = canPostAccounting || canManageBankAccounts;
    const canManageTreasuryExceptions = canManageAccountingSettings || canManageBankAccounts;

    const loadData = useCallback(async (branchScope?: string) => {
        try {
            const selectedScope = branchScope ?? selectedBranch;
            const branchId = selectedScope === 'all' ? null : selectedScope;
            const [accountTreeResult, branchRowsResult, merchantReviewResult, treasuryExceptionsResult] = await Promise.allSettled([
                accountingApi.getTreasuryOverview({ branch_id: branchId }),
                branchApi.getBranches(),
                accountingApi.getMerchantSettlementReview({ branch_id: branchId }),
                accountingApi.getTreasuryExceptionWorkflow({ branch_id: branchId }),
            ]);

            if (accountTreeResult.status !== 'fulfilled') {
                throw accountTreeResult.reason;
            }
            if (branchRowsResult.status !== 'fulfilled') {
                throw branchRowsResult.reason;
            }

            const accountTree = accountTreeResult.value;
            const branchRows = branchRowsResult.value;
            const merchantReview = merchantReviewResult.status === 'fulfilled' ? merchantReviewResult.value : null;
            const treasuryExceptions = treasuryExceptionsResult.status === 'fulfilled' ? treasuryExceptionsResult.value : null;

            if (merchantReviewResult.status !== 'fulfilled') {
                console.warn('Merchant settlement review did not load for Treasury Accounts page.', merchantReviewResult.reason);
            }
            if (treasuryExceptionsResult.status !== 'fulfilled') {
                console.warn('Treasury exception workflow did not load for Treasury Accounts page.', treasuryExceptionsResult.reason);
            }

            const nextBranchMap = new Map(
                (branchRows || [])
                    .map((branch: any) => {
                        const branchId = getBranchRowId(branch);
                        return branchId ? [branchId, getBranchRowName(branch)] : null;
                    })
                    .filter(Boolean) as Array<[number, string]>,
            );
            const flat = (accountTree?.accounts || [])
                .map((account: any) => ({
                    ...account,
                    children: [],
                })) as LiveAccount[];
                const bankAccounts = flat
                .filter((account) => account.is_bank_account || account.is_cash_account || account.account_code === '1104' || account.account_code === '1105')
                .map((account) => ({
                    id: Number(account.id),
                    accountCode: account.account_code,
                    bankName: account.treasury_institution_name || account.bank_name || account.account_name,
                    accountTitle: account.treasury_account_title || account.account_title || account.account_name,
                    accountNumberIban: account.treasury_reference_no_iban || account.account_number_iban || '',
                    branchId: account.branch_id ? Number(account.branch_id) : null,
                    branchName: account.branch_id
                        ? nextBranchMap.get(Number(account.branch_id)) || `Branch ${account.branch_id}`
                        : 'All Branches',
                    accountType: (
                        account.account_code === '1104'
                            ? 'transit'
                            : account.account_code === '1105'
                                ? 'safe'
                                : account.is_cash_account
                                    ? 'cash'
                                    : 'bank'
                    ) as 'cash' | 'bank' | 'transit' | 'safe',
                    currency: account.treasury_currency_code || account.currency_code || 'PKR',
                    bankAccountType: (account.treasury_account_type || account.bank_account_type) === 'saving' ? 'saving' : 'current',
                    description: account.description || '',
                    balance: Number(account.balance || 0),
                    isActive: account.is_active !== false,
                    isPettyCash: account.is_petty_cash_account === true,
                }))
                .sort((left, right) => left.accountCode.localeCompare(right.accountCode));

            setBranches(branchRows || []);
            setAccounts(bankAccounts);
            setTreasuryOverview(accountTree);
            setMerchantSettlementReview(merchantReview);
            setTreasuryExceptionWorkflow(treasuryExceptions);
        } catch (error: any) {
            console.error(error);
            toast.error('Treasury Accounts', error?.message || 'Could not load live treasury accounts.');
        }
    }, [selectedBranch]);

    useEffect(() => {
        setOverviewLoading(true);
        void loadData(selectedBranch).finally(() => setOverviewLoading(false));
    }, [loadData, selectedBranch]);

    useEffect(() => {
        if (selectedBranch === 'all') {
            return;
        }
        const stillAvailable = branches.some((branch: any) => String(getBranchRowId(branch) || '') === selectedBranch);
        if (!stillAvailable) {
            setSelectedBranch(branchOptions[1]?.value || 'all');
        }
    }, [branchOptions, branches, selectedBranch]);

    const filteredBanks = useMemo(
        () => accounts.filter((account) => selectedBranch === 'all' || String(account.branchId || 'all') === selectedBranch),
        [accounts, selectedBranch],
    );
    const bankNameSuggestions = useMemo(
        () => Array.from(
            new Set(
                accounts
                    .filter((account) => account.accountType === 'bank' && account.bankName.trim())
                    .map((account) => account.bankName.trim()),
            ),
        ).sort((left, right) => left.localeCompare(right)),
        [accounts],
    );

    const viewingLedgerBank = useMemo(
        () => accounts.find((account) => account.id === editingBank?.id) || editingBank,
        [accounts, editingBank],
    );

    const summary = treasuryOverview?.summary ?? {};
    const totalBalance = Number(summary.total_treasury_balance ?? filteredBanks.filter((account) => account.isActive).reduce((sum, account) => sum + account.balance, 0));
    const activeTreasuryAccountCount = Number(summary.bank_account_count ?? filteredBanks.filter((account) => account.isActive && account.accountType === 'bank').length);
    const cashCounterCount = filteredBanks.filter((account) => account.isActive && account.accountType === 'cash' && !account.isPettyCash).length;
    const safeAccountCount = filteredBanks.filter((account) => account.isActive && account.accountType === 'safe').length;
    const transitAccountCount = filteredBanks.filter((account) => account.isActive && account.accountType === 'transit').length;
    const cashOnHandBalance =
        Number(summary.total_cash_balance ?? 0) +
        Number(summary.total_safe_balance ?? 0) +
        Number(summary.total_petty_cash_balance ?? 0);
    const depositsInTransitBalance = Number(summary.bank_in_transit_balance ?? 0);
    const merchantClearingBalance = Number(summary.merchant_clearing_balance ?? 0);
    const linkedBranches = new Set(filteredBanks.map((account) => account.branchName)).size;
    const movementMix = Array.isArray(treasuryOverview?.movement_mix) ? treasuryOverview.movement_mix : [];
    const movementClassificationMix = Array.isArray(treasuryOverview?.movement_classification_mix) ? treasuryOverview.movement_classification_mix : [];
    const recentTreasuryMovements = Array.isArray(treasuryOverview?.recent_movements) ? treasuryOverview.recent_movements : [];
    const merchantSettlementSummary = merchantSettlementReview?.summary ?? {};
    const merchantSettlementQueue = Array.isArray(merchantSettlementReview?.queue) ? merchantSettlementReview.queue : [];
    const merchantProviderSummary = Array.isArray(merchantSettlementReview?.provider_summary) ? merchantSettlementReview.provider_summary : [];
    const merchantChannelSummary = Array.isArray(merchantSettlementReview?.channel_summary) ? merchantSettlementReview.channel_summary : [];
    const treasuryExceptionSummary = treasuryExceptionWorkflow?.summary ?? {};
    const treasuryExceptionItems = Array.isArray(treasuryExceptionWorkflow?.items) ? treasuryExceptionWorkflow.items : [];
    const cashOfficeReview = treasuryOverview?.cash_office_review ?? {};
    const safeDepositReview = useMemo(() => treasuryOverview?.safe_deposit_review ?? {}, [treasuryOverview]);
    const openSafeHandovers = useMemo(
        () => (Array.isArray(safeDepositReview?.open_handovers) ? safeDepositReview.open_handovers : []),
        [safeDepositReview],
    );
    const recentSafeDepositBatches = Array.isArray(safeDepositReview?.recent_deposit_batches) ? safeDepositReview.recent_deposit_batches : [];
    const openTransitDepositBatches = useMemo(
        () => (Array.isArray(safeDepositReview?.open_transit_batches) ? safeDepositReview.open_transit_batches : []),
        [safeDepositReview],
    );
    const latestDayClose = cashOfficeReview?.latest_day_close ?? null;
    const depositReview = cashOfficeReview?.deposits ?? {};
    const varianceReview = cashOfficeReview?.variance_review ?? {};
    const overdueTreasuryDepositCount = Number(safeDepositReview?.overdue_safe_handover_count ?? 0) + Number(safeDepositReview?.overdue_transit_batch_count ?? 0);
    const attentionItems = [
        {
            key: 'variance',
            show: Number(varianceReview.variance_count ?? 0) > 0,
            title: 'Cash close variance',
            detail: latestDayClose?.branch_name
                ? `${latestDayClose.branch_name}${latestDayClose.business_date ? ` on ${formatShortDate(latestDayClose.business_date)}` : ''}`
                : 'Recent branch close',
            value: formatMoney(Number(varianceReview.variance_amount ?? 0)),
        },
        {
            key: 'transit',
            show: overdueTreasuryDepositCount > 0,
            title: 'Deposits awaiting clearance',
            detail: safeDepositReview.top_issue || 'Safe handovers or in-transit deposits are still open.',
            value: formatMoney(
                Number(safeDepositReview.overdue_safe_handover_amount ?? 0) + Number(safeDepositReview.overdue_transit_amount ?? 0),
            ),
        },
        {
            key: 'merchant',
            show: merchantClearingBalance > 0,
            title: 'Merchant settlement pending',
            detail:
                merchantSettlementSummary.top_delayed_channel_label
                    ? `${merchantSettlementSummary.top_delayed_channel_label} backlog needs settlement follow-up.`
                    : 'Card and wallet receipts are still waiting for settlement.',
            value: formatMoney(merchantClearingBalance),
        },
        {
            key: 'exception',
            show: Number(treasuryExceptionSummary.active_count ?? 0) > 0,
            title: 'Treasury exceptions open',
            detail: `${Number(treasuryExceptionSummary.active_count ?? 0)} item(s) still need assignment or closure.`,
            value: formatMoney(Number(treasuryExceptionSummary.blocker_amount ?? 0)),
        },
    ].filter((item) => item.show);

    const loadLedger = useCallback(async (account: BankRow) => {
        setLedgerLoading(true);
        try {
            const response = await accountingApi.getGeneralLedger(account.id, {
                branch_id: account.branchId || undefined,
            });

            const rows = (response?.transactions || []).map((row: any) => ({
                id: `${row.journal_id}-${row.id}`,
                date: row.date,
                description: row.description || 'Journal Entry',
                source: inferSourceLabel(row),
                debit: Number(row.debit || 0),
                credit: Number(row.credit || 0),
                runningBalance: Number(row.running_balance || 0),
                accountName: account.bankName,
                branchName: account.branchName,
            })) as LedgerRow[];

            setLedgerRows(rows);
        } catch (error: any) {
            console.error(error);
            setLedgerRows([]);
            toast.error('Ledger Unavailable', error?.message || 'Could not load treasury ledger.');
        } finally {
            setLedgerLoading(false);
        }
    }, []);

    const recentTransactions = useMemo(() => ledgerRows.slice(0, 5), [ledgerRows]);
    const movementEligibleAccounts = useMemo(
        () => filteredBanks.filter((account) => account.isActive),
        [filteredBanks],
    );
    const bankOnlyAccounts = useMemo(
        () => filteredBanks.filter((account) => account.isActive && account.accountType === 'bank'),
        [filteredBanks],
    );
    const movementSourceOptions = useMemo(() => {
        return movementEligibleAccounts
            .filter((account) => {
                if (movementForm.movement_type === 'cash_to_safe') return account.accountType === 'cash';
                if (movementForm.movement_type === 'cash_to_bank') return account.accountType === 'cash' || account.accountType === 'safe';
                if (movementForm.movement_type === 'cash_deposit_to_transit') return account.accountType === 'cash' || account.accountType === 'safe';
                if (movementForm.movement_type === 'transit_to_bank') return account.accountType === 'transit';
                if (movementForm.movement_type === 'bank_to_cash') return account.accountType === 'bank';
                return true;
            })
            .map((account) => ({
                value: String(account.id),
                label: `${account.accountCode} · ${account.bankName}`,
            }));
    }, [movementEligibleAccounts, movementForm.movement_type]);
    const movementDestinationOptions = useMemo(() => {
        return movementEligibleAccounts
            .filter((account) => {
                if (movementForm.movement_type === 'cash_to_safe') return account.accountType === 'safe';
                if (movementForm.movement_type === 'cash_to_bank') return account.accountType === 'bank';
                if (movementForm.movement_type === 'cash_deposit_to_transit') return account.accountType === 'transit';
                if (movementForm.movement_type === 'transit_to_bank') return account.accountType === 'bank';
                if (movementForm.movement_type === 'bank_to_cash') return account.accountType === 'cash';
                return true;
            })
            .map((account) => ({
                value: String(account.id),
                label: `${account.accountCode} · ${account.bankName}`,
            }));
    }, [movementEligibleAccounts, movementForm.movement_type]);
    const selectedMovementSourceAccount = useMemo(
        () => movementEligibleAccounts.find((account) => String(account.id) === movementForm.source_account_id) ?? null,
        [movementEligibleAccounts, movementForm.source_account_id],
    );
    const safeDepositHandoverOptions = useMemo(() => {
        if (!(movementForm.movement_type === 'cash_deposit_to_transit' && selectedMovementSourceAccount?.accountType === 'safe')) {
            return [];
        }
        return openSafeHandovers.filter((row: any) => String(row.safe_account_id) === String(selectedMovementSourceAccount.id));
    }, [movementForm.movement_type, openSafeHandovers, selectedMovementSourceAccount]);
    const selectedHandoverTotal = useMemo(
        () => safeDepositHandoverOptions
            .filter((row: any) => movementForm.handover_journal_entry_ids.includes(String(row.journal_entry_id)))
            .reduce((sum: number, row: any) => sum + Number(row.remaining_amount ?? 0), 0),
        [movementForm.handover_journal_entry_ids, safeDepositHandoverOptions],
    );
    const transitDepositBatchOptions = useMemo(() => {
        if (!(movementForm.movement_type === 'transit_to_bank' && selectedMovementSourceAccount?.accountType === 'transit')) {
            return [];
        }
        return openTransitDepositBatches;
    }, [movementForm.movement_type, openTransitDepositBatches, selectedMovementSourceAccount]);
    const selectedDepositBatchTotal = useMemo(
        () => transitDepositBatchOptions
            .filter((row: any) => movementForm.deposit_entry_ids.includes(String(row.deposit_entry_id)))
            .reduce((sum: number, row: any) => sum + Number(row.remaining_in_transit_amount ?? 0), 0),
        [movementForm.deposit_entry_ids, transitDepositBatchOptions],
    );

    useEffect(() => {
        if (!(showMovementModal && movementForm.movement_type === 'transit_to_bank' && selectedMovementSourceAccount?.accountType === 'transit')) {
            return;
        }
        if (movementForm.deposit_entry_ids.length > 0) {
            return;
        }
        const targetAmount = Number(movementForm.amount || 0);
        if (!(targetAmount > 0)) {
            return;
        }

        let remaining = targetAmount;
        const suggestedIds: string[] = [];
        for (const row of transitDepositBatchOptions) {
            const availableAmount = Number(row.remaining_in_transit_amount ?? 0);
            if (!(availableAmount > 0)) {
                continue;
            }
            suggestedIds.push(String(row.deposit_entry_id));
            remaining -= availableAmount;
            if (remaining <= 0) {
                break;
            }
        }

        if (suggestedIds.length > 0) {
            setMovementForm((current) => (
                current.deposit_entry_ids.length > 0
                    ? current
                    : { ...current, deposit_entry_ids: suggestedIds }
            ));
        }
    }, [
        movementForm.amount,
        movementForm.deposit_entry_ids.length,
        movementForm.movement_type,
        selectedMovementSourceAccount,
        showMovementModal,
        transitDepositBatchOptions,
    ]);

    useEffect(() => {
        const firstVisible = filteredBanks[0];
        if (!firstVisible) {
            setLedgerRows([]);
            return;
        }
        void loadLedger(firstVisible);
    }, [filteredBanks, loadLedger]);

    const openCreateModal = () => {
        if (!canManageBankSetup) {
            toast.error('Access Restricted', 'Your current branch role cannot add treasury accounts.');
            return;
        }
        const branchScoped = selectedBranch !== 'all' ? selectedBranch : 'all';
        setEditingBank(null);
        setForm({
            ...EMPTY_FORM,
            branch_id: branchScoped,
            account_code: `11${String(accounts.length + 3).padStart(2, '0')}`,
        });
        setShowModal(true);
    };

    const openEditModal = (bank: BankRow) => {
        if (!canManageBankSetup) {
            toast.error('Access Restricted', 'Your current branch role cannot edit treasury accounts.');
            return;
        }
        if (bank.accountType !== 'bank') {
            toast.error('Bank-Linked Treasury Only', 'This edit form is currently for bank-linked treasury accounts only.');
            return;
        }
        setEditingBank(bank);
        setForm(toForm(bank));
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBank(null);
        setForm(EMPTY_FORM);
    };

    const openMovementModal = () => {
        if (!canPostTreasuryActivity) {
            toast.error('Access Restricted', 'Your current branch role cannot post treasury movements.');
            return;
        }
        if (selectedBranch === 'all') {
            toast.error('Select Branch', 'Choose a branch first so treasury movement posts to the correct branch ledger.');
            return;
        }
        setMovementForm({
            ...EMPTY_MOVEMENT_FORM,
            date: new Date().toISOString().slice(0, 10),
        });
        setShowMovementModal(true);
    };

    const closeMovementModal = () => {
        setShowMovementModal(false);
        setMovementForm(EMPTY_MOVEMENT_FORM);
    };

    const openMerchantSettlementModal = () => {
        if (!canPostTreasuryActivity) {
            toast.error('Access Restricted', 'Your current branch role cannot post merchant settlements.');
            return;
        }
        if (selectedBranch === 'all') {
            toast.error('Select Branch', 'Choose a branch first so merchant settlement posts to the correct branch ledger.');
            return;
        }
        setMerchantSettlementForm({
            ...EMPTY_MERCHANT_SETTLEMENT_FORM,
            date: new Date().toISOString().slice(0, 10),
            bank_account_id: bankOnlyAccounts[0] ? String(bankOnlyAccounts[0].id) : '',
        });
        setShowMerchantSettlementModal(true);
    };

    const closeMerchantSettlementModal = () => {
        setShowMerchantSettlementModal(false);
        setMerchantSettlementForm(EMPTY_MERCHANT_SETTLEMENT_FORM);
    };

    const openTreasuryExceptionModal = (item: any) => {
        if (!canManageTreasuryExceptions) {
            toast.error('Access Restricted', 'Your current branch role cannot update treasury exceptions.');
            return;
        }
        setSelectedTreasuryException(item);
        setTreasuryExceptionForm({
            status: item?.workflow_status ?? 'open',
            owner_name: item?.owner_name ?? '',
            notes: item?.notes ?? '',
        });
        setShowTreasuryExceptionModal(true);
    };

    const closeTreasuryExceptionModal = () => {
        setShowTreasuryExceptionModal(false);
        setSelectedTreasuryException(null);
        setTreasuryExceptionForm(EMPTY_TREASURY_EXCEPTION_FORM);
    };

    const handleSave = async () => {
        if (!canManageBankSetup) {
            toast.error('Access Restricted', 'Your current branch role cannot save treasury accounts.');
            return;
        }
        if (!form.branch_id) {
            toast.error('Branch Scope Required', 'Select the branch scope to continue.');
            return;
        }
        if (!form.bank_name.trim()) {
            toast.error('Institution Name Required', 'Enter the institution or bank name to continue.');
            return;
        }
        if (!form.account_title.trim()) {
            toast.error('Account Title Required', 'Enter the account title to continue.');
            return;
        }
        if (!form.account_number_iban.trim()) {
            toast.error('Account Number / IBAN Required', 'Enter the account number or IBAN to continue.');
            return;
        }
        if (!form.currency_code.trim()) {
            toast.error('Currency Required', 'Enter the currency to continue.');
            return;
        }
        if (!form.description.trim()) {
            toast.error('Description Required', 'Enter a description to continue.');
            return;
        }
        if (!form.account_code.trim()) {
            toast.error('Account Code Required', 'The system could not generate an account code.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                account_code: form.account_code.trim(),
                account_name: composeBankAccountName(form.bank_name, form.account_title),
                account_type: 'asset',
                scope: form.branch_id === 'all' ? 'company' : 'branch',
                branch_id: form.branch_id === 'all' ? null : Number(form.branch_id),
                bank_name: form.bank_name.trim(),
                treasury_institution_name: form.bank_name.trim(),
                account_title: form.account_title.trim(),
                treasury_account_title: form.account_title.trim(),
                account_number_iban: form.account_number_iban.trim(),
                treasury_reference_no_iban: form.account_number_iban.trim(),
                currency_code: form.currency_code.trim().toUpperCase(),
                treasury_currency_code: form.currency_code.trim().toUpperCase(),
                bank_account_type: 'current',
                treasury_account_type: 'current',
                description: form.description.trim(),
                is_active: form.is_active,
                schedule_code: 'BS_CASH',
                allow_manual_posting: true,
                is_control_account: false,
                is_bank_account: true,
                is_cash_account: false,
            };

            if (editingBank) {
                await accountingApi.updateAccount(editingBank.id, payload);
                toast.success('Treasury Account Updated', 'Changes were saved.');
            } else {
                await accountingApi.createAccount(payload);
                toast.success('Treasury Account Added', 'Live treasury account created successfully.');
            }

            closeModal();
            await loadData();
        } catch (error: any) {
            console.error(error);
            toast.error('Save Failed', error?.message || 'Could not save treasury account.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePostMovement = async () => {
        if (!canPostTreasuryActivity) {
            toast.error('Access Restricted', 'Your current branch role cannot post treasury movements.');
            return;
        }
        if (selectedBranch === 'all') {
            toast.error('Select Branch', 'Treasury movements require a branch scope.');
            return;
        }
        if (!movementForm.source_account_id || !movementForm.destination_account_id) {
            toast.error('Treasury Accounts Required', 'Select both source and destination treasury accounts.');
            return;
        }
        if (!movementForm.amount || Number(movementForm.amount) <= 0) {
            toast.error('Amount Required', 'Enter a valid treasury movement amount.');
            return;
        }

        setIsPostingMovement(true);
        try {
            await accountingApi.createTreasuryMovement({
                branch_id: Number(selectedBranch),
                movement_type: movementForm.movement_type,
                source_account_id: Number(movementForm.source_account_id),
                destination_account_id: Number(movementForm.destination_account_id),
                handover_journal_entry_ids:
                    movementForm.movement_type === 'cash_deposit_to_transit' && selectedMovementSourceAccount?.accountType === 'safe'
                        ? movementForm.handover_journal_entry_ids.map((value) => Number(value))
                        : undefined,
                deposit_entry_ids:
                    movementForm.movement_type === 'transit_to_bank' && selectedMovementSourceAccount?.accountType === 'transit'
                        ? movementForm.deposit_entry_ids.map((value) => Number(value))
                        : undefined,
                amount: Number(movementForm.amount),
                date: movementForm.date,
                description: movementForm.description.trim() || undefined,
                reference_no: movementForm.reference_no.trim() || undefined,
            });
            toast.success('Treasury Movement Posted', 'The treasury movement has been posted to the branch ledger.');
            closeMovementModal();
            await loadData(selectedBranch);
        } catch (error: any) {
            console.error(error);
            toast.error('Posting Failed', error?.message || 'Could not post treasury movement.');
        } finally {
            setIsPostingMovement(false);
        }
    };

    const handlePostMerchantSettlement = async () => {
        if (!canPostTreasuryActivity) {
            toast.error('Access Restricted', 'Your current branch role cannot post merchant settlements.');
            return;
        }
        if (selectedBranch === 'all') {
            toast.error('Select Branch', 'Merchant settlement requires a branch scope.');
            return;
        }
        if (!merchantSettlementForm.bank_account_id) {
            toast.error('Settlement Account Required', 'Select the treasury bank account receiving the merchant settlement.');
            return;
        }
        if (!merchantSettlementForm.gross_amount || Number(merchantSettlementForm.gross_amount) <= 0) {
            toast.error('Gross Amount Required', 'Enter a valid merchant settlement gross amount.');
            return;
        }
        if (Number(merchantSettlementForm.charges_amount || 0) < 0) {
            toast.error('Invalid Charges', 'Charges cannot be negative.');
            return;
        }
        if (Number(merchantSettlementForm.charges_amount || 0) > Number(merchantSettlementForm.gross_amount || 0)) {
            toast.error('Invalid Charges', 'Charges cannot exceed the gross settlement amount.');
            return;
        }

        setIsPostingMerchantSettlement(true);
        try {
            await accountingApi.createMerchantSettlement({
                branch_id: Number(selectedBranch),
                channel: merchantSettlementForm.channel,
                bank_account_id: Number(merchantSettlementForm.bank_account_id),
                gross_amount: Number(merchantSettlementForm.gross_amount),
                charges_amount: Number(merchantSettlementForm.charges_amount || 0),
                date: merchantSettlementForm.date,
                provider_name: merchantSettlementForm.provider_name.trim() || undefined,
                reference_no: merchantSettlementForm.reference_no.trim() || undefined,
                description: merchantSettlementForm.description.trim() || undefined,
            });
            toast.success('Merchant Settlement Posted', 'Gross receipt, charges, and net bank settlement were posted successfully.');
            closeMerchantSettlementModal();
            await loadData(selectedBranch);
        } catch (error: any) {
            console.error(error);
            toast.error('Posting Failed', error?.message || 'Could not post merchant settlement.');
        } finally {
            setIsPostingMerchantSettlement(false);
        }
    };

    const handleSaveTreasuryException = async () => {
        if (!canManageTreasuryExceptions) {
            toast.error('Access Restricted', 'Your current branch role cannot update treasury exceptions.');
            return;
        }
        if (!selectedTreasuryException) {
            return;
        }
        if (['resolved', 'waived'].includes(treasuryExceptionForm.status) && !treasuryExceptionForm.notes.trim()) {
            toast.error('Resolution Note Required', 'Add a note when resolving or waiving a treasury exception.');
            return;
        }

        setIsSavingTreasuryException(true);
        try {
            await accountingApi.upsertTreasuryException({
                branch_id: Number(selectedTreasuryException.branch_id),
                exception_type: selectedTreasuryException.exception_type,
                exception_key: selectedTreasuryException.exception_key,
                status: treasuryExceptionForm.status,
                owner_name: treasuryExceptionForm.owner_name.trim() || undefined,
                notes: treasuryExceptionForm.notes.trim() || undefined,
            });
            toast.success('Treasury Exception Updated', 'Treasury follow-up status was updated successfully.');
            closeTreasuryExceptionModal();
            await loadData(selectedBranch);
        } catch (error: any) {
            console.error(error);
            toast.error('Update Failed', error?.message || 'Could not update treasury exception status.');
        } finally {
            setIsSavingTreasuryException(false);
        }
    };

    return (
        <div className={`${styles.container} ${styles.treasuryPage}`}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Landmark size={18} /></div>
                    <div>
                        <h1>Treasury Accounts</h1>
                        <p>Live treasury balances for banks, cash counters, and petty cash.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect
                            options={branchOptions}
                            value={selectedBranch}
                            onChange={(event) => {
                                const value = event.target.value;
                                setSelectedBranch(value);
                                if (value === 'all') {
                                    return;
                                }
                                localStorage.setItem('activeBranchId', value);
                                localStorage.setItem('branch_id', value);
                                const match = branchOptions.find((option) => option.value === value);
                                if (match?.label) {
                                    localStorage.setItem('branch_name', match.label);
                                }
                            }}
                        />
                    </div>
                    <KitchenButton variant="primary" size="sm" onClick={openCreateModal} disabled={!canManageBankSetup}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Add Treasury Account
                    </KitchenButton>
                    <KitchenButton variant="secondary" size="sm" onClick={openMovementModal} disabled={!canPostTreasuryActivity}>
                        <ArrowUpRight size={14} style={{ marginRight: 6 }} /> Post Movement
                    </KitchenButton>
                    <KitchenButton variant="secondary" size="sm" onClick={openMerchantSettlementModal} disabled={!canPostTreasuryActivity}>
                        <Wallet size={14} style={{ marginRight: 6 }} /> Post Merchant Settlement
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Treasury</span>
                    <h3 className={styles.summaryValue}>{formatMoney(totalBalance)}</h3>
                    <span className={styles.summaryMeta}>All active treasury balances in the selected branch scope.</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Bank Balance</span>
                    <h3 className={[styles.summaryValue, styles.colorInfo].join(' ')}>{formatMoney(Number(summary.total_bank_balance ?? 0))}</h3>
                    <span className={styles.summaryMeta}>{activeTreasuryAccountCount} active treasury account(s).</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Cash On Hand</span>
                    <h3 className={[styles.summaryValue, styles.colorSuccess].join(' ')}>{formatMoney(cashOnHandBalance)}</h3>
                    <span className={styles.summaryMeta}>{cashCounterCount} counter(s), {safeAccountCount} safe(s), and petty cash balances.</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Deposits In Transit</span>
                    <h3 className={[styles.summaryValue, styles.colorInfo].join(' ')}>{formatMoney(depositsInTransitBalance)}</h3>
                    <span className={styles.summaryMeta}>{transitAccountCount} transit account(s) still waiting for bank clearance.</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Merchant Clearing</span>
                    <h3 className={[styles.summaryValue, merchantClearingBalance === 0 ? styles.colorSuccess : styles.colorInfo].join(' ')}>{formatMoney(merchantClearingBalance)}</h3>
                    <span className={styles.summaryMeta}>Card and wallet settlements still waiting to clear to bank.</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Branches Covered</span>
                    <h3 className={[styles.summaryValue, styles.colorInfo].join(' ')}>{linkedBranches}</h3>
                    <span className={styles.summaryMeta}>
                        {latestDayClose?.business_date
                            ? 'Latest close on ' + formatShortDate(latestDayClose.business_date) + '.'
                            : 'No recent branch close found in this scope.'}
                    </span>
                </div>
            </div>

            <div className={styles.polishedPanel}>
                <div className={styles.panelHeader}>
                    <h3>Attention Items</h3>
                    <span className={styles.panelMeta}>{attentionItems.length} item(s) need follow-up</span>
                </div>
                {attentionItems.length > 0 ? (
                    <div className={styles.movementMixList}>
                        {attentionItems.map((item) => (
                            <div key={item.key} className={styles.movementMixRow}>
                                <div>
                                    <strong>{item.title}</strong>
                                    <span>{item.detail}</span>
                                </div>
                                <span>{item.value}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyInline}>
                        No material treasury follow-up is open right now. Account balances and recent activity are shown below.
                    </div>
                )}
            </div>
            <div className={styles.twoColumnGrid}>
                <div className={[styles.polishedPanel, styles.bankListPanel].join(' ')}>
                    <div className={styles.panelHeader}>
                        <h3>Treasury Account Register</h3>
                        <span className={styles.panelMeta}>{filteredBanks.length} visible account(s)</span>
                    </div>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Purpose</th>
                                    <th>Branch</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Available Balance</th>
                                    <th style={{ width: 72, textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBanks.map((bank) => (
                                    <tr key={bank.id} className={[styles.tableRow, !bank.isActive ? styles.inactiveRow : ''].filter(Boolean).join(' ')}>
                                        <td>
                                            <div className={styles.cellMain}>
                                                <div className={styles.bankLogo}>{bank.bankName.charAt(0)}</div>
                                                <div className={styles.bankNameCol}>
                                                    <span className={styles.bankName}>{bank.bankName}</span>
                                                    <span className={styles.bankAccNum}>{bank.accountCode}</span>
                                                    {bank.accountTitle && bank.accountTitle !== bank.bankName && (
                                                        <span className={styles.accountMetaLine}>{bank.accountTitle}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.cellSub}>
                                                <span className={styles.bankTitle}>
                                                    {bank.isPettyCash
                                                        ? 'Petty Cash'
                                                        : bank.accountType === 'bank'
                                                            ? 'Operating Bank Account'
                                                            : bank.accountType === 'transit'
                                                                ? 'Deposit In Transit'
                                                                : bank.accountType === 'safe'
                                                                    ? 'Branch Safe'
                                                                    : 'Cash Counter'}
                                                </span>
                                                <span className={[styles.typeBadge, bank.accountType === 'bank' || bank.accountType === 'transit' ? styles.typeCurrent : styles.typeSavings].join(' ')}>
                                                    {bank.isPettyCash ? 'petty cash' : bank.accountType}
                                                </span>
                                            </div>
                                        </td>
                                        <td><span className={styles.cellText}>{bank.branchName}</span></td>
                                        <td>
                                            <span className={[styles.statusBadge, bank.isActive ? styles.statusActive : styles.statusInactive].join(' ')}>
                                                {bank.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className={styles.amountCell}>
                                            <strong className={styles.bankBalance}>{formatMoney(bank.balance)}</strong>
                                        </td>
                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button
                                                    className={styles.actionBtn}
                                                    title="View Ledger"
                                                    onClick={() => {
                                                        setEditingBank(bank);
                                                        setShowLedgerModal(true);
                                                        void loadLedger(bank);
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    className={styles.actionBtn}
                                                    title={bank.accountType === 'bank' ? 'Edit' : 'Edit treasury accounts only'}
                                                    onClick={() => openEditModal(bank)}
                                                    disabled={!canManageBankSetup || bank.accountType !== 'bank'}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredBanks.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                            No treasury accounts were found for the selected branch scope.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={[styles.polishedPanel, styles.recentPanel].join(' ')}>
                    <div className={styles.panelHeader}>
                        <h3>Recent Activity</h3>
                        <span className={styles.panelMeta}>{viewingLedgerBank?.bankName || filteredBanks[0]?.bankName || 'No account selected'}</span>
                    </div>
                    <div className={styles.recentList}>
                        {recentTransactions.map((txn) => {
                            const isCredit = txn.credit > 0;
                            const amount = isCredit ? txn.credit : txn.debit;
                            return (
                                <div key={txn.id} className={styles.recentRow}>
                                    <div
                                        className={styles.recentIcon}
                                        style={{
                                            background: isCredit
                                                ? 'color-mix(in srgb, var(--alert-success-text, #22c55e) 15%, transparent)'
                                                : 'color-mix(in srgb, var(--danger, #ef4444) 15%, transparent)',
                                            color: isCredit ? 'var(--alert-success-text, #22c55e)' : 'var(--danger, #ef4444)',
                                        }}
                                    >
                                        {isCredit ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                    </div>
                                    <div className={styles.recentInfo}>
                                        <span className={styles.recentDesc}>{txn.description}</span>
                                        <span className={styles.recentMeta}>{txn.source} ? {formatShortDate(txn.date)}</span>
                                    </div>
                                    <span className={[styles.recentAmount, isCredit ? styles.credit : styles.debit].join(' ')}>
                                        {isCredit ? '+' : '-'}{formatMoney(amount)}
                                    </span>
                                </div>
                            );
                        })}
                        {!ledgerLoading && recentTransactions.length === 0 && (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 4px' }}>
                                No recent ledger activity was found for the selected treasury scope.
                            </div>
                        )}
                        {ledgerLoading && (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 4px' }}>
                                Loading treasury activity...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingBank ? 'Edit Treasury Account' : 'Add Treasury Account'}</h2>
                            <button className={styles.closeBtn} onClick={closeModal}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Branch Scope</label>
                                    <KitchenSelect
                                        options={branchOptions}
                                        value={form.branch_id}
                                        onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Institution / Bank Name</label>
                                    <KitchenInput
                                        placeholder="e.g. Meezan Bank"
                                        list="bank-name-suggestions"
                                        value={form.bank_name}
                                        onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))}
                                    />
                                    {bankNameSuggestions.length > 0 && (
                                        <datalist id="bank-name-suggestions">
                                            {bankNameSuggestions.map((bankName) => (
                                                <option key={bankName} value={bankName} />
                                            ))}
                                        </datalist>
                                    )}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Account Title</label>
                                    <KitchenInput
                                        placeholder="e.g. Operating Account"
                                        value={form.account_title}
                                        onChange={(event) => setForm((current) => ({ ...current, account_title: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Account Number / IBAN / Reference</label>
                                    <KitchenInput
                                        placeholder="e.g. PK36SCBL0000001123456702"
                                        value={form.account_number_iban}
                                        onChange={(event) => setForm((current) => ({ ...current, account_number_iban: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Currency</label>
                                    <KitchenInput
                                        placeholder="e.g. PKR"
                                        value={form.currency_code}
                                        onChange={(event) => setForm((current) => ({ ...current, currency_code: event.target.value.toUpperCase() }))}
                                        maxLength={10}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Status</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'active', label: 'Active' },
                                            { value: 'inactive', label: 'Inactive' },
                                        ]}
                                        value={form.is_active ? 'active' : 'inactive'}
                                        onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'active' }))}
                                    />
                                </div>
                                <div className={`${styles.formGroup} ${styles.fullSpan}`}>
                                    <label>Description</label>
                                    <textarea
                                        className={styles.textarea}
                                        rows={4}
                                        placeholder="Purpose, branch usage, bank relationship, or operating note"
                                        value={form.description}
                                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={closeModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handleSave()} isLoading={isSaving}>
                                {editingBank ? 'Save Changes' : 'Add Account'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showMovementModal && (
                <div className={styles.modalOverlay} onClick={closeMovementModal}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Post Treasury Movement</h2>
                            <button className={styles.closeBtn} onClick={closeMovementModal}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Movement Type</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'cash_to_safe', label: 'Cash Handover to Safe' },
                                            { value: 'cash_to_bank', label: 'Cash to Bank Deposit' },
                                            { value: 'cash_deposit_to_transit', label: 'Deposit Sent to Bank (In Transit)' },
                                            { value: 'transit_to_bank', label: 'Deposit Cleared to Bank' },
                                            { value: 'bank_to_cash', label: 'Bank to Cash Withdrawal' },
                                            { value: 'treasury_transfer', label: 'Treasury Transfer' },
                                        ]}
                                        value={movementForm.movement_type}
                                        onChange={(event) => setMovementForm((current) => ({
                                            ...current,
                                            movement_type: event.target.value as TreasuryMovementFormState['movement_type'],
                                            source_account_id: '',
                                            destination_account_id: '',
                                            handover_journal_entry_ids: [],
                                            deposit_entry_ids: [],
                                        }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Date</label>
                                    <KitchenInput
                                        type="date"
                                        value={movementForm.date}
                                        onChange={(event) => setMovementForm((current) => ({ ...current, date: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Source Account</label>
                                    <KitchenSelect
                                        options={movementSourceOptions}
                                        value={movementForm.source_account_id}
                                        onChange={(event) => setMovementForm((current) => ({
                                            ...current,
                                            source_account_id: event.target.value,
                                            handover_journal_entry_ids: [],
                                            deposit_entry_ids: [],
                                        }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Destination Account</label>
                                    <KitchenSelect
                                        options={movementDestinationOptions}
                                        value={movementForm.destination_account_id}
                                        onChange={(event) => setMovementForm((current) => ({ ...current, destination_account_id: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Amount</label>
                                    <KitchenInput
                                        type="number"
                                        placeholder="0.00"
                                        value={movementForm.amount}
                                        onChange={(event) => setMovementForm((current) => ({ ...current, amount: event.target.value }))}
                                    />
                                </div>
                                {movementForm.movement_type === 'cash_deposit_to_transit' && selectedMovementSourceAccount?.accountType === 'safe' && (
                                    <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                        <label>Linked Safe Handovers</label>
                                        <div className={styles.selectionSummary}>
                                            <span>{movementForm.handover_journal_entry_ids.length} selected</span>
                                            <strong>{formatMoney(selectedHandoverTotal)}</strong>
                                        </div>
                                        <div className={styles.selectionList}>
                                            {safeDepositHandoverOptions.map((row: any) => {
                                                const selected = movementForm.handover_journal_entry_ids.includes(String(row.journal_entry_id));
                                                return (
                                                    <button
                                                        key={`handover-select-${row.journal_entry_id}`}
                                                        type="button"
                                                        className={`${styles.selectionRow} ${selected ? styles.selectionRowActive : ''}`}
                                                        onClick={() => setMovementForm((current) => ({
                                                            ...current,
                                                            handover_journal_entry_ids: selected
                                                                ? current.handover_journal_entry_ids.filter((value) => value !== String(row.journal_entry_id))
                                                                : [...current.handover_journal_entry_ids, String(row.journal_entry_id)],
                                                        }))}
                                                    >
                                                        <div>
                                                            <strong>{row.reference_id || row.description || `Handover ${row.journal_entry_id}`}</strong>
                                                            <span>{row.source_account_code} {row.source_account_name} · {formatShortDate(row.transaction_date)}</span>
                                                        </div>
                                                        <strong>{formatMoney(Number(row.remaining_amount ?? 0))}</strong>
                                                    </button>
                                                );
                                            })}
                                            {safeDepositHandoverOptions.length === 0 && (
                                                <div className={styles.emptyInline}>No open safe handovers are available for the selected branch safe.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {movementForm.movement_type === 'transit_to_bank' && selectedMovementSourceAccount?.accountType === 'transit' && (
                                    <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                        <label>Linked Deposit Batches</label>
                                        <div className={styles.selectionSummary}>
                                            <span>{movementForm.deposit_entry_ids.length} selected</span>
                                            <strong>{formatMoney(selectedDepositBatchTotal)}</strong>
                                        </div>
                                        <div className={styles.selectionList}>
                                            {transitDepositBatchOptions.map((row: any) => {
                                                const selected = movementForm.deposit_entry_ids.includes(String(row.deposit_entry_id));
                                                return (
                                                    <button
                                                        key={`deposit-batch-select-${row.deposit_entry_id}`}
                                                        type="button"
                                                        className={`${styles.selectionRow} ${selected ? styles.selectionRowActive : ''}`}
                                                        onClick={() => setMovementForm((current) => ({
                                                            ...current,
                                                            deposit_entry_ids: selected
                                                                ? current.deposit_entry_ids.filter((value) => value !== String(row.deposit_entry_id))
                                                                : [...current.deposit_entry_ids, String(row.deposit_entry_id)],
                                                        }))}
                                                    >
                                                        <div>
                                                            <strong>{row.reference_id || row.description || `Deposit ${row.deposit_entry_id}`}</strong>
                                                            <span>{row.source_safe_account_code} {row.source_safe_account_name} / {formatShortDate(row.transaction_date)}</span>
                                                        </div>
                                                        <strong>{formatMoney(Number(row.remaining_in_transit_amount ?? 0))}</strong>
                                                    </button>
                                                );
                                            })}
                                            {transitDepositBatchOptions.length === 0 && (
                                                <div className={styles.emptyInline}>No open in-transit deposit batches are waiting for bank clearance in this scope.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className={styles.formGroup}>
                                    <label>Reference</label>
                                    <KitchenInput
                                        placeholder="Deposit slip / cheque / transfer ref"
                                        value={movementForm.reference_no}
                                        onChange={(event) => setMovementForm((current) => ({ ...current, reference_no: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Description</label>
                                    <KitchenInput
                                        placeholder="Reason for treasury movement"
                                        value={movementForm.description}
                                        onChange={(event) => setMovementForm((current) => ({ ...current, description: event.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className={styles.emptyInline}>
                                {movementForm.movement_type === 'cash_to_safe'
                                    ? 'This posts `Branch Safe Dr` and reduces the selected cash counter source. Use it when drawer cash is handed into branch-safe custody before deposit or reuse.'
                                    : movementForm.movement_type === 'cash_deposit_to_transit'
                                    ? selectedMovementSourceAccount?.accountType === 'safe'
                                        ? `This posts \`Bank Deposits In Transit Dr\` from the selected branch safe and links the deposit to the selected handover source documents. Selected handover value: ${formatMoney(selectedHandoverTotal)}.`
                                        : 'This posts `Bank Deposits In Transit Dr` and reduces the selected cash treasury source. Use it when cash has left the branch but is not yet on the bank statement.'
                                    : movementForm.movement_type === 'transit_to_bank'
                                        ? `This clears the selected in-transit deposit batches into the destination treasury account. Selected batch value: ${formatMoney(selectedDepositBatchTotal)}.`
                                        : 'This posts a balanced treasury journal between two selected treasury accounts in the current branch scope.'}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={closeMovementModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handlePostMovement()} isLoading={isPostingMovement}>
                                Post Movement
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showMerchantSettlementModal && (
                <div className={styles.modalOverlay} onClick={closeMerchantSettlementModal}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Post Merchant Settlement</h2>
                            <button className={styles.closeBtn} onClick={closeMerchantSettlementModal}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Channel</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'card', label: 'Card' },
                                            { value: 'digital_wallet', label: 'Digital Wallet' },
                                            { value: 'other', label: 'Other Merchant' },
                                        ]}
                                        value={merchantSettlementForm.channel}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, channel: event.target.value as MerchantSettlementFormState['channel'] }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Settlement Date</label>
                                    <KitchenInput
                                        type="date"
                                        value={merchantSettlementForm.date}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, date: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Bank Account</label>
                                    <KitchenSelect
                                        options={bankOnlyAccounts.map((account) => ({ value: String(account.id), label: `${account.accountCode} · ${account.bankName}` }))}
                                        value={merchantSettlementForm.bank_account_id}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, bank_account_id: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Provider</label>
                                    <KitchenInput
                                        placeholder="e.g. HBL POS / JazzCash"
                                        value={merchantSettlementForm.provider_name}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, provider_name: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Gross Amount</label>
                                    <KitchenInput
                                        type="number"
                                        placeholder="0.00"
                                        value={merchantSettlementForm.gross_amount}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, gross_amount: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Charges / MDR</label>
                                    <KitchenInput
                                        type="number"
                                        placeholder="0.00"
                                        value={merchantSettlementForm.charges_amount}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, charges_amount: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Reference No</label>
                                    <KitchenInput
                                        placeholder="Statement / settlement ref"
                                        value={merchantSettlementForm.reference_no}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, reference_no: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Description</label>
                                    <KitchenInput
                                        placeholder="Optional merchant settlement note"
                                        value={merchantSettlementForm.description}
                                        onChange={(event) => setMerchantSettlementForm((current) => ({ ...current, description: event.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className={styles.emptyInline}>
                                Net bank receipt: {formatMoney(Math.max(Number(merchantSettlementForm.gross_amount || 0) - Number(merchantSettlementForm.charges_amount || 0), 0))}. This posts `Bank Dr`, `Bank Charges Dr`, `Merchant Clearing Cr`.
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={closeMerchantSettlementModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handlePostMerchantSettlement()} isLoading={isPostingMerchantSettlement}>
                                Post Settlement
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showTreasuryExceptionModal && selectedTreasuryException && (
                <div className={styles.modalOverlay} onClick={closeTreasuryExceptionModal}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Treasury Exception Follow-Up</h2>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    {selectedTreasuryException.label} · {selectedTreasuryException.reference_label || 'No reference'}
                                </p>
                            </div>
                            <button className={styles.closeBtn} onClick={closeTreasuryExceptionModal}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.selectionSummary}>
                                <span>{selectedTreasuryException.branch_name || 'Branch'}</span>
                                <strong>{formatMoney(Number(selectedTreasuryException.amount ?? 0))}</strong>
                            </div>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Status</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'open', label: 'Open' },
                                            { value: 'in_review', label: 'In Review' },
                                            { value: 'resolved', label: 'Resolved' },
                                            { value: 'waived', label: 'Waived' },
                                        ]}
                                        value={treasuryExceptionForm.status}
                                        onChange={(event) => setTreasuryExceptionForm((current) => ({
                                            ...current,
                                            status: event.target.value as TreasuryExceptionFormState['status'],
                                        }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Owner</label>
                                    <KitchenInput
                                        placeholder="Who is handling this?"
                                        value={treasuryExceptionForm.owner_name}
                                        onChange={(event) => setTreasuryExceptionForm((current) => ({ ...current, owner_name: event.target.value }))}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Follow-Up Note</label>
                                    <KitchenInput
                                        placeholder="Short resolution or review note"
                                        value={treasuryExceptionForm.notes}
                                        onChange={(event) => setTreasuryExceptionForm((current) => ({ ...current, notes: event.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className={styles.emptyInline}>
                                {['resolved', 'waived'].includes(treasuryExceptionForm.status)
                                    ? 'Resolved and waived statuses require a note so treasury closure has an audit trail.'
                                    : 'Use In Review when the exception is being worked, then close it with a note once treasury follow-up is complete.'}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={closeTreasuryExceptionModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handleSaveTreasuryException()} isLoading={isSavingTreasuryException}>
                                Save Follow-Up
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showLedgerModal && viewingLedgerBank && (
                <div className={styles.modalOverlay} onClick={() => { setShowLedgerModal(false); setEditingBank(null); }}>
                    <div className={`${styles.modal} ${styles.ledgerModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Treasury Ledger</h2>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    {viewingLedgerBank.bankName} · {viewingLedgerBank.accountCode}
                                </p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => { setShowLedgerModal(false); setEditingBank(null); }}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.ledgerHeader}>
                                <div className={styles.ledgerStat}>
                                    <span>Current Balance</span>
                                    <strong>{formatMoney(viewingLedgerBank.balance)}</strong>
                                </div>
                                <div className={styles.ledgerStat}>
                                    <span>Branch</span>
                                    <strong>{viewingLedgerBank.branchName}</strong>
                                </div>
                            </div>
                            <div className={styles.tableWrap} style={{ maxHeight: '400px' }}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 100 }}>Date</th>
                                            <th>Description</th>
                                            <th>Source</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ledgerRows.map((txn) => {
                                            const isCredit = txn.credit > 0;
                                            const amount = isCredit ? txn.credit : txn.debit;
                                            return (
                                                <tr key={txn.id} className={styles.tableRow}>
                                                    <td className={styles.cellText}>{formatShortDate(txn.date)}</td>
                                                    <td><span className={styles.cellText}>{txn.description}</span></td>
                                                    <td><span className={styles.typeBadge}>{txn.source}</span></td>
                                                    <td className={styles.amountCell}>
                                                        <span className={isCredit ? styles.credit : styles.debit}>
                                                            {isCredit ? '+' : '-'}{formatMoney(amount)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!ledgerLoading && ledgerRows.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                                    No live ledger activity found for this account.
                                                </td>
                                            </tr>
                                        )}
                                        {ledgerLoading && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                                    Loading ledger...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="primary" size="sm" onClick={() => { setShowLedgerModal(false); setEditingBank(null); }}>Close</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
