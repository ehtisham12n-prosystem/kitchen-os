/* eslint-disable @typescript-eslint/no-explicit-any */
export type PrintPaperFormat = 'thermal-80mm' | 'a6' | 'a5' | 'a4';

export interface PrintTemplateSettings {
    logo_url?: string | null;
    company_name?: string | null;
    branch_name?: string | null;
    address?: string | null;
    phone?: string | null;
    footer_message?: string | null;
    footer_1?: string | null;
    footer_2?: string | null;
    kot_logo_url?: string | null;
    kot_company_name?: string | null;
    kot_branch_name?: string | null;
    kot_address?: string | null;
    kot_phone?: string | null;
    kot_footer_message?: string | null;
    kot_footer_1?: string | null;
    kot_footer_2?: string | null;
    receipt_paper_size?: PrintPaperFormat | null;
    invoice_paper_size?: PrintPaperFormat | null;
    kot_paper_size?: PrintPaperFormat | null;
    report_paper_size?: PrintPaperFormat | null;
    receipt_print_copies?: number | null;
    invoice_print_copies?: number | null;
    kot_print_copies?: number | null;
    kot_print_enabled?: boolean | null;
    report_print_copies?: number | null;
    order_change_print_mode?: 'change_only' | 'full_snapshot' | 'both' | null;
    order_change_print_copies?: number | null;
    enable_station_wise_kot_printing?: boolean | null;
    allow_multiple_kot_per_station?: boolean | null;
    service_station_print_copies?: Record<string, number> | null;
    station_printer_mapping?: Record<string, string> | null;
    separate_kot_stations?: string[] | null;
}

export interface KOTPrintItemInput {
    name: string;
    qty: number | string;
    modifiers?: string[] | null;
    station?: string | null;
}

export interface KOTPrintInput {
    kot_no: number | string;
    order_no: number | string;
    datetime: string | Date;
    order_type: string;
    table?: string | number | null;
    token?: string | number | null;
    rider?: string | null;
    guests?: number | string | null;
    server?: string | null;
    items: KOTPrintItemInput[];
    notes?: string | null;
    printed_by?: string | null;
    print_id?: string | number | null;
    printed_at?: string | Date | null;
}

export interface KOTPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: KOTPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface KOTChangeItemInput {
    name: string;
    qty?: number | string;
    modifiers?: string[] | null;
    station?: string | null;
}

export interface KOTModifyItemInput {
    name: string;
    old_qty: number | string;
    new_qty: number | string;
    modifiers?: string[] | null;
    station?: string | null;
}

