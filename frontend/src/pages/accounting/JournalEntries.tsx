/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    AlertCircle,
    Calendar,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Download,
    FileText,
    Filter,
    Lock,
    Plus,
    Search,
    X,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './JournalEntries.module.css';

type JournalSource = 'POS' | 'Payroll' | 'Inventory' | 'AP' | 'AR' | 'Manual';

interface AccountOption {
    value: string;
    label: string;
    description?: string | null;
    usageGuidance?: string | null;
    exampleEntry?: string | null;
    confusionNote?: string | null;
}

interface JournalLineForm {
    accountId: string;
    debit: string;
    credit: string;
}

interface ApiJournalItem {
    id: number;
    account_id: number;
    debit: number | string;
    credit: number | string;
    account?: {
        account_code: string;
        account_name: string;
    };
}

interface ApiJournalEntry {
    id: number;
    business_date?: string;
    transaction_date: string;
    description?: string | null;
    reference_id?: string | null;
    source_module?: string | null;
    source_event?: string | null;
    posting_type?: 'manual' | 'auto' | 'closing';
    day_close_id?: number | null;
    reversal_entry_id?: number | null;
    reversed_entry_id?: number | null;
    reversed_at?: string | null;
    reversal_reason?: string | null;
    is_locked_by_period?: boolean;
    is_accrual?: boolean;
    accrual_reversal_due_date?: string | null;
    accrual_reversal_status?: 'pending' | 'reversed' | null;
    close_adjustment_type?: 'prepaid_expense' | 'deferred_revenue' | 'depreciation' | null;
    schedule_start_date?: string | null;
    schedule_end_date?: string | null;
    items: ApiJournalItem[];
}

interface JournalEntryRow {
    id: string;
    rawId: number;
    date: string;
    businessDate: string;
    description: string;
    reference: string;
    source: JournalSource;
    totalAmount: number;
    isBalanced: boolean;
    postingType: string;
    dayCloseId?: number | null;
    reversalEntryId?: number | null;
    reversedEntryId?: number | null;
    reversedAt?: string | null;
    reversalReason?: string | null;
    isLockedByPeriod: boolean;
    isAccrual: boolean;
    accrualReversalDueDate?: string | null;
    accrualReversalStatus?: 'pending' | 'reversed' | null;
    closeAdjustmentType?: 'prepaid_expense' | 'deferred_revenue' | 'depreciation' | null;
    scheduleStartDate?: string | null;
    scheduleEndDate?: string | null;
    items: Array<{
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
    }>;
}

type ReversalState = {
    canReverse: boolean;
    reason: string | null;
};

type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
    updated_by?: string | null;
    updated_at?: string | null;
};

const SOURCE_OPTIONS = [
    { value: 'all', label: 'All Sources' },
    { value: 'POS', label: 'POS' },
    { value: 'Payroll', label: 'Payroll' },
    { value: 'Inventory', label: 'Inventory' },
    { value: 'AP', label: 'Accounts Payable' },
    { value: 'AR', label: 'Accounts Receivable' },
    { value: 'Manual', label: 'Manual' },
];

function inferSource(entry: ApiJournalEntry): JournalSource {
    if (entry.source_module === 'pos') return 'POS';
    if (entry.source_module === 'inventory') return 'Inventory';
    if (entry.source_module === 'accounting' && entry.source_event === 'cash_variance') return 'Manual';
    const reference = `${entry.reference_id ?? ''} ${entry.description ?? ''}`.toLowerCase();
    if (reference.includes('sale-ord') || reference.includes('pos')) return 'POS';
    if (reference.includes('rect-po') || reference.includes('prod-') || reference.includes('manual stock') || reference.includes('inventory')) return 'Inventory';
    if (reference.includes('pay-') || reference.includes('salary') || reference.includes('payroll')) return 'Payroll';
    if (reference.includes('vendor') || reference.includes('payment voucher') || reference.includes('accounts payable')) return 'AP';
    if (reference.includes('receivable') || reference.includes('credit sale') || reference.includes('ar')) return 'AR';
    return 'Manual';
}

function formatPKR(value: number): string {
    return `PKR ${value.toLocaleString()}`;
}

