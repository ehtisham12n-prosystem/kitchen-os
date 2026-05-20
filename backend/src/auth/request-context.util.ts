import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from './payloads/jwt-payload.interface';
import { normalizeClientIdentifier } from '../platform/client-lookup.util';

function parseBranchValue(branchId?: number | string | null): number | undefined {
  if (branchId === undefined || branchId === null || branchId === '') {
    return undefined;
  }

  const parsed = Number(branchId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException('Invalid branch context');
  }

  return parsed;
}

export function getAccessibleBranchIds(user?: JwtPayload): number[] {
  if (user?.is_system) {
    return [];
  }

  const ids = (user?.allowed_branches ?? [])
    .map((branch) => parseBranchValue(branch.branch_id))
    .filter((branchId): branchId is number => branchId !== undefined);

  return [...new Set(ids)];
}

export function getAllowedBranchEntry(
  user: JwtPayload | undefined,
  branchId: number,
): NonNullable<JwtPayload['allowed_branches']>[number] | undefined {
  return (user?.allowed_branches ?? []).find(
    (branch) => Number(branch.branch_id) === Number(branchId),
  );
}

export function hasExplicitApprovalAuthorityConfig(user?: JwtPayload): boolean {
  return (user?.allowed_branches ?? []).some((branch) => branch.approval_authority !== undefined);
}

export function hasBranchApprovalAuthority(
  user: JwtPayload | undefined,
  branchId: number,
): boolean {
  if (!user || user.is_system || user.organization_user_type === 'CLIENT_ADMIN') {
    return true;
  }

  const branch = getAllowedBranchEntry(user, branchId);
  if (!branch) {
    return false;
  }

  if (branch.approval_authority === undefined) {
    return false;
  }

  return ['branch', 'both'].includes(branch.approval_authority ?? '');
}

export function hasCentralApprovalAuthority(user?: JwtPayload): boolean {
  if (!user || user.is_system || user.organization_user_type === 'CLIENT_ADMIN') {
    return true;
  }

  return (user.allowed_branches ?? []).some((branch) =>
    ['central', 'both'].includes(branch.approval_authority ?? '')
    && (branch.assignment_scope === 'central' || branch.inventory_store_type === 'central'),
  );
}

export function assertBranchAccessible(
  user: JwtPayload | undefined,
  branchId: number,
): number {
  const accessibleBranchIds = getAccessibleBranchIds(user);
  if (accessibleBranchIds.length > 0 && !accessibleBranchIds.includes(branchId)) {
    throw new ForbiddenException(`You do not have access to branch #${branchId}`);
  }

  if (user) {
    user.branch_id = branchId;
    user.active_branch_id = branchId;
  }

  return branchId;
}

export function requireClientId(user?: JwtPayload): string {
  if (!user?.client_id) {
    throw new ForbiddenException('Missing tenant context');
  }

  const normalized = normalizeClientIdentifier(user.client_id);
  user.client_id = normalized;
  return normalized;
}

export function getOptionalBranchId(
  user?: JwtPayload,
  explicitBranchId?: number | string | null,
): number | undefined {
  const branchId = parseBranchValue(
    explicitBranchId ?? user?.active_branch_id ?? user?.branch_id,
  );

  if (!branchId) {
    return undefined;
  }

  return assertBranchAccessible(user, branchId);
}

export function requireBranchId(
  user?: JwtPayload,
  explicitBranchId?: number | string | null,
): number {
  const branchId = getOptionalBranchId(user, explicitBranchId);
  if (!branchId) {
    throw new BadRequestException('Branch context is required for this operation');
  }

  return branchId;
}

export function requireActiveBranchMatch(
  user: JwtPayload,
  explicitBranchId?: number | string | null,
): number {
  const branchId = requireBranchId(user, explicitBranchId);
  const activeBranchId = parseBranchValue(user?.active_branch_id ?? user?.branch_id);

  if (activeBranchId && activeBranchId !== branchId) {
    throw new BadRequestException('Branch context does not match the active branch');
  }

  return branchId;
}

export function resolveActorId(user?: JwtPayload): string | undefined {
  const raw = (user as JwtPayload & { userId?: string | number })?.userId ?? user?.sub;
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  return String(raw);
}