export interface KOTChangePrintInput {
    kot_version: number | string;
    order_no: number | string;
    datetime: string | Date;
    user: string;
    add_items: KOTChangeItemInput[];
    cancel_items: KOTChangeItemInput[];
    modify_items: KOTModifyItemInput[];
    notes?: string | null;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface KOTChangePrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: KOTChangePrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface LineItemVoidReceiptItemInput {
    name: string;
    action: 'void' | 'reduced';
    old_qty: number | string;
    new_qty: number | string;
    void_qty: number | string;
    station?: string | null;
}

export interface LineItemVoidReceiptPrintInput {
    order_no: number | string;
    datetime: string | Date;
    cashier?: string | null;
    server?: string | null;
    order_type?: string | null;
    table?: string | number | null;
    items: LineItemVoidReceiptItemInput[];
    reason?: string | null;
    authorized_by?: string | null;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface LineItemVoidReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: LineItemVoidReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface BillSummaryItemInput {
    name: string;
    qty: number | string;
    price: number | string;
    total: number | string;
}

export interface BillSummaryPrintInput {
    receipt_no?: number | string | null;
    order_no: number | string;
    datetime?: string | Date | null;
    counter_id?: string | number | null;
    cashier?: string | null;
    server?: string | null;
    customer?: string | null;
    customer_phone?: string | null;
    order_type: string;
    table?: string | number | null;
    token?: string | number | null;
    rider?: string | null;
    guests?: number | string | null;
    items: BillSummaryItemInput[];
    subtotal: number | string;
    tax: number | string;
    discount?: number | string | null;
    total: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface BillSummaryPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: BillSummaryPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface PaymentReceiptItemInput {
    name: string;
    qty?: number | string;
    price?: number | string;
    total?: number | string;
}

export interface PaymentReceiptPrintInput {
    receipt_no: number | string;
    order_no: number | string;
    items: PaymentReceiptItemInput[];
    datetime?: string | Date | null;
    counter_id?: string | number | null;
    cashier?: string | null;
    server?: string | null;
    customer?: string | null;
    customer_phone?: string | null;
    order_type?: string | null;
    table?: string | number | null;
    token?: string | number | null;
    rider?: string | null;
    guests?: number | string | null;
    subtotal?: number | string | null;
    tax?: number | string | null;
    tax_rate_label?: string | null;
    discount?: number | string | null;
    total: number | string;
    paid: number | string;
    change: number | string;
    method: string;
    status_label?: string | null;
    detail_lines?: Array<{ label: string; value: string }>;
    hide_payment_amounts?: boolean;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface PaymentReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: PaymentReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface PartialPaymentReceiptPrintInput {
    order_no: number | string;
    total: number | string;
    paid: number | string;
    balance: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface PartialPaymentReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: PartialPaymentReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface SaleReturnItemInput {
    name: string;
    sold: number | string;
    returned: number | string;
    balance: number | string;
    unit_price?: number | string;
    return_amount?: number | string;
}

export interface SaleReturnReceiptPrintInput {
    return_no: number | string;
    return_invoice_no?: number | string | null;
    branch_id?: number | string | null;
    order_no: number | string;
    datetime?: string | Date | null;
    cashier?: string | null;
    server?: string | null;
    authorized_by?: string | null;
    customer?: string | null;
    order_type?: string | null;
    table?: string | number | null;
    items: SaleReturnItemInput[];
    refund: number | string;
    refund_plain?: number | string | null;
    method?: string | null;
    reason: string;
    detail_lines?: Array<{ label: string; value: string }>;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface SaleReturnReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: SaleReturnReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface CreditSaleReceiptPrintInput {
    customer: string;
    order_no: number | string;
    receipt_no?: number | string | null;
    datetime?: string | Date | null;
    cashier?: string | null;
    server?: string | null;
    order_type?: string | null;
    table?: string | null;
    items?: Array<{ name: string; qty: number | string; price: number | string; total: number | string }> | null;
    subtotal?: number | string | null;
    total: number | string;
    paid: number | string;
    credit: number | string;
    prev_balance: number | string;
    new_balance: number | string;
    show_previous_credit_history?: boolean;
    prev_pending_credit?: number | string | null;
    prev_pending_orders?: number | string | null;
    registered_customer_name?: string | null;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface CreditSaleReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: CreditSaleReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface CreditPaymentInvoiceInput {
    invoice_no?: number | string | null;
    order_no: number | string;
    order_date?: string | Date | null;
    order_taker?: string | null;
    paid: number | string;
}

export interface CreditPaymentReceivedPrintInput {
    customer: string;
    account_label?: string | null;
    customer_phone?: string | null;
    invoices: CreditPaymentInvoiceInput[];
    total_paid: number | string;
    prev_balance: number | string;
    remaining: number | string;
    cashier?: string | null;
    pos_user_label?: string | null;
    counter_id?: string | number | null;
    payment_date?: string | Date | null;
    method?: string | null;
    reference_number?: string | null;
    detail_lines?: Array<{ label: string; value: string }>;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface CreditPaymentReceivedPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: CreditPaymentReceivedPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface OutstandingOrderItemInput {
    order_no: number | string;
    date: string | Date;
    total: number | string;
    paid: number | string;
    balance: number | string;
}

export interface OutstandingOrdersReportPrintInput {
    customer: string;
    orders: OutstandingOrderItemInput[];
    total_outstanding: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface OutstandingOrdersReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: OutstandingOrdersReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface WalletTopUpReceiptPrintInput {
    customer: string;
    added: number | string;
    prev_balance: number | string;
    new_balance: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface WalletTopUpReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: WalletTopUpReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface WalletPaymentReceiptPrintInput {
    order_no: number | string;
    wallet_used: number | string;
    before: number | string;
    after: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface WalletPaymentReceiptPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: WalletPaymentReceiptPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface XReportPaymentsInput {
    cash?: number | string;
    card?: number | string;
    online?: number | string;
}

export interface XReportPrintInput {
    orders: number | string;
    gross_sales: number | string;
    payments: XReportPaymentsInput;
    returns: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface XReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: XReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface CounterSessionXReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: any;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface ZReportPaymentsInput {
    cash?: number | string;
    card?: number | string;
    online?: number | string;
}

export interface ZReportPrintInput {
    orders: number | string;
    gross: number | string;
    discount: number | string;
    returns: number | string;
    net: number | string;
    payments: ZReportPaymentsInput;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface ZReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: ZReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface DayClosingPaymentsInput {
    cash?: number | string;
    card?: number | string;
    online?: number | string;
}

export interface DayClosingReportPrintInput {
    business_day_title?: string | null;
    business_date?: string | null;
    opened_at?: string | Date | null;
    closed_at?: string | Date | null;
    closed_by?: string | null;
    notes?: string | null;
    sales_counter_count?: number | string;
    closed_counter_count?: number | string;
    orders: number | string;
    gross: number | string;
    discounts: number | string;
    returns: number | string;
    net: number | string;
    payments: DayClosingPaymentsInput;
    sections?: {
        cash_summary?: {
            opening_cash?: number | string;
            net_cash_sale?: number | string;
            cash_sale?: number | string;
            cash_expense?: number | string;
            cash_refund?: number | string;
            total_cash_in_hand?: number | string;
        };
        cash_actual_vs_expected?: {
            expected_cash?: number | string;
            actual_cash?: number | string;
            variance?: number | string;
        };
        pos_summary?: {
            cash_sale?: number | string;
            online_payment_sale?: number | string;
            credit_card_sale?: number | string;
            wallet_sale?: number | string;
            total_sale?: number | string;
            returned_orders?: number | string;
            returned_amount?: number | string;
            customer_count?: number | string;
            total_orders?: number | string;
            total_kots?: number | string;
            discount_amount?: number | string;
            voided_orders?: number | string;
            voided_amount?: number | string;
            completed_orders?: number | string;
        };
        wallet_summary?: {
            wallet_used_today?: number | string;
            added_in_wallet_today?: number | string;
            current_closing_balance?: number | string;
        };
        credit_summary?: {
            total_credited_sale_today?: number | string;
            credited_orders_count?: number | string;
            previously_pending_credit?: number | string;
            credited_amount_received?: number | string;
            net_credit_balance?: number | string;
        };
        expense_summary?: {
            expense_from_cash_counter?: number | string;
            sales_expense_ratio?: number | string;
            total_expense?: number | string;
        };
        order_type_summary?: Array<{
            type?: string | null;
            orders?: number | string | null;
            amount?: number | string | null;
        }>;
        sold_items_summary?: Array<{
            item?: string | null;
            qty?: number | string | null;
            gross_sale?: number | string | null;
            returns_qty?: number | string | null;
            returned_amount?: number | string | null;
            net_sale?: number | string | null;
        }>;
        station_wise_sale?: Array<{
            station?: string | null;
            orders?: number | string | null;
            sales_amount?: number | string | null;
        }>;
    };
    expenses: number | string;
    variance: number | string;
    counters?: Array<{
        counter_name: string;
        cashier_name?: string | null;
        status?: string | null;
        opening_cash?: number | string | null;
        orders?: number | string | null;
        net_sales?: number | string | null;
        expected_cash?: number | string | null;
        actual_cash?: number | string | null;
        variance?: number | string | null;
        opened_at?: string | Date | null;
        closed_at?: string | Date | null;
    }>;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface DayClosingReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: DayClosingReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface DailyStockMovementItemInput {
    name: string;
    opening: number | string;
    received: number | string;
    issued: number | string;
    closing: number | string;
}

export interface DailyStockMovementReportPrintInput {
    items: DailyStockMovementItemInput[];
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface DailyStockMovementReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: DailyStockMovementReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface CashReconciliationReportPrintInput {
    expected: number | string;
    actual: number | string;
    variance: number | string;
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface CashReconciliationReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: CashReconciliationReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

export interface HourlySalesItemInput {
    hour: string;
    orders: number | string;
    sales: number | string;
}

export interface HourlySalesReportPrintInput {
    hours: HourlySalesItemInput[];
    printed_at?: string | Date | null;
    print_id?: string | number | null;
}

export interface HourlySalesReportPrintTemplateOptions {
    settings: PrintTemplateSettings;
    data: HourlySalesReportPrintInput;
    format?: PrintPaperFormat;
    copy_label?: string | null;
}

const DASHED_SEPARATOR = '--------------------------------';

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const compactDateTime = (value: string | Date | null | undefined) => {
    if (!value) {
        return '-';
    }
    const asDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(asDate.getTime())) {
        return String(value);
    }
    return asDate.toLocaleString('en-PK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const receiptDateTime = (value: string | Date | null | undefined) => {
    if (!value) {
        return '';
    }
    const asDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(asDate.getTime())) {
        return String(value);
    }
    const date = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
    }).format(asDate);
    const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(asDate).replace(' ', '').toLowerCase();
    return `${date} - ${time}`;
};

const normalizeLabel = (value: string | null | undefined) => {
    const normalized = String(value || '')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim();

    if (!normalized) {
        return '-';
    }

    return normalized.replace(/\b\w/g, (token) => token.toUpperCase());
};

const isCashPaymentMethod = (value: string | null | undefined) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return normalized === 'cash';
};

const hasDisplayAmount = (value: unknown) => {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === 'number') {
        return Math.abs(value) > 0.000001;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return false;
    }

    const numeric = Number(normalized.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(numeric)) {
        return Math.abs(numeric) > 0.000001;
    }

    return true;
};

const renderBrandBlock = (settings: PrintTemplateSettings) => {
    const lines = [
        settings.logo_url
            ? `<div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div>`
            : '',
        settings.company_name ? `<div class="brand-name">${escapeHtml(settings.company_name)}</div>` : '',
        settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : '',
        settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : '',
        settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : '',
    ].filter(Boolean);

    return lines.length > 0 ? `<div class="brand-block">${lines.join('')}</div>` : '';
};

const renderMetaLine = (label: string, value: unknown) => `
    <div class="meta-row">
        <span class="meta-label">${escapeHtml(label)}</span>
        <span class="meta-value">${escapeHtml(value || '-')}</span>
    </div>
`;

const renderReceiptFooterBlock = (settings: PrintTemplateSettings) => {
    const lines = [settings.footer_1, settings.footer_2]
        .filter((line) => String(line || '').trim().length > 0)
        .map((line) => `<div class="footer-message">${escapeHtml(line)}</div>`)
        .join('');

    if (!lines) {
        return '';
    }

    return `
        <section class="receipt-paid-footer-block">
            ${lines}
        </section>
        <div class="separator receipt-paid-footer-separator">${DASHED_SEPARATOR}</div>
    `;
};

const renderKOTMetaCell = (label: string, value: unknown, extraClass = '') => `
    <div class="kot-new-meta-cell ${escapeHtml(extraClass)}">
        <div class="kot-new-meta-label">${escapeHtml(label)}</div>
        <div class="kot-new-meta-value">${escapeHtml(value || '-')}</div>
    </div>
`;

const renderKOTItemBlocks = (items: KOTPrintItemInput[]) =>
    items
        .map((item) => {
            const modifiers = (item.modifiers || [])
                .filter((modifier) => String(modifier || '').trim().length > 0)
                .map((modifier) => `<div class="kot-new-modifier">${escapeHtml(modifier)}</div>`)
                .join('');

            return `
                <div class="kot-new-item">
                    <div class="kot-new-item-qty">${escapeHtml(item.qty)}</div>
                    <div class="kot-new-item-main">
                        <div class="kot-new-item-name">${escapeHtml(item.name)}</div>
                        ${modifiers ? `<div class="kot-new-item-modifiers">${modifiers}</div>` : ''}
                    </div>
                </div>
            `;
        })
        .join('');

const mapKOTChangeLabel = (label: 'ADD' | 'CANCEL' | 'MODIFY') => {
    if (label === 'ADD') return 'NEW ITEM';
    if (label === 'MODIFY') return 'QTY CHANGE';
    return 'CANCEL';
};

const renderKOTChangeItemBlocks = (items: KOTChangeItemInput[], label: 'ADD' | 'CANCEL') =>
    items
        .map((item) => {
            const modifiers = (item.modifiers || [])
                .filter((modifier) => String(modifier || '').trim().length > 0)
                .map((modifier) => `<div class="kot-new-modifier">${escapeHtml(modifier)}</div>`)
                .join('');

            return `
                <div class="kot-change-item kot-change-item-${label.toLowerCase()}">
                    <div class="kot-change-item-top">
                        <div class="kot-change-item-tag">${escapeHtml(mapKOTChangeLabel(label))}</div>
                        <div class="kot-change-item-qty">${escapeHtml(item.qty ?? '-')}</div>
                    </div>
                    <div class="kot-change-item-name">${escapeHtml(item.name)}</div>
                    ${modifiers ? `<div class="kot-new-item-modifiers">${modifiers}</div>` : ''}
                </div>
            `;
        })
        .join('');

const renderKOTModifyItemBlocks = (items: KOTModifyItemInput[]) =>
    items
        .map(
            (item) => `
                <div class="kot-change-item kot-change-item-modify">
                    <div class="kot-change-item-top">
                        <div class="kot-change-item-tag">${escapeHtml(mapKOTChangeLabel('MODIFY'))}</div>
                        <div class="kot-change-item-shift">${escapeHtml(item.old_qty)} -> ${escapeHtml(item.new_qty)}</div>
                    </div>
                    <div class="kot-change-item-name">${escapeHtml(item.name)}</div>
                    ${Array.isArray(item.modifiers) && item.modifiers.length > 0
                        ? `<div class="kot-change-item-modifiers">${item.modifiers.map((modifier) => `<div class="kot-change-item-modifier">${escapeHtml(modifier)}</div>`).join('')}</div>`
                        : ''}
                </div>
            `,
        )
        .join('');

const renderKOTChangeSection = (title: 'ADD' | 'CANCEL' | 'MODIFY', content: string, isVisible: boolean) => {
    if (!isVisible) {
        return '';
    }

    return `
        <section class="kot-change-section kot-change-section-${title.toLowerCase()}">
            <div class="kot-change-section-title">${escapeHtml(mapKOTChangeLabel(title))}</div>
            <div class="kot-change-section-body">${content}</div>
        </section>
    `;
};

const renderBillTotalLine = (label: string, value: unknown, emphasize = false) => `
    <div class="bill-total-row ${emphasize ? 'bill-total-row-emphasis' : ''}">
        <span class="bill-total-label">${escapeHtml(label)}</span>
        <span class="bill-total-value">${escapeHtml(value)}</span>
    </div>
`;

const renderPaymentReceiptTableRows = (items: PaymentReceiptItemInput[]) =>
    items
        .map(
            (item) => `
                <tr>
                    <td class="receipt-paid-item-name">${escapeHtml(item.name)}</td>
                    <td class="receipt-paid-cell-center">${escapeHtml(item.qty ?? '-')}</td>
                    <td class="receipt-paid-cell-right">${escapeHtml(item.price ?? '-')}</td>
                    <td class="receipt-paid-cell-right">${escapeHtml(item.total ?? '-')}</td>
                </tr>
            `,
        )
        .join('');

const renderCreditPaymentInvoiceRows = (items: CreditPaymentInvoiceInput[]) =>
    items
        .map(
            (item) => `
                <tr>
                    <td class="credit-payment-order-cell">
                        <div class="credit-payment-order-title">${escapeHtml(item.invoice_no || `Invoice ${item.order_no}`)}</div>
                        <div class="credit-payment-order-meta">Order No: ${escapeHtml(item.order_no)}</div>
                        <div class="credit-payment-order-meta">Order Date: ${escapeHtml(compactDateTime(item.order_date || '-'))}</div>
                        <div class="credit-payment-order-meta">Order Taker: ${escapeHtml(item.order_taker || '-')}</div>
                    </td>
                    <td class="receipt-paid-cell-right">${escapeHtml(item.paid)}</td>
                </tr>
            `,
        )
        .join('');

const renderOutstandingOrderRows = (items: OutstandingOrderItemInput[]) =>
    items
        .map(
            (item) => `
                <div class="return-item-block">
                    <div class="return-item-name">Order ${escapeHtml(item.order_no)}</div>
                    <div class="return-item-grid">
                        <span class="return-grid-label">Date</span>
                        <span class="return-grid-value">${escapeHtml(compactDateTime(item.date))}</span>
                        <span class="return-grid-label">Total</span>
                        <span class="return-grid-value">${escapeHtml(item.total)}</span>
                        <span class="return-grid-label">Paid</span>
                        <span class="return-grid-value">${escapeHtml(item.paid)}</span>
                        <span class="return-grid-label">Balance</span>
                        <span class="return-grid-value">${escapeHtml(item.balance)}</span>
                    </div>
                </div>
            `,
        )
        .join('');

const renderDailyStockMovementRows = (items: DailyStockMovementItemInput[]) =>
    items
        .map(
            (item) => `
                <div class="return-item-block">
                    <div class="return-item-name">${escapeHtml(item.name)}</div>
                    <div class="return-item-grid">
                        <span class="return-grid-label">Opening</span>
                        <span class="return-grid-value">${escapeHtml(item.opening)}</span>
                        <span class="return-grid-label">Received</span>
                        <span class="return-grid-value">${escapeHtml(item.received)}</span>
                        <span class="return-grid-label">Issued</span>
                        <span class="return-grid-value">${escapeHtml(item.issued)}</span>
                        <span class="return-grid-label">Closing</span>
                        <span class="return-grid-value">${escapeHtml(item.closing)}</span>
                    </div>
                </div>
            `,
        )
        .join('');

const renderHourlySalesRows = (items: HourlySalesItemInput[]) =>
    items
        .map(
            (item) => `
                <div class="return-item-block">
                    <div class="return-item-name">${escapeHtml(item.hour)}</div>
                    <div class="return-item-grid">
                        <span class="return-grid-label">Orders</span>
                        <span class="return-grid-value">${escapeHtml(item.orders)}</span>
                        <span class="return-grid-label">Sales</span>
                        <span class="return-grid-value">${escapeHtml(item.sales)}</span>
                    </div>
                </div>
            `,
        )
        .join('');

const resolveServiceLabel = (data: KOTPrintInput): [string, string] => {
    if (data.table) {
        return ['Table', String(data.table)];
    }
    if (data.token) {
        return ['Token', String(data.token)];
    }
    if (data.rider) {
        return ['Rider', String(data.rider)];
    }
    return ['Ref', '-'];
};

const buildBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: KOTPrintTemplateOptions) => {
    const [serviceLabel, serviceValue] = resolveServiceLabel(data);
    const printedBy = data.printed_by || data.server || '-';
    const footer = settings.kot_footer_message
        ? `<div class="footer-message">${escapeHtml(settings.kot_footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="kot-new-layout">
                    <header class="kot-new-header">
                        <div class="kot-new-brand">
                            ${settings.kot_logo_url ? `<div class="kot-new-logo-slot"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.kot_logo_url)}" alt="Logo" /></div></div>` : ''}
                            <div class="kot-new-brand-main">
                                ${settings.kot_company_name ? `<div class="kot-new-brand-name">${escapeHtml(settings.kot_company_name)}</div>` : ''}
                                ${settings.kot_branch_name ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_branch_name)}</div>` : ''}
                                ${settings.kot_address ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_address)}</div>` : ''}
                                ${settings.kot_phone ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_phone)}</div>` : ''}
                            </div>
                        </div>
                        <div class="kot-new-title-row">
                            <div class="kot-new-title">KITCHEN ORDER TICKET</div>
                            <div class="kot-new-status">NEW ORDER</div>
                        </div>
                        ${copy_label ? `<div class="kot-new-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </header>

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <section class="kot-new-meta-grid">
                        ${renderKOTMetaCell('KOT No', data.kot_no, 'kot-new-meta-cell-key')}
                        ${renderKOTMetaCell('Order No', data.order_no, 'kot-new-meta-cell-key')}
                        ${renderKOTMetaCell('Date & Time', compactDateTime(data.datetime))}
                        ${renderKOTMetaCell('Order Type', normalizeLabel(data.order_type))}
                        ${renderKOTMetaCell(serviceLabel, serviceValue)}
                        ${renderKOTMetaCell('Guests', data.guests ?? '-')}
                        ${renderKOTMetaCell('Server', data.server ?? '-')}
                    </section>

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <section class="kot-new-items">
                        <div class="kot-new-section-title">ITEMS</div>
                        ${renderKOTItemBlocks(data.items || [])}
                    </section>

                    ${
                        data.notes
                            ? `
                                <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>
                                <section class="kot-new-notes">
                                    <div class="kot-new-section-title">SPECIAL INSTRUCTIONS</div>
                                    <div class="kot-new-notes-body">${escapeHtml(data.notes)}</div>
                                </section>
                            `
                            : ''
                    }

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <footer class="audit-section kot-new-audit">
                        ${renderMetaLine('Printed By', printedBy)}
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                        ${footer}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const KOT_PRINT_CSS = `
    :root {
        color-scheme: light;
    }

    * {
        box-sizing: border-box;
    }

    body {
        margin: 0;
        background: #f3f4f6;
        color: #111111;
        font-family: "Courier New", Courier, monospace;
    }

    .kot-print-root {
        display: flex;
        justify-content: center;
        padding: 6px;
    }

    .kot-sheet {
        width: 100%;
        background: #ffffff;
        color: #111111;
        border: 0;
    }

    .format-thermal-80mm .kot-sheet {
        width: 80mm;
        max-width: 48ch;
        padding: 2.5mm 2.5mm 3mm;
        border-width: 0;
        font-size: 12px;
        line-height: 1.25;
    }

    .format-a6 .kot-sheet {
        width: 105mm;
        min-height: 148mm;
        padding: 4mm;
        font-size: 13px;
        line-height: 1.35;
    }

    .format-a5 .kot-sheet {
        width: 148mm;
        min-height: 210mm;
        padding: 6mm;
        font-size: 13px;
        line-height: 1.4;
    }

    .format-a4 .kot-sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 7mm;
        font-size: 13px;
        line-height: 1.42;
    }

    .brand-block,
    .doc-header,
    .footer-message {
        text-align: center;
    }

    .brand-block {
        margin-bottom: 8px;
    }

    .brand-logo-wrap {
        margin-bottom: 6px;
    }

    .brand-logo {
        max-width: 26mm;
        max-height: 16mm;
        object-fit: contain;
    }

    .brand-name {
        font-size: 1.15em;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .brand-meta {
        margin-top: 2px;
        font-size: 0.92em;
    }

    .doc-title-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
    }

    .doc-title {
        font-size: 1.32em;
        font-weight: 700;
        letter-spacing: 0.06em;
    }

    .format-a6 .doc-title,
    .format-a5 .doc-title,
    .format-a4 .doc-title {
        font-size: 1.65em;
    }

    .doc-copy {
        font-size: 0.92em;
        font-weight: 700;
        white-space: nowrap;
    }

    .doc-subtitle {
        margin-top: 4px;
        font-size: 1em;
        font-weight: 700;
        letter-spacing: 0.08em;
    }

    .separator {
        overflow: hidden;
        margin: 7px 0;
        white-space: nowrap;
        font-size: 1em;
        letter-spacing: 0.02em;
    }

    .meta-section,
    .audit-section {
        display: grid;
        gap: 4px;
    }

    .meta-row {
        display: grid;
        grid-template-columns: 12ch 1fr;
        align-items: baseline;
        gap: 8px;
    }

    .format-a6 .meta-row,
    .format-a5 .meta-row,
    .format-a4 .meta-row {
        grid-template-columns: 14ch 1fr;
    }

    .meta-label {
        font-weight: 700;
        text-transform: uppercase;
    }

    .meta-value {
        min-width: 0;
        font-weight: 600;
        word-break: break-word;
        text-align: right;
    }

    .items-header,
    .item-row,
    .item-modifier-row {
        display: grid;
        grid-template-columns: 5ch 1fr;
        gap: 8px;
    }

    .items-header {
        font-weight: 700;
        text-transform: uppercase;
    }

    .items-qty-head {
        text-align: left;
    }

    .item-block + .item-block {
        margin-top: 10px;
    }

    .item-qty {
        font-weight: 700;
    }

    .item-name {
        font-weight: 800;
        text-transform: uppercase;
        word-break: break-word;
    }

    .change-section + .change-section {
        margin-top: 10px;
    }

    .change-section-title {
        margin-bottom: 6px;
        padding: 4px 6px;
        border: 1px solid #111111;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-align: center;
    }

    .change-section-add .change-section-title {
        background: #e9f7ef;
    }

    .change-section-cancel .change-section-title {
        background: #fdecea;
    }

    .change-section-modify .change-section-title {
        background: #fff7e6;
    }

    .change-item-block {
        border: 1px dashed #111111;
        padding: 6px;
    }

    .change-item-block + .change-item-block {
        margin-top: 8px;
    }

    .change-item-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
    }

    .change-item-tag {
        font-weight: 800;
        letter-spacing: 0.06em;
    }

    .change-item-qty,
    .change-qty-shift {
        font-weight: 800;
        white-space: nowrap;
    }

    .change-item-name {
        margin-top: 4px;
        font-weight: 800;
        text-transform: uppercase;
        word-break: break-word;
    }

    .change-empty {
        font-weight: 700;
        text-align: center;
        padding: 8px 0;
    }

    .bill-items-header {
        display: grid;
        grid-template-columns: 1fr 11ch;
        gap: 8px;
        font-weight: 800;
        text-transform: uppercase;
    }

    .bill-items-header > :last-child {
        text-align: right;
    }

    .bill-item-block + .bill-item-block {
        margin-top: 8px;
    }

    .bill-item-head {
        display: grid;
        grid-template-columns: 1fr 11ch;
        gap: 8px;
        align-items: start;
    }

    .bill-item-name {
        font-weight: 800;
        text-transform: uppercase;
        word-break: break-word;
    }

    .bill-item-total {
        text-align: right;
        font-weight: 800;
        white-space: nowrap;
    }

    .bill-item-meta {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 2px;
        color: #3f3f46;
    }

    .bill-item-qty,
    .bill-item-price {
        white-space: nowrap;
    }

    .bill-total-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: baseline;
    }

    .bill-total-row + .bill-total-row {
        margin-top: 4px;
    }

    .bill-total-label {
        font-weight: 700;
        text-transform: uppercase;
    }

    .bill-total-value {
        text-align: right;
        font-weight: 800;
        white-space: nowrap;
    }

    .bill-total-row-emphasis .bill-total-label,
    .bill-total-row-emphasis .bill-total-value {
        font-size: 1.08em;
    }

    .receipt-paid-layout {
        display: grid;
        gap: 8px;
        border: 0;
        padding: 8px 8px 7px;
        background: #ffffff;
        font-size: 11px;
        line-height: 1.22;
    }

    .receipt-paid-brand {
        display: grid;
        grid-template-columns: 56px 1fr;
        align-items: start;
        gap: 8px;
        padding-bottom: 0;
    }

    .receipt-paid-brand .brand-block {
        margin: 0;
        text-align: center;
    }

    .receipt-paid-logo-slot {
        width: 58px;
        min-height: 58px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .receipt-paid-brand .brand-logo-wrap {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 0;
        overflow: visible;
        background: #ffffff;
    }

    .receipt-paid-brand .brand-logo {
        max-width: 54px;
        max-height: 54px;
        object-fit: contain;
    }

    .receipt-paid-title-wrap {
        text-align: center;
    }

    .receipt-paid-subtitle {
        margin-top: 3px;
        font-size: 0.88em;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }

    .receipt-paid-header-separator {
        grid-column: 1 / -1;
        margin-top: -4px;
        margin-bottom: 2px;
        height: 0;
        border-top: 2px double #111111;
    }

    .receipt-paid-order-row {
        grid-column: 1 / -1;
        margin-top: -5px;
        display: grid;
        gap: 4px;
        justify-items: center;
        text-align: center;
    }

    .receipt-paid-title {
        font-size: 1.3em;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 1.05;
    }

    .receipt-paid-order-no {
        display: inline-block;
        padding: 4px 11px 3px;
        background: #f7f7f7;
        border: 1.5px solid #111111;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 1em;
        white-space: nowrap;
    }

    .receipt-paid-datetime {
        font-size: 0.88em;
        display: inline-block;
        text-align: center;
    }

    .receipt-paid-meta {
        display: grid;
        gap: 5px;
        padding: 7px 8px;
        border: 1.5px solid #111111;
        background: #fcfcfc;
    }

    .receipt-paid-meta-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 6px;
        align-items: baseline;
    }

    .receipt-paid-meta-row-split {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
    }

    .receipt-paid-meta-field {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 6px;
        align-items: baseline;
        min-width: 0;
    }

    .receipt-paid-meta-label {
        font-weight: 800;
        white-space: nowrap;
        font-size: 0.88em;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .receipt-paid-meta-value {
        min-height: 1.1em;
        font-weight: 700;
        padding: 0;
        font-size: 0.92em;
        min-width: 0;
    }

    .receipt-paid-status {
        padding: 6px 0 5px;
        border: 1.5px solid #111111;
        background: #f7f7f7;
        color: #111111;
        text-align: center;
        font-size: 1.18em;
        font-weight: 900;
        letter-spacing: 0.18em;
        line-height: 1;
    }

    .receipt-paid-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: #ffffff;
        border: 1.5px solid #111111;
    }

    .receipt-paid-section-title {
        margin: 0;
        padding: 0 8px 6px;
        font-size: 0.82em;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        text-align: center;
    }

    .receipt-paid-table th,
    .receipt-paid-table td {
        border: 1px solid #111111;
        padding: 2px 3px;
        vertical-align: top;
        font-size: 0.88em;
        line-height: 1.1;
    }

    .receipt-paid-table th {
        font-weight: 800;
        text-transform: uppercase;
        text-align: center;
        background: #f3f4f6;
        letter-spacing: 0.03em;
        padding-top: 3px;
        padding-bottom: 3px;
    }

    .receipt-paid-item-name {
        font-weight: 700;
        word-break: break-word;
        padding-right: 6px;
    }

    .receipt-paid-cell-center {
        text-align: center;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }

    .receipt-paid-cell-right {
        text-align: right;
        white-space: nowrap;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum" 1;
    }

    .receipt-paid-summary {
        width: 100%;
        border: 1.5px solid #111111;
        background: #ffffff;
    }

    .receipt-paid-history {
        margin-top: 14px;
        border: 1.5px solid #111111;
        background: #fbfbfb;
        padding: 6px 0 0;
    }

    .receipt-paid-summary-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        padding: 5px 8px;
        border-top: 1px solid #111111;
        align-items: baseline;
    }

    .receipt-paid-summary-row:first-child {
        border-top: 0;
    }

    .receipt-paid-summary-label {
        font-weight: 800;
        text-align: left;
        font-size: 0.9em;
    }

    .receipt-paid-summary-value {
        min-width: 10ch;
        text-align: right;
        font-weight: 700;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum" 1;
    }

    .receipt-paid-summary-mid {
        min-width: 6ch;
        text-align: center;
        font-weight: 700;
        white-space: nowrap;
    }

    .receipt-paid-summary-row.emphasis .receipt-paid-summary-label,
    .receipt-paid-summary-row.emphasis .receipt-paid-summary-value {
        font-size: 1.04em;
        font-weight: 900;
    }

    .receipt-paid-summary-row.emphasis {
        background: #f2f2f2;
    }

    .sale-return-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding: 9px 10px;
        border: 1.5px solid #a73f3f;
        background:
            linear-gradient(135deg, rgba(167, 63, 63, 0.08) 0%, rgba(255, 245, 238, 0.92) 58%, rgba(255, 255, 255, 1) 100%);
    }

    .sale-return-hero-main {
        display: grid;
        gap: 4px;
        min-width: 0;
    }

    .sale-return-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        padding: 2px 8px;
        border: 1px solid #a73f3f;
        background: rgba(167, 63, 63, 0.1);
        color: #7e1f1f;
        font-size: 0.74em;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .sale-return-hero-title {
        font-size: 1.34em;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        line-height: 1;
        color: #7e1f1f;
    }

    .sale-return-hero-subtitle {
        font-size: 0.84em;
        color: #5c5c5c;
        font-weight: 700;
        line-height: 1.2;
    }

    .sale-return-hero-side {
        display: grid;
        gap: 2px;
        min-width: 0;
        padding: 4px 0 4px 10px;
        border-left: 1px dashed rgba(167, 63, 63, 0.55);
        text-align: right;
    }

    .sale-return-hero-kpi-label {
        font-size: 0.72em;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #7e1f1f;
    }

    .sale-return-hero-kpi-value {
        font-size: 1.28em;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        color: #111111;
    }

    .sale-return-facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    .sale-return-fact {
        display: grid;
        gap: 2px;
        padding: 7px 8px 6px;
        border: 1px solid #d8b1b1;
        background: #fff8f8;
    }

    .sale-return-fact-label {
        font-size: 0.74em;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7e1f1f;
    }

    .sale-return-fact-value {
        font-size: 0.94em;
        font-weight: 800;
        line-height: 1.18;
        word-break: break-word;
    }

    .sale-return-items {
        display: grid;
        gap: 6px;
    }

    .sale-return-items .receipt-paid-table th {
        background: #fbeaea;
        color: #651313;
    }

    .sale-return-items .receipt-paid-item-name {
        font-weight: 800;
    }

    .sale-return-summary {
        border-color: #a73f3f;
        background: #fffdfd;
    }

    .sale-return-summary .receipt-paid-summary-row.emphasis {
        background: #fbeaea;
    }

    .sale-return-notes {
        border: 1.5px solid #d8b1b1;
        background: #fff8f8;
        padding: 8px 9px;
    }

    .sale-return-notes .section-title {
        color: #7e1f1f;
        font-weight: 900;
        letter-spacing: 0.08em;
        font-size: 0.82em;
    }

    .sale-return-notes .notes-body {
        font-weight: 700;
        line-height: 1.3;
    }

    .receipt-paid-footer-separator {
        margin: 0 auto;
        text-align: center;
        letter-spacing: 0.02em;
        white-space: nowrap;
    }

    .receipt-paid-footer-block {
        margin-top: -14px;
        padding-top: 0;
        text-align: center;
    }

    .receipt-paid-footer-block .footer-message + .footer-message {
        margin-top: 4px;
    }

    .receipt-paid-audit {
        margin-top: 4px;
        gap: 2px;
        font-size: 0.72em;
        line-height: 1.15;
    }

    .receipt-paid-audit .meta-label,
    .receipt-paid-audit .meta-value {
        font-size: inherit;
    }

    .kot-new-layout {
        display: grid;
        gap: 8px;
    }

    .kot-new-header {
        display: grid;
        gap: 6px;
    }

    .kot-new-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
    }

    .kot-new-logo-slot {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
    }

    .kot-new-brand .brand-logo-wrap {
        margin-bottom: 0;
    }

    .kot-new-brand-main {
        min-width: 0;
        width: 100%;
        text-align: center;
    }

    .kot-new-brand-name {
        font-size: 1.15em;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.05;
    }

    .kot-new-brand-meta {
        margin-top: 1px;
        font-size: 0.9em;
        line-height: 1.2;
        text-align: center;
    }

    .kot-new-title-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
    }

    .kot-new-title {
        font-size: 1.18em;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .kot-new-status {
        padding: 3px 8px;
        border: 2px solid #111111;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        white-space: nowrap;
    }

    .kot-new-copy {
        text-align: right;
        font-size: 0.86em;
        font-weight: 700;
    }

    .kot-new-separator {
        margin: 1px 0;
    }

    .kot-new-meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
    }

    .kot-new-meta-cell {
        border: 1px solid #111111;
        padding: 5px 6px 4px;
    }

    .kot-new-meta-label {
        font-size: 0.8em;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .kot-new-meta-value {
        margin-top: 2px;
        font-size: 0.95em;
        font-weight: 700;
        word-break: break-word;
    }

    .kot-new-meta-cell-key .kot-new-meta-label {
        font-size: 0.84em;
    }

    .kot-new-meta-cell-key .kot-new-meta-value {
        margin-top: 3px;
        font-size: 1.16em;
        font-weight: 900;
        letter-spacing: 0.02em;
    }

    .kot-new-items {
        display: grid;
        gap: 8px;
    }

    .kot-new-section-title {
        font-size: 0.92em;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .kot-new-item {
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 8px;
        align-items: start;
    }

    .kot-new-item + .kot-new-item {
        margin-top: 4px;
        padding-top: 7px;
        border-top: 1px dashed #111111;
    }

    .kot-new-item-qty {
        min-height: 34px;
        padding: 5px 4px;
        border: 1.5px solid #111111;
        text-align: center;
        font-size: 1.16em;
        font-weight: 900;
        line-height: 1.1;
    }

    .kot-new-item-main {
        min-width: 0;
    }

    .kot-new-item-name {
        font-size: 1.14em;
        font-weight: 900;
        text-transform: uppercase;
        line-height: 1.12;
        word-break: break-word;
    }

    .kot-new-item-modifiers {
        margin-top: 4px;
        display: grid;
        gap: 2px;
    }

    .kot-new-modifier {
        padding-left: 10px;
        font-size: 0.88em;
        font-weight: 600;
        line-height: 1.2;
    }

    .kot-new-modifier::before {
        content: "+ ";
        margin-left: -10px;
    }

    .kot-new-notes {
        display: grid;
        gap: 4px;
    }

    .kot-new-notes-body {
        border: 1px solid #111111;
        padding: 6px;
        font-size: 0.95em;
        font-weight: 700;
        line-height: 1.25;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .kot-new-audit {
        gap: 2px;
        font-size: 0.76em;
    }

    .kot-new-audit .meta-label,
    .kot-new-audit .meta-value {
        font-size: inherit;
    }

    .kot-change-layout {
        gap: 10px;
    }

    .kot-change-meta-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .kot-change-sections {
        display: grid;
        gap: 14px;
    }

    .kot-change-section {
        display: grid;
        gap: 8px;
        padding-top: 4px;
    }

    .kot-change-section-title {
        padding: 6px 8px;
        border: 2px solid #111111;
        font-size: 1.08em;
        font-weight: 900;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        box-shadow: inset 0 -1px 0 rgba(17, 17, 17, 0.12);
    }

    .kot-change-section-add .kot-change-section-title {
        background: #dff6e7;
    }

    .kot-change-section-cancel .kot-change-section-title {
        background: #ffdede;
    }

    .kot-change-section-modify .kot-change-section-title {
        background: #fff1cc;
    }

    .kot-change-section-body {
        display: grid;
        gap: 10px;
    }

    .kot-change-item {
        border: 2px dashed #111111;
        border-radius: 8px;
        padding: 9px 9px 8px;
        background: #ffffff;
    }

    .kot-change-item-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .kot-change-item-tag,
    .kot-change-item-qty,
    .kot-change-item-shift {
        font-weight: 900;
        white-space: nowrap;
    }

    .kot-change-item-tag {
        font-size: 0.74em;
        letter-spacing: 0.08em;
    }

    .kot-change-item-qty,
    .kot-change-item-shift {
        font-size: 1.28em;
        line-height: 1;
    }

    .kot-change-item-name {
        margin-top: 5px;
        font-size: 1.28em;
        font-weight: 900;
        text-transform: uppercase;
        line-height: 1.12;
        word-break: break-word;
    }

    .kot-change-item-add {
        background: #f7fff9;
    }

    .kot-change-item-cancel {
        background: #fff7f7;
    }

    .kot-change-item-modify {
        background: #fffdf4;
    }

    .format-thermal-80mm .receipt-paid-layout {
        padding: 5px 3px 4px;
        font-size: 10px;
    }

    .format-thermal-80mm .receipt-paid-logo-slot {
        width: 66px;
        min-height: 66px;
        justify-content: center;
    }

    .format-thermal-80mm .receipt-paid-title {
        font-size: 1em;
    }

    .format-thermal-80mm .receipt-paid-order-no {
        padding: 3px 8px;
        font-size: 0.98em;
    }

    .format-thermal-80mm .receipt-paid-datetime {
        font-size: 0.8em;
    }

    .format-thermal-80mm .receipt-paid-summary {
        width: 100%;
    }

    .format-thermal-80mm .receipt-paid-summary-value {
        min-width: 9ch;
    }

    .format-thermal-80mm .receipt-paid-status {
        background: #ffffff;
        color: #111111;
        border-width: 1px;
        border-top-width: 3px;
        font-size: 1.28em;
    }

    .format-thermal-80mm .sale-return-hero {
        padding: 7px 8px;
        gap: 8px;
    }

    .format-thermal-80mm .sale-return-hero-title {
        font-size: 1.18em;
    }

    .format-thermal-80mm .sale-return-hero-kpi-value {
        font-size: 1.12em;
    }

    .format-thermal-80mm .sale-return-facts {
        gap: 6px;
    }

    .format-thermal-80mm .sale-return-fact {
        padding: 6px 7px 5px;
    }

    .format-thermal-80mm .receipt-paid-table th {
        background: transparent;
    }

    .format-thermal-80mm .receipt-paid-audit {
        font-size: 0.68em;
    }

    .format-thermal-80mm .kot-new-layout {
        gap: 6px;
    }

    .format-thermal-80mm .kot-new-brand {
        gap: 7px;
    }

    .format-thermal-80mm .kot-new-logo-slot {
        min-width: 38px;
    }

    .format-thermal-80mm .kot-new-brand .brand-logo {
        max-width: 20mm;
        max-height: 12mm;
    }

    .format-thermal-80mm .kot-new-brand-name {
        font-size: 1.02em;
    }

    .format-thermal-80mm .kot-new-brand-meta {
        font-size: 0.82em;
    }

    .format-thermal-80mm .kot-new-title {
        font-size: 1.02em;
    }

    .format-thermal-80mm .kot-new-status {
        padding: 2px 6px;
        font-size: 0.84em;
    }

    .format-thermal-80mm .kot-new-meta-grid {
        gap: 4px;
    }

    .format-thermal-80mm .kot-new-meta-cell {
        padding: 4px;
    }

    .format-thermal-80mm .kot-new-meta-label {
        font-size: 0.72em;
    }

    .format-thermal-80mm .kot-new-meta-value {
        font-size: 0.88em;
    }

    .format-thermal-80mm .kot-new-meta-cell-key .kot-new-meta-label {
        font-size: 0.74em;
    }

    .format-thermal-80mm .kot-new-meta-cell-key .kot-new-meta-value {
        font-size: 1.02em;
    }

    .format-thermal-80mm .kot-new-item {
        grid-template-columns: 34px 1fr;
        gap: 6px;
    }

    .format-thermal-80mm .kot-new-item-qty {
        min-height: 30px;
        font-size: 1.12em;
    }

    .format-thermal-80mm .kot-new-item-name {
        font-size: 1.05em;
    }

    .format-thermal-80mm .kot-new-modifier {
        font-size: 0.82em;
    }

    .format-thermal-80mm .kot-new-notes-body {
        padding: 5px;
        font-size: 0.9em;
    }

    .format-thermal-80mm .kot-change-sections {
        gap: 12px;
    }

    .format-thermal-80mm .kot-change-section-title {
        padding: 5px 7px;
        font-size: 0.98em;
    }

    .format-thermal-80mm .kot-change-item {
        padding: 7px 7px 6px;
    }

    .format-thermal-80mm .kot-change-item-tag {
        font-size: 0.7em;
    }

    .format-thermal-80mm .kot-change-item-qty,
    .format-thermal-80mm .kot-change-item-shift {
        font-size: 1.16em;
    }

    .format-thermal-80mm .kot-change-item-name {
        font-size: 1.16em;
    }

    .format-thermal-80mm .receipt-paid-brand .brand-logo-wrap {
        width: 62px;
        height: 62px;
    }

    .format-thermal-80mm .receipt-paid-brand .brand-logo {
        max-width: 60px;
        max-height: 60px;
    }

    .format-a6 .receipt-paid-layout {
        padding: 8px 6px 6px;
        font-size: 11.5px;
    }

    .format-a6 .receipt-paid-title {
        font-size: 1.38em;
    }

    .format-a6 .receipt-paid-order-row {
        margin-top: -4px;
        gap: 12px;
    }

    .format-a6 .receipt-paid-meta {
        padding-left: 12px;
        padding-right: 12px;
    }

    .format-a6 .receipt-paid-audit {
        font-size: 0.7em;
    }

    .format-a6 .kot-new-brand-name {
        font-size: 1.22em;
    }

    .format-a6 .kot-new-title {
        font-size: 1.22em;
    }

    .format-a6 .kot-new-status {
        font-size: 0.9em;
    }

    .format-a6 .kot-change-item-name {
        font-size: 1.06em;
    }

    .return-item-block + .return-item-block {
        margin-top: 10px;
    }

    .return-item-name {
        font-weight: 800;
        text-transform: uppercase;
        word-break: break-word;
    }

    .return-item-grid {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 10px;
        margin-top: 4px;
    }

    .return-grid-label {
        font-weight: 700;
        text-transform: uppercase;
    }

    .return-grid-value {
        text-align: right;
        font-weight: 800;
        white-space: nowrap;
    }

    .status-paid {
        display: inline-block;
        padding: 4px 10px;
        border: 1px solid #111111;
        background: #e9f7ef;
        font-weight: 800;
        letter-spacing: 0.08em;
    }

    .status-partial {
        display: inline-block;
        padding: 4px 10px;
        border: 1px solid #111111;
        background: #fff7e6;
        font-weight: 800;
        letter-spacing: 0.08em;
    }

    .item-modifier-row {
        margin-top: 4px;
        color: #262626;
    }

    .item-modifier-indent {
        font-weight: 700;
    }

    .item-modifier-text {
        padding-left: 2px;
        word-break: break-word;
    }

    .notes-section {
        display: grid;
        gap: 6px;
    }

    .section-title {
        font-weight: 700;
        text-transform: uppercase;
    }

    .notes-body {
        white-space: pre-wrap;
        word-break: break-word;
    }

    .footer-message {
        margin-top: 8px;
        padding-top: 8px;
        font-size: 0.92em;
        white-space: pre-line;
    }

    @media screen {
        .kot-print-host {
            position: fixed;
            left: -99999px;
            top: -99999px;
        }
    }

    @media print {
        @page {
            margin: 0;
        }

        body {
            background: #ffffff;
        }

        body * {
            visibility: hidden !important;
        }

        .kot-print-host,
        .kot-print-host *,
        .kot-print-root,
        .kot-print-root * {
            visibility: visible !important;
        }

        .kot-print-host {
            position: absolute;
            inset: 0;
        }

        .kot-print-root {
            padding: 0;
        }

        .kot-sheet {
            margin: 0;
        }

        .format-thermal-80mm .kot-sheet {
            width: 80mm;
        }

        .format-a6 .kot-sheet {
            width: 105mm;
            min-height: auto;
        }

        .format-a5 .kot-sheet {
            width: 148mm;
            min-height: auto;
        }

        .format-a4 .kot-sheet {
            width: 210mm;
            min-height: auto;
        }
    }
`;

export const buildKOTPrintMarkup = (options: KOTPrintTemplateOptions) => buildBodyMarkup(options);

export const buildKOTPrintDocument = (options: KOTPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>KOT ${escapeHtml(options.data.kot_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildBodyMarkup(options)}
        </body>
    </html>
`;

const buildChangeOnlyBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: KOTChangePrintTemplateOptions) => {
    const footer = settings.kot_footer_message
        ? `<div class="footer-message">${escapeHtml(settings.kot_footer_message)}</div>`
        : '';

    const addMarkup = renderKOTChangeSection('ADD', renderKOTChangeItemBlocks(data.add_items || [], 'ADD'), (data.add_items || []).length > 0);
    const cancelMarkup = renderKOTChangeSection('CANCEL', renderKOTChangeItemBlocks(data.cancel_items || [], 'CANCEL'), (data.cancel_items || []).length > 0);
    const modifyMarkup = renderKOTChangeSection('MODIFY', renderKOTModifyItemBlocks(data.modify_items || []), (data.modify_items || []).length > 0);
    const hasChanges = Boolean(addMarkup || cancelMarkup || modifyMarkup);

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="kot-new-layout kot-change-layout">
                    <header class="kot-new-header">
                        <div class="kot-new-brand">
                            ${settings.kot_logo_url ? `<div class="kot-new-logo-slot"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.kot_logo_url)}" alt="Logo" /></div></div>` : ''}
                            <div class="kot-new-brand-main">
                                ${settings.kot_company_name ? `<div class="kot-new-brand-name">${escapeHtml(settings.kot_company_name)}</div>` : ''}
                                ${settings.kot_branch_name ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_branch_name)}</div>` : ''}
                                ${settings.kot_address ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_address)}</div>` : ''}
                                ${settings.kot_phone ? `<div class="kot-new-brand-meta">${escapeHtml(settings.kot_phone)}</div>` : ''}
                            </div>
                        </div>
                        <div class="kot-new-title-row">
                            <div class="kot-new-title">KOT CHANGE</div>
                            <div class="kot-new-status">CHANGE ONLY</div>
                        </div>
                        ${copy_label ? `<div class="kot-new-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </header>

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <section class="kot-new-meta-grid kot-change-meta-grid">
                        ${renderKOTMetaCell('KOT Ver', data.kot_version, 'kot-new-meta-cell-key')}
                        ${renderKOTMetaCell('Order No', data.order_no, 'kot-new-meta-cell-key')}
                        ${renderKOTMetaCell('Time', compactDateTime(data.datetime))}
                        ${renderKOTMetaCell('User', data.user)}
                    </section>

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <section class="kot-change-sections">
                        ${hasChanges ? `${cancelMarkup}${modifyMarkup}${addMarkup}` : '<div class="change-empty">NO CHANGES</div>'}
                    </section>

                    ${data.notes
                        ? `
                            <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>
                            <section class="kot-new-notes">
                                <div class="kot-new-notes-title">ORDER NOTES</div>
                                <div class="kot-new-notes-body">${escapeHtml(data.notes)}</div>
                            </section>
                        `
                        : ''}

                    <div class="separator kot-new-separator">${DASHED_SEPARATOR}</div>

                    <footer class="audit-section kot-new-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                        ${footer}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildKOTChangePrintMarkup = (options: KOTChangePrintTemplateOptions) =>
    buildChangeOnlyBodyMarkup(options);

export const buildKOTChangePrintDocument = (options: KOTChangePrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>KOT Change ${escapeHtml(options.data.kot_version)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildChangeOnlyBodyMarkup(options)}
        </body>
    </html>
`;

const buildBillSummaryBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: BillSummaryPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);
    const showTax = hasDisplayAmount(data.tax);

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            ${settings.company_name ? `<div class="receipt-paid-title">${escapeHtml(settings.company_name)}</div>` : `<div class="receipt-paid-title">BILL SUMMARY</div>`}
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">ORDER # ${escapeHtml(data.order_no)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.datetime || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="receipt-paid-meta">
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Invoice #:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.receipt_no ?? '')}</span>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Cashier#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.cashier ?? data.counter_id ?? '')}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Server#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.server ?? '')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">OrderType:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(normalizeLabel(data.order_type || '-'))}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Table#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.table ?? '-')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Customer Name:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.customer ?? 'Walk-in Customer')}</span>
                        </div>
                    </section>

