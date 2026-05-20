import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Plus, Edit, Trash2, Power, Loader2, CheckCircle2, RefreshCw, Layers } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import { themeApi } from '../../api/api';
import { useThemeEngine } from '../../providers/ThemeProvider';

export function ThemeList() {
    const navigate = useNavigate();
    const { refreshTheme } = useThemeEngine();
    const [themes, setThemes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isResyncing, setIsResyncing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchThemes = async () => {
        setIsLoading(true);
        try {
            const data = await themeApi.getThemes();
            setThemes(data);
        } catch (err) {
            console.error('Failed to fetch themes', err);
            toast.error('Fetch Failed', 'Could not retrieve themes from the database.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchThemes();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this theme? This action cannot be undone.')) return;
        try {
            await themeApi.deleteTheme(id);
            setThemes(themes.filter(t => t.id !== id));
            toast.success('Theme Deleted', 'Theme was successfully removed.');
        } catch (err: any) {
            toast.error('Deletion Failed', err.message || 'Failed to delete theme.');
        }
    };

    const handleActivate = async (id: string) => {
        try {
            await themeApi.activateTheme(id);
            await fetchThemes();
            await refreshTheme();
            toast.success('Theme Activated', 'System theme has been updated.');
        } catch (err: any) {
            toast.error('Activation Failed', err.message || 'Failed to activate theme.');
        }
    };

    const handleGlobalReseed = async () => {
        if (!window.confirm('This will restore all system themes (Dark, Light, Blue, Purple, Red) to their default professional values. Any manual changes to these specific themes will be overwritten. Continue?')) return;
        setIsResyncing(true);
        try {
            await themeApi.reseed();
            await fetchThemes();
            await refreshTheme();
            toast.success('System Resynced', 'Professional themes restored to defaults.');
        } catch (err: any) {
            toast.error('Resync Failed', err.message);
        } finally {
            setIsResyncing(false);
        }
    };

    const columns: ColumnDef<any>[] = [
        {
            key: 'theme_name',
            header: 'Theme Identity',
            cell: (row) => {
                const t = row.tokens || {};
                const p = t.btn_primary_bg || t.accent_primary || '#6366f1';
                const s = t.btn_secondary_bg || t.accent_secondary || '#475569';
                const bg = t.bg_app || t.bg_primary || '#020205';

                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: bg,
                            border: `1px solid ${p}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: p }} />
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: s, opacity: 0.5 }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{row.theme_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{row.slug || 'custom-id'}</div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'is_system_default',
            header: 'Type',
            cell: (row) => row.is_system_default ? (
                <span className="badge-system">System Preset</span>
            ) : (
                <span className="badge-neutral">Custom Theme</span>
            )
        },
        {
            key: 'is_active',
            header: 'Status',
            cell: (row) => row.is_active ? (
                <div style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
                    LIVE
                </div>
            ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Inactive</span>
            )
        },
        { key: 'client_id', header: 'Scope', cell: (row) => row.client_id ? `Client: ${row.client_id}` : 'Platform Global' },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (row) => (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    {!row.is_active && (
                        <KitchenButton variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleActivate(row.id); }}>
                            <Power size={14} style={{ marginRight: '6px' }} /> Activate
                        </KitchenButton>
                    )}
                    <KitchenButton variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/nexus/themes/${row.id}`); }}>
                        <Edit size={14} style={{ marginRight: '6px' }} /> Edit
                    </KitchenButton>
                    {!row.is_active && !row.is_system_default && (
                        <KitchenButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                            <Trash2 size={16} color="var(--color-danger)" />
                        </KitchenButton>
                    )}
                </div>
            )
        }
    ];

    const filteredThemes = themes.filter(t => {
        const matchName = t.theme_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? t.is_active : !t.is_active);
        return matchName && matchStatus;
    });

    const paginatedThemes = filteredThemes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredThemes.length / itemsPerPage);

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                        <Layers size={20} />
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>User Experience</span>
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>Theme Engine</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage visual identity, brand colors, and component aesthetics across the platform.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <KitchenButton variant="outline" onClick={handleGlobalReseed} disabled={isResyncing || isLoading}>
                        <RefreshCw size={18} style={{ marginRight: '8px' }} className={isResyncing ? 'animate-spin' : ''} />
                        {isResyncing ? 'Resyncing...' : 'Restore Defaults'}
                    </KitchenButton>
                    <KitchenButton variant="primary" onClick={() => navigate('/nexus/themes/new')}>
                        <Plus size={20} style={{ marginRight: '8px' }} />
                        Create New Theme
                    </KitchenButton>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <KitchenInput
                        placeholder="Search themes by name or slug..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ width: '220px' }}>
                    <KitchenSelect
                        options={[
                            { label: 'All Statuses', value: 'all' },
                            { label: 'Only Active', value: 'active' },
                            { label: 'Only Inactive', value: 'inactive' }
                        ]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                </div>
            </div>

            <KitchenCard title="Theme Registry" noPadding>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                ) : themes.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No themes initialized in the database.</div>
                        <KitchenButton variant="primary" onClick={handleGlobalReseed}>
                            <RefreshCw size={16} style={{ marginRight: '8px' }} />
                            Initialize System Themes
                        </KitchenButton>
                    </div>
                ) : (
                    <>
                        <KitchenTable
                            columns={columns}
                            data={paginatedThemes}
                            onRowClick={(row) => navigate(`/nexus/themes/${row.id}`)}
                        />
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderTop: '1px solid var(--divider-color)' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    Displaying {paginatedThemes.length} of {filteredThemes.length} results
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <KitchenButton variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</KitchenButton>
                                    <KitchenButton variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</KitchenButton>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </KitchenCard>

            <div style={{
                padding: '16px',
                background: 'rgba(99,102,241,0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(99,102,241,0.1)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
            }}>
                <CheckCircle2 size={18} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <strong>Pro Tip:</strong> Themes marked as "System Preset" are core KitchenOS aesthetics. You can edit them, but "Restore Defaults" will reset them.
                </span>
            </div>
        </div>
    );
}
