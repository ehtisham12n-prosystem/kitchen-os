/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Edit2, X, Save, ArrowLeft } from 'lucide-react';
import styles from './InventorySetup.module.css';
import { catalogApi, inventoryApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';

type ItemTag = 'Raw Material' | 'Semi-Finished' | 'MRO Supplies' | 'Asset' | 'Packaging' | 'Consumable';

interface InventoryItemRow {
    id: number;
    code: string;
    name: string;
    otherLanguageName: string;
    classification: string;
    tag: ItemTag;
    category: string;
    subCategory: string;
    purchaseUnit: string;
    issueUnit: string;
    affectsStock: boolean;
    affectsRecipe: boolean;
    depreciable: boolean;
    status: 'active' | 'inactive';
    subTypeId: number;
}

const ITEM_TAGS: ItemTag[] = ['Raw Material', 'Semi-Finished', 'MRO Supplies', 'Asset', 'Packaging', 'Consumable'];

const TAG_META: Record<ItemTag, { code: string; color: string; bg: string }> = {
    'Raw Material': { code: 'RM', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    'Semi-Finished': { code: 'SF', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    'MRO Supplies': { code: 'MRO', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    Asset: { code: 'ASSET', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    Packaging: { code: 'PKG', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    Consumable: { code: 'CONS', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
};

const FALLBACK_UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'BAG_5KG', 'BAG_10KG', 'BAG_20KG', 'BAG_25KG', 'BAG_40KG', 'BAG_50KG', 'BOTTLE_250ML', 'BOTTLE_300ML', 'BOTTLE_500ML', 'BOTTLE_1L', 'CRATE_6', 'CRATE_12', 'CRATE_24'];

function inferTag(className: string): ItemTag {
    const normalized = className.toLowerCase();
    if (normalized.includes('asset') || normalized.includes('crockery') || normalized.includes('glassware') || normalized.includes('catering')) return 'Asset';
    if (normalized.includes('pack')) return 'Packaging';
    if (normalized.includes('disposable') || normalized.includes('consum')) return 'Consumable';
    if (normalized.includes('cleaning') || normalized.includes('operating') || normalized.includes('mro')) return 'MRO Supplies';
    if (normalized.includes('semi')) return 'Semi-Finished';
    return 'Raw Material';
}

function normalizeTag(value: unknown, className: string): ItemTag {
    return ITEM_TAGS.includes(value as ItemTag) ? value as ItemTag : inferTag(className);
}

function formatInventoryItemNumber(id: number): string {
    return String(10000000 + id);
}

function flattenItems(hierarchy: any[]): InventoryItemRow[] {
    return hierarchy.flatMap((cls) =>
        (cls.types || []).flatMap((type: any) =>
            (type.subTypes || []).flatMap((subType: any) =>
                (subType.items || []).map((item: any) => ({
                    id: item.id,
                    code: item.item_sku || formatInventoryItemNumber(item.id),
                    name: item.item_name,
                    otherLanguageName: item.item_name_other_language || '',
                    classification: cls.class_name || '-',
                    tag: normalizeTag(item.item_tag, cls.class_name || ''),
                    category: type.type_name,
                    subCategory: subType.sub_type_name,
                    purchaseUnit: item.uom_purchase || item.uom_base,
                    issueUnit: item.uom_base,
                    affectsStock: !!subType.affects_stock,
                    affectsRecipe: !!subType.affects_recipe,
                    depreciable: !!subType.depreciable,
                    status: item.item_is_active ? 'active' : 'inactive',
                    subTypeId: subType.id,
                })),
            ),
        ),
    );
}

function ItemFormPanel({
    onClose,
    initial,
    hierarchy,
    uoms,
    onSaved,
}: {
    onClose: () => void;
    initial?: InventoryItemRow;
    hierarchy: any[];
    uoms: any[];
    onSaved: () => Promise<void>;
}) {
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState(initial?.name ?? '');
    const [otherLanguageName, setOtherLanguageName] = useState(initial?.otherLanguageName ?? '');
    const [purchaseUnit, setPurchaseUnit] = useState(initial?.purchaseUnit ?? 'KG');
    const [issueUnit, setIssueUnit] = useState(initial?.issueUnit ?? 'G');
    const [tag, setTag] = useState<ItemTag>(initial?.tag ?? 'Raw Material');
    const [subTypeId, setSubTypeId] = useState<number>(initial?.subTypeId ?? 0);

    const availableSubTypes = useMemo(() => {
        return hierarchy.flatMap((cls) =>
            (cls.types || []).flatMap((type: any) =>
                (type.subTypes || [])
                    .map((subType: any) => ({
                        id: subType.id,
                        label: `${cls.class_name} -> ${type.type_name} -> ${subType.sub_type_name}`,
                    })),
            ),
        );
    }, [hierarchy]);

    useEffect(() => {
        if (!subTypeId && availableSubTypes[0]?.id) {
            setSubTypeId(availableSubTypes[0].id);
        }
    }, [availableSubTypes, subTypeId]);

    const handleSave = async () => {
        if (!name.trim() || !subTypeId) {
            toast.error('Validation Error', 'Item name and sub-category are required.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                item_name: name.trim(),
                item_name_other_language: otherLanguageName.trim() || undefined,
                uom_base: issueUnit,
                uom_purchase: purchaseUnit,
                item_tag: tag,
                item_is_active: true,
            };

            if (initial) {
                await inventoryApi.updateItem(initial.id, payload);
                toast.success('Updated', 'Inventory item updated successfully.');
            } else {
                await inventoryApi.createItem(subTypeId, payload);
                toast.success('Created', 'Inventory item created successfully.');
            }

            await onSaved();
            onClose();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save inventory item.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.formCard}>
            <div className={styles.formHeader}>
                <h3>{initial ? `Edit: ${name}` : 'New Inventory Item'}</h3>
                <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
            </div>
            <div className={styles.formBody}>
                <div className={styles.fieldGroup}>
                    <label>Item Tag *</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {ITEM_TAGS.map((itemTag) => {
                            const meta = TAG_META[itemTag];
                            return (
                            <button key={itemTag} onClick={() => setTag(itemTag)} style={{
                                padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                                background: tag === itemTag ? meta.bg : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${tag === itemTag ? meta.color : 'var(--glass-border)'}`,
                                color: tag === itemTag ? meta.color : 'var(--text-tertiary)',
                                fontSize: '0.78rem', fontWeight: 700,
                            }}>
                                {itemTag}
                            </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: '8px' }}>
                    <div className={styles.fieldGroup}>
                        <label>Item Code</label>
                        <input value={initial?.code ?? 'Auto generated'} disabled className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Item Name *</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Breast" className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Other Language Name</label>
                        <input value={otherLanguageName} onChange={e => setOtherLanguageName(e.target.value)} placeholder="Urdu name" className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Sub-Category *</label>
                        <select value={subTypeId} onChange={e => setSubTypeId(Number(e.target.value))} className={styles.select}>
                            <option value={0}>Select sub-category</option>
                            {availableSubTypes.map((subType) => (
                                <option key={subType.id} value={subType.id}>{subType.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className={styles.fieldGroup}>
                        <label>Purchase Unit *</label>
                        <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className={styles.select}>
                            {(uoms.length ? uoms : FALLBACK_UNITS.map((abbreviation) => ({ abbreviation }))).map((u: any) => <option key={u.abbreviation || u.short_code} value={u.abbreviation || u.short_code}>{u.name ? `${u.name} (${u.abbreviation || u.short_code})` : u.abbreviation}</option>)}
                        </select>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Issue Unit *</label>
                        <select value={issueUnit} onChange={e => setIssueUnit(e.target.value)} className={styles.select}>
                            {(uoms.length ? uoms : FALLBACK_UNITS.map((abbreviation) => ({ abbreviation }))).map((u: any) => <option key={u.abbreviation || u.short_code} value={u.abbreviation || u.short_code}>{u.name ? `${u.name} (${u.abbreviation || u.short_code})` : u.abbreviation}</option>)}
                        </select>
                    </div>
                </div>

                <div className={styles.formActions}>
                    <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !name || !subTypeId}>
                        <Save size={15} />
                        {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Item'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function InventoryItemMaster() {
    const navigate = useNavigate();
    const [items, setItems] = useState<InventoryItemRow[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [uoms, setUoms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItemRow | undefined>();

    const loadHierarchy = useCallback(async () => {
        setLoading(true);
        try {
            const data = await inventoryApi.getHierarchy();
            const uomRows = await catalogApi.getUoms().catch(() => []);
            setHierarchy(data);
            setUoms(uomRows);
            setItems(flattenItems(data));
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load inventory items.');
        } finally {
            setLoading(false);
        }
    }, []);

    const seedUoms = async () => {
        try {
            const rows = await catalogApi.seedDefaultUoms();
            setUoms(rows);
            toast.success('UOMs Added', 'Default weight, volume, bag, bottle, pack, and crate units are ready.');
        } catch (error: any) {
            toast.error('UOM Seed Failed', error.message || 'Could not add default UOMs.');
        }
    };

    useEffect(() => {
        void loadHierarchy();
    }, [loadHierarchy]);

    const filtered = items.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.otherLanguageName.toLowerCase().includes(search.toLowerCase()) ||
            item.classification.toLowerCase().includes(search.toLowerCase()) ||
            item.code.toLowerCase().includes(search.toLowerCase());
        const matchTag = tagFilter === 'all' || item.tag === tagFilter;
        return matchSearch && matchTag;
    });

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.btnSecondary} style={{ padding: '8px 12px' }} onClick={() => navigate('/console/inventory/setup/classifications')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className={styles.titleRow}>
                        <Package size={22} className={styles.titleIcon} />
                        <div>
                            <h1>Item Master</h1>
                            <p className={styles.subtitle}>Client-level master list - branches inherit and enable/disable</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} onClick={() => { setShowForm(true); setEditingItem(undefined); }}>
                        <Plus size={16} /> New Item
                    </button>
                    <button className={styles.btnSecondary} onClick={() => void seedUoms()}>
                        Seed UOMs
                    </button>
                </div>
            </div>

            {(showForm || editingItem) && (
                <ItemFormPanel
                    initial={editingItem}
                    hierarchy={hierarchy}
                    uoms={uoms}
                    onSaved={loadHierarchy}
                    onClose={() => { setShowForm(false); setEditingItem(undefined); }}
                />
            )}

            <div className={styles.toolbarRow}>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
                </div>
                <div className={styles.clsFilter}>
                    <button className={`${styles.clsFilterBtn} ${tagFilter === 'all' ? styles.clsFilterActive : ''}`} onClick={() => setTagFilter('all')}>All</button>
                    {ITEM_TAGS.map((itemTag) => {
                        const meta = TAG_META[itemTag];
                        return (
                        <button key={itemTag} className={`${styles.clsFilterBtn} ${tagFilter === itemTag ? styles.clsFilterActive : ''}`} onClick={() => setTagFilter(itemTag)}>
                            <span className={styles.clsFilterDot} style={{ background: meta.color }} />
                            {itemTag}
                        </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.itemTable}>
                <div className={styles.itemTableHead}>
                    <span style={{ width: '150px' }}>Code</span>
                    <span style={{ flex: 1 }}>Item Name</span>
                    <span style={{ width: '150px' }}>Other Language</span>
                    <span style={{ width: '160px' }}>Classification</span>
                    <span style={{ width: '150px' }}>Tag</span>
                    <span style={{ width: '130px' }}>Category</span>
                    <span style={{ width: '130px' }}>Units</span>
                    <span style={{ width: '130px' }}>Flags</span>
                    <span style={{ width: '80px' }}>Status</span>
                    <span style={{ width: '60px' }}></span>
                </div>
                {loading && (
                    <div style={{ padding: '20px', color: 'var(--text-tertiary)' }}>Loading items...</div>
                )}
                {!loading && filtered.map(item => {
                    const meta = TAG_META[item.tag];
                    return (
                        <div key={item.id} className={styles.itemRow}>
                            <span style={{ width: '150px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.code}</span>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                    {`${item.category}${item.subCategory ? ` -> ${item.subCategory}` : ''}`}
                                </span>
                            </div>
                            <span style={{ width: '150px', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.otherLanguageName || '-'}</span>
                            <span style={{ width: '160px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.classification}</span>
                            <span style={{ width: '150px' }}>
                                <span className={styles.clsBadge} style={{ background: meta.bg, color: meta.color, padding: '3px 8px', fontSize: '0.75rem' }}>
                                    {item.tag}
                                </span>
                            </span>
                            <span style={{ width: '130px', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}</span>
                            <span style={{ width: '130px', fontSize: '0.8rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${item.purchaseUnit} -> ${item.issueUnit}`}</span>
                            <div style={{ width: '130px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {item.affectsStock && <span className={styles.flagMini} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Stock</span>}
                                {item.affectsRecipe && <span className={styles.flagMini} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Recipe</span>}
                                {item.depreciable && <span className={styles.flagMini} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 6px', fontSize: '0.7rem' }}>Depr.</span>}
                            </div>
                            <span style={{ width: '80px' }}>
                                <span style={{
                                    padding: '3px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                                    background: item.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                                    color: item.status === 'active' ? '#10b981' : '#64748b'
                                }}>
                                    {item.status}
                                </span>
                            </span>
                            <div style={{ width: '60px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button className={styles.iconBtn} style={{ width: '28px', height: '28px' }} onClick={() => setEditingItem(item)}><Edit2 size={14} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
