import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    Building2,
    Clock3,
    Edit2,
    Eye,
    GitBranch,
    Plus,
    Search,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { platformApi } from '../../api/api';
import styles from './ClientManagement.module.css';

type ClientLifecycle =
    | 'draft'
    | 'onboarding'
    | 'active'
    | 'suspended'
    | 'inactive'
    | 'closed';

interface ClientContact {
    id: number;
    contact_type: 'business_primary' | 'billing_primary' | 'operations_primary';
    full_name: string;
    designation?: string | null;
    email?: string | null;
    phone?: string | null;
}

interface Client {
    id: string;
    client_code: string;
    client_name: string;
    legal_name?: string | null;
    short_name?: string | null;
    domain_slug: string;
    business_type?: string | null;
    status: ClientLifecycle;
    governance_state?: 'normal' | 'restricted' | 'suspended' | 'closure_pending' | 'closed';
    subscription_type?: 'monthly' | 'annual' | null;
    renewal_date?: string | null;
    subscription_plan?: {
        id: number;
        plan_name?: string | null;
        plan_code?: string | null;
    } | null;
    branch_count: number;
    user_count: number;
    contacts: ClientContact[];
    updated_at: string;
}

const STATUS_LABELS: Record<ClientLifecycle, string> = {
    draft: 'Draft',
    onboarding: 'Onboarding',
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    closed: 'Closed',
};

const STATUS_COLORS: Record<ClientLifecycle, string> = {
    draft: 'var(--text-tertiary)',
    onboarding: 'var(--warning)',
    active: 'var(--success)',
    suspended: 'var(--danger)',
    inactive: 'var(--text-muted)',
    closed: 'var(--danger)',
};

const GOVERNANCE_COLORS: Record<NonNullable<Client['governance_state']>, string> = {
    normal: 'var(--success)',
    restricted: 'var(--warning)',
    suspended: 'var(--danger)',
    closure_pending: 'var(--warning)',
    closed: 'var(--danger)',
};

const PAGE_SIZE = 10;

function getContact(client: Client, contactType: ClientContact['contact_type']) {
    return client.contacts.find((contact) => contact.contact_type === contactType);
}

function formatBillingCycle(value?: Client['subscription_type']) {
    if (!value) {
        return 'No billing cycle';
    }

    return value === 'annual' ? 'Annual billing' : 'Monthly billing';
}

