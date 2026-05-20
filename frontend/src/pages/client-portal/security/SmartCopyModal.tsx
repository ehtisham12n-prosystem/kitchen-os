import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Copy, Loader2, X } from 'lucide-react';
import { userApi } from '../../../api/api';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { toast } from '../../../components/ui/KitchenToast/toast';
import styles from '../UserEditor.module.css';

type SourceBranch = {
    branch_id: number;
    branch_name: string | null;
    role_id: number | null;
    role_name: string | null;
    direct_permissions: string[];
};

interface SmartCopyModalProps {
    destinationUserId: number;
    destinationBranches: { branchId: number; branchName: string }[];
    allUsers: { id: number; full_name: string; user_name: string }[];
    onClose: () => void;
    onApply: (assignments: Array<{
        branchId: number;
        roleIds: number[];
        directPermissions: string[];
    }>) => void;
}

export function SmartCopyModal({
    destinationUserId,
    destinationBranches,
    allUsers,
    onClose,
    onApply,
}: SmartCopyModalProps) {
    const [selectedSourceUserId, setSelectedSourceUserId] = useState<number | null>(null);
    const [sourceBranches, setSourceBranches] = useState<SourceBranch[]>([]);
    const [selectedSourceBranchId, setSelectedSourceBranchId] = useState<number | null>(null);
    const [selectedDestBranchIds, setSelectedDestBranchIds] = useState<Set<number>>(new Set());
    const [isLoadingSource, setIsLoadingSource] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (!selectedSourceUserId) {
            setSourceBranches([]);
            setSelectedSourceBranchId(null);
            setSelectedDestBranchIds(new Set());
            return;
        }

        setIsLoadingSource(true);
        void userApi.inspectUserAccess(selectedSourceUserId)
            .then((inspection) => {
                setSourceBranches(inspection?.branches ?? []);
            })
            .catch((error) => {
                console.error('Failed to inspect source user access:', error);
                toast.error('Permissions copy', 'Could not load source user access.');
                setSourceBranches([]);
            })
            .finally(() => {
                setSelectedSourceBranchId(null);
                setSelectedDestBranchIds(new Set());
                setIsLoadingSource(false);
            });
    }, [selectedSourceUserId]);

    const selectedSourceBranch = useMemo(
        () => sourceBranches.find((branch) => branch.branch_id === selectedSourceBranchId) || null,
        [selectedSourceBranchId, sourceBranches],
    );

    const toggleDestBranch = (branchId: number) => {
        setSelectedDestBranchIds((prev) => {
            const next = new Set(prev);
            if (next.has(branchId)) {
                next.delete(branchId);
            } else {
                next.add(branchId);
            }
            return next;
        });
    };

    const handleApply = async () => {
        if (!selectedSourceBranch || selectedDestBranchIds.size === 0) {
            return;
        }

        setIsApplying(true);
        try {
            onApply(
                Array.from(selectedDestBranchIds).map((branchId) => ({
                    branchId,
                    roleIds: selectedSourceBranch.role_id ? [selectedSourceBranch.role_id] : [],
                    directPermissions: selectedSourceBranch.direct_permissions,
                })),
            );
            onClose();
        } finally {
            setIsApplying(false);
        }
    };

    const canProceedStep1 = selectedSourceUserId !== null && selectedSourceBranchId !== null;
    const canApply = canProceedStep1 && selectedDestBranchIds.size > 0;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '560px' }}>
                <div className={styles.modalHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Copy size={18} />
                        <h2>Smart Copy Permissions</h2>
                    </div>
                    <KitchenButton variant="secondary" size="sm" onClick={onClose}>
                        <X size={16} />
                    </KitchenButton>
                </div>

                <div className={styles.copyModalBody}>
                    <div className={styles.copySection}>
                        <span className={styles.copySectionLabel}>1. Select Source User</span>
                        <select
                            className={styles.modalInput}
                            value={selectedSourceUserId ?? ''}
                            onChange={(event) =>
                                setSelectedSourceUserId(event.target.value ? Number(event.target.value) : null)
                            }
                        >
                            <option value="">Select a user to copy from</option>
                            {allUsers
                                .filter((user) => user.id !== destinationUserId)
                                .map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.full_name} ({user.user_name})
                                    </option>
                                ))}
                        </select>
                    </div>

                    {selectedSourceUserId && (
                        <div className={styles.copySection}>
                            <span className={styles.copySectionLabel}>2. Select Source Branch</span>
                            {isLoadingSource ? (
                                <div className={styles.copyBranchList}>
                                    <div className={styles.copyBranchItem}>
                                        <Loader2 size={14} className={styles.spin} />
                                        <span className={styles.copyBranchName}>Loading branch access...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.copyBranchList}>
                                    {sourceBranches.map((branch) => (
                                        <div
                                            key={branch.branch_id}
                                            className={`${styles.copyBranchItem} ${selectedSourceBranchId === branch.branch_id ? styles.copyBranchItemActive : ''}`}
                                            onClick={() => setSelectedSourceBranchId(branch.branch_id)}
                                        >
                                            <input type="radio" readOnly checked={selectedSourceBranchId === branch.branch_id} />
                                            <Building2 size={14} />
                                            <div>
                                                <div className={styles.copyBranchName}>
                                                    {branch.branch_name || `Branch #${branch.branch_id}`}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {branch.role_name || 'No role'} · {branch.direct_permissions.length} direct permission(s)
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!sourceBranches.length && (
                                        <div className={styles.copyBranchItem}>
                                            <span className={styles.copyBranchName}>No branch assignments found for this source user.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {canProceedStep1 && (
                        <div className={styles.copySection}>
                            <span className={styles.copySectionLabel}>3. Apply To Destination Branches</span>
                            <div className={styles.copyBranchList}>
                                {destinationBranches.map((branch) => (
                                    <div
                                        key={branch.branchId}
                                        className={`${styles.copyBranchItem} ${selectedDestBranchIds.has(branch.branchId) ? styles.copyBranchItemActive : ''}`}
                                        onClick={() => toggleDestBranch(branch.branchId)}
                                    >
                                        <input type="checkbox" readOnly checked={selectedDestBranchIds.has(branch.branchId)} />
                                        <Building2 size={14} />
                                        <span className={styles.copyBranchName}>{branch.branchName}</span>
                                        {selectedDestBranchIds.has(branch.branchId) && (
                                            <Check size={14} style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className={styles.copyNote}>
                        This copies the source branch role and direct permissions into the selected destination branches. Scope and approval authority stay under your control in the editor before saving.
                    </p>
                </div>

                <div className={styles.modalFooter}>
                    <KitchenButton variant="secondary" onClick={onClose}>
                        Cancel
                    </KitchenButton>
                    <KitchenButton onClick={handleApply} disabled={!canApply || isApplying}>
                        {isApplying ? 'Applying...' : 'Autofill & Apply'}
                    </KitchenButton>
                </div>
            </div>
        </div>
    );
}
