/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    GitCompareArrows, CheckCircle2, XCircle, Download, X,
    Search, Link2, Calendar, ArrowRightLeft, AlertCircle, Plus,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './BankReconciliation.module.css';

function formatPKR(value: number): string {
    return `PKR ${Math.abs(value).toLocaleString()}`;
}

function flattenAccounts(nodes: any[]): any[] {
    return nodes.flatMap((node) => [
        node,
        ...(Array.isArray(node?.children) ? flattenAccounts(node.children) : []),
    ]);
}

const activityOptions = [
    { value: 'all', label: 'All Activity' },
    { value: 'vendor_payments', label: 'Vendor Payments' },
    { value: 'other', label: 'Other Activity' },
];

export function BankReconciliation() {
    const { branches, activeBranch } = useBranchContext();
    const { canApproveBankReconciliation, canPostAccounting } = usePermissionAccess();
    const [searchParams, setSearchParams] = useSearchParams();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [adjustmentAccounts, setAdjustmentAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedBranch, setSelectedBranch] = useState(searchParams.get('branch_id') || 'all');
    const [selectedActivityType, setSelectedActivityType] = useState(searchParams.get('activity_type') || 'all');
    const [search, setSearch] = useState('');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([]);
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [postingAdjustment, setPostingAdjustment] = useState(false);
    const [adjustmentAccountSearch, setAdjustmentAccountSearch] = useState('');
    const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
    const [statementReference, setStatementReference] = useState('');
    const [statementDescription, setStatementDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [adjustmentForm, setAdjustmentForm] = useState({
        direction: 'decrease_bank',
        counterparty_account_id: '',
        amount: '',
        reference_id: '',
        description: '',
        notes: '',
    });
    const canSaveReconciliation = canApproveBankReconciliation || canPostAccounting;

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const accountOptions = useMemo(
        () => accounts.map((account) => ({ value: String(account.id), label: `${account.account_code} - ${account.account_name}` })),
        [accounts],
    );
    const adjustmentAccountOptions = useMemo(
        () => adjustmentAccounts
            .filter((account) => String(account.id) !== selectedAccount)
            .map((account) => ({ value: String(account.id), label: `${account.account_code} - ${account.account_name}` })),
        [adjustmentAccounts, selectedAccount],
    );

    useEffect(() => {
        if (activeBranch && !searchParams.get('branch_id')) {
            setSelectedBranch(String(activeBranch.branch_id));
        }
    }, [activeBranch, searchParams]);

    const loadAccounts = useCallback(async () => {
        const response = await accountingApi.getReconciliationAccounts();
        setAccounts(response ?? []);
        if (!selectedAccount && response?.length) {
            setSelectedAccount(String(response[0].id));
        }
    }, [selectedAccount]);

    const loadAdjustmentAccounts = useCallback(async () => {
        const response = await accountingApi.getAccounts();
        const flat = flattenAccounts(Array.isArray(response) ? response : []);
        setAdjustmentAccounts(flat);
    }, []);

    const loadReconciliation = useCallback(async () => {
        if (!selectedAccount) return;
        setLoading(true);
        setError(null);
        try {
            const response = await accountingApi.getReconciliation({
                account_id: selectedAccount,
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
                activity_type: selectedActivityType,
            });
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load reconciliation');
        } finally {
            setLoading(false);
        }
    }, [selectedAccount, selectedActivityType, selectedBranch]);

    useEffect(() => {
        void loadAccounts();
    }, [loadAccounts]);

    useEffect(() => {
        void loadAdjustmentAccounts();
    }, [loadAdjustmentAccounts]);

    useEffect(() => {
        void loadReconciliation();
    }, [loadReconciliation]);

    const transactions = useMemo(() => {
        return (data?.transactions ?? []).filter((row: any) => {
            const term = search.trim().toLowerCase();
            if (!term) return true;
            return `${row.description ?? ''} ${row.reference_id ?? ''} ${row.journal_entry_id} ${row.treasury_account_code ?? ''} ${row.treasury_account_name ?? ''} ${row.payment_source_label ?? ''} ${row.payment_method ?? ''} ${row.activity_type ?? ''} ${row.treasury_classification ?? ''} ${row.treasury_classification_label ?? ''}`.toLowerCase().includes(term);
        });
    }, [data?.transactions, search]);

    const treasurySummary = useMemo(() => {
        const unmatchedRows = transactions.filter((row: any) => !row.reconciliation);
        const bySource = new Map<string, { label: string; count: number; amount: number }>();

        unmatchedRows.forEach((row: any) => {
            const sourceLabel = row.treasury_account_code && row.treasury_account_name
                ? `${row.treasury_account_code} ${row.treasury_account_name}`
                : row.payment_source_label
                    ? String(row.payment_source_label)
                    : 'Unassigned Treasury Source';
            const current = bySource.get(sourceLabel) ?? { label: sourceLabel, count: 0, amount: 0 };
            current.count += 1;
            current.amount += Math.abs(Number(row.amount ?? 0));
            bySource.set(sourceLabel, current);
        });

        return {
            sourceCount: bySource.size,
            topSource: Array.from(bySource.values()).sort((a, b) => b.amount - a.amount)[0] ?? null,
        };
    }, [transactions]);
    const visibleMatched = useMemo(() => transactions.filter((row: any) => row.match_status === 'matched').length, [transactions]);
    const visibleUnmatched = useMemo(() => transactions.filter((row: any) => row.match_status !== 'matched').length, [transactions]);
    const unmatchedVisibleTransactions = useMemo(
        () => transactions.filter((row: any) => !row.reconciliation),
        [transactions],
    );
    const selectedTransactions = useMemo(
        () => transactions.filter((row: any) => selectedTransactionIds.includes(Number(row.journal_item_id))),
        [selectedTransactionIds, transactions],
    );
    const allVisibleUnmatchedSelected = unmatchedVisibleTransactions.length > 0
        && unmatchedVisibleTransactions.every((row: any) => selectedTransactionIds.includes(Number(row.journal_item_id)));
    const selectedAccountMeta = useMemo(
        () => accounts.find((account) => String(account.id) === selectedAccount) ?? null,
        [accounts, selectedAccount],
    );
    const activeScopeLabel = useMemo(
        () => {
            const branchLabel = selectedBranch === 'all'
                ? 'All branches'
                : branches.find((branch) => String(branch.branch_id) === selectedBranch)?.branch_name || `Branch ${selectedBranch}`;
            const activityLabel = activityOptions.find((option) => option.value === selectedActivityType)?.label || 'All Activity';
            return `${branchLabel} | ${activityLabel}`;
        },
        [branches, selectedActivityType, selectedBranch],
    );

    const matched = Number(data?.summary?.matched_count ?? 0);
    const unmatched = Number(data?.summary?.unmatched_count ?? 0);
    const matchedAmount = Number(data?.summary?.matched_amount ?? 0);
    const unmatchedAmount = Number(data?.summary?.unmatched_amount ?? 0);
    const activitySummary = data?.activity_summary ?? {};
    const classificationSummary = Array.isArray(data?.classification_summary) ? data.classification_summary : [];
    const governanceSummary = data?.governance_summary ?? {};
    const hasDrillthroughScope = searchParams.get('origin') === 'month_close' || searchParams.get('activity_type') === 'vendor_payments';

    const clearDrillthrough = () => {
        setSelectedActivityType('all');
        if (activeBranch) {
            setSelectedBranch(String(activeBranch.branch_id));
        } else {
            setSelectedBranch('all');
        }
        setSearchParams({});
    };

    const toggleTransactionSelection = (row: any) => {
        const rowId = Number(row.journal_item_id);
        setSelectedTransactionIds((current) => (
            current.includes(rowId)
                ? current.filter((id) => id !== rowId)
                : [...current, rowId]
        ));
    };

    const toggleSelectAllVisible = () => {
        const visibleIds = unmatchedVisibleTransactions.map((row: any) => Number(row.journal_item_id));
        setSelectedTransactionIds((current) => (
            allVisibleUnmatchedSelected
                ? current.filter((id) => !visibleIds.includes(id))
                : Array.from(new Set([...current, ...visibleIds]))
        ));
    };

    const openMatchModal = (rows?: any[]) => {
        const targetRows = rows?.length ? rows : selectedTransactions;
        if (!targetRows.length) return;
        setSelectedTransaction(targetRows[0]);
        setSelectedTransactionIds(targetRows.map((row: any) => Number(row.journal_item_id)));
    };

    const handleMatch = async () => {
        if (!selectedTransaction) return;
        if (!canSaveReconciliation) {
            setError('Your current branch role cannot save bank reconciliations.');
            return;
        }
        try {
            const rowsToMatch = selectedTransactions.length > 0 ? selectedTransactions : [selectedTransaction];
            for (const row of rowsToMatch) {
                await accountingApi.createReconciliation({
                    branch_id: selectedBranch === 'all' ? activeBranch?.branch_id : Number(selectedBranch),
                    account_id: Number(selectedAccount),
                    journal_entry_id: row.journal_entry_id,
                    journal_item_id: row.journal_item_id,
                    statement_date: statementDate,
                    statement_reference: statementReference,
                    statement_description: statementDescription || undefined,
                    notes: notes || undefined,
                });
            }
            setSelectedTransaction(null);
            setSelectedTransactionIds([]);
            setStatementReference('');
            setStatementDescription('');
            setNotes('');
            await loadReconciliation();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to reconcile transaction');
        }
    };

    const openAdjustmentModal = () => {
        if (!canPostAccounting) {
            setError('Your current branch role cannot post manual bank adjustments.');
            return;
        }
        if (selectedBranch === 'all') {
            setError('Select a single branch before recording a bank adjustment.');
            return;
        }
        setAdjustmentForm({
            direction: 'decrease_bank',
            counterparty_account_id: '',
            amount: '',
            reference_id: '',
            description: '',
            notes: '',
        });
        setAdjustmentAccountSearch('');
        setShowAdjustmentModal(true);
    };

    const handleAdjustmentAccountInputChange = (value: string) => {
        setAdjustmentAccountSearch(value);
        const exactMatch = adjustmentAccountOptions.find((option) => option.label === value);
        setAdjustmentForm((current) => ({
            ...current,
            counterparty_account_id: exactMatch ? String(exactMatch.value) : '',
        }));
    };

    const handleRecordAdjustment = async () => {
        if (!canPostAccounting) {
            setError('Your current branch role cannot post manual bank adjustments.');
            return;
        }
        if (selectedBranch === 'all') {
            setError('Select a single branch before recording a bank adjustment.');
            return;
        }
        if (!selectedAccount || !adjustmentForm.counterparty_account_id || !adjustmentForm.amount || Number(adjustmentForm.amount) <= 0) {
            setError('Complete the adjustment amount and counterpart account first.');
            return;
        }
        setPostingAdjustment(true);
        setError(null);
        try {
            const amount = Number(adjustmentForm.amount);
            const bankAccountId = Number(selectedAccount);
            const counterpartyAccountId = Number(adjustmentForm.counterparty_account_id);
            const bankDebit = adjustmentForm.direction === 'increase_bank' ? amount : 0;
            const bankCredit = adjustmentForm.direction === 'decrease_bank' ? amount : 0;
            const counterpartyDebit = adjustmentForm.direction === 'decrease_bank' ? amount : 0;
            const counterpartyCredit = adjustmentForm.direction === 'increase_bank' ? amount : 0;

            const journal = await accountingApi.createJournalEntry({
                branch_id: Number(selectedBranch),
                transaction_date: new Date(`${statementDate}T12:00:00`),
                business_date: statementDate,
                description: adjustmentForm.description.trim() || 'Bank reconciliation adjustment',
                reference_id: adjustmentForm.reference_id.trim() || undefined,
                source_module: 'accounting',
                source_entity_type: 'bank_reconciliation_adjustment',
                source_event: 'bank_reconciliation_adjustment',
                posting_type: 'manual',
                items: [
                    { account_id: bankAccountId, debit: bankDebit, credit: bankCredit },
                    { account_id: counterpartyAccountId, debit: counterpartyDebit, credit: counterpartyCredit },
                ],
            }) as any;

            const bankItem = (journal?.items ?? []).find((item: any) => Number(item.account_id) === bankAccountId);
            if (bankItem?.id && journal?.id) {
                await accountingApi.createReconciliation({
                    branch_id: Number(selectedBranch),
                    account_id: bankAccountId,
                    journal_entry_id: Number(journal.id),
                    journal_item_id: Number(bankItem.id),
                    statement_date: statementDate,
                    statement_reference: adjustmentForm.reference_id.trim() || `ADJ-${journal.id}`,
                    statement_description: adjustmentForm.description.trim() || 'Bank reconciliation adjustment',
                    amount,
                    notes: adjustmentForm.notes.trim() || undefined,
                });
            }

            setShowAdjustmentModal(false);
            await loadReconciliation();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to record bank adjustment');
        } finally {
            setPostingAdjustment(false);
        }
    };

    return (
        <div className={`${styles.container} ${styles.reconciliationPage}`}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><GitCompareArrows size={18} /></div>
                    <div>
                        <h1>Bank Reconciliation</h1>
                        <p>Match posted bank ledger lines against statement references</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.scopeBadge}>
                        <span>{selectedAccountMeta?.account_name || 'No bank account selected'}</span>
                        <select
                            className={styles.scopeBadgeBranchSelect}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            {branchOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <KitchenButton variant="secondary" size="sm" className={styles.actionBtn} onClick={openAdjustmentModal} disabled={!canPostAccounting || selectedBranch === 'all' || !selectedAccount}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Record Adjustment
                    </KitchenButton>
                    <KitchenButton variant="secondary" size="sm" className={styles.actionBtn} onClick={() => openMatchModal()} disabled={!selectedTransactionIds.length || !canSaveReconciliation}>
                        <Link2 size={14} style={{ marginRight: 6 }} /> Match Selected
                    </KitchenButton>
                    <KitchenButton variant="outline" size="sm" className={styles.actionBtn}>
                        <Download size={14} style={{ marginRight: 6 }} /> Export
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.topControlsWrap}>
                <div className={`${styles.polishedPanel} ${styles.selectorPanel}`}>
                    <div className={styles.selectorField}>
                        <label>Bank Account</label>
                        <KitchenSelect
                            options={accountOptions}
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            containerClassName={styles.wideSelectControl}
                        />
                    </div>
                    <div className={styles.filterDivider} />
                    <div className={styles.selectorField}>
                        <label>Activity</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ArrowRightLeft size={14} />
                            <KitchenSelect
                                options={activityOptions}
                                value={selectedActivityType}
                                onChange={(e) => setSelectedActivityType(e.target.value)}
                                containerClassName={styles.wideSelectControl}
                            />
                        </div>
                    </div>
                    <div className={styles.searchField}>
                        <label>Search Transactions</label>
                        <div className={styles.searchBoxCompact}>
                            <Search size={14} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Journal, treasury source, method, classification..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={styles.searchInput}
                            />
                            {search.trim() && (
                                <button className={styles.clearInlineBtn} type="button" onClick={() => setSearch('')}>
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.summaryGrid}>
                    <div className={`${styles.summaryCard} ${styles.summaryMatched}`}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Matched</span>
                            <CheckCircle2 size={16} />
                        </div>
                        <h3 className={styles.summaryValue}>{matched} <span className={styles.subtext}>items | {formatPKR(matchedAmount)}</span></h3>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.summaryUnmatched}`}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Unmatched</span>
                            <XCircle size={16} />
                        </div>
                        <h3 className={styles.summaryValue}>{unmatched} <span className={styles.subtext}>items | {formatPKR(unmatchedAmount)}</span></h3>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.summaryPartial}`}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Current Scope</span>
                            <ArrowRightLeft size={16} />
                        </div>
                        <h3 className={styles.summaryValue}>
                            {selectedActivityType === 'vendor_payments' ? Number(activitySummary.unmatched_vendor_payment_count ?? 0) : selectedActivityType === 'other' ? Number(activitySummary.unmatched_other_count ?? 0) : treasurySummary.sourceCount}
                            <span className={styles.subtext}>
                                {selectedActivityType === 'vendor_payments'
                                    ? `open vendor lines | ${formatPKR(Number(activitySummary.unmatched_vendor_payment_amount ?? 0))}`
                                    : selectedActivityType === 'other'
                                        ? `other bank lines | ${formatPKR(Number(activitySummary.unmatched_other_amount ?? 0))}`
                                        : treasurySummary.topSource
                                            ? `${treasurySummary.topSource.label} | ${formatPKR(treasurySummary.topSource.amount)}`
                                            : 'No unmatched treasury lines'}
                            </span>
                        </h3>
                    </div>
                </div>
            </div>

            {hasDrillthroughScope && (
                <div className={`${styles.closeReadinessNarrative} ${styles.closeReadinessAlert}`}>
                    <AlertCircle size={18} />
                    <div style={{ flex: 1 }}>
                        <strong>Month-close treasury review scope active.</strong>
                        <span>Vendor-payment reconciliation is filtered for close blockers and bank matching review.</span>
                    </div>
                    <KitchenButton variant="outline" size="sm" className={styles.actionBtn} onClick={clearDrillthrough}>
                        Clear Scope
                    </KitchenButton>
                </div>
            )}

            <div className={styles.insightGrid}>
                <div className={styles.treasuryCard}>
                    <span className={styles.treasuryLabel}>Unmatched Vendor Payments</span>
                    <strong className={styles.treasuryValue}>{Number(activitySummary.unmatched_vendor_payment_count ?? 0)}</strong>
                    <span className={styles.treasuryMeta}>{formatPKR(Number(activitySummary.unmatched_vendor_payment_amount ?? 0))} waiting for statement matching.</span>
                </div>
                <div className={styles.treasuryCard}>
                    <span className={styles.treasuryLabel}>Other Unmatched Activity</span>
                    <strong className={styles.treasuryValue}>{Number(activitySummary.unmatched_other_count ?? 0)}</strong>
                    <span className={styles.treasuryMeta}>{formatPKR(Number(activitySummary.unmatched_other_amount ?? 0))} outside vendor settlement traffic.</span>
                </div>
                <div className={styles.treasuryCard}>
                    <span className={styles.treasuryLabel}>Top Unmatched Treasury Source</span>
                    <strong className={styles.treasuryValue}>{treasurySummary.topSource?.label ?? 'No unmatched source'}</strong>
                    <span className={styles.treasuryMeta}>
                        {treasurySummary.topSource
                            ? `${treasurySummary.topSource.count} items | ${formatPKR(treasurySummary.topSource.amount)}`
                            : 'Current filter is fully matched.'}
                    </span>
                </div>
                {classificationSummary.slice(0, 4).map((row: any) => (
                    <div key={row.key} className={styles.treasuryCard}>
                        <span className={styles.treasuryLabel}>{row.label}</span>
                        <strong className={styles.treasuryValue}>{Number(row.count ?? 0)}</strong>
                        <span className={styles.treasuryMeta}>{formatPKR(Number(row.amount ?? 0))}</span>
                    </div>
                ))}
                <div className={styles.closeReadinessCard}>
                    <span className={styles.closeReadinessLabel}>Month-Close Blockers</span>
                    <strong className={styles.closeReadinessValue}>{Number(governanceSummary.close_blocker_count ?? 0)}</strong>
                    <span className={styles.closeReadinessMeta}>{formatPKR(Number(governanceSummary.close_blocker_amount ?? 0))}</span>
                </div>
                <div className={styles.closeReadinessCard}>
                    <span className={styles.closeReadinessLabel}>Treasury Follow-Up</span>
                    <strong className={styles.closeReadinessValue}>{Number(governanceSummary.follow_up_count ?? 0)}</strong>
                    <span className={styles.closeReadinessMeta}>{formatPKR(Number(governanceSummary.follow_up_amount ?? 0))}</span>
                </div>
                <div className={`${styles.closeReadinessNarrative} ${governanceSummary.status === 'attention' ? styles.closeReadinessAlert : styles.closeReadinessOk}`}>
                    {governanceSummary.status === 'attention' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    <div>
                        <strong>{governanceSummary.status === 'attention' ? 'Month-close attention required' : 'Close-ready bank scope'}</strong>
                        <span>{governanceSummary.top_issue || 'No reconciliation blocker in the current scope.'}</span>
                    </div>
                </div>
            </div>

            {error && <div className={styles.polishedPanel}><p>{error}</p></div>}

            <div className={styles.matchingGrid}>
                <div className={`${styles.polishedPanel} ${styles.matchPanel}`} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.panelHeader}>
                        <h3>Bank Ledger Transactions</h3>
                        <span className={styles.panelMeta}>{data?.account?.account_name ?? 'Select bank account'} | {transactions.length} rows</span>
                    </div>
                    <div className={styles.matchTableWrap}>
                        <table className={styles.matchTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: 48, textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={allVisibleUnmatchedSelected}
                                            onChange={toggleSelectAllVisible}
                                            disabled={!unmatchedVisibleTransactions.length}
                                        />
                                    </th>
                                    <th style={{ width: 85 }}>Date</th>
                                    <th>Description</th>
                                    <th style={{ width: 120 }}>Activity</th>
                                    <th style={{ width: 100, textAlign: 'right' }}>Amount</th>
                                    <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                                    <th style={{ width: 70, textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={7} className={styles.dateCell}>Loading reconciliation...</td></tr>
                                )}
                                {!loading && transactions.map((row: any) => (
                                    <tr key={row.journal_item_id} className={`${styles.matchRow} ${styles[`match${row.match_status}`]}`}>
                                        <td style={{ textAlign: 'center' }}>
                                            {!row.reconciliation && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTransactionIds.includes(Number(row.journal_item_id))}
                                                    onChange={() => toggleTransactionSelection(row)}
                                                />
                                            )}
                                        </td>
                                        <td className={styles.dateCell}>{new Date(row.transaction_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</td>
                                        <td>
                                            <div className={styles.stmtRow}>
                                                <span className={styles.stmtDesc}>{row.description || `Journal ${row.journal_entry_id}`}</span>
                                                <span className={styles.stmtRef}>
                                                    {[
                                                        row.reference_id || `JE-${String(row.journal_entry_id).padStart(4, '0')}`,
                                                        row.treasury_account_code && row.treasury_account_name
                                                            ? `${row.treasury_account_code} ${row.treasury_account_name}`
                                                            : row.treasury_account_code || row.treasury_account_name || null,
                                                        row.payment_source_label,
                                                        row.payment_method,
                                                        row.reconciliation?.statement_reference,
                                                    ].filter(Boolean).join(' | ')}
                                                </span>
                                                <span className={`${styles.reviewBadge} ${styles[`review${row.close_impact}`]}`}>
                                                    {row.review_status}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${row.activity_type === 'vendor_payment' ? styles.statuspartial : styles.statusmatched}`}>
                                                {row.treasury_classification_label || (row.activity_type === 'vendor_payment' ? 'Vendor Payment' : 'Other')}
                                            </span>
                                        </td>
                                        <td className={`${styles.amountCell} ${row.amount >= 0 ? styles.credit : styles.debit}`}>
                                            {row.amount >= 0 ? '+' : '-'}{formatPKR(row.amount)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`${styles.statusBadge} ${styles[`status${row.match_status}`]}`}>
                                                {row.match_status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {!row.reconciliation && (
                                                <button className={styles.linkBtn} title="Match transaction" onClick={() => openMatchModal([row])} disabled={!canSaveReconciliation}>
                                                    <Link2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className={styles.emptyStateCell}>
                                            <strong>No bank transactions found</strong>
                                            <span>Try another bank account, branch scope, or clear the current search and activity filters.</span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedTransaction && (
                <div className={styles.modalOverlay} onClick={() => setSelectedTransaction(null)}>
                    <div className={`${styles.modal} ${styles.matchModal}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.matchModalHeaderText}>
                                <h2>Match Statement Reference{selectedTransactions.length > 1 ? ` (${selectedTransactions.length} items)` : ''}</h2>
                                <p>
                                    {selectedTransactions.length > 1
                                        ? 'Apply one bank statement reference across all selected ledger lines.'
                                        : 'Attach the bank statement reference to this ledger line for reconciliation.'}
                                </p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedTransaction(null)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.matchContextGrid}>
                                <div className={styles.matchContextCard}>
                                    <span className={styles.matchCardLabel}>Selected rows</span>
                                    <strong className={styles.matchCardValue}>
                                        {selectedTransactions.length > 1 ? selectedTransactions.length : 1}
                                    </strong>
                                    <span className={styles.matchCardMeta}>
                                        {selectedTransactions.length > 1 ? 'Ledger lines to be matched together' : 'Single ledger line under review'}
                                    </span>
                                </div>
                                <div className={styles.matchContextCard}>
                                    <span className={styles.matchCardLabel}>Statement amount</span>
                                    <strong className={styles.matchCardValue}>
                                        {selectedTransactions.length > 1
                                            ? formatPKR(selectedTransactions.reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount ?? 0)), 0))
                                            : `${selectedTransaction.amount >= 0 ? '+' : '-'}${formatPKR(selectedTransaction.amount)}`}
                                    </strong>
                                    <span className={styles.matchCardMeta}>
                                        {selectedTransactions.length > 1 ? 'Combined value of selected rows' : 'Signed value of this ledger line'}
                                    </span>
                                </div>
                                <div className={styles.matchContextCard}>
                                    <span className={styles.matchCardLabel}>Reconciliation scope</span>
                                    <strong className={styles.matchCardValue}>{activeScopeLabel}</strong>
                                    <span className={styles.matchCardMeta}>Current bank account and branch scope</span>
                                </div>
                            </div>
                            <div className={styles.matchPreviewCard}>
                                <div className={styles.matchSectionHeader}>
                                    <strong>
                                        {selectedTransactions.length > 1
                                            ? `${selectedTransactions.length} transactions selected for matching`
                                            : (selectedTransaction.description || `Journal ${selectedTransaction.journal_entry_id}`)}
                                    </strong>
                                    <span className={styles.matchSectionNote}>
                                        {selectedTransactions.length > 1
                                            ? 'One statement reference will be applied to every selected line.'
                                            : 'Review the ledger line details before saving the match.'}
                                    </span>
                                </div>

                                {selectedTransactions.length > 1 ? (
                                    <div className={styles.matchReferenceList}>
                                        <span className={styles.matchCardLabel}>Selected references</span>
                                        <div className={styles.matchReferencePills}>
                                            {selectedTransactions.slice(0, 6).map((row: any) => (
                                                <span key={row.id} className={styles.matchReferencePill}>
                                                    {row.reference_id || `JE-${String(row.journal_entry_id).padStart(4, '0')}`}
                                                </span>
                                            ))}
                                            {selectedTransactions.length > 6 && (
                                                <span className={styles.matchReferencePill}>+{selectedTransactions.length - 6} more</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.matchDetailList}>
                                        <div className={styles.matchDetailRow}>
                                            <span>Activity</span>
                                            <strong>
                                                {selectedTransaction.treasury_classification_label || (selectedTransaction.activity_type === 'vendor_payment' ? 'Vendor payment' : 'Other activity')}
                                            </strong>
                                        </div>
                                        <div className={styles.matchDetailRow}>
                                            <span>Treasury account</span>
                                            <strong>
                                                {selectedTransaction.treasury_account_code && selectedTransaction.treasury_account_name
                                                    ? `${selectedTransaction.treasury_account_code} ${selectedTransaction.treasury_account_name}`
                                                    : 'Not classified'}
                                            </strong>
                                        </div>
                                        <div className={styles.matchDetailRow}>
                                            <span>Source</span>
                                            <strong>{selectedTransaction.payment_source_label || 'Unspecified source'}</strong>
                                        </div>
                                        <div className={styles.matchDetailRow}>
                                            <span>Review status</span>
                                            <strong>{selectedTransaction.review_status || 'Pending review'}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={styles.matchFormSection}>
                                <div className={styles.matchSectionHeader}>
                                    <strong>Statement details</strong>
                                    <span className={styles.matchSectionNote}>
                                        Use the bank statement date and reference exactly as they appear on the statement.
                                    </span>
                                </div>
                                <div className={styles.modalFormGrid}>
                                    <div className={styles.modalField}>
                                        <label>Statement Date</label>
                                        <div className={styles.searchBoxCompact}>
                                            <Calendar size={14} className={styles.searchIcon} />
                                            <input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className={styles.searchInput} />
                                        </div>
                                    </div>
                                    <div className={styles.modalField}>
                                        <label>Statement Reference</label>
                                        <div className={styles.searchBoxCompact}>
                                            <input type="text" placeholder="Reference from statement" value={statementReference} onChange={(e) => setStatementReference(e.target.value)} className={styles.searchInput} />
                                        </div>
                                    </div>
                                    <div className={styles.modalField}>
                                        <label>Statement Description</label>
                                        <div className={styles.searchBoxCompact}>
                                            <input type="text" placeholder="Optional statement narrative" value={statementDescription} onChange={(e) => setStatementDescription(e.target.value)} className={styles.searchInput} />
                                        </div>
                                    </div>
                                    <div className={styles.modalField}>
                                        <label>Notes</label>
                                        <div className={styles.searchBoxCompact}>
                                            <input type="text" placeholder="Internal reconciliation note" value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.searchInput} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setSelectedTransaction(null)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handleMatch()} disabled={!statementReference.trim() || !canSaveReconciliation}>Save Match</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {showAdjustmentModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAdjustmentModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Record Adjustment</h2>
                            <button className={styles.closeBtn} onClick={() => setShowAdjustmentModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.matchPreviewCard}>
                                <strong>
                                    {selectedAccountMeta
                                        ? `${selectedAccountMeta.account_code} - ${selectedAccountMeta.account_name}`
                                        : 'Selected bank account'}
                                </strong>
                                <p style={{ marginTop: 6, color: 'var(--color-text-muted)' }}>
                                    Bank account for adjustment posting and reconciliation target.
                                </p>
                                <p style={{ marginTop: 6, color: 'var(--color-text-muted)' }}>
                                    Branch scope: {selectedBranch === 'all'
                                        ? 'All branches'
                                        : branches.find((branch) => String(branch.branch_id) === selectedBranch)?.branch_name || `Branch ${selectedBranch}`}
                                </p>
                                <p style={{ marginTop: 6, color: 'var(--color-text-muted)' }}>
                                    This posts a manual journal entry and reconciles the bank-side line immediately.
                                </p>
                            </div>
                            <div className={styles.modalFormGrid}>
                                <div className={styles.modalField}>
                                    <label>Statement Date</label>
                                    <div className={styles.searchBoxCompact}>
                                        <Calendar size={14} className={styles.searchIcon} />
                                        <input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className={styles.searchInput} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label>Adjustment Direction</label>
                                    <div className={styles.searchBoxCompact}>
                                        <KitchenSelect
                                            options={[
                                                { value: 'decrease_bank', label: 'Decrease Bank Balance' },
                                                { value: 'increase_bank', label: 'Increase Bank Balance' },
                                            ]}
                                            value={adjustmentForm.direction}
                                            onChange={(e) => setAdjustmentForm((current) => ({ ...current, direction: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label>Counterpart Account</label>
                                    <div className={styles.searchBoxCompact}>
                                        <Search size={14} className={styles.searchIcon} />
                                        <input
                                            type="text"
                                            list="adjustment-coa-options"
                                            placeholder="Search and select COA account"
                                            value={adjustmentAccountSearch}
                                            onChange={(e) => handleAdjustmentAccountInputChange(e.target.value)}
                                            className={styles.searchInput}
                                        />
                                        <datalist id="adjustment-coa-options">
                                            {adjustmentAccountOptions.map((option) => (
                                                <option key={option.value} value={option.label} />
                                            ))}
                                        </datalist>
                                        {adjustmentAccountSearch.trim() && (
                                            <button
                                                type="button"
                                                className={styles.clearInlineBtn}
                                                onClick={() => {
                                                    setAdjustmentAccountSearch('');
                                                    setAdjustmentForm((current) => ({ ...current, counterparty_account_id: '' }));
                                                }}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label>Amount</label>
                                    <div className={styles.searchBoxCompact}>
                                        <input type="number" min="0" step="0.01" value={adjustmentForm.amount} onChange={(e) => setAdjustmentForm((current) => ({ ...current, amount: e.target.value }))} className={styles.searchInput} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label>Statement Reference</label>
                                    <div className={styles.searchBoxCompact}>
                                        <input type="text" placeholder="Bank memo / statement ref" value={adjustmentForm.reference_id} onChange={(e) => setAdjustmentForm((current) => ({ ...current, reference_id: e.target.value }))} className={styles.searchInput} />
                                    </div>
                                </div>
                                <div className={styles.modalField}>
                                    <label>Description</label>
                                    <div className={styles.searchBoxCompact}>
                                        <input type="text" placeholder="Bank charge, markup, correction..." value={adjustmentForm.description} onChange={(e) => setAdjustmentForm((current) => ({ ...current, description: e.target.value }))} className={styles.searchInput} />
                                    </div>
                                </div>
                                <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <div className={styles.searchBoxCompact}>
                                        <input type="text" placeholder="Internal note" value={adjustmentForm.notes} onChange={(e) => setAdjustmentForm((current) => ({ ...current, notes: e.target.value }))} className={styles.searchInput} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowAdjustmentModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handleRecordAdjustment()} isLoading={postingAdjustment} disabled={!canPostAccounting}>
                                Post Adjustment
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
