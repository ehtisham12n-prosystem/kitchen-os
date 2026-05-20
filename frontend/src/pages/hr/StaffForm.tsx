/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    User,
    Briefcase,
    Wallet,
    ShieldCheck,
    Paperclip,
    Plus,
    Trash2,
    Loader2,
    Phone,
    ChefHat
} from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './StaffForm.module.css';

interface Attachment {
    id: string;
    title: string;
    file: File | null;
    fileName?: string;
}

const buildInitialFormData = (isEdit: boolean) => ({
    fullName: isEdit ? 'Muhammad Ali' : '',
    fatherHusbandName: isEdit ? 'Muhammad Arshad' : '',
    gender: isEdit ? 'Male' : '',
    religion: isEdit ? 'Islam' : '',
    sect: '',
    cnic: '',
    dob: '',
    mobile: isEdit ? '03001234567' : '',
    email: isEdit ? 'm.ali@kitchenos.com' : '',
    address: '',
    locality: '',
    city: '',
    country: 'Pakistan',
    employeeId: isEdit ? 'EMP-2024-001' : '',
    joiningDate: new Date().toISOString().split('T')[0],
    designationId: isEdit ? 'Executive Chef' : '',
    departmentId: isEdit ? 'Kitchen' : '',
    stationId: isEdit ? 'Main Branch' : '',
    employmentType: 'Full Time',
    status: 'Active',
    leavingDate: '',
    currentSalary: isEdit ? '50000' : '',
    salaryType: 'Monthly',
    salaryRevisionDate: '',
    hrRemarks: '',
    enableSystemAccess: isEdit,
    systemUsername: isEdit ? 'ali_chef' : '',
    systemRoleId: '',
    accountStatus: 'Active',
    bankName: '',
    accountTitle: '',
    accountNumber: ''
});

