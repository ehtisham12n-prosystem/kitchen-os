/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import {
    Search, 
    CheckCircle2, 
    Building2, Save, Loader2, ShieldCheck, Globe,
    Plus, Eye, Pencil, Trash2, Shield,
    CheckSquare, XCircle, Printer, Download, Upload, 
    RefreshCcw, Undo2, History, Settings2
} from 'lucide-react';
import { roleApi, userApi, setupApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';
import { useModuleActions } from '../../../hooks/useModuleActions';
import styles from './Security.module.css';

// â”€â”€ Icons Helper (Accurate Action-Type Mapping) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getPermissionIcon = (permId: string) => {
    const id = permId.toLowerCase();
    const size = 12;
    if (id.includes('create') || id.includes('add') || id.includes('new')) return <Plus size={size} style={{ color: 'var(--state-active)' }} />; 
    if (id.includes('delete') || id.includes('remove') || id.includes('destroy')) return <Trash2 size={size} style={{ color: 'var(--alert-error-text)' }} />;
    if (id.includes('void') || id.includes('cancel') || id.includes('reject') || id.includes('ban')) return <XCircle size={size} style={{ color: 'var(--alert-error-text)' }} />;
    if (id.includes('view') || id.includes('read') || id.includes('list')) return <Eye size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('history') || id.includes('logs') || id.includes('audit')) return <History size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('search') || id.includes('find')) return <Search size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('update') || id.includes('edit') || id.includes('patch') || id.includes('modify')) return <Pencil size={size} style={{ color: 'var(--alert-warning-text)' }} />;
    if (id.includes('config') || id.includes('settings') || id.includes('setup')) return <Settings2 size={size} style={{ color: 'var(--alert-warning-text)' }} />;
    if (id.includes('approve') || id.includes('authorize') || id.includes('confirm') || id.includes('verify')) return <CheckSquare size={size} style={{ color: 'var(--state-active)' }} />;
    if (id.includes('export') || id.includes('download')) return <Download size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('import') || id.includes('upload')) return <Upload size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('sync') || id.includes('refresh') || id.includes('reload')) return <RefreshCcw size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('refund') || id.includes('return') || id.includes('undo')) return <Undo2 size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('print') || id.includes('invoice') || id.includes('receipt') || id.includes('bill')) return <Printer size={size} style={{ color: 'var(--text-muted)' }} />;
    return <Shield size={size} style={{ color: 'var(--accent-primary)' }} />;
};

// â”€â”€ Action String Splitter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const humanizeToken = (value: string) =>
    value
        .split('_')
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const toReadableModuleName = (moduleName: string) => {
    const normalized = moduleName.trim();
    const aliases: Record<string, string> = {
        pos: 'POS orders',
        crm: 'customer records',
        hr: 'staff records',
        coa: 'chart of accounts',
        kds: 'kitchen display',
    };

    return aliases[normalized.toLowerCase()] || normalized;
};

const toPlainScope = (scope: string) => {
    if (scope === 'company') return 'All branches';
    if (scope === 'branch') return 'This branch';
    if (scope === 'own') return 'Own records';
    return humanizeToken(scope || 'access');
};

const toActionLabel = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized === 'view') return 'View';
    if (normalized === 'create') return 'Create';
    if (normalized === 'edit') return 'Edit';
    if (normalized === 'delete') return 'Delete';
    if (normalized === 'approve') return 'Approve';
    if (normalized === 'manage') return 'Full control';
    return humanizeToken(action);
};

