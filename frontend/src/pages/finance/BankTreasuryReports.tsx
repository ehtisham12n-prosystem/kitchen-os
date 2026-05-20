/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Calendar, FileText, Landmark, Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { accountingApi, branchApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from '../accounting/FinancialReports.module.css';

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type ReportDefinition = {
    id: string;
    name: string;
    category: string;
    description: string;
    scopeNote?: string;
    requiresAccount?: boolean;
    accountSource?: 'bank' | 'reconciliation';
    requiredAccess?: 'reports' | 'banks' | 'reconciliation';
};

type ReportColumn<T> = {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => string | number | null | undefined;
};

type TreasuryAccountRow = {
    id: number;
    account_code: string;
    account_name: string;
    bank_name?: string | null;
    account_title?: string | null;
    account_number_iban?: string | null;
    currency_code?: string | null;
    bank_account_type?: string | null;
    branch_id?: number | null;
    branch_name?: string | null;
    is_active?: boolean;
    is_bank_account?: boolean;
    balance?: number;
    children?: TreasuryAccountRow[];
};

const PERIOD_OPTIONS = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Financial Year' },
    { value: 'custom', label: 'Custom Range' },
];

const REPORT_LIBRARY: ReportDefinition[] = [
    {
        id: 'bank-balance-summary',
        name: 'Bank Balance Summary',
        category: 'Bank Master',
        description: 'Bank account master list with live balances, branch ownership, currency, account title, and operating status.',
        requiredAccess: 'reports',
    },
    {
        id: 'bank-book',
        name: 'Bank Book',
        category: 'Ledger',
        description: 'Day-to-day bank ledger report with opening balance, debits, credits, running balance, and source references.',
        requiresAccount: true,
        accountSource: 'bank',
        requiredAccess: 'reports',
    },
    {
        id: 'bank-reconciliation-summary',
        name: 'Bank Reconciliation Summary',
        category: 'Reconciliation',
        description: 'Matched versus unmatched position, activity mix, and reconciliation control status for a selected bank account.',
        requiresAccount: true,
        accountSource: 'reconciliation',
        requiredAccess: 'reconciliation',
    },
    {
        id: 'unreconciled-transactions',
        name: 'Unreconciled Transactions Report',
        category: 'Reconciliation',
        description: 'Detailed list of unmatched bank ledger transactions awaiting statement match, investigation, or adjustment.',
        requiresAccount: true,
        accountSource: 'reconciliation',
        requiredAccess: 'reconciliation',
    },
    {
        id: 'deposits-in-transit',
        name: 'Deposits in Transit Report',
        category: 'Treasury Control',
        description: 'Open safe handovers and in-transit deposit batches that still require bank clearance or treasury closure.',
        requiredAccess: 'banks',
    },
    {
        id: 'merchant-settlement-aging',
        name: 'Merchant Settlement Aging Report',
        category: 'Treasury Control',
        description: 'Outstanding card and wallet receipts by provider, channel, and age to monitor clearing and shortfall exposure.',
        requiredAccess: 'banks',
    },
];

