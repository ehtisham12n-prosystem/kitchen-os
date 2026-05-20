import { useState, useMemo } from 'react';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import styles from './RolePermissionsEditor.module.css';

// Mock data structured similarly to how the backend will send it grouped by module
const MOCK_PERMISSIONS_MODULES = [
    {
        module_id: 'user',
        module_name: 'USER Permission',
        permissions: [
            { id: 'user:view', name: 'View User' },
            { id: 'user:create', name: 'Create User' },
            { id: 'user:edit', name: 'Edit User' },
            { id: 'user:delete', name: 'Delete User' },
            { id: 'user:reset_pass', name: 'Reset User Password' }
        ]
    },
    {
        module_id: 'role',
        module_name: 'ROLE Permission',
        permissions: [
            { id: 'role:view', name: 'View Role' },
            { id: 'role:create', name: 'Create Role' },
            { id: 'role:edit', name: 'Edit Role' },
            { id: 'role:delete', name: 'Delete Role' }
        ]
    },
    {
        module_id: 'reports',
        module_name: 'REPORTS Permission',
        permissions: [
            { id: 'reports:cash', name: 'View All Cash Reports' },
            { id: 'reports:sales', name: 'View Sales Reports' }
        ]
    },
    {
        module_id: 'inventory',
        module_name: 'INVENTORY Permission',
        permissions: [
            { id: 'inv:view', name: 'View Stock' },
            { id: 'inv:adjust', name: 'Adjust Stock' },
            { id: 'inv:transfer', name: 'Transfer Stock' }
        ]
    },
    {
        module_id: 'orders',
        module_name: 'ORDERS Permission',
        permissions: [
            { id: 'orders:view', name: 'View Orders' },
            { id: 'orders:create', name: 'Create Orders' },
            { id: 'orders:void', name: 'Void / Cancel Orders' }
        ]
    }
];

interface RolePermissionsEditorProps {
    roleId: string;
    roleName: string;
    onClose: () => void;
}

export function RolePermissionsEditor({ roleId, roleName, onClose }: RolePermissionsEditorProps) {
    // Highly optimized Set for tracking assigned permissions without UI lag
    const [assignedPerms, setAssignedPerms] = useState<Set<string>>(new Set(['user:view', 'reports:cash']));

    const handleToggle = (permId: string) => {
        setAssignedPerms(prev => {
            const next = new Set(prev);
            if (next.has(permId)) {
                next.delete(permId);
            } else {
                next.add(permId);
            }
            return next;
        });
    };

    const handleToggleModuleAll = (moduleId: string, isAllSelected: boolean) => {
        const modulePerms = MOCK_PERMISSIONS_MODULES.find(m => m.module_id === moduleId)?.permissions.map(p => p.id) || [];
        setAssignedPerms(prev => {
            const next = new Set(prev);
            if (isAllSelected) {
                // Remove all
                modulePerms.forEach(id => next.delete(id));
            } else {
                // Add all
                modulePerms.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleSave = () => {
        // Prepare the array format for API payload
        const payload = Array.from(assignedPerms);
        console.log(`Saving permissions for role ${roleId}:`, payload);
        onClose();
    };

    // Memoized blocks to prevent useless re-rendering of massive lists
    const renderModuleLists = useMemo(() => {
        return MOCK_PERMISSIONS_MODULES.map(module => {
            const modulePermIds = module.permissions.map(p => p.id);
            const allAssigned = modulePermIds.length > 0 && modulePermIds.every(id => assignedPerms.has(id));

            return (
                <div key={module.module_id} className={styles.permissionBox}>
                    <div className={styles.boxHeader}>
                        <span className={styles.boxTitle}>{module.module_name}</span>
                        <label className={styles.selectAllLabel}>
                            <input
                                type="checkbox"
                                checked={allAssigned}
                                onChange={() => handleToggleModuleAll(module.module_id, allAssigned)}
                            />
                            Select All
                        </label>
                    </div>
                    <div className={styles.permissionsGrid}>
                        {module.permissions.map(perm => (
                            <label key={perm.id} className={styles.permissionItem}>
                                <input
                                    type="checkbox"
                                    checked={assignedPerms.has(perm.id)}
                                    onChange={() => handleToggle(perm.id)}
                                />
                                {perm.name}
                            </label>
                        ))}
                    </div>
                </div>
            );
        });
    }, [assignedPerms]);

    return (
        <div className={styles.overlay}>
            <div className={styles.modalContent}>
                <header className={styles.header}>
                    <div className={styles.titleInfo}>
                        <h2>Edit Role Configuration</h2>
                        <div className={styles.roleNameOuter}>
                            <span className={styles.roleLabel}>Role Name</span>
                            <input
                                className={styles.roleNameInput}
                                value={roleName}
                                readOnly
                            />
                        </div>
                    </div>
                </header>

                <div className={styles.scrollableContent}>
                    <div className={styles.modulesGrid}>
                        {renderModuleLists}
                    </div>
                </div>

                <footer className={styles.footerActions}>
                    <KitchenButton variant="secondary" onClick={onClose}>Close</KitchenButton>
                    <KitchenButton onClick={handleSave}>Update Role</KitchenButton>
                </footer>
            </div>
        </div>
    );
}
