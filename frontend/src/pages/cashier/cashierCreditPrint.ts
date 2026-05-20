import {
    formatDateTime,
    formatMoney,
    getLastPaymentDate,
    getOutstandingAmount,
    getPaidAmount,
    paymentStatusLabel,
    type CashierOrder,
} from './cashierUtils';
import { toast } from '../../components/ui/KitchenToast/toast';
import { formatConfiguredOrderNumber } from '../pos/printTemplates/printHelpers';

export type CashierCreditPrintMode = 'all' | 'customer' | 'order_taker';

type GroupedReport = {
    heading: string;
    subheading: string;
    orders: CashierOrder[];
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
};

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildGroups(mode: CashierCreditPrintMode, orders: CashierOrder[]) {
    if (mode === 'all') {
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
        const paidAmount = orders.reduce((sum, order) => sum + getPaidAmount(order), 0);
        const outstandingAmount = orders.reduce((sum, order) => sum + getOutstandingAmount(order), 0);
        return [{
            heading: 'All Credited Orders',
            subheading: `${orders.length} order(s)`,
            orders,
            totalAmount,
            paidAmount,
            outstandingAmount,
        }];
    }

    const grouped = new Map<string, CashierOrder[]>();
    orders.forEach((order) => {
        const key = mode === 'customer'
            ? String(order.customer_name || 'Walk-in customer').trim() || 'Walk-in customer'
            : String(order.order_taker_name || 'Staff').trim() || 'Staff';
        grouped.set(key, [...(grouped.get(key) ?? []), order]);
    });

    return Array.from(grouped.entries())
        .map(([label, rows]) => ({
            heading: label,
            subheading:
                mode === 'customer'
                    ? `${rows[0]?.customer_phone || 'No phone'}`
                    : `${rows.length} order(s)`,
            orders: rows.sort((left, right) =>
                new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime(),
            ),
            totalAmount: rows.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
            paidAmount: rows.reduce((sum, order) => sum + getPaidAmount(order), 0),
            outstandingAmount: rows.reduce((sum, order) => sum + getOutstandingAmount(order), 0),
        }))
        .sort((left, right) => right.outstandingAmount - left.outstandingAmount);
}

function buildGroupMarkup(group: GroupedReport, mode: CashierCreditPrintMode) {
    const orderLines = group.orders.map((order) => `
        <div class="line-item">
            <div class="line-top">
                <span class="line-strong">${escapeHtml(formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, order, { preserveTypePrefix: true }) || order.order_number || `Order #${order.id}`)}</span>
                <span class="line-strong">${escapeHtml(formatMoney(getOutstandingAmount(order)))}</span>
            </div>
            <div class="line-meta">${escapeHtml(formatDateTime(order.created_at))}</div>
            <div class="line-meta">${escapeHtml(String(order.order_type || 'dine_in').replace(/_/g, ' '))} | ${escapeHtml(order.sale_counter_code || order.sale_counter_name || '-')}</div>
            <div class="line-meta">${mode === 'order_taker'
                ? `Customer: ${escapeHtml(order.customer_name || 'Walk-in customer')}`
                : `Taker: ${escapeHtml(order.order_taker_name || 'Staff')}`}</div>
            <div class="line-meta">Paid ${escapeHtml(formatMoney(getPaidAmount(order)))} / Total ${escapeHtml(formatMoney(order.total_amount || 0))}</div>
            <div class="line-meta">Last pay: ${escapeHtml(formatDateTime(getLastPaymentDate(order)))}</div>
            <div class="line-meta">Status: ${escapeHtml(paymentStatusLabel(order.payment_status))}</div>
        </div>
    `).join('');

    return `
        <section class="group">
            <div class="group-head">
                <div class="group-title">${escapeHtml(group.heading)}</div>
                <div class="group-subtitle">${escapeHtml(group.subheading)}</div>
            </div>
            <div class="metrics">
                <div class="metric"><span>Orders</span><strong>${group.orders.length}</strong></div>
                <div class="metric"><span>Total</span><strong>${escapeHtml(formatMoney(group.totalAmount))}</strong></div>
                <div class="metric"><span>Paid</span><strong>${escapeHtml(formatMoney(group.paidAmount))}</strong></div>
                <div class="metric"><span>Due</span><strong>${escapeHtml(formatMoney(group.outstandingAmount))}</strong></div>
            </div>
            <div class="separator">--------------------------</div>
            ${orderLines}
        </section>
    `;
}

function buildDocument(mode: CashierCreditPrintMode, branchName: string, orders: CashierOrder[]) {
    const title = mode === 'customer'
        ? 'Customer-Wise Credit Report'
        : mode === 'order_taker'
            ? 'Order Taker-Wise Credit Report'
            : 'All Credited Orders Report';
    const groups = buildGroups(mode, orders);
    const totalOrders = orders.length;
    const totalOutstanding = orders.reduce((sum, order) => sum + getOutstandingAmount(order), 0);

    return `
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
        @page { size: 80mm auto; margin: 4mm; }
        html, body { margin: 0; padding: 0; background: #fff; color: #000; }
        body {
            width: 72mm;
            margin: 0 auto;
            font-family: "Courier New", monospace;
            font-size: 11px;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .sheet { padding: 3mm 0 6mm; }
        .header { text-align: center; display: grid; gap: 2px; }
        .title { font-size: 14px; font-weight: 700; text-transform: uppercase; }
        .subtitle, .meta, .line-meta, .group-subtitle { color: #222; }
        .summary {
            margin-top: 8px;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 6px 0;
            display: grid;
            gap: 3px;
        }
        .summary-row, .line-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
        }
        .line-strong, .summary strong, .group-title { font-weight: 700; }
        .group {
            margin-top: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .group-head { display: grid; gap: 1px; }
        .metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            margin-top: 6px;
        }
        .metric {
            border: 1px solid #000;
            padding: 4px;
            display: grid;
            gap: 2px;
        }
        .metric span { font-size: 9px; text-transform: uppercase; }
        .separator {
            margin: 6px 0;
            text-align: center;
            letter-spacing: 0.05em;
            font-size: 10px;
        }
        .line-item {
            padding: 5px 0;
            border-bottom: 1px dashed #999;
            display: grid;
            gap: 1px;
        }
        .footer {
            margin-top: 10px;
            border-top: 1px dashed #000;
            padding-top: 6px;
            text-align: center;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="sheet">
        <header class="header">
            <div class="title">${escapeHtml(title)}</div>
            <div class="subtitle">${escapeHtml(branchName || 'Active Branch')}</div>
            <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        </header>
        <section class="summary">
            <div class="summary-row"><span>Report Groups</span><strong>${groups.length}</strong></div>
            <div class="summary-row"><span>Total Orders</span><strong>${totalOrders}</strong></div>
            <div class="summary-row"><span>Outstanding</span><strong>${escapeHtml(formatMoney(totalOutstanding))}</strong></div>
        </section>
        ${groups.map((group) => buildGroupMarkup(group, mode)).join('')}
        <footer class="footer">80mm thermal credit ledger</footer>
    </div>
</body>
</html>`;
}

export function printCashierCreditReport(mode: CashierCreditPrintMode, branchName: string, orders: CashierOrder[]) {
    if (!orders.length) {
        toast.error('Nothing To Print', 'There are no credited orders available for the current filters.');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=900');
    if (!printWindow) {
        toast.error('Popup Blocked', 'Allow popups to open the thermal print report.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(buildDocument(mode, branchName, orders));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}
