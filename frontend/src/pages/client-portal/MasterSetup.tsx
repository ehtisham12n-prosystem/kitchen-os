/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowRight,
    Blocks,
    Briefcase,
    Building2,
    ChefHat,
    CheckCircle2,
    CircleDashed,
    Clock3,
    CreditCard,
    FileStack,
    LayoutGrid,
    Package,
    Receipt,
    ShieldCheck,
    Sparkles,
    Store,
    Users,
    UtensilsCrossed,
    Warehouse,
} from 'lucide-react';
import { branchApi, catalogApi, inventoryApi, orderTypeApi, recipeApi, saleCounterApi, setupApi, userApi, vendorApi } from '../../api/api';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './MasterSetup.module.css';

type SetupStats = {
    branches: number;
    activeBranches: number;
    setupPendingBranches: number;
    departments: number;
    designations: number;
    roles: number;
    users: number;
    taxes: number;
    defaultTaxes: number;
    paymentMethods: number;
    saleCounters: number;
    categories: number;
    menuTypes: number;
    stations: number;
    uoms: number;
    orderTypes: number;
    products: number;
    inventoryClasses: number;
    inventoryItems: number;
    vendors: number;
    recipes: number;
};

type SetupTask = {
    id: string;
    title: string;
    description: string;
    example: string;
    href: string;
    countLabel: string;
    countValue: number;
    completed: boolean;
};

type SetupPhase = {
    id: string;
    kicker: string;
    title: string;
    summary: string;
    icon: typeof Building2;
    tasks: SetupTask[];
};

const EMPTY_STATS: SetupStats = {
    branches: 0,
    activeBranches: 0,
    setupPendingBranches: 0,
    departments: 0,
    designations: 0,
    roles: 0,
    users: 0,
    taxes: 0,
    defaultTaxes: 0,
    paymentMethods: 0,
    saleCounters: 0,
    categories: 0,
    menuTypes: 0,
    stations: 0,
    uoms: 0,
    orderTypes: 0,
    products: 0,
    inventoryClasses: 0,
    inventoryItems: 0,
    vendors: 0,
    recipes: 0,
};

function getSettledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
    return result.status === 'fulfilled' ? result.value : fallback;
}

function countInventoryHierarchy(hierarchy: any[]): { classes: number; items: number } {
    const classes = hierarchy.length;
    const items = hierarchy.reduce((classTotal: number, cls: any) => (
        classTotal + (cls.types || []).reduce((typeTotal: number, type: any) => (
            typeTotal + (type.subTypes || []).reduce((subTypeTotal: number, subType: any) => (
                subTypeTotal + (subType.items?.length || 0)
            ), 0)
        ), 0)
    ), 0);

    return { classes, items };
}

