import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Search, TrendingUp, X } from 'lucide-react';
import styles from './AssetIssue.module.css';
import { accountingApi } from '../../../api/api';
import { usePermissionAccess } from '../../../hooks/usePermissionAccess';

type AssetUnit = {
    id: number;
    tag_no: string;
    serial_no: string | null;
    model: string | null;
    branch_id: number;
    branch_name: string | null;
    physical_location: string | null;
    issued_to: string | null;
    custodian_id: string | null;
    issued_date: string | null;
    expected_return: string | null;
    condition: string;
    operational_status: string;
    asset_item_no: string | null;
};

type IssueDraft = {
    issue_to: string;
    custodian_id: string;
    location: string;
    issue_date: string;
    expected_return: string;
    handover_condition: string;
    comments: string;
};

type ReturnDraft = {
    return_date: string;
    return_condition: string;
    location: string;
    incident_report: string;
    comments: string;
};

const today = new Date().toISOString().slice(0, 10);

export function AssetIssue() {
    const navigate = useNavigate();
    const { canManageAssets } = usePermissionAccess();
    const [units, setUnits] = useState<AssetUnit[]>([]);
    const [activeTab, setActiveTab] = useState<'issue' | 'return'>('issue');
    const [search, setSearch] = useState('');
    const [selectedUnit, setSelectedUnit] = useState<AssetUnit | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [issueDraft, setIssueDraft] = useState<IssueDraft>({
        issue_to: '',
        custodian_id: '',
        location: '',
        issue_date: today,
        expected_return: '',
        handover_condition: 'working',
        comments: '',
    });
    const [returnDraft, setReturnDraft] = useState<ReturnDraft>({
        return_date: today,
        return_condition: 'working',
        location: '',
        incident_report: '',
        comments: '',
    });

    async function load() {
        setLoading(true);
        setError('');
        try {
            const data = await accountingApi.getFixedAssetRegister();
            setUnits(data.units ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load assets.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    const filteredUnits = useMemo(() => {
        const targetStatus = activeTab === 'issue' ? 'in_store' : 'assigned';
        const q = search.trim().toLowerCase();
        return units.filter((unit) => {
            if (unit.operational_status !== targetStatus) return false;
            if (!q) return true;
            return `${unit.tag_no} ${unit.serial_no ?? ''} ${unit.model ?? ''} ${unit.branch_name ?? ''} ${unit.physical_location ?? ''} ${unit.issued_to ?? ''}`
                .toLowerCase()
                .includes(q);
        });
    }, [activeTab, search, units]);

    const stats = {
        total: units.length,
        inStore: units.filter((unit) => unit.operational_status === 'in_store').length,
        assigned: units.filter((unit) => unit.operational_status === 'assigned').length,
        overdue: units.filter((unit) => unit.operational_status === 'assigned' && unit.expected_return && unit.expected_return < today).length,
    };

    function closeForm() {
        setSelectedUnit(null);
        setIssueDraft({
            issue_to: '',
            custodian_id: '',
            location: '',
            issue_date: today,
            expected_return: '',
            handover_condition: 'working',
            comments: '',
        });
        setReturnDraft({
            return_date: today,
            return_condition: 'working',
            location: '',
            incident_report: '',
            comments: '',
        });
    }

    async function submitIssue() {
        if (!selectedUnit) return;
        if (!canManageAssets) {
            setError('You do not have permission to issue fixed assets.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await accountingApi.issueFixedAssetUnit(selectedUnit.id, {
                branch_id: selectedUnit.branch_id,
                issue_to: issueDraft.issue_to,
                custodian_id: issueDraft.custodian_id || undefined,
                location: issueDraft.location,
                issue_date: issueDraft.issue_date,
                expected_return: issueDraft.expected_return || undefined,
                handover_condition: issueDraft.handover_condition,
                comments: issueDraft.comments || undefined,
            });
            closeForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to issue asset.');
        } finally {
            setSaving(false);
        }
    }

    async function submitReturn() {
        if (!selectedUnit) return;
        if (!canManageAssets) {
            setError('You do not have permission to return fixed assets.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await accountingApi.returnFixedAssetUnit(selectedUnit.id, {
                return_date: returnDraft.return_date,
                return_condition: returnDraft.return_condition,
                location: returnDraft.location || undefined,
                incident_report: returnDraft.incident_report || undefined,
                comments: returnDraft.comments || undefined,
            });
            closeForm();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to return asset.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <button className={styles.btnIcon} onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
                    <div className={styles.titleIconWrap}>{activeTab === 'issue' ? <TrendingUp size={20} /> : <RotateCcw size={20} />}</div>
                    <div>
                        <h1 className={styles.pageTitle}>Asset Issue & Return</h1>
                        <p className={styles.pageSubtitle}>Live custodian handover and return control for fixed assets.</p>
                    </div>
                </div>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}
            {!canManageAssets && <div className={styles.errorBanner}>You do not have permission to manage fixed-asset issue and return.</div>}

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{stats.total}</div><div className={styles.kpiLabel}>Active Units</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{stats.inStore}</div><div className={styles.kpiLabel}>Ready To Issue</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{stats.assigned}</div><div className={styles.kpiLabel}>Assigned</div></div>
                <div className={styles.kpiCard}><div className={styles.kpiValue}>{stats.overdue}</div><div className={styles.kpiLabel}>Overdue Returns</div></div>
            </div>

            <div className={styles.mainCard}>
                <div className={styles.tabBar}>
                    <button className={`${styles.tab} ${activeTab === 'issue' ? styles.tabActive : ''}`} onClick={() => setActiveTab('issue')}>
                        <TrendingUp size={14} /> Issue
                    </button>
                    <button className={`${styles.tab} ${activeTab === 'return' ? styles.tabActive : ''}`} onClick={() => setActiveTab('return')}>
                        <RotateCcw size={14} /> Return
                    </button>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchWrap}>
                        <Search size={14} className={styles.searchIcon} />
                        <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tag, serial, branch, custodian..." />
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Tag</th>
                                <th>Branch / Location</th>
                                <th>Status</th>
                                <th>{activeTab === 'issue' ? 'Available At' : 'Custodian'}</th>
                                <th>{activeTab === 'issue' ? 'Action' : 'Due Return'}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}>Loading...</td></tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr><td colSpan={6}>No asset units match this queue.</td></tr>
                            ) : filteredUnits.map((unit) => (
                                <tr key={unit.id} className={selectedUnit?.id === unit.id ? styles.tableRowActive : styles.tableRow}>
                                    <td>
                                        <div><strong>{unit.tag_no}</strong></div>
                                        <div className={styles.assetModel}>{unit.model ?? unit.serial_no ?? '—'}</div>
                                    </td>
                                    <td>
                                        <div>{unit.branch_name ?? '—'}</div>
                                        <div className={styles.locationCell}>{unit.physical_location ?? '—'}</div>
                                    </td>
                                    <td>{unit.condition.replaceAll('_', ' ')}</td>
                                    <td>
                                        {activeTab === 'issue'
                                            ? unit.physical_location ?? '—'
                                            : `${unit.issued_to ?? '—'}${unit.custodian_id ? ` (${unit.custodian_id})` : ''}`}
                                    </td>
                                    <td>{activeTab === 'issue' ? unit.branch_name ?? '—' : unit.expected_return ?? '—'}</td>
                                    <td>
                                        <button className={activeTab === 'issue' ? styles.btnIssue : styles.btnReturn} onClick={() => setSelectedUnit(unit)}>
                                            {activeTab === 'issue' ? 'Issue' : 'Return'}
                                        </button>
                                    </td>
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
                                <div className={styles.drawerAssetSub}>{selectedUnit.model ?? selectedUnit.serial_no ?? selectedUnit.asset_item_no ?? ''}</div>
                            </div>
                            <button className={styles.drawerClose} onClick={closeForm}><X size={16} /></button>
                        </div>
                        <div className={styles.drawerBody}>
                            {activeTab === 'issue' ? (
                                <>
                                    <div className={styles.drawerSectionTitle}><TrendingUp size={14} /> Issue Asset</div>
                                    <div className={styles.formGrid}>
                                        <div className={styles.fieldGroup}><label>Issued To</label><input className={styles.input} value={issueDraft.issue_to} onChange={(e) => setIssueDraft((prev) => ({ ...prev, issue_to: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}><label>Custodian ID</label><input className={styles.input} value={issueDraft.custodian_id} onChange={(e) => setIssueDraft((prev) => ({ ...prev, custodian_id: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}><label>Location</label><input className={styles.input} value={issueDraft.location} onChange={(e) => setIssueDraft((prev) => ({ ...prev, location: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}><label>Issue Date</label><input className={styles.input} type="date" value={issueDraft.issue_date} onChange={(e) => setIssueDraft((prev) => ({ ...prev, issue_date: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}><label>Expected Return</label><input className={styles.input} type="date" value={issueDraft.expected_return} onChange={(e) => setIssueDraft((prev) => ({ ...prev, expected_return: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}>
                                            <label>Handover Condition</label>
                                            <select className={styles.select} value={issueDraft.handover_condition} onChange={(e) => setIssueDraft((prev) => ({ ...prev, handover_condition: e.target.value }))}>
                                                <option value="working">Working</option>
                                                <option value="service_required">Service Required</option>
                                                <option value="damaged">Damaged</option>
                                            </select>
                                        </div>
                                        <div className={`${styles.fieldGroup} ${styles.spanFull}`}>
                                            <label>Comments</label>
                                            <textarea className={styles.textarea} rows={3} value={issueDraft.comments} onChange={(e) => setIssueDraft((prev) => ({ ...prev, comments: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className={styles.formActions}>
                                        <button className={styles.btnSecondary} onClick={closeForm}>Cancel</button>
                                        <button className={styles.btnIssue} onClick={() => void submitIssue()} disabled={saving || !issueDraft.issue_to.trim() || !issueDraft.location.trim()}>
                                            Confirm Issue
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={styles.drawerSectionTitle}><RotateCcw size={14} /> Return Asset</div>
                                    <div className={styles.returnContext}>
                                        <div className={styles.returnContextRow}>Current Custodian: <strong>{selectedUnit.issued_to ?? '—'}</strong></div>
                                        <div className={styles.returnContextRow}>Due Return: <strong>{selectedUnit.expected_return ?? '—'}</strong></div>
                                    </div>
                                    <div className={styles.formGrid}>
                                        <div className={styles.fieldGroup}><label>Return Date</label><input className={styles.input} type="date" value={returnDraft.return_date} onChange={(e) => setReturnDraft((prev) => ({ ...prev, return_date: e.target.value }))} /></div>
                                        <div className={styles.fieldGroup}>
                                            <label>Return Condition</label>
                                            <select className={styles.select} value={returnDraft.return_condition} onChange={(e) => setReturnDraft((prev) => ({ ...prev, return_condition: e.target.value }))}>
                                                <option value="working">Working</option>
                                                <option value="service_required">Service Required</option>
                                                <option value="damaged">Damaged</option>
                                            </select>
                                        </div>
                                        <div className={styles.fieldGroup}><label>Return Location</label><input className={styles.input} value={returnDraft.location} onChange={(e) => setReturnDraft((prev) => ({ ...prev, location: e.target.value }))} /></div>
                                        <div className={`${styles.fieldGroup} ${styles.spanFull}`}><label>Incident Report</label><textarea className={styles.textarea} rows={2} value={returnDraft.incident_report} onChange={(e) => setReturnDraft((prev) => ({ ...prev, incident_report: e.target.value }))} /></div>
                                        <div className={`${styles.fieldGroup} ${styles.spanFull}`}><label>Comments</label><textarea className={styles.textarea} rows={2} value={returnDraft.comments} onChange={(e) => setReturnDraft((prev) => ({ ...prev, comments: e.target.value }))} /></div>
                                    </div>
                                    <div className={styles.formActions}>
                                        <button className={styles.btnSecondary} onClick={closeForm}>Cancel</button>
                                        <button className={styles.btnReturn} onClick={() => void submitReturn()} disabled={saving}>
                                            Process Return
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
