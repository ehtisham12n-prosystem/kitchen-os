import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import {
    type LayoutFloorRecord,
    type LayoutTableRecord,
    type UiTableStatus,
    loadActiveBranchLayout,
    uiTableStatusToApi,
} from './layoutData';
import {
    Download,
    Edit2,
    Loader2,
    Plus,
    Power,
    PowerOff,
    QrCode,
    RefreshCw,
    Save,
    Search,
    Trash2,
    X,
    LayoutGrid,
    Users,
    CheckCircle2,
    Armchair,
} from 'lucide-react';
import styles from './FloorsTables.module.css';

interface TableFormState {
    floorId: string;
    table_no: string;
    table_name: string;
    seating_capacity: string;
    current_status: UiTableStatus;
    is_active: boolean;
}

const EMPTY_FORM: TableFormState = {
    floorId: '',
    table_no: '',
    table_name: '',
    seating_capacity: '4',
    current_status: 'Available',
    is_active: true,
};

function toTableForm(table?: LayoutTableRecord | null): TableFormState {
    if (!table) {
        return EMPTY_FORM;
    }

    return {
        floorId: String(table.floor_id),
        table_no: table.table_no || '',
        table_name: table.table_name || '',
        seating_capacity: String(table.seating_capacity || 4),
        current_status: table.current_status || 'Available',
        is_active: table.is_active !== false,
    };
}