function getBranchRowId(branch: any): number | null {
    const value = branch?.branch_id ?? branch?.id ?? null;
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function getBranchRowName(branch: any): string {
    return branch?.branch_name || branch?.name || `Branch ${getBranchRowId(branch) ?? ''}`.trim();
}

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function getPresetRange(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (preset === 'last_month') {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }

    if (preset === 'this_quarter') {
        const quarterStartMonth = Math.floor(month / 3) * 3;
        return {
            dateFrom: toIsoDate(new Date(year, quarterStartMonth, 1)),
            dateTo: toIsoDate(today),
        };
    }

    if (preset === 'this_year') {
        return {
            dateFrom: `${year}-01-01`,
            dateTo: toIsoDate(today),
        };
    }

    return {
        dateFrom: toIsoDate(new Date(year, month, 1)),
        dateTo: toIsoDate(today),
    };
}

function flattenAccounts(nodes: any[]): TreasuryAccountRow[] {
    return nodes.flatMap((node) => [
        node,
        ...(Array.isArray(node?.children) ? flattenAccounts(node.children) : []),
    ]);
}

function formatPKR(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCompactNumber(value: number): string {
    return Number(value || 0).toLocaleString('en-PK');
}

function sanitizeText(value: any, fallback = '-'): string {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function formatPercent(value: number): string {
    return `${Number(value || 0).toFixed(1)}%`;
}

function maskAccountNumber(value?: string | null): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    if (raw.length <= 6) return raw;
    return `${raw.slice(0, 4)}${'*'.repeat(Math.max(raw.length - 8, 2))}${raw.slice(-4)}`;
}

function inferLedgerSource(transaction: { description?: string; reference_id?: string; source_module?: string | null }): string {
    if (transaction.source_module === 'pos') return 'POS';
    if (transaction.source_module === 'inventory') return 'Inventory';
    const text = `${transaction.description ?? ''} ${transaction.reference_id ?? ''}`.toLowerCase();
    if (text.includes('merchant')) return 'Merchant';
    if (text.includes('payroll')) return 'Payroll';
    if (text.includes('vendor') || text.includes('payment')) return 'AP';
    return 'Manual';
}

function buildReportScopeLabel(dateFrom: string, dateTo: string): string {
    return `${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
}

function ReportTable<T extends Record<string, any>>({
    rows,
    columns,
    emptyMessage = 'No rows found for the selected report scope.',
}: {
    rows: T[];
    columns: ReportColumn<T>[];
    emptyMessage?: string;
}) {
    return (
        <table className={styles.printTable}>
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th
                            key={column.key}
                            className={column.align === 'right' ? styles.alignRight : column.align === 'center' ? styles.alignCenter : undefined}
                        >
                            {column.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className={styles.emptyPrintRow}>
                            {emptyMessage}
                        </td>
                    </tr>
                ) : rows.map((row, index) => (
                    <tr key={String(row.id ?? row.key ?? index)}>
                        {columns.map((column) => (
                            <td
                                key={`${String(row.id ?? row.key ?? index)}-${column.key}`}
                                className={column.align === 'right' ? styles.alignRight : column.align === 'center' ? styles.alignCenter : undefined}
                            >
                                {column.render ? column.render(row) : sanitizeText(row[column.key])}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ReportMetricGrid({
    items,
}: {
    items: Array<{ label: string; value: string; note?: string }>;
}) {
    return (
        <div className={styles.printMetricGrid}>
            {items.map((item) => (
                <div key={item.label} className={styles.printMetricCard}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.note ? <small>{item.note}</small> : null}
                </div>
            ))}
        </div>
    );
}

function ReportSection({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <section className={styles.printSection}>
            <div className={styles.printSectionHeader}>
                <div>
                    <h3>{title}</h3>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
            </div>
            {children}
        </section>
    );
}

export function BankTreasuryReports() {
    const { tenantSlug } = useParams();
    const { branches, activeBranch } = useBranchContext();
    const {
        canViewAccountingReports,
        canViewBankAccounts,
        canViewBankReconciliation,
    } = usePermissionAccess();
    const [availableBranches, setAvailableBranches] = useState<any[]>(branches);
    const [selectedBranch, setSelectedBranch] = useState(
        activeBranch ? String(activeBranch.branch_id ?? (activeBranch as any).id ?? 'all') : 'all',
    );
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
    const [dateFrom, setDateFrom] = useState(getPresetRange('this_month').dateFrom);
    const [dateTo, setDateTo] = useState(getPresetRange('this_month').dateTo);
    const [selectedReportId, setSelectedReportId] = useState<string>('bank-balance-summary');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedReconAccountId, setSelectedReconAccountId] = useState('');
    const [bankAccounts, setBankAccounts] = useState<TreasuryAccountRow[]>([]);
    const [reconciliationAccounts, setReconciliationAccounts] = useState<any[]>([]);
    const [reportPayload, setReportPayload] = useState<any>(null);
    const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    useEffect(() => {
        setAvailableBranches(branches);
    }, [branches]);

    useEffect(() => {
        let mounted = true;
        const loadBranches = async () => {
            try {
                const rows = await branchApi.getBranches();
                if (mounted && Array.isArray(rows) && rows.length > 0) {
                    setAvailableBranches(rows);
                }
            } catch {
                if (mounted) {
                    setAvailableBranches((current) => current);
                }
            }
        };
        if ((branches ?? []).length === 0) {
            void loadBranches();
        }
        return () => {
            mounted = false;
        };
    }, [branches]);

    useEffect(() => {
        if (periodPreset === 'custom') return;
        const range = getPresetRange(periodPreset);
        setDateFrom(range.dateFrom);
        setDateTo(range.dateTo);
    }, [periodPreset]);

    const availableReports = useMemo(() => {
        return REPORT_LIBRARY.filter((report) => {
            if (report.requiredAccess === 'reconciliation') return canViewBankReconciliation;
            if (report.requiredAccess === 'banks') return canViewBankAccounts;
            return canViewAccountingReports;
        });
    }, [canViewAccountingReports, canViewBankAccounts, canViewBankReconciliation]);

    useEffect(() => {
        if (activeBranch && selectedBranch === 'all') {
            setSelectedBranch(String(activeBranch.branch_id ?? (activeBranch as any).id ?? 'all'));
        }
    }, [activeBranch, selectedBranch]);

    const branchOptions = useMemo(
        () => [
            { value: 'all', label: 'All Branches' },
            ...availableBranches
                .map((branch) => {
                    const branchId = getBranchRowId(branch);
                    return branchId ? { value: String(branchId), label: getBranchRowName(branch) } : null;
                })
                .filter(Boolean) as Array<{ value: string; label: string }>,
        ],
        [availableBranches],
    );

    const loadReportContext = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [accountsResponse, reconciliationResponse] = await Promise.all([
                accountingApi.getAccounts(),
                canViewBankReconciliation ? accountingApi.getReconciliationAccounts() : Promise.resolve([]),
            ]);
            const flatAccounts = flattenAccounts(Array.isArray(accountsResponse) ? accountsResponse : []);
            const bankRows = flatAccounts
                .filter((account) => account?.is_bank_account === true)
                .map((account) => ({
                    ...account,
                    balance: Number(account.balance ?? 0),
                    branch_id: account.branch_id ? Number(account.branch_id) : null,
                }));

            setBankAccounts(bankRows);
            setReconciliationAccounts(Array.isArray(reconciliationResponse) ? reconciliationResponse : []);
            setSelectedAccountId((current) => current || (bankRows[0] ? String(bankRows[0].id) : ''));
            setSelectedReconAccountId((current) => current || (reconciliationResponse?.[0] ? String(reconciliationResponse[0].id) : ''));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load bank reporting context');
        } finally {
            setLoading(false);
        }
    }, [canViewBankReconciliation]);

    useEffect(() => {
        void loadReportContext();
    }, [loadReportContext]);

    useEffect(() => {
        if (availableReports.length === 0) {
            return;
        }
        if (!availableReports.some((report) => report.id === selectedReportId)) {
            setSelectedReportId(availableReports[0].id);
        }
    }, [availableReports, selectedReportId]);

    const selectedReport = useMemo(
        () => availableReports.find((report) => report.id === selectedReportId) || availableReports[0] || REPORT_LIBRARY[0],
        [availableReports, selectedReportId],
    );

    const filteredBankAccounts = useMemo(
        () => bankAccounts.filter((account) => selectedBranch === 'all' || String(account.branch_id ?? 'all') === selectedBranch),
        [bankAccounts, selectedBranch],
    );

    const filteredReconAccounts = useMemo(
        () => reconciliationAccounts.filter((account) => selectedBranch === 'all' || String(account.branch_id ?? 'all') === selectedBranch),
        [reconciliationAccounts, selectedBranch],
    );

    const currentAccountOptions = useMemo(() => {
        const rows = selectedReport.accountSource === 'reconciliation' ? filteredReconAccounts : filteredBankAccounts;
        return rows.map((account: any) => ({
            value: String(account.id),
            label: `${account.account_code} - ${account.account_name}`,
        }));
    }, [filteredBankAccounts, filteredReconAccounts, selectedReport.accountSource]);

    const selectedScopedAccountId = selectedReport.accountSource === 'reconciliation' ? selectedReconAccountId : selectedAccountId;

    useEffect(() => {
        if (!selectedReport.requiresAccount) {
            return;
        }
        const hasCurrent = currentAccountOptions.some((option) => option.value === selectedScopedAccountId);
        if (hasCurrent) {
            return;
        }
        const nextValue = currentAccountOptions[0]?.value || '';
        if (selectedReport.accountSource === 'reconciliation') {
            setSelectedReconAccountId(nextValue);
        } else {
            setSelectedAccountId(nextValue);
        }
    }, [currentAccountOptions, selectedReport.accountSource, selectedReport.requiresAccount, selectedScopedAccountId]);

    const branchLabel = selectedBranch === 'all'
        ? 'Consolidated - All Branches'
        : branchOptions.find((branch) => branch.value === selectedBranch)?.label || 'Selected Branch';
    const reportScope = buildReportScopeLabel(dateFrom, dateTo);
    const selectedAccountLabel = currentAccountOptions.find((option) => option.value === selectedScopedAccountId)?.label || 'Not selected';

    const runReport = useCallback(async (reportId = selectedReportId) => {
        if (!dateFrom || !dateTo) return;

        const reportDefinition = availableReports.find((entry) => entry.id === reportId) || availableReports[0];
        if (!reportDefinition) {
            setReportPayload(null);
            setReportError('No bank or treasury reports are available for your current role.');
            return;
        }
        const branchId = selectedBranch === 'all' ? null : selectedBranch;
        const scopedAccountId = reportDefinition.accountSource === 'reconciliation' ? selectedReconAccountId : selectedAccountId;

        if (reportDefinition.requiresAccount && !scopedAccountId) {
            setReportPayload(null);
            setReportError('Select a bank account to run this report.');
            return;
        }

        setReportLoading(true);
        setReportError(null);
        try {
            let payload: any = null;

            switch (reportId) {
                case 'bank-balance-summary':
                    payload = { rows: filteredBankAccounts };
                    break;
                case 'bank-book':
                    payload = await accountingApi.getGeneralLedger(scopedAccountId, {
                        branch_id: branchId,
                        date_from: dateFrom,
                        date_to: dateTo,
                    });
                    break;
                case 'bank-reconciliation-summary':
                case 'unreconciled-transactions':
                    payload = await accountingApi.getReconciliation({
                        account_id: scopedAccountId,
                        branch_id: branchId,
                        date_from: dateFrom,
                        date_to: dateTo,
                    });
                    break;
                case 'deposits-in-transit':
                    payload = await accountingApi.getTreasuryOverview({ branch_id: branchId });
                    break;
                case 'merchant-settlement-aging':
                    payload = await accountingApi.getMerchantSettlementReview({ branch_id: branchId });
                    break;
                default:
                    payload = { rows: filteredBankAccounts };
                    break;
            }

            setReportPayload(payload);
            setReportGeneratedAt(new Date().toISOString());
        } catch (err) {
            setReportPayload(null);
            setReportError(err instanceof Error ? err.message : 'Unable to run selected report');
        } finally {
            setReportLoading(false);
        }
    }, [availableReports, dateFrom, dateTo, filteredBankAccounts, selectedAccountId, selectedBranch, selectedReconAccountId, selectedReportId]);

    useEffect(() => {
        setReportPayload(null);
        setReportGeneratedAt(null);
        setReportError(null);
    }, [selectedReportId, selectedBranch, selectedAccountId, selectedReconAccountId, dateFrom, dateTo]);

    useEffect(() => {
        if (loading || error || reportLoading || reportPayload) {
            return;
        }
        void runReport(selectedReportId);
    }, [error, loading, reportLoading, reportPayload, runReport, selectedReportId]);

    const printReport = () => {
        window.print();
    };

    const renderReportPreview = () => {
        if (reportLoading) {
            return <div className={styles.emptyPrintRow}>Running report...</div>;
        }

        if (reportError) {
            return <div className={styles.emptyPrintRow}>{reportError}</div>;
        }

        if (!reportPayload) {
            return <div className={styles.emptyPrintRow}>Run a report to load printable output.</div>;
        }

        if (selectedReportId === 'bank-balance-summary') {
            const rows = Array.isArray(reportPayload?.rows) ? reportPayload.rows : [];
            const activeRows = rows.filter((row: any) => row.is_active !== false);
            const totalBalance = activeRows.reduce((sum: number, row: any) => sum + Number(row.balance ?? 0), 0);
            const branchCount = new Set(rows.map((row: any) => row.branch_id || 'company')).size;
            const branchSummary = Array.from(
                rows.reduce((map, row: any) => {
                    const key = row.branch_id || 'company';
                    const current = map.get(key) ?? {
                        branch_name: row.branch_name || 'Company',
                        account_count: 0,
                        active_count: 0,
                        total_balance: 0,
                    };
                    current.account_count += 1;
                    current.active_count += row.is_active === false ? 0 : 1;
                    current.total_balance += Number(row.balance ?? 0);
                    map.set(key, current);
                    return map;
                }, new Map<any, any>()),
            ).map(([, value]) => value);

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Bank Accounts', value: formatCompactNumber(rows.length) },
                            { label: 'Active Accounts', value: formatCompactNumber(activeRows.length) },
                            { label: 'Total Bank Balance', value: formatPKR(totalBalance) },
                            { label: 'Branches Covered', value: formatCompactNumber(branchCount) },
                        ]}
                    />
                    <ReportSection title="Branch Balance Summary" subtitle="Branch-wise bank account coverage and aggregate live bank balance.">
                        <ReportTable
                            rows={branchSummary}
                            columns={[
                                { key: 'branch_name', label: 'Branch' },
                                { key: 'account_count', label: 'Accounts', align: 'center', render: (row) => formatCompactNumber(Number(row.account_count ?? 0)) },
                                { key: 'active_count', label: 'Active', align: 'center', render: (row) => formatCompactNumber(Number(row.active_count ?? 0)) },
                                { key: 'total_balance', label: 'Total Balance', align: 'right', render: (row) => formatPKR(Number(row.total_balance ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Bank Account Master and Balances" subtitle="Detailed bank account list with account ownership and reporting metadata.">
                        <ReportTable
                            rows={rows}
                            columns={[
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, 'Company') },
                                { key: 'bank_name', label: 'Bank Name', render: (row) => sanitizeText(row.bank_name || row.account_name, '-') },
                                { key: 'account_title', label: 'Account Title', render: (row) => sanitizeText(row.account_title || row.account_name, '-') },
                                { key: 'account_number_iban', label: 'Account No / IBAN', render: (row) => maskAccountNumber(row.account_number_iban) },
                                { key: 'currency_code', label: 'Currency', align: 'center', render: (row) => sanitizeText(row.currency_code, 'PKR') },
                                { key: 'bank_account_type', label: 'Type', align: 'center', render: (row) => sanitizeText(row.bank_account_type, 'current') },
                                { key: 'status', label: 'Status', align: 'center', render: (row) => row.is_active === false ? 'Inactive' : 'Active' },
                                { key: 'balance', label: 'Balance', align: 'right', render: (row) => formatPKR(Number(row.balance ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'bank-book') {
            const transactions = Array.isArray(reportPayload?.transactions) ? reportPayload.transactions : [];
            const totals = transactions.reduce((sum: any, row: any) => ({
                debit: sum.debit + Number(row.debit ?? 0),
                credit: sum.credit + Number(row.credit ?? 0),
            }), { debit: 0, credit: 0 });
            const closingBalance = transactions.length > 0
                ? Number(transactions[transactions.length - 1]?.running_balance ?? 0)
                : Number(reportPayload?.opening_balance ?? 0);

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Opening Balance', value: formatPKR(Number(reportPayload?.opening_balance ?? 0)) },
                            { label: 'Total Debits', value: formatPKR(totals.debit) },
                            { label: 'Total Credits', value: formatPKR(totals.credit) },
                            { label: 'Closing Balance', value: formatPKR(closingBalance), note: `${formatCompactNumber(transactions.length)} transaction rows` },
                        ]}
                    />
                    <ReportSection title="Bank Book Detail" subtitle="Transaction-wise bank ledger with running balance and operational source reference.">
                        <ReportTable
                            rows={transactions}
                            columns={[
                                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                                { key: 'journal_id', label: 'Journal', render: (row) => `JE-${String(row.journal_id ?? row.id ?? '').padStart(4, '0')}` },
                                { key: 'description', label: 'Description', render: (row) => sanitizeText(row.description, 'Journal Entry') },
                                { key: 'source', label: 'Source', render: (row) => inferLedgerSource(row) },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, '-') },
                                { key: 'debit', label: 'Debit', align: 'right', render: (row) => formatPKR(Number(row.debit ?? 0)) },
                                { key: 'credit', label: 'Credit', align: 'right', render: (row) => formatPKR(Number(row.credit ?? 0)) },
                                { key: 'running_balance', label: 'Running Balance', align: 'right', render: (row) => formatPKR(Number(row.running_balance ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'bank-reconciliation-summary') {
            const summary = reportPayload?.summary ?? {};
            const classificationRows = Array.isArray(reportPayload?.classification_summary) ? reportPayload.classification_summary : [];
            const activitySummary = reportPayload?.activity_summary ?? {};
            const governanceSummary = reportPayload?.governance_summary ?? {};
            const totalItems = Number(summary.matched_count ?? 0) + Number(summary.unmatched_count ?? 0);
            const matchedRate = totalItems > 0 ? (Number(summary.matched_count ?? 0) / totalItems) * 100 : 0;

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Matched Items', value: formatCompactNumber(Number(summary.matched_count ?? 0)) },
                            { label: 'Unmatched Items', value: formatCompactNumber(Number(summary.unmatched_count ?? 0)) },
                            { label: 'Matched Amount', value: formatPKR(Number(summary.matched_amount ?? 0)) },
                            { label: 'Match Rate', value: formatPercent(matchedRate), note: `${formatPKR(Number(summary.unmatched_amount ?? 0))} still unmatched` },
                        ]}
                    />
                    <ReportSection title="Reconciliation Control Summary" subtitle="High-level reconciliation control checkpoints for the selected bank account.">
                        <ReportTable
                            rows={[
                                { checkpoint: 'Vendor Payment Unmatched Items', value: formatCompactNumber(Number(activitySummary.vendor_payment_unmatched_count ?? 0)) },
                                { checkpoint: 'Vendor Payment Unmatched Amount', value: formatPKR(Number(activitySummary.vendor_payment_unmatched_amount ?? 0)) },
                                { checkpoint: 'Other Activity Unmatched Items', value: formatCompactNumber(Number(activitySummary.other_unmatched_count ?? 0)) },
                                { checkpoint: 'Other Activity Unmatched Amount', value: formatPKR(Number(activitySummary.other_unmatched_amount ?? 0)) },
                                { checkpoint: 'Month-close Blockers', value: formatCompactNumber(Number(governanceSummary.close_blocker_count ?? 0)) },
                                { checkpoint: 'Treasury Follow-up Amount', value: formatPKR(Number(governanceSummary.treasury_follow_up_amount ?? 0)) },
                            ]}
                            columns={[
                                { key: 'checkpoint', label: 'Checkpoint' },
                                { key: 'value', label: 'Value', align: 'right' },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Classification Breakdown" subtitle="Unmatched bank activity grouped by treasury classification for analysis and cleanup.">
                        <ReportTable
                            rows={classificationRows}
                            columns={[
                                { key: 'treasury_classification_label', label: 'Classification', render: (row) => sanitizeText(row.treasury_classification_label, 'Unclassified') },
                                { key: 'unmatched_count', label: 'Items', align: 'center', render: (row) => formatCompactNumber(Number(row.unmatched_count ?? 0)) },
                                { key: 'unmatched_amount', label: 'Unmatched Amount', align: 'right', render: (row) => formatPKR(Number(row.unmatched_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'unreconciled-transactions') {
            const transactions = (Array.isArray(reportPayload?.transactions) ? reportPayload.transactions : [])
                .filter((row: any) => !row.reconciliation);
            const unmatchedAmount = transactions.reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount ?? 0)), 0);
            const vendorPaymentCount = transactions.filter((row: any) => row.activity_type === 'vendor_payments').length;

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Unreconciled Items', value: formatCompactNumber(transactions.length) },
                            { label: 'Unreconciled Amount', value: formatPKR(unmatchedAmount) },
                            { label: 'Vendor Payment Items', value: formatCompactNumber(vendorPaymentCount) },
                            { label: 'Other Activity Items', value: formatCompactNumber(transactions.length - vendorPaymentCount) },
                        ]}
                    />
                    <ReportSection title="Unreconciled Transaction Detail" subtitle="All unmatched bank ledger rows still waiting for statement reference or finance review.">
                        <ReportTable
                            rows={transactions}
                            columns={[
                                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                                { key: 'journal_entry_id', label: 'Journal', render: (row) => `JE-${String(row.journal_entry_id ?? '').padStart(4, '0')}` },
                                { key: 'description', label: 'Description', render: (row) => sanitizeText(row.description, 'Bank Transaction') },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, '-') },
                                { key: 'payment_source_label', label: 'Treasury Source', render: (row) => sanitizeText(row.payment_source_label || row.treasury_account_name, '-') },
                                { key: 'treasury_classification_label', label: 'Classification', render: (row) => sanitizeText(row.treasury_classification_label, 'Unclassified') },
                                { key: 'payment_method', label: 'Method', render: (row) => sanitizeText(row.payment_method, '-') },
                                { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Math.abs(Number(row.amount ?? 0))) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'deposits-in-transit') {
            const safeDepositReview = reportPayload?.safe_deposit_review ?? {};
            const openHandovers = Array.isArray(safeDepositReview?.open_handovers) ? safeDepositReview.open_handovers : [];
            const openTransitBatches = Array.isArray(safeDepositReview?.open_transit_batches) ? safeDepositReview.open_transit_batches : [];
            const overdueCount = Number(safeDepositReview.overdue_safe_handover_count ?? 0) + Number(safeDepositReview.overdue_transit_batch_count ?? 0);

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'In Transit Balance', value: formatPKR(Number(reportPayload?.summary?.bank_in_transit_balance ?? 0)) },
                            { label: 'Open Safe Handovers', value: formatCompactNumber(openHandovers.length), note: formatPKR(Number(safeDepositReview.open_handover_amount ?? 0)) },
                            { label: 'Open Transit Batches', value: formatCompactNumber(openTransitBatches.length), note: formatPKR(Number(safeDepositReview.open_transit_amount ?? 0)) },
                            { label: 'Overdue Deposit Items', value: formatCompactNumber(overdueCount) },
                        ]}
                    />
                    <ReportSection title="Open Safe Handovers" subtitle="Cash already moved to safe custody but not fully linked to a deposit batch.">
                        <ReportTable
                            rows={openHandovers}
                            columns={[
                                { key: 'transaction_date', label: 'Date', render: (row) => formatDate(row.transaction_date) },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, `Handover ${row.journal_entry_id}`) },
                                { key: 'source_account_name', label: 'Source Account', render: (row) => `${sanitizeText(row.source_account_code, '')} ${sanitizeText(row.source_account_name, '-')}`.trim() },
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, '-') },
                                { key: 'remaining_amount', label: 'Remaining Amount', align: 'right', render: (row) => formatPKR(Number(row.remaining_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Open Transit Deposit Batches" subtitle="Deposit batches sent to bank but not fully cleared into the final bank account.">
                        <ReportTable
                            rows={openTransitBatches}
                            columns={[
                                { key: 'transaction_date', label: 'Date', render: (row) => formatDate(row.transaction_date) },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, `Deposit ${row.deposit_entry_id}`) },
                                { key: 'source_safe_account_name', label: 'Source Safe', render: (row) => `${sanitizeText(row.source_safe_account_code, '')} ${sanitizeText(row.source_safe_account_name, '-')}`.trim() },
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, '-') },
                                { key: 'remaining_in_transit_amount', label: 'Remaining In Transit', align: 'right', render: (row) => formatPKR(Number(row.remaining_in_transit_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        if (selectedReportId === 'merchant-settlement-aging') {
            const summary = reportPayload?.summary ?? {};
            const providerSummary = Array.isArray(reportPayload?.provider_summary) ? reportPayload.provider_summary : [];
            const queue = Array.isArray(reportPayload?.queue) ? reportPayload.queue : [];

            return (
                <>
                    <ReportMetricGrid
                        items={[
                            { label: 'Open Merchant Receipts', value: formatCompactNumber(Number(summary.open_receipt_count ?? 0)) },
                            { label: 'Open Receipt Amount', value: formatPKR(Number(summary.open_receipt_amount ?? 0)) },
                            { label: 'Aged Open Amount', value: formatPKR(Number(summary.aged_open_receipt_amount ?? 0)) },
                            { label: 'Provider Exposure', value: formatCompactNumber(providerSummary.length) },
                        ]}
                    />
                    <ReportSection title="Provider Exposure Summary" subtitle="Outstanding merchant clearing balance grouped by settlement provider.">
                        <ReportTable
                            rows={providerSummary}
                            columns={[
                                { key: 'provider_name', label: 'Provider', render: (row) => sanitizeText(row.provider_name, 'Unknown') },
                                { key: 'settlement_channel_label', label: 'Channel', render: (row) => sanitizeText(row.settlement_channel_label, 'Other Merchant') },
                                { key: 'open_receipt_count', label: 'Open Receipts', align: 'center', render: (row) => formatCompactNumber(Number(row.open_receipt_count ?? row.channel_open_receipt_count ?? 0)) },
                                { key: 'channel_open_receipt_amount', label: 'Open Amount', align: 'right', render: (row) => formatPKR(Number(row.channel_open_receipt_amount ?? 0)) },
                                { key: 'aged_channel_open_receipt_amount', label: 'Aged Amount', align: 'right', render: (row) => formatPKR(Number(row.aged_channel_open_receipt_amount ?? 0)) },
                                { key: 'settlement_shortfall_amount', label: 'Charges / Shortfall', align: 'right', render: (row) => formatPKR(Number(row.settlement_shortfall_amount ?? 0)) },
                            ]}
                        />
                    </ReportSection>
                    <ReportSection title="Outstanding Merchant Receipt Queue" subtitle="Detailed aged queue of merchant clearing lines still awaiting treasury or bank settlement.">
                        <ReportTable
                            rows={queue}
                            columns={[
                                { key: 'transaction_date', label: 'Receipt Date', render: (row) => formatDate(row.transaction_date) },
                                { key: 'branch_name', label: 'Branch', render: (row) => sanitizeText(row.branch_name, '-') },
                                { key: 'provider_name', label: 'Provider', render: (row) => sanitizeText(row.provider_name, 'Unknown') },
                                { key: 'settlement_channel_label', label: 'Channel', render: (row) => sanitizeText(row.settlement_channel_label, 'Unknown') },
                                { key: 'reference_id', label: 'Reference', render: (row) => sanitizeText(row.reference_id, '-') },
                                { key: 'absolute_amount', label: 'Amount', align: 'right', render: (row) => formatPKR(Number(row.absolute_amount ?? 0)) },
                                { key: 'days_open', label: 'Days Open', align: 'center', render: (row) => formatCompactNumber(Number(row.days_open ?? 0)) },
                                { key: 'review_status', label: 'Status', render: (row) => sanitizeText(row.review_status, '-') },
                            ]}
                        />
                    </ReportSection>
                </>
            );
        }

        return <div className={styles.emptyPrintRow}>Report preview is not available.</div>;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Landmark size={18} /></div>
                    <div>
                        <h1>Bank & Treasury Reports</h1>
                        <p>Printable bank, reconciliation, settlement, and treasury control reports for day-to-day finance operations.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.selectorBox}>
                        <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect
                            options={PERIOD_OPTIONS}
                            value={periodPreset}
                            onChange={(event) => setPeriodPreset(event.target.value as PeriodPreset)}
                        />
                        <input
                            type="date"
                            className={`${styles.dateInput} ${styles.headerDateInput}`}
                            value={dateFrom}
                            onChange={(event) => {
                                setPeriodPreset('custom');
                                setDateFrom(event.target.value);
                            }}
                        />
                        <input
                            type="date"
                            className={`${styles.dateInput} ${styles.headerDateInput}`}
                            value={dateTo}
                            onChange={(event) => {
                                setPeriodPreset('custom');
                                setDateTo(event.target.value);
                            }}
                        />
                    </div>
                </div>
            </header>

            <section className={styles.reportCenter}>
                <div className={styles.reportCenterHeader}>
                    <div>
                        <h2>Bank Reporting Pack</h2>
                        <p>Select a bank or treasury report on the left, review it on-screen, and print it in A4 format.</p>
                    </div>
                    <div className={styles.reportCenterActions}>
                        <KitchenButton variant="secondary" size="sm" onClick={() => void runReport(selectedReportId)} disabled={loading || reportLoading}>
                            <FileText size={14} style={{ marginRight: 6 }} />
                            Run Report
                        </KitchenButton>
                        <KitchenButton variant="primary" size="sm" onClick={printReport} disabled={reportLoading || !reportPayload}>
                            <Printer size={14} style={{ marginRight: 6 }} />
                            Print A4
                        </KitchenButton>
                    </div>
                </div>

                <div className={styles.reportWorkspace}>
                    <aside className={styles.reportSidebar}>
                        <div className={styles.reportSidebarTop}>
                            <div>
                                <span className={styles.reportCatalogCategory}>Report List</span>
                                <strong className={styles.reportSidebarTitle}>Bank & Treasury</strong>
                                <p className={styles.reportSidebarText}>Core bank, settlement, and reconciliation reports designed for finance review and audit printing.</p>
                            </div>
                            <div className={styles.reportSidebarControls}>
                                <div className={styles.reportSidebarField}>
                                    <span>Branch Scope</span>
                                    <KitchenSelect
                                        options={branchOptions}
                                        value={selectedBranch}
                                        onChange={(event) => setSelectedBranch(event.target.value)}
                                    />
                                </div>
                                {selectedReport.requiresAccount && (
                                    <div className={styles.reportSidebarField}>
                                        <span>{selectedReport.accountSource === 'reconciliation' ? 'Reconciliation Account' : 'Bank Account'}</span>
                                        <KitchenSelect
                                            options={currentAccountOptions}
                                            value={selectedScopedAccountId}
                                            onChange={(event) => {
                                                if (selectedReport.accountSource === 'reconciliation') {
                                                    setSelectedReconAccountId(event.target.value);
                                                } else {
                                                    setSelectedAccountId(event.target.value);
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                                <div className={styles.reportSidebarStatus}>
                                    <span>Report Period</span>
                                    <strong>{reportScope}</strong>
                                </div>
                                <div className={styles.reportSidebarStatus}>
                                    <span>Generated</span>
                                    <strong>{reportGeneratedAt ? formatDate(reportGeneratedAt) : 'Pending'}</strong>
                                </div>
                            </div>
                        </div>

                        <div className={styles.reportCatalogList}>
                            {availableReports.map((report) => {
                                const isSelected = report.id === selectedReportId;
                                return (
                                    <button
                                        key={report.id}
                                        type="button"
                                        className={`${styles.reportCatalogCard} ${isSelected ? styles.reportCatalogCardActive : ''}`}
                                        onClick={() => setSelectedReportId(report.id)}
                                    >
                                        <span className={styles.reportCatalogCategory}>{report.category}</span>
                                        <strong>{report.name}</strong>
                                        <p>{report.description}</p>
                                        {report.scopeNote ? <span className={styles.reportCatalogNote}>{report.scopeNote}</span> : null}
                                    </button>
                                );
                            })}
                            {availableReports.length === 0 && (
                                <div className={styles.emptyPrintRow}>No bank or treasury reports are available for your current role.</div>
                            )}
                        </div>
                    </aside>

                    <div className={styles.reportPreviewWrap}>
                        <div className={styles.reportRunnerMeta}>
                            <div>
                                <span className={styles.reportRunnerLabel}>Selected Report</span>
                                <strong>{selectedReport.name}</strong>
                                <p>{selectedReport.description}</p>
                            </div>
                            <div className={styles.reportRunnerSummary}>
                                <span className={styles.reportRunnerLabel}>Current Scope</span>
                                <strong>{branchLabel}</strong>
                                <p>
                                    {selectedReport.requiresAccount ? `${selectedAccountLabel} | ` : ''}
                                    {tenantSlug ? `Console ${tenantSlug}` : 'Console Scope'}
                                </p>
                            </div>
                        </div>

                        {loading && <div className={styles.emptyPrintRow}>Loading bank reporting context...</div>}
                        {error && <div className={styles.emptyPrintRow}>{error}</div>}
                        {!loading && !error && (
                            <div className={styles.printSheet}>
                                <div className={styles.printSheetHeader}>
                                    <div>
                                        <span className={styles.printSheetEyebrow}>KitchenOS Finance</span>
                                        <h2>{selectedReport.name}</h2>
                                        <p>{selectedReport.description}</p>
                                    </div>
                                    <div className={styles.printSheetMeta}>
                                        <div>
                                            <span>Branch Scope</span>
                                            <strong>{branchLabel}</strong>
                                        </div>
                                        <div>
                                            <span>Report Period</span>
                                            <strong>{reportScope}</strong>
                                        </div>
                                        <div>
                                            <span>Generated On</span>
                                            <strong>{reportGeneratedAt ? formatDate(reportGeneratedAt) : formatDate(new Date().toISOString())}</strong>
                                        </div>
                                    </div>
                                </div>
                                {renderReportPreview()}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
