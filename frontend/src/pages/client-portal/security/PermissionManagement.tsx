/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { 
    Search, Layers, Loader2, Plus, Trash2, XCircle, 
    Eye, History, Pencil, Settings2, CheckSquare, 
    Download, Upload, RefreshCcw, Undo2, Printer, Shield
} from 'lucide-react';
import { roleApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';
import styles from './Security.module.css';

// â”€â”€ Icons Helper (Matching Role Management for consistency) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getPermissionIcon = (permId: string) => {
    const id = permId.toLowerCase();
    const size = 12;
    if (id.includes('create') || id.includes('add') || id.includes('new')) return <Plus size={size} style={{ color: 'var(--state-active)' }} />; 
    if (id.includes('delete') || id.includes('remove') || id.includes('destroy')) return <Trash2 size={size} style={{ color: 'var(--alert-error-text)' }} />;
    if (id.includes('void') || id.includes('cancel') || id.includes('reject') || id.includes('ban')) return <XCircle size={size} style={{ color: 'var(--alert-error-text)' }} />;
    if (id.includes('view') || id.includes('read') || id.includes('list')) return <Eye size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('history') || id.includes('logs') || id.includes('audit')) return <History size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('search') || id.includes('find')) return <Search size={size} style={{ color: 'var(--accent-tertiary)' }} />;
    if (id.includes('update') || id.includes('edit') || id.includes('patch') || id.includes('modify')) return <Pencil size={size} style={{ color: 'var(--alert-warning-text)' }} />;
    if (id.includes('config') || id.includes('settings') || id.includes('setup')) return <Settings2 size={size} style={{ color: 'var(--alert-warning-text)' }} />;
    if (id.includes('approve') || id.includes('authorize') || id.includes('confirm') || id.includes('verify')) return <CheckSquare size={size} style={{ color: 'var(--state-active)' }} />;
    if (id.includes('export') || id.includes('download')) return <Download size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('import') || id.includes('upload')) return <Upload size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('sync') || id.includes('refresh') || id.includes('reload')) return <RefreshCcw size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('refund') || id.includes('return') || id.includes('undo')) return <Undo2 size={size} style={{ color: 'var(--text-muted)' }} />;
    if (id.includes('print') || id.includes('invoice') || id.includes('receipt') || id.includes('bill')) return <Printer size={size} style={{ color: 'var(--text-muted)' }} />;
    return <Shield size={size} style={{ color: 'var(--accent-primary)' }} />;
};

type PermissionRecord = {
    id: string;
    label: string;
};

type PermissionModule = {
    module_key: string;
    module_id: string;
    module_name: string;
    description: string;
    recommendedRoles: string[];
    permissionCount: number;
    permissions: PermissionRecord[];
};

export function PermissionManagement() {
    const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('All');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRegistry = async () => {
            setIsLoading(true);
            try {
                const data = await roleApi.getPermissionsRegistry();
                setPermissionModules((data || []).map((group: any) => ({
                    module_key: String(group.key || group.label),
                    module_id: String(group.label),
                    module_name: String(group.label),
                    description: String(group.description || ''),
                    recommendedRoles: Array.isArray(group.recommended_roles) ? group.recommended_roles.map(String) : [],
                    permissionCount: Number(group.permission_count || (group.permissions || []).length),
                    permissions: (group.permissions || []).map((p: any) => ({
                        id: String(p.id),
                        label: String(p.label),
                    })),
                })));
            } catch {
                toast.error('Registry Error', 'Could not load permission modules.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchRegistry();
    }, []);

    const modulesList = useMemo(() => ['All', ...permissionModules.map(m => m.module_name)], [permissionModules]);

    const filteredModules = useMemo(() => {
        return permissionModules
            .filter(m => moduleFilter === 'All' || m.module_name === moduleFilter)
            .map(m => ({
                ...m,
                permissions: m.permissions.filter(p => {
                    const q = search.trim().toLowerCase();
                    return !q || p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
                }),
            }))
            .filter(m => m.permissions.length > 0);
    }, [moduleFilter, permissionModules, search]);

    if (isLoading) return <div className={styles.container}><div className={styles.emptyState}><Loader2 className={styles.spinner} /></div></div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1>Permission Registry</h1>
                </div>
            </header>

            <div className={styles.canvasControls}>
                <div className={styles.moduleSearch}>
                    <Search size={14} />
                    <input placeholder="Search perms..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className={styles.tabContainer}>
                    {modulesList.map(name => (
                        <button key={name} className={`${styles.tabButton} ${moduleFilter === name ? styles.activeTab : ''}`} onClick={() => setModuleFilter(name)}>
                            <Layers size={12} />
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.moduleGrid}>
                {filteredModules.map(module => (
                    <div key={module.module_id} className={styles.moduleCard}>
                        <div className={styles.cardHeader}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Shield size={12} color="var(--accent-primary)" />
                                {module.module_name}
                            </h4>
                            <span className={styles.badge}>{module.permissionCount}</span>
                        </div>
                        {module.recommendedRoles.length > 0 && (
                            <div className={styles.recommendedRoleRow}>
                                <div className={styles.recommendedRoleList}>
                                    {module.recommendedRoles.map(r => <span key={r} className={styles.recommendedRoleChip}>{r}</span>)}
                                </div>
                            </div>
                        )}
                        <div className={styles.cardBody}>
                            {module.permissions.map(p => (
                                <div key={p.id} className={styles.permItem}>
                                    <div className={styles.permLabel}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {getPermissionIcon(p.id)}
                                            {p.label.split(':')[0]}
                                        </span>
                                        <code className={styles.permissionSlug}>{p.id}</code>
                                    </div>
                                    <div className={styles.permActionWrap}>{p.label.split(':')[1] || 'Access'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

