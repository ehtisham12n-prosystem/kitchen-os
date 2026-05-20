import { useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Search, UserPlus, UserMinus, RefreshCw } from 'lucide-react';
import styles from './FloorsTables.module.css';

interface Assignment {
    id: number;
    table_no: string;
    table_name: string;
    floor: string;
    capacity: number;
    assigned_waiter: string;
    shift: string;
    status: string;
}

export function TableAssignment() {
    const [search, setSearch] = useState('');
    const [filterFloor, setFilterFloor] = useState('All');
    const [filterShift, setFilterShift] = useState('All');
    const [showUnassigned, setShowUnassigned] = useState(false);

    const [assignments] = useState<Assignment[]>([
        { id: 1, table_no: 'T-01', table_name: 'Window', floor: 'Main Hall', capacity: 4, assigned_waiter: 'Imran Khan', shift: 'Morning Shift', status: 'Available' },
        { id: 2, table_no: 'T-02', table_name: 'Corner', floor: 'Main Hall', capacity: 6, assigned_waiter: 'Sajid Ali', shift: 'Morning Shift', status: 'Occupied' },
        { id: 3, table_no: 'T-03', table_name: 'Booth', floor: 'Main Hall', capacity: 4, assigned_waiter: 'Unassigned', shift: 'N/A', status: 'Available' },
        { id: 4, table_no: 'R-01', table_name: 'Terrace', floor: 'Roof Top', capacity: 2, assigned_waiter: 'Ayesha Bibi', shift: 'Evening Shift', status: 'Available' },
    ]);

    const filtered = assignments.filter(a => {
        const matchesSearch = a.table_no.toLowerCase().includes(search.toLowerCase()) ||
            a.table_name.toLowerCase().includes(search.toLowerCase());
        const matchesFloor = filterFloor === 'All' || a.floor === filterFloor;
        const matchesUnassigned = !showUnassigned || a.assigned_waiter === 'Unassigned';
        return matchesSearch && matchesFloor && matchesUnassigned;
    });

    const columns: ColumnDef<Assignment>[] = [
        { key: 'table_no', header: 'Table No.', cell: (row) => <strong>{row.table_no}</strong> },
        { key: 'table_name', header: 'Table Name', cell: (row) => row.table_name },
        { key: 'floor', header: 'Floor', cell: (row) => row.floor },
        { key: 'capacity', header: 'Seating Capacity', cell: (row) => `${row.capacity} Seats` },
        {
            key: 'assigned_waiter',
            header: 'Assigned Waiter',
            cell: (row) => (
                <span style={{ color: row.assigned_waiter === 'Unassigned' ? 'var(--text-tertiary)' : 'var(--accent-primary)', fontWeight: 500 }}>
                    {row.assigned_waiter}
                </span>
            )
        },
        { key: 'shift', header: 'Shift', cell: (row) => row.shift },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span className={`${styles.statusBadge} ${styles['status-' + row.status.toLowerCase()]}`}>
                    {row.status}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actions}>
                    {row.assigned_waiter === 'Unassigned' ? (
                        <KitchenButton size="sm" variant="outline">
                            <UserPlus size={14} style={{ marginRight: '6px' }} />
                            Assign
                        </KitchenButton>
                    ) : (
                        <>
                            <button className={styles.actionBtn} title="Reassign"><RefreshCw size={14} /></button>
                            <button className={styles.actionBtn} title="Unassign" style={{ color: 'var(--danger)' }}><UserMinus size={14} /></button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Table Assignment</h1>
            </header>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
                    <div className={styles.searchBox}>
                        <KitchenInput
                            placeholder="Search by Table No. or Name"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div className={styles.filters}>
                        <KitchenSelect
                            label="Floor / Area"
                            value={filterFloor}
                            onChange={(e) => setFilterFloor(e.target.value)}
                            options={[
                                { value: 'All', label: 'All Floors' },
                                { value: 'Main Hall', label: 'Main Hall' },
                                { value: 'Roof Top', label: 'Roof Top' },
                            ]}
                        />
                        <KitchenSelect
                            label="Shift"
                            value={filterShift}
                            onChange={(e) => setFilterShift(e.target.value)}
                            options={[
                                { value: 'All', label: 'All Shifts' },
                                { value: 'Morning Shift', label: 'Morning Shift' },
                                { value: 'Evening Shift', label: 'Evening Shift' },
                            ]}
                        />
                        <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginLeft: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={showUnassigned}
                                onChange={(e) => setShowUnassigned(e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                            />
                            Show Unassigned Tables
                        </label>
                    </div>
                </div>

                <KitchenTable columns={columns} data={filtered} />
            </KitchenCard>
        </div>
    );
}

