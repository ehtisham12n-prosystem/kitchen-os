/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { accountingApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import {
    Building2,
    Calendar,
    Calculator,
    DollarSign,
    FileText,
    LayoutGrid,
    Layers,
    List,
    Lock,
    Receipt,
    Save,
    Settings,
} from 'lucide-react';
import styles from './AccountingSettings.module.css';

type ViewMode = 'line' | 'grid';
type PeriodLockMode = 'none' | 'admin_override' | 'hard_lock';

type StaticRule = {
    id: string;
    label: string;
    desc: string;
    enabled: boolean;
};

type ChecklistStatus = 'pending' | 'completed' | 'blocked';

const PERIOD_LOCK_OPTIONS = [
    { value: 'hard_lock', label: 'Yes — Prevent all edits' },
    { value: 'admin_override', label: 'Admin Override Only' },
    { value: 'none', label: 'No — Allow edits' },
];

export function AccountingSettings() {
    const { activeBranch } = useBranchContext();
    const [viewMode, setViewMode] = useState<ViewMode>('line');
    const [periodLockMode, setPeriodLockMode] = useState<PeriodLockMode>('admin_override');
    const [lockedThroughDate, setLockedThroughDate] = useState('');
    const [periodLockNotes, setPeriodLockNotes] = useState('');
    const [reopenReason, setReopenReason] = useState('');
    const [originalPeriodLock, setOriginalPeriodLock] = useState<{ mode: PeriodLockMode; lockedThroughDate: string }>({ mode: 'admin_override', lockedThroughDate: '' });
    const [periodLockMeta, setPeriodLockMeta] = useState<{
        updated_by?: string | null;
        updated_at?: string | null;
        scope?: string | null;
        last_reopened_by?: string | null;
        last_reopened_at?: string | null;
        last_reopen_reason?: string | null;
        year_end_finalized_period_key?: string | null;
        year_end_finalized_by?: string | null;
        year_end_finalized_at?: string | null;
        year_end_close_journal_entry_id?: number | null;
        year_end_reopened_by?: string | null;
        year_end_reopened_at?: string | null;
        year_end_reopen_reason?: string | null;
    }>({});
    const [periodLockLoading, setPeriodLockLoading] = useState(true);
    const [periodLockSaving, setPeriodLockSaving] = useState(false);
    const [closeHistory, setCloseHistory] = useState<any[]>([]);
    const [closeHistoryLoading, setCloseHistoryLoading] = useState(true);
    const [monthCloseChecklist, setMonthCloseChecklist] = useState<any | null>(null);
    const [monthCloseLoading, setMonthCloseLoading] = useState(true);
    const [checklistSavingKey, setChecklistSavingKey] = useState<string | null>(null);
    const [yearEndNote, setYearEndNote] = useState('');
    const [yearEndReopenReason, setYearEndReopenReason] = useState('');
    const [yearEndSaving, setYearEndSaving] = useState<'finalize' | 'reopen' | null>(null);
    const [payrollCompliance, setPayrollCompliance] = useState<any | null>(null);
    const [payrollComplianceSaving, setPayrollComplianceSaving] = useState(false);
    const [automationRules, setAutomationRules] = useState<StaticRule[]>([
        { id: 'pos', label: 'POS Daily Sales', desc: 'Auto-post daily summary journal from POS', enabled: true },
        { id: 'inv', label: 'Inventory Consumption', desc: 'Post COGS on inventory usage', enabled: true },
        { id: 'pay', label: 'Payroll Processing', desc: 'Post salary expense journal on payroll run', enabled: true },
        { id: 'ven', label: 'Vendor Payments', desc: 'Post AP clearing on payment approval', enabled: true },
    ]);

    useEffect(() => {
        const loadPeriodLock = async () => {
            setPeriodLockLoading(true);
            setCloseHistoryLoading(true);
            setMonthCloseLoading(true);
            try {
                const [response, closeHistoryResponse, payrollComplianceResponse, checklistResponse] = await Promise.all([
                    accountingApi.getPeriodLock({
                        branch_id: activeBranch?.branch_id ?? null,
                    }),
                    accountingApi.getDayClosingHistory(activeBranch?.branch_id ?? null),
                    activeBranch?.branch_id
                        ? accountingApi.getPayrollComplianceSetting({ branch_id: activeBranch.branch_id })
                        : Promise.resolve(null),
                    activeBranch?.branch_id
                        ? accountingApi.getMonthCloseChecklist({ branch_id: activeBranch.branch_id })
                        : Promise.resolve(null),
                ]);
                setPeriodLockMode((response?.mode ?? 'admin_override') as PeriodLockMode);
                setLockedThroughDate(response?.locked_through_date ?? '');
                setOriginalPeriodLock({
                    mode: (response?.mode ?? 'admin_override') as PeriodLockMode,
                    lockedThroughDate: response?.locked_through_date ?? '',
                });
                setPeriodLockNotes(response?.notes ?? '');
                setCloseHistory(closeHistoryResponse ?? []);
                setPayrollCompliance(payrollComplianceResponse ?? null);
                setMonthCloseChecklist(checklistResponse ?? null);
                setPeriodLockMeta({
                    updated_by: response?.updated_by ?? null,
                    updated_at: response?.updated_at ?? null,
                    scope: response?.scope ?? null,
                    last_reopened_by: response?.last_reopened_by ?? null,
                    last_reopened_at: response?.last_reopened_at ?? null,
                    last_reopen_reason: response?.last_reopen_reason ?? null,
                    year_end_finalized_period_key: response?.year_end_finalized_period_key ?? null,
                    year_end_finalized_by: response?.year_end_finalized_by ?? null,
                    year_end_finalized_at: response?.year_end_finalized_at ?? null,
                    year_end_close_journal_entry_id: response?.year_end_close_journal_entry_id ?? null,
                    year_end_reopened_by: response?.year_end_reopened_by ?? null,
                    year_end_reopened_at: response?.year_end_reopened_at ?? null,
                    year_end_reopen_reason: response?.year_end_reopen_reason ?? null,
                });
            } catch (error: any) {
                toast.error('Accounting Settings', error?.message || 'Could not load period lock settings.');
            } finally {
                setPeriodLockLoading(false);
                setCloseHistoryLoading(false);
                setMonthCloseLoading(false);
            }
        };

        void loadPeriodLock();
    }, [activeBranch?.branch_id]);

    const toggleRule = (id: string) => {
        setAutomationRules((rules) => rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
    };

    const closeGovernanceSummary = useMemo(() => ({
        varianceCount: closeHistory.filter((item) => item.review_status === 'variance_review').length,
        notedCount: closeHistory.filter((item) => item.review_status === 'noted_close').length,
        latestClose: closeHistory[0] ?? null,
    }), [closeHistory]);
    const checklistSummary = monthCloseChecklist?.summary ?? { total_count: 0, completed_count: 0, pending_count: 0, blocked_count: 0, completion_percent: 0, top_open_item: null };
    const pendingAccruals = monthCloseChecklist?.pending_accruals ?? { count: 0, overdue_count: 0, total_amount: 0, top_due_date: null, entries: [] };
    const closeAdjustmentSchedules = monthCloseChecklist?.close_adjustment_schedules ?? { count: 0, overdue_count: 0, total_amount: 0, prepaid_count: 0, deferred_count: 0, depreciation_count: 0, entries: [] };
    const yearEndGovernance = monthCloseChecklist?.year_end_governance ?? {
        is_year_end_period: false,
        year_end_period_key: null,
        status: 'upcoming',
        open_item_count: 0,
        top_open_item: null,
        note: null,
        fiscal_year_start: null,
        fiscal_year_end: null,
        is_finalized: false,
        finalized_at: null,
        finalized_by: null,
        close_journal_entry_id: null,
        reopened_at: null,
        reopened_by: null,
        reopened_reason: null,
    };
    const isReopenChange = useMemo(() => {
        const originalDate = originalPeriodLock.lockedThroughDate || null;
        const nextDate = lockedThroughDate || null;
        if (originalPeriodLock.mode === 'hard_lock') {
            return periodLockMode !== 'hard_lock'
                || (originalDate && !nextDate)
                || (originalDate && nextDate && nextDate < originalDate);
        }
        if (originalPeriodLock.mode === 'admin_override') {
            return periodLockMode === 'none'
                || (originalDate && !nextDate)
                || (originalDate && nextDate && nextDate < originalDate);
        }
        return false;
    }, [lockedThroughDate, originalPeriodLock, periodLockMode]);

    const periodLockStatusLabel = periodLockMode === 'hard_lock'
        ? 'Hard lock in force'
        : periodLockMode === 'admin_override'
            ? 'Admin override only'
            : 'Open period';

    const savePeriodLock = async () => {
        setPeriodLockSaving(true);
        try {
            const response = await accountingApi.updatePeriodLock({
                branch_id: activeBranch?.branch_id ?? null,
                mode: periodLockMode,
                locked_through_date: lockedThroughDate || null,
                notes: periodLockNotes.trim() || null,
                reopen_reason: isReopenChange ? reopenReason.trim() || null : null,
            });
            setPeriodLockMeta({
                updated_by: response?.updated_by ?? null,
                updated_at: response?.updated_at ?? null,
                scope: response?.scope ?? null,
                last_reopened_by: response?.last_reopened_by ?? null,
                last_reopened_at: response?.last_reopened_at ?? null,
                last_reopen_reason: response?.last_reopen_reason ?? null,
                year_end_finalized_period_key: response?.year_end_finalized_period_key ?? null,
                year_end_finalized_by: response?.year_end_finalized_by ?? null,
                year_end_finalized_at: response?.year_end_finalized_at ?? null,
                year_end_close_journal_entry_id: response?.year_end_close_journal_entry_id ?? null,
                year_end_reopened_by: response?.year_end_reopened_by ?? null,
                year_end_reopened_at: response?.year_end_reopened_at ?? null,
                year_end_reopen_reason: response?.year_end_reopen_reason ?? null,
            });
            setOriginalPeriodLock({
                mode: (response?.mode ?? periodLockMode) as PeriodLockMode,
                lockedThroughDate: response?.locked_through_date ?? lockedThroughDate,
            });
            setReopenReason('');
            toast.success('Period Lock Saved', 'Period lock settings were updated.');
        } catch (error: any) {
            toast.error('Period Lock', error?.message || 'Could not save period lock settings.');
        } finally {
            setPeriodLockSaving(false);
        }
    };

    const savePayrollCompliance = async () => {
        if (!activeBranch?.branch_id || !payrollCompliance) {
            return;
        }
        setPayrollComplianceSaving(true);
        try {
            const response = await accountingApi.upsertPayrollComplianceSetting({
                branch_id: activeBranch.branch_id,
                income_tax_rate: Number(payrollCompliance.income_tax_rate || 0),
                income_tax_threshold: Number(payrollCompliance.income_tax_threshold || 0),
                eobi_employee_fixed: Number(payrollCompliance.eobi_employee_fixed || 0),
                eobi_employer_fixed: Number(payrollCompliance.eobi_employer_fixed || 0),
                social_security_employee_rate: Number(payrollCompliance.social_security_employee_rate || 0),
                social_security_employer_rate: Number(payrollCompliance.social_security_employer_rate || 0),
                social_security_salary_cap: Number(payrollCompliance.social_security_salary_cap || 0),
                notes: payrollCompliance.notes || '',
                is_active: payrollCompliance.is_active !== false,
            });
            setPayrollCompliance(response);
            toast.success('Payroll Compliance', 'Payroll statutory settings were updated.');
        } catch (error: any) {
            toast.error('Payroll Compliance', error?.message || 'Could not save payroll statutory settings.');
        } finally {
            setPayrollComplianceSaving(false);
        }
    };

    const updateChecklistItem = async (itemKey: string, status: ChecklistStatus) => {
        if (!activeBranch?.branch_id || !monthCloseChecklist?.period_key) {
            return;
        }
        setChecklistSavingKey(itemKey);
        try {
            const response = await accountingApi.updateMonthCloseChecklistItem({
                branch_id: activeBranch.branch_id,
                period_key: monthCloseChecklist.period_key,
                item_key: itemKey,
                status,
            });
            setMonthCloseChecklist(response);
            toast.success('Month-Close Checklist', 'Checklist status updated.');
        } catch (error: any) {
            toast.error('Month-Close Checklist', error?.message || 'Could not update checklist item.');
        } finally {
            setChecklistSavingKey(null);
        }
    };

    const refreshYearEndGovernance = async () => {
        if (!activeBranch?.branch_id) {
            return;
        }
        const [lockResponse, checklistResponse] = await Promise.all([
            accountingApi.getPeriodLock({ branch_id: activeBranch.branch_id }),
            accountingApi.getMonthCloseChecklist({
                branch_id: activeBranch.branch_id,
                period_key: monthCloseChecklist?.period_key,
            }),
        ]);
        setPeriodLockMeta({
            updated_by: lockResponse?.updated_by ?? null,
            updated_at: lockResponse?.updated_at ?? null,
            scope: lockResponse?.scope ?? null,
            last_reopened_by: lockResponse?.last_reopened_by ?? null,
            last_reopened_at: lockResponse?.last_reopened_at ?? null,
            last_reopen_reason: lockResponse?.last_reopen_reason ?? null,
            year_end_finalized_period_key: lockResponse?.year_end_finalized_period_key ?? null,
            year_end_finalized_by: lockResponse?.year_end_finalized_by ?? null,
            year_end_finalized_at: lockResponse?.year_end_finalized_at ?? null,
            year_end_close_journal_entry_id: lockResponse?.year_end_close_journal_entry_id ?? null,
            year_end_reopened_by: lockResponse?.year_end_reopened_by ?? null,
            year_end_reopened_at: lockResponse?.year_end_reopened_at ?? null,
            year_end_reopen_reason: lockResponse?.year_end_reopen_reason ?? null,
        });
        setPeriodLockMode((lockResponse?.mode ?? 'admin_override') as PeriodLockMode);
        setLockedThroughDate(lockResponse?.locked_through_date ?? '');
        setOriginalPeriodLock({
            mode: (lockResponse?.mode ?? 'admin_override') as PeriodLockMode,
            lockedThroughDate: lockResponse?.locked_through_date ?? '',
        });
        setMonthCloseChecklist(checklistResponse ?? null);
    };

    const finalizeYearEnd = async () => {
        if (!activeBranch?.branch_id || !monthCloseChecklist?.period_key) {
            return;
        }
        setYearEndSaving('finalize');
        try {
            const response = await accountingApi.finalizeYearEnd({
                branch_id: activeBranch.branch_id,
                period_key: monthCloseChecklist.period_key,
                note: yearEndNote.trim() || null,
            });
            setMonthCloseChecklist(response);
            await refreshYearEndGovernance();
            setYearEndNote('');
            toast.success('Year-End Close', 'Year-end close was finalized and hard-locked.');
        } catch (error: any) {
            toast.error('Year-End Close', error?.message || 'Could not finalize year-end close.');
        } finally {
            setYearEndSaving(null);
        }
    };

    const reopenYearEnd = async () => {
        if (!activeBranch?.branch_id || !monthCloseChecklist?.period_key || !yearEndReopenReason.trim()) {
            return;
        }
        setYearEndSaving('reopen');
        try {
            const response = await accountingApi.reopenYearEnd({
                branch_id: activeBranch.branch_id,
                period_key: monthCloseChecklist.period_key,
                reason: yearEndReopenReason.trim(),
            });
            setMonthCloseChecklist(response);
            await refreshYearEndGovernance();
            setYearEndReopenReason('');
            toast.success('Year-End Close', 'Year-end close was reopened under controlled lock override.');
        } catch (error: any) {
            toast.error('Year-End Close', error?.message || 'Could not reopen year-end close.');
        } finally {
            setYearEndSaving(null);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Settings size={18} /></div>
                    <div>
                        <h1>Accounting Settings</h1>
                        <p>Configure accounting structure, defaults, automation, and close governance for {activeBranch?.branch_name || 'the active branch'}.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.viewToggle}>
                        <button className={`${styles.toggleBtn} ${viewMode === 'line' ? styles.toggleActive : ''}`} onClick={() => setViewMode('line')} title="Line View">
                            <List size={14} />
                        </button>
                        <button className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleActive : ''}`} onClick={() => setViewMode('grid')} title="Grid View">
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                    <KitchenButton variant="primary" size="sm" className={styles.actionBtn} onClick={() => void savePeriodLock()} disabled={Boolean(periodLockSaving || (isReopenChange && !reopenReason.trim()))}>
                        <Save size={14} style={{ marginRight: 6 }} /> {periodLockSaving ? 'Saving...' : 'Save Changes'}
                    </KitchenButton>
                </div>
            </header>

            <div className={`${styles.settingsWrapper} ${viewMode === 'grid' ? styles.gridView : styles.lineView}`}>
                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 15%, transparent)' }}><DollarSign size={16} /></div>
                            <div><h3>Currency & Format</h3><span className={styles.panelMeta}>Current operational default</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.governanceStrip}>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Lock Status</span>
                                <strong className={styles.governanceValue}>{periodLockStatusLabel}</strong>
                                <small>{lockedThroughDate ? `Through ${new Date(lockedThroughDate).toLocaleDateString('en-PK')}` : 'No lock date set'}</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Scope</span>
                                <strong className={styles.governanceValue}>{periodLockMeta.scope === 'company' ? 'Company Default' : (activeBranch?.branch_name || 'Branch')}</strong>
                                <small>{periodLockMode === 'admin_override' ? 'Approval-role users may still override locked posting.' : periodLockMode === 'hard_lock' ? 'All posting edits are blocked.' : 'Posting remains open.'}</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Reopen Policy</span>
                                <strong className={styles.governanceValue}>No silent reopen</strong>
                                <small>Closed-day corrections should be visible through governed journals, notes, and close review.</small>
                            </div>
                            {isReopenChange ? (
                                <div className={`${styles.field} ${styles.fullSpan}`}>
                                    <label>Reopen Reason</label>
                                    <textarea
                                        className={styles.textArea}
                                        value={reopenReason}
                                        onChange={(event) => setReopenReason(event.target.value)}
                                        placeholder="Why is this period being reopened or shortened?"
                                        rows={3}
                                    />
                                </div>
                            ) : null}
                        </div>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Base Currency</label><KitchenInput value="PKR" readOnly /></div>
                            <div className={styles.field}><label>Decimal Places</label><KitchenInput value="2" readOnly /></div>
                            <div className={styles.field}><label>Thousands Separator</label><KitchenInput value="Comma (1,000,000)" readOnly /></div>
                            <div className={styles.field}><label>Branch Scope</label><KitchenInput value={activeBranch?.branch_name || 'No active branch'} readOnly /></div>
                        </div>
                        {periodLockMeta.last_reopen_reason ? (
                            <div className={styles.helperText}>Last reopen reason: {periodLockMeta.last_reopen_reason}</div>
                        ) : null}
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}><Calendar size={16} /></div>
                            <div><h3>Fiscal Year</h3><span className={styles.panelMeta}>Current reporting cycle</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Fiscal Year Start</label><KitchenInput value="July" readOnly /></div>
                            <div className={styles.field}><label>Closing Cycle</label><KitchenInput value="Monthly" readOnly /></div>
                            <div className={styles.field}><label>Current Fiscal Year</label><KitchenInput value="FY 2025 - 2026" readOnly /></div>
                            <div className={styles.field}><label>Close Discipline</label><KitchenInput value="Day close + finance lock" readOnly /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--accent-secondary)', background: 'color-mix(in srgb, var(--accent-secondary) 15%, transparent)' }}><Layers size={16} /></div>
                            <div><h3>Chart of Accounts</h3><span className={styles.panelMeta}>Current structural defaults</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Format</label><KitchenInput value="4-digit" readOnly /></div>
                            <div className={styles.field}><label>Sub-Accounts</label><KitchenInput value="Enabled" readOnly /></div>
                            <div className={styles.field}><label>Assets</label><KitchenInput value="1000 – 1999" readOnly /></div>
                            <div className={styles.field}><label>Liabilities</label><KitchenInput value="2000 – 2999" readOnly /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--alert-warning-text)', background: 'color-mix(in srgb, var(--alert-warning-text) 15%, transparent)' }}><Receipt size={16} /></div>
                            <div><h3>Tax & Invoicing Defaults</h3><span className={styles.panelMeta}>Current mapped defaults</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Default Sales Tax</label><KitchenInput value="17% - Standard GST" readOnly /></div>
                            <div className={styles.field}><label>Payment Terms</label><KitchenInput value="Net 30" readOnly /></div>
                            <div className={styles.field}><label>Invoice Prefix</label><KitchenInput value="INV-26-" readOnly /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--alert-success-text)', background: 'color-mix(in srgb, var(--alert-success-text) 15%, transparent)' }}><Calculator size={16} /></div>
                            <div><h3>Inventory Valuation</h3><span className={styles.panelMeta}>Current costing basis</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Valuation Method</label><KitchenInput value="Weighted Average Cost" readOnly /></div>
                            <div className={styles.field}><label>COGS Account</label><KitchenInput value="5100 — Cost of Goods Sold" readOnly /></div>
                            <div className={styles.field}><label>Wastage Account</label><KitchenInput value="5500 — Inventory Wastage" readOnly /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: '#16a34a', background: 'color-mix(in srgb, #16a34a 15%, transparent)' }}><Calculator size={16} /></div>
                            <div><h3>Payroll Compliance</h3><span className={styles.panelMeta}>Statutory employee deductions and employer contribution rules</span></div>
                        </div>
                        <KitchenButton variant="primary" size="sm" className={styles.actionBtn} onClick={() => void savePayrollCompliance()} disabled={payrollComplianceSaving || !activeBranch?.branch_id}>
                            <Save size={14} style={{ marginRight: 6 }} /> {payrollComplianceSaving ? 'Saving...' : 'Save Payroll Rules'}
                        </KitchenButton>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Salary Tax Rate %</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.income_tax_rate ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), income_tax_rate: e.target.value }))} /></div>
                            <div className={styles.field}><label>Salary Tax Threshold</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.income_tax_threshold ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), income_tax_threshold: e.target.value }))} /></div>
                            <div className={styles.field}><label>EOBI Employee Fixed</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.eobi_employee_fixed ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), eobi_employee_fixed: e.target.value }))} /></div>
                            <div className={styles.field}><label>EOBI Employer Fixed</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.eobi_employer_fixed ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), eobi_employer_fixed: e.target.value }))} /></div>
                            <div className={styles.field}><label>Social Security Employee %</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.social_security_employee_rate ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), social_security_employee_rate: e.target.value }))} /></div>
                            <div className={styles.field}><label>Social Security Employer %</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.social_security_employer_rate ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), social_security_employer_rate: e.target.value }))} /></div>
                            <div className={styles.field}><label>Social Security Salary Cap</label><KitchenInput type="number" min="0" value={String(payrollCompliance?.social_security_salary_cap ?? 0)} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), social_security_salary_cap: e.target.value }))} /></div>
                            <div className={styles.field}><label>Compliance Active</label><KitchenSelect options={[{ value: '1', label: 'Enabled' }, { value: '0', label: 'Disabled' }]} value={payrollCompliance?.is_active === false ? '0' : '1'} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), is_active: e.target.value === '1' }))} /></div>
                            <div className={styles.field} style={{ gridColumn: '1 / -1' }}><label>Notes</label><KitchenInput value={String(payrollCompliance?.notes ?? '')} onChange={(e) => setPayrollCompliance((current: any) => ({ ...(current ?? {}), notes: e.target.value }))} placeholder="Branch-specific statutory note or compliance rule context" /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--accent-tertiary)', background: 'color-mix(in srgb, var(--accent-tertiary) 15%, transparent)' }}><Building2 size={16} /></div>
                            <div><h3>Bank & Reconciliation</h3><span className={styles.panelMeta}>Treasury control baseline</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}><label>Default Operating Bank</label><KitchenInput value="1102 — Bank Current Account" readOnly /></div>
                            <div className={styles.field}><label>Auto-match Tolerance Amount</label><KitchenInput value="10" readOnly /></div>
                            <div className={styles.field}><label>Auto-match Tolerance Days</label><KitchenInput value="3" readOnly /></div>
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: '#0ea5e9', background: 'color-mix(in srgb, #0ea5e9 15%, transparent)' }}><FileText size={16} /></div>
                            <div><h3>Auto Journal Rules</h3><span className={styles.panelMeta}>Operational posting baselines</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.ruleList}>
                            {automationRules.map((rule) => (
                                <div key={rule.id} className={styles.ruleRow}>
                                    <div className={styles.ruleText}>
                                        <span className={styles.ruleLabel}>{rule.label}</span>
                                        <span className={styles.ruleDesc}>{rule.desc}</span>
                                    </div>
                                    <button className={`${styles.switch} ${rule.enabled ? styles.switchOn : styles.switchOff}`} onClick={() => toggleRule(rule.id)}>
                                        <div className={styles.switchKnob} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 15%, transparent)' }}><Calendar size={16} /></div>
                            <div><h3>Month-Close Checklist</h3><span className={styles.panelMeta}>Accrual and close-control workflow for {monthCloseChecklist?.period_key || 'current month'}</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.governanceStrip}>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Checklist Completion</span>
                                <strong className={styles.governanceValue}>{Number(checklistSummary.completion_percent ?? 0)}%</strong>
                                <small>{Number(checklistSummary.completed_count ?? 0)} of {Number(checklistSummary.total_count ?? 0)} items completed.</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Pending Accrual Reversals</span>
                                <strong className={styles.governanceValue}>{Number(pendingAccruals.count ?? 0)}</strong>
                                <small>{Number(pendingAccruals.overdue_count ?? 0)} overdue · PKR {Number(pendingAccruals.total_amount ?? 0).toLocaleString('en-PK')}</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Close Schedules</span>
                                <strong className={styles.governanceValue}>{Number(closeAdjustmentSchedules.count ?? 0)}</strong>
                                {Number(closeAdjustmentSchedules.depreciation_count ?? 0) > 0 ? <small>{Number(closeAdjustmentSchedules.depreciation_count ?? 0)} depreciation schedule(s) in scope</small> : null}
                                <small>{Number(closeAdjustmentSchedules.prepaid_count ?? 0)} prepaid / {Number(closeAdjustmentSchedules.deferred_count ?? 0)} deferred</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Top Open Close Item</span>
                                <strong className={styles.governanceValue}>{checklistSummary.top_open_item || 'Checklist clear'}</strong>
                                <small>{Number(checklistSummary.blocked_count ?? 0)} blocked items still need attention.</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Top Schedule Review</span>
                                <strong className={styles.governanceValue}>{closeAdjustmentSchedules.top_priority?.close_adjustment_type_label || 'No schedules in scope'}</strong>
                                <small>{closeAdjustmentSchedules.top_priority?.review_note || 'No prepaid, deferred, or depreciation schedule currently needs attention.'}</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Year-End Governance</span>
                                <strong className={styles.governanceValue}>
                                    {yearEndGovernance.is_year_end_period
                                        ? yearEndGovernance.status === 'ready' ? 'Active Ready' : 'Active Attention'
                                        : `Next ${yearEndGovernance.year_end_period_key || 'Year-End'}`}
                                </strong>
                                <small>{yearEndGovernance.note || 'Year-end governance will appear here when relevant.'}</small>
                            </div>
                        </div>
                        {yearEndGovernance.is_year_end_period ? (
                            <div className={styles.fieldGrid} style={{ marginBottom: 18 }}>
                                <div className={`${styles.field} ${styles.fullSpan}`}>
                                    <label>Year-End Finalization Note</label>
                                    <textarea
                                        className={styles.textArea}
                                        value={yearEndNote}
                                        onChange={(event) => setYearEndNote(event.target.value)}
                                        placeholder="Optional note for the retained earnings close transfer and year-end finalization."
                                        rows={3}
                                        disabled={yearEndSaving === 'finalize' || yearEndGovernance.is_finalized}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Closing Transfer</label>
                                    <KitchenInput
                                        value={yearEndGovernance.close_journal_entry_id ? `JE-${String(yearEndGovernance.close_journal_entry_id).padStart(4, '0')}` : 'Not finalized yet'}
                                        readOnly
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Fiscal Year Range</label>
                                    <KitchenInput
                                        value={`${yearEndGovernance.fiscal_year_start || '-'} to ${yearEndGovernance.fiscal_year_end || '-'}`}
                                        readOnly
                                    />
                                </div>
                                <div className={`${styles.field} ${styles.fullSpan}`}>
                                    <div className={styles.helperText}>
                                        {yearEndGovernance.is_finalized
                                            ? `Finalized ${yearEndGovernance.finalized_at ? new Date(yearEndGovernance.finalized_at).toLocaleString('en-PK') : ''}${yearEndGovernance.finalized_by ? ` by ${yearEndGovernance.finalized_by}` : ''}.`
                                            : 'Finalize year-end only after all checklist items and finance close blockers are clear. This will post the retained earnings close transfer and hard-lock the fiscal year end.'}
                                    </div>
                                </div>
                                {!yearEndGovernance.is_finalized ? (
                                    <div className={`${styles.field} ${styles.fullSpan}`}>
                                        <KitchenButton
                                            variant="primary"
                                            size="sm"
                                            className={styles.actionBtn}
                                            onClick={() => void finalizeYearEnd()}
                                            disabled={yearEndSaving !== null || Number(checklistSummary.pending_count ?? 0) > 0 || Number(checklistSummary.blocked_count ?? 0) > 0 || monthCloseChecklist?.finance_close_readiness?.status !== 'ready'}
                                        >
                                            {yearEndSaving === 'finalize' ? 'Finalizing...' : 'Finalize Year-End'}
                                        </KitchenButton>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`${styles.field} ${styles.fullSpan}`}>
                                            <label>Year-End Reopen Reason</label>
                                            <textarea
                                                className={styles.textArea}
                                                value={yearEndReopenReason}
                                                onChange={(event) => setYearEndReopenReason(event.target.value)}
                                                placeholder="Why is this finalized year-end being reopened?"
                                                rows={3}
                                                disabled={yearEndSaving === 'reopen'}
                                            />
                                        </div>
                                        <div className={`${styles.field} ${styles.fullSpan}`}>
                                            <KitchenButton
                                                variant="outline"
                                                size="sm"
                                                className={styles.actionBtn}
                                                onClick={() => void reopenYearEnd()}
                                                disabled={yearEndSaving !== null || !yearEndReopenReason.trim()}
                                            >
                                                {yearEndSaving === 'reopen' ? 'Reopening...' : 'Reopen Year-End'}
                                            </KitchenButton>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}
                        <div className={styles.closeHistoryList}>
                            {monthCloseLoading ? (
                                <div className={styles.closeHistoryEmpty}>Loading month-close checklist...</div>
                            ) : (monthCloseChecklist?.items ?? []).length === 0 ? (
                                <div className={styles.closeHistoryEmpty}>No checklist items are configured for this branch and month.</div>
                            ) : (
                                (monthCloseChecklist?.items ?? []).map((item: any) => (
                                    <div key={item.item_key} className={styles.checklistRow}>
                                        <div className={styles.checklistMain}>
                                            <div className={styles.closeHistoryHead}>
                                                <strong>{item.item_label}</strong>
                                                <span className={`${styles.closeHistoryStatus} ${styles[`closeStatus${item.status === 'completed' ? 'clean_close' : item.status === 'blocked' ? 'variance_review' : 'noted_close'}`]}`}>
                                                    {item.status === 'completed' ? 'Completed' : item.status === 'blocked' ? 'Blocked' : 'Pending'}
                                                </span>
                                            </div>
                                            <div className={styles.closeHistoryMeta}>
                                                <span>{item.item_key}</span>
                                                <span>{item.completed_by ? `By ${item.completed_by}` : 'Awaiting completion'}</span>
                                                <span>{item.completed_at ? new Date(item.completed_at).toLocaleString('en-PK') : 'No completion timestamp'}</span>
                                            </div>
                                            {item.notes ? <div className={styles.closeHistoryNotes}>{item.notes}</div> : null}
                                        </div>
                                        <div className={styles.checklistActions}>
                                            <KitchenButton variant="ghost" size="sm" onClick={() => void updateChecklistItem(item.item_key, 'pending')} disabled={checklistSavingKey === item.item_key}>Mark Pending</KitchenButton>
                                            <KitchenButton variant="outline" size="sm" onClick={() => void updateChecklistItem(item.item_key, 'blocked')} disabled={checklistSavingKey === item.item_key}>Block</KitchenButton>
                                            <KitchenButton variant="primary" size="sm" onClick={() => void updateChecklistItem(item.item_key, 'completed')} disabled={checklistSavingKey === item.item_key}>
                                                {checklistSavingKey === item.item_key ? 'Saving...' : 'Complete'}
                                            </KitchenButton>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {(pendingAccruals.entries ?? []).length > 0 ? (
                            <div className={styles.accrualQueue}>
                                {(pendingAccruals.entries ?? []).map((entry: any) => (
                                    <div key={entry.id} className={styles.accrualQueueRow}>
                                        <div>
                                            <strong>{entry.description || `JE-${String(entry.id).padStart(4, '0')}`}</strong>
                                            <span>{entry.business_date} · Due {entry.accrual_reversal_due_date || 'Not set'}</span>
                                        </div>
                                        <div className={styles.accrualQueueMeta}>
                                            <span>{entry.is_overdue ? 'Overdue' : 'Pending'}</span>
                                            <small>PKR {Number(entry.total_amount ?? 0).toLocaleString('en-PK')}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {(closeAdjustmentSchedules.entries ?? []).length > 0 ? (
                            <div className={styles.accrualQueue}>
                                {(closeAdjustmentSchedules.entries ?? []).map((entry: any) => (
                                    <div key={`close-adjustment-${entry.id}`} className={styles.accrualQueueRow}>
                                        <div>
                                            <strong>{entry.description || `JE-${String(entry.id).padStart(4, '0')}`}</strong>
                                            <span>{entry.business_date} / {entry.close_adjustment_type === 'prepaid_expense' ? 'Prepaid Expense' : entry.close_adjustment_type === 'deferred_revenue' ? 'Deferred Revenue' : 'Depreciation'} / {entry.schedule_start_date || 'No start'} to {entry.schedule_end_date || 'No end'}</span>
                                        </div>
                                        <div className={styles.accrualQueueMeta}>
                                            <span>{entry.is_overdue ? 'Needs review' : 'Scheduled'}</span>
                                            <small>PKR {Number(entry.total_amount ?? 0).toLocaleString('en-PK')}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 15%, transparent)' }}><Lock size={16} /></div>
                            <div><h3>Period Lock</h3><span className={styles.panelMeta}>Prevent edits to closed periods from journals and vouchers</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.fieldGrid}>
                            <div className={styles.field}>
                                <label>Lock Mode</label>
                                <KitchenSelect
                                    options={PERIOD_LOCK_OPTIONS}
                                    value={periodLockMode}
                                    onChange={(event) => setPeriodLockMode(event.target.value as PeriodLockMode)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Locked Through Date</label>
                                <KitchenInput
                                    type="date"
                                    value={lockedThroughDate}
                                    onChange={(event) => setLockedThroughDate(event.target.value)}
                                    disabled={periodLockLoading}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Scope</label>
                                <KitchenInput value={periodLockMeta.scope === 'company' ? 'Company Default' : (activeBranch?.branch_name || 'Branch')} readOnly />
                            </div>
                            <div className={styles.field}>
                                <label>Last Updated</label>
                                <KitchenInput value={periodLockMeta.updated_at ? `${new Date(periodLockMeta.updated_at).toLocaleString('en-PK')} · ${periodLockMeta.updated_by || 'System'}` : 'Not set'} readOnly />
                            </div>
                            <div className={styles.field}>
                                <label>Last Reopen</label>
                                <KitchenInput value={periodLockMeta.last_reopened_at ? `${new Date(periodLockMeta.last_reopened_at).toLocaleString('en-PK')} · ${periodLockMeta.last_reopened_by || 'System'}` : 'No reopen recorded'} readOnly />
                            </div>
                            <div className={styles.field}>
                                <label>Year-End Scope</label>
                                <KitchenInput value={yearEndGovernance.is_year_end_period ? `Active ${yearEndGovernance.year_end_period_key || ''}` : `Next ${yearEndGovernance.year_end_period_key || 'Year-End'}`} readOnly />
                            </div>
                            <div className={`${styles.field} ${styles.fullSpan}`}>
                                <label>Lock Notes</label>
                                <textarea
                                    className={styles.textArea}
                                    value={periodLockNotes}
                                    onChange={(event) => setPeriodLockNotes(event.target.value)}
                                    placeholder="Explain the lock policy or why this period is frozen."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className={styles.helperText}>
                            `Admin Override Only` allows users with accounting approval authority to post into locked periods. `Yes — Prevent all edits` blocks journal posting, reversals, and voucher workflow changes through the locked date.
                        </div>
                    </div>
                </div>

                <div className={styles.polishedPanel}>
                    <div className={styles.panelHeader}>
                        <div className={styles.phLeft}>
                            <div className={styles.phIcon} style={{ color: '#ef4444', background: 'color-mix(in srgb, #ef4444 15%, transparent)' }}><Lock size={16} /></div>
                            <div><h3>Close Governance & History</h3><span className={styles.panelMeta}>Recent accounting day closes and exception visibility</span></div>
                        </div>
                    </div>
                    <div className={styles.panelBody}>
                        <div className={styles.governanceStrip}>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Recent Close Variances</span>
                                <strong className={styles.governanceValue}>{closeGovernanceSummary.varianceCount}</strong>
                                <small>Closed days with cash variance still visible to finance review.</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Documented Close Notes</span>
                                <strong className={styles.governanceValue}>{closeGovernanceSummary.notedCount}</strong>
                                <small>Days closed with recorded notes or controlled commentary.</small>
                            </div>
                            <div className={styles.governanceCard}>
                                <span className={styles.governanceLabel}>Latest Close</span>
                                <strong className={styles.governanceValue}>{closeGovernanceSummary.latestClose ? new Date(closeGovernanceSummary.latestClose.business_date).toLocaleDateString('en-PK') : 'None'}</strong>
                                <small>{closeGovernanceSummary.latestClose?.closed_by_name ? `By ${closeGovernanceSummary.latestClose.closed_by_name}` : 'No recent day-close record'}</small>
                            </div>
                        </div>
                        <div className={styles.closeHistoryList}>
                            {closeHistoryLoading ? (
                                <div className={styles.closeHistoryEmpty}>Loading close history...</div>
                            ) : closeHistory.length === 0 ? (
                                <div className={styles.closeHistoryEmpty}>No accounting day-close history is available for this branch yet.</div>
                            ) : closeHistory.map((item) => (
                                <div key={item.id} className={styles.closeHistoryRow}>
                                    <div className={styles.closeHistoryMain}>
                                        <div className={styles.closeHistoryHead}>
                                            <strong>{new Date(item.business_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                                            <span className={`${styles.closeHistoryStatus} ${styles[`closeStatus${item.review_status}`]}`}>
                                                {item.review_status === 'variance_review' ? 'Variance Review' : item.review_status === 'noted_close' ? 'Noted Close' : 'Clean Close'}
                                            </span>
                                        </div>
                                        <div className={styles.closeHistoryMeta}>
                                            <span>Closed {new Date(item.closed_at).toLocaleString('en-PK')}</span>
                                            <span>{item.closed_by_name || 'System'}</span>
                                            <span>{item.journal_entry_count} journals linked</span>
                                        </div>
                                        {item.notes ? <div className={styles.closeHistoryNotes}>{item.notes}</div> : null}
                                    </div>
                                    <div className={styles.closeHistoryStats}>
                                        <div>
                                            <span>Net Sales</span>
                                            <strong>{Number(item.net_sales_amount ?? 0).toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}</strong>
                                        </div>
                                        <div>
                                            <span>Expected / Actual</span>
                                            <strong>{Number(item.expected_cash_amount ?? 0).toLocaleString('en-PK')} / {Number(item.actual_cash_amount ?? 0).toLocaleString('en-PK')}</strong>
                                        </div>
                                        <div>
                                            <span>Cash Variance</span>
                                            <strong>{Number(item.cash_variance_amount ?? 0).toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
