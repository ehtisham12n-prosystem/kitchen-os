import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BadgePercent,
    Banknote,
    Building2,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    CreditCard,
    Heart,
    History,
    Home,
    ImageOff,
    LayoutGrid,
    List,
    Loader2,
    Lock,
    MessageSquare,
    Minus,
    Monitor,
    PanelLeft,
    Plus,
    Printer,
    RotateCcw,
    Search,
    ShoppingCart,
    Store,
    Ticket,
    Trash2,
    Truck,
    User,
    UserSearch,
    Wallet,
    X,
} from 'lucide-react';
import { accountingApi, authApi, branchApi, catalogApi, customerApi, dealsApi, posApi, setupApi, userApi } from '../../api/api';
import { APP_PERMISSIONS, persistUserContext } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/locationOptions';
import { formatCurrency, getCurrencyCodeLabel } from '../../utils/currency';
import { playPosCartAddSound, playPosCartReduceSound } from '../../utils/kdsAlertSounds';
import { getActiveTillSession, setActiveTillSession as persistActiveTillSession, clearActiveTillSession } from './terminalSession';
import { PosOpeningCashModal } from './PosOpeningCashModal';
import { PosClosingCashModal } from './PosClosingCashModal';
import { CreditLedgerModal } from './CreditLedgerModal';
import { OrderAuditModal } from './OrderAuditModal';
import {
    buildBillSummaryPrintMarkup,
    buildBillSummaryPrintDocument,
    buildCreditSaleReceiptPrintMarkup,
    buildCreditSaleReceiptPrintDocument,
    buildKOTPrintDocument,
    buildKOTChangePrintDocument,
    KOT_PRINT_CSS,
    buildLineItemVoidReceiptPrintDocument,
    buildPaymentReceiptPrintMarkup,
    buildPartialPaymentReceiptPrintDocument,
    buildPaymentReceiptPrintDocument,
    buildSaleReturnReceiptPrintMarkup,
    buildSaleReturnReceiptPrintDocument,
    buildCounterSessionXReportPrintDocument,
    type PrintPaperFormat,
} from './printTemplates/kotPrintTemplate';
import { formatConfiguredExpenseVoucherNumber, formatConfiguredKotNumber, formatConfiguredOrderNumber, formatConfiguredReceiptNumber, formatOperationalDisplayNumber, openPrintDocumentCopies, resolveKotDisplayNumber, resolvePrintTemplateSettings, shouldHideOperationalIdentity } from './printTemplates/printHelpers';
import './PosTerminalMirror.css';
import styles from './PosTerminal.module.css';

interface Product {
    id: number;
    productId?: number;
    name: string;
    price: number;
    category: string;
    PriceProfile: string;
    PriceProfileId: number | null;
    unitLabel: string;
    image?: string;
}

interface CartItem extends Product {
    quantity: number;
    note?: string;
    orderItemId?: number | null;
    productId?: number;
    lineKey: string;
    originalQuantity?: number;
    originalNote?: string;
    isDeleted?: boolean;
    isNewLine?: boolean;
}

interface SalesReturnLine {
    id: number;
    productName: string;
    unitPrice: number;
    soldQuantity: number;
    alreadyReturnedQuantity: number;
    availableQuantity: number;
    requestedQuantity: number;
    baseAmount: number;
}

type OrderMode = 'dine_in' | 'takeout' | 'delivery';
type CardStyle = 'list' | 'small' | 'medium' | 'large';
type PosLayout = 'classic' | 'smart_cart';
type SmartCartPaymentStyle = 'inline' | 'modal';
type SmartCartPaymentMode = 'cash' | 'credit_card' | 'eft' | 'wallet' | 'credit_sale' | 'cod';
type OrderSetupSection = 'server' | 'order_type' | 'table' | 'customer';
type ChargePaymentMode = 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';
type PaymentMode = ChargePaymentMode | 'split';
type OrdersModalFilter = 'recent' | 'today' | 'in_progress' | 'kitchen' | 'unpaid' | 'credited' | 'dine_in' | 'takeout' | 'delivery' | 'closed' | 'cancelled' | 'returned';
type OrderListView = 'line' | 'grid' | 'table';
const ORDER_MODAL_PAGE_SIZE = 12;
const SALES_RETURN_PAGE_SIZE = 10;

const resolveCartProductId = (item: Partial<CartItem> | any): number => Number(
    item?.productId
    ?? item?.product_id
    ?? item?.product?.id
    ?? item?.id
    ?? 0,
);

interface AdvancedOrderSearchFilters {
    customer: string;
    orderNumber: string;
    tableNumber: string;
    orderTaker: string;
    orderType: '' | OrderMode;
    paymentStatus: string;
    productName: string;
    orderStatus: string;
    returnDatePreset: '' | 'today' | 'this_week' | 'this_month' | 'date_period';
    returnDateFrom: string;
    returnDateTo: string;
}

interface CustomerSearchFilters {
    status: 'all' | 'active' | 'inactive' | 'suspended';
    branchId: string;
    loyalty: 'all' | 'members' | 'non_members';
    contact: 'all' | 'with_phone' | 'with_email' | 'complete_profile';
}

interface PosCustomerFormState {
    name: string;
    phone_number: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    gender: '' | 'male' | 'female' | 'other' | 'prefer_not_to_say';
    preferred_branch_id: string;
    designation: string;
    organization: string;
    city: string;
    country: string;
    address_line_1: string;
    notes: string;
    allow_credit: boolean;
    credit_limit: string;
    marketing_opt_in: boolean;
}

interface DiscountApprovalState {
    username: string;
    approvedAmount: number;
    approvedAt: string;
}

interface OnlinePaymentDetails {
    sender_name: string;
    source_bank: string;
    destination_bank: string;
    transaction_no: string;
}

interface CardMachineFormState {
    machine_name: string;
    service_provider: string;
    pid_number: string;
    mid_number: string;
}

type DeliveryPaymentTerm = 'paid' | 'cod';
type DeliveryStatus = 'pending' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface DeliveryOrderFormState {
    contact_person: string;
    phone_number: string;
    address: string;
    house_apartment: string;
    street_no: string;
    area_sector: string;
    locality: string;
    city: string;
    ask_for: string;
    delivery_person_user_id: string;
    delivery_person_name: string;
    payment_term: DeliveryPaymentTerm;
    delivery_status: DeliveryStatus;
    comment: string;
}

const orderModeMeta: Record<OrderMode, string> = {
    dine_in: 'Dine In',
    takeout: 'Take-away',
    delivery: 'Delivery',
};

const paymentModeLabels: Record<PaymentMode, string> = {
    cash: 'Cash',
    bank: 'Bank',
    card: 'Card',
    digital_wallet: 'Wallet',
    other: 'Other',
    split: 'Split',
};

const smartCartPaymentModeLabels: Record<SmartCartPaymentMode, string> = {
    cash: 'Cash',
    credit_card: 'Credit Card',
    eft: 'EFT',
    wallet: 'Wallet',
    credit_sale: 'Credit Sale',
    cod: 'COD',
};

const eftBankOptions = [
    'HBL',
    'UBL',
    'MCB',
    'Allied Bank',
    'Bank Alfalah',
    'Meezan Bank',
    'Askari Bank',
    'Bank Al Habib',
    'Faysal Bank',
    'JS Bank',
    'Soneri Bank',
    'Habib Metropolitan',
    'Standard Chartered',
    'Summit Bank',
    'Other',
];

const emptyAdvancedOrderSearchFilters: AdvancedOrderSearchFilters = {
    customer: '',
    orderNumber: '',
    tableNumber: '',
    orderTaker: '',
    orderType: '',
    paymentStatus: '',
    productName: '',
    orderStatus: '',
    returnDatePreset: '',
    returnDateFrom: '',
    returnDateTo: '',
};

const emptyCustomerSearchFilters: CustomerSearchFilters = {
    status: 'all',
    branchId: 'all',
    loyalty: 'all',
    contact: 'all',
};

const emptyPosCustomerForm = (preferredBranchId?: number | null): PosCustomerFormState => ({
    name: '',
    phone_number: '',
    email: '',
    status: 'active',
    gender: '',
    preferred_branch_id: preferredBranchId ? String(preferredBranchId) : '',
    designation: '',
    organization: '',
    city: '',
    country: 'Pakistan',
    address_line_1: '',
    notes: '',
    allow_credit: false,
    credit_limit: '0',
    marketing_opt_in: false,
});

const emptyOnlinePaymentDetails = (): OnlinePaymentDetails => ({
    sender_name: '',
    source_bank: '',
    destination_bank: '',
    transaction_no: '',
});

const emptyCardMachineForm = (): CardMachineFormState => ({
    machine_name: '',
    service_provider: '',
    pid_number: '',
    mid_number: '',
});

const flattenExpenseAccounts = (accounts: any[]): Array<{ id: string; name: string }> =>
    accounts.flatMap((account) => [
        ...(account?.account_type === 'expense'
            ? [{ id: String(account.id), name: `${account.account_code} - ${account.account_name}` }]
            : []),
        ...(Array.isArray(account?.children) ? flattenExpenseAccounts(account.children) : []),
    ]);

const emptyDeliveryOrderForm = (): DeliveryOrderFormState => ({
    contact_person: '',
    phone_number: '',
    address: '',
    house_apartment: '',
    street_no: '',
    area_sector: '',
    locality: '',
    city: '',
    ask_for: '',
    delivery_person_user_id: '',
    delivery_person_name: '',
    payment_term: 'cod',
    delivery_status: 'pending',
    comment: '',
});

function normalizeDeliveryOrderForm(input?: any): DeliveryOrderFormState {
    return {
        contact_person: String(input?.contact_person || ''),
        phone_number: String(input?.phone_number || ''),
        address: String(input?.address || ''),
        house_apartment: String(input?.house_apartment || ''),
        street_no: String(input?.street_no || ''),
        area_sector: String(input?.area_sector || ''),
        locality: String(input?.locality || ''),
        city: String(input?.city || ''),
        ask_for: String(input?.ask_for || ''),
        delivery_person_user_id: input?.delivery_person_user_id ? String(input.delivery_person_user_id) : '',
        delivery_person_name: String(input?.delivery_person_name || ''),
        payment_term: String(input?.payment_term || '').toLowerCase() === 'paid' ? 'paid' : 'cod',
        delivery_status: ['assigned', 'out_for_delivery', 'delivered', 'cancelled'].includes(String(input?.delivery_status || ''))
            ? input.delivery_status
            : 'pending',
        comment: String(input?.comment || ''),
    };
}

function normalizeOrderMode(value?: string | null): OrderMode {
    const normalized = String(value || 'dine_in').toLowerCase();
    if (normalized === 'delivery') return 'delivery';
    if (normalized === 'takeout' || normalized === 'takeaway') return 'takeout';
    return 'dine_in';
}

function sanitizeLoadedOrderSnapshot(order: any) {
    const items = Array.isArray(order?.items)
        ? order.items
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any) => ({
                id: item?.id ?? null,
                product_id: item?.product_id ?? item?.id ?? null,
                product_name: String(item?.product_name || item?.name || ''),
                quantity: Number(item?.quantity || 0),
                item_price: Number(item?.item_price ?? item?.price ?? 0),
                item_notes: String(item?.item_notes || item?.notes || ''),
                item_status: String(item?.item_status || ''),
                station: item?.station ?? item?.prep_station ?? null,
                station_name: item?.station_name ?? item?.prep_station_name ?? null,
                uom: item?.uom ?? item?.unit ?? null,
            }))
        : [];

    return {
        id: order?.id ?? null,
        order_number: order?.order_number ?? null,
        order_type: normalizeOrderMode(order?.order_type),
        order_status: String(order?.order_status || ''),
        table_id: order?.table_id ?? null,
        customer_id: order?.customer_id ?? null,
        order_taker_id: order?.order_taker_id ?? order?.order_taker_user_id ?? null,
        order_note: String(order?.order_note || ''),
        discount_amount: Number(order?.discount_amount || 0),
        created_at: order?.created_at ?? null,
        kot_number: order?.kot_number ?? null,
        kot_version: order?.kot_version ?? null,
        business_day_id: order?.business_day_id ?? null,
        delivery_details: normalizeDeliveryOrderForm(order?.delivery_details),
        items,
    };
}

function toMoney(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? Math.max(Math.round(numeric * 100) / 100, 0) : 0;
}

function getFavoriteStorageKey(branchId: number | null): string {
    return `pos-terminal:favorites:${branchId ?? 'global'}`;
}

function formatReadableDateTime(value?: string | number | Date | null): string {
    if (!value) return '--';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return new Intl.DateTimeFormat('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed);
}

function paymentModeFromMethodCode(code?: string | null): ChargePaymentMode | null {
    const normalized = String(code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!normalized) return null;
    if (normalized.includes('cash')) return 'cash';
    if (normalized.includes('bank')) return 'bank';
    if (normalized.includes('card')) return 'card';
    if (normalized.includes('wallet') || normalized.includes('easypaisa') || normalized.includes('jazzcash')) return 'digital_wallet';
    return 'other';
}

function smartModeFromPaymentMode(mode: PaymentMode): SmartCartPaymentMode {
    if (mode === 'card') return 'credit_card';
    if (mode === 'bank') return 'eft';
    if (mode === 'digital_wallet') return 'wallet';
    return 'cash';
}

function isReturnedPaymentStatus(status?: string | null): boolean {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === 'refunded' || normalized === 'partially_refunded';
}

function isSettledPaymentStatus(status?: string | null): boolean {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === 'paid' || normalized === 'partially_refunded' || normalized === 'refunded';
}

function normalizeOrderStatus(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
}

function isCancelledOrder(order: any): boolean {
    return ['cancelled', 'voided'].includes(normalizeOrderStatus(order?.order_status));
}

function isClosedOrder(order: any): boolean {
    if (isCancelledOrder(order) || isReturnedPaymentStatus(order?.payment_status)) return false;
    return normalizeOrderStatus(order?.order_status) === 'completed' || isSettledPaymentStatus(order?.payment_status);
}

function isInProgressOrder(order: any): boolean {
    if (isCancelledOrder(order) || isClosedOrder(order) || isReturnedPaymentStatus(order?.payment_status)) return false;
    return ['held', 'pending', 'preparing', 'ready', 'served', 'open'].includes(normalizeOrderStatus(order?.order_status));
}

function isKitchenOrder(order: any): boolean {
    if (isCancelledOrder(order) || isClosedOrder(order) || isReturnedPaymentStatus(order?.payment_status)) return false;
    return ['pending', 'preparing', 'ready'].includes(normalizeOrderStatus(order?.order_status));
}

const HIDDEN_KITCHEN_KOT_STATUSES = new Set(['completed', 'cleared']);
const KDS_DISPATCH_EVENT_KEY = 'kitchenos:kds-dispatch';
const KDS_DISPATCH_PRINT_DEFER_MS = 1200;

function getLatestKitchenKotStatus(order: any): string | null {
    const orderKots = Array.isArray(order?.kots) ? order.kots : [];
    if (!orderKots.length) return null;
    const latestKot = orderKots[orderKots.length - 1];
    const normalized = String(latestKot?.status || '').trim().toLowerCase();
    return normalized || null;
}

function isLiveKitchenBoardOrder(order: any): boolean {
    const latestKotStatus = getLatestKitchenKotStatus(order);
    if (!latestKotStatus) return false;
    return !HIDDEN_KITCHEN_KOT_STATUSES.has(latestKotStatus);
}

function notifyKdsDispatch(branchId: number | string | null | undefined, orderId?: number | string | null) {
    const payload = {
        branchId: branchId ? Number(branchId) : null,
        orderId: orderId ? String(orderId) : null,
        dispatchedAt: Date.now(),
    };

    try {
        localStorage.setItem(KDS_DISPATCH_EVENT_KEY, JSON.stringify(payload));
    } catch {
        // The regular KDS polling loop remains the fallback.
    }

    try {
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(KDS_DISPATCH_EVENT_KEY);
            channel.postMessage(payload);
            channel.close();
        }
    } catch {
        // Best-effort cross-tab refresh.
    }
}

function isUnpaidOrder(order: any): boolean {
    if (isCancelledOrder(order) || isReturnedPaymentStatus(order?.payment_status)) return false;
    const normalized = String(order?.payment_status || '').trim().toLowerCase();
    return normalized === 'unpaid' || normalized === 'partial';
}

function getOutstandingBalance(order: any): number {
    const payments = Array.isArray(order?.payments) ? order.payments : Array.isArray(order?.transactions) ? order.transactions : [];
    const paidAmount = payments
        .filter((payment: any) => !payment?.is_refund)
        .reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0);
    return Math.max(Number(order?.total_amount || 0) - paidAmount, 0);
}

function isCreditedOrder(order: any): boolean {
    if (isCancelledOrder(order) || isReturnedPaymentStatus(order?.payment_status)) return false;
    return String(order?.payment_status || '').trim().toLowerCase() === 'credited';
}

function getOrderSearchText(order: any): string {
    const itemNames = Array.isArray(order?.items) ? order.items.map((item: any) => item?.product_name || '').join(' ') : '';
    const returnInvoiceNo = order?.latest_return?.return_number || '';
    const returnRecordId = order?.latest_return?.id || '';
    return `${order?.order_number || ''} ${order?.id || ''} ${returnInvoiceNo} ${returnRecordId} ${order?.table_number || ''} ${order?.customer_id || ''} ${order?.customer_name || ''} ${order?.customer_phone || ''} ${order?.order_taker_name || ''} ${order?.order_taker_username || ''} ${order?.order_type || ''} ${order?.order_status || ''} ${itemNames}`.toLowerCase();
}

function formatOrderListDateTime(value?: string | null): string {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return new Intl.DateTimeFormat('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(parsed);
}

function formatOrderElapsedLabel(value?: string | null, now: Date = new Date()): string | null {
    if (!value) return null;
    const placedAt = new Date(value);
    if (Number.isNaN(placedAt.getTime())) return null;
    const diffMs = Math.max(now.getTime() - placedAt.getTime(), 0);
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m ago` : `${minutes}m ago`;
}

function getOrderItemsPreview(order: any): string {
    const visibleItems = Array.isArray(order?.items)
        ? order.items.filter((item: any) => String(item?.item_status || '').toLowerCase() !== 'voided')
        : [];
    if (visibleItems.length === 0) return 'No item lines';
    const preview = visibleItems.slice(0, 3).map((item: any) => `${item.product_name} x${item.quantity}`).join(' • ');
    return visibleItems.length > 3 ? `${preview} • +${visibleItems.length - 3} more` : preview;
}

function getOrderListStatusTone(order: any): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
    if (isCancelledOrder(order)) return 'danger';
    if (isReturnedPaymentStatus(order?.payment_status)) return 'warning';
    if (isClosedOrder(order)) return 'success';
    if (isKitchenOrder(order)) return 'info';
    return 'neutral';
}

function formatOrderListStatus(order: any): string {
    const normalized = normalizeOrderStatus(order?.order_status);
    if (normalized === 'held') return 'Held';
    if (normalized === 'pending') return 'Pending';
    if (normalized === 'preparing') return 'Preparing';
    if (normalized === 'ready') return 'Ready';
    if (normalized === 'served') return 'Served';
    if (normalized === 'completed') return 'Completed';
    if (normalized === 'cancelled') return 'Cancelled';
    if (normalized === 'voided') return 'Voided';
    return normalized ? normalized.replace(/_/g, ' ') : 'Open';
}

function formatOrderListPaymentStatus(status?: string | null): string {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'credited') return 'Credited';
    if (normalized === 'partial') return 'Partially Paid';
    if (normalized === 'unpaid') return 'Unpaid';
    if (normalized === 'paid') return 'Paid';
    if (normalized === 'partially_refunded') return 'Partially Refunded';
    if (normalized === 'refunded') return 'Refunded';
    return normalized ? normalized.replace(/_/g, ' ') : 'Unknown';
}

function compareOrdersByLatest(left: any, right: any): number {
    const leftTime = left?.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right?.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
}

function paginateList<T>(rows: T[], page: number, pageSize: number) {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        page: safePage,
        totalPages,
        rows: rows.slice(start, start + pageSize),
        totalItems: rows.length,
    };
}

function hasAdvancedOrderSearchFilters(filters: AdvancedOrderSearchFilters): boolean {
    return Object.values(filters).some((value) => String(value || '').trim() !== '');
}

function matchesAdvancedOrderSearch(order: any, filters: AdvancedOrderSearchFilters): boolean {
    const customerToken = filters.customer.trim().toLowerCase();
    if (customerToken) {
        const haystack = `${order?.customer_name || ''} ${order?.customer_phone || ''} ${order?.customer_id || ''}`.toLowerCase();
        if (!haystack.includes(customerToken)) return false;
    }

    const orderNumberToken = filters.orderNumber.trim().toLowerCase();
    if (orderNumberToken) {
        const haystack = `${order?.order_number || ''} ${order?.id || ''} ${order?.latest_return?.return_number || ''} ${order?.latest_return?.id || ''}`.toLowerCase();
        if (!haystack.includes(orderNumberToken)) return false;
    }

    const tableToken = filters.tableNumber.trim().toLowerCase();
    if (tableToken) {
        const haystack = `${order?.table_number || ''} ${order?.table_name || ''} ${order?.table_id || ''}`.toLowerCase();
        if (!haystack.includes(tableToken)) return false;
    }

    const takerToken = filters.orderTaker.trim().toLowerCase();
    if (takerToken) {
        const haystack = `${order?.order_taker_name || ''} ${order?.order_taker_username || ''} ${order?.order_taker_id || ''}`.toLowerCase();
        if (!haystack.includes(takerToken)) return false;
    }

    if (filters.orderType && normalizeOrderMode(order?.order_type) !== filters.orderType) return false;

    const paymentToken = filters.paymentStatus.trim().toLowerCase();
    if (paymentToken) {
        if (paymentToken === 'credited') {
            if (!isCreditedOrder(order)) return false;
        } else if (String(order?.payment_status || '').trim().toLowerCase() !== paymentToken) {
            return false;
        }
    }

    const productToken = filters.productName.trim().toLowerCase();
    if (productToken) {
        const hasProduct = Array.isArray(order?.items) && order.items.some((item: any) => String(item?.product_name || '').toLowerCase().includes(productToken));
        if (!hasProduct) return false;
    }

    const statusToken = filters.orderStatus.trim().toLowerCase();
    if (statusToken && normalizeOrderStatus(order?.order_status) !== statusToken) return false;

    const returnDatePreset = filters.returnDatePreset.trim().toLowerCase();
    const hasReturnDateFilter = !!returnDatePreset || !!filters.returnDateFrom || !!filters.returnDateTo;
    if (hasReturnDateFilter) {
        const returnDate = order?.latest_return?.created_at ? new Date(order.latest_return.created_at) : null;
        if (!returnDate || Number.isNaN(returnDate.getTime())) return false;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const rangeDate = new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate());

        if (returnDatePreset === 'today' && rangeDate.getTime() !== todayStart.getTime()) return false;
        if (returnDatePreset === 'this_week') {
            const weekStart = new Date(todayStart);
            const dayOffset = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
            weekStart.setDate(weekStart.getDate() - dayOffset);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (rangeDate < weekStart || rangeDate > weekEnd) return false;
        }
        if (returnDatePreset === 'this_month') {
            if (returnDate.getFullYear() !== now.getFullYear() || returnDate.getMonth() !== now.getMonth()) return false;
        }
        if (returnDatePreset === 'date_period' || filters.returnDateFrom || filters.returnDateTo) {
            const fromDate = filters.returnDateFrom ? new Date(`${filters.returnDateFrom}T00:00:00`) : null;
            const toDate = filters.returnDateTo ? new Date(`${filters.returnDateTo}T23:59:59`) : null;
            if (fromDate && !Number.isNaN(fromDate.getTime()) && returnDate < fromDate) return false;
            if (toDate && !Number.isNaN(toDate.getTime()) && returnDate > toDate) return false;
        }
    }

    return true;
}

function getRecentOrderChipTone(orderType?: unknown): 'dine-in' | 'takeaway' | 'delivery' {
    const normalized = normalizeOrderMode(orderType);
    if (normalized === 'delivery') return 'delivery';
    if (normalized === 'takeout') return 'takeaway';
    return 'dine-in';
}

function isServiceCharge(charge: any): boolean {
    return !charge?.is_tax && String(charge?.name || charge?.charge_name || '').toLowerCase().includes('service');
}

function resolveConfigNumber(branchDetail: any, keys: string[]): number | null {
    const sources = [branchDetail?.operational_settings, branchDetail?.pos_settings, branchDetail?.settings, branchDetail];
    for (const source of sources) {
        if (!source) continue;
        for (const key of keys) {
            const value = source[key];
            const numeric = Number(value);
            if (value !== undefined && value !== null && value !== '' && Number.isFinite(numeric)) return numeric;
        }
    }
    return null;
}

function normalizePosProduct(product: any): Product | null {
    const price = Number(product?.price ?? product?.effective_price ?? product?.price_override ?? product?.product_base_price ?? 0);
    const enabled = product?.effective_enabled ?? product?.effective_branch_enabled ?? product?.branch_enabled ?? product?.is_enabled ?? true;
    if (enabled === false || !Number.isFinite(price) || price <= 0) {
        return null;
    }

    const rawCategory = product?.category_name ?? product?.category?.category_name ?? product?.category;
    const rawPriceProfile = product?.price_profile
        ?? product?.effective_price_profile_name
        ?? product?.master_price_profile_name
        ?? product?.price_profile_entity?.name;
    const rawUnitLabel = product?.uom
        ?? product?.base_uom?.abbreviation
        ?? product?.base_uom?.name
        ?? product?.unit_name
        ?? product?.unit
        ?? product?.selling_unit;

    return {
        id: Number(product?.id ?? 0),
        productId: Number(product?.product_id ?? product?.id ?? 0),
        name: String(product?.product_name || product?.name || '').trim(),
        price,
        category: typeof rawCategory === 'string' && rawCategory.trim() ? rawCategory.trim() : 'Uncategorized',
        PriceProfile: typeof rawPriceProfile === 'string' && rawPriceProfile.trim() ? rawPriceProfile.trim() : 'Main Menu',
        PriceProfileId: product?.price_profile_id ?? product?.effective_price_profile_id ?? product?.master_price_profile_id ?? null,
        unitLabel: typeof rawUnitLabel === 'string' && rawUnitLabel.trim() ? rawUnitLabel.trim() : 'pc',
        image: product?.img || product?.product_image_url || '',
    };
}

function buildKotChangePayload(options: {
    cart: CartItem[];
    loadedOrderSnapshot: any;
    refreshedOrder?: any;
    activeOrderNumber?: string | null;
    orderNote?: string;
    username?: string | null;
}) {
    const { cart, loadedOrderSnapshot, refreshedOrder, activeOrderNumber, orderNote, username } = options;
    if (!loadedOrderSnapshot) return null;

    const snapshotItems = Array.isArray(loadedOrderSnapshot.items)
        ? loadedOrderSnapshot.items.filter((item: any) => item && String(item?.item_status || '').toLowerCase() !== 'voided')
        : [];
    const snapshotById = new Map<number, any>(
        snapshotItems
            .map((item: any) => [Number(item?.id), item] as const)
            .filter((entry: readonly [number, any]): entry is readonly [number, any] => Number.isFinite(entry[0])),
    );

    const add_items: Array<{ name: string; qty: number; station?: string | null; modifiers?: string[] | null }> = [];
    const cancel_items: Array<{ name: string; qty: number; station?: string | null; modifiers?: string[] | null }> = [];
    const modify_items: Array<{ name: string; old_qty: number; new_qty: number; station?: string | null; modifiers?: string[] | null }> = [];

    cart.forEach((item) => {
        const currentQty = item.isDeleted ? 0 : Number(item.quantity || 0);
        if (item.orderItemId) {
            const original = snapshotById.get(Number(item.orderItemId));
            if (!original) return;

            const oldQty = Number(original.quantity || 0);
            const itemName = item.name || original.product_name || original.name || 'Item';
            const station = item.category || original.category || 'Uncategorized';
            const originalNote = String(original.item_notes || '').trim();
            const currentNote = String(item.note || '').trim();
            if (currentQty <= 0 && oldQty > 0) {
                cancel_items.push({
                    name: itemName,
                    qty: oldQty,
                    station,
                    modifiers: currentNote ? [currentNote] : null,
                });
                return;
            }
            if (currentQty > 0 && currentQty !== oldQty) {
                modify_items.push({
                    name: itemName,
                    old_qty: oldQty,
                    new_qty: currentQty,
                    station,
                    modifiers: currentNote ? [currentNote] : null,
                });
                return;
            }
            if (currentNote !== originalNote) {
                modify_items.push({
                    name: itemName,
                    old_qty: oldQty,
                    new_qty: currentQty,
                    station,
                    modifiers: currentNote ? [currentNote] : ['Notes updated'],
                });
            }
            return;
        }

        if (!item.isDeleted && currentQty > 0) {
            add_items.push({
                name: item.name || 'Item',
                qty: currentQty,
                station: item.category || 'Uncategorized',
                modifiers: item.note ? [item.note] : null,
            });
        }
    });

    const normalizedOrderNote = String(orderNote || refreshedOrder?.order_note || '').trim();
    const originalOrderNote = String(loadedOrderSnapshot?.order_note || '').trim();
    const orderNoteChanged = normalizedOrderNote !== originalOrderNote;

    if (add_items.length === 0 && cancel_items.length === 0 && modify_items.length === 0 && !orderNoteChanged) {
        return null;
    }

    return {
        kot_version:
            formatConfiguredKotNumber(
                resolveKotDisplayNumber(refreshedOrder || loadedOrderSnapshot, '-'),
                refreshedOrder || loadedOrderSnapshot,
                { preserveTypePrefix: true },
            ) || resolveKotDisplayNumber(refreshedOrder || loadedOrderSnapshot, '-'),
        order_no:
            formatConfiguredOrderNumber(
                refreshedOrder?.order_number || activeOrderNumber || loadedOrderSnapshot?.order_number || loadedOrderSnapshot?.id || '-',
                refreshedOrder || loadedOrderSnapshot,
                { preserveTypePrefix: true },
            ) || refreshedOrder?.order_number || activeOrderNumber || loadedOrderSnapshot?.order_number || loadedOrderSnapshot?.id || '-',
        datetime: refreshedOrder?.updated_at || refreshedOrder?.created_at || new Date(),
        user: username || 'System',
        add_items,
        cancel_items,
        modify_items,
        notes: normalizedOrderNote || loadedOrderSnapshot?.order_note || null,
        printed_at: new Date(),
        print_id: refreshedOrder?.id || loadedOrderSnapshot?.id || 'kot-change',
    };
}

function buildKotPrintPayload(options: {
    cart: CartItem[];
    order: any;
    orderMode: OrderMode;
    selectedTableId: number | null;
    branchTables: any[];
    orderNote?: string;
    username?: string | null;
}) {
    const { cart, order, orderMode, selectedTableId, branchTables, orderNote, username } = options;
    const table = branchTables.find((entry: any) => Number(entry?.id) === Number(selectedTableId || 0));

    return {
        kot_no:
            formatConfiguredKotNumber(resolveKotDisplayNumber(order, '-'), order, { preserveTypePrefix: true })
            || resolveKotDisplayNumber(order, '-'),
        order_no:
            formatConfiguredOrderNumber(order?.order_number || order?.id || '-', order, { preserveTypePrefix: true })
            || order?.order_number || order?.id || '-',
        datetime: order?.created_at || new Date(),
        order_type: orderModeMeta[orderMode] || 'Dine In',
        table: orderMode === 'dine_in' ? (table?.table_number || table?.table_name || table?.name || selectedTableId || null) : null,
        token: orderMode === 'takeout' ? order?.token || null : null,
        rider: orderMode === 'delivery' ? order?.rider || null : null,
        guests: order?.guests ?? null,
        server: username || 'POS User',
        items: cart
            .filter((item) => !item.isDeleted && Number(item.quantity || 0) > 0)
            .map((item) => ({
                name: item.name || 'Item',
                qty: item.quantity || 0,
                modifiers: [item.note].filter((value): value is string => Boolean(value)),
                station: item.category || 'Uncategorized',
            })),
        notes: orderNote?.trim() || null,
        printed_by: username || 'POS User',
        print_id: order?.id || order?.order_number || 'kot',
        printed_at: new Date(),
    };
}

function normalizeStationKey(value: string | null | undefined) {
    return String(value || '').trim() || 'Uncategorized';
}

function groupKotItemsByPrintMode<T extends { station?: string | null }>(
    items: T[],
    separateStations: string[],
) {
    const normalizedSeparate = new Set(separateStations.map((entry) => normalizeStationKey(entry)));
    const grouped = new Map<string, T[]>();

    items.forEach((item) => {
        const station = normalizeStationKey(item.station);
        const key = normalizedSeparate.has(station) ? station : '__combined__';
        const current = grouped.get(key) || [];
        current.push(item);
        grouped.set(key, current);
    });

    return grouped;
}

function getCartLineChangeState(item: CartItem): 'unchanged' | 'increase' | 'decrease' | 'new' {
    if (item.isDeleted) {
        return 'decrease';
    }
    if (!item.orderItemId || item.isNewLine) {
        return 'new';
    }
    const originalQuantity = Number(item.originalQuantity ?? item.quantity ?? 0);
    const currentQuantity = Number(item.quantity ?? 0);
    if (currentQuantity > originalQuantity) {
        return 'increase';
    }
    if (currentQuantity < originalQuantity) {
        return 'decrease';
    }
    return 'unchanged';
}

function PosReceiptModal({ order, branchDetail, onClose }: { order: any; branchDetail: any | null; onClose: () => void }) {
    const [receiptFormat, setReceiptFormat] = useState<'thermal-80mm' | 'a6' | 'a5' | 'a4'>('a6');
    const resolvedCurrencyCode = branchDetail?.effective_currency_code || branchDetail?.currency_code;
    const formatMoney = useCallback(
        (value?: number | null) => formatCurrency(value, { currencyCode: resolvedCurrencyCode }),
        [resolvedCurrencyCode],
    );
    const formatPlainAmount = useCallback((value?: number | null) => {
        const numeric = Number(value ?? 0);
        return new Intl.NumberFormat('en-PK', {
            minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(Number.isFinite(numeric) ? numeric : 0);
    }, []);
    const items = Array.isArray(order?.items) ? order.items : [];
    const payments = Array.isArray(order?.payments) ? order.payments : [];
    const charges = Array.isArray(order?.charges) ? order.charges : [];
    const branchLabel = branchDetail?.branch_name || branchDetail?.name || 'KitchenOS';
    const settings = resolvePrintTemplateSettings(branchDetail, branchLabel);
    const visibleOrderNumber =
        formatConfiguredOrderNumber(order?.order_number || order?.id || '-', branchDetail || order, { preserveTypePrefix: true })
        || order?.order_number || order?.id || '-';
    useEffect(() => {
        setReceiptFormat((settings.receipt_paper_size as 'thermal-80mm' | 'a6' | 'a5' | 'a4') || 'a6');
    }, [settings.receipt_paper_size]);
    const paidAmount = payments
        .filter((payment: any) => !payment?.is_refund)
        .reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0);
    const changeAmount = Number(order?._printContext?.change_due || 0);
    const primaryPayment = payments.find((payment: any) => !payment?.is_refund) || null;
    const primaryPaymentDetails = primaryPayment?.payment_details || null;
    const taxProfile = order?._printContext?.tax_profile || null;
    const paymentMethodsUsed = Array.from(
        new Set(
            payments
                .filter((payment: any) => !payment?.is_refund)
                .map((payment: any) => String(payment?.payment_mode || '').trim())
                .filter(Boolean),
        ),
    );
    const printableItems = items.map((item: any) => ({
        name: item?.product_name || item?.name || 'Item',
        qty: Number(item?.quantity || 0),
        price: formatPlainAmount(Number(item?.item_price || item?.price || 0)),
        total: formatPlainAmount(Number(item?.item_price || item?.price || 0) * Number(item?.quantity || 0)),
    }));
    const taxRateLabel = taxProfile?.tax_rate !== undefined && taxProfile?.tax_rate !== null
        ? (
            String(taxProfile?.calculation_method || 'percentage').toLowerCase() === 'fixed'
                ? `Fixed ${formatPlainAmount(Number(taxProfile.tax_rate || 0))}`
                : `${Number(taxProfile.tax_rate || 0)}%`
        )
        : '';
    const paymentDetailLines = [
        primaryPaymentDetails?.sender_name
            ? { label: 'Sender Name', value: primaryPaymentDetails.sender_name }
            : null,
        primaryPaymentDetails?.source_bank
            ? { label: 'Source Bank', value: primaryPaymentDetails.source_bank }
            : null,
        primaryPaymentDetails?.destination_bank
            ? { label: 'Destination Bank', value: primaryPaymentDetails.destination_bank }
            : null,
        primaryPaymentDetails?.transaction_no
            ? { label: 'Transaction No.', value: primaryPaymentDetails.transaction_no }
            : null,
        primaryPaymentDetails?.machine_name
            ? { label: 'POS Machine', value: primaryPaymentDetails.machine_name }
            : null,
        primaryPaymentDetails?.service_provider
            ? { label: 'Provider/Bank', value: primaryPaymentDetails.service_provider }
            : null,
        primaryPaymentDetails?.pid_number
            ? { label: 'PID No.', value: primaryPaymentDetails.pid_number }
            : null,
        primaryPaymentDetails?.mid_number
            ? { label: 'MID No.', value: primaryPaymentDetails.mid_number }
            : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const voidDetailLines = [
        order?.void_authorized_by_username
            ? { label: 'Authorized By', value: order.void_authorized_by_username }
            : null,
        order?.void_reason
            ? { label: 'Remarks', value: order.void_reason }
            : null,
        order?.voided_at
            ? { label: 'Voided At', value: formatReadableDateTime(order.voided_at) }
            : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const refundPayments = payments.filter((payment: any) => payment?.is_refund);
    const primaryRefundPayment = refundPayments[0] || null;
    const returnDetailLines = [
        order?.latest_return?.return_scope
            ? { label: 'Return Scope', value: String(order.latest_return.return_scope).replace(/\b\w/g, (token) => token.toUpperCase()) }
            : null,
        order?.latest_return?.authorized_by
            ? { label: 'Authorized By', value: order.latest_return.authorized_by }
            : null,
        order?.latest_return?.restock_inventory !== undefined
            ? { label: 'Restock', value: order.latest_return.restock_inventory ? 'Yes' : 'No' }
            : null,
        order?.latest_return?.payment_note
            ? { label: 'Reference', value: order.latest_return.payment_note }
            : null,
        order?.latest_return?.created_at
            ? { label: 'Processed At', value: formatReadableDateTime(order.latest_return.created_at) }
            : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const isPaidReceipt =
        !order?.latest_return
        && !order?.is_credit_preview
        && !order?.is_preview
        && String(order?.payment_status || '').toLowerCase() !== 'partial';
    const paidReceiptPreviewMarkup = isPaidReceipt
        ? `
            <style>${KOT_PRINT_CSS}</style>
            ${buildPaymentReceiptPrintMarkup({
                settings,
                format: receiptFormat,
                data: {
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    order_no: visibleOrderNumber,
                    datetime: order?.finalized_at || order?.created_at || new Date(),
                    counter_id: order?.sale_counter?.name || order?.sale_counter?.code || '',
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_name || order?.server_name || order?.order_taker_name || order?.order_taker_username || '-',
                    customer: order?._printContext?.registered_customer_name || order?.customer_name || 'Walk-in Customer',
                    customer_phone: order?.customer_phone || null,
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || '-',
                    table: order?.table_number || order?.table_name || null,
                    token: order?.token || null,
                    rider: order?.rider || order?.delivery_rider_name || null,
                    guests: order?.guests ?? null,
                    items: printableItems.map((item: { name: string; qty: number; price: string; total: string }) => ({
                        name: item.name,
                        qty: item.qty,
                        price: item.price,
                        total: item.total,
                    })),
                    subtotal: formatMoney(Number(order?.sub_total || 0)),
                    tax: formatMoney(Number(order?.tax_amount || 0)),
                    tax_rate_label: taxRateLabel,
                    discount: Number(order?.discount_amount || 0) > 0 ? formatMoney(Number(order?.discount_amount || 0)) : null,
                    total: formatMoney(Number(order?.total_amount || 0)),
                    paid: formatMoney(Math.max(paidAmount, Number(order?.total_amount || 0))),
                    change: formatMoney(changeAmount),
                    method: paymentMethodsUsed.length > 0 ? paymentMethodsUsed.join(' / ') : 'cash',
                    detail_lines: paymentDetailLines,
                    printed_at: new Date(),
                    print_id: order?.receipt_number || order?.id || '-',
                },
            })}
        `
        : '';
    const billSummaryPreviewMarkup = order?.is_preview
        ? `
            <style>${KOT_PRINT_CSS}</style>
            ${buildBillSummaryPrintMarkup({
                settings,
                format: receiptFormat,
                data: {
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    order_no: visibleOrderNumber,
                    datetime: order?.created_at || new Date(),
                    counter_id: order?.sale_counter?.name || order?.sale_counter?.code || '',
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_name || order?.server_name || order?.order_taker_name || order?.order_taker_username || '',
                    customer: order?._printContext?.registered_customer_name || order?.customer_name || 'Walk-in Customer',
                    customer_phone: order?.customer_phone || null,
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || 'Dine In',
                    table: order?.table_number || order?.table_name || null,
                    token: order?.token || null,
                    rider: order?.rider || order?.delivery_rider_name || null,
                    guests: order?.guests ?? null,
                    items: printableItems,
                    subtotal: formatMoney(Number(order?.sub_total || 0)),
                    tax: formatMoney(Number(order?.tax_amount || 0)),
                    discount: Number(order?.discount_amount || 0) > 0 ? formatMoney(Number(order?.discount_amount || 0)) : null,
                    total: formatMoney(Number(order?.total_amount || 0)),
                    printed_at: new Date(),
                    print_id: order?.id || 'draft-bill',
                },
            })}
        `
        : '';
    const creditSalePreviewMarkup = order?.is_credit_preview
        ? `
            <style>${KOT_PRINT_CSS}</style>
            ${buildCreditSaleReceiptPrintMarkup({
                settings,
                format: receiptFormat,
                data: {
                    show_previous_credit_history: Boolean(order?.customer_id),
                    registered_customer_name: order?._printContext?.registered_customer_name || order?.customer_name || '',
                    customer: order?._printContext?.registered_customer_name || order?.customer_name || 'Walk-in Customer',
                    order_no: visibleOrderNumber,
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    datetime: order?.created_at || new Date(),
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_employee_id || order?.server_employee_id || order?.order_taker_employee_id || order?._printContext?.assigned_staff_employee_id || order?.served_by_name || order?.server_name || order?._printContext?.assigned_staff_name || order?.order_taker_name || order?.order_taker_username || '',
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || 'Dine In',
                    table: order?.table_number || order?.table_name || null,
                    items: printableItems.map((item: { name: string; qty: number; price: string; total: string }) => ({
                        name: item.name,
                        qty: item.qty,
                        price: item.price,
                        total: item.total,
                    })),
                    subtotal: formatMoney(Number(order?.sub_total || order?.total_amount || 0)),
                    total: formatMoney(Number(order?.total_amount || 0)),
                    paid: formatMoney(0),
                    credit: formatMoney(Number(order?.total_amount || 0)),
                    prev_balance: formatMoney(Number(order?._printContext?.prev_balance || 0)),
                    new_balance: formatMoney(Number(order?._printContext?.prev_balance || 0) + Number(order?.total_amount || 0)),
                    prev_pending_credit: formatMoney(Number(order?._printContext?.previous_pending_credit || 0)),
                    prev_pending_orders: Number(order?._printContext?.previous_pending_orders || 0),
                    printed_at: new Date(),
                    print_id: order?.id || '-',
                },
            })}
        `
        : '';
    const buildSaleReturnItems = () => {
        const latestReturn = order?.latest_return;
        const returnItems = Array.isArray(latestReturn?.items) ? latestReturn.items : [];
        const cumulativeReturnedByProduct = new Map<string, number>();

        (Array.isArray(order?.returns) ? order.returns : []).forEach((returnRecord: any) => {
            (Array.isArray(returnRecord?.items) ? returnRecord.items : []).forEach((item: any) => {
                const key = String(item?.product_id || item?.product_name || item?.order_item_id || '');
                cumulativeReturnedByProduct.set(key, (cumulativeReturnedByProduct.get(key) || 0) + Number(item?.quantity || 0));
            });
        });

        return returnItems.map((returnItem: any) => {
            const key = String(returnItem?.product_id || returnItem?.product_name || returnItem?.order_item_id || '');
            const soldMatch = items.find((item: any) => {
                const itemKey = String(item?.product_id || item?.product_name || item?.id || '');
                return itemKey === key || String(item?.product_name || '') === String(returnItem?.product_name || '');
            });
            const soldQuantity = Number(soldMatch?.quantity || 0);
            const returnedQuantity = cumulativeReturnedByProduct.get(key) || Number(returnItem?.quantity || 0);

            return {
                name: returnItem?.product_name || 'Item',
                sold: soldQuantity,
                returned: returnedQuantity,
                balance: Math.max(soldQuantity - returnedQuantity, 0),
                unit_price: formatPlainAmount(Number(returnItem?.unit_price || 0)),
                return_amount: formatPlainAmount(Number(returnItem?.refund_amount || 0)),
            };
        });
    };
    const saleReturnPreviewMarkup = order?.latest_return
        ? `
            <style>${KOT_PRINT_CSS}</style>
            ${buildSaleReturnReceiptPrintMarkup({
                settings,
                format: receiptFormat,
                data: {
                    return_no: order?.latest_return?.id || order?.latest_return?.return_number || order?.id,
                    return_invoice_no: order?.latest_return?.return_number || null,
                    branch_id: order?.branch_id || null,
                    order_no: visibleOrderNumber,
                    datetime: order?.latest_return?.created_at || order?.updated_at || order?.created_at || new Date(),
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_employee_id || order?.server_employee_id || order?.order_taker_employee_id || order?._printContext?.assigned_staff_employee_id || order?.served_by_name || order?.server_name || order?._printContext?.assigned_staff_name || order?.order_taker_name || order?.order_taker_username || '-',
                    authorized_by: order?.latest_return?.authorized_by || null,
                    customer: order?._printContext?.registered_customer_name || order?.customer_name || 'Walk-in Customer',
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || '-',
                    table: order?.table_number || order?.table_name || '-',
                    items: buildSaleReturnItems(),
                    refund: formatMoney(Number(order?.latest_return?.refund_amount || 0)),
                    refund_plain: formatPlainAmount(Number(order?.latest_return?.refund_amount || 0)),
                    method: primaryRefundPayment?.payment_mode || 'cash',
                    reason: order?.latest_return?.return_note || order?.latest_return?.payment_note || 'Sales return',
                    detail_lines: returnDetailLines,
                    printed_at: new Date(),
                    print_id: order?.latest_return?.id || order?.id || '-',
                },
            })}
        `
        : '';

    const handlePrint = (mode: 'standard' | 'duplicate' = 'standard') => {
        const format = receiptFormat;
        const duplicateLabel = mode === 'duplicate' ? 'DUPLICATE RECEIPT' : null;
        let documentMarkup = '';

        if (order?.latest_return) {
            documentMarkup = buildSaleReturnReceiptPrintDocument({
                settings,
                format,
                copy_label: duplicateLabel,
                data: {
                    return_no: order?.latest_return?.id || order?.latest_return?.return_number || order?.id,
                    return_invoice_no: order?.latest_return?.return_number || null,
                    branch_id: order?.branch_id || null,
                    order_no: visibleOrderNumber,
                    datetime: order?.latest_return?.created_at || order?.updated_at || order?.created_at || new Date(),
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_employee_id || order?.server_employee_id || order?.order_taker_employee_id || order?._printContext?.assigned_staff_employee_id || order?.served_by_name || order?.server_name || order?._printContext?.assigned_staff_name || order?.order_taker_name || order?.order_taker_username || '-',
                    authorized_by: order?.latest_return?.authorized_by || null,
                    customer: order?._printContext?.registered_customer_name || order?.customer_name || 'Walk-in Customer',
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || '-',
                    table: order?.table_number || order?.table_name || '-',
                    items: buildSaleReturnItems(),
                    refund: formatMoney(Number(order?.latest_return?.refund_amount || 0)),
                    refund_plain: formatPlainAmount(Number(order?.latest_return?.refund_amount || 0)),
                    method: primaryRefundPayment?.payment_mode || 'cash',
                    reason: order?.latest_return?.return_note || order?.latest_return?.payment_note || 'Sales return',
                    detail_lines: returnDetailLines,
                    printed_at: new Date(),
                    print_id: order?.latest_return?.id || order?.id || '-',
                },
            });
        } else if (order?.is_credit_preview) {
            const previousBalance = Number(order?._printContext?.prev_balance || 0);
            const previousPendingCredit = Number(order?._printContext?.previous_pending_credit || 0);
            const previousPendingOrders = Number(order?._printContext?.previous_pending_orders || 0);

            documentMarkup = buildCreditSaleReceiptPrintDocument({
                settings,
                format,
                copy_label: duplicateLabel,
                data: {
                    show_previous_credit_history: Boolean(order?.customer_id),
                    registered_customer_name: order?._printContext?.registered_customer_name || order?.customer_name || '',
                    customer: order?.customer_name || 'Walk-in Customer',
                    order_no: visibleOrderNumber,
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    datetime: order?.created_at || new Date(),
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_employee_id || order?.server_employee_id || order?.order_taker_employee_id || order?._printContext?.assigned_staff_employee_id || order?.served_by_name || order?.server_name || order?._printContext?.assigned_staff_name || order?.order_taker_name || order?.order_taker_username || '',
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || 'Dine In',
                    table: order?.table_number || order?.table_name || null,
                    items: printableItems.map((item: { name: string; qty: number; price: string; total: string }) => ({
                        name: item.name,
                        qty: item.qty,
                        price: item.price,
                        total: item.total,
                    })),
                    subtotal: formatMoney(Number(order?.sub_total || order?.total_amount || 0)),
                    total: formatMoney(Number(order?.total_amount || 0)),
                    paid: formatMoney(0),
                    credit: formatMoney(Number(order?.total_amount || 0)),
                    prev_balance: formatMoney(previousBalance),
                    new_balance: formatMoney(previousBalance + Number(order?.total_amount || 0)),
                    prev_pending_credit: formatMoney(previousPendingCredit),
                    prev_pending_orders: previousPendingOrders,
                    printed_at: new Date(),
                    print_id: order?.id || '-',
                },
            });
        } else if (order?.is_preview) {
            documentMarkup = buildBillSummaryPrintDocument({
                settings,
                format,
                copy_label: duplicateLabel,
                data: {
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    order_no: visibleOrderNumber,
                    datetime: order?.created_at || new Date(),
                    counter_id: order?.sale_counter?.name || order?.sale_counter?.code || '',
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_name || order?.server_name || order?.order_taker_name || order?.order_taker_username || '',
                    customer: order?.customer_name || 'Walk-in Customer',
                    customer_phone: order?.customer_phone || null,
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || 'Dine In',
                    table: order?.table_number || order?.table_name || null,
                    token: order?.token || null,
                    rider: order?.rider || order?.delivery_rider_name || null,
                    guests: order?.guests ?? null,
                    items: printableItems,
                    subtotal: formatMoney(Number(order?.sub_total || 0)),
                    tax: formatMoney(Number(order?.tax_amount || 0)),
                    discount: Number(order?.discount_amount || 0) > 0 ? formatMoney(Number(order?.discount_amount || 0)) : null,
                    total: formatMoney(Number(order?.total_amount || 0)),
                    printed_at: new Date(),
                    print_id: order?.id || 'draft-bill',
                },
            });
        } else if (String(order?.payment_status || '').toLowerCase() === 'partial') {
            documentMarkup = buildPartialPaymentReceiptPrintDocument({
                settings,
                format,
                copy_label: duplicateLabel,
                data: {
                    order_no: visibleOrderNumber,
                    total: formatMoney(Number(order?.total_amount || 0)),
                    paid: formatMoney(paidAmount),
                    balance: formatMoney(Math.max(Number(order?.total_amount || 0) - paidAmount, 0)),
                    printed_at: new Date(),
                    print_id: order?.receipt_number || order?.id || '-',
                },
            });
        } else {
            documentMarkup = buildPaymentReceiptPrintDocument({
                settings,
                format,
                copy_label: duplicateLabel,
                data: {
                    receipt_no: formatConfiguredReceiptNumber(order?.receipt_number || order?.receipt?.receipt_number || '', branchDetail || order, { preserveTypePrefix: true }) || order?.receipt_number || order?.receipt?.receipt_number || '',
                    order_no: visibleOrderNumber,
                    datetime: order?.finalized_at || order?.created_at || new Date(),
                    counter_id: order?.sale_counter?.name || order?.sale_counter?.code || '',
                    cashier: order?.order_taker_employee_id || order?.order_taker_id || order?.order_taker_username || '',
                    server: order?.served_by_name || order?.server_name || order?.order_taker_name || order?.order_taker_username || '-',
                    customer: order?.customer_name || 'Walk-in Customer',
                    customer_phone: order?.customer_phone || null,
                    order_type: orderModeMeta[normalizeOrderMode(order?.order_type)] || '-',
                    table: order?.table_number || order?.table_name || null,
                    token: order?.token || null,
                    rider: order?.rider || order?.delivery_rider_name || null,
                    guests: order?.guests ?? null,
                    items: printableItems.map((item: { name: string; qty: number; price: string; total: string }) => ({
                        name: item.name,
                        qty: item.qty,
                        price: item.price,
                        total: item.total,
                    })),
                    subtotal: formatMoney(Number(order?.sub_total || 0)),
                    discount: Number(order?.discount_amount || 0) > 0 ? formatMoney(Number(order?.discount_amount || 0)) : null,
                    total: formatMoney(Number(order?.total_amount || 0)),
                    tax: formatMoney(Number(order?.tax_amount || 0)),
                    paid: formatMoney(Math.max(paidAmount, Number(order?.total_amount || 0))),
                    change: formatMoney(changeAmount),
                    method: String(order?.order_status || '').toLowerCase() === 'cancelled' || order?._printContext?.is_void_receipt
                        ? 'Void / No Payment'
                        : paymentMethodsUsed.length > 0 ? paymentMethodsUsed.join(' / ') : 'cash',
                    status_label: String(order?.order_status || '').toLowerCase() === 'cancelled' || order?._printContext?.is_void_receipt ? 'VOIDED' : 'PAID',
                    detail_lines: String(order?.order_status || '').toLowerCase() === 'cancelled' || order?._printContext?.is_void_receipt
                        ? [...paymentDetailLines, ...voidDetailLines]
                        : paymentDetailLines,
                    hide_payment_amounts: String(order?.order_status || '').toLowerCase() === 'cancelled' || order?._printContext?.is_void_receipt,
                    printed_at: new Date(),
                    print_id: order?.receipt_number || order?.id || '-',
                },
            });
        }

        if (!openPrintDocumentCopies(() => documentMarkup, settings.receipt_print_copies || 1, order?.order_number ? `Order ${visibleOrderNumber}` : 'Receipt')) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print receipts.');
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div>
                        <h2>{order?.latest_return ? 'Return Receipt' : order?.is_preview ? 'Bill Preview' : 'Order Receipt'}</h2>
                        <p>{branchLabel}</p>
                    </div>
                    <button type="button" className={styles.modalClose} onClick={onClose}><X size={16} /></button>
                </div>

                {isPaidReceipt || order?.is_preview || order?.is_credit_preview || order?.latest_return ? (
                    <div
                        style={{
                            maxHeight: '70vh',
                            overflow: 'auto',
                            background: '#e5e7eb',
                            padding: receiptFormat === 'a6' ? '14px' : '10px',
                            borderRadius: '12px',
                        }}
                        dangerouslySetInnerHTML={{ __html: order?.latest_return ? saleReturnPreviewMarkup : order?.is_preview ? billSummaryPreviewMarkup : order?.is_credit_preview ? creditSalePreviewMarkup : paidReceiptPreviewMarkup }}
                    />
                ) : (
                    <>
                        <div className={styles.fieldStack}>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Order</span><strong>{formatOperationalDisplayNumber(order?.order_number || order?.id || '-', { hideOperationalIdentity: shouldHideOperationalIdentity(branchDetail, settings, 'receipt') }) || '-'}</strong></div>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Type</span><strong>{orderModeMeta[normalizeOrderMode(order?.order_type)]}</strong></div>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Subtotal</span><strong>{formatMoney(Number(order?.sub_total || 0))}</strong></div>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Discount</span><strong>{formatMoney(Number(order?.discount_amount || 0))}</strong></div>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Tax</span><strong>{formatMoney(Number(order?.tax_amount || 0))}</strong></div>
                            <div className={styles.metaRow}><span className={styles.metaLabel}>Total</span><strong>{formatMoney(Number(order?.total_amount || 0))}</strong></div>
                        </div>

                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Items</label>
                            <div className={styles.orderList}>
                                {items.map((item: any, index: number) => (
                                    <div key={`${item?.id || item?.product_name || 'item'}-${index}`} className={styles.orderRow}>
                                        <span>{item?.product_name || item?.name || `Item ${index + 1}`}</span>
                                        <strong>{Number(item?.quantity || 0)} x {formatMoney(Number(item?.item_price || item?.price || 0))}</strong>
                                    </div>
                                ))}
                                {items.length === 0 && <div className={styles.emptyText}>No receipt items available.</div>}
                            </div>
                        </div>

                        {charges.length > 0 && (
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Charges</label>
                                <div className={styles.orderList}>
                                    {charges.map((charge: any, index: number) => (
                                        <div key={`${charge?.id || charge?.charge_name || 'charge'}-${index}`} className={styles.orderRow}>
                                            <span>{charge?.charge_name || `Charge ${index + 1}`}</span>
                                            <strong>{formatMoney(Number(charge?.amount || 0))}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {payments.length > 0 && (
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Payments</label>
                                <div className={styles.orderList}>
                                    {payments.map((payment: any, index: number) => (
                                        <div key={`${payment?.id || payment?.payment_mode || 'payment'}-${index}`} className={styles.orderRow}>
                                            <span>{paymentModeLabels[(payment?.payment_mode || 'cash') as PaymentMode] || payment?.payment_mode || 'Payment'}</span>
                                            <strong>{formatMoney(Number(payment?.amount || 0))}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className={styles.modalActions}>
                    <select
                        className={styles.compactInput}
                        value={receiptFormat}
                        onChange={(event) => setReceiptFormat(event.target.value as 'thermal-80mm' | 'a6' | 'a5' | 'a4')}
                        style={{ minWidth: '140px' }}
                    >
                        <option value="thermal-80mm">80mm Thermal</option>
                        <option value="a6">A6</option>
                        <option value="a5">A5</option>
                        <option value="a4">A4</option>
                    </select>
                    <KitchenButton variant="outline" onClick={onClose}>Close</KitchenButton>
                    <KitchenButton variant="primary" onClick={() => handlePrint()}><Printer size={16} /> Print</KitchenButton>
                </div>
            </div>
        </div>
    );
}

export function PosTerminal() {
    const { currencyCode, currencyLabel: hookCurrencyLabel, formatMoney: baseFormatMoney } = useCurrencyConfig();
    const navigate = useNavigate();
    const { canOperatePos, canReadPos, canCancelOrder, canReturnOrder: canProcessSalesReturn, canUseKds, canManageBranchDay, canManageShifts, canManageTillSessions, canUseCashierConsole, canSettleCreditPayments, hasPermission, userContext } = usePermissionAccess();
    const [activeTill, setActiveTill] = useState(() => getActiveTillSession());
    const [currentCounterSession, setCurrentCounterSession] = useState<any | null>(null);

    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [branchNameMap, setBranchNameMap] = useState<Record<number, string>>({});
    const [branchDetail, setBranchDetail] = useState<any | null>(null);
    const [currentShift, setCurrentShift] = useState<any | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [PriceProfiles, setPriceProfiles] = useState<string[]>(['All']);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedPriceProfile, setSelectedPriceProfile] = useState('All');
    const [isPriceProfileCollapsed, setIsPriceProfileCollapsed] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchOrderNo, setSearchOrderNo] = useState('');
    const [submittedSearchOrderNo, setSubmittedSearchOrderNo] = useState('');
    const [orderListView, setOrderListView] = useState<OrderListView>('table');
    const [orderSearchFilters, setOrderSearchFilters] = useState<AdvancedOrderSearchFilters>(emptyAdvancedOrderSearchFilters);
    const [appliedOrderSearchFilters, setAppliedOrderSearchFilters] = useState<AdvancedOrderSearchFilters>(emptyAdvancedOrderSearchFilters);
    const [showAdvancedOrderFilters, setShowAdvancedOrderFilters] = useState(false);
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderMode, setOrderMode] = useState<OrderMode>('dine_in');
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [orderNote, setOrderNote] = useState('');
    const [discountAmount, setDiscountAmount] = useState('0');
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [discountApproval, setDiscountApproval] = useState<DiscountApprovalState | null>(null);
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSearchFilters, setCustomerSearchFilters] = useState<CustomerSearchFilters>(emptyCustomerSearchFilters);
    const [allCustomers, setAllCustomers] = useState<any[]>([]);
    const [orderTakers, setOrderTakers] = useState<any[]>([]);
    const [selectedOrderTakerId, setSelectedOrderTakerId] = useState<number | null>(null);
    const [isCustomerSearchModalOpen, setIsCustomerSearchModalOpen] = useState(false);
    const [isCustomerCreateModalOpen, setIsCustomerCreateModalOpen] = useState(false);
    const [isCreditCustomerModalOpen, setIsCreditCustomerModalOpen] = useState(false);
    const [isDeliveryInfoModalOpen, setIsDeliveryInfoModalOpen] = useState(false);
    const [customerModalIntent, setCustomerModalIntent] = useState<'general' | 'credit'>('general');
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState<PosCustomerFormState>(() => emptyPosCustomerForm(null));
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [deliveryOrderForm, setDeliveryOrderForm] = useState<DeliveryOrderFormState>(() => emptyDeliveryOrderForm());
    const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [branchCharges, setBranchCharges] = useState<any[]>([]);
    const [branchTables, setBranchTables] = useState<any[]>([]);
    const [allOrders, setAllOrders] = useState<any[]>([]);
    const [taxOptions, setTaxOptions] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [cardMachines, setCardMachines] = useState<any[]>([]);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
    const [splitCashAmount, setSplitCashAmount] = useState('');
    const [splitSecondaryMode, setSplitSecondaryMode] = useState<ChargePaymentMode>('bank');
    const [paymentReference, setPaymentReference] = useState('');
    const [onlinePaymentDetails, setOnlinePaymentDetails] = useState<OnlinePaymentDetails>(() => emptyOnlinePaymentDetails());
    const [selectedCardMachineId, setSelectedCardMachineId] = useState('');
    const [isCardMachineModalOpen, setIsCardMachineModalOpen] = useState(false);
    const [cardMachineForm, setCardMachineForm] = useState<CardMachineFormState>(() => emptyCardMachineForm());
    const [isSavingCardMachine, setIsSavingCardMachine] = useState(false);
    const [cashReceivedAmount, setCashReceivedAmount] = useState('');
    const [taxSelection, setTaxSelection] = useState('none');
    const [serviceChargeInput, setServiceChargeInput] = useState('0.00');
    const [isServiceChargeManual, setIsServiceChargeManual] = useState(false);
    const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
    const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
    const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(null);
    const [activeOrderPlacedAt, setActiveOrderPlacedAt] = useState<string | null>(null);
    const [loadedOrderSnapshot, setLoadedOrderSnapshot] = useState<any | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseAccounts, setExpenseAccounts] = useState<Array<{ id: string; name: string }>>([]);
    const [expenseAccountId, setExpenseAccountId] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expensePaymentMethod, setExpensePaymentMethod] = useState('Cash');
    const [expenseReference, setExpenseReference] = useState('');
    const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
    const [isSalesReturnOpen, setIsSalesReturnOpen] = useState(false);
    const [salesReturnSearch, setSalesReturnSearch] = useState('');
    const [ordersModalPage, setOrdersModalPage] = useState(1);
    const [salesReturnPage, setSalesReturnPage] = useState(1);
    const [salesReturnOrderId, setSalesReturnOrderId] = useState<number | null>(null);
    const [salesReturnPaymentMode, setSalesReturnPaymentMode] = useState<ChargePaymentMode>('cash');
    const [salesReturnReference, setSalesReturnReference] = useState('');
    const [salesReturnNote, setSalesReturnNote] = useState('');
    const [salesReturnRestock, setSalesReturnRestock] = useState(true);
    const [salesReturnQuantities, setSalesReturnQuantities] = useState<Record<number, string>>({});
    const [isSalesReturnSubmitting, setIsSalesReturnSubmitting] = useState(false);
    const [isCancelOrderOpen, setIsCancelOrderOpen] = useState(false);
    const [cancelOrderReason, setCancelOrderReason] = useState('');
    const [cancelOrderApprovalUsername, setCancelOrderApprovalUsername] = useState('');
    const [cancelOrderApprovalPin, setCancelOrderApprovalPin] = useState('');
    const [isCancelOrderSubmitting, setIsCancelOrderSubmitting] = useState(false);
    const [isLineOverrideOpen, setIsLineOverrideOpen] = useState(false);
    const [lineOverrideReason, setLineOverrideReason] = useState('');
    const [lineOverrideApprovalUsername, setLineOverrideApprovalUsername] = useState('');
    const [lineOverrideApprovalPin, setLineOverrideApprovalPin] = useState('');
    const [isLineOverrideSubmitting, setIsLineOverrideSubmitting] = useState(false);
    const [isOrdersOpen, setIsOrdersOpen] = useState(false);
    const [ordersModalTitle, setOrdersModalTitle] = useState<string | null>(null);
    const [ordersModalFilter, setOrdersModalFilter] = useState<OrdersModalFilter>('recent');
    const [, setIsKitchenOrdersRefreshing] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<any | null>(null);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [approverUsername, setApproverUsername] = useState('');
    const [approverPassword, setApproverPassword] = useState('');
    const [isApproving, setIsApproving] = useState(false);
    const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const [isListStyleOpen, setIsListStyleOpen] = useState(false);
    const [posLayout, setPosLayout] = useState<PosLayout>(
        () => (localStorage.getItem('pos_layout_mode') as PosLayout) || 'classic'
    );
    const [smartCartPaymentStyle, setSmartCartPaymentStyle] = useState<SmartCartPaymentStyle>(
        () => (localStorage.getItem('pos_smart_cart_payment_style') as SmartCartPaymentStyle) || 'inline'
    );
    const [smartCartPaymentMode, setSmartCartPaymentMode] = useState<SmartCartPaymentMode>('cash');
    const [isOrderSetupModalOpen, setIsOrderSetupModalOpen] = useState(false);
    const [orderSetupSection, setOrderSetupSection] = useState<OrderSetupSection>('server');
    const [isSmartPaymentModalOpen, setIsSmartPaymentModalOpen] = useState(false);
    const [tableAreaFilter, setTableAreaFilter] = useState<string>('Any Area');
    const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'available' | 'reserved' | 'occupied'>('all');
    const [tableCapacityFilter, setTableCapacityFilter] = useState<'all' | '2' | '4' | '6' | '8'>('all');
    const frequentCustomers = useMemo(() => {
        const counts: Record<number, number> = {};
        allOrders.forEach((order) => {
            if (order.customer_id) {
                counts[order.customer_id] = (counts[order.customer_id] || 0) + 1;
            }
        });
        return allCustomers
            .map((c) => ({ ...c, orderCount: counts[c.id] || 0 }))
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 15);
    }, [allOrders, allCustomers]);

    const tableAreas = useMemo(() => {
        const unique = Array.from(new Set(branchTables.map((t) => t.area_name).filter(Boolean)));
        return ['Any Area', ...unique];
    }, [branchTables]);
    const filteredSetupTables = useMemo(() => (
        branchTables.filter((table: any) => {
            const matchesArea = tableAreaFilter === 'Any Area' || table.area_name === tableAreaFilter;
            const matchesStatus = tableStatusFilter === 'all' || String(table.status || '').toLowerCase() === tableStatusFilter;
            const capacityThreshold = tableCapacityFilter === 'all' ? 0 : Number(tableCapacityFilter);
            const matchesCapacity = !capacityThreshold || Number(table.capacity || 0) >= capacityThreshold;
            return matchesArea && matchesStatus && matchesCapacity;
        })
    ), [branchTables, tableAreaFilter, tableCapacityFilter, tableStatusFilter]);

    const canOpenManagerConsole = canManageBranchDay || canManageShifts || canManageTillSessions;
    const canOpenCreditLedger = canReadPos || canSettleCreditPayments;
    const canOpenCashierExpense = canUseCashierConsole || canManageTillSessions || hasPermission(APP_PERMISSIONS.ACCOUNTING.VOUCHER);
    const [showSidebar, setShowSidebar] = useState(
        localStorage.getItem('pos_show_sidebar') !== 'false'
    );
    const [showRecentOrdersBar, setShowRecentOrdersBar] = useState(
        localStorage.getItem('pos_show_recent_orders_bar') !== 'false'
    );
    const [splitBillGuests, setSplitBillGuests] = useState('2');
    const [cardStyle, setCardStyle] = useState<CardStyle>(
        (localStorage.getItem('pos_card_style') as CardStyle) || 'list'
    );
    const [showPictures, setShowPictures] = useState(
        localStorage.getItem('pos_show_pictures') !== 'false'
    );
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isCatalogLoading, setIsCatalogLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncingMenu, setIsSyncingMenu] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [cartWidth, setCartWidth] = useState(430);
    const [isCartLocked, setIsCartLocked] = useState(false);
    const hasAutoLoadedCatalogRef = useRef(false);
    const lastSelectedBranchIdRef = useRef<number | null>(null);
    const salesReturnApprovalUsernameRef = useRef<HTMLInputElement | null>(null);
    const salesReturnApprovalPinRef = useRef<HTMLInputElement | null>(null);
    const [openingCashConfirmed, setOpeningCashConfirmed] = useState(false);
    const [openingCashAmount, setOpeningCashAmount] = useState(0);
    const [isCreditLedgerOpen, setIsCreditLedgerOpen] = useState(false);
    const [isOrderAuditOpen, setIsOrderAuditOpen] = useState(false);
    const [auditOrderId, setAuditOrderId] = useState<number | null>(null);
    const [auditOrderNo, setAuditOrderNo] = useState<string>('');

    const [isCloseCounterOpen, setIsCloseCounterOpen] = useState(false);
    const [managerAssignedFloat, setManagerAssignedFloat] = useState<number | null>(null);
    const [terminalStatus, setTerminalStatus] = useState<'open' | 'active' | 'closed' | 'blind_submitted' | 'reconciled' | null>(null);

    const isKnownAllowedBranch = useCallback((branchId?: number | string | null) => {
        if (branchId === undefined || branchId === null || branchId === '') return false;
        if (user?.is_system) return true;
        const allowedBranches = user?.allowed_branches ?? [];
        if (allowedBranches.length > 0) {
            return allowedBranches.some((branch: any) => Number(branch.branch_id) === Number(branchId));
        }
        return branches.some((branch: any) => Number(branch.id) === Number(branchId));
    }, [branches, user]);

    const applyCounterSessionState = useCallback((session: any | null, branchId: number | null) => {
        if (!session || !branchId) {
            clearActiveTillSession();
            setActiveTill(null);
            setCurrentCounterSession(null);
            setCurrentShift(null);
            setManagerAssignedFloat(null);
            setOpeningCashConfirmed(false);
            setOpeningCashAmount(0);
            setTerminalStatus(null);
            return;
        }

        const sessionBranchId = Number(session.branch_id || branchId);
        const tillSession = {
            id: Number(session.id),
            name: String(session.sale_counter?.name || 'Sale Counter'),
            code: String(session.sale_counter?.code || session.sale_counter?.name || `COUNTER_${session.sale_counter_id || session.id}`),
            branch_id: sessionBranchId,
            sale_counter_id: Number(session.sale_counter_id || session.sale_counter?.id || session.id),
        };

        persistActiveTillSession(tillSession);
        setActiveTill(tillSession);
        setCurrentCounterSession(session);
        setCurrentShift(session.shift || null);
        setTerminalStatus(session.terminal_status || null);

        const assignedFloat = session.assigned_float === null || session.assigned_float === undefined
            ? null
            : Number(session.assigned_float);
        const verifiedOpeningCash = session.opening_verified_cash === null || session.opening_verified_cash === undefined
            ? assignedFloat ?? 0
            : Number(session.opening_verified_cash);
        const isConfirmed = Boolean(
            session.opening_verified_at
            || session.opening_verified_cash !== null
            || ['active', 'blind_submitted', 'closed', 'reconciled'].includes(String(session.terminal_status || '').toLowerCase()),
        );

        setManagerAssignedFloat(assignedFloat);
        setOpeningCashAmount(verifiedOpeningCash);
        setOpeningCashConfirmed(isConfirmed);
    }, []);

    const resetBranchWorkspaceState = useCallback(() => {
        setCart([]);
        setProducts([]);
        setPriceProfiles(['All']);
        setCategories(['All']);
        setSelectedPriceProfile('All');
        setSelectedCategory('All');
        setSearchTerm('');
        setSearchOrderNo('');
        setSubmittedSearchOrderNo('');
        setOrderSearchFilters(emptyAdvancedOrderSearchFilters);
        setAppliedOrderSearchFilters(emptyAdvancedOrderSearchFilters);
        setShowAdvancedOrderFilters(false);
        setSelectedTableId(null);
        setOrderNote('');
        setDiscountAmount('0');
        setDiscountType('fixed');
        setDiscountApproval(null);
        setVoucherCode('');
        setAppliedVoucher(null);
        setCustomerSearchTerm('');
        setSelectedCustomer(null);
        setSelectedOrderTakerId(null);
        setDeliveryOrderForm(emptyDeliveryOrderForm());
        setBranchCharges([]);
        setBranchTables([]);
        setAllOrders([]);
        setTaxOptions([]);
        setPaymentMethods([]);
        setCardMachines([]);
        setSelectedCardMachineId('');
        setSplitCashAmount('');
        setPaymentReference('');
        setCashReceivedAmount('');
        setIsServiceChargeManual(false);
        setServiceChargeInput('0.00');
        setActiveOrderId(null);
        setActiveOrderNumber(null);
        setActiveOrderStatus(null);
        setActiveOrderPlacedAt(null);
        setLoadedOrderSnapshot(null);
        setCurrentShift(null);
        setBranchDetail(null);
        setExpenseAccounts([]);
        setExpenseAccountId('');
        setIsOrdersOpen(false);
        setOrdersModalTitle(null);
        setIsSalesReturnOpen(false);
        setSalesReturnOrderId(null);
        setSalesReturnSearch('');
        setSalesReturnQuantities({});
        setSalesReturnPage(1);
        setIsCreditLedgerOpen(false);
        setIsOrderAuditOpen(false);
        setAuditOrderId(null);
        setAuditOrderNo('');
    }, []);

    const refreshCounterSession = useCallback(async (branchId: number) => {
        if (!isKnownAllowedBranch(branchId)) return null;
        try {
            const session = await posApi.getMyCounterSession(branchId);
            applyCounterSessionState(session, branchId);
            return session;
        } catch (error) {
            console.warn('Could not load cashier counter session:', error);
            applyCounterSessionState(null, branchId);
            return null;
        }
    }, [applyCounterSessionState, isKnownAllowedBranch]);

    const ensureCanOperateTerminal = useCallback((actionLabel: string) => {
        if (canOperatePos) return true;
        toast.error('POS Access Restricted', `Your current branch role cannot ${actionLabel.toLowerCase()} from the terminal.`);
        return false;
    }, [canOperatePos]);

    useEffect(() => {
        const init = async () => {
            setIsBootstrapping(true);
            try {
                const [branchesData, userData] = await Promise.all([branchApi.getBranches(), authApi.me()]);
                const allowedBranchIds = new Set((userData?.allowed_branches ?? []).map((branch: any) => Number(branch.branch_id)));
                const allowedBranches = userData?.is_system === true
                    ? (branchesData ?? [])
                    : (branchesData ?? []).filter((branch: any) => allowedBranchIds.has(Number(branch.id)));
                const map: Record<number, string> = {};
                allowedBranches.forEach((branch: any) => { map[branch.id] = branch.branch_name; });
                setBranches(allowedBranches);
                setUser(userData);
                setBranchNameMap(map);
                persistUserContext(userData);
                setAuthSessionItem('user_type', userData?.user_type || 'client');
                const stored = localStorage.getItem('activeBranchId');
                const primary = userData?.allowed_branches?.find((branch: any) => branch.is_primary) || userData?.allowed_branches?.[0];
                const storedBranchId = stored ? Number(stored) : null;
                const fallbackBranchId = primary?.branch_id ?? allowedBranches[0]?.id ?? null;
                const nextBranchId = storedBranchId && (userData?.is_system === true || allowedBranchIds.has(storedBranchId))
                    ? storedBranchId
                    : fallbackBranchId;
                setSelectedBranchId(nextBranchId);
            } catch (error) {
                console.error(error);
                toast.error('POS Load Failed', 'Could not initialize the online POS terminal.');
            } finally {
                setIsBootstrapping(false);
            }
        };
        void init();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (selectedBranchId === null) return;
        try {
            const raw = localStorage.getItem(getFavoriteStorageKey(selectedBranchId));
            setFavoriteIds(raw ? JSON.parse(raw) : []);
        } catch {
            setFavoriteIds([]);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (selectedBranchId === null) return;
        localStorage.setItem(getFavoriteStorageKey(selectedBranchId), JSON.stringify(favoriteIds));
    }, [favoriteIds, selectedBranchId]);

    useEffect(() => {
        localStorage.setItem('pos_layout_mode', posLayout);
    }, [posLayout]);

    useEffect(() => {
        localStorage.setItem('pos_smart_cart_payment_style', smartCartPaymentStyle);
    }, [smartCartPaymentStyle]);

    useEffect(() => {
        localStorage.setItem('pos_show_sidebar', String(showSidebar));
    }, [showSidebar]);

    useEffect(() => {
        localStorage.setItem('pos_show_recent_orders_bar', String(showRecentOrdersBar));
    }, [showRecentOrdersBar]);

    useEffect(() => {
        if (!selectedBranchId) return;
        const previousBranchId = lastSelectedBranchIdRef.current;
        const isBranchSwitch = previousBranchId !== null && previousBranchId !== selectedBranchId;
        localStorage.setItem('activeBranchId', String(selectedBranchId));
        localStorage.setItem('branch_id', String(selectedBranchId));
        if (isBranchSwitch) {
            applyCounterSessionState(null, selectedBranchId);
            resetBranchWorkspaceState();
        }
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('openLedger') === 'true') {
            setIsCreditLedgerOpen(true);
        }
        if (branchNameMap[selectedBranchId]) localStorage.setItem('branch_name', branchNameMap[selectedBranchId]);
        lastSelectedBranchIdRef.current = selectedBranchId;
        if (hasAutoLoadedCatalogRef.current) {
            void refreshPosState(selectedBranchId);
            return;
        }
        hasAutoLoadedCatalogRef.current = true;
        void loadTerminalState(selectedBranchId, orderMode, { showLoader: true });
    }, [applyCounterSessionState, branchNameMap, selectedBranchId, resetBranchWorkspaceState]);

    useEffect(() => {
        if (orderMode !== 'dine_in') setSelectedTableId(null);
    }, [orderMode]);

    useEffect(() => {
        const nextAgent = deliveryAgents.find((entry: any) => Number(entry.id) === Number(deliveryOrderForm.delivery_person_user_id || 0));
        if (!nextAgent) return;
        setDeliveryOrderForm((current) => ({
            ...current,
            delivery_person_name: nextAgent.full_name || nextAgent.user_name || current.delivery_person_name,
        }));
    }, [deliveryAgents, deliveryOrderForm.delivery_person_user_id]);

    useEffect(() => {
        if (orderMode !== 'delivery' || selectedCustomer?.id) return;
        setDeliveryOrderForm((current) => ({
            ...current,
            contact_person: current.contact_person || '',
            phone_number: current.phone_number || '',
        }));
    }, [orderMode, selectedCustomer]);

    const syncMenuCatalog = async (branchId: number, orderChannel: OrderMode = orderMode) => {
        if (!isKnownAllowedBranch(branchId)) return;
        const sourceErrors: string[] = [];
        let sourceProducts: any[] = [];

        try {
            sourceProducts = await posApi.getSaleProducts(branchId);
        } catch (error: any) {
            sourceErrors.push(error?.message || 'POS products endpoint failed.');
        }

        if (!sourceProducts.length) {
            try {
                sourceProducts = await catalogApi.getBranchProducts(branchId);
            } catch (error: any) {
                sourceErrors.push(error?.message || 'Catalog branch-products endpoint failed.');
            }
        }

        if (!sourceProducts.length) {
            try {
                const menuPayload = await catalogApi.getBranchMenuByChannel(branchId, { channel: orderChannel });
                sourceProducts = Array.isArray(menuPayload?.products) ? menuPayload.products : [];
            } catch (error: any) {
                sourceErrors.push(error?.message || 'Catalog branch menu endpoint failed.');
            }
        }

        const mappedProducts = (sourceProducts || [])
            .map((product: any) => normalizePosProduct(product))
            .filter(Boolean) as Product[];

        if (!mappedProducts.length && sourceErrors.length > 0) {
            throw new Error(sourceErrors[0]);
        }

        const nextPriceProfiles = ['All', ...Array.from(new Set(mappedProducts.map((product) => product.PriceProfile).filter(Boolean)))];
        const nextCategories = ['All', ...Array.from(new Set(mappedProducts.map((product) => product.category).filter(Boolean)))];
        setProducts(mappedProducts);
        setPriceProfiles(nextPriceProfiles);
        setCategories(nextCategories);
        setSelectedPriceProfile((current) => nextPriceProfiles.includes(current) ? current : 'All');
        setSelectedCategory((current) => nextCategories.includes(current) ? current : 'All');
    };

    const refreshPosState = async (branchId: number) => {
        if (!isKnownAllowedBranch(branchId)) return;
        try {
            const results = await Promise.allSettled([
                branchApi.getCharges(branchId),
                posApi.getTables(branchId),
                posApi.getOrders(branchId),
                branchApi.getBranch(String(branchId)),
                setupApi.getTaxes(),
                setupApi.getPaymentMethods(),
                accountingApi.getAccounts().catch(() => []),
                posApi.getCardMachines(branchId),
                customerApi.getCustomers(),
                posApi.getOrderTakers(branchId),
                userApi.getUsers(),
                refreshCounterSession(branchId),
            ]);

            const [chargesResult, tablesResult, ordersResult, branchResult, taxesResult, methodsResult, expenseAccountsResult, cardMachinesResult, customersResult, orderTakersResult, usersResult, sessionResult] = results;
            const criticalFailures: string[] = [];

            if (chargesResult.status === 'fulfilled') {
                setBranchCharges(chargesResult.value || []);
            } else {
                console.warn('Could not load branch charges for POS terminal:', chargesResult.reason);
                setBranchCharges([]);
            }

            if (tablesResult.status === 'fulfilled') {
                setBranchTables((tablesResult.value || []).filter((table: any) => table.status !== 'cleaning'));
            } else {
                console.warn('Could not load live tables for POS terminal:', tablesResult.reason);
                setBranchTables([]);
                criticalFailures.push('tables');
            }

            if (ordersResult.status === 'fulfilled') {
                setAllOrders([...(ordersResult.value || [])].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
            } else {
                console.warn('Could not load live orders for POS terminal:', ordersResult.reason);
                setAllOrders([]);
                criticalFailures.push('orders');
            }

            if (branchResult.status === 'fulfilled') {
                setBranchDetail(branchResult.value || null);
            } else {
                console.warn('Could not load branch setup for POS terminal:', branchResult.reason);
                setBranchDetail(null);
                criticalFailures.push('branch');
            }

            if (taxesResult.status === 'fulfilled') {
                setTaxOptions((taxesResult.value || []).filter((tax: any) => tax.is_active !== false));
            } else {
                console.warn('Could not load taxes for POS terminal:', taxesResult.reason);
                setTaxOptions([]);
            }

            if (methodsResult.status === 'fulfilled') {
                setPaymentMethods((methodsResult.value || []).filter((method: any) => method.is_active !== false));
            } else {
                console.warn('Could not load payment methods for POS terminal:', methodsResult.reason);
                setPaymentMethods([]);
            }

            if (expenseAccountsResult.status === 'fulfilled') {
                setExpenseAccounts(flattenExpenseAccounts(expenseAccountsResult.value || []));
            } else {
                console.warn('Could not load expense accounts for POS terminal:', expenseAccountsResult.reason);
                setExpenseAccounts([]);
            }

            if (cardMachinesResult.status === 'fulfilled') {
                setCardMachines((cardMachinesResult.value || []).filter((machine: any) => machine.is_active !== false));
            } else {
                console.warn('Could not load POS card machines for POS terminal:', cardMachinesResult.reason);
                setCardMachines([]);
            }

            if (customersResult.status === 'fulfilled') {
                setAllCustomers(customersResult.value || []);
            } else {
                console.warn('Could not fetch customers, perhaps missing CRM module access:', customersResult.reason);
                setAllCustomers([]);
            }

            if (orderTakersResult.status === 'fulfilled') {
                const takers = orderTakersResult.value || [];
                setOrderTakers(takers);
                setSelectedOrderTakerId((current) => {
                    if (takers.some((entry: any) => Number(entry.id) === Number(current || 0))) return current;
                    return null;
                });
            } else {
                console.warn('Could not fetch order takers for POS terminal:', orderTakersResult.reason);
                setOrderTakers([]);
                setSelectedOrderTakerId(null);
            }

            if (usersResult.status === 'fulfilled') {
                const allUsers = usersResult.value || [];
                const branchUsers = allUsers.filter((entry: any) => {
                    const entryBranchId = Number(entry.branch_id || entry.active_branch_id || entry.preferred_branch_id || 0);
                    return entryBranchId === 0 || entryBranchId === Number(branchId);
                });
                const deliveryTaggedUsers = branchUsers.filter((entry: any) => (
                    /delivery|rider|driver|dispatch|courier/i.test(String(entry.designation_name || entry.designation || entry.role_name || ''))
                ));
                const nextAgents = (deliveryTaggedUsers.length > 0 ? deliveryTaggedUsers : branchUsers)
                    .filter((entry: any) => Number(entry.id || 0) > 0);
                setDeliveryAgents(nextAgents);
            } else {
                console.warn('Could not fetch delivery staff for POS terminal:', usersResult.reason);
                setDeliveryAgents([]);
            }

            if (sessionResult.status === 'rejected') {
                console.warn('Could not refresh counter session for POS terminal:', sessionResult.reason);
            }

            if (criticalFailures.length === 3) {
                toast.error('POS Refresh Failed', 'Could not load live orders, live tables, or branch setup.');
            }
        } catch (error) {
            console.error(error);
            toast.error('POS Refresh Failed', 'Could not load the menu, live tables, or branch setup.');
        }
    };

    const refreshKitchenOrders = useCallback(async () => {
        if (!selectedBranchId) return;
        setIsKitchenOrdersRefreshing(true);
        try {
            await refreshPosState(selectedBranchId);
        } finally {
            setIsKitchenOrdersRefreshing(false);
        }
    }, [selectedBranchId]);

    const loadTerminalState = async (branchId: number, orderChannel: OrderMode = orderMode, options?: { showLoader?: boolean }) => {
        if (options?.showLoader) setIsCatalogLoading(true);
        try {
            const [menuResult] = await Promise.allSettled([
                syncMenuCatalog(branchId, orderChannel),
                refreshPosState(branchId),
            ]);
            if (menuResult.status === 'rejected') {
                throw menuResult.reason;
            }
        } catch (error) {
            console.error(error);
            toast.error('Menu Load Failed', error instanceof Error ? error.message : 'Could not load branch products for this terminal.');
        } finally {
            if (options?.showLoader) setIsCatalogLoading(false);
        }
    };

    const availablePaymentModes = useMemo(() => {
        const modes = paymentMethods.map((method: any) => paymentModeFromMethodCode(method.method_code || method.method_name)).filter(Boolean) as ChargePaymentMode[];
        const deduped = Array.from(new Set((modes.length ? modes : ['cash', 'bank', 'card']) as ChargePaymentMode[]));
        return [...deduped, 'split'] as PaymentMode[];
    }, [paymentMethods]);

    const refundPaymentModes = useMemo(
        () => availablePaymentModes.filter((mode) => mode !== 'split') as ChargePaymentMode[],
        [availablePaymentModes],
    );

    const splitSecondaryOptions = useMemo(() => availablePaymentModes.filter((mode) => mode !== 'cash' && mode !== 'split') as ChargePaymentMode[], [availablePaymentModes]);

    useEffect(() => {
        if (!availablePaymentModes.includes(paymentMode)) setPaymentMode('cash');
    }, [availablePaymentModes, paymentMode]);

    useEffect(() => {
        if (splitSecondaryOptions.length > 0 && !splitSecondaryOptions.includes(splitSecondaryMode)) setSplitSecondaryMode(splitSecondaryOptions[0]);
    }, [splitSecondaryMode, splitSecondaryOptions]);

    useEffect(() => {
        if (refundPaymentModes.length > 0 && !refundPaymentModes.includes(salesReturnPaymentMode)) {
            setSalesReturnPaymentMode(refundPaymentModes.includes('cash') ? 'cash' : refundPaymentModes[0]);
        }
    }, [refundPaymentModes, salesReturnPaymentMode]);

    const resolveDefaultRefundPaymentMode = useCallback((preferredMode?: ChargePaymentMode | null) => {
        if (refundPaymentModes.includes('cash')) {
            return 'cash' as ChargePaymentMode;
        }
        if (preferredMode && refundPaymentModes.includes(preferredMode)) {
            return preferredMode;
        }
        return refundPaymentModes[0] || 'cash';
    }, [refundPaymentModes]);

    const filteredCustomers = useMemo(() => {
        const term = customerSearchTerm.trim().toLowerCase();
        return allCustomers.filter((customer: any) => {
            if (term) {
                const haystack = [
                    customer.name,
                    customer.phone_number,
                    customer.email,
                    customer.customer_code,
                    customer.city,
                    customer.country,
                    customer.designation,
                    customer.organization,
                    customer.id,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }

            if (customerSearchFilters.status !== 'all' && String(customer.status || 'active') !== customerSearchFilters.status) {
                return false;
            }

            if (customerSearchFilters.branchId !== 'all' && Number(customer.preferred_branch_id || 0) !== Number(customerSearchFilters.branchId)) {
                return false;
            }

            if (customerSearchFilters.loyalty === 'members' && Number(customer.loyalty_points || 0) <= 0) {
                return false;
            }

            if (customerSearchFilters.loyalty === 'non_members' && Number(customer.loyalty_points || 0) > 0) {
                return false;
            }

            if (customerSearchFilters.contact === 'with_phone' && !String(customer.phone_number || '').trim()) {
                return false;
            }

            if (customerSearchFilters.contact === 'with_email' && !String(customer.email || '').trim()) {
                return false;
            }

            if (customerSearchFilters.contact === 'complete_profile' && (!String(customer.phone_number || '').trim() || !String(customer.email || '').trim())) {
                return false;
            }

            return true;
        }).sort((left: any, right: any) => {
            const rightSpent = Number(right.total_spent || 0);
            const leftSpent = Number(left.total_spent || 0);
            if (rightSpent !== leftSpent) return rightSpent - leftSpent;
            return Number(right.total_orders || 0) - Number(left.total_orders || 0);
        }).slice(0, term ? 24 : 18);
    }, [allCustomers, customerSearchFilters, customerSearchTerm]);

    const activeCustomerFilterCount = useMemo(() => (
        Object.values(customerSearchFilters).filter((value) => value !== 'all').length
    ), [customerSearchFilters]);
    const organizationOptions = useMemo(
        () => Array.from(
            new Set(
                allCustomers
                    .map((customer: any) => String(customer.organization || '').trim())
                    .filter((value) => value.length > 0),
            ),
        ).sort((left, right) => left.localeCompare(right)),
        [allCustomers],
    );

    const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()), []);
    const resolvedCurrencyCode = branchDetail?.effective_currency_code || branchDetail?.currency_code || currencyCode;
    const branchLabel = branchDetail?.branch_name || branchDetail?.name || branchNameMap[selectedBranchId || 0] || 'KitchenOS';
    const settings = resolvePrintTemplateSettings(branchDetail, branchLabel);
    const hideOperationalIdentity = shouldHideOperationalIdentity(branchDetail, settings, 'receipt');
    const showOrderOperationalMeta = !hideOperationalIdentity;
    const formatToastDisplayNumber = useCallback((value: unknown, fallback = '-') => {
        const normalized = String(value || fallback || '-').trim() || '-';
        return formatConfiguredOrderNumber(normalized, branchDetail, { preserveTypePrefix: true })
            || formatOperationalDisplayNumber(normalized, { hideOperationalIdentity: !showOrderOperationalMeta, preserveTypePrefix: true })
            || '-';
    }, [branchDetail, showOrderOperationalMeta]);
    const formatToastKotNumber = useCallback((source: any, fallback = '-') => (
        formatConfiguredKotNumber(resolveKotDisplayNumber(source, fallback), source || branchDetail, { preserveTypePrefix: true })
        || formatToastDisplayNumber(resolveKotDisplayNumber(source, fallback), fallback)
    ), [formatToastDisplayNumber]);
    const formatVisibleOrderNumber = useCallback((value: unknown, fallback: unknown = '-') => {
        const normalized = String(value || fallback || '-').trim() || '-';
        return formatConfiguredOrderNumber(normalized, branchDetail, { preserveTypePrefix: true })
            || formatOperationalDisplayNumber(normalized, { hideOperationalIdentity: !showOrderOperationalMeta, preserveTypePrefix: true })
            || '-';
    }, [branchDetail, showOrderOperationalMeta]);
    const formatVisibleKotNumber = useCallback((source: any, fallback = '-') => (
        formatConfiguredKotNumber(resolveKotDisplayNumber(source, fallback), source || branchDetail, { preserveTypePrefix: true })
        || formatOperationalDisplayNumber(resolveKotDisplayNumber(source, fallback), { hideOperationalIdentity: !showOrderOperationalMeta, preserveTypePrefix: true })
        || fallback
    ), [branchDetail, showOrderOperationalMeta]);
    const buildFullKotPrintJobs = useCallback((payload: ReturnType<typeof buildKotPrintPayload>) => {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const separateStations = settings.enable_station_wise_kot_printing
            ? (settings.separate_kot_stations || [])
            : [];
        const groups = groupKotItemsByPrintMode(items, separateStations);
        const jobs: Array<{ label: string; copies: number; documentMarkup: string }> = [];

        groups.forEach((groupItems, key) => {
            if (groupItems.length === 0) return;
            const stationLabel = key === '__combined__' ? null : key;
            const groupPayload = { ...payload, items: groupItems };
            const documentMarkup = buildKOTPrintDocument({
                settings,
                format: settings.kot_paper_size || 'thermal-80mm',
                data: groupPayload,
                copy_label: stationLabel ? `Station: ${stationLabel}` : null,
            });
            jobs.push({
                label: stationLabel ? `KOT ${payload.order_no} - ${stationLabel}` : `KOT ${payload.order_no}`,
                copies: stationLabel
                    ? Math.max(1, Number(settings.service_station_print_copies?.[stationLabel] || settings.kot_print_copies || 1))
                    : Math.max(1, Number(settings.kot_print_copies || 1)),
                documentMarkup,
            });
        });

        return jobs;
    }, [settings]);
    const buildChangeKotPrintJobs = useCallback((payload: any) => {
        const separateStations = settings.enable_station_wise_kot_printing
            ? (settings.separate_kot_stations || [])
            : [];
        const groupedAdd = groupKotItemsByPrintMode(payload.add_items || [], separateStations);
        const groupedCancel = groupKotItemsByPrintMode(payload.cancel_items || [], separateStations);
        const groupedModify = groupKotItemsByPrintMode(payload.modify_items || [], separateStations);
        const groupKeys = Array.from(new Set([
            ...groupedAdd.keys(),
            ...groupedCancel.keys(),
            ...groupedModify.keys(),
        ]));
        if (groupKeys.length === 0 && payload.notes) {
            groupKeys.push('__combined__');
        }
        const jobs: Array<{ label: string; copies: number; documentMarkup: string }> = [];

        groupKeys.forEach((key) => {
            const stationLabel = key === '__combined__' ? null : key;
            const documentMarkup = buildKOTChangePrintDocument({
                settings,
                format: settings.kot_paper_size || 'thermal-80mm',
                data: {
                    ...payload,
                    add_items: groupedAdd.get(key) || [],
                    cancel_items: groupedCancel.get(key) || [],
                    modify_items: groupedModify.get(key) || [],
                },
                copy_label: stationLabel ? `Station: ${stationLabel}` : null,
            });
            jobs.push({
                label: stationLabel ? `KOT Change ${payload.order_no} - ${stationLabel}` : `KOT Change ${payload.order_no}`,
                copies: stationLabel
                    ? Math.max(1, Number(settings.service_station_print_copies?.[stationLabel] || settings.order_change_print_copies || settings.kot_print_copies || 1))
                    : Math.max(1, Number(settings.order_change_print_copies || settings.kot_print_copies || 1)),
                documentMarkup,
            });
        });

        return jobs;
    }, [settings]);
    const runKotPrintJobs = useCallback((jobs: Array<{ label: string; copies: number; documentMarkup: string }>, blockedMessage: string) => {
        let blocked = false;
        jobs.forEach((job) => {
            if (!openPrintDocumentCopies(() => job.documentMarkup, job.copies, job.label)) {
                blocked = true;
            }
        });
        if (blocked) {
            toast.error('Print Blocked', blockedMessage);
        }
    }, []);
    const queueKotPrintJobs = useCallback((jobs: Array<{ label: string; copies: number; documentMarkup: string }>, blockedMessage: string, delayMs = 0) => {
        window.setTimeout(() => {
            runKotPrintJobs(jobs, blockedMessage);
        }, Math.max(0, delayMs));
    }, [runKotPrintJobs]);
    const resolvedCurrencyLabel = getCurrencyCodeLabel(resolvedCurrencyCode);
    const formatPosMoney = useCallback(
        (value?: number | null, options?: Parameters<typeof formatCurrency>[1]) => (
            formatCurrency(value, { currencyCode: resolvedCurrencyCode, ...options })
        ),
        [resolvedCurrencyCode],
    );
    const formatCartAmount = useCallback((value?: number | null) => {
        const amount = Number(value || 0);
        const digits = resolvedCurrencyCode === 'PKR' ? 0 : 2;
        return Number.isFinite(amount)
            ? amount.toLocaleString('en-PK', {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
            })
            : '0';
    }, [resolvedCurrencyCode]);
    const currencyLabel = resolvedCurrencyLabel || hookCurrencyLabel;
    const formatMoney = useCallback(
        (value?: number | null, options?: Parameters<typeof formatCurrency>[1]) => (
            resolvedCurrencyCode ? formatPosMoney(value, options) : baseFormatMoney(value ?? 0)
        ),
        [baseFormatMoney, formatPosMoney, resolvedCurrencyCode],
    );
    const formatShiftWindow = useCallback((shift: any) => {
        const start = shift?.planned_start ?? shift?.shift_template?.planned_start_time ?? null;
        const end = shift?.planned_end ?? shift?.shift_template?.planned_end_time ?? null;
        const formatPart = (value: string | null) => {
            if (!value) return '';
            const normalized = value.includes('T') ? value : `1970-01-01T${value}`;
            const parsed = new Date(normalized);
            if (Number.isNaN(parsed.getTime())) return '';
            return parsed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
        };
        const startLabel = formatPart(start);
        const endLabel = formatPart(end);
        if (!startLabel || !endLabel) return '';
        return `${startLabel} - ${endLabel}`;
    }, []);
    const ready = Boolean(currentCounterSession && activeTill && activeTill.branch_id === selectedBranchId && currentShift);
    const counterLabel = currentCounterSession?.sale_counter?.code
        || currentCounterSession?.sale_counter?.name
        || activeTill?.code
        || activeTill?.name
        || 'Online Counter';
    const operatorLabel = user?.username || user?.user_name || userContext?.username || 'Staff User';
    const businessDayLabel = currentShift?.business_date ? `Business Day ${currentShift.business_date}` : 'Business Day';
    const businessDayWindowLabel = formatShiftWindow(currentShift);
    const effectiveCart = useMemo(
        () => cart.filter((item) => !item.isDeleted && item.quantity > 0),
        [cart],
    );
    const subtotal = useMemo(() => effectiveCart.reduce((sum, item) => sum + item.price * item.quantity, 0), [effectiveCart]);
    const parsedDiscountValue = Number(discountAmount) || 0;
    const manualDiscount = discountType === 'percent' ? toMoney((subtotal * parsedDiscountValue) / 100) : toMoney(parsedDiscountValue);
    const splitCash = toMoney(splitCashAmount);
    const cashReceived = toMoney(cashReceivedAmount);
    const configuredDiscountAmount = resolveConfigNumber(branchDetail, ['max_discount_amount', 'max_manual_discount', 'discount_limit_amount', 'pos_discount_limit']);
    const configuredDiscountPercent = resolveConfigNumber(branchDetail, ['max_discount_percent', 'discount_limit_percent', 'pos_discount_percent']);
    const discountLimitAmount = configuredDiscountAmount !== null ? configuredDiscountAmount : configuredDiscountPercent !== null ? Number(((subtotal * configuredDiscountPercent) / 100).toFixed(2)) : null;
    const needsDiscountApproval = discountLimitAmount !== null && manualDiscount > discountLimitAmount + 0.01 && (!discountApproval || manualDiscount > discountApproval.approvedAmount + 0.01);
    const appliedVoucherDiscount = toMoney(appliedVoucher?.discount_amount);
    const voucherCodeToUse = appliedVoucher?.code || voucherCode.trim();
    const effectiveManualDiscount = Math.min(manualDiscount, subtotal);
    const effectiveVoucherDiscount = Math.min(appliedVoucherDiscount, Math.max(subtotal - effectiveManualDiscount, 0));
    const netBase = Number(Math.max(subtotal - effectiveManualDiscount - effectiveVoucherDiscount, 0).toFixed(2));

    const resolveRate = (charge: any, mode: ChargePaymentMode) => {
        const rateMap = charge.rate_map ?? {};
        if (rateMap[mode] !== undefined && rateMap[mode] !== null) return Number(rateMap[mode]) || 0;
        if (mode === 'bank' && rateMap.card !== undefined && rateMap.card !== null) return Number(rateMap.card) || 0;
        if (mode === 'card' && rateMap.bank !== undefined && rateMap.bank !== null) return Number(rateMap.bank) || 0;
        return Number(rateMap.default || 0);
    };

    const calculateCharges = (payments: Array<{ payment_mode: ChargePaymentMode; amount: number }>, serviceChargeOverrideAmount: number | null = null) => {
        const calculatedCharges = branchCharges
        .filter((charge: any) => charge.is_active)
        .map((charge: any) => {
            if (serviceChargeOverrideAmount !== null && isServiceCharge(charge)) return null;
            if (charge.is_tax) return null;
            let amount = 0;
            if (charge.condition_trigger === 'none') amount = charge.type === 'percentage' ? (netBase * Number(charge.rate_map?.default || 0)) / 100 : Number(charge.rate_map?.default || 0);
            if (charge.condition_trigger === 'payment_method') amount = charge.type === 'percentage' ? payments.reduce((sum, payment) => sum + ((payment.amount * resolveRate(charge, payment.payment_mode)) / 100), 0) : Math.max(0, ...payments.map((payment) => resolveRate(charge, payment.payment_mode)));
            if (charge.condition_trigger === 'order_type') {
                const rate = Number(charge.rate_map?.[orderMode] || charge.rate_map?.default || 0);
                amount = charge.type === 'percentage' ? (netBase * rate) / 100 : rate;
            }
            return { ...charge, amount: Number(amount.toFixed(2)) };
        })
        .filter((charge: any) => charge && charge.amount > 0);

        if (serviceChargeOverrideAmount !== null && serviceChargeOverrideAmount > 0) {
            const templateCharge = branchCharges.find((charge: any) => charge.is_active && isServiceCharge(charge));
            calculatedCharges.push({
                ...templateCharge,
                id: templateCharge?.id ?? 'manual-service-charge',
                name: templateCharge?.name || 'Service Charge',
                amount: Number(serviceChargeOverrideAmount.toFixed(2)),
                is_tax: false,
            });
        }

        return calculatedCharges;
    };

    let previewPayments: Array<{ payment_mode: ChargePaymentMode; amount: number }> = paymentMode === 'split'
        ? [{ payment_mode: 'cash', amount: Math.min(splitCash, netBase) }, { payment_mode: splitSecondaryMode, amount: Math.max(netBase - splitCash, 0) }]
        : [{ payment_mode: paymentMode as ChargePaymentMode, amount: netBase }];

    const manualServiceChargeAmount = toMoney(serviceChargeInput);
    const serviceChargeOverrideAmount = isServiceChargeManual ? manualServiceChargeAmount : null;

    if (paymentMode === 'split') {
        for (let index = 0; index < 6; index += 1) {
            const nextTotal = netBase + calculateCharges(previewPayments, serviceChargeOverrideAmount).reduce((sum, charge: any) => sum + charge.amount, 0);
            previewPayments = [{ payment_mode: 'cash', amount: Math.min(splitCash, nextTotal) }, { payment_mode: splitSecondaryMode, amount: Number(Math.max(nextTotal - splitCash, 0).toFixed(2)) }];
        }
    }
    const splitSecondaryAmount = paymentMode === 'split'
        ? Number(previewPayments[1]?.amount || 0)
        : 0;

    const autoCalculatedCharges = calculateCharges(previewPayments, null);
    const autoServiceChargeAmount = Number(autoCalculatedCharges.filter((charge: any) => isServiceCharge(charge)).reduce((sum, charge: any) => sum + charge.amount, 0).toFixed(2));
    const appliedCharges = calculateCharges(previewPayments, serviceChargeOverrideAmount);
    const serviceChargeAmount = Number(appliedCharges.filter((charge: any) => !charge.is_tax && String(charge.name || '').toLowerCase().includes('service')).reduce((sum, charge: any) => sum + charge.amount, 0).toFixed(2));
    const otherChargesAmount = Number(appliedCharges.filter((charge: any) => !charge.is_tax).reduce((sum, charge: any) => sum + charge.amount, 0).toFixed(2));

    useEffect(() => {
        if (!isServiceChargeManual) setServiceChargeInput(autoServiceChargeAmount.toFixed(2));
    }, [autoServiceChargeAmount, isServiceChargeManual]);

    // Cash Received is NOT auto-filled — cashier must enter it manually

    const defaultTaxCode = useMemo(() => {
        const taxSettings = branchDetail?.tax_settings;
        if (!taxSettings) return null;
        if (orderMode === 'dine_in') return taxSettings.dine_in_tax_code || taxSettings.default_tax_code || null;
        if (orderMode === 'takeout') return taxSettings.takeaway_tax_code || taxSettings.default_tax_code || null;
        return taxSettings.delivery_tax_code || taxSettings.default_tax_code || null;
    }, [branchDetail, orderMode]);
    const effectiveTaxCode = taxSelection === 'none' ? null : (taxSelection || defaultTaxCode);
    const selectedTaxProfile = useMemo(() => taxOptions.find((tax: any) => tax.tax_code === effectiveTaxCode) || null, [effectiveTaxCode, taxOptions]);
    const taxAmount = useMemo(() => {
        if (!selectedTaxProfile) return 0;
        const taxRate = Number(selectedTaxProfile.tax_rate || 0);
        if (!Number.isFinite(taxRate) || taxRate <= 0) return 0;
        if (String(selectedTaxProfile.calculation_method || 'percentage').toLowerCase() === 'fixed') {
            return Number(taxRate.toFixed(2));
        }
        return Number(((netBase * taxRate) / 100).toFixed(2));
    }, [netBase, selectedTaxProfile]);
    const selectedTaxRateLabel = useMemo(() => {
        if (!selectedTaxProfile) return '';
        return String(selectedTaxProfile.calculation_method || 'percentage').toLowerCase() === 'fixed'
            ? `Fixed ${formatMoney(Number(selectedTaxProfile.tax_rate || 0))}`
            : `${Number(selectedTaxProfile.tax_rate || 0)}%`;
    }, [selectedTaxProfile]);
    const total = Number((netBase + appliedCharges.reduce((sum, charge: any) => sum + charge.amount, 0) + taxAmount).toFixed(2));
    const selectedCardMachine = useMemo(
        () => cardMachines.find((machine: any) => Number(machine.id) === Number(selectedCardMachineId || 0)) || null,
        [cardMachines, selectedCardMachineId],
    );
    const isTaxDisabled = taxSelection === 'none';
    const taxSelectionValue = isTaxDisabled ? 'none' : (effectiveTaxCode || 'branch');
    const isOnlinePayment = paymentMode === 'bank' || paymentMode === 'digital_wallet';
    const isCardPayment = paymentMode === 'card';
    const changeReturn = paymentMode === 'cash' ? Number(Math.max(cashReceived - total, 0).toFixed(2)) : 0;
    const cashShortfall = paymentMode === 'cash' && cashReceivedAmount.trim() ? Number(Math.max(total - cashReceived, 0).toFixed(2)) : 0;

    useEffect(() => {
        setTaxSelection((current) => (current === 'none' ? current : (defaultTaxCode || 'none')));
    }, [defaultTaxCode]);

    useEffect(() => {
        if (!isOnlinePayment) {
            setOnlinePaymentDetails(emptyOnlinePaymentDetails());
        }
        if (!isCardPayment) {
            setSelectedCardMachineId('');
        }
    }, [isCardPayment, isOnlinePayment, paymentMode]);

    useEffect(() => {
        if (posLayout !== 'smart_cart') return;
        if (smartCartPaymentMode === 'credit_sale') {
            setPaymentMode('other');
            return;
        }
        if (smartCartPaymentMode === 'cod') {
            setPaymentMode('cash');
            return;
        }
        if (smartCartPaymentMode === 'credit_card') setPaymentMode('card');
        if (smartCartPaymentMode === 'eft') setPaymentMode('bank');
        if (smartCartPaymentMode === 'wallet') setPaymentMode('digital_wallet');
        if (smartCartPaymentMode === 'cash') setPaymentMode('cash');
    }, [posLayout, smartCartPaymentMode]);

    useEffect(() => {
        if (smartCartPaymentMode === 'credit_sale' || smartCartPaymentMode === 'cod') return;
        setSmartCartPaymentMode(smartModeFromPaymentMode(paymentMode));
    }, [paymentMode, smartCartPaymentMode]);

    useEffect(() => {
        if (posLayout === 'smart_cart') return;
        setIsOrderSetupModalOpen(false);
        setIsSmartPaymentModalOpen(false);
    }, [posLayout]);

    useEffect(() => {
        if (!isActionsOpen) return;
        const handlePointerDown = (event: Event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('.nav-profile-trigger')) return;
            if (target?.closest('.nav-profile-menu')) return;
            setIsActionsOpen(false);
            setIsListStyleOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [isActionsOpen]);

    const filteredProducts = useMemo(() => {
        const favorites = new Set(favoriteIds);
        return products
            .filter((product) => selectedPriceProfile === 'All' || product.PriceProfile === selectedPriceProfile)
            .filter((product) => selectedCategory === 'All' || product.category === selectedCategory)
            .filter((product) => !showFavoritesOnly || favorites.has(product.id))
            .filter((product) => !searchTerm.trim() || product.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
            .sort((left, right) => {
                const favoriteDelta = Number(favorites.has(right.id)) - Number(favorites.has(left.id));
                return favoriteDelta !== 0 ? favoriteDelta : left.name.localeCompare(right.name);
            });
    }, [products, selectedPriceProfile, selectedCategory, showFavoritesOnly, favoriteIds, searchTerm]);

    const categoryCountMap = useMemo(
        () => products.filter((product) => selectedPriceProfile === 'All' || product.PriceProfile === selectedPriceProfile).reduce<Record<string, number>>((acc, product) => ({ ...acc, [product.category]: (acc[product.category] || 0) + 1 }), {}),
        [products, selectedPriceProfile],
    );
    const PriceProfileCountMap = useMemo(
        () => products.reduce<Record<string, number>>((acc, product) => ({ ...acc, [product.PriceProfile]: (acc[product.PriceProfile] || 0) + 1 }), {}),
        [products],
    );
    const recentOrders = useMemo(() => {
        return allOrders.slice(0, 24);
    }, [allOrders]);
    const recentOrderBarOrders = useMemo(() => recentOrders.slice(0, 7), [recentOrders]);
    const activeShiftId = Number(currentCounterSession?.shift_id || currentShift?.id || 0) || null;
    const activeBusinessDayKey = String(currentCounterSession?.business_date || currentShift?.business_date || '').trim();
    const returnableOrders = useMemo(
        () => allOrders.filter((order) => {
            if (String(order.order_status || '').toLowerCase() !== 'completed') return false;
            if (Number(order.remaining_refundable_amount || 0) <= 0.009) return false;
            if (!['paid', 'partially_refunded', 'refunded'].includes(String(order.payment_status || '').toLowerCase())) return false;
            if (activeBusinessDayKey) {
                const orderBusinessDayKey = String(order.business_date || '').trim();
                if (orderBusinessDayKey && orderBusinessDayKey !== activeBusinessDayKey) return false;
            }
            return true;
        }),
        [activeBusinessDayKey, allOrders],
    );

    const isOrderInCurrentDayScope = (order: any, shiftId?: number | null, businessDayKey?: string | null) => {
        const normalizedShiftId = Number(shiftId || 0) || null;
        const normalizedBusinessDayKey = String(businessDayKey || '').trim();
        const orderShiftId = Number(order?.shift_id || 0) || null;
        const orderBusinessDayKey = String(order?.business_date || '').trim();

        if (normalizedShiftId) {
            if (orderShiftId) return orderShiftId === normalizedShiftId;
            if (normalizedBusinessDayKey && orderBusinessDayKey) return orderBusinessDayKey === normalizedBusinessDayKey;
            return false;
        }

        if (normalizedBusinessDayKey) {
            return orderBusinessDayKey === normalizedBusinessDayKey;
        }

        return false;
    };
    const dayScopedOrders = useMemo(() => {
        return allOrders.filter((order) => isOrderInCurrentDayScope(order, activeShiftId, activeBusinessDayKey));
    }, [activeBusinessDayKey, activeShiftId, allOrders]);

    const stats = useMemo(() => {
        return {
            todayOrders: dayScopedOrders.length,
            inProgress: dayScopedOrders.filter((order) => isInProgressOrder(order)).length,
            inKitchen: dayScopedOrders.filter((order) => isLiveKitchenBoardOrder(order)).length,
            unpaid: dayScopedOrders.filter((order) => isUnpaidOrder(order)).length,
            credited: dayScopedOrders.filter((order) => isCreditedOrder(order)).length,
            dineIn: dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'dine_in').length,
            takeaway: dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'takeout').length,
            delivery: dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'delivery').length,
            closed: dayScopedOrders.filter((order) => isClosedOrder(order)).length,
            cancelled: dayScopedOrders.filter((order) => isCancelledOrder(order)).length,
            returned: dayScopedOrders.filter((order) => isReturnedPaymentStatus(order.payment_status)).length,
            occupiedTables: branchTables.filter((table: any) => table.status === 'occupied').length,
            totalTables: branchTables.length,
        };
    }, [branchTables, dayScopedOrders]);

    const modalOrders = useMemo(() => {
        let baseList: any[] = [];
        switch (ordersModalFilter) {
            case 'today':
                baseList = dayScopedOrders;
                break;
            case 'in_progress':
                baseList = dayScopedOrders.filter((order) => isInProgressOrder(order));
                break;
            case 'kitchen':
                baseList = dayScopedOrders.filter((order) => isLiveKitchenBoardOrder(order));
                break;
            case 'unpaid':
                baseList = dayScopedOrders.filter((order) => isUnpaidOrder(order));
                break;
            case 'credited':
                baseList = dayScopedOrders.filter((order) => isCreditedOrder(order));
                break;
            case 'dine_in':
                baseList = dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'dine_in');
                break;
            case 'takeout':
                baseList = dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'takeout');
                break;
            case 'delivery':
                baseList = dayScopedOrders.filter((order) => isInProgressOrder(order) && normalizeOrderMode(order.order_type) === 'delivery');
                break;
            case 'closed':
                baseList = dayScopedOrders.filter((order) => isClosedOrder(order));
                break;
            case 'cancelled':
                baseList = dayScopedOrders.filter((order) => isCancelledOrder(order));
                break;
            case 'returned':
                baseList = dayScopedOrders.filter((order) => isReturnedPaymentStatus(order.payment_status));
                break;
            case 'recent':
            default:
                baseList = recentOrders;
                break;
        }

        const token = submittedSearchOrderNo.trim().toLowerCase();
        const hasAdvancedFilters = hasAdvancedOrderSearchFilters(appliedOrderSearchFilters);
        const sourceList = token || hasAdvancedFilters ? allOrders : baseList;

        return sourceList
            .filter((order) => !token || getOrderSearchText(order).includes(token))
            .filter((order) => matchesAdvancedOrderSearch(order, appliedOrderSearchFilters))
            .sort(compareOrdersByLatest)
            .slice(0, 100);
    }, [allOrders, appliedOrderSearchFilters, dayScopedOrders, ordersModalFilter, recentOrders, submittedSearchOrderNo]);

    const filteredReturnableOrders = useMemo(() => {
        const token = salesReturnSearch.trim().toLowerCase();
        const filtered = !token
            ? returnableOrders
            : returnableOrders.filter((order) => `${order.order_number || ''} ${order.id} ${order.table_number || ''} ${order.customer_id || ''} ${order.customer_name || ''} ${order.customer_phone || ''} ${order.order_taker_name || ''} ${order.order_taker_username || ''}`.toLowerCase().includes(token));
        return [...filtered].sort(compareOrdersByLatest);
    }, [returnableOrders, salesReturnSearch]);
    const pagedModalOrders = useMemo(
        () => paginateList(modalOrders, ordersModalPage, ORDER_MODAL_PAGE_SIZE),
        [modalOrders, ordersModalPage],
    );
    const pagedReturnableOrders = useMemo(
        () => paginateList(filteredReturnableOrders, salesReturnPage, SALES_RETURN_PAGE_SIZE),
        [filteredReturnableOrders, salesReturnPage],
    );
    const selectedOrderTaker = useMemo(
        () => orderTakers.find((orderTaker: any) => Number(orderTaker.id) === Number(selectedOrderTakerId || 0)) || null,
        [orderTakers, selectedOrderTakerId],
    );
    const selectedBranchTable = useMemo(
        () => branchTables.find((table: any) => Number(table.id) === Number(selectedTableId || 0)) || null,
        [branchTables, selectedTableId],
    );
    const selectedDeliveryAgent = useMemo(
        () => deliveryAgents.find((agent: any) => Number(agent.id) === Number(deliveryOrderForm.delivery_person_user_id || 0)) || null,
        [deliveryAgents, deliveryOrderForm.delivery_person_user_id],
    );
    const orderSetupTabSummaries = useMemo(() => ({
        server: {
            value: selectedOrderTaker?.full_name || selectedOrderTaker?.user_name || 'Not assigned',
            meta: selectedOrderTaker?.designation_name || selectedOrderTaker?.employee_id || 'Primary service agent',
        },
        order_type: {
            value: orderModeMeta[orderMode],
            meta: orderMode === 'delivery' ? 'Address and rider flow' : orderMode === 'takeout' ? 'Counter pickup' : 'Floor service',
        },
        customer: {
            value: selectedCustomer?.name || 'Walk-in Customer',
            meta: selectedCustomer?.phone_number || 'No contact provided',
        },
        table: orderMode === 'delivery'
            ? {
                value: deliveryOrderForm.delivery_person_name || selectedDeliveryAgent?.full_name || selectedDeliveryAgent?.user_name || 'Unassigned Rider',
                meta: deliveryOrderForm.address || 'Address pending',
            }
            : orderMode === 'takeout'
                ? {
                    value: 'Not required',
                    meta: 'Takeout order',
                }
                : {
                    value: selectedBranchTable?.table_number || 'No table selected',
                    meta: selectedBranchTable?.area_name || 'Select from list',
                },
    }), [
        deliveryOrderForm.address,
        deliveryOrderForm.delivery_person_name,
        orderMode,
        selectedBranchTable?.area_name,
        selectedBranchTable?.table_number,
        selectedCustomer?.name,
        selectedCustomer?.phone_number,
        selectedDeliveryAgent?.full_name,
        selectedDeliveryAgent?.user_name,
        selectedOrderTaker?.designation_name,
        selectedOrderTaker?.employee_id,
        selectedOrderTaker?.full_name,
        selectedOrderTaker?.user_name,
    ]);
    const codAssignableAgents = useMemo(() => {
        const registry = new Map<number, any>();
        [...deliveryAgents, ...orderTakers].forEach((entry: any) => {
            const id = Number(entry?.id || 0);
            if (!id) return;
            const designation = String(entry?.designation_name || entry?.designation || entry?.role_name || '').toLowerCase();
            if (designation && !/server|waiter|delivery/.test(designation)) return;
            if (!registry.has(id)) registry.set(id, entry);
        });
        return Array.from(registry.values());
    }, [deliveryAgents, orderTakers]);
    const creditOrderNumberLabel = activeOrderNumber || loadedOrderSnapshot?.order_number
        ? formatVisibleOrderNumber(activeOrderNumber || loadedOrderSnapshot?.order_number)
        : 'Will be generated on save';
    const creditedOrders = useMemo(
        () => allOrders.filter((order) => isCreditedOrder(order)),
        [allOrders],
    );
    const selectedCustomerCreditSummary = useMemo(() => {
        if (!selectedCustomer?.id) return { orderCount: 0, outstandingAmount: 0 };
        const customerOrders = creditedOrders.filter((order) => Number(order.customer_id || 0) === Number(selectedCustomer?.id || 0));
        return {
            orderCount: customerOrders.length,
            outstandingAmount: customerOrders.reduce((sum, order) => sum + getOutstandingBalance(order), 0),
        };
    }, [creditedOrders, selectedCustomer]);
    const selectedCustomerCreditLimit = useMemo(
        () => Math.max(Number(selectedCustomer?.credit_limit || 0), 0),
        [selectedCustomer],
    );
    const selectedCustomerCreditControlMode = useMemo(
        () => String(selectedCustomer?.credit_control_mode || 'block').toLowerCase() === 'warn' ? 'warn' : 'block',
        [selectedCustomer],
    );
    const projectedCustomerCreditExposure = useMemo(
        () => selectedCustomerCreditSummary.outstandingAmount + total,
        [selectedCustomerCreditSummary.outstandingAmount, total],
    );
    const isSelectedCustomerStatusBlocked = useMemo(
        () => ['inactive', 'suspended'].includes(String(selectedCustomer?.status || 'active').toLowerCase()),
        [selectedCustomer],
    );
    const isSelectedCustomerOverCreditLimit = useMemo(
        () => Boolean(selectedCustomer?.allow_credit) && selectedCustomerCreditLimit > 0 && projectedCustomerCreditExposure - selectedCustomerCreditLimit > 0.009,
        [projectedCustomerCreditExposure, selectedCustomer, selectedCustomerCreditLimit],
    );
    const shouldBlockSelectedCustomerCredit = useMemo(
        () => isSelectedCustomerOverCreditLimit && selectedCustomerCreditControlMode === 'block',
        [isSelectedCustomerOverCreditLimit, selectedCustomerCreditControlMode],
    );
    const selectedStaffCreditSummary = useMemo(() => {
        if (!selectedOrderTakerId) return { orderCount: 0, outstandingAmount: 0 };
        const staffOrders = creditedOrders.filter((order) => (
            Number(order.order_taker_user_id || order.order_taker_id || order.user_id || 0) === Number(selectedOrderTakerId)
        ));
        return {
            orderCount: staffOrders.length,
            outstandingAmount: staffOrders.reduce((sum, order) => sum + getOutstandingBalance(order), 0),
        };
    }, [creditedOrders, selectedOrderTakerId]);

    const selectedReturnOrder = useMemo(
        () => returnableOrders.find((order) => order.id === salesReturnOrderId) || null,
        [returnableOrders, salesReturnOrderId],
    );
    const selectedReturnLines = useMemo<SalesReturnLine[]>(() => {
        if (!selectedReturnOrder) return [];
        const returnedQtyByItem = new Map<number, number>();
        for (const returnRecord of selectedReturnOrder.returns || []) {
            for (const item of returnRecord.items || []) {
                returnedQtyByItem.set(item.order_item_id, (returnedQtyByItem.get(item.order_item_id) || 0) + Number(item.quantity || 0));
            }
        }
        return (selectedReturnOrder.items || [])
            .filter((item: any) => item.item_status !== 'voided')
            .map((item: any) => {
                const soldQuantity = Number(item.quantity || 0);
                const alreadyReturnedQuantity = returnedQtyByItem.get(item.id) || 0;
                const availableQuantity = Math.max(soldQuantity - alreadyReturnedQuantity, 0);
                const requestedRaw = salesReturnQuantities[item.id];
                const requestedQuantity = requestedRaw === undefined || requestedRaw === ''
                    ? 0
                    : Math.max(0, Math.min(availableQuantity, Math.round(Number(requestedRaw || 0))));
                return {
                    id: item.id,
                    productName: item.product_name,
                    unitPrice: Number(item.item_price || 0),
                    soldQuantity,
                    alreadyReturnedQuantity,
                    availableQuantity,
                    requestedQuantity,
                    baseAmount: Number(item.item_price || 0) * requestedQuantity,
                };
            })
            .filter((item: SalesReturnLine) => item.availableQuantity > 0);
    }, [salesReturnQuantities, selectedReturnOrder]);
    const selectedReturnBase = useMemo(
        () => selectedReturnLines.reduce((sum: number, item: SalesReturnLine) => sum + item.baseAmount, 0),
        [selectedReturnLines],
    );
    const remainingReturnBase = useMemo(
        () => selectedReturnLines.reduce((sum: number, item: SalesReturnLine) => sum + item.unitPrice * item.availableQuantity, 0),
        [selectedReturnLines],
    );
    const selectedReturnMeta = useMemo(() => {
        if (!selectedReturnOrder || remainingReturnBase <= 0 || selectedReturnBase <= 0) {
            return {
                selectedDiscount: 0,
                selectedTax: 0,
                selectedService: 0,
                refundAmount: 0,
                isFullSelection: false,
            };
        }
        const remainingDiscount = Math.max(
            Number(selectedReturnOrder.discount_amount || 0)
            - Number((selectedReturnOrder.returns || []).flatMap((entry: any) => entry.items || []).reduce((sum: number, item: any) => sum + Number(item.discount_amount || 0), 0)),
            0,
        );
        const remainingTax = Math.max(
            Number(selectedReturnOrder.tax_amount || 0)
            - Number((selectedReturnOrder.returns || []).flatMap((entry: any) => entry.items || []).reduce((sum: number, item: any) => sum + Number(item.tax_amount || 0), 0)),
            0,
        );
        const remainingService = Math.max(
            Number(((selectedReturnOrder.charges || []).filter((charge: any) => !charge.is_tax).reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0)))
            - Number((selectedReturnOrder.returns || []).flatMap((entry: any) => entry.items || []).reduce((sum: number, item: any) => sum + Number(item.service_charge_amount || 0), 0)),
            0,
        );
        const isFullSelection = selectedReturnLines.length > 0 && selectedReturnLines.every((item: SalesReturnLine) => item.requestedQuantity === item.availableQuantity);
        const selectedDiscount = isFullSelection ? remainingDiscount : (remainingDiscount * selectedReturnBase) / remainingReturnBase;
        const selectedTax = isFullSelection ? remainingTax : (remainingTax * selectedReturnBase) / remainingReturnBase;
        const selectedService = isFullSelection ? remainingService : (remainingService * selectedReturnBase) / remainingReturnBase;
        return {
            selectedDiscount: toMoney(selectedDiscount),
            selectedTax: toMoney(selectedTax),
            selectedService: toMoney(selectedService),
            refundAmount: toMoney(selectedReturnBase - selectedDiscount + selectedTax + selectedService),
            isFullSelection,
        };
    }, [remainingReturnBase, selectedReturnBase, selectedReturnLines, selectedReturnOrder]);

    useEffect(() => {
        if (salesReturnOrderId && selectedReturnOrder) return;
        if (!isSalesReturnOpen) return;
        setSalesReturnOrderId(filteredReturnableOrders[0]?.id ?? returnableOrders[0]?.id ?? null);
    }, [filteredReturnableOrders, isSalesReturnOpen, returnableOrders, salesReturnOrderId, selectedReturnOrder]);

    useEffect(() => {
        setOrdersModalPage(1);
    }, [ordersModalFilter, submittedSearchOrderNo, appliedOrderSearchFilters, isOrdersOpen]);

    useEffect(() => {
        setSalesReturnPage(1);
    }, [salesReturnSearch, isSalesReturnOpen]);

    useEffect(() => {
        setOrdersModalPage((current) => Math.min(current, Math.max(1, Math.ceil(modalOrders.length / ORDER_MODAL_PAGE_SIZE))));
    }, [modalOrders.length]);

    useEffect(() => {
        setSalesReturnPage((current) => Math.min(current, Math.max(1, Math.ceil(filteredReturnableOrders.length / SALES_RETURN_PAGE_SIZE))));
    }, [filteredReturnableOrders.length]);

    useEffect(() => {
        if (isSalesReturnOpen) return;
        if (salesReturnApprovalUsernameRef.current) salesReturnApprovalUsernameRef.current.value = '';
        if (salesReturnApprovalPinRef.current) salesReturnApprovalPinRef.current.value = '';
    }, [isSalesReturnOpen]);

    useEffect(() => {
        if (!isSalesReturnOpen || !selectedReturnOrder) {
            setSalesReturnQuantities({});
            return;
        }
        const nextQuantities: Record<number, string> = {};
        const returnedQtyByItem = new Map<number, number>();
        for (const returnRecord of selectedReturnOrder.returns || []) {
            for (const item of returnRecord.items || []) {
                returnedQtyByItem.set(item.order_item_id, (returnedQtyByItem.get(item.order_item_id) || 0) + Number(item.quantity || 0));
            }
        }
        for (const item of selectedReturnOrder.items || []) {
            const availableQuantity = Math.max(Number(item.quantity || 0) - (returnedQtyByItem.get(item.id) || 0), 0);
            if (availableQuantity > 0) nextQuantities[item.id] = '';
        }
        setSalesReturnQuantities(nextQuantities);
    }, [isSalesReturnOpen, selectedReturnOrder?.id]);

    const setSalesReturnQuantity = useCallback((itemId: number, value: string, availableQuantity: number) => {
        const sanitized = value.replace(/[^\d]/g, '');
        if (!sanitized) {
            setSalesReturnQuantities((current) => ({ ...current, [itemId]: '' }));
            return;
        }
        const nextQuantity = Math.max(0, Math.min(availableQuantity, Number(sanitized)));
        setSalesReturnQuantities((current) => ({ ...current, [itemId]: String(nextQuantity) }));
    }, []);

    const toggleFavorite = (productId: number) => setFavoriteIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [productId, ...current]);
    const hydrateOrderIntoCart = useCallback((order: any, options?: { silent?: boolean; closeModal?: boolean }) => {
        const sanitizedOrder = sanitizeLoadedOrderSnapshot(order);
        const normalizedMode = sanitizedOrder.order_type;
        const productMap = new Map(products.map((product) => [product.id, product]));
        const sourceItems = sanitizedOrder.items;
        const nextCart = sourceItems.filter((item: any) => String(item?.item_status || '').toLowerCase() !== 'voided').map((item: any, index: number) => {
            const matchedProduct = productMap.get(Number(item.product_id));
            return {
                id: Number(item.product_id ?? item.id ?? 0),
                productId: Number(item.product_id ?? matchedProduct?.id ?? 0),
                name: String(item.product_name || matchedProduct?.name || `Product #${item.product_id ?? item.id}`),
                price: Number(item.item_price ?? matchedProduct?.price ?? 0),
                category: matchedProduct?.category || 'Uncategorized',
                PriceProfile: matchedProduct?.PriceProfile || 'Main Menu',
                PriceProfileId: matchedProduct?.PriceProfileId ?? null,
                unitLabel: matchedProduct?.unitLabel || String(item?.uom || item?.unit || 'pc'),
                image: matchedProduct?.image || '',
                quantity: Number(item.quantity || 0),
                note: item.item_notes || undefined,
                orderItemId: item.id ?? null,
                lineKey: item.id ? `order-item-${item.id}` : `product-${item.product_id ?? item.id}-${index}`,
                originalQuantity: Number(item.quantity || 0),
                originalNote: item.item_notes || undefined,
                isDeleted: false,
                isNewLine: false,
            } satisfies CartItem;
        }).filter((item: CartItem) => item.id > 0 && item.quantity > 0 && item.price > 0);

        const linkedCustomer = sanitizedOrder.customer_id
            ? allCustomers.find((customer: any) => Number(customer.id) === Number(sanitizedOrder.customer_id)) || null
            : null;

        setCart(nextCart);
        setLoadedOrderSnapshot(sanitizedOrder);
        setOrderMode(normalizedMode);
        setSelectedTableId(sanitizedOrder.table_id ? Number(sanitizedOrder.table_id) : null);
        setOrderNote(sanitizedOrder.order_note || '');
        setActiveOrderId(sanitizedOrder.id ? Number(sanitizedOrder.id) : null);
        setActiveOrderNumber(sanitizedOrder.order_number || null);
        setActiveOrderStatus(normalizeOrderStatus(sanitizedOrder.order_status) || null);
        setActiveOrderPlacedAt(sanitizedOrder.created_at || null);
        setDiscountAmount(String(Number(sanitizedOrder.discount_amount || 0)));
        setDiscountType('fixed');
        setDiscountApproval(null);
        setVoucherCode('');
        setAppliedVoucher(null);
        setSplitCashAmount('');
        setPaymentReference('');
        setCashReceivedAmount('');
        setIsServiceChargeManual(false);
        setSelectedCustomer(linkedCustomer);
        setSelectedOrderTakerId(sanitizedOrder.order_taker_id ? Number(sanitizedOrder.order_taker_id) : null);
        setDeliveryOrderForm(sanitizedOrder.delivery_details);
        setCustomerSearchTerm(linkedCustomer ? `${linkedCustomer.name} (${linkedCustomer.phone_number})` : '');
        if (options?.closeModal !== false) setIsOrdersOpen(false);
        if (!options?.silent) {
            toast.success('Order Loaded', `Order #${formatToastDisplayNumber(sanitizedOrder.order_number || sanitizedOrder.id || '')} is now in the cart panel.`);
        }
    }, [allCustomers, products]);

    const loadedOrderIsHeld = activeOrderId !== null && activeOrderStatus === 'held';
    const loadedOrderIsExisting = activeOrderId !== null;
    const loadedOrderIsEditable = activeOrderId !== null && ['held', 'pending', 'preparing', 'ready', 'served'].includes(String(activeOrderStatus || '').toLowerCase());
    const hasDraftChanges = useMemo(() => {
        if (!loadedOrderSnapshot || !loadedOrderIsExisting) return false;
        const snapshotItems = (Array.isArray(loadedOrderSnapshot.items) ? loadedOrderSnapshot.items : []).filter((item: any) => item && String(item?.item_status || '').toLowerCase() !== 'voided');
        const snapshotById = new Map<number, any>(snapshotItems.map((item: any) => [Number(item.id), item]));

        for (const item of cart) {
            if (!item.orderItemId) {
                if (!item.isDeleted && item.quantity > 0) return true;
                continue;
            }
            const original = snapshotById.get(Number(item.orderItemId));
            if (!original) return true;
            const originalQuantity = Number(original.quantity || 0);
            const currentQuantity = item.isDeleted ? 0 : Number(item.quantity || 0);
            const originalPrice = Number(original.item_price || 0);
            const currentPrice = Number(item.price || 0);
            const originalNote = String(original.item_notes || '');
            const currentNote = String(item.note || '');
            if (currentQuantity !== originalQuantity || currentNote !== originalNote || Math.abs(currentPrice - originalPrice) > 0.0001) return true;
        }

        if (cart.filter((item) => item.orderItemId).length !== snapshotItems.length) return true;

        const snapshotDelivery = normalizeDeliveryOrderForm(loadedOrderSnapshot.delivery_details);
        const currentDelivery = normalizeDeliveryOrderForm(buildDeliveryDetailsPayload());
        return (
            Number(selectedTableId || 0) !== Number(loadedOrderSnapshot.table_id || 0)
            || normalizeOrderMode(loadedOrderSnapshot.order_type) !== orderMode
            || Number(selectedCustomer?.id || 0) !== Number(loadedOrderSnapshot.customer_id || 0)
            || Number(selectedOrderTakerId || 0) !== Number(loadedOrderSnapshot.order_taker_id || 0)
            || String(orderNote || '') !== String(loadedOrderSnapshot.order_note || '')
            || JSON.stringify(snapshotDelivery) !== JSON.stringify(currentDelivery)
        );
    }, [cart, deliveryOrderForm, loadedOrderIsExisting, loadedOrderSnapshot, orderMode, orderNote, selectedCustomer?.id, selectedOrderTakerId, selectedTableId]);
    const hasKitchenDraftChanges = useMemo(() => {
        if (!loadedOrderSnapshot || !loadedOrderIsExisting) return false;
        const snapshotItems = (Array.isArray(loadedOrderSnapshot.items) ? loadedOrderSnapshot.items : []).filter((item: any) => item && String(item?.item_status || '').toLowerCase() !== 'voided');
        const snapshotById = new Map<number, any>(snapshotItems.map((item: any) => [Number(item.id), item]));

        for (const item of cart) {
            if (!item.orderItemId) {
                if (!item.isDeleted && item.quantity > 0) return true;
                continue;
            }
            const original = snapshotById.get(Number(item.orderItemId));
            if (!original) return true;
            const originalQuantity = Number(original.quantity || 0);
            const currentQuantity = item.isDeleted ? 0 : Number(item.quantity || 0);
            const originalNote = String(original.item_notes || '');
            const currentNote = String(item.note || '');
            if (currentQuantity !== originalQuantity || currentNote !== originalNote) return true;
        }

        return cart.filter((item) => item.orderItemId).length !== snapshotItems.length;
    }, [cart, loadedOrderIsExisting, loadedOrderSnapshot]);
    const getLatestCartLineForProduct = useCallback((productId: number) => {
        const matches = cart
            .filter((item) => resolveCartProductId(item) === Number(productId) && !item.isDeleted && item.quantity > 0)
            .sort((left, right) => {
                const leftSaved = left.orderItemId ? 1 : 0;
                const rightSaved = right.orderItemId ? 1 : 0;
                if (leftSaved !== rightSaved) return leftSaved - rightSaved;
                return Number(left.orderItemId || 0) - Number(right.orderItemId || 0);
            });
        return matches[matches.length - 1] ?? null;
    }, [cart]);

    const addToCart = async (product: Product) => {
        const productId = resolveCartProductId(product);
        if (!loadedOrderIsExisting) {
            setCart((current) => current.some((item) => resolveCartProductId(item) === productId)
                ? current.map((item) => resolveCartProductId(item) === productId ? { ...item, quantity: item.quantity + 1 } : item)
                : [...current, { ...product, productId, quantity: 1, lineKey: `product-${productId}` }]);
            void playPosCartAddSound();
            return;
        }
        if (!loadedOrderIsEditable || !activeOrderId) {
            toast.error('Order Locked', 'Only active orders can be edited from the cart.');
            return;
        }
        setCart((current) => {
            const matchingEntries = [...current]
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => resolveCartProductId(item) === productId)
                .sort((left, right) => {
                    const leftSaved = left.item.orderItemId ? 1 : 0;
                    const rightSaved = right.item.orderItemId ? 1 : 0;
                    if (leftSaved !== rightSaved) return leftSaved - rightSaved;
                    return Number(left.item.orderItemId || 0) - Number(right.item.orderItemId || 0);
                });
            const matchingSavedActive = matchingEntries
                .filter(({ item }) => item.orderItemId && !item.isDeleted && Number(item.quantity || 0) > 0)
                .at(-1);
            const matchingSavedAny = matchingEntries
                .filter(({ item }) => item.orderItemId)
                .at(-1);
            const matchingDraftActive = matchingEntries
                .filter(({ item }) => !item.orderItemId && !item.isDeleted && Number(item.quantity || 0) > 0)
                .at(-1);
            const matchingIndex = matchingSavedActive || matchingSavedAny || matchingDraftActive;

            if (matchingIndex) {
                return current.map((item, index) => index !== matchingIndex.index
                    ? item
                    : {
                        ...item,
                        quantity: Math.max(Number(item.quantity || 0) + 1, 1),
                        isDeleted: false,
                    });
            }

            return [
                ...current,
                {
                    ...product,
                    productId,
                    quantity: 1,
                    note: undefined,
                    orderItemId: null,
                    lineKey: `draft-new-${productId}-${Date.now()}`,
                    originalQuantity: 0,
                    originalNote: undefined,
                    isDeleted: false,
                    isNewLine: true,
                },
            ];
        });
        void playPosCartAddSound();
    };

    const updateQuantity = async (lineKeyOrProductId: string | number, delta: number) => {
        if (!loadedOrderIsExisting) {
            const productId = Number(lineKeyOrProductId);
            setCart((current) => current.flatMap((item) => item.id !== productId ? [item] : item.quantity + delta <= 0 ? [] : [{ ...item, quantity: item.quantity + delta }]));
            if (delta > 0) {
                void playPosCartAddSound();
            } else if (delta < 0) {
                void playPosCartReduceSound();
            }
            return;
        }
        if (!loadedOrderIsEditable || !activeOrderId) {
            toast.error('Order Locked', 'Only active orders can be edited from the cart.');
            return;
        }
        setCart((current) => current.flatMap((item) => {
            if (item.lineKey !== String(lineKeyOrProductId)) return [item];
            const nextQuantity = Number(item.quantity || 0) + delta;
            if (!item.orderItemId && nextQuantity <= 0) {
                return [];
            }
            if (item.orderItemId) {
                return [{
                    ...item,
                    quantity: Math.max(nextQuantity, 0),
                    isDeleted: nextQuantity <= 0,
                }];
            }
            return nextQuantity <= 0 ? [] : [{ ...item, quantity: nextQuantity, isDeleted: false }];
        }));
        if (delta > 0) {
            void playPosCartAddSound();
        } else if (delta < 0) {
            void playPosCartReduceSound();
        }
    };

    const decrementExistingProduct = async (productId: number) => {
        const targetLine = getLatestCartLineForProduct(productId);
        if (!targetLine) return;
        await updateQuantity(targetLine.lineKey, -1);
    };

    const removeFromCart = async (lineKeyOrProductId: string | number) => {
        if (!loadedOrderIsExisting) {
            const productId = Number(lineKeyOrProductId);
            setCart((current) => current.filter((item) => item.id !== productId));
            void playPosCartReduceSound();
            return;
        }
        if (!loadedOrderIsEditable || !activeOrderId) {
            toast.error('Order Locked', 'Only active orders can be edited from the cart.');
            return;
        }
        setCart((current) => current.flatMap((item) => {
            if (item.lineKey !== String(lineKeyOrProductId)) return [item];
            if (!item.orderItemId) return [];
            return [{ ...item, quantity: 0, isDeleted: true }];
        }));
        void playPosCartReduceSound();
    };

    const updateItemNote = async (lineKeyOrProductId: string | number, note: string) => {
        if (!loadedOrderIsExisting) {
            const productId = Number(lineKeyOrProductId);
            setCart((current) => current.map((item) => item.id === productId ? { ...item, note: note || undefined } : item));
            return;
        }
        if (!loadedOrderIsEditable || !activeOrderId) {
            toast.error('Order Locked', 'Only active orders can be edited from the cart.');
            return;
        }
        setCart((current) => current.map((item) => item.lineKey === String(lineKeyOrProductId)
            ? { ...item, note: note || undefined }
            : item));
    };
    const updateItemPrice = (lineKeyOrProductId: string | number, newPrice: string) => {
        const parsed = parseFloat(newPrice);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        setCart((current) => current.map((item) => {
            const isMatch = loadedOrderIsExisting ? item.lineKey === String(lineKeyOrProductId) : item.id === Number(lineKeyOrProductId);
            return isMatch ? { ...item, price: parsed } : item;
        }));
    };
    const setLineQuantity = (lineKeyOrProductId: string | number, nextQuantityRaw: string) => {
        const parsed = Math.floor(Number(nextQuantityRaw));
        if (!Number.isFinite(parsed)) return;
        if (!loadedOrderIsExisting) {
            const productId = Number(lineKeyOrProductId);
            setCart((current) => current.flatMap((item) => {
                if (item.id !== productId) return [item];
                if (parsed <= 0) return [];
                return [{ ...item, quantity: parsed }];
            }));
            return;
        }
        if (!loadedOrderIsEditable || !activeOrderId) {
            toast.error('Order Locked', 'Only active orders can be edited from the cart.');
            return;
        }
        setCart((current) => current.flatMap((item) => {
            if (item.lineKey !== String(lineKeyOrProductId)) return [item];
            if (!item.orderItemId && parsed <= 0) {
                return [];
            }
            if (item.orderItemId) {
                return [{ ...item, quantity: Math.max(parsed, 0), isDeleted: parsed <= 0 }];
            }
            return parsed <= 0 ? [] : [{ ...item, quantity: parsed, isDeleted: false }];
        }));
    };

    const createCustomerInline = async () => {
        if (!newCustomerForm.name.trim()) {
            toast.error('Customer Required', 'Customer name is required.');
            return;
        }
        if (!newCustomerForm.phone_number.trim() && !newCustomerForm.email.trim()) {
            toast.error('Contact Required', 'Add at least a phone number or an email address.');
            return;
        }
        setIsCreatingCustomer(true);
        try {
            const customer = await customerApi.createCustomer({
                name: newCustomerForm.name.trim(),
                phone_number: newCustomerForm.phone_number.trim() || undefined,
                email: newCustomerForm.email.trim() || undefined,
                status: newCustomerForm.status,
                gender: newCustomerForm.gender || undefined,
                preferred_branch_id: newCustomerForm.preferred_branch_id ? Number(newCustomerForm.preferred_branch_id) : (selectedBranchId || undefined),
                designation: newCustomerForm.designation.trim() || undefined,
                organization: newCustomerForm.organization.trim() || undefined,
                city: newCustomerForm.city.trim() || undefined,
                country: newCustomerForm.country.trim() || undefined,
                address_line_1: newCustomerForm.address_line_1.trim() || undefined,
                notes: newCustomerForm.notes.trim() || undefined,
                allow_credit: newCustomerForm.allow_credit,
                credit_limit: newCustomerForm.allow_credit ? Number(newCustomerForm.credit_limit || 0) : 0,
                marketing_opt_in: newCustomerForm.marketing_opt_in,
            }) as any;
            setAllCustomers((current) => [customer, ...current]);
            setSelectedCustomer(customer);
            setCustomerSearchTerm('');
            setCustomerSearchFilters(emptyCustomerSearchFilters);
            setIsCustomerCreateModalOpen(false);
            if (customerModalIntent === 'credit') {
                setIsCreditCustomerModalOpen(true);
            }
            setNewCustomerForm(emptyPosCustomerForm(selectedBranchId));
            toast.success('Customer Added', `${customer.name} is now available in POS.`);
        } catch (error: any) {
            toast.error('Customer Save Failed', error?.message || 'Could not save the new customer.');
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    const openCustomerSearchModal = (intent: 'general' | 'credit' = 'general') => {
        setCustomerSearchTerm('');
        setCustomerSearchFilters(emptyCustomerSearchFilters);
        setCustomerModalIntent(intent);
        setIsCreditCustomerModalOpen(false);
        setIsCustomerSearchModalOpen(true);
    };

    const openCustomerCreateModal = () => {
        setNewCustomerForm(emptyPosCustomerForm(selectedBranchId));
        setIsCreditCustomerModalOpen(false);
        setIsCustomerSearchModalOpen(false);
        setIsCustomerCreateModalOpen(true);
    };

    const applyVoucherCode = async () => {
        if (!voucherCode.trim()) return toast.error('Voucher Required', 'Enter a voucher code first.');
        if (!selectedBranchId) return toast.error('Branch Required', 'Select a branch before validating vouchers.');
        try {
            const result = await dealsApi.validateVoucher({ code: voucherCode.trim().toUpperCase(), branch_id: selectedBranchId, customer_id: selectedCustomer?.id || undefined, order_total: Math.max(subtotal - manualDiscount, 0), order_type: orderMode });
            setDiscountAmount('0');
            setDiscountType('fixed');
            setDiscountApproval(null);
            setAppliedVoucher(result);
            setVoucherCode(result.code);
            setIsVoucherModalOpen(false);
            toast.success('Voucher Applied', `${result.code} is eligible for this order.`);
        } catch (error: any) {
            setAppliedVoucher(null);
            toast.error('Voucher Rejected', error?.message || 'Voucher rules rejected this order.');
        }
    };

    const clearCurrentOrder = () => {
        setCart([]);
        setSelectedTableId(null);
        setOrderNote('');
        setDiscountAmount('0');
        setDiscountType('fixed');
        setDiscountApproval(null);
        setVoucherCode('');
        setAppliedVoucher(null);
        setCustomerSearchTerm('');
        setSelectedCustomer(null);
        setSelectedOrderTakerId(null);
        setDeliveryOrderForm(emptyDeliveryOrderForm());
        setSplitCashAmount('');
        setPaymentReference('');
        setCashReceivedAmount('');
        setIsServiceChargeManual(false);
        setServiceChargeInput('0.00');
        setActiveOrderId(null);
        setActiveOrderNumber(null);
        setActiveOrderStatus(null);
        setActiveOrderPlacedAt(null);
        setLoadedOrderSnapshot(null);
    };

    const discardLoadedOrderChanges = () => {
        if (!loadedOrderSnapshot) return;
        hydrateOrderIntoCart(loadedOrderSnapshot, { silent: true, closeModal: false });
        toast.success('Changes Discarded', `Order #${formatToastDisplayNumber(loadedOrderSnapshot.order_number || loadedOrderSnapshot.id)} was restored from the last saved state.`);
    };

    const openOrdersModal = (title: string, filter: OrdersModalFilter, options?: { preserveSearch?: boolean }) => {
        if (!options?.preserveSearch) {
            setSubmittedSearchOrderNo('');
            setAppliedOrderSearchFilters(emptyAdvancedOrderSearchFilters);
        }
        setOrdersModalTitle(title);
        setOrdersModalFilter(filter);
        setIsOrdersOpen(true);
        if (filter === 'kitchen' && selectedBranchId) {
            void refreshKitchenOrders();
        }
    };

    const applyAdvancedOrderSearch = useCallback(() => {
        setAppliedOrderSearchFilters(orderSearchFilters);
        openOrdersModal('Order Search Results', 'recent', { preserveSearch: true });
    }, [openOrdersModal, orderSearchFilters]);

    const resetAdvancedOrderSearch = useCallback(() => {
        setSearchOrderNo('');
        setSubmittedSearchOrderNo('');
        setOrderSearchFilters(emptyAdvancedOrderSearchFilters);
        setAppliedOrderSearchFilters(emptyAdvancedOrderSearchFilters);
        setShowAdvancedOrderFilters(false);
    }, []);

    const submitOrderSearch = useCallback(() => {
        const token = searchOrderNo.trim();
        setSubmittedSearchOrderNo(token);
        if (token || hasAdvancedOrderSearchFilters(orderSearchFilters)) {
            setAppliedOrderSearchFilters(orderSearchFilters);
            openOrdersModal('Order Search Results', 'recent', { preserveSearch: true });
        }
    }, [openOrdersModal, orderSearchFilters, searchOrderNo]);

    useEffect(() => {
        if (!isOrdersOpen || ordersModalFilter !== 'kitchen' || !selectedBranchId) return;
        const timer = window.setInterval(() => {
            void refreshKitchenOrders();
        }, 10000);
        return () => window.clearInterval(timer);
    }, [isOrdersOpen, ordersModalFilter, refreshKitchenOrders, selectedBranchId]);

    const startResizing = useCallback((mouseDownEvent: ReactMouseEvent) => {
        if (isCartLocked) return;
        const startWidth = cartWidth;
        const startPosition = mouseDownEvent.clientX;
        const onMouseMove = (mouseMoveEvent: MouseEvent) => {
            const delta = startPosition - mouseMoveEvent.clientX;
            const nextWidth = Math.min(Math.max(startWidth + delta, 340), 760);
            setCartWidth(nextWidth);
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [cartWidth, isCartLocked]);

    const handleManualSync = async () => {
        if (!selectedBranchId) return;
        try {
            setIsSyncingMenu(true);
            await loadTerminalState(selectedBranchId, orderMode, { showLoader: false });
            toast.success('Menu Synced', 'Live menu and terminal data were refreshed.');
        } catch {
            // loadTerminalState already toasts
        } finally {
            setIsSyncingMenu(false);
        }
    };

    const saveExpenseVoucher = async () => {
        if (!canOpenCashierExpense) {
            toast.error('Expense Entry Restricted', 'Your branch role cannot record cashier expenses from the terminal.');
            return;
        }
        if (!ensureCanOperateTerminal('record expenses')) return;
        if (!selectedBranchId) return toast.error('Branch Required', 'Select a branch before adding an expense.');
        if (!expenseAccountId) return toast.error('Expense Account', 'Select an expense account.');
        if (toMoney(expenseAmount) <= 0) return toast.error('Expense Amount', 'Enter a valid expense amount.');
        setIsExpenseSubmitting(true);
        try {
            const voucher = await accountingApi.createFinancialVoucher({
                type: 'EXPENSE',
                party_type: 'OTHER',
                amount: toMoney(expenseAmount),
                date: new Date().toISOString().split('T')[0],
                payment_method: expensePaymentMethod,
                reference_no: expenseReference.trim() || undefined,
                description: expenseDescription.trim() || undefined,
                branch_id: selectedBranchId,
                expense_account_id: Number(expenseAccountId),
            }) as any;
            toast.success('Expense Submitted', `Expense voucher ${formatConfiguredExpenseVoucherNumber(voucher.voucher_no || `#${voucher.id}`, branchDetail || voucher, { preserveTypePrefix: true }) || voucher.voucher_no || `#${voucher.id}`} was submitted for approval.`);
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseReference('');
            setExpensePaymentMethod('Cash');
            setIsExpenseModalOpen(false);
        } catch (error: any) {
            toast.error('Expense Save Failed', error?.message || 'Could not record the expense.');
        } finally {
            setIsExpenseSubmitting(false);
        }
    };

    const openSalesReturnModal = () => {
        const firstEligibleOrder = returnableOrders[0];
        if (!firstEligibleOrder) {
            toast.error('Sales Return', 'No completed paid orders are available for return.');
            return;
        }
        const firstPaymentMode = paymentModeFromMethodCode(
            firstEligibleOrder.payments?.find((payment: any) => !payment.is_refund)?.payment_mode,
        );
        setSalesReturnSearch('');
        setSalesReturnOrderId(firstEligibleOrder.id);
        setSalesReturnPaymentMode(resolveDefaultRefundPaymentMode(firstPaymentMode));
        setSalesReturnReference('');
       setSalesReturnNote('');
        setSalesReturnRestock(true);
        setSalesReturnQuantities({});
        if (salesReturnApprovalUsernameRef.current) salesReturnApprovalUsernameRef.current.value = '';
        if (salesReturnApprovalPinRef.current) salesReturnApprovalPinRef.current.value = '';
        setIsSalesReturnOpen(true);
    };

    const submitSalesReturn = async () => {
        if (!canProcessSalesReturn) {
            toast.error('Sales Return Restricted', 'Your branch role cannot process sales returns from the terminal.');
            return;
        }
        const approvalUsername = salesReturnApprovalUsernameRef.current?.value?.trim() || '';
        const approvalPin = salesReturnApprovalPinRef.current?.value?.trim() || '';
        if (!selectedBranchId) return toast.error('Branch Required', 'Select a branch before returning a sale.');
        if (!salesReturnOrderId) return toast.error('Sales Return', 'Choose an order to return.');
        if (!approvalUsername || !approvalPin) {
            return toast.error('Sales Return', 'Authorized user ID and PIN are required.');
        }
        const returnItems = selectedReturnLines
            .filter((item: SalesReturnLine) => item.requestedQuantity > 0)
            .map((item: SalesReturnLine) => ({ order_item_id: item.id, quantity: item.requestedQuantity }));
        if (returnItems.length === 0) return toast.error('Sales Return', 'Select at least one item quantity to return.');
        setIsSalesReturnSubmitting(true);
        try {
            const returnedOrder = await posApi.returnOrder(salesReturnOrderId, {
                branch_id: selectedBranchId,
                payment_mode: salesReturnPaymentMode,
                reference_number: salesReturnReference.trim() || undefined,
                items: returnItems,
                return_note: salesReturnNote.trim() || undefined,
                restock_inventory: salesReturnRestock,
                approval_username: approvalUsername,
                approval_pin: approvalPin,
            }) as any;
            setIsSalesReturnOpen(false);
            setSalesReturnQuantities({});
            if (salesReturnApprovalUsernameRef.current) salesReturnApprovalUsernameRef.current.value = '';
            if (salesReturnApprovalPinRef.current) salesReturnApprovalPinRef.current.value = '';
            setReceiptOrder({
                ...returnedOrder,
                latest_return: returnedOrder?.latest_return
                    ? { ...returnedOrder.latest_return, authorized_by: approvalUsername }
                    : returnedOrder?.latest_return,
            });
            toast.success('Sales Returned', `Order #${formatToastDisplayNumber(returnedOrder.order_number || returnedOrder.id)} was returned successfully.`);
            await refreshPosState(selectedBranchId);
        } catch (error: any) {
            toast.error('Sales Return Failed', error?.message || 'Could not process the sales return.');
        } finally {
            setIsSalesReturnSubmitting(false);
        }
    };

    const ensureOrderContext = (options?: {
        requirePayment?: boolean;
        requireCustomer?: boolean;
        requireOrderTaker?: boolean;
        promptCustomerSelection?: boolean;
        requireTable?: boolean;
    }) => {
        if (!selectedBranchId) return toast.error('Branch Required', 'Select a live branch before processing POS orders.'), false;
        if (!currentCounterSession || !activeTill || activeTill.branch_id !== selectedBranchId) {
            return toast.error('Counter Session Required', 'You need an assigned counter session before processing POS orders.'), false;
        }
        if (!openingCashConfirmed || String(currentCounterSession.terminal_status || '').toLowerCase() !== 'active') {
            return toast.error('Counter Not Open', 'Verify the opening cash and open your assigned counter before processing POS orders.'), false;
        }
        if ((options?.requireTable ?? orderMode === 'dine_in') && !selectedTableId) return toast.error('Table Required', 'Choose a table for dine-in orders.'), false;
        if (needsDiscountApproval) return toast.error('Approval Required', 'An authorized user must approve this discount before the order can continue.'), false;
        if (options?.requireCustomer && !selectedCustomer) return toast.error('Customer Required', 'Credit orders must be attached to a customer.'), false;
        if (!selectedOrderTakerId) return toast.error('Server / Cashier Required', 'Select the server / cashier before processing this order.'), false;
        if (orderMode === 'delivery') {
            if (!deliveryOrderForm.delivery_person_user_id) return toast.error('Delivery Person Required', 'Assign a delivery person for this delivery order.'), false;
            if (!selectedCustomer?.id) {
                if (!deliveryOrderForm.contact_person.trim()) return toast.error('Contact Person Required', 'Enter the delivery contact person.'), false;
                if (!deliveryOrderForm.phone_number.trim()) return toast.error('Phone Number Required', 'Enter the delivery phone number.'), false;
                if (!deliveryOrderForm.address.trim()) return toast.error('Address Required', 'Enter the delivery address.'), false;
                if (!deliveryOrderForm.city.trim()) return toast.error('City Required', 'Enter the city for this delivery.'), false;
            }
        }
        if (options?.promptCustomerSelection && !selectedCustomer) {
            toast.info('Customer Optional', 'Select a customer for this credit order if available. The order can still continue as walk-in.');
        }
        if (options?.requirePayment) {
            if (paymentMode === 'cash' && !cashReceivedAmount.trim()) return toast.error('Cash Received', 'Enter the cash received amount.'), false;
            if (paymentMode === 'cash' && cashReceived + 0.01 < total) return toast.error('Cash Short', 'Cash received cannot be less than the net payable amount.'), false;
            if (paymentMode === 'split' && !splitCashAmount.trim()) return toast.error('Split Payment', 'Enter the cash portion for split payment.'), false;
            if (paymentMode === 'split' && splitCash > total + 0.01) return toast.error('Split Payment', 'Cash portion cannot exceed the final order total.'), false;
            if (isOnlinePayment && !onlinePaymentDetails.sender_name.trim()) return toast.error('Online Payment', 'Enter the sender name.'), false;
            if (isOnlinePayment && !onlinePaymentDetails.source_bank.trim()) return toast.error('Online Payment', 'Enter the source bank.'), false;
            if (isOnlinePayment && !onlinePaymentDetails.destination_bank.trim()) return toast.error('Online Payment', 'Enter the destination bank.'), false;
            if (isOnlinePayment && !onlinePaymentDetails.transaction_no.trim()) return toast.error('Online Payment', 'Enter the transaction number.'), false;
            if (isCardPayment && !selectedCardMachine) return toast.error('Card Payment', 'Select a registered POS machine.'), false;
        }
        return true;
    };

    function buildDeliveryDetailsPayload() {
        if (orderMode !== 'delivery') return undefined;
        return {
            contact_person: selectedCustomer?.id ? undefined : (deliveryOrderForm.contact_person.trim() || undefined),
            phone_number: selectedCustomer?.id ? undefined : (deliveryOrderForm.phone_number.trim() || undefined),
            address: selectedCustomer?.id ? undefined : (deliveryOrderForm.address.trim() || undefined),
            house_apartment: selectedCustomer?.id ? undefined : (deliveryOrderForm.house_apartment.trim() || undefined),
            street_no: selectedCustomer?.id ? undefined : (deliveryOrderForm.street_no.trim() || undefined),
            area_sector: selectedCustomer?.id ? undefined : (deliveryOrderForm.area_sector.trim() || undefined),
            locality: selectedCustomer?.id ? undefined : (deliveryOrderForm.locality.trim() || undefined),
            city: selectedCustomer?.id ? undefined : (deliveryOrderForm.city.trim() || undefined),
            ask_for: selectedCustomer?.id ? undefined : (deliveryOrderForm.ask_for.trim() || undefined),
            delivery_person_user_id: deliveryOrderForm.delivery_person_user_id ? Number(deliveryOrderForm.delivery_person_user_id) : undefined,
            delivery_person_name: deliveryOrderForm.delivery_person_name.trim() || selectedDeliveryAgent?.full_name || selectedDeliveryAgent?.user_name || undefined,
            payment_term: deliveryOrderForm.payment_term,
            delivery_status: deliveryOrderForm.delivery_status,
            comment: deliveryOrderForm.comment.trim() || undefined,
        };
    }

    const buildOrderPayload = (orderStatus: 'pending' | 'held', paymentStatus: 'unpaid' | 'paid' | 'partial' | 'credited' = 'unpaid') => ({
        order_type: orderMode,
        order_status: orderStatus,
        payment_status: paymentStatus,
        table_id: orderMode === 'dine_in' ? selectedTableId ?? undefined : undefined,
        sale_counter_id: activeTill?.sale_counter_id || activeTill?.id,
        order_note: orderNote.trim() || undefined,
        discount_amount: manualDiscount || undefined,
        customer_id: selectedCustomer?.id,
        order_taker_user_id: selectedOrderTakerId || undefined,
        delivery_details: buildDeliveryDetailsPayload(),
        items: effectiveCart.map((item) => ({
            product_id: resolveCartProductId(item),
            product_name: item.name,
            quantity: item.quantity,
            item_price: Number(item.price || 0),
            notes: item.note || undefined,
        })),
    });

    const requiresPendingLateLineItemOverride = () => {
        if (!activeOrderId || !loadedOrderSnapshot || loadedOrderIsHeld) return false;
        const overrideReady = Boolean(
            lineOverrideReason.trim()
            && lineOverrideApprovalUsername.trim()
            && lineOverrideApprovalPin.trim(),
        );
        if (overrideReady) return false;

        const limitMinutes = resolveConfigNumber(branchDetail, [
            'line_item_cancel_reduce_limit_minutes',
            'item_cancellation_window_minutes',
            'item_edit_lock_minutes',
            'pos_item_cancellation_window_minutes',
            'cancellation_window_minutes',
        ]) || 5;
        if (limitMinutes <= 0) return false;

        const now = Date.now();
        const snapshotItems = (Array.isArray(loadedOrderSnapshot.items) ? loadedOrderSnapshot.items : []).filter(
            (item: any) => item && String(item?.item_status || '').toLowerCase() !== 'voided',
        );
        const cartByOrderItemId = new Map<number, CartItem>(
            cart
                .filter((item) => item.orderItemId)
                .map((item) => [Number(item.orderItemId), item]),
        );

        return snapshotItems.some((original: any) => {
            const originalId = Number(original.id || 0);
            if (!originalId) return false;

            const createdAtMs = new Date(
                original.kitchen_sent_at
                || original.sent_to_kitchen_at
                || original.created_at
                || loadedOrderSnapshot.created_at
                || 0,
            ).getTime();
            if (!Number.isFinite(createdAtMs)) return false;
            if ((now - createdAtMs) < limitMinutes * 60 * 1000) return false;

            const cartLine = cartByOrderItemId.get(originalId);
            const originalQuantity = Number(original.quantity || 0);
            const nextQuantity = !cartLine || cartLine.isDeleted ? 0 : Number(cartLine.quantity || 0);
            return nextQuantity < originalQuantity;
        });
    };

    const syncExistingOrderDraft = async () => {
        if (!activeOrderId || !loadedOrderSnapshot) return null;
        const orderBranchId = selectedBranchId
            ?? (loadedOrderSnapshot?.branch_id ? Number(loadedOrderSnapshot.branch_id) : null)
            ?? (loadedOrderSnapshot?.branch?.id ? Number(loadedOrderSnapshot.branch.id) : null);
        const lineOverridePayload = lineOverrideReason.trim() && lineOverrideApprovalUsername.trim() && lineOverrideApprovalPin.trim()
            ? {
                branch_id: orderBranchId,
                adjustment_reason: lineOverrideReason.trim(),
                approval_username: lineOverrideApprovalUsername.trim(),
                approval_pin: lineOverrideApprovalPin.trim(),
            }
            : undefined;

        const snapshotItems = (Array.isArray(loadedOrderSnapshot.items) ? loadedOrderSnapshot.items : []).filter((item: any) => item && String(item?.item_status || '').toLowerCase() !== 'voided');
        const snapshotById = new Map<number, any>(snapshotItems.map((item: any) => [Number(item.id), item]));

        const currentDelivery = buildDeliveryDetailsPayload();
        const snapshotDelivery = loadedOrderSnapshot.delivery_details || undefined;
        const headerChanged =
            normalizeOrderMode(loadedOrderSnapshot.order_type) !== orderMode
            || Number(selectedCustomer?.id || 0) !== Number(loadedOrderSnapshot.customer_id || 0)
            || Number(selectedOrderTakerId || 0) !== Number(loadedOrderSnapshot.order_taker_id || 0)
            || String(orderNote || '') !== String(loadedOrderSnapshot.order_note || '')
            || JSON.stringify(normalizeDeliveryOrderForm(snapshotDelivery)) !== JSON.stringify(normalizeDeliveryOrderForm(currentDelivery));

        if (headerChanged) {
            await posApi.updateOrderHeader(activeOrderId, {
                branch_id: orderBranchId,
                order_type: orderMode,
                table_id: orderMode === 'dine_in' ? selectedTableId || undefined : undefined,
                customer_id: selectedCustomer?.id || undefined,
                order_taker_user_id: selectedOrderTakerId || undefined,
                order_note: orderNote.trim() || undefined,
                delivery_details: currentDelivery,
            });
        }

        for (const item of cart) {
            if (!item.orderItemId) continue;
            const original = snapshotById.get(Number(item.orderItemId));
            if (!original) continue;

            const originalQuantity = Number(original.quantity || 0);
            const currentQuantity = item.isDeleted ? 0 : Number(item.quantity || 0);
            const originalPrice = Number(original.item_price || 0);
            const currentPrice = Number(item.price || 0);
            const originalNote = String(original.item_notes || '');
            const currentNote = String(item.note || '');

            if (currentQuantity <= 0) {
                if (loadedOrderIsHeld) {
                    await posApi.removeItem(activeOrderId, item.orderItemId, lineOverridePayload ?? { branch_id: orderBranchId });
                } else {
                    await posApi.updateOrderItemStatus(item.orderItemId, 'voided', orderBranchId ?? undefined, lineOverridePayload);
                }
                continue;
            }

            if (currentQuantity !== originalQuantity) {
                await posApi.updateItem(activeOrderId, item.orderItemId, {
                    branch_id: orderBranchId,
                    quantity: currentQuantity,
                    item_price: currentPrice,
                    notes: currentNote,
                    ...lineOverridePayload,
                });
                continue;
            }

            if (currentNote !== originalNote || Math.abs(currentPrice - originalPrice) > 0.0001) {
                await posApi.updateItem(activeOrderId, item.orderItemId, {
                    branch_id: orderBranchId,
                    item_price: currentPrice,
                    notes: currentNote,
                });
            }
        }

        const newLines = cart.filter((item) => !item.orderItemId && !item.isDeleted && item.quantity > 0);
        if (newLines.length > 0) {
            await posApi.addItems(activeOrderId, newLines.map((item) => ({
                product_id: resolveCartProductId(item),
                product_name: item.name,
                quantity: item.quantity,
                item_price: Number(item.price || 0),
                notes: item.note || undefined,
            })), orderBranchId);
        }

        return posApi.getOrder(activeOrderId, orderBranchId);
    };

    const buildCheckoutPayload = () => {
        const commonPayload = {
            branch_id: selectedBranchId!,
            customer_id: selectedCustomer?.id,
            order_taker_user_id: selectedOrderTakerId || undefined,
            delivery_details: buildDeliveryDetailsPayload(),
            discount_amount: manualDiscount || undefined,
            voucher_code: voucherCodeToUse || undefined,
            service_charge_amount: isServiceChargeManual ? manualServiceChargeAmount : undefined,
            tax_amount: !isTaxDisabled ? taxAmount : undefined,
            skip_tax: isTaxDisabled,
            tax_code: !isTaxDisabled && selectedTaxProfile?.tax_code ? selectedTaxProfile.tax_code : undefined,
        };

        const paymentDetails = isOnlinePayment
            ? {
                sender_name: onlinePaymentDetails.sender_name.trim(),
                source_bank: onlinePaymentDetails.source_bank.trim(),
                destination_bank: onlinePaymentDetails.destination_bank.trim(),
                transaction_no: onlinePaymentDetails.transaction_no.trim(),
            }
            : isCardPayment && selectedCardMachine
                ? {
                    card_machine_id: selectedCardMachine.id,
                    machine_name: selectedCardMachine.machine_name,
                    service_provider: selectedCardMachine.service_provider,
                    pid_number: selectedCardMachine.pid_number,
                    mid_number: selectedCardMachine.mid_number,
                }
                : null;

        if (paymentMode === 'split') {
            return {
                ...commonPayload,
                payments: [
                    ...(previewPayments[0]?.amount > 0 ? [{ payment_mode: 'cash', amount: Number(previewPayments[0].amount.toFixed(2)) }] : []),
                    ...(previewPayments[1]?.amount > 0 ? [{
                        payment_mode: previewPayments[1].payment_mode,
                        amount: Number(previewPayments[1].amount.toFixed(2)),
                        reference_number: paymentReference.trim() || undefined,
                    }] : []),
                ],
            };
        }

        return {
            ...commonPayload,
            payment_mode: paymentMode,
            reference_number:
                paymentMode === 'cash'
                    ? undefined
                    : isOnlinePayment
                        ? onlinePaymentDetails.transaction_no.trim() || undefined
                        : paymentReference.trim() || undefined,
            payments: [{
                payment_mode: paymentMode as ChargePaymentMode,
                amount: total,
                reference_number:
                    paymentMode === 'cash'
                        ? undefined
                        : isOnlinePayment
                            ? onlinePaymentDetails.transaction_no.trim() || undefined
                            : paymentReference.trim() || undefined,
                payment_details: paymentDetails || undefined,
            }],
        };
    };

    const buildCreditSalePayload = () => ({
        branch_id: selectedBranchId!,
        customer_id: selectedCustomer?.id,
        order_taker_user_id: selectedOrderTakerId || undefined,
        delivery_details: buildDeliveryDetailsPayload(),
        discount_amount: manualDiscount || undefined,
        voucher_code: voucherCodeToUse || undefined,
        service_charge_amount: isServiceChargeManual ? manualServiceChargeAmount : undefined,
        tax_amount: !isTaxDisabled ? taxAmount : undefined,
        skip_tax: isTaxDisabled,
        tax_code: !isTaxDisabled && selectedTaxProfile?.tax_code ? selectedTaxProfile.tax_code : undefined,
    });

    const requiresLineItemOverride = (error: any) =>
        String(error?.message || '').toLowerCase().includes('authorized user approval is required to void or reduce this line after');

    const sendToKitchen = async () => {
        if (!ensureCanOperateTerminal('send orders to the kitchen')) return;
        if (effectiveCart.length === 0 || !ensureOrderContext()) return;
        if (requiresPendingLateLineItemOverride()) {
            setIsLineOverrideOpen(true);
            toast.error('Authorized Approval Required', 'An authorized user must approve this late line-item adjustment before changes are sent to KDS.');
            return;
        }
        setIsSubmitting(true);
        try {
            const printUsername = userContext?.user_name || userContext?.username || user?.user_name || user?.full_name || null;
            if (activeOrderId) {
                const orderNoteChanged = String(orderNote || '').trim() !== String(loadedOrderSnapshot?.order_note || '').trim();
                const changePrintData = hasDraftChanges
                    && (hasKitchenDraftChanges || orderNoteChanged)
                    ? buildKotChangePayload({
                        cart,
                        loadedOrderSnapshot,
                        activeOrderNumber,
                        orderNote,
                        username: printUsername,
                    })
                    : null;
                const refreshedDraftOrder = hasDraftChanges ? await syncExistingOrderDraft() as any : null;
                const shouldSubmitKitchenUpdate = Boolean(refreshedDraftOrder && (hasKitchenDraftChanges || orderNoteChanged));
                if (activeOrderStatus === 'held') {
                    const order = await posApi.updateOrderStatus(activeOrderId, 'pending', selectedBranchId) as any;
                    notifyKdsDispatch(selectedBranchId, order?.id || activeOrderId);
                    if (settings.kot_print_enabled !== false) {
                        const jobs = buildFullKotPrintJobs(buildKotPrintPayload({
                            cart,
                            order,
                            orderMode,
                            selectedTableId,
                            branchTables,
                            orderNote,
                            username: printUsername,
                        }));
                        queueKotPrintJobs(jobs, 'Allow pop-ups for this app to print the KOT.', KDS_DISPATCH_PRINT_DEFER_MS);
                    }
                    toast.success(
                        'Sent to Kitchen',
                        `Order #${formatToastDisplayNumber(order.order_number || order.id)} is now pending on the live KDS.\nKOT #${formatToastKotNumber(order, '-')}.`,
                    );
                    clearCurrentOrder();
                    await refreshPosState(selectedBranchId!);
                    return;
                }
                if (shouldSubmitKitchenUpdate) {
                    const refreshedOrder = await posApi.submitOrderToKitchen(activeOrderId, selectedBranchId) as any;
                    notifyKdsDispatch(selectedBranchId, refreshedOrder?.id || activeOrderId);
                    if (changePrintData && settings.kot_print_enabled !== false) {
                        const jobs = buildChangeKotPrintJobs({
                            ...changePrintData,
                            kot_version:
                                formatConfiguredKotNumber(
                                    resolveKotDisplayNumber(refreshedOrder || loadedOrderSnapshot, String(changePrintData.kot_version || '-')),
                                    refreshedOrder || loadedOrderSnapshot,
                                    { preserveTypePrefix: true },
                                ) || resolveKotDisplayNumber(refreshedOrder || loadedOrderSnapshot, String(changePrintData.kot_version || '-')),
                            order_no: formatVisibleOrderNumber(refreshedOrder?.order_number || changePrintData.order_no),
                            datetime: refreshedOrder?.updated_at || changePrintData.datetime,
                            notes: orderNote?.trim() || refreshedOrder?.order_note || changePrintData.notes,
                            print_id: refreshedOrder?.id || changePrintData.print_id,
                        });
                        queueKotPrintJobs(jobs, 'Allow pop-ups for this app to print the change-only KOT.', KDS_DISPATCH_PRINT_DEFER_MS);
                    }
                    if (changePrintData && ((changePrintData.cancel_items?.length || 0) > 0 || (changePrintData.modify_items?.length || 0) > 0)) {
                        const lineItemVoidReceiptItems = [
                            ...(changePrintData.cancel_items || []).map((item: any) => ({
                                name: item.name,
                                action: 'void' as const,
                                old_qty: Number(item.qty || 0),
                                new_qty: 0,
                                void_qty: Number(item.qty || 0),
                                station: item.station || null,
                            })),
                            ...(changePrintData.modify_items || []).map((item: any) => {
                                const oldQty = Number(item.old_qty || 0);
                                const newQty = Number(item.new_qty || 0);
                                return {
                                    name: item.name,
                                    action: 'reduced' as const,
                                    old_qty: oldQty,
                                    new_qty: newQty,
                                    void_qty: Math.max(oldQty - newQty, 0),
                                    station: item.station || null,
                                };
                            }).filter((item: any) => item.void_qty > 0),
                        ];

                        if (lineItemVoidReceiptItems.length > 0) {
                            const documentMarkup = buildLineItemVoidReceiptPrintDocument({
                                settings,
                                format: settings.receipt_paper_size || 'thermal-80mm',
                                data: {
                                    order_no: formatVisibleOrderNumber(refreshedOrder?.order_number || changePrintData.order_no),
                                    datetime: refreshedOrder?.updated_at || changePrintData.datetime || new Date(),
                                    cashier: refreshedOrder?.order_taker_employee_id || refreshedOrder?.order_taker_id || refreshedOrder?.order_taker_username || '',
                                    server: refreshedOrder?.served_by_name || refreshedOrder?.server_name || refreshedOrder?.order_taker_name || refreshedOrder?.order_taker_username || '',
                                    order_type: orderModeMeta[normalizeOrderMode(refreshedOrder?.order_type)] || orderModeMeta[orderMode],
                                    table: refreshedOrder?.table_number || refreshedOrder?.table_name || null,
                                    items: lineItemVoidReceiptItems,
                                    reason: lineOverrideReason.trim() || undefined,
                                    authorized_by: lineOverrideApprovalUsername.trim() || undefined,
                                    printed_at: new Date(),
                                    print_id: `${refreshedOrder?.id || changePrintData.print_id || 'line-void'}-void`,
                                },
                            });

                            window.setTimeout(() => {
                                if (!openPrintDocumentCopies(() => documentMarkup, settings.receipt_print_copies || 1, `Line Item Void ${refreshedOrder?.order_number || changePrintData.order_no}`)) {
                                    toast.error('Print Blocked', 'Allow pop-ups for this app to print the line item void receipt.');
                                }
                            }, KDS_DISPATCH_PRINT_DEFER_MS);
                        }
                    }
                    toast.success(
                        'Changes Sent',
                        `Order #${formatToastDisplayNumber(refreshedOrder.order_number || activeOrderNumber || activeOrderId)} was updated and pushed to KDS.\nKOT #${formatToastKotNumber(refreshedOrder || loadedOrderSnapshot, '-')}.`,
                    );
                    setIsLineOverrideOpen(false);
                    setLineOverrideReason('');
                    setLineOverrideApprovalUsername('');
                    setLineOverrideApprovalPin('');
                } else if (refreshedDraftOrder) {
                    toast.success(
                        'Order Updated',
                        `Order #${formatToastDisplayNumber(refreshedDraftOrder.order_number || activeOrderNumber || activeOrderId)} was updated without changing KOT #${formatToastKotNumber(refreshedDraftOrder || loadedOrderSnapshot, '-')}.`,
                    );
                } else {
                    toast.success(
                        'Order Already Live',
                        `Order #${formatToastDisplayNumber(activeOrderNumber || activeOrderId)} is already in progress.\nKOT #${formatToastKotNumber(loadedOrderSnapshot, '-')}.`,
                    );
                }
                clearCurrentOrder();
                await refreshPosState(selectedBranchId!);
                return;
            }
            const cartSnapshot = cart;
            const selectedTableIdSnapshot = selectedTableId;
            const orderNoteSnapshot = orderNote;
            const order = await posApi.createOrder(selectedBranchId!, buildOrderPayload('pending')) as any;
            notifyKdsDispatch(selectedBranchId, order?.id);
            clearCurrentOrder();
            if (settings.kot_print_enabled !== false) {
                const jobs = buildFullKotPrintJobs(buildKotPrintPayload({
                    cart: cartSnapshot,
                    order,
                    orderMode,
                    selectedTableId: selectedTableIdSnapshot,
                    branchTables,
                    orderNote: orderNoteSnapshot,
                    username: printUsername,
                }));
                queueKotPrintJobs(jobs, 'Allow pop-ups for this app to print the KOT.', KDS_DISPATCH_PRINT_DEFER_MS);
            }
            toast.success(
                'Sent to Kitchen',
                `Order #${formatToastDisplayNumber(order.order_number || order.id)} is now pending on the live KDS.\nKOT #${formatToastKotNumber(order, '-')}.`,
            );
            await refreshPosState(selectedBranchId!);
        } catch (error: any) {
            if (requiresLineItemOverride(error)) {
                setIsLineOverrideOpen(true);
                toast.error('Authorized Approval Required', error?.message || 'An authorized user must approve this late line-item adjustment.');
            } else {
                toast.error('POS Action Failed', error?.message || 'Could not persist the current order.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const payNow = async (existingOrderId?: number, existingOrderNumber?: string | null) => {
        if (!ensureCanOperateTerminal('take payment')) return;
        if ((!existingOrderId && effectiveCart.length === 0) || !ensureOrderContext({ requirePayment: true, requireTable: !existingOrderId && orderMode === 'dine_in' })) return;
        if (existingOrderId && hasDraftChanges) {
            toast.error('Unsaved Changes', 'Send to Kitchen or discard changes before taking payment for this order.');
            return;
        }
        setIsSubmitting(true);
        try {
            const printUsername = userContext?.user_name || userContext?.username || user?.user_name || user?.full_name || null;
            if (existingOrderId && existingOrderNumber) setActiveOrderNumber(existingOrderNumber);
            const checkoutPayload = buildCheckoutPayload();
            const paymentCashReceived = paymentMode === 'cash' ? Number(cashReceivedAmount || 0) : 0;
            const printTaxProfile = selectedTaxProfile
                ? {
                    tax_name: selectedTaxProfile.tax_name,
                    tax_code: selectedTaxProfile.tax_code,
                    tax_registration_number: selectedTaxProfile.tax_registration_number,
                    tax_rate: selectedTaxProfile.tax_rate,
                    calculation_method: selectedTaxProfile.calculation_method,
                }
                : null;
            const cartSnapshot = cart;
            const selectedTableIdSnapshot = selectedTableId;
            const orderNoteSnapshot = orderNote;
            const createdOrder = existingOrderId ? null : await posApi.createOrder(selectedBranchId!, buildOrderPayload('pending')) as any;
            const orderId = existingOrderId || createdOrder.id;
            if (!existingOrderId && createdOrder?.order_number) setActiveOrderNumber(createdOrder.order_number);
            if (!existingOrderId && createdOrder) {
                notifyKdsDispatch(selectedBranchId, createdOrder.id);
                clearCurrentOrder();
            }
            if (!existingOrderId && createdOrder && settings.kot_print_enabled !== false) {
                const jobs = buildFullKotPrintJobs(buildKotPrintPayload({
                    cart: cartSnapshot,
                    order: createdOrder,
                    orderMode,
                    selectedTableId: selectedTableIdSnapshot,
                    branchTables,
                    orderNote: orderNoteSnapshot,
                    username: printUsername,
                }));
                queueKotPrintJobs(jobs, 'Allow pop-ups for this app to print the KOT.', KDS_DISPATCH_PRINT_DEFER_MS);
            }
            const receipt = await posApi.closeOrder(orderId, checkoutPayload) as any;
            notifyKdsDispatch(selectedBranchId, receipt?.id || orderId);
            setReceiptOrder({
                ...receipt,
                _printContext: {
                    cash_received: paymentCashReceived,
                    change_due: paymentMode === 'cash' ? Math.max(paymentCashReceived - Number(receipt?.total_amount || 0), 0) : 0,
                    tax_profile: printTaxProfile,
                },
            });
            toast.success('Order Completed', `Order #${formatToastDisplayNumber(receipt.order_number || orderId)} has been closed.`);
            clearCurrentOrder();
            await refreshPosState(selectedBranchId!);
        } catch (error: any) {
            console.error(error);
            toast.error('Checkout Failed', error?.message || 'Could not close the order.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitCancelOrder = async () => {
        if (!canCancelOrder) {
            toast.error('Void Restricted', 'Your branch role cannot void POS orders from the terminal.');
            return;
        }
        if (!activeOrderId || !selectedBranchId) return toast.error('Cancel Order', 'Load an in-progress order first.');
        if (!cancelOrderApprovalUsername.trim() || !cancelOrderApprovalPin.trim()) {
            return toast.error('Cancel Order', 'Authorized user ID and PIN are required.');
        }
        setIsCancelOrderSubmitting(true);
        try {
            const cancelledOrder = await posApi.cancelOrder(activeOrderId, {
                branch_id: selectedBranchId,
                approval_username: cancelOrderApprovalUsername.trim(),
                approval_pin: cancelOrderApprovalPin.trim(),
                cancel_reason: cancelOrderReason.trim() || undefined,
            }) as any;
            setIsCancelOrderOpen(false);
            setCancelOrderReason('');
            setCancelOrderApprovalUsername('');
            setCancelOrderApprovalPin('');
            setReceiptOrder({
                ...cancelledOrder,
                _printContext: {
                    is_void_receipt: true,
                    tax_profile: selectedTaxProfile
                        ? {
                            tax_name: selectedTaxProfile.tax_name,
                            tax_code: selectedTaxProfile.tax_code,
                            tax_registration_number: selectedTaxProfile.tax_registration_number,
                            tax_rate: selectedTaxProfile.tax_rate,
                            calculation_method: selectedTaxProfile.calculation_method,
                        }
                        : null,
                },
            });
            toast.success('Order Cancelled', `Order #${formatToastDisplayNumber(cancelledOrder.order_number || cancelledOrder.id)} was cancelled.`);
            clearCurrentOrder();
            await refreshPosState(selectedBranchId);
        } catch (error: any) {
            toast.error('Cancel Order Failed', error?.message || 'Could not cancel this order.');
        } finally {
            setIsCancelOrderSubmitting(false);
        }
    };

    const submitLineItemOverride = async () => {
        if (!lineOverrideReason.trim()) {
            toast.error('Line Override', 'A reason is required for late line-item void or reduction.');
            return;
        }
        if (!lineOverrideApprovalUsername.trim() || !lineOverrideApprovalPin.trim()) {
            toast.error('Line Override', 'Authorized user ID and PIN are required.');
            return;
        }
        setIsLineOverrideSubmitting(true);
        try {
            await sendToKitchen();
        } finally {
            setIsLineOverrideSubmitting(false);
        }
    };

    const orderNumberLabel = activeOrderNumber || (effectiveCart.length > 0 ? 'Draft / Unsaved' : 'New / Auto');
    const orderNumberCaption = activeOrderNumber ? 'Existing Order' : effectiveCart.length > 0 ? 'Draft Order' : 'New Order';
    const cartItemCount = effectiveCart.reduce((sum, item) => sum + item.quantity, 0);
    const activeOrderPlacedLabel = useMemo(() => {
        if (!activeOrderPlacedAt) return null;
        const placedAt = new Date(activeOrderPlacedAt);
        if (Number.isNaN(placedAt.getTime())) return null;
        return new Intl.DateTimeFormat('en-PK', {
            day: '2-digit',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
        }).format(placedAt);
    }, [activeOrderPlacedAt]);
    const activeOrderElapsedLabel = useMemo(() => {
        if (!activeOrderPlacedAt) return null;
        const placedAt = new Date(activeOrderPlacedAt).getTime();
        if (!Number.isFinite(placedAt)) return null;
        const diffMs = Math.max(currentDateTime.getTime() - placedAt, 0);
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${minutes}m elapsed` : `${minutes}m elapsed`;
    }, [activeOrderPlacedAt, currentDateTime]);
    const activeKotLabel = useMemo(() => {
        if (!activeOrderId && !loadedOrderSnapshot?.id) return '-';
        const matchingActiveOrder = allOrders.find((order: any) => Number(order?.id || 0) === Number(activeOrderId || 0));
        return formatVisibleKotNumber(loadedOrderSnapshot || matchingActiveOrder || { kot_version: null }, '-');
    }, [activeOrderId, allOrders, formatVisibleKotNumber, loadedOrderSnapshot]);
    const branchDeliveryCharge = resolveConfigNumber(branchDetail, ['delivery_charges', 'delivery_charge', 'delivery_fee', 'cod_delivery_charge']) || 0;
    const canDiscardChanges = loadedOrderIsExisting && hasDraftChanges && !isSubmitting;
    const hasSmartCartDraftContext = Boolean(
        activeOrderId
        || activeOrderNumber
        || loadedOrderSnapshot?.id
        || effectiveCart.length > 0
        || orderNote.trim()
        || selectedTableId
        || selectedCustomer?.id
        || selectedOrderTakerId
        || orderMode !== 'dine_in'
        || appliedVoucher
        || voucherCode.trim()
        || Number(discountAmount || 0) > 0
        || discountApproval
        || Object.values(deliveryOrderForm).some((value) => String(value ?? '').trim() !== '' && String(value ?? '').trim().toLowerCase() !== 'cod' && String(value ?? '').trim().toLowerCase() !== 'pending')
    );
    const canStartSmartNewOrder = hasSmartCartDraftContext && !isSubmitting;
    const canOpenSmartPreSale = effectiveCart.length > 0 && !isSubmitting && ready && canOperatePos;
    const canVoidActiveOrder = Boolean(
        canCancelOrder
        && activeOrderId
        && !isSubmitting
        && ready
        && canOperatePos
        && isInProgressOrder({ order_status: activeOrderStatus, payment_status: 'unpaid' })
    );
    const smartCartChips = [
        { label: 'Type', value: orderModeMeta[orderMode] },
        { label: 'Server', value: selectedOrderTaker?.full_name || selectedOrderTaker?.user_name || 'Unassigned' },
        { label: 'Table', value: orderMode === 'dine_in' ? (branchTables.find((table: any) => Number(table.id) === Number(selectedTableId || 0))?.table_number || 'Not set') : 'N/A' },
        { label: 'Customer', value: selectedCustomer?.name || 'Walk-in' },
    ].filter((chip) => Boolean(chip.value));
    const smartOrderNumberDisplay = activeOrderNumber || loadedOrderSnapshot?.order_number
        ? formatVisibleOrderNumber(activeOrderNumber || loadedOrderSnapshot?.order_number || activeOrderId || '-')
        : 'New Order';
    const smartKotDisplay = activeKotLabel && activeKotLabel.trim() && activeKotLabel !== '-' ? `KOT ${activeKotLabel}` : 'KOT -';
    const smartOrderPlacedDisplay = activeOrderPlacedLabel || new Intl.DateTimeFormat('en-PK', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    }).format(currentDateTime);
    const smartOrderElapsedClockDisplay = useMemo(() => {
        if (!activeOrderPlacedAt) return '00:00';
        const placedAt = new Date(activeOrderPlacedAt).getTime();
        if (!Number.isFinite(placedAt)) return '00:00';
        const totalSeconds = Math.max(Math.floor((currentDateTime.getTime() - placedAt) / 1000), 0);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, [activeOrderPlacedAt, currentDateTime]);
    const totalSmartDiscount = Number((effectiveManualDiscount + effectiveVoucherDiscount).toFixed(2));
    const smartTaxDisplay = selectedTaxRateLabel ? `(${selectedTaxRateLabel}) ${formatMoney(taxAmount)}` : formatMoney(taxAmount);
    const smartDiscountDisplay = totalSmartDiscount > 0 ? `(${formatMoney(totalSmartDiscount)})` : formatMoney(0);

    useEffect(() => {
        if (typeof document === 'undefined' || document.fullscreenElement) return;
        const element = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
        if (typeof element.requestFullscreen !== 'function') return;
        element.requestFullscreen().catch(() => undefined);
    }, []);

    const setSmartPaymentModeAndSync = (mode: SmartCartPaymentMode) => {
        if (smartCartPaymentMode === mode) return;
        setSmartCartPaymentMode(mode);
        if (mode === 'cash') setPaymentMode('cash');
        if (mode === 'credit_card') setPaymentMode('card');
        if (mode === 'eft') setPaymentMode('bank');
        if (mode === 'wallet') setPaymentMode('digital_wallet');
        if (mode === 'credit_sale') setPaymentMode('other');
        if (mode === 'cod') {
            setPaymentMode('cash');
            setDeliveryOrderForm((current) => ({ ...current, payment_term: 'cod' }));
        }
    };

    const openOrderSetupModal = (section: OrderSetupSection = 'server') => {
        setOrderSetupSection(section);
        setIsOrderSetupModalOpen(true);
    };

    const openSmartPaymentFlow = () => {
        if (smartCartPaymentStyle === 'modal') {
            setIsSmartPaymentModalOpen(true);
        }
    };

    const finalizeSmartCartPayment = async () => {
        if (effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos) return;
        if (smartCartPaymentMode === 'credit_sale') {
            await creditOrder();
            return;
        }
        if (smartCartPaymentMode === 'cod') {
            setDeliveryOrderForm((current) => ({
                ...current,
                payment_term: 'cod',
                delivery_status: current.delivery_status || 'pending',
            }));
            await sendToKitchen();
            return;
        }
        await payNow(activeOrderId || undefined, activeOrderNumber);
    };

    const applyManualDiscountSelection = () => {
        if ((Number(discountAmount) || 0) > 0) {
            setAppliedVoucher(null);
            setVoucherCode('');
        }
        setIsDiscountModalOpen(false);
    };

    const handleSmartCartConfirm = async () => {
        if (smartCartPaymentStyle === 'modal') {
            setIsSmartPaymentModalOpen(true);
            return;
        }
        await finalizeSmartCartPayment();
    };

    const finalizeCreditOrder = async (walkInConfirmed: boolean) => {
        if (!ensureCanOperateTerminal('finalize credit sales')) return;
        if (effectiveCart.length === 0 || !ensureOrderContext({ requireOrderTaker: true, promptCustomerSelection: true })) return;
        if (activeOrderId && hasKitchenDraftChanges) {
            toast.error('Unsaved Changes', 'Send to Kitchen or discard changes before marking this order as credit sale.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (activeOrderId && hasDraftChanges) {
                await syncExistingOrderDraft();
            }
            const priorCustomerCreditedOrders = selectedCustomer?.id
                ? allOrders.filter((existingOrder) => isCreditedOrder(existingOrder) && Number(existingOrder.customer_id || 0) === Number(selectedCustomer?.id || 0))
                : [];
            const priorPendingCreditAmount = priorCustomerCreditedOrders.reduce((sum, existingOrder) => sum + getOutstandingBalance(existingOrder), 0);
            const creditPayload = buildCreditSalePayload();
            const selectedCustomerName = selectedCustomer?.name || '';
            const selectedStaffName = selectedOrderTaker?.full_name || '';
            const selectedStaffEmployeeId = selectedOrderTaker?.employee_id || selectedOrderTaker?.id || '';
            const printTaxProfile = selectedTaxProfile
                ? {
                    tax_name: selectedTaxProfile.tax_name,
                    tax_code: selectedTaxProfile.tax_code,
                    tax_registration_number: selectedTaxProfile.tax_registration_number,
                    tax_rate: selectedTaxProfile.tax_rate,
                    calculation_method: selectedTaxProfile.calculation_method,
                }
                : null;
            const createdOrder = activeOrderId
                ? null
                : await posApi.createOrder(selectedBranchId!, buildOrderPayload('pending')) as any;
            if (!activeOrderId && createdOrder) {
                clearCurrentOrder();
            }
            const orderId = activeOrderId || createdOrder?.id;
            const order = await posApi.creditSaleOrder(orderId, creditPayload) as any;
            setReceiptOrder({
                ...order,
                is_credit_preview: true,
                _printContext: {
                    prev_balance: priorPendingCreditAmount,
                    previous_pending_credit: priorPendingCreditAmount,
                    previous_pending_orders: priorCustomerCreditedOrders.length,
                    registered_customer_name: selectedCustomerName,
                    assigned_staff_name: selectedStaffName,
                    assigned_staff_employee_id: selectedStaffEmployeeId,
                    due_date: order?.created_at || new Date(),
                    walk_in_confirmed: walkInConfirmed,
                    tax_profile: printTaxProfile,
                },
            });
            toast.success('Credit Order Saved', `Order #${formatToastDisplayNumber(order.order_number || order.id)} is finalized as credit sale.`);
            clearCurrentOrder();
            await refreshPosState(selectedBranchId!);
        } catch (error: any) {
            toast.error('Credit Order Failed', error?.message || 'Could not finalize the credit sale.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const creditOrder = async () => {
        if (!ensureCanOperateTerminal('create credit sales')) return;
        if (effectiveCart.length === 0) return;
        if (!ensureOrderContext({ requireOrderTaker: true, promptCustomerSelection: true })) return;
        if (selectedCustomer) {
            if (isSelectedCustomerStatusBlocked) {
                toast.error('Credit Blocked', 'Only active customers can be used for new credit sales.');
                return;
            }
            if (!selectedCustomer.allow_credit) {
                toast.error('Credit Blocked', 'This customer is not approved for credit.');
                return;
            }
            if (shouldBlockSelectedCustomerCredit) {
                toast.error(
                    'Credit Limit Exceeded',
                    `Projected exposure ${formatMoney(projectedCustomerCreditExposure)} exceeds limit ${formatMoney(selectedCustomerCreditLimit)}.`,
                );
                return;
            }
        }
        setIsCreditCustomerModalOpen(true);
    };

    const saveCardMachine = async () => {
        if (!selectedBranchId) return;
        if (!cardMachineForm.machine_name.trim() || !cardMachineForm.service_provider.trim() || !cardMachineForm.pid_number.trim() || !cardMachineForm.mid_number.trim()) {
            toast.error('POS Machine', 'Enter machine name, service provider, PID No., and MID No.');
            return;
        }
        setIsSavingCardMachine(true);
        try {
            const saved = await posApi.createCardMachine(selectedBranchId, {
                machine_name: cardMachineForm.machine_name.trim(),
                service_provider: cardMachineForm.service_provider.trim(),
                pid_number: cardMachineForm.pid_number.trim(),
                mid_number: cardMachineForm.mid_number.trim(),
                is_active: true,
            }) as any;
            setCardMachines((current) => [...current, saved].sort((left: any, right: any) => String(left.machine_name || '').localeCompare(String(right.machine_name || ''))));
            setSelectedCardMachineId(String(saved.id));
            setCardMachineForm(emptyCardMachineForm());
            setIsCardMachineModalOpen(false);
            toast.success('POS Machine Added', `${saved.machine_name} is now available for card payments.`);
        } catch (error: any) {
            toast.error('POS Machine Failed', error?.message || 'Could not save the POS machine.');
        } finally {
            setIsSavingCardMachine(false);
        }
    };

    const openBillPreview = () => {
        if (effectiveCart.length === 0) return toast.error('Print Bill', 'Add items to the cart first.');
        setReceiptOrder({
            id: 0,
            order_number: activeOrderNumber || loadedOrderSnapshot?.order_number || '',
            order_type: orderMode,
            table_number: selectedTableId,
            sub_total: subtotal,
            discount_amount: Number((effectiveManualDiscount + effectiveVoucherDiscount).toFixed(2)),
            total_amount: total,
            tax_amount: taxAmount,
            order_note: orderNote,
            items: effectiveCart.map((item) => ({ id: item.id, product_name: item.name, quantity: item.quantity, item_price: item.price })),
            charges: appliedCharges.map((charge: any) => ({ id: charge.id, charge_name: charge.name, amount: charge.amount, is_tax: charge.is_tax })),
            payments: paymentMode === 'split'
                ? previewPayments.map((payment, index) => ({ id: index + 1, payment_mode: payment.payment_mode, amount: payment.amount, reference_number: payment.payment_mode === 'cash' ? undefined : paymentReference || undefined }))
                : [{ id: 1, payment_mode: paymentMode, amount: total, reference_number: paymentMode === 'cash' ? undefined : paymentReference || undefined }],
            is_preview: true,
        });
    };

    const reassignHeldOrder = async (orderId: number, nextTableId?: number) => {
        if (!ensureCanOperateTerminal('reassign held orders')) return;
        if (!selectedBranchId) return;
        try {
            await posApi.reassignOrderTable(orderId, nextTableId, selectedBranchId);
            toast.success('Table Reassigned', `Order #${formatToastDisplayNumber(orderId)} has been reassigned.`);
            await refreshPosState(selectedBranchId);
        } catch (error: any) {
            toast.error('Reassignment Failed', error?.message || 'Could not reassign the selected order.');
        }
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTypingTarget = Boolean(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
            if (event.key === 'Escape') {
                if (isSmartPaymentModalOpen) {
                    event.preventDefault();
                    setIsSmartPaymentModalOpen(false);
                    return;
                }
                if (isOrderSetupModalOpen) {
                    event.preventDefault();
                    setIsOrderSetupModalOpen(false);
                    return;
                }
            }
            if (isTypingTarget && !event.ctrlKey && !['F2', 'F4', 'F6', 'F8', 'F9'].includes(event.key)) return;
            if (event.key === 'F2') {
                event.preventDefault();
                clearCurrentOrder();
            } else if (event.key === 'F4') {
                event.preventDefault();
                openOrderSetupModal('server');
            } else if (event.key === 'F6') {
                event.preventDefault();
                openSmartPaymentFlow();
            } else if (event.key === 'F8') {
                event.preventDefault();
                void sendToKitchen();
            } else if (event.key === 'F9') {
                event.preventDefault();
                openBillPreview();
            } else if (event.key === 'Enter') {
                if (isSmartPaymentModalOpen) {
                    event.preventDefault();
                    void finalizeSmartCartPayment();
                } else if (isOrderSetupModalOpen) {
                    event.preventDefault();
                    setIsOrderSetupModalOpen(false);
                }
            } else if (event.ctrlKey && event.key.toLowerCase() === 'd') {
                event.preventDefault();
                setIsDiscountModalOpen(true);
            } else if (event.ctrlKey && event.key.toLowerCase() === 'v') {
                event.preventDefault();
                setIsVoucherModalOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [clearCurrentOrder, finalizeSmartCartPayment, isOrderSetupModalOpen, isSmartPaymentModalOpen, openBillPreview, sendToKitchen]);

    const approveDiscountOverride = async () => {
        if (!approverUsername.trim() || !approverPassword.trim() || !selectedBranchId) return toast.error('Authorization Required', 'Enter authorized user credentials first.');
        setIsApproving(true);
        try {
            let loginData: any;
            try { loginData = await authApi.clientLogin({ username: approverUsername.trim(), password: approverPassword }); } catch { loginData = await authApi.systemLogin({ username: approverUsername.trim(), password: approverPassword }); }
            const approverContext = loginData?.user_context;
            const approverBranch = (approverContext?.allowed_branches ?? []).find((branch: any) => Number(branch.branch_id) === Number(selectedBranchId));
            const authorized = Boolean(approverContext?.is_system) || Boolean(approverBranch && ['branch', 'both', 'central'].includes(String(approverBranch.approval_authority || '').toLowerCase()));
            if (!authorized) throw new Error('This user is not authorized for discount overrides on the selected branch.');
            setDiscountApproval({ username: approverContext?.username || approverContext?.user_name || approverUsername.trim(), approvedAmount: manualDiscount, approvedAt: new Date().toISOString() });
            setApproverUsername('');
            setApproverPassword('');
            setIsApprovalModalOpen(false);
            toast.success('Discount Approved', 'Authorized override recorded for this order.');
        } catch (error: any) {
            toast.error('Authorization Failed', error?.message || 'Could not verify the approving user.');
        } finally {
            setIsApproving(false);
        }
    };

    const renderSmartPaymentModeFields = () => {
        if (smartCartPaymentMode === 'cash') {
            return (
                <>
                    <div className={styles.smartDetailGrid}>
                        <label className={styles.smartDetailCell}>
                            <span>Cash Received</span>
                            <input className={`${styles.compactInput} ${styles.smartCashReceivedInput}`} value={cashReceivedAmount} onChange={(event) => setCashReceivedAmount(event.target.value)} placeholder="0.00" />
                        </label>
                        <div className={`${styles.smartDetailCell} ${styles.smartDetailCellHighlight}`}>
                            <span>Change Return</span>
                            <strong className={`${styles.smartDetailValue} ${styles.smartDetailValueHighlight}`}>{formatMoney(changeReturn)}</strong>
                        </div>
                    </div>
                    {cashShortfall > 0 && (
                        <table className={styles.smartDetailsTable}>
                            <tbody>
                                <tr>
                                    <th>Short Amount</th>
                                    <td>{formatMoney(cashShortfall)}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </>
            );
        }
        if (smartCartPaymentMode === 'credit_card') {
            return (
                <div className={styles.smartDetailGrid}>
                    <label className={styles.smartDetailCell}>
                        <span>Authorization No.</span>
                        <input className={styles.compactInput} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Approval / auth no." />
                    </label>
                    <label className={styles.smartDetailCell}>
                        <span>POS Machine</span>
                        <div className={styles.smartInlineField}>
                            <select className={styles.compactInput} value={selectedCardMachineId} onChange={(event) => setSelectedCardMachineId(event.target.value)}>
                                <option value="">Select machine</option>
                                {cardMachines.map((machine: any) => (
                                    <option key={machine.id} value={machine.id}>{machine.machine_name}</option>
                                ))}
                            </select>
                            <button type="button" className={styles.smartLinkButton} onClick={() => setIsCardMachineModalOpen(true)}>Add</button>
                        </div>
                    </label>
                </div>
            );
        }
        if (smartCartPaymentMode === 'eft') {
            return (
                <div className={styles.smartDetailGrid}>
                    <label className={styles.smartDetailCell}>
                        <span>Bank</span>
                        <select
                            className={styles.compactInput}
                            value={onlinePaymentDetails.source_bank}
                            onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, source_bank: event.target.value }))}
                        >
                            <option value="">Select bank</option>
                            {eftBankOptions.map((bank) => (
                                <option key={bank} value={bank}>{bank}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.smartDetailCell}>
                        <span>Authorization No.</span>
                        <input className={styles.compactInput} value={onlinePaymentDetails.transaction_no} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, transaction_no: event.target.value }))} placeholder="Auth / transaction no." />
                    </label>
                </div>
            );
        }
        if (smartCartPaymentMode === 'wallet') {
            return (
                <table className={styles.smartDetailsTable}>
                    <tbody>
                        <tr>
                            <th>Wallet User</th>
                            <td><input className={styles.compactInput} value={onlinePaymentDetails.sender_name} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, sender_name: event.target.value }))} placeholder="Wallet account holder" /></td>
                        </tr>
                        <tr>
                            <th>Wallet Reference</th>
                            <td><input className={styles.compactInput} value={onlinePaymentDetails.transaction_no} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, transaction_no: event.target.value }))} placeholder="Transaction / reference" /></td>
                        </tr>
                        <tr>
                            <th>Wallet Info</th>
                            <td>{selectedCustomer?.phone_number || selectedCustomer?.email || 'No wallet reference linked'}</td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        if (smartCartPaymentMode === 'credit_sale') {
            return (
                <table className={styles.smartDetailsTable}>
                    <tbody>
                        <tr>
                            <th>Responsible Staff</th>
                            <td>
                                <select className={styles.compactInput} value={selectedOrderTakerId ? String(selectedOrderTakerId) : ''} onChange={(event) => setSelectedOrderTakerId(event.target.value ? Number(event.target.value) : null)}>
                                    <option value="">Select staff</option>
                                    {orderTakers.map((orderTaker: any) => (
                                        <option key={orderTaker.id} value={orderTaker.id}>{orderTaker.full_name}{orderTaker.designation_name ? ` | ${orderTaker.designation_name}` : ''}</option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Customer</th>
                            <td>
                                <div className={styles.smartInlineField}>
                                    <span>{selectedCustomer?.name || 'No customer selected'}</span>
                                    <button type="button" className={styles.smartLinkButton} onClick={() => openCustomerSearchModal('credit')}>Select</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th>Credit History</th>
                            <td>{selectedCustomerCreditSummary.orderCount} open | {formatMoney(selectedCustomerCreditSummary.outstandingAmount)}</td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        return (
            <div className={styles.smartDetailGrid}>
                <div className={styles.smartDetailCell}>
                    <span>Delivery Charges</span>
                    <strong className={styles.smartDetailValue}>{formatMoney(branchDeliveryCharge)}</strong>
                </div>
                <div className={styles.smartDetailCell}>
                    <span>Amount to Collect</span>
                    <strong className={styles.smartDetailValue}>{formatMoney(total)}</strong>
                </div>
                <label className={styles.smartDetailCell}>
                    <span>Select Raider</span>
                    <select
                        className={styles.compactInput}
                        value={deliveryOrderForm.delivery_person_user_id}
                        onChange={(event) => {
                            const nextId = event.target.value;
                            const nextAgent = codAssignableAgents.find((entry: any) => String(entry.id) === nextId) || null;
                            setDeliveryOrderForm((current) => ({
                                ...current,
                                delivery_person_user_id: nextId,
                                delivery_person_name: nextAgent?.full_name || nextAgent?.user_name || current.delivery_person_name,
                                payment_term: 'cod',
                            }));
                        }}
                    >
                        <option value="">Select raider</option>
                        {codAssignableAgents.map((agent: any) => (
                            <option key={agent.id} value={agent.id}>{agent.full_name || agent.user_name}{agent.designation_name ? ` | ${agent.designation_name}` : ''}</option>
                        ))}
                    </select>
                </label>
                <label className={styles.smartDetailCell}>
                    <span>Payment Status</span>
                    <select className={styles.compactInput} value={deliveryOrderForm.delivery_status} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, delivery_status: event.target.value as DeliveryStatus }))}>
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                    </select>
                </label>
            </div>
        );
    };

    const renderSmartPaymentSummaryRows = (includeNetPayable = false) => (
        <>
            <tr className={styles.smartSummaryRowSubtotal}>
                <th>Subtotal</th>
                <td className={styles.smartSummaryValueStrong}>{formatMoney(subtotal)}</td>
            </tr>
            <tr>
                <th>Discount</th>
                <td className={totalSmartDiscount > 0 ? styles.smartSummaryValueNegative : styles.smartSummaryValueMuted}>{smartDiscountDisplay}</td>
            </tr>
            <tr>
                <th>Mode</th>
                <td>{smartCartPaymentModeLabels[smartCartPaymentMode]}</td>
            </tr>
            <tr className={styles.smartSummaryRowTax}>
                <th>Tax</th>
                <td>{smartTaxDisplay}</td>
            </tr>
            {includeNetPayable && (
                <tr className={styles.smartSummaryRowTotal}>
                    <th>Payable</th>
                    <td className={styles.smartSummaryValueStrong}>{formatMoney(total)}</td>
                </tr>
            )}
        </>
    );

    const renderSmartInlineSummary = () => (
        <div className={styles.smartInlineSummaryList}>
            <div className={`${styles.smartInlineSummaryRow} ${styles.smartInlineSummaryRowSub}`}>
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className={`${styles.smartInlineSummaryRow} ${styles.smartInlineSummaryRowDisc}`}>
                <span>Discount</span>
                <strong className={totalSmartDiscount > 0 ? styles.smartSummaryValueNegative : styles.smartSummaryValueMuted}>{smartDiscountDisplay}</strong>
            </div>
            <div className={styles.smartInlineSummaryRow}>
                <span>Mode</span>
                <strong>{smartCartPaymentModeLabels[smartCartPaymentMode]}</strong>
            </div>
            <div className={`${styles.smartInlineSummaryRow} ${styles.smartInlineSummaryRowTax}`}>
                <span>Tax</span>
                <div className={styles.smartInlineSummaryValueGroup}>
                    <select className={styles.compactInput} value={taxSelectionValue} onChange={(event) => setTaxSelection(event.target.value)}>
                        {defaultTaxCode ? <option value={defaultTaxCode}>Branch Default</option> : null}
                        {taxOptions.map((tax: any) => (
                            <option key={tax.tax_code} value={tax.tax_code}>{tax.tax_name || tax.tax_code}</option>
                        ))}
                        <option value="none">No Tax</option>
                    </select>
                    <strong>{smartTaxDisplay}</strong>
                </div>
            </div>
        </div>
    );

    const renderSmartModalPaymentDetails = () => {
        if (smartCartPaymentMode === 'cash') {
            return (
                <table className={styles.smartDetailsTable}>
                    <tbody>
                        <tr>
                            <th>Total Payable</th>
                            <td className={styles.smartSummaryValueStrong}>{formatMoney(total)}</td>
                        </tr>
                        <tr>
                            <th>Cash Received</th>
                            <td>
                                <input className={`${styles.compactInput} ${styles.smartCashReceivedInput}`} value={cashReceivedAmount} onChange={(event) => setCashReceivedAmount(event.target.value)} placeholder="0.00" />
                            </td>
                        </tr>
                        <tr className={styles.smartSummaryRowTax}>
                            <th>Return Change</th>
                            <td className={styles.smartDetailValueHighlight}>{formatMoney(changeReturn)}</td>
                        </tr>
                        {cashShortfall > 0 && (
                            <tr>
                                <th>Short Amount</th>
                                <td>{formatMoney(cashShortfall)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            );
        }

        return (
            <>
                <table className={styles.smartDetailsTable}>
                    <tbody>
                        <tr>
                            <th>Total Payable</th>
                            <td className={styles.smartSummaryValueStrong}>{formatMoney(total)}</td>
                        </tr>
                        <tr>
                            <th>Payment Mode</th>
                            <td>{smartCartPaymentModeLabels[smartCartPaymentMode]}</td>
                        </tr>
                    </tbody>
                </table>
                <div className={styles.smartDetailsGrid}>
                    {renderSmartPaymentModeFields()}
                </div>
            </>
        );
    };

    const renderSmartPaymentSummary = (inModal = false) => (
        <section className={`${styles.smartPaymentSummary} ${inModal ? styles.smartPaymentSummaryModal : styles.smartPaymentSummaryInline}`}>
            <div className={styles.smartPaymentHeader}>
                <div>
                    <strong>{smartCartPaymentModeLabels[smartCartPaymentMode]} Mode</strong>
                </div>
                <div className={`${styles.smartSummaryActions} ${inModal ? styles.smartSummaryActionsModal : ''}`}>
                    <button type="button" className={`${styles.smartLinkButton} ${styles.smartLinkButtonVoucher}`} onClick={() => setIsVoucherModalOpen(true)}>Voucher</button>
                    <button type="button" className={`${styles.smartLinkButton} ${styles.smartLinkButtonDiscount}`} onClick={() => setIsDiscountModalOpen(true)}>Discount</button>
                </div>
            </div>
            <div className={`${styles.smartModeSelector} ${inModal ? styles.smartModeSelectorModal : ''}`}>
                {(['cash', 'credit_card', 'eft', 'wallet', 'credit_sale', 'cod'] as SmartCartPaymentMode[]).map((mode) => {
                    const ModeIcon =
                        mode === 'cash' ? Banknote :
                        mode === 'credit_card' ? CreditCard :
                        mode === 'eft' ? Building2 :
                        mode === 'wallet' ? Wallet :
                        mode === 'credit_sale' ? ClipboardList :
                        mode === 'cod' ? Truck : Banknote;
                    const modeClass =
                        mode === 'cash' ? styles.smartModeCash :
                        mode === 'credit_card' ? styles.smartModeCard :
                        mode === 'eft' ? styles.smartModeEft :
                        mode === 'wallet' ? styles.smartModeWallet :
                        mode === 'credit_sale' ? styles.smartModeCreditSale :
                        styles.smartModeCod;
                    const activeClass =
                        mode === 'cash' ? styles.smartModeCashActive :
                        mode === 'credit_card' ? styles.smartModeCardActive :
                        mode === 'eft' ? styles.smartModeEftActive :
                        mode === 'wallet' ? styles.smartModeWalletActive :
                        mode === 'credit_sale' ? styles.smartModeCreditSaleActive :
                        styles.smartModeCodActive;
                    return (
                        <button
                            key={mode}
                            type="button"
                            className={`${styles.smartModeButton} ${inModal ? styles.smartModeButtonModal : ''} ${modeClass} ${smartCartPaymentMode === mode ? activeClass : ''}`}
                            onClick={() => setSmartPaymentModeAndSync(mode)}
                        >
                            <ModeIcon size={12} />
                            {smartCartPaymentModeLabels[mode]}
                        </button>
                    );
                })}
            </div>
            {!inModal ? renderSmartInlineSummary() : (
                <div className={styles.smartPaymentModalSummaryGrid}>
                    <div className={styles.smartPaymentModalSummaryColumn}>
                        <table className={styles.smartSummaryTable}>
                            <tbody>
                                <tr className={styles.smartSummaryRowSubtotal}>
                                    <th>Sub-Total</th>
                                    <td className={styles.smartSummaryValueStrong}>{formatMoney(subtotal)}</td>
                                </tr>
                                <tr>
                                    <th>Discount / Voucher</th>
                                    <td>{appliedVoucher?.code ? `Voucher (${appliedVoucher.code})` : effectiveManualDiscount > 0 ? 'Discount' : 'None'}</td>
                                </tr>
                                <tr>
                                    <th>Discount Amount</th>
                                    <td className={totalSmartDiscount > 0 ? styles.smartSummaryValueNegative : styles.smartSummaryValueMuted}>{smartDiscountDisplay}</td>
                                </tr>
                                <tr>
                                    <th>Tax Profile</th>
                                    <td>
                                        <div className={styles.smartSummaryCellControl}>
                                            <select className={styles.compactInput} value={taxSelectionValue} onChange={(event) => setTaxSelection(event.target.value)}>
                                                {defaultTaxCode ? <option value={defaultTaxCode}>Branch Default</option> : null}
                                                {taxOptions.map((tax: any) => (
                                                    <option key={tax.tax_code} value={tax.tax_code}>{tax.tax_name || tax.tax_code}</option>
                                                ))}
                                                <option value="none">No Tax</option>
                                            </select>
                                            <strong className={styles.smartSummaryInlineMeta}>{selectedTaxRateLabel || '0%'}</strong>
                                        </div>
                                    </td>
                                </tr>
                                <tr className={styles.smartSummaryRowTax}>
                                    <th>Tax Amount</th>
                                    <td>{smartTaxDisplay}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className={styles.smartPaymentModalDetailColumn}>
                        {renderSmartModalPaymentDetails()}
                    </div>
                </div>
            )}
            {!inModal ? renderSmartPaymentModeFields() : null}
        </section>
    );

    const renderSmartCartPanel = () => (
        <aside className={`cart-panel ${styles.smartCartPanel}`}>
            <div className={`${styles.smartOrderStrip} cart-order-strip`}>
                <div className={styles.smartOrderStripMeta}>
                    <div className={styles.smartOrderStripRow}>
                        <strong className={styles.smartOrderPrimary}>{smartOrderNumberDisplay}</strong>
                        <strong className={styles.smartOrderSecondary}>{smartKotDisplay}</strong>
                    </div>
                    <div className={styles.smartOrderStripRow}>
                        <strong className={styles.smartOrderTertiary}>{smartOrderPlacedDisplay}</strong>
                        <strong className={styles.smartOrderTertiary}>{`Elapsed ${smartOrderElapsedClockDisplay}`}</strong>
                    </div>
                </div>
                <button
                    type="button"
                    className={styles.smartHistoryButton}
                    onClick={() => {
                        if (!activeOrderId) return;
                        setAuditOrderId(activeOrderId);
                        setAuditOrderNo(activeOrderNumber || String(activeOrderId));
                        setIsOrderAuditOpen(true);
                    }}
                    disabled={!activeOrderId}
                    title="History"
                    aria-label="History"
                >
                    <History size={14} />
                </button>
            </div>

            <div className={styles.smartCartBody}>
                <button type="button" className={styles.smartCartHeader} onClick={() => openOrderSetupModal('server')}>
                    <div className={styles.smartHeaderMetaRows}>
                        <div className={styles.smartHeaderMetaRow}>
                            <div className={styles.smartHeaderMetaInline}><span>Type:</span><strong>{smartCartChips[0]?.value || '-'}</strong></div>
                            <div className={styles.smartHeaderMetaInline}><span>User:</span><strong>{smartCartChips[1]?.value || '-'}</strong></div>
                            <div className={styles.smartHeaderMetaInline}><span>Tbl:</span><strong>{smartCartChips[2]?.value || '-'}</strong></div>
                            <div className={styles.smartHeaderMetaInline}><span>Cstmr:</span><strong>{smartCartChips[3]?.value || '-'}</strong></div>
                        </div>
                    </div>
                </button>

                <div className={styles.smartCartTableWrap}>
                    <div className="cart-scroll">
                        <table className="cart-table">
                            <thead>
                                <tr>
                                    <th style={{ fontSize: '13px', width: '7%' }}>#</th>
                                    <th style={{ fontSize: '13px', width: '38%' }}>Item</th>
                                    <th className="text-right" style={{ fontSize: '13px', width: '20%' }}>Price</th>
                                    <th className="text-center" style={{ fontSize: '13px', width: '15%' }}>Qty</th>
                                    <th className="text-right" style={{ fontSize: '13px', width: '20%' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.length > 0 ? cart.map((item, index) => {
                                    const changeState = loadedOrderIsExisting ? getCartLineChangeState(item) : 'unchanged';
                                    const itemAccent = changeState === 'new' ? '#2563eb' : item.isDeleted ? 'var(--danger)' : undefined;
                                    const qtyAccent = changeState === 'decrease' ? 'var(--danger)' : changeState === 'increase' ? 'var(--success)' : changeState === 'new' ? '#2563eb' : 'var(--text-primary)';
                                    const qtyBackground = changeState === 'decrease' ? 'rgba(239, 68, 68, 0.08)' : changeState === 'increase' ? 'rgba(16, 185, 129, 0.08)' : changeState === 'new' ? 'rgba(37, 99, 235, 0.08)' : 'white';
                                    return (
                                        <tr className={`cart-row ${item.isDeleted ? 'cart-row-deleted' : ''}`} key={item.lineKey}>
                                            <td className="text-center" style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{index + 1}</td>
                                            <td style={{ fontWeight: 500, color: itemAccent }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                                                    <span className={item.isDeleted ? 'cart-line-text-deleted' : ''}>{item.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => { event.stopPropagation(); setActiveNoteItemId(activeNoteItemId === item.lineKey ? null : item.lineKey); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.note ? 'var(--primary)' : 'var(--text-muted)' }}
                                                        title="Add/Edit Note"
                                                        disabled={Boolean(item.isDeleted)}
                                                    >
                                                        <MessageSquare size={13} />
                                                    </button>
                                                </div>
                                                {(activeNoteItemId === item.lineKey || item.note) && !item.isDeleted && (
                                                    <input
                                                        type="text"
                                                        className="cart-note-input"
                                                        placeholder="Add note..."
                                                        value={item.note || ''}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => updateItemNote(loadedOrderIsExisting ? item.lineKey : item.id, event.target.value)}
                                                        onBlur={() => { if (!item.note) setActiveNoteItemId(null); }}
                                                        autoFocus={activeNoteItemId === item.lineKey && !item.note}
                                                    />
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <input type="number" className="cart-price-input" value={item.price} onClick={(event) => event.stopPropagation()} onChange={(event) => updateItemPrice(loadedOrderIsExisting ? item.lineKey : item.id, event.target.value)} disabled={Boolean(item.isDeleted)} />
                                            </td>
                                            <td className="text-center">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <button type="button" className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }} onClick={() => updateQuantity(loadedOrderIsExisting ? item.lineKey : item.id, -1)}>-</button>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={item.quantity}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => setLineQuantity(loadedOrderIsExisting ? item.lineKey : item.id, event.target.value)}
                                                        disabled={Boolean(item.isDeleted)}
                                                        style={{ width: '48px', textAlign: 'center', fontWeight: 700, color: qtyAccent, border: `1px solid ${changeState === 'unchanged' ? 'var(--border-color)' : qtyAccent}`, borderRadius: '8px', padding: '3px 6px', background: qtyBackground }}
                                                        className={item.isDeleted ? 'cart-line-text-deleted' : ''}
                                                    />
                                                    <button type="button" className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }} onClick={() => updateQuantity(loadedOrderIsExisting ? item.lineKey : item.id, 1)}>+</button>
                                                </div>
                                            </td>
                                            <td className={`text-right ${item.isDeleted ? 'cart-line-text-deleted' : ''}`} style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                                {formatCartAmount(item.price * item.quantity)}
                                                <button type="button" className="cart-del-btn" title="Remove Item" style={{ marginLeft: '8px' }} onClick={() => removeFromCart(loadedOrderIsExisting ? item.lineKey : item.id)}>
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }) : [1, 2, 3, 4, 5].map((index) => (
                                    <tr key={index} className="cart-row placeholder-row">
                                        <td colSpan={5} style={{ height: '34px', borderBottom: '1px solid #f1f5f9' }} />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={styles.smartCommentWrap}>
                    <textarea className="remarks-input" placeholder="Order comments..." rows={2} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} />
                    <div className={styles.smartCommentMeta}>
                        <span className={styles.smartCommentMetric}>Total Products: {effectiveCart.length}</span>
                        <span className={styles.smartCommentMetric}>Total Items: {cartItemCount}</span>
                    </div>
                </div>

                <div className={styles.smartActionStrip}>
                    <button
                        type="button"
                        className={`${styles.smartActionButton} ${styles.smartActionButtonNewOrder}`}
                        onClick={clearCurrentOrder}
                        disabled={!canStartSmartNewOrder}
                    >
                        <Plus size={15} />
                        New Order
                    </button>
                    <button type="button" className={`${styles.smartActionButton} ${styles.smartActionButtonPrimary}`} disabled={effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos} onClick={() => void sendToKitchen()}><Ticket size={15} />Send to Kitchen</button>
                    {canDiscardChanges && <button type="button" className={styles.smartGhostButton} onClick={discardLoadedOrderChanges}>Discard Changes</button>}
                </div>

                {smartCartPaymentStyle === 'inline' ? (
                    <>
                        <div className={styles.smartSummarySeparator} />
                        {renderSmartPaymentSummary(false)}
                        <div className={styles.smartNetPayable}>
                            <span>Net Payable</span>
                            <strong>{formatMoney(total)}</strong>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.smartSummarySeparator} />
                        <section className={styles.smartPaymentSummary}>
                            <div className={styles.smartPaymentHeader}>
                                <div>
                                    <strong>Payment Summary</strong>
                                    <span>Review payment mode, totals, and tax before confirmation</span>
                                </div>
                            </div>
                            <table className={styles.smartSummaryTable}>
                                <tbody>
                                    {renderSmartPaymentSummaryRows(false)}
                                </tbody>
                            </table>
                        </section>
                    </>
                )}

                {smartCartPaymentStyle === 'modal' && (
                    <div className={styles.smartNetPayable}>
                        <span>Net Payable</span>
                        <strong>{formatMoney(total)}</strong>
                    </div>
                )}

                <div className={styles.smartFooterActions}>
                    <button
                        type="button"
                        className={`${styles.smartActionButton} ${styles.smartActionButtonPreSale}`}
                        onClick={openBillPreview}
                        disabled={!canOpenSmartPreSale}
                    >
                        <Printer size={16} />
                        Pre-Sale Bill
                    </button>
                    <button type="button" className={`${styles.smartActionButton} ${styles.smartActionButtonPrimary}`} disabled={effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos} onClick={() => void handleSmartCartConfirm()}><CreditCard size={16} />Confirm Payment</button>
                </div>
            </div>
        </aside>
    );

    if (isBootstrapping && !selectedBranchId) return <div className={styles.posContainer}><div className={styles.centerState}><Loader2 size={44} className={styles.spinner} /></div></div>;
    if (!canReadPos) return <div className={styles.posContainer}><div className={styles.centerState}><div className={styles.tillGuardCard}><div className={styles.tillGuardIcon}><Lock size={36} /></div><h2>POS Access Restricted</h2><p>Your current branch role does not include POS access.</p></div></div></div>;

    return (
        <div className={styles.posContainer}>
            {!ready && (
                <div className={styles.tillGuardOverlay}>
                    <div className={styles.tillGuardCard}>
                        <div className={styles.tillGuardIcon}><Lock size={36} /></div>
                        {!currentCounterSession || !activeTill || activeTill.branch_id !== selectedBranchId ? (
                            <>
                                <h2>No Assigned Counter Session</h2>
                                <p>An authorized branch user must assign this cashier to a sales counter inside an open business day before this terminal can be used.</p>
                                <div className={styles.tillGuardWarning}><AlertTriangle size={14} /><span>Open the Manager Console to assign the counter session, then return here to verify opening cash.</span></div>
                                {canOpenManagerConsole ? (
                                    <div className={styles.tillGuardActions}>
                                        <KitchenButton variant="primary" onClick={() => navigate('/terminal/day')} className={styles.tillGuardBtn}><RotateCcw size={16} /> Open Manager Console</KitchenButton>
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <h2>Counter Session Not Ready</h2>
                                <p>This terminal has an assigned counter session, but the business-day context is missing or stale.</p>
                                <div className={styles.tillGuardWarning}><AlertTriangle size={14} /><span>Refresh the terminal, or return to the Manager Console and reopen the day assignment if needed.</span></div>
                                <div className={styles.tillGuardActions}>
                                    <KitchenButton variant="primary" onClick={() => void handleManualSync()} className={styles.tillGuardBtn}><RotateCcw size={16} /> Refresh Terminal</KitchenButton>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Opening Cash Modal */}
            {ready && !openingCashConfirmed && (
                <PosOpeningCashModal
                    counterName={counterLabel}
                    username={operatorLabel}
                    businessDate={currentShift?.business_date || todayLabel}
                    assignedFloat={managerAssignedFloat}
                    currencyLabel={resolvedCurrencyLabel}
                    formatMoneyOverride={(amount) => formatPosMoney(amount)}
                    onConfirm={async (amount) => {
                        if (!selectedBranchId || !currentCounterSession?.id) return;
                        try {
                            const session = await posApi.verifyCounterOpening(selectedBranchId, Number(currentCounterSession.id), {
                                verified_opening_cash: amount,
                            });
                            applyCounterSessionState(session, selectedBranchId);
                            toast.success('Counter Opened', 'Your assigned counter session is now active.');
                        } catch (error: any) {
                            toast.error('Opening Cash Failed', error?.message || 'Could not verify the opening cash for this counter.');
                        }
                    }}
                />
            )}

            {/* Close Counter Modal */}
            {ready && openingCashConfirmed && isCloseCounterOpen && (
                <PosClosingCashModal
                    counterName={counterLabel}
                    username={operatorLabel}
                    cashierUsername={operatorLabel}
                    openingCash={openingCashAmount}
                    businessDate={currentShift?.business_date || todayLabel}
                    currencyLabel={resolvedCurrencyLabel}
                    formatMoneyOverride={(amount) => formatPosMoney(amount)}
                    onConfirm={async (totalCash, cashierUsername, cashierPin, authorizedUsername, authorizedPin) => {
                        if (!selectedBranchId || !currentCounterSession?.id) return;
                        try {
                            const session = await posApi.blindCloseCounterSession(selectedBranchId, Number(currentCounterSession.id), {
                                blind_count: totalCash,
                                cashier_username: cashierUsername,
                                cashier_pin: cashierPin,
                                authorized_username: authorizedUsername,
                                authorized_pin: authorizedPin,
                                notes: `Blind close from POS terminal at ${new Date().toLocaleTimeString()}`,
                            });
                            try {
                                const report = await posApi.getCounterSessionXReport(selectedBranchId, Number(currentCounterSession.id));
                                const formatMoneyValue = (value: any) =>
                                    formatPosMoney(Number(value || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                                const reportFormat = (['thermal-80mm', 'a4'] as PrintPaperFormat[]).includes(settings.report_paper_size as PrintPaperFormat)
                                    ? (settings.report_paper_size as PrintPaperFormat)
                                    : 'thermal-80mm';
                                const documentMarkup = buildCounterSessionXReportPrintDocument({
                                    settings,
                                    format: reportFormat,
                                    data: {
                                        ...report,
                                        printed_at: new Date(),
                                        sections: {
                                            ...report?.sections,
                                            cash_summary: {
                                                ...report?.sections?.cash_summary,
                                                opening_cash: formatMoneyValue(report?.sections?.cash_summary?.opening_cash),
                                                cash_sale: formatMoneyValue(report?.sections?.cash_summary?.cash_sale),
                                                cash_expense: formatMoneyValue(report?.sections?.cash_summary?.cash_expense),
                                                cash_refund: formatMoneyValue(report?.sections?.cash_summary?.cash_refund),
                                                total_cash_in_hand: formatMoneyValue(report?.sections?.cash_summary?.total_cash_in_hand),
                                            },
                                            cash_actual_vs_expected: {
                                                ...report?.sections?.cash_actual_vs_expected,
                                                expected_cash: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.expected_cash),
                                                actual_cash: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.actual_cash),
                                                variance: formatMoneyValue(report?.sections?.cash_actual_vs_expected?.variance),
                                            },
                                            pos_summary: {
                                                ...report?.sections?.pos_summary,
                                                cash_sale: formatMoneyValue(report?.sections?.pos_summary?.cash_sale),
                                                online_payment_sale: formatMoneyValue(report?.sections?.pos_summary?.online_payment_sale),
                                                credit_card_sale: formatMoneyValue(report?.sections?.pos_summary?.credit_card_sale),
                                                wallet_sale: formatMoneyValue(report?.sections?.pos_summary?.wallet_sale),
                                                total_sale: formatMoneyValue(report?.sections?.pos_summary?.total_sale),
                                                returned_amount: formatMoneyValue(report?.sections?.pos_summary?.returned_amount),
                                                discount_amount: formatMoneyValue(report?.sections?.pos_summary?.discount_amount),
                                                voided_amount: formatMoneyValue(report?.sections?.pos_summary?.voided_amount),
                                            },
                                            wallet_summary: {
                                                ...report?.sections?.wallet_summary,
                                                wallet_used_today: formatMoneyValue(report?.sections?.wallet_summary?.wallet_used_today),
                                                added_in_wallet_today: formatMoneyValue(report?.sections?.wallet_summary?.added_in_wallet_today),
                                                current_closing_balance: formatMoneyValue(report?.sections?.wallet_summary?.current_closing_balance),
                                            },
                                            credit_summary: {
                                                ...report?.sections?.credit_summary,
                                                total_credited_sale_today: formatMoneyValue(report?.sections?.credit_summary?.total_credited_sale_today),
                                                previously_pending_credit: formatMoneyValue(report?.sections?.credit_summary?.previously_pending_credit),
                                                credited_amount_received: formatMoneyValue(report?.sections?.credit_summary?.credited_amount_received),
                                                net_credit_balance: formatMoneyValue(report?.sections?.credit_summary?.net_credit_balance),
                                            },
                                            expense_summary: {
                                                ...report?.sections?.expense_summary,
                                                expense_from_cash_counter: formatMoneyValue(report?.sections?.expense_summary?.expense_from_cash_counter),
                                                total_expense: formatMoneyValue(report?.sections?.expense_summary?.total_expense),
                                            },
                                            order_type_summary: (report?.sections?.order_type_summary || []).map((row: any) => ({
                                                ...row,
                                                amount: formatMoneyValue(row.amount),
                                            })),
                                            sold_items_summary: (report?.sections?.sold_items_summary || []).map((row: any) => ({
                                                ...row,
                                                gross_sale: formatMoneyValue(row.gross_sale),
                                                returned_amount: formatMoneyValue(row.returned_amount),
                                                net_sale: formatMoneyValue(row.net_sale),
                                            })),
                                            station_wise_sale: (report?.sections?.station_wise_sale || []).map((row: any) => ({
                                                ...row,
                                                sales_amount: formatMoneyValue(row.sales_amount),
                                            })),
                                            events_summary: {
                                                ...report?.sections?.events_summary,
                                                payment_received_against_events: formatMoneyValue(report?.sections?.events_summary?.payment_received_against_events),
                                                receivable_amount_of_event: formatMoneyValue(report?.sections?.events_summary?.receivable_amount_of_event),
                                            },
                                        },
                                    },
                                });
                                if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, 'Sales Counter Closing Report')) {
                                    toast.error('Print Blocked', 'Allow pop-ups for this app to print the sales counter closing report.');
                                }
                            } catch (reportError: any) {
                                toast.error('Report Failed', reportError?.message || 'Could not generate the sales counter closing report.');
                            }
                            applyCounterSessionState(session, selectedBranchId);
                            setIsCloseCounterOpen(false);
                            toast.success('Counter Closed', 'This counter session is now closed and the counted cash has been handed to branch-safe custody.');
                        } catch (err: any) {
                            toast.error('Close Counter Failed', err?.message || 'Could not submit your cash count.');
                        }
                    }}
                    onCancel={() => setIsCloseCounterOpen(false)}
                />
            )}

            {/* Terminal Locked Overlay Modal — Professional & High-Fidelity */}
            {(['blind_submitted', 'closed', 'reconciled'].includes(terminalStatus || '')) && !isCloseCounterOpen && (
                <div className="terminal-locked-overlay">
                    <div className="lock-card">
                        <div className="lock-icon-wrapper">
                            <Lock size={40} className="lock-icon" strokeWidth={2} />
                        </div>
                        <h2 className="lock-title">
                            {terminalStatus === 'blind_submitted'
                                ? `POS Terminal ${counterLabel || 'N/A'} has a Legacy Pending Close`
                                : `POS Terminal ${counterLabel || 'N/A'} is Fully Closed`}
                        </h2>
                        <p className="lock-text">
                            {terminalStatus === 'blind_submitted'
                                ? 'This counter has an older pending-close record. Finalize it from manager tools or start a fresh session after cleanup.'
                                : 'This counter session is fully closed. An authorized branch user must create a new session with a cashier assignment and new opening cash before the terminal can be used again.'}
                        </p>
                        
                        <div className="lock-details">
                            <div className="detail-row">
                                <span className="detail-label">Workstation</span>
                                <span className="detail-value">{counterLabel || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Sales Counter Operation Status</span>
                                <span className="detail-value status-tag neutral-tag">CLOSED</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Session Status</span>
                                <span className="detail-value status-tag">
                                    {terminalStatus === 'blind_submitted'
                                        ? 'LEGACY PENDING CLOSE'
                                        : 'FULLY CLOSED'}
                                </span>
                            </div>
                        </div>

                        <div className="lock-actions">
                            <Link
                                to="/terminal"
                                className="btn-pill btn-purple lock-action-btn lock-link-btn"
                            >
                                <Home size={18} />
                                Go Back to Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <div
                className={`online-pos-mirror ${posLayout === 'smart_cart' ? 'smart-cart-layout' : ''} ${(['blind_submitted', 'closed', 'reconciled'].includes(terminalStatus || '')) ? 'is-blurred' : ''}`}
                style={{ ['--cart-panel-width' as any]: `${cartWidth}px` }}
            >
                <div className="layout">
                    <nav className="navbar">
                        <div className="nav-left">
                            <div className="brand">
                                <span className="brand-mark">K</span>
                                <span className="brand-text">KitchenOS POS</span>
                            </div>
                            <button type="button" className="nav-home-btn" onClick={() => navigate('/terminal')}><Home size={14} />Home</button>
                            <button type="button" className="nav-action nav-action-sync" onClick={() => void handleManualSync()}><RotateCcw size={13} />{isSyncingMenu ? 'Syncing...' : 'Sync'}</button>
                            <button type="button" className="nav-action" onClick={() => {
                                setShowAdvancedOrderFilters(true);
                                openOrdersModal('Advanced Order Search', 'recent', { preserveSearch: true });
                            }}><Search size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', marginTop: '-2px' }} />Advanced Search</button>
                            {canUseKds ? <button type="button" className="btn-pill btn-purple nav-view-btn" onClick={() => window.open('/terminal/kds', '_blank')}><Monitor size={13} />KDS</button> : null}
                        </div>
                        <div className="nav-right">
                            <div className="branch-picker-inline nav-branch-chip">
                                <Store size={14} />
                                <select className="compact-branch-select" value={selectedBranchId ? String(selectedBranchId) : ''} onChange={(event) => setSelectedBranchId(event.target.value ? Number(event.target.value) : null)}>
                                    <option value="">Select Branch</option>
                                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}
                                </select>
                            </div>
                            <div className="nav-session">
                                <div className="nav-session-title">{counterLabel}</div>
                                <div className="nav-session-subtitle">{businessDayLabel}{businessDayWindowLabel ? ` | ${businessDayWindowLabel}` : ''}</div>
                            </div>
                            <div className="nav-user nav-profile-trigger" onClick={() => setIsActionsOpen(!isActionsOpen)} style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <User size={13} />
                                {operatorLabel}
                                <ChevronDown size={11} />
                                {isActionsOpen && (
                                    <div
                                        className="nav-profile-menu"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); openOrdersModal('Recent Orders', 'recent'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <History size={14} style={{ opacity: 0.7 }} />
                                            Recent Orders
                                        </button>
                                        {canProcessSalesReturn && (
                                            <>
                                                <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setShowAdvancedOrderFilters(true); openOrdersModal('Returned Order List', 'returned', { preserveSearch: true }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <History size={14} style={{ opacity: 0.7 }} />
                                                    Returned Order List
                                                </button>
                                                <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); openSalesReturnModal(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <RotateCcw size={14} style={{ opacity: 0.7 }} />
                                                    Sales Return
                                                </button>
                                            </>
                                        )}
                                        {canOpenCreditLedger ? (
                                            <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setIsCreditLedgerOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CreditCard size={14} style={{ opacity: 0.7 }} />
                                                Credit Ledger
                                            </button>
                                        ) : null}
                                        {canOpenCashierExpense ? (
                                            <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setIsExpenseModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Wallet size={14} style={{ opacity: 0.7 }} />
                                                Record Expense
                                            </button>
                                        ) : null}
                                        <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setShowSidebar(!showSidebar); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <PanelLeft size={14} style={{ opacity: 0.7 }} />
                                            {showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
                                        </button>
                                        {ready && openingCashConfirmed && (
                                            <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setIsCloseCounterOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Lock size={14} style={{ opacity: 0.7 }} />
                                                Close Counter
                                            </button>
                                        )}
                                        {posLayout === 'smart_cart' && canVoidActiveOrder && (
                                            <button type="button" className="dropdown-action-item" onClick={() => { setIsActionsOpen(false); setCancelOrderReason(''); setCancelOrderApprovalUsername(''); setCancelOrderApprovalPin(''); setIsCancelOrderOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <AlertTriangle size={14} style={{ opacity: 0.7 }} />
                                                Void Order
                                            </button>
                                        )}
                                        <div className="nav-profile-divider" />
                                        <div className="nav-profile-section">
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                <span className="nav-profile-label">POS Layout</span>
                                                <div className="nav-profile-row">
                                                    <button type="button" className="dropdown-action-item sub-item" style={{ flex: 1, justifyContent: 'center', background: posLayout === 'classic' ? '#eff6ff' : 'transparent', color: posLayout === 'classic' ? 'var(--primary)' : 'var(--text-main)' }} onClick={() => setPosLayout('classic')}>Classic Layout</button>
                                                    <button type="button" className="dropdown-action-item sub-item" style={{ flex: 1, justifyContent: 'center', background: posLayout === 'smart_cart' ? '#eff6ff' : 'transparent', color: posLayout === 'smart_cart' ? 'var(--primary)' : 'var(--text-main)' }} onClick={() => setPosLayout('smart_cart')}>Smart Cart Layout</button>
                                                </div>
                                            </div>
                                            {posLayout === 'smart_cart' && (
                                                <div style={{ display: 'grid', gap: '6px' }}>
                                                    <span className="nav-profile-label">Payment Style</span>
                                                    <div className="nav-profile-row">
                                                        <button type="button" className="dropdown-action-item sub-item" style={{ flex: 1, justifyContent: 'center', background: smartCartPaymentStyle === 'inline' ? '#eff6ff' : 'transparent', color: smartCartPaymentStyle === 'inline' ? 'var(--primary)' : 'var(--text-main)' }} onClick={() => setSmartCartPaymentStyle('inline')}>Inline Payment</button>
                                                        <button type="button" className="dropdown-action-item sub-item" style={{ flex: 1, justifyContent: 'center', background: smartCartPaymentStyle === 'modal' ? '#eff6ff' : 'transparent', color: smartCartPaymentStyle === 'modal' ? 'var(--primary)' : 'var(--text-main)' }} onClick={() => setSmartCartPaymentStyle('modal')}>Payment Modal</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="nav-profile-divider" />
                                        <div 
                                            className="dropdown-action-item nav-profile-submenu-trigger" 
                                            onMouseEnter={() => setIsListStyleOpen(true)}
                                            onMouseLeave={() => setIsListStyleOpen(false)}
                                            style={{ cursor: 'default' }}
                                        >
                                            <span style={{ fontSize: '12px', color: 'inherit' }}>List Style</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'inherit' }}>
                                                <span className="nav-profile-value">{cardStyle === 'list' ? 'List' : cardStyle === 'small' ? 'Small' : cardStyle === 'medium' ? 'Medium' : 'Large'}</span>
                                                <ChevronRight size={14} color="currentColor" />
                                            </div>
                                            
                                            {isListStyleOpen && (
                                                <div className="nav-profile-submenu">
                                                    {[
                                                        { label: 'List Style', val: 'list', pix: true, Icon: List },
                                                        { label: 'Small Card', val: 'small', pix: true, Icon: LayoutGrid },
                                                        { label: 'Medium Card', val: 'medium', pix: true, Icon: LayoutGrid },
                                                        { label: 'Large Card', val: 'large', pix: true, Icon: LayoutGrid },
                                                        { label: 'S (No Picture)', val: 'small', pix: false, Icon: ImageOff },
                                                        { label: 'M (No Picture)', val: 'medium', pix: false, Icon: ImageOff },
                                                        { label: 'L (No Picture)', val: 'large', pix: false, Icon: ImageOff },
                                                    ].map((opt) => (
                                                        <button 
                                                            key={`${opt.val}_${opt.pix}`}
                                                            type="button" 
                                                            className="dropdown-action-item sub-item" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const handleStyleChange = () => {
                                                                    setCardStyle(opt.val as CardStyle);
                                                                    setShowPictures(opt.pix);
                                                                    localStorage.setItem('pos_card_style', opt.val);
                                                                    localStorage.setItem('pos_show_pictures', String(opt.pix));
                                                                    setIsActionsOpen(false);
                                                                    setIsListStyleOpen(false);
                                                                };
                                                                handleStyleChange();
                                                            }}
                                                            style={{ 
                                                                background: (cardStyle === opt.val && showPictures === opt.pix) ? '#f1f5f9' : 'transparent',
                                                                fontSize: '11px',
                                                                padding: '6px 12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                color: (cardStyle === opt.val && showPictures === opt.pix) ? 'var(--primary)' : 'var(--text-main)',
                                                                borderLeft: (cardStyle === opt.val && showPictures === opt.pix) ? '3px solid var(--primary)' : '3px solid transparent',
                                                                fontWeight: (cardStyle === opt.val && showPictures === opt.pix) ? 700 : 500,
                                                            }}
                                                        >
                                                            <opt.Icon size={14} style={{ opacity: (cardStyle === opt.val && showPictures === opt.pix) ? 1 : 0.6 }} />
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </nav>

                    <div className="workspace">
                        <div className="workspace-main">
                            <div className="sub-nav">
                                <div className="order-types">
                                    <button
                                        type="button"
                                        className={`icon-action-btn ${showSidebar ? '' : 'active-red'}`}
                                        onClick={() => setShowSidebar((current) => !current)}
                                        title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
                                        aria-label={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
                                        aria-pressed={!showSidebar}
                                    >
                                        <PanelLeft size={16} />
                                    </button>
                                    <button type="button" className="btn-pill btn-green" onClick={() => { setOrderMode('dine_in'); openOrdersModal('Dine-In Orders', 'dine_in'); }}>Dine-In <span className="badge">{stats.dineIn}</span></button>
                                    <button type="button" className="btn-pill btn-purple" onClick={() => { setOrderMode('takeout'); openOrdersModal('Take-away Orders', 'takeout'); }}>Take-away <span className="badge">{stats.takeaway}</span></button>
                                    <button type="button" className="btn-pill btn-blue" onClick={() => { setOrderMode('delivery'); openOrdersModal('Delivery Orders', 'delivery'); }}>Delivery <span className="badge">{stats.delivery}</span></button>
                                </div>
                                <div className="sub-nav-search-area">
                                    <div className="order-search">
                                        <Search size={14} />
                                        <input 
                                            type="text" 
                                            placeholder="Search items..." 
                                            value={searchTerm} 
                                            onChange={(event) => setSearchTerm(event.target.value)} 
                                        />
                                    </div>
                                    <div className="order-search">
                                        <Search size={14} />
                                        <input 
                                            type="text" 
                                            placeholder="Order No..." 
                                            value={searchOrderNo} 
                                            onChange={(event) => setSearchOrderNo(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    submitOrderSearch();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="order-stats-inline">
                                    <button type="button" className="stat-pill" onClick={() => openOrdersModal("Today's Orders", 'today')}>
                                        <History size={12} /> Today: {stats.todayOrders}
                                    </button>
                                    <button type="button" className="stat-pill status-kitchen" onClick={() => openOrdersModal('Orders in Kitchen', 'kitchen')}>
                                        <Ticket size={12} /> Kitchen: {stats.inKitchen}
                                    </button>
                                    <button type="button" className="stat-pill status-unpaid" onClick={() => openOrdersModal('Unpaid Orders', 'unpaid')}>
                                        <AlertTriangle size={12} /> Unpaid: {stats.unpaid}
                                    </button>
                                    <button type="button" className="stat-pill status-unpaid" onClick={() => openOrdersModal('Credited Orders', 'credited')}>
                                        <CreditCard size={12} /> Credit: {stats.credited}
                                    </button>
                                    <button type="button" className="stat-pill status-closed" onClick={() => openOrdersModal('Closed Orders', 'closed')}>
                                        <ClipboardList size={12} /> Closed: {stats.closed}
                                    </button>
                                    <button type="button" className="stat-pill status-closed" onClick={() => { setShowAdvancedOrderFilters(true); openOrdersModal('Returned Order List', 'returned', { preserveSearch: true }); }}>
                                        <RotateCcw size={12} /> Returns: {stats.returned}
                                    </button>
                                    <div className="stat-divider" />
                                    <button 
                                        type="button" 
                                        className="icon-action-btn"
                                        onClick={() => setShowFavoritesOnly((current) => !current)}
                                        title={showFavoritesOnly ? 'Favorites Only' : 'Show Favorites'}
                                        aria-pressed={showFavoritesOnly}
                                    >
                                        <Heart size={16} fill={showFavoritesOnly ? '#ef4444' : 'none'} color={showFavoritesOnly ? '#ef4444' : 'currentColor'} />
                                    </button>
                                    <div className="stat-pill-occupied" title="Busy (Occupied) Tables">
                                        <LayoutGrid size={14} /> {`${stats.occupiedTables}/${stats.totalTables}`}
                                    </div>
                                </div>
                            </div>

                            <div className={`recent-orders-bar ${showRecentOrdersBar ? '' : 'recent-orders-bar-collapsed'}`}>
                                {showRecentOrdersBar ? (
                                    <>
                                        <div className="recent-orders-bar-label">
                                            <History size={13} />
                                            <span>Last 7</span>
                                        </div>
                                        <div className="recent-orders-list">
                                            {recentOrderBarOrders.length > 0 ? recentOrderBarOrders.map((order) => {
                                                const isActiveRecentOrder = activeOrderId !== null && Number(order.id) === Number(activeOrderId);
                                                return (
                                                    <button
                                                        key={order.id}
                                                        type="button"
                                                        className={`recent-order-chip recent-order-chip-${getRecentOrderChipTone(order.order_type)} ${isActiveRecentOrder ? 'active' : ''}`}
                                                        onClick={() => hydrateOrderIntoCart(order, { closeModal: false })}
                                                        title={`Load ${formatVisibleOrderNumber(order.order_number || order.id)}`}
                                                    >
                                                        <strong>{formatVisibleOrderNumber(order.order_number || order.id)}</strong>
                                                        <small>{formatMoney(Number(order.total_amount || 0))}</small>
                                                    </button>
                                                );
                                            }) : (
                                                <span className="recent-orders-empty">No recent orders</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="recent-orders-toggle"
                                            onClick={() => setShowRecentOrdersBar(false)}
                                        >
                                            Hide
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="recent-orders-show"
                                        onClick={() => setShowRecentOrdersBar(true)}
                                    >
                                        <History size={13} />
                                        Show last 7 orders
                                    </button>
                                )}
                            </div>

                            <div className="workspace-body">
                                {showSidebar && (
                                <aside className="sidebar">


                            <div
                                className="cat-header"
                                style={{ borderTop: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer' }}
                                onClick={() => setIsPriceProfileCollapsed((current) => !current)}
                                role="button"
                                aria-expanded={!isPriceProfileCollapsed}
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setIsPriceProfileCollapsed((current) => !current);
                                    }
                                }}
                            >
                                <span>Price Profile</span>
                                {isPriceProfileCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </div>
                            <div className="categories-list" style={{ flex: 'none', display: isPriceProfileCollapsed ? 'none' : undefined }}>
                                {PriceProfiles.map((PriceProfile) => (
                                    <div key={PriceProfile} className={`cat-item ${selectedPriceProfile === PriceProfile ? 'active' : ''}`} onClick={() => setSelectedPriceProfile(PriceProfile)} style={{ marginBottom: '2px' }}>
                                        <span>{selectedPriceProfile === PriceProfile ? '✓ ' : ''}{PriceProfile}</span>
                                        <span>{PriceProfile === 'All' ? products.length : PriceProfileCountMap[PriceProfile] || 0}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 16px' }} />

                            <div className="cat-header">Food Category</div>
                            <div className="categories-list">
                                {categories.map((category) => (
                                    <div key={category} className={`cat-item ${selectedCategory === category ? 'active' : ''}`} onClick={() => setSelectedCategory(category)}>
                                        <span>{selectedCategory === category ? '🍴 ' : ''}{category}</span>
                                        <span>{category === 'All' ? filteredProducts.length : categoryCountMap[category] || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </aside>
                        )}

                        <main className="product-area">
                            {isCatalogLoading ? (
                                <div className={styles.emptyCatalog}><Loader2 size={30} className={styles.spinner} /><p>Loading live menu...</p></div>
                            ) : filteredProducts.length === 0 ? (
                                <div className={styles.emptyCatalog}><h3>No products available</h3><p>Adjust the Price Profile, category, or search term to find synced branch items.</p></div>
                            ) : (
                                <div className={`grid grid-${cardStyle}`}>
                                    {filteredProducts.map((product) => {
                                        const productId = resolveCartProductId(product);
                                        const qtyInCart = effectiveCart
                                            .filter((item) => resolveCartProductId(item) === productId)
                                            .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                                        const favorite = favoriteIds.includes(product.id);
                                        return (
                                            <div
                                                key={product.id}
                                                className={`prod-card card-${cardStyle} ${!showPictures ? 'no-pic' : ''} ${!ready || !canOperatePos ? 'card-disabled' : ''}`}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => ready && canOperatePos && addToCart(product)}
                                                onKeyDown={(event) => {
                                                    if ((event.key === 'Enter' || event.key === ' ') && ready && canOperatePos) {
                                                        event.preventDefault();
                                                        addToCart(product);
                                                    }
                                                }}
                                            >
                                                {showPictures && (
                                                    <div className="prod-img-box">
                                                        {product.image ? <img src={product.image} className="prod-img" alt={product.name} /> : <div className="prod-fallback">{product.name.slice(0, 2).toUpperCase()}</div>}
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id); }} className="fav-btn-clean" style={{ color: favorite ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                            {favorite ? '❤' : '♡'}
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="prod-info">
                                                    {!showPictures && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id); }} className="fav-btn-clean" style={{ position: 'static', color: favorite ? 'var(--danger)' : 'var(--text-muted)' }}>{favorite ? '❤' : '♡'}</button>
                                                            <span className="prod-menu-type">{product.PriceProfile}</span>
                                                        </div>
                                                    )}
                                                    <div className="prod-title" style={{ fontSize: !showPictures ? '11px' : undefined }}>{product.name}</div>
                                                    <div className="prod-desc" style={{ display: 'none' }}>{product.category}</div>
                                                    <div className="prod-footer">
                                                        <div className="prod-price">{formatMoney(product.price)}<span className="pc-label">/{product.unitLabel}</span></div>
                                                        <div className="qty-controls" onClick={(event) => event.stopPropagation()}>
                                                            <button type="button" className="qty-btn" style={{ color: 'var(--danger)' }} onClick={(event) => { event.stopPropagation(); void (loadedOrderIsExisting ? decrementExistingProduct(productId) : updateQuantity(productId, -1)); }}><Minus size={12} /></button>
                                                            <div className="qty-val">{qtyInCart}</div>
                                                            <button type="button" className="qty-btn" style={{ color: 'var(--success)' }} onClick={(event) => { event.stopPropagation(); addToCart(product); }}><Plus size={12} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                                </main>
                            </div>
                        </div>
                    </div>

                        <div className="resizer" onMouseDown={startResizing} title={isCartLocked ? 'Cart size is locked' : 'Drag to resize cart'} style={{ cursor: isCartLocked ? 'default' : 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <div onClick={() => setIsCartLocked((current) => !current)} style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'white', border: '1px solid var(--border-color)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 30 }} title={isCartLocked ? 'Unlock cart width' : 'Lock cart width'}>
                                {isCartLocked ? '🔒' : '📌'}
                            </div>
                        </div>

                        {posLayout === 'smart_cart' ? renderSmartCartPanel() : (
                        <aside className="cart-panel">
                            <div className="cart-order-strip">
                                <div className="cart-order-meta">
                                    <div className="cart-order-caption">{orderNumberCaption}</div>
                                    {activeOrderPlacedLabel && (
                                        <div className="cart-order-items">
                                            Placed {activeOrderPlacedLabel}{activeOrderElapsedLabel ? ` | ${activeOrderElapsedLabel}` : ''}
                                        </div>
                                    )}
                                </div>
                                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '24px' }}>
                                    <div className="cart-order-value">{orderNumberLabel}</div>
                                    {activeOrderId && (
                                        <button 
                                            type="button" 
                                            className="kitchen-button-text" 
                                            title="View History"
                                            aria-label="View History"
                                            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', padding: '2px', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.82 }}
                                            onClick={() => {
                                                setAuditOrderId(activeOrderId);
                                                setAuditOrderNo(activeOrderNumber || String(activeOrderId));
                                                setIsOrderAuditOpen(true);
                                            }}
                                        >
                                            <History size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="cart-top-forms">
                                <div className="input-group customer-input-group" style={{ position: 'relative' }}>
                                    <label>Customer</label>
                                    <div className="inline-field">
                                        <select
                                            className="form-select"
                                            value={selectedCustomer ? String(selectedCustomer.id) : ''}
                                            onChange={(event) => {
                                                const nextId = Number(event.target.value || 0);
                                                const nextCustomer = allCustomers.find((entry: any) => Number(entry.id) === nextId) || null;
                                                setSelectedCustomer(nextCustomer);
                                            }}
                                        >
                                            <option value="">Walk-in Customer</option>
                                            {allCustomers.map((customer: any) => (
                                                <option key={customer.id} value={customer.id}>
                                                    {customer.name}{customer.phone_number ? ` | ${customer.phone_number}` : ''}{customer.customer_code ? ` | ${customer.customer_code}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <button type="button" className="inline-lookup-btn" onClick={() => openCustomerSearchModal()} title="Search customer"><UserSearch size={12} /></button>
                                    </div>
                                    {selectedCustomer && (
                                        <div className="inline-note" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                            {selectedCustomer?.name || 'Registered Customer'} | {selectedCustomer?.phone_number || '-'} | {Number(selectedCustomer?.loyalty_points ?? 0)} pts
                                        </div>
                                    )}
                                </div>
                                <div className="input-group order-taker-input-group">
                                    <label>Server</label>
                                    <select className="form-select" value={selectedOrderTakerId ? String(selectedOrderTakerId) : ''} onChange={(event) => setSelectedOrderTakerId(event.target.value ? Number(event.target.value) : null)}>
                                        <option value="">Select server / cashier</option>
                                        {orderTakers.map((orderTaker: any) => (
                                            <option key={orderTaker.id} value={orderTaker.id}>
                                                {orderTaker.full_name}{orderTaker.employee_id ? ` | ${orderTaker.employee_id}` : ''}{orderTaker.designation_name ? ` | ${orderTaker.designation_name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="inline-note">Required for credit orders.</div>
                                </div>
                                <div className="input-group">
                                    <label>Table</label>
                                    <select className="form-select" value={selectedTableId ? String(selectedTableId) : ''} onChange={(event) => setSelectedTableId(event.target.value ? Number(event.target.value) : null)} disabled={orderMode !== 'dine_in'}>
                                        <option value="">{orderMode === 'dine_in' ? 'Select table' : 'Not required'}</option>
                                        {branchTables.map((table: any) => <option key={table.id} value={table.id}>{table.table_number} ({table.status})</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Order Type</label>
                                    <select
                                        className="form-select"
                                        value={orderMode}
                                        onChange={(event) => {
                                            const nextOrderMode = event.target.value as OrderMode;
                                            setOrderMode(nextOrderMode);
                                            if (nextOrderMode === 'delivery') {
                                                setIsDeliveryInfoModalOpen(true);
                                            }
                                        }}
                                    >
                                        <option value="dine_in">Dine-In</option>
                                        <option value="takeout">Take-away</option>
                                        <option value="delivery">Delivery</option>
                                    </select>
                                </div>
                            </div>

                            <div className="cart-table-wrapper">
                                <div className="cart-scroll">
                                    <table className="cart-table">
                                        <thead>
                                            <tr>
                                                <th style={{ fontSize: '14px', width: '7%' }}>Sr.#</th>
                                                <th style={{ fontSize: '14px', width: '38%' }}>Item</th>
                                                <th className="text-right" style={{ fontSize: '14px', width: '20%' }}>Price</th>
                                                <th className="text-center" style={{ fontSize: '14px', width: '15%' }}>Qty</th>
                                                <th className="text-right" style={{ fontSize: '14px', width: '20%' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.length > 0 ? cart.map((item, index) => {
                                                const changeState = loadedOrderIsExisting ? getCartLineChangeState(item) : 'unchanged';
                                                const itemAccent = changeState === 'new'
                                                    ? '#2563eb'
                                                    : item.isDeleted
                                                        ? 'var(--danger)'
                                                        : undefined;
                                                const qtyAccent = changeState === 'decrease'
                                                    ? 'var(--danger)'
                                                    : changeState === 'increase'
                                                        ? 'var(--success)'
                                                        : changeState === 'new'
                                                            ? '#2563eb'
                                                            : 'var(--text-primary)';
                                                const qtyBackground = changeState === 'decrease'
                                                    ? 'rgba(239, 68, 68, 0.08)'
                                                    : changeState === 'increase'
                                                        ? 'rgba(16, 185, 129, 0.08)'
                                                        : changeState === 'new'
                                                            ? 'rgba(37, 99, 235, 0.08)'
                                                            : 'white';

                                                return (
                                                <tr className={`cart-row ${item.isDeleted ? 'cart-row-deleted' : ''}`} key={item.lineKey}>
                                                    <td className="text-center" style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{index + 1}</td>
                                                    <td style={{ fontWeight: 500, color: itemAccent }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                                                            <span className={item.isDeleted ? 'cart-line-text-deleted' : ''}>{item.name}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => { e.stopPropagation(); setActiveNoteItemId(activeNoteItemId === item.lineKey ? null : item.lineKey); }} 
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.note ? 'var(--primary)' : 'var(--text-muted)' }}
                                                                title="Add/Edit Note"
                                                                disabled={Boolean(item.isDeleted)}
                                                            >
                                                                <MessageSquare size={13} />
                                                            </button>
                                                        </div>
                                                        {(activeNoteItemId === item.lineKey || item.note) && !item.isDeleted && (
                                                            <input
                                                                type="text"
                                                                className="cart-note-input"
                                                                placeholder="Add note..."
                                                                value={item.note || ''}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => updateItemNote(loadedOrderIsExisting ? item.lineKey : item.id, e.target.value)}
                                                                onBlur={() => { if (!item.note) setActiveNoteItemId(null); }}
                                                                autoFocus={activeNoteItemId === item.lineKey && !item.note}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="text-right">
                                                        <input
                                                            type="number"
                                                            className="cart-price-input"
                                                            value={item.price}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => updateItemPrice(loadedOrderIsExisting ? item.lineKey : item.id, e.target.value)}
                                                            disabled={Boolean(item.isDeleted)}
                                                        />
                                                    </td>
                                                    <td className="text-center">
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                            <button type="button" className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }} onClick={() => updateQuantity(loadedOrderIsExisting ? item.lineKey : item.id, -1)}>-</button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                value={item.quantity}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => setLineQuantity(loadedOrderIsExisting ? item.lineKey : item.id, e.target.value)}
                                                                disabled={Boolean(item.isDeleted)}
                                                                style={{
                                                                    width: '52px',
                                                                    textAlign: 'center',
                                                                    fontWeight: 700,
                                                                    color: qtyAccent,
                                                                    border: `1px solid ${changeState === 'unchanged' ? 'var(--border-color)' : qtyAccent}`,
                                                                    borderRadius: '8px',
                                                                    padding: '4px 6px',
                                                                    background: qtyBackground,
                                                                }}
                                                                className={item.isDeleted ? 'cart-line-text-deleted' : ''}
                                                            />
                                                            <button type="button" className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }} onClick={() => updateQuantity(loadedOrderIsExisting ? item.lineKey : item.id, 1)}>+</button>
                                                        </div>
                                                    </td>
                                                    <td className={`text-right ${item.isDeleted ? 'cart-line-text-deleted' : ''}`} style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                                        {formatCartAmount(item.price * item.quantity)}
                                                        <button type="button" className="cart-del-btn" title="Remove Item" style={{ marginLeft: '8px' }} onClick={() => removeFromCart(loadedOrderIsExisting ? item.lineKey : item.id)}>
                                                            <X size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}) : (
                                                [1, 2, 3, 4, 5].map((index) => (
                                                    <tr key={index} className="cart-row placeholder-row">
                                                        <td colSpan={5} style={{ height: '42px', borderBottom: '1px solid #f1f5f9' }} />
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="order-comments-wrap">
                                    <textarea className="remarks-input" placeholder="Add special instructions / Order Remarks..." rows={2} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} />
                                    {effectiveCart.length > 0 && (
                                        <div className="cart-item-summary">
                                            <span>Total Products: {effectiveCart.length}</span>
                                            <span>|</span>
                                            <span>Total Items: {cartItemCount}</span>
                                        </div>
                                    )}
                                </div>

                                <div className={`order-summary ${styles.classicPaymentSummary}`} style={{ flexShrink: 0, paddingBottom: '12px' }}>
                                    <div className={styles.classicSummaryTop}>
                                        <div className={styles.classicSummaryTitleWrap}>
                                            <strong className={styles.classicSummaryTitle}>Payment Summary</strong>
                                            <span className={styles.classicSummaryMode}>{paymentModeLabels[paymentMode as ChargePaymentMode] || 'Payment'}</span>
                                        </div>
                                        <div className={styles.classicSummaryTools}>
                                            {orderMode === 'delivery' && (
                                                <button type="button" className={`billing-tool-btn ${styles.deliveryInfoButton}`} title="Delivery Information" onClick={() => setIsDeliveryInfoModalOpen(true)}>
                                                    <Home size={11} />
                                                    <span>Delivery Info</span>
                                                </button>
                                            )}
                                            <button type="button" className="billing-tool-btn billing-tool-voucher" title="Voucher" onClick={() => setIsVoucherModalOpen(true)}>
                                                <Ticket size={11} />
                                                <span>Voucher</span>
                                            </button>
                                            <button type="button" className="billing-tool-btn billing-tool-discount" title="Discount" onClick={() => setIsDiscountModalOpen(true)}>
                                                <BadgePercent size={11} />
                                                <span>Discount</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.classicSummaryMeta}>
                                        {appliedVoucher && <div className="mini-note">{appliedVoucher.code} saves {formatMoney(appliedVoucher.discount_amount || 0)}</div>}
                                        {(Number(discountAmount || 0) > 0 || discountApproval) && (
                                            <div className="mini-note">
                                                Discount {discountType === 'percent' ? `${discountAmount}%` : formatMoney(Number(discountAmount || 0))}
                                                {discountApproval && !needsDiscountApproval ? ` | Approved by ${discountApproval.username}` : ''}
                                            </div>
                                        )}
                                        {discountLimitAmount !== null && <div className="mini-note">Limit {formatMoney(discountLimitAmount)}</div>}
                                        {needsDiscountApproval && <div className="mini-warning"><AlertTriangle size={11} /><button type="button" className="inline-link-btn" onClick={() => setIsApprovalModalOpen(true)}>Authorize Override</button></div>}
                                    </div>

                                    <div className={styles.classicSummaryGrid}>
                                        <div className={`${styles.classicSummaryLine} ${styles.classicSummaryLineStrong}`}>
                                            <span>Total Amount</span>
                                            <strong>{formatMoney(subtotal)}</strong>
                                        </div>
                                        {effectiveManualDiscount > 0 && (
                                            <div className={styles.classicSummaryLine}>
                                                <span>Discount</span>
                                                <strong className={styles.classicSummaryNegative}>-{formatMoney(effectiveManualDiscount)}</strong>
                                            </div>
                                        )}
                                        {effectiveVoucherDiscount > 0 && (
                                            <div className={styles.classicSummaryLine}>
                                                <span>Voucher {appliedVoucher?.code ? `(${appliedVoucher.code})` : ''}</span>
                                                <strong className={styles.classicSummaryNegative}>-{formatMoney(effectiveVoucherDiscount)}</strong>
                                            </div>
                                        )}
                                        {otherChargesAmount > serviceChargeAmount && (
                                            <div className={styles.classicSummaryLine}>
                                                <span>Other Charges</span>
                                                <strong>{formatMoney(otherChargesAmount - serviceChargeAmount)}</strong>
                                            </div>
                                        )}

                                        <div className={styles.classicSummaryTaxRow}>
                                            <span>Tax / VAT</span>
                                            <div className={styles.classicSummaryTaxControls}>
                                                <select className={`form-select compact-form-select ${styles.classicCompactSelect}`} value={taxSelectionValue} onChange={(event) => setTaxSelection(event.target.value)}>
                                                    {defaultTaxCode ? <option value={defaultTaxCode}>Branch Default</option> : null}
                                                    {taxOptions.map((tax: any) => (
                                                        <option key={tax.tax_code} value={tax.tax_code}>{tax.tax_name || tax.tax_code}</option>
                                                    ))}
                                                    <option value="none">No Tax</option>
                                                </select>
                                                <span className={styles.classicSummaryTaxRate}>{isTaxDisabled ? 'No Tax' : selectedTaxRateLabel || '-'}</span>
                                                <strong>{formatMoney(taxAmount)}</strong>
                                            </div>
                                        </div>
                                        {!isTaxDisabled && selectedTaxProfile && (
                                            <div className={styles.classicSummaryTaxNote}>{selectedTaxProfile.tax_name} ({selectedTaxProfile.tax_code})</div>
                                        )}
                                    </div>

                                    <div className={styles.classicNetPayable}>
                                        <span>Net Payable</span>
                                        <strong>{formatMoney(total)}</strong>
                                    </div>

                                    <div className={styles.classicPaymentControls}>
                                        <div className={styles.classicPaymentModeRow}>
                                            <span>Payment Mode</span>
                                            <div className={styles.classicPaymentModeControls}>
                                                <select className={`form-select compact-form-select ${styles.classicCompactSelect}`} value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}>
                                                {paymentMethods
                                                    .map((method) => ({
                                                        id: method.id,
                                                        label: method.method_name,
                                                        value: paymentModeFromMethodCode(method.method_code || method.method_name),
                                                    }))
                                                    .filter((method): method is { id: number; label: string; value: ChargePaymentMode } => Boolean(method.value))
                                                    .map((method) => (
                                                        <option key={method.id} value={method.value}>{method.label}</option>
                                                    ))}
                                                <option value="split">Split Payment Mode</option>
                                                </select>
                                                {isCardPayment && (
                                                    <>
                                                        <select className={`form-select compact-form-select ${styles.classicCompactSelect}`} value={selectedCardMachineId} onChange={(event) => setSelectedCardMachineId(event.target.value)}>
                                                        <option value="">POS Machine</option>
                                                        {cardMachines.map((machine: any) => (
                                                            <option key={machine.id} value={machine.id}>{machine.machine_name}</option>
                                                        ))}
                                                        </select>
                                                        <button type="button" className="small-action-btn" onClick={() => setIsCardMachineModalOpen(true)}>Add</button>
                                                    </>
                                                )}
                                                {!isOnlinePayment && !isCardPayment && paymentMode !== 'cash' && paymentMode !== 'split' && (
                                                    <input
                                                        type="text"
                                                        className={`cash-input split-cash-input ${styles.classicCompactInput}`}
                                                        value={paymentReference}
                                                        onChange={(event) => setPaymentReference(event.target.value)}
                                                        placeholder="Reference"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {isOnlinePayment && (
                                            <div className={styles.classicPaymentFieldGrid}>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Sender</span>
                                                    <input type="text" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={onlinePaymentDetails.sender_name} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, sender_name: event.target.value }))} placeholder="Sender name" />
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Source Bank</span>
                                                    <input type="text" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={onlinePaymentDetails.source_bank} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, source_bank: event.target.value }))} placeholder="Source bank" />
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Destination</span>
                                                    <input type="text" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={onlinePaymentDetails.destination_bank} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, destination_bank: event.target.value }))} placeholder="Destination bank" />
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Txn No.</span>
                                                    <input type="text" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={onlinePaymentDetails.transaction_no} onChange={(event) => setOnlinePaymentDetails((current) => ({ ...current, transaction_no: event.target.value }))} placeholder="Transaction No." />
                                                </div>
                                            </div>
                                        )}

                                        {isCardPayment && selectedCardMachine && (
                                            <div className="mini-note">
                                                {selectedCardMachine.service_provider} | PID {selectedCardMachine.pid_number} | MID {selectedCardMachine.mid_number}
                                            </div>
                                        )}

                                        {paymentMode === 'split' && (
                                            <div className={styles.classicPaymentFieldGrid}>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Split Cash</span>
                                                    <input type="number" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={splitCashAmount} onChange={(event) => setSplitCashAmount(event.target.value)} placeholder="0.00" />
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Second Mode</span>
                                                    <select className={`form-select compact-form-select ${styles.classicCompactSelect}`} value={splitSecondaryMode} onChange={(event) => setSplitSecondaryMode(event.target.value as ChargePaymentMode)}>
                                                        {paymentMethods
                                                            .map((method) => ({
                                                                id: method.id,
                                                                label: method.method_name,
                                                                value: paymentModeFromMethodCode(method.method_code || method.method_name),
                                                            }))
                                                            .filter((method): method is { id: number; label: string; value: ChargePaymentMode } => Boolean(method.value) && method.value !== 'cash')
                                                            .map((method) => (
                                                                <option key={method.id} value={method.value}>{method.label}</option>
                                                            ))}
                                                    </select>
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Second Amount</span>
                                                    <strong className={styles.classicPaymentReadout}>{formatMoney(splitSecondaryAmount)}</strong>
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Reference</span>
                                                    <input type="text" className={`cash-input split-cash-input ${styles.classicCompactInput}`} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Slip / Txn #" />
                                                </div>
                                            </div>
                                        )}

                                        {paymentMode === 'cash' && (
                                            <div className={styles.classicCashRow}>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Cash Received</span>
                                                    <input type="text" className={`cash-input ${styles.classicCompactInput}`} value={cashReceivedAmount} onChange={(event) => setCashReceivedAmount(event.target.value)} placeholder="0.00" />
                                                </div>
                                                <div className={styles.classicPaymentField}>
                                                    <span>Change Return</span>
                                                    <strong className={styles.classicPaymentReadout}>{formatMoney(changeReturn)}</strong>
                                                </div>
                                                {cashShortfall > 0 && (
                                                    <div className={`${styles.classicPaymentField} ${styles.classicPaymentShort}`}>
                                                        <span>Short Amount</span>
                                                        <strong className={styles.classicSummaryNegative}>{formatMoney(cashShortfall)}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                    <div className="action-rows">
                                        <div className="action-row action-row-two">
                                        <button type="button" className="action-btn btn-kitchen" disabled={effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos} onClick={() => void sendToKitchen()}><Ticket size={16} />Send To Kitchen</button>
                                        <button type="button" className="action-btn btn-pay" disabled={effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos} onClick={() => void payNow(activeOrderId || undefined, activeOrderNumber)}><CreditCard size={16} />Payment</button>
                                    </div>
                                    <div className="action-row action-row-three">
                                        <button type="button" className="action-btn btn-credit" disabled={effectiveCart.length === 0 || isSubmitting || !ready || !canOperatePos} onClick={() => void creditOrder()}><CreditCard size={16} />Credit Payment</button>
                                        <button type="button" className="action-btn btn-print" onClick={openBillPreview}><Printer size={16} />Print Bill</button>
                                        <button type="button" className="action-btn btn-clear" onClick={clearCurrentOrder}><Trash2 size={16} />Clear Cart</button>
                                    </div>
                                    <div className="action-row action-row-two action-row-compact">
                                        <button type="button" className="secondary-inline-btn" disabled={!loadedOrderIsExisting || !hasDraftChanges || isSubmitting} onClick={discardLoadedOrderChanges}>Discard Changes</button>
                                        {canCancelOrder && (
                                            <button
                                                type="button"
                                                className="secondary-inline-btn btn-void"
                                                disabled={!activeOrderId || isSubmitting || !ready || !canOperatePos || !isInProgressOrder({ order_status: activeOrderStatus, payment_status: 'unpaid' })}
                                                onClick={() => {
                                                    setCancelOrderReason('');
                                                    setCancelOrderApprovalUsername('');
                                                    setCancelOrderApprovalPin('');
                                                    setIsCancelOrderOpen(true);
                                                }}
                                            >
                                                Void Order
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </aside>
                        )}
                    </div>
                </div>

            {isOrderSetupModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsOrderSetupModalOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.smartSetupModalWide}`} onClick={(event) => event.stopPropagation()}>
                        <div className={`${styles.modalHeader} ${styles.smartSetupModalHeader}`}>
                            <div className={styles.smartSetupModalHeaderCopy}>
                                <div className={styles.smartSetupModalEyebrow}>Cashier Workflow</div>
                                <h2 className={styles.smartSetupModalTitle}>Order Setup</h2>
                                <p className={styles.smartSetupModalSubtitle}>Assign operator, service mode, customer, and table in one controlled setup flow.</p>
                            </div>
                            <button type="button" className={`${styles.modalClose} ${styles.smartSetupModalClose}`} onClick={() => setIsOrderSetupModalOpen(false)}>
                                <X size={14} />
                            </button>
                        </div>

                        <div className={styles.smartSetupNavShell}>
                            <div className={styles.smartSetupNav}>
                                {([
                                    ['server', '01', 'Server / Order Taker'],
                                    ['order_type', '02', 'Order Type'],
                                    ['customer', '03', 'Customer'],
                                    ['table', '04', 'Table'],
                                ] as Array<[OrderSetupSection, string, string]>).map(([section, index, label]) => (
                                    (() => {
                                        const isCompleted =
                                            section === 'server'
                                                ? Boolean(selectedOrderTakerId)
                                                : section === 'order_type'
                                                    ? Boolean(orderMode)
                                                    : section === 'customer'
                                                        ? orderMode === 'delivery' || Boolean(selectedCustomer) || orderMode === 'dine_in'
                                                        : orderMode !== 'dine_in' || Boolean(selectedTableId);

                                        return (
                                            <button
                                                key={section}
                                                type="button"
                                                className={`${styles.smartSetupNavTab} ${orderSetupSection === section ? styles.smartSetupNavTabActive : ''} ${isCompleted ? styles.smartSetupNavTabDone : ''}`}
                                                onClick={() => setOrderSetupSection(section)}
                                            >
                                                <span className={styles.smartSetupNavIndex}>
                                                    {isCompleted ? <span className={styles.smartSetupNavCheck}>✓</span> : index}
                                                </span>
                                                <span className={styles.smartSetupNavText}>
                                                    <span className={styles.smartSetupNavLabel}>{label}</span>
                                                    <span className={styles.smartSetupNavValue}>{orderSetupTabSummaries[section].value}</span>
                                                    <span className={styles.smartSetupNavMeta}>{orderSetupTabSummaries[section].meta}</span>
                                                </span>
                                            </button>
                                        );
                                    })()
                                ))}
                            </div>
                        </div>

                        <div className={styles.smartSetupLayout}>
                            <div className={styles.smartSelectionArea}>
                                {orderSetupSection === 'server' && (
                                    <section className={styles.smartSetupSectionPanel}>
                                        <div className={styles.smartSetupSectionHeader}>
                                            <div className={styles.smartSetupSectionLead}>
                                                <strong className={styles.smartSetupSectionTitle}>Server / Order Taker</strong>
                                                <span className={styles.smartSetupSectionHint}>Choose the primary operator. Selection advances to Order Type.</span>
                                            </div>
                                            <span className={styles.smartSetupSectionBadge}>{orderTakers.length} available</span>
                                        </div>
                                        <div className={styles.contactGrid}>
                                            {orderTakers.map((ot: any) => (
                                                <button
                                                    key={ot.id}
                                                    type="button"
                                                    className={`${styles.contactCard} ${selectedOrderTakerId === ot.id ? styles.contactCardActive : ''}`}
                                                    onClick={() => {
                                                        setSelectedOrderTakerId(ot.id);
                                                        setOrderSetupSection('order_type');
                                                    }}
                                                >
                                                    <div className={styles.contactAvatar}>
                                                        {ot.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || <User size={18} />}
                                                    </div>
                                                    <div className={styles.contactInfo} style={{ textAlign: 'left' }}>
                                                        <div className={styles.contactName}>{ot.full_name}</div>
                                                        <div className={styles.contactRole}>{ot.designation_name || 'Staff'}</div>
                                                        <div className={styles.contactMeta}>{ot.employee_id ? `ID ${ot.employee_id}` : 'Official staff'}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {orderSetupSection === 'order_type' && (
                                    <section className={styles.smartSetupSectionPanel}>
                                        <div className={styles.smartSetupSectionHeader}>
                                            <div className={styles.smartSetupSectionLead}>
                                                <strong className={styles.smartSetupSectionTitle}>Order Type</strong>
                                                <span className={styles.smartSetupSectionHint}>Set the service channel. Selection advances to Customer.</span>
                                            </div>
                                            <span className={styles.smartSetupSectionBadge}>Quick select</span>
                                        </div>
                                        <div className={styles.smartSetupChooser}>
                                            {(['dine_in', 'takeout', 'delivery'] as OrderMode[]).map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    className={`${styles.smartChoiceCard} ${orderMode === mode ? styles.smartChoiceCardActive : ''}`}
                                                    onClick={() => {
                                                        setOrderMode(mode);
                                                        if (mode === 'delivery') setDeliveryOrderForm((current) => ({ ...current, payment_term: current.payment_term || 'paid' }));
                                                        setOrderSetupSection('customer');
                                                    }}
                                                >
                                                    <strong>{orderModeMeta[mode]}</strong>
                                                    <span>{mode === 'delivery' ? 'Address, rider, and payment status' : 'Fast standard service flow'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {orderSetupSection === 'customer' && (
                                    <section className={styles.smartSetupSectionPanel}>
                                        <div className={styles.smartSetupSectionHeader}>
                                            <div className={styles.smartSetupSectionLead}>
                                                <strong className={styles.smartSetupSectionTitle}>Customer</strong>
                                                <span className={styles.smartSetupSectionHint}>Use the quick list or search the registry. Dine-In advances to Table after selection.</span>
                                            </div>
                                            <span className={styles.smartSetupSectionBadge}>15 frequent</span>
                                        </div>

                                        <div className={styles.smartSectionScrollArea}>
                                            <div className={styles.smartSetupCustomerBoard}>
                                                <div className={styles.smartCustomerLookupStack}>
                                                    <div className={styles.smartCustomerLookupCard}>
                                                        <div className={styles.smartCustomerLookupTop}>
                                                            <div className={styles.smartField}>
                                                                <label>Global Registry Lookup</label>
                                                                <div className={`${styles.smartInlineField} ${styles.smartCustomerTools}`}>
                                                                    <select
                                                                        className={`${styles.compactInput} ${styles.smartCustomerLookupSelect}`}
                                                                        value={selectedCustomer ? String(selectedCustomer.id) : ''}
                                                                        onChange={(event) => {
                                                                            const id = Number(event.target.value || 0);
                                                                            const customer = allCustomers.find((c: any) => Number(c.id) === id) || null;
                                                                            setSelectedCustomer(customer);
                                                                            if (customer && orderMode === 'dine_in') setOrderSetupSection('table');
                                                                        }}
                                                                    >
                                                                        <option value="">Select a customer</option>
                                                                        {allCustomers.map((c: any) => (
                                                                            <option key={c.id} value={c.id}>{c.name} {c.phone_number ? `(${c.phone_number})` : ''}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button type="button" className={styles.smartLinkButton} onClick={() => openCustomerSearchModal('general')}>Lookup</button>
                                                                    <button type="button" className={styles.smartLinkButton} onClick={() => setIsCustomerCreateModalOpen(true)}>New</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {orderMode === 'delivery' && (
                                                        <div className={styles.smartDeliveryFlow}>
                                                            <div className={styles.smartMiniSectionTitle}>Delivery Logistics</div>
                                                            <div className={`${styles.smartField} ${styles.deliveryFlowField}`}>
                                                                <label>Address / Confirmation</label>
                                                                <div className={styles.deliveryFlowAddressWrap}>
                                                                    <textarea
                                                                        className={styles.deliveryFlowTextarea}
                                                                        value={deliveryOrderForm.address || selectedCustomer?.address_line_1 || ''}
                                                                        onChange={(e) => setDeliveryOrderForm(c => ({ ...c, address: e.target.value }))}
                                                                        placeholder="Street, house, building..."
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className={`${styles.smartFieldRow} ${styles.deliveryFlowFieldRow}`}>
                                                                <div className={`${styles.smartField} ${styles.deliveryFlowField}`} style={{ flex: 1.25 }}>
                                                                    <label>Rider Selection</label>
                                                                    <select
                                                                        className={`${styles.compactInput} ${styles.deliveryFlowSelect}`}
                                                                        value={deliveryOrderForm.delivery_person_user_id}
                                                                        onChange={(e) => {
                                                                            const id = e.target.value;
                                                                            const agent = codAssignableAgents.find((a: any) => String(a.id) === id);
                                                                            setDeliveryOrderForm(c => ({ ...c, delivery_person_user_id: id, delivery_person_name: agent?.full_name || agent?.user_name || c.delivery_person_name }));
                                                                        }}
                                                                    >
                                                                        <option value="">Select rider</option>
                                                                        {codAssignableAgents.map((a: any) => (
                                                                            <option key={a.id} value={a.id}>{a.full_name || a.user_name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className={`${styles.smartFieldRow} ${styles.deliveryFlowFieldRow}`}>
                                                                <div className={`${styles.smartField} ${styles.deliveryFlowField}`} style={{ flex: 1 }}>
                                                                    <label>Expected Payment</label>
                                                                    <select className={`${styles.compactInput} ${styles.deliveryFlowSelect}`} value={deliveryOrderForm.payment_term} onChange={(e) => setDeliveryOrderForm(c => ({ ...c, payment_term: e.target.value as DeliveryPaymentTerm }))}>
                                                                        <option value="paid">Pre-Paid</option>
                                                                        <option value="cod">COD</option>
                                                                    </select>
                                                                </div>
                                                                <div className={`${styles.smartField} ${styles.deliveryFlowField} ${styles.deliveryFlowChargeField}`} style={{ flex: 0.9 }}>
                                                                    <label>Charges</label>
                                                                    <div className={styles.deliveryFlowChargeValue}>{formatMoney(branchDeliveryCharge)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={styles.smartCustomerFrequentPanel}>
                                                    <div className={styles.smartMiniSectionTitle}>Frequently Used Customers</div>
                                                    <div className={styles.frequentCustomerGrid}>
                                                        <button
                                                            type="button"
                                                            className={`${styles.frequentCustomerCard} ${!selectedCustomer ? styles.contactCardActive : ''}`}
                                                            onClick={() => {
                                                                setSelectedCustomer(null);
                                                                if (orderMode === 'dine_in') setOrderSetupSection('table');
                                                            }}
                                                            style={{ textAlign: 'left' }}
                                                        >
                                                            <span className={styles.frequentCustomerName}>Walk-in Customer</span>
                                                            <span className={styles.frequentCustomerPhone}>No specific profile</span>
                                                            <span className={styles.contactMeta}>Default guest checkout</span>
                                                        </button>
                                                        {frequentCustomers.map((c: any) => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                className={`${styles.frequentCustomerCard} ${selectedCustomer?.id === c.id ? styles.contactCardActive : ''}`}
                                                                onClick={() => {
                                                                    setSelectedCustomer(c);
                                                                    if (orderMode === 'dine_in') setOrderSetupSection('table');
                                                                }}
                                                                style={{ textAlign: 'left' }}
                                                            >
                                                                <span className={styles.frequentCustomerName}>{c.name}</span>
                                                                <span className={styles.frequentCustomerPhone}>{c.phone_number || 'No phone'}</span>
                                                                <span className={styles.contactMeta}>{c.orderCount} lifetime orders</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {orderSetupSection === 'table' && (
                                    <section className={styles.smartSetupSectionPanel}>
                                        <div className={styles.smartSetupSectionHeader}>
                                            <div className={styles.smartSetupSectionLead}>
                                                <strong className={styles.smartSetupSectionTitle}>Table</strong>
                                                <span className={styles.smartSetupSectionHint}>Choose the table for dine-in orders. You can confirm immediately after selection.</span>
                                            </div>
                                            <span className={styles.smartSetupSectionBadge}>{branchTables.length} tables</span>
                                        </div>
                                        <div className={styles.tableFilterToolbar}>
                                            <div className={styles.tableFilterGroup}>
                                                <span className={styles.tableFilterLabel}>Area</span>
                                                <div className={styles.areaFilterRow}>
                                                    {tableAreas.map((area) => (
                                                        <button
                                                            key={area}
                                                            type="button"
                                                            className={`${styles.areaPill} ${tableAreaFilter === area ? styles.areaPillActive : ''}`}
                                                            onClick={() => setTableAreaFilter(area)}
                                                        >
                                                            {area}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.tableFilterGroup}>
                                                <span className={styles.tableFilterLabel}>Status</span>
                                                <div className={styles.areaFilterRow}>
                                                    {([
                                                        ['all', 'All'],
                                                        ['available', 'Available'],
                                                        ['reserved', 'Reserved'],
                                                        ['occupied', 'Occupied'],
                                                    ] as const).map(([value, label]) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            className={`${styles.areaPill} ${tableStatusFilter === value ? styles.areaPillActive : ''}`}
                                                            onClick={() => setTableStatusFilter(value)}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.tableFilterGroup}>
                                                <span className={styles.tableFilterLabel}>Minimum Capacity</span>
                                                <div className={styles.areaFilterRow}>
                                                    {([
                                                        ['all', 'Any'],
                                                        ['2', '2+'],
                                                        ['4', '4+'],
                                                        ['6', '6+'],
                                                        ['8', '8+'],
                                                    ] as const).map(([value, label]) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            className={`${styles.areaPill} ${tableCapacityFilter === value ? styles.areaPillActive : ''}`}
                                                            onClick={() => setTableCapacityFilter(value)}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.tableChoiceGrid}>
                                            {orderMode !== 'dine_in' ? (
                                                <div className={styles.smartEmptyState} style={{ gridColumn: '1 / -1' }}>Tables are only required for Dine-In orders.</div>
                                            ) : filteredSetupTables.length === 0 ? (
                                                <div className={styles.smartEmptyState} style={{ gridColumn: '1 / -1' }}>No tables match the selected filters.</div>
                                            ) : (
                                                filteredSetupTables
                                                    .map((t: any) => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            className={`${styles.tableChoiceCard} ${selectedTableId === t.id ? styles.tableChoiceCardActive : ''}`}
                                                            onClick={() => setSelectedTableId(t.id)}
                                                            style={{ textAlign: 'left' }}
                                                        >
                                                            <span className={`${styles.tableBadge} ${t.status === 'occupied' ? styles.badgeOccupied : t.status === 'reserved' ? styles.badgeReserved : styles.badgeAvailable}`}>
                                                                {t.status}
                                                            </span>
                                                            <span className={styles.tableId}>{t.table_number}</span>
                                                            <span className={styles.tableMeta}>{t.area_name} • Capacity: {t.capacity}</span>
                                                        </button>
                                                    ))
                                            )}
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className={styles.smartSetupSidebar}>
                                <div className={styles.setupSummaryCard}>
                                    <div className={styles.smartSetupSummaryHeader}>
                                        <div>
                                            <div className={styles.summarySectionTitle}>Selected Information</div>
                                            <div className={styles.smartSetupSummaryHint}>Live snapshot of the order setup you are building.</div>
                                        </div>
                                        <span className={styles.smartSetupSummaryPill}>
                                            {!selectedOrderTakerId ? 'Pending' : orderMode === 'dine_in' && !selectedTableId ? 'Incomplete' : 'Ready'}
                                        </span>
                                    </div>

                                    <div className={styles.smartSetupProgressList}>
                                        <div className={`${styles.smartSetupProgressItem} ${selectedOrderTakerId ? styles.smartSetupProgressDone : ''}`}>
                                            <span>1</span>
                                            <strong>Operator</strong>
                                        </div>
                                        <div className={`${styles.smartSetupProgressItem} ${orderMode ? styles.smartSetupProgressDone : ''}`}>
                                            <span>2</span>
                                            <strong>Mode</strong>
                                        </div>
                                        <div className={`${styles.smartSetupProgressItem} ${selectedCustomer || orderMode !== 'dine_in' ? styles.smartSetupProgressDone : ''}`}>
                                            <span>3</span>
                                            <strong>Customer</strong>
                                        </div>
                                        <div className={`${styles.smartSetupProgressItem} ${(orderMode !== 'dine_in' || selectedTableId) ? styles.smartSetupProgressDone : ''}`}>
                                            <span>4</span>
                                            <strong>Table</strong>
                                        </div>
                                    </div>

                                    <div className={styles.smartSummaryGrid}>
                                        <div className={`${styles.summaryStatus} ${styles.summaryStatusServer}`}>
                                            <span className={styles.summaryStatusTitle}>Server / Order Taker</span>
                                            <span className={styles.summaryStatusValue}>
                                                {selectedOrderTaker?.full_name || selectedOrderTaker?.user_name || 'Not assigned'}
                                            </span>
                                            <span className={styles.summaryStatusMuted}>Primary service agent</span>
                                        </div>

                                        <div className={`${styles.summaryStatus} ${styles.summaryStatusMode}`}>
                                            <span className={styles.summaryStatusTitle}>Order Mode</span>
                                            <span className={styles.summaryStatusValue}>{orderModeMeta[orderMode]}</span>
                                            <span className={styles.summaryStatusMuted}>Channel assignment</span>
                                        </div>

                                        <div className={`${styles.summaryStatus} ${styles.summaryStatusCustomer}`}>
                                            <span className={styles.summaryStatusTitle}>Customer</span>
                                            <span className={styles.summaryStatusValue}>{selectedCustomer?.name || 'Walk-in Customer'}</span>
                                            <span className={styles.summaryStatusMuted}>{selectedCustomer?.phone_number || 'No contact provided'}</span>
                                        </div>

                                        {orderMode === 'dine_in' && (
                                            <div className={`${styles.summaryStatus} ${styles.summaryStatusTable}`}>
                                                <span className={styles.summaryStatusTitle}>Table Selection</span>
                                                <span className={styles.summaryStatusValue}>
                                                    {selectedBranchTable?.table_number || 'No table selected'}
                                                </span>
                                                <span className={styles.summaryStatusMuted}>{selectedBranchTable?.area_name || 'Select from list'}</span>
                                            </div>
                                        )}

                                        {orderMode === 'delivery' && (
                                            <div className={`${styles.summaryStatus} ${styles.summaryStatusDelivery}`}>
                                                <span className={styles.summaryStatusTitle}>Delivery Logistics</span>
                                                <span className={styles.summaryStatusValue}>{deliveryOrderForm.delivery_person_name || 'Unassigned Rider'}</span>
                                                <span className={styles.summaryStatusMuted}>{deliveryOrderForm.address || 'Address pending'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.smartFooterActions}>
                            <KitchenButton variant="outline" onClick={() => setIsOrderSetupModalOpen(false)}>Back to Cart</KitchenButton>
                            <KitchenButton
                                variant="primary"
                                onClick={() => setIsOrderSetupModalOpen(false)}
                                disabled={!selectedOrderTakerId || (orderMode === 'dine_in' && !selectedTableId)}
                            >
                                Confirm Order Setup
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}


            {isSmartPaymentModalOpen && posLayout === 'smart_cart' && (
                <div className={styles.modalOverlay} onClick={() => setIsSmartPaymentModalOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.modalCardWide} ${styles.smartModalCard}`} onClick={(event) => event.stopPropagation()}>
                        <div className={`${styles.modalHeader} ${styles.smartPaymentModalHeader}`}>
                            <div>
                                <h2>Payment</h2>
                                <p>Choose payment mode, discount, voucher, and tax with full order context.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsSmartPaymentModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={`${styles.smartSetupModalLayout} ${styles.smartPaymentModalLayout}`}>
                            <div className={`${styles.smartSetupContent} ${styles.smartPaymentModalContent}`}>
                                <section className={styles.smartPaymentContextCard}>
                                    <div className={styles.smartPaymentContextHeader}>
                                        <strong>Order Details</strong>
                                    </div>
                                    <div className={styles.smartPaymentContextGrid}>
                                        <div className={styles.smartPaymentContextItem}>
                                            <span>Order No.</span>
                                            <strong>{smartOrderNumberDisplay}</strong>
                                        </div>
                                        <div className={styles.smartPaymentContextItem}>
                                            <span>Order Type</span>
                                            <strong>{orderModeMeta[orderMode]}</strong>
                                        </div>
                                        <div className={styles.smartPaymentContextItem}>
                                            <span>Server</span>
                                            <strong>{selectedOrderTaker?.full_name || selectedOrderTaker?.user_name || 'Unassigned'}</strong>
                                        </div>
                                        <div className={styles.smartPaymentContextItem}>
                                            <span>Table</span>
                                            <strong>{orderMode === 'dine_in' ? (branchTables.find((table: any) => Number(table.id) === Number(selectedTableId || 0))?.table_number || 'Not set') : 'N/A'}</strong>
                                        </div>
                                        <div className={`${styles.smartPaymentContextItem} ${styles.smartPaymentContextItemWide}`}>
                                            <span>Customer</span>
                                            <strong>{selectedCustomer?.name || 'Walk-in Customer'}</strong>
                                        </div>
                                    </div>
                                </section>
                                <section className={styles.smartPaymentSectionCard}>
                                    {renderSmartPaymentSummary(true)}
                                </section>
                            </div>
                        </div>
                        <div className={`${styles.modalActions} ${styles.smartFooterActions} ${styles.smartPaymentModalFooter}`}>
                            <KitchenButton variant="outline" onClick={() => setIsSmartPaymentModalOpen(false)}>Cancel / Back</KitchenButton>
                            <KitchenButton variant="primary" onClick={() => { setIsSmartPaymentModalOpen(false); void finalizeSmartCartPayment(); }}>Confirm Payment</KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {isOrdersOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsOrdersOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.modalCardWide}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>{ordersModalTitle || 'Recent Orders'}</h2>
                                <p>Search orders by customer, order number, return invoice number, table, order taker, order type, product, and status.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsOrdersOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.orderSearchTools}>
                            <div className={styles.orderSearchToolbar}>
                                <button type="button" className={styles.orderSearchToggle} onClick={() => setShowAdvancedOrderFilters((current) => !current)}>
                                    {showAdvancedOrderFilters ? 'Hide Search Filters' : 'Show Search Filters'}
                                </button>
                                <button type="button" className={styles.orderSearchToggle} onClick={applyAdvancedOrderSearch}>
                                    Apply Search
                                </button>
                                <button type="button" className={styles.orderSearchToggle} onClick={resetAdvancedOrderSearch}>
                                    Reset
                                </button>
                            </div>
                            {showAdvancedOrderFilters && (
                                <div className={styles.orderSearchGrid}>
                                    <input className={`${styles.compactInput} ${styles.orderSearchField}`} placeholder="Customer name / phone / ID" value={orderSearchFilters.customer} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, customer: event.target.value }))} />
                                    <input className={`${styles.compactInput} ${styles.orderSearchField}`} placeholder="Order / return invoice no." value={orderSearchFilters.orderNumber} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, orderNumber: event.target.value }))} />
                                    <input className={`${styles.compactInput} ${styles.orderSearchField}`} placeholder="Table number" value={orderSearchFilters.tableNumber} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, tableNumber: event.target.value }))} />
                                    <input className={`${styles.compactInput} ${styles.orderSearchField}`} placeholder="Order taker" value={orderSearchFilters.orderTaker} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, orderTaker: event.target.value }))} />
                                    <select className={`${styles.compactInput} ${styles.orderSearchField}`} value={orderSearchFilters.orderType} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, orderType: event.target.value as '' | OrderMode }))}>
                                        <option value="">All order types</option>
                                        <option value="dine_in">Dine-In</option>
                                        <option value="takeout">Take-away</option>
                                        <option value="delivery">Delivery</option>
                                    </select>
                                    {ordersModalFilter !== 'returned' && (
                                        <select className={`${styles.compactInput} ${styles.orderSearchField}`} value={orderSearchFilters.paymentStatus} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, paymentStatus: event.target.value }))}>
                                            <option value="">All payment states</option>
                                            <option value="credited">Credited Orders</option>
                                            <option value="unpaid">Unpaid</option>
                                            <option value="partial">Partially Paid</option>
                                            <option value="paid">Paid</option>
                                            <option value="partially_refunded">Partially Refunded</option>
                                            <option value="refunded">Refunded</option>
                                        </select>
                                    )}
                                    {ordersModalFilter !== 'returned' && (
                                        <select className={`${styles.compactInput} ${styles.orderSearchField}`} value={orderSearchFilters.orderStatus} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, orderStatus: event.target.value }))}>
                                            <option value="">All statuses</option>
                                            <option value="held">Held</option>
                                            <option value="pending">Pending</option>
                                            <option value="preparing">Preparing</option>
                                            <option value="ready">Ready</option>
                                            <option value="served">Served</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                            <option value="voided">Voided</option>
                                        </select>
                                    )}
                                    {ordersModalFilter === 'returned' && (
                                        <select className={`${styles.compactInput} ${styles.orderSearchField}`} value={orderSearchFilters.returnDatePreset} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, returnDatePreset: event.target.value as AdvancedOrderSearchFilters['returnDatePreset'] }))}>
                                            <option value="">All return dates</option>
                                            <option value="today">Today</option>
                                            <option value="this_week">This Week</option>
                                            <option value="this_month">This Month</option>
                                            <option value="date_period">Date Period</option>
                                        </select>
                                    )}
                                    {ordersModalFilter === 'returned' && orderSearchFilters.returnDatePreset === 'date_period' && (
                                        <div className={`${styles.orderSearchField} ${styles.orderSearchDateRange}`}>
                                            <input className={styles.compactInput} type="date" value={orderSearchFilters.returnDateFrom} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, returnDateFrom: event.target.value }))} />
                                            <span>to</span>
                                            <input className={styles.compactInput} type="date" value={orderSearchFilters.returnDateTo} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, returnDateTo: event.target.value }))} />
                                        </div>
                                    )}
                                    {ordersModalFilter !== 'returned' && (
                                        <input className={`${styles.compactInput} ${styles.orderSearchField}`} placeholder="Product name in order" value={orderSearchFilters.productName} onChange={(event) => setOrderSearchFilters((current) => ({ ...current, productName: event.target.value }))} />
                                    )}
                                </div>
                            )}
                        </div>
                        <div className={styles.modalList}>
                            <div className={styles.modalListToolbar}>
                                <span className={styles.modalListMeta}>Showing {pagedModalOrders.rows.length} of {pagedModalOrders.totalItems} orders</span>
                                <div className={styles.modalPagination}>
                                    <div className={styles.viewToggleGroup}>
                                        {(['line', 'grid', 'table'] as OrderListView[]).map((view) => (
                                            <button key={view} type="button" className={`${styles.viewToggle} ${orderListView === view ? styles.viewToggleActive : ''}`} onClick={() => setOrderListView(view)}>
                                                {view === 'line' ? 'Line' : view === 'grid' ? 'Grid' : 'Table'}
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button" className={styles.modalPageButton} disabled={pagedModalOrders.page <= 1} onClick={() => setOrdersModalPage((page) => Math.max(1, page - 1))}>Previous</button>
                                    <span className={styles.modalPageLabel}>Page {pagedModalOrders.page} of {pagedModalOrders.totalPages}</span>
                                    <button type="button" className={styles.modalPageButton} disabled={pagedModalOrders.page >= pagedModalOrders.totalPages} onClick={() => setOrdersModalPage((page) => Math.min(pagedModalOrders.totalPages, page + 1))}>Next</button>
                                </div>
                            </div>
                            {modalOrders.length === 0 ? (
                                <div className={styles.tillGuardWarning}>
                                    <ClipboardList size={14} />
                                    <span>No orders match the current filter or search.</span>
                                </div>
                            ) : orderListView === 'table' ? (
                                <div className={styles.orderTableWrap}>
                                    <table className={styles.orderTableCompact}>
                                        <thead>
                                            <tr>
                                                <th>Order</th>
                                                <th>Order Taker</th>
                                                <th>Customer</th>
                                                <th>Type</th>
                                                {ordersModalFilter !== 'returned' ? <th>Order Status</th> : null}
                                                {ordersModalFilter !== 'returned' ? <th>Payment</th> : null}
                                                {ordersModalFilter === 'returned' ? <th>Returned On</th> : null}
                                                <th>Placed</th>
                                                <th>Total Amount</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedModalOrders.rows.map((order) => {
                                                const normalizedOrderStatus = String(order.order_status || '').toLowerCase();
                                                const normalizedPaymentStatus = String(order.payment_status || '').toLowerCase();
                                                const orderIsClosed = ['completed', 'cancelled', 'voided'].includes(normalizedOrderStatus);
                                                const orderCanReturn = canProcessSalesReturn
                                                    && normalizedOrderStatus === 'completed'
                                                    && Number(order.remaining_refundable_amount || 0) > 0.009;
                                                const orderCanPrint = orderIsClosed
                                                    || normalizedPaymentStatus === 'paid'
                                                    || normalizedPaymentStatus === 'partial';
                                                return (
                                                    <tr key={order.id}>
                                                        <td>
                                                            <div className={styles.orderNumberInline}>
                                                                <strong>{formatVisibleOrderNumber(order.order_number || order.id)}</strong>
                                                                {resolveKotDisplayNumber(order, '') ? <span className={`${styles.orderListChip} ${styles.orderListChipInfo}`}>KOT {formatVisibleKotNumber(order, '')}</span> : null}
                                                                {order.latest_return?.return_number ? <span className={`${styles.orderListChip} ${styles.orderListChipWarning}`}>{order.latest_return.return_number}</span> : null}
                                                            </div>
                                                            {order.table_number ? <div className={styles.tableRowPrimary}>Table {order.table_number}</div> : null}
                                                        </td>
                                                        <td>
                                                            <strong>{order.order_taker_name || order.order_taker_username || 'Staff'}</strong>
                                                            {showOrderOperationalMeta ? (
                                                                <div className={styles.tableRowMeta}>{order.sale_counter_code || order.sale_counter_name || "Order Taker's App"}</div>
                                                            ) : null}
                                                        </td>
                                                        <td>
                                                            <strong>{order.customer_name || 'Walk-in Customer'}</strong>
                                                            <div className={styles.tableRowMeta}>{order.customer_phone || 'No phone saved'}</div>
                                                        </td>
                                                        <td>{orderModeMeta[normalizeOrderMode(order.order_type)]}</td>
                                                        {ordersModalFilter !== 'returned' ? <td>{formatOrderListStatus(order)}</td> : null}
                                                        {ordersModalFilter !== 'returned' ? <td>{formatOrderListPaymentStatus(order.payment_status)}</td> : null}
                                                        {ordersModalFilter === 'returned' ? <td>{formatOrderListDateTime(order.latest_return?.created_at)}</td> : null}
                                                        <td>{formatOrderListDateTime(order.created_at)}</td>
                                                        <td className={styles.tableAmountStrong}>{formatMoney(Number(order.total_amount || 0))}</td>
                                                        <td>
                                                            <div className={styles.tableActionGroup}>
                                                                {!orderIsClosed && !['cancelled', 'voided'].includes(String(order.order_status || '').toLowerCase()) && (
                                                                    <button type="button" className={`${styles.tableActionButton} ${styles.tableActionButtonPrimary}`} onClick={() => hydrateOrderIntoCart(order)}><ShoppingCart size={13} /> Load</button>
                                                                )}
                                                                {canOperatePos && String(order.order_status) === 'held' && (
                                                                    <button type="button" className={styles.tableActionButton} onClick={() => void posApi.updateOrderStatus(order.id, 'pending', selectedBranchId).then(async () => {
                                                                        await refreshPosState(selectedBranchId!);
                                                                        setIsOrdersOpen(false);
                                                                    })}>Resume</button>
                                                                )}
                                                                {orderCanPrint && (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.tableActionButton}
                                                                        onClick={() => {
                                                                            setIsOrdersOpen(false);
                                                                            setReceiptOrder(order);
                                                                        }}
                                                                    >
                                                                        <Printer size={13} /> {normalizedPaymentStatus === 'paid' || normalizedPaymentStatus === 'partially_refunded' || normalizedPaymentStatus === 'refunded' ? 'Print Receipt' : 'Print Bill'}
                                                                    </button>
                                                                )}
                                                                {orderCanReturn && (
                                                                    <button type="button" className={`${styles.tableActionButton} ${styles.tableActionButtonWarning}`} onClick={() => {
                                                                        const firstPaymentMode = paymentModeFromMethodCode(order.payments?.find((payment: any) => !payment.is_refund)?.payment_mode);
                                                                        setSalesReturnOrderId(order.id);
                                                                        setSalesReturnPaymentMode(resolveDefaultRefundPaymentMode(firstPaymentMode));
                                                                        setSalesReturnReference('');
                                                                        setSalesReturnNote('');
                                                                        setSalesReturnRestock(true);
                                                                        setIsOrdersOpen(false);
                                                                        setIsSalesReturnOpen(true);
                                                                    }}><RotateCcw size={13} /> Return</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className={orderListView === 'grid' ? styles.orderListGrid : styles.orderListLine}>
                                    {pagedModalOrders.rows.map((order) => {
                                const normalizedOrderStatus = String(order.order_status || '').toLowerCase();
                                const normalizedPaymentStatus = String(order.payment_status || '').toLowerCase();
                                const orderIsClosed = ['completed', 'cancelled', 'voided'].includes(normalizedOrderStatus);
                                const orderCanReturn = canProcessSalesReturn
                                    && normalizedOrderStatus === 'completed'
                                    && Number(order.remaining_refundable_amount || 0) > 0.009;
                                const orderCanPrint = orderIsClosed
                                    || normalizedPaymentStatus === 'paid'
                                    || normalizedPaymentStatus === 'partial';
                                const orderPlacedLabel = formatOrderListDateTime(order.created_at);
                                const orderElapsedLabel = formatOrderElapsedLabel(order.created_at, currentDateTime);
                                const orderStatusTone = getOrderListStatusTone(order);
                                return (
                                    <div key={order.id} className={`${styles.modalItem} ${styles.orderListCard} ${orderListView === 'line' ? styles.orderListCardLine : ''}`}>
                                        <div className={styles.orderListTopRow}>
                                            <div className={styles.orderListIdentity}>
                                            <strong className={styles.orderListNumber}>{formatVisibleOrderNumber(order.order_number || order.id)}</strong>
                                                {resolveKotDisplayNumber(order, '') ? <span className={`${styles.orderListChip} ${styles.orderListChipInfo}`}>KOT {formatVisibleKotNumber(order, '')}</span> : null}
                                                <div className={styles.orderListChips}>
                                                    <span className={`${styles.orderListChip} ${styles.orderListChipOutline}`}>{orderModeMeta[normalizeOrderMode(order.order_type)]}</span>
                                                    {order.table_number ? <span className={`${styles.orderListChip} ${styles.orderListChipTable}`}>Table {order.table_number}</span> : null}
                                                    {ordersModalFilter !== 'returned' ? <span className={`${styles.orderListChip} ${styles[`orderListChip${orderStatusTone.charAt(0).toUpperCase()}${orderStatusTone.slice(1)}`]}`}>{formatOrderListStatus(order)}</span> : null}
                                                    {ordersModalFilter !== 'returned' && order.payment_status ? <span className={`${styles.orderListChip} ${styles.orderListChipSoft}`}>{formatOrderListPaymentStatus(order.payment_status)}</span> : null}
                                                    {order.latest_return?.return_number ? <span className={`${styles.orderListChip} ${styles.orderListChipWarning}`}>{order.latest_return.return_number}</span> : null}
                                                </div>
                                            </div>
                                            <div className={styles.orderListAmountBlock}>
                                                <span className={styles.orderListAmountLabel}>Total</span>
                                                <div className={styles.modalAmount}>{formatMoney(Number(order.total_amount || 0))}</div>
                                            </div>
                                        </div>
                                        <div className={styles.orderListMetaGrid}>
                                            <div className={styles.orderListMetaCard}>
                                                <span className={styles.orderListMetaLabel}>Customer</span>
                                                <strong>{order.customer_name || 'Walk-in Customer'}</strong>
                                                <small>{order.customer_phone || 'No phone saved'}</small>
                                            </div>
                                            <div className={styles.orderListMetaCard}>
                                                <span className={styles.orderListMetaLabel}>Order Taker</span>
                                                <strong>{order.order_taker_name || 'Staff'}</strong>
                                                {showOrderOperationalMeta ? <small>{order.sale_counter_name || order.sale_counter_code || "Order Taker's App"}</small> : null}
                                            </div>
                                                <div className={styles.orderListMetaCard}>
                                                    <span className={styles.orderListMetaLabel}>Placed</span>
                                                    <strong>{orderPlacedLabel}</strong>
                                                    <small>{orderElapsedLabel || 'Time not available'}</small>
                                                </div>
                                                {order.latest_return?.return_number ? (
                                                    <div className={styles.orderListMetaCard}>
                                                        <span className={styles.orderListMetaLabel}>Return Invoice</span>
                                                        <strong>{order.latest_return.return_number}</strong>
                                                        <small>{formatOrderListDateTime(order.latest_return.created_at)}</small>
                                                    </div>
                                                ) : null}
                                            </div>
                                        <div className={styles.orderListItemsPreview}>{getOrderItemsPreview(order)}</div>
                                        <div className={`${styles.modalActions} ${styles.orderListActions}`}>
                                            <div className={styles.orderListActionsLeft}>
                                                {canOperatePos && !orderIsClosed && normalizeOrderMode(order.order_type) === 'dine_in' && (
                                                    <select
                                                        className={styles.inlineSelect}
                                                        defaultValue={order.table_id || ''}
                                                        onChange={(event) => void reassignHeldOrder(order.id, event.target.value ? Number(event.target.value) : undefined)}
                                                    >
                                                        <option value="">Select Table</option>
                                                        {branchTables.map((table: any) => (
                                                            <option key={table.id} value={table.id}>{table.table_number}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                {canOperatePos && String(order.order_status) === 'held' && (
                                                    <KitchenButton
                                                        variant="outline"
                                                        onClick={() => void posApi.updateOrderStatus(order.id, 'pending', selectedBranchId).then(async () => {
                                                            await refreshPosState(selectedBranchId!);
                                                            setIsOrdersOpen(false);
                                                        })}
                                                    >
                                                        Resume
                                                    </KitchenButton>
                                                )}
                                            </div>
                                            <div className={styles.orderListActionsRight}>
                                                {!orderIsClosed && !['cancelled', 'voided'].includes(String(order.order_status || '').toLowerCase()) && (
                                                    <button type="button" className={`${styles.orderActionButton} ${styles.orderActionPrimary}`} onClick={() => hydrateOrderIntoCart(order)}>
                                                        <ShoppingCart size={14} />
                                                        Load to Cart
                                                    </button>
                                                )}
                                                {orderCanPrint && (
                                                    <button
                                                        type="button"
                                                        className={styles.orderActionButton}
                                                        onClick={() => {
                                                            setIsOrdersOpen(false);
                                                            setReceiptOrder(order);
                                                        }}
                                                    >
                                                        <Printer size={14} />
                                                        {normalizedPaymentStatus === 'paid' || normalizedPaymentStatus === 'partially_refunded' || normalizedPaymentStatus === 'refunded' ? 'Print Receipt' : 'Print Bill'}
                                                    </button>
                                                )}
                                                {orderCanReturn && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.orderActionButton} ${styles.orderActionWarning}`}
                                                        onClick={() => {
                                                            const firstPaymentMode = paymentModeFromMethodCode(
                                                                order.payments?.find((payment: any) => !payment.is_refund)?.payment_mode,
                                                            );
                                                            setSalesReturnOrderId(order.id);
                                                            setSalesReturnPaymentMode(resolveDefaultRefundPaymentMode(firstPaymentMode));
                                                            setSalesReturnReference('');
                                                            setSalesReturnNote('');
                                                            setSalesReturnRestock(true);
                                                            setIsOrdersOpen(false);
                                                            setIsSalesReturnOpen(true);
                                                        }}
                                                    >
                                                        <RotateCcw size={14} />
                                                        Sales Return
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {isCancelOrderOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCancelOrderOpen(false)}>
                    <div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Void Order</h2>
                                <p>Authorized user ID and PIN are required to void this in-progress order.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCancelOrderOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Reason</label>
                            <textarea className={styles.compactInput} rows={3} value={cancelOrderReason} onChange={(event) => setCancelOrderReason(event.target.value)} placeholder="Reason for voiding this order" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Authorized User ID</label>
                            <input className={styles.compactInput} value={cancelOrderApprovalUsername} onChange={(event) => setCancelOrderApprovalUsername(event.target.value)} placeholder="User ID" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Authorized PIN</label>
                            <input className={styles.compactInput} type="password" value={cancelOrderApprovalPin} onChange={(event) => setCancelOrderApprovalPin(event.target.value)} placeholder="PIN" />
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsCancelOrderOpen(false)}>Close</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isCancelOrderSubmitting} onClick={() => void submitCancelOrder()}>Confirm Void</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isLineOverrideOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsLineOverrideOpen(false)}>
                    <div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Late Line Override</h2>
                                <p>An authorized user must approve this line-item void or quantity reduction because the branch time limit has expired.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsLineOverrideOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Reason</label>
                            <textarea className={styles.compactInput} rows={3} value={lineOverrideReason} onChange={(event) => setLineOverrideReason(event.target.value)} placeholder="Reason for late line adjustment" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Authorized User ID</label>
                            <input className={styles.compactInput} value={lineOverrideApprovalUsername} onChange={(event) => setLineOverrideApprovalUsername(event.target.value)} placeholder="User ID" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Authorized PIN</label>
                            <input className={styles.compactInput} type="password" value={lineOverrideApprovalPin} onChange={(event) => setLineOverrideApprovalPin(event.target.value)} placeholder="Authorized PIN" />
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsLineOverrideOpen(false)}>Close</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isLineOverrideSubmitting} onClick={() => void submitLineItemOverride()}>Approve And Continue</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isCardMachineModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCardMachineModalOpen(false)}>
                    <div className={`${styles.modalCardSmall} ${styles.smartSupportModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Add POS Machine</h2>
                                <p>Register the card machine for card payment selection and receipt printing.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCardMachineModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Machine Name</label>
                            <input className={styles.compactInput} value={cardMachineForm.machine_name} onChange={(event) => setCardMachineForm((current) => ({ ...current, machine_name: event.target.value }))} placeholder="Machine name" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Service Provider / Bank</label>
                            <input className={styles.compactInput} value={cardMachineForm.service_provider} onChange={(event) => setCardMachineForm((current) => ({ ...current, service_provider: event.target.value }))} placeholder="Service provider / bank" />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>PID No.</label>
                            <input className={styles.compactInput} value={cardMachineForm.pid_number} onChange={(event) => setCardMachineForm((current) => ({ ...current, pid_number: event.target.value }))} placeholder="PID No." />
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>MID No.</label>
                            <input className={styles.compactInput} value={cardMachineForm.mid_number} onChange={(event) => setCardMachineForm((current) => ({ ...current, mid_number: event.target.value }))} placeholder="MID No." />
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsCardMachineModalOpen(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isSavingCardMachine} onClick={() => void saveCardMachine()}>Save POS Machine</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isCreditCustomerModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCreditCustomerModalOpen(false)}>
                    <div className={`${styles.modalCardSmall} ${styles.creditConfirmModalCard}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Credit Customer Confirmation</h2>
                                <p>Confirm the customer and assign the responsible server or cashier before saving this order as credit.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCreditCustomerModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.creditConfirmTopGrid}>
                            <div className={styles.receiptBox}>
                                <div className={styles.summaryRow}><span>Order Number</span><strong>{creditOrderNumberLabel}</strong></div>
                                <div className={styles.summaryRow}><span>Order Type</span><strong>{orderModeMeta[orderMode]}</strong></div>
                                <div className={styles.summaryRow}><span>Net Payable</span><strong>{formatMoney(total)}</strong></div>
                            </div>
                            <div className={styles.receiptBox}>
                                <div className={styles.summaryRow}><span>Current Customer</span><strong>{selectedCustomer?.name || 'Walk-in Customer'}</strong></div>
                                <div className={styles.summaryRow}><span>Contact</span><strong>{selectedCustomer?.phone_number || selectedCustomer?.email || '-'}</strong></div>
                                <div className={styles.summaryRow}><span>Customer Code</span><strong>{selectedCustomer?.customer_code || selectedCustomer?.id || '-'}</strong></div>
                                <div className={styles.summaryRow}><span>Follow-Up</span><strong>{selectedCustomer?.collection_follow_up_date || 'Not set'}</strong></div>
                                <div className={styles.summaryRow}><span>Credit Profile</span><strong>{selectedCustomer ? (selectedCustomer.allow_credit ? `Allowed · ${selectedCustomerCreditLimit > 0 ? formatMoney(selectedCustomerCreditLimit) : 'Open Limit'}` : 'Not Allowed') : 'Walk-in'}</strong></div>
                            </div>
                        </div>
                        <div className={styles.creditConfirmBodyGrid}>
                            <div className={styles.creditConfirmSection}>
                                <div className={styles.creditConfirmSectionHeader}>
                                    <strong>Server / Cashier Assignment</strong>
                                    <span>Required for credit approval and follow-up recovery.</span>
                                </div>
                                <select
                                    className={styles.compactInput}
                                    value={selectedOrderTakerId ? String(selectedOrderTakerId) : ''}
                                    onChange={(event) => setSelectedOrderTakerId(event.target.value ? Number(event.target.value) : null)}
                                >
                                    <option value="">Select server / cashier</option>
                                    {orderTakers.map((orderTaker: any) => (
                                        <option key={orderTaker.id} value={orderTaker.id}>
                                            {orderTaker.full_name}{orderTaker.employee_id ? ` | ${orderTaker.employee_id}` : ''}{orderTaker.designation_name ? ` | ${orderTaker.designation_name}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className={styles.creditConfirmSelectedMeta}>
                                    <span>{selectedOrderTaker?.full_name || 'No server / cashier selected yet'}</span>
                                    <strong>{selectedOrderTaker?.designation_name || selectedOrderTaker?.employee_id || 'Assignment pending'}</strong>
                                </div>
                            </div>
                            <div className={styles.creditConfirmSummaryGrid}>
                                <div className={styles.creditConfirmSummaryCard}>
                                    <span>{selectedCustomer?.name || 'Walk-in Customer'}</span>
                                    <strong className={styles.creditConfirmAmount}>{formatMoney(selectedCustomerCreditSummary.outstandingAmount)}</strong>
                                    <small>Pending Credit</small>
                                    <small className={styles.creditConfirmOrdersHighlight}>{selectedCustomerCreditSummary.orderCount} credited order{selectedCustomerCreditSummary.orderCount === 1 ? '' : 's'} pending</small>
                                    {selectedCustomer?.allow_credit && selectedCustomerCreditLimit > 0 ? (
                                        <small className={styles.creditConfirmOrdersHighlight}>
                                            Projected {formatMoney(projectedCustomerCreditExposure)} / Limit {formatMoney(selectedCustomerCreditLimit)}
                                        </small>
                                    ) : null}
                                    {selectedCustomer?.collection_follow_up_note ? (
                                        <small className={styles.creditConfirmOrdersHighlight}>{selectedCustomer.collection_follow_up_note}</small>
                                    ) : null}
                                </div>
                                <div className={styles.creditConfirmSummaryCard}>
                                    <span>{selectedOrderTaker?.full_name || 'Unassigned staff member'}</span>
                                    <strong className={styles.creditConfirmAmount}>{formatMoney(selectedStaffCreditSummary.outstandingAmount)}</strong>
                                    <small>Pending Credit</small>
                                    <small className={styles.creditConfirmOrdersHighlight}>{selectedStaffCreditSummary.orderCount} credited order{selectedStaffCreditSummary.orderCount === 1 ? '' : 's'} under this staff member</small>
                                </div>
                            </div>
                            {selectedCustomer && (
                                <div className={styles.creditConfirmSelectedMeta}>
                                    <span>
                                        {isSelectedCustomerStatusBlocked
                                            ? `Customer is ${String(selectedCustomer.status || 'inactive')}.`
                                            : !selectedCustomer.allow_credit
                                                ? 'Customer credit is disabled.'
                                                : shouldBlockSelectedCustomerCredit
                                                    ? 'Projected credit exposure is over the approved limit.'
                                                    : isSelectedCustomerOverCreditLimit
                                                        ? 'Projected credit exposure is over limit, but customer policy is warn only.'
                                                : 'Customer credit profile is valid for this sale.'}
                                    </span>
                                    <strong>
                                        {isSelectedCustomerStatusBlocked || !selectedCustomer.allow_credit || shouldBlockSelectedCustomerCredit
                                            ? 'Credit Blocked'
                                            : isSelectedCustomerOverCreditLimit
                                                ? 'Credit Warning'
                                            : 'Credit Allowed'}
                                    </strong>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalActions} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <KitchenButton variant="outline" onClick={() => openCustomerSearchModal('credit')}>Select Customer</KitchenButton>
                            <KitchenButton variant="outline" onClick={openCustomerCreateModal}>Add New Customer</KitchenButton>
                            <KitchenButton
                                variant="outline"
                                disabled={!selectedOrderTakerId}
                                onClick={() => {
                                    setIsCreditCustomerModalOpen(false);
                                    void finalizeCreditOrder(true);
                                }}
                            >
                                Confirm Walk-in
                            </KitchenButton>
                            <KitchenButton
                                variant="primary"
                                disabled={!selectedCustomer || !selectedOrderTakerId || isSelectedCustomerStatusBlocked || !selectedCustomer.allow_credit || shouldBlockSelectedCustomerCredit}
                                onClick={() => {
                                    setIsCreditCustomerModalOpen(false);
                                    void finalizeCreditOrder(false);
                                }}
                            >
                                Confirm Customer
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isVoucherModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsVoucherModalOpen(false)}>
                    <div className={`${styles.modalCardSmall} ${styles.smartSupportModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Apply Voucher</h2>
                                <p>Enter the voucher code and validate it against the current order.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsVoucherModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Voucher Code</label>
                            <input className={styles.compactInput} value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} placeholder="Voucher code" />
                        </div>
                        {appliedVoucher && (
                            <div className={styles.receiptBox}>
                                <div className={styles.summaryRow}><span>Applied</span><strong>{appliedVoucher.code}</strong></div>
                                <div className={styles.summaryRow}><span>Savings</span><strong>{formatMoney(appliedVoucher.discount_amount || 0)}</strong></div>
                            </div>
                        )}
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsVoucherModalOpen(false)}>Close</KitchenButton>
                            <KitchenButton variant="primary" disabled={!voucherCode.trim()} onClick={() => void applyVoucherCode()}>Apply Voucher</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isDiscountModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsDiscountModalOpen(false)}>
                    <div className={`${styles.modalCardSmall} ${styles.smartSupportModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Apply Discount</h2>
                                <p>Enter the discount and choose whether it is flat or percentage based.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsDiscountModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.fieldStack}>
                            <label className={styles.metaLabel}>Discount Value</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input className={styles.compactInput} type="number" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} placeholder="0" />
                                <button
                                    type="button"
                                    className="small-action-btn"
                                    title="Toggle Flat/Percentage"
                                    onClick={() => setDiscountType((t) => t === 'fixed' ? 'percent' : 'fixed')}
                                    style={{ width: '44px', flexShrink: 0, fontWeight: 700 }}
                                >
                                    {discountType === 'percent' ? '%' : currencyLabel}
                                </button>
                            </div>
                        </div>
                        <div className={styles.receiptBox}>
                            <div className={styles.summaryRow}><span>Order Amount</span><strong>{formatMoney(subtotal)}</strong></div>
                            <div className={styles.summaryRow}><span>Discount Amount</span><strong>{formatMoney(effectiveManualDiscount)}</strong></div>
                            <div className={styles.summaryRow}><span>Amount After Discount</span><strong>{formatMoney(Math.max(subtotal - effectiveManualDiscount, 0))}</strong></div>
                            <div className={styles.summaryRow}><span>Type</span><strong>{discountType === 'percent' ? 'Percentage' : 'Flat'}</strong></div>
                            <div className={styles.summaryRow}><span>Current Discount</span><strong>{discountType === 'percent' ? `${discountAmount || 0}%` : formatMoney(Number(discountAmount || 0))}</strong></div>
                            <div className={styles.summaryRow}><span>Limit</span><strong>{discountLimitAmount !== null ? formatMoney(discountLimitAmount) : 'No branch cap found'}</strong></div>
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsDiscountModalOpen(false)}>Close</KitchenButton>
                            <KitchenButton variant="primary" onClick={applyManualDiscountSelection}>Apply Discount</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isApprovalModalOpen && <div className={styles.modalOverlay} onClick={() => setIsApprovalModalOpen(false)}><div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}><div className={styles.modalHeader}><div><h2>Authorize Discount</h2><p>This discount exceeds the configured limit.</p></div><button type="button" className={styles.modalClose} onClick={() => setIsApprovalModalOpen(false)}><X size={16} /></button></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Authorized User ID</label><input className={styles.compactInput} value={approverUsername} onChange={(event) => setApproverUsername(event.target.value)} placeholder="User ID" /></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Password</label><input className={styles.compactInput} type="password" value={approverPassword} onChange={(event) => setApproverPassword(event.target.value)} placeholder="Password" /></div><div className={styles.modalActions}><KitchenButton variant="outline" onClick={() => setIsApprovalModalOpen(false)}>Cancel</KitchenButton><KitchenButton variant="primary" isLoading={isApproving} onClick={() => void approveDiscountOverride()}>Approve</KitchenButton></div></div></div>}
            {isSalesReturnOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsSalesReturnOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.modalCardWide}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Sales Return</h2>
                                <p>Select a paid order from the current business day and process the refund through the terminal.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsSalesReturnOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.salesReturnShell}>
                            <section className={styles.salesReturnLookupPanel}>
                                <div className={styles.salesReturnLookupHeader}>
                                    <div>
                                        <span className={styles.metaLabel}>Order Lookup</span>
                                        <h3>Select Completed Order</h3>
                                    </div>
                                    <div className={styles.salesReturnLookupStat}>{pagedReturnableOrders.totalItems} refundable orders</div>
                                </div>
                                <input
                                    className={`${styles.compactInput} ${styles.salesReturnSearchInput}`}
                                    value={salesReturnSearch}
                                    onChange={(event) => setSalesReturnSearch(event.target.value)}
                                    placeholder="Search order no., table, customer, cashier"
                                />
                                <div className={styles.salesReturnPager}>
                                    <span className={styles.modalListMeta}>Showing {pagedReturnableOrders.rows.length} of {pagedReturnableOrders.totalItems}</span>
                                    <div className={styles.modalPagination}>
                                        <button type="button" className={styles.modalPageButton} disabled={pagedReturnableOrders.page <= 1} onClick={() => setSalesReturnPage((page) => Math.max(1, page - 1))}>Previous</button>
                                        <span className={styles.modalPageLabel}>Page {pagedReturnableOrders.page} of {pagedReturnableOrders.totalPages}</span>
                                        <button type="button" className={styles.modalPageButton} disabled={pagedReturnableOrders.page >= pagedReturnableOrders.totalPages} onClick={() => setSalesReturnPage((page) => Math.min(pagedReturnableOrders.totalPages, page + 1))}>Next</button>
                                    </div>
                                </div>
                                <div className={styles.salesReturnOrderList}>
                            {filteredReturnableOrders.length === 0 ? (
                                <div className={styles.tillGuardWarning}>
                                    <ClipboardList size={14} />
                                    <span>No completed paid orders match this search.</span>
                                </div>
                            ) : (
                                <>
                                    {pagedReturnableOrders.rows.map((order) => (
                                        <button
                                            key={order.id}
                                            type="button"
                                            className={`${styles.salesReturnOrderCard} ${salesReturnOrderId === order.id ? styles.salesReturnOrderCardActive : ''}`}
                                            onClick={() => {
                                                setSalesReturnOrderId(order.id);
                                                const firstPaymentMode = paymentModeFromMethodCode(order.payments?.find((payment: any) => !payment.is_refund)?.payment_mode);
                                                setSalesReturnPaymentMode(resolveDefaultRefundPaymentMode(firstPaymentMode));
                                            }}
                                        >
                                            <div className={styles.salesReturnOrderTop}>
                                                <div>
                                                    <strong>{formatVisibleOrderNumber(order.order_number || order.id)}</strong>
                                                    <div className={styles.modalMeta}>{formatOrderListDateTime(order.created_at)}</div>
                                                </div>
                                                <div className={styles.salesReturnOrderAmount}>{formatMoney(Number(order.total_amount || 0))}</div>
                                            </div>
                                            <div className={styles.salesReturnOrderChips}>
                                                <span className={`${styles.orderListChip} ${styles.orderListChipOutline}`}>{orderModeMeta[normalizeOrderMode(order.order_type)]}</span>
                                                {order.table_number ? <span className={`${styles.orderListChip} ${styles.orderListChipTable}`}>Table {order.table_number}</span> : null}
                                                <span className={`${styles.orderListChip} ${styles.orderListChipSuccess}`}>{formatOrderListPaymentStatus(order.payment_status)}</span>
                                            </div>
                                            <div className={styles.salesReturnOrderMetaGrid}>
                                                <div><span>Customer</span><strong>{order.customer_name || 'Walk-in Customer'}</strong></div>
                                                <div><span>Refundable</span><strong>{formatMoney(Number(order.remaining_refundable_amount || 0))}</strong></div>
                                            </div>
                                            <div className={styles.salesReturnOrderPreview}>{getOrderItemsPreview(order)}</div>
                                        </button>
                                    ))}
                                </>
                            )}
                                </div>
                            </section>
                            <section className={styles.salesReturnWorkspace}>
                                {!selectedReturnOrder ? (
                                    <div className={styles.salesReturnEmptyState}>
                                        <RotateCcw size={18} />
                                        <strong>Select an order to begin the return</strong>
                                        <span>Refund preview, item quantities, and approval controls will appear here.</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.salesReturnSummaryGrid}>
                                            <div className={styles.salesReturnSummaryCard}><span>Selected Order</span><strong>{formatVisibleOrderNumber(selectedReturnOrder.order_number || selectedReturnOrder.id)}</strong><small>{orderModeMeta[normalizeOrderMode(selectedReturnOrder.order_type)]}</small></div>
                                            <div className={styles.salesReturnSummaryCard}><span>Refundable Balance</span><strong>{formatMoney(Number(selectedReturnOrder.remaining_refundable_amount || 0))}</strong><small>{formatOrderListPaymentStatus(selectedReturnOrder.payment_status)}</small></div>
                                            <div className={styles.salesReturnSummaryCard}><span>Return Mode</span><strong>{selectedReturnMeta.isFullSelection ? 'Full Return' : 'Partial Return'}</strong><small>{selectedReturnLines.filter((item: SalesReturnLine) => item.requestedQuantity > 0).length} lines selected</small></div>
                                            <div className={`${styles.salesReturnSummaryCard} ${styles.salesReturnSummaryCardAccent}`}><span>Refund Preview</span><strong>{formatMoney(selectedReturnMeta.refundAmount)}</strong><small>For selected QTY</small></div>
                                        </div>
                                        <div className={styles.salesReturnContentGrid}>
                                            <div className={styles.salesReturnSection}>
                                                <div className={styles.salesReturnSectionHeader}>
                                                    <div><span className={styles.metaLabel}>Item Selection</span><h3>Return Quantities</h3></div>
                                                    <div className={styles.modalActions}>
                                                        <KitchenButton variant="outline" onClick={() => setSalesReturnQuantities(Object.fromEntries(selectedReturnLines.map((item: SalesReturnLine) => [item.id, String(item.availableQuantity)])))}>Return All</KitchenButton>
                                                        <KitchenButton variant="ghost" onClick={() => setSalesReturnQuantities(Object.fromEntries(selectedReturnLines.map((item: SalesReturnLine) => [item.id, ''])))}>Clear</KitchenButton>
                                                    </div>
                                                </div>
                                                <div className={styles.salesReturnItemsHeader}>
                                                    <span>Items</span>
                                                    <span>Unit Price</span>
                                                    <span>Sold QTY</span>
                                                    <span>Return QTY</span>
                                                    <span>Amount</span>
                                                </div>
                                                <div className={styles.salesReturnItemsList}>
                                                    {selectedReturnLines.map((item: SalesReturnLine) => (
                                                        <div key={`return-item-${item.id}`} className={styles.salesReturnItemCard}>
                                                            <div className={styles.salesReturnItemRow}>
                                                                <div className={styles.salesReturnItemIdentity}>
                                                                    <strong>{item.productName}</strong>
                                                                </div>
                                                                <span className={styles.salesReturnUnitPrice}>{formatMoney(item.unitPrice)}</span>
                                                                <span className={styles.salesReturnSoldQty}>{item.soldQuantity}</span>
                                                                <input className={`${styles.compactInput} ${styles.salesReturnQtyInput}`} type="number" min={0} max={item.availableQuantity} value={salesReturnQuantities[item.id] ?? ''} onChange={(event) => setSalesReturnQuantity(item.id, event.target.value, item.availableQuantity)} placeholder="Qty" />
                                                                <span className={styles.salesReturnLineRefund}>{formatMoney(item.baseAmount)}</span>
                                                            </div>
                                                            <div className={styles.salesReturnItemStats}>
                                                                <span>Returned {item.alreadyReturnedQuantity}</span>
                                                                <span>Available {item.availableQuantity}</span>
                                                                <span>Refund {formatMoney(item.baseAmount)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.salesReturnSection}>
                                                <div className={styles.salesReturnSectionHeader}>
                                                    <div><span className={styles.metaLabel}>Refund Control</span><h3>Settlement And Approval</h3></div>
                                                </div>
                                                <div className={styles.salesReturnBreakdown}>
                                                    <div className={styles.summaryRow}><span>Items Base</span><strong>{formatMoney(selectedReturnBase)}</strong></div>
                                                    <div className={styles.summaryRow}><span>Allocated Discount</span><strong>{formatMoney(selectedReturnMeta.selectedDiscount)}</strong></div>
                                                    <div className={styles.summaryRow}><span>Allocated Tax</span><strong>{formatMoney(selectedReturnMeta.selectedTax)}</strong></div>
                                                    <div className={styles.summaryRow}><span>Allocated Service</span><strong>{formatMoney(selectedReturnMeta.selectedService)}</strong></div>
                                                    <div className={`${styles.summaryRow} ${styles.salesReturnRefundRow}`}><span>Refund Due</span><strong>{formatMoney(selectedReturnMeta.refundAmount)}</strong></div>
                                                </div>
                                                <div className={styles.salesReturnFormGrid}>
                                                    <div className={`${styles.fieldStack} ${styles.salesReturnInlineField}`}>
                                                        <label className={styles.metaLabel}>Refund Mode</label>
                                                        <select className={styles.compactInput} value={salesReturnPaymentMode} onChange={(event) => setSalesReturnPaymentMode(event.target.value as ChargePaymentMode)}>
                                                            {refundPaymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}
                                                        </select>
                                                    </div>
                                                    {salesReturnPaymentMode !== 'cash' && (
                                                        <div className={styles.fieldStack}>
                                                            <label className={styles.metaLabel}>Reference</label>
                                                            <input className={styles.compactInput} value={salesReturnReference} onChange={(event) => setSalesReturnReference(event.target.value)} placeholder="Slip / Txn #" />
                                                        </div>
                                                    )}
                                                    <div className={`${styles.fieldStack} ${styles.salesReturnFieldSpan}`}>
                                                        <label className={styles.metaLabel}>Return Note</label>
                                                        <textarea className={styles.compactInput} rows={3} value={salesReturnNote} onChange={(event) => setSalesReturnNote(event.target.value)} placeholder="Document the reason, product issue, or cashier remarks for this return" />
                                                    </div>
                                                    <div className={`${styles.salesReturnApprovalBlock} ${styles.salesReturnFieldSpan}`}>
                                                        <div className={styles.salesReturnApprovalHeader}>
                                                            <span className={styles.metaLabel}>Authorization</span>
                                                            <strong>Authorized Approval Required</strong>
                                                        </div>
                                                        <div className={styles.salesReturnApprovalGrid}>
                                                            <div className={styles.fieldStack}>
                                                                <label className={styles.metaLabel}>Authorized User ID</label>
                                                                <input ref={salesReturnApprovalUsernameRef} className={styles.compactInput} defaultValue="" autoComplete="off" placeholder="User ID" />
                                                            </div>
                                                            <div className={styles.fieldStack}>
                                                                <label className={styles.metaLabel}>Authorized PIN</label>
                                                                <input ref={salesReturnApprovalPinRef} className={styles.compactInput} type="password" defaultValue="" autoComplete="off" placeholder="PIN" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <label className={styles.salesReturnCheckboxRow}>
                                                    <input type="checkbox" checked={salesReturnRestock} onChange={(event) => setSalesReturnRestock(event.target.checked)} />
                                                    <span><strong>Restock inventory</strong><small>Returned quantities will be added back to branch stock.</small></span>
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>
                        <div className={`${styles.modalActions} ${styles.salesReturnFooterActions}`}>
                            <KitchenButton variant="outline" onClick={() => setIsSalesReturnOpen(false)}>
                                Cancel
                            </KitchenButton>
                            <KitchenButton
                                variant="primary"
                                isLoading={isSalesReturnSubmitting}
                                disabled={!selectedReturnOrder || selectedReturnMeta.refundAmount <= 0}
                                onClick={() => void submitSalesReturn()}
                            >
                                Confirm Sales Return
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isCustomerSearchModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCustomerSearchModalOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.customerModalCard}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Customer Search</h2>
                                <p>Find an existing customer quickly, review their profile signals, and attach them to the current POS order.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCustomerSearchModalOpen(false)}><X size={16} /></button>
                        </div>

                        <div className={styles.customerSearchTopBar}>
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Search</label>
                                <input
                                    className={styles.compactInput}
                                    value={customerSearchTerm}
                                    onChange={(event) => setCustomerSearchTerm(event.target.value)}
                                    placeholder="Name, phone, email, customer code, city, or ID"
                                />
                            </div>
                            <div className={styles.customerSearchSummary}>
                                <div className={styles.customerSummaryTile}>
                                    <span>Matches</span>
                                    <strong>{filteredCustomers.length}</strong>
                                </div>
                                <div className={styles.customerSummaryTile}>
                                    <span>Filters</span>
                                    <strong>{activeCustomerFilterCount}</strong>
                                </div>
                                <div className={styles.customerSummaryTile}>
                                    <span>Attached</span>
                                    <strong>{selectedCustomer?.name || 'Walk-in'}</strong>
                                </div>
                            </div>
                        </div>

                        <div className={styles.customerFilterBar}>
                            <span className={styles.customerFilterLabel}>Search Filters</span>
                            <span className={styles.customerInlineHint}>Visible filters stay applied while you search.</span>
                        </div>
                        <div className={styles.customerSearchFilters}>
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Status</label>
                                <select
                                    className={styles.compactInput}
                                    value={customerSearchFilters.status}
                                    onChange={(event) => setCustomerSearchFilters((current) => ({ ...current, status: event.target.value as CustomerSearchFilters['status'] }))}
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Preferred Branch</label>
                                <select
                                    className={styles.compactInput}
                                    value={customerSearchFilters.branchId}
                                    onChange={(event) => setCustomerSearchFilters((current) => ({ ...current, branchId: event.target.value }))}
                                >
                                    <option value="all">All branches</option>
                                    {branches.map((branch: any) => (
                                        <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Loyalty</label>
                                <select
                                    className={styles.compactInput}
                                    value={customerSearchFilters.loyalty}
                                    onChange={(event) => setCustomerSearchFilters((current) => ({ ...current, loyalty: event.target.value as CustomerSearchFilters['loyalty'] }))}
                                >
                                    <option value="all">All customers</option>
                                    <option value="members">Loyalty members</option>
                                    <option value="non_members">No loyalty points</option>
                                </select>
                            </div>
                            <div className={styles.fieldStack}>
                                <label className={styles.metaLabel}>Contact</label>
                                <select
                                    className={styles.compactInput}
                                    value={customerSearchFilters.contact}
                                    onChange={(event) => setCustomerSearchFilters((current) => ({ ...current, contact: event.target.value as CustomerSearchFilters['contact'] }))}
                                >
                                    <option value="all">Any profile</option>
                                    <option value="with_phone">Has phone</option>
                                    <option value="with_email">Has email</option>
                                    <option value="complete_profile">Phone and email</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.customerResultsPanel}>
                            {filteredCustomers.length > 0 ? (
                                <div className={styles.customerTable}>
                                    <div className={styles.customerTableHead}>
                                        <span>Customer</span>
                                        <span>Contact</span>
                                        <span>Location</span>
                                        <span>Preferred Branch</span>
                                        <span>Status</span>
                                        <span>Orders</span>
                                        <span>Spend</span>
                                        <span>Loyalty</span>
                                    </div>
                                    <div className={styles.customerTableBody}>
                                        {filteredCustomers.map((customer: any) => {
                                            const preferredBranch = customer.preferred_branch_id
                                                ? (branches.find((branch: any) => Number(branch.id) === Number(customer.preferred_branch_id))?.branch_name || `Branch ${customer.preferred_branch_id}`)
                                                : 'No preferred branch';
                                            const location = [customer.city, customer.country].filter(Boolean).join(', ') || 'Location not set';
                                            return (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    className={`${styles.customerTableRow} ${selectedCustomer?.id === customer.id ? styles.customerTableRowActive : ''}`}
                                                    onClick={() => {
                                                        setSelectedCustomer(customer);
                                                        setCustomerSearchTerm('');
                                                        setCustomerSearchFilters(emptyCustomerSearchFilters);
                                                        setIsCustomerSearchModalOpen(false);
                                                        if (customerModalIntent === 'credit') {
                                                            setIsCreditCustomerModalOpen(true);
                                                        }
                                                    }}
                                                >
                                                    <span className={styles.customerCellPrimary}>
                                                        <strong>{customer.name}</strong>
                                                        <small>{customer.customer_code || `#${customer.id}`}</small>
                                                    </span>
                                                    <span className={styles.customerCellStack}>
                                                        <strong>{customer.phone_number || 'No phone'}</strong>
                                                        <small>{customer.email || 'No email'}</small>
                                                    </span>
                                                    <span className={styles.customerCellMuted}>{location}</span>
                                                    <span className={styles.customerCellMuted}>{preferredBranch}</span>
                                                    <span>
                                                        <span className={styles.customerResultStatus}>{String(customer.status || 'active')}</span>
                                                    </span>
                                                    <span className={styles.customerCellMetric}>{Number(customer.total_orders || 0)}</span>
                                                    <span className={styles.customerCellMetric}>{formatMoney(Number(customer.total_spent || 0))}</span>
                                                    <span className={styles.customerCellMetric}>{Number(customer.loyalty_points || 0)} pts</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.customerResultsEmpty}>
                                    No customer matched the current search and filters.
                                </div>
                            )}
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsCustomerSearchModalOpen(false)}>Close</KitchenButton>
                            {customerModalIntent === 'credit' && (
                                <KitchenButton
                                    variant="outline"
                                    onClick={() => {
                                        setIsCustomerSearchModalOpen(false);
                                        setIsCreditCustomerModalOpen(true);
                                    }}
                                >
                                    Back
                                </KitchenButton>
                            )}
                            <KitchenButton variant="primary" onClick={openCustomerCreateModal}>Add New Customer</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isDeliveryInfoModalOpen && orderMode === 'delivery' && (
                <div className={styles.modalOverlay} onClick={() => setIsDeliveryInfoModalOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.modalCardWide}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Delivery Information</h2>
                                <p>Capture recipient, address, and dispatch details in one place while keeping the order flow clean for the cashier.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsDeliveryInfoModalOpen(false)}><X size={16} /></button>
                        </div>

                        <section className={styles.deliveryPanel}>
                            <div className={styles.deliveryPanelHeader}>
                                <div>
                                    <h3>Delivery Type</h3>
                                    <p>{selectedCustomer?.id ? 'A registered customer is already attached. Only dispatch information needs to be completed.' : 'This order is being delivered to a guest customer, so full recipient details are required.'}</p>
                                </div>
                                <span className={styles.deliveryPanelBadge}>{selectedCustomer?.id ? 'Registered Customer' : 'Guest Delivery'}</span>
                            </div>

                            <div className={styles.deliverySummaryActions}>
                                <KitchenButton variant="outline" onClick={() => openCustomerSearchModal()}>
                                    <UserSearch size={14} />
                                    Search Customer
                                </KitchenButton>
                                <KitchenButton variant="outline" onClick={openCustomerCreateModal}>
                                    <Plus size={14} />
                                    Add New Customer
                                </KitchenButton>
                            </div>

                            {selectedCustomer?.id ? (
                                <div className={styles.deliveryRegisteredSummary}>
                                    <div><span>Customer</span><strong>{selectedCustomer?.name || 'Registered Customer'}</strong></div>
                                    <div><span>Phone</span><strong>{selectedCustomer?.phone_number || '-'}</strong></div>
                                    <div><span>Address</span><strong>{selectedCustomer?.address_line_1 || [selectedCustomer?.city, selectedCustomer?.country].filter(Boolean).join(', ') || '-'}</strong></div>
                                </div>
                            ) : (
                                <div className={styles.deliveryGrid}>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Contact Person</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.contact_person} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, contact_person: event.target.value }))} placeholder="Receiver name" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Phone No.</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.phone_number} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, phone_number: event.target.value }))} placeholder="03xx..." />
                                    </div>
                                    <div className={`${styles.fieldStack} ${styles.deliveryFieldSpan2}`}>
                                        <label className={styles.metaLabel}>Address</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.address} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, address: event.target.value }))} placeholder="Street, landmark, building, or delivery address" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>House / Apartment</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.house_apartment} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, house_apartment: event.target.value }))} placeholder="House or apartment" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Street #</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.street_no} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, street_no: event.target.value }))} placeholder="Street number" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Area / Sector</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.area_sector} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, area_sector: event.target.value }))} placeholder="Area or sector" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Locality</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.locality} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, locality: event.target.value }))} placeholder="Locality" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>City</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.city} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
                                    </div>
                                    <div className={styles.fieldStack}>
                                        <label className={styles.metaLabel}>Ask For</label>
                                        <input className={styles.compactInput} value={deliveryOrderForm.ask_for} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, ask_for: event.target.value }))} placeholder="Person to ask for" />
                                    </div>
                                </div>
                            )}

                            <div className={styles.deliveryGrid}>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Delivery Person</label>
                                    <select
                                        className={styles.compactInput}
                                        value={deliveryOrderForm.delivery_person_user_id}
                                        onChange={(event) => {
                                            const nextId = event.target.value;
                                            const nextAgent = deliveryAgents.find((entry: any) => String(entry.id) === nextId) || null;
                                            setDeliveryOrderForm((current) => ({
                                                ...current,
                                                delivery_person_user_id: nextId,
                                                delivery_person_name: nextAgent?.full_name || nextAgent?.user_name || current.delivery_person_name,
                                            }));
                                        }}
                                    >
                                        <option value="">Select delivery person</option>
                                        {deliveryAgents.map((agent: any) => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.full_name || agent.user_name}{agent.designation_name ? ` | ${agent.designation_name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Payment Term</label>
                                    <select className={styles.compactInput} value={deliveryOrderForm.payment_term} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, payment_term: event.target.value as DeliveryPaymentTerm }))}>
                                        <option value="paid">Paid</option>
                                        <option value="cod">COD</option>
                                    </select>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Delivery Status</label>
                                    <select className={styles.compactInput} value={deliveryOrderForm.delivery_status} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, delivery_status: event.target.value as DeliveryStatus }))}>
                                        <option value="pending">Pending</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="out_for_delivery">Out for Delivery</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className={`${styles.fieldStack} ${styles.deliveryFieldSpan2}`}>
                                    <label className={styles.metaLabel}>Comment</label>
                                    <input className={styles.compactInput} value={deliveryOrderForm.comment} onChange={(event) => setDeliveryOrderForm((current) => ({ ...current, comment: event.target.value }))} placeholder="Gate code, landmark, timing, or delivery instructions" />
                                </div>
                            </div>
                        </section>

                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsDeliveryInfoModalOpen(false)}>
                                Close
                            </KitchenButton>
                            <KitchenButton variant="primary" onClick={() => setIsDeliveryInfoModalOpen(false)}>
                                Save Delivery Details
                            </KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isCustomerCreateModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCustomerCreateModalOpen(false)}>
                    <div className={`${styles.modalCard} ${styles.customerModalCard}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>New Customer</h2>
                                <p>Create a professional customer profile from POS and keep it available in the wider CRM immediately.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCustomerCreateModalOpen(false)}><X size={16} /></button>
                        </div>

                        <div className={styles.customerCreateIntro}>
                            <div className={styles.customerSummaryTile}>
                                <span>Required</span>
                                <strong>Name + one contact</strong>
                            </div>
                            <div className={styles.customerSummaryTile}>
                                <span>Branch</span>
                                <strong>{branchLabel}</strong>
                            </div>
                            <div className={styles.customerSummaryTile}>
                                <span>Status</span>
                                <strong>{newCustomerForm.status}</strong>
                            </div>
                        </div>

                        <div className={styles.customerSectionCard}>
                            <div className={styles.customerSectionHeader}>
                                <div>
                                    <h3>Identity</h3>
                                    <p>Core profile details for lookup and identification.</p>
                                </div>
                                <span className={styles.customerInlineHint}>Customer ID is generated automatically.</span>
                            </div>
                            <div className={styles.customerFormGrid}>
                                <div className={`${styles.fieldStack} ${styles.customerCompactIdField}`}>
                                    <label className={styles.metaLabel}>Customer ID</label>
                                    <input className={styles.compactInput} value="Auto-generated on save" disabled readOnly />
                                </div>
                                <div className={`${styles.fieldStack} ${styles.customerNameField}`}>
                                    <label className={styles.metaLabel}>Full Name</label>
                                    <input className={styles.compactInput} value={newCustomerForm.name} onChange={(event) => setNewCustomerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Customer full name" />
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Gender</label>
                                    <select className={styles.compactInput} value={newCustomerForm.gender} onChange={(event) => setNewCustomerForm((current) => ({ ...current, gender: event.target.value as PosCustomerFormState['gender'] }))}>
                                        <option value="">Not specified</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                        <option value="prefer_not_to_say">Prefer not to say</option>
                                    </select>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Status</label>
                                    <label className={styles.customerStatusToggleRow}>
                                        <button
                                            type="button"
                                            className={`${styles.customerStatusPill} ${newCustomerForm.status === 'active' ? styles.customerStatusPillActive : ''}`}
                                            aria-pressed={newCustomerForm.status === 'active'}
                                            onClick={() => setNewCustomerForm((current) => ({
                                                ...current,
                                                status: current.status === 'active' ? 'inactive' : 'active',
                                            }))}
                                        >
                                            <span className={styles.customerStatusPillKnob} />
                                        </button>
                                        <span className={styles.customerStatusToggleText}>
                                            {newCustomerForm.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className={styles.customerSectionCard}>
                            <div className={styles.customerSectionHeader}>
                                <div>
                                    <h3>Contact</h3>
                                    <p>Use at least one direct contact channel for future POS lookup.</p>
                                </div>
                            </div>
                            <div className={styles.customerFormGrid}>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Phone</label>
                                    <input className={styles.compactInput} value={newCustomerForm.phone_number} onChange={(event) => setNewCustomerForm((current) => ({ ...current, phone_number: event.target.value }))} placeholder="03xx..." />
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Email</label>
                                    <input className={styles.compactInput} value={newCustomerForm.email} onChange={(event) => setNewCustomerForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" />
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>City</label>
                                    <select className={styles.compactInput} value={newCustomerForm.city} onChange={(event) => setNewCustomerForm((current) => ({ ...current, city: event.target.value }))}>
                                        {CITY_OPTIONS.map((option) => (
                                            <option key={option.value || 'city-empty'} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Country</label>
                                    <select className={styles.compactInput} value={newCustomerForm.country} onChange={(event) => setNewCustomerForm((current) => ({ ...current, country: event.target.value }))}>
                                        {COUNTRY_OPTIONS.map((option) => (
                                            <option key={option.value || 'country-empty'} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={`${styles.fieldStack} ${styles.customerFieldSpan4}`}>
                                    <label className={styles.metaLabel}>Address</label>
                                    <input className={styles.compactInput} value={newCustomerForm.address_line_1} onChange={(event) => setNewCustomerForm((current) => ({ ...current, address_line_1: event.target.value }))} placeholder="Street, area, landmark, or delivery notes" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.customerSectionCard}>
                            <div className={styles.customerSectionHeader}>
                                <div>
                                    <h3>Business Information</h3>
                                    <p>Optional fields for B2B customers, office delivery, and account-level tracking.</p>
                                </div>
                            </div>
                            <div className={styles.customerFormGrid}>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Organization</label>
                                    <input
                                        className={styles.compactInput}
                                        list="pos-customer-organization-options"
                                        value={newCustomerForm.organization}
                                        onChange={(event) => setNewCustomerForm((current) => ({ ...current, organization: event.target.value }))}
                                        placeholder="Company or organization"
                                    />
                                    <datalist id="pos-customer-organization-options">
                                        {organizationOptions.map((organization) => (
                                            <option key={organization} value={organization} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Designation</label>
                                    <input className={styles.compactInput} value={newCustomerForm.designation} onChange={(event) => setNewCustomerForm((current) => ({ ...current, designation: event.target.value }))} placeholder="Job title or role" />
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Preferred Branch</label>
                                    <select className={styles.compactInput} value={newCustomerForm.preferred_branch_id} onChange={(event) => setNewCustomerForm((current) => ({ ...current, preferred_branch_id: event.target.value }))}>
                                        <option value="">Use current terminal branch</option>
                                        {branches.map((branch: any) => (
                                            <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className={styles.customerSectionCard}>
                            <div className={styles.customerSectionHeader}>
                                <div>
                                    <h3>Account Controls</h3>
                                    <p>Commercial permissions and internal notes for the cashier team.</p>
                                </div>
                            </div>
                            <div className={styles.customerControlsGrid}>
                                <div className={styles.customerChecksCard}>
                                    <label className={styles.customerSwitchRow}>
                                        <span>
                                            <strong>Allow credit</strong>
                                            <small>Enable credit sales for this customer.</small>
                                        </span>
                                        <button
                                            type="button"
                                            className={`${styles.switchButton} ${newCustomerForm.allow_credit ? styles.switchButtonActive : ''}`}
                                            aria-pressed={newCustomerForm.allow_credit}
                                            onClick={() => setNewCustomerForm((current) => ({ ...current, allow_credit: !current.allow_credit }))}
                                        >
                                            <span className={styles.switchKnob} />
                                        </button>
                                    </label>
                                    <label className={styles.customerCheckboxRow}>
                                        <input type="checkbox" checked={newCustomerForm.marketing_opt_in} onChange={(event) => setNewCustomerForm((current) => ({ ...current, marketing_opt_in: event.target.checked }))} />
                                        Customer agrees to marketing communication and promotional outreach.
                                    </label>
                                </div>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Credit Limit</label>
                                    <input className={styles.compactInput} type="number" min="0" step="0.01" value={newCustomerForm.credit_limit} onChange={(event) => setNewCustomerForm((current) => ({ ...current, credit_limit: event.target.value }))} disabled={!newCustomerForm.allow_credit} placeholder="0.00" />
                                </div>
                            </div>
                            <div className={styles.customerFormStack}>
                                <div className={styles.fieldStack}>
                                    <label className={styles.metaLabel}>Internal Notes</label>
                                    <textarea className={styles.compactInput} rows={3} value={newCustomerForm.notes} onChange={(event) => setNewCustomerForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Preferences, credit notes, pickup details, or special instructions" />
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="outline" onClick={() => setIsCustomerCreateModalOpen(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isCreatingCustomer} onClick={() => void createCustomerInline()}>Save Customer</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
            {isExpenseModalOpen && <div className={styles.modalOverlay} onClick={() => setIsExpenseModalOpen(false)}><div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}><div className={styles.modalHeader}><div><h2>Record Expense</h2><p>Submit a direct expense voucher from the terminal for approval.</p></div><button type="button" className={styles.modalClose} onClick={() => setIsExpenseModalOpen(false)}><X size={16} /></button></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Expense Account</label><select className={styles.compactInput} value={expenseAccountId} onChange={(event) => setExpenseAccountId(event.target.value)}><option value="">Select account</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Amount</label><input className={styles.compactInput} type="number" min="0" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" /></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Payment Method</label><select className={styles.compactInput} value={expensePaymentMethod} onChange={(event) => setExpensePaymentMethod(event.target.value)}><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Card">Card</option><option value="Mobile Wallet">Mobile Wallet</option></select></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Reference</label><input className={styles.compactInput} value={expenseReference} onChange={(event) => setExpenseReference(event.target.value)} placeholder="Receipt / Ref #" /></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Description</label><textarea className={styles.compactInput} value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="Expense details" rows={3} /></div><div className={styles.modalActions}><KitchenButton variant="outline" onClick={() => setIsExpenseModalOpen(false)}>Cancel</KitchenButton><KitchenButton variant="primary" isLoading={isExpenseSubmitting} onClick={() => void saveExpenseVoucher()}>Submit Expense</KitchenButton></div></div></div>}
            {isSplitBillOpen && <div className={styles.modalOverlay} onClick={() => setIsSplitBillOpen(false)}><div className={styles.modalCardSmall} onClick={(event) => event.stopPropagation()}><div className={styles.modalHeader}><div><h2>Split Bill</h2><p>Preview equal split by guest count.</p></div><button type="button" className={styles.modalClose} onClick={() => setIsSplitBillOpen(false)}><X size={16} /></button></div><div className={styles.fieldStack}><label className={styles.metaLabel}>Guests</label><input type="number" min={2} className={styles.compactInput} value={splitBillGuests} onChange={(event) => setSplitBillGuests(event.target.value)} /></div><div className={styles.splitGrid}>{Array.from({ length: Math.max(Number(splitBillGuests) || 2, 2) }).map((_, index) => <div key={`guest-${index + 1}`} className={styles.splitTile}><span>Guest {index + 1}</span><strong>{formatMoney(total / Math.max(Number(splitBillGuests) || 2, 2))}</strong></div>)}</div><div className={styles.modalActions}><KitchenButton variant="outline" onClick={() => setIsSplitBillOpen(false)}>Close</KitchenButton></div></div></div>}

            {receiptOrder && (
                <PosReceiptModal
                    order={receiptOrder}
                    branchDetail={branchDetail}
                    onClose={() => setReceiptOrder(null)}
                />
            )}

            {isCreditLedgerOpen && (
                <CreditLedgerModal
                    isOpen={isCreditLedgerOpen}
                    onClose={() => setIsCreditLedgerOpen(false)}
                    branchId={selectedBranchId!}
                    onPaymentSuccess={async () => {
                        await refreshPosState(selectedBranchId!);
                    }}
                />
            )}

            {isOrderAuditOpen && auditOrderId && (
                <OrderAuditModal
                    isOpen={isOrderAuditOpen}
                    onClose={() => setIsOrderAuditOpen(false)}
                    orderId={auditOrderId}
                    orderNumber={auditOrderNo}
                />
            )}
        </div>
    );
}
