import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Branch } from '../setup/entities/branch.entity';
import { Order } from '../pos/entities/order.entity';
import { OrderItem } from '../pos/entities/order-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { PurchaseOrder } from '../inventory-op/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../inventory-op/entities/purchase-order-item.entity';
import { ProcurementRequest } from '../inventory-op/entities/procurement-request.entity';
import { ProcurementRequestItem } from '../inventory-op/entities/procurement-request-item.entity';
import { InventoryTransfer } from '../inventory-op/entities/inventory-transfer.entity';
import { InventoryTransferItem } from '../inventory-op/entities/inventory-transfer-item.entity';
import { Shift } from '../pos/entities/shift.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { Category } from '../catalog/entities/category.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';

interface OperationsFilters {
  date_from?: string;
  date_to?: string;
  branch_ids?: number[];
  sales_category_ids?: number[];
  inventory_class_ids?: number[];
}

interface OperationsDateRange {
  start: Date;
  end: Date;
  date_from: string;
  date_to: string;
  label: string;
}

export interface ReportingFilterOption {
  id: number;
  name: string;
}

interface BranchOperationsSummary {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  status: string;
  inventory_store_type: string;
  sales: {
    total_revenue: number;
    completed_orders: number;
    average_order_value: number;
    open_orders: number;
    last_sale_at: Date | null;
  };
  inventory: {
    enabled_item_count: number;
    stocked_item_count: number;
    on_hand_quantity: number;
    low_stock_count: number;
    out_of_stock_count: number;
    negative_stock_count: number;
  };
  procurement: {
    requests_raised: number;
    pending_requests: number;
    approved_requests: number;
    rejected_requests: number;
    converted_requests: number;
    purchase_orders_in_period: number;
    purchase_value: number;
    open_purchase_orders: number;
    pending_approval_purchase_orders: number;
    awaiting_receipt_purchase_orders: number;
    aged_receipt_backlog: number;
  };
  transfers: {
    period_transfer_count: number;
    incoming_open_count: number;
    outgoing_open_count: number;
    incoming_in_transit_count: number;
    outgoing_in_transit_count: number;
    received_with_variance_count: number;
    bottleneck_count: number;
  };
  operations: {
    open_shift_count: number;
    shift_variance_count: number;
    worst_shift_variance: number;
  };
  inventory_movements: {
    wastage_event_count: number;
    wastage_quantity: number;
    wastage_cost: number;
    adjustment_event_count: number;
    positive_adjustment_quantity: number;
    negative_adjustment_quantity: number;
    adjustment_cost_impact: number;
  };
  profitability: {
    available: boolean;
    unavailable_reason: string | null;
    estimated_cogs: number | null;
    estimated_gross_margin: number | null;
    estimated_gross_margin_pct: number | null;
  };
}

export interface BranchOperationsException {
  branch_id: number;
  branch_name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category:
    | 'inventory'
    | 'procurement'
    | 'receiving'
    | 'transfers'
    | 'cash'
    | 'wastage';
  message: string;
  metric_value: number;
  route: string;
}

