import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BranchAccessGuard } from './branch-access.guard';

describe('BranchAccessGuard', () => {
  const guard = new BranchAccessGuard({} as any);

  function createContext(request: any): any {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
  }

  it('allows an authorized branch header and normalizes the active branch', () => {
    const request = {
      headers: { 'x-branch-id': '2' },
      params: {},
      query: {},
      body: {},
      user: {
        allowed_branches: [{ branch_id: 2 }],
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(request.activeBranchId).toBe(2);
    expect(request.user.branch_id).toBe(2);
    expect(request.user.active_branch_id).toBe(2);
  });

  it('rejects mismatched branch context between header and body', () => {
    const request = {
      headers: { 'x-branch-id': '2' },
      params: {},
      query: {},
      body: { branch_id: 3 },
      user: {
        allowed_branches: [{ branch_id: 2 }, { branch_id: 3 }],
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(BadRequestException);
  });

  it('rejects an unauthorized branch id', () => {
    const request = {
      headers: { 'x-branch-id': '4' },
      params: {},
      query: {},
      body: {},
      user: {
        allowed_branches: [{ branch_id: 2 }],
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });

  it('enforces setup branch routes that use :id params', () => {
    const request = {
      headers: {},
      params: { id: '5' },
      query: {},
      body: {},
      baseUrl: '/v1/setup/branches',
      route: { path: '/:id/charges' },
      user: {
        allowed_branches: [{ branch_id: 5 }],
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(request.activeBranchId).toBe(5);
  });
});
