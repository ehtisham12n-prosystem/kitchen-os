import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, AlertCircle, TrendingDown, CheckCircle2, Trash2 } from 'lucide-react';
import styles from './DisposalEntry.module.css';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

interface DisposalLine {
    id: string;
    itemId: string;
    quantity: string;
    reasonCode: string;
    remarks: string;
}

const REASON_CODES = [
    { code: 'EXPIRED', label: 'Expired / Passed Shelf Life' },
    { code: 'OVERCOOKED', label: 'Overcooked / Preparation Error' },
    { code: 'SPILLAGE', label: 'Spillage / Damage During Handling' },
    { code: 'VENDOR_ISSUE', label: 'Vendor Quality Issue' },
    { code: 'RODENT_PEST', label: 'Pest / Contamination' },
    { code: 'POWER_FAILURE', label: 'Power Failure / Storage Issue' },
    { code: 'EXCESS_PREP', label: 'Excess Preparation' },
    { code: 'OTHER', label: 'Other' },
];

const HIGH_VALUE_WASTAGE_THRESHOLD = 5000;

const newLine = (): DisposalLine => ({
    id: crypto.randomUUID(),
    itemId: '',
    quantity: '',
    reasonCode: '',
    remarks: '',
});

export function DisposalEntry() {
    const navigate = useNavigate();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lines, setLines] = useState<DisposalLine[]>([newLine()]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [stockItems, setStockItems] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                if (!branchId) return;
                const rows = await inventoryApi.getBranchStock(branchId);
                setStockItems(rows);
            } catch (error: any) {
                toast.error('Load Failed', error.message || 'Could not load branch stock.');
            }
        };

        void load();
    }, [branchId]);

    const stockById = useMemo(
        () => new Map(stockItems.map((item) => [String(item.item_id || item.id), item])),
        [stockItems],
    );

    const totalValue = useMemo(
        () => lines.reduce((sum, line) => {
            const item = stockById.get(line.itemId);
            return sum + (Number(line.quantity || 0) * Number(item?.last_unit_cost || 0));
        }, 0),
        [lines, stockById],
    );
    const hasHighValueLine = useMemo(
        () => lines.some((line) => {
            const item = stockById.get(line.itemId);
            return Number(line.quantity || 0) * Number(item?.last_unit_cost || 0) >= HIGH_VALUE_WASTAGE_THRESHOLD;
        }),
        [lines, stockById],
    );

    const addLine = () => setLines((prev) => [...prev, newLine()]);
    const removeLine = (id: string) => {
        if (lines.length > 1) {
            setLines((prev) => prev.filter((line) => line.id !== id));
        }
    };

    const updateLine = (id: string, field: keyof DisposalLine, value: string) => {
        setLines((prev) => prev.map((line) => line.id === id ? { ...line, [field]: value } : line));
    };

    const handleSubmit = async () => {
        if (!branchId) {
            toast.error('Branch Missing', 'Select an active branch before posting wastage.');
            return;
        }

        const invalidLine = lines.find((line) => !line.itemId || Number(line.quantity) <= 0 || !line.reasonCode);
        if (invalidLine) {
            toast.error('Validation Error', 'Each disposal line needs an item, positive quantity, and reason.');
            return;
        }
        const uniqueItems = new Set<string>();
        for (const line of lines) {
            if (uniqueItems.has(line.itemId)) {
                toast.error('Validation Error', 'Each item should appear only once in the same wastage batch.');
                return;
            }
            uniqueItems.add(line.itemId);
        }
        const overIssuedLine = lines.find((line) => {
            const item = stockById.get(line.itemId);
            return Number(line.quantity || 0) - Number(item?.current_quantity || 0) > 0.0001;
        });
        if (overIssuedLine) {
            const item = stockById.get(overIssuedLine.itemId);
            toast.error('Validation Error', `${item?.item?.item_name || 'Selected item'} exceeds available stock.`);
            return;
        }
        const missingOtherNotes = lines.find((line) => line.reasonCode === 'OTHER' && !line.remarks.trim() && !notes.trim());
        if (missingOtherNotes) {
            toast.error('Validation Error', 'Reason OTHER requires remarks or batch notes.');
            return;
        }
        const highValueNoNotes = lines.find((line) => {
            const item = stockById.get(line.itemId);
            const lineValue = Number(line.quantity || 0) * Number(item?.last_unit_cost || 0);
            return lineValue >= HIGH_VALUE_WASTAGE_THRESHOLD && !line.remarks.trim() && !notes.trim();
        });
        if (highValueNoNotes) {
            toast.error('Validation Error', `High-value wastage requires remarks. Threshold: PKR ${HIGH_VALUE_WASTAGE_THRESHOLD.toLocaleString('en-PK')}.`);
            return;
        }

        setSaving(true);
        try {
            for (const line of lines) {
                const item = stockById.get(line.itemId);
                await inventoryApi.adjustStock(branchId, {
                    item_id: Number(line.itemId),
                    quantity: -Math.abs(Number(line.quantity)),
                    type: 'wastage',
                    reason: line.reasonCode,
                    notes: [line.remarks, notes, `Disposal date ${date}`].filter(Boolean).join(' | '),
                });
                if (!item) {
                    throw new Error('Selected inventory item is no longer available.');
                }
            }

            toast.success('Posted', 'Wastage has been posted to stock ledger and stock levels.');
            navigate('/console/inventory/wastage');
        } catch (error: any) {
            toast.error('Post Failed', error.message || 'Could not post wastage entry.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/wastage')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <TrendingDown size={20} className={styles.titleIcon} />
                            <h1>New Disposal Entry</h1>
                        </div>
                        <p className={styles.subtitle}>Post waste and damage directly into stock ledger using the branch-safe adjustment path.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/wastage')}>
                        Cancel
                    </button>
                    <button className={styles.btnPrimary} onClick={handleSubmit} disabled={saving}>
                        <CheckCircle2 size={16} />
                        {saving ? 'Posting...' : 'Post Wastage'}
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                <div className={styles.warningBanner}>
                    <AlertCircle size={15} />
                    <span>
                        Waste and damage entries immediately reduce stock for the active branch. The movement is posted as <strong>wastage</strong> in the stock ledger.
                    </span>
                </div>

                <div className={styles.severityBanner}>
                    <AlertCircle size={15} />
                    <span>
                        Wastage at or above <strong>PKR {HIGH_VALUE_WASTAGE_THRESHOLD.toLocaleString('en-PK')}</strong> requires wastage-approval authority in the current backend policy. Reason <strong>OTHER</strong> always requires remarks.
                    </span>
                </div>

                <div className={styles.metaCard}>
                    <div className={styles.metaCardTitle}>Entry Details</div>
                    <div className={styles.metaGrid}>
                        <div className={styles.fieldGroup}>
                            <label>Disposal Date</label>
                            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Batch Notes</label>
                            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={styles.input} placeholder="Optional context applied to all lines" />
                        </div>
                    </div>
                </div>

                <div className={styles.lineCard}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}>
                            <TrendingDown size={16} /> Disposed Items
                        </span>
                        <button className={styles.addBtn} onClick={addLine}>
                            <Plus size={14} /> Add Item
                        </button>
                    </div>

                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <span style={{ flex: 1 }}>Item</span>
                            <span style={{ width: '120px' }}>Available</span>
                            <span style={{ width: '90px' }}>Quantity</span>
                            <span style={{ width: '210px' }}>Reason</span>
                            <span style={{ flex: 1, minWidth: '160px' }}>Remarks</span>
                            <span style={{ width: '110px' }}>Value</span>
                            <span style={{ width: '44px' }}></span>
                        </div>

                        {lines.map((line) => {
                            const selectedItem = stockById.get(line.itemId);
                            const lineValue = Number(line.quantity || 0) * Number(selectedItem?.last_unit_cost || 0);
                            return (
                                <div key={line.id} className={styles.lineRow}>
                                    <div style={{ flex: 1 }}>
                                        <select value={line.itemId} onChange={(event) => updateLine(line.id, 'itemId', event.target.value)} className={styles.cellSelect}>
                                            <option value="">Select item</option>
                                            {stockItems.map((item) => (
                                                <option key={item.item_id || item.id} value={item.item_id || item.id}>
                                                    {item.item?.item_name || `Item ${item.item_id || item.id}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ width: '120px' }}>
                                        <span className={styles.unitTag}>
                                            {selectedItem ? `${Number(selectedItem.current_quantity || 0).toFixed(2)} ${selectedItem.item?.uom_base || ''}` : '-'}
                                        </span>
                                    </div>
                                    <div style={{ width: '90px' }}>
                                        <input type="number" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} className={styles.cellInput} />
                                    </div>
                                    <div style={{ width: '210px' }}>
                                        <select value={line.reasonCode} onChange={(event) => updateLine(line.id, 'reasonCode', event.target.value)} className={styles.cellSelect}>
                                            <option value="">Select reason</option>
                                            {REASON_CODES.map((reason) => (
                                                <option key={reason.code} value={reason.code}>{reason.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '160px' }}>
                                        <input value={line.remarks} onChange={(event) => updateLine(line.id, 'remarks', event.target.value)} className={styles.cellInput} placeholder="Line note" />
                                    </div>
                                    <div style={{ width: '110px' }}>
                                        <span className={`${styles.unitTag} ${lineValue >= HIGH_VALUE_WASTAGE_THRESHOLD ? styles.highValueTag : ''}`}>PKR {lineValue.toFixed(2)}</span>
                                    </div>
                                    <div style={{ width: '44px', display: 'flex', justifyContent: 'center' }}>
                                        <button className={styles.rmBtn} onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.totalsBar}>
                        <span className={styles.totalLabel}>Estimated Value:</span>
                        <strong className={styles.totalVal}>PKR {totalValue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        {hasHighValueLine ? <span className={styles.thresholdPill}>Approval Threshold Hit</span> : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
