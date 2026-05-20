import { useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    Receipt, Plus, X, Edit2, Percent, Building2
} from 'lucide-react';
import styles from './TaxConfiguration.module.css';

interface TaxRate {
    id: number;
    name: string;
    type: 'percentage' | 'fixed';
    rate: number;
    linkedAccount: string;
    category: 'gst' | 'withholding' | 'custom';
    isActive: boolean;
    description: string;
    branchId: string;
}

const MOCK_BRANCHES = [
    { value: 'all', label: 'All Branches' },
    { value: '1', label: 'Main Branch — Gulberg' },
    { value: '2', label: 'Branch 2 — DHA Phase 5' },
    { value: '3', label: 'Branch 3 — Johar Town' },
];

const ADD_TAX_BRANCHES = [
    { value: '1', label: 'Main Branch — Gulberg' },
    { value: '2', label: 'Branch 2 — DHA Phase 5' },
    { value: '3', label: 'Branch 3 — Johar Town' },
];

const INITIAL_TAXES: TaxRate[] = [
    { id: 1, name: 'General Sales Tax', type: 'percentage', rate: 17, linkedAccount: '2301 — GST Payable', category: 'gst', isActive: true, description: 'Standard GST applicable on all food & beverage sales', branchId: 'all' },
    { id: 2, name: 'Reduced GST (Takeaway)', type: 'percentage', rate: 5, linkedAccount: '2301 — GST Payable', category: 'gst', isActive: true, description: 'Reduced rate for takeaway/delivery orders', branchId: '1' },
    { id: 3, name: 'Withholding Tax — Vendors', type: 'percentage', rate: 4.5, linkedAccount: '2302 — WHT Payable', category: 'withholding', isActive: true, description: 'WHT deducted on vendor payments above PKR 50,000', branchId: 'all' },
    { id: 4, name: 'Withholding Tax — Salary', type: 'percentage', rate: 12.5, linkedAccount: '2302 — WHT Payable', category: 'withholding', isActive: true, description: 'Income tax on salaries above PKR 50,000/month', branchId: '1' },
    { id: 5, name: 'Service Charge', type: 'percentage', rate: 10, linkedAccount: '4400 — Other Income', category: 'custom', isActive: false, description: 'Optional service charge for dine-in orders', branchId: '2' },
    { id: 6, name: 'Delivery Fee', type: 'fixed', rate: 150, linkedAccount: '4400 — Other Income', category: 'custom', isActive: true, description: 'Fixed delivery charge per order', branchId: '3' },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    gst: { label: 'GST', color: 'var(--accent-primary, #6366f1)', bg: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' },
    withholding: { label: 'Withholding', color: 'var(--alert-warning-text, #d97706)', bg: 'color-mix(in srgb, var(--alert-warning-text) 15%, transparent)' },
    custom: { label: 'Custom', color: 'var(--accent-tertiary, #06b6d4)', bg: 'color-mix(in srgb, var(--accent-tertiary) 15%, transparent)' },
};

export function TaxConfiguration() {
    const [taxes, setTaxes] = useState<TaxRate[]>(INITIAL_TAXES);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingTax, setEditingTax] = useState<TaxRate | null>(null);

    const handleToggle = (id: number) => {
        setTaxes(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
    };

    const filteredTaxes = taxes.filter(t => selectedBranch === 'all' || t.branchId === selectedBranch || t.branchId === 'all');

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Receipt size={18} /></div>
                    <div>
                        <h1>Tax Configuration</h1>
                        <p>Manage tax rates, withholding rules, and custom charges</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect
                            options={MOCK_BRANCHES}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        />
                    </div>
                    <KitchenButton variant="primary" size="sm" className={styles.actionBtn} onClick={() => { setEditingTax(null); setShowModal(true); }}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Add Tax
                    </KitchenButton>
                </div>
            </header>

            {/* Top Summaries */}
            <div className={styles.summaryGrid}>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                    const count = filteredTaxes.filter(t => t.category === key && t.isActive).length;
                    return (
                        <div key={key} className={styles.summaryCard}>
                            <div className={styles.summaryTop}>
                                <span className={styles.summaryLabel}>{cfg.label} Taxes</span>
                                <Percent size={16} style={{ color: cfg.color }} />
                            </div>
                            <h3 className={styles.summaryValue}>{count} <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: '2px' }}>active</span></h3>
                        </div>
                    );
                })}
            </div>

            {/* Tax Rules Table */}
            <div className={`${styles.polishedPanel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                    <h3>Active Tax Rules</h3>
                    <span className={styles.panelMeta}>{filteredTaxes.length} configurations managed</span>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Tax Designation</th>
                                <th>Branch</th>
                                <th>Classification</th>
                                <th style={{ textAlign: 'right' }}>Applied Rate</th>
                                <th>Linked Ledger Account</th>
                                <th style={{ textAlign: 'center', width: 90 }}>Status</th>
                                <th style={{ textAlign: 'center', width: 90 }}>Active/On</th>
                                <th style={{ width: 40, textAlign: 'center' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTaxes.map((tax) => {
                                const cfg = CATEGORY_CONFIG[tax.category];
                                return (
                                    <tr key={tax.id} className={`${styles.tableRow} ${!tax.isActive ? styles.inactiveRow : ''}`}>
                                        <td>
                                            <div className={styles.taxCell}>
                                                <span className={styles.taxName}>{tax.name}</span>
                                                <span className={styles.taxDesc}>{tax.description}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={styles.taxDesc} style={{ color: 'var(--color-text-muted)' }}>{MOCK_BRANCHES.find(b => b.value === tax.branchId)?.label.split('—')[0] || 'All Branches'}</span>
                                        </td>
                                        <td>
                                            <div className={styles.catCell}>
                                                <span className={styles.catBadge} style={{ color: cfg.color, background: cfg.bg, borderColor: `color-mix(in srgb, ${cfg.color} 30%, transparent)` }}>
                                                    {cfg.label}
                                                </span>
                                                <span className={styles.typeText}>{tax.type}</span>
                                            </div>
                                        </td>
                                        <td className={styles.amountCell}>
                                            <strong className={styles.rateHighlight}>
                                                {tax.type === 'percentage' ? `${tax.rate}%` : `₨ ${tax.rate}`}
                                            </strong>
                                        </td>
                                        <td>
                                            <span className={styles.accountBadge}>{tax.linkedAccount}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`${styles.statusPill} ${tax.isActive ? styles.pillActive : styles.pillInactive}`}>
                                                {tax.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                className={`${styles.toggleSwitch} ${tax.isActive ? styles.toggleOn : styles.toggleOff}`}
                                                onClick={() => handleToggle(tax.id)}
                                                title={tax.isActive ? "Turn Off" : "Turn On"}
                                            >
                                                <div className={styles.toggleKnob} />
                                            </button>
                                        </td>
                                        <td>
                                            <div className={styles.actionGroup}>
                                                <button 
                                                    className={styles.editBtn} 
                                                    title="Edit"
                                                    onClick={() => { setEditingTax(tax); setShowModal(true); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => { setShowModal(false); setEditingTax(null); }}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingTax ? 'Edit Tax Rule' : 'Create Tax Rule'}</h2>
                            <button className={styles.closeBtn} onClick={() => { setShowModal(false); setEditingTax(null); }}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Tax Name</label>
                                    <KitchenInput placeholder="e.g., Provincial Sales Tax" defaultValue={editingTax?.name} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Apply To Branches</label>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
                                        {ADD_TAX_BRANCHES.map(b => (
                                            <label key={b.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }} 
                                                    defaultChecked={editingTax ? (editingTax.branchId === 'all' || editingTax.branchId === b.value) : false}
                                                />
                                                {b.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Category</label>
                                    <KitchenSelect 
                                        options={[{ value: 'gst', label: 'GST / Sales Tax' }, { value: 'withholding', label: 'Withholding Tax' }, { value: 'custom', label: 'Custom' }]} 
                                        value={editingTax?.category}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Calculation Type</label>
                                    <KitchenSelect 
                                        options={[{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed Amount (PKR)' }]} 
                                        value={editingTax?.type}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Rate / Amount</label>
                                    <KitchenInput type="number" placeholder="0" defaultValue={editingTax?.rate} />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Linked Ledger Account</label>
                                    <KitchenSelect 
                                        options={[{ value: '2301', label: '2301 — GST Payable' }, { value: '2302', label: '2302 — WHT Payable' }, { value: '4400', label: '4400 — Other Income' }]} 
                                        value={editingTax?.linkedAccount.split(' — ')[0]}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Internal Description</label>
                                    <KitchenInput placeholder="Brief details about when this applies..." defaultValue={editingTax?.description} />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingTax(null); }}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={() => { setShowModal(false); setEditingTax(null); }}>
                                {editingTax ? 'Save Changes' : 'Create Rule'}
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
