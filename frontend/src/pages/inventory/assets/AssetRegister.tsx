/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Banknote,
    Boxes,
    Building2,
    CalendarDays,
    ClipboardList,
    Edit2,
    Layers3,
    MapPin,
    Package,
    Plus,
    Save,
    Search,
    ShieldCheck,
    TimerReset,
    X,
} from 'lucide-react';
import styles from './AssetRegister.module.css';
import { accountingApi, inventoryApi } from '../../../api/api';
import { useBranchContext } from '../../../hooks/useBranchContext';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';

type AssetCandidate = {
    id: number;
    label: string;
    name: string;
    code: string;
    classification: string;
    category: string;
    subCategory: string;
    unit: string;
};

const PURCHASE_CONDITIONS = [
    { value: 'new', label: 'New' },
    { value: 'open_box', label: 'Open Box' },
    { value: 'used_excellent', label: 'Used - Excellent' },
    { value: 'used_good', label: 'Used - Good' },
    { value: 'used_working', label: 'Used - Working' },
    { value: 'used_fair', label: 'Used - Fair' },
    { value: 'used_poor', label: 'Used - Poor' },
    { value: 'refurbished', label: 'Refurbished' },
] as const;

type AssetItem = {
    id: number;
    asset_item_no: string;
    inventory_item_id: number | null;
    inventory_item_name: string | null;
    inventory_item_sku: string | null;
    classification: string | null;
    name: string;
    brand: string | null;
    category: string;
    sub_category: string | null;
    base_unit: string | null;
    useful_life_months: number;
    salvage_value: number;
    notes: string | null;
    units: AssetUnit[];
};

type AssetUnit = {
    id: number;
    asset_item_id: number;
    tag_no: string;
    serial_no: string | null;
    model: string | null;
    manufacturer: string | null;
    description: string | null;
    purchase_price: number;
    annual_depreciation_rate: number | null;
    purchase_condition: string;
    capitalization_date: string;
    invoice_no: string | null;
    purchase_order_no: string | null;
    supplier_name: string | null;
    capitalization_mode: string;
    treasury_account_id: number | null;
    treasury_account_name: string | null;
    branch_id: number;
    branch_name: string | null;
    physical_location: string | null;
    issued_to: string | null;
    custodian_id: string | null;
    condition: string;
    operational_status: string;
    warranty_expiry: string | null;
    insurance_expiry: string | null;
    comments: string | null;
    depreciation_schedule: {
        useful_life_months: number;
        salvage_value: number;
        monthly_depreciation: number;
        accumulated_depreciation: number;
        book_value: number;
    };
};

type Branch = { id: number; branch_name?: string; name?: string };
type Account = {
    id: number;
    account_code?: string;
    account_name: string;
    is_cash_account?: boolean;
    is_bank_account?: boolean;
    scope?: string;
    branch_id?: number | null;
    children?: Account[];
};

type ItemDraft = {
    inventory_item_id: string;
    inventory_item_search: string;
};

