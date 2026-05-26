/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Calendar, CheckCircle2, CreditCard, FileSpreadsheet, RefreshCw, Users, Wallet, XCircle } from 'lucide-react';
import { accountingApi, branchApi, userApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './PayrollRuns.module.css';

type PayrollStatus = 'all' | 'draft' | 'approved' | 'partially_paid' | 'paid' | 'void';
type PeriodPreset = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'this_week' | 'last_week' | 'first_half_this_month' | 'second_half_this_month' | 'custom';
type WorkspaceTab = 'workflow' | 'history';
type WorkflowStage = 'create' | 'approve' | 'pay' | 'close';

type TreasuryOption = {
  id: string;
  label: string;
  branch_id: number | null;
  is_cash_account: boolean;
  is_bank_account: boolean;
};

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, offset: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

function endOfMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0);
}

function startOfWeek(base: Date): Date {
  const day = base.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(base, offset);
}

function endOfWeek(base: Date): Date {
  return addDays(startOfWeek(base), 6);
}

function resolvePeriodPresetRange(preset: PeriodPreset): { start: string; end: string } {
  const base = new Date(`${today}T12:00:00`);
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = addDays(base, -1);
      return { start: toIsoDate(yesterday), end: toIsoDate(yesterday) };
    }
    case 'last_month': {
      const lastMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      return { start: toIsoDate(startOfMonth(lastMonth)), end: toIsoDate(endOfMonth(lastMonth)) };
    }
    case 'this_week':
      return { start: toIsoDate(startOfWeek(base)), end: toIsoDate(endOfWeek(base)) };
    case 'last_week': {
      const lastWeekBase = addDays(startOfWeek(base), -1);
      return { start: toIsoDate(startOfWeek(lastWeekBase)), end: toIsoDate(endOfWeek(lastWeekBase)) };
    }
    case 'first_half_this_month': {
      const start = startOfMonth(base);
      const end = new Date(base.getFullYear(), base.getMonth(), 15);
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }
    case 'second_half_this_month': {
      const start = new Date(base.getFullYear(), base.getMonth(), 16);
      const end = endOfMonth(base);
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }
    case 'custom':
      return { start: monthStart, end: today };
    case 'this_month':
    default:
      return { start: toIsoDate(startOfMonth(base)), end: toIsoDate(endOfMonth(base)) };
  }
}

function formatPKR(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-PK');
}

function flattenAccounts(nodes: any[]): any[] {
  return nodes.flatMap((node) => [
    node,
    ...(Array.isArray(node?.children) ? flattenAccounts(node.children) : []),
  ]);
}

function describeRunStatus(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'draft':
      return 'Draft batch awaiting review and approval.';
    case 'approved':
      return 'Approved batch ready for employee salary payments.';
    case 'partially_paid':
      return 'Some employees are paid. Remaining balances are still open.';
    case 'paid':
      return 'All employee salaries in this batch have been paid.';
    case 'void':
      return 'This batch was cancelled and is no longer active.';
    default:
      return 'Review this batch before taking action.';
  }
}

function describeNextAction(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'draft':
      return 'Next: approve batch';
    case 'approved':
      return 'Next: record employee payments';
    case 'partially_paid':
      return 'Next: pay remaining employees';
    case 'paid':
      return 'Completed';
    case 'void':
      return 'Closed';
    default:
      return 'Review batch';
  }
}

function isRecentBatch(run: any): boolean {
  const referenceDate = run?.period_end || run?.pay_date || run?.created_at;
  if (!referenceDate) return true;
  const parsed = new Date(referenceDate);
  if (Number.isNaN(parsed.getTime())) return true;
  const ageMs = new Date(today).getTime() - parsed.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays <= 45;
}

