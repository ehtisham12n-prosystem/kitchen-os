import React from 'react';

interface KOTItem {
    name: string;
    qty: number;
    instructions?: string;
}

interface KOT {
    id: string; // Unique UUID
    kot_number: string; // Sequential e.g. 001
    order_id: string; // Link to POS Order
    table?: string;
    type: string;
    items: KOTItem[];
    timestamp: string;
    status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
}

interface KDSProps {
    orders: KOT[];
    onUpdateStatus: (kotId: string, newStatus: KOT['status']) => void;
    onBack: () => void;
}

const KDS: React.FC<KDSProps> = ({ orders, onUpdateStatus, onBack }) => {
    const getStatusColor = (status: KOT['status']) => {
        switch (status) {
            case 'Pending': return '#ef4444';
            case 'Preparing': return '#f59e0b';
            case 'Ready': return '#10b981';
            case 'Served': return '#64748b';
            default: return '#000';
        }
    };

    return (
        <div className="kds-container" style={{
            height: '100vh',
            background: '#1e293b',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                color: 'white'
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🍳 KITCHEN DISPLAY SYSTEM</h1>
                <button
                    onClick={onBack}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '8px 16px',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}
                >
                    ← Back to POS
                </button>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '20px',
                overflowY: 'auto',
                flex: 1
            }}>
                {orders.filter(o => o.status !== 'Served').map(order => (
                    <div key={order.id} style={{
                        background: 'white',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{
                            background: getStatusColor(order.status),
                            padding: '12px',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>KOT #{order.kot_number}</span>
                                <div style={{ fontSize: '12px', opacity: 0.9 }}>{order.table ? `Table: ${order.table}` : order.type}</div>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>
                                {Math.round((new Date().getTime() - new Date(order.timestamp).getTime()) / 60000)}m ago
                            </div>
                        </div>

                        <div style={{ padding: '16px', flex: 1 }}>
                            {order.items.map((item, idx) => (
                                <div key={idx} style={{
                                    marginBottom: '10px',
                                    borderBottom: '1px solid #f1f5f9',
                                    paddingBottom: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '16px', fontWeight: '700' }}>{item.qty}x {item.name}</span>
                                    </div>
                                    {item.instructions && (
                                        <div style={{
                                            fontSize: '13px',
                                            color: '#ef4444',
                                            fontStyle: 'italic',
                                            marginTop: '4px',
                                            fontWeight: '600'
                                        }}>
                                            ⚠️ {item.instructions}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{
                            padding: '12px',
                            background: '#f8fafc',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px'
                        }}>
                            {order.status === 'Pending' && (
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'Preparing')}
                                    style={{ background: '#f59e0b', color: 'white', padding: '12px', fontWeight: '700', gridColumn: 'span 2' }}
                                >
                                    START PREPARING
                                </button>
                            )}
                            {order.status === 'Preparing' && (
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'Ready')}
                                    style={{ background: '#10b981', color: 'white', padding: '12px', fontWeight: '700', gridColumn: 'span 2' }}
                                >
                                    READY FOR PICKUP
                                </button>
                            )}
                            {order.status === 'Ready' && (
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'Served')}
                                    style={{ background: '#64748b', color: 'white', padding: '12px', fontWeight: '700', gridColumn: 'span 2' }}
                                >
                                    SERVED / DONE
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {orders.filter(o => o.status !== 'Served').length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', gridColumn: '1/-1', marginTop: '100px' }}>
                        <div style={{ fontSize: '48px' }}>🍳</div>
                        <div style={{ fontSize: '20px' }}>No active kitchen orders.</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KDS;
