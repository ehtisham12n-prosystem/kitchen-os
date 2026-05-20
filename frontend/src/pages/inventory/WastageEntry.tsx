import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingDown, Clock, Search, Eye, Package, FileCheck2, ArrowRight } from 'lucide-react';
import styles from './WastageEntry.module.css';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

export function WastageEntry() {
    const navigate = useNavigate();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (!branchId) {
                    setRows([]);
                    return;
                }
                const ledger = await inventoryApi.getLedger(branchId, {
                    transactionType: 'wastage',
                    limit: 250,
                });
                setRows(ledger);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load wastage entries.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [branchId]);

    const filtered = useMemo(() => {
        const term = search.toLowerCase();
        return rows.filter((row) =>
            String(row.item?.item_name || '').toLowerCase().includes(term)
            || String(row.reference_id || '').toLowerCase().includes(term),
        );
    }, [rows, search]);

    const totalValue = filtered.reduce((sum, row) => sum + Math.abs(Number(row.quantity || 0)) * Number(row.unit_cost || 0), 0);
    const todayCount = rows.filter((row) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        if (!createdAt) {
            return false;
        }

        const today = new Date();
        return createdAt.toDateString() === today.toDateString();
    }).length;

    return (
        <div className={styles.listContainer}>
            <div className={styles.listHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.titleRow}>
                        <div className={styles.titleIconWrap}>
                            <TrendingDown size={20} />
                        </div>
                        <div>
                            <h1 className={styles.pageTitle}>Disposal Management</h1>
                            <p className={styles.pageSubtitle}>Live wastage and damage postings from the stock ledger.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.approvalBtn} onClick={() => navigate('/console/inventory/wastage/approval')}>
                        <FileCheck2 size={15} />
                        Posting Log
                    </button>
                    <button className={styles.newEntryBtn} onClick={() => navigate('/console/inventory/wastage/new')}>
                        <Plus size={16} />
                        New Disposal Entry
                    </button>
                </div>
            </div>

            <div className={styles.alertBanner}>
                <Clock size={16} />
                <span>
                    Wastage is posted immediately to <strong>inventory_stock_ledger</strong> and synced into current stock levels. This batch does not maintain a separate pending approval queue.
                </span>
                <button className={styles.alertLink} onClick={() => navigate('/console/inventory/wastage/approval')}>
                    Review ledger log
                    <ArrowRight size={14} />
                </button>
            </div>

            <div className={styles.statGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Posted Entries</div>
                        <div className={styles.statValue}>{rows.length}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Displayed Value</div>
                        <div className={styles.statValue}>PKR {totalValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Posted Today</div>
                        <div className={styles.statValue}>{todayCount}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <div className={styles.statLabel}>Posting Model</div>
                        <div className={styles.statValue}>Immediate</div>
                    </div>
                </div>
            </div>

            <div className={styles.listCard}>
                <div className={styles.listCardHeader}>
                    <div className={styles.listCardTitle}>
                        <TrendingDown size={16} />
                        Disposal Records
                    </div>
                    <div className={styles.listControls}>
                        <div className={styles.searchWrap}>
                            <Search size={14} />
                            <input
                                className={styles.searchInput}
                                placeholder="Search by item or reason..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.tableHead}>
                    <span style={{ width: '150px' }}>Posted At</span>
                    <span style={{ flex: 1 }}>Item</span>
                    <span style={{ width: '140px' }}>Reason</span>
                    <span style={{ width: '110px' }}>Quantity</span>
                    <span style={{ width: '120px', textAlign: 'right' }}>Value</span>
                    <span style={{ width: '80px', textAlign: 'center' }}>View</span>
                </div>

                {loading ? (
                    <div className={styles.emptyState}>
                        <Clock size={32} />
                        <p>Loading disposal records...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Package size={32} />
                        <p>No disposal records match your search</p>
                    </div>
                ) : filtered.map((record) => (
                    <div key={record.id} className={styles.tableRow}>
                        <span style={{ width: '150px' }} className={styles.dateCell}>
                            {new Date(record.created_at).toLocaleString('en-PK')}
                        </span>
                        <div style={{ flex: 1 }} className={styles.reasonCell}>
                            {record.item?.item_name || `Item #${record.item_id}`}
                        </div>
                        <span style={{ width: '140px' }} className={styles.storeTag}>
                            {record.reference_id || 'WASTAGE'}
                        </span>
                        <span style={{ width: '110px' }} className={styles.reporterCell}>
                            {Math.abs(Number(record.quantity || 0)).toFixed(2)} {record.item?.uom_base || ''}
                        </span>
                        <span style={{ width: '120px', textAlign: 'right' }} className={styles.valueCell}>
                            PKR {(Math.abs(Number(record.quantity || 0)) * Number(record.unit_cost || 0)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                            <button className={styles.viewBtn} onClick={() => navigate('/console/inventory/wastage/approval')}>
                                <Eye size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
