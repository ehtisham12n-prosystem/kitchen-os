/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { Search, ChevronRight, LayoutGrid, Store, Calendar, Filter, Coins, AlertTriangle, Package2, Clock3, Save } from 'lucide-react';
import { catalogApi, resolveActiveBranchId, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import styles from './BranchPricing.module.css';

const FOOD_TYPES = [
    { id: 'veg', name: 'Vegetarian' },
    { id: 'non-veg', name: 'Non-Vegetarian' },
];

type BranchOption = { id: number; branch_name: string };
type PriceProfileOption = { id: number; name: string };
type CategoryOption = { id: number; category_name: string };
type CuisineOption = { id: number; name: string };
type StationOption = { id: number; name: string; branchAvailability?: Record<string, boolean> };
type PriceSaveOverrides = {
    price?: number;
    effective_from?: string;
    station_id?: number | undefined;
    delivery_minutes?: number;
};

export function BranchPricing() {
    const { formatMoney } = useCurrencyConfig();
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchSku, setSearchSku] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [selectedPriceProfileId, setSelectedPriceProfileId] = useState<string>('');
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [selectedCuisineId, setSelectedCuisineId] = useState<string>('all');
    const [selectedFoodType, setSelectedFoodType] = useState<string>('all');
    const [selectedStationFilter, setSelectedStationFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [PriceProfiles, setPriceProfiles] = useState<PriceProfileOption[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [cuisines, setCuisines] = useState<CuisineOption[]>([]);
    const [stations, setStations] = useState<StationOption[]>([]);
    const [customizations, setCustomizations] = useState<any[]>([]);
    const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
    const [effectiveDates, setEffectiveDates] = useState<Record<string, string>>({});
    const [productStations, setProductStations] = useState<Record<string, string>>({});
    const [productDeliverTimes, setProductDeliverTimes] = useState<Record<string, string>>({});
    const [originalPrices, setOriginalPrices] = useState<Record<string, number>>({});
    const [originalEffectiveDates, setOriginalEffectiveDates] = useState<Record<string, string>>({});
    const [originalStations, setOriginalStations] = useState<Record<string, string>>({});
    const [originalDeliverTimes, setOriginalDeliverTimes] = useState<Record<string, string>>({});
    const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const formatCurrency = (value: number | null | undefined) => formatMoney(value || 0);
    const formatVariantLabel = (customization: any) => {
        const size = String(customization?.customization_value || customization?.value || '').trim();
        const uom = String(customization?.customization_type || customization?.type || '').trim();
        if (size && uom) {
            return `${size} ${uom}`;
        }
        return size || uom || 'Standard';
    };
    const getDefaultVariantPrice = useCallback((product: any, customizationId: number | null) => {
        if (!customizationId) {
            return Number(product.product_base_price || 0);
        }
        const customization = customizations.find((item) => item.id === customizationId);
        return Number(product.product_base_price || 0) + Number(customization?.customization_price_delta || customization?.price_delta || 0);
    }, [customizations]);
    const getKey = (productId: number, PriceProfileId: number | string, customizationId: number | null) =>
        `${productId}-${PriceProfileId}-${customizationId || 'base'}`;

    useEffect(() => {
        const fetchLookups = async () => {
            setIsLoading(true);
            try {
                const [branchData, categoryData, cuisineData, stationData, PriceProfileData] = await Promise.all([
                    setupApi.getBranches(),
                    catalogApi.getCategories(),
                    catalogApi.getCuisineTypes(),
                    catalogApi.getStations(),
                    catalogApi.getPriceProfiles(),
                ]);

                setBranches(branchData);
                setCategories(categoryData);
                setCuisines(cuisineData);
                setStations(stationData);
                setPriceProfiles(PriceProfileData);

                const preferredBranchId = resolveActiveBranchId();
                const initialBranchId = String(
                    branchData.find((branch) => String(branch.id) === preferredBranchId)?.id || branchData[0]?.id || '',
                );
                const initialPriceProfileId = String(PriceProfileData[0]?.id || '');
                setSelectedBranchId((current) => current || initialBranchId);
                setSelectedPriceProfileId((current) => current || initialPriceProfileId);
            } catch (error) {
                console.error('Failed to load branch pricing lookups:', error);
                toast.error('Pricing Error', 'Could not load branch pricing lookups.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLookups();
    }, []);

    useEffect(() => {
        const fetchPricing = async () => {
            if (!selectedBranchId) {
                return;
            }

            setIsLoading(true);
            try {
                const requestedPriceProfileId = Number(selectedPriceProfileId || 0) || undefined;
                const response = await catalogApi.getBranchPricing(Number(selectedBranchId), requestedPriceProfileId);
                const loadedProducts = response.products || [];
                const loadedCustomizations = response.customizations || [];
                const loadedPrices = response.prices || [];
                const resolvedPriceProfileId = Number(selectedPriceProfileId || response.PriceProfiles?.[0]?.id || 0);

                setProducts(loadedProducts);
                setCustomizations(loadedCustomizations);
                if (response.PriceProfiles?.length) {
                    setPriceProfiles(response.PriceProfiles);
                    if (!selectedPriceProfileId) {
                        setSelectedPriceProfileId(String(response.PriceProfiles[0].id));
                    }
                }

                const priceMap: Record<string, number> = {};
                const dateMap: Record<string, string> = {};
                const stationMap: Record<string, string> = {};
                const deliveryMap: Record<string, string> = {};

                loadedPrices.forEach((price: any) => {
                    const key = getKey(price.product_id, price.price_profile_id, price.customization_id || null);
                    priceMap[key] = Number(price.price || 0);
                    dateMap[key] = price.effective_from || todayIso;
                    stationMap[key] = price.station_id ? String(price.station_id) : '';
                    deliveryMap[key] = price.delivery_minutes ? String(price.delivery_minutes) : '';
                });

                loadedProducts.forEach((product: any) => {
                    const productCustomizations = loadedCustomizations.filter((item: any) => item.product_id === product.id);
                    const customizationEntries = productCustomizations.length > 0
                        ? productCustomizations.map((customization: any) => customization.id)
                        : [null];

                    customizationEntries.forEach((customizationId: number | null) => {
                        if (!resolvedPriceProfileId) {
                            return;
                        }
                        const key = getKey(product.id, resolvedPriceProfileId, customizationId);
                        if (priceMap[key] === undefined) {
                            priceMap[key] = getDefaultVariantPrice(product, customizationId);
                        }
                        if (!dateMap[key]) {
                            dateMap[key] = todayIso;
                        }
                        if (!stationMap[key] && product.production_station_id) {
                            stationMap[key] = String(product.production_station_id);
                        }
                        if (!deliveryMap[key]) {
                            deliveryMap[key] = String(product.serving_time ?? 20);
                        }
                    });
                });

                setEditedPrices(priceMap);
                setEffectiveDates(dateMap);
                setProductStations(stationMap);
                setProductDeliverTimes(deliveryMap);
                setOriginalPrices(priceMap);
                setOriginalEffectiveDates(dateMap);
                setOriginalStations(stationMap);
                setOriginalDeliverTimes(deliveryMap);
            } catch (error) {
                console.error('Failed to load branch pricing:', error);
                toast.error('Pricing Error', 'Could not load branch pricing.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPricing();
    }, [getDefaultVariantPrice, selectedBranchId, selectedPriceProfileId, todayIso]);

    const handlePriceChange = (productId: number, PriceProfileId: number, customizationId: number | null, value: string) => {
        const key = getKey(productId, PriceProfileId, customizationId);
        setEditedPrices(prev => ({
            ...prev,
            [key]: Number(value),
        }));
    };

    const handleDateChange = (productId: number, PriceProfileId: number, customizationId: number | null, value: string) => {
        const key = getKey(productId, PriceProfileId, customizationId);
        setEffectiveDates(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleStationChange = (productId: number, PriceProfileId: number, customizationId: number | null, value: string) => {
        const key = getKey(productId, PriceProfileId, customizationId);
        setProductStations(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleDeliverTimeChange = (productId: number, PriceProfileId: number, customizationId: number | null, value: string) => {
        const key = getKey(productId, PriceProfileId, customizationId);
        setProductDeliverTimes(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const savePrice = async (row: any, overrides: PriceSaveOverrides = {}) => {
        const PriceProfileId = Number(selectedPriceProfileId);
        const key = getKey(row.product_id, PriceProfileId, row.customization_id || null);
        const price = overrides.price ?? editedPrices[key] ?? row.default_price;
        const effectiveFrom = overrides.effective_from ?? effectiveDates[key] ?? todayIso;
        const stateStationId = productStations[key] ? Number(productStations[key]) : undefined;
        const stationIdRaw = overrides.station_id ?? stateStationId ?? row.default_station_id;
        const stateDelivery = productDeliverTimes[key] ? Number(productDeliverTimes[key]) : undefined;
        const deliveryMinutes = overrides.delivery_minutes ?? stateDelivery ?? row.default_delivery_minutes;
        try {
            setSavingRows((prev) => ({ ...prev, [key]: true }));
            await catalogApi.updateBranchPrice({
                branch_id: Number(selectedBranchId),
                product_id: row.product_id,
                price_profile_id: PriceProfileId,
                customization_id: row.customization_id || undefined,
                price,
                effective_from: effectiveFrom,
                station_id: stationIdRaw || undefined,
                delivery_minutes: deliveryMinutes,
            });
            setOriginalPrices((prev) => ({ ...prev, [key]: Number(price || 0) }));
            setOriginalEffectiveDates((prev) => ({ ...prev, [key]: effectiveFrom || todayIso }));
            setOriginalStations((prev) => ({ ...prev, [key]: stationIdRaw ? String(stationIdRaw) : '' }));
            setOriginalDeliverTimes((prev) => ({ ...prev, [key]: String(deliveryMinutes ?? '') }));
            toast.success('Saved', 'Pricing row updated.');
        } catch (error: any) {
            console.error('Failed to save branch price:', error);
            toast.error('Save Failed', error.message || 'Could not save branch pricing.');
        } finally {
            setSavingRows((prev) => ({ ...prev, [key]: false }));
        }
    };

    const toggleProductVisibility = async (productId: number, currentStatus: boolean) => {
        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(selectedBranchId),
                product_id: productId,
                is_enabled: !currentStatus,
                price_profile_id: Number(selectedPriceProfileId),
            });

            setProducts(prev => prev.map(product =>
                product.id === productId ? { ...product, is_enabled: !currentStatus } : product
            ));
        } catch (error: any) {
            console.error('Failed to update product visibility:', error);
            toast.error('Update Failed', error.message || 'Could not update availability.');
        }
    };

    const toggleOpenOrderReturn = async (productId: number, currentValue: boolean, currentStatus: boolean) => {
        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(selectedBranchId),
                product_id: productId,
                is_enabled: currentStatus,
                allow_open_order_return: !currentValue,
            });

            setProducts(prev => prev.map(product =>
                product.id === productId ? { ...product, allow_open_order_return: !currentValue } : product
            ));
            toast.success('Return Rule Updated', 'Open-order return policy updated for this branch.');
        } catch (error: any) {
            console.error('Failed to update open-order return:', error);
            toast.error('Update Failed', error.message || 'Could not update return policy.');
        }
    };

    const updateMenuAssignment = async (productId: number, PriceProfileId: number | null) => {
        if (!selectedBranchId) {
            return;
        }

        try {
            await catalogApi.setBranchMapping({
                branch_id: Number(selectedBranchId),
                product_id: productId,
                price_profile_id: PriceProfileId,
            });

            toast.success('Menu Assignment', 'Product assigned successfully.');

            // Refresh products to reflect the move
            const requestedPriceProfileId = Number(selectedPriceProfileId || 0) || undefined;
            const response = await catalogApi.getBranchPricing(Number(selectedBranchId), requestedPriceProfileId);
            setProducts(response.products || []);
        } catch (error: any) {
            console.error('Failed to update menu assignment:', error);
            toast.error('Assignment Failed', error.message || 'Could not update menu assignment.');
        }
    };

    const isRowDirty = (row: any) => {
        const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
        const currentPrice = Number(editedPrices[key] ?? row.default_price ?? 0);
        const currentDate = effectiveDates[key] || row.effective_from || todayIso;
        const currentStation = productStations[key] || (row.default_station_id ? String(row.default_station_id) : '');
        const currentDelivery = String(productDeliverTimes[key] || row.default_delivery_minutes || '');

        return (
            currentPrice !== Number(originalPrices[key] ?? row.default_price ?? 0)
            || currentDate !== (originalEffectiveDates[key] || row.effective_from || todayIso)
            || currentStation !== (originalStations[key] || (row.default_station_id ? String(row.default_station_id) : ''))
            || currentDelivery !== String(originalDeliverTimes[key] || row.default_delivery_minutes || '')
        );
    };

    const availableStations = useMemo(() => {
        return stations.filter((station) => {
            if (!station.branchAvailability) {
                return true;
            }
            const value = station.branchAvailability[selectedBranchId];
            return value !== false;
        });
    }, [stations, selectedBranchId]);

    const tableData = useMemo(() => {
        const data: any[] = [];
        const activePriceProfileId = Number(selectedPriceProfileId);

        products.forEach((product) => {
            const inferredFoodType = product.category?.category_name?.toLowerCase().includes('veg') ? 'veg' : 'non-veg';
            const matchesCategory = selectedCategoryId === 'all' || String(product.category_id) === selectedCategoryId;
            const matchesCuisine = selectedCuisineId === 'all' || String(product.cuisine_type_id) === selectedCuisineId;
            const matchesFoodType = selectedFoodType === 'all' || inferredFoodType === selectedFoodType;
            const matchesSearch = !searchTerm || product.product_name.toLowerCase().includes(searchTerm.toLowerCase());
            const skuDisplay = product.product_sku || product.product_code || '';
            const matchesSku = !searchSku || skuDisplay.toLowerCase().includes(searchSku.toLowerCase());
            if (!matchesCategory || !matchesCuisine || !matchesFoodType || !matchesSearch || !matchesSku) {
                return;
            }

            const productCustomizations = customizations.filter((item) => item.product_id === product.id);
            const entries = productCustomizations.length > 0
                ? productCustomizations.map((customization) => ({
                    customization_id: customization.id,
                    portion_label: formatVariantLabel(customization),
                    default_price: getDefaultVariantPrice(product, customization.id),
                }))
                : [{ customization_id: null, portion_label: 'Standard', default_price: Number(product.product_base_price || 0) }];

            entries.forEach((entry) => {
                const key = getKey(product.id, activePriceProfileId, entry.customization_id || null);
                const stationId = productStations[key] || (product.production_station_id ? String(product.production_station_id) : '');
                const matchesStation = selectedStationFilter === 'all' || stationId === selectedStationFilter;

                if (!matchesStation) {
                    return;
                }

                data.push({
                    id: key,
                    product_id: product.id,
                    product_name: product.product_name,
                    product_sku: product.product_sku,
                    product_code: product.product_code,
                    sku_display: skuDisplay || `PRD-${product.id}`,
                    category: product.category?.category_name,
                    customization_id: entry.customization_id,
                    portion_label: entry.portion_label,
                    default_price: entry.default_price,
                    food_type: inferredFoodType,
                    is_enabled: product.is_enabled,
                    allow_open_order_return: Boolean(product.allow_open_order_return),
                    price_profile_name: PriceProfiles.find((item) => String(item.id) === selectedPriceProfileId)?.name || '',
                    branch_name: branches.find((item) => String(item.id) === selectedBranchId)?.branch_name || '',
                    station: stationId,
                    default_station_id: product.production_station_id || undefined,
                    default_station_name: product.production_station?.name || 'Unassigned',
                    deliver_time: productDeliverTimes[key] || String(product.serving_time ?? 20),
                    default_delivery_minutes: Number(product.serving_time ?? 20),
                    effective_from: effectiveDates[key] || todayIso,
                    recipe_cost_summary: product.recipe_cost_summary || null,
                    margin_amount: product.recipe_cost_summary?.margin_amount ?? null,
                    margin_percentage: product.recipe_cost_summary?.margin_percentage ?? null,
                    cost_status: product.recipe_cost_summary?.cost_status ?? 'missing',
                    missing_cost_ingredient_count: product.recipe_cost_summary?.missing_cost_ingredient_count ?? 0,
                    branch_price_profile_override_id: product.branch_price_profile_override_id,
                    menu_assignment_source: product.menu_assignment_source,
                });
            });
        });

        return data;
    }, [
        branches,
        products,
        customizations,
        PriceProfiles,
        selectedCategoryId,
        selectedCuisineId,
        selectedFoodType,
        searchTerm,
        searchSku,
        selectedStationFilter,
        selectedPriceProfileId,
        selectedBranchId,
        getDefaultVariantPrice,
        productStations,
        productDeliverTimes,
        effectiveDates,
        todayIso,
    ]);

    const totalPages = Math.max(1, Math.ceil(tableData.length / itemsPerPage));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return tableData.slice(start, start + itemsPerPage);
    }, [tableData, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, searchSku, selectedCategoryId, selectedCuisineId, selectedFoodType, selectedStationFilter, selectedBranchId, selectedPriceProfileId]);

    const columns: ColumnDef<any>[] = [
        {
            key: 'product',
            header: 'Product',
            width: '200px',
            cell: (row) => (
                <div className={styles.productCell}>
                    <div className={styles.productInfo}>
                        <div className={styles.nameHeader}>
                            <span className={styles.productName}>{row.product_name}</span>
                            <span className={row.food_type === 'veg' ? styles.vegBadge : styles.nonVegBadge}></span>
                        </div>
                        <div className={styles.productMeta}>
                            <span className={styles.categoryChip}>{row.category || 'Uncategorized'}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'sku',
            header: 'SKU',
            width: '90px',
            cell: (row) => <span className={styles.skuBadge}>{row.sku_display}</span>
        },
        {
            key: 'portion',
            header: 'Portion',
            width: '100px',
            cell: (row) => <span style={{ fontSize: '0.8rem' }}>{row.portion_label.replace(/\sPortion$/, '')}</span>
        },
        {
            key: 'is_enabled',
            header: 'Status',
            width: '64px',
            cell: (row) => (
                <div className={styles.toggleWrapper}>
                    <div className={styles.switch}>
                        <input
                            type="checkbox"
                            tabIndex={-1}
                            id={`toggle-${row.id}`}
                            checked={row.is_enabled}
                            onChange={() => toggleProductVisibility(row.product_id, row.is_enabled)}
                        />
                        <label htmlFor={`toggle-${row.id}`}></label>
                    </div>
                </div>
            )
        },
        {
            key: 'assignment',
            header: 'Assignment',
            width: '150px',
            cell: (row: any) => (
                <div className={styles.assignmentCell}>
                    <KitchenSelect
                        options={[
                            { value: '', label: 'Inherit Master' },
                            ...PriceProfiles.map((mt) => ({ value: String(mt.id), label: mt.name })),
                        ]}
                        value={row.branch_price_profile_override_id ? String(row.branch_price_profile_override_id) : ''}
                        onChange={(e) => updateMenuAssignment(row.product_id, e.target.value ? Number(e.target.value) : null)}
                        className={styles.compactSelect}
                        disabled={!row.is_enabled}
                    />
                    <div className={styles.assignmentSource} style={{ color: row.menu_assignment_source === 'branch_override' ? 'var(--accent-primary)' : 'inherit' }}>
                        {row.menu_assignment_source === 'branch_override' ? 'Branch Override' : 'Inherit Master'}
                    </div>
                </div>
            ),
        },
        {
            key: 'allow_open_order_return',
            header: 'Open Return',
            width: '110px',
            cell: (row: any) => (
                <div className={styles.toggleWrapper}>
                    <div className={styles.switch}>
                        <input
                            type="checkbox"
                            tabIndex={-1}
                            id={`return-toggle-${row.id}`}
                            checked={Boolean(row.allow_open_order_return)}
                            onChange={() => toggleOpenOrderReturn(row.product_id, Boolean(row.allow_open_order_return), Boolean(row.is_enabled))}
                        />
                        <label htmlFor={`return-toggle-${row.id}`}></label>
                    </div>
                </div>
            ),
        },
        {
            key: 'price',
            header: 'Price',
            align: 'right',
            width: '110px',
            cell: (row: any) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return (
                    <div className={styles.priceInputWrapper}>
                        <KitchenInput
                            type="number"
                            placeholder="0.00"
                            value={editedPrices[key] ?? row.default_price}
                            onChange={(e) => handlePriceChange(row.product_id, Number(selectedPriceProfileId), row.customization_id, e.target.value)}
                            className={styles.priceInput}
                            disabled={!row.is_enabled}
                        />
                        <small className={styles.defaultHint}>Default {formatCurrency(row.default_price)}</small>
                    </div>
                );
            }
        },
        {
            key: 'recipe_cost',
            header: 'Cost',
            width: '110px',
            cell: (row: any) => {
                const summary = row.recipe_cost_summary;
                if (!summary?.selected_recipe_id) {
                    return <span className={styles.mutedNote}>No recipe</span>;
                }

                return (
                    <div className={styles.metricCell}>
                        <span>{formatCurrency(summary.cost_per_yield_unit)}</span>
                        <small>{summary.selected_recipe_name}</small>
                    </div>
                );
            }
        },
        {
            key: 'margin',
            header: 'Margin',
            width: '110px',
            cell: (row: any) => {
                const summary = row.recipe_cost_summary;
                if (!summary?.selected_recipe_id) {
                    return <span className={styles.mutedNote}>Unavailable</span>;
                }

                return (
                    <div className={styles.metricCell}>
                        <span className={(summary.margin_amount ?? 0) >= 0 ? styles.marginPositive : styles.marginNegative}>
                            {formatCurrency(summary.margin_amount)}
                        </span>
                        <small>{Number(summary.margin_percentage || 0).toFixed(1)}% • {summary.cost_status}</small>
                    </div>
                );
            }
        },
        {
            key: 'effective_date',
            header: 'Eff. Date',
            width: '140px',
            cell: (row: any) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return (
                    <div className={styles.dateInputWrapper}>
                        <KitchenInput
                            type="date"
                            value={effectiveDates[key] || row.effective_from || todayIso}
                            onChange={(e) => handleDateChange(row.product_id, Number(selectedPriceProfileId), row.customization_id, e.target.value)}
                            className={styles.dateInput}
                            disabled={!row.is_enabled}
                        />
                    </div>
                );
            }
        },
        {
            key: 'station',
            header: 'Station',
            width: '150px',
            cell: (row: any) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return (
                    <div className={styles.stationSelectWrapper}>
                        <KitchenSelect
                            options={[
                                { value: '', label: 'Select Station' },
                                ...availableStations.map((station) => ({ value: String(station.id), label: station.name }))
                            ]}
                            value={productStations[key] || (row.default_station_id ? String(row.default_station_id) : '')}
                            onChange={(e) => handleStationChange(row.product_id, Number(selectedPriceProfileId), row.customization_id, e.target.value)}
                            className={styles.compactSelect}
                            disabled={!row.is_enabled}
                        />
                        <small className={styles.defaultHint}>Default {row.default_station_name}</small>
                    </div>
                );
            }
        },
        {
            key: 'deliver_time',
            header: 'Deliv.',
            width: '100px',
            cell: (row: any) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return (
                    <div className={styles.timeInputWrapper}>
                        <KitchenInput
                            type="number"
                            placeholder="Min"
                            value={productDeliverTimes[key] || String(row.default_delivery_minutes)}
                            onChange={(e) => handleDeliverTimeChange(row.product_id, Number(selectedPriceProfileId), row.customization_id, e.target.value)}
                            className={styles.timeInput}
                            disabled={!row.is_enabled}
                        />
                        <small className={styles.defaultHint}>Default {row.default_delivery_minutes} min</small>
                    </div>
                );
            }
        },
        {
            key: 'actions',
            header: 'Update',
            width: '90px',
            cell: (row: any) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return (
                        <KitchenButton
                            variant={isRowDirty(row) ? 'primary' : 'outline'}
                            size="sm"
                            className={styles.saveButton}
                            onClick={() => savePrice(row)}
                            disabled={!row.is_enabled || !isRowDirty(row)}
                            isLoading={!!savingRows[key]}
                            title="Save"
                        >
                            {!savingRows[key] && <Save size={18} />}
                        </KitchenButton>
                );
            }
        }
    ];

    const summaryStats = useMemo(() => {
        const totalRows = tableData.length;
        const visibleRows = tableData.filter((row) => row.is_enabled);
        const withRecipes = visibleRows.filter((row) => row.recipe_cost_summary?.selected_recipe_id);
        const partial = withRecipes.filter((row) => row.cost_status !== 'complete').length;
        const avgMargin = withRecipes.length
            ? withRecipes.reduce((sum, row) => sum + Number(row.margin_percentage || 0), 0) / withRecipes.length
            : 0;
        const hiddenCount = Math.max(0, totalRows - visibleRows.length);
        const avgDelivery = visibleRows.length
            ? visibleRows.reduce((sum, row) => sum + Number(row.deliver_time || row.default_delivery_minutes || 0), 0) / visibleRows.length
            : 0;
        const avgPrice = tableData.length
            ? tableData.reduce((sum, row) => {
                const key = getKey(row.product_id, selectedPriceProfileId, row.customization_id || null);
                return sum + Number(editedPrices[key] ?? row.default_price ?? 0);
            }, 0) / tableData.length
            : 0;
        const categoryCount = new Set(tableData.map((row) => row.category || 'Uncategorized')).size;

        return {
            totalRows,
            visibleCount: visibleRows.length,
            hiddenCount,
            recipeCount: withRecipes.length,
            partialCount: partial,
            avgMargin,
            avgDelivery,
            avgPrice,
            categoryCount,
        };
    }, [editedPrices, selectedPriceProfileId, tableData]);

    const selectedBranch = branches.find((branch) => String(branch.id) === selectedBranchId);
    const selectedPriceProfile = PriceProfiles.find((PriceProfile) => String(PriceProfile.id) === selectedPriceProfileId);

    return (
        <div className={styles.container}>
            <div className="ambient-light-1"></div>

            <header className={styles.header}>
                <div className={styles.titleArea}>
                    <h1>Menu Pricing</h1>
                    <div className={styles.breadcrumb}>
                        <span>Catalog</span> <ChevronRight size={12} /> <span className={styles.activePath}>Pricing Overrides</span>
                    </div>
                </div>
                <div className={styles.headerSelectors}>
                    <div className={styles.contextCard}>
                        <span className={styles.selectorLabel}><Store size={12} /> Branch</span>
                        <KitchenSelect
                            options={branches.map(branch => ({ value: String(branch.id), label: branch.branch_name }))}
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                        />
                    </div>
                    <div className={styles.contextCard}>
                        <span className={styles.selectorLabel}><LayoutGrid size={12} /> Price Profile</span>
                        <KitchenSelect
                            options={PriceProfiles.map(PriceProfile => ({ value: String(PriceProfile.id), label: PriceProfile.name }))}
                            value={selectedPriceProfileId}
                            onChange={(e) => setSelectedPriceProfileId(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <div className={styles.contextBanner}>
                <div className={styles.contextPill}>
                    <Store size={14} />
                    <span className={styles.contextPillLabel}>Active Branch</span>
                    <strong>{selectedBranch?.branch_name || 'Select Branch'}</strong>
                </div>
                <div className={styles.contextPill}>
                    <LayoutGrid size={14} />
                    <span className={styles.contextPillLabel}>Active Price Profile</span>
                    <strong>{selectedPriceProfile?.name || 'Select Price Profile'}</strong>
                </div>
                <div className={styles.contextPillMuted}>
                    <Calendar size={14} />
                    <span>Default effective date: {todayIso}</span>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--accent-secondary)' }}>
                        <Package2 size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.totalRows}</span>
                        <span className={styles.statLabel}>Pricing Rows</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--accent-primary)' }}>
                        <Store size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.visibleCount}</span>
                        <span className={styles.statLabel}>Active Rows</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--danger)' }}>
                        <AlertTriangle size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.hiddenCount}</span>
                        <span className={styles.statLabel}>Hidden Rows</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--accent-tertiary)' }}>
                        <Coins size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{formatCurrency(summaryStats.avgPrice)}</span>
                        <span className={styles.statLabel}>Avg Price</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--warning)' }}>
                        <Calendar size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.avgDelivery.toFixed(0)} min</span>
                        <span className={styles.statLabel}>Avg Deliver</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--success)' }}>
                        <Clock3 size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.avgMargin.toFixed(1)}%</span>
                        <span className={styles.statLabel}>Avg Margin</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--warning)' }}>
                        <AlertTriangle size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.partialCount}</span>
                        <span className={styles.statLabel}>Partial Cost</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.smallStatCard}>
                    <div className={styles.statIcon} style={{ ['--color' as any]: 'var(--accent-primary)' }}>
                        <Filter size={14} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{summaryStats.categoryCount}</span>
                        <span className={styles.statLabel}>Categories</span>
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filterHeader}>
                    <span><Filter size={14} /> Filters</span>
                </div>
                <div className={styles.filterGrid}>
                    <KitchenInput
                        placeholder="Search Product..."
                        icon={<Search size={16} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <KitchenInput
                        placeholder="Search SKU..."
                        icon={<Filter size={16} />}
                        value={searchSku}
                        onChange={(e) => setSearchSku(e.target.value)}
                    />
                    <KitchenSelect
                        options={[
                            { value: 'all', label: 'All Categories' },
                            ...categories.map(category => ({ value: String(category.id), label: category.category_name }))
                        ]}
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                    />
                    <KitchenSelect
                        options={[
                            { value: 'all', label: 'All Cuisines' },
                            ...cuisines.map(cuisine => ({ value: String(cuisine.id), label: cuisine.name }))
                        ]}
                        value={selectedCuisineId}
                        onChange={(e) => setSelectedCuisineId(e.target.value)}
                    />
                    <KitchenSelect
                        options={[
                            { value: 'all', label: 'All Types' },
                            ...FOOD_TYPES.map(type => ({ value: type.id, label: type.name }))
                        ]}
                        value={selectedFoodType}
                        onChange={(e) => setSelectedFoodType(e.target.value)}
                    />
                    <KitchenSelect
                        options={[
                            { value: 'all', label: 'All Stations' },
                            ...availableStations.map(station => ({ value: String(station.id), label: station.name }))
                        ]}
                        value={selectedStationFilter}
                        onChange={(e) => setSelectedStationFilter(e.target.value)}
                    />
                </div>
            </KitchenCard>

            <KitchenCard noPadding className={styles.tableCard}>
                <div className={styles.tableToolbar}>
                    <div className={styles.activeSelection}>
                        <Calendar size={14} />
                        Showing <strong>{selectedPriceProfile?.name || 'Price Profile'}</strong> pricing for <strong>{selectedBranch?.branch_name || 'Branch'}</strong>
                    </div>
                    <div className={styles.paginationRight}>
                        <div className={styles.itemsPerPageWrapper}>
                            <span className={styles.paginationLabel}>Rows:</span>
                            <select
                                className={styles.rowsSelect}
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className={styles.paginationControls}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>
                            <span className={styles.pageIndicator}>Page {currentPage} of {totalPages}</span>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
                {isLoading ? (
                    <div className={styles.loader}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={paginatedData} />
                )}

                {!isLoading && tableData.length > 0 && (
                    <div className={styles.paginationFooter}>
                        <div className={styles.paginationInfo}>
                            Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, tableData.length)}</strong> of <strong>{tableData.length}</strong> entries
                        </div>
                        <div className={styles.paginationRight}>
                            <div className={styles.itemsPerPageWrapper}>
                                <span className={styles.paginationLabel}>Rows:</span>
                                <select
                                    className={styles.rowsSelect}
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div className={styles.paginationControls}>
                                <button
                                    className={styles.pageBtn}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                                <span className={styles.pageIndicator}>Page {currentPage} of {totalPages}</span>
                                <button
                                    className={styles.pageBtn}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </KitchenCard>
        </div>
    );
}
