/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { Plus, Percent, Trash2, Save, Loader2, Pencil, X } from 'lucide-react';
import { setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './Admin.module.css';

type TaxRecord = {
    id: number;
    tax_name: string;
    tax_code: string;
    tax_registration_number?: string | null;
    calculation_method: 'percentage' | 'fixed';
    tax_rate: number;
    payment_type_rates?: Record<string, number> | null;
    description?: string | null;
    is_default: boolean;
    is_active: boolean;
    applies_to_dine_in: boolean;
    applies_to_takeout: boolean;
    applies_to_delivery: boolean;
};

type PaymentMethodRecord = {
    id: number;
    method_name: string;
    method_code: string;
    is_active: boolean;
};

type TaxFormState = {
    tax_name: string;
    tax_code: string;
    tax_registration_number: string;
    calculation_method: 'percentage' | 'fixed';
    tax_rate: string;
    payment_type_rates: Record<string, string>;
    description: string;
    is_default: boolean;
    is_active: boolean;
    applies_to_dine_in: boolean;
    applies_to_takeout: boolean;
    applies_to_delivery: boolean;
};

const createEmptyForm = (paymentMethods: PaymentMethodRecord[]): TaxFormState => ({
    tax_name: '',
    tax_code: '',
    tax_registration_number: '',
    calculation_method: 'percentage' as const,
    tax_rate: '0',
    payment_type_rates: Object.fromEntries(paymentMethods.map((method) => [method.method_code, ''])),
    description: '',
    is_default: false,
    is_active: true,
    applies_to_dine_in: true,
    applies_to_takeout: true,
    applies_to_delivery: true,
});

export function TaxConfiguration() {
    const [taxRates, setTaxRates] = useState<TaxRecord[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<TaxFormState>(() => createEmptyForm([]));

    const fetchTaxes = async () => {
        setIsLoading(true);
        try {
            const [taxes, methods] = await Promise.all([
                setupApi.getTaxes(),
                setupApi.getPaymentMethods(),
            ]);
            const activeMethods = methods.filter((method: PaymentMethodRecord) => method.is_active);
            setTaxRates(taxes);
            setPaymentMethods(activeMethods);
            setForm((current) => ({
                ...createEmptyForm(activeMethods),
                ...current,
                payment_type_rates: {
                    ...Object.fromEntries(activeMethods.map((method) => [method.method_code, ''])),
                    ...current.payment_type_rates,
                },
            }));
        } catch (error) {
            console.error('Failed to load taxes', error);
            toast.error('Tax Configuration', 'Could not load tax profiles.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void fetchTaxes();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setForm(createEmptyForm(paymentMethods));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const startEdit = (tax: TaxRecord) => {
        setEditingId(tax.id);
        setForm({
            tax_name: tax.tax_name,
            tax_code: tax.tax_code,
            tax_registration_number: tax.tax_registration_number || '',
            calculation_method: tax.calculation_method,
            tax_rate: String(tax.tax_rate),
            payment_type_rates: Object.fromEntries(
                paymentMethods.map((method) => [
                    method.method_code,
                    tax.payment_type_rates?.[method.method_code] != null ? String(tax.payment_type_rates[method.method_code]) : '',
                ]),
            ),
            description: tax.description || '',
            is_default: tax.is_default,
            is_active: tax.is_active,
            applies_to_dine_in: tax.applies_to_dine_in,
            applies_to_takeout: tax.applies_to_takeout,
            applies_to_delivery: tax.applies_to_delivery,
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.tax_name.trim() || !form.tax_code.trim() || !form.tax_registration_number.trim()) {
            toast.error('Tax Configuration', 'Tax name, tax code, and tax registration number are required.');
            return;
        }

        const paymentTypeRates = Object.fromEntries(
            Object.entries(form.payment_type_rates)
                .filter(([, value]) => String(value).trim() !== '')
                .map(([key, value]) => [key, Number(value)]),
        );

        setIsSaving(true);
        try {
            const payload = {
                tax_name: form.tax_name.trim(),
                tax_code: form.tax_code.trim(),
                tax_registration_number: form.tax_registration_number.trim(),
                calculation_method: form.calculation_method,
                tax_rate: Number(form.tax_rate || 0),
                payment_type_rates: Object.keys(paymentTypeRates).length > 0 ? paymentTypeRates : undefined,
                description: form.description.trim() || undefined,
                is_default: form.is_default,
                is_active: form.is_active,
                applies_to_dine_in: form.applies_to_dine_in,
                applies_to_takeout: form.applies_to_takeout,
                applies_to_delivery: form.applies_to_delivery,
            };

            if (editingId) {
                await setupApi.updateTax(editingId, payload);
                toast.success('Tax Configuration', 'Tax profile updated.');
            } else {
                await setupApi.createTax(payload);
                toast.success('Tax Configuration', 'Tax profile created.');
            }

            closeModal();
            await fetchTaxes();
        } catch (error: any) {
            console.error('Failed to save tax profile', error);
            toast.error('Tax Configuration', error.message || 'Could not save tax profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Archive this tax profile?')) {
            return;
        }

        try {
            await setupApi.deleteTax(id);
            toast.success('Tax Configuration', 'Tax profile archived.');
            if (editingId === id) {
                closeModal();
            }
            await fetchTaxes();
        } catch (error: any) {
            console.error('Failed to archive tax profile', error);
            toast.error('Tax Configuration', error.message || 'Could not archive tax profile.');
        }
    };

    const columns: ColumnDef<TaxRecord>[] = [
        {
            key: 'region',
            header: 'Tax Profile',
            cell: (row) => (
                <div className={styles.taxProfileCell}>
                    <div className={styles.taxProfileMain}>
                        <div className={styles.taxProfileTitleRow}>
                            <Percent size={16} color="#3b82f6" />
                            <strong>{row.tax_name}</strong>
                        </div>
                        <div className={styles.taxProfileCodeRow}>
                            <span className={styles.taxCodeBadge}>{row.tax_code}</span>
                            {row.is_default && <span className={`${styles.inlineStatus} ${styles.inlineStatusActive}`}>Default</span>}
                            <span className={`${styles.inlineStatus} ${row.is_active ? styles.inlineStatusActive : styles.inlineStatusMuted}`}>
                                {row.is_active ? 'Active' : 'Archived'}
                            </span>
                        </div>
                    </div>
                    <div className={styles.taxProfileSubtext}>
                        Registration No: {row.tax_registration_number || 'Not provided'}
                    </div>
                    {row.description && (
                        <div className={styles.taxProfileDescription}>{row.description}</div>
                    )}
                </div>
            ),
        },
        {
            key: 'rate',
            header: 'Rate Setup',
            cell: (row) => (
                <div className={styles.taxReadBlock}>
                    <strong>
                        {row.calculation_method === 'percentage'
                            ? `${Number(row.tax_rate).toFixed(2)}%`
                            : `PKR ${Number(row.tax_rate).toFixed(2)}`}
                    </strong>
                    <span>{row.calculation_method === 'percentage' ? 'Percentage based' : 'Fixed amount'}</span>
                </div>
            ),
        },
        {
            key: 'paymentRates',
            header: 'Payment Type Rates',
            cell: (row) => {
                const rates = row.payment_type_rates || {};
                const labels = paymentMethods
                    .map((method) => rates[method.method_code] != null ? `${method.method_name}: ${Number(rates[method.method_code]).toFixed(2)}%` : null)
                    .filter(Boolean);
                return (
                    <div className={styles.taxReadBlock}>
                        <strong>{labels.length > 0 ? `${labels.length} custom override${labels.length > 1 ? 's' : ''}` : 'Uses base rate'}</strong>
                        <span>{labels.join(' • ') || 'All payment methods follow the base rate'}</span>
                    </div>
                );
            },
        },
        {
            key: 'channels',
            header: 'Channels',
            cell: (row) => (
                <div className={styles.taxChannelList}>
                    {[row.applies_to_dine_in ? 'Dine-In' : null, row.applies_to_takeout ? 'Takeaway' : null, row.applies_to_delivery ? 'Delivery' : null]
                        .filter(Boolean)
                        .map((channel) => (
                            <span key={channel} className={styles.taxChannelChip}>{channel}</span>
                        ))}
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.compactActions}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => startEdit(row)}>
                        <Pencil size={14} />
                    </KitchenButton>
                    <KitchenButton variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
                        <Trash2 size={14} color="#ef4444" />
                    </KitchenButton>
                </div>
            ),
        },
    ];

    return (
        <div className={`${styles.container} ${styles.taxPage}`}>
            <header className={`${styles.header} ${styles.taxHeader}`}>
                <div className={styles.taxHeaderCopy}>
                    <h1>Tax Configuration</h1>
                    <p>Create clear tax profiles for billing, branch defaults, and payment-specific tax behavior.</p>
                </div>
                <KitchenButton size="sm" onClick={openCreateModal}>
                    <Plus size={16} style={{ marginRight: '6px' }} />
                    New Tax Profile
                </KitchenButton>
            </header>

            <KitchenCard noPadding className={`${styles.tableCard} ${styles.taxTableCard}`}>
                <div className={styles.taxTableIntro}>
                    <div>
                        <strong>Existing Tax Profiles</strong>
                        <span>Review active and default tax setups before making changes.</span>
                    </div>
                </div>
                {isLoading ? (
                    <div className={styles.compactLoader}>
                        <Loader2 size={24} className="spinner" />
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={taxRates} emptyMessage="No tax profiles added yet." />
                )}
                {!isLoading && (
                    <div className={styles.compactFootnote}>
                        {taxRates.filter((tax) => tax.is_active).length} active profiles out of {taxRates.length}
                    </div>
                )}
            </KitchenCard>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={`${styles.modal} ${styles.taxModal}`} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingId ? 'Edit Tax Profile' : 'New Tax Profile'}</h2>
                            <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close tax profile form">
                                <X size={18} />
                            </button>
                        </div>
                        <div className={`${styles.modalBody} ${styles.taxModalBody}`}>
                            <div className={styles.compactForm}>
                        <div className={styles.taxSectionLabel}>Basic Details</div>
                        <div className={styles.taxFormGrid}>
                            <KitchenInput label="Tax Name" value={form.tax_name} onChange={(event) => setForm((prev) => ({ ...prev, tax_name: event.target.value }))} placeholder="e.g. Sindh Sales Tax" />
                            <KitchenInput label="Tax Code" value={form.tax_code} onChange={(event) => setForm((prev) => ({ ...prev, tax_code: event.target.value.toUpperCase() }))} placeholder="e.g. PK_SST" />
                            <KitchenInput label="Tax Registration Number" value={form.tax_registration_number} onChange={(event) => setForm((prev) => ({ ...prev, tax_registration_number: event.target.value }))} placeholder="Enter registration / NTN / GST number" />
                            <label className={styles.taxSelectField}>
                                <span>Calculation</span>
                                <select
                                    className={styles.taxSelect}
                                    value={form.calculation_method}
                                    onChange={(event) => setForm((prev) => ({
                                        ...prev,
                                        calculation_method: event.target.value as 'percentage' | 'fixed',
                                    }))}
                                >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed amount</option>
                                </select>
                            </label>
                            <div className={styles.taxFormSpanTwo}>
                                <KitchenInput
                                    label={form.calculation_method === 'percentage' ? 'Base Tax Rate (%)' : 'Base Amount'}
                                    type="number"
                                    value={form.tax_rate}
                                    onChange={(event) => setForm((prev) => ({ ...prev, tax_rate: event.target.value }))}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className={styles.taxRatesBlock}>
                            <div className={styles.taxSectionLabel}>Payment Mode Tax Rates</div>
                            <div className={styles.compactTwoColGrid}>
                                {paymentMethods.map((method) => (
                                    <KitchenInput
                                        key={method.id}
                                        label={`${method.method_name} Rate (%)`}
                                        type="number"
                                        value={form.payment_type_rates[method.method_code] || ''}
                                        onChange={(event) => setForm((prev) => ({
                                            ...prev,
                                            payment_type_rates: { ...prev.payment_type_rates, [method.method_code]: event.target.value },
                                        }))}
                                        placeholder="Use base rate if blank"
                                    />
                                ))}
                            </div>
                            {paymentMethods.length === 0 && (
                                <span className={styles.compactHint}>
                                    No active payment methods found. Add them in Payment Methods and they will appear here automatically.
                                </span>
                            )}
                            <span className={styles.compactHint}>
                                Leave a payment mode blank to use the base tax rate. Example: Cash 15%, Card 5%.
                            </span>
                        </div>

                        <div className={styles.taxFormSpanTwo}>
                            <KitchenInput label="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional notes" />
                        </div>

                        <div className={styles.taxSectionLabel}>Where This Tax Applies</div>
                        <div className={styles.taxToggleGrid}>
                            <label className={styles.compactCheckbox}><input type="checkbox" checked={form.is_default} onChange={(event) => setForm((prev) => ({ ...prev, is_default: event.target.checked }))} /> <span>Default tax profile</span></label>
                            <label className={styles.compactCheckbox}><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} /> <span>Active</span></label>
                            <label className={styles.compactCheckbox}><input type="checkbox" checked={form.applies_to_dine_in} onChange={(event) => setForm((prev) => ({ ...prev, applies_to_dine_in: event.target.checked }))} /> <span>Dine-In</span></label>
                            <label className={styles.compactCheckbox}><input type="checkbox" checked={form.applies_to_takeout} onChange={(event) => setForm((prev) => ({ ...prev, applies_to_takeout: event.target.checked }))} /> <span>Takeaway</span></label>
                            <label className={styles.compactCheckbox}><input type="checkbox" checked={form.applies_to_delivery} onChange={(event) => setForm((prev) => ({ ...prev, applies_to_delivery: event.target.checked }))} /> <span>Delivery</span></label>
                        </div>

                        <div className={styles.compactButtonRow}>
                            <KitchenButton variant="secondary" size="sm" onClick={closeModal}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} style={{ marginRight: '6px' }} />}
                                {editingId ? 'Update Profile' : 'Create Profile'}
                            </KitchenButton>
                        </div>
                    </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
