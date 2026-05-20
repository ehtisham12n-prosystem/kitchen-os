/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    ArrowLeft,
    Monitor
} from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { toast } from '../../components/ui/KitchenToast/toast';
import { saleCounterApi, branchApi } from '../../api/api';
import { APP_PERMISSIONS } from '../../auth/access';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { useModuleActions } from '../../hooks/useModuleActions';
import styles from './TerminalCenter.module.css';

// --- Types ---

interface SaleCounter {
    id: number;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    branch_id: number;
    created_at: string;
}

// --- Main Component ---
export default function TerminalCenter({ embedded = false }: { embedded?: boolean }) {
    const navigate = useNavigate();
    const { hasAnyPermission } = usePermissionAccess();
    const counterActions = useModuleActions('counter', 'company');
    const canManageCounters = counterActions.manage || hasAnyPermission([APP_PERMISSIONS.ADMIN.SETUP_COUNTERS, APP_PERMISSIONS.POS.TILL_MANAGE]);
    const [branchId, setBranchId] = useState<number | null>(() => {
        const stored = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
        return stored ? Number(stored) : null;
    });
    const [branchName, setBranchName] = useState(localStorage.getItem('branch_name') || 'Selected Branch');

    useEffect(() => {
        if (!branchId) {
            const resolveBranch = async () => {
                try {
                    const branches = await branchApi.getBranches();
                    if (branches.length > 0) {
                        setBranchId(branches[0].id);
                        setBranchName(branches[0].branch_name);
                    }
                } catch (e) {
                    console.error('Failed to resolve branch', e);
                }
            };
            resolveBranch();
        }
    }, [branchId]);

    return (
        <div className={styles.page}>
            {!embedded && (
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button className={styles.backBtn} onClick={() => navigate('/terminal/day')}>
                            <ArrowLeft size={18} />
                        </button>
                        <div className={styles.headerInfo}>
                            <h1>Sale Counter Registry</h1>
                            <p>Configure and manage physical POS terminals for <strong>{branchName}</strong></p>
                        </div>
                    </div>
                    
                    <div className="global-sub-nav">
                        <button className="global-sub-nav-item active">
                            <Monitor size={14} />
                            Terminal Registry
                        </button>
                    </div>

                    <KitchenButton variant="primary" disabled={!canManageCounters} onClick={() => canManageCounters && window.dispatchEvent(new CustomEvent('open-counter-form'))}>
                        <Plus size={16} /> New Counter
                    </KitchenButton>
                </header>
            )}

            <div className={styles.tabContent} style={{ marginTop: embedded ? '0' : '0' }}>
                <RegistryTab branchId={branchId} branchName={branchName} canManageCounters={canManageCounters} embedded={embedded} />
            </div>
        </div>
    );
}

// --- Sub-Components ---

/**
 * 1. RegistryTab (Migrated from SaleCounters.tsx)
 */
function RegistryTab({ branchId, canManageCounters, embedded }: { branchId: number | null, branchName: string, canManageCounters: boolean, embedded?: boolean }) {
    const [counters, setCounters] = useState<SaleCounter[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);

    const fetchCounters = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const data = await saleCounterApi.getAll(branchId);
            setCounters(data);
        } catch {
            toast.error('Error', 'Failed to load counters.');
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { void fetchCounters(); }, [fetchCounters]);

    // Listen for the "New Counter" button in the parent header
    useEffect(() => {
        const handleNew = () => {
            setEditingId(null);
            setName('');
            setCode('');
            setDescription('');
            setIsActive(true);
            setIsFormOpen(true);
        };
        window.addEventListener('open-counter-form', handleNew);
        return () => window.removeEventListener('open-counter-form', handleNew);
    }, []);

    const handleEdit = (c: SaleCounter) => {
        if (!canManageCounters) return;
        setEditingId(c.id);
        setName(c.name);
        setCode(c.code);
        setDescription(c.description || '');
        setIsActive(c.is_active);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!canManageCounters) return;
        if (!window.confirm('Confirm delete counter?')) return;
        try {
            await saleCounterApi.remove(id);
            toast.success('Deleted', 'Counter removed.');
            void fetchCounters();
        } catch {
            toast.error('Error', 'Delete failed.');
        }
    };

    const handleSave = async () => {
        if (!canManageCounters) return;
        if (!name.trim() || !code.trim() || !branchId) return;
        try {
            const payload = { name, code, description, is_active: isActive, branch_id: branchId };
            if (editingId) await saleCounterApi.update(editingId, payload);
            else await saleCounterApi.create(payload);
            toast.success('Success', `Counter ${name} saved.`);
            setIsFormOpen(false);
            void fetchCounters();
        } catch (e: any) {
            toast.error('Error', e?.message || 'Save failed.');
        }
    };

    const filtered = counters.filter((c: SaleCounter) => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    if (loading && counters.length === 0) return <div className={styles.emptyState}>Loading registry...</div>;

    return (
        <KitchenCard className={styles.registryBox}>
            <div className={styles.historyHeader}>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                    <input 
                        className={styles.headerSearch}
                        placeholder="Search counters..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: '40px', width: '100%', height: '40px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                    />
                </div>
                {embedded && canManageCounters ? (
                    <KitchenButton variant="primary" onClick={() => window.dispatchEvent(new CustomEvent('open-counter-form'))}>
                        <Plus size={16} /> New Counter
                    </KitchenButton>
                ) : null}
                {!canManageCounters ? <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Read-only access</span> : null}
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.historyTable}>
                    <thead>
                        <tr>
                            <th>Counter Name</th>
                            <th>Code</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id}>
                                <td>{c.name}</td>
                                <td><code>{c.code}</code></td>
                                <td>
                                    <span style={{ color: c.is_active ? '#10b981' : '#f43f5e', fontSize: '0.85rem' }}>
                                        {c.is_active ? 'Enabled' : 'Disabled'}
                                    </span>
                                </td>
                                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <KitchenButton size="sm" variant="ghost" disabled={!canManageCounters} onClick={() => handleEdit(c)}><Edit2 size={14} /></KitchenButton>
                                        <KitchenButton size="sm" variant="ghost" disabled={!canManageCounters} onClick={() => handleDelete(c.id)}><Trash2 size={14} /></KitchenButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className={styles.formOverlay} onClick={() => setIsFormOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    <KitchenCard onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>{editingId ? 'Edit' : 'New'} Counter</h2>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}><X size={20} /></KitchenButton>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <KitchenInput 
                                label="Name" 
                                value={name} 
                                disabled={!canManageCounters}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (!editingId) setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''));
                                }} 
                            />
                            <KitchenInput label="Identifier Code" value={code} disabled={!canManageCounters} onChange={e => setCode(e.target.value.toUpperCase())} />
                            <KitchenInput label="Description" value={description} disabled={!canManageCounters} onChange={e => setDescription(e.target.value)} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span>Active</span>
                                <input type="checkbox" checked={isActive} disabled={!canManageCounters} onChange={() => setIsActive(!isActive)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <KitchenButton variant="primary" fullWidth disabled={!canManageCounters} onClick={handleSave}>Save Counter</KitchenButton>
                            <KitchenButton variant="ghost" fullWidth onClick={() => setIsFormOpen(false)}>Cancel</KitchenButton>
                        </div>
                    </KitchenCard>
                </div>
            )}
        </KitchenCard>
    );
}
