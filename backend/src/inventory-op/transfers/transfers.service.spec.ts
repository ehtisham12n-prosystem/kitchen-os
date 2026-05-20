import { BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { TransfersService } from './transfers.service';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createManagerMock() {
  return {
    create: jest.fn((_entity, payload) => ({ ...payload })),
    save: jest.fn(async (entity) => entity),
    findOne: jest.fn(),
  };
}

function buildTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    transfer_no: 'ITR-2603-0001',
    client_id: 'CL-1',
    flow_type: 'stock_transfer',
    source_branch_id: 1,
    destination_branch_id: 2,
    status: 'approved',
    require_approval: true,
    source_branch: buildBranch({ id: 1, inventory_store_type: 'central', branch_name: 'Central Kitchen' }),
    destination_branch: buildBranch({ id: 2, inventory_store_type: 'branch', branch_name: 'Downtown Branch' }),
    events: [],
    items: [
      {
        id: 101,
        item_id: 55,
        requested_quantity: 10,
        dispatched_quantity: 0,
        received_quantity: 0,
        short_quantity: 0,
        damaged_quantity: 0,
        production_stage: 'raw',
        unit_cost: 12.5,
        variance_reason: null,
        item: {
          item_name: 'Fresh Tomatoes',
          item_sku: 'TOM-001',
          uom_base: 'kg',
        },
      },
    ],
    ...overrides,
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

describe('TransfersService', () => {
  const user = {
    sub: 'user-1',
    username: 'ops.manager',
    client_id: 'CL-1',
  } as JwtPayload;

  function createService() {
    const transferRepo = createRepoMock();
    const ledgerRepo = createRepoMock();
    const branchRepo = createRepoMock();
    const itemRepo = createRepoMock();
    const branchInventoryRepo = createRepoMock();
    const operationalAuditService = {
      log: jest.fn(),
    };
    const accountingService = {
      ensureDefaultAccount: jest.fn(async (_clientId, accountCode, accountName, accountType) => ({
        id: accountCode === '1220'
          ? 1220
          : accountCode === '2120'
            ? 2120
            : accountCode === '5500'
              ? 5500
              : accountCode === '4310'
                ? 4310
                : accountCode === '5320'
                  ? 5320
                  : 1300,
        account_code: accountCode,
        account_name: accountName,
        account_type: accountType,
      })),
      createJournalEntry: jest.fn(async (_clientId, branchId, dto) => ({
        id: `${branchId}-${dto.source_event}`,
        branch_id: branchId,
        source_event: dto.source_event,
      })),
      findJournalEntryBySource: jest.fn(async () => null),
    };
    const manager = createManagerMock();
    const dataSource = {
      manager,
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const service = new TransfersService(
      transferRepo as any,
      ledgerRepo as any,
      branchRepo as any,
      itemRepo as any,
      branchInventoryRepo as any,
      accountingService as any,
      operationalAuditService as any,
      dataSource as any,
    );

    return {
      service,
      transferRepo,
      ledgerRepo,
      branchRepo,
      itemRepo,
      branchInventoryRepo,
      accountingService,
      operationalAuditService,
      manager,
      dataSource,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects creating a transfer when source and destination branches are the same', async () => {
    const { service } = createService();

    await expect(
      service.create(
        'CL-1',
        {
          source_branch_id: 3,
          destination_branch_id: 3,
          require_approval: true,
          items: [{ item_id: 55, requested_quantity: 2 }],
        },
        user,
        [3],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects branch-to-branch stock transfers in this batch policy', async () => {
    const { service, branchRepo } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce(buildBranch({ id: 3, inventory_store_type: 'branch', branch_name: 'Branch A' }))
      .mockResolvedValueOnce(buildBranch({ id: 4, inventory_store_type: 'branch', branch_name: 'Branch B' }));

    await expect(
      service.create(
        'CL-1',
        {
          source_branch_id: 3,
          destination_branch_id: 4,
          require_approval: true,
          items: [{ item_id: 55, requested_quantity: 2 }],
        },
        user,
        [3, 4],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects production supply requests from a branch that is not designated as a production source', async () => {
    const { service, branchRepo } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce(buildBranch({ id: 1, is_production_source: false }))
      .mockResolvedValueOnce(buildBranch({
        id: 2,
        branch_name: 'Downtown Branch',
        branch_code: 'DT-01',
        inventory_store_type: 'branch',
        production_source_label: null,
      }));

    await expect(
      service.create(
        'CL-1',
        {
          source_branch_id: 1,
          destination_branch_id: 2,
          require_approval: true,
          items: [{ item_id: 55, requested_quantity: 2, production_stage: 'prepared' }],
        },
        user,
        [1, 2],
        { flowType: 'production_supply' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects raw-stock lines inside a production supply request', async () => {
    const { service, branchRepo, itemRepo, branchInventoryRepo } = createService();

    branchRepo.findOne
      .mockResolvedValueOnce(buildBranch({ id: 1 }))
      .mockResolvedValueOnce(buildBranch({
        id: 2,
        branch_name: 'Downtown Branch',
        branch_code: 'DT-01',
        inventory_store_type: 'branch',
        production_source_label: null,
      }));
    itemRepo.findOne.mockResolvedValue({
      id: 55,
      client_id: 'CL-1',
      item_name: 'Paratha Dough',
      item_is_active: true,
    });
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);

    await expect(
      service.create(
        'CL-1',
        {
          source_branch_id: 1,
          destination_branch_id: 2,
          require_approval: true,
          items: [{ item_id: 55, requested_quantity: 2, production_stage: 'raw' }],
        },
        user,
        [1, 2],
        { flowType: 'production_supply' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('dispatch deducts source stock and records a transfer ledger movement', async () => {
    const {
      service,
      transferRepo,
      branchInventoryRepo,
      accountingService,
      manager,
      operationalAuditService,
    } = createService();

    const transfer = buildTransfer();
    const sourceStockLevel = {
      client_id: 'CL-1',
      branch_id: 1,
      item_id: 55,
      current_quantity: 15,
    };

    transferRepo.findOne.mockImplementation(async () => transfer);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 1, item_id: 55, is_enabled: true }]);
    manager.findOne.mockResolvedValue(sourceStockLevel);

    const result = await service.dispatch(
      'CL-1',
      77,
      {
        items: [{ transfer_item_id: 101, dispatch_quantity: 10 }],
        notes: 'Loaded for branch dispatch',
      },
      user,
      [1],
    );

    expect(sourceStockLevel.current_quantity).toBe(5);
    expect(result.status).toBe('in_transit');
    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      1,
      expect.objectContaining({ source_event: 'dispatch_clearing' }),
      user,
    );
    expect(result.items[0]).toMatchObject({
      dispatched_quantity: 10,
      in_transit_quantity: 10,
    });
    expect(result.summary).toMatchObject({
      dispatched_quantity: 10,
      in_transit_quantity: 10,
      in_transit_value: 125,
      has_in_transit: true,
    });

    const savedLedger = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.transaction_type === 'transfer' && entity.reference_id === 'ITR-2603-0001:OUT');

    expect(savedLedger).toMatchObject({
      branch_id: 1,
      item_id: 55,
      quantity: -10,
      transaction_type: 'transfer',
      unit_cost: 12.5,
    });
    expect(operationalAuditService.log).toHaveBeenCalled();
  });

  it('receipt posts destination clearing and marks variance review when shortages exist', async () => {
    const {
      service,
      transferRepo,
      branchInventoryRepo,
      accountingService,
      manager,
    } = createService();

    const transfer = buildTransfer({
      status: 'in_transit',
      dispatched_at: new Date('2026-04-22T10:00:00Z'),
      items: [
        {
          id: 101,
          item_id: 55,
          requested_quantity: 10,
          dispatched_quantity: 10,
          received_quantity: 0,
          short_quantity: 0,
          damaged_quantity: 0,
          production_stage: 'raw',
          unit_cost: 12.5,
          variance_reason: null,
          item: {
            item_name: 'Fresh Tomatoes',
            item_sku: 'TOM-001',
            uom_base: 'kg',
          },
        },
      ],
    });
    const destinationStockLevel = {
      client_id: 'CL-1',
      branch_id: 2,
      item_id: 55,
      current_quantity: 0,
      last_unit_cost: 0,
      last_received_at: null,
    };

    transferRepo.findOne.mockImplementation(async () => transfer);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);
    manager.findOne.mockResolvedValue(destinationStockLevel);

    const result = await service.receive(
      'CL-1',
      77,
      {
        notes: 'Received with shortage',
        variance_notes: 'One crate missing',
        items: [
          {
            transfer_item_id: 101,
            received_quantity: 8,
            short_quantity: 2,
            damaged_quantity: 0,
            variance_reason: 'One crate missing',
          },
        ],
      },
      user,
      [2],
    );

    expect(result.status).toBe('received_with_variance');
    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      2,
      expect.objectContaining({ source_event: 'receipt_clearing' }),
      user,
    );
    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      1,
      expect.objectContaining({
        source_event: 'source_recharge',
        items: expect.arrayContaining([
          expect.objectContaining({ account_id: 1220, debit: 100, credit: 0 }),
          expect.objectContaining({ account_id: 4310, debit: 0, credit: 100 }),
        ]),
      }),
      user,
    );
    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      2,
      expect.objectContaining({
        source_event: 'destination_recharge',
        items: expect.arrayContaining([
          expect.objectContaining({ account_id: 5320, debit: 100, credit: 0 }),
          expect.objectContaining({ account_id: 2120, debit: 0, credit: 100 }),
        ]),
      }),
      user,
    );
  });

  it('cancels an approved transfer before dispatch without posting ledger stock', async () => {
    const {
      service,
      transferRepo,
      operationalAuditService,
      manager,
    } = createService();

    const transfer = buildTransfer({
      source_branch: buildBranch({ id: 1 }),
      destination_branch: buildBranch({ id: 2, inventory_store_type: 'branch', branch_name: 'Downtown Branch' }),
    });

    transferRepo.findOne.mockImplementation(async () => transfer);

    const result = await service.cancel('CL-1', 77, 'Request withdrawn', user, [1, 2]);

    expect(result.status).toBe('cancelled');
    expect(result.cancellation_notes).toBe('Request withdrawn');
    const savedLedger = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.transaction_type === 'transfer');
    expect(savedLedger).toBeUndefined();
    expect(operationalAuditService.log).toHaveBeenCalled();
  });

  it('receive rejects a receipt that does not reconcile to the dispatched quantity', async () => {
    const {
      service,
      transferRepo,
      branchInventoryRepo,
    } = createService();

    const transfer = buildTransfer({
      status: 'in_transit',
      items: [
        {
          id: 101,
          item_id: 55,
          requested_quantity: 10,
          dispatched_quantity: 10,
          received_quantity: 0,
          short_quantity: 0,
          damaged_quantity: 0,
          production_stage: 'raw',
          unit_cost: 12.5,
          variance_reason: null,
          item: {
            item_name: 'Fresh Tomatoes',
            item_sku: 'TOM-001',
            uom_base: 'kg',
          },
        },
      ],
    });

    transferRepo.findOne.mockImplementation(async () => transfer);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);

    await expect(
      service.receive(
        'CL-1',
        77,
        {
          items: [
            {
              transfer_item_id: 101,
              received_quantity: 8,
              short_quantity: 1,
              damaged_quantity: 0,
              variance_reason: 'Short landed',
            },
          ],
          notes: 'Receipt checked',
          variance_notes: 'Carrier count mismatch',
        },
        user,
        [2],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('receive adds destination stock only for received quantity and closes with variance when needed', async () => {
    const {
      service,
      transferRepo,
      branchInventoryRepo,
      manager,
      operationalAuditService,
    } = createService();

    const transfer = buildTransfer({
      status: 'in_transit',
      items: [
        {
          id: 101,
          item_id: 55,
          requested_quantity: 10,
          dispatched_quantity: 10,
          received_quantity: 0,
          short_quantity: 0,
          damaged_quantity: 0,
          production_stage: 'raw',
          unit_cost: 12.5,
          variance_reason: null,
          item: {
            item_name: 'Fresh Tomatoes',
            item_sku: 'TOM-001',
            uom_base: 'kg',
          },
        },
      ],
    });

    transferRepo.findOne.mockImplementation(async () => transfer);
    branchInventoryRepo.find.mockResolvedValue([{ branch_id: 2, item_id: 55, is_enabled: true }]);
    manager.findOne.mockResolvedValue(null);

    const result = await service.receive(
      'CL-1',
      77,
      {
        items: [
          {
            transfer_item_id: 101,
            received_quantity: 8,
            short_quantity: 1,
            damaged_quantity: 1,
            variance_reason: 'Transit damage',
          },
        ],
        notes: 'Destination checked delivery',
        variance_notes: 'One short and one damaged unit',
      },
      user,
      [2],
    );

    expect(result.status).toBe('received_with_variance');
    expect(result.items[0]).toMatchObject({
      received_quantity: 8,
      in_transit_quantity: 0,
      short_quantity: 1,
      damaged_quantity: 1,
      variance_quantity: 2,
    });
    expect(result.summary).toMatchObject({
      received_quantity: 8,
      in_transit_quantity: 0,
      short_quantity: 1,
      damaged_quantity: 1,
      has_in_transit: false,
      has_variance: true,
    });

    const savedLedger = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.transaction_type === 'transfer' && entity.reference_id === 'ITR-2603-0001:IN');

    expect(savedLedger).toMatchObject({
      branch_id: 2,
      item_id: 55,
      quantity: 8,
      transaction_type: 'transfer',
      unit_cost: 12.5,
    });

    const savedStockLevel = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.branch_id === 2 && entity.item_id === 55 && entity.current_quantity === 8);

    expect(savedStockLevel).toBeDefined();
    expect(savedStockLevel).toMatchObject({
      current_quantity: 8,
      last_unit_cost: 12.5,
    });
    expect(savedStockLevel.last_received_at).toBeInstanceOf(Date);
    expect(operationalAuditService.log).toHaveBeenCalled();
  });
});
