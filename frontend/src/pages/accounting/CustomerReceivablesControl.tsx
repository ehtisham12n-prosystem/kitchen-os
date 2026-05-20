/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CreditCard, RefreshCw, Search, ShieldAlert, Users, Wallet } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { accountingApi, customerApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredDocumentNumber } from '../pos/printTemplates/printHelpers';
import styles from './CustomerReceivablesControl.module.css';

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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

function priorityLabel(value?: string | null): string {
  if (value === 'critical') return 'Critical';
  if (value === 'high') return 'High';
  return 'Normal';
}

type RiskFilter = 'all' | 'overdue' | 'over_limit' | 'policy_breach';

export function CustomerReceivablesControl() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { branches, activeBranch } = useBranchContext();
  const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
  const [searchParams] = useSearchParams();
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    const branchId = activeBranch?.branch_id || activeBranch?.id;
    return branchId ? String(branchId) : 'all';
  });
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('customer') || '');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() => searchParams.get('customer_id'));
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseNote, setPromiseNote] = useState('');
  const [savingPromise, setSavingPromise] = useState(false);

  useEffect(() => {
    const nextBranchId = activeBranch?.branch_id || activeBranch?.id;
    if (nextBranchId && selectedBranch === 'all') {
      setSelectedBranch(String(nextBranchId));
    }
  }, [activeBranch, selectedBranch]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await accountingApi.getReceivablesAging({
          branch_id: selectedBranch === 'all' ? undefined : selectedBranch,
          as_of_date: asOfDate,
          customer_id: selectedCustomerId || undefined,
        });
        setData(response);
      } catch (error: any) {
        toast.error('Receivables Unavailable', error?.message || 'Could not load customer receivables control.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedBranch, asOfDate, selectedCustomerId, refreshKey]);

  const filteredCustomers = useMemo(() => {
    const customerRollup = Array.isArray(data?.customer_rollup) ? data.customer_rollup : [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return customerRollup.filter((customer: any) => {
      const matchesSearch = !normalizedSearch || [
        customer.party_name,
        customer.customer_code,
        customer.phone_number,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matchesSearch) return false;
      if (riskFilter === 'overdue') return Number(customer.overdue_amount ?? 0) > 0.009;
      if (riskFilter === 'over_limit') return Boolean(customer.is_over_limit);
      if (riskFilter === 'policy_breach') return Boolean(customer.is_policy_breach);
      return true;
    });
  }, [data, searchTerm, riskFilter]);

  const effectiveSelectedCustomerId = selectedCustomerId || filteredCustomers[0]?.party_id || null;
  const focusedDocuments = useMemo(() => {
    const documents = Array.isArray(data?.documents) ? data.documents : [];
    if (!effectiveSelectedCustomerId) {
      return documents;
    }
    return documents.filter((document: any) => String(document.party_id || '') === String(effectiveSelectedCustomerId));
  }, [data, effectiveSelectedCustomerId]);

  const topRiskCustomer = filteredCustomers[0] ?? null;
  const focusedCustomer = useMemo(
    () => filteredCustomers.find((customer: any) => String(customer.party_id || '') === String(effectiveSelectedCustomerId || '')) ?? null,
    [effectiveSelectedCustomerId, filteredCustomers],
  );
  const summary = data?.summary ?? {};

  useEffect(() => {
    setPromiseDate(focusedCustomer?.collection_follow_up_date ?? '');
    setPromiseNote(focusedCustomer?.collection_follow_up_note ?? '');
  }, [focusedCustomer?.collection_follow_up_date, focusedCustomer?.collection_follow_up_note, focusedCustomer?.party_id]);

  const openCollections = (customer: any) => {
    const query = new URLSearchParams();
    if (customer?.party_name) {
      query.set('customer', String(customer.party_name));
    }
    if (customer?.party_id) {
      query.set('customer_id', String(customer.party_id));
    }
    navigate(`${consoleBase}/cashier/credit-payments?${query.toString()}`);
  };

  const savePromise = async () => {
    if (!focusedCustomer?.party_id) {
      return;
    }
    setSavingPromise(true);
    try {
      await customerApi.updateCustomer(focusedCustomer.party_id, {
        collection_follow_up_date: promiseDate || undefined,
        collection_follow_up_note: promiseNote.trim() || undefined,
      });
      toast.success('Collection Promise Saved', `${focusedCustomer.party_name || 'Customer'} follow-up has been updated.`);
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      toast.error('Promise Save Failed', error?.message || 'Could not update collection follow-up.');
    } finally {
      setSavingPromise(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Customer Receivables Control</h1>
          <p>Finance-side review for open customer credit, overdue exposure, and collection priority.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => setRefreshKey((current) => current + 1)}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.field}>
          <span><Building2 size={14} /> Branch</span>
          <select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}>
            <option value="all">All branches</option>
            {branches.map((branch: any) => {
              const id = branch.branch_id || branch.id;
              return <option key={id} value={String(id)}>{branch.branch_name || branch.name}</option>;
            })}
          </select>
        </label>
        <label className={styles.field}>
          <span>As Of Date</span>
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.searchField}`}>
          <span><Search size={14} /> Customer Search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Customer name, code, or phone"
          />
        </label>
        <label className={styles.field}>
          <span>Risk Filter</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}>
            <option value="all">All Exposure</option>
            <option value="overdue">Overdue Only</option>
            <option value="over_limit">Over Credit Limit</option>
            <option value="policy_breach">Credit Policy Breach</option>
          </select>
        </label>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Open Receivables</span>
          <strong>{formatPKR(Number(summary.total_outstanding ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.document_count ?? 0))} open documents</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Overdue Exposure</span>
          <strong>{formatPKR(Number(summary.overdue_amount ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.overdue_count ?? 0))} overdue documents</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Customer Accounts</span>
          <strong>{formatCompactNumber(Number(summary.customer_count ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.over_limit_customer_count ?? 0))} over limit</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Policy Breaches</span>
          <strong>{formatCompactNumber(Number(summary.policy_breach_customer_count ?? 0))}</strong>
          <small>Open balances without credit approval</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Critical Follow-Up</span>
          <strong>{formatCompactNumber(Number(summary.critical_follow_up_count ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.suspended_customer_count ?? 0))} suspended • {formatCompactNumber(Number(summary.inactive_customer_count ?? 0))} inactive</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Top Exposure</span>
          <strong>{summary.top_exposure_customer_name || '-'}</strong>
          <small>{formatPKR(Number(summary.top_exposure_customer_amount ?? 0))}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Top Collector Queue</span>
          <strong>{summary.top_assigned_collector_name || '-'}</strong>
          <small>{formatPKR(Number(summary.top_assigned_collector_amount ?? 0))}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Follow-Up Due</span>
          <strong>{formatCompactNumber(Number(summary.follow_up_due_count ?? 0))}</strong>
          <small>Customers scheduled for collection follow-up now</small>
        </article>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Customer Risk Queue</h2>
              <p>Prioritized by control risk, overdue amount, and total exposure.</p>
            </div>
            <button type="button" className={styles.linkButton} onClick={() => navigate(`${consoleBase}/crm`)}>
              Open CRM <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading receivable accounts...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className={styles.emptyState}>No customer receivable accounts match the current filters.</div>
          ) : (
            <div className={styles.queueList}>
              {filteredCustomers.map((customer: any) => {
                const isSelected = String(effectiveSelectedCustomerId || '') === String(customer.party_id || '');
                return (
                  <div
                    key={`${customer.party_id}-${customer.party_name}`}
                    role="button"
                    tabIndex={0}
                    className={`${styles.queueRow} ${isSelected ? styles.queueRowSelected : ''}`}
                    onClick={() => setSelectedCustomerId(String(customer.party_id))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedCustomerId(String(customer.party_id));
                      }
                    }}
                  >
                    <div className={styles.queueHead}>
                      <div>
                        <strong>{customer.party_name}</strong>
                        <span>{customer.customer_code || 'No code'}{customer.phone_number ? ` • ${customer.phone_number}` : ''}</span>
                      </div>
                      <div className={styles.badgeRow}>
                        {String(customer.customer_status || 'active') === 'suspended' ? <span className={`${styles.badge} ${styles.badgeCritical}`}>Suspended</span> : null}
                        {String(customer.customer_status || 'active') === 'inactive' ? <span className={`${styles.badge} ${styles.badgeWarn}`}>Inactive</span> : null}
                        {customer.credit_control_mode === 'warn' ? <span className={`${styles.badge} ${styles.badgeWarn}`}>Warn Only</span> : null}
                        {customer.is_policy_breach ? <span className={`${styles.badge} ${styles.badgeCritical}`}><ShieldAlert size={12} /> Policy Breach</span> : null}
                        {customer.is_over_limit ? <span className={`${styles.badge} ${styles.badgeWarn}`}><AlertTriangle size={12} /> Over Limit</span> : null}
                        {customer.is_follow_up_due ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>Follow-Up Due</span> : null}
                        {Number(customer.overdue_amount ?? 0) > 0.009 ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>Overdue</span> : null}
                      </div>
                    </div>
                    <div className={styles.queueMetrics}>
                      <div><span>Outstanding</span><strong>{formatPKR(Number(customer.outstanding_amount ?? 0))}</strong></div>
                      <div><span>Overdue</span><strong>{formatPKR(Number(customer.overdue_amount ?? 0))}</strong></div>
                      <div><span>Credit Limit</span><strong>{Number(customer.credit_limit ?? 0) > 0 ? formatPKR(Number(customer.credit_limit ?? 0)) : 'Not set'}</strong></div>
                      <div><span>Utilization</span><strong>{customer.utilization_pct != null ? `${Number(customer.utilization_pct).toFixed(1)}%` : 'N/A'}</strong></div>
                    </div>
                    <div className={styles.queueFooter}>
                      <span>
                        {formatCompactNumber(Number(customer.document_count ?? 0))} docs • max {formatCompactNumber(Number(customer.max_days_past_due ?? 0))} day(s) overdue
                        {customer.assigned_collector_name ? ` • owner ${customer.assigned_collector_name}` : ''}
                        {customer.last_collector_name ? ` • last collected by ${customer.last_collector_name}` : ''}
                        {customer.collection_follow_up_date ? ` • follow up ${formatDate(customer.collection_follow_up_date)}` : ''}
                      </span>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          openCollections(customer);
                        }}
                      >
                        <CreditCard size={14} />
                        Collect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Open Document Queue</h2>
              <p>{topRiskCustomer ? `${topRiskCustomer.party_name} currently holds the highest in-scope receivable risk.` : 'Review open credit documents and settlement priority.'}</p>
            </div>
            {effectiveSelectedCustomerId ? (
              <button type="button" className={styles.linkButton} onClick={() => setSelectedCustomerId(null)}>
                Clear Focus <ArrowRight size={14} />
              </button>
            ) : null}
          </div>

          {focusedCustomer ? (
            <div className={styles.promisePanel}>
              <div className={styles.promiseHeader}>
                <div>
                  <h3>Collection Promise</h3>
                  <p>Update the next committed follow-up here without leaving receivables control.</p>
                  <div className={styles.promiseMeta}>
                    <span className={`${styles.badge} ${focusedCustomer.collection_priority === 'critical' ? styles.badgeCritical : focusedCustomer.collection_priority === 'high' ? styles.badgeOverdue : styles.badgeWarn}`}>
                      {priorityLabel(focusedCustomer.collection_priority)} Priority
                    </span>
                    <span className={styles.promiseAction}>{focusedCustomer.follow_up_action || 'Routine collection follow-up only.'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={savingPromise}
                  onClick={savePromise}
                >
                  {savingPromise ? 'Saving...' : 'Save Promise'}
                </button>
              </div>
              <div className={styles.promiseGrid}>
                <label className={styles.field}>
                  <span>Next Follow-Up Date</span>
                  <input
                    type="date"
                    value={promiseDate}
                    onChange={(event) => setPromiseDate(event.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.promiseNoteField}`}>
                  <span>Promise / Follow-Up Note</span>
                  <textarea
                    value={promiseNote}
                    onChange={(event) => setPromiseNote(event.target.value)}
                    placeholder="Example: customer promised partial payment on Friday afternoon."
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className={styles.documentSummary}>
            <div><Users size={15} /><span>{formatCompactNumber(filteredCustomers.length)} customers in queue</span></div>
            <div><Wallet size={15} /><span>{formatPKR(focusedDocuments.reduce((sum: number, item: any) => sum + Number(item.outstanding_amount ?? 0), 0))} in focus</span></div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading open receivable documents...</div>
          ) : focusedDocuments.length === 0 ? (
            <div className={styles.emptyState}>No open documents are available for the current scope.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Document</th>
                    <th>Date</th>
                    <th>Outstanding</th>
                    <th>Days Past Due</th>
                    <th>Last Collection</th>
                    <th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {focusedDocuments.slice(0, 16).map((document: any) => (
                    <tr key={`receivable-${document.id}`}>
                      <td>
                        <div className={styles.tablePrimary}>
                          <strong>{document.party_name}</strong>
                          <span>{document.customer_code || 'No code'}{document.phone_number ? ` • ${document.phone_number}` : ''}</span>
                        </div>
                      </td>
                      <td>{formatConfiguredDocumentNumber(document.document_no, activeBranch || document, { preserveTypePrefix: true }) || document.document_no}</td>
                      <td>{formatDate(document.document_date)}</td>
                      <td><strong>{formatPKR(Number(document.outstanding_amount ?? 0))}</strong></td>
                      <td>{Number(document.days_past_due ?? 0) > 0 ? `${document.days_past_due} day(s)` : 'Current'}</td>
                      <td>{document.last_collector_name ? `${document.last_collector_name} • ${formatDate(document.last_payment_date)}` : 'No collection yet'}</td>
                      <td>
                        <div className={styles.badgeRow}>
                          {document.assigned_collector_name ? <span className={styles.badge}>{document.assigned_collector_name}</span> : null}
                          {String(document.customer_status || 'active') === 'suspended' ? <span className={`${styles.badge} ${styles.badgeCritical}`}>Suspended</span> : null}
                          {String(document.customer_status || 'active') === 'inactive' ? <span className={`${styles.badge} ${styles.badgeWarn}`}>Inactive</span> : null}
                          {document.credit_control_mode === 'warn' ? <span className={`${styles.badge} ${styles.badgeWarn}`}>Warn Only</span> : null}
                          {Number(document.days_past_due ?? 0) > 0 ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>Overdue</span> : <span className={styles.badge}>Current</span>}
                          {document.collection_follow_up_date ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>Follow-Up {formatDate(document.collection_follow_up_date)}</span> : null}
                          {!document.allow_credit ? <span className={`${styles.badge} ${styles.badgeCritical}`}>No Credit Policy</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default CustomerReceivablesControl;
