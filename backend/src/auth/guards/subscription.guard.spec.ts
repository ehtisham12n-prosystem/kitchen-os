import { ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  function createContext(request: any): any {
    return {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
  }

  it('allows routes with no permission metadata', async () => {
    const guard = new SubscriptionGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any,
      { resolve: jest.fn() } as any,
    );

    await expect(guard.canActivate(createContext({ user: undefined }))).resolves.toBe(true);
  });

  it('rejects when a required permission is missing', async () => {
    const guard = new SubscriptionGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(['inventory.read']) } as any,
      {
        resolve: jest.fn().mockResolvedValue({ permissions: new Set(['orders.read']) }),
      } as any,
    );

    await expect(
      guard.canActivate(
        createContext({
          activeBranchId: 2,
          user: { sub: 10, client_id: 'CL-1', allowed_branches: [{ branch_id: 2 }] },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows when the resolved permissions satisfy the route', async () => {
    const guard = new SubscriptionGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(['inventory.read']) } as any,
      {
        resolve: jest.fn().mockResolvedValue({ permissions: new Set(['inventory.read']) }),
      } as any,
    );

    await expect(
      guard.canActivate(
        createContext({
          activeBranchId: 2,
          user: { sub: 10, client_id: 'CL-1', allowed_branches: [{ branch_id: 2 }] },
        }),
      ),
    ).resolves.toBe(true);
  });
});
