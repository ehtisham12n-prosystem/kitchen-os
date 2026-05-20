import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createSubject = () => {
    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-jwt'),
      verify: jest.fn(),
    };
    const userManagementRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    const clientRepo = {
      findOne: jest.fn(),
    };
    const customerRepo = {
      findOne: jest.fn(),
    };
    const dataSource = {
      driver: { database: 'kitchenos_test' },
      createQueryBuilder: jest.fn(),
    };
    const clientGovernanceService = {
      evaluateLoginAccess: jest.fn().mockReturnValue({
        allow: true,
        mode: 'full',
        state: 'normal',
        message: null,
      }),
    };
    const permissionResolverService = {
      resolve: jest.fn(),
    };
    const authSecurityService = {
      createSession: jest.fn(),
      logAuthAttempt: jest.fn(),
      ensureSessionActive: jest.fn(),
      revokeSession: jest.fn(),
    };

    const service = new AuthService(
      jwtService as any,
      userManagementRepo as any,
      clientRepo as any,
      customerRepo as any,
      dataSource as any,
      clientGovernanceService as any,
      permissionResolverService as any,
      authSecurityService as any,
    );

    return {
      service,
      jwtService,
      userManagementRepo,
      clientRepo,
      permissionResolverService,
      clientGovernanceService,
      authSecurityService,
    };
  };

  const activeClientUser = async () => ({
    id: 42,
    user_name: 'branch.manager',
    password_hash: await bcrypt.hash('secret', 4),
    status: 'active',
    is_active: true,
    is_locked: false,
    user_type: 'BRANCH_STAFF',
    client_id: 'CL-10001',
    role_id: 7,
    roleEntity: {
      role_name: 'Branch Manager',
      context_scope: 'branch',
      approval_authority: 'branch',
    },
    client: {
      id: 'CL-10001',
      client_name: 'Kitchen Club',
      short_name: 'Kitchen Club',
      domain_slug: 'kitchen-club',
      status: 'active',
      governance_state: 'normal',
      branches: [
        { id: 5, branch_code: 'MAIN-01', branch_name: 'Main Branch', client_id: 'CL-10001' },
      ],
    },
    branchRoles: [
      {
        branch_id: 5,
        is_primary: true,
        assignment_scope: 'branch',
        approval_authority: 'branch',
        role_id: 7,
        roleEntity: {
          role_name: 'Branch Manager',
          context_scope: 'branch',
          approval_authority: 'branch',
        },
        branch: {
          id: 5,
          branch_name: 'Main Branch',
          client_id: 'CL-10001',
          inventory_store_type: 'branch',
          is_active: true,
          status: 'active',
        },
      },
      {
        branch_id: 6,
        is_primary: false,
        assignment_scope: 'branch',
        approval_authority: 'branch',
        role_id: 7,
        roleEntity: {
          role_name: 'Branch Manager',
          context_scope: 'branch',
          approval_authority: 'branch',
        },
        branch: {
          id: 6,
          branch_name: 'Suspended Branch',
          client_id: 'CL-10001',
          inventory_store_type: 'branch',
          is_active: true,
          status: 'suspended',
        },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates an active client user and resolves branch-scoped access', async () => {
    const {
      service,
      userManagementRepo,
      clientGovernanceService,
      authSecurityService,
    } = createSubject();
    userManagementRepo.findOne.mockResolvedValue(await activeClientUser());

    const result = await service.validateClientUser(
      'branch.manager',
      'secret',
      'kitchen-club',
    );

    expect(result).toEqual(
      expect.objectContaining({
        user_id: 42,
        username: 'branch.manager',
        client_id: 'CL-10001',
        client_name: 'Kitchen Club',
        short_name: 'Kitchen Club',
        tenant_slug: 'kitchen-club',
        organization_user_type: 'BRANCH_STAFF',
      }),
    );
    expect(result.allowed_branches).toEqual([
      expect.objectContaining({
        branch_id: 5,
        branch_name: 'Main Branch',
        is_primary: true,
        role_name: 'Branch Manager',
      }),
    ]);
    expect(clientGovernanceService.evaluateLoginAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'CL-10001' }),
    );
    expect(authSecurityService.logAuthAttempt).not.toHaveBeenCalled();
  });

  it('blocks client login when the tenant slug does not match', async () => {
    const { service, userManagementRepo, authSecurityService } = createSubject();
    userManagementRepo.findOne.mockResolvedValue(await activeClientUser());

    await expect(
      service.validateClientUser('branch.manager', 'secret', 'other-tenant'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authSecurityService.logAuthAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '42',
        userType: 'client',
        status: 'failure',
        tenantSlug: 'other-tenant',
        failureReason: 'Tenant slug mismatch',
      }),
    );
  });

  it('creates a session-bound login response for a resolved client user', async () => {
    const { service, jwtService, authSecurityService } = createSubject();
    const resolvedUser = {
      user_id: 42,
      username: 'kitchenclub.admin',
      role: 'Client Admin',
      client_id: 'CL-10001',
      client_name: 'Kitchen Club',
      short_name: 'Kitchen Club',
      allowed_branches: [
        {
          branch_id: 5,
          branch_name: 'Main Branch',
          role_id: 7,
          role_name: 'Branch Manager',
          is_primary: true,
          assignment_scope: 'central',
          approval_authority: 'both',
          role_context_scope: 'central',
          role_approval_authority: 'both',
          effective_permissions: ['catalog.read'],
          allowed_modules: ['catalog', 'pos'],
        },
      ],
      effective_permissions: ['catalog.read'],
      allowed_modules: ['catalog', 'pos'],
      active_branch_id: 5,
      type: 'client',
      organization_user_type: 'CLIENT_ADMIN',
      user_entity_id: 42,
      tenant_slug: 'kitchen-club',
    };

    jest.spyOn(service as any, 'attachResolvedPermissions').mockResolvedValue(resolvedUser);
    jest.spyOn(service as any, 'registerSuccessfulUserLogin').mockResolvedValue(undefined);
    authSecurityService.createSession.mockResolvedValue({
      session_id: 'sess-001',
      status: 'active',
      expires_at: '2026-03-28T00:00:00.000Z',
      device_label: 'Chrome on Windows',
      portal: 'Console',
    });

    const result = await service.login({ user_id: 42 }, { headers: {} } as any, 'kitchen-club');

    expect(authSecurityService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '42',
        clientId: 'CL-10001',
        branchId: 5,
        tenantSlug: 'kitchen-club',
        userType: 'client',
      }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 42,
        client_id: 'CL-10001',
        active_branch_id: 5,
        session_id: 'sess-001',
        jti: 'sess-001',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        access_token: 'signed-jwt',
        session: expect.objectContaining({
          session_id: 'sess-001',
          status: 'active',
          portal: 'Console',
        }),
      }),
    );
  });

  it('preserves tenant-wide entitlements for client admins without branches', async () => {
    const {
      service,
      authSecurityService,
    } = createSubject();

    const resolvedUser = {
      user_id: 42,
      username: 'bonfireadmin',
      role: 'Client Admin',
      client_id: 'CL-80517',
      client_name: 'Bonfire Grill & Services',
      short_name: 'BonfireGS',
      allowed_branches: [],
      type: 'client',
      organization_user_type: 'CLIENT_ADMIN',
      user_entity_id: 42,
      tenant_slug: 'bonfiregs',
    };

    jest.spyOn(service as any, 'attachResolvedPermissions').mockResolvedValue({
      ...resolvedUser,
      effective_permissions: ['catalog.read', 'branch.read'],
      allowed_modules: ['catalog', 'auth'],
      active_branch_id: undefined,
    });
    jest.spyOn(service as any, 'registerSuccessfulUserLogin').mockResolvedValue(undefined);
    authSecurityService.createSession.mockResolvedValue({
      session_id: 'sess-002',
      status: 'active',
      expires_at: '2026-03-28T00:00:00.000Z',
      device_label: 'Chrome on Windows',
      portal: 'Console',
    });

    const result = await service.login({ user_id: 42 }, { headers: {} } as any, 'bonfiregs');

    expect(result.user_context).toEqual(
      expect.objectContaining({
        client_id: 'CL-80517',
        organization_user_type: 'CLIENT_ADMIN',
        allowed_branches: [],
        allowed_modules: ['catalog', 'auth'],
        effective_permissions: ['catalog.read', 'branch.read'],
      }),
    );
  });

  it('refreshes client admin branches from the database when token branch context is stale', async () => {
    const {
      service,
      jwtService,
      clientRepo,
      permissionResolverService,
      authSecurityService,
    } = createSubject();

    jwtService.verify.mockReturnValue({
      sub: 42,
      username: 'bonfireadmin',
      role: 'Client Admin',
      client_id: 'CL-80517',
      client_name: 'Bonfire Grill & Services',
      client_currency: 'PKR',
      short_name: 'BonfireGS',
      allowed_branches: [],
      effective_permissions: ['branch.manage.company'],
      allowed_modules: ['auth'],
      type: 'client',
      user_type: 'client',
      organization_user_type: 'CLIENT_ADMIN',
      session_id: 'sess-branchless',
      jti: 'sess-branchless',
    });
    authSecurityService.ensureSessionActive.mockResolvedValue(undefined);
    clientRepo.findOne.mockResolvedValue({
      client_code: 'CL-80517',
      currency: 'PKR',
      branches: [
        {
          id: 12,
          branch_code: 'MAIN-01',
          branch_name: 'Bonfire Main',
          client_id: 'CL-80517',
          status: 'active',
          is_active: false,
          currency_code: 'PKR',
          date_format: 'DD/MM/YYYY',
          time_format: 'HH:mm',
          inventory_store_type: 'branch',
        },
      ],
    });
    permissionResolverService.resolve.mockResolvedValue({
      permissions: new Set(['pos.view.branch', 'cashier.manage.branch']),
      allowedModules: ['pos'],
    });

    const result = await service.getUserContextFromAuthHeader('Bearer stale-token');

    expect(clientRepo.findOne).toHaveBeenCalledWith({
      where: { client_code: 'CL-80517' },
      relations: ['branches'],
    });
    expect(result.allowed_branches).toEqual([
      expect.objectContaining({
        branch_id: 12,
        branch_name: 'Bonfire Main',
        is_primary: true,
        effective_permissions: expect.arrayContaining(['pos.view.branch', 'cashier.manage.branch']),
        allowed_modules: ['pos'],
      }),
    ]);
    expect(result.active_branch_id).toBe(12);
  });
});
