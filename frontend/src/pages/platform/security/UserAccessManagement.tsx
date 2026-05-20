import { useState } from 'react';
import { KitchenCard } from '../../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { Search, Copy, Plus, Info, CheckCircle2, Users, Shield, UserCheck, ShieldAlert, Fingerprint } from 'lucide-react';
import styles from './Security.module.css';
import { CloneAccessModal } from './CloneAccessModal';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    groups: string[];
}

const MODULE_PERMISSIONS = [
    {
        module: 'Core System',
        perms: [
            { key: 'CLIENT_VIEW', name: 'View Clients' },
            { key: 'CLIENT_CREATE', name: 'Create Clients' },
            { key: 'CLIENT_EDIT', name: 'Edit Clients' },
            { key: 'CLIENT_DELETE', name: 'Delete Clients' },
        ]
    },
    {
        module: 'Administrative',
        perms: [
            { key: 'USER_VIEW', name: 'View Users' },
            { key: 'USER_MANAGE', name: 'Manage Users' },
            { key: 'ACCESS_CONTROL', name: 'Manage Access Control' },
        ]
    }
];

export function UserAccessManagement() {
    const [users] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [search, setSearch] = useState('');
    const [showCloneModal, setShowCloneModal] = useState(false);

    const selectedUser = users.find(u => u.id === selectedUserId);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <div className={styles.eyebrowHeader}><Fingerprint size={12} /> Identity Governance</div>
                    <h1 className="text-gradient">Access Intelligence</h1>
                    <p>Resolution of effective rights and security group inheritance.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <KitchenButton variant="secondary" size="sm" onClick={() => setShowCloneModal(true)}>
                        <Copy size={16} style={{ marginRight: '6px' }} />
                        Clone Access
                    </KitchenButton>
                    <KitchenButton size="sm">
                        <Plus size={16} style={{ marginRight: '6px' }} />
                        Assign Access
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.kpiGrid}>
                {/* Managed Identities */}
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                <Users size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Managed Identities</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{users.length}</div>
                    <div className={styles.kpiMeta}>
                        <span>Active access profiles</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Resolution State */}
                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                <CheckCircle2 size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Resolution State</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>Verified</div>
                    <div className={styles.kpiMeta}>
                        <span>Policy integrity confirmed</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Scope Coverage */}
                <div className={`${styles.kpiCard} ${styles.kpiCyan}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconCyan}`}>
                                <Shield size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Scope Coverage</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>Hybrid</div>
                    <div className={styles.kpiMeta}>
                        <span>Direct & Policy inheritance</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Security Index */}
                <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                                <Fingerprint size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Security Index</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>99%</div>
                    <div className={styles.kpiMeta}>
                        <span>Auth architecture health</span>
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '99%' }} />
                    </div>
                </div>
            </div>

            <div className={styles.accessLayout}>
                {/* Left: User Directory */}
                <KitchenCard className={styles.userListCard} noPadding>
                    <div className={styles.sidebarSearch}>
                        <Search size={16} color="var(--accent-primary)" />
                        <input placeholder="Filter identity..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.sidebarInput} />
                    </div>

                    <div className={styles.userItemsList}>
                        {users.map(user => (
                            <div
                                key={user.id}
                                className={`${styles.userItem} ${selectedUserId === user.id ? styles.activeUser : ''}`}
                                onClick={() => setSelectedUserId(user.id)}
                            >
                                <div className={styles.avatar} style={{ background: selectedUserId === user.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)' }}>
                                    {user.name.charAt(0)}
                                </div>
                                <div className={styles.userDetails}>
                                    <h4>{user.name}</h4>
                                    <p>{user.email}</p>
                                </div>
                                {selectedUserId === user.id && <div className={styles.activeIndicator} />}
                            </div>
                        ))}
                    </div>
                </KitchenCard>

                {/* Right: Access Config */}
                <div className={styles.accessDetail}>
                    <KitchenCard noPadding className={styles.configCard}>
                        <div className={styles.configHeader}>
                            <div className={styles.configUserInfo}>
                                <div className={styles.avatarLg}>{selectedUser?.name.charAt(0)}</div>
                                <div>
                                    <h2>{selectedUser?.name}</h2>
                                    <p>{selectedUser?.role} • {selectedUser?.email}</p>
                                </div>
                            </div>
                            <div className={styles.configStatus}>
                                <div className={styles.pulseDot} />
                                <span>Session Active</span>
                            </div>
                        </div>

                        <div className={styles.threeColumnLayout} style={{ padding: '24px' }}>
                            {/* Column 1: Groups */}
                            <div className={styles.accessColumn}>
                                <div className={styles.columnHeader}>
                                    <Users size={18} color="var(--accent-primary)" />
                                    <h3>Security Groups</h3>
                                </div>
                                <div className={styles.groupSelectionList}>
                                    {['Super Admin', 'Admin', 'HR Manager', 'Finance', 'Auditor', 'Operator'].map(gName => (
                                        <label key={gName} className={`${styles.groupOption} ${selectedUser?.groups.includes(gName) ? styles.groupOptionSelected : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedUser?.groups.includes(gName)}
                                                readOnly
                                                className={styles.hiddenCheckbox}
                                            />
                                            <div className={styles.groupOptionContent}>
                                                <div className={styles.groupOptionInfo}>
                                                    <span className={styles.groupOptionName}>{gName}</span>
                                                    <span className={styles.groupOptionDesc}>Inherit role permissions</span>
                                                </div>
                                                {selectedUser?.groups.includes(gName) && <CheckCircle2 size={16} color="var(--success)" />}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Column 2: Direct Overrides */}
                            <div className={styles.accessColumn}>
                                <div className={styles.columnHeader}>
                                    <Shield size={18} color="var(--accent-secondary)" />
                                    <h3>Direct Overrides</h3>
                                </div>
                                <div className={styles.overrideAlert}>
                                    <ShieldAlert size={16} />
                                    <span>Direct rights override assigned group policies.</span>
                                </div>
                                <div className={styles.modulePermissionsList}>
                                    {MODULE_PERMISSIONS.map(mod => (
                                        <div key={mod.module} className={styles.moduleSection}>
                                            <div className={styles.moduleTitle}>{mod.module}</div>
                                            {mod.perms.map(perm => (
                                                <label key={perm.key} className={styles.permCheckbox}>
                                                    <input type="checkbox" className={styles.customCheck} />
                                                    <span>{perm.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Column 3: Effective Rights Resolution */}
                            <div className={styles.accessColumn}>
                                <div className={styles.columnHeader}>
                                    <UserCheck size={18} color="var(--success)" />
                                    <h3>Resolved Rights</h3>
                                </div>
                                <div className={styles.effectivePanel}>
                                    <div className={styles.effectiveResolutionList}>
                                        {MODULE_PERMISSIONS.map(mod => (
                                            <div key={mod.module} className={styles.resolutionModule}>
                                                <div className={styles.resolutionModuleTitle}>{mod.module}</div>
                                                <div className={styles.resolutionList}>
                                                    {mod.perms.map((perm, index) => {
                                                        const isInherited = index % 2 === 0;
                                                        return (
                                                            <div key={perm.key} className={styles.resolutionItem}>
                                                                <span className={styles.resolutionName}>{perm.name}</span>
                                                                <div className={styles.resolutionSource}>
                                                                    <span className={`${styles.sourceBadge} ${isInherited ? styles.sourceGroupBase : styles.sourceDirect}`}>
                                                                        {isInherited ? 'Policy' : 'Direct'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.configFooter}>
                            <div className={styles.footerNote}>
                                <Info size={14} />
                                <span>Changes recorded in system audit log.</span>
                            </div>
                            <div className={styles.footerActions}>
                                <KitchenButton variant="secondary">Reset Policy</KitchenButton>
                                <KitchenButton>Commit Changes</KitchenButton>
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            </div>

            {showCloneModal && (
                <CloneAccessModal onClose={() => setShowCloneModal(false)} />
            )}
        </div>
    );
}

