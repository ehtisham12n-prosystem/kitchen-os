/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ShieldAlert, CheckCircle2, DollarSign, Calendar, Hash, Lock, History, AlertCircle } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { branchApi, posApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { clearActiveTillSession, getActiveTillSession } from './terminalSession';
import styles from './ShiftRegister.module.css';

export function ShiftRegister() {
    const navigate = useNavigate();
    const { currencyLabel, formatMoney } = useCurrencyConfig();
    const [isClosing, setIsClosing] = useState(false);
    const [branches, setBranches] = useState<{ value: string; label: string }[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(() => localStorage.getItem('activeBranchId') || '');
    const [currentShift, setCurrentShift] = useState<any | null>(null);
    const [countedCash, setCountedCash] = useState('');
    const [supervisorPin, setSupervisorPin] = useState('');
    const [currentUserName, setCurrentUserName] = useState('Current User');

    useEffect(() => {
        try {
            const parsed = readStoredUserContext();
            if (parsed?.username || parsed?.user_name) {
                setCurrentUserName(parsed.username || parsed.user_name || 'Current User');
            }
        } catch {
            // ignore malformed storage
        }
    }, []);

    const init = useCallback(async () => {
        try {
            const data = await branchApi.getBranches();
            const mapped = data.map((branch: any) => ({ value: branch.id.toString(), label: branch.branch_name }));
            setBranches(mapped);
            const fallbackBranch = selectedBranch || mapped[0]?.value || '';
            if (fallbackBranch) {
                setSelectedBranch(fallbackBranch);
                localStorage.setItem('activeBranchId', fallbackBranch);
                const match = mapped.find(branch => branch.value === fallbackBranch);
                if (match?.label) {
                    localStorage.setItem('branch_name', match.label);
                }
            }
        } catch (error) {
            console.error('Failed to load branches:', error);
            toast.error('POS Load Failed', 'Could not load available branches.');
        }
    }, [selectedBranch]);

    useEffect(() => {
        void init();
    }, [init]);

    useEffect(() => {
        if (!selectedBranch) {
            return;
        }

        const loadShift = async () => {
            try {
                const shift = await posApi.getCurrentShift(Number(selectedBranch));
                setCurrentShift(shift);
                setCountedCash(String(Number(shift.expected_cash || 0)));
            } catch (error: any) {
                setCurrentShift(null);
                const message = error?.message || '';
                if (!message.toLowerCase().includes('no active shift')) {
                    console.error('Failed to load current day session:', error);
                    toast.error('Day Session Load Failed', message || 'Could not load the active business day session.');
                }
            }
        };

        loadShift();
    }, [selectedBranch]);

    const activeTill = getActiveTillSession();
    const actualCount = parseFloat(countedCash) || 0;
    const variance = actualCount - Number(currentShift?.expected_cash || 0);
    const isDiscrepancy = countedCash !== '' && variance !== 0;

    const branchName = useMemo(() => {
        return branches.find(branch => branch.value === selectedBranch)?.label || localStorage.getItem('branch_name') || 'Selected Branch';
    }, [branches, selectedBranch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentShift || !selectedBranch) {
            return;
        }

        setIsClosing(true);
        try {
            await posApi.closeShift(Number(selectedBranch), currentShift.id, {
                actual_cash: Number(countedCash || 0),
            });
            clearActiveTillSession();
            toast.success('Day Session Closed', `Day session #${currentShift.id} has been closed for ${branchName}.`);
            navigate('/console/reports/sales');
        } catch (error: any) {
            console.error('Failed to close day session:', error);
            toast.error('Day Session Close Failed', error?.message || 'Could not close the current business day session.');
        } finally {
            setIsClosing(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <KitchenButton variant="ghost" size="sm" onClick={() => navigate('/console/reports/sales')}>
                        <ArrowLeft size={18} />
                    </KitchenButton>
                    <div>
                        <h1>Day Register</h1>
                        <p>Finalize the active business day session with the actual cash count and close it against persisted POS data.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.branchWrapper}>
                        <label className={styles.inputLabel}>Current Branch</label>
                        <KitchenSelect
                            options={branches}
                            value={selectedBranch}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedBranch(value);
                                localStorage.setItem('activeBranchId', value);
                                const match = branches.find(branch => branch.value === value);
                                if (match?.label) {
                                    localStorage.setItem('branch_name', match.label);
                                }
                            }}
                            className={styles.branchSelect}
                        />
                    </div>
                </div>
            </header>

            {!currentShift ? (
                <div className={styles.formLayout}>
                    <div className={styles.mainCol}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardContent}>
                                <div className={`${styles.varianceBanner} ${styles.varianceError}`}>
                                    <div className={styles.varianceHeader}>
                                        <AlertCircle size={20} />
                                        <strong>No Active Day Session</strong>
                                    </div>
                                    <div className={styles.varianceDetail}>
                                        <p>There is no open business day session for {branchName}. Open a till first before attempting day close.</p>
                                    </div>
                                </div>
                                <KitchenButton variant="primary" onClick={() => navigate('/terminal/till')}>
                                    Open Till
                                </KitchenButton>
                            </div>
                        </KitchenCard>
                    </div>
                </div>
            ) : (
                <form className={styles.formLayout} onSubmit={handleSubmit}>
                    <div className={styles.mainCol}>
                        <KitchenCard className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><DollarSign size={20} /> Day Reconciliation Summary</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.shiftMetaGrid}>
                                    <div className={styles.metaItem}>
                                        <label><Hash size={12} /> Day Session ID</label>
                                        <span>#{currentShift.id}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <label><Calendar size={12} /> Opened At</label>
                                        <span>{new Date(currentShift.opened_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <label>Terminal</label>
                                        <span>{activeTill ? `${activeTill.name} - ${activeTill.code}` : 'Branch Day Session'}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <label>Cashier</label>
                                        <span>{currentUserName}</span>
                                    </div>
                                </div>

                                <div className={styles.financeTable}>
                                    <div className={styles.financeRow}>
                                        <div className={styles.financeLabel}>
                                            <strong>Opening Float</strong>
                                            <p>Total cash present when the day session started</p>
                                        </div>
                                        <div className={styles.financeAmount}>{formatMoney(currentShift.opening_float || 0)}</div>
                                    </div>
                                    <div className={styles.financeRow}>
                                        <div className={styles.financeLabel}>
                                            <strong>Session Sales (Cash)</strong>
                                            <p>Total cash payments captured by POS close flow</p>
                                        </div>
                                        <div className={styles.financeAmount}>{formatMoney(Math.max(Number(currentShift.expected_cash || 0) - Number(currentShift.opening_float || 0), 0))}</div>
                                    </div>
                                    <div className={`${styles.financeRow} ${styles.financeTotalRow}`}>
                                        <div className={styles.financeLabel}>
                                            <strong>Expected Cash Balance</strong>
                                            <p>Calculated total based on live persisted orders and payments</p>
                                        </div>
                                        <div className={styles.financeAmountTotal}>{formatMoney(currentShift.expected_cash || 0)}</div>
                                    </div>
                                </div>

                                <div className={styles.entrySection}>
                                    <KitchenInput
                                        label={`Actual Counted Cash (${currencyLabel}) *`}
                                        type="number"
                                        placeholder="Enter physical cash amount..."
                                        required
                                        value={countedCash}
                                        onChange={(e) => setCountedCash(e.target.value)}
                                        icon={<DollarSign size={18} />}
                                        autoFocus
                                    />

                                    {countedCash && (
                                        <div className={`${styles.varianceBanner} ${isDiscrepancy ? styles.varianceError : styles.varianceMatch}`}>
                                            <div className={styles.varianceHeader}>
                                                {isDiscrepancy ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                                                <strong>{isDiscrepancy ? 'Reconciliation Discrepancy' : 'Balance Matches Perfectly'}</strong>
                                            </div>
                                            <div className={styles.varianceDetail}>
                                                <span>Variance: {variance > 0 ? '+' : ''}{formatMoney(Math.abs(variance))}</span>
                                                {isDiscrepancy && (
                                                    <p className={styles.varianceNote}>
                                                        The actual cash count does not match the persisted day-session expectation. This value will be saved on close.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </KitchenCard>
                    </div>

                    <div className={styles.sideCol}>
                        <KitchenCard className={styles.authCard}>
                            <div className={styles.cardHeader}>
                                <h3><Lock size={18} /> Final Authorization</h3>
                            </div>
                            <div className={styles.cardContent}>
                                <p className={styles.authInstructions}>
                                    Supervisor PIN remains an on-screen safeguard only here; the persisted close action is the live backend day-session close.
                                </p>

                                <KitchenInput
                                    label="Manager / Supervisor PIN"
                                    type="password"
                                    placeholder="...."
                                    value={supervisorPin}
                                    onChange={(e) => setSupervisorPin(e.target.value)}
                                    icon={<Lock size={16} />}
                                />

                                <div className={styles.actionWarning}>
                                    <ShieldAlert size={14} />
                                    <span>Closing the day session will persist actual cash, variance, and the close timestamp.</span>
                                </div>

                                <KitchenButton
                                    variant={isDiscrepancy ? 'danger' : 'primary'}
                                    type="submit"
                                    className={styles.submitBtn}
                                    isLoading={isClosing}
                                >
                                    <Save size={18} />
                                    {isDiscrepancy ? 'Persist & Close Day Session' : 'Close Day Session'}
                                </KitchenButton>

                                <KitchenButton
                                    variant="ghost"
                                    className={styles.historyBtn}
                                    onClick={() => navigate('/console/reports/sales')}
                                    type="button"
                                >
                                    <History size={16} />
                                    View Sales Report
                                </KitchenButton>
                            </div>
                        </KitchenCard>
                    </div>
                </form>
            )}
        </div>
    );
}
