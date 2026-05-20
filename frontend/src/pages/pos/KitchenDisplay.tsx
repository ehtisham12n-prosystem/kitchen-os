import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    CheckCircle2,
    Timer,
    Bell,
    Clock,
    Flame,
    RefreshCw,
    Home,
    ArrowLeft,
    CheckSquare,
    Square,
    ListTodo,
    Printer,
    Search
} from 'lucide-react';

import { getKOTColor, formatTimeElapsed, getItemTimeStatus } from './kdsUtils';
import { branchApi, posApi } from '../../api/api';
import { readAuthSessionItem } from '../../auth/storage';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { toast } from '../../components/ui/KitchenToast/toast';
import { playKdsAlert, primeKdsAudio, type KdsAlertSound } from '../../utils/kdsAlertSounds';
import { buildKOTChangePrintDocument, buildKOTPrintDocument } from './printTemplates/kotPrintTemplate';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, formatOperationalDisplayNumber, openPrintDocumentCopies, resolveKotDisplayNumber, resolvePrintTemplateSettings, shouldHideOperationalIdentity } from './printTemplates/printHelpers';
import styles from './KitchenDisplay.module.css';

const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Grill': return { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--danger)', border: 'var(--danger)' };
        case 'Fryer': return { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--warning)', border: 'var(--warning)' };
        case 'Cold Station': return { bg: 'rgba(56, 189, 248, 0.15)', text: 'var(--info)', border: 'var(--info)' };
        case 'Pizza': return { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: '#fbbf24' };
        case 'Beverages': return { bg: 'rgba(139, 92, 246, 0.15)', text: 'var(--accent-primary)', border: 'var(--accent-primary)' };
        default: return { bg: 'var(--bg-section)', text: 'var(--text-primary)', border: 'var(--divider-color)' };
    }
};

const HIDDEN_KOT_STATUSES = new Set(['cleared']);
const KDS_DISPATCH_EVENT_KEY = 'kitchenos:kds-dispatch';
const KDS_ORDER_CHANGE_HIGHLIGHT_MS = 12000;

type KdsOperationalSettings = {
    kds_new_order_alert_sound?: KdsAlertSound;
    kds_order_change_alert_sound?: KdsAlertSound;
    kds_alert_volume_level?: number;
};

const normalizeFilterToken = (value: unknown) => String(value || '').trim().toLowerCase();

const getOrderTypeBadgeClass = (orderType: string) => {
    const normalized = String(orderType || '').toLowerCase();
    if (normalized.includes('delivery')) return 'ordTypeDelivery';
    if (normalized.includes('take')) return 'ordTypeTakeout';
    return 'ordTypeDineIn';
};

const getKotStatusAction = (status: string) => {
    switch (String(status || '').toLowerCase()) {
        case 'pending':
            return {
                nextStatus: 'preparing',
                label: 'Start Preparing',
                icon: Flame,
                className: 'statusActionPreparing',
            };
        case 'preparing':
            return {
                nextStatus: 'ready',
                label: 'Mark Ready',
                icon: CheckCircle2,
                className: 'statusActionReady',
            };
        case 'ready':
            return {
                nextStatus: 'completed',
                label: 'Complete & Clear',
                icon: Clock,
                className: 'statusActionComplete',
            };
        case 'cancelled':
        case 'recalled':
            return {
                nextStatus: 'cleared',
                label: 'Clear from Board',
                icon: CheckCircle2,
                className: 'statusActionClear',
            };
        default:
            return null;
    }
};

const KDS_STATUS_FILTERS = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'New Order' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'completed', label: 'Served' },
] as const;

const getStatusDisplayLabel = (status: string) => {
    switch (String(status || '').toLowerCase()) {
        case 'pending':
            return 'NEW ORDER';
        case 'preparing':
            return 'PREPARING';
        case 'ready':
            return 'READY';
        case 'completed':
            return 'SERVED';
        default:
            return String(status || '-').replace(/_/g, ' ').toUpperCase();
    }
};

const normalizeKotItem = (item: any) => {
    const rawStatus = String(item?.item_status || item?.status || 'pending').toLowerCase();
    const quantity = Number(item?.quantity || 0);
    const oldQuantity = item?.old_quantity !== undefined && item?.old_quantity !== null
        ? Number(item.old_quantity)
        : null;

    return {
        id: String(item?.order_item_id ?? item?.id ?? item?.product_id ?? item?.product_name ?? crypto.randomUUID()),
        quantity,
        old_quantity: oldQuantity,
        product_name: item?.product_name || item?.name || `Product #${item?.product_id ?? 'N/A'}`,
        category: item?.category || 'Unassigned',
        notes: item?.notes || item?.item_notes || undefined,
        prep_time_minutes: Number(item?.prep_time_minutes || 10),
        created_at: item?.created_at || null,
        updated_at: item?.updated_at || null,
        split_at: item?.split_at || null,
        changed_at: item?.changed_at || null,
        timer_reset_at: item?.timer_reset_at || item?.split_at || null,
        item_status: rawStatus,
        is_done: ['ready', 'served'].includes(rawStatus),
        is_cancelled: ['cancelled', 'voided'].includes(rawStatus) || Boolean(item?.is_cancelled),
        is_updated: Boolean(item?.is_updated) || (oldQuantity !== null && oldQuantity !== quantity),
        is_new: Boolean(item?.is_new),
        is_addition_delta: Boolean(item?.is_addition_delta),
    };
};

const getQtyChangeState = (item: any) => {
    const currentQuantity = Number(item?.quantity || 0);
    const oldQuantity = item?.old_quantity !== undefined && item?.old_quantity !== null
        ? Number(item.old_quantity)
        : null;

    if (item?.is_cancelled) {
        return {
            oldQuantity: oldQuantity ?? currentQuantity,
            nextQuantity: 0,
            direction: 'down' as const,
            isChanged: true,
            badge: 'Cancelled',
        };
    }

    if (item?.is_addition_delta) {
        return {
            oldQuantity: null,
            nextQuantity: currentQuantity,
            direction: 'up' as const,
            isChanged: true,
            badge: 'Addition',
        };
    }

    if (item?.is_updated && oldQuantity !== null && oldQuantity !== currentQuantity) {
        return {
            oldQuantity,
            nextQuantity: currentQuantity,
            direction: currentQuantity > oldQuantity ? 'up' as const : 'down' as const,
            isChanged: true,
            badge: currentQuantity > oldQuantity ? 'Addition' : 'Decrease',
        };
    }

    return {
        oldQuantity: null,
        nextQuantity: currentQuantity,
        direction: null as 'up' | 'down' | null,
        isChanged: false,
        badge: null as string | null,
    };
};

const deriveKotStatus = (items: any[], fallbackStatus?: string) => {
    if (items.length === 0) {
        return String(fallbackStatus || 'pending').toLowerCase();
    }
    if (items.every((item) => item.is_cancelled || item.item_status === 'served')) {
        return 'completed';
    }
    if (items.every((item) => item.is_cancelled || item.is_done)) {
        return 'ready';
    }
    if (items.some((item) => item.item_status === 'cooking')) {
        return 'preparing';
    }
    return 'pending';
};

const formatKotDisplayNumber = (value: string) => {
    return String(value || '').trim();
};

const compactDisplayedNumber = (value: unknown) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '-';
    }

    const segments = normalized.split('-').filter(Boolean);
    if (segments.length <= 2) {
        return normalized;
    }

    if (segments.length >= 4) {
        return [segments[0], ...segments.slice(-2)].join('-');
    }

    return [segments[0], segments[segments.length - 1]].join('-');
};

