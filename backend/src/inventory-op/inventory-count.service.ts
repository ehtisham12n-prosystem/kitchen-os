import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalsService } from '../approvals/approvals.service';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../auth/request-context.util';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import { BranchLocation } from '../setup/entities/branch-location.entity';
import { Branch } from '../setup/entities/branch.entity';
import {
  createDefaultBranchInventoryControlSettings,
  type BranchInventoryControlSettings,
} from '../setup/branches/branch-config.types';
import { InventoryOpService } from './inventory-op.service';
import {
  CreateInventoryCountSessionDto,
  ListInventoryCountSessionsQueryDto,
  ReviewInventoryCountSessionDto,
  SubmitInventoryCountSessionDto,
} from './dto/inventory-count.dto';
import {
  INVENTORY_COUNT_STATUSES,
  INVENTORY_COUNT_TYPES,
  InventoryCountSession,
} from './entities/inventory-count-session.entity';
import {
  INVENTORY_DISCREPANCY_LEVELS,
  InventoryCountSessionItem,
} from './entities/inventory-count-session-item.entity';
import { StockLedger } from './entities/stock-ledger.entity';
import { StockLevel } from './entities/stock-level.entity';

type CandidateItem = {
  item_id: number;
  item_name: string;
  uom_base: string;
  current_quantity: number;
  min_stock_level: number;
  last_unit_cost: number;
  movement_count: number;
  score: number;
};

@Injectable()
export class InventoryCountService {
  constructor(
    @InjectRepository(InventoryCountSession)
    private readonly sessionRepo: Repository<InventoryCountSession>,
    @InjectRepository(InventoryCountSessionItem)
    private readonly sessionItemRepo: Repository<InventoryCountSessionItem>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(BranchLocation)
    private readonly locationRepo: Repository<BranchLocation>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(StockLedger)
    private readonly ledgerRepo: Repository<StockLedger>,
    private readonly inventoryOpService: InventoryOpService,
    private readonly approvalsService: ApprovalsService,
    private readonly operationalAuditService: OperationalAuditService,
  ) {}

  private round(value: number, scale = 4): number {
    return Number((Number(value || 0)).toFixed(scale));
  }

  private money(value: number): number {
    return this.round(value, 2);
  }

  private actorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private getInventorySettings(branch: Branch): BranchInventoryControlSettings {
    return {
      ...createDefaultBranchInventoryControlSettings(),
      ...(branch.inventory_control_settings ?? {}),
    };
  }

