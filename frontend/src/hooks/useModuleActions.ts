import { usePermissionAccess } from './usePermissionAccess';

export function useModuleActions(
    moduleKey: string,
    scope: 'company' | 'branch' | 'own' = 'branch',
    branchId?: number | string | null,
) {
    const access = usePermissionAccess();
    return access.getModuleActions(moduleKey, scope, branchId);
}
