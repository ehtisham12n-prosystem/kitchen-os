import { useState, useMemo } from 'react';
import {
    X, Search, Filter, Shield,
    User, ArrowRight,
    Download, RefreshCcw, AlertTriangle,
    CheckCircle2, Info, ChevronDown, Monitor,
    MousePointer2, Key, Database, Settings, Globe
} from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import styles from './AuditLogModal.module.css';

interface AuditLog {
    id: string;
    timestamp: string;
    actor: {
        name: string;
        username: string;
        avatar_color: string;
    };
    action: string;
    module: 'security' | 'users' | 'billing' | 'system' | 'catalog';
    target: string;
    status: 'success' | 'failure' | 'warning';
    ip_address: string;
    user_agent: string;
    details: string;
}

const MOCK_LOGS: AuditLog[] = [
    {
        id: '9d2e1f-001',
        timestamp: new Date().toISOString(),
        actor: { name: 'Adnan Raza', username: 'adnan.super', avatar_color: 'var(--accent-primary)' },
        action: 'Modified Operator Access',
        module: 'security',
        target: 'SYS-003 (Zara Malik)',
        status: 'success',
        ip_address: '182.160.44.12',
        user_agent: 'Chrome 122.0.0.0 / Windows 11',
        details: 'Changed status from "active" to "suspended" due to security policy update.'
    },
    {
        id: '9d2e1f-002',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        actor: { name: 'Bilal Siddiqui', username: 'bilal.ops', avatar_color: 'var(--color-success)' },
        action: 'Provisioned New Operator',
        module: 'users',
        target: 'SYS-008 (Kamran Ahmed)',
        status: 'success',
        ip_address: '110.33.21.9',
        user_agent: 'Firefox 123.0 / MacOS',
        details: 'Created internal system operator account with PLATFORM_SUPPORT role.'
    },
    {
        id: '9d2e1f-003',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        actor: { name: 'Unauthorized Attempt', username: 'unknown', avatar_color: 'var(--color-danger)' },
        action: 'Failed Login Attempt',
        module: 'security',
        target: 'Nexus /admin-login',
        status: 'failure',
        ip_address: '45.12.33.201',
        user_agent: 'Python-requests/2.31.0',
        details: 'Multiple failed brute-force attempts from unrecognized IP range.'
    },
    {
        id: '9d2e1f-004',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        actor: { name: 'System Core', username: 'kernel', avatar_color: 'var(--accent-tertiary)' },
        action: 'Global Configuration Sync',
        module: 'system',
        target: 'Tenant Registry',
        status: 'warning',
        ip_address: '127.0.0.1',
        user_agent: 'KitchenOS Cron/1.4',
        details: 'Branch sync delayed for 4 tenants due to high latency on regional nodes.'
    },
    {
        id: '9d2e1f-005',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        actor: { name: 'Sana Iqbal', username: 'sana.admin', avatar_color: 'var(--accent-secondary)' },
        action: 'Updated Subscription Plan',
        module: 'billing',
        target: 'Client: Gourmet Galaxy (CLT-44)',
        status: 'success',
        ip_address: '39.44.201.55',
        user_agent: 'Edge 121.0.0.0 / Windows 10',
        details: 'Upgraded plan from "Starter" to "Enterprise Multi-Branch".'
    },
    {
        id: '9d2e1f-006',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        actor: { name: 'Adnan Raza', username: 'adnan.super', avatar_color: 'var(--accent-primary)' },
        action: 'Database Schema Migration',
        module: 'system',
        target: 'Production Core',
        status: 'success',
        ip_address: '182.160.44.12',
        user_agent: 'PostmanRuntime/7.36.1',
        details: 'Executed V2.1.4 migration successfully. Applied 14 new indices.'
    },
];

const MODULE_ICONS: Record<string, any> = {
    security: Shield,
    users: User,
    billing: Key,
    system: Database,
    catalog: Settings
};

interface AuditLogModalProps {
    onClose: () => void;
}

