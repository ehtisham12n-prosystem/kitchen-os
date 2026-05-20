/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Mail, MapPin, Phone, Plus, Search, ShoppingBag, UserRound, Wallet } from 'lucide-react';
import { customerApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/locationOptions';
import { formatConfiguredOrderNumber } from '../pos/printTemplates/printHelpers';
import styles from './CustomerList.module.css';

type CustomerRecord = {
    id: number;
    name: string;
    customer_code?: string | null;
    phone_number?: string | null;
    email?: string | null;
    wallet_balance: number;
    loyalty_points: number;
    last_visit_at?: string | null;
    total_orders: number;
    total_spent: number;
    status: string;
    city?: string | null;
    country?: string | null;
    designation?: string | null;
    organization?: string | null;
    allow_credit?: boolean;
    credit_limit?: number;
    credit_control_mode?: 'warn' | 'block';
    collection_follow_up_date?: string | null;
    collection_follow_up_note?: string | null;
};

type BranchOption = { id: number; branch_name: string };

type CustomerFormState = {
    name: string;
    customer_code: string;
    phone_number: string;
    email: string;
    status: string;
    gender: string;
    preferred_branch_id: string;
    designation: string;
    organization: string;
    city: string;
    country: string;
    address_line_1: string;
    address_line_2: string;
    notes: string;
    allow_credit: boolean;
    credit_limit: string;
    credit_control_mode: 'warn' | 'block';
    collection_follow_up_date: string;
    collection_follow_up_note: string;
    marketing_opt_in: boolean;
};

const emptyForm: CustomerFormState = {
    name: '',
    customer_code: '',
    phone_number: '',
    email: '',
    status: 'active',
    gender: '',
    preferred_branch_id: '',
    designation: '',
    organization: '',
    city: '',
    country: 'Pakistan',
    address_line_1: '',
    address_line_2: '',
    notes: '',
    allow_credit: false,
    credit_limit: '0',
    credit_control_mode: 'block',
    collection_follow_up_date: '',
    collection_follow_up_note: '',
    marketing_opt_in: false,
};

export function CustomerList() {
    const {
        allowedBranches,
        canViewCustomers,
        canManageCustomers,
    } = usePermissionAccess();
    const [customers, setCustomers] = useState<CustomerRecord[]>([]);
    const [summary, setSummary] = useState<any | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
    const [loyaltyLedger, setLoyaltyLedger] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
    const [loyaltyAdjustment, setLoyaltyAdjustment] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');
    const [form, setForm] = useState<CustomerFormState>(emptyForm);

    const branches = useMemo<BranchOption[]>(
        () => (allowedBranches ?? []).map((branch) => ({
            id: Number(branch.branch_id),
            branch_name: branch.branch_name || `Branch ${branch.branch_id}`,
        })),
        [allowedBranches],
    );

    const loadCustomers = useCallback(async (filters?: { search?: string; status?: string }) => {
        setIsLoading(true);
        try {
            const [customerRows, summaryRow] = await Promise.all([
                customerApi.getCustomers(filters),
                customerApi.getSummary(),
            ]);

            const normalizedRows = (customerRows ?? []).map((row) => ({
                ...row,
                wallet_balance: Number(row.wallet_balance ?? 0),
                total_spent: Number(row.total_spent ?? 0),
                total_orders: Number(row.total_orders ?? 0),
                loyalty_points: Number(row.loyalty_points ?? 0),
            }));

            setCustomers(normalizedRows);
            setSummary(summaryRow);

            const nextSelectedId = selectedCustomerId ?? normalizedRows[0]?.id ?? null;
            if (nextSelectedId) {
                setSelectedCustomerId(nextSelectedId);
            } else {
                setSelectedCustomer(null);
                setPurchaseHistory([]);
                setLoyaltyLedger([]);
            }
        } catch (error: any) {
            toast.error('CRM Load Failed', error?.message || 'Could not load customer CRM.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCustomerId]);

    const loadCustomerDetail = async (customerId: number) => {
        try {
            const [detail, history, ledger] = await Promise.all([
                customerApi.getCustomer(customerId),
                customerApi.getPurchaseHistory(customerId, 12),
                customerApi.getLoyaltyLedger(customerId, 12),
            ]);
            setSelectedCustomer(detail);
            setPurchaseHistory(history ?? []);
            setLoyaltyLedger(ledger ?? []);
        } catch (error: any) {
            toast.error('CRM Detail Failed', error?.message || 'Could not load customer detail.');
        }
    };

    useEffect(() => {
        if (!canViewCustomers && !canManageCustomers) {
            setIsLoading(false);
            return;
        }
        void loadCustomers();
    }, [canManageCustomers, canViewCustomers, loadCustomers]);

    useEffect(() => {
        if (selectedCustomerId) {
            void loadCustomerDetail(selectedCustomerId);
        }
    }, [selectedCustomerId]);

    const filteredCustomers = useMemo(() => customers.filter((customer) => {
        const needle = searchTerm.trim().toLowerCase();
        const matchSearch = !needle || [
            customer.name,
            customer.phone_number,
            customer.email,
            customer.customer_code,
            customer.designation,
            customer.organization,
            customer.city,
            customer.country,
        ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        const matchStatus = statusFilter === 'all' || customer.status === statusFilter;
        return matchSearch && matchStatus;
    }), [customers, searchTerm, statusFilter]);

    const walletExposure = useMemo(
        () => customers.reduce((sum, customer) => sum + Number(customer.wallet_balance || 0), 0),
        [customers],
    );

    const openCreateDrawer = () => {
        if (!canManageCustomers) {
            toast.error('Access Denied', 'Your current role cannot create customer profiles.');
            return;
        }
        setEditingCustomerId(null);
        setForm(emptyForm);
        setIsDrawerOpen(true);
    };

    const openEditDrawer = () => {
        if (!canManageCustomers) {
            toast.error('Access Denied', 'Your current role cannot update customer profiles.');
            return;
        }
        if (!selectedCustomer) {
            return;
        }

        setEditingCustomerId(selectedCustomer.id);
        setForm({
            name: selectedCustomer.name ?? '',
            customer_code: selectedCustomer.customer_code ?? '',
            phone_number: selectedCustomer.phone_number ?? '',
            email: selectedCustomer.email ?? '',
            status: selectedCustomer.status ?? 'active',
            gender: selectedCustomer.gender ?? '',
            preferred_branch_id: selectedCustomer.preferred_branch_id ? String(selectedCustomer.preferred_branch_id) : '',
            designation: selectedCustomer.designation ?? '',
            organization: selectedCustomer.organization ?? '',
            city: selectedCustomer.city ?? '',
            country: selectedCustomer.country ?? 'Pakistan',
            address_line_1: selectedCustomer.address_line_1 ?? '',
            address_line_2: selectedCustomer.address_line_2 ?? '',
            notes: selectedCustomer.notes ?? '',
            allow_credit: Boolean(selectedCustomer.allow_credit),
            credit_limit: String(Number(selectedCustomer.credit_limit ?? 0)),
            credit_control_mode: selectedCustomer.credit_control_mode === 'warn' ? 'warn' : 'block',
            collection_follow_up_date: selectedCustomer.collection_follow_up_date ?? '',
            collection_follow_up_note: selectedCustomer.collection_follow_up_note ?? '',
            marketing_opt_in: Boolean(selectedCustomer.marketing_opt_in),
        });
        setIsDrawerOpen(true);
    };

    const handleSave = async () => {
        if (!canManageCustomers) {
            toast.error('Access Denied', 'Your current role cannot create or update customer profiles.');
            return;
        }
        if (!form.name.trim()) {
            toast.error('Validation', 'Customer name is required.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...form,
                customer_code: form.customer_code || undefined,
                phone_number: form.phone_number || undefined,
                email: form.email || undefined,
                gender: form.gender || undefined,
                preferred_branch_id: form.preferred_branch_id ? Number(form.preferred_branch_id) : undefined,
                designation: form.designation || undefined,
                organization: form.organization || undefined,
                city: form.city || undefined,
                country: form.country || undefined,
                address_line_1: form.address_line_1 || undefined,
                address_line_2: form.address_line_2 || undefined,
                notes: form.notes || undefined,
                allow_credit: form.allow_credit,
                credit_limit: form.allow_credit ? Number(form.credit_limit || 0) : 0,
                credit_control_mode: form.allow_credit ? form.credit_control_mode : 'block',
                collection_follow_up_date: form.collection_follow_up_date || undefined,
                collection_follow_up_note: form.collection_follow_up_note || undefined,
            };

            if (editingCustomerId) {
                await customerApi.updateCustomer(editingCustomerId, payload);
                toast.success('Customer Updated', `${form.name} profile has been updated.`);
            } else {
                await customerApi.createCustomer(payload);
                toast.success('Customer Added', `${form.name} is now part of the CRM.`);
            }

            setIsDrawerOpen(false);
            await loadCustomers({
                search: searchTerm || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
        } catch (error: any) {
            toast.error('Save Failed', error?.message || 'Could not save customer profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdjustLoyalty = async () => {
        if (!canManageCustomers) {
            toast.error('Access Denied', 'Your current role cannot adjust loyalty balances.');
            return;
        }
        if (!selectedCustomerId) {
            return;
        }

        const pointsDelta = Number(loyaltyAdjustment);
        if (!Number.isFinite(pointsDelta) || pointsDelta === 0) {
            toast.error('Validation', 'Enter a non-zero loyalty adjustment.');
            return;
        }

        try {
            await customerApi.adjustLoyalty(selectedCustomerId, {
                points_delta: pointsDelta,
                remarks: adjustmentReason || undefined,
            });
            toast.success('Loyalty Updated', 'Customer loyalty balance has been adjusted.');
            setLoyaltyAdjustment('');
            setAdjustmentReason('');
            await loadCustomerDetail(selectedCustomerId);
            await loadCustomers({
                search: searchTerm || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
        } catch (error: any) {
            toast.error('Adjustment Failed', error?.message || 'Could not adjust loyalty points.');
        }
    };

    if (!canViewCustomers && !canManageCustomers) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>Your current role does not have access to customer CRM.</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    <div className={styles.iconBox}><UserRound size={28} /></div>
                    <div>
                        <h1>Customer CRM</h1>
                        <p>Track repeat guests, purchase history, wallet exposure, and loyalty behavior.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="outline" onClick={openEditDrawer} disabled={!selectedCustomer || !canManageCustomers}>
                        Edit Profile
                    </KitchenButton>
                    {canManageCustomers && (
                        <KitchenButton variant="primary" onClick={openCreateDrawer}>
                            <Plus size={16} />
                            Add Customer
                        </KitchenButton>
                    )}
                </div>
            </header>

            <section className={styles.metricsGrid}>
                <KitchenCard className={styles.metricCard}>
                    <span className={styles.metricLabel}>Customers</span>
                    <strong>{summary?.customer_count ?? 0}</strong>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <span className={styles.metricLabel}>Active Profiles</span>
                    <strong>{summary?.active_count ?? 0}</strong>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <span className={styles.metricLabel}>Loyalty Balance</span>
                    <strong>{Number(summary?.loyalty_points ?? 0).toLocaleString()} pts</strong>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <span className={styles.metricLabel}>CRM Revenue</span>
                    <strong>PKR {Number(summary?.total_spent ?? 0).toLocaleString()}</strong>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <span className={styles.metricLabel}>Wallet Exposure</span>
                    <strong>PKR {walletExposure.toLocaleString()}</strong>
                </KitchenCard>
            </section>

            <section className={styles.workspace}>
                <KitchenCard className={styles.listCard}>
                    <div className={styles.toolbar}>
                        <KitchenInput
                            placeholder="Search by name, phone, email, or code..."
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
                                { value: 'suspended', label: 'Suspended' },
                            ]}
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            containerClassName={styles.statusFilter}
                        />
                    </div>
                    <div className={styles.toolbarMeta}>
                        <span>{filteredCustomers.length} customers in current view</span>
                        <span>{selectedCustomer ? `Selected: ${selectedCustomer.name}` : 'Select a customer to review profile details'}</span>
                    </div>

                    <div className={styles.customerList}>
                        {isLoading ? (
                            <div className={styles.emptyState}>Loading customer CRM...</div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className={styles.emptyState}>No customers match the current filters.</div>
                        ) : filteredCustomers.map((customer) => (
                            <button
                                key={customer.id}
                                className={`${styles.customerRow} ${selectedCustomerId === customer.id ? styles.customerRowActive : ''}`}
                                onClick={() => setSelectedCustomerId(customer.id)}
                            >
                                <div className={styles.customerMain}>
                                    <div className={styles.avatar}>{customer.name.charAt(0)}</div>
                                    <div>
                                        <div className={styles.customerName}>{customer.name}</div>
                                        <div className={styles.customerMeta}>
                                            <span>{customer.customer_code || 'Pending code'}</span>
                                            <span>{customer.city || 'City not set'}</span>
                                            <span>{customer.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.customerStats}>
                                    <span>{customer.total_orders} orders</span>
                                    <strong>PKR {customer.total_spent.toLocaleString()}</strong>
                                </div>
                            </button>
                        ))}
                    </div>
                </KitchenCard>

                <div className={styles.detailColumn}>
                    <KitchenCard className={styles.detailCard}>
                        {!selectedCustomer ? (
                            <div className={styles.emptyState}>Select a customer to view their CRM profile.</div>
                        ) : (
                            <>
                                <div className={styles.detailHeader}>
                                    <div>
                                        <h2>{selectedCustomer.name}</h2>
                                        <p>{selectedCustomer.customer_code || 'Auto-generated after save'}</p>
                                    </div>
                                    <div className={styles.detailBadges}>
                                        <span className={styles.badge}><Award size={14} /> {Number(selectedCustomer.loyalty_points ?? 0)} pts</span>
                                        <span className={styles.badge}><ShoppingBag size={14} /> {Number(selectedCustomer.total_orders ?? 0)} orders</span>
                                    </div>
                                </div>

                                <div className={styles.profileGrid}>
                                    <div className={styles.profileField}><Phone size={14} /> {selectedCustomer.phone_number || 'Phone not set'}</div>
                                    <div className={styles.profileField}><Mail size={14} /> {selectedCustomer.email || 'Email not set'}</div>
                                    <div className={styles.profileField}><MapPin size={14} /> {[selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ') || 'Location not set'}</div>
                                    <div className={styles.profileField}><Wallet size={14} /> PKR {Number(selectedCustomer.wallet_balance ?? 0).toFixed(2)}</div>
                                    <div className={styles.profileField}><UserRound size={14} /> {selectedCustomer.designation || 'Designation not set'}</div>
                                    <div className={styles.profileField}><ShoppingBag size={14} /> {selectedCustomer.organization || 'Organization not set'}</div>
                                    <div className={styles.profileField}><Wallet size={14} /> {selectedCustomer.allow_credit ? `Credit enabled | PKR ${Number(selectedCustomer.credit_limit ?? 0).toLocaleString()} | ${selectedCustomer.credit_control_mode === 'warn' ? 'Warn' : 'Block'} on limit` : 'Credit not allowed'}</div>
                                    <div className={styles.profileField}><Phone size={14} /> {selectedCustomer.collection_follow_up_date ? `Collection follow-up ${selectedCustomer.collection_follow_up_date}` : 'No collection follow-up set'}</div>
                                </div>

                                <div className={styles.summaryStrip}>
                                    <div>
                                        <span>Total Spend</span>
                                        <strong>PKR {Number(selectedCustomer.total_spent ?? 0).toLocaleString()}</strong>
                                    </div>
                                    <div>
                                        <span>Average Ticket</span>
                                        <strong>PKR {Number(selectedCustomer.average_order_value ?? 0).toLocaleString()}</strong>
                                    </div>
                                    <div>
                                        <span>Last Visit</span>
                                        <strong>{selectedCustomer.last_visit_at ? new Date(selectedCustomer.last_visit_at).toLocaleString() : 'No visit yet'}</strong>
                                    </div>
                                </div>

                                {canManageCustomers && (
                                    <div className={styles.section}>
                                        <div className={styles.sectionHeader}>
                                            <h3>Loyalty Adjustment</h3>
                                            <span>Foundation controls for staff-approved point corrections.</span>
                                        </div>
                                        <div className={styles.adjustmentGrid}>
                                            <KitchenInput
                                                type="number"
                                                placeholder="Points delta, e.g. 50 or -20"
                                                value={loyaltyAdjustment}
                                                onChange={(event) => setLoyaltyAdjustment(event.target.value)}
                                            />
                                            <KitchenInput
                                                placeholder="Reason for adjustment"
                                                value={adjustmentReason}
                                                onChange={(event) => setAdjustmentReason(event.target.value)}
                                            />
                                            <KitchenButton variant="primary" onClick={handleAdjustLoyalty}>
                                                Apply
                                            </KitchenButton>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </KitchenCard>

                    <KitchenCard className={styles.historyCard}>
                        <div className={styles.sectionHeader}>
                            <h3>Purchase History</h3>
                            <span>Completed POS orders linked to this customer.</span>
                        </div>
                        <div className={styles.timeline}>
                            {purchaseHistory.length === 0 ? (
                                <div className={styles.emptyState}>No completed purchases linked yet.</div>
                            ) : purchaseHistory.map((order) => (
                                <div key={order.id} className={styles.timelineRow}>
                                    <div>
                                        <strong>{formatConfiguredOrderNumber(order.order_number || `Order #${order.id}`, order, { preserveTypePrefix: true }) || order.order_number || `Order #${order.id}`}</strong>
                                        <p>{order.finalized_at ? new Date(order.finalized_at).toLocaleString() : 'Pending date'}</p>
                                        <p>{(order.items || []).map((item: any) => `${item.product_name} x${item.quantity}`).join(', ')}</p>
                                    </div>
                                    <div className={styles.timelineAmount}>
                                        <strong>PKR {Number(order.total_amount ?? 0).toLocaleString()}</strong>
                                        {order.voucher_code && <span>{order.voucher_code}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </KitchenCard>

                    <KitchenCard className={styles.historyCard}>
                        <div className={styles.sectionHeader}>
                            <h3>Loyalty Ledger</h3>
                            <span>Auditable point earning and manual adjustment history.</span>
                        </div>
                        <div className={styles.timeline}>
                            {loyaltyLedger.length === 0 ? (
                                <div className={styles.emptyState}>No loyalty movements recorded yet.</div>
                            ) : loyaltyLedger.map((row) => (
                                <div key={row.id} className={styles.timelineRow}>
                                    <div>
                                        <strong>{String(row.event_type).toUpperCase()}</strong>
                                        <p>{row.remarks || 'No remarks'}</p>
                                    </div>
                                    <div className={styles.timelineAmount}>
                                        <strong>{Number(row.points_delta) > 0 ? '+' : ''}{Number(row.points_delta)} pts</strong>
                                        <span>Balance {Number(row.balance_after)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </KitchenCard>
                </div>
            </section>

            {isDrawerOpen && canManageCustomers && (
                <div className={styles.drawerOverlay} onClick={() => setIsDrawerOpen(false)}>
                    <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.drawerHeader}>
                            <div>
                                <h2>{editingCustomerId ? 'Edit Customer' : 'Create Customer'}</h2>
                                <p>Capture profile details needed for purchase history and loyalty controls.</p>
                            </div>
                            <KitchenButton variant="ghost" onClick={() => setIsDrawerOpen(false)}>Close</KitchenButton>
                        </div>

                        <div className={styles.formGrid}>
                            <KitchenInput label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                            <KitchenInput label="Customer ID" value={editingCustomerId ? (form.customer_code || selectedCustomer?.customer_code || 'Auto-generated') : 'Auto-generated on save'} disabled readOnly />
                            <KitchenInput label="Phone" value={form.phone_number} onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))} />
                            <KitchenInput label="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                            <KitchenSelect
                                label="Status"
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                    { value: 'suspended', label: 'Suspended' },
                                ]}
                                value={form.status}
                                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                            />
                            <KitchenSelect
                                label="Preferred Branch"
                                options={[
                                    { value: '', label: 'No preference' },
                                    ...branches.map((branch) => ({ value: String(branch.id), label: branch.branch_name })),
                                ]}
                                value={form.preferred_branch_id}
                                onChange={(event) => setForm((current) => ({ ...current, preferred_branch_id: event.target.value }))}
                            />
                            <KitchenInput label="Designation" value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
                            <KitchenInput label="Organization" value={form.organization} onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))} />
                            <KitchenSelect
                                label="Gender"
                                options={[
                                    { value: '', label: 'Not specified' },
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                    { value: 'other', label: 'Other' },
                                    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                                ]}
                                value={form.gender}
                                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                            />
                            <KitchenSelect label="City" options={CITY_OPTIONS as { value: string; label: string }[]} value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
                            <KitchenSelect label="Country" options={COUNTRY_OPTIONS as { value: string; label: string }[]} value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} />
                            <KitchenInput label="Address Line 1" value={form.address_line_1} onChange={(event) => setForm((current) => ({ ...current, address_line_1: event.target.value }))} />
                            <KitchenInput label="Address Line 2" value={form.address_line_2} onChange={(event) => setForm((current) => ({ ...current, address_line_2: event.target.value }))} />
                            <label className={styles.checkboxRow}>
                                <input
                                    type="checkbox"
                                    checked={form.allow_credit}
                                    onChange={(event) => setForm((current) => ({ ...current, allow_credit: event.target.checked }))}
                                />
                                <span>Allow customer credit</span>
                            </label>
                            <KitchenInput
                                label="Credit Limit"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.credit_limit}
                                onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))}
                                disabled={!form.allow_credit}
                            />
                            <KitchenSelect
                                label="Credit Limit Action"
                                options={[
                                    { value: 'block', label: 'Block new credit over limit' },
                                    { value: 'warn', label: 'Warn only over limit' },
                                ]}
                                value={form.credit_control_mode}
                                onChange={(event) => setForm((current) => ({ ...current, credit_control_mode: event.target.value as 'warn' | 'block' }))}
                                disabled={!form.allow_credit}
                            />
                            <KitchenInput
                                label="Collection Follow-Up Date"
                                type="date"
                                value={form.collection_follow_up_date}
                                onChange={(event) => setForm((current) => ({ ...current, collection_follow_up_date: event.target.value }))}
                            />
                        </div>

                        <label className={styles.textAreaLabel}>
                            Notes
                            <textarea
                                value={form.notes}
                                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                className={styles.textArea}
                                rows={4}
                            />
                        </label>

                        <label className={styles.textAreaLabel}>
                            Collection Follow-Up Note
                            <textarea
                                value={form.collection_follow_up_note}
                                onChange={(event) => setForm((current) => ({ ...current, collection_follow_up_note: event.target.value }))}
                                className={styles.textArea}
                                rows={3}
                            />
                        </label>

                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={form.marketing_opt_in}
                                onChange={(event) => setForm((current) => ({ ...current, marketing_opt_in: event.target.checked }))}
                            />
                            <span>Customer consents to promotional outreach</span>
                        </label>

                        <div className={styles.drawerFooter}>
                            <KitchenButton variant="secondary" onClick={() => setIsDrawerOpen(false)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" onClick={handleSave} isLoading={isSaving}>Save Customer</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
