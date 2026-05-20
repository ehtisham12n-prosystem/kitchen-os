import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    FEATURE_ENTITLEMENT_KEY,
    type FeatureEntitlementMetadata,
} from '../decorators/feature-entitlement.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionResolverService } from '../services/permission-resolver.service';
import { EntitlementsService } from '../../platform/entitlements/entitlements.service';

/**
 * SubscriptionGuard
 *
 * Replacement for the old PermissionsGuard. Adds two layers on top:
 *   1. Resolves merged permissions (role + direct) via PermissionResolverService.
 *   2. Enforces subscription-level module filtering (strips perms for unsubscribed modules).
 *
 * Routes with no @RequirePermissions decorator pass through automatically.
 * System / platform admins bypass all checks.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private permissionResolver: PermissionResolverService,
        private entitlementsService: EntitlementsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredFeature = this.reflector.getAllAndOverride<FeatureEntitlementMetadata | undefined>(
            FEATURE_ENTITLEMENT_KEY,
            [context.getHandler(), context.getClass()],
        );

        // No @RequirePermissions on this route — allow through
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('Unauthenticated');
        }

        // Platform admins bypass all permission checks
        if (user.is_system || user.role === 'platform.all') {
            return true;
        }

        if (requiredFeature?.featureKey && user.client_id) {
            await this.entitlementsService.assertFeatureEnabled(
                user.client_id,
                requiredFeature.featureKey,
                requiredFeature.action || requiredFeature.featureKey,
            );
        }

        // Determine active branch — prefer the header-resolved branch, fall back to first allowed
        const activeBranchId: number | undefined =
            request.activeBranchId ??
            (user.allowed_branches?.[0]?.branch_id as number | undefined);

        const canUseTenantWideRoleScope = !activeBranchId && user.organization_user_type === 'CLIENT_ADMIN';
        if (!activeBranchId && !canUseTenantWideRoleScope) {
            throw new ForbiddenException('No active branch context. Send x-branch-id header.');
        }

        // Resolve effective permissions for this user + branch, filtered by subscription.
        // Client admins are allowed to operate on tenant-wide setup routes before the first branch exists.
        const { permissions, allowedModules } = await this.permissionResolver.resolve(
            Number(user.sub),
            activeBranchId,
            user.client_id!,
        );

        const effectivePermissions = Array.from(permissions).sort();
        request.effectivePermissions = effectivePermissions;
        request.allowedModules = allowedModules;
        request.activeBranchId = activeBranchId;
        user.active_branch_id = activeBranchId;
        user.branch_id = activeBranchId;
        user.effective_permissions = effectivePermissions;
        user.allowed_modules = allowedModules;

        // Check if user has ALL required permissions
        const hasAll = requiredPermissions.every(
            (perm) => permissions.has(perm) || permissions.has('all'),
        );

        if (!hasAll) {
            const missing = requiredPermissions.filter(
                (p) => !permissions.has(p) && !permissions.has('all'),
            );
            throw new ForbiddenException(
                `Missing permission(s): ${missing.join(', ')}`,
            );
        }

        return true;
    }
}
