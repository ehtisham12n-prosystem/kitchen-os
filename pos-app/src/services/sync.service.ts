import { db } from '../db';
import type { LocalDeviceConfig, LocalOrder, LocalShift, LocalProduct, SyncQueueRow } from '../db';
import { apiUrl } from '../config/runtime';

const DEVICE_CONFIG_ID = 'current';

async function sha256(value: unknown): Promise<string> {
    const payload = new TextEncoder().encode(JSON.stringify(value ?? {}));
    const digest = await crypto.subtle.digest('SHA-256', payload);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function nextRetryAt(attemptCount: number): Date {
    const minutes = Math.min(Math.max(2 ** Math.max(attemptCount - 1, 0), 1), 30);
    return new Date(Date.now() + (minutes * 60 * 1000));
}

function resolveBranchId(): number | null {
    const raw = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
    const branchId = raw ? Number(raw) : NaN;
    return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
}

function getToken(): string | null {
    return localStorage.getItem('access_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}, branchId?: number | null): Promise<T> {
    const token = getToken();
    if (!token) {
        throw new Error('POS offline sync requires an authenticated console session.');
    }

    const response = await fetch(apiUrl(endpoint), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(branchId ? { 'x-branch-id': String(branchId) } : {}),
            ...(options.headers ?? {}),
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || response.statusText);
    }

    return response.json();
}

export class SyncService {
    static async ensureDeviceConfig(): Promise<LocalDeviceConfig> {
        const branchId = resolveBranchId();
        if (!branchId) {
            throw new Error('Select an active branch before using offline POS.');
        }

        const existing = await db.deviceConfig.get(DEVICE_CONFIG_ID);
        if (existing && existing.branch_id === branchId) {
            return existing;
        }

        const created: LocalDeviceConfig = {
            id: DEVICE_CONFIG_ID,
            branch_id: branchId,
            device_uid: existing?.device_uid || crypto.randomUUID(),
            device_name: existing?.device_name || 'KitchenOS Browser POS',
            device_code: existing?.device_code || `WEB-${branchId}`,
            device_type: 'pos_terminal',
            device_os: navigator.userAgent,
            app_version: '0.0.0',
            last_sync_status: 'idle',
        };

        await db.deviceConfig.put(created);
        return created;
    }

    static async registerDevice(): Promise<LocalDeviceConfig> {
        const config = await this.ensureDeviceConfig();
        const response = await request<any>('/pos/devices/register', {
            method: 'POST',
            body: JSON.stringify({
                branch_id: config.branch_id,
                device_uid: config.device_uid,
                device_code: config.device_code,
                device_name: config.device_name,
                device_type: config.device_type,
                device_os: config.device_os,
                app_version: config.app_version,
            }),
        }, config.branch_id);

        const updated: LocalDeviceConfig = {
            ...config,
            device_name: response.device_name || config.device_name,
            device_code: response.device_code || config.device_code,
            last_sync_at: response.last_sync_at ? new Date(response.last_sync_at) : config.last_sync_at,
            last_sync_status: response.last_sync_status || config.last_sync_status || 'idle',
            last_sync_message: response.last_sync_message || config.last_sync_message,
        };
        await db.deviceConfig.put(updated);
        return updated;
    }

    static async syncCatalogDown() {
        if (!navigator.onLine) return;

        const branchId = resolveBranchId();
        if (!branchId || !getToken()) return;

        try {
            const response = await request<any>(`/catalog/menu/branch/${branchId}`, {}, branchId);
            const products: LocalProduct[] = (response?.products || []).map((product: any, index: number) => ({
                id: index + 1,
                product_id: Number(product.id),
                name: product.product_name || product.name,
                description: product.description || '',
                price: Number(product.price || product.product_base_price || 0),
                category: product.category?.category_name || product.category || 'Uncategorized',
                image_url: product.image_url || '',
                is_available: true,
            }));

            await db.products.clear();
            if (products.length > 0) {
                await db.products.bulkAdd(products);
            }
        } catch (error) {
            console.error('SyncService: Failed to pull catalog', error);
        }
    }

    static async getCurrentShift(): Promise<LocalShift | undefined> {
        return db.shifts.where('status').equals('open').last();
    }

    static async openShift(openingFloat: number): Promise<LocalShift> {
        const device = await this.ensureDeviceConfig();
        const existing = await this.getCurrentShift();
        if (existing) {
            return existing;
        }

        const shift: LocalShift = {
            id: crypto.randomUUID(),
            branch_id: device.branch_id,
            device_uid: device.device_uid,
            opening_float: Number(openingFloat || 0),
            status: 'open',
            sync_status: 'pending',
            sync_attempt_count: 0,
            opened_at: new Date(),
        };
        await db.shifts.put(shift);
        await this.queueEvent('SHIFT', shift.id, {
            shift_reference: shift.id,
            status: 'open',
            opening_float: shift.opening_float,
            opened_at: shift.opened_at.toISOString(),
        }, `SHIFT-OPEN-${shift.id}`);
        return shift;
    }

    static async closeShift(actualCash: number): Promise<LocalShift> {
        const current = await this.getCurrentShift();
        if (!current) {
            throw new Error('No active offline shift found.');
        }

        const closed: LocalShift = {
            ...current,
            actual_cash: Number(actualCash || 0),
            status: 'closed',
            sync_status: 'pending',
            sync_error: undefined,
            sync_attempt_count: 0,
            closed_at: new Date(),
        };
        await db.shifts.put(closed);
        await this.queueEvent('SHIFT', closed.id, {
            shift_reference: closed.id,
            status: 'closed',
            opening_float: closed.opening_float,
            actual_cash: closed.actual_cash,
            opened_at: closed.opened_at.toISOString(),
            closed_at: closed.closed_at?.toISOString(),
        }, `SHIFT-CLOSE-${closed.id}`);
        return closed;
    }

    static async queueOrder(order: Omit<LocalOrder, 'id' | 'sync_status' | 'sync_attempt_count'>): Promise<number> {
        const createdId = await db.orders.add({
            ...order,
            sync_status: 'pending',
            sync_attempt_count: 0,
        } as LocalOrder);

        await this.queueEvent('ORDER', order.order_number, {
            order_number: order.order_number,
            order_type: 'takeout',
            order_status: 'completed',
            shift_reference: order.shift_reference,
            created_at: order.created_at.toISOString(),
            sub_total: order.sub_total,
            tax_amount: order.tax_amount,
            discount_amount: order.discount_amount,
            total_amount: order.total_amount,
            payment_mode: order.payment_method,
            payments: order.payments,
            close_on_sync: true,
            items: order.items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.priceAtTimeOfSale,
                notes: item.notes,
            })),
        }, `ORDER-${order.order_number}`);

        return createdId as number;
    }

    static async queueEvent(
        entityType: 'ORDER' | 'SHIFT',
        entityId: string,
        payload: unknown,
        eventId: string,
    ) {
        const payloadHash = await sha256(payload);
        const row: SyncQueueRow = {
            event_id: eventId,
            entity_type: entityType,
            entity_id: entityId,
            payload,
            payload_hash: payloadHash,
            status: 'pending',
            attempt_count: 0,
            created_at: new Date(),
            next_retry_at: new Date(),
        };

        const existing = await db.syncQueue.where('event_id').equals(eventId).first();
        if (existing?.status === 'synced') {
            return existing.id;
        }

        return db.syncQueue.put({
            ...existing,
            ...row,
            id: existing?.id,
        });
    }

    static async syncOrdersUp() {
        if (!navigator.onLine || !getToken()) return;

        const device = await this.registerDevice();
        const branchId = device.branch_id;
        const now = new Date();
        const queueRows = await db.syncQueue
            .filter((row) => ['pending', 'failed', 'conflict'].includes(row.status)
                && (!row.next_retry_at || row.next_retry_at <= now))
            .sortBy('created_at');

        const eligibleRows = queueRows.slice(0, 20);
        if (eligibleRows.length === 0) return;

        for (const row of eligibleRows) {
            await db.syncQueue.update(row.id!, {
                attempt_count: Number(row.attempt_count || 0) + 1,
                last_attempt_at: new Date(),
                status: 'pending',
            });
        }

        try {
            const response = await request<any>('/pos/sync/batch', {
                method: 'POST',
                body: JSON.stringify({
                    branch_id: branchId,
                    device_uid: device.device_uid,
                    device_code: device.device_code,
                    device_name: device.device_name,
                    device_type: device.device_type,
                    device_os: device.device_os,
                    app_version: device.app_version,
                    events: eligibleRows.map((row) => ({
                        event_id: row.event_id,
                        entity_type: row.entity_type,
                        entity_id: row.entity_id,
                        event_type: 'sync',
                        payload_hash: row.payload_hash,
                        order: row.entity_type === 'ORDER' ? row.payload : undefined,
                        shift: row.entity_type === 'SHIFT' ? row.payload : undefined,
                    })),
                }),
            }, branchId);

            const results = Array.isArray(response?.results) ? response.results : [];
            for (const row of eligibleRows) {
                const result = results.find((entry: any) => entry.event_id === row.event_id);
                if (!result) continue;

                if (result.status === 'processed') {
                    await db.syncQueue.update(row.id!, {
                        status: 'synced',
                        synced_at: new Date(),
                        last_error: undefined,
                        next_retry_at: undefined,
                    });

                    if (row.entity_type === 'ORDER') {
                        const order = await db.orders.where('order_number').equals(row.entity_id).first();
                        if (order?.id) {
                            await db.orders.update(order.id, {
                                sync_status: 'synced',
                                sync_error: undefined,
                                synced_at: new Date(),
                            });
                        }
                    }

                    if (row.entity_type === 'SHIFT') {
                        await db.shifts.update(row.entity_id, {
                            sync_status: 'synced',
                            sync_error: undefined,
                            synced_at: new Date(),
                        });
                    }
                } else {
                    const retryAt = result.status === 'conflict' ? undefined : nextRetryAt(Number(row.attempt_count || 0) + 1);
                    await db.syncQueue.update(row.id!, {
                        status: result.status,
                        last_error: result.message || 'Sync failed',
                        next_retry_at: retryAt,
                    });

                    if (row.entity_type === 'ORDER') {
                        const order = await db.orders.where('order_number').equals(row.entity_id).first();
                        if (order?.id) {
                            await db.orders.update(order.id, {
                                sync_status: result.status,
                                sync_error: result.message || 'Sync failed',
                                sync_attempt_count: Number(row.attempt_count || 0) + 1,
                            });
                        }
                    }

                    if (row.entity_type === 'SHIFT') {
                        await db.shifts.update(row.entity_id, {
                            sync_status: result.status,
                            sync_error: result.message || 'Sync failed',
                            sync_attempt_count: Number(row.attempt_count || 0) + 1,
                        });
                    }
                }
            }

            await db.deviceConfig.update(DEVICE_CONFIG_ID, {
                last_sync_at: new Date(),
                last_sync_status: results.some((entry: any) => entry.status === 'conflict')
                    ? 'conflict'
                    : results.some((entry: any) => entry.status === 'failed')
                        ? 'failed'
                        : 'success',
                last_sync_message: `${results.filter((entry: any) => entry.status === 'processed').length} event(s) processed`,
            });
        } catch (error: any) {
            const message = error?.message || 'Sync failed';
            for (const row of eligibleRows) {
                await db.syncQueue.update(row.id!, {
                    status: 'failed',
                    last_error: message,
                    next_retry_at: nextRetryAt(Number(row.attempt_count || 0) + 1),
                });
            }
            await db.deviceConfig.update(DEVICE_CONFIG_ID, {
                last_sync_at: new Date(),
                last_sync_status: 'failed',
                last_sync_message: message,
            });
            console.error('SyncService: Failed to push queue', error);
        }
    }

    static startBackgroundDaemon() {
        setInterval(() => {
            if (navigator.onLine) {
                void this.syncOrdersUp();
            }
        }, 10000);
    }
}
