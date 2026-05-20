/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Plus, Ruler, Save, Search, Trash2, X } from 'lucide-react';
import { catalogApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';
import styles from './InventorySetup.module.css';

type UomType = 'weight' | 'volume' | 'count';

type UomRow = {
    id: number;
    name: string;
    abbreviation: string;
    short_code?: string;
    uom_type?: UomType;
    description?: string | null;
    is_base_unit: boolean;
    is_active: boolean;
    base_unit_id?: number | null;
    conversion_factor?: number | string | null;
    base_unit?: UomRow | null;
};

type UomDraft = {
    name: string;
    abbreviation: string;
    uom_type: UomType;
    is_base_unit: boolean;
    base_unit_id: string;
    conversion_factor: string;
    description: string;
};

const emptyDraft: UomDraft = {
    name: '',
    abbreviation: '',
    uom_type: 'weight',
    is_base_unit: false,
    base_unit_id: '',
    conversion_factor: '',
    description: '',
};

const TYPE_LABELS: Record<UomType, string> = {
    weight: 'Weight',
    volume: 'Volume',
    count: 'Count',
};

function normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
}

function formatFactor(value: number | string | null | undefined) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return '-';
    return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function buildDraft(row?: UomRow): UomDraft {
    if (!row) return emptyDraft;
    return {
        name: row.name || '',
        abbreviation: row.abbreviation || row.short_code || '',
        uom_type: row.uom_type || 'count',
        is_base_unit: !!row.is_base_unit,
        base_unit_id: row.base_unit_id ? String(row.base_unit_id) : '',
        conversion_factor: row.conversion_factor !== null && row.conversion_factor !== undefined ? String(row.conversion_factor) : '',
        description: row.description || '',
    };
}

function equivalenceLabel(row: UomRow) {
    const code = row.abbreviation || row.short_code || row.name;
    if (row.is_base_unit) {
        return `1 ${code} = 1 ${code}`;
    }
    const baseCode = row.base_unit?.abbreviation || row.base_unit?.short_code || 'base';
    return `1 ${code} = ${formatFactor(row.conversion_factor)} ${baseCode}`;
}