  private async assertBranch(clientId: string, branchId: number, accessibleBranchIds?: number[]) {
    const branch = await this.branchRepo.findOne({
      where: { client_id: clientId, id: branchId },
    });
    if (!branch || (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId))) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async assertLocation(
    clientId: string,
    branchId: number,
    locationId?: number | null,
  ) {
    if (!locationId) {
      return null;
    }
    const location = await this.locationRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, id: locationId },
    });
    if (!location) {
      throw new BadRequestException('Selected branch location was not found.');
    }
    return location;
  }

  private buildSessionCode(type: string, branch: Branch): string {
    const prefix = type === 'monthly_full' ? 'MTH' : type === 'eod_blind_close' ? 'EOD' : 'RND';
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${prefix}-${branch.branch_code || branch.id}-${stamp}`;
  }

  private buildPeriodKey(value?: string | null): string {
    const source = value?.trim();
    if (source && /^\d{4}-\d{2}$/.test(source)) {
      return source;
    }
    return new Date().toISOString().slice(0, 7);
  }

  private determineDiscrepancyLevel(
    varianceQty: number,
    variancePercent: number,
    varianceValue: number,
    settings: BranchInventoryControlSettings,
  ): (typeof INVENTORY_DISCREPANCY_LEVELS)[number] {
    const absPercent = Math.abs(variancePercent);
    const absValue = Math.abs(varianceValue);
    const absQty = Math.abs(varianceQty);
    if (absQty < 0.0001) return 'none';
    if (absPercent >= settings.discrepancy_percent_critical_threshold || absValue >= settings.discrepancy_value_critical_threshold) {
      return 'critical';
    }
    if (absPercent >= settings.discrepancy_percent_warn_threshold * 2 || absValue >= settings.discrepancy_value_warn_threshold * 2) {
      return 'high';
    }
    if (absPercent >= settings.discrepancy_percent_warn_threshold || absValue >= settings.discrepancy_value_warn_threshold) {
      return 'medium';
    }
    return 'low';
  }

  private computeAccuracyScore(matchedLines: number, totalLines: number): number {
    if (totalLines <= 0) {
      return 0;
    }
    return this.round((matchedLines / totalLines) * 100, 2);
  }

  private shouldEscalate(
    varianceLines: number,
    criticalLines: number,
    varianceValueTotal: number,
    settings: BranchInventoryControlSettings,
  ) {
    return criticalLines > 0
      || varianceLines >= settings.escalation_variance_line_threshold
      || Math.abs(varianceValueTotal) >= settings.escalation_variance_value_threshold;
  }

  private async getCandidateItems(
    clientId: string,
    branchId: number,
    itemIds?: number[] | null,
  ): Promise<CandidateItem[]> {
    const baseRows = await this.branchInventoryRepo.createQueryBuilder('bi')
      .innerJoin('bi.item', 'item')
      .leftJoin(StockLevel, 'stock', 'stock.client_id = :clientId AND stock.branch_id = bi.branch_id AND stock.item_id = bi.item_id', { clientId })
      .select([
        'bi.item_id AS item_id',
        'item.item_name AS item_name',
        'item.uom_base AS uom_base',
        'COALESCE(stock.current_quantity, 0) AS current_quantity',
        'COALESCE(bi.min_stock_level, 0) AS min_stock_level',
        'COALESCE(stock.last_unit_cost, 0) AS last_unit_cost',
      ])
      .where('bi.branch_id = :branchId', { branchId })
      .andWhere('bi.is_enabled = 1')
      .andWhere(itemIds?.length ? 'bi.item_id IN (:...itemIds)' : '1=1', { itemIds })
      .orderBy('item.item_name', 'ASC')
      .getRawMany();

    if (baseRows.length === 0) {
      return [];
    }

    const movementRows = await this.ledgerRepo.createQueryBuilder('ledger')
      .select('ledger.item_id', 'item_id')
      .addSelect('COUNT(*)', 'movement_count')
      .where('ledger.client_id = :clientId', { clientId })
      .andWhere('ledger.branch_id = :branchId', { branchId })
      .andWhere('ledger.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .andWhere('ledger.item_id IN (:...itemIds)', { itemIds: baseRows.map((row) => Number(row.item_id)) })
      .groupBy('ledger.item_id')
      .getRawMany();

    const movementMap = new Map<number, number>(
      movementRows.map((row) => [Number(row.item_id), Number(row.movement_count || 0)]),
    );

    return baseRows.map((row) => {
      const currentQuantity = Number(row.current_quantity || 0);
      const lastUnitCost = Number(row.last_unit_cost || 0);
      const movementCount = movementMap.get(Number(row.item_id)) || 0;
      const stockValue = Math.abs(currentQuantity * lastUnitCost);
      const score = (lastUnitCost * 20) + (movementCount * 5) + stockValue + (currentQuantity <= Number(row.min_stock_level || 0) ? 25 : 0);
      return {
        item_id: Number(row.item_id),
        item_name: String(row.item_name || `Item #${row.item_id}`),
        uom_base: String(row.uom_base || ''),
        current_quantity: this.round(currentQuantity),
        min_stock_level: this.round(Number(row.min_stock_level || 0)),
        last_unit_cost: this.round(lastUnitCost),
        movement_count: movementCount,
        score: this.round(score),
      };
    });
  }

  private chooseItems(
    candidates: CandidateItem[],
    dto: CreateInventoryCountSessionDto,
    settings: BranchInventoryControlSettings,
  ): CandidateItem[] {
    if (candidates.length === 0) {
      return [];
    }
    if (dto.force_full_count || dto.count_type === 'monthly_full') {
      return [...candidates].sort((left, right) => left.item_name.localeCompare(right.item_name));
    }
    if (dto.item_ids?.length) {
      const itemSet = new Set(dto.item_ids.map((value) => Number(value)));
      return candidates.filter((candidate) => itemSet.has(candidate.item_id));
    }

    const sampleSize = Math.min(
      candidates.length,
      Math.max(
        Number(dto.sample_size || 0) || (
          dto.count_type === 'eod_blind_close'
            ? settings.end_of_day_sample_size
            : settings.blind_random_sample_size
        ),
        1,
      ),
    );
    const topPool = [...candidates]
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(sampleSize * 3, sampleSize));

    for (let index = topPool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [topPool[index], topPool[swapIndex]] = [topPool[swapIndex], topPool[index]];
    }

    return topPool.slice(0, sampleSize).sort((left, right) => left.item_name.localeCompare(right.item_name));
  }

  private serializeSession(session: InventoryCountSession) {
    const revealVariance = ['submitted', 'under_review', 'reconciled', 'adjustment_pending', 'escalated', 'closed'].includes(session.status);
    return {
      id: session.id,
      session_code: session.session_code,
      title: session.title,
      count_type: session.count_type,
      status: session.status,
      business_date: session.business_date,
      period_key: session.period_key,
      notes: session.notes,
      location: session.location ? {
        id: session.location.id,
        name: session.location.location_name,
        type: session.location.location_type,
      } : null,
      metrics: {
        line_count: session.line_count,
        counted_line_count: session.counted_line_count,
        matched_line_count: session.matched_line_count,
        variance_line_count: session.variance_line_count,
        critical_line_count: session.critical_line_count,
        variance_quantity_total: this.round(Number(session.variance_quantity_total || 0)),
        variance_value_total: this.round(Number(session.variance_value_total || 0)),
        accuracy_score: this.round(Number(session.accuracy_score || 0), 2),
        escalation_required: session.escalation_required,
        escalation_reason: session.escalation_reason,
      },
      counted_by_name: session.counted_by_name,
      reviewed_by_name: session.reviewed_by_name,
      submitted_at: session.submitted_at,
      reviewed_at: session.reviewed_at,
      closed_at: session.closed_at,
      items: (session.items || [])
        .slice()
        .sort((left, right) => left.blind_sequence - right.blind_sequence)
        .map((item) => ({
          id: item.id,
          blind_sequence: item.blind_sequence,
          item_id: item.item_id,
          item_name: item.item?.item_name || `Item #${item.item_id}`,
          unit: item.item?.uom_base || '',
          location_name: item.location?.location_name || session.location?.location_name || null,
          counted_quantity: item.counted_quantity === null ? null : this.round(Number(item.counted_quantity)),
          review_status: item.review_status,
          review_action: item.review_action,
          reason_code: item.reason_code,
          review_notes: item.review_notes,
          discrepancy_level: revealVariance ? item.discrepancy_level : null,
          expected_quantity_snapshot: revealVariance ? this.round(Number(item.expected_quantity_snapshot || 0)) : null,
          variance_quantity: revealVariance ? this.round(Number(item.variance_quantity || 0)) : null,
          variance_percent: revealVariance ? this.round(Number(item.variance_percent || 0), 2) : null,
          variance_value: revealVariance ? this.round(Number(item.variance_value || 0)) : null,
          estimated_unit_cost: revealVariance ? this.round(Number(item.estimated_unit_cost || 0)) : null,
          adjustment_reference_id: revealVariance ? item.adjustment_reference_id : null,
        })),
    };
  }

  async createSession(
    clientId: string,
    branchId: number,
    dto: CreateInventoryCountSessionDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const branch = await this.assertBranch(clientId, branchId, accessibleBranchIds);
    const settings = this.getInventorySettings(branch);
    const location = await this.assertLocation(clientId, branchId, dto.location_id);
    const candidates = await this.getCandidateItems(clientId, branchId, dto.item_ids);
    const selected = this.chooseItems(candidates, dto, settings);

    if (selected.length === 0) {
      throw new BadRequestException('No branch inventory items are available for this blind count.');
    }

    const actorId = resolveActorId(user) ?? 'system';
    const sessionEntity = this.sessionRepo.create({
      client_id: clientId,
      branch_id: branchId,
      location_id: location?.id ?? null,
      session_code: this.buildSessionCode(dto.count_type, branch),
      title: dto.title?.trim() || `${dto.count_type.replace(/_/g, ' ')} - ${location?.location_name || branch.branch_name}`,
      count_type: dto.count_type,
      status: 'scheduled',
      business_date: dto.business_date || new Date().toISOString().slice(0, 10),
      period_key: dto.count_type === 'monthly_full' ? this.buildPeriodKey(dto.period_key) : null,
      selection_summary: {
        sample_size: selected.length,
        force_full_count: dto.force_full_count ?? dto.count_type === 'monthly_full',
      },
      thresholds: { ...settings } as Record<string, unknown>,
      generated_by_user_id: actorId,
      generated_by_name: this.actorName(user),
      line_count: selected.length,
      notes: dto.notes?.trim() || null,
    });
    const session = await this.sessionRepo.save(sessionEntity);

    await this.sessionItemRepo.save(selected.map((candidate, index) => this.sessionItemRepo.create({
      client_id: clientId,
      branch_id: branchId,
      session_id: session.id,
      location_id: location?.id ?? null,
      item_id: candidate.item_id,
      blind_sequence: index + 1,
      expected_quantity_snapshot: candidate.current_quantity,
      estimated_unit_cost: candidate.last_unit_cost,
      discrepancy_level: 'none',
      review_status: 'pending',
    })));

    await this.operationalAuditService.log({
      user,
      action: 'Inventory Blind Count Created',
      entity: 'inventory_count_sessions',
      clientId,
      branchId,
      entityId: session.id,
      details: `Created ${dto.count_type} blind count session ${session.session_code}`,
      metadata: {
        location_id: location?.id ?? null,
        line_count: selected.length,
      },
    });

    return this.getSession(clientId, session.id, accessibleBranchIds);
  }

  async listSessions(
    clientId: string,
    branchId: number,
    query: ListInventoryCountSessionsQueryDto,
    accessibleBranchIds?: number[],
  ) {
    await this.assertBranch(clientId, branchId, accessibleBranchIds);
    const sessions = await this.sessionRepo.find({
      where: {
        client_id: clientId,
        branch_id: branchId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.count_type ? { count_type: query.count_type } : {}),
        ...(query.location_id ? { location_id: query.location_id } : {}),
        ...(query.business_date ? { business_date: query.business_date } : {}),
      },
      relations: ['location'],
      order: { created_at: 'DESC' },
      take: 100,
    });
    return sessions.map((session) => ({
      id: session.id,
      session_code: session.session_code,
      title: session.title,
      count_type: session.count_type,
      status: session.status,
      business_date: session.business_date,
      location_name: session.location?.location_name ?? null,
      line_count: session.line_count,
      counted_line_count: session.counted_line_count,
      variance_line_count: session.variance_line_count,
      critical_line_count: session.critical_line_count,
      variance_value_total: this.round(Number(session.variance_value_total || 0)),
      accuracy_score: this.round(Number(session.accuracy_score || 0), 2),
      escalation_required: session.escalation_required,
      counted_by_name: session.counted_by_name,
      reviewed_by_name: session.reviewed_by_name,
      submitted_at: session.submitted_at,
      reviewed_at: session.reviewed_at,
    }));
  }

  async getSession(clientId: string, id: number, accessibleBranchIds?: number[]) {
    const session = await this.sessionRepo.findOne({
      where: { client_id: clientId, id },
      relations: ['location', 'items', 'items.item', 'items.location'],
    });
    if (!session || (accessibleBranchIds?.length && !accessibleBranchIds.includes(session.branch_id))) {
      throw new NotFoundException('Blind count session not found.');
    }
    return this.serializeSession(session);
  }

  async submitSession(
    clientId: string,
    id: number,
    dto: SubmitInventoryCountSessionDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const session = await this.sessionRepo.findOne({
      where: { client_id: clientId, id },
      relations: ['items'],
    });
    if (!session || (accessibleBranchIds?.length && !accessibleBranchIds.includes(session.branch_id))) {
      throw new NotFoundException('Blind count session not found.');
    }
    if (!['scheduled', 'in_progress'].includes(session.status)) {
      throw new BadRequestException('This session is no longer open for blind counting.');
    }

    const branch = await this.assertBranch(clientId, session.branch_id, accessibleBranchIds);
    const settings = this.getInventorySettings(branch);
    const submittedLines = new Map(dto.lines.map((line) => [Number(line.item_id), Number(line.counted_quantity)]));
    if (submittedLines.size !== session.items.length) {
      throw new BadRequestException('All blind count lines must be submitted before completing the session.');
    }

    let matchedLines = 0;
    let varianceLines = 0;
    let criticalLines = 0;
    let varianceQtyTotal = 0;
    let varianceValueTotal = 0;

    for (const line of session.items) {
      if (!submittedLines.has(line.item_id)) {
        throw new BadRequestException(`Missing blind count for item ${line.item_id}.`);
      }
      const countedQuantity = this.round(submittedLines.get(line.item_id) || 0);
      const expectedQuantity = this.round(Number(line.expected_quantity_snapshot || 0));
      const varianceQuantity = this.round(countedQuantity - expectedQuantity);
      const variancePercent = Math.abs(expectedQuantity) < 0.0001
        ? (Math.abs(countedQuantity) < 0.0001 ? 0 : 100)
        : this.round((varianceQuantity / expectedQuantity) * 100, 2);
      const varianceValue = this.money(varianceQuantity * Number(line.estimated_unit_cost || 0));
      const discrepancyLevel = this.determineDiscrepancyLevel(varianceQuantity, variancePercent, varianceValue, settings);
      if (Math.abs(varianceQuantity) < 0.0001) {
        matchedLines += 1;
      } else {
        varianceLines += 1;
      }
      if (discrepancyLevel === 'critical') {
        criticalLines += 1;
      }
      varianceQtyTotal += varianceQuantity;
      varianceValueTotal += varianceValue;

      Object.assign(line, {
        counted_quantity: countedQuantity,
        variance_quantity: varianceQuantity,
        variance_percent: variancePercent,
        variance_value: varianceValue,
        discrepancy_level: discrepancyLevel,
        review_status: discrepancyLevel === 'none' ? 'matched' : 'pending',
        counted_at: new Date(),
      });
    }

    await this.sessionItemRepo.save(session.items);

    session.status = 'submitted';
    session.counted_by_user_id = String(resolveActorId(user));
    session.counted_by_name = this.actorName(user);
    session.submitted_at = new Date();
    session.notes = dto.notes?.trim() || session.notes;
    session.counted_line_count = session.items.length;
    session.matched_line_count = matchedLines;
    session.variance_line_count = varianceLines;
    session.critical_line_count = criticalLines;
    session.variance_quantity_total = this.round(varianceQtyTotal);
    session.variance_value_total = this.round(varianceValueTotal);
    session.accuracy_score = this.computeAccuracyScore(matchedLines, session.items.length);
    session.escalation_required = this.shouldEscalate(
      varianceLines,
      criticalLines,
      varianceValueTotal,
      settings,
    );
    session.escalation_reason = session.escalation_required
      ? 'Variance thresholds exceeded for this blind count.'
      : null;
    await this.sessionRepo.save(session);

    await this.operationalAuditService.log({
      user,
      action: 'Inventory Blind Count Submitted',
      entity: 'inventory_count_sessions',
      clientId,
      branchId: session.branch_id,
      entityId: session.id,
      details: `Submitted blind count session ${session.session_code}`,
      metadata: {
        variance_line_count: varianceLines,
        variance_value_total: this.round(varianceValueTotal),
        escalation_required: session.escalation_required,
      },
    });

    return this.getSession(clientId, id, accessibleBranchIds);
  }

  async reviewSession(
    clientId: string,
    id: number,
    dto: ReviewInventoryCountSessionDto,
    user?: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const session = await this.sessionRepo.findOne({
      where: { client_id: clientId, id },
      relations: ['items', 'items.item', 'location'],
    });
    if (!session || (accessibleBranchIds?.length && !accessibleBranchIds.includes(session.branch_id))) {
      throw new NotFoundException('Blind count session not found.');
    }
    if (!['submitted', 'under_review', 'adjustment_pending', 'escalated'].includes(session.status)) {
      throw new BadRequestException('This session is not ready for variance review.');
    }

    const reviewMap = new Map(dto.lines.map((line) => [Number(line.line_id), line]));
    let reviewCount = 0;
    let pendingRecount = 0;
    let escalated = false;
    const adjustmentsApplied: string[] = [];

    for (const line of session.items) {
      if (!reviewMap.has(line.id)) {
        continue;
      }
      const review = reviewMap.get(line.id)!;
      reviewCount += 1;
      line.review_action = review.review_action;
      line.reason_code = review.reason_code?.trim() || null;
      line.review_notes = review.review_notes?.trim() || null;
      line.reviewed_at = new Date();

      if (review.review_action === 'adjust_stock') {
        if (Math.abs(Number(line.variance_quantity || 0)) < 0.0001) {
          throw new BadRequestException('A zero-variance line cannot be adjusted.');
        }
        const adjustment = await this.inventoryOpService.adjustStock(
          clientId,
          session.branch_id,
          {
            branch_id: session.branch_id,
            item_id: line.item_id,
            quantity: Number(line.variance_quantity || 0),
            type: 'adjustment',
            reason: `blind_count:${session.session_code}`,
            notes: review.review_notes || `Blind count adjustment from ${session.session_code}`,
          },
          user,
        );
        line.adjustment_reference_id = String(adjustment.ledger_entry?.id || adjustment.ledger_entry?.reference_id || '');
        line.review_status = 'adjusted';
        adjustmentsApplied.push(line.adjustment_reference_id);
      } else if (review.review_action === 'recount') {
        line.review_status = 'recount_required';
        pendingRecount += 1;
      } else if (review.review_action === 'escalate') {
        line.review_status = 'escalated';
        escalated = true;
      } else {
        line.review_status = 'accepted';
      }
    }

    if (reviewCount === 0) {
      throw new BadRequestException('No blind count lines were reviewed.');
    }

    await this.sessionItemRepo.save(session.items);

    session.status = escalated
      ? 'escalated'
      : pendingRecount > 0
        ? 'under_review'
        : adjustmentsApplied.length > 0
          ? 'closed'
          : 'reconciled';
    session.reviewed_by_user_id = String(resolveActorId(user));
    session.reviewed_by_name = this.actorName(user);
    session.reviewed_at = new Date();
    session.closed_at = session.status === 'closed' || session.status === 'reconciled' ? new Date() : null;
    session.notes = dto.notes?.trim() || session.notes;
    if (escalated) {
      session.escalation_required = true;
      session.escalation_reason = dto.notes?.trim() || 'Manager escalated this blind count for deeper audit.';
      await this.approvalsService.submit({
        client_id: clientId,
        module: 'inventory',
        entity_id: session.id,
        action_type: 'inventory_count_escalation',
        requested_by: resolveActorId(user) ?? 'system',
        branch_id: session.branch_id,
        notes: session.escalation_reason,
      });
    }
    await this.sessionRepo.save(session);

    await this.operationalAuditService.log({
      user,
      action: 'Inventory Blind Count Reviewed',
      entity: 'inventory_count_sessions',
      clientId,
      branchId: session.branch_id,
      entityId: session.id,
      details: `Reviewed blind count session ${session.session_code}`,
      metadata: {
        session_status: session.status,
        reviewed_lines: reviewCount,
        adjustments_applied: adjustmentsApplied.length,
        recount_required: pendingRecount,
        escalated,
      },
    });

    return this.getSession(clientId, id, accessibleBranchIds);
  }

  async getDashboard(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    const branch = await this.assertBranch(clientId, branchId, accessibleBranchIds);
    const settings = this.getInventorySettings(branch);
    const sessions = await this.sessionRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      relations: ['location'],
      order: { created_at: 'DESC' },
      take: 150,
    });
    const recent = sessions.slice(0, 10).map((session) => ({
      id: session.id,
      session_code: session.session_code,
      title: session.title,
      count_type: session.count_type,
      status: session.status,
      business_date: session.business_date,
      location_name: session.location?.location_name ?? null,
      variance_value_total: this.round(Number(session.variance_value_total || 0)),
      accuracy_score: this.round(Number(session.accuracy_score || 0), 2),
      counted_by_name: session.counted_by_name,
    }));

    const openStatuses = new Set(['scheduled', 'in_progress', 'submitted', 'under_review', 'adjustment_pending', 'escalated']);
    const openSessions = sessions.filter((session) => openStatuses.has(session.status));
    const last30 = sessions.filter((session) => {
      const createdAt = new Date(session.created_at);
      return createdAt.getTime() >= Date.now() - (30 * 24 * 60 * 60 * 1000);
    });

    const trendByDate = new Map<string, { completed: number; variance_value: number; accuracy_total: number; accuracy_count: number }>();
    const userStats = new Map<string, { count: number; accuracy_total: number; variance_total: number }>();
    const locationStats = new Map<string, { count: number; variance_total: number }>();
    for (const session of last30) {
      const key = session.business_date || session.created_at.toISOString().slice(0, 10);
      const trend = trendByDate.get(key) || { completed: 0, variance_value: 0, accuracy_total: 0, accuracy_count: 0 };
      trend.completed += 1;
      trend.variance_value += Number(session.variance_value_total || 0);
      trend.accuracy_total += Number(session.accuracy_score || 0);
      trend.accuracy_count += 1;
      trendByDate.set(key, trend);

      const userKey = session.counted_by_name || 'Unassigned';
      const userStat = userStats.get(userKey) || { count: 0, accuracy_total: 0, variance_total: 0 };
      userStat.count += 1;
      userStat.accuracy_total += Number(session.accuracy_score || 0);
      userStat.variance_total += Math.abs(Number(session.variance_value_total || 0));
      userStats.set(userKey, userStat);

      const locationKey = session.location?.location_name || 'Branch Wide';
      const locationStat = locationStats.get(locationKey) || { count: 0, variance_total: 0 };
      locationStat.count += 1;
      locationStat.variance_total += Math.abs(Number(session.variance_value_total || 0));
      locationStats.set(locationKey, locationStat);
    }

    const bestPerformers = [...userStats.entries()]
      .map(([name, stat]) => ({
        name,
        session_count: stat.count,
        average_accuracy: this.round(stat.accuracy_total / Math.max(stat.count, 1), 2),
        variance_value_total: this.round(stat.variance_total),
      }))
      .sort((left, right) => right.average_accuracy - left.average_accuracy || left.variance_value_total - right.variance_value_total)
      .slice(0, 5);

    const repeatOffenders = [...locationStats.entries()]
      .map(([name, stat]) => ({
        name,
        session_count: stat.count,
        variance_value_total: this.round(stat.variance_total),
      }))
      .sort((left, right) => right.variance_value_total - left.variance_value_total)
      .slice(0, 5);

    const itemRows = await this.sessionItemRepo.createQueryBuilder('line')
      .innerJoin('line.item', 'item')
      .innerJoin('line.session', 'session')
      .select('line.item_id', 'item_id')
      .addSelect('item.item_name', 'item_name')
      .addSelect('COUNT(*)', 'variance_count')
      .addSelect('SUM(ABS(line.variance_value))', 'variance_value_total')
      .where('line.client_id = :clientId', { clientId })
      .andWhere('line.branch_id = :branchId', { branchId })
      .andWhere('session.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)')
      .andWhere('ABS(line.variance_quantity) > 0.0001')
      .groupBy('line.item_id')
      .addGroupBy('item.item_name')
      .orderBy('variance_count', 'DESC')
      .addOrderBy('variance_value_total', 'DESC')
      .limit(8)
      .getRawMany();

    return {
      branch_id: branchId,
      settings,
      summary: {
        total_sessions: sessions.length,
        open_sessions: openSessions.length,
        escalated_sessions: sessions.filter((session) => session.status === 'escalated').length,
        average_accuracy_30d: this.round(
          last30.reduce((sum, session) => sum + Number(session.accuracy_score || 0), 0) / Math.max(last30.length, 1),
          2,
        ),
        variance_value_30d: this.round(
          last30.reduce((sum, session) => sum + Math.abs(Number(session.variance_value_total || 0)), 0),
        ),
      },
      trends: [...trendByDate.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([date, value]) => ({
          date,
          completed: value.completed,
          variance_value: this.round(value.variance_value),
          average_accuracy: this.round(value.accuracy_total / Math.max(value.accuracy_count, 1), 2),
        })),
      repeat_offenders: {
        locations: repeatOffenders,
        items: itemRows.map((row) => ({
          item_id: Number(row.item_id),
          item_name: row.item_name,
          variance_count: Number(row.variance_count || 0),
          variance_value_total: this.round(Number(row.variance_value_total || 0)),
        })),
      },
      best_performers: bestPerformers,
      recent_sessions: recent,
    };
  }

  async getClosingDashboard(
    clientId: string,
    branchId: number,
    accessibleBranchIds?: number[],
  ) {
    const branch = await this.assertBranch(clientId, branchId, accessibleBranchIds);
    const settings = this.getInventorySettings(branch);
    const today = new Date().toISOString().slice(0, 10);
    const periodKey = today.slice(0, 7);
    const sessions = await this.sessionRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      relations: ['location'],
      order: { created_at: 'DESC' },
      take: 200,
    });

    const todayClosings = sessions.filter((session) => session.business_date === today && session.count_type === 'eod_blind_close');
    const monthlySession = sessions.find((session) => session.count_type === 'monthly_full' && session.period_key === periodKey);
    const unresolvedCritical = sessions.filter((session) => ['submitted', 'under_review', 'adjustment_pending', 'escalated'].includes(session.status) && Number(session.critical_line_count || 0) > 0);

    return {
      branch_id: branchId,
      business_date: today,
      period_key: periodKey,
      settings,
      daily_close: {
        required_blind_close_enabled: settings.end_of_day_blind_enabled,
        sessions_due: todayClosings.length,
        sessions_completed: todayClosings.filter((session) => ['reconciled', 'closed'].includes(session.status)).length,
        sessions_pending: todayClosings.filter((session) => !['reconciled', 'closed'].includes(session.status)).length,
        variance_value_total: this.round(todayClosings.reduce((sum, session) => sum + Math.abs(Number(session.variance_value_total || 0)), 0)),
      },
      monthly_close: {
        blind_full_required: settings.monthly_blind_full_enabled,
        session: monthlySession ? {
          id: monthlySession.id,
          session_code: monthlySession.session_code,
          status: monthlySession.status,
          line_count: monthlySession.line_count,
          counted_line_count: monthlySession.counted_line_count,
          accuracy_score: this.round(Number(monthlySession.accuracy_score || 0), 2),
          variance_value_total: this.round(Number(monthlySession.variance_value_total || 0)),
          escalation_required: monthlySession.escalation_required,
        } : null,
        readiness: monthlySession
          ? (
            ['reconciled', 'closed'].includes(monthlySession.status)
              ? 'ready'
              : monthlySession.status === 'escalated'
                ? 'blocked'
                : 'pending'
          )
          : (settings.monthly_blind_full_enabled ? 'pending' : 'not_required'),
      },
      unresolved_critical_sessions: unresolvedCritical.slice(0, 10).map((session) => ({
        id: session.id,
        session_code: session.session_code,
        title: session.title,
        count_type: session.count_type,
        status: session.status,
        critical_line_count: session.critical_line_count,
        variance_value_total: this.round(Number(session.variance_value_total || 0)),
        location_name: session.location?.location_name ?? null,
      })),
    };
  }
}
