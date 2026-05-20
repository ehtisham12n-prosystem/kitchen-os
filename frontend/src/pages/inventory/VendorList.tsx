/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3,
    Building2,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    Edit3,
    Filter,
    LayoutGrid,
    List,
    Plus,
    Search,
    ToggleLeft,
    ToggleRight,
    TrendingUp,
    Truck,
    XCircle,
    AlertTriangle,
} from 'lucide-react';
import styles from './VendorList.module.css';
import { vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';

interface VendorRow {
    id: number;
    code: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    city: string;
    paymentTerms: string;
    isActive: boolean;
    usageSummary: {
        purchase_order_count: number;
        branch_count: number;
        last_order_at: string | null;
        branch_names: string[];
    };
}

function mapVendors(rows: any[]): VendorRow[] {
    return rows.map((vendor) => ({
        id: Number(vendor.id),
        code: `VND-${String(vendor.id).padStart(3, '0')}`,
        name: vendor.vendor_name || 'Unnamed Vendor',
        contactPerson: vendor.contact_person || '—',
        phone: vendor.phone || vendor.contact_phone || '—',
        email: vendor.email || vendor.contact_email || '—',
        city: (vendor.address || vendor.vendor_address || '').split(',')[0]?.trim() || '—',
        paymentTerms: vendor.payment_terms || 'Cash',
        isActive: vendor.is_active !== false,
        usageSummary: vendor.usage_summary || {
            purchase_order_count: 0,
            branch_count: 0,
            last_order_at: null,
            branch_names: [],
        },
    }));
}

function StatCard({ icon, label, value, sub, accent, alert }: {
    icon: ReactNode;
    label: string;
    value: string;
    sub?: string;
    accent?: string;
    alert?: boolean;
}) {
    return (
        <div className={`${styles.statCard} ${alert ? styles.statCardAlert : ''}`}>
            <div className={styles.statIcon} style={{ color: accent || 'var(--accent-primary)' }}>
                {icon}
            </div>
            <div className={styles.statBody}>
                <span className={styles.statValue} style={{ color: accent }}>{value}</span>
                <span className={styles.statLabel}>{label}</span>
                {sub && <span className={styles.statSub}>{sub}</span>}
            </div>
        </div>
    );
}

export function VendorList() {
    const navigate = useNavigate();
    const {
        canViewVendors,
        canManageVendors,
        canViewVendorPayments,
    } = usePermissionAccess();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState<VendorRow[]>([]);

    const loadVendors = useCallback(async () => {
        setLoading(true);
        try {
            const data = await vendorApi.getVendors();
            setVendors(mapVendors(data));
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load vendors.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!canViewVendors && !canManageVendors) {
            setLoading(false);
            return;
        }
        void loadVendors();
    }, [canManageVendors, canViewVendors, loadVendors]);

    const filtered = useMemo(() => vendors.filter((vendor) => {
        const term = search.trim().toLowerCase();
        const matchesSearch = !term
            || vendor.name.toLowerCase().includes(term)
            || vendor.code.toLowerCase().includes(term)
            || vendor.contactPerson.toLowerCase().includes(term)
            || vendor.city.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'active' && vendor.isActive)
            || (statusFilter === 'inactive' && !vendor.isActive);
        const matchesPayment = paymentFilter === 'all'
            || vendor.paymentTerms.toLowerCase().includes(paymentFilter.toLowerCase());
        return matchesSearch && matchesStatus && matchesPayment;
    }), [paymentFilter, search, statusFilter, vendors]);

    const toggleActive = async (vendor: VendorRow) => {
        if (!canManageVendors) {
            toast.error('Access Denied', 'Your current role cannot activate or deactivate vendors.');
            return;
        }

        try {
            await vendorApi.updateVendor(vendor.id, { is_active: !vendor.isActive });
            await loadVendors();
            toast.success('Updated', `Vendor ${vendor.isActive ? 'disabled' : 'enabled'} successfully.`);
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Could not update vendor.');
        }
    };

    if (!canViewVendors && !canManageVendors) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <Building2 size={40} />
                    <p>Your current role does not have access to vendor master.</p>
                </div>
            </div>
        );
    }

    const totalActive = vendors.filter((vendor) => vendor.isActive).length;
    const totalInactive = vendors.length - totalActive;
    const creditVendors = vendors.filter((vendor) => vendor.paymentTerms.toLowerCase().includes('credit')).length;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}>
                        <Truck size={24} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Vendor Management</h1>
                        <p className={styles.pageSubtitle}>Live supplier master for procurement and vendor payments</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/vendor-dashboard')}>
                        <BarChart3 size={16} />
                        Vendor Dashboard
                    </button>
                    {canViewVendorPayments && (
                        <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/vendor-payments')}>
                            <CreditCard size={16} />
                            Payments
                        </button>
                    )}
                    {canManageVendors && (
                        <button className={styles.btnPrimary} onClick={() => navigate('/console/inventory/vendors/new')}>
                            <Plus size={16} />
                            Add Vendor
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.statsRow}>
                <StatCard
                    icon={<Building2 size={20} />}
                    label="Total Vendors"
                    value={`${vendors.length}`}
                    sub={`${totalActive} active`}
                    accent="var(--accent-primary)"
                />
                <StatCard
                    icon={<TrendingUp size={20} />}
                    label="Credit Vendors"
                    value={`${creditVendors}`}
                    sub="Terms driven by master profile"
                    accent="var(--accent-tertiary)"
                />
                <StatCard
                    icon={<AlertTriangle size={20} />}
                    label="Inactive Vendors"
                    value={`${totalInactive}`}
                    sub="Still visible for audit and history"
                    accent="var(--accent-danger)"
                    alert={totalInactive > 0}
                />
                <StatCard
                    icon={<Truck size={20} />}
                    label="Used In Procurement"
                    value={`${vendors.filter((vendor) => vendor.usageSummary.purchase_order_count > 0).length}`}
                    sub="With live PO history"
                    accent="var(--accent-secondary)"
                />
            </div>

            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        className={styles.searchInput}
                        placeholder="Search vendors, contacts, cities..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <Filter size={15} className={styles.filterIcon} />
                    <div className={styles.selectWrapper}>
                        <select className={styles.filterSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <ChevronDown size={14} className={styles.selectChevron} />
                    </div>
                    <div className={styles.selectWrapper}>
                        <select className={styles.filterSelect} value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                            <option value="all">All Payment Terms</option>
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                        </select>
                        <ChevronDown size={14} className={styles.selectChevron} />
                    </div>
                </div>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Grid View"
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
                        onClick={() => setViewMode('table')}
                        title="Table View"
                    >
                        <List size={16} />
                    </button>
                </div>
                <span className={styles.resultCount}>{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            <div className={viewMode === 'grid' ? styles.vendorGrid : styles.vendorTableContainer}>
                {loading ? (
                    <div className={styles.emptyState}>
                        <Building2 size={40} />
                        <p>Loading vendors...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Building2 size={40} />
                        <p>No vendors found matching your filters.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    filtered.map((vendor) => (
                        <div key={vendor.id} className={`${styles.vendorCard} ${!vendor.isActive ? styles.vendorCardInactive : ''}`}>
                            <div className={styles.cardTop}>
                                <div className={styles.vendorAvatar}>
                                    <span>{vendor.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                                </div>
                                <div className={styles.vendorNameGroup}>
                                    <div className={styles.vendorCode}>{vendor.code}</div>
                                    <div className={styles.vendorName}>{vendor.name}</div>
                                </div>
                                <div className={styles.cardTopRight}>
                                    {vendor.isActive ? (
                                        <span className={`${styles.badge} ${styles.badgeActive}`}><CheckCircle2 size={11} /> Active</span>
                                    ) : (
                                        <span className={`${styles.badge} ${styles.badgeInactive}`}><XCircle size={11} /> Inactive</span>
                                    )}
                                </div>
                            </div>

                            <div className={styles.contactRow}>
                                <span>{vendor.contactPerson}</span>
                                <span>{vendor.phone}</span>
                                <span>{vendor.email}</span>
                            </div>

                            <div className={styles.financialRow}>
                                <div className={styles.financialItem}>
                                    <span className={styles.finLabel}>Payment</span>
                                    <span className={styles.finValue}>{vendor.paymentTerms}</span>
                                </div>
                                <div className={styles.financialItem}>
                                    <span className={styles.finLabel}>City</span>
                                    <span className={styles.finValue}>{vendor.city}</span>
                                </div>
                                <div className={styles.financialItem}>
                                    <span className={styles.finLabel}>Branch Usage</span>
                                    <span className={styles.finValue}>{vendor.usageSummary.branch_count} branches</span>
                                </div>
                            </div>

                            <div className={styles.usageSummary}>
                                <span>{vendor.usageSummary.purchase_order_count} POs</span>
                                <span>{vendor.usageSummary.branch_names.slice(0, 3).join(', ') || 'No branch usage yet'}</span>
                            </div>

                            <div className={styles.cardFooter}>
                                <button className={styles.viewBtn} onClick={() => navigate(`/console/inventory/vendors/${vendor.id}`)}>
                                    View
                                </button>
                                {canManageVendors && (
                                    <>
                                        <button className={styles.viewBtn} onClick={() => navigate(`/console/inventory/vendors/${vendor.id}/edit`)}>
                                            <Edit3 size={14} />
                                            Edit
                                        </button>
                                        <button className={styles.viewBtn} onClick={() => toggleActive(vendor)}>
                                            {vendor.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                            {vendor.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <table className={styles.vendorTable}>
                        <thead>
                            <tr>
                                <th>Vendor</th>
                                <th>Contact</th>
                                <th>Branch Usage</th>
                                <th>Payment Type</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((vendor) => (
                                <tr key={vendor.id} className={!vendor.isActive ? styles.rowInactive : ''}>
                                    <td>
                                        <div className={styles.tableVendorInfo}>
                                            <div className={styles.tableAvatar}>{vendor.name[0]}</div>
                                            <div>
                                                <div className={styles.tableName}>{vendor.name}</div>
                                                <div className={styles.tableCode}>{vendor.code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.tableContact}>
                                            <div className={styles.contactName}>{vendor.contactPerson}</div>
                                            <div className={styles.contactPhone}>{vendor.phone}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.tableBranch}>
                                            {vendor.usageSummary.branch_names.slice(0, 2).join(', ') || 'Unused'}
                                            <div className={styles.contactPhone}>{vendor.usageSummary.purchase_order_count} POs</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.tablePayTerm}>{vendor.paymentTerms}</div>
                                    </td>
                                    <td>
                                        {vendor.isActive ? (
                                            <span className={`${styles.badge} ${styles.badgeActive}`}><CheckCircle2 size={11} /> Active</span>
                                        ) : (
                                            <span className={`${styles.badge} ${styles.badgeInactive}`}><XCircle size={11} /> Inactive</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.tableActions}>
                                            <button
                                                className={styles.btnIconSmall}
                                                onClick={() => navigate(`/console/inventory/vendors/${vendor.id}`)}
                                                title="View"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            {canManageVendors && (
                                                <button
                                                    className={styles.btnIconSmall}
                                                    onClick={() => toggleActive(vendor)}
                                                    title="Toggle active status"
                                                >
                                                    {vendor.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
