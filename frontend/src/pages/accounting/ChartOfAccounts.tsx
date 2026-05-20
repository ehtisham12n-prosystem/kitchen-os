import { useEffect, useMemo, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    BookOpen, Search, Plus, ChevronRight, ChevronDown, Edit2,
    X, Filter, Download, FolderTree, Building2, Lock, Landmark, Wallet
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import styles from './ChartOfAccounts.module.css';

type UiAccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

interface ApiAccount {
    id: number;
    account_code: string;
    account_name: string;
    account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    parent_id: number | null;
    branch_id?: number | null;
    scope: 'company' | 'branch';
    is_active: boolean;
    balance?: number;
    description?: string | null;
    usage_guidance?: string | null;
    example_entry?: string | null;
    confusion_note?: string | null;
    schedule_code?: string | null;
    is_control_account?: boolean;
    allow_manual_posting?: boolean;
    is_bank_account?: boolean;
    is_cash_account?: boolean;
    is_petty_cash_account?: boolean;
    is_system?: boolean;
    children?: ApiAccount[];
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: UiAccountType;
    apiType: ApiAccount['account_type'];
    parentId: number | null;
    branchId: number | null;
    scope: 'company' | 'branch';
    isActive: boolean;
    balance: number;
    description: string | null;
    usageGuidance: string | null;
    exampleEntry: string | null;
    confusionNote: string | null;
    scheduleCode: string | null;
    isControlAccount: boolean;
    allowManualPosting: boolean;
    isBankAccount: boolean;
    isCashAccount: boolean;
    isPettyCashAccount: boolean;
    isSystem: boolean;
    children: Account[];
}

interface AccountFormState {
    accountCode: string;
    accountName: string;
    accountType: UiAccountType;
    parentId: string;
    scope: 'company' | 'branch';
    status: 'active' | 'disabled';
    description: string;
    usageGuidance: string;
    exampleEntry: string;
    confusionNote: string;
    scheduleCode: string;
    allowManualPosting: boolean;
    treasuryKind: 'none' | 'cash' | 'bank';
}

const TYPE_CONFIG: Record<UiAccountType, { label: string; colorVar: string; bgVar: string }> = {
    asset: { label: 'Asset', colorVar: 'var(--accent-tertiary, #06b6d4)', bgVar: 'color-mix(in srgb, #06b6d4 12%, transparent)' },
    liability: { label: 'Liability', colorVar: 'var(--danger, #ef4444)', bgVar: 'color-mix(in srgb, #ef4444 12%, transparent)' },
    equity: { label: 'Equity', colorVar: 'var(--accent-secondary, #a855f7)', bgVar: 'color-mix(in srgb, #a855f7 12%, transparent)' },
    income: { label: 'Income', colorVar: 'var(--alert-success-text, #22c55e)', bgVar: 'color-mix(in srgb, #22c55e 12%, transparent)' },
    expense: { label: 'Expense', colorVar: '#f59e0b', bgVar: 'color-mix(in srgb, #f59e0b 12%, transparent)' },
};

const TYPE_FILTER_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'asset', label: 'Assets' },
    { value: 'liability', label: 'Liabilities' },
    { value: 'equity', label: 'Equity' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expenses' },
];

const EMPTY_FORM: AccountFormState = {
    accountCode: '',
    accountName: '',
    accountType: 'asset',
    parentId: '',
    scope: 'company',
    status: 'active',
    description: '',
    usageGuidance: '',
    exampleEntry: '',
    confusionNote: '',
    scheduleCode: '',
    allowManualPosting: true,
    treasuryKind: 'none',
};

function toUiType(type: ApiAccount['account_type']): UiAccountType {
    return type === 'revenue' ? 'income' : type;
}

function toApiType(type: UiAccountType): ApiAccount['account_type'] {
    return type === 'income' ? 'revenue' : type;
}

