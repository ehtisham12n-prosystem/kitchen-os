/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Camera,
    Car,
    FileText,
    Plus,
    Trash2,
    Shield,
    Key,
    UserCircle,
    CheckCircle,
    ArrowLeft,
    Phone,
    Mail,
    MapPin,
    Building2,
    User,
    Briefcase,
    Wallet,
    ShieldCheck,
    Loader2,
    Save,
    Copy,
    Info,
    X,
} from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { roleApi, setupApi, userApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/locationOptions';
import { SmartCopyModal } from './security/SmartCopyModal';
import styles from './UserEditor.module.css';

interface BranchAssignment {
    branchId: number;
    roleIds: number[];
    directPermissions: string[];
    assignmentScope: 'branch' | 'central';
    approvalAuthority: 'none' | 'branch' | 'central' | 'both';
    isPrimary?: boolean;
}

interface AccessInspection {
    branch_context_required: boolean;
    summary: {
        total_accessible_branches: number;
        primary_branch_id: number | null;
        tenant_wide_access: boolean;
        central_assignment_count: number;
        branch_assignment_count: number;
        branch_approval_assignment_count: number;
        central_approval_assignment_count: number;
    };
    branches: Array<{
        branch_id: number;
        branch_name: string | null;
        inventory_store_type: 'branch' | 'central';
        is_primary: boolean;
        role_id: number | null;
        role_name: string | null;
        role_source: 'branch_assignment' | 'global_default' | 'unassigned';
        role_context_scope: 'branch' | 'central' | 'hybrid';
        role_approval_authority: 'none' | 'branch' | 'central' | 'both' | null;
        assignment_scope: 'branch' | 'central';
        approval_authority: 'none' | 'branch' | 'central' | 'both' | null;
        direct_permissions: string[];
        role_permissions: string[];
        effective_permissions: string[];
    }>;
}

// Module-grouped permission definitions - dynamically loaded from API in future
// Per RULES.md: use Set<number>/useMemo for large lists to ensure zero UI lag
type PermissionModule = {
    module_id: string;
    module_name: string;
    permissions: Array<{ id: string; name: string }>;
};

type GovernanceRole = {
    id: number;
    role_name: string;
    permissions: string[] | string;
    context_scope?: 'branch' | 'central' | 'hybrid';
    approval_authority?: 'none' | 'branch' | 'central' | 'both' | null;
};

type AvailableBranch = {
    id: number;
    branch_name: string;
    inventory_store_type?: 'branch' | 'central';
};

const EMPTY_BRANCH_ASSIGNMENT: BranchAssignment = {
    branchId: 0,
    roleIds: [],
    directPermissions: [],
    assignmentScope: 'branch',
    approvalAuthority: 'none',
    isPrimary: false,
};

const createEmptyBranchAssignment = (): BranchAssignment => ({
    ...EMPTY_BRANCH_ASSIGNMENT,
});

const buildSuggestedUsername = (name: string) => {
    const normalized = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim()
        .replace(/\s+/g, '.');

    return normalized || '';
};

const resolveSubscriptionModuleFromPermissionId = (permissionId: string): string | undefined => {
    const normalized = String(permissionId || '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }

    const prefix = normalized.includes(':')
        ? normalized.split(':')[0]
        : normalized.split('.')[0];

    switch (prefix) {
        case 'orders':
        case 'pos':
            return 'pos';
        case 'catalog':
            return 'catalog';
        case 'inventory':
            return 'inventory';
        case 'recipe':
            return 'recipe';
        case 'crm':
            return 'crm';
        case 'production':
            return 'production';
        case 'accounting':
            return 'accounting';
        case 'analytics':
            return 'analytics';
        case 'dashboard':
            return 'dashboard';
        case 'branch':
        case 'staff':
            return 'auth';
        case 'platform':
            return 'platform';
        default:
            return undefined;
    }
};

const filterPermissionRegistryBySubscription = (permissionsRegistry: any[], allowedModules: string[]): PermissionModule[] => {
    const normalizedAllowedModules = [...new Set(
        (allowedModules || [])
            .map((entry) => String(entry || '').trim().toLowerCase())
            .filter(Boolean),
    )];

    if (normalizedAllowedModules.length === 0 || normalizedAllowedModules.includes('all')) {
        return (permissionsRegistry || []).map((group: any) => ({
            module_id: group.label,
            module_name: group.label,
            permissions: (group.permissions || []).map((permission: any) => ({
                id: permission.id,
                name: permission.label,
            })),
        }));
    }

    return (permissionsRegistry || [])
        .map((group: any) => ({
            module_id: group.label,
            module_name: group.label,
            permissions: (group.permissions || [])
                .filter((permission: any) => {
                    const subscriptionModule = resolveSubscriptionModuleFromPermissionId(permission?.id);
                    return !subscriptionModule || normalizedAllowedModules.includes(subscriptionModule);
                })
                .map((permission: any) => ({
                    id: permission.id,
                    name: permission.label,
                })),
        }))
        .filter((group: PermissionModule) => group.permissions.length > 0);
};

const normalizeBranchAssignmentsFromUser = (data: any, inspection?: AccessInspection | null): BranchAssignment[] => {
    const assignmentMap = new Map<number, BranchAssignment>();

    for (const branchRole of data?.branchRoles || []) {
        const branchId = Number(branchRole?.branch_id);
        if (!Number.isInteger(branchId) || branchId <= 0) {
            continue;
        }

        if (assignmentMap.has(branchId)) {
            const existing = assignmentMap.get(branchId)!;
            if (branchRole?.role_id && !existing.roleIds.includes(branchRole.role_id)) {
                existing.roleIds.push(branchRole.role_id);
            }
        } else {
            assignmentMap.set(branchId, {
                branchId,
                roleIds: branchRole?.role_id ? [branchRole.role_id] : [],
                isPrimary: Boolean(branchRole?.is_primary),
                assignmentScope:
                    branchRole?.assignment_scope
                    || (branchRole?.branch?.inventory_store_type === 'central' ? 'central' : 'branch'),
                approvalAuthority:
                    branchRole?.approval_authority
                    || branchRole?.roleEntity?.approval_authority
                    || 'none',
                directPermissions:
                    (data?.branchPermissions || [])
                        .filter((permission: any) => Number(permission?.branch_id) === branchId)
                        .map((permission: any) => permission.permission_id)
                        .filter(Boolean),
            });
        }
    }

    for (const inspectedBranch of inspection?.branches || []) {
        const branchId = Number(inspectedBranch?.branch_id);
        if (!Number.isInteger(branchId) || branchId <= 0) {
            continue;
        }

        const existing = assignmentMap.get(branchId);
        const nextRoleIds = existing?.roleIds || [];
        if (inspectedBranch?.role_id && !nextRoleIds.includes(inspectedBranch.role_id)) {
            nextRoleIds.push(inspectedBranch.role_id);
        }
        assignmentMap.set(branchId, {
            branchId,
            roleIds: nextRoleIds,
            isPrimary: existing?.isPrimary ?? Boolean(inspectedBranch?.is_primary),
            assignmentScope: existing?.assignmentScope ?? inspectedBranch?.assignment_scope ?? 'branch',
            approvalAuthority:
                existing?.approvalAuthority
                ?? inspectedBranch?.approval_authority
                ?? inspectedBranch?.role_approval_authority
                ?? 'none',
            directPermissions: existing?.directPermissions?.length
                ? existing.directPermissions
                : [...new Set(inspectedBranch?.direct_permissions || [])],
        });
    }

    const assignments = Array.from(assignmentMap.values());
    const primaryBranchId = Number(
        inspection?.summary?.primary_branch_id
        ?? assignments.find((assignment) => assignment.isPrimary)?.branchId
        ?? 0,
    );

    return assignments.map((assignment, index) => ({
        ...assignment,
        isPrimary: primaryBranchId > 0
            ? assignment.branchId === primaryBranchId
            : Boolean(assignment.isPrimary || index === 0),
        directPermissions: [...new Set(assignment.directPermissions)].filter(Boolean),
    }));
};


export function UserEditor() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const userContext = useMemo(() => readStoredUserContext(), []);
    const allowedModules = useMemo(() => userContext?.allowed_modules ?? [], [userContext]);
    const allowedModulesKey = useMemo(() => JSON.stringify(allowedModules), [allowedModules]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUsernameTouched, setIsUsernameTouched] = useState(false);
    const saveInFlightRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        // Profile
        profilePicture: '',
        userNumber: '',

        // 1. Personal Information
        fullName: '',
        fatherHusbandName: '',
        gender: '',
        religion: '',
        sect: '',
        cnic: '',

        // 2. Contact & Address
        mobile: '',
        alternateMobile: '',
        email: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactNumber: '',
        address: '',
        locality: '',
        city: '',
        country: 'Pakistan',

        // 3. Employment Info
        employeeId: '',
        joiningDate: new Date().toISOString().split('T')[0],
        designationId: '',
        departmentId: '',
        stationId: '',
        employmentType: 'Full Time',
        status: 'active',
        leavingDate: '',

        // 4. Salary & Compensation
        currentSalary: '',
        salaryType: 'Monthly',
        salaryRevisionDate: '',
        hrRemarks: '',

        // 5. Vehicle Information
        vehicleType: '',
        vehicleRegNo: '',
        vehicleMakeModel: '',
        vehicleColor: '',

        // 6. System User Account
        enableSystemAccess: true,
        systemUsername: '',
        systemPassword: '',
        passwordGeneration: 'manual' as 'manual' | 'auto',
        forcePasswordChange: false,
        systemRoles: [] as string[],
        branchAssignments: [createEmptyBranchAssignment()] as BranchAssignment[],
        accountStatus: 'active',

        // POS Execution Pins
        posActionPin: '',
        posClosePin: '',
        posUserPin: '',

        // 7. Bank Account
        bankName: '',
        accountTitle: '',
        accountNumber: '',

        // 8. Attachments
        attachments: [] as { id: string, title: string, file: string, fileName: string }[]
    });

    // Master Data from API
    const [availableBranches, setAvailableBranches] = useState<AvailableBranch[]>([]);
    const [availableRoles, setAvailableRoles] = useState<GovernanceRole[]>([]);
    const [availableDepartments, setAvailableDepartments] = useState<any[]>([]);
    const [availableDesignations, setAvailableDesignations] = useState<any[]>([]);
    const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
    const [accessInspection, setAccessInspection] = useState<AccessInspection | null>(null);

    // Smart Copy Modal State
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [potentialUsers, setPotentialUsers] = useState<{ id: number; full_name: string; user_name: string; email: string }[]>([]);

    const designationName =
        availableDesignations.find((designation) => String(designation.id) === formData.designationId)?.name ||
        'Role Not Assigned';

    const rolePermissionsById = useMemo(() => new Map(
        availableRoles.map((role) => [
            role.id,
            new Set<string>(
                Array.isArray(role.permissions)
                    ? role.permissions
                    : role.permissions
                        ? JSON.parse(role.permissions)
                        : [],
            ),
        ]),
    ), [availableRoles]);

    const getBranchById = (branchId: number) =>
        availableBranches.find((branch) => Number(branch.id) === Number(branchId));

    const getRoleOptionsForAssignment = (assignment: BranchAssignment) =>
        availableRoles.filter((role) => {
            const contextScope = role.context_scope || 'hybrid';
            if (contextScope === 'hybrid') {
                return true;
            }
            return contextScope === assignment.assignmentScope;
        });

    const governanceSummary = useMemo(() => {
        const assignments = formData.branchAssignments.filter((assignment) => assignment.branchId > 0);
        const centralCount = assignments.filter((assignment) => assignment.assignmentScope === 'central').length;
        const branchCount = assignments.filter((assignment) => assignment.assignmentScope === 'branch').length;
        const approvalSummary = assignments.some((assignment) => assignment.approvalAuthority === 'both')
            ? 'Mixed branch and central approvals'
            : assignments.some((assignment) => assignment.approvalAuthority === 'central')
                ? 'Central approval authority configured'
                : assignments.some((assignment) => assignment.approvalAuthority === 'branch')
                    ? 'Branch approval authority configured'
                    : 'No explicit approval authority';
        return {
            assignmentCount: assignments.length,
            centralCount,
            branchCount,
            approvalSummary,
        };
    }, [formData.branchAssignments]);

    const fetchMasterData = useCallback(async () => {
        try {
                const [branches, roles, departments, designations, permissionsRegistry, users] = await Promise.all([
                    setupApi.getBranches(),
                    roleApi.getRoles(),
                    setupApi.getDepartments(),
                    setupApi.getDesignations(),
                    roleApi.getPermissionsRegistry(),
                    userApi.getUsers(),
                ]);

                setAvailableBranches(branches);
                setAvailableRoles(roles);
                setAvailableDepartments(departments);
                setAvailableDesignations(designations);
                setPermissionModules(filterPermissionRegistryBySubscription(permissionsRegistry || [], allowedModules));
                setPotentialUsers(users);
        } catch (error) {
            console.error('Failed to fetch master data:', error);
            toast.error('Failed to load system configuration');
        }
    }, [allowedModules]);

    useEffect(() => {
        void fetchMasterData();
    }, [fetchMasterData]);

    useEffect(() => {
        if (isEdit && id) {
            setIsLoading(true);
            Promise.all([
                userApi.getUser(id),
                userApi.inspectUserAccess(id),
            ])
                .then(([data, inspection]) => {
                    const normalizedBranchAssignments = normalizeBranchAssignmentsFromUser(data, inspection);
                    const primaryBranchId =
                        inspection?.summary?.primary_branch_id
                        ?? normalizedBranchAssignments.find((assignment) => assignment.isPrimary)?.branchId
                        ?? null;
                    setAccessInspection(inspection);
                    setFormData(prev => ({
                        ...prev,
                        profilePicture: data.profile_picture || '',
                        fullName: data.full_name || '',
                        fatherHusbandName: data.father_husband_name || '',
                        gender: data.gender || '',
                        religion: data.religion || '',
                        sect: data.sect || '',
                        email: data.email || '',
                        mobile: data.phone || '',
                        alternateMobile: data.alternate_phone || '',
                        emergencyContactName: data.emergency_contact_name || '',
                        emergencyContactRelationship: data.emergency_contact_relationship || '',
                        emergencyContactNumber: data.emergency_contact_phone || '',
                        cnic: data.cnic_number || '',
                        address: data.address || '',
                        locality: data.locality || '',
                        city: data.city || '',
                        country: data.country || 'Pakistan',
                        employeeId: data.employee_id || '',
                        joiningDate: data.joining_date || prev.joiningDate,
                        userNumber: data.employee_id || `USR-${data.id}`,
                        designationId: data.designation_id?.toString() || '',
                        departmentId: data.department_id?.toString() || '',
                        stationId: primaryBranchId ? String(primaryBranchId) : '',
                        employmentType: data.employment_type || 'Full Time',
                        enableSystemAccess: Boolean(data.user_name || normalizedBranchAssignments.length > 0),
                        systemUsername: data.user_name || '',
                        status: data.status || 'active',
                        accountStatus: data.status || 'active',
                        leavingDate: data.leaving_date || '',
                        currentSalary: data.current_salary ? String(data.current_salary) : '',
                        salaryType: data.salary_type || 'Monthly',
                        salaryRevisionDate: data.salary_revision_date || '',
                        hrRemarks: data.hr_remarks || '',
                        vehicleType: data.vehicle_type || '',
                        vehicleRegNo: data.vehicle_reg_no || '',
                        vehicleMakeModel: data.vehicle_make_model || '',
                        vehicleColor: data.vehicle_color || '',
                        forcePasswordChange: Boolean(data.force_password_change),
                        posActionPin: data.pos_approval_pin || '',
                        posClosePin: data.management_pin || '',
                        posUserPin: data.pos_user_pin || '',
                        bankName: data.bank_name || '',
                        accountTitle: data.account_title || '',
                        accountNumber: data.account_number || '',
                        attachments: Array.isArray(data.attachments) ? data.attachments : [],
                        branchAssignments: normalizedBranchAssignments.length > 0
                            ? normalizedBranchAssignments
                            : [createEmptyBranchAssignment()],
                    }));
                })
                .finally(() => setIsLoading(false));
        } else {
            setAccessInspection(null);
            setFormData(prev => ({
                ...prev,
                userNumber: prev.userNumber || ('NEW-' + Math.floor(1000 + Math.random() * 9000)),
                branchAssignments: prev.branchAssignments.length > 0 ? prev.branchAssignments : [createEmptyBranchAssignment()],
            }));
        }
    }, [allowedModulesKey, id, isEdit]);

    useEffect(() => {
        if (isEdit || isUsernameTouched) {
            return;
        }

        const suggestedUsername = buildSuggestedUsername(formData.fullName);
        setFormData((prev) => ({
            ...prev,
            systemUsername: suggestedUsername,
        }));
    }, [formData.fullName, isEdit, isUsernameTouched]);

    const addBranchAssignment = () => {
        setFormData(prev => ({
            ...prev,
            branchAssignments: [
                ...prev.branchAssignments,
                { ...EMPTY_BRANCH_ASSIGNMENT }
            ]
        }));
    };

    const removeBranchAssignment = (index: number) => {
        setFormData(prev => ({
            ...prev,
            branchAssignments: prev.branchAssignments.filter((_, i) => i !== index)
        }));
    };

    const updateBranchAssignment = (index: number, updates: Partial<BranchAssignment>) => {
        setFormData(prev => ({
            ...prev,
            branchAssignments: prev.branchAssignments.map((ba, i) => {
                if (i !== index) {
                    return updates.isPrimary ? { ...ba, isPrimary: false } : ba;
                }

                const next = { ...ba, ...updates };
                if (updates.assignmentScope === 'branch' && ['central', 'both'].includes(next.approvalAuthority)) {
                    next.approvalAuthority = 'branch';
                }
                if (updates.assignmentScope === 'central' && next.approvalAuthority === 'branch') {
                    next.approvalAuthority = 'central';
                }
                return next;
            }),
        }));
    };

    const togglePermission = (index: number, perm: string) => {
        const ba = formData.branchAssignments[index];
        const hasPerm = ba.directPermissions.includes(perm);
        const newPerms = hasPerm
            ? ba.directPermissions.filter(p => p !== perm)
            : [...ba.directPermissions, perm];

        updateBranchAssignment(index, { directPermissions: newPerms });
    };


    /** Loads all users to populate the Smart Copy picker - called when modal opens */

    const handleSave = async () => {
        if (saveInFlightRef.current) {
            return;
        }
        saveInFlightRef.current = true;
        setIsLoading(true);
        try {
            const normalizedAssignments = formData.branchAssignments
                .filter((assignment) => assignment.branchId > 0)
                .map((assignment) => ({
                    branchId: assignment.branchId,
                    roleIds: assignment.roleIds,
                    directPermissions: [...new Set(assignment.directPermissions)],
                    assignmentScope: assignment.assignmentScope,
                    approvalAuthority: assignment.approvalAuthority,
                }));
            const hasIncompleteBranchAssignment = formData.branchAssignments.some((assignment) => assignment.branchId <= 0);
            if (formData.enableSystemAccess && formData.branchAssignments.length === 0) {
                throw new Error('At least one branch assignment is required under Cyber Access Keys.');
            }
            if (formData.enableSystemAccess && hasIncompleteBranchAssignment) {
                throw new Error('Please select a branch for every Cyber Access Keys assignment.');
            }
            const uniqueBranchIds = new Set(normalizedAssignments.map((assignment) => assignment.branchId));
            if (uniqueBranchIds.size !== normalizedAssignments.length) {
                throw new Error('Duplicate branch assignments are not allowed.');
            }

            const primaryBranchId = formData.stationId ? parseInt(formData.stationId, 10) : undefined;
            if (primaryBranchId && normalizedAssignments.length > 0 && !normalizedAssignments.some((assignment) => assignment.branchId === primaryBranchId)) {
                throw new Error('Primary branch must also exist in branch assignments.');
            }

            const effectivePrimaryBranchId = primaryBranchId || normalizedAssignments[0]?.branchId;
            const branchAssignments = normalizedAssignments.map((assignment) => ({
                ...assignment,
                isPrimary: assignment.branchId === effectivePrimaryBranchId,
            }));
            const primaryAssignment = branchAssignments.find((assignment) => assignment.isPrimary);
            const normalizedStatus = ['active', 'inactive', 'suspended'].includes(formData.status)
                ? formData.status
                : 'active';
            const username =
                formData.systemUsername.trim() ||
                formData.email.trim() ||
                formData.fullName.trim().toLowerCase().replace(/\s+/g, '.');
            const password =
                formData.systemPassword.trim() ||
                `Temp#${Math.random().toString(36).slice(2, 10)}`;
            const payload = {
                full_name: formData.fullName,
                user_name: username,
                email: formData.email,
                phone: formData.mobile,
                alternate_phone: formData.alternateMobile,
                emergency_contact_name: formData.emergencyContactName,
                emergency_contact_relationship: formData.emergencyContactRelationship,
                emergency_contact_phone: formData.emergencyContactNumber,
                cnic_number: formData.cnic,
                address: formData.address,
                father_husband_name: formData.fatherHusbandName,
                gender: formData.gender,
                religion: formData.religion,
                sect: formData.sect,
                locality: formData.locality,
                city: formData.city,
                country: formData.country,
                employee_id: formData.employeeId,
                joining_date: formData.joiningDate || undefined,
                designation_id: formData.designationId ? parseInt(formData.designationId) : undefined,
                department_id: formData.departmentId ? parseInt(formData.departmentId) : undefined,
                employment_type: formData.employmentType,
                role_id: primaryAssignment?.roleIds?.[0] ?? undefined,
                branch_id: branchAssignments.length > 0 ? effectivePrimaryBranchId : undefined,
                status: normalizedStatus,
                user_type: branchAssignments.length > 0 ? 'BRANCH_STAFF' : 'CLIENT_ADMIN',
                password,
                profile_picture: formData.profilePicture || undefined,
                leaving_date: formData.leavingDate || undefined,
                current_salary: formData.currentSalary || undefined,
                salary_type: formData.salaryType,
                salary_revision_date: formData.salaryRevisionDate || undefined,
                hr_remarks: formData.hrRemarks,
                vehicle_type: formData.vehicleType,
                vehicle_reg_no: formData.vehicleRegNo,
                vehicle_make_model: formData.vehicleMakeModel,
                vehicle_color: formData.vehicleColor,
                bank_name: formData.bankName,
                account_title: formData.accountTitle,
                account_number: formData.accountNumber,
                force_password_change: formData.forcePasswordChange,
                pos_approval_pin: formData.posActionPin || undefined,
                management_pin: formData.posClosePin || undefined,
                pos_user_pin: formData.posUserPin || undefined,
                attachments: formData.attachments,
                branchAssignments,
            };

            if (isEdit) {
                await userApi.updateUser(id!, payload);
                toast.success('User updated successfully');
            } else {
                await userApi.createUser(payload);
                toast.success('User created successfully');
            }
            navigate('..');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save user');
        } finally {
            setIsLoading(false);
            saveInFlightRef.current = false;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        if (name === 'systemUsername') {
            setIsUsernameTouched(true);
        }
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profilePicture: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const [activeSection, setActiveSection] = useState('personal');

    const sections = [
        { id: 'personal', label: 'Identity Registry', icon: User },
        { id: 'contact', label: 'Communications', icon: Mail },
        { id: 'employment', label: 'Governance', icon: Briefcase },
        { id: 'financials', label: 'Payroll & Compensation', icon: Wallet },
        { id: 'bank', label: 'Banking', icon: Building2 },
        { id: 'vehicle', label: 'Transport', icon: Car },
        { id: 'system', label: 'Cyber Access', icon: Shield },
        { id: 'attachments', label: 'Attachment', icon: FileText },
    ];

    const addAttachment = () => {
        setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, { id: crypto.randomUUID(), title: '', file: '', fileName: '' }]
        }));
    };

    const removeAttachment = (id: string) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(a => a.id !== id)
        }));
    };

    const handleAttachmentFile = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    attachments: prev.attachments.map(a => a.id === id ? { ...a, file: reader.result as string, fileName: file.name } : a)
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAttachmentTitle = (id: string, title: string) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.map(a => a.id === id ? { ...a, title } : a)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) {
            return;
        }
        await handleSave();
    };

    const scrollToSection = (id: string) => {
        const el = document.getElementById(`section-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(id);
        }
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.mainContent}>
                <aside className={styles.sidebarSticky}>
                    <div className={styles.sidebarHeader}>
                        <button type="button" onClick={() => navigate('..')} className={styles.backLink}>
                            <ArrowLeft size={16} /> Personnel Registry
                        </button>
                    </div>

                    <div className={styles.profileSummaryCard}>
                        <div className={styles.avatarContainer}>
                            <div className={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()}>
                                {formData.profilePicture ? (
                                    <img src={formData.profilePicture} alt="Profile" className={styles.avatarImg} />
                                ) : (
                                    <div className={styles.avatarPlaceholder}><User size={48} /></div>
                                )}
                                <div className={styles.avatarOverlay}><Camera size={20} /></div>
                            <div className={styles.statusBlob} style={{ background: formData.status === 'active' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                            </div>
                            <button type="button" className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                                <Camera size={14} /> Update Photo
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} accept="image/*" />

                        <div className={styles.profileText}>
                            <h1 className={styles.profileName}>{formData.fullName || 'Untitled Profile'}</h1>
                            <p className={styles.profileRole}>{designationName}</p>
                            <span className={styles.entityID}>{formData.userNumber}</span>
                        </div>

                        <div className={styles.navProgress}>
                            {sections.map(s => {
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className={`${styles.navItem} ${activeSection === s.id ? styles.navItemActive : ''}`}
                                        onClick={() => scrollToSection(s.id)}
                                    >
                                        <div className={styles.navIcon}><Icon size={16} /></div>
                                        <span>{s.label}</span>
                                        {activeSection === s.id && <div className={styles.activeIndicator} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.sidebarActions}>
                        {isEdit && (
                            <button type="button" className={styles.duplicateBtn} onClick={() => setShowDuplicateModal(true)}>
                                <Copy size={16} />
                                Copy Permissions
                            </button>
                        )}
                        <div className={styles.sidebarSecondaryActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => navigate('..')}>
                                Cancel
                            </button>
                            <button type="button" className={styles.submitBtn} onClick={handleSave} disabled={isLoading}>
                                {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
                                {isEdit ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </aside>

                <div className={styles.scrollArea}>
                    {/* Top Action Bar */}
                    <div className={styles.topActionBar}>
                        <div className={styles.topInfo}>
                            <h2 className={styles.formTitle}>{isEdit ? 'Refine Employee Protocol' : 'Personnel Onboarding Protocol'}</h2>
                            <p className={styles.formSubtitle}>Execution of workforce registry for {formData.fullName || 'New Entity'}</p>
                        </div>
                        <div className={styles.topActions}>
                            <button type="button" onClick={() => navigate('..')} className={styles.cancelBtn}>Discard</button>
                            <button type="button" onClick={handleSave} disabled={isLoading} className={styles.submitBtn}>
                                {isLoading ? <Loader2 size={18} className={styles.spin} /> : <CheckCircle size={18} />}
                                {isEdit ? 'Save Changes' : 'Onboard Personnel'}
                            </button>
                        </div>
                    </div>

                    {/* 1. Identity Registry */}
                    <section id="section-personal" className={styles.sectionCard} onMouseEnter={() => setActiveSection('personal')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><User size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Identity Registry</h3>
                                <p>Legal identification and personal bio-data registry.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}><label className={styles.required}>Full legal Name</label><input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={styles.input} required placeholder="Ex: Ahmad Abdullah" /></div>
                            <div className={styles.field}><label className={styles.required}>Fatherâ€™s / Husbandâ€™s Name</label><input type="text" name="fatherHusbandName" value={formData.fatherHusbandName} onChange={handleInputChange} className={styles.input} required /></div>
                            <div className={styles.field}>
                                <label className={styles.required}>Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className={styles.select} required>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className={styles.field}><label className={styles.required}>CNIC / ID Number</label><input type="text" name="cnic" value={formData.cnic} onChange={handleInputChange} className={styles.input} placeholder="XXXXX-XXXXXXX-X" required /></div>
                            <div className={styles.field}><label>Religion</label>
                                <select name="religion" value={formData.religion} onChange={handleInputChange} className={styles.select}>
                                    <option value="">Select Religion</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Christianity">Christianity</option>
                                    <option value="Hinduism">Hinduism</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className={styles.field}><label>Sect</label><input type="text" name="sect" value={formData.sect} onChange={handleInputChange} className={styles.input} placeholder="e.g. Sunni / Shia" /></div>
                        </div>
                    </section>

                    {/* 2. Communications */}
                    <section id="section-contact" className={styles.sectionCard} onMouseEnter={() => setActiveSection('contact')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><Mail size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Portal Communications</h3>
                                <p>Verified contact channels for system notifications and HR.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}><label className={styles.required}>Mobile Number</label><div className={styles.inputIconWrap}><Phone size={14} /><input type="tel" name="mobile" value={formData.mobile} onChange={handleInputChange} className={styles.input} required /></div></div>
                            <div className={styles.field}><label>Additional Contact Number</label><div className={styles.inputIconWrap}><Phone size={14} /><input type="tel" name="alternateMobile" value={formData.alternateMobile} onChange={handleInputChange} className={styles.input} placeholder="Secondary contact number" /></div></div>
                            <div className={styles.field}><label className={styles.required}>Email Address</label><div className={styles.inputIconWrap}><Mail size={14} /><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={styles.input} required /></div></div>
                            <div className={`${styles.field} ${styles.fullWidth}`}><label className={styles.required}>Residential Address</label><div className={styles.inputIconWrap}><MapPin size={14} /><textarea name="address" value={formData.address} onChange={handleInputChange} className={styles.textarea} required /></div></div>
                            <div className={styles.field}>
                                <label>Area / Locality</label>
                                <div className={styles.inputIconWrap}>
                                    <MapPin size={14} />
                                    <input
                                        type="text"
                                        name="locality"
                                        value={formData.locality}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        placeholder="Area, locality, sector, or neighborhood"
                                    />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>City</label>
                                <select name="city" value={formData.city} onChange={handleInputChange} className={styles.select} required>
                                    {(CITY_OPTIONS as { value: string; label: string }[]).map((option) => <option key={option.value || 'city-empty'} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Country</label>
                                <select name="country" value={formData.country} onChange={handleInputChange} className={styles.select} required>
                                    {(COUNTRY_OPTIONS as { value: string; label: string }[]).map((option) => <option key={option.value || 'country-empty'} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div className={`${styles.contactPanel} ${styles.fullWidth}`}>
                                <div className={styles.contactPanelHead}>
                                    <strong>Contact In Emergency</strong>
                                    <span>Person to contact if the user is unreachable during work or operational emergencies.</span>
                                </div>
                                <div className={styles.contactPanelGrid}>
                                    <div className={styles.field}><label>Name</label><div className={styles.inputIconWrap}><User size={14} /><input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className={styles.input} placeholder="Emergency contact name" /></div></div>
                                    <div className={styles.field}><label>Relationship</label><div className={styles.inputIconWrap}><Briefcase size={14} /><input type="text" name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleInputChange} className={styles.input} placeholder="e.g. Brother, Spouse, Guardian" /></div></div>
                                    <div className={styles.field}><label>Contact No.</label><div className={styles.inputIconWrap}><Phone size={14} /><input type="tel" name="emergencyContactNumber" value={formData.emergencyContactNumber} onChange={handleInputChange} className={styles.input} placeholder="Emergency contact number" /></div></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. Governance */}
                    <section id="section-employment" className={styles.sectionCard} onMouseEnter={() => setActiveSection('employment')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><Briefcase size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Workforce Governance</h3>
                                <p>Structure, branch assignment, and operational status.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}><label>Employee ID</label><input type="text" value={formData.employeeId || 'System Assigned'} className={styles.input} readOnly /></div>
                            <div className={styles.field}><label className={styles.required}>Date of Joining</label><input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className={styles.input} required /></div>
                            <div className={styles.field}>
                                <label>Primary Branch Context</label>
                                <select name="stationId" value={formData.stationId} onChange={handleInputChange} className={styles.select}>
                                    <option value="">No primary branch selected</option>
                                    {availableBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Functional Dept.</label>
                                <select name="departmentId" value={formData.departmentId} onChange={handleInputChange} className={styles.select} required>
                                    <option value="">Select Dept</option>
                                    {availableDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Role Designation</label>
                                <select name="designationId" value={formData.designationId} onChange={handleInputChange} className={styles.select} required>
                                    <option value="">Select Title</option>
                                    {availableDesignations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Employment Basis</label>
                                <select name="employmentType" value={formData.employmentType} onChange={handleInputChange} className={styles.select} required>
                                    <option value="Permanent">Permanent</option>
                                    <option value="Part Time">Part Time</option>
                                    <option value="Daily Wager">Daily Wager</option>
                                    <option value="Contract">Contract</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.required}>Live Status</label>
                                <select name="status" value={formData.status} onChange={handleInputChange} className={styles.select} required>
                                    <option value="active">Operational / Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 4. Payroll */}
                    <section id="section-financials" className={styles.sectionCard} onMouseEnter={() => setActiveSection('financials')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><Wallet size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Payroll & Compensation</h3>
                                <p>Monetary agreements and periodic settlements.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}><label className={styles.required}>Current Salary (PKR)</label><input type="number" name="currentSalary" value={formData.currentSalary} onChange={handleInputChange} className={styles.input} required /></div>
                            <div className={styles.field}><label className={styles.required}>Last Salary Change Date*</label><input type="date" name="salaryRevisionDate" value={formData.salaryRevisionDate} onChange={handleInputChange} className={styles.input} required /></div>
                            <div className={styles.field}>
                                <label className={styles.required}>Settlement Cycle</label>
                                <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} className={styles.select} required>
                                    <option value="Monthly">Monthly Salary</option>
                                    <option value="Daily">Daily Wages</option>
                                </select>
                            </div>
                            <div className={`${styles.field} ${styles.fullWidth}`}><label>Remarks</label><textarea name="hrRemarks" value={formData.hrRemarks} onChange={handleInputChange} className={styles.textarea} placeholder="Internal comments regarding increments or behavioral notes..." /></div>
                        </div>
                    </section>

                    {/* 5. Banking Detail Separated */}
                    <section id="section-bank" className={styles.sectionCard} onMouseEnter={() => setActiveSection('bank')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><Building2 size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Bank Information</h3>
                                <p>Primary account for salary disbursement.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}><label>Bank Name</label><input type="text" name="bankName" value={formData.bankName} onChange={handleInputChange} className={styles.input} placeholder="e.g. HBL, Alfalah" /></div>
                            <div className={styles.field}><label>Account Title</label><input type="text" name="accountTitle" value={formData.accountTitle} onChange={handleInputChange} className={styles.input} placeholder="Full name on account" /></div>
                            <div className={styles.field}><label>Account No / IBAN</label><input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} className={styles.input} placeholder="PK00 XXXX XXXX XXXX" /></div>
                        </div>
                    </section>

                    {/* 6. Transport */}
                    <section id="section-vehicle" className={styles.sectionCard} onMouseEnter={() => setActiveSection('vehicle')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><Car size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Transport Registry</h3>
                                <p>Documentation of personal or company-assigned vehicle.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}>
                                <label>Vehicle Category</label>
                                <select name="vehicleType" value={formData.vehicleType} onChange={handleInputChange} className={styles.select}>
                                    <option value="">No Vehicle</option>
                                    <option value="Car">Sedan / Hatchback (Car)</option>
                                    <option value="Motorcycle">Two-Wheeler (Motorcycle)</option>
                                    <option value="Other">Utility Vehicle</option>
                                </select>
                            </div>
                            {formData.vehicleType && (
                                <>
                                    <div className={styles.field}><label>License Plate NO.</label><input type="text" name="vehicleRegNo" value={formData.vehicleRegNo} onChange={handleInputChange} className={styles.input} placeholder="e.g. LEC-24-1234" /></div>
                                    <div className={styles.field}><label>Manufacturer/Model</label><input type="text" name="vehicleMakeModel" value={formData.vehicleMakeModel} onChange={handleInputChange} className={styles.input} placeholder="Honda City 2023" /></div>
                                    <div className={styles.field}><label>Visual Color</label><input type="text" name="vehicleColor" value={formData.vehicleColor} onChange={handleInputChange} className={styles.input} placeholder="Metallic Silver" /></div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* 7. Cyber Access Priority Display */}
                    <section id="section-system" className={styles.sectionCard} onMouseEnter={() => setActiveSection('system')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><ShieldCheck size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Cyber Access Keys</h3>
                                <p>System credentials and cross-module permissions.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={`${styles.field} ${styles.fullWidth}`}>
                                <label className={styles.toggleWrapper}>
                                    <input type="checkbox" name="enableSystemAccess" checked={formData.enableSystemAccess} onChange={handleInputChange} />
                                    <div className={styles.toggleText}>
                                        <strong>Active System User Account</strong>
                                        <span>Grant access to KitchenOS Platform Engine.</span>
                                    </div>
                                    <div className={`${styles.toggleVisual} ${formData.enableSystemAccess ? styles.toggleVisualOn : ''}`} />
                                </label>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.required}>Primary ID / Username</label>
                                <div className={styles.inputIconWrap}>
                                    <UserCircle size={14} />
                                    <input type="text" name="systemUsername" value={formData.systemUsername} onChange={handleInputChange} className={styles.input} required placeholder="username_alpha" />
                                </div>
                                <span className={styles.helpText}>Suggested: {buildSuggestedUsername(formData.fullName) || 'enter a username'}</span>
                            </div>
                            <div className={`${styles.field} ${styles.fullWidth} ${styles.securityWorkbench}`}>
                                <div className={styles.securityWorkbenchHead}>
                                    <label className={styles.required}>Password Security</label>
                                    <p>Define the sign-in password and operational approval PINs used across POS and branch controls.</p>
                                </div>
                                <div className={styles.securityWorkbenchBody}>
                                    <div className={styles.credentialCard}>
                                        <div className={styles.credentialCardHead}>
                                            <div className={styles.credentialTitleRow}>
                                                <span className={styles.credentialTitleIcon}>
                                                    <Key size={14} />
                                                </span>
                                                <div>
                                                    <strong>Login Password</strong>
                                                    <span>Secure sign-in password for KitchenOS access.</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.passwordSetup}>
                                            <button
                                                type="button"
                                                className={`${styles.setupBtn} ${formData.passwordGeneration === 'manual' ? styles.setupBtnActive : ''}`}
                                                onClick={() => setFormData(prev => ({ ...prev, passwordGeneration: 'manual', systemPassword: '' }))}
                                            >
                                                Manual
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.setupBtn} ${formData.passwordGeneration === 'auto' ? styles.setupBtnActive : ''}`}
                                                onClick={() => setFormData(prev => ({ ...prev, passwordGeneration: 'auto', systemPassword: 'AUTOGEN-' + Math.random().toString(36).substring(7).toUpperCase() }))}
                                            >
                                                Auto-Generate
                                            </button>
                                        </div>
                                        <div className={`${styles.inputIconWrap} ${styles.credentialInputWrap}`}>
                                            <Key size={14} />
                                            <input
                                                type={formData.passwordGeneration === 'auto' ? 'text' : 'password'}
                                                name="systemPassword"
                                                value={formData.systemPassword}
                                                onChange={handleInputChange}
                                                className={styles.input}
                                                placeholder={formData.passwordGeneration === 'auto' ? 'Auto-generated key' : 'Set secure password'}
                                                readOnly={formData.passwordGeneration === 'auto'}
                                            />
                                        </div>
                                        <label className={`${styles.checkboxWrapper} ${styles.credentialCheckbox}`}>
                                            <input type="checkbox" name="forcePasswordChange" checked={formData.forcePasswordChange} onChange={handleInputChange} />
                                            <span>Require password change on first login.</span>
                                        </label>
                                    </div>
                                    <div className={styles.credentialPinsPanel}>
                                        <div className={styles.credentialPinsHead}>
                                            <strong>POS Authorization PINs</strong>
                                            <span>Operational PINs used for approvals, sales counter handling, and management controls.</span>
                                        </div>
                                        <div className={styles.gridCompact}>
                                            <div className={`${styles.field} ${styles.pinField}`}>
                                                <div className={styles.pinFieldHeader}>
                                                    <span className={styles.pinFieldIcon}>
                                                        <Key size={14} />
                                                    </span>
                                                    <div>
                                                        <label>POS Approval PIN</label>
                                                        <span className={styles.pinFieldCaption}>Approval for sensitive POS actions</span>
                                                    </div>
                                                </div>
                                                <div className={styles.inputIconWrap}>
                                                    <Key size={14} />
                                                    <input type="password" name="posActionPin" value={formData.posActionPin} onChange={handleInputChange} className={styles.input} placeholder="4-8 digit PIN" maxLength={8} />
                                                </div>
                                                <div className={styles.pinUsageList}>
                                                    <span><strong>Used for:</strong> POS void and order cancellation approvals.</span>
                                                    <span><strong>General:</strong> Sensitive cashier order actions in the terminal.</span>
                                                </div>
                                            </div>
                                            <div className={`${styles.field} ${styles.pinField}`}>
                                                <div className={styles.pinFieldHeader}>
                                                    <span className={styles.pinFieldIcon}>
                                                        <User size={14} />
                                                    </span>
                                                    <div>
                                                        <label>POS User PIN</label>
                                                        <span className={styles.pinFieldCaption}>POS counter access control</span>
                                                    </div>
                                                </div>
                                                <div className={styles.inputIconWrap}>
                                                    <User size={14} />
                                                    <input type="password" name="posUserPin" value={formData.posUserPin} onChange={handleInputChange} className={styles.input} placeholder="Counter access PIN" maxLength={8} />
                                                </div>
                                                <div className={styles.pinUsageList}>
                                                    <span><strong>Used for:</strong> Opening and closing the sales counter.</span>
                                                    <span><strong>General:</strong> POS user terminal-side counter access actions.</span>
                                                </div>
                                            </div>
                                            <div className={`${styles.field} ${styles.pinField}`}>
                                                <div className={styles.pinFieldHeader}>
                                                    <span className={styles.pinFieldIcon}>
                                                        <ShieldCheck size={14} />
                                                    </span>
                                                    <div>
                                                        <label>Management PIN</label>
                                                        <span className={styles.pinFieldCaption}>Supervisor close-control approval</span>
                                                    </div>
                                                </div>
                                                <div className={styles.inputIconWrap}>
                                                    <ShieldCheck size={14} />
                                                    <input type="password" name="posClosePin" value={formData.posClosePin} onChange={handleInputChange} className={styles.input} placeholder="Close control PIN" maxLength={8} />
                                                </div>
                                                <div className={styles.pinUsageList}>
                                                    <span><strong>Used for:</strong> Closing sales counters, shifts, and business days.</span>
                                                    <span><strong>General:</strong> Supervisor or manager operational close controls.</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.fullWidth}>
                            <div className={styles.field}>
                                <label>Branch Assignments & Roles</label>
                                <div className={styles.branchAssignmentList}>
                                    <div className={`${styles.assignmentRow} ${styles.governanceSummaryRow}`}>
                                        <div className={styles.assignmentHeader}>
                                            <div className={styles.assignmentTitle}>
                                                <Info size={16} />
                                                Governance Summary
                                            </div>
                                        </div>
                                        <div className={styles.summaryCompactGrid}>
                                            <div className={`${styles.field} ${styles.readonlyField}`}>
                                                <label>Assigned Branches</label>
                                                <input className={styles.input} value={String(governanceSummary.assignmentCount)} readOnly />
                                            </div>
                                            <div className={`${styles.field} ${styles.readonlyField}`}>
                                                <label>Central Scope Branches</label>
                                                <input className={styles.input} value={String(governanceSummary.centralCount)} readOnly />
                                            </div>
                                            <div className={`${styles.field} ${styles.readonlyField}`}>
                                                <label>Branch Scope Branches</label>
                                                <input className={styles.input} value={String(governanceSummary.branchCount)} readOnly />
                                            </div>
                                            <div className={`${styles.field} ${styles.readonlyField}`}>
                                                <label>Approval Matrix</label>
                                                <input className={styles.input} value={governanceSummary.approvalSummary} readOnly />
                                            </div>
                                        </div>
                                    </div>

                                        {formData.branchAssignments.map((ba, idx) => (
                                            <div key={idx} className={styles.assignmentRow}>
                                                <div className={styles.assignmentHeader}>
                                                    <div className={styles.assignmentTitle}>
                                                        <Building2 size={16} />
                                                        Assignment #{idx + 1}
                                                        {String(ba.branchId) === formData.stationId && (
                                                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--accent-primary)' }}>
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.removeBranchBtn}
                                                        onClick={() => removeBranchAssignment(idx)}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>

                                                <div className={styles.grid}>
                                                    <div className={styles.field}>
                                                        <label className={styles.required}>Branch</label>
                                                        <select
                                                            className={styles.select}
                                                            value={ba.branchId}
                                                            required={formData.enableSystemAccess}
                                                            onChange={e => {
                                                                const branchId = parseInt(e.target.value, 10);
                                                                const branch = getBranchById(branchId);
                                                                updateBranchAssignment(idx, {
                                                                    branchId,
                                                                    assignmentScope: branch?.inventory_store_type === 'central' ? ba.assignmentScope : 'branch',
                                                                    approvalAuthority:
                                                                        branch?.inventory_store_type === 'central'
                                                                            ? ba.approvalAuthority
                                                                            : ba.approvalAuthority === 'central' || ba.approvalAuthority === 'both'
                                                                                ? 'branch'
                                                                                : ba.approvalAuthority,
                                                                });
                                                            }}
                                                        >
                                                            <option value={0}>Select Branch</option>
                                                            {availableBranches.map(b => (
                                                                <option key={b.id} value={b.id}>
                                                                    {b.branch_name} {b.inventory_store_type === 'central' ? '(Central)' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                                                                        <div className={styles.field}>
                                                        <label>Roles</label>
                                                        <select
                                                            className={styles.select}
                                                            multiple
                                                            value={ba.roleIds.map(String)}
                                                            onChange={e => {
                                                                const selectedOptions = Array.from(e.target.selectedOptions);
                                                                const nextRoleIds = selectedOptions.map(opt => parseInt(opt.value, 10)).filter(id => !isNaN(id));
                                                                updateBranchAssignment(idx, {
                                                                    roleIds: nextRoleIds,
                                                                });
                                                            }}
                                                            style={{ height: 'auto', minHeight: '90px' }}
                                                        >
                                                            {getRoleOptionsForAssignment(ba)
                                                                .filter(r => r.role_name.toLowerCase() !== 'super admin') // Safety
                                                                .map(r => (
                                                                    <option key={r.id} value={r.id}>{r.role_name}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>  </div>

                                                    <div className={styles.field}>
                                                        <label className={styles.required}>Assignment Scope</label>
                                                        <select
                                                            className={styles.select}
                                                            value={ba.assignmentScope}
                                                            onChange={e => updateBranchAssignment(idx, { assignmentScope: e.target.value as BranchAssignment['assignmentScope'] })}
                                                        >
                                                            <option value="branch">Branch Scope</option>
                                                            <option value="central">Central Scope</option>
                                                        </select>
                                                    </div>

                                                    <div className={styles.field}>
                                                        <label>Approval Authority</label>
                                                        <select
                                                            className={styles.select}
                                                            value={ba.approvalAuthority}
                                                            onChange={e => updateBranchAssignment(idx, { approvalAuthority: e.target.value as BranchAssignment['approvalAuthority'] })}
                                                        >
                                                            <option value="none">None</option>
                                                            {ba.assignmentScope === 'branch' && <option value="branch">Branch</option>}
                                                            {ba.assignmentScope === 'central' && <option value="central">Central</option>}
                                                            {ba.assignmentScope === 'central' && <option value="both">Both</option>}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className={styles.permissionMatrixSection}>
                                                    <div className={styles.permMatrixHeader}>
                                                        <span className={styles.permMatrixTitle}>Permissions</span>
                                                        <div className={styles.permLegend}>
                                                            <span className={`${styles.legendBadge} ${styles.legendInherited}`}>â— Inherited</span>
                                                            <span className={`${styles.legendBadge} ${styles.legendRole}`}>â— Role</span>
                                                            <span className={`${styles.legendBadge} ${styles.legendDirect}`}>â— Direct</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.modulesGrid}>
                                                        {permissionModules.map(module => {
                                                            const rolePermissions = new Set<string>();
                                                            ba.roleIds.forEach(id => {
                                                                const perms = rolePermissionsById.get(id);
                                                                if (perms) {
                                                                    perms.forEach(p => rolePermissions.add(p));
                                                                }
                                                            });
                                                            const modulePerms = module.permissions;
                                                            const allDirect = modulePerms.every(p => ba.directPermissions.includes(p.id));

                                                            return (
                                                                <div key={module.module_id} className={styles.permModuleBox}>
                                                                    <div className={styles.permModuleHeader}>
                                                                        <span className={styles.permModuleName}>{module.module_name}</span>
                                                                        <label className={styles.selectAllLbl}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={allDirect}
                                                                                onChange={() => {
                                                                                    const ids = modulePerms.map(p => p.id);
                                                                                    const nonRoleIds = ids.filter(id => !rolePermissions.has(id));
                                                                                    updateBranchAssignment(idx, {
                                                                                        directPermissions: allDirect
                                                                                            ? ba.directPermissions.filter(p => !nonRoleIds.includes(p))
                                                                                            : [...new Set([...ba.directPermissions, ...nonRoleIds])]
                                                                                    });
                                                                                }}
                                                                            />
                                                                            Select All
                                                                        </label>
                                                                    </div>
                                                                    <div className={styles.permItemsGrid}>
                                                                        {modulePerms.map(perm => {
                                                                            const isRole = rolePermissions.has(perm.id);
                                                                            const isDirect = ba.directPermissions.includes(perm.id);
                                                                            // Inherited means platform-level system always-on perms (future: from nexus context)
                                                                            const isInherited = false;
                                                                            const isLocked = isRole || isInherited;

                                                                            return (
                                                                                <div key={perm.id} className={styles.permItemRow}>
                                                                                    <label className={`${styles.permItemLabel} ${isLocked ? styles.permItemLocked : ''}`}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isRole || isDirect || isInherited}
                                                                                            disabled={isLocked}
                                                                                            onChange={() => !isLocked && togglePermission(idx, perm.id)}
                                                                                            className={isLocked ? styles.checkLocked : styles.checkDirect}
                                                                                        />
                                                                                        <span>{perm.name}</span>
                                                                                    </label>
                                                                                    {isInherited && (
                                                                                        <span className={`${styles.sourceTag} ${styles.sourceTagInherited}`} title="Granted globally by Nexus">Inherited</span>
                                                                                    )}
                                                                                    {isRole && !isInherited && (
                                                                                        <span className={`${styles.sourceTag} ${styles.sourceTagRole}`} title="Granted by roles">Role</span>
                                                                                    )}
                                                                                    {isDirect && !isRole && !isInherited && (
                                                                                        <span className={`${styles.sourceTag} ${styles.sourceTagDirect}`}>Direct</span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button type="button" className={styles.addBranchBtn} onClick={addBranchAssignment}>
                                            <Plus size={18} />
                                            Add Branch Assignment
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {isEdit && accessInspection && (
                                <div className={styles.fullWidth}>
                                    <div className={styles.field}>
                                        <label>Effective Access Inspector</label>
                                        <div className={styles.branchAssignmentList}>
                                            <div className={styles.assignmentRow}>
                                                <div className={styles.assignmentHeader}>
                                                    <div className={styles.assignmentTitle}>
                                                        <ShieldCheck size={16} />
                                                        Access Summary
                                                    </div>
                                                </div>
                                                <div className={styles.grid}>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Total Accessible Branches</label>
                                                        <input
                                                            className={styles.input}
                                                            value={String(accessInspection.summary.total_accessible_branches)}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Tenant-Wide Visibility</label>
                                                        <input
                                                            className={styles.input}
                                                            value={accessInspection.summary.tenant_wide_access ? 'Yes' : 'No'}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Explicit Branch Context Required</label>
                                                        <input
                                                            className={styles.input}
                                                            value={accessInspection.branch_context_required ? 'Yes' : 'No'}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Central Scope Assignments</label>
                                                        <input
                                                            className={styles.input}
                                                            value={String(accessInspection.summary.central_assignment_count)}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Branch Approval Assignments</label>
                                                        <input
                                                            className={styles.input}
                                                            value={String(accessInspection.summary.branch_approval_assignment_count)}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className={`${styles.field} ${styles.readonlyField}`}>
                                                        <label>Central Approval Assignments</label>
                                                        <input
                                                            className={styles.input}
                                                            value={String(accessInspection.summary.central_approval_assignment_count)}
                                                            readOnly
                                                        />
                                                    </div>
                                                </div>
                                                <div className={styles.permissionMatrixSection}>
                                                    <div className={styles.permMatrixHeader}>
                                                        <span className={styles.permMatrixTitle}>Per-Branch Effective Access</span>
                                                    </div>
                                                    <div className={styles.modulesGrid}>
                                                        {accessInspection.branches.map((branch) => (
                                                            <div key={branch.branch_id} className={styles.permModuleBox}>
                                                                <div className={styles.permModuleHeader}>
                                                                    <span className={styles.permModuleName}>
                                                                        {branch.branch_name || `Branch #${branch.branch_id}`}
                                                                    </span>
                                                                    <span className={styles.sourceTag}>
                                                                        {branch.is_primary ? 'Primary' : 'Secondary'}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.permItemsGrid}>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Role</span>
                                                                        <span className={styles.sourceTag}>{branch.role_name || 'No role'}</span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Role source</span>
                                                                        <span className={styles.sourceTag}>{branch.role_source.replace(/_/g, ' ')}</span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Store type</span>
                                                                        <span className={styles.sourceTag}>{branch.inventory_store_type}</span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Assignment scope</span>
                                                                        <span className={styles.sourceTag}>{branch.assignment_scope}</span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Approval authority</span>
                                                                        <span className={styles.sourceTag}>{branch.approval_authority || 'none'}</span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Direct permissions</span>
                                                                        <span className={styles.sourceTag}>
                                                                            {branch.direct_permissions.length > 0 ? `${branch.direct_permissions.length}` : '0'}
                                                                        </span>
                                                                    </div>
                                                                    <div className={styles.permItemRow}>
                                                                        <span className={styles.permItemLabel}>Effective permissions</span>
                                                                        <span className={styles.sourceTag}>
                                                                            {branch.effective_permissions.length > 0 ? `${branch.effective_permissions.length}` : '0'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </section>

                    {/* 8. Attachments */}
                    <section id="section-attachments" className={styles.sectionCard} onMouseEnter={() => setActiveSection('attachments')}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleIcon}><FileText size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>Attachment</h3>
                                <p>Supporting files for contracts, IDs, and certifications.</p>
                            </div>
                        </div>
                        <div className={styles.attachmentGrid}>
                            {formData.attachments.map((at) => (
                                <div key={at.id} className={styles.attachmentCard}>
                                    <div className={styles.atHeader}>
                                        <FileText size={18} />
                                        <input type="text" value={at.title} onChange={e => handleAttachmentTitle(at.id, e.target.value)} placeholder="File Title" className={styles.atTitleInput} />
                                        <button type="button" onClick={() => removeAttachment(at.id)} className={styles.atDelete}><Trash2 size={14} /></button>
                                    </div>
                                    <div className={styles.atBody}>
                                        <input type="file" onChange={e => handleAttachmentFile(at.id, e)} className={styles.fileInput} id={`file-${at.id}`} />
                                        <label htmlFor={`file-${at.id}`} className={styles.atFileZone}>
                                            {at.fileName ? (
                                                <div className={styles.atSuccess}>
                                                    <CheckCircle size={20} />
                                                    <span>{at.fileName}</span>
                                                </div>
                                            ) : (
                                                <div className={styles.atEmpty}>
                                                    <Plus size={20} />
                                                    <span>Drop or Browse</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addAttachment} className={styles.addAttachmentCard}>
                                <Plus size={32} />
                                <span>Extend Records</span>
                            </button>
                        </div>
                    </section>

                    {/* Bottom Action Bar */}
                    <div className={styles.bottomActionBar}>
                        <button type="button" onClick={() => navigate('..')} className={styles.cancelBtn}>Discard Record</button>
                        <button type="button" onClick={handleSave} disabled={isLoading} className={styles.submitBtn}>
                            {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Save size={24} />}
                            {isEdit ? 'Authorize Updates' : 'Authorize Onboarding'}
                        </button>
                    </div>
                </div>
            </form>
            {/* Smart Copy Modal */}
            {showDuplicateModal && (
                <SmartCopyModal
                    destinationUserId={Number(id)}
                    destinationBranches={
                        formData.branchAssignments
                            .filter(ba => ba.branchId !== 0)
                            .map(ba => ({
                                branchId: ba.branchId,
                                branchName: availableBranches.find(b => b.id === ba.branchId)?.branch_name || `Branch #${ba.branchId}`
                            }))
                    }
                    allUsers={potentialUsers}
                    onClose={() => setShowDuplicateModal(false)}
                    onApply={(assignments) => {
            // Merge copied assignments into the form - admin can then freely edit before saving
                        setFormData(prev => ({
                            ...prev,
                            branchAssignments: prev.branchAssignments.map(ba => {
                                const copied = assignments.find(a => a.branchId === ba.branchId);
                                if (!copied) return ba;
                                return {
                                    ...ba,
                                    roleIds: copied.roleIds?.length ? copied.roleIds : ba.roleIds,
                                    directPermissions: [...new Set([...ba.directPermissions, ...copied.directPermissions])]
                                };
                            })
                        }));
                    }}
                />
            )}
        </div>
    );
}

