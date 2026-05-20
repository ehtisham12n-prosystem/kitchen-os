/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    ArrowDownRight,
    ArrowUpRight,
    Building2,
    Calendar,
    Download,
    FileText,
    Filter,
    Lock,
    Scale,
    Search,
    X,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import styles from './GeneralLedger.module.css';

interface AccountOption {
    value: string;
    label: string;
}

interface LedgerTransaction {
    id: number;
    date: string;
    businessDate: string;
    journalId: string;
    description: string;
    source: string;
    reference: string;
    branchId: number | null;
    postingType: string;
    dayCloseId: number | null;
    reversedEntryId: number | null;
    reversalEntryId: number | null;
    reversalReason: string | null;
    reversedAt: string | null;
    isLockedByPeriod: boolean;
    debit: number;
    credit: number;
    runningBalance: number;
    items: Array<{
        account_code: string;
        account_name: string;
        debit: number;
        credit: number;
    }>;
}

type PeriodLockState = {
    mode: 'none' | 'admin_override' | 'hard_lock';
    locked_through_date?: string | null;
};

function flattenAccounts(accounts: any[]): AccountOption[] {
    return accounts.flatMap((account) => [
        { value: String(account.id), label: `${account.account_code} - ${account.account_name}` },
        ...(account.children ? flattenAccounts(account.children) : []),
    ]);
}

