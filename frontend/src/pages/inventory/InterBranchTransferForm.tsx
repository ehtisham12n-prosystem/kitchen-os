import { useEffect, useState } from 'react';
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
    X,
    XCircle,
} from 'lucide-react';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
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

interface BranchOption {
    id: number;
    branch_name: string;
    branch_code: string;
    inventory_store_type: 'branch' | 'central';
    has_access: boolean;
}

interface CatalogItem {
    id: number;
    item_name: string;
    item_sku?: string | null;
    uom_base: string;
    classification: string;
}

interface TransferLineForm {
    id: string;
    item_id: number;
    requested_quantity: string;
}

interface TransferItemRecord {
    id: number;
    item_id: number;
    item_name: string;
    item_sku?: string | null;
    uom_base?: string | null;
    requested_quantity: number;
    dispatched_quantity: number;
    received_quantity: number;
    in_transit_quantity: number;
    short_quantity: number;
    damaged_quantity: number;
    variance_quantity: number;
    unit_cost: number;
    variance_reason?: string | null;
}

interface TransferRecord {
    id: number;
    transfer_no: string;
    status: TransferStatus;
    status_label: string;
    require_approval: boolean;
    reason_code?: string | null;
    notes?: string | null;
    approval_notes?: string | null;
    rejection_notes?: string | null;
    cancellation_notes?: string | null;
    dispatch_notes?: string | null;
    receipt_notes?: string | null;
    variance_notes?: string | null;
    source_store_label?: string | null;
    destination_store_label?: string | null;
    source_branch: BranchOption | null;
    destination_branch: BranchOption | null;
    requested_by_name?: string | null;
    requested_at?: string;
    approved_by_name?: string | null;
    approved_at?: string | null;
    rejected_by_name?: string | null;
    rejected_at?: string | null;
    cancelled_by_name?: string | null;
    cancelled_at?: string | null;
    dispatched_by_name?: string | null;
    dispatched_at?: string | null;
    received_by_name?: string | null;
    received_at?: string | null;
    items: TransferItemRecord[];
    events: Array<{
        id: number;
        action: string;
        actor_name?: string | null;
        notes?: string | null;
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
        inventory_account_code?: string | null;
        clearing_receivable_account_code?: string | null;
        clearing_payable_account_code?: string | null;
        variance_expense_account_code?: string | null;
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
        recharge_income_account_code?: string | null;
        recharge_expense_account_code?: string | null;
    } | null;
    available_actions: string[];
}

interface DispatchLineState {
    transfer_item_id: number;
    dispatch_quantity: string;
}

interface ReceiveLineState {
    transfer_item_id: number;
    received_quantity: string;
    short_quantity: string;
    damaged_quantity: string;
    variance_reason: string;
}

const REASONS = [
    { value: 'shortage', label: 'Stock Shortage' },
    { value: 'redistribution', label: 'Redistribution / Balancing' },
    { value: 'event', label: 'Event / Rush Order' },
    { value: 'central_issue', label: 'Central Store Replenishment' },
    { value: 'other', label: 'Other' },
];

function newLine(): TransferLineForm {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_id: 0,
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
    if (!value) return 'Pending';
    return new Date(value).toLocaleString();
}

function formatCurrency(value: number) {
    return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function formatQty(value: number) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 4 });
}

function normalizeQuantity(value: number | string) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Number(parsed.toFixed(4));
}

