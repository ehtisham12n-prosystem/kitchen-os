import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Gift, Percent, Plus, Search, ShieldCheck, Ticket, Users } from 'lucide-react';
import { dealsApi, resolveActiveBranchId } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './VoucherList.module.css';

type VoucherRecord = {
    id: number;
    code: string;
    name?: string | null;
    description?: string | null;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_order_value: number;
    max_discount_amount?: number | null;
    is_active: boolean;
    usage_limit?: number | null;
    usage_count: number;
    start_date?: string | null;
    end_date?: string | null;
    branchAvailability?: Record<string, boolean> | null;
    applicable_order_types?: string[] | null;
    customer_required?: boolean;
    per_customer_limit?: number | null;
    first_order_only?: boolean;
};

type BranchOption = { id: number; branch_name: string };

type VoucherFormState = {
    code: string;
    name: string;
    description: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: string;
    min_order_value: string;
    max_discount_amount: string;
    start_date: string;
    end_date: string;
    usage_limit: string;
    is_active: boolean;
    customer_required: boolean;
    per_customer_limit: string;
    first_order_only: boolean;
    applicable_order_types: string[];
    branchAvailability: Record<string, boolean>;
};

const emptyForm = (branches: BranchOption[]): VoucherFormState => ({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_value: '0',
    max_discount_amount: '',
    start_date: '',
    end_date: '',
    usage_limit: '',
    is_active: true,
    customer_required: false,
    per_customer_limit: '',
    first_order_only: false,
    applicable_order_types: [],
    branchAvailability: Object.fromEntries(branches.map((branch) => [String(branch.id), true])),
});

