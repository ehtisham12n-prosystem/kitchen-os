/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    Archive,
    ArrowRight,
    BadgePercent,
    CalendarClock,
    CheckCheck,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock3,
    CookingPot,
    LayoutDashboard,
    Lock,
    MessageSquare,
    PackageSearch,
    Plus,
    RefreshCcw,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Store,
    TimerReset,
    TrendingUp,
    Trophy,
    Users,
    UtensilsCrossed,
    Wallet,
    X,
    XCircle,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { analyticsApi, cateringApi, inventoryApi, posApi } from '../api/api';
import { KitchenButton } from '../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../components/ui/KitchenCard/KitchenCard';
import { toast } from '../components/ui/KitchenToast/toast';
import { useBranchContext } from '../hooks/useBranchContext';
import { useCurrencyConfig } from '../hooks/useCurrencyConfig';
import { usePermissionAccess } from '../hooks/usePermissionAccess';
import { formatConfiguredOrderNumber } from './pos/printTemplates/printHelpers';
import styles from './bmDashboard.module.css';

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled' | 'archived';
type TaskPriority = 'high' | 'normal' | 'low';
type TaskDeskFilter = 'active' | 'all' | 'done' | 'cancelled' | 'archived';
type LiveOrderFilter = 'all' | 'delayed';

type TaskComment = { id: string; author: string; body: string; created_at: string };
type TaskItem = {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee_id: string;
    assignee_name: string;
    created_by: string;
    due_date: string;
    senior_request: boolean;
    comments: TaskComment[];
};
type PersonOption = { id: string; label: string };

const RANGE_OPTIONS = [{ value: '1', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }];
const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];
const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [{ value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }];
const TASK_FILTER_OPTIONS: Array<{ value: TaskDeskFilter; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'All' },
    { value: 'done', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];
const PIE_COLORS = ['#0f766e', '#ea580c', '#f59e0b', '#2563eb'];
const BAR_COLORS = ['#0f766e', '#b45309', '#dc2626', '#2563eb'];

const safeNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const buildDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days - 1, 0));
    return { date_from: formatDate(start), date_to: formatDate(end) };
};
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const taskStorageKey = (branchId: number) => `branch-manager-tasks:${branchId}`;
const KITCHEN_TARGET_MINUTES = 15;
const SERVICE_DELAY_MINUTES = 25;
const SERVICE_BUCKETS = [
    { label: 'On Time', maxMinutes: 0 },
    { label: '5 min', maxMinutes: 5 },
    { label: '10 min', maxMinutes: 10 },
    { label: '15 min', maxMinutes: 15 },
    { label: '20 min', maxMinutes: 20 },
    { label: '30+ min', maxMinutes: 9999 },
] as const;
const formatTaskDate = (value?: string | null) => {
    if (!value) return 'No due date';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
};
const getTaskStatusLabel = (status: TaskStatus) => TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
const getTaskDeskCollection = (tasks: TaskItem[], filter: TaskDeskFilter) => {
    if (filter === 'all') return tasks;
    if (filter === 'active') return tasks.filter((task) => ['todo', 'in_progress', 'blocked'].includes(task.status));
    return tasks.filter((task) => task.status === filter);
};

function DashboardTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.chartTooltip}>
            <div className={styles.chartTooltipLabel}>{label}</div>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className={styles.chartTooltipRow}>
                    <span>{entry.name}</span>
                    <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
                </div>
            ))}
        </div>
    );
}

const minutesBetween = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    return Math.max(Math.round((endDate.getTime() - startDate.getTime()) / 60000), 0);
};

