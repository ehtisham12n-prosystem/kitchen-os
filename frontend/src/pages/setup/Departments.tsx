import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    X,
    Save,
    Loader2,
    Building2,
    Users,
    CheckCircle2,
    Circle,
    Hash,
    Layers,
    LayoutGrid,
    List,
    Building
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { toast } from '../../components/ui/KitchenToast/toast';
import { setupApi, userApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import styles from './DepartmentManagement.module.css';

const userContext = readStoredUserContext() || {};
const CURRENT_CLIENT_NAME = userContext.client_name || 'My Client';

interface BranchOption {
    id: string;
    name: string;
    code: string;
}

interface Department {
    id: number;
    code: string;
    name: string;
    description: string;
    headName: string;
    staffCount: number;
    isActive: boolean;
    branchAvailability: Record<string, boolean>; // Branch ID -> Enabled
}

interface User {
    id: number;
    name: string;
    employee_id: string;
    branch: string;
    dept: string;
    designation: string;
}

export function Departments() {
    const [searchTerm, setSearchTerm] = useState('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [peekUsers, setPeekUsers] = useState<User[]>([]);
    const [isPeekOpen, setIsPeekOpen] = useState(false);
    const [peekTitle, setPeekTitle] = useState('');

    // Form State
    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formHead, setFormHead] = useState('');
    const [formStatus, setFormStatus] = useState(true);
    const [formBranches, setFormBranches] = useState<Record<string, boolean>>({});
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    useEffect(() => {
        const fetchDepartments = async () => {
            setIsLoading(true);
            try {
                const [departmentData, branchData, userData] = await Promise.all([
                    setupApi.getDepartments(),
                    setupApi.getBranches(),
                    userApi.getUsers(),
                ]);

                const mappedUsers: User[] = userData.map((user: any) => ({
                    id: user.id,
                    name: user.full_name || user.user_name,
                    employee_id: user.employee_id || `USR-${user.id}`,
                    branch: user.branchRoles?.find((role: any) => role.is_primary)?.branch?.branch_name
                        || user.branchRoles?.[0]?.branch?.branch_name
                        || 'Global HQ',
                    dept: user.department?.name || 'Unassigned',
                    designation: user.designation?.name || 'Unassigned',
                }));

                setUsers(mappedUsers);
                setBranches(branchData.map((branch: any) => ({
                    id: String(branch.id),
                    name: branch.branch_name,
                    code: branch.branch_code,
                })));
                setDepartments(departmentData.map((department: any) => ({
                    id: department.id,
                    code: department.code,
                    name: department.name,
                    description: department.description || '',
                    headName: department.headName || '',
                    staffCount: mappedUsers.filter((user) => user.dept === department.name).length,
                    isActive: department.isActive !== false,
                    branchAvailability: department.branchAvailability || {},
                })));
            } catch (error) {
                console.error('Failed to fetch departments:', error);
                toast.error('Sync Error', 'Could not load department registry.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDepartments();
    }, []);

    // Auto-generate code
    useEffect(() => {
        if (!editingDept && formName.length >= 3) {
            const prefix = formName.substring(0, 3).toUpperCase();
            setFormCode(`DEP-${prefix}`);
        }
    }, [formName, editingDept]);

    const handlePeekUsers = (deptName: string) => {
        setPeekTitle(`Personnel Registry: ${deptName}`);
        setPeekUsers(users.filter(u => u.dept === deptName));
        setIsPeekOpen(true);
    };

    const handleOpenModal = (dept: Department | null = null) => {
        if (dept) {
            setEditingDept(dept);
            setFormName(dept.name);
            setFormCode(dept.code);
            setFormDesc(dept.description);
            setFormHead(dept.headName);
            setFormStatus(dept.isActive);
            setFormBranches(dept.branchAvailability);
        } else {
            setEditingDept(null);
            setFormName('');
            setFormCode('');
            setFormDesc('');
            setFormHead('');
            setFormStatus(true);
            const initialBranches: Record<string, boolean> = {};
            branches.forEach(b => initialBranches[b.id] = true);
            setFormBranches(initialBranches);
        }
        setIsModalOpen(true);
    };

    const toggleBranch = (id: string) => {
        setFormBranches(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                name: formName,
                code: formCode,
                description: formDesc,
                headName: formHead,
                isActive: formStatus,
                branchAvailability: formBranches,
            };

            const saved: any = editingDept
                ? await setupApi.updateDepartment(editingDept.id, payload)
                : await setupApi.createDepartment(payload);

            const nextDepartment: Department = {
                id: saved.id,
                name: saved.name,
                code: saved.code,
                description: saved.description || '',
                headName: saved.headName || '',
                isActive: saved.isActive !== false,
                branchAvailability: saved.branchAvailability || {},
                staffCount: users.filter((user) => user.dept === saved.name).length,
            };

            if (editingDept) {
                setDepartments(prev => prev.map(d => d.id === editingDept.id ? nextDepartment : d));
                toast.success('Department Updated', 'Changes have been saved successfully.');
            } else {
                setDepartments(prev => [nextDepartment, ...prev]);
                toast.success('Department Created', 'A new department has been added to the registry.');
            }

            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save department:', error);
            toast.error('Save Failed', error.message || 'Could not save department.');
        } finally {
            setIsSaving(false);
        }
    };

    const userColumns: ColumnDef<User>[] = [
        { key: 'name', header: 'Staff Name', cell: (row) => <div style={{ fontWeight: 600 }}>{row.name}</div> },
        { key: 'employee_id', header: 'User ID', cell: (row) => <code style={{ color: 'var(--accent-tertiary)' }}>{row.employee_id}</code> },
        { key: 'branch', header: 'Branch', cell: (row) => row.branch },
        { key: 'dept', header: 'Department', cell: (row) => row.dept },
        { key: 'designation', header: 'Designation', cell: (row) => <span style={{ color: 'var(--accent-secondary)' }}>{row.designation}</span> }
    ];

    const columns: ColumnDef<Department>[] = [
        {
            key: 'name',
            header: 'Department / Division',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-deep)', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <Layers size={16} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{row.code}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'headName',
            header: 'Dept. Head',
            cell: (row) => row.headName || 'Unassigned'
        },
        {
            key: 'staffCount',
            header: 'Personnel',
            cell: (row) => (
                <div
                    onClick={() => handlePeekUsers(row.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                >
                    <Users size={14} color="var(--accent-secondary)" />
                    <span style={{ fontWeight: 600, borderBottom: '1px dashed var(--accent-secondary-transparent)' }}>
                        {row.staffCount || 0}
                    </span>
                </div>
            )
        },
        {
            key: 'branchAvailability',
            header: 'Scope',
            cell: (row) => {
                const count = Object.values(row.branchAvailability).filter(Boolean).length;
                return (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Enabled in {count} {count === 1 ? 'branch' : 'branches'}
                    </span>
                );
            }
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                    ...(row.isActive ? { background: 'var(--accent-primary-transparent)', color: 'var(--accent-primary)' } : { background: 'var(--bg-deep)', color: 'var(--text-tertiary)' })
                }}>
                    {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
            )
        },
        {
            key: 'actions',
            header: '',
            cell: (row) => (
                <KitchenButton variant="secondary" size="sm" onClick={() => handleOpenModal(row)}>Update</KitchenButton>
            ),
            align: 'right'
        }
    ];

    const filteredDepts = departments.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Department Registry</h1>
                    <p>Manage corporate divisions and their operational availability across branches.</p>
                </div>
                <KitchenButton variant="primary" onClick={() => handleOpenModal()} style={{ gap: '8px' }}>
                    <Plus size={18} />
                    Create New Department
                </KitchenButton>
            </header>

            <div className={styles.kpiGrid}>
                {/* Global Divisions */}
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                <Building2 size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Global Divisions</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{departments.length}</div>
                    <div className={styles.kpiMeta}>Active organizational units</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Total Personnel */}
                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                <Users size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Total Personnel</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{departments.reduce((acc, d) => acc + d.staffCount, 0).toLocaleString()}</div>
                    <div className={styles.kpiMeta}>Staff assigned to divisions</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '74%' }} />
                    </div>
                </div>

                {/* Distribution */}
                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                                <Layers size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Active Registry</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{departments.filter(d => d.isActive).length}</div>
                    <div className={styles.kpiMeta}>Departments in active use</div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '85%' }} />
                    </div>
                </div>
            </div>

            <KitchenCard style={{ padding: '0' }}>
                <div className={styles.toolbar} style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                    <div className={styles.searchWrap}>
                        <Search className={styles.searchIcon} size={18} />
                        <KitchenInput
                            placeholder="Search by department name or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            containerClassName={styles.searchInput}
                        />
                    </div>

                    <div className={styles.viewToggle}>
                        <button
                            className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.activeMode : ''}`}
                            onClick={() => setViewMode('table')}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                        <button
                            className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.activeMode : ''}`}
                            onClick={() => setViewMode('cards')}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Loader2 size={32} className="spinner" color="var(--accent-primary)" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Syncing registry data...</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <KitchenTable columns={columns} data={filteredDepts} />
                ) : (
                    <div className={styles.departmentGrid}>
                        {filteredDepts.map(dept => (
                            <div key={dept.id} className={styles.deptCard}>
                                <div className={styles.deptCardHeader}>
                                    <div className={styles.deptIcon}>
                                        <Building size={20} />
                                    </div>
                                    <div className={styles.deptMain}>
                                        <h3>{dept.name}</h3>
                                        <code>{dept.code}</code>
                                    </div>
                                    <KitchenButton variant="ghost" size="sm" onClick={() => handleOpenModal(dept)}>
                                        Update
                                    </KitchenButton>
                                </div>
                                <p className={styles.deptDesc}>{dept.description}</p>
                                <div className={styles.deptFooter}>
                                    <div
                                        className={styles.deptStat}
                                        onClick={() => handlePeekUsers(dept.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Users size={14} />
                                        <span style={{ borderBottom: '1px dashed var(--text-tertiary)' }}>{dept.staffCount} Staff</span>
                                    </div>
                                    <span className={`${styles.statusBadge} ${dept.isActive ? styles.active : ''}`}>
                                        {dept.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </KitchenCard>

            {/* User Peek Modal */}
            {isPeekOpen && (
                <div className={styles.peekOverlay}>
                    <div className={styles.peekModal}>
                        <div className={styles.peekHeader}>
                            <h2>{peekTitle}</h2>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setIsPeekOpen(false)}>
                                <X size={20} />
                            </KitchenButton>
                        </div>
                        <div className={styles.peekBody}>
                            <KitchenTable columns={userColumns} data={peekUsers} />
                        </div>
                        <div className={styles.peekFooter}>
                            <KitchenButton onClick={() => setIsPeekOpen(false)}>Close Registry</KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Revamped Form Modal */}
            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{editingDept ? 'Update Department' : 'Establish New Department'}</h2>
                            <KitchenButton variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </KitchenButton>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className={styles.modalBody}>
                                <div className={styles.row}>
                                    <KitchenInput
                                        label="Client Environment"
                                        value={CURRENT_CLIENT_NAME}
                                        disabled
                                        readOnly
                                    />
                                    <KitchenInput
                                        label="Department Status"
                                        value={formStatus ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                                        onClick={() => setFormStatus(!formStatus)}
                                        style={{ cursor: 'pointer' }}
                                        readOnly
                                    />
                                </div>

                                <div className={styles.row}>
                                    <KitchenInput
                                        label="Department Name"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Quality Assurance"
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <Hash size={16} style={{ position: 'absolute', left: '12px', top: '38px', color: 'var(--text-tertiary)', zIndex: 1 }} />
                                        <KitchenInput
                                            label="Dept. Code (Auto)"
                                            required
                                            value={formCode}
                                            onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                            placeholder="Auto-generated"
                                            style={{ paddingLeft: '36px' }}
                                            disabled={!editingDept}
                                        />
                                    </div>
                                </div>

                                <KitchenInput
                                    label="Brief Description"
                                    value={formDesc}
                                    onChange={(e) => setFormDesc(e.target.value)}
                                    placeholder="Scope of work and responsibilities..."
                                />

                                <div className={styles.separator} data-label="Branch Availability Management" />

                                <div className={styles.branchGrid}>
                                    {branches.map(branch => {
                                        const isEnabled = formBranches[branch.id];
                                        return (
                                            <div
                                                key={branch.id}
                                                className={`${styles.branchToggle} ${isEnabled ? styles.enabled : ''}`}
                                                onClick={() => toggleBranch(branch.id)}
                                            >
                                                <div className={styles.branchInfo}>
                                                    <span className={styles.branchName}>{branch.name}</span>
                                                    <span className={styles.branchCode}>{branch.code}</span>
                                                </div>
                                                {isEnabled ? <CheckCircle2 size={18} color="var(--accent-primary)" /> : <Circle size={18} color="var(--text-tertiary)" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <KitchenButton variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Discard</KitchenButton>
                                <KitchenButton type="submit" isLoading={isSaving} disabled={!formName || !formCode}>
                                    <Save size={18} style={{ marginRight: '8px' }} />
                                    {editingDept ? 'Save Changes' : 'Establish Dept.'}
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
