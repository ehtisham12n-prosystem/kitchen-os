/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ChevronRight,
    Clock,
    Eye,
    Filter,
    PackageCheck,
    Search,
    Send,
    Truck,
    ChefHat,
    XCircle,
} from 'lucide-react';
import { inventoryApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from '../inventory/InterBranchTransfer.module.css';

type SupplyStatus =
    | 'requested'
    | 'approved'
    | 'rejected'
    | 'in_transit'
    | 'received'
    | 'received_with_variance';

interface SupplyRecord {
    id: number;
    transfer_no: string;
    origin_production_no?: string | null;
    status: SupplyStatus;
    status_label: string;
    reason_code?: string | null;
    source_branch: { branch_name: string; production_source_label?: string | null } | null;
    destination_branch: { branch_name: string } | null;
    requested_at?: string;
    notes?: string | null;
    items: Array<{
        id: number;
        item_name: string;
        item_sku?: string | null;
        production_stage_label: string;
        requested_quantity: number;
        dispatched_quantity: number;
        received_quantity: number;
        variance_quantity: number;
    }>;
    events: Array<{ id: number; action: string; actor_name?: string | null; created_at: string }>;
    summary: {
        line_count: number;
        requested_value: number;
        dispatched_value: number;
        received_value: number;
        variance_quantity: number;
        has_variance: boolean;
    };
    available_actions: string[];
}

const STATUS_CONFIG: Record<SupplyStatus, { label: string; icon: typeof Clock; cls: string }> = {
    requested: { label: 'Requested', icon: Clock, cls: 'statusPending' },
    approved: { label: 'Approved', icon: PackageCheck, cls: 'statusApproved' },
    in_transit: { label: 'In Transit', icon: Truck, cls: 'statusTransit' },
    received: { label: 'Received', icon: PackageCheck, cls: 'statusCompleted' },
    received_with_variance: { label: 'Received with Variance', icon: AlertTriangle, cls: 'statusVariance' },
    rejected: { label: 'Rejected', icon: XCircle, cls: 'statusRejected' },
};

const REASON_LABELS: Record<string, string> = {
    daily_par: 'Daily Par Refill',
    semi_prep: 'Semi-Prepared Refill',
    event_prep: 'Event Prep',
    commissary: 'Commissary Dispatch',
    emergency: 'Emergency Support',
    other: 'Other',
};

function formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString() : 'Pending';
}

function getPipelineStep(status: SupplyStatus) {
    const map: Record<SupplyStatus, number> = {
        requested: 0,
        approved: 1,
        in_transit: 2,
        received: 3,
        received_with_variance: 3,
        rejected: -1,
    };
    return map[status];
}

