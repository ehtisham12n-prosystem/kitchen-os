/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Search,
    UserCheck,
    UserX,
    Users,
    X,
} from 'lucide-react';
import { attendanceApi, branchApi, setupApi } from '../../api/api';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './Attendance.module.css';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'off_duty';

type AttendanceRow = {
    id: number;
    date: string;
    status: AttendanceStatus;
    check_in: string | null;
    check_out: string | null;
    total_hours: string;
    comments?: string | null;
    staff: {
        id: number;
        employee_id?: string | null;
        full_name: string;
        designation?: string | null;
        department?: string | null;
    };
    branch?: {
        id: number;
        branch_name: string;
    } | null;
};

type RosterRow = {
    id: number;
    employee_id?: string | null;
    full_name: string;
    designation?: string | null;
    employment_type?: string | null;
    branch_id?: number | null;
    branch_name?: string | null;
};

type MonthlyAttendanceRow = {
    staffId: number;
    employeeId: string;
    fullName: string;
    designation: string;
    branchName: string;
    dayStatuses: Record<string, AttendanceStatus | null>;
    totals: Record<AttendanceStatus, number>;
};

type AttendanceLockRow = {
    id: number;
    branch_id: number | null;
    branch_name: string;
    date_from: string;
    date_to: string;
    locked_by: number;
    reason?: string | null;
};

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'late', 'absent', 'leave', 'off_duty'];
const STATUS_LABELS: Record<AttendanceStatus, string> = {
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    leave: 'Leave',
    off_duty: 'Off Duty',
};
const STATUS_SHORT_LABELS: Record<AttendanceStatus, string> = {
    present: 'P',
    late: 'L',
    absent: 'A',
    leave: 'LV',
    off_duty: 'OD',
};

const formatHours = (value: string) => `${Number(value || 0).toFixed(1)}h`;
const getMonthValue = (date: string) => date.slice(0, 7);

const getMonthBounds = (month: string) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0);
    return {
        dateFrom: start.toISOString().slice(0, 10),
        dateTo: end.toISOString().slice(0, 10),
    };
};

const buildMonthDays = (month: string) => {
    const { dateFrom, dateTo } = getMonthBounds(month);
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const days: Array<{ key: string; dayNumber: string; weekday: string; isWeekend: boolean }> = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const current = new Date(cursor);
        const weekdayIndex = current.getDay();
        days.push({
            key: current.toISOString().slice(0, 10),
            dayNumber: current.toISOString().slice(8, 10),
            weekday: current.toLocaleDateString(undefined, { weekday: 'short' }),
            isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
        });
    }
    return days;
};

const buildDateRangeDays = (dateFrom: string, dateTo: string) => {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const days: Array<{ key: string; dayNumber: string; weekday: string; isWeekend: boolean }> = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const current = new Date(cursor);
        const weekdayIndex = current.getDay();
        days.push({
            key: current.toISOString().slice(0, 10),
            dayNumber: current.toISOString().slice(8, 10),
            weekday: current.toLocaleDateString(undefined, { weekday: 'short' }),
            isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
        });
    }
    return days;
};

const isDateCoveredByLock = (
    lock: AttendanceLockRow,
    branchScope: string,
    attendanceDate: string,
) => {
    const branchMatches = branchScope === 'all'
        ? lock.branch_id == null
        : lock.branch_id == null || String(lock.branch_id) === String(branchScope);
    return branchMatches && lock.date_from <= attendanceDate && lock.date_to >= attendanceDate;
};

