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
    History,
    MoreVertical,
    Edit2,
    Clock,
    Globe
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { toast } from '../../components/ui/KitchenToast/toast';
import { platformApi } from '../../api/api';
import styles from './SystemUserList.module.css';

interface SystemUser {
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

export function SystemUserList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const apiData = await platformApi.getSystemUsers();
            const mappedApi = apiData.map((u: any) => ({
                id: u.id,
                employee_id: u.employee_id || `SYS-${u.id}`,
                user_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'System User',
                email: u.email,
                role: u.roleEntity?.role_name || u.role || 'No Role',
                department: u.department?.name || 'Nexus Platform',
                designation: u.designation?.name || 'Operator',
                status: (u.is_active ? 'active' : 'suspended') as 'active' | 'suspended',
                last_login: u.last_login,
                user_type: u.user_type || 'PLATFORM_ADMIN',
                branch_name: 'Nexus Core'
            }));
            setUsers(mappedApi);
        } catch (error) {
            console.error('Failed to fetch system users:', error);
            toast.error('Sync Error', 'Could not connect to Nexus Identity Vault.');
            // Fallback to empty to allow UI to render
            setUsers([]);
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

    const toggleStatus = async (user: SystemUser) => {
        try {
            if (user.status === 'active') {
                await platformApi.deactivateSystemUser(user.id.toString());
            } else {
                await platformApi.activateSystemUser(user.id.toString());
            }
            toast.success('Access Updated', `${user.user_name} status updated.`);
            fetchUsers();
        } catch {
            toast.error('Update Failed', 'Operation could not be completed.');
        }
    };

    const columns: ColumnDef<SystemUser>[] = [
        {
            key: 'user_name',
            header: 'Identity',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.tableAvatar} style={{ background: ROLES_MAP[row.user_type]?.bg || 'rgba(255,255,255,0.05)', color: ROLES_MAP[row.user_type]?.color || 'var(--accent-primary)' }}>
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
            header: 'Organization',
            cell: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.branch_name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{row.department}</span>
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
            header: 'Last Seen',
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
                <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`/nexus/users/${row.id}`)}>
                    Configure
                </KitchenButton>
            ),
            align: 'right'
        }
    ];

    return (
        <div className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.breadcrumb}>
                        <Globe size={14} />
                        <span>Nexus Platform</span>
                        <span className={styles.breadSep}>/</span>
                        <span className={styles.breadActive}>System Users</span>
                    </div>
                    <h1 className={styles.pageTitle}>Platform Personnel</h1>
                    <p className={styles.pageSubtitle}>
                        Manage global platform administrators, system operators, and nexus support identities.
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/audit-logs')}>
                        <History size={16} />
                        Security Audit
                    </KitchenButton>
                    <KitchenButton onClick={() => navigate('/nexus/users/new')}>
                        <UserPlus size={18} />
                        Onboard Operator
                    </KitchenButton>
                </div>
            </header>

            {/* KPI Grid */}
            <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                            <Users size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Total Operators</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.total}</div>
                    <div className={styles.kpiMeta}>Registered system profiles</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                            <UserCheck size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Authorized</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.active}</div>
                    <div className={styles.kpiMeta}>Profiles with live access</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }} />
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiHeaderInfo}>
                        <div className={`${styles.kpiIcon} ${styles.kpiIconOrange}`}>
                            <UserX size={16} />
                        </div>
                        <div className={styles.kpiLabel}>Revoked / Suspended</div>
                    </div>
                    <div className={styles.kpiValue}>{stats.suspended + stats.inactive}</div>
                    <div className={styles.kpiMeta}>Access restrictions active</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${stats.total > 0 ? ((stats.suspended + stats.inactive) / stats.total) * 100 : 0}%` }} />
                    </div>
                </div>

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
                        <div className={styles.kpiProgressFill} style={{ width: '60%' }} />
                    </div>
                </div>
            </div>

            {/* Toolbar Area */}
            <div className={styles.toolbarArea}>
                <div className={styles.toolbarGlass}>
                    <div className={styles.searchSection}>
                        <Search size={18} className={styles.searchIcon} />
                        <div className={styles.searchInputWrap}>
                            <input
                                placeholder="Filter identities by name, email, or system ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={styles.searchInput}
                            />
                        </div>
                    </div>

                    <div className={styles.filterSection}>
                        <div className={styles.selectWrap}>
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All Identity Types' },
                                    { value: 'PLATFORM_ADMIN', label: 'Platform Admins' },
                                    { value: 'CLIENT_ADMIN', label: 'Client Admins' },
                                    { value: 'BRANCH_STAFF', label: 'Branch Staff' }
                                ]}
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                                className={styles.filterSelect}
                            />
                        </div>

                        <div className={styles.selectWrap}>
                            <KitchenSelect
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' }
                                ]}
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className={styles.filterSelect}
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
            </div>

            {/* Content */}
            {isLoading ? (
                <div className={styles.loadingState}>
                    <Loader2 size={36} className={styles.spin} />
                    <p>Authenticating Nexus registry...</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className={styles.userGrid}>
                    {filteredUsers.map((user, i) => {
                        const typeInfo = ROLES_MAP[user.user_type];
                        const TypeIcon = typeInfo?.icon || Shield;
                        return (
                            <div key={user.id} className={styles.userCard} style={{ animationDelay: `${i * 60}ms` }}>
                                <div className={styles.userCardHeader}>
                                    <div className={styles.userAvatar} style={{ background: typeInfo?.bg || 'rgba(255,255,255,0.05)', color: typeInfo?.color || 'var(--accent-primary)' }}>
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
                                                <button className={styles.cardMenuItem} onClick={() => navigate(`/nexus/users/${user.id}`)}><Edit2 size={14} /> Account Settings</button>
                                                <button className={styles.cardMenuItem}><Activity size={14} /> System Activity</button>
                                                <button className={`${styles.cardMenuItem} ${user.status === 'active' ? styles.cardMenuDanger : styles.cardMenuSuccess}`} onClick={() => toggleStatus(user)}>
                                                    {user.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                                                    {user.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.userCardEmail}>{user.email || 'No email associated'}</div>

                                <div className={styles.userSectionLabel}>System Context</div>
                                <div className={styles.userCardContext}>
                                    <div className={styles.contextItem}>
                                        <Globe size={12} />
                                        <span>{user.branch_name}</span>
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
                    {filteredUsers.length === 0 && (
                        <div className={styles.loadingState}>
                            <p>No system users matched the filter criteria.</p>
                        </div>
                    )}
                </div>
            ) : (
                <KitchenCard noPadding>
                    <KitchenTable columns={columns} data={filteredUsers} />
                </KitchenCard>
            )}
        </div>
    );
}

export default SystemUserList;
