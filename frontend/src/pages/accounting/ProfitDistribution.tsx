import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, CheckCircle2, Clock, Eye, PiggyBank, Play, X } from 'lucide-react';
import { accountingApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { useBranchContext } from '../../hooks/useBranchContext';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './ProfitDistribution.module.css';

type DistributionPreview = {
    period: { period_start: string; period_end: string; day_count: number; distribution_frequency: string };
    net_profit_amount: number;
    positive_profit_basis_amount: number;
    warnings: string[];
    summary: { investor_count: number; total_management_charge_amount: number; total_distribution_amount: number };
    lines: Array<{
        investor_id: number;
        investor_name: string;
        agreement_code: string;
        agreement_name: string;
        capital_basis_amount: number;
        profit_share_percent: number;
        fixed_return_percent: number;
        management_charge_percent: number;
        profit_share_amount: number;
        fixed_return_amount: number;
        net_distribution_amount: number;
    }>;
    existing_batch: { id: number; batch_code: string } | null;
};

type DistributionBatch = {
    id: number;
    batch_code: string | null;
    branch_name: string | null;
    distribution_frequency: string;
    period_start: string;
    period_end: string;
    total_distribution_amount: number;
    processed_at: string | null;
    status: string;
    lines: Array<{
        id: number;
        investor_name: string | null;
        net_distribution_amount: number;
        profit_share_amount: number;
        fixed_return_amount: number;
        management_charge_amount: number;
    }>;
};

function formatCurrency(value: number): string {
    return `PKR ${Number(value || 0).toLocaleString()}`;
}

function startOfMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function ProfitDistribution() {
    const { branches, activeBranch } = useBranchContext();
    const { canViewProfitDistribution, canManageProfitDistribution } = usePermissionAccess();
    const [branchId, setBranchId] = useState<string>(activeBranch ? String(activeBranch.branch_id) : '');
    const [distributionFrequency, setDistributionFrequency] = useState('monthly');
    const [periodStart, setPeriodStart] = useState(startOfMonth());
    const [periodEnd, setPeriodEnd] = useState(endOfMonth());
    const [preview, setPreview] = useState<DistributionPreview | null>(null);
    const [history, setHistory] = useState<DistributionBatch[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<DistributionBatch | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const branchOptions = useMemo(
        () => branches.map((branch) => ({ value: String(branch.branch_id), label: branch.branch_name || `Branch ${branch.branch_id}` })),
        [branches],
    );

    const loadHistory = useCallback(async () => {
        if (!branchId) return;
        const data = await accountingApi.getProfitDistributions({ branch_id: branchId });
        setHistory(data);
    }, [branchId]);

    const loadPreview = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        setError(null);
        try {
            const [previewData] = await Promise.all([
                accountingApi.getProfitDistributionPreview({
                    branch_id: branchId,
                    period_start: periodStart,
                    period_end: periodEnd,
                    distribution_frequency: distributionFrequency,
                }),
                loadHistory(),
            ]);
            setPreview(previewData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load profit distribution preview');
        } finally {
            setLoading(false);
        }
    }, [branchId, distributionFrequency, loadHistory, periodEnd, periodStart]);

    useEffect(() => {
        void loadPreview();
    }, [loadPreview]);

    const processDistribution = async () => {
        if (!canManageProfitDistribution) {
            setError('You do not have permission to process profit distributions.');
            return;
        }
        if (!branchId) return;
        setProcessing(true);
        setError(null);
        try {
            const batch = await accountingApi.processProfitDistribution({
                branch_id: branchId,
                period_start: periodStart,
                period_end: periodEnd,
                distribution_frequency: distributionFrequency,
            });
            setSelectedHistory(batch);
            await loadPreview();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to process distribution');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}><PiggyBank size={18} /></div>
                    <div>
                        <h1>Profit Distribution</h1>
                        <p>Period-based investor calculations built on branch P&amp;L.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-section)', border: '1px solid var(--glass-border)' }}>
                        <Building2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                        <KitchenSelect options={branchOptions} value={branchId} onChange={(event) => setBranchId(event.target.value)} />
                    </div>
                </div>
            </header>

            {error && <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--danger, #ef4444)' }}>{error}</div>}
            {!canViewProfitDistribution && (
                <div className={styles.polishedPanel} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                    You do not have permission to access profit distribution.
                </div>
            )}

            <div className={`${styles.polishedPanel} ${styles.cycleCard}`}>
                <div className={styles.cycleRow}>
                    <div className={styles.cycleField}>
                        <label>Cycle</label>
                        <KitchenSelect options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} value={distributionFrequency} onChange={(event) => setDistributionFrequency(event.target.value)} />
                    </div>
                    <div className={styles.cycleField}>
                        <KitchenInput label="Period Start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                    </div>
                    <div className={styles.cycleField}>
                        <KitchenInput label="Period End" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                    </div>
                    <div className={styles.cycleMeta}><Calendar size={14} /><span>{preview ? `${preview.period.day_count} days` : 'Select a valid period'}</span></div>
                    <div className={styles.cycleMeta}><Clock size={14} /><span>Net Profit: <strong>{formatCurrency(preview?.net_profit_amount ?? 0)}</strong></span></div>
                </div>
            </div>

            {preview?.warnings?.length ? (
                <div className={styles.polishedPanel} style={{ padding: 16, marginBottom: 16 }}>
                    {preview.warnings.map((warning) => <p key={warning} style={{ margin: 0, color: 'var(--warning, #f59e0b)' }}>{warning}</p>)}
                </div>
            ) : null}

            <div className={styles.polishedPanel}>
                <div className={styles.tableHeader}>
                    <h3>Distribution Preview</h3>
                    <div className={styles.tableHeaderRight}>
                        <span className={styles.totalBadge}>Total Payable: <strong>{formatCurrency(preview?.summary.total_distribution_amount ?? 0)}</strong></span>
                        <KitchenButton
                            variant="primary"
                            size="sm"
                            isLoading={processing}
                            disabled={!canManageProfitDistribution || !preview || !!preview.existing_batch || !preview.lines.length}
                            onClick={() => void processDistribution()}
                        >
                            <Play size={14} style={{ marginRight: 6 }} /> Process Distribution
                        </KitchenButton>
                    </div>
                </div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Investor</th>
                                <th>Agreement</th>
                                <th style={{ textAlign: 'right' }}>Capital</th>
                                <th style={{ textAlign: 'center' }}>Share %</th>
                                <th style={{ textAlign: 'center' }}>Fixed %</th>
                                <th style={{ textAlign: 'right' }}>Profit Share</th>
                                <th style={{ textAlign: 'right' }}>Fixed Return</th>
                                <th style={{ textAlign: 'right' }}>Payable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview?.lines.map((line) => (
                                <tr key={`${line.investor_id}-${line.agreement_code}`} className={styles.row}>
                                    <td className={styles.investorCell}>{line.investor_name}</td>
                                    <td><span className={styles.modelBadge}>{line.agreement_code} | {line.agreement_name}</span></td>
                                    <td className={styles.amountCell}>{formatCurrency(line.capital_basis_amount)}</td>
                                    <td style={{ textAlign: 'center' }}>{line.profit_share_percent}%</td>
                                    <td style={{ textAlign: 'center' }}>{line.fixed_return_percent}%</td>
                                    <td className={styles.amountCell}>{formatCurrency(line.profit_share_amount)}</td>
                                    <td className={styles.amountCell}>{formatCurrency(line.fixed_return_amount)}</td>
                                    <td className={styles.amountCell}><strong>{formatCurrency(line.net_distribution_amount)}</strong></td>
                                </tr>
                            ))}
                            {!loading && !preview?.lines.length && (
                                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No active agreements are eligible for this branch and period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.polishedPanel}>
                <div className={styles.tableHeader}><h3>Distribution History</h3></div>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Cycle</th>
                                <th>Period</th>
                                <th>Branch</th>
                                <th style={{ textAlign: 'right' }}>Distributed</th>
                                <th>Date</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ width: 40 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((batch) => (
                                <tr key={batch.id} className={styles.row}>
                                    <td><span className={styles.idBadge}>{batch.batch_code ?? `DIST-${batch.id}`}</span></td>
                                    <td>{batch.distribution_frequency}</td>
                                    <td className={styles.investorCell}>{batch.period_start} to {batch.period_end}</td>
                                    <td>{batch.branch_name ?? '-'}</td>
                                    <td className={styles.amountCell}>{formatCurrency(batch.total_distribution_amount)}</td>
                                    <td className={styles.dateCell}>{batch.processed_at ? new Date(batch.processed_at).toLocaleDateString() : '-'}</td>
                                    <td style={{ textAlign: 'center' }}><span className={`${styles.statusBadge} ${styles.statusCompleted}`}><CheckCircle2 size={10} /> {batch.status}</span></td>
                                    <td>
                                        <button className={styles.actionBtn} onClick={() => setSelectedHistory(batch)} title="View Details">
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && history.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No processed distributions found for this branch yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedHistory && (
                <div className={styles.modalOverlay} onClick={() => setSelectedHistory(null)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Distribution Summary</h2>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{selectedHistory.batch_code ?? `DIST-${selectedHistory.id}`} | {selectedHistory.period_start} to {selectedHistory.period_end}</p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setSelectedHistory(null)}><X size={16} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.statsRow}>
                                <div className={styles.statBox}><span>Investors</span><strong>{selectedHistory.lines.length}</strong></div>
                                <div className={styles.statBox}><span>Total Distributed</span><strong>{formatCurrency(selectedHistory.total_distribution_amount)}</strong></div>
                            </div>
                            <table className={styles.table} style={{ marginTop: 16 }}>
                                <thead>
                                    <tr>
                                        <th>Investor</th>
                                        <th style={{ textAlign: 'right' }}>Net Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedHistory.lines.map((line) => (
                                        <tr key={line.id} className={styles.row}>
                                            <td>{line.investor_name}</td>
                                            <td className={styles.amountCell}>{formatCurrency(line.net_distribution_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={styles.modalFooter}>
                            <KitchenButton variant="primary" size="sm" onClick={() => setSelectedHistory(null)}>Close</KitchenButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
