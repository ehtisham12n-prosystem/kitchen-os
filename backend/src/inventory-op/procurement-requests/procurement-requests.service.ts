import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  hasBranchApprovalAuthority,
  hasCentralApprovalAuthority,
  hasExplicitApprovalAuthorityConfig,
  resolveActorId,
} from '../../auth/request-context.util';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Vendor } from '../../inventory/entities/vendor.entity';
import { BranchInventory } from '../../inventory/entities/branch-inventory.entity';
import { OperationalAuditService } from '../../platform/audit/operational-audit.service';
import { Branch } from '../../setup/entities/branch.entity';
import { ClientSettings } from '../../platform/entities/client-settings.entity';
import {
  CreateProcurementRequestDto,
  ReviewProcurementRequestDto,
} from '../dto/inventory-op.dto';
import {
  PROCUREMENT_REQUEST_STATUSES,
  type ProcurementApprovalScope,
  type ProcurementContext,
  type ProcurementRequestStatus,
} from '../procurement.constants';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestItem } from '../entities/procurement-request-item.entity';
import { assertBranchOperationalWriteAllowed } from '../../setup/branches/branch-control.types';
import { createDefaultClientNumberingSettings, type BranchDocumentRule } from '../../setup/branches/branch-config.types';
import { nextBranchDocumentNumber } from '../../setup/branches/branch-document.util';

@Injectable()
export class ProcurementRequestsService {
  constructor(
    @InjectRepository(ProcurementRequest)
    private readonly requestRepo: Repository<ProcurementRequest>,
    @InjectRepository(ProcurementRequestItem)
    private readonly requestItemRepo: Repository<ProcurementRequestItem>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(ClientSettings)
    private readonly clientSettingsRepo: Repository<ClientSettings>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(BranchInventory)
    private readonly branchInventoryRepo: Repository<BranchInventory>,
    private readonly operationalAuditService: OperationalAuditService,
  ) {}

