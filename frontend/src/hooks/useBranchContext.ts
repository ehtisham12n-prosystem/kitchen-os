import { useState, useEffect, useCallback } from 'react';
import {
    readStoredUserContext,
    resolvePrimaryBranchId,
    USER_CONTEXT_CHANGED_EVENT,
    type UserContextBranch,
} from '../auth/access';

export type AllowedBranch = UserContextBranch;

const STORAGE_KEY = 'activeBranchId';
const EVENT_NAME = 'branch_changed';
const resolveBranchIdentifier = (branch?: Pick<AllowedBranch, 'branch_id' | 'id'> | null): number => Number(branch?.branch_id ?? branch?.id ?? 0);
const getUserContext = () => readStoredUserContext();
const getBranchesFromContext = (): AllowedBranch[] => getUserContext()?.allowed_branches ?? [];
const getInitialBranch = (availableBranches: AllowedBranch[]): AllowedBranch | null => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
        const found = availableBranches.find((branch) => String(resolveBranchIdentifier(branch)) === savedId);
        if (found) return found;
    }

    const primaryId = resolvePrimaryBranchId(getUserContext());
    return availableBranches.find((branch) => resolveBranchIdentifier(branch) === Number(primaryId))
        ?? availableBranches.find((branch) => branch.is_primary)
        ?? availableBranches[0]
        ?? null;
};

/**
 * useBranchContext
 *
 * Reads allowed_branches[] from the JWT payload stored in localStorage.
 * Persists the active branch selection to localStorage so api.ts can pick it up.
 * Dispatches a CustomEvent('branch_changed') when the selection changes so
 * any component can react without a global state manager.
 */
export function useBranchContext() {
    const [branches, setBranches] = useState<AllowedBranch[]>(() => getBranchesFromContext());
    const [activeBranch, setActiveBranchState] = useState<AllowedBranch | null>(() => getInitialBranch(getBranchesFromContext()));

    useEffect(() => {
        const syncFromContext = () => {
            const nextBranches = getBranchesFromContext();
            setBranches(nextBranches);
            setActiveBranchState(getInitialBranch(nextBranches));
        };

        const handleUserContextChanged = () => syncFromContext();
        window.addEventListener(USER_CONTEXT_CHANGED_EVENT, handleUserContextChanged);
        return () => {
            window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, handleUserContextChanged);
        };
    }, []);

    useEffect(() => {
        if (activeBranch) {
            const branchIdentifier = resolveBranchIdentifier(activeBranch);
            localStorage.setItem(STORAGE_KEY, String(branchIdentifier));
            localStorage.setItem('branch_id', String(branchIdentifier));
        } else {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('branch_id');
        }
    }, [activeBranch]);

    const setActiveBranch = useCallback((branch: AllowedBranch) => {
        const branchIdentifier = resolveBranchIdentifier(branch);
        localStorage.setItem(STORAGE_KEY, String(branchIdentifier));
        localStorage.setItem('branch_id', String(branchIdentifier));
        setActiveBranchState(branch);
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: branch }));
    }, []);

    const userContext = getUserContext();

    return {
        branches,
        activeBranch,
        setActiveBranch,
        userType: userContext?.user_type ?? 'client',
        isClientAdmin: userContext?.user_type === 'client' && !userContext?.is_system,
        isSystemAdmin: userContext?.is_system === true,
    };
}
