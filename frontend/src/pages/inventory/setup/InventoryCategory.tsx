/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    FolderTree, Plus, Edit2, Trash2, ChevronRight,
    ChevronDown, Save, X, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { toast } from '../../../components/ui/KitchenToast/toast';
import styles from './InventorySetup.module.css';
import { inventoryApi } from '../../../api/api';

interface SubCategory {
    id: number;
    name: string;
    itemCount: number;
    affectsStock: boolean;
    affectsRecipe: boolean;
    depreciable: boolean;
    trackExpiry: boolean;
    trackBatch: boolean;
    allowIssuance: boolean;
}

interface Category {
    id: number;
    name: string;
    classificationId: number;
    itemCount: number;
    subCategories: SubCategory[];
    expanded: boolean;
}

const FLAGS = [
    { key: 'affectsStock', label: 'Depletes Stock', description: 'Receiving adds stock; issuing reduces stock' },
    { key: 'affectsRecipe', label: 'Recipe Usable', description: 'Can be linked to recipe ingredients' },
    { key: 'depreciable', label: 'Depreciable', description: 'Linked to accounting depreciation schedule' },
    { key: 'trackExpiry', label: 'Track Expiry', description: 'Expiry date mandatory on receiving' },
    { key: 'trackBatch', label: 'Track Batch', description: 'Batch number required on all movements' },
    { key: 'allowIssuance', label: 'Allow Issuance', description: 'Can be issued to kitchen / production' },
];

