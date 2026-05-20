import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    validateSystemUser: jest.fn(),
    validateClientUser: jest.fn(),
    validateCustomerUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getUserContextFromAuthHeader: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as any);
  });

  it('forwards client login with tenant context', async () => {
    const req = { headers: { 'x-forwarded-for': '127.0.0.1' } };
    const user = { user_id: 42, tenant_slug: 'kitchen-club' };
    const response = { access_token: 'jwt-token' };

    authService.validateClientUser.mockResolvedValue(user);
    authService.login.mockResolvedValue(response);

    await expect(
      controller.clientLogin(
        {
          username: 'kitchenclub.admin',
          password: 'secret',
          tenantSlug: 'kitchen-club',
        },
        req,
      ),
    ).resolves.toEqual(response);

    expect(authService.validateClientUser).toHaveBeenCalledWith(
      'kitchenclub.admin',
      'secret',
      'kitchen-club',
      req,
    );
    expect(authService.login).toHaveBeenCalledWith(user, req, 'kitchen-club');
  });

  it('rejects invalid platform credentials', async () => {
    authService.validateSystemUser.mockResolvedValue(null);

    await expect(
      controller.systemLogin(
        { username: 'root', password: 'wrong-password' },
        { headers: {} },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
