import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
    CheckCircle,
    Clock3,
    Loader2,
    MapPin,
    MoreHorizontal,
    PauseCircle,
    Plus,
    Search,
    Settings2,
    ShieldAlert,
    Store,
    XCircle,
} from 'lucide-react';
import { branchApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import styles from './BranchList.module.css';

interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
    status: 'setup_pending' | 'active' | 'inactive' | 'suspended';
    inventory_store_type: 'branch' | 'central';
    is_production_source: boolean;
    production_source_label?: string | null;
    city?: string;
    state?: string;
    country?: string;
    modules_enabled?: string[];
    effective_settings: {
        currency_code: string;
        language: string;
        timezone: string;
    };
    readiness: {
        is_operationally_ready: boolean;
        setup_completion_percent: number;
        blockers: string[];
    };
    operational_profile: {
        writes_allowed: boolean;
        branch_kind: 'operational_branch' | 'central_store';
    };
}

interface BranchColumn {
    key: string;
    header: string;
    cell: (row: Branch) => ReactNode;
    align?: 'left' | 'center' | 'right';
}

interface ActionMenuState {
    branchId: number;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
}

const needsTaxSetup = (branch: Branch) =>
    branch.readiness.blockers.some((blocker) =>
        blocker.toLowerCase().includes('tax code'),
    );

const getReadinessChecklist = (branch: Branch) => {
    if (branch.readiness.blockers.length > 0) {
        return branch.readiness.blockers.map((blocker) => ({
            label: blocker,
            complete: false,
        }));
    }

    return [
        {
            label: 'Minimum setup is complete.',
            complete: true,
        },
    ];
};

