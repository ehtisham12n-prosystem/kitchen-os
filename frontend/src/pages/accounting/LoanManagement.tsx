/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2, CheckCircle2, Download, Edit2, Eye, HandCoins, Plus, TrendingDown, X,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './LoanManagement.module.css';

type LoanRow = {
    id: number;
    loan_code: string;
    source_name: string;
    branch_id: number;
    branch_name: string | null;
    principal_amount: number;
    annual_interest_rate: number;
    interest_method: 'flat' | 'reducing';
    start_date: string;
    duration_months: number;
    repayment_frequency: 'monthly' | 'quarterly';
    installment_count: number;
    installment_amount: number;
    maturity_date: string | null;
    outstanding_principal_amount: number;
    total_paid_amount: number;
    next_due_date: string | null;
    next_payment_amount: number;
    status: 'active' | 'completed' | 'defaulted' | 'closed';
    notes: string | null;
};

type RepaymentRow = {
    id: number;
    installment_no: number;
    due_date: string;
    principal_amount: number;
    interest_amount: number;
    total_due_amount: number;
    paid_amount: number;
    paid_date: string | null;
    balance_after_amount: number;
    remaining_due_amount: number;
    status: 'paid' | 'due' | 'overdue';
};

type TreasuryOption = {
    id: string;
    label: string;
    branch_id: number | null;
    is_cash_account: boolean;
    is_bank_account: boolean;
};

type LoanFormState = {
    branch_id: string;
    source_name: string;
    principal_amount: string;
    annual_interest_rate: string;
    interest_method: 'flat' | 'reducing';
    start_date: string;
    duration_months: string;
    repayment_frequency: 'monthly' | 'quarterly';
    disbursement_account_id: string;
    disbursement_reference_no: string;
    notes: string;
};

