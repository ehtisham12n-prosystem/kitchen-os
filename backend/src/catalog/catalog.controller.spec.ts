import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  const catalogService = {
    findAllCategories: jest.fn(),
    getProductsWithBranchStatus: jest.fn(),
  };

  const user: JwtPayload = {
    sub: 42,
    client_id: 'CL10001',
    user_type: 'client',
    active_branch_id: 5,
    allowed_branches: [
      {
        branch_id: 5,
        branch_name: 'Main Branch',
        role_id: 7,
        role_name: 'Branch Manager',
        is_primary: true,
      },
    ],
  };

  let controller: CatalogController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CatalogController(catalogService as any);
  });

  it('loads catalog categories within the authenticated tenant context', async () => {
    catalogService.findAllCategories.mockResolvedValue([{ id: 1, category_name: 'Burgers' }]);

    await expect(controller.findAllCategories(user)).resolves.toEqual([
      { id: 1, category_name: 'Burgers' },
    ]);

    expect(catalogService.findAllCategories).toHaveBeenCalledWith('CL10001');
  });

  it('loads branch products for an accessible branch', async () => {
    catalogService.getProductsWithBranchStatus.mockResolvedValue([{ id: 10, name: 'Mint Lemonade' }]);

    await expect(controller.getBranchProducts(user, '5')).resolves.toEqual([
      { id: 10, name: 'Mint Lemonade' },
    ]);

    expect(catalogService.getProductsWithBranchStatus).toHaveBeenCalledWith('CL10001', 5);
  });

  it('rejects branch product access outside the user scope', async () => {
    await expect(controller.getBranchProducts(user, '9')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
