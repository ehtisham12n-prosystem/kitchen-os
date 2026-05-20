import { useState } from 'react';
import { KitchenCard } from '../../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { Plus, Users, Shield, Edit, Trash2, X } from 'lucide-react';
import { RolePermissionsEditor } from './RolePermissionsEditor';
import styles from './Security.module.css';

interface PermissionGroup {
    id: string;
    group_name: string;
    description: string;
    is_system_default: boolean;
    permission_count: number;
}

const MOCK_CLIENT_GROUPS: PermissionGroup[] = [
    { id: '1', group_name: 'Branch Manager', description: 'Full access to branch data and reports.', is_system_default: true, permission_count: 85 },
    { id: '2', group_name: 'Cashier', description: 'Access to POS terminal only.', is_system_default: true, permission_count: 12 },
    { id: '3', group_name: 'Stock Manager', description: 'Inventory and vendor management access.', is_system_default: false, permission_count: 34 },
    { id: '4', group_name: 'Audit Staff', description: 'Read-only access to branch analytics.', is_system_default: false, permission_count: 15 },
];

export function GroupManagement() {
    const [groups, setGroups] = useState<PermissionGroup[]>(MOCK_CLIENT_GROUPS);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState<{ id: string, name: string } | null>(null);
    const [newRole, setNewRole] = useState({ name: '', description: '' });

    const handleCreateRole = () => {
        if (!newRole.name) return;
        const group: PermissionGroup = {
            id: Date.now().toString(),
            group_name: newRole.name,
            description: newRole.description,
            is_system_default: false,
            permission_count: 0
        };
        setGroups([...groups, group]);
        setNewRole({ name: '', description: '' });
        setShowModal(false);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1>Staff Groups</h1>
                    <p>Organize branch permissions into reusable roles for staff assignment.</p>
                </div>
                <KitchenButton onClick={() => setShowModal(true)}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    New Role
                </KitchenButton>
            </header>

            <div className={styles.groupGrid}>
                {groups.map(group => (
                    <KitchenCard key={group.id} className={styles.groupCard}>
                        {group.is_system_default && <span className={styles.systemBadge}>Default</span>}
                        <div className={styles.groupHeader}>
                            <div className={styles.groupIcon}><Users size={24} /></div>
                            <div className={styles.groupInfo}>
                                <h3>{group.group_name}</h3>
                                <p>{group.description}</p>
                            </div>
                        </div>
                        <div className={styles.permCount}>
                            <Shield size={16} />
                            <span><strong>{group.permission_count}</strong> permissions assigned</span>
                        </div>
                        <div className={styles.rowActions}>
                            <KitchenButton variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => setEditingRole({ id: group.id, name: group.group_name })}>Permissions</KitchenButton>
                            <KitchenButton variant="secondary" size="sm"><Edit size={14} /></KitchenButton>
                            {!group.is_system_default && (
                                <KitchenButton variant="secondary" size="sm"><Trash2 size={14} color="var(--color-error)" /></KitchenButton>
                            )}
                        </div>
                    </KitchenCard>
                ))}
            </div>

            {showModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>Create New Staff Role</h2>
                            <KitchenButton variant="secondary" size="sm" onClick={() => setShowModal(false)}><X size={20} /></KitchenButton>
                        </div>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Role Name</label>
                                <input
                                    className={styles.inputField}
                                    placeholder="e.g. Senior Supervisor"
                                    value={newRole.name}
                                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Description</label>
                                <textarea
                                    className={styles.inputField}
                                    placeholder="What can this role do?"
                                    rows={3}
                                    style={{ resize: 'none' }}
                                    value={newRole.description}
                                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Base Template</label>
                                <select className={styles.inputField}>
                                    <option value="">Blank (No permissions)</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>Copy from {g.group_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="secondary" onClick={() => setShowModal(false)}>Cancel</KitchenButton>
                            <KitchenButton onClick={handleCreateRole} disabled={!newRole.name}>Create Role</KitchenButton>
                        </div>
                    </div>
                </div>
            )}

            {editingRole && (
                <RolePermissionsEditor
                    roleId={editingRole.id}
                    roleName={editingRole.name}
                    onClose={() => setEditingRole(null)}
                />
            )}
        </div>
    );
}

