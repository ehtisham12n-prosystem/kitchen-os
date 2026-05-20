/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './BranchItemSetup.module.css';
import setupStyles from './InventorySetup.module.css';
import {
    Package,
    Search,
    Plus,
    CheckCircle,
    PackageSearch,
    AlertTriangle,
    Info,
    Filter,
    Store,
    Layers,
    Tag,
    ArrowUpDown,
} from 'lucide-react';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { apiUrl } from '../../../api/api';
import { Check, X } from 'lucide-react';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';
import { clearAuthSession, readAuthSessionItem } from '../../../auth/storage';

type ItemTag = 'Raw Material' | 'Semi-Finished' | 'MRO Supplies' | 'Asset' | 'Packaging' | 'Consumable';
type SortKey =
    | 'item_sku'
    | 'item_name'
    | 'item_name_other_language'
    | 'classification'
    | 'item_tag'
    | 'category'
    | 'purchase_unit'
    | 'issue_unit'
    | 'flags'
    | 'branch'
    | 'configuration';
type SortDirection = 'asc' | 'desc';

interface InventoryItem {
    id: number;
    item_name: string;
    item_name_other_language?: string | null;
    item_sku: string;
    uom_base: string;
    uom_purchase?: string | null;
    item_tag?: ItemTag | string | null;
    is_enabled: boolean;
    min_level: number;
    max_level: number;
    current_stock: number;
    subType: {
        id: number;
        sub_type_name: string;
        affects_stock?: boolean;
        affects_recipe?: boolean;
        depreciable?: boolean;
        inventoryType?: {
            id: number;
            type_name: string;
            inventoryClass?: {
                id: number;
                class_name: string;
            };
        };
        type: {
            id: number;
            type_name: string;
            inventoryClass: {
                id: number;
                class_name: string;
            };
        };
    };
}

