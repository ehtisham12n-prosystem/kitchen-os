type KotSubmissionItem = {
    product_id?: number | string | null;
    name?: string | null;
    qty?: number | string | null;
    instructions?: string | null;
    notes?: string | null;
    modifiers?: Array<string | null | undefined> | null;
};

type KotOrderState = {
    baseNumber: number;
    version: number;
    lastSubmittedHash: string | null;
};

const ORDER_MAP_KEY = 'kot_order_state_map_v3';
const GLOBAL_COUNTER_KEY = 'kot_global_counter_v3';

const readOrderMap = (): Record<string, KotOrderState> => {
    try {
        const raw = localStorage.getItem(ORDER_MAP_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeOrderMap = (value: Record<string, KotOrderState>) => {
    localStorage.setItem(ORDER_MAP_KEY, JSON.stringify(value));
};

const formatBaseNumber = (value: number) => String(value).padStart(3, '0');

const buildKotNumber = (baseNumber: number, version: number) => {
    const normalizedVersion = Math.max(0, Math.trunc(Number(version || 0)));
    if (normalizedVersion <= 1) {
        return formatBaseNumber(baseNumber);
    }
    return `${formatBaseNumber(baseNumber)}-${normalizedVersion - 1}`;
};

const normalizeItemsForHash = (items: KotSubmissionItem[]) =>
    [...items]
        .map((item) => ({
            product_id: Number(item?.product_id ?? 0),
            name: String(item?.name || '').trim(),
            qty: Number(item?.qty ?? 0),
            instructions: String(item?.instructions ?? item?.notes ?? '').trim(),
            modifiers: Array.isArray(item?.modifiers)
                ? item.modifiers.map((modifier) => String(modifier ?? '').trim()).filter(Boolean)
                : [],
        }))
        .sort((left, right) => {
            if (left.product_id !== right.product_id) {
                return left.product_id - right.product_id;
            }
            if (left.name !== right.name) {
                return left.name.localeCompare(right.name);
            }
            if (left.instructions !== right.instructions) {
                return left.instructions.localeCompare(right.instructions);
            }
            return left.qty - right.qty;
        });

const buildSubmissionHash = (items: KotSubmissionItem[]) =>
    JSON.stringify(normalizeItemsForHash(items));

const reserveBaseNumber = (orderKey: string) => {
    const orderMap = readOrderMap();
    const existing = orderMap[orderKey];

    if (existing?.baseNumber && existing.baseNumber > 0) {
        return existing;
    }

    const nextBaseNumber = parseInt(localStorage.getItem(GLOBAL_COUNTER_KEY) || '0', 10) + 1;
    localStorage.setItem(GLOBAL_COUNTER_KEY, String(nextBaseNumber));

    const nextState: KotOrderState = {
        baseNumber: nextBaseNumber,
        version: 0,
        lastSubmittedHash: null,
    };
    orderMap[orderKey] = nextState;
    writeOrderMap(orderMap);
    return nextState;
};

export const submitKOTForOrder = (orderKey: string, items: KotSubmissionItem[]) => {
    const normalizedOrderKey = String(orderKey || '').trim();
    if (!normalizedOrderKey) {
        throw new Error('An order key is required for KOT generation.');
    }

    const currentState = reserveBaseNumber(normalizedOrderKey);
    const nextHash = buildSubmissionHash(items);

    if (currentState.lastSubmittedHash === nextHash && currentState.version > 0) {
        return {
            kotNumber: buildKotNumber(currentState.baseNumber, currentState.version),
            baseNumber: currentState.baseNumber,
            version: currentState.version,
            createdNewVersion: false,
        };
    }

    const orderMap = readOrderMap();
    const persisted = orderMap[normalizedOrderKey] ?? currentState;
    const nextState: KotOrderState = {
        baseNumber: persisted.baseNumber,
        version: Number(persisted.version || 0) + 1,
        lastSubmittedHash: nextHash,
    };

    orderMap[normalizedOrderKey] = nextState;
    writeOrderMap(orderMap);

    return {
        kotNumber: buildKotNumber(nextState.baseNumber, nextState.version),
        baseNumber: nextState.baseNumber,
        version: nextState.version,
        createdNewVersion: true,
    };
};
