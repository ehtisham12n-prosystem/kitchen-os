/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    ClipboardList,
    Info,
    RefreshCw,
    ShoppingCart,
    Store,
} from 'lucide-react';
import styles from './DemandPlanning.module.css';
import { analyticsApi, inventoryApi, resolveActiveBranchId, vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

interface DemandItem {
    id: number;
    item_name: string;
    item_sku?: string | null;
    uom_base?: string | null;
    current_stock: number;
    min_level: number;
    max_level: number;
    suggestedQty: number;
    selected: boolean;
    urgency?: 'critical' | 'high' | 'medium' | 'stable';
    daysOfCover?: number | null;
    avgDailyOutbound?: number;
    explanation?: string;
}

interface BranchOption {
    id: number;
    branch_name: string;
    inventory_store_type?: 'branch' | 'central';
}

export function DemandPlanning() {
    const navigate = useNavigate();
    const activeBranchId = Number(resolveActiveBranchId() || 0);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [items, setItems] = useState<DemandItem[]>([]);
    const [recommendationSummary, setRecommendationSummary] = useState({
        actionable_reorders: 0,
        critical_reorders: 0,
        slow_movers: 0,
    });
    const [requestingBranchId, setRequestingBranchId] = useState<number>(activeBranchId);
    const [destinationBranchId, setDestinationBranchId] = useState<number>(activeBranchId);
    const [preferredVendorId, setPreferredVendorId] = useState<number>(0);
    const [procurementMode, setProcurementMode] = useState<'branch_direct' | 'central_procurement' | 'hybrid'>('branch_direct');
    const [procurementContext, setProcurementContext] = useState<'branch_procurement' | 'branch_requisition' | 'central_procurement'>('branch_procurement');
    const [approvalScope, setApprovalScope] = useState<'branch' | 'central'>('branch');
    const [priority, setPriority] = useState<'routine' | 'urgent' | 'critical'>('routine');
    const [notes, setNotes] = useState('');
    const [selectedOnly, setSelectedOnly] = useState(false);

    const loadRequests = useCallback(async () => {
        const data = await inventoryApi.getProcurementRequests();
        setRequests(data);
    }, []);

    const loadBranchItems = useCallback(async (branchId: number) => {
        if (!branchId) {
            setItems([]);
            setRecommendationSummary({
                actionable_reorders: 0,
                critical_reorders: 0,
                slow_movers: 0,
            });
            return;
        }

        const result = await analyticsApi.getReorderRecommendations(branchId);
        setRecommendationSummary({
            actionable_reorders: Number(result?.summary?.actionable_reorders || 0),
            critical_reorders: Number(result?.summary?.critical_reorders || 0),
            slow_movers: Number(result?.summary?.slow_movers || 0),
        });

        const mapped = (result?.items || [])
            .map((item: any) => ({
                id: Number(item.item_id),
                item_name: item.item_name,
                item_sku: item.item_sku,
                uom_base: item.uom_base,
                current_stock: Number(item.current_quantity || 0),
                min_level: Number(item.min_stock_level || 0),
                max_level: Number(item.max_stock_level || 0),
                suggestedQty: Number(item.suggested_reorder_quantity || 0),
                selected: Number(item.suggested_reorder_quantity || 0) > 0,
                urgency: item.urgency,
                daysOfCover: item.days_of_cover ?? null,
                avgDailyOutbound: Number(item.avg_daily_outbound || 0),
                explanation: item.explanation,
            }))
            .sort((left: DemandItem, right: DemandItem) => {
                const urgencyWeight = { critical: 4, high: 3, medium: 2, stable: 1 };
                const urgencyDelta = (urgencyWeight[right.urgency || 'stable'] || 0) - (urgencyWeight[left.urgency || 'stable'] || 0);
                if (urgencyDelta !== 0) {
                    return urgencyDelta;
                }
                return Number(right.suggestedQty || 0) - Number(left.suggestedQty || 0);
            });

        setItems(mapped);
    }, []);

    const loadPage = useCallback(async () => {
        setLoading(true);
        try {
            const [branchRows, vendorRows] = await Promise.all([
                inventoryApi.getTransferBranchOptions(),
                vendorApi.getVendors(),
            ]);
            setBranches(branchRows);
            setVendors(vendorRows);

            const resolvedRequestingBranchId = activeBranchId || branchRows[0]?.id || 0;
            setRequestingBranchId((current) => current || resolvedRequestingBranchId);
            setDestinationBranchId((current) => current || resolvedRequestingBranchId);

            await Promise.all([
                loadBranchItems(activeBranchId || branchRows[0]?.id || 0),
                loadRequests(),
            ]);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load demand planning data.');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId, loadBranchItems, loadRequests]);

    useEffect(() => {
        void loadPage();
    }, [loadPage]);

    useEffect(() => {
        if (!destinationBranchId) {
            return;
        }
        void loadBranchItems(destinationBranchId);
    }, [destinationBranchId, loadBranchItems]);

    useEffect(() => {
        if (!requestingBranchId || !destinationBranchId) {
            return;
        }
        const requestingBranch = branches.find((branch) => branch.id === requestingBranchId);
        const nextContext = requestingBranch?.inventory_store_type === 'central'
            ? 'central_procurement'
            : requestingBranchId === destinationBranchId
                ? 'branch_procurement'
                : 'branch_requisition';

        setProcurementContext(nextContext);
    }, [branches, requestingBranchId, destinationBranchId]);

    useEffect(() => {
        setApprovalScope(procurementContext === 'branch_procurement' ? 'branch' : 'central');
        setProcurementMode(procurementContext === 'branch_procurement' ? 'branch_direct' : 'central_procurement');
    }, [procurementContext]);

    const filteredItems = useMemo(
        () => selectedOnly ? items.filter((item) => item.selected) : items,
        [items, selectedOnly],
    );

    const selectedItems = useMemo(
        () => items.filter((item) => item.selected && Number(item.suggestedQty) > 0),
        [items],
    );

    const pendingRequests = requests.filter((request) => request.status === 'pending').length;
    const destinationBranch = branches.find((branch) => branch.id === destinationBranchId);
    const requestingBranch = branches.find((branch) => branch.id === requestingBranchId);
    const receiptRouteLabel = destinationBranch?.inventory_store_type === 'central'
        ? 'Vendor to central store'
        : 'Vendor direct to branch';
    const contextLabel = procurementContext === 'branch_procurement'
        ? 'Branch procurement'
        : procurementContext === 'branch_requisition'
            ? 'Branch requisition to central procurement'
            : 'Central procurement';

    const updateItem = (id: number, updates: Partial<DemandItem>) => {
        setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        );
    };

    const handleCreateRequest = async () => {
        if (!requestingBranchId || !destinationBranchId) {
            toast.error('Branch Required', 'Select both requesting and destination branches.');
            return;
        }
        if (selectedItems.length === 0) {
            toast.error('No Demand Selected', 'Select at least one line with a positive quantity.');
            return;
        }

        setSaving(true);
        try {
            await inventoryApi.createProcurementRequest({
                requesting_branch_id: requestingBranchId,
                destination_branch_id: destinationBranchId,
                preferred_vendor_id: preferredVendorId || undefined,
                procurement_mode: procurementMode,
                procurement_context: procurementContext,
                approval_scope: approvalScope,
                priority,
                notes: notes || undefined,
                items: selectedItems.map((item) => ({
                    item_id: item.id,
                    requested_quantity: Number(item.suggestedQty),
                })),
            });
            toast.success('Request Created', 'The procurement request is now visible for branch and client admin review.');
            setNotes('');
            setPreferredVendorId(0);
            await loadRequests();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not create procurement request.');
        } finally {
            setSaving(false);
        }
    };

    const handleReview = async (requestId: number, status: 'approved' | 'rejected') => {
        try {
            await inventoryApi.reviewProcurementRequest(requestId, {
                status,
                notes: status === 'approved'
                    ? 'Approved for purchase order conversion.'
                    : 'Rejected during procurement review.',
            });
            toast.success('Request Updated', `Request ${status}.`);
            await loadRequests();
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Could not update the procurement request.');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <ClipboardList size={22} className={styles.titleIcon} />
                            <h1>Branch Demand & Procurement Requests</h1>
                        </div>
                        <p className={styles.subtitle}>Raise stock demand, route it for review, and convert approved requests into purchase orders.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnSecondary} onClick={() => void loadPage()}>
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/purchase-orders')}>
                        <ShoppingCart size={15} />
                        Purchase Orders
                    </button>
                </div>
            </div>

            <div className={styles.infoBar}>
                <Info size={14} className={styles.infoIcon} />
                <span>Suggested quantities now use trailing outbound stock movement, current on-hand quantity, and branch min/max levels. Recommendations stay read-only until you explicitly raise a procurement request.</span>
            </div>

            <div className={styles.summaryRow}>
                <div className={`${styles.summaryCard} ${styles.sumImmediate}`}>
                    <ClipboardList size={20} />
                    <div>
                        <span className={styles.sumVal}>{recommendationSummary.critical_reorders}</span>
                        <span className={styles.sumLabel}>Critical Reorders</span>
                    </div>
                </div>
                <div className={`${styles.summaryCard} ${styles.sumSoon}`}>
                    <Check size={20} />
                    <div>
                        <span className={styles.sumVal}>{recommendationSummary.actionable_reorders}</span>
                        <span className={styles.sumLabel}>Actionable Suggestions</span>
                    </div>
                </div>
                <div className={`${styles.summaryCard} ${styles.sumSelected}`}>
                    <Store size={20} />
                    <div>
                        <span className={styles.sumVal}>{recommendationSummary.slow_movers}</span>
                        <span className={styles.sumLabel}>Slow Movers</span>
                    </div>
                </div>
                <div className={`${styles.summaryCard} ${styles.sumCost}`}>
                    <ShoppingCart size={20} />
                    <div>
                        <span className={styles.sumVal}>{pendingRequests}</span>
                        <span className={styles.sumLabel}>Pending Requests</span>
                    </div>
                </div>
            </div>

            <div className={styles.formCard}>
                <div className={styles.formHeader}>
                    <h3>Request Context</h3>
                    <button className={styles.filterBtn} onClick={() => setSelectedOnly((current) => !current)}>
                        {selectedOnly ? 'Show All Items' : 'Selected Only'}
                    </button>
                </div>
                <div className={styles.controlsGrid}>
                    <div className={styles.fieldGroup}>
                        <label>Requesting Branch</label>
                        <select
                            className={styles.select}
                            value={requestingBranchId}
                            onChange={(event) => setRequestingBranchId(Number(event.target.value))}
                        >
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Destination Branch</label>
                        <select
                            className={styles.select}
                            value={destinationBranchId}
                            onChange={(event) => setDestinationBranchId(Number(event.target.value))}
                        >
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Procurement Mode</label>
                        <select
                            className={styles.select}
                            value={procurementMode}
                            onChange={(event) => setProcurementMode(event.target.value as typeof procurementMode)}
                        >
                            <option value="branch_direct">Branch Direct</option>
                            <option value="central_procurement">Central Procurement</option>
                            <option value="hybrid">Hybrid</option>
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Procurement Context</label>
                        <select
                            className={styles.select}
                            value={procurementContext}
                            onChange={(event) => setProcurementContext(event.target.value as typeof procurementContext)}
                        >
                            <option value="branch_procurement" disabled={requestingBranch?.inventory_store_type === 'central' || requestingBranchId !== destinationBranchId}>
                                Branch Procurement
                            </option>
                            <option value="branch_requisition" disabled={requestingBranch?.inventory_store_type === 'central'}>
                                Branch Requisition
                            </option>
                            <option value="central_procurement" disabled={requestingBranch?.inventory_store_type !== 'central'}>
                                Central Procurement
                            </option>
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Priority</label>
                        <select
                            className={styles.select}
                            value={priority}
                            onChange={(event) => setPriority(event.target.value as typeof priority)}
                        >
                            <option value="routine">Routine</option>
                            <option value="urgent">Urgent</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Approval Scope</label>
                        <input
                            className={styles.input}
                            value={approvalScope === 'central' ? 'Central Approval' : 'Branch Approval'}
                            readOnly
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Suggested Vendor</label>
                        <select
                            className={styles.select}
                            value={preferredVendorId}
                            onChange={(event) => setPreferredVendorId(Number(event.target.value))}
                        >
                            <option value={0}>No vendor selected</option>
                            {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                    {vendor.vendor_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Notes</label>
                        <input
                            className={styles.input}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Explain urgency, route, or branch context"
                        />
                    </div>
                </div>
                <div className={styles.contextBanner}>
                    <strong>Context:</strong> {contextLabel}
                    <span style={{ margin: '0 10px' }}>•</span>
                    <strong>Approval:</strong> {approvalScope === 'central' ? 'Central procurement review' : 'Branch approval'}
                    <span style={{ margin: '0 10px' }}>•</span>
                    <strong>Receipt Route:</strong> {receiptRouteLabel}
                    <span style={{ margin: '0 10px' }}>•</span>
                    <strong>Destination:</strong> {destinationBranch?.branch_name || 'Not selected'} {destinationBranch?.inventory_store_type === 'central' ? '(Central Store)' : '(Branch Store)'}
                </div>
            </div>

            <div className={styles.filterBar}>
                <span className={styles.stockLabel}>Demand Lines</span>
                <button className={styles.selectAllBtn} onClick={() => setItems((current) => current.map((item) => ({ ...item, selected: true })))}>
                    Select All
                </button>
                <button className={styles.selectAllBtn} onClick={() => setItems((current) => current.map((item) => ({ ...item, selected: false })))}>
                    Clear
                </button>
            </div>

            <div className={styles.itemList}>
                {loading ? (
                    <div className={styles.emptyState}>Loading demand lines...</div>
                ) : filteredItems.length === 0 ? (
                    <div className={styles.emptyState}>No enabled inventory items are available for the selected destination branch.</div>
                ) : filteredItems.map((item) => {
                    const shortage = Number((item.min_level - item.current_stock).toFixed(2));
                    const urgencyClass = item.urgency === 'critical'
                        ? styles.urgImmediate
                        : item.urgency === 'high'
                            ? styles.urgSoon
                            : styles.urgPlanned;
                    const urgencyLabel = item.urgency === 'critical'
                        ? 'Critical'
                        : item.urgency === 'high'
                            ? 'High'
                            : item.urgency === 'medium'
                                ? 'Planned'
                                : 'Stable';
                    return (
                        <div
                            key={item.id}
                            className={`${styles.itemCard} ${item.selected ? styles.itemSelected : ''} ${shortage > 0 ? styles.itemImmediate : ''}`}
                            onClick={() => updateItem(item.id, { selected: !item.selected })}
                        >
                            <div className={`${styles.checkbox} ${item.selected ? styles.checkboxChecked : ''}`}>
                                {item.selected && <Check size={13} />}
                            </div>
                            <div className={styles.itemInfo}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemCode}>{item.item_sku || `ITEM-${item.id}`}</span>
                                    <span className={styles.itemName}>{item.item_name}</span>
                                    <span className={`${styles.urgencyTag} ${urgencyClass}`}>
                                        {urgencyLabel}
                                    </span>
                                </div>
                                <div className={styles.itemReason}>
                                    Current {item.current_stock} {item.uom_base || ''} vs minimum {item.min_level} {item.uom_base || ''}
                                </div>
                                <div className={styles.itemReason}>
                                    {item.explanation || 'Recommendation derived from recent branch stock movement and current inventory thresholds.'}
                                </div>
                            </div>
                            <div className={styles.stockInfo}>
                                <span className={styles.stockLabel}>Current</span>
                                <span className={`${styles.stockVal} ${shortage > 0 ? styles.stockCritical : ''}`}>
                                    {item.current_stock}
                                </span>
                                <span className={styles.stockSub}>{item.uom_base || 'units'}</span>
                            </div>
                            <div className={styles.stockInfo}>
                                <span className={styles.stockLabel}>Minimum</span>
                                <span className={styles.stockVal}>{item.min_level}</span>
                                <span className={styles.stockSub}>{item.max_level > 0 ? `Max ${item.max_level}` : 'No max set'}</span>
                            </div>
                            <div className={styles.stockInfo}>
                                <span className={styles.stockLabel}>Demand Basis</span>
                                <span className={styles.stockVal}>{Number(item.avgDailyOutbound || 0).toFixed(2)}</span>
                                <span className={styles.stockSub}>
                                    {item.daysOfCover !== null && item.daysOfCover !== undefined
                                        ? `${item.daysOfCover} days cover`
                                        : 'No recent usage'}
                                </span>
                            </div>
                            <div className={styles.qtyInfo} onClick={(event) => event.stopPropagation()}>
                                <span className={styles.stockLabel}>Requested Qty</span>
                                <div className={styles.qtyInput}>
                                    <input
                                        type="number"
                                        min={0}
                                        className={styles.qtyField}
                                        value={item.suggestedQty}
                                        onChange={(event) => updateItem(item.id, { suggestedQty: Number(event.target.value || 0), selected: true })}
                                    />
                                    <span className={styles.qtyUnit}>{item.uom_base || 'units'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={styles.requestSection}>
                <div className={styles.formHeader}>
                    <h3>Request Queue</h3>
                    <span className={styles.stockSub}>{requests.length} requests visible in your branch scope</span>
                </div>
                <div className={styles.requestList}>
                    {requests.length === 0 ? (
                        <div className={styles.emptyState}>No procurement requests have been raised yet.</div>
                    ) : requests.map((request) => (
                        <div key={request.id} className={styles.requestCard}>
                            <div className={styles.requestMeta}>
                                <div>
                                    <strong>{request.request_no}</strong>
                                    <small>
                                        {request.requesting_branch?.branch_name || 'Unknown branch'} to {request.destination_branch?.branch_name || 'Unknown branch'}
                                    </small>
                                </div>
                                <span className={`${styles.urgencyTag} ${request.status === 'approved' ? styles.urgSoon : request.status === 'converted' ? styles.urgPlanned : request.status === 'rejected' ? styles.urgImmediate : styles.urgPlanned}`}>
                                    {request.status}
                                </span>
                            </div>
                            <div className={styles.requestMeta}>
                                <small>{request.items?.length || 0} lines • {request.procurement_mode?.replace('_', ' ')}</small>
                                <small>{request.approval_scope === 'central' ? 'Central approval' : 'Branch approval'} • {request.receipt_route === 'vendor_to_central' ? 'Vendor to central' : 'Vendor direct to branch'}</small>
                                <small>{request.preferred_vendor?.vendor_name || 'No suggested vendor'}</small>
                            </div>
                            <div className={styles.requestActions}>
                                {request.status === 'pending' && (
                                    <>
                                        <button className={styles.filterBtn} onClick={() => void handleReview(request.id, 'approved')}>
                                            Approve
                                        </button>
                                        <button className={styles.selectAllBtn} onClick={() => void handleReview(request.id, 'rejected')}>
                                            Reject
                                        </button>
                                    </>
                                )}
                                {request.status === 'approved' && (
                                    <button
                                        className={styles.btnCreatePO}
                                        onClick={() => navigate(`/console/purchase-orders/new?requestId=${request.id}`)}
                                    >
                                        Create PO
                                        <ChevronRight size={16} />
                                    </button>
                                )}
                                {request.linked_po_id ? (
                                    <button
                                        className={styles.selectAllBtn}
                                        onClick={() => navigate(`/console/purchase-orders/${request.linked_po_id}`)}
                                    >
                                        Open PO
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedItems.length > 0 && (
                <div className={styles.footer}>
                    <div className={styles.footerInfo}>
                        <span className={styles.footerLabel}>{selectedItems.length} lines selected for branch demand</span>
                        <span className={styles.footerVal}>
                            Destination: {destinationBranch?.branch_name || 'Not selected'} • {approvalScope === 'central' ? 'Central approval' : 'Branch approval'}
                        </span>
                    </div>
                    <button className={styles.btnCreatePO} onClick={() => void handleCreateRequest()} disabled={saving}>
                        {saving ? 'Submitting...' : 'Raise Procurement Request'}
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
