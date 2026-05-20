/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeftRight,
    Building2,
    CheckCircle2,
    Info,
    PackageCheck,
    Plus,
    Send,
    Truck,
    ChefHat,
    X,
    XCircle,
} from 'lucide-react';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from '../inventory/InterBranchTransfer.module.css';

type ProductionStage = 'semi_prepared' | 'prepared';
type SupplyStatus =
    | 'requested'
    | 'approved'
    | 'rejected'
    | 'in_transit'
    | 'received'
    | 'received_with_variance';

interface BranchOption {
    id: number;
    branch_name: string;
    branch_code: string;
    inventory_store_type: 'branch' | 'central';
    is_production_source: boolean;
    production_source_label?: string | null;
    has_access: boolean;
    can_source_production_supply: boolean;
    can_receive_production_supply: boolean;
}

interface CatalogItem {
    id: number;
    item_name: string;
    item_sku?: string | null;
    uom_base: string;
    classification: string;
}

interface RequestLineForm {
    id: string;
    item_id: number;
    production_stage: ProductionStage;
    requested_quantity: string;
}

interface SupplyRecord {
    id: number;
    transfer_no: string;
    origin_production_order_id?: number | null;
    origin_production_no?: string | null;
    status: SupplyStatus;
    status_label: string;
    reason_code?: string | null;
    notes?: string | null;
    source_store_label?: string | null;
    destination_store_label?: string | null;
    approval_notes?: string | null;
    dispatch_notes?: string | null;
    receipt_notes?: string | null;
    variance_notes?: string | null;
    source_branch: BranchOption | null;
    destination_branch: BranchOption | null;
    requested_by_name?: string | null;
    requested_at?: string;
    approved_by_name?: string | null;
    approved_at?: string | null;
    dispatched_by_name?: string | null;
    dispatched_at?: string | null;
    received_by_name?: string | null;
    received_at?: string | null;
    items: Array<{
        id: number;
        item_id: number;
        item_name: string;
        item_sku?: string | null;
        uom_base?: string | null;
        production_stage: ProductionStage;
        production_stage_label: string;
        requested_quantity: number;
        dispatched_quantity: number;
        received_quantity: number;
        short_quantity: number;
        damaged_quantity: number;
        variance_quantity: number;
    }>;
    events: Array<{ id: number; action: string; actor_name?: string | null; created_at: string }>;
    summary: { line_count: number; requested_value: number; dispatched_value: number; variance_quantity: number; has_variance: boolean };
    available_actions: string[];
}

const REASONS = [
    { value: 'daily_par', label: 'Daily Par Refill' },
    { value: 'semi_prep', label: 'Semi-Prepared Refill' },
    { value: 'event_prep', label: 'Event Prep' },
    { value: 'commissary', label: 'Commissary Dispatch' },
    { value: 'emergency', label: 'Emergency Support' },
    { value: 'other', label: 'Other' },
];

function newLine(): RequestLineForm {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_id: 0,
        production_stage: 'semi_prepared',
        requested_quantity: '',
    };
}

function flattenHierarchy(hierarchy: any[]): CatalogItem[] {
    const items: CatalogItem[] = [];
    hierarchy.forEach((inventoryClass) => {
        inventoryClass.types?.forEach((type: any) => {
            type.subTypes?.forEach((subType: any) => {
                subType.items?.forEach((item: any) => {
                    items.push({
                        id: item.id,
                        item_name: item.item_name,
                        item_sku: item.item_sku,
                        uom_base: item.uom_base,
                        classification: inventoryClass.class_name,
                    });
                });
            });
        });
    });
    return items.sort((a, b) => a.item_name.localeCompare(b.item_name));
}

function formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString() : 'Pending';
}

function formatQty(value: number) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 4 });
}

