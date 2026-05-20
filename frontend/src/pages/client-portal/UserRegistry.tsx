/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Shield,
    UserPlus,
    Loader2,
    Users,
    UserCheck,
    Clock,
    Zap,
    LayoutGrid,
    List,
    Filter,
    ChevronDown,
    Eye,
    ShieldCheck,
    Briefcase,
    Building2,
    History,
    MoreVertical,
    Edit2,
    Utensils,
    ChefHat,
    Star
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { userApi } from '../../api/api';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './UserRegistry.module.css';

interface RegistryUser {
    id: number;
    identity_code: string; // Combined user_number / employee_id
    full_name: string;
    username: string;
    email: string;
    role: string;
    department: string;
    designation: string;
    status: 'active' | 'suspended' | 'pending' | 'inactive';
    type: 'CORPORATE' | 'OPERATIONAL';
    last_login: string;
    avatar_color: string;
    profile_picture?: string;
    sessions_today?: number;
    branch?: string;
    branch_count: number;
    access_scope: string;
    governance_scope: string;
    approval_matrix: string;
    primary_role: string;
}

const ROLES_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    PLATFORM_ADMIN: { label: 'Platform Admin', icon: Shield, color: 'var(--accent-primary)', bg: 'var(--badge-info-bg)' },
    CLIENT_ADMIN: { label: 'Client Admin', icon: Briefcase, color: 'var(--accent-secondary)', bg: 'var(--badge-purple-bg)' },
    BRANCH_STAFF: { label: 'Branch Staff', icon: Utensils, color: 'var(--accent-tertiary)', bg: 'var(--badge-cyan-bg)' },
    EXECUTIVE_CHEF: { label: 'Executive Chef', icon: ChefHat, color: 'var(--color-success)', bg: 'var(--badge-success-bg)' },
    BRANCH_MANAGER: { label: 'Branch Manager', icon: ShieldCheck, color: 'var(--accent-primary)', bg: 'var(--badge-info-bg)' },
};

