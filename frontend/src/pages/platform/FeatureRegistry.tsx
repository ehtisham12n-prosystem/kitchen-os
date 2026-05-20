import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Layers, Plus, Save, Sparkles, ToggleLeft, XCircle } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './FeatureRegistry.module.css';

interface FeatureRecord {
    id: number;
    feature_key: string;
    feature_name: string;
    description?: string | null;
    is_active: boolean;
}

const DEFAULT_FORM = {
    feature_key: '',
    feature_name: '',
    description: '',
};

const CARD_TONES = [
    styles.toneBlue,
    styles.toneTeal,
    styles.toneAmber,
    styles.toneViolet,
    styles.toneRose,
    styles.toneEmerald,
];

export function FeatureRegistry() {
    const [features, setFeatures] = useState<FeatureRecord[]>([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [editingFeatureId, setEditingFeatureId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const metrics = useMemo(() => {
        const activeCount = features.filter((feature) => feature.is_active).length;
        const inactiveCount = features.length - activeCount;

        return {
            total: features.length,
            active: activeCount,
            inactive: inactiveCount,
        };
    }, [features]);

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await platformApi.getPlatformFeatures();
            setFeatures(Array.isArray(data) ? data.map((feature: any) => ({
                id: Number(feature.id),
                feature_key: feature.feature_key || '',
                feature_name: feature.feature_name || '',
                description: feature.description || '',
                is_active: Boolean(feature.is_active),
            })) : []);
        } catch (error) {
            toast.error('Load failed', error instanceof Error ? error.message : 'Could not load platform features.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resetForm = () => {
        setForm(DEFAULT_FORM);
        setEditingFeatureId(null);
    };

    const handleSave = async () => {
        if (!form.feature_key.trim() || !form.feature_name.trim()) {
            toast.error('Validation error', 'Feature key and feature name are required.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingFeatureId) {
                await platformApi.updatePlatformFeature(editingFeatureId, {
                    feature_name: form.feature_name.trim(),
                    description: form.description.trim() || undefined,
                });
                toast.success('Feature updated', `${form.feature_name.trim()} was updated successfully.`);
            } else {
                await platformApi.createPlatformFeature({
                    feature_key: form.feature_key.trim().toLowerCase(),
                    feature_name: form.feature_name.trim(),
                    description: form.description.trim() || undefined,
                });
                toast.success('Feature created', `${form.feature_name.trim()} is now available for plans.`);
            }
            resetForm();
            await load();
        } catch (error) {
            toast.error(editingFeatureId ? 'Update failed' : 'Create failed', error instanceof Error ? error.message : 'Could not save feature.');
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (feature: FeatureRecord) => {
        setEditingFeatureId(feature.id);
        setForm({
            feature_key: feature.feature_key,
            feature_name: feature.feature_name,
            description: feature.description || '',
        });
    };

    const toggleFeatureStatus = async (feature: FeatureRecord) => {
        try {
            await platformApi.updatePlatformFeatureStatus(feature.id, !feature.is_active);
            toast.success('Feature updated', `${feature.feature_name} is now ${feature.is_active ? 'inactive' : 'active'}.`);
            await load();
        } catch (error) {
            toast.error('Update failed', error instanceof Error ? error.message : 'Could not update feature status.');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <Layers size={22} />
                    </div>
                    <div>
                        <h1>Feature Registry</h1>
                        <p>Define the commercial feature keys that subscription plans and client overrides can enforce.</p>
                    </div>
                </div>
                <div className={styles.headerMeta}>
                    <span className={styles.headerBadge}>
                        <Layers size={14} />
                        {metrics.total} registered
                    </span>
                </div>
            </header>

            <section className={styles.metricsGrid} aria-label="Feature registry summary">
                <div className={styles.metricCard}>
                    <div className={styles.metricIconWrap}>
                        <Layers size={18} />
                    </div>
                    <div>
                        <p className={styles.metricLabel}>Total features</p>
                        <strong className={styles.metricValue}>{metrics.total}</strong>
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={`${styles.metricIconWrap} ${styles.metricIconSuccess}`}>
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <p className={styles.metricLabel}>Active</p>
                        <strong className={styles.metricValue}>{metrics.active}</strong>
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={`${styles.metricIconWrap} ${styles.metricIconDanger}`}>
                        <XCircle size={18} />
                    </div>
                    <div>
                        <p className={styles.metricLabel}>Inactive</p>
                        <strong className={styles.metricValue}>{metrics.inactive}</strong>
                    </div>
                </div>
            </section>

            <div className={styles.pageStack}>
                <KitchenCard className={styles.formCard}>
                    <div className={styles.sectionIntro}>
                        <h3 className={styles.cardTitle}>
                            <Plus size={16} />
                            {editingFeatureId ? 'Edit Feature' : 'Add Feature'}
                        </h3>
                        <p className={styles.cardHint}>
                            {editingFeatureId
                                ? 'Update the business label or description while keeping the stable feature key intact for plans and overrides.'
                                : 'Register a reusable commercial feature key for plan entitlements and client-specific overrides.'}
                        </p>
                    </div>
                    <div className={styles.row2}>
                        <KitchenInput
                            label="Feature Key"
                            value={form.feature_key}
                            onChange={(event) => setForm((prev) => ({ ...prev, feature_key: event.target.value }))}
                            helpText="Use a stable lowercase key referenced by entitlements, for example `inventory`."
                            placeholder="e.g. inventory"
                            disabled={Boolean(editingFeatureId)}
                        />
                        <KitchenInput
                            label="Feature Name"
                            value={form.feature_name}
                            onChange={(event) => setForm((prev) => ({ ...prev, feature_name: event.target.value }))}
                            helpText="Use the business-facing label shown to administrators."
                            placeholder="e.g. Inventory"
                        />
                    </div>
                    <div className={styles.fullWidth}>
                        <label className={styles.fieldLabel}>Description</label>
                        <textarea
                            className={styles.textarea}
                            rows={3}
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                            placeholder="Explain what commercial capability this feature enables..."
                        />
                        <p className={styles.fieldHint}>Keep this concise so plan and client configuration screens stay readable.</p>
                    </div>
                    <div className={styles.formFooter}>
                        <div className={styles.infoPanel}>
                            <Sparkles size={16} />
                            <span>{editingFeatureId ? 'Feature keys stay fixed so existing entitlements remain stable.' : 'New entries are available immediately for plan mappings after creation.'}</span>
                        </div>
                        <div className={styles.formActions}>
                            {editingFeatureId ? (
                                <KitchenButton type="button" variant="secondary" onClick={resetForm} disabled={isSaving}>
                                    Cancel Edit
                                </KitchenButton>
                            ) : null}
                            <KitchenButton onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
                                <Save size={16} style={{ marginRight: 6 }} />
                                {editingFeatureId ? 'Save Changes' : 'Save Feature'}
                            </KitchenButton>
                        </div>
                    </div>
                </KitchenCard>

                <KitchenCard className={styles.formCard}>
                    <div className={styles.registryHeader}>
                        <div className={styles.sectionIntro}>
                            <h3 className={styles.cardTitle}>
                                <ToggleLeft size={16} />
                                Registry
                            </h3>
                            <p className={styles.cardHint}>
                                Review feature availability and manage whether each key can be assigned across the platform.
                            </p>
                        </div>
                    </div>
                    {isLoading ? (
                        <div className={styles.loadingBox}>
                            <div className={styles.loadingPulse} />
                            <p>Loading feature registry...</p>
                        </div>
                    ) : (
                        <div className={styles.registryGrid}>
                            {features.map((feature) => (
                                <div
                                    key={feature.id}
                                    className={`${styles.featureCard} ${CARD_TONES[feature.id % CARD_TONES.length]} ${!feature.is_active ? styles.featureCardInactive : ''}`}
                                >
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardTitleRow}>
                                            <div>
                                                <h3 className={styles.cardName}>{feature.feature_name}</h3>
                                                <p className={styles.featureKey}>{feature.feature_key}</p>
                                            </div>
                                            <span className={`${styles.statusBadge} ${feature.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                                                {feature.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <p className={styles.cardDesc}>{feature.description || 'No description provided.'}</p>
                                    </div>
                                    <div className={styles.featureMetaRow}>
                                        <div className={styles.metaBlock}>
                                            <span className={styles.metaLabel}>Feature key</span>
                                            <span className={styles.metaValue}>{feature.feature_key}</span>
                                        </div>
                                        <div className={styles.metaBlock}>
                                            <span className={styles.metaLabel}>Availability</span>
                                            <span className={styles.metaValue}>
                                                {feature.is_active ? 'Available for assignment' : 'Excluded from new assignment'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.cardFooter}>
                                        <span className={styles.clientCount}>Plan mappings and client overrides use this key.</span>
                                        <div className={styles.cardActions}>
                                            <KitchenButton
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => startEditing(feature)}
                                            >
                                                Edit
                                            </KitchenButton>
                                            <KitchenButton
                                                variant={feature.is_active ? 'outline-danger' : 'outline-success'}
                                                size="sm"
                                                className={styles.statusAction}
                                                title={feature.is_active ? 'Deactivate feature' : 'Activate feature'}
                                                onClick={() => toggleFeatureStatus(feature)}
                                            >
                                                <ToggleLeft size={15} />
                                                {feature.is_active ? 'Deactivate' : 'Activate'}
                                            </KitchenButton>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {features.length === 0 && (
                                <div className={styles.empty}>
                                    <Layers size={40} />
                                    <div>
                                        <h3>No platform features registered</h3>
                                        <p>Create the first feature key to make it available for plans and client overrides.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </KitchenCard>
            </div>
        </div>
    );
}