export function TablesList() {
    const [search, setSearch] = useState('');
    const [filterFloor, setFilterFloor] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<LayoutTableRecord | null>(null);
    const [floors, setFloors] = useState<LayoutFloorRecord[]>([]);
    const [tables, setTables] = useState<LayoutTableRecord[]>([]);
    const [branchName, setBranchName] = useState('');
    const [form, setForm] = useState<TableFormState>(EMPTY_FORM);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadTables = async () => {
        setIsLoading(true);
        try {
            const layout = await loadActiveBranchLayout();
            setBranchName(layout.branchName);
            setFloors(layout.floors);
            setTables(
                layout.floors.flatMap((floor) =>
                    floor.tables.map((table) => ({
                        ...table,
                        floor_name: floor.name,
                        floor_id: floor.id,
                    })),
                ),
            );
        } catch (error: any) {
            console.error('Failed to load tables:', error);
            toast.error('Tables Unavailable', error.message || 'Could not load branch tables.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTables();
    }, []);

    const filteredTables = useMemo(() => {
        return tables.filter((table) => {
            const matchesSearch =
                table.table_no.toLowerCase().includes(search.toLowerCase()) ||
                table.table_name.toLowerCase().includes(search.toLowerCase());
            const matchesFloor =
                filterFloor === 'All' || String(table.floor_id) === filterFloor;
            const matchesStatus =
                filterStatus === 'All' || table.current_status === filterStatus;

            return matchesSearch && matchesFloor && matchesStatus;
        });
    }, [filterFloor, filterStatus, search, tables]);

    const summary = useMemo(() => {
        const activeTables = tables.filter((table) => table.is_active).length;
        const availableTables = tables.filter((table) => table.current_status === 'Available').length;
        const totalSeats = tables.reduce((sum, table) => sum + Number(table.seating_capacity || 0), 0);
        return {
            total: tables.length,
            active: activeTables,
            available: availableTables,
            seats: totalSeats,
        };
    }, [tables]);

    const openCreateModal = () => {
        setSelectedTable(null);
        setForm({
            ...EMPTY_FORM,
            floorId: String(floors[0]?.id || ''),
        });
        setIsFormOpen(true);
    };

    const openEditModal = (table: LayoutTableRecord) => {
        setSelectedTable(table);
        setForm(toTableForm(table));
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setSelectedTable(null);
        setForm(EMPTY_FORM);
    };

    const saveTable = async () => {
        if (!form.floorId) {
            toast.error('Floor Required', 'Choose a floor before saving this table.');
            return;
        }
        if (!form.table_no.trim()) {
            toast.error('Table Number Required', 'Enter a table number to continue.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                table_number: form.table_no.trim(),
                table_name: form.table_name.trim() || undefined,
                capacity: Number(form.seating_capacity || 0) || 1,
                status: uiTableStatusToApi(form.current_status),
                is_active: form.is_active,
            };

            if (selectedTable) {
                await branchApi.updateTable(selectedTable.id, {
                    ...payload,
                    floor_id: Number(form.floorId),
                });
                toast.success('Table Updated', 'Table changes were saved.');
            } else {
                await branchApi.createTable(Number(form.floorId), payload);
                toast.success('Table Created', 'New table is now part of the branch layout.');
            }

            closeForm();
            await loadTables();
        } catch (error: any) {
            console.error('Failed to save table:', error);
            toast.error('Save Failed', error.message || 'Could not save table.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (table: LayoutTableRecord) => {
        try {
            await branchApi.updateTable(table.id, { is_active: !table.is_active });
            toast.success('Table Updated', `Table ${table.is_active ? 'disabled' : 'enabled'} successfully.`);
            await loadTables();
        } catch (error: any) {
            console.error('Failed to update table activity:', error);
            toast.error('Update Failed', error.message || 'Could not change table activity.');
        }
    };

    const deleteTable = async (table: LayoutTableRecord) => {
        if (!window.confirm('Are you sure you want to delete this table?')) {
            return;
        }

        try {
            await branchApi.deleteTable(table.id);
            toast.success('Table Deleted', 'Table removed successfully.');
            await loadTables();
        } catch (error: any) {
            console.error('Failed to delete table:', error);
            toast.error('Delete Failed', error.message || 'Could not delete table.');
        }
    };

    const qrActionNotice = () => {
        toast.info(
            'QR Service Pending',
            'QR token generation is not wired in the current backend yet, so this action remains informational.',
        );
    };

    const columns: ColumnDef<LayoutTableRecord>[] = [
        {
            key: 'table_no',
            header: 'Table No.',
            cell: (row) => <span style={{ fontWeight: 600 }}>{row.table_no}</span>,
        },
        {
            key: 'table_name',
            header: 'Table Name',
            cell: (row) => row.table_name || '-',
        },
        {
            key: 'floor',
            header: 'Floor',
            cell: (row) => row.floor_name,
        },
        {
            key: 'seating_capacity',
            header: 'Seating Capacity',
            cell: (row) => `${row.seating_capacity} Persons`,
        },
        {
            key: 'current_status',
            header: 'Current Status',
            cell: (row) => (
                <span className={`${styles.statusBadge} ${styles['status-' + row.current_status.toLowerCase()]}`}>
                    {row.current_status}
                </span>
            ),
        },
        {
            key: 'qr',
            header: 'QR Code',
            cell: (row) => (
                <button
                    className={styles.actionBtn}
                    onClick={() => {
                        setSelectedTable(row);
                        setIsQrOpen(true);
                    }}
                >
                    <QrCode size={16} />
                </button>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actions}>
                    <button className={styles.actionBtn} title="Edit" onClick={() => openEditModal(row)}>
                        <Edit2 size={16} />
                    </button>
                    <button
                        className={styles.actionBtn}
                        title={row.is_active ? 'Disable' : 'Enable'}
                        onClick={() => void toggleActive(row)}
                    >
                        {row.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                    <button className={styles.actionBtn} title="Delete" onClick={() => void deleteTable(row)}>
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className={styles.container}>
            <div className="ambient-light-1"></div>
            <div className="ambient-light-2"></div>

            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Tables</h1>
                    <p>{branchName ? `Manage live seating for ${branchName}.` : 'Manage your branch table seating and floor layout.'}</p>
                </div>
                <KitchenButton onClick={openCreateModal} disabled={floors.length === 0}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Add New Table
                </KitchenButton>
            </header>

            <div className={styles.summaryGrid}>
                <KitchenCard className={styles.summaryCard}>
                    <div className={styles.summaryIcon}><LayoutGrid size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.total}</strong>
                        <span>Total Tables</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconSuccess}`}><CheckCircle2 size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.active}</strong>
                        <span>Active Tables</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconAccent}`}><Users size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.available}</strong>
                        <span>Available Now</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconMuted}`}><Armchair size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.seats}</strong>
                        <span>Total Seats</span>
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.toolbar}>
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
                            label="Floor"
                            value={filterFloor}
                            onChange={(e) => setFilterFloor(e.target.value)}
                            options={[
                                { value: 'All', label: 'All Floors' },
                                ...floors.map((floor) => ({ value: String(floor.id), label: floor.name })),
                            ]}
                        />
                        <KitchenSelect
                            label="Status"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            options={[
                                { value: 'All', label: 'All' },
                                { value: 'Available', label: 'Available' },
                                { value: 'Occupied', label: 'Occupied' },
                                { value: 'Reserved', label: 'Reserved' },
                                { value: 'Blocked', label: 'Blocked' },
                            ]}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={filteredTables} />
                )}
            </KitchenCard>

            {isFormOpen && (
                <div className={styles.modalOverlay}>
                    <KitchenCard className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <div className={styles.modalTableBadge}>{selectedTable?.table_no || 'TBL'}</div>
                                <div>
                                    <div className={styles.modalTitle}>{selectedTable ? 'Edit Table' : 'Add Table'}</div>
                                    <div className={styles.modalSubtitle}>
                                        {branchName ? `Branch: ${branchName}` : 'Configure identity, location and seating'}
                                    </div>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={closeForm}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.sectionHeader}>
                                    <h3>IDENTITY & LOCATION</h3>
                                    <div className={styles.sectionLine}></div>
                                </div>

                                <KitchenSelect
                                    label="Floor / Area"
                                    options={floors.map((floor) => ({
                                        value: String(floor.id),
                                        label: floor.name,
                                    }))}
                                    value={form.floorId}
                                    onChange={(e) => setForm((current) => ({ ...current, floorId: e.target.value }))}
                                />
                                <KitchenInput
                                    label="Table Number"
                                    placeholder="e.g. T-01"
                                    value={form.table_no}
                                    onChange={(e) => setForm((current) => ({ ...current, table_no: e.target.value }))}
                                />
                                <div className={styles.fullWidth}>
                                    <KitchenInput
                                        label="Table Name (Optional)"
                                        placeholder="e.g. Balcony Side View"
                                        value={form.table_name}
                                        onChange={(e) => setForm((current) => ({ ...current, table_name: e.target.value }))}
                                    />
                                </div>

                                <div className={styles.sectionHeader}>
                                    <h3>CONFIGURATION</h3>
                                    <div className={styles.sectionLine}></div>
                                </div>

                                <KitchenInput
                                    label="Seating Capacity"
                                    type="number"
                                    value={form.seating_capacity}
                                    onChange={(e) => setForm((current) => ({ ...current, seating_capacity: e.target.value }))}
                                />

                                <label className={styles.activeSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                                    />
                                    <span>Active & Visible in POS</span>
                                </label>

                                <div className={`${styles.toggleField} ${styles.fullWidth}`}>
                                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        TABLE STATUS
                                    </label>
                                    <div className={styles.statusToggleContainer}>
                                        {(['Available', 'Occupied', 'Reserved', 'Blocked'] as UiTableStatus[]).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                className={`${styles.statusOption} ${form.current_status === status ? styles.statusOptionActive : ''}`}
                                                onClick={() => setForm((current) => ({ ...current, current_status: status }))}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" size="sm" onClick={closeForm}>
                                Cancel
                            </KitchenButton>
                            <KitchenButton size="sm" onClick={() => void saveTable()} isLoading={isSaving}>
                                <Save size={16} style={{ marginRight: '8px' }} />
                                {selectedTable ? 'Update Table' : 'Save Table'}
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}

            {isQrOpen && (
                <div className={styles.modalOverlay}>
                    <KitchenCard className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <div className={styles.modalTableBadge}>{selectedTable?.table_no || 'QR'}</div>
                                <div>
                                    <div className={styles.modalTitle}>Table QR Code</div>
                                    <div className={styles.modalSubtitle}>Export and regenerate branch-facing QR access</div>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setIsQrOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.qrContainer}>
                            <div className={styles.qrBox}>
                                <QrCode size={200} color="#000" />
                            </div>
                            <h3>Table: {selectedTable?.table_no}</h3>
                            <p>QR export is awaiting backend token generation for this live branch.</p>
                        </div>
                        <div className={styles.modalFooter} style={{ justifyContent: 'center', gap: '12px' }}>
                            <KitchenButton variant="outline" size="sm" onClick={qrActionNotice}>
                                <RefreshCw size={14} style={{ marginRight: '8px' }} />
                                Regenerate
                            </KitchenButton>
                            <KitchenButton size="sm" onClick={qrActionNotice}>
                                <Download size={14} style={{ marginRight: '8px' }} />
                                Download QR
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}
        </div>
    );
}
