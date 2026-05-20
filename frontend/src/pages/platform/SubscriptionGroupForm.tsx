import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, Package, Save, X } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './SubscriptionGroup.module.css';

type PlanStatus = 'draft' | 'active' | 'retired';

const ALL_MODULE_OPTION = { key: 'all', label: 'All Modules' };

interface FormState {
    plan_code: string;
    plan_name: string;
    description: string;
    plan_status: PlanStatus;
    currency_code: string;
    monthly_price: string;
    annual_price: string;
    trial_enabled: boolean;
    default_trial_days: string;
    max_branches: string;
    max_users: string;
    max_pos_devices: string;
    allowed_modules: string[];
}

const DEFAULT_FORM: FormState = {
    plan_code: '',
    plan_name: '',
    description: '',
    plan_status: 'draft',
    currency_code: 'PKR',
    monthly_price: '0',
    annual_price: '0',
    trial_enabled: false,
    default_trial_days: '14',
    max_branches: '1',
    max_users: '5',
    max_pos_devices: '1',
    allowed_modules: ['all'],
};

export function SubscriptionGroupForm() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [availableFeatures, setAvailableFeatures] = useState<Array<{ key: string; label: string }>>([]);
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [featureData, plan] = await Promise.all([
                    platformApi.getPlatformFeatures(),
                    isEdit && id ? platformApi.getSubscriptionPlan(id) : Promise.resolve(null),
                ]);

                setAvailableFeatures(
                    (Array.isArray(featureData) ? featureData : [])
                        .filter((feature: any) => Boolean(feature?.is_active))
                        .map((feature: any) => ({
                            key: String(feature.feature_key || '').toLowerCase(),
                            label: feature.feature_name || feature.feature_key || 'Unnamed Feature',
                        })),
                );

                if (plan) {
                    setForm({
                        plan_code: plan.plan_code || '',
                        plan_name: plan.plan_name || '',
                        description: plan.description || '',
                        plan_status: (plan.plan_status || 'draft') as PlanStatus,
                        currency_code: plan.currency_code || 'PKR',
                        monthly_price: String(Number(plan.monthly_price || 0)),
                        annual_price: String(Number(plan.annual_price || 0)),
                        trial_enabled: Boolean(plan.trial_enabled),
                        default_trial_days: String(Number(plan.default_trial_days || 0)),
                        max_branches: String(Number(plan.max_branches || 1)),
                        max_users: String(Number(plan.max_users || 5)),
                        max_pos_devices: String(Number(plan.max_pos_devices || 1)),
                        allowed_modules: Array.isArray(plan.allowed_modules) && plan.allowed_modules.length
                            ? plan.allowed_modules
                            : ['all'],
                    });
                }
            } catch (error) {
                toast.error('Load failed', error instanceof Error ? error.message : 'Could not load plan configuration.');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [id, isEdit]);

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const toggleModule = (moduleKey: string) => {
        setForm((prev) => {
            if (moduleKey === 'all') {
                return { ...prev, allowed_modules: prev.allowed_modules.includes('all') ? ['dashboard'] : ['all'] };
            }

            const nextModules = prev.allowed_modules.includes(moduleKey)
                ? prev.allowed_modules.filter((entry) => entry !== moduleKey && entry !== 'all')
                : [...prev.allowed_modules.filter((entry) => entry !== 'all'), moduleKey];

            return {
                ...prev,
                allowed_modules: nextModules.length ? nextModules : ['dashboard'],
            };
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.plan_code.trim() || !form.plan_name.trim()) {
            toast.error('Validation error', 'Plan code and name are required.');
            return;
        }
        if (Number(form.monthly_price) < 0 || Number(form.annual_price) < 0) {
            toast.error('Validation error', 'Pricing values must be zero or greater.');
            return;
        }
        if (form.trial_enabled && Number(form.default_trial_days) <= 0) {
            toast.error('Validation error', 'Trial-enabled plans require a positive default trial length.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                plan_code: form.plan_code.trim().toUpperCase(),
                plan_name: form.plan_name.trim(),
                description: form.description.trim(),
                plan_status: form.plan_status,
                currency_code: form.currency_code.trim() || 'PKR',
                monthly_price: Number(form.monthly_price || 0),
                annual_price: Number(form.annual_price || 0),
                trial_enabled: form.trial_enabled,
                default_trial_days: form.trial_enabled ? Number(form.default_trial_days || 0) : 0,
                max_branches: Number(form.max_branches || 1),
                max_users: Number(form.max_users || 1),
                max_pos_devices: Number(form.max_pos_devices || 1),
                allowed_modules: form.allowed_modules.length ? form.allowed_modules : ['all'],
            };

            if (isEdit && id) {
                await platformApi.updateSubscriptionPlan(id, payload);
                toast.success('Plan updated', `${form.plan_name} has been updated.`);
            } else {
                await platformApi.createSubscriptionPlan(payload);
                toast.success('Plan created', `${form.plan_name} has been created.`);
            }

            navigate('/nexus/subscription_pack');
        } catch (error) {
            toast.error('Save failed', error instanceof Error ? error.message : 'Could not save plan.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingBox}>
                <Package size={32} className={styles.spin} />
                <p>Loading plan...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <Package size={22} />
                    </div>
                    <div>
                        <h1>{isEdit ? `Edit ${form.plan_name || 'Plan'}` : 'Create Subscription Plan'}</h1>
                        <p>Define commercial packaging and keep current runtime compatibility values aligned.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/subscription_pack')} type="button">
                        <X size={16} style={{ marginRight: 6 }} />
                        Cancel
                    </KitchenButton>
                    <KitchenButton onClick={handleSubmit} isLoading={isSaving} disabled={isSaving}>
                        <Save size={16} style={{ marginRight: 6 }} />
                        {isEdit ? 'Save Plan' : 'Create Plan'}
                    </KitchenButton>
                </div>
            </header>

            <form onSubmit={handleSubmit} className={styles.formGrid}>
                <div className={styles.sectionDivider}>
                    <span className={styles.sectionNum}>1</span>
                    <span className={styles.sectionLabel}>Commercial Identity</span>
                </div>

                <KitchenCard className={styles.formCard}>
                    <h3 className={styles.cardTitle}><Package size={17} /> Plan Master</h3>
                    <div className={styles.row2}>
                        <KitchenInput
                            label="Plan Code *"
                            value={form.plan_code}
                            onChange={(event) => setField('plan_code', event.target.value)}
                            placeholder="e.g. START-01"
                            required
                        />
                        <KitchenInput
                            label="Plan Name *"
                            value={form.plan_name}
                            onChange={(event) => setField('plan_name', event.target.value)}
                            placeholder="e.g. Starter"
                            required
                        />
                    </div>
                    <div className={styles.row2}>
                        <KitchenSelect
                            label="Commercial Status"
                            value={form.plan_status}
                            onChange={(event) => setField('plan_status', event.target.value as PlanStatus)}
                            options={[
                                { value: 'draft', label: 'Draft' },
                                { value: 'active', label: 'Active' },
                                { value: 'retired', label: 'Retired' },
                            ]}
                        />
                        <KitchenInput
                            label="Currency"
                            value={form.currency_code}
                            onChange={(event) => setField('currency_code', event.target.value)}
                            placeholder="PKR"
                        />
                    </div>
                    <div className={styles.fullWidth}>
                        <label className={styles.fieldLabel}>Description</label>
                        <textarea
                            className={styles.textarea}
                            rows={4}
                            value={form.description}
                            onChange={(event) => setField('description', event.target.value)}
                            placeholder="Summarize what this commercial plan is meant for..."
                        />
                    </div>
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionNum}>2</span>
                    <span className={styles.sectionLabel}>Pricing and Trial</span>
                </div>

                <KitchenCard className={styles.formCard}>
                    <div className={styles.row2}>
                        <KitchenInput
                            label="Monthly Price *"
                            type="number"
                            value={form.monthly_price}
                            onChange={(event) => setField('monthly_price', event.target.value)}
                        />
                        <KitchenInput
                            label="Annual Price *"
                            type="number"
                            value={form.annual_price}
                            onChange={(event) => setField('annual_price', event.target.value)}
                        />
                    </div>

                    <div className={styles.infoBar}>
                        <Info size={13} />
                        <span>Historical client subscriptions snapshot the price at assignment time, so later plan edits stay non-destructive.</span>
                    </div>

                    <div className={styles.switchRow}>
                        <label className={styles.fieldLabel}>Trial Support</label>
                        <div className={styles.switchWrap}>
                            <button
                                type="button"
                                className={`${styles.switchBtn} ${form.trial_enabled ? styles.switchActive : styles.switchInactive}`}
                                onClick={() => setField('trial_enabled', !form.trial_enabled)}
                            >
                                <div className={styles.switchThumb} />
                            </button>
                            <span className={styles.switchLabel}>{form.trial_enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>

                    <KitchenInput
                        label="Default Trial Days"
                        type="number"
                        value={form.default_trial_days}
                        onChange={(event) => setField('default_trial_days', event.target.value)}
                        disabled={!form.trial_enabled}
                    />
                </KitchenCard>

                <div className={styles.sectionDivider}>
                    <span className={styles.sectionNum}>3</span>
                    <span className={styles.sectionLabel}>Current Runtime Compatibility</span>
                </div>

                <KitchenCard className={styles.formCard}>
                    <div className={styles.infoBar}>
                        <Info size={13} />
                        <span>These plan limits and feature keys are enforced by the live entitlement layer, including branch, active user, and POS device caps.</span>
                    </div>

                    <div className={styles.row2}>
                        <KitchenInput
                            label="Max Branches"
                            type="number"
                            value={form.max_branches}
                            onChange={(event) => setField('max_branches', event.target.value)}
                        />
                        <KitchenInput
                            label="Max Users"
                            type="number"
                            value={form.max_users}
                            onChange={(event) => setField('max_users', event.target.value)}
                        />
                    </div>
                    <KitchenInput
                        label="Max POS Devices"
                        type="number"
                        value={form.max_pos_devices}
                        onChange={(event) => setField('max_pos_devices', event.target.value)}
                    />

                    <div className={styles.fullWidth}>
                        <label className={styles.fieldLabel}>Allowed Features</label>
                        <div className={styles.moduleGrid}>
                            {[ALL_MODULE_OPTION, ...availableFeatures].map((module) => {
                                const enabled = form.allowed_modules.includes('all') || form.allowed_modules.includes(module.key);
                                return (
                                    <button
                                        key={module.key}
                                        type="button"
                                        className={`${styles.moduleToggle} ${enabled ? styles.moduleToggleOn : ''}`}
                                        onClick={() => toggleModule(module.key)}
                                    >
                                        <div className={styles.moduleInfo}>
                                            <span className={styles.moduleLabel}>{module.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </KitchenCard>

                <div className={styles.formBottomBar}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/subscription_pack')} type="button">
                        <X size={16} style={{ marginRight: 6 }} />
                        Cancel
                    </KitchenButton>
                    <KitchenButton onClick={handleSubmit} isLoading={isSaving} disabled={isSaving}>
                        <Save size={16} style={{ marginRight: 6 }} />
                        {isEdit ? 'Save Plan' : 'Create Plan'}
                    </KitchenButton>
                </div>
            </form>
        </div>
    );
}
