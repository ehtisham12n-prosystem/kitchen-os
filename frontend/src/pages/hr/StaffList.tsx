import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    LayoutGrid,
    List,
    Users,
    UserCheck,
    UserMinus,
    Activity,
    Settings,
    Building2,
    Briefcase,
    Loader2
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import styles from './StaffList.module.css';

interface StaffMember {
    id: string;
    employee_id: string;
    user_name: string;
    email: string;
    department: string;
    designation: string;
    is_active: boolean;
    joining_date: string;
    branch?: { branch_name: string };
    roleEntity?: { role_name: string };
}

const MOCK_STAFF: StaffMember[] = [
    {
        id: '1', employee_id: 'EMP-7701', user_name: 'Muhammad Ali', email: 'm.ali@kitchenos.io',
        department: 'Kitchen Operations', designation: 'Head Chef', is_active: true, joining_date: '2023-01-15',
        branch: { branch_name: 'Nexus Mainframe' }, roleEntity: { role_name: 'Executive' }
    },
    {
        id: '2', employee_id: 'EMP-9902', user_name: 'Sarah Smith', email: 's.smith@alphafoods.com',
        department: 'Management', designation: 'Senior Manager', is_active: true, joining_date: '2023-03-20',
        branch: { branch_name: 'Downtown Flagship' }, roleEntity: { role_name: 'Manager' }
    },
    {
        id: '3', employee_id: 'EMP-4403', user_name: 'Zubair Ahmed', email: 'z.ahmed@kitchenos.io',
        department: 'Service', designation: 'Floor Captain', is_active: false, joining_date: '2023-06-10',
        branch: { branch_name: 'Gulshan Branch' }, roleEntity: { role_name: 'Staff' }
    },
    {
        id: '4', employee_id: 'EMP-2204', user_name: 'Ayesha Malik', email: 'a.malik@kitchenos.io',
        department: 'Kitchen Operations', designation: 'Sous Chef', is_active: true, joining_date: '2023-08-05',
        branch: { branch_name: 'Nexus Mainframe' }, roleEntity: { role_name: 'Executive' }
    },
    {
        id: '5', employee_id: 'EMP-3305', user_name: 'John Doe', email: 'j.doe@kitchenos.io',
        department: 'Logistics', designation: 'Dispatch Rider', is_active: true, joining_date: '2024-01-12',
        branch: { branch_name: 'Westside Express' }, roleEntity: { role_name: 'Staff' }
    }
];

