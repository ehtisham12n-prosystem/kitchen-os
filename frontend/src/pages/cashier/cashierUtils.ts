/* eslint-disable @typescript-eslint/no-explicit-any */
export type CashierOrderMode = 'dine_in' | 'takeout' | 'delivery';

export type CashierPayment = {
    id?: number;
    payment_mode?: string | null;
    amount?: number | null;
    reference_number?: string | null;
    transaction_date?: string | null;
    is_refund?: boolean;
};

export type CashierOrderItem = {
    id?: number;
    product_name?: string | null;
    quantity?: number | null;
    item_price?: number | null;
    item_notes?: string | null;
    notes?: string | null;
    item_status?: string | null;
};

export type CashierOrder = {
    id: number;
    order_number?: string | null;
    customer_id?: number | null;
    shift_id?: number | null;
    sale_counter_id?: number | null;
    kot_numbers?: string[];
    sale_counter_code?: string | null;
    sale_counter_name?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    order_taker_name?: string | null;
    order_taker_username?: string | null;
    table_number?: string | null;
    order_type?: string | null;
    order_status?: string | null;
    payment_status?: string | null;
    order_note?: string | null;
    created_at?: string | null;
    finalized_at?: string | null;
    receipt_number?: string | null;
    voucher_id?: number | null;
    voucher_code?: string | null;
    voucher_name?: string | null;
    sub_total?: number | null;
    tax_amount?: number | null;
    discount_amount?: number | null;
    total_amount?: number | null;
    items?: CashierOrderItem[];
    payments?: CashierPayment[];
    charges?: Array<{
        id?: number;
        charge_name?: string | null;
        amount?: number | null;
        applied_rate?: number | null;
        is_tax?: boolean | null;
    }>;
    refunded_amount?: number | null;
    remaining_refundable_amount?: number | null;
    latest_return?: {
        id?: number | null;
        return_number?: string | null;
        refund_amount?: number | null;
        return_note?: string | null;
        payment_note?: string | null;
        created_at?: string | null;
        authorized_by?: string | null;
        payments?: CashierPayment[];
        items?: Array<{
            id?: number | null;
            product_name?: string | null;
            quantity?: number | null;
            refund_amount?: number | null;
        }>;
    } | null;
    returns?: Array<{
        id?: number | null;
        return_number?: string | null;
        refund_amount?: number | null;
        return_note?: string | null;
        payment_note?: string | null;
        created_at?: string | null;
        authorized_by?: string | null;
        payments?: CashierPayment[];
        items?: Array<{
            id?: number | null;
            product_name?: string | null;
            quantity?: number | null;
            refund_amount?: number | null;
        }>;
    }>;
};

export type CashierOrderFilters = {
    customer: string;
    orderTaker: string;
    paymentStatus: string;
    escalation: '' | 'overdue' | 'fresh';
    dateFrom: string;
    dateTo: string;
    orderType: '' | CashierOrderMode;
    product: string;
    orderNumber: string;
};

export const emptyCashierOrderFilters: CashierOrderFilters = {
    customer: '',
    orderTaker: '',
    paymentStatus: 'all',
    escalation: '',
    dateFrom: '',
    dateTo: '',
    orderType: '',
    product: '',
    orderNumber: '',
};

function text(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

export function formatMoney(value: unknown): string {
    const numeric = Number(value ?? 0);
    return `PKR ${Number.isFinite(numeric) ? numeric.toLocaleString() : '0'}`;
}

export function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value ?? '';
    return `${month} ${day}, ${year} - ${hour}:${minute} ${dayPeriod}`;
}

export function normalizePaymentStatus(value?: string | null): 'paid' | 'partial' | 'unpaid' | 'other' {
    const normalized = text(value);
    if (normalized === 'paid') return 'paid';
    if (normalized === 'partial') return 'partial';
    if (normalized === 'unpaid') return 'unpaid';
    return 'other';
}

export function paymentStatusLabel(value?: string | null): string {
    const normalized = normalizePaymentStatus(value);
    if (normalized === 'partial') return 'partial paid';
    if (normalized === 'other') return value ? String(value).replaceAll('_', ' ') : 'unknown';
    return normalized;
}

export function normalizeOrderType(value?: string | null): CashierOrderMode {
    const normalized = text(value);
    if (normalized === 'delivery') return 'delivery';
    if (normalized === 'takeaway' || normalized === 'takeout') return 'takeout';
    return 'dine_in';
}

export function isCancelledOrder(order: CashierOrder): boolean {
    const status = text(order.order_status);
    return status === 'cancelled' || status === 'voided';
}

