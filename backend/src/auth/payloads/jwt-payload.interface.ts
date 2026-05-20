export interface AllowedBranch {
  branch_id: number;
  branch_name: string | null;
  currency_code?: string | null;
  effective_currency_code?: string | null;
  inherit_client_currency?: boolean;
  date_format?: string | null;
  time_format?: string | null;
  inventory_store_type?: 'branch' | 'central';
  role_id: number | null;
  role_name: string | null;
  is_primary: boolean;
  assignment_scope?: 'branch' | 'central';
  approval_authority?: 'none' | 'branch' | 'central' | 'both' | null;
  role_context_scope?: 'branch' | 'central' | 'hybrid';
  role_approval_authority?: 'none' | 'branch' | 'central' | 'both' | null;
  effective_permissions?: string[];
  allowed_modules?: string[];
}

export interface JwtPayload {
  sub: string | number;         // User ID
  userId?: string | number;     // Normalized request user id
  username?: string;            // Login username or display name
  email?: string;               // User email (optional, not always set)
  client_id?: string;           // Client context (NX- / CL-)
  client_name?: string;         // Client legal name (if applicable)
  client_currency?: string | null;
  short_name?: string;          // Client short name / brand name
  tenant_slug?: string | null;
  role?: string | number;       // Legacy top-level role name or role id
  allowed_branches?: AllowedBranch[]; // Contract-based branch access
  effective_permissions?: string[];
  allowed_modules?: string[];
  branch_id?: number;           // Work-current branch (injected by Guard)
  active_branch_id?: number;    // Normalized active branch context
  user_type?: string;           // 'system' | 'client' | 'customer'
  organization_user_type?: string;
  is_system?: boolean;
  session_id?: string;
  jti?: string;
}
