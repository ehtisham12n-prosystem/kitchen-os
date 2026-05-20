import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { Client } from '../platform/entities/client.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { Customer } from '../customers/entities/customer.entity';
import { JwtPayload } from './payloads/jwt-payload.interface';
import { ClientGovernanceService } from '../platform/clients/client-governance.service';
import { PermissionResolverService } from './services/permission-resolver.service';
import { AuthSecurityService } from './auth-security.service';
import { getJwtSecret } from '../config/runtime-security.config';

@Injectable()
export class AuthService {
  private readonly jwtSecret = getJwtSecret();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserManagement)
    private readonly userManagementRepo: Repository<UserManagement>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly dataSource: DataSource,
    private readonly clientGovernanceService: ClientGovernanceService,
    private readonly permissionResolverService: PermissionResolverService,
    private readonly authSecurityService: AuthSecurityService,
  ) {}

  private normalizeCurrencyCode(value?: string | null, fallback = 'USD'): string {
    const normalized = String(value || fallback).trim().toUpperCase();
    return normalized || fallback;
  }

  private isBranchAvailableForAccess(branch?: { status?: string | null; is_active?: boolean | number | null } | null): boolean {
    if (!branch) {
      return false;
    }

    const status = String(branch.status || '').trim().toLowerCase();
    if (status) {
      return status === 'active';
    }

    return branch.is_active !== false && branch.is_active !== 0;
  }

  private buildUserContext(user: any): JwtPayload {
    return {
      sub: user.user_id || user.sys_userId,
      username: user.username || user.user_name || user.name,
      role: user.role,
      client_id: user.client_id,
      client_name: user.client_name,
      client_currency: user.client_currency ?? null,
      short_name: user.short_name,
      tenant_slug: user.tenant_slug ?? null,
      allowed_branches: user.allowed_branches ?? [],
      effective_permissions: user.effective_permissions ?? [],
      allowed_modules: user.allowed_modules ?? [],
      active_branch_id: user.active_branch_id,
      user_type: user.type,
      organization_user_type: user.organization_user_type,
      is_system: user.type === 'system',
      session_id: user.session_id,
      jti: user.session_id,
    };
  }

  private normalizeUserContext(payload: JwtPayload): JwtPayload {
    const normalizedBranches = (payload.allowed_branches ?? []).map((branch) => ({
      branch_id: Number(branch.branch_id),
      branch_name: branch.branch_name ?? null,
      currency_code: branch.currency_code
        ? this.normalizeCurrencyCode(branch.currency_code, payload.client_currency || 'USD')
        : null,
      effective_currency_code: this.normalizeCurrencyCode(
        branch.effective_currency_code ?? branch.currency_code ?? payload.client_currency,
        'USD',
      ),
      inherit_client_currency: false,
      date_format: branch.date_format ?? 'MMM DD, YYYY',
      time_format: branch.time_format ?? 'hh:mma',
      inventory_store_type: branch.inventory_store_type ?? 'branch',
      role_id: branch.role_id ?? null,
      role_name: branch.role_name ?? null,
      is_primary: Boolean(branch.is_primary),
      assignment_scope:
        branch.assignment_scope ??
        (branch.inventory_store_type === 'central' ? 'central' : 'branch'),
      approval_authority: branch.approval_authority ?? null,
      role_context_scope: branch.role_context_scope ?? 'hybrid',
      role_approval_authority: branch.role_approval_authority ?? null,
      effective_permissions: [...new Set(branch.effective_permissions ?? [])],
      allowed_modules: [...new Set(branch.allowed_modules ?? [])],
    }));
    const resolvedActiveBranchId =
      payload.active_branch_id ??
      normalizedBranches.find((branch) => branch.is_primary)?.branch_id ??
      normalizedBranches[0]?.branch_id;
    const activeBranch =
      normalizedBranches.find(
        (branch) => Number(branch.branch_id) === Number(resolvedActiveBranchId),
      ) ??
      normalizedBranches.find((branch) => branch.is_primary) ??
      normalizedBranches[0];

    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      client_id: payload.client_id,
      client_name: payload.client_name,
      client_currency: this.normalizeCurrencyCode(payload.client_currency, 'USD'),
      short_name: payload.short_name,
      tenant_slug: payload.tenant_slug ?? null,
      allowed_branches: normalizedBranches,
      effective_permissions: [
        ...new Set(
          activeBranch?.effective_permissions ?? payload.effective_permissions ?? [],
        ),
      ],
      allowed_modules: [
        ...new Set(activeBranch?.allowed_modules ?? payload.allowed_modules ?? []),
      ],
      active_branch_id: resolvedActiveBranchId,
      user_type: payload.user_type,
      organization_user_type: payload.organization_user_type,
      is_system: payload.is_system ?? false,
      session_id: payload.session_id ?? payload.jti,
      jti: payload.jti ?? payload.session_id,
    };
  }

  async getUserContextFromAuthHeader(
    authHeader?: string,
    activeBranchId?: number,
  ): Promise<JwtPayload> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.slice(7).trim();
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    await this.authSecurityService.ensureSessionActive(decoded.session_id ?? decoded.jti);

    const normalized = await this.refreshResolvedTokenContext(
      this.normalizeUserContext(decoded),
    );
    if (!activeBranchId) {
      return normalized;
    }

    const branchMatch = normalized.allowed_branches?.find(
      (branch) => Number(branch.branch_id) === Number(activeBranchId),
    );

    return {
      ...normalized,
      active_branch_id: activeBranchId,
      branch_id: activeBranchId,
      effective_permissions: [
        ...new Set(
          branchMatch?.effective_permissions ?? normalized.effective_permissions ?? [],
        ),
      ],
      allowed_modules: [
        ...new Set(branchMatch?.allowed_modules ?? normalized.allowed_modules ?? []),
      ],
    };
  }

  private async refreshResolvedTokenContext(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.is_system || payload.user_type !== 'client' || !payload.client_id) {
      return payload;
    }

    const branchSource =
      payload.organization_user_type === 'CLIENT_ADMIN'
        ? await this.resolveClientAdminBranches(payload)
        : payload.allowed_branches ?? [];

    const refreshedBranches = await Promise.all(
      branchSource.map(async (branch) => {
        const { permissions, allowedModules } =
          await this.permissionResolverService.resolve(
            Number(payload.sub),
            Number(branch.branch_id),
            payload.client_id!,
          );

        return {
          ...branch,
          effective_permissions: Array.from(permissions).sort(),
          allowed_modules: [...new Set(allowedModules)].sort(),
          effective_currency_code: this.normalizeCurrencyCode(
            branch.effective_currency_code ?? branch.currency_code ?? payload.client_currency,
            'USD',
          ),
          inherit_client_currency: false,
          date_format: branch.date_format ?? 'MMM DD, YYYY',
          time_format: branch.time_format ?? 'hh:mma',
        };
      }),
    );

    const resolvedActiveBranchId =
      payload.active_branch_id ??
      refreshedBranches.find((branch) => branch.is_primary)?.branch_id ??
      refreshedBranches[0]?.branch_id;
    const activeBranch =
      refreshedBranches.find(
        (branch) => Number(branch.branch_id) === Number(resolvedActiveBranchId),
      ) ??
      refreshedBranches.find((branch) => branch.is_primary) ??
      refreshedBranches[0];
    const tenantWideFallback =
      refreshedBranches.length === 0 &&
      payload.organization_user_type === 'CLIENT_ADMIN'
        ? await this.permissionResolverService.resolve(
            Number(payload.sub),
            undefined,
            payload.client_id,
          )
        : null;

    const effectivePermissions: string[] =
      activeBranch?.effective_permissions ??
      (tenantWideFallback
        ? Array.from(tenantWideFallback.permissions).sort()
        : payload.effective_permissions ?? []);
    const allowedModules: string[] =
      activeBranch?.allowed_modules ??
      tenantWideFallback?.allowedModules ??
      payload.allowed_modules ??
      [];

    return {
      ...payload,
      allowed_branches: refreshedBranches,
      active_branch_id: resolvedActiveBranchId,
      effective_permissions: [...new Set(effectivePermissions)],
      allowed_modules: [...new Set(allowedModules)],
    };
  }

  private async resolveClientAdminBranches(payload: JwtPayload) {
    const client = await this.clientRepo.findOne({
      where: { client_code: payload.client_id },
      relations: ['branches'],
    });

    const clientBranches = (client?.branches ?? [])
      .filter(
        (branch) =>
          branch.client_id === payload.client_id &&
          this.isBranchAvailableForAccess(branch),
      )
      .sort((left, right) => left.id - right.id);

    if (clientBranches.length === 0) {
      return payload.allowed_branches ?? [];
    }

    const existingByBranchId = new Map(
      (payload.allowed_branches ?? []).map((branch) => [Number(branch.branch_id), branch]),
    );
    const explicitPrimary =
      payload.active_branch_id ??
      (payload.allowed_branches ?? []).find((branch) => branch.is_primary)?.branch_id ??
      clientBranches.find((branch) => branch.branch_code === 'MAIN-01')?.id ??
      clientBranches[0]?.id;

    return clientBranches.map((branch) => {
      const existing = existingByBranchId.get(Number(branch.id));
      return {
        branch_id: branch.id,
        branch_name: branch.branch_name,
        currency_code: branch.currency_code
          ? this.normalizeCurrencyCode(branch.currency_code, payload.client_currency || 'USD')
          : null,
        effective_currency_code: this.normalizeCurrencyCode(
          branch.currency_code || payload.client_currency,
          'USD',
        ),
        inherit_client_currency: false,
        date_format: branch.date_format ?? 'MMM DD, YYYY',
        time_format: branch.time_format ?? 'hh:mma',
        inventory_store_type: branch.inventory_store_type ?? 'branch',
        role_id: existing?.role_id ?? null,
        role_name: existing?.role_name ?? payload.role ?? 'Administrator',
        is_primary: Number(branch.id) === Number(explicitPrimary),
        assignment_scope: existing?.assignment_scope ?? 'central',
        approval_authority: existing?.approval_authority ?? 'both',
        role_context_scope: existing?.role_context_scope ?? 'central',
        role_approval_authority: existing?.role_approval_authority ?? 'both',
        effective_permissions: existing?.effective_permissions ?? [],
        allowed_modules: existing?.allowed_modules ?? [],
      };
    });
  }

  private async attachResolvedPermissions(user: any): Promise<any> {
    if (!user?.user_id || !user?.client_id || user.type !== 'client') {
      return user;
    }

    const resolvedBranches = await Promise.all(
      (user.allowed_branches ?? []).map(async (branch: any) => {
        const { permissions, allowedModules } =
          await this.permissionResolverService.resolve(
            Number(user.user_id),
            Number(branch.branch_id),
            user.client_id,
          );

        return {
          ...branch,
          effective_permissions: Array.from(permissions).sort(),
          allowed_modules: [...new Set(allowedModules)].sort(),
        };
      }),
    );

    const primaryBranch =
      resolvedBranches.find((branch) => branch.is_primary) ?? resolvedBranches[0];
    const tenantWideFallback =
      resolvedBranches.length === 0 &&
      user.organization_user_type === 'CLIENT_ADMIN'
        ? await this.permissionResolverService.resolve(
            Number(user.user_id),
            undefined,
            user.client_id,
          )
        : null;

    return {
      ...user,
      allowed_branches: resolvedBranches,
      active_branch_id: primaryBranch?.branch_id,
      effective_permissions:
        primaryBranch?.effective_permissions ??
        (tenantWideFallback ? Array.from(tenantWideFallback.permissions).sort() : []),
      allowed_modules:
        primaryBranch?.allowed_modules ??
        tenantWideFallback?.allowedModules ??
        [],
    };
  }

  private getRequestIp(request?: Request | null): string | null {
    const forwardedFor = request?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0]?.trim() || null;
    }

    const realIp = request?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }

    return request?.ip || null;
  }

  private async registerFailedUserAttempt(user: UserManagement) {
    const nextAttempts = Number(user.failed_login_attempts || 0) + 1;
    const limit = Math.max(Number(user.wrong_attempts_limit || 5), 1);
    const shouldLock = nextAttempts >= limit;

    await this.userManagementRepo.update(
      { id: user.id },
      {
        failed_login_attempts: nextAttempts,
        is_locked: shouldLock ? true : user.is_locked,
        locked_at: shouldLock ? new Date() : user.locked_at ?? null,
      },
    );

    return { nextAttempts, limit, shouldLock };
  }

  private async registerSuccessfulUserLogin(
    userId: number,
    request?: Request | null,
  ) {
    await this.userManagementRepo.update(
      { id: userId },
      {
        failed_login_attempts: 0,
        is_locked: false,
        locked_at: null,
        last_login: new Date(),
        last_login_ip: this.getRequestIp(request),
      },
    );
  }

  private resolvePortal(
    userType?: string,
  ): 'Nexus' | 'Console' | 'Terminal' | 'Public' {
    if (userType === 'system') {
      return 'Nexus';
    }

    if (userType === 'customer') {
      return 'Public';
    }

    return 'Console';
  }

  async validateSystemUser(
    user_name: string,
    pass: string,
    request?: Request,
  ): Promise<any> {
    const user = await this.userManagementRepo.findOne({
      where: { user_name, user_type: 'PLATFORM_ADMIN' },
    });

    if (!user) {
      await this.authSecurityService.logAuthAttempt({
        userId: user_name,
        userType: 'system',
        status: 'failure',
        request,
        failureReason: 'Unknown platform username',
      });
      return null;
    }

    if (user.status !== 'active') {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'system',
        status: 'failure',
        request,
        failureReason: 'Platform account suspended',
      });
      throw new UnauthorizedException('Account suspended');
    }

    if (user.is_locked) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'system',
        status: 'failure',
        request,
        failureReason: 'Platform account locked',
      });
      throw new UnauthorizedException('Account locked. Contact an administrator.');
    }

    if (!user.is_active) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'system',
        status: 'failure',
        request,
        failureReason: 'Platform account inactive',
      });
      throw new UnauthorizedException('User account inactive');
    }

    if (await bcrypt.compare(pass, user.password_hash)) {
      return {
        sys_userId: user.id,
        user_name: user.user_name,
        role: user.role_id,
        client_id: user.client_id || 'NX-10101',
        type: 'system',
        user_entity_id: user.id,
      };
    }

    const failedAttempt = await this.registerFailedUserAttempt(user);
    await this.authSecurityService.logAuthAttempt({
      userId: user.id.toString(),
      userType: 'system',
      status: 'failure',
      request,
      failureReason: failedAttempt.shouldLock
        ? `Platform account locked after ${failedAttempt.limit} failed attempts`
        : 'Invalid platform password',
    });
    return null;
  }

  async validateClientUser(
    username: string,
    pass: string,
    tenantSlug?: string,
    request?: Request,
  ): Promise<any> {
    const user = await this.userManagementRepo.findOne({
      where: { user_name: username, user_type: Not('PLATFORM_ADMIN') },
      relations: [
        'roleEntity',
        'client',
        'client.branches',
        'branchRoles',
        'branchRoles.branch',
        'branchRoles.roleEntity',
      ],
    });

    if (!user) {
      await this.authSecurityService.logAuthAttempt({
        userId: username,
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Unknown client username',
      });
      return null;
    }

    if (user.is_locked) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Client account locked',
      });
      throw new UnauthorizedException('User account locked. Contact an administrator.');
    }

    if (user.status !== 'active') {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Client user account inactive',
      });
      throw new UnauthorizedException('User account inactive');
    }

    if (!user.is_active) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Client user marked inactive',
      });
      throw new UnauthorizedException('User account inactive');
    }

    if (!(await bcrypt.compare(pass, user.password_hash))) {
      const failedAttempt = await this.registerFailedUserAttempt(user);
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: failedAttempt.shouldLock
          ? `Client account locked after ${failedAttempt.limit} failed attempts`
          : 'Invalid client password',
      });
      return null;
    }

    if (tenantSlug && user.client?.domain_slug !== tenantSlug) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Tenant slug mismatch',
      });
      throw new UnauthorizedException('Access denied for this organization');
    }

    const client = user.client;
    if (!client || client.status !== 'active') {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Client account inactive',
      });
      throw new UnauthorizedException('Client account inactive');
    }

    const governanceDecision = this.clientGovernanceService.evaluateLoginAccess(client);
    if (!governanceDecision.allow) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: governanceDecision.message || 'Client blocked by governance',
      });
      throw new UnauthorizedException(
        governanceDecision.message ||
          'Client account is blocked by platform governance',
      );
    }

    let allowed_branches = (user.branchRoles ?? [])
      .filter((ubr) => {
        const sameClient = ubr.branch?.client_id === user.client_id;
        return sameClient && this.isBranchAvailableForAccess(ubr.branch);
      })
      .map((ubr) => ({
        branch_id: ubr.branch_id,
        branch_name: ubr.branch?.branch_name ?? null,
        currency_code: ubr.branch?.currency_code
          ? this.normalizeCurrencyCode(ubr.branch.currency_code, client.currency || 'USD')
          : null,
        effective_currency_code: this.normalizeCurrencyCode(
          ubr.branch?.currency_code ?? client.currency,
          'USD',
        ),
        inherit_client_currency: false,
        date_format: ubr.branch?.date_format ?? 'MMM DD, YYYY',
        time_format: ubr.branch?.time_format ?? 'hh:mma',
        inventory_store_type: ubr.branch?.inventory_store_type ?? 'branch',
        role_id: ubr.role_id ?? user.role_id ?? null,
        role_name: ubr.roleEntity?.role_name ?? user.roleEntity?.role_name ?? null,
        is_primary: ubr.is_primary,
        assignment_scope:
          ubr.assignment_scope ??
          (ubr.branch?.inventory_store_type === 'central' ? 'central' : 'branch'),
        approval_authority:
          ubr.approval_authority ??
          ubr.roleEntity?.approval_authority ??
          user.roleEntity?.approval_authority ??
          null,
        role_context_scope:
          ubr.roleEntity?.context_scope ?? user.roleEntity?.context_scope ?? 'hybrid',
        role_approval_authority:
          ubr.roleEntity?.approval_authority ??
          user.roleEntity?.approval_authority ??
          null,
      }));

    if (
      (user.branchRoles ?? []).some(
        (ubr) => ubr.branch && ubr.branch.client_id !== user.client_id,
      )
    ) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'Tenant isolation validation failed',
      });
      throw new UnauthorizedException(
        'User branch assignments failed tenant isolation validation',
      );
    }

    if (user.user_type === 'CLIENT_ADMIN' && client?.branches) {
      const assignedByBranchId = new Map(
        allowed_branches.map((assignment) => [assignment.branch_id, assignment]),
      );
      const explicitPrimary =
        allowed_branches.find((assignment) => assignment.is_primary)?.branch_id ??
        client.branches.find((branch) => branch.branch_code === 'MAIN-01')?.id ??
        client.branches[0]?.id;

      allowed_branches = client.branches
        .filter(
          (branch) =>
            branch.client_id === user.client_id &&
            this.isBranchAvailableForAccess(branch),
        )
        .map((branch) => {
          const assigned = assignedByBranchId.get(branch.id);
          return {
            branch_id: branch.id,
            branch_name: branch.branch_name,
            currency_code: branch.currency_code
              ? this.normalizeCurrencyCode(branch.currency_code, client.currency || 'USD')
              : null,
            effective_currency_code: this.normalizeCurrencyCode(
              branch.currency_code || client.currency,
              'USD',
            ),
            inherit_client_currency: false,
            date_format: branch.date_format ?? 'MMM DD, YYYY',
            time_format: branch.time_format ?? 'hh:mma',
            inventory_store_type: branch.inventory_store_type ?? 'branch',
            role_id: assigned?.role_id ?? user.role_id,
            role_name:
              assigned?.role_name ?? user.roleEntity?.role_name ?? 'Administrator',
            is_primary: branch.id === explicitPrimary,
            assignment_scope: 'central',
            approval_authority: 'both',
            role_context_scope: user.roleEntity?.context_scope ?? 'central',
            role_approval_authority:
              user.roleEntity?.approval_authority ?? 'both',
          };
        });
    }

    allowed_branches = allowed_branches.filter(
      (assignment, index, all) =>
        all.findIndex(
          (candidate) => Number(candidate.branch_id) === Number(assignment.branch_id),
        ) === index,
    );

    if (user.user_type !== 'CLIENT_ADMIN' && allowed_branches.length === 0) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'client',
        status: 'failure',
        request,
        tenantSlug,
        failureReason: 'No branch assignment configured',
      });
      throw new UnauthorizedException('No branch assignment configured for this user');
    }

    return {
      user_id: user.id,
      username: user.user_name,
      role: user.roleEntity?.role_name || 'User',
      client_id: user.client_id,
      client_name: client.client_name,
      client_currency: this.normalizeCurrencyCode(client.currency, 'USD'),
      short_name: client.short_name,
      allowed_branches,
      type: 'client',
      organization_user_type: user.user_type,
      user_entity_id: user.id,
      tenant_slug: tenantSlug ?? client.domain_slug ?? null,
    };
  }

  async validateCustomerUser(
    identifier: string,
    pass: string,
    request?: Request,
  ): Promise<any> {
    const user = await this.customerRepo.findOne({
      where: [{ email: identifier }, { phone_number: identifier }],
    });

    if (!user) {
      await this.authSecurityService.logAuthAttempt({
        userId: identifier,
        userType: 'customer',
        status: 'failure',
        request,
        failureReason: 'Unknown customer identifier',
      });
      return null;
    }

    if (!user.password_hash || !(await bcrypt.compare(pass, user.password_hash))) {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'customer',
        status: 'failure',
        request,
        failureReason: 'Invalid customer password',
      });
      return null;
    }

    if (user.status !== 'active') {
      await this.authSecurityService.logAuthAttempt({
        userId: user.id.toString(),
        userType: 'customer',
        status: 'failure',
        request,
        failureReason: 'Customer account suspended',
      });
      throw new UnauthorizedException('Customer account suspended');
    }

    return {
      user_id: user.id,
      name: user.name,
      client_id: user.client_id,
      type: 'customer',
      user_entity_id: user.id,
    };
  }

  async login(user: any, request?: Request, tenantSlug?: string) {
    const resolvedUser = await this.attachResolvedPermissions(user);
    const payload = this.buildUserContext(resolvedUser);
    const session = await this.authSecurityService.createSession({
      userId: String(payload.sub),
      username: payload.username ?? null,
      userType: (payload.user_type ?? 'client') as 'system' | 'client' | 'customer',
      clientId: payload.client_id ?? null,
      branchId: payload.active_branch_id ?? null,
      tenantSlug: tenantSlug ?? resolvedUser.tenant_slug ?? null,
      portal: this.resolvePortal(payload.user_type),
      request,
    });

    if (
      resolvedUser.user_entity_id &&
      (payload.user_type === 'system' || payload.user_type === 'client')
    ) {
      await this.registerSuccessfulUserLogin(
        Number(resolvedUser.user_entity_id),
        request,
      );
    }

    await this.authSecurityService.logAuthAttempt({
      userId: String(payload.sub),
      userType: (payload.user_type ?? 'client') as 'system' | 'client' | 'customer',
      status: 'success',
      request,
      tenantSlug: tenantSlug ?? resolvedUser.tenant_slug ?? null,
      sessionId: session.session_id,
    });

    const sessionBoundPayload: JwtPayload = {
      ...payload,
      session_id: session.session_id,
      jti: session.session_id,
    };

    return {
      access_token: this.jwtService.sign(sessionBoundPayload),
      user_context: sessionBoundPayload,
      session: {
        session_id: session.session_id,
        status: session.status,
        expires_at: session.expires_at,
        device_label: session.device_label,
        portal: session.portal,
      },
    };
  }

  async logout(user: JwtPayload & { session_id?: string; jti?: string }) {
    await this.authSecurityService.revokeSession(
      user.session_id ?? user.jti ?? null,
      'User logout',
    );

    return { success: true };
  }
}