                    <div class="receipt-paid-status">UNPAID</div>

                    <section class="items-section">
                        <table class="receipt-paid-table">
                            <thead>
                                <tr>
                                    <th style="width: 50%;">Item</th>
                                    <th style="width: 12%;">QTY</th>
                                    <th style="width: 16%;">Rate</th>
                                    <th style="width: 22%;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderPaymentReceiptTableRows(data.items || [])}
                            </tbody>
                        </table>
                    </section>

                    <section class="receipt-paid-summary">
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Sub-Total:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.subtotal)}</span>
                        </div>
                        ${data.discount !== undefined && data.discount !== null ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Discount:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.discount)}</span>
                            </div>
                        ` : ''}
                        ${showTax ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Tax:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.tax)}</span>
                            </div>
                        ` : ''}
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Grand Total:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.total)}</span>
                        </div>
                    </section>

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildBillSummaryPrintMarkup = (options: BillSummaryPrintTemplateOptions) =>
    buildBillSummaryBodyMarkup(options);

export const buildBillSummaryPrintDocument = (options: BillSummaryPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Bill Summary ${escapeHtml(options.data.order_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildBillSummaryBodyMarkup(options)}
        </body>
    </html>
`;

const buildPaymentReceiptBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: PaymentReceiptPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);
    const showTax = hasDisplayAmount(data.tax);
    const normalizedStatus = String(data.status_label || 'PAID').trim().toUpperCase();
    const receiptTitle = normalizedStatus === 'VOIDED'
        ? 'VOID RECEIPT'
        : settings.company_name ? escapeHtml(settings.company_name) : 'PAYMENT RECEIPT';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            <div class="receipt-paid-title">${receiptTitle}</div>
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">ORDER # ${escapeHtml(data.order_no)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.datetime || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="receipt-paid-meta">
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Invoice #:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.receipt_no ?? '')}</span>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Cashier#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.cashier ?? data.counter_id ?? '')}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Server#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.server ?? '')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">OrderType:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(normalizeLabel(data.order_type || '-'))}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Table#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.table ?? '-')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Customer Name:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.customer ?? 'Walk-in Customer')}</span>
                        </div>
                    </section>

                    <div class="receipt-paid-status">${escapeHtml(normalizedStatus)}</div>

                    <section class="items-section">
                        <table class="receipt-paid-table">
                            <thead>
                                <tr>
                                    <th style="width: 50%;">Item</th>
                                    <th style="width: 12%;">QTY</th>
                                    <th style="width: 16%;">Rate</th>
                                    <th style="width: 22%;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderPaymentReceiptTableRows(data.items || [])}
                            </tbody>
                        </table>
                    </section>

                    <section class="receipt-paid-summary">
                        ${data.subtotal !== undefined && data.subtotal !== null ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Sub-Total:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.subtotal)}</span>
                            </div>
                        ` : ''}
                        ${data.discount !== undefined && data.discount !== null ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Discount:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.discount)}</span>
                            </div>
                        ` : ''}
                        ${showTax ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Tax/VAT:</span>
                                <span class="receipt-paid-summary-mid">${escapeHtml(data.tax_rate_label || '')}</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.tax)}</span>
                            </div>
                        ` : ''}
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Grand Total:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.total)}</span>
                        </div>
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Mode of Payment:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(normalizeLabel(data.method))}</span>
                        </div>
                        ${!data.hide_payment_amounts && isCashPaymentMethod(data.method) ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Amount Received:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.paid)}</span>
                            </div>
                        ` : ''}
                        ${!data.hide_payment_amounts && isCashPaymentMethod(data.method) ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Change Return:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.change)}</span>
                            </div>
                        ` : ''}
                        ${(data.detail_lines || []).map((line) => `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">${escapeHtml(line.label)}:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(line.value)}</span>
                            </div>
                        `).join('')}
                    </section>

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildPaymentReceiptPrintMarkup = (options: PaymentReceiptPrintTemplateOptions) =>
    buildPaymentReceiptBodyMarkup(options);