const formatElapsed = (minutes: number | null) => {
    if (minutes === null) return 'n/a';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const normalizeServiceStatus = (status?: string | null) => {
    const value = String(status || '').toLowerCase();
    if (value === 'ready') return 'Ready';
    if (value === 'preparing' || value === 'in_progress') return 'Preparing';
    if (value === 'served') return 'Served';
    if (value === 'completed') return 'Completed';
    return 'Pending';
};

const resolveTimerState = (minutes: number | null) => {
    if (minutes === null) return 'neutral';
    if (minutes <= KITCHEN_TARGET_MINUTES) return 'onTime';
    if (minutes <= SERVICE_DELAY_MINUTES) return 'watch';
    return 'late';
};

function seedTasks(branchName: string, assignees: PersonOption[], managerName: string): TaskItem[] {
    const owner = assignees[0] ?? { id: 'self', label: managerName };
    const backup = assignees[1] ?? owner;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return [
        {
            id: makeId('task'),
            title: 'Confirm opening readiness',
            description: `Senior manager requested a clean opening for ${branchName}. Verify counters, floats, and staffing.`,
            status: 'in_progress',
            priority: 'high',
            assignee_id: owner.id,
            assignee_name: owner.label,
            created_by: 'Senior Manager',
            due_date: formatDate(today),
            senior_request: true,
            comments: [{ id: makeId('comment'), author: managerName, body: 'Checklist started from dashboard.', created_at: new Date().toISOString() }],
        },
        {
            id: makeId('task'),
            title: 'Review shortage pressure',
            description: 'Check low stock, open transfers, and procurement backlog before the next rush window.',
            status: 'todo',
            priority: 'high',
            assignee_id: backup.id,
            assignee_name: backup.label,
            created_by: 'Senior Manager',
            due_date: formatDate(tomorrow),
            senior_request: true,
            comments: [],
        },
    ];
}

function readTasks(branchId: number, branchName: string, assignees: PersonOption[], managerName: string) {
    try {
        const raw = localStorage.getItem(taskStorageKey(branchId));
        if (!raw) {
            const seeded = seedTasks(branchName, assignees, managerName);
            localStorage.setItem(taskStorageKey(branchId), JSON.stringify(seeded));
            return seeded;
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return seedTasks(branchName, assignees, managerName);
    }
}

function BranchDashboard() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const access = usePermissionAccess();
    const { formatMoney } = useCurrencyConfig();
    const branchId = activeBranch?.branch_id ? Number(activeBranch.branch_id) : null;
    const branchName = activeBranch?.branch_name || 'Branch';
    const managerName = access.userContext?.username || 'Branch Manager';
    const [rangeDays, setRangeDays] = useState('7');
    const [loading, setLoading] = useState(true);
    const [liveNow, setLiveNow] = useState(() => new Date().toISOString());
    const [management, setManagement] = useState<any | null>(null);
    const [detail, setDetail] = useState<any | null>(null);
    const [terminal, setTerminal] = useState<any | null>(null);
    const [consoleSnap, setConsoleSnap] = useState<any | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [kots, setKots] = useState<any[]>([]);
    const [inventorySnap, setInventorySnap] = useState<any | null>(null);
    const [issues, setIssues] = useState<string[]>([]);
    const [taskState, setTaskState] = useState<{ branchId: number | null; tasks: TaskItem[] }>({ branchId: null, tasks: [] });
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [taskDeskFilter, setTaskDeskFilter] = useState<TaskDeskFilter>('active');
    const [liveOrderFilter, setLiveOrderFilter] = useState<LiveOrderFilter>('all');
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', assignee_id: '', due_date: formatDate(new Date()), priority: 'normal' as TaskPriority });

    const canAssignTasks = access.canManageBranchDay || access.canManageShifts || access.canManageTillSessions || access.canManageStaff;
    const assignees = useMemo<PersonOption[]>(() => {
        const team = Array.isArray(consoleSnap?.cashiers) ? consoleSnap.cashiers.map((person: any) => ({ id: String(person.id), label: person.full_name || person.username || `User #${person.id}` })) : [];
        const manager = { id: String(access.userContext?.sub || 'self'), label: managerName };
        return [manager, ...team].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
    }, [access.userContext?.sub, consoleSnap, managerName]);

    const tasks = useMemo(() => {
        if (!branchId) return [];
        if (taskState.branchId === branchId) return taskState.tasks;
        return readTasks(branchId, branchName, assignees, managerName);
    }, [assignees, branchId, branchName, managerName, taskState]);

    const defaultAssigneeId = assignees[0]?.id || '';
    const activeNewTaskAssigneeId = newTask.assignee_id || defaultAssigneeId;

    useEffect(() => {
        const timer = window.setInterval(() => setLiveNow(new Date().toISOString()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    const effectiveSelectedTaskId = useMemo(() => {
        if (!tasks.length) return null;
        if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) return selectedTaskId;
        return tasks[0].id;
    }, [selectedTaskId, tasks]);

    const saveTasks = (updater: (current: TaskItem[]) => TaskItem[]) => {
        if (!branchId) return;
        setTaskState((current) => {
            const base = current.branchId === branchId ? current.tasks : readTasks(branchId, branchName, assignees, managerName);
            const next = updater(base);
            localStorage.setItem(taskStorageKey(branchId), JSON.stringify(next));
            return { branchId, tasks: next };
        });
    };

    useEffect(() => {
        if (!branchId) return;
        const load = async () => {
            setLoading(true);
            const range = buildDateRange(Number(rangeDays) || 7);
            const results = await Promise.allSettled([
                analyticsApi.getBranchManagementSnapshot(branchId, range),
                analyticsApi.getOperationsBranchDetail(branchId, range),
                posApi.getBranchDashboard(branchId),
                posApi.getOperationsConsole(branchId),
                cateringApi.getEvents({ branch_id: branchId }),
                posApi.getOrders(branchId),
                posApi.getKots(branchId),
                inventoryApi.getInventoryDashboard(branchId),
            ]);
            const nextIssues: string[] = [];
            if (results[0].status === 'fulfilled') setManagement(results[0].value); else { setManagement(null); nextIssues.push('Management metrics unavailable.'); }
            if (results[1].status === 'fulfilled') setDetail(results[1].value); else setDetail(null);
            if (results[2].status === 'fulfilled') setTerminal(results[2].value); else setTerminal(null);
            if (results[3].status === 'fulfilled') setConsoleSnap(results[3].value); else setConsoleSnap(null);
            if (results[4].status === 'fulfilled') setEvents(Array.isArray(results[4].value) ? results[4].value : []); else setEvents([]);
            if (results[5].status === 'fulfilled') setOrders(Array.isArray(results[5].value) ? results[5].value : []); else setOrders([]);
            if (results[6].status === 'fulfilled') setKots(Array.isArray(results[6].value) ? results[6].value : []); else setKots([]);
            if (results[7].status === 'fulfilled') setInventorySnap(results[7].value); else setInventorySnap(null);
            setIssues(nextIssues);
            setLoading(false);
        };
        void load();
    }, [branchId, rangeDays]);

    const salesLocked = safeNumber(consoleSnap?.summary?.open_counter_count) > 0 || safeNumber(consoleSnap?.summary?.blind_close_pending_count) > 0;
    const runtimeMix = [
        { name: 'Open Orders', value: safeNumber(terminal?.operational?.open_orders) },
        { name: 'Pending KOTs', value: safeNumber(terminal?.operational?.pending_kots) },
        { name: 'Open Counters', value: safeNumber(consoleSnap?.summary?.open_counter_count) },
        { name: 'Legacy Pending Close', value: safeNumber(consoleSnap?.summary?.blind_close_pending_count) },
    ].filter((item) => item.value > 0);
    const trendRows = Array.isArray(management?.sales_trend) ? management.sales_trend : [];
    const pressureRows = [
        { label: 'Inventory', value: safeNumber(management?.operational_health?.inventory_pressure_count) },
        { label: 'Procurement', value: safeNumber(management?.cards?.procurement_backlog) },
        { label: 'Transfers', value: safeNumber(management?.operational_health?.open_transfers) },
        { label: 'Blocked Tasks', value: tasks.filter((task) => task.status === 'blocked').length },
    ];
    const topProducts = Array.isArray(management?.top_products) ? management.top_products.slice(0, 4) : [];
    const upcomingEvents = events.filter((event) => String(event.status || '').toLowerCase() !== 'cancelled').slice(0, 3);
    const taskDone = tasks.filter((task) => task.status === 'done');
    const taskCancelled = tasks.filter((task) => task.status === 'cancelled');
    const taskArchived = tasks.filter((task) => task.status === 'archived');
    const taskOpen = tasks.filter((task) => ['todo', 'in_progress', 'blocked'].includes(task.status));
    const taskDeskTasks = getTaskDeskCollection(tasks, taskDeskFilter);
    const selectedTask = tasks.find((task) => task.id === effectiveSelectedTaskId) ?? null;
    const restockWatch = (Array.isArray(inventorySnap?.low_stock) ? inventorySnap.low_stock : []).slice(0, 6);
    const performance = useMemo(() => {
        const nowIso = liveNow;
        const completedOrders = orders.filter((order) => String(order.order_status || '').toLowerCase() === 'completed');
        const returnedOrders = orders.filter((order) => Array.isArray(order.returns) && order.returns.length > 0);
        const voidedOrders = orders.filter((order) => ['cancelled', 'voided'].includes(String(order.order_status || '').toLowerCase()));
        const discountedOrders = orders.filter((order) => safeNumber(order.discount_amount) > 0);
        const openOrders = orders.filter((order) => ['held', 'pending', 'preparing', 'ready', 'served'].includes(String(order.order_status || '').toLowerCase()));
        const delayedOpenOrders = openOrders.filter((order) => {
            const age = minutesBetween(order.created_at, nowIso);
            return age !== null && age > SERVICE_DELAY_MINUTES;
        });
        const completedWithinTarget = completedOrders.filter((order) => {
            const mins = minutesBetween(order.created_at, order.finalized_at || order.updated_at);
            return mins !== null && mins <= KITCHEN_TARGET_MINUTES;
        });
        const completedLate = completedOrders.filter((order) => {
            const mins = minutesBetween(order.created_at, order.finalized_at || order.updated_at);
            return mins !== null && mins > KITCHEN_TARGET_MINUTES;
        });
        const completedWithServiceMinutes = completedOrders
            .map((order) => ({
                order,
                minutes: minutesBetween(order.created_at, order.finalized_at || order.updated_at),
            }))
            .filter((entry): entry is { order: any; minutes: number } => entry.minutes !== null);
        const serviceBuckets = SERVICE_BUCKETS.map((bucket, index) => {
            if (bucket.label === 'On Time') {
                return {
                    label: bucket.label,
                    count: completedWithServiceMinutes.filter((entry) => entry.minutes <= KITCHEN_TARGET_MINUTES).length,
                };
            }
            if (bucket.label === '30+ min') {
                return {
                    label: bucket.label,
                    count: completedWithServiceMinutes.filter((entry) => entry.minutes > 30).length,
                };
            }
            const previousMax = SERVICE_BUCKETS[index - 1]?.maxMinutes ?? KITCHEN_TARGET_MINUTES;
            return {
                label: bucket.label,
                count: completedWithServiceMinutes.filter((entry) => entry.minutes > previousMax && entry.minutes <= bucket.maxMinutes).length,
            };
        });
        const cancelledAfterDelay = voidedOrders.filter((order) => {
            const mins = minutesBetween(order.created_at, order.voided_at || order.updated_at);
            return mins !== null && mins > KITCHEN_TARGET_MINUTES;
        });

        const counterMap = new Map<string, any>();
        const serverMap = new Map<string, any>();
        const cancelledProductMap = new Map<string, any>();
        const delayedProductMap = new Map<string, any>();
        for (const order of orders) {
            const counterKey = String(order.sale_counter_name || order.sale_counter_code || 'Unassigned Counter');
            const serverKey = String(order.order_taker_name || order.order_taker_username || 'Unassigned Server');
            const orderValue = safeNumber(order.total_amount);
            const isCompleted = String(order.order_status || '').toLowerCase() === 'completed';
            const isReturned = Array.isArray(order.returns) && order.returns.length > 0;
            const isVoided = ['cancelled', 'voided'].includes(String(order.order_status || '').toLowerCase());
            const isDiscounted = safeNumber(order.discount_amount) > 0;
            const age = minutesBetween(order.created_at, order.finalized_at || order.updated_at || nowIso);
            const isDelayed = age !== null && age > SERVICE_DELAY_MINUTES;

            const nextCounter = counterMap.get(counterKey) ?? { name: counterKey, orders: 0, revenue: 0, open: 0, returns: 0, voids: 0 };
            nextCounter.orders += 1;
            nextCounter.revenue += isCompleted ? orderValue : 0;
            nextCounter.open += isCompleted || isVoided ? 0 : 1;
            nextCounter.returns += isReturned ? 1 : 0;
            nextCounter.voids += isVoided ? 1 : 0;
            counterMap.set(counterKey, nextCounter);

            const nextServer = serverMap.get(serverKey) ?? { name: serverKey, orders: 0, revenue: 0, returns: 0, voids: 0, discounts: 0, delayed: 0 };
            nextServer.orders += 1;
            nextServer.revenue += isCompleted ? orderValue : 0;
            nextServer.returns += isReturned ? 1 : 0;
            nextServer.voids += isVoided ? 1 : 0;
            nextServer.discounts += isDiscounted ? 1 : 0;
            nextServer.delayed += isDelayed ? 1 : 0;
            serverMap.set(serverKey, nextServer);

            const activeItems = Array.isArray(order.items) ? order.items : [];
            if (isVoided) {
                activeItems.forEach((item: any) => {
                    const key = String(item.product_name || `Product #${item.product_id || 'N/A'}`);
                    const next = cancelledProductMap.get(key) ?? { name: key, lines: 0, qty: 0, orders: 0 };
                    next.lines += 1;
                    next.qty += safeNumber(item.quantity);
                    next.orders += 1;
                    cancelledProductMap.set(key, next);
                });
            } else {
                activeItems
                    .filter((item: any) => String(item.item_status || '').toLowerCase() === 'voided')
                    .forEach((item: any) => {
                        const key = String(item.product_name || `Product #${item.product_id || 'N/A'}`);
                        const next = cancelledProductMap.get(key) ?? { name: key, lines: 0, qty: 0, orders: 0 };
                        next.lines += 1;
                        next.qty += safeNumber(item.quantity);
                        next.orders += 1;
                        cancelledProductMap.set(key, next);
                    });
            }

            if (isDelayed) {
                activeItems
                    .filter((item: any) => String(item.item_status || '').toLowerCase() !== 'voided')
                    .forEach((item: any) => {
                        const key = String(item.product_name || `Product #${item.product_id || 'N/A'}`);
                        const next = delayedProductMap.get(key) ?? { name: key, lines: 0, qty: 0, orders: 0 };
                        next.lines += 1;
                        next.qty += safeNumber(item.quantity);
                        next.orders += 1;
                        delayedProductMap.set(key, next);
                    });
            }
        }

        const activeKots = kots.filter((kot) => ['pending', 'preparing', 'ready'].includes(String(kot.status || '').toLowerCase()));
        const overdueKots = activeKots.filter((kot) => {
            const age = minutesBetween(kot.created_at, nowIso);
            return age !== null && age > KITCHEN_TARGET_MINUTES;
        });
        const readyKots = activeKots.filter((kot) => String(kot.status || '').toLowerCase() === 'ready');
        const livePendingOrders = openOrders
            .map((order) => {
                const linkedKots = kots
                    .filter((kot) => String(kot.order_id || kot.orderId || '') === String(order.id))
                    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
                const latestKot = linkedKots[0];
                const orderStatusRaw = String(order.order_status || 'pending').toLowerCase();
                const timerMinutes = minutesBetween(order.created_at, nowIso);
                return {
                    id: order.id,
                    orderNumber: formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, order, { preserveTypePrefix: true }) || order.order_number || `Order #${order.id}`,
                    tableLabel: order.table_name || order.table_number || order.table_label || 'Walk-in',
                    serverName: order.order_taker_name || order.order_taker_username || 'Unassigned',
                    serviceMode: String(order.order_type || order.service_type || 'Dine In').replace(/_/g, ' '),
                    orderStatus: String(order.order_status || 'pending').replace(/_/g, ' '),
                    serviceStatus: latestKot?.status
                        ? normalizeServiceStatus(latestKot.status)
                        : orderStatusRaw === 'ready'
                            ? 'Ready'
                            : orderStatusRaw === 'served'
                                ? 'Served'
                                : orderStatusRaw === 'preparing'
                                    ? 'Preparing'
                                    : 'Pending',
                    timerMinutes,
                    timerState: resolveTimerState(timerMinutes),
                    createdAt: order.created_at,
                };
            })
            .sort((left, right) => {
                if ((right.timerMinutes ?? -1) !== (left.timerMinutes ?? -1)) {
                    return (right.timerMinutes ?? -1) - (left.timerMinutes ?? -1);
                }
                return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
            })
            .slice(0, 10);

        const totalRevenue = safeNumber(management?.cards?.total_revenue);
        const totalDiscount = orders.reduce((sum, order) => sum + safeNumber(order.discount_amount), 0);
        const totalReturnsValue = returnedOrders.reduce((sum, order) => sum + safeNumber(order.refunded_amount || order.latest_return?.refund_amount), 0);
        const wastageCost = safeNumber(management?.cards?.wastage_cost);
        const lowStockRate = safeNumber(management?.operational_health?.waste_level);
        const returnRate = completedOrders.length > 0 ? (returnedOrders.length / completedOrders.length) * 100 : 0;
        const voidRate = orders.length > 0 ? (voidedOrders.length / orders.length) * 100 : 0;
        const discountRate = orders.length > 0 ? (discountedOrders.length / orders.length) * 100 : 0;
        const expensePressure = totalRevenue > 0 ? ((wastageCost + totalReturnsValue + totalDiscount) / totalRevenue) * 100 : 0;

        return {
            completedOrders,
            returnedOrders,
            voidedOrders,
            discountedOrders,
            delayedOpenOrders,
            completedWithinTarget,
            completedLate,
            serviceBuckets,
            cancelledAfterDelay,
            activeKots,
            overdueKots,
            readyKots,
            livePendingOrders,
            counters: Array.from(counterMap.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 5),
            servers: Array.from(serverMap.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 6),
            cancelledProducts: Array.from(cancelledProductMap.values()).sort((left, right) => right.qty - left.qty).slice(0, 6),
            delayedProducts: Array.from(delayedProductMap.values()).sort((left, right) => right.qty - left.qty).slice(0, 6),
            ratios: {
                returnRate,
                voidRate,
                discountRate,
                expensePressure,
                lowStockRate,
            },
            totals: {
                revenue: totalRevenue,
                discount: totalDiscount,
                returnsValue: totalReturnsValue,
                wastageCost,
                inventoryOnHand: safeNumber(inventorySnap?.summary?.on_hand_quantity),
                pendingApproval: safeNumber(inventorySnap?.procurement?.pending_approval),
                awaitingReceipt: safeNumber(inventorySnap?.procurement?.awaiting_receipt),
            },
        };
    }, [inventorySnap, kots, liveNow, management?.cards?.total_revenue, management?.cards?.wastage_cost, management?.operational_health?.waste_level, orders]);
    const livePendingOrdersView = liveOrderFilter === 'delayed'
        ? performance.livePendingOrders.filter((order: any) => order.timerState === 'late')
        : performance.livePendingOrders;

    const quickActions = [
        { title: 'Manager Console', icon: ShieldCheck, desc: 'Business-day, counter, and close control', onClick: () => navigate('/terminal/day'), visible: access.canManageBranchDay || access.canManageShifts || access.canManageTillSessions },
        { title: 'Open POS', icon: ShoppingCart, desc: 'Jump into daily service operations', onClick: () => navigate('/terminal/pos'), visible: access.canOperatePos || access.canReadPos },
        { title: 'Sales Reports', icon: TrendingUp, desc: 'Formal reporting after counters close', onClick: () => navigate('/console/reports/sales'), visible: access.canViewPosReports },
        { title: 'Inventory Watch', icon: PackageSearch, desc: 'Counts, shortages, and adjustments', onClick: () => navigate('/console/inventory/stock-count'), visible: access.canReadInventory },
        { title: 'Detailed Analytics', icon: Trophy, desc: 'Open sales and comparative reporting', onClick: () => navigate('/console/reports/sales'), visible: access.canViewPosReports },
    ].filter((item) => item.visible);

    const updateTask = (taskId: string, patch: Partial<TaskItem>) => saveTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch } : task));
    const addComment = (taskId: string) => {
        const body = String(commentDrafts[taskId] || '').trim();
        if (!body) return;
        saveTasks((current) => current.map((task) => task.id === taskId ? { ...task, comments: [...task.comments, { id: makeId('comment'), author: managerName, body, created_at: new Date().toISOString() }] } : task));
        setCommentDrafts((current) => ({ ...current, [taskId]: '' }));
    };
    const createTask = () => {
        if (!newTask.title.trim()) {
            toast.error('Task title required', 'Add a task title before creating the assignment.');
            return;
        }
        const assignee = assignees.find((item) => item.id === activeNewTaskAssigneeId) ?? assignees[0] ?? { id: 'self', label: managerName };
        const createdTask: TaskItem = {
            id: makeId('task'),
            title: newTask.title.trim(),
            description: newTask.description.trim(),
            status: 'todo',
            priority: newTask.priority,
            assignee_id: assignee.id,
            assignee_name: assignee.label,
            created_by: managerName,
            due_date: newTask.due_date,
            senior_request: false,
            comments: [],
        };
        saveTasks((current) => [{
            ...createdTask,
        }, ...current]);
        setSelectedTaskId(createdTask.id);
        setTaskDeskFilter('active');
        setNewTask({ title: '', description: '', assignee_id: '', due_date: formatDate(new Date()), priority: 'normal' });
    };

    const renderTaskRows = (rows: TaskItem[], emptyMessage: string) => {
        if (rows.length === 0) {
            return <div className={styles.emptyPanel}><ClipboardList size={18} /><span>{emptyMessage}</span></div>;
        }
        return rows.map((task) => (
            <button
                key={task.id}
                type="button"
                className={`${styles.taskInboxRow} ${effectiveSelectedTaskId === task.id ? styles.taskInboxRowActive : ''}`}
                onClick={() => setSelectedTaskId(task.id)}
            >
                <div className={styles.taskInboxMeta}>
                    <strong>{task.created_by}</strong>
                    <span>{formatTaskDate(task.due_date)}</span>
                </div>
                <div className={styles.taskInboxMain}>
                    <span className={styles.taskInboxSubject}>{task.title}</span>
                    <span>{task.assignee_name}</span>
                </div>
                <div className={styles.taskInboxPreview}>
                    <span>{getTaskStatusLabel(task.status)}</span>
                    <span>{task.description || 'No detail added yet.'}</span>
                </div>
                <div className={styles.taskInboxPriorityCell}>
                    <span className={`${styles.taskPriorityChip} ${styles[`priority_${task.priority}`]}`}>{task.priority}</span>
                </div>
            </button>
        ));
    };

    const taskDetailPanel = selectedTask ? (
        <div className={styles.taskDetailPanel}>
            <div className={styles.taskDetailHeader}>
                <div>
                    <div className={styles.taskDetailTopline}>
                        <span className={`${styles.taskPriorityChip} ${styles[`priority_${selectedTask.priority}`]}`}>{selectedTask.priority}</span>
                        {selectedTask.senior_request ? <span className={styles.taskChipAccent}>Senior request</span> : null}
                        <span className={styles.taskChipDone}>{getTaskStatusLabel(selectedTask.status)}</span>
                    </div>
                    <h4>{selectedTask.title}</h4>
                    <p>{selectedTask.description || 'No detail added yet.'}</p>
                </div>
                <div className={styles.taskDetailFacts}>
                    <span><ClipboardList size={13} /> {selectedTask.created_by}</span>
                    <span><Users size={13} /> {selectedTask.assignee_name}</span>
                    <span><TimerReset size={13} /> {formatTaskDate(selectedTask.due_date)}</span>
                </div>
            </div>
            <div className={styles.taskDetailSectionLabel}>Task controls</div>
            <div className={styles.taskDetailControls}>
                <label className={`${styles.inlineField} ${styles.taskDetailControlCard}`}>
                    <span className={styles.taskDetailControlLabel}><ShieldCheck size={12} />Status</span>
                    <select className={styles.taskDetailInput} value={selectedTask.status} onChange={(event) => updateTask(selectedTask.id, { status: event.target.value as TaskStatus })}>
                        {TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <label className={`${styles.inlineField} ${styles.taskDetailControlCard}`}>
                    <span className={styles.taskDetailControlLabel}><Users size={12} />Assignee</span>
                    <select
                        className={styles.taskDetailInput}
                        value={selectedTask.assignee_id}
                        onChange={(event) => {
                            const assignee = assignees.find((item) => item.id === event.target.value);
                            updateTask(selectedTask.id, { assignee_id: event.target.value, assignee_name: assignee?.label || selectedTask.assignee_name });
                        }}
                        disabled={!canAssignTasks}
                    >
                        {assignees.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
                    </select>
                </label>
                <label className={`${styles.inlineField} ${styles.taskDetailControlCard}`}>
                    <span className={styles.taskDetailControlLabel}><CalendarClock size={12} />Due date</span>
                    <input className={styles.taskDetailInput} type="date" value={selectedTask.due_date || ''} onChange={(event) => updateTask(selectedTask.id, { due_date: event.target.value })} />
                </label>
            </div>
            <div className={styles.taskActionRow}>
                <KitchenButton variant="secondary" onClick={() => updateTask(selectedTask.id, { status: 'done' })}><CheckCheck size={14} />Complete</KitchenButton>
                <KitchenButton variant="secondary" onClick={() => updateTask(selectedTask.id, { status: 'cancelled' })}><XCircle size={14} />Cancel</KitchenButton>
                <KitchenButton variant="secondary" onClick={() => updateTask(selectedTask.id, { status: 'archived' })}><Archive size={14} />Archive</KitchenButton>
            </div>
            <div className={styles.taskDetailSectionLabel}>Activity note</div>
            <div className={styles.commentComposer}>
                <textarea
                    className={styles.taskCommentInput}
                    placeholder="Write a follow-up, handoff note, or status update"
                    value={commentDrafts[selectedTask.id] || ''}
                    onChange={(event) => setCommentDrafts((current) => ({ ...current, [selectedTask.id]: event.target.value }))}
                    rows={3}
                />
                <KitchenButton variant="secondary" onClick={() => addComment(selectedTask.id)}><MessageSquare size={14} />Comment</KitchenButton>
            </div>
            <div className={styles.commentList}>
                {selectedTask.comments.length === 0 ? <span className={styles.commentEmpty}>No comments yet.</span> : selectedTask.comments.slice().reverse().map((comment) => (
                    <div key={comment.id} className={styles.commentItem}>
                        <strong>{comment.author}</strong>
                        <span>{comment.body}</span>
                    </div>
                ))}
            </div>
        </div>
    ) : (
        <div className={styles.emptyPanel}><ClipboardList size={18} /><span>Select a task to view detail.</span></div>
    );

    if (!branchId) return <div className={styles.emptyState}>Select a branch to open the branch manager dashboard.</div>;
    if (loading) return <div className={styles.loaderShell}><div className={styles.loaderOrb} /><div><h2>Preparing branch manager workspace</h2><p>Collecting branch runtime, tasks, and event context.</p></div></div>;

    return (
        <div className={styles.container}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <div className={styles.heroBadges}><span className={styles.heroBadge}>Branch Manager Workspace</span><span className={styles.heroBadgeAlt}><Sparkles size={14} /> Live operations</span></div>
                    <h1>{branchName}</h1>
                    <p>Compact branch oversight with runtime visibility, quick actions, events, and a live task desk.</p>
                    <div className={styles.heroMeta}><span><Store size={14} /> {management?.branch?.branch_code || 'Active branch selected'}</span><span><Clock3 size={14} /> {new Date().toLocaleString('en-PK', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
                    <div className={`${styles.heroPanel} ${styles.heroPanelPolished}`}>
                        <div className={styles.heroPanelTop}><span>Runtime Health</span><strong>{Math.max(15, 100 - safeNumber(consoleSnap?.summary?.blind_close_pending_count) * 12 - safeNumber(terminal?.operational?.pending_kots) * 3)}%</strong></div>
                        <div className={styles.heroMeter}><div className={styles.heroMeterFill} style={{ width: `${Math.max(15, 100 - safeNumber(consoleSnap?.summary?.blind_close_pending_count) * 12 - safeNumber(terminal?.operational?.pending_kots) * 3)}%` }} /></div>
                    <div className={styles.heroStats}><div className={styles.heroStatTile}><span>Open counters</span><strong>{safeNumber(consoleSnap?.summary?.open_counter_count)}</strong></div><div className={styles.heroStatTile}><span>Pending KOTs</span><strong>{safeNumber(terminal?.operational?.pending_kots)}</strong></div><div className={styles.heroStatTile}><span>Open orders</span><strong>{safeNumber(terminal?.operational?.open_orders)}</strong></div><div className={styles.heroStatTile}><span>Events</span><strong>{upcomingEvents.length}</strong></div></div>
                        <div className={styles.heroActions}><select value={rangeDays} onChange={(event) => setRangeDays(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><KitchenButton variant="secondary" onClick={() => window.location.reload()}><RefreshCcw size={14} />Refresh</KitchenButton></div>
                    </div>
            </section>

            {issues.length > 0 ? (
                <section className={styles.issueBanner}>
                    <AlertTriangle size={18} />
                    <div><strong>Some panels are partially unavailable.</strong><p>{issues[0]}</p></div>
                </section>
            ) : null}

            <section className={styles.actionStrip}>
                {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button key={action.title} type="button" className={styles.actionCard} onClick={action.onClick}>
                            <div className={styles.actionIcon}><Icon size={18} /></div>
                            <div className={styles.actionText}><strong>{action.title}</strong><span>{action.desc}</span></div>
                            <ArrowRight size={16} className={styles.actionArrow} />
                        </button>
                    );
                })}
            </section>

            <section className={styles.kpiGrid}>
                <KitchenCard className={styles.kpiCard}><div className={styles.kpiLabel}>Active day operations</div><div className={styles.kpiValue}>{safeNumber(consoleSnap?.summary?.active_shift_count)}</div><div className={styles.kpiMeta}>Running business-day coverage</div></KitchenCard>
                <KitchenCard className={styles.kpiCard}><div className={styles.kpiLabel}>Counters live</div><div className={styles.kpiValue}>{safeNumber(consoleSnap?.summary?.open_counter_count)}</div><div className={styles.kpiMeta}>Real-time branch runtime</div></KitchenCard>
                <KitchenCard className={styles.kpiCard}><div className={styles.kpiLabel}>Inventory pressure</div><div className={styles.kpiValue}>{safeNumber(management?.operational_health?.inventory_pressure_count)}</div><div className={styles.kpiMeta}>Low, out, and negative stock items</div></KitchenCard>
                <KitchenCard className={styles.kpiCard}><div className={styles.kpiLabel}>Open tasks</div><div className={styles.kpiValue}>{taskOpen.length}</div><div className={styles.kpiMeta}>{taskDone.length} completed, {tasks.filter((task) => task.status === 'blocked').length} blocked</div></KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${salesLocked ? styles.kpiLocked : styles.kpiAccent}`}>
                    <div className={styles.kpiLabel}>Finalized sales</div>
                    <div className={styles.kpiValue}>{salesLocked ? <><Lock size={16} />Locked</> : formatMoney(management?.cards?.total_revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div className={styles.kpiMeta}>{salesLocked ? 'Shown only after counters are closed and verified.' : `${safeNumber(management?.cards?.completed_orders)} completed orders in scope`}</div>
                </KitchenCard>
            </section>

            <section className={styles.priorityGrid}>
                <KitchenCard className={`${styles.performanceCard} ${styles.priorityLiveCard} ${styles.liveClusterCard}`}>
                    <div className={styles.sectionHead}>
                        <div><h3>Live Pending Orders</h3><p>Orders needing service follow-up right now.</p></div>
                        <div className={styles.livePendingActions}>
                            <div className={styles.taskDeskFilters}>
                                <button type="button" className={`${styles.taskFilterChip} ${liveOrderFilter === 'all' ? styles.taskFilterChipActive : ''}`} onClick={() => setLiveOrderFilter('all')}>All</button>
                                <button type="button" className={`${styles.taskFilterChip} ${liveOrderFilter === 'delayed' ? styles.taskFilterChipActive : ''}`} onClick={() => setLiveOrderFilter('delayed')}>Delayed</button>
                            </div>
                            <span className={styles.sectionBadgeNeutral}>{livePendingOrdersView.length} visible</span>
                        </div>
                    </div>
                    {livePendingOrdersView.length === 0 ? (
                        <div className={styles.emptyPanel}><ShoppingCart size={18} /><span>No pending or in-service orders right now.</span></div>
                    ) : (
                        <div className={styles.liveOrderList}>
                            {livePendingOrdersView.map((order: any) => (
                                <div key={order.id} className={styles.liveOrderRow}>
                                    <div className={styles.liveOrderMain}>
                                        <div className={styles.liveOrderTop}>
                                            <strong>{order.orderNumber}</strong>
                                        </div>
                                        <div className={styles.liveOrderMeta}>
                                            <span>Table {order.tableLabel}</span>
                                            <span>{order.serverName}</span>
                                            <span>{order.serviceMode}</span>
                                        </div>
                                    </div>
                                    <div className={styles.liveTimerLane}>
                                        <span className={styles.liveStatusLabel}>Timer</span>
                                        <strong className={`${styles.liveTimerValue} ${styles[`liveTimer_${order.timerState}`]}`}>{formatElapsed(order.timerMinutes)}</strong>
                                    </div>
                                    <div className={styles.liveOrderSide}>
                                        <span className={styles.liveStatusLabel}>Order</span>
                                        <strong>{order.orderStatus}</strong>
                                    </div>
                                    <div className={styles.liveOrderSide}>
                                        <span className={styles.liveStatusLabel}>Service</span>
                                        <strong>{order.serviceStatus}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </KitchenCard>

                <KitchenCard className={`${styles.performanceCard} ${styles.serviceClusterCard}`}>
                    <div className={styles.sectionHead}>
                        <div><h3>Service KPIs</h3><p>Execution, recovery, delay, and discount pressure.</p></div>
                        <span className={styles.sectionBadgeNeutral}>Live</span>
                    </div>
                    <div className={styles.performanceGrid}>
                        <div className={styles.metricTile}><span>Orders</span><strong>{orders.length}</strong><small>{performance.completedOrders.length} completed</small></div>
                        <div className={styles.metricTile}><span>Delayed Open</span><strong>{performance.delayedOpenOrders.length}</strong><small>{`>${SERVICE_DELAY_MINUTES} min active`}</small></div>
                        <div className={styles.metricTile}><span>Void / Cancel</span><strong>{performance.voidedOrders.length}</strong><small>{performance.ratios.voidRate.toFixed(1)}% of total</small></div>
                        <div className={styles.metricTile}><span>Returns</span><strong>{performance.returnedOrders.length}</strong><small>{performance.ratios.returnRate.toFixed(1)}% of completed</small></div>
                        <div className={styles.metricTile}><span>Discounted</span><strong>{performance.discountedOrders.length}</strong><small>{formatMoney(performance.totals.discount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</small></div>
                        <div className={styles.metricTile}><span>Expense Pressure</span><strong>{performance.ratios.expensePressure.toFixed(1)}%</strong><small>Discount + return + waste vs sales</small></div>
                    </div>
                </KitchenCard>

                <KitchenCard className={`${styles.performanceCard} ${styles.kitchenClusterCard}`}>
                    <div className={styles.sectionHead}>
                        <div><h3>Kitchen & Fulfilment</h3><p>Backlog and service timing from current runtime.</p></div>
                        <span className={styles.sectionBadge}>Target {KITCHEN_TARGET_MINUTES} min</span>
                    </div>
                    <div className={styles.performanceGrid}>
                        <div className={styles.metricTile}><span>Active KOTs</span><strong>{performance.activeKots.length}</strong><small>{performance.readyKots.length} ready to serve</small></div>
                        <div className={styles.metricTile}><span>Overdue KOTs</span><strong>{performance.overdueKots.length}</strong><small>Kitchen backlog beyond target</small></div>
                        <div className={styles.metricTile}><span>On-Time</span><strong>{performance.completedWithinTarget.length}</strong><small>Completed within target window</small></div>
                        <div className={styles.metricTile}><span>Late Service</span><strong>{performance.completedLate.length}</strong><small>Completed after target window</small></div>
                        <div className={styles.metricTile}><span>Inventory on Hand</span><strong>{performance.totals.inventoryOnHand.toFixed(0)}</strong><small>Units across enabled stock</small></div>
                        <div className={styles.metricTile}><span>Procurement Queue</span><strong>{performance.totals.pendingApproval + performance.totals.awaitingReceipt}</strong><small>{performance.totals.pendingApproval} pending, {performance.totals.awaitingReceipt} awaiting receipt</small></div>
                    </div>
                </KitchenCard>

                <KitchenCard className={`${styles.performanceCard} ${styles.pulseClusterCard}`}>
                    <div className={styles.sectionHead}><div><h3>Branch Pulse</h3><p>Immediate floor context and risk markers.</p></div></div>
                    <div className={styles.pulseList}>
                        <div className={styles.pulseRow}><span><LayoutDashboard size={14} /> Current business day</span><strong>{terminal?.current_shift ? String(terminal.current_shift.status || 'open').replace(/_/g, ' ') : 'No active business day'}</strong></div>
                        <div className={styles.pulseRow}><span><AlertTriangle size={14} /> Legacy pending close</span><strong>{safeNumber(consoleSnap?.summary?.blind_close_pending_count)}</strong></div>
                        <div className={styles.pulseRow}><span><CookingPot size={14} /> Pending KOTs</span><strong>{safeNumber(terminal?.operational?.pending_kots)}</strong></div>
                        <div className={styles.pulseRow}><span><PackageSearch size={14} /> Low-stock items</span><strong>{safeNumber(management?.cards?.low_stock_items)}</strong></div>
                        <div className={styles.pulseRow}><span><Wallet size={14} /> Return value</span><strong>{formatMoney(performance.totals.returnsValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></div>
                        <div className={styles.pulseRow}><span><BadgePercent size={14} /> Discount rate</span><strong>{performance.ratios.discountRate.toFixed(1)}%</strong></div>
                    </div>
                </KitchenCard>
            </section>

            <section className={styles.mainGrid}>
                <div className={styles.primaryColumn}>
                    <div className={styles.topAnalyticsGrid}>
                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard} ${styles.trendCard} ${styles.compactTrendCard}`}>
                            <div className={styles.sectionHead}><div><h3>Revenue Trend</h3><p>Formal sales stays protected until close.</p></div>{!salesLocked ? <span className={styles.sectionBadge}>Finance-safe</span> : null}</div>
                            {salesLocked ? (
                                <div className={styles.lockedPanel}><Lock size={22} /><strong>Sales analytics are intentionally withheld</strong><p>Branch managers can still monitor runtime, tasks, and events. Final sales appear after counter close verification.</p></div>
                            ) : (
                                <div className={styles.chartCanvas}>
                                    <ResponsiveContainer width="100%" height={132}>
                                        <AreaChart data={trendRows}>
                                            <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} /><stop offset="95%" stopColor="#0f766e" stopOpacity={0.04} /></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,23,42,0.08)" vertical={false} />
                                            <XAxis dataKey="business_date" tickFormatter={(value) => String(value).slice(5)} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                                            <Tooltip content={<DashboardTooltip />} />
                                            <Area type="monotone" dataKey="total_revenue" name="Revenue" stroke="#0f766e" fill="url(#salesFill)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </KitchenCard>

                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard} ${styles.runtimeCardCompact}`}>
                            <div className={styles.sectionHead}><div><h3>Live Runtime Mix</h3><p>Immediate branch pressure by workload.</p></div><span className={styles.sectionBadgeNeutral}>Now</span></div>
                            <div className={styles.runtimeSplit}>
                                <div className={styles.runtimeChart}>
                                    <ResponsiveContainer width="100%" height={86}>
                                        <PieChart>
                                            <Pie data={runtimeMix.length > 0 ? runtimeMix : [{ name: 'Stable Runtime', value: 1 }]} dataKey="value" nameKey="name" innerRadius={22} outerRadius={40} paddingAngle={3}>
                                                {(runtimeMix.length > 0 ? runtimeMix : [{ name: 'Stable Runtime', value: 1 }]).map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<DashboardTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className={styles.runtimeLegend}>
                                    {(runtimeMix.length > 0 ? runtimeMix : [{ name: 'Stable Runtime', value: 1 }]).map((entry, index) => (
                                        <div key={entry.name} className={styles.legendRow}><span className={styles.legendSwatch} style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} /><span>{entry.name}</span><strong>{entry.value}</strong></div>
                                    ))}
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={`${styles.chartCard} ${styles.sideAccentCard} ${styles.restockCard}`}>
                            <div className={styles.sectionHead}><div><h3>Restock Watch</h3><p>Near-finish and urgent restock items.</p></div><span className={styles.sectionBadge}>{safeNumber(inventorySnap?.summary?.low_stock_count)} flagged</span></div>
                            {restockWatch.length === 0 ? (
                                <div className={styles.emptyPanel}><PackageSearch size={18} /><span>No near-restock items are flagged for this branch.</span></div>
                            ) : (
                                <div className={styles.productList}>
                                    {restockWatch.map((item: any, index: number) => {
                                        const itemName = item.item?.item_name || `Item #${item.item_id}`;
                                        const currentQty = safeNumber(item.current_quantity);
                                        const reorderQty = safeNumber(item.min_level);
                                        return (
                                            <div key={item.item_id || `${itemName}-${index}`} className={styles.restockRow}>
                                                <div className={styles.productRank}>{index + 1}</div>
                                                <div className={styles.productInfo}>
                                                    <strong>{itemName}</strong>
                                                    <span>{currentQty.toFixed(2)} on hand • reorder {reorderQty.toFixed(2)}</span>
                                                </div>
                                                <span className={`${styles.alertBadge} ${currentQty <= 0 ? styles.badgeCritical : styles.badgeWarning}`}>
                                                    {currentQty <= 0 ? 'urgent' : 'watch'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </KitchenCard>
                    </div>

                    <div className={styles.chartGrid}>
                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard} ${styles.compactPressureCard}`}>
                            <div className={styles.sectionHead}><div><h3>Operational Pressure</h3><p>Shortages, backlog, transfers, and blocked work.</p></div></div>
                            <div className={styles.chartCanvas}>
                                <ResponsiveContainer width="100%" height={118}>
                                    <BarChart data={pressureRows}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,23,42,0.08)" vertical={false} />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                                        <Tooltip content={<DashboardTooltip />} />
                                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>{pressureRows.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}</Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard}`}>
                            <div className={styles.sectionHead}><div><h3>Top Products</h3><p>Best performers in scope.</p></div></div>
                            {salesLocked ? (
                                <div className={styles.lockedMiniPanel}><Lock size={18} /><span>Top-product analytics unlock after counter close.</span></div>
                            ) : topProducts.length === 0 ? (
                                <div className={styles.emptyPanel}><TrendingUp size={18} /><span>No completed sales captured in this range.</span></div>
                            ) : (
                                <div className={styles.productList}>
                                    {topProducts.map((item: any, index: number) => (
                                        <div key={item.product_id || `${item.product_name}-${index}`} className={styles.productRow}>
                                            <div className={styles.productRank}>{index + 1}</div>
                                            <div className={styles.productInfo}><strong>{String(item.product_name || 'Product').slice(0, 22)}</strong><span>{safeNumber(item.quantity_sold).toLocaleString()} sold</span></div>
                                            <div className={styles.productValue}>{formatMoney(item.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </KitchenCard>
                    </div>

                    <div className={styles.chartGrid}>
                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard}`}>
                            <div className={styles.sectionHead}><div><h3>Service Counters</h3><p>Counter throughput, revenue, open load, and recovery cases.</p></div></div>
                            <div className={styles.rankingList}>
                                {performance.counters.length === 0 ? <div className={styles.emptyPanel}><UtensilsCrossed size={18} /><span>No counter performance data in scope yet.</span></div> : performance.counters.map((counter: any, index: number) => (
                                    <div key={`${counter.name}-${index}`} className={styles.rankRow}>
                                        <div className={styles.rankBadge}>{index + 1}</div>
                                        <div className={styles.rankInfo}>
                                            <strong>{counter.name}</strong>
                                            <span>{counter.orders} orders • {counter.open} still active</span>
                                        </div>
                                        <div className={styles.rankMeta}>
                                            <strong>{formatMoney(counter.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                                            <span>{counter.returns} returns • {counter.voids} voids</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </KitchenCard>

                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard}`}>
                            <div className={styles.sectionHead}><div><h3>Order Taker / Server Performance</h3><p>Orders, revenue, discounts, delays, returns, and voids by staff.</p></div></div>
                            <div className={styles.rankingList}>
                                {performance.servers.length === 0 ? <div className={styles.emptyPanel}><Users size={18} /><span>No staff performance rows are available yet.</span></div> : performance.servers.map((server: any, index: number) => (
                                    <div key={`${server.name}-${index}`} className={styles.rankRow}>
                                        <div className={styles.rankBadge}>{index + 1}</div>
                                        <div className={styles.rankInfo}>
                                            <strong>{server.name}</strong>
                                            <span>{server.orders} orders • {server.delayed} delayed</span>
                                        </div>
                                        <div className={styles.rankMeta}>
                                            <strong>{formatMoney(server.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                                            <span>{server.discounts} discounted • {server.returns} returns • {server.voids} voids</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.chartGrid}>
                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard}`}>
                            <div className={styles.sectionHead}><div><h3>Order Service Performance</h3><p>Completed-order timing buckets and delayed cancellations.</p></div><span className={styles.sectionBadgeNeutral}>Target {KITCHEN_TARGET_MINUTES} min</span></div>
                            <div className={styles.serviceBucketGrid}>
                                {performance.serviceBuckets.map((bucket: any) => (
                                    <div key={bucket.label} className={styles.metricTile}>
                                        <span>{bucket.label}</span>
                                        <strong>{bucket.count}</strong>
                                        <small>{bucket.label === 'On Time' ? 'Completed within target' : 'Orders in this delay band'}</small>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.delayFooterRow}>
                                <div className={styles.metricTile}>
                                    <span>Cancelled / Void After Delay</span>
                                    <strong>{performance.cancelledAfterDelay.length}</strong>
                                    <small>{`Cancelled or voided after ${KITCHEN_TARGET_MINUTES} min`}</small>
                                </div>
                            </div>
                        </KitchenCard>

                        <KitchenCard className={`${styles.chartCard} ${styles.analyticsCard} ${styles.compactDelayCard}`}>
                            <div className={styles.sectionHead}><div><h3>Product / Line Item Delay & Cancellation</h3><p>Items most exposed to delay and cancellation pressure.</p></div></div>
                            <div className={styles.dualRankGrid}>
                                <div>
                                    <div className={styles.subsectionLabel}>Delayed Items</div>
                                    <div className={styles.rankingList}>
                                        {performance.delayedProducts.length === 0 ? <div className={styles.emptyPanel}><Clock3 size={18} /><span>No delayed product lines in scope.</span></div> : performance.delayedProducts.map((item: any, index: number) => (
                                            <div key={`delay-${item.name}-${index}`} className={styles.rankRow}>
                                                <div className={styles.rankBadge}>{index + 1}</div>
                                                <div className={styles.rankInfo}>
                                                    <strong>{item.name}</strong>
                                                    <span>{item.orders} delayed orders • {item.lines} lines</span>
                                                </div>
                                                <div className={styles.rankMeta}>
                                                    <strong>{item.qty.toFixed(0)} qty</strong>
                                                    <span>Delay concentration</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className={styles.subsectionLabel}>Cancelled / Voided Items</div>
                                    <div className={styles.rankingList}>
                                        {performance.cancelledProducts.length === 0 ? <div className={styles.emptyPanel}><AlertTriangle size={18} /><span>No cancelled or voided item lines in scope.</span></div> : performance.cancelledProducts.map((item: any, index: number) => (
                                            <div key={`cancel-${item.name}-${index}`} className={styles.rankRow}>
                                                <div className={styles.rankBadge}>{index + 1}</div>
                                                <div className={styles.rankInfo}>
                                                    <strong>{item.name}</strong>
                                                    <span>{item.orders} affected orders • {item.lines} lines</span>
                                                </div>
                                                <div className={styles.rankMeta}>
                                                    <strong>{item.qty.toFixed(0)} qty</strong>
                                                    <span>Cancellation pressure</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </KitchenCard>
                    </div>

                    <KitchenCard className={styles.taskBoardCard}>
                        <div className={styles.sectionHead}>
                            <div><h3>Task Desk</h3><p>Inbox-style branch task control with quick assignment and detailed follow-up.</p></div>
                            <div className={styles.taskDeskTopActions}>
                                <span className={styles.sectionBadge}>{tasks.length} tasks</span>
                                <KitchenButton variant="secondary" onClick={() => setTaskModalOpen(true)}><ArrowRight size={14} />Open Desk</KitchenButton>
                            </div>
                        </div>
                        <div className={styles.taskComposerCompact}>
                            <div className={styles.taskComposerHeader}>
                                <div>
                                    <strong>New task</strong>
                                    <span>Create a clean handoff with assignee, priority, and due date.</span>
                                </div>
                                <KitchenButton onClick={createTask}><Plus size={14} />Create task</KitchenButton>
                            </div>
                            <div className={styles.composerGridCompact}>
                                <label className={`${styles.inlineField} ${styles.taskComposerField}`}>
                                    <span className={styles.taskComposerFieldLabel}><ClipboardList size={12} />Title</span>
                                    <input className={styles.taskComposerInput} placeholder="Task title" value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} />
                                </label>
                                <label className={`${styles.inlineField} ${styles.taskComposerField}`}>
                                    <span className={styles.taskComposerFieldLabel}><Users size={12} />Assignee</span>
                                    <select className={styles.taskComposerInput} value={activeNewTaskAssigneeId} onChange={(event) => setNewTask((current) => ({ ...current, assignee_id: event.target.value }))} disabled={!canAssignTasks}>{assignees.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select>
                                </label>
                                <label className={`${styles.inlineField} ${styles.taskComposerField}`}>
                                    <span className={styles.taskComposerFieldLabel}><ShieldCheck size={12} />Priority</span>
                                    <select className={styles.taskComposerInput} value={newTask.priority} onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>{TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} priority</option>)}</select>
                                </label>
                                <label className={`${styles.inlineField} ${styles.taskComposerField}`}>
                                    <span className={styles.taskComposerFieldLabel}><CalendarClock size={12} />Due date</span>
                                    <input className={styles.taskComposerInput} type="date" value={newTask.due_date} onChange={(event) => setNewTask((current) => ({ ...current, due_date: event.target.value }))} />
                                </label>
                            </div>
                            <textarea className={styles.taskComposerTextarea} placeholder="Task detail, handoff context, follow-up expectation, or escalation note" value={newTask.description} onChange={(event) => setNewTask((current) => ({ ...current, description: event.target.value }))} />
                        </div>
                        <div className={styles.taskDeskToolbar}>
                            <div className={styles.taskDeskFilters}>
                                {TASK_FILTER_OPTIONS.map((option) => (
                                    <button key={option.value} type="button" className={`${styles.taskFilterChip} ${taskDeskFilter === option.value ? styles.taskFilterChipActive : ''}`} onClick={() => setTaskDeskFilter(option.value)}>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.composerHint}><MessageSquare size={14} />Select any task to review updates and comments.</div>
                        </div>
                        <div className={styles.taskMailboxLayout}>
                            <div className={styles.taskInboxPanel}>
                                <div className={styles.taskInboxHead}>
                                    <strong>From</strong>
                                    <strong>Date</strong>
                                    <strong>Subject</strong>
                                    <strong>Priority</strong>
                                </div>
                                <div className={styles.taskInboxList}>
                                    {renderTaskRows(taskDeskTasks, 'No tasks in this view right now.')}
                                </div>
                            </div>
                            {taskDetailPanel}
                        </div>
                    </KitchenCard>
                </div>

                <aside className={styles.sideColumn}>
                    <KitchenCard className={`${styles.sideCard} ${styles.sideAccentCard}`}>
                        <div className={styles.sectionHead}><div><h3>Upcoming Events</h3><p>Live event visibility for this branch.</p></div><button type="button" className={styles.inlineLink} onClick={() => navigate('/console/catering')}>Open<ChevronRight size={14} /></button></div>
                        <div className={styles.eventStack}>
                            {upcomingEvents.length === 0 ? <div className={styles.emptyPanel}><CalendarClock size={18} /><span>No upcoming events scheduled for this branch.</span></div> : upcomingEvents.map((event) => (
                                <div key={event.id || event.event_no} className={styles.eventCard}>
                                    <div className={styles.eventTopRow}><strong>{event.event_title || 'Event'}</strong><span className={styles.eventStatus}>{String(event.status || 'planned').replace(/_/g, ' ')}</span></div>
                                    <div className={styles.eventMeta}><span><CalendarClock size={13} /> {event.event_date || 'Date pending'}</span><span><Users size={13} /> {safeNumber(event.guest_count)} guests</span></div>
                                    <p>{event.event_no || 'Reference pending'}{event.service_type ? ` | ${event.service_type}` : ''}</p>
                                </div>
                            ))}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={`${styles.sideCard} ${styles.sideAccentCard}`}>
                        <div className={styles.sectionHead}><div><h3>Alerts & Watchlist</h3><p>Items needing a manager decision next.</p></div></div>
                        <div className={styles.alertStack}>
                            {(detail?.exceptions || []).slice(0, 3).map((item: any, index: number) => (
                                <div key={`${item.title || 'alert'}-${index}`} className={styles.alertCard}><div className={styles.alertTitle}>{item.title || item.reason || 'Operational exception'}</div><p>{item.message || item.description || 'Review this branch exception.'}</p></div>
                            ))}
                            {(detail?.exceptions || []).length === 0 ? <div className={styles.emptyPanel}><CheckCircle2 size={18} /><span>No urgent branch alerts at the moment.</span></div> : null}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.sideCard}>
                        <div className={styles.sectionHead}><div><h3>Ratios & Comparatives</h3><p>Branch efficiency signals for managers.</p></div></div>
                        <div className={styles.alertStack}>
                            <div className={styles.alertCard}><div className={styles.alertTitle}>Estimated Gross Margin</div><p>{detail?.profitability?.available ? `${safeNumber(detail?.profitability?.estimated_gross_margin_pct).toFixed(1)}% margin on ${formatMoney(detail?.profitability?.estimated_gross_margin, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.` : (detail?.profitability?.unavailable_reason || 'Margin estimate is not available yet.')}</p></div>
                            <div className={styles.alertCard}><div className={styles.alertTitle}>Sales vs Waste / Returns / Discounts</div><p>{performance.ratios.expensePressure.toFixed(1)}% of revenue is currently being absorbed by wastage, returns, and discounts.</p></div>
                            <div className={styles.alertCard}><div className={styles.alertTitle}>Inventory Risk Rate</div><p>{performance.ratios.lowStockRate.toFixed(1)}% low-stock pressure across enabled items for this branch.</p></div>
                        </div>
                    </KitchenCard>
                </aside>
            </section>

            {taskModalOpen ? (
                <div className={styles.modalOverlay} onClick={() => setTaskModalOpen(false)} role="presentation">
                    <div className={styles.taskModal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Task Desk">
                        <div className={styles.modalHeader}>
                            <div>
                                <h3>Task Desk</h3>
                                <p>Full task management across active, completed, cancelled, and archived work.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setTaskModalOpen(false)} aria-label="Close task desk"><X size={18} /></button>
                        </div>
                        <div className={styles.modalToolbar}>
                            <div className={styles.taskDeskFilters}>
                                {TASK_FILTER_OPTIONS.map((option) => (
                                    <button key={option.value} type="button" className={`${styles.taskFilterChip} ${taskDeskFilter === option.value ? styles.taskFilterChipActive : ''}`} onClick={() => setTaskDeskFilter(option.value)}>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.modalCounts}>
                                <span>{taskOpen.length} active</span>
                                <span>{taskDone.length} completed</span>
                                <span>{taskCancelled.length} cancelled</span>
                                <span>{taskArchived.length} archived</span>
                            </div>
                        </div>
                        <div className={styles.taskMailboxLayoutModal}>
                            <div className={styles.taskInboxPanel}>
                                <div className={styles.taskInboxHead}>
                                    <strong>From</strong>
                                    <strong>Date</strong>
                                    <strong>Subject</strong>
                                    <strong>Priority</strong>
                                </div>
                                <div className={styles.taskInboxListModal}>
                                    {renderTaskRows(taskDeskTasks, 'No tasks in this filter.')}
                                </div>
                            </div>
                            {taskDetailPanel}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function BmDashboard() {
    return <BranchDashboard />;
}