const formatKotCardNumber = (value: unknown, source?: any) => compactDisplayedNumber(
    formatConfiguredKotNumber(value, source, { preserveTypePrefix: true }) || value,
);

const formatOrderDisplayNumber = (value: unknown, fallback: unknown, source?: any) => {
    const raw = String(value || '').trim();
    if (raw) return compactDisplayedNumber(formatConfiguredOrderNumber(raw, source, { preserveTypePrefix: true }) || raw);
    const fallbackValue = String(fallback || '').trim();
    return compactDisplayedNumber(formatConfiguredOrderNumber(fallbackValue || '-', source, { preserveTypePrefix: true }) || fallbackValue || '-');
};

const resolveOrderDisplayNumber = (source: any, fallback: unknown) => {
    const candidates = [
        source?.display_order_number,
        source?.current_order_display_number,
        source?.order_display_number,
        source?.order_number,
        source?.order_no,
        source?.order?.display_order_number,
        source?.order?.current_order_display_number,
        source?.order?.order_display_number,
        source?.order?.order_number,
        fallback,
    ];

    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '-';
};

const splitDisplayNumber = (value: unknown, leadSegments = 2) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return { lead: '', tail: '-' };
    }

    const segments = normalized.split('-').filter(Boolean);
    if (segments.length <= leadSegments) {
        return { lead: '', tail: normalized };
    }

    return {
        lead: `${segments.slice(0, leadSegments).join('-')}-`,
        tail: segments.slice(leadSegments).join('-'),
    };
};

const getVisibleDisplayNumber = (value: unknown, hideOperationalIdentity: boolean, source?: any, mode: 'pos_order' | 'pos_kot' = 'pos_order') => {
    const configured = mode === 'pos_kot'
        ? formatConfiguredKotNumber(value, source, { preserveTypePrefix: true })
        : formatConfiguredOrderNumber(value, source, { preserveTypePrefix: true });
    const formatted = configured || formatOperationalDisplayNumber(value, {
        hideOperationalIdentity,
        preserveTypePrefix: true,
    });
    return formatted || value;
};

const isBrandNewItem = (item: any, qtyState: ReturnType<typeof getQtyChangeState>) => {
    return Boolean(item?.is_new) && !qtyState.isChanged;
};

const isAdditionItem = (item: any, qtyState: ReturnType<typeof getQtyChangeState>) => {
    return Boolean(item?.is_addition_delta) || (!Boolean(item?.is_new) && qtyState.isChanged && qtyState.direction === 'up');
};

const getItemRemainingSeconds = (itemTimestamp: string, targetPrepMinutes: number) => {
    const start = new Date(itemTimestamp).getTime();
    const now = Date.now();
    const targetTime = start + (Number(targetPrepMinutes || 0) * 60 * 1000);
    return Math.floor((targetTime - now) / 1000);
};

const getItemTargetTimestamp = (itemTimestamp: string, targetPrepMinutes: number) => (
    new Date(itemTimestamp).getTime() + (Number(targetPrepMinutes || 0) * 60 * 1000)
);

type ManualDoneState = {
    isPaused: boolean;
    pausedRemainingSeconds: number;
    pausedAt: number | null;
    resumedAt: number | null;
};

const formatRemainingClock = (remainingSeconds: number) => {
    const absolute = Math.abs(Math.floor(remainingSeconds));
    const minutes = Math.floor(absolute / 60);
    const seconds = absolute % 60;
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return remainingSeconds < 0 ? `+${formatted}` : formatted;
};

const getRemainingColor = (remainingSeconds: number) => {
    if (remainingSeconds < 0) return '#B91C1C';
    if (remainingSeconds <= 120) return '#C2410C';
    return '#166534';
};

const DisplayNumber = ({
    value,
    className,
    leadSegments = 2,
}: {
    value: unknown;
    className: string;
    leadSegments?: number;
}) => {
    const { lead, tail } = splitDisplayNumber(value, leadSegments);
    return (
        <span className={className}>
            {lead ? <span className={styles.numberLead}>{lead}</span> : null}
            <span className={styles.numberTail}>{tail}</span>
        </span>
    );
};

const isKotRevision = (kot: any) => Number(kot?.kot_version || 0) > 1;

const getKotOrderKey = (kot: any) => String(kot.order_id ?? kot.order_number ?? kot.id);

const buildKotSnapshot = (kots: any[]) => new Map(
    kots.map((kot) => [
        getKotOrderKey(kot),
        JSON.stringify({
            id: String(kot.id),
            kot_version: Number(kot.kot_version || 0),
            kot_number: kot.kot_number,
            items: (kot.items || []).map((item: any) => ({
                id: String(item.id),
                product_name: item.product_name,
                quantity: Number(item.quantity || 0),
                old_quantity: item.old_quantity ?? null,
                notes: item.notes ?? null,
                is_cancelled: Boolean(item.is_cancelled),
                is_new: Boolean(item.is_new),
                is_updated: Boolean(item.is_updated),
                is_addition_delta: Boolean(item.is_addition_delta),
            })),
        }),
    ]),
);

const detectKotDelta = (previousKots: any[], nextKots: any[]) => {
    const previousSnapshot = buildKotSnapshot(previousKots);
    let hasNewOrders = false;
    let hasChangedOrders = false;
    const newOrderKeys: string[] = [];
    const changedOrderKeys: string[] = [];

    for (const kot of nextKots) {
        const orderKey = getKotOrderKey(kot);
        const prior = previousSnapshot.get(orderKey);
        if (!prior) {
            hasNewOrders = true;
            newOrderKeys.push(orderKey);
            continue;
        }
        if (prior !== JSON.stringify({
            id: String(kot.id),
            kot_version: Number(kot.kot_version || 0),
            kot_number: kot.kot_number,
            items: (kot.items || []).map((item: any) => ({
                id: String(item.id),
                product_name: item.product_name,
                quantity: Number(item.quantity || 0),
                old_quantity: item.old_quantity ?? null,
                notes: item.notes ?? null,
                is_cancelled: Boolean(item.is_cancelled),
                is_new: Boolean(item.is_new),
                is_updated: Boolean(item.is_updated),
                is_addition_delta: Boolean(item.is_addition_delta),
            })),
        })) {
            hasChangedOrders = true;
            changedOrderKeys.push(orderKey);
        }
    }

    return { hasNewOrders, hasChangedOrders, newOrderKeys, changedOrderKeys };
};

const normalizeKot = (kot: any) => {
    const parsedItems = (() => {
        try {
            const source = Array.isArray(kot?.items)
                ? kot.items
                : JSON.parse(kot?.items_json || '[]');
            return Array.isArray(source) ? source.map(normalizeKotItem) : [];
        } catch {
            return [];
        }
    })();
    const kotVersion = Number(kot?.kot_version || 0);
    const revision = kotVersion > 1;
    const normalizedStatus = String(kot.status || deriveKotStatus(parsedItems, 'pending')).toLowerCase();
    const normalizedItems = parsedItems.map((item) => {
        const baseItem = {
            ...item,
            is_new: revision ? Boolean(item.is_new) : false,
            is_updated: revision ? Boolean(item.is_updated) : false,
            old_quantity: revision ? item.old_quantity : null,
        };

        if (normalizedStatus === 'completed' && !baseItem.is_cancelled) {
            return {
                ...baseItem,
                item_status: 'served',
                is_done: true,
            };
        }

        return baseItem;
    });

    return {
        id: String(kot.id),
        order_id: kot.order_id,
        kot_number: formatKotCardNumber(resolveKotDisplayNumber(kot, `KOT-${kot.id}`), kot),
        order_number: formatOrderDisplayNumber(
            resolveOrderDisplayNumber(kot, kot.order_id ? `Order #${kot.order_id}` : '-'),
            kot.order_id ? `Order #${kot.order_id}` : '-',
            kot,
        ),
        status: normalizedStatus,
        order_type: String(kot.type || 'DINE-IN').replace(/_/g, '-').toUpperCase(),
        created_at: kot.created_at,
        updated_at: kot.updated_at,
        kot_version: kotVersion,
        is_revision: revision,
        table_number: kot.table_number || 'N/A',
        waiter: kot.waiter || 'POS User',
        order_note: String(kot.order_note || kot.notes || '').trim() || null,
        items: normalizedItems,
    };
};

