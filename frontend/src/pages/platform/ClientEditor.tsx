import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Check,
    ClipboardList,
    CircleDollarSign,
    KeyRound,
    ExternalLink,
    Globe,
    Layers3,
    LockKeyhole,
    Mail,
    MapPin,
    Phone,
    Save,
    ShieldCheck,
    User,
    Users,
} from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/locationOptions';
import styles from './ClientManagement.module.css';

type ContactRole = 'business_primary' | 'billing_primary' | 'operations_primary';

interface ContactForm {
    contact_type: ContactRole;
    full_name: string;
    designation: string;
    email: string;
    phone: string;
    alternate_phone: string;
    notes: string;
}

interface FormState {
    client_name: string;
    legal_name: string;
    short_name: string;
    domain_slug: string;
    business_type: string;
    address: string;
    area: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    website_url: string;
    currency: string;
    language: string;
    timezone: string;
    subscription_plan_id: string;
    subscription_billing_cycle: 'monthly' | 'annual';
    admin_full_name: string;
    admin_user_name: string;
    admin_email: string;
    admin_password: string;
    admin_phone: string;
    initial_branch_name: string;
    initial_branch_short_name: string;
    initial_branch_address: string;
    initial_branch_city: string;
    initial_branch_state: string;
    initial_branch_country: string;
    initial_branch_contact_person: string;
    initial_branch_phone: string;
    initial_branch_email: string;
    initial_branch_opening_time: string;
    initial_branch_closing_time: string;
    onboarding_blueprint: string;
    comments: string;
    contacts: ContactForm[];
}

interface SubscriptionPlanOption {
    id: number;
    plan_code: string;
    plan_name: string;
    description?: string;
    currency_code: string;
    monthly_price: number;
    annual_price: number;
    max_branches?: number;
    max_users?: number;
    allowed_modules?: string[];
}

interface BlueprintOption {
    id: string;
    value: string;
    label: string;
    blueprint_code: string;
    blueprint_name: string;
    description?: string;
    active_version_no?: number | null;
    payload_summary?: Record<string, number> | null;
}

interface BlueprintDetailState {
    id: string;
    blueprint_code: string;
    blueprint_name: string;
    description?: string | null;
    status: 'draft' | 'active' | 'retired';
    created_at?: string | null;
    updated_at?: string | null;
    active_version_id?: number | null;
    active_version?: {
        id: number;
        version_no: number;
        schema_version?: number | null;
        created_at?: string | null;
        release_notes?: string | null;
        payload_summary?: Record<string, number> | null;
    } | null;
}

const BUSINESS_TYPES = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'cafeteria', label: 'Cafeteria' },
    { value: 'catering', label: 'Catering' },
    { value: 'cafe', label: 'Cafe' },
    { value: 'fastfood', label: 'Fast Food' },
    { value: 'other', label: 'Other' },
];

const CURRENCIES = [
    { value: 'USD', label: 'USD' },
    { value: 'PKR', label: 'PKR' },
    { value: 'AED', label: 'AED' },
    { value: 'SAR', label: 'SAR' },
    { value: 'EUR', label: 'EUR' },
];

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'Arabic' },
    { value: 'ur', label: 'Urdu' },
    { value: 'fr', label: 'French' },
];

const TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'Asia/Karachi', label: 'Asia/Karachi' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'America/New_York', label: 'America/New_York' },
];

const CONTACT_META: Array<{ role: ContactRole; label: string }> = [
    { role: 'business_primary', label: 'Business Contact' },
    { role: 'billing_primary', label: 'Billing Contact' },
    { role: 'operations_primary', label: 'Operational Contact' },
];

const DEFAULT_FORM: FormState = {
    client_name: '',
    legal_name: '',
    short_name: '',
    domain_slug: '',
    business_type: 'restaurant',
    address: '',
    area: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website_url: '',
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
    subscription_plan_id: '',
    subscription_billing_cycle: 'monthly',
    admin_full_name: '',
    admin_user_name: '',
    admin_email: '',
    admin_password: '',
    admin_phone: '',
    initial_branch_name: '',
    initial_branch_short_name: '',
    initial_branch_address: '',
    initial_branch_city: '',
    initial_branch_state: '',
    initial_branch_country: '',
    initial_branch_contact_person: '',
    initial_branch_phone: '',
    initial_branch_email: '',
    initial_branch_opening_time: '09:00',
    initial_branch_closing_time: '23:00',
    onboarding_blueprint: '',
    comments: '',
    contacts: CONTACT_META.map(({ role }) => ({
        contact_type: role,
        full_name: '',
        designation: '',
        email: '',
        phone: '',
        alternate_phone: '',
        notes: '',
    })),
};