function formatRenewalDate(value?: string | null) {
    if (!value) {
        return 'Renewal not set';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function ClientManagement() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [governanceFilter, setGovernanceFilter] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await platformApi.getClients();
                setClients(data);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const filtered = useMemo(() => clients.filter((client) => {
        const searchValue = search.trim().toLowerCase();
        const matchSearch = !searchValue
            || client.client_name.toLowerCase().includes(searchValue)
            || (client.legal_name || '').toLowerCase().includes(searchValue)
            || client.client_code.toLowerCase().includes(searchValue)
            || client.domain_slug.toLowerCase().includes(searchValue);
        const matchStatus = !statusFilter || client.status === statusFilter;
        const matchGovernance = !governanceFilter || (client.governance_state || 'normal') === governanceFilter;
        return matchSearch && matchStatus && matchGovernance;
    }), [clients, governanceFilter, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const stats = useMemo(() => ({
        total: clients.length,
        draft: clients.filter((client) => client.status === 'draft').length,
        onboarding: clients.filter((client) => client.status === 'onboarding').length,
        active: clients.filter((client) => client.status === 'active').length,
        suspended: clients.filter((client) => client.status === 'suspended').length,
        closed: clients.filter((client) => client.status === 'inactive' || client.status === 'closed').length,
        governanceAttention: clients.filter((client) => (client.governance_state || 'normal') !== 'normal').length,
    }), [clients]);

    const columns: ColumnDef<Client>[] = [
        {
            key: 'client',
            header: 'Client',
            cell: (client) => (
                <div className={styles.clientCell}>
                    <div className={styles.clientAvatar}>{client.client_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <div className={styles.clientName}>{client.client_name}</div>
                        <div className={styles.clientSlug}>{client.domain_slug}.kitchenos.com</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'identity',
            header: 'Registry',
            cell: (client) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{client.client_code}</span>
                    <span className={styles.planExpiry}>{client.legal_name || 'No legal name set'}</span>
                </div>
            ),
        },
        {
            key: 'subscription',
            header: 'Subscription',
            cell: (client) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{client.subscription_plan?.plan_name || 'No active plan'}</span>
                    <span className={styles.planExpiry}>{formatBillingCycle(client.subscription_type)}</span>
                    <span className={styles.planExpiry}>Renews {formatRenewalDate(client.renewal_date)}</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Lifecycle',
            cell: (client) => (
                <span
                    className={styles.statusBadge}
                    style={{
                        color: STATUS_COLORS[client.status],
                        background: `${STATUS_COLORS[client.status]}18`,
                        borderColor: `${STATUS_COLORS[client.status]}55`,
                    }}
                >
                    {STATUS_LABELS[client.status]}
                </span>
            ),
        },
        {
            key: 'contacts',
            header: 'Primary Contacts',
            cell: (client) => {
                const business = getContact(client, 'business_primary');
                const billing = getContact(client, 'billing_primary');
                return (
                    <div className={styles.planCell}>
                        <span className={styles.planName}>{business?.full_name || 'Business contact missing'}</span>
                        <span className={styles.planExpiry}>{billing?.email || billing?.phone || 'Billing contact missing'}</span>
                    </div>
                );
            },
        },
        {
            key: 'governance',
            header: 'Governance',
            cell: (client) => {
                const governanceState = client.governance_state || 'normal';
                const color = GOVERNANCE_COLORS[governanceState];
                return (
                    <span
                        className={styles.statusBadge}
                        style={{
                            color,
                            background: `${color}18`,
                            borderColor: `${color}55`,
                        }}
                    >
                        {governanceState.replaceAll('_', ' ')}
                    </span>
                );
            },
        },
        {
            key: 'scale',
            header: 'Scale',
            cell: (client) => (
                <div className={styles.planCell}>
                    <span className={styles.planName}>{client.branch_count} branches</span>
                    <span className={styles.planExpiry}>{client.user_count} users</span>
                </div>
            ),
        },
        {
            key: 'updated',
            header: 'Updated',
            cell: (client) => (
                <div className={styles.countCell}>
                    <Clock3 size={14} color="var(--accent-primary)" />
                    <span>{new Date(client.updated_at).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (client) => (
                <div className={styles.actionGroup}>
                    <button
                        className={styles.actionBtn}
                        title="View"
                        onClick={() => navigate(`/nexus/clients/${client.id}`)}
                    >
                        <Eye size={15} />
                    </button>
                    <button
                        className={styles.actionBtn}
                        title="Edit"
                        onClick={() => navigate(`/nexus/clients/${client.id}/edit`)}
                    >
                        <Edit2 size={15} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <div className={styles.headerEyebrow}><ShieldCheck size={13} />Platform Tenant Registry</div>
                    <h1 className="text-gradient">Client Registry</h1>
                    <p>Govern tenant identity, lifecycle, contacts, and activation readiness from Nexus.</p>
                </div>
                <KitchenButton onClick={() => navigate('/nexus/clients/new')}>
                    <Plus size={18} style={{ marginRight: 8 }} />
                    Create Client
                </KitchenButton>
            </header>

            <div className={styles.kpiGrid}>
                <StatusCard label="Total Clients" value={stats.total} icon={<Building2 size={18} />} tone="indigo" meta="Registered tenants" />
                <StatusCard label="Draft" value={stats.draft} icon={<ShieldCheck size={18} />} tone="purple" meta="Awaiting onboarding start" />
                <StatusCard label="Onboarding" value={stats.onboarding} icon={<Clock3 size={18} />} tone="orange" meta="Provisioning in progress" />
                <StatusCard label="Active" value={stats.active} icon={<Activity size={18} />} tone="green" meta="Operational tenants" />
                <StatusCard label="Suspended" value={stats.suspended} icon={<Users size={18} />} tone="red" meta="Platform-restricted tenants" />
                <StatusCard label="Inactive / Closed" value={stats.closed} icon={<GitBranch size={18} />} tone="cyan" meta="Retained but not live" />
                <StatusCard label="Governance Attention" value={stats.governanceAttention} icon={<ShieldCheck size={18} />} tone="orange" meta="Restricted or blocked tenants" />
            </div>

            <KitchenCard className={styles.tableCard}>
                <div style={{ display: 'grid', gap: 16, padding: '20px 24px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12 }}>
                        <div className={styles.searchWrap}>
                            <KitchenInput
                                placeholder="Search by name, code, legal name, or slug"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                icon={<Search size={18} />}
                            />
                        </div>
                        <KitchenSelect
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(1);
                            }}
                            options={[
                                { value: '', label: 'All lifecycle states' },
                                { value: 'draft', label: 'Draft' },
                                { value: 'onboarding', label: 'Onboarding' },
                                { value: 'active', label: 'Active' },
                                { value: 'suspended', label: 'Suspended' },
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'closed', label: 'Closed' },
                            ]}
                        />
                        <KitchenSelect
                            value={governanceFilter}
                            onChange={(event) => {
                                setGovernanceFilter(event.target.value);
                                setPage(1);
                            }}
                            options={[
                                { value: '', label: 'All governance states' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'restricted', label: 'Restricted' },
                                { value: 'suspended', label: 'Suspended' },
                                { value: 'closure_pending', label: 'Closure Pending' },
                                { value: 'closed', label: 'Closed' },
                            ]}
                        />
                        <KitchenButton variant="ghost" onClick={() => {
                            setSearch('');
                            setStatusFilter('');
                            setGovernanceFilter('');
                            setPage(1);
                        }}>
                            Reset
                        </KitchenButton>
                    </div>
                    <div className={styles.resultInfo}>
                        Showing <strong>{paginated.length}</strong> of <strong>{filtered.length}</strong> clients
                    </div>
                </div>

                {isLoading ? (
                    <div className={styles.loaderBox}>
                        <Clock3 size={32} className={styles.spin} />
                        <span>Loading client registry...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Building2 size={40} color="var(--accent-primary)" />
                        <h3>No clients found</h3>
                        <p>Create the first tenant record or clear the current filters.</p>
                    </div>
                ) : (
                    <KitchenTable columns={columns} data={paginated} emptyMessage="No clients match the current filters." />
                )}

                {totalPages > 1 && (
                    <div className={styles.pagination}>
                        <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                                key={pageNumber}
                                className={`${styles.pageBtn} ${pageNumber === page ? styles.pageBtnActive : ''}`}
                                onClick={() => setPage(pageNumber)}
                            >
                                {pageNumber}
                            </button>
                        ))}
                        <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>›</button>
                    </div>
                )}
            </KitchenCard>
        </div>
    );
}

function StatusCard({
    label,
    value,
    icon,
    tone,
    meta,
}: {
    label: string;
    value: number;
    icon: ReactNode;
    tone: 'indigo' | 'purple' | 'orange' | 'green' | 'red' | 'cyan';
    meta: string;
}) {
    const toneClass = {
        indigo: styles.kpiIndigo,
        purple: styles.kpiPurple,
        orange: styles.kpiOrange,
        green: styles.kpiGreen,
        red: styles.kpiRed,
        cyan: styles.kpiCyan,
    }[tone];

    const iconClass = {
        indigo: styles.kpiIconIndigo,
        purple: styles.kpiIconPurple,
        orange: styles.kpiIconOrange,
        green: styles.kpiIconGreen,
        red: styles.kpiIconRed,
        cyan: styles.kpiIconCyan,
    }[tone];

    return (
        <div className={`${styles.kpiCard} ${toneClass}`}>
            <div className={styles.kpiTop}>
                <div className={styles.kpiHeaderInfo}>
                    <div className={`${styles.kpiIcon} ${iconClass}`}>{icon}</div>
                    <div className={styles.kpiLabel}>{label}</div>
                </div>
            </div>
            <div className={styles.kpiValue}>{value}</div>
            <div className={styles.kpiMeta}>{meta}</div>
            <div className={styles.kpiProgressBar}>
                <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
            </div>
        </div>
    );
}
