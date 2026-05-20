import { useState, useEffect } from 'react';
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
    Globe
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { platformApi, setupApi } from '../../api/api';
import styles from './SystemUserEditor.module.css';

export function SystemUserEditor() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Lookups
    const [lookups, setLookups] = useState<{
        departments: any[];
        designations: any[];
        branches: any[];
        roles: any[];
    }>({
        departments: [],
        designations: [],
        branches: [],
        roles: []
    });

    // Form State
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        employee_id: '',
        role_id: '',
        branch_id: '',
        department_id: '',
        designation_id: '',
        management_pin: '',
        user_type: 'PLATFORM_ADMIN',
        phone: '',
        cnic_number: '',
        address: '',
        is_active: true,
        profile_picture: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                // Parallel fetch lookups - using setupApi for generic lists
                const [depts, desigs, branches, roles] = await Promise.all([
                    setupApi.getDepartments(),
                    setupApi.getDesignations(),
                    setupApi.getBranches(),
                    setupApi.getRoles()
                ]);

                setLookups({
                    departments: depts,
                    designations: desigs,
                    branches: branches,
                    roles: roles
                });

                if (isEdit && id) {
                    const user = await platformApi.getSystemUser(id);
                    setFormData({
                        first_name: user.first_name || '',
                        last_name: user.last_name || '',
                        username: user.username || '',
                        email: user.email || '',
                        password: '', // Don't populate password
                        employee_id: user.employee_id || '',
                        role_id: user.role_id?.toString() || '',
                        branch_id: user.branch_id?.toString() || '',
                        department_id: user.department_id?.toString() || '',
                        designation_id: user.designation_id?.toString() || '',
                        management_pin: user.management_pin || '',
                        user_type: user.user_type || 'PLATFORM_ADMIN',
                        phone: user.phone || '',
                        cnic_number: user.cnic_number || '',
                        address: user.address || '',
                        is_active: user.is_active ?? true,
                        profile_picture: user.profile_picture || ''
                    });
                }
            } catch (error) {
                console.error('Failed to load system user editor data:', error);
                toast.error('Sync Error', 'Could not load required setup data.');
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, [id, isEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (isEdit && id) {
                await platformApi.updateSystemUser(id, formData);
                toast.success('Operator Updated', 'Platform security credentials saved.');
            } else {
                await platformApi.createSystemUser(formData);
                toast.success('Operator Onboarded', 'New platform personnel registry created.');
            }
            navigate('/nexus/users');
        } catch (error) {
            console.error('Failed to save system user:', error);
            toast.error('Save Error', 'Operation could not be completed.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loaderContainer}>
                <Loader2 size={48} className={styles.spin} />
                <p>Synchronizing with Identity Vault...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button onClick={() => navigate('/nexus/users')} className={styles.backButton}>
                    <ArrowLeft size={20} />
                </button>
                <div className={styles.headerTitle}>
                    <h1 className={styles.title}>{isEdit ? 'Refine Operator Profile' : 'Onboard Platform Personnel'}</h1>
                    <p className={styles.subtitle}>Configure global administrative privileges and authentication parameters.</p>
                </div>
                <div className={styles.headerStatus}>
                    {isEdit && <span className={`${styles.statusBadge} ${formData.is_active ? styles.active : styles.suspended} `}>{formData.is_active ? 'ENABLED' : 'REVOKED'}</span>}
                </div>
            </header>

            <form onSubmit={handleSubmit} className={styles.formBody}>
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><User size={20} color="var(--accent-primary)" /> <h3>Platform Identity</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}><label className={styles.required}>First Name</label><input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className={styles.input} required /></div>
                        <div className={styles.field}><label className={styles.required}>Last Name</label><input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className={styles.input} required /></div>
                        <div className={styles.field}><label className={styles.required}>Username / SSO ID</label><div className={styles.inputIconWrap}><Hash size={14} /><input type="text" name="username" value={formData.username} onChange={handleInputChange} className={styles.input} required /></div></div>
                        <div className={styles.field}><label className={styles.required}>System Email</label><div className={styles.inputIconWrap}><Mail size={14} /><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={styles.input} required /></div></div>
                        {!isEdit && (
                            <div className={styles.field}><label className={styles.required}>Password</label><input type="password" name="password" value={formData.password} onChange={handleInputChange} className={styles.input} required /></div>
                        )}
                        <div className={styles.field}><label>Employee Code</label><input type="text" name="employee_id" value={formData.employee_id} onChange={handleInputChange} className={styles.input} placeholder="Auto-gen" /></div>
                    </div>
                </section>

                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><Globe size={20} color="var(--accent-secondary)" /> <h3>Nexus Deployment</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.required}>Administrative Level</label>
                            <select name="user_type" value={formData.user_type} onChange={handleInputChange} className={styles.select} required>
                                <option value="PLATFORM_ADMIN">Nexus Platform Operator</option>
                                <option value="CLIENT_ADMIN">Client Organization Admin</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Security Role</label>
                            <select name="role_id" value={formData.role_id} onChange={handleInputChange} className={styles.select} required>
                                <option value="">Assign Role</option>
                                {lookups.roles.map(r => <option key={r.id} value={r.id.toString()}>{r.role_name}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Assigned Department</label>
                            <select name="department_id" value={formData.department_id} onChange={handleInputChange} className={styles.select}>
                                <option value="">Select Department</option>
                                {lookups.departments.map(d => <option key={d.id} value={d.id.toString()}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Status</label>
                            <div className={styles.toggleRow}>
                                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} id="user-status" />
                                <label htmlFor="user-status">Account Active & Authorized</label>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}><Briefcase size={20} color="var(--accent-tertiary)" /> <h3>Secure Communications</h3></div>
                    <div className={styles.grid}>
                        <div className={styles.field}><label>Mobile Number</label><div className={styles.inputIconWrap}><Phone size={14} /><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={styles.input} /></div></div>
                        <div className={`${styles.field} ${styles.fullWidth} `}><label>Vault Address</label><div className={styles.inputIconWrap}><MapPin size={14} /><textarea name="address" value={formData.address} onChange={handleInputChange} className={styles.textarea} /></div></div>
                    </div>
                </section>

                <footer className={styles.formFooter}>
                    <KitchenButton type="button" variant="ghost" onClick={() => navigate('/nexus/users')}>Discard Changes</KitchenButton>
                    <KitchenButton type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                        Save Personnel Profile
                    </KitchenButton>
                </footer>
            </form>
        </div>
    );
}

export default SystemUserEditor;