export function StaffForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [isLoading, setIsLoading] = useState(isEdit);
    const nextAttachmentId = useRef(2);

    // Form State - Consolidated One-Page Layout
    const [formData, setFormData] = useState(() => buildInitialFormData(isEdit));

    const [attachments, setAttachments] = useState<Attachment[]>([
        { id: 'attachment-1', title: '', file: null }
    ]);

    // Master data for dropdowns
    const masterData = {
        designations: ['General Manager', 'Executive Chef', 'Sous Chef', 'Floor Manager', 'Captain', 'Waiter', 'Cashier', 'Driver'],
        departments: ['Management', 'Kitchen', 'Service', 'Account', 'Logistics', 'Security'],
        stations: ['Main Branch', 'Downtown Bistro', 'Mall Outlet', 'Central Warehouse'],
        roles: ['Super Admin', 'Admin', 'HR Manager', 'Branch Manager', 'POS Operator', 'Inventory Manager']
    };



    useEffect(() => {
        if (!isEdit || !id) return;
        const timer = window.setTimeout(() => setIsLoading(false), 600);
        return () => window.clearTimeout(timer);
    }, [id, isEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const addAttachment = () => {
        setAttachments([
            ...attachments,
            { id: `attachment-${nextAttachmentId.current++}`, title: '', file: null }
        ]);
    };

    const removeAttachment = (id: string) => {
        setAttachments(attachments.filter(a => a.id !== id));
    };

    const handleAttachmentChange = (id: string, field: keyof Attachment, value: any) => {
        setAttachments(attachments.map(a => a.id === id ? { ...a, [field]: value, fileName: field === 'file' ? value?.name : a.fileName } : a));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Leaving Date required if status is not Active or On Leave
        if (!['Active', 'On Leave'].includes(formData.status) && !formData.leavingDate) {
            toast.error('Validation Error', 'Leaving Date is mandatory for the selected status.');
            return;
        }

        if (Number(formData.currentSalary) <= 0) {
            toast.error('Validation Error', 'Salary must be numeric and greater than 0.');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            navigate('..');
        }, 1500);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button onClick={() => navigate('..')} className={styles.backButton} title="Back to Registry">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className={styles.title}>{isEdit ? 'Personnel Profile' : 'Add New Personnel'}</h1>
                        <p className={styles.subtitle}>
                            {isEdit ? `Editing records for ${formData.fullName}` : 'Register a new member in the organizational hierarchy.'}
                        </p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <span className={styles.autoId}>Auto-assigning ID</span>
                </div>
            </header>

            <form onSubmit={handleSubmit} className={styles.formBody}>
                {/* â”€â”€ 1. Identity & Contact â”€â”€ */}
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <User size={20} color="var(--accent-primary)" />
                        <h3>Identity & Personal Details</h3>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.required}>Full Registered Name</label>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={styles.input} placeholder="e.g. Ahmed Ali" required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Father / Husband Name</label>
                            <input type="text" name="fatherHusbandName" value={formData.fatherHusbandName} onChange={handleInputChange} className={styles.input} required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleInputChange} className={styles.select} required>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>CNIC / National ID</label>
                            <input type="text" name="cnic" value={formData.cnic} onChange={handleInputChange} className={styles.input} placeholder="42101-XXXXXXXX-X" required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Date of Birth</label>
                            <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className={styles.input} required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Joining Date</label>
                            <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className={styles.input} required />
                        </div>
                    </div>

                    <div className={styles.separator} data-label="Contact & Location" />

                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.required}>Primary Mobile</label>
                            <div className={styles.inputWithIcon}>
                                <Phone size={14} />
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleInputChange} className={styles.input} placeholder="+92 3XX XXXXXXX" required />
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Email Identity</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={styles.input} placeholder="name@kitchenos.io" required />
                        </div>
                        <div className={`${styles.field} ${styles.fullWidth}`}>
                            <label className={styles.required}>Residential Address</label>
                            <textarea name="address" value={formData.address} onChange={handleInputChange} className={styles.textarea} placeholder="House #, Street, Block..." required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>City</label>
                            <input type="text" name="city" value={formData.city} onChange={handleInputChange} className={styles.input} required />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Locality / Area</label>
                            <input type="text" name="locality" value={formData.locality} onChange={handleInputChange} className={styles.input} required />
                        </div>
                    </div>
                </section>

                {/* â”€â”€ 2. Employment & Role â”€â”€ */}
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <Briefcase size={20} color="var(--accent-secondary)" />
                        <h3>Organizational Placement</h3>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.required}>Functional Department</label>
                            <select name="departmentId" value={formData.departmentId} onChange={handleInputChange} className={styles.select} required>
                                <option value="">Select Department</option>
                                {masterData.departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Official Designation</label>
                            <select name="designationId" value={formData.designationId} onChange={handleInputChange} className={styles.select} required>
                                <option value="">Select Designation</option>
                                {masterData.designations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Assigned Station / Branch</label>
                            <select name="stationId" value={formData.stationId} onChange={handleInputChange} className={styles.select} required>
                                <option value="">Select Station</option>
                                {masterData.stations.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Employment Nature</label>
                            <select name="employmentType" value={formData.employmentType} onChange={handleInputChange} className={styles.select} required>
                                <option value="Full Time">Full Time</option>
                                <option value="Part Time">Part Time</option>
                                <option value="Contract">Contractual</option>
                                <option value="Intern">Internship</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.required}>Operational Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className={styles.select} required>
                                <option value="Active">Operational (Active)</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Resigned">Resigned</option>
                                <option value="Terminated">Discharged</option>
                            </select>
                        </div>
                        {formData.status !== 'Active' && formData.status !== 'On Leave' && (
                            <div className={styles.field}>
                                <label className={styles.required}>Effective Separation Date</label>
                                <input type="date" name="leavingDate" value={formData.leavingDate} onChange={handleInputChange} className={styles.input} required />
                            </div>
                        )}
                    </div>
                </section>

                <div className={styles.twoColRow}>
                    {/* â”€â”€ 3. Financial & Compensation â”€â”€ */}
                    <section className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                            <Wallet size={20} color="var(--accent-tertiary)" />
                            <h3>Compensation Info</h3>
                        </div>
                        <div className={styles.stack}>
                            <div className={styles.field}>
                                <label className={styles.required}>Gross Salary (PKR)</label>
                                <div className={styles.inputWithIcon}>
                                    <span className={styles.prefix}>Rs.</span>
                                    <input type="number" name="currentSalary" value={formData.currentSalary} onChange={handleInputChange} className={styles.input} required />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Payout Cycle</label>
                                <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} className={styles.select} required>
                                    <option value="Monthly">Monthly Cycle</option>
                                    <option value="Weekly">Weekly Cycle</option>
                                    <option value="Daily">Daily Wager</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Bank Account Title</label>
                                <input type="text" name="accountTitle" value={formData.accountTitle} onChange={handleInputChange} className={styles.input} placeholder="Account Holder Name" />
                            </div>
                            <div className={styles.field}>
                                <label>IBAN / Account #</label>
                                <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} className={styles.input} placeholder="PK00 XXXX XXXX XXXX" />
                            </div>
                        </div>
                    </section>

                    {/* â”€â”€ 4. System Access â”€â”€ */}
                    <section className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                            <ShieldCheck size={20} color="var(--color-success)" />
                            <h3>Digital Access Control</h3>
                        </div>
                        <div className={styles.stack}>
                            <label className={styles.accessToggle}>
                                <div className={styles.toggleInfo}>
                                    <strong>Cloud Portal Access</strong>
                                    <span>Enable login for this personnel</span>
                                </div>
                                <input type="checkbox" name="enableSystemAccess" checked={formData.enableSystemAccess} onChange={handleInputChange} className={styles.toggleCheckbox} />
                            </label>

                            {formData.enableSystemAccess && (
                                <div className={styles.accessForm}>
                                    <div className={styles.field}>
                                        <label className={styles.required}>Cloud Username</label>
                                        <input type="text" name="systemUsername" value={formData.systemUsername} onChange={handleInputChange} className={styles.input} required />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.required}>System Role</label>
                                        <select name="systemRoleId" value={formData.systemRoleId} onChange={handleInputChange} className={styles.select} required>
                                            <option value="">Select Role</option>
                                            {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.required}>Account Status</label>
                                        <select name="accountStatus" value={formData.accountStatus} onChange={handleInputChange} className={styles.select} required>
                                            <option value="Active">Authorized</option>
                                            <option value="Disabled">Revoked</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* â”€â”€ 5. Documents â”€â”€ */}
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <Paperclip size={20} />
                        <h3>Dossier & Documents</h3>
                    </div>
                    <div className={styles.attachmentList}>
                        {attachments.map((att) => (
                            <div key={att.id} className={styles.attachmentItem}>
                                <input type="text" placeholder="Document Label (e.g. CV, Degree)" value={att.title} onChange={(e) => handleAttachmentChange(att.id, 'title', e.target.value)} className={styles.input} style={{ flex: 1 }} />
                                <div className={styles.fileUpload}>
                                    <label>
                                        <Plus size={14} />
                                        {att.fileName || 'Upload File'}
                                        <input type="file" onChange={(e) => handleAttachmentChange(att.id, 'file', e.target.files?.[0] || null)} hidden />
                                    </label>
                                </div>
                                {attachments.length > 1 && (
                                    <button type="button" onClick={() => removeAttachment(att.id)} className={styles.removeBtn}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addAttachment} className={styles.addDocumentBtn}>
                            <Plus size={16} /> Add another document slot
                        </button>
                    </div>
                </section>

                <footer className={styles.stickyFooter}>
                    <div className={styles.footerBrand}>
                        <ChefHat size={18} />
                        <span>Personnel Profile Verification</span>
                    </div>
                    <div className={styles.footerActions}>
                        <button type="button" onClick={() => navigate('..')} className={styles.cancelBtn}>Discard Changes</button>
                        <button type="submit" disabled={isLoading} className={styles.saveBtn}>
                            {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                            {isEdit ? 'Update Records' : 'Finalize & Save'}
                        </button>
                    </div>
                </footer>
            </form>
        </div>
    );
}


