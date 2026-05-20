import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { Search, ArrowDownCircle, ArrowUpCircle, AlertCircle, RefreshCcw, Loader2 } from 'lucide-react';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import styles from './StockLedgerList.module.css';

type DatePreset = 'today' | '7d' | '30d' | 'month' | 'custom' | '';

const formatCurrency = (value: unknown) => {
    const amount = Number(value || 0);
    return amount > 0
        ? `PKR ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-';
};

const formatIssueDate = (value?: string | null) => {
    if (!value) {
        return '-';
    }
    return new Date(value).toLocaleDateString('en-PK');
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const resolveDateRange = (preset: DatePreset, from: string, to: string) => {
    const today = new Date();
    const end = toDateInput(today);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysAgo = (days: number) => {
        const date = new Date(today);
        date.setDate(date.getDate() - days);
        return toDateInput(date);
    };

    if (preset === 'today') return { from: end, to: end };
    if (preset === '7d') return { from: daysAgo(6), to: end };
    if (preset === '30d') return { from: daysAgo(29), to: end };
    if (preset === 'month') return { from: toDateInput(startOfMonth), to: end };
    if (preset === 'custom') return { from, to };
    return { from: '', to: '' };
};

export function StockLedgerList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [transactionType, setTransactionType] = useState('');
    const [datePreset, setDatePreset] = useState<DatePreset>('30d');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [serviceStation, setServiceStation] = useState('');
    const [quantityDirection, setQuantityDirection] = useState<'all' | 'in' | 'out'>('all');
    const [minValue, setMinValue] = useState('');
    const [ledger, setLedger] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(0);
    const pageSize = 25;
    const branchId = Number(resolveActiveBranchId() || 0);
    const deferredSearch = useDeferredValue(searchTerm.trim());
    const dateRange = useMemo(() => resolveDateRange(datePreset, dateFrom, dateTo), [dateFrom, datePreset, dateTo]);

    useEffect(() => {
        const fetchLedger = async () => {
            setIsLoading(true);
            try {
                if (!branchId) {
                    setLedger([]);
                    setTotal(0);
                    return;
                }
                const data = await inventoryApi.getLedgerPage(branchId, {
                    search: deferredSearch || undefined,
                    transactionType: transactionType || undefined,
                    date_from: dateRange.from || undefined,
                    date_to: dateRange.to || undefined,
                    limit: pageSize,
                    offset: page * pageSize,
                });
                setLedger(data.items ?? []);
                setTotal(data.total ?? 0);
            } catch (err) {
                console.error('Failed to fetch ledger:', err);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchLedger();
    }, [branchId, dateRange.from, dateRange.to, deferredSearch, page, transactionType]);

    useEffect(() => {
        setPage(0);
    }, [branchId, dateRange.from, dateRange.to, deferredSearch, minValue, quantityDirection, serviceStation, transactionType]);

    const getIconForType = (type: string) => {
        switch (type) {
            case 'purchase': return <ArrowDownCircle size={18} className={styles.iconReceive} />;
            case 'sale': return <ArrowUpCircle size={18} className={styles.iconSale} />;
            case 'adjustment': return <AlertCircle size={18} className={styles.iconAdjust} />;
            case 'transfer': return <RefreshCcw size={18} className={styles.iconAdjust} />;
            case 'production': return <ArrowUpCircle size={18} className={styles.iconSale} />;
            default: return <RefreshCcw size={18} />;
        }
    };

    const getBadgeClass = (type: string) => {
        switch (type) {
            case 'purchase': return styles.badgeReceive;
            case 'sale': return styles.badgeSale;
            case 'adjustment': return styles.badgeAdjust;
            case 'transfer': return styles.badgeAdjust;
            case 'production': return styles.badgeSale;
            default: return '';
        }
    };

    const serviceStations = useMemo(() => (
        Array.from(new Set(
            ledger
                .map((entry) => entry.issue_metadata?.issue_to)
                .filter(Boolean),
        )).sort()
    ), [ledger]);

    const rows = useMemo(() => ledger.filter((entry) => {
        const lineValue = Number(entry.line_value ?? Math.abs(Number(entry.quantity || 0)) * Number(entry.unit_cost || 0));
        const quantity = Number(entry.quantity || 0);
        const station = entry.issue_metadata?.issue_to || '';
        const passesStation = !serviceStation || station === serviceStation;
        const passesDirection = quantityDirection === 'all'
            || (quantityDirection === 'in' && quantity > 0)
            || (quantityDirection === 'out' && quantity < 0);
        const passesValue = !minValue || lineValue >= Number(minValue || 0);
        return passesStation && passesDirection && passesValue;
    }), [ledger, minValue, quantityDirection, serviceStation]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filteredValue = rows.reduce((sum, entry) => sum + Number(entry.line_value || 0), 0);
    const inboundCount = rows.filter((entry) => Number(entry.quantity || 0) > 0).length;
    const outboundCount = rows.filter((entry) => Number(entry.quantity || 0) < 0).length;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Stock Ledger & Item History</h1>
                    <p>Transaction history by item, reference, date, service station, and movement type.</p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/console/inventory/adjust')}>
                        <AlertCircle size={18} style={{ marginRight: '8px' }} />
                        Stock Adjustment
                    </KitchenButton>
                    <KitchenButton variant="primary" onClick={() => navigate('/console/inventory/grn/new')}>
                        <ArrowDownCircle size={18} style={{ marginRight: '8px' }} />
                        Receive Goods (GRN)
                    </KitchenButton>
                </div>
            </header>

            <KitchenCard className={styles.filterCard}>
                <div className={styles.filters}>
                    <KitchenInput
                        placeholder="Search by item, reference, or type..."
                        icon={<Search size={20} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        containerClassName={styles.searchBar}
                    />
                    <div className={styles.dateFilters}>
                        <select className={styles.select} value={datePreset} onChange={(event) => setDatePreset(event.target.value as DatePreset)}>
                            <option value="">All Dates</option>
                            <option value="today">Today</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        {datePreset === 'custom' && (
                            <>
                                <input className={styles.input} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                                <input className={styles.input} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                            </>
                        )}
                        <select className={styles.select} value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
                            <option value="">All Transactions</option>
                            <option value="purchase">Receiving (GRN)</option>
                            <option value="sale">Sales (POS)</option>
                            <option value="adjustment">Adjustments</option>
                            <option value="transfer">Transfers</option>
                            <option value="wastage">Wastage</option>
                            <option value="production">Kitchen Issues</option>
                        </select>
                        <select className={styles.select} value={serviceStation} onChange={(event) => setServiceStation(event.target.value)}>
                            <option value="">All Stations</option>
                            {serviceStations.map((station) => <option key={station} value={station}>{station}</option>)}
                        </select>
                        <select className={styles.select} value={quantityDirection} onChange={(event) => setQuantityDirection(event.target.value as typeof quantityDirection)}>
                            <option value="all">All Movement</option>
                            <option value="in">Stock In</option>
                            <option value="out">Stock Out</option>
                        </select>
                        <input className={styles.input} type="number" min="0" placeholder="Min value" value={minValue} onChange={(event) => setMinValue(event.target.value)} />
                    </div>
                </div>
                <div className={styles.reportStrip}>
                    <div>
                        <span>Filtered Rows</span>
                        <strong>{rows.length}</strong>
                    </div>
                    <div>
                        <span>Stock In Rows</span>
                        <strong>{inboundCount}</strong>
                    </div>
                    <div>
                        <span>Stock Out Rows</span>
                        <strong>{outboundCount}</strong>
                    </div>
                    <div>
                        <span>Filtered Value</span>
                        <strong>{formatCurrency(filteredValue)}</strong>
                    </div>
                </div>
            </KitchenCard>

            <div className={styles.tableContainer}>
                {isLoading ? (
                    <div className={styles.loader}>
                        <Loader2 size={32} className={styles.spinner} />
                        <span>Fetching audit logs...</span>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Transaction Type</th>
                                <th>Inventory Item</th>
                                <th>Quantity (+ / -)</th>
                                <th>Service Station</th>
                                <th>Issued By</th>
                                <th>Issue Date</th>
                                <th>Reference / Reason</th>
                                <th>Unit Cost</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((entry) => {
                                const issueMetadata = entry.issue_metadata;
                                const lineValue = entry.line_value ?? Math.abs(Number(entry.quantity || 0)) * Number(entry.unit_cost || 0);

                                return (
                                    <tr key={entry.id} className={styles.row}>
                                        <td className={styles.dateCell}>{new Date(entry.created_at).toLocaleString('en-PK')}</td>
                                        <td>
                                            <span className={`${styles.typeBadge} ${getBadgeClass(entry.transaction_type)}`}>
                                                {getIconForType(entry.transaction_type)}
                                                {entry.transaction_type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className={styles.itemCell}>{entry.item?.item_name || `Item #${entry.item_id}`}</td>
                                        <td>
                                            <span className={Number(entry.quantity) > 0 ? styles.qtyPositive : styles.qtyNegative}>
                                                {Number(entry.quantity) > 0 ? `+${Number(entry.quantity).toFixed(2)}` : Number(entry.quantity).toFixed(2)}
                                            </span>
                                        </td>
                                        <td>{issueMetadata?.issue_to || '-'}</td>
                                        <td>{issueMetadata?.issued_by_name || '-'}</td>
                                        <td>{formatIssueDate(issueMetadata?.issue_date)}</td>
                                        <td className={styles.refCell}>{entry.reference_id || '-'}</td>
                                        <td className={styles.costCell}>{formatCurrency(entry.unit_cost)}</td>
                                        <td className={styles.costCell}>{formatCurrency(lineValue)}</td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                        No transaction logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className={styles.paginationBar}>
                <span className={styles.pageInfo}>
                    Showing {total === 0 ? 0 : page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className={styles.pageControls}>
                    <button className={styles.pageBtn} disabled={page === 0 || isLoading} onClick={() => setPage((value) => value - 1)}>
                        Previous
                    </button>
                    <span className={styles.pageInfo}>Page {Math.min(page + 1, totalPages)} of {totalPages}</span>
                    <button className={styles.pageBtn} disabled={page >= totalPages - 1 || isLoading} onClick={() => setPage((value) => value + 1)}>
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