function padJournalId(id: number): string {
    return `JE-${String(id).padStart(4, '0')}`;
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCloseAdjustmentLabel(value?: 'prepaid_expense' | 'deferred_revenue' | 'depreciation' | null): string | null {
    if (value === 'prepaid_expense') return 'Prepaid Expense';
    if (value === 'deferred_revenue') return 'Deferred Revenue';
    if (value === 'depreciation') return 'Depreciation';
    return null;
}

function flattenAccounts(accounts: any[]): AccountOption[] {
    return accounts.flatMap((account) => [
        {
            value: String(account.id),
            label: `${account.account_code} - ${account.account_name}`,
            description: account.description ?? null,
            usageGuidance: account.usage_guidance ?? null,
            exampleEntry: account.example_entry ?? null,
            confusionNote: account.confusion_note ?? null,
        },
        ...(account.children ? flattenAccounts(account.children) : []),
    ]);
}

function downloadCsv(filename: string, rows: string[][]) {
    const content = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function mapJournalEntry(entry: ApiJournalEntry): JournalEntryRow {
    const items = (entry.items ?? []).map((item) => ({
        accountCode: item.account?.account_code ?? String(item.account_id),
        accountName: item.account?.account_name ?? `Account ${item.account_id}`,
        debit: Number(item.debit ?? 0),
        credit: Number(item.credit ?? 0),
    }));

    const totalDebit = items.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = items.reduce((sum, item) => sum + item.credit, 0);

    return {
        id: padJournalId(entry.id),
        rawId: entry.id,
        date: entry.transaction_date,
        businessDate: entry.business_date ?? String(entry.transaction_date).slice(0, 10),
        description: entry.description ?? 'Journal Entry',
        reference: entry.reference_id ?? '-',
        source: inferSource(entry),
        totalAmount: Math.max(totalDebit, totalCredit),
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
        postingType: entry.posting_type ?? 'manual',
        dayCloseId: entry.day_close_id ?? null,
        reversalEntryId: entry.reversal_entry_id ?? null,
        reversedEntryId: entry.reversed_entry_id ?? null,
        reversedAt: entry.reversed_at ?? null,
        reversalReason: entry.reversal_reason ?? null,
        isLockedByPeriod: Boolean(entry.is_locked_by_period),
        isAccrual: Boolean(entry.is_accrual),
        accrualReversalDueDate: entry.accrual_reversal_due_date ?? null,
        accrualReversalStatus: entry.accrual_reversal_status ?? null,
        closeAdjustmentType: entry.close_adjustment_type ?? null,
        scheduleStartDate: entry.schedule_start_date ?? null,
        scheduleEndDate: entry.schedule_end_date ?? null,
        items,
    };
}

function getEntryReversalState(entry: JournalEntryRow, periodLock: PeriodLockState | null): ReversalState {
    if (entry.dayCloseId) {
        return {
            canReverse: false,
            reason: `This entry is part of closed day #${entry.dayCloseId} and must be corrected through controlled close adjustments.`,
        };
    }
    if (entry.reversalEntryId) {
        return {
            canReverse: false,
            reason: `This entry has already been reversed by ${padJournalId(entry.reversalEntryId)}.`,
        };
    }
    if (entry.reversedEntryId) {
        return {
            canReverse: false,
            reason: `This entry is itself a reversal of ${padJournalId(entry.reversedEntryId)} and cannot be reversed again.`,
        };
    }
    if (
        entry.isLockedByPeriod
        || (
            periodLock?.mode === 'hard_lock'
            && periodLock.locked_through_date
            && entry.businessDate <= periodLock.locked_through_date
        )
    ) {
        return {
            canReverse: false,
            reason: `This business date falls in the hard-locked period through ${periodLock?.locked_through_date ?? 'the current lock date'}.`,
        };
    }
    return { canReverse: true, reason: null };
}

function getPostingLabel(entry: JournalEntryRow): string {
    if (entry.postingType === 'closing') return 'Closing';
    if (entry.postingType === 'auto') return 'Auto-posted';
    return 'Manual';
}

function renderAccountGuide(account?: AccountOption | null) {
    if (!account || (!account.description && !account.usageGuidance && !account.exampleEntry && !account.confusionNote)) {
        return null;
    }

    return (
        <div className={styles.accountGuide}>
            {account.description ? <span><strong>Purpose:</strong> {account.description}</span> : null}
            {account.usageGuidance ? <span><strong>Use:</strong> {account.usageGuidance}</span> : null}
            {account.exampleEntry ? <span><strong>Example:</strong> {account.exampleEntry}</span> : null}
            {account.confusionNote ? <span><strong>Watch out:</strong> {account.confusionNote}</span> : null}
        </div>
    );
}

function EntryRow({
    entry,
    canPostAccounting,
    periodLock,
    onReverse,
}: {
    entry: JournalEntryRow;
    canPostAccounting: boolean;
    periodLock: PeriodLockState | null;
    onReverse: (entry: JournalEntryRow) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const reversalState = getEntryReversalState(entry, periodLock);

    return (
        <>
            <tr className={styles.entryRow} onClick={() => setExpanded(!expanded)}>
                <td>
                    <div className={styles.expandCell}>
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className={styles.entryId}>{entry.id}</span>
                    </div>
                </td>
                <td className={styles.dateCell}>{formatDate(entry.date)}</td>
                <td>
                    <div className={styles.descCell}>
                        <span className={styles.descText}>{entry.description}</span>
                        <span className={styles.refText}>{entry.reference}</span>
                    </div>
                </td>
                <td><span className={`${styles.sourceBadge} ${styles[`source${entry.source}`]}`}>{entry.source}</span></td>
                <td className={styles.amountCell}>{formatPKR(entry.items.reduce((sum, item) => sum + item.debit, 0))}</td>
                <td className={styles.amountCell}>{formatPKR(entry.items.reduce((sum, item) => sum + item.credit, 0))}</td>
                <td>
                    {entry.isBalanced ? (
                        <span className={styles.balancedBadge}><CheckCircle2 size={14} /> Balanced</span>
                    ) : (
                        <span className={styles.unbalancedBadge}><AlertCircle size={14} /> Unbalanced</span>
                    )}
                </td>
            </tr>
            {expanded && (
                <tr className={styles.detailRow}>
                    <td colSpan={7}>
                        <div className={styles.detailPanel}>
                            <div className={styles.detailMeta}>
                                <span>Entry: <strong>{entry.id}</strong></span>
                                <span>Business Date: <strong>{entry.businessDate}</strong></span>
                                <span>Posting: <strong>{getPostingLabel(entry)}</strong></span>
                                {entry.isAccrual ? <span>Accrual: <strong>{entry.accrualReversalStatus === 'reversed' ? 'Reversed' : 'Pending Reversal'}</strong></span> : null}
                                {entry.accrualReversalDueDate ? <span>Reverse Due: <strong>{entry.accrualReversalDueDate}</strong></span> : null}
                                {entry.closeAdjustmentType ? <span>Close Adjustment: <strong>{getCloseAdjustmentLabel(entry.closeAdjustmentType)}</strong></span> : null}
                                {entry.scheduleStartDate ? <span>Schedule Start: <strong>{entry.scheduleStartDate}</strong></span> : null}
                                {entry.scheduleEndDate ? <span>Schedule End: <strong>{entry.scheduleEndDate}</strong></span> : null}
                                {entry.dayCloseId && <span>Day Close: <strong>#{entry.dayCloseId}</strong></span>}
                                {entry.reversalEntryId && <span>Reversed by <strong>{padJournalId(entry.reversalEntryId)}</strong></span>}
                                {entry.reversedEntryId && <span>Reversal of <strong>{padJournalId(entry.reversedEntryId)}</strong></span>}
                                {entry.isLockedByPeriod && <span>Lock: <strong>Hard-Locked Period</strong></span>}
                            </div>
                            <div className={styles.governanceBadges}>
                                <span className={styles.governanceBadgePosting}>{getPostingLabel(entry)}</span>
                                {entry.isAccrual ? (
                                    <span className={entry.accrualReversalStatus === 'reversed' ? styles.governanceBadgeAccrualReversed : styles.governanceBadgeAccrual}>
                                        {entry.accrualReversalStatus === 'reversed' ? 'Accrual Reversed' : 'Accrual Pending'}
                                    </span>
                                ) : null}
                                {entry.closeAdjustmentType ? <span className={styles.governanceBadgePosting}>{getCloseAdjustmentLabel(entry.closeAdjustmentType)}</span> : null}
                                {entry.dayCloseId ? <span className={styles.governanceBadgeClose}>Closed Day</span> : null}
                                {entry.isLockedByPeriod ? <span className={styles.governanceBadgeLocked}>Hard-Locked Period</span> : null}
                                {entry.reversalEntryId || entry.reversedEntryId ? <span className={styles.governanceBadgeReversed}>Reversal Linked</span> : null}
                            </div>
                            {entry.reversedAt && (
                                <div className={styles.detailNotice}>
                                    Reversed on {formatDate(entry.reversedAt)}{entry.reversalReason ? ` · ${entry.reversalReason}` : ''}
                                </div>
                            )}
                            {canPostAccounting && (
                                <div style={{ marginBottom: 12 }}>
                                    <KitchenButton variant="outline" size="sm" onClick={() => onReverse(entry)} disabled={!reversalState.canReverse}>Reverse Entry</KitchenButton>
                                    {!reversalState.canReverse && reversalState.reason ? (
                                        <div className={styles.actionNotice}>{reversalState.reason}</div>
                                    ) : null}
                                </div>
                            )}
                            <table className={styles.detailTable}>
                                <thead>
                                    <tr>
                                        <th>Account Code</th>
                                        <th>Account Name</th>
                                        <th style={{ textAlign: 'right' }}>Debit</th>
                                        <th style={{ textAlign: 'right' }}>Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entry.items.map((item, index) => (
                                        <tr key={`${entry.rawId}-${index}`}>
                                            <td><span className={styles.itemCode}>{item.accountCode}</span></td>
                                            <td>{item.accountName}</td>
                                            <td className={styles.amountCell}>{item.debit > 0 ? formatPKR(item.debit) : '-'}</td>
                                            <td className={styles.amountCell}>{item.credit > 0 ? formatPKR(item.credit) : '-'}</td>
                                        </tr>
                                    ))}
                                    <tr className={styles.totalRow}>
                                        <td colSpan={2}><strong>Total</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(entry.items.reduce((sum, item) => sum + item.debit, 0))}</strong></td>
                                        <td className={styles.amountCell}><strong>{formatPKR(entry.items.reduce((sum, item) => sum + item.credit, 0))}</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function JournalEntries() {
    const { branches, activeBranch } = useBranchContext();
    const { canReadAccounting, canPostAccounting } = usePermissionAccess();
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showReverseModal, setShowReverseModal] = useState(false);
    const [entryToReverse, setEntryToReverse] = useState<JournalEntryRow | null>(null);
    const [reverseReason, setReverseReason] = useState('Entered in error');
    const [reverseDate, setReverseDate] = useState(new Date().toISOString().split('T')[0]);
    const [lineItems, setLineItems] = useState<JournalLineForm[]>([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
    ]);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [isAccrual, setIsAccrual] = useState(false);
    const [accrualReversalDueDate, setAccrualReversalDueDate] = useState('');
    const [closeAdjustmentType, setCloseAdjustmentType] = useState<'none' | 'prepaid_expense' | 'deferred_revenue' | 'depreciation'>('none');
    const [scheduleStartDate, setScheduleStartDate] = useState('');
    const [scheduleEndDate, setScheduleEndDate] = useState('');
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reversing, setReversing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selectedBranchId = selectedBranch !== 'all' ? Number(selectedBranch) : activeBranch?.branch_id ?? null;
    const entryDateLocked = periodLock?.mode === 'hard_lock' && !!periodLock.locked_through_date && entryDate <= periodLock.locked_through_date;
    const reverseDateLocked = periodLock?.mode === 'hard_lock' && !!periodLock.locked_through_date && reverseDate <= periodLock.locked_through_date;
    const reversalState = entryToReverse ? getEntryReversalState(entryToReverse, periodLock) : null;
    const manualEntryTotals = useMemo(() => {
        const debit = lineItems.reduce((sum, line) => sum + Number(line.debit || 0), 0);
        const credit = lineItems.reduce((sum, line) => sum + Number(line.credit || 0), 0);
        const populatedLines = lineItems.filter((line) => line.accountId && (Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0)).length;
        return {
            debit,
            credit,
            populatedLines,
            isBalanced: Math.abs(debit - credit) < 0.001,
        };
    }, [lineItems]);
    const canSubmitEntry = canPostAccounting
        && !entryDateLocked
        && manualEntryTotals.populatedLines >= 2
        && manualEntryTotals.isBalanced
        && lineItems.every((line) => {
            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);
            if (!line.accountId && debit === 0 && credit === 0) return true;
            return Boolean(line.accountId) && ((debit > 0 && credit === 0) || (credit > 0 && debit === 0));
        });

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const branchId = selectedBranch === 'all' ? null : selectedBranch;
            const [journalResponse, accountResponse, periodLockResponse] = await Promise.all([
                accountingApi.getJournalEntries({ branch_id: branchId, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
                accountingApi.getAccounts(),
                accountingApi.getPeriodLock({ branch_id: branchId ?? activeBranch?.branch_id ?? null }),
            ]);
            setEntries((journalResponse ?? []).map(mapJournalEntry));
            setAccountOptions(flattenAccounts(accountResponse ?? []));
            setPeriodLock(periodLockResponse ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load journal entries');
        } finally {
            setLoading(false);
        }
    }, [activeBranch?.branch_id, dateFrom, dateTo, selectedBranch]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter;
            const matchesSearch = !search
                || entry.description.toLowerCase().includes(search.toLowerCase())
                || entry.id.toLowerCase().includes(search.toLowerCase())
                || entry.reference.toLowerCase().includes(search.toLowerCase());
            return matchesSource && matchesSearch;
        });
    }, [entries, search, sourceFilter]);

    const totals = useMemo(() => {
        const total = filteredEntries.reduce((sum, entry) => sum + entry.totalAmount, 0);
        const allBalanced = filteredEntries.every((entry) => entry.isBalanced);
        const reversed = filteredEntries.filter((entry) => entry.reversalEntryId || entry.reversedEntryId).length;
        const accrualsPending = filteredEntries.filter((entry) => entry.isAccrual && entry.accrualReversalStatus === 'pending').length;
        return { entries: filteredEntries.length, total, allBalanced, reversed, accrualsPending };
    }, [filteredEntries]);

    const resetEntryModal = () => {
        setEntryDate(new Date().toISOString().split('T')[0]);
        setReference('');
        setDescription('');
        setIsAccrual(false);
        setAccrualReversalDueDate('');
        setCloseAdjustmentType('none');
        setScheduleStartDate('');
        setScheduleEndDate('');
        setLineItems([
            { accountId: '', debit: '', credit: '' },
            { accountId: '', debit: '', credit: '' },
        ]);
        setShowEntryModal(false);
    };

    const resetReverseModal = () => {
        setShowReverseModal(false);
        setEntryToReverse(null);
        setReverseReason('Entered in error');
        setReverseDate(new Date().toISOString().split('T')[0]);
    };

    const updateLineItem = (index: number, patch: Partial<JournalLineForm>) => {
        setLineItems((prev) => prev.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
    };

    const addLine = () => setLineItems((prev) => [...prev, { accountId: '', debit: '', credit: '' }]);

    const removeLine = (index: number) => {
        setLineItems((prev) => prev.length <= 2 ? prev : prev.filter((_, lineIndex) => lineIndex !== index));
    };

    const exportEntries = () => {
        downloadCsv(
            'journal-entries.csv',
            [
                ['Entry ID', 'Business Date', 'Description', 'Reference', 'Source', 'Debit', 'Credit', 'Posting Type', 'Reversed'],
                ...filteredEntries.map((entry) => [
                    entry.id,
                    entry.businessDate,
                    entry.description,
                    entry.reference,
                    entry.source,
                    String(entry.items.reduce((sum, item) => sum + item.debit, 0)),
                    String(entry.items.reduce((sum, item) => sum + item.credit, 0)),
                    entry.postingType,
                    entry.reversalEntryId || entry.reversedEntryId ? 'Yes' : 'No',
                ]),
            ],
        );
    };

    const submitEntry = async () => {
        setSaving(true);
        setError(null);
        try {
            const branchId = selectedBranch !== 'all' ? Number(selectedBranch) : activeBranch?.branch_id;
            if (!branchId) {
                throw new Error('Select an active branch before posting a journal entry.');
            }
            if (periodLock?.mode === 'hard_lock' && periodLock.locked_through_date && entryDate <= periodLock.locked_through_date) {
                throw new Error(`This entry date falls in the hard-locked period through ${periodLock.locked_through_date}.`);
            }

            await accountingApi.createJournalEntry({
                branch_id: branchId,
                transaction_date: new Date(entryDate).toISOString(),
                business_date: entryDate,
                reference_id: reference || undefined,
                description: description || undefined,
                is_accrual: isAccrual,
                accrual_reversal_due_date: isAccrual ? accrualReversalDueDate || undefined : undefined,
                close_adjustment_type: closeAdjustmentType !== 'none' ? closeAdjustmentType : undefined,
                schedule_start_date: closeAdjustmentType !== 'none' ? scheduleStartDate || undefined : undefined,
                schedule_end_date: closeAdjustmentType !== 'none' ? scheduleEndDate || undefined : undefined,
                items: lineItems.map((line) => ({
                    account_id: Number(line.accountId),
                    debit: Number(line.debit || 0),
                    credit: Number(line.credit || 0),
                })),
            });
            resetEntryModal();
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to post journal entry');
        } finally {
            setSaving(false);
        }
    };

    const openReverseModal = (entry: JournalEntryRow) => {
        const nextState = getEntryReversalState(entry, periodLock);
        if (!nextState.canReverse) {
            setError(nextState.reason);
            return;
        }
        setEntryToReverse(entry);
        setReverseReason('Entered in error');
        setReverseDate(new Date().toISOString().split('T')[0]);
        setShowReverseModal(true);
    };

    const submitReverse = async () => {
        if (!entryToReverse) return;
        setReversing(true);
        setError(null);
        try {
            const branchId = selectedBranch !== 'all' ? Number(selectedBranch) : activeBranch?.branch_id;
            if (!branchId) {
                throw new Error('Select an active branch before reversing a journal entry.');
            }
            if (!reversalState?.canReverse) {
                throw new Error(reversalState?.reason || 'This journal entry cannot be reversed.');
            }
            if (periodLock?.mode === 'hard_lock' && periodLock.locked_through_date && reverseDate <= periodLock.locked_through_date) {
                throw new Error(`This reversal date falls in the hard-locked period through ${periodLock.locked_through_date}.`);
            }
            await accountingApi.reverseJournalEntry(entryToReverse.rawId, {
                branch_id: branchId,
                transaction_date: new Date(reverseDate).toISOString(),
                business_date: reverseDate,
                reason: reverseReason.trim(),
            });
            resetReverseModal();
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to reverse journal entry');
        } finally {
            setReversing(false);
        }
    };

    if (!canReadAccounting) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.iconBox}><FileText size={24} /></div>
                        <div>
                            <h1>Journal Entries</h1>
                            <p>Your current branch role does not include accounting access.</p>
                        </div>
                    </div>
                </header>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><FileText size={24} /></div>
                    <div>
                        <h1>Journal Entries</h1>
                        <p>Double-entry transaction log across all modules</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} />
                    </div>
                    <KitchenButton variant="outline" size="sm" onClick={exportEntries}>
                        <Download size={16} style={{ marginRight: 6 }} /> Export
                    </KitchenButton>
                    <KitchenButton variant="primary" size="sm" onClick={() => setShowEntryModal(true)} disabled={!canPostAccounting}>
                        <Plus size={16} style={{ marginRight: 6 }} /> Manual Entry
                    </KitchenButton>
                </div>
            </header>

            {periodLock && periodLock.mode !== 'none' && (
                <div className={styles.lockBanner}>
                    <Lock size={16} />
                    <div>
                        <strong>Period lock active through {periodLock.locked_through_date || '-'}</strong>
                        <span>{periodLock.mode === 'hard_lock' ? 'All journal and voucher edits are blocked in the locked period.' : 'Users with accounting approval authority can override this lock.'}</span>
                    </div>
                </div>
            )}

            <div className={styles.statsRow}>
                <div className={styles.statPill}><FileText size={16} /> <strong>{totals.entries}</strong> Entries</div>
                <div className={styles.statPill}>{totals.allBalanced ? <CheckCircle2 size={16} style={{ color: 'var(--alert-success-text)' }} /> : <AlertCircle size={16} style={{ color: 'var(--danger)' }} />}{totals.allBalanced ? ' All Balanced' : ' Review Needed'}</div>
                <div className={styles.statPill}>Reversed: <strong>{totals.reversed}</strong></div>
                <div className={styles.statPill}>Pending Accruals: <strong>{totals.accrualsPending}</strong></div>
                <div className={styles.statPill}>Total Volume: <strong>{formatPKR(totals.total)}</strong></div>
            </div>

            <div className={styles.filters}>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <KitchenInput placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                    <Filter size={16} />
                    <KitchenSelect options={SOURCE_OPTIONS} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                    <Calendar size={16} />
                    <KitchenInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>to</span>
                    <KitchenInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
            </div>

            {error && <div className={styles.emptyRow}>{error}</div>}

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 120 }}>Entry ID</th>
                                <th style={{ width: 120 }}>Date</th>
                                <th>Description</th>
                                <th style={{ width: 100 }}>Source</th>
                                <th style={{ width: 130, textAlign: 'right' }}>Total Debit</th>
                                <th style={{ width: 130, textAlign: 'right' }}>Total Credit</th>
                                <th style={{ width: 110 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={7} className={styles.emptyRow}>Loading journal entries...</td></tr>}
                            {!loading && filteredEntries.map((entry) => (
                                <EntryRow key={entry.rawId} entry={entry} canPostAccounting={canPostAccounting} periodLock={periodLock} onReverse={openReverseModal} />
                            ))}
                            {!loading && filteredEntries.length === 0 && (
                                <tr><td colSpan={7} className={styles.emptyRow}>No journal entries found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </KitchenCard>

            {showEntryModal && (
                <div className={styles.modalOverlay} onClick={resetEntryModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>New Manual Journal Entry</h2>
                            <button className={styles.closeBtn} onClick={resetEntryModal}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {selectedBranchId && periodLock && periodLock.mode !== 'none' ? (
                                <div className={styles.modalNotice}>
                                    <Lock size={15} />
                                    <span>
                                        {periodLock.mode === 'hard_lock'
                                            ? `This branch is hard-locked through ${periodLock.locked_through_date || '-'}. Entry dates inside that period cannot be posted.`
                                            : `This branch uses admin-override period control through ${periodLock.locked_through_date || '-'}.`}
                                    </span>
                                </div>
                            ) : null}
                            {entryDateLocked ? (
                                <div className={styles.blockedNotice}>
                                    <AlertCircle size={15} />
                                    <span>This manual journal date is inside the hard-locked period and will be blocked.</span>
                                </div>
                            ) : null}
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Date</label>
                                    <KitchenInput type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Reference</label>
                                    <KitchenInput placeholder="e.g., MANUAL-001" value={reference} onChange={(e) => setReference(e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formGroup} style={{ marginTop: 16 }}>
                                <label>Description</label>
                                <KitchenInput placeholder="Describe the transaction..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            <div className={styles.formRow} style={{ marginTop: 16 }}>
                                <div className={styles.formGroup}>
                                    <label>Posting Nature</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'standard', label: 'Standard Journal' },
                                            { value: 'accrual', label: 'Month-End Accrual' },
                                            { value: 'prepaid_expense', label: 'Prepaid Expense' },
                                            { value: 'deferred_revenue', label: 'Deferred Revenue' },
                                            { value: 'depreciation', label: 'Depreciation' },
                                        ]}
                                        value={isAccrual ? 'accrual' : closeAdjustmentType}
                                        onChange={(e) => {
                                            const value = e.target.value as 'standard' | 'accrual' | 'prepaid_expense' | 'deferred_revenue' | 'depreciation';
                                            setIsAccrual(value === 'accrual');
                                            setCloseAdjustmentType(value === 'prepaid_expense' || value === 'deferred_revenue' || value === 'depreciation' ? value : 'none');
                                        }}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{isAccrual ? 'Accrual Reversal Due' : 'Schedule Start'}</label>
                                    <KitchenInput
                                        type="date"
                                        value={isAccrual ? accrualReversalDueDate : scheduleStartDate}
                                        onChange={(e) => isAccrual ? setAccrualReversalDueDate(e.target.value) : setScheduleStartDate(e.target.value)}
                                        disabled={!isAccrual && closeAdjustmentType === 'none'}
                                    />
                                </div>
                            </div>
                            {closeAdjustmentType !== 'none' && (
                                <div className={styles.formRow} style={{ marginTop: 16 }}>
                                    <div className={styles.formGroup}>
                                        <label>Schedule End</label>
                                        <KitchenInput type="date" value={scheduleEndDate} onChange={(e) => setScheduleEndDate(e.target.value)} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Close Adjustment</label>
                                        <KitchenInput value={getCloseAdjustmentLabel(closeAdjustmentType) || 'Close Adjustment'} readOnly />
                                    </div>
                                </div>
                            )}
                            <div className={styles.reviewStrip}>
                                <div className={styles.reviewMetric}>
                                    <span>Total Debit</span>
                                    <strong>{formatPKR(manualEntryTotals.debit)}</strong>
                                </div>
                                <div className={styles.reviewMetric}>
                                    <span>Total Credit</span>
                                    <strong>{formatPKR(manualEntryTotals.credit)}</strong>
                                </div>
                                <div className={styles.reviewMetric}>
                                    <span>Lines Ready</span>
                                    <strong>{manualEntryTotals.populatedLines}</strong>
                                </div>
                                <div className={styles.reviewMetric}>
                                    <span>Posting Check</span>
                                    <strong>{manualEntryTotals.isBalanced ? 'Balanced' : 'Out of Balance'}</strong>
                                </div>
                                <div className={styles.reviewMetric}>
                                    <span>Close Treatment</span>
                                    <strong>{isAccrual ? (accrualReversalDueDate || 'Need reversal date') : closeAdjustmentType !== 'none' ? `${getCloseAdjustmentLabel(closeAdjustmentType)}${scheduleEndDate ? ` to ${scheduleEndDate}` : ''}` : 'Standard'}</strong>
                                </div>
                            </div>
                            {!manualEntryTotals.isBalanced && (
                                <div className={styles.blockedNotice}>
                                    <AlertCircle size={15} />
                                    <span>Manual journals must balance before posting.</span>
                                </div>
                            )}
                            {isAccrual && !accrualReversalDueDate && (
                                <div className={styles.blockedNotice}>
                                    <AlertCircle size={15} />
                                    <span>Month-end accrual journals must include the planned reversal date.</span>
                                </div>
                            )}
                            {closeAdjustmentType !== 'none' && (!scheduleStartDate || !scheduleEndDate) && (
                                <div className={styles.blockedNotice}>
                                    <AlertCircle size={15} />
                                    <span>Prepaid, deferred, and depreciation journals must include both schedule start and schedule end dates.</span>
                                </div>
                            )}
                            <div className={styles.lineItemsHeader}>
                                <h4>Line Items</h4>
                                <KitchenButton variant="ghost" size="sm" onClick={addLine}><Plus size={14} style={{ marginRight: 4 }} /> Add Line</KitchenButton>
                            </div>
                            <table className={styles.lineItemsTable}>
                                <thead>
                                    <tr>
                                        <th>Account</th>
                                        <th style={{ width: 140 }}>Debit</th>
                                        <th style={{ width: 140 }}>Credit</th>
                                        <th style={{ width: 40 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((line, index) => (
                                        <tr key={`line-${index}`}>
                                            <td>
                                                <div className={styles.accountPickerCell}>
                                                    <KitchenSelect
                                                        options={[{ value: '', label: 'Select account...' }, ...accountOptions]}
                                                        value={line.accountId}
                                                        onChange={(e) => updateLineItem(index, { accountId: e.target.value })}
                                                    />
                                                    {renderAccountGuide(accountOptions.find((option) => option.value === line.accountId))}
                                                </div>
                                            </td>
                                            <td><KitchenInput type="number" placeholder="0.00" value={line.debit} onChange={(e) => updateLineItem(index, { debit: e.target.value })} /></td>
                                            <td><KitchenInput type="number" placeholder="0.00" value={line.credit} onChange={(e) => updateLineItem(index, { credit: e.target.value })} /></td>
                                            <td><button className={styles.removeLineBtn} onClick={() => removeLine(index)}><X size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" onClick={resetEntryModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" onClick={() => void submitEntry()} disabled={saving || !canSubmitEntry || (isAccrual && !accrualReversalDueDate) || (closeAdjustmentType !== 'none' && (!scheduleStartDate || !scheduleEndDate))}>
                                {saving ? 'Posting...' : 'Post Entry'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showReverseModal && entryToReverse && (
                <div className={styles.modalOverlay} onClick={resetReverseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Reverse {entryToReverse.id}</h2>
                            <button className={styles.closeBtn} onClick={resetReverseModal}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {reversalState?.reason ? (
                                <div className={reversalState.canReverse ? styles.modalNotice : styles.blockedNotice}>
                                    {reversalState.canReverse ? <Lock size={15} /> : <AlertCircle size={15} />}
                                    <span>{reversalState.reason}</span>
                                </div>
                            ) : null}
                            <div className={styles.detailMeta} style={{ marginBottom: 16 }}>
                                <span>Business Date: <strong>{entryToReverse.businessDate}</strong></span>
                                <span>Posting: <strong>{getPostingLabel(entryToReverse)}</strong></span>
                                {entryToReverse.dayCloseId ? <span>Day Close: <strong>#{entryToReverse.dayCloseId}</strong></span> : null}
                                {entryToReverse.isLockedByPeriod ? <span>Lock: <strong>Hard-Locked Period</strong></span> : null}
                            </div>
                            <div className={styles.formGroup} style={{ marginBottom: 16 }}>
                                <label>Reversal Date</label>
                                <KitchenInput type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} />
                            </div>
                            {reverseDateLocked ? (
                                <div className={styles.blockedNotice}>
                                    <AlertCircle size={15} />
                                    <span>This reversal date is inside the hard-locked period and will be blocked.</span>
                                </div>
                            ) : null}
                            <div className={styles.formGroup}>
                                <label>Reversal Reason</label>
                                <textarea
                                    className={styles.reasonInput}
                                    value={reverseReason}
                                    onChange={(e) => setReverseReason(e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" onClick={resetReverseModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" onClick={() => void submitReverse()} disabled={reversing || reverseReason.trim().length < 8 || !reversalState?.canReverse || reverseDateLocked}>
                                {reversing ? 'Reversing...' : 'Reverse Entry'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
