import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { apiAssetUrl, apiUrl } from '../../api/api';
import { persistUserContext } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const [tenantInfo, setTenantInfo] = useState<any>(null);
    const [tenantLookupStatus, setTenantLookupStatus] = useState<'checking' | 'found' | 'missing' | 'error'>(
        tenantSlug ? 'checking' : 'found',
    );

    const branding = tenantInfo?.branding || null;
    const backgroundImage = branding?.login_background_url ? apiAssetUrl(branding.login_background_url) : null;
    const logoImage = branding?.show_login_full_logo && branding?.full_logo_url ? apiAssetUrl(branding.full_logo_url) : null;
    const businessName = branding?.show_login_business_name
        ? (branding?.receipt_business_name || tenantInfo?.client_name || 'KitchenOS')
        : 'KitchenOS';
    const loginBranchName = branding?.show_login_branch_name ? tenantInfo?.primary_branch?.branch_name : null;
    const brandSubtitle = loginBranchName
        || (tenantInfo?.client_name
            ? `Official Portal for ${tenantInfo.client_name}`
            : tenantLookupStatus === 'missing'
                ? 'Workspace not found'
                : tenantSlug
                    ? 'KitchenOS Console'
                    : 'The ultimate Hospitality SaaS solution');

    useEffect(() => {
        setUsername('');
        setPassword('');
    }, []);

    const getNetworkErrorMessage = (err: unknown) => {
        if (err instanceof Error) {
            const normalized = err.message.trim().toLowerCase();
            if (
                normalized === 'failed to fetch'
                || normalized.includes('load failed')
                || normalized.includes('networkerror')
            ) {
                return 'Unable to reach the KitchenOS API. Please confirm the backend is running on http://127.0.0.1:3000.';
            }

            return err.message;
        }

        return 'Unable to complete the request right now.';
    };

    useEffect(() => {
        let isMounted = true;

        if (!tenantSlug) {
            setTenantInfo(null);
            setTenantLookupStatus('found');
            return;
        }

        setTenantInfo(null);
        setTenantLookupStatus('checking');

        fetch(apiUrl(`/platform/clients/by-slug/${tenantSlug}`))
            .then(res => {
                if (res.status === 404 || res.status === 204) {
                    return null;
                }

                if (!res.ok) {
                    throw new Error('Workspace lookup failed');
                }

                const ct = res.headers.get('content-type');
                if (!ct || !ct.includes('application/json')) {
                    throw new Error('Workspace lookup returned an invalid response');
                }

                return res.json();
            })
            .then(data => {
                if (!isMounted) return;
                if (data) {
                    setTenantInfo(data);
                    setTenantLookupStatus('found');
                    return;
                }

                setTenantLookupStatus('missing');
            })
            .catch(err => {
                if (!isMounted) return;
                setError(getNetworkErrorMessage(err));
                setTenantLookupStatus('error');
            });

        return () => {
            isMounted = false;
        };
    }, [tenantSlug]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            let response: Response;
            try {
                response = await fetch(apiUrl('/auth/client-login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, tenantSlug }),
                });
            } catch (err) {
                throw new Error(getNetworkErrorMessage(err));
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json().catch(() => ({}));

            setAuthSessionItem('access_token', data.access_token);
            setAuthSessionItem('isLoggedIn', 'true');
            persistUserContext({
                ...(data.user_context || {}),
                tenant_slug: data.user_context?.tenant_slug || tenantSlug || null,
                domain_slug: data.user_context?.domain_slug || tenantSlug || null,
            });
            setAuthSessionItem('user_type', data.user_context.type || data.user_context.user_type || 'client');

            navigate(tenantSlug ? `/console/${tenantSlug}` : '/console');
        } catch (err: unknown) {
            setError(getNetworkErrorMessage(err) || 'Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    if (tenantLookupStatus === 'checking') {
        return (
            <AccessMessage
                title="Checking Workspace"
                body="Please wait while KitchenOS verifies this console address."
                chip="/console/your-official-name/auth"
                footer="This portal can only be opened through your official sign-in link."
            />
        );
    }

    if (tenantLookupStatus === 'missing') {
        return (
            <AccessMessage
                title="Use Your Official Access Link"
                body="This portal can only be opened through your official sign-in link. Please use the link provided to you."
                chip="/console/your-official-name/auth"
                footer="If you do not have the correct link, please contact your administrator or support team for help."
            />
        );
    }

    if (tenantLookupStatus === 'error') {
        return (
            <AccessMessage
                title="Unable to Verify Workspace"
                body={error || 'KitchenOS could not verify this console address right now.'}
                chip="/console/your-official-name/auth"
                footer="Please confirm the API is running, then try the official access link again."
            />
        );
    }

    return (
        <div
            className={styles.container}
            style={backgroundImage ? { backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.72), rgba(2, 6, 23, 0.82)), url(${backgroundImage})` } : undefined}
        >
            <div className="ambient-light-1"></div>
            <div className="ambient-light-2"></div>
            <div className={styles.loginWrapper}>
                <div className={styles.brandSection}>
                    <div className={styles.logo}>
                        {logoImage ? <img src={logoImage} alt={businessName} className={styles.logoImage} /> : 'KitchenOS'}
                    </div>
                    <h1>{businessName}</h1>
                    <p>{brandSubtitle}</p>
                </div>

                {tenantLookupStatus === 'found' && (
                    <KitchenCard className={styles.card}>
                        <form className={styles.form} onSubmit={handleLogin}>
                            <h2>Welcome Back</h2>
                            <p className={styles.subtitle}>Log in to manage your organization</p>

                            {error && <div className={styles.errorAlert}>{error}</div>}

                            <KitchenInput
                                label="Username"
                                type="text"
                                placeholder="Your username"
                                icon={<User />}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />

                            <KitchenInput
                                label="Password"
                                type="password"
                                placeholder="........"
                                icon={<Lock />}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <div className={styles.options}>
                                <label className={styles.rememberMe}>
                                    <input type="checkbox" /> Remember me
                                </label>
                                <a href="#" className={styles.forgotPassword}>Forgot password?</a>
                            </div>

                            <KitchenButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                className={styles.loginBtn}
                                isLoading={isLoading}
                            >
                                <LogIn size={20} style={{ marginRight: '8px' }} />
                                Sign In
                            </KitchenButton>
                        </form>
                    </KitchenCard>
                )}

                <p className={styles.footer}>
                    Don&apos;t have an account? <a href="#">Create Organization</a>
                </p>
            </div>
        </div>
    );
}

function AccessMessage({ title, body, chip, footer }: { title: string; body: string; chip: string; footer: string }) {
    return (
        <div className={styles.accessShell}>
            <section className={styles.accessCard} aria-labelledby="access-message-title">
                <div className={styles.accessIcon} aria-hidden="true">
                    <div className={styles.bagIcon}>
                        <span className={styles.bagHandle} />
                        <span className={styles.bagDot} />
                    </div>
                </div>
                <h1 id="access-message-title">{title}</h1>
                <p>{body}</p>
                <code>{chip}</code>
                <p className={styles.accessFooter}>{footer}</p>
            </section>
        </div>
    );
}

export default LoginPage;
