import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, CopyPlus, Layers, RefreshCcw } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';

type BlueprintStatus = 'draft' | 'active' | 'retired';

interface BlueprintRow {
    id: string;
    blueprint_code: string;
    blueprint_name: string;
    description?: string | null;
    status: BlueprintStatus;
    active_version_no?: number | null;
    version_count: number;
    assignment_count: number;
    applied_count: number;
    updated_at: string;
}

const STATUS_COLORS: Record<BlueprintStatus, string> = {
    draft: 'var(--warning)',
    active: 'var(--success)',
    retired: 'var(--text-muted)',
};

export function BlueprintList() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<BlueprintRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);

    const load = async () => {
        setIsLoading(true);
        try {
            const response = await platformApi.getBlueprints();
            setRows(Array.isArray(response) ? response.map((row: any) => ({
                id: row.id,
                blueprint_code: row.blueprint_code,
                blueprint_name: row.blueprint_name,
                description: row.description,
                status: row.status,
                active_version_no: row.active_version_no ?? null,
                version_count: Number(row.version_count || 0),
                assignment_count: Number(row.assignment_count || 0),
                applied_count: Number(row.applied_count || 0),
                updated_at: row.updated_at,
            })) : []);
        } catch (error) {
            toast.error('Failed to load blueprints', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const metrics = useMemo(() => ({
        total: rows.length,
        active: rows.filter((row) => row.status === 'active').length,
        draft: rows.filter((row) => row.status === 'draft').length,
        retired: rows.filter((row) => row.status === 'retired').length,
    }), [rows]);

    const handleStatusChange = async (row: BlueprintRow, status: BlueprintStatus) => {
        setStatusLoadingId(row.id);
        try {
            await platformApi.updateBlueprintStatus(row.id, status);
            toast.success('Blueprint status updated', `${row.blueprint_name} moved to ${status}.`);
            await load();
        } catch (error) {
            toast.error('Status update failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setStatusLoadingId(null);
        }
    };

    const columns: ColumnDef<BlueprintRow>[] = [
        {
            key: 'blueprint_name',
            header: 'Blueprint',
            cell: (row) => (
                <div className={styles.clientCell}>
                    <div className={styles.clientAvatar}>{row.blueprint_name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <div className={styles.clientName}>{row.blueprint_name}</div>
                        <div className={styles.clientSlug}>{row.blueprint_code}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span
                    className={styles.statusBadge}
                    style={{
                        color: STATUS_COLORS[row.status],
                        background: `${STATUS_COLORS[row.status]}18`,
                        borderColor: `${STATUS_COLORS[row.status]}55`,
                    }}
                >
                    {row.status}
                </span>
            ),
        },
        {
            key: 'active_version_no',
            header: 'Version',
            cell: (row) => `v${row.active_version_no || 1} (${row.version_count} total)`,
        },
        {
            key: 'usage',
            header: 'Usage',
            cell: (row) => `${row.assignment_count} assigned / ${row.applied_count} applied`,
        },
        {
            key: 'updated_at',
            header: 'Updated',
            cell: (row) => new Date(row.updated_at).toLocaleString(),
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <div className={styles.actionGroup}>
                    <KitchenButton size="sm" variant="secondary" onClick={() => navigate(`/nexus/blueprints/${row.id}`)}>
                        <ArrowRight size={14} style={{ marginRight: 6 }} />
                        Open
                    </KitchenButton>
                    {row.status !== 'active' ? (
                        <KitchenButton size="sm" onClick={() => handleStatusChange(row, 'active')} isLoading={statusLoadingId === row.id}>
                            Activate
                        </KitchenButton>
                    ) : (
                        <KitchenButton size="sm" variant="warning" onClick={() => handleStatusChange(row, 'retired')} isLoading={statusLoadingId === row.id}>
                            Retire
                        </KitchenButton>
                    )}
                </div>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className={styles.loaderBox} style={{ height: '60vh' }}>
                <RefreshCcw size={36} className={styles.spin} />
                <span>Loading blueprints...</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><Layers size={22} /></div>
                    <div>
                        <div className={styles.headerEyebrow}>Phase 3 Batch 5</div>
                        <h1>Blueprints</h1>
                        <p>Reusable, versioned onboarding packs for safe configuration-only client initialization.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton onClick={() => navigate('/nexus/blueprints/new')}>
                        <CopyPlus size={15} style={{ marginRight: 6 }} />
                        Create Blueprint
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiValue}>{metrics.total}</div>
                    <div className={styles.kpiLabel}>Total Blueprints</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiValue}>{metrics.active}</div>
                    <div className={styles.kpiLabel}>Active</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiOrange}`}>
                    <div className={styles.kpiValue}>{metrics.draft}</div>
                    <div className={styles.kpiLabel}>Draft</div>
                </KitchenCard>
                <KitchenCard className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiValue}>{metrics.retired}</div>
                    <div className={styles.kpiLabel}>Retired</div>
                </KitchenCard>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableTitleRow}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Blueprint Catalog</h3>
                </div>
                <div className={styles.resultInfo}>
                    <strong>{rows.length}</strong> blueprint{rows.length === 1 ? '' : 's'} currently defined in Nexus.
                </div>
                <KitchenTable columns={columns} data={rows} emptyMessage="No blueprints have been created yet." />
            </KitchenCard>

            <div className={styles.overviewGrid}>
                <KitchenCard className={styles.overviewCard}>
                    <h3 className={styles.cardTitle}><Clock3 size={16} /> Safety Boundary</h3>
                    <div className={styles.infoRows}>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Allowed</span><span className={styles.infoRowValue}>Client settings defaults and role skeletons.</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Blocked</span><span className={styles.infoRowValue}>Transactional data, users, branches, and live tenant copies.</span></div>
                        <div className={styles.infoRow}><span className={styles.infoRowLabel}>Versioning</span><span className={styles.infoRowValue}>New payload changes create new versions instead of overwriting history.</span></div>
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}

export default BlueprintList;
