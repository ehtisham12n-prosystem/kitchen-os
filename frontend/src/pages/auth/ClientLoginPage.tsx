import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, Store } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { authApi } from '../../api/api';
import { persistUserContext } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import styles from './LoginPage.module.css';

export function ClientLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        setUsername('');
        setPassword('');
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await authApi.clientLogin({ username, password });

            setAuthSessionItem('access_token', data.access_token);
            setAuthSessionItem('isLoggedIn', 'true');
            setAuthSessionItem('user_type', data.user_context?.type || data.user_context?.user_type || 'client');
            persistUserContext(data.user_context);

            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Invalid business credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className="ambient-light-1" style={{ background: '#0e7490' }}></div>
            <div className={styles.loginWrapper}>
                <div className={styles.brandSection}>
                    <div className={styles.logo}><Store size={48} color="#0e7490" /></div>
                    <h1>Partner Portal</h1>
                    <p>Manage your restaurant & staff</p>
                </div>

                <KitchenCard className={styles.card}>
                    <form className={styles.form} onSubmit={handleLogin} autoComplete="off">
                        <h2>Business Login</h2>
                        <p className={styles.subtitle}>Enter your staff credentials to access the dashboard</p>

                        {error && <div className={styles.errorAlert}>{error}</div>}

                        <KitchenInput
                            label="Employee Username"
                            type="text"
                            placeholder="username"
                            icon={<User />}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="off"
                            name="client_login_username"
                            required
                        />

                        <KitchenInput
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            icon={<Lock />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            name="client_login_password"
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
                            style={{ background: '#0e7490' }}
                        >
                            <LogIn size={20} style={{ marginRight: '8px' }} />
                            Partner Sign In
                        </KitchenButton>
                    </form>
                </KitchenCard>

                <p className={styles.footer}>
                    Interested in KitchenOS? <a href="#">Learn more</a>
                </p>
            </div>
        </div>
    );
}

