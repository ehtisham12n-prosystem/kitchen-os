/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChefHat,
    Clock3,
    Package,
    Plus,
} from 'lucide-react';
import styles from './StockIssuance.module.css';
import { catalogApi, inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

interface BranchStockRow {
    id?: number;
    client_id?: number;
    item_id: number;
    current_quantity: number;
    last_unit_cost: number;
    item?: {
        item_name?: string;
        uom_base?: string;
        uom_purchase?: string;
        item_code?: string;
        item_sku?: string;
    };
}

interface IssuanceLine {
    id: string;
    item_id: number | null;
    quantity: string;
    uom: string;
}

interface KitchenStation {
    id: number | string;
    name: string;
    is_active?: boolean;
}

const createLineId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const newLine = (): IssuanceLine => ({
    id: createLineId(),
    item_id: null,
    quantity: '',
    uom: '',
});

const formatCurrency = (value: unknown) => (
    Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
);

const formatIssueDate = (value?: string | null) => (
    value ? new Date(value).toLocaleDateString('en-PK') : '-'
);

export function StockIssuance() {
    const navigate = useNavigate();
    const branchId = Number(resolveActiveBranchId() || 0);
    const [issuanceType, setIssuanceType] = useState<'auto' | 'manual'>('manual');
    const [issueTo, setIssueTo] = useState('Main Kitchen');
    const [kitchenStations, setKitchenStations] = useState<KitchenStation[]>([]);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [issuedBy, setIssuedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<IssuanceLine[]>([newLine()]);
    const [stockRows, setStockRows] = useState<BranchStockRow[]>([]);
    const [recentIssues, setRecentIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastReference, setLastReference] = useState('');

    const loadData = useCallback(async () => {
        if (!branchId) {
            setStockRows([]);
            setRecentIssues([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [stock, ledger, branchMaster, stations] = await Promise.all([
                inventoryApi.getBranchStock(branchId),
                inventoryApi.getLedger(branchId, {
                    transactionType: 'production',
                    limit: 40,
                }),
                inventoryApi.getBranchMaster({ branchId, limit: 500 }),
                catalogApi.getStations(),
            ]);

            const activeStations = (stations ?? [])
                .filter((station: KitchenStation) => station.is_active !== false)
                .sort((left: KitchenStation, right: KitchenStation) =>
                    String(left.name || '').localeCompare(String(right.name || '')),
                );
            setKitchenStations(activeStations);
            setIssueTo((current) => (
                activeStations.length > 0 && !activeStations.some((station: KitchenStation) => station.name === current)
                    ? activeStations[0].name
                    : current
            ));

            const levelsByItem = new Map((stock ?? []).map((row: BranchStockRow) => [Number(row.item_id), row]));
            setStockRows(
                (branchMaster?.items ?? [])
                    .map((item: any) => {
                        const level = levelsByItem.get(Number(item.id));
                        return {
                            id: level?.id,
                            client_id: level?.client_id,
                            branch_id: branchId,
                            item_id: Number(item.id),
                            current_quantity: Number(level?.current_quantity ?? item.current_stock ?? 0),
                            last_unit_cost: Number(level?.last_unit_cost ?? 0),
                            item: {
                                item_name: item.item_name,
                                item_code: item.item_code,
                                item_sku: item.item_sku,
                                uom_base: item.uom_base,
                                uom_purchase: item.uom_purchase,
                            },
                        };
                    })
                    .sort((left: BranchStockRow, right: BranchStockRow) =>
                        String(left.item?.item_name || '').localeCompare(String(right.item?.item_name || '')),
                    ),
            );
            setRecentIssues(ledger ?? []);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load stock issuance data.');
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const stockByItemId = useMemo(() => {
        const map = new Map<number, BranchStockRow>();
        for (const row of stockRows) {
            map.set(Number(row.item_id), row);
        }
        return map;
    }, [stockRows]);

    const addLine = () => {
        setLines((prev) => [...prev, newLine()]);
    };

    const removeLine = (id: string) => {
        if (lines.length === 1) {
            return;
        }
        setLines((prev) => prev.filter((line) => line.id !== id));
    };

    const updateLine = (id: string, field: keyof IssuanceLine, value: string) => {
        setLines((prev) => prev.map((line) => {
            if (line.id !== id) {
                return line;
            }
            if (field === 'item_id') {
                const itemId = value ? Number(value) : null;
                return {
                    ...line,
                    item_id: itemId,
                    uom: itemId ? stockByItemId.get(itemId)?.item?.uom_base || '' : '',
                };
            }
            return { ...line, [field]: value };
        }));
    };

    const totalValue = useMemo(() => lines.reduce((sum, line) => {
        const stock = line.item_id ? stockByItemId.get(line.item_id) : undefined;
        return sum + (Number(line.quantity || 0) * Number(stock?.last_unit_cost || 0));
    }, 0), [lines, stockByItemId]);

    const handlePost = async () => {
        if (!branchId) {
            toast.error('Branch Required', 'Select an active branch before issuing stock.');
            return;
        }

        const items = lines
            .map((line) => ({
                item_id: Number(line.item_id || 0),
                quantity: Number(line.quantity || 0),
                uom: line.uom || stockByItemId.get(Number(line.item_id || 0))?.item?.uom_base,
            }))
            .filter((line) => line.item_id > 0 && line.quantity > 0);

        if (items.length === 0) {
            toast.error('Issuance Required', 'Add at least one item with a positive issue quantity.');
            return;
        }

        const duplicateItemIds = new Set<number>();
        for (const item of items) {
            if (duplicateItemIds.has(item.item_id)) {
                toast.error('Validation Error', 'Each inventory item should appear only once in the same issue batch.');
                return;
            }
            duplicateItemIds.add(item.item_id);
        }

        const overIssue = items.find((item) => {
            const stock = stockByItemId.get(item.item_id);
            return Number(item.quantity) - Number(stock?.current_quantity || 0) > 0.0001;
        });
        if (overIssue) {
            const stock = stockByItemId.get(overIssue.item_id);
            toast.error(
                'Validation Error',
                `${stock?.item?.item_name || `Item #${overIssue.item_id}`} exceeds current stock.`,
            );
            return;
        }

        setSaving(true);
        try {
            const result = await inventoryApi.issueToKitchen(branchId, {
                branch_id: branchId,
                issue_to: issueTo || 'Kitchen',
                issuance_type: issuanceType,
                issue_date: issueDate,
                issued_by_name: issuedBy || undefined,
                notes: notes || undefined,
                items,
            });

            setLastReference(result.reference_id || '');
            setLines([newLine()]);
            setNotes('');
            toast.success('Issuance Posted', 'Kitchen stock issue has been posted to the inventory ledger.');
            await loadData();
        } catch (error: any) {
            toast.error('Issuance Failed', error.message || 'Could not post the kitchen issue.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => navigate('/console/inventory/issuance')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className={styles.titleRow}>
                            <ChefHat size={22} className={styles.titleIcon} />
                            <h1>Issue to Kitchen</h1>
                        </div>
                        <p className={styles.subtitle}>Post branch stock consumption into the inventory ledger with negative-stock control.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    {lastReference ? <div className={styles.issBadge}>{lastReference}</div> : null}
                    <button className={styles.btnSecondary} onClick={() => navigate('/console/inventory/issuance')}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={() => void handlePost()} disabled={saving || loading || !branchId}>
                        <CheckCircle2 size={16} />
                        {saving ? 'Posting...' : 'Post Issuance'}
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                <div className={styles.typeToggle}>
                    <div className={styles.toggleLabel}>Issuance Type:</div>
                    <button
                        className={`${styles.toggleBtn} ${issuanceType === 'manual' ? styles.toggleActive : ''}`}
                        onClick={() => setIssuanceType('manual')}
                    >
                        Manual Issuance
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${issuanceType === 'auto' ? styles.toggleActive : ''}`}
                        onClick={() => setIssuanceType('auto')}
                    >
                        Auto (Recipe-based)
                    </button>
                    {issuanceType === 'auto' ? (
                        <div className={styles.autoNote}>
                            <AlertCircle size={13} />
                            Auto mode still posts a real production-ledger issue. Recipe linkage can be added on top of this batch.
                        </div>
                    ) : null}
                </div>

                <div className={styles.metaCard}>
                    <div className={styles.metaGrid}>
                        <div className={styles.fieldGroup}>
                            <label>Issued To</label>
                            <select value={issueTo} onChange={(event) => setIssueTo(event.target.value)} className={styles.select}>
                                {kitchenStations.length === 0 ? (
                                    <option>Main Kitchen</option>
                                ) : kitchenStations.map((station) => (
                                    <option key={station.id} value={station.name}>{station.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Issue Date</label>
                            <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Issued By</label>
                            <input value={issuedBy} onChange={(event) => setIssuedBy(event.target.value)} className={styles.input} placeholder="Storekeeper / Manager" />
                        </div>
                        <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
                            <label>Notes</label>
                            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={styles.input} placeholder="Prep batch, buffet issue, morning mise en place..." />
                        </div>
                    </div>
                </div>

                <div className={styles.lineCard}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}><ChefHat size={16} /> Items to Issue</span>
                        <button type="button" className={styles.addBtn} onClick={addLine}><Plus size={14} /> Add Item</button>
                    </div>
                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <span style={{ width: '56px' }}>S.No</span>
                            <span style={{ width: '140px' }}>Item</span>
                            <span style={{ flex: 1 }}>Item Name</span>
                            <span style={{ width: '110px', textAlign: 'right' }}>On Hand</span>
                            <span style={{ width: '100px' }}>Qty to Issue</span>
                            <span style={{ width: '120px' }}>Unit</span>
                            <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                            <span style={{ width: '120px', textAlign: 'right' }}>Line Value</span>
                            <span style={{ width: '40px' }}></span>
                        </div>
                        {loading ? (
                            <div className={styles.lineNotice}>Loading stock items...</div>
                        ) : (
                            <>
                                {stockRows.length === 0 ? (
                                    <div className={styles.lineNotice}>No available branch stock found for kitchen issuance.</div>
                                ) : null}
                                {lines.map((line, index) => {
                                    const stock = line.item_id ? stockByItemId.get(line.item_id) : undefined;
                                    const onHand = Number(stock?.current_quantity || 0);
                                    const unitCost = Number(stock?.last_unit_cost || 0);
                                    const unit = line.uom || stock?.item?.uom_base || '';
                                    const allowedUnits = Array.from(new Set([stock?.item?.uom_base, stock?.item?.uom_purchase].filter(Boolean)));
                                    const overQty = Number(line.quantity || 0) - onHand > 0.0001;

                                    return (
                                        <div key={line.id} className={styles.lineRow}>
                                            <div className={styles.serialCell}>{index + 1}</div>
                                            <div style={{ width: '140px' }}>
                                                <select value={line.item_id || ''} onChange={(event) => updateLine(line.id, 'item_id', event.target.value)} className={styles.cellSelect}>
                                                    <option value="">Select item</option>
                                                    {stockRows.map((row) => (
                                                        <option key={row.item_id} value={row.item_id}>
                                                            {`${row.item?.item_code || row.item?.item_sku || `#${row.item_id}`} - ${row.item?.item_name || 'Unnamed item'} (${Number(row.current_quantity || 0).toFixed(2)} ${row.item?.uom_base || ''})`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <input value={stock?.item?.item_name || ''} className={styles.cellInput} readOnly placeholder="Item name" />
                                            </div>
                                            <div style={{ width: '110px', textAlign: 'right', paddingRight: '8px' }}>
                                                <span className={styles.onHand}>{onHand.toFixed(2)} {unit}</span>
                                            </div>
                                            <div style={{ width: '100px' }}>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={line.quantity}
                                                    onChange={(event) => updateLine(line.id, 'quantity', event.target.value)}
                                                    placeholder="0"
                                                    className={`${styles.cellInput} ${overQty ? styles.overQty : ''}`}
                                                    style={{ textAlign: 'right' }}
                                                />
                                            </div>
                                            <div style={{ width: '120px' }}>
                                                <select value={unit} onChange={(event) => updateLine(line.id, 'uom', event.target.value)} className={styles.cellSelect}>
                                                    {(allowedUnits.length ? allowedUnits : [unit || '-']).map((uom) => (
                                                        <option key={uom} value={uom}>{uom}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ width: '110px', textAlign: 'right' }}>
                                                {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ width: '120px', textAlign: 'right' }}>
                                                {(Number(line.quantity || 0) * unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                                                <button type="button" className={styles.rmBtn} onClick={() => removeLine(line.id)} disabled={lines.length === 1}>x</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.metaCard}>
                    <div className={styles.metaGrid}>
                        <div className={styles.fieldGroup}>
                            <label>Selected Lines</label>
                            <input className={styles.input} value={String(lines.filter((line) => line.item_id && Number(line.quantity || 0) > 0).length)} readOnly />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Estimated Issue Value</label>
                            <input
                                className={styles.input}
                                value={totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                readOnly
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label>Available Stock Items</label>
                            <input className={styles.input} value={String(stockRows.length)} readOnly />
                        </div>
                    </div>
                </div>

                <div className={styles.controlAlert}>
                    <AlertCircle size={14} />
                    <span><strong>Control Rule:</strong> kitchen issues post as `production` ledger movements and block any quantity above live branch stock. No separate pending queue is used in this batch.</span>
                </div>

                <div className={styles.lineCard}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}><Clock3 size={16} /> Recent Kitchen Issues</span>
                    </div>
                    <div className={styles.tableWrap}>
                        <div className={styles.tableHeader}>
                            <span style={{ width: '170px' }}>Posted At</span>
                            <span style={{ width: '150px' }}>Service Station</span>
                            <span style={{ width: '150px' }}>Issued By</span>
                            <span style={{ width: '120px' }}>Issue Date</span>
                            <span style={{ width: '170px' }}>Reference</span>
                            <span style={{ flex: 1 }}>Item</span>
                            <span style={{ width: '100px', textAlign: 'right' }}>Qty</span>
                            <span style={{ width: '110px', textAlign: 'right' }}>Unit Cost</span>
                            <span style={{ width: '120px', textAlign: 'right' }}>Line Value</span>
                        </div>
                        {loading ? (
                            <div className={styles.lineRow}>Loading recent issue history...</div>
                        ) : recentIssues.length === 0 ? (
                            <div className={styles.lineRow}><Package size={14} /> No kitchen issue history posted yet.</div>
                        ) : recentIssues.map((row) => {
                            const issueMetadata = row.issue_metadata;
                            const lineValue = row.line_value ?? Math.abs(Number(row.quantity || 0)) * Number(row.unit_cost || 0);

                            return (
                                <div key={row.id} className={styles.lineRow}>
                                    <div style={{ width: '170px' }}>{row.created_at ? new Date(row.created_at).toLocaleString('en-PK') : '-'}</div>
                                    <div style={{ width: '150px' }}>{issueMetadata?.issue_to || '-'}</div>
                                    <div style={{ width: '150px' }}>{issueMetadata?.issued_by_name || '-'}</div>
                                    <div style={{ width: '120px' }}>{formatIssueDate(issueMetadata?.issue_date)}</div>
                                    <div style={{ width: '170px' }}>{row.reference_id || '-'}</div>
                                    <div style={{ flex: 1 }}>{row.item?.item_name || `Item #${row.item_id}`}</div>
                                    <div style={{ width: '100px', textAlign: 'right' }}>{Math.abs(Number(row.quantity || 0)).toFixed(2)}</div>
                                    <div style={{ width: '110px', textAlign: 'right' }}>{formatCurrency(row.unit_cost)}</div>
                                    <div style={{ width: '120px', textAlign: 'right' }}>{formatCurrency(lineValue)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
