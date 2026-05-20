import { useState } from 'react';
import { Banknote, CheckCircle2, Clock, Monitor, Shield, User } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { useCurrencyConfig } from '../../hooks/useCurrencyConfig';

interface Props {
    counterName: string;
    username: string;
    businessDate: string;
    assignedFloat?: number | null;
    currencyLabel?: string;
    formatMoneyOverride?: (amount: number) => string;
    onConfirm: (amount: number) => Promise<void> | void;
}

export function PosOpeningCashModal({ counterName, username, businessDate, assignedFloat, currencyLabel: currencyLabelProp, formatMoneyOverride, onConfirm }: Props) {
    const { currencyLabel: fallbackCurrencyLabel, formatMoney } = useCurrencyConfig();
    const currencyLabel = currencyLabelProp || fallbackCurrencyLabel;
    const [step, setStep] = useState<'enter' | 'verify'>('enter');
    const [cashInput, setCashInput] = useState(assignedFloat ? String(assignedFloat) : '');
    const [verifiedAssigned, setVerifiedAssigned] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const now = new Date();
    const startTime = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const amount = parseFloat(cashInput) || 0;
    const formatted = formatMoneyOverride ? formatMoneyOverride(amount) : formatMoney(amount);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm(amount);
        } finally {
            setSubmitting(false);
        }
    };

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(2, 2, 5, 0.92)',
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
        maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    };

    return (
        <div style={overlayStyle}>
            <div style={cardStyle}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{
                        width: 60, height: 60, borderRadius: '50%', margin: '0 auto 1rem',
                        background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                        border: '2px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Banknote size={28} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <h2 style={{ margin: '0 0 0.3rem', font: '700 1.25rem var(--font-heading)', color: 'var(--text-primary)' }}>
                        {step === 'enter' ? 'Enter Opening Cash' : 'Confirm Session Start'}
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {step === 'enter'
                            ? 'Count the cash in your till drawer and enter the total amount.'
                            : 'Review your session details and confirm to begin.'}
                    </p>
                </div>

                {step === 'enter' && (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Opening Cash Amount ({currencyLabel})
                            </label>
                            <input
                                type="number"
                                autoFocus
                                min={0}
                                placeholder="0.00"
                                value={cashInput}
                                onChange={e => {
                                    setCashInput(e.target.value);
                                    if (assignedFloat !== null && assignedFloat !== undefined && Number(e.target.value) !== assignedFloat) {
                                        setVerifiedAssigned(false);
                                    }
                                }}
                                onKeyDown={e => { 
                                    if (e.key === 'Enter') {
                                        if (assignedFloat !== null && assignedFloat !== undefined && amount === assignedFloat && !verifiedAssigned) return;
                                        if (amount > 0) setStep('verify'); 
                                    }
                                }}
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
                            
                            {assignedFloat !== null && assignedFloat !== undefined && amount === assignedFloat && (
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={verifiedAssigned}
                                        onChange={e => setVerifiedAssigned(e.target.checked)}
                                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>I verify the physical till matches this amount.</span>
                                </label>
                            )}

                            <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Include all bills and coins in your starting float
                            </p>
                        </div>

                        {/* Counter info strip */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
                            padding: '0.75rem', background: 'rgba(255,255,255,0.03)',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)',
                            marginBottom: '1.25rem', fontSize: '0.75rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                                <User size={12} /> <span>{username}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                                <Monitor size={12} /> <span>{counterName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                                <Clock size={12} /> <span>{businessDate}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                                <Clock size={12} /> <span>{startTime}</span>
                            </div>
                        </div>

                        <KitchenButton
                            variant="primary"
                            className="w-full"
                            disabled={amount <= 0 || (assignedFloat !== null && assignedFloat !== undefined && amount === assignedFloat && !verifiedAssigned)}
                            onClick={() => setStep('verify')}
                        >
                            Continue →
                        </KitchenButton>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        {/* Verification card */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                                <Shield size={15} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Verification</span>
                            </div>

                            {[
                                { label: 'Cashier', value: username, icon: <User size={13} /> },
                                { label: 'Terminal', value: counterName, icon: <Monitor size={13} /> },
                                { label: 'Business Date', value: businessDate, icon: <Clock size={13} /> },
                                { label: 'Start Time', value: startTime, icon: <Clock size={13} /> },
                            ].map(row => (
                                <div key={row.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    fontSize: '0.82rem',
                                }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {row.icon} {row.label}
                                    </span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{row.value}</strong>
                                </div>
                            ))}

                            {/* Opening cash highlight */}
                            <div style={{
                                marginTop: '0.75rem', padding: '0.75rem',
                                background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Banknote size={14} /> Opening Cash
                                </span>
                                <strong style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{formatted}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <KitchenButton variant="ghost" onClick={() => setStep('enter')} style={{ flex: 1 }}>
                                ← Edit
                            </KitchenButton>
                            <KitchenButton
                                variant="primary"
                                isLoading={submitting}
                                onClick={() => void handleConfirm()}
                                style={{ flex: 2 }}
                            >
                                <CheckCircle2 size={15} /> Confirm &amp; Start POS
                            </KitchenButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