function formatPercent(value: number) {
    return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function MasterSetup() {
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';

    const [stats, setStats] = useState<SetupStats>(EMPTY_STATS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const results = await Promise.allSettled([
                    branchApi.getBranches(),
                    setupApi.getDepartments(),
                    setupApi.getDesignations(),
                    setupApi.getRoles(),
                    userApi.getUsers(),
                    setupApi.getTaxes(),
                    setupApi.getPaymentMethods(),
                    saleCounterApi.getAll(),
                    catalogApi.getCategories(),
                    catalogApi.getMenuTypes(),
                    catalogApi.getStations(),
                    catalogApi.getUoms(),
                    orderTypeApi.getOrderTypes(),
                    catalogApi.getProducts(),
                    inventoryApi.getHierarchy(),
                    vendorApi.getVendors(),
                    recipeApi.getRecipes(),
                ]);

                const branches = getSettledValue(results[0], [] as any[]);
                const departments = getSettledValue(results[1], [] as any[]);
                const designations = getSettledValue(results[2], [] as any[]);
                const roles = getSettledValue(results[3], [] as any[]);
                const users = getSettledValue(results[4], [] as any[]);
                const taxes = getSettledValue(results[5], [] as any[]);
                const paymentMethods = getSettledValue(results[6], [] as any[]);
                const saleCounters = getSettledValue(results[7], [] as any[]);
                const categories = getSettledValue(results[8], [] as any[]);
                const menuTypes = getSettledValue(results[9], [] as any[]);
                const stations = getSettledValue(results[10], [] as any[]);
                const uoms = getSettledValue(results[11], [] as any[]);
                const orderTypes = getSettledValue(results[12], [] as any[]);
                const products = getSettledValue(results[13], [] as any[]);
                const hierarchy = getSettledValue(results[14], [] as any[]);
                const vendors = getSettledValue(results[15], [] as any[]);
                const recipes = getSettledValue(results[16], [] as any[]);
                const inventorySummary = countInventoryHierarchy(hierarchy);

                setStats({
                    branches: branches.length,
                    activeBranches: branches.filter((branch) => branch.status === 'active').length,
                    setupPendingBranches: branches.filter((branch) => branch.status === 'setup_pending').length,
                    departments: departments.length,
                    designations: designations.length,
                    roles: roles.length,
                    users: users.length,
                    taxes: taxes.filter((tax) => tax.is_active !== false).length,
                    defaultTaxes: taxes.filter((tax) => tax.is_default).length,
                    paymentMethods: paymentMethods.filter((method) => method.is_active !== false).length,
                    saleCounters: saleCounters.length,
                    categories: categories.filter((category) => category.is_active !== false).length,
                    menuTypes: menuTypes.filter((menuType) => menuType.is_active !== false).length,
                    stations: stations.filter((station) => station.is_active !== false).length,
                    uoms: uoms.filter((uom) => uom.is_active !== false).length,
                    orderTypes: orderTypes.filter((orderType) => orderType.is_active !== false).length,
                    products: products.length,
                    inventoryClasses: inventorySummary.classes,
                    inventoryItems: inventorySummary.items,
                    vendors: vendors.length,
                    recipes: recipes.length,
                });
            } catch (error) {
                console.error('Failed to load startup setup overview', error);
                toast.error('Setup Hub', 'Some setup metrics could not be loaded.');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, []);

    const phases = useMemo<SetupPhase[]>(() => [
        {
            id: 'foundation',
            kicker: 'Phase 01',
            title: 'Foundation and Compliance',
            summary: 'Set financial controls and branch structure first so the rest of the setup inherits clean defaults.',
            icon: ShieldCheck,
            tasks: [
                {
                    id: 'taxes',
                    title: 'Tax Configuration',
                    description: 'Create tax profiles, define channel applicability, and ensure one default tax is available for branch readiness.',
                    example: 'Example: GST 15% as default, Delivery GST 5% for home orders.',
                    href: `${consoleBase}/admin/taxes`,
                    countLabel: 'Active tax profiles',
                    countValue: stats.taxes,
                    completed: stats.taxes > 0 && stats.defaultTaxes > 0,
                },
                {
                    id: 'payments',
                    title: 'Payment Methods',
                    description: 'Define the payment modes your teams can use across POS, settlement, and reporting.',
                    example: 'Example: Cash, Card, Bank Transfer, Wallet.',
                    href: `${consoleBase}/admin/payment-methods`,
                    countLabel: 'Active payment methods',
                    countValue: stats.paymentMethods,
                    completed: stats.paymentMethods > 0,
                },
                {
                    id: 'branches',
                    title: 'Branches and Operating Units',
                    description: 'Create all outlets, warehouses, and central stores before assigning people or enabling operational modules.',
                    example: 'Example: Main Outlet, Food Court Kiosk, Central Warehouse.',
                    href: `${consoleBase}/setup/branches`,
                    countLabel: 'Total branches',
                    countValue: stats.branches,
                    completed: stats.branches > 0,
                },
            ],
        },
        {
            id: 'people',
            kicker: 'Phase 02',
            title: 'People, Roles, and Access',
            summary: 'Build the organization structure first, then attach users to designations, branches, and role boundaries.',
            icon: Users,
            tasks: [
                {
                    id: 'departments',
                    title: 'Departments',
                    description: 'Create the reporting structure that groups operational and support teams.',
                    example: 'Example: Kitchen, Service, Inventory, Accounts.',
                    href: `${consoleBase}/setup/departments`,
                    countLabel: 'Departments',
                    countValue: stats.departments,
                    completed: stats.departments > 0,
                },
                {
                    id: 'designations',
                    title: 'Designations',
                    description: 'Define titles and responsibilities before onboarding staff records.',
                    example: 'Example: Branch Manager, Cashier, Chef, Store Officer.',
                    href: `${consoleBase}/setup/designations`,
                    countLabel: 'Designations',
                    countValue: stats.designations,
                    completed: stats.designations > 0,
                },
                {
                    id: 'roles',
                    title: 'Roles and Permission Sets',
                    description: 'Create reusable access patterns instead of assigning permissions one-off per user.',
                    example: 'Example: Client Admin, Branch Manager, POS Operator.',
                    href: `${consoleBase}/client/security/groups`,
                    countLabel: 'Roles',
                    countValue: stats.roles,
                    completed: stats.roles > 0,
                },
                {
                    id: 'users',
                    title: 'Users and Branch Assignments',
                    description: 'Onboard people after branches, roles, departments, and designations are ready.',
                    example: 'Example: Cashier assigned to DHA branch with POS PIN and primary role.',
                    href: `${consoleBase}/admin/users`,
                    countLabel: 'Users',
                    countValue: stats.users,
                    completed: stats.users > 0,
                },
            ],
        },
        {
            id: 'service',
            kicker: 'Phase 03',
            title: 'Service and Menu Architecture',
            summary: 'Configure the operational framework that powers dine-in, takeaway, kitchen routing, and branch selling.',
            icon: UtensilsCrossed,
            tasks: [
                {
                    id: 'branch-settings',
                    title: 'Branch Administration',
                    description: 'Complete branch modules, tax defaults, document rules, and operating controls before activation.',
                    example: 'Example: Enable POS and Inventory, set business-day cutoff, require open shift.',
                    href: `${consoleBase}/setup/branches`,
                    countLabel: 'Active branches',
                    countValue: stats.activeBranches,
                    completed: stats.activeBranches > 0 && stats.setupPendingBranches === 0,
                },
                {
                    id: 'sale-counters',
                    title: 'Sale Counters and Tills',
                    description: 'Register POS operating points for each branch that will process live orders.',
                    example: 'Example: Front Counter 01, Drive-Thru Till, Express Kiosk.',
                    href: `${consoleBase}/setup/sale-counters`,
                    countLabel: 'Sale counters',
                    countValue: stats.saleCounters,
                    completed: stats.saleCounters > 0,
                },
                {
                    id: 'menu-masters',
                    title: 'Menu Masters',
                    description: 'Set up categories, menu types, stations, order types, and UOMs before creating products.',
                    example: 'Example: Burgers category, Delivery menu type, Grill station, Piece UOM.',
                    href: `${consoleBase}/menu/categories`,
                    countLabel: 'Configured masters',
                    countValue: stats.categories + stats.menuTypes + stats.stations + stats.uoms + stats.orderTypes,
                    completed: stats.categories > 0 && stats.menuTypes > 0 && stats.stations > 0 && stats.uoms > 0 && stats.orderTypes > 0,
                },
                {
                    id: 'products',
                    title: 'Products and Branch Availability',
                    description: 'Create menu items only after the taxonomy exists so pricing, routing, and reporting stay consistent.',
                    example: 'Example: Zinger Combo linked to Grill station and Delivery tax profile.',
                    href: `${consoleBase}/products`,
                    countLabel: 'Products',
                    countValue: stats.products,
                    completed: stats.products > 0,
                },
            ],
        },
        {
            id: 'supply',
            kicker: 'Phase 04',
            title: 'Inventory, Vendors, and Costing',
            summary: 'Build stock structure after service masters so procurement, recipes, and costing can use the same controlled references.',
            icon: Warehouse,
            tasks: [
                {
                    id: 'inventory-structure',
                    title: 'Inventory Hierarchy',
                    description: 'Create classifications, categories, sub-types, and item masters before branch stock configuration.',
                    example: 'Example: Raw Material > Poultry > Chicken Breast.',
                    href: `${consoleBase}/inventory/setup/classifications`,
                    countLabel: 'Inventory classes / items',
                    countValue: stats.inventoryClasses + stats.inventoryItems,
                    completed: stats.inventoryClasses > 0 && stats.inventoryItems > 0,
                },
                {
                    id: 'vendors',
                    title: 'Vendors and Procurement Sources',
                    description: 'Define suppliers before purchase orders, GRNs, and payment approvals are used operationally.',
                    example: 'Example: Fresh Farms Poultry, Metro Packaging Supplies.',
                    href: `${consoleBase}/inventory/vendors`,
                    countLabel: 'Vendors',
                    countValue: stats.vendors,
                    completed: stats.vendors > 0,
                },
                {
                    id: 'recipes',
                    title: 'Recipes and Costing',
                    description: 'Link finished products to inventory ingredients so KitchenOS can calculate yield and cost.',
                    example: 'Example: Chicken Burger recipe consuming bun, patty, mayo, and lettuce.',
                    href: `${consoleBase}/recipes`,
                    countLabel: 'Recipes',
                    countValue: stats.recipes,
                    completed: stats.recipes > 0,
                },
            ],
        },
    ], [consoleBase, stats]);

    const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const completedTasks = phases.reduce((sum, phase) => (
        sum + phase.tasks.filter((task) => task.completed).length
    ), 0);
    const completionPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const launchReadiness = useMemo(() => {
        if (completionPercent >= 90) return 'Launch ready';
        if (completionPercent >= 60) return 'Operationally close';
        if (completionPercent >= 30) return 'Core setup in progress';
        return 'Setup not ready';
    }, [completionPercent]);

    const nextActions = useMemo(() => {
        return phases
            .flatMap((phase) => phase.tasks)
            .filter((task) => !task.completed)
            .slice(0, 3);
    }, [phases]);

    const priorityLinks = [
        { label: 'Branches', href: `${consoleBase}/setup/branches`, icon: Building2 },
        { label: 'Users', href: `${consoleBase}/admin/users`, icon: Users },
        { label: 'Tax Configuration', href: `${consoleBase}/admin/taxes`, icon: Receipt },
        { label: 'Payment Methods', href: `${consoleBase}/admin/payment-methods`, icon: CreditCard },
        { label: 'Products', href: `${consoleBase}/products`, icon: Package },
        { label: 'Inventory Setup', href: `${consoleBase}/inventory/setup/classifications`, icon: Warehouse },
    ];

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroBackdrop} />
                <div className={styles.heroContent}>
                    <div className={styles.heroCopy}>
                        <div className={styles.heroEyebrow}>
                            <Sparkles size={14} />
                            Console Admin Setup Hub
                        </div>
                        <h1>Startup and system setup command center</h1>
                        <p>
                            A professional setup flow for client admins. Work phase-by-phase, open the right admin pages,
                            and track which masters are still missing before go-live.
                        </p>
                        <div className={styles.heroActions}>
                            <Link to={`${consoleBase}/setup/branches`} className={styles.primaryLink}>
                                Start with Branches
                                <ArrowRight size={16} />
                            </Link>
                            <Link to={`${consoleBase}/admin/users`} className={styles.secondaryLink}>
                                Open User Registry
                            </Link>
                        </div>
                    </div>

                    <KitchenCard className={styles.heroStatusCard}>
                        <div className={styles.statusHeader}>
                            <span className={styles.statusKicker}>Current status</span>
                            <span className={styles.statusBadge}>{launchReadiness}</span>
                        </div>
                        <div className={styles.progressValue}>{formatPercent(completionPercent)}</div>
                        <div className={styles.progressMeta}>
                            {isLoading
                                ? 'Refreshing setup metrics from your console modules...'
                                : `${completedTasks} of ${totalTasks} core setup tasks completed`}
                        </div>
                        <div className={styles.progressTrack}>
                            <div className={styles.progressFill} style={{ width: formatPercent(completionPercent) }} />
                        </div>
                        <div className={styles.heroStatsGrid}>
                            <div className={styles.heroStat}>
                                <strong>{stats.activeBranches}</strong>
                                <span>Active branches</span>
                            </div>
                            <div className={styles.heroStat}>
                                <strong>{stats.users}</strong>
                                <span>Users onboarded</span>
                            </div>
                            <div className={styles.heroStat}>
                                <strong>{stats.products}</strong>
                                <span>Products created</span>
                            </div>
                            <div className={styles.heroStat}>
                                <strong>{stats.inventoryItems}</strong>
                                <span>Inventory items</span>
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            </section>

            <section className={styles.overviewGrid}>
                <KitchenCard className={`${styles.summaryCard} ${styles.summaryCardAction}`}>
                    <div className={styles.summaryHeader}>
                        <div>
                            <span className={styles.summaryKicker}>What to do next</span>
                            <h2>Immediate next actions</h2>
                        </div>
                        <Clock3 size={18} />
                    </div>
                    <div className={styles.nextActionList}>
                        {nextActions.length > 0 ? nextActions.map((task) => (
                            <Link key={task.id} to={task.href} className={styles.nextActionItem}>
                                <div>
                                    <strong>{task.title}</strong>
                                    <span>{task.description}</span>
                                </div>
                                <ArrowRight size={16} />
                            </Link>
                        )) : (
                            <div className={styles.emptyState}>
                                <CheckCircle2 size={18} />
                                <span>All core startup tasks are currently complete.</span>
                            </div>
                        )}
                    </div>
                </KitchenCard>

                <KitchenCard className={`${styles.summaryCard} ${styles.summaryCardLinks}`}>
                    <div className={styles.summaryHeader}>
                        <div>
                            <span className={styles.summaryKicker}>Quick access</span>
                            <h2>Most-used admin pages</h2>
                        </div>
                        <LayoutGrid size={18} />
                    </div>
                    <div className={styles.quickLinksGrid}>
                        {priorityLinks.map(({ label, href, icon: Icon }) => (
                            <Link key={label} to={href} className={styles.quickLink}>
                                <div className={styles.quickLinkIcon}>
                                    <Icon size={18} />
                                </div>
                                <span>{label}</span>
                            </Link>
                        ))}
                    </div>
                </KitchenCard>
            </section>

            <section className={styles.phaseStack}>
                {phases.map((phase) => {
                    const completed = phase.tasks.filter((task) => task.completed).length;
                    const percent = phase.tasks.length > 0 ? (completed / phase.tasks.length) * 100 : 0;
                    const PhaseIcon = phase.icon;

                    return (
                        <KitchenCard key={phase.id} className={`${styles.phaseCard} ${styles.phaseCardTint}`}>
                            <div className={styles.phaseHeader}>
                                <div className={styles.phaseIdentity}>
                                    <div className={styles.phaseIcon}>
                                        <PhaseIcon size={20} />
                                    </div>
                                    <div>
                                        <span className={styles.phaseKicker}>{phase.kicker}</span>
                                        <h3>{phase.title}</h3>
                                        <p>{phase.summary}</p>
                                    </div>
                                </div>
                                <div className={styles.phaseProgress}>
                                    <strong>{completed}/{phase.tasks.length}</strong>
                                    <span>tasks done</span>
                                    <div className={styles.miniTrack}>
                                        <div className={styles.miniFill} style={{ width: formatPercent(percent) }} />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.taskGrid}>
                                {phase.tasks.map((task) => (
                                    <Link key={task.id} to={task.href} className={styles.taskCard}>
                                        <div className={styles.taskTopRow}>
                                            <div className={styles.taskStatus}>
                                                {task.completed ? (
                                                    <CheckCircle2 size={16} className={styles.taskDoneIcon} />
                                                ) : (
                                                    <CircleDashed size={16} className={styles.taskPendingIcon} />
                                                )}
                                                <span className={task.completed ? styles.statusDone : styles.statusPending}>
                                                    {task.completed ? 'Completed' : 'Pending'}
                                                </span>
                                            </div>
                                            <ArrowRight size={16} className={styles.taskArrow} />
                                        </div>

                                        <h4>{task.title}</h4>
                                        <p>{task.description}</p>

                                        <div className={styles.metricPill}>
                                            <span>{task.countLabel}</span>
                                            <strong>{task.countValue}</strong>
                                        </div>

                                        <div className={styles.exampleBlock}>
                                            <span className={styles.exampleLabel}>Example</span>
                                            <span>{task.example}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                        </KitchenCard>
                    );
                })}
            </section>

            <section className={styles.bottomGrid}>
                <KitchenCard className={`${styles.guidanceCard} ${styles.guidanceCardOrder}`}>
                    <div className={styles.guidanceHeader}>
                        <Blocks size={18} />
                        <h3>Recommended startup order</h3>
                    </div>
                    <div className={styles.timelineList}>
                        <div className={styles.timelineItem}>
                            <span className={styles.timelineStep}>1</span>
                            <div>
                                <strong>Financial masters first</strong>
                                <p>Set up tax profiles and payment methods before activating branches.</p>
                            </div>
                        </div>
                        <div className={styles.timelineItem}>
                            <span className={styles.timelineStep}>2</span>
                            <div>
                                <strong>Branches before people</strong>
                                <p>Create outlets and operating units before assigning users, counters, or inventory controls.</p>
                            </div>
                        </div>
                        <div className={styles.timelineItem}>
                            <span className={styles.timelineStep}>3</span>
                            <div>
                                <strong>Menu masters before products</strong>
                                <p>Categories, stations, order types, and UOMs should exist before product creation.</p>
                            </div>
                        </div>
                        <div className={styles.timelineItem}>
                            <span className={styles.timelineStep}>4</span>
                            <div>
                                <strong>Inventory structure before recipes</strong>
                                <p>Item masters and vendors should be ready before recipe costing and procurement workflows go live.</p>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard className={`${styles.guidanceCard} ${styles.guidanceCardTips}`}>
                    <div className={styles.guidanceHeader}>
                        <FileStack size={18} />
                        <h3>Professional setup tips</h3>
                    </div>
                    <div className={styles.tipList}>
                        <div className={styles.tipItem}>
                            <Store size={16} />
                            <span>Keep branches in setup mode until default tax, modules, and operating controls are finalized.</span>
                        </div>
                        <div className={styles.tipItem}>
                            <Briefcase size={16} />
                            <span>Use role-based access instead of assigning permissions user-by-user wherever possible.</span>
                        </div>
                        <div className={styles.tipItem}>
                            <ChefHat size={16} />
                            <span>Create prep stations and order types early so kitchen routing stays clean from day one.</span>
                        </div>
                        <div className={styles.tipItem}>
                            <Warehouse size={16} />
                            <span>Separate client-level inventory masters from branch-level stock controls to reduce duplicate data.</span>
                        </div>
                    </div>
                </KitchenCard>
            </section>
        </div>
    );
}

export default MasterSetup;

