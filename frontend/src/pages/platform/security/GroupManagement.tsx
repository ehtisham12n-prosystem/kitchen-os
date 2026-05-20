import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus,
    Users,
    Shield,
    Edit2,
    Trash2,
    Activity,
    Search,
    History,
    UserCheck,
    Clock,
    X,
    Save,
    ArrowRight,
    CheckCircle2,
    Cpu,
    Filter,
    ShieldCheck,
    Layers
} from 'lucide-react';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { systemGroupApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';
import styles from './GroupManagement.module.css';

interface PermissionGroup {
    id: string;
    group_name: string;
    description: string;
    is_system_default: boolean;
    is_active: boolean;
    permission_count: number;
    assigned_permissions: string[]; // List of permission keys
    scope: string;
    is_template: boolean;
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
}

interface Permission {
    id: string;
    permission_key: string;
    permission_name: string;
    module_name: string;
    description: string;
}

const ALL_PERMISSIONS: Permission[] = [
    { id: '1', permission_key: 'CLIENT_VIEW', permission_name: 'View Clients', module_name: 'Clients', description: 'Can view client list and details' },
    { id: '2', permission_key: 'CLIENT_CREATE', permission_name: 'Create Client', module_name: 'Clients', description: 'Can add new clients to platform' },
    { id: '3', permission_key: 'USER_VIEW', permission_name: 'View Users', module_name: 'Users', description: 'Can view system users' },
    { id: '4', permission_key: 'THEME_MANAGE', permission_name: 'Manage Themes', module_name: 'Settings', description: 'Can create and edit themes' },
    { id: '5', permission_key: 'SUBSCRIPTION_MANAGE', permission_name: 'Manage Subscriptions', module_name: 'Billing', description: 'Can manage client plans' },
    { id: '6', permission_key: 'SYSTEM_AUDIT', permission_name: 'Audit Logs', module_name: 'Security', description: 'Can access system-wide audit records' },
    { id: '7', permission_key: 'INFRA_MONITOR', permission_name: 'Infrastructure Monitor', module_name: 'SysOps', description: 'Can access real-time health metrics' },
    { id: '8', permission_key: 'CONFIG_EDIT', permission_name: 'Modify System Config', module_name: 'Settings', description: 'Change global platform parameters' },
    { id: '9', permission_key: 'REPORT_EXPORT', permission_name: 'Export Data', module_name: 'Analytics', description: 'Download CSV/PDF reports' },
];

export function GroupManagement() {
    const navigate = useNavigate();
    const location = useLocation();
    const isNexus = location.pathname.includes('/nexus');

    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState<PermissionGroup[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
    const [assignmentGroup, setAssignmentGroup] = useState<PermissionGroup | null>(null);

    const fetchGroups = async () => {
        try {
            const data = await systemGroupApi.getGroups();
            setGroups(data.map((g: any) => ({
                id: g.id,
                group_name: g.name,
                description: g.description,
                is_system_default: g.is_system_default,
                is_active: g.is_active,
                permission_count: g.permissions?.length || 0,
                assigned_permissions: g.permissions || [],
                scope: g.scope,
                is_template: g.is_template,
                createdBy: g.created_by || 'system',
                createdAt: g.created_at,
                updatedBy: g.created_by || 'system',
                updatedAt: g.updated_at
            })));
        } catch {
            toast.error('Fetch Failed', 'Could not load permission groups.');
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    // Form state
    const [formData, setFormData] = useState({
        group_name: '',
        description: '',
        is_active: true
    });

    // Assignment state
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);
    const [permSearch, setPermSearch] = useState('');

    const filteredGroups = groups.filter(g =>
        g.group_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpenModal = (group?: PermissionGroup) => {
        if (group) {
            setEditingGroup(group);
            setFormData({
                group_name: group.group_name,
                description: group.description,
                is_active: group.is_active
            });
        } else {
            setEditingGroup(null);
            setFormData({ group_name: '', description: '', is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingGroup) {
                await systemGroupApi.updateGroup(editingGroup.id, {
                    group_name: formData.group_name,
                    description: formData.description,
                    is_active: formData.is_active
                });
                toast.success('Group Updated', 'Changes saved successfully.');
            } else {
                await systemGroupApi.createGroup({
                    group_name: formData.group_name,
                    description: formData.description,
                    is_active: formData.is_active,
                    permissions: [],
                    scope: 'nexus'
                });
                toast.success('Group Created', 'New security group added.');
            }
            setIsModalOpen(false);
            fetchGroups();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Error saving group.');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this permission group?')) {
            try {
                await systemGroupApi.deleteGroup(id);
                toast.success('Group Deleted', 'Security group removed.');
                fetchGroups();
            } catch (error: any) {
                toast.error('Delete Failed', error.message || 'Error deleting group.');
            }
        }
    };

    const handleOpenAssignment = (group: PermissionGroup) => {
        setAssignmentGroup(group);
        setTempPermissions([...group.assigned_permissions]);
        setPermSearch('');
    };

    const togglePermission = (key: string) => {
        setTempPermissions(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSaveAssignment = async () => {
        if (!assignmentGroup) return;

        try {
            await systemGroupApi.updateGroup(assignmentGroup.id, {
                permissions: tempPermissions
            });
            toast.success('Permissions Updated', 'Group directives synchronized.');
            setAssignmentGroup(null);
            fetchGroups();
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Error updating permissions.');
        }
    };

    const handleAuditTrail = () => {
        if (isNexus) {
            navigate('/nexus/audit-logs');
        } else {
            // For client portal, path is usually /console/admin/audit-logs
            navigate('/console/admin/audit-logs');
        }
    };

    // Group permissions by module for the assignment modal
    const groupedPermissions = useMemo(() => {
        const filtered = ALL_PERMISSIONS.filter(p =>
            p.permission_name.toLowerCase().includes(permSearch.toLowerCase()) ||
            p.permission_key.toLowerCase().includes(permSearch.toLowerCase()) ||
            p.module_name.toLowerCase().includes(permSearch.toLowerCase())
        );

        return filtered.reduce((acc, p) => {
            if (!acc[p.module_name]) acc[p.module_name] = [];
            acc[p.module_name].push(p);
            return acc;
        }, {} as Record<string, Permission[]>);
    }, [permSearch]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Permission Groups</h1>
                    <p className={styles.subtitle}>Encapsulate granular permissions into reusable security roles and policies.</p>
                </div>
                <div className={styles.actions}>
                    <KitchenButton variant="secondary" onClick={handleAuditTrail}>
                        <Activity size={18} /> Audit Trail
                    </KitchenButton>
                    <KitchenButton onClick={() => handleOpenModal()}>
                        <Plus size={18} /> New Group
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                {/* Global Groups */}
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                <Shield size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Global Groups</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{groups.length}</div>
                    <div className={styles.kpiMeta}>
                        <span>Primary security clusters</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Active Status */}
                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                <Activity size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Active Status</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{groups.filter(g => g.is_active).length}</div>
                    <div className={styles.kpiMeta}>
                        <span>Operational entity sets</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '92%' }} />
                    </div>
                </div>

                {/* System Default */}
                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                                <Cpu size={18} />
                            </div>
                            <div className={styles.kpiLabel}>System Default</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{groups.filter(g => g.is_system_default).length}</div>
                    <div className={styles.kpiMeta}>
                        <span>Immutable core profiles</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Total Capacity */}
                <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                                <Users size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Registry Size</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{ALL_PERMISSIONS.length}</div>
                    <div className={styles.kpiMeta}>
                        <span>Atomic security directives</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <Search className={styles.searchIcon} size={18} />
                    <input
                        type="text"
                        placeholder="Search groups or descriptions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
            </div>

            <div className={styles.grid}>
                {filteredGroups.map(group => (
                    <div key={group.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {group.is_system_default && (
                                        <span className={styles.systemBadge}>
                                            <Shield size={10} /> System
                                        </span>
                                    )}
                                    <span className={styles.cardCode}>GRP-{group.id.toUpperCase().slice(0, 4)}</span>
                                </div>
                                <h3 className={styles.cardTitle}>{group.group_name}</h3>
                            </div>
                            <div className={styles.cardActions}>
                                <button className={styles.iconBtn} onClick={() => handleOpenModal(group)}>
                                    <Edit2 size={16} />
                                </button>
                                {!group.is_system_default && (
                                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(group.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className={styles.cardBody}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px 0', minHeight: '36px' }}>
                                {group.description}
                            </p>

                            <button
                                className={styles.detailRowBtn}
                                onClick={() => handleOpenAssignment(group)}
                                title="Define granular permissions"
                            >
                                <ShieldCheck size={14} color="var(--accent-tertiary)" />
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{group.permission_count} Atomic Permissions</span>
                                <ArrowRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                            </button>

                            <div className={styles.auditSection}>
                                <div className={styles.auditRow}>
                                    <div className={styles.auditItem}>
                                        <History size={12} />
                                        <span>Created: <strong>{group.createdBy}</strong></span>
                                    </div>
                                    <div className={styles.auditItem}>
                                        <Clock size={12} />
                                        <span>{new Date(group.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className={styles.auditRow}>
                                    <div className={styles.auditItem}>
                                        <UserCheck size={12} />
                                        <span>Updated: <strong>{group.updatedBy}</strong></span>
                                    </div>
                                    <div className={styles.auditItem}>
                                        <Clock size={12} />
                                        <span>{new Date(group.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`${styles.badge} ${group.is_active ? styles.active : styles.inactive}`}>
                                {group.is_active ? 'Active' : 'Deactivated'}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <KitchenButton variant="ghost" size="sm" style={{ padding: '4px 12px', height: 'auto', fontSize: '12px', gap: '6px' }}>
                                    <Users size={14} /> Members
                                </KitchenButton>
                                <KitchenButton variant="ghost" size="sm" style={{ padding: '4px 8px', height: 'auto' }}>
                                    <ArrowRight size={14} />
                                </KitchenButton>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className={styles.modalIconBox}>
                                    <Users size={20} color="var(--accent-primary)" />
                                </div>
                                <h2>{editingGroup ? 'Edit Group Policy' : 'New Security Cluster'}</h2>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className={styles.modalBody}>
                                <div className={styles.formField}>
                                    <label>Group Designation</label>
                                    <input
                                        required
                                        type="text"
                                        className={styles.input}
                                        placeholder="e.g. Infrastructure Oversight"
                                        value={formData.group_name}
                                        onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                                    />
                                </div>

                                <div className={styles.formField}>
                                    <label>Administrative Context</label>
                                    <textarea
                                        required
                                        className={`${styles.input} ${styles.textarea}`}
                                        placeholder="Define the scope of this security profile..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>

                                <label className={styles.checkboxWrap}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>Enforce Policy</span>
                                </label>
                            </div>
                            <div className={styles.modalFooter}>
                                <KitchenButton variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                                    Discard
                                </KitchenButton>
                                <KitchenButton type="submit">
                                    <Save size={16} style={{ marginRight: '6px' }} /> Save Changes
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assignment Modal (The Editor) */}
            {assignmentGroup && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.modalLarge}`}>
                        <div className={styles.modalHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className={`${styles.modalIconBox}`} style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'var(--accent-tertiary)' }}>
                                    <ShieldCheck size={20} color="var(--accent-tertiary)" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', margin: 0 }}>Assign Directives</h2>
                                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                                        Configuring: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{assignmentGroup.group_name}</span>
                                    </p>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setAssignmentGroup(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className={styles.searchWrap} style={{ flex: 1, margin: 0 }}>
                                <Search size={14} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Search by key, name or domain..."
                                    className={styles.searchInput}
                                    style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
                                    value={permSearch}
                                    onChange={(e) => setPermSearch(e.target.value)}
                                />
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {tempPermissions.length} / {ALL_PERMISSIONS.length} Selected
                            </div>
                        </div>

                        <div className={styles.modalBody} style={{ padding: '0', maxHeight: '55vh', overflowY: 'auto' }}>
                            {Object.entries(groupedPermissions).length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Filter size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <p>No permissions found matching your search.</p>
                                </div>
                            ) : (
                                Object.entries(groupedPermissions).map(([module, perms]) => (
                                    <div key={module} className={styles.permGroup}>
                                        <div style={{
                                            padding: '12px 24px',
                                            background: 'rgba(255,255,255,0.03)',
                                            fontSize: '11px',
                                            textTransform: 'uppercase',
                                            fontWeight: 800,
                                            letterSpacing: '0.05em',
                                            color: 'var(--accent-secondary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            borderBottom: '1px solid var(--glass-border)'
                                        }}>
                                            <Layers size={12} /> {module}
                                        </div>
                                        <div className={styles.permList}>
                                            {perms.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className={`${styles.permItem} ${tempPermissions.includes(p.permission_key) ? styles.activePermItem : ''}`}
                                                    onClick={() => !assignmentGroup.is_system_default && togglePermission(p.permission_key)}
                                                    style={{ cursor: assignmentGroup.is_system_default ? 'default' : 'pointer' }}
                                                >
                                                    <div className={styles.permInfo}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span className={styles.permName}>{p.permission_name}</span>
                                                            <code className={styles.permKey} style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '4px' }}>{p.permission_key}</code>
                                                        </div>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.description}</span>
                                                    </div>
                                                    <div className={styles.permStatus}>
                                                        {tempPermissions.includes(p.permission_key) ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
                                                                <CheckCircle2 size={18} />
                                                                <span style={{ fontSize: '11px', fontWeight: 800 }}>GRANTED</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--border-color)', opacity: 0.3 }} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            {assignmentGroup.is_system_default && (
                                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)', fontSize: '12px' }}>
                                    <Shield size={14} /> Immutable System Policy
                                </div>
                            )}
                            <KitchenButton variant="secondary" onClick={() => setAssignmentGroup(null)}>
                                Close
                            </KitchenButton>
                            {!assignmentGroup.is_system_default && (
                                <KitchenButton onClick={handleSaveAssignment}>
                                    <CheckCircle2 size={16} style={{ marginRight: '6px' }} /> Update Permissions
                                </KitchenButton>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

