/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useEffect } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Plus, Users, Layout, CheckCircle2, XCircle, Clock, Loader2, Store } from 'lucide-react';
import { branchApi } from '../../api/api';
import styles from './TableManagement.module.css';

export function TableManagement() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [floors, setFloors] = useState<any[]>([]);
    const [selectedFloor, setSelectedFloor] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const data = await branchApi.getBranches();
                setBranches(data);
                if (data.length > 0) setSelectedBranchId(data[0].id);
            } catch (err) {
                console.error('Failed to fetch branches:', err);
            }
        };
        fetchBranches();
    }, []);

    const fetchLayout = useCallback(async () => {
        if (!selectedBranchId) return;
        setIsLoading(true);
        try {
            const data = await branchApi.getLayout(selectedBranchId);
            setFloors(data);
            if (data.length > 0) setSelectedFloor(data[0]);
            else setSelectedFloor(null);
        } catch (err) {
            console.error('Failed to fetch layout:', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (selectedBranchId) {
            void fetchLayout();
        }
    }, [fetchLayout, selectedBranchId]);

    const handleAddFloor = async () => {
        if (!selectedBranchId) return;
        const name = prompt('Enter Floor Name:');
        if (!name) return;
        try {
            await branchApi.createFloor(selectedBranchId, { name });
            await fetchLayout();
        } catch (err) {
            console.error('Failed to create floor:', err);
        }
    };

    const handleAddTable = async () => {
        if (!selectedFloor) return;
        const number = prompt('Enter Table Number (e.g. T-10):');
        const capacity = Number(prompt('Enter Capacity:', '4'));
        if (!number) return;
        try {
            await branchApi.createTable(selectedFloor.id, { table_number: number, capacity });
            await fetchLayout();
        } catch (err) {
            console.error('Failed to create table:', err);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'vacant': return <CheckCircle2 size={16} color="#10b981" />;
            case 'occupied': return <Users size={16} color="#3b82f6" />;
            case 'cleaning': return <Clock size={16} color="#f59e0b" />;
            default: return <XCircle size={16} color="#94a3b8" />;
        }
    };

    if (isLoading && branches.length > 0) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <Loader2 size={48} className={styles.spinner} />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Table Management</h1>
                    <p>Design and monitor the physical layout of your restaurant.</p>
                </div>
                <div className={styles.actions}>
                    <div className={styles.branchPicker} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', background: '#f8fafc', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <Store size={18} color="#64748b" />
                        <KitchenSelect
                            options={branches.map(b => ({ value: b.id.toString(), label: b.branch_name }))}
                            value={selectedBranchId?.toString()}
                            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                        />
                    </div>
                    <KitchenButton variant="outline" onClick={handleAddFloor}>Manage Floors</KitchenButton>
                    <KitchenButton onClick={handleAddTable} disabled={!selectedFloor}>
                        <Plus size={18} style={{ marginRight: '8px' }} />
                        Add New Table
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.layoutGrid}>
                <aside className={styles.floorList}>
                    <KitchenCard title="Floors / Sections">
                        {floors.map(floor => (
                            <button
                                key={floor.id}
                                className={`${styles.floorBtn} ${selectedFloor?.id === floor.id ? styles.activeFloor : ''}`}
                                onClick={() => setSelectedFloor(floor)}
                            >
                                <Layout size={18} />
                                {floor.name}
                                <span className={styles.countBadge}>{floor.tables?.length || 0}</span>
                            </button>
                        ))}
                        <KitchenButton variant="ghost" className={styles.addFloorBtn} onClick={handleAddFloor}>
                            <Plus size={16} /> Add Floor
                        </KitchenButton>
                    </KitchenCard>
                </aside>

                <main className={styles.tableArea}>
                    {!selectedFloor ? (
                        <div style={{ textAlign: 'center', padding: '100px', color: '#64748b' }}>
                            <Layout size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3>No floor selected</h3>
                            <p>Select a floor or add a new one to manage tables.</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.floorHeader}>
                                <h2>{selectedFloor.name}</h2>
                                <div className={styles.floorStats}>
                                    <span>{selectedFloor.tables?.filter((t: any) => t.status === 'vacant').length || 0} Vacant</span>
                                    <span>{selectedFloor.tables?.length || 0} Total Tables</span>
                                </div>
                            </div>

                            <div className={styles.tablesContainer}>
                                {selectedFloor.tables?.map((table: any) => (
                                    <div key={table.id} className={`${styles.tableCard} ${styles[table.status]}`}>
                                        <div className={styles.tableHeader}>
                                            <span className={styles.tableNumber}>{table.table_number}</span>
                                            {getStatusIcon(table.status)}
                                        </div>
                                        <div className={styles.tableInfo}>
                                            <Users size={14} /> <span>{table.capacity} Seats</span>
                                        </div>
                                        <div className={styles.tableStatus}>
                                            {table.status.toUpperCase()}
                                        </div>
                                    </div>
                                ))}
                                {selectedFloor.tables?.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                                        <p>No tables on this floor yet. Click "Add New Table" to start.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