export interface OperationsBranchOption {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  status: string;
  inventory_store_type: string;
  is_production_source: boolean;
  production_source_label: string | null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(ProcurementRequest)
    private readonly procurementRequestRepo: Repository<ProcurementRequest>,
    @InjectRepository(ProcurementRequestItem)
    private readonly procurementRequestItemRepo: Repository<ProcurementRequestItem>,
    @InjectRepository(InventoryTransfer)
    private readonly transferRepo: Repository<InventoryTransfer>,
    @InjectRepository(InventoryTransferItem)
    private readonly transferItemRepo: Repository<InventoryTransferItem>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(InventoryClass)
    private readonly inventoryClassRepo: Repository<InventoryClass>,
  ) {}

  private toNumber(value: unknown, precision = 4): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Number(parsed.toFixed(precision));
  }

  private toInteger(value: unknown): number {
    return Math.trunc(this.toNumber(value, 0));
  }

  private parseBoundaryDate(value: string, endOfDay = false): Date {
    const normalized = new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`,
    );

    if (Number.isNaN(normalized.getTime())) {
      throw new BadRequestException('Invalid reporting date filter.');
    }

    return normalized;
  }

  private resolveDateRange(filters?: OperationsFilters): OperationsDateRange {
    const end = filters?.date_to
      ? this.parseBoundaryDate(filters.date_to, true)
      : new Date();
    const start = filters?.date_from
      ? this.parseBoundaryDate(filters.date_from)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);

    if (start > end) {
      throw new BadRequestException('date_from cannot be after date_to.');
    }

    const dateFrom = start.toISOString().slice(0, 10);
    const dateTo = end.toISOString().slice(0, 10);

    return {
      start,
      end,
      date_from: dateFrom,
      date_to: dateTo,
      label: `${dateFrom} to ${dateTo}`,
    };
  }

  private calculateAgeDays(dateValue: unknown): number {
    if (!dateValue) {
      return 0;
    }

    const date = new Date(String(dateValue));
    if (Number.isNaN(date.getTime())) {
      return 0;
    }

    const diffMs = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  private normalizeIds(ids?: number[]): number[] {
    return Array.from(
      new Set(
        (ids ?? []).filter((id) => Number.isInteger(id) && Number(id) > 0),
      ),
    );
  }

  private normalizeBranchIds(branchIds?: number[]): number[] {
    return this.normalizeIds(branchIds);
  }

  private normalizeSalesCategoryIds(categoryIds?: number[]): number[] {
    return this.normalizeIds(categoryIds);
  }

  private normalizeInventoryClassIds(classIds?: number[]): number[] {
    return this.normalizeIds(classIds);
  }

  private isCategoryFiltered(filters?: OperationsFilters): boolean {
    return (
      this.normalizeSalesCategoryIds(filters?.sales_category_ids).length > 0 ||
      this.normalizeInventoryClassIds(filters?.inventory_class_ids).length > 0
    );
  }

  private canComputeProfitability(filters?: OperationsFilters): boolean {
    return !this.isCategoryFiltered(filters);
  }

  private profitabilityUnavailableReason(filters?: OperationsFilters): string | null {
    return this.canComputeProfitability(filters)
      ? null
      : 'Simplified gross margin is only exposed on the full branch scope because category filters do not align revenue and stock-cost sources one-to-one yet.';
  }

  private createBranchSummary(
    branch: Branch,
    profitabilityReason: string | null,
  ): BranchOperationsSummary {
    return {
      branch_id: branch.id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      status: branch.status,
      inventory_store_type: branch.inventory_store_type,
      sales: {
        total_revenue: 0,
        completed_orders: 0,
        average_order_value: 0,
        open_orders: 0,
        last_sale_at: null,
      },
      inventory: {
        enabled_item_count: 0,
        stocked_item_count: 0,
        on_hand_quantity: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        negative_stock_count: 0,
      },
      procurement: {
        requests_raised: 0,
        pending_requests: 0,
        approved_requests: 0,
        rejected_requests: 0,
        converted_requests: 0,
        purchase_orders_in_period: 0,
        purchase_value: 0,
        open_purchase_orders: 0,
        pending_approval_purchase_orders: 0,
        awaiting_receipt_purchase_orders: 0,
        aged_receipt_backlog: 0,
      },
      transfers: {
        period_transfer_count: 0,
        incoming_open_count: 0,
        outgoing_open_count: 0,
        incoming_in_transit_count: 0,
        outgoing_in_transit_count: 0,
        received_with_variance_count: 0,
        bottleneck_count: 0,
      },
      operations: {
        open_shift_count: 0,
        shift_variance_count: 0,
        worst_shift_variance: 0,
      },
      inventory_movements: {
        wastage_event_count: 0,
        wastage_quantity: 0,
        wastage_cost: 0,
        adjustment_event_count: 0,
        positive_adjustment_quantity: 0,
        negative_adjustment_quantity: 0,
        adjustment_cost_impact: 0,
      },
      profitability: {
        available: profitabilityReason === null,
        unavailable_reason: profitabilityReason,
        estimated_cogs: profitabilityReason === null ? 0 : null,
        estimated_gross_margin: profitabilityReason === null ? 0 : null,
        estimated_gross_margin_pct: profitabilityReason === null ? 0 : null,
      },
    };
  }

  private async loadBranches(
    clientId: string,
    accessibleBranchIds?: number[],
    branchId?: number,
    requestedBranchIds?: number[],
  ): Promise<Branch[]> {
    const normalizedRequestedBranchIds =
      this.normalizeBranchIds(requestedBranchIds);
    const normalizedAccessibleBranchIds =
      this.normalizeBranchIds(accessibleBranchIds);
    let scopedBranchIds = branchId ? [branchId] : normalizedRequestedBranchIds;

    if (normalizedAccessibleBranchIds.length > 0) {
      if (branchId && !normalizedAccessibleBranchIds.includes(branchId)) {
        return [];
      }

      scopedBranchIds =
        scopedBranchIds.length > 0
          ? scopedBranchIds.filter((candidate) =>
              normalizedAccessibleBranchIds.includes(candidate),
            )
          : normalizedAccessibleBranchIds;
    }

    const where: Record<string, unknown> = { client_id: clientId };

    if (scopedBranchIds.length > 0) {
      where.id = In(scopedBranchIds);
    }

    return this.branchRepo.find({
      where,
      order: {
        branch_name: 'ASC',
      },
    });
  }

  private buildBranchOption(branch: Branch): OperationsBranchOption {
    return {
      branch_id: branch.id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      status: branch.status,
      inventory_store_type: branch.inventory_store_type,
      is_production_source: branch.is_production_source,
      production_source_label: branch.production_source_label,
    };
  }

  private async loadSalesCategoryOptions(
    clientId: string,
  ): Promise<ReportingFilterOption[]> {
    const categories = await this.categoryRepo.find({
      where: { client_id: clientId, is_active: true },
      order: { category_name: 'ASC' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.category_name,
    }));
  }

  private async loadInventoryClassOptions(
    clientId: string,
  ): Promise<ReportingFilterOption[]> {
    const inventoryClasses = await this.inventoryClassRepo.find({
      where: { client_id: clientId, is_active: true },
      order: { class_name: 'ASC' },
    });

    return inventoryClasses.map((inventoryClass) => ({
      id: inventoryClass.id,
      name: inventoryClass.class_name,
    }));
  }

  private applyTransferInventoryClassFilter(
    query: SelectQueryBuilder<InventoryTransfer>,
    transferAlias: string,
    inventoryClassIds: number[],
  ) {
    if (inventoryClassIds.length === 0) {
      return;
    }

    query.andWhere((qb) => {
      const subQuery = qb
        .subQuery()
        .select('1')
        .from(InventoryTransferItem, 'transfer_item')
        .innerJoin('transfer_item.item', 'item')
        .innerJoin('item.subType', 'sub_type')
        .innerJoin('sub_type.inventoryType', 'inventory_type')
        .where(`transfer_item.transfer_id = ${transferAlias}.id`)
        .andWhere('inventory_type.class_id IN (:...inventoryClassIds)')
        .getQuery();

      return `EXISTS ${subQuery}`;
    });
  }

  private async loadSalesRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const salesCategoryIds = this.normalizeSalesCategoryIds(
      filters?.sales_category_ids,
    );

    if (salesCategoryIds.length === 0) {
      return this.orderRepo
        .createQueryBuilder('order')
        .select('order.branch_id', 'branch_id')
        .addSelect(
          `SUM(CASE
              WHEN order.order_status = 'completed'
               AND order.created_at >= :start
               AND order.created_at <= :end
              THEN 1 ELSE 0 END)`,
          'completed_orders',
        )
        .addSelect(
          `COALESCE(SUM(CASE
              WHEN order.order_status = 'completed'
               AND order.created_at >= :start
               AND order.created_at <= :end
              THEN order.total_amount ELSE 0 END), 0)`,
          'sales_total',
        )
        .addSelect(
          `MAX(CASE
              WHEN order.order_status = 'completed'
               AND order.created_at >= :start
               AND order.created_at <= :end
              THEN order.created_at ELSE NULL END)`,
          'last_sale_at',
        )
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id IN (:...branchIds)', { branchIds })
        .setParameters({ start: range.start, end: range.end })
        .groupBy('order.branch_id')
        .getRawMany();
    }

    return this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .select('order.branch_id', 'branch_id')
      .addSelect('COUNT(DISTINCT order.id)', 'completed_orders')
      .addSelect(
        'COALESCE(SUM(item.quantity * item.item_price), 0)',
        'sales_total',
      )
      .addSelect('MAX(order.created_at)', 'last_sale_at')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .andWhere('order.created_at >= :start', { start: range.start })
      .andWhere('order.created_at <= :end', { end: range.end })
      .andWhere('product.category_id IN (:...salesCategoryIds)', {
        salesCategoryIds,
      })
      .groupBy('order.branch_id')
      .getRawMany();
  }

  private async loadOpenOrderRows(clientId: string, branchIds: number[]) {
    if (branchIds.length === 0) {
      return [];
    }

    return this.orderRepo
      .createQueryBuilder('order')
      .select('order.branch_id', 'branch_id')
      .addSelect(
        `SUM(CASE
            WHEN order.order_status NOT IN ('completed', 'cancelled', 'voided')
            THEN 1 ELSE 0 END)`,
        'open_orders',
      )
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id IN (:...branchIds)', { branchIds })
      .groupBy('order.branch_id')
      .getRawMany();
  }

  private async loadInventoryRows(
    clientId: string,
    branchIds: number[],
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.branchInventoryRepo
      .createQueryBuilder('branch_inventory')
      .innerJoin('branch_inventory.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .select('branch_inventory.branch_id', 'branch_id')
      .addSelect('COUNT(branch_inventory.id)', 'enabled_item_count')
      .addSelect(
        `SUM(CASE
            WHEN COALESCE(stock.current_quantity, 0) > 0
            THEN 1 ELSE 0 END)`,
        'stocked_item_count',
      )
      .addSelect(
        'COALESCE(SUM(COALESCE(stock.current_quantity, 0)), 0)',
        'on_hand_quantity',
      )
      .addSelect(
        `SUM(CASE
            WHEN branch_inventory.min_stock_level > 0
             AND COALESCE(stock.current_quantity, 0) <= branch_inventory.min_stock_level
            THEN 1 ELSE 0 END)`,
        'low_stock_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN COALESCE(stock.current_quantity, 0) <= 0
            THEN 1 ELSE 0 END)`,
        'out_of_stock_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN COALESCE(stock.current_quantity, 0) < 0
            THEN 1 ELSE 0 END)`,
        'negative_stock_count',
      )
      .leftJoin(
        StockLevel,
        'stock',
        [
          'stock.client_id = :clientId',
          'stock.branch_id = branch_inventory.branch_id',
          'stock.item_id = branch_inventory.item_id',
        ].join(' AND '),
        { clientId },
      )
      .where('branch_inventory.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('branch_inventory.is_enabled = :enabled', { enabled: true });

    if (inventoryClassIds.length > 0) {
      query.andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      });
    }

    return query.groupBy('branch_inventory.branch_id').getRawMany();
  }

  private async loadProcurementRequestRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    if (inventoryClassIds.length === 0) {
      return this.procurementRequestRepo
        .createQueryBuilder('request')
        .select('request.requesting_branch_id', 'branch_id')
        .addSelect(
          `SUM(CASE
              WHEN request.created_at >= :start
               AND request.created_at <= :end
              THEN 1 ELSE 0 END)`,
          'requests_raised',
        )
        .addSelect(
          `SUM(CASE WHEN request.status = 'pending' THEN 1 ELSE 0 END)`,
          'pending_requests',
        )
        .addSelect(
          `SUM(CASE WHEN request.status = 'approved' THEN 1 ELSE 0 END)`,
          'approved_requests',
        )
        .addSelect(
          `SUM(CASE WHEN request.status = 'rejected' THEN 1 ELSE 0 END)`,
          'rejected_requests',
        )
        .addSelect(
          `SUM(CASE WHEN request.status = 'converted' THEN 1 ELSE 0 END)`,
          'converted_requests',
        )
        .where('request.client_id = :clientId', { clientId })
        .andWhere('request.requesting_branch_id IN (:...branchIds)', {
          branchIds,
        })
        .setParameters({ start: range.start, end: range.end })
        .groupBy('request.requesting_branch_id')
        .getRawMany();
    }

    return this.procurementRequestItemRepo
      .createQueryBuilder('request_item')
      .innerJoin('request_item.request', 'request')
      .innerJoin('request_item.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .select('request.requesting_branch_id', 'branch_id')
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN request.created_at >= :start
             AND request.created_at <= :end
            THEN request.id ELSE NULL END)`,
        'requests_raised',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN request.status = 'pending' THEN request.id ELSE NULL END)`,
        'pending_requests',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN request.status = 'approved' THEN request.id ELSE NULL END)`,
        'approved_requests',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN request.status = 'rejected' THEN request.id ELSE NULL END)`,
        'rejected_requests',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN request.status = 'converted' THEN request.id ELSE NULL END)`,
        'converted_requests',
      )
      .where('request.client_id = :clientId', { clientId })
      .andWhere('request.requesting_branch_id IN (:...branchIds)', {
        branchIds,
      })
      .andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      })
      .setParameters({ start: range.start, end: range.end })
      .groupBy('request.requesting_branch_id')
      .getRawMany();
  }

  private async loadPurchaseOrderRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    backlogCutoff: Date,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    if (inventoryClassIds.length === 0) {
      return this.purchaseOrderRepo
        .createQueryBuilder('po')
        .select('COALESCE(po.destination_branch_id, po.branch_id)', 'branch_id')
        .addSelect(
          `SUM(CASE
              WHEN po.created_at >= :start
               AND po.created_at <= :end
              THEN 1 ELSE 0 END)`,
          'purchase_orders_in_period',
        )
        .addSelect(
          `COALESCE(SUM(CASE
              WHEN po.created_at >= :start
               AND po.created_at <= :end
              THEN po.total_amount ELSE 0 END), 0)`,
          'purchase_value',
        )
        .addSelect(
          `SUM(CASE
              WHEN po.status IN ('draft', 'sent')
              THEN 1 ELSE 0 END)`,
          'open_purchase_orders',
        )
        .addSelect(
          `SUM(CASE
              WHEN po.approval_status = 'pending'
              THEN 1 ELSE 0 END)`,
          'pending_approval_purchase_orders',
        )
        .addSelect(
          `SUM(CASE
              WHEN po.status = 'sent'
               AND po.approval_status = 'approved'
              THEN 1 ELSE 0 END)`,
          'awaiting_receipt_purchase_orders',
        )
        .addSelect(
          `SUM(CASE
              WHEN po.status = 'sent'
               AND po.approval_status = 'approved'
               AND po.updated_at < :backlogCutoff
              THEN 1 ELSE 0 END)`,
          'aged_receipt_backlog',
        )
        .where('po.client_id = :clientId', { clientId })
        .andWhere(
          'COALESCE(po.destination_branch_id, po.branch_id) IN (:...branchIds)',
          { branchIds },
        )
        .setParameters({
          start: range.start,
          end: range.end,
          backlogCutoff,
        })
        .groupBy('COALESCE(po.destination_branch_id, po.branch_id)')
        .getRawMany();
    }

    return this.purchaseOrderItemRepo
      .createQueryBuilder('po_item')
      .innerJoin('po_item.purchase_order', 'po')
      .innerJoin('po_item.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .select('COALESCE(po.destination_branch_id, po.branch_id)', 'branch_id')
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN po.created_at >= :start
             AND po.created_at <= :end
            THEN po.id ELSE NULL END)`,
        'purchase_orders_in_period',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN po.created_at >= :start
             AND po.created_at <= :end
            THEN po_item.line_total ELSE 0 END), 0)`,
        'purchase_value',
      )
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN po.status IN ('draft', 'sent')
            THEN po.id ELSE NULL END)`,
        'open_purchase_orders',
      )
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN po.approval_status = 'pending'
            THEN po.id ELSE NULL END)`,
        'pending_approval_purchase_orders',
      )
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN po.status = 'sent'
             AND po.approval_status = 'approved'
            THEN po.id ELSE NULL END)`,
        'awaiting_receipt_purchase_orders',
      )
      .addSelect(
        `COUNT(DISTINCT CASE
            WHEN po.status = 'sent'
             AND po.approval_status = 'approved'
             AND po.updated_at < :backlogCutoff
            THEN po.id ELSE NULL END)`,
        'aged_receipt_backlog',
      )
      .where('po.client_id = :clientId', { clientId })
      .andWhere(
        'COALESCE(po.destination_branch_id, po.branch_id) IN (:...branchIds)',
        { branchIds },
      )
      .andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      })
      .setParameters({
        start: range.start,
        end: range.end,
        backlogCutoff,
      })
      .groupBy('COALESCE(po.destination_branch_id, po.branch_id)')
      .getRawMany();
  }

  private async loadTransferOutgoingRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    backlogCutoff: Date,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.transferRepo
      .createQueryBuilder('transfer')
      .select('transfer.source_branch_id', 'branch_id')
      .addSelect(
        `SUM(CASE
            WHEN transfer.requested_at >= :start
             AND transfer.requested_at <= :end
            THEN 1 ELSE 0 END)`,
        'period_transfer_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN transfer.status IN ('requested', 'approved', 'in_transit')
            THEN 1 ELSE 0 END)`,
        'outgoing_open_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN transfer.status = 'in_transit'
            THEN 1 ELSE 0 END)`,
        'outgoing_in_transit_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN (
              transfer.status = 'requested'
              AND transfer.requested_at < :backlogCutoff
            ) OR (
              transfer.status = 'approved'
              AND transfer.approved_at IS NOT NULL
              AND transfer.approved_at < :backlogCutoff
            ) OR (
              transfer.status = 'in_transit'
              AND COALESCE(transfer.dispatched_at, transfer.updated_at) < :backlogCutoff
            )
            THEN 1 ELSE 0 END)`,
        'bottleneck_count',
      )
      .where('transfer.client_id = :clientId', { clientId })
      .andWhere('transfer.source_branch_id IN (:...branchIds)', { branchIds })
      .setParameters({
        start: range.start,
        end: range.end,
        backlogCutoff,
      });

    this.applyTransferInventoryClassFilter(query, 'transfer', inventoryClassIds);

    return query.groupBy('transfer.source_branch_id').getRawMany();
  }

  private async loadTransferIncomingRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    backlogCutoff: Date,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.transferRepo
      .createQueryBuilder('transfer')
      .select('transfer.destination_branch_id', 'branch_id')
      .addSelect(
        `SUM(CASE
            WHEN transfer.requested_at >= :start
             AND transfer.requested_at <= :end
            THEN 1 ELSE 0 END)`,
        'period_transfer_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN transfer.status IN ('requested', 'approved', 'in_transit')
            THEN 1 ELSE 0 END)`,
        'incoming_open_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN transfer.status = 'in_transit'
            THEN 1 ELSE 0 END)`,
        'incoming_in_transit_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN transfer.status = 'received_with_variance'
             AND transfer.received_at IS NOT NULL
             AND transfer.received_at >= :start
             AND transfer.received_at <= :end
            THEN 1 ELSE 0 END)`,
        'received_with_variance_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN (
              transfer.status = 'approved'
              AND transfer.approved_at IS NOT NULL
              AND transfer.approved_at < :backlogCutoff
            ) OR (
              transfer.status = 'in_transit'
              AND COALESCE(transfer.dispatched_at, transfer.updated_at) < :backlogCutoff
            )
            THEN 1 ELSE 0 END)`,
        'bottleneck_count',
      )
      .where('transfer.client_id = :clientId', { clientId })
      .andWhere('transfer.destination_branch_id IN (:...branchIds)', {
        branchIds,
      })
      .setParameters({
        start: range.start,
        end: range.end,
        backlogCutoff,
      });

    this.applyTransferInventoryClassFilter(query, 'transfer', inventoryClassIds);

    return query.groupBy('transfer.destination_branch_id').getRawMany();
  }

  private async loadShiftRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    return this.shiftRepo
      .createQueryBuilder('shift')
      .select('shift.branch_id', 'branch_id')
      .addSelect(
        `SUM(CASE
            WHEN shift.status = 'open'
            THEN 1 ELSE 0 END)`,
        'open_shift_count',
      )
      .addSelect(
        `SUM(CASE
            WHEN shift.status = 'closed'
             AND shift.closed_at IS NOT NULL
             AND shift.closed_at >= :start
             AND shift.closed_at <= :end
             AND ABS(COALESCE(shift.variance, 0)) > 0.009
            THEN 1 ELSE 0 END)`,
        'shift_variance_count',
      )
      .addSelect(
        `COALESCE(MAX(CASE
            WHEN shift.status = 'closed'
             AND shift.closed_at IS NOT NULL
             AND shift.closed_at >= :start
             AND shift.closed_at <= :end
            THEN ABS(COALESCE(shift.variance, 0)) ELSE 0 END), 0)`,
        'worst_shift_variance',
      )
      .where('shift.client_id = :clientId', { clientId })
      .andWhere('shift.branch_id IN (:...branchIds)', { branchIds })
      .setParameters({ start: range.start, end: range.end })
      .groupBy('shift.branch_id')
      .getRawMany();
  }

  private async loadInventoryMovementRows(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .innerJoin('ledger.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .select('ledger.branch_id', 'branch_id')
      .addSelect(
        `SUM(CASE WHEN ledger.transaction_type = 'wastage' THEN 1 ELSE 0 END)`,
        'wastage_event_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'wastage'
            THEN ABS(ledger.quantity) ELSE 0 END), 0)`,
        'wastage_quantity',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'wastage'
            THEN ABS(ledger.quantity * ledger.unit_cost) ELSE 0 END), 0)`,
        'wastage_cost',
      )
      .addSelect(
        `SUM(CASE WHEN ledger.transaction_type = 'adjustment' THEN 1 ELSE 0 END)`,
        'adjustment_event_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'adjustment' AND ledger.quantity > 0
            THEN ledger.quantity ELSE 0 END), 0)`,
        'positive_adjustment_quantity',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'adjustment' AND ledger.quantity < 0
            THEN ABS(ledger.quantity) ELSE 0 END), 0)`,
        'negative_adjustment_quantity',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'adjustment'
            THEN ABS(ledger.quantity * ledger.unit_cost) ELSE 0 END), 0)`,
        'adjustment_cost_impact',
      )
      .addSelect(
        `COALESCE(SUM(CASE
            WHEN ledger.transaction_type = 'sale'
            THEN ABS(ledger.quantity * ledger.unit_cost) ELSE 0 END), 0)`,
        'estimated_cogs',
      )
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ledger.created_at >= :start', { start: range.start })
      .andWhere('ledger.created_at <= :end', { end: range.end });

    if (inventoryClassIds.length > 0) {
      query.andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      });
    }

    return query.groupBy('ledger.branch_id').getRawMany();
  }

  private async loadTopItems(
    clientId: string,
    branchId: number,
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    const salesCategoryIds = this.normalizeSalesCategoryIds(
      filters?.sales_category_ids,
    );

    const query = this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .leftJoin('product.category', 'category')
      .select('product.id', 'product_id')
      .addSelect('product.product_name', 'product_name')
      .addSelect('category.id', 'category_id')
      .addSelect('category.category_name', 'category_name')
      .addSelect('SUM(item.quantity)', 'quantity_sold')
      .addSelect('COALESCE(SUM(item.quantity * item.item_price), 0)', 'revenue')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .andWhere('order.created_at >= :start', { start: range.start })
      .andWhere('order.created_at <= :end', { end: range.end });

    if (salesCategoryIds.length > 0) {
      query.andWhere('product.category_id IN (:...salesCategoryIds)', {
        salesCategoryIds,
      });
    }

    return query
      .groupBy('product.id')
      .addGroupBy('product.product_name')
      .addGroupBy('category.id')
      .addGroupBy('category.category_name')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(5)
      .getRawMany();
  }

  private async loadLowStockItems(
    clientId: string,
    branchId: number,
    filters?: OperationsFilters,
  ) {
    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.branchInventoryRepo
      .createQueryBuilder('branch_inventory')
      .innerJoin('branch_inventory.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .innerJoin('inventory_type.inventoryClass', 'inventory_class')
      .leftJoin(
        StockLevel,
        'stock',
        [
          'stock.client_id = :clientId',
          'stock.branch_id = branch_inventory.branch_id',
          'stock.item_id = branch_inventory.item_id',
        ].join(' AND '),
        { clientId },
      )
      .select('item.id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('item.item_sku', 'item_sku')
      .addSelect('item.uom_base', 'uom_base')
      .addSelect('inventory_class.id', 'inventory_class_id')
      .addSelect('inventory_class.class_name', 'inventory_class_name')
      .addSelect('branch_inventory.min_stock_level', 'min_stock_level')
      .addSelect('COALESCE(stock.current_quantity, 0)', 'current_quantity')
      .addSelect(
        `CASE
          WHEN COALESCE(stock.current_quantity, 0) < 0 THEN 'negative'
          WHEN COALESCE(stock.current_quantity, 0) <= 0 THEN 'out'
          ELSE 'low'
        END`,
        'alert_state',
      )
      .where('branch_inventory.branch_id = :branchId', { branchId })
      .andWhere('branch_inventory.is_enabled = :enabled', { enabled: true })
      .andWhere(
        `(
          COALESCE(stock.current_quantity, 0) < 0
          OR COALESCE(stock.current_quantity, 0) <= 0
          OR (
            branch_inventory.min_stock_level > 0
            AND COALESCE(stock.current_quantity, 0) <= branch_inventory.min_stock_level
          )
        )`,
      );

    if (inventoryClassIds.length > 0) {
      query.andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      });
    }

    return query
      .orderBy(
        `CASE
          WHEN COALESCE(stock.current_quantity, 0) < 0 THEN 0
          WHEN COALESCE(stock.current_quantity, 0) <= 0 THEN 1
          ELSE 2
        END`,
        'ASC',
      )
      .addOrderBy(
        '(branch_inventory.min_stock_level - COALESCE(stock.current_quantity, 0))',
        'DESC',
      )
      .limit(10)
      .getRawMany();
  }

  private async loadSalesCategoryBreakdown(
    clientId: string,
    branchId: number,
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    const salesCategoryIds = this.normalizeSalesCategoryIds(
      filters?.sales_category_ids,
    );

    const query = this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .leftJoin('product.category', 'category')
      .select('COALESCE(category.id, 0)', 'category_id')
      .addSelect(
        `COALESCE(category.category_name, 'Uncategorized')`,
        'category_name',
      )
      .addSelect('SUM(item.quantity)', 'quantity_sold')
      .addSelect('COALESCE(SUM(item.quantity * item.item_price), 0)', 'revenue')
      .addSelect('COUNT(DISTINCT order.id)', 'completed_orders')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .andWhere('order.created_at >= :start', { start: range.start })
      .andWhere('order.created_at <= :end', { end: range.end });

    if (salesCategoryIds.length > 0) {
      query.andWhere('product.category_id IN (:...salesCategoryIds)', {
        salesCategoryIds,
      });
    }

    return query
      .groupBy('category.id')
      .addGroupBy('category.category_name')
      .orderBy('COALESCE(SUM(item.quantity * item.item_price), 0)', 'DESC')
      .limit(8)
      .getRawMany();
  }

  private async loadInventoryClassBreakdown(
    clientId: string,
    branchId: number,
    filters?: OperationsFilters,
  ) {
    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.branchInventoryRepo
      .createQueryBuilder('branch_inventory')
      .innerJoin('branch_inventory.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .innerJoin('inventory_type.inventoryClass', 'inventory_class')
      .leftJoin(
        StockLevel,
        'stock',
        [
          'stock.client_id = :clientId',
          'stock.branch_id = branch_inventory.branch_id',
          'stock.item_id = branch_inventory.item_id',
        ].join(' AND '),
        { clientId },
      )
      .select('inventory_class.id', 'inventory_class_id')
      .addSelect('inventory_class.class_name', 'inventory_class_name')
      .addSelect('COUNT(branch_inventory.id)', 'enabled_item_count')
      .addSelect(
        'COALESCE(SUM(COALESCE(stock.current_quantity, 0)), 0)',
        'on_hand_quantity',
      )
      .addSelect(
        `SUM(CASE
            WHEN branch_inventory.min_stock_level > 0
             AND COALESCE(stock.current_quantity, 0) <= branch_inventory.min_stock_level
            THEN 1 ELSE 0 END)`,
        'low_stock_count',
      )
      .where('branch_inventory.branch_id = :branchId', { branchId })
      .andWhere('branch_inventory.is_enabled = :enabled', { enabled: true });

    if (inventoryClassIds.length > 0) {
      query.andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      });
    }

    return query
      .groupBy('inventory_class.id')
      .addGroupBy('inventory_class.class_name')
      .orderBy('COALESCE(SUM(COALESCE(stock.current_quantity, 0)), 0)', 'DESC')
      .getRawMany();
  }

  private async loadRecentInventoryMovements(
    clientId: string,
    branchId: number,
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .innerJoin('ledger.item', 'item')
      .innerJoin('item.subType', 'sub_type')
      .innerJoin('sub_type.inventoryType', 'inventory_type')
      .innerJoin('inventory_type.inventoryClass', 'inventory_class')
      .select('ledger.id', 'id')
      .addSelect('ledger.transaction_type', 'transaction_type')
      .addSelect('ledger.reference_id', 'reference_id')
      .addSelect('ledger.quantity', 'quantity')
      .addSelect('ledger.unit_cost', 'unit_cost')
      .addSelect('ledger.created_at', 'created_at')
      .addSelect('item.id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('item.item_sku', 'item_sku')
      .addSelect('inventory_class.class_name', 'inventory_class_name')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id = :branchId', { branchId })
      .andWhere('ledger.transaction_type IN (:...types)', {
        types: ['wastage', 'adjustment'],
      })
      .andWhere('ledger.created_at >= :start', { start: range.start })
      .andWhere('ledger.created_at <= :end', { end: range.end });

    if (inventoryClassIds.length > 0) {
      query.andWhere('inventory_type.class_id IN (:...inventoryClassIds)', {
        inventoryClassIds,
      });
    }

    return query.orderBy('ledger.created_at', 'DESC').limit(12).getRawMany();
  }

  private async loadProcurementAttention(
    clientId: string,
    branchId: number,
  ) {
    const [requestRows, purchaseOrderRows] = await Promise.all([
      this.procurementRequestRepo
        .createQueryBuilder('request')
        .leftJoin('request.destination_branch', 'destination_branch')
        .select('request.id', 'id')
        .addSelect(`'procurement_request'`, 'record_type')
        .addSelect('request.request_no', 'reference_no')
        .addSelect('request.status', 'status')
        .addSelect('request.requested_at', 'opened_at')
        .addSelect('destination_branch.branch_name', 'destination_branch_name')
        .where('request.client_id = :clientId', { clientId })
        .andWhere('request.requesting_branch_id = :branchId', { branchId })
        .andWhere("request.status = 'pending'")
        .orderBy('request.requested_at', 'ASC')
        .limit(5)
        .getRawMany(),
      this.purchaseOrderRepo
        .createQueryBuilder('po')
        .leftJoin('po.vendor', 'vendor')
        .select('po.id', 'id')
        .addSelect(`'purchase_order'`, 'record_type')
        .addSelect('COALESCE(po.po_number, CONCAT(\'PO-\', po.id))', 'reference_no')
        .addSelect(
          `CASE
            WHEN po.approval_status = 'pending' THEN 'pending_approval'
            WHEN po.status = 'sent' AND po.approval_status = 'approved' THEN 'awaiting_receipt'
            ELSE po.status
          END`,
          'status',
        )
        .addSelect('po.updated_at', 'opened_at')
        .addSelect('vendor.vendor_name', 'vendor_name')
        .where('po.client_id = :clientId', { clientId })
        .andWhere('COALESCE(po.destination_branch_id, po.branch_id) = :branchId', {
          branchId,
        })
        .andWhere(
          "(po.approval_status = 'pending' OR (po.status = 'sent' AND po.approval_status = 'approved'))",
        )
        .orderBy('po.updated_at', 'ASC')
        .limit(5)
        .getRawMany(),
    ]);

    return [...requestRows, ...purchaseOrderRows]
      .map((row) => ({
        id: this.toInteger(row.id),
        record_type: row.record_type,
        reference_no: row.reference_no,
        status: row.status,
        opened_at: row.opened_at,
        age_days: this.calculateAgeDays(row.opened_at),
        destination_branch_name: row.destination_branch_name ?? null,
        vendor_name: row.vendor_name ?? null,
      }))
      .sort((left, right) => right.age_days - left.age_days)
      .slice(0, 8);
  }

  private async loadTransferWatchlist(
    clientId: string,
    branchId: number,
    backlogCutoff: Date,
    filters?: OperationsFilters,
  ) {
    const inventoryClassIds = this.normalizeInventoryClassIds(
      filters?.inventory_class_ids,
    );

    const query = this.transferRepo
      .createQueryBuilder('transfer')
      .leftJoin('transfer.source_branch', 'source_branch')
      .leftJoin('transfer.destination_branch', 'destination_branch')
      .select('transfer.id', 'id')
      .addSelect('transfer.transfer_no', 'transfer_no')
      .addSelect('transfer.status', 'status')
      .addSelect('transfer.requested_at', 'requested_at')
      .addSelect('source_branch.branch_name', 'source_branch_name')
      .addSelect('destination_branch.branch_name', 'destination_branch_name')
      .where('transfer.client_id = :clientId', { clientId })
      .andWhere(
        '(transfer.source_branch_id = :branchId OR transfer.destination_branch_id = :branchId)',
        { branchId },
      )
      .andWhere("transfer.status IN ('requested', 'approved', 'in_transit')")
      .andWhere(
        `(
          (transfer.status = 'requested' AND transfer.requested_at < :backlogCutoff)
          OR (
            transfer.status = 'approved'
            AND transfer.approved_at IS NOT NULL
            AND transfer.approved_at < :backlogCutoff
          )
          OR (
            transfer.status = 'in_transit'
            AND COALESCE(transfer.dispatched_at, transfer.updated_at) < :backlogCutoff
          )
        )`,
        { backlogCutoff },
      );

    this.applyTransferInventoryClassFilter(query, 'transfer', inventoryClassIds);

    const rows = await query
      .orderBy('transfer.requested_at', 'ASC')
      .limit(6)
      .getRawMany();

    return rows.map((row) => ({
      id: this.toInteger(row.id),
      transfer_no: row.transfer_no,
      status: row.status,
      requested_at: row.requested_at,
      age_days: this.calculateAgeDays(row.requested_at),
      source_branch_name: row.source_branch_name,
      destination_branch_name: row.destination_branch_name,
    }));
  }

  private buildExceptions(branches: BranchOperationsSummary[]) {
    const exceptions: BranchOperationsException[] = [];

    for (const branch of branches) {
      if (branch.inventory.negative_stock_count > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity: 'critical',
          category: 'inventory',
          message: `${branch.inventory.negative_stock_count} item(s) have negative stock and need investigation.`,
          metric_value: branch.inventory.negative_stock_count,
          route: '/console/inventory/stock-balance',
        });
      }

      if (branch.inventory.out_of_stock_count > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity: 'high',
          category: 'inventory',
          message: `${branch.inventory.out_of_stock_count} enabled item(s) are out of stock.`,
          metric_value: branch.inventory.out_of_stock_count,
          route: '/console/inventory/stock-balance',
        });
      }

      if (branch.inventory_movements.wastage_cost > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity:
            branch.inventory_movements.wastage_cost >= 1000 ? 'high' : 'medium',
          category: 'wastage',
          message: `${this.toNumber(branch.inventory_movements.wastage_cost, 2)} of wastage cost was recorded in the reporting window.`,
          metric_value: branch.inventory_movements.wastage_cost,
          route: '/console/inventory/wastage',
        });
      }

      if (branch.procurement.pending_approval_purchase_orders > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity: 'medium',
          category: 'procurement',
          message: `${branch.procurement.pending_approval_purchase_orders} purchase order(s) are pending approval.`,
          metric_value: branch.procurement.pending_approval_purchase_orders,
          route: '/console/purchase-orders',
        });
      }

      if (branch.procurement.awaiting_receipt_purchase_orders > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity:
            branch.procurement.aged_receipt_backlog > 0 ? 'high' : 'medium',
          category: 'receiving',
          message: `${branch.procurement.awaiting_receipt_purchase_orders} approved purchase order(s) still await receipt.`,
          metric_value: branch.procurement.awaiting_receipt_purchase_orders,
          route: '/console/inventory/grn',
        });
      }

      if (branch.transfers.bottleneck_count > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity: branch.transfers.bottleneck_count > 2 ? 'high' : 'medium',
          category: 'transfers',
          message: `${branch.transfers.bottleneck_count} transfer(s) are ageing in request, approval, or in-transit states.`,
          metric_value: branch.transfers.bottleneck_count,
          route: '/console/inventory/ibt',
        });
      }

      if (branch.operations.worst_shift_variance > 0) {
        exceptions.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          severity:
            branch.operations.worst_shift_variance >= 100 ? 'high' : 'low',
          category: 'cash',
          message: `Recent shift variance reached ${this.toNumber(
            branch.operations.worst_shift_variance,
            2,
          )}.`,
          metric_value: branch.operations.worst_shift_variance,
          route: '/terminal/shift-register',
        });
      }
    }

    return exceptions.sort((left, right) => right.metric_value - left.metric_value);
  }

  private buildMetricScopeNotes(filters?: OperationsFilters): string[] {
    const notes: string[] = [];

    if (this.normalizeSalesCategoryIds(filters?.sales_category_ids).length > 0) {
      notes.push(
        'Sales category filters narrow completed sales and top-item calculations, while open-order and live operational counts stay branch-scoped.',
      );
    }

    if (this.normalizeInventoryClassIds(filters?.inventory_class_ids).length > 0) {
      notes.push(
        'Inventory class filters narrow stock, purchase, wastage, adjustment, and transfer calculations to the selected inventory classes.',
      );
    }

    const profitabilityReason = this.profitabilityUnavailableReason(filters);
    if (profitabilityReason) {
      notes.push(profitabilityReason);
    }

    return notes;
  }

  private buildExportRows(
    branchSummaries: BranchOperationsSummary[],
    range: OperationsDateRange,
  ) {
    return {
      branch_summary_rows: branchSummaries.map((branch) => ({
        date_from: range.date_from,
        date_to: range.date_to,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        branch_code: branch.branch_code,
        branch_status: branch.status,
        inventory_store_type: branch.inventory_store_type,
        total_revenue: branch.sales.total_revenue,
        completed_orders: branch.sales.completed_orders,
        average_order_value: branch.sales.average_order_value,
        open_orders: branch.sales.open_orders,
        enabled_item_count: branch.inventory.enabled_item_count,
        stocked_item_count: branch.inventory.stocked_item_count,
        on_hand_quantity: branch.inventory.on_hand_quantity,
        low_stock_count: branch.inventory.low_stock_count,
        out_of_stock_count: branch.inventory.out_of_stock_count,
        negative_stock_count: branch.inventory.negative_stock_count,
        purchase_orders_in_period: branch.procurement.purchase_orders_in_period,
        purchase_value: branch.procurement.purchase_value,
        pending_requests: branch.procurement.pending_requests,
        pending_approval_purchase_orders:
          branch.procurement.pending_approval_purchase_orders,
        awaiting_receipt_purchase_orders:
          branch.procurement.awaiting_receipt_purchase_orders,
        transfer_bottleneck_count: branch.transfers.bottleneck_count,
        open_shift_count: branch.operations.open_shift_count,
        worst_shift_variance: branch.operations.worst_shift_variance,
        wastage_event_count: branch.inventory_movements.wastage_event_count,
        wastage_quantity: branch.inventory_movements.wastage_quantity,
        wastage_cost: branch.inventory_movements.wastage_cost,
        adjustment_event_count:
          branch.inventory_movements.adjustment_event_count,
        positive_adjustment_quantity:
          branch.inventory_movements.positive_adjustment_quantity,
        negative_adjustment_quantity:
          branch.inventory_movements.negative_adjustment_quantity,
        adjustment_cost_impact:
          branch.inventory_movements.adjustment_cost_impact,
        profitability_available: branch.profitability.available,
        estimated_cogs: branch.profitability.estimated_cogs,
        estimated_gross_margin: branch.profitability.estimated_gross_margin,
        estimated_gross_margin_pct:
          branch.profitability.estimated_gross_margin_pct,
      })),
      sales_by_branch_rows: branchSummaries.map((branch) => ({
        date_from: range.date_from,
        date_to: range.date_to,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        branch_code: branch.branch_code,
        total_revenue: branch.sales.total_revenue,
        completed_orders: branch.sales.completed_orders,
        average_order_value: branch.sales.average_order_value,
        open_orders: branch.sales.open_orders,
        last_sale_at: branch.sales.last_sale_at?.toISOString() ?? null,
      })),
      stock_by_branch_rows: branchSummaries.map((branch) => ({
        date_from: range.date_from,
        date_to: range.date_to,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        enabled_item_count: branch.inventory.enabled_item_count,
        stocked_item_count: branch.inventory.stocked_item_count,
        on_hand_quantity: branch.inventory.on_hand_quantity,
        low_stock_count: branch.inventory.low_stock_count,
        out_of_stock_count: branch.inventory.out_of_stock_count,
        negative_stock_count: branch.inventory.negative_stock_count,
      })),
      purchase_by_branch_rows: branchSummaries.map((branch) => ({
        date_from: range.date_from,
        date_to: range.date_to,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        requests_raised: branch.procurement.requests_raised,
        pending_requests: branch.procurement.pending_requests,
        approved_requests: branch.procurement.approved_requests,
        rejected_requests: branch.procurement.rejected_requests,
        converted_requests: branch.procurement.converted_requests,
        purchase_orders_in_period: branch.procurement.purchase_orders_in_period,
        purchase_value: branch.procurement.purchase_value,
        open_purchase_orders: branch.procurement.open_purchase_orders,
        pending_approval_purchase_orders:
          branch.procurement.pending_approval_purchase_orders,
        awaiting_receipt_purchase_orders:
          branch.procurement.awaiting_receipt_purchase_orders,
        aged_receipt_backlog: branch.procurement.aged_receipt_backlog,
      })),
      inventory_movement_rows: branchSummaries.map((branch) => ({
        date_from: range.date_from,
        date_to: range.date_to,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        wastage_event_count: branch.inventory_movements.wastage_event_count,
        wastage_quantity: branch.inventory_movements.wastage_quantity,
        wastage_cost: branch.inventory_movements.wastage_cost,
        adjustment_event_count:
          branch.inventory_movements.adjustment_event_count,
        positive_adjustment_quantity:
          branch.inventory_movements.positive_adjustment_quantity,
        negative_adjustment_quantity:
          branch.inventory_movements.negative_adjustment_quantity,
        adjustment_cost_impact:
          branch.inventory_movements.adjustment_cost_impact,
      })),
    };
  }

  private async buildOverview(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
    branchId?: number,
  ) {
    const [authorizedBranches, branches] = await Promise.all([
      this.loadBranches(clientId, accessibleBranchIds),
      this.loadBranches(
        clientId,
        accessibleBranchIds,
        branchId,
        filters?.branch_ids,
      ),
    ]);

    if (branches.length === 0) {
      throw new NotFoundException('Branch reporting scope not found.');
    }

    const range = this.resolveDateRange(filters);
    const backlogCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const profitabilityReason = this.profitabilityUnavailableReason(filters);
    const branchMap = new Map<number, BranchOperationsSummary>(
      branches.map((branch) => [
        branch.id,
        this.createBranchSummary(branch, profitabilityReason),
      ]),
    );
    const branchIds = branches.map((branch) => branch.id);

    const [
      salesRows,
      openOrderRows,
      inventoryRows,
      procurementRequestRows,
      purchaseOrderRows,
      transferOutgoingRows,
      transferIncomingRows,
      shiftRows,
      inventoryMovementRows,
    ] = await Promise.all([
      this.loadSalesRows(clientId, branchIds, range, filters),
      this.loadOpenOrderRows(clientId, branchIds),
      this.loadInventoryRows(clientId, branchIds, filters),
      this.loadProcurementRequestRows(clientId, branchIds, range, filters),
      this.loadPurchaseOrderRows(
        clientId,
        branchIds,
        range,
        backlogCutoff,
        filters,
      ),
      this.loadTransferOutgoingRows(
        clientId,
        branchIds,
        range,
        backlogCutoff,
        filters,
      ),
      this.loadTransferIncomingRows(
        clientId,
        branchIds,
        range,
        backlogCutoff,
        filters,
      ),
      this.loadShiftRows(clientId, branchIds, range),
      this.loadInventoryMovementRows(clientId, branchIds, range, filters),
    ]);

    for (const row of salesRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.sales.total_revenue = this.toNumber(row.sales_total, 2);
      branch.sales.completed_orders = this.toInteger(row.completed_orders);
      branch.sales.last_sale_at = row.last_sale_at
        ? new Date(String(row.last_sale_at))
        : null;
    }

    for (const row of openOrderRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.sales.open_orders = this.toInteger(row.open_orders);
    }

    for (const row of inventoryRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.inventory.enabled_item_count = this.toInteger(row.enabled_item_count);
      branch.inventory.stocked_item_count = this.toInteger(row.stocked_item_count);
      branch.inventory.on_hand_quantity = this.toNumber(row.on_hand_quantity, 2);
      branch.inventory.low_stock_count = this.toInteger(row.low_stock_count);
      branch.inventory.out_of_stock_count = this.toInteger(row.out_of_stock_count);
      branch.inventory.negative_stock_count = this.toInteger(
        row.negative_stock_count,
      );
    }

    for (const row of procurementRequestRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.procurement.requests_raised = this.toInteger(row.requests_raised);
      branch.procurement.pending_requests = this.toInteger(row.pending_requests);
      branch.procurement.approved_requests = this.toInteger(row.approved_requests);
      branch.procurement.rejected_requests = this.toInteger(row.rejected_requests);
      branch.procurement.converted_requests = this.toInteger(row.converted_requests);
    }

    for (const row of purchaseOrderRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.procurement.purchase_orders_in_period = this.toInteger(
        row.purchase_orders_in_period,
      );
      branch.procurement.purchase_value = this.toNumber(row.purchase_value, 2);
      branch.procurement.open_purchase_orders = this.toInteger(
        row.open_purchase_orders,
      );
      branch.procurement.pending_approval_purchase_orders = this.toInteger(
        row.pending_approval_purchase_orders,
      );
      branch.procurement.awaiting_receipt_purchase_orders = this.toInteger(
        row.awaiting_receipt_purchase_orders,
      );
      branch.procurement.aged_receipt_backlog = this.toInteger(
        row.aged_receipt_backlog,
      );
    }

    for (const row of transferOutgoingRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.transfers.period_transfer_count += this.toInteger(
        row.period_transfer_count,
      );
      branch.transfers.outgoing_open_count = this.toInteger(
        row.outgoing_open_count,
      );
      branch.transfers.outgoing_in_transit_count = this.toInteger(
        row.outgoing_in_transit_count,
      );
      branch.transfers.bottleneck_count += this.toInteger(row.bottleneck_count);
    }

    for (const row of transferIncomingRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.transfers.period_transfer_count += this.toInteger(
        row.period_transfer_count,
      );
      branch.transfers.incoming_open_count = this.toInteger(
        row.incoming_open_count,
      );
      branch.transfers.incoming_in_transit_count = this.toInteger(
        row.incoming_in_transit_count,
      );
      branch.transfers.received_with_variance_count = this.toInteger(
        row.received_with_variance_count,
      );
      branch.transfers.bottleneck_count += this.toInteger(row.bottleneck_count);
    }

    for (const row of shiftRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.operations.open_shift_count = this.toInteger(row.open_shift_count);
      branch.operations.shift_variance_count = this.toInteger(
        row.shift_variance_count,
      );
      branch.operations.worst_shift_variance = this.toNumber(
        row.worst_shift_variance,
        2,
      );
    }

    for (const row of inventoryMovementRows) {
      const branch = branchMap.get(this.toInteger(row.branch_id));
      if (!branch) {
        continue;
      }

      branch.inventory_movements.wastage_event_count = this.toInteger(
        row.wastage_event_count,
      );
      branch.inventory_movements.wastage_quantity = this.toNumber(
        row.wastage_quantity,
        2,
      );
      branch.inventory_movements.wastage_cost = this.toNumber(
        row.wastage_cost,
        2,
      );
      branch.inventory_movements.adjustment_event_count = this.toInteger(
        row.adjustment_event_count,
      );
      branch.inventory_movements.positive_adjustment_quantity = this.toNumber(
        row.positive_adjustment_quantity,
        2,
      );
      branch.inventory_movements.negative_adjustment_quantity = this.toNumber(
        row.negative_adjustment_quantity,
        2,
      );
      branch.inventory_movements.adjustment_cost_impact = this.toNumber(
        row.adjustment_cost_impact,
        2,
      );

      if (branch.profitability.available) {
        const estimatedCogs = this.toNumber(row.estimated_cogs, 2);
        const estimatedGrossMargin = this.toNumber(
          branch.sales.total_revenue - estimatedCogs,
          2,
        );
        branch.profitability.estimated_cogs = estimatedCogs;
        branch.profitability.estimated_gross_margin = estimatedGrossMargin;
        branch.profitability.estimated_gross_margin_pct =
          branch.sales.total_revenue > 0
            ? this.toNumber(
                (estimatedGrossMargin / branch.sales.total_revenue) * 100,
                2,
              )
            : 0;
      }
    }

    const branchSummaries = Array.from(branchMap.values()).map((branch) => ({
      ...branch,
      sales: {
        ...branch.sales,
        average_order_value:
          branch.sales.completed_orders > 0
            ? this.toNumber(
                branch.sales.total_revenue / branch.sales.completed_orders,
                2,
              )
            : 0,
      },
    }));

    const summary = {
      branch_count: branchSummaries.length,
      total_revenue: this.toNumber(
        branchSummaries.reduce(
          (total, branch) => total + branch.sales.total_revenue,
          0,
        ),
        2,
      ),
      completed_orders: branchSummaries.reduce(
        (total, branch) => total + branch.sales.completed_orders,
        0,
      ),
      average_order_value: 0,
      low_stock_items: branchSummaries.reduce(
        (total, branch) => total + branch.inventory.low_stock_count,
        0,
      ),
      out_of_stock_items: branchSummaries.reduce(
        (total, branch) => total + branch.inventory.out_of_stock_count,
        0,
      ),
      negative_stock_items: branchSummaries.reduce(
        (total, branch) => total + branch.inventory.negative_stock_count,
        0,
      ),
      procurement_backlog: branchSummaries.reduce(
        (total, branch) =>
          total +
          branch.procurement.pending_requests +
          branch.procurement.pending_approval_purchase_orders +
          branch.procurement.awaiting_receipt_purchase_orders,
        0,
      ),
      transfer_bottlenecks: branchSummaries.reduce(
        (total, branch) => total + branch.transfers.bottleneck_count,
        0,
      ),
      open_shifts: branchSummaries.reduce(
        (total, branch) => total + branch.operations.open_shift_count,
        0,
      ),
    };

    summary.average_order_value =
      summary.completed_orders > 0
        ? this.toNumber(summary.total_revenue / summary.completed_orders, 2)
        : 0;

    const profitabilityAvailable = this.canComputeProfitability(filters);
    const profitabilitySummary = profitabilityAvailable
      ? {
          available: true,
          unavailable_reason: null,
          estimated_cogs: this.toNumber(
            branchSummaries.reduce(
              (total, branch) =>
                total + (branch.profitability.estimated_cogs ?? 0),
              0,
            ),
            2,
          ),
          estimated_gross_margin: 0,
          estimated_gross_margin_pct: 0,
        }
      : {
          available: false,
          unavailable_reason: profitabilityReason,
          estimated_cogs: null,
          estimated_gross_margin: null,
          estimated_gross_margin_pct: null,
        };

    if (profitabilityAvailable) {
      profitabilitySummary.estimated_gross_margin = this.toNumber(
        summary.total_revenue - (profitabilitySummary.estimated_cogs ?? 0),
        2,
      );
      profitabilitySummary.estimated_gross_margin_pct =
        summary.total_revenue > 0
          ? this.toNumber(
              ((profitabilitySummary.estimated_gross_margin ?? 0) /
                summary.total_revenue) *
                100,
              2,
            )
          : 0;
    }

    const movementSummary = {
      wastage_event_count: branchSummaries.reduce(
        (total, branch) => total + branch.inventory_movements.wastage_event_count,
        0,
      ),
      wastage_quantity: this.toNumber(
        branchSummaries.reduce(
          (total, branch) => total + branch.inventory_movements.wastage_quantity,
          0,
        ),
        2,
      ),
      wastage_cost: this.toNumber(
        branchSummaries.reduce(
          (total, branch) => total + branch.inventory_movements.wastage_cost,
          0,
        ),
        2,
      ),
      adjustment_event_count: branchSummaries.reduce(
        (total, branch) =>
          total + branch.inventory_movements.adjustment_event_count,
        0,
      ),
      positive_adjustment_quantity: this.toNumber(
        branchSummaries.reduce(
          (total, branch) =>
            total + branch.inventory_movements.positive_adjustment_quantity,
          0,
        ),
        2,
      ),
      negative_adjustment_quantity: this.toNumber(
        branchSummaries.reduce(
          (total, branch) =>
            total + branch.inventory_movements.negative_adjustment_quantity,
          0,
        ),
        2,
      ),
      adjustment_cost_impact: this.toNumber(
        branchSummaries.reduce(
          (total, branch) =>
            total + branch.inventory_movements.adjustment_cost_impact,
          0,
        ),
        2,
      ),
    };

    return {
      generated_at: new Date().toISOString(),
      date_range: {
        date_from: range.date_from,
        date_to: range.date_to,
        label: range.label,
      },
      access_scope: {
        authorized_branch_count: authorizedBranches.length,
        filtered_branch_count: branchSummaries.length,
        all_authorized_branches_selected:
          branchSummaries.length === authorizedBranches.length,
      },
      filters_applied: {
        requested_branch_ids: this.normalizeBranchIds(filters?.branch_ids),
        resolved_branch_ids: branchSummaries.map((branch) => branch.branch_id),
        sales_category_ids: this.normalizeSalesCategoryIds(
          filters?.sales_category_ids,
        ),
        inventory_class_ids: this.normalizeInventoryClassIds(
          filters?.inventory_class_ids,
        ),
        metric_scope_notes: this.buildMetricScopeNotes(filters),
      },
      branch_options: authorizedBranches.map((branch) =>
        this.buildBranchOption(branch),
      ),
      summary,
      sales_summary: {
        total_revenue: summary.total_revenue,
        completed_orders: summary.completed_orders,
        average_order_value: summary.average_order_value,
        open_orders: branchSummaries.reduce(
          (total, branch) => total + branch.sales.open_orders,
          0,
        ),
      },
      inventory_summary: {
        enabled_item_count: branchSummaries.reduce(
          (total, branch) => total + branch.inventory.enabled_item_count,
          0,
        ),
        stocked_item_count: branchSummaries.reduce(
          (total, branch) => total + branch.inventory.stocked_item_count,
          0,
        ),
        on_hand_quantity: this.toNumber(
          branchSummaries.reduce(
            (total, branch) => total + branch.inventory.on_hand_quantity,
            0,
          ),
          2,
        ),
        low_stock_items: summary.low_stock_items,
        out_of_stock_items: summary.out_of_stock_items,
        negative_stock_items: summary.negative_stock_items,
      },
      procurement_summary: {
        requests_raised: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.requests_raised,
          0,
        ),
        pending_requests: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.pending_requests,
          0,
        ),
        approved_requests: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.approved_requests,
          0,
        ),
        rejected_requests: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.rejected_requests,
          0,
        ),
        converted_requests: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.converted_requests,
          0,
        ),
        purchase_orders_in_period: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.purchase_orders_in_period,
          0,
        ),
        purchase_value: this.toNumber(
          branchSummaries.reduce(
            (total, branch) => total + branch.procurement.purchase_value,
            0,
          ),
          2,
        ),
        pending_approval_purchase_orders: branchSummaries.reduce(
          (total, branch) =>
            total + branch.procurement.pending_approval_purchase_orders,
          0,
        ),
        awaiting_receipt_purchase_orders: branchSummaries.reduce(
          (total, branch) =>
            total + branch.procurement.awaiting_receipt_purchase_orders,
          0,
        ),
        aged_receipt_backlog: branchSummaries.reduce(
          (total, branch) => total + branch.procurement.aged_receipt_backlog,
          0,
        ),
      },
      transfer_summary: {
        period_transfer_count: branchSummaries.reduce(
          (total, branch) => total + branch.transfers.period_transfer_count,
          0,
        ),
        incoming_open_count: branchSummaries.reduce(
          (total, branch) => total + branch.transfers.incoming_open_count,
          0,
        ),
        outgoing_open_count: branchSummaries.reduce(
          (total, branch) => total + branch.transfers.outgoing_open_count,
          0,
        ),
        incoming_in_transit_count: branchSummaries.reduce(
          (total, branch) => total + branch.transfers.incoming_in_transit_count,
          0,
        ),
        outgoing_in_transit_count: branchSummaries.reduce(
          (total, branch) => total + branch.transfers.outgoing_in_transit_count,
          0,
        ),
        received_with_variance_count: branchSummaries.reduce(
          (total, branch) =>
            total + branch.transfers.received_with_variance_count,
          0,
        ),
        bottleneck_count: summary.transfer_bottlenecks,
      },
      movement_summary: movementSummary,
      profitability_summary: profitabilitySummary,
      operations_summary: {
        open_shift_count: summary.open_shifts,
        shift_variance_count: branchSummaries.reduce(
          (total, branch) => total + branch.operations.shift_variance_count,
          0,
        ),
        worst_shift_variance: this.toNumber(
          branchSummaries.reduce(
            (worst, branch) =>
              Math.max(worst, branch.operations.worst_shift_variance),
            0,
          ),
          2,
        ),
      },
      branches: branchSummaries,
      comparisons: {
        revenue_ranking: [...branchSummaries]
          .sort(
            (left, right) =>
              right.sales.total_revenue - left.sales.total_revenue,
          )
          .map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            total_revenue: branch.sales.total_revenue,
            completed_orders: branch.sales.completed_orders,
            average_order_value: branch.sales.average_order_value,
          })),
        gross_margin_ranking: profitabilityAvailable
          ? [...branchSummaries]
              .sort(
                (left, right) =>
                  (right.profitability.estimated_gross_margin ?? 0) -
                  (left.profitability.estimated_gross_margin ?? 0),
              )
              .map((branch) => ({
                branch_id: branch.branch_id,
                branch_name: branch.branch_name,
                estimated_gross_margin:
                  branch.profitability.estimated_gross_margin,
                estimated_gross_margin_pct:
                  branch.profitability.estimated_gross_margin_pct,
              }))
          : [],
        inventory_pressure_ranking: [...branchSummaries]
          .sort(
            (left, right) =>
              right.inventory.low_stock_count +
                right.inventory.out_of_stock_count +
                right.inventory.negative_stock_count -
              (left.inventory.low_stock_count +
                left.inventory.out_of_stock_count +
                left.inventory.negative_stock_count),
          )
          .map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            low_stock_count: branch.inventory.low_stock_count,
            out_of_stock_count: branch.inventory.out_of_stock_count,
            negative_stock_count: branch.inventory.negative_stock_count,
          })),
        procurement_backlog_ranking: [...branchSummaries]
          .sort(
            (left, right) =>
              right.procurement.pending_requests +
                right.procurement.pending_approval_purchase_orders +
                right.procurement.awaiting_receipt_purchase_orders -
              (left.procurement.pending_requests +
                left.procurement.pending_approval_purchase_orders +
                left.procurement.awaiting_receipt_purchase_orders),
          )
          .map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            pending_requests: branch.procurement.pending_requests,
            pending_approval_purchase_orders:
              branch.procurement.pending_approval_purchase_orders,
            awaiting_receipt_purchase_orders:
              branch.procurement.awaiting_receipt_purchase_orders,
          })),
        wastage_watch_ranking: [...branchSummaries]
          .sort(
            (left, right) =>
              right.inventory_movements.wastage_cost -
              left.inventory_movements.wastage_cost,
          )
          .map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            wastage_event_count: branch.inventory_movements.wastage_event_count,
            wastage_cost: branch.inventory_movements.wastage_cost,
            adjustment_cost_impact:
              branch.inventory_movements.adjustment_cost_impact,
          })),
        transfer_watch_ranking: [...branchSummaries]
          .sort(
            (left, right) =>
              right.transfers.bottleneck_count -
              left.transfers.bottleneck_count,
          )
          .map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            bottleneck_count: branch.transfers.bottleneck_count,
            incoming_open_count: branch.transfers.incoming_open_count,
            outgoing_open_count: branch.transfers.outgoing_open_count,
          })),
      },
      exceptions: this.buildExceptions(branchSummaries),
      exports: this.buildExportRows(branchSummaries, range),
    };
  }

  async getOperationsOverview(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    return this.buildOverview(clientId, accessibleBranchIds, filters);
  }

  private async loadDailyRevenueSeries(
    clientId: string,
    branchIds: number[],
    range: OperationsDateRange,
    filters?: OperationsFilters,
  ) {
    if (branchIds.length === 0) {
      return [];
    }

    const salesCategoryIds = this.normalizeSalesCategoryIds(
      filters?.sales_category_ids,
    );

    if (salesCategoryIds.length === 0) {
      return this.orderRepo
        .createQueryBuilder('order')
        .select('DATE(order.created_at)', 'business_date')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total_revenue')
        .addSelect('COUNT(order.id)', 'completed_orders')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id IN (:...branchIds)', { branchIds })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at >= :start', { start: range.start })
        .andWhere('order.created_at <= :end', { end: range.end })
        .groupBy('DATE(order.created_at)')
        .orderBy('DATE(order.created_at)', 'ASC')
        .getRawMany();
    }

    return this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .select('DATE(order.created_at)', 'business_date')
      .addSelect(
        'COALESCE(SUM(item.quantity * item.item_price), 0)',
        'total_revenue',
      )
      .addSelect('COUNT(DISTINCT order.id)', 'completed_orders')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .andWhere('order.created_at >= :start', { start: range.start })
      .andWhere('order.created_at <= :end', { end: range.end })
      .andWhere('product.category_id IN (:...salesCategoryIds)', {
        salesCategoryIds,
      })
      .groupBy('DATE(order.created_at)')
      .orderBy('DATE(order.created_at)', 'ASC')
      .getRawMany();
  }

  private buildContinuousDateSeries(
    range: OperationsDateRange,
    rows: Array<Record<string, unknown>>,
  ) {
    const rowMap = new Map(
      rows.map((row) => [
        String(row.business_date),
        {
          total_revenue: this.toNumber(row.total_revenue, 2),
          completed_orders: this.toInteger(row.completed_orders),
        },
      ]),
    );

    const series: Array<{
      business_date: string;
      total_revenue: number;
      completed_orders: number;
    }> = [];

    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const key = cursor.toISOString().slice(0, 10);
      const row = rowMap.get(key);
      series.push({
        business_date: key,
        total_revenue: row?.total_revenue ?? 0,
        completed_orders: row?.completed_orders ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private summarizeTrailingWindow(
    series: Array<{ business_date: string; total_revenue: number; completed_orders: number }>,
    days: number,
  ) {
    const window = series.slice(Math.max(0, series.length - days));
    const previousWindow = series.slice(
      Math.max(0, series.length - days * 2),
      Math.max(0, series.length - days),
    );
    const currentRevenue = window.reduce((sum, row) => sum + row.total_revenue, 0);
    const previousRevenue = previousWindow.reduce(
      (sum, row) => sum + row.total_revenue,
      0,
    );
    const deltaPct = previousRevenue > 0
      ? this.toNumber(((currentRevenue - previousRevenue) / previousRevenue) * 100, 2)
      : null;

    return {
      current_revenue: this.toNumber(currentRevenue, 2),
      previous_revenue: this.toNumber(previousRevenue, 2),
      delta_pct: deltaPct,
      current_orders: window.reduce((sum, row) => sum + row.completed_orders, 0),
      previous_orders: previousWindow.reduce((sum, row) => sum + row.completed_orders, 0),
    };
  }

  async getOperationsBranchOptions(
    clientId: string,
    accessibleBranchIds?: number[],
  ) {
    const [branches, salesCategories, inventoryClasses] = await Promise.all([
      this.loadBranches(clientId, accessibleBranchIds),
      this.loadSalesCategoryOptions(clientId),
      this.loadInventoryClassOptions(clientId),
    ]);

    return {
      authorized_branch_count: branches.length,
      branches: branches.map((branch) => this.buildBranchOption(branch)),
      sales_categories: salesCategories,
      inventory_classes: inventoryClasses,
    };
  }

  private async resolveBiScope(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const branches = await this.loadBranches(
      clientId,
      accessibleBranchIds,
      undefined,
      filters?.branch_ids,
    );
    const dateRange = this.resolveDateRange(filters);
    return {
      branches,
      branchIds: branches.map((branch) => branch.id),
      dateRange,
    };
  }

  private percent(numerator: number, denominator: number): number {
    return denominator > 0 ? this.toNumber((numerator / denominator) * 100, 2) : 0;
  }

  private async loadSalesTotals(clientId: string, branchIds: number[], dateRange: OperationsDateRange) {
    if (branchIds.length === 0) {
      return {
        total_sales: 0,
        net_sales: 0,
        orders_count: 0,
        avg_order_value: 0,
        discounts: 0,
        voided_orders: 0,
        voided_amount: 0,
      };
    }

    const row = await this.orderRepo
      .createQueryBuilder('posOrder')
      .select('COALESCE(SUM(posOrder.total_amount), 0)', 'total_sales')
      .addSelect('COALESCE(SUM(posOrder.total_amount - posOrder.tax_amount), 0)', 'net_sales')
      .addSelect('COUNT(posOrder.id)', 'orders_count')
      .addSelect('COALESCE(AVG(posOrder.total_amount), 0)', 'avg_order_value')
      .addSelect('COALESCE(SUM(posOrder.discount_amount), 0)', 'discounts')
      .addSelect(`SUM(CASE WHEN posOrder.order_status = 'voided' THEN 1 ELSE 0 END)`, 'voided_orders')
      .addSelect(`COALESCE(SUM(CASE WHEN posOrder.order_status = 'voided' THEN posOrder.total_amount ELSE 0 END), 0)`, 'voided_amount')
      .where('posOrder.client_id = :clientId', { clientId })
      .andWhere('posOrder.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('posOrder.created_at >= :start AND posOrder.created_at <= :end', dateRange)
      .andWhere('posOrder.order_status IN (:...statuses)', { statuses: ['completed', 'voided'] })
      .getRawOne();

    return {
      total_sales: this.toNumber(row?.total_sales, 2),
      net_sales: this.toNumber(row?.net_sales, 2),
      orders_count: this.toInteger(row?.orders_count),
      avg_order_value: this.toNumber(row?.avg_order_value, 2),
      discounts: this.toNumber(row?.discounts, 2),
      voided_orders: this.toInteger(row?.voided_orders),
      voided_amount: this.toNumber(row?.voided_amount, 2),
    };
  }

  private async loadRefundTotal(clientId: string, branchIds: number[], dateRange: OperationsDateRange): Promise<number> {
    if (branchIds.length === 0) return 0;
    const row = await this.orderRepo.manager
      .createQueryBuilder()
      .from('order_returns', 'ret')
      .select('COALESCE(SUM(ret.refund_amount), 0)', 'refund_amount')
      .where('ret.client_id = :clientId', { clientId })
      .andWhere('ret.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ret.created_at >= :start AND ret.created_at <= :end', dateRange)
      .getRawOne();
    return this.toNumber(row?.refund_amount, 2);
  }

  private async loadCogsTotal(clientId: string, branchIds: number[], dateRange: OperationsDateRange): Promise<number> {
    if (branchIds.length === 0) return 0;
    const row = await this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .select('COALESCE(SUM(ABS(ledger.quantity) * ledger.unit_cost), 0)', 'cogs')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ledger.created_at >= :start AND ledger.created_at <= :end', dateRange)
      .andWhere('ledger.transaction_type = :type', { type: 'sale' })
      .getRawOne();
    return this.toNumber(row?.cogs, 2);
  }

  private async loadWasteTotal(clientId: string, branchIds: number[], dateRange: OperationsDateRange): Promise<number> {
    if (branchIds.length === 0) return 0;
    const row = await this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .select('COALESCE(SUM(ABS(ledger.quantity) * ledger.unit_cost), 0)', 'waste_cost')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ledger.created_at >= :start AND ledger.created_at <= :end', dateRange)
      .andWhere('ledger.transaction_type = :type', { type: 'wastage' })
      .getRawOne();
    return this.toNumber(row?.waste_cost, 2);
  }

  private async loadInventoryValue(clientId: string, branchIds: number[]) {
    if (branchIds.length === 0) {
      return { inventory_value: 0, negative_stock_count: 0 };
    }
    const row = await this.orderRepo.manager
      .createQueryBuilder()
      .from('inventory_stock_levels', 'stock')
      .select('COALESCE(SUM(stock.current_quantity * stock.last_unit_cost), 0)', 'inventory_value')
      .addSelect(`SUM(CASE WHEN stock.current_quantity < 0 THEN 1 ELSE 0 END)`, 'negative_stock_count')
      .where('stock.client_id = :clientId', { clientId })
      .andWhere('stock.branch_id IN (:...branchIds)', { branchIds })
      .getRawOne();
    return {
      inventory_value: this.toNumber(row?.inventory_value, 2),
      negative_stock_count: this.toInteger(row?.negative_stock_count),
    };
  }

  private async loadLaborCost(clientId: string, branchIds: number[], dateRange: OperationsDateRange): Promise<number> {
    if (branchIds.length === 0) return 0;
    const row = await this.orderRepo.manager
      .createQueryBuilder()
      .from('accounting_payroll_runs', 'payroll')
      .select('COALESCE(SUM(payroll.total_gross_amount), 0)', 'labor_cost')
      .where('payroll.client_id = :clientId', { clientId })
      .andWhere('payroll.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('payroll.status IN (:...statuses)', { statuses: ['approved', 'partially_paid', 'paid'] })
      .andWhere('payroll.period_start <= :dateTo AND payroll.period_end >= :dateFrom', {
        dateFrom: dateRange.date_from,
        dateTo: dateRange.date_to,
      })
      .getRawOne();
    return this.toNumber(row?.labor_cost, 2);
  }

  async getExecutiveKpis(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const { branches, branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    const [sales, refundAmount, cogs, wasteCost, inventory, laborCost] = await Promise.all([
      this.loadSalesTotals(clientId, branchIds, dateRange),
      this.loadRefundTotal(clientId, branchIds, dateRange),
      this.loadCogsTotal(clientId, branchIds, dateRange),
      this.loadWasteTotal(clientId, branchIds, dateRange),
      this.loadInventoryValue(clientId, branchIds),
      this.loadLaborCost(clientId, branchIds, dateRange),
    ]);

    const grossProfit = this.toNumber(sales.net_sales - cogs, 2);
    const netProfit = this.toNumber(grossProfit - wasteCost - laborCost, 2);
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      branch_count: branches.length,
      total_sales: sales.total_sales,
      net_sales: sales.net_sales,
      orders_count: sales.orders_count,
      avg_order_value: sales.avg_order_value,
      gross_profit: grossProfit,
      net_profit: netProfit,
      food_cost_pct: this.percent(cogs, sales.net_sales),
      beverage_cost_pct: 0,
      packaging_cost_pct: 0,
      waste_pct: this.percent(wasteCost, cogs),
      discount_pct: this.percent(sales.discounts, sales.total_sales),
      refund_pct: this.percent(refundAmount, sales.total_sales),
      labor_cost_pct: this.percent(laborCost, sales.net_sales),
      ebitda_pct: this.percent(netProfit, sales.net_sales),
      inventory_value: inventory.inventory_value,
      negative_stock_count: inventory.negative_stock_count,
      supporting: {
        cogs,
        waste_cost: wasteCost,
        refund_amount: refundAmount,
        labor_cost: laborCost,
        voided_orders: sales.voided_orders,
        voided_amount: sales.voided_amount,
      },
    };
  }

  private async loadRecipeCostByProduct(clientId: string, branchIds: number[]): Promise<Map<number, number>> {
    if (branchIds.length === 0) return new Map();
    const rows = await this.orderRepo.manager
      .createQueryBuilder()
      .from('recipes', 'recipe')
      .innerJoin('recipe_ingredients', 'ingredient', 'ingredient.recipe_id = recipe.id')
      .leftJoin(
        'inventory_stock_levels',
        'stock',
        'stock.client_id = recipe.client_id AND stock.item_id = ingredient.item_id AND stock.branch_id IN (:...branchIds)',
        { branchIds },
      )
      .select('recipe.product_id', 'product_id')
      .addSelect('COALESCE(SUM(ingredient.quantity * (1 + ingredient.wastage_percentage / 100) * COALESCE(stock.last_unit_cost, 0)), 0)', 'recipe_cost')
      .where('recipe.client_id = :clientId', { clientId })
      .andWhere('recipe.is_active = :active', { active: true })
      .groupBy('recipe.product_id')
      .getRawMany();
    return new Map(rows.map((row) => [Number(row.product_id), this.toNumber(row.recipe_cost, 4)]));
  }

  async getMenuEngineering(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    if (branchIds.length === 0) {
      return { filters: dateRange, items: [], quadrant_summary: {}, actions: [] };
    }
    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'posOrder')
      .innerJoin('item.product', 'product')
      .leftJoin('product.category', 'category')
      .leftJoin('product.production_station', 'station')
      .select('product.id', 'product_id')
      .addSelect('COALESCE(item.product_name, product.product_name)', 'product_name')
      .addSelect('category.category_name', 'category_name')
      .addSelect('station.name', 'station_name')
      .addSelect('SUM(item.quantity)', 'sales_qty')
      .addSelect('SUM(item.quantity * item.item_price)', 'revenue')
      .where('posOrder.client_id = :clientId', { clientId })
      .andWhere('posOrder.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('posOrder.order_status = :status', { status: 'completed' })
      .andWhere('item.item_status <> :voided', { voided: 'voided' })
      .andWhere('posOrder.created_at >= :start AND posOrder.created_at <= :end', dateRange)
      .groupBy('product.id')
      .addGroupBy('COALESCE(item.product_name, product.product_name)')
      .addGroupBy('category.category_name')
      .addGroupBy('station.name')
      .orderBy('SUM(item.quantity * item.item_price)', 'DESC')
      .getRawMany();
    const recipeCostByProduct = await this.loadRecipeCostByProduct(clientId, branchIds);
    const totalQty = rows.reduce((sum, row) => sum + Number(row.sales_qty || 0), 0);
    const enriched = rows.map((row) => {
      const qty = this.toNumber(row.sales_qty, 3);
      const revenue = this.toNumber(row.revenue, 2);
      const recipeCost = this.toNumber(recipeCostByProduct.get(Number(row.product_id)) ?? 0, 4);
      const totalCost = this.toNumber(recipeCost * qty, 2);
      const grossProfit = this.toNumber(revenue - totalCost, 2);
      const marginPct = this.percent(grossProfit, revenue);
      const popularityPct = this.percent(qty, totalQty);
      const highPopularity = popularityPct >= (rows.length > 0 ? 100 / rows.length : 0);
      const highMargin = marginPct >= 55;
      const classification = highPopularity && highMargin
        ? 'STAR'
        : highPopularity && !highMargin
          ? 'PLOWHORSE'
          : !highPopularity && highMargin
            ? 'PUZZLE'
            : 'DOG';
      const action = classification === 'STAR'
        ? 'Promote'
        : classification === 'PLOWHORSE'
          ? 'Reprice'
          : classification === 'PUZZLE'
            ? 'Bundle'
            : 'Remove';
      return {
        product_id: Number(row.product_id),
        product_name: row.product_name,
        category_name: row.category_name || 'Uncategorized',
        station_name: row.station_name || 'Unassigned',
        sales_qty: qty,
        revenue,
        recipe_cost: recipeCost,
        gross_profit: grossProfit,
        margin_pct: marginPct,
        food_cost_pct: this.percent(totalCost, revenue),
        popularity_pct: popularityPct,
        classification,
        recommended_action: action,
      };
    });
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      items: enriched,
      quadrant_summary: enriched.reduce((acc, item) => {
        acc[item.classification] = (acc[item.classification] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      top_stars: enriched.filter((item) => item.classification === 'STAR').slice(0, 10),
      dogs: enriched.filter((item) => item.classification === 'DOG').slice(0, 10),
      category_matrix: Object.values(enriched.reduce((acc, item) => {
        const key = item.category_name;
        acc[key] ??= { category_name: key, revenue: 0, gross_profit: 0, item_count: 0 };
        acc[key].revenue = this.toNumber(acc[key].revenue + item.revenue, 2);
        acc[key].gross_profit = this.toNumber(acc[key].gross_profit + item.gross_profit, 2);
        acc[key].item_count += 1;
        acc[key].margin_pct = this.percent(acc[key].gross_profit, acc[key].revenue);
        return acc;
      }, {} as Record<string, any>)),
    };
  }

  async getSalesTrends(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    if (branchIds.length === 0) return { filters: dateRange, hourly: [], daily: [], weekly: [], monthly: [] };
    const base = this.orderRepo
      .createQueryBuilder('posOrder')
      .where('posOrder.client_id = :clientId', { clientId })
      .andWhere('posOrder.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('posOrder.order_status = :status', { status: 'completed' })
      .andWhere('posOrder.created_at >= :start AND posOrder.created_at <= :end', dateRange);
    const [hourly, daily, monthly] = await Promise.all([
      base.clone().select('HOUR(posOrder.created_at)', 'bucket').addSelect('SUM(posOrder.total_amount)', 'sales').addSelect('COUNT(posOrder.id)', 'orders').groupBy('HOUR(posOrder.created_at)').orderBy('bucket', 'ASC').getRawMany(),
      base.clone().select('DATE(posOrder.created_at)', 'bucket').addSelect('SUM(posOrder.total_amount)', 'sales').addSelect('COUNT(posOrder.id)', 'orders').addSelect('SUM(posOrder.discount_amount)', 'discounts').groupBy('DATE(posOrder.created_at)').orderBy('bucket', 'ASC').getRawMany(),
      base.clone().select(`DATE_FORMAT(posOrder.created_at, '%Y-%m')`, 'bucket').addSelect('SUM(posOrder.total_amount)', 'sales').addSelect('COUNT(posOrder.id)', 'orders').groupBy(`DATE_FORMAT(posOrder.created_at, '%Y-%m')`).orderBy('bucket', 'ASC').getRawMany(),
    ]);
    const mapRows = (rows: any[]) => rows.map((row) => ({
      bucket: row.bucket,
      sales: this.toNumber(row.sales, 2),
      orders: this.toInteger(row.orders),
      avg_order: this.toInteger(row.orders) > 0 ? this.toNumber(Number(row.sales || 0) / Number(row.orders || 1), 2) : 0,
      discounts: this.toNumber(row.discounts, 2),
    }));
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      hourly: mapRows(hourly),
      daily: mapRows(daily),
      weekly: mapRows(daily).reduce((acc: any[], row) => {
        const weekKey = row.bucket ? `${new Date(row.bucket).getFullYear()}-W${Math.ceil((new Date(row.bucket).getDate()) / 7)}` : 'unknown';
        const bucket = acc.find((entry) => entry.bucket === weekKey) ?? { bucket: weekKey, sales: 0, orders: 0 };
        if (!acc.includes(bucket)) acc.push(bucket);
        bucket.sales = this.toNumber(bucket.sales + row.sales, 2);
        bucket.orders += row.orders;
        bucket.avg_order = bucket.orders > 0 ? this.toNumber(bucket.sales / bucket.orders, 2) : 0;
        return acc;
      }, []),
      monthly: mapRows(monthly),
      weekend_vs_weekday: mapRows(daily).reduce((acc, row) => {
        const day = row.bucket ? new Date(row.bucket).getDay() : 1;
        const key = day === 0 || day === 6 ? 'weekend' : 'weekday';
        acc[key].sales = this.toNumber(acc[key].sales + row.sales, 2);
        acc[key].orders += row.orders;
        return acc;
      }, { weekend: { sales: 0, orders: 0 }, weekday: { sales: 0, orders: 0 } }),
      ramadan_support: {
        note: 'Ramadan tagging is date-window ready; configure annual Ramadan calendar windows to compare Sehri/Iftar demand patterns.',
      },
    };
  }

  async getBranchAnalytics(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const overview = await this.buildOverview(clientId, accessibleBranchIds, filters);
    const rows = (overview.branches ?? []).map((branch: BranchOperationsSummary) => ({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      branch_sales: branch.sales.total_revenue,
      branch_orders: branch.sales.completed_orders,
      branch_gp: branch.profitability.estimated_gross_margin ?? 0,
      branch_food_cost_pct: this.percent(branch.profitability.estimated_cogs ?? 0, branch.sales.total_revenue),
      branch_waste_pct: this.percent(branch.inventory_movements.wastage_cost, branch.profitability.estimated_cogs ?? 0),
      branch_margin_pct: branch.profitability.estimated_gross_margin_pct ?? 0,
      branch_refund_pct: 0,
      branch_discounts: 0,
      branch_aov: branch.sales.average_order_value,
      negative_stock_count: branch.inventory.negative_stock_count,
      low_stock_count: branch.inventory.low_stock_count,
    }));
    return {
      filters: overview.filters_applied,
      rows: rows.sort((left, right) => right.branch_sales - left.branch_sales),
      best_branch: rows.length ? [...rows].sort((left, right) => right.branch_sales - left.branch_sales)[0] : null,
      worst_branch: rows.length ? [...rows].sort((left, right) => left.branch_sales - right.branch_sales)[0] : null,
    };
  }

  async getStationAnalytics(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const menu = await this.getMenuEngineering(clientId, accessibleBranchIds, filters);
    const menuItems = (menu.items ?? []) as any[];
    const totalRevenue = menuItems.reduce((sum: number, item: any) => sum + Number(item.revenue || 0), 0);
    const rows = Object.values(menuItems.reduce((acc: Record<string, any>, item: any) => {
      const key = item.station_name || 'Unassigned';
      acc[key] ??= { station_name: key, revenue: 0, gross_profit: 0, orders_count: 0, recipe_cost: 0 };
      acc[key].revenue = this.toNumber(acc[key].revenue + item.revenue, 2);
      acc[key].gross_profit = this.toNumber(acc[key].gross_profit + item.gross_profit, 2);
      acc[key].recipe_cost = this.toNumber(acc[key].recipe_cost + item.recipe_cost * item.sales_qty, 2);
      acc[key].orders_count = this.toNumber(acc[key].orders_count + item.sales_qty, 3);
      return acc;
    }, {})).map((row: any) => ({
      ...row,
      revenue_pct: this.percent(row.revenue, totalRevenue),
      gp_pct: this.percent(row.gross_profit, row.revenue),
      food_cost_pct: this.percent(row.recipe_cost, row.revenue),
      waste_pct: 0,
      avg_prep_time: 0,
    })).sort((left: any, right: any) => right.revenue - left.revenue);
    return {
      filters: menu.filters,
      rows,
      best_station: rows[0] ?? null,
      worst_station: rows.length ? rows[rows.length - 1] : null,
      slowest_station: rows.length ? [...rows].sort((left: any, right: any) => right.avg_prep_time - left.avg_prep_time)[0] : null,
      highest_waste_station: rows.length ? [...rows].sort((left: any, right: any) => right.waste_pct - left.waste_pct)[0] : null,
    };
  }

  async getInventoryAnalytics(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    if (branchIds.length === 0) return { filters: dateRange, top_consumed: [], high_cost: [], dead_stock: [] };
    const outbound = await this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .innerJoin('ledger.item', 'item')
      .select('item.id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('item.uom_base', 'uom')
      .addSelect('SUM(ABS(ledger.quantity))', 'consumed_qty')
      .addSelect('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'consumed_cost')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ledger.created_at >= :start AND ledger.created_at <= :end', dateRange)
      .andWhere('ledger.quantity < 0')
      .groupBy('item.id')
      .addGroupBy('item.item_name')
      .addGroupBy('item.uom_base')
      .orderBy('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'DESC')
      .limit(25)
      .getRawMany();
    const stockRows = await this.orderRepo.manager.createQueryBuilder()
      .from('inventory_stock_levels', 'stock')
      .innerJoin('inventory_items', 'item', 'item.id = stock.item_id')
      .select('item.id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('stock.current_quantity', 'current_quantity')
      .addSelect('stock.last_unit_cost', 'unit_cost')
      .addSelect('(stock.current_quantity * stock.last_unit_cost)', 'stock_value')
      .where('stock.client_id = :clientId', { clientId })
      .andWhere('stock.branch_id IN (:...branchIds)', { branchIds })
      .orderBy('(stock.current_quantity * stock.last_unit_cost)', 'DESC')
      .limit(50)
      .getRawMany();
    const cogs = await this.loadCogsTotal(clientId, branchIds, dateRange);
    const inventory = await this.loadInventoryValue(clientId, branchIds);
    const dayCount = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000));
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      top_consumed_ingredients: outbound.map((row) => ({
        item_id: Number(row.item_id),
        item_name: row.item_name,
        uom: row.uom,
        consumed_qty: this.toNumber(row.consumed_qty, 4),
        consumed_cost: this.toNumber(row.consumed_cost, 2),
      })),
      high_cost_ingredients: stockRows.slice(0, 20).map((row) => ({
        item_id: Number(row.item_id),
        item_name: row.item_name,
        current_quantity: this.toNumber(row.current_quantity, 4),
        unit_cost: this.toNumber(row.unit_cost, 4),
        stock_value: this.toNumber(row.stock_value, 2),
      })),
      slow_moving_items: stockRows.filter((row) => Number(row.current_quantity || 0) > 0).slice(-15),
      dead_stock: stockRows.filter((row) => Number(row.current_quantity || 0) > 0 && !outbound.some((out) => Number(out.item_id) === Number(row.item_id))).slice(0, 15),
      inventory_turnover: inventory.inventory_value > 0 ? this.toNumber(cogs / inventory.inventory_value, 2) : 0,
      days_inventory_on_hand: cogs > 0 ? this.toNumber(inventory.inventory_value / (cogs / dayCount), 1) : 0,
      inventory_value: inventory.inventory_value,
      negative_stock_count: inventory.negative_stock_count,
    };
  }

  async getWasteCommandCenter(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    if (branchIds.length === 0) return { filters: dateRange, by_item: [], by_branch: [], trend: [] };
    const base = this.stockLedgerRepo
      .createQueryBuilder('ledger')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('ledger.created_at >= :start AND ledger.created_at <= :end', dateRange)
      .andWhere('ledger.transaction_type = :type', { type: 'wastage' });
    const [byItem, byBranch, trend] = await Promise.all([
      base.clone().innerJoin('ledger.item', 'item').select('item.id', 'item_id').addSelect('item.item_name', 'item_name').addSelect('SUM(ABS(ledger.quantity))', 'waste_qty').addSelect('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'waste_cost').groupBy('item.id').addGroupBy('item.item_name').orderBy('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'DESC').limit(20).getRawMany(),
      base.clone().innerJoin('ledger.branch', 'branch').select('branch.id', 'branch_id').addSelect('branch.branch_name', 'branch_name').addSelect('SUM(ABS(ledger.quantity))', 'waste_qty').addSelect('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'waste_cost').groupBy('branch.id').addGroupBy('branch.branch_name').orderBy('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'DESC').getRawMany(),
      base.clone().select('DATE(ledger.created_at)', 'date').addSelect('SUM(ABS(ledger.quantity) * ledger.unit_cost)', 'waste_cost').groupBy('DATE(ledger.created_at)').orderBy('date', 'ASC').getRawMany(),
    ]);
    const cogs = await this.loadCogsTotal(clientId, branchIds, dateRange);
    const totalWaste = byItem.reduce((sum, row) => sum + Number(row.waste_cost || 0), 0);
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      summary: {
        waste_cost: this.toNumber(totalWaste, 2),
        waste_pct: this.percent(totalWaste, cogs),
      },
      by_item: byItem.map((row) => ({ ...row, waste_qty: this.toNumber(row.waste_qty, 4), waste_cost: this.toNumber(row.waste_cost, 2) })),
      by_branch: byBranch.map((row) => ({ ...row, waste_qty: this.toNumber(row.waste_qty, 4), waste_cost: this.toNumber(row.waste_cost, 2) })),
      by_category: [],
      by_station: [],
      trend: trend.map((row) => ({ date: row.date, waste_cost: this.toNumber(row.waste_cost, 2) })),
      top_waste_items: byItem.slice(0, 5),
      top_waste_branches: byBranch.slice(0, 5),
    };
  }

  async getForecast(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const sales = await this.getSalesTrends(clientId, accessibleBranchIds, filters);
    const daily = sales.daily ?? [];
    const lastSeven = daily.slice(-7);
    const movingAverage = lastSeven.length > 0
      ? lastSeven.reduce((sum: number, row: any) => sum + row.sales, 0) / lastSeven.length
      : 0;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inventory = await this.getInventoryAnalytics(clientId, accessibleBranchIds, filters);
    const demandItems = (inventory.top_consumed_ingredients ?? []).slice(0, 10).map((item: any) => ({
      item_name: item.item_name,
      projected_daily_qty: this.toNumber(item.consumed_qty / Math.max(1, daily.length || 1), 4),
      purchase_need_signal: item.consumed_cost > 0 ? 'review' : 'low',
    }));
    return {
      filters: sales.filters,
      tomorrow_sales: this.toNumber(movingAverage, 2),
      weekly_sales: this.toNumber(movingAverage * 7, 2),
      forecast: Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(tomorrow);
        date.setDate(tomorrow.getDate() + index);
        return { date: date.toISOString().slice(0, 10), projected_sales: this.toNumber(movingAverage, 2) };
      }),
      ingredient_demand: demandItems,
      purchase_needs: demandItems,
      production_requirements: demandItems.map((item: any) => ({ item_name: item.item_name, suggested_batch_qty: item.projected_daily_qty })),
      method: 'Trailing moving average with weekday-ready daily buckets and inventory consumption signals.',
    };
  }

  async getRecommendations(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const [kpis, menu, inventory, waste, branch] = await Promise.all([
      this.getExecutiveKpis(clientId, accessibleBranchIds, filters),
      this.getMenuEngineering(clientId, accessibleBranchIds, filters),
      this.getInventoryAnalytics(clientId, accessibleBranchIds, filters),
      this.getWasteCommandCenter(clientId, accessibleBranchIds, filters),
      this.getBranchAnalytics(clientId, accessibleBranchIds, filters),
    ]);
    const recommendations: Array<{ area: string; severity: string; message: string; action: string }> = [];
    for (const item of menu.items.filter((row: any) => row.classification === 'PLOWHORSE').slice(0, 5)) {
      recommendations.push({ area: 'Pricing', severity: 'medium', message: `${item.product_name} is popular but low margin.`, action: 'Reprice or reduce recipe cost.' });
    }
    for (const item of ((menu.dogs ?? []) as any[]).slice(0, 5)) {
      recommendations.push({ area: 'Menu', severity: 'low', message: `${item.product_name} is low popularity and low margin.`, action: 'Remove, bundle, or reposition.' });
    }
    if (kpis.negative_stock_count > 0) {
      recommendations.push({ area: 'Inventory', severity: 'high', message: `${kpis.negative_stock_count} item(s) have negative stock.`, action: 'Run stock count and investigate posting gaps.' });
    }
    const wastePct = Number(waste.summary?.waste_pct || 0);
    if (wastePct > 5) {
      recommendations.push({ area: 'Operations', severity: 'high', message: `Waste is ${wastePct}% of consumption cost.`, action: 'Review top waste items and prep controls.' });
    }
    if (branch.worst_branch) {
      recommendations.push({ area: 'Branch', severity: 'medium', message: `${branch.worst_branch.branch_name} is the lowest sales branch in scope.`, action: 'Compare staffing, menu mix, and inventory pressure with the best branch.' });
    }
    for (const item of (inventory.dead_stock ?? []).slice(0, 5)) {
      recommendations.push({ area: 'Inventory', severity: 'medium', message: `${item.item_name} has stock but no consumption in the period.`, action: 'Reduce purchasing or create a usage plan.' });
    }
    return { filters: kpis.filters, recommendations };
  }

  async getCustomerAnalytics(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    if (branchIds.length === 0) return { filters: dateRange, summary: {}, top_customers: [] };
    const rows = await this.orderRepo
      .createQueryBuilder('posOrder')
      .leftJoin('posOrder.customer', 'customer')
      .select('customer.id', 'customer_id')
      .addSelect('customer.name', 'customer_name')
      .addSelect('COUNT(posOrder.id)', 'orders')
      .addSelect('SUM(posOrder.total_amount)', 'spend')
      .where('posOrder.client_id = :clientId', { clientId })
      .andWhere('posOrder.branch_id IN (:...branchIds)', { branchIds })
      .andWhere('posOrder.order_status = :status', { status: 'completed' })
      .andWhere('posOrder.created_at >= :start AND posOrder.created_at <= :end', dateRange)
      .andWhere('posOrder.customer_id IS NOT NULL')
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .orderBy('SUM(posOrder.total_amount)', 'DESC')
      .limit(25)
      .getRawMany();
    const repeat = rows.filter((row) => Number(row.orders || 0) > 1).length;
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      summary: {
        customer_count: rows.length,
        repeat_customers_pct: this.percent(repeat, rows.length),
        new_customers_pct: this.percent(rows.length - repeat, rows.length),
      },
      top_customers: rows.map((row) => ({ ...row, orders: this.toInteger(row.orders), spend: this.toNumber(row.spend, 2) })),
      lost_customers: [],
    };
  }

  async getLaborAnalytics(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const { branchIds, dateRange } = await this.resolveBiScope(clientId, accessibleBranchIds, filters);
    const [sales, laborCost] = await Promise.all([
      this.loadSalesTotals(clientId, branchIds, dateRange),
      this.loadLaborCost(clientId, branchIds, dateRange),
    ]);
    return {
      filters: { ...dateRange, branch_ids: branchIds },
      labor_cost: laborCost,
      labor_cost_pct: this.percent(laborCost, sales.net_sales),
      sales_per_employee: 0,
      orders_per_staff: 0,
      productivity_note: 'Connect approved payroll run lines to user shifts for staff-level productivity.',
    };
  }

  async getCommandCenter(clientId: string, accessibleBranchIds?: number[], filters?: OperationsFilters) {
    const [kpi, menu_engineering, sales_trends, branch, station, inventory, waste, forecast, recommendations, customer, labor] = await Promise.all([
      this.getExecutiveKpis(clientId, accessibleBranchIds, filters),
      this.getMenuEngineering(clientId, accessibleBranchIds, filters),
      this.getSalesTrends(clientId, accessibleBranchIds, filters),
      this.getBranchAnalytics(clientId, accessibleBranchIds, filters),
      this.getStationAnalytics(clientId, accessibleBranchIds, filters),
      this.getInventoryAnalytics(clientId, accessibleBranchIds, filters),
      this.getWasteCommandCenter(clientId, accessibleBranchIds, filters),
      this.getForecast(clientId, accessibleBranchIds, filters),
      this.getRecommendations(clientId, accessibleBranchIds, filters),
      this.getCustomerAnalytics(clientId, accessibleBranchIds, filters),
      this.getLaborAnalytics(clientId, accessibleBranchIds, filters),
    ]);
    return {
      filters: kpi.filters,
      kpi,
      menu_engineering,
      sales_trends,
      branch,
      station,
      inventory,
      waste,
      forecast,
      recommendations,
      customer,
      labor,
      alerts: recommendations.recommendations.filter((item) => ['high', 'critical'].includes(item.severity)),
      reports: [
        'Executive Summary Report',
        'Menu Engineering Report',
        'Branch Comparison Report',
        'Waste Report',
        'Inventory Health Report',
        'Forecast Report',
        'Recommendation Report',
      ],
    };
  }

  async getManagementKpis(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const overview = await this.buildOverview(clientId, accessibleBranchIds, filters);
    const resolvedBranchIds = this.normalizeBranchIds(
      overview?.filters_applied?.resolved_branch_ids,
    );
    const range = this.resolveDateRange(filters);
    const dailyRows = await this.loadDailyRevenueSeries(
      clientId,
      resolvedBranchIds,
      range,
      filters,
    );
    const dailyRevenue = this.buildContinuousDateSeries(range, dailyRows);
    const trailingWindow = this.summarizeTrailingWindow(dailyRevenue, 7);

    return {
      generated_at: overview.generated_at,
      date_range: overview.date_range,
      filters_applied: overview.filters_applied,
      access_scope: overview.access_scope,
      summary_cards: {
        total_revenue: overview.summary.total_revenue,
        completed_orders: overview.summary.completed_orders,
        average_order_value: overview.summary.average_order_value,
        estimated_gross_margin: overview.profitability_summary?.estimated_gross_margin ?? null,
        estimated_gross_margin_pct: overview.profitability_summary?.estimated_gross_margin_pct ?? null,
        procurement_backlog:
          overview.procurement_summary.pending_requests +
          overview.procurement_summary.pending_approval_purchase_orders +
          overview.procurement_summary.awaiting_receipt_purchase_orders,
        inventory_pressure:
          overview.summary.low_stock_items +
          overview.summary.out_of_stock_items +
          overview.summary.negative_stock_items,
        transfer_bottlenecks: overview.summary.transfer_bottlenecks,
        open_shifts: overview.summary.open_shifts,
      },
      trend_summary: trailingWindow,
      revenue_series: dailyRevenue,
      branch_rankings: {
        revenue: overview.comparisons.revenue_ranking.slice(0, 5),
        gross_margin: overview.comparisons.gross_margin_ranking.slice(0, 5),
        inventory_pressure: overview.comparisons.inventory_pressure_ranking.slice(0, 5),
        procurement_backlog: overview.comparisons.procurement_backlog_ranking.slice(0, 5),
      },
      attention: {
        exceptions: overview.exceptions.slice(0, 10),
        branches_with_exceptions: new Set(
          overview.exceptions.map((item: BranchOperationsException) => item.branch_id),
        ).size,
      },
      exports: {
        branch_summary_rows: overview.exports.branch_summary_rows,
        daily_revenue_rows: dailyRevenue.map((row) => ({
          date_from: overview.date_range.date_from,
          date_to: overview.date_range.date_to,
          business_date: row.business_date,
          total_revenue: row.total_revenue,
          completed_orders: row.completed_orders,
        })),
      },
    };
  }

  async getBranchManagementSnapshot(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const detail = await this.getBranchOperationsDetail(
      clientId,
      branchId,
      accessibleBranchIds,
      filters,
    );
    const range = this.resolveDateRange(filters);
    const dailyRows = await this.loadDailyRevenueSeries(
      clientId,
      [branchId],
      range,
      filters,
    );
    const salesTrend = this.buildContinuousDateSeries(range, dailyRows);
    const trailingWindow = this.summarizeTrailingWindow(salesTrend, 7);
    const inventoryPressureCount =
      Number(detail.inventory?.low_stock_count || 0) +
      Number(detail.inventory?.out_of_stock_count || 0) +
      Number(detail.inventory?.negative_stock_count || 0);

    return {
      generated_at: detail.generated_at,
      date_range: detail.date_range,
      filters_applied: detail.filters_applied,
      branch: detail.branch,
      cards: {
        total_revenue: detail.sales.total_revenue,
        completed_orders: detail.sales.completed_orders,
        average_order_value: detail.sales.average_order_value,
        open_orders: detail.sales.open_orders,
        low_stock_items: detail.inventory.low_stock_count,
        out_of_stock_items: detail.inventory.out_of_stock_count,
        wastage_cost: detail.inventory_movements.wastage_cost,
        procurement_backlog:
          detail.procurement.pending_requests +
          detail.procurement.pending_approval_purchase_orders +
          detail.procurement.awaiting_receipt_purchase_orders,
        estimated_gross_margin: detail.profitability.estimated_gross_margin,
        estimated_gross_margin_pct: detail.profitability.estimated_gross_margin_pct,
      },
      trend_summary: trailingWindow,
      sales_trend: salesTrend,
      top_products: detail.top_items,
      operational_health: {
        waste_level:
          detail.inventory.enabled_item_count > 0
            ? this.toNumber(
                (detail.inventory.low_stock_count / detail.inventory.enabled_item_count) * 100,
                2,
              )
            : 0,
        inventory_pressure_count: inventoryPressureCount,
        profitability_available: detail.profitability.available,
        profitability_note: detail.profitability.available
          ? `Estimated gross margin ${this.toNumber(detail.profitability.estimated_gross_margin_pct, 2)}% for the selected reporting scope.`
          : detail.profitability.unavailable_reason,
        open_transfers: detail.transfers.incoming_open_count + detail.transfers.outgoing_open_count,
      },
      exports: {
        sales_trend_rows: salesTrend.map((row) => ({
          branch_id: detail.branch.id,
          branch_name: detail.branch.branch_name,
          business_date: row.business_date,
          total_revenue: row.total_revenue,
          completed_orders: row.completed_orders,
        })),
        top_product_rows: detail.exports.sales_top_item_rows,
      },
    };
  }

  async getBranchOperationsDetail(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const overview = await this.buildOverview(
      clientId,
      accessibleBranchIds,
      filters,
      branchId,
    );
    const branchMetrics = overview.branches[0];
    if (!branchMetrics) {
      throw new NotFoundException('Branch reporting scope not found.');
    }

    const range = this.resolveDateRange(filters);
    const backlogCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const [
      topItems,
      lowStockItems,
      procurementAttention,
      transferWatchlist,
      salesCategoryBreakdown,
      inventoryClassBreakdown,
      recentInventoryMovements,
    ] = await Promise.all([
      this.loadTopItems(clientId, branchId, range, filters),
      this.loadLowStockItems(clientId, branchId, filters),
      this.loadProcurementAttention(clientId, branchId),
      this.loadTransferWatchlist(clientId, branchId, backlogCutoff, filters),
      this.loadSalesCategoryBreakdown(clientId, branchId, range, filters),
      this.loadInventoryClassBreakdown(clientId, branchId, filters),
      this.loadRecentInventoryMovements(clientId, branchId, range, filters),
    ]);

    const salesByCategory = salesCategoryBreakdown.map((row) => ({
      category_id: this.toInteger(row.category_id),
      category_name: row.category_name,
      completed_orders: this.toInteger(row.completed_orders),
      quantity_sold: this.toNumber(row.quantity_sold, 2),
      revenue: this.toNumber(row.revenue, 2),
    }));

    const inventoryByClass = inventoryClassBreakdown.map((row) => ({
      inventory_class_id: this.toInteger(row.inventory_class_id),
      inventory_class_name: row.inventory_class_name,
      enabled_item_count: this.toInteger(row.enabled_item_count),
      on_hand_quantity: this.toNumber(row.on_hand_quantity, 2),
      low_stock_count: this.toInteger(row.low_stock_count),
    }));

    const movementRows = recentInventoryMovements.map((row) => ({
      id: this.toInteger(row.id),
      transaction_type: row.transaction_type,
      reference_id: row.reference_id,
      quantity: this.toNumber(row.quantity, 4),
      unit_cost: this.toNumber(row.unit_cost, 4),
      extended_cost: this.toNumber(
        Math.abs(Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0)),
        2,
      ),
      created_at: row.created_at,
      item_id: this.toInteger(row.item_id),
      item_name: row.item_name,
      item_sku: row.item_sku,
      inventory_class_name: row.inventory_class_name,
    }));

    return {
      generated_at: overview.generated_at,
      date_range: overview.date_range,
      filters_applied: overview.filters_applied,
      branch: {
        id: branchMetrics.branch_id,
        branch_name: branchMetrics.branch_name,
        branch_code: branchMetrics.branch_code,
        status: branchMetrics.status,
        inventory_store_type: branchMetrics.inventory_store_type,
      },
      sales: branchMetrics.sales,
      inventory: branchMetrics.inventory,
      procurement: branchMetrics.procurement,
      transfers: branchMetrics.transfers,
      operations: branchMetrics.operations,
      inventory_movements: branchMetrics.inventory_movements,
      profitability: branchMetrics.profitability,
      top_items: topItems.map((row) => ({
        product_id: this.toInteger(row.product_id),
        product_name: row.product_name,
        category_id: this.toInteger(row.category_id),
        category_name: row.category_name,
        quantity_sold: this.toNumber(row.quantity_sold, 2),
        revenue: this.toNumber(row.revenue, 2),
      })),
      sales_by_category: salesByCategory,
      inventory_by_class: inventoryByClass,
      low_stock_items: lowStockItems.map((row) => ({
        item_id: this.toInteger(row.item_id),
        item_name: row.item_name,
        item_sku: row.item_sku,
        uom_base: row.uom_base,
        inventory_class_id: this.toInteger(row.inventory_class_id),
        inventory_class_name: row.inventory_class_name,
        min_stock_level: this.toNumber(row.min_stock_level, 2),
        current_quantity: this.toNumber(row.current_quantity, 2),
        alert_state: row.alert_state,
      })),
      recent_inventory_movements: movementRows,
      procurement_attention: procurementAttention,
      transfer_watchlist: transferWatchlist.map((row) => ({
        id: row.id,
        transfer_no: row.transfer_no,
        status: row.status,
        requested_at: row.requested_at,
        age_days: row.age_days,
        direction:
          row.source_branch_name === branchMetrics.branch_name
            ? 'outgoing'
            : 'incoming',
        source_branch_name: row.source_branch_name,
        destination_branch_name: row.destination_branch_name,
      })),
      exceptions: overview.exceptions.filter(
        (exception: BranchOperationsException) =>
          exception.branch_id === branchId,
      ),
      exports: {
        sales_top_item_rows: topItems.map((row) => ({
          date_from: overview.date_range.date_from,
          date_to: overview.date_range.date_to,
          branch_id: branchMetrics.branch_id,
          branch_name: branchMetrics.branch_name,
          product_id: this.toInteger(row.product_id),
          product_name: row.product_name,
          category_name: row.category_name,
          quantity_sold: this.toNumber(row.quantity_sold, 2),
          revenue: this.toNumber(row.revenue, 2),
        })),
        sales_category_rows: salesByCategory.map((row) => ({
          date_from: overview.date_range.date_from,
          date_to: overview.date_range.date_to,
          branch_id: branchMetrics.branch_id,
          branch_name: branchMetrics.branch_name,
          ...row,
        })),
        low_stock_rows: lowStockItems.map((row) => ({
          branch_id: branchMetrics.branch_id,
          branch_name: branchMetrics.branch_name,
          item_id: this.toInteger(row.item_id),
          item_name: row.item_name,
          item_sku: row.item_sku,
          inventory_class_name: row.inventory_class_name,
          min_stock_level: this.toNumber(row.min_stock_level, 2),
          current_quantity: this.toNumber(row.current_quantity, 2),
          alert_state: row.alert_state,
        })),
        inventory_movement_rows: movementRows.map((row) => ({
          branch_id: branchMetrics.branch_id,
          branch_name: branchMetrics.branch_name,
          ...row,
        })),
      },
    };
  }

  async getBranchMetrics(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
    filters?: OperationsFilters,
  ) {
    const detail = await this.getBranchOperationsDetail(
      clientId,
      branchId,
      accessibleBranchIds,
      filters,
    );

    return {
      dailyRevenue: detail.sales.total_revenue,
      totalOrders: detail.sales.completed_orders,
      averageOrderValue: detail.sales.average_order_value,
      activeTables: detail.sales.open_orders,
      topProducts: detail.top_items.map((item: any) => ({
        name: item.product_name,
        count: item.quantity_sold,
        revenue: item.revenue,
      })),
      wasteLevel:
        detail.inventory.enabled_item_count > 0
          ? this.toNumber(
              (detail.inventory.low_stock_count /
                detail.inventory.enabled_item_count) *
                100,
              2,
            )
          : 0,
      lowStockItems: detail.inventory.low_stock_count,
      outOfStockItems: detail.inventory.out_of_stock_count,
      wastageCost: detail.inventory_movements.wastage_cost,
      adjustmentCostImpact: detail.inventory_movements.adjustment_cost_impact,
      procurementBacklog:
        detail.procurement.pending_requests +
        detail.procurement.pending_approval_purchase_orders +
        detail.procurement.awaiting_receipt_purchase_orders,
      estimatedGrossMargin: detail.profitability.estimated_gross_margin,
      estimatedGrossMarginPct: detail.profitability.estimated_gross_margin_pct,
      profitabilityAvailable: detail.profitability.available,
      hourlySales: [],
      raw: detail,
    };
  }
}