const describePermission = (moduleName: string, permissionKey: string, fallbackLabel: string) => {
    const [, rawAction = '', rawScope = ''] = permissionKey.split('.');
    if (!rawAction) {
        return {
            title: fallbackLabel,
            description: `Access ${toReadableModuleName(moduleName).toLowerCase()}.`,
            scopeLabel: 'Access',
            technicalKey: permissionKey,
        };
    }

    const actionLabel = toActionLabel(rawAction);
    const scopeLabel = toPlainScope(rawScope);
    const moduleLabel = toReadableModuleName(moduleName);
    const moduleLabelLower = moduleLabel.toLowerCase();

    const titleByAction: Record<string, string> = {
        view: `See ${moduleLabelLower}`,
        create: `Add ${moduleLabelLower}`,
        edit: `Update ${moduleLabelLower}`,
        delete: `Remove ${moduleLabelLower}`,
        approve: `Approve ${moduleLabelLower}`,
        manage: `Manage ${moduleLabelLower}`,
    };

    const descriptionByAction: Record<string, string> = {
        view: `Can open ${moduleLabelLower} pages and review information.`,
        create: `Can add new ${moduleLabelLower} records.`,
        edit: `Can update existing ${moduleLabelLower} records.`,
        delete: `Can remove ${moduleLabelLower} records.`,
        approve: `Can review and approve ${moduleLabelLower} requests.`,
        manage: `Can fully control ${moduleLabelLower} settings and actions.`,
    };

    return {
        title: titleByAction[rawAction] || `${actionLabel} ${moduleLabelLower}`,
        description: descriptionByAction[rawAction] || `${actionLabel} ${moduleLabelLower}.`,
        scopeLabel,
        technicalKey: permissionKey,
    };
};

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BranchAssignment {
    branchId: number;
    roleIds: number[];
    directPermissions: string[];
    assignmentScope: 'branch' | 'central';
    approvalAuthority: 'none' | 'branch' | 'central' | 'both';
    isPrimary?: boolean;
}

interface PermissionModule {
    module_key: string;
    module_id: string;
    module_name: string;
    description: string;
    recommendedRoles: string[];
    permissionCount: number;
    permissions: Array<{ id: string; name: string }>;
}

interface SecurityRole {
    id: number;
    role_name: string;
    permissions: string | string[];
    context_scope: 'branch' | 'central' | 'hybrid';
}

function ensureArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : [];
}

function ensureStringArray(value: unknown): string[] {
    return ensureArray<unknown>(value).map((item) => String(item)).filter(Boolean);
}