function mapAccount(account: ApiAccount): Account {
    return {
        id: account.id,
        code: account.account_code,
        name: account.account_name,
        type: toUiType(account.account_type),
        apiType: account.account_type,
        parentId: account.parent_id ?? null,
        branchId: account.branch_id ?? null,
        scope: account.scope ?? 'company',
        isActive: account.is_active,
        balance: Number(account.balance ?? 0),
        description: account.description ?? null,
        usageGuidance: account.usage_guidance ?? null,
        exampleEntry: account.example_entry ?? null,
        confusionNote: account.confusion_note ?? null,
        scheduleCode: account.schedule_code ?? null,
        isControlAccount: account.is_control_account === true,
        allowManualPosting: account.allow_manual_posting !== false,
        isBankAccount: account.is_bank_account === true,
        isCashAccount: account.is_cash_account === true,
        isPettyCashAccount: account.is_petty_cash_account === true,
        isSystem: account.is_system === true,
        children: account.children?.map(mapAccount) ?? [],
    };
}

function formatPKR(value: number): string {
    const abs = Math.abs(value);
    const prefix = value < 0 ? '-' : '';
    if (abs >= 1000000) return `${prefix}PKR ${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${prefix}PKR ${(abs / 1000).toFixed(1)}K`;
    return `${prefix}PKR ${abs.toLocaleString()}`;
}

function flattenAccounts(accounts: Account[]): Account[] {
    return accounts.flatMap((account) => [account, ...(account.children ? flattenAccounts(account.children) : [])]);
}

function filterTree(accounts: Account[], predicate: (account: Account) => boolean): Account[] {
    const filtered = accounts
        .map((account): Account | null => {
            const children = filterTree(account.children, predicate);
            if (predicate(account) || children.length > 0) {
                return { ...account, children };
            }
            return null;
        });

    return filtered.filter((account): account is Account => account !== null);
}

