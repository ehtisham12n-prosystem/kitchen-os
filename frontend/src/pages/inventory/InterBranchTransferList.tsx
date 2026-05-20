import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeftRight,
    Building2,
    CheckCircle2,
    ChevronRight,
    Clock,
    Eye,
    Filter,
    Package,
    PackageCheck,
    Search,
    Truck,
    XCircle,
} from 'lucide-react';
import { inventoryApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './InterBranchTransfer.module.css';

type TransferStatus =
    | 'requested'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'in_transit'
    | 'received'
    | 'received_with_variance';

interface TransferRecord {
    id: number;
    transfer_no: string;
    status: TransferStatus;
    status_label: string;
    reason_code?: string | null;
    source_branch: { branch_name: string; inventory_store_type: 'branch' | 'central' } | null;
    destination_branch: { branch_name: string; inventory_store_type: 'branch' | 'central' } | null;
    source_store_label?: string | null;
    requested_by_name?: string | null;
    requested_at?: string;
    approved_at?: string | null;
    dispatched_at?: string | null;
    received_at?: string | null;
    notes?: string | null;
    items: Array<{
        id: number;
        item_id: number;
        item_sku?: string | null;
        item_name: string;
        uom_base?: string | null;
        requested_quantity: number;
        dispatched_quantity: number;
        received_quantity: number;
        in_transit_quantity: number;
        variance_quantity: number;
        unit_cost: number;
    }>;
    events: Array<{
        id: number;
        action: string;
        actor_name?: string | null;
        created_at: string;
    }>;
    summary: {
        line_count: number;
        requested_quantity: number;
        dispatched_quantity: number;
        received_quantity: number;
        in_transit_quantity: number;
        requested_value: number;
        dispatched_value: number;
        received_value: number;
        in_transit_value: number;
        variance_quantity: number;
        has_in_transit: boolean;
        has_variance: boolean;
    };
    finance_clearing?: {
        status: string;
        status_label: string;
        top_note?: string | null;
        dispatch_posted: boolean;
        receipt_posted: boolean;
        dispatch_journal_id?: number | string | null;
        receipt_journal_id?: number | string | null;
        dispatched_amount: number;
        received_amount: number;
        variance_amount: number;
        review_required?: boolean;
        review_completed?: boolean;
        review_status_label?: string | null;
        reviewed_at?: string | null;
        reviewed_by_name?: string | null;
        review_notes?: string | null;
        recharge_applicable?: boolean;
        recharge_amount?: number;
        recharge_status_label?: string | null;
        recharge_posted?: boolean;
        source_recharge_journal_id?: number | string | null;
        destination_recharge_journal_id?: number | string | null;
    } | null;
    available_actions: string[];
}

const STATUS_CONFIG: Record<TransferStatus, { label: string; icon: typeof Clock; cls: string }> = {
    requested: { label: 'Requested', icon: Clock, cls: 'statusPending' },
    approved: { label: 'Approved', icon: CheckCircle2, cls: 'statusApproved' },
    in_transit: { label: 'In Transit', icon: Truck, cls: 'statusTransit' },
    received: { label: 'Received', icon: PackageCheck, cls: 'statusCompleted' },
    received_with_variance: { label: 'Received with Variance', icon: AlertTriangle, cls: 'statusVariance' },
    rejected: { label: 'Rejected', icon: XCircle, cls: 'statusRejected' },
    cancelled: { label: 'Cancelled', icon: XCircle, cls: 'statusRejected' },
};

const REASON_LABELS: Record<string, string> = {
    shortage: 'Stock Shortage',
    redistribution: 'Redistribution',
    event: 'Event / Rush',
    central_issue: 'Central Store Replenishment',
    other: 'Other',
};

function formatDateTime(value?: string | null) {
    if (!value) return 'Pending';
    return new Date(value).toLocaleString();
}

function formatQty(value: number) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 4 });
}

