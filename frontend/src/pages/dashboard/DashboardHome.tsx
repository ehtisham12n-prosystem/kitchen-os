import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    Bell,
    BookOpen,
    Boxes,
    Brain,
    Calculator,
    ChevronDown,
    ChevronRight,
    ChefHat,
    ClipboardList,
    DollarSign,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Search,
    Settings,
    ShoppingCart,
    Store,
    Tag,
    TrendingUp,
    Truck,
    UserCheck,
    Users,
    Utensils,
    Zap,
} from 'lucide-react';
import { analyticsApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from '../analytics/analyticsAccess';
import styles from './DashboardHome.module.css';

interface NavItem {
    label: string;
    icon: ReactNode;
    to: string;
    badge?: string;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const RANGE_OPTIONS = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
];

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days - 1, 0));
    return { date_from: formatDate(start), date_to: formatDate(end) };
}

function formatCount(value: unknown) {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric);
}

function getInitials(name: string) {
    const tokens = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (tokens.length === 0) {
        return 'KO';
    }
    return tokens.map((token) => token[0]?.toUpperCase() || '').join('');
}

function RevenueTrendCard({
    rows,
    formatMoney,
}: {
    rows: Array<{ business_date: string; total_revenue: number; completed_orders: number }>;
    formatMoney: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
    const maxRevenue = Math.max(1, ...rows.map((row) => Number(row.total_revenue || 0)));

    return (
        <KitchenCard className={styles.listCard}>
            <div className={styles.listHeader}>
                <div>
                    <h3>Revenue Trend</h3>
                    <p>Completed-order revenue over the selected reporting window.</p>
                </div>
            </div>
            <div className={styles.trendBars}>
                {rows.map((row) => (
                    <div key={row.business_date} className={styles.trendBarGroup}>
                        <div
                            className={styles.trendBar}
                            style={{ height: `${(Number(row.total_revenue || 0) / maxRevenue) * 100}%` }}
                            title={`${row.business_date}: ${formatMoney(Number(row.total_revenue || 0))}`}
                        />
                        <span className={styles.trendLabel}>{row.business_date.slice(5)}</span>
                    </div>
                ))}
            </div>
            <div className={styles.rankList}>
                {rows.slice(-3).reverse().map((row) => (
                    <div key={`summary-${row.business_date}`} className={styles.rankRow}>
                        <div className={styles.rankInfo}>
                            <strong>{row.business_date}</strong>
                            <span>{formatCount(row.completed_orders)} completed orders</span>
                        </div>
                        <div className={styles.rankMeta}>
                            <strong>{formatMoney(Number(row.total_revenue || 0))}</strong>
                        </div>
                    </div>
                ))}
            </div>
        </KitchenCard>
    );
}

function Sidebar({
    isCollapsed,
    onToggle,
    sections,
    activePath,
    search,
    onSearchChange,
    onNavigate,
    userName,
    userRole,
}: {
    isCollapsed: boolean;
    onToggle: () => void;
    sections: NavSection[];
    activePath: string;
    search: string;
    onSearchChange: (value: string) => void;
    onNavigate: (path: string) => void;
    userName: string;
    userRole: string;
}) {
    const [openSectionOverrides, setOpenSectionOverrides] = useState<Record<string, boolean>>({});

    const openSections = useMemo(
        () => Object.fromEntries(sections.map((section) => [section.title, openSectionOverrides[section.title] ?? true])),
        [openSectionOverrides, sections],
    );

    const toggleSection = (title: string) => {
        setOpenSectionOverrides((prev) => ({ ...prev, [title]: !(prev[title] ?? true) }));
    };

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
            <div className={styles.sidebarLogo}>
                <div className={styles.logoIcon}>
                    <Zap size={20} />
                </div>
                {!isCollapsed && (
                    <div className={styles.logoText}>
                        <span className={styles.logoName}>KitchenOS</span>
                        <span className={styles.logoBadge}>EXECUTIVE</span>
                    </div>
                )}
                <button className={styles.collapseBtn} onClick={onToggle} title="Toggle sidebar" type="button">
                    <Menu size={18} />
                </button>
            </div>

            {!isCollapsed && (
                <div className={styles.sidebarSearch}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Quick route search..."
                        className={styles.searchInput}
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                    />
                </div>
            )}

            <nav className={styles.sidebarNav}>
                {sections.map((section) => (
                    <div key={section.title} className={styles.navSection}>
                        {!isCollapsed && (
                            <button
                                className={styles.navSectionHeader}
                                onClick={() => toggleSection(section.title)}
                                type="button"
                            >
                                <span className={styles.navSectionLabel}>{section.title}</span>
                                {openSections[section.title] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        )}
                        {(isCollapsed || openSections[section.title]) && (
                            <ul className={styles.navList}>
                                {section.items.map((item) => {
                                    const isActive = activePath === item.to;
                                    return (
                                        <li key={item.label}>
                                            <button
                                                type="button"
                                                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                                                onClick={() => onNavigate(item.to)}
                                                title={isCollapsed ? item.label : undefined}
                                            >
                                                <span className={styles.navItemIcon}>{item.icon}</span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className={styles.navItemLabel}>{item.label}</span>
                                                        {item.badge ? <span className={styles.navBadge}>{item.badge}</span> : null}
                                                    </>
                                                )}
                                                {isCollapsed && item.badge ? <span className={styles.navBadgeDot} /> : null}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {!isCollapsed && <div className={styles.navDivider} />}
                    </div>
                ))}
            </nav>

            <div className={styles.sidebarFooter}>
                <div className={styles.userProfile}>
                    <div className={styles.userAvatar}>{getInitials(userName)}</div>
                    {!isCollapsed && (
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{userName}</span>
                            <span className={styles.userRole}>{userRole}</span>
                        </div>
                    )}
                    {!isCollapsed && (
                        <button className={styles.logoutBtn} title="Session controlled from auth portal" type="button" disabled>
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}

export function DashboardHome() {
    const navigate = useNavigate();
    const location = useLocation();
    const access = usePermissionAccess();
    const { formatMoney } = useCurrencyConfig();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [search, setSearch] = useState('');
    const [rangeDays, setRangeDays] = useState('30');
    const [scopeValue, setScopeValue] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [branchOptions, setBranchOptions] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any>(null);

    const canViewExecutiveDashboard = access.canViewPosReports && access.canReadInventory;
    const activeBranchId = access.activeBranchId ? Number(access.activeBranchId) : null;
    const userName = access.userContext?.username || 'KitchenOS User';
    const userRole = access.userContext?.organization_user_type || 'Authorized user';

    const dateRange = useMemo(() => buildDateRange(Number(rangeDays) || 30), [rangeDays]);
    const selectedBranchId = scopeValue === 'all' ? null : Number(scopeValue);
    const recommendationBranchId = selectedBranchId
        || (activeBranchId && access.canAccessBranch(activeBranchId) ? activeBranchId : null)
        || (branchOptions.length > 0 ? Number(branchOptions[0].branch_id) : null);

    useEffect(() => {
        if (!canViewExecutiveDashboard) {
            setIsLoading(false);
            return;
        }

        const load = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const options = await analyticsApi.getOperationsBranchOptions();
                const branches = options?.branches ?? [];
                setBranchOptions(branches);
                if (scopeValue !== 'all' && !branches.some((branch: any) => String(branch.branch_id) === scopeValue)) {
                    setScopeValue('all');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setLoadError(getAnalyticsBlockedMessage(message));
                setBranchOptions([]);
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Failed to load dashboard branch scope', message);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [canViewExecutiveDashboard, scopeValue]);

    useEffect(() => {
        if (!canViewExecutiveDashboard) {
            return;
        }

        if (loadError) {
            return;
        }

        const load = async () => {
            setIsLoading(true);
            try {
                const [kpiResult, recommendationResult] = await Promise.all([
                    analyticsApi.getManagementKpis({
                        ...dateRange,
                        branch_ids: selectedBranchId ? [selectedBranchId] : undefined,
                    }),
                    recommendationBranchId ? analyticsApi.getRecommendationOverview(recommendationBranchId) : Promise.resolve(null),
                ]);
                setKpis(kpiResult);
                setRecommendations(recommendationResult);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setLoadError(getAnalyticsBlockedMessage(message));
                setKpis(null);
                setRecommendations(null);
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Failed to load executive dashboard', message);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [canViewExecutiveDashboard, dateRange, loadError, recommendationBranchId, selectedBranchId]);

    const navigateWithBranch = (path: string, branchId?: number | null) => {
        if (branchId) {
            localStorage.setItem('activeBranchId', String(branchId));
            window.dispatchEvent(new Event('branch_changed'));
        }
        navigate(path);
    };

    const summaryCards = kpis?.summary_cards ?? {};
    const trendSummary = kpis?.trend_summary ?? {};
    const attentionRows = kpis?.attention?.exceptions ?? [];
    const revenueRanking = kpis?.branch_rankings?.revenue ?? [];
    const inventoryRanking = kpis?.branch_rankings?.inventory_pressure ?? [];
    const revenueSeries = (kpis?.revenue_series ?? []).slice(-7);
    const recommendationSummary = recommendations?.summary ?? {};

    const stats = [
        {
            label: 'Network Revenue',
            value: formatMoney(Number(summaryCards.total_revenue || 0)),
            icon: <DollarSign size={22} />,
            trend: trendSummary.delta_pct === null || trendSummary.delta_pct === undefined ? null : `${Number(trendSummary.delta_pct).toFixed(1)}%`,
            isPositive: Number(trendSummary.delta_pct || 0) >= 0,
            sub: `${formatCount(summaryCards.completed_orders)} completed orders`,
        },
        {
            label: 'Average Order Value',
            value: formatMoney(Number(summaryCards.average_order_value || 0)),
            icon: <TrendingUp size={22} />,
            trend: null,
            isPositive: null,
            sub: `${formatCount(summaryCards.open_shifts)} open shifts`,
        },
        {
            label: 'Gross Margin',
            value: summaryCards.estimated_gross_margin_pct === null || summaryCards.estimated_gross_margin_pct === undefined
                ? 'N/A'
                : `${Number(summaryCards.estimated_gross_margin_pct).toFixed(1)}%`,
            icon: <BarChart3 size={22} />,
            trend: null,
            isPositive: null,
            sub: summaryCards.estimated_gross_margin === null || summaryCards.estimated_gross_margin === undefined
                ? 'Full-scope margin unavailable'
                : formatMoney(Number(summaryCards.estimated_gross_margin || 0)),
        },
        {
            label: 'Actionable Reorders',
            value: formatCount(recommendationSummary.actionable_reorders),
            icon: <Truck size={22} />,
            trend: null,
            isPositive: null,
            sub: `${formatCount(summaryCards.inventory_pressure)} inventory pressure signals`,
        },
    ];

    const navSections = useMemo<NavSection[]>(() => {
        const sections: NavSection[] = [];
        const operations: NavItem[] = [
            { label: 'Executive Dashboard', icon: <LayoutDashboard size={18} />, to: '/console/dashboard' },
        ];

        if (access.canViewPosReports) {
            operations.push({ label: 'Branch Dashboard', icon: <Store size={18} />, to: '/console/bm-dashboard' });
            operations.push({ label: 'Sales Reporting', icon: <ShoppingCart size={18} />, to: '/console/reports/sales' });
        }
        if (canViewExecutiveDashboard) {
            operations.push({ label: 'Branch Reporting', icon: <BarChart3 size={18} />, to: '/console/admin/analytics', badge: attentionRows.length ? String(attentionRows.length) : undefined });
            operations.push({ label: 'Sales Forecast', icon: <Brain size={18} />, to: '/console/analytics/sales-forecast' });
            operations.push({ label: 'Waste Analysis', icon: <ChefHat size={18} />, to: '/console/analytics/waste' });
        }
        sections.push({ title: 'Operations', items: operations });

        const supply: NavItem[] = [];
        if (access.canReadCatalog) supply.push({ label: 'Products', icon: <Package size={18} />, to: '/console/products' });
        if (access.canReadInventory) supply.push({ label: 'Inventory', icon: <Boxes size={18} />, to: '/console/inventory', badge: summaryCards.inventory_pressure ? String(summaryCards.inventory_pressure) : undefined });
        if (access.canReadCatalog) supply.push({ label: 'Recipes & BOM', icon: <BookOpen size={18} />, to: '/console/recipes' });
        if (access.canViewPurchaseOrders) supply.push({ label: 'Procurement', icon: <ClipboardList size={18} />, to: '/console/purchase-orders' });
        if (access.canReadInventory) supply.push({ label: 'Demand Planning', icon: <Truck size={18} />, to: '/console/inventory/demand', badge: recommendationSummary.actionable_reorders ? String(recommendationSummary.actionable_reorders) : undefined });
        if (supply.length > 0) sections.push({ title: 'Catalog & Supply', items: supply });

        const administrative: NavItem[] = [];
        if (access.canAccessAdminControls) administrative.push({ label: 'Branches', icon: <Store size={18} />, to: '/console/setup/branches' });
        if (access.canReadStaff) administrative.push({ label: 'Staff', icon: <Users size={18} />, to: '/console/staff' });
        if (access.canViewCustomers) administrative.push({ label: 'Customers', icon: <UserCheck size={18} />, to: '/console/crm' });
        if (access.canViewDeals) administrative.push({ label: 'Marketing', icon: <Tag size={18} />, to: '/console/marketing' });
        if (access.canReadAccounting) administrative.push({ label: 'Accounting', icon: <Calculator size={18} />, to: '/console/accounting' });
        if (administrative.length > 0) sections.push({ title: 'Administrative', items: administrative });

        const system: NavItem[] = [];
        if (access.canAccessAdminControls) system.push({ label: 'Settings', icon: <Settings size={18} />, to: '/console/setup/users' });
        if (system.length > 0) sections.push({ title: 'System', items: system });

        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) {
            return sections;
        }

        return sections
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => item.label.toLowerCase().includes(normalizedSearch)),
            }))
            .filter((section) => section.items.length > 0);
    }, [
        access.canAccessAdminControls,
        access.canReadAccounting,
        access.canReadCatalog,
        access.canReadInventory,
        access.canReadStaff,
        access.canViewCustomers,
        access.canViewDeals,
        access.canViewPosReports,
        access.canViewPurchaseOrders,
        attentionRows.length,
        canViewExecutiveDashboard,
        recommendationSummary.actionable_reorders,
        search,
        summaryCards.inventory_pressure,
    ]);

    if (!canViewExecutiveDashboard) {
        return (
            <div className={styles.appShell}>
                <div className={styles.mainWrapper}>
                    <main className={styles.mainContent}>
                        <KitchenCard className={styles.emptyStateCard}>
                            <AlertTriangle size={40} />
                            <h2>Executive dashboard access is not available for this role.</h2>
                            <p>This surface requires both POS reporting and inventory read scope.</p>
                        </KitchenCard>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.appShell}>
            <Sidebar
                isCollapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((current) => !current)}
                sections={navSections}
                activePath={location.pathname}
                search={search}
                onSearchChange={setSearch}
                onNavigate={navigate}
                userName={userName}
                userRole={userRole}
            />

            <div className={styles.mainWrapper}>
                <header className={styles.topBar}>
                    <div className={styles.topBarLeft}>
                        <nav className={styles.breadcrumb}>
                            <span className={styles.breadcrumbRoot}>Console</span>
                            <ChevronRight size={14} className={styles.breadcrumbSep} />
                            <span className={styles.breadcrumbCurrent}>Executive Dashboard</span>
                        </nav>
                    </div>
                    <div className={styles.topBarRight}>
                        <div className={styles.topBarActions}>
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All authorized branches' },
                                    ...branchOptions.map((branch) => ({
                                        value: String(branch.branch_id),
                                        label: branch.branch_name,
                                    })),
                                ]}
                                value={scopeValue}
                                onChange={(event) => setScopeValue(event.target.value)}
                            />
                            <KitchenSelect
                                options={RANGE_OPTIONS}
                                value={rangeDays}
                                onChange={(event) => setRangeDays(event.target.value)}
                            />
                        </div>
                        <button
                            className={styles.iconBtn}
                            title="Open branch reporting attention"
                            type="button"
                            onClick={() => navigate('/console/admin/analytics')}
                        >
                            <Bell size={18} />
                            {attentionRows.length > 0 ? <span className={styles.notifDot} /> : null}
                        </button>
                    </div>
                </header>

                <main className={styles.mainContent}>
                    <div className={styles.pageHeader}>
                        <div>
                            <h1>Organization Dashboard</h1>
                            <p>Live executive view across revenue, stock pressure, procurement backlog, and AI recommendation signals.</p>
                        </div>
                        {recommendationBranchId ? (
                            <KitchenButton
                                variant="secondary"
                                onClick={() => navigateWithBranch('/console/inventory/demand', recommendationBranchId)}
                            >
                                <ArrowRight size={16} />
                                Open demand planning
                            </KitchenButton>
                        ) : null}
                    </div>

                    {isLoading && !kpis ? (
                        <KitchenCard className={styles.inlineLoader}>
                            <BarChart3 size={28} />
                            <p>Loading executive dashboard...</p>
                        </KitchenCard>
                    ) : loadError ? (
                        <KitchenCard className={styles.emptyStateCard}>
                            <AlertTriangle size={40} />
                            <h2>Executive analytics is not available for this tenant.</h2>
                            <p>{loadError}</p>
                        </KitchenCard>
                    ) : (
                        <>
                            <div className={styles.statsGrid}>
                                {stats.map((stat) => (
                                    <KitchenCard key={stat.label} className={styles.statCard}>
                                        <div className={styles.statHeader}>
                                            <div className={styles.statIcon}>{stat.icon}</div>
                                            {stat.trend ? (
                                                <div className={`${styles.trend} ${stat.isPositive ? styles.positive : styles.negative}`}>
                                                    {stat.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                    {stat.trend}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className={styles.statContent}>
                                            <span className={styles.statLabel}>{stat.label}</span>
                                            <span className={styles.statValue}>{stat.value}</span>
                                            <span className={styles.statSub}>{stat.sub}</span>
                                        </div>
                                    </KitchenCard>
                                ))}
                            </div>

                            <div className={styles.chartsGrid}>
                                <RevenueTrendCard rows={revenueSeries} formatMoney={formatMoney} />

                                <KitchenCard className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <div>
                                            <h3>Top Branches</h3>
                                            <p>Highest revenue branches within the current dashboard scope.</p>
                                        </div>
                                    </div>
                                    <div className={styles.rankList}>
                                        {revenueRanking.length === 0 ? (
                                            <div className={styles.emptyStateCard}>
                                                <Store size={28} />
                                                <p>No branch revenue rows are available for this reporting scope.</p>
                                            </div>
                                        ) : (
                                            revenueRanking.map((branch: any, index: number) => (
                                                <button
                                                    key={`${branch.branch_id}-${index}`}
                                                    type="button"
                                                    className={styles.rankRowButton}
                                                    onClick={() => navigateWithBranch('/console/bm-dashboard', Number(branch.branch_id))}
                                                >
                                                    <div className={styles.rankInfo}>
                                                        <strong>{branch.branch_name}</strong>
                                                        <span>{formatCount(branch.completed_orders)} orders</span>
                                                    </div>
                                                    <div className={styles.rankMeta}>
                                                        <strong>{formatMoney(Number(branch.total_revenue || 0))}</strong>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </KitchenCard>
                            </div>

                            <div className={styles.sectionGrid}>
                                <KitchenCard className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <div>
                                            <h3>Operational Attention</h3>
                                            <p>Current exceptions requiring review.</p>
                                        </div>
                                    </div>
                                    <div className={styles.rankList}>
                                        {attentionRows.length === 0 ? (
                                            <div className={styles.emptyStateCard}>
                                                <Utensils size={28} />
                                                <p>No critical exceptions were triggered in the selected reporting window.</p>
                                            </div>
                                        ) : (
                                            attentionRows.slice(0, 6).map((item: any, index: number) => (
                                                <button
                                                    key={`${item.branch_id}-${item.category}-${index}`}
                                                    type="button"
                                                    className={styles.rankRowButton}
                                                    onClick={() => navigateWithBranch(item.route || '/console/admin/analytics', Number(item.branch_id))}
                                                >
                                                    <div className={styles.rankInfo}>
                                                        <strong>{item.branch_name}</strong>
                                                        <span>{item.message}</span>
                                                    </div>
                                                    <div className={styles.rankMeta}>
                                                        <span className={styles.statusTone}>{String(item.severity || 'info')}</span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </KitchenCard>

                                <KitchenCard className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <div>
                                            <h3>AI Recommendation Focus</h3>
                                            <p>Branch-level reorder and anomaly summary for the current active scope.</p>
                                        </div>
                                        {recommendationBranchId ? (
                                            <KitchenButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigateWithBranch('/console/analytics/sales-forecast', recommendationBranchId)}
                                            >
                                                Open forecast
                                            </KitchenButton>
                                        ) : null}
                                    </div>
                                    <div className={styles.rankList}>
                                        <div className={styles.rankRow}>
                                            <div className={styles.rankInfo}>
                                                <strong>Actionable reorders</strong>
                                                <span>Suggested replenishment actions in the selected branch context.</span>
                                            </div>
                                            <div className={styles.rankMeta}>
                                                <strong>{formatCount(recommendationSummary.actionable_reorders)}</strong>
                                            </div>
                                        </div>
                                        <div className={styles.rankRow}>
                                            <div className={styles.rankInfo}>
                                                <strong>Slow movers</strong>
                                                <span>Items with low movement against stock position.</span>
                                            </div>
                                            <div className={styles.rankMeta}>
                                                <strong>{formatCount(recommendationSummary.slow_movers)}</strong>
                                            </div>
                                        </div>
                                        {(recommendations?.anomalies ?? []).slice(0, 3).map((item: any, index: number) => (
                                            <div key={`${item.type || 'anomaly'}-${index}`} className={styles.rankRow}>
                                                <div className={styles.rankInfo}>
                                                    <strong>{item.title || item.type || 'Anomaly'}</strong>
                                                    <span>{item.message}</span>
                                                </div>
                                                <div className={styles.rankMeta}>
                                                    <span className={styles.statusTone}>{String(item.severity || 'info')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </KitchenCard>
                            </div>

                            <div className={styles.sectionGrid}>
                                <KitchenCard className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <div>
                                            <h3>Inventory Pressure Leaders</h3>
                                            <p>Branches carrying the most low-stock, out-of-stock, and negative-stock pressure.</p>
                                        </div>
                                    </div>
                                    <div className={styles.rankList}>
                                        {inventoryRanking.length === 0 ? (
                                            <div className={styles.emptyStateCard}>
                                                <Boxes size={28} />
                                                <p>No inventory pressure rows are available for the current scope.</p>
                                            </div>
                                        ) : (
                                            inventoryRanking.map((branch: any, index: number) => (
                                                <button
                                                    key={`${branch.branch_id}-inventory-${index}`}
                                                    type="button"
                                                    className={styles.rankRowButton}
                                                    onClick={() => navigateWithBranch('/console/inventory', Number(branch.branch_id))}
                                                >
                                                    <div className={styles.rankInfo}>
                                                        <strong>{branch.branch_name}</strong>
                                                        <span>
                                                            {formatCount(branch.low_stock_count)} low stock | {formatCount(branch.out_of_stock_count)} out | {formatCount(branch.negative_stock_count)} negative
                                                        </span>
                                                    </div>
                                                    <div className={styles.rankMeta}>
                                                        <strong>{formatCount(branch.pressure_count)}</strong>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </KitchenCard>

                                <KitchenCard className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <div>
                                            <h3>Quick Actions</h3>
                                            <p>Jump directly into the operational screens behind this dashboard.</p>
                                        </div>
                                    </div>
                                    <div className={styles.actionGrid}>
                                        <button type="button" className={styles.actionButton} onClick={() => navigate('/console/admin/analytics')}>
                                            <BarChart3 size={18} />
                                            <span>Branch reporting</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.actionButton}
                                            onClick={() => navigateWithBranch('/console/analytics/sales-forecast', recommendationBranchId)}
                                            disabled={!recommendationBranchId}
                                        >
                                            <Brain size={18} />
                                            <span>Forecasting</span>
                                        </button>
                                        <button type="button" className={styles.actionButton} onClick={() => navigate('/console/analytics/waste')}>
                                            <ChefHat size={18} />
                                            <span>Waste analysis</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.actionButton}
                                            onClick={() => navigateWithBranch('/console/inventory/demand', recommendationBranchId)}
                                            disabled={!recommendationBranchId}
                                        >
                                            <Truck size={18} />
                                            <span>Demand planning</span>
                                        </button>
                                    </div>
                                </KitchenCard>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
