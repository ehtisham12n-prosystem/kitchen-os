import Dexie from 'dexie';
import type { Table } from 'dexie';

// Define the interface for a Product in the local catalog
export interface LocalProduct {
    id: number;
    product_id: number; // Cloud ID
    name: string;
    description: string;
    price: number;
    category: string;
    image_url: string;
    is_available: boolean;
}

export interface LocalCustomer {
    id: number;
    customer_id: number; // Cloud ID
    name: string;
    phone_number: string;
    wallet_balance: number;
    loyalty_points: number;
}

export interface LocalVoucher {
    id: number;
    voucher_id: number; // Cloud ID
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_order_value: number;
}

export interface LocalOrder {
    id?: number;
    order_number: string;
    branch_id: number;
    device_uid: string;
    shift_reference: string;
    sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
    sync_error?: string;
    sync_attempt_count: number;
    synced_at?: Date;
    created_at: Date;
    sub_total: number;
    tax_amount: number;
    total_amount: number;
    discount_amount: number;
    payment_method: string;
    payments: {
        payment_mode: string;
        amount: number;
        reference_number?: string;
    }[];
    customer_id?: number;
    voucher_id?: number;
    items: {
        product_id: number;
        quantity: number;
        priceAtTimeOfSale: number;
        notes?: string;
    }[];
}

export interface LocalShift {
    id: string;
    branch_id: number;
    device_uid: string;
    opening_float: number;
    actual_cash?: number;
    status: 'open' | 'closed';
    sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
    sync_error?: string;
    sync_attempt_count: number;
    opened_at: Date;
    closed_at?: Date;
    synced_at?: Date;
}

export interface SyncQueueRow {
    id?: number;
    event_id: string;
    entity_type: 'ORDER' | 'SHIFT';
    entity_id: string;
    payload: unknown;
    payload_hash: string;
    status: 'pending' | 'synced' | 'failed' | 'conflict';
    attempt_count: number;
    last_error?: string;
    last_attempt_at?: Date;
    next_retry_at?: Date;
    synced_at?: Date;
    created_at: Date;
}

export interface LocalDeviceConfig {
    id: string;
    branch_id: number;
    device_uid: string;
    device_name: string;
    device_code?: string;
    device_type: string;
    device_os?: string;
    app_version?: string;
    last_sync_at?: Date;
    last_sync_status?: 'idle' | 'success' | 'failed' | 'conflict';
    last_sync_message?: string;
}

// Extend Dexie to create our specific Database class
export class PosDatabase extends Dexie {
    products!: Table<LocalProduct, number>;
    orders!: Table<LocalOrder, number>;
    customers!: Table<LocalCustomer, number>;
    vouchers!: Table<LocalVoucher, number>;
    shifts!: Table<LocalShift, string>;
    syncQueue!: Table<SyncQueueRow, number>;
    deviceConfig!: Table<LocalDeviceConfig, string>;

    constructor() {
        super('KitchenOsPosDB');
        this.version(3).stores({
            products: '++id, product_id, category, name',
            orders: '++id, order_number, branch_id, device_uid, shift_reference, sync_status, created_at',
            customers: '++id, customer_id, phone_number, name',
            vouchers: '++id, voucher_id, code',
            shifts: 'id, branch_id, device_uid, status, sync_status, opened_at',
            syncQueue: '++id, event_id, entity_type, entity_id, status, next_retry_at, created_at',
            deviceConfig: 'id, branch_id, device_uid',
        });
    }
}

export const db = new PosDatabase();