// â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function UserAccessManagement() {
    const { canManageRoles } = usePermissionAccess();
    const userActions = useModuleActions('user', 'company');
    
    // Master Data
    const [users, setUsers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [roles, setRoles] = useState<SecurityRole[]>([]);
    const [permissionRegistry, setPermissionRegistry] = useState<PermissionModule[]>([]);
    
    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'assignment' | 'inspector'>('assignment');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // User Specific State
    const [userAssignments, setUserAssignments] = useState<BranchAssignment[]>([]);
    const [effectivePermissions, setEffectivePermissions] = useState<Record<number, string[]>>({});

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [u, b, r, p] = await Promise.all([
                userApi.getUsers(),
                setupApi.getBranches(),
                roleApi.getRoles(),
                roleApi.getPermissionsRegistry()
            ]);
            const normalizedUsers = ensureArray<any>(u);
            const normalizedBranches = ensureArray<any>(b);
            const normalizedRoles = ensureArray<SecurityRole>(r);
            const normalizedRegistry = ensureArray<any>(p);

            setUsers(normalizedUsers);
            setBranches(normalizedBranches);
            setRoles(normalizedRoles);
            
            // Map legacy to clean structure
            setPermissionRegistry(normalizedRegistry.map((group: any) => ({
                module_key: String(group?.key || group?.label || 'module'),
                module_id: String(group?.label || group?.key || 'Module'),
                module_name: String(group?.label || group?.key || 'Module'),
                description: String(group?.description || `${group?.label || group?.key || 'Module'} access controls`),
                recommendedRoles: ensureStringArray(group?.recommended_roles),
                permissionCount: Number(group?.permission_count || ensureArray<any>(group?.permissions).length),
                permissions: ensureArray<any>(group?.permissions).map((permission: any) => ({
                    id: String(permission?.id || ''),
                    name: String(permission?.label || permission?.id || ''),
                })),
            })).filter((group) => group.permissions.length > 0));

            if (normalizedUsers.length > 0 && !selectedUserId) {
                setSelectedUserId(normalizedUsers[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch security orch data:', err);
            toast.error('Security Error', 'Could not load access data.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedUserId]);

    const fetchUserAccess = useCallback(async (uid: number) => {
        try {
            const [inspection] = await Promise.all([
                userApi.inspectUserAccess(uid)
            ]);
            const inspectionBranches = ensureArray<any>(inspection?.branches);

            // Map assignments
            const assignments: BranchAssignment[] = inspectionBranches.map((b: any) => ({
                branchId: b.branch_id,
                roleIds: Array.isArray(b.role_ids)
                    ? b.role_ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0)
                    : (b.role_id ? [Number(b.role_id)] : []),
                directPermissions: ensureStringArray(b.direct_permissions),
                assignmentScope: b.assignment_scope || 'branch',
                approvalAuthority: b.approval_authority || 'none',
                isPrimary: b.is_primary || false
            }));
            
            setUserAssignments(assignments);
            
            const effective: Record<number, string[]> = {};
            inspectionBranches.forEach((b: any) => {
                effective[b.branch_id] = ensureStringArray(b.effective_permissions);
            });
            setEffectivePermissions(effective);

        } catch (err) {
            console.error('Failed to fetch user access details:', err);
            toast.error('Access Error', 'Could not inspect user permissions.');
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (selectedUserId) {
            void fetchUserAccess(selectedUserId);
        }
    }, [fetchUserAccess, selectedUserId]);

    const handleSave = async () => {
        if (!selectedUserId) return;
        setIsSaving(true);
        try {
            const payload = {
                branchAssignments: userAssignments.map(ba => ({
                    branchId: ba.branchId,
                    roleIds: ba.roleIds,
                    directPermissions: ba.directPermissions,
                    assignmentScope: ba.assignmentScope,
                    approvalAuthority: ba.approvalAuthority,
                    isPrimary: ba.isPrimary
                }))
            };
            await userApi.updateUser(selectedUserId, payload);
            toast.success('Access Updated', 'User access has been saved.');
            fetchUserAccess(selectedUserId);
        } catch (err) {
            console.error('Save error:', err);
            toast.error('Sync Failed', 'Could not update user security profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = ensureArray<any>(users).filter(u => 
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeUser = users.find(u => u.id === selectedUserId);
    const totalPermissionCount = permissionRegistry.reduce((sum, module) => sum + module.permissionCount, 0);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', height: '400px', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* â”€â”€ Elite Command Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1>Security & User Access</h1>
                    <p>Control who can sign in, which branches they can use, and what actions they can perform.</p>
                </div>

                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => fetchUserAccess(selectedUserId!)}>
                        Refresh
                    </KitchenButton>
                    <KitchenButton disabled={isSaving || !(canManageRoles || userActions.manage || userActions.edit)} onClick={handleSave}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} style={{ marginRight: '8px' }} />}
                        Save access
                    </KitchenButton>
                </div>
            </header>

            <section className={styles.summaryStrip}>
                <div className={styles.summaryCardMini}>
                    <span className={styles.summaryLabel}>Users</span>
                    <strong className={styles.summaryValue}>{users.length}</strong>
                    <span className={styles.summaryHint}>People with console access.</span>
                </div>
                <div className={styles.summaryCardMini}>
                    <span className={styles.summaryLabel}>Roles</span>
                    <strong className={styles.summaryValue}>{roles.length}</strong>
                    <span className={styles.summaryHint}>Reusable access profiles.</span>
                </div>
                <div className={styles.summaryCardMini}>
                    <span className={styles.summaryLabel}>Selected User Branches</span>
                    <strong className={styles.summaryValue}>{userAssignments.length}</strong>
                    <span className={styles.summaryHint}>Branches assigned to the selected user.</span>
                </div>
                <div className={styles.summaryCardMini}>
                    <span className={styles.summaryLabel}>Permissions</span>
                    <strong className={styles.summaryValue}>{totalPermissionCount}</strong>
                    <span className={styles.summaryHint}>Available actions in the system.</span>
                </div>
            </section>

            <section className={styles.securityMap}>
                <div className={styles.securityMapItem}>
                    <span className={styles.securityMapStep}>1</span>
                    <div>
                        <strong>Select user</strong>
                        <span>Choose the staff account from the left list.</span>
                    </div>
                </div>
                <div className={styles.securityMapItem}>
                    <span className={styles.securityMapStep}>2</span>
                    <div>
                        <strong>Assign branch access</strong>
                        <span>Set branch, scope, approval level, and roles.</span>
                    </div>
                </div>
                <div className={styles.securityMapItem}>
                    <span className={styles.securityMapStep}>3</span>
                    <div>
                        <strong>Review final access</strong>
                        <span>Check the effective permissions before saving.</span>
                    </div>
                </div>
            </section>

            {/* â”€â”€ Compact ID Strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeUser && (
                <div className={styles.userSummaryArea}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryProfile}>
                            <div className={styles.summaryAvatar}>
                                {activeUser.profile_picture ? (
                                    <img src={activeUser.profile_picture} alt={activeUser.full_name} />
                                ) : (
                                    activeUser.full_name?.charAt(0)
                                )}
                            </div>
                            <div className={styles.summaryInfo}>
                                <h2>{activeUser.full_name}</h2>
                                <span className={styles.loginIdTag}>{activeUser.username || activeUser.email}</span>
                            </div>
                            <span className={`${styles.statusBadge} ${activeUser.status === 'active' ? styles.statusActive : ''}`} style={{ marginLeft: '12px' }}>
                                {activeUser.status}
                            </span>
                        </div>

                        <div className={styles.summaryStats}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Designation</span>
                                <span className={styles.statValue}>{activeUser.designation?.name || 'Not assigned'}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Employee ID</span>
                                <span className={styles.statValue}>{activeUser.employee_id || 'X-000'}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Department</span>
                                <span className={styles.statValue}>{activeUser.department?.name || 'Not assigned'}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Assigned Branches</span>
                                <span className={styles.statValue}>
                                    {userAssignments.length} branches
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.accessLayout}>
                {/* â”€â”€ Command Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <div className={styles.sidebarTitle}>
                            <span>Users</span>
                            <small>{filteredUsers.length} shown</small>
                        </div>
                        <div className={styles.searchBox}>
                            <Search size={16} color="var(--text-muted)" />
                            <input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.userListScroll}>
                        {filteredUsers.map(user => (
                            <div
                                key={user.id}
                                className={`${styles.userItem} ${selectedUserId === user.id ? styles.activeUser : ''}`}
                                onClick={() => setSelectedUserId(user.id)}
                            >
                                <div className={styles.avatar}>
                                    {user.full_name?.charAt(0)}
                                </div>
                                <div className={styles.userDetails}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <h4>{user.full_name}</h4>
                                        <span className={`${styles.dot} ${user.status === 'active' ? styles.dotActive : ''}`} />
                                    </div>
                                    <p>
                                        <span>{user.designation?.name || 'Unit unassigned'}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* â”€â”€ Elite Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <main className={styles.mainContent}>
                    <div className={styles.canvasControls}>
                        <div className={styles.canvasControlInfo}>
                            <span className={styles.canvasLabel}>Access setup</span>
                            <div className={styles.tabContainer}>
                                <button
                                    className={`${styles.tabButton} ${activeTab === 'assignment' ? styles.activeTab : ''}`}
                                    onClick={() => setActiveTab('assignment')}
                                >
                                    <ShieldCheck size={16} />
                                    Assign Branch Access
                                </button>
                                <button
                                    className={`${styles.tabButton} ${activeTab === 'inspector' ? styles.activeTab : ''}`}
                                    onClick={() => setActiveTab('inspector')}
                                >
                                    <Globe size={16} />
                                    Review Final Access
                                </button>
                            </div>
                        </div>

                        <div className={styles.scopeSelector}>
                            <span>Branch view</span>
                            <Building2 size={16} />
                            <select 
                                value={selectedBranchId ?? 'all'} 
                                onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            >
                                <option value="all">All branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.scrollArea}>
                        {activeTab === 'assignment' ? (
                            <OrchestrationView 
                                assignments={userAssignments}
                                registry={permissionRegistry}
                                roles={roles}
                                selectedBranchId={selectedBranchId}
                                branches={branches}
                                onUpdate={setUserAssignments}
                                effective={effectivePermissions}
                                canManageUserAccess={canManageRoles || userActions.manage || userActions.edit}
                            />
                        ) : (
                            <InspectorView 
                                effective={effectivePermissions}
                                registry={permissionRegistry}
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

// â”€â”€ Orchestration View (Elite Command Strip) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OrchestrationView({ 
    assignments, 
    registry, 
    roles, 
    selectedBranchId, 
    branches, 
    onUpdate,
    effective,
    canManageUserAccess,
}: { 
    assignments: BranchAssignment[], 
    registry: PermissionModule[], 
    roles: SecurityRole[], 
    selectedBranchId: number | 'all',
    branches: any[],
    onUpdate: (a: BranchAssignment[]) => void,
    effective: Record<number, string[]>,
    canManageUserAccess: boolean,
}) {
    const [searchTerm, setSearchTerm] = useState('');

    const activeAssignments = selectedBranchId === 'all' 
        ? assignments 
        : assignments.filter(a => a.branchId === selectedBranchId);

    const handleTogglePerm = (branchId: number, perm: string) => {
        const next = assignments.map(a => {
            if (a.branchId !== branchId) return a;
            const has = a.directPermissions.includes(perm);
            return {
                ...a,
                directPermissions: has ? a.directPermissions.filter(p => p !== perm) : [...a.directPermissions, perm]
            };
        });
        onUpdate(next);
    };

    const handleSetRoles = (branchId: number, roleIds: number[]) => {
        const next = assignments.map(a => {
            if (a.branchId !== branchId) return a;
            return { ...a, roleIds };
        });
        onUpdate(next);
    };

    const handleSetScope = (branchId: number, scope: 'branch' | 'central') => {
        const next = assignments.map(a => {
            if (a.branchId !== branchId) return a;
            return { ...a, assignmentScope: scope };
        });
        onUpdate(next);
    };

    const handleSetApproval = (branchId: number, auth: 'none' | 'branch' | 'central' | 'both') => {
        const next = assignments.map(a => {
            if (a.branchId !== branchId) return a;
            return { ...a, approvalAuthority: auth };
        });
        onUpdate(next);
    };

    const handleSetPrimary = (branchId: number) => {
        const next = assignments.map(a => ({
            ...a,
            isPrimary: a.branchId === branchId
        }));
        onUpdate(next);
    };

    const handleAddBranch = (branchId: number) => {
        if (assignments.some(a => a.branchId === branchId)) return;
        const newBA: BranchAssignment = {
            branchId,
            roleIds: [],
            directPermissions: [],
            assignmentScope: 'branch',
            approvalAuthority: 'none',
            isPrimary: assignments.length === 0
        };
        onUpdate([...assignments, newBA]);
    };

    if (selectedBranchId === 'all' && assignments.length === 0) {
        return (
            <div className={styles.emptyStateCanvas}>
                <ShieldCheck size={64} style={{ marginBottom: '16px' }} />
                <h3>No branch assignments</h3>
                <p>Select a branch to start assigning roles and permissions.</p>
            </div>
        );
    }

    return (
        <>
            {activeAssignments.map(ba => {
                const bInfo = branches.find(b => b.id === ba.branchId);
                
                return (
                    <div key={ba.branchId} className={styles.assignmentBlock}>
                        {/* Elite Block Header with Command Strip */}
                        <div className={styles.blockHeader}>
                            <div className={styles.blockTitleRow}>
                                <div>
                                    <span className={styles.sectionEyebrow}>Branch access</span>
                                    <h3>{bInfo?.branch_name}</h3>
                                </div>
                                {ba.isPrimary ? (
                                    <span className={styles.primaryBadge}>Primary branch</span>
                                ) : (
                                    <button className={styles.makePrimaryBtn} onClick={() => handleSetPrimary(ba.branchId)}>
                                        Set primary
                                    </button>
                                )}
                            </div>

                            <div className={styles.governanceControls}>
                                <div className={styles.govGroup}>
                                    <label className={styles.govLabel}>Access scope</label>
                                    <select 
                                        value={ba.assignmentScope} 
                                        onChange={(e) => handleSetScope(ba.branchId, e.target.value as 'branch' | 'central')}
                                    >
                                        <option value="branch">Branch</option>
                                        <option value="central">Company</option>
                                    </select>
                                </div>
                                <div className={styles.govGroup}>
                                    <label className={styles.govLabel}>Approval authority</label>
                                    <select 
                                        value={ba.approvalAuthority} 
                                        onChange={(e) => handleSetApproval(ba.branchId, e.target.value as any)}
                                    >
                                        <option value="none">No approval</option>
                                        <option value="branch">Branch approval</option>
                                        <option value="central">Company approval</option>
                                        <option value="both">Branch and company</option>
                                    </select>
                                </div>
                                <div className={styles.govGroup}>
                                    <label className={styles.govLabel}>Assigned roles</label>
                                    <div className={styles.roleCheckboxGrid}>
                                        {roles.map(r => {
                                            const isChecked = ba.roleIds.includes(r.id);
                                            return (
                                                <label key={r.id} className={styles.roleCheckboxItem}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            const next = isChecked 
                                                                ? ba.roleIds.filter(id => id !== r.id)
                                                                : [...ba.roleIds, r.id];
                                                            handleSetRoles(ba.branchId, next);
                                                        }}
                                                    />
                                                    <span>{r.role_name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.moduleGridContainer}>
                            <div className={styles.sectionHeaderRow}>
                                <div>
                                    <span className={styles.sectionEyebrow}>Direct permission overrides</span>
                                    <h4>Extra access for this branch</h4>
                                </div>
                                <span className={styles.sectionCount}>{ba.directPermissions.length} direct</span>
                            </div>
                            <div className={styles.moduleSearch}>
                                <Search size={14} color="var(--text-muted)" />
                                <input 
                                    placeholder="Filter permissions..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className={styles.moduleGrid}>
                                {registry.map((mod) => {
                                    const filteredPerms = mod.permissions.filter(p => 
                                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        p.id.toLowerCase().includes(searchTerm.toLowerCase())
                                    );
                                    if (filteredPerms.length === 0) return null;

                                    return (
                                        <div key={mod.module_id} className={styles.moduleCard}>
                                            <div className={styles.cardHeader}>
                                                <div className={styles.moduleHeaderContent}>
                                                    <div className={styles.moduleTitleRow}>
                                                        <h4>{mod.module_name}</h4>
                                                        <span className={styles.moduleCountBadge}>{mod.permissionCount}</span>
                                                    </div>
                                                    <span className={styles.moduleKeyBadge}>{mod.module_key}</span>
                                                    <p className={styles.permModuleDescription}>{mod.description}</p>
                                                    {mod.recommendedRoles.length > 0 && (
                                                        <div className={styles.recommendedRoleRow}>
                                                            <span className={styles.recommendedRoleLabel}>Common roles</span>
                                                            <div className={styles.recommendedRoleList}>
                                                                {mod.recommendedRoles.map((roleName) => (
                                                                    <span key={roleName} className={styles.recommendedRoleChip}>{roleName}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={styles.cardBody}>
                                                {filteredPerms.map(perm => {
                                                    const isDirect = ba.directPermissions.includes(perm.id);
                                                    const isInherited = (effective[ba.branchId] || []).includes(perm.id) && !isDirect;
                                                    const permissionState = describePermission(mod.module_name, perm.id, perm.name);
                                                    
                                                    return (
                                                        <div 
                                                            key={perm.id} 
                                                            className={`${styles.permItem} ${isInherited ? styles.inherited : ''}`}
                                                            title={perm.id}
                                                            onClick={() => !isInherited && handleTogglePerm(ba.branchId, perm.id)}
                                                        >
                                                            <div className={styles.permLabel}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isDirect || isInherited} 
                                                                    disabled={isInherited}
                                                                    readOnly
                                                                />
                                                                <div className={styles.permTextStack}>
                                                                    <span>{permissionState.title}</span>
                                                                    <span className={styles.permDescription}>{permissionState.description}</span>
                                                                    <span className={styles.permissionSlug}>System key: {permissionState.technicalKey}</span>
                                                                </div>
                                                            </div>
                                                            <div className={styles.permActionWrap}>
                                                                <span className={styles.scopeLabel}>Applies to</span>
                                                                <span className={styles.scopeBadge}>{permissionState.scopeLabel}</span>
                                                                <span className={styles.permActionIcon}>
                                                                    {getPermissionIcon(perm.id)}
                                                                </span>
                                                                {isInherited && <div className={styles.originBadge} title="Inherited from Template" />}
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
                    </div>
                );
            })}
            
            {selectedBranchId !== 'all' && activeAssignments.length === 0 && (
                <div className={styles.establishmentCanvas}>
                    <p>No assignment exists for the selected branch.</p>
                    <KitchenButton disabled={!canManageUserAccess} onClick={() => handleAddBranch(Number(selectedBranchId))}>
                        Add branch assignment
                    </KitchenButton>
                </div>
            )}
        </>
    );
}

function InspectorView({ 
    effective, 
    registry, 
    selectedBranchId 
}: { 
    effective: Record<number, string[]>, 
    registry: PermissionModule[],
    branches: any[],
    selectedBranchId: number | 'all'
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const activeEffective = selectedBranchId === 'all' 
        ? Object.values(effective).flat() 
        : (effective[Number(selectedBranchId)] || []);
    
    const uniqueEffective = [...new Set(activeEffective)];

    return (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className={styles.moduleSearch} style={{ maxWidth: '350px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input 
                    placeholder="Search effective permissions..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

                            <div className={styles.inspectorGrid}>
                                {registry.map(mod => {
                    const modPerms = mod.permissions.filter(p => 
                        uniqueEffective.includes(p.id) && 
                        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase()))
                    );
                    if (modPerms.length === 0) return null;
                    
                    return (
                                        <div key={mod.module_id} className={styles.inspectorCard}>
                                            <div className={styles.cardHeader} style={{ background: 'none', padding: 0, border: 'none', marginBottom: '12px' }}>
                                                <div className={styles.moduleHeaderContent}>
                                                    <div className={styles.moduleTitleRow}>
                                                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-heading)' }}>{mod.module_name}</h4>
                                                        <span className={styles.badge}>{modPerms.length} Active</span>
                                                    </div>
                                                    <span className={styles.moduleKeyBadge}>{mod.module_key}</span>
                                                    <p className={styles.permModuleDescription}>{mod.description}</p>
                                                </div>
                                            </div>
                                <div className={styles.cardBody} style={{ padding: 0 }}>
                                  {modPerms.map(p => (
                                      <div key={p.id} className={styles.effectiveItem}>
                                          <CheckCircle2 size={12} color="var(--state-active)" />
                                          <div className={styles.permTextStack}>
                                            <span>{describePermission(mod.module_name, p.id, p.name).title}</span>
                                            <span className={styles.permDescription}>{describePermission(mod.module_name, p.id, p.name).description}</span>
                                            <span className={styles.permissionSlug}>System key: {describePermission(mod.module_name, p.id, p.name).technicalKey}</span>
                                          </div>
                                      </div>
                                  ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