export function InterBranchTransferForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const {
        canManageTransfers,
        canReceiveInventory,
        canViewAccountingReports,
    } = usePermissionAccess();
    const activeBranchId = Number(resolveActiveBranchId() || 0);
    const isDetailMode = Boolean(id);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [transfer, setTransfer] = useState<TransferRecord | null>(null);
    const [sourceBranchId, setSourceBranchId] = useState('');
    const [destinationBranchId, setDestinationBranchId] = useState('');
    const [sourceStoreLabel, setSourceStoreLabel] = useState('Main Store');
    const [destinationStoreLabel, setDestinationStoreLabel] = useState('');
    const [reasonCode, setReasonCode] = useState('shortage');
    const [notes, setNotes] = useState('');
    const [requireApproval, setRequireApproval] = useState(true);
    const [lines, setLines] = useState<TransferLineForm[]>([newLine()]);
    const [sourceStock, setSourceStock] = useState<Record<number, number>>({});
    const [sourceStockUnavailable, setSourceStockUnavailable] = useState(false);
    const [decisionNotes, setDecisionNotes] = useState('');
    const [dispatchNotes, setDispatchNotes] = useState('');
    const [receiptNotes, setReceiptNotes] = useState('');
    const [varianceNotes, setVarianceNotes] = useState('');
    const [dispatchLines, setDispatchLines] = useState<DispatchLineState[]>([]);
    const [receiveLines, setReceiveLines] = useState<ReceiveLineState[]>([]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [branchOptions, hierarchy] = await Promise.all([
                    inventoryApi.getTransferBranchOptions(),
                    inventoryApi.getHierarchy(),
                ]);

                setBranches(branchOptions);
                setCatalog(flattenHierarchy(hierarchy));

                if (isDetailMode && id) {
                    const record = await inventoryApi.getTransfer(id);
                    setTransfer(record);
                    setDecisionNotes('');
                    setDispatchNotes(record.dispatch_notes || '');
                    setReceiptNotes(record.receipt_notes || '');
                    setVarianceNotes(record.variance_notes || '');
                    setDispatchLines(record.items.map((item: TransferItemRecord) => ({
                        transfer_item_id: item.id,
                        dispatch_quantity: String(item.dispatched_quantity || item.requested_quantity),
                    })));
                    setReceiveLines(record.items.map((item: TransferItemRecord) => ({
                        transfer_item_id: item.id,
                        received_quantity: String(item.received_quantity || item.dispatched_quantity || 0),
                        short_quantity: String(item.short_quantity || 0),
                        damaged_quantity: String(item.damaged_quantity || 0),
                        variance_reason: item.variance_reason || '',
                    })));
                } else {
                    const defaultSource = activeBranchId
                        || branchOptions.find((branch: BranchOption) => branch.has_access)?.id
                        || branchOptions[0]?.id
                        || 0;
                    setSourceBranchId(defaultSource ? String(defaultSource) : '');
                    const sourceOption = branchOptions.find((branch: BranchOption) => branch.id === defaultSource);
                    const defaultDestination = branchOptions.find((branch: BranchOption) =>
                        branch.id !== defaultSource
                        && branch.inventory_store_type !== sourceOption?.inventory_store_type,
                    )?.id;
                    setDestinationBranchId(defaultDestination ? String(defaultDestination) : '');
                }
            } catch (error: any) {
                console.error('Failed to load transfer screen:', error);
                toast.error('Load Failed', error.message || 'Could not load transfer data.');
                if (isDetailMode) {
                    navigate('/console/inventory/ibt');
                }
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [activeBranchId, id, isDetailMode, navigate]);

    useEffect(() => {
        if (isDetailMode || !sourceBranchId) {
            return;
        }

        const loadSourceStock = async () => {
            try {
                setSourceStockUnavailable(false);
                const result = await inventoryApi.getBranchMaster({
                    branchId: Number(sourceBranchId),
                    limit: 500,
                });
                const stockMap = (result.items || []).reduce((acc: Record<number, number>, item: any) => {
                    acc[item.id] = Number(item.current_stock || 0);
                    return acc;
                }, {});
                setSourceStock(stockMap);
            } catch {
                setSourceStock({});
                setSourceStockUnavailable(true);
            }
        };

        loadSourceStock();
    }, [isDetailMode, sourceBranchId]);

    const branchName = (branchId?: string | number | null) =>
        branches.find((branch) => String(branch.id) === String(branchId))?.branch_name || 'Select branch';

    const branchTypeLabel = (branchId?: string | number | null) =>
        branches.find((branch) => String(branch.id) === String(branchId))?.inventory_store_type === 'central'
            ? 'Central Store'
            : 'Branch Store';

    const selectedSourceBranch = branches.find((branch) => String(branch.id) === String(sourceBranchId));
    const selectedDestinationBranch = branches.find((branch) => String(branch.id) === String(destinationBranchId));
    const selectedReason = REASONS.find((reason) => reason.value === reasonCode)?.label || 'Other';
    const sameBranch = sourceBranchId && destinationBranchId && sourceBranchId === destinationBranchId;
    const routeTypeConflict = !!(
        selectedSourceBranch &&
        selectedDestinationBranch &&
        selectedSourceBranch.inventory_store_type === selectedDestinationBranch.inventory_store_type
    );

    const sourceOptions = branches.filter((branch) => {
        if (!destinationBranchId) return true;
        return String(branch.id) !== String(destinationBranchId)
            && branch.inventory_store_type !== selectedDestinationBranch?.inventory_store_type;
    });

    const destinationOptions = branches.filter((branch) => {
        if (!sourceBranchId) return true;
        return String(branch.id) !== String(sourceBranchId)
            && branch.inventory_store_type !== selectedSourceBranch?.inventory_store_type;
    });

    const updateLine = (lineId: string, field: keyof TransferLineForm, value: string) => {
        setLines((current) => current.map((line) => {
            if (line.id !== lineId) return line;
            if (field === 'item_id') {
                return { ...line, item_id: Number(value) };
            }
            return { ...line, [field]: value };
        }));
    };

    const removeLine = (lineId: string) => {
        if (lines.length === 1) return;
        setLines((current) => current.filter((line) => line.id !== lineId));
    };

    const isOverKnownAvailability = (line: TransferLineForm) => {
        const available = sourceStock[line.item_id];
        const requested = Number(line.requested_quantity || 0);
        return Number.isFinite(available) && available >= 0 && requested > available;
    };

    const validLines = lines.filter((line) => line.item_id > 0 && Number(line.requested_quantity) > 0);
    const hasDuplicateItems = new Set(validLines.map((line) => line.item_id)).size !== validLines.length;
    const canSubmit =
        !isDetailMode
        && !!sourceBranchId
        && !!destinationBranchId
        && !sameBranch
        && !routeTypeConflict
        && validLines.length > 0
        && !hasDuplicateItems
        && !validLines.some((line) => isOverKnownAvailability(line));
    const hasTransferAccess = canManageTransfers || (isDetailMode && canReceiveInventory);

    if (!hasTransferAccess) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Your current role does not include inter-branch transfer access.</div>
            </div>
        );
    }

    const refreshTransfer = async (transferId: number) => {
        const record = await inventoryApi.getTransfer(transferId);
        setTransfer(record);
        setDispatchNotes(record.dispatch_notes || '');
        setReceiptNotes(record.receipt_notes || '');
        setVarianceNotes(record.variance_notes || '');
        setDispatchLines(record.items.map((item: TransferItemRecord) => ({
            transfer_item_id: item.id,
            dispatch_quantity: String(item.dispatched_quantity || item.requested_quantity),
        })));
        setReceiveLines(record.items.map((item: TransferItemRecord) => ({
            transfer_item_id: item.id,
            received_quantity: String(item.received_quantity || item.dispatched_quantity || 0),
            short_quantity: String(item.short_quantity || 0),
            damaged_quantity: String(item.damaged_quantity || 0),
            variance_reason: item.variance_reason || '',
        })));
    };

    const handleCreate = async () => {
        if (!canManageTransfers) {
            toast.error('Access Denied', 'Your current role cannot create transfer requests.');
            return;
        }
        if (!canSubmit) {
            toast.error('Validation Error', 'Resolve transfer validation issues before submitting.');
            return;
        }

        setIsSaving(true);
        try {
            const created: any = await inventoryApi.createTransfer({
                source_branch_id: Number(sourceBranchId),
                destination_branch_id: Number(destinationBranchId),
                source_store_label: sourceStoreLabel || undefined,
                destination_store_label: destinationStoreLabel || undefined,
                reason_code: reasonCode || undefined,
                notes: notes || undefined,
                require_approval: requireApproval,
                items: validLines.map((line) => ({
                    item_id: line.item_id,
                    requested_quantity: Number(line.requested_quantity),
                })),
            });
            toast.success('Transfer Requested', 'Transfer request created successfully.');
            navigate(`/console/inventory/ibt/${created.id}`);
        } catch (error: any) {
            console.error('Failed to create transfer:', error);
            toast.error('Save Failed', error.message || 'Transfer request could not be created.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!transfer) return;
        if (!canManageTransfers) {
            toast.error('Access Denied', 'Your current role cannot approve transfers.');
            return;
        }
        setIsSaving(true);
        try {
            await inventoryApi.approveTransfer(transfer.id, decisionNotes || undefined);
            await refreshTransfer(transfer.id);
            setDecisionNotes('');
            toast.success('Transfer Approved', 'The transfer is ready for dispatch.');
        } catch (error: any) {
            toast.error('Approve Failed', error.message || 'Approval could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReject = async () => {
        if (!transfer) return;
        if (!canManageTransfers) {
            toast.error('Access Denied', 'Your current role cannot reject transfers.');
            return;
        }
        if (!decisionNotes.trim()) {
            toast.error('Reason Required', 'Add rejection notes before rejecting this transfer.');
            return;
        }

        setIsSaving(true);
        try {
            await inventoryApi.rejectTransfer(transfer.id, decisionNotes);
            await refreshTransfer(transfer.id);
            setDecisionNotes('');
            toast.success('Transfer Rejected', 'The transfer was rejected with notes.');
        } catch (error: any) {
            toast.error('Reject Failed', error.message || 'Rejection could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelTransfer = async () => {
        if (!transfer) return;
        if (!canManageTransfers) {
            toast.error('Access Denied', 'Your current role cannot cancel transfers.');
            return;
        }

        setIsSaving(true);
        try {
            await inventoryApi.cancelTransfer(transfer.id, decisionNotes || undefined);
            await refreshTransfer(transfer.id);
            setDecisionNotes('');
            toast.success('Transfer Cancelled', 'The transfer was cancelled before any stock movement.');
        } catch (error: any) {
            toast.error('Cancel Failed', error.message || 'Cancellation could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateDispatchLine = (lineId: number, value: string) => {
        setDispatchLines((current) => current.map((line) => (
            line.transfer_item_id === lineId ? { ...line, dispatch_quantity: value } : line
        )));
    };

    const handleDispatch = async () => {
        if (!transfer) return;
        if (!canManageTransfers) {
            toast.error('Access Denied', 'Your current role cannot dispatch transfers.');
            return;
        }
        if (dispatchLines.some((line) => Number(line.dispatch_quantity) <= 0)) {
            toast.error('Validation Error', 'Dispatch quantities must be greater than zero.');
            return;
        }

        setIsSaving(true);
        try {
            await inventoryApi.dispatchTransfer(transfer.id, {
                notes: dispatchNotes || undefined,
                items: dispatchLines.map((line) => ({
                    transfer_item_id: line.transfer_item_id,
                    dispatch_quantity: Number(line.dispatch_quantity),
                })),
            });
            await refreshTransfer(transfer.id);
            toast.success('Transfer Dispatched', 'Source stock has been moved into transit.');
        } catch (error: any) {
            toast.error('Dispatch Failed', error.message || 'Dispatch could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateReceiveLine = (
        lineId: number,
        field: keyof ReceiveLineState,
        value: string,
    ) => {
        setReceiveLines((current) => current.map((line) => (
            line.transfer_item_id === lineId ? { ...line, [field]: value } : line
        )));
    };

    const handleReceive = async () => {
        if (!transfer) return;
        if (!canReceiveInventory) {
            toast.error('Access Denied', 'Your current role cannot receive transfers.');
            return;
        }

        let validationMessage: string | null = null;
        for (const line of receiveLines) {
            const transferLine = transfer.items.find((item) => item.id === line.transfer_item_id);
            const received = normalizeQuantity(line.received_quantity);
            const short = normalizeQuantity(line.short_quantity);
            const damaged = normalizeQuantity(line.damaged_quantity);
            const variance = normalizeQuantity(short + damaged);
            const dispatched = normalizeQuantity(transferLine?.dispatched_quantity || 0);

            if (!transferLine) {
                validationMessage = 'Each receive line must match a dispatched transfer item.';
                break;
            }
            if ([received, short, damaged].some((value) => value < 0)) {
                validationMessage = `Receipt quantities for ${transferLine.item_name} cannot be negative.`;
                break;
            }
            if (received > dispatched) {
                validationMessage = `Received quantity for ${transferLine.item_name} cannot exceed the dispatched quantity.`;
                break;
            }
            if (normalizeQuantity(received + short + damaged) !== dispatched) {
                validationMessage = `Each receive line must fully account for the dispatched quantity for ${transferLine.item_name}.`;
                break;
            }
            if (variance > 0 && !(line.variance_reason?.trim() || varianceNotes.trim())) {
                validationMessage = `Add a variance reason for ${transferLine.item_name} or enter an overall variance note.`;
                break;
            }
        }

        if (validationMessage) {
            toast.error('Validation Error', validationMessage);
            return;
        }

        setIsSaving(true);
        try {
            await inventoryApi.receiveTransfer(transfer.id, {
                notes: receiptNotes || undefined,
                variance_notes: varianceNotes || undefined,
                items: receiveLines.map((line) => ({
                    transfer_item_id: line.transfer_item_id,
                    received_quantity: Number(line.received_quantity || 0),
                    short_quantity: Number(line.short_quantity || 0),
                    damaged_quantity: Number(line.damaged_quantity || 0),
                    variance_reason: line.variance_reason || undefined,
                })),
            });
            await refreshTransfer(transfer.id);
            toast.success('Transfer Received', 'Destination stock has been posted successfully.');
        } catch (error: any) {
            toast.error('Receipt Failed', error.message || 'Receipt could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinanceReview = async () => {
        if (!transfer) return;
        if (!canViewAccountingReports) {
            toast.error('Access Denied', 'Your current role cannot complete finance review for transfers.');
            return;
        }
        setIsSaving(true);
        try {
            await inventoryApi.completeTransferFinanceReview(transfer.id, varianceNotes || decisionNotes || undefined);
            await refreshTransfer(transfer.id);
            setDecisionNotes('');
            toast.success('Finance Review Completed', 'This transfer variance is no longer part of the open settlement exception queue.');
        } catch (error: any) {
            toast.error('Review Failed', error.message || 'Finance review could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Loading transfer workspace...</div>
            </div>
        );
    }

    if (isDetailMode && !transfer) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>Transfer record could not be loaded.</div>
            </div>
        );
    }

    const renderCreateMode = () => (
        <>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/ibt')}>
                        <X size={16} />
                    </button>
                    <div className={styles.titleRow}>
                        <ArrowLeftRight size={22} className={styles.titleIcon} />
                        <div>
                            <h1>New Transfer Request</h1>
                            <p className={styles.subtitle}>Request stock movement between one central store and one branch store.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} disabled={!canSubmit || isSaving} onClick={handleCreate}>
                        <Send size={15} />
                        {isSaving ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>

            <div className={styles.infoBanner}>
                <Info size={14} />
                <span>
                    Stock remains owned by the source branch until dispatch, then moves <strong>in transit</strong>,
                    and only increases destination stock on <strong>receipt</strong>. Batch 2.4 allows only central-store to branch transfers and branch returns to central.
                </span>
            </div>

            {sameBranch && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={14} />
                    <span>Source and destination branches must be different.</span>
                </div>
            )}

            {routeTypeConflict && !sameBranch && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={14} />
                    <span>Select one central store and one branch store. Branch-to-branch and central-to-central transfers are blocked in this batch.</span>
                </div>
            )}

            {hasDuplicateItems && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={14} />
                    <span>Each item can appear only once in a transfer request.</span>
                </div>
            )}

            <div className={styles.formCard}>
                <div className={styles.formSection}>
                    <div className={styles.formSectionLabel}>Transfer Route</div>
                    <div className={styles.routeVisual}>
                        <div className={styles.routeBox}>
                            <div className={styles.routeBoxLabel}>FROM</div>
                            <div className={styles.routeBoxValue}>
                                <Building2 size={16} />
                                <span>{branchName(sourceBranchId)}</span>
                            </div>
                            <div className={styles.routeBoxSub}>{branchTypeLabel(sourceBranchId)} · {sourceStoreLabel || 'Store label optional'}</div>
                        </div>
                        <div className={styles.routeConnector}>
                            <ArrowLeftRight size={20} />
                            <span className={styles.routeReasonBadge}>{selectedReason}</span>
                        </div>
                        <div className={`${styles.routeBox} ${styles.routeBoxTo}`}>
                            <div className={styles.routeBoxLabel}>TO</div>
                            <div className={styles.routeBoxValue}>
                                <Building2 size={16} />
                                <span>{branchName(destinationBranchId)}</span>
                            </div>
                            <div className={styles.routeBoxSub}>{branchTypeLabel(destinationBranchId)} · {destinationStoreLabel || 'Receiving label optional'}</div>
                        </div>
                    </div>

                    <div className={styles.detailGrid}>
                        <div className={styles.fieldGroup}>
                            <label>Source Branch *</label>
                            <select value={sourceBranchId} onChange={(event) => setSourceBranchId(event.target.value)} className={styles.select}>
                                <option value="">Select branch</option>
                                {sourceOptions.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Destination Branch *</label>
                            <select value={destinationBranchId} onChange={(event) => setDestinationBranchId(event.target.value)} className={`${styles.select} ${sameBranch ? styles.inputError : ''}`}>
                                <option value="">Select branch</option>
                                {destinationOptions.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.branch_name} {branch.inventory_store_type === 'central' ? '(Central)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Source Label</label>
                            <input value={sourceStoreLabel} onChange={(event) => setSourceStoreLabel(event.target.value)} className={styles.input} placeholder="Main store / pickup point" />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Destination Label</label>
                            <input value={destinationStoreLabel} onChange={(event) => setDestinationStoreLabel(event.target.value)} className={styles.input} placeholder="Receiving dock / store" />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Reason *</label>
                            <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className={styles.select}>
                                {REASONS.map((reason) => (
                                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Approval Flow</label>
                            <label className={styles.checkboxRow}>
                                <input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} />
                                <span>Require approval before dispatch</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <div className={styles.sectionBar}>
                        <div className={styles.formSectionLabel} style={{ marginBottom: 0 }}>Requested Items</div>
                        <button className={styles.addLineBtn} onClick={() => setLines((current) => [...current, newLine()])}>
                            <Plus size={13} />
                            Add Item
                        </button>
                    </div>

                    {sourceStockUnavailable && (
                        <div className={styles.infoBanner}>
                            <Info size={14} />
                            <span>Live source stock could not be loaded for this branch context. Request creation is still allowed, but dispatch will enforce real availability.</span>
                        </div>
                    )}

                    <div className={styles.lineHead}>
                        <span style={{ width: '170px' }}>Item</span>
                        <span style={{ flex: 1 }}>Description</span>
                        <span style={{ width: '100px' }}>Class</span>
                        <span style={{ width: '110px', textAlign: 'right' }}>Available</span>
                        <span style={{ width: '130px', textAlign: 'right' }}>Requested Qty</span>
                        <span style={{ width: '70px' }}>Unit</span>
                        <span style={{ width: '36px' }} />
                    </div>

                    {lines.map((line) => {
                        const item = catalog.find((entry) => entry.id === line.item_id);
                        const knownAvailability = sourceStock[line.item_id];
                        const over = isOverKnownAvailability(line);
                        return (
                            <div key={line.id} className={`${styles.lineRow} ${over ? styles.lineRowOver : ''}`}>
                                <div style={{ width: '170px' }}>
                                    <select value={line.item_id || ''} onChange={(event) => updateLine(line.id, 'item_id', event.target.value)} className={styles.cellSelect}>
                                        <option value="">Select item</option>
                                        {catalog.map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                                {entry.item_sku || `ITEM-${entry.id}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input value={item?.item_name || ''} readOnly placeholder="Select item" className={styles.cellInput} />
                                </div>
                                <span style={{ width: '100px' }}>
                                    {item?.classification ? <span className={styles.clsBadge}>{item.classification}</span> : '—'}
                                </span>
                                <span style={{ width: '110px', textAlign: 'right', color: over ? '#f43f5e' : 'var(--text-secondary)', fontWeight: 600 }}>
                                    {line.item_id
                                        ? knownAvailability === undefined
                                            ? '—'
                                            : formatQty(knownAvailability)
                                        : '—'}
                                </span>
                                <div style={{ width: '130px' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={line.requested_quantity}
                                        onChange={(event) => updateLine(line.id, 'requested_quantity', event.target.value)}
                                        className={`${styles.cellInput} ${over ? styles.cellInputOver : ''}`}
                                        style={{ textAlign: 'right' }}
                                    />
                                </div>
                                <span style={{ width: '70px', color: 'var(--text-tertiary)' }}>{item?.uom_base || '—'}</span>
                                <button className={styles.removeBtn} onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                                    <X size={13} />
                                </button>
                                {over && (
                                    <div style={{ width: '100%', paddingLeft: '4px' }}>
                                        <span className={styles.overQtyAlert}>
                                            <AlertTriangle size={12} />
                                            Requested quantity exceeds the known source stock for this branch.
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <div className={styles.formSectionLabel}>Notes</div>
                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className={styles.textarea}
                        rows={3}
                        placeholder="Add handling instructions, urgency, or receiver context."
                    />
                </div>

                <div className={styles.controlAlert}>
                    <AlertTriangle size={14} />
                    <span>
                        <strong>Control rules:</strong> source stock is only reduced on dispatch, destination stock is only increased on receipt, and any shortage or damage must be recorded during receipt.
                    </span>
                </div>
            </div>
        </>
    );

    const renderDetailMode = () => {
        if (!transfer) return null;

        return (
            <>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/ibt')}>
                            <X size={16} />
                        </button>
                        <div className={styles.titleRow}>
                            <ArrowLeftRight size={22} className={styles.titleIcon} />
                            <div>
                                <h1>Transfer {transfer.transfer_no}</h1>
                                <p className={styles.subtitle}>
                                    <span className={styles.docNumber}>#{transfer.transfer_no}</span>
                                    <span className={styles.statusPill}>{transfer.status_label}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        <button className={styles.btnSecondary} onClick={() => refreshTransfer(transfer.id)}>Refresh</button>
                    </div>
                </div>

                <div className={styles.infoBanner}>
                    <Info size={14} />
                    <span>
                        This transfer keeps stock integrity strict: it leaves <strong>{transfer.source_branch?.branch_name}</strong> only at dispatch, stays off destination stock while in transit, and enters <strong>{transfer.destination_branch?.branch_name}</strong> only at receipt.
                    </span>
                </div>

                {transfer.finance_clearing && (
                    <div className={styles.infoBanner}>
                        <Info size={14} />
                        <span>
                            <strong>{transfer.finance_clearing.status_label}:</strong> {transfer.finance_clearing.top_note || 'Finance clearing follows dispatch and receipt.'}
                        </span>
                    </div>
                )}

                <div className={styles.formCard}>
                    <div className={styles.formSection}>
                        <div className={styles.formSectionLabel}>Transfer Route</div>
                        <div className={styles.routeVisual}>
                            <div className={styles.routeBox}>
                                <div className={styles.routeBoxLabel}>FROM</div>
                                <div className={styles.routeBoxValue}>
                                    <Building2 size={16} />
                                    <span>{transfer.source_branch?.branch_name || 'Unknown'}</span>
                                </div>
                                <div className={styles.routeBoxSub}>
                                    {(transfer.source_branch?.inventory_store_type === 'central' ? 'Central Store' : 'Branch Store')}
                                    {' · '}
                                    {transfer.source_store_label || 'No source label'}
                                </div>
                            </div>
                            <div className={styles.routeConnector}>
                                <ArrowLeftRight size={20} />
                                <span className={styles.routeReasonBadge}>
                                    {REASONS.find((reason) => reason.value === transfer.reason_code)?.label || transfer.reason_code || 'General Transfer'}
                                </span>
                            </div>
                            <div className={`${styles.routeBox} ${styles.routeBoxTo}`}>
                                <div className={styles.routeBoxLabel}>TO</div>
                                <div className={styles.routeBoxValue}>
                                    <Building2 size={16} />
                                    <span>{transfer.destination_branch?.branch_name || 'Unknown'}</span>
                                </div>
                                <div className={styles.routeBoxSub}>
                                    {(transfer.destination_branch?.inventory_store_type === 'central' ? 'Central Store' : 'Branch Store')}
                                    {' · '}
                                    {transfer.destination_store_label || 'No destination label'}
                                </div>
                            </div>
                        </div>

                        <div className={styles.detailGrid}>
                            <div className={styles.metaTile}>
                                <span>Requested By</span>
                                <strong>{transfer.requested_by_name || 'System'}</strong>
                                <small>{formatDateTime(transfer.requested_at)}</small>
                            </div>
                            <div className={styles.metaTile}>
                                <span>Approved By</span>
                                <strong>{transfer.approved_by_name || 'Pending'}</strong>
                                <small>{formatDateTime(transfer.approved_at)}</small>
                            </div>
                            <div className={styles.metaTile}>
                                <span>Dispatched By</span>
                                <strong>{transfer.dispatched_by_name || 'Pending'}</strong>
                                <small>{formatDateTime(transfer.dispatched_at)}</small>
                            </div>
                            <div className={styles.metaTile}>
                                <span>Received By</span>
                                <strong>{transfer.received_by_name || 'Pending'}</strong>
                                <small>{formatDateTime(transfer.received_at)}</small>
                            </div>
                            <div className={styles.metaTile}>
                                <span>Cancelled By</span>
                                <strong>{transfer.cancelled_by_name || 'Not cancelled'}</strong>
                                <small>{formatDateTime(transfer.cancelled_at)}</small>
                            </div>
                        </div>

                        {transfer.finance_clearing && (
                            <div className={styles.detailGrid}>
                                <div className={styles.metaTile}>
                                    <span>Finance Clearing</span>
                                    <strong>{transfer.finance_clearing.status_label}</strong>
                                    <small>{transfer.finance_clearing.top_note || 'No finance note.'}</small>
                                </div>
                                <div className={styles.metaTile}>
                                    <span>Dispatch Journal</span>
                                    <strong>{transfer.finance_clearing.dispatch_posted ? `Posted #${transfer.finance_clearing.dispatch_journal_id}` : 'Pending'}</strong>
                                    <small>{formatCurrency(transfer.finance_clearing.dispatched_amount)}</small>
                                </div>
                                <div className={styles.metaTile}>
                                    <span>Receipt Journal</span>
                                    <strong>{transfer.finance_clearing.receipt_posted ? `Posted #${transfer.finance_clearing.receipt_journal_id}` : 'Pending'}</strong>
                                    <small>{formatCurrency(transfer.finance_clearing.received_amount)}</small>
                                </div>
                                <div className={styles.metaTile}>
                                    <span>Clearing Accounts</span>
                                    <strong>{transfer.finance_clearing.clearing_receivable_account_code} / {transfer.finance_clearing.clearing_payable_account_code}</strong>
                                    <small>
                                        Inventory {transfer.finance_clearing.inventory_account_code}
                                        {transfer.finance_clearing.variance_amount > 0 && transfer.finance_clearing.variance_expense_account_code
                                            ? ` | Variance ${transfer.finance_clearing.variance_expense_account_code}`
                                            : ''}
                                    </small>
                                </div>
                                {transfer.finance_clearing.review_required && (
                                    <div className={styles.metaTile}>
                                        <span>Finance Review</span>
                                        <strong>{transfer.finance_clearing.review_status_label || 'Review Pending'}</strong>
                                        <small>
                                            {transfer.finance_clearing.review_completed
                                                ? `${transfer.finance_clearing.reviewed_by_name || 'Finance'} • ${formatDateTime(transfer.finance_clearing.reviewed_at)}`
                                                : 'Complete review once the variance is understood and accepted.'}
                                        </small>
                                    </div>
                                )}
                                {transfer.finance_clearing.recharge_applicable && (
                                    <div className={styles.metaTile}>
                                        <span>Central Recharge</span>
                                        <strong>{transfer.finance_clearing.recharge_status_label || 'Central Supply'}</strong>
                                        <small>
                                            {formatCurrency(Number(transfer.finance_clearing.recharge_amount ?? 0))}
                                            {transfer.finance_clearing.recharge_posted
                                                ? ` | Source #${transfer.finance_clearing.source_recharge_journal_id} | Destination #${transfer.finance_clearing.destination_recharge_journal_id}`
                                                : ' | Posting will complete on receipt'}
                                        </small>
                                    </div>
                                )}
                                {transfer.finance_clearing.recharge_applicable && transfer.finance_clearing.recharge_posted && (
                                    <div className={styles.metaTile}>
                                        <span>Recharge Accounts</span>
                                        <strong>{transfer.finance_clearing.recharge_income_account_code} / {transfer.finance_clearing.recharge_expense_account_code}</strong>
                                        <small>Income at source branch and expense at destination branch are now posted automatically.</small>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.sectionBar}>
                            <div className={styles.formSectionLabel} style={{ marginBottom: 0 }}>Transfer Items</div>
                            <div className={styles.summaryInline}>
                                <span>{transfer.summary.line_count} items</span>
                                <span>{formatQty(transfer.summary.in_transit_quantity)} in transit</span>
                                <span>{formatCurrency(transfer.summary.dispatched_value || transfer.summary.requested_value)}</span>
                            </div>
                        </div>

                        <div className={styles.itemsTable}>
                            <div className={styles.itemsHead}>
                                <span style={{ width: '120px' }}>Item</span>
                                <span style={{ flex: 1 }}>Description</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Requested</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Dispatched</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>In Transit</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Received</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Variance</span>
                                <span style={{ width: '100px', textAlign: 'right' }}>Unit Cost</span>
                            </div>
                            {transfer.items.map((item) => (
                                <div key={item.id} className={styles.itemsRow}>
                                    <span style={{ width: '120px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                                        {item.item_sku || `ITEM-${item.item_id}`}
                                    </span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.requested_quantity)}</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.dispatched_quantity)}</span>
                                    <span style={{ width: '90px', textAlign: 'right', color: item.in_transit_quantity > 0 ? 'var(--accent-tertiary)' : 'var(--text-tertiary)' }}>
                                        {item.in_transit_quantity > 0 ? formatQty(item.in_transit_quantity) : '-'}
                                    </span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.received_quantity)}</span>
                                    <span style={{ width: '90px', textAlign: 'right', color: item.variance_quantity > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                                        {item.variance_quantity > 0 ? formatQty(item.variance_quantity) : '-'}
                                    </span>
                                    <span style={{ width: '100px', textAlign: 'right' }}>
                                        {item.unit_cost > 0 ? formatCurrency(item.unit_cost) : '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {(transfer.available_actions.includes('approve') || transfer.available_actions.includes('reject') || transfer.available_actions.includes('cancel')) && (
                        <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                            <div className={styles.formSectionLabel}>Decision Controls</div>
                            <textarea
                                value={decisionNotes}
                                onChange={(event) => setDecisionNotes(event.target.value)}
                                className={styles.textarea}
                                rows={3}
                                placeholder="Add approval, rejection, or cancellation notes."
                            />
                            <div className={styles.actionRow}>
                                {transfer.available_actions.includes('approve') && (
                                    <button className={styles.btnApprove} disabled={isSaving} onClick={handleApprove}>
                                        <CheckCircle2 size={14} />
                                        Approve
                                    </button>
                                )}
                                {transfer.available_actions.includes('reject') && (
                                    <button className={styles.btnReject} disabled={isSaving} onClick={handleReject}>
                                        <XCircle size={14} />
                                        Reject
                                    </button>
                                )}
                                {transfer.available_actions.includes('cancel') && (
                                    <button className={styles.btnSecondary} disabled={isSaving} onClick={handleCancelTransfer}>
                                        <X size={14} />
                                        Cancel Transfer
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {transfer.available_actions.includes('dispatch') && (
                        <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                            <div className={styles.formSectionLabel}>Dispatch</div>
                            <div className={styles.itemsTable}>
                                <div className={styles.itemsHead}>
                                    <span style={{ width: '120px' }}>Item</span>
                                    <span style={{ flex: 1 }}>Description</span>
                                    <span style={{ width: '110px', textAlign: 'right' }}>Requested</span>
                                    <span style={{ width: '130px', textAlign: 'right' }}>Dispatch Qty</span>
                                </div>
                                {transfer.items.map((item) => {
                                    const dispatchLine = dispatchLines.find((line) => line.transfer_item_id === item.id);
                                    return (
                                        <div key={item.id} className={styles.itemsRow}>
                                            <span style={{ width: '120px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                                                {item.item_sku || `ITEM-${item.item_id}`}
                                            </span>
                                            <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                            <span style={{ width: '110px', textAlign: 'right' }}>{formatQty(item.requested_quantity)}</span>
                                            <div style={{ width: '130px' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.0001"
                                                    value={dispatchLine?.dispatch_quantity || ''}
                                                    onChange={(event) => updateDispatchLine(item.id, event.target.value)}
                                                    className={styles.cellInput}
                                                    style={{ textAlign: 'right' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <textarea
                                value={dispatchNotes}
                                onChange={(event) => setDispatchNotes(event.target.value)}
                                className={styles.textarea}
                                rows={2}
                                placeholder="Dispatch notes, courier details, or seal references."
                            />
                            <div className={styles.actionRow}>
                                <button className={styles.btnDispatch} disabled={isSaving} onClick={handleDispatch}>
                                    <Truck size={14} />
                                    Dispatch Stock
                                </button>
                            </div>
                        </div>
                    )}

                    {transfer.available_actions.includes('receive') && (
                        <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                            <div className={styles.formSectionLabel}>Receive and Variance Capture</div>
                            <div className={styles.itemsTable}>
                                <div className={styles.itemsHead}>
                                    <span style={{ width: '120px' }}>Item</span>
                                    <span style={{ flex: 1 }}>Description</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Dispatched</span>
                                    <span style={{ width: '110px', textAlign: 'right' }}>Received</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Short</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Damaged</span>
                                </div>
                                {transfer.items.map((item) => {
                                    const receiveLine = receiveLines.find((line) => line.transfer_item_id === item.id);
                                    return (
                                        <div key={item.id} className={styles.itemsRow}>
                                            <span style={{ width: '120px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                                                {item.item_sku || `ITEM-${item.item_id}`}
                                            </span>
                                            <span style={{ flex: 1, fontWeight: 600 }}>{item.item_name}</span>
                                            <span style={{ width: '90px', textAlign: 'right' }}>{formatQty(item.dispatched_quantity)}</span>
                                            <div style={{ width: '110px' }}>
                                                <input type="number" min="0" step="0.0001" value={receiveLine?.received_quantity || ''} onChange={(event) => updateReceiveLine(item.id, 'received_quantity', event.target.value)} className={styles.cellInput} style={{ textAlign: 'right' }} />
                                            </div>
                                            <div style={{ width: '90px' }}>
                                                <input type="number" min="0" step="0.0001" value={receiveLine?.short_quantity || ''} onChange={(event) => updateReceiveLine(item.id, 'short_quantity', event.target.value)} className={styles.cellInput} style={{ textAlign: 'right' }} />
                                            </div>
                                            <div style={{ width: '90px' }}>
                                                <input type="number" min="0" step="0.0001" value={receiveLine?.damaged_quantity || ''} onChange={(event) => updateReceiveLine(item.id, 'damaged_quantity', event.target.value)} className={styles.cellInput} style={{ textAlign: 'right' }} />
                                            </div>
                                            <div style={{ width: '100%', marginTop: '8px' }}>
                                                <input
                                                    value={receiveLine?.variance_reason || ''}
                                                    onChange={(event) => updateReceiveLine(item.id, 'variance_reason', event.target.value)}
                                                    className={styles.cellInput}
                                                    placeholder="Variance reason for this item (required if short/damaged)"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <textarea
                                value={receiptNotes}
                                onChange={(event) => setReceiptNotes(event.target.value)}
                                className={styles.textarea}
                                rows={2}
                                placeholder="Receipt notes."
                            />
                            <textarea
                                value={varianceNotes}
                                onChange={(event) => setVarianceNotes(event.target.value)}
                                className={styles.textarea}
                                rows={2}
                                placeholder="Overall variance notes if anything arrived short or damaged."
                            />
                            <div className={styles.actionRow}>
                                <button className={styles.btnReceive} disabled={isSaving} onClick={handleReceive}>
                                    <PackageCheck size={14} />
                                    Post Receipt
                                </button>
                            </div>
                        </div>
                    )}

                    {transfer.finance_clearing?.review_required && (
                        <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                            <div className={styles.formSectionLabel}>Finance Review Closure</div>
                            <p className={styles.subtitle}>
                                This transfer has a posted receipt variance. Close the finance exception here after the journals and variance explanation are accepted.
                            </p>
                            <textarea
                                value={decisionNotes}
                                onChange={(event) => setDecisionNotes(event.target.value)}
                                className={styles.textarea}
                                rows={3}
                                placeholder="Optional finance review note"
                            />
                            {transfer.finance_clearing.review_notes && (
                                <div className={styles.auditNote}><Info size={12} /> Latest finance review note: {transfer.finance_clearing.review_notes}</div>
                            )}
                            <div className={styles.actionRow}>
                                <button
                                    className={styles.btnApprove}
                                    disabled={isSaving || Boolean(transfer.finance_clearing.review_completed)}
                                    onClick={handleFinanceReview}
                                >
                                    <CheckCircle2 size={14} />
                                    {transfer.finance_clearing.review_completed ? 'Finance Review Complete' : 'Complete Finance Review'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.formSection} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className={styles.expandedFooter}>
                            <div className={styles.auditTrail}>
                                <div className={styles.auditTitle}>Audit Trail</div>
                                {transfer.events.map((event) => (
                                    <div key={event.id} className={styles.auditRow}>
                                        <span className={styles.auditDot} />
                                        <span className={styles.auditLabel}>{event.action.toUpperCase()}</span>
                                        <span className={styles.auditUser}>{event.actor_name || 'System'}</span>
                                        <span className={styles.auditDate}>{formatDateTime(event.created_at)}</span>
                                    </div>
                                ))}
                                {transfer.notes && <div className={styles.auditNote}><Info size={12} /> Request: {transfer.notes}</div>}
                                {transfer.approval_notes && <div className={styles.auditNote}><Info size={12} /> Approval: {transfer.approval_notes}</div>}
                                {transfer.cancellation_notes && <div className={styles.auditNote}><Info size={12} /> Cancellation: {transfer.cancellation_notes}</div>}
                                {transfer.dispatch_notes && <div className={styles.auditNote}><Info size={12} /> Dispatch: {transfer.dispatch_notes}</div>}
                                {transfer.variance_notes && <div className={styles.auditNote}><AlertTriangle size={12} /> Variance: {transfer.variance_notes}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className={styles.container}>
            {isDetailMode ? renderDetailMode() : renderCreateMode()}
        </div>
    );
}
