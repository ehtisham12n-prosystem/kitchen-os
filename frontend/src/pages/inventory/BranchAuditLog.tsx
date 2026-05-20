import React, { useState } from 'react';
import styles from './BranchAuditLog.module.css';
import {
    Search,
    Download,
    Terminal,
    Package,
    ChevronRight,
    AlertCircle,
    Calendar,
    LayoutGrid,
    Clock,
    ClipboardList,
    Printer,
    ArrowUpDown
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid
} from 'recharts';

interface BranchLog {
    id: string;
    timestamp: string;
    user: string;
    station: string;
    action: string;
    details: string;
    status: 'active' | 'resolved' | 'critical';
}

const MOCK_BRANCH_LOGS: BranchLog[] = [
    {
        id: 'BR-881',
        timestamp: '2026-02-24 16:10:05',
        user: 'Ali Raza',
        station: 'POS-01',
        action: 'Void Item',
        details: 'Voided "Margarita Pizza" from Order #992',
        status: 'active'
    },
    {
        id: 'BR-880',
        timestamp: '2026-02-24 15:45:22',
        user: 'Sana W.',
        station: 'Kitchen-KDS',
        action: 'Stock Out',
        details: 'Marked "Fresh Cream" as out of stock',
        status: 'critical'
    },
    {
        id: 'BR-879',
        timestamp: '2026-02-24 15:20:11',
        user: 'Ali Raza',
        station: 'POS-01',
        action: 'Cash Drop',
        details: 'Shift cash drop of PKR 15,000',
        status: 'active'
    },
    {
        id: 'BR-878',
        timestamp: '2026-02-24 14:05:30',
        user: 'Manager John',
        station: 'Backoffice',
        action: 'Inventory Audit',
        details: 'Physical count discrepancy: -2 units of Beef Patty',
        status: 'resolved'
    }
];

const HOURLY_OPS = [
    { hour: '12pm', count: 4 },
    { hour: '1pm', count: 12 },
    { hour: '2pm', count: 18 },
    { hour: '3pm', count: 8 },
    { hour: '4pm', count: 24 },
    { hour: '5pm', count: 32 },
];

const BranchAuditLog: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [selectedLog, setSelectedLog] = useState<BranchLog | null>(null);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'active': return styles.statusActive;
            case 'resolved': return styles.statusResolved;
            case 'critical': return styles.statusCritical;
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Branch Operations Log</h1>
                    <p className={styles.subtitle}>Localized activity tracking for this branch and its stations</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary}>
                        <Download size={18} />
                        Export Local Log
                    </button>
                </div>
            </header>

            <div className={styles.dashboard}>
                <div className={styles.mainStat}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Internal Operations (Today)</span>
                        <span className={styles.statValue}>142</span>
                    </div>
                    <div className={styles.miniChart}>
                        <ResponsiveContainer width="100%" height={100}>
                            <LineChart data={HOURLY_OPS}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <Line type="monotone" dataKey="count" stroke="var(--accent-tertiary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-tertiary)' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={styles.alertPanel}>
                    <div className={styles.alertItem}>
                        <div className={styles.alertIcon}><AlertCircle size={20} /></div>
                        <div className={styles.alertContent}>
                            <span className={styles.alertTitle}>2 High-Value Voids</span>
                            <p>Requires manager sign-off</p>
                        </div>
                    </div>
                    <div className={styles.alertItem}>
                        <div className={styles.alertIcon}><Package size={20} /></div>
                        <div className={styles.alertContent}>
                            <span className={styles.alertTitle}>Inventory Variance</span>
                            <p>Resolved by Manager John</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.logContainer}>
                <div className={styles.logHeader}>
                    <div className={styles.searchBar}>
                        <Search size={18} />
                        <input
                            placeholder="Search logs by staff or action..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.logFilters}>
                        <div className={styles.filterGroup}>
                            <LayoutGrid size={16} />
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className={styles.recordSelect}
                            >
                                <option value={10}>10 records</option>
                                <option value={20}>20 records</option>
                                <option value={50}>50 records</option>
                            </select>
                        </div>
                        <button className={styles.filterBtn}><Terminal size={16} /> Stations</button>
                        <button className={styles.filterBtn}><Calendar size={16} /> Today</button>
                    </div>
                </div>

                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>DateTime <ArrowUpDown size={14} /></th>
                                <th>Staff Member</th>
                                <th>Station</th>
                                <th>Action</th>
                                <th>Summary</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_BRANCH_LOGS.map(log => (
                                <tr key={log.id}>
                                    <td className={styles.dateTimeCell}>
                                        <div className={styles.dateVal}>{log.timestamp.split(' ')[0]}</div>
                                        <div className={styles.timeVal}>{log.timestamp.split(' ')[1]}</div>
                                    </td>
                                    <td>
                                        <div className={styles.staff}>
                                            <div className={styles.avatar}>{log.user.charAt(0)}</div>
                                            {log.user}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.stationTag}>
                                            <Terminal size={12} />
                                            {log.station}
                                        </span>
                                    </td>
                                    <td className={styles.actionCol}>{log.action}</td>
                                    <td className={styles.detailsCol}>{log.details}</td>
                                    <td>
                                        <div className={`${styles.statusPill} ${getStatusStyle(log.status)}`}>
                                            {log.status.toUpperCase()}
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className={styles.tableFooter}>
                    <span>Showing 1-{pageSize} of 142 records</span>
                    <div className={styles.pagination}>
                        <button disabled>Prev</button>
                        <button className={styles.activePage}>1</button>
                        <button>Next</button>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleArea}>
                                <h2>Operation Details</h2>
                                <span className={styles.logId}>LOG #{selectedLog.id}</span>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedLog(null)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.quickDetails}>
                                <div className={styles.qItem}>
                                    <label>Timestamp</label>
                                    <div className={styles.qVal}><Clock size={14} /> {selectedLog.timestamp}</div>
                                </div>
                                <div className={styles.qItem}>
                                    <label>Terminal Status</label>
                                    <div className={`${styles.statusPill} ${getStatusStyle(selectedLog.status)}`}>
                                        {selectedLog.status.toUpperCase()}
                                    </div>
                                </div>
                                <div className={styles.qItem}>
                                    <label>Terminal/POS</label>
                                    <div className={styles.qVal}><Terminal size={14} /> {selectedLog.station}</div>
                                </div>
                                <div className={styles.qItem}>
                                    <label>Action Category</label>
                                    <div className={styles.qVal}><ClipboardList size={14} /> {selectedLog.action}</div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <label>Staff Responsible</label>
                                <div className={styles.staffCard}>
                                    <div className={styles.largeAvatar}>{selectedLog.user.charAt(0)}</div>
                                    <div className={styles.staffInfo}>
                                        <strong>{selectedLog.user}</strong>
                                        <span>Duty Shift: Evening (16:00 - 24:00)</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <label>Full Description</label>
                                <div className={styles.descriptionBox}>
                                    {selectedLog.details}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <label>Hardware/Device Context</label>
                                <div className={styles.jsonBox}>
                                    <pre>
                                        {JSON.stringify({
                                            station_id: selectedLog.station,
                                            mac_address: "00:1A:2B:3C:4D:5E",
                                            ip_local: "10.0.0.12",
                                            last_sync: "2026-02-24 16:15:00",
                                            offline_mode: false,
                                            pos_version: "v4.2.1-stable"
                                        }, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button className={styles.printBtn}><Printer size={16} /> Print Ticket</button>
                                <button className={styles.closeActionBtn} onClick={() => setSelectedLog(null)}>Dismiss</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchAuditLog;