const TAG_META: Record<ItemTag, { color: string; bg: string }> = {
    'Raw Material': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    'Semi-Finished': { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    'MRO Supplies': { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    Asset: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    Packaging: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    Consumable: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
};

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
    const candidate = String(value || '').trim() as ItemTag;
    return candidate in TAG_META ? candidate : inferTag(className);
}

export function BranchItemSetup() {
    const { allowedBranches, canReadInventory, canAdjustInventory, canAccessBranch } = usePermissionAccess();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchSku, setSearchSku] = useState('');
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localThresholds, setLocalThresholds] = useState<Record<number, { min: number, max: number }>>({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(25);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('All');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
    const [selectedTag, setSelectedTag] = useState<string>('All');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>(localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id') || '');
    const [sortKey, setSortKey] = useState<SortKey>('item_name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const canChangeBranch = allowedBranches.length > 1;

    const fetchInitialData = useCallback(async () => {
        try {
            if (canReadInventory) {
                const branchResponse = await fetch(apiUrl('/setup/branches'), {
                    headers: { Authorization: `Bearer ${readAuthSessionItem('access_token')}` },
                });
                if (branchResponse.ok) {
                    const branchList = (await branchResponse.json()).filter((branch: any) => canAccessBranch(branch.id));
                    setBranches(branchList);
                    if (!selectedBranchId && branchList.length > 0) {
                        setSelectedBranchId(String(branchList[0].id));
                    }
                }
            }

            const hierarchyResponse = await fetch(apiUrl('/inventory/filter-hierarchy'), {
                headers: { Authorization: `Bearer ${readAuthSessionItem('access_token')}` },
            });
            if (hierarchyResponse.ok) {
                setHierarchy(await hierarchyResponse.json());
            }
        } catch {
            // Ignore auxiliary fetch failures for filter metadata.
        }
    }, [canAccessBranch, canReadInventory, selectedBranchId]);

    const fetchItems = useCallback(async (branchId?: string, targetPage?: number) => {
        setError(null);
        try {
            setLoading(true);
            const targetBranchId = branchId || selectedBranchId;
            if (!targetBranchId || !canAccessBranch(targetBranchId)) {
                setItems([]);
                return;
            }

            const currentPage = targetPage || page;
            const params = new URLSearchParams();
            params.append('branchId', targetBranchId);
            params.append('page', currentPage.toString());
            params.append('limit', limit.toString());
            if (searchTerm) params.append('search', searchTerm);
            if (searchSku) params.append('sku', searchSku);
            if (selectedTag !== 'All') params.append('tag', selectedTag);
            if (selectedClass !== 'All') params.append('class', selectedClass);
            if (selectedCategory !== 'All') params.append('category', selectedCategory);
            if (selectedSubCategory !== 'All') params.append('subCategory', selectedSubCategory);

            const response = await fetch(apiUrl(`/inventory/branch-master?${params.toString()}`), {
                headers: {
                    Authorization: `Bearer ${readAuthSessionItem('access_token')}`,
                },
            });

            if (response.status === 401) {
                clearAuthSession();
                window.location.href = '/console/auth';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data && data.items) {
                setItems(data.items);
                setTotal(data.total);
                if (targetPage) setPage(targetPage);
            } else {
                setItems(Array.isArray(data) ? data : []);
                setTotal(Array.isArray(data) ? data.length : 0);
            }
        } catch (err: any) {
            console.error('Failed to fetch items', err);
            setError(`Connection Error: ${err.message}.`);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [canAccessBranch, limit, page, searchSku, searchTerm, selectedBranchId, selectedCategory, selectedClass, selectedSubCategory, selectedTag]);

    useEffect(() => {
        void fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedBranchId) {
                void fetchItems(selectedBranchId, 1);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchItems, selectedBranchId, searchTerm, searchSku, selectedClass, selectedCategory, selectedSubCategory, selectedTag, limit]);

    useEffect(() => {
        if (selectedBranchId) {
            void fetchItems(selectedBranchId, page);
        }
    }, [fetchItems, page, selectedBranchId]);

    const toggleItem = async (itemId: number, enabled: boolean) => {
        const item = items.find((entry) => entry.id === itemId);
        const thresholds = localThresholds[itemId] || {
            min: item?.min_level ?? 0,
            max: item?.max_level ?? 0,
        };

        if (enabled && (!thresholds.min || !thresholds.max || thresholds.min <= 0 || thresholds.max <= 0)) {
            setError('Min Qty and Max Qty are mandatory for enabled items and cannot be zero.');
            if (item) {
                setLocalThresholds((prev) => ({
                    ...prev,
                    [itemId]: {
                        min: prev[itemId]?.min ?? item.min_level,
                        max: prev[itemId]?.max ?? item.max_level,
                    },
                }));
            }
            return;
        }

        try {
            await fetch(apiUrl(`/inventory/branch-toggle/${itemId}?branchId=${selectedBranchId}`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${readAuthSessionItem('access_token')}`,
                },
                body: JSON.stringify({ enabled }),
            });
            setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, is_enabled: enabled } : item)));
            setError(null);
        } catch (err) {
            console.error('Toggle failed', err);
            void fetchItems(selectedBranchId);
        }
    };

    const handleThresholdChange = (itemId: number, field: 'min' | 'max', value: number) => {
        const item = items.find((entry) => entry.id === itemId);
        if (!item) return;

        setLocalThresholds((prev) => ({
            ...prev,
            [itemId]: {
                min: prev[itemId]?.min ?? item.min_level,
                max: prev[itemId]?.max ?? item.max_level,
                [field]: Number.isFinite(value) ? value : 0,
            },
        }));
    };

    const saveStockLevels = async (itemId: number) => {
        const thresholds = localThresholds[itemId];
        if (!thresholds) return;

        if (thresholds.min <= 0 || thresholds.max <= 0) {
            setError('Min Qty and Max Qty are mandatory for enabled items and cannot be zero.');
            return;
        }

        if (thresholds.max < thresholds.min) {
            setError('Max Qty must be greater than or equal to Min Qty.');
            return;
        }

        try {
            const response = await fetch(apiUrl(`/inventory/branch-stock/${itemId}?branchId=${selectedBranchId}`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${readAuthSessionItem('access_token')}`,
                },
                body: JSON.stringify({ min: thresholds.min, max: thresholds.max }),
            });

            if (response.ok) {
                setItems((prev) => prev.map((item) => (
                    item.id === itemId ? { ...item, min_level: thresholds.min, max_level: thresholds.max } : item
                )));
                setLocalThresholds((prev) => {
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                });
                setError(null);
            }
        } catch (err) {
            console.error('Save failed', err);
        }
    };

    const handleSort = (key: SortKey) => {
        setSortKey((currentKey) => {
            if (currentKey === key) {
                setSortDirection((currentDir) => (currentDir === 'asc' ? 'desc' : 'asc'));
                return currentKey;
            }
            setSortDirection('asc');
            return key;
        });
    };

    const filteredItems = useMemo(() => {
        const getCategoryType = (row: InventoryItem) => row.subType?.inventoryType ?? row.subType?.type;
        const getClassification = (row: InventoryItem) => getCategoryType(row)?.inventoryClass?.class_name || '';
        const getCategory = (row: InventoryItem) => getCategoryType(row)?.type_name || '';
        const getFlagsScore = (row: InventoryItem) => [row.subType?.affects_stock, row.subType?.affects_recipe, row.subType?.depreciable].filter(Boolean).length;
        const getConfigValue = (row: InventoryItem) => {
            const thresholds = localThresholds[row.id] || { min: row.min_level, max: row.max_level };
            return `${thresholds.min}:${thresholds.max}`;
        };

        return [...items].sort((left, right) => {
            let leftValue: string | number = '';
            let rightValue: string | number = '';

            switch (sortKey) {
                case 'item_sku':
                    leftValue = left.item_sku || '';
                    rightValue = right.item_sku || '';
                    break;
                case 'item_name':
                    leftValue = left.item_name || '';
                    rightValue = right.item_name || '';
                    break;
                case 'item_name_other_language':
                    leftValue = left.item_name_other_language || '';
                    rightValue = right.item_name_other_language || '';
                    break;
                case 'classification':
                    leftValue = getClassification(left);
                    rightValue = getClassification(right);
                    break;
                case 'item_tag':
                    leftValue = normalizeTag(left.item_tag, getClassification(left));
                    rightValue = normalizeTag(right.item_tag, getClassification(right));
                    break;
                case 'category':
                    leftValue = getCategory(left);
                    rightValue = getCategory(right);
                    break;
                case 'purchase_unit':
                    leftValue = left.uom_purchase || left.uom_base || '';
                    rightValue = right.uom_purchase || right.uom_base || '';
                    break;
                case 'issue_unit':
                    leftValue = left.uom_base || '';
                    rightValue = right.uom_base || '';
                    break;
                case 'flags':
                    leftValue = getFlagsScore(left);
                    rightValue = getFlagsScore(right);
                    break;
                case 'branch':
                    leftValue = left.is_enabled ? 1 : 0;
                    rightValue = right.is_enabled ? 1 : 0;
                    break;
                case 'configuration':
                    leftValue = getConfigValue(left);
                    rightValue = getConfigValue(right);
                    break;
                default:
                    break;
            }

            const baseResult = typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue));
            return sortDirection === 'asc' ? baseResult : -baseResult;
        });
    }, [items, localThresholds, sortDirection, sortKey]);
    const classifications = ['All', ...hierarchy.map((entry) => entry.class_name)];
    const categoriesList = ['All', ...(hierarchy.find((entry) => entry.class_name === selectedClass)?.types?.map((type: any) => type.type_name) || [])];
    const subCategoriesList = ['All', ...(hierarchy.find((entry) => entry.class_name === selectedClass)?.types?.find((type: any) => type.type_name === selectedCategory)?.subTypes?.map((subType: any) => subType.sub_type_name) || [])];
    const tagList = ['All', ...Object.keys(TAG_META)];

    const stats = {
        total: total || items.length,
        enabled: items.filter((item) => item.is_enabled).length,
        disabled: items.filter((item) => !item.is_enabled).length,
        visible: filteredItems.length,
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageStart = total === 0 ? 0 : ((page - 1) * limit) + 1;
    const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

    const renderSortHeader = (label: string, key: SortKey, className?: string) => (
        <button
            type="button"
            className={`${styles.sortHeader} ${className || ''} ${sortKey === key ? styles.sortHeaderActive : ''}`}
            onClick={() => handleSort(key)}
            title={`Sort by ${label}`}
        >
            <span>{label}</span>
            <ArrowUpDown size={14} />
        </button>
    );

    if (!canReadInventory) {
        return (
            <div className={setupStyles.container}>
                <div className={styles.emptyState}>
                    <AlertTriangle size={48} />
                    <h3>Inventory Access Restricted</h3>
                    <p>Your current branch role does not allow inventory setup access.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={setupStyles.container}>
            <header className={setupStyles.header}>
                <div className={setupStyles.headerLeft}>
                    <div className={setupStyles.titleRow}>
                        <Package size={22} className={setupStyles.titleIcon} />
                        <div>
                            <h1>Branch Items</h1>
                            <p className={setupStyles.subtitle}>Configure local availability and stock threshold logic for your branch.</p>
                        </div>
                    </div>
                </div>
                <div className={setupStyles.headerRight}>
                    <KitchenButton
                        variant="primary"
                        onClick={() => setShowRequestModal(true)}
                        disabled={!canAdjustInventory}
                        className="hover-glow"
                    >
                        <Plus size={18} /> Request New Master SKU
                    </KitchenButton>
                </div>
            </header>

            <div className={setupStyles.summaryStrip}>
                <div className={`${setupStyles.summaryItem} ${setupStyles.sumIndigo} ${styles.statSummaryCard}`}>
                    <div className={styles.statSummaryIcon} style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                        <PackageSearch size={20} />
                    </div>
                    <div className={styles.statSummaryBody}>
                        <span className={setupStyles.sumValue}>{stats.visible}</span>
                        <span className={setupStyles.sumLabel}>Visible SKUs</span>
                    </div>
                </div>
                <div className={`${setupStyles.summaryItem} ${setupStyles.sumEmerald} ${styles.statSummaryCard}`}>
                    <div className={styles.statSummaryIcon} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div className={styles.statSummaryBody}>
                        <span className={setupStyles.sumValue}>{stats.enabled}</span>
                        <span className={setupStyles.sumLabel}>Active SKUs</span>
                    </div>
                </div>
                <div className={`${setupStyles.summaryItem} ${setupStyles.sumAmber} ${styles.statSummaryCard}`}>
                    <div className={styles.statSummaryIcon} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                        <Info size={20} />
                    </div>
                    <div className={styles.statSummaryBody}>
                        <span className={setupStyles.sumValue}>{stats.disabled}</span>
                        <span className={setupStyles.sumLabel}>Inactive SKUs</span>
                    </div>
                </div>
            </div>

            <div className={setupStyles.formCard}>
                <div className={setupStyles.formHeader}>
                    <h3>Branch Filters</h3>
                </div>
                <div className={`${setupStyles.formBody} ${styles.filterBody}`}>
                    <div className={styles.filterRow}>
                    <div className={styles.filterGroup}>
                        <label><Store size={14} /> Branch</label>
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                            disabled={!canChangeBranch}
                        >
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}
                            {!branches.length && <option value={selectedBranchId}>Current Branch</option>}
                        </select>
                    </div>

                    <div className={styles.filterGroup} style={{ flex: 1.5 }}>
                        <label><Search size={14} /> Item Name</label>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <label><Tag size={14} /> SKU Number</label>
                        <input
                            type="text"
                            placeholder="e.g. SKU-123"
                            value={searchSku}
                            onChange={(e) => setSearchSku(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <label><Layers size={14} /> Class</label>
                        <select value={selectedClass} onChange={(e) => {
                            setSelectedClass(e.target.value);
                            setSelectedCategory('All');
                            setSelectedSubCategory('All');
                        }}>
                            {classifications.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label><Filter size={14} /> Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setSelectedSubCategory('All');
                            }}
                            disabled={selectedClass === 'All'}
                        >
                            {categoriesList.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label><Plus size={14} /> Sub-Category</label>
                        <select
                            value={selectedSubCategory}
                            onChange={(e) => setSelectedSubCategory(e.target.value)}
                            disabled={selectedCategory === 'All'}
                        >
                            {subCategoriesList.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            </div>

            <div className={setupStyles.toolbarRow}>
                <div className={setupStyles.clsFilter}>
                    {tagList.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className={`${setupStyles.clsFilterBtn} ${selectedTag === tag ? setupStyles.clsFilterActive : ''}`}
                            onClick={() => setSelectedTag(tag)}
                        >
                            {tag !== 'All' ? <span className={setupStyles.clsFilterDot} style={{ background: TAG_META[tag as ItemTag].color }}></span> : null}
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className={setupStyles.infoBanner}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            <div className={styles.content}>
                {loading ? (
                    <div className={styles.loadingWrapper}>
                        <div className={styles.loader}></div>
                        <p>Syncing Branch Catalog...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className={styles.emptyState}>
                        <PackageSearch size={48} />
                        <h3>No Master Items Found</h3>
                        <p>Starter catalog data is now provisioned through the supported first-run bootstrap flow.</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Search size={48} />
                        <h3>No matches found</h3>
                        <p>Try adjusting your search filters.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <div className={setupStyles.itemTable}>
                            <div className={styles.itemTableHead}>
                                {renderSortHeader('Code', 'item_sku', styles.gridCell)}
                                {renderSortHeader('Item Name', 'item_name', styles.gridCell)}
                                {renderSortHeader('Other Language', 'item_name_other_language', `${styles.gridCell} ${styles.otherLanguageColumn}`)}
                                {renderSortHeader('Classification', 'classification', styles.gridCell)}
                                {renderSortHeader('Tag', 'item_tag', styles.gridCell)}
                                {renderSortHeader('Category', 'category', styles.gridCell)}
                                {renderSortHeader('Purchase Unit', 'purchase_unit', styles.gridCell)}
                                {renderSortHeader('Issue Unit', 'issue_unit', styles.gridCell)}
                                {renderSortHeader('Flags', 'flags', `${styles.gridCell} ${styles.flagsColumn}`)}
                                {renderSortHeader('Branch', 'branch', styles.gridCell)}
                                {renderSortHeader('Configuration', 'configuration', styles.gridCell)}
                            </div>
                            {filteredItems.map((row) => {
                                const thresholds = localThresholds[row.id] || { min: row.min_level, max: row.max_level };
                                const isDirty = !!localThresholds[row.id];
                                const hasInvalidThresholds = row.is_enabled && (thresholds.min <= 0 || thresholds.max <= 0 || thresholds.max < thresholds.min);
                                const categoryType = row.subType?.inventoryType ?? row.subType?.type;
                                const classification = categoryType?.inventoryClass?.class_name || '-';
                                const categoryPath = [categoryType?.type_name, row.subType?.sub_type_name].filter(Boolean).join(' -> ');
                                const itemTag = normalizeTag(row.item_tag, classification);
                                const tagMeta = TAG_META[itemTag];

                                return (
                                    <div key={row.id} className={styles.itemRow}>
                                        <span className={styles.itemCode}>{row.item_sku || `ITEM-${row.id}`}</span>
                                        <div className={styles.itemNameCell}>
                                            <span className={styles.itemNameText}>{row.item_name}</span>
                                            <span className={styles.itemCategoryText}>{categoryPath || '-'}</span>
                                        </div>
                                        <span className={`${styles.itemMetaCell} ${styles.otherLanguageColumn}`}>{row.item_name_other_language || '-'}</span>
                                        <span className={styles.itemMetaCell}>{classification}</span>
                                        <span className={styles.tagCell}>
                                            <span className={styles.clsBadge} style={{ background: tagMeta.bg, color: tagMeta.color }}>
                                                {itemTag}
                                            </span>
                                        </span>
                                        <span className={styles.itemMetaCell}>{categoryType?.type_name || '-'}</span>
                                        <span className={styles.unitsCell}>{row.uom_purchase || row.uom_base || '-'}</span>
                                        <span className={styles.unitsCell}>{row.uom_base || '-'}</span>
                                        <div className={`${styles.flagStack} ${styles.flagsColumn}`}>
                                            {row.subType?.affects_stock ? <span className={styles.flagMini}>Stock</span> : null}
                                            {row.subType?.affects_recipe ? <span className={styles.flagMini}>Recipe</span> : null}
                                            {row.subType?.depreciable ? <span className={`${styles.flagMini} ${styles.flagMiniWarn}`}>Depr.</span> : null}
                                            {!row.subType?.affects_stock && !row.subType?.affects_recipe && !row.subType?.depreciable ? <span className={`${styles.flagMini} ${styles.flagMiniOff}`}>None</span> : null}
                                        </div>
                                        <div className={styles.branchControl}>
                                            <label className={styles.toggleWrapper}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.toggleInput}
                                                    checked={row.is_enabled}
                                                    onChange={(e) => toggleItem(row.id, e.target.checked)}
                                                    disabled={!canAdjustInventory}
                                                />
                                                <span className={styles.toggleSlider}></span>
                                            </label>
                                        </div>
                                        {row.is_enabled ? (
                                            <div className={`${styles.inlineConfig} ${hasInvalidThresholds ? styles.inlineConfigInvalid : ''}`}>
                                                <div className={styles.inputGroup}>
                                                    <label>Min Qty</label>
                                                    <input
                                                        type="number"
                                                        value={thresholds.min}
                                                        onChange={(e) => handleThresholdChange(row.id, 'min', Number(e.target.value))}
                                                        disabled={!canAdjustInventory}
                                                    />
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <label>Max Qty</label>
                                                    <input
                                                        type="number"
                                                        value={thresholds.max}
                                                        onChange={(e) => handleThresholdChange(row.id, 'max', Number(e.target.value))}
                                                        disabled={!canAdjustInventory}
                                                    />
                                                </div>
                                                {isDirty ? (
                                                    <div className={styles.configActions}>
                                                        <button
                                                            className={styles.saveBtn}
                                                            onClick={() => saveStockLevels(row.id)}
                                                            disabled={!canAdjustInventory || hasInvalidThresholds}
                                                            title="Save Thresholds"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            className={styles.cancelBtn}
                                                            onClick={() => {
                                                                const next = { ...localThresholds };
                                                                delete next[row.id];
                                                                setLocalThresholds(next);
                                                            }}
                                                            title="Discard Changes"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : null}
                                                {hasInvalidThresholds ? <span className={styles.configErrorText}>Enter valid Min and Max Qty.</span> : null}
                                            </div>
                                        ) : (
                                            <span className={styles.disabledText}>Enable item to configure thresholds</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.pagination}>
                            <div className={styles.pageSummary}>
                                <span className={styles.pageInfo}>Showing {pageStart}-{pageEnd} of {total} items</span>
                                <div className={styles.pageSizeWrap}>
                                    <label htmlFor="branch-items-page-size" className={styles.pageSizeLabel}>Rows</label>
                                    <select
                                        id="branch-items-page-size"
                                        className={styles.pageSizeSelect}
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.pageActions}>
                                <button
                                    disabled={page === 1 || loading}
                                    onClick={() => setPage((value) => value - 1)}
                                    className={styles.pageBtn}
                                >
                                    Previous
                                </button>
                                <span className={styles.pageInfo}>
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    disabled={page === totalPages || loading}
                                    onClick={() => setPage((value) => value + 1)}
                                    className={styles.pageBtn}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showRequestModal && canAdjustInventory && (
                <ItemRequestForm
                    branchId={Number(selectedBranchId)}
                    branchName={branches.find((branch) => String(branch.id) === selectedBranchId)?.branch_name || 'Current Branch'}
                    onClose={() => {
                        setShowRequestModal(false);
                        void fetchItems(selectedBranchId);
                    }}
                />
            )}
        </div>
    );
}

function ItemRequestForm({ onClose, branchId, branchName }: { onClose: () => void; branchId: number; branchName: string }) {
    const [submitting, setSubmitting] = useState(false);
    const userContext = JSON.parse(readAuthSessionItem('user_context') || '{}');

    const [formData, setFormData] = useState({
        item_name: '',
        item_number: '',
        uom_base: '',
        uom_purchase: '',
        reason: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await fetch(apiUrl('/inventory/requests'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${readAuthSessionItem('access_token')}`,
                },
                body: JSON.stringify({
                    ...formData,
                    branch_id: branchId,
                }),
            });
            if (!response.ok) throw new Error('Submission failed');
            onClose();
        } catch (err) {
            console.error('Request failed', err);
            alert('Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <form className={styles.modal} onSubmit={handleSubmit}>
                <div className={styles.modalHeader}>
                    <h3>Master Entry Request</h3>
                    <p>Request to add a new SKU to the global catalog.</p>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.contextRow}>
                        <div className={styles.contextBadge}>
                            <label>Originating Branch</label>
                            <span>{branchName}</span>
                        </div>
                        <div className={styles.contextBadge}>
                            <label>Client ID</label>
                            <span>#{userContext.clientId || 'Global'}</span>
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                            <label>Item Name</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    required
                                    placeholder="e.g. Signature Truffle Oil"
                                    value={formData.item_name}
                                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Item Number / SKU</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    placeholder="e.g. KC-OIL-001"
                                    value={formData.item_number}
                                    onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
                                />
                            </div>
                            <small>Internal code for tracking.</small>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Base UoM</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    required
                                    placeholder="e.g. KG / LTR"
                                    value={formData.uom_base}
                                    onChange={(e) => setFormData({ ...formData, uom_base: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Order UoM</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    placeholder="e.g. Case of 12"
                                    value={formData.uom_purchase}
                                    onChange={(e) => setFormData({ ...formData, uom_purchase: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                            <label>Justification</label>
                            <div className={styles.inputWrapper}>
                                <textarea
                                    rows={3}
                                    placeholder="Explain the requirement for the Kitchen Club catalog..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <KitchenButton variant="outline" type="button" onClick={onClose}>Cancel</KitchenButton>
                    <KitchenButton variant="primary" type="submit" disabled={submitting}>
                        {submitting ? 'Processing...' : 'Submit Request'}
                    </KitchenButton>
                </div>
            </form>
        </div>
    );
}
