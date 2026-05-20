import { BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { ProductionService } from './production.service';

function createRepoMock() {
  return {
    create: jest.fn((payload) => ({ ...payload })),
    save: jest.fn(async (entity) => ({ ...entity, id: entity.id ?? 701 })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };
}

function buildBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    client_id: 'CL-1',
    branch_name: 'Central Kitchen',
    branch_code: 'CK-01',
    inventory_store_type: 'central',
    is_production_source: true,
    production_source_label: 'Central Kitchen',
    status: 'active',
    ...overrides,
  };
}

function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    client_id: 'CL-1',
    is_active: true,
    product_name: 'Chicken Curry',
    product_code: 'CC-01',
    product_sku: 'SKU-CC-01',
    production_station: null,
    base_uom: null,
    ...overrides,
  };
}

function buildPreparedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    client_id: 'CL-1',
    item_name: 'Prepared Curry Tray',
    item_sku: 'PC-01',
    uom_base: 'tray',
    item_is_active: true,
    ...overrides,
  };
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  const sourceBranch = buildBranch({ id: 1, branch_name: 'Central Kitchen' });
  const destinationBranch = buildBranch({
    id: 2,
    branch_name: 'Downtown Branch',
    branch_code: 'DT-01',
    inventory_store_type: 'branch',
    production_source_label: null,
  });

  return {
    id: 701,
    client_id: 'CL-1',
    branch_id: 1,
    destination_branch_id: 2,
    status: 'prepared',
    planned_quantity: 12,
    actual_quantity: 12,
    requested_by: 'user-1',
    requested_by_name: 'ops.manager',
    requested_at: new Date(),
    queued_by: 'user-1',
    queued_by_name: 'ops.manager',
    queued_at: new Date(),
    queue_notes: null,
    start_date: new Date(),
    completion_date: new Date(),
    completed_by: 'user-1',
    completed_by_name: 'ops.manager',
    completion_notes: null,
    notes: 'Morning prep run',
    rejection_notes: null,
    cancellation_notes: null,
    dispatch_notes: null,
    receipt_notes: null,
    variance_notes: null,
    source_unit_label: 'Central Kitchen',
    destination_unit_label: 'Downtown Branch',
    product_id: 11,
    product: buildProduct(),
    prepared_item_id: 55,
    prepared_item: buildPreparedItem(),
    linked_transfer_id: null,
    linked_transfer: null,
    branch: sourceBranch,
    destination_branch: destinationBranch,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('ProductionService', () => {
  const user = {
    sub: 'user-1',
    username: 'ops.manager',
    client_id: 'CL-1',
  } as JwtPayload;

  function createService() {
    const prodRepo = createRepoMock();
    const branchRepo = createRepoMock();
    const productRepo = createRepoMock();
    const itemRepo = createRepoMock();
    const branchInventoryRepo = createRepoMock();
    const recipeRepo = createRepoMock();
    const ingredientRepo = createRepoMock();
    const transfersService = {
      create: jest.fn(),
      findOne: jest.fn(),
      dispatch: jest.fn(),
      receive: jest.fn(),
    };
    const operationalAuditService = {
      log: jest.fn(),
    };
    const catalogService = {
      getBranchProductSaleContext: jest.fn().mockResolvedValue({ effective_enabled: true }),
    };
    const dataSource = {
      manager: {
        findOne: jest.fn(),
      },
      transaction: jest.fn(),
    };

    recipeRepo.find.mockResolvedValue([]);
    branchInventoryRepo.findOne.mockResolvedValue({ is_enabled: true });

    const service = new ProductionService(
      prodRepo as any,
      branchRepo as any,
      productRepo as any,
      itemRepo as any,
      branchInventoryRepo as any,
      recipeRepo as any,
      ingredientRepo as any,
      transfersService as any,
      operationalAuditService as any,
      catalogService as any,
      dataSource as any,
    );

    return {
      service,
      prodRepo,
      branchRepo,
      productRepo,
      itemRepo,
      branchInventoryRepo,
      recipeRepo,
      ingredientRepo,
      transfersService,
      operationalAuditService,
      catalogService,
      dataSource,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects cross-branch production requests without a prepared inventory item', async () => {
    const { service, branchRepo, productRepo, itemRepo } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce(buildBranch({ id: 1 }))
      .mockResolvedValueOnce(buildBranch({
        id: 2,
        branch_name: 'Downtown Branch',
        branch_code: 'DT-01',
        inventory_store_type: 'branch',
        production_source_label: null,
      }));
    productRepo.findOne.mockResolvedValue(buildProduct());
    itemRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createProductionOrder(
        'CL-1',
        {
          source_branch_id: 1,
          destination_branch_id: 2,
          product_id: 11,
          planned_quantity: 10,
        },
        user,
        [1, 2],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('dispatches a prepared production order through the linked production supply transfer', async () => {
    const { service, prodRepo, transfersService, operationalAuditService } = createService();

    const order = buildOrder();
    prodRepo.save.mockImplementation(async (entity: any) => {
      Object.assign(order, entity);
      return { ...entity };
    });
    prodRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.id === 701) {
        return {
          ...order,
          linked_transfer_id: order.linked_transfer_id,
          linked_transfer: order.linked_transfer_id
            ? {
                id: order.linked_transfer_id,
                transfer_no: 'PSR-2603-0001',
                status: 'in_transit',
                flow_type: 'production_supply',
                dispatched_at: new Date(),
                received_at: null,
              }
            : null,
        };
      }
      return null;
    });
    prodRepo.save.mockImplementation(async (entity) => ({ ...entity }));
    transfersService.create.mockResolvedValue({
      id: 880,
      status: 'requested',
      items: [{ id: 991, dispatched_quantity: 0 }],
    });
    transfersService.dispatch.mockResolvedValue({
      id: 880,
      status: 'in_transit',
      items: [{ id: 991, dispatched_quantity: 12 }],
    });

    await service.dispatchProduction(
      'CL-1',
      701,
      { dispatch_quantity: 12, notes: 'Loaded onto dispatch van' },
      user,
      [1, 2],
    );

    expect(transfersService.create).toHaveBeenCalledWith(
      'CL-1',
      expect.objectContaining({
        source_branch_id: 1,
        destination_branch_id: 2,
        reason_code: 'production_dispatch',
      }),
      user,
      [1, 2],
      { flowType: 'production_supply' },
    );
    expect(transfersService.dispatch).toHaveBeenCalled();
    const dispatchedSave = prodRepo.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.status === 'dispatched');
    expect(dispatchedSave).toMatchObject({
      status: 'dispatched',
      linked_transfer_id: 880,
    });
    expect(operationalAuditService.log).toHaveBeenCalled();
  });

  it('receives a dispatched production order and reconciles the linked transfer receipt', async () => {
    const { service, prodRepo, transfersService, operationalAuditService } = createService();

    const order = buildOrder({
      status: 'dispatched',
      linked_transfer_id: 880,
      linked_transfer: {
        id: 880,
        transfer_no: 'PSR-2603-0001',
        status: 'in_transit',
        flow_type: 'production_supply',
        dispatched_at: new Date(),
        received_at: null,
      },
    });

    prodRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.id === 701) {
        return order;
      }
      return null;
    });
    prodRepo.save.mockImplementation(async (entity) => ({ ...entity }));
    transfersService.findOne.mockResolvedValue({
      id: 880,
      items: [{ id: 991, dispatched_quantity: 12 }],
    });
    transfersService.receive.mockResolvedValue({
      id: 880,
      status: 'received',
    });

    const result = await service.receiveProduction(
      'CL-1',
      701,
      {
        received_quantity: 11,
        short_quantity: 1,
        damaged_quantity: 0,
        variance_reason: 'One tray short',
        notes: 'Received at branch kitchen',
        variance_notes: 'Count verified on arrival',
      },
      user,
      [2],
    );

    expect(transfersService.receive).toHaveBeenCalledWith(
      'CL-1',
      880,
      expect.objectContaining({
        items: [
          expect.objectContaining({
            transfer_item_id: 991,
            received_quantity: 11,
            short_quantity: 1,
            damaged_quantity: 0,
          }),
        ],
      }),
      user,
      [2],
      { flowType: 'production_supply' },
    );
    expect(result.status).toBe('received');
    expect(result.receipt_notes).toBe('Received at branch kitchen');
    expect(operationalAuditService.log).toHaveBeenCalled();
  });
});