const applyLiveChangeFlags = (nextKots: any[], previousKots: any[]) => {
    const previousByOrderKey = new Map(previousKots.map((kot) => [getKotOrderKey(kot), kot]));

    return nextKots.map((kot) => {
        const previousKot = previousByOrderKey.get(getKotOrderKey(kot));
        const previousItems = new Map((previousKot?.items || []).map((item: any) => [String(item.id), item]));

        const finalItems: any[] = [];

        kot.items.forEach((item: any) => {
            const previousItem: any = previousItems.get(String(item.id));
            const currentTimerMarker = String(item.timer_reset_at || item.split_at || item.created_at || '');
            const previousTimerMarker = String(previousItem?.timer_reset_at || previousItem?.split_at || previousItem?.created_at || '');
            const lineTimerChanged = !previousItem || (currentTimerMarker !== '' && currentTimerMarker !== previousTimerMarker);
            const stableItemStartAt =
                previousItem?.split_at
                || previousItem?.timer_reset_at
                || item.timer_reset_at
                || item.split_at
                || item.created_at
                || previousKot?.created_at
                || kot.created_at
                || new Date().toISOString();
            const changedItemStartAt =
                item.timer_reset_at
                || item.split_at
                || item.created_at
                || kot.updated_at
                || stableItemStartAt;

            finalItems.push({
                ...item,
                // Keep each line item's timer stable unless that specific line's timer was explicitly reset.
                split_at: lineTimerChanged
                    ? changedItemStartAt
                    : stableItemStartAt,
            });
        });

        return {
            ...kot,
            items: finalItems,
        };
    });
};

const getDisplayedKotItems = (kot: any) => {
    const items = Array.isArray(kot?.items) ? kot.items : [];
    const hasDeltaItems = items.some((item: any) => item.is_new || item.is_updated || item.is_addition_delta);
    if (!hasDeltaItems) {
        return items;
    }

    return items.filter((item: any) => item.is_new || item.is_updated || item.is_addition_delta || item.is_cancelled);
};

