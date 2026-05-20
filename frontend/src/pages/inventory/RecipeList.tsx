import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import { recipeApi } from '../../api/api';
import { Plus, Search, Scale, Box, ChevronRight, Coins, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './RecipeList.module.css';

export function RecipeList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState<any[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        complete: 0,
        partial: 0,
        averageMargin: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    const formatCurrency = (value: number | null | undefined) => `PKR ${Number(value || 0).toFixed(2)}`;

    const fetchRecipes = async () => {
        setIsLoading(true);
        try {
            const data = await recipeApi.getCostingOverview();
            const recipeRows = data.recipes || [];
            setRecipes(recipeRows);
            const complete = recipeRows.filter((recipe: any) => recipe.cost_summary?.cost_status === 'complete').length;
            const partial = recipeRows.filter((recipe: any) => recipe.cost_summary?.cost_status === 'partial').length;
            const resolvedMargins = recipeRows
                .map((recipe: any) => Number(recipe.cost_summary?.margin_percentage))
                .filter((value: number) => Number.isFinite(value));
            setStats({
                total: recipeRows.length,
                complete,
                partial,
                averageMargin: resolvedMargins.length
                    ? resolvedMargins.reduce((sum: number, value: number) => sum + value, 0) / resolvedMargins.length
                    : 0,
            });
        } catch (err) {
            console.error('Failed to fetch recipes', err);
            toast.error('Recipes', 'Could not load recipe blueprints.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    const filteredRecipes = recipes.filter(r =>
        r.recipe_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.product?.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            key: 'product',
            header: 'Sales Product',
            cell: (row: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box size={16} color="var(--color-primary)" />
                    <span style={{ fontWeight: 600 }}>{row.product?.product_name || 'No Product Linked'}</span>
                </div>
            )
        },
        {
            key: 'recipe_name',
            header: 'Variant Name',
            cell: (row: any) => <span>{row.recipe_name}</span>
        },
        {
            key: 'yield',
            header: 'Yield',
            cell: (row: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scale size={16} />
                    {row.yield_quantity} {row.yield_uom}
                </div>
            )
        },
        {
            key: 'cost',
            header: 'Recipe Cost',
            cell: (row: any) => (
                <div className={styles.metricCell}>
                    <span>{formatCurrency(row.cost_summary?.total_recipe_cost)}</span>
                    <small>{formatCurrency(row.cost_summary?.cost_per_yield_unit)} / yield unit</small>
                </div>
            )
        },
        {
            key: 'price',
            header: 'Sell vs Margin',
            cell: (row: any) => (
                <div className={styles.metricCell}>
                    <span>{formatCurrency(row.cost_summary?.selling_price)}</span>
                    <small className={(row.cost_summary?.margin_amount ?? 0) >= 0 ? styles.marginPositive : styles.marginNegative}>
                        {formatCurrency(row.cost_summary?.margin_amount)} ({Number(row.cost_summary?.margin_percentage || 0).toFixed(1)}%)
                    </small>
                </div>
            )
        },
        {
            key: 'ingredients',
            header: 'Ingredients',
            cell: (row: any) => {
                const missing = Number(row.cost_summary?.missing_cost_ingredient_count || 0);
                return `${row.ingredient_count || 0} items${missing > 0 ? `, ${missing} pending cost` : ''}`;
            }
        },
        {
            key: 'status',
            header: 'Cost Status',
            cell: (row: any) => (
                <div className={styles.statusStack}>
                    <span className={`${styles.statusBadge} ${row.is_active ? styles.active : styles.inactive}`}>
                        {row.is_active ? 'Active' : 'Draft'}
                    </span>
                    <span className={`${styles.statusBadge} ${styles[`cost_${row.cost_summary?.cost_status || 'missing'}`]}`}>
                        {row.cost_summary?.cost_status || 'missing'}
                    </span>
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            cell: (row: any) => (
                <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`/recipes/${row.id}`)}>
                    <ChevronRight size={18} />
                </KitchenButton>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Recipes & BOM</h1>
                    <p>Manage Bill of Materials and map raw inventory to sales products.</p>
                </div>
                <KitchenButton variant="primary" onClick={() => navigate('/recipes/new')}>
                    <Plus size={20} style={{ marginRight: '8px' }} />
                    Create Recipe
                </KitchenButton>
            </header>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filters}>
                    <KitchenInput
                        placeholder="Search recipes or products..."
                        icon={<Search size={20} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        containerClassName={styles.searchBar}
                    />
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Total Recipes</span>
                            <span className={styles.statValue}>{stats.total}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}><Coins size={12} /> Cost Complete</span>
                            <span className={styles.statValue}>{stats.complete}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}><AlertTriangle size={12} /> Partial</span>
                            <span className={styles.statValue}>{stats.partial}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}><TrendingUp size={12} /> Avg Margin</span>
                            <span className={styles.statValue}>{stats.averageMargin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </KitchenCard>

            <KitchenCard noPadding>
                {isLoading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading recipes...</div>
                ) : (
                    <KitchenTable
                        columns={columns}
                        data={filteredRecipes}
                    />
                )}
            </KitchenCard>
        </div>
    );
}

