import {
    buildBillSummaryPrintDocument,
    buildPartialPaymentReceiptPrintDocument,
    buildPaymentReceiptPrintDocument,
    buildSaleReturnReceiptPrintDocument,
} from '../pos/printTemplates/kotPrintTemplate';
import { formatConfiguredOrderNumber, formatConfiguredReceiptNumber, openPrintDocumentCopies, resolvePrintTemplateSettings } from '../pos/printTemplates/printHelpers';
import {
    formatMoney,
    getLastPaymentDate,
    getOutstandingAmount,
    getPaidAmount,
    normalizePaymentStatus,
    type CashierOrder,
} from './cashierUtils';

function uniquePaymentMethods(order: CashierOrder): string[] {
    return Array.from(
        new Set(
            (order.payments ?? [])
                .filter((payment) => !payment.is_refund)
                .map((payment) => String(payment.payment_mode || '').replace(/_/g, ' ').trim())
                .filter(Boolean),
        ),
    );
}

function paymentDetailLines(order: CashierOrder): Array<{ label: string; value: string }> {
    const references = Array.from(
        new Set(
            (order.payments ?? [])
                .filter((payment) => !payment.is_refund)
                .map((payment) => String(payment.reference_number || '').trim())
                .filter(Boolean),
        ),
    );
    const lines: Array<{ label: string; value: string }> = [];
    if (references.length > 0) {
        lines.push({ label: 'Reference', value: references.join(', ') });
    }
    const lastPayment = getLastPaymentDate(order);
    if (lastPayment) {
        lines.push({ label: 'Last Payment', value: lastPayment });
    }
    return lines;
}

function refundPaymentMethods(order: CashierOrder): string[] {
    const latestReturnPayments = order.latest_return?.payments ?? [];
    const orderRefundPayments = (order.payments ?? []).filter((payment) => payment.is_refund);
    const source = latestReturnPayments.length > 0 ? latestReturnPayments : orderRefundPayments;

    return Array.from(
        new Set(
            source
                .map((payment) => String(payment.payment_mode || '').replace(/_/g, ' ').trim())
                .filter(Boolean),
        ),
    );
}

function refundDetailLines(order: CashierOrder): Array<{ label: string; value: string }> {
    const source = order.latest_return?.payments?.length
        ? order.latest_return.payments
        : (order.payments ?? []).filter((payment) => payment.is_refund);
    const references = Array.from(
        new Set(
            source
                .map((payment) => String(payment.reference_number || '').trim())
                .filter(Boolean),
        ),
    );

    const lines: Array<{ label: string; value: string }> = [];
    if (order.latest_return?.authorized_by) {
        lines.push({ label: 'Authorized By', value: String(order.latest_return.authorized_by) });
    }
    if (references.length > 0) {
        lines.push({ label: 'Reference', value: references.join(', ') });
    }
    return lines;
}

function saleReturnItems(order: CashierOrder) {
    const returnItems = Array.isArray(order.latest_return?.items) ? order.latest_return.items : [];
    const cumulativeReturnedByProduct = new Map<string, number>();

    (Array.isArray(order.returns) ? order.returns : []).forEach((returnRecord) => {
        (Array.isArray(returnRecord?.items) ? returnRecord.items : []).forEach((item) => {
            const key = String(item?.product_name || item?.id || '');
            cumulativeReturnedByProduct.set(key, (cumulativeReturnedByProduct.get(key) || 0) + Number(item?.quantity || 0));
        });
    });

    return returnItems.map((returnItem) => {
        const key = String(returnItem?.product_name || returnItem?.id || '');
        const soldMatch = (order.items ?? []).find((item) => String(item.product_name || item.id || '') === key);
        const soldQuantity = Number(soldMatch?.quantity || 0);
        const returnedQuantity = cumulativeReturnedByProduct.get(key) || Number(returnItem?.quantity || 0);

        return {
            name: returnItem?.product_name || 'Item',
            sold: soldQuantity,
            returned: returnedQuantity,
            balance: Math.max(soldQuantity - returnedQuantity, 0),
        };
    });
}

export function canPrintCashierReceipt(order: CashierOrder): boolean {
    return String(order.order_status || '').trim().toLowerCase() !== 'cancelled';
}