const AccountRow = ({ account, level = 0, onEdit, onToggleStatus, togglingId }: {
    account: Account;
    level?: number;
    onEdit: (account: Account) => void;
    onToggleStatus: (account: Account) => void;
    togglingId: number | null;
}) => {
    const [expanded, setExpanded] = useState(level < 1);
    const hasChildren = (account.children?.length ?? 0) > 0;
    const config = TYPE_CONFIG[account.type];
    const isGoverned = account.isSystem || account.isControlAccount;

    return (
        <>
            <tr className={`${styles.accountRow} ${!account.isActive ? styles.inactive : ''}`}>
                <td style={{ paddingLeft: `${20 + level * 28}px` }}>
                    <div className={styles.nameCell}>
                        {hasChildren ? (
                            <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span className={styles.expandSpacer} />
                        )}
                        <span className={styles.accountCode}>{account.code}</span>
                        <div className={styles.accountLabelBlock}>
                            <span className={`${styles.accountName} ${hasChildren ? styles.parentName : ''}`}>{account.name}</span>
                            {account.description ? <span className={styles.accountSummary}>{account.description}</span> : null}
                        </div>
                    </div>
                </td>
                <td>
                    <span className={styles.typeBadge} style={{ color: config.colorVar, background: config.bgVar }}>
                        {config.label}
                    </span>
                </td>
                <td>
                    <span className={`${styles.scopeBadge} ${account.scope === 'company' ? styles.scopeCompany : styles.scopeBranch}`}>
                        {account.scope === 'company' ? 'Company' : 'Branch'}
                    </span>
                </td>
                <td className={styles.balanceCell}>
                    {account.balance !== 0 && (
                        <span className={account.balance < 0 ? styles.negative : ''}>{formatPKR(account.balance)}</span>
                    )}
                </td>
                <td>
                    <div className={styles.metaBadges}>
                        {account.isSystem && <span className={`${styles.metaBadge} ${styles.metaLocked}`}><Lock size={11} /> System</span>}
                        {account.isControlAccount && <span className={`${styles.metaBadge} ${styles.metaControl}`}>Control</span>}
                        {account.isCashAccount && <span className={`${styles.metaBadge} ${styles.metaTreasury}`}><Wallet size={11} /> Cash</span>}
                        {account.isBankAccount && <span className={`${styles.metaBadge} ${styles.metaTreasury}`}><Landmark size={11} /> Bank</span>}
                        {!account.allowManualPosting && <span className={styles.metaBadge}>Auto-post only</span>}
                    </div>
                </td>
                <td>
                    <div className={styles.statusCell}>
                        <button
                            type="button"
                            className={`${styles.toggleSwitch} ${account.isActive ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => onToggleStatus(account)}
                            disabled={isGoverned || togglingId === account.id}
                            title={isGoverned ? 'System and control accounts cannot be disabled' : (account.isActive ? 'Disable account' : 'Enable account')}
                        >
                            <span className={styles.toggleKnob} />
                        </button>
                        <span className={styles.statusText} style={{ fontSize: '11px', color: account.isActive ? 'var(--alert-success-text)' : 'var(--color-text-muted)' }}>
                            {account.isActive ? 'Active' : 'Disabled'}
                        </span>
                    </div>
                </td>
                <td>
                    <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Edit Account" onClick={() => onEdit(account)}>
                            <Edit2 size={13} />
                        </button>
                    </div>
                </td>
            </tr>
            {expanded && hasChildren && account.children!.map((child) => (
                <AccountRow key={child.id} account={child} level={level + 1} onEdit={onEdit} onToggleStatus={onToggleStatus} togglingId={togglingId} />
            ))}
        </>
    );
};

export function ChartOfAccounts() {
    const { branches, activeBranch } = useBranchContext();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        ],
        [branches],
    );

    const loadAccounts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await accountingApi.getAccounts();
            setAccounts((response ?? []).map(mapAccount));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load accounts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAccounts();
    }, []);

    const openCreateModal = () => {
        setEditingAccount(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setForm({
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type,
            parentId: account.parentId ? String(account.parentId) : '',
            scope: account.scope,
            status: account.isActive ? 'active' : 'disabled',
            description: account.description ?? '',
            usageGuidance: account.usageGuidance ?? '',
            exampleEntry: account.exampleEntry ?? '',
            confusionNote: account.confusionNote ?? '',
            scheduleCode: account.scheduleCode ?? '',
            allowManualPosting: account.allowManualPosting,
            treasuryKind: account.isCashAccount ? 'cash' : account.isBankAccount ? 'bank' : 'none',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAccount(null);
        setForm(EMPTY_FORM);
    };

    const filteredAccounts = useMemo(() => {
        const selectedBranchId = selectedBranch !== 'all' ? Number(selectedBranch) : null;
        const predicate = (account: Account) => {
            const matchesType = typeFilter === 'all' || account.type === typeFilter;
            const matchesSearch = !search ||
                account.name.toLowerCase().includes(search.toLowerCase()) ||
                account.code.includes(search);
            const matchesBranch = !selectedBranchId ||
                account.scope === 'company' ||
                account.branchId === null ||
                account.branchId === selectedBranchId;
            return matchesType && matchesSearch && matchesBranch;
        };

        return filterTree(accounts, predicate);
    }, [accounts, search, typeFilter, selectedBranch]);

    const periodExportRows = useMemo(
        () => [
            ['Account Code', 'Account Name', 'Type', 'Scope', 'Description', 'Usage Guidance', 'Example', 'Confusion Note', 'Schedule', 'Flags', 'Balance', 'Status'],
            ...flattenAccounts(filteredAccounts).map((account) => [
                account.code,
                account.name,
                TYPE_CONFIG[account.type].label,
                account.scope,
                account.description ?? '',
                account.usageGuidance ?? '',
                account.exampleEntry ?? '',
                account.confusionNote ?? '',
                account.scheduleCode ?? '',
                [
                    account.isSystem ? 'system' : '',
                    account.isControlAccount ? 'control' : '',
                    account.isCashAccount ? 'cash' : '',
                    account.isBankAccount ? 'bank' : '',
                    account.allowManualPosting ? 'manual-posting' : 'auto-only',
                ].filter(Boolean).join('; '),
                String(account.balance),
                account.isActive ? 'Active' : 'Disabled',
            ]),
        ],
        [filteredAccounts],
    );

    const flatAccounts = useMemo(() => flattenAccounts(accounts), [accounts]);

    const stats = useMemo(() => {
        let total = 0;
        let active = 0;
        let inactive = 0;
        for (const account of flatAccounts) {
            total += 1;
            if (account.isActive) active += 1;
            else inactive += 1;
        }
        return { total, active, inactive };
    }, [flatAccounts]);

    const parentOptions = useMemo(
        () => [
            { value: '', label: 'No parent (root level)' },
            ...flatAccounts
                .filter((account) => !editingAccount || account.id !== editingAccount.id)
                .map((account) => ({ value: String(account.id), label: `${account.code} - ${account.name}` })),
        ],
        [editingAccount, flatAccounts],
    );

    const buildAccountPayload = (account: Account, overrides?: Partial<{ isActive: boolean }>) => ({
        account_code: account.code,
        account_name: account.name,
        account_type: toApiType(account.type),
        parent_id: account.parentId,
        scope: account.scope,
        branch_id: account.scope === 'branch' ? account.branchId : null,
        is_active: overrides?.isActive ?? account.isActive,
        description: account.description,
        usage_guidance: account.usageGuidance,
        example_entry: account.exampleEntry,
        confusion_note: account.confusionNote,
        schedule_code: account.scheduleCode,
        allow_manual_posting: account.allowManualPosting,
        is_control_account: account.isControlAccount,
        is_bank_account: account.isBankAccount,
        is_cash_account: account.isCashAccount,
        is_petty_cash_account: account.isPettyCashAccount,
    });

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const branchIdForBranchScope = selectedBranch !== 'all'
                ? Number(selectedBranch)
                : activeBranch?.branch_id ?? null;
            const payload = {
                account_code: form.accountCode,
                account_name: form.accountName,
                account_type: toApiType(form.accountType),
                parent_id: form.parentId ? Number(form.parentId) : null,
                scope: form.scope,
                branch_id: form.scope === 'branch' ? branchIdForBranchScope : null,
                is_active: form.status === 'active',
                description: form.description || null,
                usage_guidance: form.usageGuidance || null,
                example_entry: form.exampleEntry || null,
                confusion_note: form.confusionNote || null,
                schedule_code: form.scheduleCode || null,
                allow_manual_posting: form.allowManualPosting,
                is_control_account: editingAccount?.isControlAccount ?? false,
                is_bank_account: form.treasuryKind === 'bank',
                is_cash_account: form.treasuryKind === 'cash',
                is_petty_cash_account: editingAccount?.isPettyCashAccount ?? false,
            };

            if (editingAccount) {
                await accountingApi.updateAccount(editingAccount.id, payload);
            } else {
                await accountingApi.createAccount(payload);
            }
            closeModal();
            await loadAccounts();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save account');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (account: Account) => {
        if (account.isSystem || account.isControlAccount) {
            return;
        }
        setTogglingId(account.id);
        setError(null);
        try {
            await accountingApi.updateAccount(account.id, buildAccountPayload(account, { isActive: !account.isActive }));
            await loadAccounts();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update account status');
        } finally {
            setTogglingId(null);
        }
    };

    const exportAccounts = () => {
        const content = periodExportRows
            .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chart-of-accounts.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const editingIsGoverned = editingAccount?.isSystem || editingAccount?.isControlAccount;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><BookOpen size={18} /></div>
                    <div>
                        <h1>Chart of Accounts</h1>
                        <p>Manage your account structure and classifications</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect
                            options={branchOptions}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        />
                    </div>
                    <KitchenButton variant="outline" size="sm" onClick={exportAccounts}>
                        <Download size={14} style={{ marginRight: 6 }} /> Export
                    </KitchenButton>
                    <KitchenButton variant="primary" size="sm" onClick={openCreateModal}>
                        <Plus size={14} style={{ marginRight: 6 }} /> New Account
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.statsRow}>
                <div className={styles.statPill}><FolderTree size={14} /> <strong>{stats.total}</strong> Accounts</div>
                <div className={styles.statPill} style={{ color: 'var(--alert-success-text)' }}>
                    <span className={`${styles.statusDot} ${styles.statusActive}`} /> <strong>{stats.active}</strong> Active
                </div>
                <div className={styles.statPill}>
                    <span className={`${styles.statusDot} ${styles.statusInactive}`} /> <strong>{stats.inactive}</strong> Disabled
                </div>
            </div>

            <div className={styles.filters}>
                <div className={styles.searchBox}>
                    <Search size={16} />
                    <KitchenInput
                        placeholder="Search by name or code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <Filter size={14} />
                    <KitchenSelect
                        options={TYPE_FILTER_OPTIONS}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className={styles.emptyRow}>{error}</div>}

            <div className={styles.polishedPanel}>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Account Classification</th>
                                <th style={{ width: 100 }}>Type</th>
                                <th style={{ width: 100 }}>Scope</th>
                                <th style={{ width: 140 }} className={styles.balanceCell}>Balance</th>
                                <th style={{ width: 180 }}>Controls</th>
                                <th style={{ width: 120 }}>Status</th>
                                <th style={{ width: 60 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className={styles.emptyRow}>Loading accounts...</td>
                                </tr>
                            )}
                            {!loading && filteredAccounts.map((account) => (
                                <AccountRow
                                    key={account.id}
                                    account={account}
                                    onEdit={handleEdit}
                                    onToggleStatus={handleToggleStatus}
                                    togglingId={togglingId}
                                />
                            ))}
                            {!loading && filteredAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={7} className={styles.emptyRow}>No accounts found matching your criteria</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingAccount ? `Edit Account: ${editingAccount.name}` : 'Create New Account'}</h2>
                            <button className={styles.closeBtn} onClick={closeModal}><X size={18} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {editingIsGoverned && (
                                <div className={styles.lockNotice}>
                                    <Lock size={14} />
                                    <span>
                                        {editingAccount?.isSystem ? 'System account:' : 'Control account:'} structural fields are locked. You can review the account and only change allowed descriptive fields.
                                    </span>
                                </div>
                            )}
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Account Code</label>
                                    <KitchenInput value={form.accountCode} onChange={(e) => setForm((prev) => ({ ...prev, accountCode: e.target.value }))} placeholder="e.g., 1105" disabled={editingIsGoverned} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Account Name</label>
                                    <KitchenInput value={form.accountName} onChange={(e) => setForm((prev) => ({ ...prev, accountName: e.target.value }))} placeholder="e.g., UBL Current Account" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Account Type</label>
                                    <KitchenSelect
                                        options={TYPE_FILTER_OPTIONS.filter((option) => option.value !== 'all')}
                                        value={form.accountType}
                                        onChange={(e) => setForm((prev) => ({ ...prev, accountType: e.target.value as UiAccountType }))}
                                        disabled={editingIsGoverned}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Parent Account</label>
                                    <KitchenSelect
                                        value={form.parentId}
                                        onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
                                        options={parentOptions}
                                        disabled={editingIsGoverned}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Scope</label>
                                    <KitchenSelect
                                        value={form.scope}
                                        onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as 'company' | 'branch' }))}
                                        options={[
                                            { value: 'company', label: 'Company-wide' },
                                            { value: 'branch', label: 'Branch-level' },
                                        ]}
                                        disabled={editingIsGoverned}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Status</label>
                                    <div className={styles.switchRow}>
                                        <button
                                            type="button"
                                            className={`${styles.toggleSwitch} ${form.status === 'active' ? styles.toggleOn : styles.toggleOff}`}
                                            onClick={() => setForm((prev) => ({ ...prev, status: prev.status === 'active' ? 'disabled' : 'active' }))}
                                            disabled={editingIsGoverned}
                                        >
                                            <span className={styles.toggleKnob} />
                                        </button>
                                        <span className={styles.statusText}>{form.status === 'active' ? 'Active' : 'Disabled'}</span>
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Schedule Code</label>
                                    <KitchenInput value={form.scheduleCode} onChange={(e) => setForm((prev) => ({ ...prev, scheduleCode: e.target.value }))} placeholder="e.g., BS_CASH" disabled={editingIsGoverned} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Treasury Classification</label>
                                    <KitchenSelect
                                        value={form.treasuryKind}
                                        onChange={(e) => setForm((prev) => ({ ...prev, treasuryKind: e.target.value as 'none' | 'cash' | 'bank' }))}
                                        options={[
                                            { value: 'none', label: 'Not Treasury' },
                                            { value: 'cash', label: 'Cash Account' },
                                            { value: 'bank', label: 'Bank Account' },
                                        ]}
                                        disabled={editingIsGoverned || form.accountType !== 'asset'}
                                    />
                                </div>
                                <div className={`${styles.formGroup} ${styles.fullSpan}`}>
                                    <label>Account Description</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={form.description}
                                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder="What this account is for and what it generally covers."
                                        rows={2}
                                    />
                                </div>
                                <div className={`${styles.formGroup} ${styles.fullSpan}`}>
                                    <label>Usage Guidance</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={form.usageGuidance}
                                        onChange={(e) => setForm((prev) => ({ ...prev, usageGuidance: e.target.value }))}
                                        placeholder="What goes here, what should stay out, and how users should treat this account."
                                        rows={3}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Example</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={form.exampleEntry}
                                        onChange={(e) => setForm((prev) => ({ ...prev, exampleEntry: e.target.value }))}
                                        placeholder="Short practical example."
                                        rows={2}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Common Confusion Note</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={form.confusionNote}
                                        onChange={(e) => setForm((prev) => ({ ...prev, confusionNote: e.target.value }))}
                                        placeholder="Optional warning for a common posting mistake."
                                        rows={2}
                                    />
                                </div>
                                <div className={`${styles.formGroup} ${styles.fullSpan}`}>
                                    <label>Posting Policy</label>
                                    <div className={styles.policyRow}>
                                        <button
                                            type="button"
                                            className={`${styles.policyBtn} ${form.allowManualPosting ? styles.policyActive : ''}`}
                                            onClick={() => setForm((prev) => ({ ...prev, allowManualPosting: true }))}
                                            disabled={editingIsGoverned}
                                        >
                                            Manual Posting Allowed
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.policyBtn} ${!form.allowManualPosting ? styles.policyActive : ''}`}
                                            onClick={() => setForm((prev) => ({ ...prev, allowManualPosting: false }))}
                                            disabled={editingIsGoverned}
                                        >
                                            Auto-post Only
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {(form.description || form.usageGuidance || form.exampleEntry || form.confusionNote) && (
                                <div className={styles.guidancePreview}>
                                    {form.description ? <p><strong>Purpose:</strong> {form.description}</p> : null}
                                    {form.usageGuidance ? <p><strong>How to use:</strong> {form.usageGuidance}</p> : null}
                                    {form.exampleEntry ? <p><strong>Example:</strong> {form.exampleEntry}</p> : null}
                                    {form.confusionNote ? <p><strong>Watch out:</strong> {form.confusionNote}</p> : null}
                                </div>
                            )}
                            {form.scope === 'branch' && selectedBranch === 'all' && !activeBranch && (
                                <p className={styles.emptyRow}>Select an active branch before saving a branch-level account.</p>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={closeModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
                                {saving ? 'Saving...' : editingAccount ? 'Update Account' : 'Create Account'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
