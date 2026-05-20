import { useState, useEffect } from 'react';
import { db } from './db';
import type { LocalProduct, LocalOrder } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, User, Ticket, CheckCircle2 } from 'lucide-react';
import { SyncService } from './services/sync.service';

interface CartItem {
    product: LocalProduct;
    qty: number;
}

export function PosTerminal() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Phase 5 State
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Layout states
    const [activeCategory, setActiveCategory] = useState('All Items');
    const [showPictures, setShowPictures] = useState(true);
    const [cardStyle, setCardStyle] = useState<'list' | 'small' | 'medium' | 'large'>('medium');

    // Auto-subscribe to the local Dexie DB!
    const products = useLiveQuery(() => db.products.toArray()) || [];
    const pendingOrders = useLiveQuery(() => db.orders.where('sync_status').equals('pending').count()) || 0;
    const currentShift = useLiveQuery(() => db.shifts.where('status').equals('open').last());
    const failedSyncs = useLiveQuery(() => db.syncQueue
        .filter((row) => row.status === 'failed' || row.status === 'conflict')
        .count()) || 0;

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const addToCart = (product: LocalProduct, qtyAdd: number = 1, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setCart(prev => {
            const existing = prev.find(item => item.product.product_id === product.product_id);
            if (existing) {
                if (existing.qty + qtyAdd <= 0) {
                    return prev.filter(item => item.product.product_id !== product.product_id);
                }
                return prev.map(item => item.product.product_id === product.product_id ? { ...item, qty: item.qty + qtyAdd } : item);
            }
            if (qtyAdd > 0) return [...prev, { product, qty: qtyAdd }];
            return prev;
        });
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.product.product_id !== id));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const taxAmount = (cartTotal - discountAmount) * 0.08;
    const finalTotal = (cartTotal - discountAmount) + taxAmount;

    // Phase 5 Logic: Customer Lookup
    const searchCustomer = async () => {
        if (!customerPhone) return;
        const res = await db.customers.where('phone_number').equals(customerPhone).first();
        if (res) setSelectedCustomer(res);
        else alert('Customer not found locally.');
    };

    // Phase 5 Logic: Voucher Application
    const applyVoucher = async () => {
        if (!voucherCode) return;
        const v = await db.vouchers.where('code').equals(voucherCode.toUpperCase()).first();

        if (!v) {
            alert('Voucher not found.');
            return;
        }

        if (cartTotal < v.min_order_value) {
            alert(`Min order for this voucher is $${v.min_order_value}`);
            return;
        }

        let discount = 0;
        if (v.discount_type === 'percentage') {
            discount = cartTotal * (v.discount_value / 100);
        } else {
            discount = v.discount_value;
        }

        setAppliedVoucher(v);
        setDiscountAmount(discount);
    };

    const buildOfflineOrderNumber = async (branchId: number, deviceCode: string) => {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateSegment = `${mm}${dd}`;
        const branchCode = `BR${String(branchId).padStart(3, '0')}`;
        const normalizedCounterCode = String(deviceCode || 'T01')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '')
            || 'T01';
        const todaysCount = await db.orders
            .filter((row) => row.branch_id === branchId && String(row.order_number || '').includes(`-${dateSegment}-`))
            .count();

        return `ORD-KOS-${branchCode}-${normalizedCounterCode}-${dateSegment}-${String(todaysCount + 1).padStart(4, '0')}`;
    };

    const handleCheckout = async (paymentMethod: 'cash' | 'card') => {
        if (cart.length === 0) return;
        if (!currentShift?.id) {
            alert('Open an offline shift before capturing offline orders.');
            return;
        }

        const device = await SyncService.ensureDeviceConfig();
        const orderNumber = await buildOfflineOrderNumber(device.branch_id, device.device_code || 'T01');

        const orderToSave: Omit<LocalOrder, 'id'> = {
            order_number: orderNumber,
            branch_id: device.branch_id,
            device_uid: device.device_uid,
            shift_reference: currentShift.id,
            sync_status: 'pending',
            sync_attempt_count: 0,
            created_at: new Date(),
            sub_total: cartTotal,
            tax_amount: taxAmount,
            total_amount: finalTotal,
            discount_amount: discountAmount,
            payment_method: paymentMethod,
            payments: [{
                payment_mode: paymentMethod,
                amount: finalTotal,
            }],
            customer_id: selectedCustomer?.customer_id,
            voucher_id: appliedVoucher?.voucher_id,
            items: cart.map(item => ({
                product_id: item.product.product_id,
                quantity: item.qty,
                priceAtTimeOfSale: item.product.price,
            })),
        };

        await SyncService.queueOrder(orderToSave);

        setCart([]);
        setSelectedCustomer(null);
        setCustomerPhone('');
        setAppliedVoucher(null);
        setVoucherCode('');
        setDiscountAmount(0);
        alert(`Payment captured locally as ${orderNumber}.`);
    };

    const handleOpenShift = async () => {
        const openingFloat = window.prompt('Opening float for this offline shift', '0');
        if (openingFloat === null) return;
        await SyncService.openShift(Number(openingFloat || 0));
    };

    const handleCloseShift = async () => {
        const actualCash = window.prompt('Actual cash counted for this offline shift', '0');
        if (actualCash === null) return;
        await SyncService.closeShift(Number(actualCash || 0));
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            await SyncService.syncOrdersUp();
        } finally {
            setIsSyncing(false);
        }
    };

    const formatNum = (n: number) => n.toFixed(2);

    // Extract Categories
    const categories = ['All Items', ...Array.from(new Set(products.map(p => p.category || 'Uncategorized')))];

    const filteredProducts = activeCategory === 'All Items'
        ? products
        : products.filter(p => (p.category || 'Uncategorized') === activeCategory);

    return (
        <div className="layout">
            {/* 1. Navbar */}
            <nav className="navbar">
                <div className="nav-left">
                    <div className="brand" style={{ cursor: 'pointer' }}><span>🍳</span> KitchenOS <span style={{ fontSize: '10px', opacity: 0.8 }}>(Offline Mode)</span></div>
                    <div className="nav-breadcrumb">Main Branch / POS</div>

                    <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            padding: '4px 8px', borderRadius: '6px',
                            background: isOnline ? '#f0fdf4' : '#fef2f2',
                            color: isOnline ? '#15803d' : '#b91c1c',
                            fontSize: '10px', fontWeight: 700,
                            border: isOnline ? '1px solid #bbf7d0' : '1px solid #fca5a5'
                        }}>
                            {isOnline ? '🟢 Online' : '🔴 Offline'}
                        </span>
                        {pendingOrders > 0 && (
                            <span style={{
                                padding: '4px 8px', borderRadius: '6px',
                                background: '#fff7ed', color: '#c2410c',
                                fontSize: '10px', fontWeight: 700, border: '1px solid #fed7aa'
                            }}>
                                🕒 {pendingOrders} Sync Pending
                            </span>
                        )}
                        <span style={{
                            padding: '4px 8px', borderRadius: '6px',
                            background: currentShift ? '#eff6ff' : '#fef2f2',
                            color: currentShift ? '#1d4ed8' : '#b91c1c',
                            fontSize: '10px', fontWeight: 700,
                            border: currentShift ? '1px solid #bfdbfe' : '1px solid #fecaca'
                        }}>
                            {currentShift ? 'Shift Open' : 'No Shift'}
                        </span>
                        <span style={{
                            padding: '4px 8px', borderRadius: '6px',
                            background: failedSyncs > 0 ? '#fef2f2' : '#ecfdf5',
                            color: failedSyncs > 0 ? '#b91c1c' : '#047857',
                            fontSize: '10px', fontWeight: 700,
                            border: failedSyncs > 0 ? '1px solid #fecaca' : '1px solid #a7f3d0'
                        }}>
                            {failedSyncs > 0 ? `${failedSyncs} Retry Needed` : 'Reconciliation Clear'}
                        </span>
                    </div>
                </div>
                <div className="nav-right">
                    <button onClick={() => void handleSyncNow()} style={{ marginRight: '8px' }} disabled={isSyncing}>
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button onClick={() => void (currentShift ? handleCloseShift() : handleOpenShift())} style={{ marginRight: '8px' }}>
                        {currentShift ? 'Close Shift' : 'Open Shift'}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '15px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Offline POS</div>
                    </div>
                    <div className="nav-time">
                        <div>22 Feb 2026</div>
                    </div>
                </div>
            </nav>

            {/* 2. Sub-Nav (Order Types) */}
            <div className="sub-nav">
                <div className="order-types">
                    <button className="btn-pill btn-blue">📡 In Progress</button>
                    <button className="btn-pill btn-purple">🛍️ Take-away</button>
                    <button className="btn-pill btn-blue">🛵 Delivery</button>
                </div>
                <div className="order-types">
                    <select
                        className="card-style-select"
                        value={cardStyle + (showPictures ? '' : '_nopix')}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('_nopix')) {
                                setCardStyle(val.replace('_nopix', '') as any);
                                setShowPictures(false);
                            } else {
                                setCardStyle(val as any);
                                setShowPictures(true);
                            }
                        }}
                    >
                        <option value="list">☰ List Style</option>
                        <option value="small">▣ Small Card</option>
                        <option value="medium">▣ Medium Card</option>
                        <option value="large">▣ Large Card</option>
                        <option value="small_nopix">S (No Picture)</option>
                        <option value="medium_nopix">M (No Picture)</option>
                        <option value="large_nopix">L (No Picture)</option>
                    </select>
                </div>
            </div>

            {/* 4. Main Workspace */}
            <div className="workspace">
                {/* Col 1: Sidebar */}
                <aside className="sidebar">
                    <div className="search-box">
                        <input type="text" className="search-input" placeholder="🔍 Search items..." />
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 16px' }}></div>

                    <div className="cat-header">
                        <span>☷</span> Food Category
                    </div>
                    <div className="categories-list">
                        {categories.map(cat => (
                            <div
                                key={cat}
                                className={`cat-item ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {activeCategory === cat ? '🍴 ' : ''}{cat}
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Col 2: Product Grid */}
                <main className="product-area">
                    {products.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <h3>No products synced locally.</h3>
                            <p>Please connect to the internet and sync master data.</p>
                        </div>
                    ) : (
                        <div className={`grid grid-${cardStyle}`}>
                            {filteredProducts.map(product => {
                                const cartItem = cart.find(i => i.product.product_id === product.product_id);
                                const qty = cartItem ? cartItem.qty : 0;
                                return (
                                    <div
                                        key={product.id}
                                        className={`prod-card card-${cardStyle} ${!showPictures ? 'no-pic' : ''}`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => addToCart(product, 1)}
                                    >
                                        {showPictures && (
                                            <div className="prod-img-box">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${product.name}&background=0ea5e9&color=fff&size=200`}
                                                    className="prod-img"
                                                    alt={product.name}
                                                />
                                            </div>
                                        )}
                                        <div className="prod-info">
                                            <div className="prod-title" style={{ fontSize: !showPictures ? '14px' : 'inherit' }}>{product.name}</div>
                                            <div className="prod-footer" style={{ marginTop: 'auto' }}>
                                                <div className="prod-price">${formatNum(product.price)}</div>
                                                <div className="qty-controls" onClick={(e) => e.stopPropagation()}>
                                                    <button className="qty-btn" style={{ color: 'var(--danger)' }} onClick={(e) => addToCart(product, -1, e)}>-</button>
                                                    <div className="qty-val">{qty}</div>
                                                    <button className="qty-btn" style={{ color: 'var(--success)' }} onClick={(e) => addToCart(product, 1, e)}>+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>

                {/* Col 3: Cart Panel */}
                <aside className="cart-panel" style={{ width: `380px` }}>
                    <div className="cart-top-forms" style={{ gridTemplateColumns: '1fr' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input
                                type="text"
                                className="form-select"
                                style={{ textAlign: 'left' }}
                                placeholder="Customer Phone..."
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                            <button onClick={searchCustomer} style={{ padding: '0 8px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}><Search size={14} /></button>
                        </div>
                        {selectedCustomer && (
                            <div style={{ fontSize: '11px', background: '#f0fdf4', color: '#15803d', padding: '4px', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <User size={12} /> {selectedCustomer.name} ({selectedCustomer.loyalty_points} Pts)
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="form-select"
                                style={{ textAlign: 'left' }}
                                placeholder="Voucher Code..."
                                value={voucherCode}
                                onChange={(e) => setVoucherCode(e.target.value)}
                            />
                            <button onClick={applyVoucher} style={{ padding: '0 8px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}><Ticket size={14} /></button>
                        </div>
                        {appliedVoucher && (
                            <div style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '4px', borderRadius: '4px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} /> {appliedVoucher.code} (-${formatNum(discountAmount)})
                            </div>
                        )}
                    </div>

                    <div className="cart-table-wrapper" style={{ flex: 1 }}>
                        <div className="cart-scroll">
                            <table className="cart-table">
                                <thead>
                                    <tr>
                                        <th style={{ fontSize: '13px', width: '45%' }}>Item</th>
                                        <th className="text-right" style={{ fontSize: '13px', width: '20%' }}>Price</th>
                                        <th className="text-center" style={{ fontSize: '13px', width: '15%' }}>Qty</th>
                                        <th className="text-right" style={{ fontSize: '13px', width: '20%' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.length > 0 ? cart.map(item => (
                                        <tr className="cart-row" key={item.product.id}>
                                            <td style={{ fontWeight: 500 }}>
                                                {item.product.name}
                                            </td>
                                            <td className="text-right">
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>${formatNum(item.product.price)}</span>
                                            </td>
                                            <td className="text-center">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <button className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); addToCart(item.product, -1, e); }}>-</button>
                                                    <span style={{ fontWeight: 600 }}>{item.qty}</span>
                                                    <button className="cart-qty-btn" style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', color: 'var(--success)' }} onClick={(e) => { e.stopPropagation(); addToCart(item.product, 1, e); }}>+</button>
                                                </div>
                                            </td>
                                            <td className="text-right" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                                ${formatNum(item.product.price * item.qty)}
                                                <button className="cart-del-btn" title="Remove Item" style={{ marginLeft: '8px' }} onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.product_id); }}>🗑️</button>
                                            </td>
                                        </tr>
                                    )) : (
                                        [1, 2, 3, 4, 5].map(i => (
                                            <tr key={i} className="cart-row placeholder-row">
                                                <td colSpan={4} style={{ height: '42px', borderBottom: '1px solid #f1f5f9' }}></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="order-summary" style={{ flexShrink: 0, paddingBottom: '16px' }}>
                            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', marginTop: '16px' }}>
                                <span style={{ fontWeight: 600 }}>Subtotal:</span>
                                <span style={{ fontWeight: 600 }}>${formatNum(cartTotal)}</span>
                            </div>

                            {discountAmount > 0 && (
                                <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Discount:</span>
                                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>-${formatNum(discountAmount)}</span>
                                </div>
                            )}

                            <div className="summary-row">
                                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Tax (8%)</span>
                                <span style={{ flex: '0 0 60px', textAlign: 'right' }}>${formatNum(taxAmount)}</span>
                            </div>

                            <div className="summary-row net-payable" style={{ marginTop: '8px', padding: '10px 0', borderTop: '2px solid var(--nav-bg)' }}>
                                <span style={{ fontSize: '18px', color: 'var(--nav-bg)', fontWeight: '800' }}>TOTAL (LOCAL)</span>
                                <span style={{ fontSize: '20px', color: 'var(--primary)', fontWeight: '900' }}>${formatNum(finalTotal)}</span>
                            </div>
                        </div>
                        <div className="action-buttons">
                            <button className="action-btn btn-pay" onClick={() => handleCheckout('cash')} disabled={cart.length === 0}>💵 PAY CASH</button>
                            <button className="action-btn btn-kitchen" onClick={() => handleCheckout('card')} disabled={cart.length === 0} style={{ background: 'var(--nav-bg)' }}>💳 PAY CARD</button>
                            <button className="action-btn btn-clear" onClick={() => setCart([])}>🗑 CLEAR CART</button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
