import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccountingService } from '../accounting/accounting.service';
import { InventoryOpService } from './inventory-op.service';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockLevel } from './entities/stock-level.entity';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createManagerMock() {
  return {
    create: jest.fn((_entity, payload) => ({ ...payload })),
    save: jest.fn(async (entity) => ({ ...entity, id: entity.id ?? 501 })),
    findOne: jest.fn(),
  };
}

describe('InventoryOpService', () => {
  function createService() {
    const ledgerRepo = createRepoMock();
    const levelRepo = createRepoMock();
    const poRepo = createRepoMock();
    const itemRepo = createRepoMock();
    const vendorRepo = createRepoMock();
    const branchRepo = createRepoMock();
    const grnRepo = createRepoMock();
    const grnItemRepo = createRepoMock();
    const grnReturnRepo = createRepoMock();
    const grnReturnItemRepo = createRepoMock();
    const branchInventoryRepo = createRepoMock();
    const auditLogRepo = createRepoMock();
    const accountingService = {
      ensureDefaultAccount: jest.fn(async (_clientId, code) => ({ id: code })),
      createJournalEntry: jest.fn(),
    } as unknown as AccountingService;
    const operationalAuditService = {
      log: jest.fn(),
    };
    const uomConversionService = {
      convertQuantity: jest.fn((_clientId, quantity) => quantity),
    };
    const manager = createManagerMock();
    const dataSource = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn(async () => null),
      })),
      query: jest.fn(async () => []),
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const emptyQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => []),
      getMany: jest.fn(async () => []),
      getRawOne: jest.fn(async () => ({ grn_count: 0, grn_value: 0 })),
      take: jest.fn().mockReturnThis(),
    };
    grnRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);
    grnItemRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);
    grnReturnRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);
    grnReturnItemRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);
    levelRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);
    ledgerRepo.createQueryBuilder.mockReturnValue(emptyQueryBuilder);

    const service = new InventoryOpService(
      ledgerRepo as any,
      levelRepo as any,
      poRepo as any,
      itemRepo as any,
      vendorRepo as any,
      branchRepo as any,
      grnRepo as any,
      grnItemRepo as any,
      grnReturnRepo as any,
      grnReturnItemRepo as any,
      branchInventoryRepo as any,
      auditLogRepo as any,
      accountingService,
      operationalAuditService as any,
      dataSource as any,
      uomConversionService as any,
    );

    return {
      service,
      poRepo,
      branchRepo,
      itemRepo,
      vendorRepo,
      grnRepo,
      grnItemRepo,
      accountingService,
      operationalAuditService,
      manager,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('receives stock into the purchase order destination branch and posts a GRN', async () => {
    const {
      service,
      poRepo,
      branchRepo,
      itemRepo,
      grnRepo,
      accountingService,
      manager,
    } = createService();

    branchRepo.findOne.mockResolvedValue({ id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store', branch_code: 'CEN' });
    branchRepo.count.mockResolvedValue(0);
    itemRepo.findOne.mockResolvedValue({ id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true });
    poRepo.findOne.mockResolvedValue({
      id: 99,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      approval_status: 'approved',
      status: 'sent',
      legacy_status: 'ordered',
      vendor_id: 7,
      items: [{ id: 11, item_id: 55, quantity: 4, unit_cost: 3.5 }],
      destination_branch: { id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store' },
      branch: { id: 1, client_id: 'CL-1', status: 'active', branch_name: 'Branch A' },
    });
    grnRepo.findOne
      .mockResolvedValue({
        id: 501,
        client_id: 'CL-1',
        branch_id: 2,
        purchase_order_id: 99,
        vendor_id: 7,
        grn_number: 'GRN-CEN-202603-0001',
        receipt_date: new Date('2026-03-26T12:00:00.000Z'),
        status: 'posted',
        payable_status: 'pending_bill',
        vendor_invoice_number: null,
        notes: null,
        received_by: null,
        received_by_name: 'System',
        branch: { id: 2, branch_name: 'Central Store', branch_code: 'CEN', inventory_store_type: 'central' },
        vendor: { id: 7, vendor_name: 'Metro' },
        purchase_order: { id: 99, po_number: 'PO-99', status: 'received', approval_status: 'approved' },
        items: [{
          id: 1,
          po_item_id: 11,
          item_id: 55,
          ordered_quantity: 4,
          received_quantity: 4,
          unit_cost: 3.5,
          line_total: 14,
          notes: null,
          item: { item_name: 'Fresh Tomatoes', item_sku: 'TOM-001' },
        }],
        created_at: new Date(),
        updated_at: new Date(),
      });
    manager.findOne.mockImplementation(async (entity) => {
      if (entity === InventoryItem) {
        return { id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true };
      }
      if (entity === StockLevel) {
        return null;
      }
      return null;
    });

    const result = await service.receiveStock('CL-1', 2, {
      branch_id: 2,
      po_id: 99,
      items: [{ item_id: 55, quantity: 4, unit_cost: 3.5 }],
    });

    const savedLedger = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity) => entity.transaction_type === 'purchase');

    expect(savedLedger).toMatchObject({
      branch_id: 2,
      item_id: 55,
      quantity: 4,
    });
    expect(String(savedLedger.reference_id || '')).toMatch(/^GRN-CEN-/);
    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
        'CL-1',
        2,
        expect.objectContaining({
        description: 'GRN-CEN-202603-0001 Receipt (Pending Vendor Bill)',
        items: expect.arrayContaining([
          expect.objectContaining({ account_id: '1300', debit: 14, credit: 0 }),
          expect.objectContaining({ account_id: '2110', debit: 0, credit: 14 }),
        ]),
      }),
    );
    expect(result.grn_number).toBe('GRN-CEN-202603-0001');
    expect(result.payable.liability_account_code).toBe('2110');
  });

  it('blocks receipt when the purchase order approval is still pending', async () => {
    const { service, poRepo, branchRepo } = createService();

    branchRepo.findOne.mockResolvedValue({ id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store', branch_code: 'CEN' });
    poRepo.findOne.mockResolvedValue({
      id: 99,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      approval_status: 'pending',
      destination_branch: { id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store' },
      branch: { id: 1, client_id: 'CL-1', status: 'active', branch_name: 'Branch A' },
      items: [{ id: 11, item_id: 55, quantity: 4, unit_cost: 3.5 }],
    });

    await expect(
      service.receiveStock('CL-1', 2, {
        branch_id: 2,
        po_id: 99,
        items: [{ item_id: 55, quantity: 4, unit_cost: 3.5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('issues stock to kitchen as production movement entries', async () => {
    const {
      service,
      branchRepo,
      manager,
      operationalAuditService,
    } = createService();

    branchRepo.findOne.mockResolvedValue({
      id: 2,
      client_id: 'CL-1',
      status: 'active',
      branch_name: 'Branch A',
      branch_code: 'BRA',
    });

    manager.findOne.mockImplementation(async (entity, options) => {
      if (entity === InventoryItem) {
        if (options?.where?.id === 55) {
          return { id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true };
        }
        if (options?.where?.id === 56) {
          return { id: 56, client_id: 'CL-1', item_name: 'Mozzarella Cheese', item_is_active: true };
        }
      }
      if (entity === StockLevel) {
        if (options?.where?.item_id === 55) {
          return { id: 301, client_id: 'CL-1', branch_id: 2, item_id: 55, current_quantity: 8, last_unit_cost: 3.5, last_received_at: null };
        }
        if (options?.where?.item_id === 56) {
          return { id: 302, client_id: 'CL-1', branch_id: 2, item_id: 56, current_quantity: 5, last_unit_cost: 12, last_received_at: null };
        }
      }
      return null;
    });

    const result = await service.issueToKitchen('CL-1', 2, {
      branch_id: 2,
      issue_to: 'Main Kitchen',
      issuance_type: 'manual',
      issue_date: '2026-04-20',
      issued_by_name: 'Storekeeper',
      notes: 'Morning prep',
      items: [
        { item_id: 55, quantity: 2.5 },
        { item_id: 56, quantity: 1.25 },
      ],
    });

    const savedLedgers = manager.save.mock.calls
      .map(([entity]) => entity)
      .filter((entity) => entity.transaction_type === 'production');

    expect(savedLedgers).toHaveLength(2);
    expect(savedLedgers[0]).toMatchObject({
      branch_id: 2,
      item_id: 55,
      quantity: -2.5,
    });
    expect(savedLedgers[1]).toMatchObject({
      branch_id: 2,
      item_id: 56,
      quantity: -1.25,
    });
    expect(result.issue_to).toBe('Main Kitchen');
    expect(result.line_count).toBe(2);
    expect(result.total_cost).toBe(23.75);
    expect(operationalAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Inventory Issued to Kitchen',
        branchId: 2,
      }),
    );
  });

  it('blocks high-value wastage for users without approval authority', async () => {
    const {
      service,
      branchRepo,
      itemRepo,
    } = createService();

    branchRepo.findOne.mockResolvedValue({
      id: 2,
      client_id: 'CL-1',
      status: 'active',
      branch_name: 'Branch A',
      branch_code: 'BRA',
    });
    itemRepo.findOne.mockResolvedValue({ id: 55, client_id: 'CL-1', item_name: 'Premium Cheese', item_is_active: true });

    (service as any).levelRepo.findOne = jest.fn(async () => ({
      id: 901,
      client_id: 'CL-1',
      branch_id: 2,
      item_id: 55,
      current_quantity: 10,
      last_unit_cost: 1500,
    }));

    await expect(
      service.adjustStock(
        'CL-1',
        2,
        {
          item_id: 55,
          quantity: -4,
          type: 'wastage',
          reason: 'EXPIRED',
          notes: 'Cold room failure',
        },
        {
          sub: 44,
          client_id: 'CL-1',
          branch_id: 2,
          active_branch_id: 2,
          allowed_branches: [{ branch_id: 2, branch_name: 'Branch A', approval_authority: 'none' }],
          effective_permissions: [],
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires notes when wastage reason is OTHER', async () => {
    const {
      service,
      branchRepo,
      itemRepo,
    } = createService();

    branchRepo.findOne.mockResolvedValue({
      id: 2,
      client_id: 'CL-1',
      status: 'active',
      branch_name: 'Branch A',
      branch_code: 'BRA',
    });
    itemRepo.findOne.mockResolvedValue({ id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true });

    (service as any).levelRepo.findOne = jest.fn(async () => ({
      id: 902,
      client_id: 'CL-1',
      branch_id: 2,
      item_id: 55,
      current_quantity: 20,
      last_unit_cost: 100,
    }));

    await expect(
      service.adjustStock(
        'CL-1',
        2,
        {
          item_id: 55,
          quantity: -1,
          type: 'wastage',
          reason: 'OTHER',
          notes: '',
        },
        {
          sub: 45,
          client_id: 'CL-1',
          branch_id: 2,
          active_branch_id: 2,
          allowed_branches: [{ branch_id: 2, branch_name: 'Branch A', approval_authority: 'branch' }],
          effective_permissions: [ 'wastage.approve.branch' ],
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('posts billed receipts into accounts payable instead of GRN accrual', async () => {
    const {
      service,
      poRepo,
      branchRepo,
      itemRepo,
      grnRepo,
      accountingService,
      manager,
    } = createService();

    branchRepo.findOne.mockResolvedValue({ id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store', branch_code: 'CEN' });
    branchRepo.count.mockResolvedValue(0);
    itemRepo.findOne.mockResolvedValue({ id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true });
    poRepo.findOne.mockResolvedValue({
      id: 99,
      client_id: 'CL-1',
      branch_id: 1,
      destination_branch_id: 2,
      approval_status: 'approved',
      status: 'sent',
      legacy_status: 'ordered',
      vendor_id: 7,
      items: [{ id: 11, item_id: 55, quantity: 4, unit_cost: 3.5 }],
      destination_branch: { id: 2, client_id: 'CL-1', status: 'active', branch_name: 'Central Store' },
      branch: { id: 1, client_id: 'CL-1', status: 'active', branch_name: 'Branch A' },
    });
    grnRepo.findOne.mockResolvedValue({
      id: 502,
      client_id: 'CL-1',
      branch_id: 2,
      purchase_order_id: 99,
      vendor_id: 7,
      grn_number: 'GRN-CEN-202603-0002',
      receipt_date: new Date('2026-03-26T13:00:00.000Z'),
      status: 'posted',
      payable_status: 'bill_received',
      vendor_invoice_number: 'BILL-22',
      vendor_bill_reference: 'BILL-22',
      vendor_bill_date: new Date('2026-03-26'),
      vendor_bill_due_date: new Date('2026-04-10'),
      notes: null,
      received_by: null,
      received_by_name: 'System',
      branch: { id: 2, branch_name: 'Central Store', branch_code: 'CEN', inventory_store_type: 'central' },
      vendor: { id: 7, vendor_name: 'Metro' },
      purchase_order: { id: 99, po_number: 'PO-99', status: 'received', approval_status: 'approved' },
      items: [{
        id: 2,
        po_item_id: 11,
        item_id: 55,
        ordered_quantity: 4,
        received_quantity: 4,
        unit_cost: 3.5,
        line_total: 14,
        notes: null,
        item: { item_name: 'Fresh Tomatoes', item_sku: 'TOM-001' },
      }],
      created_at: new Date(),
      updated_at: new Date(),
    });
    manager.findOne.mockImplementation(async (entity) => {
      if (entity === InventoryItem) {
        return { id: 55, client_id: 'CL-1', item_name: 'Fresh Tomatoes', item_is_active: true };
      }
      if (entity === StockLevel) {
        return null;
      }
      return null;
    });

    const result = await service.receiveStock('CL-1', 2, {
      branch_id: 2,
      po_id: 99,
      vendor_bill_reference: 'BILL-22',
      vendor_bill_date: '2026-03-26',
      vendor_bill_due_date: '2026-04-10',
      items: [{ item_id: 55, quantity: 4, unit_cost: 3.5 }],
    });

    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      2,
      expect.objectContaining({
        description: 'GRN-CEN-202603-0002 Receipt (Vendor Bill Received)',
        items: expect.arrayContaining([
          expect.objectContaining({ account_id: '1300', debit: 14, credit: 0 }),
          expect.objectContaining({ account_id: '2100', debit: 0, credit: 14 }),
        ]),
      }),
    );
    expect(result.payable.liability_account_code).toBe('2100');
  });

  it('captures vendor bill for pending GRN and reclasses GRNI to accounts payable', async () => {
    const {
      service,
      branchRepo,
      grnRepo,
      accountingService,
      operationalAuditService,
    } = createService();

    branchRepo.findOne.mockResolvedValue({
      id: 2,
      client_id: 'CL-1',
      status: 'active',
      branch_name: 'Central Store',
      branch_code: 'CEN',
    });
    branchRepo.count.mockResolvedValue(0);

    grnRepo.findOne
      .mockResolvedValueOnce({
        id: 700,
        client_id: 'CL-1',
        branch_id: 2,
        grn_number: 'GRN-CEN-202604-0007',
        payable_status: 'pending_bill',
        vendor_bill_reference: null,
        vendor_invoice_number: null,
        vendor_bill_date: null,
        vendor_bill_due_date: null,
        notes: null,
        items: [
          { line_total: 35 },
          { line_total: 15 },
        ],
      })
      .mockResolvedValueOnce({
        id: 700,
        client_id: 'CL-1',
        branch_id: 2,
        purchase_order_id: 99,
        vendor_id: 7,
        grn_number: 'GRN-CEN-202604-0007',
        receipt_date: new Date('2026-04-20T12:00:00.000Z'),
        status: 'posted',
        payable_status: 'bill_received',
        vendor_invoice_number: 'BILL-700',
        vendor_bill_reference: 'BILL-700',
        vendor_bill_date: new Date('2026-04-21'),
        vendor_bill_due_date: new Date('2026-05-05'),
        notes: 'Invoice received',
        received_by: null,
        received_by_name: 'System',
        branch: { id: 2, branch_name: 'Central Store', branch_code: 'CEN', inventory_store_type: 'central' },
        vendor: { id: 7, vendor_name: 'Metro' },
        purchase_order: { id: 99, po_number: 'PO-99', status: 'received', approval_status: 'approved' },
        items: [{
          id: 1,
          po_item_id: 11,
          item_id: 55,
          ordered_quantity: 10,
          received_quantity: 10,
          unit_cost: 5,
          line_total: 50,
          notes: null,
          item: { item_name: 'Fresh Tomatoes', item_sku: 'TOM-001' },
        }],
        created_at: new Date(),
        updated_at: new Date(),
      });
    grnRepo.save = jest.fn(async (entity) => entity);

    const result = await service.captureVendorBill(
      'CL-1',
      700,
      {
        vendor_bill_reference: 'BILL-700',
        vendor_bill_date: '2026-04-21',
        vendor_bill_due_date: '2026-05-05',
        notes: 'Invoice received',
      },
      {
        sub: 12,
        client_id: 'CL-1',
        branch_id: 2,
        active_branch_id: 2,
        allowed_branches: [{ branch_id: 2, branch_name: 'Central Store', approval_authority: 'branch' }],
        effective_permissions: ['inventory.create.branch'],
      },
      [2],
    );

    expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
      'CL-1',
      2,
      expect.objectContaining({
        description: 'GRN-CEN-202604-0007 Vendor Bill Received',
        reference_id: 'BILL-700',
        source_event: 'grn_bill_received',
        items: expect.arrayContaining([
          expect.objectContaining({ account_id: '2110', debit: 50, credit: 0 }),
          expect.objectContaining({ account_id: '2100', debit: 0, credit: 50 }),
        ]),
      }),
    );
    expect(operationalAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GRN Vendor Bill Captured',
        branchId: 2,
      }),
    );
    expect(result.payable_status).toBe('bill_received');
    expect(result.payable.liability_account_code).toBe('2100');
  });

  it('blocks duplicate vendor bill references for the same vendor', async () => {
    const {
      service,
      branchRepo,
      grnRepo,
    } = createService();

    branchRepo.findOne.mockResolvedValue({
      id: 2,
      client_id: 'CL-1',
      status: 'active',
      branch_name: 'Central Store',
      branch_code: 'CEN',
    });
    grnRepo.findOne
      .mockResolvedValueOnce({
        id: 501,
        client_id: 'CL-1',
        branch_id: 2,
        vendor_id: 7,
        grn_number: 'GRN-CEN-202604-0007',
        payable_status: 'pending_bill',
        vendor_bill_reference: null,
        vendor_invoice_number: null,
        vendor_bill_date: null,
        vendor_bill_due_date: null,
        notes: null,
        items: [{ line_total: 14 }],
      })
      .mockResolvedValueOnce({
        id: 488,
        client_id: 'CL-1',
        branch_id: 2,
        vendor_id: 7,
        grn_number: 'GRN-CEN-202604-0002',
        payable_status: 'bill_received',
        vendor_bill_reference: 'BILL-700',
      });

    await expect(
      service.captureVendorBill('CL-1', 501, {
        vendor_bill_reference: 'BILL-700',
        vendor_bill_date: '2026-04-21',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
