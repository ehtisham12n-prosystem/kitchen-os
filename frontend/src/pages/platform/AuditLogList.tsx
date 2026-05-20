import React, { useCallback, useDeferredValue, useEffect, useState } from 'react';
import styles from './AuditLogList.module.css';
import { platformApi } from '../../api/api';
import {
    Search,
    Filter,
    Download,
    RefreshCw,
    Clock,
    Shield,
    Activity,
    ChevronRight,
    ArrowUpDown,
    AlertCircle,
    CheckCircle2,
    Info,
    LayoutGrid,
    Calendar,
    TrendingUp,
    Globe,
    Loader2,
    Monitor,
    Cpu,
    MousePointer2,
    Smartphone,
    Network,
    FileText,
    ArrowLeftRight,
    Copy,
    CheckCheck,
} from 'lucide-react';

interface AuditLog {
    id: string;
    timestamp: string;
    UserManagementName: string;
    UserManagementRole: string;
    action: string;
    entity: string;
    portal: 'Nexus' | 'Console' | 'Terminal';
    ipAddress: string;
    status: 'success' | 'warning' | 'error';
    details: string;
    diffJson?: string;
    metadataJson?: string;
    actorType?: string | null;
    clientId?: string | null;
    branchId?: number | null;
    entityId?: string | null;
    requestMethod?: string | null;
    requestPath?: string | null;
}