export function ProductionSupplyList() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<SupplyRecord[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await inventoryApi.getProductionSupplyRequests();
                setRecords(data);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load production supply requests.');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, []);

    const filtered = records.filter((record) => {
        const haystack = [
            record.transfer_no,
            record.origin_production_no,
            record.source_branch?.branch_name,
            record.destination_branch?.branch_name,
            record.reason_code,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(search.toLowerCase())
            && (statusFilter === 'all' || record.status === statusFilter);
    });

    const requestedCount = records.filter((record) => record.status === 'requested').length;
    const inTransitCount = records.filter((record) => record.status === 'in_transit').length;
    const varianceCount = records.filter((record) => record.summary.has_variance).length;
    const totalValue = records.reduce((sum, record) => sum + (record.summary.dispatched_value || record.summary.requested_value), 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                        <div className={styles.titleRow}>
                        <ChefHat size={24} className={styles.titleIcon} />
                        <div>
                            <h1>Production Supply Coordination</h1>
                            <p className={styles.subtitle}>Central kitchen and branch production requests with request, dispatch, receipt, and variance traceability.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} onClick={() => navigate('/console/production/supply/new')}>
                        <Send size={16} />
                        New Supply Request
                    </button>
                </div>
            </div>

            <div className={styles.summaryRow}>
                {[
                    { label: 'Requested', value: requestedCount, color: 'amber', icon: Clock },
                    { label: 'In Transit', value: inTransitCount, color: 'cyan', icon: Truck },
                    { label: 'Variance Cases', value: varianceCount, color: 'rose', icon: AlertTriangle },
                    { label: 'Supply Value', value: `PKR ${(totalValue / 1000).toFixed(1)}k`, color: 'indigo', icon: PackageCheck },
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

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input className={styles.searchInput} placeholder="Search request #, source, destination, or reason..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                    <Filter size={13} className={styles.filterIcon} />
                    {['all', 'requested', 'approved', 'in_transit', 'received', 'received_with_variance', 'rejected'].map((status) => (
                        <button key={status} className={`${styles.filterBtn} ${statusFilter === status ? styles.filterActive : ''}`} onClick={() => setStatusFilter(status)}>
                            {status === 'all' ? 'All' : STATUS_CONFIG[status as SupplyStatus]?.label || status}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.transferList}>
                {isLoading && <div className={styles.emptyState}>Loading production supply requests...</div>}
                {!isLoading && filtered.length === 0 && <div className={styles.emptyState}>No production supply requests match the current filters.</div>}
                {!isLoading && filtered.map((record) => {
                    const config = STATUS_CONFIG[record.status];
                    const StatusIcon = config.icon;
                    const isExpanded = expandedId === record.id;
                    const step = getPipelineStep(record.status);

                    return (
                        <div key={record.id} className={styles.transferCard}>
                            <div className={styles.cardHeader} onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                                <div className={styles.cardLeft}>
                                    <span className={styles.transferNo}>{record.transfer_no}</span>
                                    <div className={styles.routeRow}>
                                        <span className={styles.branchLabel}>{record.source_branch?.production_source_label || record.source_branch?.branch_name || 'Source'}</span>
                                        <ChevronRight size={14} className={styles.routeArrow} />
                                        <span className={styles.branchLabel}>{record.destination_branch?.branch_name || 'Destination'}</span>
                                    </div>
                                    <span className={styles.reasonBadge}>{REASON_LABELS[record.reason_code || 'other'] || record.reason_code || 'Production Supply'}</span>
                                    {record.origin_production_no ? <span className={styles.reasonBadge}>From {record.origin_production_no}</span> : null}
                                </div>

                                <div className={styles.pipeline}>
                                    {record.status !== 'rejected' ? (
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
                                    <span className={styles.cardMeta}>{record.summary.line_count} items</span>
                                    <span className={styles.cardValue}>PKR {(record.summary.dispatched_value || record.summary.requested_value).toLocaleString('en-PK')}</span>
                                    {record.summary.has_variance && <span className={styles.variancePill}><AlertTriangle size={10} /> Variance</span>}
                                    <span className={styles.cardDate}>{formatDateTime(record.requested_at)}</span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={styles.cardExpanded}>
                                    <div className={styles.itemsTable}>
                                        <div className={styles.itemsHead}>
                                            <span style={{ width: '110px' }}>Item</span>
                                            <span style={{ flex: 1 }}>Description</span>
                                            <span style={{ width: '120px' }}>Stage</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Requested</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Sent</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>Received</span>
                                        </div>
                                        {record.items.map((item) => (
                                            <div key={item.id} className={styles.itemsRow}>
                                                <span style={{ width: '110px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{item.item_sku || `ITEM-${item.id}`}</span>
                                                <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                                <span style={{ width: '120px' }}>{item.production_stage_label}</span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.requested_quantity}</span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.dispatched_quantity}</span>
                                                <span style={{ width: '90px', textAlign: 'right' }}>{item.received_quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={styles.expandedFooter}>
                                        <div className={styles.auditTrail}>
                                            <div className={styles.auditTitle}>Audit Trail</div>
                                            {record.events.map((event) => (
                                                <div key={event.id} className={styles.auditRow}>
                                                    <span className={styles.auditDot} />
                                                    <span className={styles.auditLabel}>{event.action.toUpperCase()}</span>
                                                    <span className={styles.auditUser}>{event.actor_name || 'System'}</span>
                                                    <span className={styles.auditDate}>{formatDateTime(event.created_at)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.expandedActions}>
                                            <button className={styles.btnView} onClick={() => navigate(`/console/production/supply/${record.id}`)}>
                                                <Eye size={14} />
                                                Open Request
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
