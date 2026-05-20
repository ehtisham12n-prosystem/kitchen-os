import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerLoyaltyLedger } from './entities/customer-loyalty-ledger.entity';
import { Order } from '../pos/entities/order.entity';
import { Branch } from '../setup/entities/branch.entity';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { createDefaultClientNumberingSettings } from '../setup/branches/branch-config.types';
import {
  CreateCustomerDto,
  ListCustomersDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerLoyaltyLedger)
    private readonly loyaltyLedgerRepo: Repository<CustomerLoyaltyLedger>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly dataSource: DataSource,
  ) {}

  private roundMoney(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.round(numeric * 100) / 100;
  }

  private normalizeString(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeFollowUpDate(value?: string | null): string | null {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('Collection follow-up date must be in YYYY-MM-DD format.');
    }
    return normalized;
  }

  private async buildCustomerCode(clientId: string, customerId: number): Promise<string> {
    const settings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });
    const defaults = createDefaultClientNumberingSettings();
    const prefix = settings?.numbering_settings?.customer_code_prefix || defaults.customer_code_prefix;
    const zeroPad = settings?.numbering_settings?.customer_code_zero_pad || defaults.customer_code_zero_pad;
    return `${prefix}-${String(customerId).padStart(zeroPad, '0')}`;
  }

  private async assertPreferredBranch(clientId: string, branchId?: number | null): Promise<number | null> {
    if (!branchId) {
      return null;
    }

    const branch = await this.branchRepo.findOne({
      where: { id: branchId, client_id: clientId },
    });
    if (!branch) {
      throw new BadRequestException('Preferred branch does not belong to the active client.');
    }

    return branch.id;
  }

  private async findCustomerOrFail(clientId: string, customerId: number): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, client_id: clientId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async assertUniquePhoneNumber(
    clientId: string,
    phoneNumber?: string | null,
    ignoreCustomerId?: number,
  ): Promise<void> {
    const normalizedPhone = this.normalizeString(phoneNumber);
    if (!normalizedPhone) {
      return;
    }

    const existing = await this.customerRepo.findOne({
      where: { client_id: clientId, phone_number: normalizedPhone },
      select: ['id', 'name', 'phone_number'],
    });

    if (existing && existing.id !== ignoreCustomerId) {
      throw new ConflictException(
        `Phone number ${normalizedPhone} is already assigned to ${existing.name}.`,
      );
    }
  }

  private translatePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (error as any).driverError || {};
      const code = String(driverError.code ?? driverError.errno ?? '');
      const message = String(driverError.sqlMessage || driverError.message || error.message || '');
      const lowered = message.toLowerCase();

      if (code === '1062' || lowered.includes('duplicate entry')) {
        if (lowered.includes('phone_number')) {
          throw new ConflictException('This phone number is already assigned to another customer.');
        }
        if (lowered.includes('email')) {
          throw new ConflictException('This email address is already assigned to another customer.');
        }
        if (lowered.includes('customer_code')) {
          throw new ConflictException('The generated customer code already exists. Please try again.');
        }
        throw new ConflictException('A customer with the same unique details already exists.');
      }

      if (code === '1054' || lowered.includes('unknown column')) {
        const columnMatch = message.match(/Unknown column '([^']+)'/i);
        const columnName = columnMatch?.[1] || 'a required customer field';
        throw new BadRequestException(
          `Customer setup is incomplete in the database. Missing column: ${columnName}. Run the latest customer migrations.`,
        );
      }

      if (code === '1364' || lowered.includes("doesn't have a default value")) {
        const fieldMatch = message.match(/Field '([^']+)'/i);
        const fieldName = fieldMatch?.[1] || 'required field';
        throw new BadRequestException(
          `Customer setup is incomplete in the database. ${fieldName} does not have a default value.`,
        );
      }

      if (code === '1406' || lowered.includes('data too long')) {
        const fieldMatch = message.match(/column '([^']+)'/i);
        const fieldName = fieldMatch?.[1] || 'one of the customer fields';
        throw new BadRequestException(`${fieldName} is too long. Shorten that value and try again.`);
      }
    }

    throw error;
  }

  async createCustomer(clientId: string, dto: CreateCustomerDto): Promise<Customer> {
    try {
      await this.assertUniquePhoneNumber(clientId, dto.phone_number);
      const customer = this.customerRepo.create({
        client_id: clientId,
        ...dto,
        name: dto.name.trim(),
        customer_code: null,
        phone_number: this.normalizeString(dto.phone_number),
        email: this.normalizeString(dto.email),
        address_line_1: this.normalizeString(dto.address_line_1),
        address_line_2: this.normalizeString(dto.address_line_2),
        city: this.normalizeString(dto.city),
        country: this.normalizeString(dto.country),
        designation: this.normalizeString(dto.designation),
        organization: this.normalizeString(dto.organization),
        notes: this.normalizeString(dto.notes),
        allow_credit: Boolean(dto.allow_credit),
        credit_limit: this.roundMoney(dto.credit_limit ?? 0),
        credit_control_mode: dto.credit_control_mode ?? 'block',
        collection_follow_up_date: this.normalizeFollowUpDate(dto.collection_follow_up_date),
        collection_follow_up_note: this.normalizeString(dto.collection_follow_up_note),
        preferred_branch_id: await this.assertPreferredBranch(clientId, dto.preferred_branch_id),
      } as Partial<Customer>);
      const saved = await this.customerRepo.save(customer);
      saved.customer_code = await this.buildCustomerCode(clientId, saved.id);
      return await this.customerRepo.save(saved);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async updateCustomer(clientId: string, customerId: number, dto: UpdateCustomerDto): Promise<Customer> {
    try {
      const customer = await this.findCustomerOrFail(clientId, customerId);

      if (dto.name !== undefined) {
        customer.name = dto.name.trim();
      }
      if (dto.customer_code !== undefined) {
        customer.customer_code = this.normalizeString(dto.customer_code)?.toUpperCase() ?? customer.customer_code;
      }
      if (dto.phone_number !== undefined) {
        await this.assertUniquePhoneNumber(clientId, dto.phone_number, customerId);
        customer.phone_number = this.normalizeString(dto.phone_number);
      }
      if (dto.email !== undefined) {
        customer.email = this.normalizeString(dto.email);
      }
      if (dto.status !== undefined) {
        customer.status = dto.status;
      }
      if (dto.gender !== undefined) {
        customer.gender = dto.gender ?? null;
      }
      if (dto.preferred_branch_id !== undefined) {
        customer.preferred_branch_id = await this.assertPreferredBranch(clientId, dto.preferred_branch_id);
      }
      if (dto.address_line_1 !== undefined) {
        customer.address_line_1 = this.normalizeString(dto.address_line_1);
      }
      if (dto.address_line_2 !== undefined) {
        customer.address_line_2 = this.normalizeString(dto.address_line_2);
      }
      if (dto.city !== undefined) {
        customer.city = this.normalizeString(dto.city);
      }
      if (dto.country !== undefined) {
        customer.country = this.normalizeString(dto.country);
      }
      if (dto.designation !== undefined) {
        customer.designation = this.normalizeString(dto.designation);
      }
      if (dto.organization !== undefined) {
        customer.organization = this.normalizeString(dto.organization);
      }
      if (dto.notes !== undefined) {
        customer.notes = this.normalizeString(dto.notes);
      }
      if (dto.allow_credit !== undefined) {
        customer.allow_credit = dto.allow_credit;
      }
      if (dto.credit_limit !== undefined) {
        customer.credit_limit = this.roundMoney(dto.credit_limit);
      }
      if (dto.credit_control_mode !== undefined) {
        customer.credit_control_mode = dto.credit_control_mode;
      }
      if (dto.collection_follow_up_date !== undefined) {
        customer.collection_follow_up_date = this.normalizeFollowUpDate(dto.collection_follow_up_date);
      }
      if (dto.collection_follow_up_note !== undefined) {
        customer.collection_follow_up_note = this.normalizeString(dto.collection_follow_up_note);
      }
      if (dto.marketing_opt_in !== undefined) {
        customer.marketing_opt_in = dto.marketing_opt_in;
      }

      return await this.customerRepo.save(customer);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async getCustomers(clientId: string, query?: ListCustomersDto): Promise<any[]> {
    const builder = this.customerRepo.createQueryBuilder('customer')
      .where('customer.client_id = :clientId', { clientId });

    if (query?.status) {
      builder.andWhere('customer.status = :status', { status: query.status });
    }

    if (query?.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere(
        '(customer.name LIKE :search OR customer.phone_number LIKE :search OR customer.email LIKE :search OR customer.customer_code LIKE :search)',
        { search },
      );
    }

    const customers = await builder
      .orderBy('customer.last_visit_at', 'DESC')
      .addOrderBy('customer.name', 'ASC')
      .getMany();

    return customers.map((customer) => ({
      ...customer,
      wallet_balance: this.roundMoney(customer.wallet_balance),
      total_spent: this.roundMoney(customer.total_spent),
      average_order_value: this.roundMoney(customer.average_order_value),
    }));
  }

  async getCustomerSummary(clientId: string): Promise<any> {
    const totals = await this.customerRepo.createQueryBuilder('customer')
      .select('COUNT(customer.id)', 'customer_count')
      .addSelect("SUM(CASE WHEN customer.status = 'active' THEN 1 ELSE 0 END)", 'active_count')
      .addSelect('SUM(customer.loyalty_points)', 'loyalty_points')
      .addSelect('SUM(customer.total_spent)', 'total_spent')
      .where('customer.client_id = :clientId', { clientId })
      .getRawOne();

    const topCustomers = await this.customerRepo.find({
      where: { client_id: clientId, status: 'active' },
      order: { total_spent: 'DESC', loyalty_points: 'DESC', updated_at: 'DESC' },
      take: 5,
    });

    return {
      customer_count: Number(totals?.customer_count || 0),
      active_count: Number(totals?.active_count || 0),
      loyalty_points: Number(totals?.loyalty_points || 0),
      total_spent: this.roundMoney(totals?.total_spent || 0),
      top_customers: topCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        loyalty_points: Number(customer.loyalty_points || 0),
        total_spent: this.roundMoney(customer.total_spent),
        last_visit_at: customer.last_visit_at,
      })),
    };
  }

  async getCustomerDetail(clientId: string, customerId: number): Promise<any> {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, client_id: clientId },
      relations: ['preferred_branch'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const [recentOrders, recentLedger] = await Promise.all([
      this.getPurchaseHistory(clientId, customerId, 10),
      this.getLoyaltyLedger(clientId, customerId, 10),
    ]);

    return {
      ...customer,
      wallet_balance: this.roundMoney(customer.wallet_balance),
      total_spent: this.roundMoney(customer.total_spent),
      average_order_value: this.roundMoney(customer.average_order_value),
      recent_orders: recentOrders,
      loyalty_ledger: recentLedger,
    };
  }

  async getPurchaseHistory(clientId: string, customerId: number, limit: number = 20): Promise<any[]> {
    await this.findCustomerOrFail(clientId, customerId);

    const orders = await this.orderRepo.find({
      where: {
        client_id: clientId,
        customer_id: customerId,
        order_status: 'completed',
      },
      relations: ['items', 'transactions', 'voucher'],
      order: { finalized_at: 'DESC', created_at: 'DESC' },
      take: Math.min(Math.max(limit || 20, 1), 100),
    });

    return orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      receipt_number: order.receipt_number,
      branch_id: order.branch_id,
      order_type: order.order_type,
      finalized_at: order.finalized_at,
      total_amount: this.roundMoney(order.total_amount),
      discount_amount: this.roundMoney(order.discount_amount),
      voucher_code: order.voucher?.code ?? null,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name ?? item.product?.product_name ?? `Product #${item.product_id}`,
        quantity: Number(item.quantity || 0),
        item_price: this.roundMoney(item.item_price),
        item_status: item.item_status,
      })),
      payments: (order.transactions ?? []).map((payment) => ({
        id: payment.id,
        payment_mode: payment.payment_mode,
        amount: this.roundMoney(payment.amount),
        reference_number: payment.reference_number,
      })),
    }));
  }

  async getLoyaltyLedger(clientId: string, customerId: number, limit: number = 20): Promise<any[]> {
    await this.findCustomerOrFail(clientId, customerId);

    const rows = await this.loyaltyLedgerRepo.find({
      where: { client_id: clientId, customer_id: customerId },
      order: { created_at: 'DESC', id: 'DESC' },
      take: Math.min(Math.max(limit || 20, 1), 100),
    });

    return rows.map((row) => ({
      ...row,
      balance_after: Number(row.balance_after || 0),
      points_delta: Number(row.points_delta || 0),
    }));
  }

  async findByPhone(clientId: string, phoneNumber: string): Promise<Customer | null> {
    return this.customerRepo.findOne({
      where: { client_id: clientId, phone_number: phoneNumber.trim() },
    });
  }

  async addLoyaltyPoints(clientId: string, customerId: number, points: number): Promise<Customer> {
    const customer = await this.findCustomerOrFail(clientId, customerId);

    customer.loyalty_points = Number(customer.loyalty_points) + points;
    return this.customerRepo.save(customer);
  }

  async awardLoyaltyPointsForOrder(
    clientId: string,
    branchId: number,
    customerId: number,
    orderId: number,
    orderTotal: number,
    actorId?: number,
  ): Promise<{ customer: Customer; points_awarded: number }> {
    const customer = await this.findCustomerOrFail(clientId, customerId);
    const existing = await this.loyaltyLedgerRepo.findOne({
      where: {
        client_id: clientId,
        customer_id: customerId,
        source_order_id: orderId,
        event_type: 'earn',
      },
    });

    const normalizedTotal = this.roundMoney(orderTotal);
    const pointsAwarded = Math.floor(normalizedTotal / 10);

    customer.last_visit_at = new Date();
    customer.last_order_at = new Date();
    customer.total_orders = Number(customer.total_orders || 0) + (existing ? 0 : 1);
    customer.total_spent = this.roundMoney(Number(customer.total_spent || 0) + (existing ? 0 : normalizedTotal));
    customer.average_order_value = customer.total_orders > 0
      ? this.roundMoney(Number(customer.total_spent || 0) / Number(customer.total_orders))
      : 0;

    if (!existing && pointsAwarded > 0) {
      customer.loyalty_points = Number(customer.loyalty_points || 0) + pointsAwarded;
      customer.loyalty_points_lifetime = Number(customer.loyalty_points_lifetime || 0) + pointsAwarded;

      await this.loyaltyLedgerRepo.save(this.loyaltyLedgerRepo.create({
        client_id: clientId,
        branch_id: branchId,
        customer_id: customerId,
        source_order_id: orderId,
        event_type: 'earn',
        points_delta: pointsAwarded,
        balance_after: customer.loyalty_points,
        remarks: `Earned from order #${orderId}`,
        created_by_user_id: actorId ?? null,
      }));
    }

    await this.customerRepo.save(customer);

    return { customer, points_awarded: existing ? 0 : pointsAwarded };
  }

  async adjustLoyaltyPoints(
    clientId: string,
    customerId: number,
    pointsDelta: number,
    remarks?: string,
    actorId?: number,
  ): Promise<Customer> {
    const customer = await this.findCustomerOrFail(clientId, customerId);
    const nextBalance = Number(customer.loyalty_points || 0) + Number(pointsDelta || 0);

    if (nextBalance < 0) {
      throw new BadRequestException('Loyalty balance cannot go below zero.');
    }

    customer.loyalty_points = nextBalance;
    if (pointsDelta > 0) {
      customer.loyalty_points_lifetime = Number(customer.loyalty_points_lifetime || 0) + Number(pointsDelta);
    }

    await this.loyaltyLedgerRepo.save(this.loyaltyLedgerRepo.create({
      client_id: clientId,
      branch_id: customer.preferred_branch_id,
      customer_id: customerId,
      source_order_id: null,
      event_type: 'adjust',
      points_delta: Number(pointsDelta),
      balance_after: nextBalance,
      remarks: this.normalizeString(remarks) ?? 'Manual loyalty adjustment',
      created_by_user_id: actorId ?? null,
    }));

    return this.customerRepo.save(customer);
  }
}