function formatCurrency(value: number) {
    return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function getPipelineStep(status: TransferStatus) {
    const map: Record<TransferStatus, number> = {
        requested: 0,
        approved: 1,
        in_transit: 2,
        received: 3,
        received_with_variance: 3,
        rejected: -1,
        cancelled: -1,
    };
    return map[status];
}

export function InterBranchTransferList() {
    const navigate = useNavigate();
    const { canManageTransfers } = usePermissionAccess();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const loadTransfers = async () => {
            setIsLoading(true);
            try {
                const data = await inventoryApi.getTransfers();
                setTransfers(data);
            } catch (error: any) {
                console.error('Failed to load transfers:', error);
                toast.error('Load Failed', error.message || 'Could not load transfer list.');
            } finally {
                setIsLoading(false);
            }
        };

        loadTransfers();
    }, []);

    useEffect(() => {
        const presetSearch = searchParams.get('search');
        const presetStatus = searchParams.get('status');
        if (presetSearch) setSearch(presetSearch);
        if (presetStatus) setStatusFilter(presetStatus);
    }, [searchParams]);

    const financeAttentionOnly = searchParams.get('finance_attention') === '1';
    const reviewOrigin = searchParams.get('origin');

    const filtered = transfers.filter((transfer) => {
        const matchSearch = [
            transfer.transfer_no,
            transfer.source_branch?.branch_name,
            transfer.destination_branch?.branch_name,
            transfer.reason_code,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchStatus = statusFilter === 'all' || transfer.status === statusFilter;
        const matchFinanceAttention = !financeAttentionOnly
            || ['dispatch_posting_pending', 'receipt_posting_pending', 'variance_review', 'not_started'].includes(String(transfer.finance_clearing?.status || ''));
        return matchSearch && matchStatus && matchFinanceAttention;
    });

    const scopeBanner = useMemo(() => {
        if (reviewOrigin !== 'inter_branch_settlement') return null;
        return {
            title: 'Month-close inter-branch settlement scope is active.',
            body: financeAttentionOnly
                ? 'Only transfers with finance attention are shown so accounting can review branch clearing before close.'
                : 'This view was opened from settlement review.',
        };
    }, [financeAttentionOnly, reviewOrigin]);

    const clearScopedFilters = () => {
        setSearchParams({});
        setSearch('');
        setStatusFilter('all');
    };

    const requestedCount = transfers.filter((transfer) => transfer.status === 'requested').length;
    const inTransitQuantity = transfers.reduce((sum, transfer) => sum + Number(transfer.summary.in_transit_quantity || 0), 0);
    const varianceCount = transfers.filter((transfer) => transfer.summary.has_variance).length;
    const financeAttentionCount = transfers.filter((transfer) =>
        ['dispatch_posted', 'receipt_posting_pending'].includes(String(transfer.finance_clearing?.status || ''))
        || (String(transfer.finance_clearing?.status || '') === 'variance_review' && !transfer.finance_clearing?.review_completed),
    ).length;

    if (!canManageTransfers) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Your current role does not include inter-branch transfer access.</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.titleRow}>
                        <ArrowLeftRight size={24} className={styles.titleIcon} />
                        <div>
                            <h1>Internal Stock Transfers</h1>
                            <p className={styles.subtitle}>Central-store dispatches and branch returns with in-transit control and receipt variance capture.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} onClick={() => navigate('/console/inventory/ibt/new')}>
                        <ArrowLeftRight size={16} />
                        New Transfer Request
                    </button>
                </div>
            </div>

            <div className={styles.summaryRow}>
                {[
                    { label: 'Requested', value: requestedCount, color: 'amber', icon: Clock },
                    { label: 'In Transit Qty', value: formatQty(inTransitQuantity), color: 'cyan', icon: Truck },
                    { label: 'Variance Cases', value: varianceCount, color: 'rose', icon: AlertTriangle },
                    { label: 'Finance Attention', value: financeAttentionCount, color: 'indigo', icon: Package },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className={`${styles.summaryCard} ${styles[`sum${item.color.charAt(0).toUpperCase() + item.color.slice(1)}`]}`}>
                            <Icon size={18} />
                            <div>
                                <span className={styles.sumVal}>{item.value}</span>
                                <span className={styles.sumLabel}>{item.label}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {scopeBanner && (
                <div className={styles.scopeBanner}>
                    <div>
                        <strong>{scopeBanner.title}</strong>
                        <span>{scopeBanner.body}</span>
                    </div>
                    <button type="button" className={styles.scopeBannerClear} onClick={clearScopedFilters}>
                        Clear Scope
                    </button>
                </div>
            )}

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input className={styles.searchInput} placeholder="Search transfer #, branch, or reason..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                    <Filter size={13} className={styles.filterIcon} />
                    {['all', 'requested', 'approved', 'in_transit', 'received', 'received_with_variance', 'rejected', 'cancelled'].map((status) => (
                        <button key={status} className={`${styles.filterBtn} ${statusFilter === status ? styles.filterActive : ''}`} onClick={() => setStatusFilter(status)}>
                            {status === 'all' ? 'All' : STATUS_CONFIG[status as TransferStatus]?.label || status}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.transferList}>
                {isLoading && <div className={styles.emptyState}>Loading transfers...</div>}
                {!isLoading && filtered.length === 0 && <div className={styles.emptyState}>No transfers match your filters.</div>}
                {!isLoading && filtered.map((transfer) => {
                    const config = STATUS_CONFIG[transfer.status];
                    const StatusIcon = config.icon;
                    const isExpanded = expandedId === transfer.id;
                    const step = getPipelineStep(transfer.status);

                    return (
                        <div key={transfer.id} className={`${styles.transferCard} ${transfer.status === 'requested' ? styles.cardPending : ''}`}>
                            <div className={styles.cardHeader} onClick={() => setExpandedId(isExpanded ? null : transfer.id)}>
                                <div className={styles.cardLeft}>
                                    <span className={styles.transferNo}>{transfer.transfer_no}</span>
                                    <div className={styles.routeRow}>
                                        <span className={styles.branchLabel}><Building2 size={12} /> {transfer.source_branch?.branch_name || 'Unknown'}</span>
                                        <ChevronRight size={14} className={styles.routeArrow} />
                                        <span className={styles.branchLabel} style={{ color: 'var(--accent-tertiary)' }}><Building2 size={12} /> {transfer.destination_branch?.branch_name || 'Unknown'}</span>
                                    </div>
                                    <span className={styles.reasonBadge}>{REASON_LABELS[transfer.reason_code || 'other'] || transfer.reason_code || 'General Transfer'}</span>
                                </div>

                                <div className={styles.pipeline}>
                                    {transfer.status !== 'rejected' ? (
                                        <div className={styles.pipelineTrack}>
                                            {['Requested', 'Approved', 'Dispatched', 'Received'].map((label, index) => (
                                                <div key={label} className={styles.pipelineStep}>
                                                    <div className={`${styles.pipelineDot} ${index <= step ? styles.dotDone : ''} ${index === step ? styles.dotActive : ''}`} />
                                                    <span className={`${styles.pipelineLabel} ${index === step ? styles.labelActive : ''}`}>{label}</span>
                                                    {index < 3 && <div className={`${styles.pipelineLine} ${index < step ? styles.lineDone : ''}`} />}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className={styles.rejectedPill}><XCircle size={13} /> Rejected</span>
                                    )}
                                </div>

                                <div className={styles.cardRight}>
                                    <span className={`${styles.statusBadge} ${styles[config.cls]}`}><StatusIcon size={11} /> {config.label}</span>
                                    <span className={styles.cardMeta}>
                                        {transfer.summary.line_count} items | {transfer.source_branch?.inventory_store_type === 'central' ? 'Central Dispatch' : 'Branch Dispatch'}
                                        {transfer.summary.has_in_transit ? ` | ${formatQty(transfer.summary.in_transit_quantity)} in transit` : ''}
                                    </span>
                                    <span className={styles.cardValue}>PKR {(transfer.summary.dispatched_value || transfer.summary.requested_value).toLocaleString('en-PK')}</span>
                                    <span className={styles.financeBadge}>{transfer.finance_clearing?.status_label || 'Clearing Not Started'}</span>
                                    {transfer.summary.has_variance && <span className={styles.variancePill}><AlertTriangle size={10} /> Variance</span>}
                                    <span className={styles.cardDate}>{formatDateTime(transfer.requested_at)}</span>
                                    <button className={styles.expandBtn}>{isExpanded ? '-' : '+'}</button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={styles.cardExpanded}>
                                    <div className={styles.itemsTable}>
                                        <div className={styles.itemsHead}>
                                            <span style={{ width: '110px' }}>Item</span>
                                            <span style={{ flex: 1 }}>Description</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Requested</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Sent</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>In Transit</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Received</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Variance</span>
                                            <span style={{ width: '100px', textAlign: 'right' }}>Cost</span>
                                        </div>
                                        {transfer.items.map((item) => (
                                            <div key={item.id} className={styles.itemsRow}>
                                                <span style={{ width: '110px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{item.item_sku || `ITEM-${item.item_id}`}</span>
                                                <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.requested_quantity}</span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.dispatched_quantity}</span>
                                                <span style={{ width: '90px', textAlign: 'right', color: item.in_transit_quantity > 0 ? 'var(--accent-tertiary)' : 'var(--text-tertiary)' }}>
                                                    {item.in_transit_quantity > 0 ? item.in_transit_quantity : '-'}
                                                </span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.received_quantity}</span>
                                                <span style={{ width: '90px', textAlign: 'right', color: item.variance_quantity > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                                                    {item.variance_quantity > 0 ? item.variance_quantity : '-'}
                                                </span>
                                                <span style={{ width: '100px', textAlign: 'right' }}>{item.unit_cost > 0 ? `PKR ${item.unit_cost}` : '-'}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={styles.expandedFooter}>
                                        <div className={styles.auditTrail}>
                                            {transfer.finance_clearing && (
                                                <div className={styles.financePanel}>
                                                    <div className={styles.auditTitle}>Finance Clearing</div>
                                                    <div className={styles.financeGrid}>
                                                        <div className={styles.financeTile}>
                                                            <span>Status</span>
                                                            <strong>{transfer.finance_clearing.status_label}</strong>
                                                            <small>{transfer.finance_clearing.top_note || 'No finance note recorded.'}</small>
                                                        </div>
                                                        {transfer.finance_clearing.review_required && (
                                                            <div className={styles.financeTile}>
                                                                <span>Finance Review</span>
                                                                <strong>{transfer.finance_clearing.review_status_label || 'Review Pending'}</strong>
                                                                <small>
                                                                    {transfer.finance_clearing.review_completed
                                                                        ? `${transfer.finance_clearing.reviewed_by_name || 'Finance'} on ${formatDateTime(transfer.finance_clearing.reviewed_at)}`
                                                                        : 'Complete the finance review once the variance is understood.'}
                                                                </small>
                                                            </div>
                                                        )}
                                                        {transfer.finance_clearing.recharge_applicable && (
                                                            <div className={styles.financeTile}>
                                                                <span>Central Recharge</span>
                                                                <strong>{transfer.finance_clearing.recharge_status_label || 'Central Supply'}</strong>
                                                                <small>
                                                                    Amount {formatCurrency(Number(transfer.finance_clearing.recharge_amount ?? 0))}
                                                                    {transfer.finance_clearing.recharge_posted
                                                                        ? ` | Source #${transfer.finance_clearing.source_recharge_journal_id} | Destination #${transfer.finance_clearing.destination_recharge_journal_id}`
                                                                        : ' | Waiting for receipt posting'}
                                                                </small>
                                                            </div>
                                                        )}
                                                        <div className={styles.financeTile}>
                                                            <span>Dispatch Journal</span>
                                                            <strong>{transfer.finance_clearing.dispatch_posted ? `Posted #${transfer.finance_clearing.dispatch_journal_id}` : 'Pending'}</strong>
                                                            <small>Amount {formatCurrency(transfer.finance_clearing.dispatched_amount)}</small>
                                                        </div>
                                                        <div className={styles.financeTile}>
                                                            <span>Receipt Journal</span>
                                                            <strong>{transfer.finance_clearing.receipt_posted ? `Posted #${transfer.finance_clearing.receipt_journal_id}` : 'Pending'}</strong>
                                                            <small>
                                                                Receipt {formatCurrency(transfer.finance_clearing.received_amount)}
                                                                {transfer.finance_clearing.variance_amount > 0 ? ` | Variance ${formatCurrency(transfer.finance_clearing.variance_amount)}` : ''}
                                                            </small>
                                                        </div>
                                                    </div>
                                                    {transfer.finance_clearing.review_required && transfer.finance_clearing.review_notes && (
                                                        <div className={styles.auditNote}><AlertTriangle size={12} /> Finance Review: {transfer.finance_clearing.review_notes}</div>
                                                    )}
                                                </div>
                                            )}
                                            <div className={styles.auditTitle}>Audit Trail</div>
                                            {transfer.events.map((event) => (
                                                <div key={event.id} className={styles.auditRow}>
                                                    <span className={styles.auditDot} />
                                                    <span className={styles.auditLabel}>{event.action.toUpperCase()}</span>
                                                    <span className={styles.auditUser}>{event.actor_name || 'System'}</span>
                                                    <span className={styles.auditDate}>{formatDateTime(event.created_at)}</span>
                                                </div>
                                            ))}
                                            {transfer.notes && <div className={styles.auditNote}><AlertTriangle size={12} /> {transfer.notes}</div>}
                                        </div>

                                        <div className={styles.expandedActions}>
                                            {transfer.available_actions.includes('approve') && (
                                                <button className={styles.btnApprove} onClick={() => navigate(`/console/inventory/ibt/${transfer.id}`)}>
                                                    <CheckCircle2 size={14} />
                                                    Review Approval
                                                </button>
                                            )}
                                            {transfer.available_actions.includes('dispatch') && (
                                                <button className={styles.btnDispatch} onClick={() => navigate(`/console/inventory/ibt/${transfer.id}`)}>
                                                    <Truck size={14} />
                                                    Dispatch Stock
                                                </button>
                                            )}
                                            {transfer.available_actions.includes('receive') && (
                                                <button className={styles.btnReceive} onClick={() => navigate(`/console/inventory/ibt/${transfer.id}`)}>
                                                    <PackageCheck size={14} />
                                                    Receive Stock
                                                </button>
                                            )}
                                            <button className={styles.btnView} onClick={() => navigate(`/console/inventory/ibt/${transfer.id}`)}>
                                                <Eye size={14} />
                                                Open Transfer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
