import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * BranchAccessGuard
 *
 * Reads the `x-branch-id` request header and validates it against the
 * user's `allowed_branches` array (populated from the JWT by JwtStrategy).
 *
 * - No database hit — works purely off the JWT payload (fast path).
 * - If a route does NOT send `x-branch-id`, the guard is a no-op (passes through).
 * - Attaches `req.activeBranchId` for downstream guards and services to use.
 */
@Injectable()
export class BranchAccessGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Skip for unauthenticated or system (platform admin) users
        if (!user || user.is_system) {
            return true;
        }

        const allowedBranches: Array<{ branch_id: number }> = user.allowed_branches ?? [];
        const allowedBranchIds = allowedBranches.map((branch) => Number(branch.branch_id));

        const parseCandidate = (value: unknown, source: string): number | undefined => {
            if (value === undefined || value === null || value === '') {
                return undefined;
            }

            const parsed = Number(value);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new BadRequestException(`Invalid branch context from ${source}`);
            }

            return parsed;
        };

        const routePath = `${request.baseUrl ?? ''}${request.route?.path ?? ''}`;
        const body = request.body ?? {};
        const query = request.query ?? {};
        const params = request.params ?? {};

        const branchCandidates = [
            { value: request.headers['x-branch-id'], source: 'x-branch-id header' },
            { value: params.branchId, source: 'branchId param' },
            { value: params.branch_id, source: 'branch_id param' },
            {
                value: routePath.startsWith('/v1/setup/branches/') ? params.id : undefined,
                source: 'branch route id param',
            },
            { value: query.branchId, source: 'branchId query' },
            { value: query.branch_id, source: 'branch_id query' },
            { value: body.branchId, source: 'branchId body' },
            { value: body.branch_id, source: 'branch_id body' },
        ]
            .map((candidate) => ({
                branchId: parseCandidate(candidate.value, candidate.source),
                source: candidate.source,
            }))
            .filter((candidate): candidate is { branchId: number; source: string } => candidate.branchId !== undefined);

        if (branchCandidates.length === 0) {
            if (allowedBranchIds.length === 1) {
                request.activeBranchId = allowedBranchIds[0];
                user.branch_id = allowedBranchIds[0];
                user.active_branch_id = allowedBranchIds[0];
            }
            return true;
        }

        const requestedBranchId = branchCandidates[0].branchId;
        const mismatched = branchCandidates.find((candidate) => candidate.branchId !== requestedBranchId);
        if (mismatched) {
            throw new BadRequestException('Branch context does not match the active branch');
        }

        if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(requestedBranchId)) {
            throw new ForbiddenException(
                `You do not have access to branch #${requestedBranchId}`,
            );
        }

        // Attach to request for downstream use (guards, services, decorators)
        request.activeBranchId = requestedBranchId;
        user.branch_id = requestedBranchId; // Support legacy UserManagement.branch_id checks
        user.active_branch_id = requestedBranchId;
        return true;
    }
}
