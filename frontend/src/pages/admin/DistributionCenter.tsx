/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Share2, Store, Check, AlertCircle, Save, Loader2 } from 'lucide-react';
import { branchApi, catalogApi } from '../../api/api';
import styles from './DistributionCenter.module.css';

export function DistributionCenter() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [branchProducts, setBranchProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [branchesData, productsData] = await Promise.all([
                    branchApi.getBranches(),
                    catalogApi.getProducts()
                ]);
                setBranches(branchesData);
                setProducts(productsData);
                if (branchesData.length > 0) {
                    setSelectedBranchId(branchesData[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const fetchBranchMenu = useCallback(async () => {
        if (!selectedBranchId) return;
        try {
            const menu = await catalogApi.getBranchMenu(selectedBranchId);
            setBranchProducts(menu.products || []);
        } catch (err) {
            console.error('Failed to fetch branch menu:', err);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (selectedBranchId) {
            void fetchBranchMenu();
        }
    }, [fetchBranchMenu, selectedBranchId]);

    const toggleAssignment = async (product: any) => {
        if (!selectedBranchId) return;
        const currentMapping = branchProducts.find(p => p.id === product.id);
        const isCurrentlyEnabled = !!currentMapping;

        try {
            await catalogApi.setBranchMapping({
                branch_id: selectedBranchId,
                product_id: product.id,
                is_enabled: !isCurrentlyEnabled
            });
            await fetchBranchMenu();
        } catch (err) {
            console.error('Failed to toggle mapping:', err);
        }
    };

    const handlePriceChange = async (productId: number, price: number) => {
        if (!selectedBranchId) return;
        try {
            await catalogApi.updateBranchPrice({
                branch_id: selectedBranchId,
                product_id: productId,
                price_override: price
            });
        } catch (err) {
            console.error('Failed to update price:', err);
        }
    };

    const columns: ColumnDef<any>[] = [
        {
            key: 'name',
            header: 'Product Name',
            cell: (row) => {
                const product = products.find(p => p.id === row.id) || row;
                return (
                    <div className={styles.productCell}>
                        <span className={styles.productName}>{product.product_name || product.name}</span>
                        <span className={styles.productCategory}>{product.category?.category_name || product.category}</span>
                    </div>
                );
            }
        },
        {
            key: 'status',
            header: 'Assignment',
            cell: (row) => {
                const isAssigned = branchProducts.some(p => p.id === row.id);
                return (
                    <div className={`${styles.statusBadge} ${isAssigned ? styles.statusAssigned : styles.statusUnassigned}`}>
                        {isAssigned ? <Check size={14} /> : <AlertCircle size={14} />}
                        {isAssigned ? 'Assigned' : 'Not Assigned'}
                    </div>
                );
            }
        },
        {
            key: 'price',
            header: 'Branch Price',
            cell: (row) => {
                const assignedProduct = branchProducts.find(p => p.id === row.id);
                const isAssigned = !!assignedProduct;
                const defaultPrice = products.find(p => p.id === row.id)?.product_base_price || 0;

                return (
                    <input
                        type="number"
                        className={styles.priceInput}
                        defaultValue={assignedProduct?.price || defaultPrice}
                        disabled={!isAssigned}
                        onBlur={(e) => handlePriceChange(row.id, Number(e.target.value))}
                    />
                );
            }
        },
        {
            key: 'actions',
            header: 'Toggle',
            align: 'right',
            cell: (row) => {
                const isAssigned = branchProducts.some(p => p.id === row.id);
                return (
                    <KitchenButton
                        variant={isAssigned ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => toggleAssignment(row)}
                    >
                        {isAssigned ? 'Remove' : 'Assign'}
                    </KitchenButton>
                );
            }
        }
    ];

    if (isLoading) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <Loader2 size={48} className={styles.spinner} />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Product Distribution Center</h1>
                    <p>Manage product availability and pricing across your branch network.</p>
                </div>
                <KitchenButton variant="primary" isLoading={isSaving} onClick={() => window.location.reload()}>
                    <Save size={18} style={{ marginRight: '8px' }} />
                    Finalize Changes
                </KitchenButton>
            </header>

            <div className={styles.controls}>
                <div className={styles.branchPicker}>
                    <Store size={20} color="#64748b" />
                    <KitchenSelect
                        options={branches.map(b => ({ value: b.id.toString(), label: b.branch_name }))}
                        value={selectedBranchId?.toString()}
                        onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                    />
                </div>
                <KitchenButton variant="secondary">
                    <Share2 size={18} style={{ marginRight: '8px' }} />
                    Bulk Assign to All Branches
                </KitchenButton>
            </div>

            <KitchenCard noPadding className={styles.tableCard}>
                <KitchenTable columns={columns} data={products} />
            </KitchenCard>
        </div>
    );
}

