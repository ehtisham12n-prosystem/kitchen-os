import styles from './SubscriptionDetails.module.css';
import {
    Users,
    ShieldCheck,
    HelpCircle,
    MessageSquare,
    RefreshCw,
    CheckCircle2,
    Clock,
    Zap,
    Building2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { platformApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';

interface ClientSubscription {
    plan_name?: string | null;
    billing_cycle?: 'monthly' | 'annual' | null;
    status?: string | null;
    currency_code?: string | null;
    price_snapshot?: number | null;
    is_trial?: boolean;
    trial_end_at?: string | null;
    effective_end_at?: string | null;
    grace_end_at?: string | null;
}

interface EffectiveEntitlements {
    current_plan_name?: string | null;
    subscription_status?: string | null;
    features?: string[];
    limits?: {
        max_branches?: number | null;
        max_active_users?: number | null;
        max_pos_devices?: number | null;
    };
    usage?: {
        max_branches?: number;
        max_active_users?: number;
        max_pos_devices?: number;
    };
}

interface SubscriptionSummary {
    client_status?: string | null;
    renewal_date?: string | null;
    renewal_contact_name?: string | null;
    renewal_contact_email?: string | null;
    renewal_contact_phone?: string | null;
    platform_contact_email?: string | null;
    platform_contact_phone?: string | null;
    current_subscription?: ClientSubscription | null;
    features?: string[];
    limits?: EffectiveEntitlements['limits'];
    usage?: EffectiveEntitlements['usage'];
}

interface ModuleRow {
    name: string;
    description: string;
}

const FEATURE_LABELS: Record<string, { name: string; description: string }> = {
    dashboard: { name: 'Dashboard', description: 'Operational dashboards and executive visibility.' },
    auth: { name: 'Users & Setup', description: 'Client users, roles, and setup management.' },
    catalog: { name: 'Catalog', description: 'Products, menus, and item master controls.' },
    pos: { name: 'Point of Sale', description: 'POS terminals, orders, and service flows.' },
    inventory: { name: 'Inventory', description: 'Stock, procurement, and branch inventory control.' },
    recipe: { name: 'Recipes', description: 'Recipe and bill-of-material management.' },
    crm: { name: 'CRM', description: 'Customer engagement and loyalty operations.' },
    production: { name: 'Production', description: 'Production supply and kitchen workflows.' },
    accounting: { name: 'Accounting', description: 'Journals, ledgers, and finance operations.' },
    analytics: { name: 'Analytics', description: 'Reporting, insights, and forecasting surfaces.' },
};

const formatMoney = (value?: number | null, currencyCode?: string | null) =>
    `${currencyCode || 'PKR'} ${Number(value || 0).toLocaleString()}`;

const calculatePercentage = (used: number, max: number | null | undefined) => {
    if (!max || max <= 0) return 0;
    return Math.min((used / max) * 100, 100);
};

const humanizeStatus = (value?: string | null) => {
    if (!value) return 'Unassigned';
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function SubscriptionDetails() {
    const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const context = readStoredUserContext();
            const clientId = context?.client_id;
            if (!clientId) {
                setIsLoading(false);
                return;
            }

            try {
                setSummary(await platformApi.getClientSubscriptionSummary(clientId));
            } catch (error) {
                console.error('Failed to fetch subscription details', error);
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, []);

    const moduleRows = useMemo(() => {
        const featureKeys: string[] = Array.isArray(summary?.features) ? summary.features : [];
        return featureKeys.map((featureKey: string): ModuleRow => FEATURE_LABELS[featureKey] || {
            name: featureKey.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase()),
            description: 'Included in your current commercial entitlement set.',
        });
    }, [summary]);

    const subscription: ClientSubscription | null = summary?.current_subscription || null;
    const entitlements: EffectiveEntitlements | null = summary ? {
        current_plan_name: subscription?.plan_name || null,
        subscription_status: subscription?.status || null,
        features: Array.isArray(summary.features) ? summary.features : [],
        limits: summary.limits || {},
        usage: summary.usage || {},
    } : null;

    const expiryDate = subscription?.grace_end_at
        || subscription?.trial_end_at
        || subscription?.effective_end_at
        || summary?.renewal_date
        || null;
    const daysLeft = expiryDate
        ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : null;
    const maxBranches = entitlements?.limits?.max_branches ?? null;
    const usedBranches = Number(entitlements?.usage?.max_branches || 0);
    const maxUsers = entitlements?.limits?.max_active_users ?? null;
    const usedUsers = Number(entitlements?.usage?.max_active_users || 0);
    const maxDevices = entitlements?.limits?.max_pos_devices ?? null;
    const usedDevices = Number(entitlements?.usage?.max_pos_devices || 0);
    const renewalContactEmail = summary?.renewal_contact_email || summary?.platform_contact_email || 'support@kitchenos.com';
    const raiseTicketHref = `mailto:${renewalContactEmail}?subject=${encodeURIComponent('KitchenOS Subscription Support Request')}`;
    const requestUpgradeHref = `mailto:${renewalContactEmail}?subject=${encodeURIComponent('KitchenOS Plan Upgrade Request')}`;

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <p style={{ margin: 0 }}>Loading subscription details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleArea}>
                    <h1>Subscription Management</h1>
                    <p>Manage your plan, usage limits, and renewal details from live commercial records.</p>
                </div>
                <div className={styles.statusBadge}>
                    <div className={styles.pulseDot}></div>
                    <span>{humanizeStatus(subscription?.status || entitlements?.subscription_status || summary?.client_status)}</span>
                </div>
            </header>

            <div className={styles.grid}>
                <div className={`${styles.card} ${styles.planCard}`}>
                    <div className={styles.planIconWrapper}>
                        <Crown className={styles.planIcon} />
                    </div>
                    <div className={styles.planInfo}>
                        <h3>{subscription?.plan_name || entitlements?.current_plan_name || 'No active plan assigned'}</h3>
                        <p>Billing Cycle: <strong>{humanizeStatus(subscription?.billing_cycle)}</strong></p>
                        <div className={styles.billingTag}>
                            Current Commercial Value: {subscription ? formatMoney(subscription.price_snapshot, subscription.currency_code) : 'Contact support'}
                        </div>
                    </div>
                    <div className={styles.expiryDisplay}>
                        <div className={styles.clockCircle}>
                            <Clock size={20} />
                            <span>{daysLeft !== null ? `${daysLeft} Days` : 'Open'}</span>
                        </div>
                        <p>
                            {expiryDate
                                ? `Commercial boundary on ${new Date(expiryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                                : 'No expiry date is currently recorded.'}
                        </p>
                    </div>
                </div>

                <div className={styles.statsRow}>
                    <div className={`${styles.card} ${styles.statCard}`}>
                        <div className={styles.statHeader}>
                            <div className={styles.iconBox} style={{ color: 'var(--accent-primary)' }}>
                                <Building2 size={24} />
                            </div>
                            <div className={styles.statText}>
                                <span>Branches</span>
                                <h4>{usedBranches} / {maxBranches ?? 'Unlimited'}</h4>
                            </div>
                        </div>
                        <div className={styles.progressTrack}>
                            <div
                                className={styles.progressBar}
                                style={{
                                    width: `${calculatePercentage(usedBranches, maxBranches)}%`,
                                    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                }}
                            />
                        </div>
                        <p className={styles.statFooter}>
                            {maxBranches ? `${Math.max(0, maxBranches - usedBranches)} branches available` : 'Unlimited branch capacity'}
                        </p>
                    </div>

                    <div className={`${styles.card} ${styles.statCard}`}>
                        <div className={styles.statHeader}>
                            <div className={styles.iconBox} style={{ color: 'var(--accent-secondary)' }}>
                                <Users size={24} />
                            </div>
                            <div className={styles.statText}>
                                <span>System Users</span>
                                <h4>{usedUsers} / {maxUsers ?? 'Unlimited'}</h4>
                            </div>
                        </div>
                        <div className={styles.progressTrack}>
                            <div
                                className={styles.progressBar}
                                style={{
                                    width: `${calculatePercentage(usedUsers, maxUsers)}%`,
                                    background: 'linear-gradient(90deg, var(--accent-secondary), var(--accent-tertiary))',
                                }}
                            />
                        </div>
                        <p className={styles.statFooter}>
                            {maxUsers ? `${Math.max(0, maxUsers - usedUsers)} user seats left` : 'Unlimited active users'}
                        </p>
                    </div>

                    <div className={`${styles.card} ${styles.statCard}`}>
                        <div className={styles.statHeader}>
                            <div className={styles.iconBox} style={{ color: 'var(--accent-tertiary)' }}>
                                <ShieldCheck size={24} />
                            </div>
                            <div className={styles.statText}>
                                <span>POS Devices</span>
                                <h4>{usedDevices} / {maxDevices ?? 'Unlimited'}</h4>
                            </div>
                        </div>
                        <div className={styles.progressTrack}>
                            <div
                                className={styles.progressBar}
                                style={{
                                    width: `${calculatePercentage(usedDevices, maxDevices)}%`,
                                    background: 'linear-gradient(90deg, var(--accent-tertiary), var(--accent-primary))',
                                }}
                            />
                        </div>
                        <p className={styles.statFooter}>
                            {maxDevices ? `${Math.max(0, maxDevices - usedDevices)} devices available` : 'Unlimited POS devices'}
                        </p>
                    </div>
                </div>

                <div className={styles.contentGrid}>
                    <div className={`${styles.card} ${styles.modulesCard}`}>
                        <div className={styles.cardHeader}>
                            <Zap size={20} className={styles.headerIcon} />
                            <h3>Included Modules</h3>
                        </div>
                        <div className={styles.moduleList}>
                            {moduleRows.length === 0 ? (
                                <div className={styles.moduleItem}>
                                    <CheckCircle2 size={18} className={styles.checkIcon} />
                                    <div className={styles.moduleText}>
                                        <span className={styles.moduleName}>No active commercial modules</span>
                                        <span className={styles.moduleDesc}>Contact the renewal team if access should be restored.</span>
                                    </div>
                                </div>
                            ) : moduleRows.map((module: ModuleRow) => (
                                <div key={module.name} className={styles.moduleItem}>
                                    <CheckCircle2 size={18} className={styles.checkIcon} />
                                    <div className={styles.moduleText}>
                                        <span className={styles.moduleName}>{module.name}</span>
                                        <span className={styles.moduleDesc}>{module.description}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.sideColumn}>
                        <div className={`${styles.card} ${styles.supportCard}`}>
                            <div className={styles.cardHeader}>
                                <HelpCircle size={20} className={styles.headerIcon} />
                                <h3>Renewal & Queries</h3>
                            </div>
                            <p>Contact your dedicated account manager for upgrades, renewals, or billing assistance.</p>

                            <div className={styles.contactInfo}>
                                <div className={styles.contactRow}>
                                    <div className={styles.contactLabel}>Renew Manager</div>
                                    <div className={styles.contactValue}>{summary?.renewal_contact_name || 'KitchenOS Renewals Team'}</div>
                                </div>
                                <div className={styles.contactRow}>
                                    <div className={styles.contactLabel}>Support Email</div>
                                    <div className={styles.contactValue}>{summary?.renewal_contact_email || summary?.platform_contact_email || 'support@kitchenos.com'}</div>
                                </div>
                                <div className={styles.contactRow}>
                                    <div className={styles.contactLabel}>Phone</div>
                                    <div className={styles.contactValue}>{summary?.renewal_contact_phone || summary?.platform_contact_phone || '-'}</div>
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <a className={styles.primaryBtn} href={raiseTicketHref}>
                                    <MessageSquare size={16} />
                                    Raise Ticket
                                </a>
                                <a className={styles.secondaryBtn} href={requestUpgradeHref}>
                                    <RefreshCw size={16} />
                                    Request Upgrade
                                </a>
                            </div>
                        </div>

                        <div className={`${styles.card} ${styles.notificationCard}`}>
                            <ShieldCheck size={40} className={styles.shieldIcon} />
                            <h4>Commercial Status</h4>
                            <p>
                                {subscription?.status === 'grace'
                                    ? 'Your account is currently operating in grace. Renew promptly to avoid service interruption.'
                                    : 'Your subscription status is being read directly from the KitchenOS commercial control layer.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Crown({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
    );
}