export function ClientEditor() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);
    const [blueprintOptions, setBlueprintOptions] = useState<BlueprintOption[]>([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanOption[]>([]);
    const [currentSubscription, setCurrentSubscription] = useState<any | null>(null);
    const [hasExistingAdmin, setHasExistingAdmin] = useState(false);
    const [hasExistingInitialBranch, setHasExistingInitialBranch] = useState(false);
    const [initialSubscriptionSelection, setInitialSubscriptionSelection] = useState<{ planId: string; billingCycle: 'monthly' | 'annual' }>({
        planId: '',
        billingCycle: 'monthly',
    });
    const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
    const [isBlueprintDetailLoading, setIsBlueprintDetailLoading] = useState(false);
    const [blueprintDetail, setBlueprintDetail] = useState<BlueprintDetailState | null>(null);

    useEffect(() => {
        const loadReferenceData = async () => {
            try {
                const [blueprints, plans] = await Promise.all([
                    platformApi.getBlueprints(),
                    platformApi.getSubscriptionPlans(),
                ]);
                setBlueprintOptions(
                    (Array.isArray(blueprints) ? blueprints : [])
                        .filter((item: any) => item.status === 'active')
                        .map((item: any) => ({
                            id: String(item.id),
                            value: item.blueprint_code,
                            label: `${item.blueprint_name} (${item.blueprint_code})`,
                            blueprint_code: String(item.blueprint_code || ''),
                            blueprint_name: String(item.blueprint_name || ''),
                            description: item.description ? String(item.description) : '',
                            active_version_no: item.active_version_no ?? null,
                            payload_summary: item.payload_summary && typeof item.payload_summary === 'object' ? item.payload_summary : null,
                        })),
                );
                setSubscriptionPlans(
                    (Array.isArray(plans) ? plans : [])
                        .filter((item: any) => item.plan_status === 'active' && item.is_active !== false)
                        .map((item: any) => ({
                            id: Number(item.id),
                            plan_code: String(item.plan_code || ''),
                            plan_name: String(item.plan_name || ''),
                            description: item.description ? String(item.description) : '',
                            currency_code: String(item.currency_code || 'PKR'),
                            monthly_price: Number(item.monthly_price || 0),
                            annual_price: Number(item.annual_price || 0),
                            max_branches: Number(item.max_branches || 0),
                            max_users: Number(item.max_users || 0),
                            allowed_modules: Array.isArray(item.allowed_modules) ? item.allowed_modules : [],
                        })),
                );
            } catch {
                setBlueprintOptions([]);
                setSubscriptionPlans([]);
            }
        };

        loadReferenceData();

        if (!isEdit || !id) {
            return;
        }

        const load = async () => {
            try {
                const [client, subscription] = await Promise.all([
                    platformApi.getClient(id),
                    platformApi.getCurrentClientSubscription(id),
                ]);
                const contacts = CONTACT_META.map(({ role }) => {
                    const found = (client.contacts || []).find((contact: ContactForm) => contact.contact_type === role);
                    const legacyBusinessContact = role === 'business_primary'
                        ? {
                            full_name: client.poc_full_name || '',
                            designation: client.poc_designation || '',
                            email: client.poc_email || '',
                            phone: client.poc_phone || client.poc_cell_phone || '',
                            alternate_phone: client.poc_cell_phone || '',
                            notes: '',
                        }
                        : null;
                    return {
                        contact_type: role,
                        full_name: found?.full_name || legacyBusinessContact?.full_name || '',
                        designation: found?.designation || legacyBusinessContact?.designation || '',
                        email: found?.email || legacyBusinessContact?.email || '',
                        phone: found?.phone || legacyBusinessContact?.phone || '',
                        alternate_phone: found?.alternate_phone || legacyBusinessContact?.alternate_phone || '',
                        notes: found?.notes || legacyBusinessContact?.notes || '',
                    };
                });
                const firstBranch = Array.isArray(client.branches)
                    ? [...client.branches].sort((left: any, right: any) => Number(left.id || 0) - Number(right.id || 0))[0]
                    : null;
                const normalizeTime = (value?: string | null, fallback = '09:00') =>
                    value ? String(value).slice(0, 5) : fallback;

                setForm({
                    client_name: client.client_name || '',
                    legal_name: client.legal_name || '',
                    short_name: client.short_name || '',
                    domain_slug: client.domain_slug || '',
                    business_type: client.business_type || 'restaurant',
                    address: client.address || '',
                    area: client.area || '',
                    city: client.city || '',
                    country: client.country || '',
                    phone: client.phone || '',
                    email: client.email || '',
                    website_url: client.website_url || '',
                    currency: client.currency || 'USD',
                    language: client.language || 'en',
                    timezone: client.timezone || 'UTC',
                    subscription_plan_id: subscription?.plan_id
                        ? String(subscription.plan_id)
                        : client.subscription_plan_id
                            ? String(client.subscription_plan_id)
                            : '',
                    subscription_billing_cycle: (subscription?.billing_cycle || client.subscription_type) === 'annual' ? 'annual' : 'monthly',
                    admin_full_name: client.client_admin?.full_name || '',
                    admin_user_name: client.client_admin?.user_name || '',
                    admin_email: client.client_admin?.email || '',
                    admin_password: '',
                    admin_phone: client.client_admin?.phone || '',
                    initial_branch_name: firstBranch?.branch_name || '',
                    initial_branch_short_name: firstBranch?.short_name || '',
                    initial_branch_address: firstBranch?.address || '',
                    initial_branch_city: firstBranch?.city || '',
                    initial_branch_state: firstBranch?.state || '',
                    initial_branch_country: firstBranch?.country || '',
                    initial_branch_contact_person: firstBranch?.contact_person || '',
                    initial_branch_phone: firstBranch?.phone || '',
                    initial_branch_email: firstBranch?.email || '',
                    initial_branch_opening_time: normalizeTime(firstBranch?.opening_time, '09:00'),
                    initial_branch_closing_time: normalizeTime(firstBranch?.closing_time, '23:00'),
                    onboarding_blueprint: client.onboarding_blueprint || '',
                    comments: client.comments || '',
                    contacts,
                });
                setCurrentSubscription(subscription || null);
                setHasExistingAdmin(Boolean(client.client_admin?.id));
                setHasExistingInitialBranch(Boolean(firstBranch?.id));
                setInitialSubscriptionSelection({
                    planId: subscription?.plan_id
                        ? String(subscription.plan_id)
                        : client.subscription_plan_id
                            ? String(client.subscription_plan_id)
                            : '',
                    billingCycle: (subscription?.billing_cycle || client.subscription_type) === 'annual' ? 'annual' : 'monthly',
                });
            } catch (error) {
                toast.error('Failed to load client', error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [id, isEdit]);

    const pageTitle = useMemo(() => isEdit ? 'Edit Client Registry' : 'Create Client Registry', [isEdit]);
    const selectedPlan = useMemo(
        () => subscriptionPlans.find((plan) => String(plan.id) === form.subscription_plan_id) || null,
        [form.subscription_plan_id, subscriptionPlans],
    );
    const selectedBlueprint = useMemo(
        () => blueprintOptions.find((item) => item.value === form.onboarding_blueprint) || null,
        [blueprintOptions, form.onboarding_blueprint],
    );
    const selectedPlanPrice = useMemo(() => {
        if (!selectedPlan) {
            return null;
        }

        return form.subscription_billing_cycle === 'annual'
            ? selectedPlan.annual_price
            : selectedPlan.monthly_price;
    }, [form.subscription_billing_cycle, selectedPlan]);
    const blueprintSummaryItems = useMemo(() => {
        const source: Record<string, number> = blueprintDetail?.active_version?.payload_summary || selectedBlueprint?.payload_summary || {};
        return [
            { label: 'Settings', value: Number(source.settings || 0) },
            { label: 'Roles', value: Number(source.roles || 0) },
            { label: 'Masters', value: Number(source.departments || 0) + Number(source.designations || 0) + Number(source.chart_of_accounts || 0) },
            { label: 'Catalog', value: Number(source.categories || 0) + Number(source.menu_types || 0) + Number(source.cuisine_types || 0) + Number(source.stations || 0) + Number(source.uoms || 0) },
        ];
    }, [blueprintDetail, selectedBlueprint]);
    const blueprintOperationalGroups = useMemo(() => {
        const source: Record<string, number> = blueprintDetail?.active_version?.payload_summary || selectedBlueprint?.payload_summary || {};
        return [
            { label: 'Platform Settings', value: Number(source.settings || 0), helper: 'Core tenant defaults and operating switches.' },
            { label: 'Security Roles', value: Number(source.roles || 0), helper: 'Predefined access structure for client teams.' },
            { label: 'Departments', value: Number(source.departments || 0), helper: 'Organizational departments for staffing and reporting.' },
            { label: 'Designations', value: Number(source.designations || 0), helper: 'Job titles and responsibility mapping.' },
            { label: 'Chart of Accounts', value: Number(source.chart_of_accounts || 0), helper: 'Starter finance and reporting codes.' },
            { label: 'Categories', value: Number(source.categories || 0), helper: 'Menu or catalog classification structure.' },
            { label: 'Menu Types', value: Number(source.menu_types || 0), helper: 'Service formats such as dine-in or takeaway.' },
            { label: 'Cuisine Types', value: Number(source.cuisine_types || 0), helper: 'Cuisine taxonomy for catalog organization.' },
            { label: 'Stations', value: Number(source.stations || 0), helper: 'Kitchen and fulfillment workstations.' },
            { label: 'UOMs', value: Number(source.uoms || 0), helper: 'Measurement units for recipes and inventory.' },
        ];
    }, [blueprintDetail, selectedBlueprint]);
    const blueprintModalFacts = useMemo(() => {
        const activeVersionNo = blueprintDetail?.active_version?.version_no || selectedBlueprint?.active_version_no || null;
        const versionCreatedAt = blueprintDetail?.active_version?.created_at
            ? new Date(blueprintDetail.active_version.created_at).toLocaleDateString()
            : null;
        const blueprintUpdatedAt = blueprintDetail?.updated_at
            ? new Date(blueprintDetail.updated_at).toLocaleDateString()
            : null;

        return [
            { label: 'Template Code', value: blueprintDetail?.blueprint_code || selectedBlueprint?.blueprint_code || 'N/A' },
            { label: 'Status', value: blueprintDetail?.status || 'active' },
            { label: 'Active Version', value: activeVersionNo ? `v${activeVersionNo}` : 'N/A' },
            { label: 'Schema Version', value: blueprintDetail?.active_version?.schema_version ? `v${blueprintDetail.active_version.schema_version}` : 'Default' },
            { label: 'Version Published', value: versionCreatedAt || 'Not recorded' },
            { label: 'Last Updated', value: blueprintUpdatedAt || 'Not recorded' },
        ];
    }, [blueprintDetail, selectedBlueprint]);
    const hasAdminInput = useMemo(
        () => [
            form.admin_full_name,
            form.admin_user_name,
            form.admin_email,
            form.admin_password,
            form.admin_phone,
        ].some((value) => value.trim().length > 0),
        [form.admin_email, form.admin_full_name, form.admin_password, form.admin_phone, form.admin_user_name],
    );
    const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const setContactField = (role: ContactRole, field: keyof ContactForm, value: string) => {
        setForm((current) => ({
            ...current,
            contacts: current.contacts.map((contact) => (
                contact.contact_type === role
                    ? { ...contact, [field]: value }
                    : contact
            )),
        }));
    };

    const generateSlug = () => {
        const slug = form.client_name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/--+/g, '-');
        setField('domain_slug', slug);
    };

    const generateAdminPassword = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const buffer = new Uint32Array(14);
        globalThis.crypto.getRandomValues(buffer);
        const password = Array.from(buffer, (value) => alphabet[value % alphabet.length]).join('');
        setField('admin_password', password);
    };

    const openBlueprintDetail = async () => {
        if (!selectedBlueprint?.id) {
            return;
        }

        setIsBlueprintModalOpen(true);
        if (blueprintDetail?.id === selectedBlueprint.id) {
            return;
        }

        setIsBlueprintDetailLoading(true);
        try {
            const response = await platformApi.getBlueprint(selectedBlueprint.id);
            setBlueprintDetail({
                id: String(response.id),
                blueprint_code: String(response.blueprint_code || ''),
                blueprint_name: String(response.blueprint_name || ''),
                description: response.description ? String(response.description) : '',
                status: response.status || 'draft',
                created_at: response.created_at ? String(response.created_at) : '',
                updated_at: response.updated_at ? String(response.updated_at) : '',
                active_version_id: response.active_version_id ?? null,
                active_version: response.active_version
                    ? {
                        id: Number(response.active_version.id),
                        version_no: Number(response.active_version.version_no || 0),
                        schema_version: response.active_version.schema_version ? Number(response.active_version.schema_version) : null,
                        created_at: response.active_version.created_at ? String(response.active_version.created_at) : '',
                        release_notes: response.active_version.release_notes ? String(response.active_version.release_notes) : '',
                        payload_summary: response.active_version.payload_summary && typeof response.active_version.payload_summary === 'object'
                            ? response.active_version.payload_summary
                            : null,
                    }
                    : null,
            });
        } catch (error) {
            toast.error('Failed to load blueprint detail', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsBlueprintDetailLoading(false);
        }
    };

    const validate = (): string | null => {
        if (!form.client_name.trim()) return 'Display name is required.';
        if (!form.legal_name.trim()) return 'Legal name is required.';
        if (!form.short_name.trim()) return 'Short name is required.';
        if (!isEdit && !form.domain_slug.trim()) return 'Domain slug is required.';
        if (!/^[a-z0-9-]+$/.test(form.domain_slug)) return 'Domain slug must use lowercase letters, numbers, and hyphens only.';
        if (!form.currency) return 'Currency is required.';
        if (!form.language) return 'Language is required.';
        if (!form.timezone) return 'Timezone is required.';
        if (!isEdit && subscriptionPlans.length > 0 && !form.subscription_plan_id) return 'Subscription plan selection is required.';
        if (hasAdminInput) {
            if (!form.admin_full_name.trim()) return 'Client admin full name is required.';
            if (!form.admin_user_name.trim()) return 'Client admin username is required.';
            if (!form.admin_email.trim()) return 'Client admin email is required.';
            if (!/\S+@\S+\.\S+/.test(form.admin_email.trim())) return 'Client admin email is invalid.';
            if ((!isEdit || !hasExistingAdmin) && !form.admin_password.trim()) return 'Client admin password is required.';
        }
        if (!isEdit) {
            if (!form.initial_branch_name.trim()) return 'Initial branch name is required.';
            if (!form.initial_branch_address.trim()) return 'Initial branch address is required.';
            if (!form.initial_branch_city.trim()) return 'Initial branch city is required.';
            if (!form.initial_branch_country.trim()) return 'Initial branch country is required.';
        } else if (
            hasExistingInitialBranch
            || form.initial_branch_name.trim()
            || form.initial_branch_short_name.trim()
            || form.initial_branch_address.trim()
            || form.initial_branch_city.trim()
            || form.initial_branch_state.trim()
            || form.initial_branch_country.trim()
            || form.initial_branch_contact_person.trim()
            || form.initial_branch_phone.trim()
            || form.initial_branch_email.trim()
        ) {
            if (!form.initial_branch_name.trim()) return 'First branch name is required.';
            if (!form.initial_branch_address.trim()) return 'First branch address is required.';
            if (!form.initial_branch_city.trim()) return 'First branch city is required.';
            if (!form.initial_branch_country.trim()) return 'First branch country is required.';
        }

        for (const contact of form.contacts) {
            if (!contact.full_name.trim()) {
                return `${CONTACT_META.find((item) => item.role === contact.contact_type)?.label} name is required.`;
            }
            if (!contact.email.trim() && !contact.phone.trim()) {
                return `${CONTACT_META.find((item) => item.role === contact.contact_type)?.label} requires an email or phone.`;
            }
        }

        return null;
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const error = validate();
        if (error) {
            toast.error('Validation failed', error);
            return;
        }

        const payload = {
            client_name: form.client_name.trim(),
            legal_name: form.legal_name.trim(),
            short_name: form.short_name.trim(),
            domain_slug: !isEdit ? form.domain_slug.trim() : undefined,
            business_type: form.business_type,
            address: form.address.trim() || undefined,
            area: form.area.trim() || undefined,
            city: form.city.trim() || undefined,
            country: form.country.trim() || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            website_url: form.website_url.trim() || undefined,
            currency: form.currency,
            language: form.language,
            timezone: form.timezone,
            subscription_plan_id: !isEdit && form.subscription_plan_id ? Number(form.subscription_plan_id) : undefined,
            subscription_billing_cycle: !isEdit && form.subscription_plan_id ? form.subscription_billing_cycle : undefined,
            admin_user: hasAdminInput ? {
                full_name: form.admin_full_name.trim(),
                user_name: form.admin_user_name.trim(),
                email: form.admin_email.trim().toLowerCase(),
                password: form.admin_password.trim() || undefined,
                phone: form.admin_phone.trim() || undefined,
            } : undefined,
            initial_branch: !isEdit || hasExistingInitialBranch || Boolean(
                form.initial_branch_name.trim()
                || form.initial_branch_short_name.trim()
                || form.initial_branch_address.trim()
                || form.initial_branch_city.trim()
                || form.initial_branch_state.trim()
                || form.initial_branch_country.trim()
                || form.initial_branch_contact_person.trim()
                || form.initial_branch_phone.trim()
                || form.initial_branch_email.trim()
            ) ? {
                branch_name: form.initial_branch_name.trim(),
                short_name: form.initial_branch_short_name.trim() || undefined,
                address: form.initial_branch_address.trim() || undefined,
                city: form.initial_branch_city.trim() || undefined,
                state: form.initial_branch_state.trim() || undefined,
                country: form.initial_branch_country.trim() || undefined,
                contact_person: form.initial_branch_contact_person.trim() || undefined,
                phone: form.initial_branch_phone.trim() || undefined,
                email: form.initial_branch_email.trim() || undefined,
                opening_time: form.initial_branch_opening_time || undefined,
                closing_time: form.initial_branch_closing_time || undefined,
            } : undefined,
            onboarding_blueprint: form.onboarding_blueprint || undefined,
            comments: form.comments.trim() || undefined,
            contacts: form.contacts.map((contact) => ({
                contact_type: contact.contact_type,
                full_name: contact.full_name.trim(),
                designation: contact.designation.trim() || undefined,
                email: contact.email.trim() || undefined,
                phone: contact.phone.trim() || undefined,
                alternate_phone: contact.alternate_phone.trim() || undefined,
                notes: contact.notes.trim() || undefined,
            })),
        };

        setIsSaving(true);
        try {
            const saved = await (
                isEdit && id
                    ? platformApi.updateClient(id, payload)
                    : platformApi.createClient(payload)
            ) as { id: string };
            if (
                isEdit
                && id
                && form.subscription_plan_id
                && (
                    initialSubscriptionSelection.planId !== form.subscription_plan_id
                    || initialSubscriptionSelection.billingCycle !== form.subscription_billing_cycle
                )
            ) {
                await platformApi.assignClientSubscription(id, {
                    plan_id: Number(form.subscription_plan_id),
                    billing_cycle: form.subscription_billing_cycle,
                    reason: 'Updated from client registry editor',
                    notes: 'Commercial plan revised from the edit client registry flow.',
                });
            }
            toast.success('Client saved', isEdit ? 'Client registry updated successfully.' : 'Client registry created successfully.');
            navigate(isEdit ? `/nexus/clients/${saved.id}` : `/nexus/onboarding/${saved.id}`);
        } catch (error) {
            toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <ShieldCheck size={36} className={styles.spin} />
                <span>Loading client registry...</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/nexus/clients')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.headerEyebrow}><ShieldCheck size={13} />Platform Tenant Registry</div>
                        <h1 className="text-gradient">{pageTitle}</h1>
                        <p>{isEdit ? 'Maintain client identity, onboarding blueprint, and commercial packaging from one professional workspace.' : 'Create a governed tenant record and capture its initial commercial plan in one flow.'}</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>1</span>
                    <span className={styles.sectionDividerLabel}>Client Identity</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                    <div className={styles.identityLayout}>
                        <div className={styles.identityMain}>
                            <div className={styles.compactSectionHeader}>
                                <h3 className={styles.cardTitle}><Building2 size={17} /> Master Identity</h3>
                                <span className={styles.compactSectionHint}>Commercial, legal, and recognizable naming.</span>
                            </div>

                            <div className={styles.identityNameGrid}>
                                <KitchenInput
                                    label="Display / Commercial Name"
                                    value={form.client_name}
                                    onChange={(event) => setField('client_name', event.target.value)}
                                    required
                                    icon={<Building2 size={16} />}
                                />
                                <KitchenInput
                                    label="Legal Name"
                                    value={form.legal_name}
                                    onChange={(event) => setField('legal_name', event.target.value)}
                                    required
                                    icon={<ShieldCheck size={16} />}
                                />
                            </div>

                            <div className={styles.identityMetaGrid}>
                                <KitchenInput
                                    label="Short Name"
                                    value={form.short_name}
                                    onChange={(event) => setField('short_name', event.target.value)}
                                    required
                                    icon={<User size={16} />}
                                />
                                <KitchenSelect
                                    label="Business Type"
                                    value={form.business_type}
                                    onChange={(event) => setField('business_type', event.target.value)}
                                    options={BUSINESS_TYPES}
                                />
                            </div>
                        </div>

                        <div className={styles.identityAside}>
                            <div className={styles.identityAsideCard}>
                                <div className={styles.identityAsideHeader}>
                                    <span className={styles.identityAsideTitle}><LockKeyhole size={15} /> Tenant Addressing</span>
                                    {!isEdit ? (
                                        <KitchenButton type="button" variant="ghost" onClick={generateSlug}>
                                            <Globe size={16} style={{ marginRight: 6 }} />
                                            Generate
                                        </KitchenButton>
                                    ) : null}
                                </div>
                                <KitchenInput
                                    label="Client Slug"
                                    value={form.domain_slug}
                                    onChange={(event) => setField('domain_slug', event.target.value.toLowerCase())}
                                    required
                                    readOnly={isEdit}
                                    addon="@"
                                    helpText={isEdit ? 'Slug is immutable after client creation.' : 'Used for tenant identification and login routing.'}
                                />
                                {!isEdit && (
                                    <div className={styles.identityStatusStrip}>
                                        <div className={styles.identityStatusItem}>
                                            <span className={styles.identityStatusLabel}>Initial Status</span>
                                            <strong>Draft</strong>
                                        </div>
                                        <div className={styles.identityStatusItem}>
                                            <span className={styles.identityStatusLabel}>Progression</span>
                                            <strong>Registry to onboarding</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>2</span>
                    <span className={styles.sectionDividerLabel}>Operational Identity</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                    <div className={styles.operationalLayout}>
                        <div className={styles.operationalPrimary}>
                            <div className={styles.compactSectionHeader}>
                                <h3 className={styles.cardTitle}><MapPin size={17} /> Base Settings</h3>
                                <span className={styles.compactSectionHint}>Regional defaults and tenant communication profile.</span>
                            </div>

                            <div className={styles.operationalSettingsGrid}>
                                <KitchenSelect
                                    label="Currency"
                                    value={form.currency}
                                    onChange={(event) => setField('currency', event.target.value)}
                                    options={CURRENCIES}
                                />
                                <KitchenSelect
                                    label="Language"
                                    value={form.language}
                                    onChange={(event) => setField('language', event.target.value)}
                                    options={LANGUAGES}
                                />
                                <KitchenSelect
                                    label="Timezone"
                                    value={form.timezone}
                                    onChange={(event) => setField('timezone', event.target.value)}
                                    options={TIMEZONES}
                                />
                            </div>

                            <div className={styles.operationalContactGrid}>
                                <KitchenInput
                                    label="Company Email"
                                    value={form.email}
                                    onChange={(event) => setField('email', event.target.value)}
                                    icon={<Mail size={16} />}
                                />
                                <KitchenInput
                                    label="Company Phone"
                                    value={form.phone}
                                    onChange={(event) => setField('phone', event.target.value)}
                                    icon={<Phone size={16} />}
                                />
                                <KitchenInput
                                    label="Website"
                                    value={form.website_url}
                                    onChange={(event) => setField('website_url', event.target.value)}
                                    icon={<Globe size={16} />}
                                />
                            </div>

                            <div className={styles.operationalAddressGrid}>
                                <KitchenInput
                                    label="Address"
                                    value={form.address}
                                    onChange={(event) => setField('address', event.target.value)}
                                    icon={<MapPin size={16} />}
                                />
                                <KitchenInput
                                    label="Locality / Area"
                                    value={form.area}
                                    onChange={(event) => setField('area', event.target.value)}
                                    icon={<MapPin size={16} />}
                                />
                                <KitchenSelect
                                    label="City"
                                    value={form.city}
                                    onChange={(event) => setField('city', event.target.value)}
                                    options={CITY_OPTIONS as { value: string; label: string }[]}
                                />
                                <KitchenSelect
                                    label="Country"
                                    value={form.country}
                                    onChange={(event) => setField('country', event.target.value)}
                                    options={COUNTRY_OPTIONS as { value: string; label: string }[]}
                                />
                            </div>
                        </div>

                        <div className={styles.operationalAside}>
                            <div className={styles.operationalAsideCard}>
                                <div className={styles.identityAsideHeader}>
                                    <span className={styles.identityAsideTitle}><ShieldCheck size={15} /> Onboarding Blueprint</span>
                                </div>
                                <KitchenSelect
                                    label="Blueprint Template"
                                    value={form.onboarding_blueprint}
                                    onChange={(event) => {
                                        setField('onboarding_blueprint', event.target.value);
                                        setBlueprintDetail(null);
                                    }}
                                    options={[
                                        { value: '', label: 'No blueprint' },
                                        ...blueprintOptions,
                                    ]}
                                />
                                {selectedBlueprint ? (
                                    <button
                                        type="button"
                                        className={styles.blueprintPreviewBtn}
                                        onClick={openBlueprintDetail}
                                    >
                                        <div className={styles.blueprintPreviewMeta}>
                                            <span className={styles.planName}>{selectedBlueprint.blueprint_name}</span>
                                            <span className={styles.planExpiry}>
                                                {selectedBlueprint.blueprint_code}
                                                {selectedBlueprint.active_version_no ? ` • v${selectedBlueprint.active_version_no}` : ''}
                                            </span>
                                        </div>
                                        <span className={styles.blueprintPreviewAction}>
                                            View template
                                            <ExternalLink size={14} />
                                        </span>
                                    </button>
                                ) : null}
                                <div className={styles.operationalNote}>
                                    <ShieldCheck size={14} />
                                    <span>Selected blueprint is auto-assigned when onboarding starts, then applied from the onboarding workspace.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>3</span>
                    <span className={styles.sectionDividerLabel}>Primary Contacts</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                    <div className={styles.compactSectionHeader}>
                        <h3 className={styles.cardTitle}><Users size={17} /> Primary Contacts</h3>
                        <span className={styles.compactSectionHint}>Three business contacts and the tenant admin in one compact panel.</span>
                    </div>
                    <div className={styles.contactGridCompact}>
                        {CONTACT_META.map(({ role, label }) => {
                            const contact = form.contacts.find((item) => item.contact_type === role)!;
                            return (
                                <div key={role} className={styles.contactPanel}>
                                    <div className={styles.contactPanelHeader}>
                                        <span className={styles.contactPanelTitle}>{label}</span>
                                        <span className={styles.contactPanelMeta}>Primary</span>
                                    </div>
                                    <div className={styles.contactPanelFields}>
                                        <KitchenInput
                                            label="Full Name"
                                            value={contact.full_name}
                                            onChange={(event) => setContactField(role, 'full_name', event.target.value)}
                                            required
                                        />
                                        <KitchenInput
                                            label="Designation"
                                            value={contact.designation}
                                            onChange={(event) => setContactField(role, 'designation', event.target.value)}
                                        />
                                        <KitchenInput
                                            label="Email"
                                            value={contact.email}
                                            onChange={(event) => setContactField(role, 'email', event.target.value)}
                                        />
                                        <KitchenInput
                                            label="Phone"
                                            value={contact.phone}
                                            onChange={(event) => setContactField(role, 'phone', event.target.value)}
                                        />
                                        <KitchenInput
                                            label="Alt Phone"
                                            value={contact.alternate_phone}
                                            onChange={(event) => setContactField(role, 'alternate_phone', event.target.value)}
                                        />
                                        <div className={styles.contactNoteWrap}>
                                            <label className={styles.fieldLabel}>Notes</label>
                                            <textarea
                                                className={styles.commentBox}
                                                rows={2}
                                                value={contact.notes}
                                                onChange={(event) => setContactField(role, 'notes', event.target.value)}
                                                placeholder={`Optional note for ${label.toLowerCase()}...`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div className={`${styles.contactPanel} ${styles.adminContactPanel}`}>
                            <div className={styles.contactPanelHeader}>
                                <span className={styles.contactPanelTitle}>{isEdit ? 'Client Admin Access' : 'Initial Client Admin'}</span>
                                <span className={styles.contactPanelMeta}>Admin</span>
                            </div>
                            <div className={styles.contactPanelFields}>
                                <KitchenInput
                                    label="Admin Full Name"
                                    value={form.admin_full_name}
                                    onChange={(event) => setField('admin_full_name', event.target.value)}
                                />
                                <KitchenInput
                                    label="Username"
                                    value={form.admin_user_name}
                                    onChange={(event) => setField('admin_user_name', event.target.value)}
                                />
                                <KitchenInput
                                    label="Email"
                                    type="email"
                                    value={form.admin_email}
                                    onChange={(event) => setField('admin_email', event.target.value)}
                                />
                                <KitchenInput
                                    label="Phone"
                                    value={form.admin_phone}
                                    onChange={(event) => setField('admin_phone', event.target.value)}
                                />
                                <div className={styles.adminPasswordRow}>
                                    <KitchenInput
                                        label={isEdit ? 'New Password' : 'Password'}
                                        type="password"
                                        value={form.admin_password}
                                        onChange={(event) => setField('admin_password', event.target.value)}
                                        autoComplete="new-password"
                                        placeholder={isEdit ? 'Leave blank to keep the current password' : 'Set the first sign-in password'}
                                        helpText={isEdit ? 'Leave blank to keep the current password unchanged.' : 'Set the first sign-in password for the client admin.'}
                                    />
                                    <KitchenButton type="button" variant="ghost" className={styles.adminPasswordButton} onClick={generateAdminPassword}>
                                        <KeyRound size={16} style={{ marginRight: 6 }} />
                                        Generate Password
                                    </KitchenButton>
                                </div>
                                <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                                    <ShieldCheck size={14} />
                                    <span>
                                        {hasAdminInput
                                            ? isEdit
                                                ? 'Saving this form will update the client admin profile. Enter a password only if you want to reset it.'
                                                : 'Saving this form will create the initial client admin so onboarding no longer needs a separate admin bootstrap step.'
                                            : 'Admin setup is optional here, but recommended before onboarding begins.'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>4</span>
                    <span className={styles.sectionDividerLabel}>Initial Branch</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                        <div className={styles.compactSectionHeader}>
                            <h3 className={styles.cardTitle}><Building2 size={17} /> First Branch Setup</h3>
                            <span className={styles.compactSectionHint}>
                                {isEdit
                                    ? (hasExistingInitialBranch
                                        ? 'Update the client’s first branch without leaving the client registry.'
                                        : 'Create the first branch from the edit page if this client does not have one yet.')
                                    : 'Required branch setup for every new client created from Nexus.'}
                            </span>
                        </div>

                        <div className={styles.infoBar}>
                            <ShieldCheck size={14} />
                            <span>
                                {isEdit
                                    ? (hasExistingInitialBranch
                                        ? 'Changes made here will update the earliest branch linked to this client.'
                                        : 'This client has no branches yet. Fill this section to create the first branch from the edit flow.')
                                    : 'Create the first branch right from Nexus so the new client can enter the console with a ready branch shell.'}
                            </span>
                        </div>

                        <div className={styles.contactPanel} style={{ marginBottom: 20 }}>
                            <div className={styles.contactPanelHeader}>
                                <div>
                                    <span className={styles.contactPanelTitle}>First branch setup</span>
                                    <span className={styles.contactPanelMeta}>
                                        {isEdit ? (hasExistingInitialBranch ? 'Editable' : 'Create on save') : 'Required'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.contactPanelFields}>
                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Branch Name"
                                    value={form.initial_branch_name}
                                    onChange={(event) => setField('initial_branch_name', event.target.value)}
                                    placeholder="e.g. Main Branch"
                                />
                                <KitchenInput
                                    label="Short Name"
                                    value={form.initial_branch_short_name}
                                    onChange={(event) => setField('initial_branch_short_name', event.target.value)}
                                    placeholder="e.g. Main"
                                />
                            </div>

                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Address"
                                    value={form.initial_branch_address}
                                    onChange={(event) => setField('initial_branch_address', event.target.value)}
                                    placeholder="Street address"
                                />
                                <KitchenSelect
                                    label="City"
                                    value={form.initial_branch_city}
                                    onChange={(event) => setField('initial_branch_city', event.target.value)}
                                    options={CITY_OPTIONS as { value: string; label: string }[]}
                                />
                            </div>

                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="State / Province"
                                    value={form.initial_branch_state}
                                    onChange={(event) => setField('initial_branch_state', event.target.value)}
                                />
                                <KitchenSelect
                                    label="Country"
                                    value={form.initial_branch_country}
                                    onChange={(event) => setField('initial_branch_country', event.target.value)}
                                    options={COUNTRY_OPTIONS as { value: string; label: string }[]}
                                />
                            </div>

                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Contact Person"
                                    value={form.initial_branch_contact_person}
                                    onChange={(event) => setField('initial_branch_contact_person', event.target.value)}
                                />
                                <KitchenInput
                                    label="Phone"
                                    value={form.initial_branch_phone}
                                    onChange={(event) => setField('initial_branch_phone', event.target.value)}
                                />
                            </div>

                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Branch Email"
                                    type="email"
                                    value={form.initial_branch_email}
                                    onChange={(event) => setField('initial_branch_email', event.target.value)}
                                />
                                <div />
                            </div>

                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Opening Time"
                                    type="time"
                                    value={form.initial_branch_opening_time}
                                    onChange={(event) => setField('initial_branch_opening_time', event.target.value)}
                                />
                                <KitchenInput
                                    label="Closing Time"
                                    type="time"
                                    value={form.initial_branch_closing_time}
                                    onChange={(event) => setField('initial_branch_closing_time', event.target.value)}
                                />
                            </div>
                        </div>
                    </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>5</span>
                    <span className={styles.sectionDividerLabel}>Commercial Plan</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                    <div className={styles.compactSectionHeader}>
                        <h3 className={styles.cardTitle}><CircleDollarSign size={17} /> {isEdit ? 'Subscription Setup' : 'Initial Subscription'}</h3>
                        <span className={styles.compactSectionHint}>{isEdit ? 'Keep the current package or switch the client to a different active plan.' : 'Placed just before the final notes and save step.'}</span>
                    </div>

                    <div className={styles.billingToggleWrap}>
                        <button
                            type="button"
                            className={`${styles.billingToggleBtn} ${form.subscription_billing_cycle === 'monthly' ? styles.billingToggleBtnActive : ''}`}
                            onClick={() => setField('subscription_billing_cycle', 'monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            className={`${styles.billingToggleBtn} ${form.subscription_billing_cycle === 'annual' ? styles.billingToggleBtnActive : ''}`}
                            onClick={() => setField('subscription_billing_cycle', 'annual')}
                        >
                            Annual
                        </button>
                    </div>

                    <div className={styles.planGridPremium}>
                        {subscriptionPlans.map((plan) => {
                            const isSelected = form.subscription_plan_id === String(plan.id);
                            const modules = plan.allowed_modules?.length ? plan.allowed_modules.slice(0, 4) : ['all'];
                            const price = form.subscription_billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;

                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    className={`${styles.planCardPremium} ${isSelected ? styles.planCardPremiumSelected : ''}`}
                                    onClick={() => setField('subscription_plan_id', String(plan.id))}
                                >
                                    {isSelected ? (
                                        <span className={styles.planSelectedOverlay}>
                                            <Check size={16} />
                                        </span>
                                    ) : null}

                                    <div className={styles.planCardHeader}>
                                        <div className={styles.planTitleRow}>
                                            <h4 className={styles.planNameLabel}>{plan.plan_name}</h4>
                                            <span className={styles.planStatusBadge}>{plan.plan_code}</span>
                                        </div>
                                        <p className={styles.planDescriptionLabel}>
                                            {plan.description || 'Operationally balanced package for managed tenant rollout.'}
                                        </p>
                                    </div>

                                    <div className={styles.planLimitsRow}>
                                        <div className={styles.planLimitItem}>
                                            <Layers3 size={16} />
                                            <div className={styles.planLimitInfo}>
                                                <span className={styles.limitValLarge}>{plan.max_branches || 'Flexible'}</span>
                                                <span className={styles.limitLabelMini}>Branches</span>
                                            </div>
                                        </div>
                                        <div className={styles.planLimitItem}>
                                            <Users size={16} />
                                            <div className={styles.planLimitInfo}>
                                                <span className={styles.limitValLarge}>{plan.max_users || 'Flexible'}</span>
                                                <span className={styles.limitLabelMini}>Users</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.planModulesGrid}>
                                        {modules.map((module) => (
                                            <span key={module} className={styles.moduleChipPremium}>
                                                {module === 'all' ? 'All modules' : String(module).replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>

                                    <div className={styles.planPricingFooter}>
                                        <div className={styles.priceCol}>
                                            <span className={styles.priceLab}>{form.subscription_billing_cycle === 'annual' ? 'Annual total' : 'Monthly price'}</span>
                                            <span className={styles.priceValLarge}>{plan.currency_code} {price.toFixed(2)}</span>
                                        </div>
                                        <div className={styles.priceCol}>
                                            <span className={styles.priceLab}>Billing</span>
                                            <span className={styles.priceValLarge}>{form.subscription_billing_cycle === 'annual' ? 'Yearly' : 'Monthly'}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                        <ShieldCheck size={14} />
                        <span>
                            {selectedPlan
                                ? `${isEdit ? 'Ready to save' : 'Selected'} ${selectedPlan.plan_name} at ${selectedPlan.currency_code} ${Number(selectedPlanPrice || 0).toFixed(2)} per ${form.subscription_billing_cycle === 'annual' ? 'year' : 'month'}${isEdit && (currentSubscription?.effective_end_at || currentSubscription?.grace_end_at || currentSubscription?.trial_end_at) ? `. Current commercial end is ${new Date(currentSubscription.grace_end_at || currentSubscription.trial_end_at || currentSubscription.effective_end_at).toLocaleDateString()}.` : '.'}`
                                : isEdit && currentSubscription
                                    ? `Current subscription is ${currentSubscription.plan_name} on ${currentSubscription.billing_cycle} billing${currentSubscription.effective_end_at ? ` until ${new Date(currentSubscription.effective_end_at).toLocaleDateString()}` : ''}. Select another card only if you want to change it.`
                                    : subscriptionPlans.length
                                        ? 'Select a subscription card to attach the commercial package to this client.'
                                        : 'No active plans are available yet. Create or activate a subscription plan first.'}
                        </span>
                    </div>
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionDividerNumber}>6</span>
                    <span className={styles.sectionDividerLabel}>Internal Notes</span>
                </div>

                <KitchenCard className={styles.editorCard}>
                    <h3 className={styles.cardTitle}><ShieldCheck size={17} /> Registry Notes</h3>
                    <textarea
                        className={styles.commentBox}
                        rows={4}
                        value={form.comments}
                        onChange={(event) => setField('comments', event.target.value)}
                        placeholder="Optional internal notes for platform operators..."
                    />
                </KitchenCard>

                <div className={styles.formBottomBar}>
                    <KitchenButton type="button" variant="secondary" onClick={() => navigate('/nexus/clients')}>
                        Cancel
                    </KitchenButton>
                    <KitchenButton type="submit" isLoading={isSaving}>
                        <Save size={16} style={{ marginRight: 6 }} />
                        {isEdit ? 'Save Client Registry' : 'Create Client Registry'}
                    </KitchenButton>
                </div>
            </form>

            {isBlueprintModalOpen ? (
                <div className={styles.modalBackdrop} onClick={() => setIsBlueprintModalOpen(false)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleBlock}>
                                <div className={styles.headerEyebrow}><ClipboardList size={13} /> Blueprint Template</div>
                                <h3 className={styles.cardTitle} style={{ marginBottom: 4 }}>
                                    {blueprintDetail?.blueprint_name || selectedBlueprint?.blueprint_name || 'Selected blueprint'}
                                </h3>
                                <p className={styles.modalSubtitle}>
                                    {(blueprintDetail?.blueprint_code || selectedBlueprint?.blueprint_code || '').trim()}
                                    {blueprintDetail?.active_version?.version_no ? ` • Active version v${blueprintDetail.active_version.version_no}` : selectedBlueprint?.active_version_no ? ` • Active version v${selectedBlueprint.active_version_no}` : ''}
                                </p>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setIsBlueprintModalOpen(false)}>
                                Close
                            </button>
                        </div>

                        {isBlueprintDetailLoading ? (
                            <div className={styles.loaderBox} style={{ minHeight: 220 }}>
                                <ShieldCheck size={30} className={styles.spin} />
                                <span>Loading blueprint detail...</span>
                            </div>
                        ) : (
                            <div className={styles.modalBody}>
                                <div className={styles.modalFactGrid}>
                                    {blueprintModalFacts.map((item) => (
                                        <div key={item.label} className={styles.modalFactCard}>
                                            <span>{item.label}</span>
                                            <strong>{item.value}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.modalDescription}>
                                    {blueprintDetail?.description || selectedBlueprint?.description || 'This template prepares onboarding defaults and starter operational masters for the tenant.'}
                                </div>

                                <div className={styles.modalSummaryGrid}>
                                    {blueprintSummaryItems.map((item) => (
                                        <div key={item.label} className={styles.modalSummaryCard}>
                                            <span className={styles.heroStatLabel}>{item.label}</span>
                                            <strong>{item.value}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.modalSection}>
                                    <div className={styles.modalSectionHeading}>
                                        <h4>Operational Coverage</h4>
                                        <p>What this template prepares before tenant-specific data starts evolving.</p>
                                    </div>
                                    <div className={styles.modalCoverageGrid}>
                                        {blueprintOperationalGroups.map((item) => (
                                            <div key={item.label} className={styles.modalCoverageCard}>
                                                <div>
                                                    <span>{item.label}</span>
                                                    <strong>{item.value}</strong>
                                                </div>
                                                <p>{item.helper}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.modalSection}>
                                    <div className={styles.modalSectionHeading}>
                                        <h4>Application Model</h4>
                                        <p>This template is designed to seed a tenant safely during onboarding.</p>
                                    </div>
                                    <div className={styles.modalAssuranceGrid}>
                                        <div className={styles.modalAssuranceCard}>
                                            <span>Overwrite Policy</span>
                                            <strong>Creates missing masters only</strong>
                                            <p>Existing tenant records stay intact, so the blueprint acts as a starter pack rather than a destructive sync.</p>
                                        </div>
                                        <div className={styles.modalAssuranceCard}>
                                            <span>Operational Focus</span>
                                            <strong>Setup and catalog foundations</strong>
                                            <p>Ideal for establishing departments, roles, menu taxonomy, kitchen stations, and foundational reporting structures.</p>
                                        </div>
                                        <div className={styles.modalAssuranceCard}>
                                            <span>Not Touched</span>
                                            <strong>Live transactional data</strong>
                                            <p>Users, branches, products, devices, and transactional history are intentionally outside this template application scope.</p>
                                        </div>
                                    </div>
                                </div>

                                {(blueprintDetail?.active_version?.release_notes || '').trim() ? (
                                    <div className={styles.infoBar} style={{ marginBottom: 0 }}>
                                        <ShieldCheck size={14} />
                                        <span>{blueprintDetail?.active_version?.release_notes}</span>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
