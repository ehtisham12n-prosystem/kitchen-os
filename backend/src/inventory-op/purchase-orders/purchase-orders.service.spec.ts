import { BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { PurchaseOrdersService } from './purchase-orders.service';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ document_no: null })),
    })),
  };
}

function createManagerMock() {
  return {
    create: jest.fn((_entity, payload) => ({ ...payload })),
    save: jest.fn(async (entity) => ({ ...entity, id: entity.id ?? 900 })),
  };
}

describe('PurchaseOrdersService', () => {
  const user = {
    sub: 'user-1',
    username: 'proc.admin',
    client_id: 'CL-1',
  } as JwtPayload;

  function createService() {
    const poRepo = createRepoMock();
    const poItemRepo = createRepoMock();
    const branchRepo = createRepoMock();
    const vendorRepo = createRepoMock();
    const itemRepo = createRepoMock();
    const branchInventoryRepo = createRepoMock();
    const procurementRequestRepo = createRepoMock();
    const grnRepo = createRepoMock();
    const grnItemRepo = createRepoMock();
    const procurementRequestsService = {
      markConverted: jest.fn(),
    };
    const approvalsService = {
      submit: jest.fn(),
      resolveProcurementApprovalContext: jest.fn(),
      syncProcurementApprovalStatus: jest.fn(),
    };
    const manager = createManagerMock();
    const dataSource = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn(async () => null),
      })),
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const service = new PurchaseOrdersService(
      poRepo as any,
      poItemRepo as any,
      branchRepo as any,
      vendorRepo as any,
      itemRepo as any,
      branchInventoryRepo as any,
      procurementRequestRepo as any,
      grnRepo as any,
      grnItemRepo as any,
      procurementRequestsService as any,
      approvalsService as any,
      dataSource as any,
    );

    const rawManyBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => []),
      getMany: jest.fn(async () => []),
    };
    grnRepo.createQueryBuilder.mockReturnValue(rawManyBuilder);
    grnItemRepo.createQueryBuilder.mockReturnValue(rawManyBuilder);

    return {
      service,
      poRepo,
      branchRepo,
      vendorRepo,
      itemRepo,
      branchInventoryRepo,
      grnRepo,
      grnItemRepo,
      procurementRequestsService,
      approvalsService,
      manager,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a purchase order with a destination branch and approval discipline', async () => {
    const {
      service,
      poRepo,
      branchRepo,
      vendorRepo,
      itemRepo,
      branchInventoryRepo,
      grnRepo,
    } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce({ id: 1, client_id: 'CL-1', branch_name: 'Branch A', branch_code: 'BR-001', status: 'active', inventory_store_type: 'branch' })
      .mockResolvedValueOnce({ id: 2, client_id: 'CL-1', branch_name: 'Central Store', branch_code: 'BR-002', status: 'active', inventory_store_type: 'central' });
    branchRepo.count.mockResolvedValue(1);
    vendorRepo.findOne.mockResolvedValue({ id: 11, client_id: 'CL-1', is_active: true });
    itemRepo.count.mockResolvedValue(1);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);
    grnRepo.count.mockResolvedValue(0);
    poRepo.findOne.mockResolvedValue({
      id: 900,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      vendor_id: 11,
      po_number: 'PO-TEST',
      status: 'draft',
      approval_status: 'pending',
      total_amount: 22.5,
      notes: null,
      destination_store_label: 'Main receiving',
      procurement_mode: 'central_procurement',
      procurement_context: 'branch_requisition',
      approval_scope: 'central',
      approval_notes: null,
      approved_by: null,
      approved_by_name: null,
      approved_at: null,
      procurement_request_id: null,
      branch: { id: 1, branch_name: 'Branch A', branch_code: 'BR-001', inventory_store_type: 'branch' },
      destination_branch: { id: 2, branch_name: 'Central Store', branch_code: 'BR-002', inventory_store_type: 'central' },
      vendor: { id: 11, vendor_name: 'Metro' },
      procurement_request: null,
      items: [
        {
          id: 1,
          item_id: 55,
          quantity: 5,
          unit_cost: 4.5,
          line_total: 22.5,
          item: { item_name: 'Fresh Tomatoes', item_sku: 'TOM-001' },
        },
      ],
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await service.create(
      'CL-1',
      {
        branch_id: 1,
        destination_branch_id: 2,
        vendor_id: 11,
        destination_store_label: 'Main receiving',
        items: [{ item_id: 55, quantity: 5, unit_cost: 4.5 }],
      },
      user,
      [1, 2],
    );

    expect(result.destination_branch_id).toBe(2);
    expect(result.procurement_mode).toBe('central_procurement');
    expect(result.procurement_context).toBe('branch_requisition');
    expect(result.approval_scope).toBe('central');
    expect(result.approval_status).toBe('pending');
  });

  it('allows central procurement oversight to create a PO across tenant branches', async () => {
    const {
      service,
      poRepo,
      branchRepo,
      vendorRepo,
      itemRepo,
      branchInventoryRepo,
      grnRepo,
    } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce({ id: 1, client_id: 'CL-1', branch_name: 'Branch A', branch_code: 'BR-001', status: 'active', inventory_store_type: 'branch' })
      .mockResolvedValueOnce({ id: 2, client_id: 'CL-1', branch_name: 'Central Store', branch_code: 'BR-002', status: 'active', inventory_store_type: 'central' });
    branchRepo.count.mockResolvedValue(1);
    vendorRepo.findOne.mockResolvedValue({ id: 11, client_id: 'CL-1', is_active: true });
    itemRepo.count.mockResolvedValue(1);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);
    grnRepo.count.mockResolvedValue(0);
    poRepo.findOne.mockResolvedValue({
      id: 901,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      vendor_id: 11,
      po_number: 'PO-CENTRAL',
      status: 'draft',
      approval_status: 'pending',
      total_amount: 12,
      notes: null,
      destination_store_label: null,
      procurement_mode: 'central_procurement',
      procurement_context: 'branch_requisition',
      approval_scope: 'central',
      approval_notes: null,
      approved_by: null,
      approved_by_name: null,
      approved_at: null,
      procurement_request_id: null,
      branch: { id: 1, branch_name: 'Branch A', branch_code: 'BR-001', inventory_store_type: 'branch' },
      destination_branch: { id: 2, branch_name: 'Central Store', branch_code: 'BR-002', inventory_store_type: 'central' },
      vendor: { id: 11, vendor_name: 'Metro' },
      procurement_request: null,
      items: [
        {
          id: 1,
          item_id: 55,
          quantity: 3,
          unit_cost: 4,
          line_total: 12,
          item: { item_name: 'Fresh Tomatoes', item_sku: 'TOM-001' },
        },
      ],
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await service.create(
      'CL-1',
      {
        branch_id: 1,
        destination_branch_id: 2,
        vendor_id: 11,
        items: [{ item_id: 55, quantity: 3, unit_cost: 4 }],
      },
      user,
      [2],
    );

    expect(result.id).toBe(901);
    expect(result.approval_scope).toBe('central');
  });

  it('blocks sending a purchase order that is still pending approval', async () => {
    const { service, poRepo, grnRepo } = createService();

    grnRepo.count.mockResolvedValue(0);
    poRepo.findOne.mockResolvedValue({
      id: 900,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      approval_status: 'pending',
      branch: { id: 1, client_id: 'CL-1', status: 'active' },
      destination_branch: { id: 2, client_id: 'CL-1', status: 'active' },
    });

    await expect(
      service.updateStatus('CL-1', 900, 'sent', [1, 2]),
    ).rejects.toThrow(BadRequestException);
  });
});
