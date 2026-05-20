import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn, Heart, Smartphone } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { authApi } from '../../api/api';
import { persistUserContext } from '../../auth/access';
import { setAuthSessionItem } from '../../auth/storage';
import styles from './LoginPage.module.css';

export function CustomerLoginPage() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await authApi.customerLogin({ username: identifier, password });

            setAuthSessionItem('access_token', data.access_token);
            setAuthSessionItem('isLoggedIn', 'true');
            setAuthSessionItem('user_type', data.user_context?.type || data.user_context?.user_type || 'customer');
            persistUserContext(data.user_context);

            navigate('/portal');
        } catch (err: any) {
            setError(err.message || 'Invalid email or mobile number');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container} style={{ background: '#fff' }}>
            <div className="ambient-light-1" style={{ background: '#ef4444', opacity: 0.1 }}></div>
            <div className={styles.loginWrapper} style={{ maxWidth: '400px' }}>
                <div className={styles.brandSection}>
                    <div className={styles.logo} style={{ fontSize: '3rem' }}>🍕</div>
                    <h1 style={{ color: '#1f2937' }}>Welcome Back</h1>
                    <p style={{ color: '#6b7280' }}>Dine, Earn & Enjoy</p>
                </div>

                <KitchenCard className={styles.card} style={{ border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '24px' }}>
                    <form className={styles.form} onSubmit={handleLogin}>
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <Heart size={32} color="#ef4444" fill="#ef4444" style={{ margin: '0 auto' }} />
                        </div>

                        {error && <div className={styles.errorAlert} style={{ borderRadius: '12px' }}>{error}</div>}

                        <KitchenInput
                            label="Email or Mobile"
                            type="text"
                            placeholder="hello@example.com"
                            icon={<Smartphone size={18} />}
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                        />

                        <KitchenInput
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            icon={<Lock size={18} />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <div className={styles.options} style={{ marginTop: '0' }}>
                            <a href="#" className={styles.forgotPassword} style={{ fontSize: '13px', color: '#6b7280' }}>Forgot password?</a>
                        </div>

                        <KitchenButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            className={styles.loginBtn}
                            isLoading={isLoading}
                            style={{
                                background: '#1f2937',
                                color: '#fff',
                                borderRadius: '16px',
                                padding: '16px',
                                marginTop: '16px'
                            }}
                        >
                            <LogIn size={20} style={{ marginRight: '8px' }} />
                            Sign In to Portal
                        </KitchenButton>
                    </form>
                </KitchenCard>

                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                        New here? <a href="#" style={{ color: '#ef4444', fontWeight: 600 }}>Create Account</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

