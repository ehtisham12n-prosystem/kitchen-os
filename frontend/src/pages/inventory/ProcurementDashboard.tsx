/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ClipboardList, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { inventoryApi, resolveActiveBranchId } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useBranchContext } from '../../hooks/useBranchContext';
import { formatConfiguredPurchaseOrderNumber } from '../pos/printTemplates/printHelpers';

export function ProcurementDashboard() {
    const navigate = useNavigate();
    const { activeBranch } = useBranchContext();
    const activeBranchId = Number(resolveActiveBranchId() || 0);
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    const load = useCallback(async () => {
        if (!activeBranchId) {
            setDashboard(null);
            setPurchaseOrders([]);
            setRequests([]);
            return;
        }

        setLoading(true);
        try {
            const [dashboardData, poRows, requestRows] = await Promise.all([
                inventoryApi.getInventoryDashboard(activeBranchId),
                inventoryApi.getPurchaseOrders(),
                inventoryApi.getProcurementRequests(),
            ]);
            setDashboard(dashboardData);
            setPurchaseOrders(poRows);
            setRequests(requestRows);
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load procurement dashboard.');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        void load();
    }, [load]);

    const branchPurchaseOrders = useMemo(
        () => purchaseOrders.filter((po) => Number(po.destination_branch_id || po.branch_id) === activeBranchId),
        [activeBranchId, purchaseOrders],
    );
    const branchRequests = useMemo(
        () => requests.filter((request) => Number(request.destination_branch_id || request.requesting_branch_id) === activeBranchId),
        [activeBranchId, requests],
    );
    const pendingBills = branchPurchaseOrders.filter((po) => Number(po.billing_summary?.pending_bill_amount || 0) > 0);
    const lowStockItems = dashboard?.low_stock || [];
    const formatVisiblePurchaseOrderNumber = (po: any) =>
        formatConfiguredPurchaseOrderNumber(po?.po_number || `PO-${po?.id}`, activeBranch || po, { preserveTypePrefix: true })
        || po?.po_number
        || `PO-${po?.id}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingCart size={28} color="var(--primary)" />
                        Procurement Operations
                    </h1>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', maxWidth: '720px', lineHeight: '1.5' }}>
                        Live procurement visibility for the active branch: approval backlog, open receipts, pending vendor bill references, and low-stock demand that should route into requests or purchase orders.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => void load()} style={{ background: 'white', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer' }}>
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                    <button onClick={() => navigate('/console/purchase-orders')} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, cursor: 'pointer' }}>
                        Purchase Orders
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
                <KitchenCard style={{ padding: '20px', borderTop: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Approval</p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#f59e0b' }}>{dashboard?.procurement?.pending_approval || 0}</h2>
                        </div>
                        <ClipboardList size={32} color="#fcd34d" />
                    </div>
                </KitchenCard>
                <KitchenCard style={{ padding: '20px', borderTop: '4px solid #0ea5e9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Awaiting Receipt</p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#0ea5e9' }}>{dashboard?.procurement?.awaiting_receipt || 0}</h2>
                        </div>
                        <Truck size={32} color="#7dd3fc" />
                    </div>
                </KitchenCard>
                <KitchenCard style={{ padding: '20px', borderTop: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Bill Refs</p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#ef4444' }}>{pendingBills.length}</h2>
                        </div>
                        <AlertTriangle size={32} color="#fca5a5" />
                    </div>
                </KitchenCard>
                <KitchenCard style={{ padding: '20px', borderTop: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demand Requests</p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#10b981' }}>{branchRequests.length}</h2>
                        </div>
                        <ShoppingCart size={32} color="#6ee7b7" />
                    </div>
                </KitchenCard>
            </div>

            <KitchenCard>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Low Stock Demand</h3>
                    <button onClick={() => navigate('/console/inventory/demand')} style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        Open Demand Planning
                    </button>
                </div>
                <div style={{ padding: '16px 20px' }}>
                    {loading ? (
                        <div>Loading procurement demand...</div>
                    ) : lowStockItems.length === 0 ? (
                        <div>No branch demand alerts are active right now.</div>
                    ) : lowStockItems.map((item: any) => (
                        <div key={item.item_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <strong>{item.item_name}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.item_sku || item.uom_base || `ITEM-${item.item_id}`}</div>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Current {Number(item.current_quantity || 0).toFixed(2)}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Minimum {Number(item.min_stock_level || 0).toFixed(2)}</div>
                            <button onClick={() => navigate('/console/inventory/demand')} style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                                Raise Demand
                            </button>
                        </div>
                    ))}
                </div>
            </KitchenCard>

            <KitchenCard>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Open Procurement Backlog</h3>
                </div>
                <div style={{ padding: '16px 20px' }}>
                    {loading ? (
                        <div>Loading purchase orders...</div>
                    ) : branchPurchaseOrders.length === 0 ? (
                        <div>No purchase orders are visible for this branch scope.</div>
                    ) : branchPurchaseOrders.slice(0, 8).map((po) => (
                        <div key={po.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1fr auto', gap: '12px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <strong>{formatVisiblePurchaseOrderNumber(po)}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{po.vendor?.vendor_name || 'Vendor pending'}</div>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {Number(po.summary?.remaining_quantity_total || 0).toFixed(2)} units remaining | {Number(po.summary?.grn_count || 0)} GRN(s)
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Pending bill {Number(po.billing_summary?.pending_bill_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <button onClick={() => navigate(`/console/purchase-orders/${po.id}`)} style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                                Open
                            </button>
                        </div>
                    ))}
                </div>
            </KitchenCard>
        </div>
    );
}
