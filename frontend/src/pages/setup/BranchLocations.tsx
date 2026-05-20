/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Check,
    CheckCircle2,
    Edit2,
    MapPin,
    Plus,
    Save,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { branchApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './BranchLocations.module.css';

interface BranchLocationRecord {
    id: number;
    branch_id: number;
    location_name: string;
    location_code?: string | null;
    location_type?: string | null;
    description?: string | null;
    is_active: boolean;
    created_at: string;
}

function resolveCurrentBranch() {
    const storedBranchId = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
    let currentBranchId = storedBranchId || '';
    let currentBranchName = localStorage.getItem('branch_name') || 'Selected Branch';
    try {
        const ctx = readStoredUserContext();
        const primary = ctx?.allowed_branches?.find((branch: any) => branch.is_primary) || ctx?.allowed_branches?.[0];
        if (!currentBranchId && primary?.branch_id) {
            currentBranchId = String(primary.branch_id);
            currentBranchName = primary.branch_name || currentBranchName;
        }
        if (currentBranchId && ctx?.allowed_branches?.length) {
            const match = ctx.allowed_branches.find((branch: any) => String(branch.branch_id) === currentBranchId);
            if (match?.branch_name) currentBranchName = match.branch_name;
        }
    } catch {
        // ignore invalid cached context
    }
    return { currentBranchId, currentBranchName };
}

export function BranchLocations() {
    const navigate = useNavigate();
    const { currentBranchId, currentBranchName } = resolveCurrentBranch();

    const [locations, setLocations] = useState<BranchLocationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    const loadLocations = useCallback(async () => {
        if (!currentBranchId) {
            setLocations([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await branchApi.getLocations(currentBranchId);
            setLocations(data);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load branch locations.');
        } finally {
            setLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        void loadLocations();
    }, [loadLocations]);

    const filteredLocations = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return locations;
        return locations.filter((location) =>
            location.location_name.toLowerCase().includes(term)
            || String(location.description || '').toLowerCase().includes(term)
            || String(location.location_type || '').toLowerCase().includes(term),
        );
    }, [locations, search]);

    const openCreate = () => {
        setEditingId(null);
        setName('');
        setDescription('');
        setIsActive(true);
        setIsFormOpen(true);
    };

    const openEdit = (location: BranchLocationRecord) => {
        setEditingId(location.id);
        setName(location.location_name);
        setDescription(location.description || '');
        setIsActive(location.is_active);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!currentBranchId) {
            toast.error('Branch Required', 'Select an active branch before managing locations.');
            return;
        }
        if (!name.trim()) {
            toast.error('Required Field', 'Please enter a location name.');
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                await branchApi.updateLocation(editingId, {
                    location_name: name.trim(),
                    description: description.trim() || null,
                    is_active: isActive,
                });
                toast.success('Location Updated', 'The branch location was updated successfully.');
            } else {
                await branchApi.createLocation(currentBranchId, {
                    location_name: name.trim(),
                    description: description.trim() || null,
                    is_active: isActive,
                });
                toast.success('Location Created', 'A new branch location has been added.');
            }
            closeForm();
            await loadLocations();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save branch location.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (location: BranchLocationRecord) => {
        try {
            await branchApi.updateLocation(location.id, {
                is_active: !location.is_active,
            });
            await loadLocations();
            toast.success('Status Updated', 'Location status was updated.');
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Could not update location status.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this location?')) {
            return;
        }
        try {
            await branchApi.deleteLocation(id);
            await loadLocations();
            toast.success('Deleted', 'Location removed successfully.');
        } catch (error: any) {
            toast.error('Delete Failed', error.message || 'Could not delete branch location.');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.headerIcon}>
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Branch Locations</h1>
                        <p className={styles.subtitle}>
                            Manage physical sub-locations for <span className={styles.branchName}>{currentBranchName}</span>
                        </p>
                    </div>
                </div>
                <KitchenButton variant="primary" onClick={openCreate}>
                    <Plus size={16} style={{ marginRight: '8px' }} /> Add Location
                </KitchenButton>
            </div>

            <div className={styles.content}>
                {isFormOpen && (
                    <div className={styles.formOverlay} onClick={closeForm}>
                        <div className={styles.formCard} onClick={(event) => event.stopPropagation()}>
                            <div className={styles.formHeader}>
                                <h2>{editingId ? 'Edit Location' : 'New Branch Location'}</h2>
                                <button className={styles.closeBtn} onClick={closeForm}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.formBody}>
                                <div className={styles.fieldGroup}>
                                    <label>Branch (Auto-Selected)</label>
                                    <div className={styles.autoSelectBox}>
                                        <Building2 size={16} />
                                        <span>{currentBranchName}</span>
                                        <Check size={14} className={styles.checkIcon} />
                                    </div>
                                </div>

                                <KitchenInput
                                    label="Location Name"
                                    required
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="e.g. Main Kitchen, Display Chiller, Dry Store"
                                />

                                <KitchenInput
                                    label="Address / Description"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Internal floor, counter, rack, or area description"
                                />

                                <div className={styles.statusToggleGroup}>
                                    <label>Location Status</label>
                                    <div className={styles.toggleRow}>
                                        <span className={styles.statusLabel}>{isActive ? 'Enabled' : 'Disabled'}</span>
                                        <label className={styles.switch}>
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={() => setIsActive((current) => !current)}
                                            />
                                            <span className={styles.slider}></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formFooter}>
                                <KitchenButton variant="ghost" onClick={closeForm}>
                                    Cancel
                                </KitchenButton>
                                <KitchenButton variant="primary" onClick={handleSave} disabled={saving}>
                                    <Save size={16} style={{ marginRight: '8px' }} />
                                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Location'}
                                </KitchenButton>
                            </div>
                        </div>
                    </div>
                )}

                <KitchenCard className={styles.listCard}>
                    <div className={styles.listHeader}>
                        <div className={styles.searchBox}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search locations..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <div className={styles.listStats}>
                            {loading ? 'Loading...' : `${filteredLocations.length} locations found`}
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Location Name</th>
                                    <th>Internal Address</th>
                                    <th>Status</th>
                                    <th>Added On</th>
                                    <th className={styles.actionsCell}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && filteredLocations.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyCell}>
                                            <div className={styles.emptyState}>
                                                <MapPin size={40} />
                                                <p>No locations found matching your criteria.</p>
                                                <button onClick={openCreate}>Add your first location</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLocations.map((location) => (
                                        <tr key={location.id} className={!location.is_active ? styles.inactiveRow : ''}>
                                            <td className={styles.nameCell}>
                                                <div className={styles.locationInfo}>
                                                    <span className={styles.locName}>{location.location_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.locAddress}>{location.description || '—'}</span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`${styles.statusBadge} ${location.is_active ? styles.active : styles.inactive}`}
                                                    onClick={() => void toggleStatus(location)}
                                                >
                                                    {location.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                    {location.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.dateText}>
                                                    {new Date(location.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionBtns}>
                                                    <button className={styles.editBtn} onClick={() => openEdit(location)} title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className={styles.deleteBtn} onClick={() => void handleDelete(location.id)} title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}
