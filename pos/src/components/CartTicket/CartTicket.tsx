import { KitchenButton } from '../ui/KitchenButton/KitchenButton';
import styles from './CartTicket.module.css';

export interface CartItem {
    id: string; // unique cart line ID
    productId: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: string[]; // e.g., ["No Onions", "Extra Cheese"]
}

interface CartTicketProps {
    items: CartItem[];
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemoveItem: (id: string) => void;
    onCheckout: () => void;
    orderType?: 'Dine In' | 'Takeaway' | 'Delivery';
    customerName?: string;
}

export function CartTicket({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    orderType = 'Dine In',
    customerName = 'Guest',
}: CartTicketProps) {

    // Calculate Totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = 0.08; // 8% mock tax
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    return (
        <div className={styles.ticket}>
            {/* Header section pinned to top */}
            <div className={styles.header}>
                <div className={styles.orderMeta}>
                    <span className={styles.orderType}>{orderType}</span>
                    <span className={styles.customerName}>{customerName}</span>
                </div>
                <div className={styles.actions}>
                    <KitchenButton variant="ghost" size="sm">...</KitchenButton>
                </div>
            </div>

            {/* Scrollable Items List */}
            <div className={styles.itemsList}>
                {items.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>Cart is empty</p>
                        <span>Tap items to add</span>
                    </div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className={styles.lineItem}>
                            <div className={styles.itemHeader}>
                                <span className={styles.itemName}>{item.name}</span>
                                <span className={styles.itemTotal}>{formatCurrency(item.price * item.quantity)}</span>
                            </div>

                            {/* Modifiers if any */}
                            {item.modifiers && item.modifiers.length > 0 && (
                                <div className={styles.modifiers}>
                                    {item.modifiers.map((mod, i) => (
                                        <span key={i} className={styles.modTag}>{mod}</span>
                                    ))}
                                </div>
                            )}

                            {/* Quantity Controls */}
                            <div className={styles.qtyControls}>
                                <button className={styles.qtyBtn} onClick={() => onUpdateQuantity(item.id, -1)}>−</button>
                                <span className={styles.qtyValue}>{item.quantity}</span>
                                <button className={styles.qtyBtn} onClick={() => onUpdateQuantity(item.id, 1)}>+</button>
                                <div className={styles.spacer} />
                                <KitchenButton variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)} className={styles.removeBtn}>
                                    Remove
                                </KitchenButton>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer pinned to bottom with Totals & Pay */}
            <div className={styles.footer}>
                <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Tax</span>
                    <span>{formatCurrency(tax)}</span>
                </div>
                <div className={styles.grandTotal}>
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                </div>

                <KitchenButton
                    variant="primary"
                    size="lg"
                    className={styles.payBtn}
                    disabled={items.length === 0}
                    onClick={onCheckout}
                >
                    Pay {formatCurrency(total)}
                </KitchenButton>
            </div>
        </div>
    );
}
