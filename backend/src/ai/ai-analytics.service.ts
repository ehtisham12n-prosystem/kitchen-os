import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../catalog/entities/product.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { Order } from '../pos/entities/order.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';

type RecommendationUrgency = 'critical' | 'high' | 'medium' | 'stable';
type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';

interface RecommendationItem {
  item_id: number;
  item_name: string;
  item_sku: string | null;
  uom_base: string | null;
  current_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  avg_daily_outbound: number;
  recent_daily_outbound: number;
  trailing_30_day_outbound: number;
  trailing_7_day_outbound: number;
  trailing_30_day_wastage: number;
  target_stock_level: number;
  suggested_reorder_quantity: number;
  days_of_cover: number | null;
  urgency: RecommendationUrgency;
  stock_status:
    | 'out_of_stock'
    | 'below_minimum'
    | 'below_target'
    | 'above_maximum'
    | 'stable'
    | 'no_recent_demand';
  last_received_at: string | null;
  last_outbound_at: string | null;
  days_since_last_outbound: number | null;
  estimated_on_hand_value: number | null;
  explanation: string;
  reason_codes: string[];
}

interface SlowMoverInsight {
  item_id: number;
  item_name: string;
  item_sku: string | null;
  current_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  days_of_cover: number | null;
  days_since_last_outbound: number | null;
  days_since_last_received: number | null;
  estimated_on_hand_value: number | null;
  severity: RecommendationSeverity;
  message: string;
  recommended_action: string;
}

interface RecommendationAnomaly {
  type:
    | 'sales_spike'
    | 'sales_drop'
    | 'inventory_negative_stock'
    | 'inventory_demand_spike'
    | 'inventory_wastage_pressure';
  severity: RecommendationSeverity;
  detected_on: string | null;
  title: string;
  message: string;
  metric_value: number;
  baseline_value: number | null;
  item_id?: number;
  item_name?: string;
}

interface RecommendationDataset {
  generated_at: string;
  branch_id: number;
  policy: {
    history_days: number;
    forecast_days: number;
    target_cover_days: number;
    safety_days: number;
    demand_basis: string;
  };
  summary: {
    enabled_items: number;
    actionable_reorders: number;
    critical_reorders: number;
    high_reorders: number;
    slow_movers: number;
    anomaly_count: number;
    items_without_recent_demand: number;
  };
  items: RecommendationItem[];
  reorder_suggestions: RecommendationItem[];
  slow_movers: SlowMoverInsight[];
  anomalies: RecommendationAnomaly[];
}

