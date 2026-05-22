import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { KitchenTableEntity } from '../setup/entities/table.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction } from './entities/transaction.entity';
import { KOT } from './entities/kot.entity';
import { RecipeService } from '../recipe/recipe.service';
import { InventoryOpService } from '../inventory-op/inventory-op.service';
import { AccountingService } from '../accounting/accounting.service';
import { CustomersService } from '../customers/customers.service';
import { DealsService } from '../deals/deals.service';
import { Shift } from './entities/shift.entity';
import { BranchCharge } from '../setup/entities/branch-charge.entity';
import { OrderCharge } from './entities/order-charge.entity';
import { Branch } from '../setup/entities/branch.entity';
import { Floor } from '../setup/entities/floor.entity';
import { SaleCounter } from './entities/sale-counter.entity';
import { PosDevice } from './entities/pos-device.entity';
import { PosSyncEvent } from './entities/pos-sync-event.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import { EntitlementsService } from '../platform/entitlements/entitlements.service';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { CatalogService, type BranchProductSaleContext } from '../catalog/catalog.service';
import { BranchProductMapping } from '../catalog/entities/branch-product-mapping.entity';
import { OrderReturn } from './entities/order-return.entity';
import { OrderReturnItem } from './entities/order-return-item.entity';
import { PosVoidLog } from './entities/pos-void-log.entity';
import { AuthorizedTill } from './entities/authorized-till.entity';
import { BusinessDay } from './entities/business-day.entity';
import { ShiftTemplate } from './entities/shift-template.entity';
import { PosCardMachine } from './entities/pos-card-machine.entity';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';
import { FinancialVoucher, VoucherStatus, VoucherType } from '../accounting/entities/financial-voucher.entity';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  CloseShiftDto,
  OfflineBusinessDaySnapshotDto,
  OfflineCounterSessionSnapshotDto,
  CloseBusinessDayDto,
  CreateBusinessDayDto,
  CreatePosCardMachineDto,
  CreatePosOrderDto,
  CreateShiftTemplateDto,
  ListPosDeviceSyncEventsDto,
  CreatePosTableDto,
  OfflineKotStatusDto,
  OfflineOrderSnapshotDto,
  OfflineShiftSnapshotDto,
  PosDeliveryDetailsDto,
  PosPaymentDto,
  PosSyncBatchDto,
  ReconcilePosSyncEventDto,
  RegisterPosDeviceDto,
  UpdatePosOrderItemDto,
  StartBusinessDayDto,
  SubmitBlindCountDto,
  ReconcileTillDto,
  AuthorizedTillInputDto,
  StartOperatingShiftDto,
  AssignCounterSessionDto,
  UpdatePosOrderHeaderDto,
  UpdatePosCardMachineDto,
  VerifyCounterOpeningDto,
  VerifyCounterClosingDto,
  UpdateShiftTemplateDto,
  UpdateOperatingShiftDto,
} from './dto/pos-write.dto';
import { assertBranchOperationalWriteAllowed } from '../setup/branches/branch-control.types';
import {
  createDefaultClientNumberingSettings,
  formatBranchDocumentNumber,
  type BranchDocumentType,
  type BranchDocumentRule,
} from '../setup/branches/branch-config.types';
import { nextBranchDocumentNumber } from '../setup/branches/branch-document.util';

type PosOrderType = 'dine_in' | 'takeout' | 'delivery';
type PosPaymentMode = 'cash' | 'bank' | 'card' | 'digital_wallet' | 'other';
type PosDeliveryPaymentTerm = 'paid' | 'cod';
type PosDeliveryStatus = 'pending' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
type PosMutableOrderStatus =
  | 'held'
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'voided';

type DeviceSyncState = 'idle' | 'success' | 'failed' | 'conflict';
type SyncResolutionStatus = 'open' | 'acknowledged' | 'resolved';

type PosDeliveryDetails = {
  contact_person?: string | null;
  phone_number?: string | null;
  address?: string | null;
  house_apartment?: string | null;
  street_no?: string | null;
  area_sector?: string | null;
  locality?: string | null;
  city?: string | null;
  ask_for?: string | null;
  delivery_person_user_id?: number | null;
  delivery_person_name?: string | null;
  payment_term?: PosDeliveryPaymentTerm | null;
  delivery_status?: PosDeliveryStatus | null;
  comment?: string | null;
};

type OrderPricingContext = {
  orderType: PosOrderType;
  items: Array<Pick<OrderItem, 'quantity' | 'item_price'>>;
  manualDiscountAmount?: number;
  voucherDiscountAmount?: number;
  serviceChargeAmount?: number;
  skipTax?: boolean;
  payments?: PosPaymentDto[];
  persistableCharges?: BranchCharge[];
};

@Injectable()
export class PosService {
  private static readonly DAY_OPERATIONS_SHIFT_NAME = 'Day Operations';
  private static readonly DAY_OPERATIONS_SHIFT_CODE = 'DAY-OPS';
  constructor(
    @InjectRepository(KitchenTableEntity) private tableRepo: Repository<KitchenTableEntity>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    @InjectRepository(KOT) private kotRepo: Repository<KOT>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(BranchCharge) private branchChargeRepo: Repository<BranchCharge>,
    @InjectRepository(OrderCharge) private orderChargeRepo: Repository<OrderCharge>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(Floor) private floorRepo: Repository<Floor>,
    @InjectRepository(SaleCounter) private saleCounterRepo: Repository<SaleCounter>,
    @InjectRepository(PosDevice) private posDeviceRepo: Repository<PosDevice>,
    @InjectRepository(PosSyncEvent) private posSyncEventRepo: Repository<PosSyncEvent>,
    @InjectRepository(OrderReturn) private orderReturnRepo: Repository<OrderReturn>,
    @InjectRepository(OrderReturnItem) private orderReturnItemRepo: Repository<OrderReturnItem>,
    @InjectRepository(PosVoidLog) private posVoidLogRepo: Repository<PosVoidLog>,
    @InjectRepository(BranchProductMapping) private mappingRepo: Repository<BranchProductMapping>,
    @InjectRepository(UserManagement) private userRepo: Repository<UserManagement>,
    @InjectRepository(AuthorizedTill) private authorizedTillRepo: Repository<AuthorizedTill>,
    @InjectRepository(BusinessDay) private businessDayRepo: Repository<BusinessDay>,
    @InjectRepository(ShiftTemplate) private shiftTemplateRepo: Repository<ShiftTemplate>,
    @InjectRepository(PosCardMachine) private posCardMachineRepo: Repository<PosCardMachine>,
    @InjectRepository(TaxConfiguration) private taxConfigurationRepo: Repository<TaxConfiguration>,
    private readonly recipeService: RecipeService,
    private readonly inventoryOpService: InventoryOpService,
    private readonly accountingService: AccountingService,
    private readonly customersService: CustomersService,
    private readonly dealsService: DealsService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly entitlementsService: EntitlementsService,
    private readonly catalogService: CatalogService,
    private readonly dataSource: DataSource,
  ) {}

  private roundCurrency(value: unknown): number {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized)) {
      return 0;
    }
    return Math.round(normalized * 100) / 100;
  }

  private parseOptionalDate(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private resolveShiftWindow(shift?: Partial<Shift> | null): { start: Date | null; end: Date | null } {
    if (!shift) {
      return { start: null, end: null };
    }

    return {
      start: this.parseOptionalDate(shift.planned_start ?? shift.actual_start ?? shift.opened_at ?? null),
      end: this.parseOptionalDate(shift.planned_end ?? shift.actual_end ?? shift.closed_at ?? null),
    };
  }

  private shiftWindowsOverlap(left?: Partial<Shift> | null, right?: Partial<Shift> | null): boolean {
    const leftWindow = this.resolveShiftWindow(left);
    const rightWindow = this.resolveShiftWindow(right);
    if (!leftWindow.start || !leftWindow.end || !rightWindow.start || !rightWindow.end) {
      return true;
    }
    return leftWindow.start < rightWindow.end && rightWindow.start < leftWindow.end;
  }

  private normalizeSyncEntityType(value?: string | null): 'ORDER' | 'KOT' | 'SHIFT' | 'BUSINESS_DAY' | 'COUNTER_SESSION' {
    const normalized = String(value || 'ORDER').trim().toUpperCase();
    if (normalized === 'KOT') {
      return 'KOT';
    }
    if (normalized === 'SHIFT') {
      return 'SHIFT';
    }
    if (normalized === 'BUSINESS_DAY') {
      return 'BUSINESS_DAY';
    }
    if (normalized === 'COUNTER_SESSION') {
      return 'COUNTER_SESSION';
    }
    return 'ORDER';
  }

  private normalizeOrderType(orderType?: string | null): PosOrderType {
    const normalized = String(orderType || 'dine_in').toLowerCase();
    if (normalized === 'delivery') {
      return 'delivery';
    }
    if (['takeout', 'takeaway'].includes(normalized)) {
      return 'takeout';
    }
    return 'dine_in';
  }

  private cleanDeliveryText(
    value: unknown,
    maxLength: number,
  ): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
  }

  private normalizeDeliveryStatus(value?: string | null): PosDeliveryStatus {
    const normalized = String(value || 'pending').trim().toLowerCase();
    if (normalized === 'assigned') return 'assigned';
    if (normalized === 'out_for_delivery') return 'out_for_delivery';
    if (normalized === 'delivered') return 'delivered';
    if (normalized === 'cancelled') return 'cancelled';
    return 'pending';
  }

  private normalizeDeliveryDetails(
    input?: PosDeliveryDetailsDto | Record<string, unknown> | null,
  ): PosDeliveryDetails | null {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const deliveryPersonUserId = Number((input as Record<string, unknown>).delivery_person_user_id || 0);
    const normalized: PosDeliveryDetails = {
      contact_person: this.cleanDeliveryText((input as Record<string, unknown>).contact_person, 150),
      phone_number: this.cleanDeliveryText((input as Record<string, unknown>).phone_number, 30),
      address: this.cleanDeliveryText((input as Record<string, unknown>).address, 255),
      house_apartment: this.cleanDeliveryText((input as Record<string, unknown>).house_apartment, 150),
      street_no: this.cleanDeliveryText((input as Record<string, unknown>).street_no, 100),
      area_sector: this.cleanDeliveryText((input as Record<string, unknown>).area_sector, 150),
      locality: this.cleanDeliveryText((input as Record<string, unknown>).locality, 150),
      city: this.cleanDeliveryText((input as Record<string, unknown>).city, 120),
      ask_for: this.cleanDeliveryText((input as Record<string, unknown>).ask_for, 150),
      delivery_person_user_id: Number.isFinite(deliveryPersonUserId) && deliveryPersonUserId > 0 ? deliveryPersonUserId : null,
      delivery_person_name: this.cleanDeliveryText((input as Record<string, unknown>).delivery_person_name, 150),
      payment_term: String((input as Record<string, unknown>).payment_term || '').toLowerCase() === 'paid' ? 'paid' : 'cod',
      delivery_status: this.normalizeDeliveryStatus(String((input as Record<string, unknown>).delivery_status || 'pending')),
      comment: this.cleanDeliveryText((input as Record<string, unknown>).comment, 500),
    };

    const hasValue = Object.values(normalized).some((value) => value !== null && value !== undefined && value !== '');
    return hasValue ? normalized : null;
  }

  private normalizePaymentMode(paymentMode?: string | null): PosPaymentMode {
    const normalized = String(paymentMode || 'cash').toLowerCase();
    if (normalized === 'bank') {
      return 'bank';
    }
    if (normalized === 'card') {
      return 'card';
    }
    if (['digital_wallet', 'wallet'].includes(normalized)) {
      return 'digital_wallet';
    }
    if (normalized === 'other') {
      return 'other';
    }
    return 'cash';
  }

  private isMerchantSettlementPaymentMode(paymentMode?: string | null): boolean {
    const normalized = this.normalizePaymentMode(paymentMode);
    return normalized === 'card' || normalized === 'digital_wallet';
  }

  private resolvePosTenderAccountId(
    paymentMode: string | null | undefined,
    accounts: { cashAccountId: number; bankAccountId: number; merchantClearingAccountId: number },
  ): number {
    const normalized = this.normalizePaymentMode(paymentMode);
    if (this.isMerchantSettlementPaymentMode(normalized)) {
      return accounts.merchantClearingAccountId;
    }
    if (normalized === 'bank') {
      return accounts.bankAccountId;
    }
    return accounts.cashAccountId;
  }

  private normalizePaymentDetails(value?: Record<string, any> | null): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const cleaned = Object.fromEntries(
      Object.entries(value)
        .map(([key, entryValue]) => [key, typeof entryValue === 'string' ? entryValue.trim() : entryValue])
        .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== ''),
    );
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }

  private normalizeOrderStatus(status?: string | null): PosMutableOrderStatus {
    const normalized = String(status || 'pending').toLowerCase();
    if (
      [
        'held',
        'pending',
        'preparing',
        'ready',
        'served',
        'completed',
        'cancelled',
        'voided',
      ].includes(normalized)
    ) {
      return normalized as PosMutableOrderStatus;
    }

    return 'pending';
  }

  private ensureNonNegativeMoney(value: unknown, fieldName: string): number {
    const normalized = this.roundCurrency(value);
    if (normalized < 0) {
      throw new BadRequestException(`${fieldName} cannot be negative.`);
    }
    return normalized;
  }

  private async assertSaleCounterBelongsToBranch(
    clientId: string,
    branchId: number,
    saleCounterId?: number | null,
  ): Promise<SaleCounter | null> {
    if (!saleCounterId) {
      return null;
    }

    const counter = await this.saleCounterRepo.findOne({
      where: {
        id: saleCounterId,
        client_id: clientId,
        branch_id: branchId,
      },
    });

    if (!counter || !counter.is_active) {
      throw new NotFoundException('Sale counter not found for this branch.');
    }

    return counter;
  }

  private buildReceiptNumber(branchId: number, orderId: number): string {
    return `RCPT-${branchId}-${String(orderId).padStart(6, '0')}`;
  }

  private getOrderChannel(orderType?: string | null): 'dine_in' | 'takeout' | 'delivery' {
    return this.normalizeOrderType(orderType);
  }

  private buildUnavailableProductMessage(
    productName: string,
    reason: 'master_inactive' | 'branch_disabled' | 'temporary_disable' | 'channel_disabled' | null,
    temporarilyDisabledUntil?: Date | null,
  ): string {
    switch (reason) {
      case 'master_inactive':
        return `${productName} is inactive in the shared product master.`;
      case 'branch_disabled':
        return `${productName} is disabled for this branch.`;
      case 'temporary_disable':
        return `${productName} is temporarily disabled for this branch${
          temporarilyDisabledUntil ? ` until ${temporarilyDisabledUntil.toISOString()}` : ''
        }.`;
      case 'channel_disabled':
        return `${productName} is not available for this order channel.`;
      default:
        return `${productName} is not available for this branch.`;
    }
  }

  private async assertBranchBelongsToClient(
    clientId: string,
    branchId: number,
    operation?: string,
  ): Promise<Branch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (operation) {
      assertBranchOperationalWriteAllowed(branch, operation);
    }
    return branch;
  }

  private async assertFloorBelongsToBranch(branchId: number, floorId?: number): Promise<Floor | null> {
    if (!floorId) {
      return null;
    }

    const floor = await this.floorRepo.findOne({ where: { id: floorId, branch_id: branchId } });
    if (!floor) {
      throw new NotFoundException('Floor not found for this branch');
    }
    return floor;
  }

  private async assertTableBelongsToBranch(branchId: number, tableId?: number): Promise<KitchenTableEntity | null> {
    if (!tableId) {
      return null;
    }

    const table = await this.tableRepo.findOne({ where: { id: tableId, branch_id: branchId } });
    if (!table) {
      throw new NotFoundException('Table not found for this branch');
    }
    return table;
  }

  private async loadOrderOrFail(
    clientId: string,
    branchId: number,
    orderId: number,
  ): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, client_id: clientId, branch_id: branchId },
      relations: [
        'items',
        'items.product',
        'items.product.category',
        'items.product.production_station',
        'table',
        'transactions',
        'transactions.user',
        'charges',
        'voucher',
        'sale_counter',
        'shift',
        'returns',
        'returns.items',
        'returns.payments',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private async refreshShiftExpectedCash(shift: Shift): Promise<Shift> {
    const transactionTotals = await this.transactionRepo.createQueryBuilder('transaction')
      .select(
        `COALESCE(SUM(CASE
          WHEN transaction.payment_mode = 'cash' AND transaction.is_refund = false THEN transaction.amount
          WHEN transaction.payment_mode = 'cash' AND transaction.is_refund = true THEN -transaction.amount
          ELSE 0
        END), 0)`,
        'cash_total',
      )
      .where('transaction.shift_id = :shiftId', { shiftId: shift.id })
      .andWhere('transaction.client_id = :clientId', { clientId: shift.client_id })
      .andWhere('transaction.branch_id = :branchId', { branchId: shift.branch_id })
      .getRawOne();

    shift.expected_cash = this.roundCurrency(
      Number(shift.opening_float || 0) + Number(transactionTotals?.cash_total || 0),
    );

    return this.shiftRepo.save(shift);
  }

  private async requireOpenShift(clientId: string, branchId: number): Promise<Shift> {
    const shift = await this.ensureOperationalShift(clientId, branchId);
    if (!shift) {
      throw new BadRequestException('An active POS shift is required for this branch.');
    }
    return shift;
  }

  private async ensureOperationalShift(
    clientId: string,
    branchId: number,
    userId?: number | null,
    providedBusinessDay?: BusinessDay | null,
    user?: JwtPayload,
  ): Promise<Shift | null> {
    const businessDay = providedBusinessDay ?? await this.getActiveBusinessDay(clientId, branchId);
    if (!businessDay) {
      return null;
    }

    const openShift = await this.shiftRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        business_day_id: businessDay.id,
        status: 'open',
      },
      order: { opened_at: 'ASC', id: 'ASC' },
    });
    if (openShift) {
      return openShift;
    }

    const actorId = Number(userId || businessDay.opened_by_user_id || 0);
    if (!Number.isFinite(actorId) || actorId <= 0) {
      throw new BadRequestException('An assigned user is required to initialize day operations.');
    }

    const plannedStart = businessDay.opened_at ?? new Date();
    const plannedEnd = businessDay.planned_closing_at ?? null;
    const shift = this.shiftRepo.create({
      client_id: clientId,
      branch_id: branchId,
      business_day_id: businessDay.id,
      shift_template_id: null,
      user_id: actorId,
      external_shift_id: null,
      source_device_id: null,
      source_device_uid: null,
      sync_origin: 'online',
      opening_float: 0,
      expected_cash: 0,
      actual_cash: 0,
      variance: 0,
      status: 'open',
      opened_at: businessDay.opened_at ?? new Date(),
      closed_at: null,
      business_date: businessDay.business_date,
      is_day_open: true,
      shift_name: PosService.DAY_OPERATIONS_SHIFT_NAME,
      shift_code: PosService.DAY_OPERATIONS_SHIFT_CODE,
      shift_order: 0,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      actual_start: businessDay.opened_at ?? new Date(),
      actual_end: null,
      supervisor_id: null as any,
      sale_counter_id: null,
    });
    const saved = await this.shiftRepo.save(shift);

    await this.operationalAuditService.log({
      user,
      action: 'Operating Shift Auto-Start',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Started internal ${saved.shift_name}`,
      metadata: { business_day_id: businessDay.id, auto_created: true },
    });

    return saved;
  }

  private async attachOrderMeta(serializedOrders: any[]): Promise<any[]> {
    if (!serializedOrders.length) return serializedOrders;
    const orderIds = serializedOrders.map((order) => Number(order.id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!orderIds.length) return serializedOrders;
    const clientId = String(serializedOrders[0]?.client_id || '');
    const branchId = Number(serializedOrders[0]?.branch_id || 0);
    const branch = clientId && Number.isFinite(branchId) && branchId > 0
      ? await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } })
      : null;

    const kots = await this.kotRepo.find({
      where: orderIds.map((orderId) => ({ order_id: String(orderId), client_id: clientId, branch_id: branchId })),
      order: { created_at: 'ASC', id: 'ASC' },
    });

    const kotMap = new Map<string, any[]>();
    for (const kot of kots) {
      const key = String(kot.order_id);
      const bucket = kotMap.get(key) ?? [];
      bucket.push({
        id: kot.id,
        kot_number: kot.kot_number,
        type: kot.type ?? null,
        status: String(kot.status || 'pending').toLowerCase(),
        created_at: kot.created_at,
        updated_at: kot.updated_at ?? kot.created_at,
        items_json: kot.items_json,
        items: this.parseKotItemsJson(kot.items_json),
      });
      kotMap.set(key, bucket);
    }

    return Promise.all(serializedOrders.map(async (order) => {
      const currentKotNumber = order.kot_base_number && Number(order.kot_version || 0) > 0
        ? await this.buildKotNumber(
          String(order.client_id || ''),
          Number(order.branch_id || 0),
          Number(order.kot_base_number || 0),
          Number(order.kot_version || 0),
          order.sale_counter_code ?? String(order.sale_counter_id || ''),
          null,
          branch,
        )
        : order.kot_base_number
          ? this.formatKotBaseNumber(order.kot_base_number)
          : null;

      const orderKots = kotMap.get(String(order.id)) ?? [];
      const displayOrderKots = await Promise.all(orderKots.map(async (kot, index) => {
        const displayNumber = order.kot_base_number
          ? await this.buildKotNumber(
            String(order.client_id || ''),
            Number(order.branch_id || 0),
            Number(order.kot_base_number || 0),
            index + 1,
            order.sale_counter_code ?? String(order.sale_counter_id || ''),
            null,
            branch,
          )
          : String(kot.kot_number || '').trim() || null;

        return {
          ...kot,
          kot_number: displayNumber,
          current_kot_number: displayNumber,
          current_kot_display_number: displayNumber,
          display_kot_number: displayNumber,
        };
      }));

      return {
        ...order,
        current_kot_number: currentKotNumber,
        current_kot_display_number: currentKotNumber,
        kots: displayOrderKots,
        kot_numbers: displayOrderKots.map((kot) => kot.kot_number).filter(Boolean),
      };
    }));
  }

  private parseTimeValue(value: string): { hours: number; minutes: number; seconds: number } {
    const [hoursRaw, minutesRaw, secondsRaw] = String(value || '').split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw || 0);
    if (
      !Number.isInteger(hours)
      || !Number.isInteger(minutes)
      || !Number.isInteger(seconds)
      || hours < 0
      || hours > 23
      || minutes < 0
      || minutes > 59
      || seconds < 0
      || seconds > 59
    ) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }
    return { hours, minutes, seconds };
  }

  private combineBusinessDateAndTime(businessDate: string, timeValue: string): Date {
    const { hours, minutes, seconds } = this.parseTimeValue(timeValue);
    const date = new Date(`${businessDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid business date: ${businessDate}`);
    }
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }

  private computeShiftWindow(businessDate: string, template: ShiftTemplate) {
    const plannedStart = this.combineBusinessDateAndTime(businessDate, template.planned_start_time);
    const plannedEnd = this.combineBusinessDateAndTime(businessDate, template.planned_end_time);
    if (plannedEnd <= plannedStart) {
      plannedEnd.setDate(plannedEnd.getDate() + 1);
    }
    return { plannedStart, plannedEnd };
  }

  private normalizeSessionStatus(status: AuthorizedTill['terminal_status']) {
    switch (status) {
      case 'open':
        return 'assigned';
      case 'active':
        return 'open';
      case 'blind_submitted':
        return 'blind_closed';
      case 'closed':
        return 'verified_closed';
      default:
        return status;
    }
  }

  private getCounterSessionDisplayStatus(status: AuthorizedTill['terminal_status']) {
    switch (status) {
      case 'open':
        return 'ready_to_open';
      case 'active':
        return 'sales_counter_open';
      case 'blind_submitted':
        return 'awaiting_supervisor_verification';
      case 'closed':
        return 'fully_closed';
      default:
        return String(status || '').toLowerCase();
    }
  }

  private formatCounterSession(row: AuthorizedTill & { open_orders_count?: number } & Record<string, any>) {
    const normalizedTerminalStatus = String(row.terminal_status || '').toLowerCase() as AuthorizedTill['terminal_status'];
    return {
      ...row,
      assigned_float: Number(row.assigned_float ?? 0),
      opening_verified_cash: row.opening_verified_cash === null || row.opening_verified_cash === undefined
        ? null
        : Number(row.opening_verified_cash),
      blind_count: row.blind_count === null || row.blind_count === undefined ? null : Number(row.blind_count),
      expected_cash: row.expected_cash === null || row.expected_cash === undefined ? null : Number(row.expected_cash),
      variance: row.variance === null || row.variance === undefined ? null : Number(row.variance),
      workflow_status: this.normalizeSessionStatus(row.terminal_status),
      display_status: this.getCounterSessionDisplayStatus(normalizedTerminalStatus),
      action_card_visible: normalizedTerminalStatus !== 'closed',
      can_reopen: normalizedTerminalStatus === 'closed',
      pending_supervisor_verification: normalizedTerminalStatus === 'blind_submitted',
      open_orders_count: Number(row.open_orders_count ?? 0),
    };
  }

  private async formatCounterSessionForConsole(
    row: AuthorizedTill & { open_orders_count?: number } & Record<string, any>,
    clientId: string,
    branchId: number,
  ) {
    const formatted = this.formatCounterSession(row);
    const normalizedTerminalStatus = String(row.terminal_status || '').toLowerCase();
    let salesFigure: number | null = null;
    let actualCashCollected = formatted.blind_count === null || formatted.blind_count === undefined
      ? null
      : Number(formatted.blind_count);
    let expectedCash = formatted.expected_cash === null || formatted.expected_cash === undefined
      ? null
      : Number(formatted.expected_cash);
    let variance = formatted.variance === null || formatted.variance === undefined
      ? null
      : Number(formatted.variance);

    if (normalizedTerminalStatus === 'active' || normalizedTerminalStatus === 'blind_submitted' || normalizedTerminalStatus === 'closed') {
      const counterCash = await this.calculateCounterSessionCash(row, clientId, branchId);
      salesFigure = counterCash.cashFromOrders;
      if (normalizedTerminalStatus === 'blind_submitted') {
        actualCashCollected = counterCash.blindCount;
        expectedCash = counterCash.expectedCash;
        variance = counterCash.variance;
      } else {
        expectedCash = expectedCash ?? counterCash.expectedCash;
        variance = variance ?? counterCash.variance;
      }
    }

    return {
      ...formatted,
      sales_figure: salesFigure,
      actual_cash_collected: actualCashCollected,
      expected_cash: expectedCash,
      variance,
      closing_comment: formatted.reconciliation_notes ? String(formatted.reconciliation_notes) : null,
    };
  }

  private async getActiveBusinessDay(clientId: string, branchId: number): Promise<BusinessDay | null> {
    return this.businessDayRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, status: 'open' },
      order: { opened_at: 'DESC', id: 'DESC' },
    });
  }

  private async requireActiveBusinessDay(clientId: string, branchId: number): Promise<BusinessDay> {
    const businessDay = await this.getActiveBusinessDay(clientId, branchId);
    if (!businessDay) {
      throw new BadRequestException('An open business day is required for this branch.');
    }
    return businessDay;
  }

  private async requireBranchStaff(clientId: string, userId: number): Promise<UserManagement> {
    const user = await this.userRepo.findOne({
      where: { id: userId, client_id: clientId, status: 'active', is_active: true },
    });
    if (!user) {
      throw new NotFoundException('Assigned cashier was not found or is inactive.');
    }
    return user;
  }

  private async requireCounterSession(
    clientId: string,
    branchId: number,
    sessionId: number,
    relations: string[] = [],
  ): Promise<AuthorizedTill> {
    const row = await this.authorizedTillRepo.findOne({
      where: { id: sessionId, client_id: clientId, branch_id: branchId },
      relations,
    });
    if (!row) {
      throw new NotFoundException('Counter session was not found.');
    }
    return row;
  }

  private async calculateCounterSessionCash(row: AuthorizedTill, clientId: string, branchId: number) {
    const sessionStart = row.opening_verified_at || row.activated_at || row.created_at;
    const sessionEnd = row.blind_submitted_at || row.reconciled_at || new Date();
    const counterCashResult = await this.transactionRepo.createQueryBuilder('transaction')
      .select(
        `COALESCE(SUM(CASE
          WHEN transaction.payment_mode = 'cash' AND transaction.is_refund = false THEN transaction.amount
          WHEN transaction.payment_mode = 'cash' AND transaction.is_refund = true THEN -transaction.amount
          ELSE 0
        END), 0)`,
        'cash_total',
      )
      .where('transaction.shift_id = :shiftId', { shiftId: row.shift_id })
      .andWhere('transaction.client_id = :clientId', { clientId })
      .andWhere('transaction.branch_id = :branchId', { branchId })
      .andWhere('transaction.user_id = :userId', { userId: row.user_id ?? 0 })
      .andWhere('transaction.transaction_date BETWEEN :start AND :end', { start: sessionStart, end: sessionEnd })
      .getRawOne();

    const cashFromOrders = this.roundCurrency(Number(counterCashResult?.cash_total || 0));
    const expectedCash = this.roundCurrency(Number(row.assigned_float) + cashFromOrders);
    const blindCount = this.roundCurrency(Number(row.blind_count || 0));
    const variance = this.roundCurrency(blindCount - expectedCash);

    return { cashFromOrders, expectedCash, blindCount, variance };
  }

  private async requireActiveCounterSessionForUser(
    clientId: string,
    branchId: number,
    userId: number,
    shiftId?: number | null,
  ): Promise<AuthorizedTill> {
    const row = await this.authorizedTillRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        user_id: userId,
        terminal_status: 'active',
        ...(shiftId ? { shift_id: shiftId } : {}),
      },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
      order: { updated_at: 'DESC', id: 'DESC' },
    });

    if (!row) {
      throw new BadRequestException('An active sales counter session is required before receiving payment.');
    }

    return row;
  }

  private async refreshShiftSessionTotals(shift: Shift): Promise<Shift> {
    const sessions = await this.authorizedTillRepo.find({
      where: { client_id: shift.client_id, branch_id: shift.branch_id, shift_id: shift.id },
    });

    const openingFloat = this.roundCurrency(
      sessions.reduce((sum, session) => sum + Number(session.assigned_float || 0), 0),
    );
    const expectedCash = this.roundCurrency(
      sessions.reduce((sum, session) => sum + Number(session.expected_cash || 0), 0),
    );
    const actualCash = this.roundCurrency(
      sessions.reduce((sum, session) => sum + Number(session.blind_count || 0), 0),
    );
    const variance = this.roundCurrency(
      sessions.reduce((sum, session) => sum + Number(session.variance || 0), 0),
    );

    shift.opening_float = openingFloat;
    shift.expected_cash = expectedCash;
    shift.actual_cash = actualCash;
    shift.variance = variance;
    return this.shiftRepo.save(shift);
  }

  private getSystemDayBounds(anchor: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(anchor);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private async resolveDocumentRule(
    clientId: string,
    branch: Branch,
    type: BranchDocumentType,
  ): Promise<BranchDocumentRule> {
    const defaults = createDefaultClientNumberingSettings().rules[type];
    const settings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });

    return {
      ...defaults,
      ...(branch.document_settings?.[type] ?? {}),
      ...(settings?.numbering_settings?.rules?.[type] ?? {}),
    };
  }

  private async generateOrderNumber(clientId: string, branch: Branch, saleCounterId?: number | null): Promise<string> {
    const saleCounter = Number.isInteger(Number(saleCounterId)) && Number(saleCounterId) > 0
      ? await this.saleCounterRepo.findOne({ where: { id: Number(saleCounterId), client_id: clientId, branch_id: branch.id } })
      : null;
    const rule = await this.resolveDocumentRule(clientId, branch, 'pos_order');
    return nextBranchDocumentNumber({
      repository: this.orderRepo,
      alias: 'order',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code,
      counterCode: saleCounter?.code ?? null,
      rule,
      documentColumn: 'order_number',
      applyScope: (query) => {
        query.andWhere('order.order_number IS NOT NULL').andWhere("order.order_number <> ''");
      },
    });
  }

  private formatKotBaseNumber(baseNumber?: number | null): string {
    const normalized = Math.max(0, Math.trunc(Number(baseNumber || 0)));
    return String(normalized).padStart(4, '0');
  }

  private async buildKotNumber(
    clientId: string,
    branchId: number,
    baseNumber: number,
    version: number,
    counterCode?: string | null,
    businessDate?: string | null,
    branch?: Branch | null,
  ): Promise<string> {
    const resolvedBranch = branch ?? await this.branchRepo.findOne({
      where: { id: branchId, client_id: clientId },
    });

    if (!resolvedBranch) {
      const baseFallback = this.formatKotBaseNumber(baseNumber);
      const normalizedVersion = Math.max(0, Math.trunc(Number(version || 0)));
      const counter = String(counterCode || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '');
      const prefix = counter ? `KOT-${counter}-${baseFallback}` : `KOT-${baseFallback}`;
      return normalizedVersion <= 1 ? prefix : `${prefix}-${normalizedVersion - 1}`;
    }

    const rule = await this.resolveDocumentRule(clientId, resolvedBranch, 'pos_kot');
    const normalizedDate = businessDate && /^\d{4}-\d{2}-\d{2}$/.test(businessDate)
      ? new Date(`${businessDate}T00:00:00`)
      : new Date();
    const base = formatBranchDocumentNumber(
      rule,
      resolvedBranch.branch_code,
      Math.max(0, Math.trunc(Number(baseNumber || 0))),
      normalizedDate,
      counterCode,
    );
    const normalizedVersion = Math.max(0, Math.trunc(Number(version || 0)));
    return normalizedVersion <= 1 ? base : `${base}-${normalizedVersion - 1}`;
  }

  private async resolveKotBusinessDate(
    order: Order,
    manager?: EntityManager,
  ): Promise<string> {
    const shiftBusinessDate = order.shift?.business_date;
    if (shiftBusinessDate) {
      return shiftBusinessDate;
    }

    if (order.shift_id) {
      const shiftRepo = (manager ?? this.dataSource.manager).getRepository(Shift);
      const shift = await shiftRepo.findOne({
        where: {
          id: order.shift_id,
          client_id: order.client_id,
          branch_id: order.branch_id,
        },
      });
      if (shift?.business_date) {
        order.shift = shift as Shift;
        return shift.business_date;
      }
    }

    const activeBusinessDay = await this.requireActiveBusinessDay(order.client_id, order.branch_id);
    return activeBusinessDay.business_date;
  }

  private async resolveCounterSessionBusinessDate(
    session: Pick<AuthorizedTill, 'client_id' | 'branch_id' | 'shift_id'> & { shift?: Partial<Shift> | null },
    manager?: EntityManager,
  ): Promise<string> {
    const shiftBusinessDate = session.shift?.business_date;
    if (shiftBusinessDate) {
      return shiftBusinessDate;
    }

    if (session.shift_id) {
      const shiftRepo = (manager ?? this.dataSource.manager).getRepository(Shift);
      const shift = await shiftRepo.findOne({
        where: {
          id: session.shift_id,
          client_id: session.client_id,
          branch_id: session.branch_id,
        },
      });
      if (shift?.business_date) {
        return shift.business_date;
      }
    }

    const activeBusinessDay = await this.requireActiveBusinessDay(session.client_id, session.branch_id);
    return activeBusinessDay.business_date;
  }

  private buildKotSubmissionHash(entries: any[]): string {
    const normalizedEntries = [...entries]
      .map((entry) => ({
        order_item_id: Number(entry?.source_order_item_id ?? entry?.order_item_id ?? 0),
        kds_line_id: String(entry?.kds_line_id ?? entry?.order_item_id ?? ''),
        product_id: Number(entry?.product_id ?? 0),
        product_name: String(entry?.product_name ?? entry?.name ?? '').trim(),
        quantity: Number(entry?.quantity ?? 0),
        submitted_quantity: Number(entry?.submitted_quantity ?? entry?.quantity ?? 0),
        item_status: String(entry?.item_status ?? 'pending').toLowerCase(),
        item_notes: String(entry?.item_notes ?? entry?.notes ?? entry?.instructions ?? '').trim(),
        modifiers: Array.isArray(entry?.modifiers)
          ? entry.modifiers.map((modifier: unknown) => String(modifier ?? '').trim()).filter(Boolean)
          : [],
        old_quantity: entry?.old_quantity === null || entry?.old_quantity === undefined ? null : Number(entry.old_quantity),
        is_new: Boolean(entry?.is_new),
        is_updated: Boolean(entry?.is_updated),
        is_addition_delta: Boolean(entry?.is_addition_delta),
        is_cancelled: Boolean(entry?.is_cancelled),
        changed_at: entry?.changed_at ? new Date(entry.changed_at).toISOString() : null,
        timer_reset_at: entry?.timer_reset_at ? new Date(entry.timer_reset_at).toISOString() : null,
        cancelled_at: entry?.cancelled_at ? new Date(entry.cancelled_at).toISOString() : null,
      }))
      .sort((left, right) => left.order_item_id - right.order_item_id);

    return this.computePayloadHash(normalizedEntries);
  }

  private async reserveNextKotBaseNumber(
    manager: EntityManager,
    clientId: string,
    branchId: number,
    businessDate: string,
  ): Promise<number> {
    const businessDay = await manager.getRepository(BusinessDay)
      .createQueryBuilder('business_day')
      .setLock('pessimistic_write')
      .where('business_day.client_id = :clientId', { clientId })
      .andWhere('business_day.branch_id = :branchId', { branchId })
      .andWhere('business_day.business_date = :businessDate', { businessDate })
      .getOne();

    if (!businessDay) {
      throw new BadRequestException(`Business day ${businessDate} was not found for KOT numbering.`);
    }

    const row = await manager.getRepository(Order)
      .createQueryBuilder('order')
      .innerJoin(Shift, 'shift', 'shift.id = order.shift_id')
      .select('MAX(order.kot_base_number)', 'max_base_number')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('shift.client_id = :clientId', { clientId })
      .andWhere('shift.branch_id = :branchId', { branchId })
      .andWhere('shift.business_date = :businessDate', { businessDate })
      .getRawOne<{ max_base_number?: number | string | null }>();

    const current = Number(row?.max_base_number ?? 0);
    return current + 1;
  }

  private async ensureOrderKotBaseNumber(order: Order): Promise<number> {
    if (Number.isInteger(Number(order.kot_base_number)) && Number(order.kot_base_number) > 0) {
      return Number(order.kot_base_number);
    }

    const baseNumber = await this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager.getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: order.id })
        .andWhere('order.client_id = :clientId', { clientId: order.client_id })
        .andWhere('order.branch_id = :branchId', { branchId: order.branch_id })
        .getOne();

      if (!lockedOrder) {
        throw new NotFoundException('Order not found.');
      }

      if (Number.isInteger(Number(lockedOrder.kot_base_number)) && Number(lockedOrder.kot_base_number) > 0) {
        return Number(lockedOrder.kot_base_number);
      }

      const businessDate = await this.resolveKotBusinessDate(lockedOrder, manager);
      const nextBaseNumber = await this.reserveNextKotBaseNumber(
        manager,
        lockedOrder.client_id,
        lockedOrder.branch_id,
        businessDate,
      );
      lockedOrder.kot_base_number = nextBaseNumber;
      await manager.getRepository(Order).save(lockedOrder);
      return nextBaseNumber;
    });

    order.kot_base_number = baseNumber;
    return baseNumber;
  }

  private async generateReceiptNumber(clientId: string, branch: Branch): Promise<string> {
    const rule = await this.resolveDocumentRule(clientId, branch, 'pos_receipt');
    return nextBranchDocumentNumber({
      repository: this.orderRepo,
      alias: 'order',
      clientId,
      branchId: branch.id,
      branchCode: branch.branch_code,
      rule,
      documentColumn: 'receipt_number',
      applyScope: (query) => {
        query.andWhere('order.receipt_number IS NOT NULL').andWhere("order.receipt_number <> ''");
      },
    });
  }

  private buildReturnInvoiceNumber(branchId: number, returnId: number): string {
    return `RET-${String(branchId || 0).padStart(3, '0')}-${String(returnId || 0).padStart(6, '0')}`;
  }

  private normalizeSyncStatus(status?: string): 'pending' | 'preparing' | 'ready' | 'completed' {
    const normalized = String(status || 'pending').toLowerCase();
    if (['preparing', 'cooking'].includes(normalized)) return 'preparing';
    if (['ready', 'served'].includes(normalized)) return 'ready';
    if (['completed', 'cleared', 'done'].includes(normalized)) return 'completed';
    return 'pending';
  }

  private readonly closableOrderTerminalStatuses = ['completed', 'cancelled', 'voided'];

  private readonly closableCounterBlockedOrderStatuses = ['held', 'pending', 'preparing', 'ready', 'served'];

  private readonly closableCounterBlockedPaymentStatuses = ['unpaid', 'partial'];

  private readonly closableCounterBlockedKotStatuses = ['pending', 'preparing', 'ready'];

  private async assertCounterSessionHasNoOpenOrders(
    session: Pick<AuthorizedTill, 'id' | 'client_id' | 'branch_id' | 'sale_counter_id' | 'shift_id'>,
  ): Promise<void> {
    const blockedOrder = await this.orderRepo.createQueryBuilder('order')
      .select([
        'order.id AS id',
        'order.order_number AS order_number',
        'order.order_status AS order_status',
        'order.payment_status AS payment_status',
      ])
      .where('order.client_id = :clientId', { clientId: session.client_id })
      .andWhere('order.branch_id = :branchId', { branchId: session.branch_id })
      .andWhere('order.sale_counter_id = :saleCounterId', { saleCounterId: session.sale_counter_id })
      .andWhere('order.shift_id = :shiftId', { shiftId: session.shift_id })
      .andWhere('(order.order_status IN (:...statuses) OR order.payment_status IN (:...paymentStatuses))', {
        statuses: this.closableCounterBlockedOrderStatuses,
        paymentStatuses: this.closableCounterBlockedPaymentStatuses,
      })
      .andWhere("LOWER(COALESCE(order.order_status, '')) NOT IN ('cancelled', 'voided')")
      .orderBy('order.updated_at', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .getRawOne<{ id?: number; order_number?: string | null; order_status?: string | null; payment_status?: string | null }>();

    if (!blockedOrder) {
      return;
    }

    const orderLabel = blockedOrder.order_number?.trim() || `#${blockedOrder.id}`;
    const orderStatusLabel = String(blockedOrder.order_status || 'open').replace(/_/g, ' ');
    const paymentStatus = String(blockedOrder.payment_status || '').trim().toLowerCase();
    const statusLabel = paymentStatus && ['unpaid', 'partial'].includes(paymentStatus)
      ? `payment ${paymentStatus}`
      : orderStatusLabel;
    throw new BadRequestException(
      `This sales counter cannot be closed while open orders remain. Close, pay, void, or credit-settle every order first. Pending order: ${orderLabel} (${statusLabel}).`,
    );
  }

  private async assertCounterSessionHasNoOpenKots(
    session: Pick<AuthorizedTill, 'client_id' | 'branch_id' | 'sale_counter_id' | 'shift_id'>,
  ): Promise<void> {
    const blockedKot = await this.kotRepo.createQueryBuilder('kot')
      .innerJoin(
        Order,
        'order',
        `CAST(order.id AS CHAR) COLLATE utf8mb4_unicode_ci = kot.order_id COLLATE utf8mb4_unicode_ci
          AND order.client_id COLLATE utf8mb4_unicode_ci = kot.client_id COLLATE utf8mb4_unicode_ci
          AND order.branch_id = kot.branch_id`,
      )
      .select([
        'kot.id AS id',
        'kot.kot_number AS kot_number',
        'kot.status AS kot_status',
        'order.id AS order_id',
        'order.order_number AS order_number',
      ])
      .where('kot.client_id = :clientId', { clientId: session.client_id })
      .andWhere('kot.branch_id = :branchId', { branchId: session.branch_id })
      .andWhere('order.sale_counter_id = :saleCounterId', { saleCounterId: session.sale_counter_id })
      .andWhere('order.shift_id = :shiftId', { shiftId: session.shift_id })
      .andWhere('LOWER(COALESCE(kot.status, :fallbackStatus)) IN (:...statuses)', {
        fallbackStatus: 'pending',
        statuses: this.closableCounterBlockedKotStatuses,
      })
      .orderBy('kot.updated_at', 'DESC')
      .addOrderBy('kot.created_at', 'DESC')
      .getRawOne<{ id?: string; kot_number?: string | null; kot_status?: string | null; order_id?: number; order_number?: string | null }>();

    if (!blockedKot) {
      return;
    }

    const kotLabel = blockedKot.kot_number?.trim() || blockedKot.id || 'Unknown KOT';
    const orderLabel = blockedKot.order_number?.trim() || (blockedKot.order_id ? `#${blockedKot.order_id}` : 'Unknown Order');
    const kotStatusLabel = String(blockedKot.kot_status || 'pending').replace(/_/g, ' ');
    throw new BadRequestException(
      `This sales counter cannot be closed while unfinished KOTs remain. Fully finish or clear every KOT first. Pending KOT: ${kotLabel} for order ${orderLabel} (${kotStatusLabel}).`,
    );
  }

  private normalizeOfflineOrderStatus(status?: string): 'held' | 'pending' | 'completed' {
    const normalized = String(status || 'pending').toLowerCase();
    if (normalized === 'held') return 'held';
    if (['completed', 'paid', 'closed', 'served', 'ready'].includes(normalized)) return 'completed';
    return 'pending';
  }

  private getCounterSessionWindow(session: Pick<AuthorizedTill, 'opening_verified_at' | 'activated_at' | 'created_at' | 'reconciled_at' | 'blind_submitted_at'>) {
    return {
      start: session.opening_verified_at || session.activated_at || session.created_at || new Date(),
      end: session.reconciled_at || session.blind_submitted_at || new Date(),
    };
  }

  private normalizeMatchToken(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private buildCounterSessionReportId(session: AuthorizedTill) {
    const closedAt = session.reconciled_at || session.blind_submitted_at || session.updated_at || session.created_at;
    return `XR-${session.id}-${closedAt.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }

  private computePayloadHash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
  }

  private toActorId(userId: number | string | undefined | null): number | null {
    if (typeof userId === 'number' && Number.isFinite(userId)) {
      return userId;
    }
    if (typeof userId === 'string' && userId.trim()) {
      const parsed = parseInt(userId, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private classifySyncError(error: any): {
    status: 'failed' | 'conflict';
    conflictReason: string | null;
    message: string;
  } {
    const message = error?.message || 'Offline sync failed';
    if (error instanceof NotFoundException) {
      return {
        status: 'conflict',
        conflictReason: 'server_reference_missing',
        message,
      };
    }
    if (error instanceof BadRequestException) {
      return {
        status: 'conflict',
        conflictReason: 'validation_rejected',
        message,
      };
    }
    return {
      status: 'failed',
      conflictReason: 'processing_error',
      message,
    };
  }

  private markEventConflict(
    eventRow: PosSyncEvent,
    reason: string,
    message: string,
  ) {
    eventRow.status = 'conflict';
    eventRow.conflict_reason = reason;
    eventRow.error_message = message;
    eventRow.resolution_status = 'open';
    eventRow.resolution_note = null;
    eventRow.resolved_at = null;
    eventRow.resolved_by_user_id = null;
  }

  private buildSyncResult(eventRow: PosSyncEvent, message?: string | null) {
    return {
      event_id: eventRow.device_event_id,
      status: eventRow.status as 'processed' | 'failed' | 'conflict',
      entity_type: eventRow.entity_type,
      entity_id: eventRow.entity_id ?? null,
      message: message ?? eventRow.error_message ?? null,
      conflict_reason: eventRow.conflict_reason ?? null,
      resolution_status: eventRow.resolution_status ?? null,
    };
  }

  private async findOrderByNumber(clientId: string, branchId: number, orderNumber: string): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, order_number: orderNumber },
      relations: ['items', 'items.product', 'table'],
    });
  }

  private async findShiftByReference(
    clientId: string,
    branchId: number,
    shiftReference?: string | null,
  ): Promise<Shift | null> {
    if (!shiftReference?.trim()) {
      return null;
    }

    return this.shiftRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        external_shift_id: shiftReference.trim(),
      },
    });
  }

  private async resolveTableIdFromNumber(clientId: string, branchId: number, tableNumber?: string): Promise<number | undefined> {
    if (!tableNumber) {
      return undefined;
    }

    const table = await this.tableRepo.findOne({
      where: { branch_id: branchId, table_number: tableNumber, branch: { client_id: clientId } as any },
    });
    return table?.id;
  }

  private async getLatestKotForOrder(clientId: string, branchId: number, orderId: number): Promise<KOT | null> {
    return this.findKotForOrder(clientId, branchId, orderId);
  }

  private async registerOrResolveDevice(
    clientId: string,
    branchId: number,
    dto: RegisterPosDeviceDto,
  ): Promise<PosDevice> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'register POS devices');

    let device = await this.posDeviceRepo.findOne({
      where: { client_id: clientId, device_uid: dto.device_uid },
    });

    const requestedDeviceCode = dto.device_code?.trim() || null;
    const isNewDevice = !device;
    const isChangingDeviceCode = Boolean(
      device
      && requestedDeviceCode
      && requestedDeviceCode !== (device.device_code?.trim() || null),
    );

    if ((isNewDevice || isChangingDeviceCode) && requestedDeviceCode) {
      const duplicateCode = await this.posDeviceRepo.findOne({
        where: {
          client_id: clientId,
          branch_id: branchId,
          device_code: requestedDeviceCode,
        },
      });
      if (duplicateCode && duplicateCode.device_uid !== dto.device_uid && duplicateCode.status !== 'blocked') {
        throw new BadRequestException('This device code is already assigned to another active POS device in the branch.');
      }
    }

    if (!device) {
      await this.entitlementsService.assertCanRegisterPosDevice(clientId, dto.device_uid);
      device = this.posDeviceRepo.create({
        client_id: clientId,
        branch_id: branchId,
        device_uid: dto.device_uid,
        device_code: requestedDeviceCode ?? null as any,
        device_name: dto.device_name ?? dto.device_uid,
        device_type: dto.device_type ?? 'pos_terminal',
        device_os: dto.device_os ?? null as any,
        app_version: dto.app_version ?? null as any,
        status: 'active',
        last_seen_at: new Date(),
      });
    } else {
      if (device.branch_id !== branchId) {
        throw new ForbiddenException('This device is not assigned to the active branch.');
      }
      device.device_code = requestedDeviceCode ?? device.device_code;
      device.device_name = dto.device_name ?? device.device_name;
      device.device_type = dto.device_type ?? device.device_type;
      device.device_os = dto.device_os ?? device.device_os;
      device.app_version = dto.app_version ?? device.app_version;
      device.last_seen_at = new Date();
    }

    if (device.status === 'blocked') {
      throw new ForbiddenException('This POS device is blocked.');
    }

    return this.posDeviceRepo.save(device);
  }

  private async updateDeviceSyncStatus(
    device: PosDevice,
    status: DeviceSyncState,
    message?: string | null,
  ): Promise<PosDevice> {
    device.last_seen_at = new Date();
    device.last_sync_at = new Date();
    device.last_sync_status = status;
    device.last_sync_message = message?.trim() || null;
    return this.posDeviceRepo.save(device);
  }

  private async applyOfflineShiftSnapshot(
    clientId: string,
    branchId: number,
    userId: number,
    device: PosDevice,
    payload: OfflineShiftSnapshotDto,
  ) {
    let shift = await this.findShiftByReference(clientId, branchId, payload.shift_reference);
    const existingOpenShift = await this.shiftRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        status: 'open',
      },
      order: { opened_at: 'DESC' },
    });

    if (!shift && existingOpenShift) {
      const canAttachToOpenShift =
        !existingOpenShift.external_shift_id
        || existingOpenShift.external_shift_id === payload.shift_reference;

      if (canAttachToOpenShift) {
        shift = existingOpenShift;
        shift.external_shift_id = payload.shift_reference;
        shift.source_device_id = device.id;
        shift.source_device_uid = device.device_uid;
        shift.sync_origin = 'offline';
        if (payload.opened_at) {
          shift.opened_at = this.parseOptionalDate(payload.opened_at) ?? shift.opened_at;
        }
        shift.opening_float = this.ensureNonNegativeMoney(
          payload.opening_float ?? shift.opening_float,
          'Opening float',
        );
        shift = await this.shiftRepo.save(shift);
      }
    }

    if (!shift) {
      shift = this.shiftRepo.create({
        client_id: clientId,
        branch_id: branchId,
        user_id: userId,
        external_shift_id: payload.shift_reference,
        source_device_id: device.id,
        source_device_uid: device.device_uid,
        sync_origin: 'offline',
        opening_float: this.ensureNonNegativeMoney(payload.opening_float, 'Opening float'),
        expected_cash: this.ensureNonNegativeMoney(payload.opening_float, 'Opening float'),
        status: 'open',
        opened_at: this.parseOptionalDate(payload.opened_at) ?? new Date(),
      });
      shift = await this.shiftRepo.save(shift);
    }

    if (payload.status === 'closed') {
      if (shift.status === 'closed') {
        return shift;
      }

      shift = await this.refreshShiftExpectedCash(shift);
      const openOrderCount = await this.orderRepo.count({
        where: {
          client_id: clientId,
          branch_id: branchId,
          shift_id: shift.id,
          order_status: In(['held', 'pending', 'preparing', 'ready', 'served']),
        },
      });
      if (openOrderCount > 0) {
        throw new BadRequestException(
          `Cannot close synced shift while ${openOrderCount} POS order(s) remain open for this shift.`,
        );
      }

      shift.actual_cash = this.ensureNonNegativeMoney(
        payload.actual_cash ?? shift.expected_cash,
        'Actual cash',
      );
      shift.variance = this.roundCurrency(
        Number(shift.actual_cash || 0) - Number(shift.expected_cash || 0),
      );
      shift.status = 'closed';
      shift.closed_at = this.parseOptionalDate(payload.closed_at) ?? new Date();
      shift.supervisor_id = payload.supervisor_id ?? null as any;
      shift = await this.shiftRepo.save(shift);
    }

    return shift;
  }

  private async applyOfflineBusinessDaySnapshot(
    clientId: string,
    branchId: number,
    userId: number,
    payload: OfflineBusinessDaySnapshotDto,
  ) {
    let businessDay = await this.businessDayRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        business_date: payload.business_date,
      },
    });

    if (!businessDay) {
      businessDay = await this.openBusinessDay(
        clientId,
        branchId,
        userId,
        {
          title: payload.title,
          business_date: payload.business_date,
          opened_at: payload.opened_at,
          notes: payload.notes,
        },
      );
    }

    if ((payload.status || 'open') === 'closed' && businessDay.status !== 'closed') {
      businessDay.status = 'closed';
      businessDay.closed_at = this.parseOptionalDate(payload.closed_at) ?? new Date();
      if (payload.notes?.trim()) {
        businessDay.notes = payload.notes.trim();
      }
      businessDay.closed_by_user_id = userId;
      businessDay = await this.businessDayRepo.save(businessDay);
    }

    return businessDay;
  }

  private async applyOfflineCounterSessionSnapshot(
    clientId: string,
    branchId: number,
    userId: number,
    device: PosDevice,
    payload: OfflineCounterSessionSnapshotDto,
  ) {
    const businessDay = await this.applyOfflineBusinessDaySnapshot(
      clientId,
      branchId,
      userId,
      {
        business_day_reference: payload.business_day_reference,
        business_date: payload.business_date,
        title: `Business Day ${payload.business_date}`,
        status: 'open',
        opened_at: payload.opened_at,
      },
    );

    const shift = await this.ensureOperationalShift(clientId, branchId, userId, businessDay);
    if (!shift) {
      throw new BadRequestException('Could not resolve an operating shift for the offline counter session.');
    }

    await this.assertSaleCounterBelongsToBranch(clientId, branchId, payload.sale_counter_id);

    let session = await this.authorizedTillRepo.findOne({
      where: {
        client_id: clientId,
        branch_id: branchId,
        external_session_id: payload.counter_session_reference,
      },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
    });

    const openedAt = this.parseOptionalDate(payload.opened_at) ?? new Date();
    const closedAt = this.parseOptionalDate(payload.closed_at);
    const normalizedStatus = String(payload.terminal_status || 'active').toLowerCase() as AuthorizedTill['terminal_status'];

    if (!session) {
      session = this.authorizedTillRepo.create({
        client_id: clientId,
        branch_id: branchId,
        shift_id: shift.id,
        sale_counter_id: payload.sale_counter_id,
        external_session_id: payload.counter_session_reference,
        source_device_id: device.id,
        source_device_uid: device.device_uid,
        sync_origin: 'offline',
        user_id: payload.cashier_user_id ?? userId,
        assigned_float: this.ensureNonNegativeMoney(payload.assigned_float, 'Assigned float'),
        opening_verified_cash: this.ensureNonNegativeMoney(payload.opening_verified_cash, 'Verified opening cash'),
        opening_verified_at: openedAt,
        opening_verified_by_user_id: payload.cashier_user_id ?? userId,
        activated_at: openedAt,
        terminal_status: normalizedStatus === 'closed' ? 'closed' : normalizedStatus === 'open' ? 'open' : 'active',
        blind_count: payload.blind_count ?? null,
        expected_cash: payload.expected_cash ?? null,
        variance: payload.variance ?? null,
        blind_submitted_at: normalizedStatus === 'closed' ? (closedAt ?? new Date()) : null,
        reconciled_at: normalizedStatus === 'closed' ? (closedAt ?? new Date()) : null,
        reconciled_by_user_id: normalizedStatus === 'closed' ? (payload.cashier_user_id ?? userId) : null,
        reconciliation_notes: payload.x_report_json ? 'Offline counter session synced with local X-report snapshot.' : null,
      });
    } else {
      session.shift_id = shift.id;
      session.sale_counter_id = payload.sale_counter_id;
      session.source_device_id = device.id;
      session.source_device_uid = device.device_uid;
      session.sync_origin = 'offline';
      session.user_id = payload.cashier_user_id ?? session.user_id ?? userId;
      session.assigned_float = this.ensureNonNegativeMoney(payload.assigned_float, 'Assigned float');
      session.opening_verified_cash = this.ensureNonNegativeMoney(payload.opening_verified_cash, 'Verified opening cash');
      session.opening_verified_at = session.opening_verified_at ?? openedAt;
      session.opening_verified_by_user_id = session.opening_verified_by_user_id ?? session.user_id ?? userId;
      session.activated_at = session.activated_at ?? openedAt;
      if (normalizedStatus === 'closed') {
        session.blind_count = payload.blind_count ?? session.blind_count ?? 0;
        session.expected_cash = payload.expected_cash ?? session.expected_cash ?? null;
        session.variance = payload.variance ?? session.variance ?? null;
        session.blind_submitted_at = closedAt ?? session.blind_submitted_at ?? new Date();
        session.reconciled_at = closedAt ?? session.reconciled_at ?? new Date();
        session.reconciled_by_user_id = session.reconciled_by_user_id ?? session.user_id ?? userId;
        session.terminal_status = 'closed';
        if (payload.x_report_json?.trim()) {
          session.reconciliation_notes = 'Offline counter session synced with local X-report snapshot.';
        }
      } else {
        session.terminal_status = normalizedStatus === 'open' ? 'open' : 'active';
      }
    }

    const saved = await this.authorizedTillRepo.save(session);
    await this.refreshShiftSessionTotals(shift);

    return this.authorizedTillRepo.findOne({
      where: { id: saved.id, client_id: clientId, branch_id: branchId },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
    });
  }

  private async applyOfflineOrderSnapshot(
    clientId: string,
    branchId: number,
    userId: number,
    device: PosDevice,
    payload: OfflineOrderSnapshotDto,
  ) {
    let order = await this.findOrderByNumber(clientId, branchId, payload.order_number);
    const targetShift = await this.findShiftByReference(
      clientId,
      branchId,
      payload.shift_reference,
    );

    if (!order) {
      order = await this.createOrder(clientId, branchId, userId, {
        order_number: payload.order_number,
        order_type: payload.order_type ?? 'dine_in',
        order_status: this.normalizeOfflineOrderStatus(payload.order_status),
        table_id: await this.resolveTableIdFromNumber(clientId, branchId, payload.table_number),
        customer_id: payload.customer_id,
        sub_total: payload.sub_total,
        tax_amount: payload.tax_amount ?? 0,
        discount_amount: payload.discount_amount ?? 0,
        total_amount: payload.total_amount,
        sale_counter_id: payload.sale_counter_id,
      });

      const createdOrder = await this.orderRepo.findOne({
        where: {
          client_id: clientId,
          branch_id: branchId,
          order_number: payload.order_number,
        },
      });
      if (createdOrder) {
        createdOrder.sync_origin = 'offline';
        createdOrder.source_device_id = device.id;
        createdOrder.source_device_uid = device.device_uid;
        createdOrder.offline_created_at = this.parseOptionalDate(payload.created_at);
        if (targetShift?.id) {
          createdOrder.shift_id = targetShift.id;
        }
        await this.orderRepo.save(createdOrder);
      }
    }

    const fullOrder = await this.findOrderByNumber(clientId, branchId, payload.order_number);
    if (!fullOrder) {
      throw new NotFoundException(`Offline order ${payload.order_number} could not be resolved.`);
    }

    if ((fullOrder.items ?? []).length === 0) {
      await this.addItemsToOrder(
        clientId,
        branchId,
        fullOrder.id,
        payload.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes,
        })),
      );
    }

    const normalizedStatus = this.normalizeOfflineOrderStatus(payload.order_status);
    const refreshed = await this.findOrderByNumber(clientId, branchId, payload.order_number);
    if (!refreshed) {
      throw new NotFoundException(`Offline order ${payload.order_number} could not be reloaded.`);
    }

    let mutableOrder = await this.orderRepo.findOne({
      where: { id: refreshed.id, client_id: clientId, branch_id: branchId },
    });
    if (mutableOrder) {
      mutableOrder.sync_origin = 'offline';
      mutableOrder.source_device_id = device.id;
      mutableOrder.source_device_uid = device.device_uid;
      mutableOrder.offline_created_at =
        this.parseOptionalDate(payload.created_at) ?? mutableOrder.offline_created_at;
      if (targetShift?.id) {
        mutableOrder.shift_id = targetShift.id;
      }
      if (payload.customer_id) {
        mutableOrder.customer_id = payload.customer_id;
      }
      if (payload.sale_counter_id) {
        mutableOrder.sale_counter_id = payload.sale_counter_id;
      }
      await this.orderRepo.save(mutableOrder);
    }

    if (normalizedStatus === 'held' && refreshed.order_status !== 'held') {
      await this.updateOrderStatus(clientId, branchId, refreshed.id, 'held');
    }

    if (
      (payload.close_on_sync || normalizedStatus === 'completed')
      && refreshed.order_status !== 'completed'
    ) {
      if (payload.is_credit_sale) {
        await this.creditSaleOrder(
          clientId,
          branchId,
          refreshed.id,
          {
            customer_id: payload.customer_id,
            payment_note: payload.payment_note,
          },
        );
      } else {
        await this.closeOrder(clientId, branchId, refreshed.id, {
          payment_mode: payload.payment_mode ?? payload.payments?.[0]?.payment_mode ?? 'cash',
          reference_number: payload.reference_number,
          payments: payload.payments,
          payment_note: payload.payment_note,
        });
      }
    }

    if (payload.receipt_number) {
      mutableOrder = await this.orderRepo.findOne({
        where: { id: refreshed.id, client_id: clientId, branch_id: branchId },
      });
      if (mutableOrder && !mutableOrder.receipt_number) {
        mutableOrder.receipt_number = payload.receipt_number;
        await this.orderRepo.save(mutableOrder);
      }
    }

    return this.findOrderByNumber(clientId, branchId, payload.order_number);
  }

  private async applyOfflineKotStatus(
    clientId: string,
    branchId: number,
    payload: OfflineKotStatusDto,
  ) {
    const order = await this.findOrderByNumber(clientId, branchId, payload.order_number);
    if (!order) {
      throw new NotFoundException(`Order ${payload.order_number} not found for KOT sync.`);
    }

    const kot = payload.kot_number
      ? await this.kotRepo.findOne({
          where: { client_id: clientId, branch_id: branchId, kot_number: payload.kot_number },
        })
      : await this.getLatestKotForOrder(clientId, branchId, order.id);

    if (!kot) {
      throw new NotFoundException(`KOT not found for order ${payload.order_number}.`);
    }

    const nextStatus = this.normalizeSyncStatus(payload.status);
    await this.updateKotStatus(clientId, branchId, kot.id, nextStatus);

    if (nextStatus === 'ready') {
      const items = await this.orderItemRepo.find({ where: { order_id: order.id } });
      for (const item of items) {
        if (item.item_status !== 'served') {
          item.item_status = 'ready';
          await this.orderItemRepo.save(item);
        }
      }
      order.order_status = 'ready';
      await this.orderRepo.save(order);
    }

    if (nextStatus === 'completed') {
      const items = await this.orderItemRepo.find({ where: { order_id: order.id } });
      for (const item of items) {
        item.item_status = 'served';
        await this.orderItemRepo.save(item);
      }
      if (order.order_status !== 'completed') {
        order.order_status = 'served';
        await this.orderRepo.save(order);
      }
    }

    return kot;
  }

  private resolvePaymentChargeRate(charge: BranchCharge, paymentMode: PosPaymentMode): number {
    const rateMap = charge.rate_map ?? {};
    const direct = rateMap[paymentMode];
    if (direct !== undefined && direct !== null) {
      return Number(direct) || 0;
    }

    if (paymentMode === 'bank' && rateMap.card !== undefined && rateMap.card !== null) {
      return Number(rateMap.card) || 0;
    }

    if (paymentMode === 'card' && rateMap.bank !== undefined && rateMap.bank !== null) {
      return Number(rateMap.bank) || 0;
    }

    return Number(rateMap.default || 0);
  }

  private isServiceCharge(charge: BranchCharge): boolean {
    return !charge.is_tax && String(charge.name || '').toLowerCase().includes('service');
  }

  private async getActiveBranchCharges(clientId: string, branchId: number): Promise<BranchCharge[]> {
    return this.branchChargeRepo.find({
      where: { branch_id: branchId, client_id: clientId, is_active: true },
      order: { priority: 'ASC', id: 'ASC' },
    });
  }

  private async resolvePricingCharges(
    clientId: string,
    branchId: number,
    orderType: PosOrderType,
    taxCode?: string | null,
    explicitTaxAmount?: number | null,
  ): Promise<BranchCharge[]> {
    const charges = await this.getActiveBranchCharges(clientId, branchId);
    const nonTaxCharges = charges.filter((charge) => !charge.is_tax);
    if (explicitTaxAmount !== undefined && explicitTaxAmount !== null) {
      const normalizedExplicitTaxAmount = this.ensureNonNegativeMoney(explicitTaxAmount, 'Tax amount');
      if (normalizedExplicitTaxAmount <= 0) {
        return nonTaxCharges;
      }

      const syntheticTaxCharge = this.branchChargeRepo.create({
        client_id: clientId,
        branch_id: branchId,
        name: String(taxCode || 'Tax/VAT').trim() || 'Tax/VAT',
        type: 'fixed',
        is_tax: true,
        condition_trigger: 'none',
        rate_map: { default: normalizedExplicitTaxAmount },
        priority: -1,
        is_active: true,
      });

      return [...nonTaxCharges, syntheticTaxCharge];
    }

    const normalizedTaxCode = String(taxCode || '').trim();
    if (!normalizedTaxCode) {
      return charges;
    }

    const taxProfile = await this.taxConfigurationRepo.findOne({
      where: { client_id: clientId, tax_code: normalizedTaxCode, is_active: true },
    });
    if (!taxProfile) {
      throw new BadRequestException(`Tax profile ${normalizedTaxCode} was not found or is inactive.`);
    }

    const appliesToOrderType = orderType === 'dine_in'
      ? taxProfile.applies_to_dine_in
      : orderType === 'takeout'
        ? taxProfile.applies_to_takeout
        : taxProfile.applies_to_delivery;
    if (!appliesToOrderType) {
      throw new BadRequestException(`Tax profile ${normalizedTaxCode} does not apply to ${orderType.replace('_', ' ')} orders.`);
    }

    const syntheticTaxCharge = this.branchChargeRepo.create({
      client_id: clientId,
      branch_id: branchId,
      name: taxProfile.tax_name || taxProfile.tax_code,
      type: taxProfile.calculation_method,
      is_tax: true,
      condition_trigger: 'none',
      rate_map: { default: Number(taxProfile.tax_rate || 0) },
      priority: -1,
      is_active: true,
    });

    return [...nonTaxCharges, syntheticTaxCharge];
  }

  private calculateOrderTotals(
    charges: BranchCharge[],
    context: OrderPricingContext,
  ) {
    const subTotal = this.roundCurrency(
      context.items.reduce(
        (sum, item) => sum + (Number(item.quantity) * Number(item.item_price)),
        0,
      ),
    );

    const manualDiscountAmount = this.ensureNonNegativeMoney(
      context.manualDiscountAmount ?? 0,
      'Discount amount',
    );
    const voucherDiscountAmount = this.ensureNonNegativeMoney(
      context.voucherDiscountAmount ?? 0,
      'Voucher discount',
    );
    const grossDiscountAmount = this.roundCurrency(manualDiscountAmount + voucherDiscountAmount);
    const discountAmount = Math.min(subTotal, grossDiscountAmount);
    const netAmountBeforeCharges = this.roundCurrency(Math.max(subTotal - discountAmount, 0));
    const serviceChargeOverrideAmount = context.serviceChargeAmount === undefined
      ? null
      : this.ensureNonNegativeMoney(context.serviceChargeAmount, 'Service charge amount');

    let taxAmount = 0;
    let otherChargesAmount = 0;
    const chargeLines: Array<{
      charge_name: string;
      amount: number;
      applied_rate: string | null;
      is_tax: boolean;
    }> = [];

    for (const charge of charges) {
      if (context.skipTax && charge.is_tax) {
        continue;
      }

      if (serviceChargeOverrideAmount !== null && this.isServiceCharge(charge)) {
        continue;
      }

      let chargeAmount = 0;
      let appliedRate: string | null = null;

      if (charge.condition_trigger === 'none') {
        const rate = Number(charge.rate_map?.default || 0);
        chargeAmount = charge.type === 'percentage'
          ? this.roundCurrency((netAmountBeforeCharges * rate) / 100)
          : this.roundCurrency(rate);
        appliedRate = `${rate}${charge.type === 'percentage' ? '%' : ''}`;
      } else if (charge.condition_trigger === 'order_type') {
        const rate = Number(
          charge.rate_map?.[context.orderType] ?? charge.rate_map?.default ?? 0,
        );
        chargeAmount = charge.type === 'percentage'
          ? this.roundCurrency((netAmountBeforeCharges * rate) / 100)
          : this.roundCurrency(rate);
        appliedRate = `${rate}${charge.type === 'percentage' ? '%' : ''} (${context.orderType})`;
      } else if (charge.condition_trigger === 'payment_method' && (context.payments?.length ?? 0) > 0) {
        const payments = context.payments ?? [];

        if (charge.type === 'percentage') {
          const rateDetails: string[] = [];
          chargeAmount = this.roundCurrency(
            payments.reduce((sum, payment) => {
              const paymentMode = this.normalizePaymentMode(payment.payment_mode);
              const rate = this.resolvePaymentChargeRate(charge, paymentMode);
              if (rate > 0) {
                rateDetails.push(`${paymentMode}:${rate}%`);
              }
              return sum + ((Number(payment.amount) * rate) / 100);
            }, 0),
          );
          appliedRate = rateDetails.length > 0 ? rateDetails.join(', ') : null;
        } else {
          const rates = payments
            .map((payment) => this.resolvePaymentChargeRate(charge, this.normalizePaymentMode(payment.payment_mode)))
            .filter((rate) => rate > 0);

          if (rates.length > 0) {
            const resolvedRate = Math.max(...rates);
            chargeAmount = this.roundCurrency(resolvedRate);
            appliedRate = `${resolvedRate}`;
          }
        }
      }

      if (chargeAmount <= 0) {
        continue;
      }

      chargeLines.push({
        charge_name: charge.name,
        amount: chargeAmount,
        applied_rate: appliedRate,
        is_tax: !!charge.is_tax,
      });

      if (charge.is_tax) {
        taxAmount += chargeAmount;
      } else {
        otherChargesAmount += chargeAmount;
      }
    }

    if (serviceChargeOverrideAmount !== null && serviceChargeOverrideAmount > 0) {
      chargeLines.push({
        charge_name: 'Service Charge',
        amount: serviceChargeOverrideAmount,
        applied_rate: 'manual',
        is_tax: false,
      });
      otherChargesAmount += serviceChargeOverrideAmount;
    }

    const totalAmount = this.roundCurrency(
      netAmountBeforeCharges + taxAmount + otherChargesAmount,
    );

    return {
      subTotal,
      discountAmount,
      taxAmount: this.roundCurrency(taxAmount),
      otherChargesAmount: this.roundCurrency(otherChargesAmount),
      totalAmount,
      chargeLines,
    };
  }

  private async syncOrderTotals(order: Order): Promise<Order> {
    const charges = await this.getActiveBranchCharges(order.client_id, order.branch_id);
    const pricing = this.calculateOrderTotals(charges, {
      orderType: this.normalizeOrderType(order.order_type),
      items: (order.items ?? []).filter((item) => item.item_status !== 'voided'),
      manualDiscountAmount: Number(order.discount_amount || 0),
    });

    order.sub_total = pricing.subTotal;
    order.tax_amount = pricing.taxAmount;
    order.total_amount = pricing.totalAmount;
    order.discount_amount = pricing.discountAmount;

    return this.orderRepo.save(order);
  }

  private parseKotItemsJson(itemsJson?: string | null): any[] {
    try {
      const parsed = JSON.parse(itemsJson || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private buildKotItemPayload(
    entry: OrderItem,
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    const nowIso = new Date().toISOString();
    const basePayload = {
      order_item_id: entry.id,
      product_id: entry.product_id,
      product_name: entry.product_name ?? entry.product?.product_name ?? `Product #${entry.product_id}`,
      category:
        entry.product?.production_station?.name
        ?? entry.product?.category?.category_name
        ?? 'Kitchen',
      quantity: Number(entry.quantity),
      submitted_quantity: Number(entry.quantity),
      notes: entry.item_notes ?? null,
      instructions: entry.item_notes ?? null,
      modifiers: entry.item_notes ? [entry.item_notes] : [],
      item_status: entry.item_status,
      old_quantity: null,
      is_updated: false,
      is_new: false,
      is_addition_delta: false,
      is_cancelled: ['cancelled', 'voided'].includes(String(entry.item_status || '').toLowerCase()),
      changed_at: nowIso,
      timer_reset_at: nowIso,
    };
    return {
      ...basePayload,
      ...(overrides ?? {}),
    };
  }

  private deriveKotStatusFromEntries(entries: any[], fallbackStatus: string = 'pending'): string {
    if (entries.length === 0) {
      return String(fallbackStatus || 'pending').toLowerCase();
    }

    if (entries.every((entry) => ['voided', 'cancelled', 'served'].includes(String(entry?.item_status || '').toLowerCase()))) {
      return entries.some((entry) => ['served'].includes(String(entry?.item_status || '').toLowerCase()))
        ? 'completed'
        : 'cancelled';
    }
    if (entries.every((entry) => ['voided', 'cancelled', 'ready', 'served'].includes(String(entry?.item_status || '').toLowerCase()))) {
      return 'ready';
    }
    if (entries.some((entry) => ['cooking', 'preparing'].includes(String(entry?.item_status || '').toLowerCase()))) {
      return 'preparing';
    }
    return 'pending';
  }

  private getOperationalSettingNumber(
    branch: Branch | null | undefined,
    keys: string[],
    fallback: number,
  ): number {
    const sources = [
      branch?.operational_settings as Record<string, unknown> | null | undefined,
      branch as Record<string, unknown> | null | undefined,
    ];

    for (const source of sources) {
      if (!source) continue;
      for (const key of keys) {
        const numeric = Number(source[key]);
        if (source[key] !== undefined && source[key] !== null && source[key] !== '' && Number.isFinite(numeric)) {
          return Math.max(Math.round(numeric), 0);
        }
      }
    }

    return fallback;
  }

  private isTerminalKdsOrderStatus(status?: string | null): boolean {
    return ['ready', 'served', 'completed', 'delivered'].includes(String(status || '').toLowerCase());
  }

  private getItemEditLockMinutes(branch: Branch | null | undefined): number {
    return this.getOperationalSettingNumber(
      branch,
      ['item_edit_lock_minutes', 'kds_item_edit_lock_minutes', 'pos_item_edit_lock_minutes'],
      5,
    );
  }

  private getItemCancellationWindowMinutes(branch: Branch | null | undefined): number {
    return this.getOperationalSettingNumber(
      branch,
      ['item_cancellation_window_minutes', 'pos_item_cancellation_window_minutes', 'cancellation_window_minutes'],
      5,
    );
  }

  private getOrderCancellationWindowMinutes(branch: Branch | null | undefined): number {
    return this.getOperationalSettingNumber(
      branch,
      ['order_cancellation_window_minutes', 'pos_order_cancellation_window_minutes'],
      5,
    );
  }

  private getLineItemCancelReduceLimitMinutes(branch: Branch | null | undefined): number {
    return this.getOperationalSettingNumber(
      branch,
      [
        'line_item_cancel_reduce_limit_minutes',
        'item_cancellation_window_minutes',
        'item_edit_lock_minutes',
        'pos_item_cancellation_window_minutes',
        'cancellation_window_minutes',
      ],
      5,
    );
  }

  private isOutsideTimedWindow(anchor: Date | null | undefined, minutes: number): boolean {
    if (!(anchor instanceof Date) || Number.isNaN(anchor.getTime()) || minutes <= 0) {
      return minutes <= 0 ? true : false;
    }
    return (Date.now() - anchor.getTime()) > minutes * 60 * 1000;
  }

  private isLinePastCancelReduceWindow(orderItem: OrderItem, branch: Branch): boolean {
    return this.isOutsideTimedWindow(orderItem.created_at, this.getLineItemCancelReduceLimitMinutes(branch));
  }

  private isItemPastQuantityIncreaseWindow(orderItem: OrderItem, branch: Branch): boolean {
    const lockMinutes = this.getItemEditLockMinutes(branch);
    return this.isOutsideTimedWindow(orderItem.created_at, lockMinutes);
  }

  private async canAllowOpenOrderReturnForItem(
    clientId: string,
    branchId: number,
    orderItem: OrderItem,
  ): Promise<boolean> {
    const mapping = await this.mappingRepo.findOne({
      where: {
        branch_id: branchId,
        product_id: orderItem.product_id,
        price_profile_id: IsNull(),
      },
    });
    if (mapping && mapping.allow_open_order_return !== null && mapping.allow_open_order_return !== undefined) {
      return Boolean(mapping.allow_open_order_return);
    }
    return Boolean(orderItem.product?.allow_open_order_return);
  }

  private async appendOrderAuditNote(order: Order, note: string): Promise<void> {
    order.order_note = [order.order_note?.trim(), note.trim()].filter(Boolean).join('\n\n');
    await this.orderRepo.save(order);
  }

  private async assertLateLineAdjustmentAllowed(
    clientId: string,
    branchId: number,
    branch: Branch,
    order: Order,
    orderItem: OrderItem,
    nextQuantity: number,
    dto?: {
      approval_username?: string;
      approval_pin?: string;
      adjustment_reason?: string;
    },
  ): Promise<{ mode: 'standard' | 'open_return' | 'override'; approver?: UserManagement | null }> {
    if (order.order_status === 'held' || !this.isLinePastCancelReduceWindow(orderItem, branch)) {
      return { mode: 'standard', approver: null };
    }

    const timeoutMinutes = this.getLineItemCancelReduceLimitMinutes(branch);
    const canOpenReturn = nextQuantity < Number(orderItem.quantity || 0)
      && await this.canAllowOpenOrderReturnForItem(clientId, branchId, orderItem);
    if (canOpenReturn) {
      return { mode: 'open_return', approver: null };
    }

    if (!dto?.adjustment_reason?.trim()) {
      throw new BadRequestException(
        `Authorized user approval is required to void or reduce this line after ${timeoutMinutes} minutes. Provide a reason.`,
      );
    }

    const approver = await this.requireAuthorizedPinOverride(
      clientId,
      branchId,
      dto?.approval_username || '',
      dto?.approval_pin || '',
      'approve a late line-item void or quantity reduction',
    );

    return { mode: 'override', approver };
  }

  private async findKotForOrder(clientId: string, branchId: number, orderId: number): Promise<KOT | null> {
    return this.kotRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, order_id: String(orderId) },
      order: { created_at: 'DESC', id: 'DESC' },
    });
  }

  private async updateKotDraftForOrder(
    order: Order,
    mutateEntries: (entries: any[]) => any[],
  ): Promise<KOT | null> {
    if (order.order_status === 'held' || Number(order.kot_version || 0) <= 0) {
      return null;
    }

    const baseNumber = await this.ensureOrderKotBaseNumber(order);
    const kot = await this.findKotForOrder(order.client_id, order.branch_id, order.id)
      ?? this.kotRepo.create({
        id: randomUUID(),
        client_id: order.client_id,
        branch_id: order.branch_id,
        kot_number: await this.buildKotNumber(
          order.client_id,
          order.branch_id,
          baseNumber,
          Number(order.kot_version || 0),
          order.sale_counter?.code ?? String(order.sale_counter_id || ''),
        ),
        order_id: String(order.id),
        type: order.order_type,
        status: 'pending',
        items_json: '[]',
      });

    const nextEntries = mutateEntries(this.parseKotItemsJson(kot.items_json))
      .filter((entry) => entry && entry.order_item_id !== undefined)
      .map((entry) => ({
        ...entry,
        item_status: String(entry.item_status || 'pending').toLowerCase(),
      }));

    kot.kot_number = await this.buildKotNumber(
      order.client_id,
      order.branch_id,
      baseNumber,
      Number(order.kot_version || 0),
      order.sale_counter?.code ?? String(order.sale_counter_id || ''),
    );
    kot.type = order.order_type;
    kot.items_json = JSON.stringify(nextEntries);
    kot.status = this.deriveKotStatusFromEntries(nextEntries, String(kot.status || 'pending'));
    return this.kotRepo.save(kot);
  }

  private async syncKotDraftFromOrder(order: Order): Promise<void> {
    if (order.order_status === 'held' || Number(order.kot_version || 0) <= 0) {
      return;
    }

    await this.updateKotDraftForOrder(order, (existingEntries) => {
      const existingByItemId = new Map(
        existingEntries.map((entry) => [Number(entry.order_item_id), entry]),
      );
      const itemStatusById = new Map(
        (order.items ?? []).map((item) => [Number(item.id), String(item.item_status || 'pending').toLowerCase()]),
      );
      const changedAt = new Date().toISOString();

      const nextEntries = (order.items ?? []).map((item) => {
        const existing = existingByItemId.get(item.id);
        const previousQuantity = existing ? Number(existing?.submitted_quantity ?? existing?.quantity ?? 0) : null;
        const quantityChanged = previousQuantity !== null && previousQuantity !== Number(item.quantity || 0);
        const previousNotes = String(existing?.notes ?? existing?.item_notes ?? existing?.instructions ?? '').trim();
        const currentNotes = String(item.item_notes ?? '').trim();
        const notesChanged = previousNotes !== currentNotes;
        const previousStatus = String(existing?.item_status || '').toLowerCase();
        const currentStatus = String(item.item_status || '').toLowerCase();
        const statusChanged = previousStatus !== '' && previousStatus !== currentStatus;
        const isNew = !existing || Boolean(existing?.is_cancelled);
        const isUpdated = !isNew && (quantityChanged || notesChanged || statusChanged);
        const shouldRefreshChangeMarker = isNew || isUpdated;
        const shouldResetTimer = isNew || (quantityChanged && Number(item.quantity || 0) > Number(previousQuantity || 0));
        return this.buildKotItemPayload(item, {
          submitted_quantity: Number(item.quantity || 0),
          old_quantity: quantityChanged ? previousQuantity : null,
          is_updated: isUpdated,
          is_new: isNew,
          is_cancelled: item.item_status === 'voided' || Boolean(existing?.is_cancelled),
          changed_at:
            shouldRefreshChangeMarker
              ? changedAt
              : existing?.changed_at ?? changedAt,
          timer_reset_at:
            shouldResetTimer
              ? changedAt
              : existing?.timer_reset_at
                ?? existing?.split_at
                ?? existing?.changed_at
                ?? item.created_at?.toISOString?.()
                ?? changedAt,
          cancelled_at: existing?.cancelled_at ?? null,
        });
      });

      const syntheticEntries = existingEntries
        .filter((entry) => entry?.source_order_item_id)
        .map((entry) => ({
          ...entry,
          item_status: itemStatusById.get(Number(entry.source_order_item_id))
            ?? String(entry?.item_status || 'pending').toLowerCase(),
        }));

      return [...nextEntries, ...syntheticEntries];
    });
  }

  private buildSubmittedKotEntries(order: Order, previousEntries: any[]): any[] {
    const changedAt = new Date().toISOString();
    const quantityMergeWindowMs = 2 * 60 * 1000;
    const isTerminalDeltaOrder = this.isTerminalKdsOrderStatus(order.order_status);
    const previousByItemId = new Map(
      previousEntries.map((entry) => [Number(entry?.order_item_id ?? 0), entry]),
    );
    const nextByItemId = new Map<string, any>();

    const resolveEntryTimerStart = (entry: any, fallback?: Date | null): number => {
      const candidates = [
        entry?.timer_reset_at,
        entry?.split_at,
        entry?.changed_at,
        entry?.created_at,
        fallback?.toISOString?.(),
      ];
      for (const candidate of candidates) {
        const timestamp = candidate ? new Date(candidate).getTime() : Number.NaN;
        if (Number.isFinite(timestamp)) {
          return timestamp;
        }
      }
      return Date.now();
    };

    for (const item of order.items ?? []) {
      const itemId = Number(item.id);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        continue;
      }

      const previousEntry = previousByItemId.get(itemId);
      const isVoided = String(item.item_status || '').toLowerCase() === 'voided';
      const currentQuantity = Number(item.quantity || 0);
      const previousQuantity = previousEntry
        ? Number(previousEntry?.submitted_quantity ?? previousEntry?.quantity ?? 0)
        : null;
      const previousNotes = String(previousEntry?.notes ?? previousEntry?.item_notes ?? previousEntry?.instructions ?? '').trim();
      const currentNotes = String(item.item_notes ?? '').trim();

      if (isVoided) {
        if (previousEntry && !Boolean(previousEntry?.is_cancelled)) {
          nextByItemId.set(String(itemId), {
            ...previousEntry,
            quantity: 0,
            item_status: 'voided',
            old_quantity: previousEntry?.old_quantity ?? previousQuantity ?? Number(item.quantity || 0),
            is_updated: true,
            is_new: false,
            is_cancelled: true,
            changed_at: changedAt,
            timer_reset_at:
              previousEntry?.timer_reset_at
              ?? previousEntry?.split_at
              ?? previousEntry?.changed_at
              ?? changedAt,
            cancelled_at: changedAt,
          });
        } else if (previousEntry) {
          nextByItemId.set(String(itemId), {
            ...previousEntry,
            item_status: String(previousEntry?.item_status || 'voided').toLowerCase(),
          });
        }
        continue;
      }

      const quantityChanged = previousEntry
        ? previousQuantity !== currentQuantity
        : false;
      const notesChanged = previousEntry
        ? previousNotes !== currentNotes
        : false;
      const wasCancelled = Boolean(previousEntry?.is_cancelled);
      if (previousEntry && isTerminalDeltaOrder && !wasCancelled) {
        if (quantityChanged && currentQuantity > Number(previousQuantity || 0)) {
          const additionalQuantity = currentQuantity - Number(previousQuantity || 0);
          nextByItemId.set(
            String(itemId),
            this.buildKotItemPayload(item, {
              quantity: additionalQuantity,
              submitted_quantity: currentQuantity,
              old_quantity: 0,
              is_updated: true,
              is_new: false,
              is_addition_delta: true,
              is_cancelled: false,
              changed_at: changedAt,
              timer_reset_at: changedAt,
              cancelled_at: null,
            }),
          );
          continue;
        }
        nextByItemId.set(String(itemId), {
          ...previousEntry,
          item_status: String(previousEntry?.item_status || item.item_status || 'pending').toLowerCase(),
        });
        continue;
      }
      const isNew = !previousEntry || wasCancelled;
      const isUpdated = !isNew && (quantityChanged || notesChanged);
      const isQuantityIncrease = quantityChanged && currentQuantity > Number(previousQuantity || 0);
      const isLateAdditionDelta = !isNew
        && isQuantityIncrease
        && (new Date(changedAt).getTime() - resolveEntryTimerStart(previousEntry, item.created_at)) > quantityMergeWindowMs;
      const shouldRefreshChangeMarker = isNew || isUpdated;
      const shouldResetTimer = isNew || isQuantityIncrease;

      if (previousEntry && !isNew && !isUpdated) {
        nextByItemId.set(String(itemId), {
          ...previousEntry,
          submitted_quantity: currentQuantity,
          item_status: String(item.item_status || previousEntry?.item_status || 'pending').toLowerCase(),
        });
        continue;
      }

      if (isLateAdditionDelta && previousEntry) {
        nextByItemId.set(String(itemId), {
          ...previousEntry,
          is_late_addition_base: true,
          submitted_quantity: currentQuantity,
          item_status: String(item.item_status || previousEntry?.item_status || 'pending').toLowerCase(),
        });
        nextByItemId.set(
          `${itemId}:addition:${new Date(changedAt).getTime()}`,
          this.buildKotItemPayload(item, {
            order_item_id: `${itemId}:addition:${new Date(changedAt).getTime()}`,
            source_order_item_id: itemId,
            kds_line_id: `${itemId}:addition:${new Date(changedAt).getTime()}`,
            quantity: currentQuantity - Number(previousQuantity || 0),
            submitted_quantity: currentQuantity,
            old_quantity: 0,
            is_updated: true,
            is_new: false,
            is_addition_delta: true,
            is_cancelled: false,
            changed_at: changedAt,
            timer_reset_at: changedAt,
            cancelled_at: null,
          }),
        );
        continue;
      }

      nextByItemId.set(
        String(itemId),
        this.buildKotItemPayload(item, {
          quantity: currentQuantity,
          submitted_quantity: currentQuantity,
          old_quantity: quantityChanged ? previousQuantity : null,
          is_updated: isUpdated,
          is_new: isNew,
          is_cancelled: false,
          changed_at:
            shouldRefreshChangeMarker
              ? changedAt
              : previousEntry?.changed_at
                ?? item.updated_at?.toISOString?.()
                ?? changedAt,
          timer_reset_at:
            shouldResetTimer
              ? changedAt
              : previousEntry?.timer_reset_at
                ?? previousEntry?.split_at
                ?? previousEntry?.changed_at
                ?? item.created_at?.toISOString?.()
                ?? changedAt,
          cancelled_at: null,
        }),
      );
    }

    for (const previousEntry of previousEntries) {
      const itemId = Number(previousEntry?.order_item_id ?? 0);
      const entryKey = String(previousEntry?.order_item_id ?? previousEntry?.id ?? '');
      if (previousEntry?.source_order_item_id && entryKey && !nextByItemId.has(entryKey)) {
        nextByItemId.set(entryKey, previousEntry);
        continue;
      }

      if (!Number.isFinite(itemId) || itemId <= 0 || nextByItemId.has(String(itemId))) {
        continue;
      }

      if (Boolean(previousEntry?.is_cancelled)) {
        nextByItemId.set(String(itemId), {
          ...previousEntry,
          item_status: String(previousEntry?.item_status || 'voided').toLowerCase(),
        });
        continue;
      }

      nextByItemId.set(String(itemId), {
        ...previousEntry,
        quantity: 0,
        item_status: 'voided',
        old_quantity: previousEntry?.old_quantity ?? Number(previousEntry?.quantity ?? 0),
        is_updated: true,
        is_new: false,
        is_cancelled: true,
        changed_at: changedAt,
        timer_reset_at:
          previousEntry?.timer_reset_at
          ?? previousEntry?.split_at
          ?? previousEntry?.changed_at
          ?? changedAt,
        cancelled_at: changedAt,
      });
    }

    return Array.from(nextByItemId.values())
      .map((entry) => ({
        ...entry,
        item_status: String(entry?.item_status || 'pending').toLowerCase(),
      }))
      .sort((left, right) => Number(left?.order_item_id ?? 0) - Number(right?.order_item_id ?? 0));
  }

  private async submitKotForOrder(order: Order): Promise<KOT | null> {
    if (order.order_status === 'held') {
      return null;
    }

    const activeItems = (order.items ?? []).filter((item) => item.item_status !== 'voided');
    if (activeItems.length === 0) {
      return null;
    }

    const baseNumber = await this.ensureOrderKotBaseNumber(order);
    const existingKot = await this.findKotForOrder(order.client_id, order.branch_id, order.id);
    const existingEntries = existingKot
      ? this.parseKotItemsJson(existingKot.items_json)
      : [];

    const nextEntries = this.buildSubmittedKotEntries(order, existingEntries);

    const nextHash = this.buildKotSubmissionHash(nextEntries);
    if (order.last_kot_submission_hash === nextHash && Number(order.kot_version || 0) > 0) {
      return existingKot;
    }

    const savedKot = await this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager.getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: order.id })
        .andWhere('order.client_id = :clientId', { clientId: order.client_id })
        .andWhere('order.branch_id = :branchId', { branchId: order.branch_id })
        .getOne();

      if (!lockedOrder) {
        throw new NotFoundException('Order not found.');
      }

      const businessDate = await this.resolveKotBusinessDate(lockedOrder, manager);
      const effectiveBaseNumber = Number(lockedOrder.kot_base_number || 0) > 0
        ? Number(lockedOrder.kot_base_number)
        : await this.reserveNextKotBaseNumber(
          manager,
          lockedOrder.client_id,
          lockedOrder.branch_id,
          businessDate,
        );

      const currentVersion = Number(lockedOrder.kot_version || 0);
      if (lockedOrder.last_kot_submission_hash === nextHash && currentVersion > 0) {
        const existing = await manager.getRepository(KOT).findOne({
          where: { client_id: order.client_id, branch_id: order.branch_id, order_id: String(order.id) },
          order: { created_at: 'DESC', id: 'DESC' },
        });
        return existing ?? null;
      }

      lockedOrder.kot_base_number = effectiveBaseNumber;
      lockedOrder.kot_version = currentVersion + 1;
      lockedOrder.last_kot_submission_hash = nextHash;
      await manager.getRepository(Order).save(lockedOrder);

      const kotRepository = manager.getRepository(KOT);
      const mutableKot = kotRepository.create({
        id: randomUUID(),
        client_id: order.client_id,
        branch_id: order.branch_id,
        order_id: String(order.id),
      });

      mutableKot.kot_number = await this.buildKotNumber(
        lockedOrder.client_id,
        lockedOrder.branch_id,
        effectiveBaseNumber,
        lockedOrder.kot_version,
        order.sale_counter?.code ?? String(order.sale_counter_id || ''),
        businessDate,
      );
      mutableKot.type = order.order_type;
      mutableKot.items_json = JSON.stringify(nextEntries);
      mutableKot.status = this.deriveKotStatusFromEntries(nextEntries, String(mutableKot.status || 'pending'));
      return kotRepository.save(mutableKot);
    });

    if (savedKot) {
      const persistedOrder = await this.orderRepo.findOne({
        where: { id: order.id, client_id: order.client_id, branch_id: order.branch_id },
        select: ['id', 'kot_base_number', 'kot_version', 'last_kot_submission_hash'],
      });

      if (persistedOrder) {
        order.kot_base_number = persistedOrder.kot_base_number;
        order.kot_version = Number(persistedOrder.kot_version || 0);
        order.last_kot_submission_hash = persistedOrder.last_kot_submission_hash;
      }
    }

    return savedKot;
  }

  private async requireAuthorizedPinOverride(
    clientId: string,
    branchId: number,
    username: string,
    pin: string,
    actionLabel: string,
  ): Promise<UserManagement> {
    const normalizedUsername = username.trim();
    const normalizedPin = pin.trim();
    if (!normalizedUsername || !normalizedPin) {
      throw new BadRequestException(`Authorized username and PIN are required to ${actionLabel}.`);
    }

    const user = await this.userRepo.findOne({
      where: { client_id: clientId, user_name: normalizedUsername },
      relations: ['roleEntity', 'branchRoles', 'branchRoles.roleEntity'],
    });

    if (!user || user.status !== 'active' || user.is_locked) {
      throw new ForbiddenException('Authorized user is not available for approval.');
    }
    if (String(user.pos_approval_pin || '').trim() !== normalizedPin) {
      throw new ForbiddenException('Invalid approval PIN.');
    }

    const branchAssignment = (user.branchRoles ?? []).find((assignment) => Number(assignment.branch_id) === Number(branchId));
    const branchAuthority = String(
      branchAssignment?.approval_authority
      ?? branchAssignment?.roleEntity?.approval_authority
      ?? user.roleEntity?.approval_authority
      ?? '',
    ).toLowerCase();
    const isAuthorized = user.user_type === 'CLIENT_ADMIN'
      || ['branch', 'both', 'central'].includes(branchAuthority);

    if (!isAuthorized) {
      throw new ForbiddenException(`This user is not authorized to ${actionLabel} for the selected branch.`);
    }

    return user;
  }

  private async requireAuthorizedCounterCloseUser(
    clientId: string,
    branchId: number,
    cashierId: number,
    username: string,
    pin: string,
  ): Promise<UserManagement> {
    const normalizedUsername = username.trim();
    const normalizedPin = pin.trim();
    if (!normalizedUsername || !normalizedPin) {
      throw new ForbiddenException('Authorized user ID and PIN are required to close this sales counter.');
    }

    const token = this.normalizeMatchToken(normalizedUsername);
    const authorizedUser = await this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.roleEntity', 'roleEntity')
      .leftJoinAndSelect('user.branchRoles', 'branchRoles')
      .leftJoinAndSelect('branchRoles.roleEntity', 'branchRoleEntity')
      .where('user.client_id = :clientId', { clientId })
      .andWhere('user.status = :status', { status: 'active' })
      .andWhere('user.is_active = :isActive', { isActive: true })
      .andWhere('(LOWER(user.user_name) = :token OR LOWER(user.full_name) = :token OR LOWER(user.employee_id) = :token)', { token })
      .getOne();

    if (!authorizedUser || authorizedUser.status !== 'active' || !authorizedUser.is_active || authorizedUser.is_locked) {
      throw new ForbiddenException('Authorized user was not found or is not active.');
    }
    if (authorizedUser.id === cashierId) {
      throw new ForbiddenException('Authorized user must be different from the assigned cashier.');
    }
    if (!authorizedUser.management_pin?.trim()) {
      throw new ForbiddenException('Authorized user was not found or close PIN is not configured.');
    }
    if (authorizedUser.management_pin.trim() !== normalizedPin) {
      throw new ForbiddenException('Counter close PIN verification failed.');
    }

    const branchAssignment = (authorizedUser.branchRoles ?? []).find((assignment) => Number(assignment.branch_id) === Number(branchId));
    const branchAuthority = String(
      branchAssignment?.approval_authority
      ?? branchAssignment?.roleEntity?.approval_authority
      ?? authorizedUser.roleEntity?.approval_authority
      ?? '',
    ).toLowerCase();
    const isAuthorized = authorizedUser.user_type === 'CLIENT_ADMIN'
      || ['branch', 'both', 'central'].includes(branchAuthority);

    if (!isAuthorized) {
      throw new ForbiddenException('This user is not authorized to approve counter closing for the selected branch.');
    }

    return authorizedUser;
  }

  private async createKotForItems(
    order: Order,
    items: OrderItem[],
    options?: { markAsNew?: boolean; asAdditionDelta?: boolean },
  ): Promise<void> {
    const activeItems = items.filter((item) => item.item_status !== 'voided');
    if (activeItems.length === 0 || Number(order.kot_version || 0) <= 0) {
      return;
    }
    const markAsNew = options?.markAsNew ?? true;
    const isTerminalDelta = this.isTerminalKdsOrderStatus(order.order_status);

    await this.updateKotDraftForOrder(order, (existingEntries) => {
      const nextByItemId = new Map(
        isTerminalDelta
          ? existingEntries
            .filter((entry) => !['ready', 'served'].includes(String(entry?.item_status || '').toLowerCase()))
            .map((entry) => [Number(entry.order_item_id), entry])
          : existingEntries.map((entry) => [Number(entry.order_item_id), entry]),
      );

      for (const entry of activeItems) {
        nextByItemId.set(
          entry.id,
          this.buildKotItemPayload(entry, {
            is_new: options?.asAdditionDelta ? false : markAsNew,
            is_updated: Boolean(options?.asAdditionDelta),
            is_addition_delta: Boolean(options?.asAdditionDelta),
            old_quantity: options?.asAdditionDelta ? 0 : null,
            changed_at: new Date().toISOString(),
            timer_reset_at: new Date().toISOString(),
          }),
        );
      }

      return Array.from(nextByItemId.values());
    });
  }

  private getOrderServiceChargeAmount(order: Order): number {
    return this.roundCurrency(
      (order.charges ?? [])
        .filter((charge) => !charge.is_tax)
        .reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    );
  }

  private rethrowCheckoutStageError(stage: string, error: unknown): never {
    if (
      error instanceof BadRequestException
      || error instanceof ForbiddenException
      || error instanceof NotFoundException
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(`Checkout failed while ${stage}: ${message}`);
  }

  private isEditableOpenOrderStatus(status?: string | null): boolean {
    return ['held', 'pending', 'preparing', 'ready', 'served'].includes(String(status || '').toLowerCase());
  }

  private allocateWeightedAmounts<T extends { key: string; base: number }>(
    totalAmount: number,
    lines: T[],
  ): Map<string, number> {
    const targetTotal = this.roundCurrency(totalAmount);
    const allocations = new Map<string, number>();

    if (lines.length === 0 || targetTotal <= 0) {
      for (const line of lines) {
        allocations.set(line.key, 0);
      }
      return allocations;
    }

    const totalBase = lines.reduce((sum, line) => sum + Math.max(Number(line.base || 0), 0), 0);
    let allocated = 0;

    lines.forEach((line, index) => {
      const fallbackWeight = lines.length > 0 ? 1 / lines.length : 0;
      const weight = totalBase > 0
        ? Math.max(Number(line.base || 0), 0) / totalBase
        : fallbackWeight;
      const amount = index === lines.length - 1
        ? this.roundCurrency(targetTotal - allocated)
        : this.roundCurrency(targetTotal * weight);
      allocated = this.roundCurrency(allocated + amount);
      allocations.set(line.key, amount);
    });

    return allocations;
  }

  private serializeOrderReturn(returnRecord: OrderReturn) {
    const items = (returnRecord.items ?? []).map((item) => ({
      id: item.id,
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      base_amount: Number(item.base_amount || 0),
      discount_amount: Number(item.discount_amount || 0),
      tax_amount: Number(item.tax_amount || 0),
      service_charge_amount: Number(item.service_charge_amount || 0),
      refund_amount: Number(item.refund_amount || 0),
      created_at: item.created_at,
    }));
    const payments = (returnRecord.payments ?? []).map((payment) => ({
      id: payment.id,
      payment_mode: payment.payment_mode,
      amount: Number(payment.amount || 0),
      reference_number: payment.reference_number ?? null,
      transaction_date: payment.transaction_date,
      is_refund: payment.is_refund,
      return_id: payment.return_id ?? null,
    }));

    return {
      id: returnRecord.id,
      return_number: this.buildReturnInvoiceNumber(returnRecord.branch_id, returnRecord.id),
      order_id: returnRecord.order_id,
      return_scope: returnRecord.return_scope,
      refund_amount: Number(returnRecord.refund_amount || 0),
      restock_inventory: !!returnRecord.restock_inventory,
      return_note: returnRecord.return_note ?? null,
      payment_note: returnRecord.payment_note ?? null,
      processed_by_user_id: returnRecord.processed_by_user_id ?? null,
      created_at: returnRecord.created_at,
      updated_at: returnRecord.updated_at,
      items,
      payments,
    };
  }

  private serializeOrder(order: Order) {
    const items = (order.items ?? []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name ?? item.product?.product_name ?? `Product #${item.product_id}`,
      quantity: Number(item.quantity),
      item_price: Number(item.item_price),
      item_notes: item.item_notes ?? null,
      item_status: item.item_status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
    const charges = order.charges ?? [];
    const payments = order.transactions ?? [];
    const returns = [...(order.returns ?? [])].sort(
      (left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
    );
    const serializedReturns = returns.map((returnRecord) => this.serializeOrderReturn(returnRecord));
    const refundedAmount = this.roundCurrency(
      payments
        .filter((payment) => payment.is_refund)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
    const remainingRefundableAmount = this.roundCurrency(
      Math.max(Number(order.total_amount || 0) - refundedAmount, 0),
    );
    const deliveryDetails = this.normalizeDeliveryDetails(order.delivery_details);

    return {
      id: order.id,
      client_id: order.client_id,
      order_number: order.order_number,
      branch_id: order.branch_id,
      shift_id: order.shift_id ?? null,
      sale_counter_id: order.sale_counter_id ?? null,
      sale_counter_code: order.sale_counter?.code ?? null,
      sale_counter_name: order.sale_counter?.name ?? null,
      table_id: order.table_id ?? null,
      table_number: order.table?.table_number ?? null,
      table_name: order.table?.table_name ?? order.table?.table_number ?? null,
      customer_id: order.customer_id ?? null,
      customer_name: order.customer?.name ?? null,
      customer_phone: order.customer?.phone_number ?? null,
      order_taker_id: order.user_id ?? null,
      order_taker_name: order.cashier?.full_name ?? order.cashier?.user_name ?? null,
      order_taker_username: order.cashier?.user_name ?? null,
      order_type: order.order_type,
      order_status: order.order_status,
      payment_status: order.payment_status,
      order_note: order.order_note ?? null,
      delivery_details: deliveryDetails,
      delivery_contact_person: deliveryDetails?.contact_person ?? null,
      delivery_phone_number: deliveryDetails?.phone_number ?? null,
      delivery_address: deliveryDetails?.address ?? null,
      delivery_house_apartment: deliveryDetails?.house_apartment ?? null,
      delivery_street_no: deliveryDetails?.street_no ?? null,
      delivery_area_sector: deliveryDetails?.area_sector ?? null,
      delivery_locality: deliveryDetails?.locality ?? null,
      delivery_city: deliveryDetails?.city ?? null,
      delivery_ask_for: deliveryDetails?.ask_for ?? null,
      delivery_person_user_id: deliveryDetails?.delivery_person_user_id ?? null,
      delivery_person_name: deliveryDetails?.delivery_person_name ?? null,
      delivery_payment_term: deliveryDetails?.payment_term ?? null,
      delivery_status: deliveryDetails?.delivery_status ?? null,
      delivery_comment: deliveryDetails?.comment ?? null,
      rider: deliveryDetails?.delivery_person_name ?? null,
      delivery_rider_name: deliveryDetails?.delivery_person_name ?? null,
      voided_at: order.voided_at ?? null,
      void_reason: order.void_reason ?? null,
      void_authorized_by_user_id: order.void_authorized_by_user_id ?? null,
      void_authorized_by_username: order.void_authorized_by_username ?? null,
      kot_base_number: order.kot_base_number ?? null,
      kot_base_display: order.kot_base_number ? this.formatKotBaseNumber(order.kot_base_number) : null,
      kot_version: Number(order.kot_version || 0),
      current_kot_number: null,
      current_kot_display_number: null,
      receipt_number: order.receipt_number ?? null,
      voucher_id: order.voucher_id ?? null,
      voucher_code: order.voucher?.code ?? null,
      voucher_name: order.voucher?.name ?? null,
      finalized_at: order.finalized_at ?? null,
      sync_origin: order.sync_origin ?? 'online',
      source_device_id: order.source_device_id ?? null,
      source_device_uid: order.source_device_uid ?? null,
      offline_created_at: order.offline_created_at ?? null,
      sub_total: Number(order.sub_total ?? 0),
      tax_amount: Number(order.tax_amount ?? 0),
      discount_amount: Number(order.discount_amount ?? 0),
      total_amount: Number(order.total_amount ?? 0),
      created_at: order.created_at,
      updated_at: order.updated_at,
      items,
      charges: charges.map((charge: OrderCharge) => ({
        id: charge.id,
        charge_name: charge.charge_name,
        amount: Number(charge.amount),
        applied_rate: charge.applied_rate,
        is_tax: charge.is_tax,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        payment_mode: payment.payment_mode,
        amount: Number(payment.amount),
        reference_number: payment.reference_number ?? null,
        payment_details: payment.payment_details ?? null,
        transaction_date: payment.transaction_date,
        is_refund: payment.is_refund,
        return_id: payment.return_id ?? null,
        user_name: payment.user?.full_name ?? payment.user?.user_name ?? null,
      })),
      transactions: payments.map((payment) => ({
        id: payment.id,
        payment_mode: payment.payment_mode,
        amount: Number(payment.amount),
        reference_number: payment.reference_number ?? null,
        payment_details: payment.payment_details ?? null,
        transaction_date: payment.transaction_date,
        is_refund: payment.is_refund,
        return_id: payment.return_id ?? null,
        user_name: payment.user?.full_name ?? payment.user?.user_name ?? null,
      })),
      returns: serializedReturns,
      refunded_amount: refundedAmount,
      remaining_refundable_amount: remainingRefundableAmount,
      latest_return: serializedReturns[0] ?? null,
      receipt: order.finalized_at
        ? {
            receipt_number: order.receipt_number ?? this.buildReceiptNumber(order.branch_id, order.id),
            issued_at: order.finalized_at,
            branch_id: order.branch_id,
            shift_id: order.shift_id ?? null,
            sale_counter_id: order.sale_counter_id ?? null,
          }
        : null,
    };
  }

  private serializeDevice(device: PosDevice) {
    return {
      id: device.id,
      client_id: device.client_id,
      branch_id: device.branch_id,
      device_uid: device.device_uid,
      device_code: device.device_code,
      device_name: device.device_name,
      device_type: device.device_type,
      device_os: device.device_os,
      app_version: device.app_version,
      status: device.status,
      last_seen_at: device.last_seen_at ?? null,
      last_sync_at: device.last_sync_at ?? null,
      last_sync_status: device.last_sync_status ?? 'idle',
      last_sync_message: device.last_sync_message ?? null,
      created_at: device.created_at,
      updated_at: device.updated_at,
    };
  }

  private serializeSyncEvent(event: PosSyncEvent) {
    return {
      id: event.id,
      client_id: event.client_id,
      branch_id: event.branch_id,
      device_id: event.device_id ?? null,
      device_event_id: event.device_event_id ?? null,
      entity_type: event.entity_type,
      entity_id: event.entity_id ?? null,
      event_type: event.event_type,
      payload_hash: event.payload_hash,
      batch_id: event.batch_id ?? null,
      status: event.status,
      attempt_count: Number(event.attempt_count || 0),
      error_message: event.error_message ?? null,
      conflict_reason: event.conflict_reason ?? null,
      resolution_status: event.resolution_status ?? null,
      resolution_note: event.resolution_note ?? null,
      occurred_at: event.occurred_at ?? null,
      last_attempt_at: event.last_attempt_at ?? null,
      processed_at: event.processed_at ?? null,
      resolved_at: event.resolved_at ?? null,
      resolved_by_user_id: event.resolved_by_user_id ?? null,
      created_at: event.created_at,
      updated_at: event.updated_at,
    };
  }

  async openShift(clientId: string, branchId: number, userId: number, float: number, user?: JwtPayload): Promise<Shift> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'open POS shifts');
    const openingFloat = this.ensureNonNegativeMoney(float, 'Opening float');
    const businessDay = await this.requireActiveBusinessDay(clientId, branchId);
    const existingOpen = await this.shiftRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, business_day_id: businessDay.id, status: 'open' },
      order: { opened_at: 'DESC', id: 'DESC' },
    });
    if (existingOpen) return existingOpen;

    const shift = this.shiftRepo.create({
      client_id: clientId,
      branch_id: branchId,
      business_day_id: businessDay.id,
      shift_template_id: null,
      user_id: userId,
      external_shift_id: null,
      source_device_id: null,
      source_device_uid: null,
      sync_origin: 'online',
      opening_float: openingFloat,
      expected_cash: openingFloat,
      status: 'open',
      opened_at: new Date(),
      business_date: businessDay.business_date,
      is_day_open: true,
      shift_name: 'Operating Shift',
      shift_code: 'OPS',
      shift_order: 1,
      actual_start: new Date(),
    });
    const savedShift = await this.shiftRepo.save(shift);

    await this.operationalAuditService.log({
      user,
      action: 'POS Shift Open',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: savedShift.id,
      portal: 'Terminal',
      details: `Opened shift ${savedShift.id}`,
      metadata: {
        opening_float: openingFloat,
      },
    });

    return savedShift;
  }

  async getCurrentShift(clientId: string, branchId: number): Promise<Shift> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const shift = await this.ensureOperationalShift(clientId, branchId);
    if (!shift) throw new NotFoundException('No active shift found for this branch.');
    return this.refreshShiftExpectedCash(shift);
  }

  async closeShift(
    clientId: string,
    branchId: number,
    shiftId: number,
    dto: CloseShiftDto,
    user?: JwtPayload,
  ): Promise<Shift> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'close POS shifts');

    let shift = await this.shiftRepo.findOne({
      where: { id: shiftId, client_id: clientId, branch_id: branchId },
    });
    if (!shift) throw new NotFoundException('Shift not found.');
    if (shift.status === 'closed') throw new BadRequestException('Shift is already closed.');
    shift = await this.refreshShiftExpectedCash(shift);

    const openOrderCount = await this.orderRepo.count({
      where: {
        client_id: clientId,
        branch_id: branchId,
        shift_id: shift.id,
        order_status: In(['held', 'pending', 'preparing', 'ready', 'served']),
      },
    });
    if (openOrderCount > 0) {
      throw new BadRequestException(
        `Cannot close shift while ${openOrderCount} POS order(s) remain open for this shift.`,
      );
    }

    shift.actual_cash = this.ensureNonNegativeMoney(dto.actual_cash, 'Actual cash');
    shift.variance = Number(dto.actual_cash) - Number(shift.expected_cash);
    shift.status = 'closed';
    shift.closed_at = new Date();
    shift.supervisor_id = dto.supervisor_id ?? null as any;

    const savedShift = await this.shiftRepo.save(shift);

    await this.operationalAuditService.log({
      user,
      action: 'POS Shift Close',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: savedShift.id,
      portal: 'Terminal',
      details: `Closed shift ${savedShift.id}`,
      metadata: {
        actual_cash: dto.actual_cash,
        variance: savedShift.variance,
      },
    });

    return savedShift;
  }

  /**
   * Manager: Open a new business day for a branch.
   * Creates the Shift with the chosen business_date and registers each
   * authorized till with the Manager-assigned opening float.
   */
  async startBusinessDay(
    clientId: string,
    branchId: number,
    userId: number,
    dto: StartBusinessDayDto,
    user?: JwtPayload,
  ): Promise<{ business_day: BusinessDay; shift: Shift; authorized_tills: AuthorizedTill[] }> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'start business day');
    const businessDay = await this.openBusinessDay(
      clientId,
      branchId,
      userId,
      {
        title: `Business Day ${dto.business_date}`,
        business_date: dto.business_date,
        opened_at: new Date().toISOString(),
      },
      user,
    );
    const savedShift = await this.ensureOperationalShift(clientId, branchId, userId, businessDay, user);
    if (!savedShift) {
      throw new BadRequestException('Could not initialize day operations for this business day.');
    }
    const savedTills: AuthorizedTill[] = [];

    for (const till of dto.tills) {
      const session = await this.authorizedTillRepo.save(this.authorizedTillRepo.create({
        client_id: clientId,
        branch_id: branchId,
        shift_id: savedShift.id,
        sale_counter_id: till.sale_counter_id,
        user_id: till.user_id ?? userId,
        assigned_float: this.ensureNonNegativeMoney(till.assigned_float, 'Assigned float'),
        terminal_status: 'open',
      }));
      savedTills.push(session);
    }

    return { business_day: businessDay, shift: savedShift, authorized_tills: savedTills };
  }

  /** Get all authorized tills for the current open shift of a branch. */
  async getAuthorizedTills(clientId: string, branchId: number): Promise<AuthorizedTill[]> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const openShift = await this.ensureOperationalShift(clientId, branchId);
    if (!openShift) return [];
    const tills = await this.authorizedTillRepo.find({
      where: { client_id: clientId, branch_id: branchId, shift_id: openShift.id },
      relations: ['sale_counter', 'user', 'shift', 'shift.cashier'],
      order: { id: 'DESC' },
    });
    
    // Attach open orders count for each till
    const tillsWithOrdCount = await Promise.all(tills.map(async (till) => {
      const open_orders_count = await this.orderRepo.count({
        where: {
          client_id: clientId,
          branch_id: branchId,
          sale_counter_id: till.sale_counter_id,
          order_status: In(['held', 'pending', 'preparing', 'ready', 'served']),
        }
      });
      return { ...till, open_orders_count };
    }));

    return tillsWithOrdCount as any;
  }

  /**
   * Manager: Authorize a new (or previously closed) till session for the currently open shift.
   */
  async authorizeTill(
    clientId: string,
    branchId: number,
    dto: AuthorizedTillInputDto,
  ): Promise<AuthorizedTill> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const openShift = await this.ensureOperationalShift(clientId, branchId);
    if (!openShift) throw new BadRequestException('No active business day (shift) open.');
    if (!dto.user_id) {
      throw new BadRequestException('A supervisor must assign a cashier before opening or reopening a sales counter.');
    }

    return this.assignCounterSession(clientId, branchId, openShift.id, {
      sale_counter_id: dto.sale_counter_id,
      user_id: dto.user_id,
      assigned_float: dto.assigned_float,
    }) as unknown as Promise<AuthorizedTill>;
  }

  /**
   * Manager: Reassign a cashier or update the float of an 'open' till session.
   */
  async reassignTill(
    clientId: string,
    branchId: number,
    authorizedTillId: number,
    dto: import('./dto/pos-write.dto').ReassignTillDto,
  ): Promise<AuthorizedTill> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const row = await this.authorizedTillRepo.findOne({
      where: { id: authorizedTillId, client_id: clientId, branch_id: branchId },
    });

    if (!row) throw new NotFoundException('Authorized till not found.');
    if (row.terminal_status !== 'open') {
      throw new BadRequestException('Can only reassign tills that are in the open state (not active or closed).');
    }

    if (dto.user_id !== undefined) row.user_id = dto.user_id;
    if (dto.assigned_float !== undefined) {
      row.assigned_float = this.ensureNonNegativeMoney(dto.assigned_float, 'Assigned float');
    }

    return this.authorizedTillRepo.save(row);
  }

  /**
   * Cashier: Submit a blind count for their sale counter.
   * The cashier physically counts their drawer WITHOUT seeing the system total.
   * Counter closing is finalized immediately using cashier and authorized-user credentials.
   */
  async submitCounterBlindCount(
    clientId: string,
    branchId: number,
    authorizedTillId: number,
    userId: number,
    dto: SubmitBlindCountDto,
  ): Promise<AuthorizedTill> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    let row = await this.authorizedTillRepo.findOne({
      where: { id: authorizedTillId, client_id: clientId, branch_id: branchId },
    });

    // --- AUTOMATIC ID RESOLUTION (THE "THINK OUT OF THE BOX" FIX) ---
    // If we didn't find it by primary ID, maybe the frontend sent a legacy SaleCounter ID.
    // We look for any active AuthorizedTill record for that counter in this branch.
    if (!row) {
      row = await this.authorizedTillRepo.findOne({
        where: { sale_counter_id: authorizedTillId, client_id: clientId, branch_id: branchId, terminal_status: 'active' },
      });
      if (row) {
        console.warn(`[DIAGNOSTIC] Resolved legacy ID ${authorizedTillId} to modern AuthorizedTill ID ${row.id}`);
      }
    }

    if (!row) {
      throw new NotFoundException('Authorized till record not found.');
    }
    if (row.user_id && row.user_id !== userId) {
      throw new ForbiddenException('Only the assigned cashier can close this sales counter.');
    }
    if (row.terminal_status === 'closed') {
      throw new BadRequestException('This till has already been closed.');
    }
    if (row.terminal_status === 'blind_submitted') {
      throw new BadRequestException('This till is already pending close.');
    }
    await this.assertCounterSessionHasNoOpenOrders(row);
    await this.assertCounterSessionHasNoOpenKots(row);

    const cashierUsername = dto.cashier_username?.trim();
    const cashierPin = dto.cashier_pin?.trim();
    if (!cashierUsername || !cashierPin) {
      throw new ForbiddenException('Cashier username and PIN are required to close this sales counter.');
    }
    if (!row.user_id) {
      throw new ForbiddenException('This till does not have an assigned cashier.');
    }
    const cashier = await this.userRepo.findOne({
      where: { id: row.user_id, client_id: clientId, status: 'active', is_active: true },
    });
    if (!cashier || !cashier.pos_user_pin?.trim()) {
      throw new ForbiddenException('Cashier PIN is not configured for this user.');
    }
    const normalizedCashier = this.normalizeMatchToken(cashierUsername);
    const cashierTokens = [
      cashier.user_name,
      cashier.full_name,
      cashier.employee_id,
    ].map((value) => this.normalizeMatchToken(value)).filter(Boolean);
    if (!cashierTokens.includes(normalizedCashier)) {
      throw new ForbiddenException('Cashier username does not match the assigned cashier.');
    }
    if (cashier.pos_user_pin.trim() !== cashierPin) {
      throw new ForbiddenException('Cashier PIN verification failed.');
    }

    const authorizedUsername = dto.authorized_username?.trim() || dto.supervisor_username?.trim();
    const authorizedPin = dto.authorized_pin?.trim() || dto.supervisor_pin?.trim();
    if (!authorizedUsername || !authorizedPin) {
      throw new ForbiddenException('Authorized user ID and PIN are required to close this sales counter.');
    }
    const supervisor = await this.requireAuthorizedCounterCloseUser(
      clientId,
      branchId,
      cashier.id,
      authorizedUsername,
      authorizedPin,
    );

    row.blind_count = this.ensureNonNegativeMoney(dto.blind_count, 'Blind count');
    row.blind_submitted_at = new Date();
    const cashTotals = await this.calculateCounterSessionCash(row, clientId, branchId);
    row.expected_cash = cashTotals.expectedCash;
    row.variance = cashTotals.variance;
      row.terminal_status = 'closed';
      row.reconciled_at = row.blind_submitted_at;
      row.reconciled_by_user_id = supervisor.id;
      if (dto.notes) row.reconciliation_notes = dto.notes;

      const saved = await this.authorizedTillRepo.save(row);

      const businessDate = await this.resolveCounterSessionBusinessDate(saved);
      const safeHandover = await this.accountingService.createCounterCloseSafeHandover(
        clientId,
        branchId,
        Number(saved.blind_count || 0),
        businessDate,
        `TILL-CLOSE-${saved.id}`,
        `Automatic branch-safe handover for till close ${saved.sale_counter?.name ?? `#${saved.sale_counter_id}`}`,
      );

      await this.operationalAuditService.log({
        action: 'Counter Session Closed',
        entity: 'authorized_tills',
        clientId,
        branchId,
        entityId: saved.id,
        portal: 'Terminal',
        details: `Counter session ${saved.id} was fully closed with cashier and authorized-user credentials.`,
        metadata: {
          expected_cash: saved.expected_cash,
          blind_count: saved.blind_count,
          variance: saved.variance,
          safe_handover_journal_id: safeHandover?.journal?.id ?? null,
        },
      });

      return saved;
  }

  /**
   * Manager: Reconcile a single till after the cashier has submitted their blind count.
   * Calculates the system expected cash for that till and records the variance.
   */
  async managerReconcileTill(
    clientId: string,
    branchId: number,
    authorizedTillId: number,
    dto: ReconcileTillDto,
    user?: JwtPayload,
  ): Promise<AuthorizedTill> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const row = await this.authorizedTillRepo.findOne({
      where: { id: authorizedTillId, client_id: clientId, branch_id: branchId },
      relations: ['sale_counter'],
    });
    if (!row) throw new NotFoundException('Authorized till record not found.');
    if (row.terminal_status !== 'blind_submitted') {
      throw new BadRequestException(
        `Till cannot be reconciled in its current state (${row.terminal_status}). Cashier must submit a blind count first.`,
      );
    }
    if (row.blind_count === null) {
      throw new BadRequestException('No blind count found for this till.');
    }

    // Calculate cash attributable to this specific sale counter via its orders
    const counterCash = await this.calculateCounterSessionCash(row, clientId, branchId);
    const expectedCash = counterCash.expectedCash;
    const variance = this.roundCurrency(Number(row.blind_count) - expectedCash);

    row.expected_cash = expectedCash;
    row.variance = variance;
    row.terminal_status = 'closed';
    row.reconciled_at = new Date();
    row.reconciled_by_user_id = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null;
    if (dto.reconciliation_notes) row.reconciliation_notes = dto.reconciliation_notes;

    const saved = await this.authorizedTillRepo.save(row);

    await this.operationalAuditService.log({
      user,
      action: 'Till Reconciled',
      entity: 'authorized_tills',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Manager reconciled till ${saved.sale_counter?.name ?? `#${saved.sale_counter_id}`}. Variance: ${variance}`,
      metadata: { expected_cash: expectedCash, blind_count: row.blind_count, variance },
    });

    return saved;
  }

  /**
   * Cashier: Activate a till session.
   * Records the user_id and activated_at timestamp, and sets status to 'active'.
   */
  async activateCounterTill(
    clientId: string,
    branchId: number,
    authorizedTillId: number,
    userId: number,
  ): Promise<AuthorizedTill> {
    void clientId;
    void branchId;
    void authorizedTillId;
    void userId;
    throw new BadRequestException('Legacy till activation is disabled. Cashiers must verify opening cash through the counter-session verify-open flow.');
  }

  /**
   * Manager/Admin: Get the session history for a specific sale counter.
   */
  async getCounterHistory(clientId: string, branchId: number, counterId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const history = await this.authorizedTillRepo.find({
      where: { client_id: clientId, branch_id: branchId, sale_counter_id: counterId },
      relations: ['user', 'shift'],
      order: { created_at: 'DESC' },
    });

    const results: any[] = [];
    for (const session of history) {
      // Calculate total sales for this specific session
      // If it's still active, we calculate up to now.
      // If it's blind_submitted or closed, we calculate up to blind_submitted_at.
      const endTime = session.blind_submitted_at || new Date();
      const startTime = session.activated_at || session.created_at;

      const salesResult = await this.orderRepo.createQueryBuilder('order')
        .select('SUM(order.total_amount)', 'total_sales')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.sale_counter_id = :counterId', { counterId })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at BETWEEN :start AND :end', { start: startTime, end: endTime })
        .getRawOne();

      results.push({
        id: session.id,
        business_date: session.shift?.business_date,
        cashier_name: session.user?.full_name || 'System',
        designation: session.user?.user_type || 'Unknown Role',
        user_id: session.user_id,
        activated_at: session.activated_at,
        opened_at: session.created_at, // actual creation of session
        closed_at: session.blind_submitted_at,
        opening_float: Number(session.assigned_float),
        closing_cash: session.blind_count === null ? null : Number(session.blind_count),
        total_sales: this.roundCurrency(Number(salesResult?.total_sales || 0)),
        expected_cash: session.expected_cash === null ? null : Number(session.expected_cash),
        variance: session.variance === null ? null : Number(session.variance),
        status: session.terminal_status,
      });
    }

    return results;
  }

  async getBranchCounterSessionHistory(clientId: string, branchId: number, limit = 20) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const rows = await this.authorizedTillRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
      order: { created_at: 'DESC', id: 'DESC' },
      take: Math.max(1, Math.min(limit, 100)),
    });

    const results: any[] = [];
    for (const row of rows) {
      const sessionStart = row.opening_verified_at || row.activated_at || row.created_at;
      const sessionEnd = row.blind_submitted_at || row.reconciled_at || new Date();
      const salesResult = await this.orderRepo.createQueryBuilder('order')
        .select('COUNT(order.id)', 'order_count')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'net_sales')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.sale_counter_id = :counterId', { counterId: row.sale_counter_id })
        .andWhere('order.shift_id = :shiftId', { shiftId: row.shift_id })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .andWhere('order.created_at BETWEEN :start AND :end', { start: sessionStart, end: sessionEnd })
        .getRawOne();

      results.push({
        ...this.formatCounterSession(row),
        counter_name: row.sale_counter?.name || row.sale_counter?.code || 'Terminal',
        counter_code: row.sale_counter?.code || null,
        cashier_name: row.user?.full_name || row.user?.user_name || 'Unassigned',
        cashier_id: row.user_id,
        business_day_title: row.shift?.business_day?.title || null,
        business_date: row.shift?.business_date || row.shift?.business_day?.business_date || null,
        shift_name: row.shift?.shift_name || null,
        opened_at: sessionStart,
        closed_at: row.blind_submitted_at || row.reconciled_at || null,
        opening_float: Number(row.opening_verified_cash ?? row.assigned_float ?? 0),
        actual_cash: row.blind_count === null || row.blind_count === undefined ? null : Number(row.blind_count),
        total_orders: Number(salesResult?.order_count || 0),
        net_sales: this.roundCurrency(Number(salesResult?.net_sales || 0)),
        status: this.normalizeSessionStatus(row.terminal_status),
      });
    }

    return results;
  }

  async getCounterSessionXReport(clientId: string, branchId: number, sessionId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const session = await this.authorizedTillRepo.findOne({
      where: { id: sessionId, client_id: clientId, branch_id: branchId },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
    });
    if (!session) {
      throw new NotFoundException('Counter session was not found.');
    }

    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
    const authorizedBy = session.reconciled_by_user_id
      ? await this.userRepo.findOne({ where: { id: session.reconciled_by_user_id, client_id: clientId } })
      : null;
    const { start, end } = this.getCounterSessionWindow(session);

    const orders = await this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.production_station', 'product_station')
      .leftJoinAndSelect('order.transactions', 'transactions')
      .leftJoinAndSelect('order.returns', 'returns')
      .leftJoinAndSelect('returns.items', 'return_items')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.sale_counter_id = :saleCounterId', { saleCounterId: session.sale_counter_id })
      .andWhere('order.shift_id = :shiftId', { shiftId: session.shift_id })
      .andWhere('order.created_at BETWEEN :start AND :end', { start, end })
      .orderBy('order.created_at', 'ASC')
      .getMany();

    const cashExpenseRows = await this.dataSource.getRepository(FinancialVoucher).createQueryBuilder('voucher')
      .where('voucher.client_id = :clientId', { clientId })
      .andWhere('voucher.branch_id = :branchId', { branchId })
      .andWhere('voucher.type = :type', { type: VoucherType.EXPENSE })
      .andWhere('voucher.status != :voidStatus', { voidStatus: VoucherStatus.VOID })
      .andWhere('LOWER(COALESCE(voucher.payment_method, :defaultMethod)) = :cashMethod', {
        defaultMethod: '',
        cashMethod: 'cash',
      })
      .andWhere('voucher.created_at BETWEEN :start AND :end', { start, end })
      .getMany();

    const orderIds = orders.map((order) => order.id);
    const totalKots = orderIds.length > 0
      ? await this.kotRepo.createQueryBuilder('kot')
        .where('kot.client_id = :clientId', { clientId })
        .andWhere('kot.branch_id = :branchId', { branchId })
        .andWhere('kot.order_id IN (:...orderIds)', { orderIds })
        .andWhere('kot.created_at BETWEEN :start AND :end', { start, end })
        .getCount()
      : 0;

    const paymentSummary = {
      cash: 0,
      card: 0,
      bank: 0,
      digital_wallet: 0,
      other: 0,
      refunds_cash: 0,
      refunds_total: 0,
    };
    const orderTypeMap = new Map<string, { count: number; amount: number }>();
    const itemMap = new Map<string, { qty: number; gross: number; returns: number; returnedAmount: number; net: number }>();
    const stationMap = new Map<string, { orders: Set<number>; amount: number }>();

    let completedOrders = 0;
    let totalOrders = 0;
    let totalDiscount = 0;
    let totalVoidedOrders = 0;
    let totalVoidedAmount = 0;
    let totalReturnedOrders = 0;
    let totalReturnAmount = 0;
    let totalCreditOrders = 0;
    let totalCreditValue = 0;
    let totalRegisteredCustomers = 0;
    const uniqueCustomers = new Set<number>();

    for (const order of orders) {
      const orderStatus = this.normalizeMatchToken(order.order_status);
      const paymentStatus = this.normalizeMatchToken(order.payment_status);
      const orderTotal = Number(order.total_amount || 0);

      if (!['cancelled', 'voided'].includes(orderStatus)) {
        totalOrders += 1;
        totalDiscount += Number(order.discount_amount || 0);
        const bucketKey = this.normalizeOrderType(order.order_type);
        const bucket = orderTypeMap.get(bucketKey) ?? { count: 0, amount: 0 };
        bucket.count += 1;
        bucket.amount += orderTotal;
        orderTypeMap.set(bucketKey, bucket);
      }

      if (orderStatus === 'completed') {
        completedOrders += 1;
      }
      if (['cancelled', 'voided'].includes(orderStatus)) {
        totalVoidedOrders += 1;
        totalVoidedAmount += orderTotal;
      }
      if (paymentStatus === 'credited') {
        totalCreditOrders += 1;
        totalCreditValue += orderTotal;
      }
      if (order.customer_id) {
        uniqueCustomers.add(order.customer_id);
      }

      for (const transaction of order.transactions ?? []) {
        const amount = Number(transaction.amount || 0);
        const mode = this.normalizePaymentMode(transaction.payment_mode);
        if (transaction.is_refund) {
          paymentSummary.refunds_total += amount;
          if (mode === 'cash') {
            paymentSummary.refunds_cash += amount;
          }
          continue;
        }
        paymentSummary[mode] += amount;
      }

      const skipRevenueLines = ['cancelled', 'voided'].includes(orderStatus);
      if (!skipRevenueLines) {
        for (const item of order.items ?? []) {
          if (this.normalizeMatchToken(item.item_status) === 'voided') {
            continue;
          }
          const name = String(item.product_name || item.product?.product_name || 'Item').trim();
          const qty = Number(item.quantity || 0);
          const gross = qty * Number(item.item_price || 0);
          const entry = itemMap.get(name) ?? { qty: 0, gross: 0, returns: 0, returnedAmount: 0, net: 0 };
          entry.qty += qty;
          entry.gross += gross;
          entry.net += gross;
          itemMap.set(name, entry);

          const stationName = String(item.product?.production_station?.name || 'Prep Station (Unassigned)').trim();
          const stationEntry = stationMap.get(stationName) ?? { orders: new Set<number>(), amount: 0 };
          stationEntry.orders.add(order.id);
          stationEntry.amount += gross;
          stationMap.set(stationName, stationEntry);
        }
      }

      for (const returnRecord of order.returns ?? []) {
        totalReturnedOrders += 1;
        totalReturnAmount += Number(returnRecord.refund_amount || 0);
        for (const returnItem of returnRecord.items ?? []) {
          const name = String(returnItem.product_name || 'Item').trim();
          const entry = itemMap.get(name) ?? { qty: 0, gross: 0, returns: 0, returnedAmount: 0, net: 0 };
          entry.returns += Number(returnItem.quantity || 0);
          entry.returnedAmount += Number(returnItem.refund_amount || 0);
          entry.net -= Number(returnItem.refund_amount || 0);
          itemMap.set(name, entry);
        }
      }
    }

    totalRegisteredCustomers = uniqueCustomers.size;

    const trackedCashExpenses = cashExpenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const cashInDrawerExpected = this.roundCurrency(
      Number(session.opening_verified_cash ?? session.assigned_float ?? 0)
      + paymentSummary.cash
      - paymentSummary.refunds_cash
      - trackedCashExpenses,
    );
    const actualCashCounted = Number(session.blind_count ?? 0);
    const variance = this.roundCurrency(
      session.variance ?? (actualCashCounted - cashInDrawerExpected),
    );

    const soldItems = Array.from(itemMap.entries())
      .map(([name, values]) => ({
        item: name,
        qty: values.qty,
        gross_sale: this.roundCurrency(values.gross),
        returns_qty: values.returns,
        returned_amount: this.roundCurrency(values.returnedAmount),
        net_sale: this.roundCurrency(values.net),
      }))
      .sort((left, right) => right.net_sale - left.net_sale)
      .slice(0, 12);

    const stationWiseSales = Array.from(stationMap.entries())
      .map(([station, values]) => ({
        station,
        orders: values.orders.size,
        sales_amount: this.roundCurrency(values.amount),
      }))
      .sort((left, right) => right.sales_amount - left.sales_amount);

    return {
      session_id: session.id,
      report_id: this.buildCounterSessionReportId(session),
      report_type: 'x_report',
      branch: {
        id: branch?.id ?? branchId,
        name: branch?.branch_name || 'Branch',
        code: branch?.branch_code || null,
        phone: branch?.phone || null,
        address: branch?.address || null,
      },
      counter: {
        id: session.sale_counter_id,
        name: session.sale_counter?.name || 'Counter',
        code: session.sale_counter?.code || null,
      },
      cashier: {
        id: session.user_id,
        name: session.user?.full_name || session.user?.user_name || 'Unassigned',
        username: session.user?.user_name || null,
        employee_id: session.user?.employee_id || null,
      },
      authorized_by: authorizedBy ? {
        id: authorizedBy.id,
        name: authorizedBy.full_name || authorizedBy.user_name,
        username: authorizedBy.user_name,
        employee_id: authorizedBy.employee_id || null,
      } : null,
      business_day: {
        title: session.shift?.business_day?.title || session.shift?.shift_name || null,
        business_date: session.shift?.business_date || session.shift?.business_day?.business_date || null,
      },
      session_window: {
        opened_at: start,
        closed_at: end,
      },
      sections: {
        cash_summary: {
          opening_cash: this.roundCurrency(Number(session.opening_verified_cash ?? session.assigned_float ?? 0)),
          cash_sale: this.roundCurrency(paymentSummary.cash),
          cash_expense: this.roundCurrency(trackedCashExpenses),
          cash_refund: this.roundCurrency(paymentSummary.refunds_cash),
          total_cash_in_hand: cashInDrawerExpected,
        },
        cash_actual_vs_expected: {
          expected_cash: cashInDrawerExpected,
          actual_cash: this.roundCurrency(actualCashCounted),
          variance,
        },
        pos_summary: {
          cash_sale: this.roundCurrency(paymentSummary.cash),
          online_payment_sale: this.roundCurrency(paymentSummary.digital_wallet + paymentSummary.other),
          credit_card_sale: this.roundCurrency(paymentSummary.card + paymentSummary.bank),
          wallet_sale: this.roundCurrency(paymentSummary.digital_wallet),
          total_sale: this.roundCurrency(paymentSummary.cash + paymentSummary.card + paymentSummary.bank + paymentSummary.digital_wallet + paymentSummary.other),
          returned_orders: totalReturnedOrders,
          returned_amount: this.roundCurrency(totalReturnAmount),
          customer_count: totalRegisteredCustomers,
          total_orders: totalOrders,
          total_kots: totalKots,
          discount_amount: this.roundCurrency(totalDiscount),
          voided_orders: totalVoidedOrders,
          voided_amount: this.roundCurrency(totalVoidedAmount),
          completed_orders: completedOrders,
        },
        wallet_summary: {
          wallet_used_today: this.roundCurrency(paymentSummary.digital_wallet),
          added_in_wallet_today: 0,
          current_closing_balance: 0,
        },
        credit_summary: {
          total_credited_sale_today: this.roundCurrency(totalCreditValue),
          credited_orders_count: totalCreditOrders,
          previously_pending_credit: 0,
          credited_amount_received: 0,
          net_credit_balance: this.roundCurrency(totalCreditValue),
        },
        expense_summary: {
          expense_from_cash_counter: this.roundCurrency(trackedCashExpenses),
          sales_expense_ratio: paymentSummary.cash > 0
            ? this.roundCurrency((trackedCashExpenses / paymentSummary.cash) * 100)
            : 0,
          total_expense: this.roundCurrency(trackedCashExpenses),
        },
        order_type_summary: Array.from(orderTypeMap.entries()).map(([type, values]) => ({
          type,
          orders: values.count,
          amount: this.roundCurrency(values.amount),
        })),
        sold_items_summary: soldItems,
        station_wise_sale: stationWiseSales,
        events_summary: {
          cash_events: completedOrders,
          credit_events: totalCreditOrders,
          payment_received_against_events: 0,
          receivable_amount_of_event: this.roundCurrency(totalCreditValue),
        },
      },
      printed_at: new Date(),
    };
  }

  async getShifts(clientId: string, branchId: number): Promise<any[]> {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const shifts = await this.shiftRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      relations: ['business_day', 'shift_template', 'cashier'],
      order: { opened_at: 'DESC', id: 'DESC' },
      take: 50,
    });
    const shiftIds = shifts.map((shift) => shift.id);
    const salesRows = shiftIds.length === 0
      ? []
      : await this.orderRepo.createQueryBuilder('order')
        .select('order.shift_id', 'shift_id')
        .addSelect('COUNT(order.id)', 'order_count')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'net_sales')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.shift_id IN (:...shiftIds)', { shiftIds })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .groupBy('order.shift_id')
        .getRawMany();
    const sessionRows = shiftIds.length === 0
      ? []
      : await this.authorizedTillRepo.createQueryBuilder('session')
        .select('session.shift_id', 'shift_id')
        .addSelect('COUNT(session.id)', 'session_count')
        .addSelect(`SUM(CASE WHEN session.terminal_status = 'active' THEN 1 ELSE 0 END)`, 'active_count')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.shift_id IN (:...shiftIds)', { shiftIds })
        .groupBy('session.shift_id')
        .getRawMany();

    const salesByShift = new Map(salesRows.map((row) => [Number(row.shift_id), row]));
    const sessionsByShift = new Map(sessionRows.map((row) => [Number(row.shift_id), row]));

    return shifts.map((shift) => {
      const sales = salesByShift.get(shift.id);
      const sessions = sessionsByShift.get(shift.id);
      return {
        id: shift.id,
        business_day_id: shift.business_day_id,
        business_day_title: shift.business_day?.title ?? null,
        business_date: shift.business_date,
        shift_name: shift.shift_name || shift.shift_template?.name || `Shift #${shift.id}`,
        shift_code: shift.shift_code || shift.shift_template?.code || null,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        status: shift.status,
        opening_float: Number(shift.opening_float || 0),
        expected_cash: Number(shift.expected_cash || 0),
        actual_cash: shift.actual_cash === null ? null : Number(shift.actual_cash),
        variance: Number(shift.variance || 0),
        cashier_name: shift.cashier?.full_name || 'Supervisor',
        total_orders: Number(sales?.order_count || 0),
        net_sales: this.roundCurrency(Number(sales?.net_sales || 0)),
        counter_session_count: Number(sessions?.session_count || 0),
        active_counter_count: Number(sessions?.active_count || 0),
      };
    });
  }

  async getOperationsConsole(clientId: string, branchId: number) {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId, client_id: clientId },
      relations: ['client'],
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const [activeBusinessDay, recentBusinessDays, shiftTemplates, saleCounters, cashiers, recentSessions, recentShiftRows] = await Promise.all([
      this.getActiveBusinessDay(clientId, branchId),
      this.businessDayRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        order: { business_date: 'DESC', id: 'DESC' },
        take: 20,
      }),
      this.shiftTemplateRepo.find({
        where: [
          { client_id: clientId, branch_id: branchId, is_active: true },
          { client_id: clientId, branch_id: IsNull(), is_active: true },
        ],
        order: { sort_order: 'ASC', name: 'ASC' },
      }),
      this.saleCounterRepo.find({
        where: { client_id: clientId, branch_id: branchId, is_active: true },
        order: { name: 'ASC' },
      }),
      this.userRepo.find({
        where: { client_id: clientId, status: 'active', is_active: true },
        order: { full_name: 'ASC' },
      }),
      this.authorizedTillRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
        order: { created_at: 'DESC' },
        take: 30,
      }),
      this.shiftRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        relations: ['shift_template', 'business_day'],
        order: { opened_at: 'DESC', id: 'DESC' },
        take: 20,
      }),
    ]);

    const shifts = activeBusinessDay
      ? await this.shiftRepo.find({
        where: { client_id: clientId, branch_id: branchId, business_day_id: activeBusinessDay.id },
        relations: ['shift_template'],
        order: { status: 'ASC', shift_order: 'ASC', opened_at: 'ASC', id: 'ASC' },
      })
      : [];

    const shiftIds = shifts.map((shift) => shift.id);
    const sessions = shiftIds.length === 0
      ? []
      : await this.authorizedTillRepo.find({
        where: shiftIds.map((shiftId) => ({ client_id: clientId, branch_id: branchId, shift_id: shiftId })),
        relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
        order: { created_at: 'ASC', id: 'ASC' },
      });

    const salesByShiftRows = shiftIds.length === 0
      ? []
      : await this.orderRepo.createQueryBuilder('order')
        .select('order.shift_id', 'shift_id')
        .addSelect('COUNT(order.id)', 'order_count')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'net_sales')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.shift_id IN (:...shiftIds)', { shiftIds })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .groupBy('order.shift_id')
        .getRawMany();

    const salesByShift = new Map(
      salesByShiftRows.map((row) => [
        Number(row.shift_id),
        {
          order_count: Number(row.order_count || 0),
          net_sales: this.roundCurrency(Number(row.net_sales || 0)),
        },
      ]),
    );

    const recentShiftIds = recentShiftRows.map((shift) => shift.id);
    const recentShiftSalesRows = recentShiftIds.length === 0
      ? []
      : await this.orderRepo.createQueryBuilder('order')
        .select('order.shift_id', 'shift_id')
        .addSelect('COUNT(order.id)', 'order_count')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'net_sales')
        .where('order.client_id = :clientId', { clientId })
        .andWhere('order.branch_id = :branchId', { branchId })
        .andWhere('order.shift_id IN (:...recentShiftIds)', { recentShiftIds })
        .andWhere('order.order_status = :status', { status: 'completed' })
        .groupBy('order.shift_id')
        .getRawMany();

    const recentShiftSessions = recentShiftIds.length === 0
      ? []
      : await this.authorizedTillRepo.createQueryBuilder('session')
        .select('session.shift_id', 'shift_id')
        .addSelect('COUNT(session.id)', 'session_count')
        .addSelect(`SUM(CASE WHEN session.terminal_status = 'active' THEN 1 ELSE 0 END)`, 'active_count')
        .addSelect(`SUM(CASE WHEN session.terminal_status = 'blind_submitted' THEN 1 ELSE 0 END)`, 'pending_count')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.shift_id IN (:...recentShiftIds)', { recentShiftIds })
        .groupBy('session.shift_id')
        .getRawMany();

    const recentShiftSalesByShift = new Map(
      recentShiftSalesRows.map((row) => [
        Number(row.shift_id),
        {
          order_count: Number(row.order_count || 0),
          net_sales: this.roundCurrency(Number(row.net_sales || 0)),
        },
      ]),
    );

    const recentShiftSessionsByShift = new Map(
      recentShiftSessions.map((row) => [
        Number(row.shift_id),
        {
          session_count: Number(row.session_count || 0),
          active_count: Number(row.active_count || 0),
          pending_count: Number(row.pending_count || 0),
        },
      ]),
    );

    const sessionsByShift = new Map<number, AuthorizedTill[]>();
    for (const session of sessions) {
      const bucket = sessionsByShift.get(session.shift_id) ?? [];
      bucket.push(session);
      sessionsByShift.set(session.shift_id, bucket);
    }
    const formattedCounterSessions = await Promise.all(
      sessions.map((session) => this.formatCounterSessionForConsole(session, clientId, branchId)),
    );
    const formattedRecentCounterSessions = await Promise.all(
      recentSessions.map((session) => this.formatCounterSessionForConsole(session, clientId, branchId)),
    );

    return {
      branch_context: {
        branch_id: branch.id,
        branch_name: branch.branch_name,
        currency_code: branch.currency_code || null,
        effective_currency_code: branch.inherit_client_currency
          ? (branch.client?.currency || branch.currency_code || 'USD')
          : (branch.currency_code || branch.client?.currency || 'USD'),
      },
      active_business_day: activeBusinessDay
        ? {
          ...activeBusinessDay,
          shift_count: shifts.length,
          counter_session_count: sessions.length,
        }
        : null,
      recent_business_days: recentBusinessDays,
      recent_shift_sessions: recentShiftRows.map((shift) => {
        const stats = recentShiftSalesByShift.get(shift.id) ?? { order_count: 0, net_sales: 0 };
        const sessionStats = recentShiftSessionsByShift.get(shift.id) ?? { session_count: 0, active_count: 0, pending_count: 0 };
        return {
          id: shift.id,
          business_day_id: shift.business_day_id,
          business_day_title: shift.business_day?.title ?? null,
          business_date: shift.business_date,
          shift_template_id: shift.shift_template_id,
          shift_name: shift.shift_name || shift.shift_template?.name || `Shift #${shift.id}`,
          shift_code: shift.shift_code || shift.shift_template?.code || null,
          shift_order: shift.shift_order,
          planned_start: shift.planned_start,
          planned_end: shift.planned_end,
          opened_at: shift.opened_at,
          closed_at: shift.closed_at,
          status: shift.status,
          opening_float: Number(shift.opening_float || 0),
          expected_cash: Number(shift.expected_cash || 0),
          actual_cash: shift.actual_cash === null ? null : Number(shift.actual_cash),
          variance: Number(shift.variance || 0),
          total_orders: stats.order_count,
          net_sales: stats.net_sales,
          counter_session_count: sessionStats.session_count,
          active_counter_count: sessionStats.active_count,
          pending_close_count: sessionStats.pending_count,
        };
      }),
      shift_templates: shiftTemplates,
      sale_counters: saleCounters,
      cashiers: cashiers.map((cashier) => ({
        id: cashier.id,
        full_name: cashier.full_name,
        user_name: cashier.user_name,
        user_type: cashier.user_type,
        designation_id: cashier.designation_id,
      })),
      shifts: shifts.map((shift) => {
        const shiftSessions = sessionsByShift.get(shift.id) ?? [];
        const stats = salesByShift.get(shift.id) ?? { order_count: 0, net_sales: 0 };
        return {
          id: shift.id,
          business_day_id: shift.business_day_id,
          shift_template_id: shift.shift_template_id,
          shift_name: shift.shift_name || shift.shift_template?.name || `Shift #${shift.id}`,
          shift_code: shift.shift_code || shift.shift_template?.code || null,
          shift_order: shift.shift_order,
          business_date: shift.business_date,
          planned_start: shift.planned_start,
          planned_end: shift.planned_end,
          opened_at: shift.opened_at,
          closed_at: shift.closed_at,
          status: shift.status,
          opening_float: Number(shift.opening_float || 0),
          expected_cash: Number(shift.expected_cash || 0),
          actual_cash: shift.actual_cash === null ? null : Number(shift.actual_cash),
          variance: Number(shift.variance || 0),
          total_orders: stats.order_count,
          net_sales: stats.net_sales,
          counter_session_count: shiftSessions.length,
          active_counter_count: shiftSessions.filter((session) => session.terminal_status === 'active').length,
          pending_close_count: shiftSessions.filter((session) => session.terminal_status === 'blind_submitted').length,
        };
      }),
      counter_sessions: formattedCounterSessions,
      recent_counter_sessions: formattedRecentCounterSessions,
      summary: {
        active_shift_count: shifts.filter((shift) => shift.status === 'open').length,
        assigned_counter_count: sessions.filter((session) => session.terminal_status === 'open').length,
        open_counter_count: sessions.filter((session) => session.terminal_status === 'active').length,
        blind_close_pending_count: sessions.filter((session) => session.terminal_status === 'blind_submitted').length,
      },
    };
  }

  private serializeCardMachine(machine: PosCardMachine) {
    return {
      id: machine.id,
      client_id: machine.client_id,
      branch_id: machine.branch_id,
      machine_name: machine.machine_name,
      service_provider: machine.service_provider,
      pid_number: machine.pid_number,
      mid_number: machine.mid_number,
      is_active: machine.is_active,
      created_at: machine.created_at,
      updated_at: machine.updated_at,
    };
  }

  async listCardMachines(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'read POS card machines');
    const rows = await this.posCardMachineRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      order: { is_active: 'DESC', machine_name: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.serializeCardMachine(row));
  }

  async createCardMachine(
    clientId: string,
    branchId: number,
    dto: CreatePosCardMachineDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'create POS card machines');
    const entity = this.posCardMachineRepo.create({
      client_id: clientId,
      branch_id: branchId,
      machine_name: dto.machine_name.trim(),
      service_provider: dto.service_provider.trim(),
      pid_number: dto.pid_number.trim(),
      mid_number: dto.mid_number.trim(),
      is_active: dto.is_active ?? true,
    });
    const saved = await this.posCardMachineRepo.save(entity);
    await this.operationalAuditService.log({
      user,
      action: 'POS Card Machine Created',
      entity: 'pos_card_machines',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Created POS card machine ${saved.machine_name}`,
      metadata: {
        service_provider: saved.service_provider,
        pid_number: saved.pid_number,
        mid_number: saved.mid_number,
      },
    });
    return this.serializeCardMachine(saved);
  }

  async updateCardMachine(
    clientId: string,
    branchId: number,
    machineId: number,
    dto: UpdatePosCardMachineDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update POS card machines');
    const machine = await this.posCardMachineRepo.findOne({
      where: { id: machineId, client_id: clientId, branch_id: branchId },
    });
    if (!machine) {
      throw new NotFoundException('POS card machine not found for this branch.');
    }
    if (dto.machine_name !== undefined) machine.machine_name = dto.machine_name.trim();
    if (dto.service_provider !== undefined) machine.service_provider = dto.service_provider.trim();
    if (dto.pid_number !== undefined) machine.pid_number = dto.pid_number.trim();
    if (dto.mid_number !== undefined) machine.mid_number = dto.mid_number.trim();
    if (dto.is_active !== undefined) machine.is_active = dto.is_active;
    const saved = await this.posCardMachineRepo.save(machine);
    await this.operationalAuditService.log({
      user,
      action: 'POS Card Machine Updated',
      entity: 'pos_card_machines',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Updated POS card machine ${saved.machine_name}`,
      metadata: {
        service_provider: saved.service_provider,
        pid_number: saved.pid_number,
        mid_number: saved.mid_number,
        is_active: saved.is_active,
      },
    });
    return this.serializeCardMachine(saved);
  }

  async getPosOrderTakers(clientId: string, branchId: number, currentUser?: JwtPayload) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const users = await this.userRepo.find({
      where: { client_id: clientId, status: 'active', is_active: true },
      relations: ['roleEntity', 'designation', 'branchRoles', 'branchRoles.roleEntity', 'branchPermissions'],
      order: { full_name: 'ASC', user_name: 'ASC' },
    });

    const currentUserId = typeof currentUser?.sub === 'string'
      ? Number.parseInt(currentUser.sub, 10)
      : Number(currentUser?.sub || 0);
    const includesToken = (value?: string | null, tokens: string[] = []) => {
      const normalized = String(value || '').trim().toLowerCase();
      return tokens.some((token) => normalized.includes(token));
    };

    return users
      .filter((user) => {
        const branchRoles = (user.branchRoles || [])
          .filter((entry) => Number(entry.branch_id || 0) === Number(branchId));
        const rolePermissions = Array.isArray(user.roleEntity?.permissions) ? user.roleEntity.permissions : [];
        const branchRolePermissions = branchRoles
          .flatMap((entry) => Array.isArray(entry.roleEntity?.permissions) ? entry.roleEntity.permissions : []);
        const branchPermissionIds = (user.branchPermissions || [])
          .filter((entry) => Number(entry.branch_id || 0) === Number(branchId))
          .map((entry) => entry.permission_id);
        const isOrderTaker = includesToken(user.designation?.name, ['order taker'])
          || includesToken(user.roleEntity?.role_name, ['order taker'])
          || branchRoles.some((entry) => includesToken(entry.roleEntity?.role_name, ['order taker']))
          || rolePermissions.includes(APP_PERMISSIONS.POS.ORDER_TAKER)
          || branchRolePermissions.includes(APP_PERMISSIONS.POS.ORDER_TAKER)
          || branchPermissionIds.includes(APP_PERMISSIONS.POS.ORDER_TAKER);
        const isCurrentCashier = Number(user.id) === Number(currentUserId);

        return isOrderTaker || isCurrentCashier;
      })
      .map((user) => ({
        id: user.id,
        full_name: user.full_name || user.user_name,
        user_name: user.user_name,
        employee_id: user.employee_id || null,
        designation_name: user.designation?.name || null,
        role_name: user.roleEntity?.role_name || null,
      }));
  }

  async getShiftTemplates(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    return this.shiftTemplateRepo.find({
      where: [
        { client_id: clientId, branch_id: branchId },
        { client_id: clientId, branch_id: IsNull() },
      ],
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async createShiftTemplate(
    clientId: string,
    branchId: number,
    dto: CreateShiftTemplateDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'manage shift templates');
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.shiftTemplateRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, code },
    });
    if (duplicate) {
      throw new BadRequestException(`Shift template code ${code} already exists for this branch.`);
    }

    const template = this.shiftTemplateRepo.create({
      client_id: clientId,
      branch_id: branchId,
      name: dto.name.trim(),
      code,
      planned_start_time: dto.planned_start_time,
      planned_end_time: dto.planned_end_time,
      sort_order: dto.sort_order ?? 1,
      allow_overlap: dto.allow_overlap ?? true,
      is_active: dto.is_active ?? true,
    });
    const saved = await this.shiftTemplateRepo.save(template);

    await this.operationalAuditService.log({
      user,
      action: 'Shift Template Create',
      entity: 'shift_templates',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Created shift template ${saved.name}`,
    });

    return saved;
  }

  async updateShiftTemplate(
    clientId: string,
    branchId: number,
    templateId: number,
    dto: UpdateShiftTemplateDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'manage shift templates');
    const template = await this.shiftTemplateRepo.findOne({
      where: { id: templateId, client_id: clientId, branch_id: branchId },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found.');
    }

    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.code !== undefined) template.code = dto.code.trim().toUpperCase();
    if (dto.planned_start_time !== undefined) template.planned_start_time = dto.planned_start_time;
    if (dto.planned_end_time !== undefined) template.planned_end_time = dto.planned_end_time;
    if (dto.sort_order !== undefined) template.sort_order = dto.sort_order;
    if (dto.allow_overlap !== undefined) template.allow_overlap = dto.allow_overlap;
    if (dto.is_active !== undefined) template.is_active = dto.is_active;

    const saved = await this.shiftTemplateRepo.save(template);

    await this.operationalAuditService.log({
      user,
      action: 'Shift Template Update',
      entity: 'shift_templates',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Updated shift template ${saved.name}`,
    });

    return saved;
  }

  async openBusinessDay(
    clientId: string,
    branchId: number,
    userId: number,
    dto: CreateBusinessDayDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'open business day');
    if (dto.is_off_day) {
      throw new BadRequestException('Use the off-day endpoint when creating an off day.');
    }

    const existingOpen = await this.getActiveBusinessDay(clientId, branchId);
    if (existingOpen) {
      throw new BadRequestException(`Business day ${existingOpen.title} is already open for this branch.`);
    }

    const existingForDate = await this.businessDayRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, business_date: dto.business_date },
    });
    if (existingForDate) {
      throw new BadRequestException(`Business day ${dto.business_date} already exists for this branch.`);
    }

    const businessDay = this.businessDayRepo.create({
      client_id: clientId,
      branch_id: branchId,
      title: dto.title.trim(),
      business_date: dto.business_date,
      opened_at: this.parseOptionalDate(dto.opened_at) ?? new Date(),
      planned_closing_at: this.parseOptionalDate(dto.planned_closing_at),
      status: 'open',
      is_off_day: false,
      off_day_reason: null,
      notes: dto.notes?.trim() || null,
      opened_by_user_id: userId,
      closed_by_user_id: null,
    });
    const saved = await this.businessDayRepo.save(businessDay);
    await this.ensureOperationalShift(clientId, branchId, userId, saved, user);

    await this.operationalAuditService.log({
      user,
      action: 'Business Day Open',
      entity: 'business_days',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Opened business day ${saved.title}`,
      metadata: { business_date: saved.business_date },
    });

    return saved;
  }

  async markOffDay(
    clientId: string,
    branchId: number,
    userId: number,
    dto: CreateBusinessDayDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'mark business off day');
    const existingOpen = await this.getActiveBusinessDay(clientId, branchId);
    if (existingOpen) {
      throw new BadRequestException(`Cannot mark an off day while ${existingOpen.title} is open.`);
    }

    const reason = dto.off_day_reason?.trim();
    if (!reason) {
      throw new BadRequestException('Off day reason is required.');
    }

    const existingForDate = await this.businessDayRepo.findOne({
      where: { client_id: clientId, branch_id: branchId, business_date: dto.business_date },
    });
    if (existingForDate) {
      throw new BadRequestException(`Business day ${dto.business_date} already exists for this branch.`);
    }

    const businessDay = this.businessDayRepo.create({
      client_id: clientId,
      branch_id: branchId,
      title: dto.title.trim(),
      business_date: dto.business_date,
      opened_at: this.parseOptionalDate(dto.opened_at) ?? new Date(),
      planned_closing_at: this.parseOptionalDate(dto.planned_closing_at),
      closed_at: this.parseOptionalDate(dto.planned_closing_at) ?? null,
      status: 'off_day',
      is_off_day: true,
      off_day_reason: reason,
      notes: dto.notes?.trim() || null,
      opened_by_user_id: userId,
      closed_by_user_id: userId,
    });
    const saved = await this.businessDayRepo.save(businessDay);

    await this.operationalAuditService.log({
      user,
      action: 'Business Off Day',
      entity: 'business_days',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Marked off day ${saved.title}`,
      metadata: { business_date: saved.business_date, off_day_reason: saved.off_day_reason },
    });

    return saved;
  }

  async closeBusinessDay(
    clientId: string,
    branchId: number,
    businessDayId: number,
    dto: CloseBusinessDayDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'close business day');
    const businessDay = await this.businessDayRepo.findOne({
      where: { id: businessDayId, client_id: clientId, branch_id: branchId },
    });
    if (!businessDay) {
      throw new NotFoundException('Business day not found.');
    }
    if (businessDay.status !== 'open') {
      throw new BadRequestException(`Business day is already ${businessDay.status}.`);
    }

    const actorId = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null;
    const actor = actorId
      ? await this.userRepo.findOne({ where: { id: actorId, client_id: clientId } })
      : null;

    const dayShifts = await this.shiftRepo.find({
      where: { client_id: clientId, branch_id: branchId, business_day_id: businessDay.id },
      order: { opened_at: 'ASC', id: 'ASC' },
    });
    const openBusinessDateShifts = await this.shiftRepo.find({
      where: {
        client_id: clientId,
        branch_id: branchId,
        business_date: businessDay.business_date,
        status: 'open',
      },
      order: { opened_at: 'ASC', id: 'ASC' },
    });
    const shiftsToClose = openBusinessDateShifts.length > 0 ? openBusinessDateShifts : dayShifts.filter((shift) => shift.status === 'open');
    const openShiftIds = shiftsToClose
      .filter((shift) => shift.status === 'open')
      .map((shift) => Number(shift.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (openShiftIds.length > 0) {
      const unresolvedSessionCount = await this.authorizedTillRepo.count({
        where: [
          { client_id: clientId, branch_id: branchId, shift_id: In(openShiftIds), terminal_status: 'open' },
          { client_id: clientId, branch_id: branchId, shift_id: In(openShiftIds), terminal_status: 'active' },
          { client_id: clientId, branch_id: branchId, shift_id: In(openShiftIds), terminal_status: 'blind_submitted' },
        ],
      });
      if (unresolvedSessionCount > 0) {
        throw new BadRequestException('Close all active sales counter sessions before closing the business day.');
      }
      for (const shift of shiftsToClose) {
        const refreshed = await this.refreshShiftSessionTotals(shift);
        refreshed.status = 'closed';
        refreshed.closed_at = new Date();
        refreshed.actual_end = new Date();
        refreshed.supervisor_id = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null as any;
        await this.shiftRepo.save(refreshed);
      }
    }

    const accountingClose = await this.accountingService.closeDay(
      clientId,
      branchId,
      {
        branch_id: branchId,
        business_date: businessDay.business_date,
        notes: dto.notes,
      } as any,
      user,
    );

    businessDay.status = 'closed';
    businessDay.closed_at = new Date();
    businessDay.closed_by_user_id = actorId;
    if (dto.notes?.trim()) {
      businessDay.notes = dto.notes.trim();
    }
    const saved = await this.businessDayRepo.save(businessDay);

    await this.operationalAuditService.log({
      user,
      action: 'Business Day Close',
      entity: 'business_days',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Closed business day ${saved.title}`,
      metadata: { business_date: saved.business_date },
    });

    const dayClosingReport = await this.buildBusinessDayClosingReport(
      clientId,
      branchId,
      saved,
      actor?.full_name || actor?.user_name || null,
      accountingClose,
    );

    return { business_day: saved, accounting_close: accountingClose, day_closing_report: dayClosingReport };
  }

  async getBusinessDayZReport(
    clientId: string,
    branchId: number,
    businessDayId: number,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'read business day z report');
    const businessDay = await this.businessDayRepo.findOne({
      where: { id: businessDayId, client_id: clientId, branch_id: branchId },
    });
    if (!businessDay) {
      throw new NotFoundException('Business day not found.');
    }
    const actorId = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null;
    const actor = actorId
      ? await this.userRepo.findOne({ where: { id: actorId, client_id: clientId } })
      : null;
    return this.buildBusinessDayClosingReport(
      clientId,
      branchId,
      businessDay,
      actor?.full_name || actor?.user_name || null,
      null,
    );
  }

  private async buildBusinessDayClosingReport(
    clientId: string,
    branchId: number,
    businessDay: BusinessDay,
    closedBy: string | null,
    accountingClose: any | null,
  ) {
    const dayShifts = await this.shiftRepo.find({
      where: { client_id: clientId, branch_id: branchId, business_day_id: businessDay.id },
      order: { opened_at: 'ASC', id: 'ASC' },
    });
    const dayShiftIds = dayShifts
      .map((shift) => Number(shift.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const daySessions = dayShiftIds.length === 0
      ? []
      : await this.authorizedTillRepo.find({
        where: dayShiftIds.map((shiftId) => ({ client_id: clientId, branch_id: branchId, shift_id: shiftId })),
        relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
        order: { created_at: 'ASC', id: 'ASC' },
      });

    const unresolvedStatuses = new Set(['open', 'active', 'blind_submitted']);
    const unresolvedDaySessions = daySessions.filter((session) => unresolvedStatuses.has(String(session.terminal_status || '').toLowerCase()));
    if (unresolvedDaySessions.length > 0) {
      throw new BadRequestException('Business day cannot be closed until all sales counters are fully closed.');
    }

    const counterReports = await Promise.all(
      daySessions.map((session) => this.getCounterSessionXReport(clientId, branchId, session.id)),
    );

    const summedOrders = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.total_orders || 0), 0);
    const summedDiscounts = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.discount_amount || 0), 0));
    const summedReturns = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.returned_amount || 0), 0));
    const summedGross = this.roundCurrency(counterReports.reduce((sum, report) => {
      const orderTypeGross = Array.isArray(report?.sections?.order_type_summary)
        ? report.sections.order_type_summary.reduce((inner: number, row: any) => inner + Number(row?.amount || 0), 0)
        : 0;
      return sum + orderTypeGross;
    }, 0));
    const summedNetSales = this.roundCurrency(
      accountingClose
        ? Number(accountingClose?.net_sales_amount || 0)
        : Math.max(summedGross - summedReturns - summedDiscounts, 0),
    );
    const summedExpenses = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.expense_summary?.total_expense || 0), 0));
    const summedVariance = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_actual_vs_expected?.variance || 0), 0));
    const summedCash = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.cash_sale || 0), 0));
    const summedCard = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.credit_card_sale || 0), 0));
    const summedOnline = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.online_payment_sale || 0), 0));
    const summedWalletSale = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.wallet_sale || 0), 0));
    const summedTotalSale = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.total_sale || 0), 0));
    const summedCustomers = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.customer_count || 0), 0);
    const summedKots = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.total_kots || 0), 0);
    const summedVoidedOrders = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.voided_orders || 0), 0);
    const summedVoidedAmount = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.voided_amount || 0), 0));
    const summedReturnedOrders = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.returned_orders || 0), 0);
    const summedCompletedOrders = counterReports.reduce((sum, report) => sum + Number(report?.sections?.pos_summary?.completed_orders || 0), 0);
    const summedExpectedCash = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_actual_vs_expected?.expected_cash || 0), 0));
    const summedActualCash = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_actual_vs_expected?.actual_cash || 0), 0));
    const summedOpeningCash = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_summary?.opening_cash || 0), 0));
    const summedCashRefund = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_summary?.cash_refund || 0), 0));
    const summedCashInHand = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.cash_summary?.total_cash_in_hand || 0), 0));
    const summedCreditSales = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.credit_summary?.total_credited_sale_today || 0), 0));
    const summedCreditedOrders = counterReports.reduce((sum, report) => sum + Number(report?.sections?.credit_summary?.credited_orders_count || 0), 0);
    const summedPendingCredit = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.credit_summary?.previously_pending_credit || 0), 0));
    const summedCreditReceived = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.credit_summary?.credited_amount_received || 0), 0));
    const summedNetCreditBalance = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.credit_summary?.net_credit_balance || 0), 0));
    const summedWalletUsed = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.wallet_summary?.wallet_used_today || 0), 0));
    const summedWalletAdded = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.wallet_summary?.added_in_wallet_today || 0), 0));
    const summedWalletClosing = this.roundCurrency(counterReports.reduce((sum, report) => sum + Number(report?.sections?.wallet_summary?.current_closing_balance || 0), 0));

    const orderTypeMap = new Map<string, { orders: number; amount: number }>();
    const soldItemsMap = new Map<string, { qty: number; gross_sale: number; returns_qty: number; returned_amount: number; net_sale: number }>();
    const stationMap = new Map<string, { orders: number; sales_amount: number }>();

    for (const report of counterReports) {
      for (const row of Array.isArray(report?.sections?.order_type_summary) ? report.sections.order_type_summary : []) {
        const key = String(row?.type || 'other');
        const bucket = orderTypeMap.get(key) ?? { orders: 0, amount: 0 };
        bucket.orders += Number(row?.orders || 0);
        bucket.amount += Number(row?.amount || 0);
        orderTypeMap.set(key, bucket);
      }

      for (const row of Array.isArray(report?.sections?.sold_items_summary) ? report.sections.sold_items_summary : []) {
        const key = String(row?.item || 'Item');
        const bucket = soldItemsMap.get(key) ?? { qty: 0, gross_sale: 0, returns_qty: 0, returned_amount: 0, net_sale: 0 };
        bucket.qty += Number(row?.qty || 0);
        bucket.gross_sale += Number(row?.gross_sale || 0);
        bucket.returns_qty += Number(row?.returns_qty || 0);
        bucket.returned_amount += Number(row?.returned_amount || 0);
        bucket.net_sale += Number(row?.net_sale || 0);
        soldItemsMap.set(key, bucket);
      }

      for (const row of Array.isArray(report?.sections?.station_wise_sale) ? report.sections.station_wise_sale : []) {
        const key = String(row?.station || 'Prep Station');
        const bucket = stationMap.get(key) ?? { orders: 0, sales_amount: 0 };
        bucket.orders += Number(row?.orders || 0);
        bucket.sales_amount += Number(row?.sales_amount || 0);
        stationMap.set(key, bucket);
      }
    }

    const orderTypeSummary = Array.from(orderTypeMap.entries())
      .map(([type, values]) => ({
        type,
        orders: values.orders,
        amount: this.roundCurrency(values.amount),
      }))
      .sort((left, right) => right.amount - left.amount);

    const soldItemsSummary = Array.from(soldItemsMap.entries())
      .map(([item, values]) => ({
        item,
        qty: values.qty,
        gross_sale: this.roundCurrency(values.gross_sale),
        returns_qty: values.returns_qty,
        returned_amount: this.roundCurrency(values.returned_amount),
        net_sale: this.roundCurrency(values.net_sale),
      }))
      .sort((left, right) => right.net_sale - left.net_sale)
      .slice(0, 15);

    const stationWiseSale = Array.from(stationMap.entries())
      .map(([station, values]) => ({
        station,
        orders: values.orders,
        sales_amount: this.roundCurrency(values.sales_amount),
      }))
      .sort((left, right) => right.sales_amount - left.sales_amount);

    const counterSummaries = daySessions.map((session, index) => {
      const report = counterReports[index];
      return {
        counter_name: session.sale_counter?.name || `Counter #${session.sale_counter_id}`,
        cashier_name: session.user?.full_name || session.user?.user_name || 'Unassigned',
        status: this.normalizeSessionStatus(session.terminal_status),
        opening_cash: this.roundCurrency(Number(session.opening_verified_cash ?? session.assigned_float ?? 0)),
        orders: Number(report?.sections?.pos_summary?.total_orders || 0),
        net_sales: this.roundCurrency(
          Array.isArray(report?.sections?.order_type_summary)
            ? report.sections.order_type_summary.reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0)
            : Number(report?.sections?.pos_summary?.total_sale || 0),
        ),
        expected_cash: this.roundCurrency(Number(report?.sections?.cash_actual_vs_expected?.expected_cash || 0)),
        actual_cash: this.roundCurrency(Number(report?.sections?.cash_actual_vs_expected?.actual_cash || 0)),
        variance: this.roundCurrency(Number(report?.sections?.cash_actual_vs_expected?.variance || 0)),
        opened_at: report?.session_window?.opened_at || session.activated_at || session.opening_verified_at || session.created_at,
        closed_at: report?.session_window?.closed_at || session.reconciled_at || session.blind_submitted_at || null,
      };
    });

    return {
      business_day_title: businessDay.title,
      business_date: businessDay.business_date,
      opened_at: businessDay.opened_at,
      closed_at: businessDay.closed_at,
      closed_by: closedBy,
      notes: businessDay.notes || null,
      sales_counter_count: daySessions.length,
      closed_counter_count: daySessions.length,
      orders: Number(accountingClose?.order_count || summedOrders || 0),
      gross: this.roundCurrency(Number(accountingClose?.gross_sales_amount || summedGross || 0)),
      discounts: this.roundCurrency(Number(accountingClose?.discount_amount || summedDiscounts || 0)),
      returns: this.roundCurrency(
        accountingClose
          ? Math.max(Number(accountingClose?.gross_sales_amount || 0) - Number(accountingClose?.discount_amount || 0) - Number(accountingClose?.net_sales_amount || 0), 0)
          : summedReturns,
      ),
      net: this.roundCurrency(Number(accountingClose?.net_sales_amount || summedNetSales || 0)),
      payments: {
        cash: this.roundCurrency(Number(accountingClose?.cash_sales_amount || summedCash || 0)),
        card: this.roundCurrency((Number(accountingClose?.card_sales_amount || 0) + Number(accountingClose?.bank_sales_amount || 0)) || summedCard),
        online: this.roundCurrency((Number(accountingClose?.digital_wallet_sales_amount || 0) + Number(accountingClose?.other_payment_sales_amount || 0)) || summedOnline),
      },
      sections: {
        cash_summary: {
          opening_cash: summedOpeningCash,
          net_cash_sale: this.roundCurrency(summedCash - summedCashRefund),
          cash_sale: summedCash,
          cash_expense: summedExpenses,
          cash_refund: summedCashRefund,
          total_cash_in_hand: summedCashInHand,
        },
        cash_actual_vs_expected: {
          expected_cash: summedExpectedCash,
          actual_cash: summedActualCash,
          variance: this.roundCurrency(Number(accountingClose?.cash_variance_amount ?? summedVariance)),
        },
        pos_summary: {
          cash_sale: summedCash,
          online_payment_sale: summedOnline,
          credit_card_sale: summedCard,
          wallet_sale: summedWalletSale,
          total_sale: summedTotalSale,
          returned_orders: summedReturnedOrders,
          returned_amount: this.roundCurrency(
            accountingClose
              ? Math.max(Number(accountingClose?.gross_sales_amount || 0) - Number(accountingClose?.discount_amount || 0) - Number(accountingClose?.net_sales_amount || 0), 0)
              : summedReturns,
          ),
          customer_count: summedCustomers,
          total_orders: Number(accountingClose?.order_count || summedOrders || 0),
          total_kots: summedKots,
          discount_amount: this.roundCurrency(Number(accountingClose?.discount_amount || summedDiscounts || 0)),
          voided_orders: summedVoidedOrders,
          voided_amount: summedVoidedAmount,
          completed_orders: summedCompletedOrders,
        },
        wallet_summary: {
          wallet_used_today: summedWalletUsed,
          added_in_wallet_today: summedWalletAdded,
          current_closing_balance: summedWalletClosing,
        },
        credit_summary: {
          total_credited_sale_today: summedCreditSales,
          credited_orders_count: summedCreditedOrders,
          previously_pending_credit: summedPendingCredit,
          credited_amount_received: summedCreditReceived,
          net_credit_balance: summedNetCreditBalance,
        },
        expense_summary: {
          expense_from_cash_counter: summedExpenses,
          sales_expense_ratio: summedCash > 0
            ? this.roundCurrency((summedExpenses / summedCash) * 100)
            : 0,
          total_expense: summedExpenses,
        },
        order_type_summary: orderTypeSummary,
        sold_items_summary: soldItemsSummary,
        station_wise_sale: stationWiseSale,
      },
      expenses: this.roundCurrency(
        accountingClose
          ? Number(accountingClose?.inventory_issue_cost_amount || 0) + Number(accountingClose?.wastage_cost_amount || 0)
          : summedExpenses,
      ),
      variance: this.roundCurrency(Number(accountingClose?.cash_variance_amount ?? summedVariance)),
      counters: counterSummaries,
      printed_at: new Date(),
      print_id: accountingClose?.id || businessDay.id,
    };
  }

  async startOperatingShift(
    clientId: string,
    branchId: number,
    userId: number,
    dto: StartOperatingShiftDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'start operating shift');
    const businessDay = await this.requireActiveBusinessDay(clientId, branchId);
    const template = await this.shiftTemplateRepo.findOne({
      where: { id: dto.shift_template_id, client_id: clientId, branch_id: branchId, is_active: true },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found for this branch.');
    }

    if (!template.allow_overlap) {
      const duplicateOpen = await this.shiftRepo.findOne({
        where: {
          client_id: clientId,
          branch_id: branchId,
          business_day_id: businessDay.id,
          shift_template_id: template.id,
          status: 'open',
        },
      });
      if (duplicateOpen) {
        throw new BadRequestException(`Shift ${template.name} is already open for this business day.`);
      }
    }

    const { plannedStart, plannedEnd } = this.computeShiftWindow(businessDay.business_date, template);
    const shift = this.shiftRepo.create({
      client_id: clientId,
      branch_id: branchId,
      business_day_id: businessDay.id,
      shift_template_id: template.id,
      user_id: userId,
      external_shift_id: null,
      source_device_id: null,
      source_device_uid: null,
      sync_origin: 'online',
      opening_float: 0,
      expected_cash: 0,
      actual_cash: 0,
      variance: 0,
      status: 'open',
      opened_at: new Date(),
      closed_at: null,
      business_date: businessDay.business_date,
      is_day_open: true,
      shift_name: template.name,
      shift_code: template.code,
      shift_order: template.sort_order,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      actual_start: new Date(),
      actual_end: null,
      supervisor_id: null as any,
    });
    const saved = await this.shiftRepo.save(shift);

    await this.operationalAuditService.log({
      user,
      action: 'Operating Shift Start',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Started shift ${saved.shift_name}`,
      metadata: { business_day_id: businessDay.id, shift_template_id: template.id },
    });

    return saved;
  }

  async updateOperatingShift(
    clientId: string,
    branchId: number,
    shiftId: number,
    dto: UpdateOperatingShiftDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'adjust operating shift');
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, client_id: clientId, branch_id: branchId },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }
    if (shift.status !== 'open') {
      throw new BadRequestException('Only open shifts can be adjusted.');
    }

    const nextName = dto.shift_name !== undefined ? dto.shift_name.trim() : shift.shift_name;
    if (dto.shift_name !== undefined && !nextName) {
      throw new BadRequestException('Shift name is required.');
    }

    const nextPlannedStart = dto.planned_start !== undefined
      ? this.parseOptionalDate(dto.planned_start)
      : shift.planned_start;
    const nextPlannedEnd = dto.planned_end !== undefined
      ? this.parseOptionalDate(dto.planned_end)
      : shift.planned_end;

    if (dto.planned_start !== undefined && !nextPlannedStart) {
      throw new BadRequestException('Planned start is invalid.');
    }
    if (dto.planned_end !== undefined && !nextPlannedEnd) {
      throw new BadRequestException('Planned end is invalid.');
    }
    if (nextPlannedStart && nextPlannedEnd && nextPlannedEnd <= nextPlannedStart) {
      throw new BadRequestException('Planned end must be later than planned start.');
    }

    const previousValues = {
      shift_name: shift.shift_name,
      planned_start: shift.planned_start,
      planned_end: shift.planned_end,
    };

    if (dto.shift_name !== undefined) {
      shift.shift_name = nextName || shift.shift_name;
    }
    if (dto.planned_start !== undefined) {
      shift.planned_start = nextPlannedStart;
    }
    if (dto.planned_end !== undefined) {
      shift.planned_end = nextPlannedEnd;
    }

    const saved = await this.shiftRepo.save(shift);

    await this.operationalAuditService.log({
      user,
      action: 'Operating Shift Update',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Updated shift ${saved.shift_name ?? saved.id}`,
      metadata: {
        previous: previousValues,
        current: {
          shift_name: saved.shift_name,
          planned_start: saved.planned_start,
          planned_end: saved.planned_end,
        },
      },
    });

    return saved;
  }

  async endOperatingShift(clientId: string, branchId: number, shiftId: number, user?: JwtPayload) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'end operating shift');
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, client_id: clientId, branch_id: branchId },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }
    if (shift.status === 'closed') {
      throw new BadRequestException('Shift is already closed.');
    }

    const unresolvedSessions = await this.authorizedTillRepo.count({
      where: [
        { client_id: clientId, branch_id: branchId, shift_id: shift.id, terminal_status: 'open' },
        { client_id: clientId, branch_id: branchId, shift_id: shift.id, terminal_status: 'active' },
        { client_id: clientId, branch_id: branchId, shift_id: shift.id, terminal_status: 'blind_submitted' },
      ],
    });
    if (unresolvedSessions > 0) {
      throw new BadRequestException('All counter sessions must be verified closed before ending the shift.');
    }

    const refreshed = await this.refreshShiftSessionTotals(shift);
    refreshed.status = 'closed';
    refreshed.closed_at = new Date();
    refreshed.actual_end = new Date();
    refreshed.supervisor_id = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null as any;
    const saved = await this.shiftRepo.save(refreshed);

    await this.operationalAuditService.log({
      user,
      action: 'Operating Shift End',
      entity: 'shifts',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Ended shift ${saved.shift_name ?? saved.id}`,
      metadata: { variance: saved.variance, expected_cash: saved.expected_cash, actual_cash: saved.actual_cash },
    });

    return saved;
  }

  async assignCounterSession(
    clientId: string,
    branchId: number,
    shiftId: number,
    dto: AssignCounterSessionDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'assign counter sessions');
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, client_id: clientId, branch_id: branchId, status: 'open' },
      relations: ['business_day'],
    });
    if (!shift) {
      throw new NotFoundException('Open shift not found.');
    }
    if (!shift.business_day_id || shift.business_day?.status !== 'open') {
      throw new BadRequestException('Counter sessions can only be assigned inside an open business day.');
    }

    await this.assertSaleCounterBelongsToBranch(clientId, branchId, dto.sale_counter_id);
    await this.requireBranchStaff(clientId, dto.user_id);
    const saved = await this.dataSource.transaction(async (manager) => {
      const lockedShift = await manager.getRepository(Shift)
        .createQueryBuilder('shift')
        .setLock('pessimistic_write')
        .where('shift.id = :shiftId', { shiftId })
        .andWhere('shift.client_id = :clientId', { clientId })
        .andWhere('shift.branch_id = :branchId', { branchId })
        .andWhere('shift.status = :status', { status: 'open' })
        .getOne();

      if (!lockedShift) {
        throw new NotFoundException('Open shift not found.');
      }

      const activeStatuses: AuthorizedTill['terminal_status'][] = ['open', 'active', 'blind_submitted'];
      const sessionRepo = manager.getRepository(AuthorizedTill);

      const existingCounterSessions = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('session.shift', 'shift')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.sale_counter_id = :saleCounterId', { saleCounterId: dto.sale_counter_id })
        .andWhere('session.terminal_status IN (:...statuses)', { statuses: activeStatuses })
        .getMany();
      const overlappingCounterSession = existingCounterSessions.find((session) => this.shiftWindowsOverlap(lockedShift, session.shift));
      if (overlappingCounterSession) {
        throw new BadRequestException('This sales counter already has an overlapping active or pending-verification session in this branch.');
      }

      const existingCashierSessions = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('session.shift', 'shift')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.user_id = :userId', { userId: dto.user_id })
        .andWhere('session.terminal_status IN (:...statuses)', { statuses: activeStatuses })
        .getMany();
      const overlappingCashierSession = existingCashierSessions.find((session) => this.shiftWindowsOverlap(lockedShift, session.shift));
      if (overlappingCashierSession) {
        throw new BadRequestException('This cashier already has an overlapping active or pending-verification counter session in this branch.');
      }

      const session = sessionRepo.create({
        client_id: clientId,
        branch_id: branchId,
        shift_id: lockedShift.id,
        sale_counter_id: dto.sale_counter_id,
        user_id: dto.user_id,
        assigned_float: this.ensureNonNegativeMoney(dto.assigned_float, 'Assigned float'),
        opening_verified_cash: null,
        opening_verified_at: null,
        opening_verified_by_user_id: null,
        terminal_status: 'open',
        activated_at: null,
        blind_submitted_at: null,
        reconciled_at: null,
        reconciled_by_user_id: null,
        blind_count: null,
        expected_cash: null,
        variance: null,
        reconciliation_notes: null,
      });

      return sessionRepo.save(session);
    });

    await this.operationalAuditService.log({
      user,
      action: 'Counter Session Assigned',
      entity: 'authorized_tills',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Assigned counter ${dto.sale_counter_id} to cashier ${dto.user_id}`,
      metadata: { shift_id: shift.id, assigned_float: saved.assigned_float },
    });

    return this.requireCounterSession(clientId, branchId, saved.id, ['sale_counter', 'user', 'shift', 'shift.business_day'])
      .then((row) => this.formatCounterSession(row));
  }

  async reassignCounterSession(
    clientId: string,
    branchId: number,
    sessionId: number,
    dto: AssignCounterSessionDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'reassign counter sessions');
    await this.assertSaleCounterBelongsToBranch(clientId, branchId, dto.sale_counter_id);
    await this.requireBranchStaff(clientId, dto.user_id);
    const saved = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AuthorizedTill);
      const row = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('session.shift', 'shift')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .getOne();

      if (!row) {
        throw new NotFoundException('Counter session was not found.');
      }
      if (row.terminal_status !== 'open') {
        throw new BadRequestException('Only assigned counter sessions can be reassigned.');
      }

      const activeStatuses: AuthorizedTill['terminal_status'][] = ['open', 'active', 'blind_submitted'];
      const duplicateCounterSessions = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('session.shift', 'shift')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.sale_counter_id = :saleCounterId', { saleCounterId: dto.sale_counter_id })
        .andWhere('session.terminal_status IN (:...statuses)', { statuses: activeStatuses })
        .andWhere('session.id <> :sessionId', { sessionId: row.id })
        .getMany();
      const overlappingCounterSession = duplicateCounterSessions.find((session) => this.shiftWindowsOverlap(row.shift, session.shift));
      if (overlappingCounterSession) {
        throw new BadRequestException('This sales counter already has an overlapping active or pending-verification session in this branch.');
      }

      const duplicateCashierSessions = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('session.shift', 'shift')
        .where('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .andWhere('session.user_id = :userId', { userId: dto.user_id })
        .andWhere('session.terminal_status IN (:...statuses)', { statuses: activeStatuses })
        .andWhere('session.id <> :sessionId', { sessionId: row.id })
        .getMany();
      const overlappingCashierSession = duplicateCashierSessions.find((session) => this.shiftWindowsOverlap(row.shift, session.shift));
      if (overlappingCashierSession) {
        throw new BadRequestException('This cashier already has another overlapping active or pending-verification session in this branch.');
      }

      row.sale_counter_id = dto.sale_counter_id;
      row.user_id = dto.user_id;
      row.assigned_float = this.ensureNonNegativeMoney(dto.assigned_float, 'Assigned float');
      row.opening_verified_cash = null;
      row.opening_verified_at = null;
      row.opening_verified_by_user_id = null;
      row.activated_at = null;

      return sessionRepo.save(row);
    });

    await this.operationalAuditService.log({
      user,
      action: 'Counter Session Reassigned',
      entity: 'authorized_tills',
      clientId,
      branchId,
      entityId: saved.id,
      portal: 'Terminal',
      details: `Reassigned counter session ${saved.id}`,
      metadata: { sale_counter_id: saved.sale_counter_id, user_id: saved.user_id },
    });

    return this.requireCounterSession(clientId, branchId, saved.id, ['sale_counter', 'user', 'shift', 'shift.business_day'])
      .then((session) => this.formatCounterSession(session));
  }

  async unassignCounterSession(
    clientId: string,
    branchId: number,
    sessionId: number,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'unassign counter sessions');
    const row = await this.requireCounterSession(clientId, branchId, sessionId, ['sale_counter', 'user', 'shift', 'shift.business_day']);

    if (row.terminal_status !== 'open') {
      throw new BadRequestException('Only assigned counter sessions that have not been opened can be unassigned.');
    }
    if (row.opening_verified_at || row.activated_at || row.blind_submitted_at || row.reconciled_at) {
      throw new BadRequestException('This counter session has already progressed and can no longer be unassigned.');
    }

    await this.authorizedTillRepo.remove(row);

    await this.operationalAuditService.log({
      user,
      action: 'Counter Session Unassigned',
      entity: 'authorized_tills',
      clientId,
      branchId,
      entityId: sessionId,
      portal: 'Terminal',
      details: `Unassigned counter ${row.sale_counter_id} from cashier ${row.user_id} before opening.`,
      metadata: { shift_id: row.shift_id, sale_counter_id: row.sale_counter_id, user_id: row.user_id },
    });

    return { id: sessionId, status: 'unassigned' };
  }

  async getMyCounterSession(clientId: string, branchId: number, userId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const sessions = await this.authorizedTillRepo.find({
      where: { client_id: clientId, branch_id: branchId, user_id: userId },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
      order: { created_at: 'DESC', id: 'DESC' },
      take: 20,
    });

    const session = sessions.find((row) => row.terminal_status === 'active')
      ?? sessions.find((row) => row.terminal_status === 'open')
      ?? sessions.find((row) => row.terminal_status === 'blind_submitted')
      ?? null;

    return session ? this.formatCounterSession(session) : null;
  }

  async getMyCounterSessions(clientId: string, branchId: number, userId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const sessions = await this.authorizedTillRepo.find({
      where: { client_id: clientId, branch_id: branchId, user_id: userId },
      relations: ['sale_counter', 'user', 'shift', 'shift.business_day'],
      order: { created_at: 'DESC', id: 'DESC' },
      take: 20,
    });

    return sessions
      .filter((row) => ['open', 'active', 'blind_submitted'].includes(row.terminal_status))
      .map((row) => this.formatCounterSession(row));
  }

  async verifyCounterOpening(
    clientId: string,
    branchId: number,
    sessionId: number,
    userId: number,
    dto: VerifyCounterOpeningDto,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const saved = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AuthorizedTill);
      const row = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .getOne();

      if (!row) {
        throw new NotFoundException('Counter session was not found.');
      }
      if (row.user_id && row.user_id !== userId) {
        throw new ForbiddenException('This counter session is assigned to another cashier.');
      }
      if (row.terminal_status !== 'open') {
        throw new BadRequestException(`Counter session is already ${this.normalizeSessionStatus(row.terminal_status)}.`);
      }

      row.user_id = userId;
      row.opening_verified_cash = this.ensureNonNegativeMoney(dto.verified_opening_cash, 'Verified opening cash');
      row.opening_verified_at = new Date();
      row.opening_verified_by_user_id = userId;
      row.activated_at = new Date();
      row.terminal_status = 'active';
      return sessionRepo.save(row);
    });

    return this.formatCounterSession(saved);
  }

  async blindCloseCounterSession(
    clientId: string,
    branchId: number,
    sessionId: number,
    userId: number,
    dto: SubmitBlindCountDto,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const saved = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AuthorizedTill);
      const row = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .getOne();

      if (!row) {
        throw new NotFoundException('Counter session was not found.');
      }
      if (row.user_id && row.user_id !== userId) {
        throw new ForbiddenException('Only the assigned cashier can close this counter session.');
      }
      if (row.terminal_status !== 'active') {
        throw new BadRequestException('Only open counter sessions can be closed.');
      }
      await this.assertCounterSessionHasNoOpenOrders(row);
      await this.assertCounterSessionHasNoOpenKots(row);

      const cashierUsername = dto.cashier_username?.trim();
      const cashierPin = dto.cashier_pin?.trim();
      if (!cashierUsername || !cashierPin) {
        throw new ForbiddenException('Cashier username and PIN are required to close this counter session.');
      }
      if (!row.user_id) {
        throw new ForbiddenException('This counter session does not have an assigned cashier.');
      }
      const cashier = await manager.getRepository(UserManagement).findOne({
        where: { id: row.user_id, client_id: clientId, status: 'active', is_active: true },
      });
      if (!cashier || !cashier.pos_user_pin?.trim()) {
        throw new ForbiddenException('Cashier PIN is not configured for this user.');
      }
      const normalizedCashier = this.normalizeMatchToken(cashierUsername);
      const cashierTokens = [
        cashier.user_name,
        cashier.full_name,
        cashier.employee_id,
      ].map((value) => this.normalizeMatchToken(value)).filter(Boolean);
      if (!cashierTokens.includes(normalizedCashier)) {
        throw new ForbiddenException('Cashier username does not match the assigned cashier.');
      }
      if (cashier.pos_user_pin.trim() !== cashierPin) {
        throw new ForbiddenException('Cashier PIN verification failed.');
      }

      const authorizedUsername = dto.authorized_username?.trim() || dto.supervisor_username?.trim();
      const authorizedPin = dto.authorized_pin?.trim() || dto.supervisor_pin?.trim();
      if (!authorizedUsername || !authorizedPin) {
        throw new ForbiddenException('Authorized user ID and PIN are required to close this counter session.');
      }
      const supervisor = await this.requireAuthorizedCounterCloseUser(
        clientId,
        branchId,
        cashier.id,
        authorizedUsername,
        authorizedPin,
      );

      row.blind_count = this.ensureNonNegativeMoney(dto.blind_count, 'Blind count');
      row.blind_submitted_at = new Date();
      const cashTotals = await this.calculateCounterSessionCash(row, clientId, branchId);
      row.expected_cash = cashTotals.expectedCash;
      row.variance = cashTotals.variance;
      row.terminal_status = 'closed';
      row.reconciled_at = row.blind_submitted_at;
      row.reconciled_by_user_id = supervisor.id;
      if (dto.notes) {
        row.reconciliation_notes = dto.notes.trim();
      }
      const saved = await sessionRepo.save(row);
      const businessDate = await this.resolveCounterSessionBusinessDate(saved, manager);
      const safeHandover = await this.accountingService.createCounterCloseSafeHandover(
        clientId,
        branchId,
        Number(saved.blind_count || 0),
        businessDate,
        `COUNTER-CLOSE-${saved.id}`,
        `Automatic branch-safe handover for counter close ${saved.sale_counter?.name ?? `#${saved.sale_counter_id}`}`,
      );
      return {
        ...saved,
        safe_handover_journal_id: safeHandover?.journal?.id ?? null,
      } as AuthorizedTill;
    });

    return this.formatCounterSession(saved);
  }

  async verifyCounterClosing(
    clientId: string,
    branchId: number,
    sessionId: number,
    dto: VerifyCounterClosingDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'verify blind close');
    const actorId = user?.sub ? (typeof user.sub === 'string' ? parseInt(user.sub) : user.sub) : null;
    if (!actorId) {
      throw new ForbiddenException('Supervisor verification requires an authenticated user.');
    }

    const supervisor = await this.userRepo.findOne({
      where: { id: actorId, client_id: clientId, status: 'active', is_active: true },
    });
    const effectiveClosePin = supervisor?.management_pin?.trim() || '';
    if (!supervisor || !effectiveClosePin) {
      throw new ForbiddenException('Counter close PIN is not configured for this user.');
    }
    const authorizedUsername = dto.authorized_username?.trim();
    if (!authorizedUsername) {
      throw new ForbiddenException('Authorized username is required for counter close verification.');
    }
    const normalizedAuthorizedUsername = this.normalizeMatchToken(authorizedUsername);
    const allowedSupervisorTokens = [
      supervisor.user_name,
      supervisor.full_name,
      supervisor.employee_id,
    ]
      .map((value) => this.normalizeMatchToken(value))
      .filter(Boolean);
    if (!allowedSupervisorTokens.includes(normalizedAuthorizedUsername)) {
      throw new ForbiddenException('Authorized username does not match the signed-in supervisor.');
    }
    if (effectiveClosePin !== dto.supervisor_pin.trim()) {
      throw new ForbiddenException('Counter close PIN verification failed.');
    }

    const closeResult = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AuthorizedTill);
      const row = await sessionRepo.createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.client_id = :clientId', { clientId })
        .andWhere('session.branch_id = :branchId', { branchId })
        .getOne();

      if (!row) {
        throw new NotFoundException('Counter session was not found.');
      }
      if (row.terminal_status !== 'blind_submitted') {
        throw new BadRequestException('Counter session is not awaiting blind-close verification.');
      }
      if (row.blind_count === null) {
        throw new BadRequestException('Blind closing amount is missing for this counter session.');
      }
      const closingComment = dto.reconciliation_notes?.trim();
      if (!closingComment) {
        throw new BadRequestException('Enter a closing comment before final counter close.');
      }

      const { expectedCash, variance } = await this.calculateCounterSessionCash(row, clientId, branchId);
      row.expected_cash = expectedCash;
      row.variance = variance;
      row.terminal_status = 'closed';
      row.reconciled_at = new Date();
      row.reconciled_by_user_id = actorId;
      row.reconciliation_notes = closingComment;

      const closedSession = await sessionRepo.save(row);
      return { closedSession, expectedCash, variance };
    });
    const { closedSession, expectedCash, variance } = closeResult;

    const shift = await this.shiftRepo.findOne({
      where: { id: closedSession.shift_id, client_id: clientId, branch_id: branchId },
    });
    if (shift) {
      await this.refreshShiftSessionTotals(shift);
    }

    await this.operationalAuditService.log({
      user,
      action: 'Counter Session Verified Close',
      entity: 'authorized_tills',
      clientId,
      branchId,
      entityId: closedSession.id,
      portal: 'Terminal',
      details: `Verified blind close for counter session ${closedSession.id}`,
      metadata: { expected_cash: expectedCash, blind_count: closedSession.blind_count, variance, reconciliation_notes: closedSession.reconciliation_notes },
    });

    return this.formatCounterSession(closedSession);
  }

  async getShiftAnalytics(clientId: string, branchId: number, shiftId: number): Promise<any> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, client_id: clientId, branch_id: branchId },
      relations: ['sale_counter'],
    });

    if (!shift) throw new NotFoundException('Shift not found');

    const orders = await this.orderRepo.find({
      where: { shift_id: shiftId, client_id: clientId, branch_id: branchId },
      relations: ['items', 'items.product', 'transactions', 'returns'],
    });

    const summary = {
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.order_status === 'completed').length,
      cancelledOrders: orders.filter(o => o.order_status === 'cancelled' || o.order_status === 'voided').length,
      returnedOrders: orders.filter(o => o.returns && o.returns.length > 0).length,
      totalSales: 0,
      totalReturns: 0,
      totalCancelled: 0,
      paymentMethods: {} as Record<string, number>,
    };

    const productStats: Record<string, { qty: number; amt: number }> = {};
    const typeStats: Record<string, { count: number; amt: number }> = {};

    for (const order of orders) {
        const amt = Number(order.total_amount);

        if (order.order_status === 'completed') {
            summary.totalSales += amt;
            
            // Payment breakdown
            for (const tx of order.transactions || []) {
                if (!tx.is_refund) {
                    const mode = tx.payment_mode || 'cash';
                    summary.paymentMethods[mode] = (summary.paymentMethods[mode] || 0) + Number(tx.amount);
                }
            }
        } else if (order.order_status === 'cancelled' || order.order_status === 'voided') {
            summary.totalCancelled += amt;
        }

        if (order.returns && order.returns.length > 0) {
            summary.totalReturns += order.returns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
        }

        // Type stats
        const typeLabel = order.order_type === 'dine_in' ? 'Dine-in' : (order.order_type === 'takeout' ? 'Takeaway' : 'Delivery');
        if (!typeStats[typeLabel]) typeStats[typeLabel] = { count: 0, amt: 0 };
        typeStats[typeLabel].count++;
        typeStats[typeLabel].amt += amt;

        // Product stats
        for (const item of order.items || []) {
            const name = item.product_name || item.product?.product_name || 'Unknown Item';
            const itemSubtotal = Number(item.item_price) * Number(item.quantity);
            if (!productStats[name]) productStats[name] = { qty: 0, amt: 0 };
            productStats[name].qty += Number(item.quantity);
            productStats[name].amt += itemSubtotal;
        }
    }

    return {
      summary,
      productWise: Object.entries(productStats).map(([name, data]) => ({ name, ...data })),
      orderTypes: Object.entries(typeStats).map(([type, data]) => ({ type, ...data })),
      shiftInfo: {
          counter_name: shift.sale_counter?.name || 'Main Counter',
          opened_at: shift.opened_at,
          closed_at: shift.closed_at
      }
    };
  }

  async createTable(
    clientId: string,
    branchId: number,
    dto: CreatePosTableDto,
  ): Promise<KitchenTableEntity> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'create POS tables');
    if (!dto.floor_id) {
      throw new BadRequestException('floor_id is required to create a POS table');
    }
    await this.assertFloorBelongsToBranch(branchId, dto.floor_id);

    const table = this.tableRepo.create({
      branch_id: branchId,
      ...dto,
    });
    return this.tableRepo.save(table);
  }

  async updateTableStatus(
    clientId: string,
    branchId: number,
    tableId: number,
    status: string,
  ): Promise<KitchenTableEntity> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update POS tables');
    const table = await this.assertTableBelongsToBranch(branchId, tableId);
    if (!table) throw new NotFoundException('Table not found.');

    table.status = status;
    return this.tableRepo.save(table);
  }

  async createOrder(
    clientId: string,
    branchId: number,
    userId: number,
    dto: CreatePosOrderDto,
  ): Promise<any> {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'create POS orders');
    const shift = await this.requireOpenShift(clientId, branchId);
    const orderType = this.normalizeOrderType(dto.order_type);
    const orderStatus = this.normalizeOrderStatus(dto.order_status);
    if (!['held', 'pending'].includes(orderStatus)) {
      throw new BadRequestException('New POS orders can only start as held or pending.');
    }
    const saleCounter = await this.assertSaleCounterBelongsToBranch(
      clientId,
      branchId,
      dto.sale_counter_id,
    );

    let table: KitchenTableEntity | null = null;
    if (dto.table_id) {
      table = await this.assertTableBelongsToBranch(branchId, dto.table_id);
    }

    if (orderType === 'dine_in' && !table) {
      throw new BadRequestException('Dine-in orders require a branch table.');
    }

    if (orderType === 'dine_in' && table) {
      table.status = 'occupied';
      await this.tableRepo.save(table);
    }

    const orderTakerUser = dto.order_taker_user_id
      ? await this.requireBranchStaff(clientId, dto.order_taker_user_id)
      : null;
    const deliveryDetails = orderType === 'delivery'
      ? this.normalizeDeliveryDetails(dto.delivery_details)
      : null;

    const order = this.orderRepo.create({
      client_id: clientId,
      branch_id: branchId,
      user_id: orderTakerUser?.id ?? userId,
      shift_id: shift.id,
      sale_counter_id: saleCounter?.id ?? null,
      customer_id: dto.customer_id,
      table_id: table?.id ?? null,
      order_type: orderType,
      order_number: dto.order_number ?? await this.generateOrderNumber(clientId, branch, saleCounter?.id ?? null),
      order_status: orderStatus,
      sub_total: 0,
      tax_amount: 0,
      discount_amount: this.ensureNonNegativeMoney(dto.discount_amount ?? 0, 'Discount amount'),
      total_amount: 0,
      payment_status: dto.payment_status ?? 'unpaid',
      order_note: dto.order_note?.trim() || null,
      delivery_details: deliveryDetails,
      source_device_id: null,
      source_device_uid: null,
      sync_origin: 'online',
      offline_created_at: null,
    });

    const savedOrder = await this.orderRepo.save(order);

    if ((dto.items?.length ?? 0) > 0) {
      try {
        await this.addItemsToOrder(clientId, branchId, savedOrder.id, dto.items ?? []);
      } catch (error) {
        await this.orderItemRepo.delete({ order_id: savedOrder.id });
        await this.kotRepo.delete({
          client_id: clientId,
          branch_id: branchId,
          order_id: String(savedOrder.id),
        });
        await this.orderRepo.delete({ id: savedOrder.id, client_id: clientId, branch_id: branchId });

        if (table) {
          table.status = 'vacant';
          await this.tableRepo.save(table);
        }

        throw error;
      }
    }

    const createdOrder = await this.loadOrderOrFail(clientId, branchId, savedOrder.id);
    if (createdOrder.order_status === 'pending') {
      await this.submitKotForOrder(createdOrder);
    }

    return this.getOrder(clientId, branchId, createdOrder.id);
  }

  async updateOrderHeader(
    clientId: string,
    branchId: number,
    orderId: number,
    dto: UpdatePosOrderHeaderDto,
  ): Promise<any> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update POS order header');
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (!['held', 'pending', 'preparing', 'ready', 'served'].includes(String(order.order_status || '').toLowerCase())) {
      throw new BadRequestException('Only active POS orders can be updated.');
    }

    const nextOrderType = dto.order_type
      ? this.normalizeOrderType(dto.order_type)
      : this.normalizeOrderType(order.order_type);

    let nextTableId = dto.table_id !== undefined
      ? (dto.table_id ? Number(dto.table_id) : null)
      : (order.table_id ?? null);

    if (nextOrderType === 'dine_in' && !nextTableId) {
      throw new BadRequestException('Dine-in orders require a branch table.');
    }

    if (nextOrderType !== 'dine_in') {
      nextTableId = null;
    }

    if (dto.customer_id !== undefined) {
      order.customer_id = dto.customer_id ? Number(dto.customer_id) : null;
    }
    if (order.customer_id) {
      await this.customersService.getCustomerDetail(clientId, order.customer_id);
    }
    order.delivery_details = this.normalizeOrderType(order.order_type) === 'delivery'
      ? this.normalizeDeliveryDetails(dto?.delivery_details ?? order.delivery_details)
      : null;

    if (dto.order_taker_user_id !== undefined) {
      if (dto.order_taker_user_id) {
        const orderTakerUser = await this.requireBranchStaff(clientId, dto.order_taker_user_id);
        order.user_id = orderTakerUser.id;
      }
    }

    if (dto.order_note !== undefined) {
      order.order_note = dto.order_note?.trim() || null;
    }

    const currentOrderType = this.normalizeOrderType(order.order_type);
    if (currentOrderType === 'dine_in' && nextOrderType !== 'dine_in' && order.table_id) {
      const previousTable = await this.assertTableBelongsToBranch(branchId, order.table_id);
      if (previousTable) {
        previousTable.status = 'vacant';
        await this.tableRepo.save(previousTable);
      }
    }

    if (nextOrderType === 'dine_in' && nextTableId) {
      const nextTable = await this.assertTableBelongsToBranch(branchId, nextTableId);
      if (nextTable) {
        nextTable.status = 'occupied';
        await this.tableRepo.save(nextTable);
      }
    }

    order.order_type = nextOrderType;
    order.table_id = nextTableId;
    order.delivery_details = nextOrderType === 'delivery'
      ? this.normalizeDeliveryDetails(dto.delivery_details ?? order.delivery_details)
      : null;

    await this.orderRepo.save(order);
    return this.getOrder(clientId, branchId, order.id);
  }

  async registerDevice(clientId: string, branchId: number, dto: RegisterPosDeviceDto) {
    const device = await this.registerOrResolveDevice(clientId, branchId, dto);
    return this.serializeDevice(device);
  }

  async listDevices(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const devices = await this.posDeviceRepo.find({
      where: { client_id: clientId, branch_id: branchId },
      order: { device_name: 'ASC', id: 'ASC' },
    });
    return devices.map((device) => this.serializeDevice(device));
  }

  async listDeviceSyncEvents(
    clientId: string,
    branchId: number,
    deviceId: number,
    query: ListPosDeviceSyncEventsDto,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const device = await this.posDeviceRepo.findOne({
      where: { id: deviceId, client_id: clientId, branch_id: branchId },
    });
    if (!device) {
      throw new NotFoundException('POS device not found for this branch.');
    }

    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
    const builder = this.posSyncEventRepo.createQueryBuilder('event')
      .where('event.client_id = :clientId', { clientId })
      .andWhere('event.branch_id = :branchId', { branchId })
      .andWhere('event.device_id = :deviceId', { deviceId })
      .orderBy('event.created_at', 'DESC')
      .limit(limit);

    if (query.status) {
      builder.andWhere('event.status = :status', { status: query.status });
    }

    if (query.resolution_status) {
      builder.andWhere('event.resolution_status = :resolutionStatus', {
        resolutionStatus: query.resolution_status,
      });
    }

    const events = await builder.getMany();
    const summaryRows = await this.posSyncEventRepo.createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect("COALESCE(event.resolution_status, 'none')", 'resolution_status')
      .addSelect('COUNT(event.id)', 'total')
      .where('event.client_id = :clientId', { clientId })
      .andWhere('event.branch_id = :branchId', { branchId })
      .andWhere('event.device_id = :deviceId', { deviceId })
      .groupBy('event.status')
      .addGroupBy('event.resolution_status')
      .getRawMany();

    const summary = {
      pending: 0,
      processed: 0,
      failed: 0,
      conflict: 0,
      open_conflicts: 0,
      acknowledged_conflicts: 0,
      resolved_conflicts: 0,
    };
    for (const row of summaryRows) {
      const statusKey = String(row.status || '').toLowerCase() as keyof typeof summary;
      if (statusKey in summary) {
        summary[statusKey] += Number(row.total || 0);
      }
      const resolutionKey = String(row.resolution_status || 'none').toLowerCase();
      if (statusKey === 'conflict') {
        if (resolutionKey === 'acknowledged') summary.acknowledged_conflicts += Number(row.total || 0);
        else if (resolutionKey === 'resolved') summary.resolved_conflicts += Number(row.total || 0);
        else summary.open_conflicts += Number(row.total || 0);
      }
    }

    return {
      device: this.serializeDevice(device),
      summary,
      events: events.map((event) => this.serializeSyncEvent(event)),
    };
  }

  async reconcileSyncEvent(
    clientId: string,
    branchId: number,
    deviceId: number,
    syncEventId: number,
    dto: ReconcilePosSyncEventDto,
    user?: JwtPayload,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const device = await this.posDeviceRepo.findOne({
      where: { id: deviceId, client_id: clientId, branch_id: branchId },
    });
    if (!device) {
      throw new NotFoundException('POS device not found for this branch.');
    }

    const event = await this.posSyncEventRepo.findOne({
      where: {
        id: syncEventId,
        client_id: clientId,
        branch_id: branchId,
        device_id: deviceId,
      },
    });
    if (!event) {
      throw new NotFoundException('POS sync event not found for this device.');
    }
    if (event.status !== 'conflict') {
      throw new BadRequestException('Only conflict events can be reconciled from this endpoint.');
    }

    const actorId = this.toActorId(user?.sub);
    if (dto.action === 'resolve') {
      if (!event.processed_at) {
        throw new BadRequestException('Only conflicts backed by an already-processed server event can be marked as resolved.');
      }
      event.status = 'processed';
      event.error_message = null as any;
      event.resolution_status = 'resolved';
      event.resolution_note = dto.note?.trim() || null;
      event.resolved_at = new Date();
      event.resolved_by_user_id = actorId;
    } else {
      event.resolution_status = 'acknowledged';
      event.resolution_note = dto.note?.trim() || event.resolution_note || null;
      event.resolved_at = null;
      event.resolved_by_user_id = actorId;
    }

    const savedEvent = await this.posSyncEventRepo.save(event);

    await this.operationalAuditService.log({
      user,
      action: dto.action === 'resolve' ? 'POS Offline Conflict Resolved' : 'POS Offline Conflict Acknowledged',
      entity: 'pos_sync_events',
      clientId,
      branchId,
      portal: 'Console',
      details: `Sync event ${savedEvent.device_event_id || savedEvent.id} on device ${device.device_uid} was ${dto.action}d.`,
      metadata: {
        device_id: device.id,
        device_uid: device.device_uid,
        sync_event_id: savedEvent.id,
        action: dto.action,
        resolution_status: savedEvent.resolution_status,
      },
    });

    return {
      device: this.serializeDevice(device),
      event: this.serializeSyncEvent(savedEvent),
    };
  }

  async getOfflineReconciliation(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const [devices, recentEvents, recentOfflineOrders, statusRows, deviceEventRows, deviceLastRows, oldestPendingEvent] = await Promise.all([
      this.posDeviceRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        order: { updated_at: 'DESC', id: 'DESC' },
      }),
      this.posSyncEventRepo.find({
        where: { client_id: clientId, branch_id: branchId },
        order: { created_at: 'DESC', id: 'DESC' },
        take: 20,
      }),
      this.orderRepo.find({
        where: {
          client_id: clientId,
          branch_id: branchId,
          sync_origin: 'offline',
        },
        relations: ['transactions', 'table', 'items', 'items.product'],
        order: { created_at: 'DESC', id: 'DESC' },
        take: 12,
      }),
      this.posSyncEventRepo.createQueryBuilder('event')
        .select('event.status', 'status')
        .addSelect("COALESCE(event.resolution_status, 'none')", 'resolution_status')
        .addSelect('COUNT(event.id)', 'total')
        .where('event.client_id = :clientId', { clientId })
        .andWhere('event.branch_id = :branchId', { branchId })
        .groupBy('event.status')
        .addGroupBy('event.resolution_status')
        .getRawMany(),
      this.posSyncEventRepo.createQueryBuilder('event')
        .select('event.device_id', 'device_id')
        .addSelect('event.status', 'status')
        .addSelect('COUNT(event.id)', 'total')
        .where('event.client_id = :clientId', { clientId })
        .andWhere('event.branch_id = :branchId', { branchId })
        .groupBy('event.device_id')
        .addGroupBy('event.status')
        .getRawMany(),
      this.posSyncEventRepo.createQueryBuilder('event')
        .select('event.device_id', 'device_id')
        .addSelect('MAX(event.created_at)', 'last_event_at')
        .addSelect('MAX(event.last_attempt_at)', 'last_attempt_at')
        .addSelect('MAX(event.processed_at)', 'last_processed_at')
        .where('event.client_id = :clientId', { clientId })
        .andWhere('event.branch_id = :branchId', { branchId })
        .groupBy('event.device_id')
        .getRawMany(),
      this.posSyncEventRepo.findOne({
        where: {
          client_id: clientId,
          branch_id: branchId,
          status: 'pending',
        },
        order: { created_at: 'ASC', id: 'ASC' },
      }),
    ]);

    const totals = {
      pending: 0,
      processed: 0,
      failed: 0,
      conflict: 0,
      open_conflicts: 0,
      acknowledged_conflicts: 0,
      resolved_conflicts: 0,
    };
    for (const row of statusRows) {
      const statusKey = String(row.status || '').toLowerCase() as keyof typeof totals;
      if (statusKey in totals) {
        totals[statusKey] += Number(row.total || 0);
      }
      if (statusKey === 'conflict') {
        const resolutionStatus = String(row.resolution_status || 'none').toLowerCase();
        if (resolutionStatus === 'acknowledged') {
          totals.acknowledged_conflicts += Number(row.total || 0);
        } else if (resolutionStatus === 'resolved') {
          totals.resolved_conflicts += Number(row.total || 0);
        } else {
          totals.open_conflicts += Number(row.total || 0);
        }
      }
    }

    const deviceNameMap = new Map(
      devices.map((device) => [device.id, device.device_name || device.device_code || device.device_uid]),
    );
    const deviceCodeGroups = new Map<string, number[]>();
    for (const device of devices) {
      const code = device.device_code?.trim();
      if (!code) continue;
      const bucket = deviceCodeGroups.get(code) ?? [];
      bucket.push(device.id);
      deviceCodeGroups.set(code, bucket);
    }

    const deviceCounts = new Map<number, { pending: number; processed: number; failed: number; conflict: number }>();
    for (const row of deviceEventRows) {
      const current = deviceCounts.get(Number(row.device_id)) ?? {
        pending: 0,
        processed: 0,
        failed: 0,
        conflict: 0,
      };
      const key = String(row.status || '').toLowerCase() as keyof typeof current;
      if (key in current) {
        current[key] += Number(row.total || 0);
      }
      deviceCounts.set(Number(row.device_id), current);
    }

    const deviceLastMap = new Map<number, { last_event_at: Date | null; last_attempt_at: Date | null; last_processed_at: Date | null }>();
    for (const row of deviceLastRows) {
      deviceLastMap.set(Number(row.device_id), {
        last_event_at: row.last_event_at ? new Date(row.last_event_at) : null,
        last_attempt_at: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
        last_processed_at: row.last_processed_at ? new Date(row.last_processed_at) : null,
      });
    }

    const now = Date.now();
    const staleThresholdMs = 6 * 60 * 60 * 1000;
    const staleDevices: number[] = [];
    const duplicateDevices: number[] = [];

    const serializedDevices = devices.map((device) => {
      const counts = deviceCounts.get(device.id) ?? {
        pending: 0,
        processed: 0,
        failed: 0,
        conflict: 0,
      };
      const latest = deviceLastMap.get(device.id);
      const isStale = !device.last_seen_at || (now - device.last_seen_at.getTime()) > staleThresholdMs;
      const duplicateIdentity = Boolean(device.device_code && (deviceCodeGroups.get(device.device_code.trim())?.length || 0) > 1);
      if (isStale) staleDevices.push(device.id);
      if (duplicateIdentity) duplicateDevices.push(device.id);

      const warnings: string[] = [];
      if (duplicateIdentity) warnings.push('Duplicate device code detected in this branch.');
      if (isStale) warnings.push('Device has not checked in during the stale threshold window.');
      if (counts.conflict > 0) warnings.push(`${counts.conflict} conflict event(s) need reconciliation.`);
      if (counts.failed > 0) warnings.push(`${counts.failed} failed event(s) are queued for retry.`);
      if (counts.pending > 0 && device.last_sync_status !== 'success') warnings.push(`${counts.pending} pending event(s) are waiting to sync.`);

      let healthState: 'healthy' | 'attention' | 'critical' = 'healthy';
      if (duplicateIdentity || counts.conflict > 0 || counts.failed >= 3) {
        healthState = 'critical';
      } else if (isStale || counts.failed > 0 || counts.pending > 0 || device.last_sync_status === 'failed') {
        healthState = 'attention';
      }

      return {
        ...this.serializeDevice(device),
        counts,
        health_state: healthState,
        is_stale: isStale,
        duplicate_identity: duplicateIdentity,
        warnings,
        last_event_at: latest?.last_event_at ?? null,
        last_attempt_at: latest?.last_attempt_at ?? null,
        last_processed_at: latest?.last_processed_at ?? null,
      };
    });

    const attentionItems: Array<{
      level: 'info' | 'warning' | 'critical';
      code: string;
      title: string;
      detail: string;
    }> = [];
    if (totals.open_conflicts > 0) {
      attentionItems.push({
        level: 'critical',
        code: 'open_conflicts',
        title: 'Offline conflicts require review',
        detail: `${totals.open_conflicts} sync event(s) are blocked in open conflict status.`,
      });
    }
    if (totals.failed > 0) {
      attentionItems.push({
        level: totals.failed >= 5 ? 'critical' : 'warning',
        code: 'failed_retries',
        title: 'Retry backlog building up',
        detail: `${totals.failed} sync event(s) failed and remain queued for retry.`,
      });
    }
    if (staleDevices.length > 0) {
      attentionItems.push({
        level: 'warning',
        code: 'stale_devices',
        title: 'Offline devices have gone stale',
        detail: `${staleDevices.length} registered device(s) have not checked in within the last 6 hours.`,
      });
    }
    if (duplicateDevices.length > 0) {
      attentionItems.push({
        level: 'critical',
        code: 'duplicate_device_code',
        title: 'Duplicate device identity detected',
        detail: `${new Set(duplicateDevices).size} device(s) share a duplicate branch device code.`,
      });
    }
    if (oldestPendingEvent) {
      attentionItems.push({
        level: 'info',
        code: 'oldest_pending_event',
        title: 'Oldest pending sync event',
        detail: `The oldest pending event was queued at ${oldestPendingEvent.created_at.toISOString()}.`,
      });
    }

    const branchSafetyStatus =
      duplicateDevices.length > 0 || totals.open_conflicts > 0 || totals.failed >= 5
        ? 'critical'
        : attentionItems.length > 0 || totals.pending > 0
          ? 'attention'
          : 'healthy';

    return {
      summary: {
        ...totals,
        device_count: devices.length,
        stale_device_count: staleDevices.length,
        duplicate_device_code_count: new Set(duplicateDevices).size,
        attention_count: attentionItems.length,
        branch_safety_status: branchSafetyStatus,
        last_processed_at:
          recentEvents.find((event) => event.processed_at)?.processed_at ?? null,
      },
      attention_items: attentionItems,
      devices: serializedDevices,
      recent_events: recentEvents.map((event) => ({
        ...this.serializeSyncEvent(event),
        device_name: event.device_id ? deviceNameMap.get(event.device_id) ?? null : null,
      })),
      recent_conflicts: recentEvents
        .filter((event) => event.status === 'conflict' || event.status === 'failed')
        .slice(0, 8)
        .map((event) => ({
          ...this.serializeSyncEvent(event),
          device_name: event.device_id ? deviceNameMap.get(event.device_id) ?? null : null,
        })),
      recent_offline_orders: recentOfflineOrders.map((order) => this.serializeOrder(order)),
    };
  }

  async addItemsToOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    itemsDto: { product_id: number; product_name?: string; quantity: number; item_price?: number; notes?: string }[],
  ): Promise<any> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'add items to POS orders');
    const shift = await this.requireOpenShift(clientId, branchId);

    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    if (order.shift_id && order.shift_id !== shift.id) {
      throw new BadRequestException('This order does not belong to the active shift.');
    }
    if (!this.isEditableOpenOrderStatus(order.order_status)) {
      throw new BadRequestException('Cannot add items to a processed or cancelled order.');
    }

    const newItems: OrderItem[] = [];
    const orderChannel = this.getOrderChannel(order.order_type);
    const resolvedItems: Array<{
      item: { product_id: number; product_name?: string; quantity: number; item_price?: number; notes?: string };
      branchProduct: BranchProductSaleContext;
    }> = [];

    for (const item of itemsDto) {
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        throw new BadRequestException('Order item quantity must be greater than zero.');
      }

      const branchProduct = await this.catalogService.getBranchProductSaleContext(
        clientId,
        branchId,
        item.product_id,
        orderChannel,
      );

      if (!branchProduct.effective_enabled) {
        throw new BadRequestException(
          this.buildUnavailableProductMessage(
            branchProduct.product.product_name,
            branchProduct.unavailable_reason,
            branchProduct.temporarily_disabled_until,
          ),
        );
      }
      resolvedItems.push({ item, branchProduct });
    }

    for (const resolvedItem of resolvedItems) {
      const lineItem = this.orderItemRepo.create({
        order_id: order.id,
        product_id: resolvedItem.branchProduct.product.id,
        product_name:
          resolvedItem.item.product_name?.trim()
          || resolvedItem.branchProduct.product.product_name
          || `Product #${resolvedItem.branchProduct.product.id}`,
        item_price:
          resolvedItem.item.item_price !== undefined
            ? this.ensureNonNegativeMoney(resolvedItem.item.item_price, 'Item price')
            : resolvedItem.branchProduct.effective_price,
        quantity: Math.round(Number(resolvedItem.item.quantity)),
        item_notes: resolvedItem.item.notes?.trim() || null,
      });

      const savedLineItem = await this.orderItemRepo.save(lineItem);
      savedLineItem.product = resolvedItem.branchProduct.product;
      newItems.push(savedLineItem);
    }

    const hadExistingItems = (order.items ?? []).some((item) => String(item.item_status || '').toLowerCase() !== 'voided');
    order.items = [...(order.items ?? []), ...newItems];
    await this.syncOrderTotals(order);

    if (order.order_status !== 'held') {
      await this.createKotForItems(order, newItems, { markAsNew: hadExistingItems });
    }

    return this.getOrder(clientId, branchId, order.id);
  }

  async getBranchTables(clientId: string, branchId: number): Promise<KitchenTableEntity[]> {
    await this.assertBranchBelongsToClient(clientId, branchId);
    return this.tableRepo.find({
      where: { branch_id: branchId, is_active: true },
      order: { table_number: 'ASC' },
    });
  }

  async listOrders(
    clientId: string,
    branchId: number,
    status?: string,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update POS orders');

    const query = this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.category', 'productCategory')
      .leftJoinAndSelect('product.production_station', 'productStation')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .leftJoinAndSelect('order.cashier', 'orderTaker')
      .leftJoinAndSelect('order.charges', 'charges')
      .leftJoinAndSelect('order.transactions', 'transactions')
      .leftJoinAndSelect('order.returns', 'returns')
      .leftJoinAndSelect('returns.items', 'returnItems')
      .leftJoinAndSelect('returns.payments', 'returnPayments')
      .leftJoinAndSelect('order.sale_counter', 'saleCounter')
      .leftJoinAndSelect('order.shift', 'shift')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .orderBy('order.created_at', 'DESC');

    if (status) {
      query.andWhere('order.order_status = :status', { status });
    }

    const orders = await query.getMany();
    return this.attachOrderMeta(orders.map((order) => this.serializeOrder(order)));
  }

  private resolveUserHistoryBranchIds(accessibleBranchIds?: number[], requestedBranchId?: unknown): number[] {
    const accessibleIds = [...new Set((accessibleBranchIds ?? [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0))];
    const requested = Number(requestedBranchId || 0) || null;
    if (requested) {
      if (accessibleIds.length > 0 && !accessibleIds.includes(requested)) {
        throw new ForbiddenException('You do not have access to user history for this branch.');
      }
      return [requested];
    }
    return accessibleIds;
  }

  async listUserHistoryUsers(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters: Record<string, any>,
  ) {
    const branchIds = this.resolveUserHistoryBranchIds(accessibleBranchIds, filters.branch_id);
    if (branchIds.length === 0) return [];

    const search = String(filters.search || '').trim();
    const query = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.roleEntity', 'role')
      .where('user.client_id = :clientId', { clientId })
      .andWhere('user.is_active = :active', { active: true });

    if (search) {
      query.andWhere(new Brackets((subQuery) => {
        subQuery
          .where('user.full_name LIKE :search', { search: `%${search}%` })
          .orWhere('user.user_name LIKE :search', { search: `%${search}%` })
          .orWhere('user.employee_id LIKE :search', { search: `%${search}%` });
      }));
    }

    const users = await query
      .orderBy('user.full_name', 'ASC')
      .addOrderBy('user.user_name', 'ASC')
      .limit(300)
      .getMany();

    return users.map((user) => ({
      id: user.id,
      label: user.full_name || user.user_name || `User #${user.id}`,
      username: user.user_name,
      employee_id: user.employee_id,
      role: user.roleEntity?.role_name ?? user.user_type ?? null,
      status: user.status,
    }));
  }

  async getUserActivityTransactionHistory(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters: Record<string, any>,
  ) {
    const branchIds = this.resolveUserHistoryBranchIds(accessibleBranchIds, filters.branch_id);
    if (branchIds.length === 0) {
      return this.emptyUserHistoryResponse();
    }

    const userId = Number(filters.user_id || 0) || null;
    const dateFrom = this.normalizeBillVoidDate(filters.date_from);
    const dateTo = this.normalizeBillVoidDate(filters.date_to, true);
    const selectedUser = userId
      ? await this.userRepo.findOne({ where: { id: userId, client_id: clientId }, relations: ['roleEntity'] })
      : null;

    const orderQuery = this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .leftJoinAndSelect('order.cashier', 'orderTaker')
      .leftJoinAndSelect('order.sale_counter', 'saleCounter')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.transactions', 'transactions')
      .leftJoinAndSelect('transactions.user', 'transactionUser')
      .leftJoinAndSelect('order.returns', 'returns')
      .leftJoinAndSelect('returns.items', 'returnItems')
      .leftJoinAndSelect('returns.payments', 'returnPayments')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id IN (:...branchIds)', { branchIds });

    if (userId) {
      orderQuery.andWhere('order.user_id = :userId', { userId });
    }
    if (dateFrom) orderQuery.andWhere('order.created_at >= :dateFrom', { dateFrom });
    if (dateTo) orderQuery.andWhere('order.created_at <= :dateTo', { dateTo });

    const orders = await orderQuery
      .orderBy('order.created_at', 'DESC')
      .take(200)
      .getMany();
    const orderRows = await this.attachOrderMeta(orders.map((order) => this.serializeOrder(order)));

    const transactionQuery = this.transactionRepo.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.order', 'order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.sale_counter', 'saleCounter')
      .leftJoinAndSelect('transaction.user', 'transactionUser')
      .where('transaction.client_id = :clientId', { clientId })
      .andWhere('transaction.branch_id IN (:...branchIds)', { branchIds });

    if (userId) transactionQuery.andWhere('transaction.user_id = :userId', { userId });
    if (dateFrom) transactionQuery.andWhere('transaction.transaction_date >= :dateFrom', { dateFrom });
    if (dateTo) transactionQuery.andWhere('transaction.transaction_date <= :dateTo', { dateTo });

    const transactions = await transactionQuery
      .orderBy('transaction.transaction_date', 'DESC')
      .take(300)
      .getMany();

    const voidQuery = this.posVoidLogRepo.createQueryBuilder('log')
      .where('log.client_id = :clientId', { clientId })
      .andWhere('log.branch_id IN (:...branchIds)', { branchIds });
    if (userId) voidQuery.andWhere('log.voided_by_user_id = :userId', { userId });
    if (dateFrom) voidQuery.andWhere('log.created_at >= :dateFrom', { dateFrom });
    if (dateTo) voidQuery.andWhere('log.created_at <= :dateTo', { dateTo });
    const voidLogs = await voidQuery.orderBy('log.created_at', 'DESC').take(150).getMany();

    const auditQuery = this.dataSource.createQueryBuilder()
      .from('audit_logs', 'audit')
      .where('audit.client_id = :clientId', { clientId })
      .andWhere(new Brackets((subQuery) => {
        subQuery
          .where('audit.branch_id IS NULL')
          .orWhere('audit.branch_id IN (:...branchIds)', { branchIds });
      }));
    if (userId) {
      auditQuery.andWhere(new Brackets((subQuery) => {
        subQuery
          .where('audit.user_id = :userIdText', { userIdText: String(userId) })
          .orWhere('audit.user_name = :userName', {
            userName: selectedUser?.user_name || selectedUser?.full_name || '',
          });
      }));
    }
    if (dateFrom) auditQuery.andWhere('audit.timestamp >= :dateFrom', { dateFrom });
    if (dateTo) auditQuery.andWhere('audit.timestamp <= :dateTo', { dateTo });

    const auditRows = await auditQuery
      .select([
        'audit.id AS id',
        'audit.timestamp AS timestamp',
        'audit.user_id AS user_id',
        'audit.user_name AS user_name',
        'audit.UserManagement_role AS user_role',
        'audit.action AS action',
        'audit.entity AS entity',
        'audit.entity_id AS entity_id',
        'audit.portal AS portal',
        'audit.status AS status',
        'audit.request_method AS request_method',
        'audit.request_path AS request_path',
        'audit.branch_id AS branch_id',
        'audit.details AS details',
      ])
      .orderBy('audit.timestamp', 'DESC')
      .limit(300)
      .getRawMany();

    const financialEvents = this.buildUserHistoryFinancialEvents(orderRows, transactions, voidLogs);
    const summary = this.buildUserHistorySummary(orderRows, financialEvents, auditRows);

    return {
      selected_user: selectedUser ? {
        id: selectedUser.id,
        name: selectedUser.full_name || selectedUser.user_name,
        username: selectedUser.user_name,
        role: selectedUser.roleEntity?.role_name ?? selectedUser.user_type ?? null,
      } : null,
      filters: {
        user_id: userId,
        branch_ids: branchIds,
        date_from: dateFrom,
        date_to: dateTo,
      },
      summary,
      orders: orderRows,
      transactions: financialEvents,
      audit_logs: auditRows,
    };
  }

  private emptyUserHistoryResponse() {
    return {
      selected_user: null,
      filters: { user_id: null, branch_ids: [], date_from: null, date_to: null },
      summary: {
        order_count: 0,
        order_amount: 0,
        payments_collected: 0,
        refunds: 0,
        voids: 0,
        void_amount: 0,
        discounts: 0,
        credit_adjustments: 0,
        vouchers: 0,
        audit_events: 0,
      },
      orders: [],
      transactions: [],
      audit_logs: [],
    };
  }

  private buildUserHistoryFinancialEvents(orderRows: any[], transactions: Transaction[], voidLogs: PosVoidLog[]) {
    const events: any[] = transactions.map((transaction) => ({
      id: `tx-${transaction.id}`,
      type: transaction.is_refund ? 'Refund' : 'Payment',
      occurred_at: transaction.transaction_date,
      order_id: transaction.order_id,
      order_number: transaction.order?.order_number ?? null,
      customer: transaction.order?.customer?.name ?? 'Walk-in customer',
      branch_id: transaction.branch_id,
      user_id: transaction.user_id,
      user_name: transaction.user?.full_name || transaction.user?.user_name || null,
      payment_mode: transaction.payment_mode,
      amount: this.roundCurrency(transaction.amount),
      reference_number: transaction.reference_number,
      description: transaction.is_refund ? 'Refund transaction' : 'Payment collected',
    }));

    for (const log of voidLogs) {
      events.push({
        id: `void-${log.id}`,
        type: 'Void',
        occurred_at: log.created_at,
        order_id: log.order_id,
        order_number: log.order_number,
        customer: log.customer_name || 'Walk-in customer',
        branch_id: log.branch_id,
        user_id: log.voided_by_user_id,
        user_name: log.voided_by_username,
        payment_mode: log.original_payment_method,
        amount: this.roundCurrency(log.voided_amount),
        reference_number: log.receipt_number,
        description: log.reason || 'Bill voided',
      });
    }

    for (const order of orderRows) {
      const discountAmount = this.roundCurrency(order.discount_amount);
      if (discountAmount > 0) {
        events.push({
          id: `discount-${order.id}`,
          type: 'Discount',
          occurred_at: order.created_at,
          order_id: order.id,
          order_number: order.order_number,
          customer: order.customer_name || 'Walk-in customer',
          branch_id: order.branch_id,
          user_id: order.order_taker_id,
          user_name: order.order_taker_name,
          payment_mode: null,
          amount: discountAmount,
          reference_number: order.voucher_code || null,
          description: order.voucher_code ? `Discount via voucher ${order.voucher_code}` : 'Manual order discount',
        });
      }

      const paidAmount = (order.transactions ?? [])
        .reduce((sum: number, payment: any) => sum + (payment.is_refund ? -Number(payment.amount || 0) : Number(payment.amount || 0)), 0);
      const outstanding = this.roundCurrency(Math.max(Number(order.total_amount || 0) - paidAmount, 0));
      const paymentStatus = String(order.payment_status || '').toLowerCase();
      if (outstanding > 0 && ['unpaid', 'partial', 'credited', 'credit'].includes(paymentStatus)) {
        events.push({
          id: `credit-${order.id}`,
          type: 'Credit Adjustment',
          occurred_at: order.updated_at || order.created_at,
          order_id: order.id,
          order_number: order.order_number,
          customer: order.customer_name || 'Walk-in customer',
          branch_id: order.branch_id,
          user_id: order.order_taker_id,
          user_name: order.order_taker_name,
          payment_mode: paymentStatus,
          amount: outstanding,
          reference_number: order.receipt_number,
          description: 'Outstanding customer receivable / credit balance',
        });
      }

      if (order.voucher_id) {
        events.push({
          id: `voucher-${order.id}`,
          type: 'Voucher',
          occurred_at: order.created_at,
          order_id: order.id,
          order_number: order.order_number,
          customer: order.customer_name || 'Walk-in customer',
          branch_id: order.branch_id,
          user_id: order.order_taker_id,
          user_name: order.order_taker_name,
          payment_mode: null,
          amount: discountAmount,
          reference_number: order.voucher_code || order.voucher_id,
          description: order.voucher_name || 'Voucher applied',
        });
      }
    }

    return events.sort((left, right) =>
      new Date(right.occurred_at || 0).getTime() - new Date(left.occurred_at || 0).getTime(),
    );
  }

  private buildUserHistorySummary(orderRows: any[], financialEvents: any[], auditRows: any[]) {
    const sumEvents = (type: string) => financialEvents
      .filter((event) => event.type === type)
      .reduce((sum, event) => sum + Number(event.amount || 0), 0);
    return {
      order_count: orderRows.length,
      order_amount: this.roundCurrency(orderRows.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)),
      payments_collected: this.roundCurrency(sumEvents('Payment')),
      refunds: this.roundCurrency(sumEvents('Refund')),
      voids: financialEvents.filter((event) => event.type === 'Void').length,
      void_amount: this.roundCurrency(sumEvents('Void')),
      discounts: this.roundCurrency(sumEvents('Discount')),
      credit_adjustments: this.roundCurrency(sumEvents('Credit Adjustment')),
      vouchers: financialEvents.filter((event) => event.type === 'Voucher').length,
      audit_events: auditRows.length,
    };
  }

  private normalizeBillVoidDate(value?: string | null, endOfDay = false): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    }
    return date;
  }

  private resolveActorRole(user?: JwtPayload, branchId?: number | null): string | null {
    const branchRole = (user?.allowed_branches ?? []).find((branch) => Number(branch.branch_id) === Number(branchId))?.role_name;
    return branchRole || (user?.role != null ? String(user.role) : null);
  }

  private normalizePaymentModes(transactions?: Transaction[]): string | null {
    const modes = [...new Set((transactions ?? [])
      .filter((transaction) => !transaction.is_refund)
      .map((transaction) => String(transaction.payment_mode || '').trim())
      .filter(Boolean))];
    return modes.length ? modes.join(', ') : null;
  }

  async searchBillVoidOrders(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters: Record<string, any>,
  ) {
    const requestedBranchId = Number(filters.branch_id || 0) || null;
    const branchIds = requestedBranchId
      ? [requestedBranchId]
      : [...new Set((accessibleBranchIds ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (branchIds.length === 0) return [];

    const query = this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.cashier', 'orderTaker')
      .leftJoinAndSelect('order.sale_counter', 'saleCounter')
      .leftJoinAndSelect('order.transactions', 'transactions')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id IN (:...branchIds)', { branchIds });

    const orderNo = String(filters.order_no || '').trim();
    if (orderNo) {
      query.andWhere('(order.order_number LIKE :orderNo OR order.receipt_number LIKE :orderNo OR CAST(order.id AS CHAR) LIKE :orderNo)', { orderNo: `%${orderNo}%` });
    }
    const kotNo = String(filters.kot_no || '').trim();
    if (kotNo) {
      query.andWhere('(CAST(order.kot_base_number AS CHAR) LIKE :kotNo)', { kotNo: `%${kotNo}%` });
    }
    const customer = String(filters.customer || '').trim();
    if (customer) {
      query.andWhere('(customer.name LIKE :customer OR customer.phone_number LIKE :customer)', { customer: `%${customer}%` });
    }
    const status = String(filters.status || '').trim();
    if (status && status !== 'all') {
      query.andWhere('order.order_status = :status', { status });
    }
    const creditOnly = String(filters.credit_only || '').toLowerCase() === 'true';
    if (creditOnly) {
      query.andWhere('LOWER(order.payment_status) = :credited', { credited: 'credited' });
    } else {
      const paymentStatus = String(filters.payment_status || '').trim();
      if (paymentStatus && paymentStatus !== 'all') {
        query.andWhere('LOWER(order.payment_status) = :paymentStatus', { paymentStatus: paymentStatus.toLowerCase() });
      }
    }
    const paymentType = String(filters.payment_type || '').trim();
    if (paymentType && paymentType !== 'all') {
      query.andWhere('transactions.payment_mode = :paymentType', { paymentType });
    }
    const from = this.normalizeBillVoidDate(filters.date_from);
    const to = this.normalizeBillVoidDate(filters.date_to, true);
    if (from) query.andWhere('order.created_at >= :from', { from });
    if (to) query.andWhere('order.created_at <= :to', { to });

    const rows = await query.orderBy('order.created_at', 'DESC').limit(150).getMany();
    return this.attachOrderMeta(rows.map((order) => ({
      ...this.serializeOrder(order),
      original_payment_method: this.normalizePaymentModes(order.transactions),
      void_status: ['voided', 'cancelled'].includes(String(order.order_status || '').toLowerCase()) ? 'Voided' : 'Active',
    })));
  }

  async getBillVoidReport(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters: Record<string, any>,
  ) {
    const requestedBranchId = Number(filters.branch_id || 0) || null;
    const branchIds = requestedBranchId
      ? [requestedBranchId]
      : [...new Set((accessibleBranchIds ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (branchIds.length === 0) {
      return { rows: [], summary: { total_void_count: 0, total_void_amount: 0 }, by_user: [], by_customer: [], by_branch: [] };
    }

    const query = this.posVoidLogRepo.createQueryBuilder('log')
      .leftJoin('log.order', 'order')
      .leftJoin('order.branch', 'branch')
      .where('log.client_id = :clientId', { clientId })
      .andWhere('log.branch_id IN (:...branchIds)', { branchIds });

    const from = this.normalizeBillVoidDate(filters.date_from);
    const to = this.normalizeBillVoidDate(filters.date_to, true);
    if (from) query.andWhere('log.created_at >= :from', { from });
    if (to) query.andWhere('log.created_at <= :to', { to });
    if (filters.customer) query.andWhere('log.customer_name LIKE :customer', { customer: `%${String(filters.customer).trim()}%` });
    if (filters.user) query.andWhere('log.voided_by_username LIKE :user', { user: `%${String(filters.user).trim()}%` });
    if (filters.payment_type && filters.payment_type !== 'all') query.andWhere('log.original_payment_method LIKE :paymentType', { paymentType: `%${filters.payment_type}%` });
    const amountMin = Number(filters.amount_min);
    const amountMax = Number(filters.amount_max);
    if (Number.isFinite(amountMin) && amountMin > 0) query.andWhere('log.voided_amount >= :amountMin', { amountMin });
    if (Number.isFinite(amountMax) && amountMax > 0) query.andWhere('log.voided_amount <= :amountMax', { amountMax });

    const rows = await query
      .select([
        'log.id AS id',
        'log.order_id AS order_id',
        'log.order_number AS order_number',
        'log.receipt_number AS receipt_number',
        'log.branch_id AS branch_id',
        'branch.branch_name AS branch_name',
        'log.customer_id AS customer_id',
        'log.customer_name AS customer_name',
        'log.order_amount AS order_amount',
        'log.voided_amount AS voided_amount',
        'log.reason AS reason',
        'log.voided_by_username AS voided_by_username',
        'log.voided_by_role AS voided_by_role',
        'log.sale_counter_name AS sale_counter_name',
        'log.original_payment_method AS original_payment_method',
        'log.original_order_status AS original_order_status',
        'log.original_payment_status AS original_payment_status',
        'log.created_at AS voided_at',
      ])
      .orderBy('log.created_at', 'DESC')
      .limit(500)
      .getRawMany();

    const normalizedRows = rows.map((row) => ({
      ...row,
      order_amount: this.roundCurrency(row.order_amount),
      voided_amount: this.roundCurrency(row.voided_amount),
    }));
    const group = (key: string) => (Array.from(normalizedRows.reduce((acc, row) => {
      const groupKey = row[key] || 'Unassigned';
      const existing = acc.get(groupKey) ?? { label: groupKey, void_count: 0, void_amount: 0 };
      existing.void_count += 1;
      existing.void_amount = this.roundCurrency(existing.void_amount + Number(row.voided_amount || 0));
      acc.set(groupKey, existing);
      return acc;
    }, new Map<string, any>()).values()) as any[]).sort((left, right) => right.void_amount - left.void_amount);

    return {
      rows: normalizedRows,
      summary: {
        total_void_count: normalizedRows.length,
        total_void_amount: this.roundCurrency(normalizedRows.reduce((sum, row) => sum + Number(row.voided_amount || 0), 0)),
      },
      by_user: group('voided_by_username'),
      by_customer: group('customer_name'),
      by_branch: group('branch_name'),
    };
  }

  async voidBillFromManagement(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    orderId: number,
    dto: {
      branch_id?: number;
      reason?: string;
      approval_username?: string;
      approval_pin?: string;
      manager_password?: string;
    },
    user?: JwtPayload,
  ) {
    const reason = String(dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Void reason is required.');
    }

    const order = await this.orderRepo.findOne({
      where: { id: orderId, client_id: clientId },
      relations: ['items', 'transactions', 'customer', 'sale_counter', 'table', 'charges'],
    });
    if (!order) throw new NotFoundException('Order not found.');

    const branchId = Number(dto.branch_id || order.branch_id);
    if (branchId !== Number(order.branch_id)) {
      throw new BadRequestException('Selected branch does not match the order branch.');
    }
    if (accessibleBranchIds?.length && !accessibleBranchIds.map(Number).includes(branchId)) {
      throw new ForbiddenException('You do not have access to void bills for this branch.');
    }
    await this.assertBranchBelongsToClient(clientId, branchId, 'void bills');
    if (['voided', 'cancelled'].includes(String(order.order_status || '').toLowerCase())) {
      throw new BadRequestException('This order is already voided or cancelled.');
    }

    const originalOrderStatus = order.order_status;
    const originalPaymentStatus = order.payment_status;
    const originalPaymentMethod = this.normalizePaymentModes(order.transactions);
    const actorId = typeof user?.sub === 'string' ? Number(user.sub) : Number(user?.sub ?? 0);
    const approver = dto.approval_username && dto.approval_pin
      ? await this.requireAuthorizedPinOverride(clientId, branchId, dto.approval_username, dto.approval_pin, 'void bills')
      : actorId
        ? await this.userRepo.findOne({ where: { id: actorId, client_id: clientId } })
        : null;
    if (!approver) {
      throw new ForbiddenException('Authorized user confirmation is required.');
    }

    const voidedAt = new Date();
    for (const item of order.items ?? []) {
      if (String(item.item_status || '').toLowerCase() !== 'voided') {
        item.item_status = 'voided';
        await this.orderItemRepo.save(item);
      }
    }
    const originalTransactions = (order.transactions ?? []).filter((transaction) => !transaction.is_refund);
    for (const transaction of originalTransactions) {
      if (Number(transaction.amount || 0) > 0) {
        await this.transactionRepo.save(this.transactionRepo.create({
          order_id: order.id,
          client_id: clientId,
          branch_id: branchId,
          shift_id: order.shift_id,
          user_id: approver.id,
          amount: this.roundCurrency(transaction.amount),
          payment_mode: transaction.payment_mode,
          reference_number: `VOID-${order.id}-${transaction.id}`,
          payment_details: {
            source: 'bill_void_management',
            original_transaction_id: transaction.id,
            reason,
          },
          is_refund: true,
        }));
      }
    }

    order.order_status = 'voided';
    order.payment_status = 'voided';
    order.voided_at = voidedAt;
    order.void_reason = reason;
    order.void_authorized_by_user_id = approver.id;
    order.void_authorized_by_username = approver.user_name;
    order.order_note = [
      order.order_note?.trim(),
      `Bill voided from Bill Void Management by ${approver.user_name}: ${reason}`,
    ].filter(Boolean).join('\n\n');
    await this.orderRepo.save(order);
    await this.syncKotDraftFromOrder(order);

    if (order.order_type === 'dine_in' && order.table_id) {
      const table = await this.tableRepo.findOne({ where: { id: order.table_id, branch_id: branchId } });
      if (table) {
        table.status = 'vacant';
        await this.tableRepo.save(table);
      }
    }

    await this.postBillVoidAccountingReversal(clientId, branchId, order, originalTransactions, originalPaymentStatus, reason, user);

    const log = await this.posVoidLogRepo.save(this.posVoidLogRepo.create({
      order_id: order.id,
      client_id: clientId,
      branch_id: branchId,
      order_number: order.order_number,
      receipt_number: order.receipt_number,
      customer_id: order.customer_id,
      customer_name: order.customer?.name ?? null,
      order_amount: this.roundCurrency(order.total_amount),
      voided_amount: this.roundCurrency(order.total_amount),
      reason,
      approved_by: approver.user_name,
      voided_by_user_id: approver.id,
      voided_by_username: approver.user_name,
      voided_by_role: this.resolveActorRole(user, branchId),
      sale_counter_id: order.sale_counter_id,
      sale_counter_name: order.sale_counter?.name ?? order.sale_counter?.code ?? null,
      original_payment_method: originalPaymentMethod,
      original_order_status: originalOrderStatus,
      original_payment_status: originalPaymentStatus,
      metadata: {
        source: 'bill_void_management',
        original_total_amount: this.roundCurrency(order.total_amount),
        original_sub_total: this.roundCurrency(order.sub_total),
        original_tax_amount: this.roundCurrency(order.tax_amount),
        original_discount_amount: this.roundCurrency(order.discount_amount),
        original_payment_methods: originalPaymentMethod,
        manager_confirmation_supplied: Boolean(dto.approval_username && dto.approval_pin),
        customer_void_tracking: {
          customer_id: order.customer_id,
          customer_name: order.customer?.name ?? null,
        },
      },
    }));

    await this.operationalAuditService.log({
      user,
      action: 'Bill Voided',
      entity: 'orders',
      clientId,
      branchId,
      entityId: order.id,
      portal: 'Console',
      details: `Voided bill ${order.order_number || order.id}`,
      metadata: {
        void_log_id: log.id,
        order_number: order.order_number,
        receipt_number: order.receipt_number,
        voided_amount: this.roundCurrency(order.total_amount),
        reason,
        original_order_status: originalOrderStatus,
        original_payment_status: originalPaymentStatus,
        original_payment_method: originalPaymentMethod,
      },
    });

    return this.getOrder(clientId, branchId, order.id);
  }

  private async postBillVoidAccountingReversal(
    clientId: string,
    branchId: number,
    order: Order,
    originalTransactions: Transaction[],
    originalPaymentStatus: string | null,
    reason: string,
    user?: JwtPayload,
  ) {
    const totalAmount = this.roundCurrency(order.total_amount);
    if (totalAmount <= 0) return;

    const cashAccount = await this.accountingService.ensureDefaultAccount(clientId, '1101', 'Cash on Hand', 'asset');
    const bankAccount = await this.accountingService.ensureDefaultAccount(clientId, '1102', 'Bank Current Account', 'asset');
    const merchantClearingAccount = await this.accountingService.ensureDefaultAccount(clientId, '1103', 'Merchant Settlement Clearing', 'asset');
    const receivableAccount = await this.accountingService.ensureDefaultAccount(clientId, '1210', 'Accounts Receivable', 'asset');
    const salesAccount = await this.accountingService.ensureDefaultAccount(clientId, '4100', 'Food Sales', 'revenue');
    const serviceChargeAccount = await this.accountingService.ensureDefaultAccount(clientId, '4200', 'Service Charges', 'revenue');
    const taxPayableAccount = await this.accountingService.ensureDefaultAccount(clientId, '2301', 'GST Payable', 'liability');

    const tenderCredits = originalTransactions.map((transaction) => ({
      account_id: this.resolvePosTenderAccountId(transaction.payment_mode, {
        cashAccountId: cashAccount.id,
        bankAccountId: bankAccount.id,
        merchantClearingAccountId: merchantClearingAccount.id,
      }),
      debit: 0,
      credit: this.roundCurrency(transaction.amount),
    })).filter((line) => line.credit > 0);

    const paidAmount = tenderCredits.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    const receivableAmount = this.roundCurrency(
      String(originalPaymentStatus || '').toLowerCase() === 'credited'
        ? totalAmount
        : Math.max(totalAmount - paidAmount, 0),
    );
    const foodSalesAmount = this.roundCurrency(Math.max(Number(order.sub_total || 0) - Number(order.discount_amount || 0), 0));
    const serviceChargeAmount = this.roundCurrency((order.charges ?? []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
    const taxAmount = this.roundCurrency(order.tax_amount);
    const journalItems = [
      ...(foodSalesAmount > 0 ? [{ account_id: salesAccount.id, debit: foodSalesAmount, credit: 0 }] : []),
      ...(serviceChargeAmount > 0 ? [{ account_id: serviceChargeAccount.id, debit: serviceChargeAmount, credit: 0 }] : []),
      ...(taxAmount > 0 ? [{ account_id: taxPayableAccount.id, debit: taxAmount, credit: 0 }] : []),
      ...tenderCredits,
      ...(receivableAmount > 0 ? [{ account_id: receivableAccount.id, debit: 0, credit: receivableAmount }] : []),
    ];

    const debitTotal = this.roundCurrency(journalItems.reduce((sum, line) => sum + Number(line.debit || 0), 0));
    const creditTotal = this.roundCurrency(journalItems.reduce((sum, line) => sum + Number(line.credit || 0), 0));
    if (journalItems.length < 2 || Math.abs(debitTotal - creditTotal) > 0.01) {
      await this.operationalAuditService.log({
        user,
        action: 'Bill Void Accounting Reversal Skipped',
        entity: 'orders',
        clientId,
        branchId,
        entityId: order.id,
        portal: 'Console',
        details: `Skipped unbalanced reversal for bill ${order.order_number || order.id}`,
        metadata: { debitTotal, creditTotal, reason },
      });
      return;
    }

    await this.accountingService.createJournalEntry(clientId, branchId, {
      transaction_date: new Date(),
      description: `Bill Void Reversal - Order ${order.order_number || order.id}`,
      reference_id: `VOID-ORD-${order.id}`,
      source_module: 'pos',
      source_entity_type: 'order',
      source_entity_id: String(order.id),
      source_event: 'bill_void',
      posting_type: 'auto',
      items: journalItems,
    }, user);
  }

  async listSaleProducts(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);
    const products = await this.catalogService.getProductsWithBranchStatus(clientId, branchId);
    return products
      .filter((product: any) => {
        const effectiveEnabled = product.effective_enabled !== false;
        const effectivePrice = Number(product.effective_price ?? product.price_override ?? product.product_base_price ?? 0);
        return effectiveEnabled && effectivePrice > 0;
      })
      .map((product: any) => ({
        id: product.id,
        name: product.product_name || product.name,
        product_name: product.product_name || product.name,
        category: product.category?.category_name || 'Uncategorized',
        category_id: product.category_id ?? product.category?.id ?? null,
        price_profile: product.effective_price_profile_name || product.master_price_profile_name || 'Main Menu',
        price_profile_id: product.effective_price_profile_id ?? product.master_price_profile_id ?? null,
        uom: product.base_uom?.abbreviation || product.base_uom?.short_code || product.base_uom?.name || null,
        price: Number(product.effective_price ?? 0),
        img: product.product_image_url || '',
        tax_configuration: product.tax_configuration ?? null,
        branch_enabled: product.branch_enabled !== false,
        effective_branch_enabled: product.effective_enabled !== false,
        allow_open_order_return: Boolean(product.allow_open_order_return),
      }));
  }

  async getOrder(clientId: string, branchId: number, orderId: number) {
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    const [enriched] = await this.attachOrderMeta([this.serializeOrder(order)]);
    return enriched;
  }

  async resolveOrderBranchId(clientId: string, orderId: number): Promise<number> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, client_id: clientId },
      select: ['id', 'branch_id'],
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return Number(order.branch_id);
  }

  async resolveOrderItemBranchId(clientId: string, itemId: number): Promise<number> {
    const orderItem = await this.orderItemRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!orderItem || orderItem.order?.client_id !== clientId) {
      throw new NotFoundException('Order item not found.');
    }
    return Number(orderItem.order.branch_id);
  }

  async getOrderReceipt(clientId: string, branchId: number, orderId: number) {
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    if (!order.finalized_at || order.order_status !== 'completed') {
      throw new BadRequestException('Receipt is only available for finalized orders.');
    }
    const [enriched] = await this.attachOrderMeta([this.serializeOrder(order)]);
    return enriched;
  }

  async updateOrderStatus(
    clientId: string,
    branchId: number,
    orderId: number,
    orderStatus: string,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'reassign POS tables');
    await this.requireOpenShift(clientId, branchId);

    const order = await this.orderRepo.findOne({
      where: { id: orderId, client_id: clientId, branch_id: branchId },
      relations: ['items', 'items.product', 'table'],
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.order_status === 'completed') {
      throw new BadRequestException('Completed orders cannot be changed.');
    }
    if (['completed'].includes(this.normalizeOrderStatus(orderStatus))) {
      throw new BadRequestException('Use checkout to finalize an order.');
    }

    const previousStatus = order.order_status;
    order.order_status = this.normalizeOrderStatus(orderStatus);
    const saved = await this.orderRepo.save(order);

    if (previousStatus === 'held' && order.order_status === 'pending' && order.items.length > 0) {
      await this.submitKotForOrder(order);
    }

    return this.getOrder(clientId, branchId, saved.id);
  }

  async submitOrderToKitchen(clientId: string, branchId: number, orderId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'submit POS orders to kitchen');
    await this.requireOpenShift(clientId, branchId);

    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    if (!this.isEditableOpenOrderStatus(order.order_status)) {
      throw new BadRequestException('Only active POS orders can be submitted to kitchen.');
    }

    await this.submitKotForOrder(order);
    return this.getOrder(clientId, branchId, order.id);
  }

  async updateOrderItem(
    clientId: string,
    branchId: number,
    orderId: number,
    itemId: number,
    dto: UpdatePosOrderItemDto,
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'update POS order items');
    await this.requireOpenShift(clientId, branchId);

    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    if (!this.isEditableOpenOrderStatus(order.order_status)) {
      throw new BadRequestException('Only active POS orders can update existing cart lines.');
    }

    const orderItem = order.items.find((item) => item.id === itemId);
    if (!orderItem) {
      throw new NotFoundException('Order item not found.');
    }
    if (String(orderItem.item_status || '').toLowerCase() === 'voided') {
      throw new BadRequestException('Cancelled items cannot be edited.');
    }

    const originalQuantity = Number(orderItem.quantity || 0);
    const wasTerminalKdsOrder = this.isTerminalKdsOrderStatus(order.order_status);
    let createdDeltaItem: OrderItem | null = null;
    let adjustmentDecision: { mode: 'standard' | 'open_return' | 'override'; approver?: UserManagement | null } | null = null;

    if (dto.quantity !== undefined) {
      if (!Number.isFinite(Number(dto.quantity)) || Number(dto.quantity) <= 0) {
        throw new BadRequestException('Order item quantity must be greater than zero.');
      }
      const requestedQuantity = Math.round(Number(dto.quantity));

      if (order.order_status !== 'held' && requestedQuantity < originalQuantity) {
        adjustmentDecision = await this.assertLateLineAdjustmentAllowed(
          clientId,
          branchId,
          branch,
          order,
          orderItem,
          requestedQuantity,
          dto,
        );
      }

      if (
        order.order_status !== 'held'
        && requestedQuantity > originalQuantity
        && (wasTerminalKdsOrder || this.isItemPastQuantityIncreaseWindow(orderItem, branch))
      ) {
        const deltaQuantity = requestedQuantity - originalQuantity;
        const deltaLineItem = this.orderItemRepo.create({
          order_id: order.id,
          product_id: orderItem.product_id,
          product_name: orderItem.product_name ?? orderItem.product?.product_name ?? `Product #${orderItem.product_id}`,
          item_price: orderItem.item_price,
          quantity: deltaQuantity,
          item_notes: orderItem.item_notes ?? null,
          item_status: 'pending',
        });
        createdDeltaItem = await this.orderItemRepo.save(deltaLineItem);
        createdDeltaItem.product = orderItem.product;
        order.items = [...(order.items ?? []), createdDeltaItem];
      } else {
        orderItem.quantity = requestedQuantity;
      }
    }

    if (dto.notes !== undefined) {
      orderItem.item_notes = dto.notes?.trim() || null;
    }

    if (dto.item_price !== undefined) {
      orderItem.item_price = this.ensureNonNegativeMoney(dto.item_price, 'Item price');
    }

    await this.orderItemRepo.save(orderItem);
    await this.syncOrderTotals(order);

    if (adjustmentDecision?.mode === 'open_return') {
      const returnedQuantity = Math.max(originalQuantity - Number(orderItem.quantity || 0), 0);
      if (returnedQuantity > 0) {
        await this.appendOrderAuditNote(
          order,
          `Open-order return recorded for ${orderItem.product_name ?? orderItem.product?.product_name ?? `item ${orderItem.id}`} x${returnedQuantity} on ${new Date().toISOString()}.`,
        );
      }
    } else if (adjustmentDecision?.mode === 'override') {
      const reducedQuantity = Math.max(originalQuantity - Number(orderItem.quantity || 0), 0);
      if (reducedQuantity > 0) {
        await this.appendOrderAuditNote(
          order,
          `Supervisor override reduced ${orderItem.product_name ?? orderItem.product?.product_name ?? `item ${orderItem.id}`} by ${reducedQuantity} on ${new Date().toISOString()}. Reason: ${dto.adjustment_reason?.trim()}. Approved by ${adjustmentDecision.approver?.user_name || 'authorized user'}.`,
        );
      }
    }

    if (createdDeltaItem) {
      order.items = [...(order.items ?? []).filter((item) => item.id !== createdDeltaItem.id), createdDeltaItem];
      await this.createKotForItems(order, [createdDeltaItem], { markAsNew: false, asAdditionDelta: true });
    } else {
      order.items = (order.items ?? []).map((item) => item.id === orderItem.id ? orderItem : item);
      if (order.order_status !== 'held' && !wasTerminalKdsOrder) {
        await this.syncKotDraftFromOrder(order);
      }
    }

    return this.getOrder(clientId, branchId, orderId);
  }

  async removeOrderItem(
    clientId: string,
    branchId: number,
    orderId: number,
    itemId: number,
    dto?: {
      approval_username?: string;
      approval_pin?: string;
      adjustment_reason?: string;
    },
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'remove POS order items');
    await this.requireOpenShift(clientId, branchId);

    const order = await this.loadOrderOrFail(clientId, branchId, orderId);
    if (!this.isEditableOpenOrderStatus(order.order_status)) {
      throw new BadRequestException('Only active POS orders can remove existing cart lines.');
    }

    const orderItem = order.items.find((item) => item.id === itemId);
    if (!orderItem) {
      throw new NotFoundException('Order item not found.');
    }

    if (order.order_status !== 'held') {
      if (String(orderItem.item_status || '').toLowerCase() === 'voided') {
        throw new BadRequestException('Already cancelled items cannot be removed.');
      }
      return this.updateOrderItemStatus(clientId, branchId, orderItem.id, 'voided', dto);
    }

    await this.orderItemRepo.remove(orderItem);
    order.items = order.items.filter((item) => item.id !== itemId);
    await this.syncOrderTotals(order);

    if (order.items.length === 0) {
      order.order_status = 'held';
      await this.orderRepo.save(order);
    }

    return this.getOrder(clientId, branchId, orderId);
  }

  async reassignOrderTable(
    clientId: string,
    branchId: number,
    orderId: number,
    tableId?: number,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update POS item status');
    await this.requireOpenShift(clientId, branchId);

    const order = await this.orderRepo.findOne({
      where: { id: orderId, client_id: clientId, branch_id: branchId },
      relations: ['table', 'items'],
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.order_type !== 'dine_in') {
      throw new BadRequestException('Table reassignment only applies to dine-in orders.');
    }
    if (!['held', 'pending', 'preparing', 'ready', 'served'].includes(order.order_status)) {
      throw new BadRequestException('This order can no longer be reassigned.');
    }

    const previousTableId = order.table_id;
    const nextTable = await this.assertTableBelongsToBranch(branchId, tableId);
    order.table_id = nextTable?.id ?? null as any;
    const saved = await this.orderRepo.save(order);

    if (previousTableId && previousTableId !== nextTable?.id) {
      const previousTable = await this.tableRepo.findOne({ where: { id: previousTableId, branch_id: branchId } });
      if (previousTable) {
        previousTable.status = 'vacant';
        await this.tableRepo.save(previousTable);
      }
    }

    if (nextTable) {
      nextTable.status = 'occupied';
      await this.tableRepo.save(nextTable);
    }

    const refreshed = await this.orderRepo.findOne({
      where: { id: saved.id, client_id: clientId, branch_id: branchId },
      relations: ['items', 'items.product', 'table'],
    });
    return this.getOrder(clientId, branchId, refreshed!.id);
  }

  async updateOrderItemStatus(
    clientId: string,
    branchId: number,
    itemId: number,
    itemStatus: string,
    dto?: {
      approval_username?: string;
      approval_pin?: string;
      adjustment_reason?: string;
    },
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'sync POS data');

    const orderItem = await this.orderItemRepo.findOne({
      where: { id: itemId },
      relations: ['order', 'product'],
    });
    if (!orderItem || orderItem.order?.client_id !== clientId || orderItem.order?.branch_id !== branchId) {
      throw new NotFoundException('Order item not found.');
    }

    const nextItemStatus = String(itemStatus || '').toLowerCase();
    let adjustmentDecision: { mode: 'standard' | 'open_return' | 'override'; approver?: UserManagement | null } | null = null;
    if (nextItemStatus === 'voided') {
      adjustmentDecision = await this.assertLateLineAdjustmentAllowed(
        clientId,
        branchId,
        branch,
        orderItem.order,
        orderItem,
        0,
        dto,
      );
    }

    orderItem.item_status = nextItemStatus;
    await this.orderItemRepo.save(orderItem);

    const siblingItems = await this.orderItemRepo.find({
      where: { order_id: orderItem.order_id },
      relations: ['product'],
      order: { created_at: 'ASC' },
    });

    const order = await this.orderRepo.findOne({
      where: { id: orderItem.order_id, client_id: clientId, branch_id: branchId },
      relations: ['items', 'items.product', 'items.product.category', 'items.product.production_station', 'table'],
    });

    order!.items = siblingItems;
    if (nextItemStatus !== 'voided') {
      await this.syncKotDraftFromOrder(order!);
    }
    await this.syncOrderTotals(order!);

    if (nextItemStatus === 'voided' && adjustmentDecision?.mode === 'open_return') {
      await this.appendOrderAuditNote(
        order!,
        `Open-order return recorded for ${orderItem.product_name ?? orderItem.product?.product_name ?? `item ${orderItem.id}`} x${Number(orderItem.quantity || 0)} on ${new Date().toISOString()}.`,
      );
    } else if (nextItemStatus === 'voided' && adjustmentDecision?.mode === 'override') {
      await this.appendOrderAuditNote(
        order!,
        `Authorized override voided ${orderItem.product_name ?? orderItem.product?.product_name ?? `item ${orderItem.id}`} x${Number(orderItem.quantity || 0)} on ${new Date().toISOString()}. Reason: ${dto?.adjustment_reason?.trim()}. Approved by ${adjustmentDecision.approver?.user_name || 'authorized user'}.`,
      );
    }

    const activeStatuses = siblingItems
      .filter((item) => item.item_status !== 'voided')
      .map((item) => item.item_status);
    if (activeStatuses.length === 0) {
      order!.order_status = 'cancelled';
      await this.orderRepo.save(order!);
    } else {
      if (activeStatuses.every((status) => status === 'served')) {
        order!.order_status = 'served';
      } else if (activeStatuses.every((status) => ['ready', 'served'].includes(status))) {
        order!.order_status = 'ready';
      } else if (activeStatuses.some((status) => ['cooking', 'ready', 'served'].includes(status))) {
        order!.order_status = 'preparing';
      } else if (order!.order_status !== 'held') {
        order!.order_status = 'pending';
      }
      await this.orderRepo.save(order!);
    }

    return this.getOrder(clientId, branchId, order!.id);
  }

  async cancelOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    dto: {
      approval_username: string;
      approval_pin: string;
      cancel_reason?: string;
    },
    user?: JwtPayload,
  ) {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId, 'cancel POS orders');
    const shift = await this.requireOpenShift(clientId, branchId);
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (!this.isEditableOpenOrderStatus(order.order_status)) {
      throw new BadRequestException('Only in-progress orders can be cancelled from the terminal.');
    }
    if (order.shift_id && order.shift_id !== shift.id) {
      throw new BadRequestException('Only orders from the active shift can be cancelled.');
    }
    if (
      this.isOutsideTimedWindow(
        order.created_at,
        this.getOrderCancellationWindowMinutes(branch),
      )
    ) {
      throw new BadRequestException(
        `This order can no longer be cancelled after ${this.getOrderCancellationWindowMinutes(branch)} minutes.`,
      );
    }

    const approver = await this.requireAuthorizedPinOverride(
      clientId,
      branchId,
      dto.approval_username,
      dto.approval_pin,
      'cancel POS orders',
    );

    const activeItems = (order.items ?? []).filter((item) => item.item_status !== 'voided');
    if (activeItems.length === 0) {
      throw new BadRequestException('This order is already fully cancelled.');
    }

    const cancelledAt = new Date().toISOString();
    for (const item of activeItems) {
      item.item_status = 'voided';
      await this.orderItemRepo.save(item);
    }

    order.items = (order.items ?? []).map((item) => (
      activeItems.some((activeItem) => activeItem.id === item.id)
        ? { ...item, item_status: 'voided' }
        : item
    )) as OrderItem[];
    order.order_status = 'cancelled';
    order.voided_at = new Date(cancelledAt);
    order.void_reason = dto.cancel_reason?.trim() || null;
    order.void_authorized_by_user_id = approver.id;
    order.void_authorized_by_username = approver.user_name;
    order.order_note = [
      order.order_note?.trim(),
      `Order cancelled by ${approver.user_name}${dto.cancel_reason?.trim() ? `: ${dto.cancel_reason.trim()}` : ''}`,
    ].filter(Boolean).join('\n\n');
    await this.orderRepo.save(order);
    await this.syncKotDraftFromOrder(order);
    await this.syncOrderTotals(order);

    if (order.order_type === 'dine_in' && order.table_id) {
      const table = await this.tableRepo.findOne({ where: { id: order.table_id, branch_id: branchId } });
      if (table) {
        table.status = 'vacant';
        await this.tableRepo.save(table);
      }
    }

    await this.updateKotDraftForOrder(order, (existingEntries) => existingEntries.map((entry) => ({
      ...entry,
      item_status: 'voided',
      is_cancelled: true,
      cancelled_at: cancelledAt,
      changed_at: cancelledAt,
    })));

    await this.operationalAuditService.log({
      user,
      action: 'POS Order Cancelled',
      entity: 'orders',
      clientId,
      branchId,
      entityId: order.id,
      portal: 'Terminal',
      details: `Cancelled order ${order.order_number || order.id}`,
      metadata: {
        order_number: order.order_number,
        approved_by_user_id: approver.id,
        approved_by_username: approver.user_name,
        cancel_reason: dto.cancel_reason?.trim() || null,
      },
    });

    return this.getOrder(clientId, branchId, order.id);
  }

  async handleSync(
    clientId: string,
    branchId: number,
    userId: number,
    payload: any,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const entityType = this.normalizeSyncEntityType(payload?.entity_type);
    const data = payload?.payload;

    if (entityType === 'ORDER') {
      const order = this.orderRepo.create({
        client_id: clientId,
        branch_id: branchId,
        user_id: userId,
        ...data,
      });
      return this.orderRepo.save(order);
    }

    if (entityType === 'KOT') {
      const kot = this.kotRepo.create({
        client_id: clientId,
        branch_id: branchId,
        ...data,
      });
      return this.kotRepo.save(kot);
    }

    if (entityType === 'SHIFT') {
      return this.applyOfflineShiftSnapshot(
        clientId,
        branchId,
        userId,
        await this.registerOrResolveDevice(clientId, branchId, {
          branch_id: branchId,
          device_uid: payload?.device_uid || `legacy-sync-${branchId}`,
        }),
        data,
      );
    }

    if (entityType === 'BUSINESS_DAY') {
      return this.applyOfflineBusinessDaySnapshot(
        clientId,
        branchId,
        userId,
        data,
      );
    }

    if (entityType === 'COUNTER_SESSION') {
      return this.applyOfflineCounterSessionSnapshot(
        clientId,
        branchId,
        userId,
        await this.registerOrResolveDevice(clientId, branchId, {
          branch_id: branchId,
          device_uid: payload?.device_uid || `legacy-sync-${branchId}`,
        }),
        data,
      );
    }

    throw new BadRequestException('Unknown entity type for sync.');
  }

  async handleSyncBatch(
    clientId: string,
    branchId: number,
    userId: number,
    dto: PosSyncBatchDto,
    user?: JwtPayload,
  ) {
    const device = await this.registerOrResolveDevice(clientId, branchId, {
      branch_id: branchId,
      device_uid: dto.device_uid,
      device_code: dto.device_code,
      device_name: dto.device_name,
      device_type: dto.device_type,
      device_os: dto.device_os,
      app_version: dto.app_version,
    });

    const batchId = dto.batch_id?.trim() || randomUUID();
    const sentAt = this.parseOptionalDate(dto.sent_at);
    const results: Array<{
      event_id: string | null;
      status: 'processed' | 'failed' | 'conflict';
      entity_type: string;
      entity_id?: string | null;
      message?: string | null;
      conflict_reason?: string | null;
      resolution_status?: string | null;
    }> = [];

    for (const event of dto.events) {
      const entityType = this.normalizeSyncEntityType(event.entity_type);
      const payloadHash = event.payload_hash || this.computePayloadHash(event);
      const existing = await this.posSyncEventRepo.findOne({
        where: {
          client_id: clientId,
          device_id: device.id,
          device_event_id: event.event_id,
        },
      });

      if (existing?.status === 'conflict' && existing.resolution_status !== 'resolved') {
        results.push(this.buildSyncResult(existing, existing.error_message || 'This sync event is still waiting for reconciliation.'));
        continue;
      }

      if (existing?.resolution_status === 'resolved') {
        results.push({
          event_id: event.event_id,
          status: 'processed',
          entity_type: entityType,
          entity_id: existing.entity_id,
          message: 'Conflict was resolved on the server. Local queue can be cleared.',
          conflict_reason: existing.conflict_reason ?? null,
          resolution_status: existing.resolution_status ?? null,
        });
        continue;
      }

      if (existing?.payload_hash && existing.payload_hash !== payloadHash) {
        existing.batch_id = batchId;
        existing.last_attempt_at = sentAt ?? new Date();
        existing.attempt_count = Number(existing.attempt_count || 0) + 1;
        existing.occurred_at = this.parseOptionalDate(event.queued_at) ?? existing.occurred_at ?? null;
        this.markEventConflict(
          existing,
          'payload_hash_mismatch',
          'Event payload does not match the already recorded event hash.',
        );
        const conflictEvent = await this.posSyncEventRepo.save(existing);
        results.push(this.buildSyncResult(conflictEvent));
        continue;
      }

      if (existing?.status === 'processed') {
        results.push({
          event_id: event.event_id,
          status: 'processed',
          entity_type: entityType,
          entity_id: existing.entity_id,
          message: 'Already processed',
          conflict_reason: existing?.conflict_reason ?? null,
          resolution_status: existing?.resolution_status ?? null,
        });
        continue;
      }

      const eventRow = existing ?? this.posSyncEventRepo.create({
        client_id: clientId,
        branch_id: branchId,
        device_id: device.id,
        device_event_id: event.event_id,
        entity_type: entityType,
        entity_id: event.entity_id ?? null as any,
        event_type: event.event_type ?? 'sync',
        payload_hash: payloadHash,
      });

      eventRow.batch_id = batchId;
      eventRow.branch_id = branchId;
      eventRow.device_id = device.id;
      eventRow.entity_type = entityType;
      eventRow.entity_id = event.entity_id ?? eventRow.entity_id;
      eventRow.event_type = event.event_type ?? 'sync';
      eventRow.payload_hash = payloadHash;
      eventRow.payload_json = JSON.stringify(event);
      eventRow.occurred_at = this.parseOptionalDate(event.queued_at) ?? eventRow.occurred_at ?? null;
      eventRow.status = 'pending';
      eventRow.error_message = null as any;
      eventRow.conflict_reason = null;
      eventRow.resolution_status = null;
      eventRow.resolution_note = null;
      eventRow.resolved_at = null;
      eventRow.resolved_by_user_id = null;
      eventRow.last_attempt_at = sentAt ?? new Date();
      eventRow.attempt_count = Number(eventRow.attempt_count || 0) + 1;

      await this.posSyncEventRepo.save(eventRow);

      try {
        let entityId = event.entity_id ?? null;

        if (entityType === 'ORDER' && event.order) {
          const order = await this.applyOfflineOrderSnapshot(
            clientId,
            branchId,
            userId,
            device,
            event.order,
          );
          entityId = order?.order_number ?? String(order?.id ?? event.entity_id ?? '');
        } else if (entityType === 'KOT' && event.kot) {
          const kot = await this.applyOfflineKotStatus(clientId, branchId, event.kot);
          entityId = kot.kot_number;
        } else if (entityType === 'SHIFT' && event.shift) {
          const shift = await this.applyOfflineShiftSnapshot(
            clientId,
            branchId,
            userId,
            device,
            event.shift,
          );
          entityId = shift.external_shift_id ?? String(shift.id);
        } else if (entityType === 'BUSINESS_DAY' && event.business_day) {
          const businessDay = await this.applyOfflineBusinessDaySnapshot(
            clientId,
            branchId,
            userId,
            event.business_day,
          );
          entityId = String(businessDay.id);
        } else if (entityType === 'COUNTER_SESSION' && event.counter_session) {
          const session = await this.applyOfflineCounterSessionSnapshot(
            clientId,
            branchId,
            userId,
            device,
            event.counter_session,
          );
          entityId = session?.external_session_id ?? String(session?.id ?? '');
        } else {
          throw new BadRequestException(`Unsupported offline sync entity ${entityType}`);
        }

        eventRow.entity_id = entityId;
        eventRow.conflict_reason = null;
        eventRow.status = 'processed';
        eventRow.resolution_status = null;
        eventRow.resolution_note = null;
        eventRow.processed_at = new Date();
        eventRow.resolved_at = null;
        eventRow.resolved_by_user_id = null;
        eventRow.error_message = null as any;
        const savedEvent = await this.posSyncEventRepo.save(eventRow);

        results.push(this.buildSyncResult(savedEvent));
      } catch (error: any) {
        const classified = this.classifySyncError(error);
        eventRow.status = classified.status;
        eventRow.error_message = classified.message;
        eventRow.conflict_reason = classified.conflictReason;
        eventRow.resolution_status = classified.status === 'conflict' ? 'open' : null;
        eventRow.resolution_note = null;
        eventRow.resolved_at = null;
        eventRow.resolved_by_user_id = null;
        const savedEvent = await this.posSyncEventRepo.save(eventRow);

        results.push(this.buildSyncResult(savedEvent));
      }
    }

    const processedCount = results.filter((result) => result.status === 'processed').length;
    const failedCount = results.filter((result) => result.status === 'failed').length;
    const conflictCount = results.filter((result) => result.status === 'conflict').length;
    let latestDevice = device;
    if (conflictCount > 0) {
      latestDevice = await this.updateDeviceSyncStatus(
        device,
        'conflict',
        `${conflictCount} sync event(s) require reconciliation.`,
      );
    } else if (failedCount > 0) {
      latestDevice = await this.updateDeviceSyncStatus(
        device,
        'failed',
        `${failedCount} sync event(s) failed during the last batch.`,
      );
    } else if (processedCount > 0) {
      latestDevice = await this.updateDeviceSyncStatus(
        device,
        'success',
        `${processedCount} sync event(s) processed successfully.`,
      );
    } else {
      latestDevice = await this.updateDeviceSyncStatus(
        device,
        'idle',
        'No pending sync events were processed.',
      );
    }

    if (processedCount > 0) {
      await this.operationalAuditService.log({
        user,
        action: 'POS Offline Sync',
        entity: 'pos_sync_events',
        clientId,
        branchId,
        portal: 'Terminal',
        details: `Processed ${processedCount} offline sync event(s) for device ${device.device_uid}`,
        metadata: {
          device_uid: device.device_uid,
          batch_id: batchId,
          queue_depth: Number(dto.queue_depth || dto.events.length || 0),
          processed: processedCount,
          failed: failedCount,
          conflict: conflictCount,
        },
      });
    }

    return {
      batch_id: batchId,
      device: this.serializeDevice(latestDevice),
      summary: {
        processed: processedCount,
        failed: failedCount,
        conflict: conflictCount,
        queue_depth: Number(dto.queue_depth || dto.events.length || 0),
        sent_at: sentAt,
      },
      results,
    };
  }

  async getSalesSummary(clientId: string, branchId: number, startDate?: string, endDate?: string) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;
    const query = this.orderRepo.createQueryBuilder('order')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' });

    if (parsedStartDate) {
      query.andWhere('order.created_at >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      query.andWhere('order.created_at <= :endDate', { endDate: parsedEndDate });
    }

    const { totalRevenue, totalOrders } = await query
      .select('SUM(order.total_amount)', 'totalRevenue')
      .addSelect('COUNT(order.id)', 'totalOrders')
      .getRawOne();

    const paymentSummaryQuery = this.transactionRepo.createQueryBuilder('transaction')
      .innerJoin('transaction.order', 'order')
      .where('transaction.client_id = :clientId', { clientId })
      .andWhere('transaction.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .andWhere('transaction.is_refund = :isRefund', { isRefund: false })
      .select([
        `SUM(CASE WHEN transaction.payment_mode = 'cash' THEN transaction.amount ELSE 0 END) AS cash_sales`,
        `SUM(CASE WHEN transaction.payment_mode = 'card' THEN transaction.amount ELSE 0 END) AS card_sales`,
        `SUM(CASE WHEN transaction.payment_mode = 'bank' THEN transaction.amount ELSE 0 END) AS bank_sales`,
        `SUM(CASE WHEN transaction.payment_mode = 'digital_wallet' THEN transaction.amount ELSE 0 END) AS wallet_sales`,
        `SUM(CASE WHEN transaction.payment_mode = 'other' THEN transaction.amount ELSE 0 END) AS other_sales`,
      ]);

    if (parsedStartDate) {
      paymentSummaryQuery.andWhere('order.created_at >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      paymentSummaryQuery.andWhere('order.created_at <= :endDate', { endDate: parsedEndDate });
    }

    const refundSummaryQuery = this.transactionRepo.createQueryBuilder('transaction')
      .where('transaction.client_id = :clientId', { clientId })
      .andWhere('transaction.branch_id = :branchId', { branchId })
      .andWhere('transaction.is_refund = :isRefund', { isRefund: true })
      .select([
        `SUM(CASE WHEN transaction.payment_mode = 'cash' THEN transaction.amount ELSE 0 END) AS refunds_cash`,
        `SUM(CASE WHEN transaction.payment_mode = 'card' THEN transaction.amount ELSE 0 END) AS refunds_card`,
        `SUM(CASE WHEN transaction.payment_mode = 'bank' THEN transaction.amount ELSE 0 END) AS refunds_bank`,
        `SUM(CASE WHEN transaction.payment_mode = 'digital_wallet' THEN transaction.amount ELSE 0 END) AS refunds_wallet`,
        `SUM(CASE WHEN transaction.payment_mode = 'other' THEN transaction.amount ELSE 0 END) AS refunds_other`,
        'SUM(transaction.amount) AS refunds_total',
      ]);

    if (parsedStartDate) {
      refundSummaryQuery.andWhere('transaction.transaction_date >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      refundSummaryQuery.andWhere('transaction.transaction_date <= :endDate', { endDate: parsedEndDate });
    }

    const discountsQuery = this.orderRepo.createQueryBuilder('order')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .select('SUM(order.discount_amount)', 'discount_amount')
      .addSelect(`SUM(CASE WHEN LOWER(order.payment_status) = 'credited' THEN order.total_amount ELSE 0 END)`, 'credit_sales')
      .addSelect(`SUM(CASE WHEN LOWER(order.payment_status) = 'credited' THEN 1 ELSE 0 END)`, 'credit_orders');

    if (parsedStartDate) {
      discountsQuery.andWhere('order.created_at >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      discountsQuery.andWhere('order.created_at <= :endDate', { endDate: parsedEndDate });
    }

    const voidsQuery = this.orderRepo.createQueryBuilder('order')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status IN (:...statuses)', { statuses: ['cancelled', 'voided'] })
      .select('COUNT(order.id)', 'void_count')
      .addSelect('SUM(order.total_amount)', 'void_amount');

    if (parsedStartDate) {
      voidsQuery.andWhere('order.updated_at >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      voidsQuery.andWhere('order.updated_at <= :endDate', { endDate: parsedEndDate });
    }

    const returnsQuery = this.orderReturnRepo.createQueryBuilder('order_return')
      .where('order_return.client_id = :clientId', { clientId })
      .andWhere('order_return.branch_id = :branchId', { branchId })
      .select('COUNT(order_return.id)', 'return_count')
      .addSelect('SUM(order_return.refund_amount)', 'return_amount');

    if (parsedStartDate) {
      returnsQuery.andWhere('order_return.created_at >= :startDate', { startDate: parsedStartDate });
    }
    if (parsedEndDate) {
      returnsQuery.andWhere('order_return.created_at <= :endDate', { endDate: parsedEndDate });
    }

    const [paymentSummary, refundSummary, discountsSummary, voidSummary, returnSummary] = await Promise.all([
      paymentSummaryQuery.getRawOne(),
      refundSummaryQuery.getRawOne(),
      discountsQuery.getRawOne(),
      voidsQuery.getRawOne(),
      returnsQuery.getRawOne(),
    ]);

    const revenue = Number(totalRevenue) || 0;
    const orders = Number(totalOrders) || 0;
    const averageOrderValue = orders > 0 ? revenue / orders : 0;
    const cashSales = Number(paymentSummary?.cash_sales) || 0;
    const cardSales = Number(paymentSummary?.card_sales) || 0;
    const bankSales = Number(paymentSummary?.bank_sales) || 0;
    const walletSales = Number(paymentSummary?.wallet_sales) || 0;
    const otherSales = Number(paymentSummary?.other_sales) || 0;
    const refundsTotal = Number(refundSummary?.refunds_total) || 0;
    const creditSales = Number(discountsSummary?.credit_sales) || 0;

    return {
      totalRevenue: revenue,
      totalOrders: orders,
      averageOrderValue,
      paymentMix: {
        cash: this.roundCurrency(cashSales),
        card: this.roundCurrency(cardSales),
        bank: this.roundCurrency(bankSales),
        digital_wallet: this.roundCurrency(walletSales),
        other: this.roundCurrency(otherSales),
        non_cash: this.roundCurrency(cardSales + bankSales + walletSales + otherSales),
        refunds_cash: this.roundCurrency(Number(refundSummary?.refunds_cash) || 0),
        refunds_card: this.roundCurrency(Number(refundSummary?.refunds_card) || 0),
        refunds_bank: this.roundCurrency(Number(refundSummary?.refunds_bank) || 0),
        refunds_wallet: this.roundCurrency(Number(refundSummary?.refunds_wallet) || 0),
        refunds_other: this.roundCurrency(Number(refundSummary?.refunds_other) || 0),
        refunds_total: this.roundCurrency(refundsTotal),
        net_collected: this.roundCurrency(cashSales + cardSales + bankSales + walletSales + otherSales - refundsTotal),
      },
      exceptions: {
        discounts: this.roundCurrency(Number(discountsSummary?.discount_amount) || 0),
        returns_count: Number(returnSummary?.return_count) || 0,
        returns_amount: this.roundCurrency(Number(returnSummary?.return_amount) || 0),
        void_count: Number(voidSummary?.void_count) || 0,
        void_amount: this.roundCurrency(Number(voidSummary?.void_amount) || 0),
        credit_orders: Number(discountsSummary?.credit_orders) || 0,
        credit_sales: this.roundCurrency(creditSales),
      },
    };
  }

  async getTopItems(
    clientId: string,
    branchId: number,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const query = this.orderItemRepo.createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .where('order.client_id = :clientId', { clientId })
      .andWhere('order.branch_id = :branchId', { branchId })
      .andWhere('order.order_status = :status', { status: 'completed' })
      .select('product.product_name', 'product_name')
      .addSelect('SUM(item.quantity)', 'quantity_sold')
      .addSelect('SUM(item.quantity * item.item_price)', 'revenue')
      .groupBy('product.id')
      .addGroupBy('product.product_name')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(limit);

    if (startDate) {
      query.andWhere('order.created_at >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      query.andWhere('order.created_at <= :endDate', { endDate: new Date(endDate) });
    }

    return query.getRawMany();
  }

  async getKots(clientId: string, branchId: number, status?: string): Promise<any[]> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'update KOT status');
    const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });

    const query = this.kotRepo.createQueryBuilder('kot')
      .where('kot.client_id = :clientId', { clientId })
      .andWhere('kot.branch_id = :branchId', { branchId });

    if (status) {
      query.andWhere('kot.status = :status', { status });
    }

    query.orderBy('kot.created_at', 'ASC');
    const rawKots = await query.getMany();
    const groupedByOrderId = new Map<string, KOT[]>();
    for (const kot of rawKots) {
      const bucket = groupedByOrderId.get(String(kot.order_id)) ?? [];
      bucket.push(kot);
      groupedByOrderId.set(String(kot.order_id), bucket);
    }

    const orderIds = Array.from(groupedByOrderId.keys())
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const relatedOrders = orderIds.length > 0
      ? await this.orderRepo.find({
        where: { id: In(orderIds), client_id: clientId, branch_id: branchId },
        relations: ['table', 'cashier', 'sale_counter'],
      })
      : [];
    const orderById = new Map(relatedOrders.map((order) => [String(order.id), order]));

    const serializedKots = await Promise.all(Array.from(groupedByOrderId.entries())
      .map(async ([orderId, siblingKots]) => {
        const mergedEntries = new Map<string, any>();
        for (const kot of siblingKots) {
          for (const entry of this.parseKotItemsJson(kot.items_json)) {
            const key = String(entry?.order_item_id ?? entry?.id ?? randomUUID());
            mergedEntries.set(key, { ...(mergedEntries.get(key) ?? {}), ...entry });
          }
        }

        const primaryKot = siblingKots[siblingKots.length - 1];
        const relatedOrder = orderById.get(orderId);
        const items = Array.from(mergedEntries.values()).map((entry) => ({
          ...entry,
          name: entry?.product_name ?? entry?.name ?? `Product #${entry?.product_id ?? 'N/A'}`,
        }));
        const generatedBy =
          relatedOrder?.cashier?.full_name
          ?? relatedOrder?.cashier?.user_name
          ?? null;
        const kotVersions = siblingKots.map((kot, index) => {
          const versionItems = this.parseKotItemsJson(kot.items_json).map((entry) => ({
            ...entry,
            name: entry?.product_name ?? entry?.name ?? `Product #${entry?.product_id ?? 'N/A'}`,
          }));

          return {
            id: kot.id,
            kot_number: kot.kot_number,
            kot_version: index + 1,
            status: kot.status,
            type: kot.type,
            created_at: kot.created_at,
            updated_at: kot.updated_at,
            generated_by: generatedBy,
            items: versionItems,
            items_json: JSON.stringify(versionItems),
          };
        });
        const persistedStatus = String(primaryKot.status || '').toLowerCase();
        const mergedStatus = ['pending', 'preparing', 'ready', 'completed', 'cancelled', 'recalled'].includes(persistedStatus)
          ? persistedStatus
          : this.deriveKotStatusFromEntries(items, String(primaryKot.status || 'pending'));

        const currentKotNumber =
          relatedOrder?.kot_base_number && Number(relatedOrder?.kot_version || 0) > 0
            ? await this.buildKotNumber(
              clientId,
              branchId,
              Number(relatedOrder.kot_base_number || 0),
              Number(relatedOrder.kot_version || 0),
              relatedOrder.sale_counter?.code ?? String(relatedOrder.sale_counter_id || ''),
              null,
              branch,
            )
            : relatedOrder?.kot_base_number
              ? this.formatKotBaseNumber(relatedOrder.kot_base_number)
              : primaryKot.kot_number;

        return {
          ...primaryKot,
          kot_number: currentKotNumber,
          status: mergedStatus,
          items,
          items_json: JSON.stringify(items),
          order_number: relatedOrder?.order_number ?? `ORD-${orderId}`,
          kot_base_number: relatedOrder?.kot_base_number ?? null,
          kot_base_display: relatedOrder?.kot_base_number ? this.formatKotBaseNumber(relatedOrder.kot_base_number) : null,
          kot_version: Number(relatedOrder?.kot_version || 0),
          kot_versions: kotVersions,
          current_kot_number: currentKotNumber,
          current_kot_display_number: currentKotNumber,
          table_number: relatedOrder?.table?.table_number ?? null,
          notes: relatedOrder?.order_note ?? null,
          order_note: relatedOrder?.order_note ?? null,
          waiter:
            generatedBy,
          created_at: relatedOrder?.created_at ?? siblingKots[0]?.created_at ?? primaryKot.created_at,
        };
      }));

    return serializedKots
      .filter((kot) => {
        const normalizedStatus = String(kot.status || '').toLowerCase();
        if (status) {
          return normalizedStatus === String(status || '').toLowerCase();
        }
        return normalizedStatus !== 'cleared';
      });
  }

  async updateKotStatus(clientId: string, branchId: number, kotId: string, status: string): Promise<KOT> {
    await this.assertBranchBelongsToClient(clientId, branchId, 'close POS orders');

    const kot = await this.kotRepo.findOne({
      where: { id: kotId, client_id: clientId, branch_id: branchId },
    });

    if (!kot) throw new NotFoundException('KOT not found.');

    kot.status = status;
    const orderId = Number(kot.order_id);
    if (Number.isInteger(orderId) && orderId > 0) {
      const order = await this.orderRepo.findOne({
        where: { id: orderId, client_id: clientId, branch_id: branchId },
        relations: ['items', 'items.product', 'items.product.category', 'items.product.production_station', 'table', 'transactions', 'charges'],
      });

      if (order) {
        const itemsNeedingSave: OrderItem[] = [];
        if (status === 'preparing') {
          for (const item of order.items) {
            if (item.item_status === 'pending') {
              item.item_status = 'cooking';
              itemsNeedingSave.push(item);
            }
          }
          if (itemsNeedingSave.length > 0) {
            await this.orderItemRepo.save(itemsNeedingSave);
          }
          if (!['completed', 'cancelled', 'voided'].includes(order.order_status)) {
            order.order_status = 'preparing';
          }
        } else if (status === 'ready') {
          for (const item of order.items) {
            if (!['served', 'voided'].includes(item.item_status)) {
              item.item_status = 'served';
              itemsNeedingSave.push(item);
            }
          }
          if (itemsNeedingSave.length > 0) {
            await this.orderItemRepo.save(itemsNeedingSave);
          }
          if (!['completed', 'cancelled', 'voided'].includes(order.order_status)) {
            order.order_status = 'ready';
          }
        } else if (status === 'completed') {
          for (const item of order.items) {
            if (!['voided'].includes(item.item_status)) {
              item.item_status = 'served';
              itemsNeedingSave.push(item);
            }
          }
          if (itemsNeedingSave.length > 0) {
            await this.orderItemRepo.save(itemsNeedingSave);
          }
          if (!['completed', 'cancelled', 'voided'].includes(order.order_status)) {
            order.order_status = 'served';
          }
        }

        await this.orderRepo.save(order);
        await this.syncKotDraftFromOrder(order);
      }
    }

    return this.kotRepo.save(kot);
  }

  async closeOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    dto?: {
      voucher_code?: string;
      customer_id?: number;
      order_taker_user_id?: number;
      payment_mode?: string;
      reference_number?: string;
      payments?: PosPaymentDto[];
      discount_amount?: number;
      service_charge_amount?: number;
      tax_amount?: number;
      skip_tax?: boolean;
      tax_code?: string;
      payment_note?: string;
      delivery_details?: PosDeliveryDetailsDto;
    },
    user?: JwtPayload,
  ): Promise<any> {
    let checkoutStage = 'loading the order';

    try {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId);
    let shift = await this.requireOpenShift(clientId, branchId);
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (order.order_status === 'completed') {
      throw new BadRequestException('Order is already closed.');
    }
    if (['cancelled', 'voided'].includes(order.order_status)) {
      throw new BadRequestException('Cancelled or voided orders cannot be finalized.');
    }
    if ((order.items ?? []).filter((item) => item.item_status !== 'voided').length === 0) {
      throw new BadRequestException('At least one active order item is required before checkout.');
    }
    if (order.shift_id && order.shift_id !== shift.id) {
      throw new BadRequestException('This order does not belong to the active shift.');
    }

    if (dto?.customer_id) {
      order.customer_id = dto.customer_id;
    }
    if (dto?.order_taker_user_id) {
      const orderTakerUser = await this.requireBranchStaff(clientId, dto.order_taker_user_id);
      order.user_id = orderTakerUser.id;
    }
    if (order.customer_id) {
      await this.customersService.getCustomerDetail(clientId, order.customer_id);
    }
    order.delivery_details = this.normalizeOrderType(order.order_type) === 'delivery'
      ? this.normalizeDeliveryDetails(dto?.delivery_details ?? order.delivery_details)
      : null;

    const manualDiscountAmount = this.ensureNonNegativeMoney(
      dto?.discount_amount ?? order.discount_amount ?? 0,
      'Discount amount',
    );
    const voucherBaseAmount = this.roundCurrency(
      Math.max(Number(order.sub_total || 0) - manualDiscountAmount, 0),
    );

    let voucherDiscountAmount = 0;
    let voucherId: number | null = order.voucher_id ?? null;
    if (dto?.voucher_code) {
      const validation = await this.dealsService.validateVoucher(
        clientId,
        dto.voucher_code,
        voucherBaseAmount,
        {
          branchId,
          customerId: order.customer_id ?? undefined,
          orderType: this.normalizeOrderType(order.order_type),
          excludeOrderId: order.id,
        },
      );
      voucherDiscountAmount = this.ensureNonNegativeMoney(
        validation.discount_amount,
        'Voucher discount',
      );
      voucherId = validation.voucher_id;
    }

    const payments: PosPaymentDto[] = dto?.payments?.length
      ? dto.payments.map((payment) => ({
          ...payment,
          payment_mode: this.normalizePaymentMode(payment.payment_mode),
          amount: this.ensureNonNegativeMoney(payment.amount, 'Payment amount'),
        }))
      : dto?.payment_mode
        ? [{
            payment_mode: this.normalizePaymentMode(dto.payment_mode),
            amount: 0,
            reference_number: dto.reference_number,
            notes: dto.payment_note,
          }]
        : [];

    const activeCharges = await this.resolvePricingCharges(
      clientId,
      branchId,
      this.normalizeOrderType(order.order_type),
      dto?.skip_tax === true ? null : dto?.tax_code,
      dto?.skip_tax === true ? 0 : dto?.tax_amount,
    );
    const pricing = this.calculateOrderTotals(activeCharges, {
      orderType: this.normalizeOrderType(order.order_type),
      items: (order.items ?? []).filter((item) => item.item_status !== 'voided'),
      manualDiscountAmount,
      voucherDiscountAmount,
      serviceChargeAmount: dto?.service_charge_amount,
      skipTax: dto?.skip_tax === true,
      payments,
    });

    if (payments.length === 1 && payments[0].amount === 0) {
      payments[0].amount = pricing.totalAmount;
    }

    const paymentTotal = this.roundCurrency(
      payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );

    if (payments.length === 0) {
      throw new BadRequestException('Payment details are required to finalize the order.');
    }
    if (Math.abs(paymentTotal - pricing.totalAmount) > 0.01) {
      throw new BadRequestException(
        `Payment total ${paymentTotal.toFixed(2)} must match the final order total ${pricing.totalAmount.toFixed(2)}.`,
      );
    }

    checkoutStage = 'resetting order charges';

    try {
      await this.orderChargeRepo.delete({ order_id: order.id });
    } catch (error) {
      this.rethrowCheckoutStageError('resetting order charges', error);
    }

    if (!order.id) {
      throw new Error('Cannot finalize POS sale: missing order ID.');
    }

    for (const chargeLine of pricing.chargeLines) {
      checkoutStage = 'saving tax and charge lines';
      try {
        await this.orderChargeRepo.insert({
          ...chargeLine,
          order_id: order.id,
          client_id: clientId,
          branch_id: branchId,
        });
      } catch (error) {
        this.rethrowCheckoutStageError('saving tax and charge lines', error);
      }
    }

    const actorId = typeof user?.sub === 'string' ? Number(user.sub) : Number(user?.sub ?? order.user_id);
    try {
      checkoutStage = 'resetting payment transactions';
      await this.transactionRepo.delete({ order_id: order.id });
    } catch (error) {
      this.rethrowCheckoutStageError('resetting payment transactions', error);
    }
    for (const payment of payments) {
      checkoutStage = 'saving payment transactions';
      try {
        await this.transactionRepo.insert({
          order_id: order.id,
          client_id: clientId,
          branch_id: branchId,
          user_id: Number.isFinite(actorId) ? actorId : order.user_id,
          shift_id: shift.id,
          amount: payment.amount,
          payment_mode: this.normalizePaymentMode(payment.payment_mode),
          reference_number: payment.reference_number?.trim() || null,
          payment_details: this.normalizePaymentDetails(payment.payment_details),
          is_refund: false,
        });
      } catch (error) {
        this.rethrowCheckoutStageError('saving payment transactions', error);
      }
    }

    const finalizedAt = new Date();
    const finalizedByUserId = Number.isFinite(actorId) ? actorId : null;
    const receiptNumber = order.receipt_number ?? await this.generateReceiptNumber(clientId, branch);
    order.user_id = order.user_id;
    order.customer_id = order.customer_id ?? null;
    order.voucher_id = voucherId;
    order.discount_amount = pricing.discountAmount;
    order.tax_amount = pricing.taxAmount;
    order.sub_total = pricing.subTotal;
    order.total_amount = pricing.totalAmount;
    order.delivery_details = order.delivery_details ?? null;
    order.order_status = 'completed';
    order.payment_status = 'paid';
    order.finalized_at = finalizedAt;
    order.finalized_by_user_id = finalizedByUserId;
    order.receipt_number = receiptNumber;
    checkoutStage = 'saving final order totals';
    await this.orderRepo.update(order.id, {
      user_id: order.user_id,
      customer_id: order.customer_id ?? null,
      voucher_id: voucherId,
      discount_amount: pricing.discountAmount,
      tax_amount: pricing.taxAmount,
      sub_total: pricing.subTotal,
      total_amount: pricing.totalAmount,
      delivery_details: (order.delivery_details ?? null) as any,
      order_status: 'completed',
      payment_status: 'paid',
      finalized_at: finalizedAt,
      finalized_by_user_id: finalizedByUserId,
      receipt_number: receiptNumber,
    });

    checkoutStage = 'refreshing shift cash totals';
    shift = await this.refreshShiftExpectedCash(shift);

    if (dto?.voucher_code) {
      checkoutStage = 'redeeming the voucher';
      const redemption = await this.dealsService.redeemVoucherForOrder(clientId, {
        branchId,
        orderId: order.id,
        customerId: order.customer_id,
        code: dto.voucher_code,
        orderTotal: voucherBaseAmount,
        orderType: this.normalizeOrderType(order.order_type),
        redeemedByUserId: Number.isFinite(actorId) ? actorId : null,
      });
      order.voucher_id = redemption.voucher_id;
      await this.orderRepo.update(order.id, {
        voucher_id: redemption.voucher_id,
      });
    }

    if (order.customer_id) {
      checkoutStage = 'updating customer loyalty';
      await this.customersService.awardLoyaltyPointsForOrder(
        clientId,
        branchId,
        order.customer_id,
        order.id,
        pricing.totalAmount,
        Number.isFinite(actorId) ? actorId : undefined,
      );
    }

    const depletionList: { item_id: number; quantity: number }[] = [];

    for (const orderItem of order.items) {
      if (orderItem.item_status === 'voided') {
        continue;
      }

      const recipes = await this.recipeService.findByProduct(clientId, orderItem.product_id);

      if (recipes.length > 0) {
        const primaryRecipe = recipes[0];
        const details = await this.recipeService.getRecipeDetails(clientId, primaryRecipe.id);

        for (const ingredient of details.ingredients) {
          const consumption = Number(ingredient.quantity)
            * Number(orderItem.quantity)
            * (1 + Number(ingredient.wastage_percentage) / 100);

          depletionList.push({
            item_id: ingredient.item_id,
            quantity: consumption,
          });
        }
      }
    }

    let depletionResults: Array<{ extended_cost: number }> = [];
    if (depletionList.length > 0) {
      checkoutStage = 'posting inventory depletion';
      depletionResults = await this.inventoryOpService.depleteStock(clientId, branchId, {
        reference_id: `SALE-ORD-${orderId}`,
        items: depletionList,
      });
    }

    if (order.table_id) {
      checkoutStage = 'releasing the table';
      const table = await this.tableRepo.findOne({ where: { id: order.table_id, branch_id: branchId } });
      if (table) {
        table.status = 'vacant';
        await this.tableRepo.save(table);
      }
    }

    const cashAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1101',
      'Cash on Hand',
      'asset',
    );
      const bankAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '1102',
        'Bank Current Account',
        'asset',
      );
      const merchantClearingAccount = await this.accountingService.ensureDefaultAccount(
        clientId,
        '1103',
        'Merchant Settlement Clearing',
        'asset',
      );
    const receivableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1210',
      'Accounts Receivable',
      'asset',
    );
    const salesAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4100',
      'Food Sales',
      'revenue',
    );
    const serviceChargeAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4200',
      'Service Charges',
      'revenue',
    );
    const taxPayableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '2301',
      'GST Payable',
      'liability',
    );
    const cogsAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '5100',
      'Cost of Goods Sold',
      'expense',
    );
    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1300',
      'Raw Materials Inventory',
      'asset',
    );

      if (pricing.totalAmount > 0) {
        checkoutStage = 'posting accounting journal entries';
        const journalItems = payments.map((payment) => ({
          account_id: this.resolvePosTenderAccountId(payment.payment_mode, {
            cashAccountId: cashAccount.id,
            bankAccountId: bankAccount.id,
            merchantClearingAccountId: merchantClearingAccount.id,
          }),
          debit: this.roundCurrency(payment.amount),
          credit: 0,
        }));

      const foodSalesAmount = this.roundCurrency(
        Math.max(Number(pricing.subTotal) - Number(pricing.discountAmount), 0),
      );
      const serviceChargeAmount = this.roundCurrency(pricing.otherChargesAmount);
      const taxAmount = this.roundCurrency(pricing.taxAmount);
      const recognizedRevenueAmount = this.roundCurrency(foodSalesAmount + serviceChargeAmount + taxAmount);
      const receivedAmount = this.roundCurrency(
        payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      );
      const receivableAmount = this.roundCurrency(Math.max(recognizedRevenueAmount - receivedAmount, 0));

      if (receivableAmount > 0) {
        journalItems.push({
          account_id: receivableAccount.id,
          debit: receivableAmount,
          credit: 0,
        });
      }

      if (foodSalesAmount > 0) {
        journalItems.push({
          account_id: salesAccount.id,
          debit: 0,
          credit: foodSalesAmount,
        });
      }
      if (serviceChargeAmount > 0) {
        journalItems.push({
          account_id: serviceChargeAccount.id,
          debit: 0,
          credit: serviceChargeAmount,
        });
      }
      if (taxAmount > 0) {
        journalItems.push({
          account_id: taxPayableAccount.id,
          debit: 0,
          credit: taxAmount,
        });
      }

      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: order.finalized_at ?? new Date(),
        description: `POS Sale - Order ${orderId}`,
        reference_id: order.receipt_number ?? `SALE-ORD-${orderId}`,
        source_module: 'pos',
        source_entity_type: 'order',
        source_entity_id: String(order.id),
        source_event: 'sale_receipt',
        posting_type: 'auto',
        items: journalItems,
      });
    }

    const costOfGoodsSold = this.roundCurrency(
      depletionResults.reduce((sum, line) => sum + Number(line.extended_cost || 0), 0),
    );
    if (costOfGoodsSold > 0) {
      checkoutStage = 'posting cost of goods sold';
      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: order.finalized_at ?? new Date(),
        description: `COGS - Order ${orderId}`,
        reference_id: order.receipt_number ?? `SALE-ORD-${orderId}`,
        source_module: 'pos',
        source_entity_type: 'order',
        source_entity_id: String(order.id),
        source_event: 'inventory_consumption',
        posting_type: 'auto',
        items: [
          { account_id: cogsAccount.id, debit: costOfGoodsSold, credit: 0 },
          { account_id: inventoryAccount.id, debit: 0, credit: costOfGoodsSold },
        ],
      });
    }

    checkoutStage = 'writing the audit trail';
    await this.operationalAuditService.log({
      user,
      action: 'POS Sale Complete',
      entity: 'orders',
      clientId,
      branchId,
      entityId: order.id,
      portal: 'Terminal',
      details: `Closed order ${order.id}`,
      metadata: {
        receipt_number: order.receipt_number,
        total_amount: pricing.totalAmount,
        payment_modes: payments.map((payment) => payment.payment_mode),
        customer_id: order.customer_id ?? null,
        shift_id: shift.id,
      },
    });

    checkoutStage = 'loading the final receipt';
    return this.getOrder(clientId, branchId, order.id);
  } catch (error) {
    this.rethrowCheckoutStageError(checkoutStage, error);
  }
  }

  async creditSaleOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    dto?: {
      voucher_code?: string;
      customer_id?: number;
      order_taker_user_id?: number;
      discount_amount?: number;
      service_charge_amount?: number;
      tax_amount?: number;
      skip_tax?: boolean;
      tax_code?: string;
      payment_note?: string;
      delivery_details?: PosDeliveryDetailsDto;
    },
    user?: JwtPayload,
  ): Promise<any> {
    let checkoutStage = 'loading the order';

    try {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId);
    let shift = await this.requireOpenShift(clientId, branchId);
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (order.order_status === 'completed') {
      throw new BadRequestException('Order is already closed.');
    }
    if (['cancelled', 'voided'].includes(order.order_status)) {
      throw new BadRequestException('Cancelled or voided orders cannot be finalized.');
    }
    if ((order.items ?? []).filter((item) => item.item_status !== 'voided').length === 0) {
      throw new BadRequestException('At least one active order item is required before credit sale.');
    }
    if (order.shift_id && order.shift_id !== shift.id) {
      throw new BadRequestException('This order does not belong to the active shift.');
    }

    if (dto?.customer_id) {
      order.customer_id = dto.customer_id;
    }
    if (dto?.order_taker_user_id) {
      order.user_id = dto.order_taker_user_id;
    }
    if (order.customer_id) {
      await this.customersService.getCustomerDetail(clientId, order.customer_id);
    }

    const manualDiscountAmount = this.ensureNonNegativeMoney(
      dto?.discount_amount ?? order.discount_amount ?? 0,
      'Discount amount',
    );
    const voucherBaseAmount = this.roundCurrency(
      Math.max(Number(order.sub_total || 0) - manualDiscountAmount, 0),
    );

    let voucherDiscountAmount = 0;
    let voucherId: number | null = order.voucher_id ?? null;
    if (dto?.voucher_code) {
      const validation = await this.dealsService.validateVoucher(
        clientId,
        dto.voucher_code,
        voucherBaseAmount,
        {
          branchId,
          customerId: order.customer_id ?? undefined,
          orderType: this.normalizeOrderType(order.order_type),
          excludeOrderId: order.id,
        },
      );
      voucherDiscountAmount = this.ensureNonNegativeMoney(
        validation.discount_amount,
        'Voucher discount',
      );
      voucherId = validation.voucher_id;
    }

    const activeCharges = await this.resolvePricingCharges(
      clientId,
      branchId,
      this.normalizeOrderType(order.order_type),
      dto?.skip_tax === true ? null : dto?.tax_code,
      dto?.skip_tax === true ? 0 : dto?.tax_amount,
    );
    const pricing = this.calculateOrderTotals(activeCharges, {
      orderType: this.normalizeOrderType(order.order_type),
      items: (order.items ?? []).filter((item) => item.item_status !== 'voided'),
      manualDiscountAmount,
      voucherDiscountAmount,
      serviceChargeAmount: dto?.service_charge_amount,
      skipTax: dto?.skip_tax === true,
      payments: [],
    });

    if (order.customer_id) {
      const customer = await this.customersService.getCustomerDetail(clientId, order.customer_id);
      const customerStatus = String(customer?.status ?? 'active').trim().toLowerCase();
      const allowCredit = Boolean(customer?.allow_credit);
      const creditLimit = this.roundCurrency(Number(customer?.credit_limit || 0));
      const creditControlMode = String(customer?.credit_control_mode ?? 'block').trim().toLowerCase() === 'warn'
        ? 'warn'
        : 'block';
      if (customerStatus !== 'active') {
        throw new BadRequestException('Only active customers can be used for new credit sales.');
      }
      if (!allowCredit) {
        throw new BadRequestException('Credit sale is blocked because this customer is not approved for credit.');
      }
      if (creditLimit > 0.009) {
        const receivables = await this.accountingService.getReceivablesAging(
          clientId,
          undefined,
          new Date().toISOString().slice(0, 10),
          order.customer_id,
        );
        const existingExposure = this.roundCurrency(
          Number(receivables?.customer_rollup?.[0]?.outstanding_amount ?? 0),
        );
        const projectedExposure = this.roundCurrency(existingExposure + Number(pricing.totalAmount || 0));
        if (projectedExposure - creditLimit > 0.009) {
          if (creditControlMode === 'block') {
            throw new BadRequestException(
              `Credit limit exceeded. Current exposure ${existingExposure.toFixed(2)}, new credit ${Number(pricing.totalAmount || 0).toFixed(2)}, limit ${creditLimit.toFixed(2)}.`,
            );
          }
        }
      }
    }

    checkoutStage = 'resetting order charges';
    await this.orderChargeRepo.delete({ order_id: order.id });

    if (!order.id) {
      throw new Error('Cannot mark POS order as credit: missing order ID.');
    }

    for (const chargeLine of pricing.chargeLines) {
      checkoutStage = 'saving tax and charge lines';
      await this.orderChargeRepo.insert({
        ...chargeLine,
        order_id: order.id,
        client_id: clientId,
        branch_id: branchId,
      });
    }

    checkoutStage = 'resetting payment transactions';
    await this.transactionRepo.delete({ order_id: order.id });

    const actorId = typeof user?.sub === 'string' ? Number(user.sub) : Number(user?.sub ?? order.user_id);
    const finalizedAt = new Date();
    const finalizedByUserId = Number.isFinite(actorId) ? actorId : null;
    const receiptNumber = order.receipt_number ?? await this.generateReceiptNumber(clientId, branch);

    order.user_id = dto?.order_taker_user_id ?? order.user_id;
    order.customer_id = order.customer_id ?? null;
    order.voucher_id = voucherId;
    order.discount_amount = pricing.discountAmount;
    order.tax_amount = pricing.taxAmount;
    order.sub_total = pricing.subTotal;
    order.total_amount = pricing.totalAmount;
    order.delivery_details = order.delivery_details ?? null;
    order.order_status = 'completed';
    order.payment_status = 'credited';
    order.finalized_at = finalizedAt;
    order.finalized_by_user_id = finalizedByUserId;
    order.receipt_number = receiptNumber;
    checkoutStage = 'saving final order totals';
    try {
      await this.orderRepo.save(order);
    } catch (error) {
      this.rethrowCheckoutStageError('saving final order totals', error);
    }

    checkoutStage = 'refreshing shift cash totals';
    try {
      shift = await this.refreshShiftExpectedCash(shift);
    } catch (error) {
      this.rethrowCheckoutStageError('refreshing shift cash totals', error);
    }

    if (dto?.voucher_code) {
      checkoutStage = 'redeeming the voucher';
      try {
        const redemption = await this.dealsService.redeemVoucherForOrder(clientId, {
          branchId,
          orderId: order.id,
          customerId: order.customer_id,
          code: dto.voucher_code,
          orderTotal: voucherBaseAmount,
          orderType: this.normalizeOrderType(order.order_type),
          redeemedByUserId: Number.isFinite(actorId) ? actorId : null,
        });
        order.voucher_id = redemption.voucher_id;
        await this.orderRepo.update(order.id, {
          voucher_id: redemption.voucher_id,
        });
      } catch (error) {
        this.rethrowCheckoutStageError('redeeming the voucher', error);
      }
    }

    if (order.customer_id) {
      checkoutStage = 'awarding customer loyalty points';
      try {
        await this.customersService.awardLoyaltyPointsForOrder(
          clientId,
          branchId,
          order.customer_id,
          order.id,
          pricing.totalAmount,
          Number.isFinite(actorId) ? actorId : undefined,
        );
      } catch (error) {
        this.rethrowCheckoutStageError('awarding customer loyalty points', error);
      }
    }

    const depletionList: { item_id: number; quantity: number }[] = [];

    for (const orderItem of order.items) {
      if (orderItem.item_status === 'voided') {
        continue;
      }

      const recipes = await this.recipeService.findByProduct(clientId, orderItem.product_id);

      if (recipes.length > 0) {
        const primaryRecipe = recipes[0];
        const details = await this.recipeService.getRecipeDetails(clientId, primaryRecipe.id);

        for (const ingredient of details.ingredients) {
          const consumption = Number(ingredient.quantity)
            * Number(orderItem.quantity)
            * (1 + Number(ingredient.wastage_percentage) / 100);

          depletionList.push({
            item_id: ingredient.item_id,
            quantity: consumption,
          });
        }
      }
    }

    let depletionResults: Array<{ extended_cost: number }> = [];
    if (depletionList.length > 0) {
      checkoutStage = 'posting inventory depletion';
      depletionResults = await this.inventoryOpService.depleteStock(clientId, branchId, {
        reference_id: `SALE-ORD-${orderId}`,
        items: depletionList,
      });
    }

    if (order.table_id) {
      checkoutStage = 'releasing the table';
      const table = await this.tableRepo.findOne({ where: { id: order.table_id, branch_id: branchId } });
      if (table) {
        table.status = 'vacant';
        await this.tableRepo.save(table);
      }
    }

    const receivableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1210',
      'Accounts Receivable',
      'asset',
    );
    const salesAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4100',
      'Food Sales',
      'revenue',
    );
    const serviceChargeAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4200',
      'Service Charges',
      'revenue',
    );
    const taxPayableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '2301',
      'GST Payable',
      'liability',
    );
    const cogsAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '5100',
      'Cost of Goods Sold',
      'expense',
    );
    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1300',
      'Raw Materials Inventory',
      'asset',
    );

    if (pricing.totalAmount > 0) {
      const foodSalesAmount = this.roundCurrency(
        Math.max(Number(pricing.subTotal) - Number(pricing.discountAmount), 0),
      );
      const serviceChargeAmount = this.roundCurrency(pricing.otherChargesAmount);
      const taxAmount = this.roundCurrency(pricing.taxAmount);
      const recognizedRevenueAmount = this.roundCurrency(foodSalesAmount + serviceChargeAmount + taxAmount);

      const journalItems = [{
        account_id: receivableAccount.id,
        debit: recognizedRevenueAmount,
        credit: 0,
      }];

      if (foodSalesAmount > 0) {
        journalItems.push({
          account_id: salesAccount.id,
          debit: 0,
          credit: foodSalesAmount,
        });
      }
      if (serviceChargeAmount > 0) {
        journalItems.push({
          account_id: serviceChargeAccount.id,
          debit: 0,
          credit: serviceChargeAmount,
        });
      }
      if (taxAmount > 0) {
        journalItems.push({
          account_id: taxPayableAccount.id,
          debit: 0,
          credit: taxAmount,
        });
      }

      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: order.finalized_at ?? new Date(),
        description: `POS Credit Sale - Order ${orderId}`,
        reference_id: order.receipt_number ?? `SALE-ORD-${orderId}`,
        source_module: 'pos',
        source_entity_type: 'order',
        source_entity_id: String(order.id),
        source_event: 'sale_receipt',
        posting_type: 'auto',
        items: journalItems,
      });
    }

    const costOfGoodsSold = this.roundCurrency(
      depletionResults.reduce((sum, line) => sum + Number(line.extended_cost || 0), 0),
    );
    if (costOfGoodsSold > 0) {
      checkoutStage = 'posting cost of goods sold';
      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: order.finalized_at ?? new Date(),
        description: `COGS - Order ${orderId}`,
        reference_id: order.receipt_number ?? `SALE-ORD-${orderId}`,
        source_module: 'pos',
        source_entity_type: 'order',
        source_entity_id: String(order.id),
        source_event: 'inventory_consumption',
        posting_type: 'auto',
        items: [
          { account_id: cogsAccount.id, debit: costOfGoodsSold, credit: 0 },
          { account_id: inventoryAccount.id, debit: 0, credit: costOfGoodsSold },
        ],
      });
    }

    checkoutStage = 'writing the audit trail';
    await this.operationalAuditService.log({
      user,
      action: 'POS Credit Sale Complete',
      entity: 'orders',
      clientId,
      branchId,
      entityId: order.id,
      portal: 'Terminal',
      details: `Closed order ${order.id} as credit sale`,
      metadata: {
        receipt_number: order.receipt_number,
        total_amount: pricing.totalAmount,
        customer_id: order.customer_id ?? null,
        shift_id: shift.id,
        payment_status: 'credited',
      },
    });

    checkoutStage = 'loading the final receipt';
    return this.getOrder(clientId, branchId, order.id);
  } catch (error) {
    this.rethrowCheckoutStageError(checkoutStage, error);
  }
  }

  async settleCreditOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    dto?: {
      customer_id?: number;
      order_taker_user_id?: number;
      payment_mode?: string;
      reference_number?: string;
      payments?: PosPaymentDto[];
      payment_note?: string;
    },
    user?: JwtPayload,
  ): Promise<any> {
    let checkoutStage = 'loading the order';

    try {
    const branch = await this.assertBranchBelongsToClient(clientId, branchId);
    const shift = await this.requireOpenShift(clientId, branchId);
    const actorId = typeof user?.sub === 'string' ? Number(user.sub) : Number(user?.sub ?? 0);
    const activeCounterSession = Number.isFinite(actorId) && actorId > 0
      ? await this.requireActiveCounterSessionForUser(clientId, branchId, actorId, shift.id)
      : null;
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (['cancelled', 'voided'].includes(order.order_status)) {
      throw new BadRequestException('Cancelled or voided orders cannot receive credit settlement.');
    }

    if (isNaN(Number(order.total_amount || 0)) || Number(order.total_amount || 0) <= 0) {
      throw new BadRequestException('Only orders with a positive balance can receive payment.');
    }

    if (dto?.customer_id) {
      order.customer_id = dto.customer_id;
    }
    if (dto?.order_taker_user_id) {
      const orderTakerUser = await this.requireBranchStaff(clientId, dto.order_taker_user_id);
      order.user_id = orderTakerUser.id;
    }
    if (order.customer_id) {
      await this.customersService.getCustomerDetail(clientId, order.customer_id);
    }

    const payments: PosPaymentDto[] = dto?.payments?.length
      ? dto.payments.map((payment) => ({
          ...payment,
          payment_mode: this.normalizePaymentMode(payment.payment_mode),
          amount: this.ensureNonNegativeMoney(payment.amount, 'Payment amount'),
          payment_details: this.normalizePaymentDetails(payment.payment_details) ?? undefined,
        }))
      : dto?.payment_mode
        ? [{
            payment_mode: this.normalizePaymentMode(dto.payment_mode),
            amount: 0,
            reference_number: dto.reference_number,
            notes: dto.payment_note,
            payment_details: undefined,
          }]
        : [];

    if (payments.length === 0) {
      throw new BadRequestException('Payment details are required to settle this credit order.');
    }

    const existingPaidAmount = this.roundCurrency(
      (order.transactions ?? [])
        .filter((payment) => !payment.is_refund)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
    const totalAmount = this.roundCurrency(Number(order.total_amount || 0));
    const outstandingAmount = this.roundCurrency(Math.max(totalAmount - existingPaidAmount, 0));

    if (outstandingAmount <= 0.009) {
      throw new BadRequestException('This order is already fully paid.');
    }

    if (payments.length === 1 && payments[0].amount === 0) {
      payments[0].amount = outstandingAmount;
    }

    const paymentTotal = this.roundCurrency(
      payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );

    if (paymentTotal <= 0.009) {
      throw new BadRequestException('Settlement amount must be greater than zero.');
    }

    if (paymentTotal - outstandingAmount > 0.01) {
      throw new BadRequestException(
        `Settlement total ${paymentTotal.toFixed(2)} exceeds outstanding balance ${outstandingAmount.toFixed(2)}.`,
      );
    }

    if (!order.id) {
      throw new Error('Cannot settle POS credit: missing order ID.');
    }

    const settlementTimestamp = payments.reduce<Date>((latest, payment) => {
      const candidate = payment.transaction_date ? new Date(payment.transaction_date) : new Date();
      if (Number.isNaN(candidate.getTime())) {
        return latest;
      }
      return candidate.getTime() > latest.getTime() ? candidate : latest;
    }, new Date());

    for (const payment of payments) {
      checkoutStage = 'saving payment transactions';
      await this.transactionRepo.insert({
        order_id: order.id,
        client_id: clientId,
        branch_id: branchId,
        user_id: Number.isFinite(actorId) ? actorId : order.user_id,
        shift_id: shift.id,
        amount: payment.amount,
        payment_mode: this.normalizePaymentMode(payment.payment_mode),
        reference_number: payment.reference_number?.trim() || null,
        transaction_date: payment.transaction_date ? new Date(payment.transaction_date) : new Date(),
        is_refund: false,
      });
    }

    checkoutStage = 'posting credit settlement journal entries';
    const cashAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1101',
      'Cash on Hand',
      'asset',
    );
    const bankAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1102',
      'Bank Account',
      'asset',
    );
    const merchantClearingAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1103',
      'Merchant Settlement Clearing',
      'asset',
    );
    const receivableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1210',
      'Accounts Receivable',
      'asset',
    );

    const settlementJournalItems = payments.map((payment) => ({
      account_id: this.resolvePosTenderAccountId(payment.payment_mode, {
        cashAccountId: cashAccount.id,
        bankAccountId: bankAccount.id,
        merchantClearingAccountId: merchantClearingAccount.id,
      }),
      debit: this.roundCurrency(payment.amount),
      credit: 0,
    }));
    settlementJournalItems.push({
      account_id: receivableAccount.id,
      debit: 0,
      credit: paymentTotal,
    });

    await this.accountingService.createJournalEntry(clientId, branchId, {
      transaction_date: settlementTimestamp,
      description: `POS Credit Settlement - Order ${orderId}`,
      reference_id: order.receipt_number ?? `CREDIT-SETTLE-${orderId}`,
      source_module: 'pos',
      source_entity_type: 'order',
      source_entity_id: String(order.id),
      source_event: 'credit_settlement',
      posting_type: 'auto',
      items: settlementJournalItems,
    });

    const paidAfterSettlement = this.roundCurrency(existingPaidAmount + paymentTotal);
    const isFullyPaid = Math.abs(paidAfterSettlement - totalAmount) <= 0.01 || paidAfterSettlement > totalAmount;
    const paymentStatus = isFullyPaid ? 'paid' : 'partial';
    const nextOrderStatus = isFullyPaid && !['completed', 'cancelled', 'voided'].includes(order.order_status)
      ? 'completed'
      : order.order_status;
    const finalizedAt = isFullyPaid ? (order.finalized_at ?? settlementTimestamp) : order.finalized_at;
    const finalizedByUserId = isFullyPaid && Number.isFinite(actorId)
      ? actorId
      : order.finalized_by_user_id;
    const receiptNumber = isFullyPaid
      ? (order.receipt_number ?? await this.generateReceiptNumber(clientId, branch))
      : order.receipt_number;

    checkoutStage = 'saving final order totals';
    await this.orderRepo.update(order.id, {
      customer_id: order.customer_id,
      payment_status: paymentStatus,
      order_status: nextOrderStatus,
      finalized_at: finalizedAt ?? null,
      finalized_by_user_id: finalizedByUserId ?? null,
      receipt_number: receiptNumber ?? null,
    });

    if (activeCounterSession) {
      checkoutStage = 'refreshing counter cash totals';
      const counterCash = await this.calculateCounterSessionCash(activeCounterSession, clientId, branchId);
      await this.authorizedTillRepo.update(activeCounterSession.id, {
        expected_cash: counterCash.expectedCash,
        variance: counterCash.variance,
      });
    }

    checkoutStage = 'refreshing shift cash totals';
    await this.refreshShiftExpectedCash(shift);

    checkoutStage = 'writing the audit trail';
    await this.operationalAuditService.log({
      user,
      action: 'POS Credit Settlement',
      entity: 'orders',
      clientId,
      branchId,
      entityId: order.id,
      portal: 'Terminal',
      details: `Recorded credit settlement for order ${order.id} amounting to ${paymentTotal.toFixed(2)}`,
      metadata: {
        payment_status: paymentStatus,
        settled_amount: paymentTotal,
        receipt_number: receiptNumber ?? null,
      },
    });

    checkoutStage = 'loading the final receipt';
    return this.getOrder(clientId, branchId, order.id);
  } catch (error) {
    this.rethrowCheckoutStageError(checkoutStage, error);
  }
  }

  async returnOrder(
    clientId: string,
    branchId: number,
    orderId: number,
    dto?: {
      payment_mode?: string;
      reference_number?: string;
      payments?: PosPaymentDto[];
      items?: Array<{ order_item_id: number; quantity: number }>;
      return_note?: string;
      payment_note?: string;
      restock_inventory?: boolean;
      approval_username: string;
      approval_pin: string;
    },
    user?: JwtPayload,
  ): Promise<any> {
    let returnStage = 'loading the sales return';
    await this.assertBranchBelongsToClient(clientId, branchId);
    let shift = await this.requireOpenShift(clientId, branchId);
    const order = await this.loadOrderOrFail(clientId, branchId, orderId);

    if (order.order_status !== 'completed') {
      throw new BadRequestException('Only completed orders can be returned.');
    }
    if (order.shift_id && order.shift_id !== shift.id) {
      throw new BadRequestException('Only paid orders from the active shift can be returned.');
    }

    const approver = await this.requireAuthorizedPinOverride(
      clientId,
      branchId,
      dto?.approval_username || '',
      dto?.approval_pin || '',
      'process sales returns',
    );

    const activeOrderItems = (order.items ?? []).filter((item) => item.item_status !== 'voided');
    if (activeOrderItems.length === 0) {
      throw new BadRequestException('This order has no returnable items.');
    }

    const existingRefundAmount = this.roundCurrency(
      (order.transactions ?? [])
        .filter((payment) => payment.is_refund)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
    const remainingRefundableAmount = this.roundCurrency(
      Math.max(Number(order.total_amount || 0) - existingRefundAmount, 0),
    );
    if (remainingRefundableAmount <= 0) {
      throw new BadRequestException('Only paid orders with a positive total can be returned.');
    }

    const returnedQtyByItemId = new Map<number, number>();
    let returnedBaseAmount = 0;
    let returnedDiscountAmount = 0;
    let returnedTaxAmount = 0;
    let returnedServiceChargeAmount = 0;

    for (const returnRecord of order.returns ?? []) {
      for (const returnItem of returnRecord.items ?? []) {
        returnedQtyByItemId.set(
          returnItem.order_item_id,
          (returnedQtyByItemId.get(returnItem.order_item_id) ?? 0) + Number(returnItem.quantity || 0),
        );
        returnedBaseAmount += Number(returnItem.base_amount || 0);
        returnedDiscountAmount += Number(returnItem.discount_amount || 0);
        returnedTaxAmount += Number(returnItem.tax_amount || 0);
        returnedServiceChargeAmount += Number(returnItem.service_charge_amount || 0);
      }
    }

    const availableLines = activeOrderItems
      .map((orderItem) => {
        const alreadyReturnedQuantity = returnedQtyByItemId.get(orderItem.id) ?? 0;
        const availableQuantity = Math.max(Number(orderItem.quantity || 0) - alreadyReturnedQuantity, 0);
        return {
          orderItem,
          availableQuantity,
          baseAmount: this.roundCurrency(availableQuantity * Number(orderItem.item_price || 0)),
        };
      })
      .filter((line) => line.availableQuantity > 0);

    if (availableLines.length === 0) {
      throw new BadRequestException('This order has already been fully returned.');
    }

    const requestedLines = dto?.items?.length
      ? dto.items
      : availableLines.map((line) => ({
          order_item_id: line.orderItem.id,
          quantity: line.availableQuantity,
        }));

    const requestedQtyByItemId = new Map<number, number>();
    const selectedLines = requestedLines.map((line) => {
      const matchedLine = availableLines.find((entry) => entry.orderItem.id === Number(line.order_item_id));
      if (!matchedLine) {
        throw new BadRequestException(`Order item ${line.order_item_id} is not available for return.`);
      }

      const quantity = Math.round(Number(line.quantity || 0));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('Return quantity must be greater than zero.');
      }
      if (quantity > matchedLine.availableQuantity) {
        throw new BadRequestException(
          `Return quantity for ${matchedLine.orderItem.product_name ?? matchedLine.orderItem.product?.product_name ?? `item ${matchedLine.orderItem.id}`} cannot exceed ${matchedLine.availableQuantity}.`,
        );
      }

      requestedQtyByItemId.set(matchedLine.orderItem.id, quantity);

      return {
        orderItem: matchedLine.orderItem,
        quantity,
        baseAmount: this.roundCurrency(quantity * Number(matchedLine.orderItem.item_price || 0)),
      };
    });

    const selectedBaseAmount = this.roundCurrency(
      selectedLines.reduce((sum, line) => sum + Number(line.baseAmount || 0), 0),
    );
    if (selectedBaseAmount <= 0) {
      throw new BadRequestException('Selected return items must have a positive refund value.');
    }

    const remainingBaseAmount = this.roundCurrency(
      Math.max(Number(order.sub_total || 0) - returnedBaseAmount, 0),
    );
    const remainingDiscountAmount = this.roundCurrency(
      Math.max(Number(order.discount_amount || 0) - returnedDiscountAmount, 0),
    );
    const remainingTaxAmount = this.roundCurrency(
      Math.max(Number(order.tax_amount || 0) - returnedTaxAmount, 0),
    );
    const remainingServiceAmount = this.roundCurrency(
      Math.max(this.getOrderServiceChargeAmount(order) - returnedServiceChargeAmount, 0),
    );

    const isReturningAllRemainingItems = availableLines.every(
      (line) => (requestedQtyByItemId.get(line.orderItem.id) ?? 0) === line.availableQuantity,
    );

    const selectedDiscountAmount = isReturningAllRemainingItems
      ? remainingDiscountAmount
      : this.roundCurrency(
          remainingBaseAmount > 0 ? (remainingDiscountAmount * selectedBaseAmount) / remainingBaseAmount : 0,
        );
    const selectedTaxAmount = isReturningAllRemainingItems
      ? remainingTaxAmount
      : this.roundCurrency(
          remainingBaseAmount > 0 ? (remainingTaxAmount * selectedBaseAmount) / remainingBaseAmount : 0,
        );
    const selectedServiceAmount = isReturningAllRemainingItems
      ? remainingServiceAmount
      : this.roundCurrency(
          remainingBaseAmount > 0 ? (remainingServiceAmount * selectedBaseAmount) / remainingBaseAmount : 0,
        );

    const refundTargetAmount = isReturningAllRemainingItems
      ? remainingRefundableAmount
      : this.roundCurrency(
          selectedBaseAmount - selectedDiscountAmount + selectedTaxAmount + selectedServiceAmount,
        );

    if (refundTargetAmount <= 0) {
      throw new BadRequestException('Calculated refund amount must be greater than zero.');
    }
    if (refundTargetAmount - remainingRefundableAmount > 0.01) {
      throw new BadRequestException('Calculated refund exceeds the remaining refundable balance.');
    }

    const allocationLines = selectedLines.map((line) => ({
      key: String(line.orderItem.id),
      base: line.baseAmount,
    }));
    const discountAllocation = this.allocateWeightedAmounts(selectedDiscountAmount, allocationLines);
    const taxAllocation = this.allocateWeightedAmounts(selectedTaxAmount, allocationLines);
    const serviceAllocation = this.allocateWeightedAmounts(selectedServiceAmount, allocationLines);

    const actorId = typeof user?.sub === 'string' ? Number(user.sub) : Number(user?.sub ?? order.user_id);
    const defaultRefundMode = this.normalizePaymentMode(
      order.transactions?.find((payment) => !payment.is_refund)?.payment_mode || 'cash',
    );

    const refundPayments: PosPaymentDto[] = dto?.payments?.length
      ? dto.payments.map((payment) => ({
          ...payment,
          payment_mode: this.normalizePaymentMode(payment.payment_mode),
          amount: this.ensureNonNegativeMoney(payment.amount, 'Refund amount'),
        }))
      : [{
          payment_mode: this.normalizePaymentMode(dto?.payment_mode || defaultRefundMode),
          amount: refundTargetAmount,
          reference_number: dto?.reference_number,
          notes: dto?.payment_note,
        }];

    const refundTotal = this.roundCurrency(
      refundPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );

    if (Math.abs(refundTotal - refundTargetAmount) > 0.01) {
      throw new BadRequestException(
        `Refund total ${refundTotal.toFixed(2)} must match the requested return amount ${refundTargetAmount.toFixed(2)}.`,
      );
    }

    const returnScope: 'full' | 'partial' = existingRefundAmount <= 0.01 && isReturningAllRemainingItems
      ? 'full'
      : 'partial';
    let returnRecord: OrderReturn;
    try {
      returnStage = 'saving the return record';
      returnRecord = await this.orderReturnRepo.save(this.orderReturnRepo.create({
        order_id: order.id,
        client_id: clientId,
        branch_id: branchId,
        processed_by_user_id: approver.id ?? (Number.isFinite(actorId) ? actorId : order.user_id),
        return_scope: returnScope,
        refund_amount: refundTargetAmount,
        restock_inventory: dto?.restock_inventory !== false,
        return_note: dto?.return_note?.trim() || null,
        payment_note: dto?.payment_note?.trim() || null,
      }));
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    const returnItems = selectedLines.map((line) => {
      const key = String(line.orderItem.id);
      const lineDiscountAmount = discountAllocation.get(key) ?? 0;
      const lineTaxAmount = taxAllocation.get(key) ?? 0;
      const lineServiceAmount = serviceAllocation.get(key) ?? 0;
      return this.orderReturnItemRepo.create({
        return_id: returnRecord.id,
        order_item_id: line.orderItem.id,
        product_id: line.orderItem.product_id,
        product_name: line.orderItem.product_name ?? line.orderItem.product?.product_name ?? `Product #${line.orderItem.product_id}`,
        quantity: line.quantity,
        unit_price: Number(line.orderItem.item_price || 0),
        base_amount: line.baseAmount,
        discount_amount: lineDiscountAmount,
        tax_amount: lineTaxAmount,
        service_charge_amount: lineServiceAmount,
        refund_amount: this.roundCurrency(
          line.baseAmount - lineDiscountAmount + lineTaxAmount + lineServiceAmount,
        ),
      });
    });
    try {
      returnStage = 'saving returned line items';
      await this.orderReturnItemRepo.save(returnItems);
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    if (!order.id) {
      throw new Error('Cannot save POS refund: missing order ID.');
    }

    try {
      returnStage = 'saving refund transactions';
      for (const payment of refundPayments) {
        await this.transactionRepo.insert({
          order_id: order.id,
          return_id: returnRecord.id,
          client_id: clientId,
          branch_id: branchId,
          user_id: Number.isFinite(actorId) ? actorId : order.user_id,
          shift_id: shift.id,
          amount: this.roundCurrency(payment.amount),
          payment_mode: this.normalizePaymentMode(payment.payment_mode),
          reference_number: payment.reference_number?.trim() || null,
          is_refund: true,
        });
      }
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    const restockInventory = dto?.restock_inventory !== false;
    let returnedInventoryCost = 0;
    if (restockInventory) {
      const replenishmentMap = new Map<number, number>();

      for (const line of selectedLines) {
        const recipes = await this.recipeService.findByProduct(clientId, line.orderItem.product_id);
        if (recipes.length === 0) {
          continue;
        }

        const recipeDetails = await this.recipeService.getRecipeDetails(clientId, recipes[0].id);
        for (const ingredient of recipeDetails.ingredients) {
          const quantity = Number(ingredient.quantity)
            * Number(line.quantity)
            * (1 + Number(ingredient.wastage_percentage) / 100);

          replenishmentMap.set(
            ingredient.item_id,
            this.roundCurrency((replenishmentMap.get(ingredient.item_id) ?? 0) + quantity),
          );
        }
      }

      try {
        returnStage = 'restocking returned inventory';
        for (const [itemId, quantity] of replenishmentMap.entries()) {
          if (quantity <= 0) {
            continue;
          }

          const adjustment = await this.inventoryOpService.adjustStock(
            clientId,
            branchId,
            {
              branch_id: branchId,
              item_id: itemId,
              quantity,
              type: 'adjustment',
              reason: `POS sales return order ${order.order_number || order.id}`,
              notes: dto?.return_note?.trim() || undefined,
            },
            user,
          );

          returnedInventoryCost += this.roundCurrency(
            Math.abs(Number(adjustment?.quantity || 0))
            * Number(adjustment?.ledger_entry?.unit_cost || 0),
          );
        }
      } catch (error) {
        this.rethrowCheckoutStageError(returnStage, error);
      }
    }

    const returnTimestamp = new Date();
    const returnNote = dto?.return_note?.trim();
    const returnAuditLine = `${returnScope === 'full' ? 'Full' : 'Partial'} sales return processed on ${returnTimestamp.toISOString()}${returnNote ? `: ${returnNote}` : ''}`;
    const finalRefundAmount = this.roundCurrency(existingRefundAmount + refundTargetAmount);
    order.payment_status = Math.abs(finalRefundAmount - Number(order.total_amount || 0)) <= 0.01
      ? 'refunded'
      : 'partially_refunded';
    order.order_note = [order.order_note?.trim(), returnAuditLine].filter(Boolean).join('\n\n');
    try {
      returnStage = 'updating the returned order';
      await this.orderRepo.update(order.id, {
        payment_status: order.payment_status,
        order_note: order.order_note,
        updated_at: returnTimestamp,
      });
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    try {
      returnStage = 'refreshing shift cash totals';
      shift = await this.refreshShiftExpectedCash(shift);
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    const cashAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1101',
      'Cash on Hand',
      'asset',
    );
    const bankAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1102',
      'Bank Current Account',
      'asset',
    );
    const merchantClearingAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1103',
      'Merchant Settlement Clearing',
      'asset',
    );
    const salesAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4100',
      'Food Sales',
      'revenue',
    );
    const serviceChargeAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '4200',
      'Service Charges',
      'revenue',
    );
    const taxPayableAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '2301',
      'GST Payable',
      'liability',
    );
    const cogsAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '5100',
      'Cost of Goods Sold',
      'expense',
    );
    const inventoryAccount = await this.accountingService.ensureDefaultAccount(
      clientId,
      '1300',
      'Raw Materials Inventory',
      'asset',
    );

    const revenueReversalItems = refundPayments.map((payment) => ({
      account_id: this.resolvePosTenderAccountId(payment.payment_mode, {
        cashAccountId: cashAccount.id,
        bankAccountId: bankAccount.id,
        merchantClearingAccountId: merchantClearingAccount.id,
      }),
      debit: 0,
      credit: this.roundCurrency(payment.amount),
    }));
    const foodSalesAmount = this.roundCurrency(
      Math.max(selectedBaseAmount - selectedDiscountAmount, 0),
    );
    const serviceChargeAmount = this.roundCurrency(selectedServiceAmount);
    const taxAmount = this.roundCurrency(selectedTaxAmount);

    if (foodSalesAmount > 0) {
      revenueReversalItems.push({
        account_id: salesAccount.id,
        debit: foodSalesAmount,
        credit: 0,
      });
    }
    if (serviceChargeAmount > 0) {
      revenueReversalItems.push({
        account_id: serviceChargeAccount.id,
        debit: serviceChargeAmount,
        credit: 0,
      });
    }
    if (taxAmount > 0) {
      revenueReversalItems.push({
        account_id: taxPayableAccount.id,
        debit: taxAmount,
        credit: 0,
      });
    }

    try {
      returnStage = 'posting the sales return journal entry';
      await this.accountingService.createJournalEntry(clientId, branchId, {
        transaction_date: returnTimestamp,
        description: `POS Sales Return - Order ${orderId}`,
        reference_id: `RET-ORD-${order.id}`,
        source_module: 'pos',
        source_entity_type: 'order',
        source_entity_id: String(order.id),
        source_event: 'sales_return_refund',
        posting_type: 'auto',
        items: revenueReversalItems,
      });
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    if (returnedInventoryCost > 0) {
      try {
        returnStage = 'posting the inventory restock journal entry';
        await this.accountingService.createJournalEntry(clientId, branchId, {
          transaction_date: returnTimestamp,
          description: `Sales Return Inventory Restock - Order ${orderId}`,
          reference_id: `RET-INV-${order.id}`,
          source_module: 'pos',
          source_entity_type: 'order',
          source_entity_id: String(order.id),
          source_event: 'sales_return_inventory_restock',
          posting_type: 'auto',
          items: [
            { account_id: inventoryAccount.id, debit: this.roundCurrency(returnedInventoryCost), credit: 0 },
            { account_id: cogsAccount.id, debit: 0, credit: this.roundCurrency(returnedInventoryCost) },
          ],
        });
      } catch (error) {
        this.rethrowCheckoutStageError(returnStage, error);
      }
    }

    try {
      returnStage = 'writing the sales return audit trail';
      await this.operationalAuditService.log({
        user,
        action: 'POS Sales Return',
        entity: 'orders',
        clientId,
        branchId,
        entityId: order.id,
        portal: 'Terminal',
        details: `${returnScope === 'full' ? 'Returned' : 'Partially returned'} order ${order.id}`,
        metadata: {
          return_id: returnRecord.id,
          return_scope: returnScope,
          order_number: order.order_number,
          refund_amount: refundTargetAmount,
          refund_modes: refundPayments.map((payment) => payment.payment_mode),
          reference_numbers: refundPayments.map((payment) => payment.reference_number || null),
          returned_items: returnItems.map((item) => ({
            order_item_id: item.order_item_id,
            product_name: item.product_name,
            quantity: Number(item.quantity || 0),
            refund_amount: Number(item.refund_amount || 0),
          })),
          restock_inventory: restockInventory,
          inventory_restock_cost: this.roundCurrency(returnedInventoryCost),
          shift_id: shift.id,
          approved_by_user_id: approver.id,
          approved_by_username: approver.user_name,
        },
      });
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }

    try {
      returnStage = 'loading the returned order';
      return this.getOrder(clientId, branchId, order.id);
    } catch (error) {
      this.rethrowCheckoutStageError(returnStage, error);
    }
  }

  async getBranchDaySummary(clientId: string, branchId: number) {
    await this.assertBranchBelongsToClient(clientId, branchId);

    const [rawShift, saleCounters, salesSummary, topItems, openOrders, activeKots] = await Promise.all([
      this.shiftRepo.findOne({
        where: { client_id: clientId, branch_id: branchId, status: 'open' },
        order: { opened_at: 'DESC' },
      }),
      this.saleCounterRepo.find({
        where: { client_id: clientId, branch_id: branchId, is_active: true },
        order: { name: 'ASC' },
      }),
      this.getSalesSummary(clientId, branchId),
      this.getTopItems(clientId, branchId, 5),
      this.orderRepo.count({
        where: {
          client_id: clientId,
          branch_id: branchId,
          order_status: In(['held', 'pending', 'preparing', 'ready', 'served']),
        },
      }),
      this.kotRepo.count({
        where: { client_id: clientId, branch_id: branchId, status: In(['pending', 'preparing', 'ready']) },
      }),
    ]);
    const currentShift = rawShift ? await this.refreshShiftExpectedCash(rawShift) : null;

    return {
      current_shift: currentShift
        ? {
            id: currentShift.id,
            opened_at: currentShift.opened_at,
            opening_float: Number(currentShift.opening_float),
            expected_cash: Number(currentShift.expected_cash),
            actual_cash: currentShift.actual_cash === null ? null : Number(currentShift.actual_cash),
            variance: Number(currentShift.variance ?? 0),
            status: currentShift.status,
            user_id: currentShift.user_id,
          }
        : null,
      sale_counters: saleCounters,
      reports: {
        ...salesSummary,
        topItems,
      },
      operational: {
        open_orders: openOrders,
        pending_kots: activeKots,
      },
    };
  }
}
