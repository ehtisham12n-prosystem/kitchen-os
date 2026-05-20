import { useEffect, useState } from 'react';
import {
    CheckCircle2,
    ChefHat,
    CreditCard,
    RotateCcw,
    ShoppingBag,
    User,
    X,
} from 'lucide-react';
import { posApi } from '../../api/api';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, formatConfiguredReceiptNumber } from './printTemplates/printHelpers';
import styles from './OrderAuditModal.module.css';

type AuditEventType = 'creation' | 'kot' | 'kitchen' | 'payment' | 'return' | 'closure' | 'void';

interface AuditEvent {
    id: string | number;
    type: AuditEventType;
    time: string;
    title: string;
    details: string;
    items?: string[];
    user?: string;
    amount?: number;
    meta?: string[];
}

interface OrderAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number;
    orderNumber: string;
}

const formatAuditDate = (value?: string | null) => {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const normalizeLabel = (value?: string | null) =>
    String(value || '')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildEntryKey = (entry: any) =>
    String(entry?.order_item_id ?? `${entry?.product_id ?? 'product'}:${entry?.product_name ?? entry?.name ?? 'item'}`);

const getEntryName = (entry: any) => String(entry?.product_name ?? entry?.name ?? 'Item').trim() || 'Item';

const getEntryNotes = (entry: any) => String(entry?.item_notes ?? entry?.notes ?? entry?.instructions ?? '').trim();

const parseKotEntries = (kot: any): any[] => {
    if (Array.isArray(kot?.items)) {
        return kot.items;
    }
    try {
        const parsed = JSON.parse(String(kot?.items_json || '[]'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const summarizeKotChanges = (currentEntries: any[], previousEntries: any[], isFirst: boolean) => {
    const previousByKey = new Map(previousEntries.map((entry) => [buildEntryKey(entry), entry]));
    const additions: string[] = [];
    const removals: string[] = [];
    const quantityUpdates: string[] = [];
    const noteUpdates: string[] = [];

    currentEntries.forEach((entry) => {
        const key = buildEntryKey(entry);
        const previousEntry = previousByKey.get(key);
        const name = getEntryName(entry);
        const quantity = Number(entry?.quantity ?? 0);
        const previousQuantity = previousEntry ? Number(previousEntry?.quantity ?? 0) : null;
        const notes = getEntryNotes(entry);
        const previousNotes = getEntryNotes(previousEntry);
        const cancelled = entry?.is_cancelled || quantity <= 0 || String(entry?.item_status || '').toLowerCase() === 'voided';

        if (cancelled) {
            if (!previousEntry || !previousEntry?.is_cancelled) {
                removals.push(`${name}${previousQuantity ? ` (${previousQuantity} removed)` : ''}`);
            }
            return;
        }

        if (isFirst || !previousEntry || Boolean(entry?.is_new)) {
            additions.push(`${quantity}x ${name}${notes ? ` (${notes})` : ''}`);
            return;
        }

        if (previousQuantity !== null && previousQuantity !== quantity) {
            quantityUpdates.push(`${name} (${previousQuantity} -> ${quantity})`);
        }

        if (previousNotes !== notes) {
            noteUpdates.push(`${name}${notes ? ` (${notes})` : ' (notes cleared)'}`);
        }
    });

    const lines = [
        ...additions.map((line) => `Added: ${line}`),
        ...removals.map((line) => `Removed: ${line}`),
        ...quantityUpdates.map((line) => `Qty Changed: ${line}`),
        ...noteUpdates.map((line) => `Notes Updated: ${line}`),
    ];

    if (lines.length === 0 && currentEntries.length > 0) {
        lines.push(...currentEntries
            .filter((entry) => !entry?.is_cancelled && Number(entry?.quantity ?? 0) > 0)
            .map((entry) => `${Number(entry?.quantity ?? 0)}x ${getEntryName(entry)}${getEntryNotes(entry) ? ` (${getEntryNotes(entry)})` : ''}`));
    }

    const summaryParts = [
        additions.length > 0 ? `${additions.length} added` : null,
        removals.length > 0 ? `${removals.length} removed` : null,
        quantityUpdates.length > 0 ? `${quantityUpdates.length} quantity updated` : null,
        noteUpdates.length > 0 ? `${noteUpdates.length} notes changed` : null,
    ].filter(Boolean);

    return {
        lines,
        summary: summaryParts.length > 0
            ? `${isFirst ? 'Initial kitchen submission' : 'Changes submitted'}: ${summaryParts.join(', ')}.`
            : `${isFirst ? 'Initial kitchen submission' : 'Kitchen submission'} recorded.`,
    };
};

const getEventIcon = (type: AuditEventType) => {
    if (type === 'creation') return <ShoppingBag size={14} />;
    if (type === 'kot' || type === 'kitchen') return <ChefHat size={14} />;
    if (type === 'payment' || type === 'closure') return <CreditCard size={14} />;
    if (type === 'return') return <RotateCcw size={14} />;
    return <CheckCircle2 size={14} />;
};

export function OrderAuditModal({ isOpen, onClose, orderId, orderNumber }: OrderAuditModalProps) {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { formatMoney } = useCurrencyConfig();

    useEffect(() => {
        if (isOpen && orderId) {
            void loadOrderAudit();
        }
    }, [isOpen, orderId]);

    const loadOrderAudit = async () => {
        setIsLoading(true);
        try {
            const order = await posApi.getOrder(orderId);
            const visibleOrderNumber = formatConfiguredOrderNumber(order.order_number || orderNumber, order, { preserveTypePrefix: true }) || order.order_number || orderNumber;
            const timeline: AuditEvent[] = [];

            timeline.push({
                id: 'creation',
                type: 'creation',
                time: order.created_at,
                title: 'Order Created',
                details: `Order #${visibleOrderNumber} started.`,
                user: order.order_taker_name || order.order_taker_username || 'Staff',
                meta: [
                    `Status: ${normalizeLabel(order.order_status) || 'Pending'}`,
                    `Payment: ${normalizeLabel(order.payment_status) || 'Unpaid'}`,
                ],
            });

            const kots = Array.isArray(order.kots)
                ? [...order.kots].sort((left: any, right: any) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime())
                : [];

            let previousEntries: any[] = [];
            kots.forEach((kot: any, index: number) => {
                const entries = parseKotEntries(kot);
                const changeSummary = summarizeKotChanges(entries, previousEntries, index === 0);
                const kotNumber = formatConfiguredKotNumber(String(kot?.kot_number || order?.current_kot_display_number || '-').trim() || '-', kot, { preserveTypePrefix: true }) || String(kot?.kot_number || order?.current_kot_display_number || '-').trim() || '-';

                timeline.push({
                    id: `kot-${kot.id}`,
                    type: 'kot',
                    time: kot.created_at,
                    title: `KOT #${kotNumber}`,
                    details: changeSummary.summary,
                    items: changeSummary.lines,
                    meta: [
                        `Submission ${index + 1}`,
                        `Kitchen Status: ${normalizeLabel(kot.status) || 'Pending'}`,
                    ],
                });

                const createdTime = new Date(kot.created_at || 0).getTime();
                const updatedTime = new Date(kot.updated_at || kot.created_at || 0).getTime();
                const normalizedKotStatus = String(kot.status || '').toLowerCase();
                if (
                    normalizedKotStatus
                    && normalizedKotStatus !== 'pending'
                    && Number.isFinite(updatedTime)
                    && updatedTime - createdTime > 1000
                ) {
                    timeline.push({
                        id: `kitchen-${kot.id}`,
                        type: 'kitchen',
                        time: kot.updated_at,
                        title: `Kitchen Status Changed`,
                        details: `KOT #${kotNumber} is now ${normalizeLabel(kot.status)}.`,
                        meta: [`KOT #${kotNumber}`],
                    });
                }

                previousEntries = entries;
            });

            const payments = Array.isArray(order.payments)
                ? [...order.payments]
                : Array.isArray(order.transactions)
                    ? [...order.transactions]
                    : [];
            payments
                .sort((left: any, right: any) => new Date(left.transaction_date || 0).getTime() - new Date(right.transaction_date || 0).getTime())
                .forEach((tx: any) => {
                    const paymentMode = normalizeLabel(tx.payment_mode) || 'Payment';
                    const reference = String(tx.reference_number || '').trim();
                    timeline.push({
                        id: `tx-${tx.id}`,
                        type: 'payment',
                        time: tx.transaction_date,
                        title: tx.is_refund ? `${paymentMode} Refund` : `${paymentMode} Payment`,
                        details: tx.is_refund
                            ? `${paymentMode} refund recorded.`
                            : `${paymentMode} payment recorded.`,
                        amount: Number(tx.amount || 0),
                        user: tx.user_name || 'Staff',
                        meta: [
                            `Payment Status: ${normalizeLabel(order.payment_status) || 'Unpaid'}`,
                            ...(reference ? [`Ref: ${reference}`] : []),
                        ],
                    });
                });

            if (Array.isArray(order.returns)) {
                [...order.returns]
                    .sort((left: any, right: any) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime())
                    .forEach((ret: any) => {
                        timeline.push({
                            id: `ret-${ret.id}`,
                            type: 'return',
                            time: ret.created_at,
                            title: 'Sales Return',
                            details: ret.return_note?.trim() || ret.payment_note?.trim() || 'Return processed.',
                            amount: Number(ret.refund_amount || 0),
                            meta: [
                                `Refund Scope: ${normalizeLabel(ret.return_scope) || 'Partial'}`,
                                `Restock: ${ret.restock_inventory ? 'Yes' : 'No'}`,
                            ],
                        });
                    });
            }

            if (order.voided_at) {
                timeline.push({
                    id: 'voided',
                    type: 'void',
                    time: order.voided_at,
                    title: 'Order Voided',
                    details: order.void_reason?.trim() || 'Order was voided.',
                    user: order.void_authorized_by_username || undefined,
                    meta: [`Status: ${normalizeLabel(order.order_status) || 'Voided'}`],
                });
            } else if (String(order.order_status || '').toLowerCase() === 'cancelled') {
                timeline.push({
                    id: 'cancelled',
                    type: 'void',
                    time: order.updated_at || order.created_at,
                    title: 'Order Cancelled',
                    details: order.order_note?.trim() || 'Order was cancelled.',
                    meta: [`Status: ${normalizeLabel(order.order_status)}`],
                });
            }

            if (order.finalized_at) {
                timeline.push({
                    id: 'closed',
                    type: 'closure',
                    time: order.finalized_at,
                    title: 'Order Closed',
                    details: order.receipt_number
                        ? `Receipt ${formatConfiguredReceiptNumber(order.receipt_number, order, { preserveTypePrefix: true }) || order.receipt_number} issued and order closed.`
                        : 'Order payment completed and order closed.',
                    meta: [
                        `Order Status: ${normalizeLabel(order.order_status) || 'Completed'}`,
                        `Payment Status: ${normalizeLabel(order.payment_status) || 'Paid'}`,
                        ...(order.current_kot_display_number ? [`Final KOT: ${formatConfiguredKotNumber(order.current_kot_display_number, order, { preserveTypePrefix: true }) || order.current_kot_display_number}`] : []),
                    ],
                });
            }

            timeline.sort((left, right) => new Date(left.time || 0).getTime() - new Date(right.time || 0).getTime());
            setEvents(timeline);
        } catch (error) {
            console.error('Audit Load Failed:', error);
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Order History: {formatConfiguredOrderNumber(orderNumber, { order_number: orderNumber }, { preserveTypePrefix: true }) || orderNumber}</h2>
                    <button className="kitchen-button-text" onClick={onClose}><X size={24} /></button>
                </div>

                <div className={styles.content}>
                    {isLoading ? (
                        <div className={styles.emptyState}>Loading timeline...</div>
                    ) : (
                        <div className={styles.timeline}>
                            {events.map((event) => (
                                <div key={event.id} className={styles.timelineItem}>
                                    <div className={styles.timelineDot}>
                                        {getEventIcon(event.type)}
                                    </div>
                                    <div className={styles.timelineContent}>
                                        <span className={styles.time}>{formatAuditDate(event.time)}</span>
                                        <span className={styles.title}>{event.title}</span>
                                        <p className={styles.details}>{event.details}</p>

                                        {event.meta && event.meta.length > 0 && (
                                            <div className={styles.metaRow}>
                                                {event.meta.map((entry) => (
                                                    <span key={entry} className={styles.metaBadge}>{entry}</span>
                                                ))}
                                            </div>
                                        )}

                                        {event.items && event.items.length > 0 && (
                                            <ul className={styles.kotList}>
                                                {event.items.map((item, index) => <li key={`${event.id}-${index}`}>{item}</li>)}
                                            </ul>
                                        )}

                                        {event.amount !== undefined && (
                                            <div className={`${styles.amount} ${event.type === 'return' ? styles.amountNegative : styles.amountPositive}`}>
                                                {event.type === 'return' || Number(event.amount) < 0 ? '-' : '+'}
                                                {formatMoney(Math.abs(Number(event.amount || 0)), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </div>
                                        )}

                                        {event.user && (
                                            <div className={styles.userLine}>
                                                <User size={12} />
                                                {event.user}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {events.length === 0 && <div className={styles.emptyState}>No events recorded for this order.</div>}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className="kitchen-button-primary" onClick={onClose}>Close Window</button>
                </div>
            </div>
        </div>
    );
}
