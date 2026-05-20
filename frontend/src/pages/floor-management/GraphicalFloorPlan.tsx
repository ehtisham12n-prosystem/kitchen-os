import { useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import {
    Users, X, ShoppingBag, Clock, User, Link, Unlink, Check,
    Power, PowerOff, UserCheck, QrCode, Download, RefreshCw
} from 'lucide-react';
import styles from './GraphicalFloorPlan.module.css';

interface OrderItem {
    name: string;
    qty: number;
    price: number;
}

interface TableOrder {
    orderNo: string;
    server: string;
    timeOpened: string;
    items: OrderItem[];
}

interface TableModel {
    id: number;
    no: string;
    capacity: number;
    status: 'assigned' | 'unassigned' | 'not-available';
    shape: 'round' | 'square';
    order?: TableOrder;
    groupId?: string; // For merged tables
}

export function GraphicalFloorPlan() {
    const [selectedFloor, setSelectedFloor] = useState('Main Hall');
    const [selectedTable, setSelectedTable] = useState<TableModel | null>(null);
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [mergeSelection, setMergeSelection] = useState<number[]>([]);
    const [activeStatusMenu, setActiveStatusMenu] = useState<number | null>(null);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrTable, setQrTable] = useState<TableModel | null>(null);

    const [tables, setTables] = useState<TableModel[]>([
        { id: 1, no: 'T-01', capacity: 4, status: 'unassigned', shape: 'round' },
        {
            id: 2, no: 'T-02', capacity: 4, status: 'assigned', shape: 'square',
            order: {
                orderNo: 'ORD-7721',
                server: 'Imran K.',
                timeOpened: '12:45 PM',
                items: [
                    { name: 'Mutton Karahi (Half)', qty: 1, price: 1250 },
                    { name: 'Garlic Naan', qty: 3, price: 180 },
                    { name: 'Fresh Lime Soda', qty: 2, price: 340 }
                ]
            }
        },
        { id: 3, no: 'T-03', capacity: 2, status: 'not-available', shape: 'round' },
        {
            id: 4, no: 'T-04', capacity: 4, status: 'assigned', shape: 'round',
            order: {
                orderNo: 'ORD-7725',
                server: 'Sajid A.',
                timeOpened: '01:10 PM',
                items: [
                    { name: 'Chicken Biryani', qty: 2, price: 950 },
                    { name: 'Raita', qty: 1, price: 80 },
                    { name: 'Coke 1.5L', qty: 1, price: 220 }
                ]
            }
        },
        { id: 5, no: 'T-05', capacity: 4, status: 'unassigned', shape: 'square' },
        { id: 6, no: 'T-06', capacity: 6, status: 'unassigned', shape: 'round' },
    ]);

    const handleTableClick = (table: TableModel) => {
        if (isMergeMode) {
            setMergeSelection(prev =>
                prev.includes(table.id)
                    ? prev.filter(id => id !== table.id)
                    : [...prev, table.id]
            );
            return;
        }

        if (table.status === 'assigned') {
            setSelectedTable(table);
        } else {
            setActiveStatusMenu(activeStatusMenu === table.id ? null : table.id);
        }
    };

    const handleStatusUpdate = (tableId: number, newStatus: TableModel['status']) => {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
        setActiveStatusMenu(null);
    };

    const handleMerge = () => {
        if (mergeSelection.length < 2) return;
        const groupId = `group-${Date.now()}`;
        setTables(prev => prev.map(t =>
            mergeSelection.includes(t.id) ? { ...t, groupId } : t
        ));
        setIsMergeMode(false);
        setMergeSelection([]);
    };

    const handleUnmerge = (groupId: string) => {
        setTables(prev => prev.map(t =>
            t.groupId === groupId ? { ...t, groupId: undefined } : t
        ));
    };

    const calculateTotal = (items: OrderItem[]) => {
        return items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleBox}>
                    <h1>Graphical Floor Plan</h1>
                    <p>Visual monitor of restaurant occupancy and live orders.</p>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {isMergeMode ? (
                        <div className={styles.mergeControls}>
                            <span className={styles.mergeText}>{mergeSelection.length} Tables Selected</span>
                            <KitchenButton size="sm" variant="secondary" onClick={() => { setIsMergeMode(false); setMergeSelection([]); }}>Cancel</KitchenButton>
                            <KitchenButton size="sm" onClick={handleMerge} disabled={mergeSelection.length < 2}>
                                <Check size={16} /> Confirm Join
                            </KitchenButton>
                        </div>
                    ) : (
                        <KitchenButton variant="outline" onClick={() => setIsMergeMode(true)}>
                            <Link size={18} style={{ marginRight: '8px' }} />
                            Join Tables
                        </KitchenButton>
                    )}
                    <div style={{ width: '200px' }}>
                        <KitchenSelect
                            value={selectedFloor}
                            onChange={(e) => setSelectedFloor(e.target.value)}
                            options={[{ value: 'Main Hall', label: 'Main Hall' }, { value: 'Roof Top', label: 'Roof Top' }]}
                        />
                    </div>
                </div>
            </header>

            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <div className={`${styles.statusColor} ${styles.unassigned}`} />
                    Unassigned
                </div>
                <div className={styles.legendItem}>
                    <div className={`${styles.statusColor} ${styles.assigned}`} />
                    Assigned
                </div>
                <div className={styles.legendItem}>
                    <div className={`${styles.statusColor} ${styles['not-available']}`} />
                    Blocked
                </div>
            </div>

            <div className={`${styles.mapArea} ${isMergeMode ? styles.mergeActive : ''}`}>
                <div className={styles.floorGrid}>
                    {tables.map(table => (
                        <div
                            key={table.id}
                            className={`
                                ${styles.tableWrapper} 
                                ${styles['status_' + table.status]} 
                                ${table.shape === 'square' ? styles.squareTable : ''}
                                ${mergeSelection.includes(table.id) ? styles.selected : ''}
                            `}
                            onClick={() => handleTableClick(table)}
                        >
                            {table.groupId && (
                                <div className={styles.joinedLabel}>JOINED</div>
                            )}

                            {/* Chairs */}
                            <div className={`${styles.chair} ${styles.chairTop}`} />
                            <div className={`${styles.chair} ${styles.chairBottom}`} />
                            {table.capacity >= 4 && (
                                <>
                                    <div className={`${styles.chair} ${styles.chairLeft}`} />
                                    <div className={`${styles.chair} ${styles.chairRight}`} />
                                </>
                            )}

                            {/* Table Surface */}
                            <div className={styles.tableSurface}>
                                <div className={styles.tableLabel}>{table.no}</div>
                                <div className={styles.seatCount}>
                                    <Users size={10} />
                                    {table.capacity}
                                </div>
                            </div>

                            {/* Status Context Menu */}
                            {activeStatusMenu === table.id && (
                                <div className={styles.contextMenu} onClick={e => e.stopPropagation()}>
                                    <button className={styles.menuItem} onClick={() => handleStatusUpdate(table.id, 'unassigned')}>
                                        <UserCheck size={14} color="var(--success)" /> Available
                                    </button>
                                    <button className={styles.menuItem} onClick={() => handleStatusUpdate(table.id, 'assigned')}>
                                        <Power size={14} color="var(--accent-primary)" /> Occupy
                                    </button>
                                    <button className={styles.menuItem} onClick={() => handleStatusUpdate(table.id, 'not-available')}>
                                        <PowerOff size={14} color="var(--text-tertiary)" /> Block
                                    </button>
                                    <button className={styles.menuItem} onClick={() => { setQrTable(table); setIsQrModalOpen(true); setActiveStatusMenu(null); }} style={{ borderTop: '1px solid var(--glass-border)', marginTop: '4px', paddingTop: '8px' }}>
                                        <QrCode size={14} color="var(--accent-tertiary)" /> View Table QR
                                    </button>
                                    {table.groupId && (
                                        <button className={styles.menuItem} onClick={() => handleUnmerge(table.groupId!)}>
                                            <Unlink size={14} color="var(--accent-tertiary)" /> Unjoin Group
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Order Detail Modal */}
            {selectedTable && selectedTable.order && (
                <div className={styles.modalOverlay} onClick={() => setSelectedTable(null)}>
                    <KitchenCard className={`${styles.modal} ${styles.orderDetailModal}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.orderInfo}>
                                <h2>Table {selectedTable.no} Details</h2>
                                <span className={styles.orderNo}>{selectedTable.order.orderNo}</span>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedTable(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '12px', background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <User size={14} color="var(--accent-primary)" />
                                    <span>Server: <strong>{selectedTable.order.server}</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <Clock size={14} color="var(--accent-tertiary)" />
                                    <span>Time: <strong>{selectedTable.order.timeOpened}</strong></span>
                                </div>
                            </div>

                            <div className={styles.itemList}>
                                {selectedTable.order.items.map((item, idx) => (
                                    <div key={idx} className={styles.orderItem}>
                                        <div>
                                            <div className={styles.itemName}>{item.name}</div>
                                            <div className={styles.itemQty}>{item.qty} x Rs. {item.price}</div>
                                        </div>
                                        <div style={{ fontWeight: 600 }}>Rs. {item.qty * item.price}</div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles.orderTotal}>
                                <div className={styles.totalLabel}>Grand Total</div>
                                <div className={styles.totalPrice}>Rs. {calculateTotal(selectedTable.order.items)}</div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setSelectedTable(null)}>Close</KitchenButton>
                            <KitchenButton>
                                <ShoppingBag size={18} style={{ marginRight: '8px' }} />
                                View Full Order
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}

            {/* QR Display Modal (Section 3) */}
            {isQrModalOpen && qrTable && (
                <div className={styles.modalOverlay} onClick={() => setIsQrModalOpen(false)}>
                    <KitchenCard className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Table QR Code</h2>
                            <button className={styles.actionBtn} onClick={() => setIsQrModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <div className={styles.qrBox}>
                                <QrCode size={200} color="#000" />
                            </div>
                            <h3>Table: {qrTable.no}</h3>
                            <p>Scan this QR code to view menu and place order</p>
                        </div>
                        <div className={styles.modalFooter} style={{ justifyContent: 'center', gap: '16px' }}>
                            <KitchenButton variant="outline">
                                <RefreshCw size={18} style={{ marginRight: '8px' }} />
                                Regenerate QR Code
                            </KitchenButton>
                            <KitchenButton>
                                <Download size={18} style={{ marginRight: '8px' }} />
                                Download QR Code
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}
        </div>
    );
}

