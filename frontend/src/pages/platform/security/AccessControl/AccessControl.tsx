import React, { useState, useMemo, useEffect } from 'react';
import {
    Users,
    Shield,
    Search,
    Plus,
    Trash2,
    X,
    UserPlus,
    Save,
    AlertTriangle,
    ChevronRight,
    Key,
    CheckCircle2,
    ShieldCheck,
    XCircle,
    Calendar,
    Clock,
    FileText,
    Info,
    Smartphone,
    Mail,
    UserCircle,
    LayoutGrid,
    ShoppingCart,
    Boxes,
    Utensils,
    Package,
    Database,
    Activity
} from 'lucide-react';
import styles from './AccessControl.module.css';

// ─── Constants ───────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
    'LayoutGrid': LayoutGrid,
    'ShoppingCart': ShoppingCart,
    'Boxes': Boxes,
    'Smartphone': Smartphone,
    'Utensils': Utensils,
    'Package': Package,
    'Shield': Shield,
    'Database': Database,
    'Key': Key,
    'Activity': Activity
};

// ─── Mock Data Types ─────────────────────────────────────────────────────────

interface Permission {
    id: string;
    name: string;
    description: string;
    action: string;
}

interface ModuleResource {
    id: string;
    name: string;
    icon: any;
    description: string;
    pages: {
        id: string;
        name: string;
        description: string;
        permissions: Permission[];
    }[];
}

interface PermissionGroup {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    createdAt: string;
    lastModified: string;
    userCount: number;
    activeUsers: number;
    permissions: string[]; // List of permission IDs
    is_system_default?: boolean;
    scope?: 'nexus' | 'client' | 'branch';
    is_template?: boolean;
    module_slug?: string | null;
    is_unsaved?: boolean; // Draft group not yet persisted to DB
    users: Array<{
        id: string;
        userId: string;
        name: string;
        email: string;
        designation: string;
        department: string;
        contact: string;
        avatar?: string;
    }>;
}

interface SecuritySessionSummary {
    session_id: string;
    user_id: string;
    username?: string | null;
    user_type: string;
    client_id?: string | null;
    portal: string;
    status: string;
    ip_address?: string | null;
    last_seen_ip?: string | null;
    device_label?: string | null;
    issued_at?: string;
    expires_at?: string;
    last_seen_at?: string | null;
    last_seen_path?: string | null;
    risk_flags?: string[];
}

interface SecurityFailedLogin {
    id: number;
    user_id: string;
    user_type: string;
    ip_address?: string | null;
    user_agent?: string | null;
    tenant_slug?: string | null;
    failure_reason?: string | null;
    created_at: string;
}

interface SecurityAccessLog {
    id: number;
    username?: string | null;
    user_id?: string | null;
    portal: string;
    request_method: string;
    request_path: string;
    status_code: number;
    ip_address?: string | null;
    created_at: string;
}

interface SecurityOverview {
    generated_at: string;
    controls: {
        jwt_expires_in: string;
        session_retention_days: number;
        access_log_retention_days: number;
        auth_audit_retention_days: number;
        ip_capture_enabled: boolean;
        device_capture_enabled: boolean;
        session_revocation_enabled: boolean;
        access_logging_enabled: boolean;
    };
    auth_activity: {
        success_last_24h: number;
        failure_last_24h: number;
        unique_ips_last_24h: number;
    };
    session_activity: {
        active_sessions: number;
        revoked_last_7d: number;
        expiring_soon: number;
        stale_sessions: number;
        ip_changed_sessions: number;
    };
    access_activity: {
        events_last_24h: number;
        denied_last_24h: number;
        nexus_last_24h: number;
    };
    lockout_policy: {
        locked_accounts: number;
        min_lockout_limit: number;
        max_lockout_limit: number;
    };
    audit_activity: {
        warnings_last_7d: number;
        errors_last_7d: number;
    };
    recent_failed_logins: SecurityFailedLogin[];
    active_sessions: SecuritySessionSummary[];
}

import { platformApi, systemGroupApi } from '../../../../api/api';
import { toast } from '../../../../components/ui/KitchenToast/toast';

