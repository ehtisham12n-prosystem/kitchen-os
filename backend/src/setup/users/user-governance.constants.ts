export const USER_BRANCH_ASSIGNMENT_SCOPES = ['branch', 'central'] as const;
export type UserBranchAssignmentScope = (typeof USER_BRANCH_ASSIGNMENT_SCOPES)[number];

export const USER_APPROVAL_AUTHORITIES = ['none', 'branch', 'central', 'both'] as const;
export type UserApprovalAuthority = (typeof USER_APPROVAL_AUTHORITIES)[number];

export const ROLE_CONTEXT_SCOPES = ['branch', 'central', 'hybrid'] as const;
export type RoleContextScope = (typeof ROLE_CONTEXT_SCOPES)[number];
