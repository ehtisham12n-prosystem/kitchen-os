import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Shield,
    UserPlus,
    Loader2,
    Users,
    UserCheck,
    UserX,
    Zap,
    Layout,
    List,
    Activity,
    ShieldCheck,
    Briefcase,
    Building2,
    History,
    MoreVertical,
    Edit2,
    Store,
    Clock
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { toast } from '../../components/ui/KitchenToast/toast';
import { userApi } from '../../api/api';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './UserManagement.module.css';

interface User {
    id: number;
    employee_id: string;
    user_name: string;
    email: string;
    role: string;
    department: string;
    designation: string;
    status: 'active' | 'inactive' | 'suspended';
    last_login: string;
    user_type: string;
    branch_name?: string;
}

const ROLES_MAP: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
    'PLATFORM_ADMIN': { label: 'Platform Admin', icon: Shield, color: 'var(--accent-primary)', bg: 'rgba(99, 102, 241, 0.1)' },
    'CLIENT_ADMIN': { label: 'Client Admin', icon: Briefcase, color: 'var(--accent-secondary)', bg: 'rgba(168, 85, 247, 0.1)' },
    'BRANCH_STAFF': { label: 'Branch Staff', icon: ShieldCheck, color: 'var(--accent-tertiary)', bg: 'rgba(6, 182, 212, 0.1)' },
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