export function ProductionSupplyForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isDetailMode = Boolean(id);
    const activeBranchId = Number(resolveActiveBranchId() || 0);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [record, setRecord] = useState<SupplyRecord | null>(null);
    const [sourceBranchId, setSourceBranchId] = useState('');
    const [destinationBranchId, setDestinationBranchId] = useState('');
    const [sourceStoreLabel, setSourceStoreLabel] = useState('');
    const [destinationStoreLabel, setDestinationStoreLabel] = useState('Branch Production Receiving');
    const [reasonCode, setReasonCode] = useState('daily_par');
    const [notes, setNotes] = useState('');
    const [requireApproval, setRequireApproval] = useState(true);
    const [lines, setLines] = useState<RequestLineForm[]>([newLine()]);
    const [decisionNotes, setDecisionNotes] = useState('');
    const [dispatchNotes, setDispatchNotes] = useState('');
    const [receiptNotes, setReceiptNotes] = useState('');
    const [varianceNotes, setVarianceNotes] = useState('');
    const [dispatchLines, setDispatchLines] = useState<Record<number, string>>({});
    const [receiveLines, setReceiveLines] = useState<Record<number, { received: string; short: string; damaged: string; reason: string }>>({});

    const sourceOptions = useMemo(
        () => branches.filter((branch) => branch.can_source_production_supply),
        [branches],
    );

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [branchOptions, hierarchy] = await Promise.all([
                    inventoryApi.getProductionSupplyBranchOptions(),
                    inventoryApi.getHierarchy(),
                ]);
                setBranches(branchOptions);
                setCatalog(flattenHierarchy(hierarchy));

                if (isDetailMode && id) {
                    const detail = await inventoryApi.getProductionSupplyRequest(id);
                    setRecord(detail);
                    setDispatchNotes(detail.dispatch_notes || '');
                    setReceiptNotes(detail.receipt_notes || '');
                    setVarianceNotes(detail.variance_notes || '');
                    setDispatchLines(Object.fromEntries(detail.items.map((item: any) => [item.id, String(item.dispatched_quantity || item.requested_quantity)])));
                    setReceiveLines(Object.fromEntries(detail.items.map((item: any) => [item.id, {
                        received: String(item.received_quantity || item.dispatched_quantity || 0),
                        short: String(item.short_quantity || 0),
                        damaged: String(item.damaged_quantity || 0),
                        reason: item.variance_reason || '',
                    }])));
                } else {
                    const defaultSource = branchOptions.find((branch: BranchOption) => branch.can_source_production_supply)?.id || 0;
                    const defaultDestination = branchOptions.find((branch: BranchOption) => branch.id === activeBranchId && branch.can_receive_production_supply)?.id
                        || branchOptions.find((branch: BranchOption) => branch.can_receive_production_supply && branch.id !== defaultSource)?.id
                        || 0;
                    setSourceBranchId(defaultSource ? String(defaultSource) : '');
                    setDestinationBranchId(defaultDestination ? String(defaultDestination) : '');
                }
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load the production supply workspace.');
                if (isDetailMode) {
                    navigate('/console/production/supply');
                }
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [activeBranchId, id, isDetailMode, navigate]);

    useEffect(() => {
        if (isDetailMode) return;
        const selectedSource = branches.find((branch) => String(branch.id) === sourceBranchId);
        if (selectedSource && !sourceStoreLabel) {
            setSourceStoreLabel(selectedSource.production_source_label || selectedSource.branch_name);
        }
    }, [branches, isDetailMode, sourceBranchId, sourceStoreLabel]);

    const updateLine = (lineId: string, field: keyof RequestLineForm, value: string) => {
        setLines((current) => current.map((line) => {
            if (line.id !== lineId) return line;
            if (field === 'item_id') return { ...line, item_id: Number(value) };
            if (field === 'production_stage') return { ...line, production_stage: value as ProductionStage };
            return { ...line, [field]: value };
        }));
    };

    const validLines = lines.filter((line) => line.item_id > 0 && Number(line.requested_quantity) > 0);
    const hasDuplicateItems = new Set(validLines.map((line) => line.item_id)).size !== validLines.length;
    const canSubmit = !!sourceBranchId && !!destinationBranchId && sourceBranchId !== destinationBranchId && validLines.length > 0 && !hasDuplicateItems;

    const refreshDetail = async (recordId: number) => {
        const detail = await inventoryApi.getProductionSupplyRequest(recordId);
        setRecord(detail);
        setDispatchNotes(detail.dispatch_notes || '');
        setReceiptNotes(detail.receipt_notes || '');
        setVarianceNotes(detail.variance_notes || '');
        setDispatchLines(Object.fromEntries(detail.items.map((item: any) => [item.id, String(item.dispatched_quantity || item.requested_quantity)])));
        setReceiveLines(Object.fromEntries(detail.items.map((item: any) => [item.id, {
            received: String(item.received_quantity || item.dispatched_quantity || 0),
            short: String(item.short_quantity || 0),
            damaged: String(item.damaged_quantity || 0),
            reason: item.variance_reason || '',
        }])));
    };

    const handleCreate = async () => {
        if (!canSubmit) {
            toast.error('Validation Error', 'Resolve the request details before submitting.');
            return;
        }

        setIsSaving(true);
        try {
            const created: any = await inventoryApi.createProductionSupplyRequest({
                source_branch_id: Number(sourceBranchId),
                destination_branch_id: Number(destinationBranchId),
                source_store_label: sourceStoreLabel || undefined,
                destination_store_label: destinationStoreLabel || undefined,
                reason_code: reasonCode || undefined,
                notes: notes || undefined,
                require_approval: requireApproval,
                items: validLines.map((line) => ({
                    item_id: line.item_id,
                    production_stage: line.production_stage,
                    requested_quantity: Number(line.requested_quantity),
                })),
            });
            toast.success('Request Created', 'Production supply request submitted successfully.');
            navigate(`/console/production/supply/${created.id}`);
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not create the production supply request.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDecision = async (decision: 'approve' | 'reject') => {
        if (!record) return;
        if (decision === 'reject' && !decisionNotes.trim()) {
            toast.error('Reason Required', 'Add rejection notes before rejecting this request.');
            return;
        }
        setIsSaving(true);
        try {
            if (decision === 'approve') {
                await inventoryApi.approveProductionSupplyRequest(record.id, decisionNotes || undefined);
            } else {
                await inventoryApi.rejectProductionSupplyRequest(record.id, decisionNotes);
            }
            await refreshDetail(record.id);
            setDecisionNotes('');
            toast.success(decision === 'approve' ? 'Request Approved' : 'Request Rejected', 'Request status updated successfully.');
        } catch (error: any) {
            toast.error('Action Failed', error.message || 'Could not update request status.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDispatch = async () => {
        if (!record) return;
        setIsSaving(true);
        try {
            await inventoryApi.dispatchProductionSupplyRequest(record.id, {
                notes: dispatchNotes || undefined,
                items: record.items.map((item) => ({
                    transfer_item_id: item.id,
                    dispatch_quantity: Number(dispatchLines[item.id] || item.requested_quantity),
                })),
            });
            await refreshDetail(record.id);
            toast.success('Request Dispatched', 'Production supply has been moved into transit.');
        } catch (error: any) {
            toast.error('Dispatch Failed', error.message || 'Could not dispatch this request.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReceive = async () => {
        if (!record) return;
        const invalid = record.items.find((item) => {
            const line = receiveLines[item.id];
            return !line || Number(line.received || 0) + Number(line.short || 0) + Number(line.damaged || 0) !== item.dispatched_quantity;
        });
        if (invalid) {
            toast.error('Validation Error', 'Each receive line must fully account for the dispatched quantity.');
            return;
        }

        setIsSaving(true);
        try {
            await inventoryApi.receiveProductionSupplyRequest(record.id, {
                notes: receiptNotes || undefined,
                variance_notes: varianceNotes || undefined,
                items: record.items.map((item) => ({
                    transfer_item_id: item.id,
                    received_quantity: Number(receiveLines[item.id]?.received || 0),
                    short_quantity: Number(receiveLines[item.id]?.short || 0),
                    damaged_quantity: Number(receiveLines[item.id]?.damaged || 0),
                    variance_reason: receiveLines[item.id]?.reason || undefined,
                })),
            });
            await refreshDetail(record.id);
            toast.success('Request Received', 'Destination branch receipt has been posted.');
        } catch (error: any) {
            toast.error('Receipt Failed', error.message || 'Could not receive this request.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className={styles.container}><div className={styles.emptyState}>Loading production supply workspace...</div></div>;
    }

    if (isDetailMode && !record) {
        return <div className={styles.container}><div className={styles.emptyState}>Production supply request could not be loaded.</div></div>;
    }

    if (!isDetailMode) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button className={styles.btnSecondary} onClick={() => navigate('/console/production/supply')}><X size={16} /></button>
                        <div className={styles.titleRow}><ChefHat size={22} className={styles.titleIcon} /><div><h1>New Production Supply Request</h1><p className={styles.subtitle}>Request prepared or semi-prepared production items from a designated supply source.</p></div></div>
                    </div>
                    <div className={styles.headerRight}><button className={styles.btnPrimary} disabled={isSaving || !canSubmit} onClick={handleCreate}><Send size={16} /> Submit Request</button></div>
                </div>

                <div className={styles.infoBanner}><Info size={14} /><span>Only branches or central kitchens marked as production sources can supply this flow. Raw stock stays under the ordinary inter-branch transfer process.</span></div>

                <div className={styles.formCard}>
                    <div className={styles.formSection}>
                        <div className={styles.formSectionLabel}>Request Route</div>
                        <div className={styles.detailGrid}>
                            <div className={styles.fieldGroup}><label>Production Source</label><select className={styles.select} value={sourceBranchId} onChange={(event) => setSourceBranchId(event.target.value)}>{sourceOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.production_source_label || branch.branch_name}</option>)}</select></div>
                            <div className={styles.fieldGroup}><label>Destination Branch</label><select className={styles.select} value={destinationBranchId} onChange={(event) => setDestinationBranchId(event.target.value)}>{branches.filter((branch) => branch.can_receive_production_supply).map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}</select></div>
                            <div className={styles.fieldGroup}><label>Request Reason</label><select className={styles.select} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></div>
                        </div>
                        <div className={styles.detailGrid}>
                            <div className={styles.fieldGroup}><label>Source Label</label><input className={styles.input} value={sourceStoreLabel} onChange={(event) => setSourceStoreLabel(event.target.value)} /></div>
                            <div className={styles.fieldGroup}><label>Destination Label</label><input className={styles.input} value={destinationStoreLabel} onChange={(event) => setDestinationStoreLabel(event.target.value)} /></div>
                            <label className={styles.checkboxRow}><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /> Require source approval before dispatch</label>
                        </div>
                        <textarea className={styles.textarea} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Operational request notes, event requirements, or branch context." />
                    </div>

                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.sectionBar}><div className={styles.formSectionLabel} style={{ marginBottom: 0 }}>Requested Items</div><button className={styles.addLineBtn} onClick={() => setLines((current) => [...current, newLine()])}><Plus size={14} /> Add Line</button></div>
                        <div className={styles.lineHead}><span style={{ width: '44%' }}>Item</span><span style={{ width: '20%' }}>Stage</span><span style={{ width: '20%' }}>Requested Qty</span><span style={{ width: '10%' }}>UOM</span></div>
                        {lines.map((line) => {
                            const item = catalog.find((entry) => entry.id === line.item_id);
                            return (
                                <div key={line.id} className={styles.lineRow}>
                                    <div style={{ width: '44%' }}><select className={styles.cellSelect} value={line.item_id || ''} onChange={(event) => updateLine(line.id, 'item_id', event.target.value)}><option value="">Select item</option>{catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.item_name} {entry.item_sku ? `(${entry.item_sku})` : ''}</option>)}</select></div>
                                    <div style={{ width: '20%' }}><select className={styles.cellSelect} value={line.production_stage} onChange={(event) => updateLine(line.id, 'production_stage', event.target.value)}><option value="semi_prepared">Semi-Prepared</option><option value="prepared">Prepared</option></select></div>
                                    <div style={{ width: '20%' }}><input className={styles.cellInput} type="number" min="0" step="0.0001" value={line.requested_quantity} onChange={(event) => updateLine(line.id, 'requested_quantity', event.target.value)} /></div>
                                    <div style={{ width: '10%' }}>{item?.uom_base || '--'}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/production/supply')}><X size={16} /></button>
                    <div className={styles.titleRow}><ArrowLeftRight size={22} className={styles.titleIcon} /><div><h1>Production Supply Request</h1><p className={styles.subtitle}><span className={styles.docNumber}>{record?.transfer_no}</span><span className={styles.statusPill}>{record?.status_label}</span></p></div></div>
                </div>
            </div>

            <div className={styles.infoBanner}><Info size={14} /><span>This flow keeps production supply distinct from raw transfers while recording who requested, dispatched, and received each handoff.</span></div>

            <div className={styles.formCard}>
                <div className={styles.formSection}>
                    <div className={styles.formSectionLabel}>Supply Route</div>
                    <div className={styles.routeVisual}>
                        <div className={styles.routeBox}><div className={styles.routeBoxLabel}>FROM</div><div className={styles.routeBoxValue}><Building2 size={16} /><span>{record?.source_branch?.production_source_label || record?.source_branch?.branch_name}</span></div><div className={styles.routeBoxSub}>{record?.source_store_label || 'Production dispatch point'}</div></div>
                        <div className={styles.routeConnector}><ArrowLeftRight size={20} /><span className={styles.routeReasonBadge}>{REASONS.find((reason) => reason.value === record?.reason_code)?.label || record?.reason_code || 'Production Supply'}</span></div>
                        <div className={`${styles.routeBox} ${styles.routeBoxTo}`}><div className={styles.routeBoxLabel}>TO</div><div className={styles.routeBoxValue}><Building2 size={16} /><span>{record?.destination_branch?.branch_name}</span></div><div className={styles.routeBoxSub}>{record?.destination_store_label || 'Branch production receiving'}</div></div>
                    </div>
                    <div className={styles.detailGrid}>
                        <div className={styles.metaTile}><span>Requested By</span><strong>{record?.requested_by_name || 'System'}</strong><small>{formatDateTime(record?.requested_at)}</small></div>
                        <div className={styles.metaTile}><span>Production Link</span><strong>{record?.origin_production_no || 'Standalone supply request'}</strong><small>{record?.origin_production_order_id ? `Order #${record.origin_production_order_id}` : 'No production order linked'}</small></div>
                        <div className={styles.metaTile}><span>Approved By</span><strong>{record?.approved_by_name || 'Pending'}</strong><small>{formatDateTime(record?.approved_at)}</small></div>
                        <div className={styles.metaTile}><span>Dispatched By</span><strong>{record?.dispatched_by_name || 'Pending'}</strong><small>{formatDateTime(record?.dispatched_at)}</small></div>
                    </div>
                </div>

                <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <div className={styles.formSectionLabel}>Requested Items</div>
                    <div className={styles.itemsTable}>
                        <div className={styles.itemsHead}><span style={{ width: '120px' }}>Item</span><span style={{ flex: 1 }}>Description</span><span style={{ width: '120px' }}>Stage</span><span style={{ width: '90px', textAlign: 'right' }}>Requested</span><span style={{ width: '90px', textAlign: 'right' }}>Dispatched</span><span style={{ width: '90px', textAlign: 'right' }}>Received</span></div>
                        {record?.items.map((item) => (
                            <div key={item.id} className={styles.itemsRow}>
                                <span style={{ width: '120px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{item.item_sku || `ITEM-${item.item_id}`}</span>
                                <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                <span style={{ width: '120px' }}>{item.production_stage_label}</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.requested_quantity)}</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.dispatched_quantity)}</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.received_quantity)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {(record?.available_actions.includes('approve') || record?.available_actions.includes('reject')) && (
                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.formSectionLabel}>Approval Decision</div>
                        <textarea className={styles.textarea} rows={3} value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} placeholder="Add approval or rejection notes." />
                        <div className={styles.actionRow}>
                            <button className={styles.btnApprove} disabled={isSaving} onClick={() => handleDecision('approve')}><CheckCircle2 size={14} /> Approve</button>
                            <button className={styles.btnReject} disabled={isSaving} onClick={() => handleDecision('reject')}><XCircle size={14} /> Reject</button>
                        </div>
                    </div>
                )}

                {record?.available_actions.includes('dispatch') && (
                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.formSectionLabel}>Dispatch</div>
                        {record.items.map((item) => (
                            <div key={item.id} className={styles.lineRow}>
                                <div style={{ width: '38%' }}>{item.item_name}</div>
                                <div style={{ width: '18%' }}>{item.production_stage_label}</div>
                                <div style={{ width: '18%' }}>{formatQty(item.requested_quantity)}</div>
                                <div style={{ width: '20%' }}><input className={styles.cellInput} type="number" min="0" step="0.0001" value={dispatchLines[item.id] || ''} onChange={(event) => setDispatchLines((current) => ({ ...current, [item.id]: event.target.value }))} /></div>
                            </div>
                        ))}
                        <textarea className={styles.textarea} rows={2} value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} placeholder="Courier notes, dispatch references, or loading comments." />
                        <div className={styles.actionRow}><button className={styles.btnDispatch} disabled={isSaving} onClick={handleDispatch}><Truck size={14} /> Dispatch Supply</button></div>
                    </div>
                )}

                {record?.available_actions.includes('receive') && (
                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.formSectionLabel}>Receive and Variance Capture</div>
                        {record.items.map((item) => (
                            <div key={item.id} className={styles.lineRow}>
                                <div style={{ width: '32%' }}>{item.item_name}</div>
                                <div style={{ width: '12%' }}>{item.production_stage_label}</div>
                                <div style={{ width: '12%' }}>{formatQty(item.dispatched_quantity)}</div>
                                <div style={{ width: '12%' }}><input className={styles.cellInput} type="number" min="0" step="0.0001" value={receiveLines[item.id]?.received || ''} onChange={(event) => setReceiveLines((current) => ({ ...current, [item.id]: { ...(current[item.id] || { short: '0', damaged: '0', reason: '' }), received: event.target.value } }))} /></div>
                                <div style={{ width: '12%' }}><input className={styles.cellInput} type="number" min="0" step="0.0001" value={receiveLines[item.id]?.short || ''} onChange={(event) => setReceiveLines((current) => ({ ...current, [item.id]: { ...(current[item.id] || { received: '0', damaged: '0', reason: '' }), short: event.target.value } }))} /></div>
                                <div style={{ width: '12%' }}><input className={styles.cellInput} type="number" min="0" step="0.0001" value={receiveLines[item.id]?.damaged || ''} onChange={(event) => setReceiveLines((current) => ({ ...current, [item.id]: { ...(current[item.id] || { received: '0', short: '0', reason: '' }), damaged: event.target.value } }))} /></div>
                                <div style={{ width: '100%' }}><input className={styles.cellInput} value={receiveLines[item.id]?.reason || ''} onChange={(event) => setReceiveLines((current) => ({ ...current, [item.id]: { ...(current[item.id] || { received: '0', short: '0', damaged: '0' }), reason: event.target.value } }))} placeholder="Variance reason if short or damaged" /></div>
                            </div>
                        ))}
                        <textarea className={styles.textarea} rows={2} value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} placeholder="Receipt notes." />
                        <textarea className={styles.textarea} rows={2} value={varianceNotes} onChange={(event) => setVarianceNotes(event.target.value)} placeholder="Overall variance notes." />
                        <div className={styles.actionRow}><button className={styles.btnReceive} disabled={isSaving} onClick={handleReceive}><PackageCheck size={14} /> Post Receipt</button></div>
                    </div>
                )}

                <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <div className={styles.auditTrail}>
                        <div className={styles.auditTitle}>Audit Trail</div>
                        {record?.events.map((event) => (
                            <div key={event.id} className={styles.auditRow}>
                                <span className={styles.auditDot} />
                                <span className={styles.auditLabel}>{event.action.toUpperCase()}</span>
                                <span className={styles.auditUser}>{event.actor_name || 'System'}</span>
                                <span className={styles.auditDate}>{formatDateTime(event.created_at)}</span>
                            </div>
                        ))}
                        {record?.variance_notes && <div className={styles.auditNote}><AlertTriangle size={12} /> Variance: {record.variance_notes}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
