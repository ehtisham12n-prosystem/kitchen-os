import { APP_PERMISSIONS } from '../constants/permissions';
import { PermissionResolverService } from './permission-resolver.service';

describe('PermissionResolverService', () => {
  const createSubject = () => {
    const userRoleRepo = {
      find: jest.fn(),
    };
    const rolePermissionRepo = {
      find: jest.fn(),
    };
    const userRepo = {
      findOne: jest.fn(),
    };
    const entitlementsService = {
      getEffectiveEntitlements: jest.fn(),
    };

    const service = new PermissionResolverService(
      userRoleRepo as any,
      rolePermissionRepo as any,
      userRepo as any,
      entitlementsService as any,
    );

    return {
      service,
      userRoleRepo,
      rolePermissionRepo,
      userRepo,
      entitlementsService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives subscribed-module permissions for legacy client admins without a linked role', async () => {
    const { service, userRoleRepo, rolePermissionRepo, userRepo, entitlementsService } = createSubject();

    entitlementsService.getEffectiveEntitlements.mockResolvedValue({
      features: ['catalog', 'inventory', 'auth'],
    });
    userRoleRepo.find.mockResolvedValue([]);
    rolePermissionRepo.find.mockResolvedValue([]);
    userRepo.findOne.mockResolvedValue({
      id: 17,
      client_id: 'CL-10001',
      user_type: 'CLIENT_ADMIN',
      roleEntity: null,
      branchRoles: [],
    });

    const result = await service.resolve(17, 5, 'CL-10001');
    const permissions = Array.from(result.permissions);

    expect(result.allowedModules).toEqual(['catalog', 'inventory', 'auth']);
    expect(permissions).toEqual(expect.arrayContaining([
      APP_PERMISSIONS.CATALOG.READ,
      APP_PERMISSIONS.CATALOG.WRITE,
      APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
      APP_PERMISSIONS.ADMIN.SETUP_COUNTERS,
      APP_PERMISSIONS.ADMIN.SETUP_MASTER,
      APP_PERMISSIONS.ADMIN.SECURITY_USERS,
      APP_PERMISSIONS.ADMIN.SECURITY_ROLES,
      APP_PERMISSIONS.ADMIN.SECURITY_ACCESS,
      APP_PERMISSIONS.HR.STAFF_READ,
      APP_PERMISSIONS.HR.STAFF_WRITE,
      APP_PERMISSIONS.INVENTORY.READ,
      APP_PERMISSIONS.INVENTORY.SETUP,
      APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
      APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE,
      APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
      APP_PERMISSIONS.INVENTORY.WASTAGE,
      APP_PERMISSIONS.INVENTORY.ASSETS,
      APP_PERMISSIONS.INVENTORY.LEDGER,
    ]));
    expect(permissions).not.toContain('all');
  });

  it('keeps wildcard access for client admins on all-inclusive subscriptions', async () => {
    const { service, userRoleRepo, rolePermissionRepo, userRepo, entitlementsService } = createSubject();

    entitlementsService.getEffectiveEntitlements.mockResolvedValue({
      features: ['all'],
    });
    userRoleRepo.find.mockResolvedValue([]);
    rolePermissionRepo.find.mockResolvedValue([]);
    userRepo.findOne.mockResolvedValue({
      id: 17,
      client_id: 'CL-10001',
      user_type: 'CLIENT_ADMIN',
      roleEntity: null,
      branchRoles: [],
    });

    const result = await service.resolve(17, 5, 'CL-10001');

    expect(result.allowedModules).toEqual(['all']);
    expect(Array.from(result.permissions)).toEqual(['all']);
  });
});
