import { useState, useEffect } from 'react';
import { KitchenCard } from '../../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import {
    Plus, Search, Edit2, ToggleLeft, ToggleRight, Trash2,
    Layers, ShieldCheck, Activity, Info, X, Save, Loader2,
} from 'lucide-react';
import { platformApi } from '../../../api/api';
import styles from './Security.module.css';

interface Permission {
    id: string;
    permission_key: string;
    permission_name: string;
    module_name: string;
    description: string;
    is_active: boolean;
    created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
    read: 'View',
    create: 'Create',
    update: 'Edit',
    delete: 'Delete',
    export: 'Export',
    sync: 'Sync',
    impersonate: 'Impersonate',
    publish: 'Publish',
    refund: 'Refund',
    audit: 'Audit',
    approve: 'Approve',
    manage: 'Manage',
};

const formatActionLabel = (action: string) =>
    ACTION_LABELS[action] || action
        .split('_')
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const formatPermissionName = (pageName: string, action: string) => `${formatActionLabel(action)} ${pageName}`;

export function PermissionManagement() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('All');

    const fetchPermissions = async () => {
        setIsLoading(true);
        try {
            const modules = await platformApi.getPermissionsRegistry();
            const flattened: Permission[] = [];
            modules.forEach((mod: any) => {
                (mod.pages || []).forEach((page: any) => {
                    const permissions = Array.isArray(page.permissions)
                        ? page.permissions
                        : (page.actions || []).map((action: string) => ({
                            id: `${mod.slug || mod.id}.${page.slug || page.id}.${action}`,
                            slug: `${mod.slug || mod.id}.${page.slug || page.id}.${action}`,
                            name: formatPermissionName(page.name || page.slug || 'Page', action),
                            description: page.description || mod.description,
                        }));
                    permissions.forEach((perm: any) => {
                        flattened.push({
                            id: perm.id,
                            permission_key: perm.slug || perm.id,
                            permission_name: perm.name || perm.id,
                            module_name: mod.name,
                            description: perm.description || page.description || mod.description,
                            is_active: true, // Assuming active if in registry
                            created_at: new Date().toISOString()
                        });
                    });
                });
            });
            setPermissions(flattened);
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [formData, setFormData] = useState({
        permission_key: '',
        permission_name: '',
        module_name: '',
        description: '',
        is_active: true
    });

    const modules = ['All', ...new Set(permissions.map(p => p.module_name))];

    const filteredPermissions = permissions.filter(p => {
        const matchesSearch = p.permission_name.toLowerCase().includes(search.toLowerCase()) ||
            p.permission_key.toLowerCase().includes(search.toLowerCase());
        const matchesModule = moduleFilter === 'All' || p.module_name === moduleFilter;
        return matchesSearch && matchesModule;
    });

    const handleOpenModal = (permission?: Permission) => {
        if (permission) {
            setEditingPermission(permission);
            setFormData({
                permission_key: permission.permission_key,
                permission_name: permission.permission_name,
                module_name: permission.module_name,
                description: permission.description,
                is_active: permission.is_active
            });
        } else {
            setEditingPermission(null);
            setFormData({
                permission_key: '',
                permission_name: '',
                module_name: '',
                description: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const now = new Date().toISOString().split('T')[0];

        if (editingPermission) {
            setPermissions(prev => prev.map(p => p.id === editingPermission.id ? {
                ...p,
                ...formData
            } : p));
        } else {
            const newPermission: Permission = {
                id: Math.random().toString(36).substr(2, 9),
                ...formData,
                created_at: now
            };
            setPermissions([...permissions, newPermission]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this permission? This may affect system security.')) {
            setPermissions(prev => prev.filter(p => p.id !== id));
        }
    };

    const columns: ColumnDef<Permission>[] = [
        {
            key: 'permission_key',
            header: 'Identity Key',
            cell: (row: Permission) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={14} color="var(--accent-primary)" />
                    <code className={styles.permissionSlug}>{row.permission_key}</code>
                </div>
            )
        },
        {
            key: 'permission_name',
            header: 'Access Definition',
            cell: (row: Permission) => (
                <div className={styles.permName}>
                    <strong>{row.permission_name}</strong>
                    <span>{row.description}</span>
                </div>
            )
        },
        {
            key: 'module_name',
            header: 'Domain',
            cell: (row: Permission) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={12} color="var(--accent-secondary)" />
                    <span className={styles.moduleBadge}>{row.module_name}</span>
                </div>
            )
        },
        {
            key: 'is_active',
            header: 'Enforcement',
            cell: (row: Permission) => (
                <div className={row.is_active ? styles.statusActive : styles.statusInactive}>
                    {row.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    <span style={{ fontWeight: 700 }}>{row.is_active ? 'ENABLED' : 'DISABLED'}</span>
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            cell: (row: Permission) => (
                <div className={styles.rowActions}>
                    <KitchenButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenModal(row)}
                    >
                        <Edit2 size={14} />
                    </KitchenButton>
                    <KitchenButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDelete(row.id)}
                    >
                        <Trash2 size={14} color="var(--color-error)" />
                    </KitchenButton>
                </div>
            ),
            align: 'right'
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <div className={styles.eyebrowHeader}><ShieldCheck size={12} /> Access Governance</div>
                    <h1 className="text-gradient">Permissions Registry</h1>
                    <p>Authorization orchestration and atomic access control tokens.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <KitchenButton variant="secondary" size="sm">
                        <Activity size={16} />
                    </KitchenButton>
                    <KitchenButton size="sm" onClick={() => handleOpenModal()}>
                        <Plus size={16} style={{ marginRight: '6px' }} />
                        Define Permission
                    </KitchenButton>
                </div>
            </header>

            {isLoading ? (
                <div className={styles.loadingState}>
                    <Loader2 size={32} className={styles.spin} />
                    <p>Fetching Permissions Registry...</p>
                </div>
            ) : (
                <>

                    {/* ── Security Stats ── */}
                    <div className={styles.kpiGrid}>
                        {/* Total Permissions */}
                        <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Registry Size</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{permissions.length}</div>
                            <div className={styles.kpiMeta}>
                                <span>Platform-wide directives</span>
                            </div>
                            <div className={styles.kpiProgressBar}>
                                <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                            </div>
                        </div>

                        {/* Active Policies */}
                        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                        <Activity size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Enforced</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{permissions.filter(p => p.is_active).length}</div>
                            <div className={styles.kpiMeta}>
                                <span>Tenant-adjustable rules</span>
                            </div>
                            <div className={styles.kpiProgressBar}>
                                <div className={styles.kpiProgressFill} style={{ width: '75%' }} />
                            </div>
                        </div>

                        {/* System Core */}
                        <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                                        <Layers size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Subsystems</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>{modules.length - 1}</div>
                            <div className={styles.kpiMeta}>
                                <span>Isolated domains</span>
                            </div>
                            <div className={styles.kpiProgressBar}>
                                <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                            </div>
                        </div>

                        {/* Safety Index */}
                        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                            <div className={styles.kpiTop}>
                                <div className={styles.kpiHeaderInfo}>
                                    <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                                        <Info size={18} />
                                    </div>
                                    <div className={styles.kpiLabel}>Safety Index</div>
                                </div>
                            </div>
                            <div className={styles.kpiValue}>98%</div>
                            <div className={styles.kpiMeta}>
                                <span>Atomic integrity check</span>
                            </div>
                            <div className={styles.kpiProgressBar}>
                                <div className={styles.kpiProgressFill} style={{ width: '98%' }} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.filters} style={{ gap: '12px' }}>
                        <div className={styles.searchBox}>
                            <Search size={16} color="var(--accent-primary)" />
                            <input
                                placeholder="Filter by key or name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>
                        <div className={styles.moduleFilters} style={{ gap: '6px' }}>
                            {modules.map(mod => (
                                <button
                                    key={mod}
                                    className={moduleFilter === mod ? styles.activeFilter : ''}
                                    onClick={() => setModuleFilter(mod)}
                                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                >
                                    {mod}
                                </button>
                            ))}
                        </div>
                    </div>

                    <KitchenCard className={styles.tableCard} noPadding>
                        <KitchenTable columns={columns} data={filteredPermissions} />
                    </KitchenCard>

                    {/* Permission Editor Modal */}
                    {isModalOpen && (
                        <div className={styles.modalOverlay}>
                            <div className={styles.modal}>
                                <div className={styles.modalHeader}>
                                    <h2>{editingPermission ? 'Edit Permission' : 'Define New Permission'}</h2>
                                    <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={handleSave}>
                                    <div className={styles.modalBody}>
                                        <div className={styles.formField}>
                                            <label>Access Identity Key</label>
                                            <input
                                                required
                                                type="text"
                                                className={styles.input}
                                                placeholder="e.g. USER_PROVISION"
                                                value={formData.permission_key}
                                                onChange={(e) => setFormData({ ...formData, permission_key: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className={styles.formField}>
                                            <label>Permission Name</label>
                                            <input
                                                required
                                                type="text"
                                                className={styles.input}
                                                placeholder="e.g. Provision Users"
                                                value={formData.permission_name}
                                                onChange={(e) => setFormData({ ...formData, permission_name: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formField}>
                                            <label>Domain / Module</label>
                                            <input
                                                required
                                                type="text"
                                                className={styles.input}
                                                placeholder="e.g. Security"
                                                value={formData.module_name}
                                                onChange={(e) => setFormData({ ...formData, module_name: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formField}>
                                            <label>Impact Description</label>
                                            <input
                                                required
                                                type="text"
                                                className={styles.input}
                                                placeholder="Explain what this permission allows..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                        </div>
                                        <label className={styles.checkboxWrap}>
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            />
                                            <span>Enforce Permission Immediately</span>
                                        </label>
                                    </div>
                                    <div className={styles.modalFooter}>
                                        <KitchenButton variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                                            Cancel
                                        </KitchenButton>
                                        <KitchenButton type="submit">
                                            <Save size={16} style={{ marginRight: '6px' }} />
                                            {editingPermission ? 'Update Directive' : 'Register Permission'}
                                        </KitchenButton>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div >
    );
}