export const buildPaymentReceiptPrintDocument = (options: PaymentReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Receipt ${escapeHtml(options.data.receipt_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildPaymentReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildPartialPaymentReceiptBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: PartialPaymentReceiptPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">PAYMENT RECEIPT</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle"><span class="status-partial">PARTIAL</span></div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="meta-section">
                    ${renderMetaLine('Order #', data.order_no)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Total', data.total, true)}
                    ${renderBillTotalLine('Paid', data.paid, true)}
                    ${renderBillTotalLine('Balance Due', data.balance, true)}
                    ${renderBillTotalLine('Status', 'PARTIAL')}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildPartialPaymentReceiptPrintMarkup = (options: PartialPaymentReceiptPrintTemplateOptions) =>
    buildPartialPaymentReceiptBodyMarkup(options);

export const buildPartialPaymentReceiptPrintDocument = (options: PartialPaymentReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Partial Receipt ${escapeHtml(options.data.order_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildPartialPaymentReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildSaleReturnReceiptBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: SaleReturnReceiptPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);
    const returnMode = normalizeLabel(data.method || 'cash');
    const orderType = normalizeLabel(data.order_type || '-');
    const cashier = data.cashier || '-';
    const server = data.server || '-';
    const table = data.table ?? '-';
    const returnedItemCount = (data.items || []).reduce((sum, item) => sum + Number(item.returned || 0), 0);
    const detailLines = (data.detail_lines || []).filter((line) => String(line?.label || '').trim() && String(line?.value || '').trim());

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            <div class="receipt-paid-title">${settings.company_name ? escapeHtml(settings.company_name) : 'SALE RETURN RECEIPT'}</div>
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            <div class="receipt-paid-subtitle">Sales Return / Refund Slip</div>
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">ORDER # ${escapeHtml(data.order_no)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.datetime || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="sale-return-hero">
                        <div class="sale-return-hero-main">
                            <div class="sale-return-hero-title">Sales Return</div>
                        </div>
                        <div class="sale-return-hero-side">
                            ${data.return_invoice_no ? `
                            <div class="sale-return-hero-kpi-label">Invoice Number</div>
                            <div class="sale-return-hero-kpi-value">${escapeHtml(data.return_invoice_no)}${data.branch_id ? ` | BR-${escapeHtml(data.branch_id)}` : ''}</div>
                            ` : ''}
                        </div>
                    </section>

                    <section class="receipt-paid-meta">
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Cashier#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(cashier)}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Server#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(server)}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Order Type</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(orderType)}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Table#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(table)}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Customer Name:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.customer ?? 'Walk-in Customer')}</span>
                        </div>
                        ${data.authorized_by ? `
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Authorized By:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(data.authorized_by)}</span>
                        </div>
                        ` : ''}
                    </section>

                    <section class="sale-return-facts">
                        <div class="sale-return-fact">
                            <span class="sale-return-fact-label">Refund Mode</span>
                            <span class="sale-return-fact-value">${escapeHtml(returnMode)}</span>
                        </div>
                        <div class="sale-return-fact">
                            <span class="sale-return-fact-label">Returned Qty</span>
                            <span class="sale-return-fact-value">${escapeHtml(String(returnedItemCount))}</span>
                        </div>
                        <div class="sale-return-fact">
                            <span class="sale-return-fact-label">Return Amount</span>
                            <span class="sale-return-fact-value">${escapeHtml(data.refund)}</span>
                        </div>
                    </section>

                    <div class="receipt-paid-status">SALES RETURN</div>

                    <section class="sale-return-items">
                        <div class="receipt-paid-section-title">Returned Items</div>
                        <table class="receipt-paid-table">
                            <thead>
                                <tr>
                                    <th style="width: 52%;">Item</th>
                                    <th style="width: 16%;">Sold</th>
                                    <th style="width: 16%;">RTRN QTY</th>
                                    <th style="width: 16%;">BAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(data.items || []).map((item) => `
                                    <tr>
                                        <td class="receipt-paid-item-name">${escapeHtml(item.name)}</td>
                                        <td class="receipt-paid-cell-center">${escapeHtml(item.sold)}</td>
                                        <td class="receipt-paid-cell-center">${escapeHtml(item.returned)}</td>
                                        <td class="receipt-paid-cell-center">${escapeHtml(item.balance)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </section>

                    <section class="sale-return-items">
                        <div class="receipt-paid-section-title">Return Amount Details</div>
                        <table class="receipt-paid-table">
                            <thead>
                                <tr>
                                    <th style="width: 46%;">Item</th>
                                    <th style="width: 18%;">Unit Price</th>
                                    <th style="width: 16%;">RTRN QTY</th>
                                    <th style="width: 20%;">Return Amt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(data.items || []).map((item) => `
                                    <tr>
                                        <td class="receipt-paid-item-name">${escapeHtml(item.name)}</td>
                                        <td class="receipt-paid-cell-right">${escapeHtml(item.unit_price ?? '-')}</td>
                                        <td class="receipt-paid-cell-center">${escapeHtml(item.returned)}</td>
                                        <td class="receipt-paid-cell-right">${escapeHtml(item.return_amount ?? '-')}</td>
                                    </tr>
                                `).join('')}
                                <tr>
                                    <td colspan="3" class="receipt-paid-item-name"><strong>Total Return Amount</strong></td>
                                    <td class="receipt-paid-cell-right"><strong>${escapeHtml(data.refund_plain ?? data.refund)}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <section class="receipt-paid-summary sale-return-summary">
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Refund Amount:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.refund)}</span>
                        </div>
                        ${data.method ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Refund Mode:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(returnMode)}</span>
                            </div>
                        ` : ''}
                        ${detailLines.map((line) => `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">${escapeHtml(line.label)}:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(line.value)}</span>
                            </div>
                        `).join('')}
                    </section>

                    <section class="notes-section sale-return-notes">
                        <div class="section-title">Return Reason</div>
                        <div class="notes-body">${escapeHtml(data.reason || '-')}</div>
                    </section>

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildSaleReturnReceiptPrintMarkup = (options: SaleReturnReceiptPrintTemplateOptions) =>
    buildSaleReturnReceiptBodyMarkup(options);

export const buildSaleReturnReceiptPrintDocument = (options: SaleReturnReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Sale Return ${escapeHtml(options.data.return_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildSaleReturnReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildCreditSaleReceiptBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: CreditSaleReceiptPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);
    const showPreviousCreditHistory = Boolean(data.show_previous_credit_history);
    const items = Array.isArray(data.items) ? data.items : [];
    const invoiceNo = String(data.receipt_no ?? '').trim();
    const cashier = String(data.cashier ?? '').trim();
    const server = String(data.server ?? '').trim();
    const orderType = String(normalizeLabel(data.order_type || '')).trim();
    const table = String(data.table ?? '').trim();
    const customer = String(data.customer ?? 'Walk-in Customer').trim() || 'Walk-in Customer';
    const registeredCustomer = String(data.registered_customer_name ?? '').trim();
    const sameStaff = cashier && server && cashier === server;
    const subtotal = data.subtotal == null || String(data.subtotal).trim() === '' ? String(data.total ?? '').trim() : String(data.subtotal).trim();

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            <div class="receipt-paid-title">${settings.company_name ? escapeHtml(settings.company_name) : 'CREDIT SALE RECEIPT'}</div>
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            <div class="receipt-paid-subtitle">Credit Sale Invoice</div>
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">ORDER # ${escapeHtml(data.order_no)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.datetime || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="receipt-paid-meta">
                        ${invoiceNo ? `<div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Invoice #:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(invoiceNo)}</span>
                        </div>` : ''}
                        ${sameStaff ? `
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Staff#:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(cashier)}</span>
                        </div>` : ''}
                        ${!sameStaff && (cashier || server) ? `
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            ${cashier ? `
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Cashier#:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(cashier)}</span>
                            </div>` : '<div class="receipt-paid-meta-field"></div>'}
                            ${server ? `
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Server#:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(server)}</span>
                            </div>` : '<div class="receipt-paid-meta-field"></div>'}
                        </div>` : ''}
                        ${(orderType || table) ? `
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            ${orderType ? `
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Order Type:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(orderType)}</span>
                            </div>` : '<div class="receipt-paid-meta-field"></div>'}
                            ${table ? `
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Table:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(table)}</span>
                            </div>` : '<div class="receipt-paid-meta-field"></div>'}
                        </div>` : ''}
                        <div class="receipt-paid-meta-row">
                            <span class="receipt-paid-meta-label">Customer:</span>
                            <span class="receipt-paid-meta-value">${escapeHtml(customer)}</span>
                        </div>
                    </section>

                    <div class="receipt-paid-status">CREDIT SALE</div>

                    ${items.length > 0 ? `
                    <table class="receipt-paid-table">
                        <thead>
                            <tr>
                                <th style="width:52%">Item</th>
                                <th style="width:12%">Qty</th>
                                <th style="width:18%">Price</th>
                                <th style="width:18%">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item) => `
                                <tr>
                                    <td class="receipt-paid-item-name">${escapeHtml(item.name)}</td>
                                    <td class="receipt-paid-cell-center">${escapeHtml(item.qty ?? '-')}</td>
                                    <td class="receipt-paid-cell-right">${escapeHtml(item.price ?? '-')}</td>
                                    <td class="receipt-paid-cell-right">${escapeHtml(item.total ?? '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>` : ''}

                    <section class="receipt-paid-summary">
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Total:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(subtotal)}</span>
                        </div>
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Grand Total:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.total)}</span>
                        </div>
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Paid:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.paid)}</span>
                        </div>
                            <div class="receipt-paid-summary-row emphasis">
                                <span class="receipt-paid-summary-label">Credit Booked:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.credit)}</span>
                            </div>
                        ${showPreviousCreditHistory ? `
                        <div class="receipt-paid-history">
                            <div class="receipt-paid-section-title">Credit History</div>
                            ${registeredCustomer ? `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Customer:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(registeredCustomer)}</span>
                            </div>` : ''}
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Previous Balance:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.prev_balance)}</span>
                            </div>
                            <div class="receipt-paid-summary-row emphasis">
                                <span class="receipt-paid-summary-label">New / Current Balance:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.new_balance)}</span>
                            </div>
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">Total Pending Orders:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(data.prev_pending_orders ?? '0')}</span>
                            </div>
                        </div>` : ''}
                    </section>

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildCreditSaleReceiptPrintMarkup = (options: CreditSaleReceiptPrintTemplateOptions) =>
    buildCreditSaleReceiptBodyMarkup(options);

export const buildCreditSaleReceiptPrintDocument = (options: CreditSaleReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Credit Sale ${escapeHtml(options.data.order_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildCreditSaleReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildCreditPaymentReceivedBodyMarkup = ({
    settings,
    data,
    format = 'thermal-80mm',
    copy_label,
}: CreditPaymentReceivedPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);
    const companyTitle = settings.company_name ? escapeHtml(settings.company_name) : 'PAYMENT RECEIVED';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout credit-payment-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            <div class="receipt-paid-title">${companyTitle}</div>
                            <div class="credit-payment-subtitle">PAYMENT RECEIVED</div>
                            <div class="credit-payment-subtitle muted">CREDIT ACCOUNT SETTLEMENT</div>
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">${escapeHtml(String(data.account_label || 'Customer').toUpperCase())}: ${escapeHtml(data.customer)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.payment_date || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="receipt-paid-meta">
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Customer</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.customer)}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Phone</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.customer_phone || '-')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">${escapeHtml(data.pos_user_label || 'POS User')}</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.cashier || '-')}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Counter Number</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.counter_id || '-')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Date of Payment</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(compactDateTime(data.payment_date || data.printed_at || new Date()))}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Orders Settled</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(String(data.invoices?.length || 0))}</span>
                            </div>
                        </div>
                    </section>

                    <section class="items-section">
                        <table class="receipt-paid-table credit-payment-table">
                            <thead>
                                <tr>
                                    <th style="width: 74%;">Invoices Paid</th>
                                    <th style="width: 26%;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.invoices?.length
                                    ? renderCreditPaymentInvoiceRows(data.invoices)
                                    : '<tr><td colspan="2" class="counter-x-empty">No settled invoices</td></tr>'}
                            </tbody>
                        </table>
                    </section>

                    <section class="receipt-paid-summary credit-payment-summary">
                        <div class="credit-payment-summary-title">Payment Mode</div>
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Mode of Payment:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(normalizeLabel(data.method || '-'))}</span>
                        </div>
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Reference:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.reference_number || '-')}</span>
                        </div>
                        ${(data.detail_lines || []).map((line) => `
                            <div class="receipt-paid-summary-row">
                                <span class="receipt-paid-summary-label">${escapeHtml(line.label)}:</span>
                                <span class="receipt-paid-summary-value">${escapeHtml(line.value)}</span>
                            </div>
                        `).join('')}
                    </section>

                    <section class="receipt-paid-summary credit-payment-summary">
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Total Paid:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.total_paid)}</span>
                        </div>
                        <div class="receipt-paid-summary-row">
                            <span class="receipt-paid-summary-label">Previous Balance:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.prev_balance)}</span>
                        </div>
                        <div class="receipt-paid-summary-row emphasis">
                            <span class="receipt-paid-summary-label">Pending Credit:</span>
                            <span class="receipt-paid-summary-value">${escapeHtml(data.remaining)}</span>
                        </div>
                    </section>

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildCreditPaymentReceivedPrintMarkup = (options: CreditPaymentReceivedPrintTemplateOptions) =>
    buildCreditPaymentReceivedBodyMarkup(options);

