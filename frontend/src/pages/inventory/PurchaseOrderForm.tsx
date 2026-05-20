import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, HelpCircle, Plus, Save, Store, Trash2 } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import styles from './PurchaseOrderForm.module.css';
import { inventoryApi, resolveActiveBranchId, vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';

interface POItem {
    id: string;
    itemId: number;
    quantity: number;
    unitCost: number;
    uom: string;
}

type POStatus = 'draft' | 'sent' | 'received' | 'cancelled';
type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

const emptyItem = (): POItem => ({
    id: crypto.randomUUID(),
    itemId: 0,
    quantity: 1,
    unitCost: 0,
    uom: '',
});

export function PurchaseOrderForm() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const requestId = Number(searchParams.get('requestId') || 0);
    const isEdit = Boolean(id);
    const activeBranchId = Number(resolveActiveBranchId() || 0);
    const {
        canViewPurchaseOrders,
        canManagePurchaseOrders,
        canReceiveInventory,
        canAccessBranch,
    } = usePermissionAccess();

    const [loadingForm, setLoadingForm] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [requestContext, setRequestContext] = useState<any | null>(null);
    const [existingOrder, setExistingOrder] = useState<any | null>(null);
    const [requestingBranchId, setRequestingBranchId] = useState<number>(activeBranchId);
    const [destinationBranchId, setDestinationBranchId] = useState<number>(activeBranchId);
    const [vendorId, setVendorId] = useState<number>(0);
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [status, setStatus] = useState<POStatus>('draft');
    const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('not_required');
    const [approvalNotes, setApprovalNotes] = useState('');
    const [procurementMode, setProcurementMode] = useState<'branch_direct' | 'central_procurement' | 'hybrid'>('branch_direct');
    const [procurementContext, setProcurementContext] = useState<'branch_procurement' | 'branch_requisition' | 'central_procurement'>('branch_procurement');
    const [approvalScope, setApprovalScope] = useState<'branch' | 'central'>('branch');
    const [destinationStoreLabel, setDestinationStoreLabel] = useState('');
    const [notes, setNotes] = useState('');
    const [poItems, setPoItems] = useState<POItem[]>([emptyItem()]);

    useEffect(() => {
        const load = async () => {
            setLoadingForm(true);
            try {
                const [vendorRows, hierarchy, branchRows] = await Promise.all([
                    vendorApi.getVendors(),
                    inventoryApi.getHierarchy(),
                    inventoryApi.getTransferBranchOptions(),
                ]);

                setVendors(vendorRows);
                setInventoryItems(hierarchy.flatMap((cls: any) =>
                    (cls.types || []).flatMap((type: any) =>
                        (type.subTypes || []).flatMap((subType: any) => subType.items || []),
                    ),
                ));
                setBranches((branchRows ?? []).filter((branch: any) => canAccessBranch(branch.id)));

                if (requestId && !isEdit) {
                    const request = await inventoryApi.getProcurementRequest(requestId);
                    setRequestContext(request);
                    setRequestingBranchId(Number(request.requesting_branch_id));
                    setDestinationBranchId(Number(request.destination_branch_id));
                    setVendorId(Number(request.preferred_vendor_id || 0));
                    setProcurementMode(request.procurement_mode || 'branch_direct');
                    setProcurementContext(request.procurement_context || 'branch_procurement');
                    setApprovalScope(request.approval_scope || 'central');
                    setApprovalStatus('pending');
                    setNotes(request.notes || '');
                    setPoItems((request.items || []).map((item: any) => ({
                        id: String(item.id),
                        itemId: Number(item.item_id),
                        quantity: Number(item.approved_quantity || item.requested_quantity || 0),
                        unitCost: 0,
                        uom: item.item?.uom_purchase || item.item?.uom_base || '',
                    })));
                }

                if (id) {
                    const po = await inventoryApi.getPurchaseOrder(id);
                    setExistingOrder(po);
                    setRequestingBranchId(Number(po.branch_id || activeBranchId));
                    setDestinationBranchId(Number(po.destination_branch_id || po.branch_id || activeBranchId));
                    setVendorId(Number(po.vendor_id || 0));
                    setExpectedDeliveryDate(po.expected_delivery_date ? String(po.expected_delivery_date).slice(0, 10) : '');
                    setStatus(po.status || 'draft');
                    setApprovalStatus(po.approval_status || 'not_required');
                    setApprovalNotes(po.approval_notes || '');
                    setProcurementMode(po.procurement_mode || 'branch_direct');
                    setProcurementContext(po.procurement_context || 'branch_procurement');
                    setApprovalScope(po.approval_scope || 'branch');
                    setDestinationStoreLabel(po.destination_store_label || '');
                    setNotes(po.notes || '');
                    setPoItems((po.items || []).map((item: any, index: number) => ({
                        id: `${item.id || index}`,
                        itemId: Number(item.item_id),
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unit_cost),
                        uom: item.uom || item.item?.uom_purchase || item.item?.uom_base || '',
                    })));
                    if (po.procurement_request_id) {
                        setRequestContext(po.procurement_request || { id: po.procurement_request_id });
                    }
                }
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load purchase order form.');
            } finally {
                setLoadingForm(false);
            }
        };

        void load();
    }, [activeBranchId, canAccessBranch, id, isEdit, requestId]);

    useEffect(() => {
        if (!requestingBranchId || !destinationBranchId || isEdit) return;
        const requestingBranch = branches.find((branch) => Number(branch.id) === requestingBranchId);
        const nextContext = requestingBranch?.inventory_store_type === 'central'
            ? 'central_procurement'
            : requestingBranchId === destinationBranchId
                ? 'branch_procurement'
                : 'branch_requisition';
        setProcurementContext(nextContext);
    }, [branches, destinationBranchId, isEdit, requestingBranchId]);

    useEffect(() => {
        if (isEdit) return;
        setApprovalScope(procurementContext === 'branch_procurement' ? 'branch' : 'central');
        setProcurementMode(procurementContext === 'branch_procurement' ? 'branch_direct' : 'central_procurement');
        setApprovalStatus(requestContext || procurementContext !== 'branch_procurement' ? 'pending' : 'not_required');
    }, [isEdit, procurementContext, requestContext]);

    const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.id === vendorId), [vendorId, vendors]);
    const destinationBranch = useMemo(() => branches.find((branch) => Number(branch.id) === destinationBranchId), [branches, destinationBranchId]);
    const hasPostedReceipts = Number(existingOrder?.summary?.grn_count || 0) > 0;
    const canSend = approvalStatus !== 'pending' && approvalStatus !== 'rejected';
    const canReceive = Boolean(canReceiveInventory && isEdit && existingOrder?.workflow?.awaiting_receipt && approvalStatus === 'approved');
    const approvalRequired = approvalScope === 'central' || Boolean(requestContext) || procurementContext !== 'branch_procurement';

    const updateLine = (rowId: string, field: keyof POItem, value: number) => {
        if (isEdit) return;
        setPoItems((current) => current.map((item) => {
            if (item.id !== rowId) return item;
            if (field === 'itemId') {
                const inventoryItem = inventoryItems.find((row) => Number(row.id) === Number(value));
                return { ...item, itemId: value, uom: inventoryItem?.uom_purchase || inventoryItem?.uom_base || item.uom };
            }
            return { ...item, [field]: value };
        }));
    };

    const updateLineText = (rowId: string, field: keyof POItem, value: string) => {
        if (isEdit) return;
        setPoItems((current) => current.map((item) => item.id === rowId ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!canManagePurchaseOrders) {
            toast.error('Access Denied', 'Your current role cannot create or update purchase orders.');
            return;
        }
        if (!requestingBranchId || !destinationBranchId || !vendorId) {
            toast.error('Validation Error', 'Requesting branch, destination branch, and vendor are required.');
            return;
        }
        if (!isEdit && poItems.some((item) => !item.itemId || Number(item.quantity) <= 0)) {
            toast.error('Validation Error', 'Every line must have an item and quantity.');
            return;
        }
        if (status === 'sent' && !canSend) {
            toast.error('Approval Required', 'This purchase order cannot be sent while approval is pending or rejected.');
            return;
        }

        setIsLoading(true);
        try {
            if (isEdit && id) {
                const tasks: Promise<any>[] = [];
                if (approvalStatus !== existingOrder?.approval_status || approvalNotes !== (existingOrder?.approval_notes || '')) {
                    tasks.push(inventoryApi.updatePurchaseOrderApproval(id, approvalStatus, approvalNotes || undefined));
                }
                if (status !== existingOrder?.status) {
                    tasks.push(inventoryApi.updatePurchaseOrderStatus(id, status));
                }
                if (tasks.length === 0) {
                    toast.success('No Changes', 'Status and approval are already up to date.');
                } else {
                    await Promise.all(tasks);
                    toast.success('Updated', 'Purchase order controls updated successfully.');
                }
            } else {
                await inventoryApi.createPO({
                    branch_id: requestingBranchId,
                    destination_branch_id: destinationBranchId,
                    vendor_id: vendorId,
                    expected_delivery_date: expectedDeliveryDate || undefined,
                    status,
                    approval_status: approvalStatus,
                    approval_notes: approvalNotes || undefined,
                    procurement_mode: procurementMode,
                    procurement_context: procurementContext,
                    approval_scope: approvalScope,
                    destination_store_label: destinationStoreLabel || undefined,
                    notes: notes || undefined,
                    procurement_request_id: requestContext?.id || undefined,
                    items: poItems.map((item) => ({
                        item_id: item.itemId,
                        quantity: Number(item.quantity),
                        unit_cost: Number(item.unitCost),
                        uom: item.uom || inventoryItems.find((inventoryItem) => Number(inventoryItem.id) === Number(item.itemId))?.uom_purchase || undefined,
                    })),
                });
                toast.success('Created', 'Purchase order created successfully.');
            }
            navigate('/console/purchase-orders');
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save purchase order.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!canViewPurchaseOrders) {
        return <div className={styles.container}><h1>Purchase Orders</h1><p>Your current branch role does not include procurement access.</p></div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate('/console/purchase-orders')}>
                        <ArrowLeft size={20} />
                    </KitchenButton>
                    <div>
                        <h1>{isEdit ? `Purchase Order ${formatConfiguredPurchaseOrderNumber(existingOrder?.po_number || id, activeBranch || existingOrder, { preserveTypePrefix: true }) || existingOrder?.po_number || id}` : 'Create Purchase Order'}</h1>
                        <p>Capture approval, destination branch, outstanding receipt, and payable readiness in one controlled document.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="outline" onClick={() => navigate('/console/purchase-orders')}>Cancel</KitchenButton>
                    {canReceive && (
                        <KitchenButton variant="secondary" onClick={() => navigate(`/console/inventory/grn/new?poId=${id}`)}>
                            Receive Stock
                        </KitchenButton>
                    )}
                    <KitchenButton variant="primary" onClick={() => void handleSubmit()} isLoading={isLoading} disabled={loadingForm || !canManagePurchaseOrders}>
                        <Save size={20} style={{ marginRight: '8px' }} />
                        {isEdit ? 'Update Controls' : 'Save PO'}
                    </KitchenButton>
                </div>
            </header>

            {requestContext && (
                <KitchenCard className={styles.requestBanner}>
                    <div><strong>Linked request:</strong> {requestContext.request_no || `Request #${requestContext.id}`}</div>
                    <small>{requestContext.requesting_branch?.branch_name || 'Branch'} to {requestContext.destination_branch?.branch_name || 'Destination'} | {requestContext.status || 'pending'}</small>
                </KitchenCard>
            )}

            {isEdit && existingOrder && (
                <div className={styles.summaryStrip}>
                    <KitchenCard className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Outstanding Receipt</span>
                        <strong>{Number(existingOrder.summary?.remaining_quantity_total || 0).toFixed(2)} units</strong>
                        <small>{Number(existingOrder.summary?.received_quantity_total || 0).toFixed(2)} received across {Number(existingOrder.summary?.grn_count || 0)} GRN(s)</small>
                    </KitchenCard>
                    <KitchenCard className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Pending Bill Amount</span>
                        <strong>{Number(existingOrder.billing_summary?.pending_bill_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        <small>Bill refs captured: {Number(existingOrder.billing_summary?.bill_reference_count || 0)}</small>
                    </KitchenCard>
                    <KitchenCard className={styles.summaryCard}>
                        <span className={styles.summaryLabel}>Approval</span>
                        <strong>{String(existingOrder.approval_status || 'not_required').replace(/_/g, ' ')}</strong>
                        <small>{existingOrder.approved_at ? new Date(existingOrder.approved_at).toLocaleString() : 'Awaiting decision or not required'}</small>
                    </KitchenCard>
                </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                    <div className={styles.mainColumn}>
                        <KitchenCard className={styles.itemsCard}>
                            <div className={styles.cardHeader}>
                                <FileText size={20} />
                                <h3>Order Items</h3>
                            </div>
                            <div className={styles.itemsList}>
                                {loadingForm ? <div style={{ padding: '16px' }}>Loading purchase order...</div> : poItems.map((item, index) => (
                                    <div key={item.id} className={styles.itemRow}>
                                        <div className={styles.itemIndex}>{index + 1}</div>
                                        <div className={styles.itemInputs}>
                                            <select className={`${styles.flex2} ${styles.select}`} value={item.itemId} disabled={isEdit || !canManagePurchaseOrders} onChange={(event) => updateLine(item.id, 'itemId', Number(event.target.value))}>
                                                <option value={0}>Select Item...</option>
                                                {inventoryItems.map((inventoryItem) => (
                                                    <option key={inventoryItem.id} value={inventoryItem.id}>
                                                        {inventoryItem.item_name} ({inventoryItem.item_sku || inventoryItem.uom_base})
                                                    </option>
                                                ))}
                                            </select>
                                            <KitchenInput type="number" placeholder="Qty" value={item.quantity} onChange={(event) => updateLine(item.id, 'quantity', Number(event.target.value))} containerClassName={styles.flex1} disabled={isEdit || !canManagePurchaseOrders} />
                                            <select
                                                className={`${styles.select}`}
                                                style={{ width: 120 }}
                                                value={item.uom || inventoryItems.find((inventoryItem) => Number(inventoryItem.id) === Number(item.itemId))?.uom_purchase || ''}
                                                disabled={isEdit || !canManagePurchaseOrders}
                                                onChange={(event) => updateLineText(item.id, 'uom', event.target.value)}
                                            >
                                                <option value="">UOM</option>
                                                {Array.from(new Set(inventoryItems.flatMap((inventoryItem) => [inventoryItem.uom_purchase, inventoryItem.uom_base]).filter(Boolean))).map((uom) => (
                                                    <option key={uom} value={uom}>{uom}</option>
                                                ))}
                                            </select>
                                            <KitchenInput type="number" placeholder="Unit Cost" value={item.unitCost} onChange={(event) => updateLine(item.id, 'unitCost', Number(event.target.value))} containerClassName={styles.flex1} disabled={isEdit || !canManagePurchaseOrders} />
                                            <div className={styles.itemTotal}>{((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            <button type="button" className={styles.removeBtn} onClick={() => setPoItems((current) => current.filter((row) => row.id !== item.id))} disabled={isEdit || poItems.length === 1 || !canManagePurchaseOrders}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.itemsFooter}>
                                <KitchenButton type="button" variant="outline" size="sm" onClick={() => setPoItems((current) => [...current, emptyItem()])} disabled={isEdit || !canManagePurchaseOrders}>
                                    <Plus size={16} style={{ marginRight: '8px' }} />
                                    Add Line Item
                                </KitchenButton>
                                <div className={styles.orderTotal}>
                                    <span>Total Value:</span>
                                    <span className={styles.totalAmount}>{poItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.sideColumn}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Store size={20} />
                                <h3>Procurement Details</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.formGroup}>
                                    <label>Requesting Branch</label>
                                    <select className={styles.select} value={requestingBranchId} disabled={isEdit || !canManagePurchaseOrders} onChange={(event) => setRequestingBranchId(Number(event.target.value))}>
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Destination Branch</label>
                                    <select className={styles.select} value={destinationBranchId} disabled={isEdit || !canManagePurchaseOrders} onChange={(event) => setDestinationBranchId(Number(event.target.value))}>
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Select Vendor *</label>
                                    <select className={styles.select} required value={vendorId} disabled={isEdit || !canManagePurchaseOrders} onChange={(event) => setVendorId(Number(event.target.value))}>
                                        <option value={0}>-- Choose a vendor --</option>
                                        {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>)}
                                    </select>
                                </div>
                                <KitchenInput label="Expected Delivery Date" type="date" icon={<Calendar size={18} />} value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} required disabled={isEdit || !canManagePurchaseOrders} />
                                <div className={styles.formGroup}>
                                    <label>Procurement Mode</label>
                                    <select className={styles.select} value={procurementMode} disabled={isEdit || !canManagePurchaseOrders} onChange={(event) => setProcurementMode(event.target.value as any)}>
                                        <option value="branch_direct">Branch Direct</option>
                                        <option value="central_procurement">Central Procurement</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
                                </div>
                                <KitchenInput label="Approval Scope" value={approvalScope === 'central' ? 'Central Approval' : 'Branch Approval'} disabled />
                                <KitchenInput label="Destination Store Label" value={destinationStoreLabel} onChange={(event) => setDestinationStoreLabel(event.target.value)} placeholder="Main store / receiving dock" disabled={isEdit || !canManagePurchaseOrders} />
                                <div className={styles.formGroup}>
                                    <label>Status</label>
                                    <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value as POStatus)}>
                                        <option value="draft" disabled={hasPostedReceipts}>Draft</option>
                                        <option value="sent" disabled={!canSend}>Sent</option>
                                        <option value="received" disabled>Received</option>
                                        <option value="cancelled" disabled={hasPostedReceipts}>Cancelled</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Approval</label>
                                    <select className={styles.select} value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as ApprovalStatus)}>
                                        <option value="not_required" disabled={approvalRequired || hasPostedReceipts || status === 'sent' || status === 'received'}>Not Required</option>
                                        <option value="pending" disabled={hasPostedReceipts || status === 'sent' || status === 'received'}>Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected" disabled={hasPostedReceipts || status === 'sent' || status === 'received'}>Rejected</option>
                                    </select>
                                </div>
                                <KitchenInput label="Approval Notes" value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} placeholder="Why approved, pending, or rejected" disabled={!canManagePurchaseOrders} />
                                <KitchenInput label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Vendor notes, branch remarks, or delivery instruction" disabled={isEdit || !canManagePurchaseOrders} />
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.helpCard}>
                            <HelpCircle size={20} className={styles.helpIcon} />
                            <div>
                                <h4>Procurement Control</h4>
                                <p>{selectedVendor ? `${selectedVendor.vendor_name} stays visible across client branches, while receipts and payables accrue only against the destination branch.` : 'Capture the destination branch carefully. Receiving will update stock only for that destination.'}</p>
                                <p>{destinationBranch?.inventory_store_type === 'central' ? 'Vendor to central store' : 'Vendor direct to branch'} | {approvalScope === 'central' ? 'Central approval required' : 'Branch approval route'} | {destinationBranch?.branch_name || 'Select a destination'}</p>
                            </div>
                        </KitchenCard>
                    </div>
                </div>
            </form>
        </div>
    );
}
