import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Edit2, Eye, Plus, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { accountingApi, branchApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './InvestorManagement.module.css';

type InvestorAgreement = {
    id: number;
    agreement_code: string;
    agreement_name: string;
    branch_id: number;
    branch_name: string | null;
    agreement_type: 'profit_share' | 'fixed_return' | 'hybrid';
    distribution_frequency: 'monthly' | 'quarterly';
    capital_commitment_amount: number;
    current_capital_balance: number;
    profit_share_percent: number;
    fixed_return_percent: number;
    management_charge_percent: number;
    total_distributed_amount: number;
    effective_from: string;
    effective_to: string | null;
    status: 'draft' | 'active' | 'matured' | 'closed';
};

type InvestorRow = {
    id: number;
    investor_code: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    status: 'active' | 'inactive' | 'suspended' | 'closed';
    notes: string | null;
    active_agreement_count: number;
    current_capital_balance: number;
    total_distributed_amount: number;
    agreements: InvestorAgreement[];
};

type InvestorStatement = {
    investor: { full_name: string; investor_code: string };
    summary: {
        agreement_count: number;
        capital_inflows: number;
        capital_outflows: number;
        current_capital_balance: number;
        profit_distributed: number;
        management_charges: number;
        net_paid_to_investor: number;
    };
    transactions: Array<{
        id: number;
        transaction_date: string;
        transaction_type: string;
        amount: number;
        description: string | null;
        agreement_code: string | null;
        branch_name: string | null;
    }>;
};

type InvestorFormState = {
    full_name: string;
    phone: string;
    email: string;
    status: string;
    notes: string;
    agreement_id?: number;
    agreement_name: string;
    branch_id: string;
    branch_ids: string[];
    agreement_type: string;
    distribution_frequency: string;
    capital_commitment_amount: string;
    profit_share_percent: string;
    fixed_return_percent: string;
    management_charge_percent: string;
    effective_from: string;
    effective_to: string;
    agreement_status: string;
};

type CapitalReturnFormState = {
    transaction_date: string;
    reference_no: string;
    description: string;
};

const EMPTY_FORM: InvestorFormState = {
    full_name: '',
    phone: '',
    email: '',
    status: 'active',
    notes: '',
    agreement_name: '',
    branch_id: '',
    branch_ids: [],
    agreement_type: 'profit_share',
    distribution_frequency: 'monthly',
    capital_commitment_amount: '0',
    profit_share_percent: '0',
    fixed_return_percent: '0',
    management_charge_percent: '0',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    agreement_status: 'active',
};

const EMPTY_CAPITAL_RETURN_FORM: CapitalReturnFormState = {
    transaction_date: new Date().toISOString().slice(0, 10),
    reference_no: '',
    description: '',
};

function formatCurrency(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString()}`;
}

function normalizeBranchRow(branch: any): { id: string; name: string } | null {
    const id = branch?.branch_id ?? branch?.id;
    if (!id) {
        return null;
    }
    return {
        id: String(id),
        name: branch?.branch_name || branch?.name || `Branch ${id}`,
    };
}

function hydrateForm(investor?: InvestorRow | null): InvestorFormState {
    const agreement = investor?.agreements?.find((item) => item.status === 'active') ?? investor?.agreements?.[0];
    return {
        full_name: investor?.full_name ?? '',
        phone: investor?.phone ?? '',
        email: investor?.email ?? '',
        status: investor?.status ?? 'active',
        notes: investor?.notes ?? '',
        agreement_id: agreement?.id,
        agreement_name: agreement?.agreement_name ?? '',
        branch_id: agreement?.branch_id ? String(agreement.branch_id) : '',
        branch_ids: agreement?.branch_id ? [String(agreement.branch_id)] : [],
        agreement_type: agreement?.agreement_type ?? 'profit_share',
        distribution_frequency: agreement?.distribution_frequency ?? 'monthly',
        capital_commitment_amount: agreement ? String(agreement.capital_commitment_amount) : '0',
        profit_share_percent: agreement ? String(agreement.profit_share_percent) : '0',
        fixed_return_percent: agreement ? String(agreement.fixed_return_percent) : '0',
        management_charge_percent: agreement ? String(agreement.management_charge_percent) : '0',
        effective_from: agreement?.effective_from ?? new Date().toISOString().slice(0, 10),
        effective_to: agreement?.effective_to ?? '',
        agreement_status: agreement?.status ?? 'active',
    };
}

export function InvestorManagement() {
    const { branches: contextBranches, activeBranch } = useBranchContext();
    const { canViewInvestors, canManageInvestors } = usePermissionAccess();
    const [availableBranches, setAvailableBranches] = useState<Array<{ id: string; name: string }>>([]);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [investors, setInvestors] = useState<InvestorRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showCapitalReturnModal, setShowCapitalReturnModal] = useState(false);
    const [editingInvestor, setEditingInvestor] = useState<InvestorRow | null>(null);
    const [form, setForm] = useState<InvestorFormState>(EMPTY_FORM);
    const [capitalReturnForm, setCapitalReturnForm] = useState<CapitalReturnFormState>(EMPTY_CAPITAL_RETURN_FORM);
    const [capitalReturnTarget, setCapitalReturnTarget] = useState<{ investor: InvestorRow; agreement: InvestorAgreement } | null>(null);
    const [statement, setStatement] = useState<InvestorStatement | null>(null);
    const [statementLoading, setStatementLoading] = useState(false);

    useEffect(() => {
        const normalizedContext = contextBranches
            .map((branch) => normalizeBranchRow(branch))
            .filter((branch): branch is { id: string; name: string } => Boolean(branch));

        if (normalizedContext.length > 0) {
            setAvailableBranches(normalizedContext);
            return;
        }

        let cancelled = false;
        void branchApi.getBranches()
            .then((rows) => {
                if (cancelled) {
                    return;
                }
                const normalized = (rows || [])
                    .map((branch) => normalizeBranchRow(branch))
                    .filter((branch): branch is { id: string; name: string } => Boolean(branch));
                setAvailableBranches(normalized);
            })
            .catch(() => {
                if (!cancelled) {
                    setAvailableBranches([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [contextBranches]);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...availableBranches.map((branch) => ({
                value: branch.id,
                label: branch.name,
            })),
        ],
        [availableBranches],
    );

    const selectedAgreementBranches = useMemo(
        () => availableBranches.filter((branch) => form.branch_ids.includes(branch.id)),
        [availableBranches, form.branch_ids],
    );

    const loadInvestors = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await accountingApi.getInvestors({
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
            });
            setInvestors(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load investors');
        } finally {
            setLoading(false);
        }
    }, [selectedBranch]);

    useEffect(() => {
        void loadInvestors();
    }, [activeBranch, loadInvestors, selectedBranch]);

    const totals = useMemo(() => ({
        capital: investors.reduce((sum, investor) => sum + Number(investor.current_capital_balance || 0), 0),
        distributed: investors.reduce((sum, investor) => sum + Number(investor.total_distributed_amount || 0), 0),
        active: investors.filter((investor) => investor.status === 'active').length,
    }), [investors]);

    const openCapitalReturn = (investor: InvestorRow, agreement?: InvestorAgreement) => {
        if (!canManageInvestors) {
            setError('You do not have permission to return investor capital.');
            return;
        }
        const targetAgreement = agreement ?? investor.agreements.find((item) => item.status === 'active') ?? investor.agreements[0];
        if (!targetAgreement) {
            setError('This investor does not have an agreement to return capital from.');
            return;
        }
        if (Number(targetAgreement.current_capital_balance || 0) <= 0) {
            setError('This agreement has no capital balance left to return.');
            return;
        }
        setCapitalReturnTarget({ investor, agreement: targetAgreement });
        setCapitalReturnForm({
            transaction_date: new Date().toISOString().slice(0, 10),
            reference_no: `${targetAgreement.agreement_code}-RETURN`,
            description: `Full capital return for ${targetAgreement.agreement_name}`,
        });
        setShowCapitalReturnModal(true);
    };

    const openCreate = () => {
        if (!canManageInvestors) {
            setError('You do not have permission to create investors.');
            return;
        }
        setEditingInvestor(null);
        setForm(EMPTY_FORM);
        setBranchDropdownOpen(false);
        setShowModal(true);
    };

    const openEdit = (investor: InvestorRow) => {
        if (!canManageInvestors) {
            setError('You do not have permission to edit investors.');
            return;
        }
        setEditingInvestor(investor);
        setForm(hydrateForm(investor));
        setBranchDropdownOpen(false);
        setShowModal(true);
    };

    const openStatement = async (investor: InvestorRow) => {
        if (!canViewInvestors) {
            setError('You do not have permission to review investor statements.');
            return;
        }
        setStatementLoading(true);
        setStatement(null);
        try {
            const data = await accountingApi.getInvestorStatement(investor.id, {
                branch_id: selectedBranch === 'all' ? null : selectedBranch,
            });
            setStatement(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load investor statement');
        } finally {
            setStatementLoading(false);
        }
    };

    const submit = async () => {
        if (!canManageInvestors) {
            setError('You do not have permission to manage investors.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const investorPayload = {
                full_name: form.full_name,
                phone: form.phone || undefined,
                email: form.email || undefined,
                status: form.status,
                notes: form.notes || undefined,
            };
            const investor = (editingInvestor
                ? await accountingApi.updateInvestor(editingInvestor.id, investorPayload)
                : await accountingApi.createInvestor(investorPayload)) as { id: number };

            const selectedAgreementBranchIds = (editingInvestor ? [form.branch_id] : form.branch_ids)
                .filter(Boolean)
                .map((value) => String(value));

            if (selectedAgreementBranchIds.length > 0 && form.agreement_name.trim()) {
                if (form.agreement_id) {
                    const primaryBranchId = selectedAgreementBranchIds[0];
                    const agreementPayload = {
                        investor_id: investor.id,
                        branch_id: Number(primaryBranchId),
                        agreement_name: form.agreement_name,
                        agreement_type: form.agreement_type,
                        distribution_frequency: form.distribution_frequency,
                        capital_commitment_amount: Number(form.capital_commitment_amount || 0),
                        profit_share_percent: Number(form.profit_share_percent || 0),
                        fixed_return_percent: Number(form.fixed_return_percent || 0),
                        management_charge_percent: Number(form.management_charge_percent || 0),
                        effective_from: form.effective_from,
                        effective_to: form.effective_to || undefined,
                        status: form.agreement_status,
                    };
                    await accountingApi.updateInvestorAgreement(form.agreement_id, agreementPayload);
                } else {
                    for (const branchId of selectedAgreementBranchIds) {
                        await accountingApi.createInvestorAgreement({
                            investor_id: investor.id,
                            branch_id: Number(branchId),
                            agreement_name: form.agreement_name,
                            agreement_type: form.agreement_type,
                            distribution_frequency: form.distribution_frequency,
                            capital_commitment_amount: Number(form.capital_commitment_amount || 0),
                            profit_share_percent: Number(form.profit_share_percent || 0),
                            fixed_return_percent: Number(form.fixed_return_percent || 0),
                            management_charge_percent: Number(form.management_charge_percent || 0),
                            effective_from: form.effective_from,
                            effective_to: form.effective_to || undefined,
                            status: form.agreement_status,
                        });
                    }
                }
            }

            setShowModal(false);
            setEditingInvestor(null);
            setForm(EMPTY_FORM);
            await loadInvestors();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save investor');
        } finally {
            setSaving(false);
        }
    };

    const submitCapitalReturn = async () => {
        if (!canManageInvestors) {
            setError('You do not have permission to return investor capital.');
            return;
        }
        if (!capitalReturnTarget) {
            setError('Select an investor agreement first.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await accountingApi.returnInvestorCapital({
                investor_id: capitalReturnTarget.investor.id,
                agreement_id: capitalReturnTarget.agreement.id,
                branch_id: capitalReturnTarget.agreement.branch_id,
                transaction_date: capitalReturnForm.transaction_date,
                reference_no: capitalReturnForm.reference_no || undefined,
                description: capitalReturnForm.description || undefined,
            });
            setShowCapitalReturnModal(false);
            setCapitalReturnTarget(null);
            setCapitalReturnForm(EMPTY_CAPITAL_RETURN_FORM);
            await loadInvestors();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to return investment capital');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Users size={18} /></div>
                    <div>
                        <h1>Investor Management</h1>
                        <p>Investor masters with branch-linked sharing agreements.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} />
                    </div>
                    <KitchenButton variant="primary" size="sm" onClick={openCreate} disabled={!canManageInvestors}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Add Investor
                    </KitchenButton>
                </div>
            </header>

            {error && <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--danger, #ef4444)' }}>{error}</div>}
            {!canViewInvestors && (
                <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                    You do not have permission to access investor records.
                </div>
            )}

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}><span className={styles.summaryLabel}>Current Capital</span><Wallet size={16} className={styles.colorPrimary} /></div>
                    <h3 className={styles.summaryValue}>{formatCurrency(totals.capital)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}><span className={styles.summaryLabel}>Distributed</span><TrendingUp size={16} className={styles.colorSuccess} /></div>
                    <h3 className={styles.summaryValue}>{formatCurrency(totals.distributed)}</h3>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}><span className={styles.summaryLabel}>Active Investors</span><Users size={16} className={styles.colorInfo} /></div>
                    <h3 className={styles.summaryValue}>{totals.active}</h3>
                </div>
            </div>

            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <h3>Investor Roster</h3>
                    <span className={styles.panelMeta}>{loading ? 'Loading...' : `${investors.length} records`}</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Investor</th>
                                <th>Agreement</th>
                                <th>Branch</th>
                                <th style={{ textAlign: 'right' }}>Current Capital</th>
                                <th style={{ textAlign: 'right' }}>Distributed</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ width: 70, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {investors.map((investor) => {
                                const activeAgreement = investor.agreements.find((item) => item.status === 'active') ?? investor.agreements[0];
                                return (
                                    <tr key={investor.id} className={styles.tableRow}>
                                        <td>
                                            <div className={styles.cellCol}>
                                                <strong className={styles.investorName}>{investor.full_name}</strong>
                                                <span className={styles.contactText}>{investor.investor_code}{investor.email ? ` | ${investor.email}` : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.cellCol}>
                                                <span className={`${styles.typeBadge} ${styles[`type${activeAgreement?.agreement_type ?? 'equity'}`]}`}>{activeAgreement?.agreement_name ?? 'No agreement'}</span>
                                                <span className={styles.returnText}>
                                                    {activeAgreement
                                                        ? `${activeAgreement.agreement_type.replace('_', ' ')} | ${activeAgreement.distribution_frequency}`
                                                        : 'Create an agreement to enable distributions'}
                                                </span>
                                            </div>
                                        </td>
                                        <td><span className={styles.contactText}>{activeAgreement?.branch_name ?? 'Unassigned'}</span></td>
                                        <td className={styles.amountCell}><strong>{formatCurrency(investor.current_capital_balance)}</strong></td>
                                        <td className={styles.amountCell}><strong>{formatCurrency(investor.total_distributed_amount)}</strong></td>
                                        <td style={{ textAlign: 'center' }}><span className={`${styles.statusBadge} ${styles[`status${investor.status}`]}`}>{investor.status}</span></td>
                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button className={styles.actionBtn} onClick={() => void openStatement(investor)} title="Statement" disabled={!canViewInvestors}><Eye size={14} /></button>
                                                <button className={styles.actionBtn} onClick={() => openCapitalReturn(investor, activeAgreement)} title="Return Capital" disabled={!canManageInvestors || !activeAgreement || Number(activeAgreement.current_capital_balance || 0) <= 0}><Wallet size={14} /></button>
                                                <button className={styles.actionBtn} onClick={() => openEdit(investor)} title="Edit" disabled={!canManageInvestors}><Edit2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && investors.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No investors found for the selected branch scope.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={`${styles.modal} ${styles.investorModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderText}>
                                <h2>{editingInvestor ? 'Edit Investor' : 'Add Investor'}</h2>
                                <p>
                                    {editingInvestor
                                        ? 'Update the investor profile and agreement terms used for capital tracking and profit distribution.'
                                        : 'Create an investor profile and set up the initial agreement for capital intake and future distribution.'}
                                </p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.investorModalSummary}>
                                <div className={styles.investorSummaryCard}>
                                    <span className={styles.investorSummaryLabel}>Investor status</span>
                                    <strong className={styles.investorSummaryValue}>{form.status.replace('_', ' ')}</strong>
                                    <span className={styles.investorSummaryMeta}>Profile state used for day-to-day access and agreement handling.</span>
                                </div>
                                <div className={styles.investorSummaryCard}>
                                    <span className={styles.investorSummaryLabel}>Agreement branch</span>
                                    <strong className={styles.investorSummaryValue}>
                                        {editingInvestor
                                            ? availableBranches.find((branch) => branch.id === form.branch_id)?.name || 'Select branch'
                                            : selectedAgreementBranches.length > 1
                                                ? `${selectedAgreementBranches.length} branches selected`
                                                : selectedAgreementBranches[0]?.name || 'Select branch'}
                                    </strong>
                                    <span className={styles.investorSummaryMeta}>Branch where this investment agreement is operationally linked.</span>
                                </div>
                                <div className={styles.investorSummaryCard}>
                                    <span className={styles.investorSummaryLabel}>Capital commitment</span>
                                    <strong className={styles.investorSummaryValue}>{formatCurrency(Number(form.capital_commitment_amount || 0))}</strong>
                                    <span className={styles.investorSummaryMeta}>Committed capital under the current agreement setup.</span>
                                </div>
                            </div>

                            <div className={styles.investorModalLayout}>
                                <section className={styles.formSection}>
                                    <div className={styles.formSectionHeader}>
                                        <strong>Investor profile</strong>
                                        <span>Basic contact and master status information.</span>
                                    </div>
                                    <div className={styles.formGrid}>
                                        <KitchenInput label="Investor Name" value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
                                        <KitchenSelect label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }, { value: 'closed', label: 'Closed' }]} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} />
                                        <KitchenInput label="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                                        <KitchenInput label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                            <label>Notes</label>
                                            <textarea className={styles.commentBox} rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                                        </div>
                                    </div>
                                </section>

                                <section className={styles.formSection}>
                                    <div className={styles.formSectionHeader}>
                                        <strong>Agreement setup</strong>
                                        <span>Branch allocation, return model, capital, and effective terms.</span>
                                    </div>
                                    <div className={styles.formGrid}>
                                        <KitchenInput label="Agreement Name" value={form.agreement_name} onChange={(event) => setForm((current) => ({ ...current, agreement_name: event.target.value }))} />
                                        {editingInvestor ? (
                                            <KitchenSelect
                                                label="Agreement Branch"
                                                options={[{ value: '', label: 'Select branch' }, ...availableBranches.map((branch) => ({ value: branch.id, label: branch.name }))]}
                                                value={form.branch_id}
                                                onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value, branch_ids: event.target.value ? [event.target.value] : [] }))}
                                            />
                                        ) : (
                                            <div className={`${styles.formGroup} ${styles.branchPickerGroup}`}>
                                                <label>Agreement Branches</label>
                                                <div className={styles.branchMultiSelect}>
                                                    <button
                                                        type="button"
                                                        className={styles.branchDropdownTrigger}
                                                        onClick={() => setBranchDropdownOpen((current) => !current)}
                                                    >
                                                        <span className={styles.branchDropdownValue}>
                                                            {selectedAgreementBranches.length === 0
                                                                ? 'Select branches'
                                                                : selectedAgreementBranches.length === 1
                                                                    ? selectedAgreementBranches[0].name
                                                                    : `${selectedAgreementBranches.length} branches selected`}
                                                        </span>
                                                        <span className={styles.branchDropdownMeta}>
                                                            {selectedAgreementBranches.length === 0
                                                                ? 'Choose one or more branches'
                                                                : selectedAgreementBranches.map((branch) => branch.name).join(', ')}
                                                        </span>
                                                    </button>
                                                    {branchDropdownOpen && (
                                                        <div className={styles.branchDropdownMenu}>
                                                            {availableBranches.length > 0 ? availableBranches.map((branch) => {
                                                                const selected = form.branch_ids.includes(branch.id);
                                                                return (
                                                                    <label key={branch.id} className={styles.branchDropdownOption}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selected}
                                                                            onChange={() => setForm((current) => {
                                                                                const nextBranchIds = current.branch_ids.includes(branch.id)
                                                                                    ? current.branch_ids.filter((item) => item !== branch.id)
                                                                                    : [...current.branch_ids, branch.id];
                                                                                return {
                                                                                    ...current,
                                                                                    branch_ids: nextBranchIds,
                                                                                    branch_id: nextBranchIds[0] || '',
                                                                                };
                                                                            })}
                                                                        />
                                                                        <span>{branch.name}</span>
                                                                    </label>
                                                                );
                                                            }) : (
                                                                <div className={styles.branchPickerEmpty}>No branches available.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={styles.branchPickerHelp}>Select one or more branches. The system will create one agreement record per selected branch.</span>
                                            </div>
                                        )}
                                        <KitchenSelect label="Agreement Type" options={[{ value: 'profit_share', label: 'Profit Share' }, { value: 'fixed_return', label: 'Fixed Return' }, { value: 'hybrid', label: 'Hybrid' }]} value={form.agreement_type} onChange={(event) => setForm((current) => ({ ...current, agreement_type: event.target.value }))} />
                                        <KitchenSelect label="Frequency" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} value={form.distribution_frequency} onChange={(event) => setForm((current) => ({ ...current, distribution_frequency: event.target.value }))} />
                                        <KitchenInput label="Capital Commitment" type="number" value={form.capital_commitment_amount} onChange={(event) => setForm((current) => ({ ...current, capital_commitment_amount: event.target.value }))} />
                                        <KitchenSelect label="Agreement Status" options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'matured', label: 'Matured' }, { value: 'closed', label: 'Closed' }]} value={form.agreement_status} onChange={(event) => setForm((current) => ({ ...current, agreement_status: event.target.value }))} />
                                        <KitchenInput label="Profit Share %" type="number" value={form.profit_share_percent} onChange={(event) => setForm((current) => ({ ...current, profit_share_percent: event.target.value }))} />
                                        <KitchenInput label="Fixed Return %" type="number" value={form.fixed_return_percent} onChange={(event) => setForm((current) => ({ ...current, fixed_return_percent: event.target.value }))} />
                                        <KitchenInput label="Management Charge %" type="number" value={form.management_charge_percent} onChange={(event) => setForm((current) => ({ ...current, management_charge_percent: event.target.value }))} />
                                        <KitchenInput label="Effective From" type="date" value={form.effective_from} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} />
                                        <KitchenInput label="Effective To" type="date" value={form.effective_to} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} />
                                    </div>
                                </section>
                            </div>
                            <div className={styles.formNote}>
                                Keep the agreement name and return setup aligned with the signed investor understanding. This reduces confusion during distribution and capital-return processing.
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="md" className={styles.modalActionBtn} onClick={() => setShowModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="md" className={styles.modalActionBtn} isLoading={saving} onClick={() => void submit()} disabled={!canManageInvestors}>
                                {editingInvestor ? 'Save Changes' : 'Create Investor'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {showCapitalReturnModal && capitalReturnTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowCapitalReturnModal(false)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Return Capital</h2>
                            <button className={styles.closeBtn} onClick={() => setShowCapitalReturnModal(false)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <KitchenInput label="Investor" value={capitalReturnTarget.investor.full_name} readOnly />
                                <KitchenInput label="Agreement" value={`${capitalReturnTarget.agreement.agreement_code} | ${capitalReturnTarget.agreement.agreement_name}`} readOnly />
                                <KitchenInput label="Branch" value={capitalReturnTarget.agreement.branch_name || `Branch ${capitalReturnTarget.agreement.branch_id}`} readOnly />
                                <KitchenInput label="Return Amount" value={formatCurrency(Number(capitalReturnTarget.agreement.current_capital_balance || 0))} readOnly />
                                <KitchenInput label="Transaction Date" type="date" value={capitalReturnForm.transaction_date} onChange={(event) => setCapitalReturnForm((current) => ({ ...current, transaction_date: event.target.value }))} />
                                <KitchenInput label="Reference No" value={capitalReturnForm.reference_no} onChange={(event) => setCapitalReturnForm((current) => ({ ...current, reference_no: event.target.value }))} />
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Description</label>
                                    <textarea className={styles.commentBox} rows={3} value={capitalReturnForm.description} onChange={(event) => setCapitalReturnForm((current) => ({ ...current, description: event.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowCapitalReturnModal(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" isLoading={saving} onClick={() => void submitCapitalReturn()} disabled={!canManageInvestors}>
                                Return Capital
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {(statementLoading || statement) && (
                <div className={styles.modalOverlay} onClick={() => setStatement(null)}>
                    <div className={`${styles.modal} ${styles.ledgerModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Investor Statement</h2>
                                <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{statement?.investor.full_name ?? 'Loading...'}</p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setStatement(null)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {statementLoading && <p>Loading statement...</p>}
                            {statement && (
                                <>
                                    <div className={styles.ledgerHeader}>
                                        <div className={styles.ledgerStat}><span>Current Capital</span><strong>{formatCurrency(statement.summary.current_capital_balance)}</strong></div>
                                        <div className={styles.ledgerStat}><span>Net Paid</span><strong>{formatCurrency(statement.summary.net_paid_to_investor)}</strong></div>
                                    </div>
                                    <div className={styles.tableWrap} style={{ maxHeight: 420 }}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Type</th>
                                                    <th>Agreement</th>
                                                    <th>Branch</th>
                                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {statement.transactions.map((row) => (
                                                    <tr key={row.id} className={styles.tableRow}>
                                                        <td>{new Date(row.transaction_date).toLocaleDateString()}</td>
                                                        <td>{row.transaction_type.replaceAll('_', ' ')}</td>
                                                        <td>{row.agreement_code ?? '-'}</td>
                                                        <td>{row.branch_name ?? '-'}</td>
                                                        <td className={styles.amountCell}>{formatCurrency(row.amount)}</td>
                                                    </tr>
                                                ))}
                                                {statement.transactions.length === 0 && (
                                                    <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--color-text-muted)' }}>No statement activity found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