export function Attendance() {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = getMonthValue(today);
    const { canMarkAttendance } = usePermissionAccess();
    const [branches, setBranches] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [rows, setRows] = useState<AttendanceRow[]>([]);
    const [summary, setSummary] = useState({ total: 0, present: 0, late: 0, absent: 0, leave: 0, off_duty: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [roster, setRoster] = useState<RosterRow[]>([]);
    const [locks, setLocks] = useState<AttendanceLockRow[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocking, setIsLocking] = useState(false);
    const [filters, setFilters] = useState({
        branch: localStorage.getItem('branch_id') || 'all',
        department: 'all',
        search: '',
        dateFrom: today,
        dateTo: today,
    });
    const [viewMode, setViewMode] = useState<'day' | 'month' | 'custom'>('day');
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [markingDate, setMarkingDate] = useState(today);
    const [markingStatus, setMarkingStatus] = useState<Record<number, AttendanceStatus>>({});
    const [markingComments, setMarkingComments] = useState<Record<number, string>>({});

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [branchRows, departmentRows, attendanceResponse] = await Promise.all([
                branchApi.getBranches(),
                setupApi.getDepartments(),
                attendanceApi.getLogs({
                    branch_id: filters.branch === 'all' ? undefined : filters.branch,
                    department_id: filters.department === 'all' ? undefined : filters.department,
                    date_from: filters.dateFrom,
                    date_to: filters.dateTo,
                    search: filters.search || undefined,
                }),
            ]);
            setBranches(branchRows || []);
            setDepartments(departmentRows || []);
            setRows(attendanceResponse?.rows || []);
            setSummary(attendanceResponse?.summary || { total: 0, present: 0, late: 0, absent: 0, leave: 0, off_duty: 0 });
            setLocks(attendanceResponse?.locks || []);
        } catch (error: any) {
            toast.error('Attendance Load Failed', error?.message || 'Could not load attendance.');
        } finally {
            setIsLoading(false);
        }
    }, [filters.branch, filters.dateFrom, filters.dateTo, filters.department, filters.search]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openModal = async () => {
        if (isScopeLocked) {
            toast.error('Attendance Locked', 'Attendance is locked for the selected branch scope and date range.');
            return;
        }
        try {
            const rosterRows = await attendanceApi.getRoster(filters.branch === 'all' ? undefined : filters.branch);
            setRoster(rosterRows || []);
            const defaultStatuses = Object.fromEntries((rosterRows || []).map((staff: RosterRow) => [staff.id, 'present'])) as Record<number, AttendanceStatus>;
            setMarkingStatus(defaultStatuses);
            setMarkingComments({});
            setMarkingDate(filters.dateFrom || today);
            setIsModalOpen(true);
        } catch (error: any) {
            toast.error('Attendance Roster Failed', error?.message || 'Could not load staff roster.');
        }
    };

    const exportCsv = () => {
        const header = ['Date', 'Employee ID', 'Name', 'Branch', 'Department', 'Designation', 'Status', 'Hours'];
        const lines = rows.map((row) => [
            row.date,
            row.staff.employee_id || '',
            row.staff.full_name,
            row.branch?.branch_name || '',
            row.staff.department || '',
            row.staff.designation || '',
            row.status,
            formatHours(row.total_hours),
        ]);
        const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance-${filters.dateFrom}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const saveAttendance = async () => {
        setIsSaving(true);
        try {
            await attendanceApi.markAttendance({
                date: markingDate,
                entries: roster.map((staff) => ({
                    user_id: staff.id,
                    status: markingStatus[staff.id] || 'present',
                    comments: markingComments[staff.id] || undefined,
                })),
            });
            toast.success('Attendance Recorded', 'Attendance saved successfully.');
            setIsModalOpen(false);
            setViewMode('day');
            setFilters((prev) => ({ ...prev, dateFrom: markingDate, dateTo: markingDate }));
            await loadData();
        } catch (error: any) {
            toast.error('Attendance Save Failed', error?.message || 'Could not save attendance.');
        } finally {
            setIsSaving(false);
        }
    };

    const lockAttendance = async () => {
        if (isScopeLocked) {
            return;
        }
        const scopeLabel = filters.branch === 'all' ? 'all branches' : selectedBranchName;
        const confirmed = window.confirm(`Lock attendance for ${scopeLabel} from ${filters.dateFrom} to ${filters.dateTo}? Locked attendance cannot be changed afterwards.`);
        if (!confirmed) {
            return;
        }

        setIsLocking(true);
        try {
            await attendanceApi.lockAttendance({
                branch_id: filters.branch === 'all' ? undefined : Number(filters.branch),
                date_from: filters.dateFrom,
                date_to: filters.dateTo,
            });
            toast.success('Attendance Locked', 'Attendance has been locked day-wise for the selected scope.');
            if (isModalOpen) {
                setIsModalOpen(false);
            }
            await loadData();
        } catch (error: any) {
            toast.error('Attendance Lock Failed', error?.message || 'Could not lock attendance.');
        } finally {
            setIsLocking(false);
        }
    };

    const derivedStats = useMemo(() => ({
        ...summary,
        earlyDepartures: rows.filter((row) => row.check_out && Number(row.total_hours || 0) < 8).length,
    }), [rows, summary]);

    const modalStatusSummary = useMemo(() => roster.reduce((acc, staff) => {
        const status = markingStatus[staff.id] || 'present';
        acc[status] += 1;
        return acc;
    }, {
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        off_duty: 0,
    } as Record<AttendanceStatus, number>), [markingStatus, roster]);

    const selectedBranchName = filters.branch === 'all'
        ? 'All branches'
        : branches.find((branch) => String(branch.id) === String(filters.branch))?.branch_name || 'Selected branch';
    const selectedDepartmentName = filters.department === 'all'
        ? 'All departments'
        : departments.find((department) => String(department.id) === String(filters.department))?.name || 'Selected department';
    const registerScopeLabel = viewMode === 'month'
        ? `Monthly register for ${selectedMonth}`
        : viewMode === 'custom'
            ? `Custom range ${filters.dateFrom} to ${filters.dateTo}`
            : `Daily register for ${filters.dateFrom}`;
    const scopeDays = useMemo(() => buildDateRangeDays(filters.dateFrom, filters.dateTo), [filters.dateFrom, filters.dateTo]);
    const coveringLocks = useMemo(
        () => locks.filter((lock) => scopeDays.some((day) => isDateCoveredByLock(lock, filters.branch, day.key))),
        [filters.branch, locks, scopeDays],
    );
    const isScopeLocked = useMemo(
        () => scopeDays.length > 0 && scopeDays.every((day) => locks.some((lock) => isDateCoveredByLock(lock, filters.branch, day.key))),
        [filters.branch, locks, scopeDays],
    );
    const activeLock = coveringLocks[0] ?? null;

    const sheetDays = useMemo(() => {
        if (viewMode === 'month') {
            return buildMonthDays(selectedMonth);
        }
        if (viewMode === 'custom') {
            return buildDateRangeDays(filters.dateFrom, filters.dateTo);
        }
        return [];
    }, [filters.dateFrom, filters.dateTo, selectedMonth, viewMode]);

    const sheetAttendanceRows = useMemo<MonthlyAttendanceRow[]>(() => {
        if (viewMode !== 'month' && viewMode !== 'custom') {
            return [];
        }

        const staffMap = new Map<number, MonthlyAttendanceRow>();

        for (const row of rows) {
            const existing = staffMap.get(row.staff.id) ?? {
                staffId: row.staff.id,
                employeeId: row.staff.employee_id || `EMP-${row.staff.id}`,
                fullName: row.staff.full_name,
                designation: row.staff.designation || 'Unassigned',
                branchName: row.branch?.branch_name || 'Unassigned branch',
                dayStatuses: {},
                totals: { present: 0, late: 0, absent: 0, leave: 0, off_duty: 0 },
            };

            if (!existing.dayStatuses[row.date]) {
                existing.totals[row.status] += 1;
            }
            existing.dayStatuses[row.date] = row.status;
            staffMap.set(row.staff.id, existing);
        }

        return Array.from(staffMap.values()).sort((left, right) => left.fullName.localeCompare(right.fullName));
    }, [rows, viewMode]);

    return (
        <div className={styles.attendanceContainer}>
            <header className={styles.header}>
                <div className={styles.headerBlock}>
                    <h1 className={styles.title}>Staff Attendance</h1>
                    <p className={styles.subtitle}>Live attendance registry by branch, department, and business date.</p>
                    <div className={styles.headerMeta}>
                        <span className={styles.headerChip}><Building2 size={13} /> {selectedBranchName}</span>
                        <span className={styles.headerChip}><Users size={13} /> {selectedDepartmentName}</span>
                        <span className={styles.headerChip}><Calendar size={13} /> {registerScopeLabel}</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.markButton} onClick={openModal} disabled={!canMarkAttendance || isScopeLocked}>
                        <CheckCircle2 size={18} />
                        Mark Attendance
                    </button>
                    <button className={styles.exportBtn} onClick={lockAttendance} disabled={!canMarkAttendance || isScopeLocked || isLocking}>
                        <Clock size={18} />
                        {isScopeLocked ? 'Attendance Locked' : isLocking ? 'Locking...' : 'Lock Attendance'}
                    </button>
                    <button className={styles.exportBtn} onClick={exportCsv}>
                        <Download size={18} />
                        Export Report
                    </button>
                </div>
            </header>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statIcon}><Users size={16} /></div><span className={styles.statLabel}>Total Staff</span><span className={styles.statValue}>{derivedStats.total}</span></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--success)' }}><UserCheck size={16} /></div><span className={styles.statLabel}>Present</span><span className={styles.statValue}>{derivedStats.present}</span></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--warning)' }}><Clock size={16} /></div><span className={styles.statLabel}>Late</span><span className={styles.statValue}>{derivedStats.late}</span></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--danger)' }}><UserX size={16} /></div><span className={styles.statLabel}>Absent</span><span className={styles.statValue}>{derivedStats.absent}</span></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--accent-primary)' }}><Calendar size={16} /></div><span className={styles.statLabel}>Leave</span><span className={styles.statValue}>{derivedStats.leave}</span></div>
                <div className={styles.statCard}><div className={styles.statIcon} style={{ color: 'var(--text-secondary)' }}><Building2 size={16} /></div><span className={styles.statLabel}>Off Duty</span><span className={styles.statValue}>{derivedStats.off_duty}</span></div>
            </div>

            <section className={styles.filtersSection}>
                <div className={styles.filterGroup}>
                    <label><Calendar size={12} /> View Scope</label>
                    <div className={styles.scopeToggle}>
                        <button
                            type="button"
                            className={`${styles.scopeButton} ${viewMode === 'day' ? styles.scopeButtonActive : ''}`}
                            onClick={() => {
                                setViewMode('day');
                                setFilters((prev) => ({ ...prev, dateFrom: today, dateTo: today }));
                            }}
                        >
                            One Attendance
                        </button>
                        <button
                            type="button"
                            className={`${styles.scopeButton} ${viewMode === 'month' ? styles.scopeButtonActive : ''}`}
                            onClick={() => {
                                setViewMode('month');
                                const bounds = getMonthBounds(selectedMonth);
                                setFilters((prev) => ({ ...prev, ...bounds }));
                            }}
                        >
                            Whole Month
                        </button>
                        <button
                            type="button"
                            className={`${styles.scopeButton} ${viewMode === 'custom' ? styles.scopeButtonActive : ''}`}
                            onClick={() => setViewMode('custom')}
                        >
                            Custom Range
                        </button>
                    </div>
                </div>
                {viewMode === 'month' ? (
                    <div className={styles.filterGroup}>
                        <label><Calendar size={12} /> Attendance Month</label>
                        <input
                            type="month"
                            className={styles.filterInput}
                            value={selectedMonth}
                            onChange={(e) => {
                                const nextMonth = e.target.value;
                                setSelectedMonth(nextMonth);
                                const bounds = getMonthBounds(nextMonth);
                                setFilters((prev) => ({ ...prev, ...bounds }));
                            }}
                        />
                    </div>
                ) : (
                    <div className={styles.filterGroup}>
                        <label><Calendar size={12} /> Attendance Date</label>
                        <input
                            type="date"
                            className={styles.filterInput}
                            value={filters.dateFrom}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFilters((prev) => ({ ...prev, dateFrom: value, dateTo: viewMode === 'day' ? value : prev.dateTo }));
                            }}
                        />
                    </div>
                )}
                {viewMode === 'custom' && (
                    <div className={styles.filterGroup}>
                        <label><Calendar size={12} /> Date To</label>
                        <input type="date" className={styles.filterInput} value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} />
                    </div>
                )}
                <div className={styles.filterGroup}>
                    <label><Building2 size={12} /> Branch</label>
                    <select className={styles.filterInput} value={filters.branch} onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}>
                        <option value="all">All Branches</option>
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}</option>)}
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label><Building2 size={12} /> Department</label>
                    <select className={styles.filterInput} value={filters.department} onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}>
                        <option value="all">All Departments</option>
                        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label><Search size={12} /> Search Staff</label>
                    <input type="text" className={styles.filterInput} placeholder="Name, employee ID, username" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
                </div>
            </section>

            {activeLock && (
                <div className={styles.lockBanner}>
                    <strong>Attendance locked.</strong>
                    <span>
                        {activeLock.branch_name} has {coveringLocks.length} daily lock{coveringLocks.length === 1 ? '' : 's'} covering {filters.dateFrom} to {filters.dateTo}
                        {activeLock.reason ? ` • ${activeLock.reason}` : ''}.
                    </span>
                </div>
            )}

            {viewMode === 'month' || viewMode === 'custom' ? (
                <section className={styles.monthSheetSection}>
                    <div className={styles.monthSheetHeader}>
                        <div>
                            <h2 className={styles.monthSheetTitle}>{viewMode === 'month' ? 'Monthly Attendance Sheet' : 'Attendance Range Sheet'}</h2>
                            <p className={styles.monthSheetSubtitle}>
                                {viewMode === 'month'
                                    ? 'Operational attendance matrix by employee and calendar day.'
                                    : 'Operational attendance matrix for the selected custom date range.'}
                            </p>
                        </div>
                        <div className={styles.monthSheetLegend}>
                            {STATUS_OPTIONS.map((status) => (
                                <span key={status} className={`${styles.monthLegendChip} ${styles[`monthLegend_${status}`]}`}>
                                    {STATUS_SHORT_LABELS[status]} {STATUS_LABELS[status]}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className={styles.monthSheetWrap}>
                        <table className={styles.monthSheetTable}>
                            <thead>
                                <tr>
                                    <th className={styles.stickyMonthIdentity} rowSpan={2}>Employee</th>
                                    <th className={styles.stickyMonthBranch} rowSpan={2}>Branch</th>
                                    {sheetDays.map((day) => (
                                        <th key={`${day.key}-weekday`} className={day.isWeekend ? styles.monthWeekendHead : ''}>
                                            {day.weekday}
                                        </th>
                                    ))}
                                    <th className={styles.monthTotalPresent} rowSpan={2}>Present</th>
                                    <th className={styles.monthTotalLate} rowSpan={2}>Late</th>
                                    <th className={styles.monthTotalAbsent} rowSpan={2}>Absent</th>
                                    <th className={styles.monthTotalLeave} rowSpan={2}>Leave</th>
                                    <th className={styles.monthTotalOffDuty} rowSpan={2}>Off Duty</th>
                                </tr>
                                <tr>
                                    {sheetDays.map((day) => (
                                        <th key={`${day.key}-number`} className={day.isWeekend ? styles.monthWeekendHead : ''}>
                                            {day.dayNumber}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sheetAttendanceRows.map((staff) => (
                                    <tr key={staff.staffId}>
                                        <td className={styles.monthIdentityCell}>
                                            <div className={styles.monthIdentityName}>{staff.fullName}</div>
                                            <div className={styles.monthIdentityMeta}>{staff.employeeId} - {staff.designation}</div>
                                        </td>
                                        <td className={styles.monthBranchCell}>{staff.branchName}</td>
                                        {sheetDays.map((day) => {
                                            const status = staff.dayStatuses[day.key];
                                            return (
                                                <td
                                                    key={`${staff.staffId}-${day.key}`}
                                                    className={`${styles.monthStatusCell} ${day.isWeekend ? styles.monthWeekendCell : ''} ${status ? styles[`monthStatus_${status}`] : styles.monthStatusBlank}`}
                                                >
                                                    {status ? STATUS_SHORT_LABELS[status] : '—'}
                                                </td>
                                            );
                                        })}
                                        <td className={styles.monthSummaryMetric}>{staff.totals.present}</td>
                                        <td className={styles.monthSummaryMetric}>{staff.totals.late}</td>
                                        <td className={styles.monthSummaryMetric}>{staff.totals.absent}</td>
                                        <td className={styles.monthSummaryMetric}>{staff.totals.leave}</td>
                                        <td className={styles.monthSummaryMetric}>{staff.totals.off_duty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!isLoading && sheetAttendanceRows.length === 0 && (
                            <div className={styles.tableEmptyState}>
                                {viewMode === 'month'
                                    ? 'No monthly attendance records found for the selected filters.'
                                    : 'No attendance records found for the selected custom range.'}
                            </div>
                        )}
                        {isLoading && (
                            <div className={styles.tableEmptyState}>
                                {viewMode === 'month' ? 'Loading monthly attendance sheet...' : 'Loading attendance range sheet...'}
                            </div>
                        )}
                    </div>
                </section>
            ) : (
                <div className={styles.tableContainer}>
                    <div className={styles.tableToolbar}>
                        <div>
                            <strong>{rows.length} records</strong>
                            <span> in the current attendance register</span>
                        </div>
                        <div className={styles.tableToolbarMeta}>
                            <span>{derivedStats.present} present</span>
                            <span>{derivedStats.late} late</span>
                            <span>{derivedStats.absent} absent</span>
                        </div>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Staff Detail</th>
                                <th>Branch</th>
                                <th>Department</th>
                                <th>Date</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Total Hrs</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <div className={styles.staffCell}>
                                            <div className={styles.avatar}>{row.staff.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.staff.full_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    {row.staff.employee_id || `EMP-${row.staff.id}`} - {row.staff.designation || 'Unassigned'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{row.branch?.branch_name || '—'}</td>
                                    <td>{row.staff.department || '—'}</td>
                                    <td>{row.date}</td>
                                    <td>{row.check_in ? new Date(row.check_in).toLocaleTimeString() : '—'}</td>
                                    <td>{row.check_out ? new Date(row.check_out).toLocaleTimeString() : '—'}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{formatHours(row.total_hours)}</td>
                                    <td><span className={`${styles.statusPill} ${styles[row.status]}`}>{STATUS_LABELS[row.status]}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && rows.length === 0 && (
                        <div className={styles.tableEmptyState}>No attendance records found for the selected filters.</div>
                    )}
                    {isLoading && (
                        <div className={styles.tableEmptyState}>Loading attendance records...</div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Daily Attendance Marking</h2>
                                <p className={styles.modalSubtext}>Mark today&apos;s working roster, leave approvals, absences, and off-duty staff in one pass.</p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.modalControlBar}>
                                <div className={styles.filterGroup}>
                                    <label><Calendar size={12} /> Attendance Date</label>
                                    <input type="date" className={styles.filterInput} value={markingDate} onChange={(e) => setMarkingDate(e.target.value)} />
                                </div>
                                <div className={styles.modalControlMeta}>
                                    <span>{roster.length} employees in roster</span>
                                    <span>{selectedBranchName}</span>
                                </div>
                            </div>

                            <div className={styles.modalStatusGrid}>
                                {STATUS_OPTIONS.map((status) => (
                                    <div key={status} className={styles.modalStatusCard}>
                                        <span className={styles.modalStatusLabel}>{STATUS_LABELS[status]}</span>
                                        <span className={styles.modalStatusValue}>{modalStatusSummary[status]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className={styles.modalLegend}>
                                <span><strong>Off Duty</strong> marks employees who are not scheduled to report on this date.</span>
                            </div>

                            <div className={styles.markingList}>
                                <div className={styles.markingTableWrap}>
                                    <table className={styles.markingTable}>
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Branch</th>
                                                <th>Designation</th>
                                                <th>Status</th>
                                                <th>Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roster.map((staff) => (
                                                <tr key={staff.id}>
                                                    <td>
                                                        <div className={styles.markingStaffCell}>
                                                            <div className={styles.avatar} style={{ width: '30px', height: '30px' }}>
                                                                {staff.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <div>
                                                                <div className={styles.markingStaffName}>{staff.full_name}</div>
                                                                <div className={styles.markingStaffMeta}>
                                                                    {staff.employee_id || `EMP-${staff.id}`}
                                                                    <span className={styles.employeeTypePill}>{staff.employment_type || 'Staff'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{staff.branch_name || 'No branch'}</td>
                                                    <td>{staff.designation || 'Unassigned'}</td>
                                                    <td>
                                                        <select
                                                            className={styles.statusSelect}
                                                            value={markingStatus[staff.id] || 'present'}
                                                            onChange={(e) => setMarkingStatus((prev) => ({ ...prev, [staff.id]: e.target.value as AttendanceStatus }))}
                                                        >
                                                            {STATUS_OPTIONS.map((status) => (
                                                                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className={styles.commentInput}
                                                            placeholder="Optional remarks"
                                                            value={markingComments[staff.id] || ''}
                                                            onChange={(e) => setMarkingComments((prev) => ({ ...prev, [staff.id]: e.target.value }))}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button className={styles.markButton} onClick={saveAttendance} disabled={isSaving}>
                                    <CheckCircle2 size={18} />
                                    {isSaving ? 'Saving...' : 'Save Attendance'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
