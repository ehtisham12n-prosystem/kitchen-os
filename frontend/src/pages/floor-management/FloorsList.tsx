import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { formatDateTime, loadActiveBranchLayout, type LayoutFloorRecord } from './layoutData';
import {
    Loader2,
    Plus,
    Search,
    Edit2,
    Trash2,
    Power,
    PowerOff,
    X,
    Save,
    Layers3,
    CheckCircle2,
    Ban,
    Hash,
} from 'lucide-react';
import styles from './FloorsTables.module.css';

interface FloorFormState {
    name: string;
    code: string;
    description: string;
    display_order: string;
    is_active: boolean;
}

const EMPTY_FORM: FloorFormState = {
    name: '',
    code: '',
    description: '',
    display_order: '0',
    is_active: true,
};

function toFloorForm(floor?: LayoutFloorRecord | null): FloorFormState {
    if (!floor) {
        return EMPTY_FORM;
    }

    return {
        name: floor.name || '',
        code: floor.code || '',
        description: floor.description || '',
        display_order: String(floor.display_order ?? 0),
        is_active: floor.status !== 'Inactive',
    };
}

export function FloorsList() {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingFloor, setEditingFloor] = useState<LayoutFloorRecord | null>(null);
    const [floors, setFloors] = useState<LayoutFloorRecord[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [branchName, setBranchName] = useState('');
    const [form, setForm] = useState<FloorFormState>(EMPTY_FORM);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadFloors = async () => {
        setIsLoading(true);
        try {
            const layout = await loadActiveBranchLayout();
            setBranchId(layout.branchId);
            setBranchName(layout.branchName);
            setFloors(layout.floors);
        } catch (error: any) {
            console.error('Failed to load floors:', error);
            toast.error('Floors Unavailable', error.message || 'Could not load branch floors.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadFloors();
    }, []);

    const filteredFloors = useMemo(() => {
        return floors.filter((floor) => {
            const matchesSearch =
                floor.name.toLowerCase().includes(search.toLowerCase()) ||
                floor.code.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = filterStatus === 'All' || floor.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [filterStatus, floors, search]);

    const summary = useMemo(() => {
        const active = floors.filter((floor) => floor.status === 'Active').length;
        const inactive = floors.length - active;
        const codes = floors.filter((floor) => floor.code).length;
        return {
            total: floors.length,
            active,
            inactive,
            coded: codes,
        };
    }, [floors]);

    const openCreateModal = () => {
        setEditingFloor(null);
        setForm(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEditModal = (floor: LayoutFloorRecord) => {
        setEditingFloor(floor);
        setForm(toFloorForm(floor));
        setIsFormOpen(true);
    };

    const closeModal = () => {
        setIsFormOpen(false);
        setEditingFloor(null);
        setForm(EMPTY_FORM);
    };

    const handleSave = async () => {
        if (!branchId) {
            toast.error('Branch Missing', 'Select an active branch before managing floors.');
            return;
        }
        if (!form.name.trim()) {
            toast.error('Floor Name Required', 'Enter a floor name to continue.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                floor_name: form.name.trim(),
                code: form.code.trim() || undefined,
                description: form.description.trim() || undefined,
                display_order: Number(form.display_order || 0),
                is_active: form.is_active,
            };

            if (editingFloor) {
                await branchApi.updateFloor(editingFloor.id, payload);
                toast.success('Floor Updated', 'Floor changes were saved.');
            } else {
                await branchApi.createFloor(branchId, payload);
                toast.success('Floor Created', 'New floor is available for table assignment.');
            }

            closeModal();
            await loadFloors();
        } catch (error: any) {
            console.error('Failed to save floor:', error);
            toast.error('Save Failed', error.message || 'Could not save floor.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (floor: LayoutFloorRecord) => {
        try {
            await branchApi.updateFloor(floor.id, { is_active: floor.status !== 'Active' });
            toast.success('Floor Updated', `Floor ${floor.status === 'Active' ? 'disabled' : 'enabled'} successfully.`);
            await loadFloors();
        } catch (error: any) {
            console.error('Failed to toggle floor status:', error);
            toast.error('Update Failed', error.message || 'Could not change floor status.');
        }
    };

    const handleDelete = async (floor: LayoutFloorRecord) => {
        if (!window.confirm('Are you sure you want to delete this floor?')) {
            return;
        }

        try {
            await branchApi.deleteFloor(floor.id);
            toast.success('Floor Deleted', 'Floor removed successfully.');
            await loadFloors();
        } catch (error: any) {
            console.error('Failed to delete floor:', error);
            toast.error('Delete Failed', error.message || 'Could not delete floor.');
        }
    };

    const columns: ColumnDef<LayoutFloorRecord>[] = [
        {
            key: 'name',
            header: 'Floor Name',
            cell: (row) => <span style={{ fontWeight: 600 }}>{row.name}</span>,
        },
        {
            key: 'code',
            header: 'Floor Code',
            cell: (row) => (
                <span style={{ color: 'var(--accent-tertiary)', fontWeight: 500 }}>
                    {row.code || '-'}
                </span>
            ),
        },
        { key: 'description', header: 'Description', cell: (row) => row.description || '-' },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span
                    className={`${styles.statusBadge} ${row.status === 'Active' ? styles['status-active'] : styles['status-inactive']}`}
                >
                    {row.status}
                </span>
            ),
        },
        {
            key: 'last_updated',
            header: 'Last Updated',
            cell: (row) => formatDateTime(row.last_updated),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actions}>
                    <button
                        className={styles.actionBtn}
                        title="Edit"
                        onClick={() => openEditModal(row)}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className={styles.actionBtn}
                        title={row.status === 'Active' ? 'Disable' : 'Enable'}
                        onClick={() => void handleToggleStatus(row)}
                    >
                        {row.status === 'Active' ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                    <button
                        className={styles.actionBtn}
                        title="Delete"
                        onClick={() => void handleDelete(row)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Floors / Areas</h1>
                    <p>{branchName ? `Live branch: ${branchName}` : 'Live branch layout configuration'}</p>
                </div>
                <KitchenButton onClick={openCreateModal} disabled={!branchId}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Add New Floor
                </KitchenButton>
            </header>

            <div className={styles.summaryGrid}>
                <KitchenCard className={styles.summaryCard}>
                    <div className={styles.summaryIcon}><Layers3 size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.total}</strong>
                        <span>Total Floors</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconSuccess}`}><CheckCircle2 size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.active}</strong>
                        <span>Active Floors</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconMuted}`}><Ban size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.inactive}</strong>
                        <span>Inactive Floors</span>
                    </div>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <div className={`${styles.summaryIcon} ${styles.summaryIconAccent}`}><Hash size={16} /></div>
                    <div className={styles.summaryCopy}>
                        <strong>{summary.coded}</strong>
                        <span>With Codes</span>
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <KitchenInput
                            placeholder="Search by Floor Name or Code"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div className={styles.filters}>
                        <KitchenSelect
                            label="Status"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            options={[
                                { value: 'All', label: 'All' },
                                { value: 'Active', label: 'Active' },
                                { value: 'Inactive', label: 'Inactive' },
                            ]}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={filteredFloors} />
                )}
            </KitchenCard>

            {isFormOpen && (
                <div className={styles.modalOverlay}>
                    <KitchenCard className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <div className={styles.modalTableBadge}>FLR</div>
                                <div>
                                    <div className={styles.modalTitle}>{editingFloor ? 'Edit Floor' : 'Add Floor'}</div>
                                    <div className={styles.modalSubtitle}>
                                        {branchName ? `Branch: ${branchName}` : 'Configure floor identity and display order'}
                                    </div>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.sectionHeader}>
                                    <h3>FLOOR DETAILS</h3>
                                    <div className={styles.sectionLine}></div>
                                </div>
                                <KitchenInput
                                    label="Floor Name"
                                    placeholder="e.g. Roof Top"
                                    value={form.name}
                                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                />
                                <KitchenInput
                                    label="Floor Code"
                                    placeholder="e.g. ROOF"
                                    value={form.code}
                                    onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))}
                                />
                                <KitchenInput
                                    label="Description"
                                    placeholder="Enter floor details"
                                    className={styles.fullWidth}
                                    value={form.description}
                                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                                />
                                <KitchenInput
                                    label="Display Order"
                                    type="number"
                                    value={form.display_order}
                                    onChange={(e) => setForm((current) => ({ ...current, display_order: e.target.value }))}
                                />
                                <label className={`${styles.activeSwitch} ${styles.fullWidth}`}>
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                                    />
                                    <span>Active floor and available for table assignment</span>
                                </label>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={closeModal}>
                                Cancel
                            </KitchenButton>
                            <KitchenButton onClick={() => void handleSave()} isLoading={isSaving}>
                                <Save size={18} style={{ marginRight: '8px' }} />
                                {editingFloor ? 'Save Changes' : 'Save'}
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}
        </div>
    );
}
