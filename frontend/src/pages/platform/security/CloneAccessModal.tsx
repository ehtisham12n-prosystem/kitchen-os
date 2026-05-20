import { useState } from 'react';
import { KitchenCard } from '../../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { X, ArrowRight, Shield, Users, CheckCircle2, Copy, AlertTriangle, Fingerprint } from 'lucide-react';
import styles from './Security.module.css';

interface UserIdentity {
    id: string;
    name: string;
    email: string;
    role: string;
}

const MOCK_USERS: UserIdentity[] = [];

export function CloneAccessModal({ onClose }: { onClose: () => void }) {
    const [sourceUserId, setSourceUserId] = useState('');
    const [targetUserId, setTargetUserId] = useState('');
    const [cloneType, setCloneType] = useState<'all' | 'groups' | 'direct'>('all');
    const [step, setStep] = useState(1);

    const sourceUser = MOCK_USERS.find(u => u.id === sourceUserId);
    const targetUser = MOCK_USERS.find(u => u.id === targetUserId);

    const handleClone = () => {
        // Mock clone action
        onClose();
    };

    return (
        <div className={styles.modalOverlay} style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-overlay-bg)',
            backdropFilter: 'var(--glass-blur)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <KitchenCard style={{
                width: '100%',
                maxWidth: '680px',
                padding: 0,
                border: '1px solid var(--glass-border)',
                background: 'var(--modal-bg)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideInUp 0.3s ease-out'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(99, 102, 241, 0.2)'
                        }}>
                            <Copy size={24} color="var(--accent-primary)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Outfit, sans-serif' }}>Clone Access Profile</h2>
                            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                Duplicate security directives and group memberships between identities.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        transition: 'var(--transition-fast)'
                    }} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', padding: '16px 32px', background: 'rgba(0,0,0,0.1)', gap: '12px' }}>
                    <div style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        background: step >= 1 ? 'var(--accent-primary)' : 'var(--glass-border)'
                    }} />
                    <div style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        background: step >= 2 ? 'var(--accent-primary)' : 'var(--glass-border)'
                    }} />
                </div>

                <div style={{ padding: '32px' }}>
                    {step === 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Identity Selection */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto 1fr',
                                alignItems: 'center',
                                gap: '24px',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '24px',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Profile</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            className={styles.sidebarInput}
                                            style={{
                                                width: '100%',
                                                background: 'var(--input-bg)',
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--text-primary)',
                                                appearance: 'none'
                                            }}
                                            value={sourceUserId}
                                            onChange={(e) => setSourceUserId(e.target.value)}
                                        >
                                            <option value="">Choose identity...</option>
                                            {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    {sourceUser && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                            <div className={styles.avatar} style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', fontSize: '0.8rem' }}>{sourceUser.name.charAt(0)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sourceUser.role}</div>
                                                <div>{sourceUser.email}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <ArrowRight size={20} color="var(--text-muted)" />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Profile</label>
                                    <select
                                        className={styles.sidebarInput}
                                        style={{
                                            width: '100%',
                                            background: 'var(--input-bg)',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--input-border)',
                                            color: 'var(--text-primary)',
                                            appearance: 'none'
                                        }}
                                        value={targetUserId}
                                        onChange={(e) => setTargetUserId(e.target.value)}
                                    >
                                        <option value="">Choose identity...</option>
                                        {MOCK_USERS.filter(u => u.id !== sourceUserId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    {targetUser && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                            <div className={styles.avatar} style={{ width: '32px', height: '32px', background: 'var(--accent-tertiary)', fontSize: '0.8rem' }}>{targetUser.name.charAt(0)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{targetUser.role}</div>
                                                <div>{targetUser.email}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scope Selection */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duplication Scope</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <button
                                        onClick={() => setCloneType('all')}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '16px',
                                            background: cloneType === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                            border: '1px solid',
                                            borderColor: cloneType === 'all' ? 'var(--accent-primary)' : 'var(--glass-border)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        <Fingerprint size={24} color={cloneType === 'all' ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Full Replica</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Groups and direct overrides.</div>
                                    </button>
                                    <button
                                        onClick={() => setCloneType('groups')}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '16px',
                                            background: cloneType === 'groups' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.03)',
                                            border: '1px solid',
                                            borderColor: cloneType === 'groups' ? 'var(--accent-secondary)' : 'var(--glass-border)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        <Users size={24} color={cloneType === 'groups' ? 'var(--accent-secondary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Policy Group</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Inherited group memberships.</div>
                                    </button>
                                    <button
                                        onClick={() => setCloneType('direct')}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '16px',
                                            background: cloneType === 'direct' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)',
                                            border: '1px solid',
                                            borderColor: cloneType === 'direct' ? 'var(--accent-tertiary)' : 'var(--glass-border)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        <Shield size={24} color={cloneType === 'direct' ? 'var(--accent-tertiary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Direct Exceptions</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Only atomic direct perms.</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '16px',
                                padding: '24px'
                            }}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle2 size={18} color="var(--success)" /> Impact Analysis
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Target identity <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{targetUser?.name}</span> will be synchronized with <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{sourceUser?.name}</span>.
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '12px', textTransform: 'uppercase' }}>Items to be cloned:</div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {cloneType !== 'direct' && ['Super Admin', 'Platform Moderator'].map(g => (
                                                <div key={g} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                                    Policy: {g}
                                                </div>
                                            ))}
                                            {cloneType !== 'groups' && ['CLIENT_VIEW', 'SUBSCRIPTION_MANAGE'].map(p => (
                                                <div key={p} style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-tertiary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                                                    Direct: {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        background: 'rgba(239, 68, 68, 0.05)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(239, 68, 68, 0.1)'
                                    }}>
                                        <AlertTriangle size={18} color="#ef4444" />
                                        <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>
                                            Warning: This operation will overwrite current access levels of the target identity.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Footer */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        marginTop: '32px',
                        paddingTop: '24px',
                        borderTop: '1px solid var(--glass-border)'
                    }}>
                        <KitchenButton variant="secondary" onClick={step === 1 ? onClose : () => setStep(1)}>
                            {step === 1 ? 'Discard' : 'Go Back'}
                        </KitchenButton>
                        <KitchenButton
                            disabled={!sourceUserId || !targetUserId}
                            onClick={step === 1 ? () => setStep(2) : handleClone}
                            style={{ minWidth: '160px' }}
                        >
                            {step === 1 ? 'Inspect Transition' : 'Commit Configuration'}
                        </KitchenButton>
                    </div>
                </div>
            </KitchenCard>
        </div>
    );
}

