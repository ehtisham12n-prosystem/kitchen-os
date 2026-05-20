import { useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Monitor, Shield, User, X } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';

interface Props {
    counterName: string;
    username: string;
    cashierUsername?: string;
    openingCash: number;
    businessDate: string;
    currencyLabel?: string;
    formatMoneyOverride?: (amount: number) => string;
    onConfirm: (totalCash: number, cashierUsername: string, cashierPin: string, authorizedUsername: string, authorizedPin: string) => Promise<void>;
    onCancel: () => void;
}

export function PosClosingCashModal({ counterName, username, cashierUsername: cashierUsernameProp, openingCash, businessDate, currencyLabel: currencyLabelProp, formatMoneyOverride, onConfirm, onCancel }: Props) {
    const { currencyLabel: fallbackCurrencyLabel, formatMoney } = useCurrencyConfig();
    const currencyLabel = currencyLabelProp || fallbackCurrencyLabel;
    const [step, setStep] = useState<'enter' | 'verify'>('enter');
    const [cashInput, setCashInput] = useState('');
    const [cashierUsername, setCashierUsername] = useState(cashierUsernameProp || username);
    const [cashierPin, setCashierPin] = useState('');
    const [authorizedUsername, setAuthorizedUsername] = useState('');
    const [authorizedPin, setAuthorizedPin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const now = new Date();
    const closeTime = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const totalCash = parseFloat(cashInput) || 0;
    const canSubmit = totalCash > 0
        && cashierUsername.trim().length > 0
        && cashierPin.trim().length > 0
        && authorizedUsername.trim().length > 0
        && authorizedPin.trim().length > 0;
    const fmtMoney = (v: number) => formatMoneyOverride ? formatMoneyOverride(v) : formatMoney(v);
    const accentTint = 'color-mix(in srgb, var(--accent-primary) 12%, white)';
    const accentBorder = 'color-mix(in srgb, var(--accent-primary) 28%, var(--glass-border))';
    const accentSoft = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)';
    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 5500,
        background: 'rgba(2, 2, 5, 0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.25s ease-out',
    };

    const cardStyle: React.CSSProperties = {
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        width: '100%',
        maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    };

    const handleConfirm = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await onConfirm(
                totalCash,
                cashierUsername.trim(),
                cashierPin.trim(),
                authorizedUsername.trim(),
                authorizedPin.trim(),
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={cardStyle}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                            background: accentSoft,
                            border: `2px solid ${accentBorder}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Banknote size={22} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, font: '700 1.1rem var(--font-heading)', color: 'var(--text-primary)' }}>
                                {step === 'enter' ? 'Close Counter' : 'Confirm Cash Count'}
                            </h2>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {step === 'enter' ? 'Enter total cash including your opening float' : 'Review and confirm your closing count'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>

                {step === 'enter' && (
                    <>
                        {/* Opening cash reminder */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            fontSize: '0.8rem',
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Your opening cash was</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(openingCash)}</strong>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Total Cash in Drawer ({currencyLabel})
                            </label>
                            <input
                                type="number"
                                autoFocus
                                min={0}
                                placeholder="0.00"
                                value={cashInput}
                                onChange={e => setCashInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && totalCash > 0) setStep('verify'); }}
                                style={{
                                    width: '100%', background: 'var(--input-bg)',
                                    border: '2px solid var(--input-border)',
                                    borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem',
                                    color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 700,
                                    textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                                }}
                                onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
                                onBlur={e => (e.target.style.borderColor = 'var(--input-border)')}
                            />
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Count all bills and coins - include your opening float
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                                <User size={12} /> {username}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                                <Monitor size={12} /> {counterName}
                            </div>
                        </div>

                        <KitchenButton variant="primary" className="w-full" disabled={totalCash <= 0} onClick={() => setStep('verify')}>
                            Continue →
                        </KitchenButton>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        <div style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)', padding: '1.1rem', marginBottom: '1.25rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--glass-border)' }}>
                                <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closing Verification</span>
                            </div>

                            {[
                                { label: 'Cashier', value: username, icon: <User size={12} /> },
                                { label: 'Terminal', value: counterName, icon: <Monitor size={12} /> },
                                { label: 'Business Date', value: businessDate, icon: <Clock size={12} /> },
                                { label: 'Close Time', value: closeTime, icon: <Clock size={12} /> },
                            ].map(row => (
                                <div key={row.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    fontSize: '0.8rem',
                                }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{row.icon} {row.label}</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{row.value}</strong>
                                </div>
                            ))}

                            {/* Cash summary */}
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Opening Cash</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{fmtMoney(openingCash)}</span>
                                </div>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.65rem 0.75rem', marginTop: '0.25rem',
                                    background: accentTint,
                                    border: `1px solid ${accentBorder}`,
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Banknote size={14} /> Total Cash Count
                                    </span>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{fmtMoney(totalCash)}</strong>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)', padding: '0.95rem', marginBottom: '1.1rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                                <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Close Authorization</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                                <div style={{ display: 'grid', gap: '0.6rem' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cashier (POS User)</div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            User ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter cashier user ID"
                                            value={cashierUsername}
                                            onChange={(e) => setCashierUsername(e.target.value)}
                                            style={{
                                                width: '100%', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem',
                                                color: 'var(--text-primary)', fontSize: '0.85rem',
                                                outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Cashier PIN
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Enter cashier PIN"
                                            value={cashierPin}
                                            onChange={(e) => setCashierPin(e.target.value)}
                                            style={{
                                                width: '100%', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem',
                                                color: 'var(--text-primary)', fontSize: '0.85rem',
                                                outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '0.6rem' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authorized User</div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            User ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter authorized user ID"
                                            value={authorizedUsername}
                                            onChange={(e) => setAuthorizedUsername(e.target.value)}
                                            style={{
                                                width: '100%', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem',
                                                color: 'var(--text-primary)', fontSize: '0.85rem',
                                                outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Authorized PIN
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Enter authorized close PIN"
                                            value={authorizedPin}
                                            onChange={(e) => setAuthorizedPin(e.target.value)}
                                            style={{
                                                width: '100%', background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem',
                                                color: 'var(--text-primary)', fontSize: '0.85rem',
                                                outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            {!canSubmit && (
                                <p style={{ margin: '0.6rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                    Cashier and authorized-user IDs/PINs are required to close the counter.
                                </p>
                            )}
                        </div>

                        {/* Blind count note */}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.75rem',
                            background: accentSoft, borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${accentBorder}`, marginBottom: '1.1rem',
                            fontSize: '0.72rem', color: 'var(--text-secondary)',
                        }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-primary)' }} />
                            <span>This is a <strong>blind count</strong>. Once cashier and authorized-user credentials are confirmed, the counter closes immediately and the counted cash is handed to branch-safe custody automatically.</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <KitchenButton variant="ghost" onClick={() => setStep('enter')} style={{ flex: 1 }}>← Edit</KitchenButton>
                            <KitchenButton variant="primary" isLoading={submitting} disabled={!canSubmit} onClick={() => void handleConfirm()} style={{ flex: 2 }}>
                                <CheckCircle2 size={15} /> Submit, Close &amp; Hand Over
                            </KitchenButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
