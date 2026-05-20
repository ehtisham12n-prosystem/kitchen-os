import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ClipboardCheck, Hash, Package, Truck } from 'lucide-react';
import styles from './GRNForm.module.css';
import { accountingApi, inventoryApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredExpenseVoucherNumber, formatConfiguredGrnNumber, formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';

interface ReceiptLine {
    id: string;
    item_id: number;
    item_name: string;
    orderedQty: number;
    alreadyReceivedQty: number;
    remainingQty: number;
    receivedQty: number;
    unitCost: number;
}

interface ReturnLine {
    grn_item_id: number;
    item_id: number;
    item_name: string;
    receivedQty: number;
    returnedQty: number;
    remainingQty: number;
    returnQty: number;
    unitCost: number;
}

interface GRNFormProps {
    onClose?: () => void;
}

export function GRNForm({ onClose }: GRNFormProps = {}) {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const { canReadInventory, canReceiveInventory } = usePermissionAccess();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const poIdFromQuery = Number(searchParams.get('poId') || 0);
    const grnId = id ? Number(id) : 0;
    const isReadOnly = Boolean(grnId && !poIdFromQuery);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [selectedPoId, setSelectedPoId] = useState<number>(poIdFromQuery);
    const [purchaseOrder, setPurchaseOrder] = useState<any | null>(null);
    const [grnRecord, setGrnRecord] = useState<any | null>(null);
    const [lineItems, setLineItems] = useState<ReceiptLine[]>([]);
    const [vendorBillReference, setVendorBillReference] = useState('');
    const [vendorBillDate, setVendorBillDate] = useState('');
    const [vendorBillDueDate, setVendorBillDueDate] = useState('');
    const [vendorBillAmount, setVendorBillAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [billSaving, setBillSaving] = useState(false);
    const [showReturnForm, setShowReturnForm] = useState(false);
    const [returnSaving, setReturnSaving] = useState(false);
    const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
    const [debitNoteReference, setDebitNoteReference] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
    const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
    const [creditNoteSaving, setCreditNoteSaving] = useState(false);
    const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().slice(0, 10));
    const [creditNoteReference, setCreditNoteReference] = useState('');
    const [creditNoteAmount, setCreditNoteAmount] = useState('');
    const [creditNoteNotes, setCreditNoteNotes] = useState('');

    const hydrateFromPurchaseOrder = (po: any) => {
        setPurchaseOrder(po);
        setGrnRecord(null);
        setVendorBillReference('');
        setVendorBillDate('');
        setVendorBillDueDate('');
        setVendorBillAmount('');
        setNotes('');
        setShowReturnForm(false);
        setReturnLines([]);
        setLineItems((po.items || [])
            .filter((item: any) => Number(item.remaining_quantity ?? item.quantity ?? 0) > 0)
            .map((item: any, index: number) => ({
                id: String(item.id || index),
                item_id: Number(item.item_id),
                item_name: item.item_name || item.item?.item_name || `Item #${item.item_id}`,
                orderedQty: Number(item.quantity || 0),
                alreadyReceivedQty: Number(item.received_quantity || 0),
                remainingQty: Number(item.remaining_quantity ?? item.quantity ?? 0),
                receivedQty: Number(item.remaining_quantity ?? item.quantity ?? 0),
                unitCost: Number(item.unit_cost || 0),
            })));
    };

    const hydrateFromGrn = (grn: any) => {
        setGrnRecord(grn);
        setPurchaseOrder(grn.purchase_order ? {
            id: grn.purchase_order.id,
            po_number: grn.purchase_order.po_number,
            approval_status: grn.purchase_order.approval_status,
            status: grn.purchase_order.status,
            vendor: grn.vendor,
            branch: grn.branch,
            destination_branch: grn.branch,
        } : null);
        setVendorBillReference(grn.vendor_bill_reference || grn.vendor_invoice_number || '');
        setVendorBillDate(grn.vendor_bill_date ? String(grn.vendor_bill_date).slice(0, 10) : '');
        setVendorBillDueDate(grn.vendor_bill_due_date ? String(grn.vendor_bill_due_date).slice(0, 10) : '');
        setVendorBillAmount(grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined ? String(Number(grn.vendor_bill_amount)) : '');
        setNotes(grn.notes || '');
        setLineItems((grn.items || []).map((item: any, index: number) => ({
            id: String(item.id || index),
            item_id: Number(item.item_id),
            item_name: item.item_name || `Item #${item.item_id}`,
            orderedQty: Number(item.ordered_quantity || 0),
            alreadyReceivedQty: 0,
            remainingQty: Number(item.received_quantity || 0),
            receivedQty: Number(item.received_quantity || 0),
            unitCost: Number(item.unit_cost || 0),
        })));

        const returnedByItemId = new Map<number, number>();
        (grn.returns?.history || []).forEach((returnDoc: any) => {
            (returnDoc.items || []).forEach((item: any) => {
                returnedByItemId.set(
                    Number(item.grn_item_id),
                    Number(returnedByItemId.get(Number(item.grn_item_id)) || 0) + Number(item.returned_quantity || 0),
                );
            });
        });
        setReturnLines((grn.items || []).map((item: any) => {
            const receivedQty = Number(item.received_quantity || 0);
            const returnedQty = Number(returnedByItemId.get(Number(item.id)) || 0);
            return {
                grn_item_id: Number(item.id),
                item_id: Number(item.item_id),
                item_name: item.item_name || `Item #${item.item_id}`,
                receivedQty,
                returnedQty,
                remainingQty: Math.max(receivedQty - returnedQty, 0),
                returnQty: 0,
                unitCost: Number(item.unit_cost || 0),
            };
        }));
        setShowReturnForm(false);
        setShowCreditNoteForm(false);
        setReturnDate(new Date().toISOString().slice(0, 10));
        setDebitNoteReference('');
        setReturnNotes('');
        setCreditNoteDate(new Date().toISOString().slice(0, 10));
        setCreditNoteReference('');
        setCreditNoteAmount('');
        setCreditNoteNotes('');
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (isReadOnly && grnId) {
                    hydrateFromGrn(await inventoryApi.getGrn(grnId));
                } else {
                    const poRows = await inventoryApi.getPurchaseOrders();
                    const openRows = poRows.filter((po) => po.status !== 'cancelled' && !po.receipt_summary?.fully_received);
                    setPurchaseOrders(openRows);
                    if (poIdFromQuery) {
                        hydrateFromPurchaseOrder(openRows.find((row) => Number(row.id) === poIdFromQuery) ?? await inventoryApi.getPurchaseOrder(poIdFromQuery));
                    }
                }
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load receiving data.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [grnId, isReadOnly, poIdFromQuery]);

    const totalValue = useMemo(
        () => lineItems.reduce((sum, item) => sum + (Number(item.receivedQty || 0) * Number(item.unitCost || 0)), 0),
        [lineItems],
    );
    const payableStatus = grnRecord?.payable_status || (vendorBillReference || vendorBillDate || vendorBillDueDate ? 'bill_received' : 'pending_bill');
    const liabilityPosting = grnRecord?.payable?.liability_account_name
        || (payableStatus === 'bill_received' ? 'Accounts Payable' : 'Goods Received Not Invoiced');
    const canCaptureBill = Boolean(isReadOnly && grnRecord && payableStatus === 'pending_bill');
    const canCreateReturn = Boolean(isReadOnly && grnRecord && returnLines.some((line) => Number(line.remainingQty || 0) > 0.0001));
    const canCreateCreditNote = Boolean(isReadOnly && grnRecord && Number(grnRecord?.payable?.accrued_amount || 0) > 0.009);
    const returnTotal = useMemo(
        () => returnLines.reduce((sum, line) => sum + (Number(line.returnQty || 0) * Number(line.unitCost || 0)), 0),
        [returnLines],
    );
    const hasGoodsReceiptAccess = !((!isReadOnly && !canReceiveInventory) || (isReadOnly && !canReadInventory && !canReceiveInventory));

    if (!hasGoodsReceiptAccess) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <p>Your current role does not include goods receipt access.</p>
                </div>
            </div>
        );
    }

    const updateLine = (lineId: string, nextQty: string) => {
        if (isReadOnly) return;
        setLineItems((current) => current.map((item) =>
            item.id === lineId ? { ...item, receivedQty: Number(nextQty || 0) } : item,
        ));
    };

    const updateReturnLine = (lineId: number, nextQty: string) => {
        setReturnLines((current) => current.map((line) =>
            line.grn_item_id === lineId ? { ...line, returnQty: Number(nextQty || 0) } : line,
        ));
    };

    const handleSelectPurchaseOrder = async (nextPoId: number) => {
        setSelectedPoId(nextPoId);
        if (!nextPoId) {
            setPurchaseOrder(null);
            setLineItems([]);
            return;
        }

        try {
            hydrateFromPurchaseOrder(
                purchaseOrders.find((row) => Number(row.id) === nextPoId)
                ?? await inventoryApi.getPurchaseOrder(nextPoId),
            );
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load the selected purchase order.');
        }
    };

    const handleReceive = async () => {
        if (!canReceiveInventory) {
            toast.error('Access Denied', 'Your current role cannot post goods receipts.');
            return;
        }
        if (!purchaseOrder) {
            toast.error('Purchase Order Required', 'Select a purchase order to receive.');
            return;
        }
        if (vendorBillDate && vendorBillDueDate && vendorBillDueDate < vendorBillDate) {
            toast.error('Validation Error', 'Bill due date cannot be before bill date.');
            return;
        }

        const positiveLines = lineItems
            .map((item) => ({
                item_id: item.item_id,
                quantity: Number(item.receivedQty || 0),
                unit_cost: Number(item.unitCost || 0),
            }))
            .filter((item) => item.quantity > 0);

        if (positiveLines.length === 0) {
            toast.error('Receipt Required', 'At least one line must have a positive receipt quantity.');
            return;
        }
        const overReceivedLine = lineItems.find((line) => Number(line.receivedQty || 0) - Number(line.remainingQty || 0) > 0.0001);
        if (overReceivedLine) {
            toast.error('Validation Error', `${overReceivedLine.item_name} exceeds the remaining PO quantity.`);
            return;
        }

        setSaving(true);
        try {
            const receipt = await inventoryApi.postGrn({
                branch_id: purchaseOrder.destination_branch_id || purchaseOrder.branch_id || purchaseOrder.branch?.id,
                po_id: purchaseOrder.id,
                vendor_bill_reference: vendorBillReference || undefined,
                vendor_invoice_number: vendorBillReference || undefined,
                vendor_bill_date: vendorBillDate || undefined,
                vendor_bill_due_date: vendorBillDueDate || undefined,
                vendor_bill_amount: vendorBillAmount ? Number(vendorBillAmount) : undefined,
                notes: notes || undefined,
                items: positiveLines,
            });
            toast.success('Stock Received', 'Inventory has been posted and a GRN was created.');
            navigate(`/console/inventory/grn/${receipt.id}`);
        } catch (error: any) {
            toast.error('Receipt Failed', error.message || 'Could not receive this purchase order.');
        } finally {
            setSaving(false);
        }
    };

    const handleCaptureBill = async () => {
        if (!grnRecord?.id) {
            toast.error('GRN Missing', 'Load a posted GRN before capturing the vendor bill.');
            return;
        }
        if (!vendorBillReference || !vendorBillDate) {
            toast.error('Validation Error', 'Vendor bill reference and bill date are required.');
            return;
        }
        if (vendorBillAmount && Number(vendorBillAmount) <= 0) {
            toast.error('Validation Error', 'Vendor bill amount must be greater than zero.');
            return;
        }
        if (vendorBillDueDate && vendorBillDueDate < vendorBillDate) {
            toast.error('Validation Error', 'Bill due date cannot be before bill date.');
            return;
        }

        setBillSaving(true);
        try {
            const updated = await inventoryApi.captureGrnBill(grnRecord.id, {
                branch_id: grnRecord.branch_id,
                vendor_bill_reference: vendorBillReference,
                vendor_invoice_number: vendorBillReference,
                vendor_bill_date: vendorBillDate,
                vendor_bill_due_date: vendorBillDueDate || undefined,
                vendor_bill_amount: vendorBillAmount ? Number(vendorBillAmount) : undefined,
                notes: notes || undefined,
            });
            hydrateFromGrn(updated);
            toast.success('Vendor Bill Captured', 'The GRN has been moved from GRNI into Accounts Payable.');
        } catch (error: any) {
            toast.error('Capture Failed', error.message || 'Could not capture vendor bill for this GRN.');
        } finally {
            setBillSaving(false);
        }
    };

    const handleCreateReturn = async () => {
        if (!grnRecord?.id) {
            toast.error('GRN Missing', 'Load a posted GRN before creating a return.');
            return;
        }

        const positiveLines = returnLines
            .filter((line) => Number(line.returnQty || 0) > 0)
            .map((line) => ({
                grn_item_id: line.grn_item_id,
                quantity: Number(line.returnQty || 0),
            }));

        if (positiveLines.length === 0) {
            toast.error('Return Required', 'Enter at least one positive return quantity.');
            return;
        }

        const overReturnLine = returnLines.find((line) => Number(line.returnQty || 0) - Number(line.remainingQty || 0) > 0.0001);
        if (overReturnLine) {
            toast.error('Validation Error', `${overReturnLine.item_name} exceeds the remaining returnable quantity.`);
            return;
        }

        setReturnSaving(true);
        try {
            const updated = await inventoryApi.createGrnReturn(grnRecord.id, {
                branch_id: grnRecord.branch_id,
                return_date: returnDate || undefined,
                debit_note_reference: debitNoteReference || undefined,
                notes: returnNotes || undefined,
                items: positiveLines,
            });
            hydrateFromGrn(updated);
            toast.success('Purchase Return Posted', 'Inventory and vendor liability have been reduced for this GRN.');
        } catch (error: any) {
            toast.error('Return Failed', error.message || 'Could not post purchase return.');
        } finally {
            setReturnSaving(false);
        }
    };

    const handleCreateCreditNote = async () => {
        if (!grnRecord?.id || !grnRecord?.vendor?.id) {
            toast.error('GRN Missing', 'Load a vendor GRN before posting a credit note.');
            return;
        }
        const amount = Number(creditNoteAmount || 0);
        if (amount <= 0) {
            toast.error('Validation Error', 'Credit note amount must be greater than zero.');
            return;
        }
        if (amount - Number(grnRecord?.payable?.accrued_amount || 0) > 0.009) {
            toast.error('Validation Error', 'Credit note amount exceeds the open GRN liability.');
            return;
        }

        setCreditNoteSaving(true);
        try {
            await accountingApi.createFinancialVoucher({
                branch_id: grnRecord.branch_id,
                type: 'PURCHASE_CREDIT_NOTE',
                party_type: 'VENDOR',
                party_id: Number(grnRecord.vendor.id),
                party_name: grnRecord.vendor.vendor_name,
                amount,
                date: creditNoteDate,
                reference_no: creditNoteReference || undefined,
                description: creditNoteNotes || undefined,
                linked_grn_id: grnRecord.id,
            });
            hydrateFromGrn(await inventoryApi.getGrn(grnRecord.id));
            toast.success('Purchase Credit Note Submitted', 'The credit note is pending finance approval and linked to this GRN.');
        } catch (error: any) {
            toast.error('Credit Note Failed', error.message || 'Could not submit purchase credit note.');
        } finally {
            setCreditNoteSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => onClose ? onClose() : navigate('/console/inventory/grn')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <Truck size={22} className={styles.titleIcon} />
                            <h1>{isReadOnly ? 'Goods Received Note' : 'Post Goods Received Note'}</h1>
                        </div>
                        <p className={styles.subtitle}>{isReadOnly ? 'View the posted receipt, bill reference, payable metadata, and purchase returns.' : 'Receive approved purchase orders into the correct destination branch or central store.'}</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    {(grnRecord?.grn_number || purchaseOrder?.po_number) && (
                        <div className={styles.grnBadge}>
                            <Hash size={14} />
                            <span>{grnRecord?.grn_number
                                ? (formatConfiguredGrnNumber(grnRecord.grn_number, activeBranch || grnRecord, { preserveTypePrefix: true }) || grnRecord.grn_number)
                                : (formatConfiguredPurchaseOrderNumber(purchaseOrder?.po_number, activeBranch || purchaseOrder, { preserveTypePrefix: true }) || purchaseOrder?.po_number)}</span>
                        </div>
                    )}
                    {!isReadOnly ? (
                        <button className={styles.btnPrimary} onClick={() => void handleReceive()} disabled={saving || loading || !purchaseOrder}>
                            {saving ? 'Posting...' : <><ClipboardCheck size={16} />Post Receipt</>}
                        </button>
                    ) : (
                        <>
                            {canCaptureBill && (
                                <button className={styles.btnPrimary} onClick={() => void handleCaptureBill()} disabled={billSaving}>
                                    {billSaving ? 'Saving Bill...' : <><ClipboardCheck size={16} />Capture Vendor Bill</>}
                                </button>
                            )}
                            {canCreateReturn && (
                                <button className={styles.btnSecondary} onClick={() => setShowReturnForm((value) => !value)} disabled={returnSaving}>
                                    {showReturnForm ? 'Hide Return Form' : 'Post Purchase Return'}
                                </button>
                            )}
                            {canCreateCreditNote && (
                                <button className={styles.btnSecondary} onClick={() => setShowCreditNoteForm((value) => !value)} disabled={creditNoteSaving}>
                                    {showCreditNoteForm ? 'Hide Credit Note Form' : 'Post Vendor Credit Note'}
                                </button>
                            )}
                            <div className={styles.savedIndicator}>
                                <CheckCircle2 size={16} />
                                Posted
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.body}>
                <div className={styles.metaCard}>
                    <div className={styles.metaGrid}>
                        {!isReadOnly && (
                            <div className={styles.fieldGroup}>
                                <label>Purchase Order</label>
                                <select value={selectedPoId || ''} onChange={(event) => void handleSelectPurchaseOrder(Number(event.target.value || 0))} className={styles.select}>
                                    <option value="">Select purchase order</option>
                                    {purchaseOrders.map((po) => (
                                        <option key={po.id} value={po.id}>
                                            {(formatConfiguredPurchaseOrderNumber(po.po_number || `PO-${po.id}`, activeBranch || po, { preserveTypePrefix: true }) || po.po_number || `PO-${po.id}`)} | {po.vendor?.vendor_name || 'Vendor'} | {po.destination_branch?.branch_name || po.branch?.branch_name || 'Branch'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className={styles.fieldGroup}>
                            <label>Vendor</label>
                            <input className={styles.input} value={grnRecord?.vendor?.vendor_name || purchaseOrder?.vendor?.vendor_name || ''} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Destination Branch</label>
                            <input className={styles.input} value={grnRecord?.branch?.branch_name || purchaseOrder?.destination_branch?.branch_name || purchaseOrder?.branch?.branch_name || ''} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Receipt Date</label>
                            <div className={styles.inputWithIcon}>
                                <Calendar size={14} />
                                <input className={styles.input} value={grnRecord?.receipt_date ? new Date(grnRecord.receipt_date).toLocaleDateString() : new Date().toLocaleDateString()} readOnly />
                            </div>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Vendor Bill Reference</label>
                            <input className={styles.input} value={vendorBillReference} onChange={(event) => setVendorBillReference(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Bill Date</label>
                            <input className={styles.input} type="date" value={vendorBillDate} onChange={(event) => setVendorBillDate(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Bill Due Date</label>
                            <input className={styles.input} type="date" value={vendorBillDueDate} onChange={(event) => setVendorBillDueDate(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Bill Amount</label>
                            <input className={styles.input} type="number" min="0" step="0.01" value={vendorBillAmount} onChange={(event) => setVendorBillAmount(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payable Status</label>
                            <input className={styles.input} value={String(payableStatus).replace(/_/g, ' ')} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Liability Posting</label>
                            <input className={styles.input} value={liabilityPosting} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Notes</label>
                            <input className={styles.input} value={notes} onChange={(event) => setNotes(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
                        </div>
                    </div>
                </div>

                {isReadOnly && (
                    <div className={styles.returnSummaryGrid}>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>{Number(grnRecord?.returns?.document_count || 0)}</span>
                            <span className={styles.returnSummaryLabel}>Return Docs</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.returns?.quantity_total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Returned Qty</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.returns?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Returned Value</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.payable?.accrued_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Net Liability</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.payable?.variance_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Bill Variance</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.credit_notes?.approved_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Approved Credits</span>
                        </div>
                    </div>
                )}

                {isReadOnly && showReturnForm && (
                    <div className={styles.returnCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <AlertCircle size={18} />
                                <span>Purchase Return / Debit Note</span>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => void handleCreateReturn()} disabled={returnSaving}>
                                {returnSaving ? 'Posting Return...' : 'Finalize Return'}
                            </button>
                        </div>
                        <div className={styles.metaGrid}>
                            <div className={styles.fieldGroup}>
                                <label>Return Date</label>
                                <input className={styles.input} type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Debit Note Reference</label>
                                <input className={styles.input} value={debitNoteReference} onChange={(event) => setDebitNoteReference(event.target.value)} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Return Notes</label>
                                <input className={styles.input} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} />
                            </div>
                        </div>
                        <div className={styles.tableWrap}>
                            <div className={styles.tableHeader}>
                                <span style={{ flex: 1, minWidth: '180px' }}>Item</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Received</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Returned</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Remaining</span>
                                <span style={{ width: '90px', textAlign: 'right' }}>Return Qty</span>
                                <span style={{ width: '120px', textAlign: 'right' }}>Line Value</span>
                            </div>
                            {returnLines.map((line) => (
                                <div key={line.grn_item_id} className={styles.lineRow}>
                                    <div style={{ flex: 1, minWidth: '180px' }}><input value={line.item_name} className={styles.cellInput} readOnly /></div>
                                    <div style={{ width: '90px' }}><input value={line.receivedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                    <div style={{ width: '90px' }}><input value={line.returnedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                    <div style={{ width: '90px' }}><input value={line.remainingQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                    <div style={{ width: '90px' }}>
                                        <input
                                            type="number"
                                            min={0}
                                            max={line.remainingQty}
                                            value={line.returnQty}
                                            onChange={(event) => updateReturnLine(line.grn_item_id, event.target.value)}
                                            className={styles.cellInput}
                                            style={{ textAlign: 'right' }}
                                        />
                                    </div>
                                    <div style={{ width: '120px', textAlign: 'right', fontWeight: 700 }}>
                                        {(line.returnQty * line.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={styles.returnFooter}>
                            <span>Return Value</span>
                            <strong>{returnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                )}

                {isReadOnly && showCreditNoteForm && (
                    <div className={styles.returnCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <AlertCircle size={18} />
                                <span>Vendor Credit Note / Rebate</span>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => void handleCreateCreditNote()} disabled={creditNoteSaving}>
                                {creditNoteSaving ? 'Submitting Credit...' : 'Submit Credit Note'}
                            </button>
                        </div>
                        <div className={styles.metaGrid}>
                            <div className={styles.fieldGroup}>
                                <label>Credit Note Date</label>
                                <input className={styles.input} type="date" value={creditNoteDate} onChange={(event) => setCreditNoteDate(event.target.value)} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Credit Note Reference</label>
                                <input className={styles.input} value={creditNoteReference} onChange={(event) => setCreditNoteReference(event.target.value)} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Credit Amount</label>
                                <input className={styles.input} type="number" min="0" step="0.01" value={creditNoteAmount} onChange={(event) => setCreditNoteAmount(event.target.value)} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Credit Note Notes</label>
                                <input className={styles.input} value={creditNoteNotes} onChange={(event) => setCreditNoteNotes(event.target.value)} />
                            </div>
                        </div>
                        <div className={styles.controlAlert}>
                            <AlertCircle size={14} />
                            <span><strong>Control Rule:</strong> vendor credit notes do not change stock. Approval reduces the linked GRN liability and credits <strong>Purchase Credits & Rebates</strong>.</span>
                        </div>
                    </div>
                )}

                <div className={styles.lineItemsCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>
                            <Package size={18} />
                            <span>Receipt Lines</span>
                        </div>
                    </div>
                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <span style={{ flex: 1, minWidth: '180px' }}>Item</span>
                            <span style={{ width: '90px', textAlign: 'right' }}>Ordered</span>
                            <span style={{ width: '90px', textAlign: 'right' }}>Prev.</span>
                            <span style={{ width: '90px', textAlign: 'right' }}>Remaining</span>
                            <span style={{ width: '90px', textAlign: 'right' }}>{isReadOnly ? 'Received' : 'Post Qty'}</span>
                            <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                            <span style={{ width: '120px', textAlign: 'right' }}>Line Total</span>
                        </div>
                        {loading ? (
                            <div className={styles.lineRow}>Loading receipt lines...</div>
                        ) : lineItems.length === 0 ? (
                            <div className={styles.lineRow}>Select a purchase order to load its remaining receipt lines.</div>
                        ) : lineItems.map((line) => (
                            <div key={line.id} className={styles.lineRow}>
                                <div style={{ flex: 1, minWidth: '180px' }}><input value={line.item_name} className={styles.cellInput} readOnly /></div>
                                <div style={{ width: '90px' }}><input value={line.orderedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                <div style={{ width: '90px' }}><input value={line.alreadyReceivedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                <div style={{ width: '90px' }}><input value={line.remainingQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                <div style={{ width: '90px' }}>
                                    <input type="number" min={0} max={line.remainingQty} value={line.receivedQty} onChange={(event) => updateLine(line.id, event.target.value)} className={styles.cellInput} style={{ textAlign: 'right' }} readOnly={isReadOnly} />
                                </div>
                                <div style={{ width: '110px' }}><input value={line.unitCost} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                <div style={{ width: '120px', textAlign: 'right', fontWeight: 700 }}>{(line.receivedQty * line.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                        ))}
                    </div>
                    <div className={styles.totalsRow}>
                        <div className={styles.totalsSummary}>
                            <div className={styles.totalChip}>
                                <span>{lineItems.length} items</span>
                                <span className={styles.chipSep}>|</span>
                                <span>Total Value: <strong>{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {isReadOnly && (grnRecord?.returns?.history || []).length > 0 && (
                    <div className={styles.returnHistoryCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <ClipboardCheck size={18} />
                                <span>Return History</span>
                            </div>
                        </div>
                        <div className={styles.returnHistoryList}>
                            {(grnRecord?.returns?.history || []).map((returnDoc: any) => (
                                <div key={returnDoc.id} className={styles.returnHistoryRow}>
                                    <div>
                                        <strong>{returnDoc.return_number}</strong>
                                        <small>
                                            {returnDoc.debit_note_reference || 'Debit note pending'}
                                            {' | '}
                                            {returnDoc.return_date ? new Date(returnDoc.return_date).toLocaleDateString() : '-'}
                                        </small>
                                    </div>
                                    <div className={styles.returnHistoryMeta}>
                                        <span>{Number(returnDoc.quantity_total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} qty</span>
                                        <strong>{Number(returnDoc.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isReadOnly && (grnRecord?.credit_notes?.history || []).length > 0 && (
                    <div className={styles.returnHistoryCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                                <ClipboardCheck size={18} />
                                <span>Credit Note History</span>
                            </div>
                        </div>
                        <div className={styles.returnHistoryList}>
                            {(grnRecord?.credit_notes?.history || []).map((creditDoc: any) => (
                                <div key={creditDoc.id} className={styles.returnHistoryRow}>
                                    <div>
                                        <strong>{formatConfiguredExpenseVoucherNumber(creditDoc.voucher_no, activeBranch || creditDoc, { preserveTypePrefix: true }) || creditDoc.voucher_no}</strong>
                                        <small>
                                            {creditDoc.reference_no || 'Reference pending'}
                                            {' | '}
                                            {creditDoc.voucher_date ? new Date(creditDoc.voucher_date).toLocaleDateString() : '-'}
                                            {' | '}
                                            {String(creditDoc.status || '').replace(/_/g, ' ')}
                                        </small>
                                    </div>
                                    <div className={styles.returnHistoryMeta}>
                                        <span>{creditDoc.description || 'Vendor rebate / purchase adjustment'}</span>
                                        <strong>{Number(creditDoc.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.controlAlert}>
                    <AlertCircle size={14} />
                    <span><strong>Control Rule:</strong> each posted GRN increases stock in the destination branch, writes to <strong>inventory_stock_ledger</strong>, refreshes <strong>inventory_stock_levels</strong>, and keeps the PO open until all remaining quantities are posted. Purchase returns reverse inventory and reduce either <strong>GRNI</strong> or <strong>Accounts Payable</strong> depending on bill status.</span>
                </div>
            </div>
        </div>
    );
}
