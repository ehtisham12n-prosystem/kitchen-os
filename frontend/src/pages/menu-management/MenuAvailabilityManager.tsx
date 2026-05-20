/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Search,
    Store,
    ChevronDown,
    Filter,
    RotateCcw,
    X,
    CheckSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { catalogApi, resolveActiveBranchId, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './MenuAvailabilityManager.module.css';

interface MenuItem {
    id: string;
    product_id: number;
    name: string;
    category: string;
    price: number;
    menu_type_id: number | null;
    menu_type_name: string | null;
    master_active: boolean;
    branch_enabled: boolean;
    channel_availability: {
        dine_in: boolean;
        takeout: boolean;
        delivery: boolean;
    };
    menu_assignment_source: 'branch_override' | 'master' | 'unassigned';
    price_source: 'branch_menu_price' | 'branch_customization_price' | 'branch_base_override' | 'master_base_price';
    effective_branch_enabled: boolean;
    is_temporarily_disabled: boolean;
    temporarily_disabled_until: string | null;
    temporary_disable_reason: string | null;
}

function BranchToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            className={`${styles.toggle} ${value ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => onChange(!value)}
            aria-label={value ? 'Disable at branch' : 'Enable at branch'}
        >
            <span className={styles.toggleKnob} />
        </button>
    );
}

function toDateTimeLocal(value?: string | null) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = (input: number) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MenuAvailabilityManager() {
    const navigate = useNavigate();
    const [items, setItems] = useState<MenuItem[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [menuTypes, setMenuTypes] = useState<any[]>([]);
    const [branch, setBranch] = useState('');
    const [menu, setMenu] = useState('');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [isWorking, setIsWorking] = useState(false);
    const [temporaryDisableUntil, setTemporaryDisableUntil] = useState<Record<number, string>>({});
    const [temporaryDisableReason, setTemporaryDisableReason] = useState<Record<number, string>>({});

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [branchItems, menuTypeItems] = await Promise.all([
                    setupApi.getBranches(),
                    catalogApi.getMenuTypes(),
                ]);
                setBranches(branchItems);
                setMenuTypes(menuTypeItems);
                setBranch(resolveActiveBranchId() || String(branchItems[0]?.id || ''));
                setMenu(String(menuTypeItems[0]?.id || ''));
            } catch (error) {
                console.error('Failed to load menu governance lookups', error);
                toast.error('Menu Governance', 'Could not load branch or menu lookups.');
            }
        };

        void loadLookups();
    }, []);

    const fetchBranchMenu = useCallback(async () => {
        if (!branch) {
            return;
        }

        try {
            const response = await catalogApi.getBranchProducts(Number(branch));
            const nextItems: MenuItem[] = (response || []).map((product: any) => ({
                id: String(product.id),
                product_id: product.id,
                name: product.product_name,
                category: product.category?.category_name || 'Uncategorized',
                price: Number(product.effective_price ?? product.product_base_price ?? 0),
                menu_type_id: product.effective_price_profile_id || null,
                menu_type_name: product.effective_price_profile_name || null,
                master_active: !!product.is_active,
                branch_enabled: !!product.is_enabled,
                effective_branch_enabled: !!product.effective_enabled,
                channel_availability: product.channel_availability || {
                    dine_in: true,
                    takeout: true,
                    delivery: true,
                },
                menu_assignment_source: product.menu_assignment_source || 'unassigned',
                price_source: product.price_source || 'master_base_price',
                is_temporarily_disabled: !!product.is_temporarily_disabled,
                temporarily_disabled_until: product.temporarily_disabled_until || null,
                temporary_disable_reason: product.temporary_disable_reason || null,
            }));
            setItems(nextItems);
            setTemporaryDisableUntil(
                Object.fromEntries(nextItems.map((item) => [item.product_id, toDateTimeLocal(item.temporarily_disabled_until)])),
            );
            setTemporaryDisableReason(
                Object.fromEntries(nextItems.map((item) => [item.product_id, item.temporary_disable_reason || ''])),
            );
        } catch (error) {
            console.error('Failed to load menu governance data', error);
            toast.error('Menu Governance', 'Could not load branch menu composition.');
        }
    }, [branch]);

    useEffect(() => {
        void fetchBranchMenu();
    }, [fetchBranchMenu]);

    const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.category)))], [items]);

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        return items.filter((item) =>
            (!menu || String(item.menu_type_id || '') === menu) &&
            (categoryFilter === 'All' || item.category === categoryFilter) &&
            (item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
        );
    }, [items, menu, categoryFilter, search]);

    const grouped = useMemo(() => {
        const map: Record<string, MenuItem[]> = {};
        filtered.forEach((item) => {
            if (!map[item.category]) {
                map[item.category] = [];
            }
            map[item.category].push(item);
        });
        return map;
    }, [filtered]);

    const bulkValue = useMemo(() => {
        if (filtered.length === 0) {
            return false;
        }
        const allOn = filtered.every((item) => item.branch_enabled);
        const allOff = filtered.every((item) => !item.branch_enabled);
        if (allOn) {
            return true;
        }
        if (allOff) {
            return false;
        }
        return 'mixed';
    }, [filtered]);

    const updateItem = useCallback(async (productId: number, enabled: boolean) => {
        if (!branch) {
            return;
        }

        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(branch),
                product_id: productId,
                is_enabled: enabled,
            });
            setItems((prev) => prev.map((item) => item.product_id === productId ? {
                ...item,
                branch_enabled: enabled,
                effective_branch_enabled: enabled && item.master_active && !item.is_temporarily_disabled,
            } : item));
        } catch (error: any) {
            console.error('Failed to update branch menu item', error);
            toast.error('Menu Governance', error.message || 'Could not update branch menu availability.');
        }
    }, [branch]);

    const updateChannel = useCallback(async (
        item: MenuItem,
        channel: 'dine_in' | 'takeout' | 'delivery',
        value: boolean,
    ) => {
        if (!branch) {
            return;
        }

        const nextAvailability = {
            ...item.channel_availability,
            [channel]: value,
        };

        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(branch),
                product_id: item.product_id,
                is_enabled: item.branch_enabled,
                channel_availability: nextAvailability,
            });
            setItems((prev) => prev.map((candidate) => candidate.product_id === item.product_id
                ? { ...candidate, channel_availability: nextAvailability }
                : candidate));
        } catch (error: any) {
            console.error('Failed to update order channel availability', error);
            toast.error('Menu Governance', error.message || 'Could not update order channel visibility.');
        }
    }, [branch]);

    const saveTemporaryDisable = useCallback(async (item: MenuItem, clear: boolean = false) => {
        if (!branch) {
            return;
        }

        const nextUntil = clear ? '' : (temporaryDisableUntil[item.product_id] || '');
        const nextReason = clear ? '' : (temporaryDisableReason[item.product_id] || '');

        setIsWorking(true);
        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(branch),
                product_id: item.product_id,
                is_enabled: item.branch_enabled,
                temporarily_disabled_until: nextUntil || null,
                temporary_disable_reason: nextUntil ? (nextReason.trim() || null) : null,
            });

            setTemporaryDisableUntil((prev) => ({
                ...prev,
                [item.product_id]: nextUntil,
            }));
            setTemporaryDisableReason((prev) => ({
                ...prev,
                [item.product_id]: nextReason,
            }));
            setItems((prev) => prev.map((candidate) => candidate.product_id === item.product_id ? {
                ...candidate,
                is_temporarily_disabled: !!nextUntil,
                temporarily_disabled_until: nextUntil || null,
                temporary_disable_reason: nextUntil ? (nextReason.trim() || null) : null,
                effective_branch_enabled: candidate.branch_enabled && candidate.master_active && !nextUntil,
            } : candidate));
            toast.success('Menu Governance', clear
                ? `Cleared temporary pause for ${item.name}.`
                : `Saved temporary pause for ${item.name}.`);
        } catch (error: any) {
            console.error('Failed to update temporary menu disablement', error);
            toast.error('Menu Governance', error.message || 'Could not update temporary disablement.');
        } finally {
            setIsWorking(false);
        }
    }, [branch, temporaryDisableReason, temporaryDisableUntil]);

    const toggleBulk = useCallback(async () => {
        if (!branch || filtered.length === 0) {
            return;
        }

        const shouldEnable = filtered.some((item) => !item.branch_enabled);
        setIsWorking(true);
        try {
            await catalogApi.bulkSetBranchMapping({
                branch_id: Number(branch),
                items: filtered.map((item) => ({
                    product_id: item.product_id,
                    is_enabled: shouldEnable,
                })),
            });
            setItems((prev) => prev.map((item) =>
                filtered.find((candidate) => candidate.product_id === item.product_id)
                    ? {
                        ...item,
                        branch_enabled: shouldEnable,
                        effective_branch_enabled: shouldEnable && item.master_active && !item.is_temporarily_disabled,
                    }
                    : item,
            ));
            toast.success('Menu Governance', `Updated ${filtered.length} products for this branch menu.`);
        } catch (error: any) {
            console.error('Bulk menu governance update failed', error);
            toast.error('Menu Governance', error.message || 'Could not update visible products.');
        } finally {
            setIsWorking(false);
        }
    }, [branch, filtered]);

    const handleReset = useCallback(() => {
        void fetchBranchMenu();
    }, [fetchBranchMenu]);

    const handleSave = useCallback(() => {
        toast.success('Menu Governance', 'Changes are saved immediately as you toggle products.');
    }, []);

    const handleCancel = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <div className={styles.pageIcon}>
                        <Store size={20} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Menu Availability Manager</h1>
                        <p className={styles.pageSubtitle}>Govern what the selected branch can sell inside each effective menu without duplicating master products.</p>
                    </div>
                </div>
                <div className={styles.pageHeaderRight}>
                    <div className={styles.controlGroup}>
                        <label className={styles.controlLabel}>Branch</label>
                        <div className={styles.selectWrapper}>
                            <select className={styles.select} value={branch} onChange={(e) => setBranch(e.target.value)}>
                                {branches.map((item) => (
                                    <option key={item.id} value={item.id}>{item.branch_name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className={styles.selectChevron} />
                        </div>
                    </div>
                    <div className={styles.controlGroup}>
                        <label className={styles.controlLabel}>Menu</label>
                        <div className={styles.selectWrapper}>
                            <select className={styles.select} value={menu} onChange={(e) => setMenu(e.target.value)}>
                                {menuTypes.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className={styles.selectChevron} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.searchWrapper}>
                    <Search size={15} className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search items or categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className={styles.filterWrapper}>
                    <Filter size={14} className={styles.filterIcon} />
                    <div className={styles.categoryFilters}>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                className={`${styles.catBtn} ${categoryFilter === cat ? styles.catBtnActive : ''}`}
                                onClick={() => setCategoryFilter(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.bulkPanel}>
                <div className={styles.bulkLabel}>
                    <CheckSquare size={15} />
                    <span>Visible Product Control</span>
                    <span className={styles.bulkHint}>(applies to {filtered.length} products in the selected menu)</span>
                </div>
                <div className={styles.bulkChannels}>
                    <button
                        className={`${styles.bulkChannelBtn} ${bulkValue === true ? styles.bulkChannelBtnOn : ''} ${bulkValue === 'mixed' ? styles.bulkChannelBtnMixed : ''}`}
                        onClick={() => void toggleBulk()}
                        disabled={isWorking}
                    >
                        <Store size={14} className={styles.channelIcon} />
                        <span className={styles.bulkChannelName}>{bulkValue === true ? 'Disable visible products' : 'Enable visible products'}</span>
                        <span className={styles.bulkChannelCount}>{filtered.filter((item) => item.branch_enabled).length}</span>
                    </button>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.thItem}>
                                <span>Item</span>
                                <span className={styles.thCount}>({filtered.length})</span>
                            </th>
                            <th className={styles.thCat}>Category</th>
                            <th className={styles.thPrice}>Price</th>
                            <th className={styles.thChannel}>Branch Status</th>
                            <th className={styles.thChannel}>Order Channels</th>
                            <th className={styles.thChannel}>Governance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(grouped).map(([category, categoryItems]) => (
                            <Fragment key={category}>
                                <tr className={styles.categoryRow}>
                                    <td colSpan={6} className={styles.categoryCell}>
                                        {category}
                                        <span className={styles.categoryCount}>{categoryItems.length} items</span>
                                    </td>
                                </tr>
                                {categoryItems.map((item) => (
                                    <tr key={item.id} className={styles.itemRow}>
                                        <td className={styles.tdItem}>
                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                <span>{item.name}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {item.menu_type_name || 'No menu assigned'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={styles.tdCat}>
                                            <span className={styles.catTag}>{item.category}</span>
                                        </td>
                                        <td className={styles.tdPrice}>
                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                <span className={styles.priceVal}>Rs {item.price.toLocaleString()}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {item.price_source === 'branch_menu_price'
                                                        ? 'Branch menu price'
                                                        : item.price_source === 'branch_base_override'
                                                            ? 'Branch base override'
                                                            : 'Master base price'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={styles.tdChannel}>
                                            <BranchToggle value={item.branch_enabled} onChange={(value) => void updateItem(item.product_id, value)} />
                                        </td>
                                        <td className={styles.tdChannel}>
                                            <div style={{ display: 'grid', gap: '8px' }}>
                                                <div className={styles.cardChannel}>
                                                    <div className={styles.cardChannelLabel}><span>Dine-In</span></div>
                                                    <BranchToggle value={item.channel_availability.dine_in} onChange={(value) => void updateChannel(item, 'dine_in', value)} />
                                                </div>
                                                <div className={styles.cardChannel}>
                                                    <div className={styles.cardChannelLabel}><span>Takeaway</span></div>
                                                    <BranchToggle value={item.channel_availability.takeout} onChange={(value) => void updateChannel(item, 'takeout', value)} />
                                                </div>
                                                <div className={styles.cardChannel}>
                                                    <div className={styles.cardChannelLabel}><span>Delivery</span></div>
                                                    <BranchToggle value={item.channel_availability.delivery} onChange={(value) => void updateChannel(item, 'delivery', value)} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className={styles.tdChannel}>
                                            <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                                                <strong>{item.master_active ? 'Master active' : 'Master archived'}</strong>
                                                <span>{item.menu_assignment_source === 'branch_override' ? 'Branch menu override' : item.menu_assignment_source === 'master' ? 'Inherited master menu' : 'No menu assignment'}</span>
                                                <span>{item.effective_branch_enabled ? 'Sellable now' : 'Not sellable now'}</span>
                                                {item.is_temporarily_disabled && (
                                                    <span>Paused until {new Date(item.temporarily_disabled_until || '').toLocaleString()}</span>
                                                )}
                                                <input
                                                    type="datetime-local"
                                                    value={temporaryDisableUntil[item.product_id] || ''}
                                                    onChange={(event) => setTemporaryDisableUntil((prev) => ({
                                                        ...prev,
                                                        [item.product_id]: event.target.value,
                                                    }))}
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(255,255,255,0.14)',
                                                        background: 'rgba(12, 17, 29, 0.55)',
                                                        color: 'inherit',
                                                        padding: '8px 10px',
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Pause reason (optional)"
                                                    value={temporaryDisableReason[item.product_id] || ''}
                                                    onChange={(event) => setTemporaryDisableReason((prev) => ({
                                                        ...prev,
                                                        [item.product_id]: event.target.value,
                                                    }))}
                                                    style={{
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(255,255,255,0.14)',
                                                        background: 'rgba(12, 17, 29, 0.55)',
                                                        color: 'inherit',
                                                        padding: '8px 10px',
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <button
                                                        className={styles.bulkChannelBtn}
                                                        onClick={() => void saveTemporaryDisable(item)}
                                                        disabled={isWorking}
                                                    >
                                                        Save pause
                                                    </button>
                                                    <button
                                                        className={styles.resetBtn}
                                                        onClick={() => void saveTemporaryDisable(item, true)}
                                                        disabled={isWorking}
                                                    >
                                                        Clear pause
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className={styles.emptyState}>
                                    No items match your search or filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.cardList}>
                {filtered.map((item) => (
                    <div key={item.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <div className={styles.cardName}>{item.name}</div>
                                <div className={styles.cardMeta}>
                                    <span className={styles.catTag}>{item.category}</span>
                                    <span className={styles.priceVal}>Rs {item.price.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.cardChannels}>
                            <div className={styles.cardChannel}>
                                <div className={styles.cardChannelLabel}>
                                    <Store size={13} />
                                    <span>Branch status</span>
                                </div>
                                <BranchToggle value={item.branch_enabled} onChange={(value) => void updateItem(item.product_id, value)} />
                            </div>
                            <div className={styles.cardChannel}>
                                <div className={styles.cardChannelLabel}>
                                    <Filter size={13} />
                                    <span>Dine-In</span>
                                </div>
                                <BranchToggle value={item.channel_availability.dine_in} onChange={(value) => void updateChannel(item, 'dine_in', value)} />
                            </div>
                            <div className={styles.cardChannel}>
                                <div className={styles.cardChannelLabel}>
                                    <Filter size={13} />
                                    <span>Takeaway</span>
                                </div>
                                <BranchToggle value={item.channel_availability.takeout} onChange={(value) => void updateChannel(item, 'takeout', value)} />
                            </div>
                            <div className={styles.cardChannel}>
                                <div className={styles.cardChannelLabel}>
                                    <Filter size={13} />
                                    <span>Delivery</span>
                                </div>
                                <BranchToggle value={item.channel_availability.delivery} onChange={(value) => void updateChannel(item, 'delivery', value)} />
                            </div>
                            <div className={styles.cardChannel}>
                                <div className={styles.cardChannelLabel}>
                                    <Filter size={13} />
                                    <span>Governance</span>
                                </div>
                                <div style={{ display: 'grid', gap: '8px', width: '100%' }}>
                                    <strong>{item.menu_assignment_source === 'branch_override' ? 'Branch override' : item.menu_assignment_source === 'master' ? 'Master menu' : 'Unassigned'}</strong>
                                    <span>{item.effective_branch_enabled ? 'Sellable now' : 'Not sellable now'}</span>
                                    {item.is_temporarily_disabled && (
                                        <span>Paused until {new Date(item.temporarily_disabled_until || '').toLocaleString()}</span>
                                    )}
                                    <input
                                        type="datetime-local"
                                        value={temporaryDisableUntil[item.product_id] || ''}
                                        onChange={(event) => setTemporaryDisableUntil((prev) => ({
                                            ...prev,
                                            [item.product_id]: event.target.value,
                                        }))}
                                        style={{
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.14)',
                                            background: 'rgba(12, 17, 29, 0.55)',
                                            color: 'inherit',
                                            padding: '8px 10px',
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Pause reason (optional)"
                                        value={temporaryDisableReason[item.product_id] || ''}
                                        onChange={(event) => setTemporaryDisableReason((prev) => ({
                                            ...prev,
                                            [item.product_id]: event.target.value,
                                        }))}
                                        style={{
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.14)',
                                            background: 'rgba(12, 17, 29, 0.55)',
                                            color: 'inherit',
                                            padding: '8px 10px',
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            className={styles.bulkChannelBtn}
                                            onClick={() => void saveTemporaryDisable(item)}
                                            disabled={isWorking}
                                        >
                                            Save pause
                                        </button>
                                        <button
                                            className={styles.resetBtn}
                                            onClick={() => void saveTemporaryDisable(item, true)}
                                            disabled={isWorking}
                                        >
                                            Clear pause
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className={styles.emptyState}>No items found.</div>
                )}
            </div>

            <div className={styles.actionBar}>
                <div className={styles.actionBarLeft}>
                    <button className={styles.resetBtn} onClick={handleReset}>
                        <RotateCcw size={16} />
                        <span>Reload Branch Menu</span>
                    </button>
                </div>
                <div className={styles.actionBarRight}>
                    <button className={styles.cancelBtn} onClick={handleCancel}>
                        <X size={16} />
                        <span>Cancel</span>
                    </button>
                    <button className={styles.saveBtn} onClick={handleSave}>
                        <CheckSquare size={16} />
                        <span>Changes Save Instantly</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
