import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, Filter, Plus, Wallet, X } from 'lucide-react';
import { accountingApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './InvestmentRecords.module.css';

type InvestorOption = { id: number; full_name: string; agreements: Array<{ id: number; agreement_name: string; branch_id: number; agreement_code: string }> };
type TransactionRow = {
    id: number;
    investor_id: number;
    investor_name: string | null;
    agreement_id: number;
    agreement_code: string | null;
    agreement_name: string | null;
    branch_id: number;
    branch_name: string | null;
    transaction_date: string;
    transaction_type: string;
    amount: number;
    description: string | null;
};

function formatCurrency(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString()}`;
}

export function InvestmentRecords() {
    const { branches, activeBranch } = useBranchContext();
    const { canViewInvestors, canManageInvestors } = usePermissionAccess();
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [investorFilter, setInvestorFilter] = useState<string>('all');
    const [investors, setInvestors] = useState<InvestorOption[]>([]);
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        investor_id: '',
        agreement_id: '',
        branch_id: activeBranch ? String(activeBranch.branch_id) : '',
        transaction_date: new Date().toISOString().slice(0, 10),
        transaction_type: 'capital_injection',
        amount: '',
        description: '',
        reference_no: '',
    });

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const agreementOptions = useMemo(() => {
        const investor = investors.find((item) => String(item.id) === form.investor_id);
        return [
            { value: '', label: 'Select agreement' },
            ...(investor?.agreements ?? []).map((agreement) => ({
                value: String(agreement.id),
                label: `${agreement.agreement_code} | ${agreement.agreement_name}`,
            })),
        ];
    }, [investors, form.investor_id]);

    const investorOptions = useMemo(
        () => [
            { value: 'all', label: 'All Investors' },
            ...investors.map((investor) => ({ value: String(investor.id), label: investor.full_name })),
        ],
        [investors],
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const branchId = selectedBranch === 'all' ? null : selectedBranch;
            const [investorRows, txRows] = await Promise.all([
                accountingApi.getInvestors({ branch_id: branchId }),
                accountingApi.getInvestorTransactions({
                    branch_id: branchId,
                    investor_id: investorFilter === 'all' ? null : investorFilter,
                }),
            ]);
            setInvestors(investorRows);
            setTransactions(txRows);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load investment records');
        } finally {
            setLoading(false);
        }
    }, [investorFilter, selectedBranch]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const totals = useMemo(() => ({
        inflows: transactions
            .filter((row) => ['capital_injection', 'manual_increase'].includes(row.transaction_type))
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        outflows: transactions
            .filter((row) => ['capital_withdrawal', 'capital_return', 'manual_decrease'].includes(row.transaction_type))
            .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }), [transactions]);

    const submit = async () => {
        if (!canManageInvestors) {
            setError('You do not have permission to record investor transactions.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await accountingApi.createInvestorTransaction({
                investor_id: Number(form.investor_id),
                agreement_id: Number(form.agreement_id),
                branch_id: Number(form.branch_id),
                transaction_date: form.transaction_date,
                transaction_type: form.transaction_type,
                amount: Number(form.amount),
                description: form.description || undefined,
                reference_no: form.reference_no || undefined,
            });
            setShowModal(false);
            setForm({
                investor_id: '',
                agreement_id: '',
                branch_id: activeBranch ? String(activeBranch.branch_id) : '',
                transaction_date: new Date().toISOString().slice(0, 10),
                transaction_type: 'capital_injection',
                amount: '',
                description: '',
                reference_no: '',
            });
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save transaction');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Wallet size={18} /></div>
                    <div>
                        <h1>Investment Records</h1>
                        <p>Capital inflows and outflows against branch-linked agreements.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} />
                    </div>
                    <KitchenButton variant="primary" size="sm" onClick={() => setShowModal(true)} disabled={!canManageInvestors}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Record
                    </KitchenButton>
                </div>
            </header>

            {error && <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--danger, #ef4444)' }}>{error}</div>}
            {!canViewInvestors && (
                <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                    You do not have permission to access investment records.
                </div>
            )}

            <div className={styles.topSection}>
                <div className={`${styles.polishedPanel} ${styles.filterPanel}`}>
                    <div className={styles.filterGroup}>
                        <label>Filter by Investor</label>
                        <div className={styles.filterInputWrapper}>
                            <Filter size={14} className={styles.filterIcon} />
                            <KitchenSelect options={investorOptions} value={investorFilter} onChange={(event) => setInvestorFilter(event.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}><span className={styles.summaryLabel}>Capital Inflows</span><ArrowUpRight size={16} className={styles.colorSuccess} /></div>
                        <h3 className={styles.summaryValue}>{formatCurrency(totals.inflows)}</h3>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}><span className={styles.summaryLabel}>Capital Outflows</span><ArrowDownRight size={16} className={styles.colorDanger} /></div>
                        <h3 className={styles.summaryValue}>{formatCurrency(totals.outflows)}</h3>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}><span className={styles.summaryLabel}>Net Capital Movement</span><Wallet size={16} className={styles.colorPrimary} /></div>
                        <h3 className={styles.summaryValue}>{formatCurrency(totals.inflows - totals.outflows)}</h3>
                    </div>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <h3>Transaction History</h3>
                    <span className={styles.panelMeta}>{loading ? 'Loading...' : `${transactions.length} records`}</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Investor</th>
                                <th>Agreement</th>
                                <th>Branch</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((row) => (
                                <tr key={row.id} className={styles.tableRow}>
                                    <td>{new Date(row.transaction_date).toLocaleDateString()}</td>
                                    <td className={styles.investorName}>{row.investor_name}</td>
                                    <td>{row.agreement_code ?? row.agreement_name ?? '-'}</td>
                                    <td>{row.branch_name ?? '-'}</td>
                                    <td><span className={`${styles.catBadge} ${styles[`cat${row.transaction_type.replaceAll('_', '')}`]}`}>{row.transaction_type.replaceAll('_', ' ')}</span></td>
                                    <td className={styles.descText}>{row.description ?? '-'}</td>
                                    <td className={styles.amountCell}><strong>{formatCurrency(row.amount)}</strong></td>
                                </tr>
                            ))}
                            {!loading && transactions.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No investment transactions found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Record Transaction</h2>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <KitchenSelect label="Investor" options={investorOptions.filter((option) => option.value !== 'all')} value={form.investor_id} onChange={(event) => setForm((current) => ({ ...current, investor_id: event.target.value, agreement_id: '' }))} />
                                <KitchenSelect label="Agreement" options={agreementOptions} value={form.agreement_id} onChange={(event) => setForm((current) => ({ ...current, agreement_id: event.target.value }))} />
                                <KitchenSelect label="Branch" options={branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` }))} value={form.branch_id} onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))} />
                                <KitchenSelect label="Transaction Type" options={[
                                    { value: 'capital_injection', label: 'Capital Injection' },
                                    { value: 'capital_withdrawal', label: 'Capital Withdrawal' },
                                    { value: 'capital_return', label: 'Capital Return' },
                                    { value: 'manual_increase', label: 'Manual Increase' },
                                    { value: 'manual_decrease', label: 'Manual Decrease' },
                                ]} value={form.transaction_type} onChange={(event) => setForm((current) => ({ ...current, transaction_type: event.target.value }))} />
                                <KitchenInput label="Transaction Date" type="date" value={form.transaction_date} onChange={(event) => setForm((current) => ({ ...current, transaction_date: event.target.value }))} />
                                <KitchenInput label="Amount" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                                <KitchenInput label="Reference No" value={form.reference_no} onChange={(event) => setForm((current) => ({ ...current, reference_no: event.target.value }))} />
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Description</label>
                                    <textarea className={styles.commentBox} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" isLoading={saving} onClick={() => void submit()} disabled={!canManageInvestors}>Record</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
