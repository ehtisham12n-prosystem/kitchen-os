import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Trash2, TrendingDown, X } from 'lucide-react';
import styles from './AssetDispose.module.css';
import { accountingApi } from '../../../api/api';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';

type Account = {
    id: number;
    account_name: string;
    is_cash_account?: boolean;
    is_bank_account?: boolean;
    branch_id?: number | null;
};

type Unit = {
    id: number;
    tag_no: string;
    serial_no: string | null;
    model: string | null;
    branch_id: number;
    branch_name: string | null;
    physical_location: string | null;
    purchase_price: number;
    condition: string;
    operational_status: string;
    depreciation_schedule: {
        accumulated_depreciation: number;
        book_value: number;
    };
};

type Draft = {
    method: string;
    disposal_no: string;
    date: string;
    salvage_value: string;
    recipient_buyer: string;
    approved_by: string;
    reason_code: string;
    treasury_account_id: string;
    notes: string;
};

const today = new Date().toISOString().slice(0, 10);
const REASONS = [
    { value: 'end_of_life', label: 'End of Life / Age' },
    { value: 'beyond_repair', label: 'Beyond Repair' },
    { value: 'obsolete', label: 'Obsolete' },
    { value: 'irreparable_damage', label: 'Irreparable Damage' },
    { value: 'upgrade_replacement', label: 'Upgrade Replacement' },
];