@Injectable()
export class AiAnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(ProductionOrder)
    private readonly prodRepo: Repository<ProductionOrder>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  private assertBranchScope(branchId: number, accessibleBranchIds?: number[]) {
    const normalized = (accessibleBranchIds ?? []).filter(
      (value) => Number.isInteger(value) && value > 0,
    );
    if (normalized.length > 0 && !normalized.includes(branchId)) {
      throw new NotFoundException('Branch reporting scope not found.');
    }
  }

  private toNumber(value: unknown, precision = 2) {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized)) {
      return 0;
    }
    return Number(normalized.toFixed(precision));
  }

  private toInteger(value: unknown) {
    return Math.trunc(this.toNumber(value, 0));
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private startOfDay(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private endOfDay(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }

  private addDays(date: Date, days: number) {
    const normalized = new Date(date);
    normalized.setDate(normalized.getDate() + days);
    return normalized;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toIsoDateTime(value: unknown): string | null {
    const parsed = this.parseDate(value);
    return parsed ? parsed.toISOString() : null;
  }

  private daysSince(value: unknown): number | null {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return null;
    }
    return Math.max(
      0,
      Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private buildDateSeries(
    days: number,
    map: Map<string, { amount: number; orders: number }>,
    referenceDate = new Date(),
  ) {
    const end = this.endOfDay(referenceDate);
    const start = this.startOfDay(this.addDays(end, -Math.max(days - 1, 0)));
    const series: Array<{ date: string; amount: number; orders: number }> = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = this.formatDate(cursor);
      const value = map.get(key);
      series.push({
        date: key,
        amount: this.toNumber(value?.amount ?? 0, 2),
        orders: this.toInteger(value?.orders ?? 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private severityWeight(severity: RecommendationSeverity) {
    return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
  }

  private urgencyWeight(urgency: RecommendationUrgency) {
    return { critical: 4, high: 3, medium: 2, stable: 1 }[urgency];
  }

  private weightedDemandRate(trailing30: number, trailing7: number) {
    const baseline = trailing30 > 0 ? trailing30 / 30 : 0;
    const recent = trailing7 > 0 ? trailing7 / 7 : 0;
    if (baseline <= 0 && recent <= 0) {
      return 0;
    }
    if (baseline <= 0) {
      return this.toNumber(recent, 4);
    }
    if (recent <= 0) {
      return this.toNumber(baseline, 4);
    }
    return this.toNumber((baseline * 0.55) + (recent * 0.45), 4);
  }

  private buildSalesAnomalies(
    rows: Array<Record<string, unknown>>,
  ): RecommendationAnomaly[] {
    const grouped = new Map<string, { amount: number; orders: number }>();
    for (const row of rows) {
      grouped.set(String(row.business_date), {
        amount: this.toNumber(row.total_amount, 2),
        orders: this.toInteger(row.completed_orders),
      });
    }

    const series = this.buildDateSeries(21, grouped);
    const anomalies: RecommendationAnomaly[] = [];

    for (let index = 14; index < series.length; index += 1) {
      const current = series[index];
      const baselineWindow = series.slice(index - 14, index);
      const baseline = baselineWindow.reduce((sum, row) => sum + row.amount, 0)
        / Math.max(baselineWindow.length, 1);

      if (baseline <= 0) {
        continue;
      }

      if (current.amount >= baseline * 1.75 && current.amount - baseline >= 100) {
        anomalies.push({
          type: 'sales_spike',
          severity: current.amount >= baseline * 2.2 ? 'high' : 'medium',
          detected_on: current.date,
          title: 'Daily sales spike',
          message: `Revenue reached ${this.toNumber(current.amount, 2).toLocaleString()} on ${current.date}, above the trailing 14-day baseline of ${this.toNumber(baseline, 2).toLocaleString()}.`,
          metric_value: this.toNumber(current.amount, 2),
          baseline_value: this.toNumber(baseline, 2),
        });
      } else if (
        current.amount <= baseline * 0.45
        && baseline - current.amount >= 100
      ) {
        anomalies.push({
          type: 'sales_drop',
          severity: current.amount <= baseline * 0.25 ? 'high' : 'medium',
          detected_on: current.date,
          title: 'Daily sales drop',
          message: `Revenue fell to ${this.toNumber(current.amount, 2).toLocaleString()} on ${current.date} against a trailing 14-day baseline of ${this.toNumber(baseline, 2).toLocaleString()}.`,
          metric_value: this.toNumber(current.amount, 2),
          baseline_value: this.toNumber(baseline, 2),
        });
      }
    }

    return anomalies
      .sort((left, right) => {
        const severityDelta =
          this.severityWeight(right.severity)
          - this.severityWeight(left.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return String(right.detected_on ?? '').localeCompare(
          String(left.detected_on ?? ''),
        );
      })
      .slice(0, 5);
  }

  private async buildRecommendationDataset(
    clientId: string,
    branchId: number,
  ): Promise<RecommendationDataset> {
    const generatedAt = new Date().toISOString();
    const now = new Date();
    const historyDays = 30;
    const forecastDays = 14;
    const safetyDays = 3;
    const last7Start = this.startOfDay(this.addDays(now, -6));
    const last21Start = this.startOfDay(this.addDays(now, -20));
    const last30Start = this.startOfDay(this.addDays(now, -29));
    const last60Start = this.startOfDay(this.addDays(now, -59));

    const enabledItems = await this.branchInventoryRepo
      .createQueryBuilder('branch_inventory')
      .innerJoin('branch_inventory.item', 'item')
      .leftJoin(
        StockLevel,
        'stock_level',
        [
          'stock_level.client_id = :clientId',
          'stock_level.branch_id = branch_inventory.branch_id',
          'stock_level.item_id = branch_inventory.item_id',
        ].join(' AND '),
        { clientId },
      )
      .select('branch_inventory.item_id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('item.item_sku', 'item_sku')
      .addSelect('item.uom_base', 'uom_base')
      .addSelect('branch_inventory.min_stock_level', 'min_stock_level')
      .addSelect('branch_inventory.max_stock_level', 'max_stock_level')
      .addSelect('COALESCE(stock_level.current_quantity, 0)', 'current_quantity')
      .addSelect('COALESCE(stock_level.last_unit_cost, 0)', 'last_unit_cost')
      .addSelect('stock_level.last_received_at', 'last_received_at')
      .where('branch_inventory.branch_id = :branchId', { branchId })
      .andWhere('branch_inventory.is_enabled = :enabled', { enabled: true })
      .andWhere('item.client_id = :clientId', { clientId })
      .orderBy('item.item_name', 'ASC')
      .getRawMany();

    if (enabledItems.length === 0) {
      return {
        generated_at: generatedAt,
        branch_id: branchId,
        policy: {
          history_days: historyDays,
          forecast_days: forecastDays,
          target_cover_days: forecastDays,
          safety_days: safetyDays,
          demand_basis: 'trailing outbound stock movements',
        },
        summary: {
          enabled_items: 0,
          actionable_reorders: 0,
          critical_reorders: 0,
          high_reorders: 0,
          slow_movers: 0,
          anomaly_count: 0,
          items_without_recent_demand: 0,
        },
        items: [],
        reorder_suggestions: [],
        slow_movers: [],
        anomalies: [],
      };
    }

    const itemIds = enabledItems.map((row) => Number(row.item_id));
    const [movementRows, salesRows] = await Promise.all([
      this.stockLedgerRepo
        .createQueryBuilder('ledger')
        .select('ledger.item_id', 'item_id')
        .addSelect(
          `COALESCE(SUM(CASE WHEN ledger.quantity < 0 AND ledger.created_at >= :last30Start THEN ABS(ledger.quantity) ELSE 0 END), 0)`,
          'outbound_30d',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN ledger.quantity < 0 AND ledger.created_at >= :last7Start THEN ABS(ledger.quantity) ELSE 0 END), 0)`,
          'outbound_7d',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN ledger.quantity < 0 AND ledger.transaction_type = 'wastage' AND ledger.created_at >= :last30Start THEN ABS(ledger.quantity) ELSE 0 END), 0)`,
          'wastage_30d',
        )
        .addSelect(
          `MAX(CASE WHEN ledger.quantity < 0 THEN ledger.created_at ELSE NULL END)`,
          'last_outbound_at',
        )
        .where('ledger.client_id = :clientId', { clientId })
        .andWhere('ledger.branch_id = :branchId', { branchId })
        .andWhere('ledger.item_id IN (:...itemIds)', { itemIds })
        .andWhere('ledger.created_at >= :last60Start', { last60Start })
        .groupBy('ledger.item_id')
        .setParameters({ last30Start, last7Start })
        .getRawMany(),
      this.orderRepo
        .createQueryBuilder('order')
        .select('DATE(order.created_at)', 'business_date')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total_amount')
        .addSelect('COUNT(order.id)', 'completed_orders')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at >= :last21Start', { last21Start })
        .groupBy('DATE(order.created_at)')
        .orderBy('DATE(order.created_at)', 'ASC')
        .getRawMany(),
    ]);

    const movementByItem = new Map(
      movementRows.map((row) => [
        Number(row.item_id),
        {
          outbound_30d: this.toNumber(row.outbound_30d, 4),
          outbound_7d: this.toNumber(row.outbound_7d, 4),
          wastage_30d: this.toNumber(row.wastage_30d, 4),
          last_outbound_at: this.toIsoDateTime(row.last_outbound_at),
        },
      ]),
    );

    const items: RecommendationItem[] = enabledItems.map((row) => {
      const currentQuantity = this.toNumber(row.current_quantity, 4);
      const minStockLevel = this.toNumber(row.min_stock_level, 4);
      const maxStockLevel = this.toNumber(row.max_stock_level, 4);
      const lastUnitCost = this.toNumber(row.last_unit_cost, 4);
      const movement = movementByItem.get(Number(row.item_id));
      const trailing30 = this.toNumber(movement?.outbound_30d ?? 0, 4);
      const trailing7 = this.toNumber(movement?.outbound_7d ?? 0, 4);
      const wastage30 = this.toNumber(movement?.wastage_30d ?? 0, 4);
      const avgDaily = this.weightedDemandRate(trailing30, trailing7);
      const recentDaily = trailing7 > 0 ? this.toNumber(trailing7 / 7, 4) : 0;
      const maxBoundary =
        maxStockLevel > 0 && maxStockLevel >= minStockLevel ? maxStockLevel : null;
      const usageTarget =
        avgDaily > 0 ? this.toNumber(avgDaily * (forecastDays + safetyDays), 4) : 0;
      let targetStock = Math.max(minStockLevel, usageTarget);
      if (maxBoundary !== null) {
        targetStock = Math.min(targetStock, maxBoundary);
      }
      if (targetStock <= 0 && minStockLevel > 0) {
        targetStock = minStockLevel;
      }

      let suggested = this.toNumber(Math.max(targetStock - currentQuantity, 0), 4);
      if (avgDaily <= 0 && minStockLevel > 0 && currentQuantity < minStockLevel) {
        suggested = this.toNumber(Math.max(minStockLevel - currentQuantity, 0), 4);
      }

      const daysOfCover =
        avgDaily > 0 ? this.toNumber(currentQuantity / avgDaily, 1) : null;
      const daysSinceLastOutbound = this.daysSince(movement?.last_outbound_at);
      const reasonCodes: string[] = [];
      if (currentQuantity <= 0) reasonCodes.push('out_of_stock');
      if (minStockLevel > 0 && currentQuantity < minStockLevel) {
        reasonCodes.push('below_minimum');
      }
      if (maxBoundary !== null && currentQuantity > maxBoundary) {
        reasonCodes.push('above_maximum');
      }
      if (avgDaily > 0) {
        reasonCodes.push('active_consumption');
      } else {
        reasonCodes.push('no_recent_consumption');
      }
      if (trailing30 > 0 && trailing7 > this.toNumber((trailing30 / 30) * 10.5, 4)) {
        reasonCodes.push('recent_demand_pickup');
      }
      if (trailing30 > 0 && wastage30 >= this.toNumber(trailing30 * 0.2, 4)) {
        reasonCodes.push('wastage_pressure');
      }

      let urgency: RecommendationUrgency = 'stable';
      if (suggested > 0) {
        if (
          currentQuantity <= 0
          || (daysOfCover !== null && daysOfCover <= 3)
          || (minStockLevel > 0 && currentQuantity < minStockLevel)
        ) {
          urgency = 'critical';
        } else if (
          (daysOfCover !== null && daysOfCover <= 7)
          || (minStockLevel > 0 && currentQuantity <= minStockLevel * 1.15)
        ) {
          urgency = 'high';
        } else {
          urgency = 'medium';
        }
      }

      let stockStatus: RecommendationItem['stock_status'] = 'stable';
      if (currentQuantity <= 0) stockStatus = 'out_of_stock';
      else if (minStockLevel > 0 && currentQuantity < minStockLevel) {
        stockStatus = 'below_minimum';
      } else if (suggested > 0) {
        stockStatus = 'below_target';
      } else if (maxBoundary !== null && currentQuantity > maxBoundary) {
        stockStatus = 'above_maximum';
      } else if (avgDaily <= 0) {
        stockStatus = 'no_recent_demand';
      }

      const explanationParts = [
        suggested > 0
          ? `Current stock ${this.toNumber(currentQuantity, 2)} is below the target coverage level of ${this.toNumber(targetStock, 2)}.`
          : `Current stock ${this.toNumber(currentQuantity, 2)} is covering the present outbound pattern.`,
        avgDaily > 0
          ? `Outbound usage averages ${avgDaily.toLocaleString()} ${row.uom_base || 'units'} per day over the trailing 30-day movement window.`
          : 'No outbound stock movement was detected in the trailing 30-day window, so min/max thresholds drive the recommendation.',
        daysOfCover !== null
          ? `At the current pace, stock covers about ${daysOfCover} days.`
          : daysSinceLastOutbound !== null
            ? `The last outbound movement in the observed window was ${daysSinceLastOutbound} days ago.`
            : 'No recent outbound movement is available inside the observed stock-ledger window.',
      ];
      if (trailing30 > 0 && wastage30 >= this.toNumber(trailing30 * 0.2, 4)) {
        explanationParts.push(
          `Wastage accounted for ${this.toNumber((wastage30 / trailing30) * 100, 1)}% of outbound movement.`,
        );
      }

      return {
        item_id: Number(row.item_id),
        item_name: row.item_name,
        item_sku: row.item_sku || null,
        uom_base: row.uom_base || null,
        current_quantity: currentQuantity,
        min_stock_level: minStockLevel,
        max_stock_level: maxStockLevel,
        avg_daily_outbound: avgDaily,
        recent_daily_outbound: recentDaily,
        trailing_30_day_outbound: trailing30,
        trailing_7_day_outbound: trailing7,
        trailing_30_day_wastage: wastage30,
        target_stock_level: this.toNumber(targetStock, 4),
        suggested_reorder_quantity: suggested,
        days_of_cover: daysOfCover,
        urgency,
        stock_status: stockStatus,
        last_received_at: this.toIsoDateTime(row.last_received_at),
        last_outbound_at: movement?.last_outbound_at ?? null,
        days_since_last_outbound: daysSinceLastOutbound,
        estimated_on_hand_value:
          lastUnitCost > 0 ? this.toNumber(currentQuantity * lastUnitCost, 2) : null,
        explanation: explanationParts.join(' '),
        reason_codes: reasonCodes,
      };
    });

    const reorderSuggestions = [...items]
      .filter((item) => item.suggested_reorder_quantity > 0)
      .sort((left, right) => {
        const urgencyDelta =
          this.urgencyWeight(right.urgency) - this.urgencyWeight(left.urgency);
        if (urgencyDelta !== 0) return urgencyDelta;
        return right.suggested_reorder_quantity - left.suggested_reorder_quantity;
      });

    const slowMovers: SlowMoverInsight[] = items
      .filter((item) => {
        if (item.current_quantity <= 0) return false;
        const stagnant =
          item.trailing_30_day_outbound <= 0.0001
          && (item.days_since_last_outbound === null
            || item.days_since_last_outbound >= 30);
        const excessiveCover = item.days_of_cover !== null && item.days_of_cover >= 45;
        const aboveMaximum =
          item.max_stock_level > 0 && item.current_quantity > item.max_stock_level;
        return stagnant || excessiveCover || aboveMaximum;
      })
      .map((item) => {
        const stagnant =
          item.trailing_30_day_outbound <= 0.0001
          && (item.days_since_last_outbound === null
            || item.days_since_last_outbound >= 30);
        const aboveMaximum =
          item.max_stock_level > 0 && item.current_quantity > item.max_stock_level;
        const severity: RecommendationSeverity = aboveMaximum
          ? 'high'
          : stagnant
            ? 'medium'
            : 'low';
        return {
          item_id: item.item_id,
          item_name: item.item_name,
          item_sku: item.item_sku,
          current_quantity: item.current_quantity,
          min_stock_level: item.min_stock_level,
          max_stock_level: item.max_stock_level,
          days_of_cover: item.days_of_cover,
          days_since_last_outbound: item.days_since_last_outbound,
          days_since_last_received: this.daysSince(item.last_received_at),
          estimated_on_hand_value: item.estimated_on_hand_value,
          severity,
          message: aboveMaximum
            ? `${item.item_name} is above the configured maximum stock level with limited recent movement.`
            : stagnant
              ? `No recent outbound movement was detected for ${item.item_name}, but stock is still on hand.`
              : `Stock covers ${item.days_of_cover ?? 'an extended'} days at the recent outbound rate.`,
          recommended_action: aboveMaximum
            ? 'Pause replenishment and review the branch max stock level before the next buy cycle.'
            : 'Review reorder thresholds and upcoming purchase quantities before replenishing again.',
        };
      })
      .sort((left, right) => {
        const severityDelta =
          this.severityWeight(right.severity)
          - this.severityWeight(left.severity);
        if (severityDelta !== 0) return severityDelta;
        return (right.days_of_cover ?? 0) - (left.days_of_cover ?? 0);
      })
      .slice(0, 12);

    const anomalies: RecommendationAnomaly[] = [
      ...this.buildSalesAnomalies(salesRows),
      ...items
        .filter((item) => item.current_quantity < 0)
        .map((item) => ({
          type: 'inventory_negative_stock' as const,
          severity: 'critical' as const,
          detected_on: generatedAt,
          title: 'Negative stock on hand',
          message: `${item.item_name} is at ${this.toNumber(item.current_quantity, 2)} ${item.uom_base || 'units'}, which should be reconciled before replenishment decisions are trusted.`,
          metric_value: this.toNumber(item.current_quantity, 2),
          baseline_value: 0,
          item_id: item.item_id,
          item_name: item.item_name,
        })),
      ...items
        .filter(
          (item) =>
            item.avg_daily_outbound > 0
            && item.recent_daily_outbound >= item.avg_daily_outbound * 1.8
            && item.trailing_7_day_outbound > 0,
        )
        .slice(0, 5)
        .map((item) => ({
          type: 'inventory_demand_spike' as const,
          severity:
            item.recent_daily_outbound >= item.avg_daily_outbound * 2.5
              ? ('high' as const)
              : ('medium' as const),
          detected_on: generatedAt,
          title: 'Recent stock-outflow pickup',
          message: `${item.item_name} is moving at ${this.toNumber(item.recent_daily_outbound, 2)} ${item.uom_base || 'units'}/day in the last 7 days versus ${this.toNumber(item.avg_daily_outbound, 2)} in the trailing baseline.`,
          metric_value: this.toNumber(item.recent_daily_outbound, 2),
          baseline_value: this.toNumber(item.avg_daily_outbound, 2),
          item_id: item.item_id,
          item_name: item.item_name,
        })),
      ...items
        .filter(
          (item) =>
            item.trailing_30_day_outbound > 0
            && item.trailing_30_day_wastage >= item.trailing_30_day_outbound * 0.25,
        )
        .slice(0, 5)
        .map((item) => ({
          type: 'inventory_wastage_pressure' as const,
          severity: 'medium' as const,
          detected_on: generatedAt,
          title: 'Wastage-heavy movement',
          message: `${item.item_name} recorded ${this.toNumber(item.trailing_30_day_wastage, 2)} ${item.uom_base || 'units'} of wastage in the trailing 30 days.`,
          metric_value: this.toNumber(item.trailing_30_day_wastage, 2),
          baseline_value: this.toNumber(item.trailing_30_day_outbound, 2),
          item_id: item.item_id,
          item_name: item.item_name,
        })),
    ]
      .sort((left, right) => {
        const severityDelta =
          this.severityWeight(right.severity)
          - this.severityWeight(left.severity);
        if (severityDelta !== 0) return severityDelta;
        return String(right.detected_on ?? '').localeCompare(
          String(left.detected_on ?? ''),
        );
      })
      .slice(0, 10);

    return {
      generated_at: generatedAt,
      branch_id: branchId,
      policy: {
        history_days: historyDays,
        forecast_days: forecastDays,
        target_cover_days: forecastDays,
        safety_days: safetyDays,
        demand_basis:
          'branch-scoped outbound inventory movements plus configured min/max thresholds',
      },
      summary: {
        enabled_items: items.length,
        actionable_reorders: reorderSuggestions.length,
        critical_reorders: reorderSuggestions.filter(
          (item) => item.urgency === 'critical',
        ).length,
        high_reorders: reorderSuggestions.filter(
          (item) => item.urgency === 'high',
        ).length,
        slow_movers: slowMovers.length,
        anomaly_count: anomalies.length,
        items_without_recent_demand: items.filter(
          (item) => item.avg_daily_outbound <= 0.0001,
        ).length,
      },
      items,
      reorder_suggestions: reorderSuggestions,
      slow_movers: slowMovers,
      anomalies,
    };
  }

  async getSalesForecast(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    this.assertBranchScope(branchId, accessibleBranchIds);

    const end = this.endOfDay(new Date());
    const start = this.startOfDay(this.addDays(end, -29));
    const [dailyRows, topProducts, inventoryRisks] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('order')
        .select('DATE(order.created_at)', 'business_date')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total_amount')
        .addSelect('COUNT(order.id)', 'completed_orders')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at >= :start', { start })
        .andWhere('order.created_at <= :end', { end })
        .groupBy('DATE(order.created_at)')
        .orderBy('DATE(order.created_at)', 'ASC')
        .getRawMany(),
      this.productRepo
        .createQueryBuilder('product')
        .innerJoin('order_items', 'item', 'item.product_id = product.id')
        .innerJoin('orders', 'order', 'order.id = item.order_id')
        .select('product.id', 'product_id')
        .addSelect('product.product_name', 'product_name')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity_sold')
        .where('product.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at >= :start', { start })
        .andWhere('order.created_at <= :end', { end })
        .groupBy('product.id')
        .addGroupBy('product.product_name')
        .orderBy('quantity_sold', 'DESC')
        .limit(5)
        .getRawMany(),
      this.branchInventoryRepo
        .createQueryBuilder('branch_inventory')
        .innerJoin('branch_inventory.item', 'item')
        .leftJoin(
          StockLevel,
          'stock',
          'stock.client_id = :clientId AND stock.branch_id = branch_inventory.branch_id AND stock.item_id = branch_inventory.item_id',
          { clientId },
        )
        .select('item.item_name', 'item_name')
        .addSelect('item.item_sku', 'item_sku')
        .addSelect('branch_inventory.min_stock_level', 'min_stock_level')
        .addSelect('COALESCE(stock.current_quantity, 0)', 'current_quantity')
        .where('branch_inventory.branch_id = :branchId', { branchId })
        .andWhere('branch_inventory.is_enabled = :enabled', { enabled: true })
        .andWhere('item.client_id = :clientId', { clientId })
        .andWhere('branch_inventory.min_stock_level > 0')
        .orderBy(
          '(COALESCE(stock.current_quantity, 0) / branch_inventory.min_stock_level)',
          'ASC',
        )
        .addOrderBy('branch_inventory.min_stock_level', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);

    const grouped = new Map<string, { amount: number; orders: number }>();
    for (const row of dailyRows) {
      grouped.set(String(row.business_date), {
        amount: this.toNumber(row.total_amount, 2),
        orders: this.toInteger(row.completed_orders),
      });
    }

    const history = this.buildDateSeries(30, grouped);
    const recentSeven = history.slice(-7);
    const previousSeven = history.slice(-14, -7);
    const recentAvg = recentSeven.length
      ? recentSeven.reduce((sum, entry) => sum + entry.amount, 0)
        / recentSeven.length
      : 0;
    const previousAvg = previousSeven.length
      ? previousSeven.reduce((sum, entry) => sum + entry.amount, 0)
        / previousSeven.length
      : 0;
    const trendPct =
      previousAvg > 0
        ? this.toNumber(((recentAvg - previousAvg) / previousAvg) * 100, 2)
        : null;

    const weekdayBuckets = new Map<number, number[]>();
    for (const point of history) {
      const weekday = new Date(`${point.date}T00:00:00.000Z`).getUTCDay();
      const bucket = weekdayBuckets.get(weekday) || [];
      bucket.push(point.amount);
      weekdayBuckets.set(weekday, bucket);
    }

    const forecast = Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(new Date(), index + 1);
      const weekday = date.getDay();
      const weekdayAverageValues = weekdayBuckets.get(weekday) || [];
      const weekdayAverage = weekdayAverageValues.length
        ? weekdayAverageValues.reduce((sum, value) => sum + value, 0)
          / weekdayAverageValues.length
        : recentAvg;
      return {
        date: this.formatDate(date),
        projected_amount: Math.max(
          0,
          this.toNumber((weekdayAverage * 0.6) + (recentAvg * 0.4), 2),
        ),
        baseline_amount: this.toNumber(weekdayAverage, 2),
      };
    });

    const projectedTotal = forecast.reduce(
      (sum, entry) => sum + entry.projected_amount,
      0,
    );
    const peakDay = forecast.reduce(
      (best, entry) =>
        entry.projected_amount > best.projected_amount ? entry : best,
      forecast[0] || { date: null, projected_amount: 0 },
    );
    const inventoryAlerts = inventoryRisks
      .map((row) => ({
        item_name: row.item_name,
        item_sku: row.item_sku,
        current_quantity: this.toNumber(row.current_quantity, 2),
        min_stock_level: this.toNumber(row.min_stock_level, 2),
        coverage_ratio:
          Number(row.min_stock_level || 0) > 0
            ? this.toNumber(
                (Number(row.current_quantity || 0)
                  / Number(row.min_stock_level || 1))
                  * 100,
                2,
              )
            : null,
      }))
      .filter((row) => row.coverage_ratio !== null && row.coverage_ratio <= 120);
    const confidenceScore = Math.min(
      0.96,
      Math.max(
        0.35,
        this.toNumber(history.filter((entry) => entry.amount > 0).length / 30, 2),
      ),
    );

    const insights: Array<{ type: 'trend' | 'warning' | 'info'; message: string }> =
      [
        {
          type: trendPct !== null && trendPct < 0 ? 'warning' : 'trend',
          message:
            trendPct === null
              ? `Trailing 7-day average is ${this.toNumber(recentAvg, 2).toLocaleString()} with no prior comparable week in scope.`
              : `Trailing 7-day average is ${this.toNumber(recentAvg, 2).toLocaleString()}, ${trendPct >= 0 ? 'up' : 'down'} ${Math.abs(trendPct)}% versus the previous 7 days.`,
        },
      ];
    if (peakDay?.date) {
      insights.push({
        type: 'info',
        message: `Highest projected revenue is ${this.toNumber(peakDay.projected_amount, 2).toLocaleString()} on ${peakDay.date}.`,
      });
    }
    if (inventoryAlerts.length > 0) {
      insights.push({
        type: 'warning',
        message: `${inventoryAlerts[0].item_name} is at ${inventoryAlerts[0].coverage_ratio}% of minimum stock coverage and may constrain the forecast window.`,
      });
    }

    return {
      generated_at: new Date().toISOString(),
      window: { history_days: 30, forecast_days: 7 },
      methodology: {
        type: 'rule_based_weighted_average',
        description:
          'Forecast values blend weekday-specific averages from the trailing 30 days with the trailing 7-day revenue average.',
        explainability: [
          'Only completed branch orders are included.',
          'Weekday patterns are preserved where history exists.',
          'Inventory risk items are surfaced separately and do not write to stock data.',
        ],
      },
      summary: {
        historical_total: this.toNumber(
          history.reduce((sum, entry) => sum + entry.amount, 0),
          2,
        ),
        projected_total: this.toNumber(projectedTotal, 2),
        trailing_7_day_average: this.toNumber(recentAvg, 2),
        previous_7_day_average: this.toNumber(previousAvg, 2),
        trend_pct: trendPct,
        projected_peak_day: peakDay?.date || null,
        projected_peak_amount: this.toNumber(peakDay?.projected_amount || 0, 2),
      },
      history,
      forecast,
      top_products: topProducts.map((row) => ({
        product_id: Number(row.product_id || 0),
        product_name: row.product_name,
        quantity_sold: this.toNumber(row.quantity_sold, 2),
      })),
      inventory_alerts: inventoryAlerts,
      insights,
      confidence_score: confidenceScore,
    };
  }

  async getRecommendationOverview(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    this.assertBranchScope(branchId, accessibleBranchIds);
    const dataset = await this.buildRecommendationDataset(clientId, branchId);
    return {
      generated_at: dataset.generated_at,
      branch_id: dataset.branch_id,
      policy: dataset.policy,
      summary: dataset.summary,
      reorder_suggestions: dataset.reorder_suggestions.slice(0, 8),
      slow_movers: dataset.slow_movers.slice(0, 8),
      anomalies: dataset.anomalies,
      exports: {
        reorder_rows: dataset.reorder_suggestions.map((item) => ({
          branch_id: branchId,
          ...item,
        })),
        slow_mover_rows: dataset.slow_movers.map((item) => ({
          branch_id: branchId,
          ...item,
        })),
        anomaly_rows: dataset.anomalies.map((item) => ({
          branch_id: branchId,
          ...item,
        })),
      },
    };
  }

  async getReorderRecommendations(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    this.assertBranchScope(branchId, accessibleBranchIds);
    const dataset = await this.buildRecommendationDataset(clientId, branchId);
    return {
      generated_at: dataset.generated_at,
      branch_id: dataset.branch_id,
      policy: dataset.policy,
      summary: dataset.summary,
      items: dataset.items,
      actionable_items: dataset.reorder_suggestions,
      exports: {
        reorder_rows: dataset.items.map((item) => ({
          branch_id: branchId,
          ...item,
        })),
      },
    };
  }

  async getWasteAnalytics(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    this.assertBranchScope(branchId, accessibleBranchIds);

    const completedOrders = await this.prodRepo
      .createQueryBuilder('production')
      .leftJoin('production.product', 'product')
      .select('production.id', 'id')
      .addSelect('production.product_id', 'product_id')
      .addSelect('product.product_name', 'product_name')
      .addSelect('production.planned_quantity', 'planned_qty')
      .addSelect('production.actual_quantity', 'actual_qty')
      .addSelect('production.wastage_quantity', 'wastage_quantity')
      .addSelect('production.yield_percentage', 'yield_percentage')
      .addSelect('production.completion_date', 'completion_date')
      .where('production.client_id = :clientId', { clientId })
      .andWhere('production.branch_id = :branchId', { branchId })
      .andWhere('production.status IN (:...statuses)', {
        statuses: ['prepared', 'received'],
      })
      .andWhere('production.completion_date IS NOT NULL')
      .orderBy('production.completion_date', 'DESC')
      .limit(30)
      .getRawMany();

    const rows = completedOrders.map((order) => {
      const plannedQty = Number(order.planned_qty || 0);
      const actualQty = Number(order.actual_qty || 0);
      const derivedWasteQty = plannedQty > actualQty ? plannedQty - actualQty : 0;
      const wasteQty = Number(order.wastage_quantity ?? derivedWasteQty);
      const wastePct =
        order.yield_percentage !== null && order.yield_percentage !== undefined
          ? this.toNumber(Math.max(0, 100 - Number(order.yield_percentage || 0)), 2)
          : plannedQty > 0
            ? this.toNumber((wasteQty / plannedQty) * 100, 2)
            : 0;

      return {
        id: Number(order.id || 0),
        product_id: Number(order.product_id || 0),
        product_name:
          order.product_name || `Product #${order.product_id || 'N/A'}`,
        planned_qty: this.toNumber(plannedQty, 2),
        actual_qty: this.toNumber(actualQty, 2),
        waste_quantity: this.toNumber(wasteQty, 2),
        waste_percentage: wastePct,
        yield_percentage: this.toNumber(100 - wastePct, 2),
        completion_date: order.completion_date,
      };
    });

    return {
      generated_at: new Date().toISOString(),
      summary: {
        batch_count: rows.length,
        total_planned_qty: this.toNumber(
          rows.reduce((sum, row) => sum + row.planned_qty, 0),
          2,
        ),
        total_actual_qty: this.toNumber(
          rows.reduce((sum, row) => sum + row.actual_qty, 0),
          2,
        ),
        total_waste_quantity: this.toNumber(
          rows.reduce((sum, row) => sum + row.waste_quantity, 0),
          2,
        ),
        average_waste_percentage: rows.length
          ? this.toNumber(
              rows.reduce((sum, row) => sum + row.waste_percentage, 0) / rows.length,
              2,
            )
          : 0,
      },
      rows,
      exports: {
        waste_rows: rows.map((row) => ({ branch_id: branchId, ...row })),
      },
    };
  }
}
