/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    BarChart3,
    Building2,
    Clock,
    DollarSign,
    Package,
    ShieldAlert,
    Store,
    TrendingDown,
    TrendingUp,
    Truck,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { accountingApi, branchApi, vendorApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './VendorDashboard.module.css';

const COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#06b6d4', '#22c55e', '#a855f7'];

function formatPKR(n: number) {
    if (n >= 1000000) return `PKR ${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `PKR ${(n / 1000).toFixed(0)}K`;
    return `PKR ${n.toLocaleString()}`;
}

function withinPeriod(value: string | null | undefined, days: number) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const diff = Date.now() - date.getTime();
    return diff <= days * 24 * 60 * 60 * 1000;
}

export function VendorDashboard() {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [dashboard, setDashboard] = useState<any>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [payables, setPayables] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [accountingDashboard, vendorRows, payableAging, branchRows] = await Promise.all([
                    accountingApi.getDashboard(),
                    vendorApi.getVendors(),
                    accountingApi.getPayablesAging(),
                    branchApi.getBranches(),
                ]);
                setDashboard(accountingDashboard);
                setVendors(vendorRows || []);
                setPayables(payableAging?.documents || []);
                setBranches(branchRows || []);
            } catch (error: any) {
                console.error('Failed to load vendor dashboard', error);
                toast.error('Vendor Dashboard', error?.message || 'Could not load live vendor analytics.');
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, []);

    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const branchMap = useMemo(() => new Map(branches.map((branch: any) => [Number(branch.id), branch.branch_name])), [branches]);

    const filteredPayables = useMemo(() => payables.filter((doc: any) => {
        if (!doc.document_date) return true;
        return withinPeriod(doc.document_date, periodDays);
    }), [payables, periodDays]);

    const topVendors = useMemo(() => {
        const spendMap = new Map<string, number>();
        filteredPayables.forEach((doc: any) => {
            const name = doc.party_name || 'Vendor';
            spendMap.set(name, Number(spendMap.get(name) || 0) + Number(doc.total_amount || 0));
        });
        return [...spendMap.entries()]
            .map(([name, spend]) => ({ name, spend }))
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 5);
    }, [filteredPayables]);

    const spendByBranch = useMemo(() => {
        const spendMap = new Map<string, number>();
        filteredPayables.forEach((doc: any) => {
            const name = branchMap.get(Number(doc.branch_id)) || `Branch ${doc.branch_id}`;
            spendMap.set(name, Number(spendMap.get(name) || 0) + Number(doc.total_amount || 0));
        });
        return [...spendMap.entries()].map(([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] }));
    }, [branchMap, filteredPayables]);

    const revenueTrend = useMemo(() => {
        const raw = (dashboard?.revenue_trend || []).map((row: any) => ({
            month: row.month,
            spend: Number(row.expenses || 0),
        }));
        const points = period === '7d' ? 3 : period === '30d' ? 6 : 12;
        return raw.slice(-points);
    }, [dashboard, period]);

    const overdueVendors = useMemo(() => filteredPayables
        .filter((doc: any) => Number(doc.days_past_due || 0) > 0)
        .sort((a: any, b: any) => Number(b.outstanding_amount || 0) - Number(a.outstanding_amount || 0))
        .slice(0, 5)
        .map((doc: any) => ({
            name: doc.party_name || 'Vendor',
            overdue: Number(doc.outstanding_amount || 0),
            days: Number(doc.days_past_due || 0),
        })), [filteredPayables]);

    const ageingBuckets = useMemo(() => {
        const buckets = [
            { label: 'Current', amount: 0 },
            { label: '1-30 Days', amount: 0 },
            { label: '31-60 Days', amount: 0 },
            { label: '61-90 Days', amount: 0 },
            { label: '90+ Days', amount: 0 },
        ];
        filteredPayables.forEach((doc: any) => {
            const days = Number(doc.days_past_due || 0);
            const amount = Number(doc.outstanding_amount || 0);
            if (days <= 0) buckets[0].amount += amount;
            else if (days <= 30) buckets[1].amount += amount;
            else if (days <= 60) buckets[2].amount += amount;
            else if (days <= 90) buckets[3].amount += amount;
            else buckets[4].amount += amount;
        });
        return buckets;
    }, [filteredPayables]);

    const vendorPerformance = useMemo(() => {
        const activeVendors = vendors.filter((vendor) => vendor.is_active !== false).length;
        const totalBranches = branches.length || 1;
        const vendorCoverage = vendors.reduce((sum, vendor) => sum + Number(vendor.usage_summary?.branch_count || 0), 0);
        return [
            { label: 'Active vendors', value: `${activeVendors}`, good: true },
            { label: 'Branch coverage', value: `${Math.round((vendorCoverage / Math.max(activeVendors * totalBranches, 1)) * 100)}%`, good: true },
            { label: 'Payables overdue', value: `${overdueVendors.length}`, good: overdueVendors.length === 0 },
            { label: 'Avg payable', value: formatPKR(filteredPayables.reduce((sum: number, doc: any) => sum + Number(doc.outstanding_amount || 0), 0) / Math.max(filteredPayables.length, 1)), good: true },
        ];
    }, [branches.length, filteredPayables, overdueVendors.length, vendors]);

    const totalPayable = filteredPayables.reduce((sum: number, doc: any) => sum + Number(doc.outstanding_amount || 0), 0);
    const monthlySpend = Number(dashboard?.summary?.monthly_expenses || 0);
    const overdueAmount = overdueVendors.reduce((sum, vendor) => sum + vendor.overdue, 0);
    const scopeBranchCount = new Set(filteredPayables.map((doc: any) => branchMap.get(Number(doc.branch_id)) || `Branch ${doc.branch_id}`)).size;

    if (isLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.chartCard}>
                    <div className={styles.chartBody} style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
                        Loading live vendor dashboard...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/vendors')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className={styles.headerIcon}><BarChart3 size={20} /></div>
                    <div>
                        <h1 className={styles.pageTitle}>Vendor Dashboard</h1>
                        <p className={styles.pageSubtitle}>Live procurement exposure, branch concentration, and payable ageing.</p>
                    </div>
                </div>
                <div className={styles.periodToggle}>
                    {(['7d', '30d', '90d'] as const).map((value) => (
                        <button key={value} className={`${styles.periodBtn} ${period === value ? styles.periodBtnActive : ''}`} onClick={() => setPeriod(value)}>
                            {value === '7d' ? '7 Days' : value === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.scopeRail}>
                <div className={styles.scopeCard}><Store size={16} /><div><strong>{scopeBranchCount || branches.length}</strong><span>Branches represented in scope</span></div></div>
                <div className={styles.scopeCard}><Package size={16} /><div><strong>{filteredPayables.length}</strong><span>Open documents in selected period</span></div></div>
                <div className={styles.scopeCard}><Truck size={16} /><div><strong>{vendors.filter((vendor) => vendor.is_active !== false).length}</strong><span>Active vendors on live master</span></div></div>
            </div>

            <div className={styles.kpiRow}>
                {[
                    { label: 'Total Payable', value: formatPKR(totalPayable), sub: `${filteredPayables.length} open bills`, icon: <DollarSign size={18} />, color: 'var(--accent-primary)' },
                    { label: 'Active Vendors', value: `${vendors.filter((vendor) => vendor.is_active !== false).length}`, sub: `${vendors.length} vendor masters`, icon: <Building2 size={18} />, color: '#22c55e' },
                    { label: 'Overdue Amount', value: formatPKR(overdueAmount), sub: `${overdueVendors.length} vendors overdue`, icon: <AlertTriangle size={18} />, color: 'var(--accent-danger)', alert: true },
                    { label: 'Avg Credit Days', value: `${Math.round(filteredPayables.reduce((sum: number, doc: any) => sum + Number(Math.max(doc.days_past_due || 0, 0)), 0) / Math.max(filteredPayables.length, 1))}d`, sub: 'Payable age', icon: <Clock size={18} />, color: 'var(--accent-warning)' },
                    { label: 'Open Bills', value: `${filteredPayables.length}`, sub: 'Vendor invoices pending', icon: <ShieldAlert size={18} />, color: 'var(--accent-secondary)' },
                    { label: 'Monthly Spend', value: formatPKR(monthlySpend), sub: 'From accounting dashboard', icon: <TrendingUp size={18} />, color: 'var(--accent-tertiary)' },
                ].map((item, index) => (
                    <div key={index} className={`${styles.kpiCard} ${item.alert ? styles.kpiCardAlert : ''}`}>
                        <div className={styles.kpiIcon} style={{ color: item.color }}>{item.icon}</div>
                        <div className={styles.kpiBody}>
                            <span className={styles.kpiValue} style={{ color: item.color }}>{item.value}</span>
                            <span className={styles.kpiLabel}>{item.label}</span>
                            <span className={styles.kpiSub}>{item.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.chartsRow}>
                <div className={styles.chartCard} style={{ flex: 2 }}>
                    <div className={styles.chartHeader}><h3><TrendingUp size={15} /> Expense Trend</h3></div>
                    <div className={styles.chartBody}>
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={revenueTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}K`} />
                                <Tooltip formatter={(value) => formatPKR(Number(value || 0))} />
                                <Line type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}><h3><Package size={15} /> Spend by Branch</h3></div>
                    <div className={styles.chartBody} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ResponsiveContainer width={150} height={150}>
                            <PieChart>
                                <Pie data={spendByBranch} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                    {spendByBranch.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <Tooltip formatter={(value) => formatPKR(Number(value || 0))} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.pieLegend}>
                            {spendByBranch.map((entry: any) => (
                                <div key={entry.name} className={styles.pieLegendItem}>
                                    <span className={styles.pieDot} style={{ background: entry.color }} />
                                    <span className={styles.pieName}>{entry.name}</span>
                                    <span className={styles.pieValue}>{formatPKR(entry.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.chartsRow}>
                <div className={styles.chartCard} style={{ flex: 1.5 }}>
                    <div className={styles.chartHeader}><h3><Building2 size={15} /> Top Vendors by Exposure</h3></div>
                    <div className={styles.chartBody}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={topVendors} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                                <Tooltip formatter={(value) => formatPKR(Number(value || 0))} />
                                <Bar dataKey="spend" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}><h3><Clock size={15} /> Payable Ageing</h3></div>
                    <div className={styles.chartBody}>
                        <div className={styles.ageingList}>
                            {ageingBuckets.map((bucket: any, index: number) => (
                                <div key={index} className={styles.ageingRow}>
                                    <span className={styles.ageingRange}>{bucket.label}</span>
                                    <div className={styles.ageingBarTrack}>
                                        <div className={styles.ageingBarFill} style={{ width: `${Math.min((Number(bucket.amount || 0) / Math.max(totalPayable, 1)) * 100, 100)}%`, background: COLORS[index % COLORS.length] }} />
                                    </div>
                                    <span className={styles.ageingAmount} style={{ color: COLORS[index % COLORS.length] }}>{formatPKR(Number(bucket.amount || 0))}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.bottomRow}>
                <div className={styles.alertCard}>
                    <div className={styles.alertCardHeader}><AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /><h3>Overdue Vendors</h3><span className={styles.overdueCount}>{overdueVendors.length}</span></div>
                    <div className={styles.alertList}>
                        {overdueVendors.map((vendor, index) => (
                            <div key={index} className={styles.overdueItem}>
                                <div className={styles.overdueAvatar}>{vendor.name[0]}</div>
                                <div className={styles.overdueInfo}>
                                    <span className={styles.overdueName}>{vendor.name}</span>
                                    <span className={styles.overdueAmt}>Outstanding: <strong>{formatPKR(vendor.overdue)}</strong></span>
                                </div>
                                <div className={styles.overdueDays} style={{ color: vendor.days > 15 ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>{vendor.days}d overdue</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.metricsCard}>
                    <div className={styles.alertCardHeader}><Truck size={16} style={{ color: 'var(--accent-tertiary)' }} /><h3>Vendor Metrics</h3></div>
                    <div className={styles.metricsList}>
                        {vendorPerformance.map((metric, index) => (
                            <div key={index} className={styles.metricRow}>
                                <span className={styles.metricLabel}>{metric.label}</span>
                                <span className={styles.metricValue} style={{ color: metric.good ? '#22c55e' : 'var(--accent-warning)' }}>
                                    {metric.good ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                    {metric.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
