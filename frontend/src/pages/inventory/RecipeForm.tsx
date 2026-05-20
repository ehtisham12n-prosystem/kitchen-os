import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    ArrowLeft, Save, Plus, Trash2,
    ImageIcon, Calendar, Clock, Info, BookOpen, ChefHat, Scale,
} from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { recipeApi, catalogApi, inventoryApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './RecipeForm.module.css';

interface RecipeIngredient {
    id: string;
    item_id: number;
    quantity: number;
    uom: string;
    wastage_percentage: number;
}

const EMPTY_INGREDIENT = (): RecipeIngredient => ({
    id: `${Date.now()}-${Math.random()}`,
    item_id: 0,
    quantity: 1,
    uom: '',
    wastage_percentage: 0,
});

export function RecipeForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isNew = !id || id === 'new';
    const access = usePermissionAccess();
    const canManageRecipe = access.hasAnyPermission([
        APP_PERMISSIONS.CATALOG.WRITE,
        APP_PERMISSIONS.CATALOG.RECIPE_WRITE,
    ]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    const [recipeName, setRecipeName] = useState('');
    const [productId, setProductId] = useState<number | ''>('');
    const [yieldQty, setYieldQty] = useState(1);
    const [yieldUom, setYieldUom] = useState('portion');
    const [isActive, setIsActive] = useState(true);
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState('');
    const [servesPeople, setServesPeople] = useState(1);
    const [imageUrl, setImageUrl] = useState('');
    const [preparedBy, setPreparedBy] = useState('');
    const [audit, setAudit] = useState<{ createdAt?: string; updatedAt?: string }>({});
    const [costSummary, setCostSummary] = useState<any | null>(null);
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([EMPTY_INGREDIENT()]);

    useEffect(() => {
        const loadMasterData = async () => {
            setIsLoading(true);
            try {
                const [pData, hierarchy] = await Promise.all([
                    catalogApi.getProducts(),
                    inventoryApi.getHierarchy(),
                ]);
                setProducts(pData);

                const flattened: any[] = [];
                hierarchy.forEach((cls: any) => {
                    cls.types?.forEach((type: any) => {
                        type.subTypes?.forEach((subType: any) => {
                            subType.items?.forEach((item: any) => flattened.push(item));
                        });
                    });
                });
                setInventoryItems(flattened);

                if (!isNew && id) {
                    const recipe = await recipeApi.getRecipe(id);
                    setRecipeName(recipe.recipe_name || '');
                    setProductId(recipe.product_id || '');
                    setYieldQty(Number(recipe.yield_quantity || 1));
                    setYieldUom(recipe.yield_uom || 'portion');
                    setIsActive(recipe.is_active ?? true);
                    setDescription(recipe.description || '');
                    setMethod(recipe.preparation_method || '');
                    setServesPeople(Number(recipe.serves_people || 1));
                    setImageUrl(recipe.image_url || '');
                    setPreparedBy(recipe.prepared_by || '');
                    setAudit({
                        createdAt: recipe.created_at,
                        updatedAt: recipe.updated_at,
                    });
                    setCostSummary(recipe.cost_summary || null);

                    if (recipe.ingredients?.length) {
                        setIngredients(recipe.ingredients.map((ingredient: any) => ({
                            id: String(ingredient.id),
                            item_id: ingredient.item_id,
                            quantity: Number(ingredient.quantity),
                            uom: ingredient.uom || ingredient.item?.uom_base || '',
                            wastage_percentage: Number(ingredient.wastage_percentage || 0),
                        })));
                    }
                }
            } catch (error) {
                console.error('Failed to load recipe data', error);
                toast.error('Recipes', 'Could not load recipe data.');
            } finally {
                setIsLoading(false);
            }
        };

        void loadMasterData();
    }, [id, isNew]);

    const productOptions = useMemo(
        () => products.map((product) => ({ value: String(product.id), label: product.product_name })),
        [products],
    );

    const inventoryOptions = useMemo(
        () => inventoryItems.map((item) => ({ value: String(item.id), label: item.item_name })),
        [inventoryItems],
    );

    const formatCurrency = (value: number | null | undefined) => `PKR ${Number(value || 0).toFixed(2)}`;

    const updateIngredient = (ingredientId: string, field: keyof RecipeIngredient, value: any) => {
        setIngredients((prev) => prev.map((ingredient) => {
            if (ingredient.id !== ingredientId) {
                return ingredient;
            }

            if (field === 'item_id') {
                const selectedItem = inventoryItems.find((item) => item.id === Number(value));
                return {
                    ...ingredient,
                    item_id: Number(value),
                    uom: selectedItem?.uom_base || '',
                };
            }

            return {
                ...ingredient,
                [field]: value,
            };
        }));
    };

    const handleAddIngredient = () => {
        setIngredients((prev) => [...prev, EMPTY_INGREDIENT()]);
    };

    const handleRemoveIngredient = (ingredientId: string) => {
        setIngredients((prev) => prev.length > 1 ? prev.filter((ingredient) => ingredient.id !== ingredientId) : prev);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!canManageRecipe) {
            toast.error('Recipes', 'You do not have permission to change recipe blueprints.');
            return;
        }

        const usableIngredients = ingredients.filter((ingredient) => ingredient.item_id > 0);
        if (!productId || !recipeName.trim() || usableIngredients.length === 0) {
            toast.error('Recipes', 'Product, recipe name, and at least one ingredient are required.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                product_id: Number(productId),
                recipe_name: recipeName.trim(),
                yield_quantity: Number(yieldQty || 1),
                yield_uom: yieldUom,
                is_active: isActive,
                description: description.trim() || undefined,
                preparation_method: method.trim() || undefined,
                serves_people: Number(servesPeople || 1),
                image_url: imageUrl.trim() || undefined,
                prepared_by: preparedBy.trim() || undefined,
                ingredients: usableIngredients.map((ingredient) => ({
                    item_id: ingredient.item_id,
                    quantity: Number(ingredient.quantity),
                    uom: ingredient.uom || undefined,
                    wastage_percentage: Number(ingredient.wastage_percentage || 0),
                })),
            };

            if (isNew) {
                await recipeApi.createRecipe(payload);
                toast.success('Recipes', 'Recipe blueprint created.');
            } else {
                await recipeApi.updateRecipe(id!, payload);
                toast.success('Recipes', 'Recipe blueprint updated.');
            }

            navigate('/recipes');
        } catch (error: any) {
            console.error('Failed to save recipe', error);
            toast.error('Recipes', error.message || 'Could not save recipe blueprint.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
                <ChefHat size={48} className="float" style={{ color: 'var(--accent-primary)' }} />
                <p style={{ color: 'var(--text-secondary)', letterSpacing: '2px', fontSize: '12px', fontWeight: 600 }}>LOADING RECIPE BLUEPRINT...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/recipes')} type="button">
                        <ArrowLeft size={22} />
                    </button>
                    <div className={styles.headerTitle}>
                        <h1>{isNew ? 'New Production Blueprint' : 'Edit Recipe Revision'}</h1>
                        <p>{isNew ? 'Link finished products to raw materials and yield rules.' : `Revisioning: ${recipeName}`}</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.toggleWrapper}>
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className={styles.toggleInput}
                            disabled={!canManageRecipe}
                        />
                        <span className={styles.toggleText}>{isActive ? 'Blueprint Active' : 'Draft Mode'}</span>
                    </div>
                    <KitchenButton variant="secondary" onClick={() => navigate('/recipes')} type="button">Discard</KitchenButton>
                    <KitchenButton variant="primary" onClick={handleSubmit} isLoading={isSaving} disabled={!canManageRecipe}>
                        <Save size={18} style={{ marginRight: '8px' }} />
                        {canManageRecipe ? (isNew ? 'Create Blueprint' : 'Save Blueprint') : 'View Only'}
                    </KitchenButton>
                </div>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.mainGrid}>
                    <div className={styles.leftColumn}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Info size={16} className={styles.cardIcon} />
                                <h3>Classification & Global Yield</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.infoGrid}>
                                    <KitchenSelect
                                        label="Target Catalog Item"
                                        options={[{ value: '', label: 'Select Product' }, ...productOptions]}
                                        value={String(productId || '')}
                                        onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
                                        required
                                        disabled={!canManageRecipe}
                                    />
                                    <KitchenInput
                                        label="Blueprint Identity"
                                        placeholder="e.g. Chicken Biryani Standard"
                                        value={recipeName}
                                        onChange={(e) => setRecipeName(e.target.value)}
                                        required
                                        disabled={!canManageRecipe}
                                    />
                                </div>
                                <div className={styles.sectionSeparator}>
                                    <Scale size={14} />
                                    <span>Output Calibration</span>
                                    <div className={styles.separatorLine}></div>
                                </div>
                                <div className={styles.infoGrid}>
                                    <KitchenInput
                                        label="Yield Quantity"
                                        type="number"
                                        value={yieldQty}
                                        onChange={(e) => setYieldQty(Number(e.target.value))}
                                        required
                                        disabled={!canManageRecipe}
                                    />
                                    <KitchenSelect
                                        label="Yield Metric (UOM)"
                                        options={[
                                            { value: 'portion', label: 'Portion(s)' },
                                            { value: 'batch', label: 'Standard Batch' },
                                            { value: 'kg', label: 'Kilogram (Kg)' },
                                            { value: 'liters', label: 'Liter (L)' },
                                        ]}
                                        value={yieldUom}
                                        onChange={(e) => setYieldUom(e.target.value)}
                                        disabled={!canManageRecipe}
                                    />
                                </div>
                            </div>
                        </KitchenCard>

                        <div className={styles.itemsSection}>
                            <div className={styles.sectionSeparator}>
                                <ChefHat size={16} />
                                <span>Bill of Materials (BOM)</span>
                                <div className={styles.separatorLine}></div>
                            </div>

                            <div className={styles.tableContainer}>
                                <div className={styles.tableHeader}>
                                    <div className={styles.th}>BOM#</div>
                                    <div className={styles.th}>Raw Material / Ingredient</div>
                                    <div className={styles.th}>Quantity</div>
                                    <div className={styles.th}>UOM</div>
                                    <div className={styles.th}>Loss %</div>
                                    <div className={styles.th}></div>
                                </div>
                                <div className={styles.itemsList}>
                                    {ingredients.map((ingredient, index) => (
                                        <div key={ingredient.id} className={styles.itemRow}>
                                            <div className={styles.rowIndex}>{index + 1}</div>
                                            <div className={styles.colInput}>
                                                <select
                                                    value={ingredient.item_id}
                                                    onChange={(e) => updateIngredient(ingredient.id, 'item_id', e.target.value)}
                                                    disabled={!canManageRecipe}
                                                >
                                                    <option value="0">Select material...</option>
                                                    {inventoryOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.colInput}>
                                                <input
                                                    type="number"
                                                    value={ingredient.quantity}
                                                    step="0.001"
                                                    onChange={(e) => updateIngredient(ingredient.id, 'quantity', Number(e.target.value))}
                                                    disabled={!canManageRecipe}
                                                />
                                            </div>
                                            <div>
                                                <span className={styles.uomBadge}>{ingredient.uom || 'Unit'}</span>
                                            </div>
                                            <div className={styles.colInput}>
                                                <input
                                                    type="number"
                                                    value={ingredient.wastage_percentage}
                                                    onChange={(e) => updateIngredient(ingredient.id, 'wastage_percentage', Number(e.target.value))}
                                                    disabled={!canManageRecipe}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.removeBtn}
                                                onClick={() => handleRemoveIngredient(ingredient.id)}
                                                disabled={!canManageRecipe || ingredients.length === 1}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <KitchenButton variant="outline" size="sm" onClick={handleAddIngredient} style={{ alignSelf: 'flex-start' }} type="button" disabled={!canManageRecipe}>
                                <Plus size={16} style={{ marginRight: '8px' }} />
                                Add Ingredient
                            </KitchenButton>
                        </div>
                    </div>

                    <div className={styles.sideColumn}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <ImageIcon size={16} className={styles.cardIcon} />
                                <h3>Visual Reference</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.mediaStack}>
                                    <div className={styles.imagePreviewBox}>
                                        {imageUrl ? (
                                            <img src={imageUrl} alt="Recipe Preview" className={styles.previewImg} />
                                        ) : (
                                            <div className={styles.imgPlaceholder}>
                                                <ImageIcon size={48} strokeWidth={1} />
                                                <p>No Image Hooked</p>
                                            </div>
                                        )}
                                    </div>
                                    <KitchenInput
                                        label="Global Asset Link"
                                        placeholder="URL to dish photography"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        disabled={!canManageRecipe}
                                    />
                                    <div className={styles.infoGrid}>
                                        <KitchenInput
                                            label="Prepared By"
                                            value={preparedBy}
                                            onChange={(e) => setPreparedBy(e.target.value)}
                                            placeholder="Chef or standard owner"
                                            disabled={!canManageRecipe}
                                        />
                                        <KitchenInput
                                            label="Serves"
                                            type="number"
                                            value={servesPeople}
                                            onChange={(e) => setServesPeople(Number(e.target.value))}
                                            disabled={!canManageRecipe}
                                        />
                                    </div>
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Clock size={16} className={styles.cardIcon} />
                                <h3>Record Timeline</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.auditGrid}>
                                    <div className={styles.auditItem}>
                                        <span className={styles.auditLabel}>Created</span>
                                        <div className={styles.auditValue}><Calendar size={14} /> {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : 'New record'}</div>
                                    </div>
                                    <div className={styles.auditItem}>
                                        <span className={styles.auditLabel}>Last Updated</span>
                                        <div className={styles.auditValue}><Clock size={14} /> {audit.updatedAt ? new Date(audit.updatedAt).toLocaleString() : 'Not saved yet'}</div>
                                    </div>
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <Scale size={16} className={styles.cardIcon} />
                                <h3>Cost Visibility</h3>
                            </div>
                            <div className={styles.cardContent}>
                                {costSummary ? (
                                    <div className={styles.costStack}>
                                        <div className={styles.costMetric}>
                                            <span>Recipe Cost</span>
                                            <strong>{formatCurrency(costSummary.total_recipe_cost)}</strong>
                                        </div>
                                        <div className={styles.costMetric}>
                                            <span>Cost / Yield Unit</span>
                                            <strong>{formatCurrency(costSummary.cost_per_yield_unit)}</strong>
                                        </div>
                                        <div className={styles.costMetric}>
                                            <span>Selling Price</span>
                                            <strong>{formatCurrency(costSummary.selling_price)}</strong>
                                        </div>
                                        <div className={styles.costMetric}>
                                            <span>Margin</span>
                                            <strong className={(costSummary.margin_amount ?? 0) >= 0 ? styles.marginPositive : styles.marginNegative}>
                                                {formatCurrency(costSummary.margin_amount)} ({Number(costSummary.margin_percentage || 0).toFixed(1)}%)
                                            </strong>
                                        </div>
                                        <div className={styles.costMetric}>
                                            <span>Status</span>
                                            <strong>{costSummary.cost_status}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={styles.costHint}>
                                        Costing appears after the recipe is saved, using the latest inventory cost reference for the active branch when available.
                                    </p>
                                )}
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.editorGrid}>
                        <div className={styles.editorSection}>
                            <div className={styles.editorHeader}>
                                <ChefHat size={18} className={styles.cardIcon} />
                                <h2>Recipe Concept / Profile</h2>
                                <div className={styles.editorDivider}></div>
                            </div>
                            <textarea
                                className={styles.textarea}
                                placeholder="Describe flavor profile, plating intent, or preparation notes..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={!canManageRecipe}
                            />
                        </div>
                        <div className={styles.editorSection}>
                            <div className={styles.editorHeader}>
                                <BookOpen size={18} className={styles.cardIcon} />
                                <h2>Standard Operating Procedure</h2>
                                <div className={styles.editorDivider}></div>
                            </div>
                            <textarea
                                className={styles.textarea}
                                placeholder="1. Prep ingredients...
2. Cook the base...
3. Portion and finish..."
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                disabled={!canManageRecipe}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