export const buildCreditPaymentReceivedPrintDocument = (options: CreditPaymentReceivedPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Payment Received ${escapeHtml(options.data.customer)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildCreditPaymentReceivedBodyMarkup(options)}
        </body>
    </html>
`;

const buildOutstandingOrdersReportBodyMarkup = ({
    settings,
    data,
    format = 'a6',
    copy_label,
}: OutstandingOrdersReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">OUTSTANDING ORDERS</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">OPEN BALANCE REPORT</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="meta-section">
                    ${renderMetaLine('Customer', data.customer)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="items-section">
                    ${renderOutstandingOrderRows(data.orders || [])}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Total Outstanding', data.total_outstanding, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildOutstandingOrdersReportPrintMarkup = (options: OutstandingOrdersReportPrintTemplateOptions) =>
    buildOutstandingOrdersReportBodyMarkup(options);

export const buildOutstandingOrdersReportPrintDocument = (options: OutstandingOrdersReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Outstanding Orders ${escapeHtml(options.data.customer)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildOutstandingOrdersReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildWalletTopUpReceiptBodyMarkup = ({
    settings,
    data,
    format = 'thermal-80mm',
    copy_label,
}: WalletTopUpReceiptPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">WALLET TOP-UP</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">BALANCE RECEIPT</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="meta-section">
                    ${renderMetaLine('Customer', data.customer)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Amount Added', data.added, true)}
                    ${renderBillTotalLine('Previous Balance', data.prev_balance)}
                    ${renderBillTotalLine('New Balance', data.new_balance, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildWalletTopUpReceiptPrintMarkup = (options: WalletTopUpReceiptPrintTemplateOptions) =>
    buildWalletTopUpReceiptBodyMarkup(options);

export const buildWalletTopUpReceiptPrintDocument = (options: WalletTopUpReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Wallet Top-Up ${escapeHtml(options.data.customer)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildWalletTopUpReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildWalletPaymentReceiptBodyMarkup = ({
    settings,
    data,
    format = 'thermal-80mm',
    copy_label,
}: WalletPaymentReceiptPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">WALLET PAYMENT</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">PAYMENT RECEIPT</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="meta-section">
                    ${renderMetaLine('Order #', data.order_no)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Wallet Used', data.wallet_used, true)}
                    ${renderBillTotalLine('Balance Before', data.before)}
                    ${renderBillTotalLine('Balance After', data.after, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildWalletPaymentReceiptPrintMarkup = (options: WalletPaymentReceiptPrintTemplateOptions) =>
    buildWalletPaymentReceiptBodyMarkup(options);

export const buildWalletPaymentReceiptPrintDocument = (options: WalletPaymentReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Wallet Payment ${escapeHtml(options.data.order_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildWalletPaymentReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const buildXReportBodyMarkup = ({
    settings,
    data,
    format = 'thermal-80mm',
    copy_label,
}: XReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">X REPORT</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">MID-SHIFT</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Orders', data.orders, true)}
                    ${renderBillTotalLine('Gross Sales', data.gross_sales, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Cash', data.payments?.cash ?? '-')}
                    ${renderBillTotalLine('Card', data.payments?.card ?? '-')}
                    ${renderBillTotalLine('Online', data.payments?.online ?? '-')}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Returns', data.returns, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildXReportPrintMarkup = (options: XReportPrintTemplateOptions) =>
    buildXReportBodyMarkup(options);

export const buildXReportPrintDocument = (options: XReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>X Report</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildXReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildZReportBodyMarkup = ({
    settings,
    data,
    format = 'a6',
    copy_label,
}: ZReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">Z REPORT</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">SHIFT CLOSE</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Orders', data.orders, true)}
                    ${renderBillTotalLine('Gross Sales', data.gross, true)}
                    ${renderBillTotalLine('Discounts', data.discount)}
                    ${renderBillTotalLine('Returns', data.returns)}
                    ${renderBillTotalLine('Net Sales', data.net, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="audit-section">
                    ${renderBillTotalLine('Cash', data.payments?.cash ?? '-')}
                    ${renderBillTotalLine('Card', data.payments?.card ?? '-')}
                    ${renderBillTotalLine('Online', data.payments?.online ?? '-')}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildZReportPrintMarkup = (options: ZReportPrintTemplateOptions) =>
    buildZReportBodyMarkup(options);

export const buildZReportPrintDocument = (options: ZReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Z Report</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildZReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildDayClosingReportBodyMarkup = ({
    settings,
    data,
    format = 'a5',
    copy_label,
}: DayClosingReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';
    const sections = data?.sections || {};
    const cashSummary = sections.cash_summary || {};
    const cashExpected = sections.cash_actual_vs_expected || {};
    const posSummary = sections.pos_summary || {};
    const walletSummary = sections.wallet_summary || {};
    const creditSummary = sections.credit_summary || {};
    const expenseSummary = sections.expense_summary || {};
    const orderTypeSummary = Array.isArray(sections.order_type_summary) ? sections.order_type_summary : [];
    const soldItemsSummary = Array.isArray(sections.sold_items_summary) ? sections.sold_items_summary : [];
    const stationWiseSale = Array.isArray(sections.station_wise_sale) ? sections.station_wise_sale : [];
    const isThermal = format === 'thermal-80mm';
    const branchLabel = `${String(settings.branch_name || settings.company_name || 'Branch')}`;
    const heroMetrics = [
        { label: 'Net Sales', value: data.net ?? '-' },
        { label: 'Orders', value: posSummary.total_orders ?? data.orders ?? '-' },
        { label: 'Cash In Hand', value: cashSummary.total_cash_in_hand ?? '-' },
        { label: 'Variance', value: cashExpected.variance ?? data.variance ?? '-' },
    ];
    const reportMeta = [
        ['Business Date', data.business_date || '-'],
        ['Business Day', data.business_day_title || data.business_date || '-'],
        ['Branch', branchLabel],
        ['Closed By', data.closed_by || '-'],
        ['Opened At', compactDateTime(data.opened_at || '-')],
        ['Closed At', compactDateTime(data.closed_at || data.printed_at || new Date())],
        ['Counters Closed', `${data.closed_counter_count ?? 0} / ${data.sales_counter_count ?? 0}`],
        ['Total Orders', posSummary.total_orders ?? data.orders ?? '-'],
    ];
    const thermalOverviewTable = renderCounterXSimpleTable(
        ['Metric', 'Value'],
        [
            ['Net Sales', data.net ?? '-'],
            ['Gross Sales', data.gross ?? '-'],
            ['Cash In Hand', cashSummary.total_cash_in_hand ?? '-'],
            ['Expected Cash', cashExpected.expected_cash ?? '-'],
            ['Actual Cash', cashExpected.actual_cash ?? '-'],
            ['Variance', cashExpected.variance ?? data.variance ?? '-'],
            ['Counters Closed', `${data.closed_counter_count ?? 0} / ${data.sales_counter_count ?? 0}`],
            ['Total Orders', posSummary.total_orders ?? data.orders ?? '-'],
        ],
    );
    const thermalPaymentsTable = renderCounterXSimpleTable(
        ['Payment Mode', 'Amount'],
        [
            ['Cash', data.payments?.cash ?? '-'],
            ['Card', data.payments?.card ?? '-'],
            ['Online', data.payments?.online ?? '-'],
            ['Wallet', posSummary.wallet_sale ?? '-'],
            ['Credit', creditSummary.total_credited_sale_today ?? '-'],
        ],
    );
    const thermalCounterTable = (data.counters || []).length > 0
        ? renderCounterXSimpleTable(
            ['Counter', 'Net', 'Var'],
            (data.counters || []).map((row: any) => [
                row.counter_name ?? '-',
                row.net_sales ?? '-',
                row.variance ?? '-',
            ]),
        )
        : '<div class="counter-x-line"><div class="counter-x-line-label">No sales counter close records were included.</div><div></div><div class="counter-x-line-value">-</div></div>';

    if (isThermal) {
        return `
            <section class="kot-print-root format-${escapeHtml(format)}">
                <div class="kot-sheet day-close-report day-close-thermal">
                    ${header}
                    <header class="doc-header day-close-header">
                        <div class="day-close-header-top">
                            <div>
                                <div class="day-close-kicker">Business Day Close</div>
                                <div class="doc-title">Z-REPORT</div>
                            </div>
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="doc-subtitle">Consolidated closure for all sales counters</div>
                    </header>

                    <section class="day-close-hero day-close-hero-thermal">
                        ${heroMetrics.map((item) => `
                            <div class="day-close-hero-card">
                                <div class="day-close-hero-label">${escapeHtml(item.label)}</div>
                                <div class="day-close-hero-value">${escapeHtml(String(item.value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </section>

                    <section class="day-close-meta-card">
                        <div class="day-close-section-title">Day Snapshot</div>
                        <div class="day-close-meta-list">
                            ${reportMeta.map(([label, value]) => `
                                <div class="day-close-meta-row">
                                    <span>${escapeHtml(String(label))}</span>
                                    <strong>${escapeHtml(String(value ?? '-'))}</strong>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    ${data.notes ? `
                        <section class="day-close-note">
                            <div class="day-close-section-title">Manager Notes</div>
                            <div class="day-close-note-body">${escapeHtml(String(data.notes))}</div>
                        </section>
                    ` : ''}

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Closing Overview</div>
                        ${thermalOverviewTable}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Tender Breakdown</div>
                        ${thermalPaymentsTable}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Cash Control</div>
                        ${renderCounterXSimpleTable(
                            ['Metric', 'Value'],
                            [
                                ['Opening Float', cashSummary.opening_cash ?? '-'],
                                ['Net Cash Sale', cashSummary.net_cash_sale ?? '-'],
                                ['Cash Expense', cashSummary.cash_expense ?? data.expenses ?? '-'],
                                ['Cash Refund', cashSummary.cash_refund ?? '-'],
                                ['Total Cash In Hand', cashSummary.total_cash_in_hand ?? '-'],
                            ],
                        )}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Credit, Wallet & Expense</div>
                        ${renderCounterXSimpleTable(
                            ['Metric', 'Value'],
                            [
                                ['Wallet Used', walletSummary.wallet_used_today ?? '-'],
                                ['Wallet Top-Up', walletSummary.added_in_wallet_today ?? '-'],
                                ['Wallet Closing', walletSummary.current_closing_balance ?? '-'],
                                ['Credited Today', creditSummary.total_credited_sale_today ?? '-'],
                                ['Credit Recovered', creditSummary.credited_amount_received ?? '-'],
                                ['Net Credit Balance', creditSummary.net_credit_balance ?? '-'],
                                ['Expense', expenseSummary.total_expense ?? data.expenses ?? '-'],
                            ],
                        )}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Sales Counter Summary</div>
                        ${thermalCounterTable}
                    </section>

                    <footer class="audit-section day-close-footer">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                        ${footer}
                    </footer>
                </div>
            </section>
        `;
    }

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet day-close-report day-close-a4">
                ${header}
                <header class="doc-header day-close-header">
                    <div class="day-close-header-top">
                        <div>
                            <div class="day-close-kicker">Business Day Close</div>
                            <div class="doc-title">BUSINESS DAY Z-REPORT</div>
                        </div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">Executive closing statement for all sales counters operating in the same business day</div>
                </header>

                <section class="day-close-hero">
                    <div class="day-close-hero-band">
                        ${heroMetrics.map((item) => `
                            <div class="day-close-hero-card">
                                <div class="day-close-hero-label">${escapeHtml(item.label)}</div>
                                <div class="day-close-hero-value">${escapeHtml(String(item.value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="day-close-meta-grid">
                        ${reportMeta.map(([label, value]) => `
                            <div class="day-close-meta-tile">
                                <div class="day-close-meta-label">${escapeHtml(String(label))}</div>
                                <div class="day-close-meta-value">${escapeHtml(String(value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${data.notes ? `
                        <div class="day-close-note">
                            <div class="day-close-section-title">Manager Notes</div>
                            <div class="day-close-note-body">${escapeHtml(String(data.notes))}</div>
                        </div>
                    ` : ''}
                </section>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Cash Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Opening Float', value: cashSummary.opening_cash ?? '-' },
                            { label: 'Net Cash Sale', value: cashSummary.net_cash_sale ?? '-' },
                            { label: 'Cash Sale (Gross)', value: cashSummary.cash_sale ?? data.payments?.cash ?? '-' },
                            { label: 'Tracked Cash Expense', value: cashSummary.cash_expense ?? data.expenses ?? '-' },
                            { label: 'Cash Refund', value: cashSummary.cash_refund ?? '-' },
                            { label: 'Total Cash in Hand', value: cashSummary.total_cash_in_hand ?? '-', note: 'Opening + Net Cash Sale - Expense - Refund', emphasis: true },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Cash Control</div>
                        ${renderCounterXMetricRows([
                            { label: 'Expected Cash in Drawer', value: cashExpected.expected_cash ?? '-', emphasis: true },
                            { label: 'Actual Cash Counted', value: cashExpected.actual_cash ?? '-' },
                            { label: 'Variance (Over / Short)', value: cashExpected.variance ?? data.variance ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">POS Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Cash Sale', value: posSummary.cash_sale ?? data.payments?.cash ?? '-' },
                            { label: 'Online Payment Sale', value: posSummary.online_payment_sale ?? data.payments?.online ?? '-' },
                            { label: 'Credit Card Sale', value: posSummary.credit_card_sale ?? data.payments?.card ?? '-' },
                            { label: 'Wallet Sale', value: posSummary.wallet_sale ?? '-' },
                            { label: 'Returned Amount', value: posSummary.returned_amount ?? data.returns ?? '-' },
                            { label: 'Customer Count', value: posSummary.customer_count ?? '-' },
                            { label: 'Total Orders', value: posSummary.total_orders ?? data.orders ?? '-' },
                            { label: 'Total KOT (Incl. Versions)', value: posSummary.total_kots ?? '-' },
                            { label: 'Discount Amount', value: posSummary.discount_amount ?? data.discounts ?? '-' },
                            { label: 'Gross Sales', value: data.gross ?? '-', emphasis: true },
                            { label: 'Net Sales', value: data.net ?? '-', emphasis: true },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Wallet Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Wallet Used Today', value: walletSummary.wallet_used_today ?? '-' },
                            { label: 'Amount Added in Wallet Today', value: walletSummary.added_in_wallet_today ?? '-' },
                            { label: 'Current / Closing Balance', value: walletSummary.current_closing_balance ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Credit Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Total Credited Sale Today', value: creditSummary.total_credited_sale_today ?? '-' },
                            { label: 'Previously Pending Credit', value: creditSummary.previously_pending_credit ?? '-' },
                            { label: 'Credited Amount Received', value: creditSummary.credited_amount_received ?? '-' },
                            { label: 'Net Credit Balance', value: creditSummary.net_credit_balance ?? '-', emphasis: true },
                            { label: 'Credited Orders', value: creditSummary.credited_orders_count ?? 0 },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Expense Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Expense from Cash Counters', value: expenseSummary.expense_from_cash_counter ?? data.expenses ?? '-' },
                            { label: 'Sales / Expense Ratio', value: `${expenseSummary.sales_expense_ratio ?? 0}%` },
                            { label: 'Total Expense', value: expenseSummary.total_expense ?? data.expenses ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <section class="counter-x-section day-close-panel">
                    <div class="counter-x-section-title">Exceptions & Controls</div>
                    ${renderCounterXMetricRows([
                        { label: 'Completed Orders', value: posSummary.completed_orders ?? '-' },
                        { label: 'Voided Orders', value: posSummary.voided_orders ?? 0 },
                        { label: 'Voided Amount', value: posSummary.voided_amount ?? '-' },
                        { label: 'Returns', value: posSummary.returned_orders ?? 0 },
                        { label: 'Returned Amount', value: posSummary.returned_amount ?? data.returns ?? '-' },
                        { label: 'Discounts', value: posSummary.discount_amount ?? data.discounts ?? '-' },
                    ])}
                </section>

                <section class="counter-x-section day-close-panel">
                    <div class="counter-x-section-title">Order Type Summary</div>
                    ${renderCounterXSimpleTable(
                        ['Order Type', 'No. of Orders', 'Amount'],
                        orderTypeSummary.map((row: any) => [String(row.type || '-').replace(/_/g, ' '), row.orders ?? 0, row.amount ?? '-']),
                    )}
                </section>

                <div class="day-close-a4-grid day-close-a4-grid-wide">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Sold Items Summary</div>
                    ${renderCounterXSimpleTable(
                        ['Item', 'Qty', 'Gross Sale', 'Returned', 'Net Sale'],
                        soldItemsSummary.map((row: any) => [row.item ?? '-', row.qty ?? 0, row.gross_sale ?? '-', row.returned_amount ?? '-', row.net_sale ?? row.gross_sale ?? '-']),
                    )}
                </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Sale Summary for Prep Stations</div>
                    ${renderCounterXSimpleTable(
                        ['Prep Station', 'Orders', 'Sale Amount'],
                        stationWiseSale.map((row: any) => [row.station ?? '-', row.orders ?? 0, row.sales_amount ?? '-']),
                    )}
                </section>
                </div>

                <section class="counter-x-section day-close-panel">
                    <div class="counter-x-section-title">Sales Counter Closing Summary</div>
                    ${(data.counters || []).length > 0
                        ? renderCounterXSimpleTable(
                            ['Sales Counter', 'Cashier', 'Orders', 'Opening Cash', 'Net Sales', 'Expected Cash', 'Actual Cash', 'Variance'],
                            (data.counters || []).map((row: any) => [
                                row.counter_name ?? '-',
                                row.cashier_name ?? '-',
                                row.orders ?? 0,
                                row.opening_cash ?? '-',
                                row.net_sales ?? '-',
                                row.expected_cash ?? '-',
                                row.actual_cash ?? '-',
                                row.variance ?? '-',
                            ]),
                        )
                        : '<div class="counter-x-line"><div class="counter-x-line-label">No sales counter close records were included.</div><div></div><div class="counter-x-line-value">-</div></div>'}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildDayClosingReportPrintMarkup = (options: DayClosingReportPrintTemplateOptions) =>
    buildDayClosingReportBodyMarkup(options);

export const buildDayClosingReportPrintDocument = (options: DayClosingReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Day Closing Report</title>
            <style>${KOT_PRINT_CSS}${COUNTER_X_REPORT_CSS}${DAY_CLOSING_REPORT_CSS}</style>
        </head>
        <body>
            ${buildDayClosingReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildLineItemVoidReceiptBodyMarkup = ({ settings, data, format = 'thermal-80mm', copy_label }: LineItemVoidReceiptPrintTemplateOptions) => {
    const footer = renderReceiptFooterBlock(settings);

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                <section class="receipt-paid-layout">
                    <header class="receipt-paid-brand">
                        <div class="receipt-paid-logo-slot">
                            ${settings.logo_url ? `<div class="brand-block"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="Logo" /></div></div>` : '<div class="brand-block"><div class="brand-logo-wrap"></div></div>'}
                        </div>
                        <div class="receipt-paid-title-wrap">
                            <div class="receipt-paid-title">LINE ITEM VOID RECEIPT</div>
                            ${settings.branch_name ? `<div class="brand-meta">${escapeHtml(settings.branch_name)}</div>` : ''}
                            ${settings.address ? `<div class="brand-meta">${escapeHtml(settings.address)}</div>` : ''}
                            ${settings.phone ? `<div class="brand-meta">${escapeHtml(settings.phone)}</div>` : ''}
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="receipt-paid-header-separator"></div>
                        <div class="receipt-paid-order-row">
                            <div class="receipt-paid-order-no">ORDER # ${escapeHtml(data.order_no)}</div>
                            <div class="receipt-paid-datetime">${escapeHtml(receiptDateTime(data.datetime || data.printed_at || new Date()))}</div>
                        </div>
                    </header>

                    <section class="receipt-paid-meta">
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Cashier#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.cashier ?? '')}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Server#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.server ?? '')}</span>
                            </div>
                        </div>
                        <div class="receipt-paid-meta-row receipt-paid-meta-row-split">
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">OrderType:</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(normalizeLabel(data.order_type || '-'))}</span>
                            </div>
                            <div class="receipt-paid-meta-field">
                                <span class="receipt-paid-meta-label">Table#</span>
                                <span class="receipt-paid-meta-value">${escapeHtml(data.table ?? '-')}</span>
                            </div>
                        </div>
                    </section>

                    <div class="receipt-paid-status">LINE ITEM VOID / ADJUSTMENT</div>

                    <section class="items-section">
                        <table class="receipt-paid-table">
                            <thead>
                                <tr>
                                    <th style="width: 42%;">Item</th>
                                    <th style="width: 14%;">Action</th>
                                    <th style="width: 14%;">Old</th>
                                    <th style="width: 14%;">New</th>
                                    <th style="width: 16%;">Void</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(data.items || []).map((item) => `
                                    <tr>
                                        <td>
                                            <div class="bill-item-name">${escapeHtml(item.name)}</div>
                                            ${item.station ? `<div class="bill-item-meta">${escapeHtml(item.station)}</div>` : ''}
                                        </td>
                                        <td>${escapeHtml(item.action === 'void' ? 'Void' : 'Reduced')}</td>
                                        <td>${escapeHtml(item.old_qty)}</td>
                                        <td>${escapeHtml(item.new_qty)}</td>
                                        <td>${escapeHtml(item.void_qty)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </section>

                    ${(data.reason || data.authorized_by) ? `
                        <section class="receipt-paid-summary">
                            ${data.reason ? `
                                <div class="receipt-paid-summary-row">
                                    <span class="receipt-paid-summary-label">Reason:</span>
                                    <span class="receipt-paid-summary-value">${escapeHtml(data.reason)}</span>
                                </div>
                            ` : ''}
                            ${data.authorized_by ? `
                                <div class="receipt-paid-summary-row">
                                    <span class="receipt-paid-summary-label">Authorized By:</span>
                                    <span class="receipt-paid-summary-value">${escapeHtml(data.authorized_by)}</span>
                                </div>
                            ` : ''}
                        </section>
                    ` : ''}

                    ${footer}

                    <footer class="audit-section receipt-paid-audit">
                        ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    </footer>
                </section>
            </div>
        </section>
    `;
};

export const buildLineItemVoidReceiptPrintMarkup = (options: LineItemVoidReceiptPrintTemplateOptions) =>
    buildLineItemVoidReceiptBodyMarkup(options);

export const buildLineItemVoidReceiptPrintDocument = (options: LineItemVoidReceiptPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Line Item Void ${escapeHtml(options.data.order_no)}</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildLineItemVoidReceiptBodyMarkup(options)}
        </body>
    </html>
`;

const renderCounterXMetricRows = (rows: Array<{ label: string; value: string | number; note?: string | null; emphasis?: boolean }>) => rows.map((row) => `
    <div class="counter-x-line${row.emphasis ? ' emphasis' : ''}">
        <div class="counter-x-line-label">${escapeHtml(row.label)}</div>
        ${row.note ? `<div class="counter-x-line-note">${escapeHtml(row.note)}</div>` : '<div></div>'}
        <div class="counter-x-line-value">${escapeHtml(String(row.value ?? '-'))}</div>
    </div>
`).join('');

const renderCounterXSimpleTable = (
    headers: string[],
    rows: Array<Array<string | number>>,
) => `
    <table class="counter-x-table">
        <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${rows.length === 0 ? `<tr><td colspan="${headers.length}" class="counter-x-empty">No data</td></tr>` : rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? '-'))}</td>`).join('')}</tr>`).join('')}
        </tbody>
    </table>
`;

const buildCounterSessionXReportBodyMarkup = ({
    settings,
    data,
    format = 'a4',
    copy_label,
}: CounterSessionXReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';
    const sections = data?.sections || {};
    const cashSummary = sections.cash_summary || {};
    const cashExpected = sections.cash_actual_vs_expected || {};
    const posSummary = sections.pos_summary || {};
    const walletSummary = sections.wallet_summary || {};
    const creditSummary = sections.credit_summary || {};
    const expenseSummary = sections.expense_summary || {};
    const orderTypeSummary = Array.isArray(sections.order_type_summary) ? sections.order_type_summary : [];
    const soldItemsSummary = Array.isArray(sections.sold_items_summary) ? sections.sold_items_summary : [];
    const stationWiseSale = Array.isArray(sections.station_wise_sale) ? sections.station_wise_sale : [];
    const isThermal = format === 'thermal-80mm';
    const counterLabel = `${String(data?.counter?.name || 'Sales Counter')}${data?.counter?.code ? ` (${String(data.counter.code)})` : ''}`;
    const cashierLabel = `${String(data?.cashier?.name || '-')}${data?.cashier?.employee_id || data?.cashier?.username ? ` (${String(data?.cashier?.employee_id || data?.cashier?.username)})` : ''}`;
    const authorizedUserLabel = `${String(data?.authorized_by?.name || '-')}${data?.authorized_by?.username || data?.authorized_by?.employee_id ? ` (${String(data?.authorized_by?.username || data?.authorized_by?.employee_id)})` : ''}`;
    const heroMetrics = [
        { label: 'Net Sales', value: posSummary.total_sale ?? '-' },
        { label: 'Orders', value: posSummary.total_orders ?? '-' },
        { label: 'Cash In Hand', value: cashSummary.total_cash_in_hand ?? '-' },
        { label: 'Variance', value: cashExpected.variance ?? '-' },
    ];
    const reportMeta = [
        ['Date', data?.business_day?.business_date || '-'],
        ['Branch', `${String(data?.branch?.name || '-')}${data?.branch?.code ? ` (${String(data.branch.code)})` : ''}`],
        ['Sales Counter', counterLabel],
        ['Cashier', cashierLabel],
        ['Authorized User', authorizedUserLabel],
        ['Opened At', compactDateTime(data?.session_window?.opened_at || '-')],
        ['Closed At', compactDateTime(data?.session_window?.closed_at || '-')],
        ['Customer Count', posSummary.customer_count ?? '-'],
    ];

    if (isThermal) {
        return `
            <section class="kot-print-root format-${escapeHtml(format)}">
                <div class="kot-sheet day-close-report day-close-thermal">
                    ${header}
                    <header class="doc-header day-close-header">
                        <div class="day-close-header-top">
                            <div>
                                <div class="day-close-kicker">Sales Counter Close</div>
                                <div class="doc-title">X-REPORT</div>
                            </div>
                            ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                        </div>
                        <div class="doc-subtitle">Session close summary for cashier and authorized-user review</div>
                    </header>

                    <section class="day-close-hero day-close-hero-thermal">
                        ${heroMetrics.map((item) => `
                            <div class="day-close-hero-card">
                                <div class="day-close-hero-label">${escapeHtml(item.label)}</div>
                                <div class="day-close-hero-value">${escapeHtml(String(item.value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </section>

                    <section class="day-close-meta-card">
                        <div class="day-close-section-title">Session Snapshot</div>
                        <div class="day-close-meta-list">
                            ${reportMeta.map(([label, value]) => `
                                <div class="day-close-meta-row">
                                    <span>${escapeHtml(String(label))}</span>
                                    <strong>${escapeHtml(String(value ?? '-'))}</strong>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Closing Overview</div>
                        ${renderCounterXSimpleTable(
                            ['Metric', 'Value'],
                            [
                                ['Opening Float', cashSummary.opening_cash ?? '-'],
                                ['Net Cash Sale', cashSummary.net_cash_sale ?? cashSummary.cash_sale ?? '-'],
                                ['Total Sale', posSummary.total_sale ?? '-'],
                                ['Expected Cash', cashExpected.expected_cash ?? '-'],
                                ['Actual Cash', cashExpected.actual_cash ?? '-'],
                                ['Variance', cashExpected.variance ?? '-'],
                            ],
                        )}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Tender Breakdown</div>
                        ${renderCounterXSimpleTable(
                            ['Tender', 'Amount'],
                            [
                                ['Cash', posSummary.cash_sale ?? '-'],
                                ['Card', posSummary.credit_card_sale ?? '-'],
                                ['Online', posSummary.online_payment_sale ?? '-'],
                                ['Wallet', posSummary.wallet_sale ?? '-'],
                                ['Credit', creditSummary.total_credited_sale_today ?? '-'],
                            ],
                        )}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Control Summary</div>
                        ${renderCounterXSimpleTable(
                            ['Metric', 'Value'],
                            [
                                ['Expense', expenseSummary.total_expense ?? '-'],
                                ['Discounts', posSummary.discount_amount ?? '-'],
                                ['Returned Amount', posSummary.returned_amount ?? '-'],
                                ['Voided Amount', posSummary.voided_amount ?? '-'],
                                ['Wallet Closing', walletSummary.current_closing_balance ?? '-'],
                                ['Net Credit Balance', creditSummary.net_credit_balance ?? '-'],
                            ],
                        )}
                    </section>

                    <section class="day-close-table-card">
                        <div class="day-close-section-title">Prep Station Summary</div>
                        ${renderCounterXSimpleTable(
                            ['Station', 'Amount'],
                            stationWiseSale.length > 0
                                ? stationWiseSale.map((row: any) => [row.station ?? '-', row.sales_amount ?? '-'])
                                : [['No data', '-']],
                        )}
                    </section>

                    <footer class="audit-section day-close-footer">
                        ${renderMetaLine('Printed At', compactDateTime(data?.printed_at || new Date()))}
                        ${renderMetaLine('Print ID', data?.report_id ?? data?.print_id ?? '-')}
                        ${footer}
                    </footer>
                </div>
            </section>
        `;
    }

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet day-close-report day-close-a4">
                ${header}
                <header class="doc-header day-close-header">
                    <div class="day-close-header-top">
                        <div>
                            <div class="day-close-kicker">Sales Counter Close</div>
                            <div class="doc-title">SALES COUNTER X-REPORT</div>
                        </div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">Operational closing statement for a single counter session</div>
                </header>

                <section class="day-close-hero">
                    <div class="day-close-hero-band">
                        ${heroMetrics.map((item) => `
                            <div class="day-close-hero-card">
                                <div class="day-close-hero-label">${escapeHtml(item.label)}</div>
                                <div class="day-close-hero-value">${escapeHtml(String(item.value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="day-close-meta-grid">
                        ${reportMeta.map(([label, value]) => `
                            <div class="day-close-meta-tile">
                                <div class="day-close-meta-label">${escapeHtml(String(label))}</div>
                                <div class="day-close-meta-value">${escapeHtml(String(value ?? '-'))}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Cash Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Opening Float', value: cashSummary.opening_cash ?? '-' },
                            { label: 'Net Cash Sale', value: cashSummary.net_cash_sale ?? cashSummary.cash_sale ?? '-' },
                            { label: 'Cash Sale (Gross)', value: cashSummary.cash_sale ?? '-' },
                            { label: 'Tracked Cash Expense', value: cashSummary.cash_expense ?? '-' },
                            { label: 'Cash Refund', value: cashSummary.cash_refund ?? '-' },
                            { label: 'Total Cash in Hand', value: cashSummary.total_cash_in_hand ?? '-', note: 'Opening + Net Cash Sale - Expense - Refund', emphasis: true },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Cash Control</div>
                        ${renderCounterXMetricRows([
                            { label: 'Expected Cash in Drawer', value: cashExpected.expected_cash ?? '-', emphasis: true },
                            { label: 'Actual Cash Counted', value: cashExpected.actual_cash ?? '-' },
                            { label: 'Variance (Over / Short)', value: cashExpected.variance ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">POS Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Cash Sale', value: posSummary.cash_sale ?? '-' },
                            { label: 'Online Payment Sale', value: posSummary.online_payment_sale ?? '-' },
                            { label: 'Credit Card Sale', value: posSummary.credit_card_sale ?? '-' },
                            { label: 'Wallet Sale', value: posSummary.wallet_sale ?? '-' },
                            { label: 'Returned Amount', value: posSummary.returned_amount ?? '-' },
                            { label: 'Customer Count', value: posSummary.customer_count ?? '-' },
                            { label: 'Total Orders', value: posSummary.total_orders ?? '-' },
                            { label: 'Total KOT (Incl. Versions)', value: posSummary.total_kots ?? '-' },
                            { label: 'Discount Amount', value: posSummary.discount_amount ?? '-' },
                            { label: 'Voided Orders', value: posSummary.voided_orders ?? 0 },
                            { label: 'Voided Amount', value: posSummary.voided_amount ?? '-' },
                            { label: 'Total Sale', value: posSummary.total_sale ?? '-', emphasis: true },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Wallet Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Wallet Used Today', value: walletSummary.wallet_used_today ?? '-' },
                            { label: 'Amount Added in Wallet Today', value: walletSummary.added_in_wallet_today ?? '-' },
                            { label: 'Current / Closing Balance', value: walletSummary.current_closing_balance ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <div class="day-close-a4-grid">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Credit Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Total Credited Sale Today', value: creditSummary.total_credited_sale_today ?? '-' },
                            { label: 'Previously Pending Credit', value: creditSummary.previously_pending_credit ?? '-' },
                            { label: 'Credited Amount Received', value: creditSummary.credited_amount_received ?? '-' },
                            { label: 'Net Credit Balance', value: creditSummary.net_credit_balance ?? '-', emphasis: true },
                            { label: 'Credited Orders', value: creditSummary.credited_orders_count ?? 0 },
                        ])}
                    </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Expense Summary</div>
                        ${renderCounterXMetricRows([
                            { label: 'Expense from Cash Counter', value: expenseSummary.expense_from_cash_counter ?? '-' },
                            { label: 'Sales / Expense Ratio', value: `${expenseSummary.sales_expense_ratio ?? 0}%` },
                            { label: 'Total Expense', value: expenseSummary.total_expense ?? '-', emphasis: true },
                        ])}
                    </section>
                </div>

                <section class="counter-x-section day-close-panel">
                    <div class="counter-x-section-title">Exceptions & Controls</div>
                    ${renderCounterXMetricRows([
                        { label: 'Voided Orders', value: posSummary.voided_orders ?? 0 },
                        { label: 'Voided Amount', value: posSummary.voided_amount ?? '-' },
                        { label: 'Returns', value: posSummary.returned_orders ?? 0 },
                        { label: 'Returned Amount', value: posSummary.returned_amount ?? '-' },
                        { label: 'Discounts', value: posSummary.discount_amount ?? '-' },
                    ])}
                </section>

                <section class="counter-x-section day-close-panel">
                    <div class="counter-x-section-title">Order Type Summary</div>
                    ${renderCounterXSimpleTable(
                        ['Order Type', 'No. of Orders', 'Amount'],
                        orderTypeSummary.map((row: any) => [String(row.type || '-').replace(/_/g, ' '), row.orders ?? 0, row.amount ?? '-']),
                    )}
                </section>

                <div class="day-close-a4-grid day-close-a4-grid-wide">
                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Sold Items Summary</div>
                    ${renderCounterXSimpleTable(
                        ['Item', 'Qty', 'Gross Sale', 'Returned', 'Net Sale'],
                        soldItemsSummary.map((row: any) => [row.item ?? '-', row.qty ?? 0, row.gross_sale ?? '-', row.returned_amount ?? '-', row.net_sale ?? row.gross_sale ?? '-']),
                    )}
                </section>

                    <section class="counter-x-section day-close-panel">
                        <div class="counter-x-section-title">Sale Summary for Prep Stations</div>
                    ${renderCounterXSimpleTable(
                        ['Prep Station', 'Orders', 'Sale Amount'],
                        stationWiseSale.map((row: any) => [row.station ?? '-', row.orders ?? 0, row.sales_amount ?? '-']),
                    )}
                </section>
                </div>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="counter-x-signatures day-close-panel">
                    <div class="counter-x-sign-row">
                        <div class="counter-x-sign">
                            <div class="counter-x-sign-label">Cashier Signature (PIN)</div>
                            <div class="counter-x-sign-line"></div>
                            <div class="counter-x-sign-name">${escapeHtml(String(data?.cashier?.name || ''))}</div>
                        </div>
                        <div class="counter-x-sign">
                            <div class="counter-x-sign-label">Supervisor Signature (PIN)</div>
                            <div class="counter-x-sign-line"></div>
                            <div class="counter-x-sign-name">${escapeHtml(String(data?.authorized_by?.name || ''))}</div>
                        </div>
                    </div>
                </section>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data?.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data?.report_id ?? data?.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

const COUNTER_X_REPORT_CSS = `
    .counter-x-report { gap: 16px; }
    .counter-x-start { border:1.5px solid #111111; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:8px; background:#ffffff; margin-bottom: 8px; }
    .counter-x-start-item { display:grid; grid-template-columns:minmax(0,0.48fr) minmax(0,0.52fr); gap:10px; align-items:baseline; padding:6px 8px; border:1px solid #111111; border-radius:6px; }
    .counter-x-start-label { font-size:0.72em; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#374151; }
    .counter-x-start-value { font-size:0.92em; font-weight:700; text-align:right; }
    .counter-x-intro { display:flex; gap:8px; flex-wrap:wrap; }
    .counter-x-chip { padding:4px 8px; border:1.5px solid #111111; font-size:0.82em; font-weight:800; }
    .counter-x-meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .counter-x-meta-card { border:1px solid #111111; padding:7px 8px; display:grid; gap:2px; }
    .counter-x-meta-label { font-size:0.76em; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; }
    .counter-x-meta-card strong { font-size:0.98em; }
    .counter-x-meta-card small { font-size:0.78em; }
    .counter-x-section-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .counter-x-section { border:1.5px solid #111111; background:#ffffff; border-radius:6px; overflow:hidden; }
    .counter-x-section + .counter-x-section { margin-top: 0; }
    .counter-x-section-title { padding:3px 10px; border-bottom:1.5px solid #111111; text-align:center; font-size:0.9em; font-weight:900; text-transform:uppercase; letter-spacing:0.06em; background:#f6f7fb; }
    .counter-x-line { display:grid; grid-template-columns:1fr auto auto; gap:8px; padding:3px 10px; border-top:1px solid #111111; align-items:baseline; }
    .counter-x-line:first-of-type { border-top:0; }
    .counter-x-line-label { font-weight:700; }
    .counter-x-line-note { font-size:0.74em; text-align:center; color:#374151; white-space:nowrap; }
    .counter-x-line-value { text-align:right; font-weight:800; white-space:nowrap; }
    .counter-x-line.emphasis { background:#f9fafb; }
    .counter-x-line.emphasis .counter-x-line-label, .counter-x-line.emphasis .counter-x-line-value { font-weight:900; }
    .counter-x-table { width:100%; border-collapse:collapse; }
    .counter-x-table th, .counter-x-table td { border:1px solid #111111; padding:2px 5px; font-size:0.82em; text-align:left; vertical-align:top; }
    .counter-x-table th { background:#f6f7fb; text-transform:uppercase; font-weight:900; text-align:center; }
    .counter-x-table td:not(:first-child) { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .counter-x-empty { text-align:center !important; }

    .format-thermal-80mm .counter-x-report { gap: 12px; }
    .format-thermal-80mm .counter-x-start { padding:7px 8px; border-width:1px; gap:6px; margin-bottom: 6px; }
    .format-thermal-80mm .counter-x-start-item { grid-template-columns:1fr; gap:2px; border-width:1px; padding:5px 6px; }
    .format-thermal-80mm .counter-x-start-value { text-align:left; }
    .format-thermal-80mm .counter-x-start-label { font-size:0.66em; }
    .format-thermal-80mm .doc-title { font-size: 1em; letter-spacing: 0.03em; }
    .format-thermal-80mm .doc-subtitle { font-size: 0.82em; }
    .format-thermal-80mm .counter-x-intro { gap: 6px; }
    .format-thermal-80mm .counter-x-chip { padding:3px 6px; border-width:1px; font-size:0.74em; }
    .format-thermal-80mm .counter-x-meta-grid { grid-template-columns: 1fr; gap:6px; }
    .format-thermal-80mm .counter-x-meta-card { padding:6px 7px; }
    .format-thermal-80mm .counter-x-meta-label { font-size:0.7em; }
    .format-thermal-80mm .counter-x-meta-card strong { font-size:0.92em; }
    .format-thermal-80mm .counter-x-meta-card small { font-size:0.72em; }
    .format-thermal-80mm .counter-x-section-grid { grid-template-columns: 1fr; gap:12px; }
    .format-thermal-80mm .counter-x-section + .counter-x-section { margin-top: 0; }
    .format-thermal-80mm .counter-x-section-title { padding:3px 7px; font-size:0.82em; }
    .format-thermal-80mm .counter-x-line { grid-template-columns: 1fr auto; gap:6px; padding:2px 7px; }
    .format-thermal-80mm .counter-x-line-note { display:none; }
    .format-thermal-80mm .counter-x-line-label { grid-column: 1; grid-row: 1; font-size:0.82em; }
    .format-thermal-80mm .counter-x-line-value { grid-column: 2; grid-row: 1; font-size:0.84em; }
    .format-thermal-80mm .counter-x-table th,
    .format-thermal-80mm .counter-x-table td { padding:1px 4px; font-size:0.74em; }
    .format-thermal-80mm .counter-x-table td:first-child { white-space:normal; word-break:break-word; }
    .format-thermal-80mm .counter-x-section { border-width:1px; }
    .format-thermal-80mm .counter-x-section-title { border-bottom-width:1px; }
    .format-thermal-80mm .counter-x-line { border-top-width:1px; }
    .format-thermal-80mm .counter-x-table th, .format-thermal-80mm .counter-x-table td { border-width:1px; }
    .format-thermal-80mm .counter-x-report .separator { font-size:0.75em; letter-spacing:0.06em; }

    .counter-x-signatures { display:flex; flex-direction:column; gap:6px; }
    .counter-x-sign-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .counter-x-sign { display:flex; flex-direction:column; gap:4px; }
    .counter-x-sign-label { font-size:0.78em; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
    .counter-x-sign-line { border-bottom:1.5px solid #111111; height:12px; }
    .counter-x-sign-name { font-size:0.82em; font-weight:700; }

    .format-thermal-80mm .counter-x-sign-row { grid-template-columns:1fr; gap:6px; }
    .format-thermal-80mm .counter-x-sign-label { font-size:0.7em; }
    .format-thermal-80mm .counter-x-sign-name { font-size:0.74em; }
    .format-thermal-80mm .audit-section .meta-row { font-size:0.72em; }
    .credit-payment-layout { gap: 12px; }
    .credit-payment-subtitle { font-size: 0.86em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .credit-payment-subtitle.muted { font-size: 0.74em; font-weight: 700; color: #6b7280; }
    .credit-payment-table td:first-child { text-align:left; white-space:normal; }
    .credit-payment-order-cell { display:flex; flex-direction:column; gap:3px; }
    .credit-payment-order-title { font-weight:900; letter-spacing:0.02em; }
    .credit-payment-order-meta { font-size:0.82em; color:#374151; }
    .credit-payment-summary { margin-top: 0; }
    .credit-payment-summary-title { padding: 0 0 6px; font-size: 0.82em; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #111111; }
    .format-thermal-80mm .credit-payment-layout { gap: 10px; }
    .format-thermal-80mm .credit-payment-subtitle { font-size: 0.76em; }
    .format-thermal-80mm .credit-payment-subtitle.muted { font-size: 0.66em; }
    .format-thermal-80mm .credit-payment-table th,
    .format-thermal-80mm .credit-payment-table td { font-size: 0.72em; padding: 2px 4px; }
    .format-thermal-80mm .credit-payment-order-cell { gap: 2px; }
    .format-thermal-80mm .credit-payment-order-title { font-size: 0.82em; }
    .format-thermal-80mm .credit-payment-order-meta { font-size: 0.7em; }
    .format-thermal-80mm .credit-payment-summary-title { font-size: 0.72em; padding-bottom: 4px; }

`;

const DAY_CLOSING_REPORT_CSS = `
    .day-close-report {
        display: flex;
        flex-direction: column;
        gap: 14px;
        color: #111827;
    }
    .day-close-header {
        border: 1.5px solid #111111;
        border-radius: 12px;
        padding: 12px 14px 10px;
        background:
            linear-gradient(135deg, rgba(17, 24, 39, 0.05), rgba(17, 24, 39, 0)),
            linear-gradient(180deg, #ffffff, #f7f8fb);
    }
    .day-close-header-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
    }
    .day-close-kicker {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border: 1px solid #111111;
        border-radius: 999px;
        margin-bottom: 6px;
        background: #f3f4f6;
        font-size: 0.72em;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .day-close-header .doc-title {
        letter-spacing: 0.06em;
    }
    .day-close-header .doc-subtitle {
        margin-top: 6px;
        font-size: 0.9em;
        color: #4b5563;
        text-transform: none;
        letter-spacing: 0.02em;
    }
    .day-close-hero {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .day-close-hero-band {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
    }
    .day-close-hero-card {
        border: 1.5px solid #111111;
        border-radius: 12px;
        padding: 12px 10px;
        background: linear-gradient(180deg, #ffffff, #f7f8fb);
        text-align: center;
    }
    .day-close-hero-label {
        font-size: 0.72em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 900;
        color: #6b7280;
        margin-bottom: 6px;
    }
    .day-close-hero-value {
        font-size: 1.28em;
        font-weight: 900;
        line-height: 1.1;
    }
    .day-close-meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
    }
    .day-close-meta-tile {
        border: 1px solid #cfd4dc;
        border-radius: 10px;
        padding: 10px 11px;
        background: #fbfcfe;
        min-height: 64px;
    }
    .day-close-meta-label {
        margin-bottom: 6px;
        font-size: 0.72em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 900;
        color: #6b7280;
    }
    .day-close-meta-value {
        font-size: 0.98em;
        font-weight: 800;
        word-break: break-word;
    }
    .day-close-note,
    .day-close-meta-card,
    .day-close-table-card {
        border: 1.5px solid #111111;
        border-radius: 12px;
        overflow: hidden;
        background: #ffffff;
    }
    .day-close-section-title {
        padding: 7px 10px;
        border-bottom: 1px solid #111111;
        background: linear-gradient(180deg, #f8fafc, #eef2f7);
        font-size: 0.82em;
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .day-close-note-body {
        padding: 10px 12px;
        font-size: 0.9em;
        line-height: 1.45;
        white-space: pre-wrap;
    }
    .day-close-meta-list {
        display: flex;
        flex-direction: column;
    }
    .day-close-meta-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding: 8px 10px;
        border-top: 1px solid #e5e7eb;
        align-items: baseline;
        font-size: 0.86em;
    }
    .day-close-meta-row:first-child {
        border-top: 0;
    }
    .day-close-meta-row strong {
        text-align: right;
        font-weight: 900;
    }
    .day-close-a4-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
    }
    .day-close-a4-grid-wide {
        align-items: start;
    }
    .day-close-panel {
        break-inside: avoid;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    }
    .day-close-panel .counter-x-section-title {
        background: linear-gradient(180deg, #f8fafc 0%, #edf1f6 100%);
        padding: 6px 10px;
    }
    .day-close-panel .counter-x-line:nth-child(even) {
        background: #fafbfc;
    }
    .day-close-panel .counter-x-table th {
        background: linear-gradient(180deg, #f8fafc 0%, #edf1f6 100%);
    }
    .day-close-panel .counter-x-table tbody tr:nth-child(even) td {
        background: #fafbfc;
    }
    .day-close-footer {
        margin-top: 2px;
    }

    .day-close-thermal .day-close-header {
        border-radius: 8px;
        padding: 7px 8px 6px;
    }
    .day-close-thermal .day-close-header .doc-title {
        font-size: 1em;
        letter-spacing: 0.04em;
    }
    .day-close-thermal .day-close-header .doc-subtitle {
        margin-top: 4px;
        font-size: 0.74em;
        line-height: 1.25;
    }
    .day-close-thermal .day-close-kicker {
        padding: 2px 6px;
        margin-bottom: 4px;
        font-size: 0.64em;
    }
    .day-close-hero-thermal {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
    }
    .day-close-thermal .day-close-hero-card {
        border-width: 1px;
        border-radius: 8px;
        padding: 7px 6px;
    }
    .day-close-thermal .day-close-hero-label {
        font-size: 0.6em;
        margin-bottom: 3px;
    }
    .day-close-thermal .day-close-hero-value {
        font-size: 0.9em;
    }
    .day-close-thermal .day-close-meta-card,
    .day-close-thermal .day-close-table-card,
    .day-close-thermal .day-close-note {
        border-width: 1px;
        border-radius: 8px;
    }
    .day-close-thermal .day-close-section-title {
        padding: 5px 7px;
        font-size: 0.72em;
    }
    .day-close-thermal .day-close-meta-row,
    .day-close-thermal .day-close-note-body {
        padding: 5px 7px;
        font-size: 0.76em;
    }
    .day-close-thermal .counter-x-table th,
    .day-close-thermal .counter-x-table td {
        padding: 2px 4px;
        font-size: 0.72em;
        border-width: 1px;
    }
    .day-close-thermal .audit-section .meta-row {
        font-size: 0.72em;
    }

    @media print {
        .day-close-a4 {
            gap: 12px;
        }
        .day-close-a4-grid,
        .day-close-hero-band,
        .day-close-meta-grid {
            break-inside: avoid;
        }
        .day-close-panel,
        .day-close-note {
            break-inside: avoid;
        }
    }
`;

export const buildCounterSessionXReportPrintDocument = (options: CounterSessionXReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Sales Counter Closing Report</title>
            <style>${KOT_PRINT_CSS}${COUNTER_X_REPORT_CSS}${DAY_CLOSING_REPORT_CSS}</style>
        </head>
        <body>
            ${buildCounterSessionXReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildDailyStockMovementReportBodyMarkup = ({
    settings,
    data,
    format = 'a4',
    copy_label,
}: DailyStockMovementReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">DAILY STOCK MOVEMENT</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">INVENTORY SUMMARY</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="items-section">
                    ${renderDailyStockMovementRows(data.items || [])}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildDailyStockMovementReportPrintMarkup = (options: DailyStockMovementReportPrintTemplateOptions) =>
    buildDailyStockMovementReportBodyMarkup(options);

export const buildDailyStockMovementReportPrintDocument = (options: DailyStockMovementReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Daily Stock Movement</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildDailyStockMovementReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildCashReconciliationReportBodyMarkup = ({
    settings,
    data,
    format = 'a6',
    copy_label,
}: CashReconciliationReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">CASH RECONCILIATION</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">CASH SUMMARY</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="totals-section">
                    ${renderBillTotalLine('Expected Cash', data.expected)}
                    ${renderBillTotalLine('Actual Cash', data.actual)}
                    ${renderBillTotalLine('Variance', data.variance, true)}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildCashReconciliationReportPrintMarkup = (options: CashReconciliationReportPrintTemplateOptions) =>
    buildCashReconciliationReportBodyMarkup(options);

export const buildCashReconciliationReportPrintDocument = (options: CashReconciliationReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Cash Reconciliation</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildCashReconciliationReportBodyMarkup(options)}
        </body>
    </html>
`;

const buildHourlySalesReportBodyMarkup = ({
    settings,
    data,
    format = 'a6',
    copy_label,
}: HourlySalesReportPrintTemplateOptions) => {
    const header = renderBrandBlock(settings);
    const footer = settings.footer_message
        ? `<div class="footer-message">${escapeHtml(settings.footer_message)}</div>`
        : '';

    return `
        <section class="kot-print-root format-${escapeHtml(format)}">
            <div class="kot-sheet">
                ${header}
                <header class="doc-header">
                    <div class="doc-title-row">
                        <div class="doc-title">HOURLY SALES</div>
                        ${copy_label ? `<div class="doc-copy">${escapeHtml(copy_label)}</div>` : ''}
                    </div>
                    <div class="doc-subtitle">SALES SUMMARY</div>
                </header>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <section class="items-section">
                    ${renderHourlySalesRows(data.hours || [])}
                </section>

                <div class="separator">${DASHED_SEPARATOR}</div>

                <footer class="audit-section">
                    ${renderMetaLine('Printed At', compactDateTime(data.printed_at || new Date()))}
                    ${renderMetaLine('Print ID', data.print_id ?? '-')}
                    ${footer}
                </footer>
            </div>
        </section>
    `;
};

export const buildHourlySalesReportPrintMarkup = (options: HourlySalesReportPrintTemplateOptions) =>
    buildHourlySalesReportBodyMarkup(options);

export const buildHourlySalesReportPrintDocument = (options: HourlySalesReportPrintTemplateOptions) => `
    <!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Hourly Sales</title>
            <style>${KOT_PRINT_CSS}</style>
        </head>
        <body>
            ${buildHourlySalesReportBodyMarkup(options)}
        </body>
    </html>
`;

const wrapEscPosText = (value: string, width: number) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [''];
    }

    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= width) {
            current = next;
            return;
        }
        if (current) {
            lines.push(current);
        }
        current = word;
    });

    if (current) {
        lines.push(current);
    }

    return lines;
};

export const buildKOTEscPosLines = (data: KOTPrintInput, width = 42) => {
    const [serviceLabel, serviceValue] = resolveServiceLabel(data);
    const lines = [
        'KITCHEN ORDER TICKET',
        'NEW ORDER',
        DASHED_SEPARATOR.slice(0, width),
        `KOT : ${data.kot_no}`,
        `ORD : ${data.order_no}`,
        `TIME: ${compactDateTime(data.datetime)}`,
        `TYPE: ${normalizeLabel(data.order_type)}`,
        `${serviceLabel.toUpperCase()}: ${serviceValue || '-'}`,
        `GUESTS: ${data.guests ?? '-'}`,
        `SERVER: ${data.server ?? '-'}`,
        DASHED_SEPARATOR.slice(0, width),
    ];

    data.items.forEach((item) => {
        const qty = String(item.qty).padEnd(4, ' ');
        const itemLines = wrapEscPosText(String(item.name || '').toUpperCase(), Math.max(width - qty.length - 1, 8));
        itemLines.forEach((line, index) => {
            lines.push(index === 0 ? `${qty} ${line}` : `${' '.repeat(qty.length)} ${line}`);
        });
        (item.modifiers || []).forEach((modifier) => {
            wrapEscPosText(`+ ${modifier}`, Math.max(width - 4, 8)).forEach((line) => {
                lines.push(`    ${line}`);
            });
        });
        lines.push('');
    });

    if (data.notes) {
        lines.push(DASHED_SEPARATOR.slice(0, width));
        lines.push('SPECIAL INSTRUCTIONS');
        wrapEscPosText(data.notes, width).forEach((line) => lines.push(line));
    }

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED BY: ${data.printed_by || data.server || '-'}`);
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildKOTChangeEscPosLines = (data: KOTChangePrintInput, width = 42) => {
    const lines = [
        'KOT CHANGE',
        'CHANGE ONLY',
        DASHED_SEPARATOR.slice(0, width),
        `VER : ${data.kot_version}`,
        `ORD : ${data.order_no}`,
        `TIME: ${compactDateTime(data.datetime)}`,
        `USER: ${data.user || '-'}`,
        DASHED_SEPARATOR.slice(0, width),
    ];

    const pushSection = (title: 'ADD' | 'CANCEL', items: KOTChangeItemInput[]) => {
        if (!items.length) {
            return;
        }
        lines.push('');
        lines.push(mapKOTChangeLabel(title));
        lines.push(DASHED_SEPARATOR.slice(0, width));
        items.forEach((item) => {
            const qty = String(item.qty ?? '-').padEnd(4, ' ');
            const itemLines = wrapEscPosText(String(item.name || '').toUpperCase(), Math.max(width - qty.length - 1, 8));
            itemLines.forEach((line, index) => {
                lines.push(index === 0 ? `${qty} ${line}` : `${' '.repeat(qty.length)} ${line}`);
            });
            (item.modifiers || []).forEach((modifier) => {
                wrapEscPosText(`+ ${modifier}`, Math.max(width - 4, 8)).forEach((line) => {
                    lines.push(`    ${line}`);
                });
            });
            lines.push('');
        });
    };

    pushSection('ADD', data.add_items || []);
    pushSection('CANCEL', data.cancel_items || []);

    if ((data.modify_items || []).length > 0) {
        lines.push('');
        lines.push(mapKOTChangeLabel('MODIFY'));
        lines.push(DASHED_SEPARATOR.slice(0, width));
        data.modify_items.forEach((item) => {
            wrapEscPosText(String(item.name || '').toUpperCase(), width).forEach((line) => lines.push(line));
            lines.push(`${String(item.old_qty)} -> ${String(item.new_qty)}`);
            lines.push('');
        });
    }

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildBillSummaryEscPosLines = (data: BillSummaryPrintInput, width = 42) => {
    const serviceValue = data.table ? `TABLE ${data.table}` : normalizeLabel(data.order_type).toUpperCase();
    const lines = [
        'BILL SUMMARY',
        'PRE-PAYMENT',
        DASHED_SEPARATOR.slice(0, width),
        `ORD : ${data.order_no}`,
        `TYPE: ${normalizeLabel(data.order_type)}`,
        serviceValue,
        DASHED_SEPARATOR.slice(0, width),
    ];

    data.items.forEach((item) => {
        const total = String(item.total);
        const itemWidth = Math.max(width - total.length - 1, 8);
        const itemLines = wrapEscPosText(String(item.name || '').toUpperCase(), itemWidth);
        itemLines.forEach((line, index) => {
            lines.push(index === 0 ? `${line.padEnd(itemWidth, ' ')} ${total}` : line);
        });
        lines.push(`QTY ${String(item.qty)} @ ${String(item.price)}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`SUBTOTAL: ${data.subtotal}`);
    lines.push(`TAX     : ${data.tax}`);
    lines.push(`TOTAL   : ${data.total}`);
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildPaymentReceiptEscPosLines = (data: PaymentReceiptPrintInput, width = 42) => {
    const lines = [
        'PAYMENT RECEIPT',
        'PAID',
        DASHED_SEPARATOR.slice(0, width),
        `REC : ${data.receipt_no}`,
        `ORD : ${data.order_no}`,
        `METHOD: ${normalizeLabel(data.method)}`,
        DASHED_SEPARATOR.slice(0, width),
    ];

    data.items.forEach((item) => {
        const total = String(item.total ?? '-');
        const itemWidth = Math.max(width - total.length - 1, 8);
        const itemLines = wrapEscPosText(String(item.name || '').toUpperCase(), itemWidth);
        itemLines.forEach((line, index) => {
            lines.push(index === 0 ? `${line.padEnd(itemWidth, ' ')} ${total}` : line);
        });
        if (item.qty !== undefined && item.qty !== null) {
            lines.push(`QTY ${String(item.qty)}`);
        }
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`TOTAL : ${data.total}`);
    lines.push(`PAID  : ${data.paid}`);
    lines.push(`CHANGE: ${data.change}`);
    lines.push(`METHOD: ${normalizeLabel(data.method)}`);
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildPartialPaymentReceiptEscPosLines = (data: PartialPaymentReceiptPrintInput, width = 42) => {
    const lines = [
        'PAYMENT RECEIPT',
        'PARTIAL',
        DASHED_SEPARATOR.slice(0, width),
        `ORD     : ${data.order_no}`,
        `TOTAL   : ${data.total}`,
        `PAID    : ${data.paid}`,
        `BALANCE : ${data.balance}`,
        `STATUS  : PARTIAL`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildSaleReturnReceiptEscPosLines = (data: SaleReturnReceiptPrintInput, width = 42) => {
    const lines = [
        'SALE RETURN',
        'RETURN RECEIPT',
        DASHED_SEPARATOR.slice(0, width),
        `RET : ${data.return_no}`,
        `ORD : ${data.order_no}`,
        `MODE: ${normalizeLabel(data.method || 'cash').toUpperCase()}`,
        DASHED_SEPARATOR.slice(0, width),
    ];

    data.items.forEach((item) => {
        wrapEscPosText(String(item.name || '').toUpperCase(), width).forEach((line) => lines.push(line));
        lines.push(`SOLD    : ${item.sold}`);
        lines.push(`RETURNED: ${item.returned}`);
        lines.push(`BALANCE : ${item.balance}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`REFUND: ${data.refund}`);
    (data.detail_lines || []).forEach((line) => {
        lines.push(`${String(line.label || '').toUpperCase()}: ${line.value}`);
    });
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push('REASON');
    wrapEscPosText(String(data.reason || '-'), width).forEach((line) => lines.push(line));
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildCreditSaleReceiptEscPosLines = (data: CreditSaleReceiptPrintInput, width = 42) => {
    const lines = [
        'CREDIT SALE',
        'ACCOUNT RECEIPT',
        DASHED_SEPARATOR.slice(0, width),
        `CUSTOMER: ${data.customer}`,
        `ORDER   : ${data.order_no}`,
        DASHED_SEPARATOR.slice(0, width),
        `TOTAL   : ${data.total}`,
        `PAID    : ${data.paid}`,
        `CREDIT  : ${data.credit}`,
        `PREV BAL: ${data.prev_balance}`,
        `NEW BAL : ${data.new_balance}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    if (data.show_previous_credit_history) {
        lines.splice(9, 0, `PREV CR : ${data.prev_pending_credit ?? '0'}`);
        lines.splice(10, 0, `PREV ORD: ${data.prev_pending_orders ?? '0'}`);
    }

    return lines;
};

export const buildCreditPaymentReceivedEscPosLines = (data: CreditPaymentReceivedPrintInput, width = 42) => {
    const lines = [
        'PAYMENT RECEIVED',
        'CREDIT ACCOUNT',
        DASHED_SEPARATOR.slice(0, width),
        `${String(data.account_label || 'Customer').toUpperCase()}: ${data.customer}`,
        DASHED_SEPARATOR.slice(0, width),
        'INVOICES PAID',
    ];

    if (data.cashier) lines.splice(4, 0, `CASHIER : ${data.cashier}`);
    if (data.method) lines.splice(5, 0, `METHOD  : ${data.method}`);
    if (data.reference_number) lines.splice(6, 0, `REF NO  : ${data.reference_number}`);
    (data.detail_lines || []).forEach((line) => {
        lines.splice(lines.indexOf('INVOICES PAID'), 0, `${String(line.label).slice(0, 8).toUpperCase().padEnd(8, ' ')}: ${line.value}`);
    });

    (data.invoices || []).forEach((item) => {
        lines.push(`ORDER # : ${item.order_no}`);
        lines.push(`PAID    : ${item.paid}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`TOTAL PAID : ${data.total_paid}`);
    lines.push(`PREV BAL   : ${data.prev_balance}`);
    lines.push(`REMAINING  : ${data.remaining}`);
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildOutstandingOrdersReportEscPosLines = (data: OutstandingOrdersReportPrintInput, width = 42) => {
    const lines = [
        'OUTSTANDING ORDERS',
        'OPEN BALANCE REPORT',
        DASHED_SEPARATOR.slice(0, width),
        `CUSTOMER: ${data.customer}`,
        DASHED_SEPARATOR.slice(0, width),
    ];

    (data.orders || []).forEach((item) => {
        lines.push(`ORDER   : ${item.order_no}`);
        lines.push(`DATE    : ${compactDateTime(item.date)}`);
        lines.push(`TOTAL   : ${item.total}`);
        lines.push(`PAID    : ${item.paid}`);
        lines.push(`BALANCE : ${item.balance}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`TOTAL OUTSTANDING: ${data.total_outstanding}`);
    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildWalletTopUpReceiptEscPosLines = (data: WalletTopUpReceiptPrintInput, width = 42) => {
    const lines = [
        'WALLET TOP-UP',
        'BALANCE RECEIPT',
        DASHED_SEPARATOR.slice(0, width),
        `CUSTOMER: ${data.customer}`,
        DASHED_SEPARATOR.slice(0, width),
        `ADDED   : ${data.added}`,
        `PREV BAL: ${data.prev_balance}`,
        `NEW BAL : ${data.new_balance}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildWalletPaymentReceiptEscPosLines = (data: WalletPaymentReceiptPrintInput, width = 42) => {
    const lines = [
        'WALLET PAYMENT',
        'PAYMENT RECEIPT',
        DASHED_SEPARATOR.slice(0, width),
        `ORDER # : ${data.order_no}`,
        DASHED_SEPARATOR.slice(0, width),
        `USED    : ${data.wallet_used}`,
        `BEFORE  : ${data.before}`,
        `AFTER   : ${data.after}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildXReportEscPosLines = (data: XReportPrintInput, width = 42) => {
    const lines = [
        'X REPORT',
        'MID-SHIFT',
        DASHED_SEPARATOR.slice(0, width),
        `ORDERS : ${data.orders}`,
        `GROSS  : ${data.gross_sales}`,
        DASHED_SEPARATOR.slice(0, width),
        'PAYMENTS',
        `CASH   : ${data.payments?.cash ?? '-'}`,
        `CARD   : ${data.payments?.card ?? '-'}`,
        `ONLINE : ${data.payments?.online ?? '-'}`,
        DASHED_SEPARATOR.slice(0, width),
        `RETURNS: ${data.returns}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildZReportEscPosLines = (data: ZReportPrintInput, width = 42) => {
    const lines = [
        'Z REPORT',
        'SHIFT CLOSE',
        DASHED_SEPARATOR.slice(0, width),
        `ORDERS : ${data.orders}`,
        `GROSS  : ${data.gross}`,
        `DISC   : ${data.discount}`,
        `RETURNS: ${data.returns}`,
        `NET    : ${data.net}`,
        DASHED_SEPARATOR.slice(0, width),
        'PAYMENTS',
        `CASH   : ${data.payments?.cash ?? '-'}`,
        `CARD   : ${data.payments?.card ?? '-'}`,
        `ONLINE : ${data.payments?.online ?? '-'}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildDayClosingReportEscPosLines = (data: DayClosingReportPrintInput, width = 42) => {
    const lines = [
        'DAY CLOSING REPORT',
        'SUMMARY',
        DASHED_SEPARATOR.slice(0, width),
        `ORDERS   : ${data.orders}`,
        `GROSS    : ${data.gross}`,
        `NET      : ${data.net}`,
        DASHED_SEPARATOR.slice(0, width),
        `DISCOUNT : ${data.discounts}`,
        `RETURNS  : ${data.returns}`,
        DASHED_SEPARATOR.slice(0, width),
        'PAYMENTS',
        `CASH     : ${data.payments?.cash ?? '-'}`,
        `CARD     : ${data.payments?.card ?? '-'}`,
        `ONLINE   : ${data.payments?.online ?? '-'}`,
        DASHED_SEPARATOR.slice(0, width),
        `EXPENSES : ${data.expenses}`,
        `VARIANCE : ${data.variance}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildDailyStockMovementReportEscPosLines = (data: DailyStockMovementReportPrintInput, width = 42) => {
    const lines = [
        'DAILY STOCK MOVEMENT',
        'INVENTORY SUMMARY',
        DASHED_SEPARATOR.slice(0, width),
    ];

    (data.items || []).forEach((item) => {
        lines.push(String(item.name));
        lines.push(`OPENING : ${item.opening}`);
        lines.push(`RECEIVED: ${item.received}`);
        lines.push(`ISSUED  : ${item.issued}`);
        lines.push(`CLOSING : ${item.closing}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const buildCashReconciliationReportEscPosLines = (
    data: CashReconciliationReportPrintInput,
    width = 42
) => {
    const lines = [
        'CASH RECONCILIATION',
        'CASH SUMMARY',
        DASHED_SEPARATOR.slice(0, width),
        `EXPECTED: ${data.expected}`,
        `ACTUAL  : ${data.actual}`,
        `VARIANCE: ${data.variance}`,
        DASHED_SEPARATOR.slice(0, width),
        `PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`,
        `PRINT ID: ${data.print_id ?? '-'}`,
    ];

    return lines;
};

export const buildHourlySalesReportEscPosLines = (data: HourlySalesReportPrintInput, width = 42) => {
    const lines = [
        'HOURLY SALES',
        'SALES SUMMARY',
        DASHED_SEPARATOR.slice(0, width),
    ];

    (data.hours || []).forEach((item) => {
        lines.push(`HOUR   : ${item.hour}`);
        lines.push(`ORDERS : ${item.orders}`);
        lines.push(`SALES  : ${item.sales}`);
        lines.push('');
    });

    lines.push(DASHED_SEPARATOR.slice(0, width));
    lines.push(`PRINTED AT: ${compactDateTime(data.printed_at || new Date())}`);
    lines.push(`PRINT ID: ${data.print_id ?? '-'}`);

    return lines;
};

export const KOT_ESC_POS_HINTS = [
    'Initialize with ESC @ before each ticket.',
    'Use emphasized mode for the KOT title and item names.',
    'Keep printer width at 42 characters for stable wrapping on 80mm heads.',
    'Feed 3 to 4 lines after the audit footer, then cut with GS V.',
    'Avoid bitmap-heavy logos on kitchen printers unless the head and buffer are known to be stable.',
];
