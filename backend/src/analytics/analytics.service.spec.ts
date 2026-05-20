import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

function createRepoMock() {
  return {
    find: jest.fn(),
  };
}

describe('AnalyticsService', () => {
  function createService() {
    const branchRepo = createRepoMock();
    const orderRepo = createRepoMock();
    const orderItemRepo = createRepoMock();
    const branchInventoryRepo = createRepoMock();
    const purchaseOrderRepo = createRepoMock();
    const purchaseOrderItemRepo = createRepoMock();
    const procurementRequestRepo = createRepoMock();
    const procurementRequestItemRepo = createRepoMock();
    const transferRepo = createRepoMock();
    const transferItemRepo = createRepoMock();
    const shiftRepo = createRepoMock();
    const stockLedgerRepo = createRepoMock();
    const categoryRepo = createRepoMock();
    const inventoryClassRepo = createRepoMock();

    const service = new AnalyticsService(
      branchRepo as any,
      orderRepo as any,
      orderItemRepo as any,
      branchInventoryRepo as any,
      purchaseOrderRepo as any,
      purchaseOrderItemRepo as any,
      procurementRequestRepo as any,
      procurementRequestItemRepo as any,
      transferRepo as any,
      transferItemRepo as any,
      shiftRepo as any,
      stockLedgerRepo as any,
      categoryRepo as any,
      inventoryClassRepo as any,
    );

    return {
      service,
      branchRepo,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a branch-scoped operations overview from aggregated source rows', async () => {
    const { service, branchRepo } = createService();

    branchRepo.find.mockResolvedValue([
      {
        id: 2,
        branch_name: 'Central Store',
        branch_code: 'BR-002',
        status: 'active',
        inventory_store_type: 'central',
      },
      {
        id: 3,
        branch_name: 'Downtown',
        branch_code: 'BR-003',
        status: 'active',
        inventory_store_type: 'branch',
      },
    ]);

    jest.spyOn(service as any, 'loadSalesRows').mockResolvedValue([
      {
        branch_id: 2,
        sales_total: 1500,
        completed_orders: 10,
        last_sale_at: '2026-03-19T12:00:00.000Z',
      },
      {
        branch_id: 3,
        sales_total: 900,
        completed_orders: 6,
        last_sale_at: '2026-03-18T16:00:00.000Z',
      },
    ]);
    jest.spyOn(service as any, 'loadOpenOrderRows').mockResolvedValue([
      {
        branch_id: 2,
        open_orders: 2,
      },
      {
        branch_id: 3,
        open_orders: 1,
      },
    ]);
    jest.spyOn(service as any, 'loadInventoryRows').mockResolvedValue([
      {
        branch_id: 2,
        enabled_item_count: 20,
        stocked_item_count: 15,
        on_hand_quantity: 120,
        low_stock_count: 4,
        out_of_stock_count: 1,
        negative_stock_count: 0,
      },
      {
        branch_id: 3,
        enabled_item_count: 12,
        stocked_item_count: 10,
        on_hand_quantity: 45,
        low_stock_count: 2,
        out_of_stock_count: 0,
        negative_stock_count: 1,
      },
    ]);
    jest.spyOn(service as any, 'loadProcurementRequestRows').mockResolvedValue([
      {
        branch_id: 2,
        requests_raised: 3,
        pending_requests: 1,
        approved_requests: 1,
        rejected_requests: 0,
        converted_requests: 1,
      },
      {
        branch_id: 3,
        requests_raised: 2,
        pending_requests: 2,
        approved_requests: 0,
        rejected_requests: 0,
        converted_requests: 0,
      },
    ]);
    jest.spyOn(service as any, 'loadPurchaseOrderRows').mockResolvedValue([
      {
        branch_id: 2,
        purchase_orders_in_period: 4,
        purchase_value: 780,
        open_purchase_orders: 2,
        pending_approval_purchase_orders: 1,
        awaiting_receipt_purchase_orders: 1,
        aged_receipt_backlog: 0,
      },
      {
        branch_id: 3,
        purchase_orders_in_period: 1,
        purchase_value: 210,
        open_purchase_orders: 1,
        pending_approval_purchase_orders: 0,
        awaiting_receipt_purchase_orders: 1,
        aged_receipt_backlog: 1,
      },
    ]);
    jest.spyOn(service as any, 'loadTransferOutgoingRows').mockResolvedValue([
      {
        branch_id: 2,
        period_transfer_count: 2,
        outgoing_open_count: 1,
        outgoing_in_transit_count: 1,
        bottleneck_count: 0,
      },
    ]);
    jest.spyOn(service as any, 'loadTransferIncomingRows').mockResolvedValue([
      {
        branch_id: 3,
        period_transfer_count: 3,
        incoming_open_count: 2,
        incoming_in_transit_count: 1,
        received_with_variance_count: 1,
        bottleneck_count: 2,
      },
    ]);
    jest.spyOn(service as any, 'loadShiftRows').mockResolvedValue([
      {
        branch_id: 2,
        open_shift_count: 1,
        shift_variance_count: 0,
        worst_shift_variance: 0,
      },
      {
        branch_id: 3,
        open_shift_count: 1,
        shift_variance_count: 1,
        worst_shift_variance: 35.5,
      },
    ]);
    jest.spyOn(service as any, 'loadInventoryMovementRows').mockResolvedValue([
      {
        branch_id: 2,
        wastage_event_count: 1,
        wastage_quantity: 3,
        wastage_cost: 120,
        adjustment_event_count: 1,
        positive_adjustment_quantity: 2,
        negative_adjustment_quantity: 1,
        adjustment_cost_impact: -18,
        estimated_cogs: 640,
      },
      {
        branch_id: 3,
        wastage_event_count: 2,
        wastage_quantity: 5,
        wastage_cost: 210,
        adjustment_event_count: 2,
        positive_adjustment_quantity: 1,
        negative_adjustment_quantity: 2,
        adjustment_cost_impact: -22,
        estimated_cogs: 390,
      },
    ]);

    const result = await service.getOperationsOverview('CL-1', [2, 3], {
      date_from: '2026-03-01',
      date_to: '2026-03-19',
    });

    expect(result.summary.branch_count).toBe(2);
    expect(result.summary.total_revenue).toBe(2400);
    expect(result.summary.completed_orders).toBe(16);
    expect(result.sales_summary.total_revenue).toBe(2400);
    expect(result.procurement_summary.pending_requests).toBe(3);
    expect(result.transfer_summary.bottleneck_count).toBe(2);
    expect(result.access_scope.authorized_branch_count).toBe(2);
    expect(result.branches.map((branch: any) => branch.branch_id)).toEqual([2, 3]);
    expect(result.comparisons.revenue_ranking[0].branch_id).toBe(2);
    expect(
      result.exceptions.some(
        (exception: any) =>
          exception.branch_id === 3 && exception.category === 'inventory',
      ),
    ).toBe(true);
    expect(
      result.exceptions.some(
        (exception: any) =>
          exception.branch_id === 3 && exception.category === 'transfers',
      ),
    ).toBe(true);
  });

  it('intersects requested branch filters with authorized scope before aggregating totals', async () => {
    const { service, branchRepo } = createService();

    branchRepo.find.mockResolvedValueOnce([
      {
        id: 2,
        branch_name: 'Central Store',
        branch_code: 'BR-002',
        status: 'active',
        inventory_store_type: 'central',
        is_production_source: true,
        production_source_label: 'Central Kitchen',
      },
      {
        id: 3,
        branch_name: 'Downtown',
        branch_code: 'BR-003',
        status: 'active',
        inventory_store_type: 'branch',
        is_production_source: false,
        production_source_label: null,
      },
    ]);
    branchRepo.find.mockResolvedValueOnce([
      {
        id: 3,
        branch_name: 'Downtown',
        branch_code: 'BR-003',
        status: 'active',
        inventory_store_type: 'branch',
        is_production_source: false,
        production_source_label: null,
      },
    ]);

    jest.spyOn(service as any, 'loadSalesRows').mockResolvedValue([
      {
        branch_id: 3,
        sales_total: 900,
        completed_orders: 6,
        last_sale_at: '2026-03-18T16:00:00.000Z',
      },
    ]);
    jest.spyOn(service as any, 'loadOpenOrderRows').mockResolvedValue([
      {
        branch_id: 3,
        open_orders: 1,
      },
    ]);
    jest.spyOn(service as any, 'loadInventoryRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadProcurementRequestRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadPurchaseOrderRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadTransferOutgoingRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadTransferIncomingRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadShiftRows').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadInventoryMovementRows').mockResolvedValue([]);

    const result = await service.getOperationsOverview('CL-1', [2, 3], {
      date_from: '2026-03-01',
      date_to: '2026-03-19',
      branch_ids: [3, 99],
    });

    expect(result.filters_applied.requested_branch_ids).toEqual([3, 99]);
    expect(result.filters_applied.resolved_branch_ids).toEqual([3]);
    expect(result.summary.branch_count).toBe(1);
    expect(result.summary.total_revenue).toBe(900);
    expect(result.branch_options.map((branch: any) => branch.branch_id)).toEqual([2, 3]);
  });

  it('blocks drill-down when the branch is outside the reporting scope', async () => {
    const { service, branchRepo } = createService();

    branchRepo.find.mockResolvedValue([]);

    await expect(
      service.getBranchOperationsDetail('CL-1', 99, [2], {
        date_from: '2026-03-01',
        date_to: '2026-03-19',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('builds management KPIs from overview aggregates and revenue series', async () => {
    const { service } = createService();

    jest.spyOn(service as any, 'buildOverview').mockResolvedValue({
      generated_at: '2026-04-28T09:00:00.000Z',
      date_range: {
        date_from: '2026-04-01',
        date_to: '2026-04-07',
        label: '2026-04-01 to 2026-04-07',
      },
      filters_applied: {
        resolved_branch_ids: [2, 3],
      },
      access_scope: {
        authorized_branch_count: 2,
      },
      summary: {
        total_revenue: 2400,
        completed_orders: 16,
        average_order_value: 150,
        low_stock_items: 5,
        out_of_stock_items: 1,
        negative_stock_items: 1,
        transfer_bottlenecks: 2,
        open_shifts: 2,
      },
      profitability_summary: {
        estimated_gross_margin: 880,
        estimated_gross_margin_pct: 36.67,
      },
      procurement_summary: {
        pending_requests: 2,
        pending_approval_purchase_orders: 1,
        awaiting_receipt_purchase_orders: 1,
      },
      comparisons: {
        revenue_ranking: [{ branch_id: 2 }],
        gross_margin_ranking: [{ branch_id: 3 }],
        inventory_pressure_ranking: [{ branch_id: 3 }],
        procurement_backlog_ranking: [{ branch_id: 2 }],
      },
      exceptions: [
        { branch_id: 3, category: 'inventory', severity: 'critical' },
      ],
      exports: {
        branch_summary_rows: [{ branch_id: 2 }],
      },
    });
    jest.spyOn(service as any, 'loadDailyRevenueSeries').mockResolvedValue([
      { business_date: '2026-04-01', total_revenue: 400, completed_orders: 3 },
      { business_date: '2026-04-02', total_revenue: 500, completed_orders: 4 },
      { business_date: '2026-04-03', total_revenue: 600, completed_orders: 5 },
      { business_date: '2026-04-04', total_revenue: 900, completed_orders: 4 },
    ]);

    const result = await service.getManagementKpis('CL-1', [2, 3], {
      date_from: '2026-04-01',
      date_to: '2026-04-07',
    });

    expect(result.summary_cards.total_revenue).toBe(2400);
    expect(result.summary_cards.procurement_backlog).toBe(4);
    expect(result.summary_cards.inventory_pressure).toBe(7);
    expect(result.attention.branches_with_exceptions).toBe(1);
    expect(result.branch_rankings.revenue[0].branch_id).toBe(2);
    expect(result.revenue_series).toHaveLength(7);
    expect(result.exports.branch_summary_rows).toEqual([{ branch_id: 2 }]);
  });

  it('maps branch metrics from branch operations detail', async () => {
    const { service } = createService();

    jest.spyOn(service, 'getBranchOperationsDetail').mockResolvedValue({
      sales: {
        total_revenue: 1800,
        completed_orders: 12,
        average_order_value: 150,
        open_orders: 3,
      },
      top_items: [
        { product_name: 'Signature Bowl', quantity_sold: 8, revenue: 640 },
      ],
      inventory: {
        enabled_item_count: 20,
        low_stock_count: 4,
        out_of_stock_count: 1,
      },
      inventory_movements: {
        wastage_cost: 95,
        adjustment_cost_impact: -12,
      },
      procurement: {
        pending_requests: 2,
        pending_approval_purchase_orders: 1,
        awaiting_receipt_purchase_orders: 1,
      },
      profitability: {
        available: true,
        estimated_gross_margin: 520,
        estimated_gross_margin_pct: 28.9,
      },
    } as any);

    const result = await service.getBranchMetrics('CL-1', 2, [2], {
      date_from: '2026-04-01',
      date_to: '2026-04-07',
    });

    expect(result.dailyRevenue).toBe(1800);
    expect(result.totalOrders).toBe(12);
    expect(result.lowStockItems).toBe(4);
    expect(result.procurementBacklog).toBe(4);
    expect(result.topProducts[0]).toEqual({
      name: 'Signature Bowl',
      count: 8,
      revenue: 640,
    });
    expect(result.profitabilityAvailable).toBe(true);
  });
});
