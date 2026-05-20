/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRightLeft,
    ChefHat,
    Clock3,
    Eye,
    Factory,
    Loader2,
    PackageCheck,
    Plus,
    Search,
    Send,
} from 'lucide-react';
import { productionApi, branchApi, resolveActiveBranchId } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ProductionOrderList.module.css';

type ProductionOrderRecord = {
    id: number;
    production_no?: string | null;
    status: string;
    flow_label: string;
    is_cross_branch: boolean;
    planned_quantity: number;
    actual_quantity?: number | null;
    production_date?: string | null;
    planned_batch_count?: number | null;
    actual_batch_count?: number | null;
    wastage_quantity?: number | null;
    yield_percentage?: number | null;
    materials_issued?: boolean;
    output_stage_label?: string | null;
    requested_at?: string;
    source_branch_id: number;
    destination_branch_id: number;
    source_unit_label?: string | null;
    destination_unit_label?: string | null;
    notes?: string | null;
    product?: {
        id: number;
        product_name: string;
        product_sku?: string | null;
    } | null;
    prepared_item?: {
        id: number;
        item_name: string;
        uom_base?: string | null;
    } | null;
    linked_transfer?: {
        id: number;
        transfer_no: string;
        status: string;
    } | null;
    material_summary?: {
        line_count: number;
        total_issued_quantity: number;
    } | null;
    batch_summary?: {
        planned_batch_count: number;
        completed_batch_count: number;
    } | null;
    available_actions: string[];
};

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'requested', label: 'Requested' },
    { value: 'queued', label: 'Queued' },
    { value: 'in_preparation', label: 'In Preparation' },
    { value: 'prepared', label: 'Prepared' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'received', label: 'Received' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
];

function formatDateTime(value?: string | null) {
    if (!value) return 'Pending';
    return new Date(value).toLocaleString();
}

function formatQty(value?: number | null) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 4 });
}

function getStatusTone(status: string) {
    switch (status) {
        case 'requested':
            return styles.badgeRequested;
        case 'queued':
            return styles.badgeQueued;
        case 'in_preparation':
            return styles.badgeInPreparation;
        case 'prepared':
            return styles.badgePrepared;
        case 'dispatched':
            return styles.badgeDispatched;
        case 'received':
            return styles.badgeReceived;
        case 'rejected':
            return styles.badgeRejected;
        case 'cancelled':
            return styles.badgeCancelled;
        default:
            return styles.badgeNeutral;
    }
}