export function StaffList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [isLoading, setIsLoading] = useState(true);



    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    const filteredStaff = useMemo(() => {
        return MOCK_STAFF.filter(s => {
            const matchSearch = !searchTerm ||
                s.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.designation.toLowerCase().includes(searchTerm.toLowerCase());

            const matchStatus = statusFilter === 'all' ||
                (statusFilter === 'active' ? s.is_active : !s.is_active);

            return matchSearch && matchStatus;
        });
    }, [searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total: MOCK_STAFF.length,
        active: MOCK_STAFF.filter(s => s.is_active).length,
        inactive: MOCK_STAFF.filter(s => !s.is_active).length,
        newThisMonth: 1
    }), []);

    const columns: ColumnDef<StaffMember>[] = [
        {
            key: 'user_name',
            header: 'Personnel Identity',
            cell: (row) => (
                <div className={styles.empTableInfo}>
                    <div className={styles.tableAvatar} data-status={row.is_active ? 'active' : 'inactive'}>
                        {row.user_name.charAt(0)}
                        <span className={styles.statusInnerDot} />
                    </div>
                    <div>
                        <div className={styles.tableName}>{row.user_name}</div>
                        <div className={styles.tableSub}>{row.employee_id} • {row.email}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'role',
            header: 'Domain & Assignment',
            cell: (row) => (
                <div className={styles.domainCell}>
                    <div className={styles.domainMain}>{row.department || 'Operations'}</div>
                    <div className={styles.domainSub}>{row.designation || 'Staff'}</div>
                </div>
            )
        },
        {
            key: 'branch',
            header: 'Assigned Station',
            cell: (row) => (
                <div className={styles.stationBadge}>
                    <Building2 size={12} />
                    {row.branch?.branch_name || 'Corporate HQ'}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <div className={`${styles.statusPill} ${row.is_active ? styles.statusActive : styles.statusInactive}`}>
                    {row.is_active ? 'On Duty' : 'Inactive'}
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (row) => (
                <div className={styles.actionGroup}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate(`${row.id}`)} className={styles.configBtn}>
                        <Settings size={14} />
                        Configure
                    </KitchenButton>
                </div>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <div className={styles.iconBox}>
                        <Users size={24} />
                        <span className={styles.liveCount}>{stats.total}</span>
                    </div>
                    <div>
                        <h1 className={styles.title}>Personnel Registry</h1>
                        <p className={styles.subtitle}>Unified directory of organizational staff and operational roles.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <KitchenButton
                        onClick={() => navigate('new')}
                        className={styles.addBtn}
                    >
                        <Plus size={18} />
                        Add Personnel
                    </KitchenButton>
                </div>
            </div>

            {/* Premium KPI Dashboard */}
            <div className={styles.kpiGrid}>
                {[
                    { label: 'Total Personnel', value: stats.total, sub: 'Registered members', icon: Users, color: 'var(--accent-primary)', pct: 100 },
                    { label: 'Active on Duty', value: stats.active, sub: 'Currently operational', icon: UserCheck, color: 'var(--color-success)', pct: (stats.active / stats.total) * 100 },
                    { label: 'Inactive/Leave', value: stats.inactive, sub: 'Off-duty personnel', icon: UserMinus, color: 'var(--color-danger)', pct: (stats.inactive / stats.total) * 100 },
                    { label: 'New This Month', value: stats.newThisMonth, sub: 'Recent integrations', icon: Activity, color: 'var(--accent-secondary)', pct: 25 }
                ].map((kpi, i) => (
                    <div key={i} className={styles.kpiCard} style={{ '--accent': kpi.color } as any}>
                        <div className={styles.kpiTop}>
                            <div className={styles.kpiCircle}>
                                <kpi.icon size={16} />
                            </div>
                            <span className={styles.kpiLabel}>{kpi.label}</span>
                        </div>
                        <div className={styles.kpiBody}>
                            <div className={styles.kpiValue}>{kpi.value}</div>
                            <div className={styles.kpiTrend}>{kpi.sub}</div>
                        </div>
                        <div className={styles.kpiProgress}>
                            <div className={styles.kpiBar} style={{ width: `${kpi.pct}%` }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Registry Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        placeholder="Search by name, ID, domain or designation..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className={styles.toolActions}>
                    <div className={styles.filterGroup}>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.tinySelect}>
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div className={styles.modeSwitcher}>
                        <button
                            className={`${styles.switchBtn} ${viewMode === 'grid' ? styles.switchActive : ''}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            className={`${styles.switchBtn} ${viewMode === 'table' ? styles.switchActive : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className={styles.loaderBox}>
                    <Loader2 size={32} className="spin" />
                    <span>Synchronizing Registry...</span>
                </div>
            ) : viewMode === 'grid' ? (
                <div className={styles.registryGrid}>
                    {filteredStaff.map((staff, i) => (
                        <div key={staff.id} className={styles.personCard} style={{ animationDelay: `${i * 40}ms` }}>
                            <div className={styles.cardHeader}>
                                <div className={styles.avatarLarge} data-active={staff.is_active}>
                                    {staff.user_name.charAt(0)}
                                    <div className={styles.statusRing} />
                                </div>
                                <div className={styles.cardInfo}>
                                    <h3>{staff.user_name}</h3>
                                    <span className={styles.idTag}>{staff.employee_id}</span>
                                </div>
                                <button className={styles.miniBtn} onClick={() => navigate(`${staff.id}`)}>
                                    <Settings size={14} />
                                </button>
                            </div>

                            <div className={styles.cardDetails}>
                                <div className={styles.cardRow}>
                                    <Briefcase size={14} />
                                    <span>{staff.department || 'Operations'}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <Building2 size={14} />
                                    <span>{staff.branch?.branch_name || 'Corporate HQ'}</span>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <span className={styles.roleTag}>{staff.designation || 'Staff'}</span>
                                <span className={`${styles.statusSmall} ${staff.is_active ? styles.active : styles.inactive}`}>
                                    {staff.is_active ? 'Active' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <KitchenTable columns={columns} data={filteredStaff} />
                </div>
            )}
        </div>
    );
}
