import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { ArrowLeft, AlertTriangle, Key } from 'lucide-react';
import styles from './StockAdjustForm.module.css';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

export function StockAdjustForm() {
    const navigate = useNavigate();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [isLoading, setIsLoading] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const loadItems = async () => {
            try {
                const data = await inventoryApi.getBranchStock(branchId);
                setInventoryItems(data);
            } catch (error) {
                console.error('Failed to load branch stock', error);
            }
        };
        if (branchId) {
            loadItems();
        }
    }, [branchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchId || !itemId || !quantity || !reason) {
            toast.error('Validation Error', 'All required fields must be completed.');
            return;
        }

        setIsLoading(true);
        try {
            const normalizedQuantity = Number(quantity);
            const transactionType = ['SPOILAGE', 'WASTE_PREP'].includes(reason)
                ? 'wastage'
                : 'adjustment';

            await inventoryApi.adjustStock(branchId, {
                item_id: Number(itemId),
                quantity: normalizedQuantity,
                type: transactionType,
                reason,
                notes: [notes, `Reason ${reason}`].filter(Boolean).join(' | '),
            });
            toast.success('Adjusted', 'Stock adjustment posted successfully.');
            navigate('/console/inventory/ledger');
        } catch (error: any) {
            toast.error('Adjustment Failed', error.message || 'Could not post stock adjustment.');
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
                        <h1>Stock Adjustment</h1>
                        <p>Manually correct inventory levels due to spoilage, waste, or counts.</p>
                    </div>
                </div>
            </header>

            <div className={styles.content}>
                <KitchenCard className={styles.card}>
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.warningBanner}>
                            <AlertTriangle size={20} className={styles.warningIcon} />
                            <div className={styles.warningText}>
                                <strong>Warning: Financial Impact</strong>
                                <p>Adjustments directly affect your Cost of Goods Sold (COGS). Negative numbers remove stock, positive numbers add stock.</p>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Inventory Item *</label>
                            <select
                                className={styles.select}
                                required
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                            >
                                <option value="" disabled>-- Select Item --</option>
                                {inventoryItems.map((item) => (
                                    <option key={item.item_id || item.id} value={item.item_id || item.id}>
                                        {item.item?.item_name || `Item ${item.item_id || item.id}`} - Current: {Number(item.current_quantity || 0).toFixed(2)} {item.item?.uom_base || ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.row}>
                            <KitchenInput
                                label="Adjustment Quantity (+/-) *"
                                type="number"
                                placeholder="e.g. -2.5"
                                required
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />

                            <div className={styles.formGroup}>
                                <label>Reason Code *</label>
                                <select
                                    className={styles.select}
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                >
                                    <option value="" disabled>-- Select Reason --</option>
                                    <option value="SPOILAGE">Spoilage / Expired</option>
                                    <option value="WASTE_PREP">Prep Waste</option>
                                    <option value="STAFF_MEAL">Staff Meal</option>
                                    <option value="COUNT_CORRECTION_UP">Count Correction (Found Stock)</option>
                                    <option value="COUNT_CORRECTION_DOWN">Count Correction (Missing Stock)</option>
                                </select>
                            </div>
                        </div>

                        <KitchenInput
                            label="Detailed Note (Optional)"
                            placeholder="Explain why this adjustment is being made..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />

                        <div className={styles.authSection}>
                            <label className={styles.authLabel}>
                                <Key size={16} /> Backend Authorization
                            </label>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                Stock adjustments are enforced by branch-safe permissions on the backend. This screen no longer uses a mock manager PIN.
                            </p>
                        </div>

                        <div className={styles.actions}>
                            <KitchenButton variant="outline" type="button" onClick={() => navigate('/console/inventory/ledger')}>
                                Cancel
                            </KitchenButton>
                            <KitchenButton variant="danger" type="submit" isLoading={isLoading}>
                                Execute Adjustment
                            </KitchenButton>
                        </div>
                    </form>
                </KitchenCard>
            </div>
        </div>
    );
}