function formatMoney(value?: number | null) {
    return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

export function AssetDispose() {
    const navigate = useNavigate();
    const { canManageAssets } = usePermissionAccess();
    const [units, setUnits] = useState<Unit[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [search, setSearch] = useState('');
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft>({
        method: 'written_off',
        disposal_no: '',
        date: today,
        salvage_value: '',
        recipient_buyer: '',
        approved_by: '',
        reason_code: '',
        treasury_account_id: '',
        notes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [assetData, accountData] = await Promise.all([
                accountingApi.getFixedAssetRegister(),
                canManageAssets ? accountingApi.getAccounts() : Promise.resolve([]),
            ]);
            setUnits((assetData.units ?? []).filter((unit: Unit) => unit.operational_status !== 'disposed' && unit.operational_status !== 'assigned'));
            setAccounts((accountData ?? []).filter((account: Account) => account.is_cash_account || account.is_bank_account));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load disposal queue.');
        } finally {
            setLoading(false);
        }
    }, [canManageAssets]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredUnits = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return units;
        return units.filter((unit) =>
            `${unit.tag_no} ${unit.serial_no ?? ''} ${unit.model ?? ''} ${unit.branch_name ?? ''} ${unit.physical_location ?? ''}`
                .toLowerCase()
                .includes(q),
        );
    }, [search, units]);

    function closeForm() {
        setSelectedUnit(null);
        setDraft({
            method: 'written_off',
            disposal_no: '',
            date: today,
            salvage_value: '',
            recipient_buyer: '',
            approved_by: '',
            reason_code: '',
            treasury_account_id: '',
            notes: '',
        });
    }

    async function submit() {
        if (!selectedUnit) return;
        if (!canManageAssets) {
            setError('You do not have permission to dispose fixed assets.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await accountingApi.disposeFixedAssetUnit(selectedUnit.id, {
                branch_id: selectedUnit.branch_id,
                method: draft.method,
                disposal_no: draft.disposal_no || undefined,
                date: draft.date,
                salvage_value: draft.salvage_value ? Number(draft.salvage_value) : 0,
                recipient_buyer: draft.recipient_buyer || undefined,
                approved_by: draft.approved_by,
                reason_code: draft.reason_code,
                treasury_account_id: draft.treasury_account_id ? Number(draft.treasury_account_id) : undefined,
                notes: draft.notes || undefined,
            });
            closeForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to dispose asset.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <button className={styles.btnIcon} onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
                    <div className={styles.titleIconWrap}><TrendingDown size={20} /></div>
                    <div>
                        <h1 className={styles.pageTitle}>Asset Disposal</h1>
                        <p className={styles.pageSubtitle}>Write-off, sale, and disposal posting for fixed asset units.</p>
                    </div>
                </div>
            </div>

            {error && <div className={styles.successBanner} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{error}</div>}
            {!canManageAssets && <div className={styles.successBanner} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>You do not have permission to manage asset disposal.</div>}

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{units.length}</div><div className={styles.kpiLabel}>Eligible Units</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{formatMoney(units.reduce((sum, unit) => sum + unit.purchase_price, 0))}</div><div className={styles.kpiLabel}>Gross Cost In Queue</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{formatMoney(units.reduce((sum, unit) => sum + unit.depreciation_schedule.book_value, 0))}</div><div className={styles.kpiLabel}>Net Book Value In Queue</div></div>
            </div>

            <div className={styles.mainCard}>
                <div className={styles.toolbar}>
                    <div className={styles.searchWrap}>
                        <Search size={14} className={styles.searchIcon} />
                        <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search disposal queue..." />
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Tag</th>
                                <th>Branch / Location</th>
                                <th>Cost</th>
                                <th>Book Value</th>
                                <th>Condition</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}>Loading...</td></tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr><td colSpan={6}>No disposal candidates in scope.</td></tr>
                            ) : filteredUnits.map((unit) => (
                                <tr key={unit.id}>
                                    <td>
                                        <div><strong>{unit.tag_no}</strong></div>
                                        <div className={styles.assetModel}>{unit.model ?? unit.serial_no ?? '—'}</div>
                                    </td>
                                    <td>{unit.branch_name ?? '—'} · {unit.physical_location ?? '—'}</td>
                                    <td>{formatMoney(unit.purchase_price)}</td>
                                    <td>{formatMoney(unit.depreciation_schedule.book_value)}</td>
                                    <td>{unit.condition.replaceAll('_', ' ')}</td>
                                    <td><button className={styles.actionBtnDispose} onClick={() => setSelectedUnit(unit)}>Dispose</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUnit && (
                <div className={styles.formOverlay} onClick={closeForm}>
                    <div className={styles.formDrawer} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.drawerHeader}>
                            <div>
                                <div className={styles.drawerAssetName}>{selectedUnit.tag_no}</div>
                                <div className={styles.drawerAssetSub}>
                                    {selectedUnit.branch_name ?? '—'} · Book value {formatMoney(selectedUnit.depreciation_schedule.book_value)}
                                </div>
                            </div>
                            <button className={styles.drawerClose} onClick={closeForm}><X size={16} /></button>
                        </div>
                        <div className={styles.drawerBody}>
                            <div className={styles.drawerSectionTitle}><Trash2 size={14} /> Disposal Authorization</div>
                            <div className={styles.formGrid}>
                                <div className={styles.fieldGroup}>
                                    <label>Method</label>
                                    <select className={styles.select} value={draft.method} onChange={(e) => setDraft((prev) => ({ ...prev, method: e.target.value, treasury_account_id: '' }))}>
                                        <option value="written_off">Written Off</option>
                                        <option value="scrapped">Scrapped</option>
                                        <option value="sold">Sold</option>
                                        <option value="auctioned">Auctioned</option>
                                        <option value="donated">Donated</option>
                                        <option value="transferred">Transferred</option>
                                    </select>
                                </div>
                                <div className={styles.fieldGroup}><label>Disposal Date</label><input className={styles.input} type="date" value={draft.date} onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Reference No.</label><input className={styles.input} value={draft.disposal_no} onChange={(e) => setDraft((prev) => ({ ...prev, disposal_no: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Approved By</label><input className={styles.input} value={draft.approved_by} onChange={(e) => setDraft((prev) => ({ ...prev, approved_by: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}>
                                    <label>Reason Code</label>
                                    <select className={styles.select} value={draft.reason_code} onChange={(e) => setDraft((prev) => ({ ...prev, reason_code: e.target.value }))}>
                                        <option value="">Select reason</option>
                                        {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                                    </select>
                                </div>
                                <div className={styles.fieldGroup}><label>Recovery Amount</label><input className={styles.input} type="number" value={draft.salvage_value} onChange={(e) => setDraft((prev) => ({ ...prev, salvage_value: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Recipient / Buyer</label><input className={styles.input} value={draft.recipient_buyer} onChange={(e) => setDraft((prev) => ({ ...prev, recipient_buyer: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}>
                                    <label>Treasury Account</label>
                                    <select className={styles.select} value={draft.treasury_account_id} onChange={(e) => setDraft((prev) => ({ ...prev, treasury_account_id: e.target.value }))}>
                                        <option value="">Select account</option>
                                        {accounts
                                            .filter((account) => !account.branch_id || account.branch_id === selectedUnit.branch_id)
                                            .map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
                                    </select>
                                </div>
                                <div className={`${styles.fieldGroup} ${styles.spanFull}`}>
                                    <label>Notes</label>
                                    <textarea className={styles.textarea} rows={3} value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                                </div>
                            </div>
                            <div className={styles.formActions}>
                                <button className={styles.btnSecondary} onClick={closeForm}>Cancel</button>
                                <button className={styles.btnDispose} onClick={() => void submit()} disabled={saving || !draft.approved_by.trim() || !draft.reason_code}>
                                    Confirm Disposal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
