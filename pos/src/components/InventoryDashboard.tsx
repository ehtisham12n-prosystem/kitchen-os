import React, { useEffect, useState } from 'react';

const InventoryDashboard: React.FC = () => {
    const [materials, setMaterials] = useState<any[]>([]);

    const fetchMaterials = async () => {
        if ((window as any).api && (window as any).api.getRawMaterials) {
            const data = await (window as any).api.getRawMaterials();
            setMaterials(data);
        }
    };

    useEffect(() => {
        fetchMaterials();
        // Simple mock refresh interval or we could rely on a parent component trigger
        const interval = setInterval(fetchMaterials, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '20px', background: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--nav-bg)' }}>Stock & Inventory Management</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {materials.map(m => {
                    const isLow = m.current_stock <= m.min_par_level;
                    return (
                        <div key={m.id} style={{
                            background: 'white',
                            padding: '16px',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            borderLeft: `4px solid ${isLow ? 'var(--danger)' : 'var(--success)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', color: '#334155' }}>{m.name}</h3>
                                {isLow && <span style={{ background: '#fef2f2', color: 'var(--danger)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Low Stock</span>}
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>
                                {m.current_stock.toFixed(2)} <span style={{ fontSize: '14px', color: '#94a3b8' }}>{m.unit}</span>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                                Par Level: {m.min_par_level} {m.unit} | Cost Code: PKR {m.cost_per_unit.toFixed(2)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InventoryDashboard;