function toTitleCase(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ProductionOrderList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [orders, setOrders] = useState<ProductionOrderRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const loadBranches = async () => {
            try {
                const branchData = await branchApi.getBranches();
                const activeBranchId = resolveActiveBranchId();
                setBranches(branchData);
                const defaultBranchId = activeBranchId && branchData.some((branch: any) => String(branch.id) === activeBranchId)
                    ? activeBranchId
                    : branchData[0]?.id
                        ? String(branchData[0].id)
                        : '';
                setSelectedBranch(defaultBranchId);
            } catch (error) {
                console.error('Failed to load production branches', error);
                toast.error('Load Failed', 'Could not load branch options.');
            }
        };

        loadBranches();
    }, []);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const branchId = selectedBranch ? Number(selectedBranch) : undefined;
            const data = await productionApi.getOrders({
                branch_id: branchId,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                scope: 'all',
            });
            setOrders(data);
        } catch (error: any) {
            console.error('Failed to fetch production orders', error);
            toast.error('Load Failed', error.message || 'Could not load production requests.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranch, selectedStatus]);

    useEffect(() => {
        if (!selectedBranch) return;
        void fetchOrders();
    }, [fetchOrders, selectedBranch]);

    const summary = useMemo(() => ({
        requested: orders.filter((order) => ['requested', 'queued'].includes(order.status)).length,
        active: orders.filter((order) => ['in_preparation', 'prepared', 'dispatched'].includes(order.status)).length,
        completed: orders.filter((order) => ['received', 'prepared'].includes(order.status)).length,
        crossBranch: orders.filter((order) => order.is_cross_branch).length,
    }), [orders]);

    const filteredOrders = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) {
            return orders;
        }

        return orders.filter((order) => {
            const haystack = [
                order.id,
                order.production_no,
                order.status,
                order.flow_label,
                order.product?.product_name,
                order.product?.product_sku,
                order.prepared_item?.item_name,
                order.source_unit_label,
                order.destination_unit_label,
                order.linked_transfer?.transfer_no,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(needle);
        });
    }, [orders, searchTerm]);

    const goToDetail = (order: ProductionOrderRecord, branchId?: number) => {
        const query = branchId ? `?branch_id=${branchId}` : '';
        navigate(`/console/production/${order.id}${query}`);
    };

    const handleAction = async (order: ProductionOrderRecord, action: string) => {
        const actionKey = `${order.id}:${action}`;
        const sourceBranchId = order.source_branch_id;
        const destinationBranchId = order.destination_branch_id;

        try {
            setIsActionLoading(actionKey);

            if (action === 'queue') {
                const notes = window.prompt('Queue notes (optional):', '') ?? undefined;
                await productionApi.queueOrder(order.id, { notes }, sourceBranchId);
            } else if (action === 'issue') {
                const notes = window.prompt('Issue notes (optional):', '') ?? undefined;
                await productionApi.issueOrder(order.id, { notes }, sourceBranchId);
            } else if (action === 'reject') {
                const notes = window.prompt('Reason for rejection (optional):', '') ?? undefined;
                if (notes === undefined) {
                    return;
                }
                await productionApi.rejectOrder(order.id, { notes }, sourceBranchId);
            } else if (action === 'cancel') {
                const notes = window.prompt('Cancellation notes (optional):', '') ?? undefined;
                if (notes === undefined) {
                    return;
                }
                await productionApi.cancelOrder(order.id, { notes }, sourceBranchId);
            } else if (action === 'start') {
                await productionApi.startOrder(order.id, sourceBranchId);
            } else if (action === 'complete') {
                const quantityInput = window.prompt(
                    'Prepared quantity:',
                    String(order.actual_quantity || order.planned_quantity || 0),
                );
                if (quantityInput === null) {
                    return;
                }
                const actualQuantity = Number(quantityInput);
                if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
                    toast.error('Invalid Quantity', 'Enter a prepared quantity greater than zero.');
                    return;
                }
                const notes = window.prompt('Completion notes (optional):', '') ?? undefined;
                await productionApi.completeOrder(order.id, { actual_quantity: actualQuantity, notes }, sourceBranchId);
            } else if (action === 'dispatch') {
                goToDetail(order, sourceBranchId);
                return;
            } else if (action === 'receive') {
                goToDetail(order, destinationBranchId);
                return;
            }

            await fetchOrders();
            toast.success('Updated', `Production order #${order.id} updated successfully.`);
        } catch (error: any) {
            console.error(`Failed to ${action} production order`, error);
            toast.error('Action Failed', error.message || 'Could not update the production order.');
        } finally {
            setIsActionLoading(null);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Kitchen Production Flow</h1>
                    <p>Track kitchen requests, preparation, dispatch, and branch acknowledgment without duplicating stock logic.</p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenSelect
                        options={(branches.length
                            ? branches
                            : [{ value: '', label: 'No branches available' }]).map((branch: any) => ({
                            value: String(branch.id),
                            label: branch.branch_name,
                        }))}
                        value={selectedBranch}
                        onChange={(event) => setSelectedBranch(event.target.value)}
                        className={styles.branchSelect}
                    />
                    <KitchenButton
                        variant="primary"
                        onClick={() => navigate(`/console/production/new${selectedBranch ? `?source_branch_id=${selectedBranch}` : ''}`)}
                    >
                        <Plus size={18} style={{ marginRight: 8 }} />
                        New Kitchen Request
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.summaryGrid}>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Open Requests</span>
                    <strong>{summary.requested}</strong>
                    <small>Requested or queued</small>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Active Prep</span>
                    <strong>{summary.active}</strong>
                    <small>In preparation, prepared, or dispatched</small>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Prepared / Closed</span>
                    <strong>{summary.completed}</strong>
                    <small>Prepared locally or received by destination</small>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Cross-Branch Flow</span>
                    <strong>{summary.crossBranch}</strong>
                    <small>Requests moving between source and destination units</small>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filters}>
                    <KitchenInput
                        placeholder="Search by order, product, unit, or transfer..."
                        icon={<Search size={18} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        containerClassName={styles.searchBar}
                    />
                    <KitchenSelect
                        options={STATUS_OPTIONS}
                        value={selectedStatus}
                        onChange={(event) => setSelectedStatus(event.target.value)}
                        className={styles.statusSelect}
                    />
                </div>
            </KitchenCard>

            <div className={styles.grid}>
                {isLoading ? (
                    <KitchenCard className={styles.stateCard}>
                        <Loader2 className={styles.spinner} />
                        <p>Loading kitchen requests...</p>
                    </KitchenCard>
                ) : filteredOrders.length === 0 ? (
                    <KitchenCard className={styles.stateCard}>
                        <Clock3 size={24} />
                        <p>No production requests matched this branch and filter.</p>
                    </KitchenCard>
                ) : filteredOrders.map((order) => (
                    <KitchenCard key={order.id} className={styles.orderCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderLeft}>
                                <div className={styles.iconWrap}>
                                    {order.is_cross_branch ? <ArrowRightLeft size={18} /> : <ChefHat size={18} />}
                                </div>
                                <div>
                                    <h3>{order.production_no || `Request #${order.id}`}</h3>
                                    <span className={styles.subtle}>{order.flow_label}</span>
                                </div>
                            </div>
                            <span className={`${styles.badge} ${getStatusTone(order.status)}`}>
                                {toTitleCase(order.status)}
                            </span>
                        </div>

                        <div className={styles.cardBody}>
                            <div className={styles.primaryRow}>
                                <div>
                                    <h4>{order.product?.product_name || 'Unlinked Product'}</h4>
                                    <p>{order.product?.product_sku || 'No SKU provided'}</p>
                                </div>
                                <div className={styles.qtyPill}>
                                    <span>Planned</span>
                                    <strong>{formatQty(order.planned_quantity)}</strong>
                                </div>
                            </div>

                            <div className={styles.routeBox}>
                                <div>
                                    <span className={styles.routeLabel}>Source Unit</span>
                                    <strong>{order.source_unit_label || 'Source branch'}</strong>
                                </div>
                                <Send size={16} />
                                <div>
                                    <span className={styles.routeLabel}>Destination Unit</span>
                                    <strong>{order.destination_unit_label || 'Destination branch'}</strong>
                                </div>
                            </div>

                            <div className={styles.metaGrid}>
                                <div className={styles.metaBox}>
                                    <span>Production Date</span>
                                    <strong>{order.production_date ? new Date(order.production_date).toLocaleDateString() : 'Not set'}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Requested</span>
                                    <strong>{formatDateTime(order.requested_at)}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Prepared Qty</span>
                                    <strong>{order.actual_quantity ? formatQty(order.actual_quantity) : 'Pending'}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Yield / Waste</span>
                                    <strong>{order.yield_percentage ? `${Number(order.yield_percentage).toLocaleString('en-PK', { maximumFractionDigits: 2 })}%` : 'Pending'}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Materials</span>
                                    <strong>{order.materials_issued ? 'Issued' : 'Pending Issue'}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Batches</span>
                                    <strong>{order.actual_batch_count || order.batch_summary?.completed_batch_count || 0} / {order.planned_batch_count || order.batch_summary?.planned_batch_count || 1}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Prepared Item</span>
                                    <strong>{order.prepared_item?.item_name || order.output_stage_label || 'Not linked yet'}</strong>
                                </div>
                                <div className={styles.metaBox}>
                                    <span>Dispatch Ref</span>
                                    <strong>{order.linked_transfer?.transfer_no || 'Not dispatched'}</strong>
                                </div>
                            </div>

                            {order.notes ? (
                                <div className={styles.noteBox}>
                                    <Factory size={16} />
                                    <span>{order.notes}</span>
                                </div>
                            ) : null}
                        </div>

                        <div className={styles.cardFooter}>
                            <KitchenButton
                                variant="ghost"
                                size="sm"
                                onClick={() => goToDetail(order, order.source_branch_id)}
                            >
                                <Eye size={16} style={{ marginRight: 6 }} />
                                Open
                            </KitchenButton>

                            {order.available_actions.includes('queue') ? (
                                <KitchenButton
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => handleAction(order, 'queue')}
                                    isLoading={isActionLoading === `${order.id}:queue`}
                                >
                                    Queue
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('issue') ? (
                                <KitchenButton
                                    variant="outline-info"
                                    size="sm"
                                    onClick={() => handleAction(order, 'issue')}
                                    isLoading={isActionLoading === `${order.id}:issue`}
                                >
                                    Issue Materials
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('start') ? (
                                <KitchenButton
                                    variant="outline-info"
                                    size="sm"
                                    onClick={() => handleAction(order, 'start')}
                                    isLoading={isActionLoading === `${order.id}:start`}
                                >
                                    Start
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('complete') ? (
                                <KitchenButton
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => handleAction(order, 'complete')}
                                    isLoading={isActionLoading === `${order.id}:complete`}
                                >
                                    <PackageCheck size={16} style={{ marginRight: 6 }} />
                                    Prepare
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('dispatch') ? (
                                <KitchenButton
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => handleAction(order, 'dispatch')}
                                >
                                    Dispatch
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('receive') ? (
                                <KitchenButton
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => handleAction(order, 'receive')}
                                >
                                    Receive
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('reject') ? (
                                <KitchenButton
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleAction(order, 'reject')}
                                    isLoading={isActionLoading === `${order.id}:reject`}
                                >
                                    Reject
                                </KitchenButton>
                            ) : null}

                            {order.available_actions.includes('cancel') ? (
                                <KitchenButton
                                    variant="outline-dark"
                                    size="sm"
                                    onClick={() => handleAction(order, 'cancel')}
                                    isLoading={isActionLoading === `${order.id}:cancel`}
                                >
                                    Cancel
                                </KitchenButton>
                            ) : null}
                        </div>
                    </KitchenCard>
                ))}
            </div>
        </div>
    );
}
