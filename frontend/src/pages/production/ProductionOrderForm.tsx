/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Loader2, Save } from 'lucide-react';
import { branchApi, catalogApi, inventoryApi, productionApi, recipeApi, resolveActiveBranchId } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ProductionOrderForm.module.css';

type BranchOption = {
    id: number;
    branch_name: string;
    branch_code: string;
    is_production_source?: boolean;
    production_source_label?: string | null;
};

type ProductOption = {
    id: number;
    product_name: string;
    product_sku?: string | null;
};

type RecipeOption = {
    id: number;
    recipe_name: string;
    yield_quantity?: number;
    yield_uom?: string | null;
};

type InventoryItemOption = {
    id: number;
    item_name: string;
    item_sku?: string | null;
};

type ProductionOrderRecord = {
    id: number;
    production_no?: string | null;
    status: string;
    flow_label: string;
    is_cross_branch: boolean;
    planned_quantity: number;
    actual_quantity?: number | null;
    production_date?: string | null;
    required_at?: string | null;
    planned_batch_count?: number | null;
    actual_batch_count?: number | null;
    wastage_quantity?: number | null;
    yield_percentage?: number | null;
    materials_issued?: boolean;
    materials_issued_at?: string | null;
    issue_notes?: string | null;
    issued_by_name?: string | null;
    output_stage?: 'semi_prepared' | 'prepared';
    output_stage_label?: string | null;
    source_branch_id: number;
    destination_branch_id: number;
    source_unit_label?: string | null;
    destination_unit_label?: string | null;
    notes?: string | null;
    queue_notes?: string | null;
    completion_notes?: string | null;
    dispatch_notes?: string | null;
    receipt_notes?: string | null;
    variance_notes?: string | null;
    rejection_notes?: string | null;
    cancellation_notes?: string | null;
    requested_at?: string | null;
    queued_at?: string | null;
    start_date?: string | null;
    completion_date?: string | null;
    requested_by_name?: string | null;
    queued_by_name?: string | null;
    completed_by_name?: string | null;
    recipe?: { id: number; recipe_name: string; yield_quantity?: number; yield_uom?: string | null } | null;
    product?: { product_name: string; product_sku?: string | null } | null;
    prepared_item?: { item_name: string; item_sku?: string | null; uom_base?: string | null } | null;
    materials?: Array<{
        id: number;
        item_name: string;
        item_sku?: string | null;
        uom: string;
        planned_quantity: number;
        issued_quantity: number;
        wastage_percentage?: number;
        unit_cost?: number;
        extended_cost?: number;
    }>;
    material_summary?: {
        line_count: number;
        total_issued_quantity: number;
        total_consumed_cost: number;
        output_unit_cost: number;
    } | null;
    batch_summary?: {
        planned_batch_count: number;
        actual_batch_count?: number | null;
        completed_batch_count: number;
        total_actual_quantity: number;
        total_wastage_quantity: number;
        yield_percentage?: number | null;
    } | null;
    batches?: Array<{
        id: number;
        batch_no: string;
        batch_sequence: number;
        planned_quantity: number;
        actual_quantity: number;
        wastage_quantity: number;
        yield_percentage?: number | null;
        notes?: string | null;
        completed_at?: string | null;
    }>;
    linked_transfer?: { transfer_no: string; status: string } | null;
    available_actions: string[];
};

type CompletionBatchInput = {
    id: string;
    batchNo: string;
    actualQuantity: string;
    wastageQuantity: string;
    notes: string;
};

function flattenHierarchy(hierarchy: any[]): InventoryItemOption[] {
    const items: InventoryItemOption[] = [];
    hierarchy.forEach((inventoryClass) => {
        inventoryClass.types?.forEach((type: any) => {
            type.subTypes?.forEach((subType: any) => {
                subType.items?.forEach((item: any) => {
                    items.push({
                        id: item.id,
                        item_name: item.item_name,
                        item_sku: item.item_sku,
                    });
                });
            });
        });
    });
    return items.sort((a, b) => a.item_name.localeCompare(b.item_name));
}

