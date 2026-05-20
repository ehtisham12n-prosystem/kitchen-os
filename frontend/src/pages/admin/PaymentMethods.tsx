/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { CreditCard, Trash2, Save, Loader2, Pencil, ShieldCheck } from 'lucide-react';
import { setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './Admin.module.css';

type PaymentMethodRecord = {
    id: number;
    method_name: string;
    method_code: string;
    description?: string | null;
    is_active: boolean;
};

const EMPTY_FORM = {
    method_name: '',
    method_code: '',
    description: '',
    is_active: true,
};

export function PaymentMethods() {
    const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

    const loadMethods = async () => {
        setIsLoading(true);
        try {
            const data = await setupApi.getPaymentMethods();
            setMethods(data);
        } catch (error: any) {
            toast.error('Payment Methods', error.message || 'Could not load payment methods.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadMethods();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
    };

    const startEdit = (method: PaymentMethodRecord) => {
        setEditingId(method.id);
        setForm({
            method_name: method.method_name,
            method_code: method.method_code,
            description: method.description || '',
            is_active: method.is_active,
        });
    };

    const handleSave = async () => {
        if (!form.method_name.trim()) {
            toast.error('Payment Methods', 'Payment method name is required.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                method_name: form.method_name.trim(),
                method_code: form.method_code.trim() || undefined,
                description: form.description.trim() || undefined,
                is_active: form.is_active,
            };

            if (editingId) {
                await setupApi.updatePaymentMethod(editingId, payload);
                toast.success('Payment Methods', 'Payment method updated.');
            } else {
                await setupApi.createPaymentMethod(payload);
                toast.success('Payment Methods', 'Payment method created.');
            }

            resetForm();
            await loadMethods();
        } catch (error: any) {
            toast.error('Payment Methods', error.message || 'Could not save payment method.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Archive this payment method?')) {
            return;
        }

        try {
            await setupApi.deletePaymentMethod(id);
            toast.success('Payment Methods', 'Payment method archived.');
            if (editingId === id) {
                resetForm();
            }
            await loadMethods();
        } catch (error: any) {
            toast.error('Payment Methods', error.message || 'Could not archive payment method.');
        }
    };

    const handleToggleStatus = async (method: PaymentMethodRecord, nextActive: boolean) => {
        setTogglingId(method.id);
        try {
            await setupApi.updatePaymentMethod(method.id, { is_active: nextActive });
            setMethods((prev) => prev.map((entry) => (
                entry.id === method.id ? { ...entry, is_active: nextActive } : entry
            )));
            if (editingId === method.id) {
                setForm((prev) => ({ ...prev, is_active: nextActive }));
            }
            toast.success('Payment Methods', `Payment method ${nextActive ? 'enabled' : 'disabled'}.`);
        } catch (error: any) {
            toast.error('Payment Methods', error.message || 'Could not update payment method status.');
        } finally {
            setTogglingId(null);
        }
    };

    const filteredMethods = useMemo(() => methods.filter((method) => {
        const matchSearch = !searchTerm.trim() || [method.method_name, method.method_code, method.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchTerm.trim().toLowerCase()));
        const matchStatus = statusFilter === 'all'
            || (statusFilter === 'active' && method.is_active)
            || (statusFilter === 'archived' && !method.is_active);
        return matchSearch && matchStatus;
    }), [methods, searchTerm, statusFilter]);

    const columns: ColumnDef<PaymentMethodRecord>[] = [
        {
            key: 'name',
            header: 'Method',
            cell: (row) => (
                <div className={styles.compactMeta}>
                    <div className={styles.compactTitleRow}>
                        <CreditCard size={16} color="var(--accent-primary)" />
                        <strong>{row.method_name}</strong>
                    </div>
                </div>
            ),
        },
        {
            key: 'code',
            header: 'Method Code',
            cell: (row) => row.method_code || 'No code assigned',
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <button
                    type="button"
                    className={`${styles.tabletSwitch} ${row.is_active ? styles.tabletSwitchOn : styles.tabletSwitchOff}`}
                    onClick={() => void handleToggleStatus(row, !row.is_active)}
                    disabled={togglingId === row.id}
                    aria-pressed={row.is_active}
                    title={row.is_active ? 'Disable payment method' : 'Enable payment method'}
                >
                    <span className={styles.tabletSwitchTrack}>
                        <span className={styles.tabletSwitchThumb}></span>
                    </span>
                    <span className={styles.tabletSwitchLabel}>{togglingId === row.id ? 'Saving...' : row.is_active ? 'Enabled' : 'Disabled'}</span>
                </button>
            ),
        },
        {
            key: 'description',
            header: 'Description',
            cell: (row) => row.description || 'No description',
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
                        <Trash2 size={14} color="var(--badge-error-text)" />
                    </KitchenButton>
                </div>
            ),
        },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.paymentHeaderCopy}>
                    <h1>Payment Methods</h1>
                    <p>Control the payment modes available across POS, accounting, and setup workflows.</p>
                    <div className={styles.paymentHeroMeta}>
                        <span className={styles.paymentHeroChip}><ShieldCheck size={13} /> Shared setup master</span>
                        <span className={styles.paymentHeroChip}><CreditCard size={13} /> Live data only</span>
                    </div>
                </div>
            </header>
            <div className={styles.compactAdminGrid}>
                <KitchenCard noPadding className={styles.tableCard}>
                    <div className={styles.paymentTableIntro}>
                        <strong>Configured Methods</strong>
                        <span>Archive unused modes instead of deleting history-linked references.</span>
                    </div>
                    <div className={styles.paymentToolbar}>
                        <KitchenInput
                            placeholder="Search by method, code, or description"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                        <select
                            className={styles.paymentToolbarSelect}
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived')}
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    {isLoading ? (
                        <div className={styles.compactLoader}><Loader2 size={24} className="spinner" /></div>
                    ) : (
                        <KitchenTable columns={columns} data={filteredMethods} emptyMessage="No payment methods match the current filters." />
                    )}
                </KitchenCard>

                <KitchenCard title={editingId ? 'Edit Method' : 'Quick Add'} className={styles.compactCard}>
                    <div className={styles.compactForm}>
                        <KitchenInput label="Method Name" value={form.method_name} onChange={(event) => setForm((prev) => ({ ...prev, method_name: event.target.value }))} placeholder="e.g. Apple Pay" />
                        <KitchenInput label="Method Code" value={form.method_code} onChange={(event) => setForm((prev) => ({ ...prev, method_code: event.target.value.toUpperCase() }))} placeholder="Optional auto-code override" />
                        <KitchenInput label="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Operational notes or settlement remark" />
                        <div className={styles.formSwitchRow}>
                            <span className={styles.formSwitchLabel}>Availability</span>
                            <button
                                type="button"
                                className={`${styles.tabletSwitch} ${form.is_active ? styles.tabletSwitchOn : styles.tabletSwitchOff}`}
                                onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                                aria-pressed={form.is_active}
                            >
                                <span className={styles.tabletSwitchTrack}>
                                    <span className={styles.tabletSwitchThumb}></span>
                                </span>
                                <span className={styles.tabletSwitchLabel}>{form.is_active ? 'Enabled' : 'Disabled'}</span>
                            </button>
                        </div>
                        <div className={styles.compactButtonRow}>
                            {editingId && <KitchenButton variant="secondary" size="sm" onClick={resetForm}>Cancel</KitchenButton>}
                            <KitchenButton variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} style={{ marginRight: '6px' }} />}
                                {editingId ? 'Update' : 'Create'}
                            </KitchenButton>
                        </div>
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}

export default PaymentMethods;