export function printCashierPaymentReceipt(order: CashierOrder, branchSource: any, branchLabel: string): boolean {
    if (!canPrintCashierReceipt(order)) {
        return false;
    }

    const settings = resolvePrintTemplateSettings(branchSource || { branch_name: branchLabel }, branchLabel);
    const visibleOrderNumber = formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, branchSource || order, { preserveTypePrefix: true })
        || order.order_number
        || `Order #${order.id}`;
    const visibleReceiptNumber = formatConfiguredReceiptNumber(order.receipt_number || '', branchSource || order, { preserveTypePrefix: true })
        || order.receipt_number
        || '';
    const paidAmount = getPaidAmount(order);
    const outstanding = getOutstandingAmount(order);
    const paymentStatus = normalizePaymentStatus(order.payment_status);
    const printableItems = (order.items ?? [])
        .filter((item) => String(item.item_status || '').toLowerCase() !== 'voided')
        .map((item) => ({
            name: item.product_name || 'Item',
            qty: Number(item.quantity || 0),
            price: formatMoney(item.item_price),
            total: formatMoney(Number(item.item_price || 0) * Number(item.quantity || 0)),
        }));
    const isReturnedOrder = Boolean(order.latest_return)
        && ['refunded', 'partially_refunded'].includes(String(order.payment_status || '').trim().toLowerCase());
    const documentMarkup = isReturnedOrder
        ? buildSaleReturnReceiptPrintDocument({
            settings,
            format: settings.receipt_paper_size || 'thermal-80mm',
            data: {
                return_no: order.latest_return?.id || order.latest_return?.return_number || order.id,
                return_invoice_no: order.latest_return?.return_number || null,
                branch_id: order.sale_counter_id || null,
                order_no: visibleOrderNumber,
                datetime: order.latest_return?.created_at || order.created_at || new Date(),
                cashier: order.order_taker_username || order.order_taker_name || '',
                server: order.order_taker_name || order.order_taker_username || '-',
                authorized_by: order.latest_return?.authorized_by || null,
                customer: order.customer_name || 'Walk-in Customer',
                order_type: String(order.order_type || 'dine_in').replace(/_/g, ' '),
                table: order.table_number || null,
                items: saleReturnItems(order),
                refund: formatMoney(Number(order.latest_return?.refund_amount || order.refunded_amount || 0)),
                refund_plain: Number(order.latest_return?.refund_amount || order.refunded_amount || 0),
                method: refundPaymentMethods(order).join(' / ') || 'cash',
                reason: order.latest_return?.return_note || order.latest_return?.payment_note || 'Sales return',
                detail_lines: refundDetailLines(order),
                printed_at: new Date(),
                print_id: order.latest_return?.id || order.id,
            },
        })
        : (paymentStatus === 'unpaid' || paidAmount <= 0.009)
        ? buildBillSummaryPrintDocument({
            settings,
            format: settings.receipt_paper_size || 'thermal-80mm',
            data: {
                receipt_no: visibleReceiptNumber,
                order_no: visibleOrderNumber,
                datetime: order.created_at || new Date(),
                counter_id: order.sale_counter_code || order.sale_counter_name || '',
                cashier: order.order_taker_username || order.order_taker_name || '',
                server: order.order_taker_name || order.order_taker_username || '-',
                customer: order.customer_name || 'Walk-in Customer',
                customer_phone: order.customer_phone || null,
                order_type: String(order.order_type || 'dine_in').replace(/_/g, ' '),
                table: order.table_number || null,
                items: printableItems,
                subtotal: formatMoney(order.sub_total),
                tax: formatMoney(order.tax_amount),
                discount: Number(order.discount_amount || 0) > 0 ? formatMoney(order.discount_amount) : null,
                total: formatMoney(order.total_amount),
                printed_at: new Date(),
                print_id: order.receipt_number || order.id,
            },
        })
        : paymentStatus === 'partial' && outstanding > 0.009
        ? buildPartialPaymentReceiptPrintDocument({
            settings,
            format: settings.receipt_paper_size || 'thermal-80mm',
            data: {
                order_no: visibleOrderNumber,
                total: formatMoney(order.total_amount),
                paid: formatMoney(paidAmount),
                balance: formatMoney(outstanding),
                printed_at: new Date(),
                print_id: order.receipt_number || order.id,
            },
        })
        : buildPaymentReceiptPrintDocument({
            settings,
            format: settings.receipt_paper_size || 'thermal-80mm',
            data: {
                receipt_no: visibleReceiptNumber,
                order_no: visibleOrderNumber,
                datetime: order.finalized_at || order.created_at || new Date(),
                counter_id: order.sale_counter_code || order.sale_counter_name || '',
                cashier: order.order_taker_username || order.order_taker_name || '',
                server: order.order_taker_name || order.order_taker_username || '-',
                customer: order.customer_name || 'Walk-in Customer',
                customer_phone: order.customer_phone || null,
                order_type: String(order.order_type || 'dine_in').replace(/_/g, ' '),
                table: order.table_number || null,
                items: printableItems,
                subtotal: formatMoney(order.sub_total),
                discount: Number(order.discount_amount || 0) > 0 ? formatMoney(order.discount_amount) : null,
                total: formatMoney(order.total_amount),
                tax: formatMoney(order.tax_amount),
                paid: formatMoney(Math.max(paidAmount, Number(order.total_amount || 0) - outstanding)),
                change: formatMoney(0),
                method: uniquePaymentMethods(order).join(' / ') || 'cash',
                detail_lines: paymentDetailLines(order),
                printed_at: new Date(),
                print_id: order.receipt_number || order.id,
            },
        });

    return openPrintDocumentCopies(
        () => documentMarkup,
        settings.receipt_print_copies || 1,
        visibleOrderNumber ? `Order ${visibleOrderNumber}` : 'Receipt',
    );
}
