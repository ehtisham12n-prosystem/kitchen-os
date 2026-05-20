/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CreditCard, RefreshCw, Search, Ticket, Wallet } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { accountingApi } from '../../api/api';
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

type EventRiskFilter = 'all' | 'overdue' | 'current';

export function EventReceivablesControl() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { branches, activeBranch } = useBranchContext();
  const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
  const [searchParams] = useSearchParams();
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    const branchId = searchParams.get('branch_id') || activeBranch?.branch_id || activeBranch?.id;
    return branchId ? String(branchId) : 'all';
  });
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('event') || '');
  const [riskFilter, setRiskFilter] = useState<EventRiskFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => searchParams.get('event_id'));
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const nextBranchId = activeBranch?.branch_id || activeBranch?.id;
    if (nextBranchId && selectedBranch === 'all' && !searchParams.get('branch_id')) {
      setSelectedBranch(String(nextBranchId));
    }
  }, [activeBranch, selectedBranch, searchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await accountingApi.getReceivablesAging({
          branch_id: selectedBranch === 'all' ? undefined : selectedBranch,
          as_of_date: asOfDate,
          source_type: 'catering_event',
        });
        setData(response);
      } catch (error: any) {
        toast.error('Event Receivables Unavailable', error?.message || 'Could not load event receivables control.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedBranch, asOfDate, refreshKey]);

  const filteredEvents = useMemo(() => {
    const eventRollup = Array.isArray(data?.event_rollup) ? data.event_rollup : [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return eventRollup.filter((event: any) => {
      const matchesSearch = !normalizedSearch || [
        event.event_no,
        event.event_title,
        event.party_name,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matchesSearch) return false;
      if (riskFilter === 'overdue') return Number(event.overdue_amount ?? 0) > 0.009;
      if (riskFilter === 'current') return Number(event.overdue_amount ?? 0) <= 0.009;
      return true;
    });
  }, [data, searchTerm, riskFilter]);

  const effectiveSelectedEventId = selectedEventId || (filteredEvents[0]?.event_id ? String(filteredEvents[0].event_id) : null);
  const focusedDocuments = useMemo(() => {
    const documents = Array.isArray(data?.documents) ? data.documents : [];
    if (!effectiveSelectedEventId) {
      return documents;
    }
    return documents.filter((document: any) => String(document.event_id || '') === String(effectiveSelectedEventId));
  }, [data, effectiveSelectedEventId]);
  const summary = data?.summary ?? {};

  const openCateringEvent = (eventRow: any) => {
    const query = new URLSearchParams();
    if (eventRow?.event_id) {
      query.set('event_id', String(eventRow.event_id));
    }
    if (selectedBranch !== 'all') {
      query.set('branch_id', selectedBranch);
    }
    navigate(`${consoleBase}/catering?${query.toString()}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Event Receivables Control</h1>
          <p>Track staged catering invoices, overdue milestone exposure, and collection follow-up from accounting.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => setRefreshKey((current) => current + 1)}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.field}>
          <span>Branch</span>
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
          <span><Search size={14} /> Event Search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Event no, title, or customer"
          />
        </label>
        <label className={styles.field}>
          <span>Queue Filter</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as EventRiskFilter)}>
            <option value="all">All Billings</option>
            <option value="overdue">Overdue Only</option>
            <option value="current">Current Only</option>
          </select>
        </label>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Event Receivables</span>
          <strong>{formatPKR(Number(summary.catering_event_outstanding_amount ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.catering_event_document_count ?? 0))} milestone billings open</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Overdue Event Exposure</span>
          <strong>{formatPKR(Number(summary.overdue_amount ?? 0))}</strong>
          <small>{formatCompactNumber(Number(summary.overdue_count ?? 0))} overdue billings</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Events In Queue</span>
          <strong>{formatCompactNumber(Number(summary.event_count ?? 0))}</strong>
          <small>{summary.top_event_name || 'No event focus'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Top Event Exposure</span>
          <strong>{summary.top_event_name || '-'}</strong>
          <small>{formatPKR(Number(summary.top_event_amount ?? 0))}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Current Mix</span>
          <strong>{formatPKR(Number(summary.bucket_current ?? 0))}</strong>
          <small>{formatPKR(Number(summary.bucket_31_60 ?? 0))} beyond 30 days</small>
        </article>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Event Risk Queue</h2>
              <p>Prioritized by overdue event exposure and open milestone balance.</p>
            </div>
            <button type="button" className={styles.linkButton} onClick={() => navigate(`${consoleBase}/accounting/receivables`)}>
              Open Total AR <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading event receivable queue...</div>
          ) : filteredEvents.length === 0 ? (
            <div className={styles.emptyState}>No event receivable exposure matches the current scope.</div>
          ) : (
            <div className={styles.queueList}>
              {filteredEvents.map((eventRow: any) => {
                const isSelected = String(effectiveSelectedEventId || '') === String(eventRow.event_id || '');
                return (
                  <div
                    key={`event-${eventRow.event_id}`}
                    role="button"
                    tabIndex={0}
                    className={`${styles.queueRow} ${isSelected ? styles.queueRowSelected : ''}`}
                    onClick={() => setSelectedEventId(String(eventRow.event_id))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedEventId(String(eventRow.event_id));
                      }
                    }}
                  >
                    <div className={styles.queueHead}>
                      <div>
                        <strong>{eventRow.event_no || `Event #${eventRow.event_id}`}</strong>
                        <span>{eventRow.event_title} • {eventRow.party_name}</span>
                      </div>
                      <div className={styles.badgeRow}>
                        {Number(eventRow.overdue_amount ?? 0) > 0.009 ? <span className={`${styles.badge} ${styles.badgeOverdue}`}><CalendarClock size={12} /> Overdue</span> : <span className={styles.badge}>Current</span>}
                        <span className={styles.badge}><Ticket size={12} /> {eventRow.billing_count} invoices</span>
                      </div>
                    </div>
                    <div className={styles.queueMetrics}>
                      <div><span>Outstanding</span><strong>{formatPKR(Number(eventRow.outstanding_amount ?? 0))}</strong></div>
                      <div><span>Overdue</span><strong>{formatPKR(Number(eventRow.overdue_amount ?? 0))}</strong></div>
                      <div><span>Max Delay</span><strong>{Number(eventRow.max_days_past_due ?? 0)} day(s)</strong></div>
                      <div><span>Customer</span><strong>{eventRow.customer_code || 'Walk-in'}</strong></div>
                    </div>
                    <div className={styles.queueFooter}>
                      <span>{formatDate(eventRow.oldest_due_date)} oldest due • {eventRow.phone_number || 'No phone on file'}</span>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openCateringEvent(eventRow);
                        }}
                      >
                        <CreditCard size={14} />
                        Open Event
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
              <h2>Billing Document Queue</h2>
              <p>Review open staged invoices and the oldest milestone that still needs collection.</p>
            </div>
            {effectiveSelectedEventId ? (
              <button type="button" className={styles.linkButton} onClick={() => setSelectedEventId(null)}>
                Clear Focus <ArrowRight size={14} />
              </button>
            ) : null}
          </div>

          <div className={styles.documentSummary}>
            <div><Ticket size={15} /><span>{formatCompactNumber(focusedDocuments.length)} open event billings</span></div>
            <div><Wallet size={15} /><span>{formatPKR(focusedDocuments.reduce((sum: number, item: any) => sum + Number(item.outstanding_amount ?? 0), 0))} in focus</span></div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading open event billing documents...</div>
          ) : focusedDocuments.length === 0 ? (
            <div className={styles.emptyState}>No staged event billings are open in the current scope.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Billing</th>
                    <th>Date</th>
                    <th>Outstanding</th>
                    <th>Days Past Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {focusedDocuments.slice(0, 16).map((document: any) => (
                    <tr key={`event-receivable-${document.id}`}>
                      <td>
                        <div className={styles.tablePrimary}>
                          <strong>{document.event_no || `Event #${document.event_id}`}</strong>
                          <span>{document.event_title || document.party_name}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.tablePrimary}>
                          <strong>{document.billing_label || document.billing_type || (formatConfiguredDocumentNumber(document.document_no, activeBranch || document, { preserveTypePrefix: true }) || document.document_no)}</strong>
                          <span>{document.party_name}</span>
                        </div>
                      </td>
                      <td>{formatDate(document.document_date)}</td>
                      <td><strong>{formatPKR(Number(document.outstanding_amount ?? 0))}</strong></td>
                      <td>{Number(document.days_past_due ?? 0) > 0 ? `${document.days_past_due} day(s)` : 'Current'}</td>
                      <td>
                        <div className={styles.badgeRow}>
                          {Number(document.days_past_due ?? 0) > 0 ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>Overdue</span> : <span className={styles.badge}>Current</span>}
                          <span className={styles.badge}>{document.billing_type || 'billing'}</span>
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

export default EventReceivablesControl;
