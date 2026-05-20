/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { 
    Plus, Shield, Loader2, Trash2, X, 
    Save, Search, ShieldCheck, Pencil, Eye, Settings2, CheckSquare, 
    XCircle, Printer, Download, Upload, RefreshCcw, Undo2, History
} from 'lucide-react';
import { roleApi, userApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { useModuleActions } from '../../hooks/useModuleActions';
import styles from './RoleManagement.module.css';

// ── Icons Helper (Improved colors for ultra density) ──────────────────────────
const getPermissionIcon = (permId: string) => {
    const id = permId.toLowerCase();
    const size = 12;
    if (id.includes('create') || id.includes('add') || id.includes('new')) return <Plus size={size} className={styles.permSuccess} />; 
    if (id.includes('delete') || id.includes('remove') || id.includes('destroy')) return <Trash2 size={size} className={styles.permDanger} />;
    if (id.includes('void') || id.includes('cancel') || id.includes('reject') || id.includes('ban')) return <XCircle size={size} className={styles.permDanger} />;
    if (id.includes('view') || id.includes('read') || id.includes('list')) return <Eye size={size} className={styles.permInfo} />;
    if (id.includes('history') || id.includes('logs') || id.includes('audit')) return <History size={size} className={styles.permInfo} />;
    if (id.includes('search') || id.includes('find')) return <Search size={size} className={styles.permInfo} />;
    if (id.includes('update') || id.includes('edit') || id.includes('patch') || id.includes('modify')) return <Pencil size={size} className={styles.permWarning} />;
    if (id.includes('config') || id.includes('settings') || id.includes('setup')) return <Settings2 size={size} className={styles.permWarning} />;
    if (id.includes('approve') || id.includes('authorize') || id.includes('confirm') || id.includes('verify')) return <CheckSquare size={size} className={styles.permSuccess} />;
    if (id.includes('export') || id.includes('download')) return <Download size={size} className={styles.permSecondary} />;
    if (id.includes('import') || id.includes('upload')) return <Upload size={size} className={styles.permSecondary} />;
    if (id.includes('sync') || id.includes('refresh') || id.includes('reload')) return <RefreshCcw size={size} className={styles.permSecondary} />;
    if (id.includes('refund') || id.includes('return') || id.includes('undo')) return <Undo2 size={size} className={styles.permSecondary} />;
    if (id.includes('print') || id.includes('invoice') || id.includes('receipt') || id.includes('bill')) return <Printer size={size} className={styles.permSecondary} />;
    return <Shield size={size} className={styles.permInfo} />;
};

const humanizeToken = (value: string) =>
    value
        .split('_')
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const describePermission = (moduleName: string, permissionKey: string, fallbackLabel: string) => {
    const [, rawAction = '', rawScope = ''] = permissionKey.split('.');
    const actionLabel = humanizeToken(rawAction || 'access');
    const scopeLabel = rawScope === 'company' ? 'All' : rawScope === 'branch' ? 'Branch' : rawScope === 'own' ? 'Own' : 'Access';
    
    // Semantic color mappings
    let colorClass = styles.permInfo;
    const normalizedAction = rawAction.toLowerCase();
    if (['create', 'add', 'approve', 'confirm', 'verify'].includes(normalizedAction)) colorClass = styles.permSuccess;
    if (['delete', 'remove', 'void', 'ban', 'cancel'].includes(normalizedAction)) colorClass = styles.permDanger;
    if (['edit', 'update', 'modify', 'config', 'setup', 'settings'].includes(normalizedAction)) colorClass = styles.permWarning;
    if (['export', 'import', 'sync', 'print'].includes(normalizedAction)) colorClass = styles.permSecondary;

    return {
        title: fallbackLabel || `${actionLabel} ${moduleName}`,
        actionClassName: colorClass,
        scopeLabel,
        technicalKey: permissionKey,
    };
};

type PermissionModule = {
    module_key: string;
    module_id: string;
    module_name: string;
    description: string;
    recommendedRoles: string[];
    permissionCount: number;
    permissions: Array<{ id: string; name: string }>;
};

function ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return [];
        try {
            const parsed = JSON.parse(trimmed);
            return ensureStringArray(parsed);
        } catch {
            return [trimmed];
        }
    }
    return [];
}

