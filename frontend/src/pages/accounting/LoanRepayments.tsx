/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, Building2, CheckCircle2, Clock, CreditCard, Download, Filter, Plus, X,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './LoanRepayments.module.css';

type LoanOption = {
    id: number;
    loan_code: string;
    source_name: string;
};

type RepaymentRow = {
    id: number;
    loan_id: number;
    loan_code: string | null;
    source_name: string | null;
    branch_id: number;
    branch_name: string | null;
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

type PaymentFormState = {
    repayment_id: string;
    payment_date: string;
    amount_paid: string;
    payment_method: string;
    treasury_account_id: string;
    reference_no: string;
    notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const EMPTY_PAYMENT_FORM: PaymentFormState = {
    repayment_id: '',
    payment_date: today,
    amount_paid: '',
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

export function LoanRepayments() {
    const { branches, activeBranch } = useBranchContext();
    const { canViewLoans, canManageLoans } = usePermissionAccess();
    const [selectedBranch, setSelectedBranch] = useState(activeBranch ? String(activeBranch.branch_id) : 'all');
    const [loanFilter, setLoanFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'due' | 'overdue'>('all');
    const [loans, setLoans] = useState<LoanOption[]>([]);
    const [repayments, setRepayments] = useState<RepaymentRow[]>([]);
    const [accounts, setAccounts] = useState<TreasuryOption[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedRepayment, setSelectedRepayment] = useState<RepaymentRow | null>(null);
    const [form, setForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const loanOptions = useMemo(
        () => [
            { value: 'all', label: 'All Loans' },
            ...loans.map((loan) => ({ value: String(loan.id), label: `${loan.loan_code} — ${loan.source_name}` })),
        ],
        [loans],
    );

    const treasuryOptions = useMemo(() => {
        const branchId = selectedRepayment?.branch_id ?? (selectedBranch !== 'all' ? Number(selectedBranch) : null);
        return accounts
            .filter((account) => !branchId || !account.branch_id || Number(account.branch_id) === Number(branchId))
            .filter((account) => form.payment_method === 'Cash' ? account.is_cash_account : account.is_bank_account)
            .map((account) => ({ value: account.id, label: account.label }));
    }, [accounts, selectedRepayment?.branch_id, selectedBranch, form.payment_method]);

    const loadLoans = useCallback(async () => {
        try {
            const rows = await accountingApi.getLoans({
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
            });
            setLoans(rows.map((row) => ({ id: row.id, loan_code: row.loan_code, source_name: row.source_name })));
        } catch {
            setLoans([]);
        }
    }, [selectedBranch]);

    const loadRepayments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await accountingApi.getLoanRepayments({
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
                loan_id: loanFilter === 'all' ? null : loanFilter,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
            setRepayments(rows);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load loan repayments.');
            setRepayments([]);
        } finally {
            setLoading(false);
        }
    }, [loanFilter, selectedBranch, statusFilter]);

    useEffect(() => {
        void loadLoans();
    }, [loadLoans]);

    useEffect(() => {
        void loadRepayments();
    }, [loadRepayments]);

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
        totalPaid: repayments.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
        totalDue: repayments.filter((row) => row.status !== 'paid').reduce((sum, row) => sum + Number(row.remaining_due_amount || 0), 0),
        overdueCount: repayments.filter((row) => row.status === 'overdue').length,
    }), [repayments]);

    const openRecordModal = (row?: RepaymentRow) => {
        if (!canManageLoans) {
            setError('You do not have permission to record loan repayments.');
            return;
        }
        const target = row ?? repayments.find((item) => item.status !== 'paid') ?? null;
        setSelectedRepayment(target);
        setForm({
            repayment_id: target ? String(target.id) : '',
            payment_date: today,
            amount_paid: target ? String(target.remaining_due_amount) : '',
            payment_method: 'Bank Transfer',
            treasury_account_id: '',
            reference_no: '',
            notes: '',
        });
        setShowModal(true);
    };

    const submit = async () => {
        if (!canManageLoans) {
            setError('You do not have permission to record loan repayments.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await accountingApi.recordLoanRepayment({
                repayment_id: Number(form.repayment_id),
                payment_date: form.payment_date,
                amount_paid: Number(form.amount_paid),
                payment_method: form.payment_method,
                treasury_account_id: Number(form.treasury_account_id),
                reference_no: form.reference_no || undefined,
                notes: form.notes || undefined,
            }, selectedRepayment?.branch_id);
            setShowModal(false);
            setSelectedRepayment(null);
            setForm(EMPTY_PAYMENT_FORM);
            await loadRepayments();
            await loadLoans();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to record repayment.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><CreditCard size={18} /></div>
                    <div>
                        <h1>Loan Repayments</h1>
                        <p>Track schedule status and post real treasury-backed repayments.</p>
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
                    <KitchenButton variant="primary" size="sm" className={styles.actionBtn} onClick={() => openRecordModal()} disabled={!canManageLoans}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Record Payment
                    </KitchenButton>
                </div>
            </header>

            {error && <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--danger, #ef4444)' }}>{error}</div>}
            {!canViewLoans && (
                <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                    You do not have permission to access loan repayments.
                </div>
            )}

            <div className={styles.topSection}>
                <div className={`${styles.polishedPanel} ${styles.filterPanel}`}>
                    <div className={styles.filterGroup}>
                        <label>Filter by Loan</label>
                        <div className={styles.filterInputWrapper}>
                            <Filter size={14} className={styles.filterIcon} />
                            <KitchenSelect options={loanOptions} value={loanFilter} onChange={(event) => setLoanFilter(event.target.value)} />
                        </div>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Filter by Status</label>
                        <div className={styles.filterInputWrapper}>
                            <Filter size={14} className={styles.filterIcon} />
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All Statuses' },
                                    { value: 'paid', label: 'Paid' },
                                    { value: 'due', label: 'Due' },
                                    { value: 'overdue', label: 'Overdue' },
                                ]}
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'paid' | 'due' | 'overdue')}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Total Paid</span>
                            <CheckCircle2 size={16} className={styles.colorSuccess} />
                        </div>
                        <h3 className={styles.summaryValue}>{formatMoney(totals.totalPaid)}</h3>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Total Due</span>
                            <Clock size={16} className={styles.colorWarning} />
                        </div>
                        <h3 className={styles.summaryValue}>{formatMoney(totals.totalDue)}</h3>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryTop}>
                            <span className={styles.summaryLabel}>Overdue</span>
                            <AlertTriangle size={16} className={styles.colorDanger} />
                        </div>
                        <h3 className={styles.summaryValue} style={{ color: totals.overdueCount > 0 ? 'var(--danger, #ef4444)' : 'inherit' }}>
                            {totals.overdueCount} {totals.overdueCount === 1 ? 'payment' : 'payments'}
                        </h3>
                    </div>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <h3>Repayment Schedule</h3>
                    <span className={styles.panelMeta}>{loading ? 'Loading...' : `${repayments.length} records`}</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>Record ID</th>
                                <th>Loan Source</th>
                                <th>Branch</th>
                                <th>Due Date</th>
                                <th style={{ textAlign: 'right' }}>Principal</th>
                                <th style={{ textAlign: 'right' }}>Interest</th>
                                <th style={{ textAlign: 'right' }}>Total Due</th>
                                <th style={{ textAlign: 'right' }}>Paid Amount</th>
                                <th>Paid On</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {repayments.map((row) => (
                                <tr key={row.id} className={styles.tableRow} onClick={() => openRecordModal(row)} style={{ cursor: canManageLoans && row.status !== 'paid' ? 'pointer' : 'default' }}>
                                    <td><span className={styles.idBadge}>{row.loan_code}-{row.installment_no}</span></td>
                                    <td>
                                        <div className={styles.loanCell}>
                                            <span className={styles.loanRef}>{row.loan_code}</span>
                                            <span className={styles.loanName}>{row.source_name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.loanName} style={{ color: 'var(--color-text-muted)' }}>{row.branch_name || `Branch ${row.branch_id}`}</span></td>
                                    <td className={styles.dateCell}>{new Date(row.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className={styles.amountCell}>{formatMoney(row.principal_amount)}</td>
                                    <td className={styles.amountCell}>{row.interest_amount > 0 ? formatMoney(row.interest_amount) : '—'}</td>
                                    <td className={styles.amountCell}><strong>{formatMoney(row.total_due_amount)}</strong></td>
                                    <td className={`${styles.amountCell} ${row.paid_amount > 0 ? styles.paidColor : ''}`}><strong>{row.paid_amount > 0 ? formatMoney(row.paid_amount) : '—'}</strong></td>
                                    <td className={styles.dateCell}>{row.paid_date ? new Date(row.paid_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`${styles.statusBadge} ${styles[`status${row.status}`]}`}>
                                            {row.status === 'paid' && <CheckCircle2 size={10} />}
                                            {row.status === 'overdue' && <AlertTriangle size={10} />}
                                            {row.status === 'due' && <Clock size={10} />}
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && repayments.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        No repayment rows found for the selected scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Record Repayment</h2>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Installment</label>
                                    <KitchenSelect
                                        options={repayments
                                            .filter((row) => row.status !== 'paid')
                                            .map((row) => ({
                                                value: String(row.id),
                                                label: `${row.loan_code} · #${row.installment_no} · ${formatMoney(row.remaining_due_amount)} due`,
                                            }))}
                                        value={form.repayment_id}
                                        onChange={(event) => {
                                            const target = repayments.find((row) => Number(row.id) === Number(event.target.value)) ?? null;
                                            setSelectedRepayment(target);
                                            setForm((current) => ({
                                                ...current,
                                                repayment_id: event.target.value,
                                                amount_paid: target ? String(target.remaining_due_amount) : '',
                                                treasury_account_id: '',
                                            }));
                                        }}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Payment Date</label>
                                    <KitchenInput type="date" value={form.payment_date} onChange={(event) => setForm((current) => ({ ...current, payment_date: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Amount Paid</label>
                                    <KitchenInput type="number" value={form.amount_paid} onChange={(event) => setForm((current) => ({ ...current, amount_paid: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Payment Method</label>
                                    <KitchenSelect
                                        options={[
                                            { value: 'Bank Transfer', label: 'Bank Transfer' },
                                            { value: 'Cash', label: 'Cash' },
                                            { value: 'Cheque', label: 'Cheque' },
                                        ]}
                                        value={form.payment_method}
                                        onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value, treasury_account_id: '' }))}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Treasury Account</label>
                                    <KitchenSelect options={[{ value: '', label: 'Select treasury account' }, ...treasuryOptions]} value={form.treasury_account_id} onChange={(event) => setForm((current) => ({ ...current, treasury_account_id: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Reference No</label>
                                    <KitchenInput value={form.reference_no} onChange={(event) => setForm((current) => ({ ...current, reference_no: event.target.value }))} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Notes</label>
                                    <KitchenInput value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" isLoading={saving} onClick={() => void submit()} disabled={!canManageLoans}>
                                Record Payment
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