const AuditLogList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPortal, setFilterPortal] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(0);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<{ total?: number; success_count?: number; warning_count?: number; error_count?: number } | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const deferredSearchTerm = useDeferredValue(searchTerm.trim());

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await platformApi.getAuditLogs({
                limit: pageSize,
                offset: page * pageSize,
                search: deferredSearchTerm || undefined,
                portal: filterPortal !== 'all' ? (filterPortal.charAt(0).toUpperCase() + filterPortal.slice(1)) : undefined,
                status: filterStatus !== 'all' ? filterStatus : undefined,
            });
            setLogs(data.items ?? []);
            setTotal(data.total ?? 0);
            setSummary(data.summary ?? null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [deferredSearchTerm, filterPortal, filterStatus, page, pageSize]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(0);
    }, [deferredSearchTerm, filterPortal, filterStatus, pageSize]);

    const totalPages = Math.ceil(total / pageSize);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle2 size={16} className={styles.statusSuccess} />;
            case 'warning': return <AlertCircle size={16} className={styles.statusWarning} />;
            case 'error': return <AlertCircle size={16} className={styles.statusError} />;
            default: return <Info size={16} />;
        }
    };

    const getPortalColor = (portal: string) => {
        switch (portal) {
            case 'Nexus': return styles.portalNexus;
            case 'Console': return styles.portalConsole;
            case 'Terminal': return styles.portalTerminal;
            default: return '';
        }
    };

    const formatTimestamp = (ts: string) => {
        const d = new Date(ts);
        return {
            date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
    };

    const securityEvents = (summary?.warning_count || 0) + (summary?.error_count || 0);
    const successRate = (summary?.total || 0) > 0 ? Math.round(((summary?.success_count || 0) / (summary?.total || 1)) * 100) : 0;

    const openLogDetail = async (log: AuditLog) => {
        setSelectedLog(log);
        setDetailLoading(true);
        try {
            const detail = await platformApi.getAuditLog(log.id);
            setSelectedLog(detail);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load audit log detail');
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>System Audit Log</h1>
                    <p className={styles.subtitle}>Track every action, change, and access across the entire platform</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionButton}>
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                    <button className={`${styles.actionButton} ${styles.primaryButton}`} onClick={() => void fetchLogs()} disabled={loading}>
                        {loading ? <Loader2 size={18} className={styles.spinIcon} /> : <RefreshCw size={18} />}
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            {/* ── KPI Row ── */}
            <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}><Activity size={18} /></div>
                            <div className={styles.kpiLabel}>Total Logs</div>
                        </div>
                        <span className={`${styles.trendBadge} ${styles.trendUp}`}>
                            <TrendingUp size={12} /> Live
                        </span>
                    </div>
                    <div className={styles.kpiValue}>{total.toLocaleString()}</div>
                    <div className={styles.kpiMeta}><span>All tracked platform events</span></div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '85%' }} />
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}><Shield size={18} /></div>
                            <div className={styles.kpiLabel}>Security Events</div>
                        </div>
                        <span className={`${styles.trendBadge} ${securityEvents > 0 ? styles.trendDown : styles.trendUp}`}>
                            {securityEvents > 0 ? 'Alert' : 'Clear'}
                        </span>
                    </div>
                    <div className={styles.kpiValue}>{securityEvents}</div>
                    <div className={styles.kpiMeta}><span>Warnings + errors detected</span></div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${(summary?.total || 0) > 0 ? (securityEvents / (summary?.total || 1)) * 100 : 0}%` }} />
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}><Globe size={18} /></div>
                            <div className={styles.kpiLabel}>Success Rate</div>
                        </div>
                        <span className={`${styles.trendBadge} ${styles.trendUp}`}>Healthy</span>
                    </div>
                    <div className={styles.kpiValue}>{successRate}%</div>
                    <div className={styles.kpiMeta}><span>Successful operations ratio</span></div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: `${successRate}%` }} />
                    </div>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.searchWrapper}>
                    <Search size={18} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by user, action or entity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.filters}>
                    <div className={styles.filterGroup}>
                        <LayoutGrid size={16} />
                        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className={styles.filterSelect}>
                            <option value={10}>10 records</option>
                            <option value={25}>25 records</option>
                            <option value={50}>50 records</option>
                            <option value={100}>100 records</option>
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <Filter size={16} />
                        <select value={filterPortal} onChange={(e) => setFilterPortal(e.target.value)} className={styles.filterSelect}>
                            <option value="all">All Portals</option>
                            <option value="nexus">Nexus</option>
                            <option value="console">Console</option>
                            <option value="terminal">Terminal</option>
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <Clock size={16} />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={styles.filterSelect}>
                            <option value="all">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                {error && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <AlertCircle size={24} style={{ marginBottom: '0.5rem' }} />
                        <p>Failed to load audit logs: {error}</p>
                    </div>
                )}
                {loading && !error && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Loader2 size={32} className={styles.spinIcon} />
                        <p style={{ marginTop: '1rem' }}>Loading audit logs...</p>
                    </div>
                )}
                {!loading && !error && logs.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Activity size={32} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                        <p>No audit logs found{deferredSearchTerm ? ' matching your search' : ''}.</p>
                    </div>
                )}
                {!loading && !error && logs.length > 0 && (
                    <table className={styles.logTable}>
                        <thead>
                            <tr>
                                <th>DateTime <ArrowUpDown size={14} /></th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Portal</th>
                                <th>IP Address</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => {
                                const { date, time } = formatTimestamp(log.timestamp);
                                return (
                                    <tr key={log.id} className={styles.logRow}>
                                        <td className={styles.timeCell}>
                                            <div className={styles.timestampContainer}>
                                                <span className={styles.datePart}>{date}</span>
                                                <span className={styles.timePart}>{time}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.userCell}>
                                                <div className={styles.userAvatar}>
                                                    {(log.UserManagementName || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <div className={styles.userInfo}>
                                                    <span className={styles.userName}>{log.UserManagementName || 'System'}</span>
                                                    <span className={styles.userRole}>{log.UserManagementRole || '—'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={styles.actionCell}>
                                            <span className={styles.actionText}>{log.action}</span>
                                        </td>
                                        <td className={styles.entityCell}>
                                            <span className={styles.entityTag}>{log.entity}</span>
                                        </td>
                                        <td>
                                            <span className={`${styles.portalTag} ${getPortalColor(log.portal)}`}>
                                                {log.portal}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.ipWrapper}>
                                                <Globe size={14} />
                                                <span>{log.ipAddress || '—'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`${styles.statusBadge} ${styles[log.status]}`}>
                                                {getStatusIcon(log.status)}
                                                <span>{log.status.toUpperCase()}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                className={styles.detailsBtn}
                                                title="View Details"
                                                onClick={() => void openLogDetail(log)}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className={styles.pagination}>
                <span className={styles.pageInfo}>
                    Showing {logs.length > 0 ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} of {total} entries
                </span>
                <div className={styles.pageControls}>
                    <button className={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                        return (
                            <button
                                key={p}
                                className={`${styles.pageBtn} ${p === page ? styles.activePage : ''}`}
                                onClick={() => setPage(p)}
                            >
                                {p + 1}
                            </button>
                        );
                    })}
                    <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            </div>

            {selectedLog && (
                <AuditDetailModal
                    log={selectedLog}
                    loading={detailLoading}
                    onClose={() => setSelectedLog(null)}
                    getPortalColor={getPortalColor}
                    getStatusIcon={getStatusIcon}
                />
            )}
        </div>
    );
};

// ─── Human-readable metadata label map ───────────────────────────────────────
const META_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
    browser: { label: 'Browser', icon: <Monitor size={15} />, description: 'The web browser used to perform this action.' },
    os: { label: 'Operating System', icon: <Cpu size={15} />, description: 'The operating system on the device used.' },
    method: { label: 'HTTP Method', icon: <ArrowLeftRight size={15} />, description: 'The type of request sent — POST adds data, PUT updates, DELETE removes.' },
    device: { label: 'Device', icon: <Smartphone size={15} />, description: 'The device or machine where the action was taken.' },
    ip: { label: 'IP Address', icon: <Network size={15} />, description: 'The network address of the device that performed this action.' },
    endpoint: { label: 'API Endpoint', icon: <FileText size={15} />, description: 'The specific backend URL that was called.' },
    version: { label: 'App Version', icon: <Activity size={15} />, description: 'The version of the application running at the time.' },
    module: { label: 'Module', icon: <MousePointer2 size={15} />, description: 'The feature or section of the app that triggered this event.' },
};

// ─── Audit Detail Modal ───────────────────────────────────────────────────────
interface ModalProps {
    log: AuditLog;
    loading: boolean;
    onClose: () => void;
    getPortalColor: (p: string) => string;
    getStatusIcon: (s: string) => React.ReactNode;
}

function AuditDetailModal({ log, loading, onClose, getPortalColor, getStatusIcon }: ModalProps) {
    const [copied, setCopied] = React.useState(false);
    const meta = (() => { try { return log.metadataJson ? JSON.parse(log.metadataJson) : null; } catch { return null; } })();
    const diff = (() => { try { return log.diffJson ? JSON.parse(log.diffJson) : null; } catch { return null; } })();

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(log, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusClass = log.status === 'success' ? styles.modalStatusSuccess
        : log.status === 'warning' ? styles.modalStatusWarning
            : styles.modalStatusError;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                {/* ── Hero Header ── */}
                <div className={`${styles.modalHero} ${statusClass}`}>
                    <div className={styles.modalHeroLeft}>
                        <div className={styles.modalHeroAvatar}>
                            {(log.UserManagementName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.modalHeroInfo}>
                            <span className={styles.modalHeroName}>{log.UserManagementName || 'System'}</span>
                            <span className={styles.modalHeroRole}>{log.UserManagementRole || 'Unknown Role'}</span>
                        </div>
                    </div>
                    <div className={styles.modalHeroRight}>
                        <div className={`${styles.modalStatusPill} ${statusClass}`}>
                            {getStatusIcon(log.status)}
                            <span>{log.status.toUpperCase()}</span>
                        </div>
                        <span className={styles.logIdBadge}>
                            {loading ? 'LOADING' : `#${log.id.slice(0, 8).toUpperCase()}`}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>

                    {/* ── Summary Strip ── */}
                    <div className={styles.summaryStrip}>
                        <div className={styles.summaryItem}>
                            <Calendar size={14} />
                            <div>
                                <span className={styles.summaryLabel}>When</span>
                                <span className={styles.summaryValue}>{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className={styles.summaryDivider} />
                        <div className={styles.summaryItem}>
                            <Globe size={14} />
                            <div>
                                <span className={styles.summaryLabel}>From IP</span>
                                <span className={styles.summaryValue}>{log.ipAddress || '—'}</span>
                            </div>
                        </div>
                        <div className={styles.summaryDivider} />
                        <div className={styles.summaryItem}>
                            <Shield size={14} />
                            <div>
                                <span className={styles.summaryLabel}>Portal</span>
                                <span className={`${styles.portalTag} ${getPortalColor(log.portal)}`}>{log.portal}</span>
                            </div>
                        </div>
                        <div className={styles.summaryDivider} />
                        <div className={styles.summaryItem}>
                            <Activity size={14} />
                            <div>
                                <span className={styles.summaryLabel}>Resource</span>
                                <span className={styles.summaryValue}>{log.entity}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── What Happened ── */}
                    <div className={styles.modalSection}>
                        <div className={styles.modalSectionHeader}>
                            <MousePointer2 size={15} />
                            <span>What Happened</span>
                        </div>
                        <div className={styles.actionCard}>
                            <span className={styles.actionCardVerb}>{log.action}</span>
                            {log.details && (
                                <p className={styles.actionCardDetail}>{log.details}</p>
                            )}
                        </div>
                    </div>

                    {/* ── What Changed (diff) ── */}
                    {diff && diff.length > 0 && (
                        <div className={styles.modalSection}>
                            <div className={styles.modalSectionHeader}>
                                <ArrowLeftRight size={15} />
                                <span>What Changed</span>
                                <span className={styles.sectionHint}>Exact fields that were modified in this action</span>
                            </div>
                            <div className={styles.diffViewer}>
                                <table className={styles.diffTable}>
                                    <thead>
                                        <tr>
                                            <th>Field</th>
                                            <th>Before</th>
                                            <th>After</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diff.map((d: { field: string; oldValue: unknown; newValue: unknown }, i: number) => (
                                            <tr key={i}>
                                                <td className={styles.diffField}>{d.field}</td>
                                                <td className={styles.diffOld}>{JSON.stringify(d.oldValue)}</td>
                                                <td className={styles.diffNew}>{JSON.stringify(d.newValue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Session & Device Context ── */}
                    {meta && (
                        <div className={styles.modalSection}>
                            <div className={styles.modalSectionHeader}>
                                <Monitor size={15} />
                                <span>Session & Device Context</span>
                                <span className={styles.sectionHint}>Technical details about where and how this action was performed</span>
                            </div>
                            <div className={styles.metaCardGrid}>
                                {Object.entries(meta).map(([key, value]) => {
                                    const def = META_LABELS[key.toLowerCase()] ?? {
                                        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                                        icon: <FileText size={15} />,
                                        description: 'Additional technical information recorded at the time of this event.',
                                    };
                                    return (
                                        <div key={key} className={styles.metaCard}>
                                            <div className={styles.metaCardIcon}>{def.icon}</div>
                                            <div className={styles.metaCardBody}>
                                                <span className={styles.metaCardLabel}>{def.label}</span>
                                                <span className={styles.metaCardValue}>{String(value)}</span>
                                                <span className={styles.metaCardDesc}>{def.description}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* ── Footer ── */}
                <div className={styles.modalFooter}>
                    <span className={styles.modalFooterNote}>Record ID: {log.id}</span>
                    <button className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ''}`} onClick={handleCopy}>
                        {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                        {copied ? 'Copied!' : 'Copy raw JSON'}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default AuditLogList;
