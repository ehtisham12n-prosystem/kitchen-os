import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Clock, Search, Send, X } from 'lucide-react';
import styles from './AssetTransfer.module.css';
import { accountingApi } from '../../../api/api';
import { useBranchContext } from '../../../hooks/useBranchContext';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';

type Branch = { id: number; branch_name?: string; name?: string };
type Unit = {
    id: number;
    tag_no: string;
    serial_no: string | null;
    model: string | null;
    branch_id: number;
    branch_name: string | null;
    physical_location: string | null;
    condition: string;
    operational_status: string;
};

type Movement = {
    id: number;
    asset_unit_id: number;
    asset_tag_no: string | null;
    asset_name: string | null;
    movement_type: string;
    movement_date: string;
    from_branch_name: string | null;
    to_branch_name: string | null;
    authorized_by: string | null;
    received_by: string | null;
    to_location: string | null;
};

type Draft = {
    to_branch_id: string;
    transfer_date: string;
    received_by: string;
    authorized_by: string;
    vehicle_no: string;
    gate_pass_no: string;
    destination_location: string;
    notes: string;
};

const today = new Date().toISOString().slice(0, 10);

export function AssetTransfer() {
    const navigate = useNavigate();
    const { branches: allowedBranches } = useBranchContext();
    const { canManageAssets } = usePermissionAccess();
    const [units, setUnits] = useState<Unit[]>([]);
    const [history, setHistory] = useState<Movement[]>([]);
    const [search, setSearch] = useState('');
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft>({
        to_branch_id: '',
        transfer_date: today,
        received_by: '',
        authorized_by: '',
        vehicle_no: '',
        gate_pass_no: '',
        destination_location: '',
        notes: '',
    });

    const branchOptions = useMemo<Branch[]>(
        () => allowedBranches.map((branch) => ({
            id: Number(branch.branch_id ?? branch.id ?? 0),
            branch_name: branch.branch_name || (branch.id ? `Branch ${branch.id}` : undefined),
        })).filter((branch) => Number.isFinite(branch.id) && branch.id > 0),
        [allowedBranches],
    );

    async function load() {
        setLoading(true);
        setError('');
        try {
            const [assetData] = await Promise.all([accountingApi.getFixedAssetRegister()]);
            setUnits((assetData.units ?? []).filter((unit: Unit) => unit.operational_status === 'in_store'));
            setHistory((assetData.movements ?? []).filter((movement: Movement) => movement.movement_type === 'transfer'));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load transfer data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

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
            to_branch_id: '',
            transfer_date: today,
            received_by: '',
            authorized_by: '',
            vehicle_no: '',
            gate_pass_no: '',
            destination_location: '',
            notes: '',
        });
    }

    async function submit() {
        if (!selectedUnit) return;
        if (!canManageAssets) {
            setError('You do not have permission to transfer fixed assets.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await accountingApi.transferFixedAssetUnit(selectedUnit.id, {
                to_branch_id: Number(draft.to_branch_id),
                transfer_date: draft.transfer_date,
                received_by: draft.received_by,
                authorized_by: draft.authorized_by,
                vehicle_no: draft.vehicle_no || undefined,
                gate_pass_no: draft.gate_pass_no || undefined,
                destination_location: draft.destination_location || undefined,
                notes: draft.notes || undefined,
            });
            closeForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to transfer asset.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <button className={styles.btnIcon} onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
                    <div className={styles.titleIconWrap}><ArrowRightLeft size={20} /></div>
                    <div>
                        <h1 className={styles.pageTitle}>Inter-Branch Asset Transfer</h1>
                        <p className={styles.pageSubtitle}>Live branch-to-branch transfer control for in-store asset units.</p>
                    </div>
                </div>
            </div>

            {error && <div className={styles.successBanner} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{error}</div>}
            {!canManageAssets && <div className={styles.successBanner} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>You do not have permission to manage asset transfers.</div>}

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{units.length}</div><div className={styles.kpiLabel}>Transferable Units</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{history.length}</div><div className={styles.kpiLabel}>Transfer History</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{branchOptions.length}</div><div className={styles.kpiLabel}>Active Branches</div></div>
            </div>

            <div className={styles.mainCard}>
                <div className={styles.tabBar}>
                    <button className={`${styles.tab} ${styles.tabActive}`}><Send size={14} /> Transfer Queue</button>
                    <button className={styles.tab}><Clock size={14} /> History</button>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchWrap}>
                        <Search size={14} className={styles.searchIcon} />
                        <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tag, serial, branch, location..." />
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Tag</th>
                                <th>Current Branch</th>
                                <th>Location</th>
                                <th>Condition</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5}>Loading...</td></tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr><td colSpan={5}>No in-store units available for transfer.</td></tr>
                            ) : filteredUnits.map((unit) => (
                                <tr key={unit.id}>
                                    <td>
                                        <div><strong>{unit.tag_no}</strong></div>
                                        <div className={styles.assetModel}>{unit.model ?? unit.serial_no ?? '—'}</div>
                                    </td>
                                    <td>{unit.branch_name ?? '—'}</td>
                                    <td>{unit.physical_location ?? '—'}</td>
                                    <td>{unit.condition.replaceAll('_', ' ')}</td>
                                    <td><button className={styles.actionBtnTransfer} onClick={() => setSelectedUnit(unit)}>Transfer</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className={styles.tableWrap} style={{ marginTop: 20 }}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Asset</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Authorized / Received</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.slice(0, 10).length === 0 ? (
                                <tr><td colSpan={5}>No transfer history yet.</td></tr>
                            ) : history.slice(0, 10).map((movement) => (
                                <tr key={movement.id}>
                                    <td>{movement.movement_date}</td>
                                    <td>{movement.asset_tag_no ?? movement.asset_name ?? '—'}</td>
                                    <td>{movement.from_branch_name ?? '—'}</td>
                                    <td>{movement.to_branch_name ?? '—'}{movement.to_location ? ` · ${movement.to_location}` : ''}</td>
                                    <td>{movement.authorized_by ?? '—'} / {movement.received_by ?? '—'}</td>
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
                                <div className={styles.drawerAssetSub}>{selectedUnit.branch_name ?? '—'} · {selectedUnit.physical_location ?? '—'}</div>
                            </div>
                            <button className={styles.drawerClose} onClick={closeForm}><X size={16} /></button>
                        </div>
                        <div className={styles.drawerBody}>
                            <div className={styles.drawerSectionTitle}><ArrowRightLeft size={14} /> Transfer Details</div>
                            <div className={styles.formGrid}>
                                <div className={styles.fieldGroup}>
                                    <label>To Branch</label>
                                    <select className={styles.select} value={draft.to_branch_id} onChange={(e) => setDraft((prev) => ({ ...prev, to_branch_id: e.target.value }))}>
                                        <option value="">Select branch</option>
                                        {branchOptions.filter((branch) => branch.id !== selectedUnit.branch_id).map((branch) => (
                                            <option key={branch.id} value={branch.id}>{branch.branch_name ?? branch.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.fieldGroup}><label>Transfer Date</label><input className={styles.input} type="date" value={draft.transfer_date} onChange={(e) => setDraft((prev) => ({ ...prev, transfer_date: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Authorized By</label><input className={styles.input} value={draft.authorized_by} onChange={(e) => setDraft((prev) => ({ ...prev, authorized_by: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Received By</label><input className={styles.input} value={draft.received_by} onChange={(e) => setDraft((prev) => ({ ...prev, received_by: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Destination Location</label><input className={styles.input} value={draft.destination_location} onChange={(e) => setDraft((prev) => ({ ...prev, destination_location: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Gate Pass No.</label><input className={styles.input} value={draft.gate_pass_no} onChange={(e) => setDraft((prev) => ({ ...prev, gate_pass_no: e.target.value }))} /></div>
                                <div className={styles.fieldGroup}><label>Vehicle / Transport Ref.</label><input className={styles.input} value={draft.vehicle_no} onChange={(e) => setDraft((prev) => ({ ...prev, vehicle_no: e.target.value }))} /></div>
                                <div className={`${styles.fieldGroup} ${styles.spanFull}`}><label>Notes</label><textarea className={styles.textarea} rows={3} value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} /></div>
                            </div>
                            <div className={styles.formActions}>
                                <button className={styles.btnSecondary} onClick={closeForm}>Cancel</button>
                                <button className={styles.btnTransfer} onClick={() => void submit()} disabled={saving || !draft.to_branch_id || !draft.authorized_by.trim() || !draft.received_by.trim()}>
                                    Confirm Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
