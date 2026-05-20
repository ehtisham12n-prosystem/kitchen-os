import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    FileCheck2,
    CheckCircle2,
    Clock,
    Filter,
    Calendar,
    Package,
    User,
    AlertTriangle,
} from 'lucide-react';
import styles from './DisposalApproval.module.css';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

type DateFilter = 'all' | 'today' | 'week' | 'month';

const FILTER_LABELS: Record<DateFilter, string> = {
    all: 'All Posts',
    today: 'Today',
    week: 'Last 7 Days',
    month: 'Last 30 Days',
};

const HIGH_VALUE_WASTAGE_THRESHOLD = 5000;

const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

export function DisposalApproval() {
    const navigate = useNavigate();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<DateFilter>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (!branchId) {
                    setRecords([]);
                    return;
                }

                const ledger = await inventoryApi.getLedger(branchId, {
                    transactionType: 'wastage',
                    limit: 250,
                });
                setRecords(ledger);
                setExpandedId(ledger[0]?.id ?? null);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load wastage posting history.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [branchId]);

    const filtered = useMemo(() => {
        const now = new Date();
        return records.filter((record) => {
            const createdAt = new Date(record.created_at);
            if (filter === 'today') {
                return isSameDay(createdAt, now);
            }
            if (filter === 'week') {
                return now.getTime() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
            }
            if (filter === 'month') {
                return now.getTime() - createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
            }
            return true;
        });
    }, [records, filter]);

    const countForFilter = (option: DateFilter) => {
        const now = new Date();
        return records.filter((record) => {
            const createdAt = new Date(record.created_at);
            if (option === 'today') {
                return isSameDay(createdAt, now);
            }
            if (option === 'week') {
                return now.getTime() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
            }
            if (option === 'month') {
                return now.getTime() - createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
            }
            return true;
        }).length;
    };

    const todayCount = records.filter((record) => isSameDay(new Date(record.created_at), new Date())).length;
    const weekCount = records.filter((record) => (
        new Date().getTime() - new Date(record.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000
    )).length;
    const totalDisposedValue = records.reduce(
        (sum, record) => sum + Math.abs(Number(record.quantity || 0)) * Number(record.unit_cost || 0),
        0,
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/wastage')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <FileCheck2 size={20} className={styles.titleIcon} />
                            <h1>Disposal Posting Log</h1>
                        </div>
                        <p className={styles.subtitle}>Read-only wastage history from the canonical stock ledger path.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.pendingChip}>
                        <CheckCircle2 size={13} />
                        Immediate posting enabled
                    </div>
                </div>
            </div>

            <div className={styles.summaryStrip}>
                <div className={styles.summaryItem}>
                    <Clock size={14} />
                    <span><strong>{todayCount}</strong> Posted Today</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                    <AlertTriangle size={14} />
                    <span><strong>{weekCount}</strong> Posted in 7 Days</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                    <CheckCircle2 size={14} />
                    <span><strong>PKR {(totalDisposedValue / 1000).toFixed(1)}K</strong> Estimated Value</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                    <Calendar size={14} />
                    <span>
                        <strong>{records[0]?.created_at ? new Date(records[0].created_at).toLocaleDateString('en-PK') : '-'}</strong> Latest Post
                    </span>
                </div>
            </div>

            <div className={styles.filterBar}>
                <Filter size={14} />
                {(['all', 'today', 'week', 'month'] as DateFilter[]).map((option) => (
                    <button
                        key={option}
                        className={`${styles.filterChip} ${filter === option ? styles.filterChipActive : ''}`}
                        onClick={() => setFilter(option)}
                    >
                        {FILTER_LABELS[option]}
                        <span className={styles.filterCount}>
                            {countForFilter(option)}
                        </span>
                    </button>
                ))}
            </div>

            <div className={styles.recordsList}>
                {!loading && filtered.length === 0 && (
                    <div className={styles.empty}>
                        <FileCheck2 size={32} />
                        <p>No wastage ledger entries match this filter.</p>
                    </div>
                )}

                {loading && (
                    <div className={styles.empty}>
                        <Clock size={32} />
                        <p>Loading wastage posting history...</p>
                    </div>
                )}

                {filtered.map((record) => {
                    const isExpanded = expandedId === record.id;
                    const totalVal = Math.abs(Number(record.quantity || 0)) * Number(record.unit_cost || 0);
                    const highValue = totalVal >= HIGH_VALUE_WASTAGE_THRESHOLD;
                    return (
                        <div key={record.id} className={`${styles.recordCard} ${isExpanded ? styles.recordCardOpen : ''}`}>
                            <div
                                className={styles.recordHeader}
                                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                            >
                                <div className={styles.recordHeaderLeft}>
                                    <span className={styles.recordRef}>WST-{String(record.id).padStart(6, '0')}</span>
                                    <span className={`${styles.statusBadge} ${styles.badgeApproved}`}>
                                        Posted
                                    </span>
                                    {highValue ? <span className={`${styles.statusBadge} ${styles.badgeEscalated}`}>High Value</span> : null}
                                </div>
                                <div className={styles.recordHeaderMeta}>
                                    <span className={styles.metaChip}>
                                        <User size={11} /> {record.item?.item_name || `Item #${record.item_id}`}
                                    </span>
                                    <span className={styles.metaChip}>
                                        <Calendar size={11} /> {new Date(record.created_at).toLocaleString('en-PK')}
                                    </span>
                                    <span className={styles.metaChip}>
                                        <Package size={11} /> {Math.abs(Number(record.quantity || 0)).toFixed(2)} {record.item?.uom_base || ''}
                                    </span>
                                    <span className={styles.valueChip}>
                                        PKR {totalVal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={styles.recordDetail}>
                                    <div className={styles.submittedInfo}>
                                        <span>Reason: <strong>{record.reference_id || 'WASTAGE'}</strong></span>
                                        <span>Branch: <strong>{branchId || '-'}</strong></span>
                                        <span>Posted At: <strong>{new Date(record.created_at).toLocaleString('en-PK')}</strong></span>
                                    </div>

                                    <div className={styles.itemsTable}>
                                        <div className={styles.itemsHead}>
                                            <span style={{ flex: 1 }}>Item</span>
                                            <span style={{ width: '110px' }}>Quantity</span>
                                            <span style={{ width: '170px' }}>Reason</span>
                                            <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                                            <span style={{ width: '110px', textAlign: 'right' }}>Value</span>
                                        </div>
                                        <div className={styles.itemRow}>
                                            <span style={{ flex: 1 }} className={styles.itemName}>
                                                {record.item?.item_name || `Item #${record.item_id}`}
                                            </span>
                                            <span style={{ width: '110px' }} className={styles.itemQty}>
                                                {Math.abs(Number(record.quantity || 0)).toFixed(2)} {record.item?.uom_base || ''}
                                            </span>
                                            <span style={{ width: '170px' }} className={styles.itemReason}>
                                                {record.reference_id || 'WASTAGE'}
                                            </span>
                                            <span style={{ width: '110px', textAlign: 'right' }} className={styles.itemValue}>
                                                PKR {Number(record.unit_cost || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span style={{ width: '110px', textAlign: 'right' }} className={styles.itemValue}>
                                                PKR {totalVal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className={styles.itemsTotal}>
                                            <span>Ledger Movement</span>
                                            <strong>{Number(record.quantity || 0).toFixed(2)}</strong>
                                        </div>
                                    </div>

                                    <div className={styles.approvedNote}>
                                        <CheckCircle2 size={14} />
                                        <span>
                                            This wastage entry was posted directly into stock ledger and stock levels. High-value entries require wastage approval authority at posting time even though there is no separate approval queue in this batch.
                                        </span>
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
