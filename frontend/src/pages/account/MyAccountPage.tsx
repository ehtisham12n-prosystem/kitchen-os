import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, Save, Shield, User, Loader2, MapPin, Phone } from 'lucide-react';
import { userApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './MyAccountPage.module.css';

type MyProfile = {
    id: number;
    user_name: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    alternate_phone?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_relationship?: string | null;
    emergency_contact_phone?: string | null;
    address?: string | null;
    gender?: string | null;
    locality?: string | null;
    city?: string | null;
    country?: string | null;
    primary_role_name?: string | null;
    primary_branch_name?: string | null;
    effective_permissions?: string[];
    pos_approval_pin?: string | null;
    management_pin?: string | null;
    pos_user_pin?: string | null;
};

export function MyAccountPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>(requestedTab);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingSecurity, setSavingSecurity] = useState(false);
    const [profile, setProfile] = useState<MyProfile | null>(null);
    const [profileForm, setProfileForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        alternate_phone: '',
        emergency_contact_name: '',
        emergency_contact_relationship: '',
        emergency_contact_phone: '',
        address: '',
        gender: '',
        locality: '',
        city: '',
        country: 'Pakistan',
    });
    const [securityForm, setSecurityForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
        pos_approval_pin: '',
        management_pin: '',
        pos_user_pin: '',
    });

    useEffect(() => {
        setActiveTab(requestedTab);
    }, [requestedTab]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await userApi.getMyProfile() as MyProfile;
                setProfile(data);
                setProfileForm({
                    full_name: data.full_name || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    alternate_phone: data.alternate_phone || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_relationship: data.emergency_contact_relationship || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                    address: data.address || '',
                    gender: data.gender || '',
                    locality: data.locality || '',
                    city: data.city || '',
                    country: data.country || 'Pakistan',
                });
            } catch (error) {
                console.error('Failed to load account profile', error);
                toast.error('Profile Load Failed', 'Could not load your account details.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const permissionPreview = useMemo(
        () => (profile?.effective_permissions || []).slice(0, 8),
        [profile?.effective_permissions],
    );

    const switchTab = (tab: 'profile' | 'security') => {
        setActiveTab(tab);
        setSearchParams(tab === 'security' ? { tab: 'security' } : {});
    };

    const saveProfile = async () => {
        setSavingProfile(true);
        try {
            const data = await userApi.updateMyProfile(profileForm) as MyProfile;
            setProfile(data);
            toast.success('Profile Updated', 'Your account profile has been updated.');
        } catch (error) {
            console.error('Failed to update profile', error);
            toast.error('Profile Update Failed', 'Could not save your account profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const saveSecurity = async () => {
        if (securityForm.new_password && securityForm.new_password !== securityForm.confirm_password) {
            toast.warning('Password Mismatch', 'New password and confirmation do not match.');
            return;
        }

        setSavingSecurity(true);
        try {
            await userApi.updateMySecurity({
                current_password: securityForm.current_password,
                new_password: securityForm.new_password || undefined,
                pos_approval_pin: securityForm.pos_approval_pin || undefined,
                management_pin: securityForm.management_pin || undefined,
                pos_user_pin: securityForm.pos_user_pin || undefined,
            });
            setSecurityForm({
                current_password: '',
                new_password: '',
                confirm_password: '',
                pos_approval_pin: '',
                management_pin: '',
                pos_user_pin: '',
            });
            toast.success('Security Updated', 'Password and PIN settings have been updated.');
        } catch (error) {
            console.error('Failed to update security', error);
            toast.error('Security Update Failed', 'Could not update password or PIN settings.');
        } finally {
            setSavingSecurity(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingState}>
                <Loader2 size={32} className={styles.spin} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>My Account</h1>
                    <p>Review your profile, operational role context, password, and approval PINs.</p>
                </div>
                <div className={styles.identityCard}>
                    <strong>{profile?.full_name || profile?.user_name}</strong>
                    <span>{profile?.user_name}</span>
                    <span>{profile?.primary_role_name || 'No role assigned'}</span>
                </div>
            </header>

            <div className="global-sub-nav">
                <button type="button" className={`global-sub-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => switchTab('profile')}>
                    <User size={16} />
                    Profile
                </button>
                <button type="button" className={`global-sub-nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => switchTab('security')}>
                    <Shield size={16} />
                    Password & PINs
                </button>
            </div>

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span>Primary Role</span>
                    <strong>{profile?.primary_role_name || 'No role assigned'}</strong>
                </div>
                <div className={styles.summaryCard}>
                    <span>Primary Branch</span>
                    <strong>{profile?.primary_branch_name || 'No branch assigned'}</strong>
                </div>
                <div className={styles.summaryCard}>
                    <span>Effective Rights</span>
                    <strong>{profile?.effective_permissions?.length || 0}</strong>
                </div>
            </div>

            {activeTab === 'profile' ? (
                <div className={styles.panelGrid}>
                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <User size={18} />
                            <div>
                                <h2>Profile Details</h2>
                                <p>Personal and communication details visible to your organization.</p>
                            </div>
                        </div>
                        <div className={styles.formGrid}>
                            <label className={styles.field}>
                                <span>Full Name</span>
                                <input value={profileForm.full_name} onChange={(e) => setProfileForm((s) => ({ ...s, full_name: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Email</span>
                                <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((s) => ({ ...s, email: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Phone</span>
                                <input value={profileForm.phone} onChange={(e) => setProfileForm((s) => ({ ...s, phone: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Additional Contact</span>
                                <input value={profileForm.alternate_phone} onChange={(e) => setProfileForm((s) => ({ ...s, alternate_phone: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Gender</span>
                                <input value={profileForm.gender} onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Country</span>
                                <input value={profileForm.country} onChange={(e) => setProfileForm((s) => ({ ...s, country: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Locality</span>
                                <input value={profileForm.locality} onChange={(e) => setProfileForm((s) => ({ ...s, locality: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>City</span>
                                <input value={profileForm.city} onChange={(e) => setProfileForm((s) => ({ ...s, city: e.target.value }))} />
                            </label>
                            <label className={`${styles.field} ${styles.fieldFull}`}>
                                <span>Address</span>
                                <textarea rows={3} value={profileForm.address} onChange={(e) => setProfileForm((s) => ({ ...s, address: e.target.value }))} />
                            </label>
                        </div>
                    </section>

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <Phone size={18} />
                            <div>
                                <h2>Emergency Contact</h2>
                                <p>Used when urgent operational contact is required.</p>
                            </div>
                        </div>
                        <div className={styles.formGrid}>
                            <label className={styles.field}>
                                <span>Name</span>
                                <input value={profileForm.emergency_contact_name} onChange={(e) => setProfileForm((s) => ({ ...s, emergency_contact_name: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Relationship</span>
                                <input value={profileForm.emergency_contact_relationship} onChange={(e) => setProfileForm((s) => ({ ...s, emergency_contact_relationship: e.target.value }))} />
                            </label>
                            <label className={`${styles.field} ${styles.fieldFull}`}>
                                <span>Contact Number</span>
                                <input value={profileForm.emergency_contact_phone} onChange={(e) => setProfileForm((s) => ({ ...s, emergency_contact_phone: e.target.value }))} />
                            </label>
                        </div>
                        <button type="button" className={styles.primaryButton} onClick={() => void saveProfile()} disabled={savingProfile}>
                            {savingProfile ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
                            Save Profile
                        </button>
                    </section>
                </div>
            ) : (
                <div className={styles.panelGrid}>
                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <KeyRound size={18} />
                            <div>
                                <h2>Security Credentials</h2>
                                <p>Use your current password to authorize changes to password and operational PINs.</p>
                            </div>
                        </div>
                        <div className={styles.formGrid}>
                            <label className={`${styles.field} ${styles.fieldFull}`}>
                                <span>Current Password</span>
                                <input type="password" value={securityForm.current_password} onChange={(e) => setSecurityForm((s) => ({ ...s, current_password: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>New Password</span>
                                <input type="password" value={securityForm.new_password} onChange={(e) => setSecurityForm((s) => ({ ...s, new_password: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Confirm Password</span>
                                <input type="password" value={securityForm.confirm_password} onChange={(e) => setSecurityForm((s) => ({ ...s, confirm_password: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>POS Approval PIN</span>
                                <input type="password" maxLength={10} value={securityForm.pos_approval_pin} onChange={(e) => setSecurityForm((s) => ({ ...s, pos_approval_pin: e.target.value }))} />
                                <small>Used for POS void, cancel, and approval actions.</small>
                            </label>
                            <label className={styles.field}>
                                <span>Management PIN</span>
                                <input type="password" maxLength={10} value={securityForm.management_pin} onChange={(e) => setSecurityForm((s) => ({ ...s, management_pin: e.target.value }))} />
                                <small>Used for management-level control and close authorizations.</small>
                            </label>
                            <label className={styles.field}>
                                <span>POS User PIN</span>
                                <input type="password" maxLength={10} value={securityForm.pos_user_pin} onChange={(e) => setSecurityForm((s) => ({ ...s, pos_user_pin: e.target.value }))} />
                                <small>Used by POS users to open and close the sales counter.</small>
                            </label>
                        </div>
                        <button type="button" className={styles.primaryButton} onClick={() => void saveSecurity()} disabled={savingSecurity}>
                            {savingSecurity ? <Loader2 size={16} className={styles.spin} /> : <Shield size={16} />}
                            Update Security
                        </button>
                    </section>

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <MapPin size={18} />
                            <div>
                                <h2>Access Snapshot</h2>
                                <p>Your current role and effective rights across the active organization context.</p>
                            </div>
                        </div>
                        <div className={styles.permissionList}>
                            {permissionPreview.length > 0 ? permissionPreview.map((permission) => (
                                <span key={permission} className={styles.permissionChip}>{permission}</span>
                            )) : <span className={styles.emptyState}>No effective permissions found.</span>}
                        </div>
                        {profile?.effective_permissions && profile.effective_permissions.length > permissionPreview.length ? (
                            <div className={styles.permissionFooter}>
                                +{profile.effective_permissions.length - permissionPreview.length} more rights
                            </div>
                        ) : null}
                    </section>
                </div>
            )}
        </div>
    );
}

export default MyAccountPage;
