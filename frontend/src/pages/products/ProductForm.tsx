/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { catalogApi, recipeApi, setupApi } from '../../api/api';
import { Save, ArrowLeft, Image as ImageIcon, Plus, Trash2, Loader2, Info, Layout, Layers, Globe } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ProductForm.module.css';

export function ProductForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [customizations, setCustomizations] = useState<any[]>([]);
    const [recipes, setRecipes] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [recipeCostSummary, setRecipeCostSummary] = useState<any | null>(null);

    // Form Data
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [sku, setSku] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [basePrice, setBasePrice] = useState('0');
    const [servingTime, setServingTime] = useState('20');
    const [categoryId, setCategoryId] = useState('');
    const [cuisineId, setCuisineId] = useState('');
    const [stationId, setStationId] = useState('');
    const [baseUomId, setBaseUomId] = useState('');
    const [taxConfigurationId, setTaxConfigurationId] = useState('');
    const [allowOpenOrderReturn, setAllowOpenOrderReturn] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [isBranchActive, setIsBranchActive] = useState(true);
    const [distributionScope, setDistributionScope] = useState<'all' | 'selected'>('all');
    const [branchAvailability, setBranchAvailability] = useState<Record<number, boolean>>({});

    // Dynamic Lists
    const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
    const [cuisines, setCuisines] = useState<{ value: string; label: string }[]>([]);
    const [stations, setStations] = useState<{ value: string; label: string }[]>([]);
    const [taxConfigurations, setTaxConfigurations] = useState<{ value: string; label: string }[]>([]);
    const [uomOptions, setUomOptions] = useState<{ value: string; label: string }[]>([]);
    const [uomMeasureOptions, setUomMeasureOptions] = useState<{ value: string; label: string }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [cats, cuisinesItems, stationsItems, branchItems, taxItems, uomItems] = await Promise.all([
                    catalogApi.getCategories(),
                    catalogApi.getCuisineTypes(),
                    catalogApi.getStations(),
                    setupApi.getBranches(),
                    setupApi.getTaxes(),
                    catalogApi.getUoms(),
                ]);

                setCategories(cats.map(c => ({ value: c.id.toString(), label: c.category_name })));
                setCuisines(cuisinesItems.map(c => ({ value: c.id.toString(), label: c.name })));
                setStations(stationsItems.map(s => ({ value: s.id.toString(), label: s.name })));
                setTaxConfigurations(
                    taxItems
                        .filter((tax: any) => tax.is_active)
                        .map((tax: any) => ({
                            value: tax.id.toString(),
                            label: `${tax.tax_name} (${tax.tax_code})`,
                        })),
                );
                setUomOptions(
                    uomItems
                        .filter((uom: any) => uom.is_active)
                        .map((uom: any) => ({
                            value: uom.abbreviation || uom.name,
                            label: uom.abbreviation ? `${uom.name} (${uom.abbreviation})` : uom.name,
                        })),
                );
                setUomMeasureOptions(
                    uomItems
                        .filter((uom: any) => uom.is_active)
                        .map((uom: any) => ({
                            value: String(uom.id),
                            label: uom.abbreviation ? `${uom.name} (${uom.abbreviation})` : uom.name,
                        })),
                );
                setBranches(branchItems);
                setBranchAvailability(Object.fromEntries(branchItems.map((branch: any) => [branch.id, true])));

                if (isEdit) {
                    const p = await catalogApi.getProduct(id);
                    if (p) {
                        setName(p.product_name);
                        setCode(p.product_code || '');
                        setDescription(p.product_description || '');
                        setSku(p.product_sku || '');
                        setImageUrl(p.product_image_url || '');
                        setBasePrice(String(p.product_base_price ?? 0));
                        setServingTime(String(p.serving_time ?? 20));
                        setCategoryId(p.category_id?.toString() || '');
                        setCuisineId(p.cuisine_type_id?.toString() || '');
                        setStationId(p.production_station_id?.toString() || '');
                        setBaseUomId(p.base_uom_id?.toString() || '');
                        setTaxConfigurationId(p.tax_configuration_id?.toString() || '');
                        setAllowOpenOrderReturn(Boolean(p.allow_open_order_return));
                        setIsActive(p.is_active);
                        setIsBranchActive(p.is_branch_active !== undefined ? p.is_branch_active : true);
                        setDistributionScope(p.distribution_scope || 'all');
                        setRecipeCostSummary(p.recipe_cost_summary || null);
                        if (p.branch_availability) {
                            setBranchAvailability(
                                Object.fromEntries(
                                    p.branch_availability.map((item: any) => [item.branch_id, !!item.is_enabled]),
                                ),
                            );
                        }
                        if (p.customizations) {
                            setCustomizations(p.customizations.map((c: any) => ({
                                id: c.id,
                                type: c.customization_type,
                                value: c.customization_value,
                                price_delta: c.customization_price_delta,
                                is_required: c.customization_is_required
                            })));
                        }
                    }

                    const linkedRecipes = await recipeApi.getRecipesByProduct(id);
                    setRecipes(linkedRecipes);
                }

            } catch (err) {
                console.error('Failed fetching data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, isEdit]);

    const addCustomization = () => {
        setCustomizations([...customizations, {
            id: Date.now(),
            type: '',
            value: '',
            price_delta: 0,
            is_required: false
        }]);
    };

    const removeCustomization = (id: number) => {
        setCustomizations(customizations.filter(c => c.id !== id));
    };

    const updateCustomization = (id: number, field: string, val: any) => {
        setCustomizations(customizations.map(c => c.id === id ? { ...c, [field]: val } : c));
    };

    const formatCurrency = (value: number | null | undefined) => `PKR ${Number(value || 0).toFixed(2)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const servingTimeMinutes = Number(servingTime);
        if (!Number.isInteger(servingTimeMinutes) || servingTimeMinutes <= 0) {
            toast.error('Invalid Serving Time', 'Please enter serving time in minutes.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                product_name: name,
                product_code: code,
                product_description: description,
                product_sku: sku.trim() || undefined,
                product_image_url: imageUrl.trim() || undefined,
                product_base_price: Number(basePrice || 0),
                serving_time: servingTimeMinutes,
                category_id: categoryId ? Number(categoryId) : undefined,
                cuisine_type_id: cuisineId ? Number(cuisineId) : undefined,
                production_station_id: stationId ? Number(stationId) : undefined,
                base_uom_id: baseUomId ? Number(baseUomId) : undefined,
                tax_configuration_id: taxConfigurationId ? Number(taxConfigurationId) : undefined,
                allow_open_order_return: allowOpenOrderReturn,
                is_active: isActive,
                is_branch_active: isBranchActive,
                distribution_scope: distributionScope,
                branch_availability: branches.map((branch: any) => ({
                    branch_id: branch.id,
                    is_enabled: branchAvailability[branch.id] ?? (distributionScope === 'all'),
                })),
                customizations: customizations.map(({ type, value, price_delta, is_required }) => ({
                    type,
                    value,
                    price_delta: Number(price_delta),
                    is_required
                }))
            };

            if (isEdit) {
                await catalogApi.updateProduct(id, payload);
                toast.success('Success', 'Product updated successfully');
            } else {
                await catalogApi.createProduct(payload);
                toast.success('Success', 'Product created successfully');
            }
            navigate('/products');
        } catch (err: any) {
            console.error('Failed to save product', err);
            toast.error('Save Failed', err.message || 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <button
                        className={styles.backButton}
                        onClick={() => navigate('/products')}
                        type="button"
                        aria-label="Back to products"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h1>{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
                        <p className={styles.helpText}>Configure master catalog item and its properties</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" size="sm" onClick={() => navigate('/products')} type="button">Discard</KitchenButton>
                    <KitchenButton type="submit" size="sm" isLoading={isSaving} disabled={isSaving || isLoading || !name || !categoryId}>
                        <Save size={16} style={{ marginRight: '6px' }} />
                        {isEdit ? 'Sync Changes' : 'Create Product'}
                    </KitchenButton>
                </div>
            </header>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '128px' }}>
                    <Loader2 size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
                </div>
            ) : (
                <div className={styles.formGrid}>
                    <div className={styles.mainColumn}>
                        <KitchenCard>
                            <div className={styles.sectionSeparator}>
                                <Info size={14} />
                                <span>Main Identity</span>
                                <div className={styles.separatorLine}></div>
                            </div>
                            <div className={styles.row}>
                                <KitchenInput
                                    label="Product Name"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Classic Beef Burger"
                                    className={styles.fullWidth}
                                />
                                <KitchenInput
                                    label="Internal Code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="e.g. PRD-001"
                                />
                                <KitchenInput
                                    label="Short Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief menu description"
                                />
                                <KitchenInput
                                    label="SKU"
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                    placeholder="e.g. BGR-001"
                                />
                                <KitchenInput
                                    label="Base Price"
                                    type="number"
                                    value={basePrice}
                                    onChange={(e) => setBasePrice(e.target.value)}
                                    placeholder="0.00"
                                />
                                <KitchenInput
                                    label="Serving Time (Minutes)"
                                    type="number"
                                    value={servingTime}
                                    onChange={(e) => setServingTime(e.target.value)}
                                    placeholder="20"
                                    min="1"
                                    step="1"
                                    helpText="Time required from order placement to serving table, in minutes."
                                />
                            </div>

                            <div className={styles.sectionSeparator}>
                                <Layers size={14} />
                                <span>Catalog Placement</span>
                                <div className={styles.separatorLine}></div>
                            </div>
                            <div className={styles.row}>
                                <KitchenSelect
                                    label="Master Category"
                                    required
                                    options={[{ value: '', label: 'Select Category' }, ...categories]}
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                />
                                <KitchenSelect
                                    label="Cuisine Influence"
                                    options={[{ value: '', label: 'Select Cuisine' }, ...cuisines]}
                                    value={cuisineId}
                                    onChange={(e) => setCuisineId(e.target.value)}
                                />
                                <KitchenSelect
                                    label="Prep Station"
                                    required
                                    options={[{ value: '', label: 'Route to Station' }, ...stations]}
                                    value={stationId}
                                    onChange={(e) => setStationId(e.target.value)}
                                />
                                <KitchenSelect
                                    label="Base UOM"
                                    options={[{ value: '', label: 'Select UOM' }, ...uomMeasureOptions]}
                                    value={baseUomId}
                                    onChange={(e) => setBaseUomId(e.target.value)}
                                />
                                <KitchenSelect
                                    label="Tax Profile"
                                    options={[{ value: '', label: 'No product tax profile' }, ...taxConfigurations]}
                                    value={taxConfigurationId}
                                    onChange={(e) => setTaxConfigurationId(e.target.value)}
                                />
                            </div>
                        </KitchenCard>

                        <KitchenCard title="Serving Sizes Available"
                            extra={<KitchenButton variant="secondary" size="sm" onClick={addCustomization} type="button"><Plus size={14} /> Add Variant</KitchenButton>}
                        >
                            <div className={styles.variantIntro}>
                                <span>Define serving sizes and labels for this product.</span>
                                <span>Use the remove action on any row to delete that serving size before saving.</span>
                            </div>
                            <div className={styles.customizationHeader}>
                                <span>Portion</span>
                                <span>Label</span>
                                <span>Price Delta</span>
                                <span>Req?</span>
                                <span></span>
                            </div>
                            <div className={styles.customizationList}>
                                {customizations.length === 0 ? (
                                    <p className={styles.emptyCustomization}>No serving sizes configured.</p>
                                ) : (
                                    customizations.map((c) => (
                                        <div key={c.id} className={styles.customizationRow}>
                                            <KitchenSelect
                                                options={[{ value: '', label: 'Select UOM' }, ...uomOptions]}
                                                value={c.type}
                                                onChange={(e) => updateCustomization(c.id, 'type', e.target.value)}
                                            />
                                            <KitchenInput
                                                placeholder="e.g. 250"
                                                value={c.value}
                                                onChange={(e) => updateCustomization(c.id, 'value', e.target.value)}
                                            />
                                            <KitchenInput
                                                type="number"
                                                placeholder="0.00"
                                                value={c.price_delta}
                                                onChange={(e) => updateCustomization(c.id, 'price_delta', e.target.value)}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.customCheckbox}
                                                    checked={c.is_required}
                                                    onChange={(e) => updateCustomization(c.id, 'is_required', e.target.checked)}
                                                />
                                            </div>
                                            <KitchenButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeCustomization(c.id)}
                                                type="button"
                                                className={styles.removeVariantButton}
                                                title="Delete serving size"
                                            >
                                                <Trash2 size={14} />
                                                <span>Remove</span>
                                            </KitchenButton>
                                        </div>
                                    ))
                                )}
                            </div>
                        </KitchenCard>

                        <KitchenCard title="Linked Production Recipes" extra={
                            <KitchenButton variant="outline" size="sm" onClick={() => navigate('/console/recipes/new')} type="button">
                                <Plus size={14} /> New Blueprint
                            </KitchenButton>
                        }>
                            <div className={styles.recipeList}>
                                {recipes.length === 0 ? (
                                    <div className={styles.recipeText}>
                                        <p>No operational recipes linked.</p>
                                    </div>
                                ) : (
                                    <div className={styles.recipesGrid}>
                                        {recipes.map(recipe => (
                                            <div key={recipe.id} className={styles.recipeItem} onClick={() => navigate(`/console/recipes/${recipe.id}`)}>
                                                <div className={styles.recipeInfo}>
                                                    <span className={styles.recipeName}>{recipe.recipe_name}</span>
                                                    <span className={styles.recipeYield}>Yield: {recipe.yield_quantity} {recipe.yield_uom}</span>
                                                    {recipe.cost_summary && (
                                                        <span className={styles.recipeCostMeta}>
                                                            {formatCurrency(recipe.cost_summary.cost_per_yield_unit)} per yield unit
                                                            {' • '}
                                                            {formatCurrency(recipe.cost_summary.margin_amount)} margin
                                                        </span>
                                                    )}
                                                </div>
                                                <Layout size={16} style={{ opacity: 0.5 }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.sideColumn}>
                        <KitchenCard title="Visibility & Scope">
                            <div className={styles.statusGroup}>
                                <div className={styles.statusToggle}>
                                    <label>Open-Order Return</label>
                                    <div className={styles.toggleContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.customCheckbox}
                                            id="allow-open-order-return-toggle"
                                            checked={allowOpenOrderReturn}
                                            onChange={(e) => setAllowOpenOrderReturn(e.target.checked)}
                                        />
                                        <span className={styles.toggleLabel}>{allowOpenOrderReturn ? 'Allowed Until Order Closes' : 'Standard Line Rules Only'}</span>
                                    </div>
                                </div>

                                <div className={styles.statusToggle}>
                                    <label>Global Lifecycle</label>
                                    <div className={styles.toggleContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.customCheckbox}
                                            id="status-toggle"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                        />
                                        <span className={styles.toggleLabel}>{isActive ? 'System Active' : 'Suspended'}</span>
                                    </div>
                                </div>

                                <div className={styles.statusToggle}>
                                    <label>Local Availability</label>
                                    <div className={styles.toggleContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.customCheckbox}
                                            id="branch-status-toggle"
                                            checked={isBranchActive}
                                            onChange={(e) => setIsBranchActive(e.target.checked)}
                                        />
                                        <span className={styles.toggleLabel}>{isBranchActive ? 'Store Available' : 'Hidden'}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px' }}>
                                <KitchenSelect
                                    label="Distribution Scope"
                                    options={[
                                        { value: 'all', label: 'All branches by default' },
                                        { value: 'selected', label: 'Selected branches only' },
                                    ]}
                                    value={distributionScope}
                                    onChange={(e) => setDistributionScope(e.target.value as 'all' | 'selected')}
                                />
                            </div>
                            <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Product distribution by branch
                                </div>
                                {branches.map((branch: any) => {
                                    const checked = distributionScope === 'all'
                                        ? branchAvailability[branch.id] ?? true
                                        : !!branchAvailability[branch.id];

                                    return (
                                        <label
                                            key={branch.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '12px',
                                                padding: '10px 12px',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{branch.branch_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {distributionScope === 'all'
                                                        ? 'Starts enabled everywhere. Turn off only branches that should not sell it.'
                                                        : 'Enable only the branches that should receive this product.'}
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className={styles.customCheckbox}
                                                checked={checked}
                                                onChange={(e) =>
                                                    setBranchAvailability((prev) => ({
                                                        ...prev,
                                                        [branch.id]: e.target.checked,
                                                    }))
                                                }
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </KitchenCard>

                        <KitchenCard title="Brand Asset">
                            <div className={styles.imageUpload}>
                                <div className={styles.imagePlaceholder}>
                                    <ImageIcon size={32} strokeWidth={1} />
                                    <span>Display Image</span>
                                </div>
                                <KitchenInput
                                    label="Global Asset Link"
                                    placeholder="URL to dish photography"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                />
                            </div>
                        </KitchenCard>

                        <KitchenCard title="Recipe Costing">
                            {recipeCostSummary?.selected_recipe_id ? (
                                <div className={styles.costSummaryStack}>
                                    <div className={styles.costMetric}>
                                        <span>Primary Recipe</span>
                                        <strong>{recipeCostSummary.selected_recipe_name}</strong>
                                    </div>
                                    <div className={styles.costMetric}>
                                        <span>Recipe Cost / Unit</span>
                                        <strong>{formatCurrency(recipeCostSummary.cost_per_yield_unit)}</strong>
                                    </div>
                                    <div className={styles.costMetric}>
                                        <span>Base Margin</span>
                                        <strong className={(recipeCostSummary.margin_amount ?? 0) >= 0 ? styles.marginPositive : styles.marginNegative}>
                                            {formatCurrency(recipeCostSummary.margin_amount)} ({Number(recipeCostSummary.margin_percentage || 0).toFixed(1)}%)
                                        </strong>
                                    </div>
                                    <div className={styles.costMetric}>
                                        <span>Cost Status</span>
                                        <strong>{recipeCostSummary.cost_status}</strong>
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.helpText}>
                                    Link an operational recipe to surface cost and margin visibility here.
                                </p>
                            )}
                        </KitchenCard>

                        <div style={{
                            background: 'var(--accent-primary-alpha)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-sm)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Globe size={18} color="var(--accent-primary)" />
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Catalog Sync</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                This item will be automatically synchronized with all active sales channels and branch registers upon saving.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