export function KitchenDisplay() {
    const navigate = useNavigate();
    const { canUseKds, allowedBranches, activeBranchId, canAccessBranch } = usePermissionAccess();
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [branchDetail, setBranchDetail] = useState<any | null>(null);
    const [selectedStation, setSelectedStation] = useState('All Stations');
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('All Tables');
    const [selectedWaiter, setSelectedWaiter] = useState('All Waiters');
    const [selectedOrderType, setSelectedOrderType] = useState('All Types');

    // We maintain internal state so we can toggle item completeness locally
    const [kots, setKots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingKotActions, setPendingKotActions] = useState<Record<string, string>>({});
    const [pendingItemActions, setPendingItemActions] = useState<Record<string, boolean>>({});
    const [manualDoneStates, setManualDoneStates] = useState<Record<string, ManualDoneState>>({});
    const [highlightedOrderKeys, setHighlightedOrderKeys] = useState<Record<string, number>>({});
    const [alertSettings, setAlertSettings] = useState<KdsOperationalSettings>({
        kds_new_order_alert_sound: 'mixkit_christmas_magic_bell_hit_939',
        kds_order_change_alert_sound: 'dragon_studio_alert_444816',
        kds_alert_volume_level: 85,
    });
    const [isAudioReady, setIsAudioReady] = useState(false);
    const branchName = localStorage.getItem('branch_name') || 'KitchenOS';
    const settings = useMemo(
        () => resolvePrintTemplateSettings(branchDetail || { branch_name: branchName }, branchName),
        [branchDetail, branchName],
    );
    const hideOperationalIdentity = shouldHideOperationalIdentity(branchDetail || { branch_name: branchName }, settings, 'kot');
    const showKdsUserMeta = !hideOperationalIdentity;
    const hasLoadedBoardRef = useRef(false);
    const previousRawKotsRef = useRef<any[]>([]);
    const lastAlertRef = useRef<{ kind: 'new' | 'changed' | null; at: number }>({ kind: null, at: 0 });
    const audioWarningShownRef = useRef(false);
    const timerAnchorRef = useRef<Record<string, string>>({});
    const itemSortKeyRef = useRef<Record<string, number>>({});
    const itemChangeMarkerRef = useRef<Record<string, string>>({});

    // Force re-render for live timers
    const [, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const resolveFallbackBranchId = () => {
            const primaryAllowedBranch = allowedBranches.find((branch) => branch.is_primary) || allowedBranches[0];
            if (primaryAllowedBranch?.branch_id) {
                return Number(primaryAllowedBranch.branch_id);
            }
            if (activeBranchId) {
                return Number(activeBranchId);
            }
            try {
                const raw = readAuthSessionItem('user_context');
                const ctx = raw ? JSON.parse(raw) : null;
                const primary = ctx?.allowed_branches?.find((b: any) => b.is_primary) || ctx?.allowed_branches?.[0];
                if (primary?.branch_id) {
                    return Number(primary.branch_id);
                }
            } catch {
                return null;
            }
            return null;
        };

        const storedCandidates = [
            localStorage.getItem('activeBranchId'),
            localStorage.getItem('kds_branch_id'),
            localStorage.getItem('branch_id'),
        ];
        const storedBranchId = storedCandidates
            .map((value) => Number(value || 0))
            .find((value) => Number.isInteger(value) && value > 0 && canAccessBranch(value));

        setSelectedBranchId(storedBranchId || resolveFallbackBranchId());
    }, [activeBranchId, allowedBranches, canAccessBranch]);

    useEffect(() => {
        if (selectedBranchId && !canAccessBranch(selectedBranchId)) {
            const fallbackBranch = allowedBranches.find((branch) => branch.is_primary) || allowedBranches[0];
            setSelectedBranchId(fallbackBranch?.branch_id ? Number(fallbackBranch.branch_id) : null);
        }
    }, [allowedBranches, canAccessBranch, selectedBranchId]);

    useEffect(() => {
        const unlockAudio = async () => {
            const ready = await primeKdsAudio();
            if (ready) {
                setIsAudioReady(true);
                audioWarningShownRef.current = false;
            }
        };
        const handleUnlockAudio = () => void unlockAudio();

        void unlockAudio();
        window.addEventListener('pointerdown', handleUnlockAudio, { passive: true });
        window.addEventListener('keydown', handleUnlockAudio);

        return () => {
            window.removeEventListener('pointerdown', handleUnlockAudio);
            window.removeEventListener('keydown', handleUnlockAudio);
        };
    }, []);

    useEffect(() => {
        hasLoadedBoardRef.current = false;
        previousRawKotsRef.current = [];
        lastAlertRef.current = { kind: null, at: 0 };
        if (!selectedBranchId) {
            setBranchDetail(null);
            setAlertSettings({
                kds_new_order_alert_sound: 'mixkit_christmas_magic_bell_hit_939',
                kds_order_change_alert_sound: 'dragon_studio_alert_444816',
                kds_alert_volume_level: 85,
            });
            return;
        }

        let cancelled = false;
        void branchApi.getBranch(String(selectedBranchId))
            .then((branch) => {
                if (cancelled) {
                    return;
                }
                setBranchDetail(branch || null);
                const operational = branch?.operational_settings || {};
                setAlertSettings({
                    kds_new_order_alert_sound: operational.kds_new_order_alert_sound || 'mixkit_christmas_magic_bell_hit_939',
                    kds_order_change_alert_sound: operational.kds_order_change_alert_sound || 'dragon_studio_alert_444816',
                    kds_alert_volume_level: Number.isFinite(Number(operational.kds_alert_volume_level)) ? Number(operational.kds_alert_volume_level) : 85,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setBranchDetail(null);
                    setAlertSettings({
                        kds_new_order_alert_sound: 'mixkit_christmas_magic_bell_hit_939',
                        kds_order_change_alert_sound: 'dragon_studio_alert_444816',
                        kds_alert_volume_level: 85,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedBranchId]);

    const fetchKots = useCallback(async () => {
        if (!selectedBranchId) return;
        setIsLoading(true);
        try {
            const data = await posApi.getKots(selectedBranchId);
            const normalized = (data || []).map(normalizeKot).filter((kot) => !HIDDEN_KOT_STATUSES.has(kot.status));
            const delta = detectKotDelta(previousRawKotsRef.current, normalized);
            const now = Date.now();
            const recentlyAlerted = now - lastAlertRef.current.at < 12000;

            setKots((previous) => applyLiveChangeFlags(normalized, previous));

            if (hasLoadedBoardRef.current) {
                if (delta.changedOrderKeys.length > 0) {
                    setHighlightedOrderKeys((previous) => {
                        const next = { ...previous };
                        delta.changedOrderKeys.forEach((orderKey) => {
                            next[orderKey] = now + KDS_ORDER_CHANGE_HIGHLIGHT_MS;
                        });
                        return next;
                    });
                }

                if (delta.hasNewOrders && (!recentlyAlerted || lastAlertRef.current.kind !== 'new')) {
                    void playKdsAlert(alertSettings.kds_new_order_alert_sound || 'mixkit_christmas_magic_bell_hit_939', alertSettings.kds_alert_volume_level ?? 85).then((played) => {
                        setIsAudioReady(played);
                        if (!played && !audioWarningShownRef.current) {
                            audioWarningShownRef.current = true;
                            toast.info('KDS Sound Locked', 'Click Enable Sound on the KDS toolbar to allow kitchen alerts.');
                        }
                    });
                    lastAlertRef.current = { kind: 'new', at: now };
                } else if (delta.hasChangedOrders && (!recentlyAlerted || lastAlertRef.current.kind !== 'changed')) {
                    void playKdsAlert(alertSettings.kds_order_change_alert_sound || 'dragon_studio_alert_444816', alertSettings.kds_alert_volume_level ?? 85).then((played) => {
                        setIsAudioReady(played);
                        if (!played && !audioWarningShownRef.current) {
                            audioWarningShownRef.current = true;
                            toast.info('KDS Sound Locked', 'Click Enable Sound on the KDS toolbar to allow kitchen alerts.');
                        }
                    });
                    lastAlertRef.current = { kind: 'changed', at: now };
                }
            } else {
                hasLoadedBoardRef.current = true;
            }

            previousRawKotsRef.current = normalized;
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('KDS Refresh Failed', error instanceof Error ? error.message : 'Could not load the kitchen board.');
        } finally {
            setIsLoading(false);
        }
    }, [alertSettings.kds_new_order_alert_sound, alertSettings.kds_order_change_alert_sound, alertSettings.kds_alert_volume_level, selectedBranchId]);


    useEffect(() => {
        if (selectedBranchId) {
            localStorage.setItem('kds_branch_id', selectedBranchId.toString());
            localStorage.setItem('activeBranchId', selectedBranchId.toString());
            fetchKots();

            // Keep the kitchen board close to live without requiring a manual refresh.
            const interval = setInterval(() => fetchKots(), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedBranchId, fetchKots]);

    useEffect(() => {
        if (!selectedBranchId) return;

        const shouldRefreshForPayload = (payload: unknown) => {
            if (!payload || typeof payload !== 'object') {
                return true;
            }
            const branchId = Number((payload as { branchId?: unknown }).branchId || 0);
            return !branchId || branchId === Number(selectedBranchId);
        };

        const parsePayload = (value: string | null) => {
            if (!value) return null;
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        };

        const refreshFromDispatchSignal = (payload: unknown) => {
            if (shouldRefreshForPayload(payload)) {
                void fetchKots();
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === KDS_DISPATCH_EVENT_KEY) {
                refreshFromDispatchSignal(parsePayload(event.newValue));
            }
        };

        let channel: BroadcastChannel | null = null;
        try {
            if ('BroadcastChannel' in window) {
                channel = new BroadcastChannel(KDS_DISPATCH_EVENT_KEY);
                channel.onmessage = (event) => refreshFromDispatchSignal(event.data);
            }
        } catch {
            channel = null;
        }

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
            channel?.close();
        };
    }, [selectedBranchId, fetchKots]);

    useEffect(() => {
        if (!selectedBranchId) {
            setKots([]);
            setManualDoneStates({});
            setHighlightedOrderKeys({});
            timerAnchorRef.current = {};
            itemSortKeyRef.current = {};
            itemChangeMarkerRef.current = {};
            hasLoadedBoardRef.current = false;
            previousRawKotsRef.current = [];
            lastAlertRef.current = { kind: null, at: 0 };
        }
    }, [selectedBranchId]);

    useEffect(() => {
        const activeItemIds = new Set(
            kots.flatMap((kot) => (kot.items || []).map((item: any) => String(item.id))),
        );
        const nextAnchors: Record<string, string> = {};
        kots.forEach((kot) => {
            (kot.items || []).forEach((item: any) => {
                const itemId = String(item.id);
                const fallbackAnchor = item.split_at || item.timer_reset_at || item.created_at || item.updated_at || kot.updated_at || kot.created_at || new Date().toISOString();
                const currentMarker = String(
                    item.timer_reset_at
                    || item.split_at
                    || item.updated_at
                    || '',
                );
                const previousMarker = itemChangeMarkerRef.current[itemId] || '';
                const isFirstSeen = !(itemId in timerAnchorRef.current);
                const shouldRefreshAnchor = isFirstSeen || (currentMarker !== '' && currentMarker !== previousMarker);
                nextAnchors[itemId] = shouldRefreshAnchor
                    ? fallbackAnchor
                    : (timerAnchorRef.current[itemId] || fallbackAnchor);
                itemChangeMarkerRef.current[itemId] = currentMarker;
                if (!(itemId in itemSortKeyRef.current) || shouldRefreshAnchor) {
                    itemSortKeyRef.current[itemId] = getItemTargetTimestamp(nextAnchors[itemId], item.prep_time_minutes);
                }
            });
        });
        timerAnchorRef.current = nextAnchors;
        setManualDoneStates((prev) => {
            const nextEntries = Object.entries(prev).filter(([itemId]) => activeItemIds.has(itemId));
            if (nextEntries.length === Object.keys(prev).length) {
                return prev;
            }
            return Object.fromEntries(nextEntries);
        });
    }, [kots]);

    const handleStatusUpdate = async (kotId: string, status: string) => {
        if (!selectedBranchId) {
            return;
        }
        const previousKots = kots;
        setPendingKotActions((prev) => ({ ...prev, [kotId]: status }));
        setKots((prev) => {
            if (status === 'cleared') {
                return prev.filter((kot) => kot.id !== kotId);
            }
            return prev.map((kot) => {
                if (kot.id !== kotId) {
                    return kot;
                }
                if (['ready', 'completed'].includes(String(status || '').toLowerCase())) {
                    return {
                        ...kot,
                        status,
                        items: (kot.items || []).map((item: any) => item.is_cancelled
                            ? item
                            : {
                                ...item,
                                item_status: 'served',
                                is_done: true,
                            }),
                    };
                }
                return { ...kot, status };
            });
        });

        try {
            await posApi.updateKotStatus(selectedBranchId, kotId, status);
        } catch (error) {
            setKots(previousKots);
            toast.error('KDS Update Failed', error instanceof Error ? error.message : 'Could not update the ticket status.');
        } finally {
            setPendingKotActions((prev) => {
                const next = { ...prev };
                delete next[kotId];
                return next;
            });
        }
    };

    const getEffectiveRemainingSeconds = useCallback((kot: any, item: any) => {
        if (String(kot?.status || '').toLowerCase() === 'completed') {
            return 0;
        }
        const manualState = manualDoneStates[String(item.id)];
        if (manualState?.isPaused) {
            return manualState.pausedRemainingSeconds;
        }
        if (manualState && manualState.resumedAt !== null) {
            const elapsedSinceResume = Math.floor((Date.now() - manualState.resumedAt) / 1000);
            return manualState.pausedRemainingSeconds - elapsedSinceResume;
        }
        const itemTimestamp = timerAnchorRef.current[String(item.id)] || item.split_at || item.updated_at || kot.updated_at || kot.created_at;
        return getItemRemainingSeconds(itemTimestamp, item.prep_time_minutes);
    }, [manualDoneStates]);

    const handlePrintKOT = (kot: any) => {
        if (settings.kot_print_enabled === false) {
            toast.error('KOT Printing Disabled', 'KOT printing is turned off in branding and print settings.');
            return;
        }
        const changedItems = (kot.items || []).filter((item: any) => item.is_new || item.is_updated || item.is_cancelled);
        const hasChanges = isKotRevision(kot) && changedItems.length > 0;

        const printMode = settings.order_change_print_mode || 'change_only';
        const changeMarkup = buildKOTChangePrintDocument({
                settings,
                format: settings.kot_paper_size || 'thermal-80mm',
                data: {
                    kot_version: formatKotDisplayNumber(kot.kot_number || kot.id),
                    order_no: formatOrderDisplayNumber(kot.order_number || '-', kot),
                    datetime: kot.created_at || new Date(),
                    user: kot.waiter || 'POS User',
                    add_items: changedItems
                        .filter((item: any) => item.is_new)
                        .map((item: any) => ({
                            name: item.product_name || item.name || 'Item',
                            qty: item.quantity || 0,
                            modifiers: [item.notes].filter(Boolean),
                        })),
                    cancel_items: changedItems
                        .filter((item: any) => item.is_cancelled)
                        .map((item: any) => ({
                            name: item.product_name || item.name || 'Item',
                            qty: item.old_quantity ?? item.quantity ?? 0,
                            modifiers: [item.notes].filter(Boolean),
                        })),
                    modify_items: changedItems
                        .filter((item: any) => item.is_updated && !item.is_new && !item.is_cancelled)
                        .map((item: any) => ({
                            name: item.product_name || item.name || 'Item',
                            old_qty: item.old_quantity ?? item.quantity ?? 0,
                            new_qty: item.quantity ?? 0,
                            modifiers: [item.notes].filter(Boolean),
                        })),
                    notes: kot.order_note || kot.notes || null,
                    printed_at: new Date(),
                    print_id: kot.id,
                },
            });
        const fullMarkup = buildKOTPrintDocument({
                settings,
                format: settings.kot_paper_size || 'thermal-80mm',
                data: {
                    kot_no: formatKotDisplayNumber(kot.kot_number || kot.id),
                    order_no: formatOrderDisplayNumber(kot.order_number || '-', kot),
                    datetime: kot.created_at || new Date(),
                    order_type: kot.order_type || 'DINE-IN',
                    table: kot.table_number || null,
                    guests: kot.guests ?? null,
                    server: kot.waiter || 'POS User',
                    items: (kot.items || []).map((item: any) => ({
                        name: item.product_name || item.name || 'Item',
                        qty: item.quantity || 0,
                        modifiers: [item.notes].filter(Boolean),
                    })),
                    notes: kot.order_note || kot.notes || null,
                    printed_by: kot.waiter || 'POS User',
                    print_id: kot.id,
                    printed_at: new Date(),
                },
            });
        const documentMarkup = !hasChanges
            ? fullMarkup
            : printMode === 'full_snapshot'
                ? fullMarkup
                : changeMarkup;

        if (!openPrintDocumentCopies(() => documentMarkup, hasChanges ? (settings.order_change_print_copies || settings.kot_print_copies || 1) : (settings.kot_print_copies || 1), hasChanges ? `KOT Change ${formatOrderDisplayNumber(kot.order_number || '-', kot)}` : `KOT ${formatOrderDisplayNumber(kot.order_number || '-', kot)}`)) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print this KOT.');
        }
    };

    const toggleItemDone = async (kotId: string, itemId: string) => {
        if (!selectedBranchId) {
            return;
        }
        const targetKot = kots.find((kot) => kot.id === kotId);
        const targetItem = targetKot?.items?.find((item: any) => item.id === itemId);
        if (!targetItem) {
            return;
        }
        const itemStateKey = String(itemId);
        const effectiveRemainingSeconds = getEffectiveRemainingSeconds(targetKot, targetItem);
        const isCurrentlyDone = Boolean(manualDoneStates[itemStateKey]?.isPaused) || String(targetItem.item_status || '').toLowerCase() === 'served';
        const nextStatus = isCurrentlyDone ? 'cooking' : 'served';
        const numericItemId = Number(itemId);
        if (!Number.isFinite(numericItemId)) {
            toast.error('KDS Item Update Failed', 'This item does not have a valid live order item id.');
            return;
        }

        const previousKots = kots;
        const previousManualDoneStates = manualDoneStates;
        const actionKey = `${kotId}:${itemId}`;
        setPendingItemActions((prev) => ({ ...prev, [actionKey]: true }));
        setManualDoneStates((prev) => ({
            ...prev,
            [itemStateKey]: isCurrentlyDone
                ? {
                    isPaused: false,
                    pausedRemainingSeconds: Math.max(
                        0,
                        (prev[itemStateKey]?.pausedRemainingSeconds ?? effectiveRemainingSeconds)
                        - Math.max(
                            0,
                            Math.floor((Date.now() - Number(prev[itemStateKey]?.pausedAt ?? Date.now())) / 1000),
                        ),
                    ),
                    pausedAt: null,
                    resumedAt: Date.now(),
                }
                : {
                    isPaused: true,
                    pausedRemainingSeconds: effectiveRemainingSeconds,
                    pausedAt: Date.now(),
                    resumedAt: null,
                },
        }));
        setKots((prev) => prev.map((kot) => {
            if (kot.id !== kotId) {
                return kot;
            }
            const updatedItems = kot.items.map((item: any) => item.id === itemId
                ? {
                    ...item,
                    item_status: nextStatus,
                    is_done: nextStatus === 'served',
                }
                : item);
            return {
                ...kot,
                items: updatedItems,
                status: deriveKotStatus(updatedItems, kot.status),
            };
        }));

        try {
            await posApi.updateOrderItemStatus(numericItemId, nextStatus, selectedBranchId);
        } catch (error) {
            setKots(previousKots);
            setManualDoneStates(previousManualDoneStates);
            toast.error('KDS Item Update Failed', error instanceof Error ? error.message : 'Could not update the item status.');
        } finally {
            setPendingItemActions((prev) => {
                const next = { ...prev };
                delete next[actionKey];
                return next;
            });
        }
    };

    const resetBoard = () => {
        setSelectedStatus(null);
        setSelectedStation('All Stations');
        setSearchTerm('');
        setSelectedTable('All Tables');
        setSelectedWaiter('All Waiters');
        setSelectedOrderType('All Types');
    };

    const enableKdsSound = async () => {
        const ready = await primeKdsAudio();
        setIsAudioReady(ready);
        if (!ready) {
            toast.error('KDS Sound Blocked', 'The browser did not allow audio yet. Click this button again or interact with the KDS screen.');
            return;
        }
        audioWarningShownRef.current = false;
        const played = await playKdsAlert(alertSettings.kds_new_order_alert_sound || 'mixkit_christmas_magic_bell_hit_939', alertSettings.kds_alert_volume_level ?? 85);
        setIsAudioReady(played);
        if (!played) {
            toast.error('KDS Sound Failed', 'The selected alert sound could not be played.');
        }
    };


    const tables = useMemo(() => {
        const uniqueTables = Array.from(new Set(kots.map(k => k.table_number).filter(Boolean)));
        return ['All Tables', ...uniqueTables.sort()];
    }, [kots]);

    const waiters = useMemo(() => {
        const uniqueWaiters = Array.from(new Set(kots.map(k => k.waiter).filter(Boolean)));
        return ['All Waiters', ...uniqueWaiters.sort()];
    }, [kots]);

    const stations = useMemo(() => {
        const uniqueStations = Array.from(
            new Set(
                kots.flatMap((kot) => (kot.items || []).map((item: any) => String(item.category || '').trim()).filter(Boolean)),
            ),
        );
        return ['All Stations', ...uniqueStations.sort((left, right) => left.localeCompare(right))];
    }, [kots]);

    const orderTypes = useMemo(() => {
        const uniqueTypes = Array.from(new Set(kots.map(k => k.order_type).filter(Boolean)));
        return ['All Types', ...uniqueTypes.sort()];
    }, [kots]);

    const filterStatement = useMemo(() => {
        const hasStation = selectedStation !== 'All Stations';
        const hasStatus = selectedStatus !== null;
        const hasSearch = searchTerm !== '';
        const hasTable = selectedTable !== 'All Tables';
        const hasWaiter = selectedWaiter !== 'All Waiters';
        const hasType = selectedOrderType !== 'All Types';

        if (!hasStation && !hasStatus && !hasSearch && !hasTable && !hasWaiter && !hasType) {
            return "No Filter Applied (Full Board)";
        }

        return (
            <div className={styles.statementText}>
                Viewing:
                {hasStatus && (
                    <span className={`${styles.filterPillSmall} ${styles[`statusPill${selectedStatus}`]}`}>
                        Status: <span className={styles.filterValue}>{getStatusDisplayLabel(selectedStatus)}</span>
                    </span>
                )}
                {hasType && (
                    <span className={styles.filterPillSmall} style={{ color: 'var(--accent-tertiary)', borderColor: 'var(--accent-tertiary)' }}>
                        Type: <span className={styles.filterValue}>{selectedOrderType}</span>
                    </span>
                )}
                {hasTable && (
                    <span className={styles.filterPillSmall} style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                        Table: <span className={styles.filterValue}>{selectedTable}</span>
                    </span>
                )}
                {hasWaiter && (
                    <span className={styles.filterPillSmall} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                        Waiter: <span className={styles.filterValue}>{selectedWaiter}</span>
                    </span>
                )}
                {hasStation && (
                    <span className={styles.filterPillSmall} style={{ color: 'var(--accent-secondary)', borderColor: 'var(--accent-secondary)' }}>
                        Station: <span className={styles.filterValue}>{selectedStation}</span>
                    </span>
                )}
                {hasSearch && (
                    <span className={styles.filterPillSmall} style={{ color: 'var(--text-tertiary)', borderColor: 'var(--text-tertiary)' }}>
                        Search: <span className={styles.filterValue}>"{searchTerm}"</span>
                    </span>
                )}
            </div>
        );
    }, [selectedStation, selectedStatus, searchTerm, selectedTable, selectedWaiter, selectedOrderType]);

    // Filter KOTs based on Station Selection, Status, Search and other filters
    const filteredKots = useMemo(() => {
        let result = selectedStatus ? kots : kots.filter((kot) => kot.status !== 'completed');

        // Apply Search Filter (Order # or KOT #)
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(k =>
                String(k.order_number).toLowerCase().includes(lowerSearch) ||
                String(k.kot_number).toLowerCase().includes(lowerSearch) ||
                String(k.table_number || '').toLowerCase().includes(lowerSearch) ||
                String(k.waiter || '').toLowerCase().includes(lowerSearch) ||
                String(k.order_type || '').toLowerCase().includes(lowerSearch) ||
                (k.items || []).some((item: any) =>
                    `${item.product_name || ''} ${item.notes || ''} ${item.category || ''}`.toLowerCase().includes(lowerSearch),
                )
            );
        }

        // Apply Status Filter
        if (selectedStatus) {
            result = result.filter(k => k.status === selectedStatus);
        }

        // Apply Table Filter
        if (selectedTable !== 'All Tables') {
            result = result.filter(k => k.table_number === selectedTable);
        }

        // Apply Waiter Filter
        if (selectedWaiter !== 'All Waiters') {
            result = result.filter(k => k.waiter === selectedWaiter);
        }

        // Apply Order Type Filter
        if (selectedOrderType !== 'All Types') {
            result = result.filter(k => k.order_type === selectedOrderType);
        }

        // Apply Station Filter
        if (selectedStation !== 'All Stations') {
            const tempResult: any[] = [];
            for (const k of result) {
                const hasStationItem = k.items?.some((it: any) => normalizeFilterToken(it.category) === normalizeFilterToken(selectedStation));
                if (hasStationItem) {
                    tempResult.push(k);
                }
            }
            result = tempResult;
        }

        return result;
    }, [kots, selectedStation, selectedStatus, searchTerm, selectedTable, selectedWaiter, selectedOrderType]);

    useEffect(() => {
        if (selectedStation === 'All Stations') return;
        if (!stations.includes(selectedStation)) {
            setSelectedStation('All Stations');
        }
    }, [selectedStation, stations]);

    // Compute Item Quantities for Sidebar with Overdue awareness
    const itemSummary = useMemo(() => {
        const summary: Record<string, Record<string, { qty: number; hasOverdue: boolean }>> = {};

        filteredKots.forEach(kot => {
            if (['pending', 'preparing', 'recalled', 'ready'].includes(kot.status)) {
                kot.items.forEach((item: any) => {
                    if (!item.is_done && !item.is_cancelled) {
                        if (!summary[item.category]) summary[item.category] = {};
                        if (!summary[item.category][item.product_name]) {
                            summary[item.category][item.product_name] = { qty: 0, hasOverdue: false };
                        }

                        const timeStatus = getItemTimeStatus(kot.created_at, item.prep_time_minutes);

                        summary[item.category][item.product_name].qty += item.quantity;
                        if (timeStatus.isOverdue) {
                            summary[item.category][item.product_name].hasOverdue = true;
                        }
                    }
                });
            }
        });

        return summary;
    }, [filteredKots]);

    const statusCounts = useMemo(() => ({
        all: kots.filter((kot) => kot.status !== 'completed').length,
        pending: kots.filter((kot) => kot.status === 'pending').length,
        preparing: kots.filter((kot) => kot.status === 'preparing').length,
        ready: kots.filter((kot) => kot.status === 'ready').length,
        completed: kots.filter((kot) => kot.status === 'completed').length,
    }), [kots]);

    if (!canUseKds) {
        return (
            <div className={styles.fullscreenContainer}>
                <div className={styles.emptyState}>
                    <ListTodo size={48} />
                    <span>KDS Access Restricted</span>
                    <p>Your current branch role does not include Kitchen Display access.</p>
                </div>
            </div>
        );
    }

    if (!selectedBranchId) {
        return (
            <div className={styles.fullscreenContainer}>
                <div className={styles.emptyState}>
                    <ListTodo size={48} />
                    <span>No Branch Available</span>
                    <p>Select an allowed branch before opening the kitchen display.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.fullscreenContainer}>
            <header className={styles.topBar}>
                <div className={styles.topRow}>
                    <div className={styles.topBarLeft}>
                        <div className={styles.navGroup}>
                            <KitchenButton variant="outline" size="sm" onClick={() => navigate('/terminal')} title="App Home" className={styles.navBtn}>
                                <ArrowLeft size={16} />
                            </KitchenButton>

                            <div className={styles.timeDisplay}>
                                <span>{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>

                        <div className={styles.searchAndFilters}>
                            <div className={styles.searchWrapper}>
                                <Search size={16} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Search Order # / KOT"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>

                            <div className={styles.filterDropdowns}>
                                <KitchenSelect
                                    options={tables.map(t => ({ value: t, label: t }))}
                                    value={selectedTable}
                                    onChange={(e) => setSelectedTable(e.target.value)}
                                    className={styles.compactSelect}
                                />
                                <KitchenSelect
                                    options={waiters.map(w => ({ value: w, label: w }))}
                                    value={selectedWaiter}
                                    onChange={(e) => setSelectedWaiter(e.target.value)}
                                    className={styles.compactSelect}
                                />
                                <KitchenSelect
                                    options={orderTypes.map(ot => ({ value: ot, label: ot }))}
                                    value={selectedOrderType}
                                    onChange={(e) => setSelectedOrderType(e.target.value)}
                                    className={styles.compactSelect}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.topBarRight}>
                        <div className={styles.statusFilters}>
                            {KDS_STATUS_FILTERS.map((statusFilter) => {
                                const isAll = statusFilter.value === 'all';
                                const isActive = isAll ? selectedStatus === null : selectedStatus === statusFilter.value;
                                return (
                                    <button
                                        key={statusFilter.value}
                                        type="button"
                                        className={`${styles.statusFilterButton} ${styles[`statusFilter${statusFilter.value}`]} ${isActive ? styles.statusFilterActive : ''}`}
                                        onClick={() => setSelectedStatus(isAll || isActive ? null : statusFilter.value)}
                                    >
                                        <span className={styles.statusFilterCount}>{statusCounts[statusFilter.value]}</span>
                                        <span className={styles.statusFilterLabel}>{statusFilter.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={styles.actionsWrapper}>
                            <KitchenButton variant="outline" onClick={resetBoard} title="Reset Board" className={styles.resetBtn}>
                                <Home size={24} color="#f59e0b" />
                            </KitchenButton>

                            <KitchenButton
                                variant="outline"
                                size="sm"
                                onClick={() => void enableKdsSound()}
                                className={styles.refreshBtn}
                                title={isAudioReady ? 'KDS sound enabled' : 'Enable KDS sound'}
                                style={{ height: '36px' }}
                            >
                                <Bell size={14} color={isAudioReady ? 'var(--state-active)' : 'var(--warning)'} />
                            </KitchenButton>

                            <div className={styles.topPill}>
                                <Flame size={14} color="var(--accent-primary)" />
                                <KitchenSelect
                                    options={stations.map(s => ({ value: s, label: s }))}
                                    value={selectedStation}
                                    onChange={(e) => setSelectedStation(e.target.value)}
                                    className={styles.compactSelect}
                                />
                            </div>

                            <KitchenButton
                                variant="outline"
                                size="sm"
                                onClick={() => void fetchKots()}
                                className={styles.refreshBtn}
                                title="Refresh KDS"
                                style={{ height: '36px' }}
                            >
                                <RefreshCw size={14} className={isLoading ? styles.spinner : ''} />
                            </KitchenButton>
                        </div>
                    </div>
                </div>

                <div className={styles.bottomRow}>
                    <div className={styles.filterDescription}>
                        {filterStatement}
                    </div>
                </div>
            </header>

            <div className={styles.kdsBody}>
                {/* Left Sidebar: Item Summary */}
                <aside className={styles.summarySidebar}>
                    <div className={styles.sidebarHeader}>
                        <ListTodo size={18} color="var(--accent-primary)" />
                        <h2>To-Prep Summary</h2>
                    </div>
                    <div className={styles.sidebarContent}>
                        {Object.keys(itemSummary).length === 0 ? (
                            <div className={styles.emptySidebar}>No active items to prep</div>
                        ) : (
                            Object.entries(itemSummary).map(([category, items]) => {
                                const colors = getCategoryColor(category);
                                return (
                                    <div key={category} className={styles.summaryCategoryGroup}>
                                        <div
                                            className={styles.summaryCategoryHeader}
                                            style={{ color: colors.text, borderColor: colors.border }}
                                        >
                                            {category}
                                        </div>
                                        <div className={styles.summaryItemList}>
                                            {Object.entries(items).map(([name, data]) => (
                                                <div key={name} className={styles.summaryItemRow}>
                                                    <span className={styles.summaryItemName}>{name}</span>
                                                    <span className={`${styles.summaryItemQty} ${data.hasOverdue ? styles.summaryQtyOverdue : ''}`}>
                                                        {data.qty}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {filteredKots.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle2 size={80} color="var(--state-active)" style={{ opacity: 0.2 }} />
                        <h3>Board is Clear</h3>
                        <p>No active orders for {selectedStation}.</p>
                    </div>
                ) : (
                    <div className={styles.kdsGrid}>
                        {filteredKots.map(kot => {
                            const displayedItems = getDisplayedKotItems(kot);
                            const statusColor = getKOTColor(kot);
                            const orderKey = getKotOrderKey(kot);
                            const hasUpdate = Number(highlightedOrderKeys[orderKey] || 0) > Date.now();
                            const statusAction = getKotStatusAction(kot.status);
                            const StatusActionIcon = statusAction?.icon;
                            const isServedOrder = kot.status === 'completed';

                            return (
                                <div key={kot.id} className={`${styles.kotCard} ${styles[kot.status]} ${hasUpdate ? styles.hasUpdate : ''}`}>
                                    <div className={styles.kotHeader}>
                                        <div className={styles.ordMeta}>
                                            <DisplayNumber className={styles.kotId} value={getVisibleDisplayNumber(formatKotDisplayNumber(kot.kot_number), hideOperationalIdentity, kot, 'pos_kot')} leadSegments={99} />
                                            <DisplayNumber className={styles.ordNumber} value={getVisibleDisplayNumber(kot.order_number, hideOperationalIdentity, kot, 'pos_order')} leadSegments={99} />
                                        </div>
                                        <div className={styles.kotTimer}>
                                            <div className={styles.timeActive} style={{ color: statusColor }}>
                                                {isServedOrder ? (
                                                    <>DONE</>
                                                ) : (
                                                    <>
                                                        <Timer size={14} style={{ marginRight: 4 }} />
                                                        {formatTimeElapsed(kot.created_at)}
                                                    </>
                                                )}
                                            </div>
                                            <div className={styles.badgeRow}>
                                                <span className={`${styles.ordType} ${styles[getOrderTypeBadgeClass(kot.order_type)]}`}>{kot.order_type}</span>
                                                <span className={`${styles.statusBadge} ${styles[`statusBadge${kot.status}`]}`}>{getStatusDisplayLabel(kot.status)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.kotSubHeader}>
                                        <span>TB: <strong>{kot.table_number || 'N/A'}</strong></span>
                                        {showKdsUserMeta ? <span>User: <strong>{kot.waiter}</strong></span> : null}
                                        <span>{new Date(kot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>

                                    {kot.order_note ? (
                                        <div className={styles.orderNoteBanner}>
                                            <Bell size={12} />
                                            <span>{kot.order_note}</span>
                                        </div>
                                    ) : null}

                                    <div className={styles.itemList}>
                                        {[...displayedItems]
                                            .sort((left: any, right: any) => {
                                                const leftRemaining = itemSortKeyRef.current[String(left.id)]
                                                    ?? getItemTargetTimestamp(timerAnchorRef.current[String(left.id)] || left.split_at || left.updated_at || kot.updated_at || kot.created_at, left.prep_time_minutes);
                                                const rightRemaining = itemSortKeyRef.current[String(right.id)]
                                                    ?? getItemTargetTimestamp(timerAnchorRef.current[String(right.id)] || right.split_at || right.updated_at || kot.updated_at || kot.created_at, right.prep_time_minutes);

                                                if (leftRemaining !== rightRemaining) {
                                                    return leftRemaining - rightRemaining;
                                                }

                                                return String(left.product_name || '')
                                                    .localeCompare(String(right.product_name || ''), undefined, { sensitivity: 'base' });
                                            })
                                            .map((item: any) => {
                                                const itemActionKey = `${kot.id}:${item.id}`;
                                                const isItemPending = Boolean(pendingItemActions[itemActionKey]);
                                                const qtyState = getQtyChangeState(item);
                                                const showAdditionTag = isAdditionItem(item, qtyState);
                                                const showNewItemTag = isBrandNewItem(item, qtyState);
                                                const showQtyDownTag = false;
                                                const showCommentsTag = Boolean(item.notes)
                                                    && Boolean(item.is_updated)
                                                    && !qtyState.isChanged
                                                    && !showNewItemTag
                                                    && !showAdditionTag
                                                    && !showQtyDownTag
                                                    && !item.is_cancelled;
                                                const isManuallyPaused = Boolean(manualDoneStates[String(item.id)]?.isPaused);
                                                const effectiveRemainingSeconds = getEffectiveRemainingSeconds(kot, item);
                                                const countdownColor = getRemainingColor(effectiveRemainingSeconds);
                                                const countdownLabel = formatRemainingClock(effectiveRemainingSeconds);
                                                const itemStatus = String(item.item_status || '').toLowerCase();
                                                const showDoneState = isServedOrder || isManuallyPaused || (['ready', 'served'].includes(itemStatus) && !qtyState.isChanged && !item.is_new);
                                                const canToggleItem = !isServedOrder && !item.is_cancelled && !isItemPending;
                                                return (
                                                    <div
                                                        key={item.id}
                                                                className={`${styles.itemRow} ${showDoneState ? styles.itemDone : ''} ${item.is_cancelled ? styles.itemCancelled : ''}`}
                                                            >
                                                                <div
                                                                    className={styles.itemCheckWrapper}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (canToggleItem) void toggleItemDone(kot.id, item.id);
                                                                    }}
                                                                    style={{ cursor: canToggleItem ? 'pointer' : 'default' }}
                                                                >
                                                                    {showDoneState && !item.is_cancelled ? (
                                                                        <CheckSquare size={18} color="var(--state-active)" />
                                                                    ) : (
                                                                        <Square size={18} color="var(--text-muted)" />
                                                                    )}
                                                                    <div className={styles.qtyWrapper}>
                                                                        {qtyState.isChanged && qtyState.oldQuantity !== null && <span className={styles.oldQty}>{qtyState.oldQuantity}</span>}
                                                                        <span
                                                                            className={`${styles.itemQty} ${qtyState.isChanged ? styles.updatedQty : ''} ${qtyState.direction === 'down' ? styles.updatedQtyDown : ''} ${item.is_cancelled ? styles.cancelledQty : ''}`}
                                                                        >
                                                                            {qtyState.nextQuantity}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className={styles.itemContent}>
                                                                    <div className={styles.itemTitleRow}>
                                                                        <span className={`${styles.itemName} ${item.is_new ? styles.newItem : ''}`}>
                                                                            {item.product_name}
                                                                        </span>
                                                                        {showNewItemTag && <span className={styles.newBadge}>New Item</span>}
                                                                        {showAdditionTag && !item.is_cancelled && (
                                                                            <span className={styles.updateBadge}>Addition</span>
                                                                        )}
                                                                        {!showAdditionTag && !showNewItemTag && !showQtyDownTag && !item.is_cancelled && qtyState.badge && (
                                                                            <span className={styles.updateBadge}>{qtyState.badge}</span>
                                                                        )}
                                                                        {showQtyDownTag && (
                                                                            <span className={styles.updateBadgeDown}>↓</span>
                                                                        )}
                                                                        {showCommentsTag && (
                                                                            <span className={styles.commentBadge}>Comments</span>
                                                                        )}
                                                                    </div>
                                                                    {item.notes && (
                                                                        <div className={styles.itemNote}>
                                                                            <Bell size={10} style={{ marginRight: 4 }} />
                                                                            {item.notes}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {item.is_cancelled ? (
                                                                    <div className={`${styles.itemStatusLabel} ${styles.statusCancelled}`}>
                                                                        CANCELLED
                                                                    </div>
                                                                ) : isItemPending ? (
                                                                    <div className={`${styles.itemStatusLabel} ${styles.statusPending}`}>
                                                                        SAVING
                                                                    </div>
                                                                ) : showDoneState ? (
                                                                    <div className={`${styles.itemStatusLabel} ${styles.statusDone}`}>
                                                                        DONE
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        className={styles.itemCountdown}
                                                                        style={{ color: countdownColor }}
                                                                    >
                                                                        {countdownLabel}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                        })}
                                    </div>

                                    <div className={styles.kotActions}>
                                        <div className={styles.actionRow}>
                                            {pendingKotActions[kot.id] && (
                                                <div className={`${styles.itemStatusLabel} ${styles.statusPending}`}>
                                                    SAVING
                                                </div>
                                            )}
                                            {statusAction && StatusActionIcon && (
                                                <KitchenButton
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleStatusUpdate(kot.id, statusAction.nextStatus)}
                                                    className={`${styles.flexActionBtn} ${styles[statusAction.className]}`}
                                                    disabled={Boolean(pendingKotActions[kot.id])}
                                                >
                                                    <StatusActionIcon size={14} style={{ marginRight: 8 }} />
                                                    {statusAction.label}
                                                </KitchenButton>
                                            )}

                                            <KitchenButton
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePrintKOT(kot)}
                                                className={styles.printBtn}
                                            >
                                                <Printer size={16} color="var(--accent-primary)" />
                                            </KitchenButton>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