function inferSource(transaction: { description?: string; reference_id?: string; source_module?: string | null; source_event?: string | null }): string {
    if (transaction.source_module === 'pos') return 'POS';
    if (transaction.source_module === 'inventory') return 'Inventory';
    const text = `${transaction.description ?? ''} ${transaction.reference_id ?? ''}`.toLowerCase();
    if (text.includes('sale-ord') || text.includes('pos')) return 'POS';
    if (text.includes('prod-') || text.includes('rect-po') || text.includes('inventory')) return 'Inventory';
    if (text.includes('payroll') || text.includes('salary')) return 'Payroll';
    if (text.includes('vendor') || text.includes('payment')) return 'AP';
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

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getLockStatus(transaction: LedgerTransaction, periodLock: PeriodLockState | null) {
    if (!periodLock || periodLock.mode === 'none' || !periodLock.locked_through_date) {
        return null;
    }
    if (!transaction.isLockedByPeriod) {
        return null;
    }

    return periodLock.mode === 'hard_lock'
        ? `Hard locked through ${periodLock.locked_through_date}`
        : `Admin override only through ${periodLock.locked_through_date}`;
}

function getGovernanceBadges(transaction: LedgerTransaction, periodLock: PeriodLockState | null) {
    const badges: Array<{ label: string; tone: 'locked' | 'closed' | 'reversed' | 'reversal' | 'posting' }> = [];
    const lockStatus = getLockStatus(transaction, periodLock);
    if (lockStatus) {
        badges.push({ label: 'Locked Period', tone: 'locked' });
    }
    if (transaction.dayCloseId) {
        badges.push({ label: 'Closed Day', tone: 'closed' });
    }
    if (transaction.reversalEntryId) {
        badges.push({ label: 'Reversed', tone: 'reversed' });
    }
    if (transaction.reversedEntryId) {
        badges.push({ label: 'Reversal Entry', tone: 'reversal' });
    }
    if (transaction.postingType && transaction.postingType !== 'manual') {
        badges.push({ label: transaction.postingType === 'closing' ? 'Closing' : 'Auto Post', tone: 'posting' });
    }
    return badges;
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

const SOURCE_OPTIONS = [
    { value: 'all', label: 'All Sources' },
    { value: 'POS', label: 'POS' },
    { value: 'Manual', label: 'Manual' },
    { value: 'AP', label: 'Accounts Payable' },
    { value: 'Payroll', label: 'Payroll' },
    { value: 'Inventory', label: 'Inventory' },
];

export function GeneralLedger() {
    const { branches, activeBranch } = useBranchContext();
    const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [ledgerData, setLedgerData] = useState<any>(null);
    const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedJournal, setSelectedJournal] = useState<LedgerTransaction | null>(null);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );
    const activeBranchLabel = useMemo(() => {
        if (selectedBranch !== 'all') {
            return branchOptions.find((option) => option.value === selectedBranch)?.label ?? 'Selected Branch';
        }
        return activeBranch?.branch_name || 'All Branches';
    }, [activeBranch?.branch_name, branchOptions, selectedBranch]);

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const response = await accountingApi.getAccounts();
                const options = flattenAccounts(response ?? []);
                setAccountOptions(options);
                setSelectedAccount((current) => current || options[0]?.value || '');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load accounts');
            }
        };

        void loadAccounts();
    }, []);

    useEffect(() => {
        const loadLedger = async () => {
            if (!selectedAccount) return;
            setLoading(true);
            setError(null);
            try {
                const branchId = selectedBranch === 'all' ? null : selectedBranch;
                const [response, periodLockResponse] = await Promise.all([
                    accountingApi.getGeneralLedger(selectedAccount, {
                        branch_id: branchId,
                        date_from: dateFrom || undefined,
                        date_to: dateTo || undefined,
                    }),
                    accountingApi.getPeriodLock({
                        branch_id: branchId ?? activeBranch?.branch_id ?? null,
                    }),
                ]);
                setLedgerData(response);
                setPeriodLock(periodLockResponse ?? null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to load general ledger');
            } finally {
                setLoading(false);
            }
        };

        void loadLedger();
    }, [selectedAccount, selectedBranch, dateFrom, dateTo, activeBranch?.branch_id]);

    const transactions: LedgerTransaction[] = useMemo(() => {
        return (ledgerData?.transactions ?? []).map((transaction: any) => ({
            id: transaction.id,
            date: transaction.date,
            businessDate: transaction.business_date ?? transaction.date,
            journalId: padJournalId(transaction.journal_id),
            description: transaction.description ?? 'Journal Entry',
            source: inferSource(transaction),
            reference: transaction.reference_id ?? '-',
            branchId: transaction.branch_id ? Number(transaction.branch_id) : null,
            postingType: transaction.posting_type ?? 'manual',
            dayCloseId: transaction.day_close_id ? Number(transaction.day_close_id) : null,
            reversedEntryId: transaction.reversed_entry_id ? Number(transaction.reversed_entry_id) : null,
            reversalEntryId: transaction.reversal_entry_id ? Number(transaction.reversal_entry_id) : null,
            reversalReason: transaction.reversal_reason ?? null,
            reversedAt: transaction.reversed_at ?? null,
            isLockedByPeriod: Boolean(transaction.is_locked_by_period),
            debit: Number(transaction.debit ?? 0),
            credit: Number(transaction.credit ?? 0),
            runningBalance: Number(transaction.running_balance ?? 0),
            items: (transaction.items ?? []).map((item: any) => ({
                account_code: item.account_code,
                account_name: item.account_name,
                debit: Number(item.debit ?? 0),
                credit: Number(item.credit ?? 0),
            })),
        }));
    }, [ledgerData]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter((transaction) => {
            const matchesSource = sourceFilter === 'all' || transaction.source === sourceFilter;
            const matchesSearch = !search
                || transaction.description.toLowerCase().includes(search.toLowerCase())
                || transaction.journalId.toLowerCase().includes(search.toLowerCase())
                || transaction.reference.toLowerCase().includes(search.toLowerCase());
            return matchesSource && matchesSearch;
        });
    }, [transactions, search, sourceFilter]);

    const totals = useMemo(() => ({
        totalDebit: filteredTransactions.reduce((sum, transaction) => sum + transaction.debit, 0),
        totalCredit: filteredTransactions.reduce((sum, transaction) => sum + transaction.credit, 0),
        closingBalance: filteredTransactions.length > 0
            ? filteredTransactions[filteredTransactions.length - 1].runningBalance
            : Number(ledgerData?.opening_balance ?? 0),
    }), [filteredTransactions, ledgerData?.opening_balance]);

    const governanceSummary = useMemo(() => ({
        locked: filteredTransactions.filter((transaction) => Boolean(getLockStatus(transaction, periodLock))).length,
        closedDay: filteredTransactions.filter((transaction) => Boolean(transaction.dayCloseId)).length,
        reversed: filteredTransactions.filter((transaction) => Boolean(transaction.reversalEntryId || transaction.reversedEntryId)).length,
    }), [filteredTransactions, periodLock]);

    const exportLedger = () => {
        downloadCsv(
            'general-ledger.csv',
            [
                ['Date', 'Business Date', 'Journal ID', 'Description', 'Reference', 'Source', 'Governance', 'Debit', 'Credit', 'Running Balance'],
                ...filteredTransactions.map((transaction) => [
                    formatDate(transaction.date),
                    transaction.businessDate,
                    transaction.journalId,
                    transaction.description,
                    transaction.reference,
                    transaction.source,
                    getGovernanceBadges(transaction, periodLock).map((badge) => badge.label).join(' | '),
                    String(transaction.debit),
                    String(transaction.credit),
                    String(transaction.runningBalance),
                ]),
            ],
        );
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Scale size={18} /></div>
                    <div>
                        <h1>General Ledger</h1>
                        <p>Detailed transaction history with running balances</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} />
                    </div>
                    <KitchenButton variant="outline" size="sm" className={styles.exportBtn} onClick={exportLedger}>
                        <Download size={14} style={{ marginRight: 6 }} /> Export
                    </KitchenButton>
                </div>
            </header>

            {periodLock && periodLock.mode !== 'none' && (
                <div className={styles.lockBanner}>
                    <Lock size={16} />
                    <div>
                        <strong>Period lock active through {periodLock.locked_through_date || '-'}</strong>
                        <span>{periodLock.mode === 'hard_lock' ? 'Ledger detail remains visible, but posting edits are blocked in the locked period.' : 'Approval-authority users may still override locked-period posting.'}</span>
                    </div>
                </div>
            )}

            <div className={styles.topControls}>
                <div className={`${styles.polishedPanel} ${styles.selectorPanel}`}>
                    <div className={styles.selectorField}>
                        <label>Select Account</label>
                        <KitchenSelect options={accountOptions} value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} />
                    </div>
                    <div className={styles.accountMeta}>
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>Account Name</span>
                            <span className={styles.metaValue}>{ledgerData?.account?.account_name ?? '-'}</span>
                        </div>
                        <div className={styles.metaDivider} />
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>Account Type</span>
                            <span className={styles.metaTypeBadge}>{ledgerData?.account?.account_type ?? '-'}</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.polishedPanel} ${styles.filtersPanel}`}>
                    <div className={styles.searchBox}>
                        <Search size={14} />
                        <input type="text" placeholder="Search descriptions, refs, or IDs..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.compactInput} />
                    </div>
                    <div className={styles.filterDivider} />
                    <div className={styles.filterGroup}>
                        <Filter size={14} />
                        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={styles.compactSelect}>
                            {SOURCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.filterDivider} />
                    <div className={styles.filterGroup}>
                        <Calendar size={14} />
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={styles.compactInput} />
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11, margin: '0 4px' }}>to</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={styles.compactInput} />
                    </div>
                </div>
            </div>

            {error && <div className={styles.emptyRow}>{error}</div>}

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Opening Balance</span>
                    <h3 className={styles.summaryValue}>{formatPKR(Number(ledgerData?.opening_balance ?? 0))}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Debits</span>
                    <h3 className={`${styles.summaryValue} ${styles.debitColor}`}><ArrowUpRight size={14} /> {formatPKR(totals.totalDebit)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Credits</span>
                    <h3 className={`${styles.summaryValue} ${styles.creditColor}`}><ArrowDownRight size={14} /> {formatPKR(totals.totalCredit)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Closing Balance</span>
                    <h3 className={styles.summaryValue}>{formatPKR(totals.closingBalance)}</h3>
                </div>
            </div>

            <div className={styles.governanceStrip}>
                <div className={styles.governanceCard}>
                    <span className={styles.summaryLabel}>View Scope</span>
                    <strong>{activeBranchLabel}</strong>
                    <span>{dateFrom || dateTo ? `${dateFrom || 'Opening'} to ${dateTo || 'Today'}` : 'Full visible ledger range'}</span>
                </div>
                <div className={styles.governanceCard}>
                    <span className={styles.summaryLabel}>Locked Rows</span>
                    <strong>{governanceSummary.locked}</strong>
                    <span>{periodLock?.mode === 'hard_lock' ? 'Posting changes blocked' : 'No hard-locked rows in current view'}</span>
                </div>
                <div className={styles.governanceCard}>
                    <span className={styles.summaryLabel}>Closed Day Rows</span>
                    <strong>{governanceSummary.closedDay}</strong>
                    <span>Entries already tied to a day close</span>
                </div>
                <div className={styles.governanceCard}>
                    <span className={styles.summaryLabel}>Reversal State</span>
                    <strong>{governanceSummary.reversed}</strong>
                    <span>Rows already reversed or created as reversals</span>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 95 }}>Date</th>
                                <th style={{ width: 110 }}>Journal ID</th>
                                <th>Description</th>
                                <th style={{ width: 120 }}>Reference</th>
                                <th style={{ width: 80, textAlign: 'center' }}>Source</th>
                                <th style={{ width: 180 }}>Governance</th>
                                <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                                <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                                <th style={{ width: 140, textAlign: 'right' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className={styles.openingRow}>
                                <td colSpan={8} className={styles.balanceText}>Opening Balance</td>
                                <td className={styles.amountCell}><strong className={styles.balanceText}>{formatPKR(Number(ledgerData?.opening_balance ?? 0))}</strong></td>
                            </tr>
                            {loading && <tr><td colSpan={9} className={styles.emptyRow}>Loading general ledger...</td></tr>}
                            {!loading && filteredTransactions.map((transaction) => (
                                <tr key={transaction.id} className={styles.txnRow}>
                                    <td className={styles.dateCell}>{formatDate(transaction.date)}</td>
                                    <td>
                                        <span className={styles.journalBadge} onClick={() => setSelectedJournal(transaction)} style={{ cursor: 'pointer' }}>
                                            {transaction.journalId}
                                        </span>
                                    </td>
                                    <td className={styles.descCell}>{transaction.description}</td>
                                    <td className={styles.referenceCell}>{transaction.reference}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`${styles.sourceBadge} ${styles[`source${transaction.source}`]}`}>{transaction.source}</span>
                                    </td>
                                    <td>
                                        <div className={styles.badgeStack}>
                                            {getGovernanceBadges(transaction, periodLock).length > 0 ? (
                                                getGovernanceBadges(transaction, periodLock).map((badge) => (
                                                    <span key={`${transaction.id}-${badge.label}`} className={`${styles.governanceBadge} ${styles[`badge${badge.tone}`]}`}>
                                                        {badge.label}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className={styles.governanceClear}>Open</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={styles.amountCell}>{transaction.debit > 0 ? <span className={styles.debitColor}>{formatPKR(transaction.debit)}</span> : <span className={styles.dash}>-</span>}</td>
                                    <td className={styles.amountCell}>{transaction.credit > 0 ? <span className={styles.creditColor}>{formatPKR(transaction.credit)}</span> : <span className={styles.dash}>-</span>}</td>
                                    <td className={styles.amountCell}><strong className={styles.runningBalance}>{formatPKR(transaction.runningBalance)}</strong></td>
                                </tr>
                            ))}
                            <tr className={styles.closingRow}>
                                <td colSpan={6} className={styles.balanceText}>Closing Balance</td>
                                <td />
                                <td className={styles.amountCell}><strong className={styles.debitColor}>{formatPKR(totals.totalDebit)}</strong></td>
                                <td className={styles.amountCell}><strong className={styles.creditColor}>{formatPKR(totals.totalCredit)}</strong></td>
                                <td className={styles.amountCell}><strong className={styles.balanceText}>{formatPKR(totals.closingBalance)}</strong></td>
                            </tr>
                            {!loading && filteredTransactions.length === 0 && (
                                <tr><td colSpan={9} className={styles.emptyRow}>No transactions found for this account in the specified period</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedJournal && (
                <div className={styles.modalOverlay} onClick={() => setSelectedJournal(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Journal Entry Details</h2>
                            <button className={styles.closeBtn} onClick={() => setSelectedJournal(null)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.modalMetaRow}>
                                <div className={styles.journalMeta}><FileText size={14} /> <strong>{selectedJournal.journalId}</strong></div>
                                <div className={styles.journalMeta}><Calendar size={14} /> {formatDateTime(selectedJournal.date)}</div>
                                <div className={styles.journalMeta}>Business Date: <strong>{selectedJournal.businessDate}</strong></div>
                                <div className={styles.journalMeta}>Reference: <strong>{selectedJournal.reference}</strong></div>
                            </div>
                            <div className={styles.modalGovernance}>
                                <div className={styles.modalGovernanceItem}>
                                    <span>Posting</span>
                                    <strong>{selectedJournal.postingType === 'closing' ? 'Closing Entry' : selectedJournal.postingType === 'auto' ? 'Auto Post' : 'Manual Entry'}</strong>
                                </div>
                                <div className={styles.modalGovernanceItem}>
                                    <span>Branch</span>
                                    <strong>{branches.find((branch) => String(branch.branch_id) === String(selectedJournal.branchId))?.branch_name || activeBranchLabel}</strong>
                                </div>
                                <div className={styles.modalGovernanceItem}>
                                    <span>Day Close</span>
                                    <strong>{selectedJournal.dayCloseId ? `Linked #${selectedJournal.dayCloseId}` : 'Not closed by day-close batch'}</strong>
                                </div>
                                <div className={styles.modalGovernanceItem}>
                                    <span>Period Lock</span>
                                    <strong>{getLockStatus(selectedJournal, periodLock) || 'Open period'}</strong>
                                </div>
                            </div>
                            {(selectedJournal.reversalEntryId || selectedJournal.reversedEntryId || selectedJournal.reversalReason || getLockStatus(selectedJournal, periodLock) || selectedJournal.dayCloseId) && (
                                <div className={styles.modalAlerts}>
                                    {getLockStatus(selectedJournal, periodLock) && (
                                        <div className={`${styles.modalNotice} ${styles.noticeLocked}`}>{getLockStatus(selectedJournal, periodLock)}</div>
                                    )}
                                    {selectedJournal.dayCloseId && (
                                        <div className={`${styles.modalNotice} ${styles.noticeClosed}`}>This entry is already attached to closed-day batch #{selectedJournal.dayCloseId}.</div>
                                    )}
                                    {selectedJournal.reversalEntryId && (
                                        <div className={`${styles.modalNotice} ${styles.noticeReversed}`}>
                                            Reversed by {padJournalId(selectedJournal.reversalEntryId)}{selectedJournal.reversedAt ? ` on ${formatDateTime(selectedJournal.reversedAt)}` : ''}.
                                            {selectedJournal.reversalReason ? ` Reason: ${selectedJournal.reversalReason}` : ''}
                                        </div>
                                    )}
                                    {selectedJournal.reversedEntryId && (
                                        <div className={`${styles.modalNotice} ${styles.noticeReversal}`}>This journal was created as reversal of {padJournalId(selectedJournal.reversedEntryId)}.</div>
                                    )}
                                </div>
                            )}
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Account</th>
                                        <th style={{ textAlign: 'right' }}>Debit</th>
                                        <th style={{ textAlign: 'right' }}>Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedJournal.items.map((item, index) => (
                                        <tr key={`${selectedJournal.id}-${index}`}>
                                            <td>{item.account_code} - {item.account_name}</td>
                                            <td className={styles.amountCell}>{item.debit > 0 ? formatPKR(item.debit) : '-'}</td>
                                            <td className={styles.amountCell}>{item.credit > 0 ? formatPKR(item.credit) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="primary" size="sm" onClick={() => setSelectedJournal(null)}>Close</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
