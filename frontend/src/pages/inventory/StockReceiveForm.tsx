import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { ArrowLeft, Save, Plus, Trash2, Box, Store, CheckSquare, Loader2 } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';
import styles from './StockReceiveForm.module.css';

interface ReceiveItem {
    id: string;
    item_id: number;
    name: string;
    orderedQty: number;
    receivedQty: number;
    unit_cost: number;
}

export function StockReceiveForm() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const [searchParams] = useSearchParams();
    const branchId = Number(resolveActiveBranchId() || 0);
    const poId = Number(searchParams.get('poId') || 0);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingItems, setIsFetchingItems] = useState(true);
    const [allInventoryItems, setAllInventoryItems] = useState<any[]>([]);
    const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
    const [receiptNotes, setReceiptNotes] = useState('');
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);

    const [items, setItems] = useState<ReceiveItem[]>([
        { id: 'initial', item_id: 0, name: '', orderedQty: 0, receivedQty: 1, unit_cost: 0 }
    ]);

    useEffect(() => {
        const loadItems = async () => {
            try {
                if (poId) {
                    const po = await inventoryApi.getPurchaseOrder(poId);
                    setVendorInvoiceNumber(
                        formatConfiguredPurchaseOrderNumber(po.po_number || `PO-${po.id}`, activeBranch || po, { preserveTypePrefix: true })
                        || po.po_number || `PO-${po.id}`,
                    );
                    const poItems = (po.items || [])
                        .filter((item: any) => Number(item.remaining_quantity ?? item.quantity ?? 0) > 0)
                        .map((item: any, index: number) => ({
                        id: String(item.id || index),
                        item_id: item.item_id,
                        name: item.item_name || item.item?.item_name || '',
                        orderedQty: Number(item.remaining_quantity ?? item.quantity),
                        receivedQty: Number(item.remaining_quantity ?? item.quantity),
                        unit_cost: Number(item.unit_cost),
                    }));
                    setItems(poItems);
                }
                const hierarchy = await inventoryApi.getHierarchy();
                // Flatten hierarchy to get flat list of items
                const flatItems: any[] = [];
                hierarchy.forEach(cls => {
                    cls.types.forEach((type: any) => {
                        type.subTypes.forEach((st: any) => {
                            st.items.forEach((item: any) => {
                                flatItems.push(item);
                            });
                        });
                    });
                });
                setAllInventoryItems(flatItems);
            } catch (err) {
                console.error('Failed to load inventory items:', err);
            } finally {
                setIsFetchingItems(false);
            }
        };
        loadItems();
    }, [poId]);

    const handleAddItem = () => {
        setItems([...items, { id: Date.now().toString(), item_id: 0, name: '', orderedQty: 0, receivedQty: 1, unit_cost: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleItemSelection = (id: string, itemId: number) => {
        const item = allInventoryItems.find(i => i.id === itemId);
        if (item) {
            setItems(items.map(i => i.id === id ? { ...i, item_id: itemId, name: item.item_name } : i));
        }
    };

    const handleItemChange = (id: string, field: keyof ReceiveItem, value: any) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.receivedQty * item.unit_cost), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchId) {
            toast.error('Branch Missing', 'Select an active branch before receiving stock.');
            return;
        }
        if (items.some(i => i.item_id === 0)) {
            toast.error('Validation Error', 'Please select an inventory item for all rows.');
            return;
        }
        if (items.some(i => Number(i.receivedQty) <= 0)) {
            toast.error('Validation Error', 'Received quantity must be greater than zero for all rows.');
            return;
        }

        setIsLoading(true);
        try {
            const created = await inventoryApi.postGrn({
                branch_id: branchId,
                po_id: poId || undefined,
                receipt_date: receiptDate,
                vendor_invoice_number: vendorInvoiceNumber || undefined,
                notes: receiptNotes || undefined,
                items: items.map((item) => ({
                    item_id: item.item_id,
                    quantity: Number(item.receivedQty),
                    unit_cost: Number(item.unit_cost),
                })),
            });
            toast.success('Received', 'Goods receipt posted successfully.');
            navigate(`/console/inventory/grn/${created.id}`);
        } catch (err) {
            console.error('Failed to receive stock:', err);
            toast.error('Save Failed', err instanceof Error ? err.message : 'Error saving receipt. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate('/console/inventory/ledger')}>
                        <ArrowLeft size={20} />
                    </KitchenButton>
                    <div>
                        <h1>Receive Goods (GRN)</h1>
                        <p>Receive stock into the branch from a vendor or warehouse.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="outline" onClick={() => navigate('/console/inventory/ledger')}>Cancel</KitchenButton>
                    <KitchenButton variant="primary" onClick={handleSubmit} isLoading={isLoading} disabled={isFetchingItems}>
                        <Save size={20} style={{ marginRight: '8px' }} />
                        Confirm Receipt
                    </KitchenButton>
                </div>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                    <div className={styles.mainColumn}>
                        <KitchenCard className={styles.itemsCard}>
                            <div className={styles.cardHeader}>
                                <Box size={20} />
                                <h3>Received Line Items</h3>
                            </div>

                            {isFetchingItems ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <Loader2 className={styles.spinner} />
                                    <p>Loading catalog...</p>
                                </div>
                            ) : (
                                <div className={styles.itemsList}>
                                    <div className={styles.tableHeader}>
                                        <div className={styles.colIndex}>#</div>
                                        <div className={styles.colItem}>Inventory Item</div>
                                        <div className={styles.colQty}>PO Balance</div>
                                        <div className={styles.colQtyRec}>Received Qty</div>
                                        <div className={styles.colCost}>Unit Cost</div>
                                        <div className={styles.colTotal}>Line Total</div>
                                        <div className={styles.colAct}></div>
                                    </div>
                                    {items.map((item, index) => (
                                        <div key={item.id} className={styles.itemRow}>
                                            <div className={styles.colIndex}>{index + 1}</div>
                                            <div className={styles.colItem}>
                                                <select
                                                    className={styles.select}
                                                    value={item.item_id}
                                                    disabled={poId > 0}
                                                    onChange={(e) => handleItemSelection(item.id, Number(e.target.value))}
                                                >
                                                    <option value="0">Select an item...</option>
                                                    {allInventoryItems.map(i => (
                                                        <option key={i.id} value={i.id}>{i.item_name} ({i.uom_base})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.colQty}>
                                                {item.orderedQty > 0 ? item.orderedQty.toFixed(2) : '-'}
                                            </div>
                                            <div className={styles.colQtyRec}>
                                                <KitchenInput
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={item.receivedQty}
                                                    onChange={(e) => handleItemChange(item.id, 'receivedQty', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className={styles.colCost}>
                                                <KitchenInput
                                                    type="number"
                                                    placeholder="Cost"
                                                    value={item.unit_cost}
                                                    onChange={(e) => handleItemChange(item.id, 'unit_cost', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className={styles.colTotal}>
                                                ${(item.receivedQty * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className={styles.colAct}>
                                                <button
                                                    type="button"
                                                    className={styles.removeBtn}
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    disabled={items.length === 1}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={styles.itemsFooter}>
                                {poId > 0 ? (
                                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                        This receipt is tied to a purchase order, so item lines are fixed to the remaining PO balance.
                                    </p>
                                ) : (
                                    <KitchenButton type="button" variant="outline" size="sm" onClick={handleAddItem}>
                                        <Plus size={16} style={{ marginRight: '8px' }} />
                                        Add Another Item
                                    </KitchenButton>
                                )}
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.sideColumn}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Store size={20} />
                                <h3>Delivery Details</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <KitchenInput
                                    label="Vendor Invoice #"
                                    placeholder="e.g. INV-2024-991"
                                    value={vendorInvoiceNumber}
                                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                                />
                                <KitchenInput
                                    label="Receipt Date"
                                    type="date"
                                    value={receiptDate}
                                    onChange={(e) => setReceiptDate(e.target.value)}
                                />
                                <KitchenInput
                                    label="Notes"
                                    placeholder="Optional GRN notes"
                                    value={receiptNotes}
                                    onChange={(e) => setReceiptNotes(e.target.value)}
                                />
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.summaryCard}>
                            <div className={styles.summaryContent}>
                                <CheckSquare size={24} className={styles.checkIcon} />
                                <div>
                                    <h4>Receipt Total</h4>
                                    <p className={styles.costValue}>
                                        ${calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </KitchenCard>
                    </div>
                </div>
            </form>
        </div>
    );
}