function UomForm({
    initial,
    uoms,
    onCancel,
    onSaved,
}: {
    initial?: UomRow;
    uoms: UomRow[];
    onCancel: () => void;
    onSaved: () => Promise<void>;
}) {
    const [draft, setDraft] = useState<UomDraft>(() => buildDraft(initial));
    const [saving, setSaving] = useState(false);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const codeInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setDraft(buildDraft(initial));
    }, [initial]);
    const baseOptions = useMemo(
        () => uoms
            .filter((uom) => uom.is_base_unit && uom.is_active && (!initial || uom.id !== initial.id))
            .sort((left, right) => {
                const leftMatchesType = String(left.uom_type || '').toLowerCase() === draft.uom_type ? 0 : 1;
                const rightMatchesType = String(right.uom_type || '').toLowerCase() === draft.uom_type ? 0 : 1;
                if (leftMatchesType !== rightMatchesType) return leftMatchesType - rightMatchesType;
                return String(left.name || '').localeCompare(String(right.name || ''));
            }),
        [draft.uom_type, initial, uoms],
    );

    useEffect(() => {
        if (draft.is_base_unit) {
            setDraft((current) => ({ ...current, base_unit_id: '', conversion_factor: '1' }));
            return;
        }
        if (draft.base_unit_id && !baseOptions.some((uom) => String(uom.id) === draft.base_unit_id)) {
            setDraft((current) => ({ ...current, base_unit_id: '' }));
        }
    }, [baseOptions, draft.base_unit_id, draft.is_base_unit]);

    const update = (field: keyof UomDraft, value: string | boolean) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };

    const save = async () => {
        const name = (nameInputRef.current?.value ?? draft.name).trim();
        const abbreviation = normalizeCode(codeInputRef.current?.value ?? draft.abbreviation);
        const conversionFactor = draft.is_base_unit ? 1 : Number(draft.conversion_factor);
        if (!name || !abbreviation) {
            toast.error('Validation Error', 'UOM name and code are required.');
            return;
        }
        if (!draft.is_base_unit && (!draft.base_unit_id || !Number.isFinite(conversionFactor) || conversionFactor <= 0)) {
            toast.error('Validation Error', 'Equivalent UOMs need a base unit and a positive conversion factor.');
            return;
        }

        setSaving(true);
        try {
            const payload: Record<string, any> = {
                name,
                abbreviation,
                short_code: abbreviation,
                is_base_unit: draft.is_base_unit,
                base_unit_id: draft.is_base_unit ? null : Number(draft.base_unit_id),
                conversion_factor: conversionFactor,
                description: draft.description.trim(),
                is_active: true,
            };
            if (initial) {
                await catalogApi.updateUom(initial.id, payload);
                toast.success('Updated', 'UOM equivalence updated.');
            } else {
                payload.uom_type = draft.uom_type;
                await catalogApi.createUom(payload);
                toast.success('Created', 'UOM equivalence added.');
            }
            await onSaved();
            onCancel();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save UOM.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.formCard}>
            <div className={styles.formHeader}>
                <h3>{initial ? `Edit UOM: ${initial.abbreviation || initial.name}` : 'New UOM Equivalence'}</h3>
                <button className={styles.closeBtn} onClick={onCancel}><X size={16} /></button>
            </div>
            <div className={styles.formBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 160px 160px 140px', gap: '8px' }}>
                    <div className={styles.fieldGroup}>
                        <label>UOM Name</label>
                        <input ref={nameInputRef} className={styles.input} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Kilogram" />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Code</label>
                        <input ref={codeInputRef} className={styles.input} value={draft.abbreviation} onChange={(event) => update('abbreviation', normalizeCode(event.target.value))} placeholder="KG" />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>{initial ? 'Type Locked' : 'Type'}</label>
                        <select className={styles.select} value={draft.uom_type} disabled={!!initial} onChange={(event) => update('uom_type', event.target.value as UomType)}>
                            {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Base Unit</label>
                        <select className={styles.select} value={draft.is_base_unit ? 'yes' : 'no'} onChange={(event) => update('is_base_unit', event.target.value === 'yes')}>
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                        </select>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1.5fr', gap: '8px' }}>
                    <div className={styles.fieldGroup}>
                        <label>Equivalent To</label>
                        <select className={styles.select} value={draft.base_unit_id} disabled={draft.is_base_unit} onChange={(event) => update('base_unit_id', event.target.value)}>
                            <option value="">Select base unit</option>
                            {baseOptions.map((uom) => (
                                <option key={uom.id} value={uom.id}>
                                    {uom.name} ({uom.abbreviation || uom.short_code}){String(uom.uom_type || '').toLowerCase() !== draft.uom_type ? ` - ${TYPE_LABELS[(uom.uom_type || 'count') as UomType]}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Factor</label>
                        <input className={styles.input} type="number" min="0" step="0.0001" disabled={draft.is_base_unit} value={draft.conversion_factor} onChange={(event) => update('conversion_factor', event.target.value)} placeholder="1000" />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Description</label>
                        <input className={styles.input} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="1 KG = 1000 G" />
                    </div>
                </div>
                <div className={styles.formActions}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={() => void save()} disabled={saving}>
                        <Save size={15} />
                        {saving ? 'Saving...' : 'Save UOM'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function UomMaster() {
    const navigate = useNavigate();
    const [uoms, setUoms] = useState<UomRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | UomType>('all');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<UomRow | undefined>();

    const loadUoms = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await catalogApi.getUoms();
            setUoms(rows);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load UOMs.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUoms();
    }, [loadUoms]);

    const seedDefaults = async () => {
        try {
            const rows = await catalogApi.seedDefaultUoms();
            setUoms(rows);
            toast.success('UOMs Added', 'Default UOM equivalences are ready.');
        } catch (error: any) {
            toast.error('Seed Failed', error.message || 'Could not seed default UOMs.');
        }
    };

    const deleteUom = async (row: UomRow) => {
        if (!window.confirm(`Deactivate ${row.name}?`)) return;
        try {
            await catalogApi.deleteUom(row.id);
            toast.success('Deactivated', 'UOM has been deactivated.');
            await loadUoms();
        } catch (error: any) {
            toast.error('Delete Failed', error.message || 'Could not deactivate UOM.');
        }
    };

    const filtered = uoms.filter((uom) => {
        const haystack = `${uom.name} ${uom.abbreviation} ${uom.description || ''}`.toLowerCase();
        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || (uom.uom_type || 'count') === typeFilter;
        return matchesSearch && matchesType;
    });

    const baseCount = uoms.filter((uom) => uom.is_base_unit).length;
    const conversionCount = uoms.filter((uom) => !uom.is_base_unit).length;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.btnSecondary} style={{ padding: '8px 12px' }} onClick={() => navigate('/console/inventory/setup/items')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className={styles.titleRow}>
                        <Ruler size={22} className={styles.titleIcon} />
                        <div>
                            <h1>UOM Master</h1>
                            <p className={styles.subtitle}>Define base units and equivalencies for purchases, stock valuation, kitchen issue, and recipe costing.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnSecondary} onClick={() => void seedDefaults()}>Seed Defaults</button>
                    <button className={styles.btnPrimary} onClick={() => { setEditing(undefined); setShowForm(true); }}>
                        <Plus size={16} /> New UOM
                    </button>
                </div>
            </div>

            {(showForm || editing) && (
                <UomForm
                    initial={editing}
                    uoms={uoms}
                    onSaved={loadUoms}
                    onCancel={() => { setShowForm(false); setEditing(undefined); }}
                />
            )}

            <div className={styles.summaryStrip}>
                <div className={`${styles.summaryItem} ${styles.sumIndigo}`}>
                    <span className={styles.sumValue}>{uoms.length}</span>
                    <span className={styles.sumLabel}>Active UOMs</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumEmerald}`}>
                    <span className={styles.sumValue}>{baseCount}</span>
                    <span className={styles.sumLabel}>Base Units</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumAmber}`}>
                    <span className={styles.sumValue}>{conversionCount}</span>
                    <span className={styles.sumLabel}>Equivalencies</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.sumRose}`}>
                    <span className={styles.sumValue}>{new Set(uoms.map((uom) => uom.uom_type || 'count')).size}</span>
                    <span className={styles.sumLabel}>Unit Types</span>
                </div>
            </div>

            <div className={styles.toolbarRow}>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input className={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search UOMs..." />
                </div>
                <div className={styles.clsFilter}>
                    <button className={`${styles.clsFilterBtn} ${typeFilter === 'all' ? styles.clsFilterActive : ''}`} onClick={() => setTypeFilter('all')}>All</button>
                    {(Object.entries(TYPE_LABELS) as [UomType, string][]).map(([key, label]) => (
                        <button key={key} className={`${styles.clsFilterBtn} ${typeFilter === key ? styles.clsFilterActive : ''}`} onClick={() => setTypeFilter(key)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.itemTable}>
                <div className={styles.itemTableHead}>
                    <span style={{ width: '120px' }}>Code</span>
                    <span style={{ width: '210px' }}>Name</span>
                    <span style={{ flex: 1 }}>Description</span>
                    <span style={{ width: '120px' }}>Type</span>
                    <span style={{ width: '110px' }}>Role</span>
                    <span style={{ width: '240px' }}>Equivalence</span>
                    <span style={{ width: '90px' }}></span>
                </div>
                {loading ? (
                    <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading UOMs...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No UOMs match the current filter.</div>
                ) : filtered.map((uom) => (
                    <div key={uom.id} className={styles.itemRow}>
                        <span style={{ width: '120px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>{uom.abbreviation || uom.short_code}</span>
                        <div style={{ width: '210px', minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 650, color: 'var(--text-primary)' }}>{uom.name}</span>
                        </div>
                        <span style={{ flex: 1, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uom.description || '-'}</span>
                        <span style={{ width: '120px' }}>{TYPE_LABELS[(uom.uom_type || 'count') as UomType]}</span>
                        <span style={{ width: '110px' }}>
                            <span className={styles.flagMini}>{uom.is_base_unit ? 'Base' : 'Equivalent'}</span>
                        </span>
                        <span style={{ width: '240px', color: 'var(--text-secondary)', fontWeight: 600 }}>{equivalenceLabel(uom)}</span>
                        <div style={{ width: '90px', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button className={styles.iconBtn} onClick={() => setEditing(uom)} title="Edit UOM"><Edit2 size={14} /></button>
                            <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => void deleteUom(uom)} title="Deactivate UOM"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
