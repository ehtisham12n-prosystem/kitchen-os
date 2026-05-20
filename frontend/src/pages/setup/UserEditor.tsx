import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    User,
    Briefcase,
    Loader2,
    Phone,
    Mail,
    MapPin,
    Hash,
    Building2,
    Plus,
    Trash2,
    Store,
} from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { userApi, setupApi } from '../../api/api';
import styles from './UserEditor.module.css';

type BranchAssignmentForm = {
    key: string;
    branchId: string;
    roleId: string;
    isPrimary: boolean;
};

const EMPTY_ASSIGNMENT = (): BranchAssignmentForm => ({
    key: `${Date.now()}-${Math.random()}`,
    branchId: '',
    roleId: '',
    isPrimary: false,
});

export function UserEditor() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [lookups, setLookups] = useState<{
        departments: any[];
        designations: any[];
        branches: any[];
        roles: any[];
    }>({
        departments: [],
        designations: [],
        branches: [],
        roles: [],
    });

    const [branchAssignments, setBranchAssignments] = useState<BranchAssignmentForm[]>([{
        ...EMPTY_ASSIGNMENT(),
        isPrimary: true,
    }]);

    const [formData, setFormData] = useState({
        full_name: '',
        user_name: '',
        email: '',
        password: '',
        employee_id: '',
        role_id: '',
        department_id: '',
        designation_id: '',
        management_pin: '',
        pos_approval_pin: '',
        pos_user_pin: '',
        user_type: 'BRANCH_STAFF',
        phone: '',
        cnic_number: '',
        address: '',
        status: 'active',
        profile_picture: '',
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const [depts, desigs, branches, roles] = await Promise.all([
                    setupApi.getDepartments(),
                    setupApi.getDesignations(),
                    setupApi.getBranches(),
                    setupApi.getRoles(),
                ]);

                setLookups({
                    departments: depts,
                    designations: desigs,
                    branches,
                    roles,
                });

                if (isEdit && id) {
                    const user = await userApi.getUser(id);
                    setFormData({
                        full_name: user.full_name || user.user_name || '',
                        user_name: user.user_name || '',
                        email: user.email || '',
                        password: '',
                        employee_id: user.employee_id || '',
                        role_id: user.role_id?.toString() || '',
                        department_id: user.department_id?.toString() || '',
                        designation_id: user.designation_id?.toString() || '',
                        management_pin: user.management_pin || '',
                        pos_approval_pin: user.pos_approval_pin || '',
                        pos_user_pin: user.pos_user_pin || '',
                        user_type: user.user_type || 'BRANCH_STAFF',
                        phone: user.phone || '',
                        cnic_number: user.cnic_number || '',
                        address: user.address || '',
                        status: user.status || 'active',
                        profile_picture: user.profile_picture || '',
                    });

                    const assignments = (user.branchRoles || []).map((assignment: any) => ({
                        key: `assignment-${assignment.id || assignment.branch_id}`,
                        branchId: String(assignment.branch_id),
                        roleId: assignment.role_id ? String(assignment.role_id) : '',
                        isPrimary: Boolean(assignment.is_primary),
                    }));

                    if (assignments.length > 0) {
                        setBranchAssignments(assignments);
                    } else if (user.user_type === 'BRANCH_STAFF') {
                        setBranchAssignments([{ ...EMPTY_ASSIGNMENT(), isPrimary: true }]);
                    } else {
                        setBranchAssignments([]);
                    }
                }
            } catch (error) {
                console.error('Failed to load user editor data:', error);
                toast.error('Users', 'Could not load required setup data.');
            } finally {
                setIsLoading(false);
            }
        };

        void loadInitialData();
    }, [id, isEdit]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const addAssignment = () => {
        setBranchAssignments((prev) => [
            ...prev,
            {
                ...EMPTY_ASSIGNMENT(),
                roleId: formData.role_id,
                isPrimary: prev.length === 0,
            },
        ]);
    };

    const updateAssignment = (key: string, field: keyof BranchAssignmentForm, value: string | boolean) => {
        setBranchAssignments((prev) => prev.map((assignment) => {
            if (assignment.key !== key) {
                return field === 'isPrimary' && value === true
                    ? { ...assignment, isPrimary: false }
                    : assignment;
            }

            return {
                ...assignment,
                [field]: value,
            };
        }));
    };

    const removeAssignment = (key: string) => {
        setBranchAssignments((prev) => {
            const next = prev.filter((assignment) => assignment.key !== key);
            if (next.length === 1 && !next[0].isPrimary) {
                next[0] = { ...next[0], isPrimary: true };
            }
            return next;
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            const cleanedAssignments = branchAssignments
                .filter((assignment) => assignment.branchId)
                .map((assignment, index) => ({
                    branchId: Number(assignment.branchId),
                    roleId: assignment.roleId ? Number(assignment.roleId) : (formData.role_id ? Number(formData.role_id) : undefined),
                    isPrimary: assignment.isPrimary || index === 0,
                    directPermissions: [],
                }));

            const payload = {
                ...formData,
                role_id: formData.role_id ? Number(formData.role_id) : undefined,
                department_id: formData.department_id ? Number(formData.department_id) : undefined,
                designation_id: formData.designation_id ? Number(formData.designation_id) : undefined,
                branchAssignments: cleanedAssignments.length > 0 ? cleanedAssignments : undefined,
                password: formData.password || undefined,
            };

            if (isEdit && id) {
                await userApi.updateUser(id, payload);
                toast.success('Users', 'User profile updated.');
            } else {
                await userApi.createUser(payload);
                toast.success('Users', 'User created.');
            }
            navigate('/console/setup/users');
        } catch (error: any) {
            console.error('Failed to save user:', error);
            toast.error('Users', error.message || 'Operation could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loaderContainer}>
                <Loader2 size={48} className={styles.spin} />
                <p>Establishing secure connection to registry...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button onClick={() => navigate('/console/setup/users')} className={styles.backButton}>
                    <ArrowLeft size={20} />
                </button>
                <div className={styles.headerTitle}>
                    <h1 className={styles.title}>{isEdit ? 'Refine Profile' : 'Onboard Personnel'}</h1>
                    <p className={styles.subtitle}>Configure identity, branch assignment, and access role boundaries.</p>
                </div>
                <div className={styles.headerStatus}>
                    {isEdit && <span className={`${styles.statusBadge} ${styles[formData.status.toLowerCase()]} `}>{formData.status}</span>}
                </div>
            </header>

            <form onSubmit={handleSubmit} className={styles.formBody}>
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><User size={20} /> <h3>Identity & Account</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}><label className={styles.required}>Full Name</label><input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} className={styles.input} required /></div>
                        <div className={styles.field}><label className={styles.required}>Username</label><input type="text" name="user_name" value={formData.user_name} onChange={handleInputChange} className={styles.input} required /></div>
                        {!isEdit && (
                            <div className={styles.field}><label className={styles.required}>Password</label><input type="password" name="password" value={formData.password} onChange={handleInputChange} className={styles.input} required /></div>
                        )}
                        <div className={styles.field}><label>Email Address</label><div className={styles.inputIconWrap}><Mail size={14} /><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={styles.input} /></div></div>
                        <div className={styles.field}><label>Employee ID</label><div className={styles.inputIconWrap}><Hash size={14} /><input type="text" name="employee_id" value={formData.employee_id} onChange={handleInputChange} className={styles.input} placeholder="Auto-generated if empty" /></div></div>
                        <div className={styles.field}><label>Management PIN</label><input type="password" name="management_pin" value={formData.management_pin} onChange={handleInputChange} className={styles.input} maxLength={10} /></div>
                        <div className={styles.field}><label>POS Approval PIN</label><input type="password" name="pos_approval_pin" value={formData.pos_approval_pin} onChange={handleInputChange} className={styles.input} maxLength={10} /></div>
                        <div className={styles.field}><label>POS User PIN</label><input type="password" name="pos_user_pin" value={formData.pos_user_pin} onChange={handleInputChange} className={styles.input} maxLength={10} /></div>
                    </div>
                </section>

                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><Building2 size={20} /> <h3>Deployment & Role</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.required}>User Type</label>
                            <select name="user_type" value={formData.user_type} onChange={handleInputChange} className={styles.select} required>
                                <option value="CLIENT_ADMIN">Client Admin</option>
                                <option value="BRANCH_STAFF">Branch Staff</option>
                                <option value="PLATFORM_ADMIN">Platform Admin</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Default Role</label>
                            <select name="role_id" value={formData.role_id} onChange={handleInputChange} className={styles.select}>
                                <option value="">Select Role</option>
                                {lookups.roles.map((role) => <option key={role.id} value={role.id.toString()}>{role.role_name}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Department</label>
                            <select name="department_id" value={formData.department_id} onChange={handleInputChange} className={styles.select}>
                                <option value="">Select Department</option>
                                {lookups.departments.map((department) => <option key={department.id} value={department.id.toString()}>{department.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Designation</label>
                            <select name="designation_id" value={formData.designation_id} onChange={handleInputChange} className={styles.select}>
                                <option value="">Select Designation</option>
                                {lookups.designations.map((designation) => <option key={designation.id} value={designation.id.toString()}>{designation.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Account Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className={styles.select} required>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.grid} style={{ marginTop: '20px' }}>
                        <div className={`${styles.field} ${styles.fullWidth}`}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Store size={14} />
                                Branch Assignments
                            </label>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {branchAssignments.length === 0 && (
                                    <div className={styles.input}>No branch assignments configured.</div>
                                )}
                                {branchAssignments.map((assignment) => (
                                    <div key={assignment.key} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto auto', gap: '12px', alignItems: 'center' }}>
                                        <select value={assignment.branchId} onChange={(e) => updateAssignment(assignment.key, 'branchId', e.target.value)} className={styles.select}>
                                            <option value="">Select Branch</option>
                                            {lookups.branches.map((branch) => <option key={branch.id} value={branch.id.toString()}>{branch.branch_name}</option>)}
                                        </select>
                                        <select value={assignment.roleId} onChange={(e) => updateAssignment(assignment.key, 'roleId', e.target.value)} className={styles.select}>
                                            <option value="">Use Default Role</option>
                                            {lookups.roles.map((role) => <option key={role.id} value={role.id.toString()}>{role.role_name}</option>)}
                                        </select>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                            <input type="radio" checked={assignment.isPrimary} onChange={() => updateAssignment(assignment.key, 'isPrimary', true)} name="primary-branch" />
                                            Primary
                                        </label>
                                        <button type="button" onClick={() => removeAssignment(assignment.key)} className={styles.cancelBtn}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={addAssignment} className={styles.saveBtn} style={{ width: 'fit-content' }}>
                                    <Plus size={14} />
                                    Add Branch Assignment
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><Briefcase size={20} /> <h3>Personal Details</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}><label>Phone Number</label><div className={styles.inputIconWrap}><Phone size={14} /><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={styles.input} /></div></div>
                        <div className={styles.field}><label>CNIC / National ID</label><input type="text" name="cnic_number" value={formData.cnic_number} onChange={handleInputChange} className={styles.input} /></div>
                        <div className={`${styles.field} ${styles.fullWidth} `}><label>Primary Address</label><div className={styles.inputIconWrap}><MapPin size={14} /><textarea name="address" value={formData.address} onChange={handleInputChange} className={styles.textarea} /></div></div>
                    </div>
                </section>

                <footer className={styles.formFooter}>
                    <button type="button" onClick={() => navigate('/console/setup/users')} className={styles.cancelBtn}>Discard Changes</button>
                    <button type="submit" disabled={isSaving} className={styles.saveBtn}>
                        {isSaving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                        Confirm & Save Profile
                    </button>
                </footer>
            </form>
        </div>
    );
}