export function PayrollRuns() {
  const { branches: contextBranches, activeBranch } = useBranchContext();
  const {
    canViewPayrollRuns,
    canManagePayrollRuns,
    canApprovePayrollRuns,
  } = usePermissionAccess();
  const defaultBranchId = activeBranch?.branch_id || activeBranch?.id;
  const [selectedBranch, setSelectedBranch] = useState(defaultBranchId ? String(defaultBranchId) : 'all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [statusFilter, setStatusFilter] = useState<PayrollStatus>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runsPayload, setRunsPayload] = useState<any>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workflow');
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('approve');
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [createPeriodPreset, setCreatePeriodPreset] = useState<PeriodPreset>('this_month');
  const [branchRows, setBranchRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<TreasuryOption[]>([]);
  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [createPreview, setCreatePreview] = useState<any>(null);
  const [createPreviewLoading, setCreatePreviewLoading] = useState(false);
  const [createPreviewError, setCreatePreviewError] = useState('');
  const [createForm, setCreateForm] = useState({
    branch_id: defaultBranchId ? String(defaultBranchId) : '',
    title: '',
    period_start: monthStart,
    period_end: today,
    pay_date: today,
    notes: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    payroll_run_line_id: '',
    amount: '',
    payment_date: today,
    payment_method: 'Bank Transfer',
    treasury_account_id: '',
    reference_no: '',
    note: '',
  });
  const [advanceForm, setAdvanceForm] = useState({
    branch_id: defaultBranchId ? String(defaultBranchId) : '',
    user_id: '',
    amount: '',
    payment_date: today,
    payment_method: 'Bank Transfer',
    treasury_account_id: '',
    reference_no: '',
    note: '',
  });
  const [voidForm, setVoidForm] = useState({
    note: '',
  });

  useEffect(() => {
    if (periodPreset === 'custom') return;
    const range = resolvePeriodPresetRange(periodPreset);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
  }, [periodPreset]);

  useEffect(() => {
    if (workflowStage !== 'create' || createPeriodPreset === 'custom') return;
    const range = resolvePeriodPresetRange(createPeriodPreset);
    setCreateForm((current) => ({
      ...current,
      period_start: range.start,
      period_end: range.end,
      pay_date: range.end,
    }));
  }, [createPeriodPreset, workflowStage]);

  useEffect(() => {
    const loadBranchOptions = async () => {
      if (Array.isArray(contextBranches) && contextBranches.length > 0) {
        setBranchRows(contextBranches);
        return;
      }
      try {
        const payload = await branchApi.getBranches();
        setBranchRows(payload || []);
      } catch {
        setBranchRows([]);
      }
    };
    void loadBranchOptions();
  }, [contextBranches]);

  const branchOptions = useMemo(
    () => [
      { value: 'all', label: 'All Branches' },
      ...branchRows.map((branch: any) => ({
        value: String(branch.branch_id || branch.id),
        label: branch.branch_name || branch.name || `Branch ${branch.branch_id || branch.id}`,
      })),
    ],
    [branchRows],
  );

  const selectedBranchId = selectedBranch !== 'all' ? Number(selectedBranch) : null;
  const selectedCreateBranchId = createForm.branch_id ? Number(createForm.branch_id) : null;
  const runRows = runsPayload?.runs ?? [];
  const summary = runsPayload?.summary ?? {};
  const openRuns = useMemo(
    () => runRows.filter((run: any) => !['paid', 'void'].includes(String(run.status || '').toLowerCase())),
    [runRows],
  );
  const draftRuns = useMemo(
    () => openRuns.filter((run: any) => String(run.status || '').toLowerCase() === 'draft'),
    [openRuns],
  );
  const payableRuns = useMemo(
    () => openRuns.filter((run: any) => ['approved', 'partially_paid'].includes(String(run.status || '').toLowerCase())),
    [openRuns],
  );
  const closableRuns = useMemo(
    () => runRows.filter((run: any) => String(run.status || '').toLowerCase() === 'paid'),
    [runRows],
  );
  const oldRuns = useMemo(
    () => runRows.filter((run: any) => ['paid', 'void'].includes(String(run.status || '').toLowerCase())),
    [runRows],
  );
  const stageRuns = useMemo(() => {
    switch (workflowStage) {
      case 'approve':
        return draftRuns;
      case 'pay':
        return payableRuns;
      case 'close':
        return closableRuns;
      case 'create':
      default:
        return [];
    }
  }, [closableRuns, draftRuns, payableRuns, workflowStage]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await accountingApi.getPayrollRuns({
        branch_id: selectedBranchId,
        period_start: periodStart,
        period_end: periodEnd,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setRunsPayload(payload);
      setSelectedRunId((current) => {
        const nextSelectedId =
          payload?.runs?.find((run: any) => Number(run.id) === Number(current))?.id
          ?? payload?.runs?.[0]?.id
          ?? null;
        return nextSelectedId ? Number(nextSelectedId) : null;
      });
    } catch (error: any) {
      toast.error('Payroll Unavailable', error?.message || 'Could not load payroll runs.');
      setRunsPayload(null);
    } finally {
      setLoading(false);
    }
  }, [periodEnd, periodStart, selectedBranchId, statusFilter]);

  const loadDetail = useCallback(async (runId: number | null) => {
    if (!runId) {
      setSelectedRun(null);
      return;
    }
    setDetailLoading(true);
    try {
      const payload = await accountingApi.getPayrollRun(runId);
      setSelectedRun(payload);
    } catch (error: any) {
      toast.error('Payroll Detail', error?.message || 'Could not load payroll run detail.');
      setSelectedRun(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadDetail(selectedRunId);
  }, [loadDetail, selectedRunId]);

  useEffect(() => {
    if (activeTab !== 'workflow' || workflowStage === 'create') return;
    const compatibleRuns = stageRuns;
    const nextRunId = compatibleRuns.find((run: any) => Number(run.id) === Number(selectedRunId))?.id
      ?? compatibleRuns[0]?.id
      ?? null;
    if (Number(nextRunId || 0) !== Number(selectedRunId || 0)) {
      setSelectedRunId(nextRunId ? Number(nextRunId) : null);
    }
  }, [activeTab, selectedRunId, stageRuns, workflowStage]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    const nextRunId = oldRuns.find((run: any) => Number(run.id) === Number(selectedRunId))?.id
      ?? oldRuns[0]?.id
      ?? null;
    if (Number(nextRunId || 0) !== Number(selectedRunId || 0)) {
      setSelectedRunId(nextRunId ? Number(nextRunId) : null);
    }
  }, [activeTab, oldRuns, selectedRunId]);

  useEffect(() => {
    const payableLine = (selectedRun?.lines || []).find((line: any) => Number(line.payable_balance ?? 0) > 0);
    setPaymentForm((current) => ({
      ...current,
      payroll_run_line_id: payableLine ? String(payableLine.id) : '',
      amount: payableLine ? String(Number(payableLine.payable_balance ?? 0)) : '',
      payment_date: selectedRun?.pay_date || today,
      treasury_account_id: '',
      reference_no: '',
      note: '',
    }));
  }, [selectedRun]);

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

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const payload = await userApi.getUsers();
        setStaffRows(Array.isArray(payload) ? payload : []);
      } catch {
        setStaffRows([]);
      }
    };
    void loadStaff();
  }, []);

  useEffect(() => {
    if (workflowStage !== 'create') {
      setCreatePreview(null);
      setCreatePreviewError('');
      setCreatePreviewLoading(false);
      return;
    }
    if (!createForm.branch_id || !createForm.period_start || !createForm.period_end) {
      setCreatePreview(null);
      setCreatePreviewError('');
      return;
    }
    if (createForm.period_end < createForm.period_start) {
      setCreatePreview(null);
      setCreatePreviewError('Period end cannot be earlier than period start.');
      return;
    }

    let cancelled = false;
    const loadPreview = async () => {
      setCreatePreviewLoading(true);
      setCreatePreviewError('');
      try {
        const payload = await accountingApi.getPayrollPreview({
          branch_id: Number(createForm.branch_id),
          period_start: createForm.period_start,
          period_end: createForm.period_end,
        });
        if (!cancelled) {
          setCreatePreview(payload);
        }
      } catch (error: any) {
        if (!cancelled) {
          setCreatePreview(null);
          setCreatePreviewError(error?.message || 'Could not build payroll preview for this branch and period.');
        }
      } finally {
        if (!cancelled) {
          setCreatePreviewLoading(false);
        }
      }
    };
    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [createForm.branch_id, createForm.period_end, createForm.period_start, workflowStage]);

  const payableRunLines = (selectedRun?.lines || []).filter((line: any) => Number(line.payable_balance ?? 0) > 0);
  const selectedPaymentLine = payableRunLines.find((line: any) => String(line.id) === paymentForm.payroll_run_line_id) ?? null;
  const paymentAccountOptions = useMemo(() => {
    const branchId = selectedRun?.branch_id ? Number(selectedRun.branch_id) : null;
    return accounts.filter((account) => {
      if (branchId && account.branch_id && account.branch_id !== branchId) {
        return false;
      }
      if (paymentForm.payment_method === 'Cash') {
        return account.is_cash_account;
      }
      return account.is_bank_account;
    });
  }, [accounts, paymentForm.payment_method, selectedRun?.branch_id]);

  const advanceBranchId = showAdvanceModal
    ? (selectedBranchId ?? (advanceForm.branch_id ? Number(advanceForm.branch_id) : null) ?? defaultBranchId ?? null)
    : null;

  const advanceAccountOptions = useMemo(() => {
    if (!advanceBranchId) return [];
    return accounts.filter((account) => {
      if (account.branch_id && account.branch_id !== advanceBranchId) return false;
      if (advanceForm.payment_method === 'Cash') return account.is_cash_account;
      return account.is_bank_account;
    });
  }, [accounts, advanceBranchId, advanceForm.payment_method]);

  const advanceStaffOptions = useMemo(
    () => staffRows
      .filter((user: any) => {
        if (!advanceBranchId) return true;
        const userBranchId = Number(user.branch_id ?? user.branch?.id ?? 0);
        return !userBranchId || userBranchId === advanceBranchId;
      })
      .map((user: any) => ({
        value: String(user.id),
        label: `${user.full_name ?? user.user_name ?? user.name ?? `User ${user.id}`} (${user.employee_id || 'No code'})`,
      })),
    [advanceBranchId, staffRows],
  );

  const branchAssignedStaffCount = useMemo(() => {
    if (!selectedCreateBranchId) return 0;
    return staffRows.filter((user: any) => {
      const assignments = Array.isArray(user.branchRoles) && user.branchRoles.length > 0
        ? user.branchRoles.map((assignment: any) => Number(assignment.branch_id))
        : [Number(user.branch_id ?? user.branch?.id ?? 0)].filter(Boolean);
      return assignments.includes(selectedCreateBranchId);
    }).length;
  }, [selectedCreateBranchId, staffRows]);
  const selectedRunArrearsTotal = useMemo(
    () => (selectedRun?.lines || []).reduce((sum: number, line: any) => sum + Number(line.arrears_amount ?? 0), 0),
    [selectedRun],
  );
  const selectedRunPaidEmployeeCount = useMemo(
    () => (selectedRun?.lines || []).filter((line: any) => line.payout_status === 'paid').length,
    [selectedRun],
  );
  const selectedRunPayableEmployeeCount = useMemo(
    () => (selectedRun?.lines || []).filter((line: any) => Number(line.payable_balance ?? 0) > 0).length,
    [selectedRun],
  );
  const paymentAmountValue = Number(paymentForm.amount || 0);
  const paymentBalanceDue = Number(selectedPaymentLine?.payable_balance ?? 0);
  const paymentCarryForwardAmount = Math.max(paymentBalanceDue - paymentAmountValue, 0);
  const paymentAmountExceedsBalance = paymentAmountValue > paymentBalanceDue && paymentBalanceDue > 0;
  const paymentCurrentSalaryAmount = Number(
    selectedPaymentLine?.current_period_net_amount
      ?? Math.max(Number(selectedPaymentLine?.net_amount ?? 0) - Number(selectedPaymentLine?.arrears_amount ?? 0), 0),
  );
  const paymentWillClearFullBalance = paymentBalanceDue > 0 && paymentCarryForwardAmount === 0 && paymentAmountValue > 0;
  const stageRunOptions = useMemo(
    () => stageRuns.map((run: any) => ({
      value: String(run.id),
      label: `${run.title || run.run_no} | ${run.branch_name} | ${formatDate(run.period_start)} to ${formatDate(run.period_end)}`,
    })),
    [stageRuns],
  );
  const oldRunOptions = useMemo(
    () => oldRuns.map((run: any) => ({
      value: String(run.id),
      label: `${run.title || run.run_no} | ${run.branch_name} | ${String(run.status).toUpperCase()}`,
    })),
    [oldRuns],
  );

  const openWorkflowStage = (stage: WorkflowStage) => {
    setActiveTab('workflow');
    setWorkflowStage(stage);
    if (stage === 'create') {
      const preset = periodPreset === 'custom' ? 'custom' : periodPreset;
      const range = preset === 'custom'
        ? { start: periodStart, end: periodEnd }
        : resolvePeriodPresetRange(preset);
      const branchId = selectedBranchId ?? defaultBranchId ?? null;
      setCreatePeriodPreset(preset);
      setCreateForm({
        branch_id: branchId ? String(branchId) : '',
        title: '',
        period_start: range.start,
        period_end: range.end,
        pay_date: range.end || today,
        notes: '',
      });
      setCreatePreview(null);
      setCreatePreviewError('');
      return;
    }
    const nextRun =
      stage === 'approve' ? draftRuns[0]
        : stage === 'pay' ? payableRuns[0]
          : closableRuns[0];
    setSelectedRunId(nextRun ? Number(nextRun.id) : null);
  };

  const openCreateModal = () => {
    openWorkflowStage('create');
  };

  const submitCreateRun = async () => {
    if (!canManagePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to create payroll runs.');
      return;
    }
    if (!createForm.branch_id) {
      toast.error('Branch Required', 'Select a branch for the payroll run.');
      return;
    }
    if (createForm.period_end < createForm.period_start) {
      toast.error('Payroll Period', 'Period end cannot be earlier than period start.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = await accountingApi.createPayrollRun({
        branch_id: Number(createForm.branch_id),
        title: createForm.title.trim() || undefined,
        period_start: createForm.period_start,
        period_end: createForm.period_end,
        pay_date: createForm.period_end,
        notes: createForm.notes.trim() || undefined,
      });
      toast.success('Payroll Batch Created', `${payload.run_no} is ready for approval.`);
      setActiveTab('workflow');
      setWorkflowStage('approve');
      setSelectedBranch(createForm.branch_id);
      await loadRuns();
      setSelectedRunId(Number(payload.id));
    } catch (error: any) {
      toast.error('Payroll Draft Failed', error?.message || 'Could not create the payroll run.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAdvanceModal = async () => {
    if (!canManagePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to issue salary advances.');
      return;
    }
    const branchId = selectedBranchId ?? (advanceForm.branch_id ? Number(advanceForm.branch_id) : null) ?? defaultBranchId ?? null;
    if (!branchId) {
      toast.error('Branch Required', 'Select a branch before issuing salary advance.');
      return;
    }
    setAdvanceForm({
      branch_id: String(branchId),
      user_id: '',
      amount: '',
      payment_date: today,
      payment_method: 'Bank Transfer',
      treasury_account_id: '',
      reference_no: '',
      note: '',
    });
    setShowAdvanceModal(true);
  };

  const openPaymentModalForLine = (line: any) => {
    if (!canApprovePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to record salary payments.');
      return;
    }
    if (!selectedRun || !['approved', 'partially_paid'].includes(String(selectedRun.status || ''))) {
      toast.error('Payroll Status', 'Salary payments can only be recorded after approval.');
      return;
    }
    if (Number(line?.payable_balance ?? 0) <= 0) {
      toast.error('Nothing Payable', 'This employee does not have any remaining payable salary in this batch.');
      return;
    }
    setPaymentForm({
      payroll_run_line_id: String(line.id),
      amount: String(Number(line.payable_balance ?? 0)),
      payment_date: selectedRun?.pay_date || today,
      payment_method: 'Bank Transfer',
      treasury_account_id: '',
      reference_no: '',
      note: '',
    });
    setShowPayModal(true);
  };

  const submitAdvance = async () => {
    if (!canManagePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to issue salary advances.');
      return;
    }
    if (!advanceBranchId) {
      toast.error('Branch Required', 'Select a branch before issuing salary advance.');
      return;
    }
    if (!advanceForm.user_id) {
      toast.error('Staff Required', 'Select the employee receiving the advance.');
      return;
    }
    if (!advanceForm.amount || Number(advanceForm.amount) <= 0) {
      toast.error('Advance Amount', 'Enter the actual advance salary amount paid.');
      return;
    }
    if (!advanceForm.treasury_account_id) {
      toast.error('Treasury Account', 'Select the treasury account used for this advance.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = await accountingApi.createPayrollAdvance({
        branch_id: advanceBranchId,
        user_id: Number(advanceForm.user_id),
        amount: Number(advanceForm.amount),
        payment_date: advanceForm.payment_date,
        payment_method: advanceForm.payment_method,
        treasury_account_id: Number(advanceForm.treasury_account_id),
        reference_no: advanceForm.reference_no.trim() || undefined,
        note: advanceForm.note.trim() || undefined,
      });
      toast.success('Advance Salary Posted', `${payload.staff_name} advance was recorded.`);
      setShowAdvanceModal(false);
      if (selectedRun?.id) {
        await loadDetail(Number(selectedRun.id));
      }
    } catch (error: any) {
      toast.error('Advance Salary Failed', error?.message || 'Could not record this salary advance.');
    } finally {
      setSubmitting(false);
    }
  };
  const approveRun = async () => {
    if (!canApprovePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to approve payroll runs.');
      return;
    }
    if (!selectedRun?.id) return;
    setSubmitting(true);
    try {
      const payload = await accountingApi.updatePayrollRunStatus(selectedRun.id, {
        status: 'approved',
      }, selectedRun.branch_id);
      toast.success('Payroll Approved', `${payload.run_no} was posted to payroll payable.`);
      setActiveTab('workflow');
      setWorkflowStage('pay');
      setSelectedRunId(Number(payload.id ?? selectedRun.id));
      await loadRuns();
      await loadDetail(Number(payload.id ?? selectedRun.id));
    } catch (error: any) {
      toast.error('Payroll Approval Failed', error?.message || 'Could not approve this payroll run.');
    } finally {
      setSubmitting(false);
    }
  };

  const payRun = async () => {
    if (!canApprovePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to settle payroll runs.');
      return;
    }
    if (!selectedRun?.id) return;
    if (!paymentForm.payroll_run_line_id) {
      toast.error('Staff Selection', 'Select the employee being paid in this entry.');
      return;
    }
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Payment Amount', 'Enter the actual amount paid to the employee.');
      return;
    }
    if (selectedPaymentLine && Number(paymentForm.amount) > Number(selectedPaymentLine.payable_balance ?? 0)) {
      toast.error('Payment Amount', 'Amount paying now cannot be greater than the current balance due.');
      return;
    }
    if (!paymentForm.treasury_account_id) {
      toast.error('Treasury Account', 'Select the treasury account that paid this salary.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = await accountingApi.recordPayrollRunPayment(selectedRun.id, {
        payroll_run_line_id: Number(paymentForm.payroll_run_line_id),
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        treasury_account_id: Number(paymentForm.treasury_account_id),
        reference_no: paymentForm.reference_no.trim() || undefined,
        note: paymentForm.note.trim() || undefined,
      }, selectedRun.branch_id);
      toast.success('Salary Payment Saved', `${payload.run_no} employee payment was recorded.`);
      setShowPayModal(false);
      await loadRuns();
      await loadDetail(Number(selectedRun.id));
    } catch (error: any) {
      toast.error('Payroll Payment Failed', error?.message || 'Could not save this employee payroll payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const voidRun = async () => {
    if (!canApprovePayrollRuns) {
      toast.error('Payroll Access', 'You do not have permission to void payroll runs.');
      return;
    }
    if (!selectedRun?.id) return;
    const note = voidForm.note.trim();
    if (!note) {
      toast.error('Void Reason Required', 'Enter a reason before voiding this payroll batch.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = await accountingApi.updatePayrollRunStatus(selectedRun.id, {
        status: 'void',
        note,
      }, selectedRun.branch_id);
      toast.success('Payroll Voided', `${payload.run_no} is now void.`);
      setShowVoidModal(false);
      setVoidForm({ note: '' });
      await loadRuns();
      await loadDetail(Number(selectedRun.id));
    } catch (error: any) {
      toast.error('Payroll Void Failed', error?.message || 'Could not void this payroll run.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Payroll Batches</h1>
          <p>Create payroll batches, approve them, then record actual employee salary payments one by one.</p>
        </div>
        <div className={styles.headerActions}>
          <KitchenButton variant="secondary" onClick={() => void openAdvanceModal()} disabled={!canManagePayrollRuns}>
            <Wallet size={16} />
            Advance Salary
          </KitchenButton>
          <KitchenButton variant="secondary" onClick={() => void loadRuns()}>
            <RefreshCw size={16} />
            Refresh
          </KitchenButton>
          <KitchenButton variant="primary" onClick={openCreateModal} disabled={!canManagePayrollRuns}>
            <FileSpreadsheet size={16} />
            New Payroll Batch
          </KitchenButton>
        </div>
      </header>

      {!canViewPayrollRuns ? (
        <div className={styles.emptyState}>You do not have permission to access payroll runs.</div>
      ) : null}

      <section className={styles.tabStrip}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'workflow' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('workflow')}
        >
          Active Workflow
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'history' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Old Salary Batches
        </button>
      </section>

      <section className={styles.workflowStrip}>
        <button type="button" className={`${styles.workflowCard} ${workflowStage === 'create' && activeTab === 'workflow' ? styles.workflowCardActive : ''}`} onClick={() => openWorkflowStage('create')}>
          <span className={styles.workflowStep}>1</span>
          <div>
            <strong>Create Batch</strong>
            <p>Set branch and period, review the payroll preview, then create the batch.</p>
          </div>
        </button>
        <button type="button" className={`${styles.workflowCard} ${workflowStage === 'approve' && activeTab === 'workflow' ? styles.workflowCardActive : ''}`} onClick={() => openWorkflowStage('approve')}>
          <span className={styles.workflowStep}>2</span>
          <div>
            <strong>Approve Batch</strong>
            <p>Open a draft batch, review employee salary details, and approve it.</p>
          </div>
        </button>
        <button type="button" className={`${styles.workflowCard} ${workflowStage === 'pay' && activeTab === 'workflow' ? styles.workflowCardActive : ''}`} onClick={() => openWorkflowStage('pay')}>
          <span className={styles.workflowStep}>3</span>
          <div>
            <strong>Pay Employees</strong>
            <p>Record full or partial employee salary payments against approved batches.</p>
          </div>
        </button>
        <button type="button" className={`${styles.workflowCard} ${workflowStage === 'close' && activeTab === 'workflow' ? styles.workflowCardActive : ''}`} onClick={() => openWorkflowStage('close')}>
          <span className={styles.workflowStep}>4</span>
          <div>
            <strong>Close Batch</strong>
            <p>Review fully paid batches that are already closed by the system.</p>
          </div>
        </button>
      </section>

      <section className={styles.contentGrid}>
        {activeTab === 'workflow' && workflowStage !== 'create' ? (
        <div className={`${styles.panel} ${styles.detailPanel}`}>
          <section className={styles.summaryGrid}>
            {(workflowStage as WorkflowStage) === 'create' ? (
              <>
                <article className={styles.summaryCard}>
                  <span>Branch Staff Found</span>
                  <strong>{branchAssignedStaffCount}</strong>
                  <small>Total staff assigned to the selected branch</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Payroll Eligible</span>
                  <strong>{Number(createPreview?.employee_count ?? 0)}</strong>
                  <small>Employees that qualify for this new batch</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Pending / Arrear Salary</span>
                  <strong>{formatPKR(Number(createPreview?.summary?.total_arrears_amount ?? 0))}</strong>
                  <small>Unpaid balance that will be carried into this batch</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Net Payable</span>
                  <strong>{formatPKR(Number(createPreview?.summary?.total_net_amount ?? 0))}</strong>
                  <small>Total employee salary payable if this batch is created</small>
                </article>
              </>
            ) : workflowStage === 'approve' ? (
              <>
                <article className={styles.summaryCard}>
                  <span>Draft Batches</span>
                  <strong>{draftRuns.length}</strong>
                  <small>Batches waiting for approval in the current scope</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Employees Awaiting Approval</span>
                  <strong>{draftRuns.reduce((sum: number, run: any) => sum + Number(run.employee_count ?? 0), 0)}</strong>
                  <small>Total employees included in draft batches</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Draft Net Payroll</span>
                  <strong>{formatPKR(draftRuns.reduce((sum: number, run: any) => sum + Number(run.total_net_amount ?? 0), 0))}</strong>
                  <small>Net salary that will move to payroll payable after approval</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Pending / Arrear in Drafts</span>
                  <strong>{formatPKR(draftRuns.reduce((sum: number, run: any) => sum + Number(run.total_arrears_amount ?? 0), 0))}</strong>
                  <small>Carry-forward salary already included in draft batches</small>
                </article>
              </>
            ) : workflowStage === 'pay' ? (
              <>
                <article className={styles.summaryCard}>
                  <span>Approved Open Batches</span>
                  <strong>{payableRuns.length}</strong>
                  <small>Batches ready for employee payment posting</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Salary Still Payable</span>
                  <strong>{formatPKR(Number(summary.total_payable_balance ?? 0))}</strong>
                  <small>Current remaining salary balance across open batches</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Salary Already Paid</span>
                  <strong>{formatPKR(Number(summary.total_paid_amount ?? 0))}</strong>
                  <small>Salary already recorded through employee payment entries</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Pending / Arrear Opening</span>
                  <strong>{formatPKR(payableRuns.reduce((sum: number, run: any) => sum + Number(run.total_arrears_amount ?? 0), 0))}</strong>
                  <small>Older unpaid salary still being carried into open batches</small>
                </article>
              </>
            ) : (
              <>
                <article className={styles.summaryCard}>
                  <span>Closed Batches</span>
                  <strong>{closableRuns.length}</strong>
                  <small>Paid batches closed automatically by the system</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Closed Salary Paid</span>
                  <strong>{formatPKR(closableRuns.reduce((sum: number, run: any) => sum + Number(run.total_paid_amount ?? 0), 0))}</strong>
                  <small>Total salary paid in closed batches</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Closed Net Payroll</span>
                  <strong>{formatPKR(closableRuns.reduce((sum: number, run: any) => sum + Number(run.total_net_amount ?? 0), 0))}</strong>
                  <small>Net salary represented by already closed batches</small>
                </article>
                <article className={styles.summaryCard}>
                  <span>Open Items</span>
                  <strong>{Number(summary.pending_count ?? 0) + Number(summary.approved_count ?? 0) + Number(summary.partial_count ?? 0)}</strong>
                  <small>Remaining workflow batches still outside the close stage</small>
                </article>
              </>
            )}
          </section>
          <div className={styles.panelHeader}>
            <div>
              <h2>
                {(workflowStage as WorkflowStage) === 'create'
                  ? 'Create Payroll Batch'
                  : workflowStage === 'approve'
                    ? 'Approve Batch'
                    : workflowStage === 'pay'
                      ? 'Pay Employees'
                      : 'Close Batch'}
              </h2>
              <p>
                {(workflowStage as WorkflowStage) === 'create'
                  ? 'Review the employee payroll sheet first, then create the batch for approval and salary payment.'
                  : (workflowStage as WorkflowStage) === 'approve'
                    ? 'Select an open draft batch and approve it after reviewing employee salary details.'
                    : workflowStage === 'pay'
                      ? 'Select an approved batch and record employee salary payments one by one.'
                      : 'Select a closed batch to review final salary settlement details.'}
              </p>
            </div>
            {(workflowStage as WorkflowStage) !== 'create' ? (
              <div className={styles.stageSelector}>
                <label className={styles.field}>
                  <span>{workflowStage === 'close' ? 'Closed Batches' : 'Open Batches'}</span>
                  <KitchenSelect
                    options={stageRunOptions}
                    value={selectedRunId ? String(selectedRunId) : ''}
                    onChange={(event) => setSelectedRunId(event.target.value ? Number(event.target.value) : null)}
                  />
                </label>
              </div>
            ) : null}
            {selectedRun && (workflowStage as WorkflowStage) !== 'create' ? (
              <div className={styles.detailActions}>
                {workflowStage === 'approve' && selectedRun.status === 'draft' ? (
                  <KitchenButton variant="primary" isLoading={submitting} onClick={() => void approveRun()} disabled={!canApprovePayrollRuns}>
                    <CheckCircle2 size={16} />
                    Approve Payroll
                  </KitchenButton>
                ) : null}
                {(workflowStage === 'approve' && selectedRun.status === 'draft') || (workflowStage === 'pay' && selectedRun.status === 'approved') ? (
                  <KitchenButton variant="secondary" isLoading={submitting} onClick={() => setShowVoidModal(true)} disabled={!canApprovePayrollRuns}>
                    <XCircle size={16} />
                    Void
                  </KitchenButton>
                ) : null}
              </div>
            ) : null}
          </div>

          {detailLoading ? (
            <div className={styles.emptyState}>Loading payroll detail...</div>
          ) : !selectedRun ? (
            <div className={styles.emptyState}>
              {workflowStage === 'approve'
                ? 'No draft batch is available for approval in the current filter scope.'
                : workflowStage === 'pay'
                  ? 'No approved batch is available for employee payment in the current filter scope.'
                  : 'No closed batch is available in the current filter scope.'}
            </div>
          ) : (
            <>
              <div className={styles.batchHero}>
                <div className={styles.batchHeroMain}>
                  <div className={styles.batchHeroHeader}>
                    <div>
                      <span className={styles.eyebrow}>Payroll Batch</span>
                      <h3>{selectedRun.title || selectedRun.run_no}</h3>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[`status_${selectedRun.status}` as keyof typeof styles] || ''}`}>
                      {String(selectedRun.status).replace('_', ' ')}
                    </span>
                  </div>
                  <p>{describeRunStatus(selectedRun.status)}</p>
                  <div className={styles.batchHeroMeta}>
                    <span><Building2 size={14} /> {selectedRun.branch_name}</span>
                    <span><Calendar size={14} /> {formatDate(selectedRun.period_start)} to {formatDate(selectedRun.period_end)}</span>
                    <span><Users size={14} /> {Number(selectedRun.employee_count ?? 0)} employees</span>
                  </div>
                </div>
                <div className={styles.batchHeroSide}>
                  <span>Next Step</span>
                  <strong>{describeNextAction(selectedRun.status)}</strong>
                  <small>
                    {selectedRun.status === 'draft'
                      ? 'Review the employee salary register and approve the batch.'
                      : selectedRun.status === 'approved'
                        ? 'Click any payable employee row below and record the actual amount paid.'
                        : selectedRun.status === 'partially_paid'
                          ? 'Continue paying the remaining balance rows. Unpaid amounts will carry forward.'
                          : selectedRun.status === 'paid'
                            ? 'This batch is fully settled and closed.'
                            : 'This batch stays visible only for audit trail.'}
                  </small>
                </div>
              </div>

              <div className={`${styles.detailSummary} ${styles.detailSummaryPrimary}`}>
                <div><span>Branch</span><strong>{selectedRun.branch_name}</strong></div>
                <div><span>Payroll Period</span><strong>{formatDate(selectedRun.period_start)} to {formatDate(selectedRun.period_end)}</strong></div>
                <div><span>Employees in Batch</span><strong>{Number(selectedRun.employee_count ?? 0)}</strong></div>
                <div><span>Pay Date</span><strong>{formatDate(selectedRun.pay_date)}</strong></div>
                <div><span>Gross Payroll</span><strong>{formatPKR(Number(selectedRun.total_gross_amount ?? 0))}</strong></div>
                <div><span>Total Net Payable</span><strong>{formatPKR(Number(selectedRun.total_net_amount ?? 0))}</strong></div>
                <div><span>Salary Already Paid</span><strong>{formatPKR(Number(selectedRun.total_paid_amount ?? 0))}</strong></div>
                <div><span>Salary Still Payable</span><strong>{formatPKR(Number(selectedRun.total_payable_balance ?? 0))}</strong></div>
                <div><span>Pending / Arrear Salary</span><strong>{formatPKR(selectedRunArrearsTotal)}</strong></div>
                <div><span>Total Base Salary</span><strong>{formatPKR(Number(selectedRun.total_base_amount ?? 0))}</strong></div>
                <div><span>Attendance Deductions</span><strong>{formatPKR(Number(selectedRun.total_attendance_deduction_amount ?? 0))}</strong></div>
                <div><span>Advance Recoveries</span><strong>{formatPKR(Number(selectedRun.total_advance_recovery_amount ?? 0))}</strong></div>
                <div><span>Loan Recoveries</span><strong>{formatPKR(Number(selectedRun.total_loan_recovery_amount ?? 0))}</strong></div>
                <div><span>Income Tax Deduction</span><strong>{formatPKR(Number(selectedRun.total_income_tax_amount ?? 0))}</strong></div>
              </div>

              <div className={styles.insightGrid}>
                <article className={styles.insightCard}>
                  <span>{workflowStage === 'approve' ? 'Approval Scope' : 'Payment Progress'}</span>
                  <strong>{selectedRunPaidEmployeeCount} paid / {Number(selectedRun.employee_count ?? 0)} employees</strong>
                  <small>
                    {workflowStage === 'approve'
                      ? 'Review all employee salary lines before moving this batch into approved status.'
                      : `${selectedRunPayableEmployeeCount} employee(s) still have salary due in this batch.`}
                  </small>
                </article>
                <article className={styles.insightCard}>
                  <span>Carry Forward Control</span>
                  <strong>{formatPKR(selectedRunArrearsTotal)} pending / arrear</strong>
                  <small>Any partial salary you record now will move forward automatically into the next batch.</small>
                </article>
                <article className={styles.insightCard}>
                  <span>Payment Trail</span>
                  <strong>{selectedRun.payment_method || 'Employee-level payment entries'}</strong>
                  <small>{selectedRun.treasury_account_name ? `Latest batch treasury context: ${selectedRun.treasury_account_name}` : 'Treasury account is chosen for each employee payment entry.'}</small>
                </article>
              </div>

              <div className={styles.notesStrip}>
                <div className={styles.noteItem}>
                  <AlertTriangle size={14} />
                  <span>Status: {describeRunStatus(selectedRun.status)}</span>
                </div>
                {workflowStage === 'approve' ? (
                  <div className={styles.noteItem}>
                    <CheckCircle2 size={14} />
                    <span>Approve this batch only after the employee salary lines and totals are fully reviewed.</span>
                  </div>
                ) : null}
                {workflowStage === 'pay' && (selectedRun.status === 'approved' || selectedRun.status === 'partially_paid') ? (
                  <div className={styles.noteItem}>
                    <Wallet size={14} />
                    <span>Click any employee with a balance due to record full or partial salary payment.</span>
                  </div>
                ) : null}
                {workflowStage === 'close' ? (
                  <div className={styles.noteItem}>
                    <CheckCircle2 size={14} />
                    <span>This batch is already closed. Review only.</span>
                  </div>
                ) : null}
                {selectedRun.notes ? (
                  <div className={styles.noteItem}>
                    <span>{selectedRun.notes}</span>
                  </div>
                ) : null}
              </div>

              <section className={styles.tableSection}>
                <div className={styles.inlineTableHeader}>
                  <h3>Employee Salary Register</h3>
                  <p>Review what belongs to this batch, what was carried in from earlier unpaid salary, and what still remains due after payments.</p>
                </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Pay Basis</th>
                      <th>Attendance</th>
                      <th>Current Salary</th>
                      <th>Pending / Arrear</th>
                      <th>Gross Salary</th>
                      <th>Deductions</th>
                      <th>Net Pay</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th>Payment Status</th>
                      {workflowStage === 'pay' ? <th>Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRun.lines || []).map((line: any) => (
                      <tr key={line.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <strong>{line.staff_name}</strong>
                            <span>{line.employee_id || 'No employee code'}{line.employment_type ? ` • ${line.employment_type}` : ''}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.breakdownCell}>
                            <strong>{line.salary_type || 'Monthly'}</strong>
                            <span className={styles.cellSub}>Basic {formatPKR(Number(line.salary_rate ?? 0))} • {Number(line.payable_units ?? 0).toFixed(2)} payable units</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.breakdownCell}>
                            <strong>{Number(line.present_days ?? 0) + Number(line.late_days ?? 0) + Number(line.leave_days ?? 0)} worked</strong>
                            <span className={styles.cellSub}>
                              {line.present_days} present • {line.leave_days} leave • {line.absent_days} absent
                            </span>
                          </div>
                        </td>
                        <td>{formatPKR(Number(line.current_period_net_amount ?? Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0)))}</td>
                        <td>{formatPKR(Number(line.arrears_amount ?? 0))}</td>
                        <td>{formatPKR(Number(line.gross_amount ?? 0))}</td>
                        <td>
                          <div className={styles.breakdownCell}>
                            <strong>{formatPKR(Number(line.deduction_amount ?? 0))}</strong>
                            <span className={styles.cellSub}>Attendance {formatPKR(Number(line.attendance_deduction_amount ?? 0))}</span>
                            <span className={styles.cellSub}>Advance / Loan {formatPKR(Number(line.advance_recovery_amount ?? 0) + Number(line.loan_recovery_amount ?? 0))}</span>
                            <span className={styles.cellSub}>Tax / Compliance {formatPKR(Number(line.employee_compliance_deduction_amount ?? 0))}</span>
                          </div>
                        </td>
                        <td><strong>{formatPKR(Number(line.net_amount ?? 0))}</strong></td>
                        <td>{formatPKR(Number(line.paid_amount ?? 0))}</td>
                        <td>{formatPKR(Number(line.payable_balance ?? 0))}</td>
                        <td><span className={`${styles.statusBadge} ${styles[`status_${line.payout_status === 'paid' ? 'paid' : line.payout_status === 'partial' ? 'partially_paid' : 'draft'}` as keyof typeof styles] || ''}`}>{String(line.payout_status || 'unpaid').replace('_', ' ')}</span></td>
                        {workflowStage === 'pay' ? (
                          <td>
                            {selectedRun.status === 'approved' || selectedRun.status === 'partially_paid' ? (
                              <KitchenButton
                                variant="secondary"
                                onClick={() => openPaymentModalForLine(line)}
                                disabled={Number(line.payable_balance ?? 0) <= 0}
                              >
                                {Number(line.payable_balance ?? 0) > 0 ? 'Full / Partial Pay' : 'Settled'}
                              </KitchenButton>
                            ) : (
                              <span className={styles.cellSub}>Available after approval</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </section>

              {workflowStage !== 'approve' ? (
              <section className={styles.tableSection}>
              <div className={styles.tableWrap}>
                <div className={styles.inlineTableHeader}>
                  <h3>Employee Payment Register</h3>
                  <p>Every actual salary payment posted against this batch is listed here for review and audit trail.</p>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Employee</th>
                      <th>Amount Paid</th>
                      <th>Payment Method</th>
                      <th>Treasury Account</th>
                      <th>Reference</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRun.payments || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyTableCell}>No employee salary payments have been recorded for this batch yet.</td>
                      </tr>
                    ) : (selectedRun.payments || []).map((payment: any) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.payment_date)}</td>
                        <td>{payment.staff_name || 'Unknown employee'}</td>
                        <td><strong>{formatPKR(Number(payment.amount ?? 0))}</strong></td>
                        <td>{payment.payment_method || '-'}</td>
                        <td>{payment.treasury_account_name || '-'}</td>
                        <td>{payment.reference_no || '-'}</td>
                        <td>{payment.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </section>
              ) : null}
            </>
          )}
        </div>
        ) : activeTab === 'workflow' ? (
        <div className={`${styles.panel} ${styles.createWorkspacePanel}`}>
          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>Branch Staff Found</span>
              <strong>{branchAssignedStaffCount}</strong>
              <small>Total staff assigned to the selected branch</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Payroll Eligible</span>
              <strong>{Number(createPreview?.employee_count ?? 0)}</strong>
              <small>Employees that qualify for this new batch</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Pending / Arrear Salary</span>
              <strong>{formatPKR(Number(createPreview?.summary?.total_arrears_amount ?? 0))}</strong>
              <small>Unpaid balance that will be carried into this batch</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Net Payable</span>
              <strong>{formatPKR(Number(createPreview?.summary?.total_net_amount ?? 0))}</strong>
              <small>Total employee salary payable if this batch is created</small>
            </article>
          </section>
          <div className={styles.panelHeader}>
            <div>
              <h2>Create Payroll Batch</h2>
              <p>Review the employee payroll sheet first, then create the batch for approval and salary payment.</p>
            </div>
            <div className={styles.detailActions}>
              <KitchenButton variant="secondary" onClick={() => openWorkflowStage('approve')}>Back to Active Workflow</KitchenButton>
              <KitchenButton variant="primary" isLoading={submitting} disabled={createPreviewLoading || !createPreview || Number(createPreview?.employee_count ?? 0) === 0} onClick={() => void submitCreateRun()}>
                Create Batch
              </KitchenButton>
            </div>
          </div>
          <div className={styles.batchHero}>
            <div className={styles.batchHeroMain}>
              <div className={styles.batchHeroHeader}>
                <div>
                  <span className={styles.eyebrow}>New Payroll Batch</span>
                  <h3>{createForm.title.trim() || 'Draft Batch Preview'}</h3>
                </div>
                <span className={`${styles.statusBadge} ${styles.status_draft}`}>preview</span>
              </div>
              <p>Set branch and period, review the payroll preview sheet, then create the batch for approval.</p>
              <div className={styles.batchHeroMeta}>
                <span><Building2 size={14} /> {branchOptions.find((option) => option.value === createForm.branch_id)?.label || 'Select branch'}</span>
                <span><Calendar size={14} /> {formatDate(createForm.period_start)} to {formatDate(createForm.period_end)}</span>
                <span><Users size={14} /> {Number(createPreview?.employee_count ?? 0)} preview employees</span>
              </div>
            </div>
            <div className={styles.batchHeroSide}>
              <span>Before You Create</span>
              <strong>Review salary, deductions, and pending arrears</strong>
              <small>The create action only opens the batch. Approval and employee payments still happen from Batch Detail.</small>
            </div>
          </div>

          <div className={`${styles.detailSummary} ${styles.detailSummaryPrimary}`}>
            <div><span>Branch Staff Found</span><strong>{branchAssignedStaffCount}</strong></div>
            <div><span>Payroll Eligible</span><strong>{Number(createPreview?.employee_count ?? 0)}</strong></div>
            <div><span>Working Days in Period</span><strong>{Number(createPreview?.total_period_days ?? 0)}</strong></div>
            <div><span>Selected Period</span><strong>{formatDate(createForm.period_start)} to {formatDate(createForm.period_end)}</strong></div>
            <div><span>Gross Payroll</span><strong>{formatPKR(Number(createPreview?.summary?.total_gross_amount ?? 0))}</strong></div>
            <div><span>Net Payable</span><strong>{formatPKR(Number(createPreview?.summary?.total_net_amount ?? 0))}</strong></div>
            <div><span>Pending / Arrear Salary</span><strong>{formatPKR(Number(createPreview?.summary?.total_arrears_amount ?? 0))}</strong></div>
            <div><span>Attendance Deductions</span><strong>{formatPKR(Number(createPreview?.summary?.total_attendance_deduction_amount ?? 0))}</strong></div>
            <div><span>Advance / Loan Recovery</span><strong>{formatPKR(Number(createPreview?.summary?.total_advance_recovery_amount ?? 0) + Number(createPreview?.summary?.total_loan_recovery_amount ?? 0))}</strong></div>
          </div>

          <div className={styles.createControlGrid}>
            <label className={styles.field}>
              <span>Period</span>
              <KitchenSelect
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'this_week', label: 'This Week' },
                  { value: 'last_week', label: 'Last Week' },
                  { value: 'first_half_this_month', label: '1st Half of This Month' },
                  { value: 'second_half_this_month', label: '2nd Half of This Month' },
                  { value: 'this_month', label: 'This Month' },
                  { value: 'last_month', label: 'Last Month' },
                  { value: 'custom', label: 'Custom Range' },
                ]}
                value={createPeriodPreset}
                onChange={(event) => setCreatePeriodPreset(event.target.value as PeriodPreset)}
              />
            </label>
            <label className={styles.field}>
              <span>Branch</span>
              <KitchenSelect options={branchOptions.filter((option) => option.value !== 'all')} value={createForm.branch_id} onChange={(event) => setCreateForm((current) => ({ ...current, branch_id: event.target.value }))} />
            </label>
            <KitchenInput label="Batch Title" value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Optional payroll batch title" />
            <KitchenInput
              label="Period Start"
              type="date"
              value={createForm.period_start}
              disabled={createPeriodPreset !== 'custom'}
              onChange={(event) => setCreateForm((current) => ({ ...current, period_start: event.target.value, pay_date: current.period_end }))}
            />
            <KitchenInput
              label="Period End"
              type="date"
              value={createForm.period_end}
              disabled={createPeriodPreset !== 'custom'}
              onChange={(event) => setCreateForm((current) => ({ ...current, period_end: event.target.value, pay_date: event.target.value }))}
            />
            <KitchenInput label="Notes" value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional payroll batch note" />
          </div>

          <div className={styles.notesStrip}>
            <div className={styles.noteItem}>
              <Users size={14} />
              <span>
                {createPreview
                  ? `${Number(createPreview.employee_count ?? 0)} payroll employees ready for this batch`
                  : 'Select branch and dates to build the payroll preview'}
              </span>
            </div>
            <div className={styles.noteItem}>
              <span>{createForm.branch_id ? `${branchOptions.find((option) => option.value === createForm.branch_id)?.label || 'Selected branch'} | ${formatDate(createForm.period_start)} to ${formatDate(createForm.period_end)}` : 'Select branch and period to see employee payroll details.'}</span>
            </div>
          </div>

          <section className={styles.tableSection}>
          <div className={`${styles.tableWrap} ${styles.createPreviewWrap}`}>
            <div className={styles.inlineTableHeader}>
              <h3>Employee Payroll Preview</h3>
              <p>Review the employee payroll sheet before creating the batch.</p>
            </div>
            {createPreviewLoading ? (
              <div className={styles.emptyState}>Building payroll preview...</div>
            ) : createPreviewError ? (
              <div className={styles.emptyState}>{createPreviewError}</div>
            ) : !createPreview || (createPreview.lines || []).length === 0 ? (
              <div className={styles.emptyState}>No payroll employees were found for this branch and period.</div>
            ) : (
              <table className={`${styles.table} ${styles.previewTable}`}>
                    <thead>
                      <tr>
                        <th>Employee Name &amp; ID</th>
                        <th>Department</th>
                        <th>Salary Type</th>
                        <th>Basic Pay</th>
                        <th>Working Days</th>
                        <th>Days Worked</th>
                        <th>Current Salary</th>
                        <th>Pending / Arrear</th>
                        <th>Gross Salary</th>
                        <th>Deduction - Attendance</th>
                        <th>Deduction - Advance / Loan</th>
                        <th>Deduction - Tax &amp; Compliance</th>
                        <th>Total Deductions</th>
                        <th>Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(createPreview.lines || []).map((line: any) => (
                        <tr key={`${line.user_id}-${line.employee_id_snapshot || 'staff'}`}>
                          <td>
                            <div className={styles.staffCell}>
                              <strong>{line.staff_name_snapshot}</strong>
                              <span className={styles.cellSub}>{line.employee_id_snapshot || 'No employee code'}</span>
                            </div>
                          </td>
                          <td>{line.department_name || '-'}</td>
                          <td>{line.salary_type || line.employment_type_snapshot || '-'}</td>
                          <td>{formatPKR(Number(line.base_amount ?? 0))}</td>
                          <td>{Number(createPreview.total_period_days ?? 0)}</td>
                          <td>{Number(line.present_days ?? 0) + Number(line.late_days ?? 0) + Number(line.leave_days ?? 0)}</td>
                          <td>{formatPKR(Number(line.current_period_net_amount ?? Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0)))}</td>
                          <td>{formatPKR(Number(line.arrears_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.gross_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.attendance_deduction_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.advance_recovery_amount ?? 0) + Number(line.loan_recovery_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.employee_compliance_deduction_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.total_deduction_amount ?? line.deduction_amount ?? 0))}</td>
                          <td><strong>{formatPKR(Number(line.net_amount ?? 0))}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan={3}>Batch Totals</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_base_amount ?? 0))}</th>
                        <th>{Number(createPreview.total_period_days ?? 0)}</th>
                        <th>{(createPreview.lines || []).reduce((sum: number, line: any) => sum + Number(line.present_days ?? 0) + Number(line.late_days ?? 0) + Number(line.leave_days ?? 0), 0)}</th>
                        <th>{formatPKR((createPreview.lines || []).reduce((sum: number, line: any) => sum + Number(line.current_period_net_amount ?? Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0)), 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_arrears_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_gross_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_attendance_deduction_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_advance_recovery_amount ?? 0) + Number(createPreview.summary?.total_loan_recovery_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_employee_compliance_deduction_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_deduction_amount ?? 0))}</th>
                        <th>{formatPKR(Number(createPreview.summary?.total_net_amount ?? 0))}</th>
                      </tr>
                    </tfoot>
                  </table>
            )}
          </div>
          </section>
        </div>
        ) : (
        <div className={`${styles.panel} ${styles.detailPanel}`}>
          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>Old Salary Batches</span>
              <strong>{oldRuns.length}</strong>
              <small>Paid and void batches available for view-only review</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Closed Salary Paid</span>
              <strong>{formatPKR(oldRuns.reduce((sum: number, run: any) => sum + Number(run.total_paid_amount ?? 0), 0))}</strong>
              <small>Total salary amount recorded in old batches</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Void Batches</span>
              <strong>{oldRuns.filter((run: any) => String(run.status || '').toLowerCase() === 'void').length}</strong>
              <small>Batches kept only for audit trail</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Paid Batches</span>
              <strong>{oldRuns.filter((run: any) => String(run.status || '').toLowerCase() === 'paid').length}</strong>
              <small>Fully settled salary batches</small>
            </article>
          </section>

          <div className={styles.panelHeader}>
            <div>
              <h2>Old Salary Batches</h2>
              <p>View-only access to previous paid and void salary batches.</p>
            </div>
            <div className={styles.stageSelector}>
              <label className={styles.field}>
                <span>Previous Batches</span>
                <KitchenSelect
                  options={oldRunOptions}
                  value={selectedRunId ? String(selectedRunId) : ''}
                  onChange={(event) => setSelectedRunId(event.target.value ? Number(event.target.value) : null)}
                />
              </label>
            </div>
          </div>

          {detailLoading ? (
            <div className={styles.emptyState}>Loading payroll detail...</div>
          ) : !selectedRun ? (
            <div className={styles.emptyState}>No old salary batch is available in the current filter scope.</div>
          ) : (
            <>
              <div className={styles.batchHero}>
                <div className={styles.batchHeroMain}>
                  <div className={styles.batchHeroHeader}>
                    <div>
                      <span className={styles.eyebrow}>Previous Batch</span>
                      <h3>{selectedRun.title || selectedRun.run_no}</h3>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[`status_${selectedRun.status}` as keyof typeof styles] || ''}`}>
                      {String(selectedRun.status).replace('_', ' ')}
                    </span>
                  </div>
                  <p>{describeRunStatus(selectedRun.status)}</p>
                  <div className={styles.batchHeroMeta}>
                    <span><Building2 size={14} /> {selectedRun.branch_name}</span>
                    <span><Calendar size={14} /> {formatDate(selectedRun.period_start)} to {formatDate(selectedRun.period_end)}</span>
                    <span><Users size={14} /> {Number(selectedRun.employee_count ?? 0)} employees</span>
                  </div>
                </div>
                <div className={styles.batchHeroSide}>
                  <span>Access Level</span>
                  <strong>View Only</strong>
                  <small>This tab is for review and audit only. No approval, payment, or void actions are shown here.</small>
                </div>
              </div>

              <div className={`${styles.detailSummary} ${styles.detailSummaryPrimary}`}>
                <div><span>Branch</span><strong>{selectedRun.branch_name}</strong></div>
                <div><span>Payroll Period</span><strong>{formatDate(selectedRun.period_start)} to {formatDate(selectedRun.period_end)}</strong></div>
                <div><span>Employees in Batch</span><strong>{Number(selectedRun.employee_count ?? 0)}</strong></div>
                <div><span>Gross Payroll</span><strong>{formatPKR(Number(selectedRun.total_gross_amount ?? 0))}</strong></div>
                <div><span>Total Net Payable</span><strong>{formatPKR(Number(selectedRun.total_net_amount ?? 0))}</strong></div>
                <div><span>Salary Already Paid</span><strong>{formatPKR(Number(selectedRun.total_paid_amount ?? 0))}</strong></div>
                <div><span>Pending / Arrear Salary</span><strong>{formatPKR(selectedRunArrearsTotal)}</strong></div>
                <div><span>Attendance Deductions</span><strong>{formatPKR(Number(selectedRun.total_attendance_deduction_amount ?? 0))}</strong></div>
              </div>

              <section className={styles.tableSection}>
                <div className={styles.inlineTableHeader}>
                  <h3>Employee Salary Register</h3>
                  <p>Employee-level salary detail for this old batch.</p>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Pay Basis</th>
                        <th>Attendance</th>
                        <th>Current Salary</th>
                        <th>Pending / Arrear</th>
                        <th>Gross Salary</th>
                        <th>Deductions</th>
                        <th>Net Pay</th>
                        <th>Paid Amount</th>
                        <th>Balance Due</th>
                        <th>Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRun.lines || []).map((line: any) => (
                        <tr key={line.id}>
                          <td><div className={styles.staffCell}><strong>{line.staff_name}</strong><span>{line.employee_id || 'No employee code'}</span></div></td>
                          <td>{line.salary_type || 'Monthly'}</td>
                          <td>{Number(line.present_days ?? 0) + Number(line.late_days ?? 0) + Number(line.leave_days ?? 0)} worked</td>
                          <td>{formatPKR(Number(line.current_period_net_amount ?? Math.max(Number(line.net_amount ?? 0) - Number(line.arrears_amount ?? 0), 0)))}</td>
                          <td>{formatPKR(Number(line.arrears_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.gross_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.deduction_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.net_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.paid_amount ?? 0))}</td>
                          <td>{formatPKR(Number(line.payable_balance ?? 0))}</td>
                          <td>{String(line.payout_status || 'unpaid').replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
        )}
      </section>
      {showPayModal && selectedRun ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.paymentModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Record Salary Payment</h3>
                <p>Choose one employee at a time and record the actual amount paid with the payment date.</p>
              </div>
              <button type="button" onClick={() => setShowPayModal(false)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.paymentModalBody}`}>
              <div className={styles.paymentBanner}>
                <Wallet size={16} />
                <span>{selectedRun.run_no} | {formatPKR(Number(selectedRun.total_payable_balance ?? 0))} still payable</span>
              </div>
              <div className={styles.paymentModalContent}>
                <aside className={styles.paymentSidebar}>
                  <div className={styles.payrollSelectionList}>
                    {selectedPaymentLine ? (
                      <>
                        <div className={styles.payrollSelectionRow}>
                          <div className={styles.payrollSelectionInfo}>
                            <strong>{selectedPaymentLine.staff_name}</strong>
                            <span>{selectedPaymentLine.employee_id || 'No employee code'} | {selectedPaymentLine.salary_type || 'Monthly'} | total due {formatPKR(Number(selectedPaymentLine.net_amount ?? 0))}</span>
                          </div>
                          <div className={styles.payrollSelectionAmounts}>
                            <strong>{formatPKR(Number(selectedPaymentLine.payable_balance ?? 0))}</strong>
                            <span>Balance to be paid</span>
                          </div>
                        </div>
                        <div className={styles.paymentContextGrid}>
                          <article className={styles.paymentContextCard}>
                            <span>Current Salary</span>
                            <strong>{formatPKR(paymentCurrentSalaryAmount)}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Pending / Arrear</span>
                            <strong>{formatPKR(Number(selectedPaymentLine.arrears_amount ?? 0))}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Total Due</span>
                            <strong>{formatPKR(Number(selectedPaymentLine.net_amount ?? 0))}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Already Paid</span>
                            <strong>{formatPKR(Number(selectedPaymentLine.paid_amount ?? 0))}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Balance Due</span>
                            <strong>{formatPKR(paymentBalanceDue)}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Payable Days</span>
                            <strong>{Number(selectedPaymentLine.paid_days ?? 0)} / {Number(selectedPaymentLine.payable_days ?? 0)}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Paying Now</span>
                            <strong>{formatPKR(paymentAmountValue)}</strong>
                          </article>
                          <article className={styles.paymentContextCard}>
                            <span>Will Carry Forward</span>
                            <strong>{formatPKR(paymentCarryForwardAmount)}</strong>
                          </article>
                        </div>
                      </>
                    ) : (
                      <div className={styles.emptyState}>Select an employee row from the payroll table to record payment.</div>
                    )}
                  </div>
                </aside>
                <section className={styles.paymentMain}>
                  <div className={styles.paymentFormGrid}>
                    <KitchenInput label="Payment Date" type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} />
                    <KitchenInput label="Amount Paying Now" type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
                    <label className={styles.field}>
                      <span>Payment Method</span>
                      <KitchenSelect
                        options={[
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'Cash', label: 'Cash' },
                          { value: 'Digital Wallet', label: 'Digital Wallet' },
                        ]}
                        value={paymentForm.payment_method}
                        onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value, treasury_account_id: '' }))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Treasury Account</span>
                      <KitchenSelect options={paymentAccountOptions.map((account) => ({ value: account.id, label: account.label }))} value={paymentForm.treasury_account_id} onChange={(event) => setPaymentForm((current) => ({ ...current, treasury_account_id: event.target.value }))} />
                    </label>
                    <KitchenInput label="Reference No." value={paymentForm.reference_no} onChange={(event) => setPaymentForm((current) => ({ ...current, reference_no: event.target.value }))} placeholder="Bank or cash reference" />
                  </div>
                  <KitchenInput label="Payment Note" value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional employee payment note" />
                  <div className={styles.notesStrip}>
                    <div className={styles.noteItem}>
                      <span>Example: if balance due is {formatPKR(paymentBalanceDue || 1000)} and you enter {formatPKR(paymentAmountValue || 500)}, the remaining {formatPKR(paymentCarryForwardAmount || Math.max((paymentBalanceDue || 1000) - (paymentAmountValue || 500), 0))} will move to the next batch as pending / arrear.</span>
                    </div>
                    <div className={styles.noteItem}>
                      <span>
                        {paymentWillClearFullBalance
                          ? 'This entry will clear the full balance for this employee in this batch.'
                          : `If you save this amount, ${formatPKR(paymentCarryForwardAmount)} will remain pending / arrear for the next batch.`}
                      </span>
                    </div>
                    {paymentAmountExceedsBalance ? (
                      <div className={styles.noteItem}>
                        <span>The amount paying now cannot be greater than the current balance due.</span>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.modalFooterInline}>
                    <KitchenButton variant="secondary" onClick={() => setPaymentForm((current) => ({ ...current, amount: String(Number(selectedPaymentLine?.payable_balance ?? 0)) }))}>
                      Set Full Balance
                    </KitchenButton>
                  </div>
                </section>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <KitchenButton variant="secondary" onClick={() => setShowPayModal(false)}>Cancel</KitchenButton>
              <KitchenButton variant="primary" isLoading={submitting} onClick={() => void payRun()}>Save Payment</KitchenButton>
            </div>
          </div>
        </div>
      ) : null}

      {showAdvanceModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.compactModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Advance Salary</h3>
                <p>Post a salary advance for one employee so the amount can be recovered in future payroll batches.</p>
              </div>
              <button type="button" onClick={() => setShowAdvanceModal(false)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.compactModalBody}`}>
              <div className={styles.paymentBanner}>
                <Wallet size={16} />
                <span>{branchOptions.find((option) => option.value === String(advanceBranchId))?.label || 'Select branch'}</span>
              </div>
              <div className={styles.compactModalContent}>
                <aside className={styles.compactSidebar}>
                  <label className={styles.field}>
                    <span>Employee</span>
                    <KitchenSelect options={advanceStaffOptions} value={advanceForm.user_id} onChange={(event) => setAdvanceForm((current) => ({ ...current, user_id: event.target.value }))} />
                  </label>
                  <div className={styles.paymentContextGrid}>
                    <article className={styles.paymentContextCard}>
                      <span>Branch Scope</span>
                      <strong>{branchOptions.find((option) => option.value === String(advanceBranchId))?.label || 'Select branch'}</strong>
                    </article>
                    <article className={styles.paymentContextCard}>
                      <span>Recovery Behavior</span>
                      <strong>Recovered in future payroll</strong>
                    </article>
                  </div>
                </aside>
                <section className={styles.compactMain}>
                  <div className={styles.paymentFormGrid}>
                    <KitchenInput label="Advance Amount" type="number" min="0" value={advanceForm.amount} onChange={(event) => setAdvanceForm((current) => ({ ...current, amount: event.target.value }))} />
                    <KitchenInput label="Payment Date" type="date" value={advanceForm.payment_date} onChange={(event) => setAdvanceForm((current) => ({ ...current, payment_date: event.target.value }))} />
                    <label className={styles.field}>
                      <span>Payment Method</span>
                      <KitchenSelect
                        options={[
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'Cash', label: 'Cash' },
                          { value: 'Digital Wallet', label: 'Digital Wallet' },
                        ]}
                        value={advanceForm.payment_method}
                        onChange={(event) => setAdvanceForm((current) => ({ ...current, payment_method: event.target.value, treasury_account_id: '' }))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Treasury Account</span>
                      <KitchenSelect options={advanceAccountOptions.map((account) => ({ value: account.id, label: account.label }))} value={advanceForm.treasury_account_id} onChange={(event) => setAdvanceForm((current) => ({ ...current, treasury_account_id: event.target.value }))} />
                    </label>
                    <KitchenInput label="Reference No." value={advanceForm.reference_no} onChange={(event) => setAdvanceForm((current) => ({ ...current, reference_no: event.target.value }))} placeholder="Advance payment reference" />
                  </div>
                  <KitchenInput label="Advance Note" value={advanceForm.note} onChange={(event) => setAdvanceForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional advance salary note" />
                </section>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <KitchenButton variant="secondary" onClick={() => setShowAdvanceModal(false)}>Cancel</KitchenButton>
              <KitchenButton variant="primary" isLoading={submitting} onClick={() => void submitAdvance()}>Save Advance</KitchenButton>
            </div>
          </div>
        </div>
      ) : null}

      {showVoidModal && selectedRun ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.compactModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Void Payroll Batch</h3>
                <p>Cancel this payroll batch and record the reason for audit trail. This action cannot be used after salaries are paid.</p>
              </div>
              <button type="button" onClick={() => setShowVoidModal(false)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.compactModalBody}`}>
              <div className={styles.recoveryBanner}>
                <AlertTriangle size={16} />
                <span>{selectedRun.title || selectedRun.run_no} • {selectedRun.branch_name} • {formatDate(selectedRun.period_start)} to {formatDate(selectedRun.period_end)}</span>
              </div>
              <div className={styles.compactModalContent}>
                <aside className={styles.compactSidebar}>
                  <div className={styles.paymentContextGrid}>
                    <article className={styles.paymentContextCard}>
                      <span>Batch Status</span>
                      <strong>{String(selectedRun.status || '').toUpperCase()}</strong>
                    </article>
                    <article className={styles.paymentContextCard}>
                      <span>Employees</span>
                      <strong>{Number(selectedRun.employee_count ?? 0)}</strong>
                    </article>
                    <article className={styles.paymentContextCard}>
                      <span>Net Salary</span>
                      <strong>{formatPKR(Number(selectedRun.total_net_amount ?? 0))}</strong>
                    </article>
                    <article className={styles.paymentContextCard}>
                      <span>Paid So Far</span>
                      <strong>{formatPKR(Number(selectedRun.total_paid_amount ?? 0))}</strong>
                    </article>
                  </div>
                </aside>
                <section className={styles.compactMain}>
                  <KitchenInput label="Void Reason" value={voidForm.note} onChange={(event) => setVoidForm({ note: event.target.value })} placeholder="Explain why this payroll batch is being voided" />
                </section>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <KitchenButton variant="secondary" onClick={() => setShowVoidModal(false)}>Cancel</KitchenButton>
              <KitchenButton variant="primary" isLoading={submitting} onClick={() => void voidRun()}>Void Batch</KitchenButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PayrollRuns;
