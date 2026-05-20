/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    Calendar,
    CreditCard,
    Eye,
    Mail,
    MapPin,
    Phone,
    Save,
    ShieldCheck,
    Truck,
    User,
} from 'lucide-react';
import styles from './VendorForm.module.css';
import { vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';

type VendorFormState = {
    vendor_name: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    tax_id: string;
    payment_terms: string;
    is_active: boolean;
};

type VendorRecord = VendorFormState & {
    id: number;
    usage_summary?: {
        purchase_order_count: number;
        branch_count: number;
        last_order_at: string | null;
        branch_names: string[];
    };
};

const emptyForm = (): VendorFormState => ({
    vendor_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    payment_terms: 'Cash',
    is_active: true,
});

function deriveCity(address: string): string {
    return address.split(',')[0]?.trim() || 'Not set';
}

export function VendorForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const isCreate = !id || id === 'new';
    const isEditRoute = !isCreate && location.pathname.endsWith('/edit');
    const isReadOnly = !isCreate && !isEditRoute;
    const {
        canViewVendors,
        canManageVendors,
        canViewVendorPayments,
    } = usePermissionAccess();

    const [loading, setLoading] = useState(!isCreate);
    const [saving, setSaving] = useState(false);
    const [vendor, setVendor] = useState<VendorRecord | null>(null);
    const [form, setForm] = useState<VendorFormState>(emptyForm);

    useEffect(() => {
        if (isCreate) {
            setLoading(false);
            setVendor(null);
            setForm(emptyForm());
            return;
        }

        let cancelled = false;

        const loadVendor = async () => {
            setLoading(true);
            try {
                const record = await vendorApi.getVendor(id as string);
                if (cancelled) {
                    return;
                }
                const nextVendor: VendorRecord = {
                    id: Number(record.id),
                    vendor_name: record.vendor_name || '',
                    contact_person: record.contact_person || '',
                    phone: record.phone || record.contact_phone || '',
                    email: record.email || record.contact_email || '',
                    address: record.address || record.vendor_address || '',
                    tax_id: record.tax_id || '',
                    payment_terms: record.payment_terms || 'Cash',
                    is_active: record.is_active !== false,
                    usage_summary: record.usage_summary || {
                        purchase_order_count: 0,
                        branch_count: 0,
                        last_order_at: null,
                        branch_names: [],
                    },
                };
                setVendor(nextVendor);
                setForm({
                    vendor_name: nextVendor.vendor_name,
                    contact_person: nextVendor.contact_person,
                    phone: nextVendor.phone,
                    email: nextVendor.email,
                    address: nextVendor.address,
                    tax_id: nextVendor.tax_id,
                    payment_terms: nextVendor.payment_terms,
                    is_active: nextVendor.is_active,
                });
            } catch (error: any) {
                if (!cancelled) {
                    toast.error('Load Failed', error.message || 'Could not load vendor.');
                    navigate('/console/inventory/vendors');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadVendor();
        return () => {
            cancelled = true;
        };
    }, [id, isCreate, navigate]);

    const headerTitle = useMemo(() => {
        if (isCreate) {
            return 'Add Vendor';
        }
        if (isEditRoute) {
            return `Edit Vendor: ${form.vendor_name || 'Vendor'}`;
        }
        return `Vendor Profile: ${form.vendor_name || 'Vendor'}`;
    }, [form.vendor_name, isCreate, isEditRoute]);

    const headerSubtitle = useMemo(() => {
        if (isCreate) {
            return 'Create a live vendor master record used by procurement and payments.';
        }
        if (isReadOnly) {
            return 'Read-only vendor profile with live procurement usage.';
        }
        return 'Edit the persisted vendor profile used by purchasing and settlement flows.';
    }, [isCreate, isReadOnly]);

    const setField = <K extends keyof VendorFormState>(key: K, value: VendorFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSave = async () => {
        if (!canManageVendors) {
            toast.error('Access Denied', 'Your current role cannot create or update vendors.');
            return;
        }

        if (!form.vendor_name.trim()) {
            toast.error('Validation Error', 'Vendor name is required.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                vendor_name: form.vendor_name.trim(),
                contact_person: form.contact_person.trim() || undefined,
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                address: form.address.trim() || undefined,
                tax_id: form.tax_id.trim() || undefined,
                payment_terms: form.payment_terms.trim() || 'Cash',
                is_active: form.is_active,
            };

            if (isCreate) {
                await vendorApi.createVendor(payload);
                toast.success('Created', 'Vendor created successfully.');
            } else {
                await vendorApi.updateVendor(id as string, payload);
                toast.success('Updated', 'Vendor updated successfully.');
            }

            navigate('/console/inventory/vendors');
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save vendor.');
        } finally {
            setSaving(false);
        }
    };

    if (!canViewVendors && !canManageVendors) {
        return (
            <div className={styles.page}>
                <div className={styles.warningBanner}>
                    <AlertTriangle size={16} />
                    Your current role does not have access to vendor master.
                </div>
            </div>
        );
    }

    if (isCreate && !canManageVendors) {
        return (
            <div className={styles.page}>
                <div className={styles.warningBanner}>
                    <AlertTriangle size={16} />
                    Your current role cannot create vendor records.
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/vendors')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.headerIcon}>
                        <Truck size={20} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>{headerTitle}</h1>
                        <p className={styles.pageSubtitle}>{headerSubtitle}</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnGhost} onClick={() => navigate('/console/inventory/vendors')}>
                        Back to List
                    </button>
                    {!isCreate && canViewVendorPayments && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => navigate('/console/inventory/vendor-payments')}
                        >
                            <CreditCard size={15} />
                            Payments
                        </button>
                    )}
                    {!isCreate && isReadOnly && canManageVendors && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => navigate(`/console/inventory/vendors/${id}/edit`)}
                        >
                            <Eye size={15} />
                            Edit Profile
                        </button>
                    )}
                    {!isReadOnly && (
                        <button
                            className={styles.btnPrimary}
                            onClick={handleSave}
                            disabled={saving || !form.vendor_name.trim()}
                        >
                            {saving ? (
                                <>
                                    <span className={styles.spinner} />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={15} />
                                    {isCreate ? 'Create Vendor' : 'Update Vendor'}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {!form.is_active && !isCreate && (
                <div className={styles.warningBanner}>
                    <AlertTriangle size={16} />
                    This vendor is inactive. It remains visible for reporting and history, but should not be used for new procurement.
                </div>
            )}

            <div className={styles.infoBox}>
                <ShieldCheck size={13} />
                <span>
                    Vendor master currently persists profile fields only. Branch usage and procurement activity below are read from live purchase-order history.
                </span>
            </div>

            <div className={styles.twoColumnLayout}>
                <div className={styles.mainCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <Building2 size={16} className={styles.cardHeaderIcon} />
                            <h3>Vendor Profile</h3>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.formRow2}>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Vendor Name <span className={styles.required}>*</span>
                                    </label>
                                    <div className={styles.inputWrapper}>
                                        <Building2 size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.vendor_name}
                                            onChange={(event) => setField('vendor_name', event.target.value)}
                                            placeholder="Ali Meat Shop"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Tax ID / NTN</label>
                                    <div className={styles.inputWrapper}>
                                        <ShieldCheck size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.tax_id}
                                            onChange={(event) => setField('tax_id', event.target.value)}
                                            placeholder="Tax registration number"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formRow3}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Contact Person</label>
                                    <div className={styles.inputWrapper}>
                                        <User size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.contact_person}
                                            onChange={(event) => setField('contact_person', event.target.value)}
                                            placeholder="Primary procurement contact"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Phone</label>
                                    <div className={styles.inputWrapper}>
                                        <Phone size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.phone}
                                            onChange={(event) => setField('phone', event.target.value)}
                                            placeholder="+92 300 0000000"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Email</label>
                                    <div className={styles.inputWrapper}>
                                        <Mail size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.email}
                                            onChange={(event) => setField('email', event.target.value)}
                                            placeholder="vendor@example.com"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formRow2}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Payment Terms</label>
                                    <div className={styles.inputWrapper}>
                                        <CreditCard size={16} className={styles.inputIcon} />
                                        <input
                                            className={styles.input}
                                            value={form.payment_terms}
                                            onChange={(event) => setField('payment_terms', event.target.value)}
                                            placeholder="Cash, Cash on Delivery, Credit 30 Days"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Status</label>
                                    <select
                                        className={styles.input}
                                        value={form.is_active ? 'active' : 'inactive'}
                                        onChange={(event) => setField('is_active', event.target.value === 'active')}
                                        disabled={isReadOnly}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Address</label>
                                <div className={styles.inputWrapper}>
                                    <MapPin size={16} className={styles.inputIcon} />
                                    <textarea
                                        className={`${styles.input} ${styles.textarea}`}
                                        value={form.address}
                                        onChange={(event) => setField('address', event.target.value)}
                                        placeholder="Street, area, city"
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.sideCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <Truck size={16} className={styles.cardHeaderIcon} />
                            <h3>Operational Snapshot</h3>
                        </div>
                        <div className={styles.cardBody}>
                            {loading ? (
                                <div className={styles.infoBox}>
                                    <Calendar size={13} />
                                    <span>Loading vendor activity...</span>
                                </div>
                            ) : (
                                <div className={styles.rulesList}>
                                    <div className={styles.ruleItem}>
                                        <Building2 size={13} />
                                        <span>City: {deriveCity(form.address)}</span>
                                    </div>
                                    <div className={styles.ruleItem}>
                                        <Truck size={13} />
                                        <span>Purchase Orders: {vendor?.usage_summary?.purchase_order_count ?? 0}</span>
                                    </div>
                                    <div className={styles.ruleItem}>
                                        <MapPin size={13} />
                                        <span>Branches Used: {vendor?.usage_summary?.branch_count ?? 0}</span>
                                    </div>
                                    <div className={styles.ruleItem}>
                                        <Calendar size={13} />
                                        <span>
                                            Last Activity: {vendor?.usage_summary?.last_order_at
                                                ? new Date(vendor.usage_summary.last_order_at).toLocaleString('en-PK')
                                                : 'No purchase history yet'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!loading && vendor?.usage_summary?.branch_names?.length ? (
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <MapPin size={16} className={styles.cardHeaderIcon} />
                                <h3>Live Branch Usage</h3>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.rulesList}>
                                    {vendor.usage_summary.branch_names.map((branchName) => (
                                        <div key={branchName} className={styles.ruleItem}>
                                            <ShieldCheck size={13} />
                                            <span>{branchName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <AlertTriangle size={16} className={styles.cardHeaderIcon} />
                            <h3>Master Scope</h3>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.rulesList}>
                                <div className={styles.ruleItem}>
                                    <ShieldCheck size={13} />
                                    <span>Vendor profile fields are live and persisted.</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <ShieldCheck size={13} />
                                    <span>Inactive vendors remain visible for audit and history.</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <ShieldCheck size={13} />
                                    <span>Branch usage is derived from live purchase orders, not manual mapping.</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <ShieldCheck size={13} />
                                    <span>Vendor item pricing and settlement rules are handled in procurement and payment flows, not stored in vendor master.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
