import { useState } from 'react';
import { User, Lock, LogIn, ShieldCheck, Terminal } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { authApi } from '../../api/api';
import { persistUserContext } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import styles from './LoginPage.module.css';

export function AdminLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await authApi.systemLogin({ username, password });

            setAuthSessionItem('access_token', data.access_token);
            setAuthSessionItem('isLoggedIn', 'true');
            setAuthSessionItem('user_type', 'system');
            persistUserContext(data.user_context);

            window.location.href = '/nexus';
        } catch (err: any) {
            setError(err.message || 'Invalid platform admin credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className="ambient-light-1" style={{ background: 'var(--accent-primary)' }}></div>
            <div className="ambient-light-2" style={{ background: 'var(--accent-secondary)' }}></div>
            <div className="ambient-light-3" style={{ background: 'var(--accent-tertiary)' }}></div>

            <div className={styles.loginWrapper}>
                <div className={styles.brandSection}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>
                            <ShieldCheck size={48} color="var(--accent-primary)" />
                        </div>
                    </div>
                    <h1 className="text-gradient">KitchenOS Admin</h1>
                    <p>Standard Governance & Platform Infrastructure</p>
                </div>

                <KitchenCard className={styles.card}>
                    <form className={styles.form} onSubmit={handleLogin}>
                        <div className={styles.formHeader}>
                            <h2>System Operator Login</h2>
                            <p className={styles.subtitle}>Enter administrative credentials to manage the ecosystem</p>
                        </div>

                        {error && (
                            <div className={styles.errorAlert} style={{ animation: 'fadeIn 0.3s ease' }}>
                                {error}
                            </div>
                        )}

                        <KitchenInput
                            label="Operator ID / Username"
                            type="text"
                            placeholder="admin_username"
                            icon={<User size={20} />}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />

                        <KitchenInput
                            label="Security Password"
                            type="password"
                            placeholder="••••••••"
                            icon={<Lock size={20} />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <KitchenButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            className={styles.loginBtn}
                            isLoading={isLoading}
                        >
                            <LogIn size={20} style={{ marginRight: '8px' }} />
                            Authenticate & Enter
                        </KitchenButton>

                        <div className={styles.adminMeta}>
                            <Terminal size={14} /> <span>Secure Node: {window.location.hostname}</span>
                        </div>
                    </form>
                </KitchenCard>

                <p className={styles.footer}>
                    &copy; {new Date().getFullYear()} KitchenOS Technology Group. <br />
                    Unauthorized access is strictly prohibited.
                </p>
            </div>
        </div>
    );
}