function getTimeSince(iso?: string): string {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function describeGovernanceScope(user: any, branchCount: number): string {
    if (user.user_type === 'CLIENT_ADMIN' && branchCount === 0) {
        return 'Tenant-wide central governance';
    }

    const hasCentralScope = (user.branchRoles || []).some((assignment: any) => assignment.assignment_scope === 'central');
    return hasCentralScope ? 'Central scoped user' : 'Branch-only user';
}

function describeApprovalMatrix(user: any): string {
    const authorities = new Set(
        (user.branchRoles || [])
            .map((assignment: any) => assignment.approval_authority || assignment.roleEntity?.approval_authority)
            .filter(Boolean),
    );

    if (user.user_type === 'CLIENT_ADMIN') {
        return 'Branch + central approvals';
    }
    if (authorities.has('both')) {
        return 'Branch + central approvals';
    }
    if (authorities.has('central')) {
        return 'Central approvals';
    }
    if (authorities.has('branch')) {
        return 'Branch approvals';
    }
    return 'No explicit approvals';
}

export function UserRegistry() {
    const navigate = useNavigate();
    const { canManageUsers } = usePermissionAccess();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [users, setUsers] = useState<RegistryUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
            try {
                const apiUsers = await userApi.getUsers();
                const mappedUsers: RegistryUser[] = apiUsers.map((user: any) => {
                    const primaryBranch = user.branchRoles?.find((role: any) => role.is_primary) ?? user.branchRoles?.[0];
                    const branchCount = user.branchRoles?.length ?? 0;
                    return {
                        id: user.id,
                        identity_code: user.employee_id || `USR-${user.id}`,
                        full_name: user.full_name || user.user_name,
                        username: user.user_name || '',
                        email: user.email || '',
                        role: user.user_type || 'BRANCH_STAFF',
                        department: user.department?.name || 'Unassigned',
                        designation: user.designation?.name || 'Unassigned',
                        status: user.status || 'inactive',
                        type: user.user_type === 'CLIENT_ADMIN' || user.user_type === 'PLATFORM_ADMIN' ? 'CORPORATE' : 'OPERATIONAL',
                        last_login: user.last_login,
                        avatar_color: user.user_type === 'CLIENT_ADMIN' ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                        profile_picture: user.profile_picture || '',
                        sessions_today: 0,
                        branch: primaryBranch?.branch?.branch_name,
                        branch_count: branchCount,
                        access_scope:
                            user.user_type === 'CLIENT_ADMIN' && branchCount === 0
                                ? 'All client branches'
                                : branchCount > 1
                                    ? `${branchCount} assigned branches`
                                    : branchCount === 1
                                        ? 'Single assigned branch'
                                        : 'No branch assignment',
                        governance_scope: describeGovernanceScope(user, branchCount),
                        approval_matrix: describeApprovalMatrix(user),
                        primary_role:
                            primaryBranch?.roleEntity?.role_name ||
                            user.roleEntity?.role_name ||
                            'No role',
                    };
                });
                setUsers(mappedUsers);
            } catch (error) {
                console.error('Failed to load users:', error);
                toast.error('Registry Error', 'Could not load personnel registry.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchUsers();
    }, [fetchUsers]);

    const stats = useMemo(() => ({
        total: users.length,
        corporate: users.filter(u => u.type === 'CORPORATE').length,
        operational: users.filter(u => u.type === 'OPERATIONAL').length,
        active: users.filter(u => u.status === 'active').length,
        totalSessions: users.reduce((sum, u) => sum + (u.sessions_today || 0), 0),
    }), [users]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch = !searchTerm ||
                u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.identity_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.branch || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.governance_scope.toLowerCase().includes(searchTerm.toLowerCase());
            const matchRole = roleFilter === 'all' || u.role === roleFilter;
            const matchStatus = statusFilter === 'all' || u.status === statusFilter;
            const matchType = typeFilter === 'all' || u.type === typeFilter;
            return matchSearch && matchRole && matchStatus && matchType;
        });
    }, [users, searchTerm, roleFilter, statusFilter, typeFilter]);

    return (
        <div className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.breadcrumb}>
                        <Building2 size={14} />
                        <span>Workforce Governance</span>
                        <span className={styles.breadSep}>/</span>
                        <span className={styles.breadActive}>Personnel Registry</span>
                    </div>
                    <h1 className={styles.pageTitle}>Users & Staff Directory</h1>
                    <p className={styles.pageSubtitle}>
                        Unified management of corporate administrative users and branch operational staff.
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" disabled={!canManageUsers} onClick={() => canManageUsers && toast.info('Beta Feature', 'Opening Global Audit Logs...')}>
                        <History size={16} />
                        Audit History
                    </KitchenButton>
                    <KitchenButton disabled={!canManageUsers} onClick={() => canManageUsers && navigate('new')}>
                        <UserPlus size={18} />
                        Onboard Personnel
                    </KitchenButton>
                </div>
            </header>

            {/* Combined KPI Strip */}
            <div className={styles.statsStrip}>
                <div className={`${styles.statCard} ${styles.statTotal}`}>
                    <div className={styles.statIconWrap}><Users size={20} /></div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>Total Workforce</span>
                    </div>
                    <div className={styles.statRing} style={{ '--ring-pct': '100%' } as any} />
                </div>
                <div className={`${styles.statCard} ${styles.statCorporate}`}>
                    <div className={styles.statIconWrap}><Shield size={20} /></div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>{stats.corporate}</span>
                        <span className={styles.statLabel}>Corp Users</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statOperational}`}>
                    <div className={styles.statIconWrap}><Utensils size={20} /></div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>{stats.operational}</span>
                        <span className={styles.statLabel}>Branch Staff</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statActive}`}>
                    <div className={styles.statIconWrap}><UserCheck size={20} /></div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>{stats.active}</span>
                        <span className={styles.statLabel}>On-Duty / Active</span>
                    </div>
                </div>
                <div className={`${styles.statCard} ${styles.statSessions}`}>
                    <div className={styles.statIconWrap}><Zap size={20} /></div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>{stats.totalSessions}</span>
                        <span className={styles.statLabel}>Daily Activity</span>
                    </div>
                    <div className={styles.liveIndicator}><span className={styles.liveDot} /> LIVE</div>
                </div>
            </div>

            {/* Toolbar avec Filtre de Type */}
            <div className={styles.toolbarArea}>
                <div className={styles.toolbarGlass}>
                    <div className={styles.searchSection}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            placeholder="Search by name, email, ID or branch..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterSection}>
                        <div className={styles.selectWrap}>
                            <Filter size={13} />
                            <select className={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                <option value="all">All Personnel</option>
                                <option value="CORPORATE">Corporate Only</option>
                                <option value="OPERATIONAL">Branch Staff</option>
                            </select>
                            <ChevronDown size={13} />
                        </div>

                        <div className={styles.selectWrap}>
                            <select className={styles.filterSelect} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                <option value="all">All Roles</option>
                                {Object.entries(ROLES_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <ChevronDown size={13} />
                        </div>

                        <div className={styles.selectWrap}>
                            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="all">Any Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                            </select>
                            <ChevronDown size={13} />
                        </div>

                        <div className={styles.vDivider} />

                        <div className={styles.viewToggleGroup}>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
                                onClick={() => setViewMode('table')}
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className={styles.toolbarFooter}>
                    <span className={styles.resultCount}>
                        Found <strong>{filteredUsers.length}</strong> personnel in current view
                    </span>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className={styles.loadingState}><Loader2 size={36} className={styles.spin} /><p>Accessing registry...</p></div>
            ) : viewMode === 'grid' ? (
                <div className={styles.userGrid}>
                    {filteredUsers.map((user, i) => {
                        const roleInfo = ROLES_MAP[user.role];
                        const RoleIcon = roleInfo?.icon || Shield;
                        return (
                            <div key={user.id} className={styles.userCard} style={{ animationDelay: `${i * 60}ms` }}>
                                <div className={styles.userCardHeader}>
                                    <div className={styles.userCardAvatar} style={{ background: user.avatar_color }}>
                                        {user.profile_picture ? <img src={user.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} /> : user.full_name.charAt(0)}
                                        <span className={`${styles.statusDot} ${styles[`status_${user.status}`]}`} />
                                    </div>
                                    <div className={styles.userCardMeta}>
                                        <h3 className={styles.userCardName}>{user.full_name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className={styles.userCardUsername}>{user.type === 'CORPORATE' ? `@${user.username}` : user.identity_code}</span>
                                            {user.type === 'CORPORATE' && <span className={styles.userNumberChip}>{user.identity_code}</span>}
                                        </div>
                                    </div>
                                    <div className={styles.cardMenuWrap}>
                                        <button className={styles.cardMenuBtn} disabled={!canManageUsers} onClick={() => canManageUsers && setOpenMenuId(openMenuId === String(user.id) ? null : String(user.id))}><MoreVertical size={16} /></button>
                                        {canManageUsers && openMenuId === String(user.id) && (
                                            <div className={styles.cardMenu}>
                                                <button className={styles.cardMenuItem} onClick={() => navigate(String(user.id))}><Edit2 size={14} /> Edit Profile</button>
                                                <button className={styles.cardMenuItem}><Eye size={14} /> View Logs</button>
                                                <div className={styles.menuDivider} />
                                                <button className={`${styles.cardMenuItem} ${user.status === 'active' ? styles.cardMenuDanger : styles.cardMenuSuccess}`}>
                                                    {user.status === 'active' ? 'Suspend' : 'Activate'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.userCardBody}>
                                    <div className={styles.userCardRole} style={{ background: roleInfo?.bg, color: roleInfo?.color }}>
                                        <RoleIcon size={12} /> {roleInfo?.label || user.role}
                                    </div>
                                    <div className={styles.cardTypeBadge} data-type={user.type}>
                                        {user.type === 'CORPORATE' ? <Star size={10} /> : <Building2 size={10} />}
                                        {user.type}
                                    </div>
                                </div>

                                <div className={styles.userCardStats}>
                                    <div className={styles.userCardStat}>
                                        <span className={styles.userCardStatVal}>{user.branch || 'Global HQ'}</span>
                                        <span className={styles.userCardStatLabel}>{user.governance_scope}</span>
                                    </div>
                                    <div className={styles.userCardStatDiv} />
                                    <div className={styles.userCardStat}>
                                        <span className={styles.userCardStatVal}>{user.primary_role}</span>
                                        <span className={styles.userCardStatLabel}>{user.approval_matrix}</span>
                                    </div>
                                </div>

                                <div className={styles.userCardFooter}>
                                    <div className={styles.lastLogin}><Clock size={12} /> {getTimeSince(user.last_login)}</div>
                                    <div className={`${styles.statusPill} ${styles[`pill_${user.status}`]}`}>
                                        {user.status}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={styles.tableCard}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Personnel</th>
                                <th>Type</th>
                                <th>Domain / Role</th>
                                <th>Branch / Station</th>
                                <th>Presence</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const roleInfo = ROLES_MAP[user.role];
                                const RoleIcon = roleInfo?.icon || Shield;
                                return (
                                    <tr key={user.id} className={styles.tableRow}>
                                        <td>
                                            <div className={styles.tableUserCell}>
                                                <div className={styles.tableAvatar} style={{ background: user.avatar_color }}>
                                                    {user.profile_picture ? <img src={user.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} /> : user.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className={styles.tableName}>{user.full_name}</div>
                                                    <div className={styles.tableSubtext}>{user.identity_code} / {user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={styles.typeTag} data-type={user.type}>{user.type}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <RoleIcon size={14} style={{ color: roleInfo?.color }} />
                                                    <span className={styles.tableMainText}>{user.primary_role}</span>
                                                </div>
                                                <span className={styles.tableSubtext}>{user.governance_scope} / {user.approval_matrix}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.branchCell}>
                                                <Building2 size={13} />
                                                {user.branch || 'Corporate HQ'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`${styles.statusPill} ${styles[`pill_${user.status}`]}`}>
                                                {user.status}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                        <div className={styles.tableActions}>
                                                <button className={styles.ghostBtn} disabled={!canManageUsers} onClick={() => canManageUsers && navigate(String(user.id))}><Edit2 size={15} /></button>
                                                <button className={styles.ghostBtn} disabled={!canManageUsers}><MoreVertical size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}