export function isRefundedOrder(order: CashierOrder): boolean {
    const status = text(order.payment_status);
    return status === 'refunded' || status === 'partially_refunded';
}

export function flattenExpenseAccounts(accounts: any[]): Array<{ id: string; name: string }> {
    return accounts.flatMap((account) => [
        ...(account?.account_type === 'expense'
            ? [{ id: String(account.id), name: `${account.account_code} - ${account.account_name}` }]
            : []),
        ...(Array.isArray(account?.children) ? flattenExpenseAccounts(account.children) : []),
    ]);
}

export function getPaidAmount(order: CashierOrder): number {
    return (order.payments ?? []).reduce((sum, payment) => {
        const amount = Number(payment.amount ?? 0);
        if (!Number.isFinite(amount)) return sum;
        return sum + (payment.is_refund ? -amount : amount);
    }, 0);
}

export function getLastPaymentDate(order: CashierOrder): string | null {
    const latest = (order.payments ?? [])
        .filter((payment) => !payment.is_refund && payment.transaction_date)
        .sort((left, right) => new Date(right.transaction_date || 0).getTime() - new Date(left.transaction_date || 0).getTime())[0];
    return latest?.transaction_date ?? null;
}

export function getOutstandingAmount(order: CashierOrder): number {
    const total = Number(order.total_amount ?? 0);
    const balance = total - getPaidAmount(order);
    return Math.max(Math.round(balance * 100) / 100, 0);
}

export function getOrderAgeDays(order: CashierOrder, now = new Date()): number {
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return 0;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfCreated = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
    const diffMs = startOfToday.getTime() - startOfCreated.getTime();
    return Math.max(Math.floor(diffMs / 86400000), 0);
}

export function isCreditEligibleOrder(order: CashierOrder): boolean {
    if (isCancelledOrder(order) || isRefundedOrder(order)) return false;
    return getOutstandingAmount(order) > 0.009;
}

export function matchesCashierOrderFilters(order: CashierOrder, filters: CashierOrderFilters): boolean {
    const customerToken = text(filters.customer);
    if (customerToken) {
        const haystack = text(`${order.customer_name} ${order.customer_phone}`);
        if (!haystack.includes(customerToken)) return false;
    }

    const orderTakerToken = text(filters.orderTaker);
    if (orderTakerToken) {
        const haystack = text(`${order.order_taker_name} ${order.order_taker_username}`);
        if (!haystack.includes(orderTakerToken)) return false;
    }

    const paymentStatus = text(filters.paymentStatus);
    if (paymentStatus && paymentStatus !== 'all') {
        if (paymentStatus === 'credited') {
            if (!isCreditEligibleOrder(order)) return false;
        } else if (text(order.payment_status) !== paymentStatus) {
            return false;
        }
    }

    if (filters.escalation === 'overdue' && getOrderAgeDays(order) <= 0) {
        return false;
    }
    if (filters.escalation === 'fresh' && getOrderAgeDays(order) > 0) {
        return false;
    }

    if (filters.orderType && normalizeOrderType(order.order_type) !== filters.orderType) {
        return false;
    }

    const orderNumberToken = text(filters.orderNumber);
    if (orderNumberToken) {
        const haystack = text(`${order.order_number} ${order.id}`);
        if (!haystack.includes(orderNumberToken)) return false;
    }

    const productToken = text(filters.product);
    if (productToken) {
        const names = (order.items ?? []).map((item) => text(item.product_name)).join(' ');
        if (!names.includes(productToken)) return false;
    }

    const createdAt = order.created_at ? new Date(order.created_at) : null;
    if (filters.dateFrom) {
        if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
        const from = new Date(`${filters.dateFrom}T00:00:00`);
        if (createdAt.getTime() < from.getTime()) return false;
    }

    if (filters.dateTo) {
        if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
        const to = new Date(`${filters.dateTo}T23:59:59`);
        if (createdAt.getTime() > to.getTime()) return false;
    }

    return true;
}

export function buildSettlementPayments(
    amount: number,
    paymentMode: string,
    referenceNumber: string,
    comments?: string,
    transactionDate?: string,
) {
    const normalizedAmount = Math.max(Math.round(Number(amount || 0) * 100) / 100, 0);

    return [{
        amount: normalizedAmount,
        payment_mode: paymentMode,
        reference_number: referenceNumber.trim() || undefined,
        notes: comments?.trim() || undefined,
        transaction_date: transactionDate || undefined,
    }];
}
