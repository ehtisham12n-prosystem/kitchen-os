/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { X, TrendingUp, ShoppingBag, PieChart, CornerUpLeft, Ban, CreditCard, Printer } from 'lucide-react';
import { posApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../components/ui/KitchenToast/toast';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';
import { buildXReportPrintDocument, buildZReportPrintDocument } from './printTemplates/kotPrintTemplate';
import { openPrintDocumentCopies, resolvePrintTemplateSettings } from './printTemplates/printHelpers';
import styles from './ShiftDetailsModal.module.css';

interface ShiftDetailsModalProps {
    shift: {
        id: number;
        counter_name: string;
        opened_at: string;
        closed_at: string | null;
    };
    onClose: () => void;
}

export function ShiftDetailsModal({ shift, onClose }: ShiftDetailsModalProps) {
    const [analytics, setAnalytics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'summary' | 'products' | 'types'>('summary');
    const { formatMoney } = useCurrencyConfig();
    const branchName = localStorage.getItem('branch_name') || 'KitchenOS';
    const settings = resolvePrintTemplateSettings({ branch_name: branchName }, branchName);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await posApi.getShiftAnalytics(shift.id);
                setAnalytics(data);
            } catch (error) {
                console.error('Failed to fetch shift analytics:', error);
                toast.error('Analytics Error', 'Could not load shift breakdown from server.');
            } finally {
                setIsLoading(false);
            }
        };

        void fetchAnalytics();
    }, [shift.id]);

    if (isLoading) {
        return (
            <div className={styles.modalOverlay} onClick={onClose}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                    <div className={styles.loadingState}>
                        <div className="kitchen-spinner"></div>
                        <span>Calculating Session Analytics...</span>
                    </div>
                </div>
            </div>
        );
    }

    const { summary, productWise, orderTypes, shiftInfo } = analytics;
    const paymentBreakdown = {
        cash: formatMoney(Number(summary?.paymentMethods?.cash || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        card: formatMoney(
            Number(summary?.paymentMethods?.card || 0) + Number(summary?.paymentMethods?.bank || 0),
            { minimumFractionDigits: 0, maximumFractionDigits: 0 },
        ),
        online: formatMoney(Number(summary?.paymentMethods?.digital_wallet || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    };

    const handlePrintReport = () => {
        const isClosedShift = Boolean(shift.closed_at || shiftInfo?.closed_at);
        const documentMarkup = isClosedShift
            ? buildZReportPrintDocument({
                settings,
                format: settings.report_paper_size || 'a6',
                data: {
                    orders: summary.totalOrders,
                    gross: formatMoney(Number(summary.totalSales || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    discount: formatMoney(0, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    returns: formatMoney(Number(summary.totalReturns || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    net: formatMoney(Number(summary.totalSales || 0) - Number(summary.totalReturns || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    payments: paymentBreakdown,
                    printed_at: new Date(),
                    print_id: shift.id,
                },
            })
            : buildXReportPrintDocument({
                settings,
                format: settings.report_paper_size || 'thermal-80mm',
                data: {
                    orders: summary.totalOrders,
                    gross_sales: formatMoney(Number(summary.totalSales || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    payments: paymentBreakdown,
                    returns: formatMoney(Number(summary.totalReturns || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    printed_at: new Date(),
                    print_id: shift.id,
                },
            });

        if (!openPrintDocumentCopies(() => documentMarkup, settings.report_print_copies || 1, isClosedShift ? 'Z Report' : 'X Report')) {
            toast.error('Print Blocked', 'Allow pop-ups for this app to print reports.');
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <header className={styles.modalHeader}>
                    <div className={styles.headerTitle}>
                        <h2>Shift Analytical Report</h2>
                        <p>{shiftInfo.counter_name} | ID #{shift.id}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <KitchenButton variant="outline" onClick={handlePrintReport}>
                            <Printer size={14} /> {shift.closed_at || shiftInfo?.closed_at ? 'Print Z Report' : 'Print X Report'}
                        </KitchenButton>
                        <button className="kitchen-button-secondary" onClick={onClose} style={{ padding: '8px' }}>
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className={styles.modalBody}>
                    {/* High Impact KPIs */}
                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Net Sales</span>
                            <span className={styles.kpiValue} style={{ color: 'var(--accent-primary)' }}>
                                {formatMoney(summary.totalSales, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className={styles.kpiSubValue}>Shift System Total</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Order Metrics</span>
                            <span className={styles.kpiValue}>{summary.totalOrders}</span>
                            <span className={styles.kpiSubValue}>{summary.completedOrders} Completed</span>
                        </div>
                        <div className={styles.kpiCard} style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                            <span className={styles.kpiLabel}>Returns & Cancels</span>
                            <span className={styles.kpiValue} style={{ color: '#ef4444' }}>
                                {summary.returnedOrders + summary.cancelledOrders}
                            </span>
                            <span className={styles.kpiSubValue}>
                                {formatMoney(summary.totalReturns + summary.totalCancelled, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Impact
                            </span>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className={styles.tabs}>
                        <button 
                            className={`${styles.tabButton} ${activeTab === 'summary' ? styles.active : ''}`}
                            onClick={() => setActiveTab('summary')}
                        >
                            <TrendingUp size={16} /> Summary
                        </button>
                        <button 
                            className={`${styles.tabButton} ${activeTab === 'products' ? styles.active : ''}`}
                            onClick={() => setActiveTab('products')}
                        >
                            <ShoppingBag size={16} /> Product Wise
                        </button>
                        <button 
                            className={`${styles.tabButton} ${activeTab === 'types' ? styles.active : ''}`}
                            onClick={() => setActiveTab('types')}
                        >
                            <PieChart size={16} /> Order Types
                        </button>
                    </nav>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
                        {activeTab === 'summary' && (
                            <div className={styles.breakdownList}>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h4 style={{ opacity: 0.5, fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: 'var(--spacing-md)' }}>Sale of All Payment Methods</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                        {Object.entries(summary.paymentMethods).map(([method, amt]) => (
                                            <div key={method} className={styles.breakdownItem}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <CreditCard size={16} style={{ opacity: 0.4 }} />
                                                    <span style={{ textTransform: 'capitalize' }}>{method}</span>
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{formatMoney(amt as number, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div className={styles.breakdownItem} style={{ borderLeft: '3px solid #facc15' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <CornerUpLeft size={16} style={{ color: '#facc15' }} />
                                            <span>Sales Returns</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600 }}>{formatMoney(summary.totalReturns, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{summary.returnedOrders} Orders</div>
                                        </div>
                                    </div>
                                    <div className={styles.breakdownItem} style={{ borderLeft: '3px solid #ef4444' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Ban size={16} style={{ color: '#ef4444' }} />
                                            <span>Cancelled Orders</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600 }}>{formatMoney(summary.totalCancelled, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{summary.cancelledOrders} Orders</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'products' && (
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productWise.map((p: any) => (
                                        <tr key={p.name}>
                                            <td style={{ fontWeight: 500 }}>{p.name}</td>
                                            <td style={{ textAlign: 'center' }}>{p.qty}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(p.amt, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'types' && (
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>Order Type</th>
                                        <th style={{ textAlign: 'center' }}>Total Orders</th>
                                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderTypes.map((t: any) => (
                                        <tr key={t.type}>
                                            <td style={{ fontWeight: 500 }}>{t.type}</td>
                                            <td style={{ textAlign: 'center' }}>{t.count}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(t.amt, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