export function AuditLogModal({ onClose }: AuditLogModalProps) {
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const filteredLogs = useMemo(() => {
        return MOCK_LOGS.filter(log => {
            const matchesSearch = !search ||
                log.action.toLowerCase().includes(search.toLowerCase()) ||
                log.actor.name.toLowerCase().includes(search.toLowerCase()) ||
                log.target.toLowerCase().includes(search.toLowerCase());
            const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
            const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
            return matchesSearch && matchesModule && matchesStatus;
        });
    }, [search, moduleFilter, statusFilter]);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {/* ── HEADER ───────────────────────────────────── */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <div className={styles.iconBox}>
                            <Shield className={styles.shieldPulse} size={20} />
                        </div>
                        <div>
                            <h2>Global Security Audit</h2>
                            <p>Real-time immutable ledger of platform-level operations.</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* ── TOOLBAR ─────────────────────────────────── */}
                    <div className={styles.toolbar}>
                        <div className={styles.search}>
                            <Search size={16} />
                            <input
                                placeholder="Search by action, actor or target..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className={styles.filters}>
                            <div className={styles.select}>
                                <Filter size={14} />
                                <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
                                    <option value="all">All Modules</option>
                                    <option value="security">Security</option>
                                    <option value="users">User Ops</option>
                                    <option value="billing">Billing</option>
                                    <option value="system">System</option>
                                </select>
                                <ChevronDown size={14} />
                            </div>
                            <div className={styles.select}>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="all">All Status</option>
                                    <option value="success">Success</option>
                                    <option value="warning">Warning</option>
                                    <option value="failure">Failure</option>
                                </select>
                                <ChevronDown size={14} />
                            </div>
                            <KitchenButton variant="secondary" className={styles.exportBtn}>
                                <Download size={14} />
                                Export
                            </KitchenButton>
                        </div>
                    </div>

                    {/* ── LOGS TABLE ──────────────────────────────── */}
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Timestamp</th>
                                    <th>Actor</th>
                                    <th>Action</th>
                                    <th>Module</th>
                                    <th>Target</th>
                                    <th style={{ textAlign: 'right' }}>Identity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => {
                                    const ModuleIcon = MODULE_ICONS[log.module] || Settings;
                                    return (
                                        <tr
                                            key={log.id}
                                            className={`${styles.row} ${selectedLog?.id === log.id ? styles.selectedRow : ''}`}
                                            onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                                        >
                                            <td className={styles.statusCell}>
                                                {log.status === 'success' && <CheckCircle2 size={16} className={styles.success} />}
                                                {log.status === 'warning' && <AlertTriangle size={16} className={styles.warning} />}
                                                {log.status === 'failure' && <X size={16} className={styles.danger} />}
                                            </td>
                                            <td className={styles.timeCell}>
                                                <div className={styles.timePrimary}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                <div className={styles.timeSecondary}>{new Date(log.timestamp).toLocaleDateString()}</div>
                                            </td>
                                            <td>
                                                <div className={styles.actorCell}>
                                                    <div className={styles.avatar} style={{ background: log.actor.avatar_color }}>
                                                        {log.actor.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className={styles.actorName}>{log.actor.name}</div>
                                                        <div className={styles.actorUser}>@{log.actor.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.actionText}>{log.action}</div>
                                            </td>
                                            <td>
                                                <div className={styles.moduleBadge}>
                                                    <ModuleIcon size={12} />
                                                    {log.module}
                                                </div>
                                            </td>
                                            <td className={styles.targetCell}>
                                                <ArrowRight size={14} />
                                                <span>{log.target}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className={styles.ipText}>{log.ip_address}</div>
                                                <div className={styles.idText}>{log.id}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── DETAIL PANEL ────────────────────────────── */}
                    {selectedLog && (
                        <div className={styles.detailsPanel}>
                            <div className={styles.detailHeader}>
                                <div className={styles.detailTitle}>
                                    <Info size={16} />
                                    <span>Detailed Event Analysis</span>
                                </div>
                                <div className={styles.logIdBadge}>{selectedLog.id}</div>
                            </div>
                            <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                    <label><Monitor size={12} /> Environment</label>
                                    <p>{selectedLog.user_agent}</p>
                                </div>
                                <div className={styles.detailItem}>
                                    <label><Globe size={12} /> Network Origin</label>
                                    <p>{selectedLog.ip_address} (Static IP)</p>
                                </div>
                                <div className={styles.detailItem}>
                                    <label><MousePointer2 size={12} /> Activity Payload</label>
                                    <p>{selectedLog.details}</p>
                                </div>
                            </div>
                            <div className={styles.detailFooter}>
                                <KitchenButton variant="secondary" size="sm">Verify Hash</KitchenButton>
                                <KitchenButton variant="secondary" size="sm">Compare Version</KitchenButton>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.syncStatus}>
                        <RefreshCcw size={12} className={styles.spin} />
                        Live Ledger Sync Active
                    </div>
                    <span>Showing {filteredLogs.length} of {MOCK_LOGS.length} entries</span>
                </div>
            </div>
        </div>
    );
}