export const AccessControl: React.FC = () => {
    const [groups, setGroups] = useState<PermissionGroup[]>([]);
    const [modules, setModules] = useState<ModuleResource[]>([]);
    const [allSystemUsers, setAllSystemUsers] = useState<any[]>([]); // Added for member lookup
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'main' | 'member' | 'permissions' | 'policy'>('main');
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [newMemberSearch, setNewMemberSearch] = useState('');
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string }>({});
    const [viewScope, setViewScope] = useState<'system' | 'template'>('system');
    const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null);
    const [securityAccessLogs, setSecurityAccessLogs] = useState<SecurityAccessLog[]>([]);

    const formatDateTime = (value?: string | null) => {
        if (!value) return 'Not recorded';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Not recorded';
        return date.toLocaleString();
    };

    const formatRelative = (value?: string | null) => {
        if (!value) return 'No activity yet';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'No activity yet';
        const diffMs = Date.now() - date.getTime();
        const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    const handleRevokeSession = async (sessionId: string) => {
        if (!confirm('Revoke this active session? The affected user will need to log in again.')) {
            return;
        }

        try {
            await platformApi.revokeSecuritySession(sessionId, 'Revoked from Access Control security view');
            toast.success('Session Revoked', 'The selected session has been terminated.');
            await fetchAll();
        } catch (error: any) {
            toast.error('Revoke Failed', error.message || 'Unable to revoke the selected session.');
        }
    };

    const fetchAll = async () => {
        setIsLoading(true);
        console.log('[AccessControl] Triggering full fetch...');
        try {
            // Using individual awaits to identify which one fails
            let grpData, modData, usersData;
            let securityOverviewData: SecurityOverview | null = null;
            let securityAccessData: SecurityAccessLog[] = [];

            try {
                grpData = await systemGroupApi.getGroups();
                console.log('[AccessControl] Groups loaded:', grpData?.length);
            } catch (e: any) {
                console.error('[AccessControl] systemGroupApi.getGroups failed:', e.message);
                throw new Error(`Groups API: ${e.message}`);
            }

            try {
                // getNexusRegistry() → only nexus_ prefixed modules, no Console modules
                modData = await platformApi.getNexusRegistry();
                console.log('[AccessControl] Nexus Registry loaded:', modData?.length);
            } catch (e: any) {
                console.error('[AccessControl] platformApi.getNexusRegistry failed:', e.message);
                throw new Error(`Registry API: ${e.message}`);
            }

            try {
                usersData = await platformApi.getSystemUsers();
                console.log('[AccessControl] Users loaded:', usersData?.length);
            } catch (e: any) {
                console.error('[AccessControl] platformApi.getSystemUsers failed:', e.message);
                throw new Error(`Users API: ${e.message}`);
            }

            try {
                const [overviewRes, accessRes] = await Promise.all([
                    platformApi.getSecurityOverview(),
                    platformApi.getSecurityAccessLogs({ limit: 8 }),
                ]);
                securityOverviewData = overviewRes as SecurityOverview;
                securityAccessData = Array.isArray((accessRes as any)?.items)
                    ? (accessRes as any).items as SecurityAccessLog[]
                    : [];
            } catch (e: any) {
                console.warn('[AccessControl] Security overview fetch failed:', e.message);
            }

            const groupsArray = Array.isArray(grpData) ? grpData : ((grpData as any)?.Groups || []);
            const modulesArray = Array.isArray(modData) ? modData : ((modData as any)?.Modules || []);

            setGroups(groupsArray.map((g: any) => ({
                id: g.id.toString(),
                name: g.group_name || g.name || 'Unnamed Group',
                description: g.description || '',
                status: g.is_active ? 'active' : 'inactive',
                createdAt: g.created_at || new Date().toISOString(),
                lastModified: g.updated_at || new Date().toISOString(),
                userCount: g.members?.length || g.userCount || 0,
                activeUsers: g.members?.filter((m: any) => m.is_active).length || 0,
                permissions: Array.isArray(g.permissions) ? g.permissions : [],
                is_system_default: g.is_system_default, // Added for UI badge
                scope: g.scope || 'nexus',
                is_template: g.is_template || false,
                module_slug: g.module_slug || null,
                users: (g.members || []).map((m: any) => ({
                    id: m.id.toString(),
                    userId: m.username || m.id.toString(),
                    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username || 'System User',
                    email: m.email || 'N/A',
                    designation: m.designation || 'N/A',
                    department: m.department || 'N/A',
                    contact: m.phone || 'N/A',
                    avatar: (m.first_name?.[0] || m.username?.[0] || 'U').toUpperCase()
                }))
            })));

            // Map modules to ensure icons are components
            setModules(modulesArray.map((m: any) => ({
                ...m,
                id: m.slug || m.id,
                icon: ICON_MAP[m.icon as keyof typeof ICON_MAP] || Shield,
                pages: (m.pages || []).map((p: any) => ({
                    ...p,
                    id: p.slug || p.id,
                    permissions: (p.actions || []).map((act: string) => ({
                        id: `${m.slug || m.id}.${p.slug || p.id}.${act}`,
                        name: act.charAt(0).toUpperCase() + act.slice(1).replace('_', ' '),
                        action: act
                    }))
                }))
            })));

            setAllSystemUsers(Array.isArray(usersData) ? usersData : []);
            setSecurityOverview(securityOverviewData);
            setSecurityAccessLogs(securityAccessData);

        } catch (error: any) {
            console.error('[AccessControl] Fetch Failed Error:', error);
            toast.error('Fetch Failed', error.message || 'Communication with Nexus Vault failed. Please verify API status.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const filteredGroups = useMemo(() =>
        groups
            .filter(g => {
                const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
                if (viewScope === 'system') {
                    return matchesSearch && g.scope === 'nexus';
                } else {
                    return matchesSearch && g.is_template;
                }
            })
            .sort((a, b) => {
                // Drafts always on top
                if (a.is_unsaved && !b.is_unsaved) return -1;
                if (!a.is_unsaved && b.is_unsaved) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }),
        [groups, searchTerm, viewScope]
    );

    const hasDraftGroup = useMemo(() => groups.some(g => g.is_unsaved), [groups]);

    const selectedGroup = useMemo(() =>
        groups.find(g => g.id === selectedGroupId) || null,
        [groups, selectedGroupId]
    );

    const filteredMembers = useMemo(() => {
        if (!selectedGroup) return [];
        return selectedGroup.users.filter(u =>
            u.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
            u.userId.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(memberSearchTerm.toLowerCase())
        );
    }, [selectedGroup, memberSearchTerm]);

    const availableToPick: any[] = useMemo(() => {
        if (!selectedGroup) return [];
        const existingUserIds = new Set(selectedGroup.users.map(u => u.id));
        return allSystemUsers
            .filter(u => !existingUserIds.has(u.id.toString()))
            .filter(u =>
                u.username?.toLowerCase().includes(newMemberSearch.toLowerCase()) ||
                u.email?.toLowerCase().includes(newMemberSearch.toLowerCase()) ||
                `${u.first_name} ${u.last_name}`.toLowerCase().includes(newMemberSearch.toLowerCase())
            )
            .map(u => ({
                id: u.id.toString(),
                userId: u.username || u.id.toString(),
                name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'System User',
                email: u.email || 'N/A',
                designation: u.designation || 'N/A',
                department: u.department || 'N/A',
                contact: u.phone || 'N/A',
                avatar: (u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()
            }));
    }, [selectedGroup, allSystemUsers, newMemberSearch]);

    // Handlers
    const handleSelectGroup = (id: string) => {
        // Block switching while a draft is open
        if (hasDraftGroup && selectedGroup?.is_unsaved) {
            toast.error('Draft Active', 'Please create or cancel the new group before switching.');
            return;
        }
        if (unsavedChanges) {
            if (confirm('You have unsaved changes. Do you want to discard them and switch?')) {
                setSelectedGroupId(id);
                setUnsavedChanges(false);
            }
        } else {
            setSelectedGroupId(id);
        }
    };

    const handleInitNewGroup = () => {
        if (hasDraftGroup) return; // Only one draft at a time
        const tempId = `draft-${Date.now()}`;
        const draftGroup: PermissionGroup = {
            id: tempId,
            name: '',
            description: '',
            status: 'active',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            userCount: 0,
            activeUsers: 0,
            permissions: [],
            is_system_default: false,
            scope: viewScope === 'system' ? 'nexus' : 'client',
            is_template: viewScope === 'template',
            module_slug: null,
            is_unsaved: true,
            users: []
        };
        setGroups(prev => [draftGroup, ...prev]);
        setSelectedGroupId(tempId);
        setActiveTab('main');
        setUnsavedChanges(false);
        setFieldErrors({});
    };

    const handleCancelDraft = () => {
        setGroups(prev => prev.filter(g => !g.is_unsaved));
        setSelectedGroupId(null);
        setUnsavedChanges(false);
        setFieldErrors({});
    };

    const handlePersistNewGroup = async () => {
        if (!selectedGroup || !selectedGroup.is_unsaved) return;
        const errors: { name?: string; description?: string } = {};
        if (!selectedGroup.name.trim()) errors.name = 'Group name is required';
        if (!selectedGroup.description.trim()) errors.description = 'Description is required';
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        try {
            await systemGroupApi.createGroup({
                group_name: selectedGroup.name.trim(),
                description: selectedGroup.description.trim(),
                is_active: selectedGroup.status === 'active',
                permissions: selectedGroup.permissions,
                scope: selectedGroup.scope,
                is_template: selectedGroup.is_template,
                module_slug: selectedGroup.module_slug
            });
            await fetchAll();
            setFieldErrors({});
            toast.success('Group Created', 'New permission group added securely.');
        } catch {
            toast.error('Error', 'Failed to create permission group');
        }
    };

    const updateSelectedGroup = (updates: Partial<PermissionGroup>) => {
        if (!selectedGroupId) return;
        setGroups(groups.map(g => g.id === selectedGroupId ? { ...g, ...updates } : g));
        // Clear field errors on change
        if (updates.name !== undefined) setFieldErrors(prev => ({ ...prev, name: undefined }));
        if (updates.description !== undefined) setFieldErrors(prev => ({ ...prev, description: undefined }));
        setUnsavedChanges(true);
    };

    const handleTogglePermission = (permId: string) => {
        if (!selectedGroup) return;
        const current = selectedGroup.permissions;
        const newPerms = current.includes(permId)
            ? current.filter(id => id !== permId)
            : [...current, permId];
        updateSelectedGroup({ permissions: newPerms });
    };

    const handleToggleModule = (moduleId: string, value: boolean) => {
        if (!selectedGroup) return;
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        const modulePermIds = module.pages.flatMap(p => p.permissions.map(perm => perm.id));
        let newPerms = [...selectedGroup.permissions];

        if (value) {
            // Add all
            modulePermIds.forEach(id => {
                if (!newPerms.includes(id)) newPerms.push(id);
            });
        } else {
            // Remove all
            newPerms = newPerms.filter(id => !modulePermIds.includes(id));
        }

        updateSelectedGroup({ permissions: newPerms });
    };

    const handleAddMember = (user: any) => {
        if (!selectedGroup) return;
        const newUsers = [...selectedGroup.users, user];
        updateSelectedGroup({ users: newUsers, userCount: newUsers.length });
        setNewMemberSearch('');
    };

    const handleRemoveMember = (userId: string) => {
        if (!selectedGroup) return;
        const newUsers = selectedGroup.users.filter(u => u.id !== userId);
        updateSelectedGroup({ users: newUsers, userCount: newUsers.length });
    };

    const handleSaveChanges = async () => {
        if (!selectedGroup) return;
        if (selectedGroup.is_unsaved) {
            await handlePersistNewGroup();
            return;
        }
        try {
            await systemGroupApi.updateGroup(selectedGroup.id, {
                group_name: selectedGroup.name,
                description: selectedGroup.description,
                is_active: selectedGroup.status === 'active',
                permissions: selectedGroup.permissions,
                memberIds: selectedGroup.users.map(u => u.id),
                scope: selectedGroup.scope,
                is_template: selectedGroup.is_template,
                module_slug: selectedGroup.module_slug
            });
            setUnsavedChanges(false);
            toast.success('Changes Saved', 'Permission group updated successfully.');
            await fetchAll();
        } catch (error) {
            console.error('Failed to save changes:', error);
            toast.error('Error', 'Failed to save changes.');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.pulseShield}>
                    <Shield size={64} style={{ opacity: 0.3 }} />
                </div>
                <h2>Securing Session...</h2>
                <p>Establishing vault connection to system registries.</p>
            </div>
        );
    }


    return (
        <div className={styles.pageContainer}>
            {/* ─── Sidebar (Master) ─── */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.sidebarTitleRow}>
                        <div className={styles.titleIcon}>
                            <Shield size={20} />
                        </div>
                        <h2>Permission Groups</h2>
                    </div>
                    <button
                        className={styles.createBtn}
                        onClick={handleInitNewGroup}
                        disabled={hasDraftGroup}
                        title={hasDraftGroup ? 'Finish or cancel the current new group first' : 'New Permission Group'}
                        style={{ opacity: hasDraftGroup ? 0.4 : 1, cursor: hasDraftGroup ? 'not-allowed' : 'pointer' }}
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.toggleItem} ${viewScope === 'system' ? styles.toggleActive : ''}`}
                        onClick={() => { setViewScope('system'); setSelectedGroupId(null); }}
                    >
                        Nexus Groups
                    </button>
                    <button
                        className={`${styles.toggleItem} ${viewScope === 'template' ? styles.toggleActive : ''}`}
                        onClick={() => { setViewScope('template'); setSelectedGroupId(null); }}
                    >
                        Templates
                    </button>
                </div>

                <div className={styles.searchContainer}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className={styles.groupList}>
                    {filteredGroups.map(group => (
                        <div
                            key={group.id}
                            className={`${styles.groupItem} ${selectedGroupId === group.id ? styles.activeGroup : ''} ${group.is_system_default ? styles.systemGroup : ''} ${group.is_unsaved ? styles.draftGroup : ''}`}
                            onClick={() => handleSelectGroup(group.id)}
                        >
                            <div className={styles.groupItemContent}>
                                <div className={styles.groupMainInfo}>
                                    <div className={styles.nameRow}>
                                        <span className={styles.groupName}>
                                            {group.is_unsaved ? 'New Group (Unsaved)' : (group.name || 'Unnamed Group')}
                                        </span>
                                        {group.is_unsaved && (
                                            <span className={styles.draftBadge}>Draft</span>
                                        )}
                                        {!group.is_unsaved && group.scope === 'nexus' && (
                                            <span className={styles.systemBadge}>Nexus</span>
                                        )}
                                        {!group.is_unsaved && group.is_template && (
                                            <span className={styles.systemBadge} style={{ background: 'var(--badge-branch-bg)', color: 'var(--accent-primary)' }}>Template</span>
                                        )}
                                    </div>
                                    <div className={styles.groupStatsRows}>
                                        <span className={styles.userCount}>
                                            <Users size={12} className={styles.miniIcon} />
                                            {group.userCount} Users
                                        </span>
                                        <span className={styles.permCount}>
                                            <Key size={12} className={styles.miniIcon} />
                                            {group.permissions.length} Permissions
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight size={16} className={styles.chevron} />
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* ─── Main Content (Detail) ─── */}
            <main className={styles.mainContent}>
                {selectedGroup ? (
                    <div className={styles.detailWrapper}>
                        <header className={styles.detailHeader}>
                            <div className={styles.groupInfoHero}>
                                <div className={styles.heroIcon}>
                                    <Shield size={32} />
                                </div>
                                <div className={styles.heroText}>
                                    <div className={styles.titleRow}>
                                        <h1>{selectedGroup.is_unsaved ? 'New Permission Group' : selectedGroup.name}</h1>
                                        {selectedGroup.is_unsaved ? (
                                            <span className={`${styles.statusBadge} ${styles.statusInactive}`}>
                                                <AlertTriangle size={12} />
                                                Draft
                                            </span>
                                        ) : (
                                            <span className={`${styles.statusBadge} ${selectedGroup.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                                                {selectedGroup.status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {selectedGroup.status}
                                            </span>
                                        )}
                                    </div>
                                    <p>{selectedGroup.description || (selectedGroup.is_unsaved ? 'Fill in the details below to create this group.' : '')}</p>
                                </div>
                            </div>

                            <div className={styles.headerActions}>
                                {selectedGroup.is_unsaved ? (
                                    <>
                                        <button className={styles.cancelBtn} onClick={handleCancelDraft}>
                                            <X size={18} />
                                            <span>Cancel</span>
                                        </button>
                                        <button className={styles.saveBtn} onClick={handlePersistNewGroup}>
                                            <Save size={18} />
                                            <span>Create Group</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {unsavedChanges && (
                                            <div className={styles.unsavedAlert}>
                                                <AlertTriangle size={14} />
                                                <span>Unsaved</span>
                                            </div>
                                        )}
                                        <button
                                            className={styles.saveBtn}
                                            disabled={!unsavedChanges}
                                            onClick={handleSaveChanges}
                                        >
                                            <Save size={18} />
                                            <span>Save Changes</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </header>

                        <nav className={styles.tabs}>
                            <button
                                className={`${styles.tabItem} ${activeTab === 'main' ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab('main')}
                            >
                                Main
                            </button>
                            <button
                                className={`${styles.tabItem} ${activeTab === 'member' ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab('member')}
                            >
                                Member
                            </button>
                            <button
                                className={`${styles.tabItem} ${activeTab === 'permissions' ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab('permissions')}
                            >
                                Permissions
                            </button>
                            <button
                                className={`${styles.tabItem} ${activeTab === 'policy' ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab('policy')}
                            >
                                Security Policy
                            </button>
                        </nav>

                        <div className={styles.tabContent}>
                            {/* ─── Main Tab ─── */}
                            {activeTab === 'main' && (
                                <div className={styles.mainTabGrid}>
                                    <div className={styles.mainInfoSection}>
                                        <div className={styles.sectionHeader}>
                                            <FileText size={18} />
                                            <h3>Group Configuration</h3>
                                        </div>
                                        <div className={styles.formGrid}>
                                            <div className={styles.field}>
                                                <label>Group Name <span style={{ color: 'var(--accent-danger, #ef4444)' }}>*</span></label>
                                                <input
                                                    type="text"
                                                    value={selectedGroup.name}
                                                    placeholder="Enter group name"
                                                    onChange={(e) => updateSelectedGroup({ name: e.target.value })}
                                                    style={fieldErrors.name ? { borderColor: 'var(--accent-danger, #ef4444)' } : {}}
                                                />
                                                {fieldErrors.name && <span style={{ color: 'var(--accent-danger, #ef4444)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{fieldErrors.name}</span>}
                                            </div>
                                            <div className={styles.field}>
                                                <label>Access Status</label>
                                                <div className={styles.switchWrapper}>
                                                    <label className={styles.mainSwitch}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedGroup.status === 'active'}
                                                            onChange={(e) => updateSelectedGroup({ status: e.target.checked ? 'active' : 'inactive' })}
                                                        />
                                                        <span className={styles.mainSlider}></span>
                                                    </label>
                                                    <span className={selectedGroup.status === 'active' ? styles.activeText : styles.inactiveText}>
                                                        {selectedGroup.status === 'active' ? 'ENABLED' : 'DISABLED'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={styles.field}>
                                                <label>Group Scope</label>
                                                <select
                                                    value={selectedGroup.scope}
                                                    onChange={(e) => updateSelectedGroup({ scope: e.target.value as any })}
                                                    disabled={!selectedGroup.is_unsaved}
                                                    className={styles.selectInput}
                                                >
                                                    <option value="nexus">Nexus (Internal)</option>
                                                    <option value="client">Client (HQ Blueprint)</option>
                                                    <option value="branch">Branch (Ops Blueprint)</option>
                                                </select>
                                            </div>

                                            <div className={styles.field}>
                                                <label>Template Status</label>
                                                <div className={styles.switchWrapper}>
                                                    <label className={styles.mainSwitch}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedGroup.is_template}
                                                            onChange={(e) => updateSelectedGroup({ is_template: e.target.checked })}
                                                        />
                                                        <span className={styles.mainSlider}></span>
                                                    </label>
                                                    <span className={selectedGroup.is_template ? styles.activeText : styles.inactiveText}>
                                                        {selectedGroup.is_template ? 'BLUEPRINT' : 'REGULAR'}
                                                    </span>
                                                </div>
                                            </div>

                                            {selectedGroup.is_template && (
                                                <div className={styles.field}>
                                                    <label>Target Module (Optional)</label>
                                                    <select
                                                        value={selectedGroup.module_slug || ''}
                                                        onChange={(e) => updateSelectedGroup({ module_slug: e.target.value || null })}
                                                        className={styles.selectInput}
                                                    >
                                                        <option value="">Global (All Modules)</option>
                                                        {modules.map(mod => (
                                                            <option key={mod.id} value={mod.id}>{mod.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className={`${styles.field} ${styles.fullWidth}`}>
                                                <label>Description / Business Rule <span style={{ color: 'var(--accent-danger, #ef4444)' }}>*</span></label>
                                                <textarea
                                                    rows={3}
                                                    value={selectedGroup.description}
                                                    placeholder="Describe the purpose of this group and its access rules..."
                                                    onChange={(e) => updateSelectedGroup({ description: e.target.value })}
                                                    style={fieldErrors.description ? { borderColor: 'var(--accent-danger, #ef4444)' } : {}}
                                                />
                                                {fieldErrors.description && <span style={{ color: 'var(--accent-danger, #ef4444)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>{fieldErrors.description}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.infoMetaSidebar}>
                                        <div className={styles.metaCard}>
                                            <div className={styles.metaItem}>
                                                <Calendar size={16} />
                                                <div className={styles.metaText}>
                                                    <span className={styles.metaLabel}>Created On</span>
                                                    <span className={styles.metaValue}>{selectedGroup.createdAt}</span>
                                                </div>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <Clock size={16} />
                                                <div className={styles.metaText}>
                                                    <span className={styles.metaLabel}>Last Modified</span>
                                                    <span className={styles.metaValue}>{selectedGroup.lastModified}</span>
                                                </div>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <Users size={16} />
                                                <div className={styles.metaText}>
                                                    <span className={styles.metaLabel}>Current Users</span>
                                                    <span className={styles.metaValue}>{selectedGroup.userCount}</span>
                                                </div>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <Key size={16} />
                                                <div className={styles.metaText}>
                                                    <span className={styles.metaLabel}>Logical Nodes</span>
                                                    <span className={styles.metaValue}>{selectedGroup.permissions.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.dangerZoneSlim}>
                                            <h4>Danger Zone</h4>
                                            <p>This action cannot be undone.</p>
                                            <button className={styles.deleteActionSlim} onClick={() => setDeleteModalVisible(true)}>
                                                <Trash2 size={14} />
                                                Delete Group
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── Member Tab ─── */}
                            {activeTab === 'member' && (
                                <div className={styles.memberTabContent}>
                                    <div className={styles.tableControls}>
                                        <div className={styles.userSearchSlim}>
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search members in this group..."
                                                value={memberSearchTerm}
                                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div className={styles.memberCountBadge}>
                                                {selectedGroup.users.length} Active Members
                                            </div>
                                            <button className={styles.addBtn} onClick={() => setAddMemberModalOpen(true)}>
                                                <UserPlus size={18} />
                                                Add Member
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.modernTableWrapper}>
                                        <table className={styles.modernTable}>
                                            <thead>
                                                <tr>
                                                    <th>User / Identity</th>
                                                    <th>User ID</th>
                                                    <th>Designation</th>
                                                    <th>Department</th>
                                                    <th>Contact Details</th>
                                                    <th style={{ textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredMembers.map(user => (
                                                    <tr key={user.id}>
                                                        <td>
                                                            <div className={styles.tableUserCell}>
                                                                <div className={styles.avatarSlim}>{user.avatar}</div>
                                                                <div className={styles.userNameStack}>
                                                                    <span className={styles.userNameTable}>{user.name}</span>
                                                                    <span className={styles.userEmailTable}>{user.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td><code className={styles.userIdTable}>{user.userId}</code></td>
                                                        <td><span className={styles.designationText}>{user.designation}</span></td>
                                                        <td><span className={styles.tableDeptBadge}>{user.department}</span></td>
                                                        <td>
                                                            <div className={styles.contactStack}>
                                                                <span className={styles.contactItem}><Smartphone size={10} /> {user.contact}</span>
                                                                <span className={styles.contactItem}><Mail size={10} /> Internal</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                className={styles.rowActionBtn}
                                                                title="Remove User from Group"
                                                                onClick={() => handleRemoveMember(user.id)}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredMembers.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className={styles.emptyTableRow}>
                                                            <UserCircle size={40} style={{ opacity: 0.2, marginBottom: 8 }} />
                                                            <p>{memberSearchTerm ? 'No members match your search.' : 'No members currently assigned to this security group.'}</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ─── Permissions Tab ─── */}
                            {activeTab === 'permissions' && (
                                <div className={styles.permissionsGrid}>
                                    {modules.map((module: ModuleResource) => {
                                        const modulePerms = module.pages.flatMap((p: any) => p.permissions.map((perm: any) => perm.id));
                                        const isAllChecked = modulePerms.every((id: string) => selectedGroup.permissions.includes(id));

                                        return (
                                            <section key={module.id} className={styles.moduleCard}>
                                                <header className={styles.moduleHeader}>
                                                    <div className={styles.moduleTitleRow}>
                                                        {module.icon && <module.icon className={styles.moduleIcon} size={20} />}
                                                        <div>
                                                            <h3>{module.name}</h3>
                                                            <p>{module.description || 'Module Access Management'}</p>
                                                        </div>
                                                    </div>
                                                    <div className={styles.moduleToggle}>
                                                        <span>Full Module Access</span>
                                                        <label className={styles.selectAllLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllChecked}
                                                                onChange={(e) => handleToggleModule(module.id, e.target.checked)}
                                                            />
                                                            Select All
                                                        </label>
                                                    </div>
                                                </header>

                                                <div className={styles.permGrid2Col}>
                                                    {module.pages.flatMap((p: any) => p.permissions).map((perm: any) => {
                                                        const isChecked = selectedGroup.permissions.includes(perm.id);
                                                        return (
                                                            <label
                                                                key={perm.id}
                                                                className={`${styles.permItemRow} ${isChecked ? styles.checkboxActive : ''}`}
                                                                title={perm.description}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleTogglePermission(perm.id)}
                                                                />
                                                                <span className={styles.permName}>{perm.name}</span>
                                                                <Info size={12} className={styles.infoIcon} />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ─── Security Policy Tab ─── */}
                            {activeTab === 'policy' && (
                                <div className={styles.policyTabContent}>
                                    <div className={styles.policyGrid}>
                                        <div className={styles.policyCard}>
                                            <div className={styles.policyHeader}>
                                                <Users size={20} className={styles.policyIconIndigo} />
                                                <h3>Security Control Snapshot</h3>
                                            </div>
                                            <div className={styles.policyBody}>
                                                {securityOverview ? (
                                                    <>
                                                        <p>Live security policy support is now sourced from the backend session, access-log, and login-audit layer rather than static copy.</p>
                                                        <div className={styles.policyMetricGrid}>
                                                            <div className={styles.policyMetric}>
                                                                <span className={styles.policyMetricLabel}>Active Sessions</span>
                                                                <strong className={styles.policyMetricValue}>{securityOverview.session_activity.active_sessions}</strong>
                                                            </div>
                                                            <div className={styles.policyMetric}>
                                                                <span className={styles.policyMetricLabel}>Failed Logins (24h)</span>
                                                                <strong className={styles.policyMetricValue}>{securityOverview.auth_activity.failure_last_24h}</strong>
                                                            </div>
                                                            <div className={styles.policyMetric}>
                                                                <span className={styles.policyMetricLabel}>Denied Access (24h)</span>
                                                                <strong className={styles.policyMetricValue}>{securityOverview.access_activity.denied_last_24h}</strong>
                                                            </div>
                                                            <div className={styles.policyMetric}>
                                                                <span className={styles.policyMetricLabel}>Locked Accounts</span>
                                                                <strong className={styles.policyMetricValue}>{securityOverview.lockout_policy.locked_accounts}</strong>
                                                            </div>
                                                        </div>
                                                        <ul className={styles.policyList}>
                                                            <li><strong>JWT TTL:</strong> {securityOverview.controls.jwt_expires_in}</li>
                                                            <li><strong>Retention:</strong> Sessions {securityOverview.controls.session_retention_days}d, access logs {securityOverview.controls.access_log_retention_days}d, auth audits {securityOverview.controls.auth_audit_retention_days}d.</li>
                                                            <li><strong>Capture:</strong> IP, device, session revocation, and authenticated access traces are enabled for admin oversight.</li>
                                                        </ul>
                                                    </>
                                                ) : (
                                                    <p>Security telemetry is temporarily unavailable. Core access-control data is still loaded, but the live security overview call did not return.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.policyCard}>
                                            <div className={styles.policyHeader}>
                                                <ShieldCheck size={20} className={styles.policyIconPurple} />
                                                <h3>Active Sessions</h3>
                                            </div>
                                            <div className={styles.policyBody}>
                                                <p>These sessions are sourced from persisted authentication state. Revoking one blocks its JWT on the next request.</p>
                                                <div className={styles.policyRecordList}>
                                                    {(securityOverview?.active_sessions || []).map((session) => (
                                                        <div key={session.session_id} className={styles.policyRecord}>
                                                            <div className={styles.policyRecordHeader}>
                                                                <div>
                                                                    <div className={styles.policyRecordTitle}>{session.username || session.user_id}</div>
                                                                    <div className={styles.policyRecordSub}>{session.portal} · {session.user_type} · {session.device_label || 'Unknown device'}</div>
                                                                </div>
                                                                <button
                                                                    className={styles.policyActionBtn}
                                                                    onClick={() => handleRevokeSession(session.session_id)}
                                                                >
                                                                    Revoke
                                                                </button>
                                                            </div>
                                                            <div className={styles.policyRecordMeta}>
                                                                <span>IP {session.last_seen_ip || session.ip_address || 'n/a'}</span>
                                                                <span>Seen {formatRelative(session.last_seen_at)}</span>
                                                                <span>Expires {formatDateTime(session.expires_at)}</span>
                                                            </div>
                                                            {session.risk_flags && session.risk_flags.length > 0 && (
                                                                <div className={styles.policyRecordFlags}>
                                                                    {session.risk_flags.map((flag) => (
                                                                        <span key={flag} className={styles.policyRecordBadge}>{flag.replace('_', ' ')}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {(securityOverview?.active_sessions || []).length === 0 && (
                                                        <div className={styles.policyRecordEmpty}>No active tracked sessions available.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.policyCard}>
                                            <div className={styles.policyHeader}>
                                                <LayoutGrid size={20} className={styles.policyIconCyan} />
                                                <h3>Recent Failed Logins</h3>
                                            </div>
                                            <div className={styles.policyBody}>
                                                <p>Failed authentication attempts are logged with request metadata so operators can review lockouts and suspicious access patterns.</p>
                                                <div className={styles.policyRecordList}>
                                                    {(securityOverview?.recent_failed_logins || []).map((attempt) => (
                                                        <div key={attempt.id} className={styles.policyRecord}>
                                                            <div className={styles.policyRecordHeader}>
                                                                <div>
                                                                    <div className={styles.policyRecordTitle}>{attempt.user_id}</div>
                                                                    <div className={styles.policyRecordSub}>{attempt.user_type} · {attempt.tenant_slug || 'no tenant slug'} · {attempt.ip_address || 'unknown ip'}</div>
                                                                </div>
                                                                <span className={styles.policyRecordBadge}>{formatRelative(attempt.created_at)}</span>
                                                            </div>
                                                            <div className={styles.policyRecordMeta}>
                                                                <span>{attempt.failure_reason || 'Authentication failure'}</span>
                                                                <span>{attempt.user_agent || 'No user-agent recorded'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(securityOverview?.recent_failed_logins || []).length === 0 && (
                                                        <div className={styles.policyRecordEmpty}>No recent failed logins recorded.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.policyCard}>
                                            <div className={styles.policyHeader}>
                                                <Activity size={20} className={styles.policyIconCyan} />
                                                <h3>Recent Access Trace</h3>
                                            </div>
                                            <div className={styles.policyBody}>
                                                <p>Authenticated access events are persisted for enterprise troubleshooting and compliance-oriented review.</p>
                                                <div className={styles.policyRecordList}>
                                                    {securityAccessLogs.map((entry) => (
                                                        <div key={entry.id} className={styles.policyRecord}>
                                                            <div className={styles.policyRecordHeader}>
                                                                <div>
                                                                    <div className={styles.policyRecordTitle}>{entry.username || entry.user_id || 'Unknown actor'}</div>
                                                                    <div className={styles.policyRecordSub}>{entry.portal} · {entry.request_method} · {entry.ip_address || 'unknown ip'}</div>
                                                                </div>
                                                                <span className={styles.policyRecordBadge}>{entry.status_code}</span>
                                                            </div>
                                                            <div className={styles.policyRecordMeta}>
                                                                <span>{entry.request_path}</span>
                                                                <span>{formatDateTime(entry.created_at)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {securityAccessLogs.length === 0 && (
                                                        <div className={styles.policyRecordEmpty}>No recent access log entries available.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <Shield size={64} className={styles.pulseShield} />
                        <h2>Access Control Console</h2>
                        <p>Select a permission group from the directory to start configuring access rules.</p>
                    </div>
                )}
            </main>

            {/* Delete Confirmation Modal */}
            {deleteModalVisible && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalCard}>
                        <h3>Confirm Deletion</h3>
                        <p>Are you sure you want to delete <strong>{selectedGroup?.name}</strong>? This will affect {selectedGroup?.userCount} users.</p>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setDeleteModalVisible(false)}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={async () => {
                                try {
                                    if (selectedGroupId) {
                                        await systemGroupApi.deleteGroup(selectedGroupId);
                                        setSelectedGroupId(null);
                                        setDeleteModalVisible(false);
                                        toast.success('Deleted', 'Group removed successfully.');
                                        await fetchAll();
                                    }
                                } catch {
                                    toast.error('Error', 'Failed to delete group');
                                }
                            }}>Confirm Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Member Modal */}
            {addMemberModalOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <h2>Add New Members</h2>
                            <button className={styles.closeBtn} onClick={() => setAddMemberModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Search and select users to add to <strong>{selectedGroup?.name}</strong>.
                        </p>
                        <div className={styles.userSearchSlim} style={{ width: '100%' }}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                autoFocus
                                value={newMemberSearch}
                                onChange={(e) => setNewMemberSearch(e.target.value)}
                            />
                        </div>

                        <div className={styles.searchResultsScroll}>
                            {availableToPick.map((user: any) => (
                                <div key={user.id} className={styles.availableUserItem} onClick={() => handleAddMember(user)}>
                                    <div className={styles.userPickInfo}>
                                        <div className={styles.avatarSlim}>{user.avatar}</div>
                                        <div className={styles.userPickText}>
                                            <span className={styles.userPickName}>{user.name}</span>
                                            <span className={styles.userPickEmail}>{user.email}</span>
                                        </div>
                                    </div>
                                    <button className={styles.pickBtn}>
                                        <Plus size={14} />
                                        Add
                                    </button>
                                </div>
                            ))}
                            {availableToPick.length === 0 && (
                                <div className={styles.noResults}>
                                    {newMemberSearch ? 'No matching users found.' : 'Search for users to add them to this group.'}
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.confirmBtn} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }} onClick={() => setAddMemberModalOpen(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