export function InventoryCategory() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clsFilter = searchParams.get('cls') || 'all';

    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCls, setActiveCls] = useState(clsFilter === 'all' ? 'all' : clsFilter);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatClassId, setNewCatClassId] = useState<number>(0);
    const [editingCat, setEditingCat] = useState<number | null>(null);
    const [editCatName, setEditCatName] = useState('');
    const [addingSubCat, setAddingSubCat] = useState<number | null>(null);
    const [newSubCatName, setNewSubCatName] = useState('');
    const [newSubCatDraft, setNewSubCatDraft] = useState<Partial<SubCategory> | null>(null);
    const [editingSubCat, setEditingSubCat] = useState<number | null>(null);
    const [subCatDraft, setSubCatDraft] = useState<SubCategory | null>(null);

    const loadHierarchy = useCallback(async () => {
        setLoading(true);
        try {
            const fullHierarchy = await inventoryApi.getHierarchy();
            setHierarchy(fullHierarchy);
            const nextCategories = fullHierarchy.flatMap((cls: any) =>
                (cls.types || []).map((type: any) => ({
                    id: type.id,
                    name: type.type_name,
                    classificationId: cls.id,
                    itemCount: (type.subTypes || []).reduce((sum: number, subType: any) => sum + (subType.items?.length || 0), 0),
                    subCategories: (type.subTypes || []).map((subType: any) => ({
                        id: subType.id,
                        name: subType.sub_type_name,
                        itemCount: subType.items?.length || 0,
                        affectsStock: !!subType.affects_stock,
                        affectsRecipe: !!subType.affects_recipe,
                        depreciable: !!subType.depreciable,
                        trackExpiry: !!subType.track_expiry,
                        trackBatch: !!subType.track_batch,
                        allowIssuance: !!subType.allow_issuance,
                    })),
                    expanded: true,
                })),
            );
            setCategories(nextCategories);
            if (!newCatClassId && fullHierarchy[0]?.id) {
                setNewCatClassId(fullHierarchy[0].id);
            }
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load categories.');
        } finally {
            setLoading(false);
        }
    }, [newCatClassId]);

    useEffect(() => {
        void loadHierarchy();
    }, [loadHierarchy]);

    const filtered = useMemo(() => {
        return categories.filter(c => activeCls === 'all' || String(c.classificationId) === activeCls);
    }, [activeCls, categories]);

    const classifications = useMemo(() => hierarchy.map((cls) => ({
        id: cls.id,
        code: String(cls.class_name || '').slice(0, 3).toUpperCase(),
        name: cls.class_name,
        color: '#6366f1',
    })), [hierarchy]);

    const toggleExpand = (id: number) => {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c));
    };

    const addCategory = async () => {
        if (!newCatName.trim() || !newCatClassId) return;
        try {
            await inventoryApi.createType(newCatClassId, { type_name: newCatName.trim() });
            setNewCatName('');
            setAdding(false);
            await loadHierarchy();
            toast.success('Created', 'Category created successfully.');
        } catch (error: any) {
            toast.error('Create Failed', error.message || 'Could not create category.');
        }
    };

    const deleteCategory = async (id: number, itemCount: number) => {
        if (itemCount > 0) {
            toast.error('Action Restricted', 'Cannot delete a category with items assigned.');
            return;
        }
        try {
            await inventoryApi.deleteType(id);
            await loadHierarchy();
            toast.success('Deleted', 'Category deleted successfully.');
        } catch (error: any) {
            toast.error('Delete Failed', error.message || 'Could not delete category.');
        }
    };

    const saveEditCat = async (id: number) => {
        try {
            await inventoryApi.updateType(id, { type_name: editCatName.trim() });
            setEditingCat(null);
            await loadHierarchy();
            toast.success('Updated', 'Category updated successfully.');
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Could not update category.');
        }
    };

    const startAddSubCat = (catId: number) => {
        setAddingSubCat(catId);
        setNewSubCatName('');
        setNewSubCatDraft({
            affectsStock: true,
            affectsRecipe: true,
            depreciable: false,
            trackExpiry: false,
            trackBatch: false,
            allowIssuance: true
        });
    };

    const addSubCategory = async (catId: number) => {
        if (!newSubCatName.trim() || !newSubCatDraft) return;
        try {
            await inventoryApi.createSubType(catId, {
                sub_type_name: newSubCatName.trim(),
                affects_stock: !!newSubCatDraft.affectsStock,
                affects_recipe: !!newSubCatDraft.affectsRecipe,
                depreciable: !!newSubCatDraft.depreciable,
                track_expiry: !!newSubCatDraft.trackExpiry,
                track_batch: !!newSubCatDraft.trackBatch,
                allow_issuance: !!newSubCatDraft.allowIssuance,
            });
            setNewSubCatName('');
            setAddingSubCat(null);
            setNewSubCatDraft(null);
            await loadHierarchy();
            toast.success('Created', 'Sub-category created successfully.');
        } catch (error: any) {
            toast.error('Create Failed', error.message || 'Could not create sub-category.');
        }
    };

    const deleteSubCat = async (subId: number, itemCount: number) => {
        if (itemCount > 0) {
            toast.error('Action Restricted', 'Cannot delete a sub-category with items assigned.');
            return;
        }
        try {
            await inventoryApi.deleteSubType(subId);
            await loadHierarchy();
            toast.success('Deleted', 'Sub-category deleted successfully.');
        } catch (error: any) {
            toast.error('Delete Failed', error.message || 'Could not delete sub-category.');
        }
    };

    const startEditSubCat = (sub: SubCategory) => {
        setEditingSubCat(sub.id);
        setSubCatDraft({ ...sub });
    };

    const saveSubCat = async () => {
        if (!subCatDraft) return;
        try {
            await inventoryApi.updateSubType(subCatDraft.id, {
                sub_type_name: subCatDraft.name,
                affects_stock: subCatDraft.affectsStock,
                affects_recipe: subCatDraft.affectsRecipe,
                depreciable: subCatDraft.depreciable,
                track_expiry: subCatDraft.trackExpiry,
                track_batch: subCatDraft.trackBatch,
                allow_issuance: subCatDraft.allowIssuance,
            });
            setEditingSubCat(null);
            setSubCatDraft(null);
            await loadHierarchy();
            toast.success('Updated', 'Sub-category updated successfully.');
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Could not update sub-category.');
        }
    };

    const toggleSubCatFlag = (key: string, isNew = false) => {
        if (isNew) {
            setNewSubCatDraft(prev => prev ? ({ ...prev, [key]: !prev[key as keyof Partial<SubCategory>] }) : null);
            return;
        }
        setSubCatDraft(prev => prev ? ({ ...prev, [key]: !prev[key as keyof SubCategory] }) : null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.btnSecondary} style={{ padding: '4px 8px' }} onClick={() => navigate('/console/inventory/setup/classifications')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className={styles.titleRow}>
                        <FolderTree size={22} className={styles.titleIcon} />
                        <div>
                            <h1>Categories & Sub-Categories</h1>
                            <p className={styles.subtitle}>Organise inventory items into a reporting hierarchy</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.btnPrimary} onClick={() => setAdding(true)}>
                        <Plus size={16} /> Add Category
                    </button>
                </div>
            </div>

            <div className={styles.clsFilter}>
                <button className={`${styles.clsFilterBtn} ${activeCls === 'all' ? styles.clsFilterActive : ''}`} onClick={() => setActiveCls('all')}>
                    All Classifications
                </button>
                {classifications.map((cls: any) => (
                    <button
                        key={cls.id}
                        className={`${styles.clsFilterBtn} ${activeCls === String(cls.id) ? styles.clsFilterActive : ''}`}
                        onClick={() => setActiveCls(String(cls.id))}
                    >
                        <span className={styles.clsFilterDot} style={{ background: cls.color }} />
                        {cls.name}
                    </button>
                ))}
            </div>

            {adding && (
                <div className={styles.formCard}>
                    <div className={styles.formHeader}>
                        <h3>New Category</h3>
                        <button className={styles.closeBtn} onClick={() => setAdding(false)}><X size={15} /></button>
                    </div>
                    <div className={styles.formBody} style={{ gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '8px' }}>
                            <div className={styles.fieldGroup}>
                                <label>Category Name</label>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Meat & Poultry" className={styles.input} autoFocus />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Classification</label>
                                <select value={newCatClassId} onChange={(e) => setNewCatClassId(Number(e.target.value))} className={styles.select}>
                                    {classifications.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={styles.formActions}>
                            <button className={styles.btnSecondary} onClick={() => setAdding(false)}>Cancel</button>
                            <button className={styles.btnPrimary} onClick={addCategory} disabled={!newCatName.trim()}>
                                <Save size={14} /> Create Category
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.catTree}>
                {loading && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        Loading categories...
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        No categories found for this classification.
                    </div>
                )}
                {filtered.map(cat => {
                    const cls = classifications.find((c: any) => c.id === cat.classificationId);
                    return (
                        <div key={cat.id} className={styles.catBlock}>
                            <div className={styles.catBlockHeader}>
                                <button onClick={() => toggleExpand(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                    {cat.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <span className={styles.catDot} style={{ background: cls?.color || 'var(--accent-primary)' }} />
                                {editingCat === cat.id ? (
                                    <input value={editCatName} onChange={e => setEditCatName(e.target.value)} className={styles.input} style={{ flex: 1, padding: '2px 8px' }} autoFocus />
                                ) : (
                                    <span className={styles.catName}>{cat.name}</span>
                                )}
                                <span className={styles.catItemCount}>{cat.itemCount} items · {cat.subCategories.length} sub-cats</span>
                                {cls && (
                                    <span className={styles.clsBadge} style={{ background: `${cls.color}18`, color: cls.color, fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                                        {cls.code}
                                    </span>
                                )}
                                <div className={styles.catActions}>
                                    {editingCat === cat.id ? (
                                        <>
                                            <button className={styles.iconBtn} onClick={() => saveEditCat(cat.id)}><Save size={13} /></button>
                                            <button className={styles.iconBtn} onClick={() => setEditingCat(null)}><X size={13} /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={styles.iconBtn} onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); }}><Edit2 size={13} /></button>
                                            <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => deleteCategory(cat.id, cat.itemCount)}><Trash2 size={13} /></button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {cat.expanded && (
                                <div className={styles.subCatList}>
                                    {cat.subCategories.map(sub => {
                                        const isEditing = editingSubCat === sub.id;
                                        return (
                                            <div key={sub.id} className={`${styles.subCatContainer} ${isEditing ? styles.subCatEditing : ''}`}>
                                                <div className={styles.subCatRow}>
                                                    <span className={styles.subCatBullet} />
                                                    {isEditing ? (
                                                        <input
                                                            value={subCatDraft?.name}
                                                            onChange={e => setSubCatDraft(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                                                            className={styles.input}
                                                            style={{ flex: 1, padding: '2px 8px' }}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className={styles.subCatName}>{sub.name}</span>
                                                    )}

                                                    {!isEditing && (
                                                        <div className={styles.subCatFlags}>
                                                            {FLAGS.map(f => (
                                                                sub[f.key as keyof SubCategory] && (
                                                                    <span key={f.key} className={styles.miniFlag} title={f.label}>
                                                                        {f.label.split(' ')[0]}
                                                                    </span>
                                                                )
                                                            ))}
                                                        </div>
                                                    )}

                                                    <span className={styles.subCatItemCount}>{sub.itemCount} items</span>

                                                    <div className={styles.subCatActions}>
                                                        {isEditing ? (
                                                            <>
                                                                <button className={styles.iconBtn} onClick={saveSubCat}><Save size={12} /></button>
                                                                <button className={styles.iconBtn} onClick={() => setEditingSubCat(null)}><X size={12} /></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button className={styles.iconBtn} onClick={() => startEditSubCat(sub)}><Edit2 size={12} /></button>
                                                                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => deleteSubCat(sub.id, sub.itemCount)}><Trash2 size={12} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {isEditing && (
                                                    <div className={styles.subCatFlagsEditor}>
                                                        <div className={styles.flagsSectionLabel}>Behavior Flags</div>
                                                        <div className={styles.flagsGridCompact}>
                                                            {FLAGS.map(flag => {
                                                                const isOn = subCatDraft?.[flag.key as keyof SubCategory] as boolean;
                                                                return (
                                                                    <button
                                                                        key={flag.key}
                                                                        className={`${styles.flagCardSmall} ${isOn ? styles.flagOn : ''}`}
                                                                        onClick={() => toggleSubCatFlag(flag.key)}
                                                                    >
                                                                        <span className={`${styles.flagToggleSmall} ${isOn ? styles.toggleOn : ''}`}>
                                                                            {isOn ? <CheckCircle2 size={12} /> : <X size={12} />}
                                                                        </span>
                                                                        <div className={styles.flagTextSmall}>
                                                                            <span className={styles.flagNameSmall}>{flag.label}</span>
                                                                            <span className={styles.flagDescSmall}>{flag.description}</span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {addingSubCat === cat.id ? (
                                        <div className={styles.addSubCatForm}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    value={newSubCatName}
                                                    onChange={e => setNewSubCatName(e.target.value)}
                                                    placeholder="Sub-category name..."
                                                    className={styles.input}
                                                    style={{ flex: 1, padding: '4px 8px' }}
                                                    autoFocus
                                                />
                                                <button className={styles.btnPrimary} style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => addSubCategory(cat.id)}>Create</button>
                                                <button className={styles.btnSecondary} style={{ padding: '4px 8px' }} onClick={() => { setAddingSubCat(null); setNewSubCatName(''); }}><X size={14} /></button>
                                            </div>

                                            <div className={styles.subCatFlagsEditor} style={{ paddingLeft: '0', marginTop: '4px' }}>
                                                <div className={styles.flagsSectionLabel} style={{ fontSize: '0.65rem' }}>Set Behavior at Creation</div>
                                                <div className={styles.flagsGridCompact} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                                    {FLAGS.map(flag => {
                                                        const isOn = !!newSubCatDraft?.[flag.key as keyof Partial<SubCategory>];
                                                        return (
                                                            <button
                                                                key={flag.key}
                                                                className={`${styles.flagCardSmall} ${isOn ? styles.flagOn : ''}`}
                                                                onClick={() => toggleSubCatFlag(flag.key, true)}
                                                                style={{ padding: '4px 8px' }}
                                                            >
                                                                <span className={`${styles.flagToggleSmall} ${isOn ? styles.toggleOn : ''}`} style={{ width: '16px', height: '16px' }}>
                                                                    {isOn ? <CheckCircle2 size={10} /> : <X size={10} />}
                                                                </span>
                                                                <div className={styles.flagTextSmall}>
                                                                    <span className={styles.flagNameSmall} style={{ fontSize: '0.7rem' }}>{flag.label}</span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className={styles.addSubCatBtn} onClick={() => startAddSubCat(cat.id)}>
                                            <Plus size={12} /> Add Sub-Category
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