type UnitDraft = {
    tag_no: string;
    serial_no: string;
    model: string;
    manufacturer: string;
    description: string;
    branch_id: string;
    purchase_price: string;
    annual_depreciation_rate: string;
    purchase_condition: string;
    capitalization_date: string;
    capitalization_mode: string;
    treasury_account_id: string;
    purchase_order_no: string;
    invoice_no: string;
    supplier_name: string;
    physical_location: string;
    condition: string;
    warranty_expiry: string;
    insurance_expiry: string;
    comments: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyItemDraft: ItemDraft = {
    inventory_item_id: '',
    inventory_item_search: '',
};

const emptyUnitDraft: UnitDraft = {
    tag_no: 'Auto-generated on save',
    serial_no: '',
    model: '',
    manufacturer: '',
    description: '',
    branch_id: '',
    purchase_price: '',
    annual_depreciation_rate: '',
    purchase_condition: 'new',
    capitalization_date: today,
    capitalization_mode: 'credit_purchase',
    treasury_account_id: '',
    purchase_order_no: '',
    invoice_no: '',
    supplier_name: '',
    physical_location: '',
    condition: 'working',
    warranty_expiry: '',
    insurance_expiry: '',
    comments: '',
};

function formatMoney(value?: number | null) {
    return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

function formatLabel(value?: string | null) {
    if (!value) return '-';
    return value
        .replaceAll('_', ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function flattenAssetCandidates(hierarchy: any[]): AssetCandidate[] {
    return hierarchy.flatMap((cls) =>
        (cls.types || []).flatMap((type: any) =>
            (type.subTypes || []).flatMap((subType: any) =>
                (subType.items || [])
                    .filter((item: any) => item.item_tag === 'Asset')
                    .map((item: any) => ({
                        id: Number(item.id),
                        label: `${item.item_name} (${item.item_sku || `ITEM-${item.id}`})`,
                        name: item.item_name,
                        code: item.item_sku || `ITEM-${item.id}`,
                        classification: cls.class_name || '-',
                        category: type.type_name || '-',
                        subCategory: subType.sub_type_name || '-',
                        unit: item.uom_base || '-',
                    })),
            ),
        ),
    );
}

function flattenAccounts(accounts: Account[]): Account[] {
    return accounts.flatMap((account) => [
        account,
        ...(account.children ? flattenAccounts(account.children) : []),
    ]);
}

export function AssetRegister() {
    const navigate = useNavigate();
    const { branches: allowedBranches } = useBranchContext();
    const { canViewAssets, canManageAssets } = usePermissionAccess();
    const [items, setItems] = useState<AssetItem[]>([]);
    const [assetCandidates, setAssetCandidates] = useState<AssetCandidate[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [search, setSearch] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
    const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItemDraft);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [unitDraft, setUnitDraft] = useState<UnitDraft>(emptyUnitDraft);
    const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
    const [showUnitForm, setShowUnitForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const branchOptions = useMemo<Branch[]>(
        () => allowedBranches.map((branch) => ({
            id: Number(branch.branch_id ?? branch.id ?? 0),
            branch_name: branch.branch_name || (branch.id ? `Branch ${branch.id}` : undefined),
        })).filter((branch) => Number.isFinite(branch.id) && branch.id > 0),
        [allowedBranches],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [assetData, accountData, hierarchyData] = await Promise.all([
                accountingApi.getFixedAssetRegister(),
                canManageAssets ? accountingApi.getAccounts() : Promise.resolve([]),
                inventoryApi.getHierarchy(),
            ]);
            setItems(assetData.items ?? []);
            setSummary(assetData.summary ?? null);
            setAccounts(accountData ?? []);
            setAssetCandidates(flattenAssetCandidates(hierarchyData ?? []));
            setSelectedItemId((current) => current ?? assetData.items?.[0]?.id ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load fixed assets.');
        } finally {
            setLoading(false);
        }
    }, [canManageAssets]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) =>
            `${item.asset_item_no} ${item.name} ${item.brand ?? ''} ${item.category} ${item.sub_category ?? ''}`
                .toLowerCase()
                .includes(q),
        );
    }, [items, search]);

    const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null;
    const selectedUnits = selectedItem?.units ?? [];
    const selectedGrossCost = selectedUnits.reduce((total, unit) => total + Number(unit.purchase_price ?? 0), 0);
    const selectedBookValue = selectedUnits.reduce((total, unit) => total + Number(unit.depreciation_schedule?.book_value ?? 0), 0);
    const selectedServiceUnits = selectedUnits.filter((unit) => unit.condition === 'service_required').length;
    const selectedDamagedUnits = selectedUnits.filter((unit) => unit.condition === 'damaged').length;
    const selectedAssignedUnits = selectedUnits.filter((unit) => unit.issued_to || unit.custodian_id).length;
    const treasuryAccounts = useMemo(
        () => flattenAccounts(accounts).filter((account) => account.is_cash_account || account.is_bank_account),
        [accounts],
    );
    const selectedCandidate = useMemo(
        () => assetCandidates.find((candidate) => candidate.id === Number(itemDraft.inventory_item_id || 0)) ?? null,
        [assetCandidates, itemDraft.inventory_item_id],
    );

    function beginEditItem(item: AssetItem) {
        if (!canManageAssets) {
            setError('You do not have permission to edit asset items.');
            return;
        }
        setEditingItemId(item.id);
        setItemDraft({
            inventory_item_id: item.inventory_item_id ? String(item.inventory_item_id) : '',
            inventory_item_search: item.inventory_item_name && item.inventory_item_sku
                ? `${item.inventory_item_name} (${item.inventory_item_sku})`
                : item.name,
        });
    }

    function resetItemForm() {
        setEditingItemId(null);
        setItemDraft(emptyItemDraft);
    }

    function beginAddUnit() {
        if (!canManageAssets) {
            setError('You do not have permission to add asset units.');
            return;
        }
        setEditingUnitId(null);
        setUnitDraft(emptyUnitDraft);
        setShowUnitForm(true);
    }

    function beginEditUnit(unit: AssetUnit) {
        if (!canManageAssets) {
            setError('You do not have permission to edit asset units.');
            return;
        }
        setEditingUnitId(unit.id);
        setUnitDraft({
            tag_no: unit.tag_no,
            serial_no: unit.serial_no ?? '',
            model: unit.model ?? '',
            manufacturer: unit.manufacturer ?? '',
            description: unit.description ?? '',
            branch_id: String(unit.branch_id),
            purchase_price: String(unit.purchase_price),
            annual_depreciation_rate: unit.annual_depreciation_rate != null ? String(unit.annual_depreciation_rate) : '',
            purchase_condition: unit.purchase_condition,
            capitalization_date: unit.capitalization_date,
            capitalization_mode: unit.capitalization_mode,
            treasury_account_id: unit.treasury_account_id ? String(unit.treasury_account_id) : '',
            purchase_order_no: unit.purchase_order_no ?? '',
            invoice_no: unit.invoice_no ?? '',
            supplier_name: unit.supplier_name ?? '',
            physical_location: unit.physical_location ?? '',
            condition: unit.condition,
            warranty_expiry: unit.warranty_expiry ?? '',
            insurance_expiry: unit.insurance_expiry ?? '',
            comments: unit.comments ?? '',
        });
        setShowUnitForm(true);
    }

    function resetUnitForm() {
        setEditingUnitId(null);
        setUnitDraft(emptyUnitDraft);
        setShowUnitForm(false);
    }

    async function saveItem() {
        if (!canManageAssets) {
            setError('You do not have permission to save asset items.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const payload = {
                inventory_item_id: itemDraft.inventory_item_id ? Number(itemDraft.inventory_item_id) : undefined,
                name: selectedCandidate?.name || '',
                category: selectedCandidate?.category || '',
                sub_category: selectedCandidate?.subCategory || undefined,
                useful_life_months: 36,
                salvage_value: 0,
            };
            if (editingItemId) {
                await accountingApi.updateFixedAssetItem(editingItemId, payload);
            } else {
                await accountingApi.createFixedAssetItem(payload);
            }
            resetItemForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save asset item.');
        } finally {
            setSaving(false);
        }
    }

    async function saveUnit() {
        if (!selectedItem) return;
        if (!canManageAssets) {
            setError('You do not have permission to save asset units.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const payload = {
                asset_item_id: selectedItem.id,
                branch_id: Number(unitDraft.branch_id),
                tag_no: editingUnitId ? unitDraft.tag_no : undefined,
                serial_no: unitDraft.serial_no || undefined,
                model: unitDraft.model || undefined,
                manufacturer: unitDraft.manufacturer || undefined,
                description: unitDraft.description || undefined,
                purchase_price: Number(unitDraft.purchase_price || 0),
                annual_depreciation_rate: unitDraft.annual_depreciation_rate ? Number(unitDraft.annual_depreciation_rate) : undefined,
                purchase_condition: unitDraft.purchase_condition,
                capitalization_date: unitDraft.capitalization_date,
                capitalization_mode: unitDraft.capitalization_mode,
                treasury_account_id: unitDraft.treasury_account_id ? Number(unitDraft.treasury_account_id) : undefined,
                purchase_order_no: unitDraft.purchase_order_no || undefined,
                invoice_no: unitDraft.invoice_no || undefined,
                supplier_name: unitDraft.supplier_name || undefined,
                physical_location: unitDraft.physical_location || undefined,
                condition: unitDraft.condition,
                warranty_expiry: unitDraft.warranty_expiry || undefined,
                insurance_expiry: unitDraft.insurance_expiry || undefined,
                comments: unitDraft.comments || undefined,
            };
            if (editingUnitId) {
                await accountingApi.updateFixedAssetUnit(editingUnitId, payload);
            } else {
                await accountingApi.createFixedAssetUnit(payload);
            }
            resetUnitForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save asset unit.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <button className={styles.btnIcon} onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={18} /></button>
                    <div className={styles.titleIcon}>
                        <Package size={26} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Asset Register</h1>
                        <p className={styles.pageSubtitle}>Fixed asset master, capitalization, custody, and depreciation schedule.</p>
                    </div>
                </div>
                <div className={styles.headerSummary}>
                    <span>{filteredItems.length} visible items</span>
                    <strong>{summary?.unit_count ?? 0} units</strong>
                </div>
            </div>

            {error && (
                <div className={styles.modalComment} style={{ marginBottom: 16, color: '#b91c1c' }}>
                    {error}
                </div>
            )}

            {!canViewAssets && (
                <div className={styles.modalComment} style={{ marginBottom: 16 }}>
                    You do not have permission to access the asset register.
                </div>
            )}

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon}><ClipboardList size={22} /></div>
                    <div>
                        <div className={styles.kpiValue}>{summary?.item_count ?? 0}</div>
                        <div className={styles.kpiLabel}>Asset Items</div>
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon}><Boxes size={22} /></div>
                    <div>
                        <div className={styles.kpiValue}>{summary?.unit_count ?? 0}</div>
                        <div className={styles.kpiLabel}>Asset Units</div>
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon}><Banknote size={22} /></div>
                    <div>
                        <div className={styles.kpiValue}>{formatMoney(summary?.gross_cost)}</div>
                        <div className={styles.kpiLabel}>Gross Cost</div>
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon}><Layers3 size={22} /></div>
                    <div>
                        <div className={styles.kpiValue}>{formatMoney(summary?.net_book_value)}</div>
                        <div className={styles.kpiLabel}>Net Book Value</div>
                    </div>
                </div>
            </div>

            <div className={styles.addItemForm}>
                <div className={styles.addItemTitle}>
                    <span>{editingItemId ? 'Edit Asset Item' : 'New Asset Item'}</span>
                    {editingItemId && (
                        <button className={styles.cancelBtn} onClick={resetItemForm} aria-label="Cancel item edit">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className={styles.assetCatalogFormGrid}>
                    <div className={styles.fieldGroup}>
                        <label>Master Item</label>
                        <input
                            className={styles.input}
                            list="asset-master-item-options"
                            value={itemDraft.inventory_item_search}
                            onChange={(e) => {
                                const nextSearch = e.target.value;
                                const nextCandidate = assetCandidates.find((candidate) => candidate.label === nextSearch);
                                setItemDraft((prev) => ({
                                    ...prev,
                                    inventory_item_search: nextSearch,
                                    inventory_item_id: nextCandidate ? String(nextCandidate.id) : '',
                                }));
                            }}
                            placeholder="Type to search master item"
                        />
                        <datalist id="asset-master-item-options">
                            {assetCandidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.label} />
                            ))}
                        </datalist>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Category</label>
                        <input className={styles.input} value={selectedCandidate?.category || ''} disabled />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Sub-Category</label>
                        <input className={styles.input} value={selectedCandidate?.subCategory || ''} disabled />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Classification</label>
                        <input className={styles.input} value={selectedCandidate?.classification || selectedItem?.classification || ''} disabled />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label>Base Unit</label>
                        <input className={styles.input} value={selectedCandidate?.unit || selectedItem?.base_unit || ''} disabled />
                    </div>
                    <div className={styles.assetCatalogFormActions}>
                        <button className={styles.btnPrimary} onClick={() => void saveItem()} disabled={!canManageAssets || saving || !itemDraft.inventory_item_id}>
                            <Save size={16} /> {editingItemId ? 'Update Item' : 'Save Item'}
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.singleLayout}>
                <div className={styles.assetSelectorBar}>
                    <div className={styles.searchWrap}>
                        <Search size={18} />
                        <input
                            className={styles.searchInput}
                            placeholder="Search asset item..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className={styles.select}
                        value={selectedItem?.id ? String(selectedItem.id) : ''}
                        onChange={(e) => setSelectedItemId(Number(e.target.value) || null)}
                    >
                        <option value="">Select asset item</option>
                        {filteredItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.asset_item_no} - {item.name}
                            </option>
                        ))}
                    </select>
                    {selectedItem && (
                        <button className={styles.btnSecondary} onClick={() => beginEditItem(selectedItem)} disabled={!canManageAssets}>
                            <Edit2 size={16} /> Edit Item
                        </button>
                    )}
                </div>

                <div className={styles.rightPanel}>
                    {selectedItem ? (
                        <>
                            <div className={styles.assetHero}>
                                    <div>
                                        <div className={styles.assetHeroTopline}>
                                            <span>{selectedItem.asset_item_no}</span>
                                            <span>{selectedItem.classification ?? '-'} / {selectedItem.category}{selectedItem.sub_category ? ` / ${selectedItem.sub_category}` : ''}</span>
                                        </div>
                                        <h2>{selectedItem.name}</h2>
                                        <p>
                                            {selectedItem.inventory_item_sku ? `${selectedItem.inventory_item_sku} / ` : ''}
                                            {selectedItem.base_unit || '-'}
                                        </p>
                                    </div>
                                <button className={styles.btnPrimary} onClick={beginAddUnit} disabled={!canManageAssets}>
                                    <Plus size={16} /> Add Unit
                                </button>
                            </div>

                            <div className={styles.assetStatsGrid}>
                                <div className={styles.assetStat}>
                                    <Building2 size={19} />
                                    <div>
                                        <span>Total units</span>
                                        <strong>{selectedUnits.length}</strong>
                                    </div>
                                </div>
                                <div className={styles.assetStat}>
                                    <MapPin size={19} />
                                    <div>
                                        <span>Assigned</span>
                                        <strong>{selectedAssignedUnits}</strong>
                                    </div>
                                </div>
                                <div className={styles.assetStat}>
                                    <Banknote size={19} />
                                    <div>
                                        <span>Gross cost</span>
                                        <strong>{formatMoney(selectedGrossCost)}</strong>
                                    </div>
                                </div>
                                <div className={styles.assetStat}>
                                    <Layers3 size={19} />
                                    <div>
                                        <span>Book value</span>
                                        <strong>{formatMoney(selectedBookValue)}</strong>
                                    </div>
                                </div>
                                <div className={styles.assetStat}>
                                    <TimerReset size={19} />
                                    <div>
                                        <span>Service due</span>
                                        <strong>{selectedServiceUnits}</strong>
                                    </div>
                                </div>
                                <div className={styles.assetStat}>
                                    <ShieldCheck size={19} />
                                    <div>
                                        <span>Damaged</span>
                                        <strong>{selectedDamagedUnits}</strong>
                                    </div>
                                </div>
                            </div>

                            {showUnitForm && (
                                <div className={styles.unitFormCard}>
                                    <div className={styles.unitFormTitle}>
                                        <span>{editingUnitId ? 'Edit Asset Unit' : 'Add Asset Unit'}</span>
                                        <button className={styles.cancelBtn} onClick={resetUnitForm} aria-label="Close unit form"><X size={16} /></button>
                                    </div>
                                    <div className={styles.unitFormGrid}>
                                        <div className={styles.fieldGroup}>
                                            <label>Asset Number</label>
                                            <input className={styles.input} value={editingUnitId ? unitDraft.tag_no : 'Auto-generated on save'} onChange={(e) => setUnitDraft((prev) => ({ ...prev, tag_no: e.target.value }))} disabled={!editingUnitId} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Serial No.</label>
                                            <input className={styles.input} value={unitDraft.serial_no} onChange={(e) => setUnitDraft((prev) => ({ ...prev, serial_no: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Model</label>
                                            <input className={styles.input} value={unitDraft.model} onChange={(e) => setUnitDraft((prev) => ({ ...prev, model: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Manufacturer</label>
                                            <input className={styles.input} value={unitDraft.manufacturer} onChange={(e) => setUnitDraft((prev) => ({ ...prev, manufacturer: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Branch</label>
                                            <select className={styles.select} value={unitDraft.branch_id} onChange={(e) => setUnitDraft((prev) => ({ ...prev, branch_id: e.target.value }))}>
                                                <option value="">Select branch</option>
                                                {branchOptions.map((branch) => (
                                                    <option key={branch.id} value={branch.id}>
                                                        {branch.branch_name ?? branch.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Purchase Price</label>
                                            <input className={styles.input} type="number" value={unitDraft.purchase_price} onChange={(e) => setUnitDraft((prev) => ({ ...prev, purchase_price: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Annual Depreciation %</label>
                                            <input className={styles.input} type="number" min="0" step="0.01" value={unitDraft.annual_depreciation_rate} onChange={(e) => setUnitDraft((prev) => ({ ...prev, annual_depreciation_rate: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Purchase Date</label>
                                            <input className={styles.input} type="date" value={unitDraft.capitalization_date} onChange={(e) => setUnitDraft((prev) => ({ ...prev, capitalization_date: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Payment Mode</label>
                                            <select className={styles.select} value={unitDraft.capitalization_mode} onChange={(e) => setUnitDraft((prev) => ({ ...prev, capitalization_mode: e.target.value, treasury_account_id: '' }))}>
                                                <option value="credit_purchase">Credit Purchase</option>
                                                <option value="cash">Cash</option>
                                                <option value="bank">Bank</option>
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Purchase Condition</label>
                                            <select className={styles.select} value={unitDraft.purchase_condition} onChange={(e) => setUnitDraft((prev) => ({ ...prev, purchase_condition: e.target.value }))}>
                                                {PURCHASE_CONDITIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Treasury Account</label>
                                            <select
                                                className={styles.select}
                                                value={unitDraft.treasury_account_id}
                                                onChange={(e) => setUnitDraft((prev) => ({ ...prev, treasury_account_id: e.target.value }))}
                                                disabled={unitDraft.capitalization_mode === 'credit_purchase'}
                                            >
                                                <option value="">Select treasury account</option>
                                                {treasuryAccounts
                                                    .filter((account) => unitDraft.capitalization_mode === 'cash' ? account.is_cash_account : unitDraft.capitalization_mode === 'bank' ? account.is_bank_account : true)
                                                    .map((account) => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.account_code ? `${account.account_code} - ${account.account_name}` : account.account_name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>PO No.</label>
                                            <input className={styles.input} value={unitDraft.purchase_order_no} onChange={(e) => setUnitDraft((prev) => ({ ...prev, purchase_order_no: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Invoice No.</label>
                                            <input className={styles.input} value={unitDraft.invoice_no} onChange={(e) => setUnitDraft((prev) => ({ ...prev, invoice_no: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Supplier</label>
                                            <input className={styles.input} value={unitDraft.supplier_name} onChange={(e) => setUnitDraft((prev) => ({ ...prev, supplier_name: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Location</label>
                                            <input className={styles.input} value={unitDraft.physical_location} onChange={(e) => setUnitDraft((prev) => ({ ...prev, physical_location: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Condition</label>
                                            <select className={styles.select} value={unitDraft.condition} onChange={(e) => setUnitDraft((prev) => ({ ...prev, condition: e.target.value }))}>
                                                <option value="working">Working</option>
                                                <option value="service_required">Service Required</option>
                                                <option value="damaged">Damaged</option>
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Warranty Expiry</label>
                                            <input className={styles.input} type="date" value={unitDraft.warranty_expiry} onChange={(e) => setUnitDraft((prev) => ({ ...prev, warranty_expiry: e.target.value }))} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Insurance Expiry</label>
                                            <input className={styles.input} type="date" value={unitDraft.insurance_expiry} onChange={(e) => setUnitDraft((prev) => ({ ...prev, insurance_expiry: e.target.value }))} />
                                        </div>
                                        <div className={`${styles.fieldGroup} ${styles.spanFull}`}>
                                            <label>Description</label>
                                            <textarea className={styles.textarea} rows={2} value={unitDraft.description} onChange={(e) => setUnitDraft((prev) => ({ ...prev, description: e.target.value }))} />
                                        </div>
                                        <div className={`${styles.fieldGroup} ${styles.spanFull}`}>
                                            <label>Comments</label>
                                            <textarea className={styles.textarea} rows={2} value={unitDraft.comments} onChange={(e) => setUnitDraft((prev) => ({ ...prev, comments: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className={styles.unitFormActions}>
                                        <button className={styles.btnSecondary} onClick={resetUnitForm}>Cancel</button>
                                        <button className={styles.btnPrimary} onClick={() => void saveUnit()} disabled={!canManageAssets || saving || !unitDraft.branch_id || !unitDraft.purchase_price}>
                                            <Save size={16} /> {editingUnitId ? 'Update Unit' : 'Save Unit'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className={styles.tableTitleRow}>
                                <div>
                                    <h3>Registered units</h3>
                                    <p>{selectedUnits.length} units under this asset item</p>
                                </div>
                            </div>

                            <div className={styles.tableWrap}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Tag</th>
                                            <th>Manufacturer / Model</th>
                                            <th>Branch / Location</th>
                                            <th>Status</th>
                                            <th>Cost</th>
                                            <th>Dep. %</th>
                                            <th>Accum. Dep.</th>
                                            <th>Book Value</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedUnits.length === 0 ? (
                                            <tr><td colSpan={9}>No units registered yet.</td></tr>
                                        ) : selectedUnits.map((unit) => (
                                            <tr key={unit.id}>
                                                <td>
                                                    <div><strong>{unit.tag_no}</strong></div>
                                                    <div className={styles.tableMeta}>{unit.serial_no ?? '-'}</div>
                                                </td>
                                                <td>
                                                    <div>{unit.manufacturer ?? '-'}</div>
                                                    <div className={styles.tableMeta}>{unit.model ?? '-'}</div>
                                                </td>
                                                <td>
                                                    <div>{unit.branch_name ?? '-'}</div>
                                                    <div className={styles.tableMeta}>{unit.physical_location ?? '-'}</div>
                                                </td>
                                                <td>
                                                    <div className={styles.statusPill}>{formatLabel(unit.operational_status)}</div>
                                                    <div className={styles.tableMeta}>{formatLabel(unit.condition)}</div>
                                                </td>
                                                <td>{formatMoney(unit.purchase_price)}</td>
                                                <td>{unit.annual_depreciation_rate != null ? `${unit.annual_depreciation_rate}%` : '-'}</td>
                                                <td>{formatMoney(unit.depreciation_schedule.accumulated_depreciation)}</td>
                                                <td>{formatMoney(unit.depreciation_schedule.book_value)}</td>
                                                <td>
                                                    <button className={styles.iconBtn} onClick={() => beginEditUnit(unit)} aria-label={`Edit ${unit.tag_no}`}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyState}>
                            <CalendarDays size={32} />
                            <strong>Select an asset item to review its units.</strong>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
