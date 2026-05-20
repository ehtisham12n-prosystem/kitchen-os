import { useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { QrCode, Download, RefreshCw, Search, Grid, List as ListIcon } from 'lucide-react';
import styles from './FloorsTables.module.css';

interface TableQR {
    id: number;
    no: string;
    floor: string;
    url: string;
}

export function QRManagement() {
    const [search, setSearch] = useState('');
    const [filterFloor, setFilterFloor] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const tables: TableQR[] = [
        { id: 1, no: 'T-01', floor: 'Main Hall', url: 'https://menu.kitchenos.com/t1' },
        { id: 2, no: 'T-02', floor: 'Main Hall', url: 'https://menu.kitchenos.com/t2' },
        { id: 3, no: 'T-03', floor: 'Main Hall', url: 'https://menu.kitchenos.com/t3' },
        { id: 4, no: 'R-01', floor: 'Roof Top', url: 'https://menu.kitchenos.com/r1' },
        { id: 5, no: 'R-02', floor: 'Roof Top', url: 'https://menu.kitchenos.com/r2' },
        { id: 6, no: 'G-01', floor: 'Garden', url: 'https://menu.kitchenos.com/g1' },
    ];

    const filtered = tables.filter(t =>
        (t.no.toLowerCase().includes(search.toLowerCase())) &&
        (filterFloor === 'All' || t.floor === filterFloor)
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Table QR Codes</h1>
                    <p>Generate and download QR codes for customer self-ordering.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <KitchenButton variant="outline">
                        <Download size={18} style={{ marginRight: '8px' }} />
                        Bulk Download (ZIP)
                    </KitchenButton>
                    <KitchenButton>
                        <RefreshCw size={18} style={{ marginRight: '8px' }} />
                        Regenerate All
                    </KitchenButton>
                </div>
            </header>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <KitchenInput
                            placeholder="Search by Table No."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div className={styles.filters}>
                        <KitchenSelect
                            label="Floor"
                            value={filterFloor}
                            onChange={(e) => setFilterFloor(e.target.value)}
                            options={[
                                { value: 'All', label: 'All Floors' },
                                { value: 'Main Hall', label: 'Main Hall' },
                                { value: 'Roof Top', label: 'Roof Top' },
                                { value: 'Garden', label: 'Garden' },
                            ]}
                        />
                        <div style={{ display: 'flex', background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', padding: '2px', marginLeft: '8px' }}>
                            <button
                                onClick={() => setViewMode('grid')}
                                style={{ padding: '6px', borderRadius: 'var(--radius-sm)', background: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{ padding: '6px', borderRadius: 'var(--radius-sm)', background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                <ListIcon size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 'var(--spacing-lg)' }}>
                    {viewMode === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-xl)' }}>
                            {filtered.map(table => (
                                <KitchenCard key={table.id} style={{ textAlign: 'center', padding: 'var(--spacing-lg)', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ background: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'inline-block' }}>
                                        <QrCode size={120} color="#000" />
                                    </div>
                                    <h3 style={{ margin: '0 0 4px 0' }}>Table {table.no}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>{table.floor}</p>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <KitchenButton size="sm" variant="outline" title="Print"><RefreshCw size={14} /></KitchenButton>
                                        <KitchenButton size="sm" title="Download"><Download size={14} /></KitchenButton>
                                    </div>
                                </KitchenCard>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {filtered.map(table => (
                                <div key={table.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ background: 'white', padding: '4px', borderRadius: '4px' }}>
                                            <QrCode size={40} color="#000" />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>Table {table.no}</h4>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{table.floor} • {table.url}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <KitchenButton size="sm" variant="outline">
                                            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Regenerate
                                        </KitchenButton>
                                        <KitchenButton size="sm">
                                            <Download size={14} style={{ marginRight: '6px' }} /> Download
                                        </KitchenButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </KitchenCard>
        </div>
    );
}