export function RoleManagement() {
    const { canManageRoles } = usePermissionAccess();
    const roleActions = useModuleActions('role', 'company');
    const canAdministerRoles = canManageRoles || roleActions.manage || roleActions.edit || roleActions.create;
    
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRole, setSelectedRole] = useState<any | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'permissions' | 'users'>('permissions');
    const [moduleSearch, setModuleSearch] = useState('');

    const [isCreating, setIsCreating] = useState(false);
    const [newRole, setNewRole] = useState({
        name: '',
        description: '',
        is_active: true,
        context_scope: 'hybrid' as 'branch' | 'central' | 'hybrid',
        approval_authority: 'none' as 'none' | 'branch' | 'central' | 'both',
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rolesData, permissionsData, usersData] = await Promise.all([
                roleApi.getRoles(),
                roleApi.getPermissionsRegistry(),
                userApi.getUsers(),
            ]);
            setRoles(Array.isArray(rolesData) ? rolesData : []);
            setPermissionModules((Array.isArray(permissionsData) ? permissionsData : []).map((group: any) => ({
                module_key: String(group?.key || group?.label || 'module'),
                module_id: String(group?.label || group?.key || 'Module'),
                module_name: String(group?.label || group?.key || 'Module'),
                description: String(group?.description || ''),
                recommendedRoles: ensureStringArray(group?.recommended_roles),
                permissionCount: Number(group?.permission_count || (Array.isArray(group?.permissions) ? group.permissions.length : 0)),
                permissions: (Array.isArray(group?.permissions) ? group.permissions : []).map((p: any) => ({
                    id: String(p?.id || ''),
                    name: String(p?.label || p?.id || ''),
                })),
            })).filter(g => g.permissions.length > 0));
            setUsers(Array.isArray(usersData) ? usersData : []);
            
            if (rolesData.length > 0 && !selectedRole) {
                handleSelectRole(rolesData[0]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedRole]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    const handleSelectRole = (role: any) => {
        setSelectedRole({
            ...role,
            permissions: ensureStringArray(role?.permissions),
            context_scope: role.context_scope || 'hybrid',
            approval_authority: role.approval_authority || 'none'
        });
        setActiveTab('permissions');
    };

    const handleCreateRole = async () => {
        if (!newRole.name.trim()) return;
        setIsSaving(true);
        try {
            await roleApi.createRole({ role_name: newRole.name, permissions: [], description: newRole.description, is_active: newRole.is_active, context_scope: newRole.context_scope, approval_authority: newRole.approval_authority });
            setIsCreating(false);
            fetchData();
            toast.success('Role Created', 'New role added.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRole = async () => {
        if (!selectedRole) return;
        setIsSaving(true);
        try {
            await roleApi.updateRole(selectedRole.id, { role_name: selectedRole.role_name, description: selectedRole.description, is_active: selectedRole.is_active, permissions: selectedRole.permissions, context_scope: selectedRole.context_scope, approval_authority: selectedRole.approval_authority });
            toast.success('Saved', 'Role updated successfully.');
            fetchData();
        } finally {
            setIsSaving(false);
        }
    };

    const togglePermission = (permId: string) => {
        if (!selectedRole || selectedRole.is_system_role) return;
        const perms = selectedRole.permissions.includes(permId)
            ? selectedRole.permissions.filter((p: string) => p !== permId)
            : [...selectedRole.permissions, permId];
        setSelectedRole({ ...selectedRole, permissions: perms });
    };

    const handleToggleModule = (moduleId: string, isAllSelected: boolean) => {
        if (!selectedRole || selectedRole.is_system_role) return;
        const module = permissionModules.find(m => m.module_id === moduleId);
        if (!module) return;
        const modulePermIds = module.permissions.map(p => p.id);
        const nextPerms = new Set(selectedRole.permissions);
        if (isAllSelected) modulePermIds.forEach(id => nextPerms.delete(id));
        else modulePermIds.forEach(id => nextPerms.add(id));
        setSelectedRole({ ...selectedRole, permissions: Array.from(nextPerms) });
    };

    const getUsersForRole = (roleId: number) => {
        return users.filter((u: any) => u.role_id === roleId || u.branchRoles?.some((ar: any) => ar.role_id === roleId));
    };

    if (isLoading && roles.length === 0) return <div className={styles.container}><div className={styles.emptyState}><Loader2 className={styles.spinner} /></div></div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1>Role Management</h1>
                </div>
                <KitchenButton variant={isCreating ? "secondary" : "primary"} onClick={() => setIsCreating(!isCreating)} size="sm" disabled={!canAdministerRoles}>
                    {isCreating ? <X size={14} /> : <Plus size={14} />}
                    <span style={{ marginLeft: '4px' }}>{isCreating ? "Cancel" : "New"}</span>
                </KitchenButton>
            </header>

            <section className={styles.summaryStrip}>
                <div className={styles.summaryCard}>
                    <Shield size={14} color="var(--accent-primary)" />
                    <span className={styles.summaryLabel}>{permissionModules.length} Modules</span>
                </div>
                <div className={styles.summaryCard}>
                    <Settings2 size={14} color="var(--accent-primary)" />
                    <span className={styles.summaryLabel}>{selectedRole?.permissions?.length || 0} Tokens Assigned</span>
                </div>
            </section>

            {isCreating && (
                <div className={styles.creationSection}>
                    <div className={styles.creationForm}>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input className={styles.input} value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Scope</label>
                            <select className={styles.select} value={newRole.context_scope} onChange={e => setNewRole({ ...newRole, context_scope: e.target.value as any })}>
                                <option value="hybrid">Mixed</option>
                                <option value="branch">Branch</option>
                                <option value="central">Central</option>
                            </select>
                        </div>
                        <KitchenButton size="sm" onClick={handleCreateRole} disabled={isSaving || !newRole.name.trim()}>Create</KitchenButton>
                    </div>
                </div>
            )}

            <main className={styles.mainGrid}>
                <aside className={styles.leftSidebar}>
                    {roles.map(role => (
                        <div key={role.id} className={`${styles.roleItem} ${selectedRole?.id === role.id ? styles.roleItemActive : ''}`} onClick={() => handleSelectRole(role)}>
                            <div className={styles.roleInfo}>
                                <div className={styles.roleName}>{role.role_name}</div>
                                <div className={styles.roleMeta}>{getUsersForRole(role.id).length} Users • {ensureStringArray(role.permissions).length} Perms</div>
                            </div>
                            {role.is_system_role && <ShieldCheck size={12} color="var(--accent-primary)" />}
                        </div>
                    ))}
                </aside>

                <section className={styles.rightContent}>
                    {selectedRole && (
                        <>
                            <div className={styles.tabs}>
                                <button className={`${styles.tab} ${activeTab === 'permissions' ? styles.activeTab : ''}`} onClick={() => setActiveTab('permissions')}>Permissions</button>
                                <button className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`} onClick={() => setActiveTab('users')}>Users</button>
                            </div>

                            {activeTab === 'permissions' ? (
                                <div className={styles.permissionContent}>
                                    <div className={styles.governanceStrip}>
                                        <div className={styles.govGroup}>
                                            <label className={styles.govLabel}>Name</label>
                                            <input className={styles.input} value={selectedRole.role_name} onChange={e => setSelectedRole({...selectedRole, role_name: e.target.value})} disabled={selectedRole.is_system_role} />
                                        </div>
                                        <div className={styles.govGroup}>
                                            <label className={styles.govLabel}>Scope</label>
                                            <select className={styles.select} value={selectedRole.context_scope} onChange={e => setSelectedRole({...selectedRole, context_scope: e.target.value})} disabled={selectedRole.is_system_role}>
                                                <option value="hybrid">Mixed</option>
                                                <option value="branch">Branch</option>
                                                <option value="central">Central</option>
                                            </select>
                                        </div>
                                        {!selectedRole.is_system_role && (
                                            <KitchenButton size="sm" onClick={handleSaveRole} disabled={isSaving || !canAdministerRoles} style={{ marginLeft: 'auto' }}>
                                                {isSaving ? <Loader2 size={14} className={styles.spinner} /> : <Save size={14} />}
                                            </KitchenButton>
                                        )}
                                    </div>

                                    <div className={styles.moduleToolbar}>
                                        <div className={styles.moduleToolbarSummary}><strong>{permissionModules.length}</strong> Modules Available</div>
                                        <div className={styles.moduleToolbarSearch}>
                                            <Search size={12} />
                                            <input value={moduleSearch} onChange={e => setModuleSearch(e.target.value)} placeholder="Filter perms..." />
                                        </div>
                                    </div>

                                    <div className={styles.permissionModules}>
                                        {permissionModules.filter(m => !moduleSearch || m.module_name.toLowerCase().includes(moduleSearch.toLowerCase())).map(module => {
                                            const modulePermIds = module.permissions.map(p => p.id);
                                            const allAssigned = modulePermIds.every(id => selectedRole.permissions.includes(id));
                                            return (
                                                <div key={module.module_id} className={styles.permModuleBox}>
                                                    <div className={styles.permModuleHeader}>
                                                        <h3>{module.module_name}</h3>
                                                        <input type="checkbox" checked={allAssigned} onChange={() => handleToggleModule(module.module_id, allAssigned)} disabled={selectedRole.is_system_role} />
                                                    </div>
                                                    <div className={styles.permGrid}>
                                                        {module.permissions.map(perm => {
                                                            const pDesc = describePermission(module.module_name, perm.id, perm.name);
                                                            return (
                                                                <div key={perm.id} className={styles.permItem} onClick={() => togglePermission(perm.id)}>
                                                                    <div className={styles.permTextStack}>
                                                                        <div className={`${styles.permLabelText} ${pDesc.actionClassName}`}>
                                                                            {getPermissionIcon(perm.id)}
                                                                            <span style={{marginLeft: '4px'}}>{pDesc.title}</span>
                                                                        </div>
                                                                        <div className={styles.permDescription}>{perm.id}</div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span className={styles.scopeBadge}>{pDesc.scopeLabel}</span>
                                                                        <input type="checkbox" checked={selectedRole.permissions.includes(perm.id)} readOnly disabled={selectedRole.is_system_role} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.userList}>
                                    <div className={styles.userTableContainer}>
                                        <table className={styles.userTable}>
                                            <thead>
                                                <tr><th>User</th><th>EMPID</th><th>Branch</th></tr>
                                            </thead>
                                            <tbody>
                                                {getUsersForRole(selectedRole.id).map((user: any) => (
                                                    <tr key={user.id}>
                                                        <td><strong>{user.full_name || user.user_name}</strong><br/><small>{user.email}</small></td>
                                                        <td><code>{user.employee_id}</code></td>
                                                        <td><span className={styles.scopeBadge}>{user.branchRoles?.map((br: any) => br.branch?.branch_name).join(', ') || 'Central'}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
