import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Plus, ArrowRightLeft
} from 'lucide-react';
import styles from './StockTransfer.module.css';

interface TransferLine {
    id: string;
    itemCode: string;
    itemName: string;
    fromStore: string;
    toStore: string;
    quantity: string;
    unit: string;
    reason: string;
}

const MOCK_ITEMS = [
    { code: 'RM-001', name: 'Chicken Breast', unit: 'kg', store: 'Freezer', onHand: '14.5' },
    { code: 'RM-002', name: 'Tomatoes (Fresh)', unit: 'kg', store: 'Main Store', onHand: '8.2' },
    { code: 'RM-003', name: 'Mozzarella Cheese', unit: 'kg', store: 'Chiller', onHand: '3.8' },
    { code: 'RM-004', name: 'Olive Oil Extra Virgin', unit: 'mL', store: 'Dry Store', onHand: '4500' },
    { code: 'RM-005', name: 'Heavy Cream 35%', unit: 'mL', store: 'Chiller', onHand: '1200' },
];

const STORES = ['Main Store', 'Freezer', 'Chiller', 'Dry Store', 'Bar Store', 'Kitchen Store'];

const TRANSFER_REASONS = [
    'Temperature-controlled storage required',
    'Kitchen preparation staging',
    'Branch restocking',
    'FIFO rotation',
    'Space optimization',
    'Special event preparation',
    'Other',
];

const buildTransferNumber = () => `TRF-2602-${String(Math.floor(Math.random() * 900 + 100))}`;

const newLine = (): TransferLine => ({
    id: crypto.randomUUID(),
    itemCode: '',
    itemName: '',
    fromStore: 'Main Store',
    toStore: 'Kitchen Store',
    quantity: '',
    unit: 'kg',
    reason: '',
});

export function StockTransfer() {
    const navigate = useNavigate();
    const [trnNo] = useState(buildTransferNumber);
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [initiatedBy, setInitiatedBy] = useState('Ahmed (Storekeeper)');
    const [approvedBy, setApprovedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<TransferLine[]>([newLine()]);
    const [saving, setSaving] = useState(false);

    const addLine = () => setLines(prev => [...prev, newLine()]);
    const removeLine = (id: string) => { if (lines.length > 1) setLines(prev => prev.filter(l => l.id !== id)); };

    const updateLine = (id: string, field: keyof TransferLine, value: string) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const u = { ...l, [field]: value };
            if (field === 'itemCode') {
                const found = MOCK_ITEMS.find(i => i.code === value);
                if (found) { u.itemName = found.name; u.unit = found.unit; u.fromStore = found.store; }
            }
            return u;
        }));
    };

    const getOnHand = (code: string) => MOCK_ITEMS.find(i => i.code === code)?.onHand || '';

    const handlePost = () => {
        setSaving(true);
        setTimeout(() => { setSaving(false); navigate('/console/inventory/transfers'); }, 1000);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/transfers')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <ArrowRightLeft size={22} className={styles.titleIcon} />
                            <h1>Transfer Stock</h1>
                        </div>
                        <p className={styles.subtitle}>Move items between store locations — no cost impact</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.trnBadge}>{trnNo}</div>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/transfers')}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={handlePost} disabled={saving}>
                        <ArrowRightLeft size={16} />
                        {saving ? 'Posting...' : 'Post Transfer'}
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                {/* Info Banner */}
                <div className={styles.infoBanner}>
                    <ArrowRightLeft size={14} />
                    <span>Internal transfers only change the <strong>physical location</strong> of stock. Costs and quantities remain the same. All transfers are logged with user and timestamp.</span>
                </div>

                {/* Meta */}
                <div className={styles.metaCard}>
                    <div className={styles.metaGrid}>
                        <div className={styles.fieldGroup}>
                            <label>Transfer Date</label>
                            <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Initiated By</label>
                            <input value={initiatedBy} onChange={e => setInitiatedBy(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Approved By (optional)</label>
                            <input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="Manager name" className={styles.input} />
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className={styles.lineCard}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}><ArrowRightLeft size={16} /> Transfer Lines</span>
                        <button className={styles.addBtn} onClick={addLine}><Plus size={14} /> Add Item</button>
                    </div>
                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <span style={{ width: '130px' }}>Item Code</span>
                            <span style={{ flex: 1, minWidth: '160px' }}>Item Name</span>
                            <span style={{ width: '130px' }}>From Store</span>
                            <span style={{ width: '32px', textAlign: 'center' }}>→</span>
                            <span style={{ width: '130px' }}>To Store</span>
                            <span style={{ width: '100px', textAlign: 'right' }}>On Hand</span>
                            <span style={{ width: '100px' }}>Qty</span>
                            <span style={{ width: '60px' }}>Unit</span>
                            <span style={{ width: '170px' }}>Reason</span>
                            <span style={{ width: '40px' }}></span>
                        </div>
                        {lines.map(line => (
                            <div key={line.id} className={styles.lineRow}>
                                <div style={{ width: '130px' }}>
                                    <select value={line.itemCode} onChange={e => updateLine(line.id, 'itemCode', e.target.value)} className={styles.cellSelect}>
                                        <option value="">— Code —</option>
                                        {MOCK_ITEMS.map(i => <option key={i.code} value={i.code}>{i.code}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                    <input value={line.itemName} onChange={e => updateLine(line.id, 'itemName', e.target.value)} placeholder="Item name" className={styles.cellInput} />
                                </div>
                                <div style={{ width: '130px' }}>
                                    <select value={line.fromStore} onChange={e => updateLine(line.id, 'fromStore', e.target.value)} className={styles.cellSelect}>
                                        {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ArrowRightLeft size={14} style={{ color: 'var(--accent-tertiary)', flexShrink: 0 }} />
                                </div>
                                <div style={{ width: '130px' }}>
                                    <select value={line.toStore} onChange={e => updateLine(line.id, 'toStore', e.target.value)} className={styles.cellSelect}>
                                        {STORES.filter(s => s !== line.fromStore).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '100px', textAlign: 'right', paddingRight: '8px' }}>
                                    <span className={styles.onHand}>{line.itemCode ? getOnHand(line.itemCode) : '—'} {line.unit}</span>
                                </div>
                                <div style={{ width: '100px' }}>
                                    <input
                                        type="number"
                                        value={line.quantity}
                                        onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                                        placeholder="0"
                                        className={styles.cellInput}
                                        style={{ textAlign: 'right' }}
                                    />
                                </div>
                                <div style={{ width: '60px' }}>
                                    <span className={styles.unitTag}>{line.unit}</span>
                                </div>
                                <div style={{ width: '170px' }}>
                                    <select value={line.reason} onChange={e => updateLine(line.id, 'reason', e.target.value)} className={styles.cellSelect}>
                                        <option value="">— Reason —</option>
                                        {TRANSFER_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                                    <button className={styles.rmBtn} onClick={() => removeLine(line.id)} disabled={lines.length === 1}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className={styles.notesCard}>
                    <label className={styles.notesLabel}>Transfer Notes</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Any additional notes about this transfer..."
                        className={styles.textarea}
                        rows={2}
                    />
                </div>
            </div>
        </div>
    );
}

