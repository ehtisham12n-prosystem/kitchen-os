import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import styles from './AuditLogList.module.css';
import { platformApi } from '../../api/api';
import {
    Search,
    Filter,
    Download,
    RefreshCw,
    ChevronRight,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Clock,
    LayoutGrid,
    ArrowUpDown,
    Globe,
    Loader2,
    Copy,
    CheckCheck,
    Shield,
    Activity,
    FileText,
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

const ConsoleAuditLogList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(0);
    const [filterPortal, setFilterPortal] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<{ total?: number; success_count?: number; warning_count?: number; error_count?: number; write_count?: number } | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [copiedSection, setCopiedSection] = useState<'details' | 'diff' | 'meta' | null>(null);
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

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const securityEvents = (summary?.warning_count || 0) + (summary?.error_count || 0);
    const successRate = (summary?.total || 0) > 0 ? Math.round(((summary?.success_count || 0) / (summary?.total || 1)) * 100) : 0;
    const writeEvents = summary?.write_count || 0;

    const rangeText = useMemo(() => {
        if (total === 0) return 'Showing 0 results';
        const start = page * pageSize + 1;
        const end = Math.min(total, (page + 1) * pageSize);
        return `Showing ${start}-${end} of ${total}`;
    }, [page, pageSize, total]);

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return styles.statusCompleted;
            case 'warning': return styles.statusPending;
            case 'error': return styles.statusFlagged;
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

    const exportCsv = () => {
        const header = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Portal', 'IP Address', 'Status', 'Details'];
        const lines = logs.map((log) => [
            log.timestamp,
            log.UserManagementName || 'System',
            log.UserManagementRole || '',
            log.action,
            log.entity,
            log.portal,
            log.ipAddress || '',
            log.status,
            log.details || '',
        ]);
        const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const copyText = async (value: string, section: 'details' | 'diff' | 'meta') => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedSection(section);
            window.setTimeout(() => setCopiedSection(null), 1200);
        } catch {
            // no-op
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Operation Logs</h1>
                    <p className={styles.subtitle}>Live audit history for console, branch, security, and transactional activity.</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn} onClick={exportCsv} disabled={loading || logs.length === 0}>
                        <Download size={16} />
                        Export
                    </button>
                    <button className={styles.primaryBtn} onClick={() => void fetchLogs()} disabled={loading}>
                        {loading ? <Loader2 size={16} className={styles.spinIcon} /> : <RefreshCw size={16} />}
                        Refresh
                    </button>
                </div>
            </header>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statMain}>
                        <div className={styles.statLabel}>Audit Trail</div>
                        <div className={styles.statValue}>{total.toLocaleString()}</div>
                    </div>
                    <div className={`${styles.iconBox} ${styles.neutral}`}><Activity size={18} /></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statMain}>
                        <div className={styles.statLabel}>Security Alerts</div>
                        <div className={styles.statValue}>{securityEvents}</div>
                    </div>
                    <div className={`${styles.iconBox} ${securityEvents > 0 ? styles.danger : styles.neutral}`}><Shield size={18} /></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statMain}>
                        <div className={styles.statLabel}>Success Rate</div>
                        <div className={styles.statValue}>{successRate}%</div>
                    </div>
                    <div className={`${styles.iconBox} ${styles.neutral}`}><CheckCircle2 size={18} /></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statMain}>
                        <div className={styles.statLabel}>Write Events</div>
                        <div className={styles.statValue}>{writeEvents}</div>
                    </div>
                    <div className={`${styles.iconBox} ${styles.neutral}`}><FileText size={18} /></div>
                </div>
            </div>

            <div className={styles.tablePanel}>
                <div className={styles.tableHead}>
                    <div className={styles.searchBox}>
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Filter by user, action, entity, path..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.tableFilters}>
                        <div className={styles.filterGroup}>
                            <LayoutGrid size={16} />
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={styles.filterSelect}>
                                <option value={10}>10 per page</option>
                                <option value={25}>25 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <Globe size={16} />
                            <select value={filterPortal} onChange={(e) => setFilterPortal(e.target.value)} className={styles.filterSelect}>
                                <option value="all">All portals</option>
                                <option value="console">Console</option>
                                <option value="terminal">Terminal</option>
                                <option value="nexus">Nexus</option>
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <Filter size={16} />
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={styles.filterSelect}>
                                <option value="all">All statuses</option>
                                <option value="success">Success</option>
                                <option value="warning">Warning</option>
                                <option value="error">Error</option>
                            </select>
                        </div>
                        <div className={styles.filterBtn}>
                            <Calendar size={14} />
                            Live scope
                        </div>
                    </div>
                </div>

                <div className={styles.tableFooter}>
                    <span>{rangeText}</span>
                    <div className={styles.paging}>
                        <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button>
                        <button className={styles.activePage}>{page + 1}</button>
                        <button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
                    </div>
                </div>

                <div className={styles.tableScroll}>
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
                            <p>No audit logs found.</p>
                        </div>
                    )}
                    {!loading && !error && logs.length > 0 && (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>DateTime <ArrowUpDown size={14} /></th>
                                    <th>Operator</th>
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
                                        <tr key={log.id}>
                                            <td className={styles.dateTimeCol}>
                                                <div className={styles.dateText}>{date}</div>
                                                <div className={styles.timeText}>{time}</div>
                                            </td>
                                            <td>
                                                <div className={styles.operator}>
                                                    <div className={styles.smallAvatar}>{(log.UserManagementName || 'S').charAt(0).toUpperCase()}</div>
                                                    <div>
                                                        <div>{log.UserManagementName || 'System'}</div>
                                                        <div className={styles.timeText}>{log.UserManagementRole || '—'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={styles.actionTag}>{log.action}</span></td>
                                            <td className={styles.detailsCol}>{log.entity}</td>
                                            <td><div className={styles.branchTag}>{log.portal}</div></td>
                                            <td>{log.ipAddress || '—'}</td>
                                            <td>
                                                <div className={`${styles.badge} ${getStatusColor(log.status)}`}>
                                                    {log.status === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                                                    {log.status.toUpperCase()}
                                                </div>
                                            </td>
                                            <td>
                                                <button className={styles.rowAction} onClick={() => void openLogDetail(log)}>
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

                <footer className={styles.tableFooter}>
                    <span>{rangeText}</span>
                    <div className={styles.paging}>
                        <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button>
                        <button className={styles.activePage}>{page + 1}</button>
                        <button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
                    </div>
                </footer>
            </div>

            {selectedLog && (
                <div className={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleArea}>
                                <h2>Audit Details</h2>
                                <span className={styles.logIdBadge}>{selectedLog.id}</span>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedLog(null)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            {detailLoading ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <Loader2 size={24} className={styles.spinIcon} />
                                </div>
                            ) : (
                                <>
                                    <div className={styles.detailGrid}>
                                        <div className={styles.detailItem}>
                                            <label>Timestamp</label>
                                            <div className={styles.detailValue}><Clock size={14} /> {selectedLog.timestamp}</div>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>Action</label>
                                            <span className={styles.actionTag}>{selectedLog.action}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>Portal</label>
                                            <div className={styles.detailValue}><Globe size={14} /> {selectedLog.portal}</div>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>Status</label>
                                            <div className={`${styles.badge} ${getStatusColor(selectedLog.status)}`}>{selectedLog.status.toUpperCase()}</div>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>Entity</label>
                                            <div className={styles.detailValue}>{selectedLog.entity}</div>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <label>IP Address</label>
                                            <div className={styles.detailValue}>{selectedLog.ipAddress || '—'}</div>
                                        </div>
                                    </div>

                                    <div className={styles.detailSection}>
                                        <label>Operator</label>
                                        <div className={styles.operatorPlate}>
                                            <div className={styles.largeAvatar}>{(selectedLog.UserManagementName || 'S').charAt(0).toUpperCase()}</div>
                                            <div className={styles.operatorInfo}>
                                                <strong>{selectedLog.UserManagementName || 'System'}</strong>
                                                <span>{selectedLog.UserManagementRole || '—'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.detailSection}>
                                        <label>Details</label>
                                        <div className={styles.descriptionBox}>{selectedLog.details || 'No details available.'}</div>
                                        <button className={styles.modalActionBtn} onClick={() => void copyText(selectedLog.details || '', 'details')}>
                                            {copiedSection === 'details' ? <CheckCheck size={14} /> : <Copy size={14} />}
                                            Copy Details
                                        </button>
                                    </div>

                                    {selectedLog.diffJson && (
                                        <div className={styles.detailSection}>
                                            <label>Change Diff</label>
                                            <div className={styles.jsonPreview}><pre>{selectedLog.diffJson}</pre></div>
                                            <button className={styles.modalActionBtn} onClick={() => void copyText(selectedLog.diffJson || '', 'diff')}>
                                                {copiedSection === 'diff' ? <CheckCheck size={14} /> : <Copy size={14} />}
                                                Copy Diff
                                            </button>
                                        </div>
                                    )}

                                    {selectedLog.metadataJson && (
                                        <div className={styles.detailSection}>
                                            <label>Metadata</label>
                                            <div className={styles.jsonPreview}><pre>{selectedLog.metadataJson}</pre></div>
                                            <button className={styles.modalActionBtn} onClick={() => void copyText(selectedLog.metadataJson || '', 'meta')}>
                                                {copiedSection === 'meta' ? <CheckCheck size={14} /> : <Copy size={14} />}
                                                Copy Metadata
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsoleAuditLogList;

