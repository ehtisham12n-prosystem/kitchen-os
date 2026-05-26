import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ClipboardCheck, Hash, Package, Plus, Trash2, Truck } from 'lucide-react';
import styles from './GRNForm.module.css';
import { accountingApi, branchApi, inventoryApi, setupApi, vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { formatConfiguredExpenseVoucherNumber, formatConfiguredGrnNumber, formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';

type PurchaseSourceType = 'PO' | 'NON_PO';
type PaymentStatus = 'PAID' | 'PARTIAL_PAID' | 'CREDIT';

interface ReceiptLine {
    id: string;
    item_id: number;
    item_name: string;
    orderedQty: number;
    alreadyReceivedQty: number;
    remainingQty: number;
    receivedQty: number;
    unitCost: number;
    uom: string;
    remarks: string;
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

interface InventoryItemOption {
    id: number;
    item_name: string;
    uom_base?: string | null;
    uom_purchase?: string | null;
}

interface VendorOption {
    id: number;
    vendor_name: string;
}

interface BranchOption {
    id: number;
    branch_name: string;
    branch_code?: string;
}

interface GRNFormProps {
    onClose?: () => void;
}

const PAYMENT_METHOD_FALLBACKS = ['Cash', 'Bank Transfer', 'Petty Cash', 'Cheque', 'Digital Wallet', 'Other'];
const PAYMENT_SOURCE_OPTIONS = ['Accounts Payable', 'Petty Cash', 'Cash Purchase', 'Expense Claim', 'Other'];

function createEmptyLine(): ReceiptLine {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        item_id: 0,
        item_name: '',
        orderedQty: 0,
        alreadyReceivedQty: 0,
        remainingQty: 0,
        receivedQty: 1,
        unitCost: 0,
        uom: '',
        remarks: '',
    };
}

function flattenInventoryHierarchy(hierarchy: any[]): InventoryItemOption[] {
    const items: InventoryItemOption[] = [];
    for (const inventoryClass of hierarchy || []) {
        for (const type of inventoryClass?.types || []) {
            for (const subType of type?.subTypes || []) {
                for (const item of subType?.items || []) {
                    items.push({
                        id: Number(item.id),
                        item_name: item.item_name || `Item #${item.id}`,
                        uom_base: item.uom_base || null,
                        uom_purchase: item.uom_purchase || null,
                    });
                }
            }
        }
    }
    return items.sort((a, b) => a.item_name.localeCompare(b.item_name));
}

function formatDateInput(value?: string | Date | null) {
    if (!value) return '';
    const text = String(value);
    return text.includes('T') ? text.slice(0, 10) : text.slice(0, 10);
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
    const today = new Date().toISOString().slice(0, 10);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [vendors, setVendors] = useState<VendorOption[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

    const [purchaseSourceType, setPurchaseSourceType] = useState<PurchaseSourceType>('PO');
    const [selectedPoId, setSelectedPoId] = useState<number>(poIdFromQuery);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [purchaseOrder, setPurchaseOrder] = useState<any | null>(null);
    const [grnRecord, setGrnRecord] = useState<any | null>(null);
    const [lineItems, setLineItems] = useState<ReceiptLine[]>([]);
    const [receiptDate, setReceiptDate] = useState(today);
    const [vendorBillReference, setVendorBillReference] = useState('');
    const [vendorBillDate, setVendorBillDate] = useState('');
    const [vendorBillDueDate, setVendorBillDueDate] = useState('');
    const [vendorBillAmount, setVendorBillAmount] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('CREDIT');
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentDate, setPaymentDate] = useState(today);
    const [paymentSource, setPaymentSource] = useState('Accounts Payable');
    const [notes, setNotes] = useState('');
    const [billSaving, setBillSaving] = useState(false);
    const [showReturnForm, setShowReturnForm] = useState(false);
    const [returnSaving, setReturnSaving] = useState(false);
    const [returnDate, setReturnDate] = useState(today);
    const [debitNoteReference, setDebitNoteReference] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
    const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
    const [creditNoteSaving, setCreditNoteSaving] = useState(false);
    const [creditNoteDate, setCreditNoteDate] = useState(today);
    const [creditNoteReference, setCreditNoteReference] = useState('');
    const [creditNoteAmount, setCreditNoteAmount] = useState('');
    const [creditNoteNotes, setCreditNoteNotes] = useState('');

    const selectedVendor = useMemo(
        () => vendors.find((vendor) => String(vendor.id) === selectedVendorId) ?? null,
        [selectedVendorId, vendors],
    );
    const selectedBranch = useMemo(
        () => branches.find((branch) => String(branch.id) === selectedBranchId) ?? null,
        [branches, selectedBranchId],
    );

    const totalValue = useMemo(
        () => lineItems.reduce((sum, item) => sum + (Number(item.receivedQty || 0) * Number(item.unitCost || 0)), 0),
        [lineItems],
    );
    const normalizedPaidAmount = Number(paidAmount || 0);
    const outstandingAmount = useMemo(() => {
        if (paymentStatus === 'PAID') return 0;
        if (paymentStatus === 'PARTIAL_PAID') return Math.max(totalValue - normalizedPaidAmount, 0);
        return Number(vendorBillAmount || totalValue || 0);
    }, [normalizedPaidAmount, paymentStatus, totalValue, vendorBillAmount]);
    const payableStatus = grnRecord?.payable_status || ((paymentStatus === 'PAID' || paymentStatus === 'PARTIAL_PAID' || vendorBillReference || vendorBillDate || vendorBillDueDate) ? 'bill_received' : 'pending_bill');
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

    const resetCreateFields = () => {
        setReceiptDate(today);
        setVendorBillReference('');
        setVendorBillDate('');
        setVendorBillDueDate('');
        setVendorBillAmount('');
        setPaymentStatus('CREDIT');
        setPaidAmount('');
        setPaymentMethod('');
        setPaymentReference('');
        setPaymentDate(today);
        setPaymentSource('Accounts Payable');
        setNotes('');
    };

    const hydrateFromPurchaseOrder = (po: any) => {
        setPurchaseSourceType('PO');
        setSelectedPoId(Number(po.id));
        setPurchaseOrder(po);
        setGrnRecord(null);
        setSelectedVendorId(po.vendor?.id ? String(po.vendor.id) : '');
        setSelectedBranchId(String(po.destination_branch_id || po.branch_id || po.destination_branch?.id || po.branch?.id || ''));
        resetCreateFields();
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
                uom: item.item?.uom_purchase || item.item?.uom_base || '',
                remarks: '',
            })));
    };

    const hydrateFromGrn = (grn: any) => {
        setGrnRecord(grn);
        setPurchaseSourceType((grn.purchase_source_type || (grn.purchase_order ? 'PO' : 'NON_PO')) as PurchaseSourceType);
        setSelectedPoId(Number(grn.purchase_order?.id || 0));
        setPurchaseOrder(grn.purchase_order ? {
            id: grn.purchase_order.id,
            po_number: grn.purchase_order.po_number,
            approval_status: grn.purchase_order.approval_status,
            status: grn.purchase_order.status,
            vendor: grn.vendor,
            branch: grn.branch,
            destination_branch: grn.branch,
        } : null);
        setSelectedVendorId(grn.vendor?.id ? String(grn.vendor.id) : '');
        setSelectedBranchId(grn.branch?.id ? String(grn.branch.id) : '');
        setReceiptDate(formatDateInput(grn.receipt_date) || today);
        setVendorBillReference(grn.vendor_bill_reference || grn.vendor_invoice_number || '');
        setVendorBillDate(formatDateInput(grn.vendor_bill_date));
        setVendorBillDueDate(formatDateInput(grn.vendor_bill_due_date));
        setVendorBillAmount(grn.vendor_bill_amount !== null && grn.vendor_bill_amount !== undefined ? String(Number(grn.vendor_bill_amount)) : '');
        setPaymentStatus((grn.payment_status || 'CREDIT') as PaymentStatus);
        setPaidAmount(grn.paid_amount !== null && grn.paid_amount !== undefined ? String(Number(grn.paid_amount)) : '');
        setPaymentMethod(grn.payment_method || '');
        setPaymentReference(grn.payment_reference || '');
        setPaymentDate(formatDateInput(grn.payment_date) || today);
        setPaymentSource(grn.payment_source || 'Accounts Payable');
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
            uom: item.item_uom || '',
            remarks: item.notes || '',
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
        setReturnDate(today);
        setDebitNoteReference('');
        setReturnNotes('');
        setCreditNoteDate(today);
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
                    return;
                }

                const [poRows, vendorRows, branchRows, hierarchy, paymentMethodRows] = await Promise.all([
                    inventoryApi.getPurchaseOrders(),
                    vendorApi.getVendors(),
                    branchApi.getBranches(),
                    inventoryApi.getHierarchy(),
                    setupApi.getPaymentMethods().catch(() => []),
                ]);
                const openRows = poRows.filter((po) => po.status !== 'cancelled' && !po.receipt_summary?.fully_received);
                setPurchaseOrders(openRows);
                setVendors((vendorRows || []).map((vendor: any) => ({ id: Number(vendor.id), vendor_name: vendor.vendor_name || `Vendor ${vendor.id}` })));
                setBranches((branchRows || []).map((branch: any) => ({ id: Number(branch.id), branch_name: branch.branch_name || `Branch ${branch.id}`, branch_code: branch.branch_code || '' })));
                setInventoryItems(flattenInventoryHierarchy(hierarchy || []));
                setPaymentMethods(Array.from(new Set([
                    ...PAYMENT_METHOD_FALLBACKS,
                    ...(paymentMethodRows || []).filter((row: any) => row.is_active !== false).map((row: any) => row.method_name).filter(Boolean),
                ])));

                if (poIdFromQuery) {
                    hydrateFromPurchaseOrder(openRows.find((row) => Number(row.id) === poIdFromQuery) ?? await inventoryApi.getPurchaseOrder(poIdFromQuery));
                } else {
                    setPurchaseSourceType('PO');
                    setLineItems([]);
                }
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load receiving data.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [grnId, isReadOnly, poIdFromQuery]);

    if (!hasGoodsReceiptAccess) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <p>Your current role does not include goods receipt access.</p>
                </div>
            </div>
        );
    }

    const updateLine = (lineId: string, field: keyof ReceiptLine, nextValue: string | number) => {
        if (isReadOnly) return;
        setLineItems((current) => current.map((item) =>
            item.id === lineId ? { ...item, [field]: nextValue } : item,
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

    const handleSwitchPurchaseSource = (nextType: PurchaseSourceType) => {
        if (isReadOnly) return;
        setPurchaseSourceType(nextType);
        resetCreateFields();
        if (nextType === 'PO') {
            setPurchaseOrder(null);
            setSelectedPoId(0);
            setSelectedVendorId('');
            setSelectedBranchId('');
            setLineItems([]);
            return;
        }
        setSelectedPoId(0);
        setPurchaseOrder(null);
        setSelectedVendorId('');
        setSelectedBranchId('');
        setLineItems([createEmptyLine()]);
    };

    const handleSelectInventoryItem = (lineId: string, itemId: number) => {
        const selectedItem = inventoryItems.find((item) => item.id === itemId);
        setLineItems((current) => current.map((line) => {
            if (line.id !== lineId) return line;
            return {
                ...line,
                item_id: itemId,
                item_name: selectedItem?.item_name || '',
                uom: selectedItem?.uom_purchase || selectedItem?.uom_base || '',
            };
        }));
    };

    const handleAddLine = () => {
        setLineItems((current) => [...current, createEmptyLine()]);
    };

    const handleRemoveLine = (lineId: string) => {
        setLineItems((current) => current.length <= 1 ? current : current.filter((line) => line.id !== lineId));
    };

    const handleReceive = async () => {
        if (!canReceiveInventory) {
            toast.error('Access Denied', 'Your current role cannot post goods receipts.');
            return;
        }
        if (purchaseSourceType === 'PO' && !purchaseOrder) {
            toast.error('Purchase Order Required', 'Select a purchase order to receive.');
            return;
        }
        if (purchaseSourceType === 'NON_PO' && !selectedVendorId) {
            toast.error('Vendor Required', 'Select a vendor for the direct purchase receipt.');
            return;
        }
        if (purchaseSourceType === 'NON_PO' && !selectedBranchId) {
            toast.error('Destination Branch Required', 'Select the destination branch for the direct purchase receipt.');
            return;
        }
        if (vendorBillDate && vendorBillDueDate && vendorBillDueDate < vendorBillDate) {
            toast.error('Validation Error', 'Bill due date cannot be before bill date.');
            return;
        }

        const positiveLines = lineItems
            .map((item) => ({
                item_id: Number(item.item_id || 0),
                quantity: Number(item.receivedQty || 0),
                unit_cost: Number(item.unitCost || 0),
                uom: item.uom || undefined,
                notes: item.remarks?.trim() || undefined,
            }))
            .filter((item) => item.quantity > 0);

        if (positiveLines.length === 0) {
            toast.error('Receipt Required', 'At least one line must have a positive receipt quantity.');
            return;
        }

        if (purchaseSourceType === 'PO') {
            const overReceivedLine = lineItems.find((line) => Number(line.receivedQty || 0) - Number(line.remainingQty || 0) > 0.0001);
            if (overReceivedLine) {
                toast.error('Validation Error', `${overReceivedLine.item_name} exceeds the remaining PO quantity.`);
                return;
            }
        } else {
            const invalidItemLine = positiveLines.find((line) => !line.item_id);
            if (invalidItemLine) {
                toast.error('Validation Error', 'Every receipt row must reference an inventory item.');
                return;
            }
            const invalidCostLine = positiveLines.find((line) => Number(line.unit_cost) <= 0);
            if (invalidCostLine) {
                toast.error('Validation Error', 'Unit cost must be greater than zero for direct purchase lines.');
                return;
            }
        }

        if (paymentStatus === 'PAID' || paymentStatus === 'PARTIAL_PAID') {
            if (!paymentMethod) {
                toast.error('Validation Error', 'Payment method is required when payment has been made.');
                return;
            }
            if (paymentStatus === 'PAID' && Math.abs(normalizedPaidAmount - totalValue) > 0.009) {
                toast.error('Validation Error', 'Paid amount must match the full bill amount for fully paid receipts.');
                return;
            }
            if (paymentStatus === 'PARTIAL_PAID' && (normalizedPaidAmount <= 0 || normalizedPaidAmount >= totalValue)) {
                toast.error('Validation Error', 'Partial paid amount must be greater than zero and less than the total bill amount.');
                return;
            }
        }

        setSaving(true);
        try {
            const branchId = purchaseSourceType === 'PO'
                ? Number(purchaseOrder.destination_branch_id || purchaseOrder.branch_id || purchaseOrder.branch?.id)
                : Number(selectedBranchId);
            const receipt = await inventoryApi.postGrn({
                purchase_source_type: purchaseSourceType,
                branch_id: branchId,
                vendor_id: purchaseSourceType === 'NON_PO' ? Number(selectedVendorId) : undefined,
                po_id: purchaseSourceType === 'PO' ? purchaseOrder.id : undefined,
                receipt_date: receiptDate || undefined,
                vendor_bill_reference: vendorBillReference || undefined,
                vendor_invoice_number: vendorBillReference || undefined,
                vendor_bill_date: vendorBillDate || undefined,
                vendor_bill_due_date: vendorBillDueDate || undefined,
                vendor_bill_amount: vendorBillAmount ? Number(vendorBillAmount) : undefined,
                payment_status: paymentStatus,
                paid_amount: paymentStatus === 'CREDIT' ? 0 : normalizedPaidAmount,
                outstanding_amount: outstandingAmount,
                payment_method: paymentStatus === 'CREDIT' ? undefined : paymentMethod || undefined,
                payment_reference: paymentStatus === 'CREDIT' ? undefined : paymentReference || undefined,
                payment_date: paymentStatus === 'CREDIT' ? undefined : paymentDate || undefined,
                payment_source: paymentSource || undefined,
                notes: notes || undefined,
                items: positiveLines,
            });
            toast.success('Stock Received', 'Inventory has been posted and a GRN was created.');
            navigate(`/console/inventory/grn/${receipt.id}`);
        } catch (error: any) {
            toast.error('Receipt Failed', error.message || 'Could not post this goods receipt.');
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

    const showManualColumns = isReadOnly ? purchaseSourceType === 'NON_PO' : purchaseSourceType === 'NON_PO';

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
                        <p className={styles.subtitle}>{isReadOnly ? 'View the posted receipt, bill reference, payable metadata, and purchase returns.' : 'Receive approved purchase orders or post direct vendor purchases into inventory.'}</p>
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
                        <button className={styles.btnPrimary} onClick={() => void handleReceive()} disabled={saving || loading || (purchaseSourceType === 'PO' && !purchaseOrder)}>
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
                                <label>Purchase Source</label>
                                <select value={purchaseSourceType} onChange={(event) => handleSwitchPurchaseSource(event.target.value as PurchaseSourceType)} className={styles.select}>
                                    <option value="PO">Purchase Order (PO-Based)</option>
                                    <option value="NON_PO">Direct Purchase / Non-PO</option>
                                </select>
                            </div>
                        )}
                        {!isReadOnly && purchaseSourceType === 'PO' && (
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
                            {isReadOnly || purchaseSourceType === 'PO' ? (
                                <input className={styles.input} value={grnRecord?.vendor?.vendor_name || purchaseOrder?.vendor?.vendor_name || selectedVendor?.vendor_name || ''} readOnly />
                            ) : (
                                <select className={styles.select} value={selectedVendorId} onChange={(event) => setSelectedVendorId(event.target.value)}>
                                    <option value="">Select vendor</option>
                                    {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Destination Branch</label>
                            {isReadOnly || purchaseSourceType === 'PO' ? (
                                <input className={styles.input} value={grnRecord?.branch?.branch_name || purchaseOrder?.destination_branch?.branch_name || purchaseOrder?.branch?.branch_name || selectedBranch?.branch_name || ''} readOnly />
                            ) : (
                                <select className={styles.select} value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
                                    <option value="">Select destination branch</option>
                                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Receipt Date</label>
                            {isReadOnly ? (
                                <div className={styles.inputWithIcon}>
                                    <Calendar size={14} />
                                    <input className={styles.input} value={grnRecord?.receipt_date ? new Date(grnRecord.receipt_date).toLocaleDateString() : ''} readOnly />
                                </div>
                            ) : (
                                <input className={styles.input} type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
                            )}
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
                            <label>Payment Status</label>
                            {isReadOnly ? (
                                <input className={styles.input} value={paymentStatus.replace(/_/g, ' ')} readOnly />
                            ) : (
                                <select className={styles.select} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                                    <option value="PAID">Paid</option>
                                    <option value="PARTIAL_PAID">Partial Paid</option>
                                    <option value="CREDIT">Credit</option>
                                </select>
                            )}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Paid Amount</label>
                            <input className={styles.input} type="number" min="0" step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} readOnly={isReadOnly || paymentStatus === 'CREDIT'} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Outstanding Amount</label>
                            <input className={styles.input} value={outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payment Method</label>
                            {isReadOnly ? (
                                <input className={styles.input} value={paymentMethod || ''} readOnly />
                            ) : (
                                <select className={styles.select} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={paymentStatus === 'CREDIT'}>
                                    <option value="">{paymentStatus === 'CREDIT' ? 'Not required for credit' : 'Select payment method'}</option>
                                    {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                                </select>
                            )}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payment Date</label>
                            <input className={styles.input} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} readOnly={isReadOnly} disabled={!isReadOnly && paymentStatus === 'CREDIT'} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payment Reference</label>
                            <input className={styles.input} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} readOnly={isReadOnly} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payment Source</label>
                            {isReadOnly ? (
                                <input className={styles.input} value={paymentSource || ''} readOnly />
                            ) : (
                                <select className={styles.select} value={paymentSource} onChange={(event) => setPaymentSource(event.target.value)}>
                                    {PAYMENT_SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            )}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Payable Status</label>
                            <input className={styles.input} value={String(payableStatus).replace(/_/g, ' ')} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Liability Posting</label>
                            <input className={styles.input} value={liabilityPosting} readOnly />
                        </div>
                        <div className={`${styles.fieldGroup} ${styles.notesField}`}>
                            <label>Notes</label>
                            <textarea className={styles.textarea} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} readOnly={isReadOnly && !canCaptureBill} />
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
                            <span className={styles.returnSummaryLabel}>Open Liability</span>
                        </div>
                        <div className={styles.returnSummaryCard}>
                            <span className={styles.returnSummaryValue}>
                                {Number(grnRecord?.payable?.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={styles.returnSummaryLabel}>Paid Amount</span>
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
                        {!isReadOnly && purchaseSourceType === 'NON_PO' && (
                            <button className={styles.addLineBtn} onClick={handleAddLine} type="button">
                                <Plus size={14} />
                                Add Item
                            </button>
                        )}
                    </div>
                    <div className={styles.tableWrap}>
                        <div className={`${styles.tableHeader} ${showManualColumns ? styles.manualTableHeader : ''}`}>
                            <span style={{ flex: 1, minWidth: '180px' }}>Item</span>
                            {showManualColumns ? (
                                <>
                                    <span style={{ width: '100px', textAlign: 'left' }}>UOM</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>{isReadOnly ? 'Received' : 'Qty'}</span>
                                    <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                                    <span style={{ width: '120px', textAlign: 'right' }}>Line Total</span>
                                    <span style={{ width: '160px', textAlign: 'left' }}>Remarks</span>
                                    {!isReadOnly && <span style={{ width: '44px', textAlign: 'center' }}> </span>}
                                </>
                            ) : (
                                <>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Ordered</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Prev.</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>Remaining</span>
                                    <span style={{ width: '90px', textAlign: 'right' }}>{isReadOnly ? 'Received' : 'Post Qty'}</span>
                                    <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                                    <span style={{ width: '120px', textAlign: 'right' }}>Line Total</span>
                                </>
                            )}
                        </div>
                        {loading ? (
                            <div className={styles.lineRow}>Loading receipt lines...</div>
                        ) : lineItems.length === 0 ? (
                            <div className={styles.lineRow}>{purchaseSourceType === 'PO' ? 'Select a purchase order to load its remaining receipt lines.' : 'Add at least one direct purchase line item.'}</div>
                        ) : lineItems.map((line) => (
                            <div key={line.id} className={`${styles.lineRow} ${showManualColumns ? styles.manualLineRow : ''}`}>
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                    {showManualColumns && !isReadOnly ? (
                                        <select value={line.item_id || ''} onChange={(event) => handleSelectInventoryItem(line.id, Number(event.target.value || 0))} className={styles.cellSelect}>
                                            <option value="">Select inventory item</option>
                                            {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.item_name}</option>)}
                                        </select>
                                    ) : (
                                        <input value={line.item_name} className={styles.cellInput} readOnly />
                                    )}
                                </div>
                                {showManualColumns ? (
                                    <>
                                        <div style={{ width: '100px' }}>
                                            {isReadOnly ? (
                                                <input value={line.uom} className={styles.cellInput} readOnly />
                                            ) : (
                                                <input value={line.uom} className={styles.cellInput} onChange={(event) => updateLine(line.id, 'uom', event.target.value)} />
                                            )}
                                        </div>
                                        <div style={{ width: '90px' }}>
                                            <input type="number" min={0} value={line.receivedQty} onChange={(event) => updateLine(line.id, 'receivedQty', Number(event.target.value || 0))} className={styles.cellInput} style={{ textAlign: 'right' }} readOnly={isReadOnly} />
                                        </div>
                                        <div style={{ width: '110px' }}>
                                            <input type="number" min={0} step="0.01" value={line.unitCost} onChange={(event) => updateLine(line.id, 'unitCost', Number(event.target.value || 0))} className={styles.cellInput} style={{ textAlign: 'right' }} readOnly={isReadOnly} />
                                        </div>
                                        <div style={{ width: '120px', textAlign: 'right', fontWeight: 700 }}>
                                            {(line.receivedQty * line.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ width: '160px' }}>
                                            <input value={line.remarks} onChange={(event) => updateLine(line.id, 'remarks', event.target.value)} className={styles.cellInput} readOnly={isReadOnly} />
                                        </div>
                                        {!isReadOnly && (
                                            <div style={{ width: '44px', display: 'flex', justifyContent: 'center' }}>
                                                <button type="button" className={styles.removeBtn} onClick={() => handleRemoveLine(line.id)} disabled={lineItems.length === 1}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div style={{ width: '90px' }}><input value={line.orderedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                        <div style={{ width: '90px' }}><input value={line.alreadyReceivedQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                        <div style={{ width: '90px' }}><input value={line.remainingQty} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                        <div style={{ width: '90px' }}>
                                            <input type="number" min={0} max={line.remainingQty} value={line.receivedQty} onChange={(event) => updateLine(line.id, 'receivedQty', Number(event.target.value || 0))} className={styles.cellInput} style={{ textAlign: 'right' }} readOnly={isReadOnly} />
                                        </div>
                                        <div style={{ width: '110px' }}><input value={line.unitCost} className={styles.cellInput} readOnly style={{ textAlign: 'right' }} /></div>
                                        <div style={{ width: '120px', textAlign: 'right', fontWeight: 700 }}>{(line.receivedQty * line.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </>
                                )}
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
                    <span><strong>Control Rule:</strong> posted GRNs increase stock in the destination branch, write to <strong>inventory_stock_ledger</strong>, refresh <strong>inventory_stock_levels</strong>, and keep PO receipt tracking intact. Direct-purchase receipts stay vendor-linked without creating a PO.</span>
                </div>
            </div>
        </div>
    );
}
