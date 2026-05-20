/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { platformApi } from '../../api/api';
import { DollarSign, Mail, Phone, Loader2, Save, MapPin, Settings2, UserCheck, Calendar, Clock, Globe } from 'lucide-react';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './OrganizationSettings.module.css';

export function OrganizationSettings() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<any>({
        system_name: 'KitchenOS',
        currency: 'USD',
        timezone: 'UTC',
        contact_email: '',
        contact_phone: '',
        address: '',
        renewal_contact_name: '',
        renewal_contact_email: '',
        renewal_contact_phone: '',
        maintenance_mode: false,
        date_format: 'YYYY-MM-DD',
        email_gateway_key: '',
        sms_gateway_key: '',
        google_maps_api_key: '',
        global_grace_period_days: 7,
        auto_lock_behavior: 'soft_lock',
    });

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await platformApi.getSystemSettings();
            if (data) {
                setSettings((current: typeof settings) => ({
                    ...current,
                    ...data,
                    currency: data.default_currency || data.currency || 'USD'
                }));
            }
        } catch (err) {
            console.error('Failed to fetch system settings:', err);
            setTimeout(() => setIsLoading(false), 500);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                ...settings,
                default_currency: settings.currency
            };
            const result = await platformApi.updateSystemSettings(payload);
            toast.success(
                'Settings updated successfully',
                `System Name: ${result.system_name}\nCurrency: ${result.default_currency || result.currency}\nTimezone: ${result.timezone}\nDate Format: ${result.date_format}`
            );
        } catch (err: any) {
            console.error('Failed to update system settings:', err);
            toast.error('Error updating settings', err.message || err.toString());
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loaderBox}>
                <Loader2 size={40} className={styles.spinner} />
                <p>Establishing secure connection...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>System Settings</h1>
                    <p>Global orchestration parameters for the KitchenOS platform.</p>
                </div>
                <KitchenButton variant="primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 size={18} className={styles.spinner} /> : <Save size={18} style={{ marginRight: '8px' }} />}
                    Save Configuration
                </KitchenButton>
            </header>

            <div className={styles.settingsGrid}>
                {/* General Configuration */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <Settings2 size={20} />
                            <h3>General Configuration</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>System Name</label>
                                <KitchenInput
                                    value={settings.system_name || ''}
                                    onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Maintenance Mode</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.maintenance_mode}
                                        onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                                        style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)' }}
                                    />
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                        Enable maintenance mode (locks out non-system users)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                {/* Localization & Regional */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <Globe size={20} />
                            <h3>Localization & Regional</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>Base Currency</label>
                                <div style={{ position: 'relative' }}>
                                    <DollarSign size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--accent-primary)', opacity: 0.6 }} />
                                    <select
                                        className={styles.kitchenSelect}
                                        style={{ paddingLeft: '38px' }}
                                        value={settings.currency || 'USD'}
                                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    >
                                        <option value="USD">USD ($) - US Dollar</option>
                                        <option value="EUR">EUR (€) - Euro</option>
                                        <option value="GBP">GBP (£) - British Pound</option>
                                        <option value="JPY">JPY (¥) - Japanese Yen</option>
                                        <option value="AUD">AUD (A$) - Australian Dollar</option>
                                        <option value="PKR">PKR (Rs.) - Pakistani Rupee</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Date Format</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--accent-primary)', opacity: 0.6 }} />
                                    <select
                                        className={styles.kitchenSelect}
                                        style={{ paddingLeft: '38px' }}
                                        value={settings.date_format || 'YYYY-MM-DD'}
                                        onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                                    >
                                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-27)</option>
                                        <option value="DD/MM/YYYY">DD/MM/YYYY (27/02/2026)</option>
                                        <option value="MM/DD/YYYY">MM/DD/YYYY (02/27/2026)</option>
                                        <option value="DD-MMM-YYYY">DD-MMM-YYYY (27-Feb-2026)</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>System Timezone</label>
                                <select
                                    className={styles.kitchenSelect}
                                    value={settings.timezone || 'UTC'}
                                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                                >
                                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                                    <option value="Asia/Karachi">PKT (Pakistan Standard Time)</option>
                                    <option value="America/New_York">EST (Eastern Standard Time)</option>
                                    <option value="Europe/London">GMT (Greenwich Mean Time)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                {/* Corporate Contact */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <Mail size={20} />
                            <h3>Corporate Headquarters</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>Business Email</label>
                                <KitchenInput
                                    value={settings.contact_email || ''}
                                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                    icon={<Mail size={18} />}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Business Phone</label>
                                <KitchenInput
                                    value={settings.contact_phone || ''}
                                    onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                                    icon={<Phone size={18} />}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Global Headquarters Address</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--accent-primary)', opacity: 0.6 }} />
                                    <textarea
                                        className={styles.kitchenTextarea}
                                        style={{ paddingLeft: '34px' }}
                                        value={settings.address || ''}
                                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                        placeholder="Enter full physical address..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                {/* Subscription & Renewal Contact */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <UserCheck size={20} />
                            <h3>Subscription Renewal Contact</h3>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-tertiary)', marginLeft: 'auto', background: 'var(--badge-info-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                                Client Facing
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            These details will appear in the Client Console for subscription renewals and upgrades.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>Sales / Account Rep Name</label>
                                <KitchenInput
                                    value={settings.renewal_contact_name || ''}
                                    onChange={(e) => setSettings({ ...settings, renewal_contact_name: e.target.value })}
                                    placeholder="e.g. John Doe, KitchenOS Renewals"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Renewal Email Address</label>
                                <KitchenInput
                                    value={settings.renewal_contact_email || ''}
                                    onChange={(e) => setSettings({ ...settings, renewal_contact_email: e.target.value })}
                                    icon={<Mail size={18} />}
                                    placeholder="renewals@kitchenos.com"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Renewal Phone Number</label>
                                <KitchenInput
                                    value={settings.renewal_contact_phone || ''}
                                    onChange={(e) => setSettings({ ...settings, renewal_contact_phone: e.target.value })}
                                    icon={<Phone size={18} />}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                {/* Global Grace Period & Lock Policy */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <Clock size={20} />
                            <h3>Grace Period & Lock Policy</h3>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Configure default behavior when tenant subscriptions expire.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>Default Grace Period (Days)</label>
                                <KitchenInput
                                    type="number"
                                    value={settings.global_grace_period_days || 7}
                                    onChange={(e) => setSettings({ ...settings, global_grace_period_days: parseInt(e.target.value) || 0 })}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days to allow tenant POS/System access after expiry before applying limits.</span>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Auto-Lock Behavior</label>
                                <select
                                    className={styles.kitchenSelect}
                                    value={settings.auto_lock_behavior || 'soft_lock'}
                                    onChange={(e) => setSettings({ ...settings, auto_lock_behavior: e.target.value })}
                                >
                                    <option value="soft_lock">Soft Lock (HQ Read Only, POS Operates Offline Only)</option>
                                    <option value="hard_lock">Hard Lock (System Fully Blocked, Cashier Prompt)</option>
                                    <option value="warn_only">Warn Only (Admin Banner, Full Access Everywhere)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </KitchenCard>

                {/* Digital Infrastructure & Keys */}
                <KitchenCard className={styles.settingsCard} noPadding>
                    <div style={{ padding: '16px' }}>
                        <div className={styles.cardHeader}>
                            <Settings2 size={20} />
                            <h3>Digital Infrastructure</h3>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)', marginLeft: 'auto', background: 'var(--badge-admin-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                                Nexus Only
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Global API keys for system-wide services. These are encrypted and never shown to clients.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className={styles.formGroup}>
                                <label>Email Gateway API Key (SendGrid/SMTP)</label>
                                <KitchenInput
                                    type="password"
                                    value={settings.email_gateway_key}
                                    onChange={(e) => setSettings({ ...settings, email_gateway_key: e.target.value })}
                                    placeholder="SG.xxxxxxxxxxxxxxxx"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>SMS Gateway Secret (Twilio/Infobip)</label>
                                <KitchenInput
                                    type="password"
                                    value={settings.sms_gateway_key}
                                    onChange={(e) => setSettings({ ...settings, sms_gateway_key: e.target.value })}
                                    placeholder="SK.xxxxxxxxxxxxxxxx"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Google Maps Platform API Key</label>
                                <KitchenInput
                                    type="password"
                                    value={settings.google_maps_api_key}
                                    onChange={(e) => setSettings({ ...settings, google_maps_api_key: e.target.value })}
                                    placeholder="AIzaSyxxxxxxxxxxxx"
                                />
                            </div>
                        </div>
                    </div>
                </KitchenCard>
            </div>
        </div>
    );
}


