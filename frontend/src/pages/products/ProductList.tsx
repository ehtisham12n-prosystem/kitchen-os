/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { Plus, Search, Filter, Edit, Trash2, Loader2, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { catalogApi } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import styles from './ProductList.module.css';

export function ProductList() {
    const navigate = useNavigate();
    const [sortKey, setSortKey] = useState('product_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [cuisineFilter, setCuisineFilter] = useState('all');
    const [stationFilter, setStationFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active');
    const [distributionFilter, setDistributionFilter] = useState('all');
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const data = await catalogApi.getProducts();
            setProducts(data);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const formatCurrency = (value: number | null | undefined) => `PKR ${Number(value || 0).toFixed(2)}`;
    const formatServingTime = (value: number | string | null | undefined) => `${Number(value || 20)} min`;

    const handleSort = (key: string) => {
        setCurrentPage(1);
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    const renderSortHeader = (label: string, key: string) => {
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

    const getSortableValue = (product: any, key: string) => {
        switch (key) {
            case 'product_name':
                return product.product_name || '';
            case 'category':
                return product.category?.category_name || '';
            case 'cuisine':
                return product.cuisine_type?.name || '';
            case 'station':
                return product.production_station?.name || '';
            case 'variants':
                return Number(product.customization_count || 0);
            case 'serving_time':
                return Number(product.serving_time || 20);
            case 'recipe_cost':
                return Number(product.recipe_cost_summary?.cost_per_yield_unit || 0);
            case 'distribution':
                return Number(product.enabled_branch_count || 0);
            case 'status':
                return product.is_active ? 1 : 0;
            default:
                return '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Archive this product? It will be removed from branch selling but historical records remain intact.')) return;
        try {
            await catalogApi.deleteProduct(id);
            await fetchProducts();
            toast.success('Product Archived', 'The product has been archived safely.');
        } catch (err) {
            console.error('Failed to delete product', err);
            toast.error('Archive Failed', 'Failed to archive product.');
        }
    };

    const columns: ColumnDef<any>[] = [
        {
            key: 'product_name',
            header: renderSortHeader('Product Name', 'product_name'),
            cell: (row) => (
                <div className={styles.productCell}>
                    <div className={styles.productImagePlaceholder}>IMG</div>
                    <div className={styles.productInfo}>
                        <span className={styles.productName}>{row.product_name}</span>
                        <span className={styles.productId}>ID: {row.id}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'category',
            header: renderSortHeader('Category', 'category'),
            cell: (row) => row.category?.category_name || 'Uncategorized'
        },
        {
            key: 'cuisine',
            header: renderSortHeader('Cuisine Type', 'cuisine'),
            cell: (row) => row.cuisine_type?.name || 'N/A'
        },
        {
            key: 'station',
            header: renderSortHeader('Prep Station', 'station'),
            cell: (row) => row.production_station?.name || 'N/A'
        },
        {
            key: 'variants',
            header: renderSortHeader('Variants', 'variants'),
            cell: (row) => {
                const count = Number(row.customization_count || 0);
                return count > 0 ? `${count} variant${count === 1 ? '' : 's'}` : 'Standard only';
            }
        },
        {
            key: 'serving_time',
            header: renderSortHeader('Serving Time', 'serving_time'),
            cell: (row) => (
                <span className={styles.servingTimeBadge}>{formatServingTime(row.serving_time)}</span>
            )
        },
        {
            key: 'recipe_cost',
            header: renderSortHeader('Recipe Cost', 'recipe_cost'),
            cell: (row) => {
                const summary = row.recipe_cost_summary;
                if (!summary?.selected_recipe_id) {
                    return <span className={styles.placeholderText}>No recipe</span>;
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
            key: 'distribution',
            header: renderSortHeader('Distribution', 'distribution'),
            cell: (row) => {
                const enabled = Number(row.enabled_branch_count || 0);
                const total = Number(row.total_branch_count || 0);
                return `${row.distribution_scope === 'selected' ? 'Selected branches' : 'All branches'} (${enabled}/${total})`;
            }
        },
        {
            key: 'status',
            header: renderSortHeader('Status', 'status'),
            cell: (row) => (
                <span className={`${styles.statusBadge} ${row.is_active ? styles.statusActive : styles.statusInactive}`}>
                    {row.is_active ? 'Active' : 'Archived'}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actions}>
                    <KitchenButton variant="ghost" size="sm" title="Edit" onClick={() => navigate(`/products/${row.id}`)}><Edit size={14} /></KitchenButton>
                    <KitchenButton variant="ghost" size="sm" title="Archive" onClick={() => handleDelete(row.id)}><Trash2 size={14} className={styles.deleteIcon} /></KitchenButton>
                </div>
            )
        }
    ];

    const categoryOptions = [
        { value: 'all', label: 'All Categories' },
        ...Array.from(
            new Map(
                products
                    .filter((p) => p.category?.id)
                    .map((p) => [String(p.category.id), p.category.category_name])
            ),
        ).map(([value, label]) => ({ value, label })),
    ];

    const cuisineOptions = [
        { value: 'all', label: 'All Cuisines' },
        ...Array.from(
            new Map(
                products
                    .filter((p) => p.cuisine_type?.id)
                    .map((p) => [String(p.cuisine_type.id), p.cuisine_type.name])
            ),
        ).map(([value, label]) => ({ value, label })),
    ];

    const stationOptions = [
        { value: 'all', label: 'All Stations' },
        ...Array.from(
            new Map(
                products
                    .filter((p) => p.production_station?.id)
                    .map((p) => [String(p.production_station.id), p.production_station.name])
            ),
        ).map(([value, label]) => ({ value, label })),
    ];

    const filteredProducts = products.filter((p: any) => {
        const matchesSearch =
            p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category?.category_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory =
            categoryFilter === 'all' || String(p.category?.id) === categoryFilter;
        const matchesCuisine =
            cuisineFilter === 'all' || String(p.cuisine_type?.id) === cuisineFilter;
        const matchesStation =
            stationFilter === 'all' || String(p.production_station?.id) === stationFilter;
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' ? p.is_active : !p.is_active);
        const matchesDistribution =
            distributionFilter === 'all' ||
            (distributionFilter === 'all_branches'
                ? p.distribution_scope === 'all'
                : p.distribution_scope === 'selected');

        return (
            matchesSearch &&
            matchesCategory &&
            matchesCuisine &&
            matchesStation &&
            matchesStatus &&
            matchesDistribution
        );
    });

    const sortedProducts = [...filteredProducts].sort((left, right) => {
        const leftValue = getSortableValue(left, sortKey);
        const rightValue = getSortableValue(right, sortKey);

        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
        }

        const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base',
        });
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedProducts = sortedProducts.slice(startIndex, startIndex + pageSize);

    const resetFilters = () => {
        setCategoryFilter('all');
        setCuisineFilter('all');
        setStationFilter('all');
        setStatusFilter('active');
        setDistributionFilter('all');
        setSearchTerm('');
        setCurrentPage(1);
    };

    const paginationSummary = `Showing ${filteredProducts.length === 0 ? 0 : startIndex + 1}-${Math.min(startIndex + pageSize, filteredProducts.length)} of ${filteredProducts.length} products`;

    const renderPagination = () => (
        <div className={styles.paginationBar}>
            <div className={styles.paginationMeta}>
                <span className={styles.paginationSummary}>{paginationSummary}</span>
                <span className={styles.pageCount}>Page {safePage} of {totalPages}</span>
            </div>
            <div className={styles.paginationControls}>
                <div className={styles.pageSizeControl}>
                    <span className={styles.pageSizeLabel}>Rows</span>
                    <KitchenSelect
                        value={String(pageSize)}
                        options={[
                            { value: '10', label: '10 rows' },
                            { value: '25', label: '25 rows' },
                            { value: '50', label: '50 rows' },
                            { value: '100', label: '100 rows' },
                        ]}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.pageSizeSelect}
                    />
                </div>
                <div className={styles.pageNav}>
                    <KitchenButton
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                        Previous
                    </KitchenButton>
                    <div className={styles.pageNumberGroup}>
                        {Array.from({ length: totalPages }, (_, index) => index + 1)
                            .filter((page) => {
                                if (totalPages <= 7) return true;
                                if (page === 1 || page === totalPages) return true;
                                return Math.abs(page - safePage) <= 1;
                            })
                            .map((page, index, pages) => {
                                const previousPage = pages[index - 1];
                                const shouldInsertGap = previousPage && page - previousPage > 1;
                                return (
                                    <div key={page} className={styles.pageNumberWrapper}>
                                        {shouldInsertGap && <span className={styles.pageGap}>...</span>}
                                        <button
                                            type="button"
                                            className={`${styles.pageButton} ${page === safePage ? styles.pageButtonActive : ''}`}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>
                    <KitchenButton
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </KitchenButton>
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className="ambient-light-1"></div>
            <div className="ambient-light-2"></div>
            <header className={styles.header}>
                <div>
                    <h1>Products</h1>
                    <p>Manage the client-owned product master, branch distribution, and safe lifecycle state.</p>
                </div>
                <KitchenButton variant="primary" size="sm" onClick={() => navigate('/products/new')}>
                    <Plus size={18} style={{ marginRight: '6px' }} />
                    Add New Product
                </KitchenButton>
            </header>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filterHeader}>
                    <div>
                        <h2>Filter Products</h2>
                        <p>Refine the product master by placement, availability, and distribution scope.</p>
                    </div>
                    <KitchenButton variant="outline" className={styles.filterBtn} onClick={resetFilters}>
                        <Filter size={18} style={{ marginRight: '8px' }} />
                        Clear Filters
                    </KitchenButton>
                </div>
                <div className={styles.filters}>
                    <KitchenInput
                        label="Search"
                        placeholder="Search by name or category"
                        icon={<Search size={18} />}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.searchField}
                    />
                    <KitchenSelect
                        label="Category"
                        value={categoryFilter}
                        options={categoryOptions}
                        onChange={(e) => {
                            setCategoryFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.filterSelect}
                    />
                    <KitchenSelect
                        label="Cuisine"
                        value={cuisineFilter}
                        options={cuisineOptions}
                        onChange={(e) => {
                            setCuisineFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.filterSelect}
                    />
                    <KitchenSelect
                        label="Prep Station"
                        value={stationFilter}
                        options={stationOptions}
                        onChange={(e) => {
                            setStationFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.filterSelect}
                    />
                    <KitchenSelect
                        label="Status"
                        value={statusFilter}
                        options={[
                            { value: 'active', label: 'Active' },
                            { value: 'archived', label: 'Archived' },
                            { value: 'all', label: 'All Statuses' },
                        ]}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.filterSelect}
                    />
                    <KitchenSelect
                        label="Distribution"
                        value={distributionFilter}
                        options={[
                            { value: 'all', label: 'All Distribution' },
                            { value: 'all_branches', label: 'All Branches' },
                            { value: 'selected', label: 'Selected Branches' },
                        ]}
                        onChange={(e) => {
                            setDistributionFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        containerClassName={styles.filterSelect}
                    />
                </div>
            </KitchenCard>

            <KitchenCard noPadding>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
                    </div>
                ) : (
                    <>
                        {renderPagination()}
                        <KitchenTable
                            columns={columns}
                            data={pagedProducts}
                            compact={true}
                            onRowClick={(row) => navigate(`/products/${row.id}`)}
                        />
                        {renderPagination()}
                    </>
                )}
            </KitchenCard>
        </div>
    );
}


