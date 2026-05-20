/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useEffect } from 'react';
import { 
    Plus, 
    Trash2, 
    Save, 
    Percent, 
    Settings2,
    ToggleLeft,
    ToggleRight,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { branchApi } from '../../api/api';
import styles from './BranchChargeSettings.module.css';

interface BranchChargeSettingsProps {
    branchId: number;
}

export function BranchChargeSettings({ branchId }: BranchChargeSettingsProps) {
    const [charges, setCharges] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadCharges = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await branchApi.getCharges(branchId);
            setCharges(data || []);
        } catch (err) {
            console.error('Failed to load charges:', err);
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        if (branchId) {
            void loadCharges();
        }
    }, [branchId, loadCharges]);

    const handleAddCharge = () => {
        const newCharge = {
            name: 'New Charge',
            type: 'percentage',
            is_tax: false,
            condition_trigger: 'none',
            priority: charges.length + 1,
            is_active: true,
            rate_map: { default: 0 }
        };
        setCharges([...charges, newCharge]);
    };

    const handleUpdateCharge = (index: number, field: string, value: any) => {
        const updated = [...charges];
        updated[index] = { ...updated[index], [field]: value };
        setCharges(updated);
    };

    const handleUpdateRate = (index: number, key: string, value: number) => {
        const updated = [...charges];
        const rateMap = { ...updated[index].rate_map, [key]: value };
        updated[index] = { ...updated[index], rate_map: rateMap };
        setCharges(updated);
    };

    const handleSave = async (index: number) => {
        setIsSaving(true);
        try {
            const charge = charges[index];
            if (charge.id) {
                await branchApi.updateCharge(branchId, charge.id, charge);
            } else {
                const saved = await branchApi.createCharge(branchId, charge);
                const updated = [...charges];
                updated[index] = saved;
                setCharges(updated);
            }
            // toast.success('Charge saved successfully');
        } catch (err) {
            console.error('Failed to save charge:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (index: number) => {
        const charge = charges[index];
        if (charge.id) {
            if (!window.confirm('Are you sure you want to delete this charge?')) return;
            try {
                await branchApi.deleteCharge(branchId, charge.id);
            } catch (err) {
                console.error('Failed to delete charge:', err);
                return;
            }
        }
        const updated = charges.filter((_, i) => i !== index);
        setCharges(updated);
    };

    if (isLoading) return <div>Loading charges...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h3>Dynamic Charges & Taxes</h3>
                    <p>Configure GST, Service Fees, Delivery Charges, etc.</p>
                </div>
                <KitchenButton variant="primary" size="sm" onClick={handleAddCharge}>
                    <Plus size={16} /> Add Charge Type
                </KitchenButton>
            </div>

            <div className={styles.chargeList}>
                {charges.map((charge, idx) => (
                    <KitchenCard key={idx} className={styles.chargeCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.mainInfo}>
                                <div className={styles.iconBox}>
                                    {charge.is_tax ? <Percent size={20} /> : <Settings2 size={20} />}
                                </div>
                                <KitchenInput 
                                    className={styles.nameInput}
                                    value={charge.name}
                                    onChange={(e) => handleUpdateCharge(idx, 'name', e.target.value)}
                                    placeholder="Charge Name (e.g. GST)"
                                />
                            </div>
                            <div className={styles.cardActions}>
                                <button 
                                    className={styles.toggleBtn}
                                    onClick={() => handleUpdateCharge(idx, 'is_active', !charge.is_active)}
                                >
                                    {charge.is_active ? <ToggleRight size={28} color="var(--color-success)" /> : <ToggleLeft size={28} color="var(--color-text-muted)" />}
                                </button>
                                <button className={styles.deleteBtn} onClick={() => handleDelete(idx)}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className={styles.cardBody}>
                            <div className={styles.settingsGrid}>
                                <KitchenSelect 
                                    label="Charge Type"
                                    value={charge.type}
                                    options={[
                                        { label: 'Percentage (%)', value: 'percentage' },
                                        { label: 'Fixed Amount', value: 'fixed' }
                                    ]}
                                    onChange={(val) => handleUpdateCharge(idx, 'type', val)}
                                />
                                <KitchenSelect 
                                    label="Calculate Based On"
                                    value={charge.condition_trigger}
                                    options={[
                                        { label: 'Apply to All Orders', value: 'none' },
                                        { label: 'Payment Method', value: 'payment_method' },
                                        { label: 'Order Type', value: 'order_type' }
                                    ]}
                                    onChange={(val) => handleUpdateCharge(idx, 'condition_trigger', val)}
                                />
                                <label className={styles.checkboxLabel}>
                                    <input 
                                        type="checkbox" 
                                        checked={charge.is_tax} 
                                        onChange={(e) => handleUpdateCharge(idx, 'is_tax', e.target.checked)}
                                    />
                                    <span>Treat as Government Tax</span>
                                </label>
                            </div>

                            <div className={styles.ratesSection}>
                                <h4>Configuration Values</h4>
                                {charge.condition_trigger === 'none' && (
                                    <KitchenInput 
                                        label="Default Rate"
                                        type="number"
                                        value={charge.rate_map?.default || 0}
                                        onChange={(e) => handleUpdateRate(idx, 'default', Number(e.target.value))}
                                        addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                    />
                                )}
                                {charge.condition_trigger === 'payment_method' && (
                                    <div className={styles.multiRateGrid}>
                                        <KitchenInput 
                                            label="Cash"
                                            type="number"
                                            value={charge.rate_map?.cash || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'cash', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                        <KitchenInput 
                                            label="Card"
                                            type="number"
                                            value={charge.rate_map?.card || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'card', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                        <KitchenInput 
                                            label="Wallet / Other"
                                            type="number"
                                            value={charge.rate_map?.digital_wallet || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'digital_wallet', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                    </div>
                                )}
                                {charge.condition_trigger === 'order_type' && (
                                    <div className={styles.multiRateGrid}>
                                        <KitchenInput 
                                            label="Dine-In"
                                            type="number"
                                            value={charge.rate_map?.dine_in || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'dine_in', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                        <KitchenInput 
                                            label="Takeaway"
                                            type="number"
                                            value={charge.rate_map?.takeout || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'takeout', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                        <KitchenInput 
                                            label="Delivery"
                                            type="number"
                                            value={charge.rate_map?.delivery || 0}
                                            onChange={(e) => handleUpdateRate(idx, 'delivery', Number(e.target.value))}
                                            addon={charge.type === 'percentage' ? '%' : 'Rs'}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.priorityBox}>
                                <span>Priority: {charge.priority}</span>
                                <div className={styles.prioBtns}>
                                    <button onClick={() => handleUpdateCharge(idx, 'priority', Math.max(1, charge.priority - 1))}><ArrowUp size={14} /></button>
                                    <button onClick={() => handleUpdateCharge(idx, 'priority', charge.priority + 1)}><ArrowDown size={14} /></button>
                                </div>
                            </div>
                            <KitchenButton 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleSave(idx)}
                                isLoading={isSaving}
                            >
                                <Save size={16} /> {charge.id ? 'Update' : 'Save'}
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                ))}

                {charges.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>No charges configured for this branch.</p>
                        <KitchenButton variant="outline" onClick={handleAddCharge}>Set up first charge</KitchenButton>
                    </div>
                )}
            </div>
        </div>
    );
}
