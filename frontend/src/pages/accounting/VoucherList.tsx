/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  Plus,
  Receipt,
  Search,
  ToggleLeft,
  ToggleRight,
  User,
  XCircle,
} from 'lucide-react';
import { accountingApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredCompensationVoucherNumber, formatConfiguredExpenseVoucherNumber, formatConfiguredGrnNumber, formatConfiguredPaymentVoucherNumber } from '../pos/printTemplates/printHelpers';
import styles from './VoucherList.module.css';

type VoucherStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
type VoucherType = 'EXPENSE' | 'PAYMENT' | 'COMPENSATION' | 'PURCHASE_CREDIT_NOTE';

interface Voucher {
  id: number;
  voucher_no: string;
  type: VoucherType;
  party_name: string;
  party_type: string;
  amount: number;
  date: string;
  status: VoucherStatus;
  branch_name: string;
  payment_method?: string | null;
  treasury_source?: string | null;
  status_note?: string | null;
}

interface VoucherExceptionRow {
  voucher_id: number;
  issues: string[];
}

interface VoucherWorkspaceProps {
  approvalMode?: boolean;
}

function renderAccountGuideBlock(account?: any | null, title?: string) {
  if (!account || (!account.description && !account.usage_guidance && !account.example_entry && !account.confusion_note)) {
    return null;
  }

  return (
    <div className={styles.guidanceCard}>
      {title ? <div className={styles.guidanceTitle}>{title}</div> : null}
      {account.description ? <span><strong>Purpose:</strong> {account.description}</span> : null}
      {account.usage_guidance ? <span><strong>Use:</strong> {account.usage_guidance}</span> : null}
      {account.example_entry ? <span><strong>Example:</strong> {account.example_entry}</span> : null}
      {account.confusion_note ? <span><strong>Watch out:</strong> {account.confusion_note}</span> : null}
    </div>
  );
}

function formatCurrency(value: number) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
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