export function VoucherList() {
    const {
        allowedBranches,
        activeBranchId,
        canViewDeals,
        canManageDeals,
    } = usePermissionAccess();
    const branches = useMemo<BranchOption[]>(
        () => (allowedBranches ?? []).map((branch) => ({
            id: Number(branch.branch_id),
            branch_name: branch.branch_name || `Branch ${branch.branch_id}`,
        })),
        [allowedBranches],
    );
    const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
    const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<VoucherFormState>(emptyForm([]));
    const [preview, setPreview] = useState({
        branch_id: String(activeBranchId || resolveActiveBranchId() || ''),
        customer_id: '',
        order_total: '',
        order_type: 'dine_in',
        code: '',
    });
    const [previewResult, setPreviewResult] = useState<any | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [voucherRows, redemptionRows] = await Promise.all([
                dealsApi.getVouchers(),
                dealsApi.getRecentRedemptions(),
            ]);
            setVouchers((voucherRows ?? []).map((row) => ({
                ...row,
                discount_value: Number(row.discount_value ?? 0),
                min_order_value: Number(row.min_order_value ?? 0),
                max_discount_amount: row.max_discount_amount === null ? null : Number(row.max_discount_amount ?? 0),
                usage_count: Number(row.usage_count ?? 0),
                usage_limit: row.usage_limit === null ? null : Number(row.usage_limit ?? 0),
            })));
            setRecentRedemptions(redemptionRows ?? []);
        } catch (error: any) {
            toast.error('Promotion Load Failed', error?.message || 'Could not load vouchers and redemptions.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!canViewDeals && !canManageDeals) {
            setIsLoading(false);
            return;
        }
        void loadData();
    }, [canManageDeals, canViewDeals]);

    useEffect(() => {
        setPreview((current) => ({
            ...current,
            branch_id: current.branch_id || String(activeBranchId || ''),
        }));
    }, [activeBranchId]);

    const filteredVouchers = useMemo(() => vouchers.filter((voucher) => {
        const needle = searchTerm.trim().toLowerCase();
        const matchSearch = !needle || [voucher.code, voucher.name, voucher.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        const status = !voucher.is_active ? 'inactive' : (voucher.end_date && new Date(voucher.end_date) < new Date() ? 'expired' : 'active');
        return matchSearch && (statusFilter === 'all' || statusFilter === status);
    }), [searchTerm, statusFilter, vouchers]);

    const stats = useMemo(() => ({
        active: vouchers.filter((voucher) => voucher.is_active).length,
        redemptions: vouchers.reduce((sum, voucher) => sum + Number(voucher.usage_count || 0), 0),
        customerBound: vouchers.filter((voucher) => voucher.customer_required).length,
    }), [vouchers]);

    const openCreate = () => {
        if (!canManageDeals) {
            toast.error('Access Denied', 'Your current role cannot create vouchers.');
            return;
        }
        setEditingVoucherId(null);
        setForm(emptyForm(branches));
        setIsModalOpen(true);
    };

    const openEdit = (voucher: VoucherRecord) => {
        if (!canManageDeals) {
            return;
        }
        setEditingVoucherId(voucher.id);
        setForm({
            code: voucher.code ?? '',
            name: voucher.name ?? '',
            description: voucher.description ?? '',
            discount_type: voucher.discount_type,
            discount_value: String(voucher.discount_value ?? ''),
            min_order_value: String(voucher.min_order_value ?? 0),
            max_discount_amount: voucher.max_discount_amount ? String(voucher.max_discount_amount) : '',
            start_date: voucher.start_date ? String(voucher.start_date).slice(0, 16) : '',
            end_date: voucher.end_date ? String(voucher.end_date).slice(0, 16) : '',
            usage_limit: voucher.usage_limit ? String(voucher.usage_limit) : '',
            is_active: Boolean(voucher.is_active),
            customer_required: Boolean(voucher.customer_required),
            per_customer_limit: voucher.per_customer_limit ? String(voucher.per_customer_limit) : '',
            first_order_only: Boolean(voucher.first_order_only),
            applicable_order_types: voucher.applicable_order_types ?? [],
            branchAvailability: Object.fromEntries(
                branches.map((branch) => [String(branch.id), voucher.branchAvailability?.[String(branch.id)] !== false]),
            ),
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!canManageDeals) {
            toast.error('Access Denied', 'Your current role cannot create or update vouchers.');
            return;
        }
        if (!form.code.trim() || !form.discount_value.trim()) {
            toast.error('Validation', 'Voucher code and discount value are required.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                code: form.code.trim().toUpperCase(),
                name: form.name || undefined,
                description: form.description || undefined,
                discount_type: form.discount_type,
                discount_value: Number(form.discount_value),
                min_order_value: Number(form.min_order_value || 0),
                max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : undefined,
                start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
                end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
                usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
                is_active: form.is_active,
                customer_required: form.customer_required,
                per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : undefined,
                first_order_only: form.first_order_only,
                applicable_order_types: form.applicable_order_types.length ? form.applicable_order_types : undefined,
                branchAvailability: form.branchAvailability,
            };

            if (editingVoucherId) {
                await dealsApi.updateVoucher(editingVoucherId, payload);
                toast.success('Voucher Updated', `${payload.code} rules were updated.`);
            } else {
                await dealsApi.createVoucher(payload);
                toast.success('Voucher Created', `${payload.code} is now available.`);
            }

            setIsModalOpen(false);
            await loadData();
        } catch (error: any) {
            toast.error('Save Failed', error?.message || 'Could not save voucher configuration.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePreview = async () => {
        if (!preview.code.trim() || !preview.order_total.trim()) {
            toast.error('Validation', 'Enter a voucher code and order total for preview.');
            return;
        }

        try {
            const result = await dealsApi.validateVoucher({
                code: preview.code.trim().toUpperCase(),
                branch_id: preview.branch_id ? Number(preview.branch_id) : undefined,
                customer_id: preview.customer_id ? Number(preview.customer_id) : undefined,
                order_total: Number(preview.order_total),
                order_type: preview.order_type,
            });
            setPreviewResult(result);
            toast.success('Preview Ready', `Voucher ${result.code} is eligible for this test case.`);
        } catch (error: any) {
            setPreviewResult(null);
            toast.error('Preview Failed', error?.message || 'Voucher rules rejected this preview.');
        }
    };

    if (!canViewDeals && !canManageDeals) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>Your current role does not have access to promotions and vouchers.</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    <div className={styles.iconBox}><Ticket size={28} /></div>
                    <div>
                        <h1>Promotions & Loyalty Rules</h1>
                        <p>Manage controlled voucher logic with audit-friendly redemption behavior.</p>
                    </div>
                </div>
                {canManageDeals && (
                    <KitchenButton variant="primary" onClick={openCreate}>
                        <Plus size={16} />
                        Create Voucher
                    </KitchenButton>
                )}
            </header>

            <section className={styles.statsGrid}>
                <KitchenCard className={styles.statCard}>
                    <span>Active Vouchers</span>
                    <strong>{stats.active}</strong>
                </KitchenCard>
                <KitchenCard className={styles.statCard}>
                    <span>Total Redemptions</span>
                    <strong>{stats.redemptions}</strong>
                </KitchenCard>
                <KitchenCard className={styles.statCard}>
                    <span>Customer-Gated</span>
                    <strong>{stats.customerBound}</strong>
                </KitchenCard>
            </section>

            <section className={styles.workspace}>
                <KitchenCard className={styles.mainCard}>
                    <div className={styles.toolbar}>
                        <KitchenInput
                            placeholder="Search by code, name, or description..."
                            icon={<Search size={16} />}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            containerClassName={styles.searchInput}
                        />
                        <KitchenSelect
                            options={[
                                { value: 'all', label: 'All statuses' },
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'expired', label: 'Expired' },
                            ]}
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        />
                    </div>

                    <div className={styles.voucherGrid}>
                        {isLoading ? (
                            <div className={styles.emptyState}>Loading live voucher registry...</div>
                        ) : filteredVouchers.length === 0 ? (
                            <div className={styles.emptyState}>No vouchers match the current filters.</div>
                        ) : filteredVouchers.map((voucher) => {
                            const status = !voucher.is_active ? 'Inactive' : (voucher.end_date && new Date(voucher.end_date) < new Date() ? 'Expired' : 'Active');
                            return (
                                <button
                                    key={voucher.id}
                                    className={styles.voucherCard}
                                    onClick={() => openEdit(voucher)}
                                    disabled={!canManageDeals}
                                >
                                    <div className={styles.voucherHeader}>
                                        <div>
                                            <strong>{voucher.code}</strong>
                                            <p>{voucher.name || 'Untitled promotion'}</p>
                                        </div>
                                        <span className={`${styles.statusBadge} ${status === 'Active' ? styles.active : status === 'Expired' ? styles.expired : styles.inactive}`}>
                                            {status}
                                        </span>
                                    </div>
                                    <div className={styles.ruleLine}>
                                        <Percent size={14} />
                                        <span>
                                            {voucher.discount_type === 'percentage' ? `${voucher.discount_value}% off` : `PKR ${voucher.discount_value} off`}
                                            {voucher.max_discount_amount ? ` up to PKR ${voucher.max_discount_amount}` : ''}
                                        </span>
                                    </div>
                                    <div className={styles.ruleLine}>
                                        <ShieldCheck size={14} />
                                        <span>
                                            Min order PKR {voucher.min_order_value}
                                            {voucher.customer_required ? ' | customer required' : ''}
                                            {voucher.first_order_only ? ' | first order only' : ''}
                                        </span>
                                    </div>
                                    <div className={styles.ruleFooter}>
                                        <span><Users size={14} /> {voucher.per_customer_limit ? `${voucher.per_customer_limit}/customer` : 'No per-customer cap'}</span>
                                        <span><CheckCircle2 size={14} /> {voucher.usage_count}/{voucher.usage_limit ?? '∞'}</span>
                                        <span><Calendar size={14} /> {voucher.end_date ? new Date(voucher.end_date).toLocaleDateString() : 'No expiry'}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </KitchenCard>

                <div className={styles.sideColumn}>
                    <KitchenCard className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <Gift size={18} />
                            <div>
                                <h3>Redemption Preview</h3>
                                <p>Simulate the backend eligibility rules before checkout.</p>
                            </div>
                        </div>
                        <div className={styles.previewForm}>
                            <KitchenInput label="Voucher Code" value={preview.code} onChange={(event) => setPreview((current) => ({ ...current, code: event.target.value }))} />
                            <KitchenInput label="Order Total" type="number" value={preview.order_total} onChange={(event) => setPreview((current) => ({ ...current, order_total: event.target.value }))} />
                            <KitchenSelect
                                label="Branch"
                                options={[
                                    { value: '', label: 'Use active branch' },
                                    ...branches.map((branch) => ({ value: String(branch.id), label: branch.branch_name })),
                                ]}
                                value={preview.branch_id}
                                onChange={(event) => setPreview((current) => ({ ...current, branch_id: event.target.value }))}
                            />
                            <KitchenInput label="Customer ID" type="number" value={preview.customer_id} onChange={(event) => setPreview((current) => ({ ...current, customer_id: event.target.value }))} />
                            <KitchenSelect
                                label="Order Type"
                                options={[
                                    { value: 'dine_in', label: 'Dine In' },
                                    { value: 'takeout', label: 'Takeout' },
                                    { value: 'delivery', label: 'Delivery' },
                                ]}
                                value={preview.order_type}
                                onChange={(event) => setPreview((current) => ({ ...current, order_type: event.target.value }))}
                            />
                            <KitchenButton variant="primary" onClick={handlePreview}>Run Preview</KitchenButton>
                        </div>
                        {previewResult && (
                            <div className={styles.previewResult}>
                                <strong>{previewResult.code}</strong>
                                <span>{previewResult.name || 'Voucher eligible'}</span>
                                <p>Discount: PKR {Number(previewResult.discount_amount ?? 0).toFixed(2)}</p>
                                <p>Remaining uses: {previewResult.usage_remaining ?? 'Unlimited'}</p>
                            </div>
                        )}
                    </KitchenCard>

                    <KitchenCard className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <ShieldCheck size={18} />
                            <div>
                                <h3>Recent Redemptions</h3>
                                <p>Latest audited voucher applications recorded by the backend.</p>
                            </div>
                        </div>
                        <div className={styles.redemptionList}>
                            {recentRedemptions.length === 0 ? (
                                <div className={styles.emptyState}>No voucher redemptions recorded yet.</div>
                            ) : recentRedemptions.map((row) => (
                                <div key={row.id} className={styles.redemptionRow}>
                                    <div>
                                        <strong>{row.voucher_code}</strong>
                                        <p>{row.customer_name || 'Walk-in customer'} | Order #{row.order_id}</p>
                                    </div>
                                    <div className={styles.redemptionAmount}>
                                        <strong>PKR {Number(row.discount_amount ?? 0).toFixed(2)}</strong>
                                        <span>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </KitchenCard>
                </div>
            </section>

            {isModalOpen && canManageDeals && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>{editingVoucherId ? 'Edit Voucher' : 'Create Voucher'}</h2>
                                <p>Keep the rule set practical, controlled, and audit-safe.</p>
                            </div>
                            <KitchenButton variant="ghost" onClick={() => setIsModalOpen(false)}>Close</KitchenButton>
                        </div>

                        <div className={styles.formGrid}>
                            <KitchenInput label="Code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
                            <KitchenInput label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                            <KitchenSelect
                                label="Discount Type"
                                options={[
                                    { value: 'percentage', label: 'Percentage' },
                                    { value: 'fixed_amount', label: 'Fixed Amount' },
                                ]}
                                value={form.discount_type}
                                onChange={(event) => setForm((current) => ({ ...current, discount_type: event.target.value as 'percentage' | 'fixed_amount' }))}
                            />
                            <KitchenInput label="Discount Value" type="number" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} />
                            <KitchenInput label="Minimum Order Value" type="number" value={form.min_order_value} onChange={(event) => setForm((current) => ({ ...current, min_order_value: event.target.value }))} />
                            <KitchenInput label="Max Discount Amount" type="number" value={form.max_discount_amount} onChange={(event) => setForm((current) => ({ ...current, max_discount_amount: event.target.value }))} />
                            <KitchenInput label="Starts At" type="datetime-local" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                            <KitchenInput label="Ends At" type="datetime-local" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
                            <KitchenInput label="Usage Limit" type="number" value={form.usage_limit} onChange={(event) => setForm((current) => ({ ...current, usage_limit: event.target.value }))} />
                            <KitchenInput label="Per-Customer Limit" type="number" value={form.per_customer_limit} onChange={(event) => setForm((current) => ({ ...current, per_customer_limit: event.target.value }))} />
                        </div>

                        <label className={styles.textAreaLabel}>
                            Description
                            <textarea
                                className={styles.textArea}
                                rows={4}
                                value={form.description}
                                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            />
                        </label>

                        <div className={styles.toggleGrid}>
                            <label className={styles.checkboxRow}>
                                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
                                <span>Voucher is active</span>
                            </label>
                            <label className={styles.checkboxRow}>
                                <input type="checkbox" checked={form.customer_required} onChange={(event) => setForm((current) => ({ ...current, customer_required: event.target.checked }))} />
                                <span>Customer required</span>
                            </label>
                            <label className={styles.checkboxRow}>
                                <input type="checkbox" checked={form.first_order_only} onChange={(event) => setForm((current) => ({ ...current, first_order_only: event.target.checked }))} />
                                <span>First order only</span>
                            </label>
                        </div>

                        <div className={styles.ruleSection}>
                            <h3>Order Type Eligibility</h3>
                            <div className={styles.pillGrid}>
                                {['dine_in', 'takeout', 'delivery'].map((type) => {
                                    const enabled = form.applicable_order_types.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            className={`${styles.pill} ${enabled ? styles.pillActive : ''}`}
                                            onClick={() => setForm((current) => ({
                                                ...current,
                                                applicable_order_types: enabled
                                                    ? current.applicable_order_types.filter((value) => value !== type)
                                                    : [...current.applicable_order_types, type],
                                            }))}
                                        >
                                            {type.replace('_', ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.ruleSection}>
                            <h3>Branch Availability</h3>
                            <div className={styles.branchGrid}>
                                {branches.map((branch) => {
                                    const enabled = form.branchAvailability[String(branch.id)] !== false;
                                    return (
                                        <button
                                            key={branch.id}
                                            type="button"
                                            className={`${styles.branchButton} ${enabled ? styles.branchButtonActive : ''}`}
                                            onClick={() => setForm((current) => ({
                                                ...current,
                                                branchAvailability: {
                                                    ...current.branchAvailability,
                                                    [String(branch.id)]: !enabled,
                                                },
                                            }))}
                                        >
                                            {branch.branch_name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <KitchenButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" onClick={handleSave} isLoading={isSaving}>Save Voucher</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