function formatDateTime(value?: string | null) {
    if (!value) return 'Pending';
    return new Date(value).toLocaleString();
}

function formatQty(value?: number | null) {
    return Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 4 });
}

function statusClass(status: string) {
    if (status === 'requested') return styles.badgeRequested;
    if (status === 'queued') return styles.badgeQueued;
    if (status === 'in_preparation') return styles.badgeInPreparation;
    if (status === 'prepared') return styles.badgePrepared;
    if (status === 'dispatched') return styles.badgeDispatched;
    if (status === 'received') return styles.badgeReceived;
    if (status === 'rejected' || status === 'cancelled') return styles.badgeClosed;
    return styles.badgeNeutral;
}

function buildCompletionBatches(record?: ProductionOrderRecord | null): CompletionBatchInput[] {
    if (record?.batches?.length) {
        return record.batches.map((batch) => ({
            id: String(batch.id),
            batchNo: batch.batch_no,
            actualQuantity: String(batch.actual_quantity || 0),
            wastageQuantity: String(batch.wastage_quantity || 0),
            notes: batch.notes || '',
        }));
    }

    const count = Math.max(1, Number(record?.planned_batch_count || 1));
    return Array.from({ length: count }, (_, index) => ({
        id: `batch-${index + 1}`,
        batchNo: `${record?.production_no || 'PROD'}-B${String(index + 1).padStart(2, '0')}`,
        actualQuantity: index === 0 ? String(record?.planned_quantity || '') : '',
        wastageQuantity: '0',
        notes: '',
    }));
}