function VoucherWorkspace({ approvalMode = false }: VoucherWorkspaceProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
  const { activeBranch } = useBranchContext();
  const formatVisibleVoucherNumber = useCallback((voucher: Pick<Voucher, 'voucher_no' | 'type'> | any) => {
    const raw = voucher?.voucher_no || `Voucher ${voucher?.id || ''}`;
    if (voucher?.type === 'PAYMENT' || voucher?.payment_method) {
      return formatConfiguredPaymentVoucherNumber(raw, activeBranch || voucher, { preserveTypePrefix: true }) || raw;
    }
    if (voucher?.type === 'COMPENSATION') {
      return formatConfiguredCompensationVoucherNumber(raw, activeBranch || voucher, { preserveTypePrefix: true }) || raw;
    }
    return formatConfiguredExpenseVoucherNumber(raw, activeBranch || voucher, { preserveTypePrefix: true }) || raw;
  }, [activeBranch]);
  const formatVisibleGrnNumber = useCallback((value: unknown, source?: any) => (
    formatConfiguredGrnNumber(value || '-', activeBranch || source, { preserveTypePrefix: true }) || String(value || '-')
  ), [activeBranch]);
  const { canViewVouchers, canManageVouchers, canApproveVouchers } = usePermissionAccess();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(approvalMode ? 'PENDING' : (searchParams.get('status') || 'all'));
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [showVoided, setShowVoided] = useState(false);
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(searchParams.get('exceptions') === '1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exceptionSummary, setExceptionSummary] = useState<{ count: number; sample: string | null }>({ count: 0, sample: null });
  const [exceptionMap, setExceptionMap] = useState<Record<number, string[]>>({});
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [selectedPaymentPreview, setSelectedPaymentPreview] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, exceptionReport] = await Promise.all([
        accountingApi.getFinancialVouchers({
          branch_id: activeBranch?.branch_id ?? null,
        }),
        accountingApi.getPaymentVoucherExceptions({
          branch_id: activeBranch?.branch_id ?? null,
        }),
      ]);
      setVouchers((response ?? []).map((voucher) => ({
        id: voucher.id,
        voucher_no: voucher.voucher_no,
        type: voucher.type,
        party_name: voucher.party_name ?? '-',
        party_type: voucher.party_type ?? 'OTHER',
        amount: Number(voucher.amount ?? 0),
        date: voucher.date,
        status: voucher.status,
        branch_name: voucher.branch?.branch_name ?? `Branch ${voucher.branch_id}`,
        payment_method: voucher.payment_method ?? null,
        treasury_source: voucher.treasury_account?.account_code && voucher.treasury_account?.account_name
          ? `${voucher.treasury_account.account_code} · ${voucher.treasury_account.account_name}`
          : voucher.payment_source_label ?? null,
        status_note: voucher.status_note ?? null,
      })));

      const exceptionRows: VoucherExceptionRow[] = exceptionReport?.vouchers ?? [];
      setExceptionMap(Object.fromEntries(exceptionRows.map((row) => [row.voucher_id, row.issues])));
      setExceptionSummary({
        count: Number(exceptionReport?.summary?.count || 0),
        sample: exceptionRows[0]
          ? `${formatVisibleVoucherNumber(response?.find((voucher: any) => voucher.id === exceptionRows[0].voucher_id) ?? { voucher_no: 'Voucher' })} · ${exceptionRows[0].issues.join(' ')}`
          : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.branch_id, formatVisibleVoucherNumber]);

  const loadVoucherDetail = useCallback(async (voucherId: number) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await accountingApi.getFinancialVoucher(voucherId);
      setSelectedVoucher(detail);
      setActionNote(detail?.status_note ?? '');
      if (detail?.type === 'PAYMENT') {
        const paymentPreview = await accountingApi.getFinancialVoucherPaymentPreview(voucherId).catch(() => null);
        setSelectedPaymentPreview(paymentPreview);
      } else {
        setSelectedPaymentPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load voucher detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  useEffect(() => {
    if (!selectedVoucherId) return;
    void loadVoucherDetail(selectedVoucherId);
  }, [loadVoucherDetail, selectedVoucherId]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      const issues = exceptionMap[voucher.id] ?? [];
      const matchSearch =
        formatVisibleVoucherNumber(voucher).toLowerCase().includes(search.toLowerCase()) ||
        voucher.party_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || voucher.status === statusFilter;
      const matchType = typeFilter === 'all' || voucher.type === typeFilter;
      const matchVoided = showVoided || voucher.status !== 'VOID';
      const matchExceptions = !showExceptionsOnly || issues.length > 0;
      return matchSearch && matchStatus && matchType && matchVoided && matchExceptions;
    });
  }, [exceptionMap, formatVisibleVoucherNumber, search, showExceptionsOnly, showVoided, statusFilter, typeFilter, vouchers]);

  const stats = {
    total: filteredVouchers.reduce((acc, voucher) => acc + voucher.amount, 0),
    pending: filteredVouchers.filter((voucher) => voucher.status === 'PENDING').length,
    approved: filteredVouchers.filter((voucher) => voucher.status === 'APPROVED').length,
  };
  const pendingApprovals = useMemo(
    () =>
      vouchers.filter((voucher) => voucher.status === 'PENDING').map((voucher) => ({
        ...voucher,
        issues: exceptionMap[voucher.id] ?? [],
      })),
    [exceptionMap, vouchers],
  );
  const hasDrillthroughScope = !approvalMode && (searchParams.get('origin') === 'month_close' || searchParams.get('exceptions') === '1' || searchParams.get('type') === 'PAYMENT');

  const clearDrillthrough = () => {
    setSearch('');
    setStatusFilter(approvalMode ? 'PENDING' : 'all');
    setTypeFilter('all');
    setShowExceptionsOnly(false);
    setSearchParams({});
  };

  const getStatusClass = (status: VoucherStatus) => {
    switch (status) {
      case 'PENDING': return styles.statusPending;
      case 'APPROVED': return styles.statusApproved;
      case 'REJECTED': return styles.statusRejected;
      case 'VOID': return styles.statusVoid;
      default: return '';
    }
  };

  const exportCurrentView = () => {
    downloadCsv(
      'accounting-vouchers.csv',
      [
        ['Voucher No', 'Type', 'Party', 'Branch', 'Date', 'Amount', 'Status', 'Treasury Source', 'Exceptions'],
        ...filteredVouchers.map((voucher) => [
          voucher.voucher_no,
          voucher.type,
          voucher.party_name,
          voucher.branch_name,
          voucher.date,
          String(voucher.amount),
          voucher.status,
          voucher.treasury_source ?? '',
          (exceptionMap[voucher.id] ?? []).join(' | '),
        ]),
      ],
    );
  };

  const closeDetail = () => {
    setSelectedVoucherId(null);
    setSelectedVoucher(null);
    setSelectedPaymentPreview(null);
    setActionNote('');
    setActionLoading(null);
  };

  const handleStatusUpdate = async (status: VoucherStatus) => {
    if (!selectedVoucher || (!canManageVouchers && !canApproveVouchers)) {
      setError('Your current branch role cannot update voucher status.');
      return;
    }
    setActionLoading(status);
    setError(null);
    try {
      await accountingApi.updateFinancialVoucherStatus(selectedVoucher.id, {
        status,
        note: actionNote.trim() || undefined,
      });
      await loadVouchers();
      await loadVoucherDetail(selectedVoucher.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update voucher status');
    } finally {
      setActionLoading(null);
    }
  };

  if (!(approvalMode ? (canManageVouchers || canApproveVouchers) : canViewVouchers)) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Receipt size={24} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>{approvalMode ? 'Voucher Approvals' : 'Vouchers & Expenses'}</h1>
              <p className={styles.pageSubtitle}>
                {approvalMode
                  ? 'Your current branch role does not include voucher approval access.'
                  : 'Your current branch role does not include accounting access.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Receipt size={24} />
          </div>
          <div>
            <span className={styles.heroEyebrow}>{approvalMode ? 'Approval Workspace' : 'Finance Review'}</span>
            <h1 className={styles.pageTitle}>{approvalMode ? 'Voucher Approvals' : 'Vouchers & Expenses'}</h1>
            <p className={styles.pageSubtitle}>
              {approvalMode
                ? 'Review pending vouchers, approve valid submissions, and reject items that need correction.'
                : 'Review, approve, reject, and void branch vouchers with finance context.'}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={exportCurrentView}>
            <Download size={18} />
            Export
          </button>
          {!approvalMode && (
            <button
              className={styles.btnPrimary}
              onClick={() => navigate(`${consoleBase}/accounting/vouchers/new`)}
              disabled={!canManageVouchers}
            >
              <Plus size={18} />
              Add Voucher
            </button>
          )}
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
            <DollarSign size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Total Volume</span>
            <span className={styles.statValue}>{formatCurrency(stats.total)}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
            <Clock size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>{approvalMode ? 'Pending Review' : 'Pending'}</span>
            <span className={styles.statValue}>{approvalMode ? pendingApprovals.length : stats.pending}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
            <CheckCircle size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Approved</span>
            <span className={styles.statValue}>{stats.approved}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Treasury Exceptions</span>
            <span className={styles.statValue}>{exceptionSummary.count}</span>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by Voucher No or Party Name..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.selectWrapper}>
          <select className={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="PAYMENT">Vendor Payment</option>
            <option value="COMPENSATION">Compensation</option>
            <option value="EXPENSE">Other Expense</option>
            <option value="PURCHASE_CREDIT_NOTE">Purchase Credit Note</option>
          </select>
        </div>
        {!approvalMode && (
          <div className={styles.selectWrapper}>
            <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="VOID">Void</option>
            </select>
          </div>
        )}
        {approvalMode && (
          <div className={styles.filterChip}>
            <Clock size={14} />
            <span>Pending vouchers only</span>
          </div>
        )}
        <button type="button" className={styles.toggleWrapper} onClick={() => setShowVoided(!showVoided)}>
          {showVoided ? <ToggleRight size={20} className={styles.toggleActive} /> : <ToggleLeft size={20} />}
          <span>Include Voided</span>
        </button>
        <button type="button" className={styles.toggleWrapper} onClick={() => setShowExceptionsOnly(!showExceptionsOnly)}>
          {showExceptionsOnly ? <ToggleRight size={20} className={styles.toggleActive} /> : <ToggleLeft size={20} />}
          <span>Exceptions Only</span>
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {hasDrillthroughScope && (
        <div className={styles.exceptionBanner}>
          <div>
            <strong>Month-close treasury review scope active.</strong>
            <div className={styles.exceptionSample}>
              Payment vouchers and treasury exceptions are filtered for close review.
            </div>
          </div>
          <button className={styles.btnSecondary} onClick={clearDrillthrough}>
            Clear Scope
          </button>
        </div>
      )}

      {exceptionSummary.count > 0 && (
        <div className={styles.exceptionBanner}>
          <div>
            <strong>Treasury exceptions found:</strong> {exceptionSummary.count}
          </div>
          <div className={styles.exceptionSample}>{exceptionSummary.sample}</div>
        </div>
      )}

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span>Voucher No</span>
          <span>Party / Payee</span>
          <span>Branch</span>
          <span>Type</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span className={styles.centerAlign}>Actions</span>
        </div>
        {loading ? (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <p>Loading vouchers...</p>
          </div>
        ) : filteredVouchers.length > 0 ? (
          filteredVouchers.map((voucher) => {
            const issues = exceptionMap[voucher.id] ?? [];
            return (
              <div key={voucher.id} className={styles.tableRow}>
                <div className={styles.rowPrimary}>
                  <span className={styles.voucherNo}>{formatVisibleVoucherNumber(voucher)}</span>
                  {issues.length > 0 && (
                    <span className={styles.exceptionChip}>
                      <AlertTriangle size={12} />
                      {issues.length}
                    </span>
                  )}
                </div>
                <div className={styles.partyCell}>
                  <div className={styles.partyRow}>
                    <span className={styles.partyName}>{voucher.party_name}</span>
                    <div className={styles.partyTypeTag}>
                      {voucher.party_type === 'VENDOR' ? <Building2 size={10} /> : <User size={10} />}
                      <span>{voucher.party_type}</span>
                    </div>
                  </div>
                  {voucher.type === 'PAYMENT' && voucher.treasury_source && (
                    <div className={styles.subtleLine}>{voucher.treasury_source}</div>
                  )}
                </div>
                <span className={styles.branchName}>{voucher.branch_name}</span>
                <span className={styles.typeNameBadge}>{voucher.type}</span>
                <span className={styles.dateCell}>{formatDate(voucher.date)}</span>
                <span className={styles.amount}>{formatCurrency(voucher.amount)}</span>
                <div>
                  <span className={`${styles.statusBadge} ${getStatusClass(voucher.status)}`}>{voucher.status}</span>
                </div>
                <div className={styles.actionCell}>
                  <button
                    className={styles.reviewBtn}
                    title={voucher.status === 'PENDING' && (canManageVouchers || canApproveVouchers) ? 'Review and approve voucher' : 'Review voucher'}
                    onClick={() => setSelectedVoucherId(voucher.id)}
                  >
                    <Eye size={14} />
                    <span>{approvalMode || (voucher.status === 'PENDING' && (canManageVouchers || canApproveVouchers)) ? 'Review / Approve' : 'Review'}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <p>No vouchers found matching your filters.</p>
          </div>
        )}
      </div>

      {selectedVoucherId && (
        <div className={styles.modalOverlay} onClick={closeDetail}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedVoucher ? formatVisibleVoucherNumber(selectedVoucher) : 'Voucher Review'}</h2>
                <p>Review finance context before updating status.</p>
              </div>
              <button className={styles.actionBtn} onClick={closeDetail}>
                <XCircle size={16} />
              </button>
            </div>

            {detailLoading || !selectedVoucher ? (
              <div className={styles.emptyState}>
                <FileText size={40} />
                <p>Loading voucher detail...</p>
              </div>
            ) : (
              <div className={styles.modalBody}>
                <div className={styles.reviewShell}>
                  <div className={styles.reviewMain}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Type</span>
                    <strong>{selectedVoucher.type}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Party</span>
                    <strong>{selectedVoucher.party_name ?? '-'}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Date</span>
                    <strong>{formatDate(selectedVoucher.date)}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Amount</span>
                    <strong>{formatCurrency(Number(selectedVoucher.amount ?? 0))}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Status</span>
                    <strong>{selectedVoucher.status}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Treasury Source</span>
                    <strong>{selectedVoucher.treasury_account?.account_code && selectedVoucher.treasury_account?.account_name
                      ? `${selectedVoucher.treasury_account.account_code} · ${selectedVoucher.treasury_account.account_name}`
                      : selectedVoucher.payment_source_label ?? '-'}</strong>
                  </div>
                  {selectedVoucher.expense_account && (
                    <div className={styles.detailCard}>
                      <span className={styles.detailLabel}>Expense Account</span>
                      <strong>{`${selectedVoucher.expense_account.account_code} · ${selectedVoucher.expense_account.account_name}`}</strong>
                    </div>
                  )}
                  {selectedVoucher.linked_grn && (
                    <div className={styles.detailCard}>
                      <span className={styles.detailLabel}>Linked GRN</span>
                      <strong>{formatVisibleGrnNumber(selectedVoucher.linked_grn.grn_number ?? `GRN-${selectedVoucher.linked_grn.id}`, selectedVoucher.linked_grn)}</strong>
                    </div>
                  )}
                </div>

                {selectedVoucher.description && (
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionTitle}>Description</div>
                    <p className={styles.sectionText}>{selectedVoucher.description}</p>
                  </div>
                )}

                {renderAccountGuideBlock(selectedVoucher.expense_account, 'Expense Account Guidance')}
                {renderAccountGuideBlock(selectedVoucher.treasury_account, 'Treasury Account Guidance')}

                {(exceptionMap[selectedVoucher.id] ?? []).length > 0 && (
                  <div className={styles.sectionCardWarn}>
                    <div className={styles.sectionTitle}>Treasury Exceptions</div>
                    <ul className={styles.issueList}>
                      {(exceptionMap[selectedVoucher.id] ?? []).map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedPaymentPreview?.settlement?.lines?.length > 0 && (
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionTitle}>Payment Settlement Preview</div>
                    <div className={styles.previewMeta}>
                      <span>Mode: <strong>{selectedPaymentPreview.settlement.mode}</strong></span>
                      <span>Allocated: <strong>{formatCurrency(Number(selectedPaymentPreview.settlement.allocated_total ?? 0))}</strong></span>
                      <span>Unallocated: <strong>{formatCurrency(Number(selectedPaymentPreview.settlement.unallocated_amount ?? 0))}</strong></span>
                    </div>
                    <div className={styles.previewTable}>
                      <div className={styles.previewHeader}>
                        <span>Document</span>
                        <span>Due Date</span>
                        <span>Bill Amount</span>
                        <span>Settle Amount</span>
                      </div>
                      {selectedPaymentPreview.settlement.lines.map((line: any, index: number) => (
                        <div key={`${line.payable_type}-${line.document_id}-${index}`} className={styles.previewRow}>
                          <span>{line.document_no ?? '-'}</span>
                          <span>{formatDate(line.due_date)}</span>
                          <span>{formatCurrency(Number(line.bill_amount ?? 0))}</span>
                          <span>{formatCurrency(Number(line.allocated_amount ?? line.settle_amount ?? 0))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                  </div>

                  <aside className={styles.reviewSide}>
                <div className={styles.sectionCard}>
                  <div className={styles.sectionTitle}>Decision Note</div>
                  <textarea
                    className={styles.noteInput}
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    placeholder="Add approval context, rejection reason, or void reason."
                    rows={4}
                  />
                  <div className={styles.noteHint}>Reject and void require a note. Approval note is optional but recommended.</div>
                </div>
                  </aside>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={closeDetail}>Close</button>
              {(canManageVouchers || canApproveVouchers) && selectedVoucher && selectedVoucher.status !== 'APPROVED' && selectedVoucher.status !== 'VOID' && (
                <button
                  className={styles.btnApprove}
                  onClick={() => void handleStatusUpdate('APPROVED')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'APPROVED' ? 'Approving...' : 'Approve'}
                </button>
              )}
              {(canManageVouchers || canApproveVouchers) && selectedVoucher && selectedVoucher.status !== 'REJECTED' && selectedVoucher.status !== 'VOID' && (
                <button
                  className={styles.btnReject}
                  onClick={() => void handleStatusUpdate('REJECTED')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'REJECTED' ? 'Rejecting...' : 'Reject'}
                </button>
              )}
              {(canManageVouchers || canApproveVouchers) && selectedVoucher && selectedVoucher.status !== 'VOID' && (
                <button
                  className={styles.btnVoid}
                  onClick={() => void handleStatusUpdate('VOID')}
                  disabled={actionLoading !== null || selectedVoucher.status === 'PENDING'}
                  title={selectedVoucher.status === 'PENDING' ? 'Approve or reject pending vouchers before voiding.' : undefined}
                >
                  {actionLoading === 'VOID' ? 'Voiding...' : 'Void'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VoucherList() {
  return <VoucherWorkspace />;
}

export function VoucherApprovals() {
  return <VoucherWorkspace approvalMode />;
}