export function BranchList() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';

    const loadBranches = async (selectedStatus = statusFilter) => {
        setIsLoading(true);
        try {
            const data = await branchApi.getBranches(
                selectedStatus === 'all' ? undefined : { status: selectedStatus },
            );
            setBranches(data);
        } catch (error: any) {
            console.error('Failed to fetch branches:', error);
            toast.error('Load Failed', error?.message || 'Could not load branch controls.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBranches(statusFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    useEffect(() => {
        if (!actionMenu) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActionMenu(null);
            }
        };

        const handleViewportChange = () => {
            setActionMenu(null);
        };

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        document.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [actionMenu]);

    const handleStatusChange = async (branchId: number, status: Branch['status']) => {
        try {
            await branchApi.updateBranchStatus(String(branchId), status);
            toast.success('Branch Updated', `Branch moved to ${status}.`);
            setActionMenu(null);
            await loadBranches(statusFilter);
        } catch (error: any) {
            toast.error('Status Update Failed', error.message || 'Could not update branch status.');
        }
    };

    const openActionMenu = (event: ReactMouseEvent<HTMLButtonElement>, branchId: number) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const estimatedMenuHeight = 280;
        const openUpward = window.innerHeight - rect.bottom < estimatedMenuHeight && rect.top > estimatedMenuHeight;
        const menuWidth = 240;

        setActionMenu({
            branchId,
            top: openUpward ? rect.top - 8 : rect.bottom + 8,
            left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)),
            placement: openUpward ? 'top' : 'bottom',
        });
    };

    const closeActionMenu = () => setActionMenu(null);

    const runMenuAction = (callback: () => void) => {
        closeActionMenu();
        callback();
    };

    const selectedActionBranch = actionMenu
        ? branches.find((branch) => branch.id === actionMenu.branchId) ?? null
        : null;

    const filteredBranches = branches.filter((branch) => {
        const haystack = [
            branch.branch_name,
            branch.branch_code,
            branch.city,
            branch.state,
            branch.country,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
    });

    const getStatusBadgeClass = (status: Branch['status']) => {
        switch (status) {
            case 'active':
                return styles.active;
            case 'setup_pending':
                return styles.setupPending;
            case 'suspended':
                return styles.suspended;
            default:
                return styles.inactive;
        }
    };

    const renderStatusIcon = (status: Branch['status']) => {
        switch (status) {
            case 'active':
                return <CheckCircle size={11} />;
            case 'setup_pending':
                return <Clock3 size={11} />;
            case 'suspended':
                return <ShieldAlert size={11} />;
            default:
                return <XCircle size={11} />;
        }
    };

    const getStatusLabel = (status: Branch['status']) =>
        status
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());

    const columns: BranchColumn[] = [
        {
            key: 'branch',
            header: 'Branch',
            cell: (row) => (
                <div className={styles.branchCell}>
                    <div className={styles.branchIcon}>
                        <Store size={15} />
                    </div>
                        <div>
                            <div className={styles.branchName}>{row.branch_name}</div>
                            <div className={styles.branchMeta}>
                                <span className={styles.branchCode}>{row.branch_code}</span>
                                <span className={row.inventory_store_type === 'central' ? styles.centralBadge : styles.branchBadge}>
                                    {row.inventory_store_type === 'central' ? 'Central Store' : 'Branch Store'}
                                </span>
                                {row.is_production_source && (
                                    <span className={styles.productionBadge}>
                                        {row.production_source_label || 'Production Source'}
                                    </span>
                                )}
                                <span className={styles.locationLabel}>
                                    <MapPin size={10} />
                                    {[row.city, row.state, row.country].filter(Boolean).join(', ') || 'Location pending'}
                            </span>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'readiness',
            header: 'Readiness',
            cell: (row) => {
                const checklist = getReadinessChecklist(row);

                return (
                    <div className={styles.readinessCell}>
                        <div className={styles.readinessTop}>
                            <span className={row.readiness.is_operationally_ready ? styles.readyBadge : styles.pendingBadge}>
                                {row.readiness.is_operationally_ready ? 'Ready' : 'Needs setup'}
                            </span>
                            <strong>{row.readiness.setup_completion_percent}%</strong>
                        </div>
                        <div className={styles.readinessText}>
                            {row.readiness.is_operationally_ready
                                ? 'This branch is ready for operations.'
                                : `${checklist.length} item${checklist.length === 1 ? '' : 's'} still need attention.`}
                        </div>
                        <ul className={styles.readinessList}>
                            {checklist.map((item) => (
                                <li
                                    key={`${row.id}-${item.label}`}
                                    className={item.complete ? styles.readinessItemComplete : styles.readinessItemPending}
                                >
                                    <span className={styles.readinessIcon}>
                                        {item.complete ? <CheckCircle size={12} /> : <Clock3 size={12} />}
                                    </span>
                                    <span>{item.label}</span>
                                </li>
                            ))}
                        </ul>
                        {needsTaxSetup(row) && (
                            <button
                                type="button"
                                className={styles.inlineLink}
                                onClick={() => navigate(`${consoleBase}/setup/branches/${row.id}/settings?tab=tax`)}
                            >
                                Open tax settings
                            </button>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'scope',
            header: 'Control Scope',
            cell: (row) => (
                <div className={styles.scopeCell}>
                    <span>{row.operational_profile.branch_kind === 'central_store' ? 'Central oversight hub' : 'Branch-local operations'}</span>
                    <span>{row.is_production_source ? row.production_source_label || 'Production source enabled' : 'Production source not enabled'}</span>
                    <span>{row.effective_settings.currency_code} / {row.effective_settings.language.toUpperCase()}</span>
                    <span>{row.effective_settings.timezone}</span>
                    <span>{row.operational_profile.writes_allowed ? 'Operational writes enabled' : 'Operational writes locked'}</span>
                    <span>{row.modules_enabled?.length || 0} modules</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span className={[styles.statusBadge, getStatusBadgeClass(row.status)].join(' ')}>
                    {renderStatusIcon(row.status)}
                    {getStatusLabel(row.status)}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div className={styles.actionsCell}>
                    <button
                        type="button"
                        className={styles.settingsQuickAction}
                        onClick={() => navigate(`${consoleBase}/setup/branches/${row.id}/settings?tab=operations`)}
                    >
                        <Settings2 size={14} />
                        <span>Settings</span>
                    </button>
                    <button
                        type="button"
                        className={styles.actionTrigger}
                        onClick={(event) => openActionMenu(event, row.id)}
                    >
                        <span>Actions</span>
                        <MoreHorizontal size={14} />
                    </button>
                </div>
            ),
        },
    ];

    const totalBranches = branches.length;
    const activeBranches = branches.filter((branch) => branch.status === 'active').length;
    const setupPendingBranches = branches.filter((branch) => branch.status === 'setup_pending').length;
    const writesLockedBranches = branches.filter((branch) => !branch.operational_profile.writes_allowed).length;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Operational Branches</h1>
                    <p>Manage branch identity, readiness, and lifecycle within this client boundary.</p>
                </div>
                <KitchenButton variant="primary" size="sm" onClick={() => navigate(`${consoleBase}/setup/branches/new`)}>
                    <Plus size={16} />
                    New Branch
                </KitchenButton>
            </header>

            <section className={styles.summaryGrid}>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total</span>
                    <strong>{totalBranches}</strong>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Active</span>
                    <strong>{activeBranches}</strong>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Setup Pending</span>
                    <strong>{setupPendingBranches}</strong>
                </KitchenCard>
                <KitchenCard className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Writes Locked</span>
                    <strong>{writesLockedBranches}</strong>
                </KitchenCard>
            </section>

            <div className={styles.tableCard}>
                <div className={styles.toolbar}>
                    <KitchenInput
                        placeholder="Search by branch name, code, or location..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        icon={<Search size={16} />}
                        containerClassName={styles.searchInput}
                    />
                    <KitchenSelect
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        options={[
                            { value: 'all', label: 'All statuses' },
                            { value: 'setup_pending', label: 'Setup Pending' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'suspended', label: 'Suspended' },
                        ]}
                        containerClassName={styles.filterInput}
                    />
                </div>
                <div className={styles.helperBanner}>
                    Use <strong>Settings</strong> to manage branch configuration, or open <strong>Tax Settings</strong> directly to set the default tax code required for activation.
                </div>
                {isLoading ? (
                    <div className={styles.loaderWrap}>
                        <Loader2 size={32} className="spinner" color="var(--accent-primary)" />
                    </div>
                ) : filteredBranches.length === 0 ? (
                    <div className={styles.emptyState}>No branches found for this client scope.</div>
                ) : (
                    <div className={styles.tableScroll}>
                        <table className={styles.datatable}>
                            <thead>
                                <tr>
                                    {columns.map((column) => (
                                        <th
                                            key={column.key}
                                            className={column.align === 'right'
                                                ? styles.alignRight
                                                : column.align === 'center'
                                                    ? styles.alignCenter
                                                    : styles.alignLeft}
                                        >
                                            {column.header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBranches.map((row) => (
                                    <tr key={row.id}>
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={column.align === 'right'
                                                    ? styles.alignRight
                                                    : column.align === 'center'
                                                        ? styles.alignCenter
                                                        : styles.alignLeft}
                                            >
                                                {column.cell(row)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {actionMenu && typeof document !== 'undefined'
                ? createPortal(
                    <>
                        <button
                            type="button"
                            aria-label="Close branch actions"
                            className={styles.actionMenuBackdrop}
                            onClick={closeActionMenu}
                        />
                        <div
                            ref={actionMenuRef}
                            className={[
                                styles.actionMenuPanel,
                                actionMenu.placement === 'top' ? styles.actionMenuTop : styles.actionMenuBottom,
                            ].join(' ')}
                            style={{ top: actionMenu.top, left: actionMenu.left }}
                        >
                            <button
                                type="button"
                                className={styles.actionMenuItem}
                                onClick={() => runMenuAction(() => navigate(`${consoleBase}/setup/branches/${actionMenu.branchId}`))}
                            >
                                <span className={styles.actionIconWrap}>
                                    <Store size={14} />
                                </span>
                                <span>Edit branch</span>
                            </button>
                            <button
                                type="button"
                                className={styles.actionMenuItem}
                                onClick={() => runMenuAction(() => navigate(`${consoleBase}/setup/branches/${actionMenu.branchId}/settings`))}
                            >
                                <span className={styles.actionIconWrap}>
                                    <Settings2 size={14} />
                                </span>
                                <span>Branch settings</span>
                            </button>
                            <button
                                type="button"
                                className={styles.actionMenuItem}
                                onClick={() => runMenuAction(() => navigate(`${consoleBase}/setup/branches/${actionMenu.branchId}/settings?tab=tax`))}
                            >
                                <span className={styles.actionIconWrap}>
                                    <CheckCircle size={14} />
                                </span>
                                <span>Tax settings</span>
                            </button>
                            {selectedActionBranch?.status !== 'active' && (
                                <button
                                    type="button"
                                    className={styles.actionMenuItem}
                                    onClick={() => handleStatusChange(actionMenu.branchId, 'active')}
                                >
                                    <span className={styles.actionIconWrap}>
                                        <CheckCircle size={14} />
                                    </span>
                                    <span>Activate branch</span>
                                </button>
                            )}
                            {selectedActionBranch?.status !== 'setup_pending' && (
                                <button
                                    type="button"
                                    className={styles.actionMenuItem}
                                    onClick={() => handleStatusChange(actionMenu.branchId, 'setup_pending')}
                                >
                                    <span className={styles.actionIconWrap}>
                                        <Clock3 size={14} />
                                    </span>
                                    <span>Move to setup pending</span>
                                </button>
                            )}
                            {selectedActionBranch?.status === 'active' && (
                                <button
                                    type="button"
                                    className={styles.actionMenuItem}
                                    onClick={() => handleStatusChange(actionMenu.branchId, 'inactive')}
                                >
                                    <span className={styles.actionIconWrap}>
                                        <PauseCircle size={14} />
                                    </span>
                                    <span>Mark as inactive</span>
                                </button>
                            )}
                            {selectedActionBranch?.status !== 'suspended' && (
                                <button
                                    type="button"
                                    className={styles.actionMenuItem}
                                    onClick={() => handleStatusChange(actionMenu.branchId, 'suspended')}
                                >
                                    <span className={styles.actionIconWrap}>
                                        <ShieldAlert size={14} />
                                    </span>
                                    <span>Suspend branch</span>
                                </button>
                            )}
                        </div>
                    </>,
                    document.body,
                )
                : null}
        </div>
    );
}
