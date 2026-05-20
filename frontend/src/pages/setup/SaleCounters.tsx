/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Monitor,
    Plus,
    Search,
    Edit2,
    Trash2,
    Save,
    X,
    Building2,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    Check,
    Hash
} from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { toast } from '../../components/ui/KitchenToast/toast';
import { branchApi, saleCounterApi } from '../../api/api';
import styles from './SaleCounters.module.css';

interface SaleCounter {
    id: number;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    branch_id: number;
    created_at: string;
}

export function SaleCounters() {
    const navigate = useNavigate();
    const [counters, setCounters] = useState<SaleCounter[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Context from localStorage
    const [currentBranchId, setCurrentBranchId] = useState<number | null>(() => {
        const stored = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
        return stored ? Number(stored) : null;
    });
    const [currentBranchName, setCurrentBranchName] = useState<string>(
        localStorage.getItem('branch_name') || 'Selected Branch',
    );

    // Form State
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        const ensureBranch = async () => {
            if (currentBranchId) return;
            try {
                const branches = await branchApi.getBranches();
                if (branches.length > 0) {
                    const first = branches[0];
                    setCurrentBranchId(first.id);
                    setCurrentBranchName(first.branch_name);
                    localStorage.setItem('activeBranchId', String(first.id));
                    localStorage.setItem('branch_name', first.branch_name);
                }
            } catch (error) {
                console.error('Failed to resolve branch context:', error);
            }
        };
        ensureBranch();
    }, [currentBranchId]);

    const fetchCounters = useCallback(async () => {
        try {
            setLoading(true);
            const data = await saleCounterApi.getAll(currentBranchId || undefined);
            setCounters(data);
        } catch (error) {
            console.error('Failed to fetch counters:', error);
            toast.error('Network Error', 'Could not load sale counters.');
        } finally {
            setLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        if (currentBranchId) {
            void fetchCounters();
        }
    }, [currentBranchId, fetchCounters]);

    const handleAdd = () => {
        setEditingId(null);
        setName('');
        setCode('');
        setDescription('');
        setIsActive(true);
        setIsFormOpen(true);
    };

    const handleEdit = (counter: SaleCounter) => {
        setEditingId(counter.id);
        setName(counter.name);
        setCode(counter.code);
        setDescription(counter.description || '');
        setIsActive(counter.is_active);
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !code.trim()) {
            toast.error('Required Fields', 'Please enter Name and Code for the counter.');
            return;
        }
        if (!currentBranchId) {
            toast.error('Branch Required', 'Please select a valid branch before saving.');
            return;
        }

        const payload = {
            name,
            code,
            description,
            is_active: isActive,
            branch_id: currentBranchId
        };

        try {
            if (editingId) {
                await saleCounterApi.update(editingId, payload);
            } else {
                await saleCounterApi.create(payload);
            }
            toast.success(
                editingId ? 'Counter Updated' : 'Counter Created',
                `Counter ${name} has been ${editingId ? 'updated' : 'added'} successfully.`
            );
            setIsFormOpen(false);
            void fetchCounters();
        } catch (error: any) {
            toast.error('Error', error?.message || 'Failed to communicate with the server.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this counter? This action cannot be undone.')) return;

        try {
            await saleCounterApi.remove(id);
            toast.success('Deleted', 'Sale counter removed successfully.');
            void fetchCounters();
        } catch {
            toast.error('Error', 'Failed to delete counter.');
        }
    };

    const filteredCounters = useMemo(() => {
        return counters.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.toLowerCase().includes(search.toLowerCase())
        );
    }, [counters, search]);

    // Auto-generate code from name
    const handleNameChange = (val: string) => {
        setName(val);
        if (!editingId) {
            const generatedCode = val.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            setCode(generatedCode);
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
                        <Monitor size={24} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Sale Counters / Tills</h1>
                        <p className={styles.subtitle}>
                            Manage POS terminals for <span className={styles.branchName}>{currentBranchName}</span>
                        </p>
                    </div>
                </div>
                <KitchenButton variant="primary" onClick={handleAdd}>
                    <Plus size={16} style={{ marginRight: '8px' }} /> Add Counter
                </KitchenButton>
            </div>

            <div className={styles.content}>
                {isFormOpen && (
                    <div className={styles.formOverlay} onClick={() => setIsFormOpen(false)}>
                        <div className={styles.formCard} onClick={e => e.stopPropagation()}>
                            <div className={styles.formHeader}>
                                <h2>{editingId ? 'Edit Counter' : 'New Sale Counter'}</h2>
                                <button className={styles.closeBtn} onClick={() => setIsFormOpen(false)}>
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
                                    label="Counter Name"
                                    required
                                    value={name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="e.g. Counter 1, Express Till"
                                />

                                <KitchenInput
                                    label="Counter Code / Identifier"
                                    required
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="COUNTER_01"
                                    icon={<Hash size={16} />}
                                />

                                <KitchenInput
                                    label="Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional description of the terminal"
                                />

                                <div className={styles.statusToggleGroup}>
                                    <label>Terminal Status</label>
                                    <div className={styles.toggleRow}>
                                        <span className={styles.statusLabel}>
                                            {isActive ? 'Active & Receiving' : 'Deactivated'}
                                        </span>
                                        <label className={styles.switch}>
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={() => setIsActive(!isActive)}
                                            />
                                            <span className={styles.slider}></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formFooter}>
                                <KitchenButton variant="ghost" onClick={() => setIsFormOpen(false)}>
                                    Cancel
                                </KitchenButton>
                                <KitchenButton variant="primary" onClick={handleSave}>
                                    <Save size={16} style={{ marginRight: '8px' }} />
                                    {editingId ? 'Save Changes' : 'Create Counter'}
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
                                placeholder="Search counters..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className={styles.listStats}>
                            {filteredCounters.length} terminals configured
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Counter Name</th>
                                    <th>Identifier</th>
                                    <th>Status</th>
                                    <th>Registration Date</th>
                                    <th className={styles.actionsCell}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyCell}>
                                            <div className={styles.emptyState}>
                                                <p>Loading counters...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredCounters.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyCell}>
                                            <div className={styles.emptyState}>
                                                <Monitor size={40} />
                                                <p>No counters found for this branch.</p>
                                                <button onClick={handleAdd}>Add your first till</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCounters.map(c => (
                                        <tr key={c.id}>
                                            <td className={styles.nameCell}>{c.name}</td>
                                            <td>
                                                <span className={styles.counterCode}>{c.code}</span>
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${c.is_active ? styles.active : styles.inactive}`}>
                                                    {c.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                    {c.is_active ? 'Online' : 'Offline'}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(c.created_at).toLocaleDateString()}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionBtns}>
                                                    <button className={styles.editBtn} onClick={() => handleEdit(c)}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className={styles.deleteBtn} onClick={() => handleDelete(c.id)}>
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
