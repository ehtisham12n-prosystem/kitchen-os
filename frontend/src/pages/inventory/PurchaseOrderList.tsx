import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ChevronRight, DollarSign, FileText, Plus, Search, Store } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import styles from './PurchaseOrderList.module.css';
import { inventoryApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';

export function PurchaseOrderList() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const {
        canViewPurchaseOrders,
        canManagePurchaseOrders,
        canReceiveInventory,
    } = usePermissionAccess();
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const pageSize = 20;
    const deferredSearch = useDeferredValue(searchTerm.trim());
    const formatVisiblePurchaseOrderNumber = (po: any) =>
        formatConfiguredPurchaseOrderNumber(po?.po_number || `PO-${po?.id}`, activeBranch || po, { preserveTypePrefix: true })
        || po?.po_number
        || `PO-${po?.id}`;

    useEffect(() => {
        const loadPurchaseOrders = async () => {
            setLoading(true);
            try {
                const data = await inventoryApi.getPurchaseOrdersPage({
                    search: deferredSearch || undefined,
                    limit: pageSize,
                    offset: page * pageSize,
                });
                setPurchaseOrders(data.items ?? []);
                setTotal(data.total ?? 0);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load purchase orders.');
            } finally {
                setLoading(false);
            }
        };

        void loadPurchaseOrders();
    }, [deferredSearch, page]);

    useEffect(() => {
        setPage(0);
    }, [deferredSearch]);

    const filtered = useMemo(() => purchaseOrders, [purchaseOrders]);
    const pendingApprovals = purchaseOrders.filter((po) => po.approval_status === 'pending').length;
    const receivingQueue = purchaseOrders.filter((po) => po.workflow?.awaiting_receipt).length;
    const pendingBills = purchaseOrders.filter((po) => Number(po.billing_summary?.pending_bill_amount || 0) > 0).length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (!canViewPurchaseOrders) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div>
                        <h1>Purchase Orders</h1>
                        <p>Your current branch role does not include procurement access.</p>
                    </div>
                </header>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Purchase Orders</h1>
                    <p>Manage branch procurement, branch requisitions, and central buying with clear destination and approval visibility.</p>
                </div>
                <KitchenButton variant="primary" onClick={() => navigate('/console/purchase-orders/new')} disabled={!canManagePurchaseOrders}>
                    <Plus size={20} style={{ marginRight: '8px' }} />
                    Create PO
                </KitchenButton>
            </header>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filters}>
                    <KitchenInput
                        placeholder="Search PO number, vendor, or branch..."
                        icon={<Search size={20} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        containerClassName={styles.searchBar}
                    />
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Page Pending Approval</span>
                            <span className={styles.statValue}>{pendingApprovals}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Page Active Queue</span>
                            <span className={styles.statValue}>{receivingQueue}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Page Pending Bills</span>
                            <span className={styles.statValue}>{pendingBills}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Total Rows</span>
                            <span className={styles.statValue}>{total}</span>
                        </div>
                    </div>
                </div>
            </KitchenCard>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>PO Number</th>
                            <th>Route</th>
                            <th>Vendor</th>
                            <th>Outstanding</th>
                            <th>Payables</th>
                            <th>Approval</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Loading purchase orders...</td>
                            </tr>
                        ) : filtered.map((po) => (
                            <tr key={po.id} className={styles.row}>
                                <td className={styles.poNumber}>
                                    <FileText size={16} />
                                    <div>
                                        <span>{formatVisiblePurchaseOrderNumber(po)}</span>
                                        <small>{(po.procurement_context || po.procurement_mode || 'branch direct').replace(/_/g, ' ')}</small>
                                    </div>
                                </td>
                                <td className={styles.routeCell}>
                                    <div>
                                        <strong>{po.branch?.branch_name || 'Unknown'}</strong>
                                        <small>{po.destination_branch?.branch_name || po.branch?.branch_name || 'Unknown destination'}</small>
                                        <small>{po.receipt_route === 'vendor_to_central' ? 'Vendor to central' : 'Vendor direct to branch'}</small>
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.vendorCell}>
                                        <Store size={16} />
                                        {po.vendor?.vendor_name || 'Unassigned Vendor'}
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.routeCell}>
                                        <div>
                                            <strong>{Number(po.summary?.remaining_quantity_total || 0).toFixed(2)} units remaining</strong>
                                            <small>{Number(po.summary?.received_quantity_total || 0).toFixed(2)} received / {Number(po.summary?.quantity_total || 0).toFixed(2)} ordered</small>
                                            <small>{Number(po.summary?.grn_count || 0)} GRN(s) | {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'No ETA'}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.costCell}>
                                        <DollarSign size={16} />
                                        <div>
                                            <span>{Number(po.billing_summary?.pending_bill_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>
                                                accrued {Number(po.billing_summary?.accrued_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | refs {Number(po.billing_summary?.bill_reference_count || 0)}
                                            </small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[`approval_${String(po.approval_status || '').toLowerCase()}`] || ''}`}>
                                        <CheckSquare size={12} />
                                        {po.approval_status} / {po.approval_scope || 'branch'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[String(po.status || '').toLowerCase()] || ''}`}>
                                        {po.status}
                                    </span>
                                </td>
                                <td>
                                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`/console/purchase-orders/${po.id}`)}>
                                        <ChevronRight size={18} />
                                    </KitchenButton>
                                    {canReceiveInventory && po.workflow?.awaiting_receipt && (
                                        <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`/console/inventory/grn/new?poId=${po.id}`)}>
                                            Receive
                                        </KitchenButton>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>No purchase orders found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.paginationBar}>
                <span className={styles.pageInfo}>
                    Showing {total === 0 ? 0 : page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className={styles.pageControls}>
                    <button className={styles.pageBtn} disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
                    <span className={styles.pageInfo}>Page {Math.min(page + 1, totalPages)} of {totalPages}</span>
                    <button className={styles.pageBtn} disabled={page >= totalPages - 1 || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
                </div>
            </div>
        </div>
    );
}
