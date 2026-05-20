/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Brain, Calendar, Info, Loader2, Package, Store, TrendingUp } from 'lucide-react';
import { analyticsApi } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { getAnalyticsBlockedMessage, isAnalyticsEntitlementError } from './analyticsAccess';
import styles from './AiSalesForecaster.module.css';

export function AiSalesForecaster() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [forecastData, setForecastData] = useState<any>(null);
    const [recommendationData, setRecommendationData] = useState<any>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                setLoadError(null);
                const data = await analyticsApi.getOperationsBranchOptions();
                const options = data?.branches ?? [];
                setBranches(options);
                if (options.length > 0) {
                    setSelectedBranchId(Number(options[0].branch_id));
                } else {
                    setIsLoading(false);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setLoadError(getAnalyticsBlockedMessage(message));
                setIsLoading(false);
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Failed to load reporting branches', message);
                }
            }
        };

        void fetchBranches();
    }, []);

    useEffect(() => {
        const fetchInsights = async () => {
            if (!selectedBranchId) {
                return;
            }

            setIsLoading(true);
            try {
                const [forecastResult, recommendationResult] = await Promise.all([
                    analyticsApi.getSalesForecast(selectedBranchId),
                    analyticsApi.getRecommendationOverview(selectedBranchId),
                ]);
                setForecastData(forecastResult);
                setRecommendationData(recommendationResult);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setLoadError(getAnalyticsBlockedMessage(message));
                if (!isAnalyticsEntitlementError(message)) {
                    toast.error('Failed to load forecasting insights', message);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void fetchInsights();
    }, [selectedBranchId]);

    if (loadError) {
        return (
            <div className={styles.loader}>
                <AlertTriangle size={40} className={styles.alertIcon} />
                <p>{loadError}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={styles.loader}>
                <Loader2 size={40} className={styles.spinner} />
                <p>Forecasting branch demand and recommendation signals...</p>
            </div>
        );
    }

    const historyValues = (forecastData?.history ?? []).map((item: any) => Number(item.amount || 0));
    const futureValues = (forecastData?.forecast ?? []).map((item: any) => Number(item.projected_amount || 0));
    const maxVal = Math.max(1, ...historyValues, ...futureValues);
    const leadingSuggestion = recommendationData?.reorder_suggestions?.[0] ?? null;
    const anomalyHighlights = recommendationData?.anomalies?.slice(0, 2) ?? [];
    const combinedInsights = [...(forecastData?.insights ?? []), ...anomalyHighlights];
    const openDemandPlanning = () => {
        if (!selectedBranchId) {
            toast.error('No branch selected', 'Select a branch before opening demand planning.');
            return;
        }
        localStorage.setItem('activeBranchId', String(selectedBranchId));
        window.dispatchEvent(new Event('branch_changed'));
        navigate('/console/inventory/demand');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleBox}>
                    <div className={styles.iconBox}><Brain size={28} /></div>
                    <div>
                        <h1>AI Recommendations & Forecasting</h1>
                        <p>Explainable branch demand outlook based on completed sales, outbound stock movement, and branch min/max policy.</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.branchPicker}>
                        <Store size={20} color="#64748b" />
                        <KitchenSelect
                            options={branches.map((branch) => ({
                                value: branch.branch_id.toString(),
                                label: branch.branch_name,
                            }))}
                            value={selectedBranchId?.toString() || ''}
                            onChange={(event) => setSelectedBranchId(Number(event.target.value))}
                        />
                    </div>
                    <div className={styles.confidence}>
                        <div className={styles.confTrack}>
                            <div className={styles.confBar} style={{ width: `${(forecastData?.confidence_score || 0) * 100}%` }}></div>
                        </div>
                        <span>{Math.round((forecastData?.confidence_score || 0) * 100)}% Reporting Confidence</span>
                    </div>
                </div>
            </header>

            <div className={styles.mainGrid}>
                <KitchenCard className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                        <h3>Sales Velocity Projection</h3>
                        <div className={styles.legend}>
                            <span className={styles.legPast}></span> Historical
                            <span className={styles.legFuture}></span> Forecast
                        </div>
                    </div>
                    <div className={styles.visualizer}>
                        {(forecastData?.history ?? []).map((item: any, index: number) => (
                            <div key={`hist-${index}`} className={styles.barGroup}>
                                <div
                                    className={styles.barPast}
                                    style={{ height: `${(Number(item.amount || 0) / maxVal) * 100}%` }}
                                    title={`Actual: $${Number(item.amount || 0).toFixed(2)}`}
                                ></div>
                                <span className={styles.barLabel}>{String(item.date).split('-')[2]}</span>
                            </div>
                        ))}
                        <div className={styles.divider}></div>
                        {(forecastData?.forecast ?? []).map((item: any, index: number) => (
                            <div key={`forecast-${index}`} className={styles.barGroup}>
                                <div
                                    className={styles.barFuture}
                                    style={{ height: `${(Number(item.projected_amount || 0) / maxVal) * 100}%` }}
                                    title={`Projected: $${Number(item.projected_amount || 0).toFixed(2)}`}
                                ></div>
                                <span className={styles.barLabel}>{String(item.date).split('-')[2]}</span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.chartFooter}>
                        <div className={styles.methodologyBox}>
                            <span className={styles.methodLabel}>Method</span>
                            <p>{forecastData?.methodology?.description}</p>
                        </div>
                        <div className={styles.methodologyBox}>
                            <span className={styles.methodLabel}>Lead Recommendation</span>
                            {leadingSuggestion ? (
                                <p>
                                    <strong>{leadingSuggestion.item_name}</strong> suggests reordering{' '}
                                    {Number(leadingSuggestion.suggested_reorder_quantity || 0).toFixed(2)}{' '}
                                    {leadingSuggestion.uom_base || 'units'} because current stock covers about{' '}
                                    {leadingSuggestion.days_of_cover ?? 'limited'} days.
                                </p>
                            ) : (
                                <p>No immediate reorder signal is active in the current branch scope.</p>
                            )}
                        </div>
                    </div>
                </KitchenCard>

                <div className={styles.sidebar}>
                    <KitchenCard className={styles.insightCard}>
                        <div className={styles.insHeader}>
                            <Info size={18} />
                            <h4>Explainable Insights</h4>
                        </div>
                        <div className={styles.insContent}>
                            {combinedInsights.map((item: any, index: number) => (
                                <div key={`${item.type || item.title}-${index}`} className={styles.insItem}>
                                    {item.severity === 'critical' || item.type === 'warning'
                                        ? <AlertTriangle size={16} className={styles.alertIcon} />
                                        : <TrendingUp size={16} className={styles.trendIcon} />}
                                    <p>{item.message}</p>
                                </div>
                            ))}
                            {(forecastData?.inventory_alerts ?? []).slice(0, 1).map((item: any, index: number) => (
                                <div key={`inventory-${index}`} className={styles.insItem}>
                                    <AlertTriangle size={16} className={styles.alertIcon} />
                                    <p><strong>Inventory Risk:</strong> <em>{item.item_name}</em> is at {Number(item.coverage_ratio || 0).toFixed(1)}% of minimum coverage.</p>
                                </div>
                            ))}
                        </div>
                        <KitchenButton variant="primary" size="sm" fullWidth onClick={openDemandPlanning}>
                            Open demand planning
                        </KitchenButton>
                    </KitchenCard>

                    <KitchenCard className={styles.statsMini}>
                        <div className={styles.miniStat}>
                            <Calendar size={16} />
                            <div>
                                <span>7-Day Projection</span>
                                <h3>${Number(forecastData?.summary?.projected_total || 0).toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className={styles.miniStat}>
                            <Package size={16} />
                            <div>
                                <span>Actionable Reorders</span>
                                <h3>{Number(recommendationData?.summary?.actionable_reorders || 0)}</h3>
                                <small>{Number(recommendationData?.summary?.slow_movers || 0)} slow movers in scope</small>
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            </div>
        </div>
    );
}
