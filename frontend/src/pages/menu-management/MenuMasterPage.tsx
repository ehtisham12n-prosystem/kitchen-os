/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import {
    Plus, Search, Edit2, Trash2, CheckCircle, XCircle,
    Loader2, Save, X, Filter
} from 'lucide-react';
import styles from './MenuMasterPage.module.css';

export interface MasterRecord {
    id: number;
    name: string;
    code: string;
    description?: string;
    is_active: boolean;
    sort_order: number;
    branchAvailability?: Record<string, boolean>;
    [key: string]: any;
}

interface MenuMasterPageProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    initialData: MasterRecord[];
    branches?: Array<{ id: string; name: string; code: string }>;
    extraFields?: (record: any, onChange: (field: string, value: any) => void) => React.ReactNode;
    onSave?: (record: Partial<MasterRecord>) => Promise<MasterRecord | void>;
    onDelete?: (id: number) => Promise<void>;
}

const PAGE_SIZE = 10;

export function MenuMasterPage({
    title,
    description,
    icon,
    initialData,
    branches = [],
    extraFields,
    onSave,
    onDelete
}: MenuMasterPageProps) {
    const [data, setData] = useState<MasterRecord[]>(initialData);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [page, setPage] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<Partial<MasterRecord> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const filtered = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.code.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'active' ? item.is_active : !item.is_active);
            return matchesSearch && matchesStatus;
        }).sort((a, b) => a.sort_order - b.sort_order);
    }, [data, search, filterStatus]);

    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    const handleEdit = (record: MasterRecord) => {
        setCurrentRecord(record);
        setIsEditing(true);
    };

    const handleCreate = () => {
        setCurrentRecord({
            name: '',
            code: '',
            description: '',
            is_active: true,
            sort_order: (data.length > 0 ? Math.max(...data.map(d => d.sort_order)) + 10 : 10),
            branchAvailability: branches.reduce((acc, b) => ({ ...acc, [b.id]: true }), {})
        });
        setIsEditing(true);
    };

    const handleClose = () => {
        setIsEditing(false);
        setCurrentRecord(null);
    };

    const handleFieldChange = (field: string, value: any) => {
        if (!currentRecord) return;
        setCurrentRecord({
            ...currentRecord,
            [field]: field === 'code' ? value.toUpperCase() : value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRecord) return;

        setIsSubmitting(true);
        try {
            if (onSave) {
                const saved = await onSave(currentRecord);
                if (saved) {
                    setData(prev => currentRecord.id
                        ? prev.map(d => d.id === saved.id ? saved : d)
                        : [...prev, saved],
                    );
                }
            } else {
                // Mock behavior
                await new Promise(resolve => setTimeout(resolve, 800));
                if (currentRecord.id) {
                    setData(prev => prev.map(d => d.id === currentRecord.id ? (currentRecord as MasterRecord) : d));
                } else {
                    const newRecord = {
                        ...currentRecord,
                        id: Math.max(0, ...data.map(d => d.id)) + 1,
                        created_at: new Date().toISOString()
                    } as MasterRecord;
                    setData(prev => [...prev, newRecord]);
                }
            }
            handleClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (record: MasterRecord) => {
        const nextRecord = { ...record, is_active: !record.is_active };
        if (onSave) {
            const saved = await onSave(nextRecord);
            if (saved) {
                setData(prev => prev.map(d => d.id === record.id ? saved : d));
                return;
            }
        }

        setData(prev => prev.map(d => d.id === record.id ? nextRecord : d));
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        if (onDelete) {
            await onDelete(id);
            setData(prev => prev.filter(d => d.id !== id));
            return;
        }

        setData(prev => prev.filter(d => d.id !== id));
    };

    const columns: ColumnDef<MasterRecord>[] = [
        {
            key: 'name',
            header: 'Name',
            cell: (row) => (
                <div className={styles.nameCell}>
                    <div className={styles.itemName}>{row.name}</div>
                    <div className={styles.itemCode}>{row.code}</div>
                </div>
            )
        },
        {
            key: 'sort_order',
            header: 'Sort Order',
            cell: (row) => <span className={styles.sortBadge}>{row.sort_order}</span>
        },
        {
            key: 'is_active',
            header: 'Status',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        className={`${styles.statusBadge} ${row.is_active ? styles.active : styles.inactive}`}
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(row); }}
                    >
                        {row.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {row.is_active ? 'Active' : 'Inactive'}
                    </button>
                    {row.branchAvailability && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            ({Object.values(row.branchAvailability).filter(Boolean).length} Branches)
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actions}>
                    <button className={styles.actionBtn} onClick={() => handleEdit(row)} title="Edit">
                        <Edit2 size={16} />
                    </button>
                    <button className={`${styles.actionBtn} ${styles.delete}`} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleWrap}>
                    <div className={styles.iconBox}>{icon}</div>
                    <div>
                        <h1>{title}</h1>
                        <p>{description}</p>
                    </div>
                </div>
                <KitchenButton onClick={handleCreate}>
                    <Plus size={18} />
                    Create New
                </KitchenButton>
            </header>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search by name or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className={styles.filters}>
                        <Filter size={16} />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive Only</option>
                        </select>
                    </div>
                </div>

                <KitchenTable
                    columns={columns}
                    data={paginated}
                    onRowClick={handleEdit}
                    emptyMessage={`No ${title.toLowerCase()} found.`}
                />

                {totalPages > 1 && (
                    <div className={styles.pagination}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                        <span>Page {page} of {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </KitchenCard>

            {isEditing && (
                <div className={styles.modalOverlay}>
                    <KitchenCard className={styles.modal}>
                        <header className={styles.modalHeader}>
                            <h2>{currentRecord?.id ? `Edit ${title}` : `Create ${title}`}</h2>
                            <button className={styles.closeBtn} onClick={handleClose}><X size={20} /></button>
                        </header>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Name"
                                    required
                                    value={currentRecord?.name || ''}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    placeholder="Enter name"
                                />
                                <KitchenInput
                                    label="Code"
                                    required
                                    value={currentRecord?.code || ''}
                                    onChange={(e) => handleFieldChange('code', e.target.value)}
                                    placeholder="Short system code"
                                />
                                <div className={styles.fullWidth}>
                                    <KitchenInput
                                        label="Description"
                                        value={currentRecord?.description || ''}
                                        onChange={(e) => handleFieldChange('description', e.target.value)}
                                        placeholder="Optional description"
                                    />
                                </div>
                                <KitchenInput
                                    label="Sort Order"
                                    type="number"
                                    value={currentRecord?.sort_order || 0}
                                    onChange={(e) => handleFieldChange('sort_order', parseInt(e.target.value))}
                                />
                                <div className={styles.toggleField}>
                                    <label>Active Status</label>
                                    <button
                                        type="button"
                                        className={`${styles.toggle} ${currentRecord?.is_active ? styles.toggleOn : ''}`}
                                        onClick={() => handleFieldChange('is_active', !currentRecord?.is_active)}
                                    >
                                        <div className={styles.knob} />
                                    </button>
                                </div>

                                {extraFields && extraFields(currentRecord, handleFieldChange)}

                                <div className={styles.separator} data-label="Branch Availability" />
                                <div className={styles.branchGrid}>
                                    {branches.map(branch => {
                                        const isEnabled = currentRecord?.branchAvailability?.[branch.id] ?? false;
                                        return (
                                            <div
                                                key={branch.id}
                                                className={`${styles.branchToggle} ${isEnabled ? styles.enabled : ''}`}
                                                onClick={() => {
                                                    const newBranches = { ...(currentRecord?.branchAvailability || {}) };
                                                    newBranches[branch.id] = !isEnabled;
                                                    handleFieldChange('branchAvailability', newBranches);
                                                }}
                                            >
                                                <div className={styles.branchInfo}>
                                                    <span className={styles.branchName}>{branch.name}</span>
                                                    <span className={styles.branchCode}>{branch.code}</span>
                                                </div>
                                                {isEnabled ? <CheckCircle size={18} color="var(--accent-primary)" /> : <div style={{ width: 18, height: 18, border: '2px solid var(--text-tertiary)', borderRadius: '50%' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <KitchenButton type="button" variant="secondary" onClick={handleClose}>
                                    Cancel
                                </KitchenButton>
                                <KitchenButton type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                                    {currentRecord?.id ? 'Update Record' : 'Save Record'}
                                </KitchenButton>
                            </div>
                        </form>
                    </KitchenCard>
                </div>
            )}
        </div>
    );
}

