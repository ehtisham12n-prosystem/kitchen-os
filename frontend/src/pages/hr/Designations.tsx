/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import {
    Plus,
    Search,
    X,
    Save,
    Loader2,
    Award,
    Users,
    CheckCircle2,
    Circle,
    Hash,
    Store
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { setupApi, userApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import styles from './DesignationManagement.module.css';

// Context data
const userContext = readStoredUserContext() || {};
const CURRENT_CLIENT_NAME = userContext.client_name || 'My Client';

interface BranchOption {
    id: string;
    name: string;
    code: string;
}

interface DepartmentOption {
    id: string;
    name: string;
}

const LEVELS = [
    { value: 'Senior Management', label: 'Senior Management' },
    { value: 'Management', label: 'Management' },
    { value: 'Specialist', label: 'Specialist' },
    { value: 'Staff', label: 'Staff' },
    { value: 'Contractor', label: 'Contractor' }
];

interface Designation {
    id: number;
    code: string;
    name: string;
    departmentName: string;
    level: string;
    staffCount: number;
    isActive: boolean;
    branchAvailability: Record<string, boolean>;
}

interface User {
    id: number;
    name: string;
    employee_id: string;
    branch: string;
    dept: string;
    designation: string;
}

export function Designations() {
    const [searchTerm, setSearchTerm] = useState('');
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingDes, setEditingDes] = useState<Designation | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [departments, setDepartments] = useState<DepartmentOption[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [peekUsers, setPeekUsers] = useState<User[]>([]);
    const [isPeekOpen, setIsPeekOpen] = useState(false);
    const [peekTitle, setPeekTitle] = useState('');

    // Form State
    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formDept, setFormDept] = useState('');
    const [formLevel, setFormLevel] = useState('');
    const [formStatus, setFormStatus] = useState(true);
    const [formBranches, setFormBranches] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchDesignations = async () => {
            setIsLoading(true);
            try {
                const [designationData, branchData, departmentData, userData] = await Promise.all([
                    setupApi.getDesignations(),
                    setupApi.getBranches(),
                    setupApi.getDepartments(),
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
                setDepartments(
                    departmentData.map((department: any) => ({
                        id: String(department.id),
                        name: String(department.name || ''),
                    })).filter((department: DepartmentOption) => department.name.trim().length > 0),
                );
                setDesignations(designationData.map((designation: any) => ({
                    id: designation.id,
                    code: designation.code,
                    name: designation.name,
                    departmentName: designation.departmentName || '',
                    level: designation.level || '',
                    staffCount: mappedUsers.filter((user) => user.designation === designation.name).length,
                    isActive: designation.isActive !== false,
                    branchAvailability: designation.branchAvailability || {},
                })));
            } catch (error) {
                console.error('Failed to fetch designations:', error);
                toast.error('Sync Error', 'Could not load designations.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDesignations();
    }, []);

    // Branch code is now handled by backend sequentially or auto-prefix logic
    useEffect(() => {
        if (!editingDes && formName.length >= 3) {
            setFormCode(`DES-${formName.substring(0, 3).toUpperCase()}`);
        }
    }, [formName, editingDes]);

    const handlePeekUsers = (roleName: string) => {
        setPeekTitle(`Personnel Registry: ${roleName}`);
        setPeekUsers(users.filter(u => u.designation === roleName));
        setIsPeekOpen(true);
    };

    const handleOpenModal = (des: Designation | null = null) => {
        if (des) {
            setEditingDes(des);
            setFormName(des.name);
            setFormCode(des.code);
            setFormDept(des.departmentName);
            setFormLevel(des.level);
            setFormStatus(des.isActive);
            setFormBranches(des.branchAvailability);
        } else {
            setEditingDes(null);
            setFormName('');
            setFormCode('AUTO');
            setFormDept('');
            setFormLevel('');
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
                departmentName: formDept,
                level: formLevel,
                isActive: formStatus,
                branchAvailability: formBranches,
            };

            const saved: any = editingDes
                ? await setupApi.updateDesignation(editingDes.id, payload)
                : await setupApi.createDesignation(payload);

            const nextDesignation: Designation = {
                id: saved.id,
                name: saved.name,
                code: saved.code,
                departmentName: saved.departmentName || '',
                level: saved.level || '',
                isActive: saved.isActive !== false,
                staffCount: users.filter((user) => user.designation === saved.name).length,
                branchAvailability: saved.branchAvailability || {},
            };

            if (editingDes) {
                setDesignations(prev => prev.map(d => d.id === editingDes.id ? nextDesignation : d));
                toast.success('Designation Updated', 'Changes have been saved successfully.');
            } else {
                setDesignations(prev => [nextDesignation, ...prev]);
                toast.success('Designation Created', 'A new role has been added to the hierarchy.');
            }

            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save designation:', error);
            toast.error('Save Failed', error.message || 'Could not save designation.');
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

    const columns: ColumnDef<Designation>[] = [
        {
            key: 'name',
            header: 'Role / Designation',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-deep)', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <Award size={16} color="var(--accent-secondary)" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{row.code}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'departmentName',
            header: 'Department',
            cell: (row) => row.departmentName
        },
        {
            key: 'staffCount',
            header: 'Occupancy',
            cell: (row) => (
                <div
                    onClick={() => handlePeekUsers(row.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                >
                    <Users size={14} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 600, borderBottom: '1px dashed var(--accent-primary-transparent)' }}>
                        {row.staffCount || 0}
                    </span>
                </div>
            )
        },
        {
            key: 'level',
            header: 'Tier Level',
            cell: (row) => (
                <span style={{ fontSize: '13px', color: 'var(--accent-secondary)', fontWeight: 500 }}>
                    {row.level}
                </span>
            )
        },
        {
            key: 'branchAvailability',
            header: 'Scope',
            cell: (row) => {
                const count = Object.values(row.branchAvailability || {}).filter(Boolean).length;
                return (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Store size={12} /> {count} Branches
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
                <KitchenButton variant="secondary" size="sm" onClick={() => handleOpenModal(row)}>Configure</KitchenButton>
            ),
            align: 'right'
        }
    ];

    const filteredDes = designations.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Designation Hierarchy</h1>
                    <p>Define organizational roles, tier levels, and cross-branch operational availability.</p>
                </div>
                <KitchenButton variant="primary" onClick={() => handleOpenModal()} style={{ gap: '8px' }}>
                    <Plus size={18} />
                    Create New Designation
                </KitchenButton>
            </header>

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={16} color="var(--accent-primary)" />
                        <span className={styles.kpiLabel}>Active Roles</span>
                    </div>
                    <span className={styles.kpiValue}>{designations.length}</span>
                </div>
                <div className={styles.kpiCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} color="var(--accent-secondary)" />
                        <span className={styles.kpiLabel}>Total Occupancy</span>
                    </div>
                    <span className={styles.kpiValue}>{designations.reduce((acc, d) => acc + d.staffCount, 0)}</span>
                </div>
                <div className={styles.kpiCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Hash size={16} color="var(--success)" />
                        <span className={styles.kpiLabel}>Hierarchy Tiers</span>
                    </div>
                    <span className={styles.kpiValue}>{LEVELS.length}</span>
                </div>
                <div className={styles.kpiCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={16} color="var(--warning)" />
                        <span className={styles.kpiLabel}>Top Department</span>
                    </div>
                    <span className={styles.kpiValue} style={{ fontSize: '14px' }}>Kitchen Operations</span>
                </div>
            </div>

            <KitchenCard style={{ padding: '0' }}>
                <div className={styles.toolbar} style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                    <div className={styles.searchWrap}>
                        <Search className={styles.searchIcon} size={18} />
                        <KitchenInput
                            placeholder="Search by role title or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            containerClassName={styles.searchInput}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Loader2 size={32} className="spinner" color="var(--accent-primary)" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Syncing designation data...</p>
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={filteredDes} />
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

            {/* Form Modal */}
            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{editingDes ? 'Update Designation' : 'Establish New Designation'}</h2>
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
                                        label="Role Status"
                                        value={formStatus ? 'ðŸŸ¢ ACTIVE' : 'ðŸ”´ INACTIVE'}
                                        onClick={() => setFormStatus(!formStatus)}
                                        style={{ cursor: 'pointer' }}
                                        readOnly
                                    />
                                </div>

                                <div className={styles.row}>
                                    <KitchenInput
                                        label="Official Title"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Senior Sous Chef"
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <Hash size={16} style={{ position: 'absolute', left: '12px', top: '38px', color: 'var(--text-tertiary)', zIndex: 1 }} />
                                        <KitchenInput
                                            label="Code (Auto)"
                                            required
                                            value={formCode}
                                            onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                            placeholder="AUTO"
                                            style={{ paddingLeft: '36px' }}
                                            disabled={!editingDes}
                                        />
                                    </div>
                                </div>

                                <div className={styles.row}>
                                    <KitchenSelect
                                        label="Tier Level"
                                        required
                                        options={LEVELS}
                                        value={formLevel}
                                        onChange={(e) => setFormLevel(e.target.value)}
                                    />
                                    <KitchenSelect
                                        label="Primary Department"
                                        required
                                        options={[
                                            { value: '', label: 'Select Department' },
                                            ...departments.map((department) => ({
                                                value: department.name,
                                                label: department.name,
                                            })),
                                        ]}
                                        value={formDept}
                                        onChange={(e) => setFormDept(e.target.value)}
                                    />
                                </div>

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
                                <KitchenButton type="submit" isLoading={isSaving} disabled={!formName || !formLevel || !formDept}>
                                    <Save size={18} style={{ marginRight: '8px' }} />
                                    {editingDes ? 'Save Changes' : 'Establish Role'}
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

