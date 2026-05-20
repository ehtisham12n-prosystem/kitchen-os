/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { Plus, Layout, Ruler, Clock, FolderTree, FileText, X, CheckCircle2, Circle, Utensils, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { catalogApi, orderTypeApi, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './Admin.module.css';

type ArchitectureTab = 'order-types' | 'price-profiles' | 'food-categories' | 'cuisine-types' | 'stations' | 'uom';

interface ArchItem {
    id: number;
    name: string;
    description: string;
    code?: string;
    sort_order?: number;
    branchAvailability?: Record<string, boolean>;
}

interface BranchOption {
    id: string;
    name: string;
    code: string;
}

type MockData = Record<ArchitectureTab, ArchItem[]>;
type DependencyKind = 'category' | 'price-profile' | 'cuisine-type' | 'station' | 'uom';

interface DependencyModalState {
    kind: DependencyKind;
    sourceId: number;
    sourceName: string;
    label: string;
    products: Array<{
        id: number;
        product_name: string;
        product_code?: string | null;
    }>;
    replacementOptions: Array<{ id: number; name: string }>;
}

export function CatalogArchitecture() {
    const [activeTab, setActiveTab] = useState<ArchitectureTab>('order-types');
    const [sortKey, setSortKey] = useState<'name' | 'code' | 'description' | 'scope'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [showModal, setShowModal] = useState(false);
    const [dependencyModal, setDependencyModal] = useState<DependencyModalState | null>(null);
    const [dependencyTargetId, setDependencyTargetId] = useState('');
    const [isDependencyLoading, setIsDependencyLoading] = useState(false);
    const [isDependencySaving, setIsDependencySaving] = useState(false);
    const [editingItem, setEditingItem] = useState<ArchItem | null>(null);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formBranches, setFormBranches] = useState<Record<string, boolean>>({});
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [items, setItems] = useState<MockData>({
        'order-types': [],
        'price-profiles': [],
        'food-categories': [],
        'cuisine-types': [],
        'stations': [],
        'uom': [],
    });

    const tabs = [
        { id: 'order-types', label: 'Order Types', icon: <FileText size={18} /> },
        { id: 'price-profiles', label: 'Price Profiles', icon: <Layout size={18} /> },
        { id: 'food-categories', label: 'Food Categories', icon: <FolderTree size={18} /> },
        { id: 'cuisine-types', label: 'Cuisine Types', icon: <Utensils size={18} /> },
        { id: 'stations', label: 'Kitchen Stations', icon: <Clock size={18} /> },
        { id: 'uom', label: 'Units of Measure', icon: <Ruler size={18} /> },
    ];
    const dependencyKindByTab: Partial<Record<ArchitectureTab, DependencyKind>> = {
        'food-categories': 'category',
        'price-profiles': 'price-profile',
        'cuisine-types': 'cuisine-type',
        stations: 'station',
        uom: 'uom',
    };

    const activeTabLabel = tabs.find(t => t.id === activeTab)?.label ?? '';
    // remove trailing 's' for singular form, e.g. "Menu Types" → "Menu Type"
    const singularLabel = activeTabLabel.endsWith('s')
        ? activeTabLabel.slice(0, -1)
        : activeTabLabel;

    const handleSort = (key: 'name' | 'code' | 'description' | 'scope') => {
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    const renderSortHeader = (label: string, key: 'name' | 'code' | 'description' | 'scope') => {
        const isActive = sortKey === key;
        return (
            <button
                type="button"
                className={`${styles.sortHeader} ${isActive ? styles.sortHeaderActive : ''}`}
                onClick={() => handleSort(key)}
            >
                <span>{label}</span>
                {isActive ? (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                ) : (
                    <ArrowUpDown size={14} />
                )}
            </button>
        );
    };

    const columns: ColumnDef<ArchItem>[] = (() => {
        const base: ColumnDef<ArchItem>[] = [
            { key: 'name', header: renderSortHeader('Name', 'name'), cell: (row) => row.name },
        ];
        if (activeTab === 'uom') {
            base.push({ key: 'code', header: renderSortHeader('Short Code', 'code'), cell: (row) => row.code || '-' });
        }
        base.push(
            { key: 'description', header: renderSortHeader('Description', 'description'), cell: (row) => row.description },
            {
                key: 'branchAvailability',
                header: renderSortHeader('Scope', 'scope'),
                cell: (row) => {
                    const count = Object.values(row.branchAvailability || {}).filter(Boolean).length;
                    return (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {count} / {branches.length} Branches
                        </span>
                    );
                }
            },
            {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                cell: (row) => {
                    const enabledCount = branches.filter(branch => row.branchAvailability?.[branch.id]).length;
                    const isAllEnabled = branches.length > 0 && enabledCount === branches.length;
                    const isAllDisabled = branches.length > 0 && enabledCount === 0;
                    const statusLabel = isAllEnabled ? 'Enabled' : isAllDisabled ? 'Disabled' : 'Mixed';
                    return (
                        <div className={styles.rowActions}>
                            <div className={styles.rowSwitch}>
                                <label className={styles.switchToggle}>
                                    <input
                                        type="checkbox"
                                        className={styles.switchInput}
                                        checked={isAllEnabled}
                                        disabled={branches.length === 0}
                                        onChange={() => updateAllBranches(row, !isAllEnabled)}
                                        aria-label={`Toggle ${row.name} for all branches`}
                                    />
                                    <span className={styles.switchSlider} />
                                </label>
                                <span className={styles.switchLabel}>{statusLabel}</span>
                            </div>
                            <KitchenButton
                                variant="secondary"
                                size="sm"
                                onClick={() => openModal(row)}
                            >
                                Edit
                            </KitchenButton>
                            <KitchenButton
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteRow(row)}
                            >
                                Delete
                            </KitchenButton>
                        </div>
                    );
                }
            }
        );
        return base;
    })();

    const sortedItems = useMemo(() => {
        const activeItems = [...(items[activeTab] || [])];
        const getValue = (item: ArchItem) => {
            if (sortKey === 'name') return item.name || '';
            if (sortKey === 'code') return item.code || '';
            if (sortKey === 'description') return item.description || '';
            return Object.values(item.branchAvailability || {}).filter(Boolean).length;
        };

        activeItems.sort((left, right) => {
            const leftValue = getValue(left);
            const rightValue = getValue(right);

            if (typeof leftValue === 'number' && typeof rightValue === 'number') {
                return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
            }

            const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return activeItems;
    }, [activeTab, items, sortDirection, sortKey]);

    const loadActiveTab = useMemo(() => ({
        'order-types': async () => {
            const data = await orderTypeApi.getOrderTypes();
            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                code: item.code,
                sort_order: item.sort_order,
                branchAvailability: item.branchAvailability || {},
            }));
        },
        'price-profiles': async () => {
            const data = await catalogApi.getPriceProfiles();
            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                code: item.code,
                sort_order: item.sort_order,
                branchAvailability: item.branchAvailability || {},
            }));
        },
        'food-categories': async () => {
            const data = await catalogApi.getCategories();
            return data.map((item: any) => ({
                id: item.id,
                name: item.category_name,
                description: item.category_description || '',
                sort_order: item.category_sort_order,
                branchAvailability: item.branchAvailability || {},
            }));
        },
        'cuisine-types': async () => {
            const data = await catalogApi.getCuisineTypes();
            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                branchAvailability: item.branchAvailability || {},
            }));
        },
        stations: async () => {
            const data = await catalogApi.getStations();
            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                code: item.code,
                sort_order: item.kitchen_display_order,
                branchAvailability: item.branchAvailability || {},
            }));
        },
        uom: async () => {
            const data = await catalogApi.getUoms();
            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                code: item.abbreviation,
                branchAvailability: item.branchAvailability || {},
            }));
        },
    }), []);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const branchData = await setupApi.getBranches();
                setBranches(branchData.map((branch: any) => ({
                    id: String(branch.id),
                    name: branch.branch_name,
                    code: branch.branch_code,
                })));
            } catch (error) {
                console.error('Failed to load branches:', error);
            }
        };

        fetchBranches();
    }, []);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const data = await loadActiveTab[activeTab]();
                setItems((prev) => ({ ...prev, [activeTab]: data }));
            } catch (error) {
                console.error(`Failed to load ${activeTab}:`, error);
                const message = error instanceof Error
                    ? error.message
                    : 'Could not load architecture data.';
                toast.error('Catalog Error', message);
            }
        };

        fetchItems();
    }, [activeTab, loadActiveTab]);

    function openModal(item: ArchItem | null = null) {
        if (item) {
            setEditingItem(item);
            setFormName(item.name);
            setFormDesc(item.description);
            setFormCode(item.code || '');
            setFormBranches(item.branchAvailability || {});
        } else {
            setEditingItem(null);
            setFormName('');
            setFormDesc('');
            setFormCode('');
            const initial: Record<string, boolean> = {};
            branches.forEach(b => initial[b.id] = true);
            setFormBranches(initial);
        }
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
    }

    function closeDependencyModal() {
        setDependencyModal(null);
        setDependencyTargetId('');
    }

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) return;
        if (activeTab === 'uom' && !formCode.trim()) {
            toast.error('Validation Error', 'Short Code is required for UOM.');
            return;
        }

        try {
            const payload = activeTab === 'food-categories'
                ? {
                    category_name: formName.trim(),
                    category_description: formDesc.trim(),
                    branchAvailability: formBranches,
                    ...(editingItem ? {} : { category_sort_order: items[activeTab].length + 1 }),
                }
                : activeTab === 'cuisine-types'
                    ? {
                        name: formName.trim(),
                        description: formDesc.trim(),
                        branchAvailability: formBranches,
                    }
                : activeTab === 'uom'
                    ? {
                        name: formName.trim(),
                        abbreviation: formCode.trim(),
                        description: formDesc.trim(),
                        branchAvailability: formBranches,
                    }
                    : activeTab === 'stations'
                        ? {
                            name: formName.trim(),
                            description: formDesc.trim(),
                            branchAvailability: formBranches,
                            code: editingItem?.code || formName.trim().slice(0, 6).toUpperCase(),
                            ...(editingItem ? {} : { kitchen_display_order: items[activeTab].length + 1 }),
                        }
                        : {
                            name: formName.trim(),
                            description: formDesc.trim(),
                            branchAvailability: formBranches,
                            code: editingItem?.code || formName.trim().slice(0, 6).toUpperCase(),
                            ...(editingItem ? {} : { sort_order: items[activeTab].length + 1 }),
                        };

            const saved: any = await (
                activeTab === 'order-types'
                    ? editingItem ? orderTypeApi.updateOrderType(editingItem.id, payload) : orderTypeApi.createOrderType(payload)
                    : activeTab === 'price-profiles'
                        ? editingItem ? catalogApi.updatePriceProfile(editingItem.id, payload) : catalogApi.createPriceProfile(payload)
                        : activeTab === 'food-categories'
                            ? editingItem ? catalogApi.updateCategory(editingItem.id, payload) : catalogApi.createCategory(payload)
                            : activeTab === 'cuisine-types'
                                ? editingItem ? catalogApi.updateCuisineType(editingItem.id, payload) : catalogApi.createCuisineType(payload)
                            : activeTab === 'stations'
                                ? editingItem ? catalogApi.updateStation(editingItem.id, payload) : catalogApi.createStation(payload)
                                : editingItem ? catalogApi.updateUom(editingItem.id, payload) : catalogApi.createUom(payload)
            );

            const nextItem: ArchItem = {
                id: saved.id,
                name: saved.name || saved.category_name,
                description: saved.description || saved.category_description || '',
                code: saved.code || saved.abbreviation,
                sort_order: saved.sort_order || saved.category_sort_order,
                branchAvailability: saved.branchAvailability || {},
            };

            setItems(prev => ({
                ...prev,
                [activeTab]: editingItem
                    ? prev[activeTab].map(it => it.id === editingItem.id ? nextItem : it)
                    : [...prev[activeTab], nextItem],
            }));
            toast.success('Catalog Saved', `${singularLabel} saved successfully.`);
        } catch (error: any) {
            console.error(`Failed to save ${activeTab}:`, error);
            toast.error('Save Failed', error.message || `Could not save ${singularLabel}.`);
            return;
        }
        closeModal();
    }

    const toggleBranch = (id: string) => {
        setFormBranches(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const buildUpdatePayload = (row: ArchItem, branchAvailability: Record<string, boolean>) => {
        if (activeTab === 'food-categories') {
            return {
                category_name: row.name,
                category_description: row.description || '',
                branchAvailability,
            };
        }
        if (activeTab === 'cuisine-types') {
            return {
                name: row.name,
                description: row.description || '',
                branchAvailability,
            };
        }
        if (activeTab === 'uom') {
            return {
                name: row.name,
                abbreviation: row.code || row.name.slice(0, 4).toUpperCase(),
                description: row.description || '',
                branchAvailability,
            };
        }
        return {
            name: row.name,
            description: row.description || '',
            branchAvailability,
            code: row.code || row.name.slice(0, 6).toUpperCase(),
        };
    };

    async function updateAllBranches(row: ArchItem, enabled: boolean) {
        const nextAvailability: Record<string, boolean> = {};
        branches.forEach(branch => {
            nextAvailability[branch.id] = enabled;
        });
        const payload = buildUpdatePayload(row, nextAvailability);
        try {
            const saved: any = await (
                activeTab === 'order-types'
                    ? orderTypeApi.updateOrderType(row.id, payload)
                    : activeTab === 'price-profiles'
                        ? catalogApi.updatePriceProfile(row.id, payload)
                        : activeTab === 'food-categories'
                            ? catalogApi.updateCategory(row.id, payload)
                            : activeTab === 'cuisine-types'
                                ? catalogApi.updateCuisineType(row.id, payload)
                            : activeTab === 'stations'
                                ? catalogApi.updateStation(row.id, payload)
                                : catalogApi.updateUom(row.id, payload)
            );
            const nextItem: ArchItem = {
                id: saved.id,
                name: saved.name || saved.category_name,
                description: saved.description || saved.category_description || '',
                code: saved.code || saved.abbreviation,
                sort_order: saved.sort_order || saved.category_sort_order,
                branchAvailability: saved.branchAvailability || nextAvailability,
            };
            setItems(prev => ({
                ...prev,
                [activeTab]: prev[activeTab].map(item => item.id === row.id ? nextItem : item),
            }));
            toast.success('Updated', `${singularLabel} updated successfully.`);
        } catch (error: any) {
            console.error(`Failed to update ${activeTab}:`, error);
            toast.error('Save Failed', error.message || `Could not update ${singularLabel}.`);
        }
    }

    async function performDeleteRow(row: ArchItem) {
        await (
            activeTab === 'order-types'
                ? orderTypeApi.deleteOrderType(row.id)
                : activeTab === 'price-profiles'
                    ? catalogApi.deletePriceProfile(row.id)
                    : activeTab === 'food-categories'
                        ? catalogApi.deleteCategory(row.id)
                        : activeTab === 'cuisine-types'
                            ? catalogApi.deleteCuisineType(row.id)
                        : activeTab === 'stations'
                            ? catalogApi.deleteStation(row.id)
                            : catalogApi.deleteUom(row.id)
        );
    }

    async function openDependencyModalForRow(row: ArchItem) {
        const dependencyKind = dependencyKindByTab[activeTab];
        if (!dependencyKind) return false;

        setIsDependencyLoading(true);
        try {
            const response = await catalogApi.getTaxonomyDependencies(dependencyKind, row.id);
            setDependencyModal({
                kind: dependencyKind,
                sourceId: row.id,
                sourceName: row.name,
                label: response.label || singularLabel,
                products: response.products || [],
                replacementOptions: response.replacement_options || [],
            });
            setDependencyTargetId(response.replacement_options?.[0]?.id ? String(response.replacement_options[0].id) : '');
            return true;
        } catch (error: any) {
            toast.error('Delete Failed', error.message || `Could not load dependent products for ${row.name}.`);
            return false;
        } finally {
            setIsDependencyLoading(false);
        }
    }

    async function handleDeleteRow(row: ArchItem) {
        const confirmed = window.confirm(`Delete ${singularLabel} "${row.name}" for all branches?`);
        if (!confirmed) return;

        try {
            await performDeleteRow(row);
            setItems(prev => ({
                ...prev,
                [activeTab]: prev[activeTab].filter(item => item.id !== row.id),
            }));
            toast.success('Deleted', `${singularLabel} deleted successfully.`);
        } catch (error: any) {
            console.error(`Failed to delete ${activeTab}:`, error);
            const opened = await openDependencyModalForRow(row);
            if (!opened) {
                toast.error('Delete Failed', error.message || `Could not delete ${singularLabel}.`);
            }
        }
    }

    async function handleDependencyReassignAndDelete() {
        if (!dependencyModal || !dependencyTargetId) {
            toast.error('Reassignment Required', 'Select a replacement before deleting this item.');
            return;
        }

        setIsDependencySaving(true);
        try {
            await catalogApi.reassignTaxonomyDependencies(dependencyModal.kind, dependencyModal.sourceId, {
                target_id: Number(dependencyTargetId),
            });
            await performDeleteRow({ id: dependencyModal.sourceId, name: dependencyModal.sourceName, description: '' });
            setItems(prev => ({
                ...prev,
                [activeTab]: prev[activeTab].filter(item => item.id !== dependencyModal.sourceId),
            }));
            toast.success('Reassigned', `Products were moved and ${dependencyModal.label} deleted successfully.`);
            closeDependencyModal();
        } catch (error: any) {
            console.error('Failed to reassign dependencies:', error);
            toast.error('Reassign Failed', error.message || 'Could not reassign active products.');
        } finally {
            setIsDependencySaving(false);
        }
    }

    return (
        <div className={`${styles.container} ${styles.archPage}`}>
            <header className={`${styles.header} ${styles.archHeader}`}>
                <div>
                    <h1>Menu Architect</h1>
                    <p>Build the foundational taxonomies for your product ecosystem.</p>
                </div>
                <KitchenButton onClick={() => openModal(null)}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Add {singularLabel}
                </KitchenButton>
            </header>

            <div className={`${styles.tabsStrip} ${styles.archTabsStrip}`}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab.id as ArchitectureTab)}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <KitchenCard className={`${styles.tableCard} ${styles.archTableCard}`}>
                <KitchenTable columns={columns} data={sortedItems} compact={true} />
            </KitchenCard>

            {/* Add Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingItem ? `Configure ${singularLabel}` : `Add ${singularLabel}`}</h2>
                            <button className={styles.modalClose} onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className={styles.modalForm}>
                            <div className={styles.modalBody}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="arch-name">Name <span className={styles.required}>*</span></label>
                                    <input
                                        id="arch-name"
                                        type="text"
                                        className={styles.formInput}
                                        placeholder={`e.g. Test`}
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="arch-desc">Description</label>
                                    <textarea
                                        id="arch-desc"
                                        className={styles.formTextarea}
                                        placeholder="Short description (optional)"
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                                {activeTab === 'uom' && (
                                    <div className={styles.formGroup}>
                                        <label htmlFor="arch-code">Short Code <span className={styles.required}>*</span></label>
                                        <input
                                            id="arch-code"
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="e.g. KG"
                                            value={formCode}
                                            onChange={e => setFormCode(e.target.value.toUpperCase())}
                                            required
                                        />
                                    </div>
                                )}

                                <div className={styles.separator} data-label="Branch Availability Management" />

                                <div className={styles.branchGrid}>
                                    {branches.map(branch => {
                                        const isEnabled = formBranches[branch.id];
                                        return (
                                            <div
                                                key={branch.id}
                                                className={`${styles.branchToggle} ${isEnabled ? styles.enabled : ''}`}
                                                onClick={() => toggleBranch(branch.id)}
                                            >
                                                <div className={styles.branchInfo}>
                                                    <span className={styles.branchName}>{branch.name}</span>
                                                    <span className={styles.branchCode}>{branch.code}</span>
                                                </div>
                                                {isEnabled ? <CheckCircle2 size={18} color="var(--accent-primary)" /> : <Circle size={18} color="var(--text-tertiary)" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                                <div className={styles.modalActions}>
                                    <KitchenButton type="button" variant="secondary" onClick={closeModal}>
                                        Discard Changes
                                    </KitchenButton>
                                <KitchenButton type="submit">
                                    {editingItem ? 'Save Configuration' : `Add ${singularLabel}`}
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {dependencyModal && (
                <div className={styles.modalOverlay} onClick={closeDependencyModal}>
                    <div className={`${styles.modal} ${styles.dependencyModal}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Reassign Active Products</h2>
                            <button className={styles.modalClose} onClick={closeDependencyModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={`${styles.modalBody} ${styles.dependencyBody}`}>
                            <div className={styles.dependencyIntro}>
                                <strong>{dependencyModal.sourceName}</strong>
                                <span>
                                    This {dependencyModal.label.toLowerCase()} is still assigned to {dependencyModal.products.length} active product(s).
                                    Reassign them from this module, then delete the item.
                                </span>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="dependency-target">Move products to</label>
                                <select
                                    id="dependency-target"
                                    className={styles.formInput}
                                    value={dependencyTargetId}
                                    onChange={(e) => setDependencyTargetId(e.target.value)}
                                >
                                    <option value="">Select replacement</option>
                                    {dependencyModal.replacementOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.dependencyProductList}>
                                {isDependencyLoading ? (
                                    <div className={styles.compactLoader}>Loading active products...</div>
                                ) : dependencyModal.products.map((product) => (
                                    <div key={product.id} className={styles.dependencyProductRow}>
                                        <div className={styles.dependencyProductInfo}>
                                            <strong>{product.product_name}</strong>
                                            <span>{product.product_code || `Product ID: ${product.id}`}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton type="button" variant="secondary" onClick={closeDependencyModal}>
                                Cancel
                            </KitchenButton>
                            <KitchenButton
                                type="button"
                                onClick={() => void handleDependencyReassignAndDelete()}
                                disabled={!dependencyTargetId || dependencyModal.replacementOptions.length === 0}
                                isLoading={isDependencySaving}
                            >
                                Reassign And Delete
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CatalogArchitecture;