export function ProductionOrderForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const isDetailMode = Boolean(id);
    const queryBranchId = searchParams.get('branch_id') || resolveActiveBranchId() || '';

    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [recipes, setRecipes] = useState<RecipeOption[]>([]);
    const [preparedItems, setPreparedItems] = useState<InventoryItemOption[]>([]);
    const [record, setRecord] = useState<ProductionOrderRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [sourceBranchId, setSourceBranchId] = useState('');
    const [destinationBranchId, setDestinationBranchId] = useState('');
    const [productId, setProductId] = useState('');
    const [recipeId, setRecipeId] = useState('');
    const [preparedItemId, setPreparedItemId] = useState('');
    const [outputStage, setOutputStage] = useState<'semi_prepared' | 'prepared'>('prepared');
    const [plannedQuantity, setPlannedQuantity] = useState('1');
    const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
    const [requiredAt, setRequiredAt] = useState('');
    const [plannedBatchCount, setPlannedBatchCount] = useState('1');
    const [sourceUnitLabel, setSourceUnitLabel] = useState('');
    const [destinationUnitLabel, setDestinationUnitLabel] = useState('');
    const [notes, setNotes] = useState('');

    const [decisionNotes, setDecisionNotes] = useState('');
    const [completionQuantity, setCompletionQuantity] = useState('');
    const [completionWastageQuantity, setCompletionWastageQuantity] = useState('0');
    const [completionNotes, setCompletionNotes] = useState('');
    const [completionBatches, setCompletionBatches] = useState<CompletionBatchInput[]>(buildCompletionBatches(null));
    const [dispatchQuantity, setDispatchQuantity] = useState('');
    const [dispatchNotes, setDispatchNotes] = useState('');
    const [receivedQuantity, setReceivedQuantity] = useState('');
    const [shortQuantity, setShortQuantity] = useState('0');
    const [damagedQuantity, setDamagedQuantity] = useState('0');
    const [varianceReason, setVarianceReason] = useState('');
    const [receiptNotes, setReceiptNotes] = useState('');
    const [varianceNotes, setVarianceNotes] = useState('');

    const sourceBranchOptions = useMemo(
        () => branches.filter((branch) => branch.is_production_source),
        [branches],
    );

    const loadPage = useCallback(async () => {
        setIsLoading(true);
        try {
            const [branchData, productData, hierarchy] = await Promise.all([
                branchApi.getBranches(),
                catalogApi.getProducts(),
                inventoryApi.getHierarchy(),
            ]);

            setBranches(branchData);
            setProducts(productData);
            setPreparedItems(flattenHierarchy(hierarchy));

            if (isDetailMode && id) {
                const detail = await productionApi.getOrder(id, queryBranchId || undefined);
                setRecord(detail);
                setRecipeId(detail.recipe?.id ? String(detail.recipe.id) : '');
                setOutputStage(detail.output_stage || 'prepared');
                setCompletionQuantity(String(detail.actual_quantity || detail.planned_quantity || ''));
                setCompletionWastageQuantity(String(detail.wastage_quantity || 0));
                setCompletionNotes(detail.completion_notes || '');
                setCompletionBatches(buildCompletionBatches(detail));
                setDispatchQuantity(String(detail.actual_quantity || detail.planned_quantity || ''));
                setDispatchNotes(detail.dispatch_notes || '');
                setReceivedQuantity(String(detail.actual_quantity || detail.planned_quantity || ''));
                setReceiptNotes(detail.receipt_notes || '');
                setVarianceNotes(detail.variance_notes || '');
            } else {
                const preferredSource = searchParams.get('source_branch_id')
                    || queryBranchId
                    || String(branchData.find((branch: BranchOption) => branch.is_production_source)?.id || '');
                setSourceBranchId(preferredSource);
                setDestinationBranchId(preferredSource);
                const branch = branchData.find((item: BranchOption) => String(item.id) === preferredSource);
                setSourceUnitLabel(branch?.production_source_label || branch?.branch_name || '');
                setDestinationUnitLabel(branch?.branch_name || '');
                setCompletionBatches(buildCompletionBatches(null));
            }
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load production data.');
            if (isDetailMode) {
                navigate('/console/production');
            }
        } finally {
            setIsLoading(false);
        }
    }, [id, isDetailMode, navigate, queryBranchId, searchParams]);

    useEffect(() => {
        void loadPage();
    }, [loadPage]);

    useEffect(() => {
        if (isDetailMode || !productId) {
            setRecipes([]);
            return;
        }

        let cancelled = false;
        const loadRecipes = async () => {
            try {
                const data = await recipeApi.getRecipesByProduct(Number(productId));
                if (cancelled) return;
                setRecipes(data);
                setRecipeId((current) => {
                    if (current && data.some((recipe: RecipeOption) => String(recipe.id) === current)) {
                        return current;
                    }
                    return data.length === 1 ? String(data[0].id) : '';
                });
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load production recipes', error);
                    setRecipes([]);
                    setRecipeId('');
                }
            }
        };

        loadRecipes();
        return () => {
            cancelled = true;
        };
    }, [productId, isDetailMode]);

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        const quantity = Number(plannedQuantity);
        if (!sourceBranchId || !destinationBranchId || !productId) {
            toast.error('Validation Error', 'Select source, destination, and product.');
            return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            toast.error('Validation Error', 'Planned quantity must be greater than zero.');
            return;
        }
        if (preparedItemId === '' && outputStage === 'semi_prepared') {
            toast.error('Validation Error', 'Semi-prepared output requires a prepared inventory item link.');
            return;
        }
        if (sourceBranchId !== destinationBranchId && !preparedItemId) {
            toast.error('Validation Error', 'Prepared inventory item is required for cross-branch dispatch.');
            return;
        }

        setIsSaving(true);
        try {
            const created = await productionApi.createOrder({
                source_branch_id: Number(sourceBranchId),
                destination_branch_id: Number(destinationBranchId),
                product_id: Number(productId),
                recipe_id: recipeId ? Number(recipeId) : undefined,
                prepared_item_id: preparedItemId ? Number(preparedItemId) : undefined,
                output_stage: preparedItemId ? outputStage : undefined,
                planned_quantity: quantity,
                production_date: productionDate || undefined,
                required_at: requiredAt || undefined,
                planned_batch_count: Number(plannedBatchCount || 1),
                source_unit_label: sourceUnitLabel || undefined,
                destination_unit_label: destinationUnitLabel || undefined,
                notes: notes || undefined,
            }) as { id: number };
            toast.success('Created', `Production request #${created.id} created.`);
            navigate(`/console/production/${created.id}?branch_id=${sourceBranchId}`);
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not create the production request.');
        } finally {
            setIsSaving(false);
        }
    };

    const runAction = async (action: 'queue' | 'issue' | 'reject' | 'cancel' | 'start' | 'complete' | 'dispatch' | 'receive') => {
        if (!record) return;
        setIsSaving(true);
        try {
            if (action === 'queue') {
                await productionApi.queueOrder(record.id, { notes: decisionNotes || undefined }, record.source_branch_id);
            } else if (action === 'issue') {
                await productionApi.issueOrder(record.id, { notes: decisionNotes || undefined }, record.source_branch_id);
            } else if (action === 'reject') {
                await productionApi.rejectOrder(record.id, { notes: decisionNotes || undefined }, record.source_branch_id);
            } else if (action === 'cancel') {
                await productionApi.cancelOrder(record.id, { notes: decisionNotes || undefined }, record.source_branch_id);
            } else if (action === 'start') {
                await productionApi.startOrder(record.id, record.source_branch_id);
            } else if (action === 'complete') {
                await productionApi.completeOrder(record.id, {
                    actual_quantity: Number(completionQuantity),
                    wastage_quantity: Number(completionWastageQuantity || 0),
                    notes: completionNotes || undefined,
                    batches: completionBatches
                        .filter((batch) => Number(batch.actualQuantity || 0) > 0 || Number(batch.wastageQuantity || 0) > 0)
                        .map((batch) => ({
                            batch_no: batch.batchNo || undefined,
                            actual_quantity: Number(batch.actualQuantity || 0),
                            wastage_quantity: Number(batch.wastageQuantity || 0),
                            notes: batch.notes || undefined,
                        })),
                }, record.source_branch_id);
            } else if (action === 'dispatch') {
                await productionApi.dispatchOrder(record.id, {
                    dispatch_quantity: Number(dispatchQuantity),
                    notes: dispatchNotes || undefined,
                }, record.source_branch_id);
            } else if (action === 'receive') {
                await productionApi.receiveOrder(record.id, {
                    received_quantity: Number(receivedQuantity),
                    short_quantity: Number(shortQuantity || 0),
                    damaged_quantity: Number(damagedQuantity || 0),
                    variance_reason: varianceReason || undefined,
                    notes: receiptNotes || undefined,
                    variance_notes: varianceNotes || undefined,
                }, record.destination_branch_id);
            }
            toast.success('Updated', `Production order #${record.id} updated.`);
            await loadPage();
        } catch (error: any) {
            toast.error('Action Failed', error.message || 'Could not update the production order.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingState}>
                <Loader2 className={styles.spinner} />
                <p>Loading production flow...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate('/console/production')}>
                        <ArrowLeft size={18} />
                    </KitchenButton>
                    <div>
                        <h1>{isDetailMode ? (record?.production_no || `Production Request #${record?.id}`) : 'New Kitchen Production Request'}</h1>
                        <p>{isDetailMode ? 'Handle prep, dispatch, and receipt from one branch-safe screen.' : 'Create a practical production request with explicit source and destination units.'}</p>
                    </div>
                </div>
                {record ? (
                    <span className={`${styles.badge} ${statusClass(record.status)}`}>
                        {record.status.replace(/_/g, ' ')}
                    </span>
                ) : null}
            </header>

            {!isDetailMode ? (
                <form className={styles.createLayout} onSubmit={handleCreate}>
                    <KitchenCard className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                            <ArrowRightLeft size={18} />
                            <h3>Request Details</h3>
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenSelect
                                label="Source Kitchen / Unit"
                                required
                                value={sourceBranchId}
                                options={[
                                    { value: '', label: 'Select source unit' },
                                    ...sourceBranchOptions.map((branch) => ({
                                        value: String(branch.id),
                                        label: `${branch.production_source_label || branch.branch_name} (${branch.branch_code})`,
                                    })),
                                ]}
                                onChange={(event) => {
                                    setSourceBranchId(event.target.value);
                                    const branch = branches.find((item) => String(item.id) === event.target.value);
                                    setSourceUnitLabel(branch?.production_source_label || branch?.branch_name || '');
                                }}
                            />
                            <KitchenSelect
                                label="Destination Branch / Unit"
                                required
                                value={destinationBranchId}
                                options={[
                                    { value: '', label: 'Select destination unit' },
                                    ...branches.map((branch) => ({
                                        value: String(branch.id),
                                        label: `${branch.branch_name} (${branch.branch_code})`,
                                    })),
                                ]}
                                onChange={(event) => {
                                    setDestinationBranchId(event.target.value);
                                    const branch = branches.find((item) => String(item.id) === event.target.value);
                                    setDestinationUnitLabel(branch?.branch_name || '');
                                }}
                            />
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenSelect
                                label="Menu Product"
                                required
                                value={productId}
                                options={[
                                    { value: '', label: 'Select product' },
                                    ...products.map((product) => ({
                                        value: String(product.id),
                                        label: `${product.product_name}${product.product_sku ? ` (${product.product_sku})` : ''}`,
                                    })),
                                ]}
                                onChange={(event) => setProductId(event.target.value)}
                            />
                            <KitchenSelect
                                label="Recipe"
                                value={recipeId}
                                options={[
                                    { value: '', label: recipes.length > 1 ? 'Select recipe' : recipes.length === 1 ? 'Auto-selected recipe' : 'Use default active recipe if available' },
                                    ...recipes.map((recipe) => ({
                                        value: String(recipe.id),
                                        label: `${recipe.recipe_name}${recipe.yield_quantity ? ` (${recipe.yield_quantity} ${recipe.yield_uom || ''})` : ''}`.trim(),
                                    })),
                                ]}
                                onChange={(event) => setRecipeId(event.target.value)}
                            />
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenSelect
                                label="Prepared Inventory Item"
                                value={preparedItemId}
                                options={[
                                    { value: '', label: sourceBranchId !== destinationBranchId ? 'Select prepared item' : 'Optional for local prep' },
                                    ...preparedItems.map((item) => ({
                                        value: String(item.id),
                                        label: `${item.item_name}${item.item_sku ? ` (${item.item_sku})` : ''}`,
                                    })),
                                ]}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setPreparedItemId(nextValue);
                                    if (!nextValue) {
                                        setOutputStage('prepared');
                                    }
                                }}
                            />
                            <KitchenSelect
                                label="Output Stage"
                                value={outputStage}
                                options={[
                                    { value: 'prepared', label: 'Prepared output' },
                                    { value: 'semi_prepared', label: 'Semi-prepared output' },
                                ]}
                                onChange={(event) => setOutputStage(event.target.value as 'semi_prepared' | 'prepared')}
                            />
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenInput label="Planned Quantity" type="number" min="0.0001" step="0.01" value={plannedQuantity} onChange={(event) => setPlannedQuantity(event.target.value)} required />
                            <KitchenInput label="Production Date" type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} />
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenInput label="Required By" type="datetime-local" value={requiredAt} onChange={(event) => setRequiredAt(event.target.value)} />
                            <KitchenInput label="Planned Batches" type="number" min="1" step="1" value={plannedBatchCount} onChange={(event) => setPlannedBatchCount(event.target.value)} />
                        </div>
                        <div className={styles.gridTwo}>
                            <KitchenInput label="Source Unit Label" value={sourceUnitLabel} onChange={(event) => setSourceUnitLabel(event.target.value)} />
                            <KitchenInput label="Destination Unit Label" value={destinationUnitLabel} onChange={(event) => setDestinationUnitLabel(event.target.value)} />
                        </div>
                        <KitchenInput label="Operational Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                        <div className={styles.actions}>
                            <KitchenButton variant="outline" type="button" onClick={() => navigate('/console/production')}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" type="submit" isLoading={isSaving}>
                                <Save size={18} style={{ marginRight: 8 }} />
                                Create Request
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </form>
            ) : record ? (
                <div className={styles.detailLayout}>
                    <div className={styles.detailMain}>
                        <KitchenCard className={styles.sectionCard}>
                            <div className={styles.summaryGrid}>
                                <div className={styles.summaryBox}>
                                    <span>Product</span>
                                    <strong>{record.product?.product_name || 'Unlinked Product'}</strong>
                                    <small>{record.product?.product_sku || 'No SKU'}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Flow</span>
                                    <strong>{record.flow_label}</strong>
                                    <small>{record.output_stage_label || (record.is_cross_branch ? 'Cross-branch' : 'Local kitchen')}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Plan Date</span>
                                    <strong>{record.production_date ? new Date(record.production_date).toLocaleDateString() : 'Not set'}</strong>
                                    <small>{record.required_at ? `Required ${formatDateTime(record.required_at)}` : 'No required-by time'}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Quantity</span>
                                    <strong>{formatQty(record.planned_quantity)}</strong>
                                    <small>Prepared: {record.actual_quantity ? formatQty(record.actual_quantity) : 'Pending'}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>{record.materials_issued ? 'Materials Issued' : 'Prepared Item'}</span>
                                    <strong>{record.materials_issued ? formatDateTime(record.materials_issued_at) : (record.prepared_item?.item_name || 'Not linked')}</strong>
                                    <small>{record.materials_issued ? (record.issued_by_name || 'Recorded by system') : (record.linked_transfer?.transfer_no || 'No dispatch reference')}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Batches / Yield</span>
                                    <strong>{record.batch_summary?.completed_batch_count || record.actual_batch_count || 0} / {record.batch_summary?.planned_batch_count || record.planned_batch_count || 1}</strong>
                                    <small>
                                        {record.yield_percentage ? `${Number(record.yield_percentage).toLocaleString('en-PK', { maximumFractionDigits: 2 })}% yield` : 'Yield pending'}
                                        {record.wastage_quantity ? ` • Waste ${formatQty(record.wastage_quantity)}` : ''}
                                    </small>
                                </div>
                            </div>
                            <div className={styles.routePanel}>
                                <div>
                                    <span>Source</span>
                                    <strong>{record.source_unit_label || 'Source unit'}</strong>
                                </div>
                                <ArrowRightLeft size={16} />
                                <div>
                                    <span>Destination</span>
                                    <strong>{record.destination_unit_label || 'Destination unit'}</strong>
                                </div>
                            </div>
                            {record.notes ? <div className={styles.noteBanner}>{record.notes}</div> : null}
                        </KitchenCard>

                        <KitchenCard className={styles.sectionCard}>
                            <div className={styles.sectionHeader}>
                                <span>Recipe and Materials</span>
                            </div>
                            <div className={styles.summaryGrid}>
                                <div className={styles.summaryBox}>
                                    <span>Recipe</span>
                                    <strong>{record.recipe?.recipe_name || 'Recipe pending selection'}</strong>
                                    <small>{record.recipe ? `${record.recipe.yield_quantity || 0} ${record.recipe.yield_uom || ''}`.trim() : 'Required before issue'}</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Issue Status</span>
                                    <strong>{record.materials_issued ? 'Issued to Production' : 'Pending Issue'}</strong>
                                    <small>{record.material_summary?.line_count || 0} material lines</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Total Raw Qty</span>
                                    <strong>{formatQty(record.material_summary?.total_issued_quantity || 0)}</strong>
                                    <small>Recipe-linked issue quantity</small>
                                </div>
                                <div className={styles.summaryBox}>
                                    <span>Output Cost</span>
                                    <strong>{formatQty(record.material_summary?.output_unit_cost || 0)}</strong>
                                    <small>Per prepared unit</small>
                                </div>
                            </div>
                            {record.materials?.length ? (
                                <div className={styles.materialList}>
                                    {record.materials.map((line) => (
                                        <div key={line.id} className={styles.materialRow}>
                                            <div>
                                                <strong>{line.item_name}</strong>
                                                <small>{line.item_sku || line.uom}</small>
                                            </div>
                                            <div className={styles.materialMetrics}>
                                                <span>{formatQty(line.issued_quantity)} {line.uom}</span>
                                                <small>Wastage {Number(line.wastage_percentage || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}%</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.noteBanner}>Material lines will appear here once the order is issued to production.</div>
                            )}
                        </KitchenCard>

                        <KitchenCard className={styles.sectionCard}>
                            <div className={styles.sectionHeader}>
                                <span>Action Panel</span>
                            </div>
                            <div className={styles.actionGrid}>
                                {record.available_actions.some((action) => ['queue', 'issue', 'reject', 'cancel'].includes(action)) ? (
                                    <div className={styles.actionBlock}>
                                        <KitchenInput label="Decision Notes" value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} />
                                        <div className={styles.actions}>
                                            {record.available_actions.includes('queue') ? <KitchenButton variant="outline-primary" onClick={() => runAction('queue')} isLoading={isSaving}>Queue</KitchenButton> : null}
                                            {record.available_actions.includes('issue') ? <KitchenButton variant="outline-info" onClick={() => runAction('issue')} isLoading={isSaving}>Issue Materials</KitchenButton> : null}
                                            {record.available_actions.includes('reject') ? <KitchenButton variant="outline-danger" onClick={() => runAction('reject')} isLoading={isSaving}>Reject</KitchenButton> : null}
                                            {record.available_actions.includes('cancel') ? <KitchenButton variant="outline-dark" onClick={() => runAction('cancel')} isLoading={isSaving}>Cancel</KitchenButton> : null}
                                        </div>
                                    </div>
                                ) : null}
                                {record.available_actions.includes('start') ? (
                                    <div className={styles.actionBlock}>
                                        <p>{record.materials_issued ? 'Move this request into active preparation.' : 'Starting prep will auto-issue recipe materials if they are still pending.'}</p>
                                        <KitchenButton variant="outline-info" onClick={() => runAction('start')} isLoading={isSaving}>Start Prep</KitchenButton>
                                    </div>
                                ) : null}
                                {record.available_actions.includes('complete') ? (
                                    <div className={styles.actionBlock}>
                                        <div className={styles.gridTwo}>
                                            <KitchenInput label="Prepared Quantity" type="number" min="0.0001" step="0.01" value={completionQuantity} onChange={(event) => setCompletionQuantity(event.target.value)} />
                                            <KitchenInput label="Wastage Quantity" type="number" min="0" step="0.01" value={completionWastageQuantity} onChange={(event) => setCompletionWastageQuantity(event.target.value)} />
                                        </div>
                                        <KitchenInput label="Completion Notes" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} />
                                        <div className={styles.materialList}>
                                            {completionBatches.map((batch, index) => (
                                                <div key={batch.id} className={styles.materialRow}>
                                                    <div>
                                                        <strong>{batch.batchNo || `Batch ${index + 1}`}</strong>
                                                        <small>Batch preparation record</small>
                                                    </div>
                                                    <div className={styles.materialMetrics}>
                                                        <input
                                                            className={styles.cellInput}
                                                            value={batch.batchNo}
                                                            onChange={(event) => setCompletionBatches((current) => current.map((entry) => entry.id === batch.id ? { ...entry, batchNo: event.target.value } : entry))}
                                                            placeholder="Batch no"
                                                        />
                                                        <input
                                                            className={styles.cellInput}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={batch.actualQuantity}
                                                            onChange={(event) => setCompletionBatches((current) => current.map((entry) => entry.id === batch.id ? { ...entry, actualQuantity: event.target.value } : entry))}
                                                            placeholder="Good qty"
                                                        />
                                                        <input
                                                            className={styles.cellInput}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={batch.wastageQuantity}
                                                            onChange={(event) => setCompletionBatches((current) => current.map((entry) => entry.id === batch.id ? { ...entry, wastageQuantity: event.target.value } : entry))}
                                                            placeholder="Waste"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <KitchenButton variant="outline-success" onClick={() => runAction('complete')} isLoading={isSaving}>Mark Prepared</KitchenButton>
                                    </div>
                                ) : null}
                                {record.available_actions.includes('dispatch') ? (
                                    <div className={styles.actionBlock}>
                                        <div className={styles.gridTwo}>
                                            <KitchenInput label="Dispatch Quantity" type="number" min="0.0001" step="0.01" value={dispatchQuantity} onChange={(event) => setDispatchQuantity(event.target.value)} />
                                            <KitchenInput label="Dispatch Notes" value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} />
                                        </div>
                                        <KitchenButton variant="outline-secondary" onClick={() => runAction('dispatch')} isLoading={isSaving}>Dispatch</KitchenButton>
                                    </div>
                                ) : null}
                                {record.available_actions.includes('receive') ? (
                                    <div className={styles.actionBlock}>
                                        <div className={styles.gridTwo}>
                                            <KitchenInput label="Received Quantity" type="number" min="0" step="0.01" value={receivedQuantity} onChange={(event) => setReceivedQuantity(event.target.value)} />
                                            <KitchenInput label="Short Quantity" type="number" min="0" step="0.01" value={shortQuantity} onChange={(event) => setShortQuantity(event.target.value)} />
                                        </div>
                                        <div className={styles.gridTwo}>
                                            <KitchenInput label="Damaged Quantity" type="number" min="0" step="0.01" value={damagedQuantity} onChange={(event) => setDamagedQuantity(event.target.value)} />
                                            <KitchenInput label="Variance Reason" value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} />
                                        </div>
                                        <div className={styles.gridTwo}>
                                            <KitchenInput label="Receipt Notes" value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} />
                                            <KitchenInput label="Variance Notes" value={varianceNotes} onChange={(event) => setVarianceNotes(event.target.value)} />
                                        </div>
                                        <KitchenButton variant="outline-success" onClick={() => runAction('receive')} isLoading={isSaving}>Confirm Receipt</KitchenButton>
                                    </div>
                                ) : null}
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.detailSide}>
                        <KitchenCard className={styles.sideCard}>
                            <div className={styles.sectionHeader}>
                                <span>Traceability</span>
                            </div>
                            <div className={styles.timeline}>
                                <div><strong>Requested:</strong> {formatDateTime(record.requested_at)} by {record.requested_by_name || 'System'}</div>
                                <div><strong>Queued:</strong> {formatDateTime(record.queued_at)} by {record.queued_by_name || 'Pending'}</div>
                                <div><strong>Materials Issued:</strong> {formatDateTime(record.materials_issued_at)} by {record.issued_by_name || 'Pending'}</div>
                                <div><strong>Prep Started:</strong> {formatDateTime(record.start_date)}</div>
                                <div><strong>Prepared:</strong> {formatDateTime(record.completion_date)} by {record.completed_by_name || 'Pending'}</div>
                                <div><strong>Dispatch Ref:</strong> {record.linked_transfer?.transfer_no || 'Not dispatched'}</div>
                            </div>
                        </KitchenCard>
                        <KitchenCard className={styles.sideCard}>
                            <div className={styles.sectionHeader}>
                                <span>Batch Output</span>
                            </div>
                            <div className={styles.timeline}>
                                {record.batches?.length ? record.batches.map((batch) => (
                                    <div key={batch.id}>
                                        <strong>{batch.batch_no}:</strong> {formatQty(batch.actual_quantity)} good
                                        {batch.wastage_quantity ? `, ${formatQty(batch.wastage_quantity)} waste` : ''}
                                    </div>
                                )) : <div><strong>Batches:</strong> Not completed yet</div>}
                            </div>
                        </KitchenCard>
                        <KitchenCard className={styles.sideCard}>
                            <div className={styles.sectionHeader}>
                                <span>Notes and Exceptions</span>
                            </div>
                            <div className={styles.timeline}>
                                <div><strong>Queue:</strong> {record.queue_notes || 'None'}</div>
                                <div><strong>Issue:</strong> {record.issue_notes || 'None'}</div>
                                <div><strong>Completion:</strong> {record.completion_notes || 'None'}</div>
                                <div><strong>Dispatch:</strong> {record.dispatch_notes || 'None'}</div>
                                <div><strong>Receipt:</strong> {record.receipt_notes || 'None'}</div>
                                <div><strong>Variance:</strong> {record.variance_notes || 'None'}</div>
                                <div><strong>Rejected:</strong> {record.rejection_notes || 'None'}</div>
                                <div><strong>Cancelled:</strong> {record.cancellation_notes || 'None'}</div>
                            </div>
                        </KitchenCard>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