type LoanSettlementFormState = {
    payment_date: string;
    payment_method: string;
    treasury_account_id: string;
    reference_no: string;
    notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const EMPTY_FORM: LoanFormState = {
    branch_id: '',
    source_name: '',
    principal_amount: '',
    annual_interest_rate: '0',
    interest_method: 'reducing',
    start_date: today,
    duration_months: '12',
    repayment_frequency: 'monthly',
    disbursement_account_id: '',
    disbursement_reference_no: '',
    notes: '',
};

const EMPTY_SETTLEMENT_FORM: LoanSettlementFormState = {
    payment_date: today,
    payment_method: 'Bank Transfer',
    treasury_account_id: '',
    reference_no: '',
    notes: '',
};

function formatMoney(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString()}`;
}

function flattenAccounts(nodes: any[]): any[] {
    return nodes.flatMap((node) => [
        node,
        ...(Array.isArray(node?.children) ? flattenAccounts(node.children) : []),
    ]);
}

export function LoanManagement() {
    const { branches, activeBranch } = useBranchContext();
    const { canViewLoans, canManageLoans } = usePermissionAccess();
    const [selectedBranch, setSelectedBranch] = useState(activeBranch ? String(activeBranch.branch_id) : 'all');
    const [loans, setLoans] = useState<LoanRow[]>([]);
    const [schedule, setSchedule] = useState<RepaymentRow[]>([]);
    const [accounts, setAccounts] = useState<TreasuryOption[]>([]);
    const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showSettlementModal, setShowSettlementModal] = useState(false);
    const [editingLoan, setEditingLoan] = useState<LoanRow | null>(null);
    const [form, setForm] = useState<LoanFormState>(EMPTY_FORM);
    const [settlementForm, setSettlementForm] = useState<LoanSettlementFormState>(EMPTY_SETTLEMENT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settling, setSettling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const selectedLoan = useMemo(
        () => loans.find((loan) => Number(loan.id) === Number(selectedLoanId)) ?? null,
        [loans, selectedLoanId],
    );

    const treasuryOptions = useMemo(() => {
        const branchId = editingLoan?.branch_id ?? (form.branch_id ? Number(form.branch_id) : null);
        return accounts
            .filter((account) => !branchId || !account.branch_id || Number(account.branch_id) === Number(branchId))
            .map((account) => ({ value: account.id, label: account.label }));
    }, [accounts, editingLoan?.branch_id, form.branch_id]);
    const settlementTreasuryOptions = useMemo(() => {
        const branchId = selectedLoan?.branch_id ?? null;
        return accounts
            .filter((account) => !branchId || !account.branch_id || Number(account.branch_id) === Number(branchId))
            .filter((account) => settlementForm.payment_method === 'Cash' ? account.is_cash_account : account.is_bank_account)
            .map((account) => ({ value: account.id, label: account.label }));
    }, [accounts, selectedLoan?.branch_id, settlementForm.payment_method]);

    const loadLoans = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await accountingApi.getLoans({
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
            });
            setLoans(rows);
            setSelectedLoanId((current) => {
                if (current && rows.some((loan) => Number(loan.id) === Number(current))) {
                    return current;
                }
                return rows[0]?.id ?? null;
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load loans.');
            setLoans([]);
            setSelectedLoanId(null);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch]);

    const loadSchedule = useCallback(async (loanId: number | null) => {
        if (!loanId) {
            setSchedule([]);
            return;
        }
        try {
            const rows = await accountingApi.getLoanRepayments({ loan_id: loanId });
            setSchedule(rows);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load repayment schedule.');
            setSchedule([]);
        }
    }, []);

    useEffect(() => {
        void loadLoans();
    }, [loadLoans]);

    useEffect(() => {
        void loadSchedule(selectedLoanId);
    }, [loadSchedule, selectedLoanId]);

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const payload = await accountingApi.getAccounts();
                const flat = flattenAccounts(Array.isArray(payload) ? payload : []);
                setAccounts(
                    flat
                        .filter((account) => account?.is_cash_account === true || account?.is_bank_account === true)
                        .map((account) => ({
                            id: String(account.id),
                            label: `${account.account_code} - ${account.account_name}`,
                            branch_id: account.branch_id ? Number(account.branch_id) : null,
                            is_cash_account: account.is_cash_account === true,
                            is_bank_account: account.is_bank_account === true,
                        })),
                );
            } catch {
                setAccounts([]);
            }
        };
        void loadAccounts();
    }, []);

    const totals = useMemo(() => ({
        totalBorrowed: loans.reduce((sum, loan) => sum + Number(loan.principal_amount || 0), 0),
        totalOutstanding: loans.reduce((sum, loan) => sum + Number(loan.outstanding_principal_amount || 0), 0),
        activeCount: loans.filter((loan) => loan.status === 'active').length,
    }), [loans]);
    const selectedLoanSettlementAmount = useMemo(
        () => schedule.reduce((sum, row) => sum + Number(row.remaining_due_amount || 0), 0),
        [schedule],
    );

    const openCreate = () => {
        if (!canManageLoans) {
            setError('You do not have permission to create loans.');
            return;
        }
        setEditingLoan(null);
        setForm({
            ...EMPTY_FORM,
            branch_id: selectedBranch !== 'all' ? selectedBranch : (activeBranch ? String(activeBranch.branch_id) : ''),
        });
        setShowModal(true);
    };

    const openEdit = (loan: LoanRow) => {
        if (!canManageLoans) {
            setError('You do not have permission to update loans.');
            return;
        }
        setEditingLoan(loan);
        setForm({
            branch_id: String(loan.branch_id),
            source_name: loan.source_name,
            principal_amount: String(loan.principal_amount),
            annual_interest_rate: String(loan.annual_interest_rate),
            interest_method: loan.interest_method,
            start_date: loan.start_date,
            duration_months: String(loan.duration_months),
            repayment_frequency: loan.repayment_frequency,
            disbursement_account_id: '',
            disbursement_reference_no: '',
            notes: loan.notes || '',
        });
        setShowModal(true);
    };

    const openSettlementModal = () => {
        if (!canManageLoans) {
            setError('You do not have permission to settle loans.');
            return;
        }
        if (!selectedLoan) {
            setError('Select a loan first.');
            return;
        }
        if (selectedLoanSettlementAmount <= 0) {
            setError('This loan is already fully settled.');
            return;
        }
        setSettlementForm({
            ...EMPTY_SETTLEMENT_FORM,
            payment_date: today,
            reference_no: `${selectedLoan.loan_code}-SETTLEMENT`,
        });
        setShowSettlementModal(true);
    };

    const submit = async () => {
        if (!canManageLoans) {
            setError('You do not have permission to save loans.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editingLoan) {
                await accountingApi.updateLoan(editingLoan.id, {
                    source_name: form.source_name,
                    principal_amount: Number(form.principal_amount),
                    annual_interest_rate: Number(form.annual_interest_rate || 0),
                    interest_method: form.interest_method,
                    start_date: form.start_date,
                    duration_months: Number(form.duration_months),
                    repayment_frequency: form.repayment_frequency,
                    notes: form.notes || undefined,
                }, form.branch_id);
            } else {
                await accountingApi.createLoan({
                    branch_id: Number(form.branch_id),
                    source_name: form.source_name,
                    principal_amount: Number(form.principal_amount),
                    annual_interest_rate: Number(form.annual_interest_rate || 0),
                    interest_method: form.interest_method,
                    start_date: form.start_date,
                    duration_months: Number(form.duration_months),
                    repayment_frequency: form.repayment_frequency,
                    disbursement_account_id: Number(form.disbursement_account_id),
                    disbursement_reference_no: form.disbursement_reference_no || undefined,
                    notes: form.notes || undefined,
                });
            }
            setShowModal(false);
            setEditingLoan(null);
            setForm(EMPTY_FORM);
            await loadLoans();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save loan.');
        } finally {
            setSaving(false);
        }
    };

    const submitSettlement = async () => {
        if (!canManageLoans) {
            setError('You do not have permission to settle loans.');
            return;
        }
        if (!selectedLoan) {
            setError('Select a loan first.');
            return;
        }
        setSettling(true);
        setError(null);
        try {
            await accountingApi.settleLoan({
                loan_id: selectedLoan.id,
                payment_date: settlementForm.payment_date,
                payment_method: settlementForm.payment_method,
                treasury_account_id: Number(settlementForm.treasury_account_id),
                reference_no: settlementForm.reference_no || undefined,
                notes: settlementForm.notes || undefined,
            }, selectedLoan.branch_id);
            setShowSettlementModal(false);
            setSettlementForm(EMPTY_SETTLEMENT_FORM);
            await loadLoans();
            await loadSchedule(selectedLoan.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to settle loan.');
        } finally {
            setSettling(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><HandCoins size={18} /></div>
                    <div>
                        <h1>Loan Management</h1>
                        <p>Branch-linked borrowings with real repayment schedules and accounting postings.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} />
                    </div>
                    <KitchenButton variant="outline" size="sm" className={styles.actionBtn} disabled>
                        <Download size={14} style={{ marginRight: 6 }} /> Export
                    </KitchenButton>
                    <KitchenButton
                        variant="secondary"
                        size="sm"
                        className={styles.actionBtn}
                        onClick={openSettlementModal}
                        disabled={!canManageLoans || !selectedLoan || selectedLoanSettlementAmount <= 0}
                    >
                        <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Settle Loan
                    </KitchenButton>
                    <KitchenButton variant="primary" size="sm" className={styles.actionBtn} onClick={openCreate} disabled={!canManageLoans}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Add Loan
                    </KitchenButton>
                </div>
            </header>

            {error && <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--danger, #ef4444)' }}>{error}</div>}
            {!canViewLoans && (
                <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                    You do not have permission to access business loans.
                </div>
            )}

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}>
                        <span className={styles.summaryLabel}>Total Borrowed</span>
                        <HandCoins size={16} className={styles.colorPrimary} />
                    </div>
                    <h3 className={styles.summaryValue}>{formatMoney(totals.totalBorrowed)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}>
                        <span className={styles.summaryLabel}>Outstanding</span>
                        <TrendingDown size={16} className={styles.colorDanger} />
                    </div>
                    <h3 className={styles.summaryValue} style={{ color: 'var(--danger, #ef4444)' }}>{formatMoney(totals.totalOutstanding)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}>
                        <span className={styles.summaryLabel}>Active Loans</span>
                        <CheckCircle2 size={16} className={styles.colorWarning} />
                    </div>
                    <h3 className={styles.summaryValue}>{totals.activeCount}</h3>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <h3>Loan Portfolio</h3>
                    <span className={styles.panelMeta}>{loading ? 'Loading...' : `${loans.length} records`}</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID & Source</th>
                                <th>Branch</th>
                                <th>Terms</th>
                                <th style={{ textAlign: 'right' }}>Principal</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                                <th>Next Payment</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loans.map((loan) => (
                                <tr key={loan.id} className={`${styles.tableRow} ${loan.status === 'completed' || loan.status === 'closed' ? styles.completedRow : ''}`}>
                                    <td>
                                        <div className={styles.sourceCell}>
                                            <span className={styles.idBadge}>{loan.loan_code}</span>
                                            <span className={styles.sourceText}>{loan.source_name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.sourceText} style={{ color: 'var(--color-text-muted)' }}>{loan.branch_name || `Branch ${loan.branch_id}`}</span></td>
                                    <td>
                                        <div className={styles.termsCell}>
                                            <span className={`${styles.methodBadge} ${styles[`method${loan.interest_method}`]}`}>{loan.interest_method === 'flat' ? 'Flat' : 'Reducing'}</span>
                                            <span className={styles.rateText}>
                                                {loan.annual_interest_rate > 0 ? `${loan.annual_interest_rate}% · ${loan.duration_months} months` : `Interest-free · ${loan.duration_months} months`}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={styles.amountCell}>{formatMoney(loan.principal_amount)}</td>
                                    <td className={`${styles.amountCell} ${loan.outstanding_principal_amount > 0 ? styles.outstandingColor : ''}`}>
                                        <strong>{formatMoney(loan.outstanding_principal_amount)}</strong>
                                    </td>
                                    <td className={styles.dateCell}>
                                        {loan.next_due_date ? `${new Date(loan.next_due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })} · ${formatMoney(loan.next_payment_amount)}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`${styles.statusBadge} ${styles[`status${loan.status === 'closed' ? 'completed' : loan.status}`]}`}>
                                            {loan.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actionGroup} style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button
                                                className={styles.viewBtn}
                                                title="View Schedule"
                                                onClick={() => setSelectedLoanId(loan.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                className={styles.actionBtn}
                                                title="Edit"
                                                onClick={() => openEdit(loan)}
                                                disabled={!canManageLoans}
                                                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: canManageLoans ? 'pointer' : 'not-allowed', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && loans.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        No loans found for the selected branch scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3>Amortization Schedule</h3>
                        <span className={styles.tableSubtitle}>{selectedLoan ? `${selectedLoan.loan_code} — ${selectedLoan.source_name}` : 'Select a loan to review its schedule'}</span>
                    </div>
                    {selectedLoan && (
                        <span className={styles.tableSubtitle}>Settlement due {formatMoney(selectedLoanSettlementAmount)}</span>
                    )}
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 100 }}>Due Date</th>
                                <th style={{ textAlign: 'right' }}>Principal</th>
                                <th style={{ textAlign: 'right' }}>Interest</th>
                                <th style={{ textAlign: 'right' }}>Total Payment</th>
                                <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                                <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedule.map((row) => (
                                <tr key={row.id} className={styles.tableRow}>
                                    <td className={styles.numberCell}>{row.installment_no}</td>
                                    <td className={styles.dateCell}>{new Date(row.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</td>
                                    <td className={styles.amountCell}>{formatMoney(row.principal_amount)}</td>
                                    <td className={styles.amountCell}>{formatMoney(row.interest_amount)}</td>
                                    <td className={styles.amountCell}><strong className={styles.totalColor}>{formatMoney(row.total_due_amount)}</strong></td>
                                    <td className={styles.amountCell}><strong>{formatMoney(row.balance_after_amount)}</strong></td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`${styles.statusBadge} ${styles[`status${row.status}`]}`}>{row.status}</span>
                                    </td>
                                </tr>
                            ))}
                            {!schedule.length && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        {selectedLoan ? 'No repayment schedule found.' : 'Select a loan to review its repayment schedule.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={() => { setShowModal(false); setEditingLoan(null); }}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingLoan ? 'Edit Loan' : 'Add Loan'}</h2>
                            <button className={styles.closeBtn} onClick={() => { setShowModal(false); setEditingLoan(null); }}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Loan Source</label>
                                    <KitchenInput value={form.source_name} onChange={(event) => setForm((current) => ({ ...current, source_name: event.target.value }))} placeholder="e.g., Meezan Bank - Working Capital" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Branch</label>
                                    <KitchenSelect options={branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` }))} value={form.branch_id} onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Loan Amount</label>
                                    <KitchenInput type="number" value={form.principal_amount} onChange={(event) => setForm((current) => ({ ...current, principal_amount: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Interest Rate %</label>
                                    <KitchenInput type="number" value={form.annual_interest_rate} onChange={(event) => setForm((current) => ({ ...current, annual_interest_rate: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Interest Method</label>
                                    <KitchenSelect options={[{ value: 'flat', label: 'Flat Interest' }, { value: 'reducing', label: 'Reducing Balance' }]} value={form.interest_method} onChange={(event) => setForm((current) => ({ ...current, interest_method: event.target.value as 'flat' | 'reducing' }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Start Date</label>
                                    <KitchenInput type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Duration (months)</label>
                                    <KitchenInput type="number" value={form.duration_months} onChange={(event) => setForm((current) => ({ ...current, duration_months: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Repayment Schedule</label>
                                    <KitchenSelect options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} value={form.repayment_frequency} onChange={(event) => setForm((current) => ({ ...current, repayment_frequency: event.target.value as 'monthly' | 'quarterly' }))} />
                                </div>
                                {!editingLoan && (
                                    <>
                                        <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Disbursement Treasury Account</label>
                                            <KitchenSelect options={[{ value: '', label: 'Select treasury account' }, ...treasuryOptions]} value={form.disbursement_account_id} onChange={(event) => setForm((current) => ({ ...current, disbursement_account_id: event.target.value }))} />
                                        </div>
                                        <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Disbursement Reference</label>
                                            <KitchenInput value={form.disbursement_reference_no} onChange={(event) => setForm((current) => ({ ...current, disbursement_reference_no: event.target.value }))} placeholder="Bank advice or internal reference" />
                                        </div>
                                    </>
                                )}
                                {editingLoan && (
                                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                        <label>Accounting Note</label>
                                        <div className={styles.rateText}>Disbursement account and original posting stay locked after creation. If repayments already exist, schedule terms cannot be changed.</div>
                                    </div>
                                )}
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <KitchenInput value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional finance note" />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingLoan(null); }}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" isLoading={saving} onClick={() => void submit()} disabled={!canManageLoans}>
                                {editingLoan ? 'Save Changes' : 'Add Loan'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {showSettlementModal && selectedLoan && (
                <div className={styles.modalOverlay} onClick={() => setShowSettlementModal(false)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Settle Loan</h2>
                            <button className={styles.closeBtn} onClick={() => setShowSettlementModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Loan</label>
                                    <KitchenInput value={`${selectedLoan.loan_code} - ${selectedLoan.source_name}`} readOnly />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Settlement Amount</label>
                                    <KitchenInput value={formatMoney(selectedLoanSettlementAmount)} readOnly />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Outstanding Principal</label>
                                    <KitchenInput value={formatMoney(selectedLoan.outstanding_principal_amount)} readOnly />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Payment Date</label>
                                    <KitchenInput type="date" value={settlementForm.payment_date} onChange={(event) => setSettlementForm((current) => ({ ...current, payment_date: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Payment Method</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'Bank Transfer', label: 'Bank Transfer' },
                                            { value: 'Cash', label: 'Cash' },
                                            { value: 'Cheque', label: 'Cheque' },
                                        ]}
                                        value={settlementForm.payment_method}
                                        onChange={(event) => setSettlementForm((current) => ({ ...current, payment_method: event.target.value, treasury_account_id: '' }))}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Treasury Account</label>
                                    <KitchenSelect options={[{ value: '', label: 'Select treasury account' }, ...settlementTreasuryOptions]} value={settlementForm.treasury_account_id} onChange={(event) => setSettlementForm((current) => ({ ...current, treasury_account_id: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Reference No</label>
                                    <KitchenInput value={settlementForm.reference_no} onChange={(event) => setSettlementForm((current) => ({ ...current, reference_no: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Notes</label>
                                    <KitchenInput value={settlementForm.notes} onChange={(event) => setSettlementForm((current) => ({ ...current, notes: event.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowSettlementModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" isLoading={settling} onClick={() => void submitSettlement()} disabled={!canManageLoans || !settlementForm.treasury_account_id}>
                                Settle Loan
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
