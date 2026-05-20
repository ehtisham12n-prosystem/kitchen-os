import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Voucher } from './entities/voucher.entity';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';
import { VoucherRedemption } from './entities/voucher-redemption.entity';
import { Order } from '../pos/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
    @InjectRepository(VoucherRedemption)
    private readonly redemptionRepo: Repository<VoucherRedemption>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  private roundCurrency(value: unknown): number {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized)) {
      return 0;
    }
    return Math.round(normalized * 100) / 100;
  }

  private normalizeBranchAvailability(input?: Record<string, boolean>): Record<string, boolean> | null {
    if (!input) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [String(key), Boolean(value)]),
    );
  }

  private async assertVoucherEligibility(
    voucher: Voucher,
    clientId: string,
    orderTotal: number,
    options?: {
      branchId?: number;
      customerId?: number;
      orderType?: string;
      excludeOrderId?: number;
    },
  ): Promise<number> {
    if (!voucher.is_active) throw new BadRequestException('Voucher is inactive');

    const now = new Date();
    if (voucher.start_date && new Date(voucher.start_date) > now) {
      throw new BadRequestException('Voucher is not yet active');
    }
    if (voucher.end_date && new Date(voucher.end_date) < now) {
      throw new BadRequestException('Voucher has expired');
    }

    if (voucher.usage_limit && voucher.usage_count >= voucher.usage_limit) {
      throw new BadRequestException('Voucher usage limit reached');
    }

    if (options?.branchId && voucher.branchAvailability) {
      const allowed = voucher.branchAvailability[String(options.branchId)];
      if (allowed === false) {
        throw new BadRequestException('Voucher is not available for this branch');
      }
    }

    if (voucher.applicable_order_types?.length && options?.orderType) {
      if (!voucher.applicable_order_types.includes(options.orderType)) {
        throw new BadRequestException('Voucher is not valid for this order type');
      }
    }

    if (voucher.customer_required && !options?.customerId) {
      throw new BadRequestException('Voucher requires a linked customer');
    }

    if (voucher.per_customer_limit && options?.customerId) {
      const redemptionCount = await this.redemptionRepo.count({
        where: {
          client_id: clientId,
          voucher_id: voucher.id,
          customer_id: options.customerId,
        },
      });

      if (redemptionCount >= voucher.per_customer_limit) {
        throw new BadRequestException('Customer redemption limit reached for this voucher');
      }
    }

    if (voucher.first_order_only && options?.customerId) {
      const priorOrders = await this.orderRepo.count({
        where: {
          client_id: clientId,
          customer_id: options.customerId,
          order_status: 'completed',
        },
      });

      if (priorOrders > (options.excludeOrderId ? 1 : 0)) {
        throw new BadRequestException('Voucher is only valid for a customer first order');
      }
    }

    if (Number(orderTotal) < Number(voucher.min_order_value)) {
      throw new BadRequestException(`Minimum order value is ${voucher.min_order_value}`);
    }

    let discountAmount = 0;

    if (voucher.discount_type === 'percentage') {
      discountAmount = Number(orderTotal) * (Number(voucher.discount_value) / 100);
      if (voucher.max_discount_amount && discountAmount > Number(voucher.max_discount_amount)) {
        discountAmount = Number(voucher.max_discount_amount);
      }
    } else if (voucher.discount_type === 'fixed_amount') {
      discountAmount = Number(voucher.discount_value);
    }

    if (discountAmount > Number(orderTotal)) {
      discountAmount = Number(orderTotal);
    }

    return this.roundCurrency(discountAmount);
  }

  async createVoucher(clientId: string, dto: CreateVoucherDto): Promise<Voucher> {
    const voucher = this.voucherRepo.create({
      client_id: clientId,
      ...dto,
      code: dto.code.toUpperCase(),
      name: dto.name?.trim() || null,
      description: dto.description?.trim() || null,
      branchAvailability: this.normalizeBranchAvailability(dto.branchAvailability),
      applicable_order_types: dto.applicable_order_types?.length ? dto.applicable_order_types : null,
    } as Partial<Voucher>);

    return this.voucherRepo.save(voucher);
  }

  async updateVoucher(clientId: string, id: number, dto: UpdateVoucherDto): Promise<Voucher> {
    const voucher = await this.voucherRepo.findOne({ where: { client_id: clientId, id } });
    if (!voucher) throw new NotFoundException('Voucher not found');

    const { code, ...rest } = dto;

    if (code) {
      voucher.code = code.toUpperCase();
    }

    Object.assign(voucher, rest);
    voucher.name = dto.name === undefined ? voucher.name : dto.name?.trim() || null;
    voucher.description = dto.description === undefined ? voucher.description : dto.description?.trim() || null;
    if (dto.branchAvailability !== undefined) {
      voucher.branchAvailability = this.normalizeBranchAvailability(dto.branchAvailability);
    }
    if (dto.applicable_order_types !== undefined) {
      voucher.applicable_order_types = dto.applicable_order_types?.length ? dto.applicable_order_types : null;
    }
    return this.voucherRepo.save(voucher);
  }

  async getVouchers(clientId: string): Promise<Voucher[]> {
    return this.voucherRepo.find({
      where: { client_id: clientId },
      order: { is_active: 'DESC', end_date: 'ASC', created_at: 'DESC' },
    });
  }

  async validateVoucher(
    clientId: string,
    code: string,
    orderTotal: number,
    options?: {
      branchId?: number;
      customerId?: number;
      orderType?: string;
      excludeOrderId?: number;
    },
  ): Promise<any> {
    const normalizedCode = code.toUpperCase();

    const voucher = await this.voucherRepo.findOne({
      where: { client_id: clientId, code: normalizedCode },
    });

    if (!voucher) throw new NotFoundException('Voucher not found');
    const discountAmount = await this.assertVoucherEligibility(voucher, clientId, orderTotal, options);

    return {
      voucher_id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      discount_type: voucher.discount_type,
      discount_amount: discountAmount,
      usage_remaining: voucher.usage_limit
        ? Math.max(Number(voucher.usage_limit) - Number(voucher.usage_count), 0)
        : null,
    };
  }

  async redeemVoucher(clientId: string, code: string): Promise<void> {
    const normalizedCode = code.toUpperCase();
    const voucher = await this.voucherRepo.findOne({
      where: { client_id: clientId, code: normalizedCode },
    });

    if (voucher) {
      voucher.usage_count += 1;
      await this.voucherRepo.save(voucher);
    }
  }

  async redeemVoucherForOrder(
    clientId: string,
    params: {
      branchId: number;
      orderId: number;
      customerId?: number | null;
      code: string;
      orderTotal: number;
      orderType?: string;
      redeemedByUserId?: number | null;
    },
  ): Promise<{ voucher_id: number; code: string; discount_amount: number }> {
    return this.dataSource.transaction(async (manager) => {
      const voucherRepo = manager.getRepository(Voucher);
      const redemptionRepo = manager.getRepository(VoucherRedemption);

      const existing = await redemptionRepo.findOne({
        where: { client_id: clientId, order_id: params.orderId },
      });
      if (existing) {
        return {
          voucher_id: existing.voucher_id,
          code: existing.voucher_code,
          discount_amount: this.roundCurrency(existing.discount_amount),
        };
      }

      const voucher = await voucherRepo.createQueryBuilder('voucher')
        .setLock('pessimistic_write')
        .where('voucher.client_id = :clientId', { clientId })
        .andWhere('voucher.code = :code', { code: params.code.toUpperCase() })
        .getOne();

      if (!voucher) {
        throw new NotFoundException('Voucher not found');
      }

      if (params.customerId) {
        const customer = await this.customerRepo.findOne({
          where: { id: params.customerId, client_id: clientId },
        });
        if (!customer) {
          throw new BadRequestException('Customer not found for voucher redemption');
        }
      }

      const discountAmount = await this.assertVoucherEligibility(voucher, clientId, params.orderTotal, {
        branchId: params.branchId,
        customerId: params.customerId ?? undefined,
        orderType: params.orderType,
        excludeOrderId: params.orderId,
      });

      voucher.usage_count = Number(voucher.usage_count || 0) + 1;
      await voucherRepo.save(voucher);

      const redemption = redemptionRepo.create({
        client_id: clientId,
        branch_id: params.branchId,
        voucher_id: voucher.id,
        order_id: params.orderId,
        customer_id: params.customerId ?? null,
        voucher_code: voucher.code,
        sub_total: this.roundCurrency(params.orderTotal),
        discount_amount: discountAmount,
        redeemed_by_user_id: params.redeemedByUserId ?? null,
      });
      await redemptionRepo.save(redemption);

      return {
        voucher_id: voucher.id,
        code: voucher.code,
        discount_amount: discountAmount,
      };
    });
  }

  async getRecentRedemptions(clientId: string): Promise<any[]> {
    const redemptions = await this.redemptionRepo.find({
      where: { client_id: clientId },
      relations: ['voucher', 'customer'],
      order: { created_at: 'DESC' },
      take: 15,
    });

    return redemptions.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      branch_id: row.branch_id,
      order_id: row.order_id,
      voucher_id: row.voucher_id,
      voucher_code: row.voucher_code,
      voucher_name: row.voucher?.name ?? null,
      customer_name: row.customer?.name ?? null,
      discount_amount: this.roundCurrency(row.discount_amount),
      sub_total: this.roundCurrency(row.sub_total),
    }));
  }
}