export function UserManagement() {
    const navigate = useNavigate();
    const { canReadStaff, canManageUsers } = usePermissionAccess();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const apiData = await userApi.getUsers();
            const mappedApi = apiData.map((u: any) => ({
                id: u.id,
                employee_id: u.employee_id,
                user_name: u.user_name,
                email: u.email,
                role: u.roleEntity?.role_name || 'No Role',
                department: u.department?.name || 'Unassigned',
                designation: u.designation?.name || 'Unassigned',
                status: u.status,
                last_login: u.last_login,
                user_type: u.user_type,
                branch_name: u.branchRoles?.find((assignment: any) => assignment.is_primary)?.branch?.branch_name
                    || u.branchRoles?.[0]?.branch?.branch_name
                    || 'Scoped Branch Access',
            }));
            setUsers(mappedApi);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Sync Error', 'Could not connect to user registry.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        suspended: users.filter(u => u.status === 'suspended').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        activeSessions: users.filter(u => u.last_login && new Date(u.last_login).toDateString() === new Date().toDateString()).length,
    }), [users]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch = !searchTerm ||
                u.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                u.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchType = typeFilter === 'all' || u.user_type === typeFilter;
            const matchStatus = statusFilter === 'all' || u.status === statusFilter;
            return matchSearch && matchType && matchStatus;
        });
    }, [users, searchTerm, typeFilter, statusFilter]);

    const toggleStatus = async (user: User) => {
        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        try {
            await userApi.updateUser(user.id, { status: newStatus });
            toast.success('Access Updated', `${user.user_name} is now ${newStatus}.`);
            // Local update for mock feel
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
        } catch {
            toast.error('Update Failed', 'Operation could not be completed.');
        }
    };

    const columns: ColumnDef<User>[] = [
        {
            key: 'user_name',
            header: 'Personnel Identity',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.tableAvatar} style={{ background: ROLES_MAP[row.user_type]?.bg || 'var(--bg-tertiary)', color: ROLES_MAP[row.user_type]?.color || 'var(--text-primary)' }}>
                        {row.user_name.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>#{row.employee_id}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'role',
            header: 'Security Level',
            cell: (row) => {
                const info = ROLES_MAP[row.user_type];
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: info?.color || 'var(--text-primary)' }}>
                            {info?.label || 'Custom Role'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{row.role}</span>
                    </div>
                );
            }
        },
        {
            key: 'department',
            header: 'Org Context',
            cell: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.branch_name || 'Global Environment'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{row.department} / {row.designation}</span>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span className={`${styles.statusPill} ${styles[`pill_${row.status}`]}`}>
                    {row.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'last_login',
            header: 'Activity',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    <Clock size={12} /> {getTimeSince(row.last_login)}
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            cell: (row) => (
                <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`/console/setup/users/${row.id}`)} disabled={!canManageUsers}>
                    Configure
                </KitchenButton>
            ),
            align: 'right'
        }
    ];

    if (!canReadStaff) {
        return (
            <div className={styles.page}>
                <header className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.pageTitle}>Administrative Users</h1>
                        <p className={styles.pageSubtitle}>Your current branch role does not include user management access.</p>
                    </div>
                </header>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.breadcrumb}>
                        <Building2 size={14} />
                        <span>Administrative Console</span>
                        <span className={styles.breadSep}>/</span>
                        <span className={styles.breadActive}>User Management</span>
                    </div>
                    <h1 className={styles.pageTitle}>Administrative Users</h1>
                    <p className={styles.pageSubtitle}>
                        Manage combined personnel registry for platform, client, and branch levels.
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => toast.info('Access Logs', 'Redirecting to Security Audit...')}>
                        <History size={16} />
                        Audit Logs
                    </KitchenButton>
                    <KitchenButton onClick={() => navigate('/console/setup/users/new')} disabled={!canManageUsers}>
                        <UserPlus size={18} />
                        Onboard User
                    </KitchenButton>
                </div>
            </header>

            {/* KPI Grid */}
            <div className={styles.kpiGrid}>
                {/* Total Users */}
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                            <Users size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Global Personnel</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.total}</div>
                    <div className={styles.kpiMeta}>Total registered accounts</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Active Accounts */}
                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                            <UserCheck size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Active Access</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.active}</div>
                    <div className={styles.kpiMeta}>Currently authorized users</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${(stats.active / stats.total) * 100}%` }} />
                    </div>
                </div>

                {/* Suspended Cases */}
                <div className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconOrange}`}>
                            <UserX size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Locked Accounts</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.suspended + stats.inactive}</div>
                    <div className={styles.kpiMeta}>Suspended or inactive users</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${((stats.suspended + stats.inactive) / stats.total) * 100}%` }} />
                    </div>
                </div>

                {/* Active Sessions */}
                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                            <Zap size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Live Activity</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.activeSessions}</div>
                    <div className={styles.kpiMeta}>Active sessions past 24h</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '40%' }} />
                    </div>
                </div>
            </div>

            {/* Toolbar Area */}
            <KitchenCard style={{ padding: '0', background: 'transparent', border: 'none', marginBottom: '24px' }}>
                <div className={styles.toolbarGlass}>
                    <div className={styles.searchSection}>
                        <Search size={18} className={styles.searchIcon} />
                        <KitchenInput
                            placeholder="Search by ID, name, or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            containerClassName={styles.searchInputWrap}
                        />
                    </div>

                    <div className={styles.filterSection}>
                        <div style={{ width: '160px' }}>
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All Types' },
                                    { value: 'PLATFORM_ADMIN', label: 'Platform Admins' },
                                    { value: 'CLIENT_ADMIN', label: 'Client Admins' },
                                    { value: 'BRANCH_STAFF', label: 'Branch Staff' }
                                ]}
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                            />
                        </div>

                        <div style={{ width: '140px' }}>
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' }
                                ]}
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            />
                        </div>

                        <div className={styles.vDivider} />

                        <div className={styles.viewToggleGroup}>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <Layout size={16} />
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
            </KitchenCard>

            {/* Content */}
            {isLoading ? (
                <div className={styles.loadingState}><Loader2 size={36} className={styles.spin} /><p>Connecting to user registry...</p></div>
            ) : viewMode === 'grid' ? (
                <div className={styles.userGrid}>
                    {filteredUsers.map((user, i) => {
                        const typeInfo = ROLES_MAP[user.user_type];
                        const TypeIcon = typeInfo?.icon || Shield;
                        return (
                            <div key={user.id} className={styles.userCard} style={{ animationDelay: `${i * 60}ms` }}>
                                <div className={styles.userCardHeader}>
                                    <div className={styles.userAvatar} style={{ background: typeInfo?.bg || 'var(--bg-tertiary)', color: typeInfo?.color || 'var(--accent-primary)' }}>
                                        {user.user_name.charAt(0)}
                                        <span className={`${styles.statusDot} ${styles[`status_${user.status}`]}`} />
                                    </div>
                                    <div className={styles.userCardMeta}>
                                        <h3 className={styles.userCardName}>{user.user_name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className={styles.userNumberChip}>#{user.employee_id}</span>
                                            <div style={{ color: typeInfo?.color, display: 'flex', alignItems: 'center' }}>
                                                <TypeIcon size={12} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.cardMenuWrap}>
                                        <button className={styles.cardMenuBtn} onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}><MoreVertical size={16} /></button>
                                        {openMenuId === user.id && (
                                            <div className={styles.cardMenu}>
                                                <button className={styles.cardMenuItem} onClick={() => navigate(`/console/setup/users/${user.id}`)}><Edit2 size={14} /> Account Settings</button>
                                                <button className={styles.cardMenuItem}><Activity size={14} /> System Activity</button>
                                                <button
                                                    className={`${styles.cardMenuItem} ${user.status === 'active' ? styles.cardMenuDanger : styles.cardMenuSuccess}`}
                                                    onClick={() => toggleStatus(user)}
                                                    disabled={!canManageUsers}
                                                >
                                                    {user.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                                                    {user.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.userCardEmail}>{user.email || 'No email associated'}</div>

                                <div className={styles.userSectionLabel}>Operational Domain</div>
                                <div className={styles.userCardContext}>
                                    <div className={styles.contextItem}>
                                        <Store size={12} />
                                        <span>{user.branch_name || 'Global HQ'}</span>
                                    </div>
                                    <div className={styles.contextItem}>
                                        <Briefcase size={12} />
                                        <span>{user.department}</span>
                                    </div>
                                </div>

                                <div className={styles.userCardFooter}>
                                    <div className={styles.lastLogin}>
                                        <Clock size={12} />
                                        <span>{getTimeSince(user.last_login)}</span>
                                    </div>
                                    <div className={styles.userTypeBadge} style={{ borderColor: typeInfo?.color, color: typeInfo?.color }}>
                                        {typeInfo?.label || user.user_type}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <KitchenCard style={{ padding: '0' }}>
                    <KitchenTable columns={columns} data={filteredUsers} />
                </KitchenCard>
            )}
        </div>
    );
}