  private normalizeQuantity(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(4));
  }

  private buildActorName(user?: JwtPayload): string {
    return user?.username || user?.email || (user?.sub ? String(user.sub) : 'System');
  }

  private hasBranchAccess(accessibleBranchIds: number[] | undefined, branchId: number): boolean {
    return !accessibleBranchIds || accessibleBranchIds.length === 0 || accessibleBranchIds.includes(branchId);
  }

  private async hasCentralProcurementOversight(
    clientId: string,
    accessibleBranchIds?: number[],
  ): Promise<boolean> {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return true;
    }

    const count = await this.branchRepo.count({
      where: accessibleBranchIds.map((branchId) => ({
        id: branchId,
        client_id: clientId,
        inventory_store_type: 'central',
      })),
    });

    return count > 0;
  }

  private async assertRequestAccess(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    request: Pick<ProcurementRequest, 'requesting_branch_id' | 'destination_branch_id'>,
  ): Promise<void> {
    if (await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) {
      return;
    }

    if (
      !this.hasBranchAccess(accessibleBranchIds, request.requesting_branch_id) &&
      !this.hasBranchAccess(accessibleBranchIds, request.destination_branch_id)
    ) {
      throw new ForbiddenException('You do not have access to this procurement request.');
    }
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId: number,
    operation?: string,
  ): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found.`);
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private resolveProcurementContext(
    requestingBranch: Branch,
    destinationBranch: Branch,
    requestedContext?: ProcurementContext,
  ): ProcurementContext {
    if (requestedContext) {
      if (
        requestedContext === 'branch_procurement' &&
        (
          requestingBranch.inventory_store_type === 'central' ||
          destinationBranch.id !== requestingBranch.id
        )
      ) {
        throw new BadRequestException(
          'Branch procurement requires a branch to buy directly for its own destination.',
        );
      }

      if (
        requestedContext === 'branch_requisition' &&
        requestingBranch.inventory_store_type === 'central'
      ) {
        throw new BadRequestException(
          'Central stores cannot raise branch requisition procurement requests.',
        );
      }

      if (
        requestedContext === 'central_procurement' &&
        requestingBranch.inventory_store_type !== 'central'
      ) {
        throw new BadRequestException(
          'Central procurement requests must originate from a central store branch.',
        );
      }

      return requestedContext;
    }

    if (requestingBranch.inventory_store_type === 'central') {
      return 'central_procurement';
    }

    if (requestingBranch.id === destinationBranch.id) {
      return 'branch_procurement';
    }

    return 'branch_requisition';
  }

  private resolveApprovalScope(
    context: ProcurementContext,
    requestedScope?: ProcurementApprovalScope,
  ): ProcurementApprovalScope {
    const defaultScope = context === 'branch_procurement' ? 'branch' : 'central';

    if (!requestedScope) {
      return defaultScope;
    }

    if (context === 'branch_procurement' && requestedScope !== 'branch') {
      throw new BadRequestException(
        'Branch procurement requests must use branch approval scope.',
      );
    }

    if (context !== 'branch_procurement' && requestedScope !== 'central') {
      throw new BadRequestException(
        'Centralized procurement and branch requisitions must use central approval scope.',
      );
    }

    return requestedScope;
  }

  private resolveCompatibilityMode(
    context: ProcurementContext,
    requestingBranchId: number,
    destinationBranchId: number,
    requestedMode?: string,
  ) {
    if (requestedMode === 'hybrid') {
      return 'hybrid' as const;
    }

    if (context === 'branch_procurement' && requestingBranchId === destinationBranchId) {
      return 'branch_direct' as const;
    }

    return 'central_procurement' as const;
  }

  private resolveReceiptRoute(destinationBranch?: Pick<Branch, 'inventory_store_type'> | null) {
    return destinationBranch?.inventory_store_type === 'central'
      ? 'vendor_to_central'
      : 'vendor_to_branch';
  }

  private async assertApprovalAuthority(
    clientId: string,
    approvalScope: ProcurementApprovalScope,
    user: JwtPayload | undefined,
    accessibleBranchIds: number[] | undefined,
    request: Pick<ProcurementRequest, 'requesting_branch_id' | 'destination_branch_id'>,
  ): Promise<void> {
    if (approvalScope === 'branch') {
      if (hasExplicitApprovalAuthorityConfig(user)) {
        if (!hasBranchApprovalAuthority(user, request.requesting_branch_id)) {
          throw new ForbiddenException(
            'You do not have branch approval authority for this procurement request.',
          );
        }
        return;
      }

      if (!this.hasBranchAccess(accessibleBranchIds, request.requesting_branch_id)) {
        throw new ForbiddenException(
          'You do not have branch approval access for this procurement request.',
        );
      }
      return;
    }

    if (hasExplicitApprovalAuthorityConfig(user)) {
      if (hasCentralApprovalAuthority(user)) {
        return;
      }

      throw new ForbiddenException(
        'Central procurement approval requires explicit central approval authority.',
      );
    }

    if (await this.hasCentralProcurementOversight(clientId, accessibleBranchIds)) {
      return;
    }

    throw new ForbiddenException(
      'Central procurement approval requires access to a central store branch.',
    );
  }

  private async assertVendorBelongsToClient(clientId: string, vendorId?: number | null): Promise<void> {
    if (!vendorId) {
      return;
    }

    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId, client_id: clientId } });
    if (!vendor || vendor.is_active === false) {
      throw new BadRequestException(`Vendor ${vendorId} is not available for this client.`);
    }
  }

  private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, client_id: clientId } });
    if (!item) {
      throw new NotFoundException(`Inventory item ${itemId} not found.`);
    }
    if (!item.item_is_active) {
      throw new BadRequestException(`Inventory item ${item.item_name} is inactive.`);
    }
    return item;
  }

  private async ensureDestinationOwnership(
    clientId: string,
    branchId: number,
    itemIds: number[],
  ): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const mappings = await this.branchInventoryRepo.find({
      where: itemIds.map((itemId) => ({ branch_id: branchId, item_id: itemId })),
    });
    const enabledItemIds = new Set(
      mappings.filter((mapping) => mapping.is_enabled).map((mapping) => mapping.item_id),
    );

    const missing = itemIds.find((itemId) => !enabledItemIds.has(itemId));
    if (missing) {
      const item = await this.assertItemBelongsToClient(clientId, missing);
      throw new BadRequestException(
        `Item ${item.item_name} is not enabled for the destination branch.`,
      );
    }
  }

  private async generateRequestNo(clientId: string, branch: Branch): Promise<string> {
    const settings = await this.clientSettingsRepo.findOne({
      where: { client_id: clientId },
    });
    const defaults = createDefaultClientNumberingSettings().rules.procurement_request;
    const rule: BranchDocumentRule = {
      ...defaults,
      ...(branch.document_settings?.procurement_request ?? {}),
      ...(settings?.numbering_settings?.rules?.procurement_request ?? {}),
    };
    return nextBranchDocumentNumber({
      repository: this.requestRepo,
      alias: 'request',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code,
      rule,
      documentColumn: 'request_no',
    });
  }

  private mapRequest(request: ProcurementRequest) {
    const items = (request.items ?? []).map((item) => ({
      id: item.id,
      item_id: item.item_id,
      item_name: item.item?.item_name ?? `Item #${item.item_id}`,
      item_sku: item.item?.item_sku ?? null,
      uom_base: item.item?.uom_base ?? null,
      requested_quantity: this.normalizeQuantity(item.requested_quantity),
      approved_quantity: this.normalizeQuantity(item.approved_quantity),
      notes: item.notes,
    }));

    return {
      id: request.id,
      request_no: request.request_no,
      client_id: request.client_id,
      requesting_branch_id: request.requesting_branch_id,
      destination_branch_id: request.destination_branch_id,
      preferred_vendor_id: request.preferred_vendor_id,
      preferred_vendor: request.preferred_vendor
        ? {
            id: request.preferred_vendor.id,
            vendor_name: request.preferred_vendor.vendor_name,
          }
        : null,
      requesting_branch: request.requesting_branch
        ? {
            id: request.requesting_branch.id,
            branch_name: request.requesting_branch.branch_name,
            inventory_store_type: request.requesting_branch.inventory_store_type,
          }
        : null,
      destination_branch: request.destination_branch
        ? {
            id: request.destination_branch.id,
            branch_name: request.destination_branch.branch_name,
            inventory_store_type: request.destination_branch.inventory_store_type,
          }
        : null,
      procurement_mode: request.procurement_mode,
      procurement_context: request.procurement_context,
      approval_scope: request.approval_scope,
      receipt_route: this.resolveReceiptRoute(request.destination_branch),
      priority: request.priority,
      status: request.status,
      notes: request.notes,
      requested_by: request.requested_by,
      requested_by_name: request.requested_by_name,
      requested_at: request.requested_at,
      reviewed_by: request.reviewed_by,
      reviewed_by_name: request.reviewed_by_name,
      reviewed_at: request.reviewed_at,
      review_notes: request.review_notes,
      linked_po_id: request.linked_po_id,
      items,
      summary: {
        line_count: items.length,
        requested_quantity_total: this.normalizeQuantity(
          items.reduce((sum, item) => sum + item.requested_quantity, 0),
        ),
      },
    };
  }

  private async getRequestEntity(clientId: string, requestId: number): Promise<ProcurementRequest> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, client_id: clientId },
      relations: [
        'requesting_branch',
        'destination_branch',
        'preferred_vendor',
        'items',
        'items.item',
      ],
    });

    if (!request) {
      throw new NotFoundException('Procurement request not found.');
    }

    return request;
  }

  async create(
    clientId: string,
    dto: CreateProcurementRequestDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const requestingBranchId = dto.requesting_branch_id ?? dto.destination_branch_id;
    if (!requestingBranchId) {
      throw new BadRequestException('requesting_branch_id is required for a procurement request.');
    }

    const destinationBranchId = dto.destination_branch_id ?? requestingBranchId;
    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);

    if (!hasCentralOversight && !this.hasBranchAccess(accessibleBranchIds, requestingBranchId)) {
      throw new ForbiddenException('You do not have access to raise demand from this branch.');
    }
    if (!hasCentralOversight && !this.hasBranchAccess(accessibleBranchIds, destinationBranchId)) {
      throw new ForbiddenException('You do not have access to procure for the selected destination branch.');
    }

    const [requestingBranch, destinationBranch] = await Promise.all([
      this.assertBranchBelongsToClient(clientId, requestingBranchId, 'raise procurement requests'),
      this.assertBranchBelongsToClient(clientId, destinationBranchId, 'receive procurement requests'),
    ]);
    await this.assertVendorBelongsToClient(clientId, dto.preferred_vendor_id ?? null);

    const procurementContext = this.resolveProcurementContext(
      requestingBranch,
      destinationBranch,
      dto.procurement_context,
    );
    const approvalScope = this.resolveApprovalScope(procurementContext, dto.approval_scope);
    const procurementMode = this.resolveCompatibilityMode(
      procurementContext,
      requestingBranchId,
      destinationBranchId,
      dto.procurement_mode,
    );

    const uniqueItemIds = [...new Set(dto.items.map((item) => item.item_id))];
    if (uniqueItemIds.length !== dto.items.length) {
      throw new BadRequestException('Duplicate items are not allowed in a single procurement request.');
    }

    await Promise.all(uniqueItemIds.map((itemId) => this.assertItemBelongsToClient(clientId, itemId)));
    await this.ensureDestinationOwnership(clientId, destinationBranchId, uniqueItemIds);

    const requestNo = await this.generateRequestNo(clientId, requestingBranch);
    const request = this.requestRepo.create({
      client_id: clientId,
      request_no: requestNo,
      requesting_branch_id: requestingBranchId,
      destination_branch_id: destinationBranchId,
      preferred_vendor_id: dto.preferred_vendor_id ?? null,
      procurement_mode: procurementMode,
      procurement_context: procurementContext,
      approval_scope: approvalScope,
      priority: dto.priority ?? 'routine',
      notes: dto.notes?.trim() || null,
      status: 'pending',
      requested_by: resolveActorId(user) ?? null,
      requested_by_name: this.buildActorName(user),
      items: dto.items.map((item) =>
        this.requestItemRepo.create({
          client_id: clientId,
          item_id: item.item_id,
          requested_quantity: this.normalizeQuantity(item.requested_quantity),
          approved_quantity: null,
          notes: item.notes?.trim() || null,
        }),
      ),
    });

    const saved = await this.requestRepo.save(request);
    const created = await this.getRequestEntity(clientId, saved.id);

    await this.operationalAuditService.log({
      user,
      action: 'Procurement Request Created',
      entity: 'procurement_requests',
      clientId,
      branchId: requestingBranchId,
      entityId: created.id,
      details: `Created procurement request ${created.request_no}`,
      metadata: {
        destination_branch_id: destinationBranchId,
        procurement_context: procurementContext,
        approval_scope: approvalScope,
        line_count: dto.items.length,
      },
    });

    return this.mapRequest(created);
  }

  async findAll(
    clientId: string,
    accessibleBranchIds?: number[],
    filters?: { status?: ProcurementRequestStatus },
  ) {
    const query = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requesting_branch', 'requesting_branch')
      .leftJoinAndSelect('request.destination_branch', 'destination_branch')
      .leftJoinAndSelect('request.preferred_vendor', 'preferred_vendor')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .where('request.client_id = :clientId', { clientId });

    if (filters?.status && PROCUREMENT_REQUEST_STATUSES.includes(filters.status)) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    const hasCentralOversight = await this.hasCentralProcurementOversight(clientId, accessibleBranchIds);

    if (!hasCentralOversight && accessibleBranchIds && accessibleBranchIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('request.requesting_branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds })
            .orWhere('request.destination_branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }),
      );
    }

    const requests = await query
      .orderBy('request.created_at', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .getMany();

    return requests.map((request) => this.mapRequest(request));
  }

  async findOne(clientId: string, requestId: number, accessibleBranchIds?: number[]) {
    const request = await this.getRequestEntity(clientId, requestId);
    await this.assertRequestAccess(clientId, accessibleBranchIds, request);
    return this.mapRequest(request);
  }

  async review(
    clientId: string,
    requestId: number,
    dto: ReviewProcurementRequestDto,
    user: JwtPayload,
    accessibleBranchIds?: number[],
  ) {
    const request = await this.getRequestEntity(clientId, requestId);
    await this.assertRequestAccess(clientId, accessibleBranchIds, request);
    await this.assertApprovalAuthority(clientId, request.approval_scope, user, accessibleBranchIds, request);
    assertBranchOperationalWriteAllowed(request.requesting_branch, 'review procurement requests');
    assertBranchOperationalWriteAllowed(request.destination_branch, 'review procurement requests');

    if (request.status === 'converted') {
      throw new BadRequestException('A converted request cannot be reviewed again.');
    }

    request.status = dto.status;
    request.reviewed_by = resolveActorId(user) ?? null;
    request.reviewed_by_name = this.buildActorName(user);
    request.reviewed_at = new Date();
    request.review_notes = dto.notes?.trim() || null;

    if (dto.status === 'approved') {
      request.items = request.items.map((item) => ({
        ...item,
        approved_quantity: this.normalizeQuantity(item.requested_quantity),
      }));
    }

    const saved = await this.requestRepo.save(request);

    await this.operationalAuditService.log({
      user,
      action: 'Procurement Request Reviewed',
      entity: 'procurement_requests',
      clientId,
      branchId: request.destination_branch_id,
      entityId: saved.id,
      details: `${saved.request_no} marked ${dto.status}`,
      metadata: {
        requesting_branch_id: request.requesting_branch_id,
        status: dto.status,
      },
    });

    return this.findOne(clientId, requestId, accessibleBranchIds);
  }

  async markConverted(
    clientId: string,
    requestId: number,
    purchaseOrderId: number,
  ): Promise<void> {
    const request = await this.getRequestEntity(clientId, requestId);
    if (request.status !== 'approved') {
      throw new BadRequestException('Only approved procurement requests can be converted into purchase orders.');
    }

    request.status = 'converted';
    request.linked_po_id = purchaseOrderId;
    if (!request.reviewed_at) {
      request.reviewed_at = new Date();
    }
    await this.requestRepo.save(request);
  }
}
