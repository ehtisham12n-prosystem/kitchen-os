import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Loader2, Users, Info, X, MapPin, Hash } from 'lucide-react';
import {
    type LayoutFloorRecord,
    type LayoutTableRecord,
    type UiTableStatus,
    loadActiveBranchLayout,
} from './layoutData';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './FloorsTables.module.css';

type StatusFilter = 'All' | UiTableStatus;

const STATUS_META: Record<UiTableStatus, { color: string; badgeClass: string }> = {
    Available: { color: 'var(--success)', badgeClass: 'status-available' },
    Occupied: { color: 'var(--accent-primary)', badgeClass: 'status-occupied' },
    Reserved: { color: 'var(--warning)', badgeClass: 'status-reserved' },
    Blocked: { color: 'var(--text-tertiary)', badgeClass: 'status-blocked' },
};

const STATUS_FILTERS: StatusFilter[] = ['All', 'Available', 'Occupied', 'Reserved', 'Blocked'];

export function TableLayout() {
    const [selectedFloor, setSelectedFloor] = useState('All');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [infoTable, setInfoTable] = useState<LayoutTableRecord | null>(null);
    const [floors, setFloors] = useState<LayoutFloorRecord[]>([]);
    const [branchName, setBranchName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLayout = async () => {
            setIsLoading(true);
            try {
                const layout = await loadActiveBranchLayout();
                setFloors(layout.floors);
                setBranchName(layout.branchName);

                if (layout.floors.length > 0) {
                    setSelectedFloor((current) => {
                        if (current === 'All') {
                            return String(layout.floors[0].id);
                        }
                        const exists = layout.floors.some((floor) => String(floor.id) === current);
                        return exists ? current : String(layout.floors[0].id);
                    });
                } else {
                    setSelectedFloor('All');
                }
            } catch (error: any) {
                console.error('Failed to load table layout:', error);
                toast.error('Layout Unavailable', error.message || 'Could not load branch table layout.');
            } finally {
                setIsLoading(false);
            }
        };

        void fetchLayout();
    }, []);

    const allTables = useMemo(
        () => floors.flatMap((floor) => floor.tables.map((table) => ({ ...table, floor_name: floor.name }))),
        [floors],
    );

    const floorTables = useMemo(() => {
        if (selectedFloor === 'All') {
            return allTables;
        }
        return allTables.filter((table) => String(table.floor_id) === selectedFloor);
    }, [allTables, selectedFloor]);

    const filtered = useMemo(() => {
        if (statusFilter === 'All') {
            return floorTables;
        }
        return floorTables.filter((table) => table.current_status === statusFilter);
    }, [floorTables, statusFilter]);

    const counts = useMemo(
        () => ({
            All: floorTables.length,
            Available: floorTables.filter((table) => table.current_status === 'Available').length,
            Occupied: floorTables.filter((table) => table.current_status === 'Occupied').length,
            Reserved: floorTables.filter((table) => table.current_status === 'Reserved').length,
            Blocked: floorTables.filter((table) => table.current_status === 'Blocked').length,
        }),
        [floorTables],
    );

    const selectedFloorName =
        selectedFloor === 'All'
            ? branchName || 'All Floors'
            : floors.find((floor) => String(floor.id) === selectedFloor)?.name || 'Floor';

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Table Layout</h1>
                    <p>
                        {isLoading
                            ? 'Loading live branch layout...'
                            : `${floorTables.length} tables in ${selectedFloorName} - ${counts.Available} available, ${counts.Occupied} occupied`}
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <KitchenSelect
                        value={selectedFloor}
                        onChange={(e) => {
                            setSelectedFloor(e.target.value);
                            setStatusFilter('All');
                        }}
                        options={[
                            { value: 'All', label: 'All Floors' },
                            ...floors.map((floor) => ({ value: String(floor.id), label: floor.name })),
                        ]}
                    />
                </div>
            </header>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.filterBar}>
                    <div className={styles.legend}>
                        {Object.entries(STATUS_META).map(([label, meta]) => (
                            <div key={label} className={styles.legendItem}>
                                <div className={styles.dot} style={{ background: meta.color }} />
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className={styles.statusFilterGroup}>
                        {STATUS_FILTERS.map((status) => (
                            <button
                                key={status}
                                className={`${styles.statusFilterBtn} ${statusFilter === status ? styles.statusFilterBtnActive : ''}`}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                                <span className={styles.filterCount}>{counts[status]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <div className={styles.layoutArea}>
                        {filtered.length === 0 && (
                            <div className={styles.emptyState}>No tables match the selected filter.</div>
                        )}
                        {filtered.map((table) => (
                            <div
                                key={table.id}
                                className={styles.tableCardLayout}
                                style={{ borderLeft: `3px solid ${STATUS_META[table.current_status].color}` }}
                            >
                                <div className={styles.tableCardHeader}>
                                    <div className={styles.tableLabel}>{table.table_no}</div>
                                    <div className={styles.capacity}>
                                        <Users size={11} />
                                        <span>{table.seating_capacity}</span>
                                    </div>
                                </div>

                                <div className={styles.tableStatusRow}>
                                    <span
                                        className={`${styles.statusBadge} ${styles[STATUS_META[table.current_status].badgeClass]}`}
                                    >
                                        {table.current_status}
                                    </span>
                                </div>

                                <button
                                    className={styles.infoBtn}
                                    aria-label={`Info for ${table.table_no}`}
                                    onClick={() => setInfoTable(table)}
                                >
                                    <Info size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </KitchenCard>

            {infoTable && (
                <div className={styles.modalOverlay} onClick={() => setInfoTable(null)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <div
                                    className={styles.modalTableBadge}
                                    style={{ borderColor: STATUS_META[infoTable.current_status].color }}
                                >
                                    {infoTable.table_no}
                                </div>
                                <div>
                                    <div className={styles.modalTitle}>Table Details</div>
                                    <div className={styles.modalSubtitle}>{infoTable.floor_name}</div>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setInfoTable(null)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.infoGrid}>
                                <div className={styles.infoItem}>
                                    <Hash size={13} className={styles.infoIcon} />
                                    <div>
                                        <div className={styles.infoLabel}>Table No.</div>
                                        <div className={styles.infoValue}>{infoTable.table_no}</div>
                                    </div>
                                </div>
                                <div className={styles.infoItem}>
                                    <Users size={13} className={styles.infoIcon} />
                                    <div>
                                        <div className={styles.infoLabel}>Capacity</div>
                                        <div className={styles.infoValue}>{infoTable.seating_capacity} seats</div>
                                    </div>
                                </div>
                                <div className={styles.infoItem}>
                                    <MapPin size={13} className={styles.infoIcon} />
                                    <div>
                                        <div className={styles.infoLabel}>Floor / Area</div>
                                        <div className={styles.infoValue}>{infoTable.floor_name}</div>
                                    </div>
                                </div>
                                <div className={styles.infoItem}>
                                    <div
                                        className={styles.statusDot}
                                        style={{ background: STATUS_META[infoTable.current_status].color }}
                                    />
                                    <div>
                                        <div className={styles.infoLabel}>Status</div>
                                        <span
                                            className={`${styles.statusBadge} ${styles[STATUS_META[infoTable.current_status].badgeClass]}`}
                                        >
                                            {infoTable.current_status}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.infoItem}>
                                    <Hash size={13} className={styles.infoIcon} />
                                    <div>
                                        <div className={styles.infoLabel}>Display Name</div>
                                        <div className={styles.infoValue}>{infoTable.table_name || infoTable.table_no}</div>
                                    </div>
                                </div>
                                <div className={styles.infoItem}>
                                    <Info size={13} className={styles.infoIcon} />
                                    <div>
                                        <div className={styles.infoLabel}>POS Visibility</div>
                                        <div className={styles.infoValue}>{infoTable.is_active ? 'Active' : 'Inactive'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.btnSecondary} onClick={() => setInfoTable(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
